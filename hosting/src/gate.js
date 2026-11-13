// Gate: 호스트 전체에 하나뿐인 Durable Object.
//  - 새 사이트·신고 횟수 제한(IP별, 전체)
//  - 사이트 목록과 저장량 합계(사이트 파일 + 실시간 방. 가득 차면 새로 받지 않음)
//  - 신고 보관과 처리 상태
//  - 하루 단위 숫자(요청 수·새 사이트·오류·앱 익명 이용 합계)와 하루 예산 알림
//  - 운영자 설정(새 업로드 멈춤), 팝업 공지, 감사 기록(관리 화면에서 누가 언제 무엇을)
//  - 연수 예약: 앱이 공개할 때 보낸 연수 날짜·시간·인원으로 그날 요청을 어림해 쌓아 둠(capacity.js).
//    그날이 하루 예산에 가까우면 '만들 때' 알려 강사 계정으로 안내하고, 예약된 연수가 있는 날은 새 일을 일찍 멈춰 그 몫을 지킴
// Worker와 Site·Room만 부릅니다(바깥에서 직접 닿을 수 없음).
import { DurableObject } from 'cloudflare:workers';
import { config, DAY_MS, HOUR_MS, NEW_WORK_SHARE } from './config.js';
import { HttpError, json, readJson } from './http.js';
import { sha256Hex, ipBucket } from './ids.js';
import { WORKER_KEYS, APP_KEYS, paidAdvice } from './tally.js';
import { checkNotice, publicNotice, NOTICE_LIMITS } from './notice.js';
import { estimate, cleanBooking, BOOK_SHARE } from './capacity.js';

/** 하루 숫자를 남겨 두는 날 수 */
const DAILY_KEEP = 400;
const AUDIT_KEEP = 2000;
export const dayOf = (now) => Math.floor(now / DAY_MS); // UTC 날짜 = 한국 시간 오전 9시에 바뀜(Cloudflare 하루 한도와 같음)
/** 'YYYY-MM-DD' → '11월 20일' */
const koDate = (d) => `${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일`;
/** 한국 날짜 'YYYY-MM-DD' */
export const kstDate = (t) => new Date(t + 9 * 3600e3).toISOString().slice(0, 10);

