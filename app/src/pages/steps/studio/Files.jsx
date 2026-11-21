import { useRef, useState } from 'preact/hooks';
import { Dialog } from '../../../components/ui.jsx';
import { blobs } from '../../../lib/db.js';
import { toast, uid } from '../../../lib/util.js';
import { siteFileOk } from '@engine/src/kit/paths.js';

// 자료(교재 말고 강의에 쓰는 파일): [자료 추가](끌어다 놓기도)로 올리면 사이트의 files/에 들어가고 참가자가 사이트의 자료실에서 받음.
// 파일은 이 연수 저장소 'site/files/…'(조립이 사이트 파일로 넣음), 목록·이름·설명·순서는 p.materials(조립의 자료실 목록, lib/gen/preview.js ownMaterials).
// 사이트에 자료실 자리 표시(data-lp="materials")가 없으면 키트가 첫 쪽 끝에 자료 칸을 붙임(engine kit assemble). 한도는 바로 배포와 같게(파일 하나 20MB, 사이트 40MB)

export const MAX_FILE = 20e6;
export const MAX_ALL = 30e6; // 자료 모두(사이트 글·교재 쪽 그림이 들어갈 자리를 남김: 바로 배포는 사이트 하나 40MB)
const sizeText = (n) => (!(n > 0) ? '' : n >= 1e6 ? `${(n / 1e6).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1e3))}KB`);
const TYPES = 'PDF·한글·워드·PPT·엑셀·CSV·TXT·ZIP·그림·소리·영상';

/** 사이트에 쓸 파일 이름: 쓸 수 있는 글자만(엔진 SITE_FILE·바로 배포 경로 규칙), 같은 이름이 있으면 ' (2)' */
export function fileName(name, taken = new Set()) {
  const n = String(name || '').normalize('NFC').replace(/[^\w가-힣ㄱ-ㅎㅏ-ㅣ.\-()[\] ]+/g, '_').replace(/\s+/g, ' ').trim();
  const m = /^(.*?)(\.[A-Za-z0-9]{1,8})$/.exec(n);
  const base = ((m ? m[1] : n).replace(/^[.\s_]+|[.\s]+$/g, '') || '자료').slice(0, 110);
  const ext = (m ? m[2] : '').toLowerCase();
  let out = base + ext; let i = 2;
  while (taken.has(out)) out = `${base} (${i++})${ext}`;
  return out;
}

