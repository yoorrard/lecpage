// 예전 한글 파일(.hwp, HWP 5.0: 한글 2002 이후 기본 형식) 해석.
// 근거: 한글과컴퓨터가 공개한 「한글 문서 파일 형식 5.0」(revision 1.3). 외부 라이브러리 없이 필요한 만큼만 읽습니다.
//
//   OLE 복합 문서(cfb.js) → FileHeader(서명·버전·속성: 압축·암호·배포용·DRM)
//   → DocInfo(글꼴 이름·글자 모양·문단 모양·스타일·그림 목록)
//   → BodyText/Section0..N(압축이면 raw deflate) → 레코드(문단 머리·글자·글자 모양·컨트롤 머리·문단 목록 머리·표)
//   → hwpx.js와 같은 블록 → blocksToPages. 같은 교재를 HWPX로 저장한 것과 같은 모양의 Material이 나옵니다.
//
// 안전: 압축 해제는 조금씩 풀며 크기 상한(maxXmlBytes)을 넘으면 멈추고, 레코드 수·나무 깊이·구역 수에 상한을 둡니다.
import { Inflate } from '../../vendor/fflate.js';
import { IngestError, normText, normLine, mimeOf, WEB_IMAGE, cleanUrl } from './util.js';
import { blocksToPages } from './blocks.js';
import { FontRoles } from './fonts.js';

// 레코드 태그(HWPTAG_BEGIN = 0x10 기준)
const T = {
  DOC_PROPS: 16, ID_MAPPINGS: 17, BIN_DATA: 18, FACE_NAME: 19, CHAR_SHAPE: 21, PARA_SHAPE: 25, STYLE: 26,
  PARA_HEADER: 66, PARA_TEXT: 67, PARA_CHAR_SHAPE: 68, CTRL_HEADER: 71, LIST_HEADER: 72,
  SHAPE_COMPONENT: 76, TABLE: 77, SC_PICTURE: 85,
};
// 문단 글자 안의 제어 문자: 한 칸짜리(char)와 여덟 칸짜리(inline·extended)
const INLINE = new Set([4, 5, 6, 7, 8, 9, 19, 20]);
const EXTENDED = new Set([1, 2, 3, 11, 12, 14, 15, 16, 17, 18, 21, 22, 23]);
const HEAD = ['NONE', 'OUTLINE', 'NUMBER', 'BULLET'];

export const HWP_LIMITS = Object.freeze({
  maxRecords: 800_000,   // 문서 전체 레코드 수(1000쪽 문서도 수십만 개)
  maxDepth: 64,          // 레코드 나무 깊이(표 속 표…)
  maxSections: 512,      // 구역 수
});

const u16 = (d, o) => (o + 2 <= d.length ? d[o] | (d[o + 1] << 8) : 0);
const u32 = (d, o) => (o + 4 <= d.length ? (d[o] | (d[o + 1] << 8) | (d[o + 2] << 16) | (d[o + 3] << 24)) >>> 0 : 0);
const i32 = (d, o) => u32(d, o) | 0;
const chid = (d) => String.fromCharCode(d[3] || 0, d[2] || 0, d[1] || 0, d[0] || 0); // 'tbl ', 'gso ', '%hlk'…

/** UTF-16LE 조각 → 글자 */
const U16 = new TextDecoder('utf-16le');
function wstr(d, o, n) {
  const end = Math.min(d.length, o + n * 2);
  if (end - o >= 64) return U16.decode(d.subarray(o, end - ((end - o) & 1)));
  let s = '';
  for (let i = o; i + 1 < end; i += 2) s += String.fromCharCode(d[i] | (d[i + 1] << 8));
  return s;
}
/** WORD 길이 + WCHAR[길이] → { s, next } */
function bstr(d, o) {
  const n = u16(d, o);
  if (o + 2 + n * 2 > d.length) return { s: '', next: d.length };
  return { s: wstr(d, o + 2, n), next: o + 2 + n * 2 };
}

/** 이 CFB가 HWP 5.0 문서인지(FileHeader 서명) */
export function isHwp(cfb) {
  const e = cfb.entry('FileHeader');
  if (!e || e.type !== 2 || e.size < 32) return false;
  const fh = cfb.get('FileHeader');
  return !!fh && String.fromCharCode(...fh.subarray(0, 17)) === 'HWP Document File';
}

