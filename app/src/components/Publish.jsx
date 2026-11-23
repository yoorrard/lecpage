import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Dialog, Progress } from './ui.jsx';
import { Steps, ClickShot } from './Steps.jsx';
import { E } from '../lib/engine.js';
import { deployGitHub, deployNetlify, deployVercel, deployInstant, deleteInstant, instantFit, instantLiveOpen, forgetRecords, openNetlify, undeployVercel, undeployNetlify, undeployGitHub, instantInfo, instantLiveOk, instantGate, instantShare, instantRecords, recordsLine, openVercel, checkToken, tokenLooksWrong, siteStat, vercelName, vercelConfig, PUBLISH_API, GITHUB_TOKEN_URL, NETLIFY_TOKEN_URL, VERCEL_TOKEN_URL } from '../lib/deploy.js';
import { loadKey, saveKey, forgetKey } from '../lib/ai.js';
import { toast, randomKey, sha256Hex, copy } from '../lib/util.js';
import { liveSettings, pingLive, adminKeyFor, rememberServer, forgetServer } from './LiveSetup.jsx';
import { useCfWay, CfProgress, CfGetConnect, ensureRelay, cfFail } from './CfConnect.jsx';
import { OneClickCard, RunFail, useRun } from './OneClick.jsx';
import { ConnectUpdate } from './PcConnect.jsx';
import { cfRun, cfUpload, cfCancel, cfUsed, markCfUsed, CF_NAME_RE, CF_RELAY } from '../lib/cf-connect.js';
import { useVcWay, VcProgress, vcFail, NfProgress, nfFail } from './HostLogin.jsx';
import { vcRun, vcUpload, vcCancel, vcUsed, markVcUsed } from '../lib/vc-connect.js';
import { netlifyLogin, netlifyLoginOn } from '../lib/netlify-login.js';
import { reach } from '../lib/netcheck.js';
import { deployView, hasSiteScripts } from '../lib/site-meta.js';
import { hostProblems } from '../lib/host-check.js';

