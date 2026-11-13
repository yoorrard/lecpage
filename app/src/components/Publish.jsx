import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Dialog } from './ui.jsx';
import { Steps, ClickShot } from './Steps.jsx';
import { E } from '../lib/engine.js';
import { deployGitHub, deployNetlify, deployVercel, deployInstant, deleteInstant, instantInfo, openVercel, checkToken, tokenLooksWrong, siteStat, vercelName, PUBLISH_API, GITHUB_TOKEN_URL, NETLIFY_TOKEN_URL, VERCEL_TOKEN_URL } from '../lib/deploy.js';
import { loadKey, saveKey, forgetKey } from '../lib/ai.js';
import { toast, randomKey, sha256Hex, copy } from '../lib/util.js';
import { liveSettings } from './LiveSetup.jsx';
import { reach } from '../lib/netcheck.js';

const DOCS = 'https://github.com/yoorrard/lecpage/blob/main/skills/lecpage/references/deploy';
// 앱에서 고를 수 있는 곳(엔진 HOSTS의 id). 'lecpage'(바로 공개)는 운영자가 켜 둔 앱에서만 보임
export const TARGETS = ['lecpage', 'vercel', 'github-pages', 'cloudflare', 'netlify', 'zip'];
const LABEL = { lecpage: '바로 공개', vercel: 'Vercel', 'github-pages': 'GitHub Pages', netlify: 'Netlify', cloudflare: 'Cloudflare', zip: '파일로 받기' };
export const KIND = { vercel: 'vercel', 'github-pages': 'github', netlify: 'netlify' };
// 고른 곳마다 한 줄 소개(lead)와 알아 둘 점(care). 숫자·약관 근거: docs/research/hosting-2026-11.md, 2026-11-12에 공식 문서로 다시 확인
const ABOUT = {
  lecpage: { lead: '가입이나 토큰 없이 바로 공개해요.' },
  vercel: { lead: '토큰 하나로 바로 올리고, 다시 올려도 주소가 그대로예요.' },
  'github-pages': { lead: '토큰으로 바로 올리고, 다시 올려도 주소가 그대로예요.', care: '저장소가 공개돼서 사이트 파일을 누구나 볼 수 있어요.' },
  cloudflare: { lead: '받은 ZIP을 끌어다 놓아요. 방문이 많아도 멈추지 않아요.' },
  netlify: { lead: '토큰으로 바로 올리고, 다시 올려도 주소가 그대로예요.', care: '2026년 7월 28일 뒤에 가입했다면 올린 뒤 Netlify에서 Make public을 눌러야 열려요. 무료는 한 달에 20번쯤 올릴 수 있어요.' },
  zip: { lead: '기관 서버·NAS·USB로 나눌 때 써요.' },
};
const slug = (d) => 'lecpage-' + (d || new Date().toISOString().slice(0, 10)).replace(/-/g, '') + '-' + Math.random().toString(36).slice(2, 5);
const nameHint = (p) => 'training-' + ((p.info?.date || '').replace(/-/g, '') || 'site');

/** 올릴 곳의 토큰(이 탭 또는 '기억하기'를 켠 기기에만). 한 번 연결해 두면 다음부터는 버튼 하나 */
export function useToken(kind) {
  const [token, setToken] = useState('');
  const [remember, setRemember] = useState(true);
  const [saved, setSaved] = useState(false);
  useEffect(() => { loadKey('deploy-' + kind).then(({ key, remembered }) => { if (key) { setToken(key); setRemember(remembered); setSaved(true); } }); }, [kind]);
  return { token, setToken, remember, setRemember, saved, save: async (tok = token) => { await saveKey('deploy-' + kind, tok, remember); setToken(tok); setSaved(true); }, forget: async (quiet) => { await forgetKey('deploy-' + kind); setToken(''); setSaved(false); if (quiet !== true) toast('연결을 끊었어요.'); } };
}

/** 이미 연결해 둔 곳(토큰이 있는 곳) */
export async function connectedTargets() {
  const out = [];
  for (const [id, kind] of Object.entries(KIND)) { const { key } = await loadKey('deploy-' + kind); if (key) out.push(id); }
  return out;
}