/** FileHeader → { version:[a,b,c,d], compressed, encrypted, distribution, drm } */
export function readFileHeader(fh) {
  if (!fh || fh.length < 40) throw new IngestError('corrupt', { detail: 'HWP FileHeader too short' });
  const v = u32(fh, 32), p = u32(fh, 36);
  return {
    version: [v >>> 24, (v >> 16) & 255, (v >> 8) & 255, v & 255],
    compressed: !!(p & 1),
    encrypted: !!(p & 2) || !!(p & 0x100),       // 문서 암호 · 공인 인증서 암호화
    distribution: !!(p & 4),                       // 배포용 문서(ViewText에 암호화된 본문)
    drm: !!(p & 0x10) || !!(p & 0x400),            // DRM 보안 문서 · 공인 인증서 DRM
  };
}

/** raw deflate 풀기. 크기 상한을 넘으면 zip-bomb, 망가진 데이터면 그때까지 푼 것(없으면 corrupt) */
export function inflateLimited(data, max, what = 'stream') {
  if (!data.length) return new Uint8Array(0);
  const parts = [];
  let total = 0;
  const inf = new Inflate((chunk) => {
    total += chunk.length;
    if (total > max) throw new IngestError('zip-bomb', { detail: `HWP ${what} > ${max}` });
    parts.push(chunk);
  });
  const STEP = 8192; // 조금씩 넣어 한 번에 커지는 크기를 제한(deflate 최대 비율 약 1032배 → 8MB)
  try {
    for (let i = 0; i < data.length; i += STEP) inf.push(data.subarray(i, Math.min(data.length, i + STEP)), i + STEP >= data.length);
  } catch (e) {
    if (e instanceof IngestError) throw e;
    if (!total) throw new IngestError('corrupt', { detail: `HWP ${what}: ${e && e.message}` });
  }
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

/** 레코드 머리(태그 10비트·수준 10비트·크기 12비트, 0xFFF면 다음 4바이트) → [{tag, level, data}] */
export function readRecords(data, budget) {
  const out = [];
  let off = 0;
  const n = data.length;
  while (off + 4 <= n) {
    const h = u32(data, off);
    off += 4;
    let size = h >>> 20;
    if (size === 0xFFF) { if (off + 4 > n) break; size = u32(data, off); off += 4; }
    if (size > n - off) break; // 잘린 레코드: 여기까지만
    out.push({ tag: h & 0x3FF, level: (h >>> 10) & 0x3FF, data: data.subarray(off, off + size), children: [] });
    off += size;
    if (++budget.records > budget.max) throw new IngestError('zip-bomb', { detail: `HWP records>${budget.max}` });
  }
  return out;
}

/** 수준(level)으로 나무 만들기. 깊이 상한을 넘으면 더 깊이 들어가지 않고 마지막 부모에 붙임 */
export function buildTree(recs, maxDepth = HWP_LIMITS.maxDepth) {
  const root = { tag: -1, level: -1, data: new Uint8Array(0), children: [] };
  const stack = [root];
  for (const r of recs) {
    while (stack.length > 1 && stack[stack.length - 1].level >= r.level) stack.pop();
    stack[stack.length - 1].children.push(r);
    if (stack.length < maxDepth) stack.push(r);
  }
  return root;
}

// ── DocInfo ─────────────────────────────────────────
function readDocInfo(recs) {
  const fonts = [[], [], [], [], [], [], []]; // 한글·영어·한자·일어·기타·기호·사용자
  const faces = [];
  let counts = null;
  const charShapes = [], paraShapes = [], styles = [], binData = [];
  for (const r of recs) {
    const d = r.data;
    switch (r.tag) {
      case T.ID_MAPPINGS: counts = Array.from({ length: Math.min(18, d.length >> 2) }, (_, i) => i32(d, i * 4)); break;
      case T.FACE_NAME: faces.push(bstr(d, 1).s); break;
      case T.CHAR_SHAPE: {
        const ids = Array.from({ length: 7 }, (_, i) => u16(d, i * 2));
        charShapes.push({ ids, height: i32(d, 42), bold: !!(u32(d, 46) & 2) });
        break;
      }
      case T.PARA_SHAPE: {
        const p = u32(d, 0);
        paraShapes.push({ type: HEAD[(p >>> 23) & 3], level: (p >>> 25) & 7 });
        break;
      }
      case T.STYLE: {
        const a = bstr(d, 0), b = bstr(d, a.next);
        styles.push({ name: a.s, eng: b.s, paraShape: u16(d, b.next + 4) });
        break;
      }
      case T.BIN_DATA: {
        const p = u16(d, 0);
        const type = p & 0xF;
        const item = { type, compress: (p >> 4) & 3, id: 0, ext: '' };
        if (type === 1 || type === 2) { item.id = u16(d, 2); if (type === 1) item.ext = bstr(d, 4).s.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8); }
        binData.push(item);
        break;
      }
      default: break;
    }
  }
  // 글꼴 이름은 언어별로 차례대로 저장돼 있음(ID_MAPPINGS의 언어별 개수)
  let k = 0;
  for (let lang = 0; lang < 7; lang++) {
    const n = counts ? Math.max(0, counts[lang + 1] || 0) : (lang === 0 ? faces.length : 0);
    for (let i = 0; i < n && k < faces.length; i++) fonts[lang].push(faces[k++]);
  }
  for (const cs of charShapes) { cs.font = fonts[0][cs.ids[0]] || ''; cs.latin = fonts[1][cs.ids[1]] || ''; }
  return { fonts, charShapes, paraShapes, styles, binData };
}

