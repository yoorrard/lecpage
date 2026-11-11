// AI 없이 교재만으로 연수 설계도(blueprint v1) 초안 만들기. docs/architecture.md §2를 따릅니다.
// 결과는 validate()로 한 번 더 다듬어 쓰면 됩니다. 감지가 틀릴 수 있으니 사람이 고칠 자리를 비워 둡니다(지어내지 않음).
import { randomCode, followupKind } from '../validate.js';
import { DEFAULT_SURVEY } from '../schema/sections.js';
import { detect } from './detect.js';
import { normLine, normText, truncate, textKey, sizeLabel, hostOf, extOf } from './util.js';
import { getTool } from './tools-db.js';

const pad3 = (n) => String(n).padStart(3, '0');
const ACCOUNT_LABEL = {
  google: { label: 'Google 계정 로그인', url: 'https://accounts.google.com' },
  microsoft: { label: 'Microsoft 계정 로그인', url: 'https://login.live.com' },
  naver: { label: '네이버 계정 로그인', url: 'https://nid.naver.com' },
  email: { label: '이메일 가입 계정 준비', url: '' },
  teacher: { label: '교사용 계정 준비(참여자는 코드로 입장)', url: '' },
  school: { label: '학교·교육청 발급 계정 준비', url: '' },
};
// 유형별 섹션 순서. 원칙: 첫 화면(이야기형은 핵심 메시지까지) → 무엇을 얻나(목표) → 준비 → 본문 → 자료·연수 후 → 강사 → 설문 → 마무리(설문을 마무리 뒤에 두면 놓치기 쉬움)
const ORDER = {
  lab: ['hero', 'goals', 'readiness', 'outline', 'schedule', 'stations', 'prompts', 'tools', 'deck', 'quiz', 'glossary', 'faq', 'materials', 'followup', 'instructor', 'survey', 'closing'],
  story: ['hero', 'message', 'goals', 'outline', 'schedule', 'deck', 'tools', 'stations', 'prompts', 'quiz', 'glossary', 'faq', 'materials', 'followup', 'instructor', 'survey', 'closing'],
  live: ['hero', 'glance', 'goals', 'schedule', 'outline', 'deck', 'tools', 'prompts', 'materials', 'faq', 'followup', 'instructor', 'survey', 'closing'],
  course: ['hero', 'goals', 'glance', 'sessions', 'outline', 'schedule', 'readiness', 'stations', 'prompts', 'tools', 'deck', 'materials', 'faq', 'glossary', 'followup', 'instructor', 'survey'],
};
const LEAD = /^(?:[-•·▪◦●○■□▶▷►➢➤→⇒✓✔☞]\s*|\d{1,2}\s*[.)]\s+|[①-⑳]\s*)/;
// 연수 목표가 적힌 쪽(제목이 '연수 목표'·'학습 목표'·'이 연수를 마치면' 등)
const GOAL_TITLE = /^(?:\d{1,2}\s*[.)]\s*)?(?:오늘의\s*|이\s*연수의\s*)?(?:연수|학습|교육|수업)?\s*(?:목표|목적)(?:\s*및\s*내용)?$|^(?:이런\s*(?:것|걸)을?\s*배워요|오늘\s*배울\s*(?:것|내용)|이\s*연수를\s*마치면.*|기대\s*효과)$/;
const GOAL_LINE = /^(?:연수|학습|교육)\s*(?:목표|목적)\s*[:：]\s*(.{6,160})$/;
const WHO_LINE = /^(?:연수\s*|참가\s*|교육\s*)?대상\s*[:：]\s*(.{2,100})$/;
const CONTACT_LINE = /^(?:문의|문의처|연락처|담당자?)\s*[:：]\s*(.{4,110})$/;
const NOTE_LINE = /^(?:※\s*|\*\s+)(.{4,200})$|^((?:주의|유의|tip|팁|안\s*되면|안\s*될\s*때|막히면|막힐\s*때)\s*[:：)]\s*.{4,200})$/i;
const MORE_TITLE = /(참고\s*(?:자료|문헌|사이트|링크)|더\s*(?:알아보기|살펴보기|읽을거리)|추천\s*(?:자료|도서|사이트)|함께\s*보면|읽을거리|resources?|references?|further\s*reading)/i;
const paraLines = (p) => (p.paragraphs || []).map((x) => normLine(x.text)).filter(Boolean);

