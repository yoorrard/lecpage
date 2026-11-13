// 연수 하루에 이 서버가 받는 요청 어림. 예약(Gate)·상태 API·README 수용량 표가 같이 씁니다.
// 근거: 공식 한도(Workers Free 요청 10만/일, 정적 자산·Pages 정적 요청은 세지 않음) × 측정값(docs/research/admin-2026-11.md §2,
// README의 '40명 연수 2천~1만 2천', '웹소켓이 막힌 학교망 50명 2시간 4~7만').

export const EST = {
  /** 참가자 한 명이 연수 동안 Worker에 보내는 사이트 요청(첫 방문 6 + 교재 그림·자료 + 다시 열기). Worker 보기만. Pages 보기는 0 */
  viewWorker: 25,
  /** 참여 기능: 연결·참여·글쓰기·투표(실시간 연결이 될 때) */
  liveBase: 15,
  /** 실시간 연결이 막혀 묻기로 바뀐 참가자의 1분당 요청(5초, 빈 응답이 이어지면 10초. 측정 50명 2시간 4~7만 → 3.3~5.8) */
  pollPerMin: 5,
  /** 긴 대기(?wait=20, 바뀐 것이 있으면 바로 답)를 쓰는 런타임일 때. 조용하면 2.4(대기 20초 + 쉬는 5초), 측정(2026-11-13, 웹소켓·SSE 막힘,
   *  40초마다 글 하나, docs/research/school-network-2026-11.md §9) 1분 3.25 + 처음 연결·실시간 다시 시도 → 3.4. 글이 쉼 없이 오면 쉬는 틈마다 12 */
  pollPerMinLong: 3.4,
  /** 실시간 연결이 막혀 묻기로 바뀌는 참가자 몫(앱의 '네트워크' 답). 학교망 restricted는 모두 묻기로 봄 */
  pollShare: { good: 0.2, slow: 0.5, restricted: 1 },
  /** 강사 화면·발표 화면 몫(참가자 몇 명 분) */
  teacherSeats: 2,
};
/** 예약된 연수의 어림이 하루 예산의 이 몫을 넘으면 그날 새 예약을 받지 않음(남은 몫은 예약 없이 오는 일과 어림 오차) */
export const BOOK_SHARE = 0.7;
export const DEFAULT_MINUTES = 120;
export const MAX_PEOPLE = 500;

/** 무료 하루 몫을 요청 단위로 맞춤: DO duration 1 GB-s = 하루 요청 예산 / 13,000(예산 10만이면 약 7.7요청) */
export const GBS_TO_REQ = 100000 / 13000;
/**
 * 그날 몫 어림(요청 단위). Worker 요청·DO 요청·DO duration(요청 단위로 바꿈) 가운데 가장 큰 것: 무료 하루 한도는 셋이 따로라 먼저 차는 쪽이 그날을 정함.
 * relay: 긴 대기를 Worker가 대신 기다림(묻기 한 번에 DO 요청 2로 셈, 방은 잠듦). 아니면 방 안에서 기다려 연수 내내 깨어 있음(2시간 900 GB-s)
 * @param {{ people?: number, minutes?: number, live?: boolean, network?: string, view?: 'worker'|'pages', longPoll?: boolean, relay?: boolean }} b
 * @returns {number} 그날 몫 어림(정수, 요청 단위)
 */
export function estimate({ people = 30, minutes = DEFAULT_MINUTES, live = false, network = 'good', view = 'worker', longPoll = false, relay = false } = {}) {
  const n = Math.min(MAX_PEOPLE, Math.max(1, Math.round(Number(people) || 30))) + EST.teacherSeats;
  const min = Math.min(12 * 60, Math.max(10, Math.round(Number(minutes) || DEFAULT_MINUTES)));
  const site = view === 'pages' ? 0 : n * EST.viewWorker;
  if (!live) return Math.round(site);
  const pollers = n * (EST.pollShare[network] ?? EST.pollShare.good);
  const cycles = pollers * min * (longPoll ? EST.pollPerMinLong : EST.pollPerMin);
  const worker = site + n * EST.liveBase + cycles;
  const doReq = n * EST.liveBase + cycles * (longPoll && relay ? 2 : 1);
  const gbs = longPoll && !relay && pollers >= 1 ? (UNIT_ROOM_HOUR_GBS * min) / 60 : 0;
  return Math.round(Math.max(worker, doReq, gbs * GBS_TO_REQ));
}
const UNIT_ROOM_HOUR_GBS = 450;

