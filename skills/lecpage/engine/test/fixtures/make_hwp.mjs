#!/usr/bin/env node
// 시험용 예전 한글 파일(HWP 5.0) 만들기: 같은 내용의 HWPX → .hwp(OLE 복합 문서 + 레코드).
// LibreOffice에는 HWP로 저장하는 기능이 없어서, 한컴이 공개한 「한글 문서 파일 형식 5.0」대로 직접 씁니다.
//
//   node make_hwp.mjs                  이 폴더의 plan.hwpx → plan.hwp
//   node make_hwp.mjs 입력.hwpx 출력.hwp
//   import { hwpxToHwp, writeCfb, record } from './make_hwp.mjs'   (시험 안에서 바로 만들 때)
//
// 실제 한글이 저장한 파일과 다른 점(해석기가 읽지 않는 부분):
//   - 줄 배치(PARA_LINE_SEG)·쪽 정의·테두리·그리기 개체의 변환 행렬은 고정 값이고, 미리보기 그림(PrvImage)·스크립트·문서 옵션은 없음
//   - 글자 모양은 HWPX에 적힌 글꼴·크기·굵기만, 문단 모양은 머리 모양(개요·번호·글머리표)과 수준만 옮김
//   - 레코드 모양은 한글 2007 무렵(5.0.1.7) 파일을 따름. 버전·압축·암호·배포용 표시는 옵션으로 바꿀 수 있음
import { unzipSync, deflateSync } from '../../vendor/fflate.js';
import { parseXml, kids, kid, all, first, attr, textOf, isEl } from '../../src/ingest/xml.js';

const END = 0xFFFFFFFE, FREE = 0xFFFFFFFF, FATSECT = 0xFFFFFFFD, NOSTREAM = 0xFFFFFFFF;
const TAG = {
  DOC_PROPS: 16, ID_MAPPINGS: 17, BIN_DATA: 18, FACE_NAME: 19, BORDER_FILL: 20, CHAR_SHAPE: 21, TAB_DEF: 22, NUMBERING: 23,
  PARA_SHAPE: 25, STYLE: 26, COMPAT: 30, LAYOUT_COMPAT: 31,
  PARA_HEADER: 66, PARA_TEXT: 67, PARA_CHAR_SHAPE: 68, PARA_LINE_SEG: 69, CTRL_HEADER: 71, LIST_HEADER: 72, PAGE_DEF: 73,
  FOOTNOTE_SHAPE: 74, PAGE_BORDER_FILL: 75, SHAPE_COMPONENT: 76, TABLE: 77, SC_RECT: 79, SC_PICTURE: 85,
};

/** 작은 바이트 쓰개 */
class W {
  constructor() { this.a = []; }
  u8(v) { this.a.push(v & 255); return this; }
  u16(v) { this.a.push(v & 255, (v >>> 8) & 255); return this; }
  u32(v) { this.a.push(v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255); return this; }
  f64(v) { const b = new Uint8Array(new Float64Array([v]).buffer); for (const x of b) this.a.push(x); return this; }
  bytes(b) { for (const x of b) this.a.push(x); return this; }
  zeros(n) { for (let i = 0; i < n; i++) this.a.push(0); return this; }
  wstr(s) { for (let i = 0; i < s.length; i++) this.u16(s.charCodeAt(i)); return this; }
  bstr(s) { this.u16(s.length); return this.wstr(s); }
  chid(s) { return this.u8(s.charCodeAt(3)).u8(s.charCodeAt(2)).u8(s.charCodeAt(1)).u8(s.charCodeAt(0)); }
  get length() { return this.a.length; }
  out() { return Uint8Array.from(this.a); }
}
const chidNum = (s) => ((s.charCodeAt(0) << 24) | (s.charCodeAt(1) << 16) | (s.charCodeAt(2) << 8) | s.charCodeAt(3)) >>> 0;
const concat = (parts) => { const n = parts.reduce((a, p) => a + p.length, 0); const o = new Uint8Array(n); let k = 0; for (const p of parts) { o.set(p, k); k += p.length; } return o; };

