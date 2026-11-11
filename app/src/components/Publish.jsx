import { useEffect, useMemo, useState } from 'preact/hooks';
import { Field, Dialog } from './ui.jsx';
import { E } from '../lib/engine.js';
import { deployGitHub, deployNetlify, deployVercel, deployInstant, deleteInstant, instantInfo, openVercel, checkToken, siteStat, vercelName, GITHUB_TOKEN_URL, NETLIFY_TOKEN_URL, VERCEL_TOKEN_URL } from '../lib/deploy.js';
import { loadKey, saveKey, forgetKey } from '../lib/ai.js';
import { toast, randomKey, sha256Hex, copy } from '../lib/util.js';
import { liveSettings } from './LiveSetup.jsx';

const DOCS = 'https://github.com/yoorrard/lecpage/blob/main/skills/lecpage/references/deploy';
// 앱에서 고를 수 있는 곳(엔진 HOSTS의 id). 'lecpage'(바로 공개)는 운영자가 켜 둔 앱에서만 보임
export const TARGETS = ['lecpage', 'vercel', 'github-pages', 'cloudflare', 'netlify', 'zip'];
const LABEL = { lecpage: '바로 공개', vercel: 'Vercel', 'github-pages': 'GitHub Pages', netlify: 'Netlify', cloudflare: 'Cloudflare', zip: '파일로 받기' };
export const KIND = { vercel: 'vercel', 'github-pages': 'github', netlify: 'netlify' };
const slug = (d) => 'lecpage-' + (d || new Date().toISOString().slice(0, 10)).replace(/-/g, '') + '-' + Math.random().toString(36).slice(2, 5);
const day = (ms) => new Date(ms).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });

/** 올릴 곳의 토큰(이 탭 또는 '기억하기'를 켠 기기에만). 한 번 연결해 두면 다음부터는 단추 하나 */
export function useToken(kind) {
  const [token, setToken] = useState('');
  const [remember, setRemember] = useState(true);
  const [saved, setSaved] = useState(false);
  useEffect(() => { loadKey('deploy-' + kind).then(({ key, remembered }) => { if (key) { setToken(key); setRemember(remembered); setSaved(true); } }); }, [kind]);
  return { token, setToken, remember, setRemember, saved, save: async () => { await saveKey('deploy-' + kind, token, remember); setSaved(true); }, forget: async () => { await forgetKey('deploy-' + kind); setToken(''); setSaved(false); toast('연결을 끊었어요.'); } };
}

/** 이미 연결해 둔 곳(토큰이 있는 곳) */
export async function connectedTargets() {
  const out = [];
  for (const [id, kind] of Object.entries(KIND)) { const { key } = await loadKey('deploy-' + kind); if (key) out.push(id); }
  return out;
}

/** 토큰 만드는 순서(공개하기 화면과 설정의 '연결'에서 같이 씀) */
export const HOST_GUIDE = {
  vercel: {
    name: 'Vercel', label: 'Vercel 토큰', placeholder: 'vcp_…',
    steps: () => <>
      <li><a href="https://vercel.com/signup" target="_blank" rel="noopener">Vercel</a>에 가입해요(메일이나 GitHub 계정).</li>
      <li><a href={VERCEL_TOKEN_URL} target="_blank" rel="noopener">토큰 페이지</a>에서 이름에 lecpage를 적고 <b>Scope</b>는 내 계정, <b>Expiration</b>을 고른 다음 <b>Create</b>를 눌러요.</li>
      <li>나온 토큰을 복사해 아래에 붙여 넣어요. 토큰은 한 번만 보여요.</li>
    </>,
  },
  github: {
    name: 'GitHub Pages', label: 'GitHub 토큰', placeholder: 'github_pat_…',
    steps: () => <>
      <li><a href="https://github.com/signup" target="_blank" rel="noopener">GitHub</a>에 가입하고 메일 인증을 마쳐요.</li>
      <li><a href={GITHUB_TOKEN_URL} target="_blank" rel="noopener">토큰 만들기</a>를 열어 <b>Repository access</b>를 <b>All repositories</b>로 고르고 맨 아래 <b>Generate token</b>을 눌러요. 권한은 미리 채워져 있어요.</li>
      <li>나온 토큰을 복사해 아래에 붙여 넣어요.</li>
    </>,
  },
  netlify: {
    name: 'Netlify', label: 'Netlify 토큰', placeholder: 'nfp_…',
    steps: () => <>
      <li><a href="https://app.netlify.com/signup" target="_blank" rel="noopener">Netlify</a>에 가입해요.</li>
      <li><a href={NETLIFY_TOKEN_URL} target="_blank" rel="noopener">토큰 페이지</a>에서 <b>New access token</b> → 이름 lecpage → <b>Expiration</b> 고르기 → <b>Generate token</b>을 눌러요.</li>
      <li>나온 토큰을 복사해 아래에 붙여 넣어요.</li>
    </>,
  },
};