/** 'YYYY-MM-DD' + 'HH:MM'(한국 시간) → 그 시각(밀리초). 시각이 없으면 오전 10시로 봄 */
export function kstTime(date, time = '') {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || ''));
  if (!m) return NaN;
  const t = /^(\d{1,2}):(\d{2})$/.exec(String(time || '')) || [0, '10', '00'];
  const [h, mi] = [Math.min(23, Number(t[1])), Math.min(59, Number(t[2]))];
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), h - 9, mi);
}
/** 앱이 보낸 예약 → 정리한 값(쓸 수 없으면 null) */
export function cleanBooking(b, now = Date.now()) {
  if (!b || typeof b !== 'object') return null;
  const at = kstTime(b.date, b.start);
  if (!Number.isFinite(at) || at < now - 12 * 3600e3 || at > now + 366 * 864e5) return null;
  let minutes = DEFAULT_MINUTES;
  const e = kstTime(b.date, b.end);
  if (b.end && Number.isFinite(e) && e > at) minutes = Math.round((e - at) / 60000);
  if (Number.isFinite(Number(b.minutes)) && Number(b.minutes) > 0) minutes = Number(b.minutes);
  return {
    at, minutes: Math.min(12 * 60, Math.max(10, Math.round(minutes))),
    people: Math.min(MAX_PEOPLE, Math.max(1, Math.round(Number(b.people) || 30))),
    live: !!b.live, network: ['good', 'slow', 'restricted'].includes(b.network) ? b.network : 'good',
  };
}

// ── 수용량 모형: 무료·유료 한도와 요금, 측정한 단위 비용 → 사용자 수별 쓰는 몫·먼저 차는 것·월 비용 ──────────────
// 표는 scripts/capacity-model.mjs가 만들고(docs/research/scale-2026-11.md), 관리 화면의 '언제 무료가 차나·유료면 얼마'(forecast)도 같은 값을 씀.

/** Cloudflare 무료 요금제 한도(하루, 00:00 UTC = 한국 시간 오전 9시에 다시 참. 저장은 전체). developers.cloudflare.com 2026-11-13 확인 */
export const FREE = {
  workerReq: 100000, // workers/platform/limits: 넘으면 오류 1027(정적 자산·Pages 정적 요청은 세지 않음)
  doReq: 100000, // durable-objects/platform/pricing: 넘으면 그 종류 작업이 실패
  doGbs: 13000, // 같은 곳: 깨어 있고 잠들 수 없는 동안만(잠들 수 있는 WebSocket은 세지 않음)
  rowsWritten: 100000,
  rowsRead: 5000000,
  storageGB: 5,
  pagesApi5m: 1200, // fundamentals/api/reference/limits: 토큰마다 5분에 1,200번, 넘으면 5분 동안 모든 API 429
};
/** Workers Paid(월 $5 + 쓴 만큼, 한 달 포함분 / 넘는 100만당). 같은 곳 확인 */
export const PAID = {
  base: 5,
  workerReq: { incl: 10e6, perM: 0.30 },
  cpuMs: { incl: 30e6, perM: 0.02 },
  doReq: { incl: 1e6, perM: 0.15 },
  doGbs: { incl: 400000, perM: 12.5 },
  rowsWritten: { incl: 50e6, perM: 1.0 },
  rowsRead: { incl: 25e9, perM: 0.001 },
  storageGB: { incl: 5, perGB: 0.20 },
};
/**
 * 측정한 단위 비용(test/scale.test.mjs: VIEW=pages, 로컬 workerd + 흉내 Cloudflare API, 예시 사이트 21파일 + 참여 기능 방).
 * rows·ms·cpu는 코드에서 어림(색인 포함 글 하나에 4~6행 등)
 */
export const UNIT = {
  newSite: { workerReq: 17, doReq: 22, pagesApi: 5, rows: 60 }, // 만들기·목록·파일 13개·방 묶기·공개(행: Site 약 33 + Gate 약 12 + 방 표 만들기 약 15)
  republish: { workerReq: 3, doReq: 6, pagesApi: 5, rows: 12 }, // 글 한 줄 고쳐 다시 배포
  appChecks: { workerReq: 3, doReq: 1 }, // /api/info 1번(isolate 20초 기억) + /api/status 2번(공개 전·연수 전날)
  seatRows: 25, // 참가자 한 명이 연수 동안 쓰는 행(들어오기·출석·글 2~3개·투표)
  siteMB: 0.2, roomMB: 0.1, // 사이트 하나(Pages 보기: HTML 원본·표), 방 하나
  msPerDoReq: 5, // DO 요청 하나가 깨어 있는 시간
  cpuMsPerReq: 1, // Worker CPU(길만 정하고 무거운 일은 DO)
  roomHourGbs: 450, // 방이 한 시간 내내 깨어 있을 때(방 안 긴 대기·SSE): 128MB × 3600초
};

