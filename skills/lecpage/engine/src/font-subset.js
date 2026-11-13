// 글꼴 줄이기: 글꼴 함께 담기(font-bundle.js)만 씁니다. 사이트에 쓰인 글자의 글리프만 남긴 '같은 글꼴' 파일을 만듭니다.
// 글리프 번호는 그대로 두고(쓰지 않는 글리프만 비움) 글자표(cmap)만 남긴 글자로 줄입니다. 그래서 글자 모양·자간(GPOS·kern)·
// 대체 글리프(GSUB, 세로쓰기 문장부호 등)는 원본과 같습니다. 비운 글자는 원본 파일이 맡습니다(font-bundle.js가 둘을 함께 선언).
// 읽기: TrueType·CFF 글꼴(.ttf·.otf), WOFF(zlib), WOFF2(brotli 압축 풀기가 되는 곳: Node 22. 지금 브라우저는 안 되어 null)
// 쓰기: brotli 압축이 되면 WOFF2(표 변환 없음), 아니면 WOFF. 외부 의존성 없음(zlib은 vendor/fflate.js)
import { unzlibSync, zlibSync } from '../vendor/fflate.js';

const u16 = (b, o) => (b[o] << 8) | b[o + 1];
const i16 = (b, o) => { const v = u16(b, o); return v & 0x8000 ? v - 0x10000 : v; };
const u32 = (b, o) => ((b[o] << 24) >>> 0) + (b[o + 1] << 16) + (b[o + 2] << 8) + b[o + 3];
const tag4 = (b, o) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);

/** 늘어나는 바이트 버퍼 */
class W {
  constructor(n = 4096) { this.b = new Uint8Array(n); this.n = 0; }
  need(k) { if (this.n + k <= this.b.length) return; let m = this.b.length * 2; while (m < this.n + k) m *= 2; const nb = new Uint8Array(m); nb.set(this.b.subarray(0, this.n)); this.b = nb; }
  u8(v) { this.need(1); this.b[this.n++] = v & 255; }
  u16(v) { this.need(2); this.b[this.n++] = (v >> 8) & 255; this.b[this.n++] = v & 255; }
  u32(v) { this.need(4); this.b[this.n++] = (v >>> 24) & 255; this.b[this.n++] = (v >> 16) & 255; this.b[this.n++] = (v >> 8) & 255; this.b[this.n++] = v & 255; }
  bytes(a) { this.need(a.length); this.b.set(a, this.n); this.n += a.length; }
  tag(s) { for (let i = 0; i < 4; i++) this.u8(s.charCodeAt(i)); }
  pad(k = 4) { while (this.n % k) this.u8(0); }
  out() { return this.b.slice(0, this.n); }
}

// ── 압축(브라우저·Node 공통 스트림 API. brotli는 되는 곳에서만) ─────────────────────
const streamOk = (Ctor, fmt) => { try { return typeof Ctor === 'function' && !!new Ctor(fmt); } catch { return false; } };
async function pipe(data, stream) { return new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(stream)).arrayBuffer()); }
export const canBrotli = () => streamOk(globalThis.DecompressionStream, 'brotli');
const unbrotli = (d) => (canBrotli() ? pipe(d, new DecompressionStream('brotli')) : null);
const brotli = (d) => (streamOk(globalThis.CompressionStream, 'brotli') ? pipe(d, new CompressionStream('brotli')) : null);

// ── 읽기 ─────────────────────────────────────────────────────────────
const WOFF2_TAGS = 'cmap head hhea hmtx maxp name OS/2 post cvt  fpgm glyf loca prep CFF  VORG EBDT EBLC gasp hdmx kern LTSH PCLT VDMX vhea vmtx BASE GDEF GPOS GSUB EBSC JSTF MATH CBDT CBLC COLR CPAL SVG  sbix acnt avar bdat bloc bsln cvar fdsc feat fmtx fvar gvar hsty just lcar mort morx opbd prop trak Zapf Silf Glat Gloc Feat Sill'.match(/.{4}\s?/g).map((s) => s.slice(0, 4));

/** 글꼴 바이트 → { flavor, tables: Map<표 이름, 바이트> }. 못 읽으면 null(WOFF2인데 brotli가 없는 곳 포함) */
export async function readFont(input) {
  const b = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (b.length < 12) return null;
  const sig = tag4(b, 0);
  if (sig === 'wOF2') return readWoff2(b);
  const tables = new Map();
  if (sig === 'wOFF') {
    const n = u16(b, 12);
    for (let i = 0; i < n; i++) {
      const o = 44 + i * 20, off = u32(b, o + 4), comp = u32(b, o + 8), orig = u32(b, o + 12);
      const d = b.subarray(off, off + comp);
      tables.set(tag4(b, o), comp < orig ? unzlibSync(d) : d);
    }
    return { flavor: u32(b, 4), tables };
  }
  if (u32(b, 0) !== 0x00010000 && sig !== 'OTTO' && sig !== 'true') return null;
  const n = u16(b, 4);
  for (let i = 0; i < n; i++) { const o = 12 + i * 16; tables.set(tag4(b, o), b.subarray(u32(b, o + 8), u32(b, o + 8) + u32(b, o + 12))); }
  return { flavor: u32(b, 0), tables };
}

