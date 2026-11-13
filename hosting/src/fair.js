// 넘침 처리: 바로 배포가 붐빌 때 오늘 연수가 깨지지 않게, 새로 만드는 사람부터 '내 계정에 배포하기'(같은 파일 그대로)로 넘깁니다.
// Gate가 쓰고(gate.js), 앱은 /api/info·/api/status의 capacity와 오류의 reason·scope·next로 알아듣습니다.
//
// 단계(무료 요금제 = 하루 예산이 있을 때. '쓴 몫'은 오늘 Worker 요청 + 오늘 아직 끝나지 않은 예약 연수의 남은 어림)
//   open   예산의 45% 아래            누구나 새 사이트·새 방
//   tight  45% 이상 60% 아래          연수 날짜가 2주 안인(예약한) 사이트·방만. 나머지는 내 계정으로
//   full   60% 이상, 저장 공간·하루 상한이 참, Pages API가 잠시 막힘   새 사이트·새 방 없음(다시 배포·이미 연 방은 그대로)
//   paused 운영자가 멈춤
// 공정 몫(계정이 없으니 기기·인터넷 주소로 셈): 앱이 보내는 기기 표(device, 기기에 둔 무작위 값)가 있으면 기기마다 하루 SITES_PER_DEVICE,
//   같은 IP(학교 공유기)는 넉넉히. 기기 표가 없으면 예전처럼 IP마다 시간·하루 상한
import { NEW_WORK_SHARE } from './config.js';

/** 이 몫을 넘으면 예약한 연수만 받음 */
export const TIGHT_SHARE = 0.45;
/** 붐빌 때 먼저 받는 연수: 연수 날짜가 이 날 수 안 */
export const NEAR_DAYS = 14;
/** 넘길 곳(강사 계정). 앱이 사이트 크기·인원으로 순서를 다시 정함 */
export const NEXT_HOSTS = ['cloudflare', 'vercel', 'github', 'netlify'];
/** 참여 기능 방을 넘길 곳(강사 계정) */
export const NEXT_LIVE = ['cloudflare', 'supabase'];

const DAY = 864e5;
/** 다음 하루 한도 초기화(00:00 UTC = 한국 시간 오전 9시) */
export const resetAt = (now) => (Math.floor(now / DAY) + 1) * DAY;

export const MSG = {
  paused: '운영자가 잠시 새 배포를 멈췄어요. 이미 배포한 사이트는 그대로 열려요. 내 계정에 배포하면 같은 파일 그대로 열 수 있어요.',
  budget: '오늘은 바로 배포 몫을 거의 다 써서 새 사이트·새 방을 받지 않아요(한국 시간 오전 9시에 다시 받아요). 이미 배포한 사이트는 그대로 열려요. 내 계정에 배포하면 같은 파일 그대로 열 수 있어요.',
  tight: `오늘은 바로 배포가 붐벼서 연수 날짜가 ${NEAR_DAYS}일 안인 사이트부터 받고 있어요. 이 사이트는 내 계정에 배포해 주세요(같은 파일 그대로예요).`,
  daily_cap: '오늘 바로 배포로 만들 수 있는 새 사이트가 다 찼어요. 내 계정에 배포하거나 내일(한국 시간 오전 9시 뒤) 다시 해 주세요.',
  room_cap: '오늘 바로 배포로 만들 수 있는 참여 기능 방이 다 찼어요. 사이트는 그대로 배포하고, 참여 기능은 내 Cloudflare나 Supabase로 연결해 주세요.',
  storage: '바로 배포 저장 공간이 가득 찼어요. 내 계정에 배포해 주세요(같은 파일 그대로예요).',
  pages_api: '배포하는 사람이 한꺼번에 많아 잠깐 줄을 서 있어요. 1~2분 뒤에 다시 배포해 주세요. 이미 배포한 사이트는 그대로 열려요.',
  device: '이 기기에서 오늘 만들 수 있는 새 사이트를 다 썼어요. 이미 만든 사이트는 다시 배포할 수 있어요. 새 사이트는 내 계정에 배포해 주세요.',
  ip: '이 인터넷 주소(학교·기관 공유기)에서 오늘 만들 수 있는 새 사이트를 다 썼어요. 이미 만든 사이트는 다시 배포할 수 있어요. 새 사이트는 내 계정에 배포해 주세요.',
  ip_hour: '이 인터넷 주소에서 한 시간에 만들 수 있는 새 사이트를 다 썼어요. 잠시 뒤 다시 하거나 내 계정에 배포해 주세요.',
  booked_live: '그날은 바로 배포 참여 기능 방이 다 찼어요. 사이트는 바로 배포 그대로 두고, 참여 기능만 내 Cloudflare(또는 Supabase)로 연결해 주세요.',
  long_term: '오래 쓸 사이트는 내 계정에 배포하면 보관 기간 제한이 없어요. 바로 배포는 체험·연수용으로 마지막으로 배포한 날부터 정해진 날까지 열려요.',
};

/** 앱이 보낸 기기 표: 영문·숫자·_- 16~64자만(아니면 '') */
export function deviceOf(v) {
  const s = typeof v === 'string' ? v.trim() : '';
  return /^[A-Za-z0-9_-]{16,64}$/.test(s) ? s : '';
}

/**
 * 지금 단계.
 * @param {{ budget: number, used: number, reserved: number, paused?: boolean, storageFull?: boolean, pagesUntil?: number,
 *   sitesLeft?: number, roomsLeft?: number, now?: number }} o
 * @returns {{ state: 'open'|'tight'|'full'|'paused', reason: string|null, newSites: boolean, newRooms: boolean, onlyBooked: boolean,
 *   pct: number, resetAt: number, retryAt?: number, message_ko?: string }}
 */
export function tier({ budget = 0, used = 0, reserved = 0, paused = false, storageFull = false, pagesUntil = 0, sitesLeft = Infinity, roomsLeft = Infinity, now = Date.now() } = {}) {
  const pct = budget ? Math.round(((used + reserved) / budget) * 1000) / 10 : 0;
  const base = { pct, resetAt: resetAt(now) };
  const shut = (state, reason, extra = {}) => ({ ...base, state, reason, newSites: false, newRooms: false, onlyBooked: false, message_ko: MSG[reason], ...extra });
  if (paused) return shut('paused', 'paused');
  if (storageFull) return shut('full', 'storage');
  if (pagesUntil > now) return shut('full', 'pages_api', { retryAt: pagesUntil });
  if (budget && pct >= NEW_WORK_SHARE * 100) return shut('full', 'budget');
  const onlyBooked = !!budget && pct >= TIGHT_SHARE * 100;
  const newSites = sitesLeft > 0; const newRooms = roomsLeft > 0;
  const reason = onlyBooked ? 'tight' : !newSites ? 'daily_cap' : null;
  return { ...base, state: onlyBooked ? 'tight' : newSites ? 'open' : 'full', reason, newSites, newRooms, onlyBooked, ...(reason ? { message_ko: MSG[reason] } : {}) };
}

/** 예약이 '붐빌 때 먼저 받는 연수'인지(연수 날짜가 NEAR_DAYS 안) */
export const nearBooking = (b, now = Date.now()) => !!b && Number.isFinite(b.at) && b.at - now < NEAR_DAYS * DAY;

/** 넘길 때 앱에 같이 주는 것 */
export const overflow = (scope, extra = {}) => ({ scope, next: NEXT_HOSTS, ...extra });