const DOCS = 'https://github.com/yoorrard/lecpage/blob/main/skills/lecpage/references/deploy';
// 앱에서 고를 수 있는 곳(엔진 HOSTS의 id). 'lecpage'(바로 배포)는 운영자가 켜 둔 앱에서만 보임
export const TARGETS = ['lecpage', 'vercel', 'github-pages', 'cloudflare', 'netlify', 'zip'];
export const LABEL = { lecpage: '바로 배포', vercel: 'Vercel', 'github-pages': 'GitHub Pages', netlify: 'Netlify', cloudflare: 'Cloudflare', zip: 'ZIP 다운로드' };
export const KIND = { vercel: 'vercel', 'github-pages': 'github', netlify: 'netlify' };
// 고른 곳마다 한 줄 소개(lead)와 알아 둘 점(care). 숫자·약관 근거: docs/research/hosting-2026-11.md, 2026-11-12에 공식 문서로 다시 확인
const ABOUT = {
  lecpage: { lead: '가입이나 토큰 없이 lecpage 주소로 배포해요.' },
  vercel: { lead: '토큰 하나로 배포하고, 다시 배포해도 주소가 그대로예요.', one: 'Vercel 로그인 한 번으로 배포하고, 다시 배포해도 주소가 그대로예요.' },
  'github-pages': { lead: '토큰으로 배포하고, 다시 배포해도 주소가 그대로예요.', care: '저장소가 공개돼서 사이트 파일을 누구나 볼 수 있어요.' },
  cloudflare: { lead: '받은 ZIP을 끌어다 놓아요. 방문이 많아도 멈추지 않아요.', one: 'Cloudflare 로그인 한 번으로 사이트와 참여 기능을 함께 배포해요. 방문이 많아도 멈추지 않아요.', get: 'lecpage 커넥트를 켜면 Cloudflare 로그인 한 번으로 사이트와 참여 기능을 함께 배포해요. 방문이 많아도 멈추지 않아요.' },
  netlify: { lead: '토큰으로 배포하고, 다시 배포해도 주소가 그대로예요.', one: 'Netlify 로그인 한 번으로 배포하고, 다시 배포해도 주소가 그대로예요.', care: '참가자가 로그인 없이 열 수 있게 첫 배포 때 Netlify의 접근 제한을 자동으로 풀어요. 무료로 한 달에 20번쯤 배포할 수 있어요.', limit: '무료 몫을 다 쓰면 그달은 사이트가 멈춰요. Netlify에서 충전하면 이어져요.' },
  zip: { lead: '기관 서버·NAS·USB로 나눌 때 써요.' },
};
// 배포할 곳 목록에서 곳마다 지금 어떻게 연결하는지 한눈에(연결해 둔 곳은 '연결됨')
const WAY_BADGE = { login: '로그인 한 번', token: '토큰 붙여넣기', pc: 'lecpage 커넥트 필요', manual: 'ZIP 올리기' };
const slug = (d) => 'lecpage-' + (d || new Date().toISOString().slice(0, 10)).replace(/-/g, '') + '-' + Math.random().toString(36).slice(2, 5);
const nameHint = (p) => 'training-' + ((deployView(p)?.meta?.date || '').replace(/-/g, '') || 'site');
const sameUrl = (a, b) => String(a || '').replace(/^https?:\/\//, '').replace(/\/+$/, '') === String(b || '').replace(/^https?:\/\//, '').replace(/\/+$/, '');
// 바로 배포 서버가 넘길 곳(next)의 이름 → 앱의 배포할 곳. 참여 기능(liveNext)은 Cloudflare(무료)·Supabase
const NEXT_ID = { cloudflare: 'cloudflare', vercel: 'vercel', github: 'github-pages', netlify: 'netlify' };
const LIVE_NEXT = { cloudflare: 'Cloudflare(무료)', supabase: 'Supabase' };
export const liveNames = (next) => (next || []).map((n) => LIVE_NEXT[n]).filter(Boolean).join('나 ') || LIVE_NEXT.cloudflare;
/**
 * 바로 배포의 참여 기능 방이 차서 참여 기능만 강사 계정으로 넘긴 기록. { reason, day, next, at } 또는 null.
 * 그날 방이 참(booked)은 연수 날짜가 같은 동안, 오늘 붐빔(방 상한 등)은 오늘(한국 오전 9시까지)만
 */
export const lecLiveOff = (p) => {
  const o = p?.deploy?.lecpage?.liveOff;
  if (!o || o.day !== (deployView(p)?.meta?.date || '')) return null;
  return o.reason === 'booked' || Math.floor((o.at || 0) / 864e5) === Math.floor(Date.now() / 864e5) ? o : null;
};
/** 바로 배포가 참여 기능 방을 맡지 못할 때 한 줄: 사이트는 바로 배포 그대로, 참여 기능만 강사 계정으로(liveNext 순서) */
export const liveOffLine = (o) => `${o.reason === 'booked' ? '그날은' : '오늘은'} 바로 배포의 참여 기능 방이 다 찼어요. 사이트는 바로 배포 그대로 두고, 참여 기능만 내 ${liveNames(o.next)}로 연결해 주세요.`;

/** 배포할 곳의 토큰(이 탭 또는 '기억하기'를 켠 기기에만). 한 번 연결해 두면 다음부터는 버튼 하나 */
export function useToken(kind) {
  const [token, setToken] = useState('');
  const [remember, setRemember] = useState(true);
  const [saved, setSaved] = useState(false);
  useEffect(() => { loadKey('deploy-' + kind).then(({ key, remembered }) => { if (key) { setToken(key); setRemember(remembered); setSaved(true); } }); }, [kind]);
  return { token, setToken, remember, setRemember, saved, save: async (tok = token) => { await saveKey('deploy-' + kind, tok, remember); setToken(tok); setSaved(true); }, forget: async (quiet) => { await forgetKey('deploy-' + kind); setToken(''); setSaved(false); if (quiet !== true) toast('연결을 끊었어요.'); } };
}

/**
 * 이미 연결해 둔 곳: 토큰이 있는 곳(그 id) + 커넥트로 배포해 본 곳('cloudflare-pc'·'vercel-pc').
 * 커넥트로 써 본 곳은 로그인이 그 PC의 커넥트에 있어, 커넥트가 켜져 있을 때만 '연결됨'으로 침(pcConnected)
 */
export async function connectedTargets() {
  const out = [];
  for (const [id, kind] of Object.entries(KIND)) { const { key } = await loadKey('deploy-' + kind); if (key) out.push(id); }
  if (cfUsed()) out.push('cloudflare-pc');
  if (vcUsed()) out.push('vercel-pc');
  return out;
}
/** connectedTargets()의 답을 지금 커넥트 상태로 걸러 '지금 [배포하기]만 누르면 되는 곳'으로 */
const pcConnected = (list, cfReady, vcReady) => [...new Set(list.map((h) => (h === 'cloudflare-pc' ? (cfReady ? 'cloudflare' : '') : h === 'vercel-pc' ? (vcReady ? 'vercel' : '') : h)).filter(Boolean))];

/**
 * 토큰 만드는 순서(배포하기 화면과 설정의 '연결'이 같이 씀). 버튼·칸 이름은 그 사이트 화면에 나오는 영문 그대로.
 * 2026-11-12 공식 문서 확인: Vercel(vercel.com/kb/guide/how-do-i-use-a-vercel-api-access-token), GitHub(fine-grained 토큰 주소 미리 채우기), Netlify(API 시작하기)
 */
export const HOST_GUIDE = {
  vercel: {
    name: 'Vercel', site: 'Vercel', label: 'Vercel 토큰', placeholder: 'vcp_…',
    signup: 'https://vercel.com/signup', join: '메일이나 GitHub 계정으로 가입해요.',
    tokenUrl: VERCEL_TOKEN_URL, open: '토큰 페이지 열기',
    make: <>이름에 <b>lecpage</b>를 적고 <b>Scope</b>는 <b>Full Account</b>, <b>Expiration</b>(기한)을 고른 뒤 <b>Create</b>를 눌러요.</>,
    shot: { rows: [['Token Name', 'lecpage'], ['Scope', 'Full Account'], ['Expiration', '기한 고르기']], btn: 'Create' },
  },
  github: {
    name: 'GitHub Pages', site: 'GitHub', label: 'GitHub 토큰', placeholder: 'github_pat_…',
    signup: 'https://github.com/signup', join: '가입하고 메일 인증까지 마쳐요.',
    tokenUrl: GITHUB_TOKEN_URL, open: '토큰 만들기 열기',
    make: <><b>Repository access</b>에서 <b>All repositories</b>를 고르고 맨 아래 <b>Generate token</b>을 눌러요. 나머지 칸은 채워져 있어요.</>,
    shot: { rows: [['Repository access', '◉ All repositories']], btn: 'Generate token' },
  },
  netlify: {
    name: 'Netlify', site: 'Netlify', label: 'Netlify 토큰', placeholder: 'nfp_…',
    signup: 'https://app.netlify.com/signup', join: '메일이나 GitHub 계정으로 가입해요.',
    tokenUrl: NETLIFY_TOKEN_URL, open: '토큰 페이지 열기',
    make: <><b>New access token</b>을 누르고 이름에 <b>lecpage</b>를 적어요. <b>Expiration</b>(기한)을 고른 뒤 <b>Generate token</b>을 눌러요.</>,
    shot: { pre: 'New access token', rows: [['Description', 'lecpage'], ['Expiration', '기한 고르기']], btn: 'Generate token' },
  },
};

/**
 * 연결: 가입 → 토큰 만들기 → 붙여넣기를 한 단계씩. [붙여넣기]를 누르면 토큰이 맞는지 바로 확인하고 연결해요.
 * 연결 뒤에는 한 줄만 보여요.
 */
function Connect({ t, kind, onConnected, onChange }) {
  const g = HOST_GUIDE[kind];
  const [at, setAt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [back, setBack] = useState(false); // 토큰 페이지에 다녀옴 → [붙여넣기]를 눈에 띄게
  const went = useRef(false);
  useEffect(() => {
    const f = () => { if (went.current) { went.current = false; setBack(true); } };
    window.addEventListener('focus', f); return () => window.removeEventListener('focus', f);
  }, []);
  // 연결이 끊기면(직접 끊음·토큰 기한이 지남) 계정은 이미 있으니 '토큰 만들기'부터 보여 줌
  const was = useRef(false);
  useEffect(() => { if (was.current && !t.saved) { setAt(1); setErr(''); } was.current = t.saved; }, [t.saved]);
  async function take(text) {
    const v = String(text || '').trim(); t.setToken(v); setBack(false);
    const bad = tokenLooksWrong(v); if (bad) { setErr(bad); return; }
    setErr(''); setBusy(true);
    try { await checkToken(kind, v); await t.save(v); toast(`${g.name}에 연결했어요.`); onConnected?.(); onChange?.(); }
    catch (e) { setErr(e.message || '토큰을 확인하지 못했어요.'); }
    setBusy(false);
  }
  async function paste() {
    let text;
    try { text = await navigator.clipboard.readText(); }
    catch { setErr('입력 칸을 누르고 Ctrl+V(맥은 ⌘V)로 붙여 넣어 주세요.'); return; }
    take(text);
  }
  if (t.saved) return <p class="small conn-line"><span class="ok-dot" aria-hidden="true" />{g.name}에 연결돼 있어요. <button type="button" class="btn btn-sm btn-quiet" onClick={async () => { await t.forget(); onChange?.(); }}>연결 해제</button></p>;
  const steps = [
    { t: `${g.site} 가입하기`, next: '이미 가입했어요',
      body: <p><a class="btn btn-sm btn-primary" href={g.signup} target="_blank" rel="noopener" onClick={() => setAt(1)}>가입 페이지 열기</a> {g.join}</p> },
    { t: '토큰 만들기', next: false,
      body: <>
        <p>{g.make}</p>
        <ClickShot {...g.shot} />
        <div><a class="btn btn-sm btn-primary" href={g.tokenUrl} target="_blank" rel="noopener" onClick={() => { went.current = true; setAt(2); }}>{g.open}</a></div>
      </> },
    { t: '토큰 붙여넣기',
      body: <>
        <p>{back ? '토큰을 복사했다면 ' : '나온 토큰을 복사하고 돌아와 '}<b>[붙여넣기]</b>를 눌러요. 토큰은 한 번만 보여요.</p>
        <div class="row token-row">
          <input class="input" type="password" autoComplete="off" spellcheck={false} aria-label={g.label} value={t.token} placeholder={g.placeholder}
            onInput={(e) => { t.setToken(e.target.value.trim()); setErr(''); }}
            onPaste={(e) => { const x = e.clipboardData?.getData('text'); if (x) { e.preventDefault(); take(x); } }}
            onKeyDown={(e) => e.key === 'Enter' && t.token && take(t.token)} />
          <button type="button" class={`btn btn-sm btn-primary${back ? ' attn' : ''}`} disabled={busy} aria-busy={busy ? 'true' : undefined} onClick={paste}>{busy ? '확인하는 중…' : '붙여넣기'}</button>
        </div>
        {t.token && !busy && <div><button type="button" class="btn btn-sm" onClick={() => take(t.token)}>연결</button></div>}
        {err && <p class="small err" role="alert">{err}</p>}
        <label class="check small"><input type="checkbox" checked={t.remember} onChange={(e) => t.setRemember(e.target.checked)} /><span>이 기기에서 기억하기 <span class="muted">공용 PC에서는 끄세요.</span></span></label>
        <p class="small muted">토큰은 이 브라우저에서 {g.site}로만 가요. lecpage 운영자는 볼 수 없어요.</p>
      </> },
  ];
  return <Steps steps={steps} at={at} onAt={(i) => { setAt(i); setErr(''); }} label={`${g.name} 연결 순서`} />;
}

/** 배포하다가 토큰이 틀렸거나 기한이 지난 것을 알면: 저장한 토큰을 지워 연결 순서(토큰 만들기)가 다시 보이게 함. true면 알림을 띄웠음 */
function tokenGone(e, t, refresh) {
  if (e.status !== 401 && !/토큰이 맞지 않거나|토큰에 권한이 모자라요/.test(e.message || '')) return false;
  t.forget(true).then(() => refresh?.()); toast('배포하지 못했어요. ' + e.message); return true;
}

/** 주소 이름: 앞뒤 글자를 붙여 완성된 주소 모양으로 보여 줌 */
function AddrName({ label = '주소 이름', optional, pre, post, value, onInput, placeholder, hint, invalid, max = 60 }) {
  return (
    <label class="field addr-name"><span>{label}{optional && <span class="small muted"> (선택)</span>}</span>
      <span class="affix">{pre && <span class="affix-t">{pre}</span>}
        <input value={value} onInput={(e) => onInput(e.target.value)} placeholder={placeholder} maxLength={max} autoComplete="off" autoCapitalize="off" spellcheck={false} aria-invalid={invalid ? 'true' : undefined} />
        {post && <span class="affix-t">{post}</span>}</span>
      {hint && <small>{hint}</small>}
    </label>
  );
}
const cleanName = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+/, '');

const Go = ({ on, busy, again, onClick, disabled, name = '배포하기' }) => (
  <div class="btn-row"><button class="btn btn-primary btn-lg" disabled={disabled || !!busy} aria-busy={on ? 'true' : undefined} onClick={onClick}>{on ? '배포하는 중…' : again ? '다시 배포하기' : name}</button></div>
);

/**
 * 배포하기: 배포할 곳을 추천해 고르고, 버튼 하나로 배포합니다.
 * buildFiles(opts) → { files }, guard(run, auto, kind): 참여 기능 연결 전이면 먼저 물어봄(kind 'zip': 사이트 ZIP 다운로드), done(url, patch): 주소 저장.
 * again: { current } 지난번에 배포한 곳에 바로 다시 배포하는 함수를 여기에 걸어 둠(성공 카드의 [다시 배포하기]가 부름). 못 하면 null
 */
export function Publish({ p, busy, setBusy, prog, setProg, buildFiles, guard, done, zip, again, goNow, onTarget, records, freshRoom, liveNote, onTry }) {
  const [connectedAll, setConnected] = useState([]); // 토큰이 있는 곳 + 커넥트로 써 본 곳(커넥트가 켜져 있는지는 아래 connected에서 거름)
  const [instant, setInstant] = useState(null);
  const [instantOff, setInstantOff] = useState(null); // 바로 배포를 지금 못 쓰는 까닭 { t, next? }(자리가 참·닿지 않음)
  // 이 기기의 오늘 남은 새 사이트 몫(모르면 null). 서버가 횟수를 새로 세기 시작했으면(quota가 바뀜) 적어 둔 몫은 버림
  const share = useMemo(() => instantShare(Date.now(), instant ? instant.quota : undefined), [instant]);
  // 인터넷이 끊겼으면(오프라인) 되는 길(사이트 파일 받기)만. 다시 이어지면 바로 배포 서버에 다시 물음
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine !== false);
  useEffect(() => {
    const on = () => setOnline(true); const off = () => setOnline(false);
    addEventListener('online', on); addEventListener('offline', off);
    return () => { removeEventListener('online', on); removeEventListener('offline', off); };
  }, []);
  // 바로 배포 서버의 답(/api/info)을 받기 전에는 배포할 곳을 정하지 않음: 먼저 끝난 망 확인(막힌 곳이 바로 실패하는 학교망)이
  // 바로 배포를 건너뛴 곳으로 못 박지 않게. 답은 늦어도 8초 안에 정해지므로(instantInfo가 8초에 그만둠) 그때까지 기다림: 전에는 3초 뒤 나머지를 먼저 보여 줘서
  // 서버가 잠깐 느릴 때(새 판을 올린 직후 등) 다른 곳의 큰 버튼이 떴다가 답이 오면 바로 배포로 바뀌었음(누를 곳이 눈앞에서 바뀜). 8.5초는 답이 끝내 정해지지 않을 때의 안전망
  const [infoWait, setInfoWait] = useState(!!PUBLISH_API);
  const first = useRef(true);
  useEffect(() => {
    let off = false;
    connectedTargets().then((c) => { if (!off) setConnected(c); });
    const t = setTimeout(() => { if (!off) setInfoWait(false); }, 8500);
    // false: 바로 배포를 켠 앱인데 이 망에서 서버에 닿지 않음
    instantInfo(!first.current).then((i) => { if (off) return; setInstant(i || (PUBLISH_API ? false : null)); setInfoWait(false); clearTimeout(t); });
    first.current = false;
    return () => { off = true; clearTimeout(t); };
  }, [online]);
  const [netBad, setNetBad] = useState({}); // 이 망에서 API에 닿지 않는 배포할 곳(토큰으로 배포하는 곳만 확인)
  const cfWay = useCfWay(); // lecpage 커넥트로 Cloudflare에 한 번에 배포할 수 있는지
  const vcWay = useVcWay(); // lecpage 커넥트로 Vercel에 로그인 한 번으로 배포할 수 있는지
  // 커넥트로 써 본 곳은 커넥트가 켜져 있을 때만 '연결됨'(꺼져 있으면 '커넥트 필요'로, 순서도 뒤로)
  const connected = useMemo(() => pcConnected(connectedAll, cfWay.way === 'ready', vcWay.way === 'ready'), [connectedAll, cfWay.way, vcWay.way]);
  // 곳마다 지금 되는 연결 방법: 'on'(연결해 둠: [배포하기]만) · 'login'(로그인 한 번) · 'token'(토큰을 만들어 붙여 넣음) · 'pc'(lecpage 커넥트를 켜면 로그인 한 번) · 'manual'(ZIP을 직접 올림) · ''(ZIP 받기)
  const wayOf = (h) => (connected.includes(h) ? 'on'
    : h === 'cloudflare' ? (cfWay.way === 'ready' ? 'login' : cfWay.way === 'mobile' ? 'manual' : 'pc')
      : h === 'netlify' ? (netlifyLoginOn() ? 'login' : 'token')
        : h === 'vercel' ? (vcWay.way === 'ready' ? 'login' : 'token')
          : h === 'github-pages' ? 'token' : '');
  // 쉬운 곳이 먼저: 연결해 둔 곳과 사이트·참여 기능을 함께 올리는 Cloudflare(커넥트) → 로그인 한 번 → 토큰 → 직접 올리기. 같은 쉬움 안에서는 엔진이 권한 순서 그대로
  const ease = (h) => ({ on: 0, login: h === 'cloudflare' ? 0 : 1, token: 2, pc: 3, manual: 3 }[wayOf(h)] ?? 4);
  // 붐빔 단계(서버의 capacity): 이미 배포한 사이트는 붐벼도 다시 배포가 되고, 새 사이트만 내 계정으로 넘김. 평소에는 아무 줄도 없음
  const lec = p.deploy?.lecpage;
  const hasSite = !!(lec?.id && lec.expiresAt && (instant?.keepAlive !== false || lec.expiresAt > Date.now()));
  const gate = instant ? instantGate(instant, { hasSite, date: deployView(p)?.meta?.date || '', start: deployView(p)?.meta?.start || '', share }) : null;
  // 이 바로 배포 서버가 사이트 스크립트를 받지 않는데(/api/info siteScripts:false, worker 보기) AI가 쓴 사이트에 스크립트가 있으면 처음부터 내 계정 쪽으로
  const noScripts = !!instant && instant.siteScripts === false && hasSiteScripts(p);
  const live = gate?.ok && !instantOff && !noScripts ? instant : null;
  const full = instantOff?.t || (noScripts ? '이 바로 배포 서버는 사이트가 직접 쓴 스크립트(움직임·탭 같은 동작)를 받지 않아요. 내 계정에 배포하면 그대로 올라가요.' : instant && !gate.ok ? gate.note : '');
  // 넘길 때는 서버가 준 순서(next)로. 이미 연결해 둔 곳이 있으면 그곳이 먼저(같은 파일을 버튼 하나로)
  const nextHosts = live ? [] : (instantOff?.next?.length ? instantOff.next : instant?.capacity?.next || []).map((h) => NEXT_ID[h]).filter(Boolean);
  // previous: 지난번에 배포한 곳(사이트를 삭제했으면 없음: '다시 배포하면 주소가 그대로'가 맞지 않음)
  const rec = useMemo(() => E.decideHost({ skill: 'click', commercial: p.info?.commercial, network: p.info?.network, previous: !p.deploy?.lastUrl || ((instantOff || noScripts) && p.deploy?.target === 'lecpage') ? '' : p.deploy?.target, connected, instant: live ? (live.view === 'pages' ? 'pages' : live.plan === 'paid' ? 'stable' : 'limited') : false, size: p.info?.size }), [p.info?.commercial, p.info?.network, p.info?.size, p.deploy?.target, !!p.deploy?.lastUrl, connected.join(), live?.plan, live?.view, !!instantOff, noScripts]);
  const usable = TARGETS.filter((h) => (h !== 'lecpage' || live) && (h !== 'vercel' || rec.hosts.includes('vercel') || p.deploy?.target === 'vercel'));
  // 바로 배포가 켜져 있으면 첫째(가입·토큰 없이 참여 기능까지). 다른 곳에 배포한 적이 있으면 그곳이 먼저(주소가 그대로)
  const prevHost = p.deploy?.target && p.deploy.target !== 'lecpage' && usable.includes(p.deploy.target) ? [p.deploy.target] : [];
  // 바로 배포를 못 써 넘길 때도 '지금 이 기기에서 버튼 하나로 되는 곳'이 먼저(커넥트가 켜져 있으면 Cloudflare, 꺼져 있으면 브라우저 로그인 한 번인 Netlify). 서버가 준 순서(next)는 같은 쉬움 안에서만 따름
  const nextAt = (h) => { const i = nextHosts.indexOf(h); return i < 0 ? 99 : i; };
  const ranked = [...new Set([...rec.hosts.filter((h) => usable.includes(h)), ...usable])].filter((h) => h !== 'lecpage').map((h, i) => [h, i]).sort((a, b) => ease(a[0]) - ease(b[0]) || (nextHosts.length ? nextAt(a[0]) - nextAt(b[0]) : 0) || a[1] - b[1]).map((x) => x[0]);
  const order = [...new Set([...prevHost, ...(live ? ['lecpage'] : []), ...ranked, ...usable])];
  // 추천: 이 망에서 닿는 첫째 곳. 망 확인은 고른 곳을 바꾸지 않고(약한 고름) 추천만 비켜 가게 해서, 바로 배포·지난번 곳이 늦게 와도 그쪽을 따름
  const best = order.find((h) => !netBad[h]) || order[0];
  const [picked, setPicked] = useState(''); // 강사가 직접 고른 곳(망 확인·늦은 답으로 바꾸지 않음)
  const [cancel, setCancel] = useState(''); // 배포 취소 확인 창(배포한 곳 id)
  useEffect(() => { const on = (e) => { if (p.deploy?.sites?.[e.detail] || (e.detail === 'lecpage' && p.deploy?.lecpage?.id)) { cancelFrom.current = document.activeElement; setCancel(e.detail); } }; addEventListener('lp-undeploy', on); return () => removeEventListener('lp-undeploy', on); });
  const [more, setMore] = useState(false); // 다른 곳에 배포하기(배포할 곳 목록 펼치기)
  const chosen = picked && order.includes(picked) ? picked : best;
  // 완료 카드의 [다른 곳에도 배포]·[바로 배포로도 배포]: 배포할 곳을 바꿔 이 칸으로 내려옴(이미 배포한 곳이 아닌 곳을 먼저)
  const ev = useRef(); ev.current = { order, sites: p.deploy?.sites || {}, live: !!live, busy: !!busy };
  useEffect(() => {
    const on = (e) => {
      if (ev.current.busy) return; // 배포가 도는 동안에는 배포할 곳을 바꾸지 않음(도는 카드가 사라지면 진행·물음·[중지]도 사라짐)
      const { order: o, sites } = ev.current;
      const others = o.filter((h) => h !== 'lecpage');
      const to = e.detail === 'lecpage' ? (o.includes('lecpage') ? 'lecpage' : '') : (others.find((h) => !sites[h]) || others[0] || '');
      if (to) { setPicked(to); setMore(to !== 'lecpage'); }
      setTimeout(() => document.getElementById('pub-h')?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 30);
    };
    window.addEventListener('lp-pub-pick', on);
    return () => window.removeEventListener('lp-pub-pick', on);
  }, []);
  // 끊긴 동안은 사이트 파일 받기만 됨. 다만 배포가 도는 중에 끊기면 그 카드를 그대로 둠(진행·물음·[중지]가 사라지지 않게. 실패하면 그 카드가 까닭을 보여 줌)
  const offline = !online && !busy;
  const target = offline ? 'zip' : chosen;
  useEffect(() => { if (!infoWait) onTarget?.(target); }, [target, infoWait]);
  const skipped = !picked && order[0] !== best && netBad[order[0]] ? order[0] : ''; // 막혀서 건너뛴 첫째 곳
  // 바로 배포를 못 쓰는 까닭(full)은 그 대신 저절로 고른 곳(내 계정에 배포)에서만: 직접 고른 곳·ZIP·지난번에 배포한 곳에 다시 배포할 때는 상관없음
  const fullHere = !picked && target !== 'zip' && !(p.deploy?.lastUrl && target === p.deploy?.target);
  const moved = skipped ? `이 망에서 ${LABEL[skipped]}에 닿지 않아 ${LABEL[best]}로 바꿨어요. 휴대폰 핫스팟으로 바꾸면 ${LABEL[skipped]}에도 배포할 수 있어요.` : '';
  // 고른 곳의 API가 이 망에서 막혔는지(요청 한 번). 막혔으면 추천이 다음 곳으로 비켜 감. 핫스팟으로 바꾸면 3분 뒤 다시 확인
  useEffect(() => {
    if (!KIND[target] || infoWait) return undefined;
    let off = false;
    reach('host:' + target).then((s) => { if (!off && s === 'blocked') setNetBad((b) => ({ ...b, [target]: true })); });
    return () => { off = true; };
  }, [target, infoWait]);
  /**
   * 한 곳에 배포하기: 사이트 만들기 → 그곳의 한도 확인 → 배포하기. up(files, setProg, rebuild)가 주소를 저장. onFail(e)가 true면 알림을 띄우지 않음.
   * rebuild(o): auto(바로 배포의 참여 기능)를 빼고 다시 만든 파일(그날 참여 기능 방이 차서 강사 계정으로 넘길 때)
   */
  const start = (id, up, onFail, auto = null, asked = null) => { const go = async (opts = {}) => {
    setBusy(id); setProg({ step: '사이트 만드는 중', pct: 1 });
    try {
      const view = live?.view || '';
      const r = await buildFiles({ ...opts, ...(auto || {}), target: id, view });
      // 바로 배포는 서버가 알려 준 한도(/api/info)로 봄(엔진의 곳별 표는 다른 곳용). 큰 교재 원본은 buildFiles가 이미 뺐음
      const chk = id === 'lecpage' && instant?.limits ? instantFit(siteStat(r.files), instant.limits) : id === 'lecpage' ? { ok: true, errors: [] } : E.checkHost(id, siteStat(r.files));
      // 크기 때문에 못 올리는 것은 다시 눌러도 같으므로 '다시 해도 같은 거절'로(바로 배포 카드가 [다른 곳에 배포]로 이끎)
      if (!chk.ok) throw Object.assign(new Error(chk.errors[0]), id === 'lecpage' ? { code: 'too_large' } : {});
      await up(r.files, setProg, async (o = {}) => (await buildFiles({ ...opts, ...o, target: id, view })).files);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { if (!onFail?.(e)) toast('배포하지 못했어요. ' + e.message); }
    setBusy(''); setProg(null);
  };
  // asked: 참여 기능을 어떻게 할지 이미 물어 답을 받았음(Netlify는 로그인 전에 물음) → 또 묻지 않음
  return asked ? go(asked) : guard(go, !!auto?.live); };
  // 누른 버튼이 '배포하는 중'으로 잠기면 초점을 잃음 → 진행 줄로 옮김(키보드·화면 읽기 프로그램이 이어서 읽고, 좁은 화면에서는 진행 줄이 보이게 따라감)
  useEffect(() => {
    if (!busy) return undefined;
    const t = setTimeout(() => { const a = document.activeElement; if (!a || a === document.body || a.disabled || !a.isConnected) document.querySelector('.publish .run-box, .publish .pub-prog')?.focus(); }, 40);
    return () => clearTimeout(t);
  }, [busy]);
  // 배포 취소 창을 닫으면 연 버튼으로 초점을 돌려줌(그 버튼이 사라졌으면 이 칸의 제목으로)
  const cancelFrom = useRef(null);
  const closeCancel = () => { setCancel(''); setTimeout(() => { const b = cancelFrom.current; (b && b.isConnected ? b : document.getElementById('pub-h'))?.focus(); }, 60); };
  // 무료 한도를 넘으면 어떻게 되는지(고른 곳마다 한 줄)
  const H = E.HOSTS[target] || {};
  // Cloudflare: 커넥트가 켜져 있으면 로그인 한 번으로 사이트와 참여 기능 서버를 함께 → 참여 기능을 따로 연결하라는 안내(LiveNote) 대신 카드 안의 한 줄
  const cfOne = target === 'cloudflare' && cfWay.way === 'ready';
  const cfLive = cfOne && !!liveNote?.need && !liveNote.lecOnly;
  // 커넥트가 없거나 꺼져 있고 직접 올린 적도 없음: 카드가 '커넥트 켜기' 하나를 권함(켜면 사이트와 참여 기능 서버를 함께) → 안내도 그 하나로(ZIP 설명·'참여 기능을 따로 연결' 안내를 겹쳐 보이지 않음. 접힌 직접 배포로 가면 ZIP을 받을 때 물음)
  const cfGet = target === 'cloudflare' && ['none', 'off', 'old'].includes(cfWay.way) && !(p.deploy?.cloudflare?.url && p.deploy.cloudflare.via !== 'connect');
  // 로그인 한 번으로 되는 곳은 그 말로 소개(엔진의 추천 까닭은 토큰 기준이라 맞지 않음)
  const oneLead = cfOne ? ABOUT.cloudflare.one : cfGet ? ABOUT.cloudflare.get : wayOf(target) === 'login' || (target === 'vercel' && vcWay.way === 'ready' && vcUsed()) ? ABOUT[target]?.one || '' : '';
  const lead = `${oneLead || (target === rec.pick ? rec.reasons[0] : ABOUT[target]?.lead || H.note_ko)}${rec.warnings[0] && target === rec.pick ? ` ${rec.warnings[0]}` : ''}`;
  // 서버 보기가 Pages면 사이트는 하루 한도와 상관없이 열리고, 무료 서버에서 멈출 수 있는 것은 참여 기능뿐
  const limit = target === 'lecpage' ? (live?.view === 'pages' ? (live.plan === 'paid' ? '' : '사이트는 늘 열려요. 무료 서버라 참여 기능은 붐비는 날 멈출 수 있어요.') : live?.plan === 'paid' ? H.atLimit_ko : H.atLimitFree_ko) : ABOUT[target]?.limit || H.atLimit_ko;
  // 소개 줄에 이미 나온 말(같은 문장이나 '멈추지 않아요'·'늘 열려요'처럼 같은 뜻)은 되풀이하지 않음
  const limitLine = !limit || lead.includes(limit) ? '' : /멈추지 않|늘 열려/.test(lead) ? limit.replace(/^사이트는 늘 열려요\.\s*/, '') : limit;
  const showLimit = true; // 무료 한도를 넘으면 어떻게 되는지는 늘 미리(writing.md 비용 규칙)
  const days = instant?.limits?.days || 30;
  const care = target === 'lecpage' ? `${instant?.keepAlive === false ? `배포한 날부터 ${days}일 뒤 지워져요(다시 배포하면 그날부터 ${days}일).` : `${days}일 동안 아무도 오지 않으면 지워져요.`} 사이트 파일이 lecpage 서버에 저장되니 남의 저작물이나 개인정보가 없는지 확인해 주세요.` : ABOUT[target]?.care;
  if (again) again.current = null;
  if (goNow) goNow.current = null;
  const ctx = {
    p, busy, start, setBusy, done: (url, patch, more) => { done(url, { ...patch, target }, more); connectedTargets().then(setConnected); },
    refresh: () => connectedTargets().then(setConnected), // 연결하거나 끊은 뒤 '연결됨' 표시를 맞춤
    bind: (fn) => { if (again) again.current = fn && target === p.deploy?.target ? fn : null; if (goNow) goNow.current = fn || null; },
  };
  if (infoWait) return <div class="stack publish"><p class="small muted" role="status" aria-live="polite">배포할 곳을 확인하는 중…</p></div>;
  if (offline) {
    return (
      <div class="stack publish">
        <p class="small net-line" role="status">인터넷이 끊겨 있어요. 연결되면 배포할 수 있어요. 지금은 사이트 파일(ZIP)만 받을 수 있어요.</p>
        <Manual {...ctx} guard={guard} zip={zip} kind="zip" key="zip" />
        {prog && <div class="stack pub-prog" tabIndex={-1}><Progress pct={prog.pct} /><span class="small muted" aria-live="polite">{prog.step}</span></div>}
      </div>
    );
  }
  // 바로 배포를 지금 못 쓰면(오늘 몫을 다 씀·서버가 거절·이 망에서 막힘·오늘 자리가 참) 카드를 감추지 않고 누를 수 없게 + 까닭과 할 일 한 줄
  const instantWhy = !live && PUBLISH_API && instant !== null && !infoWait ? (full || (instant === false ? '이 망에서 바로 배포 서버에 닿지 않아요. 휴대폰 핫스팟으로 바꾸면 쓸 수 있어요.' : '')) : '';
  return (
    <div class="stack publish">
      {instantWhy && <div class="pub-now pub-modes" role="group" aria-label="배포 방법">
        <button type="button" class="pub-mode pub-mode-main is-off" aria-disabled="true" aria-describedby="pub-instant-why" onClick={() => document.getElementById('pub-instant-why')?.focus()}>
          <span class="pub-mode-h"><b>바로 배포</b><em>지금은 쓸 수 없어요</em></span>
          <small id="pub-instant-why" tabIndex={-1}>{instantWhy}{/내 계정/.test(instantWhy) ? '' : ' 아래에서 다른 곳에 배포하면 같은 파일 그대로예요.'}</small>
        </button>
        <div class="pub-mode is-on">
          <span class="pub-mode-h"><b>다른 곳에 배포</b></span>
          <small>{order.filter((h) => h !== 'lecpage').map((h) => LABEL[h]).join(' · ')}</small>
        </div>
      </div>}
      {instantWhy ? null : live && order.includes('lecpage')
        ? <div class="pub-now pub-modes" role="group" aria-label="배포 방법">
          <button type="button" class={`pub-mode pub-mode-main${target === 'lecpage' ? ' is-on' : ''}`} aria-pressed={String(target === 'lecpage')} disabled={!!busy} onClick={() => { setPicked('lecpage'); setMore(false); }}>
            <span class="pub-mode-h"><b>바로 배포</b>{best === 'lecpage' && <em>추천</em>}</span>
            <small>{instantLiveOpen(live, deployView(p)?.meta?.date || '') ? '가입 없이 · 참여 기능까지 바로 켜져요' : '가입 없이 · 주소가 바로 나와요'}</small>
          </button>
          <button type="button" class={`pub-mode${target !== 'lecpage' ? ' is-on' : ''}`} aria-pressed={String(target !== 'lecpage')} aria-expanded={String(more || target !== 'lecpage')} aria-controls="pub-pick" disabled={!!busy} onClick={() => { if (target === 'lecpage') { setPicked(order.find((h) => h !== 'lecpage') || ''); } setMore(true); }}>
            <span class="pub-mode-h"><b>다른 곳에 배포</b></span>
            <small>{order.filter((h) => h !== 'lecpage').map((h) => LABEL[h]).join(' · ')}</small>
          </button>
        </div>
        : null}
      {(more || target !== 'lecpage' || !(live && order.includes('lecpage'))) && <div class="pub-pick" id="pub-pick" role="radiogroup" aria-label="배포할 곳">
        {order.filter((id) => id !== 'lecpage' || !live).map((id) => (
          <label class="pub-opt" key={id}><input type="radio" name="pub-target" checked={target === id} disabled={!!busy && target !== id} onChange={() => { setPicked(id); }} />
            <span><b>{LABEL[id]}</b>{id === best && <em>추천</em>}{id === 'lecpage' && id !== best && <em>가입 없이</em>}{p.deploy?.sites?.[id] && <i>배포됨</i>}{wayOf(id) === 'on' ? <i>연결됨</i> : WAY_BADGE[wayOf(id)] && <i class="way">{WAY_BADGE[wayOf(id)]}</i>}{netBad[id] && <i class="net-bad">이 망에서 막힘</i>}</span></label>
        ))}
      </div>}
      {target !== 'lecpage' && liveNote && !cfLive && !(cfGet && !liveNote.lecOnly) && <LiveNote note={liveNote} where={target} instant={!!(live && order.includes('lecpage') && instantLiveOpen(live, deployView(p)?.meta?.date || ''))} onInstant={() => { setPicked('lecpage'); setMore(false); setTimeout(() => document.querySelector('.pub-mode-main')?.focus(), 60); }} />}
      {/* 같은 곳에 다시 배포할 때는 소개·한도·알아 둘 점을 되풀이하지 않음(처음 배포할 때 봤고, 보관 기간은 위 완료 카드에 있음) */}
      {!(p.deploy?.lastUrl && target === p.deploy?.target) && <div class="pub-about">
        <p>{lead}</p>
        {((showLimit && limitLine) || care) && <dl class="pub-facts small">
          {showLimit && limitLine && <div class="pub-limit"><dt>무료 한도</dt><dd>{limitLine}</dd></div>}
          {care && <div><dt>알아 둘 점</dt><dd>{care}</dd></div>}
        </dl>}
      </div>}
      {full && fullHere && !instantWhy && <p class="small" role="status">{full}{/내 계정/.test(full) ? '' : ' 내 계정에 배포하면 같은 파일 그대로예요.'}</p>}
      {moved && <p class="small net-line" role="status">{moved}</p>}
      {instant === false && !instantWhy && <p class="small muted net-line">이 망에서 바로 배포 서버에 닿지 않아요. 휴대폰 핫스팟으로 바꾸면 쓸 수 있어요.</p>}
      {netBad[target] && !moved && <p class="small net-line" role="status">이 망에서 {LABEL[target]}에 닿지 않아요. 배포하다 멈출 수 있어요. 휴대폰 핫스팟으로 바꾸거나 다른 곳을 골라 주세요.</p>}
      {target === 'lecpage' && <Instant {...ctx} info={instant} gate={gate} freshRoom={freshRoom} onTry={onTry} onUnavailable={(why) => { setInstantOff(why); setPicked(''); }} />}
      {cancel && <Undeploy p={p} target={cancel} info={instant} records={records} done={done} onClose={closeCancel} />}
      {target === 'vercel' && <Vercel {...ctx} vcWay={vcWay} />}
      {target === 'github-pages' && <GitHub {...ctx} />}
      {target === 'netlify' && <Netlify {...ctx} guard={guard} />}
      {target === 'cloudflare' && <Cloudflare {...ctx} guard={guard} zip={zip} cfWay={cfWay} withLive={cfLive} />}
      {target === 'zip' && <Manual {...ctx} guard={guard} zip={zip} kind="zip" key="zip" />}
      {/* 진행 줄은 누른 버튼 바로 아래(좁은 화면에서도 버튼과 한 화면에) */}
      {prog && <div class="stack pub-prog" tabIndex={-1}><Progress pct={prog.pct} /><span class="small muted" aria-live="polite">{prog.step}</span></div>}
    </div>
  );
}

/** 직접 올린 곳의 주소 → 사이트 폴더 주소(…/index.html처럼 파일로 끝나면 그 폴더. QR·강사 화면 주소가 '…/index.html/'이 되지 않게) */
const siteDir = (u) => {
  const t = String(u || '').trim().split('#')[0].split('?')[0];
  try { const x = new URL(t); if (/\/[^/]+\.[a-z0-9]{2,5}$/i.test(x.pathname)) { x.pathname = x.pathname.replace(/[^/]*$/, ''); return x.href; } } catch { /* 주소 모양이 아니면 그대로 */ }
  return t.replace(/\/?$/, '/');
};

/**
 * 다른 곳(Vercel·GitHub Pages·Netlify·Cloudflare·ZIP)에 배포할 때 참여 기능 안내: 배포할 곳을 고른 바로 그 자리에서.
 * 이런 곳은 사이트 파일만 올려 주므로 질문·투표·출석의 답을 모을 서버를 따로 연결해야 함(바로 배포는 lecpage 서버가 맡음).
 * 할 일은 셋: 바로 배포로 바꾸기(가장 쉬움) · 참여 기능 연결 · 참여 기능 없이 배포
 */
function LiveNote({ note, where, instant, onInstant }) {
  const zip = where === 'zip', name = LABEL[where] || where;
  const box = useRef(null), was = useRef(note.skip);
  // [참여 기능 없이 배포]·[다시 켜기]를 누르면 그 버튼이 사라지므로 초점을 바뀐 자리로 옮김(키보드·화면 읽기 프로그램)
  useEffect(() => {
    if (was.current === note.skip) return; was.current = note.skip;
    const a = document.activeElement; if (a && a !== document.body && box.current?.contains(a)) return;
    box.current?.querySelector(note.skip ? '.pub-live-skip button' : '#pub-live-h')?.focus();
  }, [note.skip]);
  const title = note.lecOnly ? `${zip ? 'ZIP으로 직접 올린' : name} 사이트에서는 참여 기능이 꺼져요`
    : zip ? 'ZIP으로 직접 올리면 참여 기능을 따로 연결해야 해요' : `${name}에서는 참여 기능을 따로 연결해야 해요`;
  return (
    <div ref={box} aria-live="polite">
      {note.skip ? <p class="small pub-live-skip" role="status">참여 기능 없이 배포해요. <button type="button" class="btn-link small" onClick={note.onUnskip}>다시 켜기</button></p>
        : note.need && (
          <div class="pub-live" role="note" aria-labelledby="pub-live-h">
            <b id="pub-live-h" tabIndex={-1}>{title}</b>
            <p class="small">{note.lecOnly
              ? '참여 기능은 바로 배포한 사이트에서만 돼요. 참가자에게는 지금처럼 바로 배포 주소를 알려 주세요.'
              : `연결하지 않으면 질문·투표·출석이 모이지 않아요.${instant ? ' 바로 배포는 연결하지 않아도 돼요.' : ''}`}</p>
            <div class="btn-row">
              {instant && !note.lecOnly && <button type="button" class="btn btn-sm" onClick={onInstant}>바로 배포로 바꾸기</button>}
              <button type="button" class="btn btn-sm" onClick={note.onConnect}>참여 기능 연결</button>
              <button type="button" class="btn btn-sm btn-quiet" onClick={note.onSkip}>참여 기능 없이 배포</button>
            </div>
          </div>
        )}
    </div>
  );
}

/**
 * 강사가 연결한 참여 기능 서버를 바로 배포한 사이트에서도 쓸 수 있는지(lib/deploy.js, 서버 hosting/src/csp.js liveKind와 같은 규칙).
 * 강사 계정 서버(*.workers.dev·*.supabase.co·구글 시트)는 늘, 자기 도메인 서버(https 공개 도메인)는 서버가 /api/info ownLive로 받는다고 할 때만
 */
export { instantLiveOk };

/** 배포한 곳의 기록 칸 이름(p.deploy.<이름>) */
const DEPLOY_KEY = { lecpage: 'lecpage', vercel: 'vercel', 'github-pages': 'github', netlify: 'netlify', cloudflare: 'cloudflare', zip: 'zip' };
/**
 * 배포 취소: 배포한 곳 하나를 실제로 내림. 바로 배포는 사이트를 지우고(주소에 '강사가 사이트를 내렸어요'), Vercel·Netlify는 이 연수가 만든 프로젝트·사이트를 지우고,
 * GitHub Pages는 Pages를 끔(저장소는 내 GitHub에 남음). 직접 올린 곳(Cloudflare·ZIP)은 앱이 내릴 수 없어 목록에서만 뺌. 연수와 만든 사이트는 그대로라 다시 배포할 수 있음
 */
function Undeploy({ p, target, info, records, done, onClose }) {
  const d = p.deploy || {}; const bp = deployView(p);
  const lec = target === 'lecpage' ? d.lecpage : null;
  // Cloudflare: lecpage 커넥트로 올린 사이트는 커넥트가 실제로 지움(커넥트가 꺼져 있으면 직접 올린 곳처럼 목록에서만)
  const { way } = useCfWay();
  const cfSite = target === 'cloudflare' && d.cloudflare?.via === 'connect' && d.cloudflare.name ? d.cloudflare : null;
  const viaCf = !!cfSite && way === 'ready';
  // Vercel: lecpage 커넥트로 올린 프로젝트는 커넥트가 지움(커넥트가 꺼져 있으면 연결해 둔 토큰으로, 토큰도 없으면 커넥트를 켜라고 안내)
  const vc = useVcWay();
  const vcSite = target === 'vercel' && d.vercel?.via === 'connect' && d.vercel.name ? d.vercel : null;
  const viaVc = !!vcSite && vc.way === 'ready';
  const kind = KIND[target]; const manual = !lec && !kind && !viaCf;
  const cfRelay = viaCf && bp.live?.provider === 'http' && String(bp.live?.url || '').includes(CF_RELAY); // 이 연수가 내 Cloudflare의 참여 기능 서버를 씀
  const [withRelay, setWithRelay] = useState(false);
  const [listOnly, setListOnly] = useState(false); // 커넥트가 '내가 올린 사이트가 아니에요'라고 함(다른 PC에서 올림) → 목록에서만 삭제
  const label = LABEL[target] === 'ZIP 다운로드' ? '직접 올린 곳' : LABEL[target] || target;
  const url = String(d.sites?.[target]?.url || lec?.url || '');
  const lecUrl = info?.live?.url || '';
  const [rec, setRec] = useState(lec ? records || null : null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  // 커넥트가 지우는 동안의 진행(로그인이 풀려 있으면 브라우저 승인을 기다림): 한 줄 + 로그인 창 열기·물음 + [중지]
  const R = useRun();
  useEffect(() => () => R.cancel(), []); // 창이 사라지면(다른 단계로 감) 기다리던 일도 멈춤
  // 지우기 전 확인이므로 기억해 둔 수(15초)를 쓰지 않고 지금 수를 새로 물음(방금 올라온 글이 빠진 수로 확인하지 않게)
  useEffect(() => { if (lec?.id) { forgetRecords(lec.id); instantRecords(lec).then((r) => r && setRec(r)); } }, []);
  const recLine = recordsLine(rec);
  const hasRoom = !!lec && (!!lec.adminKey || !!rec?.live); // 이 사이트에 참여 기능 방이 있음(기록이 지워짐)
  const siteUrl = url.replace(/\/?$/, '/');
  async function go() {
    setBusy(true); setErr('');
    try {
      let more = null, gone = false;
      if (lec) {
        // 서버에 이미 없는 사이트(먼저 취소했거나 보관 기간이 끝남 — 404): 주소는 이미 닫혀 있으므로 실패가 아님. 목록에서 지우고 그렇게 알림
        try { await deleteInstant(lec); } catch (e) { if (e.status !== 404) throw e; gone = true; }
        if (lec.adminKey && bp.live?.provider === 'http' && sameUrl(bp.live?.url, lecUrl)) more = { live: { provider: 'local', url: '', anonKey: '' }, liveOk: false };
      } else if (viaCf && !listOnly) {
        const out = await R.run(({ onView, signal }) => cfRun('delete', { name: cfSite.name, relay: cfRelay && withRelay }, { onView, signal }));
        if (out === undefined) { setBusy(false); return; } // 이미 도는 중(겹쳐 누름): 지웠다고 적지 않음
        if (out.relay) { forgetServer(bp.live.url); more = { live: { provider: 'local', url: '', anonKey: '' }, liveOk: false }; }
      } else if (viaVc && !listOnly) {
        const out = await R.run(({ onView, signal }) => vcRun('delete', { name: vcSite.name }, { onView, signal }));
        if (out === undefined) { setBusy(false); return; }
      } else if (kind && !listOnly) {
        const { key: token } = await loadKey('deploy-' + kind);
        if (!token && vcSite) throw new Error('lecpage 커넥트가 꺼져 있어 여기서 내릴 수 없어요. 커넥트를 켠 뒤 다시 눌러 주세요.');
        if (!token) throw new Error(`${label} 토큰이 이 브라우저에 없어요. 창을 닫고 아래 [다른 곳에 배포]에서 ${label} 토큰을 다시 연결한 뒤 눌러 주세요.`);
        // 커넥트로 올린 프로젝트(다른 팀일 수 있음)를 토큰으로 지울 때는 '없음(404)'을 '이미 지워짐'으로 넘기지 않음: 팀이 다르면 404인데 사이트는 그대로 열림
        if (target === 'vercel') await undeployVercel({ token, projectId: d.vercel?.projectId || d.vercel?.name || '', strict: !!vcSite });
        else if (target === 'netlify') await undeployNetlify({ token, siteId: d.netlify?.siteId || '' });
        else await undeployGitHub({ token, repo: d.github?.repo || '' });
      }
      done('', { target, [DEPLOY_KEY[target] || target]: null, ...(lec ? { lecpageTry: null } : {}) }, more);
      toast(gone ? '이미 내려간 사이트예요. 배포한 곳 목록에서 삭제했어요.' : manual || listOnly ? '배포한 곳 목록에서 삭제했어요.' : '배포를 취소했어요. 이 주소는 더 열리지 않아요.');
      onClose();
    } catch (e) {
      try { console.warn('[lecpage] 배포 취소 실패', { target, status: e.status ?? '', code: e.code || '' }); } catch { /* 기록만 */ }
      if (e.code === 'cancelled') { setBusy(false); return; } // [중지]: 까닭을 띄울 일이 아님
      if ((viaCf || viaVc) && e.code === 'not-ours') setListOnly(true);
      // 커넥트로 올린 Vercel 프로젝트를 토큰으로 찾지 못함: 커넥트를 켜는 것이 할 일. Vercel에서 이미 지웠다면 목록에서만 삭제할 수 있게 버튼을 바꿈
      const vcMiss = !!vcSite && !viaVc && e.status === 404;
      if (vcMiss) setListOnly(true);
      setErr(vcMiss ? '연결해 둔 토큰으로는 이 프로젝트를 찾지 못했어요(lecpage 커넥트로 다른 팀에 배포한 프로젝트일 수 있어요). lecpage 커넥트를 켠 뒤 이 창을 다시 열어 주세요. Vercel에서 이미 지웠다면 아래 [목록에서 삭제]를 눌러 주세요.'
        : viaCf || viaVc ? e.message || '배포를 취소하지 못했어요. 잠시 뒤 다시 해 주세요.' : e.status === 401 || e.status === 403 ? `${label} 토큰의 권한이 모자라거나 기한이 지났어요. 아래 [다른 곳에 배포]에서 다시 연결한 뒤 눌러 주세요.` : e.message || '배포를 취소하지 못했어요. 잠시 뒤 다시 해 주세요.');
      setBusy(false);
    }
  }
  return (
    <Dialog open onClose={() => { if (!busy) onClose(); }} label="배포 취소 확인">
      <h2 class="h-sub">{manual ? '배포한 곳 목록에서 삭제할까요?' : lec ? '바로 배포를 취소할까요?' : `${label} 배포를 취소할까요?`}</h2>
      {url && <p class="small"><b>{label}</b> · <span style={{ wordBreak: 'break-all' }}>{url}</span></p>}
      {manual
        ? <p>{cfSite ? 'lecpage 커넥트가 꺼져 있어 여기서 내릴 수 없어요. 커넥트를 켠 뒤 다시 눌러 주세요. Cloudflare 대시보드에서 사이트를 지웠다면 이 목록에서 삭제해 주세요.' : '직접 배포한 곳은 여기서 내릴 수 없어요. 배포한 곳에서 사이트를 지운 뒤 이 목록에서 삭제해 주세요.'}</p>
        : <p>{lec ? "주소와 QR이 바로 끊기고 되돌릴 수 없어요. 참가자에게는 '강사가 사이트를 내렸어요'가 보여요." : target === 'github-pages' ? '이 주소가 더 열리지 않아요. 저장소와 파일은 내 GitHub에 남아요.' : `이 주소가 더 열리지 않아요. 내 ${label}에서 이 사이트가 지워져요.`}</p>}
      <p class="small">연수와 만든 사이트는 그대로 남아 언제든 다시 배포할 수 있어요.</p>
      {cfRelay && <label class="check"><input type="checkbox" checked={withRelay} disabled={busy} onChange={(e) => setWithRelay(e.target.checked)} /><span>참여 기능 서버도 삭제 <span class="small muted">내 Cloudflare 계정에서 이 서버를 쓰는 다른 연수의 참여 기능과 기록도 함께 지워져요. 이수 처리에 쓸 출석·설문은 먼저 강사 화면에서 CSV로 받아 두세요.</span></span></label>}
      {hasRoom && <p>참가자가 남긴 기록{recLine ? `(${recLine})` : '(출석·질문·보드·설문)'}도 함께 지워져요. 이수 처리에 쓸 출석·설문은 먼저 강사 화면에서 CSV로 받아 두세요.</p>}
      {viaCf && <CfProgress view={R.view} onCancel={R.cancel} />}
      {viaVc && <VcProgress view={R.view} onCancel={R.cancel} />}
      {err && <p class="notice bad" role="alert">{err}</p>}
      <div class="btn-row">
        <button class="btn btn-quiet" data-autofocus disabled={busy} onClick={onClose}>닫기</button>
        {hasRoom && <a class="btn" href={siteUrl + 'console.html'} target="_blank" rel="noopener" onClick={() => lec.adminKey && copy(lec.adminKey, '관리자 키를 복사했어요. 강사 화면에 붙여 넣으세요.')}>강사 화면 열기</a>}
        <button class="btn btn-danger" disabled={busy} onClick={go}>{busy ? '취소하는 중…' : manual || listOnly ? '목록에서 삭제' : '배포 취소'}</button>
      </div>
    </Dialog>
  );
}

// 다시 해도 같은 답인 거절(hosting: 413 too_large·too_many_files, 400 bad_path·bad_type, blocked). 까닭은 서버 문구 그대로
const FINAL_REFUSAL = ['too_large', 'too_many_files', 'bad_path', 'bad_type', 'blocked'];
/** lecpage 바로 배포: 가입·토큰 없이. 운영자가 켜 둔 앱에서만. 참여 기능도 서버가 받으면 따로 연결할 것 없이 함께 켜짐 */
function Instant({ p, busy, start, done, bind, info, gate, freshRoom, onUnavailable, onTry }) {
  const prev = p.deploy?.lecpage;
  const [refused, setRefused] = useState(null); // 바로 배포가 거절한 까닭 { t: 서버 문구 그대로, pre: 올리기 전에 미리 본 것 }
  const [failed, setFailed] = useState(null); // 배포를 끝내지 못함 { t: 까닭, how: 할 일 }(까닭을 화면에 남기고 [다시 배포]로 이어 감)
  // 방문이 있으면 서버가 보관 기간을 늘리므로, 저장해 둔 날짜가 지났어도 배포한 적이 있으면 '있는 사이트'로 봄(지워졌으면 배포할 때 새 주소로 만듦)
  const alive = !!(prev?.id && prev.expiresAt);
  const bp = deployView(p);
  const liveOn = (bp.live?.features || []).length > 0;
  const lecUrl = info?.live?.url || '';
  const days = info?.capacity?.siteDays || info?.limits?.days || 30;
  // 강사가 따로 연결한 참여 기능 서버(이 바로 배포 서버가 아닌 것). 한 번 확인에 실패했어도(liveOk) 강사가 고른 연결은 덮어쓰지 않음.
  // 바로 배포한 사이트가 실제로 닿을 수 있는 서버(hosting/src/csp.js liveKind와 같은 규칙, 자기 도메인은 서버가 ownLive일 때)일 때만 그 서버를 씀
  const own = instantLiveOk(bp.live, info) && !sameUrl(bp.live.url, lecUrl);
  const liveOff = lecLiveOff(p); // 바로 배포의 참여 기능 방이 차서 넘긴 적이 있음 → 강사가 연결한 서버가 있으면 그것으로
  // 참여 기능을 이 서버가 맡음(방이 차면 서버가 알려 주고 뺌). 강사가 따로 연결한 서버가 있으면 그것을 그대로 씀(연결을 바로 배포 방으로 덮어쓰지 않게)
  const autoLive = liveOn && !!lecUrl && !own;
  // newCode: 연수 코드가 다른 사이트와 겹쳤을 때, 또는 지난 기록을 비우고 배포할 때(freshRoom) 새로 정한 코드.
  // 사이트를 그 코드로 다시 만들어 올리고 방을 새로 묶음(서버가 예전 코드의 방을 비움). 주소·관리자 키는 그대로
  const run = (newCode = freshRoom && autoLive ? E.randomCode() : '', retried = false) => start('lecpage', async (files, onProgress, rebuild) => {
    // 서버가 거절할 내용은 올리기 전에 같은 규칙(hosting/src/sitecheck.js)으로 미리 봄: 파일을 헛되이 올리지 않고 바로 알려 줌
    const bad = hostProblems(files);
    if (bad.length) throw Object.assign(new Error(bad.slice(0, 2).map((x) => x.message_ko).join(' ')), { code: 'unsafe_site', pre: true });
    let live = null, adminKey = prev?.adminKey || '';
    if (autoLive) {
      if (!adminKey) adminKey = randomKey(20);
      live = { code: newCode || bp.live.code, adminKeyHash: await sha256Hex(adminKey), settings: liveSettings(bp) };
    }
    // 연수 날짜·인원: 서버가 그날 몫을 미리 셈(차면 지금 알려 줌)
    const m = bp.meta || {};
    const booking = m.date ? { date: m.date, start: m.start || '', end: m.end || '', people: p.info?.size || 30, network: p.info?.network || 'good', live: autoLive } : null;
    // 그날 참여 기능 방이 차면 사이트는 그대로 배포: 강사가 연결한 서버가 있으면 그것으로, 없으면 참여 기능을 뺀 사이트로(연결한 뒤 다시 배포)
    setFailed(null);
    const out = await deployInstant({ site: prev, tryKey: p.id, tried: p.deploy?.lecpageTry || null, onTry, title: p.title, files, live, booking, onProgress, onLiveOff: () => rebuild(own ? {} : { liveOff: true }) });
    const lecLive = autoLive && !out.liveOff;
    const off = out.liveOff ? { ...out.liveOff, at: Date.now() } : !lecLive && liveOff && own ? liveOff : null; // 연결한 서버로 넘긴 동안은 그대로 기억
    const wasLec = bp.live?.provider === 'http' && sameUrl(bp.live?.url, lecUrl);
    done(out.url, { lecpageTry: null, lecpage: { id: out.id, key: out.key, url: out.url, expiresAt: out.expiresAt, ...(out.altUrl ? { altUrl: out.altUrl, view: out.view } : {}), ...(lecLive ? { adminKey } : prev?.adminKey ? { adminKey: prev.adminKey } : {}), ...(info?.keepAlive === false ? { fixed: true } : {}), // fixed: 보관 기간이 정해진 서버(방문으로 늘지 않음)
      ...(off ? { liveOff: off } : {}), ...(out.advice || (prev?.longTerm && prev.id === out.id) ? { longTerm: true } : {}) } },
    lecLive ? { live: { provider: 'http', url: out.liveUrl || lecUrl, anonKey: '', ...(newCode ? { code: newCode } : {}) }, liveOk: true }
      : out.liveOff && wasLec ? { live: { provider: 'local', url: '', anonKey: '' }, liveOk: false } : null);
    toast(out.liveOff && !own ? '배포했어요. 참여 기능은 따로 연결해 주세요.' : prev?.id === out.id ? (newCode && !retried && freshRoom ? '지난 기록을 비우고 같은 주소에 다시 배포했어요.' : '같은 주소에 다시 배포했어요.') : prev?.id ? '보관 기간이 끝나 새 주소로 배포했어요. 새 주소와 QR을 다시 보내 주세요.' : '배포했어요.');
  }, (e) => {
    if (e.code === 'code_taken' && !retried) { setTimeout(() => run(E.randomCode(), true), 0); return true; }
    // 받을 수 없는 내용(422 unsafe_site: 비밀번호 칸·로그인 흉내·바깥 양식 등): 서버 문구(message_ko)를 그대로 화면에 두고 고칠 길을
    if (e.code === 'unsafe_site') { setRefused({ t: e.message, pre: !!e.pre }); return true; }
    // 사이트 스크립트를 받지 않는 보기(422 script_not_allowed): 내 계정에 배포하는 길로
    if (e.code === 'script_not_allowed') { onUnavailable?.({ t: `${e.message} 내 계정에 배포하면 그대로 올라가요.` }); return true; }
    // 붐빔(서버가 까닭을 줌: 오늘 모두 / 이 기기·이 인터넷만)·저장 공간이 참: 서버 문구 그대로 두고 내 계정에 배포하는 길로(넘길 곳은 서버가 준 순서).
    // 줄 서기(pages_api)는 deployInstant가 이미 기다렸다가 다시 했음. 까닭 없는 rate_limited(이 사이트를 너무 자주 올림)는 알림만
    if ((e.reason && e.reason !== 'pages_api') || e.code === 'full') { onUnavailable?.({ t: e.message, next: e.next }); return true; }
    // 그 밖(인터넷이 끊김·서버 오류·파일을 다 못 올림 등): 다른 곳으로 말없이 넘기지 않고 까닭과 할 일을 화면에 남김. 만들던 사이트는 그대로 두어 [다시 배포]가 이어서 함
    // 다시 해도 같은 거절(사이트가 너무 큼·파일이 너무 많음·받지 않는 경로나 형식·막힌 내용): 서버 문구만 보이고 [다른 곳에 배포]로
    if (e.status === 413 || FINAL_REFUSAL.includes(e.code)) { setFailed({ t: e.message || '바로 배포가 이 사이트를 받지 않았어요.', how: '', final: true }); return true; }
    const again = '[다시 배포]를 누르면 올린 데부터 이어서 해요.';
    setFailed(e.status === 0 ? { t: e.message, how: e.blocked ? '' : `인터넷이 다시 연결되면 ${again}` }
      : e.status >= 500 ? { t: '바로 배포 서버가 지금 응답하지 못해 배포가 멈췄어요.', how: `잠시 뒤 ${again}` }
      : e.code === 'missing_blobs' ? { t: '파일을 다 올리지 못했어요.', how: again }
      : e.code === 'runtime_mismatch' ? { t: e.message, how: '' }
      : { t: e.message || '배포를 끝내지 못했어요.', how: again });
    return true;
  },
  autoLive ? { live: { provider: 'http', url: lecUrl, anonKey: '', ...(newCode ? { code: newCode } : {}) }, processor: { name: 'lecpage 운영자(바로 배포 서버 · Cloudflare)', contact: 'hello@lecpage.com', country: '미국 등 Cloudflare 데이터센터가 있는 국가', /* copy-ok: 개인정보 처리방침 표의 칸(법률 문서라 명사형). 참여 기록의 보관 기간은 안내 3(마지막 기록 뒤 N일, 늦어도 사이트와 함께) */ purpose: `강사를 대신해 사이트와 참여 기록 저장(사이트는 마지막 ${info?.keepAlive === false ? '배포' : '배포나 방문'} 뒤 ${days}일 보관)` } } : null);
  bind(failed?.final ? null : () => run()); // 다시 해도 같은 거절이면 맨 위 [배포하기]도 같은 거절을 되풀이하지 않게
  // 까닭 알림이 뜨면 그 알림으로 초점(지금 누를 곳이 그 안에 있음). 알림이 떠 있는 동안 아래 큰 [배포하기]는 감춤(큰 버튼은 하나만)
  const noteBox = useRef(null);
  useEffect(() => { if (refused || failed) noteBox.current?.focus(); }, [refused, failed]);
  const noted = !!refused || (!!failed && busy !== 'lecpage');
  const closeNote = () => { setRefused(null); setFailed(null); setTimeout(() => document.querySelector('.publish .btn-lg')?.focus(), 40); };
  return (
    <div class="stack">
      {gate?.note && busy !== 'lecpage' && <p class="small" role="status">{gate.note}</p>}
      {liveOn && liveOff && !own && <p class="small" role="status">{liveOffLine(liveOff)}</p>}
      {autoLive && !liveOff && !alive && instantLiveOpen(info, bp.meta?.date || '') && <p class="small">질문·보드 같은 참여 기능도 따로 연결할 것 없이 함께 켜져요. 참가자가 남긴 글·파일도 lecpage 서버에 저장돼요.</p>}
      {refused && <div role="alert" class="notice bad" tabIndex={-1} ref={noteBox}><div class="stack" style={{ gap: '6px' }}>
        <b>{refused.pre ? '바로 배포가 받지 않는 내용이 있어 올리지 않았어요.' : '바로 배포가 이 사이트를 받지 않았어요.'}</b>
        <span>{refused.t}</span>
        <span class="small">수정 화면의 꼭 고칠 곳에서 [AI로 수정]을 누르거나, 미리보기에서 직접 고친 뒤 다시 배포해 주세요.</span>
        <div class="btn-row"><a class="btn btn-sm btn-primary" href={`#/p/${p.id}/2`} onClick={() => { try { sessionStorage.setItem('lecpage:studio-tab', 'check'); } catch { } }}>수정하러 가기</a><button type="button" class="btn btn-sm btn-quiet" onClick={closeNote}>닫기</button></div>
      </div></div>}
      {failed && busy !== 'lecpage' && !refused && <div role="alert" class="notice bad" tabIndex={-1} ref={noteBox}><div class="stack" style={{ gap: '6px' }}>
        <b>{failed.final ? '바로 배포가 이 사이트를 받지 않았어요.' : '배포를 끝내지 못했어요.'}</b>
        <span>{failed.t}{failed.how ? ` ${failed.how}` : ''}</span>
        <span class="small">{failed.final ? '[다른 곳에 배포]로 같은 파일을 그대로 배포할 수 있어요.' : '계속 안 되면 [다른 곳에 배포]로 같은 파일을 그대로 배포할 수 있어요.'}</span>
        <div class="btn-row">{!failed.final && <button type="button" class="btn btn-sm btn-primary" onClick={() => { setFailed(null); setRefused(null); run(); }}>다시 배포</button>}<button type="button" class={`btn btn-sm${failed.final ? ' btn-primary' : ''}`} onClick={() => window.dispatchEvent(new CustomEvent('lp-pub-pick', { detail: 'other' }))}>다른 곳에 배포</button><button type="button" class="btn btn-sm btn-quiet" onClick={closeNote}>닫기</button></div>
      </div></div>}
      {!noted && <Go on={busy === 'lecpage'} busy={busy} again={!!alive} onClick={() => { setRefused(null); setFailed(null); run(); }} />}
      {gate?.hint && <p class="small muted">{gate.hint}</p>}
      {alive && <p class="small muted">다시 배포해도 주소는 그대로예요. <button type="button" class="btn btn-sm btn-quiet" aria-haspopup="dialog" onClick={() => window.dispatchEvent(new CustomEvent('lp-undeploy', { detail: 'lecpage' }))}>배포 취소</button></p>}
      {alive && prev.longTerm && !bp.meta?.date && <p class="small muted">오래 쓸 사이트면 내 계정에 배포하세요. 기간 제한이 없어요(바로 배포는 {days}일).</p>}
    </div>
  );
}

// 커넥트의 답: 그 이름이 이 PC의 커넥트가 올린 것이 아님(다른 PC에서 올렸거나, 남이 준 연수 파일에 적혀 온 이름) → 같은 이름의 사이트를 덮지 않음
const NOT_OURS = ['not-ours', 'exists'];
const notOursFail = (host, onNew, more = '') => ({ kind: 'not-ours', title: '같은 이름이 이미 있어요.', t: `이 ${host} 계정에 같은 이름의 사이트가 이미 있는데, 이 PC의 lecpage 커넥트로 배포한 것이 아니에요. 그 사이트를 덮지 않도록 멈췄어요.`, more: `다른 이름으로 배포하면 새 주소가 나와요.${more ? ` ${more}` : ''}`, action: { label: '다른 이름으로 배포', onClick: onNew } });
/**
 * 파일로 가져온 연수([같은 주소로 배포])에 적혀 온, 커넥트로 올린 곳의 이름에 처음 배포하기 전에 한 번 물음:
 * 이 PC가 로그인한 계정에 같은 이름의 다른 사이트가 있으면 그 사이트가 이 연수로 바뀌므로(남이 준 파일의 이름으로 내 사이트를 덮지 않게).
 */
function CarriedConfirm({ open, host, name, onSame, onNew, onClose }) {
  return (
    <Dialog open={open} onClose={onClose} label="가져온 주소 이름 확인">
      <h2 class="h-sub">가져온 주소 이름으로 배포할까요?</h2>
      <p>이 연수 파일에 적혀 온 주소 이름이 있어요: <b class="mono">{name}</b>. 이 PC가 로그인한 {host} 계정에 같은 이름의 사이트가 있으면 그 사이트가 이 연수로 바뀌어요.</p>
      <p class="small">내가 다른 기기에서 배포했던 연수라면 같은 이름으로 배포해 주소를 그대로 써요. 다른 사람이 준 파일이라면 다른 이름으로 배포해 주세요.</p>
      <div class="btn-row"><button class="btn" data-autofocus onClick={onNew}>다른 이름으로 배포</button><button class="btn btn-danger" onClick={onSame}>같은 이름으로 배포</button></div>
    </Dialog>
  );
}
/** 토큰으로 배포하다 난 실패를 카드 안에 까닭 + [다시 시도]로(다른 곳과 같은 모양). 토큰이 틀렸으면 tokenGone이 연결 순서를 다시 보여 줌 */
const deployFail = (e, retry) => ({ kind: e.code || 'failed', title: '배포하지 못했어요.', t: e.message || '잠시 뒤 다시 시도해 주세요.', ...(retry ? { action: { label: '다시 시도', onClick: retry } } : {}) });
const CancelLine = ({ id }) => <p class="small muted">다시 배포해도 주소는 그대로예요. <button type="button" class="btn btn-sm btn-quiet" aria-haspopup="dialog" onClick={() => window.dispatchEvent(new CustomEvent('lp-undeploy', { detail: id }))}>배포 취소</button></p>;

/**
 * Vercel: lecpage 커넥트가 켜져 있으면 [Vercel 계정으로 배포] 하나(처음에만 브라우저에서 로그인·허용, 공식 Vercel CLI) — 다음부터는 [다시 배포하기]만.
 * 토큰으로 연결해 둔 곳은 지금처럼 토큰으로([배포하기] 하나). 커넥트가 없으면 토큰 연결 순서가 먼저이고, 커넥트를 켜는 법은 접어 둠.
 */
function Vercel({ p, busy, start, done, bind, refresh, vcWay }) {
  const t = useToken('vercel');
  const { pc, way } = vcWay;
  const prev = p.deploy?.vercel;
  const mine = prev?.via === 'connect' && !!prev.name; // 커넥트로 올린 프로젝트(커넥트가 배포 보호를 끄고 지울 수 있음)
  const same = !!prev?.name; // 이 연수가 올린 프로젝트가 있음(같은 주소에 다시)
  const [name, setName] = useState(prev?.name || '');
  const [view, setView] = useState(null);
  const [fail, setFail] = useState(null);
  const [used, setUsed] = useState(() => vcUsed()); // 이 브라우저에서 커넥트로 Vercel에 배포해 봄 → '연결돼 있어요'와 [연결 해제]
  const [alt, setAlt] = useState(false); // 접힌 '다른 방법: 토큰으로 연결'
  const [fresh, setFresh] = useState(false); // 적어 둔 프로젝트 이름이 이 PC의 커넥트가 올린 것이 아님(가져온 연수 등) → 그 이름을 덮지 않고 새 이름으로
  const [opening, setOpening] = useState(false); // 커넥트로 [배포 보호 끄기] 하는 중(로그인이 풀려 있으면 승인을 기다림)
  const ctl = useRef(null);
  // 커넥트로 도는 중에 이 카드가 사라지면(다른 단계로 감 등) 멈춤: 떠난 뒤에 옛 내용으로 배포가 이어지지 않게, 커넥트도 기다리던 일을 접게
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; if (ctl.current) { ctl.current.abort(); vcCancel(); } }, []);
  const clean = vercelName(name);
  // 커넥트 길: 커넥트가 켜져 있고, 커넥트로 올린 프로젝트이거나 토큰을 연결해 두지 않았을 때
  const one = way === 'ready' && (mine || !t.saved);
  const tokenRun = () => { setFail(null); start('vercel', async (files, onProgress) => {
    const out = await deployVercel({ token: t.token, name: clean || slug(deployView(p)?.meta?.date), projectId: prev?.projectId, files, onProgress });
    done(out.url, { vercel: { projectId: out.projectId, name: out.name, url: out.url } });
    toast(prev && prev.url && out.url !== prev.url ? '지난 프로젝트가 Vercel에 없어 새 주소로 배포했어요. 새 주소와 QR을 다시 알려 주세요.' : prev ? '같은 주소에 다시 배포했어요.' : out.opened ? '배포했어요. 참가자가 로그인 없이 열 수 있게 Vercel의 배포 보호를 껐어요.' : '배포했어요.');
  }, (e) => { if (!tokenGone(e, t, refresh)) setFail(deployFail(e, e.code === 'exists' ? null : tokenRun)); return true; }); };
  const show = (e, retry) => {
    if (!alive.current) return;
    // 적어 둔 이름이 이 PC의 커넥트가 올린 프로젝트가 아님(다른 PC에서 올렸거나 가져온 연수): 같은 이름의 프로젝트를 덮지 않고 새 이름으로 배포하는 길 하나
    if (same && !fresh && NOT_OURS.includes(e?.code)) { setFail(notOursFail('Vercel', () => { setFresh(true); setName(''); setFail(null); }, mine ? '' : '토큰으로 배포했던 주소를 그대로 쓰려면 아래 [다른 방법: 토큰으로 연결]로 연결해 주세요.')); return; }
    // [토큰으로 연결]은 펼칠 토큰 순서가 있을 때만(커넥트로 올린 프로젝트에는 그 칸이 없음 → [다시 시도])
    const f = vcFail(e, { retry, onToken: mine ? undefined : () => { setFail(null); setAlt(true); } }); if (f) setFail(f); else toast('멈췄어요.');
    try { console.warn('[lecpage] Vercel 배포 실패', { code: e?.code || '' }); } catch { /* 기록만 */ }
  };
  // 파일로 가져온 연수에 적혀 온 이름(이 PC에서 배포한 적 없음): 그 이름에 배포하기 전에 한 번 물음
  const carried = mine && !!prev.carried && !fresh;
  const [ask, setAsk] = useState(false); const okCarry = useRef(false);
  function connectRun() {
    if (ctl.current) return;
    if (carried && !okCarry.current) { setAsk(true); return; }
    setFail(null);
    // 이 연수가 올린 프로젝트(커넥트로든 토큰으로든)가 있으면 그 프로젝트에 다시(주소가 그대로). 처음이면 적은 이름으로 새로
    const again = same && !fresh;
    const site = again ? prev.name : clean || slug(deployView(p)?.meta?.date);
    start('vercel', async (files, onProgress) => {
      const c = new AbortController(); ctl.current = c;
      try {
        // 토큰 길과 같은 파일: 사이트의 _headers는 Vercel 형식(vercel.json)으로 옮김
        const all = { ...files, 'vercel.json': vercelConfig(files) }; delete all._headers;
        const draft = await vcUpload(all, onProgress);
        if (c.signal.aborted) throw Object.assign(new Error('멈췄어요.'), { code: 'cancelled' }); // 파일을 건네는 동안 [중지]했거나 화면을 떠남
        onProgress({ step: 'Vercel에 배포하는 중', pct: 40 });
        const out = await vcRun('site', { draft, name: site, again }, { onView: (v) => { if (alive.current) setView(v); if (v.phase === 'wait') onProgress({ step: '주소 확인하는 중', pct: 90 }); }, signal: c.signal });
        markVcUsed(); setUsed(true); setFresh(false);
        done(out.site.url, { vercel: { projectId: out.site.projectId || '', name: out.site.name, url: out.site.url, via: 'connect' } });
        // 다른 팀·계정으로 로그인했으면 같은 이름이어도 주소가 달라짐: 그때는 '같은 주소'라고 하지 않음
        const moved = again && !!prev?.url && !sameUrl(out.site.url, prev.url);
        toast(moved ? '새 주소로 배포했어요. 새 주소와 QR을 다시 알려 주세요.' : again ? '같은 주소에 다시 배포했어요.' : out.site.opened ? '배포했어요. 참가자가 로그인 없이 열 수 있게 Vercel의 배포 보호를 껐어요.' : out.site.protected ? '배포했어요. 주소에 Vercel 로그인 창이 뜨면 아래 [배포 보호 끄기]를 눌러 주세요.' : '배포했어요.');
      } finally { ctl.current = null; if (alive.current) setView(null); }
    }, (e) => { show(e, connectRun); return true; });
  }
  const run = one ? connectRun : tokenRun;
  bind(one || t.saved ? run : null);
  async function unlock() {
    if (ctl.current || opening) return;
    try {
      if (one && mine) {
        // 커넥트 길: 로그인이 풀려 있으면 브라우저 승인을 기다리므로 진행·물음·[중지]를 카드에 그대로 보여 줌
        const c = new AbortController(); ctl.current = c; setOpening(true);
        try { await vcRun('open', { name: prev.name }, { onView: (v) => { if (alive.current) setView(v); }, signal: c.signal }); }
        finally { ctl.current = null; if (alive.current) { setView(null); setOpening(false); } }
      } else await openVercel(t.token, prev.projectId);
      toast('이제 로그인 없이 열려요.');
    } catch (e) { if (alive.current) toast(e?.code === 'cancelled' ? '멈췄어요.' : '바꾸지 못했어요. ' + e.message); }
  }
  async function signOut() {
    try { await vcRun('logout', {}); markVcUsed(false); setUsed(false); refresh?.(); toast('이 PC의 Vercel 로그인을 지웠어요.'); }
    catch (e) { toast(e.message || '연결을 해제하지 못했어요. 잠시 뒤 다시 해 주세요.'); }
  }
  const on = busy === 'vercel';
  const nameField = (!prev || fresh) && <AddrName optional pre="https://" post=".vercel.app" value={name} onInput={(v) => { setName(cleanName(v)); if (fail?.kind === 'name-taken' || fail?.kind === 'exists') setFail(null); }} placeholder={nameHint(p)} hint="영문 소문자·숫자·하이픈. 짧을수록 치기 쉬워요. 비워 두면 자동으로 정해요." />;
  const unlockLine = prev && !fresh && <p class="small muted">주소를 열면 Vercel 로그인 창이 뜨나요? <button type="button" class="btn btn-sm btn-quiet" disabled={on || opening} onClick={unlock}>{opening ? '바꾸는 중…' : '배포 보호 끄기'}</button></p>;
  if (one) {
    return (
      <OneClickCard
        note={used
          ? <p class="small conn-line"><span class="ok-dot" aria-hidden="true" />Vercel에 연결돼 있어요. <button type="button" class="btn btn-sm btn-quiet" disabled={on} onClick={signOut}>연결 해제</button></p>
          : <p class="small">처음 한 번만 브라우저에서 Vercel에 로그인(무료 가입)하고 허용해요. 로그인 정보는 이 PC에만 저장돼요. lecpage 운영자는 볼 수 없어요.</p>}
        fields={nameField}
        go={{ label: used ? '배포하기' : 'Vercel 계정으로 배포', again: same && used && !fresh, on, busy: busy || opening, onClick: connectRun }}
        progress={<VcProgress view={view} onCancel={() => { ctl.current?.abort(); vcCancel(); }} />}
        fail={fail && !on && (fail.kind === 'old' ? <ConnectUpdate pc={pc} /> : <RunFail fail={fail} onClose={() => setFail(null)} />)}
        foot={<>
          {mine && !fresh && !carried && <>{unlockLine}<CancelLine id="vercel" /></>}
          <CarriedConfirm open={ask} host="Vercel" name={prev?.name || ''} onClose={() => setAsk(false)} onSame={() => { okCarry.current = true; setAsk(false); connectRun(); }} onNew={() => { setAsk(false); setFresh(true); setName(''); }} />
        </>}
        alt={!mine && { label: '다른 방법: 토큰으로 연결', open: alt, onToggle: setAlt, body: <Connect t={t} kind="vercel" onChange={refresh} /> }} />
    );
  }
  // 토큰 길(연결해 뒀거나 커넥트가 없음). 커넥트를 켜면 로그인 한 번으로 된다는 것은 한 줄로 접어 둠
  const easier = !t.saved && (way === 'none' || way === 'off' || way === 'old');
  return (
    <div class="stack one-click">
      <Connect t={t} kind="vercel" onChange={refresh} />
      {t.saved && <>
        {nameField}
        <Go on={on} busy={busy} again={!!prev} onClick={tokenRun} />
      </>}
      {fail && !on && <RunFail fail={fail} onClose={() => setFail(null)} />}
      {t.saved && unlockLine}
      {easier && <details class="run-alt"><summary class="small">더 쉬운 방법: lecpage 커넥트를 켜면 로그인 한 번으로 돼요</summary><div class="run-alt-body"><CfGetConnect pc={pc} way={way} service="Vercel" what="배포돼요" /></div></details>}
    </div>
  );
}