async function readWoff2(b) {
  const flavor = u32(b, 4), n = u16(b, 12), packed = u32(b, 20);
  if (flavor === 0x74746366) return null; // 글꼴 모음(ttcf)은 다루지 않음
  let p = 48;
  const b128 = () => { let v = 0; for (let i = 0; i < 5; i++) { const c = b[p++]; v = v * 128 + (c & 127); if (!(c & 128)) return v; } throw new Error('woff2 길이'); };
  const dir = [];
  for (let i = 0; i < n; i++) {
    const f = b[p++]; let tag;
    if ((f & 63) === 63) { tag = tag4(b, p); p += 4; } else tag = WOFF2_TAGS[f & 63];
    const ver = (f >> 6) & 3, orig = b128();
    const xf = tag === 'glyf' || tag === 'loca' ? ver === 0 : ver !== 0;
    dir.push({ tag, len: xf ? b128() : orig, xf });
  }
  const data = await unbrotli(b.subarray(p, p + packed));
  if (!data) return null;
  const raw = new Map(); let o = 0;
  for (const t of dir) { raw.set(t.tag, data.subarray(o, o + t.len)); o += t.len; }
  const tables = new Map();
  for (const t of dir) if (!t.xf) tables.set(t.tag, raw.get(t.tag));
  let xMins = null;
  if (dir.find((t) => t.tag === 'glyf')?.xf) {
    const g = decodeGlyf(raw.get('glyf'));
    tables.set('glyf', g.glyf); tables.set('loca', g.loca); xMins = g.xMins;
    const head = tables.get('head').slice(); head[50] = 0; head[51] = g.indexFormat; tables.set('head', head);
  }
  if (dir.find((t) => t.tag === 'hmtx')?.xf) tables.set('hmtx', decodeHmtx(raw.get('hmtx'), u16(tables.get('hhea'), 34), u16(tables.get('maxp'), 4), xMins));
  return { flavor, tables };
}

/** WOFF2 변환된 glyf → TrueType glyf·loca (WOFF2 명세 5.1) */
function decodeGlyf(t) {
  const opt = u16(t, 2), num = u16(t, 4), indexFormat = u16(t, 6);
  const st = []; let off = 36;
  for (let i = 0; i < 7; i++) { st.push(off); off += u32(t, 8 + i * 4); }
  let [pc, pp, pf, pg, pcm, pbb, pin] = st;
  const bbBits = pbb; let pbd = pbb + (((num + 31) >> 5) << 2);
  const overlap = opt & 1 ? off : -1;
  const r255 = (which) => {
    let q = which === 'p' ? pp : pg; const c = t[q++]; let v;
    if (c === 253) { v = u16(t, q); q += 2; } else if (c === 255) v = t[q++] + 253; else if (c === 254) v = t[q++] + 506; else v = c;
    if (which === 'p') pp = q; else pg = q; return v;
  };
  const w = new W(t.length * 2), loca = new Uint32Array(num + 1), xMins = new Int16Array(num);
  for (let i = 0; i < num; i++) {
    loca[i] = w.n;
    const nc = i16(t, pc); pc += 2;
    const hasBox = t[bbBits + (i >> 3)] & (0x80 >> (i & 7));
    if (nc === 0) continue;
    if (nc > 0) {
      const ends = []; let total = 0;
      for (let c = 0; c < nc; c++) { total += r255('p'); ends.push(total - 1); }
      const xs = new Int32Array(total), ys = new Int32Array(total), on = new Uint8Array(total);
      let x = 0, y = 0;
      for (let k = 0; k < total; k++) {
        const fl = t[pf++], f = fl & 0x7f; on[k] = fl & 0x80 ? 0 : 1;
        const s = (flag, v) => (flag & 1 ? v : -v);
        let dx, dy;
        if (f < 10) { dx = 0; dy = s(f, ((f & 14) << 7) + t[pg]); pg += 1; }
        else if (f < 20) { dx = s(f, (((f - 10) & 14) << 7) + t[pg]); dy = 0; pg += 1; }
        else if (f < 84) { const b0 = f - 20, b1 = t[pg]; dx = s(f, 1 + (b0 & 0x30) + (b1 >> 4)); dy = s(f >> 1, 1 + ((b0 & 0x0c) << 2) + (b1 & 0x0f)); pg += 1; }
        else if (f < 120) { const b0 = f - 84; dx = s(f, 1 + (Math.floor(b0 / 12) << 8) + t[pg]); dy = s(f >> 1, 1 + (((b0 % 12) >> 2) << 8) + t[pg + 1]); pg += 2; }
        else if (f < 124) { const b2 = t[pg + 1]; dx = s(f, (t[pg] << 4) + (b2 >> 4)); dy = s(f >> 1, ((b2 & 0x0f) << 8) + t[pg + 2]); pg += 3; }
        else { dx = s(f, (t[pg] << 8) + t[pg + 1]); dy = s(f >> 1, (t[pg + 2] << 8) + t[pg + 3]); pg += 4; }
        x += dx; y += dy; xs[k] = x; ys[k] = y;
      }
      const il = r255('g'), ins = t.subarray(pin, pin + il); pin += il;
      let box;
      if (hasBox) { box = [i16(t, pbd), i16(t, pbd + 2), i16(t, pbd + 4), i16(t, pbd + 6)]; pbd += 8; }
      else { box = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; }
      xMins[i] = box[0];
      writeSimple(w, nc, box, ends, ins, xs, ys, on, overlap >= 0 && (t[overlap + (i >> 3)] & (0x80 >> (i & 7))));
    } else {
      const s0 = pcm; let more = true, inst = false;
      while (more) {
        const fl = u16(t, pcm); pcm += 4 + (fl & 1 ? 4 : 2) + (fl & 8 ? 2 : fl & 0x40 ? 4 : fl & 0x80 ? 8 : 0);
        inst = inst || !!(fl & 0x100); more = !!(fl & 0x20);
      }
      w.u16(0xffff); w.bytes(t.subarray(pbd, pbd + 8)); xMins[i] = i16(t, pbd); pbd += 8;
      w.bytes(t.subarray(s0, pcm));
      if (inst) { const il = r255('g'); w.u16(il); w.bytes(t.subarray(pin, pin + il)); pin += il; }
    }
    w.pad(4);
  }
  loca[num] = w.n;
  const lw = new W((num + 1) * 4);
  for (const v of loca) if (indexFormat) lw.u32(v); else lw.u16(v >> 1);
  return { glyf: w.out(), loca: lw.out(), indexFormat, xMins };
}

