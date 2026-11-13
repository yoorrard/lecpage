// BLAKE3(해시 모드, 32바이트 출력)를 순수 JS로. Cloudflare Pages가 파일을 가리키는 열쇠가 이 해시입니다.
// Pages 열쇠 = blake3(파일 내용의 base64 + 확장자).hex 앞 32자 (wrangler의 hashFile과 같음, test/blake3.test.mjs가 blake3-wasm과 맞춰 봄)
// 큰 파일을 한 번에 담지 않도록 조금씩 넣을 수 있습니다(update).

const IV = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
const CHUNK_START = 1; const CHUNK_END = 2; const PARENT = 4; const ROOT = 8;
const BLOCK = 64; const CHUNK = 1024;
// 7라운드 동안 쓰는 메시지 순서(매 라운드 MSG_PERMUTATION을 거듭 적용한 것)
const SCHEDULE = (() => {
  const perm = [2, 6, 3, 10, 7, 0, 4, 13, 1, 11, 12, 5, 9, 14, 15, 8];
  const out = []; let cur = [...Array(16).keys()];
  for (let r = 0; r < 7; r++) { out.push(cur); cur = perm.map((p) => cur[p]); }
  return out;
})();

const s = new Uint32Array(16);
/** 압축 함수. out(16 words)에 결과. cv(8), m(16), counter(64비트를 두 수로), len, flags */
function compress(cv, m, lo, hi, len, flags, out) {
  s[0] = cv[0]; s[1] = cv[1]; s[2] = cv[2]; s[3] = cv[3]; s[4] = cv[4]; s[5] = cv[5]; s[6] = cv[6]; s[7] = cv[7];
  s[8] = IV[0]; s[9] = IV[1]; s[10] = IV[2]; s[11] = IV[3]; s[12] = lo; s[13] = hi; s[14] = len; s[15] = flags;
  for (let r = 0; r < 7; r++) {
    const q = SCHEDULE[r];
    g(0, 4, 8, 12, m[q[0]], m[q[1]]); g(1, 5, 9, 13, m[q[2]], m[q[3]]); g(2, 6, 10, 14, m[q[4]], m[q[5]]); g(3, 7, 11, 15, m[q[6]], m[q[7]]);
    g(0, 5, 10, 15, m[q[8]], m[q[9]]); g(1, 6, 11, 12, m[q[10]], m[q[11]]); g(2, 7, 8, 13, m[q[12]], m[q[13]]); g(3, 4, 9, 14, m[q[14]], m[q[15]]);
  }
  for (let i = 0; i < 8; i++) { out[i] = s[i] ^ s[i + 8]; out[i + 8] = s[i + 8] ^ cv[i]; }
}
function g(a, b, c, d, x, y) {
  let A = s[a]; let B = s[b]; let C = s[c]; let D = s[d];
  A = (A + B + x) | 0; D ^= A; D = (D >>> 16) | (D << 16);
  C = (C + D) | 0; B ^= C; B = (B >>> 12) | (B << 20);
  A = (A + B + y) | 0; D ^= A; D = (D >>> 8) | (D << 24);
  C = (C + D) | 0; B ^= C; B = (B >>> 7) | (B << 25);
  s[a] = A; s[b] = B; s[c] = C; s[d] = D;
}

