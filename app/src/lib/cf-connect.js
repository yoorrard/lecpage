// 내 Cloudflare 계정에 한 번에(lecpage 커넥트 경유): 사이트와 참여 기능 서버를 로그인 한 번으로.
// 경로: /bridge/cloudflare/* (skills/lecpage/scripts/studio-deploy.mjs). 커넥트가 wrangler로 올리고, 앱은 누르기·보기만.
// Cloudflare 토큰은 커넥트 안에만 있음. 관리자 키는 앱이 만들어 커넥트에 건네고(커넥트가 표준 입력으로만 넘김) 이 브라우저·이 PC에 기억
import { bridgeRaw } from './gen/local.js';

export const CF_CAP = 'cloudflare';
/** 참여 기능 서버 이름(계정에 하나). 커넥트의 RELAY_NAME과 같음 */
export const CF_RELAY = 'lecpage-live';
export const CF_NAME_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
// 이 브라우저에서 커넥트로 Cloudflare에 배포·연결한 적이 있음(카드에 '연결돼 있어요', 다음 연수부터 Cloudflare를 먼저 권함). 로그인 자체는 그 PC의 커넥트(wrangler)에 있음
const CF_USED = 'lecpage:cf-used';
export const cfUsed = () => { try { return localStorage.getItem(CF_USED) === '1'; } catch { return false; } };
export const markCfUsed = (on = true) => { try { if (on) localStorage.setItem(CF_USED, '1'); else localStorage.removeItem(CF_USED); } catch { /* 저장 못 해도 배포는 됨 */ } };

class CfFail extends Error {
  constructor(code, message, more = {}) { super(message); this.code = code; Object.assign(this, more); }
}
const json = async (r) => { const j = await r.json().catch(() => ({})); return { status: r.status, ...j }; };
const post = (path, body) => bridgeRaw('/bridge/cloudflare' + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) }).then(json);
/** 지금 상태(진행·물음·결과). 커넥트에 닿지 않으면 null */
export const cfView = () => bridgeRaw('/bridge/cloudflare').then(json).then((j) => j.cf || null, () => null);
export const cfAnswer = (o) => post('/answer', o).catch(() => null);
export const cfCancel = () => bridgeRaw('/bridge/cloudflare', { method: 'DELETE' }).then(json).catch(() => null);

/** 단계 이름 → 화면에 보일 한 줄 */
export const CF_PHASE = {
  tool: 'Cloudflare 연결을 확인하는 중…',
  login: '브라우저에서 Cloudflare에 로그인하고 [Allow]를 눌러 주세요.',
  account: '어느 계정에 배포할지 골라 주세요.',
  subdomain: '주소에 들어갈 이름을 정해 주세요.',
  relay: '참여 기능 서버를 만드는 중…',
  site: '사이트를 배포하는 중…',
  wait: '주소가 열리기를 기다리는 중…',
  delete: 'Cloudflare에서 지우는 중…',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/**
 * 일 하나를 시작하고 끝날 때까지 지켜봄. onView(v): 진행·물음을 화면에. 끝나면 결과, 실패면 CfFail(code, 커넥트 문구).
 * 같은 일이 이미 돌고 있으면(앱을 닫았다 다시 연 경우) 그것을 이어서 봄
 */
export async function cfRun(kind, body, { onView, signal } = {}) {
  let s = await post('/' + kind, body);
  if (s.status === 404) throw new CfFail('old', 'lecpage 커넥트를 새 버전으로 바꿔야 해요.');
  if (s.status === 409 && s.error === 'busy' && s.cf?.kind !== kind) throw new CfFail('busy', s.message_ko || '다른 배포가 돌고 있어요. 끝난 뒤에 다시 해 주세요.');
  if (s.status !== 202 && s.status !== 409) throw new CfFail(s.error || 'failed', s.message_ko || 'lecpage 커넥트가 요청을 받지 않았어요. 다시 눌러 주세요.');
  const id = s.cf?.id;
  let misses = 0;
  for (;;) {
    if (signal?.aborted) { await cfCancel(); throw new CfFail('cancelled', '멈췄어요.'); }
    const v = await cfView();
    if (!v) { if (++misses > 8) throw new CfFail('off', 'lecpage 커넥트가 꺼졌어요. 다시 켠 뒤 눌러 주세요.'); await sleep(1000); continue; }
    misses = 0;
    if (v.id !== id) throw new CfFail('failed', '배포가 다른 요청으로 바뀌었어요. 다시 눌러 주세요.');
    onView?.(v);
    if (!v.running) {
      if (v.error) throw new CfFail(v.error.code || 'failed', v.error.message_ko || 'Cloudflare에서 끝내지 못했어요. 잠시 뒤 다시 시도해 주세요.', { detail: v.error.detail || '' });
      return v.result || {};
    }
    await sleep(v.ask ? 500 : 900);
  }
}

/** 사이트 파일을 커넥트에 건넴 → draft id. onProgress({ step, pct }) */
export async function cfUpload(files, onProgress) {
  const d = await post('/draft');
  if (d.status === 404) throw new CfFail('old', 'lecpage 커넥트를 새 버전으로 바꿔야 해요.');
  if (!d.draft) throw new CfFail(d.error || 'failed', d.message_ko || '올릴 자리를 만들지 못했어요. 다시 눌러 주세요.');
  const names = Object.keys(files);
  let done = 0, next = 0;
  const one = async () => {
    while (next < names.length) {
      const name = names[next++];
      const v = files[name];
      const body = typeof v === 'string' ? new TextEncoder().encode(v) : v;
      const r = await bridgeRaw(`/bridge/cloudflare/files?draft=${d.draft}&path=${encodeURIComponent(name)}`, { method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body });
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new CfFail(j.error || 'failed', j.message_ko || '사이트 파일을 건네지 못했어요. 다시 눌러 주세요.'); }
      onProgress?.({ step: '파일 건네는 중', pct: 8 + Math.round((++done / names.length) * 22) });
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, names.length) }, one));
  return d.draft;
}