function GitHub({ p, busy, start, done, bind, refresh }) {
  const t = useToken('github');
  const prev = p.deploy?.github;
  const [repo, setRepo] = useState(prev?.repo || slug(deployView(p)?.meta?.date));
  const [confirm, setConfirm] = useState(false);
  const [fail, setFail] = useState(null);
  const run = (allowExisting = false) => { setFail(null); start('github-pages', async (files, onProgress) => {
    const name = repo.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || slug();
    const out = await deployGitHub({ token: t.token, repo: name, files, onProgress, allowExisting: allowExisting || prev?.repo === name });
    done(out.url, { github: { repo: name, url: out.url } }); toast('GitHub Pages에 배포했어요. 처음에는 1~2분, 길면 10분 뒤에 열려요.');
  }, (e) => { if (e.code === 'exists') setConfirm(true); else if (!tokenGone(e, t, refresh)) setFail(deployFail(e, () => run(allowExisting))); return true; }); };
  bind(t.saved ? () => run() : null);
  const on = busy === 'github-pages';
  return (
    <div class="stack one-click">
      {!t.saved && <p class="small">처음 한 번만 GitHub 토큰을 만들어 붙여 넣어요. 다음부터는 [배포하기]만 눌러요.</p>}
      <Connect t={t} kind="github" onChange={refresh} />
      {t.saved && <>
        <AddrName label="저장소 이름" pre={`${(/^https?:\/\/([^/]+)\//.exec(prev?.url || '') || [])[1] || '내계정.github.io'}/`} value={repo} onInput={setRepo} hint="영문 소문자·숫자·하이픈. 주소에 들어가요." max={80} />
        <Go on={on} busy={busy} again={!!prev} onClick={() => run()} />
      </>}
      {fail && !on && <RunFail fail={fail} onClose={() => setFail(null)} />}
      {t.saved && prev?.repo && <CancelLine id="github-pages" />}
      <Dialog open={confirm} onClose={() => setConfirm(false)} label="저장소 덮어쓰기 확인">
        <h2 class="h-sub">이미 있는 저장소예요</h2>
        <p>"{repo}" 저장소가 이미 있어요. 배포하면 그 안의 파일이 모두 연수 사이트 파일로 바뀌어요. 다른 이름을 쓰는 게 안전해요.</p>
        <div class="btn-row"><button class="btn" data-autofocus onClick={() => { setConfirm(false); setRepo(slug(deployView(p)?.meta?.date)); }}>다른 이름 사용</button><button class="btn btn-danger" onClick={() => { setConfirm(false); run(true); }}>덮어쓰기</button></div>
      </Dialog>
    </div>
  );
}