/** 교재에 적힌 연수 목표(지어내지 않음): 목표 쪽의 항목, 없으면 "연수 목표: …" 한 줄 */
function findGoals(pages, promptKeys) {
  for (const p of pages.slice(0, 12)) {
    if (!GOAL_TITLE.test(normLine(p.title || ''))) continue;
    const items = paraLines(p).map((t) => t.replace(LEAD, '').trim()).filter((t) => t.length >= 6 && t.length <= 110 && !promptKeys.has(textKey(t)) && !/https?:\/\//.test(t));
    if (items.length) return items.slice(0, 5);
  }
  for (const p of pages.slice(0, 6)) for (const t of paraLines(p)) { const m = GOAL_LINE.exec(t); if (m) return m[1].split(/\s*[;／]\s*/).map((x) => x.trim()).filter((x) => x.length >= 4).slice(0, 5); }
  return [];
}
function findLine(pages, re) {
  for (const p of pages) for (const t of [p.title || '', ...paraLines(p)]) { const m = re.exec(normLine(t)); if (m) return truncate(m[1].trim(), 110); }
  return '';
}

function minutesBetween(a, b) {
  const m1 = /^(\d{2}):(\d{2})$/.exec(a || ''), m2 = /^(\d{2}):(\d{2})$/.exec(b || '');
  if (!m1 || !m2) return 0;
  const d = (+m2[1] * 60 + +m2[2]) - (+m1[1] * 60 + +m1[2]);
  return d > 0 ? d : 0;
}
function koDateText(date, start, end) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || '');
  if (!m) return [start, end].filter(Boolean).join('~');
  const w = '일월화수목금토'[new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay()];
  return `${m[1]}. ${+m[2]}. ${+m[3]}.(${w})${start ? ` ${start}${end ? `~${end}` : ''}` : ''}`;
}
function hoursLabel(min) {
  if (!min) return '';
  const h = Math.floor(min / 60), m = min % 60;
  return h && m ? `${h}시간 ${m}분` : h ? `${h}시간` : `${m}분`;
}

/**
 * @param {object} material ingest 결과(detected가 없으면 여기서 감지)
 * @param {object} [info] 사용자가 직접 준 정보(감지보다 우선)
 *   title, subtitle, organizer, date, start, end, venue, mode, joinUrl, size, audience{}, level, archetype,
 *   instructor{name,role,org,email,bio}, surveyUrl, slidesBase('assets/slides/'), imageBase('assets/media/'),
 *   deckHref, materials{ [fileId]: href }, today, goals[], who, contact, dates[](차시 날짜)
 */
