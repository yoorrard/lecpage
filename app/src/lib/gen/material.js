// 교재 건네기: AI가 원본을 직접 읽게.
// - PDF: 원본 파일(blobs 'src/*')을 그대로(두 회사 모두 받음)
// - PPT·워드·한글·키노트: lecpage 커넥트가 이 PC의 프로그램(PowerPoint·한글·Keynote·LibreOffice)으로 만든 PDF가 있으면 그 PDF를 원본처럼(blobs 'conv/*')
//   없으면 브라우저 안에서 그린 쪽 그림(PPTX·DOCX, render-doc.js) + 보조 글자, 그것도 없으면 보조 글자 + "PDF로 저장해 넣으면 더 정확해요"
// - 같은 이름의 PDF를 함께 넣은 PPT·워드·한글: 그 PDF가 원본으로 감(발표자 노트만 보조 글자로)
// - 보조 글자: 코드가 뽑은 글. 원본을 보내지 못한 교재의 쪽만 담음(원본으로 보낸 PDF의 글은 넣지 않음: 원본과 어긋난 글이 섞이지 않게)
// - 회사별 크기 한도를 넘으면 쪽을 골라 그림으로 담고 알림(level이 오를수록 더 작게: 'too-long' 오류가 오면 job이 level을 올려 다시)
// 사이트용 교재 쪽 그림은 blobs 'site/material/p-NNN.webp'(이미 만든 assets/slides/*를 옮기거나 PDF에서 새로 그림, 긴 변 1,600px)
// 교재가 여럿이면 교재마다 그린 쪽 그림을 이어서 번호를 매김(project.slideSets, slide-sets.js). 교재가 하나면 예전과 같음(1번부터)
import { blobs } from '../db.js';
import { materialToAIContext } from '@engine/src/ingest/outline.js';
import { LIMITS, pdfPageLimit } from './providers/index.js';
import { slideSetsOf, setsWithin, setsEnd, setFor, numOf, pickFromSets, pickPages } from './slide-sets.js';

export { pickPages };

const OFFICE = new Set(['pptx', 'ppsx', 'docx', 'ppt', 'doc', 'odt', 'odp', 'key']);
const baseOf = (name) => String(name || '').replace(/\.[^.]+$/, '').toLowerCase();
export const SITE_MATERIAL = 'site/material/';
const pageName = (n, ext = 'webp') => `p-${String(n).padStart(3, '0')}.${ext}`;
const extOf = (name) => (String(name || '').split('.').pop() || '').toLowerCase();
const sizeOf = (v) => (v == null ? 0 : typeof v === 'string' ? v.length : v.byteLength ?? v.size ?? 0);
const toBytes = async (v) => (v instanceof Blob ? new Uint8Array(await v.arrayBuffer()) : v);

/** 교재 파일 목록(사진 줄·읽지 못한 파일 빼고) */
export function sourceFiles(project) {
  return (project.files || []).filter((f) => f.key && !f.photos && !(f.errors || []).length);
}

/**
 * 사이트용 교재 쪽 그림 준비 → { list: ['material/p-001.webp', …], from: 파일 이름(교재 하나의 것일 때), sets: [{ name, first, count }] }
 * assets/slides/(교재를 넣을 때 그린 것, 교재마다 이어서 번호)가 있으면 옮기고, 없으면 첫 PDF를 새로 그림(최대 400쪽).
 * 고치기에서는 이미 있는 것을 그대로 쓰고, 새로 만들 때(refresh)는 교재를 바꿨을 수 있어 지금 교재의 쪽 그림으로 다시 옮김
 * sets: 놓인 쪽 그림이 어느 교재의 몇 번부터 몇 장인지(모르면 []). 교재를 더 넣기 전에 만든 사이트면 그때 옮긴 교재만
 */
