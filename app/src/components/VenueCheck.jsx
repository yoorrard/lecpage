import { useEffect, useState } from 'preact/hooks';
import { QR } from './QR.jsx';
import { instantStatus, PUBLISH_API } from '../lib/deploy.js';
import { venueIcs, checkUrlOf, dayBefore, kitHtml, printHtml } from '../lib/venue.js';
import { saveFile, safeName, copy, toast } from '../lib/util.js';

const md = (date) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || ''); return m ? `${+m[2]}월 ${+m[3]}일` : ''; };

/**
 * 바로 공개 서버의 그날 몫(상태 API, 1분 캐시). 만들 때 이미 '꽉 참'이면 서버가 알려 주지만, 그 전에 미리 보여 줌.
 * date: 연수 날짜, site: 올린 사이트 id. 한 번만 묻고, [다시 확인]으로 다시
 */
export function useDayStatus({ on, date, site }) {
  const [st, setSt] = useState(null); const [n, setN] = useState(0);
  useEffect(() => { if (!on || !PUBLISH_API || (!date && !site)) { setSt(null); return undefined; } let off = false; instantStatus({ date, site }).then((s) => { if (!off) setSt(s || false); }); return () => { off = true; }; }, [on, date, site, n]);
  return [st, () => setN((x) => x + 1)];
}
/** 그날 몫 → 한 줄({ k: 'ok'|'tight'|'full', t }) */
export function dayLine(st, date) {
  const d = st?.day; if (!d) return null;
  if (!d.budget) return { k: 'ok', t: `${md(date)}: 바로 공개 서버에 하루 한도가 없어요.` };
  const head = `${md(date)} 바로 공개 예약: 연수 ${d.trainings || 0}개 · 참가자 ${d.people || 0}명`;
  if (!d.ok) return { k: 'full', t: `${head}. 그날 참여 기능 자리가 찼어요. 지금 공개하면 만들 때 알려 줘요. 내 계정에 올리면 붐벼도 상관없어요.` };
  if (d.pct >= 50) return { k: 'tight', t: `${head}. 그날 참여 기능 자리가 빠듯해요(하루 몫의 ${d.pct}%). 사이트는 붐벼도 열려요.` };
  return { k: 'ok', t: `${head}. 여유 있어요.` };
}

/**
 * 공개 체크리스트의 '연수 장소 확인': 공개 전에는 그날 몫(바로 공개), 공개 뒤에는 접속 확인 주소·QR과 전날 점검 일정(.ics).
 * 연수 장소의 Wi-Fi(참가자와 같은 망)로 전날 한 번 열어 보는 것이 가장 확실함
 */
