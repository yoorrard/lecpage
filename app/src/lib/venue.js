// 연수 장소 대비: 전날 점검 달력 일정(.ics), '혹시 안 열리면' 한 장, 인쇄용 실습·프롬프트 모음.
// 모두 이 브라우저에서 글로 만들어 내려받기만 합니다(어디로도 보내지 않음). 근거: docs/research/school-network-2026-11.md §5·§6
import { qrSvg } from '../components/QR.jsx';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const bare = (u) => String(u || '').replace(/^https?:\/\//, '').replace(/\/+$/, '');
const dir = (u) => String(u || '').split('#')[0].replace(/\/?$/, '/');
export const checkUrlOf = (siteUrl) => (siteUrl ? dir(siteUrl) + 'check.html' : '');

/** 'YYYY-MM-DD'의 하루 전(같은 모양). 날짜가 아니면 '' */
export function dayBefore(date) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || ''));
  if (!m) return '';
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] - 1));
  return d.toISOString().slice(0, 10);
}
/** 한국 시간 'YYYY-MM-DD' + 'HH:MM' → iCalendar UTC 시각(20261119T060000Z) */
function utcStamp(date, hm) {
  const [y, mo, d] = date.split('-').map(Number); const [h, mi] = hm.split(':').map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h - 9, mi)).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}
const icsText = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
/** 한 줄 75바이트(UTF-8)에서 접기(RFC 5545 3.1). 한글이 중간에 잘리지 않게 글자 단위로 */
function fold(line) {
  const enc = new TextEncoder(); const out = []; let cur = ''; let n = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (n + b > (out.length ? 74 : 75)) { out.push(cur); cur = ''; n = 0; }
    cur += ch; n += b;
  }
  out.push(cur);
  return out.join('\r\n ');
}

/**
 * 연수 전날 점검 일정(.ics): 달력 앱(휴대폰·구글·아웃룩)에 넣으면 그날 알림이 옴. 브라우저 알림은 앱을 열어 둬야 해서 쓰지 않음.
 * 날짜가 없으면 ''. 시각은 전날 15:00~15:20(한국 시간), 10분 전 알림
 */
export function venueIcs({ title, date, siteUrl, altUrl = '', venue = '', now = Date.now() }) {
  const day = dayBefore(date); if (!day || !siteUrl) return '';
  const check = checkUrlOf(siteUrl);
  const desc = [
    `연수 장소(${venue || '연수하는 곳'})의 Wi-Fi로 접속 확인을 열어 보세요. 막힌 곳과 할 일이 나와요.`,
    `접속 확인: ${check}`,
    `사이트: ${siteUrl.split('#')[0]}`,
    altUrl ? `두 번째 주소: ${altUrl}` : '',
    '막히면 [결과 복사]로 기관 정보 담당자에게 보내거나, 참가자에게 휴대폰 데이터로 접속하게 안내하세요.',
  ].filter(Boolean).join('\n');
  const uid = `${day}-${Math.random().toString(36).slice(2, 10)}@lecpage`;
  const stamp = new Date(now).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//lecpage//venue-check//KO', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT', `UID:${uid}`, `DTSTAMP:${stamp}`, `DTSTART:${utcStamp(day, '15:00')}`, `DTEND:${utcStamp(day, '15:20')}`,
    `SUMMARY:${icsText(`[전날 점검] ${title || '연수'}`)}`, `DESCRIPTION:${icsText(desc)}`, `URL:${check}`,
    ...(venue ? [`LOCATION:${icsText(venue)}`] : []),
    'BEGIN:VALARM', 'TRIGGER:-PT10M', 'ACTION:DISPLAY', `DESCRIPTION:${icsText('연수 장소에서 접속 확인을 열어 보세요.')}`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}

const PAGE_CSS = `body{font:15px/1.65 system-ui,'Malgun Gothic','Apple SD Gothic Neo',sans-serif;max-width:46em;margin:28px auto;padding:0 18px;color:#1b1b1b;background:#fff;word-break:keep-all}
h1{font-size:22px;margin:0 0 4px}h2{font-size:16px;margin:22px 0 6px;padding-top:10px;border-top:1px solid #ddd}p,li{margin:4px 0}ol,ul{padding-left:1.3em}
.sub{color:#555;margin:0 0 12px}.url{font:600 14px/1.4 ui-monospace,Consolas,monospace;word-break:break-all}.qr{display:flex;gap:18px;flex-wrap:wrap;margin:8px 0}
.qr figure{margin:0;text-align:center;font-size:12px;color:#444}.qr svg{width:120px;height:120px;display:block}
pre{white-space:pre-wrap;font:13px/1.55 ui-monospace,Consolas,monospace;background:#f5f3f1;border:1px solid #e3dfdb;border-radius:6px;padding:8px 10px;margin:4px 0 10px}
.tip{background:#f6f6f6;border-radius:6px;padding:8px 12px}@page{size:A4;margin:14mm}@media print{body{margin:0;max-width:none}h2{break-after:avoid}pre{break-inside:avoid}}`;
const page = (title, body) => `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${PAGE_CSS}</style><body>${body}</body></html>`;
const qrFig = (u, cap) => `<figure>${qrSvg(u)}<figcaption>${esc(cap)}</figcaption></figure>`;

