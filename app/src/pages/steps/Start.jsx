import { useEffect, useRef, useState } from 'preact/hooks';
import { StepHead } from '../Project.jsx';
import { Progress, Field, Notice } from '../../components/ui.jsx';
import { Mascot } from '../../components/Mascot.jsx';
import { AiPick } from '../../components/AiPick.jsx';
import { DesignPicks } from '../../components/DesignPicks.jsx';
import { blobs, storageKind, STORAGE_MSG } from '../../lib/db.js';
import { fmtBytes, toast } from '../../lib/util.js';
import { loadChunk } from '../../lib/fresh.jsx';
import { takePendingFiles, deleteProject, isSavedFile } from '../../lib/project.js';
import { openSaved, openFailMessage } from '../../lib/open-saved.js';
import { isV2 } from '../../lib/site-meta.js';
import { startDemo } from '../../lib/demo.js';
import { slideSetsOf, setsEnd, addSet, setsFields, numOf, MAX_SLIDES } from '../../lib/gen/slide-sets.js';
import { tooBigFile, tooBigNote } from '../../lib/material-limits.js';

// 1단계 교재 넣기(docs/plan-ai-first.md §2): 읽은 교재(파일·쪽 수)와 AI 고르기만. 연수 정보 칸·교재에서 찾은 요약·기본 초안은 없음
// (연수 정보는 AI가 교재에서 찾아 사이트와 함께 돌려주고, 완성 뒤 한 번 확인받음). 요청 한 줄은 선택.
const ACCEPT = '.pptx,.ppsx,.pdf,.hwpx,.docx,.txt,.md,.hwp,.ppt,.doc,.key,.lecpage';
const safe = (n) => n.replace(/[^\w가-힣.\-]+/g, '_').slice(0, 120);
// 사진은 교재로 읽지 않음: 빨간 오류 대신 실제로 넣는 곳을 한 줄로(여러 장이어도 한 줄)
const PHOTO = /\.(jpe?g|png|gif|webp|heic|heif|bmp)$/i;
const PHOTO_NOTE = '사진은 교재로 읽지 않아요. 사이트에 실으려면 사이트를 만든 뒤 미리보기의 그림을 눌러 바꿔요.';
// 쪽 그림을 만들지 못하고 글자만 읽은 교재(예전 형식, 그리기 도구를 못 받은 한글 등, 커넥트 없음): PDF로 저장하는 법을 그 줄에서 바로
const TEXT_ONLY_NOTE = '글자만 읽었어요. PDF로 저장해 함께 올리면 그림·디자인까지 읽어 더 정확해요.';
// 쪽 그림은 모든 교재를 합쳐 MAX_SLIDES장까지(교재 슬라이드가 보여 주는 쪽 수): 몫이 남지 않은 교재는 그 줄에 있는 그대로 알림
const capNote = (made) => `쪽 그림은 모든 교재를 합쳐 ${MAX_SLIDES}장까지 만들어요. 이 교재는 ${made ? `앞 ${made}쪽만 그렸어요.` : '쪽 그림 없이 읽어요.'}`;
const HOWTO = {
  ppt: [['PowerPoint', '파일 → 내보내기 → PDF/XPS 문서 만들기'], ['Keynote', '파일 → 내보내기 → PDF'], ['구글 프레젠테이션', '파일 → 다운로드 → PDF 문서']],
  doc: [['Word', '파일 → 다른 이름으로 저장 → 파일 형식에서 PDF'], ['구글 문서', '파일 → 다운로드 → PDF 문서']],
  hwp: [['한글', '파일 → PDF로 저장하기']],
};

/** 넣은 교재 → 목록에 '읽는 중'으로 보일 줄(사진은 교재로 읽지 않아 줄을 미리 만들지 않음) */
const incomingRows = (files) => files.filter((f) => !PHOTO.test(f.name)).map((f) => ({ name: f.name, size: f.size, ext: (f.name.split('.').pop() || '').toLowerCase(), pages: 0, errors: [], pending: true }));