export function VenueBody({ p, url, instantOn }) {
  const m = p.blueprint?.meta || {};
  const check = checkUrlOf(url);
  const site = p.deploy?.target === 'lecpage' ? p.deploy?.lecpage?.id || '' : '';
  const [st, again] = useDayStatus({ on: instantOn, date: m.date || '', site });
  const line = dayLine(st, m.date);
  const siteGone = st?.site?.state === 'gone' ? '공개 기간이 끝나 사이트가 지워졌어요. 다시 올려 주세요.' : st?.site?.state === 'blocked' ? '사이트가 가려져 있어요. 운영자에게 문의해 주세요.' : '';
  const ics = () => {
    const t = venueIcs({ title: m.title, date: m.date, siteUrl: url, altUrl: p.deploy?.lecpage?.altUrl || p.deploy?.second || '', venue: m.venue || '' });
    saveFile(safeName(m.title) + '_전날점검.ics', t, 'text/calendar;charset=utf-8'); toast('달력 일정을 내려받았어요. 열면 달력 앱에 들어가요.');
  };
  return (
    <div class="stack venue">
      {line && <p class={`small venue-day is-${line.k}`} role="status">{line.t} {instantOn && <button type="button" class="btn btn-sm btn-quiet" onClick={again}>다시 확인</button>}</p>}
      {siteGone && <p class="small err" role="alert">{siteGone}</p>}
      {!url ? <p class="small">공개하면 접속 확인 주소와 QR이 나와요. 연수 전날, 연수 장소의 Wi-Fi로 열어 막힌 곳이 없는지 확인해요.</p> : <>
        <div class="venue-row">
          <div class="stack" style={{ gap: '6px' }}>
            <p class="small">연수 전날, <b>연수 장소의 Wi-Fi</b>(참가자와 같은 망)로 이 QR을 찍거나 주소를 열어 보세요. 막힌 곳과 할 일이 나와요. 결과는 강사 화면 맨 위에도 남아요.</p>
            <p class="small mono venue-url">{check.replace(/^https:\/\//, '')}</p>
            <div class="btn-row">
              <a class="btn btn-sm" href={check} target="_blank" rel="noopener">접속 확인 열기</a>
              <button type="button" class="btn btn-sm" disabled={!dayBefore(m.date)} onClick={ics}>전날 점검 달력에 넣기</button>
              <button type="button" class="btn btn-sm btn-quiet" onClick={() => copy(check, '접속 확인 주소를 복사했어요.')}>주소 복사</button>
            </div>
            {!dayBefore(m.date) && <p class="small muted">연수 날짜를 넣으면 전날 점검 일정을 만들 수 있어요.</p>}
            {m.shortUrl && <p class="small muted">짧은 주소({m.shortUrl.replace(/^https:\/\//, '')})도 그곳에서 한 번 열어 보세요. 막혀 있으면 QR(원래 주소)로 안내하면 돼요.</p>}
          </div>
          <QR text={check} size={112} alt="접속 확인 QR" />
        </div>
      </>}
    </div>
  );
}

/**
 * '혹시 안 열리면' 한 장과 인쇄용 실습·프롬프트 모음(공개 완료 화면). 두 번째 주소는 바로 공개면 서버가 주고,
 * 아니면 사이트 ZIP을 다른 곳에 한 번 더 올리고 주소를 적어 둠(p.deploy.second)
 */
export function RescueKit({ p, update, url, shareUrl, onZip, busy }) {
  const m = p.blueprint?.meta || {};
  const alt = p.deploy?.target === 'lecpage' ? p.deploy?.lecpage?.altUrl || '' : '';
  const [second, setSecond] = useState(p.deploy?.second || '');
  const live = (p.blueprint?.live?.features || []).length > 0;
  const okSecond = !second || /^https:\/\/[^\s/]+\.[^\s]+$/.test(second.trim());
  const save = () => { if (!okSecond) return; update((cur) => ({ deploy: { ...(cur.deploy || {}), second: second.trim() } })); toast(second.trim() ? '두 번째 주소를 적어 뒀어요.' : '두 번째 주소를 지웠어요.'); };
  const kit = () => saveFile(safeName(m.title) + '_혹시안열리면.html', kitHtml({ title: m.title, siteUrl: url, shareUrl, altUrl: alt, second: (p.deploy?.second || '').trim(), live, zipName: safeName(m.title) + '.zip' }), 'text/html;charset=utf-8');
  const print = () => saveFile(safeName(m.title) + '_실습프롬프트모음.html', printHtml(p.blueprint), 'text/html;charset=utf-8');
  return (
    <details class="rescue">
      <summary><b>혹시 안 열리면</b> <span class="small muted">두 번째 주소 · 휴대폰 데이터 · USB · 인쇄본</span></summary>
      <div class="stack rescue-b">
        {alt ? null
          : <div class="stack" style={{ gap: '6px' }}>
            <p class="small">두 번째 주소를 만들어 두면 첫 주소가 막힌 곳에서도 열려요. 사이트 ZIP을 다른 곳(예: Cloudflare에 끌어 놓기)에 한 번 더 올리고 주소를 적어 두세요.</p>
            <div class="row token-row"><input class="input" value={second} onInput={(e) => setSecond(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} placeholder="https://" inputMode="url" autoComplete="off" spellcheck={false} aria-label="두 번째 주소" aria-invalid={okSecond ? undefined : 'true'} />
              <button type="button" class="btn btn-sm" disabled={!okSecond} onClick={save}>적어 두기</button></div>
            {!okSecond && <p class="small err">https://로 시작하는 주소를 넣어 주세요.</p>}
          </div>}
        <ul class="small rescue-list">
          <li>참가자에게 Wi-Fi를 끄고 휴대폰 데이터로 QR을 찍게 하면 학교 Wi-Fi 필터와 상관없이 열려요. 강사 PC는 휴대폰 핫스팟에 이으세요.</li>
          <li>인터넷이 아예 안 되면 사이트 ZIP을 USB에 담아 강사 PC에서 index.html을 열어요. 교재·실습·프롬프트 복사는 그대로 돼요.</li>
          {live && <li>참여 기능만 안 되면 질문은 손을 들어 받아요. 참가자 화면에는 차분한 한 줄이 뜨고, 교재·실습은 그대로예요.</li>}
        </ul>
        <div class="btn-row">
          <button type="button" class="btn btn-sm btn-primary" onClick={kit}>안내 한 장 받기</button>
          <button type="button" class="btn btn-sm" disabled={!!busy} onClick={onZip}>{busy === 'zip' ? '만드는 중…' : '사이트 ZIP 받기'}</button>
          <button type="button" class="btn btn-sm" onClick={print}>실습·프롬프트 인쇄본</button>
          {!alt && <a class="btn btn-sm btn-quiet" href="https://dash.cloudflare.com/?to=/:account/workers-and-pages/create" target="_blank" rel="noopener">Cloudflare 열기</a>}
        </div>
      </div>
    </details>
  );
}