/** TrueType 단순 글리프 쓰기(좌표는 앞 점과의 차이: 0이면 생략, 255 안이면 1바이트) */
function writeSimple(w, nc, box, ends, ins, xs, ys, on, overlap) {
  w.u16(nc); for (const v of box) w.u16(v & 0xffff);
  for (const e of ends) w.u16(e);
  w.u16(ins.length); w.bytes(ins);
  const n = xs.length, flags = new Uint8Array(n), xb = new W(n * 2), yb = new W(n * 2);
  let px = 0, py = 0;
  for (let k = 0; k < n; k++) {
    let f = on[k] ? 1 : 0; const dx = xs[k] - px, dy = ys[k] - py; px = xs[k]; py = ys[k];
    if (dx === 0) f |= 0x10; else if (dx > -256 && dx < 256) { f |= 0x02 | (dx > 0 ? 0x10 : 0); xb.u8(Math.abs(dx)); } else xb.u16(dx & 0xffff);
    if (dy === 0) f |= 0x20; else if (dy > -256 && dy < 256) { f |= 0x04 | (dy > 0 ? 0x20 : 0); yb.u8(Math.abs(dy)); } else yb.u16(dy & 0xffff);
    if (k === 0 && overlap) f |= 0x40;
    flags[k] = f;
  }
  w.bytes(flags); w.bytes(xb.out()); w.bytes(yb.out());
}

/** WOFF2 변환된 hmtx → hmtx(빠진 왼쪽 여백은 글리프 xMin) */
function decodeHmtx(t, numH, num, xMins) {
  const fl = t[0]; let p = 1;
  const adv = []; for (let i = 0; i < numH; i++) { adv.push(u16(t, p)); p += 2; }
  const w = new W(numH * 4 + (num - numH) * 2);
  const lsb = (i) => (xMins ? xMins[i] : 0) & 0xffff;
  const lsbs = []; for (let i = 0; i < numH; i++) { if (fl & 1) lsbs.push(lsb(i)); else { lsbs.push(u16(t, p)); p += 2; } }
  for (let i = 0; i < numH; i++) { w.u16(adv[i]); w.u16(lsbs[i]); }
  for (let i = numH; i < num; i++) { if (fl & 2) w.u16(lsb(i)); else { w.u16(u16(t, p)); p += 2; } }
  return w.out();
}

// ── 글자표(cmap) ───────────────────────────────────────────────────────
/** cmap → Map(글자 → 글리프 번호). 유니코드 하위표(형식 4·12)만 */
export function readCmap(t) {
  const map = new Map(); if (!t) return map;
  const n = u16(t, 2), seen = new Set();
  for (let i = 0; i < n; i++) {
    const pid = u16(t, 4 + i * 8), eid = u16(t, 6 + i * 8), o = u32(t, 8 + i * 8);
    if (!(pid === 0 || (pid === 3 && (eid === 1 || eid === 10))) || seen.has(o)) continue;
    seen.add(o);
    const fmt = u16(t, o);
    if (fmt === 4) {
      const segX2 = u16(t, o + 6), ends = o + 14, starts = ends + segX2 + 2, deltas = starts + segX2, ranges = deltas + segX2;
      for (let s = 0; s < segX2 / 2; s++) {
        const end = u16(t, ends + s * 2), start = u16(t, starts + s * 2), delta = u16(t, deltas + s * 2), ro = u16(t, ranges + s * 2);
        for (let c = start; c <= end && c !== 0xffff; c++) {
          let g;
          if (!ro) g = (c + delta) & 0xffff;
          else { const gi = ranges + s * 2 + ro + (c - start) * 2; g = gi + 1 < t.length ? u16(t, gi) : 0; if (g) g = (g + delta) & 0xffff; }
          if (g && !map.has(c)) map.set(c, g);
        }
      }
    } else if (fmt === 12) {
      const ng = u32(t, o + 12);
      for (let k = 0; k < ng; k++) {
        const q = o + 16 + k * 12, s = u32(t, q), e = u32(t, q + 4), g0 = u32(t, q + 8);
        for (let c = s; c <= e && c <= 0x10ffff; c++) if (!map.has(c)) map.set(c, g0 + c - s);
      }
    }
  }
  return map;
}

