import { useEffect, useRef, useState } from 'preact/hooks';
import { StepHead } from '../Project.jsx';
import { Progress, Field, Notice } from '../../components/ui.jsx';
import { Mascot } from '../../components/Mascot.jsx';
import { AiPick } from '../../components/AiPick.jsx';
import { blobs, storageKind, STORAGE_MSG } from '../../lib/db.js';
import { fmtBytes, toast } from '../../lib/util.js';
import { loadChunk } from '../../lib/fresh.jsx';
import { takePendingFiles, deleteProject, isSavedFile } from '../../lib/project.js';
import { openSaved, openFailMessage } from '../../lib/open-saved.js';
import { isV2 } from '../../lib/site-meta.js';
import { startDemo } from '../../lib/demo.js';

// 1단계 교재 넣기(docs/plan-ai-first.md §2): 읽은 교재(파일·쪽 수)와 AI 고르기만. 연수 정보 칸·교재에서 찾은 요약·기본 초안은 없음
// (연수 정보는 AI가 교재에서 찾아 사이트와 함께 돌려주고, 완성 뒤 한 번 확인받음). 요청 한 줄은 선택.
const ACCEPT = '.pptx,.ppsx,.pdf,.hwpx,.docx,.txt,.md,.hwp,.ppt,.doc,.lecpage';
const safe = (n) => n.replace(/[^\w가-힣.\-]+/g, '_').slice(0, 120);
// 사진은 교재로 읽지 않음: 빨간 오류 대신 실제로 넣는 곳을 한 줄로(여러 장이어도 한 줄)
const PHOTO = /\.(jpe?g|png|gif|webp|heic|heif|bmp)$/i;
const PHOTO_NOTE = '사진은 교재로 읽지 않아요. 사이트에 실으려면 사이트를 만든 뒤 미리보기의 그림을 눌러 바꿔요.';

