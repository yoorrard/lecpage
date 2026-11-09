// lecpage 교재 해석(ingest) 진입점. 브라우저(웹앱, 서버 업로드 없음)와 Node(Agent Skill CLI)에서 같은 코드로 동작합니다.
//
//   const m = await ingestFile('교재.pptx', bytes, { withImages: true });
//   m.errors   → [{ code, message_ko }]  (예외를 던지지 않음)
//   m.detected → 일시·프롬프트·단계·도구·부(Part)…  (detect.js)
//   materialToDraft(m, info)        → 설계도(blueprint) 초안 (draft.js, AI 없이)
//   materialToAIContext(m, {maxChars}) → AI 프롬프트용 요약 글 (outline.js)
//
// Material 모양은 skills/lecpage/references/material-format.md 에 적어 두었습니다.
import {
  DEFAULT_LIMITS, IngestError, makeError, toUserError, toBytes, sniff, extOf, baseName, stripExt, normLine, normText,
  findUrls, cleanUrl, hostOf, findBoilerplate, textKey, urlKey, pageText, sizeLabel,
} from './util.js';
import { Zip } from './zip.js';
import { parsePptx } from './pptx.js';
import { parseDocx } from './docx.js';
import { parseHwpx } from './hwpx.js';
import { parsePdf, loadPdfjs } from './pdf.js';
import { parseText, parseTextFile } from './text.js';
import { detect } from './detect.js';
import { toolForUrl } from './tools-db.js';

export const MATERIAL_VERSION = 1;
export const SUPPORTED = ['pptx', 'pdf', 'hwpx', 'docx', 'txt', 'md'];
export const ACCEPT = '.pptx,.ppsx,.potx,.pptm,.pdf,.hwpx,.docx,.dotx,.docm,.txt,.md,.markdown,.hwp,.ppt,.doc';

export function emptyMaterial() {
  return {
    version: MATERIAL_VERSION, kind: 'lecpage-material', generator: 'lecpage-ingest-js/1',
    files: [], pages: [], design: {}, meta: {}, boilerplate: [], detected: null, errors: [], warnings: [],
  };
}

const PREFIX = { pptx: 'deck', pdf: 'deck', docx: 'doc', hwpx: 'doc', txt: 'doc', md: 'doc', link: 'link' };
const UNIT_KO = { slide: '장', page: '쪽', section: '절', link: '개' };

function zipType(zip, ext) {
  const mt = zip.has('mimetype') ? (zip.text('mimetype') || '').trim() : '';
  if (/hwp\+zip/i.test(mt) || zip.has('Contents/content.hpf') || zip.has('Contents/section0.xml')) return 'hwpx';
  if (/opendocument/i.test(mt)) return 'odf';
  if (zip.has('ppt/presentation.xml')) return 'pptx';
  if (zip.has('word/document.xml')) return 'docx';
  if (zip.has('xl/workbook.xml')) return 'xlsx';
  if (zip.has('Index/Document.iwa') || zip.has('index.apxl') || ext === 'key') return 'keynote';
  const ct = zip.has('[Content_Types].xml') ? zip.text('[Content_Types].xml') || '' : '';
  if (/presentationml/.test(ct)) return 'pptx';
  if (/wordprocessingml/.test(ct)) return 'docx';
  return 'zip';
}

/**
 * 파일 하나 해석. 절대 예외를 던지지 않습니다(오류는 material.errors).
 * @param {string} name 파일 이름(확장자로 형식 추정을 돕습니다)
 * @param {Uint8Array|ArrayBuffer|Blob|File|Buffer} bytes
 * @param {object} [opts]
 *   id            파일 id(기본: deck1·doc1)
 *   withImages    그림 바이트를 image.bytes(Uint8Array)로 담기
 *   detect        false면 감지 생략(여러 파일을 합칠 때)
 *   maxBytes, limits{maxUncompressed,maxEntryBytes,maxEntries,maxXmlBytes,maxPages}
 *   pdfjsLib, cMapUrl, standardFontDataUrl, password   PDF 옵션
 *   today         날짜 감지 기준일(연도 없는 날짜)
 */
