// lecpage 커넥트의 '오래 걸리는 일 하나'(로그인 기다림·올리기·지우기)를 앱에서 시작하고 지켜보는 공통 틀.
// 커넥트 쪽은 scripts/studio-deploy.mjs의 createRunner(진행·물음·결과·멈춤)이고, 곳마다 /bridge/<곳>/* 아래 같은 모양으로 답함:
//   GET <base> → { [key]: view } · POST <base>/<일> → 202 · POST <base>/answer · DELETE <base> · POST <base>/draft · POST <base>/files?draft=&path=
// view는 { id, kind, running, phase, seconds, loginUrl?, ask?, error?, result? } — 화면은 components/OneClick.jsx의 RunProgress가 그림
import { bridgeRaw } from './gen/local.js';

export class RunError extends Error {
  constructor(code, message, more = {}) { super(message); this.code = code; Object.assign(this, more); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const json = async (r) => { const j = await r.json().catch(() => ({})); return { status: r.status, ...j }; };

/**
 * @param {object} o { base: '/bridge/vercel', key: 'vc'(답에서 상태가 든 칸), name: 'Vercel'(실패 문구에 넣을 이름) }
 * @returns {{ view, answer, cancel, run, upload }}
 */
export function bridgeRunner({ base, key, name }) {
  const OLD = 'lecpage 커넥트를 새 버전으로 바꿔야 해요.';
  const post = (path, body) => bridgeRaw(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) }).then(json);
  /** 지금 상태(진행·물음·결과). 커넥트에 닿지 않으면 null */
  const view = () => bridgeRaw(base).then(json).then((j) => j[key] || null, () => null);
  const answer = (o) => post('/answer', o).catch(() => null);
  const cancel = () => bridgeRaw(base, { method: 'DELETE' }).then(json).catch(() => null);
  /**
   * 일 하나를 시작하고 끝날 때까지 지켜봄. onView(v): 진행·물음을 화면에. 끝나면 결과, 실패면 RunError(code, 커넥트 문구).
   * 같은 일이 이미 돌고 있으면(앱을 닫았다 다시 연 경우) 그것을 이어서 봄
   */
  async function run(kind, body, { onView, signal } = {}) {
    const s = await post('/' + kind, body);
    if (s.status === 404) throw new RunError('old', OLD);
    if (s.status === 409 && s.error === 'busy' && s[key]?.kind !== kind) throw new RunError('busy', s.message_ko || '다른 배포가 돌고 있어요. 끝난 뒤에 다시 해 주세요.');
    if (s.status !== 202 && s.status !== 409) throw new RunError(s.error || 'failed', s.message_ko || 'lecpage 커넥트가 요청을 받지 않았어요. 다시 눌러 주세요.');
    const id = s[key]?.id;
    let misses = 0;
    for (;;) {
      if (signal?.aborted) { await cancel(); throw new RunError('cancelled', '멈췄어요.'); }
      const v = await view();
      if (!v) { if (++misses > 8) throw new RunError('off', 'lecpage 커넥트가 꺼졌어요. 다시 켠 뒤 눌러 주세요.'); await sleep(1000); continue; }
      misses = 0;
      if (v.id !== id) throw new RunError('failed', '배포가 다른 요청으로 바뀌었어요. 다시 눌러 주세요.');
      onView?.(v);
      if (!v.running) {
        if (v.error) throw new RunError(v.error.code || 'failed', v.error.message_ko || `${name}에서 끝내지 못했어요. 잠시 뒤 다시 시도해 주세요.`, { detail: v.error.detail || '' });
        return v.result || {};
      }
      await sleep(v.ask ? 500 : 900);
    }
  }
  /** 사이트 파일을 커넥트에 건넴 → draft id. onProgress({ step, pct }) */
  async function upload(files, onProgress) {
    const d = await post('/draft');
    if (d.status === 404) throw new RunError('old', OLD);
    if (!d.draft) throw new RunError(d.error || 'failed', d.message_ko || '올릴 자리를 만들지 못했어요. 다시 눌러 주세요.');
    const names = Object.keys(files);
    let done = 0, next = 0;
    const one = async () => {
      while (next < names.length) {
        const n = names[next++];
        const v = files[n];
        const body = typeof v === 'string' ? new TextEncoder().encode(v) : v;
        const r = await bridgeRaw(`${base}/files?draft=${d.draft}&path=${encodeURIComponent(n)}`, { method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body });
        if (!r.ok) { const j = await r.json().catch(() => ({})); throw new RunError(j.error || 'failed', j.message_ko || '사이트 파일을 건네지 못했어요. 다시 눌러 주세요.'); }
        onProgress?.({ step: '파일 건네는 중', pct: 8 + Math.round((++done / names.length) * 22) });
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, names.length) }, one));
    return d.draft;
  }
  return { view, answer, cancel, run, upload };
}
