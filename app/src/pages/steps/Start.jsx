import { useEffect, useRef, useState } from 'preact/hooks';
import { StepHead } from '../Project.jsx';
import { Notice, Progress, Field, Dialog } from '../../components/ui.jsx';
import { Mascot } from '../../components/Mascot.jsx';
import { AiPanel } from '../../components/AiPanel.jsx';
import { AiConnect } from '../../components/AiConnect.jsx';
import { PROVIDERS, getActiveAI, forgetKey, takeAiResume } from '../../lib/ai.js';
import { startMakeJob, useAiJob } from '../../lib/ai-job.js';
import { blobs } from '../../lib/db.js';
import { fmtBytes, toast } from '../../lib/util.js';
import { takePendingFiles } from '../../lib/project.js';
import { dropAssetCache } from '../../components/Preview.jsx';
import { instantInfo } from '../../lib/deploy.js';
import { FEATURES, makeDraft, syncInfo, applyInfo } from '../../lib/blueprint.js';

export const SIZE = [{ value: 25, label: '30명 이하' }, { value: 60, label: '31~100명' }, { value: 200, label: '101~300명' }, { value: 500, label: '300명 넘음' }];
const FORMATS = [{ value: '', label: '교재 보고 정하기' }, { value: 'lecture', label: '강의·특강' }, { value: 'practice', label: '실습·워크숍' }, { value: 'conference', label: '설명회·컨퍼런스' }, { value: 'course', label: '여러 차시 과정' }];
const AFTER = 'lecpage:after-connect'; // 로그인하러 나갔다 돌아오면 이어서 만들 프로젝트
const ACCEPT = '.pptx,.ppsx,.pdf,.hwpx,.docx,.txt,.md,.hwp,.ppt,.doc';
const safe = (n) => n.replace(/[^\w가-힣.\-]+/g, '_').slice(0, 120);

