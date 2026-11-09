// AI 연결: 키는 기본적으로 이 탭의 메모리에만(새로 고침하면 사라짐), 원하면 이 기기에 암호화해 저장(WebCrypto, 꺼낼 수 없는 키).
// 키와 교재는 운영자 서버로 가지 않고, 브라우저에서 AI 회사로 바로 갑니다.
import { kv } from './db.js';
import { E } from './engine.js';

export const PROVIDERS = {
  gemini: { name: 'Google Gemini', free: true, keyUrl: 'https://aistudio.google.com/app/apikey', note: '구글 계정으로 무료 키를 받을 수 있어요. 무료 등급 입력은 구글 제품 개선에 쓰일 수 있으니 학생 개인정보가 담긴 자료는 올리지 마세요.', modelHint: /flash/i },
  openrouter: { name: 'OpenRouter', free: false, keyUrl: 'https://openrouter.ai/keys', note: '로그인 버튼으로 키를 자동으로 받을 수 있어요. 비용은 OpenRouter 크레딧에서 나가요(무료 모델은 하루 50회).', modelHint: /claude|gemini|gpt/i, oauth: true },
  anthropic: { name: 'Anthropic Claude', free: false, keyUrl: 'https://console.anthropic.com/settings/keys', note: '종량제 결제가 필요한 개발자 키예요. Claude 구독(Pro·Max)과는 별개예요.', modelHint: /sonnet/i },
  openai: { name: 'OpenAI', free: false, keyUrl: 'https://platform.openai.com/api-keys', note: '종량제 결제가 필요한 개발자 키예요. ChatGPT 구독과는 별개예요.', modelHint: /^gpt-/i },
};

const mem = new Map(); // 탭 메모리(저장소에 남기지 않음)
let cryptoKeyP = null;
async function deviceKey() {
  if (cryptoKeyP) return cryptoKeyP;
  cryptoKeyP = (async () => {
    let k = await kv.get('device-key');
    if (!k) { k = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']); await kv.set('device-key', k); }
    return k;
  })();
  return cryptoKeyP;
}

export async function saveKey(provider, key, remember) {
  if (key) mem.set(provider, key); else mem.delete(provider);
  if (remember && key) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await deviceKey(), new TextEncoder().encode(key));
    await kv.set('ai:' + provider, { iv, ct });
  } else await kv.del('ai:' + provider);
}
export async function loadKey(provider) {
  if (mem.has(provider)) return { key: mem.get(provider), remembered: !!(await kv.get('ai:' + provider)) };
  const rec = await kv.get('ai:' + provider);
  if (!rec) return { key: '', remembered: false };
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: rec.iv }, await deviceKey(), rec.ct);
    const key = new TextDecoder().decode(pt);
    mem.set(provider, key);
    return { key, remembered: true };
  } catch { return { key: '', remembered: false }; }
}
export async function forgetKey(provider) { mem.delete(provider); await kv.del('ai:' + provider); }

export async function models(provider, key) {
  const list = await E.listModels({ provider, apiKey: key });
  const hint = PROVIDERS[provider].modelHint;
  list.sort((a, b) => (hint.test(b.id) ? 1 : 0) - (hint.test(a.id) ? 1 : 0));
  return list;
}

export async function generate({ provider, key, model, prompt, signal }) {
  const text = await E.callProvider({ provider, apiKey: key, model, prompt, signal });
  return { text, json: E.extractJson(text) };
}

// ── OpenRouter OAuth(PKCE): 버튼 한 번으로 사용자 소유 키 받기 ──
function b64url(bytes) { return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
export async function openRouterStart() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  sessionStorage.setItem('lecpage:or-verifier', verifier);
  sessionStorage.setItem('lecpage:or-return', location.hash || '#/');
  const cb = location.origin + location.pathname;
  location.href = `https://openrouter.ai/auth?callback_url=${encodeURIComponent(cb)}&code_challenge=${challenge}&code_challenge_method=S256`;
}
export async function openRouterFinish() {
  const url = new URL(location.href);
  const code = url.searchParams.get('code');
  const verifier = sessionStorage.getItem('lecpage:or-verifier');
  if (!code || !verifier) return null;
  sessionStorage.removeItem('lecpage:or-verifier');
  const back = sessionStorage.getItem('lecpage:or-return') || '#/';
  history.replaceState(null, '', location.pathname + back);
  const r = await fetch('https://openrouter.ai/api/v1/auth/keys', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code, code_verifier: verifier, code_challenge_method: 'S256' }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.key) throw new Error(j.error?.message || 'OpenRouter 연결에 실패했어요.');
  await saveKey('openrouter', j.key, false);
  return j.key;
}
