import { useRef, useState } from 'preact/hooks';
import { StepHead, StepFoot } from '../Project.jsx';
import { Sheet, Notice, Progress } from '../../components/ui.jsx';
import { Mascot } from '../../components/Mascot.jsx';
import { blobs } from '../../lib/db.js';
import { fmtBytes, toast } from '../../lib/util.js';

export function StepMaterials({ p, update, go }) {
  const inp = useRef();
  const [busy, setBusy] = useState('');
  const [pct, setPct] = useState(0);
  const [over, setOver] = useState(false);
  const [keepOriginal, setKeepOriginal] = useState(true);
  const mat = p.material;
  const d = mat?.detected || {};

  async function handle(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setBusy('교재를 읽는 중이에요…'); setPct(5);
    try {
      const ing = await import('../../lib/ingest.js');
      const mats = []; const metas = [...(p.files || [])];
      let slidesMade = p.slidesMade || 0;
      for (const [i, f] of files.entries()) {
        if (f.size > 100e6) { toast(`${f.name}: 100MB가 넘어 건너뛰었어요.`); continue; }
        setBusy(`${f.name} 읽는 중… (${i + 1}/${files.length})`);
        const { material, bytes } = await ing.readFile(f);
        mats.push(material);
        const ext = (f.name.split('.').pop() || '').toLowerCase();
        metas.push({ name: f.name, size: f.size, ext, pages: material.files?.[0]?.pages || 0, errors: (material.errors || []).map((e) => e.message_ko) });
        if (ext === 'pdf' && !material.errors?.length) {
          setBusy(`${f.name} 쪽 이미지 만드는 중…`);
          await blobs.removePrefix(p.id, 'assets/slides/');
          const shots = await ing.renderSlides(bytes, (done, total) => setPct(10 + Math.round((done / total) * 80)));
          for (const s of shots) await blobs.put(p.id, 'assets/slides/' + ing.slideFileName(s.page, s.type), s.blob);
          slidesMade = shots.length;
        }
        if (keepOriginal && f.size <= 60e6) await blobs.put(p.id, 'assets/media/' + f.name.replace(/[^\w가-힣.\-]+/g, '_'), new Uint8Array(bytes));
      }
      const prev = p.material ? [p.material] : [];
      const merged = ing.materialToJSON(ing.mergeMaterials([...prev, ...mats]));
      const det = merged.detected || {};
      const info = { ...p.info };
      if (!info.title && det.title) info.title = det.title;
      if (!info.subtitle && det.subtitle) info.subtitle = det.subtitle;
      if (det.event) for (const k of ['date', 'start', 'end', 'venue', 'organizer']) if (!info[k] && det.event[k]) info[k] = det.event[k];
      if (det.archetype?.format && !p.infoTouched) info.format = det.archetype.format;
      update({ material: merged, files: metas, info, slidesMade, summary: ing.summarizeMaterial(merged) });
      toast('교재를 읽었어요.');
    } catch (e) { console.error(e); toast('교재를 읽지 못했어요: ' + (e.message || e)); }
    setBusy(''); setPct(0);
  }
  async function clearAll() {
    await blobs.removePrefix(p.id, 'assets/');
    update({ material: null, files: [], slidesMade: 0, summary: '' });
  }

  return (
    <>
      <StepHead title="교재를 올려 주세요" desc="PPT·PDF·한글(HWPX)·워드 파일을 브라우저 안에서 읽어요. 교재는 어디에도 업로드되지 않아요." />
      <Sheet>
        <div class="stack">
          <div class={`drop${over ? ' over' : ''}`} role="button" tabIndex={0}
            onClick={() => inp.current?.click()} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inp.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); handle(e.dataTransfer.files); }}>
            <Mascot size={88} mood={busy ? 'think' : over ? 'wow' : 'idle'} look={!!busy} />
            <b>{busy || '여기에 교재 파일을 놓거나 눌러서 고르세요'}</b>
            <span class="small muted">여러 파일도 돼요. 교재 뷰어용 쪽 그림은 PDF에서 만들어요(PPT는 PDF로도 저장해 함께 올리면 좋아요).</span>
            {busy && pct > 0 && <div style={{ width: 'min(320px,80%)' }}><Progress pct={pct} /></div>}
          </div>
          <input ref={inp} type="file" multiple hidden accept=".pptx,.ppsx,.pdf,.hwpx,.docx,.txt,.md,.hwp,.ppt,.doc" onChange={(e) => { handle(e.target.files); e.target.value = ''; }} />
          <label class="check"><input type="checkbox" checked={keepOriginal} onChange={(e) => setKeepOriginal(e.target.checked)} /><span>교재 원본을 자료실에 넣어 참가자가 내려받을 수 있게 하기 <span class="muted small">(60MB 이하)</span></span></label>
          {p.files?.length > 0 && (
            <ul class="files">
              {p.files.map((f) => (
                <li><span class="kind">{f.ext.toUpperCase()}</span><div><b>{f.name}</b><div class="small muted">{fmtBytes(f.size)}{f.pages ? ` · ${f.pages}쪽` : ''}</div>{f.errors?.map((e) => <div class="small" style={{ color: 'var(--bad)' }}>{e}</div>)}</div><span /></li>
              ))}
            </ul>
          )}
          {mat && (
            <div class="stack">
              <div class="stats">
                <div class="stat"><b>{(mat.pages || []).length}</b><span>읽은 쪽</span></div>
                <div class="stat"><b>{d.prompts?.length || 0}</b><span>프롬프트</span></div>
                <div class="stat"><b>{d.steps?.length || 0}</b><span>실습 단계 묶음</span></div>
                <div class="stat"><b>{d.tools?.length || 0}</b><span>도구</span></div>
                <div class="stat"><b>{d.links?.length || 0}</b><span>링크</span></div>
                <div class="stat"><b>{p.slidesMade || 0}</b><span>쪽 그림</span></div>
              </div>
              {p.summary && <Notice kind="lav">{p.summary}</Notice>}
              {(mat.errors || []).length > 0 && <Notice kind="bad">{mat.errors.map((e) => e.message_ko).join(' ')}</Notice>}
              <div><button class="btn btn-sm btn-danger" onClick={clearAll}>올린 교재 모두 지우기</button></div>
            </div>
          )}
        </div>
      </Sheet>
      <StepFoot go={go} next={2} nextLabel={mat ? '다음: 연수 정보' : '교재 없이 계속'} />
    </>
  );
}
