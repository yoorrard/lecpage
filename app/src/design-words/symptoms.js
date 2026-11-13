// 말로 고치기: "좀 답답해 보여요" 같은 말을 디자인 낱말로 옮겨 고칠 안 2~3가지를 냅니다(AI 없이 규칙으로).
// 안마다 바꿀 낱말(words.js)과 까닭 한 줄, 미리 볼 섹션(focus)이 있습니다. 지금 사이트와 같은 안은 내지 않습니다.
import * as E from '../../../skills/lecpage/engine/src/index.js';
import { allWords, wordById, changes, fits, currentVariant, hasVariants, typeKo, MOTION_KO, useText } from './words.js';

/** 입력칸 아래 예시(누르면 바로 찾음). 좁은 칸에는 앞의 여섯 개 */
export const SAYINGS = ['좀 답답해 보여요', '글씨가 잘 안 읽혀요', '너무 심심해요', '움직임이 정신없어요', '학교 느낌이 나면 좋겠어요', '일정이 한눈에 안 들어와요', '더 공식적으로 보이면 좋겠어요', '흔한 사이트 같아요'];

function context(bp0) {
  const bp = E.validate(bp0).blueprint;
  const d = bp.design || {};
  const r = E.resolveDesign(bp);
  const preset = E.getPreset(r.preset);
  const theme = d.theme && d.theme !== 'preset' ? d.theme : preset.theme;
  const cap = E.motionCap(bp.audience, bp.meta?.admin?.kind, 3).cap; // 강사가 고르면 허락되는 가장 높은 단계
  const ranked = E.rankPresets({ moods: d.mood || [], topics: d.topics || [], archetype: bp.archetype?.primary, admin: bp.meta?.admin?.kind, minor: bp.audience?.minor }, E.PRESETS.length).map((x) => x.id);
  return { bp, d, r, preset, theme, motion: r.motion, cap, ranked };
}

// ── 안 만들기 도우미 ──
const fix = (key, title, why, ids, focus = '') => ({ key, title, why, ids, focus });
/** 순위(지금 연수의 주제·분위기)대로, 조건에 맞고 지금 것이 아닌 디자인 n개 */
function presets(c, pred, n = 1, order = c.ranked) {
  return order.filter((id) => id !== c.preset.id && pred(E.getPreset(id))).slice(0, n).map((id) => E.getPreset(id));
}
/** 분위기 낱말로 다시 매긴 순위 */
const rankMoods = (c, moods) => E.rankPresets({ moods, topics: [], archetype: '-', admin: c.bp.meta?.admin?.kind }, E.PRESETS.length).map((x) => x.id);
/** 배치의 '고르는 기준' 글 → 한 문장("…때 좋아요." / "…에 맞아요.") */
export const useLine = (use) => { const u = useText(use); return !u ? '디자인이 기본으로 쓰는 모양이에요.' : /때$/.test(u) ? `${u} 좋아요.` : `${u}에 맞아요.`; };
const whenLine = (p) => { const w = wordById(`preset:${p.id}`).when; return w ? `${w}에 어울려요.` : p.desc_ko; };
const presetFix = (p, why) => fix(`preset:${p.id}`, p.name_ko, why || whenLine(p), [`preset:${p.id}`]);
/** 본문 칸 중에서 pick(지금 배치, 후보 배치)이 참인 첫 후보들 */
function bodyAlts(c, pick, types = null, n = 2) {
  const out = []; const seen = new Set();
  const list = (c.bp.sections || []).filter((s) => hasVariants(s.type) && (!types || types.includes(s.type)));
  if (types) list.sort((a, b) => types.indexOf(a.type) - types.indexOf(b.type));
  for (const s of list) {
    if (out.length >= n || seen.has(s.type)) continue;
    const cur = currentVariant(c.bp, s, c.preset.id);
    const t = cur.type; const all = E.BODY_VARIANTS[t] || {};
    const v = Object.keys(all).find((k) => k !== cur.variant && pick(all[cur.variant] || {}, all[k], k) && fits(c.bp, s, k, c.preset.id));
    if (v) { out.push({ s, id: `body:${t}.${v}`, name: all[v].ko, use: useText(all[v].use) }); seen.add(s.type); }
  }
  return out;
}
const motionFix = (c, to, why, dir = 0) => (to !== c.motion && to >= 0 && to <= 3 && (!dir || Math.sign(to - c.motion) === dir) ? fix(`motion:${to}`, `움직임 ${MOTION_KO[to]}`, why, [`motion:${to}`]) : null);
const SANS_PAIRS = ['pretendard-solo', 'noto-neutral', 'suit-sharp', 'plex-briefing'];
const SERIF = /myeongjo|serif|batang|maruburi|hahmlet|songMyung|ridibatang|gowunBatang|명조|바탕|부리/i;
const DIAGRAM = ['schedule', 'goals', 'steps5', 'glance', 'outline', 'procedure', 'sessions', 'glossary', 'discuss', 'materials', 'message', 'closing'];
const toDiagram = (from, to) => from.lead !== to.lead && ['diagram', 'figure'].includes(to.lead) && !['diagram', 'figure'].includes(from.lead);

