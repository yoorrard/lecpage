import { useEffect, useRef, useState } from 'preact/hooks';
import { Field, Notice } from './ui.jsx';
import { Steps, ClickShot } from './Steps.jsx';
import { E } from '../lib/engine.js';
import { copy, randomKey, sha256Hex, toast } from '../lib/util.js';
import { loadKey, saveKey, forgetKey } from '../lib/ai.js';
import { deployView, patchDeploy, featuresOf } from '../lib/site-meta.js';
import { useCfWay, CfProgress, CfGetConnect, ensureRelay, cfFail, checkAdminKey } from './CfConnect.jsx';
import { markCfUsed } from '../lib/cf-connect.js';
import { OneClickCard, RunFail, useRun } from './OneClick.jsx';
import { ConnectUpdate } from './PcConnect.jsx';
import { sheetInstallCode, withSheetInstall, supabaseInstallSql, parseSupabasePaste, isSupabaseSecret } from '../lib/live-install.js';

/**
 * 한 번 연결하면 다음 연수부터 저절로: 내 서버(Cloudflare·학교 서버)는 연수 코드마다 따로 저장해 여러 연수를 한 서버가 맡으므로,
 * 연결한 주소를 이 기기에 기억해 두고 새 연수에 그대로 씀(구글 시트는 시트 하나가 연수 하나라 기억하지 않음).
 * 관리자 키는 앱이 만들어 복사해 주고(강사가 짓지 않게), 연결한 주소별로 이 기기에 기억해 연수 당일 배포 완료 화면에 보여 줌.
 */