/**
 * 교재 파일 읽기(브라우저 안): 원본은 src/에 보관(AI에게 원본 그대로 건넴), 쪽 수·보조 글자(material)·쪽 그림(assets/slides/)
 * 쪽 그림은 교재마다 그려 이어서 번호를 매김(첫 교재 slide-001~013, 둘째 slide-014~; p.slideSets, lib/gen/slide-sets.js). 교재가 하나면 1번부터
 * first: 첫 화면에서 넣고 온 교재. 첫 그림부터 읽는 모습(작은 칸·목록의 '읽는 중')으로 그려, 다 읽을 때 화면이 밀리지 않게 함
 */
function useIngest(p, update, first = []) {
  const [busy, setBusy] = useState(first.length ? '교재를 읽는 중이에요…' : ''); // 글 또는 [파일 이름, 하는 일](이름이 길면 이름만 줄임)
  const [pct, setPct] = useState(first.length ? 3 : 0);
  const [stop, setStop] = useState(null); // 쪽 그림을 만드는 동안: [중지](그때까지 만든 그림은 씀)
  const [extra, setExtra] = useState(() => incomingRows(first)); // 원본을 담아 목록에 적기 전까지 보일 줄
  const [gone, setGone] = useState(null); // ✕로 뺀 교재: 남은 교재를 다시 읽는 동안에도 목록에서 먼저 뺌
  async function ingestAll(fileObjs0, { replace = false, keep = null } = {}) {
    const photos = fileObjs0.filter((f) => PHOTO.test(f.name));
    const fileObjs = fileObjs0.filter((f) => !PHOTO.test(f.name));
    // 같은 이름의 교재를 다시 넣음: 예전 것을 새 것으로 바꿈(목록·글·쪽 그림이 두 번 들어가지 않게). 남은 교재와 함께 처음부터 다시 읽어 쪽 그림 번호도 다시 매김
    const again = replace ? [] : (p.files || []).filter((m) => !m.pending && !m.photos && m.key && fileObjs.some((f) => f.name === m.name));
    if (again.length) {
      // 남은 교재의 원본만 꺼냄(연수의 모든 파일을 한꺼번에 메모리에 올리지 않게: 큰 교재가 여럿이면 수 GB)
      const rest = [];
      for (const m of (p.files || []).filter((x) => !x.pending && !x.photos && x.key && !again.includes(x))) { const v = await blobs.get(p.id, m.key).catch(() => null); if (v) rest.push(new File([v], m.name)); }
      for (const m of again) if (m.pdf?.key) await blobs.remove(p.id, m.pdf.key); // 예전 파일로 만든 PDF는 다시 만듦
      // 새 원본을 먼저 담음: 다시 읽는 중에 창을 닫았다 열어도(이어서 읽기) 예전 파일이 아니라 새 파일을 읽게
      for (const f of fileObjs) if (!tooBigFile(f)) await blobs.put(p.id, 'src/' + safe(f.name), new Uint8Array(await f.arrayBuffer()));
      return ingestAll([...rest, ...fileObjs0], { replace: true, keep: (p.files || []).filter((m) => m.photos).flatMap((m) => m.photos) });
    }
    const metas = replace ? [] : (p.files || []).filter((f) => !f.pending && !f.photos);
    const keepPhotos = keep || (replace ? [] : (p.files || []).filter((f) => f.photos).flatMap((f) => f.photos));
    const photoRow = (names) => (names.length ? [{ name: names.length > 1 ? `사진 ${names.length}장` : names[0], ext: 'jpg', size: 0, pages: 0, errors: [], photos: names, note: PHOTO_NOTE }] : []);
    // 읽는 동안 창을 닫아도 교재가 남게: 원본을 먼저 담고 목록에 '읽는 중'으로 적어 둠(다시 열면 이어서 읽음)
    if (!replace && fileObjs.length) {
      for (const f of fileObjs) if (!tooBigFile(f)) await blobs.put(p.id, 'src/' + safe(f.name), new Uint8Array(await f.arrayBuffer()));
      update({ files: [...metas, ...fileObjs.map((f) => ({ name: f.name, key: 'src/' + safe(f.name), size: f.size, ext: (f.name.split('.').pop() || '').toLowerCase(), pages: 0, errors: [], pending: true })), ...photoRow([...keepPhotos, ...photos.map((f) => f.name)])] }, { now: true });
      setExtra([]); // 같은 그림에서 목록이 이어받음
    }
    const ing = await loadChunk(() => import('../../lib/ingest.js'), { files: true }); // 새 배포로 조각이 지워졌으면 '새 버전' 안내(고른 교재는 다시)
    const mats = [];
    // 쪽 그림 묶음: 더 넣을 때는 있던 묶음 뒤에 이어 붙이고, 다시 읽을 때(replace)는 처음부터 다시 매김(읽는 중에 창을 닫아도 어긋나지 않게 먼저 비워 적음)
    let sets = replace ? [] : slideSetsOf(p); let ok = 0; let cut = 0;
    if (replace) {
      await blobs.removePrefix(p.id, 'assets/slides/');
      // 같은 저장에서 다시 읽을 교재를 '읽는 중'으로 적어 둠(뺀 교재는 목록에서 빠짐, 글도 비움): 다시 읽는 중에 창을 닫거나 새로 고쳐도
      // 다시 열면 이어서 읽음(resume). 이렇게 적지 않으면 쪽 그림 묶음만 비워진 채 목록은 멀쩡해 보여, AI에게 글자만 감
      const extOf = (n) => (n.split('.').pop() || '').toLowerCase();
      const rereading = fileObjs.map((f) => {
        const old = (p.files || []).find((m) => m.name === f.name && !m.photos);
        return !tooBigFile(f)
          ? { name: f.name, key: 'src/' + safe(f.name), size: f.size, ext: extOf(f.name), pages: 0, errors: [], pending: true, ...(old?.pdf ? { pdf: old.pdf } : {}) }
          : { name: f.name, size: f.size, ext: extOf(f.name), pages: 0, errors: [tooBigNote(f)] };
      });
      update({ ...setsFields([]), material: null, files: [...rereading, ...photoRow([...keepPhotos, ...photos.map((f) => f.name)])] }, { now: true });
    }
    else if (sets.length) { // 읽다 만 교재가 남긴 쪽 그림(묶음에 적히지 않은 뒤 번호)은 지움
      const end = setsEnd(sets);
      for (const k of (await blobs.keys(p.id)).filter((x) => x.startsWith('assets/slides/') && numOf(x) > end)) await blobs.remove(p.id, k);
    }
    // 같은 이름의 PDF를 함께 넣은 PPT·워드·한글은 쪽 그림을 그 PDF에서(더 정확). 그 파일은 PDF로 바꾸거나 따로 그리지 않음
    const base = (n) => n.replace(/\.[^.]+$/, '').toLowerCase();
    const pdfs = new Set([...fileObjs, ...metas].map((f) => f.name).filter((n) => /\.pdf$/i.test(n)).map(base));
    for (const [i, f] of fileObjs.entries()) {
      if (tooBigFile(f)) { metas.push({ name: f.name, size: f.size, ext: (f.name.split('.').pop() || '').toLowerCase(), pages: 0, errors: [tooBigNote(f)] }); continue; }
      setBusy([f.name, ` 읽는 중 (${i + 1}/${fileObjs.length})`]); setPct(5 + Math.round((i / fileObjs.length) * 10));
      let { material, bytes } = await ing.readFile(f);
      const ext = (f.name.split('.').pop() || '').toLowerCase();
      const twin = ext !== 'pdf' && pdfs.has(base(f.name));
      // PDF가 아닌 교재: lecpage 커넥트가 켜져 있으면 이 PC의 PowerPoint·한글·Keynote 등으로 PDF를 만들어 씀(쪽 그림 + AI에게 건넬 PDF)
      let conv = null;
      if (ext !== 'pdf' && !twin && ing.CONVERTIBLE.has(ext)) {
        const ckey = 'conv/' + safe(f.name.replace(/\.[^.]+$/, '')) + '.pdf';
        const old = (p.files || []).find((m) => m.name === f.name && m.pdf?.key === ckey);
        const had = old && await blobs.get(p.id, ckey).catch(() => null); // 교재 하나를 빼서 다시 읽을 때는 전에 만든 PDF를 그대로
        if (had) conv = { ok: true, pdf: had instanceof Blob ? new Uint8Array(await had.arrayBuffer()) : had, via: old.pdf.via, app: old.pdf.app };
        else {
          setBusy([f.name, ': 이 PC의 프로그램으로 PDF 만드는 중']);
          conv = await ing.convertWithConnect(f.name, bytes).catch(() => null);
          if (conv?.ok) await blobs.put(p.id, ckey, conv.pdf);
        }
        if (conv?.ok) {
          conv.key = ckey;
          // 엔진이 바로 읽지 못하는 형식(.ppt·.key·.doc·배포용 한글 등)은 만든 PDF로 글자를 읽음
          if ((material.errors || []).length) { material = await ing.readBytes(f.name.replace(/\.[^.]+$/, '') + '.pdf', conv.pdf.slice()); for (const mf of material.files || []) mf.name = f.name; }
        }
      }
      const errors = (material.errors || []).map((e) => e.message_ko);
      // 쪽 그림(교재 슬라이드·AI에게 보낼 그림): PDF·커넥트가 만든 PDF는 pdf.js로, PPTX·DOCX·한글은 브라우저 안에서 그림
      const pdfBytes = errors.length ? null : ext === 'pdf' ? bytes : conv?.ok ? conv.pdf : null;
      let shots = []; let whole = false; // whole: 끝까지 그림(중지 없이)
      let capped = false; // 모든 교재 합쳐 MAX_SLIDES장의 남은 몫이 모자라 이 교재의 쪽을 다 그리지 못함
      if (pdfBytes || (!errors.length && !twin && ing.canRenderDoc(f.name))) {
        const base = setsEnd(sets); const room = MAX_SLIDES - base; // 이 교재의 쪽 그림은 앞 교재 다음 번호부터
        if (room <= 0) capped = true;
        else {
          const ctl = new AbortController(); setStop(ctl);
          setBusy([f.name, ': 쪽 그림 만드는 중']); // 첫 쪽 전에 그리기 도구를 받는 동안(한글은 몇 초)
          const prog = (done, total) => { setBusy(`쪽 그림 만드는 중 ${done}/${total}`); setPct(15 + Math.round((done / total) * 80)); };
          shots = await (pdfBytes ? ing.renderSlides(pdfBytes.slice(), prog, ctl.signal, room) : ing.renderDoc(f.name, bytes, prog, ctl.signal, room)).catch(() => []).finally(() => setStop(null));
          if (shots.length) {
            if (!base) await blobs.removePrefix(p.id, 'assets/slides/'); // 첫 묶음: 묶음을 적지 않던 예전 연수에 남은 쪽 그림을 비움
            for (const s of shots) await blobs.put(p.id, 'assets/slides/' + ing.slideFileName(base + s.page, s.type), s.blob);
            sets = addSet(sets, f.name, shots.reduce((n, s) => Math.max(n, s.page), 0));
            if (ctl.signal.aborted) cut = shots.length; else whole = true;
            // 남은 몫만큼만 그렸고 교재가 더 김(쪽 수를 아는 PDF·PPT는 그 수로, 모르면 몫을 꽉 채운 것으로 봄). 교재 하나(몫이 다 남음)는 예전처럼 알리지 않음
            const real = ext === 'pdf' || conv?.ok || /^pp/.test(ext) ? material.files?.[0]?.pages || 0 : 0;
            if (whole && base && shots.length >= room && (!real || real > shots.length)) capped = true;
          }
        }
      }
      // 읽었지만 알릴 것(앞쪽만 읽음·숨긴 슬라이드 등): 그 파일 줄에 주황 한 줄.
      // 글자 대신 그림으로 된 PDF(스캔본 등)·그림 위주 교재는 쪽 그림이 있으면 알리지 않음: AI가 원본 PDF·쪽 그림을 직접 읽음
      const quiet = (w) => w.code === 'no-text' || (w.code === 'no-content' && (shots.length || conv?.ok));
      const warns = errors.length ? [] : (material.warnings || []).filter((w) => !quiet(w)).map((w) => w.message_ko);
      // 그림 없이 글자만 읽은 PPT·워드·한글: PDF로 저장해 올리는 법을 그 줄에서 바로
      const textOnly = !errors.length && ext !== 'pdf' && !twin && !shots.length && !conv?.ok && !capped && /^(ppt|pps|pot|doc|hwp|odp|odt|key)/.test(ext);
      const convNote = conv?.ok ? `${conv.app || '이 PC의 프로그램'}로 PDF를 만들어 썼어요.` : '';
      metas.push({ name: f.name, key: 'src/' + safe(f.name), size: f.size, ext, pages: (whole && /^hw/.test(ext) && shots.length) || material.files?.[0]?.pages || shots.length || 0, errors, ...(warns.length ? { warns } : {}),
        ...(conv?.ok ? { pdf: { key: conv.key, via: conv.via || '', app: conv.app || '' }, note: convNote } : {}),
        ...(textOnly ? { note: TEXT_ONLY_NOTE, howto: /^hw/.test(ext) ? 'hwp' : /^(doc|odt)/.test(ext) ? 'doc' : 'ppt' } : {}),
        ...(capped && !errors.length ? { note: [convNote, capNote(shots.length)].filter(Boolean).join(' ') } : {}) });
      if (!errors.length || material.pages?.length) { mats.push(material); ok++; }
      if (!tooBigFile(f) && replace) await blobs.put(p.id, 'src/' + safe(f.name), new Uint8Array(bytes)); // (새로 넣을 때는 읽기 전에 이미 담음)
    }
    const prev = !replace && p.material ? [p.material] : [];
    const merged = mats.length || prev.length ? ing.materialToJSON(ing.mergeMaterials([...prev, ...mats])) : null;
    update({ material: merged, files: [...metas, ...photoRow([...keepPhotos, ...photos.map((f) => f.name)])], ...setsFields(sets) });
    const bad = fileObjs.length - ok;
    const ph = photos.length ? ' 사진은 사이트를 만든 뒤 넣어요.' : '';
    toast(!fileObjs.length ? (photos.length ? PHOTO_NOTE : '') : bad === 0 ? (cut ? `교재 ${ok}개를 읽었어요. 쪽 그림은 ${cut}장까지만 만들었어요.${ph}` : `교재 ${ok}개를 읽었어요.${ph}`)
      : ok ? `${fileObjs.length}개 중 ${ok}개를 읽었어요. 빨간 글씨를 확인해 주세요.${ph}` : '교재를 읽지 못했어요. 빨간 글씨를 확인해 주세요.');
  }
  async function handle(list) {
    const files = Array.from(list || []); if (!files.length) return;
    setBusy('교재를 읽는 중이에요…'); setPct(3); setExtra(incomingRows(files));
    try { await ingestAll(files); } catch (e) {
      console.error(e);
      if (e.kind === 'net') toast('교재 읽기 도구를 못 받았어요. 인터넷 연결을 확인하고 새로 고침한 뒤 다시 넣어 주세요.');
      else if (!e.kind) toast(STORAGE_MSG[storageKind(e)] || '교재를 읽지 못했어요. 새로 고침한 뒤 다시 넣어 주세요.');
    }
    setBusy(''); setPct(0); setExtra([]);
  }
  async function removeFile(i) {
    const f = p.files[i]; const rest = p.files.filter((_, k) => k !== i);
    setBusy('교재 목록을 다시 읽는 중…'); setPct(5); setGone(f);
    try {
      if (f.key) await blobs.remove?.(p.id, f.key);
      if (f.pdf?.key) await blobs.remove?.(p.id, f.pdf.key); // 커넥트로 만든 PDF
      const again = [];
      for (const m of rest) { const data = !m.photos && m.key ? await blobs.get(p.id, m.key).catch(() => null) : null; if (data) again.push(new File([data], m.name)); } // 남은 교재의 원본만(전부를 한꺼번에 메모리에 올리지 않음)
      const keep = rest.filter((m) => m.photos).flatMap((m) => m.photos);
      if (again.length) await ingestAll(again, { replace: true, keep }); // 남은 교재를 다시 읽으며 쪽 그림 번호도 처음부터 다시 매김
      else { await blobs.removePrefix(p.id, 'assets/slides/'); update({ material: null, files: rest.filter((m) => m.photos), ...setsFields([]) }); }
      toast(`뺐어요: ${f.name}`);
    } catch (e) { console.error(e); toast(STORAGE_MSG[storageKind(e)] || '교재 목록을 다시 읽지 못했어요. 새로 고침한 뒤 다시 해 주세요.'); }
    setBusy(''); setPct(0); setGone(null);
  }
  /** 읽는 중에 창을 닫았던 교재(목록에 '읽는 중'으로 남음)·체험 연수의 예시 교재: 담아 둔 원본으로 이어서 읽음 */
  async function resume() {
    const pend = (p.files || []).filter((f) => f.pending && f.key); if (!pend.length || busy) return;
    const again = [];
    for (const m of pend) { const v = await blobs.get(p.id, m.key).catch(() => null); if (v) again.push(new File([v], m.name)); }
    if (!again.length) { update({ files: (p.files || []).filter((f) => !f.pending) }); return; }
    setBusy('교재를 이어서 읽는 중이에요…'); setPct(3);
    try { await ingestAll(again); } catch (e) { console.error(e); }
    setBusy(''); setPct(0);
  }
  // 목록에 보일 줄: 뺀 교재는 먼저 빼고, 넣는 중인 교재는 사진 줄 앞에(목록에 적을 때와 같은 순서)
  const files = (p.files || []).filter((f) => f !== gone);
  const rows = extra.length ? [...files.filter((f) => !f.photos), ...extra, ...files.filter((f) => f.photos)] : files;
  return { busy, pct, handle, removeFile, resume, stop, rows };
}

