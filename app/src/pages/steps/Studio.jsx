import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { StepHead } from '../Project.jsx';
import { Dialog } from '../../components/ui.jsx';
import { SitePreview } from '../../components/Preview.jsx';
import { editSite, runInspect, fixIssues, resumeGeneration, forgetGeneration } from '../../lib/studio.js';
import { getActiveAI } from '../../lib/ai.js';
import { outlineOf, htmlPages, moveSection, setHidden, removeSection, renameSection, setText, setImage, setKit, removeKit, addKit } from '../../lib/site-doc.js';
import { wordsFor, surveyFor } from '@engine/src/words.js';
import { keepTeacher, recordVersion, restoreLabel, addChat } from '../../lib/site-meta.js';
import { toast } from '../../lib/util.js';
import { errorActions } from './Make.jsx';
import { available, pickConnection, jobOpts, pcNow, setPreferred, askConsent, consentId } from '../../lib/connection.js';
import { InfoCard } from './studio/Info.jsx';
import { FilesCard } from './studio/Files.jsx';
import { ChatLog, Composer, useWay } from './studio/Chat.jsx';
import { LookCard, ImageDialog, Versions, IssueLine, seriousOf, useFolds } from './studio/Parts.jsx';
import { Outline } from './studio/Outline.jsx';
import { KIT_LABEL } from '../../lib/kit-fields.js';