export function FilesCard({ p, update, hasSlot, onAskSlot, locked }) {
  const list = Array.isArray(p.materials) ? p.materials : [];
  const [over, setOver] = useState(false); const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState(null); const [del, setDel] = useState(null);
  const input = useRef();
  const total = list.reduce((a, x) => a + (x.size || 0), 0);
  const save = (fn) => update((cur) => ({ materials: fn(Array.isArray(cur.materials) ? cur.materials : []), editedAt: Date.now() }));
  async function add(files) {
    const picked = [...(files || [])]; if (!picked.length || busy) return;
    setBusy(true);
    const taken = new Set(list.map((x) => x.href.split('/').pop()));
    let sum = total; const out = []; const bad = [];
    for (const f of picked) {
      if (f.size > MAX_FILE) { bad.push(`${f.name}: 파일 하나는 20MB까지예요.`); continue; }
      if (sum + f.size > MAX_ALL) { bad.push(`${f.name}: 자료는 모두 합쳐 30MB까지예요.`); continue; }
      const name = fileName(f.name, taken); const href = `files/${name}`;
      if (!siteFileOk(href)) { bad.push(`${f.name}: 이 형식은 올릴 수 없어요(${TYPES}).`); continue; }
      try { await blobs.put(p.id, 'site/' + href, new Uint8Array(await f.arrayBuffer())); } catch { bad.push(`${f.name}: 저장하지 못했어요. 설정에서 저장 공간을 확인해 주세요.`); continue; }
      taken.add(name); sum += f.size;
      const ext = (/\.([a-z0-9]+)$/i.exec(name) || [])[1] || '';
      out.push({ id: uid(8), title: name.replace(/\.[^.]+$/, ''), desc: '', href, size: f.size, kind: ext.toUpperCase(), at: Date.now() });
    }
    if (out.length) { save((cur) => [...cur, ...out]); toast(`자료 ${out.length}개를 추가했어요. 참가자가 사이트에서 받아요.`); }
    if (bad.length) toast(bad.slice(0, 2).join(' '));
    setBusy(false);
  }
  const move = (i, d) => save((cur) => { const a = [...cur]; const j = i + d; if (j < 0 || j >= a.length) return cur; [a[i], a[j]] = [a[j], a[i]]; return a; });
  async function remove(x) {
    setDel(null);
    // 파일은 저장소(올린 것)나 사이트 글(AI 에이전트가 넣은 글 파일)에 있음: 둘 다에서 뺌
    update((cur) => { const { [x.href]: gone, ...rest } = cur.site || {}; return { materials: (cur.materials || []).filter((y) => y.id !== x.id), editedAt: Date.now(), ...(gone !== undefined ? { site: rest } : {}) }; });
    await blobs.remove(p.id, 'site/' + x.href).catch(() => { });
    toast(`삭제했어요: ${x.title}`);
  }
  return (
    <section class="st-card st-files" aria-labelledby="st-files-h"
      onDragOver={(e) => { if ([...(e.dataTransfer?.types || [])].includes('Files')) { e.preventDefault(); setOver(true); } }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(false); }}
      onDrop={(e) => { if (!e.dataTransfer?.files?.length) return; e.preventDefault(); setOver(false); add(e.dataTransfer.files); }}>
      <div class="st-card-h">
        <h2 id="st-files-h" class="st-h">자료{list.length ? <span class="st-count">{list.length}</span> : null}</h2>
        <button type="button" class="btn btn-sm" disabled={busy || locked} onClick={() => input.current?.click()}>{busy ? '추가하는 중…' : '자료 추가'}</button>
      </div>
      <input ref={input} type="file" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
      {list.length ? <ol class="st-files-list" aria-label="자료 목록">{list.map((x, i) => (
        <li key={x.id}>
          {edit?.id === x.id ? <form class="st-file-edit" onSubmit={(e) => { e.preventDefault(); const t = edit.title.trim(); save((cur) => cur.map((y) => (y.id === x.id ? { ...y, title: t || y.title, desc: edit.desc.trim() } : y))); setEdit(null); }}>
            <input class="input" value={edit.title} maxLength={100} aria-label="자료 이름" onInput={(e) => setEdit({ ...edit, title: e.target.value })} ref={(el) => el && !el.dataset.f && (el.dataset.f = '1', el.focus())} />
            <input class="input" value={edit.desc} maxLength={200} aria-label="자료 설명" placeholder="설명(선택): 예) 실습 1에서 써요" onInput={(e) => setEdit({ ...edit, desc: e.target.value })} />
            <div class="btn-row"><button class="btn btn-sm btn-primary">저장</button><button type="button" class="btn btn-sm btn-quiet" onClick={() => setEdit(null)}>취소</button></div>
          </form> : <>
            <span class="st-file-kind" aria-hidden="true">{x.kind || 'FILE'}</span>
            <button type="button" class="st-file-name" onClick={() => setEdit({ id: x.id, title: x.title, desc: x.desc || '' })} title="이름·설명 수정"><span class="ttl">{x.title}</span><small>{[x.desc, sizeText(x.size)].filter(Boolean).join(' · ')}</small></button>
            <span class="st-file-acts">
              <button type="button" class="icon-btn" disabled={i === 0} aria-label={`${x.title} 위로`} title="위로" onClick={() => move(i, -1)}>↑</button>
              <button type="button" class="icon-btn" disabled={i === list.length - 1} aria-label={`${x.title} 아래로`} title="아래로" onClick={() => move(i, 1)}>↓</button>
              <button type="button" class="icon-btn" aria-label={`${x.title} 삭제`} title="삭제" onClick={() => setDel(x)}>✕</button>
            </span>
          </>}
        </li>))}</ol> : null}
      <button type="button" class={`st-drop${over ? ' over' : ''}`} disabled={busy || locked} onClick={() => input.current?.click()}>
        <b>{list.length ? '자료 더 추가' : '활동지·참고 자료를 올려요'}</b>
        <small>끌어다 놓거나 눌러서 골라요 · 파일 하나 20MB까지 · {TYPES}</small>
      </button>
      {list.length > 0 && <p class="small muted">{hasSlot ? '사이트의 자료실에서 참가자가 다운로드해요.' : <>사이트 맨 아래 자료 칸에서 참가자가 다운로드해요. <button type="button" class="btn-link small" disabled={locked} onClick={onAskSlot}>AI로 자리 옮기기</button></>}</p>}
      <Dialog open={!!del} onClose={() => setDel(null)} label="자료 삭제 확인">
        {del && <><h2 class="h-sub">'{del.title}' 자료를 삭제할까요?</h2><p>사이트의 자료실에서도 빠져요. 이미 배포했으면 다시 배포해야 사이트에서 빠져요.</p>
          <div class="btn-row"><button class="btn btn-quiet" data-autofocus onClick={() => setDel(null)}>닫기</button><button class="btn btn-danger" onClick={() => remove(del)}>삭제</button></div></>}
      </Dialog>
    </section>
  );
}