/** Map(글자 → 글리프) → cmap 표(3,1 형식 4 + 기본 평면 밖 글자가 있으면 3,10 형식 12) */
function writeCmap(map) {
  const cps = [...map.keys()].sort((a, b) => a - b);
  const runs = []; // [시작 글자, 끝 글자, 시작 글리프]
  for (const c of cps) { const g = map.get(c), r = runs[runs.length - 1]; if (r && c === r[1] + 1 && g === r[2] + (c - r[0])) r[1] = c; else runs.push([c, c, g]); }
  const bmp = runs.filter((r) => r[0] <= 0xffff).map((r) => [r[0], Math.min(r[1], 0xfffe), r[2]]);
  const segs = [...bmp, [0xffff, 0xffff, 1]], sc = segs.length;
  if (sc > 8000) return null; // 형식 4 길이(16비트)를 넘김
  const f4 = new W(16 + sc * 8);
  const es = 2 ** Math.floor(Math.log2(sc));
  f4.u16(4); f4.u16(16 + sc * 8); f4.u16(0); f4.u16(sc * 2); f4.u16(es * 2); f4.u16(Math.log2(es)); f4.u16(sc * 2 - es * 2);
  for (const s of segs) f4.u16(s[1]); f4.u16(0);
  for (const s of segs) f4.u16(s[0]);
  for (const s of segs) f4.u16((s[2] - s[0]) & 0xffff);
  for (let i = 0; i < sc; i++) f4.u16(0);
  const wide = runs.some((r) => r[1] > 0xffff);
  const w = new W(); w.u16(0); w.u16(wide ? 2 : 1);
  w.u16(3); w.u16(1); w.u32(wide ? 20 : 12);
  if (wide) { w.u16(3); w.u16(10); w.u32(20 + f4.n); }
  w.bytes(f4.out());
  if (wide) { w.u16(12); w.u16(0); w.u32(16 + runs.length * 12); w.u32(0); w.u32(runs.length); for (const r of runs) { w.u32(r[0]); w.u32(r[1]); w.u32(r[2]); } }
  return w.out();
}

// ── 남길 글리프 고르기 ──────────────────────────────────────────────────
function coverage(t, o) {
  const f = u16(t, o), out = [];
  if (f === 1) { const c = u16(t, o + 2); for (let i = 0; i < c; i++) out.push(u16(t, o + 4 + i * 2)); }
  else if (f === 2) { const c = u16(t, o + 2); for (let i = 0; i < c; i++) { const r = o + 4 + i * 6, s = u16(t, r), e = u16(t, r + 2), si = u16(t, r + 4); for (let g = s; g <= e; g++) out[si + g - s] = g; } }
  return out;
}
/** GSUB가 남긴 글리프에서 바꿔 낼 수 있는 글리프를 모두 더함(기능이 켜졌는지·문맥은 보지 않음: 넉넉하게) */
function gsubClosure(t, gids, num) {
  if (!t || t.length < 10) return;
  const L = u16(t, 8), subs = [];
  for (let i = 0, n = u16(t, L); i < n; i++) {
    const lo = L + u16(t, L + 2 + i * 2), type = u16(t, lo);
    for (let j = 0, c = u16(t, lo + 4); j < c; j++) {
      let so = lo + u16(t, lo + 6 + j * 2), ty = type;
      if (ty === 7) { ty = u16(t, so + 2); so += u32(t, so + 4); }
      if ([1, 2, 3, 4, 8].includes(ty)) subs.push([ty, so, coverage(t, so + u16(t, so + 2))]);
    }
  }
  const add = (g) => { if (g < num) gids.add(g); };
  for (let round = 0, before = -1; round < 20 && before !== gids.size; round++) {
    before = gids.size;
    for (const [ty, s, cov] of subs) {
      const fmt = u16(t, s);
      cov.forEach((g, i) => {
        if (!gids.has(g)) return;
        if (ty === 1) add(fmt === 1 ? (g + i16(t, s + 4)) & 0xffff : u16(t, s + 6 + i * 2));
        else if (ty === 2 || ty === 3) { const q = s + u16(t, s + 6 + i * 2); for (let k = 0, c = u16(t, q); k < c; k++) add(u16(t, q + 2 + k * 2)); }
        else if (ty === 4) {
          const ls = s + u16(t, s + 6 + i * 2);
          for (let k = 0, c = u16(t, ls); k < c; k++) {
            const lo = ls + u16(t, ls + 2 + k * 2), cc = u16(t, lo + 2); let ok = true;
            for (let m = 0; m < cc - 1 && ok; m++) ok = gids.has(u16(t, lo + 4 + m * 2));
            if (ok) add(u16(t, lo));
          }
        } else if (ty === 8) {
          let q = s + 4; q += 2 + u16(t, q) * 2; q += 2 + u16(t, q) * 2;
          if (i < u16(t, q)) add(u16(t, q + 2 + i * 2));
        }
      });
    }
  }
}

function readLoca(loca, long, num) {
  const out = new Uint32Array(num + 1);
  for (let i = 0; i <= num; i++) out[i] = long ? u32(loca, i * 4) : u16(loca, i * 2) * 2;
  return out;
}
/** 합성 글리프가 쓰는 부품 글리프도 남김 */
function glyfClosure(glyf, offs, gids) {
  const stack = [...gids];
  while (stack.length) {
    const g = stack.pop(), s = offs[g], e = offs[g + 1];
    if (e - s < 10 || i16(glyf, s) >= 0) continue;
    for (let p = s + 10; ;) {
      const fl = u16(glyf, p), gi = u16(glyf, p + 2);
      if (!gids.has(gi) && gi < offs.length - 1) { gids.add(gi); stack.push(gi); }
      p += 4 + (fl & 1 ? 4 : 2) + (fl & 8 ? 2 : fl & 0x40 ? 4 : fl & 0x80 ? 8 : 0);
      if (!(fl & 0x20) || p >= e) break;
    }
  }
}