/**
 * 규칙: [알아듣는 말, 안 만들기]. 위에서부터 맞는 규칙의 안을 모읍니다.
 * 섹션 이름("일정", "목표" …)이나 사전의 낱말 이름("시계판", "숲의 숨" …)을 말하면 그 칸·그 낱말을 바로 냅니다(아래 find).
 */
const RULES = [
  [/답답|빽빽|꽉 ?차|좁아|숨 ?막|무거워 ?보|갑갑/, (c) => [
    ...presets(c, (p) => ['calm-forest', 'warm-minimal', 'editorial-ink', 'ripple-center', 'vertical-type', 'sunrise-warm', 'corporate-clean'].includes(p.id)).map((p) => fix(`preset:${p.id}`, `여백이 넓은 디자인: ${p.name_ko}`, '상자가 적고 글 사이가 넓어 트여 보여요.', [`preset:${p.id}`])),
    c.theme === 'dark' ? fix('theme:light', '밝은 화면', '어두운 바탕은 좁아 보여요. 밝게 바꾸면 트여 보여요.', ['theme:light']) : null,
    c.motion >= 2 ? motionFix(c, 1, '움직이는 것이 많으면 화면이 더 꽉 차 보여요.') : null,
    ...bodyAlts(c, (from, to) => /벤토|타일|카드|모자이크|벽|쪽지/.test(from.ko || '') && to.tags?.includes('calm') && to.lead === 'text').slice(0, 1).map((x) => fix(x.id, `${typeKo(x.s.type)}: ${x.name}`, '칸이 많은 배치를 가는 선으로 나눈 줄 목록으로 바꿔요.', [x.id], x.s.id)),
  ]],
  [/글씨|글자|안 ?읽|읽기 ?(어렵|힘들)|작아|흐릿|가독|눈이 ?아파/, (c) => {
    const body = c.r.fonts?.body || c.preset.fonts?.body || '';
    const serif = SERIF.test(body) || SERIF.test(E.FONTS[body]?.family || '');
    const pair = SANS_PAIRS.find((id) => c.d.fontPair !== id);
    return [
      c.theme === 'dark' ? fix('theme:light', '밝은 화면', '밝은 바탕의 어두운 글자가 가장 잘 읽혀요.', ['theme:light']) : null,
      serif && pair ? fix(`font:${pair}`, `본문을 고딕으로: ${wordById(`font:${pair}`).name}`, '작은 글씨는 획이 고른 고딕 글꼴이 또렷해요.', [`font:${pair}`]) : null,
      ...presets(c, (p) => ['official-brief', 'corporate-clean', 'paper-workbook'].includes(p.id)).map((p) => fix(`preset:${p.id}`, `글이 또렷한 디자인: ${p.name_ko}`, '읽기 좋은 고딕 본문에 장식이 적은 디자인이에요.', [`preset:${p.id}`])),
      c.motion >= 2 ? motionFix(c, 1, '제목과 숫자가 움직이지 않아 읽기 편해요.') : null,
    ];
  }],
  [/심심|밋밋|단조|평범|지루|허전|밍밍|재미 ?없|무난/, (c) => {
    const d = bodyAlts(c, toDiagram, DIAGRAM, 2);
    return [
      d.length ? fix(`body:${d.map((x) => x.id).join('+')}`, `본문에 도식: ${d.map((x) => `${typeKo(x.s.type)} ${x.name}`).join(', ')}`, '글만 있던 칸을 교재 값으로 그린 도식으로 바꿔요.', d.map((x) => x.id), d[0].s.id) : null,
      !c.preset.showcase ? presets(c, (p) => p.showcase).map((p) => fix(`preset:${p.id}`, `그림이 있는 첫 화면: ${p.name_ko}`, '연수 제목으로 그린 그림이 첫 화면에 들어가요.', [`preset:${p.id}`]))[0] : null,
      c.motion < Math.min(c.cap, 3) ? motionFix(c, c.motion + 1, `한 단계 올려요. ${['', '섹션이 나타날 때 살짝 움직여요.', '제목·숫자·배경이 은은하게 움직여요.', '스크롤에 맞춰 장면이 바뀌어요.'][c.motion + 1]}`, 1) : null,
    ];
  }],
  [/정신 ?없|어지러|산만|너무 ?(많이 )?움직|번잡|멀미|현란|눈이 ?피곤|움직임이 ?(많|과)/, (c) => [
    c.motion > 1 ? motionFix(c, 1, '섹션이 나타날 때만 살짝 움직여요.') : null,
    c.motion > 0 ? motionFix(c, 0, '움직임 없이 보여 줘요. 오래된 기기에서도 가벼워요.') : null,
    c.r.graphic ? fix('fx:-graphic', '첫 화면 그래픽 빼기', '첫 화면 바탕에서 계속 움직이는 그림을 빼요.', ['fx:-graphic']) : null,
  ]],
  [/학교|교실|칠판|선생님 ?느낌|아이들|초등|학생|수업 ?느낌/, (c) => presets(c, (p) => ['chalkboard', 'paper-workbook', 'playground', 'soft-pastel'].includes(p.id), 3).map((p) => presetFix(p, whenLine(p)))],
  [/공식|격식|정중|단정|신뢰|교육청|공문|딱딱하게|진지|점잖|무게감/, (c) => [
    ...presets(c, (p) => ['official-brief', 'swiss-offset', 'corporate-clean'].includes(p.id), 2).map((p) => presetFix(p, whenLine(p))),
    c.motion > 1 ? motionFix(c, 1, '움직임을 줄이면 더 단정해 보여요.') : null,
  ]],
  [/따뜻|포근|부드럽|감성|다정|편안|아늑|정겹/, (c) => [
    ...presets(c, () => true, 2, rankMoods(c, ['warm', 'emotional', 'calm'])).map((p) => presetFix(p, whenLine(p))),
    c.theme === 'dark' ? fix('theme:light', '밝은 화면', '밝은 바탕이 더 포근해 보여요.', ['theme:light']) : null,
  ]],
  [/세련|고급|트렌디|요즘|멋있|멋지|감각|모던|힙/, (c) => presets(c, () => true, 3, rankMoods(c, ['bold', 'editorial', 'futuristic', 'minimal'])).map((p) => presetFix(p, whenLine(p)))],
  [/눈부|너무 ?밝|하얘|새하얀|어둡게|다크|밤 ?느낌/, (c) => [
    c.theme !== 'dark' ? fix('theme:dark', '어두운 화면', '어두운 바탕에 밝은 글자예요. 어두운 강당에서 눈이 편해요.', ['theme:dark']) : null,
    ...presets(c, (p) => p.theme === 'dark', 1).map((p) => presetFix(p, whenLine(p))),
  ]],
  [/어두워|칙칙|침침|우중충|밝게|환하게/, (c) => [
    c.theme !== 'light' ? fix('theme:light', '밝은 화면', '밝은 바탕에 어두운 글자로 바꿔요.', ['theme:light']) : null,
    ...presets(c, (p) => p.theme === 'light', 1, rankMoods(c, ['warm', 'playful'])).map((p) => presetFix(p, whenLine(p))),
  ]],
  [/색|촌스|알록|컬러|톤이/, (c, text) => {
    const hint = E.requestHints(text);
    const moods = c.d.mood?.length ? c.d.mood : c.preset.moods;
    const pals = E.PALETTE_SEEDS.map((s, i) => ({ s, i, n: (s.moods || []).filter((m) => moods.includes(m)).length * 2 + (s.topics || []).filter((t) => (c.d.topics || []).includes(t)).length }))
      .filter((x) => x.s.id !== c.d.palette).sort((a, b) => b.n - a.n || a.i - b.i).slice(0, 2).map((x) => x.s);
    return [
      hint.accent ? fix(`accent:${hint.accent}`, '말한 색을 강조색으로', '번호·링크·버튼에 그 색을 써요. 글자가 잘 보이게 밝기는 맞춰요.', [`accent:${hint.accent}`]) : null,
      ...pals.map((s) => fix(`palette:${s.id}`, `색 조합: ${s.name_ko}`, s.note_ko ? `${s.note_ko}.` : '모양은 그대로, 색만 바꿔요.', [`palette:${s.id}`])),
    ];
  }],
  [/첫 ?화면|표지|첫인상|제목이 ?(안 ?보|작|약)|임팩트|눈에 ?(안|잘 ?안) ?띄/, (c) => [
    ...presets(c, (p) => ['keynote-dark', 'kinetic-type', 'cover-sheet', 'night-story', 'editorial-ink'].includes(p.id), 2).map((p) => presetFix(p, whenLine(p))),
    !c.preset.showcase ? presets(c, (p) => p.showcase).map((p) => fix(`preset:${p.id}`, `그림이 있는 첫 화면: ${p.name_ko}`, '연수 제목으로 그린 그림이 첫 화면에 들어가요.', [`preset:${p.id}`]))[0] : null,
  ]],
  [/길어|스크롤이 ?(많|길)|너무 ?길|끝이 ?안|휴대폰|모바일|폰에서/, (c) => bodyAlts(c, (from, to) => /넘김|아코디언|색인 줄|필름/.test(to.ko) && !/넘김|아코디언|필름/.test(from.ko || ''), ['outline', 'steps5', 'faq', 'glossary'], 3)
    .map((x) => fix(x.id, `${typeKo(x.s.type)}: ${x.name}`, '가로로 넘기거나 접어 두어 세로 길이가 줄어요.', [x.id], x.s.id))],
  [/글만|글이 ?많|그림이 ?없|텍스트/, (c) => {
    const d = bodyAlts(c, toDiagram, DIAGRAM, 3);
    return d.map((x) => fix(x.id, `${typeKo(x.s.type)}: ${x.name}`, useLine(x.use), [x.id], x.s.id));
  }],
  [/뻔|비슷|똑같|AI ?(가 ?만든|같|티)|흔해|흔한|틀에 ?박|템플릿/, (c) => {
    const d = bodyAlts(c, toDiagram, DIAGRAM, 2);
    return [
      ...presets(c, (p) => (p.layout || 'left') !== 'left', 2).map((p) => fix(`preset:${p.id}`, `배치가 다른 디자인: ${p.name_ko}`, `${wordById(`hero:${p.layout}`).name} 배치예요. 흔한 왼쪽 정렬과 달라요.`, [`preset:${p.id}`])),
      d.length ? fix(`body:${d.map((x) => x.id).join('+')}`, `본문에 도식: ${d.map((x) => `${typeKo(x.s.type)} ${x.name}`).join(', ')}`, '같은 모양 카드 대신 교재 값으로 그린 도식이 들어가요.', d.map((x) => x.id), d[0].s.id) : null,
    ];
  }],
  [/화려|역동|생동|생기|움직였|움직이면|움직임이 ?있|스크롤 ?연출|애니메이션|활기/, (c) => [
    motionFix(c, Math.min(3, c.cap), c.cap >= 3 ? '스크롤에 맞춰 장면이 바뀌어요. 휴대폰에서는 한 단계 낮춰 보여요.' : '제목·숫자·배경이 은은하게 움직여요.', 1),
    !c.preset.showcase ? presets(c, (p) => p.showcase).map((p) => fix(`preset:${p.id}`, `그림이 움직이는 첫 화면: ${p.name_ko}`, '첫 화면 그림이 마우스에 반응해 움직여요.', [`preset:${p.id}`]))[0] : null,
    ...presets(c, (p) => ['kinetic-type', 'keynote-dark', 'night-story'].includes(p.id), 1).map((p) => presetFix(p, whenLine(p))),
  ]],
  [/깔끔|정돈|미니멀|심플|단순|군더더기|정갈/, (c) => [
    ...presets(c, (p) => (p.moods || []).includes('minimal'), 2, rankMoods(c, ['minimal', 'calm'])).map((p) => presetFix(p, whenLine(p))),
    c.motion > 1 ? motionFix(c, 1, '움직임을 줄이면 더 정돈돼 보여요.') : null,
  ]],
  [/발랄|귀엽|재밌|재미있|신나|경쾌|통통|아기자기/, (c) => presets(c, () => true, 3, rankMoods(c, ['playful', 'energetic'])).map((p) => presetFix(p, whenLine(p)))],
];

