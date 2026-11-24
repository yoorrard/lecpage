// 교재 쪽 그림 묶음: 교재가 여럿이면 교재마다 그린 쪽 그림을 이어서 번호를 매김(첫 교재 1~13, 둘째 14부터).
// 교재를 넣을 때 그린 것 assets/slides/slide-NNN.* 와 사이트에 쓰는 것 site/material/p-NNN.* 가 같은 번호를 씀
// (Skill의 prepare도 교재 여러 개를 이어서 번호를 매김: 교재 슬라이드 data-lp="deck"의 쪽 번호가 곧 이 번호).
//   project.slideSets = [{ name: '강의.pptx', first: 1, count: 13 }, { name: '안내.docx', first: 14, count: 5 }]
// 예전 연수(쪽 그림은 교재 하나의 것, project.slidesFrom·slidesMade)는 묶음 하나로 읽음. 교재가 하나면 예전과 같은 값(1번부터).
// 이 파일은 다른 것을 불러오지 않음(Node 시험에서 그대로 읽음).

/** 쪽 그림을 만드는 쪽 수(모든 교재 합쳐). 교재 슬라이드가 보여 주는 쪽 수(엔진 deck 400쪽)와 같게 */
export const MAX_SLIDES = 400;

const int = (v) => (Number.isInteger(v) && v > 0 ? v : 0);
export const stemOf = (n) => String(n || '').normalize('NFC').replace(/\.[^.]+$/, '').toLowerCase();
const pad3 = (n) => String(n).padStart(3, '0');

/** 묶음 목록을 믿을 수 있는 꼴로: 이름·시작·장수가 있고, 시작 번호 순서이며 서로 겹치지 않는 것만 */
export function normSets(list) {
  const out = []; let end = 0;
  for (const s of [...(Array.isArray(list) ? list : [])].filter((x) => x && typeof x.name === 'string' && x.name && int(x.first) && int(x.count)).sort((a, b) => a.first - b.first)) {
    if (s.first <= end) continue;
    out.push({ name: s.name, first: s.first, count: s.count }); end = s.first + s.count - 1;
  }
  return out;
}
/** 연수에 적힌 묶음(없으면 예전 칸 slidesFrom·slidesMade를 묶음 하나로) */
export function slideSetsOf(project) {
  if (Array.isArray(project?.slideSets)) return normSets(project.slideSets);
  const n = int(project?.slidesMade); const from = String(project?.slidesFrom || '');
  return from && n ? [{ name: from, first: 1, count: n }] : [];
}
/** 마지막 쪽 그림 번호(묶음이 없으면 0) */
export const setsEnd = (sets) => (sets || []).reduce((n, s) => Math.max(n, s.first + s.count - 1), 0);
/** 맨 뒤에 한 교재의 쪽 그림 count장을 이어 붙임 */
export const addSet = (sets, name, count) => (int(count) ? [...(sets || []), { name, first: setsEnd(sets) + 1, count }] : [...(sets || [])]);
/** 연수에 적을 칸. 예전 칸(slidesMade·slidesFrom)도 함께 맞춤: 교재 하나면 예전과 같은 값, 여럿이면 slidesFrom은 비움(한 교재의 것이 아님) */
export const setsFields = (sets) => ({ slideSets: sets, slidesMade: (sets || []).reduce((n, s) => n + s.count, 0), slidesFrom: sets?.length === 1 ? sets[0].name : '' });

/** 파일 이름 → 그 교재의 묶음. 이름이 같은 것, 없으면 확장자만 다른 짝(같은 이름의 PDF·이 PC에서 만든 PDF)이 하나뿐일 때 그것 */
export function setFor(sets, name) {
  const exact = (sets || []).find((s) => s.name === name);
  if (exact) return exact;
  const same = (sets || []).filter((s) => stemOf(s.name) === stemOf(name));
  return same.length === 1 ? same[0] : null;
}
/**
 * 교재에서 뽑은 쪽(material.pages: { file, page, title, paragraphs, hidden })을 쪽 그림 번호에 맞춤 → [{ page: 그림 번호, title, text }].
 * 쪽 그림 번호는 묶음(sets)을 따르므로 묶음마다 그 교재의 쪽을 차례대로 그 번호에 놓음. 예전에는 '먼저 읽기가 끝난 교재'의 쪽 번호를 그대로 써서,
 * 큰 PDF 뒤에 넣은 PPT가 먼저 읽히면 PPT 슬라이드의 제목이 PDF 쪽(1~13쪽)에 붙었음(교재 슬라이드의 쪽 이름·검색이 다른 교재의 것).
 * 쪽마다 맞출 수 없는 교재는 비움(틀린 이름을 붙이지 않게): 워드·한글처럼 '부분'으로 읽은 것, 그림이 교재 쪽보다 많은 것, 묶음의 교재를 찾지 못한 것.
 * 묶음이 없으면(예전 연수) null — 부른 쪽이 예전 규칙(첫 교재)을 씀
 */
