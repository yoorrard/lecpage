// 환경 변수 → 한도. 값이 없거나 이상하면 기본값을 씁니다.

const MB = 1024 * 1024;
export const DEFAULTS = {
  MAX_BYTES: 40 * MB, // 사이트 하나
  MAX_FILE_BYTES: 20 * MB, // 파일 하나
  MAX_FILES: 600,
  SITE_DAYS: 30, // 공개 기간(마지막으로 올린 날부터)
  SITES_PER_HOUR: 6, // 같은 인터넷 주소(IP)에서 새 사이트
  SITES_PER_DAY: 20,
  DAILY_SITE_CAP: 30, // 하루에 만들 수 있는 새 사이트(전체). PLAN=paid면 300. 차면 앱이 '내 계정에 올리기'로 안내
  MAX_TOTAL_BYTES: 4 * 1024 * MB, // 전체 저장량. 넘으면 새로 받지 않음(무료 한도 5GB보다 낮게)
  DEPLOYS_PER_HOUR: 30, // 사이트 하나를 다시 올리는 횟수
  REPORTS_PER_HOUR: 5, // 같은 IP의 신고
  DAILY_REPORT_CAP: 200,
  REPORT_KEEP: 500, // 보관하는 신고 수(넘으면 오래된 것부터 지움)
  REPORT_DAYS: 90, // 신고를 보관하는 날 수
  // 실시간 방(질문·보드·투표). LIVE=off면 끔
  LIVE_MAX_UPLOAD_MB: 10, // 보드에 올리는 파일 하나
  LIVE_ROOM_MB: 200, // 방 하나에 올릴 수 있는 파일 합계(R2 없이 DO에 담을 때)
  LIVE_MAX_PARTICIPANTS: 300, // 방 하나의 참가자
  LIVE_SOCKETS_PER_IP: 500, // 한 IP(학교 공유기 하나)가 방 하나에 여는 실시간 연결
  DAILY_ROOM_CAP: 30, // 하루에 새로 만들 수 있는 방(전체). PLAN=paid면 300
  DAILY_REQUEST_BUDGET: 100000, // 하루 요청 예산(무료 요금제 한도). 60%를 넘으면 새 사이트·새 방을 받지 않아 이미 올라온 사이트가 쓸 몫을 남김. PLAN=paid면 0(끔)
  MAX_SITE_DAYS: 365, // 방문이 이어져도 처음 만든 날부터 이만큼 지나면 더 늘리지 않음(다시 올리면 늘어남)
  ALLOWED_ORIGINS: 'https://yoorrard.github.io,http://localhost:5173,http://localhost:4173',
  ALERT_AT: '50,60,80,95', // 하루 요청 예산의 몇 %에서 알림(ALERT_WEBHOOK, 없으면 REPORT_WEBHOOK)
  STATS_DAILY_CAP: 20000, // 앱 익명 이용 합계: 항목 하나가 하루에 셀 수 있는 최대(부풀리기 막기)
};

/** 요금제에 따라 달라지는 기본값. free: Cloudflare 무료 요금제 안에서만(하루 한도에 닿으면 그날은 멈춤). paid: Workers Paid(하루 한도 없음, 쓴 만큼) */
export const PLAN_DEFAULTS = {
  free: {},
  paid: { DAILY_SITE_CAP: 300, DAILY_ROOM_CAP: 300, DAILY_REQUEST_BUDGET: 0 },
};
/** 하루 요청 예산에서 새 사이트·새 방을 받는 구간 */
export const NEW_WORK_SHARE = 0.6;
/** 하루 요청 예산에서 덜 급한 요청(앱 이용 합계 받기)까지 받는 구간. 넘으면 Worker가 DO를 부르지 않고 바로 버림 */
export const EXTRA_WORK_SHARE = 0.85;

/** "off"·"0"·"false"·"no"면 끈 것 */
const off = (v) => /^(off|0|false|no)$/i.test(String(v ?? '').trim());

function num(v, d, { int = true, min = 1 } = {}) {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  if (!Number.isFinite(n) || n < min) return d;
  return int ? Math.floor(n) : n;
}