// 완성 뒤 한 화면(2. 만들기·수정): 미리보기(넓게) + 오른쪽 한 칸(이어서 내려 봄) — 연수 정보(속성 줄, 바로 고침) · 꼭 고칠 곳 한 줄 ·
// 사이트 구성(섹션 목록 + 항목 설정, 미리보기와 서로 가리킴) · 자료 · 색·글꼴(접음) · AI 수정 대화, 입력 칸은 칸 아래에 고정.
// 휴대폰(~960px)은 한 줄로 쌓고 [수정 | 미리보기]로 바꿔 봄.
// 바뀌는 것은 모두 버전 기록에 남음(lib/versions.js): AI 수정(생성 쪽이 저장할 때)·직접 수정·연수 정보 수정(change)·실행 취소·복원.
const UNDO_KEY = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '') ? '⌘Z' : 'Ctrl+Z';
const undos = new Map(); // 연수마다 직접 고친 것 되돌리기(이 탭 안, 최근 30개)
const stackOf = (pid) => { if (!undos.has(pid)) undos.set(pid, []); return undos.get(pid); };
const SLOT = /data-lp\s*=\s*["']?materials\b/;
const narrow = () => typeof matchMedia === 'function' && matchMedia('(max-width: 960px)').matches;

export function Studio({ p, update, go, job, idle, reload }) {
  const [fold, setFold] = useFolds(); // 오른쪽 칸의 접는 칸(처음에는 모두 접힘: AI 수정 대화가 먼저)
  const [view, setViewRaw] = useState('edit'); // 휴대폰: 수정 칸 | 미리보기
  // 휴대폰에서 보기를 바꾸면 그 보기의 맨 위부터(아래로 내려 둔 자리에서 미리보기 도구가 화면 밖에 있지 않게)
  const setView = (v) => { setViewRaw((o) => { if (o !== v && typeof matchMedia === 'function' && matchMedia('(max-width: 960px)').matches) requestAnimationFrame(() => { const el = document.querySelector('.st'); if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: 'start' }); }); return v; }); };
  const [editing, setEditing] = useState(false);
  const [img, setImg] = useState(null); // 바꿀 그림 번호
  const [ver, setVer] = useState(0); // 그림 파일이 바뀌거나 실행 취소·복원하면 미리보기를 다시 읽음
  const [goto, setGoto] = useState(null);
  const [sel, setSel] = useState(null); // 사이트 구성에서 고른 것: { page, key, item }
  const [reveal, setReveal] = useState(null); // 미리보기에서 고른 것을 사이트 구성에 보임
  const bus = useRef(null); // 미리보기에 바로 보내기(줄에 마우스를 올리면 그 자리 테두리)
  const [vers, setVers] = useState(null); // 버전 기록 창: { focus }
  const [nudge, setNudge] = useState(false); // 연수 정보를 확인한 뒤 [배포하기]를 잠깐 강조
  const [flash, setFlash] = useState(false);
  const [ask, setAsk] = useState({ target: 'all', request: '', n: 0 });
  const headRef = useRef(null); const [headOff, setHeadOff] = useState(false);
  useEffect(() => {
    const el = headRef.current; if (!el || typeof IntersectionObserver !== 'function') return undefined;
    const io = new IntersectionObserver(([e]) => setHeadOff(!e.isIntersecting)); io.observe(el); return () => io.disconnect();
  }, []);
  const [issues, setIssues] = useState(() => p.inspect?.issues || []); // AI가 저장할 때의 검수 결과로 먼저, 고치면 다시
  const [, force] = useState(0);
  const quiet = useRef('');
  const working = job.status === 'running' && job.kind && job.kind !== 'make';
  const stack = stackOf(p.id);
  const ways = useWay(p);
  // 직접 고친 것만 실행 취소: AI 수정·복원처럼 바깥에서 사이트가 바뀌면 되돌리기 목록을 비움(되돌리다 AI가 고친 것을 잃지 않게)
  const mine = useRef(p.site);
  useEffect(() => { if (p.site !== mine.current) { mine.current = p.site; if (stack.length) { stack.length = 0; force((x) => x + 1); } } }, [p.site]);
  /** 직접 고치기(글·섹션·그림·색·연수 정보): 고치기 전 판을 실행 취소에 넣고, 고친 뒤 판을 버전 기록에(잇따른 것은 하나로) */
  const change = useCallback((label, fn, kind = 'edit') => {
    update((cur) => {
      const patch = fn(cur); if (!patch) return {};
      stack.push({ label, site: cur.site, meta: cur.meta }); if (stack.length > 30) stack.shift();
      const next = { ...cur, ...patch }; mine.current = next.site;
      return { ...patch, versions: recordVersion(cur, next, { kind, label }) };
    });
    force((x) => x + 1);
  }, [p.id]);
  const undo = () => {
    const s = stack.pop(); if (!s) { toast('되돌릴 것이 없어요.'); return; }
    quiet.current = '';
    update((cur) => { mine.current = s.site; const next = { site: s.site, meta: s.meta }; return { ...next, versions: recordVersion(cur, next, { kind: 'edit', label: '실행 취소' }) }; });
    setVer((v) => v + 1); force((x) => x + 1); toast(`되돌렸어요: ${s.label}`);
  };
  const undoRef = useRef(undo); undoRef.current = undo;
  useEffect(() => {
    const k = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || e.isComposing || !(e.code === 'KeyZ' || /^z$/i.test(e.key))) return;
      if (e.target?.closest?.('input,textarea,select,[contenteditable="true"],[contenteditable=""]') || document.querySelector('dialog[open]')) return;
      e.preventDefault(); undoRef.current();
    };
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  }, []);
  /** 버전 복원: 그 버전의 사이트로(강사 값은 지금 것), 복원한 것도 새 버전으로 남아 다시 되돌릴 수 있음 */
  const restore = (v) => {
    quiet.current = ''; setVer((n) => n + 1);
    update((cur) => { const next = { site: v.site, meta: keepTeacher(v.meta || cur.meta, cur.meta) }; mine.current = next.site; return { ...next, versions: recordVersion(cur, next, { kind: 'restore', label: restoreLabel(v) }) }; });
    stack.length = 0; force((x) => x + 1); setVers(null); toast(`복원했어요: ${v.label}`);
  };
  const outlines = useMemo(() => htmlPages(p.site).map((pg) => ({ page: pg, label: pg === 'index.html' ? '참가자 화면' : `사이트 · ${pg}`, ...outlineOf(p.site[pg]) })), [p.site]);
  const sections = outlines.find((o) => o.page === 'index.html')?.sections || [];
  const surveyDefaults = useMemo(() => surveyFor(wordsFor({ meta: p.meta || {} })), [p.meta?.admin?.kind, p.meta?.title]);
  const hasSlot = useMemo(() => Object.entries(p.site || {}).some(([k, v]) => /\.html?$/i.test(k) && typeof v === 'string' && SLOT.test(v)), [p.site]);
  const onText = useCallback((n, raw) => change('글 수정', (cur) => { const h = setText(cur.site['index.html'], n, raw); if (h === cur.site['index.html']) return null; quiet.current = h; return { site: { ...cur.site, 'index.html': h } }; }), [change]);
  const onImage = useCallback((n) => setImg(n), []);
  const setHtml = (label, fn, page = 'index.html') => change(label, (cur) => { const h0 = cur.site?.[page]; if (typeof h0 !== 'string') return null; const h = fn(h0); return h === h0 ? null : { site: { ...cur.site, [page]: h } }; });
  // 꼭 고칠 곳: 고친 뒤 잠깐 멈추면 다시 검사(조립 + 정적 검사). 생성 쪽이 저장소의 연수를 읽으므로 먼저 다 씀
  const inspectT = useRef();
  useEffect(() => {
    if (working) return undefined;
    clearTimeout(inspectT.current);
    inspectT.current = setTimeout(async () => { await idle(); try { setIssues(await runInspect(p.id)); } catch (e) { console.error(e); setIssues([]); } }, 900);
    return () => clearTimeout(inspectT.current);
  }, [p.site, p.meta, p.materials, working]);
  const serious = useMemo(() => seriousOf(issues), [issues]);
  // 배포 화면의 [수정하러 가기]으로 오면: 꼭 고칠 곳 줄을 보이고 잠깐 강조
  useEffect(() => {
    let want = ''; try { want = sessionStorage.getItem('lecpage:studio-tab') || ''; sessionStorage.removeItem('lecpage:studio-tab'); } catch { /* 저장이 막힌 창 */ }
    if (want === 'check') { setFlash(true); setTimeout(() => document.getElementById('st-issue')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 1600); setTimeout(() => setFlash(false), 4000); }
  }, []);
  const published = !!p.deploy?.lastUrl;
  const changed = published && (p.editedAt || 0) > (p.deploy.at || 0);
  const show = (key) => { setView('preview'); setGoto({ key, page: 'index.html', n: Date.now() }); };
  /** 사이트 구성에서 고름: 넓은 화면은 미리보기가 그 자리로(휴대폰은 수정 칸에 머묾) */
  const select = (s) => { setSel(s); if (!narrow()) setGoto({ ...s, n: Date.now() }); };
  const onPick = useCallback((s) => { setSel(s); setFold('outline', true); setReveal({ ...s, n: Date.now() }); }, []); // 미리보기에서 고르면 접힌 사이트 구성도 펼침
  const hover = (page, key, item) => bus.current?.hl(page ? { page, key, item } : null);
  const act = {
    move: (page, id, to) => setHtml('순서 바꾸기', (h) => moveSection(h, id, to), page),
    hide: (page, id, v) => setHtml(v ? '섹션 숨기기' : '섹션 숨기기 취소', (h) => setHidden(h, id, v), page),
    remove: (page, id) => setHtml('섹션 삭제', (h) => removeSection(h, id), page),
    rename: (page, id, name) => setHtml('이름 바꾸기', (h) => renameSection(h, id, name), page),
    ask: (page, id, name) => (page === 'index.html' ? fill('', id) : fill(`${page}의 '${name}' 섹션에서 `, 'all')),
    kitSave: (page, n, patch, label, key) => { setHtml(`${label} 수정`, (h) => setKit(h, n, patch), page); toast(`저장했어요: ${label}`); if (!narrow()) setGoto({ page, key, item: n, after: true, n: Date.now() }); },
    kitRemove: (page, n, label) => { setHtml(`${label} 삭제`, (h) => removeKit(h, n), page); setSel(null); toast(`삭제했어요: ${label}. [실행 취소]로 되살릴 수 있어요.`); },
    kitAdd: (page, id, type, attrs) => { const label = KIT_LABEL[type] || type; setHtml(`${label} 추가`, (h) => addKit(h, id, type, attrs), page); toast(`넣었어요: ${label}`); if (!narrow()) setGoto({ page, key: id, after: true, n: Date.now() }); },
  };
  const fill = (request, target = ask.target) => { setAsk({ target, request, n: Date.now() }); setView('edit'); };
  /** AI에게 보냄: 대화에 요청을 남기고 연결한 AI가 바로 고침(다시 보내기는 그때 연결, 없으면 지금 고른 연결로) */
  async function send(text, target, again = null) {
    const c = ways.list.find((x) => x.id === (again?.way || ways.way)) || ways.cur;
    if (!c) { toast(p.demo ? '체험에서는 AI에게 보내지 않아요.' : '보낼 AI를 먼저 연결해 주세요.'); return; }
    if (!await askConsent(consentId(c))) return;
    setPreferred(c.id);
    const targetName = target !== 'all' ? sections.find((s) => s.id === target)?.name || '' : '';
    if (!again) { update((cur) => ({ chat: addChat(cur, { role: 'user', text, target, targetName, way: c.id, wayName: c.label }) })); setAsk({ target, request: '', n: 0 }); }
    await idle();
    editSite(p.id, { target, request: text, ...jobOpts(c) });
  }
  /** 꼭 고칠 곳을 AI에게: 연결한 AI면 바로 고치고, 아니면(연결 전·체험) 입력 칸에 채워 둠 */
  async function fixSerious() {
    const list = serious; if (!list.length) return;
    const ai = p.demo ? null : pickConnection(available(pcNow(), await getActiveAI()));
    if (ai) {
      if (!await askConsent(consentId(ai))) return;
      update((cur) => ({ chat: addChat(cur, { role: 'user', text: `꼭 고칠 곳 ${list.length}곳을 고쳐 주세요.`, kind: 'fix', way: ai.id, wayName: ai.label }) }));
      await idle();
      if (await fixIssues(p.id, list.map((x) => x.key), jobOpts(ai))) { toast(`${ai.ro} 수정을 맡겼어요. 끝나면 미리보기가 바뀌어요.`); return; }
    }
    const secs = [...new Set(list.map((x) => x.where?.section).filter(Boolean))];
    fill(`꼭 고칠 곳을 고쳐 주세요.\n${list.map((x) => `- ${x.message_ko}${x.fix_hint_ko ? ` (${x.fix_hint_ko})` : ''}`).join('\n')}`, secs.length === 1 ? secs[0] : 'all');
    toast(p.demo ? '체험이라 AI에게는 보내지 않아요. AI 수정 칸에 채워 뒀어요.' : ways.list.length ? 'AI 수정 칸에 채워 뒀어요. [보내기]를 눌러 주세요.' : 'AI 수정 칸에 채워 뒀어요. AI를 연결하면 보낼 수 있어요.');
  }
  const confirmed = () => { scrollTo({ top: 0, behavior: 'smooth' }); setNudge(true); setTimeout(() => setNudge(false), 2600); };
  const nextBtn = !published ? <button class={`btn${p.metaChecked ? ' btn-primary' : ''}${nudge ? ' nudge' : ''}`} data-coach={p.demo && p.metaChecked ? '' : undefined} data-coach-room={p.demo && p.metaChecked ? '' : undefined} onClick={() => go(3)}>배포하기 →</button>
    : changed ? <button class="btn btn-primary" onClick={() => { try { sessionStorage.setItem('lecpage:republish', p.id); } catch { } go(3); }}>다시 배포하기</button>
      : <button class="btn" onClick={() => go(3)}>주소·QR 보기 →</button>;
  return (
    <>
      <StepHead title="미리보기·수정" desc="미리보기에서 글자를 눌러 바로 고치거나, AI에게 바꿀 점을 보내요. 고친 내용은 자동으로 저장돼요.">
        <div class="btn-row head-tools" ref={headRef}>
          <button class="btn btn-sm btn-quiet" disabled={!stack.length} onClick={undo} title={stack.length ? `실행 취소: ${stack[stack.length - 1].label} (${UNDO_KEY})` : '실행 취소할 것이 없어요'}>실행 취소</button>
          <button class="btn btn-sm btn-quiet" onClick={() => setVers({ focus: '' })} aria-haspopup="dialog">버전 기록</button>
          {nextBtn}
        </div>
      </StepHead>
      {job.kind === 'make' && (job.status === 'error' || job.status === 'paused') && <MakeError p={p} job={job} go={go} />}
      {p.notes?.length > 0 && <div class="ai-job" role="status"><span class="ai-job-t"><b>답을 받으며 알게 된 것</b><small>{p.notes.join(' ')}</small></span><button class="icon-btn" onClick={() => update({ notes: undefined })} aria-label="안내 닫기">✕</button></div>}
      <div class="st" data-view={view}>
        <div class="st-switch" role="group" aria-label="보기">
          <div class="seg">
            <button type="button" aria-pressed={String(view === 'edit')} onClick={() => setView('edit')}>수정</button>
            <button type="button" aria-pressed={String(view === 'preview')} onClick={() => setView('preview')}>미리보기</button>
          </div>
          {headOff && (stack.length ? <button type="button" class="btn btn-sm btn-quiet" onClick={undo}>실행 취소</button> : null)}
          {headOff && p.metaChecked && nextBtn}
        </div>
        <SitePreview p={p} ver={ver} editing={editing && !working} setEditing={working ? null : setEditing} onText={onText} onImage={onImage} quiet={quiet} goto={goto} bus={bus} onPick={onPick} />
        <aside class="st-panel" aria-label="수정">
          <div class="st-scroll">
            <InfoCard p={p} change={change} update={update} onConfirmed={confirmed} open={!!fold.info} onToggle={() => setFold('info', (v) => !v)} />
            <IssueLine issues={serious} locked={working} flash={flash} onShow={show} onFix={fixSerious} />
            <Outline outlines={outlines} locked={working} sel={sel} reveal={reveal} act={act} onSelect={select} onHover={hover} surveyDefaults={surveyDefaults} open={!!fold.outline} onToggle={() => setFold('outline', (v) => !v)} />
            <FilesCard p={p} update={update} hasSlot={hasSlot} locked={working} open={!!fold.files} onToggle={() => setFold('files', (v) => !v)} onOpen={() => setFold('files', true)} onAskSlot={() => fill('참가자가 자료를 다운로드하는 자료실 칸을 사이트에 어울리는 자리에 넣어 줘. 자리 표시는 <div data-lp="materials"></div>예요.', 'all')} />
            <LookCard p={p} change={change} open={!!fold.look} onToggle={() => setFold('look', (v) => !v)} />
            <ChatLog p={p} update={update} job={job} go={go} versions={p.versions || []}
              onShow={show} onVersion={(id) => setVers({ focus: id })} onRestore={restore} onPick={(t) => fill(t)} onPreview={() => setView('preview')}
              onResend={(m) => send(m.text, m.target || 'all', m)} />
          </div>
          <div class="st-composer">
            <Composer p={p} sections={sections} ask={ask} setAsk={setAsk} ways={ways.list} way={ways.way} setWay={ways.setWay} locked={working} onSend={(t, target) => send(t, target)} onConnect={() => go(1)} />
          </div>
        </aside>
      </div>
      <ImageDialog n={img} p={p} onClose={() => setImg(null)} onPick={(src, alt) => { setHtml('그림 바꾸기', (h) => setImage(h, img, src, alt)); setImg(null); setVer((v) => v + 1); toast('그림을 바꿨어요.'); }} />
      <Dialog open={!!vers} onClose={() => setVers(null)} label="버전 기록">
        {vers && <Versions p={p} focus={vers.focus} onPick={restore} onRemake={() => { setVers(null); go(1); }} />}
      </Dialog>
    </>
  );
}

