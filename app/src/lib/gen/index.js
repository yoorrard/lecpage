// AI 생성 API(docs/plan-ai-first.md §15). 화면은 lib/studio.js를 거쳐 이 파일만 부르고, 생성 쪽은 화면을 모릅니다.
//   startGeneration · resumeGeneration · stopGeneration · useGeneration · chatPrompt · acceptChatAnswer
//   editSite · chatEditPrompt · runInspect · fixIssues · bridgeStatus
// 사이트를 바꾸면(작업 끝·쓰던 AI 창의 답) 연수(projects)에 { v:2, site, meta, gen, versions, inspect, notes? }를 저장하고
// 창에 'lecpage:gen-saved'({ pid, at }) 이벤트를 보냄 → 같은 탭의 연수 화면은 다시 읽고 자동 저장의 기준 판을 맞춤(Project.jsx).
// 다른 탭은 db.js onProjectChange로 알게 됨. 검수(runInspect)는 연수를 바꾸지 않음(결과만 돌려주고 이 탭에 기억).
import { useEffect, useState } from 'preact/hooks';
import { projects } from '../db.js';
import { uid } from '../util.js';
import { startJob, resumeJob, stopJob, forgetJob, currentView, liveView, onJobChange, resumeIfOrphaned, inspectSite, notifySaved, versionsAfter, settle } from './job.js';
import { chatDb } from './store.js';
import * as P from './prompts.js';
import { parseChatAnswer, extractHtml, extractSections, extractCss, replaceSections, stitch, htmlCut, trimCss } from './parse.js';
import { readMeta, themeFromCss } from './kit.js';
import { sourceFiles, preparePageImages } from './material.js';

export { bridgeStatus } from './local.js';
export { assembleProject } from './preview.js';
export { pageTitles } from './kit.js';

/**
 * AI로 사이트 만들기 시작. 앞 단계는 저장되며 끊겨도 resumeGeneration으로 이어 함.
 * @param {string} pid
 * @param {{ way?: 'key'|'local'|'demo', provider?: string, model?: string, agent?: 'claude'|'codex', request?: string, reference?: string|{ name, mood } }} o
 *   way 'key': provider를 비우면 지금 연결된 AI. 'local': 연결 프로그램(§10)의 에이전트(agent, 기본 claude). 'demo': 먼저 해보기(어디로도 보내지 않음)
 *   reference는 분위기 설명만 AI에게 붙음(따를 의무 없음)
 * @returns {Promise<string>} jobId (다른 탭이 이미 만드는 중이면 그 작업의 id — useGeneration의 elsewhere가 true)
 */
export async function startGeneration(pid, o = {}) {
  const r = await startJob(pid, 'make', { way: o.way || 'key', provider: o.provider, model: o.model, agent: o.agent, request: o.request, reference: o.reference });
  return r.jobId;
}
/** 멈춘 작업 이어 하기(새로 고침 뒤 useGeneration이 저절로도 부름). change: { provider, model }로 바꿔 이어 할 수 있음(앞 단계 결과 유지) */
export async function resumeGeneration(pid, change = {}) { return (await resumeJob(pid, change)).jobId; }
/** 멈추기 → status 'paused'. resumeGeneration으로 멈춘 단계부터 */
export function stopGeneration(pid) { return stopJob(pid); }
/** 멈추거나 실패한 작업을 그만둠(기록을 지움 → status 'idle'). 도는 중이면 하지 않음 */
export function forgetGeneration(pid) { return forgetJob(pid); }

/**
 * 진행 상태(Preact 훅). 도는 동안 1초마다 now를 넣어 다시 그림(걸린 시간).
 * → { status: 'idle'|'running'|'paused'|'done'|'error', jobId, kind: 'make'|'edit'|'fix', way, provider, model, agent,
 *     step: { name, label_ko, index(1부터), total, received(받은 글자 수) }, steps[{ name, label_ko, status: 'todo'|'running'|'done'|'error', attempts }],
 *     startedAt, updatedAt, endedAt, error: { kind, title, body, actions[], link? } | null, wait: { reason: 'quota'|'retry'|'hidden', until } | null,
 *     notes[], elsewhere(다른 탭이 만드는 중), now }
 * error.actions: 'resume'(이어서 만들기) · 'connect'(다른 AI 고르기) · 'paste'(쓰던 AI 창으로) · 'key'(키 페이지) · 'billing'(결제 페이지) · 'link'(error.link)
 * 처음 그릴 때 새로 고침으로 끊긴 작업이 있으면 저절로 이어 함
 */