/** 레코드 하나: 머리(태그 10비트·수준 10비트·크기 12비트, 4095 이상이면 크기를 따로 4바이트) + 데이터 */
export function record(tag, level, data) {
  const w = new W();
  const head = (tag & 0x3FF) | ((level & 0x3FF) << 10);
  if (data.length >= 0xFFF) w.u32(head | (0xFFF << 20)).u32(data.length);
  else w.u32(head | (data.length << 20));
  return w.bytes(data).out();
}

// ── OLE 복합 문서(CFB 버전 3, 512바이트 섹터) 쓰기 ──────────────
const cfbLess = (a, b) => a.name.length - b.name.length || (a.name.toUpperCase() < b.name.toUpperCase() ? -1 : a.name.toUpperCase() > b.name.toUpperCase() ? 1 : 0);

/** streams: [[경로, Uint8Array]] ("BodyText/Section0"처럼 /로 저장소 구분) → CFB 바이트 */
export function writeCfb(streams) {
  const SS = 512, MSS = 64, CUT = 4096;
  const root = { name: 'Root Entry', type: 5, children: new Map() };
  for (const [path, data] of streams) {
    const parts = path.split('/');
    let node = root;
    for (const p of parts.slice(0, -1)) {
      if (!node.children.has(p)) node.children.set(p, { name: p, type: 1, children: new Map() });
      node = node.children.get(p);
    }
    node.children.set(parts[parts.length - 1], { name: parts[parts.length - 1], type: 2, data });
  }
  const entries = [];
  const add = (n) => { n.id = entries.length; entries.push(n); if (n.children) for (const c of n.children.values()) add(c); };
  add(root);
  const bst = (list) => { if (!list.length) return null; const mid = list.length >> 1; const n = list[mid]; n.l = bst(list.slice(0, mid)); n.r = bst(list.slice(mid + 1)); return n; };
  for (const e of entries) if (e.children) { const top = bst([...e.children.values()].sort(cfbLess)); e.child = top ? top.id : NOSTREAM; }

  const sectors = [], fat = [];
  const alloc = (data) => {
    if (!data.length) return END;
    const n = Math.ceil(data.length / SS), start = sectors.length;
    for (let i = 0; i < n; i++) {
      const s = new Uint8Array(SS);
      s.set(data.subarray(i * SS, Math.min(data.length, (i + 1) * SS)));
      sectors.push(s);
      fat.push(i === n - 1 ? END : start + i + 1);
    }
    return start;
  };
  const miniFat = [], miniParts = [];
  for (const e of entries) {
    if (e.type !== 2) continue;
    e.size = e.data.length;
    if (!e.size) { e.start = END; continue; }
    if (e.size >= CUT) { e.start = alloc(e.data); continue; }
    const n = Math.ceil(e.size / MSS);
    e.start = miniFat.length;
    for (let i = 0; i < n; i++) miniFat.push(i === n - 1 ? END : e.start + i + 1);
    const padded = new Uint8Array(n * MSS);
    padded.set(e.data);
    miniParts.push(padded);
  }
  const mini = concat(miniParts);
  root.start = mini.length ? alloc(mini) : END;
  root.size = mini.length;
  const mf = new W();
  for (const v of miniFat) mf.u32(v);
  while (mf.length % SS) mf.u32(FREE);
  const miniFatStart = miniFat.length ? alloc(mf.out()) : END;
  const nMiniFat = miniFat.length ? mf.length / SS : 0;

  const dir = new W();
  for (const e of entries) {
    const name = e.name.slice(0, 31);
    dir.wstr(name).zeros(64 - name.length * 2);
    dir.u16((name.length + 1) * 2).u8(e.type).u8(1); // 색: 검정
    dir.u32(e.l ? e.l.id : NOSTREAM).u32(e.r ? e.r.id : NOSTREAM).u32(e.children ? e.child : NOSTREAM);
    dir.zeros(16 + 4 + 16); // CLSID·상태·시각
    dir.u32(e.type === 1 ? 0 : e.start).u32(e.type === 1 ? 0 : e.size).u32(0);
  }
  while (dir.length % SS) { dir.zeros(64).u16(0).u8(0).u8(0).u32(NOSTREAM).u32(NOSTREAM).u32(NOSTREAM).zeros(36).u32(0).u32(0).u32(0); }
  const dirStart = alloc(dir.out());

  let nF = 1;
  while (nF * (SS / 4) < sectors.length + nF) nF++;
  if (nF > 109) throw new Error('시험용 쓰개는 작은 파일만 만듭니다');
  const fatStart = sectors.length;
  for (let i = 0; i < nF; i++) fat.push(FATSECT);
  const fw = new W();
  for (const v of fat) fw.u32(v);
  while (fw.length < nF * SS) fw.u32(FREE);
  const fb = fw.out();
  for (let i = 0; i < nF; i++) sectors.push(fb.subarray(i * SS, (i + 1) * SS));

  const h = new W();
  h.bytes([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]).zeros(16).u16(0x3E).u16(3).u16(0xFFFE).u16(9).u16(6).zeros(6);
  h.u32(0).u32(nF).u32(dirStart).u32(0).u32(CUT).u32(miniFatStart).u32(nMiniFat).u32(END).u32(0);
  for (let i = 0; i < 109; i++) h.u32(i < nF ? fatStart + i : FREE);
  return concat([h.out(), ...sectors]);
}