/** 팝업 차단을 피하려고 버튼을 누른 그 순간 빈 창을 먼저 엶(주소는 로그인 준비가 끝나면 넣음). 막히면 null → 화면의 [로그인 창 열기]로 */
function openBlank(label) {
  try {
    const w = window.open('about:blank', '_blank');
    if (!w) return null; // opener는 끊지 않음: 끊으면 이 창에 주소를 넣거나 끝난 뒤 닫을 수 없음(여는 곳은 그 서비스의 공식 로그인 화면)
    try { w.document.title = label; w.document.body.textContent = `${label}…`; w.document.body.style.cssText = 'font:16px system-ui,sans-serif;padding:24px;color:#444'; } catch { /* 빈 창 그대로 */ }
    return w;
  } catch { return null; }
}
/**
 * Netlify 계정으로 연결(브라우저 로그인 한 번, lib/netlify-login.js). login(): 버튼을 누른 자리에서 불러야 함(창을 먼저 엶) → 토큰 | ''.
 * 받은 토큰은 토큰 붙여넣기와 같은 곳에 저장(t.save). onToken: 실패 안내의 [토큰으로 연결]이 열 곳
 */
function useNetlifyLogin(t, { onChange, onToken } = {}) {
  const r = useRun();
  const [fail, setFail] = useState(null);
  // 기다리는 동안 다른 곳을 고르거나 화면을 떠나면 로그인을 멈춤(떠난 뒤에 저절로 배포가 시작되지 않게)
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; r.cancel(); }, []);
  async function login(after) { // after(token): 연결된 뒤 이어서 할 일(배포·창 닫기). [다시 시도]로 연결돼도 이어서 함
    if (r.busy) return '';
    setFail(null);
    const win = openBlank('Netlify 로그인 창을 여는 중');
    try {
      // blocked: 새 창이 막힘(브라우저의 팝업 차단) → 진행 줄이 사실대로 알리고 [로그인 창 열기]를 지금 누를 곳으로
      const token = await r.run(({ onView, signal }) => netlifyLogin({ win, onView: (v) => onView({ ...v, blocked: !win }), signal }));
      if (!token) { try { win?.close(); } catch { /* 넘김 */ } return ''; }
      await checkToken('netlify', token);
      if (!alive.current) return '';
      await t.save(token); toast('Netlify에 연결했어요.'); onChange?.();
      after?.(token);
      return token;
    } catch (e) {
      if (!alive.current) return '';
      const f = nfFail(e, { retry: () => login(after), onToken });
      if (f) setFail(f); else toast('멈췄어요.');
      try { console.warn('[lecpage] Netlify 로그인 실패', { code: e?.code || '' }); } catch { /* 기록만 */ }
      return '';
    }
  }
  return { on: netlifyLoginOn(), view: r.view, busy: r.busy, cancel: r.cancel, fail, setFail, login };
}