export const rememberedServer = () => loadKey('live-server').then((r) => (r.key && /^https:\/\//.test(r.key) ? r.key : ''), () => '');
// 관리자 키는 서버 주소와 연수 코드로 기억(Supabase 프로젝트 하나에 연수 여럿이면 연수마다 키가 다름). 예전에 주소로만 기억한 키도 그대로 찾음
const adminSlot = (url, code = '') => 'live-admin:' + String(url).replace(/\/+$/, '') + (code ? '#' + code : '');
export const adminKeyFor = (url, code = '') => (url ? loadKey(adminSlot(url, code)).then((r) => r.key || (code ? loadKey(adminSlot(url)).then((x) => x.key || '', () => '') : ''), () => '') : Promise.resolve(''));
const keepAdminKey = (url, key, code = '') => { saveKey(adminSlot(url), key, true).catch(() => { }); if (code) saveKey(adminSlot(url, code), key, true).catch(() => { }); };
/** 연결한 내 서버를 이 기기에 기억(다음 연수부터 저절로) + 그 서버의 관리자 키 */
export const rememberServer = (url, key, code = '') => { saveKey('live-server', url, true).catch(() => { }); if (key) keepAdminKey(url, key, code); };
/** 지운 서버는 잊음(기억한 주소가 그 서버일 때만) */
export const forgetServer = (url) => rememberedServer().then((u) => (u && u.replace(/\/+$/, '') === String(url || '').replace(/\/+$/, '') ? forgetKey('live-server') : null)).catch(() => { });

const REPO = 'https://github.com/yoorrard/lecpage/tree/main/skills/lecpage';
const CF_DEPLOY = 'https://deploy.workers.cloudflare.com/?url=https://github.com/yoorrard/lecpage/tree/main/skills/lecpage/backends/cloudflare';
// 운영자가 코드가 든 시트 틀을 공유해 두면(빌드 변수 VITE_SHEET_TEMPLATE, …/copy 주소) 코드 붙여넣기 단계가 사라짐
const SHEET_TEMPLATE = /^https:\/\/docs\.google\.com\/spreadsheets\//.test(import.meta.env?.VITE_SHEET_TEMPLATE || '') ? import.meta.env.VITE_SHEET_TEMPLATE : '';
const NAME = { sheets: '구글 시트', supabase: 'Supabase', http: '내 서버·Cloudflare', local: '이 컴퓨터에서만(시험)' };
// 방법마다 한 줄: 무엇이 필요한지(고르기 전에 읽는 글)
const NEED = {
  http: 'Cloudflare 계정(무료)이 필요해요. 한 번 만들면 다음 연수부터 저절로 연결돼요.',
  sheets: '구글 계정만 있으면 돼요. 기록이 내 구글 시트에 쌓여요.',
  supabase: 'Supabase 계정(무료)이 필요해요. 기록과 파일을 내 프로젝트에 저장해요.',
};
// Supabase 대시보드 바로가기(프로젝트 자리 `_`는 대시보드가 고르게 함. 2026-11-23 공식 문서의 주소: 빠른 시작 React·API keys)
const SB_NEW = 'https://supabase.com/dashboard/new';
const SB_SQL = 'https://supabase.com/dashboard/project/_/sql/new';
const SB_CONNECT = 'https://supabase.com/dashboard/project/_?showConnect=true&connectTab=frameworks';
// 앱이 만든 관리자 키를 연결이 끝날 때까지 이 기기에 둠(코드를 복사한 뒤 화면을 새로 고쳐도 같은 키로 이어 가게)
const pendingSlot = (code) => 'live-pending:' + code;
const METHOD_OF = { sheets: 'sheets', supabase: 'supabase', cloudflare: 'http', server: 'http', lan: 'http', none: 'sheets', local: 'sheets' };

/** 실시간 서버에 실제로 닿는지 확인(연결 확인 버튼) */
export async function pingLive(live, code) {
  const url = String(live.url || '').trim().replace(/\/+$/, '');
  if (!/^https:\/\//.test(url) && !/^http:\/\/(localhost|127\.0\.0\.1|192\.168\.|10\.)/.test(url)) throw new Error('https:// 로 시작하는 주소를 넣어 주세요.');
  const t = AbortSignal.timeout ? AbortSignal.timeout(12000) : undefined;
  if (live.provider === 'sheets') {
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url)) throw new Error('웹 앱 URL은 https://script.google.com/macros/s/…/exec 모양이에요. 배포 → 배포 관리에서 복사해 주세요.');
    const r = await fetch(url + '?a=ping', { signal: t }); const j = await r.json().catch(() => null);
    if (!j || j.ok !== true) throw new Error('시트가 답하지 않아요. 배포할 때 "액세스 권한: 모든 사용자"로 골랐는지 확인해 주세요.');
    // 새 Code.gs는 관리자 키가 있는지 알려 줌(예전 것은 이 값이 없어 그대로 지나감)
    if (j.data?.ready === false) throw new Error('시트에 이 연수의 설정이 아직 없어요. 2번을 다시 한 뒤 눌러 주세요.');
    // 시트 하나는 연수 하나: 다른 연수 코드로 굳은 시트면 당일에 아무것도 모이지 않으므로 여기서 알려 줌
    const st = code ? await fetch(`${url}?a=state&code=${encodeURIComponent(code)}`, { signal: t }).then((x) => x.json(), () => null).catch(() => null) : null;
    if (st && st.ok === false && st.error === 'unknown_training') throw new Error('이 시트는 다른 연수에 쓰는 시트예요. 연수마다 시트를 새로 만들어요.');
    return '구글 시트와 연결했어요.';
  }
  if (live.provider === 'supabase') {
    if (!live.anonKey) throw new Error('publishable 키를 넣어 주세요.');
    if (isSupabaseSecret(live.anonKey)) throw new Error('secret 키예요. 이 키는 넣지 않아요. Publishable key(sb_publishable_…)를 넣어 주세요.');
    let r;
    try { r = await fetch(url + '/rest/v1/rpc/lec_snapshot', { method: 'POST', signal: t, headers: { apikey: live.anonKey, authorization: 'Bearer ' + live.anonKey, 'content-type': 'application/json', 'x-lec-code': code }, body: JSON.stringify({ p_code: code, p_since: 9007199254740991 }) }); }
    catch (e) { if (e?.name === 'TimeoutError' || e?.name === 'AbortError') throw e; throw new Error('프로젝트에 닿지 않아요. 프로젝트 URL을 확인해 주세요. 무료 프로젝트는 한동안 쓰지 않으면 멈춰요. 멈췄다면 Supabase 대시보드에서 프로젝트를 열고 [Resume project]를 눌러요.'); }
    const j = await r.json().catch(() => ({}));
    if (r.ok) return 'Supabase와 연결했어요.';
    // 540: Supabase가 멈춘 프로젝트에 주는 상태(공식 문서 HTTP status codes). 되살리는 곳은 대시보드의 그 프로젝트 화면
    if (r.status === 540) throw new Error('프로젝트가 멈춰 있어요. Supabase 대시보드에서 이 프로젝트를 열고 [Resume project]를 누른 뒤 다시 확인해 주세요.');
    if (/unknown_training|404/.test(JSON.stringify(j))) throw new Error('연수가 아직 등록되지 않았어요. 2번의 [설치 SQL 복사]로 다시 실행해 주세요.');
    if (r.status === 404) throw new Error('설치 SQL을 아직 실행하지 않은 것 같아요(2번).');
    if (r.status === 401 || r.status === 403) throw new Error('키가 맞지 않아요. 이 프로젝트의 Publishable key(sb_publishable_…)인지 확인해 주세요.');
    throw new Error(j.message || `Supabase 오류 ${r.status}`);
  }
  const r = await fetch(url + '/api/health', { signal: t }); const j = await r.json().catch(() => null);
  if (!j || j.ok !== true) throw new Error('서버가 답하지 않아요. 주소와 서버가 켜져 있는지 확인해 주세요.');
  // 파일을 받는 서버인지(Cloudflare 서버에 R2를 붙이지 않았으면 false): 사이트가 보드의 파일 칸을 이에 맞춰 보이거나 숨김
  if (typeof j.uploads === 'boolean') live.uploads = j.uploads;
  return '서버와 연결했어요.';
}

/** 이 연결이 이 관리자 키를 받는지(구글 시트·Supabase): 'ok' | 'bad'(다른 키가 걸려 있음) | 'unknown'(확인하지 못함) */
async function verifyAdmin(live, code, key) {
  const url = String(live.url || '').replace(/\/+$/, ''); const t = AbortSignal.timeout ? AbortSignal.timeout(12000) : undefined;
  try {
    if (live.provider === 'sheets') {
      const j = await fetch(url, { method: 'POST', redirect: 'follow', credentials: 'omit', signal: t, headers: { 'content-type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ a: 'checkAdmin', code, admin: key }) }).then((r) => r.json());
      return j?.ok === true ? (j.data === true ? 'ok' : j.data === false ? 'bad' : 'unknown') : 'unknown';
    }
    if (live.provider === 'supabase') {
      const r = await fetch(url + '/rest/v1/rpc/lec_check_admin', { method: 'POST', signal: t, headers: { apikey: live.anonKey, authorization: 'Bearer ' + live.anonKey, 'content-type': 'application/json', 'x-lec-code': code }, body: JSON.stringify({ p_code: code, p_admin: key }) });
      const j = await r.json().catch(() => null);
      return r.ok && j === true ? 'ok' : j === false || r.status === 401 || r.status === 403 ? 'bad' : 'unknown';
    }
  } catch { /* 확인하지 못함 */ }
  return 'unknown';
}
/** 이미 연결한 구글 시트·Supabase가 날짜별 출석(여러 날 연수의 이수 판정)을 아는 버전인지: true | false(예전 설치) | null(확인하지 못함) */
async function daysReady(live) {
  const url = String(live.url || '').replace(/\/+$/, ''); const t = AbortSignal.timeout ? AbortSignal.timeout(12000) : undefined;
  try {
    if (live.provider === 'sheets') { const j = await fetch(url + '?a=ping', { signal: t }).then((r) => r.json()); return j?.ok === true ? j.data?.days === true : null; }
    if (live.provider === 'supabase') {
      const r = await fetch(url + '/rest/v1/rpc/lec_caps', { method: 'POST', signal: t, headers: { apikey: live.anonKey, authorization: 'Bearer ' + live.anonKey, 'content-type': 'application/json' }, body: '{}' });
      if (r.ok) return (await r.json().catch(() => null))?.days === true;
      return r.status === 404 ? false : null;
    }
  } catch { /* 확인하지 못함 */ }
  return null;
}

/** 서버에 걸어 둘 연수 설정: 보관 기간·파일 올리기·사전 검토 */
export function liveSettings(bp) {
  const board = (bp.sections || []).find((x) => x.type === 'board');
  return { retentionDays: bp.privacy?.retentionDays || 30, uploads: !!board && board.allowFiles !== false && !bp.audience?.minor, moderation: !!board?.moderation };
}
/**
 * ⑦ 내 서버(Deploy to Cloudflare 버튼·학교 서버)에 이 연수의 설정(보관 기간·파일 올리기·사전 검토)을 걸어 둠.
 * 그 서버의 관리자 키로 /init을 부름(서버 기본값 30일 대신 설계도의 보관 기간). 예전 서버가 받지 않으면 그대로 둠
 */
export async function applyServerSettings(url, code, key, bp) {
  if (!url || !key || !code) return false;
  try {
    const r = await fetch(`${String(url).replace(/\/+$/, '')}/api/${encodeURIComponent(code)}/init`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-lec-admin': encodeURIComponent(key) },
      body: JSON.stringify({ adminKeyHash: await sha256Hex(key), settings: liveSettings(bp) }), signal: AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined,
    });
    return r.ok;
  } catch { return false; }
}
/** Supabase 틱 간격(ms): 인원이 많을수록 길게(받는 사람 수만큼 세는 초당 100건 한도). 30명 2초 · 80명 2초 · 200명 5초 */
export const supabaseFlushMs = (bp) => Math.min(10000, Math.max(2000, Math.round((Number(bp.audience?.size) || 0) * 25)));

/** prefer: 바로 배포 서버가 참여 기능을 넘기며 준 순서(liveNext: ['cloudflare', 'supabase']). 주면 그 순서로 권함 */
export function LiveSetup({ p, update, prefer = null }) {
  const bp = deployView(p); const live = bp.live || {}; const info = p.info || {};
  const code = live.code || '';
  const reco = E.decideInfra({ size: info.size, features: featuresOf(p), skill: 'click', network: info.network, minor: info.minor, commercial: info.commercial });
  const connected = ['sheets', 'supabase', 'http'].includes(live.provider) && live.url && p.liveOk;
  // 앱에서는 강사가 할 일이 가장 적은 길을 먼저(엔진 TEACHER_STEPS의 app: 시트 23·Supabase 12·내 서버 7번쯤, 그다음 연수부터는 0번).
  // 엔진의 클릭용 규칙(시트)은 skill 초안의 기본값이라 그대로 두고, 앱 화면에서만 내 서버(Cloudflare)를 첫째로
  const pref = [...new Set((prefer || []).map((x) => METHOD_OF[x]).filter((m) => m && m !== 'sheets'))];
  const appFirst = ['sheets', 'supabase'].includes(reco.backend) || pref[0] === 'http';
  const recoMethod = pref[0] || (appFirst ? 'http' : METHOD_OF[reco.backend] || 'sheets');
  const order = [...new Set([...pref, ...(recoMethod === 'http' ? ['http', 'sheets', 'supabase'] : ['sheets', 'supabase', 'http'])])];
  // 화면에는 방법 하나만: 처음에는 추천, 나머지는 접힌 '다른 방법으로 연결'에서 고르면 그 방법으로 바뀜
  const [method, setMethod] = useState(connected ? live.provider : recoMethod);
  const [others, setOthers] = useState(false);
  const wayH = useRef(null);
  const [newKey, setNewKey] = useState(() => randomKey(20)); // 관리자 키(앱이 만듦): ADMIN_KEY 칸에 넣거나, 해시만 설치 코드·설치 SQL에 실음
  const [keyHash, setKeyHash] = useState('');
  const usedKey = useRef(false); // 이번에 만든 키를 바깥에 넣었음(복사함) → 연결되면 그 주소의 관리자 키로 기억
  const hadPending = useRef(false); // 지난번에 복사해 둔 키를 이어 받음(화면을 새로 고침) → 그쪽이 이 키를 받는 것을 확인했을 때만 기억
  const [remembered, setRemembered] = useState(''); // 이 기기에 기억한 내 서버 주소
  // 코드를 복사한 뒤 화면을 새로 고쳐도 같은 키로 이어 가게: 연결 전 키를 이 기기에 둠(연결되면 그 주소의 키로 옮기고 지움)
  useEffect(() => { if (code) loadKey(pendingSlot(code)).then((r) => { if (r.key) { hadPending.current = true; setNewKey(r.key); } }, () => { }); }, []);
  useEffect(() => { let on = true; sha256Hex(newKey).then((h) => { if (on) setKeyHash(h); }); return () => { on = false; }; }, [newKey]);
  const markKeyUsed = () => { usedKey.current = true; if (code) saveKey(pendingSlot(code), newKey, true).catch(() => { }); };
  // 지난번에 연결한 내 서버가 있으면 확인만 하고 바로 씀(다음 연수부터 할 일 0)
  useEffect(() => {
    if (connected || (live.provider !== 'local' && live.provider !== 'none' && live.url)) return; // 강사가 고른 연결이 있으면(확인에 한 번 실패했어도) 바꾸지 않음
    rememberedServer().then((url) => { if (!url) return; setRemembered(url); setMethod('http'); test(false, url, 'http', true); });
  }, []);
  const copyKey = (msg) => { markKeyUsed(); copy(newKey, msg); };
  const [draft, setDraft] = useState({ url: live.provider === method ? live.url || '' : '', anonKey: live.anonKey || '' });
  const [state, setState] = useState({ busy: false, msg: '', ok: false });
  const [note, setNote] = useState(''); // 연결은 됐지만 알려 둘 것 한 줄(관리자 키가 이 기기의 것이 아님)
  const [at, setAt] = useState(0); // 지금 보고 있는 단계
  const [tick, setTick] = useState(0); // [다시 확인]을 누를 때마다 예전 설치인지도 다시 봄
  // 내 Cloudflare 계정에 한 번에: lecpage 커넥트가 켜져 있으면 로그인 한 번으로 서버를 만들고 바로 연결(주소·관리자 키를 옮겨 적지 않음)
  const { pc, way } = useCfWay();
  const cf = useRun();
  const [cfErr, setCfErr] = useState(null);
  function connectCf(rotate = false) {
    setCfErr(null);
    cf.run(async ({ onView, signal }) => {
      try {
        const r = await ensureRelay({ code, settings: liveSettings(bp), known: (u) => adminKeyFor(u, code), rotate, onView, signal });
        const next = { ...live, provider: 'http', url: r.url, anonKey: '' };
        await pingLive(next, code);
        update((cur) => ({ ...patchDeploy(cur, (b) => ({ ...b, live: { ...b.live, ...next } })), liveOk: true }));
        rememberServer(r.url, r.key, code); markCfUsed();
        setState({ busy: false, msg: '', ok: true });
        toast(r.created ? '내 Cloudflare 계정에 참여 기능 서버를 만들고 연결했어요.' : '내 Cloudflare 계정의 참여 기능 서버에 연결했어요.');
      } catch (e) { const f = cfFail(e, connectCf); if (f) setCfErr(f); else toast('멈췄어요.'); }
    });
  }
  async function test(again, url = draft.url, prov = method, quiet = false, anonKey = draft.anonKey) {
    setState({ busy: true, msg: '확인하는 중…', ok: false });
    const next = again ? { ...live } : { ...live, provider: prov, url: url.trim().replace(/\/+$/, ''), anonKey: prov === 'supabase' ? String(anonKey || '').trim() : '' };
    try {
      const msg = await pingLive(next, code);
      // 이 기기가 만든 키가 그쪽에 걸린 키인지: 구글 시트·Supabase는 물어보고 맞을 때만 기억(다른 키가 걸려 있으면 틀린 키를 보여 주지 않게).
      // 이번에 복사한 키는 확인하지 못해도 예전처럼 기억하고, 새로 고쳐 이어 받은 키는 그쪽이 받는다고 할 때만 기억
      const copied = usedKey.current; const pending = hadPending.current && !quiet;
      let mine = false; let other = false;
      if (!again && (copied || pending)) {
        if (next.provider === 'http') mine = copied || (await checkAdminKey(next.url, code, newKey, liveSettings(bp))) === 'ok';
        else { const st = await verifyAdmin(next, code, newKey); mine = st === 'ok' || (st === 'unknown' && copied); other = st === 'bad' && copied; }
      }
      update((cur) => ({ ...patchDeploy(cur, (b) => ({ ...b, live: { ...b.live, ...next } })), liveOk: true }));
      if (!again && next.provider === 'http') saveKey('live-server', next.url, true).catch(() => { });
      if (mine) { keepAdminKey(next.url, newKey, code); if (code) forgetKey(pendingSlot(code)).catch(() => { }); }
      if (next.provider === 'http') (mine ? Promise.resolve(newKey) : adminKeyFor(next.url, code)).then((k) => applyServerSettings(next.url, code, k, bp));
      if (!again) setNote(other ? `${NAME[next.provider]}에 먼저 정해 둔 관리자 키를 그대로 써요. 강사 화면에는 그 키로 들어가요.` : '');
      if (again) setTick((n) => n + 1);
      const done = quiet ? '지난번에 연결한 내 서버에 연결했어요.' : msg;
      setState({ busy: false, msg: done, ok: true }); toast(done);
    } catch (e) { if (again) update({ liveOk: false }); if (quiet) { setState({ busy: false, msg: '', ok: false }); return; } setState({ busy: false, msg: e.name === 'TimeoutError' ? '시간이 너무 걸려요. 주소를 확인하고 다시 눌러 주세요.' : e.message, ok: false }); }
  }
  function useLocal() { update((cur) => ({ ...patchDeploy(cur, (b) => ({ ...b, live: { ...b.live, provider: 'local', url: '', anonKey: '' } })), liveOk: false })); toast('이 컴퓨터에서만 시험하는 방식으로 바꿨어요.'); }
  function disconnect() { update((cur) => ({ ...patchDeploy(cur, (b) => ({ ...b, live: { ...b.live, provider: 'local', url: '', anonKey: '' } })), liveOk: false })); setState({ busy: false, msg: '', ok: false }); setNote(''); }
  function pick(v) {
    setMethod(v); setAt(0); setOthers(false); setState({ busy: false, msg: '', ok: false }); setDraft({ url: '', anonKey: '' });
    setTimeout(() => wayH.current?.focus(), 0); // 고른 버튼이 사라지므로 초점을 바뀐 방법의 제목으로(키보드·화면 읽기 프로그램)
  }
  const settings = liveSettings(bp);
  const rawGs = () => import('../../../skills/lecpage/backends/apps-script/Code.gs?raw').then((m) => m.default);
  const rawSql = () => import('../../../skills/lecpage/backends/supabase/schema.sql?raw').then((m) => m.default);
  // 고른 방법의 원문을 미리 받아 둠(누른 뒤 기다리는 시간이 길면 브라우저가 복사를 막을 수 있음)
  useEffect(() => { if (connected) return; if (method === 'sheets') rawGs().catch(() => { }); if (method === 'supabase') rawSql().catch(() => { }); }, [method, connected]);
  const installCode = async () => sheetInstallCode({ code, hash: keyHash || await sha256Hex(newKey), uploads: settings.uploads, moderation: settings.moderation, retentionDays: settings.retentionDays });
  /** 구글 시트 코드 복사: 이 연수의 설정(관리자 키 해시·연수 코드·파일 올리기·보관 기간)을 코드에 넣어, 시트에서 따로 넣을 것이 없게 */
  async function copySheetCode() {
    try {
      const text = withSheetInstall(await rawGs(), await installCode());
      if (!text) throw new Error('no slot');
      markKeyUsed(); copy(text, '코드를 복사했어요. Apps Script 편집기에 붙여 넣으세요.');
    } catch { toast('복사하지 못했어요. 다시 눌러 주세요.'); }
  }
  /** 시트 틀을 복사해 쓰는 길: 설치 코드 한 줄(시트 메뉴 lecpage → 한 번에 설치에 붙여 넣음) */
  async function copyInstallCode() {
    try { const c = await installCode(); markKeyUsed(); copy(c, '설치 코드를 복사했어요. 시트의 lecpage 메뉴에 붙여 넣으세요.'); } catch { toast('복사하지 못했어요. 다시 눌러 주세요.'); }
  }
  /** Supabase 설치 SQL 복사: 설치와 이 연수 등록을 한 번에(여러 번 실행해도 안전) */
  async function copyInstallSql() {
    try {
      const text = supabaseInstallSql(await rawSql(), code, keyHash || await sha256Hex(newKey), { ...settings, flushMs: supabaseFlushMs(bp) });
      markKeyUsed(); copy(text, '설치 SQL을 복사했어요. SQL Editor에 붙여 넣고 Run을 누르세요.');
    } catch { toast('복사하지 못했어요. 다시 눌러 주세요.'); }
  }
  /** 이미 연결한 곳을 새 버전으로: 설정은 건드리지 않게 원문만(관리자 키·연수 코드는 그대로) */
  async function copyUpgrade() {
    try {
      if (live.provider === 'sheets') copy(await rawGs(), '코드를 복사했어요. Apps Script 편집기에 붙여 넣으세요.');
      else copy(await rawSql(), '설치 SQL을 복사했어요. SQL Editor에 붙여 넣고 Run을 누르세요.');
    } catch { toast('복사하지 못했어요. 다시 눌러 주세요.'); }
  }
  /** Supabase에서 복사한 글(Connect 창의 주소·키, 따로따로 복사해도 됨)에서 주소와 publishable 키를 찾아 넣고, 둘 다 있으면 바로 확인 */
  function takeSupabase(text) {
    const f = parseSupabasePaste(text);
    if (!f.url && !f.key) { setState({ busy: false, ok: false, msg: f.secret ? 'secret 키는 넣지 않아요. Publishable key(sb_publishable_…)를 복사해 주세요.' : '복사한 글에 프로젝트 URL이나 Publishable key가 없어요. 복사한 뒤 다시 눌러 주세요.' }); return false; }
    const next = { url: f.url || draft.url, anonKey: f.key || draft.anonKey };
    setDraft(next);
    if (next.url && next.anonKey) test(false, next.url, 'supabase', false, next.anonKey);
    else setState({ busy: false, ok: false, soft: true, msg: next.url ? '주소를 넣었어요. Publishable key도 복사해 [붙여넣기]를 눌러 주세요.' : '키를 넣었어요. Project URL도 복사해 [붙여넣기]를 눌러 주세요.' });
    return true;
  }
  /** 복사한 것을 붙여 넣고 바로 연결 확인(구글 시트·내 서버는 주소 하나, Supabase는 주소와 키) */
  async function pasteUrl() {
    let text;
    try { text = (await navigator.clipboard.readText()).trim(); }
    catch { setState({ busy: false, msg: '입력 칸을 누르고 Ctrl+V(맥은 ⌘V)로 붙여 넣어 주세요.', ok: false }); return; }
    if (method === 'supabase') { takeSupabase(text); return; }
    if (!/^https?:\/\//.test(text)) { setState({ busy: false, msg: '복사한 주소가 없어요. 주소를 복사한 뒤 다시 눌러 주세요.', ok: false }); return; }
    setDraft((d) => ({ ...d, url: text }));
    test(false, text);
  }
  // Supabase 칸에 글 덩어리를 붙여 넣으면 주소·키를 찾아 제자리에(secret 키는 칸에 남기지 않음)
  const sbPaste = (e) => { const x = e.clipboardData?.getData('text') || ''; const f = parseSupabasePaste(x); if (f.secret || (f.url && f.key) || (f.key && e.target.type === 'url') || (f.url && e.target.type !== 'url')) { e.preventDefault(); takeSupabase(x); } };
  const sup = method === 'supabase';
  const need = sup ? !draft.url || !draft.anonKey : !draft.url;
  const urlLabel = method === 'sheets' ? '웹 앱 URL' : sup ? '프로젝트 URL' : '서버 URL';
  const urlHint = method === 'sheets' ? 'https://script.google.com/macros/s/…/exec' : sup ? 'https://xxxx.supabase.co' : 'https://lecpage-live.내계정.workers.dev';
  // 마지막 단계: 주소(와 키) 넣고 연결 확인
  const finish = (
    <>
      <div class="form-grid">
        <Field label={urlLabel} hint={urlHint}>
          <input type="url" value={draft.url} onInput={(e) => setDraft({ ...draft, url: e.target.value })} onPaste={sup ? sbPaste : undefined} placeholder="https://" autoComplete="off" spellcheck={false} />
        </Field>
        {sup && <Field label="publishable 키"><input value={draft.anonKey} onPaste={sbPaste} placeholder="sb_publishable_…" autoComplete="off" spellcheck={false}
          onInput={(e) => { const v = e.target.value; if (isSupabaseSecret(v)) { setDraft({ ...draft, anonKey: '' }); setState({ busy: false, ok: false, msg: 'secret 키는 넣지 않아요. Publishable key(sb_publishable_…)를 복사해 주세요.' }); } else setDraft({ ...draft, anonKey: v }); }} /></Field>}
      </div>
      <div class="btn-row">
        {need && <button class="btn btn-primary" disabled={state.busy} aria-busy={state.busy ? 'true' : undefined} onClick={pasteUrl}>{state.busy ? '확인하는 중…' : '붙여넣기'}</button>}
        {!need && <button class="btn btn-primary" disabled={state.busy} aria-busy={state.busy ? 'true' : undefined} onClick={() => test(false)}>{state.busy ? '확인하는 중…' : '연결 확인'}</button>}
      </div>
      {state.msg && !state.busy && <Notice kind={state.ok ? 'ok' : state.soft ? 'lav' : 'bad'}>{state.msg}</Notice>}
    </>
  );
  // 구글 화면의 권한 창(내가 붙여 넣은 코드라서 나옴): 누르는 순서
  const allow = <>권한을 묻는 창이 뜨면 <b>액세스 승인(또는 권한 검토) → 내 계정 → 고급 → (안전하지 않음)으로 이동 → 허용</b> 순서로 눌러요. 내가 넣은 코드라서 나오는 안내예요.</>;
  const sheetDeploy = (open) => ({ t: '웹 앱으로 배포하기', body: <>
    <p>{open}오른쪽 위 <b>배포 → 새 배포</b>를 누르고, 톱니바퀴에서 <b>웹 앱</b>을 골라요. 아래처럼 맞추고 <b>배포</b>를 눌러요.</p>
    {/* copy-ok: 구글 화면의 칸 이름 그대로(바꾸면 화면에서 못 찾음) */}
    <ClickShot rows={[['다음 사용자 인증 정보로 실행', '나'], ['액세스 권한이 있는 사용자', '모든 사용자']]} btn="배포" />
    <p>{allow} 끝나면 나오는 <b>웹 앱 URL</b>을 복사해요.</p>
  </> });
  const STEPS = {
    sheets: SHEET_TEMPLATE ? [
      { t: '시트 사본 만들기', body: <p><a class="btn btn-sm btn-primary" href={SHEET_TEMPLATE} target="_blank" rel="noopener" onClick={() => setAt(1)}>시트 사본 만들기</a> 코드가 들어 있는 시트가 내 드라이브에 복사돼요.</p> },
      { t: '설치 코드 넣기', body: <>
        <p><button class="btn btn-sm btn-primary" onClick={copyInstallCode}>설치 코드 복사</button> 복사한 시트의 메뉴 <b>lecpage → 한 번에 설치</b>를 누르고 붙여 넣어요.</p>
        <p class="small">{allow} 그다음 메뉴를 한 번 더 눌러 붙여 넣어요.</p>
        <details class="run-alt"><summary class="small">메뉴에 '한 번에 설치'가 없으면</summary><div class="run-alt-body"><p class="small">메뉴 <b>확장 프로그램 → Apps Script</b>를 열어요. 편집기의 글을 모두 지우고 <button class="btn btn-sm" onClick={copySheetCode}>lecpage 코드 복사</button>를 눌러 붙여 넣은 뒤 <b>저장</b> 아이콘을 눌러요. 설치 코드는 넣지 않아도 돼요.</p></div></details>
      </> },
      sheetDeploy(<>시트 메뉴 <b>확장 프로그램 → Apps Script</b>를 열어요. </>),
      { t: '웹 앱 URL 붙여넣기', body: finish },
    ] : [
      { t: '새 시트 만들기', body: <p><a class="btn btn-sm btn-primary" href="https://sheets.new" target="_blank" rel="noopener" onClick={() => setAt(1)}>새 구글 시트 열기</a> 이름을 "○○ 연수 참여"처럼 바꿔요.</p> },
      { t: '코드 붙여 넣기', body: <>
        <p>시트 메뉴 <b>확장 프로그램 → Apps Script</b>를 열어요. 편집기의 글을 모두 지우고 <button class="btn btn-sm btn-primary" onClick={copySheetCode}>lecpage 코드 복사</button>를 눌러 붙여 넣은 뒤 <b>저장</b> 아이콘을 눌러요.</p>
        <p class="small muted">코드에 이 연수의 설정(연수 코드 <span class="mono">{code}</span>)이 들어 있어 시트에서 따로 넣을 것이 없어요. 관리자 키는 이 기기가 기억해 두었다가 배포 완료 화면에 보여 줘요.</p>
      </> },
      sheetDeploy(<>Apps Script </>),
      { t: '웹 앱 URL 붙여넣기', body: finish },
    ],
    supabase: [
      { t: '프로젝트 만들기', body: <p><a class="btn btn-sm btn-primary" href={SB_NEW} target="_blank" rel="noopener" onClick={() => setAt(1)}>Supabase 열기</a> <b>New project</b>를 만들고, 지역은 <b>Northeast Asia (Seoul)</b>로 골라요.</p> },
      { t: '설치 SQL 실행하기', body: <>
        <p><button class="btn btn-sm btn-primary" onClick={copyInstallSql}>설치 SQL 복사</button> <a class="btn btn-sm" href={SB_SQL} target="_blank" rel="noopener">SQL Editor 열기</a> 붙여 넣고 <b>Run</b>을 눌러요.</p>
        <p class="small muted">이 연수의 등록까지 들어 있어 한 번만 실행하면 돼요. 관리자 키는 이 기기가 기억해 두었다가 배포 완료 화면에 보여 줘요.</p>
      </> },
      { t: '주소와 키 붙여넣기', body: <>
        <p><a class="btn btn-sm" href={SB_CONNECT} target="_blank" rel="noopener">Connect 창 열기</a> <b>Project URL</b>과 <b>Publishable key</b>를 복사해 와 <b>[붙여넣기]</b>를 눌러요. 둘이 함께 든 글을 통째로 복사해도 돼요.</p>
        {finish}
      </> },
    ],
    http: [
      { t: '내 서버 만들기', body: <>
        <p><a class="btn btn-sm btn-primary" href={CF_DEPLOY} target="_blank" rel="noopener" onClick={() => { copyKey('관리자 키를 복사했어요. ADMIN_KEY 칸에 붙여 넣으세요.'); setAt(1); }}>Cloudflare 열기</a> 누르면 관리자 키가 복사돼요.</p>
        <p>Cloudflare에 로그인(무료 가입)하고 <b>GitHub 연결을 허락</b>해요. <b>ADMIN_KEY</b> 칸에 붙여 넣고 <b>Deploy</b>를 눌러요. 나온 주소(…workers.dev)를 복사해 돌아와요.</p>
        <p class="small muted">한 번 만들면 다음 연수부터는 이 기기에서 저절로 연결돼요. 기관 서버·NAS·노트북은 <a href={`${REPO}/backends/node-server`} target="_blank" rel="noopener">Node 서버 안내</a>를 보세요.</p>
      </> },
      { t: '서버 URL 붙여넣기', body: finish },
    ],
  };
  const steps = STEPS[method];
  const B = E.BACKENDS[method === 'http' ? 'cloudflare' : method];
  // 여러 날 연수인데 이미 연결한 구글 시트·Supabase가 날짜별 출석을 모르는 예전 설치면 한 번 바꾸라고 알려 줌(필요한 사람에게만)
  const multi = new Set([bp.meta?.date, ...(bp.meta?.sessions || []).map((x) => x?.date)].filter(Boolean)).size >= 2;
  const [oldInstall, setOldInstall] = useState(false);
  useEffect(() => {
    let on = true;
    if (connected && multi && (live.provider === 'sheets' || live.provider === 'supabase')) daysReady(live).then((ok) => { if (on) setOldInstall(ok === false); });
    else setOldInstall(false);
    return () => { on = false; };
  }, [connected, multi, live.provider, live.url, tick]);
  return (
    <div class="stack">
      {connected ? (
        <Notice kind="ok"><div class="stack" style={{ gap: '6px', flex: 1 }}><b>{NAME[live.provider]}에 연결돼 있어요.</b><span class="small mono" style={{ wordBreak: 'break-all' }}>{live.url}</span>{note && <span class="small">{note}</span>}<div class="btn-row"><button class="btn btn-sm" disabled={state.busy} aria-busy={state.busy ? 'true' : undefined} onClick={() => test(true)}>{state.busy ? '확인하는 중…' : '다시 확인'}</button><button class="btn btn-sm btn-quiet" onClick={disconnect}>연결 바꾸기</button></div></div></Notice>
      ) : method !== recoMethod ? (
        <p class="live-way-h" tabIndex={-1} ref={wayH}><b>{NAME[method]}로 연결</b> · {NEED[method]}</p>
      ) : (
        <Notice kind="lav"><span tabIndex={-1} ref={wayH} class="live-way-reco">{method === 'http'
          ? (way === 'ready'
            ? <><b>추천: 내 서버(Cloudflare)</b> · 로그인 한 번으로 만들어요. 다음 연수부터는 저절로 연결돼요.</>
            : <><b>추천: 내 서버(Cloudflare)</b> · 할 일이 가장 적어요. 처음 한 번만 만들면 다음 연수부터는 저절로 연결돼요.</>)
          : <><b>추천: {NAME[method]}</b> · {pref[0] === method ? NEED[method] : reco.reasons[0]}</>}</span></Notice>
      )}
      {connected && state.msg && !state.ok && <Notice kind="bad">{state.msg}</Notice>}
      {connected && oldInstall && (
        <div class="live-note" role="note">
          <b>여러 날 연수예요. {live.provider === 'sheets' ? '시트의 코드를' : '설치 SQL을'} 한 번 새로 넣어 주세요</b>
          <p class="small">{live.provider === 'sheets'
            ? <>복사한 코드를 Apps Script에 붙여 넣고 저장한 뒤 <b>배포 → 배포 관리 → 연필 → 버전: 새 버전 → 배포</b>를 눌러요. 주소와 기록은 그대로예요.</>
            : <>복사한 SQL을 SQL Editor에 붙여 넣고 <b>Run</b>을 눌러요. 쌓인 기록은 그대로예요.</>} 그대로 두면 여러 날에 걸쳐 온 참가자가 이수자 명단에 '확인 필요'로 나와요.</p>
          <div class="btn-row">
            <button type="button" class="btn btn-sm btn-primary" onClick={copyUpgrade}>{live.provider === 'sheets' ? '새 코드 복사' : '설치 SQL 복사'}</button>
            {live.provider === 'supabase' && <a class="btn btn-sm" href={SB_SQL} target="_blank" rel="noopener">SQL Editor 열기</a>}
          </div>
        </div>
      )}
      {!connected && <>
        {B?.atLimit_ko && <p class="small muted">{B.atLimit_ko}</p>}
        {method === 'http' && way === 'ready'
          ? <OneClickCard
            note={<p class="small">버튼을 누르면 내 Cloudflare 계정에 참여 기능 서버를 만들고 바로 연결해요. 처음 한 번만 브라우저에서 Cloudflare에 로그인(무료 가입)하고 [Allow]를 눌러요.</p>}
            go={{ label: 'Cloudflare 계정으로 연결', on: cf.busy, busy: cf.busy, onLabel: '연결하는 중…', onClick: () => connectCf() }}
            progress={<CfProgress view={cf.view} onCancel={cf.cancel} />}
            fail={cfErr && (cfErr.kind === 'old' ? <ConnectUpdate pc={pc} /> : <RunFail fail={cfErr} onClose={() => setCfErr(null)} />)}
            alt={{ label: '직접 만들기', body: <Steps steps={steps} at={Math.min(at, steps.length - 1)} onAt={setAt} label={`${NAME[method]} 연결 순서`} /> }} />
          : <>
            {method === 'http' && way === 'old' && <CfGetConnect pc={pc} way={way} />}
            <Steps steps={steps} at={Math.min(at, steps.length - 1)} onAt={setAt} label={`${NAME[method]} 연결 순서`} />
            {method === 'http' && (way === 'none' || way === 'off') && <details class="run-alt"><summary class="small">더 쉬운 방법: 로그인 한 번으로 연결</summary><div class="run-alt-body"><CfGetConnect pc={pc} way={way} what="참여 기능 서버가 만들어지고 바로 연결돼요" /></div></details>}
          </>}
        <details class="run-alt live-others" open={others} onToggle={(e) => setOthers(e.currentTarget.open)}>
          <summary class="small">다른 방법으로 연결</summary>
          <div class="run-alt-body stack" style={{ gap: '6px' }} role="group" aria-label="다른 연결 방법">
            {order.filter((v) => v !== method).map((v) => (
              <button type="button" class="btn btn-sm run-pick live-pick" key={v} data-method={v} onClick={() => pick(v)}>
                <span><b>{NAME[v]}</b>{v === recoMethod ? ' (추천)' : ''}</span><span class="small muted">{NEED[v]}</span>
              </button>
            ))}
            <button type="button" class="btn btn-sm run-pick live-pick" data-method="local" onClick={useLocal}>
              <span><b>이 컴퓨터에서 테스트</b></span><span class="small muted">연결 없이 한 브라우저 안에서만 시험해요.</span>
            </button>
          </div>
        </details>
      </>}
      <p class="small muted">연수 코드 <span class="mono">{code}</span> · 기록은 강사님 계정에만 쌓이고 lecpage 운영자는 볼 수 없어요. 연수가 끝나면 강사 화면에서 내려받고 지워 주세요.</p>
    </div>
  );
}