export class Blake3 {
  constructor() {
    this.cv = new Uint32Array(IV); // 지금 덩어리(1024바이트)의 체인 값
    this.chunk = 0; // 덩어리 번호
    this.block = new Uint8Array(BLOCK); this.blockLen = 0; this.blocksDone = 0; // 덩어리 안에서 압축한 블록 수
    this.stack = []; // 끝난 덩어리들의 체인 값(트리)
    this.m = new Uint32Array(16); this.out = new Uint32Array(16);
  }
  words() {
    const b = this.block; const m = this.m;
    for (let i = 0; i < 16; i++) m[i] = b[i * 4] | (b[i * 4 + 1] << 8) | (b[i * 4 + 2] << 16) | (b[i * 4 + 3] << 24);
    return m;
  }
  /** 가득 찬 블록 하나를 압축(덩어리의 마지막 블록은 finish나 다음 입력이 올 때 처리) */
  compressBlock() {
    const flags = this.blocksDone === 0 ? CHUNK_START : 0;
    compress(this.cv, this.words(), this.chunk >>> 0, Math.floor(this.chunk / 4294967296), BLOCK, flags, this.out);
    this.cv.set(this.out.subarray(0, 8));
    this.blocksDone++; this.blockLen = 0;
  }
  /** 덩어리 하나가 끝남 → 체인 값을 트리에 넣음 */
  endChunk() {
    const flags = (this.blocksDone === 0 ? CHUNK_START : 0) | CHUNK_END;
    compress(this.cv, this.words(), this.chunk >>> 0, Math.floor(this.chunk / 4294967296), this.blockLen, flags, this.out);
    let cv = this.out.slice(0, 8);
    let total = this.chunk + 1;
    while ((total & 1) === 0) { cv = parentCv(this.stack.pop(), cv, this.m, this.out); total /= 2; }
    this.stack.push(cv);
    this.chunk++; this.cv.set(IV); this.blocksDone = 0; this.blockLen = 0; this.block.fill(0);
  }
  /** @param {Uint8Array} data */
  update(data) {
    let i = 0;
    while (i < data.length) {
      // 덩어리가 꽉 찼고 입력이 더 있으면 덩어리를 끝냄
      if (this.blocksDone * BLOCK + this.blockLen === CHUNK) this.endChunk();
      if (this.blockLen === BLOCK) this.compressBlock();
      const n = Math.min(BLOCK - this.blockLen, data.length - i);
      this.block.set(data.subarray(i, i + n), this.blockLen);
      this.blockLen += n; i += n;
    }
    return this;
  }
  /** ASCII 글자열(base64·확장자)을 그대로 바이트로 넣음 */
  updateAscii(str) {
    const n = str.length; const buf = new Uint8Array(Math.min(n, 65536));
    for (let o = 0; o < n; o += buf.length) {
      const k = Math.min(buf.length, n - o);
      for (let j = 0; j < k; j++) buf[j] = str.charCodeAt(o + j) & 0xff;
      this.update(k === buf.length ? buf : buf.subarray(0, k));
    }
    return this;
  }
  /** @returns {Uint8Array} 32바이트 */
  digest() {
    if (this.blockLen) for (let j = this.blockLen; j < BLOCK; j++) this.block[j] = 0;
    // 지금 덩어리의 출력(아직 ROOT는 아님)
    let cv = new Uint32Array(this.cv); let m = new Uint32Array(this.words());
    let lo = this.chunk >>> 0; let hi = Math.floor(this.chunk / 4294967296); let len = this.blockLen;
    let flags = (this.blocksDone === 0 ? CHUNK_START : 0) | CHUNK_END;
    for (let i = this.stack.length - 1; i >= 0; i--) {
      compress(cv, m, lo, hi, len, flags, this.out);
      const right = this.out.slice(0, 8);
      m = new Uint32Array(16); m.set(this.stack[i], 0); m.set(right, 8);
      cv = new Uint32Array(IV); lo = 0; hi = 0; len = BLOCK; flags = PARENT;
    }
    compress(cv, m, lo, hi, len, flags | ROOT, this.out);
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 8; i++) { const w = this.out[i]; bytes[i * 4] = w & 0xff; bytes[i * 4 + 1] = (w >>> 8) & 0xff; bytes[i * 4 + 2] = (w >>> 16) & 0xff; bytes[i * 4 + 3] = (w >>> 24) & 0xff; }
    return bytes;
  }
}
function parentCv(left, right, m, out) {
  m.set(left, 0); m.set(right, 8);
  compress(IV, m, 0, 0, BLOCK, PARENT, out);
  return out.slice(0, 8);
}

const hex = (u) => { let x = ''; for (const b of u) x += (b < 16 ? '0' : '') + b.toString(16); return x; };
/** blake3(바이트 또는 ASCII 글자열) → 16진수 64자 */
export function blake3Hex(input) {
  const h = new Blake3();
  if (typeof input === 'string') h.updateAscii(input); else h.update(input);
  return hex(h.digest());
}

/**
 * 바이트 → base64 조각들(합치면 전체 base64). 큰 파일도 글자열 하나로 만들지 않음.
 * @returns {string[]}
 */
export function base64Parts(bytes, part = 3 * 21846) {
  const out = [];
  for (let o = 0; o < bytes.length; o += part) {
    const slice = bytes.subarray(o, Math.min(bytes.length, o + part));
    let bin = '';
    for (let i = 0; i < slice.length; i += 0x2000) bin += String.fromCharCode.apply(null, slice.subarray(i, i + 0x2000));
    out.push(btoa(bin));
  }
  if (!out.length) out.push('');
  return out;
}

/**
 * Pages 자산 열쇠: blake3(base64(내용) + 확장자) 앞 32자.
 * @param {Uint8Array} bytes
 * @param {string} ext 점 없는 확장자(파일 이름 그대로, 대소문자 유지)
 * @param {string[]} [parts] 이미 만든 base64 조각(있으면 다시 만들지 않음)
 */
export function pagesHash(bytes, ext, parts = base64Parts(bytes)) {
  const h = new Blake3();
  for (const p of parts) h.updateAscii(p);
  h.updateAscii(ext);
  return hex(h.digest()).slice(0, 32);
}