// ── CFF(PostScript 윤곽) ──────────────────────────────────────────────
function readIndex(c, o) {
  const count = u16(c, o);
  if (!count) return { start: o, end: o + 2, items: [] };
  const os = c[o + 2], off = (i) => { let v = 0; for (let k = 0; k < os; k++) v = v * 256 + c[o + 3 + i * os + k]; return v; };
  const base = o + 3 + (count + 1) * os - 1, items = [];
  for (let i = 0; i < count; i++) items.push(c.subarray(base + off(i), base + off(i + 1)));
  return { start: o, end: base + off(count), items };
}
function writeIndex(items) {
  const w = new W();
  w.u16(items.length); if (!items.length) return w.out();
  const total = items.reduce((a, x) => a + x.length, 0) + 1, os = total < 0x100 ? 1 : total < 0x10000 ? 2 : total < 0x1000000 ? 3 : 4;
  w.u8(os);
  const put = (v) => { for (let k = os - 1; k >= 0; k--) w.u8(Math.floor(v / 2 ** (8 * k)) & 255); };
  let at = 1; put(at); for (const x of items) { at += x.length; put(at); }
  for (const x of items) w.bytes(x);
  return w.out();
}
/** DICT → [{ op, args: [{ v, raw }] }] (12 x 연산자는 1200+x) */
function parseDict(d) {
  const out = []; let args = [];
  for (let p = 0; p < d.length;) {
    const b0 = d[p], s = p;
    if (b0 <= 21) { let op = b0; p++; if (b0 === 12) op = 1200 + d[p++]; out.push({ op, args }); args = []; continue; }
    let v = NaN;
    if (b0 === 28) { v = i16(d, p + 1); p += 3; }
    else if (b0 === 29) { v = (d[p + 1] << 24) | (d[p + 2] << 16) | (d[p + 3] << 8) | d[p + 4]; p += 5; }
    else if (b0 === 30) { p++; while (p < d.length) { const x = d[p++]; if ((x & 15) === 15 || (x >> 4) === 15) break; } }
    else if (b0 >= 32 && b0 <= 246) { v = b0 - 139; p += 1; }
    else if (b0 >= 247 && b0 <= 250) { v = (b0 - 247) * 256 + d[p + 1] + 108; p += 2; }
    else if (b0 >= 251 && b0 <= 254) { v = -(b0 - 251) * 256 - d[p + 1] - 108; p += 2; }
    else return null;
    args.push({ v, raw: d.subarray(s, p) });
  }
  return out;
}
const int5 = (v) => ({ v, raw: Uint8Array.of(29, (v >>> 24) & 255, (v >> 16) & 255, (v >> 8) & 255, v & 255) });
function writeDict(entries) {
  const w = new W(256);
  for (const e of entries) { for (const a of e.args) w.bytes(a.raw); if (e.op >= 1200) { w.u8(12); w.u8(e.op - 1200); } else w.u8(e.op); }
  return w.out();
}
function charsetLen(c, o, n) {
  const f = c[o]; if (f === 0) return 1 + (n - 1) * 2;
  let p = o + 1;
  for (let have = 1; have < n;) { const left = f === 1 ? c[p + 2] : u16(c, p + 2); p += f === 1 ? 3 : 4; have += left + 1; }
  return p - o;
}
function charsetSids(c, o, n) {
  const sid = new Uint32Array(n), f = c[o]; let p = o + 1;
  if (f === 0) { for (let g = 1; g < n; g++) sid[g] = u16(c, o + 1 + (g - 1) * 2); return sid; }
  for (let g = 1; g < n;) { const first = u16(c, p), left = f === 1 ? c[p + 2] : u16(c, p + 2); p += f === 1 ? 3 : 4; for (let k = 0; k <= left && g < n; k++) sid[g++] = first + k; }
  return sid;
}
function encodingLen(c, o) { const f = c[o] & 0x7f; let len = f === 0 ? 2 + c[o + 1] : 2 + c[o + 1] * 2; if (c[o] & 0x80) len += 1 + c[o + len] * 3; return len; }
function fdSelectLen(c, o, n) { return c[o] === 0 ? 1 + n : 3 + u16(c, o + 1) * 3 + 2; }

const subrBias = (n) => (n < 1240 ? 107 : n < 33900 ? 1131 : 32768);
/**
 * 남긴 글리프의 charstring을 따라가며 부르는 서브루틴(전역·지역)을 표시. 한글 CFF 글꼴은 서브루틴이 글꼴의 대부분이라
 * 안 쓰는 서브루틴을 비워야 작아짐(번호는 그대로). 계산 연산자처럼 따라갈 수 없는 것을 만나면 false(서브루틴을 그대로 둠)
 */
function markSubrs(cs, gsubrs, lsubrs, gUsed, lUsed) {
  const nums = []; let stems = 0, depth = 0, done = false;
  const run = (s) => {
    if (++depth > 12) return false;
    for (let p = 0; p < s.length && !done;) {
      const b = s[p];
      if (b === 28) { nums.push(i16(s, p + 1)); p += 3; continue; }
      if (b >= 32) {
        if (b <= 246) { nums.push(b - 139); p += 1; } else if (b <= 250) { nums.push((b - 247) * 256 + s[p + 1] + 108); p += 2; }
        else if (b <= 254) { nums.push(-(b - 251) * 256 - s[p + 1] - 108); p += 2; } else { nums.push(((s[p + 1] << 24) | (s[p + 2] << 16) | (s[p + 3] << 8) | s[p + 4]) / 65536); p += 5; }
        continue;
      }
      p++;
      if (b === 1 || b === 3 || b === 18 || b === 23) { stems += nums.length >> 1; nums.length = 0; }
      else if (b === 19 || b === 20) { stems += nums.length >> 1; nums.length = 0; p += (stems + 7) >> 3; }
      else if (b === 10 || b === 29) {
        const list = b === 10 ? lsubrs : gsubrs, used = b === 10 ? lUsed : gUsed;
        if (!list || !nums.length) return false;
        const i = nums.pop() + subrBias(list.length);
        if (!(i >= 0 && i < list.length)) return false;
        used.add(i);
        if (!run(list[i])) return false;
      } else if (b === 11) { depth--; return true; }
      else if (b === 14) { done = true; }
      else if (b === 12) { const x = s[p++]; if (!(x === 0 || (x >= 34 && x <= 37))) return false; nums.length = 0; } // 12 34~37(flex 꼴)만, 계산 연산자는 따라가지 않음
      else nums.length = 0;
    }
    depth--; return true;
  };
  return run(cs);
}
const RET = Uint8Array.of(11);