/** 교재 파일 읽기(브라우저 안). 원본은 src/에 보관하고 사이트에는 넣지 않음(공유하기에서 고를 때만) */
function useIngest(p, update) {
  const [busy, setBusy] = useState('');
  const [pct, setPct] = useState(0);
  async function ingestAll(fileObjs, { replace = false } = {}) {
    const ing = await import('../../lib/ingest.js');
    const mats = []; const metas = replace ? [] : [...(p.files || [])];
    let slidesMade = replace ? 0 : p.slidesMade || 0; let ok = 0;
    for (const [i, f] of fileObjs.entries()) {
      if (f.size > 100e6) { metas.push({ name: f.name, size: f.size, ext: (f.name.split('.').pop() || '').toLowerCase(), pages: 0, errors: ['100MB가 넘어 읽지 않았어요. 나눠서 올려 주세요.'] }); continue; }
      setBusy(`${f.name} 읽는 중 (${i + 1}/${fileObjs.length})`); setPct(5 + Math.round((i / fileObjs.length) * 10));
      const { material, bytes } = await ing.readFile(f);
      const ext = (f.name.split('.').pop() || '').toLowerCase();
      const errors = (material.errors || []).map((e) => e.message_ko);
      metas.push({ name: f.name, key: 'src/' + safe(f.name), size: f.size, ext, pages: material.files?.[0]?.pages || 0, errors });
      if (!errors.length || material.pages?.length) { mats.push(material); ok++; }
      if (f.size <= 100e6) await blobs.put(p.id, 'src/' + safe(f.name), new Uint8Array(bytes));
      if (ext === 'pdf' && !errors.length) {
        await blobs.removePrefix(p.id, 'assets/slides/');
        const shots = await ing.renderSlides(bytes, (done, total) => { setBusy(`슬라이드 그림 만드는 중 ${done}/${total}`); setPct(15 + Math.round((done / total) * 80)); });
        for (const s of shots) await blobs.put(p.id, 'assets/slides/' + ing.slideFileName(s.page, s.type), s.blob);
        slidesMade = shots.length;
      }
    }
    const prev = !replace && p.material ? [p.material] : [];
    const merged = mats.length || prev.length ? ing.materialToJSON(ing.mergeMaterials([...prev, ...mats])) : null;
    const det = merged?.detected || {};
    const info = { ...p.info };
    // 교재에서 찾은 값은 빈칸에만(강사가 쓴 값이 우선). 어디서 왔는지 기억해 교재를 지우면 함께 지움
    const auto = { ...(p.autoFilled || {}) };
    const fill = (k, v) => { if (v && !info[k]) { info[k] = v; auto[k] = v; } };
    fill('title', det.title); fill('subtitle', det.subtitle);
    if (det.event) for (const k of ['date', 'start', 'end', 'venue', 'organizer']) fill(k, det.event[k]);
    if (det.archetype?.format) info.format = det.archetype.format;
    dropAssetCache(p.id); // 새 쪽 그림을 미리보기가 바로 쓰게
    update({ material: merged, files: metas, info, autoFilled: auto, slidesMade, summary: merged ? ing.summarizeMaterial(merged) : '' });
    const bad = fileObjs.length - ok;
    toast(!fileObjs.length ? '' : bad === 0 ? `교재 ${ok}개를 읽었어요.` : ok ? `${fileObjs.length}개 중 ${ok}개를 읽었어요. 빨간 글씨를 확인해 주세요.` : '교재를 읽지 못했어요. 빨간 글씨를 확인해 주세요.');
  }
  async function handle(list) {
    const files = Array.from(list || []); if (!files.length) return;
    setBusy('교재를 읽는 중이에요…'); setPct(3);
    try { await ingestAll(files); } catch (e) { console.error(e); toast('교재를 읽지 못했어요: ' + (e.message || e)); }
    setBusy(''); setPct(0);
  }
  async function removeFile(i) {
    const f = p.files[i]; const rest = p.files.filter((_, k) => k !== i);
    setBusy('교재 목록을 다시 읽는 중…'); setPct(5);
    try {
      if (f.key) await blobs.remove?.(p.id, f.key);
      const all = await blobs.all(p.id);
      const again = [];
      for (const m of rest) { const data = all[m.key] || all['assets/media/' + safe(m.name)]; if (data) again.push(new File([data], m.name)); }
      if (f.ext === 'pdf') await blobs.removePrefix(p.id, 'assets/slides/');
      dropAssetCache(p.id);
      // 지운 교재에서 저절로 채운 칸은 비움
      const info = { ...p.info }; for (const [k, v] of Object.entries(p.autoFilled || {})) if (info[k] === v) info[k] = '';
      update({ info, autoFilled: {} });
      if (again.length) await ingestAll(again, { replace: true });
      else update({ material: null, files: [], slidesMade: 0, summary: '' });
      toast(`${f.name}을(를) 뺐어요.`);
    } catch (e) { toast('다시 읽지 못했어요: ' + e.message); }
    setBusy(''); setPct(0);
  }
  return { busy, pct, handle, removeFile };
}