/** 교재 파일 읽기(브라우저 안): 원본은 src/에 보관(AI에게 원본 그대로 건넴), 쪽 수·보조 글자(material)·쪽 그림(assets/slides/) */
function useIngest(p, update) {
  const [busy, setBusy] = useState('');
  const [pct, setPct] = useState(0);
  const [stop, setStop] = useState(null); // 쪽 그림을 만드는 동안: [쪽 그림 그만 만들기](그때까지 만든 그림은 씀)
  async function ingestAll(fileObjs0, { replace = false, keep = null } = {}) {
    const photos = fileObjs0.filter((f) => PHOTO.test(f.name));
    const fileObjs = fileObjs0.filter((f) => !PHOTO.test(f.name));
    const metas = replace ? [] : (p.files || []).filter((f) => !f.pending && !f.photos);
    const keepPhotos = keep || (replace ? [] : (p.files || []).filter((f) => f.photos).flatMap((f) => f.photos));
    const photoRow = (names) => (names.length ? [{ name: names.length > 1 ? `사진 ${names.length}장` : names[0], ext: 'jpg', size: 0, pages: 0, errors: [], photos: names, note: PHOTO_NOTE }] : []);
    // 읽는 동안 창을 닫아도 교재가 남게: 원본을 먼저 담고 목록에 '읽는 중'으로 적어 둠(다시 열면 이어서 읽음)
    if (!replace && fileObjs.length) {
      for (const f of fileObjs) if (f.size <= 100e6) await blobs.put(p.id, 'src/' + safe(f.name), new Uint8Array(await f.arrayBuffer()));
      update({ files: [...metas, ...fileObjs.map((f) => ({ name: f.name, key: 'src/' + safe(f.name), size: f.size, ext: (f.name.split('.').pop() || '').toLowerCase(), pages: 0, errors: [], pending: true })), ...photoRow([...keepPhotos, ...photos.map((f) => f.name)])] }, { now: true });
    }
    const ing = await loadChunk(() => import('../../lib/ingest.js'), { files: true }); // 새 배포로 조각이 지워졌으면 '새 버전' 안내(고른 교재는 다시)
    const mats = [];
    let slidesMade = replace ? 0 : p.slidesMade || 0; let ok = 0; let empty = 0; let cut = 0;
    for (const [i, f] of fileObjs.entries()) {
      if (f.size > 100e6) { metas.push({ name: f.name, size: f.size, ext: (f.name.split('.').pop() || '').toLowerCase(), pages: 0, errors: ['100MB가 넘어 읽지 않았어요. 나눠서 올려 주세요.'] }); continue; }
      setBusy(`${f.name} 읽는 중 (${i + 1}/${fileObjs.length})`); setPct(5 + Math.round((i / fileObjs.length) * 10));
      const { material, bytes } = await ing.readFile(f);
      const ext = (f.name.split('.').pop() || '').toLowerCase();
      const errors = (material.errors || []).map((e) => e.message_ko);
      // 읽었지만 알릴 것(스캔본처럼 글자가 없는 PDF·앞쪽만 읽음·숨긴 슬라이드 등): 그 파일 줄에 주황 한 줄
      const warns = errors.length ? [] : (material.warnings || []).map((w) => w.message_ko);
      if (!errors.length && (material.warnings || []).some((w) => w.code === 'no-text' || w.code === 'no-content')) empty++;
      metas.push({ name: f.name, key: 'src/' + safe(f.name), size: f.size, ext, pages: material.files?.[0]?.pages || 0, errors, ...(warns.length ? { warns } : {}) });
      if (!errors.length || material.pages?.length) { mats.push(material); ok++; }
      if (f.size <= 100e6 && replace) await blobs.put(p.id, 'src/' + safe(f.name), new Uint8Array(bytes)); // (새로 넣을 때는 읽기 전에 이미 담음)
      if (ext === 'pdf' && !errors.length) {
        await blobs.removePrefix(p.id, 'assets/slides/');
        const ctl = new AbortController(); setStop(ctl);
        const shots = await ing.renderSlides(bytes, (done, total) => { setBusy(`쪽 그림 만드는 중 ${done}/${total}`); setPct(15 + Math.round((done / total) * 80)); }, ctl.signal).finally(() => setStop(null));
        for (const s of shots) await blobs.put(p.id, 'assets/slides/' + ing.slideFileName(s.page, s.type), s.blob);
        slidesMade = shots.length; if (ctl.signal.aborted) cut = shots.length;
      }
    }
    const prev = !replace && p.material ? [p.material] : [];
    const merged = mats.length || prev.length ? ing.materialToJSON(ing.mergeMaterials([...prev, ...mats])) : null;
    update({ material: merged, files: [...metas, ...photoRow([...keepPhotos, ...photos.map((f) => f.name)])], slidesMade });
    const bad = fileObjs.length - ok;
    const ph = photos.length ? ' 사진은 사이트를 만든 뒤 넣어요.' : '';
    toast(!fileObjs.length ? (photos.length ? PHOTO_NOTE : '') : bad === 0 ? (empty ? (empty === ok ? `교재에서 글자를 거의 읽지 못했어요. 주황 글씨를 확인해 주세요.${ph}` : `교재 ${ok}개를 넣었어요. 글자를 못 읽은 파일이 있어요. 주황 글씨를 확인해 주세요.${ph}`) : cut ? `교재 ${ok}개를 읽었어요. 쪽 그림은 ${cut}장까지만 만들었어요.${ph}` : `교재 ${ok}개를 읽었어요.${ph}`)
      : ok ? `${fileObjs.length}개 중 ${ok}개를 읽었어요. 빨간 글씨를 확인해 주세요.${ph}` : '교재를 읽지 못했어요. 빨간 글씨를 확인해 주세요.');
  }
  async function handle(list) {
    const files = Array.from(list || []); if (!files.length) return;
    setBusy('교재를 읽는 중이에요…'); setPct(3);
    try { await ingestAll(files); } catch (e) {
      console.error(e);
      if (e.kind === 'net') toast('교재 읽기 도구를 못 받았어요. 인터넷 연결을 확인하고 새로 고침한 뒤 다시 넣어 주세요.');
      else if (!e.kind) toast(STORAGE_MSG[storageKind(e)] || '교재를 읽지 못했어요. 새로 고침한 뒤 다시 넣어 주세요.');
    }
    setBusy(''); setPct(0);
  }
  async function removeFile(i) {
    const f = p.files[i]; const rest = p.files.filter((_, k) => k !== i);
    setBusy('교재 목록을 다시 읽는 중…'); setPct(5);
    try {
      if (f.key) await blobs.remove?.(p.id, f.key);
      const all = await blobs.all(p.id);
      const again = [];
      for (const m of rest) { const data = all[m.key]; if (data && !m.photos) again.push(new File([data], m.name)); }
      if (f.ext === 'pdf') await blobs.removePrefix(p.id, 'assets/slides/');
      const keep = rest.filter((m) => m.photos).flatMap((m) => m.photos);
      if (again.length) await ingestAll(again, { replace: true, keep });
      else update({ material: null, files: rest.filter((m) => m.photos), slidesMade: 0 });
      toast(`뺐어요: ${f.name}`);
    } catch (e) { console.error(e); toast(STORAGE_MSG[storageKind(e)] || '교재 목록을 다시 읽지 못했어요. 새로 고침한 뒤 다시 해 주세요.'); }
    setBusy(''); setPct(0);
  }
  /** 읽는 중에 창을 닫았던 교재(목록에 '읽는 중'으로 남음)·체험 연수의 예시 교재: 담아 둔 원본으로 이어서 읽음 */
  async function resume() {
    const pend = (p.files || []).filter((f) => f.pending && f.key); if (!pend.length || busy) return;
    const all = await blobs.all(p.id).catch(() => ({}));
    const again = pend.map((m) => (all[m.key] ? new File([all[m.key]], m.name) : null)).filter(Boolean);
    if (!again.length) { update({ files: (p.files || []).filter((f) => !f.pending) }); return; }
    setBusy('교재를 이어서 읽는 중이에요…'); setPct(3);
    try { await ingestAll(again); } catch (e) { console.error(e); }
    setBusy(''); setPct(0);
  }
  return { busy, pct, handle, removeFile, resume, stop };
}

