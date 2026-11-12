// AI 없이 교재만으로 연수 설계도(blueprint v1) 초안 만들기. docs/architecture.md §2를 따릅니다.
// 결과는 validate()로 한 번 더 다듬어 쓰면 됩니다. 감지가 틀릴 수 있으니 사람이 고칠 자리를 비워 둡니다(지어내지 않음).
import { randomCode, followupKind } from '../validate.js';
import { DEFAULT_SURVEY } from '../schema/sections.js';
import { detect } from './detect.js';
import { normLine, normText, truncate, textKey, sizeLabel, hostOf, extOf } from './util.js';
import { getTool } from './tools-db.js';
import { composeBody, findLeftovers } from './compose.js';
import { splitNotes } from './signals.js';
import { decideStructure } from '../decide/structure.js';
import { whenText, placeText, whoText } from '../hero-meta.js';

const pad3 = (n) => String(n).padStart(3, '0');
const ACCOUNT_LABEL = {
  google: { label: 'Google 계정 로그인', url: 'https://accounts.google.com' },
  microsoft: { label: 'Microsoft 계정 로그인', url: 'https://login.live.com' },
  naver: { label: '네이버 계정 로그인', url: 'https://nid.naver.com' },
  email: { label: '이메일 가입 계정 준비', url: '' },
  teacher: { label: '교사용 계정 준비(참여자는 코드로 입장)', url: '' },
  school: { label: '학교·교육청 발급 계정 준비', url: '' },
};
// 칸 순서는 decide/structure.js의 흐름(FLOW_INFO)이 정함. 원칙: 첫 화면 → 무엇을 얻나(목표) → 준비 → 본문 → 자료·연수 후 → 강사 → 설문 → 마무리
// 로그인 주소는 교재에 없는 주소라 넣지 않음(이름만)
const ACCOUNT_WORD = { google: 'Google 계정', microsoft: 'Microsoft 계정', naver: '네이버 계정' };
const LEAD = /^(?:[-•·▪◦●○■□▶▷►➢➤→⇒✓✔☞]\s*|\d{1,2}\s*[.)]\s+|[①-⑳]\s*)/;
// 연수 목표가 적힌 쪽(제목이 '연수 목표'·'학습 목표'·'이 연수를 마치면' 등)
const GOAL_TITLE = /^(?:(?:\d{1,2}|[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]|[가-하])\s*[.)]\s*)?(?:오늘의\s*|이\s*연수의\s*)?(?:연수|학습|교육|수업)?\s*(?:목표|목적)(?:\s*및\s*내용)?$|^(?:이런\s*(?:것|걸)을?\s*배워요|오늘\s*배울\s*(?:것|내용)|이\s*연수를\s*마치면.*|기대\s*효과)$/;
const GOAL_LINE = /^(?:연수|학습|교육)\s*(?:목표|목적)\s*[:：]\s*(.{6,160})$/;
const WHO_LINE = /^(?:연수\s*|참가\s*|교육\s*)?대상\s*[:：]\s*(.{2,100})$/;
const CONTACT_LINE = /^(?:문의|문의처|연락처|담당자?)\s*[:：]\s*(.{4,110})$/;
const NOTE_LINE = /^(?:※\s*|\*\s+)(.{4,200})$|^((?:주의|유의|tip|팁|안\s*되면|안\s*될\s*때|막히면|막힐\s*때)\s*[:：)]\s*.{4,200})$/i;
const MORE_TITLE = /(참고\s*(?:자료|문헌|사이트|링크)|더\s*(?:알아보기|살펴보기|읽을거리)|추천\s*(?:자료|도서|사이트)|함께\s*보면|읽을거리|resources?|references?|further\s*reading)/i;
const paraLines = (p) => (p.paragraphs || []).map((x) => normLine(x.text)).filter(Boolean);

