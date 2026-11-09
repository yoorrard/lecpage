import { useEffect, useState } from 'preact/hooks';
import { StepHead } from '../Project.jsx';
import { Sheet, Field, Notice, Progress, Dialog } from '../../components/ui.jsx';
import { Mascot } from '../../components/Mascot.jsx';
import { QR, qrPng } from '../../components/QR.jsx';
import { LiveSetup } from '../../components/LiveSetup.jsx';
import { projectAssets } from '../../components/Preview.jsx';
import { buildSite, loadRuntime, E } from '../../lib/engine.js';
import { blobs } from '../../lib/db.js';
import { deployGitHub, deployNetlify, GITHUB_TOKEN_URL, NETLIFY_TOKEN_URL } from '../../lib/deploy.js';
import { loadKey, saveKey, forgetKey } from '../../lib/ai.js';
import { saveFile, safeName, toast, copy, randomKey } from '../../lib/util.js';

const DOCS = 'https://github.com/yoorrard/lecpage/blob/main/skills/lecpage/references/deploy';
const LIVE_READY = (live, ok) => ['sheets', 'supabase', 'http'].includes(live?.provider) && live?.url && ok;
const asciiSlug = (d) => 'lecpage-' + (d || new Date().toISOString().slice(0, 10)).replace(/-/g, '') + '-' + Math.random().toString(36).slice(2, 5);

function checks(p) {
  const bp = p.blueprint; const v = E.validate(bp); const b = v.blueprint; const out = [];
  if (!b.meta.date) out.push({ k: 'warn', t: '날짜가 비어 있어요(첫 화면·일정에 보여요).', go: 1 });
  const deck = b.sections.find((s) => s.type === 'deck');
  if (deck && deck.slides.some((s) => !s.src)) out.push({ k: 'info', t: '교재 넘겨 보기에 그림이 없는 쪽이 있어요. PDF를 넣으면 그림이 생겨요.', go: 1 });
  if (b.live.features.length && !LIVE_READY(b.live, p.liveOk)) out.push({ k: 'warn', t: '참여 기능이 아직 연결되지 않았어요. 아래에서 10분이면 연결돼요.' });
  if (b.access.mode === 'password' && !p.sitePassword) out.push({ k: 'bad', t: '암호를 정해 주세요(누가 볼 수 있나요?).' });
  for (const w of v.warnings.slice(0, 5)) out.push({ k: 'info', t: w.message_ko });
  if (!out.length) out.push({ k: 'ok', t: '확인할 문제가 없어요.' });
  return out;
}

/** 운영안내.md → 간단한 HTML(강사가 바로 열어 볼 수 있게) */
function mdToHtml(md, title) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const body = md.split(/\n{2,}/).map((blk) => {
    if (/^#{1,3} /.test(blk)) { const n = blk.match(/^#+/)[0].length; return `<h${n}>${esc(blk.replace(/^#+ /, ''))}</h${n}>`; }
    if (/^(- |\d+\. )/m.test(blk)) return '<ul>' + blk.split('\n').filter(Boolean).map((l) => `<li>${esc(l.replace(/^(- |\d+\. )/, ''))}</li>`).join('') + '</ul>';
    return `<p>${esc(blk).replace(/\n/g, '<br>')}</p>`;
  }).join('\n');
  return `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · 운영 안내</title><style>body{font:16px/1.7 system-ui,'Malgun Gothic',sans-serif;max-width:46em;margin:32px auto;padding:0 16px;word-break:keep-all}code{background:#f3f0ee;padding:1px 5px;border-radius:5px}</style>${body}</html>`;
}

