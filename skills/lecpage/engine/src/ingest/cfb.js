// OLE 복합 문서(Compound File Binary, [MS-CFB]) 읽기. 예전 한글 파일(.hwp, HWP 5.0)이 이 그릇에 들어 있어요.
// 읽기만 하고, 망가진 파일·이상한 값에 안전하도록 모든 길이·사슬(FAT chain)을 검사합니다.
//   - 섹터 사슬은 한 번 지난 섹터를 다시 만나면 멈춤(무한 루프 방지)
//   - 디렉터리 항목 수·스트림 크기·읽은 바이트 합계 상한(limits.maxEntries·maxEntryBytes·maxUncompressed)
//   - 디렉터리 나무(왼쪽·오른쪽 형제, 자식)도 한 번 본 항목은 다시 보지 않음
import { IngestError, DEFAULT_LIMITS } from './util.js';

const END = 0xFFFFFFFE;
const MAX_REG = 0xFFFFFFFA; // 이보다 크면 특수 값(FREE·END·FATSECT·DIFSECT)
const NOSTREAM = 0xFFFFFFFF;

const corrupt = (detail) => new IngestError('corrupt', { detail: 'CFB: ' + detail });

export class Cfb {
  /**
   * @param {Uint8Array} bytes
   * @param {object} limits DEFAULT_LIMITS와 같은 모양
   */
  constructor(bytes, limits = {}) {
    this.bytes = bytes;
    this.limits = { ...DEFAULT_LIMITS, ...limits };
    this.read = 0;
    if (bytes.length < 512) throw corrupt('header too short');
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.dv = dv;
    if (dv.getUint32(0, true) !== 0xE011CFD0 || dv.getUint32(4, true) !== 0xE11AB1A1) throw corrupt('signature');
    if (dv.getUint16(28, true) !== 0xFFFE) throw corrupt('byte order');
    const shift = dv.getUint16(30, true);
    if (shift !== 9 && shift !== 12) throw corrupt('sector size');
    if (dv.getUint16(32, true) !== 6) throw corrupt('mini sector size');
    this.shift = shift;
    this.ss = 1 << shift;
    this.nSectors = Math.max(0, Math.ceil((bytes.length - this.ss) / this.ss));
    const nFat = dv.getUint32(44, true);
    const dirStart = dv.getUint32(48, true);
    this.miniCutoff = dv.getUint32(56, true) || 4096;
    const miniFatStart = dv.getUint32(60, true);
    const nMiniFat = dv.getUint32(64, true);
    const difatStart = dv.getUint32(68, true);
    const nDifat = dv.getUint32(72, true);
    if (nFat > this.nSectors + 1 || nMiniFat > this.nSectors + 1 || nDifat > this.nSectors + 1) throw corrupt('sector counts');

    // 1) FAT 섹터 목록(DIFAT): 머리의 109개 + DIFAT 사슬
    const fatSectors = [];
    for (let i = 0; i < 109 && fatSectors.length < nFat; i++) {
      const s = dv.getUint32(76 + i * 4, true);
      if (s <= MAX_REG) fatSectors.push(s);
    }
    const per = this.ss / 4 - 1;
    const seenDif = new Set();
    let ds = difatStart, n = 0;
    while (ds <= MAX_REG && fatSectors.length < nFat && n < nDifat) {
      if (seenDif.has(ds) || ds >= this.nSectors) break;
      seenDif.add(ds); n++;
      const off = this.offset(ds);
      for (let i = 0; i < per && fatSectors.length < nFat; i++) {
        const s = this.u32(off + i * 4);
        if (s <= MAX_REG) fatSectors.push(s);
      }
      ds = this.u32(off + per * 4);
    }
    // 2) FAT
    const ePer = this.ss / 4;
    const fat = new Uint32Array(fatSectors.length * ePer).fill(NOSTREAM);
    fatSectors.forEach((s, k) => {
      if (s >= this.nSectors) return;
      const off = this.offset(s);
      for (let i = 0; i < ePer; i++) { const p = off + i * 4; if (p + 4 <= bytes.length) fat[k * ePer + i] = dv.getUint32(p, true); }
    });
    this.fat = fat;

    // 3) 디렉터리
    const dirSecs = this.chain(dirStart, fat, this.nSectors);
    if (!dirSecs.length) throw corrupt('no directory');
    const entries = [];
    const perSec = this.ss / 128;
    const maxEntries = Math.min(this.limits.maxEntries * 4, dirSecs.length * perSec);
    for (const s of dirSecs) {
      const base = this.offset(s);
      for (let i = 0; i < perSec && entries.length < maxEntries; i++) {
        const o = base + i * 128;
        if (o + 128 > bytes.length) break;
        entries.push(this.readEntry(o));
      }
    }
    if (!entries.length || entries[0].type !== 5) throw corrupt('no root entry');
    this.entries = entries;
    this.root = entries[0];

    // 4) 이름 → 항목(경로는 "BodyText/Section0"처럼 /로 이음)
    this.paths = new Map();
    this.lower = new Map();
    const seen = new Uint8Array(entries.length);
    seen[0] = 1;
    const walk = (childId, prefix, depth) => {
      if (depth > 32) return;
      const stack = [childId];
      while (stack.length) {
        const id = stack.pop();
        if (id === NOSTREAM || id >= entries.length || seen[id]) continue;
        seen[id] = 1;
        const e = entries[id];
        if (e.type !== 1 && e.type !== 2) continue;
        stack.push(e.left, e.right);
        const path = prefix ? prefix + '/' + e.name : e.name;
        if (this.paths.size >= this.limits.maxEntries) throw new IngestError('zip-bomb', { detail: `CFB entries>${this.limits.maxEntries}` });
        this.paths.set(path, e);
        if (!this.lower.has(path.toLowerCase())) this.lower.set(path.toLowerCase(), path);
        if (e.type === 1) walk(e.child, path, depth + 1);
      }
    };
    walk(this.root.child, '', 0);

    // 5) 작은 스트림(mini stream)용 표는 필요할 때 읽음
    this._miniFatStart = miniFatStart;
    this._miniFat = null;
    this._ministream = null;
  }

