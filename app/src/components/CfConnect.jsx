// 내 Cloudflare 계정에 한 번에(lecpage 커넥트 경유): 공통 조각(OneClick.jsx)에 Cloudflare의 단계·물음·켜는 법을 꽂음.
// 배포하기 화면(Publish.jsx)과 참여 기능 연결(LiveSetup.jsx)이 같이 씀. 통신은 lib/cf-connect.js
import { useEffect } from 'preact/hooks';
import { CF_PHASE, CF_CAP, CF_NAME_RE, cfAnswer, cfRun } from '../lib/cf-connect.js';
import { usePc, pcCan, osName, waitForPairing } from '../lib/connection.js';
import { OsWay, ConnectUpdate } from './PcConnect.jsx';
import { RunProgress, AskPick, AskName } from './OneClick.jsx';
import { randomKey, sha256Hex } from '../lib/util.js';

/** 커넥트가 Cloudflare 일을 할 수 있는지: 'ready' | 'old'(새 버전으로 바꿔야) | 'off'(짝은 있는데 꺼짐·막힘) | 'none'(없음) | 'wait'(확인 중) | 'mobile' */
export function useCfWay() {
  const pc = usePc();
  const way = pcCan(pc, CF_CAP) ? 'ready' : pc.state === 'on' ? 'old' : osName() === 'mobile' ? 'mobile' : pc.state === 'none' ? 'none' : pc.state === 'unknown' ? 'wait' : 'off';
  return { pc, way };
}

/** 커넥트가 없거나 꺼져 있을 때: 켜는 법 하나(지금 운영체제). 켜지면 이 화면이 저절로 이어 받음. 예전 판이면 [새 버전으로 바꾸기]. service: 이어 줄 곳 이름(Vercel도 같이 씀) */
export function CfGetConnect({ pc, way, what = '사이트와 참여 기능이 함께 배포돼요', service = 'Cloudflare' }) {
  useEffect(() => { waitForPairing(true); return () => waitForPairing(false); }, []);
  if (way === 'old') return <ConnectUpdate pc={pc} />;
  return (
    <div class="stack cf-get" style={{ gap: '8px' }}>
      <p class="small"><b>lecpage 커넥트를 켜면 {service} 로그인 한 번으로 {what}.</b> {way === 'off' ? 'lecpage 커넥트가 꺼져 있어요. 다시 켜면 이 화면에 버튼이 나와요.' : `이 PC에서 lecpage와 ${service} 사이를 이어 주는 작은 프로그램이에요.`}</p>
      <OsWay os={osName()} onGet={() => { }} main={false} />
    </div>
  );
}

const loginOk = (u) => /^https:\/\/dash\.cloudflare\.com\//.test(u || '') || /^http:\/\/127\.0\.0\.1:\d+\//.test(u || '');
const SUB_PROBLEM = { taken: '이미 쓰는 이름이에요. 다른 이름을 적어 주세요.', invalid: '영문 소문자·숫자로 시작하고 끝나야 해요(하이픈은 가운데만).', failed: '이 이름으로 정하지 못했어요. 다른 이름을 적어 주세요.' };
const cleanSub = (v) => v.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+/, '');
/** 커넥트가 Cloudflare 일을 하는 동안: 지금 단계 한 줄 + 사람이 할 일 하나(로그인·계정 고르기·새 계정의 주소 이름) */
export function CfProgress({ view, onCancel }) {
  return (
    <RunProgress view={view} phases={CF_PHASE} onCancel={onCancel}
      slow="처음에는 배포 도구를 받느라 1~2분 걸려요."
      login={{ ok: loginOk, hint: '방금 열린 창에서 로그인해요. 계정이 없으면 그 창의 [Sign up]으로 가입해요(무료, 메일 주소만).' }}
      asks={{
        account: (a) => <AskPick label="Cloudflare 계정" items={a.accounts} onPick={(id) => cfAnswer({ account: id })} />,
        subdomain: (a) => <AskName round={a.n} label="주소에 들어갈 이름" suggest={a.suggest} pattern={CF_NAME_RE} clean={cleanSub} problem={SUB_PROBLEM[a.problem] || ''} onName={(v) => cfAnswer({ subdomain: v })}
          lead={(v) => <>새 Cloudflare 계정이에요. 사이트 주소가 <span class="mono">사이트이름.<b>{v || '이름'}</b>.workers.dev</span>가 돼요. 처음 한 번만 정해요.</>} />,
      }} />
  );
}