export function StepShare({ p, update, go }) {
  const bp = p.blueprint;
  const [busy, setBusy] = useState('');
  const [prog, setProg] = useState(null);
  const [ask, setAsk] = useState(null); // 참여 기능 미연결로 올릴 때 확인
  const [showPw, setShowPw] = useState(false);
  if (!bp) return <><StepHead title="공유하기" /><Notice>먼저 사이트 초안을 만들어 주세요.</Notice><div><button class="btn btn-primary" onClick={() => go(1)}>초안 만들러 가기</button></div></>;
  const access = bp.access?.mode || 'link';
  const liveOn = (bp.live?.features || []).length > 0;
  const liveReady = LIVE_READY(bp.live, p.liveOk);
  const setAccess = (mode) => update((cur) => ({ blueprint: { ...cur.blueprint, access: { mode } }, sitePassword: mode === 'password' && !cur.sitePassword ? friendlyPassword() : cur.sitePassword }));

  async function buildFiles({ liveOff = false } = {}) {
    const assets = { ...(await projectAssets(p.id, true)) };
    let b = JSON.parse(JSON.stringify(bp));
    if (liveOff || !liveReady) b.live = { ...b.live, provider: liveOff ? 'none' : b.live.provider };
    if (p.shareOriginals) {
      const all = await blobs.all(p.id); const hrefs = {};
      for (const f of p.files || []) { const data = f.key && all[f.key]; if (data) { const path = 'assets/media/' + f.key.slice(4); assets[path] = data; hrefs[f.name] = path; } }
      let has = false;
      b.sections = b.sections.map((s) => { if (s.type !== 'materials') return s; has = true; return { ...s, items: (s.items || []).map((it) => (!it.href && hrefs[it.title] ? { ...it, href: hrefs[it.title] } : it)) }; });
      if (!has && Object.keys(hrefs).length) b.sections.splice(Math.max(0, b.sections.findIndex((s) => s.type === 'closing')), 0, { id: 'materials', type: 'materials', nav: '자료', title: '연수 자료', items: Object.entries(hrefs).map(([title, href]) => ({ title, href })) });
    }
    const r = await buildSite(b, assets, { ...p.info, skill: 'click' });
    if (r.errors.length) throw new Error(r.errors.map((e) => e.message_ko).join(' '));
    let files = r.files;
    if (b.access.mode === 'password') {
      if (!p.sitePassword || [...p.sitePassword].length < 4) throw new Error('암호를 4자 이상 정해 주세요.');
      setProg({ step: '내용 잠그는 중', pct: 5 });
      files = await E.protectSite(files, p.sitePassword, { runtime: await loadRuntime(), title: b.meta.title });
    }
    return { files, teacher: r.teacher };
  }
  /** 참여 기능이 켜져 있는데 연결 전이면 먼저 물어봄 */
  function guard(run) { if (liveOn && !liveReady) setAsk(() => run); else run({}); }
  async function zip(opts = {}) {
    setBusy('zip');
    try { const r = await buildFiles(opts); saveFile(safeName(p.title) + '.zip', E.zipFiles(r.files), 'application/zip'); toast('사이트 파일(ZIP)을 내려받았어요.'); }
    catch (e) { toast(e.message); }
    setBusy(''); setProg(null);
  }
  async function teacherDoc() {
    try { const r = await buildFiles(); saveFile(safeName(p.title) + '_운영안내.html', mdToHtml(r.teacher['운영안내.md'] || '', p.title), 'text/html'); }
    catch (e) { toast(e.message); }
  }
  function done(url, patch) { update((cur) => ({ deploy: { ...(cur.deploy || {}), ...patch, lastUrl: url, at: Date.now() }, blueprint: { ...cur.blueprint, meta: { ...cur.blueprint.meta, siteUrl: url } } })); }

  return (
    <>
      <StepHead title="공유하기" desc="누가 볼지 정하고, 참가자에게 보낼 주소를 만들어요." />
      {p.deploy?.lastUrl && <Success p={p} />}

      <Sheet>
        <div class="stack">
          <h2 class="h-sub">마지막 확인</h2>
          <ul class="warnings">{checks(p).map((c) => <li style={{ color: c.k === 'bad' ? 'var(--bad)' : c.k === 'ok' ? 'var(--ok)' : undefined }}>{c.k === 'ok' ? '✓' : c.k === 'bad' ? '✕' : '·'} {c.t}{c.go && <> <button class="btn btn-sm btn-quiet" onClick={() => go(c.go)}>고치러 가기</button></>}</li>)}</ul>

          <h2 class="h-sub sep">누가 볼 수 있나요?</h2>
          <div class="radio-cards" role="radiogroup" aria-label="공개 범위">
            {[['link', '주소를 받은 사람만', '검색에 나오지 않아요. 주소나 QR을 받은 사람만 들어와요.'], ['password', '암호를 아는 사람만', '교재 그림까지 암호로 잠가요. 안내 QR로 들어오면 바로 열려요.'], ['public', '누구나', '검색에도 나와요. 공개 강의 홍보용이에요.']].map(([v, t, d]) => (
              <label class="radio-card"><input type="radio" name="access" checked={access === v} onChange={() => setAccess(v)} /><span><b>{t}</b><small>{d}</small></span></label>
            ))}
          </div>
          {access === 'password' && (
            <div class="row" style={{ alignItems: 'end' }}>
              <Field label="암호(4자 이상, 길수록 안전해요)"><input type={showPw ? 'text' : 'password'} value={p.sitePassword || ''} onInput={(e) => update({ sitePassword: e.target.value })} autoComplete="new-password" /></Field>
              <button class="btn btn-sm btn-quiet" onClick={() => setShowPw(!showPw)}>{showPw ? '가리기' : '보기'}</button>
              <button class="btn btn-sm" onClick={() => update({ sitePassword: friendlyPassword() })}>새로 만들기</button>
            </div>
          )}
          <label class="check"><input type="checkbox" checked={!!p.shareOriginals} onChange={(e) => update({ shareOriginals: e.target.checked })} /><span>교재 원본(PPT·PDF)도 내려받게 하기 <span class="small muted">(저작권을 먼저 확인해 주세요)</span></span></label>

          {liveOn && <><h2 class="h-sub sep" id="live-setup">참여 기능 연결 <span class="small muted">{bp.live.features.length}개 켜짐</span></h2><LiveSetup p={p} update={update} /></>}

          <h2 class="h-sub sep">참가자에게 보낼 주소 만들기</h2>
          {prog && <div class="stack"><Progress pct={prog.pct} /><span class="small muted" aria-live="polite">{prog.step}</span></div>}
          <Netlify p={p} busy={busy} setBusy={setBusy} setProg={setProg} buildFiles={buildFiles} guard={guard} done={done} />
          <details>
            <summary><b>GitHub Pages에 올리기</b> <span class="small muted">무료 · 저장소가 공개돼요</span></summary>
            <GitHub p={p} busy={busy} setBusy={setBusy} setProg={setProg} buildFiles={buildFiles} guard={guard} done={done} />
          </details>
          <details>
            <summary><b>파일로 받기(ZIP)</b> <span class="small muted">학교 서버·USB에 올릴 때</span></summary>
            <div class="stack" style={{ marginTop: '10px' }}>
              <div><button class="btn" disabled={!!busy} onClick={() => guard(zip)}>{busy === 'zip' ? '만드는 중…' : '사이트 파일 받기(ZIP)'}</button></div>
              <ul class="small" style={{ display: 'grid', gap: '6px', margin: 0, paddingLeft: '1.2em' }}>
                <li><a href={`${DOCS}/cloudflare.md`} target="_blank" rel="noopener">Cloudflare</a>: 압축 푼 폴더를 끌어다 놓아요. 큰 연수에 좋아요.</li>
                <li><a href={`${DOCS}/netlify.md`} target="_blank" rel="noopener">Netlify Drop</a>: 계정 없이 끌어다 놓아요. 1시간 안에 계정을 연결해야 해요.</li>
                <li><a href={`${DOCS}/own-server-nginx-caddy.md`} target="_blank" rel="noopener">학교·기관 서버</a> · <a href={`${DOCS}/nas-synology.md`} target="_blank" rel="noopener">NAS</a> · <a href={`${DOCS}/aws-s3-cloudfront.md`} target="_blank" rel="noopener">AWS</a> · <a href={`${DOCS}/local-lan-classroom.md`} target="_blank" rel="noopener">인터넷 없는 교실</a> · <a href={`${DOCS}/zip-usb-offline.md`} target="_blank" rel="noopener">USB</a></li>
              </ul>
            </div>
          </details>
          <div class="btn-row"><button class="btn btn-sm btn-quiet" onClick={teacherDoc}>강사용 운영 안내 받기</button><span class="small muted">연수 전날 할 일과 강사 화면 쓰는 법. 사이트에는 올라가지 않아요.</span></div>
        </div>
      </Sheet>
      <div class="step-foot"><button class="btn btn-quiet" onClick={() => go(2)}>이전</button><a class="btn" href="#/">처음으로</a></div>

      <Dialog open={!!ask} onClose={() => setAsk(null)} label="참여 기능 확인">
        <h2 class="h-sub">참여 기능이 아직 연결되지 않았어요</h2>
        <p>지금 올리면 질문·막혔어요 같은 기능이 이 컴퓨터 밖에서는 동작하지 않아요. 연결은 10분이면 돼요.</p>
        <div class="btn-row">
          <button class="btn btn-primary" onClick={() => { setAsk(null); document.getElementById('live-setup')?.scrollIntoView({ block: 'start', behavior: 'smooth' }); }}>먼저 연결할게요</button>
          <button class="btn" onClick={() => { const run = ask; setAsk(null); run({ liveOff: true }); }}>참여 기능 없이 올리기</button>
        </div>
      </Dialog>
    </>
  );
}