// ── 요약 정보(\005HwpSummaryInformation, OLE 속성 집합) ─────────
const PID = { 2: 'title', 3: 'subject', 4: 'author', 8: 'modifiedBy', 12: 'created', 13: 'modified' };
export function readSummary(d) {
  const meta = {};
  if (!d || d.length < 48 || u16(d, 0) !== 0xFFFE) return meta;
  const sec = u32(d, 44);
  if (sec + 8 > d.length) return meta;
  const count = Math.min(u32(d, sec + 4), 256);
  for (let i = 0; i < count; i++) {
    const pid = u32(d, sec + 8 + i * 8), off = sec + u32(d, sec + 12 + i * 8);
    const key = PID[pid];
    if (!key || off + 8 > d.length) continue;
    const vt = u32(d, off) & 0xFFFF;
    let v = '';
    if (vt === 31) v = wstr(d, off + 8, Math.min(u32(d, off + 4), 4096)).replace(/\0.*$/s, ''); // VT_LPWSTR
    else if (vt === 30) { const n = Math.min(u32(d, off + 4), 8192); v = new TextDecoder('utf-8').decode(d.subarray(off + 8, Math.min(d.length, off + 8 + n))).replace(/\0.*$/s, ''); }
    else if (vt === 64) { // VT_FILETIME(1601년부터 100ns)
      const ms = (u32(d, off + 8) + u32(d, off + 12) * 4294967296) / 10000 - 11644473600000;
      if (ms > 0 && ms < 4102444800000) v = new Date(ms).toISOString().replace(/\.\d+Z$/, 'Z');
    }
    v = normLine(v);
    if (v) meta[key] = v;
  }
  return meta;
}