function TokenRow({ t, kind }) {
  const g = HOST_GUIDE[kind];
  async function paste() {
    try { const v = (await navigator.clipboard.readText()).trim(); if (v) t.setToken(v); else toast('복사한 토큰이 없어요.'); }
    catch { toast('입력 칸을 누르고 Ctrl+V(맥은 ⌘V)로 붙여 넣어 주세요.'); }
  }
  return <>
    <Field label={g.label}>
      <div class="row token-row"><input type="password" autoComplete="off" spellcheck={false} value={t.token} onInput={(e) => t.setToken(e.target.value.trim())} placeholder={g.placeholder} />
        <button type="button" class="btn btn-sm" onClick={paste}>붙여넣기</button></div>
    </Field>
    <label class="check"><input type="checkbox" checked={t.remember} onChange={(e) => t.setRemember(e.target.checked)} /><span>이 기기에서 기억하기 <span class="small muted">다음부터 단추 하나로 올려요. 공용 PC에서는 끄세요.</span></span></label>
  </>;
}
/** 연결 전에는 순서 + 토큰 칸, 연결 뒤에는 한 줄 */
function Connect({ t, kind }) {
  const g = HOST_GUIDE[kind];
  if (t.saved) return <p class="small conn-line"><span class="ok-dot" aria-hidden="true" />{g.name}에 연결돼 있어요. <button type="button" class="btn btn-sm btn-quiet" onClick={t.forget}>연결 끊기</button></p>;
  return <><ol class="how small">{g.steps()}</ol><TokenRow t={t} kind={kind} /></>;
}
const Go = ({ on, busy, again, onClick, disabled, name = '공개하기' }) => (
  <div class="btn-row"><button class="btn btn-primary btn-lg" disabled={disabled || !!busy} onClick={onClick}>{on ? '올리는 중…' : again ? '바뀐 내용 다시 올리기' : name}</button></div>
);

/**
 * 공개하기: 올릴 곳을 추천해 고르고, 단추 하나로 올립니다.
 * buildFiles(opts) → { files }, guard(run): 참여 기능 연결 전이면 먼저 물어봄, done(url, patch): 주소 저장
 */