// ── HWPX → HWP ──────────────────────────────────────
const LANGS = ['HANGUL', 'LATIN', 'HANJA', 'JAPANESE', 'OTHER', 'SYMBOL', 'USER'];
const REF = ['hangul', 'latin', 'hanja', 'japanese', 'other', 'symbol', 'user'];
const HEAD = { NONE: 0, OUTLINE: 1, NUMBER: 2, BULLET: 3 };
const NUMTYPE = { PAGE: 0, FOOTNOTE: 1, ENDNOTE: 2, PICTURE: 3, TABLE: 4, EQUATION: 5 };

function readHeader(doc) {
  const fonts = LANGS.map(() => []);
  const fontIdx = LANGS.map(() => new Map());
  const faces = all(doc, 'fontface');
  for (const ff of faces) {
    const li = LANGS.indexOf((attr(ff, 'lang') || '').toUpperCase());
    if (li < 0) continue;
    for (const f of kids(ff, 'font')) { fontIdx[li].set(attr(f, 'id'), fonts[li].length); fonts[li].push(attr(f, 'face') || ''); }
  }
  // 한글 프로그램은 일곱 언어 모두에 글꼴 목록을 둠. HWPX에 없는 언어는 한글 목록을 따름
  if (faces.length) for (let li = 1; li < 7; li++) if (!fonts[li].length) { fonts[li] = [...fonts[0]]; fontIdx[li] = new Map(fontIdx[0]); }
  const charIdx = new Map(), chars = [];
  for (const cp of all(doc, 'charPr')) {
    const fr = kid(cp, 'fontRef');
    charIdx.set(attr(cp, 'id'), chars.length);
    chars.push({ ids: REF.map((r, li) => fontIdx[li].get(attr(fr, r)) ?? 0), height: +attr(cp, 'height') || 1000, bold: !!kid(cp, 'bold'), italic: !!kid(cp, 'italic') });
  }
  if (!chars.length) chars.push({ ids: REF.map(() => 0), height: 1000, bold: false, italic: false });
  const paraIdx = new Map(), paras = [];
  for (const p of all(doc, 'paraPr')) {
    const h = kid(p, 'heading');
    paraIdx.set(attr(p, 'id'), paras.length);
    paras.push({ type: HEAD[(attr(h, 'type') || 'NONE').toUpperCase()] || 0, level: +attr(h, 'level') || 0, idRef: +attr(h, 'idRef') || 0 });
  }
  if (!paras.length) paras.push({ type: 0, level: 0, idRef: 0 });
  const styleIdx = new Map(), styles = [];
  for (const s of all(doc, 'style')) {
    styleIdx.set(attr(s, 'id'), styles.length);
    styles.push({ name: attr(s, 'name') || '', eng: attr(s, 'engName') || '', para: paraIdx.get(attr(s, 'paraPrIDRef')) ?? 0, char: charIdx.get(attr(s, 'charPrIDRef')) ?? 0 });
  }
  if (!styles.length) styles.push({ name: '바탕글', eng: 'Normal', para: 0, char: 0 });
  const numberings = all(doc, 'numbering').map((n) => kids(n, 'paraHead').map((ph) => textOf(ph)));
  return { fonts, chars, charIdx, paras, paraIdx, styles, styleIdx, numberings };
}

