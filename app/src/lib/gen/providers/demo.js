// 먼저 해보기의 'AI': 어디로도 보내지 않고, 레퍼런스 사이트에서 떼어 낸 답(data/demo-run.js)을 단계마다 조금씩 흘려보냄.
// 다른 회사 어댑터와 같은 꼴(stream → { text, stop, usage })이라 파이프라인(job.js)은 실제와 똑같이 받아 나누고 합침.
const sleep = (ms, signal) => new Promise((res, rej) => {
  if (signal?.aborted) return rej(new DOMException('aborted', 'AbortError'));
  const t = setTimeout(res, ms);
  signal?.addEventListener('abort', () => { clearTimeout(t); rej(new DOMException('aborted', 'AbortError')); }, { once: true });
});

/** @returns {Promise<{ text, stop, usage }>} */
export async function stream({ step, signal, onText }) {
  const { demoAnswer, DEMO_PACE } = await import('../../../data/demo-run.js');
  const full = demoAnswer(step);
  const sec = DEMO_PACE[String(step?.name || '').split(':')[0]] || 2;
  const speed = Math.max(0.05, Number(globalThis.__lpGenTest?.demoSpeed) || 1);
  const n = 24; let text = '';
  for (let i = 1; i <= n; i++) {
    await sleep((sec * 1000) / n / speed, signal);
    text = full.slice(0, Math.round((full.length * i) / n));
    onText?.(text.slice(-200), text);
  }
  return { text: full, stop: 'end', usage: null };
}