export function StepStart({ p, update, go, job, idle, reload }) {
  const inp = useRef();
  const [over, setOver] = useState(false);
  const latest = useRef(p); latest.current = p;
  const [first] = useState(() => takePendingFiles(p.id)); // 첫 화면에서 넣고 온 교재(첫 그림부터 '읽는 중'으로 보이게 여기서 받음)
  const { busy, pct, handle, removeFile, resume, stop, rows } = useIngest(p, update, first);
  useEffect(() => { resume(); }, []);
  useEffect(() => { if (first.length) handle(first); }, []);
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
  // 읽는 중에는 다 읽은 뒤와 같은 자리에 그림(작은 교재 칸·목록 줄·AI 선택 칸): 다 읽는 순간 화면이 밀리지 않게
  const reading = !!busy || rows.some((f) => f.pending);
  const [busyName, busyWhat] = Array.isArray(busy) ? busy : ['', busy];
  const has = isV2(p);
  const running = job.status === 'running' || job.status === 'paused';
  return (
    <>
      <StepHead title={has ? '교재와 AI' : '교재를 넣고 AI를 선택해요'} desc="PPT·PDF·한글(HWP·HWPX)·워드 파일을 넣고, 아래에서 사이트를 만들 AI를 골라요.">
        {!has && !rows.length && !p.demo && <a class="btn btn-sm" href="#/demo">먼저 해보기</a>}
        {has && <button type="button" class="btn btn-primary" onClick={() => go(2)}>미리보기·수정 →</button>}
      </StepHead>
      {running && <div class="ai-job" role="status"><span class="ai-job-dot" aria-hidden="true" /><span class="ai-job-t"><b>AI가 사이트를 만들고 있어요.</b><small>{job.step?.label_ko || ''}</small></span><button type="button" class="btn btn-sm" onClick={() => go(2)}>진행 보기</button></div>}
      {has && !running && <Notice>사이트가 있어요. 여기서 AI를 다시 선택하면 처음부터 새로 만들어요. 지금 사이트는 버전 기록에 남아요.</Notice>}
      {p.demo && (ready || reading) && !has && !running && <div class="coach"><p class="small"><b>체험은 키가 필요 없어요.</b> 예시 교재로 미리 만든 AI 답을 써서, 실제와 같은 과정으로 만들어요. 아래 AI 선택의 어느 버튼을 눌러도 같아요.</p>
        <button type="button" class="btn btn-primary" disabled={!ready} data-coach={ready ? '' : undefined} data-coach-room onClick={async () => { await idle(); startDemo(p.id, { request: p.request || '' }); go(2); }}>체험 시작</button></div>}
      <div class="start-flow">
        <section class="stack start-files" aria-labelledby="files-h">
          <h2 class="h-sub" id="files-h">교재</h2>
          <div class={`drop-box${stop ? ' has-stop' : ''}`}>
            <div ref={dropRef} class={`drop${over ? ' over' : ''}${rows.length || busy ? ' drop-more' : ''}`} role="button" tabIndex={0} aria-label="교재 파일 선택"
              onClick={() => !busy && inp.current?.click()} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && !busy && inp.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
              onDrop={(e) => { e.preventDefault(); setOver(false); if (!busy) take(e.dataTransfer.files); }}>
              {busy ? <><span class="drop-busy" key="busy"><Mascot size={24} mood="think" look />
                <b key={busyName || '-'}><span class="drop-busy-f">{busyName}</span><span class="drop-busy-s">{busyWhat}</span></b></span>
                {pct > 0 && <div class="drop-prog"><Progress pct={pct} /></div>}</>
                : rows.length ? <b key="add">＋ 교재 추가</b> : <>
                  <Mascot size={72} mood={over ? 'wow' : 'idle'} />
                  <b>여기에 교재 파일을 놓거나 눌러서 선택하세요</b>
                  <span class="small muted">여러 개도 돼요. 저장한 연수(.lecpage)를 놓으면 그 연수를 열어요.</span>
                </>}
            </div>
            <span class="drop-live" role="status">{busyName}{busyWhat}</span>
            {stop && <button type="button" class="btn btn-sm btn-quiet drop-stop" aria-label="쪽 그림 만들기 중지" title="그때까지 만든 그림은 써요." onClick={() => stop.abort()}>중지</button>}
          </div>
          <input ref={inp} type="file" multiple hidden accept={ACCEPT} onChange={(e) => { take(e.target.files); e.target.value = ''; }} />
          {rows.length > 0 && (
            <ul class="files" ref={listRef} aria-label="읽은 교재">
              {rows.map((f, i) => (
                <li><span class="kind">{(f.ext || '').toUpperCase()}</span>
                  <div><b>{f.name}</b><div class="small muted">{f.photos ? (f.photos.length > 1 ? f.photos.join(', ') : '') : fmtBytes(f.size)}{f.pending ? ' · 읽는 중' : ''}{f.pages ? ` · ${f.pages}쪽` : ''}</div>{f.note && <div class="small">{f.note}</div>}{f.howto && HOWTO[f.howto] && <details class="small file-howto"><summary>PDF로 저장하는 법</summary><ul>{HOWTO[f.howto].map(([app, how]) => <li><b>{app}</b>: {how}</li>)}</ul></details>}{f.errors?.map((e) => <div class="small" style={{ color: 'var(--bad)' }}>{e}</div>)}{f.warns?.map((e) => <div class="small file-warn">{e}</div>)}</div>
                  <button class="icon-btn" disabled={!!busy || p.demo} onClick={() => remove(i)} aria-label={`${f.name} 삭제`} title="삭제">✕</button></li>
              ))}
            </ul>
          )}
          <Field label="AI에게 바라는 점 (선택)" hint="구성·분위기·대상을 한 줄로 적으면 AI가 반영해요.">
            <input class="input" value={p.request || ''} onInput={(e) => update({ request: e.target.value })} maxLength={300} placeholder="예: 실습 위주로, 차분한 남색, 처음 배우는 신입 직원 대상" />
          </Field>
          <DesignPicks p={p} update={update} />
        </section>
        <AiPick p={p} go={go} idle={idle} ready={ready} reading={reading} />
      </div>
    </>
  );
}