// 섹션을 부르는 말 → 섹션 종류
const SECTION_WORDS = [
  [/목표/, 'goals'], [/일정|시간표/, 'schedule'], [/차례|순서|목차/, 'outline'], [/핵심 ?단계|단계/, 'steps5'], [/연수 후|다시 ?보기/, 'followup'], [/자료/, 'materials'],
  [/강사|소개/, 'instructor'], [/연사/, 'speakers'], [/차시/, 'sessions'], [/자주 ?묻|FAQ|질문과 ?답/i, 'faq'], [/용어|낱말 ?풀이/, 'glossary'], [/절차/, 'procedure'],
  [/사례/, 'cases'], [/나눌 ?질문|토론/, 'discuss'], [/표가|표를|표는/, 'table'], [/핵심 ?메시지|메시지/, 'message'], [/마무리|맺음/, 'closing'], [/한눈에 ?보기|숫자/, 'glance'],
  [/도구/, 'tools'], [/준비/, 'readiness'], [/교재/, 'deck'], [/퀴즈/, 'quiz'], [/설문|만족도/, 'survey'], [/투표/, 'poll'], [/보드|나눔/, 'board'], [/질문 ?받|질문/, 'qa'], [/사진/, 'gallery'], [/기록/, 'reflection'],
];

/**
 * 말 → 고칠 안(많아야 n개). 규칙에 없으면 분위기 낱말·요청 읽기(requestHints)로 한 번 더 찾습니다.
 * @returns {{ fixes: [{key,title,why,ids,focus}], heard: string[], already: string[] }} heard = 알아들은 것, already = 말한 낱말인데 이미 쓰고 있는 것
 */