/**
 * '혹시 안 열리면' 한 장(A4 한 쪽, 인쇄해 두거나 휴대폰에 저장). 꼭 필요한 것만:
 * 두 번째 주소 · 휴대폰 데이터로 접속 · 인터넷이 아예 안 될 때(ZIP·인쇄본) · 참여 기능만 안 될 때
 */
export function kitHtml({ title, siteUrl, shareUrl = '', altUrl = '', second = '', live = false, zipName = '' }) {
  const main = shareUrl || siteUrl; const alt = altUrl || second;
  const body = `<h1>혹시 안 열리면 · ${esc(title)}</h1>
<p class="sub">연수 당일 사이트가 안 열릴 때 차례대로 해 보세요. 이 종이는 인쇄하거나 휴대폰에 저장해 두세요.</p>
<div class="qr">${qrFig(main, '사이트')}${alt ? qrFig(alt, '두 번째 주소') : ''}${siteUrl ? qrFig(checkUrlOf(siteUrl), '접속 확인') : ''}</div>
<p>사이트: <span class="url">${esc(bare(siteUrl))}</span></p>
<h2>1. 주소가 안 열리면</h2>
<ol>${alt ? `<li>두 번째 주소로 열어 보세요: <span class="url">${esc(bare(alt))}</span> (학교망이 첫 주소만 막은 경우)</li>` : '<li>두 번째 주소가 없어요. 사이트 ZIP을 다른 곳(예: Cloudflare에 끌어 놓기)에 한 번 더 올려 두면 여기에 적을 수 있어요.</li>'}
<li>참가자에게 Wi-Fi를 끄고 휴대폰 데이터(LTE·5G)로 QR을 찍게 안내하세요. 학교 Wi-Fi 필터와 상관없이 열려요.</li>
<li>강사 PC는 휴대폰 핫스팟에 이어 발표 화면을 여세요.</li>
<li>접속 확인(위 QR)의 [결과 복사]를 기관 정보 담당자에게 보내면 무엇을 열어야 하는지 바로 알 수 있어요.</li></ol>
<h2>2. 인터넷이 아예 안 되면</h2>
<ul><li>사이트 ZIP${zipName ? `(${esc(zipName)})` : ''}을 USB에 담아 강사 PC에서 압축을 풀고 index.html을 여세요. 교재·일정·실습·프롬프트 복사는 그대로 돼요.</li>
<li>인쇄용 실습·프롬프트 모음(강사용 파일의 실습프롬프트모음.html)을 나눠 주세요.</li></ul>
${live ? `<h2>3. 참여 기능(질문·투표)만 안 되면</h2>
<ul><li>교재·실습은 그대로예요. 참가자 화면에 '서버에 닿지 않아요' 한 줄이 떠요.</li>
<li>질문은 손을 들어 받고, 투표는 손 들기로 바꿔요. 설문은 나중에 주소를 다시 보내도 돼요.</li>
<li>강사 화면 맨 위에 묻기 방식과 할 일이 나와요. 연결이 돌아오면 쌓인 글이 들어와요.</li></ul>` : ''}
<p class="tip">가장 확실한 대비: 연수 전날 연수 장소의 Wi-Fi로 접속 확인을 한 번 열어 보세요.</p>`;
  return page(`혹시 안 열리면 · ${title}`, body);
}

/** 인쇄용 실습·프롬프트 모음(인터넷이 안 될 때 종이로). 교재 자체는 원본 파일을 인쇄 */
export function printHtml(bp) {
  const m = bp?.meta || {}; const secs = bp?.sections || [];
  const out = [];
  const sched = secs.find((s) => s.type === 'schedule');
  if (sched?.items?.length) out.push(`<h2>${esc(sched.title || '일정')}</h2><ul>${sched.items.map((i) => `<li>${esc([i.start && `${i.start}${i.end ? '~' + i.end : ''}`, i.title].filter(Boolean).join(' '))}${i.desc ? ` · ${esc(i.desc)}` : ''}</li>`).join('')}</ul>`);
  for (const s of secs.filter((x) => x.type === 'stations')) {
    for (const it of s.items || []) {
      let h = `<h2>${esc(it.tag ? `${it.tag} ` : '')}${esc(it.title || it.name)}</h2>`;
      if (it.desc) h += `<p>${esc(it.desc)}</p>`;
      if (it.steps?.length) h += `<ol>${it.steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>`;
      for (const pr of it.prompts || []) h += `${pr.title ? `<p><b>${esc(pr.title)}</b></p>` : ''}<pre>${esc(pr.text)}</pre>`;
      if (it.outcome) h += `<p>결과물: ${esc(it.outcome)}</p>`;
      out.push(h);
    }
  }
  for (const s of secs.filter((x) => x.type === 'prompts')) {
    if (!s.items?.length) continue;
    out.push(`<h2>${esc(s.title || '프롬프트 모음')}</h2>${s.items.map((i) => `${i.title ? `<p><b>${esc(i.title)}</b></p>` : ''}<pre>${esc(i.text)}</pre>`).join('')}`);
  }
  if (!out.length) out.push('<p>실습과 프롬프트가 없는 연수예요. 교재 원본 파일을 인쇄해 주세요.</p>');
  return page(`${m.title || '연수'} · 실습·프롬프트 모음`, `<h1>${esc(m.title || '연수')}</h1><p class="sub">실습·프롬프트 모음(인쇄용). 교재는 원본 파일을 인쇄해 주세요.</p>${out.join('\n')}`);
}