function docInfo(H, bins, sections) {
  const out = [];
  out.push(record(TAG.DOC_PROPS, 0, new W().u16(sections).u16(1).u16(1).u16(1).u16(1).u16(1).u16(1).u32(0).u32(0).u32(0).out()));
  const counts = [bins.length, ...H.fonts.map((f) => f.length), 1, H.chars.length, 1, H.numberings.length, 0, H.paras.length, H.styles.length, 0];
  const idm = new W();
  for (const n of counts) idm.u32(n);
  out.push(record(TAG.ID_MAPPINGS, 0, idm.out()));
  for (const b of bins) out.push(record(TAG.BIN_DATA, 1, new W().u16(b.compress === false ? 0x21 : 0x01).u16(b.id).bstr(b.ext).out()));
  for (const list of H.fonts) for (const name of list) out.push(record(TAG.FACE_NAME, 1, new W().u8(0).bstr(name).out()));
  out.push(record(TAG.BORDER_FILL, 1, new W().u16(0).zeros(4).zeros(4).zeros(16).u8(0).u8(0).u32(0).u32(0).out()));
  for (const c of H.chars) {
    const w = new W();
    for (const id of c.ids) w.u16(id);
    for (let i = 0; i < 7; i++) w.u8(100);
    w.zeros(7);
    for (let i = 0; i < 7; i++) w.u8(100);
    w.zeros(7);
    w.u32(c.height).u32((c.italic ? 1 : 0) | (c.bold ? 2 : 0)).u8(10).u8(10).u32(0).u32(0).u32(0xFFFFFFFF).u32(0xB2B2B2);
    out.push(record(TAG.CHAR_SHAPE, 1, w.out()));
  }
  out.push(record(TAG.TAB_DEF, 1, new W().u32(0).u32(0).out()));
  for (const heads of H.numberings) {
    const w = new W();
    for (let i = 0; i < 7; i++) w.u32(0x0C).u16(0).u16(50).u32(0xFFFFFFFF).bstr(heads[i] || `^${i + 1}.`);
    w.u16(1);
    out.push(record(TAG.NUMBERING, 1, w.out()));
  }
  for (const p of H.paras) {
    const w = new W();
    w.u32(0x80 | (p.type << 23) | (p.level << 25)); // 정렬(양쪽) + 머리 모양 + 수준
    w.u32(p.level * 2000).u32(0).u32(0).u32(0).u32(0).u32(160);
    w.u16(0).u16(p.idRef).u16(1).zeros(8).u32(0);
    out.push(record(TAG.PARA_SHAPE, 1, w.out()));
  }
  for (const s of H.styles) out.push(record(TAG.STYLE, 1, new W().bstr(s.name).bstr(s.eng).u8(0).u8(0).u16(1042).u16(s.para).u16(s.char).u16(0).out()));
  out.push(record(TAG.COMPAT, 0, new W().u32(0).out()));
  out.push(record(TAG.LAYOUT_COMPAT, 1, new W().zeros(20).out()));
  return concat(out);
}

/** 개체 공통 속성(표·그리기 개체의 컨트롤 머리) */
function objectHeader(id, width, height, inst, desc) {
  const w = new W().chid(id).u32(id === 'tbl ' ? 0x082A2210 : 0x042A6210).u32(0).u32(0).u32(width).u32(height).u32(0)
    .u16(283).u16(283).u16(283).u16(283).u32(inst).u32(0);
  if (desc !== undefined) w.bstr(desc);
  return w.out();
}
/** 개체 요소(SHAPE_COMPONENT): 개체 아이디 두 번 + 위치·크기 + 행렬 3개(이동·크기·회전, 단위 행렬) */
function shapeComponent(id, width, height, extra = 0) {
  const w = new W().chid(id).chid(id).u32(0).u32(0).u16(0).u16(1).u32(width).u32(height).u32(width).u32(height).u32(0).u16(0).u32(width >> 1).u32(height >> 1).u16(1);
  for (let k = 0; k < 3; k++) w.f64(1).f64(0).f64(0).f64(0).f64(1).f64(0);
  return w.zeros(extra).out();
}
const lineSeg = () => new W().u32(0).u32(0).u32(1000).u32(1000).u32(850).u32(600).u32(0).u32(42520).u32(0x60000).out();