/**
 * 연수 한 번이 드는 몫(Pages 보기). 실시간 연결이 막힌 자리는 묻기(5초, 긴 대기면 1분 2.4번)로 셈.
 * @param {{ people?: number, minutes?: number, live?: boolean, network?: 'good'|'slow'|'restricted', longPoll?: boolean, relay?: boolean, republishes?: number }} o
 *   relay: 긴 대기를 Worker가 대신 기다림(방이 잠듦, 대신 한 번에 DO 요청 2개로 셈)
 */
export function trainingCost({ people = 40, minutes = DEFAULT_MINUTES, live = false, network = 'good', longPoll = false, relay = false, republishes = 1 } = {}) {
  const n = people + EST.teacherSeats;
  const out = {
    workerReq: UNIT.newSite.workerReq + republishes * UNIT.republish.workerReq + UNIT.appChecks.workerReq,
    doReq: UNIT.newSite.doReq + republishes * UNIT.republish.doReq + UNIT.appChecks.doReq,
    doGbs: 0, rows: UNIT.newSite.rows + republishes * UNIT.republish.rows,
    pagesApi: UNIT.newSite.pagesApi + republishes * UNIT.republish.pagesApi, storageMB: UNIT.siteMB,
  };
  if (live) {
    const pollers = n * (EST.pollShare[network] ?? EST.pollShare.good);
    const cycles = pollers * minutes * (longPoll ? EST.pollPerMinLong : EST.pollPerMin);
    const base = n * EST.liveBase;
    out.workerReq += base + cycles;
    out.doReq += base + cycles * (longPoll && relay ? 2 : 1);
    out.rows += n * UNIT.seatRows;
    out.storageMB += UNIT.roomMB;
    // 방이 깨어 있는 시간: 요청을 처리하는 동안 + (방 안 긴 대기면) 연수 내내
    out.doGbs += ((base + cycles) * UNIT.msPerDoReq) / 1000 * 0.125 + (longPoll && !relay && pollers >= 1 ? (UNIT.roomHourGbs * minutes) / 60 : 0);
  }
  for (const k of Object.keys(out)) out[k] = Math.round(out[k] * 100) / 100;
  return out;
}

/** 한 달 쓴 몫 → Workers Paid 월 비용(달러, 항목별) */
export function costOf(m) {
  const over = (v, p) => (Math.max(0, (v || 0) - p.incl) / 1e6) * p.perM;
  const items = {
    base: PAID.base,
    workerReq: over(m.workerReq, PAID.workerReq),
    cpu: over((m.workerReq || 0) * UNIT.cpuMsPerReq, PAID.cpuMs),
    doReq: over(m.doReq, PAID.doReq),
    doGbs: over(m.doGbs, PAID.doGbs),
    rows: over(m.rows, PAID.rowsWritten),
    storage: Math.max(0, (m.storageMB || 0) / 1024 - PAID.storageGB.incl) * PAID.storageGB.perGB,
  };
  const total = Object.values(items).reduce((a, v) => a + v, 0);
  return { total: Math.round(total * 100) / 100, items: Object.fromEntries(Object.entries(items).map(([k, v]) => [k, Math.round(v * 100) / 100])) };
}

/**
 * 사용자 수 → 한 달·가장 바쁜 날 쓰는 몫, 무료 하루 한도 대비(%), 먼저 차는 것, 유료 월 비용.
 * @param {{ users: number, perUser?: number, instantShare?: number, people?: number, liveShare?: number, schoolShare?: number, minutes?: number,
 *   longPoll?: boolean, relay?: boolean, peakFactor?: number, workdays?: number, siteDays?: number, republishes?: number }} o
 *   perUser: 강사 한 명이 한 달에 하는 연수, instantShare: 그중 바로 배포로 올리는 몫, liveShare: 참여 기능을 쓰는 몫,
 *   schoolShare: 참여 기능 연수 중 학교망(실시간 연결 막힘) 몫, peakFactor: 가장 바쁜 날이 평일 평균의 몇 배
 */