export function materialToDraft(material, info = {}) {
  const d = material.detected || detect(material, info);
  const ev = d.event || {};
  const files = material.files || [];
  const renderOnly = new Set(files.filter((f) => f.renderOf).map((f) => f.id));
  const pages = (material.pages || []).filter((p) => !p.hidden && !p.error && !renderOnly.has(p.file));
  const pageKey = (f, n) => `${f}:${n}`;
  const pageMap = new Map(pages.map((p) => [pageKey(p.file, p.page), p]));

  // ── meta ────────────────────────────────
  const meta = {
    title: info.title || d.title || '연수',
    subtitle: info.subtitle ?? d.subtitle ?? '',
    organizer: info.organizer || ev.organizer || '',
    date: info.date || ev.date || '',
    start: info.start || ev.start || '',
    end: info.end || ev.end || '',
    venue: info.venue || ev.venue || '',
    mode: info.mode || ev.mode || 'offline',
    joinUrl: info.joinUrl || ev.joinUrl || '',
    contact: info.contact || findLine([...pages.slice(0, 3), ...pages.slice(-3)], CONTACT_LINE),
    lang: 'ko',
    admin: { kind: info.adminKind || 'school', completionRate: +info.completionRate || 90, hours: Math.round((minutesBetween(info.start || ev.start, info.end || ev.end) / 60) * 10) / 10 },
    sessions: [],
  };
  if (meta.subtitle === meta.title) meta.subtitle = '';
  const durationMin = info.durationMin || minutesBetween(meta.start, meta.end);

  // ── 강사 ─────────────────────────────────
  const instructors = [];
  const di = info.instructor || (d.instructor && d.instructor.name ? d.instructor : null);
  if (di && di.name) {
    const now = (di.bio || []).filter((t) => /^\s*\(?\s*(현|現)/.test(t)).map((t) => t.replace(/^\s*\(?\s*(현|現)\s*\)?\s*[)\].:]?\s*/, ''));
    const past = (di.bio || []).filter((t) => /^\s*\(?\s*(전|前)/.test(t)).map((t) => t.replace(/^\s*\(?\s*(전|前)\s*\)?\s*[)\].:]?\s*/, ''));
    const other = (di.bio || []).filter((t) => !/^\s*\(?\s*(현|現|전|前)/.test(t));
    const timeline = [];
    if (now.length) timeline.push({ group: '지금', items: now.map((text) => ({ text })) });
    if (past.length) timeline.push({ group: '지난 활동', items: past.map((text) => ({ text })) });
    if (other.length) timeline.push({ group: '활동', items: other.map((text) => ({ text })) });
    instructors.push({
      name: di.name, role: di.role || '', org: di.org || '', photo: info.instructor?.photo || '', bio: typeof di.bio === 'string' ? di.bio : '',
      email: di.email || '', showEmail: info.instructor?.showEmail ?? false, tags: [], links: di.links || [], timeline,
    });
  }

  // ── 유형 ─────────────────────────────────
  const arche = d.archetype || { primary: 'story', mix: [] };
  const archetype = { primary: info.archetype || arche.primary, mix: info.archetype ? [] : (arche.mix || []) };

  const refsOf = (x) => x.refs || (x.pages || [x.page]).map((page) => ({ file: x.file, page }));
  const onPages = (x, file, list) => refsOf(x).some((r) => r.file === file && list.includes(r.page));
  const toolNamesOn = (file, pagesList) => (d.tools || []).filter((t) => onPages(t, file, pagesList)).map((t) => t.name);

  // ── 실습 스테이션 ─────────────────────────
  const sectionOf = (file, page) => (d.sections || []).find((s) => s.file === file && s.pages.includes(page));
  const practice = (d.practice?.pages || []).map((r) => pageMap.get(pageKey(r.file, r.page))).filter(Boolean);
  const groups = [];
  for (const p of practice) {
    const last = groups[groups.length - 1];
    const sec = sectionOf(p.file, p.page);
    const lastP = last?.pages[last.pages.length - 1];
    const cont = last && lastP.file === p.file && p.page === lastP.page + 1 && last.section === sec
      && (textKey(p.title) === textKey(last.title) || /\(계속\)|계속$|cont/i.test(p.title || '') || !p.title || textKey(p.title).startsWith(textKey(last.title).slice(0, 6)) && textKey(last.title).length >= 6);
    if (cont) last.pages.push(p);
    else groups.push({ title: p.title || '', pages: [p], section: sec });
  }
  const usedPrompts = new Set();
  const stations = groups.slice(0, 40).map((g, i) => {
    const file = g.pages[0].file;
    const nums = g.pages.map((p) => p.page);
    const inG = (x) => x.file === file && nums.includes(x.page);
    const steps = (d.steps || []).filter(inG).flatMap((s) => s.items).slice(0, 20);
    const prompts = (d.prompts || []).filter((x) => onPages(x, file, nums)).slice(0, 12);
    prompts.forEach((x) => usedPrompts.add(x));
    const stepKeys = new Set(steps.map(textKey));
    const promptKeys = prompts.map((x) => textKey(x.text));
    const links = (d.links || []).filter((l) => onPages(l, file, nums) && l.kind !== 'meeting').slice(0, 8).map((l) => ({ label: l.label, url: l.url }));
    const linkLabels = new Set(links.map((l) => textKey(l.label)));
    const desc = g.pages.flatMap((p) => p.paragraphs || []).map((x) => x.text)
      .find((t) => {
        if (!t || t.length < 8 || t.length > 200) return false;
        const k = textKey(t);
        if (stepKeys.has(k) || linkLabels.has(k) || promptKeys.some((pk) => pk && (k.includes(pk) || pk.includes(k)))) return false;
        return !NOTE_LINE.test(t) && !/^(\d{1,2}[.)]|[①-⑳]|step\s*\d)/i.test(t) && !/https?:\/\/|[a-z0-9-]+\.(com|net|org|io|ai|kr)\b/i.test(t) && !/^[^:：]{1,10}[:：]/.test(t);
      }) || '';
    // 그림 주소: info.imageBase가 있으면 그 아래 <id>.<확장자>, 없으면 CLI가 쓴 상대 경로(assets/… · media/…)
    // 막히기 쉬운 곳: "※ …", "주의: …", "안 되면: …" 줄을 실습 안 메모(note)로
    const note = g.pages.flatMap(paraLines).map((t) => NOTE_LINE.exec(t)).filter(Boolean).map((m) => (m[1] || m[2]).trim())
      .filter((t) => !stepKeys.has(textKey(t)) && !promptKeys.some((pk) => pk && textKey(t).includes(pk))).slice(0, 2).join('\n');
    const imgSrc = (im) => (info.imageBase ? info.imageBase + imageName(im) : (/^(assets|media|slides)\//.test(im.src || '') ? im.src : ''));
    const images = g.pages.flatMap((p) => (p.images || []).filter((im) => !im.repeated && im.web !== false && (im.share || 0.3) >= 0.08))
      .map((im) => ({ src: imgSrc(im), caption: im.alt || '' })).filter((im) => im.src).slice(0, 8);
    const title = normLine(g.title) || `실습 ${i + 1}`;
    return {
      id: `st${i + 1}`, name: truncate(title.replace(/^(실습|활동|미션)\s*\d*\s*[.:)\-–]?\s*/, '') || title, 30), title: truncate(title, 100),
      tag: g.section ? truncate(g.section.label || '', 16) : '', desc: truncate(desc, 300),
      steps, prompts: prompts.map((x, k) => ({ title: x.title || (prompts.length > 1 ? `프롬프트 ${k + 1}` : '프롬프트'), text: x.text })),
      images, links, outcome: '', note: truncate(note, 400), minutes: 0, source: { file, pages: nums },
    };
  }).filter((s) => s.steps.length || s.prompts.length || s.links.length || s.desc);

  // ── 섹션 만들기 ───────────────────────────
  const S = {};
  const hasDeckFile = files.find((f) => (f.type === 'pptx' || f.type === 'pdf') && !f.renderOf);
  const dateText = koDateText(meta.date, meta.start, meta.end);
  const heroMeta = [];
  if (dateText) heroMeta.push({ label: '일시', value: dateText });
  const place = [meta.venue, meta.mode === 'online' || meta.mode === 'hybrid' ? '온라인' : ''].filter(Boolean).join(' · ');
  if (place) heroMeta.push({ label: '장소', value: place });
  if (instructors[0]) heroMeta.push({ label: '강사', value: [instructors[0].name, [instructors[0].org, instructors[0].role].filter(Boolean).join(' ')].filter(Boolean).join(' · ') });
  const ctas = [];
  if (stations.length) ctas.push({ label: '실습 시작', href: '#stations' });
  if (hasDeckFile) ctas.push({ label: '교재 보기', href: '#deck' });
  if (!ctas.length && (d.sections || []).length) ctas.push({ label: '차례 보기', href: '#outline' });
  S.hero = { id: 'hero', type: 'hero', nav: '처음', eyebrow: meta.organizer || '', title: meta.title, subtitle: meta.subtitle, ctas, meta: heroMeta };

  // 연수 목표·대상: 교재에 적힌 것만
  const promptKeySet = new Set((d.prompts || []).map((x) => textKey(x.text)));
  const goalItems = info.goals?.length ? info.goals : findGoals(pages, promptKeySet);
  const who = info.who || findLine(pages.slice(0, 3), WHO_LINE);
  // 계획서 말투(~할 수 있다)는 참가자에게 하는 말(~할 수 있어요)로
  if (goalItems.length) S.goals = { id: 'goals', type: 'goals', title: '연수 목표', items: goalItems.map((t) => truncate(t.replace(/(수\s*있)다\.?$/, '$1어요').replace(/(이해|파악|활용|설명|적용)한다\.?$/, '$1해요'), 120)), who };

  const msgs = d.messages || [];
  if (msgs.length) S.message = { id: 'message', type: 'message', text: msgs[0].text, note: '', style: 'statement', source: { file: msgs[0].file, pages: [msgs[0].page] } };

  // 차례
  const outlineItems = (d.sections || []).slice(0, 8).map((s) => ({
    part: s.label, title: s.title, desc: s.desc || '',
    tags: toolNamesOn(s.file, s.pages).slice(0, 3),
    target: hasDeckFile && s.file === hasDeckFile.id ? `deck:${s.page}` : (stations.some((st) => st.source.file === s.file && st.source.pages.some((pg) => s.pages.includes(pg))) ? 'stations' : ''),
  }));
  if (!outlineItems.length && d.agenda?.items?.length >= 2) {
    d.agenda.items.slice(0, 8).forEach((it, i) => outlineItems.push({ part: it.part || `PART ${i + 1}`, title: it.text, desc: '', tags: [], target: '' }));
  }
  if (outlineItems.length >= 2) S.outline = { id: 'outline', type: 'outline', nav: '차례', title: '오늘의 차례', items: outlineItems };

  // 차시(날짜가 둘 이상): 제목은 교재 차례와 개수가 맞을 때만 가져옴(지어내지 않음)
  const dates = info.dates?.length ? info.dates : (ev.dates || []);
  if (dates.length >= 2) {
    meta.sessions = dates.map((date, i) => ({ no: i + 1, date, start: '', end: '', title: '' }));
    const titles = (d.sections || []).length === dates.length ? d.sections.map((x) => x.title) : (d.agenda?.items || []).length === dates.length ? d.agenda.items.map((x) => x.text) : [];
    if (titles.length) S.sessions = { id: 'sessions', type: 'sessions', nav: '차시', items: dates.map((date, i) => ({ no: i + 1, date, title: titles[i], desc: '', links: [] })) };
  }

  // 일정(교재에 시간이 적혀 있을 때만)
  const timed = (d.agenda?.items || []).filter((it) => it.start);
  if (timed.length >= 2) S.schedule = { id: 'schedule', type: 'schedule', nav: '일정', items: timed.map((it) => ({ start: it.start, end: it.end || '', title: it.text, desc: '', part: it.part || '' })) };
  else if ((d.sections || []).filter((s) => s.start).length >= 2) S.schedule = { id: 'schedule', type: 'schedule', nav: '일정', items: d.sections.filter((s) => s.start).map((s) => ({ start: s.start, end: s.end || '', title: s.title, desc: '', part: s.label })) };

  // 준비 점검
  const tools = d.tools || [];
  const accounts = new Map();
  const practiceRefs = (d.practice?.pages || []);
  const usedInPractice = tools.filter((t) => refsOf(t).some((r) => practiceRefs.some((pr) => pr.file === r.file && pr.page === r.page)));
  const readyTools = usedInPractice.length ? usedInPractice : tools.filter((t) => t.count >= 2);
  for (const t of readyTools) if (t.accountNeeded && ACCOUNT_LABEL[t.account]) { if (!accounts.has(t.account)) accounts.set(t.account, []); accounts.get(t.account).push(t.name); }
  const readyItems = [...accounts.entries()].map(([k, names]) => ({ label: ACCOUNT_LABEL[k].label, detail: `필요한 도구: ${names.slice(0, 6).join(', ')}`, url: ACCOUNT_LABEL[k].url }));
  if (tools.length || stations.length) readyItems.push({ label: '노트북·크롬북에서 최신 브라우저(크롬·엣지·웨일) 열기', detail: '휴대폰보다 큰 화면이 실습하기 편해요.', url: '' });
  const checks = (readyTools.length ? readyTools : tools).filter((t) => t.url).slice(0, 10).map((t) => ({ name: t.name, url: t.url }));
  if (readyItems.length && (stations.length || archetype.primary === 'lab' || archetype.primary === 'course')) S.readiness = { id: 'readiness', type: 'readiness', nav: '준비', items: readyItems, checks };

  if (stations.length) S.stations = { id: 'stations', type: 'stations', nav: '실습', layout: stations.length > 8 ? 'tabs' : 'sidebar', items: stations };

  // 프롬프트 모음(스테이션에 없는 것 포함 전체)
  const allPrompts = (d.prompts || []).slice(0, 40);
  if (allPrompts.length && (allPrompts.length > usedPrompts.size || !stations.length || allPrompts.length >= 3)) {
    S.prompts = { id: 'prompts', type: 'prompts', nav: '프롬프트', items: allPrompts.map((x, k) => ({ title: x.title || pageMap.get(pageKey(x.file, x.page))?.title || `프롬프트 ${k + 1}`, text: x.text, tags: [...new Set(refsOf(x).flatMap((r) => toolNamesOn(r.file, [r.page])))].slice(0, 3) })) };
  }

  // 도구
  if (tools.length) {
    S.tools = {
      id: 'tools', type: 'tools', nav: '도구',
      items: tools.slice(0, 24).map((t) => ({ name: t.name, url: t.url || '', desc: [t.categoryLabel, t.accountNeeded ? accountShort(t.account) : '로그인 없이'].filter(Boolean).join(' · '), pages: hasDeckFile ? refsOf(t).filter((r) => r.file === hasDeckFile.id).map((r) => r.page).slice(0, 12) : [], icon: t.icon || '' })),
      notice: tools.some((t) => /연령|만 1[348]세|보호자/.test(t.minors || '')) ? '학생과 함께 쓸 때는 도구별 연령 기준과 학교·교육청 지침을 먼저 확인해 주세요.' : '',
    };
  }

  // 교재 뷰어
  if (hasDeckFile) {
    const deckPages = pages.filter((p) => p.file === hasDeckFile.id);
    S.deck = {
      id: 'deck', type: 'deck', nav: '교재',
      slides: deckPages.map((p) => ({
        src: p.image || (info.slidesBase ? `${info.slidesBase}slide-${pad3(p.page)}.webp` : ''),
        page: p.page, title: p.title || '',
        text: truncate(normText([...(p.paragraphs || []).map((x) => x.text), ...(p.tables || []).flatMap((t) => t.rows.map((r) => r.filter(Boolean).join(' | ')))].join('\n')), 600),
        tools: toolNamesOn(p.file, [p.page]).slice(0, 4),
      })),
      download: info.deckHref ? { href: info.deckHref, size: sizeLabel(hasDeckFile.size), label: '교재 내려받기' } : undefined,
      notice: '교재는 연수 학습용으로만 써 주세요.',
      source: { file: hasDeckFile.id, pages: [] },
    };
    if (!S.deck.download) delete S.deck.download;
  }

  const quizItems = (d.quiz || []).filter((q) => q.answer >= 0).slice(0, 20).map((q) => ({ q: q.q, options: q.options, answer: q.answer, explain: q.explain || '' }));
  if (quizItems.length) S.quiz = { id: 'quiz', type: 'quiz', nav: '퀴즈', items: quizItems };
  if ((d.glossary || []).length >= 2) S.glossary = { id: 'glossary', type: 'glossary', nav: '용어', items: d.glossary.slice(0, 40).map((g) => ({ term: g.term, desc: g.desc })) };
  if ((d.faq || []).length) S.faq = { id: 'faq', type: 'faq', nav: 'FAQ', items: d.faq.slice(0, 20).map((f) => ({ q: f.q, a: f.a })) };

  const matItems = files.filter((f) => f.type !== 'link').map((f) => ({
    title: f.name, desc: f.pages ? `${f.pages}${f.unit === 'slide' ? '장' : f.unit === 'page' ? '쪽' : '개 부분'}` : '',
    href: info.materials?.[f.id] || (hasDeckFile && f.id === hasDeckFile.id ? info.deckHref || '' : ''), kind: (f.type || extOf(f.name) || 'file').toUpperCase(), size: sizeLabel(f.size),
  }));
  for (const f of files.filter((x) => x.type === 'link')) matItems.push({ title: f.name, desc: hostOf(f.url), href: f.url, kind: 'LINK', size: '' });
  if (matItems.length) S.materials = { id: 'materials', type: 'materials', nav: '자료', items: matItems, notice: '연수 목적으로만 써 주세요. 다른 곳에 올릴 때는 강사에게 먼저 물어봐 주세요.' };

  // 연수 후 안내: '참고 자료'·'더 알아보기' 쪽의 링크와 끝부분의 영상·소통방 링크
  const morePages = pages.filter((p) => MORE_TITLE.test(p.title || ''));
  const tail = pages.slice(-3);
  const seenUrl = new Set([...(S.materials?.items || []).map((x) => x.href), ...stations.flatMap((st) => st.links.map((l) => l.url))]);
  const fu = [];
  for (const l of (d.links || [])) {
    if (fu.length >= 8 || seenUrl.has(l.url) || l.kind === 'meeting') continue;
    const onMore = morePages.some((p) => onPages(l, p.file, [p.page]));
    const k = followupKind(l.url);
    if (onMore || (k !== 'link' && tail.some((p) => onPages(l, p.file, [p.page])))) { seenUrl.add(l.url); fu.push({ title: truncate(l.label || hostOf(l.url), 80), url: l.url, kind: k, desc: '' }); }
  }
  if (fu.length) S.followup = { id: 'followup', type: 'followup', nav: '연수 후', items: fu };

  if (instructors.length) S.instructor = { id: 'instructor', type: 'instructor', nav: '강사', source: d.instructor ? { file: d.instructor.file, pages: [d.instructor.page] } : undefined };
  S.survey = { id: 'survey', type: 'survey', nav: '설문', url: info.surveyUrl || '', qr: true, questions: DEFAULT_SURVEY.map((q) => ({ ...q })) };
  const closingMsg = msgs.find((m) => m.closing) || msgs.find((m) => m !== msgs[0] && m.file === (hasDeckFile && hasDeckFile.id)) || null;
  S.closing = { id: 'closing', type: 'closing', lead: '함께해 주셔서 고맙습니다', text: closingMsg ? closingMsg.text : meta.title, thanks: instructors[0] ? `${instructors[0].name} 드림` : '' };

  const glance = [];
  if (stations.length) glance.push({ value: String(stations.length), label: '실습', note: '' });
  if (tools.length) glance.push({ value: String(tools.length), label: '도구', note: '' });
  if (durationMin) glance.push({ value: hoursLabel(durationMin), label: '연수 시간', note: '' });
  if (hasDeckFile) glance.push({ value: String(hasDeckFile.pages), label: '교재 쪽', note: '' });
  if (glance.length >= 2) S.glance = { id: 'glance', type: 'glance', items: glance };

  if (S.outline) S.outline.source = { file: d.sections?.[0]?.file || '', pages: (d.sections || []).map((s) => s.page) };

  const order = ORDER[archetype.primary] || ORDER.story;
  const sections = order.map((k) => S[k]).filter(Boolean).map((s) => { if (s.source === undefined) delete s.source; return s; });

  const audience = {
    type: info.audience?.type || 'teachers', size: info.size || info.audience?.size || 30, level: info.level || info.audience?.level || 'beginner',
    devices: info.audience?.devices || ['laptop'], network: info.audience?.network || 'good', blocked: info.audience?.blocked || [],
    projector: info.audience?.projector ?? true, minor: !!info.audience?.minor,
  };
  const design = { mood: [], theme: 'preset' };
  const accent = brandAccent(material.design?.colors);
  if (accent) design.accent = accent;
  if (d.fonts) design.sourceFonts = { display: d.fonts.display, body: d.fonts.body }; // 교재 글꼴 → 사이트 글꼴(resolveDesign)

  return {
    version: 1, meta, audience, archetype, design, instructors, sections,
    live: { provider: 'none', features: [], anonymous: true, code: randomCode() },
    privacy: { collect: ['nickname'], retentionDays: 30, consent: true, processors: [] },
    deploy: { target: 'zip', base: '/' },
    sources: files.map((f) => ({ id: f.id, name: f.name, pages: f.pages || 0 })),
    _draft: {
      generator: 'heuristic', archetypeReason: arche.reason_ko || '', format: arche.format || '',
      detectedFonts: material.design?.fontsUsed?.map((f) => f.name) || [], themeColors: material.design?.colors || {},
      todo: [
        !meta.date && '연수 날짜를 확인해 주세요.',
        !meta.venue && meta.mode !== 'online' && '장소를 확인해 주세요.',
        !instructors.length && '강사 정보를 넣어 주세요.',
        !S.goals && '연수 목표(마치면 할 수 있는 것)를 2~4개 적어 주세요.',
        meta.mode !== 'offline' && !meta.joinUrl && '온라인 접속 주소(Zoom·Meet)를 넣어 주세요.',
        !meta.contact && '문의처(연수 담당자 연락처)를 넣어 주세요.',
        meta.admin.kind === 'official' && '이수 처리 일정(언제 등록되는지)을 연수 후 안내에 적어 주세요.',
        dates.length >= 2 && !S.sessions && '차시별 제목을 넣어 주세요.',
        !info.surveyUrl && '만족도 조사 주소(설문 링크)를 넣어 주세요.',
        hasDeckFile && !info.slidesBase && !pages.some((p) => p.image) && '교재 쪽 그림(slide-001.webp…)을 만들면 교재 보기에 보여요.',
      ].filter(Boolean),
    },
  };
}