/** CFF: 남기지 않는 글리프의 charstring을 endchar 하나로, 안 쓰는 서브루틴은 return 하나로. 위치가 바뀌는 오프셋은 5바이트 정수로 다시 씀 */
function subsetCff(c, gids) {
  let p = c[2];
  const name = readIndex(c, p); p = name.end;
  const topI = readIndex(c, p); p = topI.end;
  const strs = readIndex(c, p); p = strs.end;
  const gsubrs = readIndex(c, p);
  if (topI.items.length !== 1) return null;
  const top = parseDict(topI.items[0]); if (!top) return null;
  const val = (op, i = 0) => top.find((e) => e.op === op)?.args[i]?.v;
  const cs = readIndex(c, val(17)), n = cs.items.length, cid = val(1230) !== undefined || top.some((e) => e.op === 1230);
  const csetOff = val(15) || 0, encOff = val(16) || 0;
  if (!cid) {
    if (csetOff <= 2) return null; // 정해진 글자 이름표(라틴 글꼴): 줄일 것이 없음
    const sid = charsetSids(c, csetOff, n);
    for (let g = 0; g < n; g++) if (sid[g] < 391) gids.add(g); // 표준 이름 글리프는 남김(seac 악센트 부품)
  }
  const cset = csetOff > 2 ? c.subarray(csetOff, csetOff + charsetLen(c, csetOff, n)) : null;
  const enc = !cid && encOff > 1 ? c.subarray(encOff, encOff + encodingLen(c, encOff)) : null;
  const fdsOff = val(1237), fdaOff = val(1236);
  const fds = cid && fdsOff ? c.subarray(fdsOff, fdsOff + fdSelectLen(c, fdsOff, n)) : null;
  const fonts = cid && fdaOff ? readIndex(c, fdaOff).items.map(parseDict) : null;
  if (cid && (!fds || !fonts || fonts.some((d) => !d))) return null;
  const privOf = (d) => {
    const e = d.find((x) => x.op === 18); if (!e) return null;
    const size = e.args[0].v, off = e.args[1].v, pd = parseDict(c.subarray(off, off + size)); if (!pd) return null;
    const se = pd.find((x) => x.op === 19);
    return { pd, subrs: se ? readIndex(c, off + se.args[0].v).items : null };
  };
  const privs = (cid ? fonts : [top]).map(privOf);
  // 글리프마다 쓰는 지역 서브루틴 묶음(CID 글꼴은 FDSelect가 정함)
  const fdOf = (g) => {
    if (!cid) return 0;
    if (fds[0] === 0) return fds[1 + g];
    for (let k = 0, nr = u16(fds, 1); k < nr; k++) { const q = 3 + k * 3; if (g >= u16(fds, q) && g < u16(fds, q + 3)) return fds[q + 2]; }
    return 0;
  };
  const gUsed = new Set(), lUsed = privs.map(() => new Set());
  let prune = true;
  for (const g of gids) if (g < n && prune) { const fd = fdOf(g); prune = markSubrs(cs.items[g], gsubrs.items, privs[fd]?.subrs, gUsed, lUsed[fd]); }
  const keepSubrs = (items, used) => (prune ? items.map((x, i) => (used.has(i) ? x : RET)) : items);
  const gsubrsNew = writeIndex(keepSubrs(gsubrs.items, gUsed));
  for (const [i, pv] of privs.entries()) {
    if (!pv) continue;
    pv.subrsBytes = pv.subrs ? writeIndex(keepSubrs(pv.subrs, lUsed[i])) : new Uint8Array(0);
    const body = (at) => writeDict(pv.pd.map((x) => (x.op === 19 ? { op: 19, args: [int5(at)] } : x)));
    const len = body(0).length;
    pv.dict = body(pv.subrs ? len : 0);
  }
  const END = Uint8Array.of(14);
  const csNew = writeIndex(cs.items.map((x, g) => (gids.has(g) ? x : END)));
  const topWith = (o) => writeDict(top.map((e) => (e.op in o ? { op: e.op, args: o[e.op] } : e)));
  const fontsWith = (offs) => writeIndex(fonts.map((d, i) => writeDict(d.map((e) => (e.op === 18 && privs[i] ? { op: 18, args: [int5(privs[i].dict.length), int5(offs[i])] } : e)))));
  // 자리 계산: 자리값을 모두 5바이트로 쓰므로 길이가 값과 무관
  const offsFor = (pos) => {
    const o = { 17: [int5(pos.cs)] };
    if (cset) o[15] = [int5(pos.cset)];
    if (enc) o[16] = [int5(pos.enc)];
    if (cid) { o[1237] = [int5(pos.fds)]; o[1236] = [int5(pos.fda)]; }
    else if (privs[0]) o[18] = [int5(privs[0].dict.length), int5(pos.priv[0])];
    return o;
  };
  const zero = { cs: 0, cset: 0, enc: 0, fds: 0, fda: 0, priv: privs.map(() => 0) };
  const topLen = writeIndex([topWith(offsFor(zero))]).length;
  const pos = { priv: [] }; let at = c[2] + (name.end - name.start) + topLen + (strs.end - strs.start) + gsubrsNew.length;
  if (cset) { pos.cset = at; at += cset.length; }
  if (enc) { pos.enc = at; at += enc.length; }
  if (fds) { pos.fds = at; at += fds.length; }
  pos.cs = at; at += csNew.length;
  if (cid) { pos.fda = at; at += fontsWith(privs.map(() => 0)).length; }
  for (const pv of privs) { pos.priv.push(at); if (pv) at += pv.dict.length + pv.subrsBytes.length; }
  const w = new W(at + 16);
  w.bytes(c.subarray(0, c[2])); w.bytes(c.subarray(name.start, name.end));
  w.bytes(writeIndex([topWith(offsFor(pos))]));
  w.bytes(c.subarray(strs.start, strs.end)); w.bytes(gsubrsNew);
  if (cset) w.bytes(cset);
  if (enc) w.bytes(enc);
  if (fds) w.bytes(fds);
  w.bytes(csNew);
  if (cid) w.bytes(fontsWith(pos.priv));
  for (const pv of privs) if (pv) { w.bytes(pv.dict); w.bytes(pv.subrsBytes); }
  return w.n === at ? w.out() : null;
}

