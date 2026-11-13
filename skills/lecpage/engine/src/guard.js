// 교재 지킴이: AI가 짠 설계도를 같은 교재로 만든 엔진 초안과 견줘, 교재에서 그대로 옮겨야 하는 것이 바뀌거나 빠졌으면 교재대로 되돌립니다.
// 어떤 AI로 만들든(키 연결·쓰던 AI 창·AI 에이전트) 답을 받은 뒤 이 함수를 거치면 교재 글은 엔진이 지킵니다.
//
//   지키는 것: 프롬프트 원문 · 실습 단계 · 일정 시간·제목 · FAQ 질문·답 · 연수 목표 문장 · 교재의 링크 주소(교재에 없는 주소는 뺌)
//   따르는 것(건드리지 않음): 섹션 순서·구성, 제목·소개·설명·확인 문장·막힐 때 메모(title·lead·desc·outcome·note), 디자인·컨셉
//   빠진 칸(목표·일정·실습·FAQ)은 초안 순서를 보고 알맞은 자리에 넣습니다. 프롬프트 모음은 실습 칸에 없는 프롬프트가 있을 때만 다시 넣습니다.
//
// guardMaterial(bp, draft, { material, allowUrls }) → { blueprint, restored }
//   restored: [{ id, kind, where, before, after, quiet, loc, op, item }]
//     kind: goal·schedule·faq·step·prompt·link·station·section · quiet: 다른 칸과 같은 목록을 채운 것(알림에 세지 않음)
//     before: AI 답의 값('' = 없었음) · after: 교재 값('' = 뺌)
// undoRestore(bp, r): 그곳만 AI 답으로 되돌림(강사가 고친 다른 곳은 그대로)
import { withSectionIds } from './patch.js';
import { SECTION_DEFS } from './schema/sections.js';