  offset(sid) { return (sid + 1) * this.ss; }
  u32(o) { return o + 4 <= this.bytes.length ? this.dv.getUint32(o, true) : END; }

  readEntry(o) {
    const dv = this.dv;
    // 이름 길이는 끝의 0을 포함한 바이트 수(최대 64 = 31글자 + 0)
    const chars = Math.max(0, Math.min(31, (dv.getUint16(o + 64, true) >> 1) - 1));
    let name = '';
    for (let i = 0; i < chars; i++) {
      const c = dv.getUint16(o + i * 2, true);
      if (!c) break;
      name += String.fromCharCode(c);
    }
    const lo = dv.getUint32(o + 120, true), hi = dv.getUint32(o + 124, true);
    // 버전 3 파일은 윗자리에 쓰레기 값이 있을 수 있어 512바이트 섹터면 아랫자리만 씀
    const size = this.ss === 512 ? lo : hi ? Number.MAX_SAFE_INTEGER : lo;
    return {
      name, type: dv.getUint8(o + 66),
      left: dv.getUint32(o + 68, true), right: dv.getUint32(o + 72, true), child: dv.getUint32(o + 76, true),
      start: dv.getUint32(o + 116, true), size,
    };
  }

  /** 섹터 사슬 → 섹터 번호 목록(되돌아오는 사슬·범위 밖 번호에서 멈춤) */
  chain(start, table, limit) {
    const out = [];
    const seen = new Set();
    let s = start;
    while (s <= MAX_REG && out.length < limit) {
      if (s >= table.length || seen.has(s)) break;
      seen.add(s);
      out.push(s);
      s = table[s];
    }
    return out;
  }

  has(path) { return !!this.entry(path); }
  entry(path) {
    const e = this.paths.get(path);
    if (e) return e;
    const k = this.lower.get(String(path).toLowerCase());
    return k ? this.paths.get(k) : null;
  }
  /** 경로 목록(스트림만, 또는 prefix로 시작하는 것) */
  names(prefix = '') {
    const out = [];
    for (const [p, e] of this.paths) if (e.type === 2 && p.startsWith(prefix)) out.push(p);
    return out;
  }

  /** 스트림 하나 → Uint8Array | null. 선언 크기가 상한을 넘으면 zip-bomb 오류 */
  get(path) {
    const e = this.entry(path);
    if (!e || e.type !== 2) return null;
    if (e.size > this.limits.maxEntryBytes) throw new IngestError('zip-bomb', { detail: `CFB stream ${path} too large` });
    if (!e.size) return new Uint8Array(0);
    this.read += e.size;
    if (this.read > this.limits.maxUncompressed) throw new IngestError('zip-bomb', { detail: `CFB total>${this.limits.maxUncompressed}` });
    if (e.size < this.miniCutoff) return this.readMini(e.start, e.size);
    return this.readChain(e.start, e.size, this.fat, this.ss, (sid) => this.offset(sid), this.bytes);
  }

  readChain(start, size, table, unit, offsetOf, src) {
    const secs = this.chain(start, table, Math.ceil(size / unit));
    const out = new Uint8Array(Math.min(size, secs.length * unit));
    let pos = 0;
    for (const s of secs) {
      if (pos >= out.length) break;
      const off = offsetOf(s);
      if (off >= src.length) break;
      const n = Math.min(unit, out.length - pos, src.length - off);
      out.set(src.subarray(off, off + n), pos);
      pos += n;
    }
    return pos === out.length ? out : out.subarray(0, pos);
  }

  readMini(start, size) {
    if (!this._miniFat) {
      const secs = this.chain(this._miniFatStart, this.fat, this.nSectors);
      const ePer = this.ss / 4;
      const mf = new Uint32Array(secs.length * ePer).fill(NOSTREAM);
      secs.forEach((s, k) => { const off = this.offset(s); for (let i = 0; i < ePer; i++) mf[k * ePer + i] = this.u32(off + i * 4); });
      this._miniFat = mf;
      const rootSize = Math.min(this.root.size, this.nSectors * this.ss);
      this._ministream = this.readChain(this.root.start, rootSize, this.fat, this.ss, (sid) => this.offset(sid), this.bytes);
    }
    return this.readChain(start, size, this._miniFat, 64, (sid) => sid * 64, this._ministream);
  }
}
