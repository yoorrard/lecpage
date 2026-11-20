// 조립·검수(엔진 키트 skills/lecpage/engine/src/kit/, docs/plan-ai-first.md §5)를 부르는 한 곳. 생성 파이프라인(gen/*)은 이 파일만 씁니다.
//   assemble(site, meta, { runtime, preview, target, prev, today, material:{ pages }, materials }) → { files, warnings, errors, meta, collected, blueprint, csp, report }
//   previewHtml(files, page, { extraHead, extraBody }) → 한 장 HTML · inspect(files, meta) → issues · inspectRenderedScript({ id }) → 숨은 틀 스크립트
//   readMeta(json, { prev }) → { meta, errors, warnings, old } · keepTeacherValues · themeFromCss · issuesForAi
import { todayKst } from '../util.js';
export { assemble, previewHtml, inspect, issuesForAi, inspectRenderedScript, readMeta, keepTeacherValues, themeFromCss, TEACHER_KEYS } from '@engine/src/kit/index.js';

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
/** 미리보기·검수는 늘 연습: 실제 참여 기능 서버가 연결돼 있어도 이 기기 안 연습(local)으로(시험 글이 실제 참가자 기록에 섞이지 않게) */
const TEACHER = ['siteUrl', 'joinUrl', 'shortUrl', 'access', 'surveyUrl', 'privacy', 'keepUntil'];
export const rehearsalPrev = (m = {}) => ({ ...Object.fromEntries(TEACHER.filter((k) => m[k] !== undefined && m[k] !== null).map((k) => [k, m[k]])), live: { provider: 'local', url: '', code: m.live?.code || 'PREVIEW1' } });
/** 조립 옵션(앱 공통): 강사 값(prev), 오늘 날짜는 한국 시각, 교재 쪽 제목, 자료실 목록 */
export async function assembleOpts(project, { target = 'preview', prev = null, materials } = {}) {
  return { runtime: await kitRuntime(), preview: target === 'preview', target, prev, today: todayKst(), material: { pages: materialPages(project) }, materials: Array.isArray(materials) ? materials : Array.isArray(project?.materials) ? project.materials : [] };
}