export async function ingestFile(name, bytes, opts = {}) {
  const limits = { ...DEFAULT_LIMITS, ...(opts.limits || {}) };
  if (opts.maxBytes) limits.maxBytes = opts.maxBytes;
  const mat = emptyMaterial();
  const fname = normLine(baseName(String(name || '자료'))) || '자료';
  const ext = extOf(fname);
  const file = { id: opts.id || '', name: fname, type: '', size: 0, pages: 0, unit: '' };
  const warn = (code, data = {}) => { if (!mat.warnings.some((w) => w.code === code)) mat.warnings.push(makeError(code, data, fname)); };
  try {
    const b = await toBytes(bytes);
    file.size = b.length;
    if (!b.length) throw new IngestError('empty');
    if (b.length > limits.maxBytes) throw new IngestError('too-large', { mb: (b.length / 1048576).toFixed(1), limitMb: Math.round(limits.maxBytes / 1048576) });
    const kind = sniff(b);
    let type = '';
    let zip = null;
    if (kind === 'zip') { zip = new Zip(b, limits); type = zipType(zip, ext); }
    else if (kind === 'pdf') type = 'pdf';
    else if (kind === 'cfb') throw new IngestError(cfbError(ext));
    else if (kind === 'hwp3') throw new IngestError('legacy-hwp');
    else if (kind === 'drm') throw new IngestError('drm');
    else if (kind === 'text') {
      if (['pptx', 'docx', 'hwpx', 'xlsx', 'pdf', 'hwp', 'ppt', 'doc'].includes(ext)) throw new IngestError('drm');
      type = ['md', 'markdown', 'mdown'].includes(ext) ? 'md' : 'txt';
    } else {
      if (['pptx', 'docx', 'hwpx', 'xlsx', 'ppsx', 'potx'].includes(ext)) throw new IngestError('drm');
      if (ext === 'hwp') throw new IngestError('legacy-hwp');
      throw new IngestError('unsupported', { ext });
    }
    if (type === 'xlsx') throw new IngestError('spreadsheet');
    if (type === 'keynote') throw new IngestError('keynote');
    if (type === 'odf') throw new IngestError('odf');
    if (type === 'zip') throw new IngestError('unsupported', { ext: ext || 'zip' });

    file.type = type;
    file.id = file.id || `${PREFIX[type] || 'src'}1`;
    const ctx = { fileId: file.id, opts, limits, warn };
    let res;
    if (type === 'pptx') res = parsePptx(zip, ctx);
    else if (type === 'docx') res = parseDocx(zip, ctx);
    else if (type === 'hwpx') res = parseHwpx(zip, ctx);
    else if (type === 'pdf') res = await parsePdf(b, ctx);
    else res = parseTextFile(b, ctx, { markdown: type === 'md' });

    file.pages = res.pages.length;
    file.unit = res.unit;
    if (res.meta?.title) file.title = res.meta.title;
    if (res.meta?.author) file.author = res.meta.author;
    if (res.meta?.modified) file.modified = res.meta.modified;
    if (res.design?.slideSize) file.slideSize = res.design.slideSize;
    mat.files.push(file);
    mat.pages = res.pages;
    mat.design = cleanDesign(res.design);
    mat.meta = res.meta || {};
    postProcess(mat, file);
    const chars = mat.pages.reduce((n, p) => n + pageText(p).length, 0);
    if (chars < 30 && !mat.warnings.some((w) => w.code === 'no-text')) warn('no-content');
  } catch (e) {
    if (!mat.files.length) mat.files.push({ ...file, id: file.id || 'src1' });
    const err = toUserError(e, fname);
    if (e instanceof IngestError && e.data?.fallback) err.fallback = e.data.fallback;
    mat.errors.push(err);
    mat.pages = [];
  }
  if (opts.detect !== false && mat.pages.length) {
    try { mat.detected = detect(mat, opts); } catch (e) { mat.warnings.push(makeError('parse-failed', { detail: 'detect: ' + (e && e.message) }, fname)); }
  }
  return mat;
}

function cfbError(ext) {
  if (ext === 'hwp') return 'legacy-hwp';
  if (ext === 'ppt' || ext === 'pps' || ext === 'pot') return 'legacy-ppt';
  if (ext === 'doc' || ext === 'dot') return 'legacy-doc';
  if (['pptx', 'docx', 'xlsx', 'ppsx', 'potx', 'dotx'].includes(ext)) return 'encrypted'; // 암호 걸린 OOXML은 CFB 안에 들어 있음
  return 'legacy-office';
}

function cleanDesign(d) {
  if (!d) return {};
  const out = {};
  for (const [k, v] of Object.entries(d)) if (v !== undefined && v !== '' && !(Array.isArray(v) && !v.length)) out[k] = v;
  return out;
}