export function scenario({ users, perUser = 2, instantShare = 0.7, people = 40, liveShare = 0.5, schoolShare = 0.4, minutes = DEFAULT_MINUTES, longPoll = false, relay = false, peakFactor = 2, workdays = 20, siteDays = 60, republishes = 1 } = {}) {
  const trainings = users * perUser * instantShare;
  const kinds = [
    { w: 1 - liveShare, c: trainingCost({ people, minutes, live: false, republishes }) },
    { w: liveShare * (1 - schoolShare), c: trainingCost({ people, minutes, live: true, network: 'good', longPoll, relay, republishes }) },
    { w: liveShare * schoolShare, c: trainingCost({ people, minutes, live: true, network: 'restricted', longPoll, relay, republishes }) },
  ];
  const per = {};
  for (const { w, c } of kinds) for (const [k, v] of Object.entries(c)) per[k] = (per[k] || 0) + w * v;
  const month = {};
  for (const [k, v] of Object.entries(per)) month[k] = v * trainings;
  month.storageMB = per.storageMB * trainings * (siteDays / 30); // 살아 있는 사이트(보관 기간 동안)
  const peakTrainings = (trainings / workdays) * peakFactor;
  const peak = {};
  for (const k of ['workerReq', 'doReq', 'doGbs', 'rows', 'pagesApi']) peak[k] = per[k] * peakTrainings;
  const free = {
    workerReq: peak.workerReq / FREE.workerReq, doReq: peak.doReq / FREE.doReq, doGbs: peak.doGbs / FREE.doGbs,
    rows: peak.rows / FREE.rowsWritten, storage: month.storageMB / 1024 / FREE.storageGB,
    // Pages API: 바쁜 날 일이 8시간에 몰리고, 그중 가장 붐비는 5분은 평균의 4배로 봄
    pagesApi: ((peak.pagesApi / (8 * 12)) * 4) / FREE.pagesApi5m,
  };
  const first = Object.entries(free).sort((a, b) => b[1] - a[1])[0];
  const round = (o, f = Math.round) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, f(v)]));
  return {
    trainings: Math.round(trainings), peakTrainings: Math.round(peakTrainings * 10) / 10,
    per: round(per), month: round(month), peak: round(peak),
    free: round(free, (v) => Math.round(v * 1000) / 10), // 무료 한도의 %
    first: { resource: first[0], pct: Math.round(first[1] * 1000) / 10 },
    paid: costOf(month),
  };
}

/** 무료로 버티는 가장 큰 사용자 수(가장 바쁜 날 모든 한도가 limitShare 아래): 이분 탐색 */
export function freeMaxUsers(opts = {}, limitShare = 0.6) {
  const ok = (u) => Object.values(scenario({ ...opts, users: u }).free).every((p) => p <= limitShare * 100);
  if (!ok(1)) return 0;
  let lo = 1; let hi = 1e7;
  while (hi - lo > 1) { const mid = Math.floor((lo + hi) / 2); if (ok(mid)) lo = mid; else hi = mid; }
  return lo;
}

/**
 * 관리 화면: 지난 날들의 하루 숫자 → 이번 달 추세, 무료가 차는 날, 유료면 월 비용, 권하는 행동 한 줄.
 * @param {Array<{ req?: number, ds?: number, dr?: number, g?: number, gt?: number, rc?: number, new?: number }>} days 오래된 것부터(오늘이 마지막, 아직 끝나지 않아 추세에서 뺌)
 * @param {{ plan?: 'free'|'paid', budget?: number, storageMB?: number, newWorkShare?: number, dailySiteCap?: number, today?: { state?: string } }} o
 * @returns {{ month, trend, paidCost, busyDays, capHits, action: 'none'|'upgrade'|'raise_caps'|'pause_new', text: string }}
 */