// ── 본문 ────────────────────────────────────────────
export function parseHwp(cfb, ctx) {
  const fh = readFileHeader(cfb.get('FileHeader'));
  if (fh.version[0] < 5) throw new IngestError('legacy-hwp');
  if (fh.encrypted) throw new IngestError('encrypted');
  if (fh.drm) throw new IngestError('drm');
  if (fh.distribution) throw new IngestError('hwp-distribution');
  const lim = ctx.limits;
  const budget = { records: 0, max: lim.maxHwpRecords || HWP_LIMITS.maxRecords };
  let inflated = 0;
  const stream = (path, compressed = fh.compressed, max = lim.maxXmlBytes) => {
    const raw = cfb.get(path);
    if (!raw) return null;
    if (!compressed) return raw;
    const out = inflateLimited(raw, max, path);
    inflated += out.length;
    if (inflated > lim.maxUncompressed) throw new IngestError('zip-bomb', { detail: `HWP total>${lim.maxUncompressed}` });
    return out;
  };

  const docInfoBytes = stream('DocInfo');
  if (!docInfoBytes) throw new IngestError('corrupt', { detail: 'HWP DocInfo 없음' });
  const info = readDocInfo(readRecords(docInfoBytes, budget));
  const sections = cfb.names('BodyText/').filter((n) => /^BodyText\/Section\d+$/i.test(n))
    .sort((a, b) => +a.match(/(\d+)$/)[1] - +b.match(/(\d+)$/)[1]);
  if (!sections.length && cfb.names('ViewText/').length) throw new IngestError('hwp-distribution');
  if (sections.length > HWP_LIMITS.maxSections) sections.length = HWP_LIMITS.maxSections;

  const c = { ...ctx, cfb, info, fh, imgSeq: 0, unsupportedExt: new Set(), fontUse: new Map(), fontRoles: new FontRoles(), counters: [] };
  const blocks = [];
  sections.forEach((sp, si) => {
    const data = stream(sp);
    if (!data) return;
    const tree = buildTree(readRecords(data, budget));
    const before = blocks.length;
    for (const p of tree.children) if (p.tag === T.PARA_HEADER) readPara(p, c, blocks, false, 0);
    if (si > 0 && blocks.length > before) blocks[before].pageBreakBefore = true;
  });

  let pages = blocksToPages(blocks, { fileId: ctx.fileId, unit: 'section', maxPages: lim.maxPages });
  // 본문을 못 읽었으면 미리보기 글(PrvText, UTF-16)이라도
  if (!pages.length && cfb.has('PrvText')) {
    const pv = cfb.get('PrvText');
    const raw = pv ? new TextDecoder('utf-16le').decode(pv) : '';
    // 미리보기 글은 표 칸을 <…><…>로 감쌈. 글자가 없는 줄(빈 칸만 있는 표)은 뺌
    const list = raw.split(/\r?\n/).map((t) => normText(t.replace(/^<|>$/g, '').replace(/></g, ' | ')))
      .filter((t) => /[\p{L}\p{N}]/u.test(t)).map((text) => ({ type: 'p', text, level: 0, heading: null, links: [], images: [] }));
    pages = blocksToPages(list, { fileId: ctx.fileId, unit: 'section', maxPages: lim.maxPages });
    if (pages.length) ctx.warn('parse-failed', { detail: 'HWP 본문 대신 미리보기 글을 읽음' });
  }
  if (c.unsupportedExt.size) ctx.warn('images-unsupported', { exts: [...c.unsupportedExt].join(', ') });
  if (ctx.opts.withImages) {
    for (const p of pages) for (const im of p.images) {
      try {
        const b = stream(im.path, im._compressed, lim.maxEntryBytes);
        if (b) { im.bytes = b; im.size = b.length; }
      } catch (e) { if (e instanceof IngestError && e.code === 'zip-bomb') throw e; /* 그림 하나는 건너뜀 */ }
    }
  }
  for (const p of pages) for (const im of p.images) delete im._compressed;

  const meta = readSummary(cfb.get('\u0005HwpSummaryInformation'));
  const fontsUsed = [...c.fontUse.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, count]) => ({ name, count }));
  const hang = info.fonts[0][0] || '', latin = info.fonts[1][0] || '';
  const design = {
    theme: '', colors: {},
    fonts: { major: { latin, ea: hang }, minor: { latin, ea: hang } },
    fontsUsed, palette: [], fontRoles: c.fontRoles.result(),
  };
  return { pages, design, meta, unit: 'section' };
}

function headingOf(styleId, shapeId, c) {
  const st = c.info.styles[styleId];
  const name = `${st?.name || ''} ${st?.eng || ''}`;
  const m = /개요\s*(\d)|Outline\s*(\d)|Heading\s*(\d)|제목\s*(\d)/i.exec(name);
  if (m) return { heading: +(m[1] || m[2] || m[3] || m[4]) };
  if (/^\s*(제목|Title)\s*$/i.test(st?.name || '')) return { heading: 0 };
  const pp = c.info.paraShapes[shapeId] || (st ? c.info.paraShapes[st.paraShape] : null);
  if (pp?.type === 'OUTLINE') return { heading: pp.level + 1 };
  if (pp?.type === 'NUMBER') return { numbered: true, level: pp.level };
  if (pp?.type === 'BULLET') return { bullet: true, level: pp.level };
  return {};
}