const norm = (s) => String(s ?? '').toLowerCase().replace(/[\s"'“”‘’「」『』.,·:;!?()[\]{}<>|/\\*_~`=+\-–—…•※①-⑳]+/g, '');
const clone = (x) => (x === undefined ? x : JSON.parse(JSON.stringify(x)));
const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
const arr = (x) => (Array.isArray(x) ? x : []);
const cut = (s, n = 60) => { const t = String(s ?? '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };

function bigrams(s) { const m = new Map(); for (let i = 0; i < s.length - 1; i++) { const k = s.slice(i, i + 2); m.set(k, (m.get(k) || 0) + 1); } return m; }
/** 글자 두 개씩 묶어 견준 닮은 정도(0~1) */
export function similarity(a, b) {
  a = norm(a); b = norm(b);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const A = bigrams(a), B = bigrams(b); let inter = 0;
  for (const [k, n] of A) inter += Math.min(n, B.get(k) || 0);
  return (2 * inter) / (a.length + b.length - 2);
}
const same = (a, b) => norm(a) === norm(b) && norm(a) !== '';
/**
 * AI가 초안 글에서 짧은 줄(버튼 이름 같은 군더더기)만 앞뒤로 덜어 냈으면 같은 것으로 봄.
 * 예: 초안 "너는 … 써 줘.\n제미나이 열기" ↔ AI "너는 … 써 줘."
 */
function trimmedSame(d, a) {
  if (same(d, a)) return true;
  const dl = String(d ?? '').split('\n').map(norm).filter(Boolean); const A = norm(a);
  if (!A || dl.length < 2) return false;
  for (let i = 0; i < dl.length; i++) {
    for (let j = i; j < dl.length; j++) {
      if (dl.slice(i, j + 1).join('') !== A) continue;
      if ([...dl.slice(0, i), ...dl.slice(j + 1)].every((x) => x.length <= 24)) return true;
    }
  }
  return false;
}

/**
 * 두 목록 짝짓기: ① 똑같은 것(순서 무관) ② 닮은 것(score ≥ th, 높은 것부터) ③ 남은 것은 짝지은 이웃 사이 같은 자리끼리(닮음 ≥ 0.12)
 * @returns {{ pair: Map<number,number>, exact: Set<number> }} pair: 초안 번호 → AI 번호
 */
function alignList(D, A, { eq, score, th = 0.35 }) {
  const pair = new Map(); const usedA = new Set(); const exact = new Set();
  D.forEach((d, i) => { const j = A.findIndex((a, k) => !usedA.has(k) && eq(d, a)); if (j >= 0) { pair.set(i, j); usedA.add(j); exact.add(i); } });
  const cands = [];
  D.forEach((d, i) => { if (pair.has(i)) return; A.forEach((a, j) => { if (usedA.has(j)) return; const s = score(d, a); if (s >= th) cands.push([s, i, j]); }); });
  cands.sort((x, y) => y[0] - x[0]);
  for (const [, i, j] of cands) if (!pair.has(i) && !usedA.has(j)) { pair.set(i, j); usedA.add(j); }
  D.forEach((d, i) => {
    if (pair.has(i)) return;
    let lo = -1, hi = A.length;
    for (let k = i - 1; k >= 0; k--) if (pair.has(k)) { lo = pair.get(k); break; }
    for (let k = i + 1; k < D.length; k++) if (pair.has(k)) { hi = pair.get(k); break; }
    for (let j = lo + 1; j < hi; j++) if (!usedA.has(j) && score(d, A[j]) >= 0.12) { pair.set(i, j); usedA.add(j); break; }
  });
  return { pair, exact };
}
/** 빠진 초안 항목을 넣을 자리: 바로 앞 초안 항목과 짝지은 AI 항목 다음(없으면 맨 앞) */
function insertAt(i, pair) { for (let k = i - 1; k >= 0; k--) if (pair.has(k)) return pair.get(k) + 1; return 0; }

// ── 주소 ──
const URL_RE = /https?:\/\/[^\s<>"'`)\]}]+/gi;
const normUrl = (u) => String(u || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[)\].,]+$/, '').replace(/\/+$/, '');
function collectStrings(v, out = []) {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => collectStrings(x, out));
  else if (isObj(v)) Object.values(v).forEach((x) => collectStrings(x, out));
  return out;
}
/** 교재·초안·강사 값에 있는 주소. 교재 글에 주소 없이 적힌 도메인(gemini.google.com에서…)도 그 자체로는 받음 */
function urlAllow(draft, material, extra) {
  const set = new Set(); const text = [];
  for (const s of collectStrings([draft, extra])) for (const m of s.match(URL_RE) || []) set.add(normUrl(m));
  for (const s of collectStrings(material)) { text.push(s.toLowerCase()); for (const m of s.match(URL_RE) || []) set.add(normUrl(m)); }
  const blob = text.join('\n');
  const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (u) => {
    const n = normUrl(u);
    if (!n || set.has(n)) return true;
    // 교재 글에 그 주소가 한 낱말로 적혀 있음(뒤에 /경로가 이어지는 더 긴 주소의 앞부분은 아님. padlet.com/우리보드 ≠ padlet.com)
    return n.length >= 6 && new RegExp(`(?:^|[\\s"'(<\\[])(?:https?://)?(?:www\\.)?${esc(n)}/?(?=$|[\\s"')>\\],.!?]|[가-힣])`).test(blob);
  };
}

// ── 칸 찾기·자리 ──
const TAIL = ['materials', 'followup', 'instructor', 'speakers', 'survey', 'closing'];
function placeSection(bp, draft, sec) {
  const order = arr(draft.sections).map((s) => s?.type);
  const k = order.indexOf(sec.type);
  for (let i = k - 1; i >= 0; i--) { const at = findLastIndex(bp.sections, (s) => s?.type === order[i]); if (at >= 0) { bp.sections.splice(at + 1, 0, sec); return; } }
  for (let i = k + 1; i < order.length; i++) { const at = bp.sections.findIndex((s) => s?.type === order[i]); if (at >= 0) { bp.sections.splice(at, 0, sec); return; } }
  const t = bp.sections.findIndex((s) => TAIL.includes(s?.type));
  bp.sections.splice(t < 0 ? bp.sections.length : t, 0, sec);
}
function findLastIndex(a, f) { for (let i = a.length - 1; i >= 0; i--) if (f(a[i])) return i; return -1; }
function uniqueId(bp, base) { const ids = new Set(bp.sections.map((s) => s?.id)); let id = base; let n = 2; while (ids.has(id)) id = `${base}-${n++}`; return id; }
const secName = (s, d) => s?.title || d?.title || SECTION_DEFS[s?.type]?.label || s?.type || '';

/**
 * @param {object} bp AI가 짠 설계도(JSON)
 * @param {object} draft 같은 교재로 엔진이 만든 초안(materialToDraft)
 * @param {{ material?: object, allowUrls?: string[], skip?: string[] }} o material: 교재 해석(주소 확인) · allowUrls: 강사가 넣은 주소 · skip: 되돌리지 않을 곳 id
 */
export function guardMaterial(bp, draft, { material = null, allowUrls = [], skip = [] } = {}) {
  if (!isObj(bp) || !Array.isArray(bp.sections) || !isObj(draft) || !Array.isArray(draft.sections)) return { blueprint: bp, restored: [] };
  const out = clone(bp);
  out.sections = withSectionIds(out.sections.filter(isObj));
  const restored = [];
  const skipSet = new Set(skip);
  /** 되돌린 곳 하나를 적고, skip에 든 곳이면 false(바꾸지 않음) */
  const note = (r) => { r.id = [r.kind, r.loc?.sec, r.loc?.item ?? '', r.loc?.list || '', r.loc?.key || '', norm(r.after || r.before).slice(0, 24)].join(':'); if (skipSet.has(r.id)) return false; restored.push(r); return true; };
  const dSec = (t) => draft.sections.filter((s) => s?.type === t);
  const aSec = (t) => out.sections.filter((s) => s?.type === t);

  // ── 연수 목표: 교재 문장 그대로 ──
  for (const ds of dSec('goals').slice(0, 1)) {
    const D = arr(ds.items).filter((x) => typeof x === 'string' && x.trim());
    if (!D.length) continue;
    let as = aSec('goals')[0];
    if (!as) {
      const sec = { ...clone(ds), id: uniqueId(out, ds.id || 'goals') };
      if (note({ kind: 'section', where: secName(ds), before: '', after: `${D.length}개`, op: 'section', loc: { sec: sec.id } })) placeSection(out, draft, sec);
      continue;
    }
    as.items = arr(as.items).filter((x) => typeof x === 'string');
    guardStrings(D, as.items, { sec: as.id, list: 'items', label: (i) => `${secName(as)} ${i + 1}`, kind: 'goal', keepExtra: true, note });
  }

  // ── 일정: 시각과 제목 ──
  for (const ds of dSec('schedule').slice(0, 1)) {
    const D = arr(ds.items).filter((x) => isObj(x) && (x.start || x.title));
    if (!D.length) continue;
    const as = aSec('schedule')[0];
    if (!as) {
      const sec = { ...clone(ds), id: uniqueId(out, ds.id || 'schedule') };
      if (note({ kind: 'section', where: secName(ds), before: '', after: `${D.length}줄`, op: 'section', loc: { sec: sec.id } })) placeSection(out, draft, sec);
      continue;
    }
    as.items = arr(as.items).filter(isObj);
    const A = as.items;
    const titleOk = (d, a) => {
      const dt = norm(d.title); if (!dt) return true;
      const t = norm(a.title), p = norm(a.part), x = norm(a.desc);
      return [t + p + x, p + t + x, t + x + p].some((c) => c.includes(dt)) || (t && dt.includes(t) && norm(p + x).includes(dt.replace(t, '')));
    };
    const { pair } = alignList(D, A, { eq: (d, a) => (d.start || '') === (a.start || '') && (d.end || '') === (a.end || '') && titleOk(d, a), score: (d, a) => (d.start && d.start === a.start ? 0.8 : 0) + similarity(d.title, a.title) * 0.6, th: 0.3 });
    const where = (d) => `${secName(as)} ${d.start || ''}${d.end ? '~' + d.end : ''}`.trim();
    // 바뀐 시각·제목
    for (const [i, j] of pair) {
      const d = D[i], a = A[j];
      if ((d.start || '') !== (a.start || '') || (d.end || '') !== (a.end || '')) {
        if (note({ kind: 'schedule', where: where(d) + ' · 시각', before: `${a.start || ''}~${a.end || ''}`, after: `${d.start || ''}~${d.end || ''}`, op: 'set', loc: { sec: as.id, list: 'items', key: 'start', index: j }, item: { start: a.start, end: a.end } })) { a.start = d.start; a.end = d.end; }
      }
      if (!titleOk(d, a)) {
        if (note({ kind: 'schedule', where: where(d) + ' · 내용', before: a.title || '', after: d.title, op: 'set', loc: { sec: as.id, list: 'items', key: 'title', index: j } })) {
          a.title = d.title;
          if (a.part && norm(d.title).includes(norm(a.part))) a.part = d.part || '';
        }
      }
    }
    // 교재에 없는 시각의 줄은 뺌(지어낸 일정)
    const times = new Set(D.map((d) => d.start).filter(Boolean));
    const keep = A.map((a, j) => [...pair.values()].includes(j) || !a.start || times.has(a.start) || !note({ kind: 'schedule', where: `${secName(as)} ${a.start}`, before: cut(a.title), after: '', op: 'remove', loc: { sec: as.id, list: 'items', index: j }, item: clone(a) }));
    // 빠진 줄은 시각 순서 자리에
    const add = D.map((d, i) => [d, i]).filter(([, i]) => !pair.has(i));
    as.items = A.filter((_, j) => keep[j]);
    for (const [d] of add) {
      if (!note({ kind: 'schedule', where: where(d), before: '', after: cut(d.title), op: 'insert', loc: { sec: as.id, list: 'items', key: 'title' } })) continue;
      const at = d.start ? as.items.findIndex((x) => x.start && x.start > d.start) : -1;
      as.items.splice(at < 0 ? as.items.length : at, 0, clone(d));
    }
  }

  // ── FAQ: 질문과 답 ──
  for (const ds of dSec('faq').slice(0, 1)) {
    const D = arr(ds.items).filter((x) => isObj(x) && x.q);
    if (!D.length) continue;
    const as = aSec('faq')[0];
    if (!as) {
      const sec = { ...clone(ds), id: uniqueId(out, ds.id || 'faq') };
      if (note({ kind: 'section', where: secName(ds), before: '', after: `${D.length}개`, op: 'section', loc: { sec: sec.id } })) placeSection(out, draft, sec);
      continue;
    }
    as.items = arr(as.items).filter(isObj);
    const A = as.items;
    const { pair } = alignList(D, A, { eq: (d, a) => same(d.q, a.q), score: (d, a) => Math.max(similarity(d.q, a.q), similarity(d.a, a.a) * 0.8) });
    for (const [i, j] of pair) {
      const d = D[i], a = A[j];
      if (!same(d.q, a.q) && note({ kind: 'faq', where: `${secName(as)} ${i + 1} · 질문`, before: a.q || '', after: d.q, op: 'set', loc: { sec: as.id, list: 'items', key: 'q', index: j } })) a.q = d.q;
      if (d.a && !same(d.a, a.a) && note({ kind: 'faq', where: `${secName(as)} ${i + 1} · 답`, before: a.a || '', after: d.a, op: 'set', loc: { sec: as.id, list: 'items', key: 'a', index: j } })) a.a = d.a;
    }
    D.forEach((d, i) => {
      if (pair.has(i)) return;
      if (!note({ kind: 'faq', where: `${secName(as)} ${i + 1}`, before: '', after: d.q, op: 'insert', loc: { sec: as.id, list: 'items', key: 'q' } })) return;
      const at = insertAt(i, pair); A.splice(at, 0, clone(d));
      for (const [k, j] of pair) if (j >= at) pair.set(k, j + 1);
      pair.set(i, at);
    });
  }

  // ── 실습: 단계·프롬프트·링크 ──
  const dItems = dSec('stations').flatMap((s) => arr(s.items).filter(isObj));
  if (dItems.length) {
    let stSecs = aSec('stations');
    if (!stSecs.length) {
      const ds = dSec('stations')[0];
      const sec = { ...clone(ds), id: uniqueId(out, ds.id || 'stations') };
      if (note({ kind: 'section', where: secName(ds), before: '', after: `${dItems.length}개`, op: 'section', loc: { sec: sec.id } })) placeSection(out, draft, sec);
    } else {
      const A = stSecs.flatMap((s) => { s.items = arr(s.items).filter(isObj); return s.items.map((it) => ({ it, sec: s })); });
      const pages = (x) => arr(x?.source?.pages).map(Number);
      const overlap = (d, a) => pages(d).some((p) => pages(a).includes(p));
      const body = (x) => [...arr(x.steps), ...arr(x.prompts).map((p) => p?.text)].join(' ');
      const { pair } = alignList(dItems, A.map((x) => x.it), {
        // 같은 id라도 쪽이나 제목이 다르면 다른 실습(AI가 번호를 다시 매긴 경우)
        eq: (d, a) => !!d.id && d.id === a.id && (overlap(d, a) || (!pages(d).length && !pages(a).length) || similarity(d.title, a.title) >= 0.6),
        score: (d, a) => Math.max(overlap(d, a) ? 0.9 : 0, similarity(d.title, a.title), similarity(body(d), body(a)) * 0.9),
        th: 0.3,
      });
      for (const [i, j] of pair) guardStation(dItems[i], A[j].it, A[j].sec, note);
      // 빠진 실습은 바로 앞 초안 실습(짝지은 것이나 방금 넣은 것) 다음에
      const placed = new Map();
      dItems.forEach((d, i) => {
        if (pair.has(i)) { placed.set(i, A[pair.get(i)]); return; }
        const prev = placed.get(i - 1) || [...placed.entries()].filter(([k]) => k < i).pop()?.[1];
        const host = prev?.sec || A[0].sec;
        if (!note({ kind: 'station', where: d.title || d.name || `실습 ${i + 1}`, before: '', after: d.title || d.name || '', op: 'insert', loc: { sec: host.id, list: 'items', key: 'title' } })) return;
        const { images, ...it } = clone(d);
        host.items.splice(prev ? host.items.indexOf(prev.it) + 1 : 0, 0, it);
        placed.set(i, { it, sec: host });
      });
    }
  }

  // ── 프롬프트 모음: 실습 칸에 없는 프롬프트가 있으면 다시 넣고, 비어 있으면 초안대로 채움 ──
  const dPrompts = dSec('prompts').flatMap((s) => arr(s.items).filter((x) => isObj(x) && x.text));
  if (dPrompts.length) {
    const inStations = collectStrings(aSec('stations').map((s) => arr(s.items).map((it) => [arr(it.prompts).map((p) => p?.text), it.steps]))).map(norm).join('\u0001');
    const ps = aSec('prompts')[0];
    if (!ps) {
      const lost = dPrompts.filter((p) => !inStations.includes(norm(p.text)));
      if (lost.length) {
        const ds = dSec('prompts')[0];
        const sec = { ...clone(ds), id: uniqueId(out, ds.id || 'prompts') };
        if (note({ kind: 'section', where: secName(ds), before: '', after: `${dPrompts.length}개`, op: 'section', loc: { sec: sec.id } })) placeSection(out, draft, sec);
      }
    } else {
      const quiet = !arr(ps.items).length; // AI에게 '비워 두면 엔진이 채움'이라고 한 목록
      ps.items = arr(ps.items).filter(isObj);
      // 채우는 경우가 아니면, 실습 칸에 그대로 있는 프롬프트는 모음에서 빠져도 둠(AI가 고른 모음)
      guardPromptList(dPrompts, ps.items, { sec: ps.id, where: secName(ps), quiet, note, present: quiet ? '' : inStations });
    }
  }

  // ── 접속 확인 목록(준비 칸 checks): 비어 있으면 초안대로 ──
  const dChecks = dSec('readiness').flatMap((s) => arr(s.checks).filter(isObj));
  const rs = aSec('readiness')[0];
  if (dChecks.length && rs && !arr(rs.checks).length && note({ kind: 'link', quiet: true, where: `${secName(rs, { title: '준비' })} · 접속 확인`, before: '', after: `${dChecks.length}곳`, op: 'fill', loc: { sec: rs.id, list: 'checks' } })) rs.checks = clone(dChecks);

  // ── 교재에 없는 주소는 뺌 ──
  const ok = urlAllow(draft, material, allowUrls);
  guardUrls(out, ok, note);
  for (const ins of arr(out.instructors)) {
    if (!isObj(ins) || !Array.isArray(ins.links)) continue;
    ins.links = ins.links.filter((l) => !(isObj(l) && /^https?:\/\//i.test(l.url || '') && !ok(l.url) && note({ kind: 'link', where: `${ins.name || '강사'} · ${l.label || '링크'}`, before: l.url, after: '', op: 'instructor', loc: {}, item: clone(l) })));
  }

  return { blueprint: out, restored };
}

/** 글 목록(목표 등): 바뀐 문장은 교재대로, 빠진 문장은 그 자리에 */
function guardStrings(D, A, { sec, item, list, label, kind, keepExtra, note }) {
  const { pair } = alignList(D, A, { eq: same, score: similarity });
  for (const [i, j] of pair) if (!same(D[i], A[j]) && note({ kind, where: label(i), before: A[j], after: D[i], op: 'set', loc: { sec, item, list, index: j } })) A[j] = D[i];
  const used = new Set(pair.values());
  if (!keepExtra) {
    for (let j = A.length - 1; j >= 0; j--) if (!used.has(j) && note({ kind, where: label(j), before: A[j], after: '', op: 'remove', loc: { sec, item, list, index: j }, item: A[j] })) { A.splice(j, 1); for (const [i, k] of pair) if (k > j) pair.set(i, k - 1); }
  }
  D.forEach((d, i) => {
    if (pair.has(i)) return;
    if (!note({ kind, where: label(i), before: '', after: d, op: 'insert', loc: { sec, item, list } })) return;
    const at = insertAt(i, pair); A.splice(at, 0, d);
    for (const [k, j] of pair) if (j >= at) pair.set(k, j + 1);
    pair.set(i, at);
  });
}

/** 프롬프트 목록: 원문 그대로(앞뒤 버튼 이름만 덜어 낸 것은 그대로 둠), 빠진 것은 그 자리에, AI가 더한 것은 둠 */
function guardPromptList(D, A, { sec, item, where, quiet = false, note, present = '' }) {
  const todo = D.map((d, i) => [d, i]).filter(([d]) => !(present && present.includes(norm(d.text))));
  const DD = todo.map(([d]) => d);
  const { pair } = alignList(DD, A, { eq: (d, a) => trimmedSame(d.text, a?.text), score: (d, a) => similarity(d.text, a?.text), th: 0.3 });
  for (const [i, j] of pair) {
    const d = DD[i], a = A[j];
    if (!trimmedSame(d.text, a.text) && note({ kind: 'prompt', where: `${where} · ${a.title || d.title || `프롬프트 ${j + 1}`}`, before: a.text || '', after: d.text, op: 'set', loc: { sec, item, list: item !== undefined ? 'prompts' : 'items', key: 'text', index: j } })) a.text = d.text;
  }
  DD.forEach((d, i) => {
    if (pair.has(i)) return;
    if (!note({ kind: 'prompt', quiet, where: `${where} · ${d.title || `프롬프트 ${i + 1}`}`, before: '', after: d.text, op: 'insert', loc: { sec, item, list: item !== undefined ? 'prompts' : 'items', key: 'text' } })) return;
    const at = insertAt(i, pair); A.splice(at, 0, { title: d.title || '', text: d.text, ...(d.tags?.length ? { tags: d.tags.slice() } : {}) });
    for (const [k, j] of pair) if (j >= at) pair.set(k, j + 1);
    pair.set(i, at);
  });
}

/** 실습 한 칸: 단계는 교재 순서 그대로(교재에 없는 단계는 뺌), 프롬프트 원문, 교재의 링크 */
function guardStation(d, a, sec, note) {
  const name = a.title || d.title || a.name || '실습';
  const item = a.id || d.id;
  if (!a.id && d.id) a.id = d.id;
  if (!arr(a.source?.pages).length && arr(d.source?.pages).length) a.source = { ...(a.source || {}), pages: d.source.pages.slice() }; // 쪽 그림을 이어 주려면 쪽 번호가 있어야 함
  const dSteps = arr(d.steps).filter((x) => typeof x === 'string' && x.trim());
  if (dSteps.length) {
    a.steps = arr(a.steps).filter((x) => typeof x === 'string');
    guardStrings(dSteps, a.steps, { sec: sec.id, item, list: 'steps', label: (i) => `${name} · 단계 ${i + 1}`, kind: 'step', keepExtra: false, note });
  }
  const dPrompts = arr(d.prompts).filter((p) => isObj(p) && p.text);
  if (dPrompts.length) {
    a.prompts = arr(a.prompts).filter(isObj);
    // 단계 글 속에 그대로 들어간 프롬프트(예: '"5학년이 아는 말로 바꿔 줘"라고 다시 요청합니다')는 있는 것으로 봄
    guardPromptList(dPrompts, a.prompts, { sec: sec.id, item, where: name, note, present: [a.steps, a.desc, a.note].flat().filter(Boolean).map(norm).join('\u0001') });
  }
  const dLinks = arr(d.links).filter((l) => isObj(l) && l.url);
  if (dLinks.length) {
    a.links = arr(a.links).filter(isObj);
    const host = (u) => normUrl(u).split('/')[0];
    for (const l of dLinks) {
      if (a.links.some((x) => normUrl(x.url) === normUrl(l.url))) continue;
      const k = a.links.findIndex((x) => same(x.label, l.label) && !dLinks.some((y) => normUrl(y.url) === normUrl(x.url)));
      if (k >= 0) { if (note({ kind: 'link', where: `${name} · ${l.label || '링크'}`, before: a.links[k].url || '', after: l.url, op: 'set', loc: { sec: sec.id, item, list: 'links', key: 'url', index: k } })) a.links[k].url = l.url; continue; }
      if (a.links.some((x) => host(x.url) === host(l.url))) continue; // 같은 곳(도메인)으로 가는 링크가 이미 있음
      if (note({ kind: 'link', where: `${name} · ${l.label || '링크'}`, before: '', after: l.url, op: 'insert', loc: { sec: sec.id, item, list: 'links', key: 'url' } })) a.links.push({ label: l.label || '', url: l.url });
    }
  }
}

/** 칸 안의 주소(url·href·글 칸 링크)가 교재·초안·강사 값에 없으면 뺌. 링크 목록의 항목은 통째로, 도구·준비 항목은 주소만 */
function guardUrls(bp, ok, note) {
  const DROP_ITEM = { stations: ['links'], readiness: ['checks'], followup: ['items'], materials: ['items'], video: ['items'], sessions: ['links'], hero: ['ctas'] };
  for (const s of bp.sections) {
    if (!isObj(s) || s.type === 'survey') continue; // 설문 주소는 강사 값만(applyInfo)
    let where = (x) => `${secName(s)}${x ? ' · ' + x : ''}`;
    const walk = (o, path, item) => {
      if (Array.isArray(o)) {
        for (let k = o.length - 1; k >= 0; k--) {
          const x = o[k];
          const listKey = path[path.length - 1];
          if (isObj(x)) {
            const u = x.url || x.href || '';
            const bad = /^https?:\/\//i.test(u) && !ok(u);
            const dropWhole = bad && (DROP_ITEM[s.type]?.includes(listKey) || listKey === 'links');
            if (dropWhole) {
              if (note({ kind: 'link', where: where(x.label || x.title || x.name || ''), before: u, after: '', op: 'remove', loc: { sec: s.id, item, list: listKey, index: k }, item: clone(x) })) o.splice(k, 1);
              continue;
            }
            const inStation = s.type === 'stations' && listKey === 'items';
            const outer = where;
            if (inStation) where = (y) => `${x.title || x.name || secName(s)}${y ? ' · ' + y : ''}`;
            walk(x, [...path, k], item ?? (inStation ? x.id ?? k : undefined));
            where = outer;
          }
        }
        return;
      }
      if (!isObj(o)) return;
      for (const key of Object.keys(o)) {
        const v = o[key];
        if ((key === 'url' || key === 'href') && typeof v === 'string' && /^https?:\/\//i.test(v) && !ok(v)) {
          if (note({ kind: 'link', where: where(o.label || o.name || o.title || ''), before: v, after: '', op: 'set', loc: { sec: s.id, item, list: path.length > 1 ? String(path[path.length - 2]) : '', key, index: typeof path[path.length - 1] === 'number' ? path[path.length - 1] : undefined, field: true } })) o[key] = '';
        } else if (key === 'md' && typeof v === 'string') {
          // 글 칸 링크 [글자](주소): 교재에 없는 주소면 글자만 남김
          o[key] = v.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (m, label, u) => (ok(u) || !note({ kind: 'link', where: where(label), before: u, after: '', op: 'md', loc: { sec: s.id, key: 'md' }, item: m }) ? m : label));
        } else if (typeof v === 'object') walk(v, [...path, key], item);
      }
    };
    walk(s, [], undefined);
  }
}

// ── 그곳만 AI 답으로 되돌리기 ──
function findSection(bp, sec) { return arr(bp?.sections).find((s) => s?.id === sec); }
function listOf(bp, loc) {
  const s = findSection(bp, loc.sec); if (!s) return null;
  if (loc.item === undefined || loc.item === '') return loc.list ? (Array.isArray(s[loc.list]) ? s[loc.list] : null) : null;
  const items = arr(s.items);
  const it = items.find((x) => isObj(x) && x.id === loc.item) || (typeof loc.item === 'number' ? items[loc.item] : null);
  return it && Array.isArray(it[loc.list]) ? it[loc.list] : null;
}
const valOf = (x, key) => (key && isObj(x) ? x[key] : x);
/**
 * 교재대로 되돌린 곳 하나를 AI 답으로 되돌림. 강사가 그 뒤 고친 다른 곳은 그대로 둡니다.
 * @returns {object} 새 설계도(찾지 못하면 그대로)
 */
export function undoRestore(bp0, r) {
  if (!isObj(bp0) || !r?.op) return bp0;
  const bp = clone(bp0); const loc = r.loc || {};
  if (r.op === 'section') { bp.sections = arr(bp.sections).filter((s) => s?.id !== loc.sec); return bp; }
  if (r.op === 'instructor') { const ins = arr(bp.instructors).find((x) => isObj(x)); if (ins) ins.links = [...arr(ins.links), clone(r.item)]; return bp; }
  if (r.op === 'fill') { const s = findSection(bp, loc.sec); if (s) s[loc.list] = []; return bp; }
  if (r.op === 'md') { const s = findSection(bp, loc.sec); if (s && typeof s.md === 'string' && r.item) { const label = /^\[([^\]]+)\]/.exec(r.item)?.[1] || ''; const i = s.md.indexOf(label); if (i >= 0) s.md = s.md.slice(0, i) + r.item + s.md.slice(i + label.length); } return bp; }
  const list = listOf(bp, loc);
  if (r.op === 'set' && loc.field) {
    // 주소 칸만 비운 것: 그 항목을 찾아 주소를 되돌림
    const s = findSection(bp, loc.sec); const L = list || (s && Array.isArray(s[loc.list]) ? s[loc.list] : null);
    const x = L ? (L[loc.index] && valOf(L[loc.index], loc.key) === '' ? L[loc.index] : L.find((y) => isObj(y) && y[loc.key] === '')) : s;
    if (x) x[loc.key] = r.before;
    return bp;
  }
  if (!list) return bp;
  if (r.op === 'set') {
    const k = valOf(list[loc.index], loc.key) === r.after ? loc.index : list.findIndex((x) => valOf(x, loc.key) === r.after);
    if (k < 0) return bp;
    if (r.kind === 'schedule' && loc.key === 'start' && r.item) Object.assign(list[k], r.item);
    else if (loc.key) list[k][loc.key] = r.before; else list[k] = r.before;
  } else if (r.op === 'insert') {
    const k = list.findIndex((x) => valOf(x, loc.key) === r.after);
    if (k >= 0) list.splice(k, 1);
  } else if (r.op === 'remove') {
    list.splice(Math.min(loc.index ?? list.length, list.length), 0, clone(r.item));
  }
  return bp;
}

/** 알림에 셀 곳(조용히 채운 목록은 빼고) */
export const restoredCount = (restored) => arr(restored).filter((r) => !r.quiet).length;
