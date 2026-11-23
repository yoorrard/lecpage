// 내 Vercel 계정에 한 번에(lecpage 커넥트 경유): 공식 Vercel CLI의 브라우저 로그인 한 번으로 배포·배포 보호 끄기·삭제.
// 경로: /bridge/vercel/* (skills/lecpage/scripts/studio-vercel.mjs). 커넥트가 CLI로 올리고, 앱은 누르기·보기만.
// Vercel 로그인은 그 PC의 커넥트 폴더에만 있음(앱·lecpage 운영자는 보지 못함). 토큰으로 연결하는 길(lib/deploy.js deployVercel)은 그대로 '다른 방법'
import { bridgeRunner } from './bridge-run.js';

export const VC_CAP = 'vercel';
export const VC_NAME_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
// 이 브라우저에서 커넥트로 Vercel에 배포해 봄(카드에 '연결돼 있어요', 연결해 둔 곳 목록). 로그인 자체는 그 PC의 커넥트에 있음
const VC_USED = 'lecpage:vc-used';
export const vcUsed = () => { try { return localStorage.getItem(VC_USED) === '1'; } catch { return false; } };
export const markVcUsed = (on = true) => { try { if (on) localStorage.setItem(VC_USED, '1'); else localStorage.removeItem(VC_USED); } catch { /* 저장 못 해도 배포는 됨 */ } };

const R = bridgeRunner({ base: '/bridge/vercel', key: 'vc', name: 'Vercel' });
export const vcView = R.view;
export const vcAnswer = R.answer;
export const vcCancel = R.cancel;
export const vcRun = R.run;
export const vcUpload = R.upload;

/** 단계 이름 → 화면에 보일 한 줄 */
export const VC_PHASE = {
  tool: 'Vercel 연결을 확인하는 중…',
  login: '브라우저에서 Vercel에 로그인하고 허용해 주세요.',
  team: '어느 팀에 배포할지 골라 주세요.',
  site: '사이트를 배포하는 중…',
  open: '로그인 없이 열리게 바꾸는 중…',
  wait: '주소가 열리기를 기다리는 중…',
  delete: 'Vercel에서 지우는 중…',
};