/** 문단(PARA_HEADER와 그 아래 레코드) 하나 → 블록(들). hwpx.js readPara와 같은 규칙 */
function readPara(p, c, out, inCell, depth) {
  const d = p.data;
  let textRec = null, csRec = null;
  const ctrls = [];
  for (const k of p.children) {
    if (k.tag === T.PARA_TEXT) textRec = textRec || k;
    else if (k.tag === T.PARA_CHAR_SHAPE) csRec = csRec || k;
    else if (k.tag === T.CTRL_HEADER) ctrls.push(k);
  }
  const st = { text: '', links: [], images: [], tables: [], extra: [], field: null, chars: 0, bold: 0, maxH: 0, runs: [] };
  readText(textRec ? textRec.data : null, csRec ? csRec.data : null, ctrls, c, st, inCell, depth);
  const text = normText(st.text);
  const h = headingOf(d[10] || 0, u16(d, 8), c);
  const display = h.heading != null || (st.maxH >= 1600 && text.length <= 60);
  for (const r of st.runs) c.fontRoles.add(display ? 'display' : 'body', r.font, r.n);
  const block = {
    type: 'p', text, level: h.level || 0, bullet: !!h.bullet, num: 0,
    heading: h.heading ?? null, links: st.links, images: st.images,
    bold: st.chars > 0 && st.bold >= st.chars * 0.9, sz: st.maxH,
  };
  if (h.numbered) {
    const lv = h.level || 0;
    c.counters[lv] = (c.counters[lv] || 0) + 1;
    c.counters.length = lv + 1;
    block.num = c.counters[lv];
  } else if (text) c.counters.length = 0;
  if ((d[11] || 0) & 0x04) block.pageBreakBefore = true; // 쪽 나눔
  if (text || st.images.length || st.links.length) {
    if (c.gap && text && c.lastText) block.gapBefore = true;
    c.gap = false;
    if (text) c.lastText = true;
    out.push(block);
  } else {
    c.gap = true;
    if (block.pageBreakBefore) c.pendingBreak = true;
  }
  if (c.pendingBreak && out.length && out[out.length - 1] === block) { block.pageBreakBefore = true; c.pendingBreak = false; }
  for (const t of st.tables) out.push({ type: 'table', rows: t });
  for (const e of st.extra) out.push(e);
}

/** 문단 글자(WCHAR 배열)를 읽으며 글자 모양 구간별로 세고, 제어 문자 자리에서 컨트롤(표·그림·각주·필드)을 처리 */
function readText(u, cs, ctrls, c, st, inCell, depth) {
  const n = u ? u.length >> 1 : 0;
  const shapes = [];
  if (cs) for (let o = 0; o + 8 <= cs.length; o += 8) shapes.push([u32(cs, o), u32(cs, o + 4)]);
  if (!shapes.length) shapes.push([0, 0]);
  let si = 0, seg = '';
  const flush = () => {
    if (!seg) return;
    const cf = c.info.charShapes[shapes[si][1]];
    st.text += seg;
    st.chars += seg.length;
    if (cf) {
      if (cf.bold) st.bold += seg.length;
      if (cf.height > st.maxH) st.maxH = cf.height;
      if (cf.font && seg.trim()) { c.fontUse.set(cf.font, (c.fontUse.get(cf.font) || 0) + seg.length); st.runs.push({ font: cf.font, n: seg.replace(/\s/g, '').length }); }
    }
    seg = '';
  };
  const emit = (s) => { seg += s; if (st.field && st.field.type === 'HYPERLINK') st.field.label += s; };
  let ci = 0;
  for (let i = 0; i < n;) {
    while (si + 1 < shapes.length && shapes[si + 1][0] <= i) { flush(); si++; }
    const ch = u[i * 2] | (u[i * 2 + 1] << 8);
    if (ch >= 32) {
      // 이어지는 보통 글자를 한 번에(긴 문단에서 빠르게)
      let j = i + 1;
      const stop = si + 1 < shapes.length ? Math.min(n, shapes[si + 1][0]) : n;
      while (j < stop && (u[j * 2] | (u[j * 2 + 1] << 8)) >= 32) j++;
      emit(wstr(u, i * 2, j - i));
      i = j;
      continue;
    }
    if (ch === 13) break; // 문단 끝
    if (INLINE.has(ch) || EXTENDED.has(ch)) {
      if (i + 8 > n) break;
      if (ch === 9) emit(' '); // 탭
      else if (ch === 4) { // 필드 끝
        if (st.field && st.field.type === 'HYPERLINK') addLink(st, st.field.url, st.field.label);
        st.field = null;
      } else if (EXTENDED.has(ch)) {
        const id = u32(u, i * 2 + 2);
        let k = ci;
        while (k < ctrls.length && u32(ctrls[k].data, 0) !== id) k++;
        if (k < ctrls.length) { ci = k + 1; flush(); readControl(ctrls[k], c, st, inCell, depth, emit); }
      }
      i += 8;
      continue;
    }
    if (ch === 10) emit('\n');
    else if (ch === 24) emit('-');
    else if (ch === 30 || ch === 31) emit(' ');
    i++;
  }
  flush();
}

