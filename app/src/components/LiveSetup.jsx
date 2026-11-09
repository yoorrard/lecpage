import { useState } from 'preact/hooks';
import { Field, Notice, Seg } from './ui.jsx';
import { Mascot } from './Mascot.jsx';
import { E } from '../lib/engine.js';
import { copy, randomKey, sha256Hex, toast } from '../lib/util.js';

const REPO = 'https://github.com/yoorrard/lecpage/tree/main/skills/lecpage';
const CF_DEPLOY = 'https://deploy.workers.cloudflare.com/?url=https://github.com/yoorrard/lecpage/tree/main/skills/lecpage/backends/cloudflare';
const NAME = { sheets: '구글 시트', supabase: 'Supabase', http: '내 서버·Cloudflare', local: '이 컴퓨터에서만(시험)' };
const METHOD_OF = { sheets: 'sheets', supabase: 'supabase', cloudflare: 'http', server: 'http', lan: 'http', none: 'sheets', local: 'sheets' };

/** 실시간 서버에 실제로 닿는지 확인(연결 확인 단추) */
export async function pingLive(live, code) {
  const url = String(live.url || '').trim().replace(/\/+$/, '');
  if (!/^https:\/\//.test(url) && !/^http:\/\/(localhost|127\.0\.0\.1|192\.168\.|10\.)/.test(url)) throw new Error('https:// 로 시작하는 주소를 넣어 주세요.');
  const t = AbortSignal.timeout ? AbortSignal.timeout(12000) : undefined;
  if (live.provider === 'sheets') {
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url)) throw new Error('웹 앱 주소는 https://script.google.com/macros/s/…/exec 모양이에요. 배포 → 배포 관리에서 "웹 앱 URL"을 복사해 주세요.');
    const r = await fetch(url + '?a=ping', { signal: t }); const j = await r.json().catch(() => null);
    if (!j || j.ok !== true) throw new Error('시트가 답하지 않아요. 배포할 때 "액세스 권한: 모든 사용자"로 골랐는지 확인해 주세요.');
    return '구글 시트와 연결됐어요.';
  }
  if (live.provider === 'supabase') {
    if (!live.anonKey) throw new Error('publishable(공개) 키를 넣어 주세요.');
    const r = await fetch(url + '/rest/v1/rpc/lec_snapshot', { method: 'POST', signal: t, headers: { apikey: live.anonKey, authorization: 'Bearer ' + live.anonKey, 'content-type': 'application/json', 'x-lec-code': code }, body: JSON.stringify({ p_code: code, p_since: 9007199254740991 }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) return 'Supabase와 연결됐어요.';
    if (/unknown_training|404/.test(JSON.stringify(j))) throw new Error('연수가 아직 등록되지 않았어요. 아래 3번의 SQL 한 줄을 실행해 주세요.');
    if (r.status === 404) throw new Error('schema.sql을 아직 실행하지 않은 것 같아요(2번).');
    throw new Error(j.message || `Supabase 오류 ${r.status}`);
  }
  const r = await fetch(url + '/api/health', { signal: t }); const j = await r.json().catch(() => null);
  if (!j || j.ok !== true) throw new Error('서버가 답하지 않아요. 주소와 서버가 켜져 있는지 확인해 주세요.');
  return '서버와 연결됐어요.';
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
  async function test(again) {
    setState({ busy: true, msg: '확인하는 중…', ok: false });
    const next = again ? { ...live } : { ...live, provider: method, url: draft.url.trim(), anonKey: method === 'supabase' ? draft.anonKey.trim() : '' };
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
  return (
    <div class="stack">
      {connected ? (
        <Notice kind="ok"><Mascot size={36} mood="happy" /><div class="stack" style={{ gap: '6px', flex: 1 }}><b>{NAME[live.provider]}에 연결돼 있어요.</b><span class="small mono" style={{ wordBreak: 'break-all' }}>{live.url}</span><div class="btn-row"><button class="btn btn-sm" disabled={state.busy} onClick={() => test(true)}>{state.busy ? '확인하는 중…' : '다시 확인'}</button><button class="btn btn-sm btn-quiet" onClick={disconnect}>연결 바꾸기</button></div></div></Notice>
      ) : (
        <Notice kind="lav"><span><b>추천: {reco.backendInfo.name_ko}</b> · {reco.reasons[0]}</span></Notice>
      )}
      {connected && state.msg && !state.ok && <Notice kind="bad">{state.msg}</Notice>}
      {!connected && <>
        <Seg label="연결 방법" value={method} onChange={(v) => { setMethod(v); setState({ busy: false, msg: '', ok: false }); setDraft({ url: '', anonKey: '' }); }} options={[{ value: 'sheets', label: '구글 시트' }, { value: 'supabase', label: 'Supabase' }, { value: 'http', label: '내 서버·Cloudflare' }]} />
        {method === 'sheets' && (
          <ol class="how">
            <li><a class="btn btn-sm" href="https://sheets.new" target="_blank" rel="noopener">새 구글 시트 열기</a> 이름을 "○○ 연수 참여"처럼 바꿔요.</li>
            <li>시트 메뉴 <b>확장 프로그램 → Apps Script</b>를 누르고, 편집기의 글을 모두 지운 뒤 <button class="btn btn-sm btn-primary" onClick={() => copyRaw('gs')}>lecpage 코드 복사</button>를 눌러 붙여 넣고 <b>저장(💾)</b>해요.</li>
            <li>위쪽 함수 칸에서 <b>setup</b>을 고르고 <b>실행</b>. "승인 필요"가 뜨면 <b>권한 검토 → 내 계정 → 고급 → (안전하지 않음)으로 이동 → 허용</b>. 내가 붙여 넣은 내 코드라서 나오는 안내예요.</li>
            <li>시트로 돌아와 새로 고침 → 메뉴 <b>lecpage → 2. 관리자 키 정하기</b>. 강사 화면 비밀번호예요(8자 이상, 적어 두세요). <b>lecpage → 연수 코드 고정하기</b>에는 <span class="mono">{code}</span> <button class="btn btn-sm btn-quiet" onClick={() => copy(code, '연수 코드를 복사했어요.')}>복사</button>를 넣어요.</li>
            <li>Apps Script 오른쪽 위 <b>배포 → 새 배포 → 웹 앱</b>. 실행: <b>나</b>, 액세스: <b>모든 사용자</b> → 배포. 나온 <b>웹 앱 URL</b>을 아래에 붙여 넣어요.</li>
          </ol>
        )}
        {method === 'supabase' && (
          <ol class="how">
            <li><a class="btn btn-sm" href="https://supabase.com/dashboard/new" target="_blank" rel="noopener">Supabase 새 프로젝트</a> 지역은 <b>Northeast Asia (Seoul)</b>.</li>
            <li>왼쪽 <b>SQL Editor → New query</b>에 <button class="btn btn-sm btn-primary" onClick={() => copyRaw('sql')}>설치 SQL 복사</button>를 붙여 넣고 <b>Run</b>.</li>
            <li>강사 화면 열쇠를 만들고, 그 아래 SQL 한 줄을 같은 곳에서 실행해 연수를 등록해요.
              {!adm ? <div><button class="btn btn-sm" onClick={makeAdmin}>관리자 키 만들기</button></div> : <div class="stack" style={{ gap: '6px', marginTop: '6px' }}>
                <div class="keybox">{adm.key}</div><div class="btn-row"><button class="btn btn-sm" onClick={() => copy(adm.key, '관리자 키를 복사했어요. 안전한 곳에 적어 두세요.')}>키 복사(적어 두세요)</button></div>
                <div class="prompt-box">{`select lec_private.init_training_hash('${code}', '${adm.hash}', '{"retentionDays": ${bp.privacy?.retentionDays || 30}${bp.audience?.minor ? ', "uploads": false' : ''}}');`}</div>
                <div><button class="btn btn-sm" onClick={() => copy(`select lec_private.init_training_hash('${code}', '${adm.hash}', '{"retentionDays": ${bp.privacy?.retentionDays || 30}${bp.audience?.minor ? ', "uploads": false' : ''}}');`, 'SQL 한 줄을 복사했어요.')}>SQL 한 줄 복사</button></div></div>}</li>
            <li><b>Project Settings → API Keys</b>에서 프로젝트 주소와 <b>publishable 키(sb_publishable_…)</b>를 아래에 붙여 넣어요. secret 키는 절대 넣지 마세요.</li>
          </ol>
        )}
        {method === 'http' && (
          <div class="stack">
            <p class="small">Cloudflare 계정(무료)이 있으면 단추 하나로 내 실시간 서버를 만들 수 있어요. 배포할 때 넣는 <b>ADMIN_KEY</b>가 강사 화면 비밀번호예요. 학교 서버·NAS·노트북은 <a href={`${REPO}/backends/node-server`} target="_blank" rel="noopener">Node 서버 안내</a>를 보세요.</p>
            <div><a class="btn btn-sm" href={CF_DEPLOY} target="_blank" rel="noopener">Cloudflare에 내 실시간 서버 만들기</a></div>
          </div>
        )}
        <div class="form-grid">
          <Field label={method === 'sheets' ? '웹 앱 URL' : method === 'supabase' ? '프로젝트 주소' : '서버 주소'} hint={method === 'sheets' ? 'https://script.google.com/macros/s/…/exec' : method === 'supabase' ? 'https://xxxx.supabase.co' : 'https://lecpage-live.내계정.workers.dev'}>
            <input type="url" value={draft.url} onInput={(e) => setDraft({ ...draft, url: e.target.value })} placeholder="https://" />
          </Field>
          {method === 'supabase' && <Field label="publishable(공개) 키"><input value={draft.anonKey} onInput={(e) => setDraft({ ...draft, anonKey: e.target.value })} placeholder="sb_publishable_…" /></Field>}
        </div>
        <div class="btn-row"><button class="btn btn-primary" disabled={!draft.url || state.busy} onClick={() => test(false)}>{state.busy ? '확인하는 중…' : '연결 확인'}</button><button class="btn btn-sm btn-quiet" onClick={useLocal}>지금은 이 컴퓨터에서만 시험할게요</button></div>
        {state.msg && <Notice kind={state.ok ? 'ok' : 'bad'}>{state.msg}</Notice>}
      </>}
      <p class="small muted">연수 코드 <span class="mono">{code}</span> · 기록은 강사님 계정에만 쌓이고 lecpage 운영자는 볼 수 없어요. 연수가 끝나면 강사 화면에서 내려받고 지워 주세요.</p>
    </div>
  );
}
