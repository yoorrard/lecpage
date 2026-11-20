// OpenAI에 남은 답 지우기. 생성은 Responses API를 store:true로 부르므로(끊겨도 이어 받으려고) 답이 OpenAI 쪽에 남음(표준 보관 기간 30일).
// 다 받으면 바로 지우지만(providers/openai.js), 실패·거절·이어 받기 포기·[멈추기]·그만두기·연수 삭제·새로 만들기로 덮어쓸 때도 지워야 함.
// 지울 응답 id는 이 기기(kv 'openai-trash')에 적어 두고, 키가 있을 때 취소(돌던 답이면 요금도 멈춤) 뒤 DELETE. 키가 없으면 다음에 키가 있을 때 다시.
// 적는 것은 응답 id(resp_…)와 시각뿐(키·교재·답 글은 적지 않음).
import { kv } from '../db.js';
import { loadKey } from '../ai.js';
import { baseFor } from './providers/common.js';

const KEY = 'openai-trash';
const KEEP_MS = 31 * 864e5; // OpenAI 표준 보관 기간(30일)이 지나면 이미 지워졌으므로 목록에서 뺌
const ID = /^resp_[\w-]{1,200}$/;
let busy = null;

/** 작업 기록에서 아직 지우지 않은 OpenAI 응답 id(단계마다 이어 받기 지점 + 기록해 둔 것) */
export function idsOf(rec) {
  if (!rec || rec.provider !== 'openai') return [];
  const ids = new Set(rec.oaIds || []);
  for (const s of rec.steps || []) if (s?.token?.id) ids.add(s.token.id);
  return [...ids].filter((id) => ID.test(id));
}

// ── 작업 기록(job.js)이 부르는 자리: 생성 단계 구조와 상관없이 한 줄씩 ──
const isOa = (rec) => rec?.provider === 'openai';
/** 새 응답 id를 받음(이어 받기 지점): 기록에 적어 둠 */
export function track(rec, id) { if (isOa(rec) && id && !(rec.oaIds || []).includes(id)) rec.oaIds = [...(rec.oaIds || []), id]; }
/** 다 받은 답(어댑터가 이미 지움): 기록에서 뺌 */
export function settled(rec, id) { if (rec?.oaIds?.includes(id)) rec.oaIds = rec.oaIds.filter((x) => x !== id); }
/** 답 하나가 실패함: 끝난 답(실패·거절)이나 이어 받기를 포기한 답이면 OpenAI 쪽 저장에서 지움(받은 글은 기록에 남아 '이어서'로 씀) */
export function failed(rec, e) {
  const id = e?.responseId;
  if (!isOa(rec) || !id || (e.resumeToken && !e.resumeFailed)) return;
  trash([id], { cancel: !!e.resumeFailed }).catch(() => { }); settled(rec, id);
}
/** 작업을 놓음(실패로 멈춤·[멈추기]·그만두기·새 작업이 덮어씀): 남은 답을 모두 취소·삭제하고 이어 받기 지점을 비움 */
export function release(rec, key = '') {
  if (!isOa(rec)) return;
  const ids = idsOf(rec);
  for (const s of rec.steps || []) if (s) s.token = null;
  rec.oaIds = [];
  if (ids.length) trash(ids, { key }).catch(() => { });
}

/** 지울 목록에 더함(키가 있으면 바로 지움). cancel: 아직 돌고 있을 수 있는 답이면 먼저 취소 */
export async function trash(ids, { cancel = true, key = '' } = {}) {
  const list = [...new Set((ids || []).filter((id) => ID.test(String(id))))];
  if (!list.length) return;
  const cur = (await kv.get(KEY).catch(() => null)) || [];
  const have = new Set(cur.map((x) => x.id));
  const next = [...cur, ...list.filter((id) => !have.has(id)).map((id) => ({ id, at: Date.now(), cancel }))].slice(-200);
  await kv.set(KEY, next).catch(() => { });
  flush(key).catch(() => { });
}

/** 지울 목록을 비움(OpenAI 키가 이 탭·기기에 있을 때만). 지웠거나 이미 없으면(404) 목록에서 뺌, 망 오류면 남겨 둠 */
export function flush(key0 = '') {
  if (busy) return busy;
  busy = (async () => {
    const key = key0 || (await loadKey('openai').catch(() => ({ key: '' }))).key;
    if (!key) return 0;
    const cur = (await kv.get(KEY).catch(() => null)) || [];
    if (!cur.length) return 0;
    const base = baseFor('openai'); const auth = { authorization: `Bearer ${key}` };
    const left = []; let done = 0;
    for (const x of cur) {
      if (Date.now() - (x.at || 0) > KEEP_MS) continue;
      try {
        const u = `${base}/v1/responses/${encodeURIComponent(x.id)}`;
        if (x.cancel) await fetch(`${u}/cancel`, { method: 'POST', headers: auth, keepalive: true }).catch(() => null);
        const r = await fetch(u, { method: 'DELETE', headers: auth, keepalive: true });
        if (r.ok || r.status === 404) done++; else left.push(x);
      } catch { left.push(x); }
    }
    // 그사이 더해진 것은 남김
    const now = (await kv.get(KEY).catch(() => null)) || [];
    const gone = new Set(cur.filter((x) => !left.some((y) => y.id === x.id)).map((x) => x.id));
    await kv.set(KEY, now.filter((x) => !gone.has(x.id))).catch(() => { });
    return done;
  })().finally(() => { busy = null; });
  return busy;
}