export function StepStart({ p, update, go }) {
  const inp = useRef();
  const titleRef = useRef();
  const [over, setOver] = useState(false);
  const [paste, setPaste] = useState(false); // 챗봇에 붙여넣기 창
  const [conn, setConn] = useState(undefined); // 연결된 AI(undefined: 확인 중 · null: 없음)
  const [connect, setConnect] = useState(false); // AI 연결 창. 'make'면 연결한 뒤 바로 만들기
  const job = useAiJob(p.id);
  const latest = useRef(p); latest.current = p;
  useEffect(() => {
    // OpenRouter 로그인에서 돌아왔고 '연결하고 만들기' 중이었으면 이어서 만듦
    const load = () => getActiveAI().then((a) => {
      setConn(a);
      if (a && takeAiResume()) { setConnect(false); let then = ''; try { then = sessionStorage.getItem(AFTER) || ''; sessionStorage.removeItem(AFTER); } catch { } if (then === p.id) makeWithAiRef.current?.(a); }
    });
    load(); addEventListener('lecpage:ai-connected', load); return () => removeEventListener('lecpage:ai-connected', load);
  }, []);
  const makeWithAiRef = useRef(null);
  const [confirmRemake, setConfirmRemake] = useState(false);
  const [titleErr, setTitleErr] = useState(false);
  const { busy, pct, handle, removeFile } = useIngest(p, update);
  const info = p.info;
  useEffect(() => { const f = takePendingFiles(p.id); if (f.length) handle(f); }, []);
  // 운영자의 '바로 공개' 서버가 참여 기능까지 맡는 앱이면, 새 연수는 질문 받기·나눔 보드를 켠 채로 시작(따로 연결할 것이 없으므로)
  useEffect(() => {
    if (p.blueprint || p.infoTouched || (p.info.features || []).length) return;
    instantInfo().then((i) => { if (i?.live?.url && !latest.current.blueprint && !latest.current.infoTouched) update((cur) => ({ info: { ...cur.info, features: ['qa', 'board'] } })); });
  }, []);

  const setInfo = (patch) => update((cur) => {
    const nextInfo = { ...cur.info, ...patch };
    return { info: nextInfo, infoTouched: true, blueprint: cur.blueprint ? syncInfo(cur.blueprint, nextInfo, patch) : cur.blueprint };
  });
  const set = (k) => (e) => setInfo({ [k]: e?.target ? e.target.value : e });

  const needTitle = () => { if (info.title?.trim()) return false; setTitleErr(true); titleRef.current?.focus(); titleRef.current?.scrollIntoView({ block: 'center' }); return true; };
  /** AI 없이: 교재에서 찾은 내용으로 기본 초안만 */
  async function make() {
    if (needTitle()) return;
    const ing = await import('../../lib/ingest.js');
    update({ blueprint: makeDraft(latest.current, ing), aiMethod: 'draft', draftFormat: info.format || '' });
    toast('기본 초안을 만들었어요. 미리보기를 보며 고쳐 보세요.');
    go(2);
  }
  /** AI로: 기본 초안을 먼저 보여 주고, AI가 교재를 읽어 구성과 문구를 다시 짬(끝나면 바뀌고, 되돌릴 수 있음) */
  async function makeWithAi(ai = conn) {
    if (needTitle()) return;
    if (!ai) { setConnect('make'); return; }
    const ing = await import('../../lib/ingest.js');
    if (!latest.current.blueprint) update({ blueprint: makeDraft(latest.current, ing), aiMethod: 'draft', draftFormat: info.format || '' });
    startMakeJob({ getProject: () => latest.current, update });
    go(2);
  }
  makeWithAiRef.current = makeWithAi;
  function onConnected(a) { setConn(a); const then = connect; setConnect(false); if (then === 'make' && a) makeWithAi(a); }
  async function disconnect() { await forgetKey(conn.provider); setConn(await getActiveAI()); toast('AI 연결을 끊었어요.'); }
  function onAi(bp) { update({ blueprint: applyInfo(bp, p.info, p.material, p.blueprint), aiMethod: 'ai' }); setPaste(false); toast('AI가 짠 내용으로 만들었어요.'); go(2); }
  const mat = p.material; const d = mat?.detected || {};

  const quick = FEATURES.filter((f) => f.quick);
  const feats = info.features || [];
  const toggleFeat = (v) => setInfo({ features: feats.includes(v) ? feats.filter((x) => x !== v) : [...feats, v] });

  return (
    <>
      <StepHead title={p.blueprint ? '교재와 연수 정보' : '교재를 넣으면 AI가 사이트를 만들어요'} desc="PPT·PDF·한글(HWPX)·워드 파일을 이 브라우저 안에서 읽어요." />
      {p.blueprint && <Notice kind="ok">사이트가 있어요. 여기서 고친 정보는 바로 반영돼요.</Notice>}
      <section class="stack" aria-label="교재 파일">
          <div class={`drop${over ? ' over' : ''}${p.files?.length && !busy ? ' drop-more' : ''}`} role="button" tabIndex={0} aria-label="교재 파일 고르기"
            onClick={() => !busy && inp.current?.click()} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && !busy && inp.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); if (!busy) handle(e.dataTransfer.files); }}>
            {p.files?.length && !busy ? <b aria-live="polite">＋ 교재 더 넣기</b> : <>
              <Mascot size={72} mood={busy ? 'think' : over ? 'wow' : 'idle'} look={!!busy} />
              <b aria-live="polite">{busy || '여기에 교재 파일을 놓거나 눌러서 고르세요'}</b>
              <span class="small muted">여러 개도 돼요. PDF가 있으면 슬라이드 그림도 만들어요.</span>
              {busy && pct > 0 && <div style={{ width: 'min(320px,80%)' }}><Progress pct={pct} /></div>}
            </>}
          </div>
          <input ref={inp} type="file" multiple hidden accept={ACCEPT} onChange={(e) => { handle(e.target.files); e.target.value = ''; }} />
          {p.files?.length > 0 && (
            <ul class="files">
              {p.files.map((f, i) => (
                <li><span class="kind">{(f.ext || '').toUpperCase()}</span>
                  <div><b>{f.name}</b><div class="small muted">{fmtBytes(f.size)}{f.pages ? ` · ${f.pages}쪽` : ''}{f.ext === 'pdf' && !f.errors?.length && p.slidesMade ? ` · 슬라이드 그림 ${p.slidesMade}장` : ''}</div>{f.errors?.map((e) => <div class="small" style={{ color: 'var(--bad)' }}>{e}</div>)}</div>
                  <button class="icon-btn" disabled={!!busy} onClick={() => removeFile(i)} aria-label={`${f.name} 빼기`} title="빼기">✕</button></li>
              ))}
            </ul>
          )}
          {mat && <p class="small muted">교재에서 찾은 것: 실습 {d.steps?.length || 0}개 · 프롬프트 {d.prompts?.length || 0}개 · 도구 {d.tools?.length || 0}개 · 링크 {d.links?.length || 0}개</p>}
      </section>

      <section class="block">
        <h2 class="h-sub">연수 정보 {mat && <span class="small muted">교재에서 찾은 값을 채웠어요</span>}</h2>
        <div class="form-grid">
          <Field label="연수명 (필수)" hint={titleErr && !info.title ? <span style={{ color: 'var(--bad)' }}>연수명을 적어 주세요.</span> : null}>
            <input ref={titleRef} value={info.title} onInput={(e) => { setTitleErr(false); set('title')(e); }} maxLength={160} placeholder="예: 수업에 바로 쓰는 생성형 AI" aria-required="true" aria-invalid={titleErr && !info.title ? 'true' : undefined} />
          </Field>
          <Field label="날짜"><input type="date" value={info.date} onInput={set('date')} /></Field>
          <div class="pair">
            <Field label="시작"><input type="time" value={info.start} onInput={set('start')} /></Field>
            <Field label="끝"><input type="time" value={info.end} onInput={set('end')} /></Field>
          </div>
          <Field label="장소" hint="온라인 연수는 다음 단계 '연수 정보'에서 접속 주소를 넣어요."><input value={info.venue} onInput={set('venue')} maxLength={120} /></Field>
        </div>
        <Field label="요청 사항 (선택)" hint="구성·분위기·색·대상처럼 바라는 점을 자유롭게 적어요. AI가 반영하고, 기본 초안에도 분위기와 색이 반영돼요.">
          <textarea class="ta-short" rows={2} value={info.request || ''} onInput={set('request')} maxLength={600} placeholder="예: 실습 위주로 짜 주세요. 차분한 남색 계열, 초등 저학년 담임 선생님 대상이에요." />
        </Field>
        <details class="more">
          <summary><b>더 정하기</b><span class="small muted">인원 {SIZE.find((o) => o.value === info.size)?.label || ''} · 형식 {(FORMATS.find((o) => o.value === info.format) || FORMATS[0]).label}{feats.length ? ` · 참여 기능 ${feats.length}개` : ''}</span></summary>
          <div class="stack more-body">
            <div class="form-grid">
              <Field label="참가 인원"><select value={info.size} onChange={(e) => set('size')(+e.target.value)}>{SIZE.map((o) => <option value={o.value}>{o.label}</option>)}</select></Field>
              <Field label="연수 형식" hint={p.blueprint && p.draftFormat !== undefined && (info.format || '') !== p.draftFormat ? '섹션 순서는 [처음부터 다시 만들기]를 누르면 바뀌어요.' : null}><select value={FORMATS.some((o) => o.value === info.format) ? info.format : ''} onChange={set('format')}>{FORMATS.map((o) => <option value={o.value}>{o.label}</option>)}</select></Field>
            </div>
            <fieldset class="field plain-fieldset">
              <legend>참여 기능</legend>
              <div class="inline-checks">{quick.map((f) => <label class="check"><input type="checkbox" checked={feats.includes(f.value)} onChange={() => toggleFeat(f.value)} /><span>{f.label}</span></label>)}</div>
              <small>켜면 참가자 휴대폰과 강사 화면이 이어져요. 다음 단계에서도 켜고 끌 수 있어요.</small>
            </fieldset>
          </div>
        </details>
      </section>

      {!p.blueprint && <section class="ai-line" aria-label="AI 연결">
        {conn === undefined ? <p class="small muted">확인하는 중…</p>
          : conn ? <div class="conn-row"><span class="dot-ok" aria-hidden="true" /><span><b>{conn.label}</b>에 연결됨</span><span class="conn-tools"><button class="btn btn-sm btn-quiet" onClick={() => setConnect(true)}>바꾸기</button><button class="btn btn-sm btn-quiet" onClick={disconnect}>끊기</button></span></div>
            : <p class="ai-off">AI가 교재를 읽고 연수 흐름과 문구를 짜요. 처음 한 번만 연결하면 되고, 쓰던 구글 계정으로 1분이면 돼요.</p>}
      </section>}

      <div class="make-bar">
        {p.blueprint
          ? <><button class="btn btn-primary btn-lg" onClick={() => go(2)}>살펴보고 고치기 →</button><button class="btn" disabled={!!busy || job?.status === 'running'} onClick={() => setConfirmRemake(true)}>처음부터 다시 만들기</button></>
          : <><button class="btn btn-primary btn-lg" disabled={!!busy} onClick={() => makeWithAi()}>{busy ? '교재를 읽는 중…' : conn ? 'AI로 사이트 만들기 →' : 'AI 연결하고 만들기 →'}</button>
</>}
      </div>
      {!p.blueprint && <div class="make-alt">
        <button class="btn btn-sm btn-quiet" disabled={!!busy} onClick={make}>AI 없이 기본 초안만</button>
        {!conn && <button class="btn btn-sm btn-quiet" disabled={!!busy} onClick={() => { if (!needTitle()) setPaste(true); }}>가입 없이: 챗봇에 붙여넣기</button>}
        <span class="small muted">교재가 없어도 연수명만 있으면 돼요.</span>
      </div>}

      <Dialog open={confirmRemake} onClose={() => setConfirmRemake(false)} label="다시 만들기 확인">
        <h2 class="h-sub">처음부터 다시 만들까요?</h2>
        <p>고친 문구와 섹션 순서가 새 초안으로 바뀌어요. 고른 디자인과 참여 기능 연결은 그대로예요.</p>
        <div class="btn-row"><button class="btn btn-primary" onClick={() => { setConfirmRemake(false); makeWithAi(); }}>{conn ? 'AI로 다시 만들기' : 'AI 연결하고 다시 만들기'}</button><button class="btn" onClick={() => { setConfirmRemake(false); make(); }}>AI 없이 기본 초안으로</button><button class="btn btn-quiet" onClick={() => setConfirmRemake(false)}>취소</button></div>
      </Dialog>
      <Dialog open={!!connect} onClose={() => setConnect(false)} label="AI 연결" wide>
        {connect && <div class="stack"><div class="stack" style={{ gap: '4px' }}><h2 class="h-sub">AI 연결</h2><p class="small muted">한 번 연결하면 다음부터는 단추 하나로 만들어요.</p></div>
          <AiConnect onConnected={onConnected} onBeforeLogin={() => { try { if (connect === 'make') sessionStorage.setItem(AFTER, p.id); } catch { } }} onPaste={() => { setConnect(false); if (!needTitle()) setPaste(true); }} /></div>}
      </Dialog>
      <Dialog open={paste} onClose={() => setPaste(false)} label="챗봇에 붙여넣기로 만들기" wide>
        {paste && <AiPanel p={p} onBlueprint={onAi} />}
      </Dialog>
    </>
  );
}
