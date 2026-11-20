// AI 생성 API(docs/plan-ai-first.md §15). 화면은 이 파일만 부르고, 생성 쪽은 화면을 모릅니다.
//   startGeneration · resumeGeneration · stopGeneration · useGeneration · chatPrompt · acceptChatAnswer
//   editSite · chatEditPrompt · runInspect · fixIssues
// 덤: sitePreviewHtml(미리보기 한 파일 HTML) · restoreVersion · forgetGeneration · isGenerating · siteMapOf
// 끝나면 연수(projects)에 { v:2, site, meta, gen, versions, inspect }를 저장하고 창에 'lecpage:gen-saved'({ pid, at }) 이벤트를 보냄
// (같은 탭의 화면은 이 이벤트를 받으면 연수를 다시 읽어야 함. 다른 탭은 db.js onProjectChange로 알게 됨)
import { useEffect, useState } from 'preact/hooks';
import { projects } from '../db.js';
import { uid } from '../util.js';
import { startJob, resumeJob, stopJob, currentView, liveView, onJobChange, resumeIfOrphaned, inspectSite, notifySaved, readJob } from './job.js';
import { jobsDb, chatDb } from './store.js';
import * as P from './prompts.js';
import { parseChatAnswer, extractHtml, extractSections, extractCss, replaceSections, stitch, siteMap, htmlCut, trimCss } from './parse.js';
import { readMeta, themeFromCss } from './kit.js';
import { sourceFiles } from './material.js';
import { materialFiles } from './preview.js';

export { sitePreviewHtml } from './preview.js';
export { isGenerating, onBusyChange } from './busy.js';
export { KIT_SHIM } from './kit.js';

/**
 * AI로 사이트 만들기 시작(키 연결·로컬). 앞 단계는 저장되며 끊겨도 resumeGeneration으로 이어 함.
 * @param {string} pid
 * @param {{ way?: 'key'|'local', provider?: string, model?: string, request?: string, reference?: string|{ name, mood } }} o
 *   provider를 비우면 지금 연결된 AI(getActiveAI). reference는 분위기 설명만 AI에게 붙음
 * @returns {Promise<string>} jobId (다른 탭이 이미 만드는 중이면 그 작업의 id — useGeneration의 elsewhere가 true)
 */
export async function startGeneration(pid, o = {}) {
  const r = await startJob(pid, 'make', { way: o.way || 'key', provider: o.provider, model: o.model, request: o.request, reference: o.reference });
  return r.jobId;
}
/** 멈춘 작업 이어 하기(새로 고침 뒤 useGeneration이 저절로도 부름). change: { provider, model }로 바꿔 이어 할 수 있음(앞 단계 결과 유지) */
export async function resumeGeneration(pid, change = {}) { return (await resumeJob(pid, change)).jobId; }
/** 멈추기 → status 'paused'. resumeGeneration으로 멈춘 단계부터 */
export function stopGeneration(pid) { return stopJob(pid); }

/**
 * 진행 상태(Preact 훅). 1초마다 다시 그려 걸린 시간을 셀 수 있게 now를 넣음.
 * → { status: 'idle'|'running'|'paused'|'done'|'error', step: { name, label_ko, index, total, received }, steps[], startedAt,
 *     error: { kind, title, body, actions[] } | null, wait: { reason: 'quota'|'retry'|'hidden', until } | null,
 *     notes[], elsewhere(다른 탭이 만드는 중), jobId, kind, preview?: { site } }
 * error.actions: 'resume'(이어서 만들기) · 'connect'(다른 AI·키 연결) · 'paste'(쓰던 AI 창으로) · 'key' · 'billing' · 'link'(error.link.href)
 * 처음 그릴 때 새로 고침으로 끊긴 작업이 있으면 저절로 이어 함
 */
export function useGeneration(pid) {
  const [v, setV] = useState(() => liveView(pid) || { status: 'idle', step: null, steps: [], startedAt: 0, error: null });
  useEffect(() => {
    if (!pid) return undefined;
    let on = true;
    const refresh = () => currentView(pid).then((x) => { if (on) setV({ ...x, now: Date.now() }); }).catch(() => { });
    refresh();
    resumeIfOrphaned(pid).then(refresh).catch(() => { });
    const off = onJobChange((id) => { if (id === pid) refresh(); });
    const t = setInterval(() => { if (on) setV((x) => (x.status === 'running' ? { ...x, now: Date.now() } : x)); }, 1000);
    return () => { on = false; off(); clearInterval(t); };
  }, [pid]);
  return v;
}
/** 화면 밖에서 상태를 읽을 때(한 번) */
export const generationState = (pid) => currentView(pid);

