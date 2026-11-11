// Gate: 호스트 전체에 하나뿐인 Durable Object.
//  - 새 사이트·신고 횟수 제한(IP별, 전체)
//  - 사이트 목록과 저장량 합계(사이트 파일 + 실시간 방. 가득 차면 새로 받지 않음)
//  - 신고 보관
// Worker와 Site만 부릅니다(바깥에서 직접 닿을 수 없음).
import { DurableObject } from 'cloudflare:workers';
import { config, DAY_MS, HOUR_MS } from './config.js';
import { HttpError, json, readJson } from './http.js';
import { sha256Hex, ipBucket } from './ids.js';

export class Gate extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.cfg = config(env);
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS rl (k TEXT PRIMARY KEY, n INTEGER NOT NULL, exp INTEGER NOT NULL) WITHOUT ROWID;
      CREATE TABLE IF NOT EXISTS sites (id TEXT PRIMARY KEY, bytes INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL, expires INTEGER NOT NULL, blocked INTEGER NOT NULL DEFAULT 0, room_bytes INTEGER NOT NULL DEFAULT 0, code TEXT NOT NULL DEFAULT '') WITHOUT ROWID;
      CREATE TABLE IF NOT EXISTS reports (n INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, site TEXT NOT NULL, reason TEXT NOT NULL, contact TEXT NOT NULL DEFAULT '');
    `);
  }

  async fetch(request) {
    try {
      const op = new URL(request.url).pathname.slice(1);
      const body = request.method === 'POST' ? await readJson(request, 64 * 1024) : {};
      switch (`${request.method} ${op}`) {
        case 'POST reserve': return json(await this.reserve(body));
        case 'POST site': return json(this.siteUpdate(body));
        case 'POST forget': return json(this.forget(body));
        case 'POST room': return json(this.room(body));
        case 'GET usage': return json(this.usage());
        case 'POST report': return json(await this.report(body));
        case 'GET reports': return json({ reports: this.sql.exec('SELECT n, at, site, reason, contact FROM reports ORDER BY n DESC').toArray() });
        case 'GET sites': return json({ total: this.usage(), sites: this.sql.exec('SELECT id, bytes, room_bytes AS roomBytes, code AS liveCode, created AS createdAt, expires AS expiresAt, blocked FROM sites ORDER BY created DESC LIMIT 1000').toArray().map((s) => ({ ...s, blocked: !!s.blocked })) });
        default: throw new HttpError('not_found', '없는 주소예요.');
      }
    } catch (e) {
      if (e instanceof HttpError) return e.toResponse();
      throw e;
    }
  }

  count(k) { return this.sql.exec('SELECT n FROM rl WHERE k = ?', k).toArray()[0]?.n || 0; }
  bump(k, exp) { this.sql.exec('INSERT INTO rl (k, n, exp) VALUES (?, 1, ?) ON CONFLICT (k) DO UPDATE SET n = n + 1', k, exp); }

  /** 횟수 제한 열쇠. IP는 그대로 두지 않고 시간 구간과 함께 해시해 둠(구간이 지나면 지움) */
  async windows(kind, ip, now) {
    const hour = Math.floor(now / HOUR_MS); const day = Math.floor(now / DAY_MS);
    const who = (await sha256Hex(`${kind}|${ipBucket(ip)}|${day}`)).slice(0, 24);
    return {
      hour: { k: `${kind}:h:${who}:${hour}`, exp: (hour + 1) * HOUR_MS },
      day: { k: `${kind}:d:${who}:${day}`, exp: (day + 1) * DAY_MS },
      all: { k: `${kind}:all:${day}`, exp: (day + 1) * DAY_MS },
    };
  }
  limited(w, now) {
    return new HttpError('rate_limited', undefined, { headers: { 'retry-after': String(Math.max(1, Math.ceil((w.exp - now) / 1000))) } });
  }

  /** 새 사이트 자리 잡기: 횟수·저장량을 보고 목록에 올림 */
  async reserve({ ip, id, created, expires }) {
    const now = Date.now(); const c = this.cfg;
    const w = await this.windows('site', ip, now);
    if (this.count(w.hour.k) >= c.sitesPerHour) throw this.limited(w.hour, now);
    if (this.count(w.day.k) >= c.sitesPerDay) throw this.limited(w.day, now);
    if (this.count(w.all.k) >= c.dailySiteCap) throw new HttpError('rate_limited', '오늘은 바로 공개로 새 사이트를 더 만들 수 없어요. 내일 다시 하거나 다른 공개 방법을 써 주세요.', { headers: { 'retry-after': String(Math.ceil((w.all.exp - now) / 1000)) } });
    if (this.usage().bytes > c.maxTotalBytes) throw new HttpError('full');
    if (this.sql.exec('SELECT 1 FROM sites WHERE id = ?', id).toArray().length) throw new HttpError('bad_request', '이미 있는 주소예요.', { status: 409 });
    this.ctx.storage.transactionSync(() => {
      for (const x of [w.hour, w.day, w.all]) this.bump(x.k, x.exp);
      this.sql.exec('INSERT INTO sites (id, bytes, created, expires) VALUES (?, 0, ?, ?)', id, created, expires);
    });
    await this.ensureAlarm();
    return { ok: true };
  }

  /** Site·Room이 올리기·가리기·파일 변동 뒤에 알려 줌. 보낸 값만 바꿈 */
  siteUpdate({ id, bytes, expires, blocked, roomBytes, code }) {
    const row = this.sql.exec('SELECT bytes, expires, blocked, room_bytes, code FROM sites WHERE id = ?', id).toArray()[0];
    if (!row) return { ok: false, total: this.usage().bytes };
    const int = (v, d) => (Number.isSafeInteger(v) && v >= 0 ? v : d);
    this.sql.exec('UPDATE sites SET bytes = ?, expires = ?, blocked = ?, room_bytes = ?, code = ? WHERE id = ?',
      int(bytes, row.bytes), int(expires, row.expires), blocked === undefined ? row.blocked : blocked ? 1 : 0, int(roomBytes, row.room_bytes), typeof code === 'string' ? code : row.code, id);
    return { ok: true, total: this.usage().bytes };
  }
  forget({ id }) { this.sql.exec('DELETE FROM sites WHERE id = ?', id); return { ok: true }; }
  /** bytes = 사이트 파일 + 실시간 방(참가 기록·보드 파일) */
  usage() {
    const r = this.sql.exec('SELECT COUNT(*) AS sites, COALESCE(SUM(bytes + room_bytes), 0) AS bytes FROM sites').one();
    return { sites: r.sites, bytes: r.bytes };
  }
  /** 새 실시간 방 자리: 하루 전체 개수와 저장량을 봄 */
  room() {
    const now = Date.now(); const day = Math.floor(now / DAY_MS);
    const k = `room:all:${day}`;
    if (this.count(k) >= this.cfg.dailyRoomCap) throw new HttpError('rate_limited', '오늘은 실시간 방을 더 만들 수 없어요. 내일 다시 해 주세요.', { headers: { 'retry-after': String(Math.ceil(((day + 1) * DAY_MS - now) / 1000)) } });
    if (this.usage().bytes > this.cfg.maxTotalBytes) throw new HttpError('full');
    this.bump(k, (day + 1) * DAY_MS);
    return { ok: true };
  }

  async report({ ip, site, reason, contact }) {
    const now = Date.now(); const c = this.cfg;
    const w = await this.windows('report', ip, now);
    if (this.count(w.hour.k) >= c.reportsPerHour) throw this.limited(w.hour, now);
    if (this.count(w.all.k) >= c.dailyReportCap) throw new HttpError('rate_limited', '오늘은 신고를 더 받을 수 없어요. 내일 다시 보내 주세요.', { headers: { 'retry-after': String(Math.ceil((w.all.exp - now) / 1000)) } });
    let n = 0;
    this.ctx.storage.transactionSync(() => {
      this.bump(w.hour.k, w.hour.exp); this.bump(w.all.k, w.all.exp);
      n = this.sql.exec('INSERT INTO reports (at, site, reason, contact) VALUES (?, ?, ?, ?) RETURNING n', now, site, reason, contact || '').one().n;
      this.sql.exec('DELETE FROM reports WHERE n <= ?', n - c.reportKeep);
    });
    await this.ensureAlarm();
    return { ok: true, n, at: now };
  }

  async ensureAlarm() {
    if ((await this.ctx.storage.getAlarm()) == null) await this.ctx.storage.setAlarm(Date.now() + DAY_MS);
  }
  /** 하루 한 번: 지난 횟수 기록과 오래된 신고를 지우고, 기간이 끝났는데 목록에 남은 사이트를 정리 */
  async alarm() {
    const now = Date.now();
    this.sql.exec('DELETE FROM rl WHERE exp < ?', now);
    this.sql.exec('DELETE FROM sites WHERE expires < ?', now - DAY_MS);
    this.sql.exec('DELETE FROM reports WHERE at < ?', now - this.cfg.reportDays * DAY_MS);
    await this.ctx.storage.setAlarm(now + DAY_MS);
  }
}
