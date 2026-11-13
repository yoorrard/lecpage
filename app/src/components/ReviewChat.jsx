import { useEffect, useRef, useState } from 'preact/hooks';
import { E } from '../lib/engine.js';
import { kv } from '../lib/db.js';
import { visionTarget, askVision } from '../lib/ai-vision.js';
import { explainError } from '../lib/ai.js';
import { copy, toast, saveFile, uid, safeName } from '../lib/util.js';
import { Dialog } from './ui.jsx';
import './ReviewChat.css';

/**
 * 수정 요청: 미리보기에 표시(펜·네모·화살표·글자)하고 [완료]를 누르면 그림이 입력창에 붙고, 글과 함께 AI에게 보냅니다.
 * AI는 설계도 패치로 답하고, [적용]은 되돌리기 목록에 들어갑니다. AI 키가 없으면 쓰던 AI 창에 붙여 넣는 길을 안내해요.
 * 미리보기(iframe)는 다른 출처라 메시지로만 주고받고, 받은 값은 모두 다시 확인합니다.
 */
const META_KEYS = ['title', 'subtitle', 'organizer', 'date', 'start', 'end', 'venue'];
const MAX_MSGS = 40, IMG_MSGS = 8, STORE_W = 1280, SEND_W = 1568;
const full = new Map(); // 붙인 그림 원본(이 탭 메모리에만): 보낼 때 씀. 저장본은 줄인 JPEG
const applied = new Map(); // 메시지 id → 적용 직전 상태(되돌리기용)
const store = (pid) => `review:${pid}`;

function loadImg(url) { return new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('그림을 읽지 못했어요. PNG나 JPG로 다시 넣어 주세요.')); i.src = url; }); }
/** 그림을 다시 그려 크기·형식을 맞춤(받은 데이터를 그대로 쓰지 않음) */
async function redraw(url, maxW, type = 'image/jpeg', q = 0.84) {
  const img = await loadImg(url);
  const s = Math.min(1, maxW / (img.naturalWidth || 1));
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.naturalWidth * s)); c.height = Math.max(1, Math.round(img.naturalHeight * s));
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
  return { url: c.toDataURL(type, q), w: c.width, h: c.height, canvas: c };
}
const fileUrl = (f) => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => no(r.error); r.readAsDataURL(f); });
const nums = (o, keys) => (o && typeof o === 'object' ? Object.fromEntries(keys.map((k) => [k, Math.max(0, Math.min(1e6, Math.round(+o[k] || 0)))])) : null);