export function findFixes(bp0, text, n = 3) {
  const t = String(text || '').trim().slice(0, 300);
  if (!t || !bp0) return { fixes: [], heard: [] };
  const c = context(bp0);
  const out = []; const heard = []; const already = [];
  const push = (f) => { if (!f || !f.ids?.length) return; f.ids = f.ids.filter((id) => changes(c.bp, id)); if (f.ids.length && !out.some((x) => x.key === f.key)) out.push(f); };
  // 1) 사전의 낱말 이름을 그대로 말했을 때(두 글자 이상, 긴 이름 먼저)
  const named = allNamed().filter((w) => t.includes(w.short));
  for (const w of named.slice(0, 3)) {
    const sec = w.kind === 'body' ? (c.bp.sections || []).find((s) => hasVariants(s.type) && currentVariant(c.bp, s, c.preset.id).type === w.type) : null;
    if (!changes(c.bp, w.id)) { already.push(w.name); continue; }
    push(fix(w.id, `${w.kind === 'body' ? `${w.section}: ` : ''}${w.name}`, w.kind === 'body' ? useLine(w.when) : w.when ? `${w.when}에 어울려요.` : w.look, [w.id], sec?.id || ''));
    heard.push(w.name);
  }
  // 2) 섹션을 말했을 때: 그 칸에 맞는 다른 배치
  const types = SECTION_WORDS.filter(([re]) => re.test(t)).map(([, ty]) => ty);
  for (const ty of [...new Set(types)]) {
    const s = (c.bp.sections || []).find((x) => x.type === ty || (ty === 'materials' && x.type === 'followup'));
    if (!s || !hasVariants(s.type)) continue;
    const cur = currentVariant(c.bp, s, c.preset.id); const all = E.BODY_VARIANTS[cur.type] || {};
    const glance = /한눈|그림|도식|보기 ?쉽/.test(t);
    const opts = Object.keys(all).filter((v) => v !== cur.variant && fits(c.bp, s, v, c.preset.id))
      .sort((a, b) => (glance ? (['diagram', 'figure', 'number'].includes(all[b].lead) ? 1 : 0) - (['diagram', 'figure', 'number'].includes(all[a].lead) ? 1 : 0) : 0));
    for (const v of opts.slice(0, 3)) push(fix(`body:${cur.type}.${v}`, `${typeKo(s.type)}: ${all[v].ko}`, useLine(all[v].use), [`body:${cur.type}.${v}`], s.id));
    heard.push(typeKo(s.type));
  }
  // 3) 규칙
  for (const [re, make] of RULES) {
    const m = re.exec(t); if (!m) continue;
    heard.push(m[0]);
    for (const f of make(c, t) || []) push(f);
  }
  // 4) 그래도 없으면: 분위기 낱말·밝기·움직임·색 이름
  if (!out.length) {
    const h = E.requestHints(t);
    if (h.mood?.length) { for (const p of presets(c, () => true, 2, rankMoods(c, h.mood))) push(presetFix(p, whenLine(p))); heard.push(...h.mood.map((m) => wordMood(m))); }
    if (h.theme) push(fix(`theme:${h.theme}`, h.theme === 'dark' ? '어두운 화면' : '밝은 화면', '화면 밝기를 바꿔요.', [`theme:${h.theme}`]));
    if (h.motion !== undefined) push(motionFix(c, Math.min(h.motion, c.cap), `${MOTION_KO[Math.min(h.motion, c.cap)]} 단계로 바꿔요.`));
    if (h.accent) push(fix(`accent:${h.accent}`, '말한 색을 강조색으로', '번호·링크·버튼에 그 색을 써요.', [`accent:${h.accent}`]));
  }
  return { fixes: out.slice(0, n), heard: [...new Set(heard)], already };
}
const wordMood = (m) => ({ calm: '차분', warm: '따뜻', emotional: '감성', playful: '경쾌', energetic: '활기', tech: '테크', futuristic: '미래', editorial: '잡지', formal: '공식', natural: '자연', retro: '레트로', minimal: '깔끔', bold: '대담', handmade: '손맛' }[m] || m);

let named = null;
/** 사전 낱말 가운데 말 속에서 찾을 이름(괄호 앞, 두 글자 이상, 흔한 낱말은 뺌) */
function allNamed() {
  if (named) return named;
  const COMMON = new Set(['보통', '정적', '밝게', '어둡게', '표', '판', '벽', '줄 목록', '번호 줄', '계단', '책장', '명함']);
  named = allWords().map((w) => ({ ...w, short: String(w.name).replace(/\s*\(.*$/, '') }))
    .filter((w) => w.short.length >= 3 && !COMMON.has(w.short) && !w.off && ['preset', 'body', 'fx', 'color', 'font'].includes(w.kind) && w.sub !== 'theme')
    .sort((a, b) => b.short.length - a.short.length);
  return named;
}