function readControl(ctrl, c, st, inCell, depth, emit) {
  const d = ctrl.data;
  const id = chid(d);
  if (id === 'tbl ') {
    if (depth >= 24) return;
    const t = readTable(ctrl, c, st, depth + 1);
    if (t.rows.length) st.tables.push(t.rows);
    for (const b of t.caption) st.extra.push(b);
  } else if (id === 'gso ') {
    if (depth >= 24) return;
    readShape(ctrl, c, st, inCell, depth + 1);
  } else if (id === 'fn  ' || id === 'en  ') {
    // 각주·미주: 본문 문단 바로 뒤에 "(각주) …" 문단으로(머리말·꼬리말은 쪽마다 되풀이되는 글이라 읽지 않음)
    if (depth >= 24) return;
    const inner = [];
    const keep = { counters: [...c.counters], gap: c.gap, lastText: c.lastText, pendingBreak: c.pendingBreak };
    for (const p of listParas(ctrl.children)) readPara(p, c, inner, inCell, depth + 1);
    Object.assign(c, keep);
    const text = normText(inner.filter((b) => b.type === 'p').map((b) => b.text).filter(Boolean).join(' '));
    if (text) st.extra.push({ type: 'p', text: `(${id === 'fn  ' ? '각주' : '미주'}) ${text}`, level: 0, heading: null, role: 'text', links: inner.flatMap((b) => b.links || []), images: [] });
  } else if (id === 'atno') {
    // 자동 번호: 그림·표·수식 번호만 글에 넣음(쪽·각주 번호는 hwpx와 같이 뺌)
    const kind = u32(d, 4) & 0xF;
    if (kind >= 3 && kind <= 5) emit(String(u16(d, 8)));
  } else if (id[0] === '%') {
    if (id === '%hlk') {
      const cmd = bstr(d, 9).s;
      st.field = { type: 'HYPERLINK', url: hyperlinkUrl(cmd), label: '' };
    } else st.field = { type: 'FIELD', url: '', label: '' };
  }
}

/** 하이퍼링크 명령 "https\://example.com;1;0;0;" → 주소(\로 감싼 글자 풀기) */
export function hyperlinkUrl(cmd) {
  const m = /^((?:\\.|[^;\\])*)/.exec(String(cmd || ''));
  return (m ? m[1] : '').replace(/\\(.)/g, '$1');
}

/** LIST_HEADER 뒤에 이어지는 PARA_HEADER들 */
function listParas(kids, from = 0, to = kids.length) {
  const out = [];
  let open = false;
  for (let i = from; i < to; i++) {
    const k = kids[i];
    if (k.tag === T.LIST_HEADER) open = true;
    else if (k.tag === T.PARA_HEADER) { if (open) out.push(k); }
    else open = false;
  }
  return out;
}

function captionBlocks(kids, from, to, c, inCell, depth) {
  const inner = [];
  const keep = { counters: [...c.counters], gap: c.gap, lastText: c.lastText, pendingBreak: c.pendingBreak };
  for (const p of listParas(kids, from, to)) readPara(p, c, inner, inCell, depth);
  Object.assign(c, keep);
  return inner.filter((b) => b.type === 'p' && b.text).map((b) => ({ ...b, heading: null, role: 'text', num: 0, bullet: false }));
}