export function Publish({ p, busy, setBusy, setProg, buildFiles, guard, done, zip }) {
  const [connected, setConnected] = useState([]);
  const [instant, setInstant] = useState(null);
  const [instantOff, setInstantOff] = useState(''); // 바로 공개를 지금 못 쓰는 까닭(자리가 참·닿지 않음)
  useEffect(() => { connectedTargets().then(setConnected); instantInfo().then(setInstant); }, []);
  const live = instant && !instantOff ? instant : null;
  const rec = useMemo(() => E.decideHost({ skill: 'click', commercial: p.info?.commercial, network: p.info?.network, previous: instantOff && p.deploy?.target === 'lecpage' ? '' : p.deploy?.target, connected, instant: !!live }), [p.info?.commercial, p.info?.network, p.deploy?.target, connected.join(), !!live]);
  const usable = TARGETS.filter((h) => (h !== 'lecpage' || live) && (h !== 'vercel' || rec.hosts.includes('vercel') || p.deploy?.target === 'vercel'));
  const order = [...new Set([...rec.hosts.filter((h) => usable.includes(h)), ...usable])];
  const [picked, setPicked] = useState('');
  const target = picked && order.includes(picked) ? picked : order[0];
  /** 한 곳에 올리기: 사이트 만들기 → 그곳의 한도 확인 → 올리기. up(files)가 주소를 저장. onFail(e)가 true면 알림을 띄우지 않음 */
  const start = (id, up, onFail, auto = null) => guard(async (opts = {}) => {
    setBusy(id); setProg({ step: '사이트 만드는 중', pct: 1 });
    try {
      const r = await buildFiles({ ...opts, ...(auto || {}) });
      const chk = E.checkHost(id, siteStat(r.files));
      if (!chk.ok) throw new Error(chk.errors[0]);
      await up(r.files, setProg);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { if (!onFail?.(e)) toast('올리지 못했어요. ' + e.message); }
    setBusy(''); setProg(null);
  }, !!auto?.live);
  const ctx = { p, busy, start, done: (url, patch, more) => { done(url, { ...patch, target }, more); connectedTargets().then(setConnected); } };
  return (
    <div class="stack publish">
      <div class="pub-pick" role="radiogroup" aria-label="올릴 곳">
        {order.map((id) => (
          <label class="pub-opt" key={id}><input type="radio" name="pub-target" checked={target === id} onChange={() => setPicked(id)} />
            <span><b>{LABEL[id]}</b>{id === rec.pick && <em>추천</em>}{id === 'lecpage' && id !== rec.pick && <em>가입 없이</em>}{connected.includes(id) && <i>연결됨</i>}</span></label>
        ))}
      </div>
      <p class="small muted">{target === rec.pick ? rec.reasons[0] : E.HOSTS[target]?.note_ko}{rec.warnings[0] && target === rec.pick ? ` ${rec.warnings[0]}` : ''}</p>
      {instantOff && <p class="small" role="status">{instantOff} 내 계정에 올리면 계속 쓸 수 있어요.</p>}
      {target === 'lecpage' && <Instant {...ctx} info={instant} onUnavailable={(why) => { setInstantOff(why); setPicked(''); }} />}
      {target === 'vercel' && <Vercel {...ctx} />}
      {target === 'github-pages' && <GitHub {...ctx} />}
      {target === 'netlify' && <Netlify {...ctx} />}
      {target === 'cloudflare' && <Manual {...ctx} guard={guard} zip={zip} kind="cloudflare" />}
      {target === 'zip' && <Manual {...ctx} guard={guard} zip={zip} kind="zip" />}
    </div>
  );
}

/** lecpage 바로 공개: 가입·토큰 없이. 운영자가 켜 둔 앱에서만. 참여 기능도 서버가 받으면 따로 연결할 것 없이 함께 켜짐 */
function Instant({ p, busy, start, done, info, onUnavailable }) {
  const prev = p.deploy?.lecpage;
  const days = info?.limits?.days || 30;
  const alive = prev?.expiresAt && prev.expiresAt > Date.now();
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
    const out = await deployInstant({ site: prev, title: p.title, files, live, onProgress });
    done(out.url, { lecpage: { id: out.id, key: out.key, url: out.url, expiresAt: out.expiresAt, ...(autoLive ? { adminKey } : {}) } },
      autoLive ? { live: { provider: 'http', url: out.liveUrl || info.live.url, anonKey: '', ...(newCode ? { code: newCode } : {}) }, liveOk: true } : null);
    toast(prev?.id === out.id ? '새 내용을 같은 주소에 올렸어요.' : '공개했어요!');
  }, (e) => {
    if (e.code === 'code_taken' && !newCode) { setTimeout(() => run(E.randomCode()), 0); return true; }
    // 자리가 찼거나(무료 한도 안에서만 받음) 서버에 닿지 않으면 내 계정에 올리는 길로 넘김
    if (e.code === 'full' || e.code === 'rate_limited' || e.status === 0 || e.status >= 500) {
      onUnavailable?.(e.code === 'full' || e.code === 'rate_limited' ? '오늘은 바로 공개 자리가 찼어요.' : '바로 공개 서버에 지금 닿지 않아요.');
      return true;
    }
    return false;
  },
  autoLive ? { live: { provider: 'http', url: info.live.url, anonKey: '', ...(newCode ? { code: newCode } : {}) }, processor: { name: 'lecpage 운영자(바로 공개 서버 · Cloudflare)', contact: info.report || '', country: '미국 등 Cloudflare 데이터센터가 있는 국가', purpose: '사이트와 참여 기록 저장. 공개 기간이 끝나면 삭제' } } : null);
  async function remove() {
    try { await deleteInstant(prev); done('', { lecpage: null }, prev.adminKey ? { live: { provider: 'local', url: '', anonKey: '' }, liveOk: false } : null); toast('사이트를 내렸어요.'); }
    catch (e) { toast('내리지 못했어요. ' + e.message); }
  }
  return (
    <div class="stack">
      <p>가입이나 토큰 없이 바로 공개해요. 마지막으로 올린 날부터 {days}일 동안 열려 있어요.{autoLive ? ' 질문·보드 같은 참여 기능도 따로 연결할 것 없이 함께 켜져요.' : ''}</p>
      <Go on={busy === 'lecpage'} busy={busy} again={!!alive} onClick={() => run()} />
      {alive && <p class="small muted">{day(prev.expiresAt)}까지 열려 있어요. 다시 올리면 그날부터 {days}일로 늘어나요. <button type="button" class="btn btn-sm btn-quiet" onClick={remove}>지금 내리기</button></p>}
      {alive && prev.adminKey && <p class="small">강사 화면 관리자 키 <b class="mono">{prev.adminKey}</b> <button type="button" class="btn btn-sm btn-quiet" onClick={() => copy(prev.adminKey, '관리자 키를 복사했어요.')}>복사</button></p>}
      <p class="small muted">사이트 파일{autoLive ? '과 참가자가 남긴 글·파일' : ''}이 lecpage 서버에 {days}일 동안 저장돼요. 남의 저작물이나 개인정보가 들어 있지 않은지 확인해 주세요. 오래 둘 사이트는 Vercel처럼 내 계정에 올리는 편이 좋아요.</p>
    </div>
  );
}

