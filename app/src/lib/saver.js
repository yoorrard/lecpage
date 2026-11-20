// 연수 화면(Project.jsx)의 자동 저장.
// - 고친 뒤 0.15초 모아 한 번에 하나씩 씀(쓰는 중에 또 고치면 끝난 뒤 이어서). 쓰는 동안은 머리에 '저장 중…'
// - 이 탭이 마지막으로 읽거나 쓴 판(updatedAt) 위에만 씀: 그 사이 다른 탭이 고쳤거나 지웠으면 덮지 않고 멈춤(db.js projects.save)
// - 떠날 때(pagehide·화면 숨김) 아직 다 쓰지 못했으면 localStorage에 임시본을 동기로 남김 → 다음에 열 때 되살림(restoreDraft).
//   새로 고침이 IndexedDB 쓰기를 끊어도 고친 글이 남음. 교재 해석(material)은 크고 교재를 넣을 때만 바뀌어(그때는 몇 초 걸려 다 씀) 뺌
// docs/interaction.md 9절(자동 저장)
import { projects } from './db.js';

const KEY = (id) => 'lecpage:unsaved:' + id;
const DAY = 864e5;

function readDraft(id) { try { const v = localStorage.getItem(KEY(id)); return v ? JSON.parse(v) : null; } catch { return null; } }
export function dropDraft(id) { try { localStorage.removeItem(KEY(id)); } catch { /* 저장이 막힌 창 */ } }

/**
 * 불러온 판(v)에 되살릴 임시본이 있으면 합친 판을, 없으면 null.
 * 임시본이 불러온 판 위에서 고친 것일 때만(그 뒤 이 탭이 마저 썼거나 다른 탭이 고쳤으면 저장소 것이 맞으므로 버림). 이레 넘은 것도 버림
 */
export function restoreDraft(v) {
  const d = readDraft(v.id);
  if (!d || !d.p) return null;
  if ((v.updatedAt || 0) > (d.base || 0) || Date.now() - (d.at || 0) > 7 * DAY) { dropDraft(v.id); return null; }
  return { ...v, ...d.p, id: v.id, material: v.material, updatedAt: v.updatedAt };
}

/**
 * @param {string} id 연수 id
 * @param {number} base 불러온 판의 updatedAt
 * @param {(state: 'ok'|'saving'|'failed'|'changed'|'gone', err?: any) => void} onState
 */
export function makeSaver(id, base, onState) {
  let latest = null; let timer = 0; let busy = false; let dirty = false; let failed = false; let stop = '';
  const state = (s, e) => onState(s, e);
  async function run() {
    timer = 0;
    if (busy || !latest || stop) return;
    const p = latest; latest = null; busy = true;
    try {
      const r = await projects.save(p, base);
      if (r.gone) { stop = 'gone'; dropDraft(id); state('gone'); }
      else if (r.changed) { stop = 'changed'; state('changed'); }
      else { base = r.at; failed = false; if (!latest) { dirty = false; dropDraft(id); state('ok'); } }
    } catch (e) {
      if (!latest) latest = p; // 못 쓴 것은 다음 고침이나 [다시 저장]에서 다시
      failed = true; state('failed', e);
    }
    busy = false;
    if (latest && !stop && !failed) run();
  }
  return {
    /** 고친 판을 저장(모아 씀) */
    put(p) { if (stop) return; latest = p; dirty = true; if (!failed) state('saving'); clearTimeout(timer); timer = setTimeout(run, 150); },
    /** 기다리는 것을 바로 씀(다른 화면으로 갈 때·AI 창으로 나가기 직전) */
    flush() { if (timer) { clearTimeout(timer); run(); } },
    /** 실패한 것을 다시 써 봄(저장 공간을 비운 뒤) */
    retry() { if (failed && latest && !stop && !busy) { failed = false; state('saving'); run(); } },
    /** 떠날 때: 아직 다 쓰지 못했으면 지금 판의 임시본(동기). cur: 지금 판 전체 */
    stash(cur) {
      if (!dirty || stop || !cur) return;
      const { material, ...light } = cur;
      try { localStorage.setItem(KEY(id), JSON.stringify({ base, at: Date.now(), p: light })); } catch { /* 저장 공간이 없거나 막힘: 그때는 안내 띠가 이미 떠 있음 */ }
    },
    /** 다른 탭이 고쳤거나 지웠다고 들었을 때: 더 쓰지 않음 */
    halt(why) { if (!stop) { stop = why; clearTimeout(timer); timer = 0; latest = null; } },
    /** 다시 불러온 판에서 이어 씀 */
    reset(b) { base = b; stop = ''; failed = false; latest = null; dirty = false; clearTimeout(timer); timer = 0; },
    base: () => base,
    stopped: () => stop,
    /** 기다리는 것을 다 쓸 때까지(생성 쪽이 저장소에서 이 연수를 읽기 전에) */
    async idle() {
      if (timer) { clearTimeout(timer); run(); }
      for (let i = 0; i < 100 && (busy || timer || (latest && !stop && !failed)); i++) await new Promise((r) => setTimeout(r, 30));
    },
  };
}