export function ReviewChat({ p, update, pushUndo, undo, undoTop, frameRef, marking, setMarking, apiRef, onConnectAi, onPolish, hidden }) {
  const [msgs, setMsgs] = useState(null);
  const [draft, setDraft] = useState('');
  const [atts, setAtts] = useState([]);
  const [target, setTarget] = useState(undefined);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [big, setBig] = useState(null);
  const [folded, setFolded] = useState(false);
  const [sure, setSure] = useState(false);
  const [say, setSay] = useState('');
  const ta = useRef(); const startBtn = useRef(); const thread = useRef(); const ctrl = useRef(); const back = useRef(null); const ack = useRef({ t: 0, ok: false });
  const pRef = useRef(p); pRef.current = p;
  const secs = E.withSectionIds(p.blueprint?.sections || []);
  const ids = new Set(secs.map((s) => s.id));
  const name = (id) => { const s = secs.find((x) => x.id === id); return s ? (s.nav || s.title || E.SECTION_DEFS[s.type]?.label || id).slice(0, 20) : id; };

  // 불러오기·저장(프로젝트마다, 그림은 줄여서 최근 것만)
  useEffect(() => {
    let on = true; setMsgs(null);
    kv.get(store(p.id)).then((v) => { if (on) setMsgs(Array.isArray(v?.msgs) ? v.msgs.map((m) => (m.kind === 'pending' ? { ...m, kind: 'stopped' } : m)) : []); }).catch(() => on && setMsgs([]));
    return () => { on = false; };
  }, [p.id]);
  useEffect(() => {
    if (!msgs) return;
    const t = setTimeout(() => {
      let keep = msgs.slice(-MAX_MSGS); let withImg = 0;
      keep = keep.slice().reverse().map((m) => { if (m.role !== 'user' || !m.images?.length) return m; withImg++; return withImg > IMG_MSGS ? { ...m, images: m.images.map((im) => ({ ...im, url: '', gone: true })) } : m; }).reverse();
      kv.set(store(p.id), { v: 1, msgs: keep }).catch(() => { });
    }, 400);
    return () => clearTimeout(t);
  }, [msgs, p.id]);
  useEffect(() => { const el = thread.current; if (el) el.scrollTop = el.scrollHeight; }, [msgs?.length, busy]);
  const refreshAi = () => visionTarget().then(setTarget).catch(() => setTarget(null));
  useEffect(() => { refreshAi(); addEventListener('focus', refreshAi); return () => removeEventListener('focus', refreshAi); }, []);
  useEffect(() => { if (!hidden) refreshAi(); }, [hidden]);

  const patchMsg = (id, ch) => setMsgs((list) => list.map((m) => (m.id === id ? { ...m, ...ch } : m)));
  const add = (m) => setMsgs((list) => [...(list || []), m]);

  // ── 미리보기에 표시하기 ──
  function start(mode = 'draw') {
    const f = frameRef.current;
    if (!f?.contentWindow) { toast('미리보기가 아직 준비 중이에요. 잠시 뒤 다시 눌러 주세요.'); return; }
    back.current = document.activeElement;
    ack.current = { ok: false, t: setTimeout(() => { if (!ack.current.ok) { setMarking(false); toast('미리보기에서 표시 도구를 열지 못했어요. 다시 눌러 주세요.'); } }, 3000) };
    setMarking(mode); setFolded(false);
    // 좁은 화면은 미리보기를 화면 가득 키운 뒤 시작(크기가 바뀐 뒤에 화면을 담도록)
    requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => {
      try { f.focus(); f.contentWindow.postMessage({ type: 'lp-annotate-start', mode }, '*'); } catch { setMarking(false); }
    }, 80)));
  }
  if (apiRef) apiRef.current = { start };

  useEffect(() => {
    const onMsg = async (e) => {
      const win = frameRef.current?.contentWindow;
      if (!win || e.source !== win) return;
      const d = e.data; if (!d || typeof d !== 'object') return;
      if (d.type === 'lp-annotate-state') {
        if (d.on) { ack.current.ok = true; clearTimeout(ack.current.t); return; }
        setMarking(false);
        if (d.cancelled) { const b = back.current; setTimeout(() => (b && document.contains(b) ? b : startBtn.current)?.focus(), 0); }
        return;
      }
      if (d.type === 'lp-review-ready') { if (marking) setMarking(false); return; }
      if (d.type !== 'lp-annotated') return;
      setMarking(false);
      if (typeof d.png !== 'string' || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(d.png.slice(0, 64) + 'A') || d.png.length > 12e6) { toast('표시한 그림을 받지 못했어요. [표시하기]로 다시 표시해 주세요.'); return; }
      const valid = new Set(E.withSectionIds(pRef.current.blueprint?.sections || []).map((s) => s.id));
      const sections = (Array.isArray(d.sections) ? d.sections : []).filter((x) => typeof x === 'string' && valid.has(x)).slice(0, 6);
      const notes = (Array.isArray(d.notes) ? d.notes : []).filter((x) => typeof x === 'string').map((x) => x.slice(0, 80)).slice(0, 10);
      try { await attach(d.png, { sections, notes, viewport: nums(d.viewport, ['w', 'h']), scroll: nums(d.scroll, ['x', 'y']), source: d.mode === 'pick' ? 'pick' : 'mark' }); }
      catch { toast('표시한 그림을 받지 못했어요. [표시하기]로 다시 표시해 주세요.'); return; }
      setSay(d.mode === 'pick' ? `섹션 '${sections.map(name).join(', ')}'을 붙였어요.` : '표시한 화면을 붙였어요. 고칠 내용을 적어 보내세요.');
      setTimeout(() => ta.current?.focus(), 0);
    };
    addEventListener('message', onMsg); return () => removeEventListener('message', onMsg);
  }, [marking]);
  useEffect(() => {
    if (!marking) return;
    const k = (e) => { if (e.key === 'Escape') { try { frameRef.current?.contentWindow?.postMessage({ type: 'lp-annotate-cancel' }, '*'); } catch { } setMarking(false); } };
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  }, [marking]);

  async function attach(url, meta = {}) {
    const send = await redraw(url, SEND_W, meta.source === 'file' ? 'image/jpeg' : 'image/png', 0.9);
    const small = await redraw(send.url, STORE_W, 'image/jpeg', 0.82);
    const id = uid(8); full.set(id, send.url);
    setAtts((a) => [...a, { id, url: small.url, w: send.w, h: send.h, ...meta }].slice(-4));
  }
  async function addFiles(list) {
    const files = [...(list || [])].filter((f) => /^image\/(png|jpeg|webp|gif)$/.test(f.type) && f.size < 15e6).slice(0, 4);
    if (!files.length) { if (list?.length) toast('PNG·JPG 그림만 넣을 수 있어요.'); return; }
    for (const f of files) { try { await attach(await fileUrl(f), { sections: [], notes: [], source: 'file' }); } catch { toast('그림을 읽지 못했어요. PNG나 JPG로 다시 넣어 주세요.'); } }
    setSay('그림을 붙였어요.');
  }
  const onPaste = (e) => { const files = [...(e.clipboardData?.files || [])]; if (files.some((f) => f.type.startsWith('image/'))) { e.preventDefault(); addFiles(files); } };

  // ── 보내기 ──
  async function send() {
    const text = draft.trim();
    if ((!text && !atts.length) || busy) return;
    const m = { id: uid(8), role: 'user', text: text.slice(0, 2000), at: Date.now(), images: atts.map((a) => ({ id: a.id, url: a.url, w: a.w, h: a.h, viewport: a.viewport, scroll: a.scroll, sections: a.sections, notes: a.notes })), sections: [...new Set(atts.flatMap((a) => a.sections || []))] };
    add(m); setDraft(''); setAtts([]); setSay('');
    await respond(m);
  }
  function promptFor(m, imagesAttached, again) {
    const prev = (msgs || []).filter((x) => x.id !== m.id).slice(-6).flatMap((x) => (x.role === 'user' ? [{ role: 'user', text: x.text }] : x.note ? [{ role: 'ai', text: x.note + (x.status === 'applied' ? ' (적용함)' : '') }] : []));
    if (again) prev.push({ role: 'user', text: '앞선 답은 마음에 들지 않아요. 다른 방법으로 고쳐 주세요.' });
    return E.buildReviewPrompt({ blueprint: pRef.current.blueprint, request: m.text, sections: m.sections, images: (m.images || []).map((im) => ({ viewport: im.viewport, scroll: im.scroll, sections: im.sections, notes: im.notes })), imagesAttached, history: prev });
  }
  async function respond(m, again = false) {
    const t = await visionTarget().catch(() => null); setTarget(t);
    const id = uid(8);
    if (!t) { add({ id, role: 'ai', kind: 'handoff', forId: m.id, at: Date.now(), again }); return; }
    add({ id, role: 'ai', kind: 'pending', forId: m.id, via: t.label, at: Date.now() });
    setBusy(true); ctrl.current = new AbortController();
    try {
      const imgs = (m.images || []).map((im) => full.get(im.id) || im.url).filter(Boolean);
      const { text } = await askVision(t, { prompt: promptFor(m, t.images && imgs.length > 0, again), images: imgs, signal: ctrl.current.signal });
      patchMsg(id, readAnswer(text, m));
    } catch (e) {
      if (e.name === 'AbortError') patchMsg(id, { kind: 'stopped' });
      else { const x = explainError(e, t.provider); patchMsg(id, { kind: 'error', err: { title: x.title, body: x.body } }); }
    }
    setBusy(false);
  }
  /** 답 글 → 거른 패치 + 바뀔 내용 요약(아직 적용하지 않음) */
  function readAnswer(text, m) {
    let raw;
    try { raw = E.extractJson(text); } catch { return { kind: 'error', err: { title: '답에서 고칠 내용을 찾지 못했어요.', body: '답 전체를 붙여 넣었는지 확인하거나, 다시 요청해 주세요.' } }; }
    const bp = pRef.current.blueprint;
    const { patch, dropped } = E.sanitizeReviewPatch(raw, { blueprint: bp, request: m?.text || '' });
    const r = E.applyBlueprintPatch(bp, patch);
    const warn = [...dropped, ...r.warnings.filter((w) => w.kind === 'patch').map((w) => w.message_ko)].slice(0, 4);
    if (r.errors.length) return { kind: 'error', err: { title: '이 답은 적용할 수 없어요.', body: r.errors.map((x) => x.message_ko).join(' ').slice(0, 240) } };
    const lines = E.diffSummary(bp, r.raw, 8);
    if (!r.applied || !lines.length) return { kind: 'nochange', note: r.note || patch.note || '', warn };
    return { kind: 'proposal', patch, note: r.note || patch.note || '고친 안을 만들었어요.', lines, warn, status: 'ready' };
  }
  function acceptPasted(id, text) {
    const forMsg = (msgs || []).find((x) => x.id === (msgs || []).find((y) => y.id === id)?.forId);
    patchMsg(id, { ...readAnswer(text, forMsg), via: 'AI' });
  }

  // ── 적용·되돌리기 ──
  function apply(m) {
    const label = `수정 요청: ${(m.note || '').slice(0, 28)}`;
    const now = pRef.current.blueprint;
    const test = E.applyBlueprintPatch(now, m.patch);
    if (test.errors.length) { toast('지금 내용에는 적용할 수 없어요. 다시 요청해 주세요.'); return; }
    pushUndo(label);
    applied.set(m.id, { entry: undoTop(), blueprint: JSON.parse(JSON.stringify(now)), info: { ...pRef.current.info } });
    update((cur) => {
      const r = E.applyBlueprintPatch(cur.blueprint, m.patch);
      if (r.errors.length) return {};
      const bp = r.raw; if (m.patch.design?.preset) delete bp._presetAuto;
      const info = { ...cur.info }; let ch = false;
      for (const k of META_KEYS) if (m.patch.meta && k in m.patch.meta && (bp.meta?.[k] ?? '') !== (cur.info?.[k] ?? '')) { info[k] = bp.meta?.[k] ?? ''; ch = true; }
      return ch ? { blueprint: bp, info, infoTouched: true } : { blueprint: bp };
    });
    patchMsg(m.id, { status: 'applied' });
    toast('적용했어요. 미리보기에서 확인해 보세요.');
  }
  function revert(m) {
    const a = applied.get(m.id);
    if (a && undoTop() === a.entry) undo();
    else if (a) { pushUndo('수정 요청 되돌리기'); update({ blueprint: a.blueprint, info: a.info }); toast('그 뒤에 고친 것까지 되돌렸어요. 다시 살리려면 위의 [되돌리기]를 누르세요.'); }
    else { toast('새로 고친 뒤라 여기서는 되돌릴 수 없어요. 위의 [되돌리기]를 눌러 주세요.'); return; }
    patchMsg(m.id, { status: 'undone' });
  }
  function again(m) {
    const u = (msgs || []).find((x) => x.id === m.forId);
    if (!u) return;
    patchMsg(m.id, { status: m.status === 'applied' ? 'applied' : 'replaced' });
    respond(u, true);
  }
  async function clearAll() {
    if (!sure) { setSure(true); setTimeout(() => setSure(false), 3500); return; }
    setSure(false); setMsgs([]); await kv.del(store(p.id)).catch(() => { }); toast('대화를 지웠어요.');
  }

  const canSend = !busy && (draft.trim() || atts.length);
  const attSecs = [...new Set(atts.flatMap((a) => a.sections || []))];
  const aiLabel = target === undefined ? '' : target ? `${target.label}${target.images ? '' : '(글만)'}로 보내요` : 'AI 키 없음 · 쓰던 AI로 보내요';
  return (
    <section class={`rc${folded ? ' folded' : ''}${marking ? ' marking' : ''}`} hidden={hidden} aria-label="수정 요청">
      <div class="rc-head">
        <button type="button" class="rc-grip" aria-expanded={String(!folded)} onClick={() => setFolded(!folded)}><span aria-hidden="true" />{folded ? '대화 펼치기' : '대화 접기'}</button>
        <h2 class="rc-title">수정 요청</h2>
        <span class="rc-ai small muted">{aiLabel}{target === null && onConnectAi && <> · <button type="button" class="rc-link" onClick={onConnectAi}>AI 연결</button></>}</span>
        {onPolish && <button type="button" class="btn btn-sm rc-polish" onClick={onPolish} title="사이트 문구 전체를 AI가 한 번에 다듬어요(되돌리기 가능)">문구 전체 다듬기</button>}
        {!!msgs?.length && <button type="button" class="btn btn-sm btn-quiet rc-clear" onClick={clearAll}>{sure ? '한 번 더 누르면 지워요' : '대화 지우기'}</button>}
      </div>
      <div class="rc-thread" ref={thread} role="log" aria-live="polite" aria-label="수정 요청 대화" tabIndex={0}>
        {msgs && !msgs.length && <Intro />}
        {(msgs || []).map((m) => (m.role === 'user'
          ? <UserMsg m={m} name={name} onOpen={setBig} />
          : <AiMsg m={m} busy={busy} onApply={apply} onRevert={revert} onAgain={again} onStop={() => ctrl.current?.abort()} onPaste={acceptPasted} user={(msgs || []).find((x) => x.id === m.forId)} promptFor={promptFor} onConnectAi={onConnectAi} title={p.blueprint?.meta?.title} />))}
      </div>
      <div class={`rc-compose${drag ? ' drag' : ''}`} onDragOver={(e) => { if ([...(e.dataTransfer?.types || [])].includes('Files')) { e.preventDefault(); setDrag(true); } }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer?.files); }}>
        {!!atts.length && <ul class="rc-atts" aria-label="붙인 그림">
          {atts.map((a, i) => <li key={a.id}><button type="button" class="rc-thumb" onClick={() => setBig(a.url)} aria-label={`붙인 그림 ${i + 1} 크게 보기`}><img src={a.url} alt="" /></button><button type="button" class="rc-x" aria-label={`그림 ${i + 1} 빼기`} onClick={() => { full.delete(a.id); setAtts(atts.filter((x) => x.id !== a.id)); }}>×</button></li>)}
        </ul>}
        {!!attSecs.length && <p class="rc-secs small muted">표시한 칸: {attSecs.map(name).join(', ')}</p>}
        <textarea ref={ta} class="rc-input" rows={2} value={draft} maxLength={2000} aria-label="고칠 내용" placeholder={atts.length ? '무엇을 바꿀까요? 예: 이 제목을 한 줄로 줄여 주세요' : '고칠 곳을 표시하거나 글로 적어 주세요'}
          onInput={(e) => setDraft(e.target.value)} onPaste={onPaste} onFocus={refreshAi}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); send(); } }} />
        <div class="rc-tools">
          <button ref={startBtn} type="button" class="btn btn-sm rc-mark" onClick={() => start('draw')} disabled={!!marking} aria-describedby="rc-mark-d">✎ 표시하기</button>
          <button type="button" class="btn btn-sm btn-quiet" onClick={() => start('pick')} disabled={!!marking}>섹션 고르기</button>
          <label class="icon-btn rc-file" title="그림 파일 넣기"><input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} aria-label="그림 파일 넣기" /><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12l-8.5 8.5a5 5 0 01-7-7L14 5a3.3 3.3 0 014.7 4.7L10 18.4a1.7 1.7 0 01-2.4-2.4L15.5 8" /></svg></label>
          <span class="rc-grow" />
          <button type="button" class="btn btn-sm btn-primary" disabled={!canSend} onClick={send}>보내기</button>
        </div>
        <span id="rc-mark-d" hidden>미리보기에 펜이나 네모로 표시하고 완료를 누르면 그림이 여기에 붙어요.</span>
        <p class="rc-say" role="status" aria-live="polite">{say}</p>
        {marking && <p class="rc-marking small">미리보기에서 표시하고 <b>완료</b>를 누르세요. 그만두려면 Esc.</p>}
      </div>
      <Dialog open={!!big} onClose={() => setBig(null)} label="붙인 그림" wide>{big && <img class="rc-big" src={big} alt="표시한 화면" />}</Dialog>
    </section>
  );
}