/** 해석 후 공통 정리: 반복 문구(머리글·바닥글) 제거, 글 속 URL을 링크로 추가, 빈 쪽 표시 */
function postProcess(mat, file) {
  const pages = mat.pages;
  const boiler = findBoilerplate(pages);
  if (boiler.size) {
    const texts = new Map();
    for (const p of pages) {
      p.paragraphs = (p.paragraphs || []).filter((x) => {
        const k = textKey(x.text);
        if (boiler.has(k)) { if (!texts.has(k)) texts.set(k, x.text); return false; }
        return true;
      });
    }
    mat.boilerplate = [...texts.values()].map((text) => ({ file: file.id, text }));
  }
  for (const p of pages) {
    p.links = p.links || [];
    const lines = [p.title, ...(p.paragraphs || []).map((x) => x.text), ...(p.tables || []).flatMap((t) => t.rows.map((r) => r.join(' ')))];
    for (const line of lines) {
      if (!line) continue;
      for (const f of findUrls(line)) {
        if (p.links.some((l) => l.url === f.url || urlKey(l.url) === urlKey(f.url))) continue;
        let label = line.slice(0, line.indexOf(f.raw)).replace(/[\s:：\-–—→▶>|(\[]+$/, '').replace(/^[-•·▪◦●○■□▶▷►➢➤→\d.)\s]+/, '');
        label = normLine(label.split(/[|·/,]\s*/).pop() || '');
        if (label.length > 30 || label.length < 2 || /^(step\s*\d+|\d+\s*단계|[①-⑳]|\d+[.)]?)$/i.test(label)) label = toolForUrl(f.url)?.name || '';
        p.links.push({ url: f.url, label, from: 'text' });
      }
    }
    if (!p.notes) p.notes = '';
    if (!p.images) p.images = [];
    if (!p.tables) p.tables = [];
  }
}

/** 여러 Material 합치기(파일 id가 겹치면 deck2·doc2…로 바꿈). 합친 뒤 감지를 다시 합니다. */
export function mergeMaterials(list, opts = {}) {
  const out = emptyMaterial();
  const used = new Set();
  const mats = (list || []).filter(Boolean);
  for (const m of mats) {
    const idMap = new Map();
    for (const f of m.files || []) {
      let id = f.id || 'src1';
      if (used.has(id)) {
        const prefix = id.replace(/\d+$/, '') || 'src';
        let n = 1;
        while (used.has(prefix + n)) n++;
        id = prefix + n;
      }
      used.add(id);
      idMap.set(f.id, id);
      out.files.push({ ...f, id });
    }
    const re = (oldId, newId) => (s) => (typeof s === 'string' && oldId !== newId && s.startsWith(oldId + '-') ? newId + s.slice(oldId.length) : s);
    for (const p of m.pages || []) {
      const nid = idMap.get(p.file) || p.file;
      const fix = re(p.file, nid);
      out.pages.push({ ...p, file: nid, images: (p.images || []).map((im) => ({ ...im, id: fix(im.id) })) });
    }
    for (const b of m.boilerplate || []) out.boilerplate.push({ ...b, file: idMap.get(b.file) || b.file });
    out.errors.push(...(m.errors || []));
    out.warnings.push(...(m.warnings || []));
    if (!Object.keys(out.design).length && m.design && Object.keys(m.design).length) out.design = { ...m.design };
    else if (m.design?.colors && !out.design.colors) out.design = { ...m.design, ...out.design };
    if (!Object.keys(out.meta).length && m.meta) out.meta = { ...m.meta };
    if (m.generator && !out.generator.includes(m.generator)) out.generator = [...new Set([out.generator, m.generator])].join('+');
  }
  linkRenderSources(out);
  // 슬라이드 자료를 앞으로(표지·차례 감지를 위해)
  const order = (f) => (f.type === 'pptx' ? 0 : f.type === 'pdf' ? 1 : f.type === 'link' ? 3 : 2);
  const fileOrder = new Map([...out.files].sort((a, b) => order(a) - order(b)).map((f, i) => [f.id, i]));
  out.files.sort((a, b) => fileOrder.get(a.id) - fileOrder.get(b.id));
  out.pages.sort((a, b) => (fileOrder.get(a.file) ?? 9) - (fileOrder.get(b.file) ?? 9) || a.page - b.page);
  if (opts.detect !== false && out.pages.length) {
    try { out.detected = detect(out, opts); } catch (e) { out.warnings.push(makeError('parse-failed', { detail: 'detect: ' + (e && e.message) })); }
  }
  return out;
}

