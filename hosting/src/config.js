// 환경 변수 → 한도. 값이 없거나 이상하면 기본값을 씁니다.

const MB = 1024 * 1024;
export const DEFAULTS = {
  MAX_BYTES: 40 * MB, // 사이트 하나
  MAX_FILE_BYTES: 20 * MB, // 파일 하나
  MAX_FILES: 600,
  SITE_DAYS: 30, // 공개 기간(마지막으로 올린 날부터)
  SITES_PER_HOUR: 6, // 같은 인터넷 주소(IP)에서 새 사이트
  SITES_PER_DAY: 20,
  DAILY_SITE_CAP: 300, // 하루에 만들 수 있는 새 사이트(전체)
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
  DAILY_ROOM_CAP: 300, // 하루에 새로 만들 수 있는 방(전체)
  ALLOWED_ORIGINS: 'https://yoorrard.github.io,http://localhost:5173,http://localhost:4173',
};

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
  return {
    maxBytes: num(env.MAX_BYTES, DEFAULTS.MAX_BYTES),
    maxFileBytes: num(env.MAX_FILE_BYTES, DEFAULTS.MAX_FILE_BYTES),
    maxFiles: num(env.MAX_FILES, DEFAULTS.MAX_FILES),
    days: num(env.SITE_DAYS, DEFAULTS.SITE_DAYS, { int: false, min: 1e-9 }),
    sitesPerHour: num(env.SITES_PER_HOUR, DEFAULTS.SITES_PER_HOUR),
    sitesPerDay: num(env.SITES_PER_DAY, DEFAULTS.SITES_PER_DAY),
    dailySiteCap: num(env.DAILY_SITE_CAP, DEFAULTS.DAILY_SITE_CAP),
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
    dailyRoomCap: num(env.DAILY_ROOM_CAP, DEFAULTS.DAILY_ROOM_CAP),
    origins: new Set(origins),
    adminKey: typeof env.ADMIN_KEY === 'string' ? env.ADMIN_KEY.trim() : '',
    reportWebhook: typeof env.REPORT_WEBHOOK === 'string' && /^https:\/\//.test(env.REPORT_WEBHOOK.trim()) ? env.REPORT_WEBHOOK.trim() : '',
    publicOrigin,
    // 켜면 Supabase 연결을 쓰는 사이트가 엔진이 고정한 supabase-js 파일 하나를 cdn.jsdelivr.net에서 불러올 수 있음(기본은 꺼짐)
    allowSupabaseSdk: /^(1|true|yes|on)$/i.test(String(env.ALLOW_SUPABASE_SDK ?? '').trim()),
  };
}
export const DAY_MS = 86400000;
export const HOUR_MS = 3600000;
export const expiryFrom = (now, days) => Math.round(now + days * DAY_MS);