/** gvar: 남기지 않는 글리프의 변형 자료를 비움 */
function subsetGvar(t, gids) {
  const axes = u16(t, 4), shared = u16(t, 6), sharedOff = u32(t, 8), gc = u16(t, 12), long = u16(t, 14) & 1, dataOff = u32(t, 16);
  const off = (i) => (long ? u32(t, 20 + i * 4) : u16(t, 20 + i * 2) * 2);
  const sh = t.subarray(sharedOff, sharedOff + axes * shared * 2);
  const w = new W(); const head = 20 + (gc + 1) * 4;
  w.bytes(t.subarray(0, 14)); w.u16(1); // 긴 오프셋
  const body = new W(); const offs = [];
  for (let g = 0; g < gc; g++) { offs.push(body.n); if (gids.has(g)) { body.bytes(t.subarray(dataOff + off(g), dataOff + off(g + 1))); body.pad(2); } }
  offs.push(body.n);
  w.u32(head + sh.length);
  for (const o of offs) w.u32(o);
  w.bytes(sh); w.bytes(body.out());
  const out = w.out(); out[8] = (head >>> 24) & 255; out[9] = (head >> 16) & 255; out[10] = (head >> 8) & 255; out[11] = head & 255;
  return out;
}

/** hmtx·vmtx: 비운 글리프의 여백 값을 0으로(압축이 잘 되게. 너비는 그대로) */
function zeroBearings(t, numLong, num, gids) {
  if (!t) return t;
  const o = t.slice();
  for (let g = 0; g < num; g++) {
    if (gids.has(g)) continue;
    const at = g < numLong ? g * 4 + 2 : numLong * 4 + (g - numLong) * 2;
    if (at + 1 < o.length) { o[at] = 0; o[at + 1] = 0; }
  }
  return o;
}

// ── 쓰기 ─────────────────────────────────────────────────────────────
function sum32(b) { let s = 0; const n = b.length; for (let i = 0; i < n; i += 4) s = (s + (((b[i] << 24) >>> 0) + ((b[i + 1] || 0) << 16) + ((b[i + 2] || 0) << 8) + (b[i + 3] || 0))) >>> 0; return s; }
function writeSfnt(flavor, tables) {
  const tags = [...tables.keys()].sort(), n = tags.length, es = Math.floor(Math.log2(n));
  const w = new W(); w.u32(flavor); w.u16(n); w.u16(2 ** es * 16); w.u16(es); w.u16(n * 16 - 2 ** es * 16);
  let off = 12 + n * 16; const at = {};
  for (const t of tags) { const d = tables.get(t); w.tag(t); w.u32(sum32(d)); w.u32(off); w.u32(d.length); at[t] = off; off += (d.length + 3) & ~3; }
  for (const t of tags) { w.bytes(tables.get(t)); w.pad(4); }
  const out = w.out();
  if (at.head !== undefined) { const adj = (0xb1b0afba - sum32(out)) >>> 0; out[at.head + 8] = adj >>> 24; out[at.head + 9] = (adj >> 16) & 255; out[at.head + 10] = (adj >> 8) & 255; out[at.head + 11] = adj & 255; }
  return out;
}
function writeWoff(flavor, sfnt) {
  const n = u16(sfnt, 4), w = new W(sfnt.length);
  const recs = []; for (let i = 0; i < n; i++) { const o = 12 + i * 16; recs.push({ tag: tag4(sfnt, o), sum: u32(sfnt, o + 4), data: sfnt.subarray(u32(sfnt, o + 8), u32(sfnt, o + 8) + u32(sfnt, o + 12)) }); }
  const packed = recs.map((r) => { const z = zlibSync(r.data, { level: 9 }); return z.length < r.data.length ? z : r.data; });
  let off = 44 + n * 20; const offs = [];
  for (const z of packed) { offs.push(off); off += (z.length + 3) & ~3; }
  w.tag('wOFF'); w.u32(flavor); w.u32(off); w.u16(n); w.u16(0); w.u32(sfnt.length); w.u16(1); w.u16(0); for (let i = 0; i < 5; i++) w.u32(0);
  recs.forEach((r, i) => { w.tag(r.tag); w.u32(offs[i]); w.u32(packed[i].length); w.u32(r.data.length); w.u32(r.sum); });
  for (const z of packed) { w.bytes(z); w.pad(4); }
  return w.out();
}
async function writeWoff2(flavor, sfnt) {
  const n = u16(sfnt, 4), dir = new W(), parts = [];
  for (let i = 0; i < n; i++) {
    const o = 12 + i * 16, tag = tag4(sfnt, o), len = u32(sfnt, o + 12), k = WOFF2_TAGS.indexOf(tag);
    const xf = tag === 'glyf' || tag === 'loca' ? 0xc0 : 0; // glyf·loca는 '변환 없음'(3)
    if (k >= 0) dir.u8(k | xf); else { dir.u8(63 | xf); dir.tag(tag); }
    let v = len; const bs = []; do { bs.unshift(v & 127); v = Math.floor(v / 128); } while (v);
    bs.forEach((x, j) => dir.u8(j < bs.length - 1 ? x | 128 : x));
    parts.push(sfnt.subarray(u32(sfnt, o + 8), u32(sfnt, o + 8) + len));
  }
  const all = new Uint8Array(parts.reduce((a, x) => a + x.length, 0)); let q = 0; for (const x of parts) { all.set(x, q); q += x.length; }
  const packed = await brotli(all); if (!packed) return null;
  const total = (48 + dir.n + packed.length + 3) & ~3;
  const w = new W(total);
  w.tag('wOF2'); w.u32(flavor); w.u32(total); w.u16(n); w.u16(0); w.u32(sfnt.length); w.u32(packed.length); w.u16(1); w.u16(0); for (let i = 0; i < 5; i++) w.u32(0);
  w.bytes(dir.out()); w.bytes(packed); w.pad(4);
  return w.out();
}