/**
 * 같은 교재의 PPTX와 PDF(내보내기본)를 함께 올린 경우: PDF를 PPTX의 '쪽 그림 원본'으로 표시(renderOf)하고
 * 감지에서는 빼서 내용이 두 번 세어지지 않게 합니다. 웹앱은 이 PDF로 쪽 그림을 그리면 됩니다.
 */
export function linkRenderSources(m) {
  const decks = m.files.filter((f) => f.type === 'pptx');
  for (const pdf of m.files.filter((f) => f.type === 'pdf' && !f.renderOf)) {
    const pdfPages = m.pages.filter((p) => p.file === pdf.id);
    for (const deck of decks) {
      const deckPages = m.pages.filter((p) => p.file === deck.id);
      const visible = deckPages.filter((p) => !p.hidden);
      if (!(pdfPages.length === deckPages.length || pdfPages.length === visible.length) || !pdfPages.length) continue;
      const src = pdfPages.length === deckPages.length ? deckPages : visible;
      let same = 0, total = 0;
      src.forEach((p, i) => {
        const a = textKey(p.title), b = textKey(pdfPages[i].title + ' ' + (pdfPages[i].paragraphs || []).slice(0, 2).map((x) => x.text).join(' '));
        if (!a) return;
        total++;
        if (b.includes(a) || a.includes(textKey(pdfPages[i].title)) && textKey(pdfPages[i].title)) same++;
      });
      if (total && same / total >= 0.6) {
        pdf.renderOf = deck.id;
        deck.renderSource = pdf.id;
        if (pdfPages.length !== deckPages.length) pdf.skipsHidden = true;
        break;
      }
    }
  }
}

/** 붙여 넣은 글(또는 마크다운)로 Material 만들기 */
export function ingestText(text, opts = {}) {
  const mat = emptyMaterial();
  const name = opts.name || '붙여넣은 글.txt';
  const id = opts.id || 'doc1';
  const warn = (code, data) => mat.warnings.push(makeError(code, data, name));
  try {
    const res = parseText(String(text || ''), { fileId: id, opts, limits: { ...DEFAULT_LIMITS, ...(opts.limits || {}) }, warn }, { markdown: !!opts.markdown });
    mat.files.push({ id, name, type: opts.markdown ? 'md' : 'txt', size: String(text || '').length, pages: res.pages.length, unit: 'section' });
    mat.pages = res.pages;
    postProcess(mat, mat.files[0]);
    if (!mat.pages.length) mat.errors.push(makeError('empty', {}, name));
  } catch (e) { mat.errors.push(toUserError(e, name)); }
  if (opts.detect !== false && mat.pages.length) mat.detected = detect(mat, opts);
  return mat;
}

