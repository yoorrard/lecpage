// Gate: 호스트 전체에 하나뿐인 Durable Object.
//  - 새 사이트·신고 횟수 제한(IP별, 전체)
//  - 사이트 목록과 저장량 합계(사이트 파일 + 실시간 방. 가득 차면 새로 받지 않음)
//  - 신고 보관과 처리 상태
//  - 하루 단위 숫자(요청 수·새 사이트·오류·앱 익명 이용 합계)와 하루 예산 알림
//  - 운영자 설정(새 배포 멈춤), 팝업 공지, 감사 기록(관리 화면에서 누가 언제 무엇을)
//  - 연수 예약: 앱이 배포할 때 보낸 연수 날짜·시간·인원으로 그날 요청을 어림해 쌓아 둠(capacity.js).
//    그날이 하루 예산에 가까우면 '만들 때' 알려 강사 계정으로 안내하고, 예약된 연수가 있는 날은 새 일을 일찍 멈춰 그 몫을 지킴
//  - 하루 점검(daily, Worker cron이 하루 한 번 부름): 정리 + 운영자가 모르고 지나가기 쉬운 것(처리 안 된 신고·가린 지 오래된 사이트·
//    지우지 못한 사이트·AI 정보 파일이 묵음)을 웹훅 하나로 짧게, 월요일에는 '이상 없음' 주간 요약(웹훅이 살아 있다는 표시). 관리 화면 맨 위에도 같은 글
// Worker와 Site·Room만 부릅니다(바깥에서 직접 닿을 수 없음).
import { DurableObject } from 'cloudflare:workers';
import { config, DAY_MS, HOUR_MS, NEW_WORK_SHARE } from './config.js';
import { HttpError, json, readJson } from './http.js';
import { sha256Hex, ipBucket } from './ids.js';
import { WORKER_KEYS, APP_KEYS, paidAdvice } from './tally.js';
import { checkNotice, publicNotice, NOTICE_LIMITS } from './notice.js';
import { estimate, cleanBooking, forecast, BOOK_SHARE, GBS_TO_REQ, FREE } from './capacity.js';
import { tier, deviceOf, nearBooking, overflow, MSG, NEXT_HOSTS, NEXT_LIVE, TIGHT_SHARE } from './fair.js';