class SectionWriter {
  constructor(H, binByRef) { this.H = H; this.binByRef = binByRef; this.inst = 0x6C000000; this.out = []; }
  rec(tag, level, data) { this.out.push(record(tag, level, data)); }

  paras(list, level) {
    const ps = list.length ? list : [null];
    ps.forEach((p, i) => this.para(p, level, i === ps.length - 1));
  }

  para(p, level, last) {
    const H = this.H;
    const units = [], cs = [], ctrls = [];
    let mask = 0, brk = 0;
    const style = p ? H.styleIdx.get(attr(p, 'styleIDRef')) ?? 0 : 0;
    const shape = p ? H.paraIdx.get(attr(p, 'paraPrIDRef')) ?? H.styles[style]?.para ?? 0 : 0;
    const setCs = (ref) => {
      const id = H.charIdx.get(ref) ?? 0;
      const lastCs = cs[cs.length - 1];
      if (lastCs && lastCs[1] === id) return;
      if (lastCs && lastCs[0] === units.length) lastCs[1] = id; else cs.push([units.length, id]);
    };
    const ch = (s) => { for (let i = 0; i < s.length; i++) units.push(s.charCodeAt(i)); };
    const ctl = (code, id) => { const n = chidNum(id); units.push(code, n & 0xFFFF, n >>> 16, 0, 0, 0, 0, code); mask |= 1 << code; };
    const ext = (code, id, data, kidsFn) => { ctl(code, id); ctrls.push({ data, kidsFn }); };
    if (p && attr(p, 'pageBreak') === '1') brk |= 0x04;

    const object = (n) => {
      switch (n.local) {
        case 'tbl': ext(11, 'tbl ', null, null); this.table(n, ctrls[ctrls.length - 1]); break;
        case 'pic': ext(11, 'gso ', null, null); this.picture(n, ctrls[ctrls.length - 1]); break;
        case 'rect': case 'ellipse': case 'polygon': case 'curve': case 'arc':
          ext(11, 'gso ', null, null); this.textBox(n, ctrls[ctrls.length - 1]); break;
        default: break;
      }
    };
    for (const run of p ? kids(p, 'run') : []) {
      setCs(attr(run, 'charPrIDRef'));
      for (const n of run.children) {
        if (!isEl(n)) continue;
        if (n.local === 't') {
          for (const x of n.children) {
            if (typeof x === 'string') ch(x);
            else if (x.local === 'lineBreak') units.push(10);
            else if (x.local === 'tab') ctl(9, '\0\0\0\0');
            else if (x.local === 'nbSpace') units.push(30);
            else if (x.local === 'fwSpace') units.push(31);
            else if (x.local === 'hyphen') units.push(24);
            else ch(textOf(x));
          }
        } else if (n.local === 'secPr') {
          brk |= 0x03;
          ext(2, 'secd', new W().chid('secd').u32(0).u32(1134).u32(8000).u16(1).zeros(14).out(), (lv) => {
            this.rec(TAG.PAGE_DEF, lv, new W().u32(59528).u32(84188).u32(8504).u32(8504).u32(5668).u32(4252).u32(4252).u32(4252).u32(0).u32(0).out());
            for (let k = 0; k < 2; k++) this.rec(TAG.FOOTNOTE_SHAPE, lv, new W().zeros(8).u16(41).u16(1).u32(0xFFFFFFFF).u16(850).u16(567).u16(283).u8(1).u8(1).u32(0).out());
            for (let k = 0; k < 3; k++) this.rec(TAG.PAGE_BORDER_FILL, lv, new W().u32(1).u16(1417).u16(1417).u16(1417).u16(1417).u16(0).out());
          });
          ext(2, 'cold', new W().chid('cold').u16(0x1004).zeros(10).out(), null);
        } else if (n.local === 'ctrl') {
          for (const x of n.children) {
            if (!isEl(x)) continue;
            if (x.local === 'fieldBegin') {
              const type = (attr(x, 'type') || '').toUpperCase();
              let cmd = '', path = '';
              for (const sp of all(x, 'stringParam')) { if (attr(sp, 'name') === 'Command') cmd = textOf(sp); if (attr(sp, 'name') === 'Path') path = textOf(sp); }
              if (!cmd && path) cmd = path.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/;/g, '\\;') + ';1;0;0;';
              const id = type === 'HYPERLINK' ? '%hlk' : '%clk';
              ext(3, id, new W().chid(id).u32(0).u8(0).bstr(cmd).u32(+attr(x, 'fieldid') || 1).out(), null);
            } else if (x.local === 'fieldEnd') ctl(4, '%hlk');
            else if (x.local === 'footNote' || x.local === 'endNote') {
              const id = x.local === 'footNote' ? 'fn  ' : 'en  ';
              const inner = kids(kid(x, 'subList') || x, 'p');
              ext(17, id, new W().chid(id).u32(+attr(x, 'number') || 1).u16(0).u16(41).u32(0).out(), (lv) => {
                this.rec(TAG.LIST_HEADER, lv, new W().u16(Math.max(1, inner.length)).u16(0).u32(0).out());
                this.paras(inner, lv);
              });
            } else if (x.local === 'header' || x.local === 'footer') {
              const id = x.local === 'header' ? 'head' : 'foot';
              const inner = kids(kid(x, 'subList') || x, 'p');
              ext(16, id, new W().chid(id).u32(0).u32(0).out(), (lv) => {
                this.rec(TAG.LIST_HEADER, lv, new W().u16(Math.max(1, inner.length)).u16(0).u32(0).u32(42520).u32(4252).zeros(8).out());
                this.paras(inner, lv);
              });
            } else if (x.local === 'autoNum') {
              ext(18, 'atno', new W().chid('atno').u32(NUMTYPE[(attr(x, 'numType') || 'PAGE').toUpperCase()] ?? 0).u16(+attr(x, 'num') || 1).zeros(6).out(), null);
            }
          }
        } else object(n);
      }
    }
    // 문단 바로 아래의 개체(드물게 run 밖)
    for (const n of p ? p.children : []) if (isEl(n) && n.local !== 'run' && n.local !== 'linesegarray') object(n);
    units.push(13);
    if (!cs.length) cs.push([0, H.styles[style]?.char ?? 0]);