// 오피스·구글 슬라이드·키노트·리브레오피스의 기본 테마 색과 표준 색은 기관 색이 아님(강조색으로 쓰지 않음)
const DEFAULT_THEME_COLORS = new Set([
  // Office 2007~2010
  '1F497D', 'EEECE1', '4F81BD', 'C0504D', '9BBB59', '8064A2', '4BACC6', 'F79646', '0000FF', '800080',
  // Office 2013~2022
  '44546A', 'E7E6E6', '4472C4', 'ED7D31', 'A5A5A5', 'FFC000', '5B9BD5', '70AD47', '0563C1', '954F72',
  // Office 2023~
  '0E2841', 'E8E8E8', '156082', 'E97132', '196B24', '0F9ED5', 'A02B93', '4EA72E', '467886', '96607D',
  // Office 표준 색 줄
  'C00000', 'FF0000', 'FFFF00', '92D050', '00B050', '00B0F0', '0070C0', '002060', '7030A0',
  // Google 슬라이드 기본(Simple Light·Dark)과 Google 색
  '595959', 'EEEEEE', '4285F4', '212121', '78909C', 'FFAB40', '0097A7', 'EEFF41', '1A73E8', 'EA4335', 'FBBC04', 'FBBC05', '34A853',
  // Keynote·Apple 기본 색
  '007AFF', '0A84FF', '34C759', '30D158', 'FF9500', 'FF9F0A', 'FF3B30', 'FF453A', 'AF52DE', 'BF5AF2', '5856D6', '5E5CE6', 'FFCC00', 'FFD60A', 'FF2D55', '5AC8FA', '64D2FF',
  // LibreOffice Impress 기본
  '18A303', '0369A3', 'A33E03', '8E03A3', 'C99C00', 'C9211E', '004586', '729FCF',
]);
/** 교재 테마에서 기관 색 고르기: 기본 팔레트가 아닌 accent1(없으면 accent2)만. 회색·거의 흰색·검은색은 뺌 */
export function brandAccent(colors = {}) {
  for (const k of ['accent1', 'accent2']) {
    const c = String(colors?.[k] || '').toUpperCase();
    if (!/^#[0-9A-F]{6}$/.test(c) || DEFAULT_THEME_COLORS.has(c.slice(1))) continue;
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
    if (Math.max(r, g, b) - Math.min(r, g, b) < 28 || Math.max(r, g, b) < 40 || Math.min(r, g, b) > 230) continue;
    return c;
  }
  return '';
}

function accountShort(a) {
  return { google: 'Google 계정', microsoft: 'Microsoft 계정', naver: '네이버 계정', email: '가입 필요', teacher: '교사 계정', school: '학교 계정', none: '' }[a] || '';
}
function imageName(im) {
  const ext = (extOf(im.name || im.path || '') || 'png').replace('jpeg', 'jpg');
  return `${im.id}.${ext}`;
}
export { getTool };
