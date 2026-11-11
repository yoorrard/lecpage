// 올라온 .js가 lecpage 엔진 런타임 그대로인지 확인합니다.
// 받는 모양: 런타임 조각 하나, 또는 조각들을 '\n;\n'로 이은 것(live.js = core + 제공자, fx.js = core + 효과들 + 시작 코드).
// 조각 목록은 scripts/gen-runtime.mjs가 엔진에서 뽑아 runtime-allow.js에 둡니다(길이·앞머리·SHA-256).
import { RUNTIME_SEGMENTS } from './runtime-allow.js';
import { sha256Hex } from './ids.js';

export const JOIN = '\n;\n';
/** 런타임 스크립트는 다 합쳐도 이보다 작음. 넘으면 내용을 보지 않고 거절 */
export const MAX_JS_BYTES = 1024 * 1024;

const decoder = new TextDecoder('utf-8', { fatal: true });

/** [이름, 길이, 앞머리, sha256][] → 찾기 좋은 모양 */
export function prepare(segments) {
  return segments.map(([name, len, head, sha256]) => ({ name, len, head, sha256 }));
}
const DEFAULT = prepare(RUNTIME_SEGMENTS);

/**
 * @param {Uint8Array|ArrayBuffer|string} input 파일 내용
 * @param {ReturnType<typeof prepare>} allow
 * @returns {Promise<string[]|null>} 맞으면 조각 이름들, 아니면 null
 */
export async function matchRuntime(input, allow = DEFAULT) {
  let text = input;
  if (typeof input !== 'string') {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    if (!bytes.byteLength || bytes.byteLength > MAX_JS_BYTES) return null;
    try { text = decoder.decode(bytes); } catch { return null; }
  }
  // gen-runtime.mjs와 같은 정규화. CRLF와 LF는 스크립트 뜻을 바꾸지 않음
  text = text.replace(/\r\n/g, '\n');
  if (!text) return null;
  const dead = new Set(); // 여기서 시작하면 끝까지 못 맞추는 위치
  const hashes = new Map(); // "시작:길이" → sha256 (같은 구간을 두 번 재지 않음)
  async function from(pos) {
    if (dead.has(pos)) return null;
    for (const seg of allow) {
      const end = pos + seg.len;
      if (end > text.length || !text.startsWith(seg.head, pos)) continue;
      if (end !== text.length && !text.startsWith(JOIN, end)) continue;
      const k = `${pos}:${seg.len}`;
      if (!hashes.has(k)) hashes.set(k, await sha256Hex(text.slice(pos, end)));
      if (hashes.get(k) !== seg.sha256) continue;
      if (end === text.length) return [seg.name];
      const rest = await from(end + JOIN.length);
      if (rest) return [seg.name, ...rest];
    }
    dead.add(pos);
    return null;
  }
  return from(0);
}

export async function isRuntimeJs(input, allow = DEFAULT) {
  return (await matchRuntime(input, allow)) !== null;
}