export function pagesBySets(material, sets) {
  const list = normSets(sets); if (!list.length) return null;
  const files = (material?.files || []).filter((f) => f && !f.renderOf);
  const text = (p) => (p.paragraphs || []).map((x) => x.text).join(' ').slice(0, 400);
  const out = [];
  for (const s of list) {
    const same = files.filter((f) => stemOf(f.name) === stemOf(s.name));
    const f = files.find((x) => x.name === s.name) || (same.length === 1 ? same[0] : null);
    if (!f || f.unit === 'section') continue;
    const all = (material.pages || []).filter((p) => p.file === f.id).sort((a, b) => a.page - b.page);
    const vis = all.filter((p) => !p.hidden);
    // 그림을 보이는 쪽만 그렸으면 보이는 쪽 차례로, 숨긴 쪽까지 그렸으면 쪽 차례 그대로(숨긴 쪽의 이름은 적지 않음).
    // 교재가 더 길면(쪽 그림 한도·그리다 멈춤) 앞에서부터 그린 만큼만 — 숨긴 쪽이 섞여 어느 쪽인지 알 수 없으면 비움
    const rows = vis.length === s.count ? vis.map((p, i) => [p, i])
      : all.length === s.count ? all.map((p, i) => [p, i]).filter(([p]) => !p.hidden)
        : vis.length === all.length && all.length > s.count ? all.slice(0, s.count).map((p, i) => [p, i]) : [];
    for (const [p, i] of rows) out.push({ page: s.first + i, title: String(p.title || '').slice(0, 120), text: text(p) });
  }
  return out.slice(0, MAX_SLIDES);
}
/** 'material/p-014.webp'·'assets/slides/slide-014.webp' → 14 (아니면 0) */
export const numOf = (path) => +(/(?:^|\/)(?:p|slide)-(\d{3,4})\.(?:webp|png|jpe?g)$/i.exec(String(path || '')) || [])[1] || 0;

/**
 * 사이트에 놓인 쪽 그림 번호(nums)에 맞는 묶음만. 교재를 더 넣기 전에 만든 사이트면 앞쪽 묶음만 놓여 있음 → 그만큼만.
 * 놓인 그림의 끝 번호가 묶음의 끝과 맞지 않으면(교재를 바꿨는데 사이트는 예전 것) 어느 교재의 것인지 모르는 것으로 봄 → []
 */
export function setsWithin(sets, nums) {
  const max = (nums || []).reduce((n, x) => Math.max(n, x), 0);
  const out = [];
  for (const s of sets || []) { if (s.first + s.count - 1 > max) break; out.push(s); }
  return out.length && setsEnd(out) === max && out[0].first === 1 ? out : [];
}

/** 쪽 고르기: 앞쪽(표지·목차)과 끝쪽을 넣고 나머지는 고르게 */
export function pickPages(total, max) {
  if (total <= max) return Array.from({ length: total }, (_, i) => i + 1);
  const keep = new Set([1, 2, 3, total].filter((n) => n >= 1 && n <= total));
  const rest = Math.max(0, max - keep.size);
  for (let i = 0; i < rest; i++) keep.add(Math.min(total, Math.max(1, Math.round(4 + (i * (total - 5)) / Math.max(1, rest - 1)))));
  return [...keep].sort((a, b) => a - b).slice(0, max);
}
/** 한도(cap)를 교재마다 고르게 나눔: 쪽이 적은 교재는 다 넣고, 남는 몫을 쪽이 많은 교재에 돌림. counts → 교재마다 몇 장 */
export function splitCap(counts, cap) {
  const out = counts.map(() => 0); let left = Math.max(0, Math.floor(cap));
  let open = counts.map((c, i) => i).filter((i) => counts[i] > 0);
  while (left > 0 && open.length) {
    const share = Math.floor(left / open.length);
    if (!share) { for (const i of open.slice(0, left)) out[i]++; break; }
    const next = [];
    for (const i of open) { const take = Math.min(share, counts[i] - out[i]); out[i] += take; left -= take; if (out[i] < counts[i]) next.push(i); }
    open = next;
  }
  return out;
}
/** 묶음마다 고른 쪽 그림 번호(이어 매긴 번호). cap: 모두 합쳐 몇 장까지 → [[1,2,3,…], [14,15,…]] */
export function pickFromSets(sets, cap) {
  const shares = splitCap(sets.map((s) => s.count), cap);
  return sets.map((s, i) => pickPages(s.count, shares[i]).map((n) => s.first + n - 1));
}

/**
 * AI에게 알릴 '사이트에 쓸 수 있는 교재 쪽 그림' 줄(있는 그대로). list: ['material/p-001.webp', …]
 * 교재 하나(묶음이 없거나 하나)면 예전과 같은 한 줄, 여럿이면 교재마다 어느 번호가 몇 쪽인지 한 줄씩
 */
export function imageLines(list, sets, from = '') {
  if (!list?.length) return '교재 쪽 그림은 없어요.';
  if (!sets || sets.length < 2) {
    const name = sets?.length === 1 ? sets[0].name : from;
    return `사이트에 쓸 수 있는 교재 쪽 그림: material/p-001.webp ~ material/p-${pad3(list.length)}.webp (번호 = 교재 쪽 번호${name ? `, ${name}` : ''})`;
  }
  const extOf = (n) => (/\.(\w+)$/.exec(list.find((p) => numOf(p) === n) || '') || [])[1] || 'webp';
  const rows = sets.map((s) => `- ${s.name}: material/p-${pad3(s.first)}.${extOf(s.first)} ~ material/p-${pad3(s.first + s.count - 1)}.${extOf(s.first + s.count - 1)} (이 교재의 1~${s.count}쪽)`);
  return `사이트에 쓸 수 있는 교재 쪽 그림: material/p-001 ~ material/p-${pad3(setsEnd(sets))} (교재마다 이어서 매긴 번호)\n${rows.join('\n')}`;
}