    this.rec(TAG.PARA_HEADER, level, new W().u32((units.length | (last ? 0x80000000 : 0)) >>> 0).u32(mask).u16(shape).u8(style).u8(brk)
      .u16(cs.length).u16(0).u16(1).u32(0).out());
    if (units.length > 1) { const w = new W(); for (const u of units) w.u16(u); this.rec(TAG.PARA_TEXT, level + 1, w.out()); }
    const cw = new W();
    for (const [pos, id] of cs) cw.u32(pos).u32(id);
    this.rec(TAG.PARA_CHAR_SHAPE, level + 1, cw.out());
    this.rec(TAG.PARA_LINE_SEG, level + 1, lineSeg());
    for (const c of ctrls) {
      this.rec(TAG.CTRL_HEADER, level + 1, c.data);
      if (c.kidsFn) c.kidsFn(level + 2);
    }
  }

  table(tbl, slot) {
    const trs = kids(tbl, 'tr');
    const cells = trs.map((tr, r) => kids(tr, 'tc').map((tc, c) => {
      const addr = kid(tc, 'cellAddr'), span = kid(tc, 'cellSpan'), sz = kid(tc, 'cellSz');
      return {
        col: addr ? +attr(addr, 'colAddr') || 0 : c, row: addr ? +attr(addr, 'rowAddr') || 0 : r,
        cs: span ? +attr(span, 'colSpan') || 1 : 1, rs: span ? +attr(span, 'rowSpan') || 1 : 1,
        w: sz ? +attr(sz, 'width') || 0 : 8000, h: sz ? +attr(sz, 'height') || 0 : 1000,
        paras: kids(kid(tc, 'subList') || tc, 'p'),
      };
    }));
    const cols = +attr(tbl, 'colCnt') || Math.max(1, ...cells.map((r) => r.length));
    const width = (cells[0] || []).reduce((a, c) => a + c.w, 0) || 40000;
    const height = cells.reduce((a, r) => a + (r[0]?.h || 1000), 0);
    slot.data = objectHeader('tbl ', width, height, this.inst++);
    slot.kidsFn = (lv) => {
      const t = new W().u32(6).u16(trs.length).u16(cols).u16(0).u16(141).u16(141).u16(141).u16(141);
      for (const r of cells) t.u16(r.length);
      t.u16(1).u16(0);
      this.rec(TAG.TABLE, lv, t.out());
      for (const r of cells) for (const c of r) {
        this.rec(TAG.LIST_HEADER, lv, new W().u16(Math.max(1, c.paras.length)).u16(0).u32(0x20).u16(c.col).u16(c.row).u16(c.cs).u16(c.rs)
          .u32(c.w).u32(c.h).u16(141).u16(141).u16(141).u16(141).u16(1).u32(c.w).out());
        this.paras(c.paras, lv);
      }
    };
  }

  picture(pic, slot) {
    const img = first(pic, 'img');
    const bin = this.binByRef.get(attr(img, 'binaryItemIDRef'));
    const sz = kid(pic, 'sz') || kid(pic, 'curSz');
    const w = sz ? +attr(sz, 'width') || 7200 : 7200, h = sz ? +attr(sz, 'height') || 7200 : 7200;
    const desc = textOf(kid(pic, 'shapeComment'));
    slot.data = objectHeader('gso ', w, h, this.inst++, desc);
    slot.kidsFn = (lv) => {
      this.rec(TAG.SHAPE_COMPONENT, lv, shapeComponent('$pic', w, h));
      const p = new W().u32(0).u32(0).u32(0).u32(0).u32(0).u32(w).u32(0).u32(w).u32(h).u32(0).u32(h)
        .u32(0).u32(0).u32(w).u32(h).zeros(8).u8(0).u8(0).u8(0).u16(bin ? bin.index : 0);
      this.rec(TAG.SC_PICTURE, lv + 1, p.out());
    };
  }

  textBox(shape, slot) {
    const sz = kid(shape, 'sz') || kid(shape, 'curSz');
    const w = sz ? +attr(sz, 'width') || 20000 : 20000, h = sz ? +attr(sz, 'height') || 5000 : 5000;
    const texts = all(shape, 'drawText');
    slot.data = objectHeader('gso ', w, h, this.inst++);
    slot.kidsFn = (lv) => {
      this.rec(TAG.SHAPE_COMPONENT, lv, shapeComponent('$rec', w, h, 21));
      for (const dt of texts) {
        const inner = kids(kid(dt, 'subList') || dt, 'p');
        this.rec(TAG.LIST_HEADER, lv + 1, new W().u16(Math.max(1, inner.length)).u16(0).u32(0x20).u16(283).u16(283).u16(283).u16(283).u32(w).out());
        this.paras(inner, lv + 1);
      }
      this.rec(TAG.SC_RECT, lv + 1, new W().u8(0).u32(0).u32(0).u32(w).u32(0).u32(w).u32(h).u32(0).u32(h).out());
    };
  }
}

