import { useState } from 'preact/hooks';
import { Field, Notice, Seg } from './ui.jsx';
import { Steps } from './Steps.jsx';
import { E } from '../lib/engine.js';
import { copy, randomKey, sha256Hex, toast } from '../lib/util.js';

const REPO = 'https://github.com/yoorrard/lecpage/tree/main/skills/lecpage';
const CF_DEPLOY = 'https://deploy.workers.cloudflare.com/?url=https://github.com/yoorrard/lecpage/tree/main/skills/lecpage/backends/cloudflare';
// 운영자가 코드가 든 시트 틀을 공유해 두면(빌드 변수 VITE_SHEET_TEMPLATE, …/copy 주소) 코드 붙여넣기 단계가 사라짐
const SHEET_TEMPLATE = /^https:\/\/docs\.google\.com\/spreadsheets\//.test(import.meta.env?.VITE_SHEET_TEMPLATE || '') ? import.meta.env.VITE_SHEET_TEMPLATE : '';
const NAME = { sheets: '구글 시트', supabase: 'Supabase', http: '내 서버·Cloudflare', local: '이 컴퓨터에서만(시험)' };
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
    return '구글 시트와 연결했어요.';
  }
  if (live.provider === 'supabase') {
    if (!live.anonKey) throw new Error('publishable 키를 넣어 주세요.');
    const r = await fetch(url + '/rest/v1/rpc/lec_snapshot', { method: 'POST', signal: t, headers: { apikey: live.anonKey, authorization: 'Bearer ' + live.anonKey, 'content-type': 'application/json', 'x-lec-code': code }, body: JSON.stringify({ p_code: code, p_since: 9007199254740991 }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) return 'Supabase와 연결했어요.';
    if (/unknown_training|404/.test(JSON.stringify(j))) throw new Error('연수가 아직 등록되지 않았어요. 아래 3번의 SQL 한 줄을 실행해 주세요.');
    if (r.status === 404) throw new Error('schema.sql을 아직 실행하지 않은 것 같아요(2번).');
    throw new Error(j.message || `Supabase 오류 ${r.status}`);
  }
  const r = await fetch(url + '/api/health', { signal: t }); const j = await r.json().catch(() => null);
  if (!j || j.ok !== true) throw new Error('서버가 답하지 않아요. 주소와 서버가 켜져 있는지 확인해 주세요.');
  return '서버와 연결했어요.';
}

/** 서버에 걸어 둘 연수 설정: 보관 기간·파일 올리기·사전 검토 */
export function liveSettings(bp) {
  const board = (bp.sections || []).find((x) => x.type === 'board');
  return { retentionDays: bp.privacy?.retentionDays || 30, uploads: !!board && board.allowFiles !== false && !bp.audience?.minor, moderation: !!board?.moderation };
}
/** Supabase 연수 등록 SQL: 보관 기간·파일 올리기·사전 검토를 서버에도 똑같이 걸어 둠 */
function initSql(code, hash, bp) {
  const settings = liveSettings(bp);
  return `select lec_private.init_training_hash('${code}', '${hash}', '${JSON.stringify(settings)}');`;
}

export function LiveSetup({ p, update }) {
  const bp = p.blueprint; const live = bp.live || {}; const info = p.info;
  const code = E.validate(bp).blueprint.live.code;
  const reco = E.decideInfra({ size: info.size, features: info.features, skill: 'click', network: info.network, minor: info.minor, commercial: info.commercial });
  const connected = ['sheets', 'supabase', 'http'].includes(live.provider) && live.url && p.liveOk;
  const [method, setMethod] = useState(connected ? live.provider : METHOD_OF[reco.backend] || 'sheets');
  const [draft, setDraft] = useState({ url: live.provider === method ? live.url || '' : '', anonKey: live.anonKey || '' });
  const [state, setState] = useState({ busy: false, msg: '', ok: false });
  const [adm, setAdm] = useState(null);
  const [at, setAt] = useState(0); // 지금 보고 있는 단계
  async function test(again, url = draft.url) {
    setState({ busy: true, msg: '확인하는 중…', ok: false });
    const next = again ? { ...live } : { ...live, provider: method, url: url.trim(), anonKey: method === 'supabase' ? draft.anonKey.trim() : '' };
    try {
      const msg = await pingLive(next, code);
      update((cur) => ({ blueprint: { ...cur.blueprint, live: { ...cur.blueprint.live, ...next } }, liveOk: true }));
      setState({ busy: false, msg, ok: true }); toast(msg);
    } catch (e) { if (again) update({ liveOk: false }); setState({ busy: false, msg: e.name === 'TimeoutError' ? '시간이 너무 걸려요. 주소를 확인하고 다시 눌러 주세요.' : e.message, ok: false }); }
  }
  function useLocal() { update((cur) => ({ blueprint: { ...cur.blueprint, live: { ...cur.blueprint.live, provider: 'local', url: '', anonKey: '' } }, liveOk: false })); toast('이 컴퓨터에서만 시험하는 방식으로 바꿨어요.'); }
  function disconnect() { update((cur) => ({ blueprint: { ...cur.blueprint, live: { ...cur.blueprint.live, provider: 'local', url: '', anonKey: '' } }, liveOk: false })); setState({ busy: false, msg: '', ok: false }); }
  async function makeAdmin() { const k = randomKey(20); setAdm({ key: k, hash: await sha256Hex(k) }); }
  async function copyRaw(kind) {
    const m = kind === 'gs' ? await import('../../../skills/lecpage/backends/apps-script/Code.gs?raw') : await import('../../../skills/lecpage/backends/supabase/schema.sql?raw');
    copy(m.default, kind === 'gs' ? '코드를 복사했어요. Apps Script 편집기에 붙여 넣으세요.' : 'SQL을 복사했어요. SQL Editor에 붙여 넣으세요.');
  }
  /** 복사한 주소를 붙여 넣고 바로 연결 확인(구글 시트·내 서버는 주소 하나면 됨) */
  async function pasteUrl() {
    let text;
    try { text = (await navigator.clipboard.readText()).trim(); }
    catch { setState({ busy: false, msg: '입력 칸을 누르고 Ctrl+V(맥은 ⌘V)로 붙여 넣어 주세요.', ok: false }); return; }
    if (!/^https?:\/\//.test(text)) { setState({ busy: false, msg: '복사한 주소가 없어요. 주소를 복사한 뒤 다시 눌러 주세요.', ok: false }); return; }
    setDraft((d) => ({ ...d, url: text }));
    if (method !== 'supabase') test(false, text);
  }
  const settings = liveSettings(bp);
  const urlLabel = method === 'sheets' ? '웹 앱 URL' : method === 'supabase' ? '프로젝트 URL' : '서버 URL';
  const urlHint = method === 'sheets' ? 'https://script.google.com/macros/s/…/exec' : method === 'supabase' ? 'https://xxxx.supabase.co' : 'https://lecpage-live.내계정.workers.dev';
  // 마지막 단계: 주소(와 키) 넣고 연결 확인
  const finish = (
    <>
      <div class="form-grid">
        <Field label={urlLabel} hint={urlHint}>
          <input type="url" value={draft.url} onInput={(e) => setDraft({ ...draft, url: e.target.value })} placeholder="https://" autoComplete="off" spellcheck={false} />
        </Field>
        {method === 'supabase' && <Field label="publishable 키"><input value={draft.anonKey} onInput={(e) => setDraft({ ...draft, anonKey: e.target.value })} placeholder="sb_publishable_…" autoComplete="off" spellcheck={false} /></Field>}
      </div>
      <div class="btn-row">
        {method !== 'supabase' && !draft.url && <button class="btn btn-primary" disabled={state.busy} aria-busy={state.busy ? 'true' : undefined} onClick={pasteUrl}>{state.busy ? '확인하는 중…' : '붙여넣기'}</button>}
        {(method === 'supabase' || draft.url) && <button class="btn btn-primary" disabled={!draft.url || state.busy} aria-busy={state.busy ? 'true' : undefined} onClick={() => test(false)}>{state.busy ? '확인하는 중…' : '연결 확인'}</button>}
      </div>
      {state.msg && !state.busy && <Notice kind={state.ok ? 'ok' : 'bad'}>{state.msg}</Notice>}
    </>
  );
  const STEPS = {
    sheets: [
      SHEET_TEMPLATE
        ? { t: '시트 사본 만들기', body: <p><a class="btn btn-sm btn-primary" href={SHEET_TEMPLATE} target="_blank" rel="noopener" onClick={() => setAt(1)}>시트 사본 만들기</a> 코드가 들어 있는 시트가 내 드라이브에 복사돼요.</p> }
        : { t: '새 시트 만들기', body: <p><a class="btn btn-sm btn-primary" href="https://sheets.new" target="_blank" rel="noopener" onClick={() => setAt(1)}>새 구글 시트 열기</a> 이름을 "○○ 연수 참여"처럼 바꿔요.</p> },
      SHEET_TEMPLATE
        ? { t: 'Apps Script 열기', body: <p>복사된 시트의 메뉴 <b>확장 프로그램 → Apps Script</b>를 열어요.</p> }
        : { t: '코드 붙여 넣기', body: <p>시트 메뉴 <b>확장 프로그램 → Apps Script</b>를 열어요. 편집기의 글을 모두 지우고 <button class="btn btn-sm btn-primary" onClick={() => copyRaw('gs')}>lecpage 코드 복사</button>를 눌러 붙여 넣은 뒤 <b>저장</b> 아이콘을 눌러요.</p> },
      { t: 'setup 실행하기', body: <p>위쪽 함수 목록에서 <b>setup</b>을 고르고 <b>실행</b>을 눌러요. "승인 필요"가 뜨면 <b>권한 검토 → 내 계정 → 고급 → (안전하지 않음)으로 이동</b>을 눌러요. 권한을 모두 골라 <b>계속</b>(또는 <b>허용</b>)을 눌러요. 내가 붙여 넣은 코드라서 나오는 안내예요.</p> },
      { t: '관리자 키와 연수 코드 넣기',
        body: <>
          <p>시트로 돌아와 새로 고쳐요. 메뉴 <b>lecpage → 2. 관리자 키 정하기</b>에서 12자 이상으로 정하고 적어 두세요.</p>
          <p><b>lecpage → 연수 코드 고정하기</b>에는 <span class="mono">{code}</span> <button class="btn btn-sm" onClick={() => copy(code, '연수 코드를 복사했어요.')}>복사</button>를 넣어요.</p>
          {settings.uploads && <p>보드에 사진·파일을 받으려면 <b>lecpage → 파일 올리기 켜기/끄기</b>를 한 번 눌러 켜요.</p>}
        </> },
      { t: '웹 앱으로 배포하기', body: <p>Apps Script 오른쪽 위 <b>배포 → 새 배포 → 웹 앱</b>을 골라요. 실행은 <b>나</b>, 액세스 권한은 <b>모든 사용자</b>로 두고 <b>배포</b>를 누른 뒤 나온 <b>웹 앱 URL</b>을 복사해요.</p> },
      { t: '웹 앱 URL 붙여넣기', body: finish },
    ],
    supabase: [
      { t: '프로젝트 만들기', body: <p><a class="btn btn-sm btn-primary" href="https://supabase.com/dashboard/new" target="_blank" rel="noopener" onClick={() => setAt(1)}>Supabase 열기</a> <b>New project</b>를 만들고, 지역은 <b>Northeast Asia (Seoul)</b>로 골라요.</p> },
      { t: '설치 SQL 실행하기', body: <p>왼쪽 <b>SQL Editor → New query</b>에 <button class="btn btn-sm btn-primary" onClick={() => copyRaw('sql')}>설치 SQL 복사</button>를 눌러 붙여 넣고 <b>Run</b>을 눌러요.</p> },
      { t: '관리자 키 만들고 연수 등록하기',
        body: <>
          <p>관리자 키를 만들면 SQL 한 줄이 나와요. 같은 곳에 붙여 넣고 <b>Run</b>을 눌러요.</p>
          {!adm ? <div><button class="btn btn-sm btn-primary" onClick={makeAdmin}>관리자 키 만들기</button></div> : <div class="stack" style={{ gap: '6px' }}>
            <div class="keybox">{adm.key}</div><div class="btn-row"><button class="btn btn-sm" onClick={() => copy(adm.key, '관리자 키를 복사했어요. 안전한 곳에 적어 두세요.')}>키 복사</button><span class="small muted">강사 화면에 들어갈 때 써요. 적어 두세요.</span></div>
            <div class="prompt-box">{initSql(code, adm.hash, bp)}</div>
            <div><button class="btn btn-sm btn-primary" onClick={() => copy(initSql(code, adm.hash, bp), 'SQL 한 줄을 복사했어요.')}>SQL 한 줄 복사</button></div></div>}
        </> },
      { t: '주소와 키 붙여넣기', body: <><p><b>Project Settings → API Keys</b>를 열어요. 프로젝트 URL과 <b>publishable 키</b>(sb_publishable_…)를 복사해 넣어요. secret 키는 넣지 마세요.</p>{finish}</> },
    ],
    http: [
      { t: '내 서버 만들기', body: <>
        <p><a class="btn btn-sm btn-primary" href={CF_DEPLOY} target="_blank" rel="noopener" onClick={() => setAt(1)}>Cloudflare 열기</a> Cloudflare 무료 계정으로 버튼 하나면 서버가 생겨요. 배포할 때 넣는 <b>ADMIN_KEY</b>가 관리자 키예요.</p>
        <p class="small muted">학교 서버·NAS·노트북은 <a href={`${REPO}/backends/node-server`} target="_blank" rel="noopener">Node 서버 안내</a>를 보세요.</p>
      </> },
      { t: '서버 URL 붙여넣기', body: finish },
    ],
  };
  const steps = STEPS[method];
  const B = E.BACKENDS[method === 'http' ? 'cloudflare' : method];
  return (
    <div class="stack">
      {connected ? (
        <Notice kind="ok"><div class="stack" style={{ gap: '6px', flex: 1 }}><b>{NAME[live.provider]}에 연결돼 있어요.</b><span class="small mono" style={{ wordBreak: 'break-all' }}>{live.url}</span><div class="btn-row"><button class="btn btn-sm" disabled={state.busy} aria-busy={state.busy ? 'true' : undefined} onClick={() => test(true)}>{state.busy ? '확인하는 중…' : '다시 확인'}</button><button class="btn btn-sm btn-quiet" onClick={disconnect}>연결 바꾸기</button></div></div></Notice>
      ) : (
        <Notice kind="lav"><span><b>추천: {reco.backendInfo.name_ko}</b> · {reco.reasons[0]}</span></Notice>
      )}
      {connected && state.msg && !state.ok && <Notice kind="bad">{state.msg}</Notice>}
      {!connected && <>
        <Seg label="연결 방법" value={method} onChange={(v) => { setMethod(v); setAt(0); setState({ busy: false, msg: '', ok: false }); setDraft({ url: '', anonKey: '' }); }} options={[{ value: 'sheets', label: '구글 시트' }, { value: 'supabase', label: 'Supabase' }, { value: 'http', label: '내 서버·Cloudflare' }]} />
        {B?.atLimit_ko && <p class="small muted">{B.atLimit_ko}</p>}
        <Steps steps={steps} at={Math.min(at, steps.length - 1)} onAt={setAt} label={`${NAME[method]} 연결 순서`} />
        <div class="btn-row"><button class="btn btn-sm btn-quiet" onClick={useLocal}>이 컴퓨터에서만 시험하기</button></div>
      </>}
      <p class="small muted">연수 코드 <span class="mono">{code}</span> · 기록은 강사님 계정에만 쌓이고 lecpage 운영자는 볼 수 없어요. 연수가 끝나면 강사 화면에서 내려받고 지워 주세요.</p>
    </div>
  );
}