export async function preparePageImages(pid, project, { signal, onProgress, refresh = false } = {}) {
  const keys = await blobs.keys(pid).catch(() => []);
  const have = keys.filter((k) => k.startsWith(SITE_MATERIAL)).sort();
  // 새로 그릴 때 쓸 PDF: 교재 PDF 또는 커넥트가 만든 PDF(쪽 수가 가장 많은 것)
  const pdf = sourceFiles(project).map((f) => (f.ext === 'pdf' ? f : f.pdf?.key ? { ...f, key: f.pdf.key } : null)).filter(Boolean).sort((a, b) => (b.pages || 0) - (a.pages || 0))[0];
  const known = slideSetsOf(project);
  const names = new Set(sourceFiles(project).map((f) => f.name));
  // 묶음을 적는 연수면 묶음의 끝 번호까지만(그 뒤 번호는 읽다 만 교재의 것)
  const slides = keys.filter((k) => /^assets\/slides\/slide-\d+\.(webp|png|jpg)$/.test(k) && (!Array.isArray(project.slideSets) || numOf(k) <= setsEnd(known))).sort();
  // 새로 만들 때: 지금 교재(쪽 그림이나 PDF)로 다시 옮김. 교재를 PDF로 바꿨으면 assets/slides가 비어 있어 예전 쪽 그림이 남던 것도 함께.
  // 지금 교재에서 쪽 그림을 만들 수 없고 예전 그림을 만든 교재도 빠졌으면 예전 그림을 비움(다른 교재의 쪽이 사이트에 들어가지 않게)
  if (refresh && have.length && (slides.length || pdf)) { await blobs.removePrefix(pid, SITE_MATERIAL); return preparePageImages(pid, project, { signal, onProgress }); }
  const ownerGone = (project.slidesFrom && !names.has(project.slidesFrom)) || (known.length > 1 && !known.some((s) => names.has(s.name)));
  if (refresh && have.length && ownerGone) { await blobs.removePrefix(pid, SITE_MATERIAL); return { list: [], from: '', sets: [] }; }
  if (have.length) {
    const list = have.map((k) => k.slice(5));
    const nums = list.map(numOf).filter(Boolean);
    const within = setsWithin(known, nums);
    // 교재 하나의 것(또는 묶음을 모르는 예전 연수)은 예전처럼 그 교재 이름, 여러 교재의 것이면 이름 하나로 말하지 않음
    const from = within.length === 1 ? within[0].name : within.length > 1 || known.length > 1 ? '' : project.slidesFrom || pdf?.name || '';
    const sets = within.length ? within : from && nums.length ? [{ name: from, first: 1, count: Math.max(...nums) }] : [];
    return { list, from, sets };
  }
  if (slides.length) {
    for (const k of slides) {
      const n = +/slide-(\d+)/.exec(k)[1]; const ext = extOf(k);
      const v = await blobs.get(pid, k);
      if (v) await blobs.put(pid, SITE_MATERIAL + pageName(n, ext), v);
    }
    return preparePageImages(pid, project, { signal });
  }
  if (!pdf) return { list: [], from: '', sets: [] };
  const bytes = await toBytes(await blobs.get(pid, pdf.key).catch(() => null));
  if (!bytes || !bytes.byteLength) return { list: [], from: '', sets: [] };
  const ing = await import('../ingest.js');
  const shots = await ing.renderSlides(bytes.slice(), onProgress, signal);
  for (const s of shots) await blobs.put(pid, SITE_MATERIAL + pageName(s.page, s.type === 'image/png' ? 'png' : s.type === 'image/jpeg' ? 'jpg' : 'webp'), s.blob);
  const list = (await blobs.keys(pid)).filter((k) => k.startsWith(SITE_MATERIAL)).sort().map((k) => k.slice(5));
  const last = list.reduce((n, x) => Math.max(n, numOf(x)), 0);
  return { list, from: pdf.name, sets: last ? [{ name: pdf.name, first: 1, count: last }] : [] };
}

