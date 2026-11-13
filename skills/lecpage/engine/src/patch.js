// 설계도 부분 고치기(patch). AI 답·CLI·앱이 같은 형식을 씁니다. 설계도 전체를 다시 쓰지 않고 바뀐 곳만 보냅니다.
//
//   {
//     "meta":     { …부분 병합… },            // 객체는 깊게 병합, 배열은 통째로 바꿈, null은 그 키를 지움
//     "design":   { …부분 병합… },
//     "audience" | "archetype" | "privacy" | "live" | "concept": { …부분 병합… }   // live는 provider·features 등만(주소·키·코드 제외)
//     "instructors": [ … ],                     // 배열은 통째로 바꿈
//     "sections": { "<칸 id>": { …얕은 병합… } | null },   // null이면 칸 삭제
//     "add":      [ { "after": "<칸 id>"|null, "section": { "type": "...", … } } ],  // after가 없거나 null이면 맨 끝
//     "order":    [ "id1", "id2", … ],           // 적은 칸을 이 순서로 앞에, 나머지는 원래 순서대로 뒤에
//     "note":     "무엇을 바꿨는지 한 줄"
//   }
//
// 보안: 패치는 AI 출력에서 올 수 있어(프롬프트 주입 통로) 참가자 QR·관리자 키가 향하는 값은 받지 않습니다.
//   meta.siteUrl·joinUrl·shortUrl, live.url·code·anonKey, access 는 지우고 주의를 남깁니다. 이 값은 강사에게 직접 받습니다.
import { validate, str } from './validate.js';
import { SECTION_DEFS, SECTION_TYPES } from './schema/sections.js';
import { PRESETS } from './design/presets.js';
import { FX } from './design/fx-catalog.js';
import { syncHeroMeta } from './hero-meta.js';
import { PALETTE_BY_ID, FONT_PAIR_BY_ID } from './design/seeds.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
// validate.js의 칸 id 규칙과 같게(브리프·검증 결과에 보이는 id로 칸을 찾음)
const slug = (s, i) => (str(s, 40).toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-').replace(/^-|-$/g, '') || `s${i}`);

const MERGE_KEYS = ['meta', 'design', 'audience', 'archetype', 'privacy', 'live', 'deploy', 'concept'];
const REPLACE_KEYS = ['instructors', 'sources'];
const KNOWN = new Set([...MERGE_KEYS, ...REPLACE_KEYS, 'sections', 'add', 'order', 'note']);
/** 패치로 바꿀 수 없는 값(강사에게 직접 받는 값) */
export const PROTECTED_PATHS = ['meta.siteUrl', 'meta.joinUrl', 'meta.shortUrl', 'live.url', 'live.code', 'live.anonKey', 'access'];

/** RFC 7396(JSON Merge Patch): 객체는 재귀 병합, 배열·값은 바꿈, null은 키 삭제 */
function mergeDeep(target, patch) {
  if (!isObj(patch)) return clone(patch);
  const out = isObj(target) ? { ...target } : {};
  for (const [k, v] of Object.entries(patch)) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
    if (v === null) delete out[k];
    else out[k] = isObj(v) ? mergeDeep(out[k], v) : clone(v);
  }
  return out;
}

/** 칸마다 id를 붙임(validate와 같은 규칙). 숨긴 칸도 id를 받아 패치로 다시 켤 수 있음 */
export function withSectionIds(sections) {
  const seen = new Set();
  return (Array.isArray(sections) ? sections : []).map((s, i) => {
    if (!isObj(s)) return s;
    let id = slug(s.id || s.type, i + 1);
    while (seen.has(id)) id += '-' + (i + 1);
    seen.add(id);
    return s.id === id ? s : { ...s, id };
  });
}

function stripProtected(patch, warnings) {
  const p = { ...patch };
  const drop = (path) => warnings.push({ path, message_ko: `${path} 값은 패치로 바꾸지 않아요. 강사에게 직접 받아 연수 정보(info)로 넣어 주세요.` });
  if ('access' in p) { delete p.access; drop('access'); }
  if (isObj(p.meta)) { p.meta = { ...p.meta }; for (const k of ['siteUrl', 'joinUrl', 'shortUrl']) if (k in p.meta) { delete p.meta[k]; drop('meta.' + k); } }
  if (isObj(p.live)) { p.live = { ...p.live }; for (const k of ['url', 'code', 'anonKey']) if (k in p.live) { delete p.live[k]; drop('live.' + k); } }
  return p;
}

const label = (s) => (s && (str(s.title, 40) || str(s.nav, 12) || SECTION_DEFS[s.type]?.label)) || '섹션';