/** 처음부터 다시 만들다 멈춤·실패: 까닭과 할 일(지금 사이트는 그대로) */
function MakeError({ p, job, go }) {
  const acts = [...(job.status === 'paused' ? [{ id: 'resume', label: '계속', run: () => resumeGeneration(p.id) }] : errorActions(p, job, go)), { id: 'forget', label: '취소', run: () => forgetGeneration(p.id) }];
  const e = job.error || {};
  return (
    <div class="ai-job bad" role="alert"><span class="ai-job-t"><b>{job.status === 'paused' ? 'AI가 다시 만들기를 멈췄어요.' : e.title || 'AI가 다시 만들지 못했어요.'}</b><small>{job.status === 'paused' ? '지금 사이트는 그대로예요. [계속]을 누르면 멈춘 단계부터 해요.' : `${e.body || ''} 지금 사이트는 그대로예요.`.trim()}</small></span>
      {acts.map((a, i) => (a.href ? <a class={`btn btn-sm${i ? '' : ' btn-primary'}`} href={a.href} target="_blank" rel="noopener">{a.label}<span class="ext" aria-hidden="true">↗</span></a>
        : <button type="button" class={`btn btn-sm${i ? '' : ' btn-primary'}`} onClick={a.run}>{a.label}</button>))}
    </div>
  );
}