function summaryInfo(meta) {
  const props = [[2, meta.title], [4, meta.author]].filter(([, v]) => v);
  const body = [];
  for (const [pid, v] of props) {
    const w = new W().u32(31).u32(v.length + 1).wstr(v).u16(0);
    while (w.length % 4) w.u8(0);
    body.push([pid, w.out()]);
  }
  const head = 8 + body.length * 8;
  const sec = new W();
  const total = head + body.reduce((a, [, b]) => a + b.length, 0);
  sec.u32(total).u32(body.length);
  let off = head;
  for (const [pid, b] of body) { sec.u32(pid).u32(off); off += b.length; }
  for (const [, b] of body) sec.bytes(b);
  const w = new W().u16(0xFFFE).u16(0).u32(0x00020006).zeros(16).u32(1);
  w.bytes([0xE0, 0x85, 0x9F, 0xF2, 0xF9, 0x4F, 0x68, 0x10, 0xAB, 0x91, 0x08, 0x00, 0x2B, 0x27, 0xB3, 0xD9]).u32(48);
  return concat([w.out(), sec.out()]);
}

/**
 * HWPX 바이트 → HWP 5.0 바이트
 * @param {Uint8Array} hwpx
 * @param {object} [o] compress(기본 true) · password · distribution · drm · version(기본 0x05000107) · bigRecord(긴 문단을 4095바이트 넘는 레코드로)
 */