/** 표: TABLE 레코드 앞의 문단 목록 = 캡션, 뒤 = 칸(LIST_HEADER: 열·행 주소, 합친 칸 수) */
function readTable(ctrl, c, st, depth) {
  const kids = ctrl.children;
  const ti = kids.findIndex((k) => k.tag === T.TABLE);
  if (ti < 0) return { rows: [], caption: [] };
  const caption = captionBlocks(kids, 0, ti, c, true, depth);
  const t = kids[ti].data;
  const nRows = u16(t, 4);
  const rowSizes = [];
  for (let r = 0; r < nRows && 18 + r * 2 + 2 <= t.length; r++) rowSizes.push(u16(t, 18 + r * 2));
  const cells = [];
  let cur = null;
  for (let i = ti + 1; i < kids.length; i++) {
    const k = kids[i];
    if (k.tag === T.LIST_HEADER) { cur = { col: u16(k.data, 8), row: u16(k.data, 10), paras: [] }; cells.push(cur); }
    else if (k.tag === T.PARA_HEADER && cur) cur.paras.push(k);
  }
  // 행 주소가 맞으면 그것으로, 아니면 행마다의 칸 수로 나눔
  const byAddr = cells.length && cells.every((x) => x.row < Math.max(nRows, 1));
  const groups = [];
  if (byAddr) {
    const m = new Map();
    for (const x of cells) { if (!m.has(x.row)) m.set(x.row, []); m.get(x.row).push(x); }
    for (const r of [...m.keys()].sort((a, b) => a - b)) groups.push(m.get(r).sort((a, b) => a.col - b.col));
  } else {
    let k = 0;
    for (const n of rowSizes.length ? rowSizes : [cells.length]) { groups.push(cells.slice(k, k + n)); k += n; }
    if (k < cells.length) groups.push(cells.slice(k));
  }
  const rows = [];
  for (const g of groups) {
    const row = [];
    for (const cell of g) {
      const inner = [];
      for (const p of cell.paras) readPara(p, c, inner, true, depth);
      row.push(normText(inner.map((b) => (b.type === 'table' ? b.rows.map((r) => r.join(' | ')).join('\n') : b.text)).filter(Boolean).join('\n')));
      for (const b of inner) for (const l of b.links || []) addLink(st, l.url, l.label);
    }
    if (row.some(Boolean)) rows.push(row);
  }
  return { rows, caption };
}

/** 그리기 개체(gso): 캡션, 그림(SC_PICTURE → BinData), 글상자 문단, 묶음 개체 속 개체 */
function readShape(ctrl, c, st, inCell, depth) {
  const d = ctrl.data;
  const alt = d.length >= 46 ? normLine(bstr(d, 44).s) : '';
  const size = { width: Math.round(i32(d, 16) / 75), height: Math.round(i32(d, 20) / 75) }; // HWPUNIT(1/7200in) → px(96dpi)
  const kids = ctrl.children;
  const sc = kids.findIndex((k) => k.tag === T.SHAPE_COMPONENT);
  for (const b of captionBlocks(kids, 0, sc < 0 ? kids.length : sc, c, inCell, depth)) st.extra.push(b);
  for (const k of kids) if (k.tag === T.SHAPE_COMPONENT) readComponent(k, c, st, inCell, depth, alt, size);
}

function readComponent(node, c, st, inCell, depth, alt, size) {
  if (depth > 40) return;
  const inner = [];
  for (const p of listParas(node.children)) readPara(p, c, inner, inCell, depth + 1);
  for (const b of inner) { if (b.type === 'p') b.role = 'text'; st.extra.push(b); }
  for (const k of node.children) {
    if (k.tag === T.SC_PICTURE) addPicture(k.data, c, st, alt, size);
    else if (k.tag === T.SHAPE_COMPONENT) readComponent(k, c, st, inCell, depth + 1, '', size);
  }
}

function addPicture(d, c, st, alt, size) {
  const ref = u16(d, 71); // 그림 정보의 BinItem ID(1부터)
  const bin = c.info.binData[ref - 1];
  if (!bin || bin.type !== 1 || !bin.id) return;
  const name = `BIN${bin.id.toString(16).toUpperCase().padStart(4, '0')}.${bin.ext || 'bin'}`;
  const path = `BinData/${name}`;
  if (!c.cfb.has(path)) return;
  const ext = bin.ext;
  if (!WEB_IMAGE.has(ext)) c.unsupportedExt.add(ext || '?');
  c.imgSeq++;
  const im = { id: `${c.fileId}-img${c.imgSeq}`, name, path, mime: mimeOf(name) };
  if (alt) im.alt = alt;
  if (!WEB_IMAGE.has(ext)) im.web = false;
  if (size.width > 0 && size.height > 0) { im.width = size.width; im.height = size.height; }
  im._compressed = bin.compress === 1 || (bin.compress === 0 && c.fh.compressed);
  st.images.push(im);
}

function addLink(st, url, label) {
  const u = cleanUrl(url);
  if (!u) return;
  const lab = normLine(label);
  const ex = st.links.find((l) => l.url === u);
  if (ex) { if (!ex.label) ex.label = lab; return; }
  st.links.push({ url: u, label: lab });
}
