import { useEffect, useRef, useState } from 'preact/hooks';
import { StepHead } from '../Project.jsx';
import { Sheet, Field, Notice, Progress, Dialog } from '../../components/ui.jsx';
import { Mascot } from '../../components/Mascot.jsx';
import { QR, qrPng, copyQr } from '../../components/QR.jsx';
import { LiveSetup, adminKeyFor } from '../../components/LiveSetup.jsx';
import { projectAssets } from '../../components/Preview.jsx';
import { buildSite, loadRuntime, E } from '../../lib/engine.js';
import { blobs } from '../../lib/db.js';
import { Publish } from '../../components/Publish.jsx';
import { probeSite, instantInfo, shortenUrl, shortName, checkShortUrl, showUrl, SHORTENERS } from '../../lib/deploy.js';
import { saveFile, safeName, toast, copy } from '../../lib/util.js';
import { VenueBody, RescueKit, useDayStatus, dayLine } from '../../components/VenueCheck.jsx';
import { kitHtml, printHtml } from '../../lib/venue.js';
import { reach } from '../../lib/netcheck.js';
import { FEATURES, LIVE_KEYS, syncInfo } from '../../lib/blueprint.js';

const same = (u) => String(u || '').replace(/^https?:\/\//, '').replace(/\/+$/, '');
const LIVE_READY = (live, ok) => ['sheets', 'supabase', 'http'].includes(live?.provider) && live?.url && ok;
const LIVE_NAME = { sheets: '구글 시트', supabase: 'Supabase', http: '내 서버' };

/** 공개 전에 볼 곳(참여 기능 연결은 체크리스트 첫 줄이 맡음) */
function checks(p) {
  const bp = p.blueprint; const v = E.validate(bp); const b = v.blueprint; const out = [];
  if (!b.meta.date) out.push({ k: 'warn', t: '날짜가 비어 있어요(첫 화면·일정에 보여요).', go: 1 });
  const deck = b.sections.find((s) => s.type === 'deck');
  if (deck && deck.slides.some((s) => !s.src)) out.push({ k: 'info', t: '교재 보기에 그림이 없는 쪽이 있어요. PDF를 넣으면 그림이 생겨요.', go: 1 });
  for (const w of v.warnings.slice(0, 5)) out.push({ k: 'info', t: w.message_ko });
  return out;
}

/**
 * 글꼴 함께 담기 기본값(docs/research/school-network-2026-11.md §6): 학교·기관 망이 글꼴 CDN을 막으면 첫 화면이 늦게 뜨거나 글꼴이 바뀜
 * → 쓰인 글자가 든 조각·쓰는 굵기·woff2만 사이트 안에 담음(외부 요청 0). 빼는 곳: 바로 공개의 Worker 보기(글꼴 파일 요청도 하루 한도에 듦),
 * 그림·파일이 40개를 넘게 되는 GitHub Pages(파일마다 천천히 올림)
 */
const FONT_HOSTS = ['lecpage', 'vercel', 'netlify', 'cloudflare', 'zip', 'github-pages'];
const bins = (files) => Object.keys(files).filter((k) => !/\.(html|css|js|json|md|svg|txt|webmanifest)$/i.test(k)).length;
async function withFonts(files, { target, view }) {
  if (!FONT_HOSTS.includes(target) || (target === 'lecpage' && view !== 'pages')) return { files, note: '' };
  const get = (u) => { const c = new AbortController(); const t = setTimeout(() => c.abort(), 8000); return fetch(u, { mode: 'cors', credentials: 'omit', signal: c.signal }).finally(() => clearTimeout(t)); };
  const fb = await E.bundleFonts(files, { fetch: get });
  if (!fb.report.ok) return { files, note: '글꼴 서버에 닿지 않아 글꼴을 사이트에 담지 못했어요. 연수 장소에서 글꼴이 늦게 뜨거나 바뀌어 보일 수 있어요.' };
  if (target === 'github-pages' && bins(fb.files) > 40) return { files, note: '' };
  return { files: fb.files, note: '' };
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
  const [autoLive, setAutoLive] = useState(false); // 운영자의 바로 공개 서버가 참여 기능까지 맡는지
  const [target, setTarget] = useState(''); // 지금 고른 올릴 곳(Publish가 알려 줌)
  const [skipLive, setSkipLive] = useState(false); // 이번에는 참여 기능 없이 올리기
  const [open, setOpen] = useState({}); // 체크리스트에서 [바꾸기]로 펼친 줄
  const [fontNote, setFontNote] = useState(''); // 글꼴을 사이트에 담지 못했을 때 한 줄
  const toggle = (k) => setOpen((o) => ({ ...o, [k]: !o[k] }));
  const built = useRef(''); const again = useRef(null);
  useEffect(() => { instantInfo().then((i) => setAutoLive(!!i?.live?.url)); }, []);
  // 고치기 화면의 [바뀐 내용 다시 올리기]로 왔으면: 지난번 곳이 연결돼 있는 대로 바로 올림(연결을 읽는 동안 잠깐 기다림)
  useEffect(() => {
    let id = ''; try { id = sessionStorage.getItem('lecpage:republish') || ''; sessionStorage.removeItem('lecpage:republish'); } catch { }
    if (id !== p.id) return;
    let n = 0; const t = setInterval(() => { if (again.current) { clearInterval(t); again.current(); } else if (++n > 30) { clearInterval(t); document.querySelector('.publish')?.scrollIntoView({ block: 'center' }); } }, 100);
    return () => clearInterval(t);
  }, []);
  // 연수 장소 확인(공개 전): 바로 공개면 그날 몫을 미리(상태 API 한 번). 공개 뒤에는 공개 카드의 '연수 전날 점검'이 접속 확인 QR·달력 일정을 줌
  const instantHere = target === 'lecpage' || (!target && autoLive);
  const [daySt] = useDayStatus({ on: !!bp && instantHere && !p.deploy?.lastUrl, date: bp?.meta?.date || '', site: '' });
  if (!bp) return <><StepHead title="공개하기" /><Notice>먼저 사이트 초안을 만들어 주세요.</Notice><div><button class="btn btn-primary" onClick={() => go(1)}>초안 만들러 가기</button></div></>;
  const access = bp.access?.mode || 'link';
  const liveOn = (bp.live?.features || []).length > 0;
  const liveReady = LIVE_READY(bp.live, p.liveOk);
  const setAccess = (mode) => update((cur) => ({ blueprint: { ...cur.blueprint, access: { mode } }, sitePassword: mode === 'password' && !cur.sitePassword ? friendlyPassword() : cur.sitePassword }));

  async function buildFiles({ liveOff = false, live = null, processor = null, dry = false, target: to = '', view = '' } = {}) {
    const assets = { ...(await projectAssets(p.id, true)) };
    let b = JSON.parse(JSON.stringify(bp));
    if (!dry) built.current = b.meta?.shortUrl || ''; // 이번에 만든 사이트에 들어간 짧은 주소(올린 뒤 달라지면 다시 올리라고 알림)
    // 자료실에서 뺀 파일은 올리지 않음(이 브라우저에서도 지움)
    const used = new Set(b.sections.filter((x) => x.type === 'materials').flatMap((x) => (x.items || []).map((it) => String(it?.href || it?.url || ''))));
    for (const k of Object.keys(assets)) if (k.startsWith('assets/files/') && !used.has(k)) { delete assets[k]; blobs.remove(p.id, k).catch(() => { }); }
    if (live) { // 바로 공개: 참여 기능을 올리는 서버가 맡음 → 개인정보 안내에 그 서버를 적음
      b.live = { ...b.live, ...live };
      if (processor && !(b.privacy?.processors || []).length) b.privacy = { ...(b.privacy || {}), processors: [processor] };
    }
    else if (liveOff || !liveReady) b.live = { ...b.live, provider: liveOff ? 'none' : b.live.provider };
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
    if (!dry && to) { setProg({ step: '글꼴 담는 중', pct: 3 }); const f = await withFonts(files, { target: to, view }); files = f.files; setFontNote(f.note); }
    if (b.access?.mode === 'password') {
      if (!p.sitePassword || [...p.sitePassword].length < 4) throw new Error('암호를 4자 이상 정해 주세요.');
      setProg({ step: '내용 잠그는 중', pct: 5 });
      files = await E.protectSite(files, p.sitePassword, { runtime: await loadRuntime(), title: b.meta.title });
    }
    return { files, teacher: r.teacher };
  }
  /** 참여 기능이 켜져 있는데 연결 전이면 먼저 물어봄. [이번엔 빼고 올리기]를 골랐으면 묻지 않고 참여 기능 없이 */
  function guard(run, auto = false) { if (liveOn && !liveReady && !auto && !skipLive) setAsk(() => run); else run(liveOn && !liveReady && !auto && skipLive ? { liveOff: true } : {}); }
  const setInfo = (patch) => update((cur) => { const info = { ...cur.info, ...patch }; return { info, infoTouched: true, blueprint: syncInfo(cur.blueprint, info, patch) }; });
  const feats = (p.info.features || []).filter((f) => LIVE_KEYS.includes(f));
  const toggleFeat = (v) => setInfo({ features: (p.info.features || []).includes(v) ? (p.info.features || []).filter((x) => x !== v) : [...(p.info.features || []), v] });
  const goLive = () => { setOpen((o) => ({ ...o, live: true })); setTimeout(() => document.getElementById('live-setup')?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 60); };
  async function zip(opts = {}) {
    setBusy('zip');
    try { const r = await buildFiles({ target: 'zip', ...opts }); saveFile(safeName(p.title) + '.zip', E.zipFiles(r.files), 'application/zip'); toast('사이트 파일(ZIP)을 내려받았어요.'); }
    catch (e) { toast(e.message); }
    setBusy(''); setProg(null);
  }
  /** 강사용 파일 묶음: 운영 안내(HTML·MD), 디자인 규칙(DESIGN.md), 설계도(다시 고치거나 AI에게 줄 때). 사이트에는 넣지 않음 */
  async function teacherDoc() {
    try {
      const r = await buildFiles({ dry: true }); const t = r.teacher || {};
      const files = { '운영안내.html': mdToHtml(t['운영안내.md'] || '', p.title) };
      for (const [k, v] of Object.entries(t)) files[k] = v;
      // 연수 당일 대비: 인터넷이 안 될 때 나눠 줄 인쇄본, 공개했으면 '혹시 안 열리면' 한 장(두 번째 주소·휴대폰 데이터·USB)
      files['실습프롬프트모음.html'] = printHtml(bp);
      const url = p.deploy?.lastUrl;
      if (url) {
        const pw = bp.access?.mode === 'password' ? p.sitePassword : '';
        files['혹시안열리면.html'] = kitHtml({ title: p.title, siteUrl: url, shareUrl: pw ? E.unlockUrl(url.replace(/\/?$/, '/'), pw) : '', altUrl: p.deploy?.target === 'lecpage' ? p.deploy?.lecpage?.altUrl || '' : '', second: p.deploy?.second || '', live: (bp.live?.features || []).length > 0, zipName: safeName(p.title) + '.zip' });
      }
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
  function done(url, patch, more) {
    // 주소가 바뀌면(다른 곳에 올림·내림) 예전 짧은 주소는 옛 사이트를 가리키므로 지움
    const moved = !url || (!!p.deploy?.lastUrl && same(url) !== same(p.deploy.lastUrl));
    if (moved && bp.meta?.shortUrl) toast('사이트 주소가 바뀌어 짧은 주소를 지웠어요. 다시 만들어 주세요.');
    update((cur) => ({
      deploy: { ...(cur.deploy || {}), ...patch, lastUrl: url, at: Date.now(), shortLive: moved ? '' : built.current },
      blueprint: { ...cur.blueprint, meta: { ...cur.blueprint.meta, siteUrl: url, ...(moved ? { shortUrl: '' } : {}) }, ...(more?.live ? { live: { ...cur.blueprint.live, ...more.live } } : {}) },
      ...(more && 'liveOk' in more ? { liveOk: more.liveOk } : {}),
    }));
  }
  /** 성공 카드의 [다시 올리기]: 지난번에 올린 곳이 연결돼 있으면 바로 올리고, 아니면 올리는 곳으로 내려감 */
  function republish() {
    if (busy) return;
    if (again.current) again.current();
    else document.querySelector('.publish')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  // 공개 준비 체크리스트: 참여 기능 → 공개 범위 → 확인할 곳 → 올릴 곳(+공개하기). 끝난 줄은 한 줄로 접히고 [바꾸기]로 펼침
  const names = feats.map((f) => FEATURES.find((x) => x.value === f)?.label || f);
  const featLine = names.length > 3 ? `${names.slice(0, 3).join('·')} 외 ${names.length - 3}개` : names.join('·');
  const autoHere = autoLive && target === 'lecpage';
  const liveState = !liveOn ? 'off' : autoHere ? 'auto' : liveReady ? 'ok' : skipLive ? 'skip' : 'todo';
  const liveLine = { off: '꺼져 있어요. 쓸 기능을 누르면 켜져요.', auto: `${featLine} · 바로 공개가 함께 켜요.`, ok: `${featLine} · ${LIVE_NAME[bp.live?.provider] || '서버'}에 연결돼 있어요.`, skip: '이번에는 참여 기능 없이 올려요.', todo: `${featLine} · 아직 연결 전이에요.` }[liveState];
  const liveBody = open.live || liveState === 'todo' || liveState === 'off'; // 꺼져 있으면 고를 기능을 바로 보여 줌
  const ACCESS = { link: '주소를 받은 사람만', password: '암호를 아는 사람만', public: '누구나' };
  const needPw = access === 'password' && !p.sitePassword;
  const notes = checks(p);
  const day = dayLine(daySt, bp.meta?.date);
  const rows = [];
  rows.push({ k: 'live', id: 'live-setup', title: '참여 기능', state: liveState === 'todo' ? 'todo' : 'done', line: liveLine,
    btn: liveState === 'todo' || liveState === 'off' ? null : liveState === 'skip' ? ['되돌리기', () => setSkipLive(false)] : [open.live ? '접기' : '바꾸기', () => toggle('live')],
    body: liveBody && <>
      <div class="chips feat-chips" role="group" aria-label="켤 참여 기능">
        {FEATURES.map((x) => <button type="button" class="chip" aria-pressed={String(feats.includes(x.value))} title={x.desc} onClick={() => toggleFeat(x.value)}>{x.label}</button>)}
      </div>
      {liveOn && !autoHere && <LiveSetup p={p} update={update} />}
      {liveOn && autoLive && !autoHere && <p class="small muted">아래 올릴 곳을 바로 공개로 바꾸면 따로 연결할 것 없이 켜져요.</p>}
      {liveState === 'todo' && <div class="btn-row"><button type="button" class="btn btn-sm btn-quiet" onClick={() => { setSkipLive(true); setOpen((o) => ({ ...o, live: false })); }}>참여 기능 빼고 올리기</button></div>}
    </> });
  rows.push({ k: 'access', title: '공개 범위', state: needPw ? 'todo' : 'done', line: `${ACCESS[access]}${p.shareOriginals ? ' · 교재 원본도 내려받기' : ''}`,
    btn: needPw ? null : [open.access ? '접기' : '바꾸기', () => toggle('access')],
    body: (open.access || needPw) && <>
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
      {access === 'password' && p.sitePassword && E.passwordAdvice(p.sitePassword).level !== 'good' && <p class="small" role="status">{E.passwordAdvice(p.sitePassword).message}</p>}
      <label class="check"><input type="checkbox" checked={!!p.shareOriginals} onChange={(e) => update({ shareOriginals: e.target.checked })} /><span>교재 원본(PPT·PDF)도 내려받게 하기 <span class="small muted">(저작권을 먼저 확인해 주세요)</span></span></label>
    </> });
  if (notes.length) rows.push({ k: 'notes', title: '확인할 곳', state: 'note', line: `${notes.length}곳. 그대로 올려도 돼요.`,
    btn: [open.notes === false ? '보기' : '접기', () => setOpen((o) => ({ ...o, notes: o.notes === false }))],
    body: open.notes !== false && <ul class="warnings">{notes.map((c) => <li>· {c.t}{c.go && <> <button class="btn btn-sm btn-quiet" onClick={() => go(c.go)}>고치러 가기</button></>}</li>)}</ul> });
  if (!p.deploy?.lastUrl) rows.push({ k: 'venue', title: '연수 장소 확인', state: day?.k === 'full' ? 'todo' : 'note', line: day && day.k !== 'ok' ? '' : '공개한 뒤 연수 전날, 그곳 Wi-Fi로 열리는지 확인해요.',
    btn: day && day.k !== 'ok' ? null : [open.venue ? '접기' : '보기', () => toggle('venue')],
    body: (open.venue || (day && day.k !== 'ok')) && <VenueBody p={p} url="" instantOn={instantHere} /> });
  rows.push({ k: 'host', title: '올릴 곳', state: 'go', line: '',
    body: <>
      {prog && <div class="stack"><Progress pct={prog.pct} /><span class="small muted" aria-live="polite">{prog.step}</span></div>}
      <Publish p={p} busy={busy} setBusy={setBusy} setProg={setProg} buildFiles={buildFiles} guard={guard} done={done} zip={zip} again={again} onTarget={setTarget} />
    </> });

  return (
    <>
      <StepHead title="공개하기" desc={p.deploy?.lastUrl ? '고친 내용은 [바뀐 내용 다시 올리기]로 같은 주소에 반영돼요.' : '아래 순서대로 확인하고 [공개하기]를 누르면 참가자에게 보낼 주소와 QR이 나와요.'} />
      {p.deploy?.lastUrl && <Success p={p} update={update} onAddMaterials={addMaterials} onRepublish={republish} busy={busy} onZip={() => guard((o) => zip(o))} instantOn={!!autoLive || p.deploy?.target === 'lecpage'} fontNote={fontNote} />}

      <Sheet>
        <div class="stack">
          <h2 class="h-sub">{p.deploy?.lastUrl ? '다시 올리기' : '공개 준비'}</h2>
          <ol class="ready" aria-label="공개 준비">
            {rows.map((r, i) => (
              <li class={`ready-i is-${r.state}`} id={r.id} key={r.k}>
                <div class="ready-h">
                  <span class="ready-n" aria-hidden="true">{r.state === 'done' ? '✓' : i + 1}</span>
                  <b class="ready-t">{r.title}</b>
                  {r.line && <span class="ready-s">{r.line}</span>}
                  {r.btn && <button type="button" class="btn btn-sm btn-quiet" aria-expanded={r.body ? 'true' : 'false'} onClick={r.btn[1]}>{r.btn[0]}</button>}
                </div>
                {r.body && <div class="ready-b">{r.body}</div>}
              </li>
            ))}
          </ol>
          <p class="small muted">공개하면 <a href="#/help/terms">이용약관</a>에 따라 올린 내용은 올린 분이 책임져요. 교재의 저작권과 개인정보를 확인해 주세요.</p>
          <div class="btn-row"><button class="btn btn-sm" onClick={teacherDoc}>강사용 파일 받기(ZIP)</button><span class="small muted">운영 안내·디자인 규칙·설계도. 사이트에는 올라가지 않아요.</span></div>
        </div>
      </Sheet>
      <div class="step-foot"><button class="btn btn-quiet" onClick={() => go(2)}>이전</button><a class="btn" href="#/">처음으로</a></div>

      <Dialog open={!!ask} onClose={() => setAsk(null)} label="참여 기능 확인">
        <h2 class="h-sub">참여 기능이 아직 연결되지 않았어요</h2>
        <p>지금 올리면 질문·투표 같은 기능이 참가자끼리 이어지지 않아요. 나중에 연결하고 다시 올려도 돼요.</p>
        <div class="btn-row">
          <button class="btn btn-primary" onClick={() => { setAsk(null); goLive(); }}>먼저 연결할게요</button>
          <button class="btn" onClick={() => { const run = ask; setAsk(null); setSkipLive(true); run({ liveOff: true }); }}>참여 기능 없이 올리기</button>
        </div>
      </Dialog>
    </>
  );
}

/** 사람이 읽고 칠 수 있는 암호(낱말 셋 + 숫자 넷). 만드는 법은 엔진 하나(engine/src/protect.js) */
const friendlyPassword = () => E.friendlyPassword();

/** 올린 주소가 참가자에게 실제로 열리는지 확인(GitHub Pages는 보통 1~2분, 길면 10분. 로그인 창이 걸려 있으면 열리지 않음) */
function OpenState({ url, at }) {
  const [st, setSt] = useState('wait');
  useEffect(() => {
    if (!/^https:/.test(url)) { setSt('skip'); return undefined; }
    let off = false, n = 0, timer = 0; setSt('wait');
    (async function tick() {
      const ok = await probeSite(url); if (off) return;
      // 처음 3분은 10초마다, 그 뒤 10분까지는 30초마다
      if (ok) setSt('ok'); else if (++n >= 32) setSt('no'); else { if (n === 18) setSt('slow'); timer = setTimeout(tick, n < 18 ? 10000 : 30000); }
    })();
    return () => { off = true; clearTimeout(timer); };
  }, [url, at]);
  if (st === 'skip') return null;
  return <p class="open-state" aria-live="polite"><span class={`ok-dot${st === 'ok' ? '' : ' wait'}`} aria-hidden="true" />{st === 'ok' ? '지금 열려요.' : st === 'wait' ? '열리는지 확인하는 중이에요. 처음에는 1~2분 걸릴 수 있어요.' : st === 'slow' ? '아직 확인하는 중이에요. 길면 10분까지 걸려요.' : '아직 열리지 않아요. 주소를 직접 열어 확인해 주세요.'}</p>;
}

/**
 * 짧은 주소: 손으로 칠 때 쓰는 주소. [짧은 주소 만들기] 한 번이면 is.gd에서 만들고, 다른 서비스(joo.is·bit.ly 등)에서 만든 주소를 붙여 넣을 수도 있음.
 * QR과 [주소 복사]는 언제나 원래 주소라서 짧은 주소 서비스가 막히거나 없어져도 사이트는 열림. 근거: docs/research/share-links-2026-11.md
 */
function ShortLink({ url, short, stale, update, onRepublish, busy: pubBusy, linkOnly }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState(false); // 다른 방법·바꾸기
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [back, setBack] = useState(false); // 다른 서비스에 다녀옴 → [붙여넣기]를 눈에 띄게
  const [isgdBad, setIsgdBad] = useState(false); // 이 망에서 is.gd에 닿지 않음(아직 짧은 주소가 없을 때 한 번 확인)
  useEffect(() => { if (short) return undefined; let off = false; reach('short:isgd').then((s) => { if (!off) setIsgdBad(s === 'blocked'); }); return () => { off = true; }; }, [!!short]);
  const went = useRef(false);
  useEffect(() => {
    const f = () => { if (went.current) { went.current = false; setBack(true); } };
    window.addEventListener('focus', f); return () => window.removeEventListener('focus', f);
  }, []);
  const save = (v) => update((cur) => ({ blueprint: { ...cur.blueprint, meta: { ...cur.blueprint.meta, shortUrl: v } } }));
  async function make(alias = '') {
    setBusy(true); setErr('');
    try { save(await shortenUrl(url, alias)); setOpen(false); setName(''); toast('짧은 주소를 만들었어요.'); }
    catch (e) { setErr(e.message); if (e.code !== 'name') setOpen(true); }
    setBusy(false);
  }
  function take(v) {
    const r = checkShortUrl(v, url); setBack(false);
    if (r.error) { setErr(r.error); return; }
    save(r.url); setText(''); setErr(''); setOpen(false); toast('짧은 주소를 넣었어요.');
  }
  async function paste() {
    let v;
    try { v = await navigator.clipboard.readText(); }
    catch { setErr('입력 칸을 누르고 Ctrl+V(맥은 ⌘V)로 붙여 넣어 주세요.'); return; }
    take(v);
  }
  return (
    <div class="short">
      <div class="short-row">
        <b class="short-l">짧은 주소</b>
        {short
          ? <><span class="short-url">{showUrl(short)}</span>
            <button type="button" class="btn btn-sm" onClick={() => copy(short, '짧은 주소를 복사했어요.')}>복사</button>
            <button type="button" class="btn btn-sm btn-quiet" aria-expanded={String(open)} onClick={() => { setOpen(!open); setErr(''); }}>바꾸기</button></>
          : <><button type="button" class="btn btn-sm" disabled={busy} aria-busy={busy ? 'true' : undefined} onClick={() => make()}>{busy ? '만드는 중…' : '짧은 주소 만들기'}</button>
            <button type="button" class="btn btn-sm btn-quiet" aria-expanded={String(open)} onClick={() => { setOpen(!open); setErr(''); }}>다른 방법</button></>}
      </div>
      {short
        ? <p class="small">참가자가 직접 칠 때 알려 주세요. QR과 [주소 복사]는 원래 주소라서 짧은 주소가 막힌 곳에서도 열려요.</p>
        : isgdBad ? <p class="small" role="status">이 망에서 is.gd에 닿지 않아요. QR과 [주소 복사]는 원래 주소라 그대로 쓰면 돼요. 짧은 주소가 꼭 필요하면 [다른 방법]으로 만들어 넣어요.</p>
          : <p class="small">직접 칠 때 쓰는 주소예요. 사이트 주소를 is.gd로 보내 광고 없는 짧은 주소를 만들어요.</p>}
      {short && linkOnly && <p class="small">짧은 주소는 누구나 짐작해 넣어 볼 수 있어요. 참가자만 봐야 하면 [공개 범위]에서 암호를 거세요.</p>}
      {stale && <p class="small short-stale"><span>안내문과 발표 화면에는 다시 올려야 {short ? '나와요' : '빠져요'}.</span> <button type="button" class="btn btn-sm" disabled={!!pubBusy} onClick={onRepublish}>다시 올리기</button></p>}
      {err && <p class="small err" role="alert">{err}</p>}
      {open && <div class="short-more">
        <div class="short-line">
          <span class="short-k">이름 정하기</span>
          <span class="affix"><span class="affix-t">is.gd/</span><input value={name} onInput={(e) => { setName(shortName(e.target.value)); setErr(''); }} onKeyDown={(e) => e.key === 'Enter' && name.length >= 5 && make(name)} placeholder="yeonsu2026" maxLength={30} autoComplete="off" autoCapitalize="off" spellcheck={false} aria-label="짧은 주소 이름(영문·숫자 5자 이상)" /></span>
          <button type="button" class="btn btn-sm" disabled={busy || name.length < 5} onClick={() => make(name)}>만들기</button>
        </div>
        <div class="short-line">
          <span class="short-k">다른 서비스</span>
          {SHORTENERS.map((s) => <a class="btn btn-sm" href={s.url} target="_blank" rel="noopener" key={s.id} onClick={() => { went.current = true; copy(url, `사이트 주소를 복사했어요. ${s.name}에서 붙여 넣어 만드세요.`); }}>{s.name} 열기</a>)}
          <span class="small short-note">누르면 사이트 주소가 복사돼요. {SHORTENERS.map((s) => `${s.name}: ${s.note}`).join(' ')}</span>
        </div>
        <div class="short-line">
          <span class="short-k">만든 주소 넣기</span>
          <input class="input" value={text} onInput={(e) => { setText(e.target.value); setErr(''); }} onPaste={(e) => { const x = e.clipboardData?.getData('text'); if (x) { e.preventDefault(); take(x); } }} onKeyDown={(e) => e.key === 'Enter' && text && take(text)} placeholder="joo.is/우리연수" inputMode="url" autoComplete="off" autoCapitalize="off" spellcheck={false} aria-label="다른 서비스에서 만든 짧은 주소" />
          {text ? <button type="button" class="btn btn-sm" onClick={() => take(text)}>넣기</button>
            : <button type="button" class={`btn btn-sm${back ? ' btn-primary attn' : ''}`} onClick={paste}>붙여넣기</button>}
        </div>
        {short && <div class="btn-row"><button type="button" class="btn btn-sm btn-quiet" onClick={() => { save(''); setOpen(false); setErr(''); toast('짧은 주소를 지웠어요.'); }}>짧은 주소 지우기</button></div>}
      </div>}
    </div>
  );
}

/** QR 크게 보기: 발표 화면에 띄워 뒷자리에서도 찍히게(QR 한 변은 찍는 거리의 1/10쯤 필요). 흰 바탕에 검은 점 그대로 */
function JoinBig({ open, onClose, qr, title, shown, full }) {
  const ref = useRef();
  useEffect(() => { const d = ref.current; if (!d) return; if (open && !d.open) d.showModal?.(); if (!open && d.open) d.close(); }, [open]);
  return (
    <dialog ref={ref} class="join-big" aria-label="QR 크게 보기" onClose={onClose} onCancel={onClose}>
      {open && <div class="join-big-in">
        <div class="join-big-qr"><QR text={qr} size={720} alt="참가자용 QR 코드" /></div>
        <div class="join-big-t">
          <p class="join-big-h">{title}</p>
          <p class="join-big-cta">휴대폰 카메라로 QR을 찍어 주세요</p>
          <p class="join-big-url">{shown}</p>
          {full && <p class="join-big-full">{full}</p>}
        </div>
        <button type="button" class="btn join-big-x" onClick={onClose}>닫기</button>
      </div>}
    </dialog>
  );
}

function Success({ p, update, onAddMaterials, onRepublish, busy, onZip, instantOn, fontNote }) {
  const url = p.deploy.lastUrl.replace(/\/?$/, '/');
  const pw = p.blueprint.access?.mode === 'password' ? p.sitePassword : '';
  const shareUrl = pw ? E.unlockUrl(url, pw) : url;
  const m = p.blueprint.meta || {};
  const short = m.shortUrl && same(m.shortUrl) !== same(url) ? m.shortUrl : '';
  const stale = /^https:/.test(url) && (short || '') !== (p.deploy.shortLive || '');
  const [big, setBig] = useState(false);
  const when = [m.date, m.start && `${m.start}${m.end ? '~' + m.end : ''}`].filter(Boolean).join(' ');
  const liveOn = (p.blueprint.live?.features || []).length > 0;
  // 강사 화면 관리자 키: 바로 공개는 올릴 때 만든 키, 내 서버·시트는 연결할 때 앱이 만들어 이 기기에 기억한 키
  const [adminKey, setAdminKey] = useState('');
  const liveUrl = p.blueprint.live?.url || '';
  useEffect(() => { if (p.deploy.target === 'lecpage') setAdminKey(p.deploy.lecpage?.adminKey || ''); else if (liveOn && p.liveOk) adminKeyFor(liveUrl).then(setAdminKey); else setAdminKey(''); }, [liveUrl, p.deploy.target, p.liveOk, liveOn]);
  const msg = `[${m.title}] 연수 사이트예요.\n${[when, m.venue].filter(Boolean).join(' · ')}\n주소: ${shareUrl}${liveOn ? '\n연수 중에 이 사이트로 질문하고 참여해요.' : ''}`;
  return (
    <Sheet class="success">
      <div class="success-in">
        <div class="stack">
          <div class="row"><Mascot size={48} mood="happy" /><h2 class="h-sub">참가자에게 보낼 주소가 생겼어요</h2></div>
          <a class="big-url" href={shareUrl} target="_blank" rel="noopener">{url}</a>
          {p.deploy.target === 'lecpage' ? <p class="open-state"><span class="ok-dot" aria-hidden="true" />{p.deploy.lecpage?.view === 'pages' && p.deploy.lecpage.expiresAt ? `${new Date(p.deploy.lecpage.expiresAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}까지 열려 있어요. 다시 올리면 늘어나요.` : '방문이 있는 동안은 계속 열려 있어요. 30일 동안 아무도 오지 않으면 지워져요.'}</p> : <OpenState url={url} at={p.deploy.at} />}
          {p.deploy.target === 'lecpage' && p.deploy.lecpage?.altUrl && <p class="small muted">학교망에서 안 열리면 이 주소로: <a href={p.deploy.lecpage.altUrl} target="_blank" rel="noopener">{p.deploy.lecpage.altUrl.replace(/^https:\/\//, '')}</a></p>}
          {pw && <p class="small">암호: <b class="mono">{pw}</b> · QR과 안내 문구의 주소는 암호 없이 바로 열려요.</p>}
          {fontNote && <p class="small" role="status">{fontNote}</p>}
          <div class="btn-row">
            <button class="btn btn-primary" onClick={() => copy(shareUrl, '주소를 복사했어요.')}>주소 복사</button>
            <button class="btn" onClick={() => copy(msg, '카톡에 붙여 넣을 안내 문구를 복사했어요.')}>카톡용 안내 문구 복사</button>
          </div>
          {/^https:/.test(url) && <ShortLink url={url} short={short} stale={stale} update={update} onRepublish={onRepublish} busy={busy} linkOnly={p.blueprint.access?.mode !== 'password' && p.blueprint.access?.mode !== 'public'} />}
          <div class="day-kit" role="group" aria-labelledby="venue-h">
            <b class="small" id="venue-h">연수 전날 점검</b>
            <VenueBody p={p} url={url} instantOn={p.deploy.target === 'lecpage' && instantOn} />
          </div>
          <div class="day-kit" role="group" aria-labelledby="day-kit-h">
            <b class="small" id="day-kit-h">연수 당일</b>
            <div class="btn-row">
              <a class="btn btn-sm" href={url + 'screen.html'} target="_blank" rel="noopener">발표 화면 열기</a>
              {liveOn && <a class="btn btn-sm" href={url + 'console.html'} target="_blank" rel="noopener">강사 화면 열기</a>}
              <a class="btn btn-sm" href={url + 'poster.html'} target="_blank" rel="noopener">QR 안내문 인쇄(A4)</a>
            </div>
            {liveOn && (adminKey
              ? <p class="small">강사 화면 관리자 키 <b class="mono">{adminKey}</b> <button type="button" class="btn btn-sm btn-quiet" onClick={() => copy(adminKey, '관리자 키를 복사했어요.')}>복사</button></p>
              : <p class="small">강사 화면에는 참여 기능을 연결할 때 정한 관리자 키로 들어가요.</p>)}
          </div>
          <RescueKit p={p} update={update} url={url} shareUrl={shareUrl} onZip={onZip} busy={busy} />
          <p class="small">내용을 고치거나 자료를 더 넣은 뒤 다시 올리면 같은 주소에 반영돼요. <button type="button" class="btn btn-sm btn-quiet" onClick={onAddMaterials}>자료 올리기</button></p>
        </div>
        <div class="qr-side">
          <button type="button" class="qr-box qr-zoom" onClick={() => setBig(true)} aria-haspopup="dialog" aria-label="QR 코드 크게 보기"><QR text={shareUrl} size={180} alt="" /><span class="qr-zoom-t">크게 보기</span></button>
          <div class="btn-row">
            <button class="btn btn-sm" onClick={async () => saveFile(safeName(m.title) + '_QR.png', await qrPng(shareUrl), 'image/png')}>QR 저장</button>
            <button class="btn btn-sm" onClick={async () => toast(await copyQr(shareUrl) ? 'QR 그림을 복사했어요. 발표 자료에 붙여 넣으세요.' : '이 브라우저에서는 그림 복사가 안 돼요. [QR 저장]을 눌러 주세요.')}>QR 복사</button>
          </div>
        </div>
      </div>
      <JoinBig open={big} onClose={() => setBig(false)} qr={shareUrl} title={m.title} shown={short ? showUrl(short) : showUrl(url)} full={short ? showUrl(url) : ''} />
    </Sheet>
  );
}