/**
 * Netlify: [Netlify 계정으로 배포] 하나(처음에만 새 창에서 로그인·[Authorize], 커넥트 없이 브라우저만으로) → 다음부터는 [배포하기]만.
 * 토큰을 만들어 붙여 넣는 순서는 접힌 '다른 방법'. 로그인 길을 끈 앱(VITE_NETLIFY_CLIENT_ID가 빈 값)에서는 토큰 순서가 그대로 먼저
 */
function Netlify({ p, busy, start, done, bind, refresh, guard }) {
  const t = useToken('netlify');
  const prev = p.deploy?.netlify;
  const [name, setName] = useState(prev?.name || '');
  const [fail, setFail] = useState(null);
  const [alt, setAlt] = useState(false);
  const L = useNetlifyLogin(t, { onChange: refresh, onToken: () => { L.setFail(null); setAlt(true); } });
  const nameOk = !name || /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/.test(name);
  const run = (token, asked = null) => { setFail(null); start('netlify', async (files, onProgress) => {
    const out = await deployNetlify({ token: typeof token === 'string' && token ? token : t.token, siteId: prev?.siteId, name: prev ? prev.name || '' : name, zip: E.zipFiles(files), onProgress });
    // locked: 첫 배포 때 계정 기본 접근 제한을 앱이 풀지 못함(드묾) → 카드에 [로그인 없이 열리게 하기]가 남음. 풀 것이 없던 계정에는 아무 말도 하지 않음
    const locked = out.locked || (!!prev?.locked && prev.siteId === out.siteId);
    done(out.url, { netlify: { siteId: out.siteId, url: out.url, name: prev ? prev.name || name : name, ...(locked ? { locked: true } : {}) } });
    toast(prev && prev.url && out.url !== prev.url ? '지난 사이트가 Netlify에 없어 새 주소로 배포했어요. 새 주소와 QR을 다시 알려 주세요.' : prev ? '같은 주소에 다시 배포했어요.' : out.opened ? '배포했어요. 참가자가 로그인 없이 열 수 있게 Netlify의 접근 제한을 풀었어요.' : '배포했어요.');
  }, (e) => {
    if (/must be unique|already/i.test(e.message)) setFail({ kind: 'name-taken', title: '배포하지 못했어요.', t: '이미 쓰는 주소 이름이에요. 다른 이름을 적어 주세요.' });
    else if (!tokenGone(e, t, refresh)) setFail(deployFail(e, () => run(token, asked)));
    return true;
  }, null, asked); };
  /** 버튼 하나: 연결해 뒀으면 바로 배포, 처음이면 로그인(새 창에서 [Authorize]) 뒤 이어서 배포 */
  function go() {
    if (t.saved) { run(); return; }
    // 참여 기능을 어떻게 할지는 다른 곳처럼 로그인 전에 물음(로그인을 끝낸 뒤에야 묻지 않게). 답은 로그인 뒤 배포에 그대로 넘김
    guard((opts = {}) => L.login((token) => run(token, opts)));
  }
  const [opening, setOpening] = useState(false);
  async function unlock() {
    if (opening) return; setOpening(true);
    try { await openNetlify(t.token, prev.siteId); done(prev.url, { netlify: { ...prev, locked: false } }); toast('이제 로그인 없이 열려요.'); }
    catch (e) { toast('바꾸지 못했어요. ' + (e.message || '잠시 뒤 다시 눌러 주세요.')); }
    setOpening(false);
  }
  bind(t.saved && nameOk ? () => run() : null);
  const on = busy === 'netlify';
  const nameField = !prev && <AddrName optional pre="https://" post=".netlify.app" value={name} onInput={(v) => { setName(cleanName(v)); if (fail?.kind === 'name-taken') setFail(null); }} placeholder={nameHint(p)} invalid={!nameOk} max={63}
    hint={nameOk ? '영문 소문자·숫자·하이픈. 짧을수록 치기 쉬워요. 비워 두면 자동으로 정해요.' : '영문 소문자·숫자로 시작하고 끝나야 해요.'} />;
  const shown = (L.fail || fail) && !on && !L.busy;
  if (!L.on) { // 로그인 길을 끈 앱: 토큰 순서가 먼저(예전 모양)
    return (
      <div class="stack one-click">
        <Connect t={t} kind="netlify" onChange={refresh} />
        {t.saved && <>{nameField}<Go on={on} busy={busy} again={!!prev} disabled={!nameOk} onClick={() => run()} /></>}
        {shown && <RunFail fail={fail} onClose={() => setFail(null)} />}
      </div>
    );
  }
  return (
    <OneClickCard
      note={t.saved
        ? <Connect t={t} kind="netlify" onChange={refresh} />
        : <p class="small">처음 한 번만 새 창에서 Netlify에 로그인(무료 가입)하고 [Authorize]를 눌러요. 로그인 정보는 이 브라우저에만 저장돼요. lecpage 운영자는 볼 수 없어요.</p>}
      fields={nameField}
      go={{ label: t.saved ? '배포하기' : 'Netlify 계정으로 배포', again: !!prev && t.saved, on, busy: busy || L.busy, disabled: !nameOk, onClick: go }}
      progress={<NfProgress view={L.view} onCancel={L.cancel} />}
      fail={shown && <RunFail fail={L.fail || fail} onClose={() => { L.setFail(null); setFail(null); }} />}
      foot={<>
        {t.saved && prev?.siteId && prev.locked && <p class="small" role="status">주소를 열면 Netlify 로그인 창이 떠요. <button type="button" class="btn btn-sm" disabled={on || opening} onClick={unlock}>{opening ? '바꾸는 중…' : '로그인 없이 열리게 하기'}</button></p>}
        {t.saved && prev?.siteId && <CancelLine id="netlify" />}
      </>}
      alt={!t.saved && { label: '다른 방법: 토큰으로 연결', open: alt, onToggle: setAlt, body: <Connect t={t} kind="netlify" onChange={refresh} /> }} />
  );
}