const DROP = new Set(['DSIG', 'FFTM', 'hdmx', 'LTSH', 'VDMX', 'PCLT']);

/**
 * 글꼴을 keep 글자만 남긴 같은 글꼴로.
 * @param bytes 글꼴 파일(woff2·woff·ttf·otf)
 * @param keep Set<글자 번호> 남길 글자
 * @param o.range [[시작, 끝]...] 이 글꼴 조각이 맡는 글자(unicode-range). 없으면 전부
 * @returns {Promise<null | { data, format: 'woff2'|'woff', kept: number[], cover: number[] }>} kept: 남긴 글자, cover: 이 파일이 가진 글자(range 안)
 */
export async function subsetFont(bytes, keep, o = {}) {
  const font = await readFont(bytes);
  if (!font) return null;
  const T = new Map(font.tables);
  for (const x of ['CFF2', 'COLR', 'SVG ', 'sbix', 'CBDT', 'EBDT']) if (T.has(x)) return null; // 색·비트맵·가변 CFF는 그대로 둠
  const tt = T.has('glyf') && T.has('loca'), cff = T.has('CFF ');
  if (!(tt || cff) || !T.has('maxp') || !T.has('head') || !T.has('cmap')) return null;
  const num = u16(T.get('maxp'), 4), cmap = readCmap(T.get('cmap'));
  const inRange = (c) => !o.range?.length || o.range.some(([a, b]) => c >= a && c <= b);
  const cover = [...cmap.keys()].filter(inRange).sort((a, b) => a - b);
  const kept = cover.filter((c) => keep.has(c));
  const gids = new Set([0]);
  for (const c of kept) gids.add(cmap.get(c));
  gsubClosure(T.get('GSUB'), gids, num);
  if (tt) {
    const head = T.get('head'), offs = readLoca(T.get('loca'), i16(head, 50) === 1, num), glyf = T.get('glyf');
    glyfClosure(glyf, offs, gids);
    const w = new W(), loca = new Uint32Array(num + 1);
    for (let g = 0; g < num; g++) { loca[g] = w.n; if (gids.has(g)) { w.bytes(glyf.subarray(offs[g], offs[g + 1])); w.pad(4); } }
    loca[num] = w.n;
    const long = w.n >= 0x20000, lw = new W((num + 1) * 4);
    for (const v of loca) if (long) lw.u32(v); else lw.u16(v >> 1);
    T.set('glyf', w.out()); T.set('loca', lw.out());
    const h = head.slice(); h[50] = 0; h[51] = long ? 1 : 0; T.set('head', h);
  } else {
    const c = subsetCff(T.get('CFF '), gids);
    if (!c) return null;
    T.set('CFF ', c);
  }
  if (T.has('gvar')) T.set('gvar', subsetGvar(T.get('gvar'), gids));
  if (T.has('hhea') && T.has('hmtx')) T.set('hmtx', zeroBearings(T.get('hmtx'), u16(T.get('hhea'), 34), num, gids));
  if (T.has('vhea') && T.has('vmtx')) T.set('vmtx', zeroBearings(T.get('vmtx'), u16(T.get('vhea'), 34), num, gids));
  const map = new Map(); for (const c of kept) map.set(c, cmap.get(c));
  const cm = writeCmap(map); if (!cm) return null;
  T.set('cmap', cm);
  if (T.has('post')) { const p = new Uint8Array(32); p.set(T.get('post').subarray(0, 32)); p[0] = 0; p[1] = 3; p[2] = 0; p[3] = 0; T.set('post', p); }
  const h = T.get('head').slice(); h[8] = h[9] = h[10] = h[11] = 0; T.set('head', h);
  for (const x of DROP) T.delete(x);
  const sfnt = writeSfnt(font.flavor === 0x4f54544f ? 0x4f54544f : 0x00010000, T);
  const w2 = await writeWoff2(u32(sfnt, 0), sfnt);
  return w2 ? { data: w2, format: 'woff2', kept, cover } : { data: writeWoff(u32(sfnt, 0), sfnt), format: 'woff', kept, cover };
}

/** 글자 번호 목록 → unicode-range 값. gap: 이만큼 떨어진 글자까지는 한 범위로 묶음(넉넉한 범위) */
export function unicodeRange(cps, gap = 1) {
  const s = [...cps].sort((a, b) => a - b), out = [];
  for (const c of s) { const r = out[out.length - 1]; if (r && c - r[1] <= gap) r[1] = c; else out.push([c, c]); }
  return out.map(([a, b]) => `U+${a.toString(16)}${b > a ? '-' + b.toString(16) : ''}`).join(',');
}
