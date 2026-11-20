// 참고 디자인(레퍼런스 사이트, docs/plan-ai-first.md §11): AI가 교재를 읽고 자유롭게 만든 완성도 높은 강의 사이트 사례.
// skills/lecpage/references/designs/<id>/의 notes.json(분위기 설명)·lecpage.json(연수 정보)에서 빌드 때 읽음. 사이트는 scripts/prepare.mjs가
// 엔진으로 조립해 public/examples/<id>/에 둠. 그림(public/img/ref-<id>.webp)은 scripts/ref-shots.mjs로 찍음.
// 고르면 AI에게 그 사이트의 '분위기 설명'(mood)만 붙음(따를 의무 없음). 랜딩(landing/More.jsx)·참고 디자인 화면(pages/Gallery.jsx)·새 연수가 함께 씀.
const NOTES = import.meta.glob('../../../skills/lecpage/references/designs/*/notes.json', { eager: true, import: 'default' });
const METAS = import.meta.glob('../../../skills/lecpage/references/designs/*/lecpage.json', { eager: true, import: 'default' });
const AUD = { teachers: '교원 연수', students: '학생 수업', parents: '학부모 연수', staff: '직원 연수', other: '연수' };
const MODE = { offline: '모여서', online: '온라인', blended: '모여서·온라인' };
const minutes = (s) => { const [a, b] = [s?.start, s?.end].map((t) => (/^(\d\d):(\d\d)$/.exec(t || '') || []).slice(1).map(Number)); return a?.length && b?.length ? (b[0] * 60 + b[1]) - (a[0] * 60 + a[1]) : 0; };
const length = (m) => (m >= 60 && m % 60 === 0 ? `${m / 60}시간` : m > 0 ? `${m}분` : '');

/** [{ id, title, kind, desc, mood, kit, img, url }] */
export const REFERENCES = Object.entries(NOTES).map(([path, n]) => {
  const id = n.id || /designs\/([^/]+)\//.exec(path)[1];
  const m = METAS[path.replace(/notes\.json$/, 'lecpage.json')] || {};
  const kind = [AUD[n.audience || m.audience] || '연수', MODE[m.mode] || '', length(minutes(m.sessions?.[0])), n.material?.pages ? `교재 ${n.material.pages}쪽` : ''].filter(Boolean).join(' · ');
  return { id, title: n.title || m.title || id, kind, desc: m.subtitle || '', mood: n.mood || '', kit: n.kit || [], img: `img/ref-${id}.webp`, url: `examples/${id}/index.html` };
}).sort((a, b) => (a.id === 'data-lab' ? -1 : b.id === 'data-lab' ? 1 : a.title.localeCompare(b.title, 'ko')));

/** 새 연수에 붙일 참고 디자인: AI에게는 분위기 설명만(lib/gen/prompts.js buildRefPrompt) */
export const referenceFor = (r) => (r ? { id: r.id, name: r.title, mood: r.mood } : null);