/**
 * 설계도에 패치를 적용하고 검증합니다. 예외를 던지지 않습니다.
 * @returns {{ raw, blueprint, errors, warnings, note, applied }}
 *   raw       패치를 적용한 원본 모양(숨긴 칸·쓰지 않는 필드 유지) → 파일·앱 상태에 저장
 *   blueprint validate()를 거친 결과(빌드·화면용)
 *   warnings  패치 경고(kind:'patch', 모르는 id·막힌 필드) + 검증 경고
 *   applied   적용한 작업 수
 */
export function applyBlueprintPatch(bp, patch) {
  const warnings = [];
  let applied = 0;
  const raw = isObj(bp) ? clone(bp) : {};
  raw.sections = withSectionIds(raw.sections);
  if (!isObj(patch)) {
    warnings.push({ path: '', kind: 'patch', message_ko: '패치가 JSON 객체가 아니라 적용하지 않았어요.' });
    const v = validate(raw);
    return { raw, blueprint: v.blueprint, errors: v.errors, warnings: [...warnings, ...v.warnings], note: '', applied };
  }
  const p = stripProtected(patch, warnings);
  for (const k of Object.keys(p)) if (!KNOWN.has(k)) warnings.push({ path: k, message_ko: `모르는 항목 "${str(k, 30)}"는 건너뛰었어요.` });

  for (const k of MERGE_KEYS) {
    if (!(k in p)) continue;
    if (!isObj(p[k])) { warnings.push({ path: k, message_ko: `${k}는 객체여야 해요.` }); continue; }
    raw[k] = mergeDeep(raw[k], p[k]); applied++;
  }
  if (isObj(p.design) && p.design.preset) delete raw._presetAuto; // 직접 고른 디자인(자동 추천 아님)
  // 컨셉을 고치면 강사가 세운 컨셉으로 표시(다시 만들 때 지킴). source를 직접 적었으면 그 값
  if (isObj(p.concept) && isObj(raw.concept) && !('source' in p.concept)) raw.concept.source = 'teacher';
  for (const k of REPLACE_KEYS) {
    if (!(k in p)) continue;
    if (!Array.isArray(p[k])) { warnings.push({ path: k, message_ko: `${k}는 배열이어야 해요.` }); continue; }
    raw[k] = clone(p[k]); applied++;
  }

  // 일시·장소·강사가 바뀌면 첫 화면에 따로 적힌 그 줄도 함께 바꿈(초안이 만든 글자 그대로일 때만)
  if (('meta' in p || 'instructors' in p) && isObj(bp)) syncHeroMeta(bp, raw);

  // 칸 고치기·지우기(얕은 병합: 칸의 맨 위 키만 바꾸고, 배열·객체 값은 통째로 바꿈)
  if ('sections' in p) {
    if (!isObj(p.sections)) warnings.push({ path: 'sections', message_ko: 'sections는 { "섹션 id": {…} | null } 모양이어야 해요.' });
    else for (const [id, change] of Object.entries(p.sections)) {
      const i = raw.sections.findIndex((s) => s?.id === id);
      if (i < 0) { warnings.push({ path: `sections.${id}`, message_ko: `"${str(id, 40)}" 섹션이 없어 건너뛰었어요. (있는 섹션: ${raw.sections.map((s) => s?.id).filter(Boolean).join(', ')})` }); continue; }
      if (change === null) { raw.sections.splice(i, 1); applied++; continue; }
      if (!isObj(change)) { warnings.push({ path: `sections.${id}`, message_ko: '섹션 변경은 객체나 null이어야 해요.' }); continue; }
      const next = { ...raw.sections[i] };
      for (const [k, v] of Object.entries(change)) {
        if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
        if (k === 'id' && v !== id) { warnings.push({ path: `sections.${id}.id`, message_ko: '섹션 id는 바꾸지 않았어요.' }); continue; }
        if (v === null) delete next[k]; else next[k] = clone(v);
      }
      if (!SECTION_TYPES.includes(next.type)) { warnings.push({ path: `sections.${id}.type`, message_ko: `알 수 없는 섹션 종류 "${str(next.type, 20)}"라 바꾸지 않았어요.` }); continue; }
      raw.sections[i] = next; applied++;
    }
  }

  // 칸 추가
  if ('add' in p) {
    const list = Array.isArray(p.add) ? p.add : isObj(p.add) ? [p.add] : [];
    if (!list.length) warnings.push({ path: 'add', message_ko: 'add는 [{ "after": "섹션 id", "section": {…} }] 모양이어야 해요.' });
    for (const [n, a] of list.entries()) {
      const sec = isObj(a?.section) ? clone(a.section) : null;
      if (!sec || !SECTION_TYPES.includes(sec.type)) { warnings.push({ path: `add[${n}]`, message_ko: `추가할 섹션의 종류(type)가 없거나 알 수 없어요: "${str(sec?.type, 20)}"` }); continue; }
      const ids = new Set(raw.sections.map((s) => s?.id));
      let id = slug(sec.id || sec.type, raw.sections.length + 1);
      for (let k = 2; ids.has(id); k++) id = `${slug(sec.id || sec.type, k)}-${k}`;
      sec.id = id;
      let at = raw.sections.length;
      const after = a.after ?? null;
      if (after !== null) {
        const i = raw.sections.findIndex((s) => s?.id === after);
        if (i < 0) warnings.push({ path: `add[${n}].after`, message_ko: `"${str(after, 40)}" 섹션이 없어 맨 끝에 넣었어요.` });
        else at = i + 1;
      }
      raw.sections.splice(at, 0, sec); applied++;
    }
  }

  // 순서
  if ('order' in p) {
    if (!Array.isArray(p.order)) warnings.push({ path: 'order', message_ko: 'order는 섹션 id 배열이어야 해요.' });
    else {
      const byId = new Map(raw.sections.map((s) => [s?.id, s]));
      const head = [];
      for (const id of p.order) {
        if (!byId.has(id)) { warnings.push({ path: 'order', message_ko: `순서에 적은 "${str(id, 40)}" 섹션이 없어요.` }); continue; }
        if (!head.includes(byId.get(id))) head.push(byId.get(id));
      }
      raw.sections = [...head, ...raw.sections.filter((s) => !head.includes(s))]; applied++;
    }
  }

  const v = validate(raw);
  for (const w of warnings) w.kind = 'patch';
  return { raw, blueprint: v.blueprint, errors: v.errors, warnings: [...warnings, ...v.warnings], note: str(p.note, 200), applied };
}