function friendlyPassword() {
  const W = ['숲속', '바다', '햇살', '별빛', '구름', '나무', '노을', '새싹', '바람', '물결', '연필', '공책'];
  const b = crypto.getRandomValues(new Uint32Array(3));
  return `${W[b[0] % W.length]}${W[b[1] % W.length]}${String(1000 + (b[2] % 9000))}`;
}

function useToken(kind) {
  const [token, setToken] = useState('');
  const [remember, setRemember] = useState(false);
  useEffect(() => { loadKey('deploy-' + kind).then(({ key, remembered }) => { if (key) { setToken(key); setRemember(remembered); } }); }, []);
  return { token, setToken, remember, setRemember, save: () => saveKey('deploy-' + kind, token, remember), forget: async () => { await forgetKey('deploy-' + kind); setToken(''); toast('토큰을 지웠어요.'); } };
}

function Netlify({ p, busy, setBusy, setProg, buildFiles, guard, done }) {
  const t = useToken('netlify');
  const again = !!p.deploy?.netlify?.siteId;
  async function run(opts = {}) {
    setBusy('nl'); setProg({ step: '사이트 만드는 중', pct: 2 });
    try {
      await t.save();
      const r = await buildFiles(opts);
      const out = await deployNetlify({ token: t.token, siteId: p.deploy?.netlify?.siteId, zip: E.zipFiles(r.files), onProgress: setProg });
      done(out.url, { netlify: { siteId: out.siteId, url: out.url } });
      toast(again ? '새 버전을 같은 주소에 올렸어요.' : '주소를 만들었어요!'); window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { toast('올리지 못했어요: ' + e.message); }
    setBusy(''); setProg(null);
  }
  return (
    <div class="stack">
      <div class="spread"><b>Netlify로 주소 만들기 <span class="tag tag-lav">추천</span></b><span class="small muted">무료 · 다시 올려도 같은 주소</span></div>
      {!t.token && <ol class="how small"><li><a href="https://app.netlify.com/signup" target="_blank" rel="noopener">Netlify</a>에 가입해요(구글 계정 가능).</li><li><a href={NETLIFY_TOKEN_URL} target="_blank" rel="noopener">토큰 페이지</a>에서 <b>New access token</b> → 이름 lecpage → <b>Generate token</b>을 누르고 토큰을 복사해요.</li><li>아래에 붙여 넣고 [주소 만들기]를 눌러요.</li></ol>}
      <Field label="Netlify 토큰"><input type="password" autoComplete="off" value={t.token} onInput={(e) => t.setToken(e.target.value.trim())} placeholder="nfp_…" /></Field>
      <label class="check"><input type="checkbox" checked={t.remember} onChange={(e) => t.setRemember(e.target.checked)} /><span>이 기기에서 기억하기 <span class="small muted">다음부터 [다시 올리기]만 누르면 돼요.</span></span></label>
      <div class="btn-row"><button class="btn btn-primary btn-lg" disabled={!t.token || !!busy} onClick={() => guard(run)}>{busy === 'nl' ? '올리는 중…' : again ? '바뀐 내용 다시 올리기' : '주소 만들기'}</button>{t.token && <button class="btn btn-sm btn-quiet" onClick={t.forget}>토큰 지우기</button>}</div>
    </div>
  );
}

function GitHub({ p, busy, setBusy, setProg, buildFiles, guard, done }) {
  const t = useToken('github');
  const [repo, setRepo] = useState(p.deploy?.github?.repo || asciiSlug(p.info?.date));
  const [confirm, setConfirm] = useState(false);
  async function run(opts = {}, allowExisting = false) {
    setBusy('gh'); setProg({ step: '준비', pct: 1 });
    try {
      await t.save();
      const r = await buildFiles(opts);
      const name = repo.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || asciiSlug();
      const out = await deployGitHub({ token: t.token, repo: name, files: r.files, onProgress: setProg, allowExisting: allowExisting || p.deploy?.github?.repo === name });
      done(out.url, { github: { repo: name, url: out.url } }); toast('GitHub Pages에 올렸어요. 처음에는 1~2분 뒤 열려요.');
    } catch (e) { if (e.code === 'exists') setConfirm(() => (o) => run(o, true)); else toast('올리지 못했어요: ' + e.message); }
    setBusy(''); setProg(null);
  }
  return (
    <div class="stack" style={{ marginTop: '10px' }}>
      <ol class="how small"><li><a href={GITHUB_TOKEN_URL} target="_blank" rel="noopener">토큰 만들기</a>를 열고 맨 아래 <b>Generate token</b>을 눌러요. 권한은 미리 채워져 있어요.</li><li>토큰을 붙여 넣고 올려요.</li></ol>
      <div class="form-grid">
        <Field label="GitHub 토큰"><input type="password" autoComplete="off" value={t.token} onInput={(e) => t.setToken(e.target.value.trim())} placeholder="github_pat_…" /></Field>
        <Field label="저장소 이름" hint="영문 소문자·숫자·하이픈. 주소에 들어가요."><input value={repo} onInput={(e) => setRepo(e.target.value)} /></Field>
      </div>
      <label class="check"><input type="checkbox" checked={t.remember} onChange={(e) => t.setRemember(e.target.checked)} /><span>이 기기에서 기억하기</span></label>
      <div><button class="btn btn-ink" disabled={!t.token || !!busy} onClick={() => guard(run)}>{busy === 'gh' ? '올리는 중…' : 'GitHub Pages에 올리기'}</button></div>
      <Dialog open={!!confirm} onClose={() => setConfirm(false)} label="저장소 덮어쓰기 확인">
        <h2 class="h-sub">이미 있는 저장소예요</h2>
        <p>"{repo}" 저장소가 이미 있어요. 올리면 그 안의 파일이 연수 사이트로 모두 바뀌어요. 다른 이름을 쓰는 것이 안전해요.</p>
        <div class="btn-row"><button class="btn" onClick={() => { setConfirm(false); setRepo(asciiSlug(p.info?.date)); }}>다른 이름 쓰기</button><button class="btn btn-danger" onClick={() => { const r = confirm; setConfirm(false); r({}); }}>그래도 바꾸기</button></div>
      </Dialog>
    </div>
  );
}

function Success({ p }) {
  const url = p.deploy.lastUrl.replace(/\/?$/, '/');
  const pw = p.blueprint.access?.mode === 'password' ? p.sitePassword : '';
  const shareUrl = pw ? E.unlockUrl(url, pw) : url;
  const m = p.blueprint.meta || {};
  const when = [m.date, m.start && `${m.start}${m.end ? '~' + m.end : ''}`].filter(Boolean).join(' ');
  const msg = `[${m.title}] 연수 사이트예요.\n${[when, m.venue].filter(Boolean).join(' · ')}\n👉 ${shareUrl}\n들어가서 '참여하기'를 눌러 주세요.`;
  const liveOn = (p.blueprint.live?.features || []).length > 0;
  return (
    <Sheet class="success">
      <div class="success-in">
        <div class="stack">
          <div class="row"><Mascot size={48} mood="happy" /><h2 class="h-sub">참가자에게 보낼 주소가 생겼어요</h2></div>
          <a class="big-url" href={shareUrl} target="_blank" rel="noopener">{url}</a>
          {pw && <p class="small">암호: <b class="mono">{pw}</b> · QR과 안내 문구의 주소는 암호 없이 바로 열려요.</p>}
          <div class="btn-row">
            <button class="btn btn-primary" onClick={() => copy(shareUrl, '주소를 복사했어요.')}>주소 복사</button>
            <button class="btn" onClick={() => copy(msg, '카톡에 붙여 넣을 안내 문구를 복사했어요.')}>카톡용 안내 문구 복사</button>
            <button class="btn" onClick={async () => saveFile(safeName(m.title) + '_QR.png', await qrPng(shareUrl), 'image/png')}>QR 그림 저장</button>
          </div>
          <div class="btn-row">
            <a class="btn btn-sm" href={url + 'poster.html'} target="_blank" rel="noopener">QR 안내문 인쇄(A4)</a>
            <a class="btn btn-sm" href={url + 'screen.html'} target="_blank" rel="noopener">발표 화면(QR) 열기</a>
            {liveOn && <a class="btn btn-sm" href={url + 'console.html'} target="_blank" rel="noopener">강사 화면 열기</a>}
          </div>
          {liveOn && <p class="small muted">강사 화면에는 관리자 키로 들어가요.</p>}
          <p class="small muted">고친 뒤 [바뀐 내용 다시 올리기]를 누르면 같은 주소에 새 내용이 올라가요.</p>
        </div>
        <div class="qr-box"><QR text={shareUrl} size={180} label="참가자용 QR 코드" /></div>
      </div>
    </Sheet>
  );
}
