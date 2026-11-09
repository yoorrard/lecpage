import { useEffect, useRef, useState } from 'preact/hooks';
import { StepHead } from '../Project.jsx';
import { Sheet, Notice, Progress, Field, Chips, Dialog } from '../../components/ui.jsx';
import { Mascot } from '../../components/Mascot.jsx';
import { AiPanel } from '../../components/AiPanel.jsx';
import { blobs } from '../../lib/db.js';
import { fmtBytes, toast } from '../../lib/util.js';
import { takePendingFiles } from '../../lib/project.js';
import { FEATURES, makeDraft, syncInfo, applyInfo } from '../../lib/blueprint.js';

export const SIZE = [{ value: 25, label: '30명 이하' }, { value: 60, label: '31~100명' }, { value: 200, label: '101~300명' }, { value: 500, label: '300명 넘음' }];
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
  const [ai, setAi] = useState(false);
  const [confirmRemake, setConfirmRemake] = useState(false);
  const [titleErr, setTitleErr] = useState(false);
  const { busy, pct, handle, removeFile } = useIngest(p, update);
  const info = p.info;
  useEffect(() => { const f = takePendingFiles(p.id); if (f.length) handle(f); }, []);

  const setInfo = (patch) => update((cur) => {
    const nextInfo = { ...cur.info, ...patch };
    return { info: nextInfo, infoTouched: true, blueprint: cur.blueprint ? syncInfo(cur.blueprint, nextInfo) : cur.blueprint };
  });
  const set = (k) => (e) => setInfo({ [k]: e?.target ? e.target.value : e });

  async function make() {
    if (!info.title?.trim()) { setTitleErr(true); titleRef.current?.focus(); titleRef.current?.scrollIntoView({ block: 'center' }); return; }
    const ing = await import('../../lib/ingest.js');
    const bp = makeDraft(p, ing);
    update({ blueprint: bp, aiMethod: 'draft' });
    toast('사이트 초안을 만들었어요. 오른쪽 미리보기를 보며 고쳐 보세요.');
    go(2);
  }
  function onAi(bp) { update({ blueprint: applyInfo(bp, p.info, p.material, p.blueprint), aiMethod: 'ai' }); setAi(false); toast('AI가 만든 초안으로 바꿨어요.'); go(2); }
  const mat = p.material; const d = mat?.detected || {};

  return (
    <>
      <StepHead title={p.blueprint ? '교재와 기본 정보' : '교재를 넣으면 초안이 바로 나와요'} desc="PPT·PDF·한글(HWPX)·워드 파일을 이 브라우저 안에서 읽어요. 교재는 어디에도 올라가지 않아요." />
      {p.blueprint && (
        <Notice kind="ok"><Mascot size={36} mood="happy" /><div class="spread" style={{ flex: 1 }}><span>사이트 초안이 이미 있어요. 아래 정보를 고치면 사이트에도 바로 반영돼요.</span><button class="btn btn-sm btn-ink" onClick={() => go(2)}>살펴보고 고치기 →</button></div></Notice>
      )}
      <Sheet>
        <div class="stack">
          <div class={`drop${over ? ' over' : ''}`} role="button" tabIndex={0} aria-label="교재 파일 고르기"
            onClick={() => !busy && inp.current?.click()} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && !busy && inp.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); if (!busy) handle(e.dataTransfer.files); }}>
            <Mascot size={80} mood={busy ? 'think' : over ? 'wow' : 'idle'} look={!!busy} />
            <b aria-live="polite">{busy || (p.files?.length ? '교재를 더 넣으려면 여기에 놓거나 누르세요' : '여기에 교재 파일을 놓거나 눌러서 고르세요')}</b>
            <span class="small muted">여러 파일도 돼요. PDF를 넣으면 교재 넘겨 보기용 슬라이드 그림도 만들어요.</span>
            {busy && pct > 0 && <div style={{ width: 'min(320px,80%)' }}><Progress pct={pct} /></div>}
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
        </div>
      </Sheet>

      <Sheet fold={false}>
        <div class="stack">
          <h2 class="h-sub">기본 정보 <span class="small muted">교재에서 찾은 값을 미리 채웠어요</span></h2>
          <div class="form-grid">
            <Field label="연수명(꼭 필요해요)" hint={titleErr && !info.title ? <span style={{ color: 'var(--bad)' }}>연수명을 적어 주세요.</span> : null}>
              <input ref={titleRef} value={info.title} onInput={(e) => { setTitleErr(false); set('title')(e); }} maxLength={160} placeholder="예: 수업에 바로 쓰는 생성형 AI" aria-invalid={titleErr && !info.title ? 'true' : undefined} />
            </Field>
            <Field label="날짜"><input type="date" value={info.date} onInput={set('date')} /></Field>
            <div class="row" style={{ gap: '10px', alignItems: 'end' }}>
              <Field label="시작"><input type="time" value={info.start} onInput={set('start')} /></Field>
              <Field label="끝"><input type="time" value={info.end} onInput={set('end')} /></Field>
            </div>
            <Field label="장소 또는 접속 링크"><input value={info.venue} onInput={set('venue')} maxLength={120} /></Field>
          </div>
          <div class="field"><span>참가 인원</span><Chips options={SIZE} value={info.size} onChange={set('size')} label="참가 인원" /></div>
          <div class="field"><span>참여 기능(선택)</span>
            <Chips multiple options={FEATURES.filter((f) => f.quick).map((f) => ({ value: f.value, label: f.label }))} value={info.features} onChange={(v) => setInfo({ features: [...v, ...(info.features || []).filter((x) => !FEATURES.find((f) => f.quick && f.value === x))] })} label="참여 기능" />
            <small>켜면 연수 날 참가자 휴대폰과 강사 화면이 이어져요. 구글 계정으로 10분이면 연결해요(공유하기 단계에서 안내). 다른 기능은 다음 단계에서 더 켤 수 있어요.</small>
          </div>
        </div>
      </Sheet>

      <div class="make-bar">
        {p.blueprint
          ? <><button class="btn btn-primary btn-lg" onClick={() => go(2)}>살펴보고 고치기 →</button><button class="btn" onClick={() => setConfirmRemake(true)}>교재로 처음부터 다시 만들기</button></>
          : <button class="btn btn-primary btn-lg" disabled={!!busy} onClick={make}>{busy ? '교재를 읽는 중…' : '사이트 만들기 →'}</button>}
        <button class="btn btn-quiet" onClick={() => setAi(true)} disabled={!!busy}>AI로 더 다듬어 만들기(선택)</button>
        {!p.blueprint && <span class="small muted">교재 없이도 연수명만 있으면 만들 수 있어요.</span>}
      </div>

      <Dialog open={confirmRemake} onClose={() => setConfirmRemake(false)} label="다시 만들기 확인">
        <h2 class="h-sub">처음부터 다시 만들까요?</h2>
        <p>고친 문구와 섹션 순서가 새 초안으로 바뀌어요. 고른 디자인과 참여 기능 연결은 그대로 둬요.</p>
        <div class="btn-row"><button class="btn btn-primary" onClick={() => { setConfirmRemake(false); make(); }}>다시 만들기</button><button class="btn btn-quiet" onClick={() => setConfirmRemake(false)}>그만두기</button></div>
      </Dialog>
      <Dialog open={ai} onClose={() => setAi(false)} label="AI로 만들기" wide>
        {ai && <AiPanel p={p} onBlueprint={onAi} onClose={() => setAi(false)} />}
      </Dialog>
    </>
  );
}