const META_LABEL = { title: '연수명', subtitle: '부제', organizer: '주최', date: '날짜', start: '시작 시각', end: '끝 시각', venue: '장소', mode: '형태', description: '소개 글', siteUrl: '사이트 주소', joinUrl: '참여 주소', shortUrl: '짧은 주소' };
const DESIGN_LABEL = { preset: '디자인', motion: '움직임', accent: '강조색', theme: '밝기', signature: '대표 효과', palette: '색 조합', fontPair: '글꼴 조합', font: '글꼴', mood: '분위기' };
// 디자인 값을 사람이 읽는 이름으로(효과 id·영문 키가 화면에 나오지 않게)
const MOTION_KO = ['움직임 없음', '차분하게', '보통', '화려하게'];
const THEME_KO = { light: '밝게', dark: '어둡게', auto: '기기 설정 따라', preset: '디자인대로' };
const ACCESS_KO = { link: '주소를 받은 사람만', password: '암호를 아는 사람만', public: '누구나' };
function designValue(k, v) {
  if (v === undefined || v === '') return '';
  if (k === 'preset') return PRESETS.find((p) => p.id === v)?.name_ko || v;
  if (k === 'signature') return FX.find((f) => f.id === v)?.name_ko || v;
  if (k === 'palette') return PALETTE_BY_ID[v]?.name_ko || v;
  if (k === 'fontPair') return FONT_PAIR_BY_ID[v]?.name_ko || v;
  if (k === 'motion') return MOTION_KO[+v] || String(v);
  if (k === 'theme') return THEME_KO[v] || v;
  if (k === 'mood') return [].concat(v).join('·');
  return v;
}
const short = (v) => { const s = typeof v === 'string' ? v : JSON.stringify(v ?? ''); return s.length > 24 ? s.slice(0, 23) + '…' : s; };
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const FIELD_LABEL = { name: '이름', steps: '단계', q: '물음', a: '답', title: '제목', lead: '안내 글', subtitle: '부제', text: '글', items: '항목', slides: '쪽', nav: '메뉴 이름', hidden: '숨기기', tone: '배경', questions: '문항', prompts: '프롬프트', md: '글', ctas: '버튼', url: '주소' };

/**
 * 두 설계도의 차이를 짧은 한국어 줄로. 예: "3번째 칸 '실습' 제목 바뀜"
 * @param {object} before @param {object} after (raw든 검증본이든 됨)
 * @param {number} [max=12] 줄 수 상한
 */
