// 조립·검수(엔진 키트 skills/lecpage/engine/src/kit/, docs/plan-ai-first.md §5)를 부르는 한 곳. 생성 파이프라인(gen/*)은 이 파일만 씁니다.
//   assemble(site, meta, { runtime, preview, target, prev, today, material:{ pages }, materials }) → { files, warnings, errors, meta, collected, blueprint, csp, report }
//   previewHtml(files, page, { extraHead, extraBody }) → 한 장 HTML · inspect(files, meta) → issues · inspectRenderedScript({ id }) → 숨은 틀 스크립트
//   readMeta(json, { prev }) → { meta, errors, warnings, old } · keepTeacherValues · themeFromCss · issuesForAi
import { todayKst } from '../util.js';
import { tangledTitle } from '@engine/src/kit/index.js';
import * as KIT from '@engine/src/kit/index.js';
import { materialToAIContext } from '@engine/src/ingest/outline.js';
export { assemble, previewHtml, inspect, issuesForAi, inspectRenderedScript, readMeta, keepTeacherValues, themeFromCss, TEACHER_KEYS, siteFileOk } from '@engine/src/kit/index.js';

let rt = null;
/** 조립에 넣을 실행 파일(엔진 runtime) — 처음 쓸 때 한 번만 받음 */
export function kitRuntime() {
  if (!rt) rt = import('../runtime-files.js').then((m) => m.runtime).catch((e) => { rt = null; throw e; });
  return rt;
}
/** 교재 쪽 제목(교재 넘기기 검색용): project.material.pages → [{ page, title, text }] (첫 교재 파일 기준) */
export function materialPages(project) {
  const m = project?.material; if (!m?.pages?.length) return [];
  const first = (m.files || []).find((f) => !f.renderOf)?.id;
  return m.pages.filter((p) => !p.hidden && (!first || p.file === first)).slice(0, 400)
    .map((p) => ({ page: p.page, title: String(p.title || '').slice(0, 120), text: (p.paragraphs || []).map((x) => x.text).join(' ').slice(0, 400) }));
}
/** 쪽 번호 → 제목(화면의 교재 쪽 그림 고르기 등): 교재에서 뽑은 제목(엉킨 것은 비움) 위에 연수 정보의 pages(AI·강사가 고친 제목)를 덮음. 조립(assemble)과 같은 규칙 */
export function pageTitles(project) {
  const out = {};
  for (const p of materialPages(project)) out[p.page] = tangledTitle(p.title) ? '' : p.title;
  for (const p of project?.meta?.pages || []) if (p && p.page) out[p.page] = String(p.title || '');
  return out;
}
/** 미리보기·검수는 늘 연습: 실제 참여 기능 서버가 연결돼 있어도 이 기기 안 연습(local)으로(시험 글이 실제 참가자 기록에 섞이지 않게) */
const TEACHER = ['siteUrl', 'joinUrl', 'shortUrl', 'access', 'surveyUrl', 'privacy', 'keepUntil'];
export const rehearsalPrev = (m = {}) => ({ ...Object.fromEntries(TEACHER.filter((k) => m[k] !== undefined && m[k] !== null).map((k) => [k, m[k]])), live: { provider: 'local', url: '', code: m.live?.code || 'PREVIEW1' } });
/** 조립 옵션(앱 공통): 강사 값(prev), 오늘 날짜는 한국 시각, 교재 쪽 제목, 자료실 목록 */
export async function assembleOpts(project, { target = 'preview', prev = null, materials } = {}) {
  return { runtime: await kitRuntime(), preview: target === 'preview', target, prev, today: todayKst(), material: { pages: materialPages(project) }, materials: Array.isArray(materials) ? materials : Array.isArray(project?.materials) ? project.materials : [] };
}

/** 교재 글(pdf.js 등으로 이미 뽑은 project.material) → 사실 대조에 넘길 글. 숨긴 쪽은 빼고 쪽 번호와 함께 */
export function materialText(project) {
  if (!project?.material) return '';
  try { return materialToAIContext(project.material, { maxChars: 400000, header: false, notes: false }); } catch { return ''; }
}
/**
 * 교재 사실 대조(엔진 kit.checkFacts — 정확성 작업이 더함). 엔진에 아직 없으면 []. 돌려준 문제는 검수 문제 꼴(issue)로 맞춤
 * @returns {Promise<issue[]>}
 */
export async function checkFacts(siteFiles, { materialText: text = '', meta = {} } = {}) {
  const fn = KIT.checkFacts;
  if (typeof fn !== 'function' || !text) return [];
  try {
    const r = await fn(siteFiles, { materialText: text, meta });
    const list = Array.isArray(r) ? r : Array.isArray(r?.issues) ? r.issues : [];
    return list.filter((i) => i && typeof i.message_ko === 'string').map((i) => ({ level: 'warn', fix_hint_ko: '', ...i, id: i.id || 'facts', where: { file: '', selector: '', section: '', ...(i.where || {}) } }));
  } catch (e) { console.error('[facts]', e); return []; }
}