export class Gate extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.cfg = config(env);
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS rl (k TEXT PRIMARY KEY, n INTEGER NOT NULL, exp INTEGER NOT NULL) WITHOUT ROWID;
      CREATE TABLE IF NOT EXISTS sites (id TEXT PRIMARY KEY, bytes INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL, expires INTEGER NOT NULL, blocked INTEGER NOT NULL DEFAULT 0, room_bytes INTEGER NOT NULL DEFAULT 0, code TEXT NOT NULL DEFAULT '') WITHOUT ROWID;
      CREATE TABLE IF NOT EXISTS reports (n INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, site TEXT NOT NULL, reason TEXT NOT NULL, contact TEXT NOT NULL DEFAULT '');
      CREATE TABLE IF NOT EXISTS daily (day INTEGER PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL) WITHOUT ROWID;
      CREATE TABLE IF NOT EXISTS notices (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, body TEXT NOT NULL, link TEXT NOT NULL DEFAULT '', link_label TEXT NOT NULL DEFAULT '', targets TEXT NOT NULL, starts INTEGER NOT NULL, ends INTEGER NOT NULL, active INTEGER NOT NULL DEFAULT 1, rev INTEGER NOT NULL DEFAULT 1, created INTEGER NOT NULL, updated INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS audit (n INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, who TEXT NOT NULL, action TEXT NOT NULL, target TEXT NOT NULL DEFAULT '', detail TEXT NOT NULL DEFAULT '');
      CREATE TABLE IF NOT EXISTS bookings (site TEXT PRIMARY KEY, day INTEGER NOT NULL, at INTEGER NOT NULL, minutes INTEGER NOT NULL, people INTEGER NOT NULL, live INTEGER NOT NULL DEFAULT 0, network TEXT NOT NULL DEFAULT 'good', est INTEGER NOT NULL, created INTEGER NOT NULL) WITHOUT ROWID;
      CREATE INDEX IF NOT EXISTS bookings_day ON bookings (day);
    `);
    // 이미 돌던 서버의 표에 새 칸을 더함(없을 때만)
    this.addColumn('sites', 'title', "TEXT NOT NULL DEFAULT ''");
    this.addColumn('sites', 'url', "TEXT NOT NULL DEFAULT ''"); // 공개 주소(VIEW=pages면 사이트마다 다른 호스트)
    this.addColumn('reports', 'status', "TEXT NOT NULL DEFAULT 'open'");
    this.addColumn('reports', 'handled_at', 'INTEGER NOT NULL DEFAULT 0');
    this.settingsCache = null;
  }
  addColumn(table, col, decl) {
    const has = this.sql.exec(`PRAGMA table_info(${table})`).toArray().some((r) => r.name === col);
    if (!has) this.sql.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${decl}`);
  }

  async fetch(request) {
    try {
      const url = new URL(request.url);
      const op = url.pathname.slice(1);
      const body = request.method === 'POST' ? await readJson(request, 64 * 1024) : {};
      switch (`${request.method} ${op}`) {
        case 'POST reserve': return json(await this.reserve(body));
        case 'POST site': return json(this.siteUpdate(body));
        case 'POST forget': return json(this.forget(body));
        case 'POST room': return json(this.room(body));
        case 'POST book': return json(this.book(body));
        case 'GET day': return json(this.dayStatus(url.searchParams.get('date'), url.searchParams.get('site')));
        case 'GET usage': return json({ ...this.usage(), paused: this.paused() });
        case 'POST tick': return json(this.tick(body));
        case 'GET status': return json(this.status());
        case 'POST report': return json(await this.report(body));
        case 'GET notices': return json({ notices: this.activeNotices(url.searchParams.get('for')) });
        // ── 관리(Worker가 관리자 확인을 마친 뒤에만 부름). who = 누가(감사 기록) ──
        case 'GET reports': return json({ reports: this.reports(url.searchParams.get('status')) });
        case 'GET sites': return json({ total: this.usage(), sites: this.sites(url.searchParams.get('q')) });
        case 'GET overview': return json(this.overview());
        case 'GET admin-notices': return json({ notices: this.allNotices(), limits: NOTICE_LIMITS, linkHosts: this.cfg.noticeLinkHosts });
        case 'GET audit': return json({ audit: this.sql.exec('SELECT n, at, who, action, target, detail FROM audit ORDER BY n DESC LIMIT 300').toArray() });
        case 'POST audit': return json(this.audit(body.who, body.action, body.target, body.detail));
        case 'POST notice': return json(this.saveNotice(body));
        case 'POST notice-off': return json(this.noticeOff(body));
        case 'POST uploads': return json(this.setPaused(body));
        case 'POST report-status': return json(this.reportStatus(body));
        default: throw new HttpError('not_found', '없는 주소예요.');
      }
    } catch (e) {
      if (e instanceof HttpError) return e.toResponse();
      throw e;
    }
  }

  count(k) { return this.sql.exec('SELECT n FROM rl WHERE k = ?', k).toArray()[0]?.n || 0; }
  bump(k, exp) { this.sql.exec('INSERT INTO rl (k, n, exp) VALUES (?, 1, ?) ON CONFLICT (k) DO UPDATE SET n = n + 1', k, exp); }

  // ── 하루 숫자 ────────────────────────────────────────────────
  dayData(day) {
    const row = this.sql.exec('SELECT data FROM daily WHERE day = ?', day).toArray()[0];
    try { return row ? JSON.parse(row.data) : {}; } catch { return {}; }
  }
  /** 오늘 줄에 더함(한 줄 쓰기). fn이 있으면 더한 뒤 그 줄을 더 고칠 수 있음(알림 표시) */
  addDay(patch, now = Date.now(), fn = null) {
    const day = dayOf(now);
    const d = this.dayData(day);
    for (const [k, v] of Object.entries(patch)) if (v) d[k] = (d[k] || 0) + v;
    const after = fn ? fn(d) : null;
    this.sql.exec('INSERT INTO daily (day, data) VALUES (?, ?) ON CONFLICT (day) DO UPDATE SET data = excluded.data', day, JSON.stringify(d));
    return after;
  }

  // ── 하루 요청 예산(무료 요금제): Worker가 본 요청 수를 묶어서 알려 줌 ──
  /** { n: 요청 수, c: { site, api, live, … }, s: { 'a:open': 2, … } } → 쓴 비율(%)을 돌려줌(Worker가 덜 급한 일을 미룰 때 씀) */
  tick({ n, c, s }) {
    const clamp = (v, max = 100000) => (Number.isSafeInteger(v) && v > 0 ? Math.min(v, max) : 0);
    const patch = { req: clamp(n) };
    if (c && typeof c === 'object') for (const k of WORKER_KEYS) patch[k] = clamp(c[k]);
    const now = Date.now();
    const cap = this.cfg.statsDailyCap;
    const { alert, req } = this.addDay(patch, now, (d) => {
      // 앱 익명 이용 합계: 표에 있는 열쇠만, 항목마다 하루 상한까지
      if (this.cfg.stats && s && typeof s === 'object') for (const k of Object.keys(s)) if (APP_KEYS.has(k)) d[k] = Math.min(cap, (d[k] || 0) + clamp(s[k], cap));
      return { alert: this.budgetAlert(d, now), req: d.req || 0 };
    });
    if (alert) this.send(alert);
    const b = this.cfg.dailyRequestBudget;
    return { ok: true, pct: b ? Math.round((req / b) * 1000) / 10 : 0, paused: this.paused() };
  }
  /** 예산의 ALERT_AT %를 처음 넘은 때 한 번씩 알림 글을 만듦(같은 날 같은 단계는 다시 보내지 않음) */
  budgetAlert(d, now) {
    const b = this.cfg.dailyRequestBudget;
    if (!b || !this.cfg.alertWebhook) return null;
    const pct = ((d.req || 0) / b) * 100;
    const step = this.cfg.alertAt.filter((t) => pct >= t && t > (d.al || 0)).pop();
    if (!step) return null;
    d.al = step;
    const hours = Math.max(0, Math.ceil(((dayOf(now) + 1) * DAY_MS - now) / HOUR_MS));
    const stopAt = Math.round(NEW_WORK_SHARE * 100);
    const what = step >= 95 ? `곧 하루 한도에 닿아요. 닿으면 남은 ${hours}시간 동안 올라온 사이트도 열리지 않아요(오류 1027).`
      : step >= stopAt ? `새 사이트·새 방은 받지 않고 있어요(이미 올라온 사이트는 열려요). 한국 시간 오전 9시에 다시 받아요.`
        : `${stopAt}%가 되면 새 사이트를 받지 않아요.`;
    return `[lecpage 바로 공개] 오늘 요청이 하루 예산의 ${step}%를 넘었어요(${(d.req || 0).toLocaleString('en-US')} / ${b.toLocaleString('en-US')}). ${what} 유료 전환 판단: 관리 화면 /admin`;
  }
  send(text) {
    const url = this.cfg.alertWebhook;
    if (!url) return;
    const p = fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, content: text }) }).catch((e) => console.error('alert webhook failed', e?.message));
    this.ctx.waitUntil?.(p);
  }

  // ── 운영자 설정: 새 업로드 멈춤 ───────────────────────────────
  settings() {
    if (!this.settingsCache) {
      const row = this.sql.exec("SELECT v FROM kv WHERE k = 'uploads'").toArray()[0];
      try { this.settingsCache = row ? JSON.parse(row.v) : { paused: false }; } catch { this.settingsCache = { paused: false }; }
    }
    return this.settingsCache;
  }
  paused() { return !!this.settings().paused; }
  setPaused({ paused, reason, who }) {
    if (typeof paused !== 'boolean') throw new HttpError('bad_request', 'paused에 true나 false를 넣어 주세요.');
    const v = { paused, reason: paused ? String(reason || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 200) : '', at: Date.now() };
    this.ctx.storage.transactionSync(() => {
      this.sql.exec("INSERT INTO kv (k, v) VALUES ('uploads', ?) ON CONFLICT (k) DO UPDATE SET v = excluded.v", JSON.stringify(v));
      this.audit(who, paused ? 'uploads.pause' : 'uploads.resume', '', v.reason);
    });
    this.settingsCache = v;
    return { ok: true, ...v };
  }
  pausedError() {
    return new HttpError('rate_limited', '운영자가 잠시 새 업로드를 멈췄어요. 이미 올린 사이트는 그대로 열려요. 내 계정에 올리거나 나중에 다시 해 주세요.', { status: 503, headers: { 'retry-after': '3600' } });
  }

  /** 새 사이트·새 방을 받는지. 예산의 60%를 넘으면 받지 않아, 남은 몫을 이미 올라온 사이트의 방문에 씀 */
  accepting(now = Date.now()) {
    const b = this.cfg.dailyRequestBudget;
    // 오늘 아직 끝나지 않은 예약 연수의 남은 몫만큼 일찍 멈춤
    return !this.paused() && (!b || (this.dayData(dayOf(now)).req || 0) + this.reservedLeft(now) < b * NEW_WORK_SHARE);
  }
  status() {
    const now = Date.now();
    return { accepting: this.accepting(now), paused: this.paused(), requests: this.dayData(dayOf(now)).req || 0, budget: this.cfg.dailyRequestBudget, reserved: this.reservedLeft(now) };
  }

  // ── 연수 예약 ───────────────────────────────────────────────
  /** 오늘 예약 중 아직 끝나지 않은 연수가 더 쓸 요청 어림(진행 중이면 남은 시간만큼) */
  reservedLeft(now = Date.now()) {
    let left = 0;
    for (const r of this.sql.exec('SELECT at, minutes, est FROM bookings WHERE day = ?', dayOf(now)).toArray()) {
      const end = r.at + r.minutes * 60000;
      if (end <= now) continue;
      left += r.at >= now ? r.est : r.est * ((end - now) / (end - r.at));
    }
    return Math.round(left);
  }
  dayBooked(day, except = '') {
    const r = this.sql.exec('SELECT COUNT(*) AS n, COALESCE(SUM(people), 0) AS people, COALESCE(SUM(est), 0) AS est, COALESCE(SUM(live), 0) AS live FROM bookings WHERE day = ? AND site != ?', day, except).one();
    return { trainings: r.n, people: r.people, est: r.est, live: r.live };
  }
  /**
   * 사이트의 연수 예약을 적음(다시 올리면 바뀐 날짜·인원으로 갈아 끼움). 그날 예약 어림이 예산의 BOOK_SHARE를 넘으면 받지 않음.
   * check만 하면(dry) 적지 않음. 예약이 없거나 지난 날짜면 아무것도 하지 않음
   */
  book({ site, booking, dry = false }, now = Date.now()) {
    const b = cleanBooking(booking, now);
    if (!b || typeof site !== 'string') return { ok: true, booked: false };
    const day = dayOf(b.at);
    const est = estimate({ ...b, view: this.cfg.view, longPoll: this.cfg.longPoll });
    const budget = this.cfg.dailyRequestBudget;
    const other = this.dayBooked(day, site);
    const date = kstDate(b.at);
    if (budget && est > 0 && other.est + est > budget * BOOK_SHARE) {
      throw new HttpError('rate_limited', `${koDate(date)}은 바로 공개에 예약된 연수가 많아(${other.trainings}개) 그날 참여 기능이 멈출 수 있어요. 이 연수는 내 계정에 올려 주세요.`, { reason: 'booked', day: date, headers: { 'retry-after': '3600' } });
    }
    if (!dry) this.sql.exec(`INSERT INTO bookings (site, day, at, minutes, people, live, network, est, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (site) DO UPDATE SET day = excluded.day, at = excluded.at, minutes = excluded.minutes, people = excluded.people, live = excluded.live, network = excluded.network, est = excluded.est`,
    site, day, b.at, b.minutes, b.people, b.live ? 1 : 0, b.network, est, now);
    return { ok: true, booked: !dry, day: date, est, dayEst: other.est + est, budget };
  }
  /** 상태 API: 오늘과 그날(date)의 남은 몫, 사이트 상태 */
  dayStatus(date, site) {
    const now = Date.now(); const budget = this.cfg.dailyRequestBudget; const today = dayOf(now);
    const used = this.dayData(today).req || 0;
    const reserved = this.reservedLeft(now);
    const out = {
      accepting: this.accepting(now), paused: this.paused(), budget,
      today: { date: kstDate(now), used, reserved, pct: budget ? Math.round(((used + reserved) / budget) * 100) : 0 },
    };
    const at = /^\d{4}-\d{2}-\d{2}$/.test(String(date || '')) ? Date.UTC(...date.split('-').map((x, i) => Number(x) - (i === 1 ? 1 : 0)), 1) : NaN; // 그날 한국 시간 10시
    if (Number.isFinite(at)) {
      const d = dayOf(at); const bk = this.dayBooked(d);
      const room = budget ? Math.max(0, Math.round(budget * BOOK_SHARE) - bk.est) : null;
      out.day = { date, ...bk, budget, pct: budget ? Math.round((bk.est / budget) * 100) : 0, room, ok: !budget || room > 0 };
    }
    if (typeof site === 'string' && /^[0-9a-hjkmnp-tv-z]{10}$/.test(site)) {
      const r = this.sql.exec('SELECT id, url, expires, blocked, code FROM sites WHERE id = ?', site).toArray()[0];
      const bk = this.sql.exec('SELECT at, minutes, people, live, est FROM bookings WHERE site = ?', site).toArray()[0];
      out.site = !r || r.expires < now ? { id: site, state: 'gone' } : { id: site, state: r.blocked ? 'blocked' : 'open', url: r.url || '', expiresAt: r.expires, live: r.code ? { code: r.code, state: r.blocked ? 'blocked' : 'ready' } : null, booking: bk ? { date: kstDate(bk.at), at: bk.at, minutes: bk.minutes, people: bk.people, live: !!bk.live, est: bk.est } : null };
    }
    return out;
  }
  /** 관리 화면: 앞으로 7일(오늘 포함) 예약표 */
  upcoming(now = Date.now()) {
    const today = dayOf(now); const budget = this.cfg.dailyRequestBudget; const out = [];
    for (let d = today; d < today + 7; d++) {
      const bk = this.dayBooked(d);
      out.push({ day: d, date: kstDate(d * DAY_MS + 3600e3), ...bk, pct: budget ? Math.round((bk.est / budget) * 100) : 0, full: !!budget && bk.est >= budget * BOOK_SHARE });
    }
    return out;
  }
  busy(now) {
    if (this.paused()) return this.pausedError();
    return new HttpError('rate_limited', '오늘은 방문이 많아 새로 받지 않아요. 이미 올린 사이트는 그대로 열려요. 내일 다시 하거나 내 계정에 올려 주세요.', { headers: { 'retry-after': String(Math.max(1, Math.ceil(((dayOf(now) + 1) * DAY_MS - now) / 1000))) } });
  }

  /** 횟수 제한 열쇠. IP는 그대로 두지 않고 시간 구간과 함께 해시해 둠(구간이 지나면 지움) */
  async windows(kind, ip, now) {
    const hour = Math.floor(now / HOUR_MS); const day = dayOf(now);
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
  async reserve({ ip, id, created, expires, title, url, booking }) {
    const now = Date.now(); const c = this.cfg;
    const w = await this.windows('site', ip, now);
    if (!this.accepting(now)) throw this.busy(now);
    this.book({ site: id, booking, dry: true }, now); // 그날이 찼으면 만들기 전에 알림
    if (this.count(w.hour.k) >= c.sitesPerHour) throw this.limited(w.hour, now);
    if (this.count(w.day.k) >= c.sitesPerDay) throw this.limited(w.day, now);
    if (this.count(w.all.k) >= c.dailySiteCap) throw new HttpError('rate_limited', '오늘은 바로 공개로 새 사이트를 더 만들 수 없어요. 내일 다시 하거나 다른 공개 방법을 써 주세요.', { headers: { 'retry-after': String(Math.ceil((w.all.exp - now) / 1000)) } });
    if (this.usage().bytes > c.maxTotalBytes) throw new HttpError('full');
    if (this.sql.exec('SELECT 1 FROM sites WHERE id = ?', id).toArray().length) throw new HttpError('bad_request', '이미 있는 주소예요.', { status: 409 });
    this.ctx.storage.transactionSync(() => {
      for (const x of [w.hour, w.day, w.all]) this.bump(x.k, x.exp);
      this.sql.exec('INSERT INTO sites (id, bytes, created, expires, title, url) VALUES (?, 0, ?, ?, ?, ?)', id, created, expires, String(title || '').slice(0, 120), /^https?:\/\/[^\s"<>]{1,300}$/.test(String(url || '')) ? url : '');
      if (booking) this.book({ site: id, booking }, now);
      this.addDay({ new: 1 }, now);
    });
    await this.ensureAlarm();
    return { ok: true };
  }

  /** Site·Room이 올리기·가리기·파일 변동 뒤에 알려 줌. 보낸 값만 바꿈. published면 '공개' 수를 셈 */
  siteUpdate({ id, bytes, expires, blocked, roomBytes, code, published }) {
    const row = this.sql.exec('SELECT bytes, expires, blocked, room_bytes, code FROM sites WHERE id = ?', id).toArray()[0];
    if (!row) return { ok: false, total: this.usage().bytes };
    const int = (v, d) => (Number.isSafeInteger(v) && v >= 0 ? v : d);
    this.sql.exec('UPDATE sites SET bytes = ?, expires = ?, blocked = ?, room_bytes = ?, code = ? WHERE id = ?',
      int(bytes, row.bytes), int(expires, row.expires), blocked === undefined ? row.blocked : blocked ? 1 : 0, int(roomBytes, row.room_bytes), typeof code === 'string' ? code : row.code, id);
    const total = this.usage().bytes;
    if (published) this.addDay({ pub: 1 });
    if (bytes !== undefined || roomBytes !== undefined) this.storageAlert(total);
    return { ok: true, total };
  }
  /** 저장량이 상한의 80%를 넘으면 하루 한 번 알림 */
  storageAlert(total) {
    const cap = this.cfg.maxTotalBytes;
    if (!this.cfg.alertWebhook || total < cap * 0.8) return;
    const now = Date.now();
    if (this.dayData(dayOf(now)).sa) return;
    this.addDay({ sa: 1 }, now);
    this.send(`[lecpage 바로 공개] 저장량이 상한의 ${Math.round((total / cap) * 100)}%예요(${(total / 1048576).toFixed(0)}MB / ${(cap / 1048576).toFixed(0)}MB). 다 차면 새 사이트를 받지 않아요. 관리 화면 /admin`);
  }
  forget({ id }) { this.sql.exec('DELETE FROM sites WHERE id = ?', id); this.sql.exec('DELETE FROM bookings WHERE site = ?', id); return { ok: true }; }
  /** bytes = 사이트 파일 + 실시간 방(참가 기록·보드 파일) */
  usage() {
    const r = this.sql.exec('SELECT COUNT(*) AS sites, COALESCE(SUM(bytes + room_bytes), 0) AS bytes FROM sites').one();
    return { sites: r.sites, bytes: r.bytes };
  }
  /** 새 실시간 방 자리: 하루 전체 개수와 저장량을 봄 */
  room() {
    const now = Date.now(); const day = dayOf(now);
    const k = `room:all:${day}`;
    if (!this.accepting(now)) throw this.busy(now);
    if (this.count(k) >= this.cfg.dailyRoomCap) throw new HttpError('rate_limited', '오늘은 실시간 방을 더 만들 수 없어요. 내일 다시 해 주세요.', { headers: { 'retry-after': String(Math.ceil(((day + 1) * DAY_MS - now) / 1000)) } });
    if (this.usage().bytes > this.cfg.maxTotalBytes) throw new HttpError('full');
    this.bump(k, (day + 1) * DAY_MS);
    this.addDay({ room: 1 }, now);
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
      this.addDay({ rep: 1 }, now);
    });
    await this.ensureAlarm();
    return { ok: true, n, at: now };
  }
  reports(status) {
    const rows = status === 'open' || status === 'done'
      ? this.sql.exec('SELECT n, at, site, reason, contact, status, handled_at AS handledAt FROM reports WHERE status = ? ORDER BY n DESC', status).toArray()
      : this.sql.exec('SELECT n, at, site, reason, contact, status, handled_at AS handledAt FROM reports ORDER BY n DESC').toArray();
    // 신고된 사이트의 지금 상태(가림·있음)를 같이
    const state = new Map(this.sql.exec('SELECT id, blocked, expires, url FROM sites').toArray().map((s) => [s.id, s]));
    const now = Date.now();
    return rows.map((r) => { const s = state.get(r.site); return { ...r, siteUrl: s?.url || '', siteState: !s || s.expires < now ? 'gone' : s.blocked ? 'blocked' : 'open' }; });
  }
  reportStatus({ n, status, who }) {
    if (!Number.isSafeInteger(n) || !['open', 'done'].includes(status)) throw new HttpError('bad_request', '신고 번호와 상태(open·done)를 보내 주세요.');
    const row = this.sql.exec('SELECT site FROM reports WHERE n = ?', n).toArray()[0];
    if (!row) throw new HttpError('not_found', '없는 신고예요.');
    this.ctx.storage.transactionSync(() => {
      this.sql.exec('UPDATE reports SET status = ?, handled_at = ? WHERE n = ?', status, status === 'done' ? Date.now() : 0, n);
      this.audit(who, status === 'done' ? 'report.done' : 'report.reopen', `#${n}`, row.site);
    });
    return { ok: true, n, status };
  }

  sites(q) {
    const s = String(q || '').trim().toLowerCase().slice(0, 60);
    const cols = 'id, title, url, bytes, room_bytes AS roomBytes, code AS liveCode, created AS createdAt, expires AS expiresAt, blocked';
    const rows = s
      ? this.sql.exec(`SELECT ${cols} FROM sites WHERE id LIKE ? ESCAPE '\\' OR lower(title) LIKE ? ESCAPE '\\' ORDER BY created DESC LIMIT 200`, `${s.replace(/[\\%_]/g, '\\$&')}%`, `%${s.replace(/[\\%_]/g, '\\$&')}%`).toArray()
      : this.sql.exec(`SELECT ${cols} FROM sites ORDER BY created DESC LIMIT 1000`).toArray();
    return rows.map((r) => ({ ...r, blocked: !!r.blocked }));
  }

  // ── 관리 화면 숫자 ───────────────────────────────────────────
  overview() {
    const now = Date.now(); const today = dayOf(now); const c = this.cfg;
    const rows = new Map(this.sql.exec('SELECT day, data FROM daily WHERE day > ? ORDER BY day', today - 30).toArray().map((r) => { let d = {}; try { d = JSON.parse(r.data); } catch { /* 깨진 줄 */ } return [r.day, d]; }));
    const days = [];
    for (let d = today - 29; d <= today; d++) days.push({ day: d, date: new Date(d * DAY_MS).toISOString().slice(0, 10), ...(rows.get(d) || {}) });
    const s = this.sql.exec(`SELECT COUNT(*) AS rows, COALESCE(SUM(expires > ?), 0) AS alive, COALESCE(SUM(expires > ? AND bytes > 0), 0) AS published,
      COALESCE(SUM(blocked), 0) AS blocked, COALESCE(SUM(code != '' AND expires > ?), 0) AS rooms, COALESCE(SUM(bytes), 0) AS siteBytes, COALESCE(SUM(room_bytes), 0) AS roomBytes FROM sites`, now, now, now).one();
    const open = this.sql.exec("SELECT COUNT(*) AS n FROM reports WHERE status = 'open'").one().n;
    const sum = (k) => days.reduce((a, d) => a + (d[k] || 0), 0);
    const budget = c.dailyRequestBudget;
    return {
      now, plan: c.plan, budget, newWorkShare: NEW_WORK_SHARE, accepting: this.accepting(now), uploads: this.settings(),
      today: days[days.length - 1], days,
      month: { req: sum('req'), err: sum('err'), new: sum('new'), pub: sum('pub'), room: sum('room'), live: sum('live') },
      sites: { alive: s.alive, published: s.published, blocked: s.blocked, rooms: s.rooms, bytes: s.siteBytes + s.roomBytes, siteBytes: s.siteBytes, roomBytes: s.roomBytes, maxBytes: c.maxTotalBytes },
      reports: { open },
      notices: { active: this.activeNotices(null).length },
      limits: { dailySiteCap: c.dailySiteCap, dailyRoomCap: c.dailyRoomCap, siteDays: c.days },
      view: c.view, viewProblem: c.viewProblem || '', bookShare: BOOK_SHARE, reserved: this.reservedLeft(now), upcoming: this.upcoming(now),
      stats: c.stats,
      advice: paidAdvice(days, budget, { view: c.view }),
      alerts: { webhook: !!c.alertWebhook, at: c.alertAt },
    };
  }

  // ── 팝업 공지 ────────────────────────────────────────────────
  activeNotices(target) {
    const now = Date.now();
    return this.sql.exec('SELECT * FROM notices WHERE active = 1 AND starts <= ? AND ends > ? ORDER BY starts DESC, id DESC', now, now).toArray()
      .filter((r) => !target || JSON.parse(r.targets).includes(target))
      .slice(0, NOTICE_LIMITS.active)
      .map(publicNotice);
  }
  allNotices() {
    return this.sql.exec('SELECT * FROM notices ORDER BY id DESC LIMIT 50').toArray().map((r) => ({
      id: r.id, rev: r.rev, title: r.title, body: r.body, link: r.link, linkLabel: r.link_label, targets: JSON.parse(r.targets), starts: r.starts, ends: r.ends, active: !!r.active, created: r.created, updated: r.updated,
    }));
  }
  saveNotice(b) {
    const now = Date.now();
    const chk = checkNotice(b, { now, allowHosts: this.cfg.noticeLinkHosts });
    if (chk.error) throw new HttpError('bad_request', chk.error);
    const v = chk.value;
    let id = Number.isSafeInteger(b.id) ? b.id : 0;
    this.ctx.storage.transactionSync(() => {
      if (id) {
        const row = this.sql.exec('SELECT id FROM notices WHERE id = ?', id).toArray()[0];
        if (!row) throw new HttpError('not_found', '없는 공지예요.');
        this.sql.exec('UPDATE notices SET title = ?, body = ?, link = ?, link_label = ?, targets = ?, starts = ?, ends = ?, active = ?, rev = rev + 1, updated = ? WHERE id = ?',
          v.title, v.body, v.link, v.linkLabel, JSON.stringify(v.targets), v.starts, v.ends, v.active ? 1 : 0, now, id);
        this.audit(b.who, 'notice.update', `공지 ${id}`, v.title);
      } else {
        id = this.sql.exec('INSERT INTO notices (title, body, link, link_label, targets, starts, ends, active, created, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id',
          v.title, v.body, v.link, v.linkLabel, JSON.stringify(v.targets), v.starts, v.ends, v.active ? 1 : 0, now, now).one().id;
        this.audit(b.who, 'notice.create', `공지 ${id}`, v.title);
      }
      this.sql.exec('DELETE FROM notices WHERE id NOT IN (SELECT id FROM notices ORDER BY id DESC LIMIT 50)');
    });
    return { ok: true, id };
  }
  noticeOff({ id, who }) {
    if (!Number.isSafeInteger(id)) throw new HttpError('bad_request', '공지 번호를 보내 주세요.');
    const row = this.sql.exec('SELECT title FROM notices WHERE id = ?', id).toArray()[0];
    if (!row) throw new HttpError('not_found', '없는 공지예요.');
    this.ctx.storage.transactionSync(() => {
      this.sql.exec('UPDATE notices SET active = 0, rev = rev + 1, updated = ? WHERE id = ?', Date.now(), id);
      this.audit(who, 'notice.off', `공지 ${id}`, row.title);
    });
    return { ok: true, id };
  }

  // ── 감사 기록 ────────────────────────────────────────────────
  audit(who, action, target = '', detail = '') {
    const clean = (v, n) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, n);
    if (!/^[a-z]+\.[a-z-]+$/.test(String(action))) throw new HttpError('bad_request', '감사 기록 형식이 맞지 않아요.');
    const n = this.sql.exec('INSERT INTO audit (at, who, action, target, detail) VALUES (?, ?, ?, ?, ?) RETURNING n', Date.now(), clean(who || '알 수 없음', 200), action, clean(target, 120), clean(detail, 300)).one().n;
    this.sql.exec('DELETE FROM audit WHERE n <= ?', n - AUDIT_KEEP);
    return { ok: true, n };
  }

  async ensureAlarm() {
    if ((await this.ctx.storage.getAlarm()) == null) await this.ctx.storage.setAlarm(Date.now() + DAY_MS);
  }
  /** 하루 한 번: 지난 횟수 기록과 오래된 신고·하루 숫자를 지우고, 기간이 끝났는데 목록에 남은 사이트를 정리 */
  async alarm() {
    const now = Date.now();
    this.sql.exec('DELETE FROM rl WHERE exp < ?', now);
    this.sql.exec('DELETE FROM sites WHERE expires < ?', now - DAY_MS);
    this.sql.exec('DELETE FROM reports WHERE at < ?', now - this.cfg.reportDays * DAY_MS);
    this.sql.exec('DELETE FROM daily WHERE day < ?', dayOf(now) - DAILY_KEEP);
    this.sql.exec('DELETE FROM notices WHERE ends < ?', now - 90 * DAY_MS);
    this.sql.exec('DELETE FROM bookings WHERE day < ?', dayOf(now) - 1);
    await this.ctx.storage.setAlarm(now + DAY_MS);
  }
}

