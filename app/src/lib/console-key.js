// 강사 화면(console.html)에 붙여 넣을 관리자 키를 어디서 가져올지: 배포 완료 카드(pages/steps/Share.jsx)와 처음 화면의 '내 연수' 목록(landing/Mine.jsx)이 같은 규칙을 씀.
// 키는 두 곳에 있음 — 바로 배포가 함께 켠 방의 키는 연수에(deploy.lecpage.adminKey), 강사가 연결한 서버(구글 시트·Supabase·내 서버)의 키는 이 기기의 키 보관함에.
// 바로 배포 방을 쓰다가 내 서버로 바꾼 연수에는 예전 방의 키가 그대로 남아 있어(Publish.jsx Instant), 지금 사이트가 쓰는 방이 어느 쪽인지 보고 골라야 함:
// 남은 키를 그대로 복사해 주면 '관리자 키를 복사했어요'라고 하고도 강사 화면이 그 키를 받지 않음.
// 화면 조각·엔진을 끌어오지 않는 작은 파일(처음 화면이 받는 '내 연수' 목록에서 씀)
import { PUBLISH_API } from './publish-api.js';

const originOf = (u) => { try { return new URL(u).origin; } catch { return ''; } };
/**
 * 바로 배포 서버가 맡은 참여 기능 방인지. 그 방은 바로 배포한 사이트 주소에서 온 요청만 받음(hosting/src/live/host.js liveOriginOk):
 * Vercel·GitHub Pages·Netlify·Cloudflare·ZIP으로 올린 사이트에 넣으면 질문·투표·출석이 보내지지 않음.
 * srvLiveUrl: 서버가 알려 준 방 주소(/api/info live.url), api: 바로 배포 서버 주소(시험에서만 바꿈)
 */
export const lecOnlyLive = (live, srvLiveUrl = '', api = PUBLISH_API) => live?.provider === 'http' && !!live.url && !!originOf(live.url) && [originOf(srvLiveUrl), originOf(api)].includes(originOf(live.url));

/** 연수의 참여 기능 연결 { provider, url, code, … }: AI가 만든 연수는 meta.live, 예전 설계도 방식은 blueprint.live(site-meta.js deployView와 같은 자리) */
export const liveOf = (p) => ((p && (p.v === 2 || p.site) ? p.meta?.live : p?.blueprint?.live) || {});

/** 이 기기의 키 보관함에서 관리자 키를 두는 자리: 서버 주소와 연수 코드로(Supabase 프로젝트 하나에 연수 여럿이면 연수마다 키가 다름). 코드 없이 주소로만 둔 예전 자리도 있음 */
export const adminSlot = (url, code = '') => 'live-admin:' + String(url).replace(/\/+$/, '') + (code ? '#' + code : '');
/** 키 보관함에서 그 서버의 관리자 키: 연수 코드로 기억한 것 먼저, 없으면 주소로만 기억한 것. loadKey: lib/ai.js의 것(이 파일이 보관함 모듈을 끌어오지 않게 받아 씀). 없으면 '' */
export const adminKeyFrom = (loadKey, url, code = '') => (url ? loadKey(adminSlot(url, code)).then((r) => r.key || (code ? loadKey(adminSlot(url)).then((x) => x.key || '', () => '') : ''), () => '') : Promise.resolve(''));

/**
 * 대표 주소의 강사 화면에 맞는 관리자 키가 어디 있는지.
 * p: 연수, live: 그 연수의 참여 기능 연결(deployView(p).live 또는 liveOf(p)), liveOn: 대표 주소의 사이트에 참여 기능이 들어 있음
 * → { key } 바로 배포 방의 키(연수에 있음) | { url, code } 강사가 연결한 서버(키는 이 기기의 키 보관함에서 adminKeyFrom으로) | null 알 수 없음(키 없이 강사 화면만 엶)
 * 바로 배포 방의 키는 그 방이 지금 쓰는 방일 때만: 대표 주소가 바로 배포이고, 연결이 그 방을 가리키거나(lecOnlyLive) 강사가 연결한 서버가 아직 확인되지 않았을 때(liveOk 아님)
 */
export function consoleKeySource(p, live, { liveOn = true, api = PUBLISH_API } = {}) {
  const d = p?.deploy || {};
  if (d.target === 'lecpage' && d.lecpage?.adminKey && (lecOnlyLive(live, '', api) || !p.liveOk)) return { key: d.lecpage.adminKey };
  if (liveOn && p?.liveOk && live?.url) return { url: live.url, code: live.code || '' };
  return null;
}