function Intro() {
  return (
    <div class="rc-intro">
      <p><b>미리보기를 보며 고칠 곳을 알려 주세요.</b></p>
      <ol>
        <li><b>✎ 표시하기</b>를 누르고 미리보기에 펜이나 네모로 표시한 뒤 <b>완료</b>를 누르면 그림이 붙어요.</li>
        <li>무엇을 바꿀지 적어 보내면 AI가 고칠 안을 보여 줘요.</li>
        <li><b>적용</b>하면 바로 바뀌고, 마음에 안 들면 <b>되돌리기</b>로 돌아가요.</li>
      </ol>
    </div>
  );
}

function UserMsg({ m, name, onOpen }) {
  return (
    <div class="rc-msg me">
      {!!m.images?.length && <div class="rc-imgs">{m.images.map((im, i) => (im.gone || !im.url
        ? <span class="rc-gone small muted">그림 {i + 1}(지난 그림은 지웠어요)</span>
        : <button type="button" class="rc-thumb lg" onClick={() => onOpen(im.url)} aria-label={`보낸 그림 ${i + 1} 크게 보기`}><img src={im.url} alt="" /></button>))}</div>}
      {m.text && <p class="rc-text">{m.text}</p>}
      {!!m.sections?.length && <p class="small muted rc-meta">칸: {m.sections.map(name).join(', ')}</p>}
    </div>
  );
}