// ── 쓰던 AI 창(키 없이) ──
/**
 * 쓰던 AI 창에 붙일 글. 강사가 교재 원본(PDF)을 그 창에 첨부하라는 안내가 글 안에 들어 있음.
 * @returns {Promise<string>}
 */
export async function chatPrompt(pid, { request, reference } = {}) {
  const p = await projects.get(pid);
  await chatDb.put({ pid, mode: 'make', partial: '', at: Date.now() }).catch(() => { });
  return P.buildChatPrompt({ request, reference, info: infoOf(p || {}), files: sourceFiles(p || {}) });
}
function infoOf(p) {
  const i = p.info || {}; const keep = {};
  for (const k of ['title', 'date', 'start', 'end', 'venue']) if (i[k] && !(p.autoFilled && p.autoFilled[k] === i[k])) keep[k] = i[k];
  return keep;
}

/** 문서의 <style>들을 assets/style.css로 옮김(색·글꼴 고치기와 수정 요청이 한 파일을 보게) */
function splitStyles(html) {
  const css = [];
  const out = html.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (m, body) => { css.push(body.trim()); return ''; });
  if (!css.length) return { html, css: '' };
  return { html: out.replace(/<\/head>/i, '<link rel="stylesheet" href="assets/style.css">\n</head>'), css: css.join('\n\n') };
}

const problem = (code, message_ko, level = 'error') => ({ id: code, level, where: { file: 'index.html' }, message_ko, fix_hint_ko: '' });

/**
 * 쓰던 AI 창의 답 받기: 붙여 넣은 글 또는 내려받은 .html 파일. 잘렸으면 continuePrompt(이어서 문구)를 주고,
 * 다음에 붙여 넣는 답을 앞 조각에 이어 붙임. 수정 요청(chatEditPrompt) 뒤라면 답의 섹션만 갈아 끼움.
 * @returns {Promise<{ ok, site?, meta?, problems: issue[], continuePrompt? }>}
 */
export async function acceptChatAnswer(pid, input) {
  const text = typeof input === 'string' ? input : input && typeof input.text === 'function' ? await input.text() : '';
  if (!String(text).trim()) return { ok: false, problems: [problem('empty', '붙여 넣은 글이 비었어요.')] };
  const p = await projects.get(pid);
  if (!p) return { ok: false, problems: [problem('no-project', '연수를 찾지 못했어요.')] };
  const st = (await chatDb.get(pid).catch(() => null)) || { pid, mode: 'make', partial: '' };
  const fresh = /<!doctype\s+html|<html[\s>]/i.test(text);

  // 수정 요청의 답: 섹션만 갈아 끼움(문서 전체가 오면 아래 '새 사이트'로)
  if (st.mode === 'edit' && !fresh && p.site?.['index.html']) {
    const secs = extractSections(extractHtml(text).html).filter((s) => s.id && s.complete);
    if (!secs.length) return { ok: false, problems: [problem('no-section', '답에서 고친 섹션(<section id="…">)을 찾지 못했어요. 코드 블록 전체를 복사해 붙여 넣어 주세요.')] };
    const c = extractCss(text.replace(/```html[\s\S]*?(```|$)/gi, ''));
    const site = { ...p.site, 'index.html': replaceSections(p.site['index.html'], secs).html };
    if (c.css && !/<[a-zA-Z]/.test(c.css)) site['assets/style.css'] = `${p.site['assets/style.css'] || ''}\n\n/* 수정 요청 */\n${c.cut ? trimCss(c.css) : c.css}`;
    const meta = { ...(p.meta || {}), theme: { ...(p.meta?.theme || {}), ...themeFromCss(site['assets/style.css'] || '') } };
    const saved = await saveSite(pid, site, meta, { label: 'AI가 고친 판', way: 'chat' });
    await chatDb.del(pid).catch(() => { });
    return { ok: true, site, meta, problems: saved.issues };
  }

  // 새 사이트: 앞에서 잘린 조각이 있으면 이어 붙임
  const joined = st.partial && !fresh ? stitch(st.partial, text) : text;
  const a = parseChatAnswer(joined);
  if (!a.html || (!a.doc && !extractSections(a.html).length)) {
    return { ok: false, problems: [problem('no-html', '답에서 사이트 HTML을 찾지 못했어요. AI 답의 코드 블록 전체를 복사해 붙여 넣어 주세요.')] };
  }
  if (a.cut || htmlCut(a.html, { doc: a.doc })) {
    await chatDb.put({ pid, mode: 'make', partial: a.html, at: Date.now() }).catch(() => { });
    return { ok: false, problems: [problem('cut', '답이 중간에 끊겼어요. 아래 문구를 AI 창에 보내 이어서 받은 뒤 다시 붙여 넣어 주세요.', 'warn')], continuePrompt: P.buildContinuePrompt(a.html) };
  }
  const { html, css } = splitStyles(a.html);
  const site = { 'index.html': html, ...(css ? { 'assets/style.css': css } : {}) };
  const titleTag = (/<title>([^<]*)<\/title>/i.exec(html) || [])[1] || '';
  const raw = a.meta || { title: titleTag.trim() };
  if (!raw.title && titleTag) raw.title = titleTag.trim();
  const meta = readMeta({ ...raw, theme: { ...(raw.theme || {}), ...themeFromCss(css) } }, { prev: p.meta }).meta;
  const saved = await saveSite(pid, site, meta, { label: '쓰던 AI가 만든 판', way: 'chat' });
  await chatDb.del(pid).catch(() => { });
  const problems = [...(a.meta ? [] : [problem('no-meta', '답 끝에 연수 정보(lecpage.json)가 없어 제목만 읽었어요. 연수 정보에서 확인해 주세요.', 'warn')]), ...saved.issues];
  return { ok: true, site, meta, problems };
}