function Vercel({ p, busy, start, done }) {
  const t = useToken('vercel');
  const prev = p.deploy?.vercel;
  const [name, setName] = useState(prev?.name || '');
  const clean = vercelName(name);
  const run = () => start('vercel', async (files, onProgress) => {
    const out = await deployVercel({ token: t.token, name: clean || slug(p.info?.date), projectId: prev?.projectId, files, onProgress });
    await t.save(); // 올리기에 성공한 토큰만 기억(틀린 토큰이 '연결됨'으로 남지 않게)
    done(out.url, { vercel: { projectId: out.projectId, name: out.name, url: out.url } });
    toast(prev ? '새 내용을 같은 주소에 올렸어요.' : out.opened ? '공개했어요! 참가자가 로그인 없이 열 수 있게 Vercel의 배포 보호를 껐어요.' : '공개했어요!');
  });
  async function unlock() {
    try { await openVercel(t.token, prev.projectId); toast('이제 로그인 없이 열려요.'); }
    catch (e) { toast('바꾸지 못했어요. ' + e.message); }
  }
  return (
    <div class="stack">
      <Connect t={t} kind="vercel" />
      {!prev && <Field label="주소 이름(선택)" hint={clean ? `https://${clean}.vercel.app` : '비워 두면 자동으로 정해요. 영문 소문자·숫자·하이픈'}><input value={name} onInput={(e) => setName(e.target.value)} placeholder={'training-' + ((p.info?.date || '').replace(/-/g, '') || 'site')} maxLength={60} autoComplete="off" spellcheck={false} /></Field>}
      <Go on={busy === 'vercel'} busy={busy} again={!!prev} disabled={!t.token} onClick={run} />
      {prev && t.token && <p class="small muted">주소를 열면 Vercel 로그인 창이 뜨나요? <button type="button" class="btn btn-sm btn-quiet" onClick={unlock}>로그인 없이 열리게 하기</button></p>}
      <p class="small muted">Vercel 무료는 비상업 개인 용도예요. 강사료를 받는 연수면 Cloudflare나 GitHub Pages를 고르세요.</p>
    </div>
  );
}

