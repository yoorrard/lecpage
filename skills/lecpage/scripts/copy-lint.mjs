#!/usr/bin/env node
// 문구 점검: 설계도(JSON)나 만든 사이트(폴더·HTML)에서 AI 티가 나는 말투, 흔한 용어 풀어쓰기, 긴 버튼·메뉴 이름을 찾습니다.
// 쓰는 법: node scripts/copy-lint.mjs <설계도.json | 사이트 폴더 | 파일.html> [--json] [--strict]
//   종료 코드: error가 있으면 1(--strict면 warn도 1), 없으면 0
// 규칙은 engine/src/prompt/copy-rules.js 한 곳에서 관리합니다(AI 프롬프트와 같은 목록).
import { readFileSync, statSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const { lintText } = await import(pathToFileURL(join(HERE, '..', 'engine', 'src', 'prompt', 'copy-rules.js')).href);
const { textKey } = await import(pathToFileURL(join(HERE, '..', 'engine', 'src', 'ingest', 'util.js')).href);

// ── 글의 출처: 교재 원문(고쳐 쓰지 않음 → 세지 않음) · 설계도(patch로 고침) · 엔진 고정 문구(설계도로 못 고침 → 알림만) ──
const KEYS = new WeakMap();
const strings = (v, out = []) => { if (typeof v === 'string') out.push(v); else if (Array.isArray(v)) v.forEach((x) => strings(x, out)); else if (v && typeof v === 'object') Object.values(v).forEach((x) => strings(x, out)); return out; };
/** 교재 해석(work/material.json)의 글: 문단·표·노트 */
function materialKey(m) {
  if (!m || typeof m !== 'object') return '';
  if (!KEYS.has(m)) KEYS.set(m, textKey(strings((m.pages || []).map((p) => [p.title, (p.paragraphs || []).map((x) => x.text), p.tables, p.notes])).join('\n')));
  return KEYS.get(m);
}
/** 설계도의 글(마크다운 표시는 떼고: 쪽에는 글자만 보임) */
function blueprintKey(bp) {
  if (!bp || typeof bp !== 'object') return '';
  if (!KEYS.has(bp)) KEYS.set(bp, textKey(strings({ meta: bp.meta, instructors: bp.instructors, sections: bp.sections }).join('\n').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_#>|]/g, '')));
  return KEYS.get(bp);
}
const sentenceOf = (line, hit) => line.split(/(?<=[.!?。])\s+/).find((x) => hit && x.includes(hit)) || line;
/**
 * 찾은 곳의 출처. 'material'이면 교재 원문(실습 단계·프롬프트 등)이라 세지 않음, 'engine'이면 설계도에 없는 엔진 고정 문구라 알림만.
 * src: { material, blueprint } (없으면 출처를 가리지 않음)
 */
export function ownerOf(line, hit, src = {}) {
  const k = textKey(sentenceOf(line, hit));
  if (k.length < 4) return '';
  const mk = materialKey(src.material), bk = blueprintKey(src.blueprint);
  if (mk && mk.includes(k)) return 'material';
  if (bk && !bk.includes(k)) return 'engine';
  return '';
}

// 교재 원문을 그대로 옮기는 칸(프롬프트·교재 쪽 글·강사 약력·강사 메모)은 점검하지 않음
const SKIP = /(^|\.)(slides|instructors|sources|design|live|privacy|deploy|access|audience|archetype|_draft)(\.|\[|$)|prompts\[\d+\]\.text$|\.teacherNote$|\.prompts\[\d+\]$|\.(id|url|href|src|kind|type|tone|layout|photo|email|target|date|start|end|thumb|icon|status|style|value|code|joinUrl|siteUrl|shortUrl)$/;
function kindOf(path) {
  if (/\.nav$/.test(path)) return 'nav';
  if (/ctas\[\d+\]\.label$|links\[\d+\]\.label$/.test(path)) return 'cta';
  if (/\.(title|name|word|part|label)$/.test(path)) return 'title';
  return 'text';
}

function* walk(v, path = '') {
  if (typeof v === 'string') { yield [path, v]; return; }
  if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) yield* walk(v[i], `${path}[${i}]`); return; }
  if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) yield* walk(x, path ? `${path}.${k}` : k);
}

export function lintBlueprint(bp) {
  const out = [];
  for (const [path, text] of walk(bp)) {
    if (SKIP.test(path)) continue;
    for (const f of lintText(text, kindOf(path))) out.push({ where: path, ...f });
  }
  return out;
}

/**
 * 만든 페이지: 보이는 글자와 버튼·링크 이름만 뽑아 점검(교재 쪽 글·프롬프트 칸은 뺌).
 * src { material, blueprint }를 주면 교재에서 그대로 온 글은 빼고, 엔진 고정 문구는 owner: 'engine'(알림만)으로 표시
 */
export function lintHtml(html, file = 'index.html', src = {}) {
  const out = [];
  const push = (where, line, f) => { const owner = ownerOf(line, f.hit, src); if (owner !== 'material') out.push({ where, ...f, ...(owner ? { owner } : {}) }); };
  let s = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<textarea[\s\S]*?<\/textarea>/gi, '').replace(/<aside class="lp-dock"[\s\S]*?<\/aside>/gi, '').replace(/<figure class="lp-slide"[\s\S]*?<\/figure>/gi, '').replace(/<svg[\s\S]*?<\/svg>/gi, '');
  const ent = (t) => t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
  // 버튼·링크 이름은 짧아야 함. 단 색인·차례·일정 목록의 링크(<li> 하나를 통째로 채운 같은 쪽 링크)는 버튼이 아니라
  // 그 자리의 질문·제목을 옮겨 적은 것이라 길이를 보지 않음(질문·제목 글 자체는 아래 본문 점검에서 봄)
  for (const m of s.matchAll(/<(a|button)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    if (m[1].toLowerCase() === 'a' && /\bhref="#[^"]*"/i.test(m[0].slice(0, m[0].indexOf('>') + 1))
      && /<li\b[^>]*>\s*$/i.test(s.slice(Math.max(0, m.index - 120), m.index)) && /^\s*<\/li>/i.test(s.slice(m.index + m[0].length, m.index + m[0].length + 12))) continue;
    const t = ent(m[2].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    if (t && !/@|https?:|\.[a-z]{2,}\//i.test(t)) for (const f of lintText(t, 'cta')) if (f.why.includes('넘음')) push(`${file} <${m[1]}>`, t, { ...f, hit: f.hit });
  }
  const text = ent(s.replace(/<(br|\/p|\/li|\/h\d|\/dt|\/dd|\/div|\/summary|\/label|\/span|\/b|\/a|\/button)\b[^>]*>/gi, '\n').replace(/<[^>]+>/g, ' '));
  const seen = new Set();
  for (const line of text.split('\n').map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean)) {
    if (seen.has(line)) continue; seen.add(line);
    for (const f of lintText(line, 'text')) push(file, line, f);
  }
  return out;
}

function lintPath(p) {
  const st = statSync(p);
  if (st.isDirectory()) {
    const pages = readdirSync(p).filter((f) => /^(index|console|screen|check|poster)\.html$/.test(f));
    // make가 만든 사이트면 옆의 work/에서 교재 해석·설계도를 읽어 교재 원문은 빼고 봄
    const w = join(p, '..', 'work'); const rd = (f) => { try { return JSON.parse(readFileSync(join(w, f), 'utf8')); } catch { return null; } };
    const src = existsSync(join(w, 'material.json')) ? { material: rd('material.json'), blueprint: rd('blueprint.json') } : {};
    return pages.flatMap((f) => lintHtml(readFileSync(join(p, f), 'utf8'), f, src));
  }
  if (extname(p) === '.json') { const j = JSON.parse(readFileSync(p, 'utf8')); return lintBlueprint(j.blueprint || j); }
  return lintHtml(readFileSync(p, 'utf8'), p.split(/[\\/]/).pop());
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const target = args.find((a) => !a.startsWith('--'));
  if (!target) { console.error('쓰는 법: node scripts/copy-lint.mjs <설계도.json | 사이트 폴더 | 파일.html> [--json] [--strict]'); process.exit(2); }
  const found = lintPath(target);
  if (args.includes('--json')) console.log(JSON.stringify(found, null, 2));
  else if (!found.length) console.log('문구 점검: 고칠 곳이 없어요.');
  else {
    for (const f of found) console.log(`${f.owner === 'engine' ? '알림' : f.level === 'error' ? '고침' : '살핌'}  ${f.where}  "${f.hit}"  ${f.why} → ${f.fix}`);
    const mine = found.filter((f) => f.owner !== 'engine');
    const e = mine.filter((f) => f.level === 'error').length;
    console.log(`\n고칠 곳 ${e}개, 살필 곳 ${mine.length - e}개${found.length > mine.length ? `, 엔진 고정 문구 알림 ${found.length - mine.length}개(설계도로 못 고침)` : ''}`);
  }
  const bad = found.some((f) => f.owner !== 'engine' && (f.level === 'error' || (args.includes('--strict') && f.level === 'warn')));
  process.exit(bad ? 1 : 0);
}
