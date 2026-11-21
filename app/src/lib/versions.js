// 버전 기록(p.versions)과 AI 수정 대화(p.chat). 화면(Studio)과 생성 쪽(gen/job.js·gen/index.js)이 함께 씀.
// 가져오는 것이 없어 노드 시험(engine/test/app-studio.test.mjs)에서 바로 부름.
// 버전 하나 = 바뀐 뒤의 사이트 전체(site·meta). 새것이 앞, 맨 위가 지금 사이트. AI 수정·직접 수정·연수 정보 수정·복원이 모두 남음.

export const MAX_VERSIONS = 20;
export const MAX_CHAT = 80;
const MERGE = new Set(['edit', 'info']);
const MERGE_MS = 5 * 60e3;
const rid = () => Math.random().toString(36).slice(2, 10);
const json = (v) => JSON.stringify(v ?? null);

/** 기록 v가 판 s(site·meta)와 같은지 */
export function sameState(v, s) {
  if (!v || !s || !v.site || !s.site) return false;
  if (v.site === s.site && v.meta === s.meta) return true;
  return json(v.site) === json(s.site) && json(v.meta) === json(s.meta);
}

/** 직접 수정·연수 정보 수정을 묶은 이름: '직접 수정 · 글 수정, 순서 바꾸기 외 2개' */
export function mergedLabel(kind, parts = []) {
  const head = kind === 'info' ? '연수 정보 수정' : '직접 수정';
  const list = [...new Set(parts.filter(Boolean))];
  if (!list.length) return head;
  return `${head} · ${list.slice(0, 2).join(', ')}${list.length > 2 ? ` 외 ${list.length - 2}개` : ''}`;
}

const snap = (s, label, kind, at, more = {}) => ({ id: rid(), at, kind, label: String(label || '').slice(0, 90), site: s.site, meta: s.meta, ...more });

/**
 * 바뀐 뒤의 판(next)을 맨 위에 남긴 versions(새것이 앞, 최근 20개).
 * - 지금 판(cur)이 맨 위 기록과 다르면(예전 방식 기록·기록 없이 바뀐 것) 먼저 지금 판을 '이전 상태'로 남겨 되돌릴 곳을 잃지 않음
 * - 직접 수정·연수 정보 수정이 5분 안에 잇따르면 맨 위 하나를 고쳐 씀(목록이 AI 수정 버전을 밀어내지 않게. 한 걸음씩은 [실행 취소])
 * kind: make·ai·chat·fix(AI) · edit(직접) · info(연수 정보) · restore(복원) · prev(이전 상태)
 */
export function recordVersion(cur, next, { kind = 'edit', label = '', at = Date.now() } = {}) {
  let list = Array.isArray(cur?.versions) ? cur.versions : [];
  if (!next?.site) return list;
  if (sameState(list[0], next)) return list;
  if (cur?.site && !sameState(list[0], cur)) list = [snap(cur, '이전 상태', 'prev', at - 1), ...list];
  const top = list[0];
  if (MERGE.has(kind)) {
    const joinTop = top?.kind === kind && at - (top.at || 0) < MERGE_MS && (top.n || 1) < 50;
    const parts = joinTop ? [...new Set([...(top.parts || []), label].filter(Boolean))] : [label].filter(Boolean);
    const v = snap(next, mergedLabel(kind, parts), kind, at, { parts, n: joinTop ? (top.n || 1) + 1 : 1 });
    return [v, ...(joinTop ? list.slice(1) : list)].slice(0, MAX_VERSIONS);
  }
  return [snap(next, label, kind, at), ...list].slice(0, MAX_VERSIONS);
}

/** AI 작업이 끝난 뒤의 버전 이름 */
export function aiVersionLabel(kind, { chat = false, request = '' } = {}) {
  if (kind === 'make') return chat ? '쓰던 AI가 만든 버전' : 'AI가 만든 버전';
  if (kind === 'fix') return 'AI로 꼭 고칠 곳 수정';
  const r = String(request || '').replace(/\s+/g, ' ').trim();
  const head = chat ? '쓰던 AI로 수정' : 'AI로 수정';
  return r ? `${head} · ${r.length > 40 ? r.slice(0, 39) + '…' : r}` : head;
}

/** 복원한 버전의 이름(복원을 거듭해도 '복원 · 복원 · …'이 되지 않게) */
export const restoreLabel = (v) => `복원 · ${String(v?.label || '').replace(/^(복원 · )+/, '') || '이전 버전'}`;

/**
 * 떠날 때 남긴 임시본(saver.stash)의 맨 위 몇 개(top)와 저장소의 기록(saved)을 합침: id가 같은 것은 하나만, 새것이 앞
 */
export function mergeVersions(top = [], saved = []) {
  const seen = new Set(); const out = [];
  for (const v of [...(top || []), ...(saved || [])]) { if (!v || seen.has(v.id)) continue; seen.add(v.id); out.push(v); }
  return out.sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, MAX_VERSIONS);
}

/** AI 수정 대화에 한 줄 더한 chat(최근 80개). msg: { role:'user'|'ai', text, … } */
export function addChat(cur, msg, at = Date.now()) {
  return [...(Array.isArray(cur?.chat) ? cur.chat : []), { id: rid(), at, ...msg }].slice(-MAX_CHAT);
}

/**
 * AI 작업이 끝난 뒤 대화에 붙일 답: 무엇을 했는지와 바뀐 곳(섹션 이름), 그 결과 버전(versionId)
 * changed: [{ id, name }] · design: CSS가 바뀜
 */
export function aiReply({ kind = 'edit', way = '', versionId = '', changed = [], design = false, meta = false } = {}) {
  const what = kind === 'fix' ? '꼭 고칠 곳을 고쳤어요.' : '요청대로 고쳤어요.';
  return { role: 'ai', kind, way, versionId, text: what, changed: (changed || []).slice(0, 8), ...(design ? { design: true } : {}), ...(meta ? { meta: true } : {}) };
}