function GitHub({ p, busy, start, done }) {
  const t = useToken('github');
  const prev = p.deploy?.github;
  const [repo, setRepo] = useState(prev?.repo || slug(p.info?.date));
  const [confirm, setConfirm] = useState(false);
  const run = (allowExisting = false) => start('github-pages', async (files, onProgress) => {
    const name = repo.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || slug();
    const out = await deployGitHub({ token: t.token, repo: name, files, onProgress, allowExisting: allowExisting || prev?.repo === name });
    await t.save();
    done(out.url, { github: { repo: name, url: out.url } }); toast('GitHub Pages에 올렸어요. 처음에는 1~2분 뒤 열려요.');
  }, (e) => { if (e.code !== 'exists') return false; setConfirm(true); return true; });
  return (
    <div class="stack">
      <Connect t={t} kind="github" />
      <Field label="저장소 이름" hint="영문 소문자·숫자·하이픈. 주소에 들어가요."><input value={repo} onInput={(e) => setRepo(e.target.value)} autoComplete="off" spellcheck={false} /></Field>
      <Go on={busy === 'github-pages'} busy={busy} again={!!prev} disabled={!t.token} onClick={() => run()} />
      <p class="small muted">저장소가 공개돼서 사이트 파일을 누구나 볼 수 있어요.</p>
      <Dialog open={confirm} onClose={() => setConfirm(false)} label="저장소 덮어쓰기 확인">
        <h2 class="h-sub">이미 있는 저장소예요</h2>
        <p>"{repo}" 저장소가 이미 있어요. 올리면 그 안의 파일이 연수 사이트로 모두 바뀌어요. 다른 이름을 쓰는 것이 안전해요.</p>
        <div class="btn-row"><button class="btn" onClick={() => { setConfirm(false); setRepo(slug(p.info?.date)); }}>다른 이름 쓰기</button><button class="btn btn-danger" onClick={() => { setConfirm(false); run(true); }}>그래도 바꾸기</button></div>
      </Dialog>
    </div>
  );
}

function Netlify({ p, busy, start, done }) {
  const t = useToken('netlify');
  const prev = p.deploy?.netlify;
  const [name, setName] = useState(prev?.name || '');
  const nameOk = !name || /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/.test(name);
  const run = () => start('netlify', async (files, onProgress) => {
    const out = await deployNetlify({ token: t.token, siteId: prev?.siteId, name: prev ? '' : name, zip: E.zipFiles(files), onProgress });
    await t.save();
    done(out.url, { netlify: { siteId: out.siteId, url: out.url, name } });
    toast(prev ? '새 내용을 같은 주소에 올렸어요.' : '올렸어요. 주소가 열리지 않으면 Netlify에서 Make public을 눌러 주세요.');
  }, (e) => { if (!/must be unique|already/i.test(e.message)) return false; toast('이미 쓰는 주소 이름이에요. 다른 이름을 적어 주세요.'); return true; });
  return (
    <div class="stack">
      <Connect t={t} kind="netlify" />
      {!prev && <Field label="주소 이름(선택)" hint={nameOk ? (name ? `https://${name}.netlify.app` : '비워 두면 자동으로 정해요. 영문 소문자·숫자·하이픈') : '영문 소문자·숫자·하이픈만 써요.'}><input value={name} onInput={(e) => setName(e.target.value.trim().toLowerCase())} placeholder={'training-' + ((p.info?.date || '').replace(/-/g, '') || 'site')} maxLength={63} autoComplete="off" spellcheck={false} aria-invalid={nameOk ? undefined : 'true'} /></Field>}
      <Go on={busy === 'netlify'} busy={busy} again={!!prev} disabled={!t.token || !nameOk} onClick={run} />
      <p class="small muted">2026년 7월 뒤에 가입했다면 올린 뒤 Netlify 프로젝트 화면에서 <b>Make public</b>을 눌러야 참가자가 봐요. 무료는 한 달에 20번쯤 올릴 수 있어요.</p>
    </div>
  );
}