function AiMsg({ m, busy, onApply, onRevert, onAgain, onStop, onPaste, user, promptFor, onConnectAi, title }) {
  if (m.kind === 'handoff') return <Handoff m={m} user={user} promptFor={promptFor} onPaste={onPaste} onConnectAi={onConnectAi} title={title} />;
  return (
    <div class="rc-msg ai">
      {m.kind === 'pending' && <div class="rc-row"><span class="rc-dots" aria-hidden="true"><i /><i /><i /></span><span>{m.via ? `${m.via}가 ` : ''}고칠 안을 만드는 중…</span>{busy && <button type="button" class="btn btn-sm btn-quiet" onClick={onStop}>멈추기</button>}</div>}
      {m.kind === 'stopped' && <p class="muted">멈췄어요. {user && <button type="button" class="rc-link" onClick={() => onAgain(m)}>다시 요청</button>}</p>}
      {m.kind === 'error' && <>
        <p><b>{m.err?.title}</b> {m.err?.body}</p>
        <div class="btn-row">{user && <button type="button" class="btn btn-sm" onClick={() => onAgain(m)}>다시 요청</button>}</div>
      </>}
      {m.kind === 'nochange' && <p>{m.note ? m.note + ' ' : ''}<span class="muted">바꿀 곳을 찾지 못했어요. 표시나 글을 조금 더 자세히 적어 보내 주세요.</span></p>}
      {m.kind === 'proposal' && <>
        <p class="rc-note">{m.note}</p>
        <ul class="rc-diff">{m.lines.map((l) => <li>{l}</li>)}</ul>
        {!!m.warn?.length && <p class="small muted">{m.warn.join(' · ')}</p>}
        <div class="btn-row">
          {m.status === 'ready' && <><button type="button" class="btn btn-sm btn-primary" onClick={() => onApply(m)}>적용</button><button type="button" class="btn btn-sm btn-quiet" disabled={busy} onClick={() => onAgain(m)}>다시 요청</button></>}
          {m.status === 'applied' && <><span class="rc-done">적용했어요</span><button type="button" class="btn btn-sm" onClick={() => onRevert(m)}>되돌리기</button></>}
          {m.status === 'undone' && <><span class="muted small">되돌렸어요</span><button type="button" class="btn btn-sm btn-quiet" onClick={() => onApply(m)}>다시 적용</button></>}
          {m.status === 'replaced' && <span class="muted small">다시 요청했어요</span>}
        </div>
      </>}
    </div>
  );
}