export function config(env = {}) {
  const origins = String(env.ALLOWED_ORIGINS ?? DEFAULTS.ALLOWED_ORIGINS).split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean);
  let publicOrigin = '';
  try { if (env.PUBLIC_ORIGIN) publicOrigin = new URL(String(env.PUBLIC_ORIGIN)).origin; } catch { /* 잘못된 값은 무시 */ }
  const plan = String(env.PLAN ?? '').trim().toLowerCase() === 'paid' ? 'paid' : 'free';
  const D = { ...DEFAULTS, ...PLAN_DEFAULTS[plan] };
  return {
    plan,
    dailyRequestBudget: num(env.DAILY_REQUEST_BUDGET, D.DAILY_REQUEST_BUDGET, { min: 0 }),
    keepAlive: !off(env.KEEP_ALIVE),
    maxSiteDays: num(env.MAX_SITE_DAYS, D.MAX_SITE_DAYS),
    maxBytes: num(env.MAX_BYTES, DEFAULTS.MAX_BYTES),
    maxFileBytes: num(env.MAX_FILE_BYTES, DEFAULTS.MAX_FILE_BYTES),
    maxFiles: num(env.MAX_FILES, DEFAULTS.MAX_FILES),
    days: num(env.SITE_DAYS, DEFAULTS.SITE_DAYS, { int: false, min: 1e-9 }),
    sitesPerHour: num(env.SITES_PER_HOUR, DEFAULTS.SITES_PER_HOUR),
    sitesPerDay: num(env.SITES_PER_DAY, DEFAULTS.SITES_PER_DAY),
    dailySiteCap: num(env.DAILY_SITE_CAP, D.DAILY_SITE_CAP),
    maxTotalBytes: num(env.MAX_TOTAL_BYTES, DEFAULTS.MAX_TOTAL_BYTES),
    deploysPerHour: num(env.DEPLOYS_PER_HOUR, DEFAULTS.DEPLOYS_PER_HOUR),
    reportsPerHour: num(env.REPORTS_PER_HOUR, DEFAULTS.REPORTS_PER_HOUR),
    dailyReportCap: num(env.DAILY_REPORT_CAP, DEFAULTS.DAILY_REPORT_CAP),
    reportKeep: num(env.REPORT_KEEP, DEFAULTS.REPORT_KEEP),
    reportDays: num(env.REPORT_DAYS, DEFAULTS.REPORT_DAYS),
    live: !off(env.LIVE),
    liveUploads: !off(env.LIVE) && !off(env.LIVE_UPLOADS),
    liveMaxUploadMb: num(env.LIVE_MAX_UPLOAD_MB, DEFAULTS.LIVE_MAX_UPLOAD_MB),
    liveRoomBytes: num(env.LIVE_ROOM_MB, DEFAULTS.LIVE_ROOM_MB) * MB,
    liveMaxParticipants: num(env.LIVE_MAX_PARTICIPANTS, DEFAULTS.LIVE_MAX_PARTICIPANTS),
    liveSocketsPerIp: num(env.LIVE_SOCKETS_PER_IP, DEFAULTS.LIVE_SOCKETS_PER_IP),
    dailyRoomCap: num(env.DAILY_ROOM_CAP, D.DAILY_ROOM_CAP),
    origins: new Set(origins),
    adminKey: typeof env.ADMIN_KEY === 'string' ? env.ADMIN_KEY.trim() : '',
    reportWebhook: typeof env.REPORT_WEBHOOK === 'string' && /^https:\/\//.test(env.REPORT_WEBHOOK.trim()) ? env.REPORT_WEBHOOK.trim() : '',
    publicOrigin,
    // 알림: 하루 예산의 ALERT_AT %를 넘을 때, 저장량이 80%를 넘을 때. 비밀 ALERT_WEBHOOK(없으면 REPORT_WEBHOOK)으로 보냄
    alertWebhook: [env.ALERT_WEBHOOK, env.REPORT_WEBHOOK].map((v) => (typeof v === 'string' ? v.trim() : '')).find((v) => /^https:\/\//.test(v)) || '',
    alertAt: String(env.ALERT_AT ?? DEFAULTS.ALERT_AT).split(',').map(Number).filter((n) => Number.isFinite(n) && n > 0 && n <= 100).sort((a, b) => a - b),
    // 앱 익명 이용 합계(앱 열기·만들기·공개 횟수, 하루 단위 숫자만). STATS=off면 받지 않음
    stats: !off(env.STATS),
    statsDailyCap: num(env.STATS_DAILY_CAP, DEFAULTS.STATS_DAILY_CAP),
    // 관리 화면(/admin): Cloudflare Access 팀 도메인과 애플리케이션 AUD. 둘 다 있어야 켜짐(없으면 /admin은 404)
    access: accessConfig(env),
    // 공지 링크가 갈 수 있는 곳(쉼표로 구분한 호스트). 비우면 https 주소면 됨
    noticeLinkHosts: String(env.NOTICE_LINK_HOSTS ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
    // 켜면 Supabase 연결을 쓰는 사이트가 엔진이 고정한 supabase-js 파일 하나를 cdn.jsdelivr.net에서 불러올 수 있음(기본은 꺼짐)
    allowSupabaseSdk: /^(1|true|yes|on)$/i.test(String(env.ALLOW_SUPABASE_SDK ?? '').trim()),
  };
}
/**
 * ACCESS_TEAM_DOMAIN: "<팀>.cloudflareaccess.com"(https:// 붙여도 됨). 로컬 시험만 http://127.0.0.1:<포트>·http://localhost:<포트>.
 * ACCESS_AUD: Access 애플리케이션의 Application Audience(AUD) 태그(쉼표로 여러 개). ACCESS_EMAILS(선택, 비밀): 한 번 더 확인할 이메일.
 * @returns {{ team: string, aud: string[], emails: Set<string> } | null}
 */
export function accessConfig(env) {
  const team = normTeam(env.ACCESS_TEAM_DOMAIN);
  const aud = String(env.ACCESS_AUD ?? '').split(',').map((s) => s.trim()).filter((s) => /^[A-Za-z0-9]{16,128}$/.test(s));
  if (!team || !aud.length) return null;
  const emails = new Set(String(env.ACCESS_EMAILS ?? '').split(',').map((s) => s.trim().toLowerCase()).filter((s) => s.includes('@')));
  return { team, aud, emails };
}
/** 팀 도메인 → 'https://<팀>.cloudflareaccess.com'. 다른 곳(공격자의 열쇠 목록)을 가리키지 못하게 모양을 좁힘 */
export function normTeam(v) {
  const s = String(v ?? '').trim().toLowerCase().replace(/\/+$/, '');
  if (!s) return '';
  const m = /^(?:https:\/\/)?([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)\.cloudflareaccess\.com$/.exec(s);
  if (m) return `https://${m[1]}.cloudflareaccess.com`;
  const dev = /^http:\/\/(127\.0\.0\.1|localhost):(\d{2,5})$/.exec(s);
  return dev ? `http://${dev[1]}:${dev[2]}` : '';
}
export const DAY_MS = 86400000;
export const HOUR_MS = 3600000;
export const expiryFrom = (now, days) => Math.round(now + days * DAY_MS);
