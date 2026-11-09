// AI 없이 교재만으로 연수 설계도(blueprint v1) 초안 만들기. docs/architecture.md §2를 따릅니다.
// 결과는 validate()로 한 번 더 다듬어 쓰면 됩니다. 감지가 틀릴 수 있으니 사람이 고칠 자리를 비워 둡니다(지어내지 않음).
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
const ORDER = {
  lab: ['hero', 'readiness', 'outline', 'schedule', 'stations', 'prompts', 'tools', 'deck', 'quiz', 'glossary', 'faq', 'materials', 'instructor', 'survey', 'closing'],
  story: ['hero', 'message', 'outline', 'schedule', 'deck', 'tools', 'stations', 'prompts', 'quiz', 'glossary', 'faq', 'materials', 'instructor', 'closing', 'survey'],
  live: ['hero', 'glance', 'schedule', 'outline', 'deck', 'tools', 'prompts', 'materials', 'faq', 'instructor', 'survey', 'closing'],
  course: ['hero', 'glance', 'outline', 'schedule', 'readiness', 'stations', 'prompts', 'tools', 'deck', 'materials', 'faq', 'glossary', 'instructor', 'survey'],
};
const DEFAULT_SURVEY = [
  { q: '오늘 연수에 전반적으로 만족하셨나요?', kind: 'scale' },
  { q: '배운 내용을 수업이나 업무에 바로 활용할 수 있을 것 같나요?', kind: 'scale' },
  { q: '가장 도움이 된 내용은 무엇인가요?', kind: 'text' },
  { q: '더 알고 싶은 내용이나 건의 사항을 적어 주세요.', kind: 'text' },
];

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
 *   deckHref, materials{ [fileId]: href }, today
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
    lang: 'ko',
    admin: { kind: info.adminKind || 'school', completionRate: 90, hours: Math.round((minutesBetween(info.start || ev.start, info.end || ev.end) / 60) * 10) / 10 },
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
        return !/^(\d{1,2}[.)]|[①-⑳]|step\s*\d)/i.test(t) && !/https?:\/\/|[a-z0-9-]+\.(com|net|org|io|ai|kr)\b/i.test(t) && !/^[^:：]{1,10}[:：]/.test(t);
      }) || '';
    // 그림 주소: info.imageBase가 있으면 그 아래 <id>.<확장자>, 없으면 CLI가 쓴 상대 경로(assets/… · media/…)
    const imgSrc = (im) => (info.imageBase ? info.imageBase + imageName(im) : (/^(assets|media|slides)\//.test(im.src || '') ? im.src : ''));
    const images = g.pages.flatMap((p) => (p.images || []).filter((im) => !im.repeated && im.web !== false && (im.share || 0.3) >= 0.08))
      .map((im) => ({ src: imgSrc(im), caption: im.alt || '' })).filter((im) => im.src).slice(0, 8);
    const title = normLine(g.title) || `실습 ${i + 1}`;
    return {
      id: `st${i + 1}`, name: truncate(title.replace(/^(실습|활동|미션)\s*\d*\s*[.:)\-–]?\s*/, '') || title, 30), title: truncate(title, 100),
      tag: g.section ? truncate(g.section.label || '', 16) : '', desc: truncate(desc, 300),
      steps, prompts: prompts.map((x, k) => ({ title: x.title || (prompts.length > 1 ? `프롬프트 ${k + 1}` : '프롬프트'), text: x.text })),
      images, links, outcome: '', note: '', minutes: 0, source: { file, pages: nums },
    };
  }).filter((s) => s.steps.length || s.prompts.length || s.links.length || s.desc);

  // ── 섹션 만들기 ───────────────────────────
  const S = {};
  const hasDeckFile = files.find((f) => (f.type === 'pptx' || f.type === 'pdf') && !f.renderOf);
  const dateText = koDateText(meta.date, meta.start, meta.end);
  const heroMeta = [];
  if (dateText) heroMeta.push({ label: '일시', value: dateText });
  if (meta.venue) heroMeta.push({ label: meta.mode === 'online' ? '방식' : '장소', value: meta.venue });
  else if (meta.mode === 'online') heroMeta.push({ label: '방식', value: '온라인' });
  if (instructors[0]) heroMeta.push({ label: '강사', value: [instructors[0].name, instructors[0].role].filter(Boolean).join(' · ') });
  const ctas = [];
  if (stations.length) ctas.push({ label: '실습 시작', href: '#stations' });
  if (hasDeckFile) ctas.push({ label: '교재 보기', href: '#deck' });
  if (!ctas.length && (d.sections || []).length) ctas.push({ label: '차례 보기', href: '#outline' });
  S.hero = { id: 'hero', type: 'hero', nav: '처음', eyebrow: meta.organizer || '교원 연수', title: meta.title, subtitle: meta.subtitle, ctas, meta: heroMeta };

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
      notice: '교재는 연수 참여자의 학습용으로만 써 주세요.',
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
  if (matItems.length) S.materials = { id: 'materials', type: 'materials', nav: '자료', items: matItems, notice: '자료는 연수 목적으로만 써 주시고, 다른 곳에 올리기 전에 강사에게 먼저 물어봐 주세요.' };

  if (instructors.length) S.instructor = { id: 'instructor', type: 'instructor', nav: '강사', source: d.instructor ? { file: d.instructor.file, pages: [d.instructor.page] } : undefined };
  S.survey = { id: 'survey', type: 'survey', nav: '설문', url: info.surveyUrl || '', qr: true, questions: DEFAULT_SURVEY };
  const closingMsg = msgs.find((m) => m.closing) || msgs.find((m) => m !== msgs[0] && m.file === (hasDeckFile && hasDeckFile.id)) || null;
  S.closing = { id: 'closing', type: 'closing', lead: '오늘 함께해 주셔서 고맙습니다', text: closingMsg ? closingMsg.text : meta.title, thanks: instructors[0] ? `${instructors[0].name} 드림` : '' };

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
  const accent = material.design?.colors?.accent1;
  if (accent && /^#[0-9A-F]{6}$/i.test(accent)) design.accent = accent;

  return {
    version: 1, meta, audience, archetype, design, instructors, sections,
    live: { provider: 'none', features: [], anonymous: true },
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
        !info.surveyUrl && '만족도 조사 주소(설문 링크)를 넣어 주세요.',
        hasDeckFile && !info.slidesBase && !pages.some((p) => p.image) && '교재 쪽 그림(slide-001.webp…)을 만들면 교재 뷰어에 보여요.',
      ].filter(Boolean),
    },
  };
}

function accountShort(a) {
  return { google: 'Google 계정', microsoft: 'Microsoft 계정', naver: '네이버 계정', email: '가입 필요', teacher: '교사 계정', school: '학교 계정', none: '' }[a] || '';
}
function imageName(im) {
  const ext = (extOf(im.name || im.path || '') || 'png').replace('jpeg', 'jpg');
  return `${im.id}.${ext}`;
}
export { getTool };
