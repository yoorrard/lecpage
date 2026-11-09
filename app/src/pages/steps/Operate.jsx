import { useState } from 'preact/hooks';
import { StepHead, StepFoot } from '../Project.jsx';
import { Sheet, Field, Chips, Notice } from '../../components/ui.jsx';
import { E } from '../../lib/engine.js';
import { copy, randomKey, sha256Hex } from '../../lib/util.js';

const REPO = 'https://github.com/yoorrard/lecpage/tree/main/skills/lecpage';
const GUIDES = {
  supabase: { label: 'Supabase 설정 안내', href: `${REPO}/backends/supabase` },
  sheets: { label: 'Google Sheets 설정 안내', href: `${REPO}/backends/apps-script` },
  http: { label: 'Cloudflare·자체 서버 안내', href: `${REPO}/backends` },
};
const PROVIDER_OF = { none: 'none', local: 'local', sheets: 'sheets', supabase: 'supabase', cloudflare: 'http', server: 'http', lan: 'http' };

export function StepOperate({ p, update, go }) {
  const bp = p.blueprint;
  const info = p.info;
  const [key, setKey] = useState('');
  const [hash, setHash] = useState('');
  if (!bp) return <><StepHead title="운영 방식" /><Notice>먼저 설계도를 만들어 주세요.</Notice><StepFoot go={go} prev={3} /></>;
  const setInfo = (k) => (v) => update({ info: { ...p.info, [k]: v } });
  const infraIn = { size: info.size, features: info.features, skill: info.skill, duration: info.duration, network: info.network, infra: info.infra, commercial: info.commercial, minor: info.minor };
  const r = E.decideInfra(infraIn);
  const live = bp.live || {};
  const setLive = (patch) => update({ blueprint: { ...bp, live: { ...live, ...patch } } });
  const pv = bp.privacy || {};
  const setPv = (patch) => update({ blueprint: { ...bp, privacy: { ...pv, ...patch } } });
  async function genKey() { const k = randomKey(20); setKey(k); setHash(await sha256Hex(k)); }
  return (
    <>
      <StepHead title="운영 방식을 정해요" desc="인원과 필요한 기능에 맞춰 사이트를 둘 곳과 실시간 기능의 서버를 골라 드려요. 모두 강사님 계정에 만들고, 운영 비용은 대부분 0원이에요." />
      <Sheet>
        <div class="stack">
          <Q label="사이트 관리 숙련도"><Chips value={info.skill} onChange={setInfo('skill')} options={[{ value: 'click', label: '클릭만 할게요' }, { value: 'set', label: '설정값 붙여넣기 정도' }, { value: 'dev', label: '코드도 고칠 수 있어요' }]} /></Q>
          <Q label="이미 가진 계정·서버(여러 개)"><Chips multiple value={info.infra} onChange={setInfo('infra')} options={[{ value: 'github', label: 'GitHub' }, { value: 'cloudflare', label: 'Cloudflare' }, { value: 'google', label: '구글 계정' }, { value: 'aws', label: 'AWS' }, { value: 'school-server', label: '학교·기관 서버' }, { value: 'nas', label: 'NAS' }, { value: 'server', label: '개인 서버' }]} /></Q>
          <Q label="사이트 유지 기간"><Chips value={info.duration} onChange={setInfo('duration')} options={[{ value: 'day', label: '당일 연수' }, { value: 'month', label: '한 달 안팎' }, { value: 'long', label: '여러 주 과정' }]} /></Q>
        </div>
      </Sheet>
      <Sheet fold={false}>
        <div class="infra-result">
          <span class="tag tag-lav" style={{ justifySelf: 'start' }}>추천 · {r.tier}단계</span>
          <div class="tier">{r.backendInfo.name_ko}</div>
          <p class="muted">{r.backendInfo.note_ko} · 예상 비용 {r.backendInfo.cost}</p>
          <ul class="reasons">{r.reasons.map((x) => <li>{x}</li>)}</ul>
          {r.warnings.length > 0 && <Notice>{r.warnings.join(' ')}</Notice>}
          <div><b>사이트를 둘 곳</b> <span class="muted small">(좋은 순서)</span></div>
          <div class="chips">{r.hostInfo.map((h, i) => <span class={`tag ${i === 0 ? 'tag-mint' : 'tag-butter'}`} title={h.note_ko}>{h.name_ko}</span>)}</div>
          <div class="btn-row"><button class="btn btn-primary btn-sm" onClick={() => setLive({ provider: PROVIDER_OF[r.backend] || 'none' })}>이 추천대로 실시간 방식 정하기</button></div>
        </div>
      </Sheet>
      <Sheet fold={false}>
        <div class="stack">
          <h2 style={{ fontSize: '1.2rem' }}>실시간 기능 연결</h2>
          <Chips value={live.provider || 'none'} onChange={(v) => setLive({ provider: v })} options={[{ value: 'none', label: '끄기(정적 사이트)' }, { value: 'local', label: '미리보기·리허설용' }, { value: 'supabase', label: 'Supabase' }, { value: 'sheets', label: 'Google Sheets' }, { value: 'http', label: 'Cloudflare·자체 서버' }]} />
          {live.provider === 'local' && <Notice>이 방식은 한 기기 안에서만 동작해요. 실제 연수에서는 Supabase·Sheets·서버 중 하나로 바꿔 주세요.</Notice>}
          {live.provider === 'supabase' && <div class="form-grid">
            <Field label="Project URL" hint="https://xxxx.supabase.co"><input type="url" value={live.url || ''} onInput={(e) => setLive({ url: e.target.value.trim() })} /></Field>
            <Field label="anon(공개) 키" hint="공개해도 되는 키예요. service_role 키는 절대 넣지 마세요."><input value={live.anonKey || ''} onInput={(e) => setLive({ anonKey: e.target.value.trim() })} /></Field>
          </div>}
          {(live.provider === 'sheets' || live.provider === 'http') && <Field label={live.provider === 'sheets' ? 'Apps Script 웹 앱 주소' : '서버 주소'} hint={live.provider === 'sheets' ? 'https://script.google.com/macros/s/…/exec' : 'https://lecpage-live.내계정.workers.dev 또는 https://내서버'}><input type="url" value={live.url || ''} onInput={(e) => setLive({ url: e.target.value.trim() })} /></Field>}
          {GUIDES[live.provider] && <a class="btn btn-sm" href={GUIDES[live.provider].href} target="_blank" rel="noopener">{GUIDES[live.provider].label}</a>}
          {live.provider && live.provider !== 'none' && (
            <div class="stack">
              <div class="spread"><b>참여 코드</b><span class="mono">{E.validate(bp).blueprint.live.code}</span></div>
              <b>관리자 키</b>
              <p class="small muted">강사 콘솔에 들어갈 때 쓰는 비밀번호예요. lecpage는 이 키를 저장하지 않아요. 만든 뒤 바로 안전한 곳에 적어 두고, 서버 설정에는 아래 '해시'만 넣으세요.</p>
              {!key ? <div><button class="btn btn-sm" onClick={genKey}>관리자 키 만들기</button></div> : <>
                <div class="keybox">{key}</div>
                <div class="btn-row"><button class="btn btn-sm" onClick={() => copy(key, '관리자 키를 복사했어요.')}>키 복사</button><button class="btn btn-sm btn-quiet" onClick={() => copy(hash, '해시를 복사했어요.')}>해시 복사</button></div>
                <p class="small mono" style={{ wordBreak: 'break-all' }}>SHA-256: {hash}</p>
              </>}
            </div>
          )}
        </div>
      </Sheet>
      <Sheet fold={false}>
        <div class="stack">
          <h2 style={{ fontSize: '1.2rem' }}>개인정보</h2>
          <Chips value={(pv.collect || ['nickname']).includes('name') ? 'name' : 'nick'} onChange={(v) => setPv({ collect: v === 'name' ? ['nickname', 'name', 'school'] : ['nickname'] })} options={[{ value: 'nick', label: '별명만 받기(권장)' }, { value: 'name', label: '이름·소속도 받기(출석·이수용)' }]} />
          {bp.audience?.minor && <Notice>만 14세 미만이 참여해 별명만 받아요.</Notice>}
          <Field label="보관 기간(일)" hint="연수가 끝나고 이 기간이 지나면 콘솔에서 지워 주세요."><input type="number" min="1" max="365" value={pv.retentionDays || 30} onInput={(e) => setPv({ retentionDays: +e.target.value || 30 })} style={{ width: '120px' }} /></Field>
        </div>
      </Sheet>
      <StepFoot go={go} prev={5} next={7} nextLabel="다음: 완성·배포" />
    </>
  );
}
function Q({ label, children }) { return <div class="field"><span>{label}</span>{children}</div>; }