export function StepStart({ p, update, go, job, idle, reload }) {
  const inp = useRef();
  const [over, setOver] = useState(false);
  const latest = useRef(p); latest.current = p;
  const { busy, pct, handle, removeFile, resume, stop } = useIngest(p, update);
  useEffect(() => { resume(); }, []);
  useEffect(() => { const f = takePendingFiles(p.id); if (f.length) handle(f); }, []);
  // ✕로 교재를 뺀 뒤 초점: 같은 자리(없으면 앞) 파일의 ✕, 다 뺐으면 교재 넣는 칸(초점이 화면 맨 위로 사라지지 않게)
  const listRef = useRef(); const dropRef = useRef();
  async function remove(i) {
    await removeFile(i);
    setTimeout(() => { const b = listRef.current?.querySelectorAll('.icon-btn'); (b?.[i] || b?.[i - 1] || dropRef.current)?.focus(); }, 30);
  }
  /** 교재 자리에 저장한 연수(.lecpage, AI 에이전트가 만든 것 포함)를 놓으면 교재가 아니라 그 연수로 엶. 이 연수가 아직 비어 있으면 지움 */
  async function take(list) {
    const files = Array.from(list || []);
    const saved = files.find(isSavedFile);
    if (!saved) return handle(files);
    const cur = latest.current; const empty = !isV2(cur) && !cur.blueprint && !cur.files?.length;
    try { toast(await openSaved(saved)); if (empty) setTimeout(() => deleteProject(cur.id), 800); }
    catch (err) { toast(openFailMessage(err)); }
  }
  const ready = !busy && (p.files || []).some((f) => !f.pending && !f.photos && !f.errors?.length);
  const has = isV2(p);
  const running = job.status === 'running' || job.status === 'paused';
  return (
    <>
      <StepHead title={has ? '교재와 AI' : '교재를 넣고 AI를 선택해요'} desc="PPT·PDF·한글(HWP·HWPX)·워드 파일을 이 브라우저 안에서 읽고, 고른 AI가 교재를 직접 읽어 사이트를 만들어요.">
        {!has && !p.files?.length && !p.demo && <a class="btn btn-sm" href="#/demo">먼저 해보기</a>}
        {has && <button type="button" class="btn btn-primary" onClick={() => go(2)}>미리보기·수정 →</button>}
      </StepHead>
      {running && <div class="ai-job" role="status"><span class="ai-job-dot" aria-hidden="true" /><span class="ai-job-t"><b>AI가 사이트를 만들고 있어요.</b><small>{job.step?.label_ko || ''}</small></span><button type="button" class="btn btn-sm" onClick={() => go(2)}>진행 보기</button></div>}
      {has && !running && <Notice>사이트가 있어요. 여기서 AI를 다시 선택하면 처음부터 새로 만들어요. 지금 사이트는 버전 기록에 남아요.</Notice>}
      {p.demo && ready && !has && !running && <div class="coach"><p class="small"><b>체험은 키가 필요 없어요.</b> 예시 교재로 미리 만든 AI 답을 써서, 실제와 같은 과정으로 만들어요. 아래 AI 선택의 어느 버튼을 눌러도 같아요.</p>
        <button type="button" class="btn btn-primary" data-coach data-coach-room onClick={async () => { await idle(); startDemo(p.id, { request: p.request || '' }); go(2); }}>체험 시작</button></div>}
      <div class="start-flow">
        <section class="stack start-files" aria-labelledby="files-h">
          <h2 class="h-sub" id="files-h">교재</h2>
          <div ref={dropRef} class={`drop${over ? ' over' : ''}${p.files?.length && !busy ? ' drop-more' : ''}`} role="button" tabIndex={0} aria-label="교재 파일 선택"
            onClick={() => !busy && inp.current?.click()} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && !busy && inp.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); if (!busy) take(e.dataTransfer.files); }}>
            {p.files?.length && !busy ? <b aria-live="polite">＋ 교재 추가</b> : <>
              <Mascot size={72} mood={busy ? 'think' : over ? 'wow' : 'idle'} look={!!busy} />
              <b aria-live="polite">{busy || '여기에 교재 파일을 놓거나 눌러서 선택하세요'}</b>
              <span class="small muted">여러 개도 돼요. 저장한 연수(.lecpage)를 놓으면 그 연수를 열어요.</span>
              {busy && pct > 0 && <div style={{ width: 'min(320px,80%)' }}><Progress pct={pct} /></div>}
            </>}
          </div>
          {stop && <div><button type="button" class="btn btn-sm" onClick={() => stop.abort()}>쪽 그림 만들기 중지</button> <span class="small muted">그때까지 만든 그림은 써요.</span></div>}
          <input ref={inp} type="file" multiple hidden accept={ACCEPT} onChange={(e) => { take(e.target.files); e.target.value = ''; }} />
          {p.files?.length > 0 && (
            <ul class="files" ref={listRef} aria-label="읽은 교재">
              {p.files.map((f, i) => (
                <li><span class="kind">{(f.ext || '').toUpperCase()}</span>
                  <div><b>{f.name}</b><div class="small muted">{f.photos ? (f.photos.length > 1 ? f.photos.join(', ') : '') : fmtBytes(f.size)}{f.pending ? ' · 읽는 중' : ''}{f.pages ? ` · ${f.pages}쪽` : ''}</div>{f.note && <div class="small">{f.note}</div>}{f.errors?.map((e) => <div class="small" style={{ color: 'var(--bad)' }}>{e}</div>)}{f.warns?.map((e) => <div class="small file-warn">{e}</div>)}</div>
                  <button class="icon-btn" disabled={!!busy || p.demo} onClick={() => remove(i)} aria-label={`${f.name} 삭제`} title="삭제">✕</button></li>
              ))}
            </ul>
          )}
          <Field label="AI에게 바라는 점 (선택)" hint="구성·분위기·대상을 한 줄로 적으면 AI가 반영해요.">
            <input class="input" value={p.request || ''} onInput={(e) => update({ request: e.target.value })} maxLength={300} placeholder="예: 실습 위주로, 차분한 남색, 처음 배우는 신입 직원 대상" />
          </Field>
          {p.reference && <p class="small ref-line">참고 디자인: <b>{p.reference.name || p.reference}</b> <span class="muted">(따를 필요는 없어요)</span> <button type="button" class="btn btn-sm btn-quiet" onClick={() => update({ reference: '' })}>삭제</button></p>}
        </section>
        <AiPick p={p} go={go} idle={idle} reload={reload} ready={ready} />
      </div>
    </>
  );
}