/** 교재에 적힌 연수 목표(지어내지 않음): 목표 쪽의 항목, 없으면 "연수 목표: …" 한 줄 */
const HEAD_LINE = /^(?:\d{1,2}|[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ])\s*[.)]\s*\S/;
const KO_LEAD = /^[가-하]\s*[.)]\s+/;
function findGoals(pages, promptKeys) {
  for (const p of pages.slice(0, 12)) {
    if (!GOAL_TITLE.test(normLine(p.title || ''))) continue;
    const items = paraLines(p).map((t) => t.replace(LEAD, '').replace(KO_LEAD, '').trim()).filter((t) => t.length >= 6 && t.length <= 110 && !promptKeys.has(textKey(t)) && !/https?:\/\//.test(t) && !WHO_LINE.test(t));
    if (items.length) return items.slice(0, 5);
  }
  // 쪽 안의 소제목("2. 연수 목표") 아래 항목: PDF처럼 제목으로 쪽이 나뉘지 않는 자료
  for (const p of pages.slice(0, 6)) {
    const lines = paraLines(p);
    const i = lines.findIndex((t) => t.length <= 30 && GOAL_TITLE.test(t));
    if (i < 0) continue;
    const items = [];
    for (const t of lines.slice(i + 1)) {
      if (HEAD_LINE.test(t) && t.length <= 40 && !/[다요]\.?$/.test(t)) break;
      const x = t.replace(LEAD, '').replace(KO_LEAD, '').trim();
      if (x.length >= 6 && x.length <= 110 && !promptKeys.has(textKey(x)) && !/https?:\/\//.test(x) && !WHO_LINE.test(x)) items.push(x);
      if (items.length >= 5) break;
    }
    if (items.length) return items;
  }
  for (const p of pages.slice(0, 6)) for (const t of paraLines(p)) { const m = GOAL_LINE.exec(t.replace(LEAD, '')); if (m) return m[1].split(/\s*[;／]\s*/).map((x) => x.trim()).filter((x) => x.length >= 4).slice(0, 5); }
  return [];
}
function findLine(pages, re) {
  for (const p of pages) for (const t of [p.title || '', ...paraLines(p)]) { const m = re.exec(normLine(t).replace(LEAD, '')); if (m) return truncate(m[1].trim(), 110); }
  return '';
}

function minutesBetween(a, b) {
  const m1 = /^(\d{2}):(\d{2})$/.exec(a || ''), m2 = /^(\d{2}):(\d{2})$/.exec(b || '');
  if (!m1 || !m2) return 0;
  const d = (+m2[1] * 60 + +m2[2]) - (+m1[1] * 60 + +m1[2]);
  return d > 0 ? d : 0;
}
function hoursLabel(min) {
  if (!min) return '';
  const h = Math.floor(min / 60), m = min % 60;
  return h && m ? `${h}시간 ${m}분` : h ? `${h}시간` : `${m}분`;
}

/**
 * @param {object} material ingest 결과(detected가 없으면 여기서 감지)
 * @param {object} [info] 사용자가 직접 준 정보(감지보다 우선)
 *   title, subtitle, organizer, date, start, end, venue, mode, joinUrl, size, audience{}, level, archetype, format,
 *   instructor{name,role,org,email,bio}, surveyUrl, slidesBase('assets/slides/'), imageBase('assets/media/'),
 *   deckHref, materials{ [fileId]: href }, today, goals[], who, contact, dates[](차시 날짜), concept(컨셉: 있으면 구성 이유에 반영)
 */
export function materialToDraft(material, info = {}) {
  const d = material.detected?.signals ? material.detected : detect(material, info);
  const ev = d.event || {};
  const files = material.files || [];
  const renderOnly = new Set(files.filter((f) => f.renderOf).map((f) => f.id));
  const pages = (material.pages || []).filter((p) => !p.hidden && !p.error && !renderOnly.has(p.file));
  const pageKey = (f, n) => `${f}:${n}`;
  const pageMap = new Map(pages.map((p) => [pageKey(p.file, p.page), p]));
  const admin = d.admin || null;
  const speakers = info.instructor ? [] : (d.speakers || []);

  // ── 구성: 신호 → 흐름 → 칸 순서(decide/structure.js) ─────────
  const st = decideStructure({ ...info, archetype: info.archetype }, { ...material, detected: d }, info.concept || null);
  const flow = st.flow;
  const sourceBody = st.body === 'source';

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
    joinUrl: info.joinUrl || '', // 온라인 접속 주소는 강사가 준 값만(교재에서 찾은 주소는 detected.addresses에 후보로)
    contact: info.contact || findLine([...pages.slice(0, 3), ...pages.slice(-3)], CONTACT_LINE),
    lang: 'ko',
    // 직무연수·이수 기준·연수 시간은 교재에 적혀 있으면 그 값으로(강사가 고른 값이 우선)
    admin: { kind: info.adminKind || (admin?.official ? 'official' : 'school'), completionRate: +info.completionRate || admin?.completionRate || 90, hours: admin?.hours || Math.round((minutesBetween(info.start || ev.start, info.end || ev.end) / 60) * 10) / 10 },
    sessions: [],
  };
  if (meta.subtitle === meta.title) meta.subtitle = '';
  const durationMin = info.durationMin || minutesBetween(meta.start, meta.end);

  // ── 강사 ─────────────────────────────────
  const instructors = [];
  const di = info.instructor || (!speakers.length && d.instructor && d.instructor.name ? d.instructor : null);
  if (di && di.name) {
    const now = (di.bio || []).filter((t) => /^\s*\(?\s*(현|現)/.test(t)).map((t) => t.replace(/^\s*\(?\s*(현|現)\s*\)?\s*[)\].:]?\s*/, ''));
    const past = (di.bio || []).filter((t) => /^\s*\(?\s*(전|前)/.test(t)).map((t) => t.replace(/^\s*\(?\s*(전|前)\s*\)?\s*[)\].:]?\s*/, ''));
    const other = (di.bio || []).filter((t) => !/^\s*\(?\s*(현|現|전|前)/.test(t));
    // 묶음 이름도 교재의 표시 그대로(현·전)
    const mark = (re, def) => ((di.bio || []).map((t) => re.exec(t)?.[1]).find(Boolean) || def);
    const timeline = [];
    if (now.length) timeline.push({ group: mark(/^\s*\(?\s*(현|現)/, '현'), items: now.map((text) => ({ text })) });
    if (past.length) timeline.push({ group: mark(/^\s*\(?\s*(전|前)/, '전'), items: past.map((text) => ({ text })) });
    if (other.length) timeline.push({ group: '활동', items: other.map((text) => ({ text })) });
    instructors.push({
      name: di.name, role: di.role || '', org: di.org || '', photo: info.instructor?.photo || '', bio: typeof di.bio === 'string' ? di.bio : '',
      email: di.email || '', showEmail: info.instructor?.showEmail ?? false, tags: [], links: di.links || [], timeline,
    });
  }

  const archetype = info.archetype ? { primary: info.archetype, mix: [] } : st.archetype;

  const refsOf = (x) => x.refs || (x.pages || [x.page]).map((page) => ({ file: x.file, page }));
  const onPages = (x, file, list) => refsOf(x).some((r) => r.file === file && list.includes(r.page));
  // 도구: 영상·설문·회의 서비스는 실습 쪽에서 쓰일 때만 도구로 봄(중계 주소·설문 주소가 '도구'로 올라가지 않게)
  const practiceRefs = (d.practice?.pages || []);
  const inPractice = (t) => refsOf(t).some((r) => practiceRefs.some((pr) => pr.file === r.file && pr.page === r.page));
  const tools = (d.tools || []).filter((t) => !['video', 'survey', 'meeting'].includes(t.category) || inPractice(t));
  const toolNamesOn = (file, pagesList) => tools.filter((t) => onPages(t, file, pagesList)).map((t) => t.name);
  // 강사 확인이 필요한 주소(중계·회의·설문)는 어느 칸에도 저절로 싣지 않음
  const heldUrls = new Set([...(d.addresses?.join || []), ...(d.addresses?.survey || [])].map((a) => a.url));
  const timed = (d.agenda?.items || []).filter((it) => it.start);

  // ── 실습 스테이션 ─────────────────────────
  const sectionOf = (file, page) => (d.sections || []).find((s) => s.file === file && s.pages.includes(page));
  const practice = (d.practice?.pages || []).map((r) => pageMap.get(pageKey(r.file, r.page))).filter(Boolean);
  const groups = [];
  const PRACTICE_NO = /^(?:실습|활동|미션|과제)\s*\d{1,2}(?!\d)/;
  // 단계 없이 프롬프트만 있는 쪽("활동지 프롬프트 모음")은 바로 앞 실습에 딸린 쪽: 교재의 실습 번호(실습 1·2·3…)대로 묶음
  const promptOnly = (p) => !PRACTICE_NO.test(normLine(p.title || '')) && !(d.steps || []).some((s) => s.file === p.file && s.page === p.page)
    && (d.prompts || []).some((x) => onPages(x, p.file, [p.page]));
  for (const p of practice) {
    const last = groups[groups.length - 1];
    const sec = sectionOf(p.file, p.page);
    const lastP = last?.pages[last.pages.length - 1];
    const cont = last && lastP.file === p.file && p.page === lastP.page + 1 && last.section === sec
      && (textKey(p.title) === textKey(last.title) || /\(계속\)|계속$|cont/i.test(p.title || '') || !p.title || promptOnly(p) || textKey(p.title).startsWith(textKey(last.title).slice(0, 6)) && textKey(last.title).length >= 6);
    if (cont) last.pages.push(p);
    else groups.push({ title: p.title || '', pages: [p], section: sec });
  }
  const usedPrompts = new Set();
  let noteCount = 0, memoCount = 0;
  // 실습 안 프롬프트 이름: 교재의 이름표("프롬프트 1")가 먼저, 없으면 차례 번호. 딸린 쪽의 프롬프트는 그 쪽 제목을 앞에("활동지 프롬프트 모음 · 프롬프트 1")
  const promptTitles = (list, g, nums) => {
    const untitled = list.filter((x) => !x.title).length;
    let n = 0;
    return list.map((x) => {
      const t = x.title || (untitled > 1 ? `프롬프트 ${++n}` : '프롬프트');
      const at = refsOf(x).find((r) => r.file === g.pages[0].file && nums.includes(r.page))?.page ?? x.page;
      const pt = normLine(pageMap.get(pageKey(g.pages[0].file, at))?.title || '');
      return at !== nums[0] && pt && !/계속|cont/i.test(pt) && textKey(pt) !== textKey(g.title) && !textKey(t).includes(textKey(pt)) ? `${pt} · ${t}` : t;
    });
  };
  const stations = groups.slice(0, 40).map((g, i) => {
    const file = g.pages[0].file;
    const nums = g.pages.map((p) => p.page);
    const inG = (x) => x.file === file && nums.includes(x.page);
    const steps = (d.steps || []).filter(inG).flatMap((s) => s.items).slice(0, 20);
    const prompts = (d.prompts || []).filter((x) => onPages(x, file, nums)).slice(0, 12);
    prompts.forEach((x) => usedPrompts.add(x));
    const stepKeys = new Set(steps.map(textKey));
    const promptKeys = prompts.map((x) => textKey(x.text));
    const links = (d.links || []).filter((l) => onPages(l, file, nums) && l.kind !== 'meeting' && !heldUrls.has(l.url)).slice(0, 8).map((l) => ({ label: l.label, url: l.url }));
    const linkLabels = new Set(links.map((l) => textKey(l.label)));
    const desc = g.pages.flatMap((p) => p.paragraphs || []).map((x) => x.text)
      .find((t) => {
        if (!t || t.length < 8 || t.length > 200) return false;
        const k = textKey(t);
        if (stepKeys.has(k) || linkLabels.has(k) || promptKeys.some((pk) => pk && (k.includes(pk) || pk.includes(k)))) return false;
        return !NOTE_LINE.test(t) && !/^(\d{1,2}[.)]|[①-⑳]|step\s*\d)/i.test(t) && !/https?:\/\/|[a-z0-9-]+\.(com|net|org|io|ai|kr)\b/i.test(t) && !/^[^:：]{1,10}[:：]/.test(t);
      }) || '';
    // 막히기 쉬운 곳: 쪽의 "※ …", "주의: …", "안 되면: …" 줄과 발표자 노트의 '막히면·안 되면·주의' 문장.
    // 강사에게 하는 진행 메모("~하도록 안내.")는 참가자 화면에 싣지 않고 teacherNote(강사용 운영안내)로
    const marked = g.pages.flatMap(paraLines).map((t) => NOTE_LINE.exec(t)).filter(Boolean).map((m) => (m[1] || m[2]).trim());
    const split = g.pages.map((p) => splitNotes(p.notes));
    const tips = split.flatMap((x) => x.tips);
    const memos = split.flatMap((x) => x.memos);
    noteCount += tips.length; memoCount += memos.length;
    const note = [...marked, ...tips].filter((t, k, all) => !stepKeys.has(textKey(t)) && !promptKeys.some((pk) => pk && textKey(t).includes(pk)) && all.findIndex((x) => textKey(x) === textKey(t)) === k).slice(0, 3).join('\n');
    // 그림 주소: info.imageBase가 있으면 그 아래 <id>.<확장자>, 없으면 CLI가 쓴 상대 경로(assets/… · media/…)
    const imgSrc = (im) => (info.imageBase ? info.imageBase + imageName(im) : (/^(assets|media|slides)\//.test(im.src || '') ? im.src : ''));
    const images = g.pages.flatMap((p) => (p.images || []).filter((im) => !im.repeated && im.web !== false && (im.share || 0.3) >= 0.08))
      .map((im) => ({ src: imgSrc(im), caption: im.alt || '' })).filter((im) => im.src).slice(0, 8);
    const title = normLine(g.title) || `실습 ${i + 1}`;
    // 걸리는 시간: 일정표에 같은 번호의 실습("실습 1 14:20~15:00")이 있을 때만(지어내지 않음)
    const no = /(?:실습|활동|미션)\s*(\d{1,2})/.exec(title)?.[1];
    const slot = no ? timed.find((it) => new RegExp(`(?:실습|활동|미션)\\s*${no}(?!\\d)`).test(it.text || '') && it.end) : null;
    const minutes = slot ? minutesBetween(slot.start, slot.end) : 0;
    return {
      id: `st${i + 1}`, name: truncate(title.replace(/^(?:실습|활동|미션)(?:\s*\d+\s*[.:)\-–]?\s*|\s*[.:)\-–]\s*|\s+(?=\S))/, '') || title, 30), title: truncate(title, 100),
      tag: g.section ? truncate(g.section.label || '', 16) : '', desc: truncate(desc, 300),
      steps, prompts: promptTitles(prompts, g, nums).map((t, k) => ({ title: t, text: prompts[k].text })),
      images, links, outcome: '', note: truncate(note, 400), minutes: minutes > 0 && minutes <= 240 ? minutes : 0, source: { file, pages: nums },
      ...(memos.length ? { teacherNote: truncate(memos.join('\n'), 600) } : {}),
    };
  }).filter((s) => s.steps.length || s.prompts.length || s.links.length || s.desc);

  // ── 섹션 만들기 ───────────────────────────
  const S = {};
  const slotPage = {}; // 그 칸의 재료가 교재 몇 쪽에 있는지(본문 칸을 교재 순서로 끼울 때 씀)
  const hasDeckFile = files.find((f) => (f.type === 'pptx' || f.type === 'pdf') && !f.renderOf);

  // 연수 목표·대상: 교재에 적힌 것만
  const promptKeySet = new Set((d.prompts || []).map((x) => textKey(x.text)));
  const goalItems = info.goals?.length ? info.goals : findGoals(pages, promptKeySet);
  const who = info.who || findLine(pages.slice(0, 3), WHO_LINE);
  // 교재에 적힌 목표 문장 그대로(말끝 "~할 수 있다."도 바꾸지 않음)
  if (goalItems.length) S.goals = { id: 'goals', type: 'goals', title: '연수 목표', items: goalItems.map((t) => truncate(t, 120)), who };

  const msgs = d.messages || [];
  const lead = msgs.find((m) => (m.score ?? 2) >= 2); // 사례 속 인용 같은 약한 후보는 첫 화면 메시지로 올리지 않음
  if (lead) S.message = { id: 'message', type: 'message', text: lead.text, note: '', style: 'statement', source: { file: lead.file, pages: [lead.page] } };

  // 차례: 슬라이드 교재만(문서 교재는 본문 칸이 절 순서 그대로라 차례를 따로 두지 않음)
  const bodyLines = (file, page) => { const p = pageMap.get(pageKey(file, page)); return p ? paraLines(p).filter((t) => t.length <= 120 && !/https?:\/\//.test(t)) : []; };
  const outlineItems = (d.sections || []).slice(0, 8).map((s) => {
    const pg = pageMap.get(pageKey(s.file, s.page));
    // 차례 표에서 온 제목에 발표자 이름이 붙어 있으면 그 쪽의 제목을 씀
    const title = pg?.title && textKey(s.title).startsWith(textKey(pg.title)) && textKey(pg.title).length >= 4 ? pg.title : s.title;
    return {
      part: s.label, title, desc: s.desc || truncate(bodyLines(s.file, s.page).slice(0, 4).join(' · '), 200),
      tags: toolNamesOn(s.file, s.pages).slice(0, 3),
      target: hasDeckFile && s.file === hasDeckFile.id ? `deck:${s.page}` : (stations.some((x) => x.source.file === s.file && x.source.pages.some((n) => s.pages.includes(n))) ? 'stations' : ''),
    };
  });
  if (!outlineItems.length && d.agenda?.items?.length >= 2) {
    d.agenda.items.slice(0, 8).forEach((it, i) => outlineItems.push({ part: it.part || `PART ${i + 1}`, title: it.text, desc: '', tags: [], target: '' }));
  }
  const multiDay = (ev.dates || []).length >= 2 || (d.sessions || []).length >= 2;
  if (outlineItems.length >= 2 && !sourceBody) {
    S.outline = { id: 'outline', type: 'outline', nav: '차례', title: flow === 'course' ? '과정 차례' : flow === 'event' || multiDay ? '차례' : '오늘의 차례', items: outlineItems, source: { file: d.sections?.[0]?.file || '', pages: (d.sections || []).map((s) => s.page) } };
    slotPage.outline = d.sections?.[0]?.page;
  }

  // 차시(날짜가 둘 이상): 제목은 교재 차례와 개수가 맞을 때만 가져옴(지어내지 않음)
  const dates = info.dates?.length ? info.dates : (ev.dates || []);
  if (dates.length >= 2 && !(d.sessions || []).length) {
    meta.sessions = dates.map((date, i) => ({ no: i + 1, date, start: '', end: '', title: '' }));
    const titles = (d.sections || []).length === dates.length ? d.sections.map((x) => x.title) : (d.agenda?.items || []).length === dates.length ? d.agenda.items.map((x) => x.text) : [];
    if (titles.length) S.sessions = { id: 'sessions', type: 'sessions', nav: '차시', items: dates.map((date, i) => ({ no: i + 1, date, title: titles[i], desc: '', links: [] })) };
  }
  // 교재의 차시표("1차시 1. 11.(월) 주제"): 날짜가 없어도 번호·주제는 그대로. 차시 줄 아래의 내용·준비물·과제는 설명에
  if (!S.sessions && (d.sessions || []).length >= 2) {
    S.sessions = { id: 'sessions', type: 'sessions', nav: '차시', items: d.sessions.map((x) => ({ no: x.no, date: x.date || '', title: x.title, desc: x.desc || '', links: [] })), source: { file: d.sessions[0].file, pages: [...new Set(d.sessions.map((x) => x.page))] } };
    if (d.sessions.every((x) => x.date)) meta.sessions = d.sessions.map((x) => ({ no: x.no, date: x.date, start: '', end: '', title: x.title }));
    slotPage.sessions = d.sessions[0].page;
  }

  // 일정(교재에 시간이 적혀 있을 때만). 발표자 이름이 제목 끝에 붙어 있으면 설명으로 내림
  // 일정표의 담당 칸이 제목 끝에 붙은 것("개회 및 인사 교육지원과장", "질의응답 발표자 전원")도 설명으로
  const ROLE_TAIL = /\s([가-힣]*(?:과장|국장|장학사|장학관|수석교사|교감|교장|연구사|연구관)|발표자\s*전원)$/;
  const whoTail = (text) => speakers.map((p) => `${p.name} ${p.role}`.trim()).find((w) => w && text.endsWith(w)) || (ROLE_TAIL.exec(text)?.index >= 2 ? ROLE_TAIL.exec(text)[1] : '');
  if (timed.length >= 2) {
    // 일정표의 칸(내용·방식·담당)은 detect가 나눠 둔 그대로: 방식 → part, 담당·비고 → desc
    S.schedule = { id: 'schedule', type: 'schedule', nav: '일정', items: timed.map((it) => { const w = it.desc ? '' : whoTail(it.text); return { start: it.start, end: it.end || '', title: w ? it.text.slice(0, -w.length).trim() : it.text, desc: w || it.desc || '', part: it.part || '' }; }) };
    slotPage.schedule = d.agenda.page;
  } else if ((d.sections || []).filter((s) => s.start).length >= 2) S.schedule = { id: 'schedule', type: 'schedule', nav: '일정', items: d.sections.filter((s) => s.start).map((s) => ({ start: s.start, end: s.end || '', title: s.title, desc: '', part: s.label })) };

  // 발표자 여럿: 강사 소개 대신 발표자 칸
  if (speakers.length >= 2) {
    S.speakers = { id: 'speakers', type: 'speakers', nav: '발표자', title: '발표자', items: speakers.map((p) => ({ name: p.name, org: p.org, role: [p.role, p.note].filter(Boolean).join(' · '), talk: p.talk, time: p.time })), source: { file: speakers[0].file, pages: [...new Set(speakers.map((p) => p.page))] } };
    slotPage.speakers = Math.min(...speakers.map((p) => p.page));
  }

  // 본문 칸(교재 묶음 → 절차·사례·질문·표·글…)과 교재의 준비물
  const composed = composeBody({ ...material, detected: d }, d, { skipUrls: heldUrls });

  // 준비 점검의 도구: 실습 쪽에서 쓰는 것만(없으면 두 번 넘게 나온 것).
  // 주소는 교재에 적힌 그 도구의 주소가 있으면 그것을(연수 보드처럼), 없으면 도구의 대표 주소
  const ownUrl = (t) => (d.links || []).find((l) => l.toolId === t.id && !heldUrls.has(l.url) && l.kind !== 'meeting')?.url || '';
  const accounts = new Map();
  const usedInPractice = tools.filter(inPractice);
  const readyTools = usedInPractice.length ? usedInPractice : tools.filter((t) => t.count >= 2);
  for (const t of readyTools) if (t.accountNeeded && ACCOUNT_LABEL[t.account]) { if (!accounts.has(t.account)) accounts.set(t.account, []); accounts.get(t.account).push(t.name); }
  // 준비 점검: 교재의 준비물이 먼저. 계정은 교재가 그 계정을 말할 때만(설명은 그 교재 문장 그대로).
  // 도구 목록에서만 아는 계정·브라우저 안내(교재에 없는 사실)는 강사가 고를 수 있게 할 일(todo)로 남김
  const readyItems = composed.prep.map((label) => ({ label, detail: '', url: '' }));
  const prepText = textKey(composed.prep.join(' '));
  const ACCOUNT_SAID = { google: /(?:구글|google)\s*계정/i, microsoft: /(?:마이크로소프트|microsoft|ms)\s*계정/i, naver: /네이버\s*(?:계정|아이디)/i };
  const allLines = [...stations.flatMap((x) => x.steps), ...pages.flatMap(paraLines)];
  const readyHints = [];
  for (const [k, names] of accounts.entries()) {
    if (prepText.includes(textKey(ACCOUNT_WORD[k] || '\u0000'))) continue;
    const said = ACCOUNT_SAID[k] && allLines.find((t) => ACCOUNT_SAID[k].test(t));
    if (said) readyItems.push({ label: ACCOUNT_WORD[k], detail: truncate(said, 200), url: '' });
    else readyHints.push(`${ACCOUNT_LABEL[k].label}(${names.slice(0, 6).join(', ')})`);
  }
  if ((tools.length || stations.length) && !/브라우저|크롬|엣지|웨일/.test(composed.prep.join(' '))) readyHints.push('노트북·크롬북에서 최신 브라우저 열기');
  const checks = (readyTools.length ? readyTools : tools).map((t) => ({ name: t.name, url: ownUrl(t) || t.url })).filter((t) => t.url).slice(0, 10);
  if (readyItems.length && (stations.length || composed.prep.length || archetype.primary === 'lab' || archetype.primary === 'course')) S.readiness = { id: 'readiness', type: 'readiness', nav: '준비', items: readyItems.slice(0, 12), checks };

  if (stations.length) { S.stations = { id: 'stations', type: 'stations', nav: '실습', layout: stations.length > 8 ? 'tabs' : 'sidebar', items: stations }; slotPage.stations = stations[0].source.pages[0]; }

  // 프롬프트 모음(스테이션에 없는 것 포함 전체)
  const allPrompts = (d.prompts || []).slice(0, 40);
  if (allPrompts.length && (allPrompts.length > usedPrompts.size || !stations.length || allPrompts.length >= 3)) {
    S.prompts = { id: 'prompts', type: 'prompts', nav: '프롬프트', items: allPrompts.map((x, k) => ({ title: x.title || pageMap.get(pageKey(x.file, x.page))?.title || `프롬프트 ${k + 1}`, text: x.text, tags: [...new Set(refsOf(x).flatMap((r) => toolNamesOn(r.file, [r.page])))].slice(0, 3) })) };
  }

  // 도구 설명: 교재에서 그 도구를 쓰는 실습 제목(교재 글자 그대로). 계정·로그인 여부 같은 도구 목록 지식은 교재에 없으면 싣지 않음
  const fileNo = new Map(files.map((f, i) => [f.id, i]));
  const firstAt = (t) => Math.min(...refsOf(t).map((r) => (fileNo.get(r.file) ?? 99) * 10000 + r.page), 1e9);
  const stationsOf = (t) => stations.filter((x) => refsOf(t).some((r) => r.file === x.source.file && x.source.pages.includes(r.page))).map((x) => x.title);
  if (tools.length) {
    S.tools = {
      id: 'tools', type: 'tools', nav: '도구',
      // 교재에 처음 나오는 차례대로
      items: tools.slice(0, 24).sort((a, b) => firstAt(a) - firstAt(b)).map((t) => ({ name: t.name, url: ownUrl(t), // 링크는 교재에 적힌 그 도구의 주소만(일반 주소를 지어 붙이지 않음. 접속 확인만 대표 주소를 씀)
      desc: truncate(stationsOf(t).slice(0, 3).join(' · '), 200), pages: hasDeckFile ? refsOf(t).filter((r) => r.file === hasDeckFile.id).map((r) => r.page).slice(0, 12) : [], icon: t.icon || '' })),
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
      // 이용 안내(notice)는 교재에 없으므로 비워 둠(강사가 적으면 보임)
      source: { file: hasDeckFile.id, pages: [] },
    };
    if (!S.deck.download) delete S.deck.download;
  }

  const quizItems = (d.quiz || []).filter((q) => q.answer >= 0).slice(0, 20).map((q) => ({ q: q.q, options: q.options, answer: q.answer, explain: q.explain || '' }));
  if (quizItems.length) { S.quiz = { id: 'quiz', type: 'quiz', nav: '퀴즈', items: quizItems }; slotPage.quiz = d.quiz[0].page; }
  if ((d.glossary || []).length >= 2) { S.glossary = { id: 'glossary', type: 'glossary', nav: '용어', items: d.glossary.slice(0, 40).map((g) => ({ term: g.term, desc: g.desc })) }; slotPage.glossary = d.glossary[0].page; }
  if ((d.faq || []).length) { S.faq = { id: 'faq', type: 'faq', nav: 'FAQ', items: d.faq.slice(0, 20).map((f) => ({ q: f.q, a: f.a })) }; slotPage.faq = d.faq[0].page; }

  // 자료실: 참가자가 받을 수 있는 것만(주소가 있는 파일, 교재의 '자료·내려받기' 링크). 받을 수 없는 파일 이름은 보이지 않게
  const matItems = files.filter((f) => f.type !== 'link').map((f) => ({
    title: f.name, desc: f.pages ? `${f.pages}${f.unit === 'slide' ? '장' : f.unit === 'page' ? '쪽' : '개 부분'}` : '',
    href: info.materials?.[f.id] || (hasDeckFile && f.id === hasDeckFile.id ? info.deckHref || '' : ''), kind: (f.type || extOf(f.name) || 'file').toUpperCase(), size: sizeLabel(f.size),
  })).filter((x) => x.href);
  for (const f of files.filter((x) => x.type === 'link')) matItems.push({ title: f.name, desc: hostOf(f.url), href: f.url, kind: 'LINK', size: '' });
  const lineOf = (l) => { const r = refsOf(l)[0]; return r ? bodyLines(r.file, r.page).find((t) => (l.label && t.includes(l.label)) || t.includes(l.url)) || '' : ''; };
  for (const l of (d.links || [])) {
    if (heldUrls.has(l.url) || l.kind === 'meeting' || l.kind === 'form' || matItems.some((x) => x.href === l.url)) continue;
    const line = lineOf(l); const lab = /^(.{2,20}?)\s*[:：]/.exec(line.replace(LEAD, ''));
    if (/자료|내려받기|다운로드|양식|서식/.test(`${lab?.[1] || ''} ${l.label || ''}`) && !/영상|녹화|다시\s*보기/.test(line)) matItems.push({ title: truncate(lab ? lab[1] : l.label || hostOf(l.url), 100), desc: lab && l.label && !/^https?:/.test(l.label) && l.label !== lab[1] ? l.label : hostOf(l.url), href: l.url, kind: 'LINK', size: '' });
  }
  // 자료 이용 규칙(notice)은 교재에 없으므로 지어 넣지 않음(강사가 적으면 보임)
  if (matItems.length) S.materials = { id: 'materials', type: 'materials', nav: '자료', items: matItems.slice(0, 30) };

  // 연수 후 안내: '참고 자료'·'더 알아보기' 쪽의 링크와 끝부분의 영상·소통방 링크, 교재에 적힌 과제·이수 처리
  const morePages = pages.filter((p) => MORE_TITLE.test(p.title || ''));
  const tail = pages.slice(-3);
  const seenUrl = new Set([...(S.materials?.items || []).map((x) => x.href), ...stations.flatMap((x) => x.links.map((l) => l.url))]);
  const fu = [];
  for (const l of (d.links || [])) {
    if (fu.length >= 8 || seenUrl.has(l.url) || heldUrls.has(l.url) || l.kind === 'meeting' || l.kind === 'form') continue;
    const onMore = morePages.some((p) => onPages(l, p.file, [p.page]));
    const k = followupKind(l.url);
    if (onMore || (k !== 'link' && tail.some((p) => onPages(l, p.file, [p.page])))) { seenUrl.add(l.url); fu.push({ title: truncate(l.label || hostOf(l.url), 80), url: l.url, kind: k, desc: '' }); }
  }
  if (admin?.assignment?.length) fu.unshift({ title: '과제', url: '', kind: 'next', desc: truncate(admin.assignment.map((t) => t.replace(/^과제\s*[:：]\s*/, '')).join(' · '), 200) });
  const completion = truncate((admin?.completion || []).join(' '), 300);
  if (fu.length || completion) S.followup = { id: 'followup', type: 'followup', nav: '연수 후', items: fu, completion };

  if (instructors.length) S.instructor = { id: 'instructor', type: 'instructor', nav: '강사', source: d.instructor ? { file: d.instructor.file, pages: [d.instructor.page] } : undefined };
  // 만족도 조사: 강사가 준 주소가 있을 때만. 주소가 없으면 참여 기능을 켤 때 사이트 안 설문이 들어감(intake.js applyFeatures)
  if (info.surveyUrl) S.survey = { id: 'survey', type: 'survey', nav: '설문', url: info.surveyUrl, qr: true, questions: DEFAULT_SURVEY.map((q) => ({ ...q })) };
  // 마무리: 교재의 맺는 문장이 있으면 그 문장(이름표 "핵심:"은 머리말로). 인사말·서명("함께해 주셔서 고맙습니다", "○○○ 드림")은
  // 교재에 없으므로 지어 넣지 않음. 문장이 없으면 비워 두고, 화면에는 연수 제목·날짜·주최가 나옴
  const closingMsg = msgs.find((m) => m.closing) || msgs.find((m) => m !== lead && (m.score ?? 2) >= 2 && m.file === (hasDeckFile && hasDeckFile.id)) || null;
  if (flow !== 'course') S.closing = { id: 'closing', type: 'closing', lead: closingMsg?.label || '', text: closingMsg ? closingMsg.text : '', thanks: '' };

  // 한눈에 보기: 흐름에 맞는 값만(행사: 참석·발표·시간 / 과정: 연수 시간·차시·출석 기준 / 문서: 교재의 수치 문장)
  const glance = [];
  if (flow === 'event') {
    const size = ev.size || info.size; // 교재에 적힌 참석 인원이 먼저(앱의 인원은 구간 값)
    if (size) glance.push({ value: `${size}명`, label: '참석', note: '' });
    if (speakers.length) glance.push({ value: `${speakers.length}개`, label: '발표', note: '' });
    if (durationMin) glance.push({ value: hoursLabel(durationMin), label: '진행 시간', note: '' });
  } else if (flow === 'course') {
    const n = S.sessions?.items.length || 0;
    if (meta.admin.hours) glance.push({ value: `${meta.admin.hours}시간`, label: '연수 시간', note: truncate(admin?.hoursText || '', 80) });
    if (n) glance.push({ value: `${n}차시`, label: '차시', note: '' });
    if (admin?.completionRate) glance.push({ value: `${admin.completionRate}%`, label: '출석 기준', note: truncate(admin.rateText || '', 80) });
  } else if (sourceBody) {
    for (const f of d.figures || []) glance.push({ value: f.value, label: f.label, note: f.note });
  }
  if (glance.length >= 2) S.glance = { id: 'glance', type: 'glance', items: glance.slice(0, 4) };

  // 첫 화면: 일시·장소·강사는 연수 정보에서 그려지므로 따로 적지 않음(정보를 고치면 함께 바뀜).
  // 여러 날 과정·발표자 여럿·목표 칸이 없는 대상처럼 덧붙일 줄이 있을 때만 적음
  const ctas = [];
  const firstBody = composed.entries.map((e) => e.section).find((x) => x && ['procedure', 'cases', 'discuss'].includes(x.type));
  if (stations.length) ctas.push({ label: '실습 시작', href: '#stations' });
  else if (S.sessions && flow === 'course') ctas.push({ label: '차시 보기', href: '#sessions' });
  else if (S.schedule && flow === 'event') ctas.push({ label: '일정 보기', href: '#schedule' });
  else if (sourceBody && firstBody) ctas.push({ label: { procedure: '절차 보기', cases: '사례 보기', discuss: '질문 보기' }[firstBody.type], href: `#${firstBody.type}` });
  if (hasDeckFile) ctas.push({ label: '교재 보기', href: '#deck' });
  if (!ctas.length && S.outline) ctas.push({ label: '차례 보기', href: '#outline' });
  const heroMeta = [];
  const extraRows = [speakers.length >= 2 && { label: '발표', value: truncate(speakers.map((p) => p.name).join(' · '), 80) }, !S.goals && who && { label: '대상', value: truncate(who, 80) }].filter(Boolean);
  if (extraRows.length || meta.sessions.filter((x) => x.date).length >= 2) {
    const base = [['일시', whenText(meta)], ['장소', placeText(meta)], ['강사', whoText(instructors[0])]].filter(([, v]) => v).map(([label, value]) => ({ label, value }));
    heroMeta.push(...base, ...extraRows);
  }
  S.hero = { id: 'hero', type: 'hero', nav: '처음', eyebrow: meta.organizer || '', title: meta.title, subtitle: meta.subtitle, ctas: ctas.slice(0, 2), meta: heroMeta };

  // ── 칸 놓기: 흐름의 순서에 본문 칸을 교재 순서로 끼움 ─────────────
  // 이름표 줄 묶음(과정 개요 등): 첫 화면·목표·한눈에 보기에 이미 실린 줄이 대부분이면 되풀이하지 않음
  const headHay = textKey(JSON.stringify([meta, S.hero, S.goals, S.glance, instructors, whenText(meta)]));
  const shown = (v) => { const w = normLine(v).split(/[\s|·,/()~+]+/).map(textKey).filter((x) => x.length >= 2); return w.length ? w.filter((x) => headHay.includes(x)).length / w.length >= 0.6 : true; };
  const entries = composed.entries.filter((e) => !(e.section?._facts && e.section.rows.filter((r) => shown(r[1])).length >= e.section.rows.length * 0.7));
  const used = new Map();
  const bodyId = (type) => { const n = (used.get(type) || 0) + 1; used.set(type, n); return n === 1 ? type : `${type}-${n}`; };
  const finish = (sec) => {
    const s = { ...sec }; delete s._facts; delete s._use;
    s.id = bodyId(s.type === 'glance' ? 'figures' : s.type);
    if (s.type === 'table' || s.type === 'text' || s.type === 'glance') s.nav = s.title && [...s.title].length <= 8 ? s.title : '';
    return s;
  };
  // 흐름 순서에 자리 이름이 있는 칸(핵심 단계 등)은 그 자리로, 나머지는 본문 칸
  const body = [];
  for (const e of entries) {
    if (e.slot) { body.push(e); continue; }
    const t = e.section.type;
    if (st.order.includes(t) && !S[t] && t !== 'glance') { S[t] = { ...finish(e.section), id: t }; slotPage[t] = e.page; continue; }
    body.push({ ...e, section: finish(e.section) });
  }
  const HEAD = ['hero', 'message', 'goals', 'glance'];
  const bodySlots = new Set(body.filter((e) => e.slot && !HEAD.includes(e.slot)).map((e) => e.slot));
  const sections = [];
  const placed = new Set();
  const put = (k) => { if (S[k] && !placed.has(k)) { placed.add(k); sections.push(S[k]); } };
  if (sourceBody) {
    for (const k of st.order) {
      if (k === '*') { for (const e of body) { if (e.slot) put(e.slot); else sections.push(e.section); } } else if (!bodySlots.has(k)) put(k);
    }
  } else {
    // 슬라이드 교재: 본문 칸을 '그 쪽보다 앞에 재료가 있는 마지막 칸' 뒤에 끼움. 앞선 칸이 없으면 본문 자리(*)에
    const star = []; const after = new Map();
    for (const e of body.filter((x) => x.section)) {
      const anchor = st.order.filter((k) => k !== '*' && S[k] && !HEAD.includes(k) && slotPage[k] !== undefined && slotPage[k] <= e.page).pop();
      if (anchor) after.set(anchor, [...(after.get(anchor) || []), e.section]); else star.push(e.section);
    }
    for (const k of st.order) {
      if (k === '*') sections.push(...star); else { put(k); if (after.has(k)) sections.push(...after.get(k)); }
    }
  }
  // 흐름 순서에 자리가 없는 칸도 버리지 않음: 머리 칸·차시·준비는 첫 화면 쪽에, 나머지는 자료·연수 후 앞에.
  // 핵심 메시지만 예외: 마무리에 같은 문장이 실렸거나, 슬라이드 교재의 따라 하기·과정·행사 흐름이면 넣지 않음(교재 보기에 있음)
  const FRONT = ['message', 'goals', 'glance', 'sessions', 'readiness'];
  const ENDS = ['materials', 'followup', 'instructor', 'speakers', 'survey', 'closing'];
  for (const k of Object.keys(S)) {
    if (placed.has(k)) continue;
    if (k === 'message' && ((closingMsg && closingMsg === lead) || (!sourceBody && ['follow', 'course', 'event'].includes(flow)))) continue;
    placed.add(k);
    const front = FRONT.indexOf(k);
    const at = front >= 0 ? sections.findIndex((s, i) => i > 0 && (FRONT.indexOf(s.type) > front || !FRONT.includes(s.type))) : sections.findIndex((s) => ENDS.includes(s.type));
    sections.splice(at < 0 ? sections.length : at, 0, S[k]);
  }
  for (const s of sections) if (s.source === undefined) delete s.source;

  const audience = {
    type: info.audience?.type || 'teachers', size: info.size || info.audience?.size || ev.size || 30, level: info.level || info.audience?.level || 'beginner',
    devices: info.audience?.devices || ['laptop'], network: info.audience?.network || 'good', blocked: info.audience?.blocked || [],
    projector: info.audience?.projector ?? true, minor: !!info.audience?.minor,
  };
  const design = { mood: [], theme: 'preset' };
  const accent = brandAccent(material.design?.colors);
  if (accent) design.accent = accent;
  if (d.fonts) design.sourceFonts = { display: d.fonts.display, body: d.fonts.body }; // 교재 글꼴 → 사이트 글꼴(resolveDesign)

  const draft = {
    version: 1, meta, audience, archetype, design, instructors, sections,
    live: { provider: 'none', features: [], anonymous: true, code: randomCode() },
    privacy: { collect: ['nickname'], retentionDays: 30, consent: true, processors: [] },
    deploy: { target: 'zip', base: '/' },
    sources: files.map((f) => ({ id: f.id, name: f.name, pages: f.pages || 0 })),
  };
  // 구성 결과: 흐름·이유·권하는 기능·교재에 있는데 싣지 못한 것
  draft.structure = { flow, label: st.label, reasons: st.reasons, suggested: st.suggested, leftovers: findLeftovers(material, draft, { max: 12 }), source: 'auto' };
  const found = d.addresses || {};
  draft._draft = {
    generator: 'heuristic', archetypeReason: st.reasons[0] || '', format: d.archetype?.format || '',
    detectedFonts: material.design?.fontsUsed?.map((f) => f.name) || [], themeColors: material.design?.colors || {},
    todo: [
      !meta.date && '연수 날짜를 확인해 주세요.',
      !meta.venue && meta.mode !== 'online' && '장소를 확인해 주세요.',
      !instructors.length && !S.speakers && '강사 정보를 넣어 주세요.',
      !S.goals && '연수 목표(마치면 할 수 있는 것)를 2~4개 적어 주세요.',
      meta.mode !== 'offline' && !meta.joinUrl && (found.join?.length ? `온라인 접속 주소: 교재에서 찾은 주소(${hostOf(found.join[0].url)})가 맞는지 확인해 주세요.` : '온라인 접속 주소(Zoom·Meet)를 넣어 주세요.'),
      !meta.contact && '문의처(연수 담당자 연락처)를 넣어 주세요.',
      meta.admin.kind === 'official' && !completion && '이수 처리 일정(언제 등록되는지)을 연수 후 안내에 적어 주세요.',
      dates.length >= 2 && !S.sessions && '차시별 제목을 넣어 주세요.',
      !info.surveyUrl && (found.survey?.length ? `만족도 조사: 교재에서 찾은 설문 주소(${hostOf(found.survey[0].url)})를 쓸지 확인해 주세요.` : '만족도 조사 주소(설문 링크)를 넣어 주세요.'),
      hasDeckFile && !info.slidesBase && !pages.some((p) => p.image) && '교재 쪽 그림(slide-001.webp…)을 만들면 교재 보기에 보여요.',
      !S.materials && '참가자가 받을 자료가 있으면 자료실에 올려 주세요.',
      stations.some((x) => !x.outcome) && '실습마다 "여기까지 됐나요?" 확인 문장을 적어 주세요.',
      readyHints.length && `준비물에 넣을지 골라 주세요(교재에는 없음): ${readyHints.join(' · ')}.`,
      noteCount > 0 && `발표자 노트에서 막히는 곳 ${noteCount}건을 실습 메모로 옮겼어요. 참가자에게 보여도 되는지 확인해 주세요.`,
      memoCount > 0 && `발표자 노트의 강사 메모 ${memoCount}건은 참가자 화면에 싣지 않고 강사용 운영안내에 담았어요(stations[].teacherNote). 참가자도 알아야 할 내용이면 실습 메모(note)에 참가자에게 하는 말로 적어 주세요.`,
    ].filter(Boolean),
  };
  return draft;
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

function imageName(im) {
  const ext = (extOf(im.name || im.path || '') || 'png').replace('jpeg', 'jpg');
  return `${im.id}.${ext}`;
}
export { getTool };
