// AI로 사이트 만들기: 화면을 옮겨도 계속 돌고, 끝나면 설계도를 바꿉니다(되돌리기 가능).
// 교재 요약(글)과 연수 정보만 고른 AI 회사로 보냅니다. 강사 메일·실시간 연결 값·키는 보내지 않습니다.
import { useEffect, useState } from 'preact/hooks';
import { E } from './engine.js';
import { makePrompt, makeDraft, looksTruncated, applyInfo, keepFontFields } from './blueprint.js';
import { generateAuto, getActiveAI, explainError, PROVIDERS } from './ai.js';
import { pushUndoFor } from './undo.js';

const jobs = new Map(); // pid → { status: 'running'|'done'|'error', phase, startedAt, error, ctrl }
const subs = new Set();
const emit = () => subs.forEach((f) => f());
const set = (pid, patch) => { jobs.set(pid, { ...(jobs.get(pid) || {}), ...patch }); emit(); };

export const getJob = (pid) => jobs.get(pid) || null;
export function clearJob(pid) { jobs.delete(pid); emit(); }
export function stopJob(pid) { jobs.get(pid)?.ctrl?.abort(); }

/** 지금 프로젝트의 AI 작업 상태(없으면 null). 1초마다 다시 그려 걸린 시간을 보여 줌 */
export function useAiJob(pid) {
  const [, tick] = useState(0);
  useEffect(() => {
    const f = () => tick((x) => x + 1); subs.add(f);
    const t = setInterval(() => { if (jobs.get(pid)?.status === 'running') f(); }, 1000);
    return () => { subs.delete(f); clearInterval(t); };
  }, [pid]);
  return getJob(pid);
}

/**
 * @param {object} o { getProject(): 지금 프로젝트, update(patch|fn): 저장 }
 * 끝나면 done(바뀐 섹션 수), 실패하면 error(쉬운 안내). 초안은 그대로 남습니다.
 */
export async function startMakeJob({ getProject, update, allowPaid }) {
  const p0 = getProject(); const pid = p0.id;
  if (jobs.get(pid)?.status === 'running') return;
  const ctrl = new AbortController();
  set(pid, { status: 'running', phase: 'read', startedAt: Date.now(), error: null, ctrl });
  try {
    const ai = await getActiveAI();
    if (!ai) throw Object.assign(new Error('no-ai'), { kind: 'no-ai' });
    const ing = await import('./ingest.js');
    const prompt = makePrompt(p0, ing);
    set(pid, { phase: 'ask', provider: ai.provider, label: ai.label });
    const big = ['gemini', 'openai'].includes(ai.provider) ? 2 : 1;
    // 무료 한도·혼잡은 알아서 기다렸다 다시 하거나 다음 모델·다른 연결로 넘김(유료 연결은 강사가 허락했을 때만)
    const { text, cut, provider: used } = await generateAuto({ provider: ai.provider, key: ai.key, model: ai.model, prompt, signal: ctrl.signal, maxTokens: 16000 * big },
      { ...(allowPaid ? { allowPaid: true } : {}), onStatus: (st) => set(pid, st.wait ? { phase: 'wait' } : st.provider ? { phase: 'other', via: st.label } : { phase: 'swap' }) });
    if (used !== ai.provider) set(pid, { via: PROVIDERS[used]?.name || used }); else set(pid, { via: '' });
    if (cut && looksTruncated(text)) throw Object.assign(new Error('truncated'), { kind: 'truncated' });
    set(pid, { phase: 'build' });
    let bp;
    try { bp = E.extractJson(text); } catch { throw Object.assign(new Error('format'), { kind: looksTruncated(text) ? 'truncated' : 'format' }); }
    if (!bp || typeof bp !== 'object' || !Array.isArray(bp.sections) || !bp.sections.length) throw Object.assign(new Error('format'), { kind: 'format' });
    const v = E.validate(bp);
    if (v.errors.length) throw Object.assign(new Error(v.errors.map((x) => x.message_ko).join(' ')), { kind: 'invalid' });
    const cur = getProject();
    pushUndoFor(pid, 'AI로 만들기 전', cur);
    update((c) => ({ blueprint: applyInfo(keepFontFields(bp, c.blueprint || makeDraft(c, ing)), c.info, c.material, c.blueprint), aiMethod: 'ai' }));
    set(pid, { status: 'done', phase: 'done', sections: bp.sections.length, ctrl: null });
  } catch (e) {
    if (e.name === 'AbortError') { clearJob(pid); return; }
    const kind = e.kind;
    const x = kind === 'no-ai' ? { title: 'AI가 연결되어 있지 않아요.', body: '교재 넣기 화면에서 AI를 연결해 주세요.', actions: [] }
      : kind === 'format' ? { title: 'AI 답에서 사이트 내용을 찾지 못했어요.', body: '한 번 더 해 보거나, 다른 모델을 골라 주세요.', actions: ['paste'] }
        : kind === 'invalid' ? { title: 'AI 답에 고칠 점이 있어요.', body: e.message, actions: ['paste'] }
          : explainError(kind === 'truncated' ? { kind: 'truncated' } : e, jobs.get(pid)?.provider);
    set(pid, { status: 'error', error: x, ctrl: null });
  }
}