/** 하루 숫자를 남겨 두는 날 수 */
const DAILY_KEEP = 400;
const AUDIT_KEEP = 2000;
/** 하루 점검: 가린 지 이만큼 지난 사이트를 알림(임시조치는 30일 안) */
export const BLOCK_WARN_DAYS = 25;
/** 하루 점검: 지우기를 이만큼 다시 해도 Pages 배포가 남으면 알림(사이트마다 한 번) */
export const WIPE_WARN_MS = 6 * HOUR_MS;
/** 하루 점검: AI 정보 파일(checked·updated)이 이 날 수보다 오래되면 알림. 갱신 워크플로는 이틀에 한 번 확인한 날을 적음(scripts/ai-catalog) */
export const CATALOG_STALE_DAYS = 3;
/** 기간이 지났는데 Gate 목록에 남은 사이트를 하루 점검이 다시 지우라고 할 때 한 번에 볼 수(사이트 알람이 사라졌을 때 대비) */
const SWEEP_MAX = 200;
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
    this.addColumn('bookings', 'denied', 'INTEGER NOT NULL DEFAULT 0'); // 그날 방이 차서 참여 기능만 강사 계정으로 넘긴 예약
    // 가린 때(30일 기한을 셈). 이 칸이 생기기 전에 가린 사이트는 감사 기록의 마지막 가림 때로(없으면 지금부터)
    if (this.addColumn('sites', 'blocked_at', 'INTEGER NOT NULL DEFAULT 0')) {
      this.sql.exec("UPDATE sites SET blocked_at = COALESCE((SELECT MAX(at) FROM audit WHERE action = 'site.block' AND target = sites.id), ?) WHERE blocked = 1", Date.now());
    }
    this.addColumn('sites', 'wiping', 'INTEGER NOT NULL DEFAULT 0'); // 지우는 중(Pages 배포를 다 못 지움)이 된 때. 0 = 아님
    this.addColumn('sites', 'wipe_told', 'INTEGER NOT NULL DEFAULT 0'); // 지우는 중이 오래가 웹훅으로 알렸는지(한 번만)
    this.settingsCache = null;
  }
  /** 칸이 없으면 더함. 더했으면 true */
  addColumn(table, col, decl) {
    const has = this.sql.exec(`PRAGMA table_info(${table})`).toArray().some((r) => r.name === col);
    if (!has) this.sql.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${decl}`);
    return !has;
  }
  kvGet(k) { try { return JSON.parse(this.sql.exec('SELECT v FROM kv WHERE k = ?', k).toArray()[0]?.v ?? 'null'); } catch { return null; } }
  kvSet(k, v) { this.sql.exec('INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT (k) DO UPDATE SET v = excluded.v', k, JSON.stringify(v)); }

  async fetch(request) {
    try {
      const url = new URL(request.url);
      const op = url.pathname.slice(1);
      // 이 Gate가 받은 요청(하루 숫자 g, 숫자 모으기 tick은 gt). 다음 tick에 더함
      if (op === 'tick') this.ticks = (this.ticks || 0) + 1; else this.hits = (this.hits || 0) + 1;
      const body = request.method === 'POST' ? await readJson(request, 64 * 1024) : {};
      switch (`${request.method} ${op}`) {
        case 'POST reserve': return json(await this.reserve(body));
        case 'POST site': return json(this.siteUpdate(body));
        case 'POST forget': return json(this.forget(body));
        case 'POST room': return json(this.room(body));
        case 'POST room-undo': return json(this.roomUndo(body));
        case 'POST book': return json(this.book(body));
        case 'GET day': return json(this.dayStatus(url.searchParams.get('date'), url.searchParams.get('site')));
        case 'GET usage': return json({ ...this.usage(), paused: this.paused() });
        case 'POST deploy-check': return json(this.deployCheck(body));
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
        case 'POST daily': return json(await this.daily(Date.now(), 'cron'));
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
  /**
   * 하루 줄 → 그날 쓴 몫(요청 단위). 무료 하루 한도는 Worker 요청·DO 요청·DO duration이 따로라 가장 빠듯한 것:
   * DO 요청 = Worker가 부른 Site·Room(ds·dr) + Gate가 받은 것(g·gt) + Site가 부른 Room(rc), duration = 방이 깨어 있던 초(aw, SSE·방 안 긴 대기) × 0.125GB
   */
  loadOf(d) {
    const doReq = (d.ds || 0) + (d.dr || 0) + (d.g || 0) + (d.gt || 0) + (d.rc || 0);
    const b = this.cfg.dailyRequestBudget || FREE.workerReq;
    return Math.max(d.req || 0, doReq, Math.round((((d.aw || 0) * 0.125) / FREE.doGbs) * b));
  }
  /** 오늘 DO duration 몫(무료 하루 13,000 GB-s의 %) */
  gbsPct(d) { return Math.round(((d.aw || 0) * 0.125 / FREE.doGbs) * 1000) / 10; }
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
    const patch = { req: clamp(n), g: this.hits || 0, gt: this.ticks || 0 };
    this.hits = 0; this.ticks = 0;
    if (c && typeof c === 'object') for (const k of WORKER_KEYS) patch[k] = clamp(c[k]);
    const now = Date.now();
    this.purgeLimits(now);
    const cap = this.cfg.statsDailyCap;
    const { alert, req, gbs } = this.addDay(patch, now, (d) => {
      // 앱 익명 이용 합계: 표에 있는 열쇠만, 항목마다 하루 상한까지
      if (this.cfg.stats && s && typeof s === 'object') for (const k of Object.keys(s)) if (APP_KEYS.has(k)) d[k] = Math.min(cap, (d[k] || 0) + clamp(s[k], cap));
      return { alert: this.budgetAlert(d, now), req: this.loadOf(d), gbs: this.gbsPct(d) };
    });
    if (alert) this.send(alert);
    const b = this.cfg.dailyRequestBudget;
    // pct: 쓴 몫(세 한도 중 가장 빠듯한 것), gbsPct: DO duration 몫(Worker가 긴 대기를 대신 맡을지·새 SSE를 받을지 정함)
    return { ok: true, pct: b ? Math.round((req / b) * 1000) / 10 : 0, gbsPct: b ? gbs : 0, paused: this.paused(), state: this.capacity(now).state };
  }
  /** 예산의 ALERT_AT %를 처음 넘은 때 한 번씩 알림 글을 만듦(같은 날 같은 단계는 다시 보내지 않음) */
  budgetAlert(d, now) {
    const b = this.cfg.dailyRequestBudget;
    if (!b || !this.cfg.alertWebhook) return null;
    const pct = (this.loadOf(d) / b) * 100;
    const step = this.cfg.alertAt.filter((t) => pct >= t && t > (d.al || 0)).pop();
    if (!step) return null;
    d.al = step;
    const hours = Math.max(0, Math.ceil(((dayOf(now) + 1) * DAY_MS - now) / HOUR_MS));
    const stopAt = Math.round(NEW_WORK_SHARE * 100); const tightAt = Math.round(TIGHT_SHARE * 100);
    const pages = this.cfg.view === 'pages';
    const paid = this.cfg.plan === 'paid';
    const what = paid ? (step >= Math.round(NEW_WORK_SHARE * 100)
      ? `비용 상한으로 새 사이트·새 방은 강사 계정으로 넘기고 있어요(이미 배포한 사이트·진행 중인 연수는 그대로). 더 받으려면 DAILY_REQUEST_BUDGET을 올리세요.`
      : `${Math.round(NEW_WORK_SHARE * 100)}%가 되면 새 사이트·새 방을 강사 계정으로 넘겨요(유료 비용 상한).`)
      : step >= 95 ? (pages ? `곧 하루 한도에 닿아요. 닿으면 남은 ${hours}시간 동안 참여 기능 방이 멈춰요(사이트는 Pages라 열려요).` : `곧 하루 한도에 닿아요. 닿으면 남은 ${hours}시간 동안 배포한 사이트도 열리지 않아요(오류 1027).`)
      : step >= 80 ? '참여 기능 묻기 간격을 20초로 늘려 달라고 알리는 중이에요. 새 사이트·새 방은 받지 않아요.'
        : step >= stopAt ? `새 사이트·새 방은 받지 않고 강사 계정으로 넘기고 있어요(이미 배포한 사이트는 열려요). 한국 시간 오전 9시에 다시 받아요.`
          : step >= tightAt ? `붐빔: 연수 날짜가 14일 안인 사이트·방만 받고 나머지는 강사 계정으로 넘기고 있어요. ${stopAt}%가 되면 새로 받지 않아요.`
            : `${tightAt}%가 되면 예약한 연수만 받아요.`;
    const load = this.loadOf(d); const gbsReq = Math.round((this.gbsPct(d) / 100) * b);
    const which = load <= (d.req || 0) ? '요청' : gbsReq >= load ? 'DO 시간(duration)' : 'DO 요청';
    return `[lecpage 바로 배포] 오늘 ${which}이 하루 예산의 ${step}%를 넘었어요(${load.toLocaleString('en-US')} / ${b.toLocaleString('en-US')}). ${what} ${paid ? '관리 화면' : '유료 전환 판단: 관리 화면'} ${this.adminLink()}`;
  }
  adminLink() { return this.cfg.adminUrl || '/admin'; }
  /** 남은 저장 공간이 사이트 하나의 최대 크기(전체의 1%까지)보다 작으면 새로 받지 않음: 만든 뒤 배포할 때 507로 빈 사이트가 남지 않게 */
  storageFull() {
    const c = this.cfg;
    return this.usage().bytes + Math.min(c.maxBytes, c.maxTotalBytes / 100) > c.maxTotalBytes;
  }
  /** 운영자 웹훅으로 한 줄(Slack text·Discord content). 마지막으로 보낸 결과를 적어 관리 화면에 보임(실패하면 '웹훅을 보내지 못했어요') */
  send(text) {
    const url = this.cfg.alertWebhook;
    if (!url) return;
    const note = (ok, status) => { try { this.kvSet('hook', { at: Date.now(), ok, status }); } catch { /* 다음에 */ } };
    const p = fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, content: text }) })
      .then((r) => { note(r.ok, r.status); r.body?.cancel?.().catch?.(() => { }); })
      .catch((e) => { console.error('alert webhook failed', e?.message); note(false, 0); });
    this.ctx.waitUntil?.(p);
  }
  /** 지난 횟수 기록(해시한 IP·기기 표)을 지움. 숫자를 모을 때(tick) 한 시간에 한 번, 조용한 날은 하루 점검이 → 그날이 끝나고 길어야 약 1시간 뒤 */
  purgeLimits(now = Date.now()) {
    const h = Math.floor(now / HOUR_MS);
    if (this.purgedHour === h) return;
    this.purgedHour = h;
    if (this.sql.exec('SELECT 1 FROM rl WHERE exp < ? LIMIT 1', now).toArray().length) this.sql.exec('DELETE FROM rl WHERE exp < ?', now); // 지울 것이 없으면 쓰지 않음
  }

  // ── 운영자 설정: 새 배포 멈춤 ───────────────────────────────
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
  pausedError() { return this.refuse({ reason: 'paused' }); }

  /**
   * 지금 단계(fair.js): open → tight(예약한 연수만) → full(새 일 없음). 오늘 쓴 요청 + 오늘 아직 끝나지 않은 예약 연수의 남은 몫으로 셈.
   * forRoom: 방은 Pages API를 쓰지 않으므로 Pages API 대기는 보지 않음
   */
  capacity(now = Date.now(), { forRoom = false } = {}) {
    const c = this.cfg; const day = dayOf(now);
    return tier({
      budget: c.dailyRequestBudget, used: this.loadOf(this.dayData(day)), reserved: this.reservedLeft(now), paused: this.paused(),
      storageFull: this.storageFull(), pagesUntil: forRoom ? 0 : this.pagesHold || 0,
      sitesLeft: c.dailySiteCap - this.count(`site:all:${day}`), roomsLeft: c.dailyRoomCap - this.count(`room:all:${day}`), now,
    });
  }
  /** 새 사이트를 받는지(예전 이름. /api/info의 accepting) */
  accepting(now = Date.now()) { return this.capacity(now).newSites; }
  status() {
    const now = Date.now(); const cap = this.capacity(now);
    return { accepting: cap.newSites, paused: cap.state === 'paused', requests: this.dayData(dayOf(now)).req || 0, budget: this.cfg.dailyRequestBudget, reserved: this.reservedLeft(now), capacity: this.publicCapacity(cap), rooms: this.roomsNow(now) };
  }
  /**
   * 지금 새 참여 기능 방을 열 수 있는지(room()과 같은 기준. /api/info의 live.accepting). 이미 묶인 방은 이것과 상관없이 그대로 됨.
   * accepting false면 reason: paused(운영자 멈춤)·storage(저장 공간)·budget(오늘 요청 몫)·room_cap(오늘 새 방 상한).
   * onlyBooked: 붐벼서 연수 날짜가 가까운(NEAR_DAYS 안) 사이트의 방만 받는 중. 그날 방이 차서 넘긴 예약(booked)은 사이트마다 달라 여기 없음
   */
  roomsNow(now = Date.now()) {
    const cap = this.capacity(now, { forRoom: true });
    const reason = cap.state === 'paused' ? 'paused' : cap.reason === 'storage' || cap.reason === 'budget' ? cap.reason : !cap.newRooms ? 'room_cap' : '';
    return reason ? { accepting: false, reason, resetAt: cap.resetAt } : { accepting: true, ...(cap.onlyBooked ? { onlyBooked: true } : {}) };
  }
  /** 앱에 주는 단계(넘길 곳 포함) */
  publicCapacity(cap) {
    return { ...cap, next: NEXT_HOSTS, liveNext: NEXT_LIVE, siteDays: this.cfg.days };
  }
  /** 단계가 막혀서 거절할 때의 오류: 까닭(reason), 누구 몫인지(scope), 넘길 곳(next), 다시 될 때(retryAt) */
  refuse(cap, now = Date.now(), { live = false } = {}) {
    const r = cap.reason || 'budget';
    const extra = { reason: r, ...overflow('everyone'), ...(live ? { liveNext: NEXT_LIVE } : {}) };
    if (r === 'paused') return new HttpError('rate_limited', MSG.paused, { status: 503, ...extra, headers: { 'retry-after': '3600' } });
    if (r === 'storage') return new HttpError('full', MSG.storage, extra);
    const at = cap.retryAt || cap.resetAt || (dayOf(now) + 1) * DAY_MS;
    return new HttpError('rate_limited', (live && r === 'tight' ? MSG.tight.replace('사이트', '참여 기능 방') : cap.message_ko) || MSG.budget, { ...extra, retryAt: at, headers: { 'retry-after': String(Math.max(1, Math.ceil((at - now) / 1000))) } });
  }

  // ── Pages API 5분 창(Cloudflare API 한도: 토큰마다 5분에 1,200번, 넘으면 5분 동안 모든 API가 막힘) ──
  /** 지난 5분 동안 맡긴 호출 수 */
  pagesUse(now = Date.now()) {
    const cut = now - 300e3;
    this.pwin = (this.pwin || []).filter((x) => x[0] > cut);
    return this.pwin.reduce((a, x) => a + x[1], 0);
  }
  /** n번을 더 부르려면 기다릴 밀리초(0 = 지금 됨) */
  pagesWait(n, now = Date.now()) {
    if (!n) return 0;
    if ((this.pagesHold || 0) > now) return this.pagesHold - now;
    let over = this.pagesUse(now) + n - this.cfg.pagesApiBudget;
    if (over <= 0) return 0;
    for (const [t, k] of this.pwin) { over -= k; if (over <= 0) return Math.max(1000, t + 300e3 - now); }
    return 300e3;
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
   * 사이트의 연수 예약을 적음(다시 배포하면 바뀐 날짜·인원으로 갈아 끼움). 그날 예약 어림이 예산의 BOOK_SHARE를 넘으면 받지 않음.
   * check만 하면(dry) 적지 않음. 예약이 없거나 지난 날짜면 아무것도 하지 않음
   */
  /**
   * split: 앱이 '참여 기능만 강사 계정으로 넘기기'를 알아들으면(caps에 'split') 그날 방이 찰 때 사이트는 받고 참여 기능만 넘김(live: false).
   * 모르는 예전 앱에는 예전처럼 사이트까지 거절(그래야 앱이 처음부터 내 계정으로 안내함)
   */
  book({ site, booking, dry = false, split = false }, now = Date.now()) {
    const b = cleanBooking(booking, now);
    if (!b || typeof site !== 'string') return { ok: true, booked: false };
    const day = dayOf(b.at);
    // 예약 어림은 무료면 방 안에서 기다리는 긴 대기(duration)로, 유료·POLL_RELAY=on이면 Worker가 대신(DO 요청)으로 셈
    const opt = { view: this.cfg.view, longPoll: this.cfg.longPoll, relay: this.cfg.pollRelay === true || (this.cfg.pollRelay === 'auto' && this.cfg.plan === 'paid') };
    let est = estimate({ ...b, ...opt });
    const budget = this.cfg.dailyRequestBudget;
    const other = this.dayBooked(day, site);
    const date = kstDate(b.at);
    let denied = 0;
    if (budget && est > 0 && other.est + est > budget * BOOK_SHARE) {
      const siteOnly = b.live ? estimate({ ...b, ...opt, live: false }) : est;
      if (split && b.live && other.est + siteOnly <= budget * BOOK_SHARE) { denied = 1; est = siteOnly; }
      else {
        throw new HttpError('rate_limited', `${koDate(date)}은 바로 배포에 예약된 연수가 많아(${other.trainings}개) 그날 참여 기능이 멈출 수 있어요. 이 연수는 내 계정에 배포해 주세요.`,
          { reason: 'booked', day: date, ...overflow('everyone', { liveNext: NEXT_LIVE }), headers: { 'retry-after': '3600' } });
      }
    }
    if (!dry) this.sql.exec(`INSERT INTO bookings (site, day, at, minutes, people, live, network, est, created, denied) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (site) DO UPDATE SET day = excluded.day, at = excluded.at, minutes = excluded.minutes, people = excluded.people, live = excluded.live, network = excluded.network, est = excluded.est, denied = excluded.denied`,
    site, day, b.at, b.minutes, b.people, b.live && !denied ? 1 : 0, b.network, est, now, denied);
    return { ok: true, booked: !dry, day: date, est, dayEst: other.est + est, budget, at: b.at, ...(denied ? { live: { ok: false, reason: 'booked', day: date, message_ko: MSG.booked_live, next: NEXT_LIVE } } : {}) };
  }
  /**
   * 다시 올릴 때(Site.createDeploy) 한 번에: 멈춤 확인 → Pages API 5분 창 → 예약 갈아 끼우기 → 저장량.
   * 예전에는 usage와 book을 따로 불러 DO 요청이 둘이었음
   */
  deployCheck({ site, booking, pages = 0, split = false }) {
    const now = Date.now();
    if (this.paused()) throw this.pausedError();
    const n = Number.isSafeInteger(pages) && pages > 0 ? Math.min(pages, 2000) : 0;
    const wait = this.pagesWait(n, now);
    if (wait) throw this.refuse({ reason: 'pages_api', message_ko: MSG.pages_api, retryAt: now + wait }, now);
    const bk = booking && typeof booking === 'object' ? this.book({ site, booking, split }, now) : null;
    if (n) this.pwin.push([now, n]);
    return { ...this.usage(), paused: false, ...(bk?.live ? { live: bk.live } : {}) };
  }
  /** 상태 API: 오늘과 그날(date)의 남은 몫, 사이트 상태 */
  dayStatus(date, site) {
    const now = Date.now(); const budget = this.cfg.dailyRequestBudget; const today = dayOf(now);
    const used = this.loadOf(this.dayData(today)); // 세 한도(Worker 요청·DO 요청·duration) 중 가장 빠듯한 것
    const reserved = this.reservedLeft(now);
    const cap = this.capacity(now);
    const out = {
      accepting: cap.newSites, paused: cap.state === 'paused', budget, capacity: this.publicCapacity(cap),
      // 오늘 = Cloudflare 하루(한국 오전 9시 ~ 다음 날 오전 9시, 이름은 시작한 날). 7일 표·관리 화면과 같은 이름. until = 끝나는 때(다시 참)
      today: { date: kstDate(today * DAY_MS + 3600e3), until: (today + 1) * DAY_MS, used, reserved, pct: budget ? Math.round(((used + reserved) / budget) * 100) : 0 },
    };
    const at = /^\d{4}-\d{2}-\d{2}$/.test(String(date || '')) ? Date.UTC(...date.split('-').map((x, i) => Number(x) - (i === 1 ? 1 : 0)), 1) : NaN; // 그날 한국 시간 10시
    if (Number.isFinite(at)) {
      const d = dayOf(at); const bk = this.dayBooked(d);
      const room = budget ? Math.max(0, Math.round(budget * BOOK_SHARE) - bk.est) : null;
      out.day = { date, ...bk, budget, pct: budget ? Math.round((bk.est / budget) * 100) : 0, room, ok: !budget || room > 0 };
    }
    if (typeof site === 'string' && /^[0-9a-hjkmnp-tv-z]{10}$/.test(site)) {
      const r = this.sql.exec('SELECT id, url, expires, blocked, code, wiping FROM sites WHERE id = ?', site).toArray()[0];
      const bk = this.sql.exec('SELECT at, minutes, people, live, est, denied FROM bookings WHERE site = ?', site).toArray()[0];
      out.site = !r || r.expires < now || r.wiping ? { id: site, state: 'gone' } : { id: site, state: r.blocked ? 'blocked' : 'open', url: r.url || '', expiresAt: r.expires, live: r.code ? { code: r.code, state: r.blocked ? 'blocked' : 'ready' } : null, booking: bk ? { date: kstDate(bk.at), at: bk.at, minutes: bk.minutes, people: bk.people, live: !!bk.live, est: bk.est, ...(bk.denied ? { liveDenied: true, liveNext: NEXT_LIVE } : {}) } : null };
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

  /**
   * 한 사람 몫(새 사이트의 기기·IP 횟수) 열쇠에 넣는 번호. config의 QUOTA_EPOCH를 올려 배포하면 열쇠가 바뀌어 모두 0부터 다시 셈.
   * 1(처음)은 예전 열쇠 그대로. 하루 전체 상한(site:all)과 신고 횟수에는 넣지 않음
   */
  quotaTag() { const e = this.cfg.quotaEpoch; return e > 1 ? `e${e}:` : ''; }
  /** 횟수 제한 열쇠. IP는 그대로 두지 않고 시간 구간과 함께 해시해 둠(구간이 지나면 지움) */
  async windows(kind, ip, now) {
    const hour = Math.floor(now / HOUR_MS); const day = dayOf(now);
    const who = (kind === 'site' ? this.quotaTag() : '') + (await sha256Hex(`${kind}|${ipBucket(ip)}|${day}`)).slice(0, 24);
    return {
      hour: { k: `${kind}:h:${who}:${hour}`, exp: (hour + 1) * HOUR_MS },
      day: { k: `${kind}:d:${who}:${day}`, exp: (day + 1) * DAY_MS },
      all: { k: `${kind}:all:${day}`, exp: (day + 1) * DAY_MS },
    };
  }
  /** 한 사람(기기·IP) 몫을 다 썼을 때. scope: 'you'(이 기기·이 주소만 막힘, 다른 사람은 됨) */
  limited(w, now, reason = '', message = undefined) {
    return new HttpError('rate_limited', message, { ...(reason ? { reason, ...overflow('you', { retryAt: w.exp }) } : {}), headers: { 'retry-after': String(Math.max(1, Math.ceil((w.exp - now) / 1000))) } });
  }
  /** 기기 하나의 하루 몫 열쇠(기기 표를 그대로 두지 않고 날짜와 함께 해시) */
  async deviceWindow(dev, now) {
    const day = dayOf(now);
    return { k: `site:dev:${this.quotaTag()}${(await sha256Hex(`dev|${dev}|${day}`)).slice(0, 24)}:${day}`, exp: (day + 1) * DAY_MS };
  }

  /** 새 사이트 자리 잡기: 횟수·저장량을 보고 목록에 올림 */
  /**
   * 새 사이트 자리 잡기. 순서: 단계(멈춤·저장·Pages API·예산) → 붐비면 예약한 연수만 → 공정 몫(기기·IP) → 하루 전체 상한 → 그날 예약 몫.
   * device: 앱이 보내는 기기 표(있으면 기기마다 하루 몫, 같은 IP는 넉넉히). caps: 앱이 알아듣는 것(['split'] = 참여 기능만 넘기기)
   * 돌려주는 것: live(참여 기능을 넘겨야 하면), advice(예약 없는 사이트 = 오래 쓸 사이트면 내 계정을 권함), share(이 기기·주소의 오늘 남은 몫)
   */
  async reserve({ ip, id, created, expires, title, url, booking, device, caps }) {
    const now = Date.now(); const c = this.cfg;
    const dev = deviceOf(device);
    // 열쇠(해시)를 먼저 만듦: 아래 확인과 적기 사이에 기다림이 없게
    const w = await this.windows('site', ip, now);
    const dw = dev ? await this.deviceWindow(dev, now) : null;
    const cap = this.capacity(now);
    if (['paused', 'storage', 'pages_api', 'budget'].includes(cap.reason)) throw this.refuse(cap, now);
    const b = cleanBooking(booking, now);
    if (cap.onlyBooked && !nearBooking(b, now)) throw this.refuse(cap, now);
    if (dw && this.count(dw.k) >= c.sitesPerDevice) throw this.limited(dw, now, 'device', MSG.device);
    const perHour = dev ? c.sitesPerHourShared : c.sitesPerHour; const perDay = dev ? c.sitesPerDayShared : c.sitesPerDay;
    if (this.count(w.hour.k) >= perHour) throw this.limited(w.hour, now, 'ip_hour', MSG.ip_hour);
    if (this.count(w.day.k) >= perDay) throw this.limited(w.day, now, 'ip', MSG.ip);
    if (this.count(w.all.k) >= c.dailySiteCap) throw this.refuse({ reason: 'daily_cap', message_ko: MSG.daily_cap, resetAt: w.all.exp }, now);
    const split = Array.isArray(caps) && caps.includes('split');
    const bk = this.book({ site: id, booking, dry: true, split }, now); // 그날이 찼으면 만들기 전에 알림
    if (this.sql.exec('SELECT 1 FROM sites WHERE id = ?', id).toArray().length) throw new HttpError('bad_request', '이미 있는 주소예요.', { status: 409 });
    this.ctx.storage.transactionSync(() => {
      for (const x of [w.hour, w.day, w.all, ...(dw ? [dw] : [])]) this.bump(x.k, x.exp);
      this.sql.exec('INSERT INTO sites (id, bytes, created, expires, title, url) VALUES (?, 0, ?, ?, ?, ?)', id, created, expires, String(title || '').slice(0, 120), /^https?:\/\/[^\s"<>]{1,300}$/.test(String(url || '')) ? url : '');
      this.addTot(1, 0);
      if (booking) this.book({ site: id, booking, split }, now);
      this.addDay({ new: 1 }, now, (d) => {
        if (!this.cfg.alertWebhook || d.ca || (d.new || 0) < Math.ceil(c.dailySiteCap * 0.8)) return;
        d.ca = 1;
        this.send(`[lecpage 바로 배포] 오늘 새 사이트가 하루 상한(${c.dailySiteCap})의 80%에 닿았어요(${d.new}개). 다 차면 새 사이트는 강사 계정으로 넘겨요. 요청 몫이 넉넉하면 DAILY_SITE_CAP을 올리고, 갑자기 몰린 것이면 관리 화면에서 [새 배포 멈추기]. 관리 화면 ${this.adminLink()}`);
      });
    });
    await this.ensureAlarm();
    const left = dw ? c.sitesPerDevice - this.count(dw.k) : perDay - this.count(w.day.k);
    return {
      ok: true, share: { scope: dw ? 'device' : 'ip', left: Math.max(0, left) },
      ...(bk.live ? { live: bk.live } : {}),
      ...(!b ? { advice: { code: 'long_term', message_ko: MSG.long_term, next: NEXT_HOSTS } } : {}),
    };
  }

  /**
   * Site·Room이 올리기·가리기·파일 변동 뒤에 알려 줌. 보낸 값만 바꿈. published면 '배포' 수를 셈.
   * wiping: 지우기가 Pages 배포를 다 못 지워 '지우는 중'이 된 때(Site가 알람으로 다시 하고, 끝나면 forget). 방이 깨어 있던 시간(aw)을 알리면 오늘 DO duration 몫(gbsPct)을 돌려줌
   */
  siteUpdate({ id, bytes, expires, blocked, roomBytes, code, published, pc, pz, rc, aw, pagesRoot, wiping }) {
    const calls = (v) => (Number.isSafeInteger(v) && v > 0 ? Math.min(v, 10000) : 0);
    // Pages 첫 주소 안내 화면: 공개한 Site가 물으면(ask) 한 번만 맡기고, 결과(made·had·failed)를 적어 둠
    const root = pagesRoot === 'ask' ? (published ? this.pagesRootClaim() : false) : (typeof pagesRoot === 'string' ? this.pagesRootDone(pagesRoot) : false);
    // aw: 방이 깨어 있던 초(SSE·방 안 긴 대기). 방 하나가 10분마다·끝날 때 알림
    const day = { pc: calls(pc), pz: calls(pz), rc: calls(rc), pub: published ? 1 : 0, aw: Number.isSafeInteger(aw) && aw > 0 ? Math.min(aw, 86400) : 0 };
    let gbs = null;
    if (day.pc || day.pz || day.rc || day.pub || day.aw) gbs = this.addDay(day, Date.now(), (d) => this.gbsPct(d)); // 하루 줄 한 번만 씀
    if (day.pz) this.pagesBlocked(); // Cloudflare가 API를 막음: 5분 동안 새 배포를 받지 않고(줄 서기), 운영자에게 알림
    // 방이 SSE를 계속 열어 둘지 정하는 값(room.js). 예산이 없으면(유료에서 0) 보내지 않음
    const share = day.aw && this.cfg.dailyRequestBudget ? { gbsPct: gbs } : {};
    const row = this.sql.exec('SELECT bytes, expires, blocked, room_bytes, code, blocked_at, wiping FROM sites WHERE id = ?', id).toArray()[0];
    if (!row) return { ok: false, total: this.usage().bytes, ...share, ...(root ? { pagesRoot: true } : {}) };
    const int = (v, d) => (Number.isSafeInteger(v) && v >= 0 ? v : d);
    const nb = int(bytes, row.bytes); const nr = int(roomBytes, row.room_bytes);
    const nbk = blocked === undefined ? row.blocked : blocked ? 1 : 0;
    // 가린 때: 처음 가릴 때 적고, 풀면 지움(관리 화면의 '가림 · N일째'와 하루 점검의 30일 기한)
    const bat = nbk ? (row.blocked && row.blocked_at ? row.blocked_at : Date.now()) : 0;
    const nw = Number.isSafeInteger(wiping) && wiping > 0 ? row.wiping || wiping : row.wiping;
    this.sql.exec('UPDATE sites SET bytes = ?, expires = ?, blocked = ?, room_bytes = ?, code = ?, blocked_at = ?, wiping = ? WHERE id = ?',
      nb, int(expires, row.expires), nbk, nr, typeof code === 'string' ? code : row.code, bat, nw, id);
    this.addTot(0, nb + nr - row.bytes - row.room_bytes);
    const total = this.usage().bytes;
    if (bytes !== undefined || roomBytes !== undefined) this.storageAlert(total);
    return { ok: true, total, ...share, ...(root ? { pagesRoot: true } : {}) };
  }
  /**
   * Pages 프로젝트의 첫 주소(…pages.dev 뿌리)에 본 배포가 없으면 안내 화면을 한 번 올려야 함(설정 스크립트가 프록시 등으로 못 올렸을 때).
   * 처음 공개한 Site 하나에만 맡김(true). 끝났으면(done) 다시 맡기지 않고, 하는 중이면 10분·실패했으면 6시간 기다린 뒤 다른 공개에 다시 맡김
   */
  pagesRootClaim(now = Date.now()) {
    let v = null; try { v = JSON.parse(this.sql.exec("SELECT v FROM kv WHERE k = 'pages-root'").toArray()[0]?.v || 'null'); } catch { v = null; }
    if (v?.s === 'done' || (v && now - v.at < (v.s === 'doing' ? 10 * 60e3 : 6 * HOUR_MS))) return false;
    this.sql.exec("INSERT INTO kv (k, v) VALUES ('pages-root', ?) ON CONFLICT (k) DO UPDATE SET v = excluded.v", JSON.stringify({ s: 'doing', at: now }));
    return true;
  }
  /** made(올림)·had(이미 있었음) = 끝, failed = 나중에 다시 */
  pagesRootDone(result, now = Date.now()) {
    if (!['made', 'had', 'failed'].includes(result)) return false;
    this.sql.exec("INSERT INTO kv (k, v) VALUES ('pages-root', ?) ON CONFLICT (k) DO UPDATE SET v = excluded.v", JSON.stringify({ s: result === 'failed' ? 'failed' : 'done', r: result, at: now }));
    return false;
  }
  /** 하루 한 번: 무료 요금제에서 추세가 빠듯하면(유료 전환을 권할 때) 일주일에 한 번 알림 */
  forecastAlert(now = Date.now()) {
    if (!this.cfg.alertWebhook || this.cfg.plan === 'paid') return;
    const o = this.overview();
    if (o.forecast.action !== 'upgrade') return;
    const last = Number(this.sql.exec("SELECT v FROM kv WHERE k = 'fa'").toArray()[0]?.v || 0);
    if (now - last < 7 * DAY_MS) return;
    this.sql.exec("INSERT INTO kv (k, v) VALUES ('fa', ?) ON CONFLICT (k) DO UPDATE SET v = excluded.v", String(now));
    this.send(`[lecpage 바로 배포] ${o.forecast.text} 관리 화면 ${this.adminLink()}`);
  }
  /** Pages API가 429를 줌(그 계정의 API가 5분 막힘): 5분 동안 새 배포를 줄 세우고, 하루 한 번 알림 */
  pagesBlocked(now = Date.now()) {
    this.pagesHold = now + 5 * 60e3;
    if (!this.cfg.alertWebhook || this.dayData(dayOf(now)).pa) return;
    this.addDay({ pa: 1 }, now);
    this.send(`[lecpage 바로 배포] Cloudflare Pages API가 요청이 많다며 잠시 막았어요(5분). 그동안 새 배포는 줄을 서고 이미 배포한 사이트는 그대로 열려요. 자주 오면 PAGES_API_BUDGET을 낮추세요. 관리 화면 ${this.adminLink()}`);
  }
  /** 저장량이 상한의 80%를 넘으면 하루 한 번 알림 */
  storageAlert(total) {
    const cap = this.cfg.maxTotalBytes;
    if (!this.cfg.alertWebhook || total < cap * 0.8) return;
    const now = Date.now();
    if (this.dayData(dayOf(now)).sa) return;
    this.addDay({ sa: 1 }, now);
    this.send(`[lecpage 바로 배포] 저장량이 상한의 ${Math.round((total / cap) * 100)}%예요(${(total / 1048576).toFixed(0)}MB / ${(cap / 1048576).toFixed(0)}MB). 다 차면 새 사이트를 받지 않아요. 관리 화면 ${this.adminLink()}`);
  }
  forget({ id, pc, pz, rc }) {
    if (pc || pz || rc) this.siteUpdate({ id: '', pc, pz, rc });
    const row = this.sql.exec('SELECT bytes, room_bytes FROM sites WHERE id = ?', id).toArray()[0];
    if (row) { this.sql.exec('DELETE FROM sites WHERE id = ?', id); this.addTot(-1, -row.bytes - row.room_bytes); }
    this.sql.exec('DELETE FROM bookings WHERE site = ?', id);
    return { ok: true };
  }
  /**
   * bytes = 사이트 파일 + 실시간 방(참가 기록·보드 파일). 합계는 메모리에 두고 바뀔 때마다 더하고 뺌:
   * 부를 때마다 표 전체를 훑으면 사이트 수만큼 행을 읽어(무료 하루 500만 행) 사이트가 많아질수록 느려지고 비쌈. 깨어난 뒤 처음 한 번만 훑음
   */
  usage() {
    if (!this.tot) {
      const r = this.sql.exec('SELECT COUNT(*) AS sites, COALESCE(SUM(bytes + room_bytes), 0) AS bytes FROM sites').one();
      this.tot = { sites: r.sites, bytes: r.bytes };
    }
    return { ...this.tot };
  }
  /** 합계 고치기(표를 바꾼 뒤). 아직 합계를 안 만들었으면 다음 usage()가 훑음 */
  addTot(sites, bytes) { if (this.tot) { this.tot.sites += sites; this.tot.bytes += bytes; } }
  /**
   * 새 실시간 방 자리(사이트의 첫 방일 때 Site가 부름): 단계 → 붐비면 예약한 연수만 → 그날 방이 차서 넘긴 예약이면 거절 → 하루 방 상한.
   * 거절할 때 liveNext(강사 계정의 Cloudflare·Supabase)를 같이 줌: 사이트는 바로 배포 그대로, 참여 기능만 넘기면 됨. 받으면 사이트 줄에 코드를 적음
   */
  room({ id = '', code } = {}) {
    const now = Date.now(); const day = dayOf(now);
    const k = `room:all:${day}`;
    const cap = this.capacity(now, { forRoom: true });
    if (cap.state === 'paused' || cap.reason === 'storage' || cap.reason === 'budget') throw this.refuse(cap, now, { live: true });
    const bk = id ? this.sql.exec('SELECT at, denied FROM bookings WHERE site = ?', id).toArray()[0] : null;
    if (bk?.denied) throw new HttpError('rate_limited', MSG.booked_live, { reason: 'booked', ...overflow('everyone', { liveNext: NEXT_LIVE }), headers: { 'retry-after': '3600' } });
    if (cap.onlyBooked && !nearBooking(bk, now)) throw this.refuse(cap, now, { live: true });
    if (this.count(k) >= this.cfg.dailyRoomCap) throw this.refuse({ reason: 'room_cap', message_ko: MSG.room_cap, resetAt: (day + 1) * DAY_MS }, now, { live: true });
    this.ctx.storage.transactionSync(() => {
      this.bump(k, (day + 1) * DAY_MS);
      this.addDay({ room: 1 }, now);
      if (id && typeof code === 'string' && code) this.sql.exec('UPDATE sites SET code = ? WHERE id = ?', code.slice(0, 40), id);
    });
    return { ok: true, day };
  }
  /** 방 묶기가 실패했을 때(이미 쓰는 코드 등) room()이 센 하루 개수를 돌려놓음: 실패를 되풀이해 모두의 하루 방 몫을 다 쓰지 못하게 */
  roomUndo({ day } = {}) {
    if (!Number.isSafeInteger(day)) return { ok: false };
    const k = `room:all:${day}`;
    if (this.count(k) <= 0) return { ok: true };
    this.ctx.storage.transactionSync(() => {
      this.sql.exec('UPDATE rl SET n = n - 1 WHERE k = ? AND n > 0', k);
      if ((this.dayData(day).room || 0) > 0) this.addDay({ room: -1 }, day * DAY_MS);
    });
    return { ok: true };
  }

  async report({ ip, site, reason, contact }) {
    const now = Date.now(); const c = this.cfg;
    const w = await this.windows('report', ip, now);
    if (this.count(w.hour.k) >= c.reportsPerHour) throw this.limited(w.hour, now);
    if (this.count(w.all.k) >= c.dailyReportCap) throw new HttpError('rate_limited', '오늘은 신고를 더 받을 수 없어요. 내일 다시 보내 주세요. 급하면 이 화면에 적힌 메일로 보내 주세요.', { headers: { 'retry-after': String(Math.ceil((w.all.exp - now) / 1000)) } });
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
    const state = new Map(this.sql.exec('SELECT id, blocked, expires, url, wiping FROM sites').toArray().map((s) => [s.id, s]));
    const now = Date.now();
    return rows.map((r) => { const s = state.get(r.site); return { ...r, siteUrl: s?.url || '', siteState: s?.wiping ? 'wiping' : !s || s.expires < now ? 'gone' : s.blocked ? 'blocked' : 'open' }; });
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
    const cols = 'id, title, url, bytes, room_bytes AS roomBytes, code AS liveCode, created AS createdAt, expires AS expiresAt, blocked, blocked_at AS blockedAt, wiping';
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
    const s = this.sql.exec(`SELECT COUNT(*) AS rows, COALESCE(SUM(expires > ? AND wiping = 0), 0) AS alive, COALESCE(SUM(expires > ? AND bytes > 0 AND wiping = 0), 0) AS published,
      COALESCE(SUM(blocked AND wiping = 0), 0) AS blocked, COALESCE(SUM(code != '' AND expires > ? AND wiping = 0), 0) AS rooms, COALESCE(SUM(wiping > 0), 0) AS wiping,
      COALESCE(SUM(bytes), 0) AS siteBytes, COALESCE(SUM(room_bytes), 0) AS roomBytes FROM sites`, now, now, now).one();
    const open = this.sql.exec("SELECT COUNT(*) AS n FROM reports WHERE status = 'open'").one().n;
    const sum = (k) => days.reduce((a, d) => a + (d[k] || 0), 0);
    const budget = c.dailyRequestBudget;
    return {
      now, plan: c.plan, budget, newWorkShare: NEW_WORK_SHARE, accepting: this.accepting(now), uploads: this.settings(),
      today: days[days.length - 1], days,
      month: { req: sum('req'), err: sum('err'), new: sum('new'), pub: sum('pub'), room: sum('room'), live: sum('live') },
      sites: { alive: s.alive, published: s.published, blocked: s.blocked, rooms: s.rooms, wiping: s.wiping, bytes: s.siteBytes + s.roomBytes, siteBytes: s.siteBytes, roomBytes: s.roomBytes, maxBytes: c.maxTotalBytes },
      reports: { open },
      notices: { active: this.activeNotices(null).length },
      limits: { dailySiteCap: c.dailySiteCap, dailyRoomCap: c.dailyRoomCap, siteDays: c.days },
      view: c.view, viewProblem: c.viewProblem || '', bookShare: BOOK_SHARE, reserved: this.reservedLeft(now), upcoming: this.upcoming(now),
      stats: c.stats,
      advice: paidAdvice(days, c.plan === 'paid' ? 0 : budget, { view: c.view }),
      // 이번 달 추세로 언제 무료가 차는지·유료면 월 비용·권하는 행동 한 줄(capacity.js forecast)
      forecast: forecast(days, { plan: c.plan, budget, storageMB: (s.siteBytes + s.roomBytes) / 1048576, newWorkShare: NEW_WORK_SHARE, dailySiteCap: c.dailySiteCap }),
      capacity: this.publicCapacity(this.capacity(now)),
      pagesApi: { used5m: this.pagesUse(now), budget: c.pagesApiBudget, holdUntil: this.pagesHold > now ? this.pagesHold : 0 },
      alerts: { webhook: !!c.alertWebhook, at: c.alertAt },
      // 하루 점검과 같은 '확인할 일'(웹훅이 없어도 여기서 보임), 마지막 점검·웹훅 결과
      ops: { lines: this.opsLines(now), last: this.kvGet('ops'), hook: this.kvGet('hook'), catalog: this.kvGet('catalog') },
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
  /**
   * Gate 알람(하루 한 번): 하루 점검의 예비. 보통은 Worker cron(wrangler.jsonc triggers)이 POST daily로 부르고, cron이 26시간 넘게 오지 않았을 때만 여기서 점검까지.
   * 실패해도 다음 알람은 꼭 다시 잡음(알람 처리가 실패하면 공식 재시도는 2초부터 6번뿐)
   */
  async alarm() {
    const now = Date.now();
    try {
      if (now - Number(this.kvGet('cron') || 0) > 26 * HOUR_MS) await this.daily(now, 'alarm');
      else this.housekeep(now);
    } catch (e) { console.error('gate alarm failed', e?.message); }
    await this.ctx.storage.setAlarm(now + DAY_MS);
  }
  /** 지난 횟수 기록과 오래된 신고·하루 숫자·공지·예약을 지움(여러 번 불러도 같음) */
  housekeep(now = Date.now()) {
    this.sql.exec('DELETE FROM rl WHERE exp < ?', now);
    this.tot = null; // 하루 한 번 표에서 다시 셈(어긋남이 쌓이지 않게)
    this.sql.exec('DELETE FROM reports WHERE at < ?', now - this.cfg.reportDays * DAY_MS);
    this.sql.exec('DELETE FROM daily WHERE day < ?', dayOf(now) - DAILY_KEEP);
    this.sql.exec('DELETE FROM notices WHERE ends < ?', now - 90 * DAY_MS);
    this.sql.exec('DELETE FROM bookings WHERE day < ?', dayOf(now) - 1);
  }

  // ── 하루 점검(운영자가 모르고 지나가는 것을 하나로) ────────────────────
  /**
   * 하루 한 번(Worker cron, 한국 시간 오전 9시 7분쯤. 없으면 Gate 알람): 정리 → 기간이 지났는데 남은 사이트를 다시 지우라고 함 → AI 정보 파일 확인 →
   * '확인할 일'이 있으면 웹훅 하나로 짧게, 월요일에는 주간 요약(이상 없어도 보냄: 이 알림이 오면 웹훅과 점검이 살아 있음).
   * 같은 날 두 번 불려도 웹훅은 한 번. 웹훅이 없어도 관리 화면 맨 위(overview.ops)에 같은 글이 보임
   */
  async daily(now = Date.now(), via = 'cron') {
    if (via === 'cron') this.kvSet('cron', now);
    this.housekeep(now);
    await this.ensureAlarm();
    const day = dayOf(now);
    if (this.kvGet('ops')?.day === day) return { ok: true, again: true };
    const swept = await this.sweepExpired(now);
    await this.catalogCheck(now);
    const lines = this.opsLines(now, { hook: true });
    const monday = new Date(now + 9 * HOUR_MS).getUTCDay() === 1;
    const parts = [];
    if (monday) parts.push(this.weeklyLine(now));
    if (lines.length) parts.push(`${monday ? '' : '[lecpage 바로 배포] '}확인할 일 ${lines.length}가지\n${lines.map((x) => `- ${x.text}`).join('\n')}`);
    const sent = !!(parts.length && this.cfg.alertWebhook);
    if (sent) {
      this.send(`${parts.join('\n')}\n관리 화면 ${this.adminLink()}`);
      if (lines.some((x) => x.k === 'wiping')) this.sql.exec('UPDATE sites SET wipe_told = 1 WHERE wiping > 0 AND wiping < ?', now - WIPE_WARN_MS);
    }
    this.kvSet('ops', { day, at: now, via, lines: lines.length, weekly: monday, sent, swept });
    try { this.forecastAlert(now); } catch (e) { console.error('forecast alert failed', e?.message); }
    return { ok: true, lines: lines.map((x) => x.text), weekly: monday, sent, swept };
  }
  /**
   * 운영자가 볼 일(관리 화면 맨 위와 하루 점검 웹훅에 같은 글). hook이면 웹훅용: 지우는 중 사이트는 사이트마다 한 번만
   * @returns {{ k: string, text: string }[]}
   */
  opsLines(now = Date.now(), { hook = false } = {}) {
    const out = [];
    const nth = (ms) => Math.floor(ms / DAY_MS) + 1; // 'N일째'
    const r = this.sql.exec("SELECT COUNT(*) AS n, MIN(at) AS first FROM reports WHERE status = 'open' AND at < ?", now - DAY_MS).one();
    if (r.n) out.push({ k: 'reports', text: `처리 안 된 신고 ${r.n}건(가장 오래된 것 ${nth(now - r.first)}일째). 가리거나 지우고 [처리함]을 눌러 주세요.` });
    const b = this.sql.exec('SELECT COUNT(*) AS n, MIN(blocked_at) AS first FROM sites WHERE blocked = 1 AND wiping = 0 AND blocked_at > 0 AND blocked_at < ?', now - BLOCK_WARN_DAYS * DAY_MS).one();
    if (b.n) out.push({ k: 'blocked', text: `가린 지 ${BLOCK_WARN_DAYS}일 넘은 사이트 ${b.n}개(가장 오래된 것 ${nth(now - b.first)}일째). 가린 날부터 30일 안에 풀거나 지워 주세요.` });
    const w = this.sql.exec(`SELECT COUNT(*) AS n, MIN(wiping) AS first FROM sites WHERE wiping > 0 AND wiping < ?${hook ? ' AND wipe_told = 0' : ''}`, now - WIPE_WARN_MS).one();
    if (w.n) out.push({ k: 'wiping', text: `지우지 못한 사이트 ${w.n}개(Cloudflare Pages에 배포가 남음, 가장 오래된 것 ${Math.floor((now - w.first) / HOUR_MS)}시간째 다시 하는 중). 관리 화면 사이트 목록의 '지우는 중'을 봐 주세요.` });
    const cat = this.kvGet('catalog');
    if (cat?.stale) out.push({ k: 'catalog', text: cat.text });
    const hk = this.kvGet('hook');
    if (!hook && hk && !hk.ok) out.push({ k: 'webhook', text: `알림 웹훅을 보내지 못했어요(${kstDate(hk.at).slice(5)} · 응답 ${hk.status || '없음'}). ALERT_WEBHOOK·REPORT_WEBHOOK 주소를 확인해 주세요.` });
    return out;
  }
  /** 월요일 주간 요약 한 줄(지난 7일) */
  weeklyLine(now = Date.now()) {
    const today = dayOf(now); const b = this.cfg.dailyRequestBudget; const c = this.cfg;
    let peak = 0; let made = 0;
    for (const { data } of this.sql.exec('SELECT data FROM daily WHERE day >= ? AND day < ?', today - 7, today).toArray()) {
      let d = {}; try { d = JSON.parse(data); } catch { /* 깨진 줄 */ }
      peak = Math.max(peak, this.loadOf(d)); made += d.new || 0;
    }
    const open = this.sql.exec("SELECT COUNT(*) AS n FROM reports WHERE status = 'open'").one().n;
    const s = this.sql.exec('SELECT COALESCE(SUM(blocked AND wiping = 0), 0) AS blocked, COALESCE(SUM(wiping > 0), 0) AS wiping FROM sites').one();
    const busy = b ? `하루 예산의 ${Math.round((peak / b) * 100)}%` : `${peak.toLocaleString('en-US')}건`;
    return `[lecpage 바로 배포] 주간 점검: 지난 7일 가장 바쁜 날 ${busy} · 새 사이트 ${made}개 · 저장 ${Math.round((this.usage().bytes / c.maxTotalBytes) * 100)}% · 신고 대기 ${open} · 가린 사이트 ${s.blocked} · 지우는 중 ${s.wiping}. 월요일마다 이 알림이 오면 웹훅과 하루 점검이 살아 있어요.`;
  }
  /**
   * AI 정보 파일(CATALOG_URL, 앱 주소의 ai-catalog.json)의 확인한 날(checked, 없으면 updated)이 CATALOG_STALE_DAYS보다 오래됐는지.
   * 갱신 워크플로가 멈췄거나(예약이 꺼짐·실패) 출처를 오래 못 받는 것을 앱 쪽에서 봄. 이틀 연달아 받지 못해야 알림(한 번 끊김은 넘김)
   */
  async catalogCheck(now = Date.now()) {
    const url = this.cfg.catalogUrl;
    if (!url) return null;
    let date = ''; let err = '';
    try {
      const r = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
      if (!r.ok) { err = `응답 ${r.status}`; r.body?.cancel?.().catch?.(() => { }); } else {
        const j = await r.json();
        date = [j?.checked, j?.updated].find((v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) || '';
        if (!date) err = '날짜 칸이 없음';
      }
    } catch (e) { err = e?.name === 'TimeoutError' ? '10초 안에 답이 없음' : e instanceof SyntaxError ? 'JSON이 아님' : '닿지 못함'; }
    const prev = this.kvGet('catalog') || {};
    const fails = err ? (prev.fails || 0) + 1 : 0;
    const age = date ? Math.floor((now - Date.parse(`${date}T00:00:00Z`)) / DAY_MS) : null;
    const stale = err ? fails >= 2 : age > CATALOG_STALE_DAYS;
    const text = err
      ? `AI 정보 파일을 ${fails}일째 받지 못했어요(${err}): ${url}`
      : `AI 정보 파일이 ${age}일째 그대로예요(마지막 확인 ${date}). GitHub Actions → AI catalog 실행 기록을 봐 주세요(저장소에 60일 동안 활동이 없으면 예약이 꺼져요).`;
    const out = { at: now, url, date, age, err, fails, stale, text };
    this.kvSet('catalog', out);
    return out;
  }
  /** 기간이 하루 넘게 지났는데 목록에 남은 사이트: 그 사이트에 다시 지우라고 함(사이트 알람이 사라졌거나 Gate에 알리지 못했을 때). 없어졌으면 목록에서 뺌 */
  async sweepExpired(now = Date.now()) {
    if (!this.env?.SITE) return 0;
    const rows = this.sql.exec('SELECT id FROM sites WHERE expires < ? AND wiping = 0 ORDER BY expires LIMIT ?', now - DAY_MS, SWEEP_MAX).toArray();
    let n = 0;
    for (const { id } of rows) {
      try {
        const res = await this.env.SITE.get(this.env.SITE.idFromName(id)).fetch('http://site/expire', { method: 'POST' });
        const j = res.ok ? await res.json() : null;
        if (j?.gone) { this.forget({ id }); n++; }
      } catch (e) { console.error('site expire failed', id, e?.message); }
    }
    return n;
  }
}