/** 사이트를 저장(판 기록·검수 결과와 함께) → { issues } */
async function saveSite(pid, site, meta, { label, way, provider = '', model = '' }) {
  const { issues } = await inspectSite(pid, site, meta);
  const at = Date.now();
  const out = await projects.patch(pid, (cur) => ({
    v: 2, site, meta,
    gen: { jobId: 'chat-' + uid(6), status: 'done', way, provider, model, at, kind: 'make' },
    versions: [...(Array.isArray(cur.versions) ? cur.versions : []), { id: uid(8), at, label, site, meta }].slice(-10),
    inspect: { at, issues },
    ...(cur.stage === 1 || !cur.stage ? { stage: 2 } : {}),
  }));
  if (out) notifySaved(pid, out.updatedAt);
  return { issues };
}

// ── 고치기 ──
/**
 * 수정 요청(키·로컬). target: 'all' 또는 섹션 id
 * @returns {Promise<string>} jobId
 */
export async function editSite(pid, { target = 'all', request = '', way = 'key', provider, model } = {}) {
  const r = await startJob(pid, 'edit', { target, request, way, provider, model });
  return r.jobId;
}
/** 수정 요청(쓰던 AI 창에 붙일 글). 답은 acceptChatAnswer로 받으면 그 섹션만 갈아 끼움 */
export async function chatEditPrompt(pid, { target = 'all', request = '' } = {}) {
  const p = await projects.get(pid);
  const html = p?.site?.['index.html'] || '';
  const all = extractSections(html);
  const sections = target === 'all' ? all : all.filter((s) => s.id === target);
  await chatDb.put({ pid, mode: 'edit', target, partial: '', at: Date.now() }).catch(() => { });
  return P.buildChatEditPrompt({ request, target, sections, css: target === 'all' ? '' : p?.site?.['assets/style.css'] || '' });
}

/** 조립 + 정적 검사 + 숨은 틀에서 그려서 검사 → issues[] (연수의 inspect에도 저장) */
export async function runInspect(pid) {
  const p = await projects.get(pid);
  if (!p?.site?.['index.html']) return [problem('no-site', '아직 만든 사이트가 없어요.')];
  const { issues } = await inspectSite(pid, p.site, p.meta || {});
  const out = await projects.patch(pid, () => ({ inspect: { at: Date.now(), issues } }));
  if (out) notifySaved(pid, out.updatedAt);
  return issues;
}

/** 검수 문제를 AI에게(그 섹션만 고침). issueIds를 비우면 오류 전부 → jobId */
export async function fixIssues(pid, issueIds = [], { provider, model } = {}) {
  const p = await projects.get(pid);
  const all = p?.inspect?.issues || [];
  const issues = issueIds.length ? all.filter((i) => issueIds.includes(i.id)) : all.filter((i) => i.level === 'error');
  const r = await startJob(pid, 'fix', { issues, provider, model });
  return r.jobId;
}

/** 판 되돌리기(versions의 id) */
export async function restoreVersion(pid, versionId) {
  const out = await projects.patch(pid, (cur) => { const v = (cur.versions || []).find((x) => x.id === versionId); return v ? { site: v.site, meta: v.meta } : null; });
  if (out) notifySaved(pid, out.updatedAt);
  return !!out;
}
/** 작업 기록·받던 답 조각 지우기(연수를 지울 때·처음부터 다시) */
export async function forgetGeneration(pid) { stopJob(pid); await jobsDb.del(pid).catch(() => { }); await chatDb.del(pid).catch(() => { }); }
/** 사이트 파일 지도(목록 화면용): 섹션·키트 표시·깨진 경로 */
export async function siteMapOf(pid) {
  const p = await projects.get(pid);
  return siteMap(p?.site || {}, { material: Object.keys(await materialFiles(pid)) });
}
export { readJob };
