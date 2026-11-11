import { useEffect, useState } from 'preact/hooks';
import { StepHead } from '../Project.jsx';
import { Sheet, Field, Notice, Progress, Dialog } from '../../components/ui.jsx';
import { Mascot } from '../../components/Mascot.jsx';
import { QR, qrPng } from '../../components/QR.jsx';
import { LiveSetup } from '../../components/LiveSetup.jsx';
import { projectAssets } from '../../components/Preview.jsx';
import { buildSite, loadRuntime, E } from '../../lib/engine.js';
import { blobs } from '../../lib/db.js';
import { Publish } from '../../components/Publish.jsx';
import { probeSite } from '../../lib/deploy.js';
import { saveFile, safeName, toast, copy } from '../../lib/util.js';

const LIVE_READY = (live, ok) => ['sheets', 'supabase', 'http'].includes(live?.provider) && live?.url && ok;

function checks(p) {
  const bp = p.blueprint; const v = E.validate(bp); const b = v.blueprint; const out = [];
  if (!b.meta.date) out.push({ k: 'warn', t: '날짜가 비어 있어요(첫 화면·일정에 보여요).', go: 1 });
  const deck = b.sections.find((s) => s.type === 'deck');
  if (deck && deck.slides.some((s) => !s.src)) out.push({ k: 'info', t: '교재 보기에 그림이 없는 쪽이 있어요. PDF를 넣으면 그림이 생겨요.', go: 1 });
  if (b.live.features.length && !LIVE_READY(b.live, p.liveOk)) out.push({ k: 'warn', t: '참여 기능이 아직 연결되지 않았어요. 맨 아래에서 10분이면 연결돼요.' });
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
  const [liveOpen, setLiveOpen] = useState(false);
  if (!bp) return <><StepHead title="공개하기" /><Notice>먼저 사이트 초안을 만들어 주세요.</Notice><div><button class="btn btn-primary" onClick={() => go(1)}>초안 만들러 가기</button></div></>;
  const access = bp.access?.mode || 'link';
  const liveOn = (bp.live?.features || []).length > 0;
  const liveReady = LIVE_READY(bp.live, p.liveOk);
  const setAccess = (mode) => update((cur) => ({ blueprint: { ...cur.blueprint, access: { mode } }, sitePassword: mode === 'password' && !cur.sitePassword ? friendlyPassword() : cur.sitePassword }));

  async function buildFiles({ liveOff = false } = {}) {
    const assets = { ...(await projectAssets(p.id, true)) };
    let b = JSON.parse(JSON.stringify(bp));
    // 자료실에서 뺀 파일은 올리지 않음(이 브라우저에서도 지움)
    const used = new Set(b.sections.filter((x) => x.type === 'materials').flatMap((x) => (x.items || []).map((it) => String(it?.href || it?.url || ''))));
    for (const k of Object.keys(assets)) if (k.startsWith('assets/files/') && !used.has(k)) { delete assets[k]; blobs.remove(p.id, k).catch(() => { }); }
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
    if (b.access?.mode === 'password') {
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
  /** 강사용 파일 묶음: 운영 안내(HTML·MD), 디자인 규칙(DESIGN.md), 설계도(다시 고치거나 AI에게 줄 때). 사이트에는 넣지 않음 */
  async function teacherDoc() {
    try {
      const r = await buildFiles(); const t = r.teacher || {};
      const files = { '운영안내.html': mdToHtml(t['운영안내.md'] || '', p.title) };
      for (const [k, v] of Object.entries(t)) files[k] = v;
      saveFile(safeName(p.title) + '_강사용.zip', E.zipFiles(files), 'application/zip');
      toast('강사용 파일을 내려받았어요.');
    } catch (e) { toast(e.message); }
  }
  /** 공개한 뒤 자료 더 넣기: 자료실이 없으면 마무리 앞에 만들고, 고치기 화면에서 그 섹션을 엶 */
  function addMaterials() {
    let id = (bp.sections.find((x) => x.type === 'materials') || {}).id;
    if (!id) {
      id = 'materials';
      update((cur) => { const secs = cur.blueprint.sections.slice(); const at = secs.findIndex((x) => x.type === 'closing'); secs.splice(at < 0 ? secs.length : at, 0, { id, type: 'materials', nav: '자료', title: '연수 자료', items: [] }); return { blueprint: { ...cur.blueprint, sections: secs } }; });
    }
    try { sessionStorage.setItem('lecpage:focus', id); } catch { }
    go(2);
  }
  function done(url, patch) { update((cur) => ({ deploy: { ...(cur.deploy || {}), ...patch, lastUrl: url, at: Date.now() }, blueprint: { ...cur.blueprint, meta: { ...cur.blueprint.meta, siteUrl: url } } })); }

  return (
    <>
      <StepHead title="공개하기" desc="누가 볼지 정하고 [공개하기]를 누르면 참가자에게 보낼 주소와 QR이 나와요." />
      {p.deploy?.lastUrl && <Success p={p} onAddMaterials={addMaterials} />}

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

          <h2 class="h-sub sep">어디에 공개할까요?</h2>
          {prog && <div class="stack"><Progress pct={prog.pct} /><span class="small muted" aria-live="polite">{prog.step}</span></div>}
          <Publish p={p} busy={busy} setBusy={setBusy} setProg={setProg} buildFiles={buildFiles} guard={guard} done={done} zip={zip} />
          <p class="small muted">공개하면 <a href="#/help/terms">이용약관</a>에 따라 올린 내용은 올린 분이 책임져요. 교재의 저작권과 개인정보를 확인해 주세요.</p>
          <div class="btn-row"><button class="btn btn-sm" onClick={teacherDoc}>강사용 파일 받기(ZIP)</button><span class="small muted">운영 안내·디자인 규칙·설계도. 사이트에는 올라가지 않아요.</span></div>
          {liveOn && <details class="more" id="live-setup" open={liveOpen} onToggle={(e) => setLiveOpen(e.target.open)}>
            <summary><b>참여 기능 연결</b><span class="small muted">{bp.live.features.length}개 켜짐 · {liveReady ? '연결됨' : '아직 연결 안 됨'}</span></summary>
            <div class="stack more-body">
              <p class="small muted">질문·투표 같은 참여 기능은 강사의 구글 시트나 Supabase에 연결해야 참가자끼리 이어져요. 연결하지 않아도 사이트는 공개할 수 있어요.</p>
              <LiveSetup p={p} update={update} />
            </div>
          </details>}
        </div>
      </Sheet>
      <div class="step-foot"><button class="btn btn-quiet" onClick={() => go(2)}>이전</button><a class="btn" href="#/">처음으로</a></div>

      <Dialog open={!!ask} onClose={() => setAsk(null)} label="참여 기능 확인">
        <h2 class="h-sub">참여 기능이 아직 연결되지 않았어요</h2>
        <p>지금 올리면 질문·도움 요청 같은 기능이 이 컴퓨터 밖에서는 동작하지 않아요. 연결은 10분이면 돼요.</p>
        <div class="btn-row">
          <button class="btn btn-primary" onClick={() => { setAsk(null); setLiveOpen(true); setTimeout(() => document.getElementById('live-setup')?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 60); }}>먼저 연결할게요</button>
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

/** 올린 주소가 참가자에게 실제로 열리는지 확인(GitHub Pages는 1~2분, 로그인 창이 걸려 있으면 열리지 않음) */
function OpenState({ url, at }) {
  const [st, setSt] = useState('wait');
  useEffect(() => {
    if (!/^https:/.test(url)) { setSt('skip'); return undefined; }
    let off = false, n = 0, timer = 0; setSt('wait');
    (async function tick() {
      const ok = await probeSite(url); if (off) return;
      if (ok) setSt('ok'); else if (++n >= 18) setSt('no'); else timer = setTimeout(tick, 10000);
    })();
    return () => { off = true; clearTimeout(timer); };
  }, [url, at]);
  if (st === 'skip') return null;
  return <p class="open-state" aria-live="polite"><span class={`ok-dot${st === 'ok' ? '' : ' wait'}`} aria-hidden="true" />{st === 'ok' ? '지금 열려요.' : st === 'wait' ? '열리는지 확인하는 중이에요. 처음에는 1~2분 걸릴 수 있어요.' : '아직 열리지 않아요. 주소를 직접 열어 확인해 주세요.'}</p>;
}

function Success({ p, onAddMaterials }) {
  const url = p.deploy.lastUrl.replace(/\/?$/, '/');
  const pw = p.blueprint.access?.mode === 'password' ? p.sitePassword : '';
  const shareUrl = pw ? E.unlockUrl(url, pw) : url;
  const m = p.blueprint.meta || {};
  const when = [m.date, m.start && `${m.start}${m.end ? '~' + m.end : ''}`].filter(Boolean).join(' ');
  const liveOn = (p.blueprint.live?.features || []).length > 0;
  const msg = `[${m.title}] 연수 사이트예요.\n${[when, m.venue].filter(Boolean).join(' · ')}\n👉 ${shareUrl}${liveOn ? '\n연수 중에 이 사이트로 질문하고 참여해요.' : ''}`;
  return (
    <Sheet class="success">
      <div class="success-in">
        <div class="stack">
          <div class="row"><Mascot size={48} mood="happy" /><h2 class="h-sub">참가자에게 보낼 주소가 생겼어요</h2></div>
          <a class="big-url" href={shareUrl} target="_blank" rel="noopener">{url}</a>
          {p.deploy.target === 'lecpage' ? (p.deploy.lecpage?.expiresAt ? <p class="open-state"><span class="ok-dot" aria-hidden="true" />{new Date(p.deploy.lecpage.expiresAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}까지 열려 있어요.</p> : null) : <OpenState url={url} at={p.deploy.at} />}
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
          <p class="small muted">자료를 더 넣거나 내용을 고친 뒤 아래 [바뀐 내용 다시 올리기]를 누르면 같은 주소에 반영돼요. <button type="button" class="btn btn-sm btn-quiet" onClick={onAddMaterials}>자료 올리기</button></p>
        </div>
        <div class="qr-box"><QR text={shareUrl} size={180} label="참가자용 QR 코드" /></div>
      </div>
    </Sheet>
  );
}