/**
 * 토큰 만드는 순서(공개하기 화면과 설정의 '연결'이 같이 씀). 버튼·칸 이름은 그 사이트 화면에 나오는 영문 그대로.
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
  if (t.saved) return <p class="small conn-line"><span class="ok-dot" aria-hidden="true" />{g.name}에 연결돼 있어요. <button type="button" class="btn btn-sm btn-quiet" onClick={async () => { await t.forget(); onChange?.(); }}>연결 끊기</button></p>;
  const steps = [
    { t: `${g.site} 가입하기`, next: '이미 가입했어요',
      body: <p><a class="btn btn-sm" href={g.signup} target="_blank" rel="noopener" onClick={() => setAt(1)}>가입 페이지 열기</a> {g.join}</p> },
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

/** 올리다가 토큰이 틀렸거나 기한이 지난 것을 알면: 저장한 토큰을 지워 연결 순서(토큰 만들기)가 다시 보이게 함. true면 알림을 띄웠음 */
function tokenGone(e, t, refresh) {
  if (e.status !== 401 && !/토큰이 맞지 않거나|토큰에 권한이 모자라요/.test(e.message || '')) return false;
  t.forget(true).then(() => refresh?.()); toast('올리지 못했어요. ' + e.message); return true;
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

const Go = ({ on, busy, again, onClick, disabled, name = '공개하기' }) => (
  <div class="btn-row"><button class="btn btn-primary btn-lg" disabled={disabled || !!busy} aria-busy={on ? 'true' : undefined} onClick={onClick}>{on ? '올리는 중…' : again ? '바뀐 내용 다시 올리기' : name}</button></div>
);

/**
 * 공개하기: 올릴 곳을 추천해 고르고, 버튼 하나로 올립니다.
 * buildFiles(opts) → { files }, guard(run): 참여 기능 연결 전이면 먼저 물어봄, done(url, patch): 주소 저장.
 * again: { current } 지난번에 올린 곳에 바로 다시 올리는 함수를 여기에 걸어 둠(성공 카드의 [다시 올리기]가 부름). 못 하면 null
 */
export function Publish({ p, busy, setBusy, setProg, buildFiles, guard, done, zip, again, onTarget }) {
  const [connected, setConnected] = useState([]);
  const [instant, setInstant] = useState(null);
  const [instantOff, setInstantOff] = useState(''); // 바로 공개를 지금 못 쓰는 까닭(자리가 참·닿지 않음)
  // false: 바로 공개를 켠 앱인데 이 망에서 서버에 닿지 않음
  useEffect(() => { connectedTargets().then(setConnected); instantInfo().then((i) => setInstant(i || (PUBLISH_API ? false : null))); }, []);
  const [netBad, setNetBad] = useState({}); // 이 망에서 API에 닿지 않는 올릴 곳(토큰으로 올리는 곳만 확인)
  const [moved, setMoved] = useState(''); // 막혀서 다른 곳으로 바꾼 사실 한 줄
  const forced = useRef(new Set()); // 막혔다고 알린 뒤에도 강사가 다시 고른 곳(다시 바꾸지 않음)
  const live = instant && instant.accepting !== false && !instantOff ? instant : null;
  // 운영자가 새 업로드를 잠시 멈췄으면(paused) 그대로, 아니면 하루 한도 때문에 멈춘 것
  const full = instantOff || (instant && instant.accepting === false ? (instant.paused ? '바로 공개가 잠시 새 사이트를 받지 않아요. 다른 곳에 올려 주세요.' : '오늘은 바로 공개에 방문이 많아 새로 받지 않아요.') : '');
  const rec = useMemo(() => E.decideHost({ skill: 'click', commercial: p.info?.commercial, network: p.info?.network, previous: instantOff && p.deploy?.target === 'lecpage' ? '' : p.deploy?.target, connected, instant: live ? (live.view === 'pages' ? 'pages' : live.plan === 'paid' ? 'stable' : 'limited') : false, size: p.info?.size }), [p.info?.commercial, p.info?.network, p.info?.size, p.deploy?.target, connected.join(), live?.plan, live?.view]);
  const usable = TARGETS.filter((h) => (h !== 'lecpage' || live) && (h !== 'vercel' || rec.hosts.includes('vercel') || p.deploy?.target === 'vercel'));
  // 바로 공개가 켜져 있으면 첫째(가입·토큰 없이 참여 기능까지). 다른 곳에 올린 적이 있으면 그곳이 먼저(주소가 그대로)
  const prevHost = p.deploy?.target && p.deploy.target !== 'lecpage' && usable.includes(p.deploy.target) ? [p.deploy.target] : [];
  const order = [...new Set([...prevHost, ...(live ? ['lecpage'] : []), ...rec.hosts.filter((h) => usable.includes(h)), ...usable])];
  const best = order.find((h) => !netBad[h]) || order[0];
  const [picked, setPicked] = useState('');
  const [more, setMore] = useState(false); // 다른 곳에 올리기(올릴 곳 목록 펼치기)
  const target = picked && order.includes(picked) ? picked : best;
  useEffect(() => { onTarget?.(target); }, [target]);
  // 고른 곳의 API가 이 망에서 막혔으면(요청 한 번) 다음 추천 곳으로 바꾸고 한 줄로 알림. 핫스팟으로 바꾸면 3분 뒤 다시 확인
  useEffect(() => {
    if (!KIND[target]) return undefined;
    let off = false;
    reach('host:' + target).then((s) => {
      if (off || s !== 'blocked') return;
      const bad = { ...netBad, [target]: true }; setNetBad(bad);
      if (forced.current.has(target)) return;
      const alt = order.find((h) => h !== target && !bad[h]) || 'zip';
      setMoved(`이 망에서 ${LABEL[target]}에 닿지 않아 ${LABEL[alt]}로 바꿨어요. 휴대폰 핫스팟으로 바꾸면 ${LABEL[target]}에도 올릴 수 있어요.`);
      setPicked(alt);
    });
    return () => { off = true; };
  }, [target]);
  /** 한 곳에 올리기: 사이트 만들기 → 그곳의 한도 확인 → 올리기. up(files)가 주소를 저장. onFail(e)가 true면 알림을 띄우지 않음 */
  const start = (id, up, onFail, auto = null) => guard(async (opts = {}) => {
    setBusy(id); setProg({ step: '사이트 만드는 중', pct: 1 });
    try {
      const r = await buildFiles({ ...opts, ...(auto || {}), target: id, view: live?.view || '' });
      const chk = E.checkHost(id, siteStat(r.files));
      if (!chk.ok) throw new Error(chk.errors[0]);
      await up(r.files, setProg);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { if (!onFail?.(e)) toast('올리지 못했어요. ' + e.message); }
    setBusy(''); setProg(null);
  }, !!auto?.live);
  // 무료 한도를 넘으면 어떻게 되는지(고른 곳마다 한 줄)
  const H = E.HOSTS[target] || {};
  const lead = `${target === rec.pick ? rec.reasons[0] : ABOUT[target]?.lead || H.note_ko}${rec.warnings[0] && target === rec.pick ? ` ${rec.warnings[0]}` : ''}`;
  // 서버 보기가 Pages면 사이트는 하루 한도와 상관없이 열리고, 무료 서버에서 멈출 수 있는 것은 참여 기능뿐
  const limit = target === 'lecpage' ? (live?.view === 'pages' ? (live.plan === 'paid' ? '' : '사이트는 늘 열려요. 무료 서버라 참여 기능은 붐비는 날 멈출 수 있어요.') : live?.plan === 'paid' ? H.atLimit_ko : H.atLimitFree_ko) : H.atLimit_ko;
  const limitLine = limit && !lead.includes(limit) ? limit : ''; // 소개 줄에 이미 나온 말은 되풀이하지 않음
  const showLimit = true; // 무료 한도를 넘으면 어떻게 되는지는 늘 미리(writing.md 비용 규칙)
  const days = instant?.limits?.days || 30;
  const care = target === 'lecpage' ? `${instant?.keepAlive === false ? `올린 날부터 ${days}일 뒤 지워져요(다시 올리면 그날부터).` : `${days}일 동안 아무도 오지 않으면 지워져요.`} 사이트 파일이 lecpage 서버에 저장되니 남의 저작물이나 개인정보가 없는지 확인해 주세요.` : ABOUT[target]?.care;
  if (again) again.current = null;
  const ctx = {
    p, busy, start, done: (url, patch, more) => { done(url, { ...patch, target }, more); connectedTargets().then(setConnected); },
    refresh: () => connectedTargets().then(setConnected), // 연결하거나 끊은 뒤 '연결됨' 표시를 맞춤
    bind: (fn) => { if (again) again.current = fn && target === p.deploy?.target ? fn : null; },
  };
  return (
    <div class="stack publish">
      <div class="pub-now">
        <span class="pub-now-t"><b>{LABEL[target]}</b>{target === best && <em>추천</em>}{connected.includes(target) && <i>연결됨</i>}</span>
        <button type="button" class="btn btn-sm btn-quiet" aria-expanded={String(more)} aria-controls="pub-pick" onClick={() => setMore(!more)}>{more ? '접기' : '다른 곳에 올리기'}</button>
      </div>
      {more && <div class="pub-pick" id="pub-pick" role="radiogroup" aria-label="올릴 곳">
        {order.map((id) => (
          <label class="pub-opt" key={id}><input type="radio" name="pub-target" checked={target === id} onChange={() => { if (netBad[id]) forced.current.add(id); setMoved(''); setPicked(id); }} />
            <span><b>{LABEL[id]}</b>{id === best && <em>추천</em>}{id === 'lecpage' && id !== best && <em>가입 없이</em>}{connected.includes(id) && <i>연결됨</i>}{netBad[id] && <i class="net-bad">이 망에서 막힘</i>}</span></label>
        ))}
      </div>}
      <div class="pub-about">
        <p>{lead}</p>
        {((showLimit && limitLine) || care) && <dl class="pub-facts small">
          {showLimit && limitLine && <div class="pub-limit"><dt>무료 한도</dt><dd>{limitLine}</dd></div>}
          {care && <div><dt>알아 둘 점</dt><dd>{care}</dd></div>}
        </dl>}
      </div>
      {full && <p class="small" role="status">{full} 내 계정에 올리면 바로 돼요.</p>}
      {moved && <p class="small net-line" role="status">{moved}</p>}
      {instant === false && <p class="small muted net-line">이 망에서 바로 공개 서버에 닿지 않아요. 휴대폰 핫스팟으로 바꾸면 쓸 수 있어요.</p>}
      {netBad[target] && !moved && <p class="small net-line" role="status">이 망에서 {LABEL[target]}에 닿지 않아요. 올리다 멈출 수 있어요. 휴대폰 핫스팟으로 바꾸거나 다른 곳을 골라 주세요.</p>}
      {target === 'lecpage' && <Instant {...ctx} info={instant} onUnavailable={(why) => { setInstantOff(why); setPicked(''); }} />}
      {target === 'vercel' && <Vercel {...ctx} />}
      {target === 'github-pages' && <GitHub {...ctx} />}
      {target === 'netlify' && <Netlify {...ctx} />}
      {target === 'cloudflare' && <Manual {...ctx} guard={guard} zip={zip} kind="cloudflare" key="cloudflare" />}
      {target === 'zip' && <Manual {...ctx} guard={guard} zip={zip} kind="zip" key="zip" />}
    </div>
  );
}

/** lecpage 바로 공개: 가입·토큰 없이. 운영자가 켜 둔 앱에서만. 참여 기능도 서버가 받으면 따로 연결할 것 없이 함께 켜짐 */
function Instant({ p, busy, start, done, bind, info, onUnavailable }) {
  const prev = p.deploy?.lecpage;
  // 방문이 있으면 서버가 공개 기간을 늘리므로, 저장해 둔 날짜가 지났어도 올린 적이 있으면 '있는 사이트'로 봄(지워졌으면 올릴 때 새 주소로 만듦)
  const alive = !!(prev?.id && prev.expiresAt);
  const bp = p.blueprint;
  const liveOn = (bp.live?.features || []).length > 0;
  const autoLive = liveOn && !!info?.live?.url; // 참여 기능을 이 서버가 맡음
  // newCode: 연수 코드가 다른 사이트와 겹쳤을 때 새로 정한 코드(사이트를 그 코드로 다시 만들어 올림)
  const run = (newCode = '') => start('lecpage', async (files, onProgress) => {
    let live = null, adminKey = prev?.adminKey || '';
    if (autoLive) {
      if (!adminKey) adminKey = randomKey(20);
      live = { code: newCode || E.validate(bp).blueprint.live.code, adminKeyHash: await sha256Hex(adminKey), settings: liveSettings(bp) };
    }
    // 연수 날짜·인원: 서버가 그날 몫을 미리 셈(차면 지금 알려 줌)
    const m = bp.meta || {};
    const booking = m.date ? { date: m.date, start: m.start || '', end: m.end || '', people: p.info?.size || 30, network: p.info?.network || 'good', live: autoLive } : null;
    const out = await deployInstant({ site: prev, title: p.title, files, live, booking, onProgress });
    done(out.url, { lecpage: { id: out.id, key: out.key, url: out.url, expiresAt: out.expiresAt, ...(out.altUrl ? { altUrl: out.altUrl, view: out.view } : {}), ...(autoLive ? { adminKey } : {}) } },
      autoLive ? { live: { provider: 'http', url: out.liveUrl || info.live.url, anonKey: '', ...(newCode ? { code: newCode } : {}) }, liveOk: true } : null);
    toast(prev?.id === out.id ? '새 내용을 같은 주소에 올렸어요.' : '공개했어요.');
  }, (e) => {
    if (e.code === 'code_taken' && !newCode) { setTimeout(() => run(E.randomCode()), 0); return true; }
    // 자리가 찼거나(무료 한도 안에서만 받음) 서버에 닿지 않으면 내 계정에 올리는 길로 넘김
    if (e.code === 'full' || e.code === 'rate_limited' || e.status === 0 || e.status >= 500) {
      onUnavailable?.(e.reason === 'booked' ? e.message : e.code === 'full' || e.code === 'rate_limited' ? '오늘은 바로 공개 자리가 찼어요.' : '바로 공개 서버에 지금 닿지 않아요.');
      return true;
    }
    return false;
  },
  autoLive ? { live: { provider: 'http', url: info.live.url, anonKey: '', ...(newCode ? { code: newCode } : {}) }, processor: { name: 'lecpage 운영자(바로 공개 서버 · Cloudflare)', contact: info.report || '', country: '미국 등 Cloudflare 데이터센터가 있는 국가', /* copy-ok: 개인정보 처리방침 표의 칸(법률 문서라 명사형·'삭제' 그대로) */ purpose: '사이트와 참여 기록 저장. 공개 기간이 끝나면 삭제' } } : null);
  bind(() => run());
  async function remove() {
    try { await deleteInstant(prev); done('', { lecpage: null }, prev.adminKey ? { live: { provider: 'local', url: '', anonKey: '' }, liveOk: false } : null); toast('사이트를 내렸어요.'); }
    catch (e) { toast('내리지 못했어요. ' + e.message); }
  }
  return (
    <div class="stack">
      {autoLive && <p class="small">질문·보드 같은 참여 기능도 따로 연결할 것 없이 함께 켜져요. 참가자가 남긴 글·파일도 lecpage 서버에 저장돼요.</p>}
      <Go on={busy === 'lecpage'} busy={busy} again={!!alive} onClick={() => run()} />
      {alive && <p class="small muted">다시 올려도 주소는 그대로예요. <button type="button" class="btn btn-sm btn-quiet" onClick={remove}>지금 내리기</button></p>}
      {alive && prev.adminKey && <p class="small">강사 화면 관리자 키 <b class="mono">{prev.adminKey}</b> <button type="button" class="btn btn-sm btn-quiet" onClick={() => copy(prev.adminKey, '관리자 키를 복사했어요.')}>복사</button></p>}
    </div>
  );
}

function Vercel({ p, busy, start, done, bind, refresh }) {
  const t = useToken('vercel');
  const prev = p.deploy?.vercel;
  const [name, setName] = useState(prev?.name || '');
  const clean = vercelName(name);
  const run = () => start('vercel', async (files, onProgress) => {
    const out = await deployVercel({ token: t.token, name: clean || slug(p.info?.date), projectId: prev?.projectId, files, onProgress });
    done(out.url, { vercel: { projectId: out.projectId, name: out.name, url: out.url } });
    toast(prev ? '새 내용을 같은 주소에 올렸어요.' : out.opened ? '공개했어요. 참가자가 로그인 없이 열 수 있게 Vercel의 배포 보호를 껐어요.' : '공개했어요.');
  }, (e) => tokenGone(e, t, refresh));
  bind(t.saved ? run : null);
  async function unlock() {
    try { await openVercel(t.token, prev.projectId); toast('이제 로그인 없이 열려요.'); }
    catch (e) { toast('바꾸지 못했어요. ' + e.message); }
  }
  return (
    <div class="stack">
      <Connect t={t} kind="vercel" onChange={refresh} />
      {t.saved && <>
        {!prev && <AddrName optional pre="https://" post=".vercel.app" value={name} onInput={(v) => setName(cleanName(v))} placeholder={nameHint(p)} hint="영문 소문자·숫자·하이픈. 짧을수록 치기 쉬워요. 비워 두면 자동으로 정해요." />}
        <Go on={busy === 'vercel'} busy={busy} again={!!prev} onClick={run} />
        {prev && <p class="small muted">주소를 열면 Vercel 로그인 창이 뜨나요? <button type="button" class="btn btn-sm btn-quiet" onClick={unlock}>로그인 없이 열리게 하기</button></p>}
      </>}
    </div>
  );
}

function GitHub({ p, busy, start, done, bind, refresh }) {
  const t = useToken('github');
  const prev = p.deploy?.github;
  const [repo, setRepo] = useState(prev?.repo || slug(p.info?.date));
  const [confirm, setConfirm] = useState(false);
  const run = (allowExisting = false) => start('github-pages', async (files, onProgress) => {
    const name = repo.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || slug();
    const out = await deployGitHub({ token: t.token, repo: name, files, onProgress, allowExisting: allowExisting || prev?.repo === name });
    done(out.url, { github: { repo: name, url: out.url } }); toast('GitHub Pages에 올렸어요. 처음에는 1~2분, 길면 10분 뒤에 열려요.');
  }, (e) => { if (e.code !== 'exists') return tokenGone(e, t, refresh); setConfirm(true); return true; });
  bind(t.saved ? () => run() : null);
  return (
    <div class="stack">
      <Connect t={t} kind="github" onChange={refresh} />
      {t.saved && <>
        <AddrName label="저장소 이름" pre="내계정.github.io/" value={repo} onInput={setRepo} hint="영문 소문자·숫자·하이픈. 주소에 들어가요." max={80} />
        <Go on={busy === 'github-pages'} busy={busy} again={!!prev} onClick={() => run()} />
      </>}
      <Dialog open={confirm} onClose={() => setConfirm(false)} label="저장소 덮어쓰기 확인">
        <h2 class="h-sub">이미 있는 저장소예요</h2>
        <p>"{repo}" 저장소가 이미 있어요. 올리면 그 안의 파일이 연수 사이트로 모두 바뀌어요. 다른 이름을 쓰는 것이 안전해요.</p>
        <div class="btn-row"><button class="btn" data-autofocus onClick={() => { setConfirm(false); setRepo(slug(p.info?.date)); }}>다른 이름 쓰기</button><button class="btn btn-danger" onClick={() => { setConfirm(false); run(true); }}>그래도 바꾸기</button></div>
      </Dialog>
    </div>
  );
}

function Netlify({ p, busy, start, done, bind, refresh }) {
  const t = useToken('netlify');
  const prev = p.deploy?.netlify;
  const [name, setName] = useState(prev?.name || '');
  const nameOk = !name || /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/.test(name);
  const run = () => start('netlify', async (files, onProgress) => {
    const out = await deployNetlify({ token: t.token, siteId: prev?.siteId, name: prev ? '' : name, zip: E.zipFiles(files), onProgress });
    done(out.url, { netlify: { siteId: out.siteId, url: out.url, name } });
    toast(prev ? '새 내용을 같은 주소에 올렸어요.' : '올렸어요. 주소가 열리지 않으면 Netlify에서 Make public을 눌러 주세요.');
  }, (e) => { if (!/must be unique|already/i.test(e.message)) return tokenGone(e, t, refresh); toast('이미 쓰는 주소 이름이에요. 다른 이름을 적어 주세요.'); return true; });
  bind(t.saved && nameOk ? run : null);
  return (
    <div class="stack">
      <Connect t={t} kind="netlify" onChange={refresh} />
      {t.saved && <>
        {!prev && <AddrName optional pre="https://" post=".netlify.app" value={name} onInput={(v) => setName(cleanName(v))} placeholder={nameHint(p)} invalid={!nameOk} max={63}
          hint={nameOk ? '영문 소문자·숫자·하이픈. 짧을수록 치기 쉬워요. 비워 두면 자동으로 정해요.' : '영문 소문자·숫자로 시작하고 끝나야 해요.'} />}
        <Go on={busy === 'netlify'} busy={busy} again={!!prev} disabled={!nameOk} onClick={run} />
      </>}
    </div>
  );
}

/** 직접 올리는 곳(Cloudflare 끌어다 놓기·학교 서버·USB): 파일을 받고, 올린 주소를 적으면 QR과 안내 문구가 나옴 */
function Manual({ p, busy, guard, done, zip, kind }) {
  const prev = p.deploy?.[kind]?.url || '';
  const [url, setUrl] = useState(prev);
  const [at, setAt] = useState(0);
  const ok = /^https?:\/\/[^\s/]+\.[^\s]+$/.test(url.trim());
  const cf = kind === 'cloudflare';
  const get = { t: '사이트 파일 받기', next: false,
    body: <p><button class="btn btn-sm btn-primary" disabled={!!busy} aria-busy={busy === 'zip' ? 'true' : undefined} onClick={() => guard((o) => { setAt(1); return zip(o); })}>{busy === 'zip' ? '만드는 중…' : '사이트 파일 받기(ZIP)'}</button> {cf ? '압축은 풀지 않아요.' : '받은 파일의 압축을 풀어요.'}</p> };
  const save = { t: prev ? '올린 주소 확인하기' : '올린 주소 적기',
    body: <>
      <p>{prev ? '주소가 바뀌었으면 고쳐 주세요.' : '올린 주소를 적으면 QR과 안내 문구를 만들어요.'}</p>
      <div class="row token-row"><input class="input" value={url} onInput={(e) => setUrl(e.target.value)} placeholder="https://" inputMode="url" autoComplete="off" spellcheck={false} aria-label="올린 사이트 주소" />
        <button class="btn btn-sm btn-primary" disabled={!ok} onClick={() => { done(url.trim().replace(/\/?$/, '/'), { [kind]: { url: url.trim() } }); toast('주소를 저장했어요.'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>주소 저장</button></div>
    </> };
  const steps = !cf ? [get,
    { t: '폴더째 올리기', body: <p>올릴 곳에 폴더째 올려요. <span class="links"><a href={`${DOCS}/own-server-nginx-caddy.md`} target="_blank" rel="noopener">학교·기관 서버</a><a href={`${DOCS}/nas-synology.md`} target="_blank" rel="noopener">NAS</a><a href={`${DOCS}/local-lan-classroom.md`} target="_blank" rel="noopener">인터넷 없는 교실</a><a href={`${DOCS}/zip-usb-offline.md`} target="_blank" rel="noopener">USB</a></span></p> },
    save]
    : prev ? [get,
      { t: '새 ZIP 놓기', body: <p><a class="btn btn-sm" href="https://dash.cloudflare.com/?to=/:account/workers-and-pages" target="_blank" rel="noopener" onClick={() => setAt(2)}>Cloudflare 열기</a> 그 프로젝트에서 <b>Create a new deployment</b>를 누르고 새 ZIP을 놓아요. 주소는 그대로예요.</p> },
      save]
      : [get,
        { t: 'Cloudflare에서 올릴 화면 열기', next: false,
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
      <Steps steps={steps} at={Math.min(at, steps.length - 1)} onAt={setAt} label={cf ? 'Cloudflare에 올리는 순서' : '파일로 받아 올리는 순서'} />
      {cf && !prev && <p class="small muted">가입 전에 먼저 보려면 <a href="https://www.cloudflare.com/drop/" target="_blank" rel="noopener">Cloudflare Drop</a>에 ZIP을 놓으세요. 주소가 바로 생기고, 60분 안에 <b>Claim</b>을 눌러 가입해야 남아요.</p>}
    </div>
  );
}

/** 설정의 '연결': 공개할 곳을 미리 연결해 두기. 토큰이 맞는지 확인한 뒤 저장 */
export function HostConnect({ kind, onChange }) {
  const t = useToken(kind); const g = HOST_GUIDE[kind];
  const [open, setOpen] = useState(false);
  return (
    <li>
      <span><b>{g.name}</b> <span class="small muted">{t.saved ? (t.remember ? '연결됨 · 이 기기에 저장' : '연결됨 · 이 탭에서만') : '연결 안 됨'}</span></span>
      {t.saved ? <button class="btn btn-sm btn-quiet" onClick={async () => { await t.forget(); onChange?.(); }}>연결 끊기</button> : <button class="btn btn-sm" onClick={() => setOpen(true)}>연결하기</button>}
      <Dialog open={open} onClose={() => setOpen(false)} label={`${g.name} 연결`}>
        <div class="stack">
          <h2 class="h-sub">{g.name} 연결</h2>
          {open && !t.saved && <Connect t={t} kind={kind} onConnected={() => setOpen(false)} onChange={onChange} />}
        </div>
      </Dialog>
    </li>
  );
}