/** 교재 해석 결과 중 names(파일 이름) 교재의 쪽만 보조 글자로. 이름이 하나도 맞지 않으면 '' */
export function helperText(material, names, maxChars) {
  if (!material || !names.length) return '';
  const want = new Set(names.map((n) => String(n).toLowerCase()));
  const files = (material.files || []).filter((f) => want.has(String(f.name || '').toLowerCase()));
  const ids = new Set(files.map((f) => f.id));
  if (!ids.size) return '';
  try { return materialToAIContext({ ...material, files, pages: (material.pages || []).filter((p) => ids.has(p.file)) }, { maxChars, header: false }); } catch { return ''; }
}

/** names 교재의 발표자 노트만(교재 자체는 PDF로 보냈을 때: 노트는 PDF에 없음) */
export function notesText(material, names, maxChars) {
  if (!material || !names.length) return '';
  const want = new Set(names.map((n) => String(n).toLowerCase()));
  const ids = new Map((material.files || []).filter((f) => want.has(String(f.name || '').toLowerCase())).map((f) => [f.id, f.name]));
  const out = [];
  for (const p of material.pages || []) if (ids.has(p.file) && String(p.notes || '').trim()) out.push(`- ${ids.get(p.file)} ${p.page}쪽 발표자 노트: ${String(p.notes).trim().replace(/\s+/g, ' ')}`);
  return out.join('\n').slice(0, maxChars);
}

/**
 * names 교재에 걸린 링크 주소 가운데 그 쪽 글에 주소가 보이지 않는 것(글자·단추·그림에 걸린 링크). '- 파일 3쪽: 이름 → 주소' 줄들.
 * 규칙은 커넥트 길의 work/links.md(skills/lecpage/scripts/kit-cmds.mjs hiddenLinks·linksMd)와 같음. 같은 교재의 PDF 짝은 한 번만
 */
export function linksText(material, names, maxChars = 8000) {
  if (!material || !names.length) return '';
  const want = new Set(names.map((n) => String(n).toLowerCase()));
  const files = new Map((material.files || []).filter((f) => want.has(String(f.name || '').toLowerCase())).map((f) => [f.id, f]));
  const out = []; const seen = new Set();
  for (const p of material.pages || []) {
    const f = files.get(p.file); if (!f) continue;
    const text = [p.title, ...(p.paragraphs || []).map((x) => (typeof x === 'string' ? x : x?.text || '')), ...(p.tables || []).flatMap((t) => (t.rows || []).map((r) => (Array.isArray(r) ? r.join(' | ') : '')))].filter(Boolean).join('\n');
    for (const l of p.links || []) {
      const url = String(l?.url || '').trim();
      if (!url || l.from === 'text' || text.includes(url)) continue;
      const key = `${baseOf(f.name)}|${p.page}|${url}`; if (seen.has(key)) continue; seen.add(key);
      const label = String(l.label || '').replace(/\s+/g, ' ').trim();
      out.push(`- ${f.name} ${f.unit === 'section' ? `${p.page}번째 부분` : `${p.page}쪽`}: ${label && label !== url ? `${label} → ${url}` : url}`);
    }
  }
  let s = '';
  for (const row of out) { if (s.length + row.length + 1 > maxChars) break; s += (s ? '\n' : '') + row; }
  return s;
}

/**
 * 한 작업에서 단계마다 똑같이 쓰는 교재 꾸러미. level: 0 원본 우선, 1 쪽 그림 위주(원본이 크거나 'too-long'), 2 더 적은 쪽 그림 + 글
 * siteSets: 쪽 그림이 어느 교재의 몇 번부터 몇 장인지(preparePageImages의 sets). 교재가 여럿이면 쪽 그림으로 보낼 교재마다 한도를 고르게 나눠 고름
 * @returns {Promise<{ parts, files, siteImages, siteImagesFrom, siteSets, sentPages, text, links, notes, level, bytes }>}
 */
