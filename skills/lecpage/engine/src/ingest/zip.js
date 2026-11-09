// 안전한 ZIP 읽기(PPTX·DOCX·HWPX는 모두 ZIP). 압축 폭탄 방지: 선언된 압축 해제 크기 합계·개수·파일 하나 크기를 검사합니다.
// fflate는 선언 크기만큼만 버퍼를 잡으므로(넘치는 부분은 잘림) 선언 크기 검사가 실제 메모리 상한이 됩니다.
import { unzipSync } from '../../vendor/fflate.js';
import { IngestError, DEFAULT_LIMITS, decodeText, joinPath, dirOf, baseName } from './util.js';
import { parseXml, kids, attr } from './xml.js';

export class Zip {
  constructor(bytes, limits = {}) {
    this.bytes = bytes;
    this.limits = { ...DEFAULT_LIMITS, ...limits };
    this.entries = new Map(); // name -> { size, originalSize }
    this.cache = new Map();
    this.xmlCache = new Map();
    this.read = 0;
    let total = 0, count = 0;
    try {
      unzipSync(bytes, {
        filter: (f) => {
          count++;
          if (count > this.limits.maxEntries) throw new IngestError('zip-bomb', { detail: `entries>${this.limits.maxEntries}` });
          const size = f.originalSize || 0;
          total += size;
          if (total > this.limits.maxUncompressed) throw new IngestError('zip-bomb', { detail: `total>${this.limits.maxUncompressed}` });
          this.entries.set(normName(f.name), { name: f.name, size: f.size, originalSize: size, compression: f.compression });
          return false;
        },
      });
    } catch (e) {
      if (e instanceof IngestError) throw e;
      throw new IngestError('corrupt', { detail: e && e.message });
    }
    this.total = total;
  }

  has(name) { return this.entries.has(normName(name)); }
  names() { return [...this.entries.keys()]; }
  size(name) { const e = this.entries.get(normName(name)); return e ? e.originalSize : 0; }

  /** 여러 파일을 한 번에 풀어 캐시(작은 XML 묶음용) */
  preload(pred) {
    const want = new Set();
    for (const [k, e] of this.entries) {
      if (this.cache.has(k) || !pred(k)) continue;
      if (e.originalSize > this.limits.maxEntryBytes) continue;
      want.add(e.name);
    }
    if (!want.size) return;
    let out;
    try { out = unzipSync(this.bytes, { filter: (f) => want.has(f.name) }); } catch (e) { throw new IngestError('corrupt', { detail: e && e.message }); }
    for (const k in out) this.cache.set(normName(k), out[k]);
  }

  /** 파일 하나 → Uint8Array | null */
  get(name) {
    const key = normName(name);
    if (this.cache.has(key)) return this.cache.get(key);
    const e = this.entries.get(key);
    if (!e) return null;
    if (e.originalSize > this.limits.maxEntryBytes) throw new IngestError('zip-bomb', { detail: `entry ${key} too large` });
    let out;
    try { out = unzipSync(this.bytes, { filter: (f) => f.name === e.name }); } catch (err) { throw new IngestError('corrupt', { detail: err && err.message }); }
    const data = out[e.name] || null;
    this.cache.set(key, data);
    return data;
  }

  text(name) {
    const b = this.get(name);
    return b ? decodeText(b, { fallbackKorean: false }) : null;
  }

  /** XML 파일 → 뿌리 노드 | null (캐시) */
  xml(name) {
    const key = normName(name);
    if (this.xmlCache.has(key)) return this.xmlCache.get(key);
    if (this.size(key) > this.limits.maxXmlBytes) throw new IngestError('zip-bomb', { detail: `xml ${key} too large` });
    const t = this.text(key);
    const doc = t === null ? null : parseXml(t);
    this.xmlCache.set(key, doc);
    return doc;
  }

  /** OOXML 관계(.rels): Map(id → {type, target, external}) */
  rels(partPath) {
    const relsPath = joinPath(dirOf(partPath), `_rels/${baseName(partPath)}.rels`);
    const map = new Map();
    const doc = this.xml(relsPath);
    if (!doc) return map;
    const root = kids(doc, 'Relationships')[0] || doc;
    for (const r of kids(root, 'Relationship')) {
      const id = attr(r, 'Id');
      const target = attr(r, 'Target') || '';
      const typeUrl = attr(r, 'Type') || '';
      const external = (attr(r, 'TargetMode') || '').toLowerCase() === 'external';
      map.set(id, {
        id, type: typeUrl.split('/').pop(), typeUrl,
        target: external ? target : joinPath(dirOf(partPath), safeDecode(target)),
        external,
      });
    }
    return map;
  }
}

function normName(n) { return String(n || '').replace(/\\/g, '/').replace(/^\/+/, ''); }
function safeDecode(s) { try { return decodeURIComponent(s); } catch { return s; } }

export function relOfType(rels, type) {
  for (const r of rels.values()) if (r.type === type) return r;
  return null;
}
