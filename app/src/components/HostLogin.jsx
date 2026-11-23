// 내 계정에 '로그인 한 번'으로 배포·연결하는 곳들의 조각(공통 틀은 OneClick.jsx).
//   Vercel: lecpage 커넥트가 공식 CLI로 로그인(브라우저 승인)·배포 — 통신은 lib/vc-connect.js
//   Netlify: 브라우저만으로 로그인(티켓 방식) — lib/netlify-login.js. 커넥트 없이도 됨
// Cloudflare는 CfConnect.jsx. 토큰 붙여넣기 단계(Publish.jsx Connect)는 접힌 '다른 방법'으로 남음
import { VC_PHASE, VC_CAP, vcAnswer } from '../lib/vc-connect.js';
import { NF_PHASE, NETLIFY_LOGIN_OK } from '../lib/netlify-login.js';
import { usePc, pcCan, osName } from '../lib/connection.js';
import { RunProgress, AskPick } from './OneClick.jsx';

/** 커넥트가 Vercel 일을 할 수 있는지: 'ready' | 'old'(새 버전으로 바꿔야) | 'off'(짝은 있는데 꺼짐·막힘) | 'none'(없음) | 'wait'(확인 중) | 'mobile' */
export function useVcWay() {
  const pc = usePc();
  const way = pcCan(pc, VC_CAP) ? 'ready' : pc.state === 'on' ? 'old' : osName() === 'mobile' ? 'mobile' : pc.state === 'none' ? 'none' : pc.state === 'unknown' ? 'wait' : 'off';
  return { pc, way };
}

const vcLoginOk = (u) => /^https:\/\/vercel\.com\//.test(u || '');
/** 커넥트가 Vercel 일을 하는 동안: 지금 단계 한 줄 + 사람이 할 일 하나(로그인·팀 고르기) */
export function VcProgress({ view, onCancel }) {
  return (
    <RunProgress view={view} phases={VC_PHASE} onCancel={onCancel}
      slow="처음에는 배포 도구를 받느라 1~2분 걸려요."
      login={{ ok: vcLoginOk, hint: '방금 열린 창에서 로그인하고 허용해요. 계정이 없으면 그 창에서 가입해요(무료, 메일이나 GitHub 계정).' }}
      asks={{ team: (a) => <AskPick label="Vercel 팀" items={a.teams} onPick={(id) => vcAnswer({ team: id })} /> }} />
  );
}

/**
 * Vercel(커넥트 길) 실패를 화면 문구로: { t(까닭), action?(누를 곳 하나), kind }. retry: 다시 시작, onToken: 토큰으로 연결하는 길 열기.
 * 'cancelled'는 null(알림만). 'old'는 kind 'old'(화면이 [새 버전으로 바꾸기]를 그림)
 */
export function vcFail(e, { retry, onToken } = {}) {
  const code = e?.code || '';
  if (code === 'cancelled') return null;
  if (code === 'old') return { kind: 'old', t: 'lecpage 커넥트를 새 버전으로 바꿔야 해요.' };
  if (code === 'name-taken') return { kind: code, t: e.message };
  const again = { label: '다시 시도', onClick: () => retry?.() };
  if (['login-needed', 'login-failed', 'timeout', 'network', 'off', 'busy', 'no-files', 'not-ready'].includes(code)) return { kind: code, t: e.message, action: again };
  // 코드가 없는 실패는 Vercel에 가기 전에 앱에서 멈춘 것(공개 범위의 암호가 비었음·사이트가 한도를 넘음 등): 토큰으로 바꿔도 같으므로 까닭을 보여 주고 [다시 시도]
  if (!code) return { kind: 'failed', title: '배포하지 못했어요.', t: e?.message || '잠시 뒤 다시 시도해 주세요.', action: again };
  // 모르는 실패·한도·팀 없음: 같은 일을 되풀이하기보다 토큰으로 연결하는 길을 열어 줌
  return { kind: code || 'failed', t: e?.message || 'Vercel에서 끝내지 못했어요. 잠시 뒤 다시 시도해 주세요.', more: onToken ? '계속 안 되면 토큰으로 연결해 배포할 수 있어요.' : '', action: onToken ? { label: '토큰으로 연결', onClick: onToken } : again };
}

/**
 * Netlify 로그인 기다리는 동안: 한 줄 + [로그인 창 열기](팝업이 막혔거나 창을 닫았을 때) + [중지].
 * 운영 주소에서는 앱이 그 창을 닫을 수 없음(창이 Netlify로 넘어가면 브라우저가 두 창 사이를 끊음: 앱의 COOP same-origin) → '이 탭으로 돌아오면'이라고 사실대로 알림
 */
export function NfProgress({ view, onCancel }) {
  return (
    <RunProgress view={view} phases={NF_PHASE} onCancel={onCancel}
      login={{ ok: NETLIFY_LOGIN_OK, hint: '[Authorize]를 누른 뒤 이 탭으로 돌아오면 이어서 진행해요(그 창은 닫아도 돼요). 창이 안 보이면 아래 버튼으로 열어요. 계정이 없으면 그 창에서 가입해요(무료, 메일이나 GitHub 계정).' }} />
  );
}

/** Netlify 로그인 실패를 화면 문구로. retry: 다시 시작, onToken: 토큰으로 연결하는 길 열기. 'cancelled'는 null */
export function nfFail(e, { retry, onToken } = {}) {
  const code = e?.code || '';
  if (code === 'cancelled') return null;
  const again = { label: '다시 시도', onClick: () => retry?.() };
  if (code === 'failed' && onToken) return { kind: code, t: e.message, action: { label: '토큰으로 연결', onClick: onToken } };
  return { kind: code || 'failed', t: e?.message || 'Netlify 로그인을 끝내지 못했어요. 다시 눌러 주세요.', action: again };
}