/** 공유 링크 → 내려받을 수 있는 주소(구글 슬라이드·문서는 PPTX·DOCX 내보내기) */
export function exportUrlFor(url) {
  const u = cleanUrl(url);
  if (!u) return null;
  let m = /docs\.google\.com\/presentation\/d\/([\w-]{10,})/.exec(u);
  if (m) return { url: `https://docs.google.com/presentation/d/${m[1]}/export/pptx`, name: 'google-slides.pptx' };
  m = /docs\.google\.com\/document\/d\/([\w-]{10,})/.exec(u);
  if (m) return { url: `https://docs.google.com/document/d/${m[1]}/export?format=docx`, name: 'google-docs.docx' };
  m = /drive\.google\.com\/file\/d\/([\w-]{10,})/.exec(u);
  if (m) return { url: `https://drive.google.com/uc?export=download&id=${m[1]}`, name: 'drive-file' };
  if (/\.(pptx|pdf|docx|hwpx|txt|md)(?:[?#]|$)/i.test(new URL(u).pathname)) return { url: u, name: decodeURIComponent(baseName(new URL(u).pathname)) };
  return null;
}

/**
 * 링크로 교재 받기. 구글 슬라이드·문서(공개)·파일 주소는 내려받아 해석하고,
 * 못 받으면(브라우저 CORS, 비공개 등) 링크만 담은 Material과 안내 경고를 돌려줍니다.
 */
export async function ingestUrl(url, opts = {}) {
  const u = cleanUrl(url);
  if (!u) { const m = emptyMaterial(); m.errors.push(makeError('bad-url', {}, String(url || ''))); return m; }
  const ex = exportUrlFor(u);
  const fetcher = opts.fetch || globalThis.fetch;
  let fetchFailed = false;
  if (ex && fetcher) {
    try {
      const res = await fetcher(ex.url, { redirect: 'follow' });
      if (res && res.ok) {
        const len = +res.headers?.get?.('content-length') || 0;
        if (len && len > (opts.maxBytes || DEFAULT_LIMITS.maxBytes)) throw new Error('too large');
        const buf = new Uint8Array(await res.arrayBuffer());
        let name = ex.name;
        const cd = res.headers?.get?.('content-disposition') || '';
        const fm = /filename\*=UTF-8''([^;]+)|filename="([^"]+)"/i.exec(cd);
        if (fm) { try { name = decodeURIComponent(fm[1] || fm[2]); } catch { /* 그대로 */ } }
        if (name === 'drive-file') name = sniff(buf) === 'pdf' ? 'drive-file.pdf' : 'drive-file.pptx';
        const m = await ingestFile(name, buf, opts);
        if (!m.errors.length) { m.files[0].url = u; return m; }
      }
      fetchFailed = true;
    } catch { fetchFailed = true; }
  }
  const mat = emptyMaterial();
  const tool = toolForUrl(u);
  const id = opts.id || 'link1';
  const label = tool ? tool.name : hostOf(u);
  mat.files.push({ id, name: label, type: 'link', url: u, size: 0, pages: 1, unit: 'link' });
  mat.pages.push({ file: id, page: 1, kind: 'link', title: label, paragraphs: [], notes: '', links: [{ url: u, label }], images: [], tables: [] });
  mat.warnings.push(makeError(fetchFailed ? 'link-fetch-failed' : 'link-only', {}, u));
  if (opts.detect !== false) mat.detected = detect(mat, opts);
  return mat;
}

/** 그림 파일 이름(바이트를 쓸 때 공통 규칙): <image.id>.<확장자> */
export function imageFileName(im) {
  const ext = (extOf(im.name || im.path || '') || (im.mime || '').split('/')[1] || 'bin').replace('jpeg', 'jpg');
  return `${im.id}.${ext}`;
}

/**
 * JSON으로 저장할 수 있는 모양으로 복사(그림 바이트 제거).
 * imageSrc(im) → 문자열을 주면 image.src에 넣습니다.
 */
export function materialToJSON(material, { imageSrc } = {}) {
  const orig = new Map();
  if (imageSrc) for (const p of material.pages || []) for (const im of p.images || []) orig.set(im.id, im);
  const copy = JSON.parse(JSON.stringify(material, (k, v) => (k === 'bytes' ? undefined : v)));
  if (imageSrc) for (const p of copy.pages || []) for (const im of p.images || []) { const s = imageSrc(orig.get(im.id) || im); if (s) im.src = s; }
  return copy;
}

/** 사람이 읽는 한 줄 요약 */
export function summarizeMaterial(m) {
  const d = m.detected || {};
  const parts = (m.files || []).map((f) => `${f.name}(${f.pages}${UNIT_KO[f.unit] || '쪽'})`);
  const bits = [];
  if (d.event?.date) bits.push(`일시 ${d.event.date}${d.event.start ? ' ' + d.event.start + (d.event.end ? '~' + d.event.end : '') : ''}`);
  if (d.prompts?.length) bits.push(`프롬프트 ${d.prompts.length}개`);
  if (d.steps?.length) bits.push(`실습 단계 ${d.steps.length}묶음`);
  if (d.tools?.length) bits.push(`도구 ${d.tools.slice(0, 5).map((t) => t.name).join('·')}${d.tools.length > 5 ? ` 외 ${d.tools.length - 5}` : ''}`);
  if (d.practice) bits.push(`실습 비율 ${Math.round(d.practice.ratio * 100)}%`);
  return `${parts.join(', ')}${bits.length ? ' — ' + bits.join(', ') : ''}`;
}

export { detect } from './detect.js';
export { materialToDraft } from './draft.js';
export { materialToAIContext } from './outline.js';
export { TOOLS, CATEGORIES, matchToolsInText, toolForUrl, getTool, findTool } from './tools-db.js';
export { parseKoreanDates, parseTimeRange } from './detect.js';
export { normText, normLine, makeError, sizeLabel, DEFAULT_LIMITS, loadPdfjs };
export { ingestPaths, runIngestCli, writeMaterial } from './cli.js';
