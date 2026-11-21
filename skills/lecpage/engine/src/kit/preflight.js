// 배포 전 확인(강사용 운영안내.md 맨 위 · check 요약 · 조립 결과 preflight): 사람이 눈으로 다시 볼 것만 자동으로 찾아 한 줄씩.
//   예시·자리 값 같은 링크, 오늘이거나 지난 연수 날짜, 이수 조건이 있는데 설문 주소가 없음, 연습 모드인 채 배포, 사이트에 든 사진(공개 범위 확인).
// 사진은 내용을 짐작하지 않고(얼굴 찾기 없음) 몇 장인지만 알립니다.
import { scanTags, attr } from './html.js';

const asText = (v) => (typeof v === 'string' ? v : v instanceof Uint8Array ? new TextDecoder().decode(v) : '');
/** 예시·자리 값 주소: example.com·*.example·forms.gle/example-…·your-site·placeholder·xxxx 등 */
export const PLACEHOLDER_URL = /(?:^|[/.@-])example(?:[-_./]|$)|\.(?:example|test|invalid|localhost)(?:[/:]|$)|placeholder|your[-_]?(?:site|link|url|form|name|id)|xxxx|dummy|lorem|(?:^|\/)(?:todo|tbd)(?:\/|$)/i;
const URL_IN_TEXT = /\bhttps?:\/\/[^\s"'<>()]+|\b(?:forms\.gle|padlet\.com|bit\.ly|naver\.me)\/[^\s"'<>()]+/gi;
const SURVEY_URL = /forms\.gle|docs\.google\.com\/forms|form\.naver\.com|naver\.me|forms\.office\.com|forms\.microsoft\.com|tally\.so|typeform\.com|survey/i;
const IMAGE = /\.(png|jpe?g|webp|gif|avif)$/i;

/**
 * @param src 사이트 파일(AI가 쓴 것, 조립 전)
 * @param meta readMeta 결과(연수 정보 + 강사 값)
 * @param o { today:'YYYY-MM-DD', provider: 참여 기능 방식(local·http·…·none), preview, surveyIn: 사이트 안 설문 문항이 있음 }
 * @returns [{ code, message_ko }]
 */
export function preflight(src = {}, meta = {}, { today = '', provider = 'none', preview = false, surveyIn = false } = {}) {
  const out = [];
  const pages = Object.keys(src).filter((p) => p.endsWith('.html'));
  let siteText = '';
  // 1) 예시·자리 값 링크
  const links = new Map(); const surveys = [];
  const see = (u, where) => {
    const s = String(u || '').trim(); if (!s || /^(#|mailto:|tel:|javascript:)/i.test(s)) return;
    if (SURVEY_URL.test(s)) surveys.push(s);
    const k = s.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '').toLowerCase();
    if (PLACEHOLDER_URL.test(k) && !links.has(k)) links.set(k, where);
  };
  for (const p of pages) {
    const html = asText(src[p]);
    for (const t of scanTags(html)) {
      if (t.kind !== 'open') continue;
      if (t.name === 'a' || t.name === 'area') see(attr(t, 'href'), p);
      for (const a of ['data-copy-text', 'data-items', 'src']) { const v = attr(t, a); if (v && /^https?:|forms\.gle|padlet/i.test(v)) for (const m of v.matchAll(URL_IN_TEXT)) see(m[0], p); }
    }
    const text = html.replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, ' ').replace(/<[^>]+>/g, ' ');
    siteText += text;
    for (const m of text.matchAll(URL_IN_TEXT)) see(m[0], p);
  }
  for (const k of ['surveyUrl', 'joinUrl', 'siteUrl', 'shortUrl']) if (meta[k]) see(meta[k], `강사 값 ${k}`);
  for (const f of meta.facts || []) for (const m of String(f.value || '').matchAll(URL_IN_TEXT)) see(m[0], `lecpage.json facts "${f.label}"`);
  if (links.size) {
    const list = [...links.entries()].slice(0, 4).map(([u, w]) => `${u.slice(0, 60)}(${w})`);
    out.push({ code: 'placeholder-link', message_ko: `예시 주소 같은 링크 ${links.size}개: ${list.join(', ')}${links.size > 4 ? ' …' : ''}. 교재에 있던 예시 주소일 수 있어요. 실제 주소로 바꾸거나 빼세요.` });
  }
  // 2) 연수 날짜: 오늘이거나 지났음
  const days = (meta.sessions || []).map((s) => s.date).filter(Boolean).sort();
  const t = /^\d{4}-\d{2}-\d{2}$/.test(today) ? today : '';
  if (t && days.length) {
    const last = days[days.length - 1];
    if (last < t) out.push({ code: 'date-past', message_ko: `연수 날짜(${days.join('·')})가 이미 지났어요. 새 연수라면 날짜를 고치고, 지난 연수를 다시 여는 것이면 그대로 두세요.` });
    else if (days.includes(t)) out.push({ code: 'date-today', message_ko: `연수 날짜(${t})가 오늘이에요. 교재의 날짜를 그대로 옮긴 것은 아닌지 확인하세요.` });
  }
  // 3) 이수 조건이 있는데 설문 주소 없음(예시 주소뿐이어도)
  // 이수 조건에 설문이 들어 있음(교재 사실·사이트 글에서 '이수'와 '설문'이 가까이): 출석만으로 이수면 묻지 않음
  const near = /이수[^\n]{0,80}설문|설문[^\n]{0,80}이수/;
  const rule = (meta.facts || []).some((f) => near.test(`${f.label} ${f.value}`)) || near.test(siteText.replace(/\s+/g, ' '));
  const realSurvey = surveys.some((u) => !PLACEHOLDER_URL.test(u.replace(/^https?:\/\//i, '')));
  if (rule && !realSurvey && !surveyIn && !meta.surveyUrl) out.push({ code: 'completion-no-survey', message_ko: `이수 조건이 있는데 ${surveys.length ? '설문 주소가 예시 주소뿐이에요' : '설문 주소가 없어요'}. 기관 설문 주소를 받아 넣거나(강사 값 surveyUrl) 사이트 안 설문(data-lp="survey")을 두세요.` });
  // 4) 연습 모드인 채 배포
  if (provider === 'local' && !preview) out.push({ code: 'practice-mode', message_ko: '참여 기능이 연습 모드예요. 이대로 배포하면 출석·질문·투표가 참가자 각자의 브라우저에만 남아요. 참여 기능 서버를 연결한 뒤 다시 만드세요(앱의 바로 배포는 저절로 이어요).' });
  // 5) 사진(교재 쪽 그림 빼고): 공개 범위 확인
  const photos = Object.keys(src).filter((p) => IMAGE.test(p) && !/^material\//.test(p));
  if (photos.length) out.push({ code: 'photos', message_ko: `사진 ${photos.length}장이 있어요(${photos.slice(0, 3).map((p) => p.split('/').pop()).join(', ')}${photos.length > 3 ? ' …' : ''}). 공개해도 되는 사진인지, 공개 범위(링크만·공개·암호)가 맞는지 확인하세요.` });
  return out;
}