export function diffSummary(before, after, max = 12) {
  const a = isObj(before) ? before : {}, b = isObj(after) ? after : {};
  const lines = [];
  for (const [k, name] of Object.entries(META_LABEL)) {
    const x = a.meta?.[k], y = b.meta?.[k];
    if (!same(x, y)) lines.push(y ? `${name}: ${x ? `${short(x)} → ` : ''}${short(y)}` : `${name} 지움`);
  }
  for (const [k, name] of Object.entries(DESIGN_LABEL)) {
    const x = a.design?.[k], y = b.design?.[k];
    if (!same(x, y)) { const xs = designValue(k, x), ys = designValue(k, y); lines.push(`${name}: ${xs ? `${short(xs)} → ` : ''}${ys ? short(ys) : '기본값'}`); }
  }
  if (!same(a.concept?.idea, b.concept?.idea)) lines.push(b.concept?.idea ? `컨셉: ${a.concept?.idea ? `${short(a.concept.idea)} → ` : ''}${short(b.concept.idea)}` : '컨셉 지움');
  else if (!same({ ...a.concept, source: 0 }, { ...b.concept, source: 0 })) lines.push('컨셉의 모티프·근거·섹션·기능 바뀜');
  if (!same(a.access?.mode, b.access?.mode)) lines.push(`공개 범위: ${ACCESS_KO[a.access?.mode || 'link']} → ${ACCESS_KO[b.access?.mode || 'link']}`);
  for (const k of ['audience', 'archetype', 'privacy', 'instructors']) if (!same(a[k], b[k])) lines.push({ audience: '대상 정보 바뀜', archetype: '사이트 유형 바뀜', privacy: '개인정보 설정 바뀜', instructors: '강사 정보 바뀜' }[k]);
  if (!same({ ...a.live, url: 0, code: 0, anonKey: 0 }, { ...b.live, url: 0, code: 0, anonKey: 0 })) lines.push('참여 기능 설정 바뀜');

  const sa = withSectionIds(a.sections), sb = withSectionIds(b.sections);
  const ida = sa.map((s) => s?.id), idb = sb.map((s) => s?.id);
  for (const s of sa) if (s && !idb.includes(s.id)) lines.push(`섹션 삭제: '${label(s)}'`);
  sb.forEach((s, i) => {
    if (!s) return;
    const old = sa.find((x) => x?.id === s.id);
    if (!old) { { const kind = SECTION_DEFS[s.type]?.label; lines.push(`섹션 추가: ${i + 1}번째 '${label(s)}'${kind && kind !== label(s) ? `(${kind})` : ''}`); } return; }
    const keys = [...new Set([...Object.keys(old), ...Object.keys(s)])].filter((k) => k !== 'id' && !same(old[k], s[k]));
    if (!keys.length) return;
    if (keys.length === 1 && keys[0] === 'hidden') { lines.push(`섹션 ${s.hidden ? '숨김' : '다시 보임'}: '${label(old)}'`); return; }
    const parts = keys.slice(0, 3).map((k) => {
      const x = old[k], y = s[k];
      if (Array.isArray(x) && Array.isArray(y) && x.length !== y.length) return `${FIELD_LABEL[k] || k} ${x.length}→${y.length}개`;
      if (Array.isArray(x) && Array.isArray(y)) {
        // 같은 개수면 몇 번째 항목의 무엇이 바뀌었는지
        const idx = y.map((v, n) => (same(v, x[n]) ? -1 : n)).filter((n) => n >= 0);
        const sub = idx.length === 1 && isObj(x[idx[0]]) && isObj(y[idx[0]]) ? Object.keys({ ...x[idx[0]], ...y[idx[0]] }).filter((f) => !same(x[idx[0]][f], y[idx[0]][f])) : [];
        return `${idx.slice(0, 2).map((n) => n + 1).join('·')}번째 ${FIELD_LABEL[k] || k}${sub.length ? ' ' + sub.slice(0, 2).map((f) => FIELD_LABEL[f] || f).join('·') : ''}`;
      }
      return `${FIELD_LABEL[k] || k}`;
    });
    lines.push(`${i + 1}번째 섹션 '${label(old)}' ${parts.join('·')}${keys.length > 3 ? ` 외 ${keys.length - 3}` : ''} 바뀜`);
  });
  const common = ida.filter((id) => idb.includes(id));
  if (common.join() !== idb.filter((id) => ida.includes(id)).join()) lines.push('섹션 순서 바뀜');
  return lines.length > max ? [...lines.slice(0, max - 1), `외 ${lines.length - max + 1}건`] : lines;
}