/** 직접 올리는 곳(Cloudflare 끌어다 놓기·학교 서버·USB): 파일을 받고, 올린 주소를 적으면 QR과 안내 문구가 나옴 */
function Manual({ p, busy, guard, done, zip, kind }) {
  const prev = p.deploy?.[kind]?.url || '';
  const [url, setUrl] = useState(prev);
  const ok = /^https?:\/\/[^\s/]+\.[^\s]+$/.test(url.trim());
  const cf = kind === 'cloudflare';
  return (
    <div class="stack">
      <ol class="how small">
        <li><button class="btn btn-sm" disabled={!!busy} onClick={() => guard(zip)}>{busy === 'zip' ? '만드는 중…' : '사이트 파일 받기(ZIP)'}</button>{cf ? ' 압축은 풀지 않아요.' : ' 받은 파일의 압축을 풀어요.'}</li>
        {cf && (prev
          ? <li><a href="https://dash.cloudflare.com/?to=/:account/workers-and-pages" target="_blank" rel="noopener">Cloudflare</a>의 그 프로젝트에서 <b>Create a new deployment</b>를 누르고 새 ZIP을 놓아요. 주소는 그대로예요.</li>
          : <>
            <li><a href="https://dash.cloudflare.com/sign-up" target="_blank" rel="noopener">Cloudflare</a>에 가입하고 <a href="https://dash.cloudflare.com/?to=/:account/workers-and-pages/create" target="_blank" rel="noopener">Workers &amp; Pages</a> → <b>Create application</b> → <b>Get started</b> → <b>Drag and drop your files</b>로 들어가요.</li>
            <li>프로젝트 이름을 적고(주소가 이름.pages.dev가 돼요) ZIP을 끌어다 놓은 다음 <b>Deploy site</b>를 눌러요. <a href={`${DOCS}/cloudflare.md`} target="_blank" rel="noopener">자세한 순서</a></li>
          </>)}
        {!cf && <li>올릴 곳에 폴더째 올려요. <span class="links"><a href={`${DOCS}/own-server-nginx-caddy.md`} target="_blank" rel="noopener">학교·기관 서버</a><a href={`${DOCS}/nas-synology.md`} target="_blank" rel="noopener">NAS</a><a href={`${DOCS}/local-lan-classroom.md`} target="_blank" rel="noopener">인터넷 없는 교실</a><a href={`${DOCS}/zip-usb-offline.md`} target="_blank" rel="noopener">USB</a></span></li>}
        <li>올린 주소를 적으면 QR과 안내 문구를 만들어요.
          <div class="row" style={{ marginTop: '6px' }}><input class="input" style={{ flex: '1 1 240px' }} value={url} onInput={(e) => setUrl(e.target.value)} placeholder="https://" inputMode="url" autoComplete="off" spellcheck={false} aria-label="올린 사이트 주소" />
            <button class="btn" disabled={!ok} onClick={() => { done(url.trim().replace(/\/?$/, '/'), { [kind]: { url: url.trim() } }); toast('주소를 저장했어요.'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>주소 저장</button></div></li>
      </ol>
      {cf && !prev && <p class="small muted">가입 전에 먼저 보려면 <a href="https://www.cloudflare.com/drop/" target="_blank" rel="noopener">Cloudflare Drop</a>에 ZIP을 놓으세요. 주소가 바로 생기고, 60분 안에 <b>Claim</b>을 눌러 가입해야 남아요.</p>}
    </div>
  );
}

/** 설정의 '연결': 공개할 곳을 미리 연결해 두기. 토큰이 맞는지 확인한 뒤 저장 */
export function HostConnect({ kind, onChange }) {
  const t = useToken(kind); const g = HOST_GUIDE[kind];
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  async function connect() {
    setBusy(true); setErr('');
    try { await checkToken(kind, t.token); await t.save(); setOpen(false); toast(`${g.name}에 연결했어요.`); onChange?.(); }
    catch (e) { setErr(e.message || '토큰을 확인하지 못했어요.'); }
    setBusy(false);
  }
  return (
    <li>
      <span><b>{g.name}</b> <span class="small muted">{t.saved ? (t.remember ? '연결됨 · 이 기기에 저장' : '연결됨 · 이 탭에서만') : '연결 안 됨'}</span></span>
      {t.saved ? <button class="btn btn-sm btn-quiet" onClick={async () => { await t.forget(); onChange?.(); }}>연결 끊기</button> : <button class="btn btn-sm" onClick={() => setOpen(true)}>연결하기</button>}
      <Dialog open={open} onClose={() => setOpen(false)} label={`${g.name} 연결`}>
        <div class="stack">
          <h2 class="h-sub">{g.name} 연결</h2>
          <ol class="how small">{g.steps()}</ol>
          <TokenRow t={t} kind={kind} />
          {err && <p class="small" style={{ color: 'var(--bad)' }}>{err}</p>}
          <div class="btn-row"><button class="btn btn-primary" disabled={!t.token || busy} onClick={connect}>{busy ? '확인하는 중…' : '연결'}</button><button class="btn btn-quiet" onClick={() => setOpen(false)}>취소</button></div>
          <p class="small muted">토큰은 이 브라우저에서 {g.name}로만 가요. lecpage 운영자는 볼 수 없어요.</p>
        </div>
      </Dialog>
    </li>
  );
}