export async function packMaterial(pid, project, { provider, model = '', level = 0, siteImages = [], siteImagesFrom = '', siteSets = null, intro } = {}) {
  const L = LIMITS[provider] || LIMITS.openai;
  const notes = []; const files = []; const parts = []; let bytes = 0; let images = 0;
  const src = sourceFiles(project);
  const pdfNames = new Set(src.filter((f) => f.ext === 'pdf').map((f) => baseOf(f.name)));
  // 쪽 그림 묶음(교재마다 이어 매긴 번호). 묶음을 모르면(예전 연수·AI 에이전트가 만든 연수) 예전처럼 모든 쪽 그림을 한 묶음으로 봄
  const byNum = new Map(siteImages.map((x) => [numOf(x), x]).filter(([n]) => n));
  const sets = siteSets?.length ? siteSets : siteImagesFrom && siteImages.length ? [{ name: siteImagesFrom, first: 1, count: Math.max(0, ...byNum.keys()) }] : [];
  const whole = !sets.length && byNum.size ? { name: '', first: 1, count: Math.max(...byNum.keys()) } : null;
  const need = []; // 쪽 그림으로 보낼 교재: [{ row, set }]
  for (const f of src) {
    const ext = f.ext || extOf(f.name);
    const conv = ext !== 'pdf' && f.pdf?.key ? f.pdf : null; // 커넥트가 이 PC의 프로그램으로 만든 PDF
    const data = await blobs.get(pid, conv ? conv.key : f.key).catch(() => null);
    const size = sizeOf(data);
    const row = { name: f.name, pages: f.pages || 0, ext, sent: 'none', ...(conv ? { via: conv.app || '변환기' } : {}) };
    files.push(row);
    if (!data || !size) { row.sent = 'text'; continue; }
    if (ext === 'pdf' || conv) {
      const okSize = size <= L.pdfBytes && bytes + size <= L.totalBytes;
      const okPages = !f.pages || f.pages <= pdfPageLimit(provider, model);
      if (level === 0 && okSize && okPages) { parts.push({ kind: 'pdf', data, name: conv ? f.name.replace(/\.[^.]+$/, '') + '.pdf' : f.name }); bytes += size; row.sent = 'original'; continue; }
      // 이 교재의 쪽 그림이 있으면 그 그림으로, 없으면(다른 교재의 쪽 그림만 있음) 글자로
      const set = setFor(sets, f.name) || whole;
      const how = set ? '쪽 그림으로 보냈어요.' : '글자만 보냈어요.';
      if (set) { row.sent = 'images'; need.push({ row, set }); } else row.sent = 'text';
      notes.push(level === 0 ? `${f.name}: 파일이 커서(${Math.round(size / 1e6)}MB${f.pages ? `·${f.pages}쪽` : ''}) ${how}` : `${f.name}: AI 회사가 한 번에 받는 크기를 넘어 ${how}`);
      continue;
    }
    if (pdfNames.has(baseOf(f.name))) { row.sent = 'twin'; continue; } // 같은 교재의 PDF본이 원본(또는 쪽 그림)으로 감
    // 브라우저 안에서 그린 쪽 그림(PPTX·DOCX·한글)이 이 교재의 것이면 그 그림 + 보조 글자
    const own = sets.find((x) => x.name === f.name);
    if (own) { row.sent = 'images'; need.push({ row, set: own }); continue; }
    row.sent = 'text';
    if (OFFICE.has(ext) || /^hw/.test(ext)) notes.push(`${f.name}: 글자만 보냈어요. PDF로 저장해 함께 넣으면 그림까지 읽어 더 정확해요.`);
  }
  // 쪽 그림: 원본을 못 보낸 PDF나 브라우저 안에서 그린 PPTX·DOCX가 있을 때, 한도 안에서 쪽을 골라.
  // 그런 교재가 여럿이면 한도(장수·크기)를 교재마다 고르게 나눔(쪽이 적은 교재는 다 넣고 남는 몫을 쪽이 많은 교재에)
  const sentPages = [];
  const uniq = [...new Set(need.map((x) => x.set))];
  if (uniq.length && byNum.size) {
    let cap = Math.min(L.images, level >= 2 ? 12 : 60);
    const cache = new Map();
    const load = async (n) => { if (!cache.has(n)) cache.set(n, byNum.has(n) ? await blobs.get(pid, 'site/' + byNum.get(n)).catch(() => null) : null); return cache.get(n); };
    let picks = pickFromSets(uniq, cap);
    // 교재가 여럿인데 크기 한도를 넘으면 장수를 줄여 다시 고름(앞 교재만 들어가고 뒤 교재가 통째로 빠지지 않게)
    for (let i = 0; uniq.length > 1 && i < 6; i++) {
      let total = 0; for (const n of picks.flat()) total += sizeOf(await load(n));
      if (bytes + total <= L.totalBytes || cap <= uniq.length) break;
      cap = Math.max(uniq.length, Math.floor((cap * (L.totalBytes - bytes) * 0.95) / total));
      picks = pickFromSets(uniq, cap);
    }
    const sentOf = new Map(uniq.map((x) => [x, 0]));
    send: for (const [i, set] of uniq.entries()) {
      for (const n of picks[i]) {
        const path = byNum.get(n); if (!path) continue;
        const v = await load(n);
        const sz = sizeOf(v);
        if (!v || bytes + sz > L.totalBytes) break send;
        parts.push({ kind: 'image', data: v, mime: /\.png$/.test(path) ? 'image/png' : /\.jpe?g$/.test(path) ? 'image/jpeg' : 'image/webp', name: path });
        bytes += sz; images++; sentPages.push(n); sentOf.set(set, sentOf.get(set) + 1);
      }
    }
    if (sets.length < 2) { if (sentPages.length < siteImages.length) notes.push(`교재 ${siteImages.length}쪽 중 ${sentPages.length}쪽을 골라 그림으로 보냈어요.`); }
    else for (const set of uniq) {
      const k = sentOf.get(set);
      if (!k) { for (const x of need) if (x.set === set) x.row.sent = 'text'; notes.push(`${set.name}: 한 번에 보낼 수 있는 크기를 넘어 글자만 보냈어요.`); }
      else if (k < set.count) notes.push(`${set.name}: ${set.count}쪽 중 ${k}쪽을 골라 그림으로 보냈어요.`);
    }
  } else if (need.length) {
    for (const r of files) if (r.sent === 'images') r.sent = 'text';
  }
  // 보조 글자: 원본을 보내지 못한 교재(쪽 그림으로 보낸 PDF·PPTX, 글만 보낸 HWP 등)의 쪽만. 원본으로 보낸 교재는 AI가 원본을 읽음
  // 원본처럼 보낸 PPT(커넥트가 만든 PDF)·PDF본과 짝인 교재는 PDF에 없는 발표자 노트만
  const max = level >= 2 ? 12000 : 40000;
  const text = [helperText(project.material, files.filter((r) => r.sent === 'images' || r.sent === 'text' || r.sent === 'none').map((r) => r.name), max),
    notesText(project.material, files.filter((r) => r.sent === 'twin' || (r.sent === 'original' && r.ext !== 'pdf')).map((r) => r.name), Math.round(max / 4))].filter(Boolean).join('\n\n');
  // 글자·단추·그림에 걸린 링크 주소: 원본(PDF)으로 보낸 교재는 AI가 그 주소를 볼 수 없어 자료로 붙임(커넥트 길의 work/links.md와 같은 것).
  // 쪽 그림·글자로 보낸 교재의 링크는 위 보조 글자에 이미 있음
  const links = linksText(project.material, files.filter((r) => r.sent === 'original' || r.sent === 'twin').map((r) => r.name), level >= 2 ? 3000 : 8000);
  const pack = { parts, files, siteImages, siteImagesFrom, siteSets: sets, sentPages, text, links, notes, level, bytes, images };
  // 교재 앞부분 글(단계마다 같음) → 마지막에 캐시 표시
  if (intro) parts.push({ kind: 'text', text: intro(pack), cache: true });
  return pack;
}