export function useGeneration(pid) {
  const [v, setV] = useState(() => liveView(pid) || { status: 'idle', step: null, steps: [], startedAt: 0, error: null });
  useEffect(() => {
    if (!pid) return undefined;
    let on = true;
    let last = null; let n = 0;
    const refresh = () => currentView(pid).then((x) => { last = x; if (on) setV({ ...x, now: Date.now() }); }).catch(() => { });
    refresh();
    resumeIfOrphaned(pid).then(refresh).catch(() => { });
    const off = onJobChange((id) => { if (id === pid) refresh(); });
    const t = setInterval(() => {
      if (!on) return;
      // 다른 탭이 만들던 작업: 그 탭을 닫았으면(잠금이 풀림) 5초마다 확인해 이 탭이 이어 함
      if (last?.status === 'running' && last.elsewhere && ++n % 5 === 0) resumeIfOrphaned(pid).then(refresh).catch(() => { });
      setV((x) => (x.status === 'running' ? { ...x, now: Date.now() } : x));
    }, 1000);
    return () => { on = false; off(); clearInterval(t); };
  }, [pid]);
  return v;
}

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

const CUT = '답이 중간에 끊겼어요. 아래 문구를 AI 창에 보내 이어서 받은 뒤 다시 붙여 넣어 주세요.';
/**
 * 쓰던 AI 창의 답 받기: 붙여 넣은 글 또는 내려받은 .html 파일. 받으면 연수에 저장하고 'lecpage:gen-saved'를 보냄.
 * 잘렸으면 continuePrompt(이어서 문구)를 주고, 다음에 붙여 넣는 답을 앞 조각에 이어 붙임(새로 만들기·수정 요청 모두).
 * target: 수정 요청의 답이면 고친 곳('all' 또는 섹션 id) — 답의 섹션만 갈아 끼움. 비우면 마지막 요청 글(chatPrompt·chatEditPrompt)대로
 * @returns {Promise<{ ok, site?, meta?, problems: string[](답에서 알게 된 것), issues?: issue[](검수), continuePrompt? }>}
 */
