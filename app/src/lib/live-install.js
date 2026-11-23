// 참여 기능 연결(구글 시트·Supabase)에서 옮겨 적는 횟수를 줄이는 조각(components/LiveSetup.jsx가 씀, 화면 없는 순수 함수라 시험이 그대로 부름).
//   구글 시트: 관리자 키(해시)·연수 코드·설정을 '설치 코드' 한 줄로(backends/apps-script/Code.gs의 readInstall이 읽음).
//             코드를 붙여 넣는 길에서는 그 한 줄을 Code.gs의 `var INSTALL = '';` 자리에 넣어 복사 → 시트 메뉴에서 따로 넣을 것이 없음
//   Supabase: 설치 SQL(schema.sql)과 연수 등록 SQL을 한 번에 복사, 대시보드에서 복사한 글에서 프로젝트 URL과 publishable 키를 찾아냄
// 관리자 키 자체는 어디에도 싣지 않음(SHA-256 해시만). 키는 앱이 만들어 이 브라우저에 기억함.

const CODE_RE = /^[A-Z0-9][A-Z0-9_-]{2,39}$/;
const HASH_RE = /^[0-9a-f]{64}$/;
const days = (v) => { const n = Math.floor(Number(v)); return n >= 1 && n <= 365 ? n : 30; };

const b64u = (s) => { let bin = ''; for (const b of new TextEncoder().encode(s)) bin += String.fromCharCode(b); return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64u = (s) => { const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/')); return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))); };

/** 구글 시트 설치 코드: lpi1.<base64url JSON { c 연수 코드, h 관리자 키 해시, u 파일 올리기, m 먼저 확인, r 보관 일수 }> */
export function sheetInstallCode({ code, hash, uploads = false, moderation = false, retentionDays = 30 }) {
  const c = String(code || '').trim().toUpperCase();
  if (!CODE_RE.test(c)) throw new Error('연수 코드가 올바르지 않아요.');
  if (!HASH_RE.test(String(hash || ''))) throw new Error('관리자 키를 만들지 못했어요. 다시 눌러 주세요.');
  return 'lpi1.' + b64u(JSON.stringify({ c, h: hash, u: uploads ? 1 : 0, m: moderation ? 1 : 0, r: days(retentionDays) }));
}
/** 설치 코드를 다시 읽음(시험·확인용. 시트 쪽 Code.gs readInstall과 같은 규칙). 틀리면 null */
export function readSheetInstall(text) {
  const m = /^lpi1\.([A-Za-z0-9_-]{20,600})$/.exec(String(text || '').replace(/\s+/g, ''));
  if (!m) return null;
  let o; try { o = JSON.parse(unb64u(m[1])); } catch { return null; }
  if (!o || typeof o !== 'object' || !HASH_RE.test(String(o.h || '')) || !CODE_RE.test(String(o.c || ''))) return null;
  return { code: o.c, hash: o.h, uploads: o.u === 1 || o.u === true, moderation: o.m === 1 || o.m === true, retentionDays: days(o.r) };
}
const INSTALL_SLOT = "var INSTALL = '';";
/** Code.gs 글에 설치 코드를 넣음(자리 `var INSTALL = '';` 한 곳). 자리가 없으면 null(예전 Code.gs) */
export function withSheetInstall(gs, installCode) {
  const src = String(gs || '');
  if (!/^lpi1\.[A-Za-z0-9_-]+$/.test(installCode) || src.split(INSTALL_SLOT).length !== 2) return null;
  return src.replace(INSTALL_SLOT, `var INSTALL = '${installCode}';`);
}

/** Supabase 연수 등록 SQL 한 줄: 보관 기간·파일 올리기·먼저 확인·틱 간격을 서버에도 똑같이 걸어 둠(같은 값으로 다시 실행해도 같은 결과) */
export function trainingSql(code, hash, settings = {}) {
  const c = String(code || '').trim().toUpperCase();
  if (!CODE_RE.test(c)) throw new Error('연수 코드가 올바르지 않아요.');
  if (!HASH_RE.test(String(hash || ''))) throw new Error('관리자 키를 만들지 못했어요. 다시 눌러 주세요.');
  const s = {};
  if (settings.retentionDays != null) s.retentionDays = days(settings.retentionDays);
  for (const k of ['uploads', 'moderation']) if (typeof settings[k] === 'boolean') s[k] = settings[k];
  if (Number.isFinite(+settings.flushMs)) s.flushMs = Math.min(10000, Math.max(500, Math.round(+settings.flushMs)));
  return `select lec_private.init_training_hash('${c}', '${hash}', '${JSON.stringify(s)}');`;
}
/** 설치 SQL + 연수 등록을 한 번에(schema.sql은 여러 번 실행해도 안전, 등록은 같은 코드면 덮어씀) */
export function supabaseInstallSql(schema, code, hash, settings = {}) {
  return `${String(schema || '').replace(/\s+$/, '')}\n\n-- ---------------------------------------------------------------- 이 연수 등록(lecpage 앱이 붙임)\n${trainingSql(code, hash, settings)}\n`;
}

const jwtRole = (t) => { try { return JSON.parse(unb64u(t.split('.')[1])).role || ''; } catch { return ''; } };
/**
 * Supabase 대시보드(Connect 창·API Keys)에서 복사한 글에서 프로젝트 URL과 publishable 키를 찾음.
 * → { url, key, secret } — secret: 글에 secret 키(sb_secret_…·service_role)가 들어 있었음(쓰지 않고 버림, 화면이 알려 줌)
 * 예전 anon 키(JWT, role anon)도 받음. 주소만·키만 있어도 찾은 것만 돌려줌
 */
export function parseSupabasePaste(text) {
  const t = String(text || '');
  const url = (/https:\/\/[a-z0-9][a-z0-9-]{3,60}\.supabase\.co\b/i.exec(t) || [''])[0].toLowerCase();
  let key = (/\bsb_publishable_[A-Za-z0-9_-]{8,200}/.exec(t) || [''])[0];
  let secret = /\bsb_secret_[A-Za-z0-9_-]{4,}/.test(t);
  for (const j of t.match(/\beyJ[A-Za-z0-9_-]{5,}\.eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/g) || []) {
    const role = jwtRole(j);
    if (role === 'service_role') secret = true; else if (role === 'anon' && !key) key = j;
  }
  return { url, key, secret };
}
/** 키 칸에 넣은 값이 secret 키인지(넣으면 안 되는 키) */
export const isSupabaseSecret = (v) => /^sb_secret_/.test(String(v || '').trim()) || jwtRole(String(v || '').trim()) === 'service_role';