/**
 * Cloudflare: lecpage 커넥트가 켜져 있으면 [Cloudflare 계정으로 배포] 하나(처음에만 브라우저에서 로그인·[Allow]) — 사이트와, 참여 기능이 켜져 있으면
 * 참여 기능 서버까지 내 계정에 함께. 다음부터는 [다시 배포하기]만. 커넥트가 없으면 켜는 법과 직접 올리기(ZIP 끌어다 놓기).
 * withLive: 참여 기능을 아직 연결하지 않아 서버도 함께 만들 때. 카드 모양은 OneClickCard(다른 곳도 같은 모양으로 꽂음)
 */
function Cloudflare({ p, busy, start, setBusy, done, bind, guard, zip, cfWay, withLive, refresh }) {
  const { pc, way } = cfWay;
  const prev = p.deploy?.cloudflare;
  const [fresh, setFresh] = useState(false); // 적어 둔 이름이 이 PC의 커넥트가 올린 것이 아님(가져온 연수 등) → 그 이름을 덮지 않고 새 이름으로
  const mine = prev?.via === 'connect' && !!prev.name && !fresh; // 커넥트로 올린 적이 있음(같은 주소에 다시)
  const bp = deployView(p);
  const [name, setName] = useState('');
  const [view, setView] = useState(null);
  const [fail, setFail] = useState(null);
  const [used, setUsed] = useState(() => cfUsed()); // 이 브라우저에서 Cloudflare에 배포·연결해 봄 → '연결돼 있어요'와 [연결 해제]
  const ctl = useRef(null);
  // 커넥트로 도는 중에 이 카드가 사라지면(다른 단계로 감 등) 멈춤: 떠난 뒤에 옛 내용으로 배포가 이어지지 않게, 커넥트도 기다리던 일(로그인·물음)을 접게
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; if (ctl.current) { ctl.current.abort(); cfCancel(); } }, []);
  const nameOk = !name || CF_NAME_RE.test(name);
  async function signOut() {
    try { await cfRun('logout', {}); markCfUsed(false); setUsed(false); refresh?.(); toast('이 PC의 Cloudflare 로그인을 지웠어요.'); }
    catch (e) { toast(e.message || '연결을 해제하지 못했어요. 잠시 뒤 다시 해 주세요.'); }
  }
  const autoName = () => `lec-${(bp.meta?.date || new Date().toISOString().slice(0, 10)).replace(/-/g, '')}-${String(bp.live?.code || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 4) || Math.random().toString(36).slice(2, 6)}`;
  const manual = <Manual p={p} busy={busy} guard={guard} done={done} zip={zip} kind="cloudflare" key="cloudflare" />;
  const show = (e) => {
    if (!alive.current) return;
    // 적어 둔 이름이 이 PC의 커넥트가 올린 사이트가 아님(다른 PC에서 올렸거나 가져온 연수): 같은 이름의 사이트를 덮지 않고 새 이름으로 배포하는 길 하나
    if (mine && NOT_OURS.includes(e?.code)) { setFail(notOursFail('Cloudflare', () => { setFresh(true); setName(''); setFail(null); })); return; }
    const f = cfFail(e, go); if (f) setFail(f); else toast('멈췄어요.');
    try { console.warn('[lecpage] Cloudflare 배포 실패', { code: e?.code || '' }); } catch { /* 기록만 */ }
  };
  // 파일로 가져온 연수에 적혀 온 이름(이 PC에서 배포한 적 없음): 그 이름에 배포하기 전에 한 번 물음
  const carried = mine && !!prev.carried;
  const [ask, setAsk] = useState(false); const okCarry = useRef(false);
  async function go(rotate = false) {
    if (ctl.current) return;
    if (carried && !okCarry.current) { setAsk(true); return; }
    setFail(null);
    let auto = null;
    if (withLive) { // ① 참여 기능 서버(계정에 하나: 있으면 그대로) → 사이트에 그 주소를 넣어 만듦
      const c = new AbortController(); ctl.current = c; setBusy('cloudflare');
      try {
        const r = await ensureRelay({ code: bp.live.code, settings: liveSettings(bp), known: (u) => adminKeyFor(u, bp.live.code), rotate, onView: (v) => { if (alive.current) setView(v); }, signal: c.signal });
        const next = { provider: 'http', url: r.url, anonKey: '' };
        await pingLive(next, bp.live.code);
        rememberServer(r.url, r.key, bp.live.code);
        auto = { live: next };
      } catch (e) { show(e); return; } finally { ctl.current = null; if (alive.current) setView(null); setBusy(''); }
    }
    if (!alive.current) return; // 참여 기능 서버를 만드는 동안 이 화면을 떠남: 사이트 배포로 넘어가지 않음
    const site = mine ? prev.name : name || autoName();
    start('cloudflare', async (files, onProgress) => { // ② 사이트
      const c = new AbortController(); ctl.current = c;
      try {
        const draft = await cfUpload(files, onProgress);
        if (c.signal.aborted) throw Object.assign(new Error('멈췄어요.'), { code: 'cancelled' }); // 파일을 건네는 동안 [중지]했거나 화면을 떠남
        onProgress({ step: 'Cloudflare에 배포하는 중', pct: 40 });
        const out = await cfRun('site', { draft, name: site, again: mine }, { onView: (v) => { if (alive.current) setView(v); if (v.phase === 'wait') onProgress({ step: '주소 확인하는 중', pct: 90 }); }, signal: c.signal });
        markCfUsed(); setUsed(true); setFresh(false);
        done(out.site.url, { cloudflare: { url: out.site.url, name: out.site.name, via: 'connect' } }, auto ? { live: auto.live, liveOk: true } : null);
        // 다른 계정으로 로그인했으면 같은 이름이어도 주소(…계정.workers.dev)가 달라짐: 그때는 '같은 주소'라고 하지 않음
        const moved = mine && !!prev?.url && !sameUrl(out.site.url, prev.url);
        toast(moved ? '새 주소로 배포했어요. 새 주소와 QR을 다시 알려 주세요.' : mine ? '같은 주소에 다시 배포했어요.' : out.site.ready === false ? '배포했어요. 새 주소는 1~2분 뒤에 열려요.' : '배포했어요.');
      } finally { ctl.current = null; if (alive.current) setView(null); }
    }, (e) => { show(e); return true; }, auto);
  }
  bind(way === 'ready' && nameOk ? () => go() : null);
  if (way !== 'ready') {
    // 커넥트가 없거나 꺼져 있음: 직접 올린 적이 있으면 그 순서를 그대로, 처음이면 켜는 법이 먼저(직접 올리기는 접어 둠). 휴대폰은 직접 올리기만
    if (way === 'mobile' || way === 'wait' || (prev?.url && !mine)) return <div class="stack">{manual}{way !== 'mobile' && way !== 'wait' && <details class="run-alt"><summary class="small">더 쉬운 방법: 로그인 한 번으로 배포</summary><div class="run-alt-body"><CfGetConnect pc={pc} way={way} /></div></details>}</div>;
    return <OneClickCard note={<CfGetConnect pc={pc} way={way} lead={false} main soon="켜지면 이 화면에 [Cloudflare 계정으로 배포] 버튼이 저절로 나와요." />} alt={{ label: '다른 방법: 직접 배포(ZIP 끌어다 놓기)', body: manual }} />;
  }
  const on = busy === 'cloudflare';
  return (
    <OneClickCard
      note={used
        ? <p class="small conn-line"><span class="ok-dot" aria-hidden="true" />Cloudflare에 연결돼 있어요.{withLive ? ' 참여 기능 서버도 내 계정에 만들어요.' : ''} <button type="button" class="btn btn-sm btn-quiet" disabled={on} onClick={signOut}>연결 해제</button></p>
        : <p class="small">처음 한 번만 브라우저에서 Cloudflare에 로그인(무료 가입)하고 [Allow]를 눌러요.{withLive ? ' 참여 기능 서버도 내 계정에 만들어요.' : ''}</p>}
      fields={!mine && <AddrName label="사이트 주소 이름" optional pre="https://" post=".내계정.workers.dev" value={name} onInput={(v) => { setName(cleanName(v)); if (fail?.kind === 'name-taken') setFail(null); }} placeholder={nameHint(p)} invalid={!nameOk} max={63}
        hint={nameOk ? '영문 소문자·숫자·하이픈. 짧을수록 치기 쉬워요. 비워 두면 자동으로 정해요.' : '영문 소문자·숫자로 시작하고 끝나야 해요.'} />}
      go={{ label: used ? '배포하기' : 'Cloudflare 계정으로 배포', again: mine, on, busy, disabled: !nameOk, onClick: () => go() }}
      progress={<CfProgress view={view} onCancel={() => { ctl.current?.abort(); cfCancel(); }} />}
      fail={fail && !on && (fail.kind === 'old' ? <ConnectUpdate pc={pc} /> : <RunFail fail={fail} onClose={() => setFail(null)} />)}
      foot={<>
        {mine && !carried && <p class="small muted">다시 배포해도 주소는 그대로예요. <button type="button" class="btn btn-sm btn-quiet" aria-haspopup="dialog" onClick={() => window.dispatchEvent(new CustomEvent('lp-undeploy', { detail: 'cloudflare' }))}>배포 취소</button></p>}
        <CarriedConfirm open={ask} host="Cloudflare" name={prev?.name || ''} onClose={() => setAsk(false)} onSame={() => { okCarry.current = true; setAsk(false); go(); }} onNew={() => { setAsk(false); setFresh(true); setName(''); }} />
      </>}
      alt={{ label: '다른 방법: 직접 배포(ZIP 끌어다 놓기)', body: manual }} />
  );
}