/** 이 서버가 이 관리자 키를 받는지: 'ok' | 'bad'(키가 다름) | 'unknown'(닿지 않음·예전 서버). 받으면 연수 설정도 함께 걸림 */
export async function checkAdminKey(url, code, key, settings) {
  if (!url || !key || !code) return 'unknown';
  try {
    const r = await fetch(`${String(url).replace(/\/+$/, '')}/api/${encodeURIComponent(code)}/init`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-lec-admin': encodeURIComponent(key) },
      body: JSON.stringify({ adminKeyHash: await sha256Hex(key), settings }), signal: AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined,
    });
    return r.ok ? 'ok' : r.status === 401 || r.status === 403 ? 'bad' : 'unknown';
  } catch { return 'unknown'; }
}

/**
 * 참여 기능 서버를 내 Cloudflare 계정에 만들고(있으면 그대로) 이 연수의 설정을 걸어 둠 → { url, key, created, account }.
 * 서버는 있는데 관리자 키를 아는 곳이 없으면(다른 PC에서 만듦) code 'key-unknown'으로 던짐 → 화면이 [새 키로 바꾸기]를 물은 뒤 rotate로 다시 부름.
 * known(url): 이 브라우저가 기억한 그 주소의 관리자 키(없으면 '')
 */
export async function ensureRelay({ code, settings, known, rotate = false, onView, signal }) {
  const out = await cfRun('relay', { adminKey: randomKey(20), rotate }, { onView, signal });
  const r = out.relay || {};
  if (!r.url) throw Object.assign(new Error('참여 기능 서버 주소를 받지 못했어요. 다시 눌러 주세요.'), { code: 'failed' });
  const key = r.key || (known ? await known(r.url) : '');
  const st = key ? await checkAdminKey(r.url, code, key, settings) : 'bad';
  if (st === 'bad') throw Object.assign(new Error('이 Cloudflare 계정에 참여 기능 서버가 이미 있는데, 이 PC는 그 관리자 키를 몰라요.'), { code: 'key-unknown', url: r.url });
  return { url: r.url, key, created: !!r.created, account: out.account?.name || '' };
}

/**
 * 실패를 화면 문구로: { t(까닭), action?(누를 곳 하나), kind } — retry(rotate?)는 다시 시작하는 함수.
 * 'cancelled'는 null(알림만). 'old'는 kind 'old'(화면이 [새 버전으로 바꾸기]를 그림)
 */
export function cfFail(e, retry) {
  const code = e?.code || '';
  if (code === 'cancelled') return null;
  if (code === 'old') return { kind: 'old', t: 'lecpage 커넥트를 새 버전으로 바꿔야 해요.' };
  if (code === 'key-unknown') return { kind: code, title: '참여 기능 서버가 이미 있어요.', t: e.message, more: '새 관리자 키로 바꾸면 그 서버를 그대로 써요. 예전 연수의 강사 화면에는 새 키로 다시 들어가요.', action: { label: '새 키로 바꾸고 계속', onClick: () => retry(true) } };
  if (code === 'name-taken') return { kind: code, t: e.message };
  return { kind: code || 'failed', t: e?.message || 'Cloudflare에서 끝내지 못했어요. 잠시 뒤 다시 시도해 주세요.', action: { label: '다시 시도', onClick: () => retry(false) } };
}