/** AI 키 없이: 그림 복사 → 프롬프트 복사 → AI 답 붙여넣기 */
function Handoff({ m, user, promptFor, onPaste, onConnectAi, title }) {
  const [answer, setAnswer] = useState('');
  const imgs = (user?.images || []).filter((im) => !im.gone && (full.get(im.id) || im.url));
  async function copyImage() {
    let ok = 0;
    for (const [i, im] of imgs.entries()) {
      const src = full.get(im.id) || im.url;
      try {
        const { canvas } = await redraw(src, SEND_W, 'image/png');
        const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
        if (i === 0 && navigator.clipboard?.write && window.ClipboardItem) { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); ok++; }
        else saveFile(`${safeName(title)}-수정요청-${i + 1}.png`, blob, 'image/png');
      } catch { try { const { canvas } = await redraw(src, SEND_W, 'image/png'); canvas.toBlob((b) => b && saveFile(`${safeName(title)}-수정요청-${i + 1}.png`, b, 'image/png'), 'image/png'); } catch { } }
    }
    toast(ok ? (imgs.length > 1 ? '첫 그림은 복사하고, 나머지는 파일로 받았어요. AI 입력 칸에 붙여 넣으세요.' : '그림을 복사했어요. AI 입력 칸에 붙여 넣으세요(Ctrl+V).') : '그림을 파일로 받았어요. AI 입력 칸에 끌어다 놓으세요.');
  }
  if (!user) return null;
  return (
    <div class="rc-msg ai rc-hand">
      <p><b>쓰던 AI 창에 보내 주세요.</b> <span class="muted">AI 키가 연결되지 않아 직접 보내지 못했어요.</span></p>
      <ol>
        {!!imgs.length && <li><button type="button" class="btn btn-sm" onClick={copyImage}>그림 복사</button> AI 입력 칸에 붙여 넣어요.</li>}
        <li><button type="button" class="btn btn-sm" onClick={() => copy(promptFor(user, imgs.length > 0, m.again), '프롬프트를 복사했어요. 이어서 붙여 넣고 보내세요.')}>프롬프트 복사</button> 이어서 붙여 넣고 보내요. <span class="rc-bots"><a href="https://chatgpt.com/" target="_blank" rel="noopener">ChatGPT</a> · <a href="https://gemini.google.com/" target="_blank" rel="noopener">Gemini</a> · <a href="https://claude.ai/new" target="_blank" rel="noopener">Claude</a></span></li>
        <li>AI 답을 통째로 복사해 여기에 붙여 넣어요.
          <textarea class="input rc-answer" rows={3} value={answer} onInput={(e) => setAnswer(e.target.value)} aria-label="AI의 답" placeholder="{ … } 로 된 답을 붙여 넣으세요" />
          <div class="btn-row"><button type="button" class="btn btn-sm btn-primary" disabled={!answer.trim()} onClick={() => onPaste(m.id, answer)}>답 확인</button>{onConnectAi && <button type="button" class="btn btn-sm btn-quiet" onClick={onConnectAi}>AI 키 연결하기</button>}</div>
        </li>
      </ol>
    </div>
  );
}