/** 직접 옮기는 곳(Cloudflare 끌어다 놓기·학교 서버·USB): 파일을 받고, 배포한 주소를 적으면 QR과 안내 문구가 나옴 */
function Manual({ p, busy, guard, done, zip, kind }) {
  const prev = p.deploy?.[kind]?.url || '';
  const [url, setUrl] = useState(prev);
  const [at, setAt] = useState(0);
  // https://를 빼고 적어도 받음(maum.example.org/site → https://maum.example.org/site): 까닭 없이 [주소 저장]이 꺼져 있지 않게
  const full = /^https?:\/\//i.test(url.trim()) ? url.trim() : url.trim() ? `https://${url.trim()}` : '';
  const ok = /^https?:\/\/[^\s/]+\.[^\s]+$/.test(full);
  const cf = kind === 'cloudflare';
  const get = { t: '사이트 파일 다운로드', next: false,
    body: <p><button class="btn btn-sm btn-primary" disabled={!!busy} aria-busy={busy === 'zip' ? 'true' : undefined} onClick={() => guard((o) => { setAt(1); return zip(o); }, false, 'zip')}>{busy === 'zip' ? '만드는 중…' : '사이트 ZIP 다운로드'}</button> {cf ? '압축은 풀지 않아요.' : '받은 파일의 압축을 풀어요.'}</p> };
  const save = { t: prev ? '배포한 주소 확인하기' : '배포한 주소 적기',
    body: <>
      <p>{prev ? '주소가 바뀌었으면 고쳐 주세요.' : '배포한 주소를 적으면 QR과 안내 문구를 만들어요.'}</p>
      <div class="row token-row"><input class="input" value={url} onInput={(e) => setUrl(e.target.value)} placeholder="https://" inputMode="url" autoComplete="off" spellcheck={false} aria-label="배포한 사이트 주소" />
        <button class="btn btn-sm btn-primary" disabled={!ok} onClick={() => { setUrl(full); done(siteDir(full), { [kind]: { url: full } }); toast('주소를 저장했어요.'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>주소 저장</button></div>
    </> };
  const steps = !cf ? [get,
    { t: '폴더째 옮기기', body: <p>쓸 곳에 폴더째 옮겨요. <span class="links"><a href={`${DOCS}/own-server-nginx-caddy.md`} target="_blank" rel="noopener">회사·학교·기관 서버</a><a href={`${DOCS}/nas-synology.md`} target="_blank" rel="noopener">NAS</a><a href={`${DOCS}/local-lan-classroom.md`} target="_blank" rel="noopener">인터넷 없는 강의실</a><a href={`${DOCS}/zip-usb-offline.md`} target="_blank" rel="noopener">USB</a></span></p> },
    save]
    : prev ? [get,
      { t: '새 ZIP 놓기', body: <p><a class="btn btn-sm" href="https://dash.cloudflare.com/?to=/:account/workers-and-pages" target="_blank" rel="noopener" onClick={() => setAt(2)}>Cloudflare 열기</a> 그 프로젝트에서 <b>Create a new deployment</b>를 누르고 새 ZIP을 놓아요. 주소는 그대로예요.</p> },
      save]
      : [get,
        { t: 'Cloudflare 배포 화면 열기', next: false,
          body: <>
            <p>처음이면 <a href="https://dash.cloudflare.com/sign-up" target="_blank" rel="noopener">Cloudflare에 가입</a>해요. 그다음 아래 버튼으로 들어가 차례로 눌러요.</p>
            <ClickShot pre={['Create application', 'Get started']} btn="Drag and drop your files" />
            <div>{/* copy-ok: Cloudflare 메뉴 이름 그대로(번역하면 화면에서 못 찾음) */}<a class="btn btn-sm btn-primary" href="https://dash.cloudflare.com/?to=/:account/workers-and-pages/create" target="_blank" rel="noopener" onClick={() => setAt(2)}>Workers &amp; Pages 열기</a></div>
          </> },
        { t: 'ZIP 끌어다 놓기',
          body: <>
            <p>프로젝트 이름을 적고 ZIP을 끌어다 놓은 뒤 <b>Deploy site</b>를 눌러요. 주소는 <span class="mono">이름.pages.dev</span>가 돼요. <a href={`${DOCS}/cloudflare.md`} target="_blank" rel="noopener">자세한 순서</a></p>
            <ClickShot rows={[['Project name', nameHint(p)]]} btn="Deploy site" />
          </> },
        save];
  return (
    <div class="stack">
      <Steps steps={steps} at={Math.min(at, steps.length - 1)} onAt={setAt} label={cf ? 'Cloudflare에 배포하는 순서' : '파일로 받아 옮기는 순서'} />
      {cf && !prev && <p class="small muted">가입 전에 먼저 보려면 <a href="https://www.cloudflare.com/drop/" target="_blank" rel="noopener">Cloudflare Drop</a>에 ZIP을 놓으세요. 주소가 바로 생기고, 60분 안에 <b>Claim</b>을 눌러 가입해야 남아요.</p>}
    </div>
  );
}

/** 설정의 '연결' 가운데 Cloudflare 줄: 로그인은 lecpage 커넥트가 그 PC에 둠(토큰 연결이 없음). 써 본 적이 있고 커넥트가 켜져 있으면 [연결 해제] */
export function CfHostRow({ onChange }) {
  const { way } = useCfWay();
  const [used, setUsed] = useState(() => cfUsed());
  const [busy, setBusy] = useState(false);
  const on = way === 'ready';
  async function signOut() {
    setBusy(true);
    try { await cfRun('logout', {}); markCfUsed(false); setUsed(false); onChange?.(); toast('이 PC의 Cloudflare 로그인을 지웠어요.'); }
    catch (e) { toast(e.message || '연결을 해제하지 못했어요. 잠시 뒤 다시 해 주세요.'); }
    setBusy(false);
  }
  return (
    <li>
      <span><b>Cloudflare</b> <span class="small muted">{used ? (on ? '연결됨 · lecpage 커넥트' : 'lecpage 커넥트를 켜면 연결돼요') : on ? '배포할 때 로그인 한 번' : 'lecpage 커넥트 필요'}</span></span>
      {used && on && <button class="btn btn-sm btn-quiet" disabled={busy} onClick={signOut}>연결 해제</button>}
    </li>
  );
}

/** 설정의 '연결': 배포할 곳을 미리 연결해 두기. 토큰이 맞는지 확인한 뒤 저장 */
export function HostConnect({ kind, onChange }) {
  const t = useToken(kind); const g = HOST_GUIDE[kind];
  const [open, setOpen] = useState(false);
  const [alt, setAlt] = useState(false);
  // Netlify는 브라우저 로그인 한 번으로(배포하기 화면과 같은 버튼). 토큰 순서는 접힌 '다른 방법'
  const L = useNetlifyLogin(t, { onChange, onToken: () => { L.setFail(null); setAlt(true); } });
  const login = kind === 'netlify' && L.on;
  const [vcOn, setVcOn] = useState(() => vcUsed());
  const viaPc = kind === 'vercel' && !t.saved && vcOn; // 커넥트로 Vercel에 배포해 봄(로그인은 그 PC의 커넥트에)
  async function pcOut() {
    try { await vcRun('logout', {}); markVcUsed(false); setVcOn(false); onChange?.(); toast('이 PC의 Vercel 로그인을 지웠어요.'); }
    catch (e) { toast(e.message || '연결을 해제하지 못했어요. 잠시 뒤 다시 해 주세요.'); }
  }
  const pcOn = useVcWay().way === 'ready'; // 커넥트가 꺼져 있으면 '연결됨'이라고 하지 않음(지금은 [배포하기]만으로 안 됨)
  return (
    <li>
      <span><b>{g.name}</b> <span class="small muted">{t.saved ? (t.remember ? '연결됨 · 이 기기에 저장' : '연결됨 · 이 탭에서만') : viaPc ? (pcOn ? '연결됨 · lecpage 커넥트' : 'lecpage 커넥트를 켜면 연결돼요') : '연결 안 됨'}</span></span>
      {t.saved ? <button class="btn btn-sm btn-quiet" onClick={async () => { await t.forget(); onChange?.(); }}>연결 해제</button>
        : viaPc && pcOn ? <button class="btn btn-sm btn-quiet" onClick={pcOut}>연결 해제</button>
          : <button class="btn btn-sm" onClick={() => setOpen(true)}>{viaPc ? '토큰으로 연결' : '연결'}</button>}
      <Dialog open={open} onClose={() => { L.cancel(); setOpen(false); }} label={`${g.name} 연결`}>
        <div class="stack">
          <h2 class="h-sub">{g.name} 연결</h2>
          {open && !t.saved && (login
            ? <OneClickCard
              note={<p class="small">새 창에서 Netlify에 로그인(무료 가입)하고 [Authorize]를 눌러요. 로그인 정보는 이 브라우저에만 저장돼요. lecpage 운영자는 볼 수 없어요.</p>}
              go={{ label: 'Netlify 계정으로 연결', onLabel: '연결하는 중…', on: L.busy, busy: L.busy, onClick: () => L.login(() => setOpen(false)) }}
              progress={<NfProgress view={L.view} onCancel={L.cancel} />}
              fail={L.fail && !L.busy && <RunFail fail={L.fail} onClose={() => L.setFail(null)} />}
              alt={{ label: '다른 방법: 토큰으로 연결', open: alt, onToggle: setAlt, body: <Connect t={t} kind={kind} onConnected={() => setOpen(false)} onChange={onChange} /> }} />
            : <>
              {kind === 'vercel' && <p class="small muted">lecpage 커넥트를 켜 두면 배포하기 화면에서 토큰 없이 Vercel 로그인 한 번으로 배포할 수 있어요.</p>}
              <Connect t={t} kind={kind} onConnected={() => setOpen(false)} onChange={onChange} />
            </>)}
        </div>
      </Dialog>
    </li>
  );
}