export function forecast(days, { plan = 'free', budget = FREE.workerReq, storageMB = 0, newWorkShare = 0.6, dailySiteCap = 30 } = {}) {
  const doOf = (d) => (d.ds || 0) + (d.dr || 0) + (d.g || 0) + (d.gt || 0) + (d.rc || 0);
  const load = (d) => Math.max(d.req || 0, doOf(d)); // Worker 요청과 DO 요청 중 큰 쪽(무료 하루 한도가 둘 다 10만)
  const done = days.slice(0, -1);
  const w7 = done.slice(-7); const w28 = done.slice(-28);
  const avg = (list, f) => (list.length ? list.reduce((a, d) => a + f(d), 0) / list.length : 0);
  const month = { workerReq: avg(w7, (d) => d.req || 0) * 30, doReq: avg(w7, doOf) * 30, storageMB };
  // 지난 28일 직선 맞춤 → 새 일을 멈추는 선(예산의 newWorkShare)·한도에 닿는 날
  const series = w28.map(load); const n = series.length;
  let slope = 0; let level = n ? series[n - 1] : 0;
  if (n >= 5) {
    const xm = (n - 1) / 2; const ym = series.reduce((a, v) => a + v, 0) / n;
    let num = 0; let den = 0;
    series.forEach((v, i) => { num += (i - xm) * (v - ym); den += (i - xm) ** 2; });
    slope = den ? num / den : 0; level = Math.max(0, ym + slope * (n - 1 - xm));
  }
  const limit = budget || FREE.workerReq;
  const peak7 = w7.reduce((m, d) => Math.max(m, load(d)), 0);
  const daysTo = (target) => (level >= target ? 0 : slope > 0 ? Math.ceil((target - level) / slope) : null);
  const capHits = w7.filter((d) => (d.new || 0) >= dailySiteCap).length;
  const busyDays = w7.filter((d) => load(d) >= limit * 0.5).length;
  const cost = costOf({ ...month, doGbs: (month.doReq * UNIT.msPerDoReq) / 1000 * 0.125 });
  const usd = `$${cost.total.toFixed(2)}`;
  const pct = Math.round((peak7 / limit) * 100);
  const toStop = daysTo(limit * newWorkShare);
  let action = 'none'; let text;
  const newToday = days.length ? days[days.length - 1].new || 0 : 0; const avgNew = avg(w7, (d) => d.new || 0);
  if (newToday >= 20 && newToday >= 3 * Math.max(1, avgNew)) {
    action = 'pause_new';
    text = `오늘 새 사이트가 ${newToday}개로 평소(하루 ${Math.round(avgNew)}개)보다 크게 몰렸어요. 큰 연수가 아니라면 [새 배포 멈추기]로 잠시 멈추고 사이트 목록·신고를 확인하세요. 이미 배포한 사이트는 그대로 열려요.`;
  } else if (plan === 'paid') {
    text = `유료 요금제예요. 지난 7일 추세로 이번 달 약 ${usd}(기본 $5 포함). 하루 한도로 멈추지 않아요.`;
    if (capHits >= 2) { action = 'raise_caps'; text = `최근 7일 중 ${capHits}일이 하루 새 사이트 상한(${dailySiteCap})에 닿았어요. DAILY_SITE_CAP을 올려도 비용은 거의 그대로예요(이번 달 약 ${usd}).`; }
  } else if (busyDays >= 2 || (toStop != null && toStop <= 7)) {
    action = 'upgrade';
    text = `무료가 빠듯해요(최근 7일 중 ${busyDays}일이 하루 한도의 50%를 넘음${toStop != null ? `, 이 추세면 ${toStop}일 뒤 새 사이트를 받지 못하는 날이 와요` : ''}). Workers Paid로 올리면 이번 달 약 ${usd}예요. 올리기 싫으면 [새 배포 멈추기]로 오늘 연수를 지키고 새 연수는 강사 계정으로 넘기세요.`;
  } else if (capHits >= 2 && peak7 < limit * 0.3) {
    action = 'raise_caps';
    text = `요청은 넉넉한데(가장 많은 날 ${pct}%) 최근 7일 중 ${capHits}일이 하루 새 사이트 상한(${dailySiteCap})에 닿았어요. DAILY_SITE_CAP을 올려도 돼요.`;
  } else {
    text = `무료로 충분해요(가장 많은 날 하루 한도의 ${pct}%${toStop != null ? `, 이 추세면 약 ${toStop}일 뒤 빠듯해져요` : ''}). 유료로 올리면 이번 달 약 ${usd}예요.`;
  }
  return {
    month: { workerReq: Math.round(month.workerReq), doReq: Math.round(month.doReq), storageMB: Math.round(storageMB) },
    trend: { perDay: Math.round(slope), level: Math.round(level), peak7, limit, daysToTight: daysTo(limit * 0.45), daysToStop: toStop, daysToLimit: daysTo(limit) },
    paidCost: cost, busyDays, capHits, action, text,
  };
}