export function hwpxToHwp(hwpx, o = {}) {
  const compress = o.compress !== false;
  const files = unzipSync(hwpx);
  const text = (n) => (files[n] ? new TextDecoder().decode(files[n]) : '');
  const header = parseXml(text('Contents/header.xml') || '<head/>');
  const H = readHeader(header);
  const hpf = files['Contents/content.hpf'] ? parseXml(text('Contents/content.hpf')) : null;
  const meta = {};
  if (hpf) {
    meta.title = textOf(first(first(hpf, 'metadata'), 'title')).trim();
    for (const m of all(first(hpf, 'metadata'), 'meta')) if (attr(m, 'name') === 'creator') meta.author = textOf(m).trim();
  }
  // 그림: 매니페스트의 BinData 항목 → BIN0001.png…
  const bins = [], binByRef = new Map();
  const items = hpf ? all(hpf, 'item').filter((it) => /^BinData\//.test(attr(it, 'href') || '')) : [];
  for (const it of items) {
    const href = attr(it, 'href');
    if (!files[href]) continue;
    const ext = (href.split('.').pop() || 'bin').toLowerCase();
    const b = { id: bins.length + 1, index: bins.length + 1, ext, data: files[href] };
    bins.push(b);
    binByRef.set(attr(it, 'id'), b);
  }
  const secNames = Object.keys(files).filter((n) => /^Contents\/section\d+\.xml$/i.test(n)).sort((a, b) => +a.match(/(\d+)\.xml$/)[1] - +b.match(/(\d+)\.xml$/)[1]);
  const pack = (b) => (compress ? deflateSync(b, { level: 6 }) : b);
  const streams = [];
  const fh = new W().wstr('');
  const sig = 'HWP Document File';
  for (let i = 0; i < 32; i++) fh.u8(i < sig.length ? sig.charCodeAt(i) : 0);
  fh.u32(o.version || 0x05000107).u32((compress ? 1 : 0) | (o.password ? 2 : 0) | (o.distribution ? 4 : 0) | (o.drm ? 0x10 : 0)).zeros(256 - 40);
  streams.push(['FileHeader', fh.out()]);
  streams.push(['DocInfo', pack(docInfo(H, bins, secNames.length))]);
  const prv = [];
  secNames.forEach((name, i) => {
    const sec = parseXml(text(name));
    const root = first(sec, 'sec') || sec;
    const sw = new SectionWriter(H, binByRef);
    sw.paras(kids(root, 'p'), 0);
    prv.push(...all(root, 't').map((t) => textOf(t)));
    streams.push([`${o.distribution ? 'ViewText' : 'BodyText'}/Section${i}`, pack(concat(sw.out))]);
  });
  for (const b of bins) streams.push([`BinData/BIN${b.id.toString(16).toUpperCase().padStart(4, '0')}.${b.ext}`, pack(b.data)]);
  streams.push(['\u0005HwpSummaryInformation', summaryInfo(meta)]);
  streams.push(['PrvText', new W().wstr(prv.join('\r\n').slice(0, 1024)).out()]);
  return writeCfb(streams);
}

// ── 명령줄 ──────────────────────────────────────────
const { pathToFileURL, fileURLToPath } = await import('node:url');
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { readFileSync, writeFileSync } = await import('node:fs');
  const { dirname, join } = await import('node:path');
  const here = dirname(fileURLToPath(import.meta.url));
  const [src = join(here, 'plan.hwpx'), dst = src.replace(/\.hwpx$/i, '.hwp')] = process.argv.slice(2);
  const out = hwpxToHwp(new Uint8Array(readFileSync(src)));
  writeFileSync(dst, out);
  console.log(`${dst} (${out.length}바이트)`);
}