export async function acceptChatAnswer(pid, input, { target = '' } = {}) {
  const text = String(typeof input === 'string' ? input : input && typeof input.text === 'function' ? await input.text() : '');
  if (!text.trim()) return { ok: false, problems: ['붙여 넣은 글이 비었어요.'] };
  const p = await projects.get(pid);
  if (!p) return { ok: false, problems: ['연수를 찾지 못했어요. 처음 화면에서 연수를 다시 열어 주세요.'] };
  const st0 = (await chatDb.get(pid).catch(() => null)) || { pid, mode: 'make', partial: '' };
  const edit = (target || st0.mode === 'edit') && !!p.site?.['index.html'];
  const want = edit ? target || st0.target || 'all' : '';
  // 받는 중이던 조각은 같은 일(새로 만들기 / 같은 곳 고치기)의 것만 이어 붙임
  const st = (edit ? st0.mode === 'edit' && (st0.target || 'all') === want : st0.mode !== 'edit') ? st0 : { pid, partial: '' };
  const fresh = /<!doctype\s+html|<html[\s>]/i.test(text);
  const keep = (partial) => chatDb.put({ pid, mode: edit ? 'edit' : 'make', target: want, partial, at: Date.now() }).catch(() => { });

  // 수정 요청의 답: 섹션만 갈아 끼움(문서 전체가 오면 아래 '새 사이트'로 받되 고치기 전 판을 남김)
  if (edit && !(fresh && !st.partial)) {
    const joined = st.partial && !fresh ? stitch(st.partial, text) : text;
    const all = extractSections(extractHtml(joined).html);
    const cut = all.length > 0 && !all[all.length - 1].complete;
    let secs = all.filter((s) => s.complete);
    // 섹션 하나를 고칠 때는 그 섹션만(다른 섹션은 버림). id가 다르거나 없는 섹션 하나만 오면 그 섹션으로 봄
    if (want !== 'all') {
      const same = secs.filter((x) => x.id === want);
      secs = same.length ? same.slice(0, 1) : secs.length === 1 ? [{ ...secs[0], id: want, html: secs[0].id ? secs[0].html.replace(/(<section\b[^>]*\bid\s*=\s*)(["'])[^"']*\2/i, `$1$2${want}$2`) : secs[0].html.replace(/<section\b/i, `<section id="${want}"`) }] : [];
    }
    secs = secs.filter((s) => s.id);
    if (cut) { await keep(joined); return { ok: false, problems: [CUT], continuePrompt: P.buildContinuePrompt(extractHtml(joined).html) }; }
    if (!secs.length) return { ok: false, problems: ['답에서 고친 섹션(<section id="…">)을 찾지 못했어요. 코드 블록 전체를 복사해 붙여 넣어 주세요.'] };
    const c = extractCss(joined.replace(/```html[\s\S]*?(```|$)/gi, ''));
    const site = { ...p.site, 'index.html': replaceSections(p.site['index.html'], secs).html };
    if (c.css && !/<[a-zA-Z]/.test(c.css)) site['assets/style.css'] = `${p.site['assets/style.css'] || ''}\n\n/* 수정 요청 */\n${c.cut ? trimCss(c.css) : c.css}`;
    const meta = { ...(p.meta || {}), theme: { ...(p.meta?.theme || {}), ...themeFromCss(site['assets/style.css'] || ''), ...(c.css ? themeFromCss(c.css) : {}) } };
    const saved = await saveSite(pid, site, meta, 'edit');
    await chatDb.del(pid).catch(() => { });
    return { ok: true, site: saved.site, meta: saved.meta, problems: [], issues: saved.issues };
  }

  // 새 사이트: 앞에서 잘린 조각이 있으면 이어 붙임
  const joined = st.partial && !fresh ? stitch(st.partial, text) : text;
  const a = parseChatAnswer(joined);
  if (!a.html || (!a.doc && !extractSections(a.html).length)) return { ok: false, problems: ['답에서 사이트 HTML을 찾지 못했어요. AI 답의 코드 블록 전체를 복사해 붙여 넣어 주세요.'] };
  if (a.cut || htmlCut(a.html, { doc: a.doc })) {
    await keep(joined); // 붙여 넣은 글 그대로(코드 블록 표시 포함) → 다음 조각을 바르게 이어 붙임
    return { ok: false, problems: [CUT], continuePrompt: P.buildContinuePrompt(a.html) };
  }
  const { html, css } = splitStyles(a.html);
  // 고친 사이트 전체가 오면 지금 사이트의 다른 파일(JS·다른 쪽)은 그대로 두고 받은 것만 바꿈
  const site = { ...(edit ? p.site : {}), 'index.html': html, ...(css ? { 'assets/style.css': css } : {}) };
  const titleTag = (/<title>([^<]*)<\/title>/i.exec(html) || [])[1] || '';
  // 고친 사이트 전체가 왔는데 연수 정보가 없으면 지금 연수 정보를 그대로(새로 만들 때만 제목으로 시작)
  const raw = a.meta || (edit ? { ...(p.meta || {}) } : { title: titleTag.trim() });
  if (!raw.title && titleTag) raw.title = titleTag.trim();
  const r = readMeta({ ...raw, theme: { ...(raw.theme || {}), ...themeFromCss(css) } }, { prev: p.meta });
  const problems = [
    ...(a.meta || edit ? [] : ['답 끝에 연수 정보(lecpage.json)가 없어 제목만 읽었어요. 연수 정보에서 확인해 주세요.']),
    ...(r.meta.sessions?.some((s) => s?.date) ? [] : ['답에 연수 날짜가 없어요. 연수 정보에서 넣어 주세요.']),
    ...r.warnings.filter((w) => w.code !== 'teacher-value' && w.code !== 'title-empty').slice(0, 3).map((w) => w.message_ko),
  ];
  if (!edit) await preparePageImages(pid, p, {}).catch(() => null); // 답이 교재 쪽 그림(material/p-NNN.webp)을 쓸 수 있게
  const saved = await saveSite(pid, site, r.meta, edit ? 'edit' : 'make', problems);
  await chatDb.del(pid).catch(() => { });
  return { ok: true, site: saved.site, meta: saved.meta, problems, issues: saved.issues };
}

/** 쓰던 AI 창의 답으로 받은 사이트를 저장(판 기록·검수 결과와 함께) → { issues } */
async function saveSite(pid, site0, meta0, kind, notes = []) {
  const p = await projects.get(pid);
  const { site, meta } = settle(p || {}, { site: site0, meta: meta0 });
  const { issues } = await inspectSite(pid, site, meta, p);
  remember(pid, issues);
  const at = Date.now();
  const out = await projects.patch(pid, (cur) => ({
    v: 2, site, meta,
    gen: { jobId: 'chat-' + uid(6), status: 'done', way: 'chat', provider: '', model: '', at, kind },
    versions: versionsAfter(cur, kind, { site, meta }, true),
    inspect: { at, issues },
    ...(kind === 'make' ? { notes: notes.length ? notes : undefined, metaChecked: false } : {}),
    ...(cur.stage === 1 || !cur.stage ? { stage: 2 } : {}),
  }));
  if (out) notifySaved(pid, out.updatedAt);
  return { site, meta, issues };
}

// ── 고치기 ──
/**
 * 수정 요청(키·내 PC). target: 'all' 또는 섹션 id. way 'local'이면 agent('claude'|'codex')에게
 * @returns {Promise<string>} jobId
 */
export async function editSite(pid, { target = 'all', request = '', way = 'key', provider, model, agent } = {}) {
  const r = await startJob(pid, 'edit', { target, request, way, provider, model, agent });
  return r.jobId;
}
/** 수정 요청(쓰던 AI 창에 붙일 글). 답은 acceptChatAnswer(pid, 답, { target })로 받으면 그 섹션만 갈아 끼움 */
export async function chatEditPrompt(pid, { target = 'all', request = '' } = {}) {
  const p = await projects.get(pid);
  const html = p?.site?.['index.html'] || '';
  const all = extractSections(html);
  if (!all.length && !html) return '';
  await chatDb.put({ pid, mode: 'edit', target, partial: '', at: Date.now() }).catch(() => { });
  return P.buildChatEditPrompt({ request, target, site: p?.site || {} });
}

// 마지막 검수 결과(이 탭): fixIssues가 key로 찾음
const lastIssues = new Map();
const remember = (pid, issues) => { lastIssues.set(pid, issues); return issues; };
/** 조립 + 정적 검사 + 숨은 틀에서 그려서 검사(390·1280) → issues[](key 붙음). 연수는 바꾸지 않음 */
export async function runInspect(pid) {
  const p = await projects.get(pid);
  if (!p?.site?.['index.html']) return [];
  const { issues } = await inspectSite(pid, p.site, p.meta || {}, p);
  return remember(pid, issues);
}

/**
 * 검수 문제를 AI에게([AI에게 고쳐 달라기]를 누를 때만). ids: issue.key(하나) 또는 issue.id(그 종류 전부), 비우면 꼭 고칠 곳 전부.
 * AI가 지금 사이트 전체와 문제 목록을 보고 바뀐 파일만 돌려줌(키·내 PC 모두)
 * @returns {Promise<string>} jobId 또는 ''
 */
export async function fixIssues(pid, ids = [], { way = 'key', provider, model, agent } = {}) {
  const p = await projects.get(pid);
  const all = lastIssues.get(pid) || p?.inspect?.issues || [];
  const picked = ids.length ? all.filter((i) => ids.includes(i.key) || ids.includes(i.id)) : all.filter((i) => i.level === 'error');
  const issues = picked;
  if (!issues.length) return '';
  const r = await startJob(pid, 'fix', { issues, way, provider, model, agent });
  return r.jobId;
}
