import { useEffect, useRef, useState } from 'preact/hooks';
import { StepHead } from '../Project.jsx';
import { Sheet, Field, Notice, Progress, Dialog, SecretLine } from '../../components/ui.jsx';
import { Mascot } from '../../components/Mascot.jsx';
import { QR, qrPng, copyQr } from '../../components/QR.jsx';
import { LiveSetup, adminKeyFor, liveName } from '../../components/LiveSetup.jsx';
import { useCfWay } from '../../components/CfConnect.jsx';
import { loadRuntime, E } from '../../lib/engine.js';
import { blobs } from '../../lib/db.js';
import { assembleProject } from '../../lib/studio.js';
import { Publish, lecLiveOff, instantLiveOk, LABEL as SITE_LABEL } from '../../components/Publish.jsx';
import { PUBLISH_API, probeSite, mergeSite, instantInfo, instantLiveOpen, instantRecords, recordsLine, siteStat, fitOriginals, leftLine, slidesCover, shortenUrl, shortName, checkShortUrl, showUrl, SHORTENERS } from '../../lib/deploy.js';
import { slideSetsOf, setFor, setsWithin, numOf, MAX_SLIDES } from '../../lib/gen/slide-sets.js';
import { saveFile, safeName, toast, copy, isPastDate, monthDay } from '../../lib/util.js';
import { VenueBody, RescueKit, useDayStatus, dayLine } from '../../components/VenueCheck.jsx';
import { kitHtml } from '../../lib/venue.js';
import { reach } from '../../lib/netcheck.js';
import { FEATURES, LIVE_KEYS, deployView, patchDeploy, isV2, featuresOf, siteFeatures, toggleFeature, ensureCode, printSiteHtml, carryPatch } from '../../lib/site-meta.js';
import { duplicateProject } from '../../lib/project.js';
import { keepPlan } from '../../lib/keep-dates.js';
import { lecOnlyLive, consoleKeySource } from '../../lib/console-key.js';
import { whenText } from '@engine/src/hero-meta.js';

const same = (u) => String(u || '').replace(/^https?:\/\//, '').replace(/\/+$/, '');
const LIVE_READY = (live, ok) => ['sheets', 'supabase', 'http'].includes(live?.provider) && live?.url && ok;
const LIVE_NAME = { sheets: '구글 시트', supabase: 'Supabase', http: '참여 기능 서버' };
// 바로 배포 서버가 맡은 참여 기능 방인지(lecOnlyLive)와 강사 화면 관리자 키를 고르는 규칙은 lib/console-key.js에('내 연수' 목록과 함께 씀)
export { lecOnlyLive };
/** 대표 주소의 사이트에 참여 기능이 들어갔는지(배포할 때 적어 둔 표시. 예전 기록은 바로 배포 방이 있었으면 들어간 것으로) */
export const siteHasLive = (d, t = d?.target) => { const s = d?.sites?.[t]; return s?.live === true || (s?.live === undefined && t === 'lecpage' && !!d?.lecpage?.adminKey); };

const DAY = 864e5;
/** 연수 마지막 날이 끝나는 때(한국 시간 다음 날 0시). 차시 날짜가 있으면 마지막 차시. 날짜가 없으면 0 */
export function trainingEnd(meta = {}) {
  const days = [meta.date, ...(meta.sessions || []).map((x) => x.date)].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '')).sort();
  return days.length ? Date.parse(`${days[days.length - 1]}T00:00:00+09:00`) + DAY : 0;
}
const md = (t) => new Date(t).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', timeZone: 'Asia/Seoul' });
/**
 * 바로 배포의 보관 기간과 연수 날짜. 보관 기간이 정해진 서버(keepAlive=false: 마지막 배포 뒤 N일)에서만.
 * { gone: 이미 지워짐, short: 연수 날 전에 지워짐, until, again: 지금 다시 배포하면 늘어나는 날, enough: 지금 다시 배포하면 연수 날까지 닿는지,
 *   at: 다시 배포할 날(지워지기 전), reach: 그날 한 번으로 연수 날까지 닿는지 } — 날짜 셈은 lib/keep-dates.js
 */
export function lecExpiry(p, info, now = Date.now()) {
  const lec = p.deploy?.lecpage; const fixed = info ? info.keepAlive === false : lec?.view === 'pages' || !!lec?.fixed;
  if (!fixed) return null;
  const days = info?.limits?.days || 60; const end = trainingEnd(deployView(p)?.meta);
  const until = lec?.expiresAt && p.deploy?.target === 'lecpage' ? lec.expiresAt : 0;
  return keepPlan({ now, days, until, end });
}
/**
 * 연수 날 전에 지워질 때 언제 다시 배포할지 한두 문장(체크리스트·배포 완료 카드가 같은 말).
 * 알려 주는 날은 지워지는 날보다 앞(지워진 뒤 다시 배포하면 새 주소라 QR이 끊김). 한 번으로 닿지 않으면 그렇게 말하고 다음 할 일을 알림
 */
export function keepAdvice(exp) {
  const dies = exp.until || exp.again;
  return exp.reach
    ? `${md(exp.at)}쯤 다시 배포하면 같은 주소로 연수 날까지 열려요. ${md(dies)}에 지워진 뒤에 다시 배포하면 주소가 바뀌어요.`
    : `한 번 다시 배포해서는 연수 날까지 닿지 않아요. ${md(exp.at)}쯤 다시 배포하고, 그 뒤에도 지워지기 전에 또 다시 배포해 주세요. 내 계정에 배포하면([다른 곳에 배포]) 기간 제한이 없어요.`;
}

/** 배포 전에 볼 곳(참여 기능 연결은 체크리스트 첫 줄이 맡음) */
function checks(p, exp) {
  const b = deployView(p); const out = [];
  // 보관 기간이 연수 날보다 먼저 끝남: 다시 배포로 닿으면 그 길을, 연수 날이 너무 멀면 언제 다시 배포할지
  if (exp?.short && !exp.gone) {
    const last = md(exp.end - DAY);
    out.push({ k: 'warn', t: exp.until
      ? `지금 사이트는 ${md(exp.until)}까지라 연수 날(${last})에는 열리지 않아요. ${exp.enough ? `다시 배포하면 ${md(exp.again)}까지로 늘어나요.` : keepAdvice(exp)}`
      : `바로 배포는 배포한 날부터 ${exp.days}일 보관이라 연수 날(${last})에는 지워져 있어요. ${keepAdvice(exp)}` });
  }
  if (!p.metaChecked) out.push({ k: 'warn', t: 'AI가 교재에서 찾은 연수 정보(제목·날짜·장소)를 아직 확인하지 않았어요.', go: 2 });
  if (!b.meta.date) out.push({ k: 'warn', t: '날짜가 비어 있어요(QR 안내문·일정 파일에 쓰여요).', go: 2 });
  // 지난 날짜(교재에 적힌 지난 연수 날짜를 그대로 쓴 경우가 많음): 고치라고만 알림(바꾸지 않음)
  else if (isPastDate(b.meta.date)) out.push({ k: 'warn', t: `연수 날짜(${monthDay(b.meta.date)})가 지났어요. QR 안내문·일정 파일에 이 날짜가 나와요.`, go: 2 });
  return out;
}

/**
 * 다시 배포할 때 지난 참여 기록이 남아 있는지: 기록이 연수 날 전에 쌓였으면(지난 기수·미리 해 본 시험) 새 참가자에게도 보이므로 묻기.
 * 연수 날·연수 뒤에 쌓인 기록(이번 연수 것)은 묻지 않음
 */
function oldRecords(p, rec) {
  const c = rec?.counts; if (!c) return null;
  const n = (c.participants || 0) + (c.questions || 0) + (c.posts || 0) + (c.survey || 0) + (c.answers || 0);
  const day = deployView(p)?.meta?.date;
  if (!n || !/^\d{4}-\d{2}-\d{2}$/.test(day || '') || !rec.last || rec.last >= Date.parse(`${day}T00:00:00+09:00`)) return null;
  return { line: recordsLine(rec), when: md(rec.last) };
}

/**
 * 글꼴 함께 담기 기본값(docs/research/school-network-2026-11.md §6): 학교·기관 망이 글꼴 CDN을 막으면 첫 화면이 늦게 뜨거나 글꼴이 바뀜
 * → 쓰인 글자가 든 조각·쓰는 굵기·woff2만 사이트 안에 담음(외부 요청 0). 빼는 곳: 바로 배포의 Worker 보기(글꼴 파일 요청도 하루 한도에 듦),
 * 그림·파일이 40개를 넘게 되는 GitHub Pages(파일마다 천천히 올림)
 */
const FONT_HOSTS = ['lecpage', 'vercel', 'netlify', 'cloudflare', 'zip', 'github-pages'];
const bins = (files) => Object.keys(files).filter((k) => !/\.(html|css|js|json|md|svg|txt|webmanifest)$/i.test(k)).length;
async function withFonts(files, { target, view }) {
  if (!FONT_HOSTS.includes(target) || (target === 'lecpage' && view !== 'pages')) return { files, note: '' };
  const get = (u) => { const c = new AbortController(); const t = setTimeout(() => c.abort(), 8000); return fetch(u, { mode: 'cors', credentials: 'omit', signal: c.signal }).finally(() => clearTimeout(t)); };
  // 참가자가 새 글자를 써도 같은 글꼴로 보이게 한글 조각을 모두 담되, 올릴 곳의 한도(파일 수·크기)를 넘으면 엔진이 덜 담음(바로 배포는 서버가 알려 준 한도, 잠글 때 늘 파일 몫을 남김)
  const lim = target === 'lecpage' ? (await instantInfo())?.limits : null;
  const fits = (f) => { const st = siteStat(f); return target === 'github-pages' ? bins(f) <= 40 : lim ? st.files <= lim.maxFiles - 8 && st.bytes <= lim.maxBytes && st.maxFile <= lim.maxFileBytes : E.checkHost(target, st).ok; };
  let fb = await E.bundleFonts(files, { fetch: get, fits });
  if (!fb.report.ok) return { files, note: '글꼴 서버에 닿지 않아 글꼴을 사이트에 담지 못했어요. 연수 장소에서 글꼴이 늦게 뜨거나 바뀌어 보일 수 있어요.' };
  // GitHub Pages: 글자만 남긴 글꼴은 원본과 둘씩이라 파일이 늘어남 → 넘치면 원본만 담아 다시 셈
  if (target === 'github-pages' && bins(fb.files) > 40 && fb.report.subset) fb = await E.bundleFonts(files, { fetch: get, subset: false });
  if (target === 'github-pages' && (!fb.report.ok || bins(fb.files) > 40)) return { files, note: '' };
  return { files: fb.files, note: '' };
}

/** 운영안내.md → 간단한 HTML(강사가 바로 열어 볼 수 있게) */
function mdToHtml(md, title) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const body = md.split(/\n{2,}/).map((blk) => {
    if (/^#{1,3} /.test(blk)) { const n = blk.match(/^#+/)[0].length; return `<h${n}>${esc(blk.replace(/^#+ /, ''))}</h${n}>`; }
    if (/^(- |\d+\. )/m.test(blk)) return '<ul>' + blk.split('\n').filter(Boolean).map((l) => `<li>${esc(l.replace(/^(- |\d+\. )/, ''))}</li>`).join('') + '</ul>';
    return `<p>${esc(blk).replace(/\n/g, '<br>')}</p>`;
  }).join('\n');
  return `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · 운영 안내</title><style>body{font:16px/1.7 system-ui,'Malgun Gothic',sans-serif;max-width:46em;margin:32px auto;padding:0 16px;word-break:keep-all}code{background:#f3f0ee;padding:1px 5px;border-radius:5px}</style>${body}</html>`;
}

/** 사이트에 '놓인 쪽 그림을 모두 보여 주는' 교재 슬라이드가 있는지: 쪽을 고르지 않은(data-pages 없는) data-lp="deck" */
const siteDeckAll = (site) => Object.entries(site || {}).some(([k, v]) => /\.html?$/i.test(k) && typeof v === 'string'
  && (v.match(/<[a-z][^>]*\sdata-lp\s*=\s*["']deck["'][^>]*>/gi) || []).some((t) => !/\sdata-pages\s*=/i.test(t)));
/**
 * 원본을 사이트에 넣지 않을 때 '참가자는 교재 슬라이드에서 모든 쪽을 볼 수 있어요'를 파일마다 사실일 때만 말하려고(lib/site-size.js slidesCover):
 * 그 교재(또는 같은 이름의 PDF 짝)의 쪽 그림이 끝 쪽까지 그려져 사이트에 놓여 있고, 사이트의 교재 슬라이드가 그 쪽들을 모두 보여 줄 때만 true.
 * pageNums: 사이트에 놓인 쪽 그림 번호(material/p-NNN). 놓인 그림이 지금 교재의 묶음과 맞지 않으면(교재를 바꾸고 다시 만들지 않음) 어느 교재의 쪽인지 알 수 없어 false
 */
function coverOf(p, pageNums) {
  const deckAll = siteDeckAll(p.site); const within = setsWithin(slideSetsOf(p), pageNums);
  return (f) => {
    const set = setFor(within, f.name);
    return slidesCover(set ? (p.files || []).find((x) => x.name === set.name) || f : f, set, { pageNums, deckAll, maxSlides: MAX_SLIDES });
  };
}
/**
 * 내 계정에 배포할 곳의 '파일 하나' 한도(엔진 표 E.HOSTS: Cloudflare 25MB·GitHub Pages 100MB). 파일 하나 한도는 없고 사이트 합계만 있는 곳(Vercel 100MB)은
 * 그 합계를 씀(그보다 큰 파일은 어차피 올릴 수 없음). 둘 다 없는 곳(Netlify)·ZIP은 null(아무것도 빼지 않음). 바로 배포는 서버가 알려 준 한도를 따로 씀
 */
const hostFileLimit = (to) => { const l = E.HOSTS[to]?.limit; const mb = l?.fileMB || l?.siteMB; return mb ? { maxFileBytes: mb * 1024 * 1024 } : null; };

export function StepShare({ p, update, go, stale, stopped, storeNow, idle, settle }) {
  const bp = deployView(p);
  const [busy, setBusy] = useState('');
  const [prog, setProg] = useState(null);
  const [ask, setAsk] = useState(null); // 참여 기능 미연결로 배포할 때 확인
  const [showPw, setShowPw] = useState(false);
  const [autoLive, setAutoLive] = useState(false); // 운영자의 바로 배포 서버가 참여 기능까지 맡는지
  const [target, setTarget] = useState(''); // 지금 고른 배포할 곳(Publish가 알려 줌)
  const [skipLive, setSkipLive] = useState(false); // 이번에는 참여 기능 없이 배포하기
  // 저장이 멈춘 동안은 배포 칸을 통째로 잠금(아래 fieldset). 다만 그 칸 안에 대화 창이 열려 있는 동안은 잠금을 미룸:
  // 잠긴 칸 안의 창은 눌리지 않으면서 화면을 막고(닫기도, 빨간 띠의 [다시 불러오기]도 못 누름), 억지로 닫으면 도는 일(배포 취소·로그인)의 진행·묻는 칸·실패 까닭이 사라지고 다시 열 수도 없음.
  // 열린 창은 그 자체로 나머지 화면을 막으니 그 창의 일만 끝낼 수 있고, 창이 닫히는 대로 잠금.
  // 창이 열리고 닫히는 것(open 속성)·사라지는 것(닫힘 알림 없이 화면에서 빠지기도 함)을 지켜보다 바뀌면 바로 다시 그림
  const dlgIn = () => typeof document !== 'undefined' && !!document.querySelector('fieldset.plain-fieldset dialog[open]');
  const [, setTick] = useState(0);
  const seenDlg = useRef(false); seenDlg.current = !!stale && dlgIn();
  const locked = !!stale && !seenDlg.current;
  useEffect(() => {
    const el = stale && typeof MutationObserver !== 'undefined' ? document.querySelector('fieldset.plain-fieldset') : null;
    if (!el) return undefined;
    const check = () => { if (dlgIn() !== seenDlg.current) setTick((n) => n + 1); };
    const mo = new MutationObserver(check);
    mo.observe(el, { subtree: true, childList: true, attributes: true, attributeFilter: ['open'] });
    check(); // 그린 때와 지켜보기 시작한 때 사이에 바뀐 것
    return () => mo.disconnect();
  }, [stale]);
  const staleNow = useRef(false); staleNow.current = !!stale; // 기다린 뒤에 다시 볼 때(guard의 after)
  const alive = useRef(true); useEffect(() => () => { alive.current = false; }, []);
  const [open, setOpen] = useState({}); // 체크리스트에서 [바꾸기]로 펼친 줄
  const [fontNote, setFontNote] = useState(''); // 글꼴을 사이트에 담지 못했을 때 한 줄
  const [info, setInfoSrv] = useState(null); // 바로 배포 서버의 /api/info(보관 기간·하루 한도)
  const [records, setRecords] = useState(null); // 바로 배포한 사이트의 참여 기록 수
  const [room, setRoom] = useState(''); // 지난 기록을 어떻게 할지: 'fresh'(비우고 배포) | 'keep'(그대로) | ''(아직)
  const [askRoom, setAskRoom] = useState(null); // 고르지 않고 다시 배포할 때 확인
  const [goAgain, setGoAgain] = useState(0); // 확인 창에서 고른 뒤 다시 배포(고른 값이 반영된 다음 그림의 배포 함수로)
  const [askMain, setAskMain] = useState(''); // 참여 기능이 없는 곳을 대표 주소로 바꿀 때 확인
  const builtLive = useRef(null); // 이번에 배포한 사이트에 참여 기능이 들어갔는지(배포한 곳마다 적어 둠)
  const leftOut = useRef(null); // 이번에 만든 사이트에서 커서 뺀 교재 원본 { to: 배포할 곳, list: [{ name, size, full }] }(배포가 끝나면 그곳의 기록에 남겨 완료 카드가 알림)
  const [matNums, setMatNums] = useState([]); // 사이트에 놓인 교재 쪽 그림 번호(뺀 원본을 '교재 슬라이드에서 모든 쪽을 볼 수 있어요'라고 말해도 되는지 볼 때)
  useEffect(() => { let off = false; blobs.keys(p.id).then((ks) => { if (!off) setMatNums(ks.filter((k) => k.startsWith('site/material/')).map(numOf).filter(Boolean)); }, () => { }); return () => { off = true; }; }, [p.id, p.site]);
  const toggle = (k) => setOpen((o) => ({ ...o, [k]: !o[k] }));
  const built = useRef(''); const again = useRef(null); const goNow = useRef(null);
  // 배포할 곳 칸이 화면에 보이는지: 보이면 맨 위 [배포하기]는 강조하지 않음(그 칸의 버튼이 누를 곳), 안 보이면 그 칸으로 데려가는 길이라 강조
  const [hostSeen, setHostSeen] = useState(false);
  useEffect(() => {
    const el = document.querySelector('.publish .btn-primary.btn-lg') || document.querySelector('.publish'); if (!el || typeof IntersectionObserver !== 'function') return undefined;
    const io = new IntersectionObserver(([e]) => setHostSeen(e.isIntersecting)); io.observe(el); return () => io.disconnect();
  });
  useEffect(() => { instantInfo().then((i) => { setAutoLive(!!i?.live?.url); setInfoSrv(i || null); }); }, []);
  const lecSite = p.deploy?.target === 'lecpage' ? p.deploy?.lecpage : null;
  // recWait: 지난 기록을 받는 중인 약속(답이 오면 null). 받는 중에 [다시 배포하기]를 누르면 guard가 이 답을 기다렸다가 정함
  const recWait = useRef(null); const recAsk = useRef(false);
  useEffect(() => {
    setRecords(null); setRoom('');
    if (!lecSite?.id) { recWait.current = null; return; }
    const w = instantRecords(lecSite).then((r) => { if (recWait.current === w) { recWait.current = null; setRecords(r); } return r; });
    recWait.current = w;
  }, [lecSite?.id, bp?.live?.code]);
  useEffect(() => { const pt = ensureCode(p); if (pt) update(pt); }, []); // 참여 기능 방 코드(처음 한 번)
  useEffect(() => { if (goAgain) (goNow.current || again.current)?.(); }, [goAgain]);
  // 고치기 화면의 [다시 배포하기]로 왔으면: 지난번 곳이 연결돼 있는 대로 바로 배포함(연결·바로 배포 서버 답을 읽는 동안 9초까지 기다림).
  // 배포할 곳 칸(Publish.jsx)이 서버 답을 8초까지 기다리므로 그보다 길게: 6초였을 때는 답이 늦는 망(내 계정에 배포한 연수)에서 기다리다 그만두고 화면만 내려갔음
  useEffect(() => {
    let id = ''; try { id = sessionStorage.getItem('lecpage:republish') || ''; sessionStorage.removeItem('lecpage:republish'); } catch { }
    if (id !== p.id) return;
    let n = 0; const t = setInterval(() => { if (again.current) { clearInterval(t); again.current(); } else if (++n > 90) { clearInterval(t); document.querySelector('.publish')?.scrollIntoView({ block: 'center' }); } }, 100);
    return () => clearInterval(t);
  }, []);
  // 연수 장소 확인(배포 전): 바로 배포면 그날 몫을 미리(상태 API 한 번). 배포 뒤에는 완료 카드의 '연수 전날 점검'이 접속 확인 QR·달력 일정을 줌
  const instantHere = target === 'lecpage' || (!target && autoLive);
  const [daySt] = useDayStatus({ on: !!bp && instantHere && !p.deploy?.lastUrl, date: bp?.meta?.date || '', site: '' });
  const cfWay = useCfWay(); // 훅은 아래 이른 return보다 앞에(뒤에 두면 훅 순서가 화면마다 달라짐)
  if (!bp || !isV2(p)) return <><StepHead title="배포하기" /><Notice>AI가 사이트를 다 만든 뒤에 배포할 수 있어요.</Notice><div><button class="btn btn-primary" onClick={() => go(1)}>교재 넣고 AI 선택</button></div></>;
  const access = bp.access?.mode || 'link';
  const liveOn = (bp.live?.features || []).length > 0;
  const exp = (target === 'lecpage' || (!target && autoLive) || p.deploy?.target === 'lecpage') ? lecExpiry(p, info) : null;
  const old = p.deploy?.lastUrl ? oldRecords(p, records) : null;
  // 새 연수(새 코드)로: 복제하면 새 주소·새 QR, 기록도 따로
  const dupNew = () => duplicateProject(p).then((n) => { toast('복제했어요. 새 연수로 배포해요.'); location.hash = `#/p/${n.id}/3`; }, () => toast('복제하지 못했어요. 설정에서 저장 공간을 확인해 주세요.'));
  // 바로 배포 서버의 방은 바로 배포한 사이트에서만 열림: 다른 곳에 배포할 때는 '연결 전'으로 봄(그대로 넣으면 질문·투표·출석이 보내지지 않음)
  const lecOnly = lecOnlyLive(bp.live, info?.live?.url);
  // 이 컴퓨터(localhost)에서 켠 서버는 참가자 기기에서 닿지 않음: 파일로 받는 ZIP(교실 노트북) 말고는 '연결 전'으로
  const loopLive = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(bp.live?.url || '');
  const liveReady = LIVE_READY(bp.live, p.liveOk) && !(lecOnly && target !== 'lecpage') && !(loopLive && !!target && target !== 'zip');
  const setAccess = (mode) => update((cur) => ({ ...patchDeploy(cur, (b) => ({ ...b, access: { mode } })), sitePassword: mode === 'password' && !cur.sitePassword ? friendlyPassword() : cur.sitePassword }));

  /** 배포할 사이트 파일: AI가 만든 사이트(+교재 쪽 그림·올린 사진)를 연수 정보·배포 설정과 함께 조립(엔진 assemble) */
  async function buildFiles({ liveOff = false, live = null, processor = null, dry = false, target: to = '', view = '', plain = false } = {}) {
    const b = JSON.parse(JSON.stringify(bp));
    if (!dry) built.current = b.meta?.shortUrl || ''; // 이번에 만든 사이트에 들어간 짧은 주소(배포한 뒤 달라지면 다시 배포하라고 알림)
    let privacy = b.privacy && Object.keys(b.privacy).length ? b.privacy : null;
    // 바로 배포 서버의 방은 다른 곳에 올린 사이트에서 쓸 수 없음 → 그곳에는 참여 기능을 빼고 올림(눌러도 보내지지 않는 버튼이 남지 않게)
    const lecElsewhere = !live && !!to && to !== 'lecpage' && lecOnlyLive(b.live, info?.live?.url);
    if (lecElsewhere) liveOff = true;
    if (live) { // 바로 배포: 참여 기능을 배포 서버가 맡음 → 개인정보 안내에 그 서버를 적음
      b.live = { ...b.live, ...live };
      if (processor && !(privacy?.processors || []).length) privacy = { ...(privacy || {}), processors: [processor] };
    } else if (liveOff || !liveReady) b.live = { ...b.live, provider: liveOff ? 'none' : b.live.provider };
    if (!dry) builtLive.current = (b.live?.features || []).length > 0 && !liveOff && (!!live || LIVE_READY(b.live, p.liveOk));
    let extra = {}; let materials = [];
    // 올릴 곳의 한도에 걸리는 원본('교재 원본 다운로드 허용'으로 넣는 것)은 사이트에 넣지 않고 배포함(크기 때문에 배포가 실패하지 않게. 교재 쪽 그림·사이트 파일은 빼지 않음).
    // 바로 배포는 서버가 알려 준 한도(파일 하나·사이트 전체), 내 계정에 배포할 곳은 그곳의 파일 하나 한도(hostFileLimit: Cloudflare 25MB·GitHub Pages 100MB·Vercel 100MB)만 봄
    const lim = to === 'lecpage' ? (info || await instantInfo())?.limits || null : hostFileLimit(to);
    let orig = []; let left = [];
    if (p.shareOriginals) { // 교재 원본도 내려받게: 자료실(키트 materials)이 이 목록을 보여 줌(사이트의 files/)
      // 원본만 하나씩 읽음(연수의 파일을 통째로 읽지 않음). 파일 한도를 넘는 것으로 적혀 있는 원본은 읽지도 않고 뺌(수백 MB를 메모리에 올리지 않게)
      for (const f of p.files || []) {
        if (!f.key) continue;
        if (lim?.maxFileBytes && f.size > lim.maxFileBytes) { left.push({ name: f.name, size: f.size, row: f }); continue; }
        let data = await blobs.get(p.id, f.key);
        if (data instanceof Blob) data = new Uint8Array(await data.arrayBuffer()); // 큰 원본은 저장소에 Blob으로 들어 있음(db.js)
        if (data) orig.push({ name: f.name, path: 'files/' + f.key.slice(4), size: data.length || 0, data, row: f });
      }
      if (lim) { const fit = fitOriginals(orig, 0, lim); orig = fit.keep; left = [...left, ...fit.left]; }
    }
    const put = () => { extra = {}; materials = []; for (const o of orig) { extra[o.path] = o.data; materials.push({ title: o.name, href: o.path, size: o.size }); } };
    put();
    const { features } = p.meta || {};
    const meta = { ...(p.meta || {}), features: liveOff ? (features || []).filter((f) => !LIVE_KEYS.includes(f)) : features || [] };
    // 올리는 곳(바로 배포·Vercel·GitHub·Netlify·Cloudflare)에는 대표 주소를 박지 않음: 사이트가 열린 자기 주소로 QR·발표 화면·QR 안내문을 그림
    // (박아 두면 보관 기간이 끝나 새 주소로 다시 배포했거나 다른 곳에 올린 사이트의 QR이 옛 주소·다른 곳을 가리킴). 파일로 받는 ZIP만 대표 주소를 넣음
    const hostedTo = !!to && to !== 'zip';
    // 강사 값(참여 기능 방·주소·공개 범위·개인정보)은 조립의 prev로만 넘김(엔진 readMeta 규칙: meta 안의 강사 칸은 버림)
    const prev = { live: { provider: b.live.provider, url: b.live.url, anonKey: b.live.anonKey, code: b.live.code, ...(typeof b.live.uploads === 'boolean' ? { uploads: b.live.uploads } : {}) }, siteUrl: hostedTo ? '' : b.meta.siteUrl || '', shortUrl: hostedTo && to !== p.deploy?.target ? '' : b.meta.shortUrl || '', joinUrl: p.meta?.joinUrl || '', surveyUrl: p.meta?.surveyUrl || '', access: b.access?.mode || 'link', ...(privacy ? { privacy } : {}) };
    const build = () => assembleProject(p, { meta, target: to === 'zip' || !to ? 'zip' : 'hosted', prev, extra, materials, host: hostedTo ? to : '' });
    let r = await build();
    // 원본을 넣었더니 사이트 전체 한도를 넘으면: 남은 원본을 큰 것부터 빼고 다시 조립(글꼴·잠금에 쓸 여유 4MB)
    if (lim?.maxBytes && orig.length && r.files?.['index.html']) {
      const total = siteStat(r.files).bytes + 4 * 1024 * 1024;
      if (total > lim.maxBytes) {
        const fit = fitOriginals(orig, total - orig.reduce((n, o) => n + o.size, 0), lim);
        if (fit.left.length) { left = [...left, ...fit.left]; orig = fit.keep; put(); r = await build(); }
      }
    }
    if (!dry) {
      // 뺀 원본마다: 그 교재의 모든 쪽을 사이트의 교재 슬라이드에서 볼 수 있는지(full) — 지금 조립한 사이트에 놓인 쪽 그림으로 확인해 적어 둠
      const cover = left.length ? coverOf(p, Object.keys(r.files || {}).filter((k) => k.startsWith('material/')).map(numOf).filter(Boolean)) : null;
      leftOut.current = { to, list: left.map((o) => ({ name: o.name, size: o.size, full: cover(o.row) })) };
    }
    if (!r.files?.['index.html']) throw new Error((r.errors || []).map((e) => e.message_ko).join(' ') || '사이트를 조립하지 못했어요. 새로 고침한 뒤 다시 눌러 주세요.');
    let files = r.files;
    if (!dry && to) { setProg({ step: '글꼴 담는 중', pct: 3 }); const f = await withFonts(files, { target: to, view }); files = f.files; setFontNote(f.note); }
    // plain: USB(파일)·내부망 http 서버에서 쓸 ZIP — 그런 곳에서는 잠금을 풀 수 없어 잠그지 않고 조립(강사가 [잠그지 않은 ZIP 다운로드]를 누른 때만)
    if (b.access?.mode === 'password' && !plain) {
      if (!p.sitePassword || [...p.sitePassword].length < 4) throw new Error('암호를 4자 이상 정해 주세요.');
      setProg({ step: '내용 잠그는 중', pct: 5 });
      files = await E.protectSite(files, p.sitePassword, { runtime: await loadRuntime(), title: b.meta.title });
    }
    return { files, meta };
  }
  /** 참여 기능이 켜져 있는데 연결 전이면 먼저 물어봄. [참여 기능 없이 배포]를 골랐으면 묻지 않고 참여 기능 없이. kind 'zip': 사이트 ZIP 다운로드 */
  function guard(run, auto = false, kind = '') {
    // 다른 탭에서 이 연수를 고쳐 이 탭이 저장을 멈춘 동안(Project.jsx의 빨간 띠)에는 배포하지 않음: 배포한 주소와 수정 키를 저장하지 못해,
    // 새로 고치면 그 사이트를 다시 배포하거나 취소할 길이 없어짐(주소만 열린 채 남음). 사이트 ZIP 다운로드는 저장할 것이 없어 여기서는 막지 않지만, 화면의 배포 칸은 통째로 잠겨 있어 [다시 불러오기] 뒤에 받음
    if (stale && kind !== 'zip') { toast('다른 탭에서 이 연수를 고쳤어요. [이 탭으로 다시 불러오기]를 누른 뒤 배포해 주세요.'); return; }
    // 지난 기록을 어떻게 할지 고르지 않고 다시 배포하면 먼저 물음(지우지는 않음). 사이트 ZIP 다운로드는 바로 배포의 기록과 상관없어 묻지 않고 바로 받음
    // (기록은 바로 배포 서버의 방에 있고, 그 방은 바로 배포한 사이트 주소에서만 열림)
    const mayAsk = !room && kind !== 'zip' && target === 'lecpage'; // 지난 기록은 바로 배포 방에만 있음(다른 곳에 배포할 때는 묻지 않음)
    // 기록 수를 아직 받는 중(화면을 연 직후·고치기 화면의 [다시 배포하기]로 바로 온 때): 답을 기다렸다가 정함. 기다리지 않으면 누른 때에 따라 물음이 뜨기도, 안 뜨기도 함(늦어도 5초)
    const w = recWait.current;
    if (w && mayAsk && p.deploy?.lastUrl) {
      if (recAsk.current) return; recAsk.current = true;
      // 기다리는 동안 '배포하는 중'으로 잠금: 그 사이 다른 곳 배포나 ZIP 다운로드를 시작하면 기다리던 배포가 뒤따라 함께 돌아 진행 줄·잠금이 서로를 지움.
      // 답이 오든 5초가 지나든(받기가 실패해도) 반드시 풂. 이어서 배포하면 그 배포가 다시 잠금
      setBusy(target); setProg({ step: '지난 기록을 확인하는 중', pct: 1 });
      const after = (r) => {
        recAsk.current = false; setProg(null); setBusy('');
        // 기다리는 사이 다른 탭이 저장했으면 여기서 그만둠(맨 위의 확인은 누른 때 한 번뿐)
        if (staleNow.current) { toast('다른 탭에서 이 연수를 고쳤어요. [이 탭으로 다시 불러오기]를 누른 뒤 배포해 주세요.'); return; }
        if (r && oldRecords(p, r)) setAskRoom(true); else pass(run, auto);
      };
      Promise.race([w, new Promise((ok) => setTimeout(() => ok(null), 5000))]).then(after, () => after(null));
      return;
    }
    if (old && mayAsk) { setAskRoom(true); return; }
    pass(run, auto);
  }
  function pass(run, auto) {
    if (liveOn && !liveReady && !auto && !skipLive) setAsk(() => run); else run(liveOn && !liveReady && !auto && skipLive ? { liveOff: true } : {});
  }
  const feats = featuresOf(p).filter((f) => LIVE_KEYS.includes(f));
  // 칩을 누르면 그 줄은 펼친 채로(켜자마자 접혀 나머지 칩이 사라지지 않게). 사이트에 자리가 있는 기능은 여기서 끌 수 없어 알려 줌
  const toggleFeat = (v) => {
    setOpen((o) => ({ ...o, live: true }));
    if (siteFeatures(p.site).includes(v)) { toast(`사이트에 ${FEATURES.find((x) => x.value === v)?.label || '이 기능'} 자리가 있어 켜 두었어요. 빼려면 AI로 수정에서 요청해 주세요.`); return; }
    update((cur) => toggleFeature(cur, v));
  };
  // [참여 기능 연결]: 연결 칸을 펼치고 그 칸으로 화면과 초점을 함께 옮김(화면만 올라가고 초점은 누른 버튼에 남지 않게)
  const goLive = () => { setOpen((o) => ({ ...o, live: true })); setTimeout(() => { const li = document.getElementById('live-setup'); li?.scrollIntoView({ block: 'start', behavior: 'smooth' }); (li?.querySelector('.live-way-reco, .live-way-h') || li?.querySelector('.ready-t'))?.focus({ preventScroll: true }); }, 80); };
  async function zip(opts = {}) {
    setBusy('zip');
    try { const r = await buildFiles({ target: 'zip', ...opts }); saveFile(safeName(p.title) + (opts.plain ? '_잠금없음' : '') + '.zip', E.zipFiles(r.files), 'application/zip'); toast(opts.plain ? '잠그지 않은 ZIP을 다운로드했어요.' : '사이트 파일(ZIP)을 다운로드했어요.'); }
    catch (e) { toast(e.message); }
    setBusy(''); setProg(null);
  }
  /** 강사용 파일 묶음: 운영 안내(HTML), 연수 정보(lecpage.json), 사이트 원본(다시 고치거나 AI에게 줄 때), 인쇄본. 사이트에는 넣지 않음 */
  async function teacherDoc() {
    try {
      const m = p.meta || {};
      const when = whenText(bp.meta);
      const live = (bp.live?.features || []).length > 0;
      const guide = [`# ${m.title || p.title} 운영 안내`, [when, m.venue].filter(Boolean).join(' · '),
        '## 연수 전날', '- 연수 장소의 Wi-Fi로 사이트와 접속 확인 쪽(check.html)을 열어 봐요.\n- QR 안내문(poster.html)을 인쇄해요.',
        '## 연수 당일', `- 발표 화면(screen.html)을 띄우면 참가자가 QR로 들어와요.${live ? '\n- 강사 화면(console.html)에서 투표를 열고 질문·도움 요청을 봐요.' : ''}`,
        '## 연수 뒤', '- 같은 주소가 다시 보기 자리가 돼요. 고친 뒤 다시 배포하면 같은 주소에 반영돼요.'].join('\n\n');
      const files = { '운영안내.html': mdToHtml(guide, p.title), 'lecpage.json': JSON.stringify({ ...m, live: undefined }, null, 2) };
      for (const [k, v] of Object.entries(p.site || {})) files['사이트원본/' + k] = v;
      // 연수 당일 대비: 인터넷이 안 될 때 나눠 줄 인쇄본, 배포했으면 '혹시 안 열리면' 한 장(두 번째 주소·휴대폰 데이터·USB)
      files['실습프롬프트모음.html'] = printSiteHtml(p);
      const url = p.deploy?.lastUrl;
      if (url) {
        const pw = bp.access?.mode === 'password' ? p.sitePassword : '';
        files['혹시안열리면.html'] = kitHtml({ title: p.title, siteUrl: url, shareUrl: pw ? E.unlockUrl(url.replace(/\/?$/, '/'), pw) : '', altUrl: p.deploy?.target === 'lecpage' ? p.deploy?.lecpage?.altUrl || '' : '', second: p.deploy?.second || '', live, zipName: safeName(p.title) + (pw ? '_잠금없음' : '') + '.zip', locked: !!pw });
      }
      saveFile(safeName(p.title) + '_강사용.zip', E.zipFiles(files), 'application/zip');
      toast('강사용 파일을 다운로드했어요.');
    } catch (e) { toast(e.message); }
  }
  function done(url, patch, more) {
    setRoom('');
    // 배포가 끝나면 결과(완료 카드의 제목)로 초점을 옮김: 누른 버튼은 잠겼다 풀리며 초점을 잃음
    if (url) setTimeout(() => document.getElementById('done-h')?.focus({ preventScroll: true }), 120);
    // 주소가 바뀌면(다른 곳에 올림·내림) 예전 짧은 주소는 옛 사이트를 가리키므로 지움
    // 대표 주소(lastUrl)는 여러 곳에 배포한 기록(sites)을 합쳐 정함: 다른 곳에 다시 배포해도 대표는 그대로, 새로 배포한 곳은 대표가 됨
    // 참여 기능이 들어간 대표 주소가 있는데 새로 배포한 곳에는 참여 기능이 없으면 대표 주소는 그대로(QR·강사 화면이 참여 기능 없는 곳을 가리키지 않게)
    const to = patch?.target || p.deploy?.target || '';
    const siteLive = url ? builtLive.current : null; builtLive.current = null;
    const keepMain = siteLive === false && !!p.deploy?.lastUrl && p.deploy?.target !== to && siteHasLive(p.deploy);
    const lock = url ? { mode: bp.access?.mode || 'link', pw: bp.access?.mode === 'password' ? p.sitePassword || '' : '' } : null;
    // 커서 사이트에 넣지 않은 교재 원본: 그곳에 이번에 배포한 사이트의 것으로 갈아 끼움(없으면 지움). 배포한 곳의 기록(sites[곳].left)에 두고 완료 카드가 한 줄로 알림.
    // 사이트를 새로 만들지 않고 주소만 다시 저장할 때(leftBuilt 없음)는 그곳에 적어 둔 것을 그대로 둠
    const leftBuilt = url && leftOut.current?.to === to ? leftOut.current.list : null; leftOut.current = null;
    const withLeft = (cur, m) => {
      const lf = leftBuilt || (url ? cur.deploy?.sites?.[to]?.left : null);
      return lf?.length && m.sites[to] ? { ...m.sites, [to]: { ...m.sites[to], left: lf } } : m.sites;
    };
    const nx = mergeSite(p.deploy, url, to, { live: siteLive, keepMain, lock });
    const moved = !nx.lastUrl || (!!p.deploy?.lastUrl && same(nx.lastUrl) !== same(p.deploy.lastUrl));
    if (moved && bp.meta?.shortUrl) toast('사이트 주소가 바뀌어 짧은 주소를 지웠어요. 다시 만들어 주세요.');
    const result = (cur) => {
      const m = mergeSite(cur.deploy, url, patch?.target || cur.deploy?.target || '', { live: siteLive, keepMain, lock });
      return {
        pastDeploy: undefined, carryPending: undefined, // 이 기기에서 배포했으니 다른 기기에서 가져온 지난 배포 표시는 거둠
        deploy: { ...(cur.deploy || {}), ...patch, sites: withLeft(cur, m), lastUrl: m.lastUrl, target: m.target, at: m.at, shortLive: moved ? '' : built.current },
        ...patchDeploy(cur, (b) => ({ ...b, meta: { ...b.meta, siteUrl: m.lastUrl, ...(moved ? { shortUrl: '' } : {}) }, ...(more?.live ? { live: { ...b.live, ...more.live } } : {}) })),
        ...(more && 'liveOk' in more ? { liveOk: more.liveOk } : {}),
      };
    };
    update(result, { now: true }); // 배포·배포 취소의 결과(주소·사이트 열쇠)는 바로 저장: 곧바로 창이 닫히거나 죽어도 배포한 사이트를 다시 다룰 수 있게
    // 배포가 도는 사이(몇 초~1분) 다른 탭이 이 연수를 저장하면 이 탭은 저장을 멈춤(덮어쓰지 않게) → 위 저장이 버려져, 다시 불러오면 방금 배포한 주소·수정 키가 사라졌음.
    // 그때는 결과만 저장소의 지금 판(다른 탭이 고친 것) 위에 바로 얹음: 다른 탭의 고친 내용도, 이 배포 기록도 남음
    // (다른 탭에서 연수를 지웠으면 얹을 곳이 없어 아무것도 하지 않음. 충돌을 위 저장을 쓰다가 알게 되는 때도 있어 다 쓴 뒤에 한 번 더 봄 — 같은 결과를 두 번 얹어도 값이 같음)
    const keep = () => { if (stopped?.() === 'changed' && storeNow) storeNow(result).then((saved) => { if (saved && alive.current) toast('배포 기록을 저장했어요. 다른 탭에서 고친 내용은 [이 탭으로 다시 불러오기]로 이어서 봐요.'); }, () => { }); };
    // settle: 큰 연수·느린 기기는 저장이 몇 초 넘게 걸림 — 3초만 기다리는 idle로는 저장이 끝나기 전에 보고 지나쳐 기록을 잃었음
    if (stopped?.() === 'changed') keep(); else if (settle || idle) (settle || idle)().then(keep, () => { });
  }
  /** 참가자에게 알릴 대표 주소를 배포한 곳 가운데에서 바꿈: 완료 카드·QR·강사 화면·QR 안내문이 이 주소를 따름 */
  function setPrimary(t, sure = false) {
    // 저장이 멈춘 탭에서는 바꾸지 않음: 바꾼 값이 저장되지 않는데 '바꿨어요'만 뜨던 것(칸 밖의 확인 창에서 누를 수 있었음)
    if (staleNow.current) { setAskMain(''); toast('다른 탭에서 이 연수를 고쳤어요. [이 탭으로 다시 불러오기]를 누른 뒤 다시 해 주세요.'); return; }
    const s = p.deploy?.sites?.[t]; if (!s?.url || t === p.deploy?.target) return;
    if (!sure && s.live === false && liveOn && siteHasLive(p.deploy)) { setAskMain(t); return; } // 참여 기능 없는 곳으로 바꾸기 전에 확인
    update((cur) => ({
      deploy: { ...(cur.deploy || {}), lastUrl: s.url, target: t, at: s.at || Date.now(), shortLive: '' },
      ...patchDeploy(cur, (b) => ({ ...b, meta: { ...b.meta, siteUrl: s.url, shortUrl: '' } })),
    }));
    toast(`대표 주소를 ${SITE_LABEL[t] || t}로 바꿨어요. QR과 강사 화면이 이 주소를 따라요.${bp.meta?.shortUrl ? ' 예전 짧은 주소는 지웠어요.' : ''}`);
  }
  /** 완료 카드의 [다시 배포하기]: 지난번에 배포한 곳이 연결돼 있으면 바로 배포하고, 아니면 배포할 곳으로 내려감 */
  function republish() {
    if (busy) return;
    if (again.current) again.current();
    else document.querySelector('.publish')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  // 배포 준비 체크리스트: 참여 기능 → 공개 범위 → 확인할 곳 → 배포할 곳(+배포하기). 끝난 줄은 한 줄로 접히고 [바꾸기]로 펼침
  const names = feats.map((f) => FEATURES.find((x) => x.value === f)?.label || f);
  const featLine = names.length > 3 ? `${names.slice(0, 3).join('·')} 외 ${names.length - 3}개` : names.join('·');
  // 바로 배포의 참여 기능 방이 차서 넘긴 적이 있으면 참여 기능은 강사 계정으로 연결(서버가 준 순서: Cloudflare → Supabase)
  const liveOffHere = lecLiveOff(p);
  // 강사가 따로 연결해 둔 서버(시트·Supabase·내 서버)가 있으면 바로 배포에서도 그 서버를 씀(Publish.jsx Instant와 같은 규칙)
  const ownLive = instantLiveOk(bp.live, info) && !lecOnly;
  const autoHere = autoLive && target === 'lecpage' && !liveOffHere && !ownLive;
  // 바로 배포 서버가 지금 참여 기능 방을 새로 열 수 있는지(/api/info live.accepting·onlyBooked, Publish.jsx 카드와 같은 기준). 못 열면 '함께 켜져요'라고 하지 않음
  const autoOpen = instantLiveOpen(info, bp.meta?.date || '');
  const autoOffer = autoLive && autoOpen; // 다른 곳을 골랐을 때 '바로 배포로 바꾸면 연결 없이 켜져요'라고 권해도 되는지
  // Cloudflare에 lecpage 커넥트로 배포하면 참여 기능 서버도 내 계정에 함께 생김(Publish.jsx Cloudflare 카드와 같은 조건) → 따로 연결하라고 하지 않음
  const cfTogether = target === 'cloudflare' && cfWay.way === 'ready' && liveOn && !liveReady && !skipLive && !lecOnly && !p.demo;
  const liveState = !liveOn ? 'off' : autoHere ? 'auto' : liveReady ? 'ok' : skipLive ? 'skip' : p.demo ? 'demo' : cfTogether ? 'cf' : 'todo';
  // 이수 기준(출석 %)이 사이트에 있는데 출석이 꺼져 있으면 참가자가 출석할 길이 없음(AI 에이전트·교재에서 온 연수에 흔함)
  const official = bp.meta?.admin?.kind === 'official' && !feats.includes('attendance');
  const liveLine = { off: official ? `이수 기준(출석 ${bp.meta.admin.completionRate || 80}% 이상)이 사이트에 있는데 출석이 꺼져 있어요. [출석·이수 확인]을 켜 주세요.` : '꺼져 있어요. 질문·출석을 쓰려면 아래에서 켜요.', auto: p.deploy?.sites?.lecpage ? `${featLine} · 바로 배포한 사이트에서 켜져 있어요.` : autoOpen ? `${featLine} · 바로 배포하면 함께 켜져요.` : info?.live?.onlyBooked && !bp.meta?.date ? `${featLine} · 연수 날짜를 적으면 바로 배포할 때 함께 켜져요.` : `${featLine} · 지금은 바로 배포의 참여 기능 방을 새로 열 수 없어요. 사이트는 배포되고, 참여 기능은 내 계정에 연결하면 켜져요.`, ok: `${featLine} · ${liveName(bp.live?.provider, bp.live?.url) || LIVE_NAME[bp.live?.provider] || '서버'}에 연결돼 있어요.`, skip: '이번에는 참여 기능 없이 배포해요.', cf: `${featLine} · Cloudflare에 배포할 때 내 계정에 서버를 만들어 켜요.`, demo: `${featLine} · 체험에서는 연결하지 않아요.`, todo: lecOnly ? `${featLine} · 바로 배포한 사이트에서만 켜져 있어요.` : `${featLine} · ${target === 'zip' ? '사이트 파일(ZIP)로 직접 올리려면 연결해야 해요.' : target && target !== 'lecpage' ? `${SITE_LABEL[target] || target}에 배포하려면 연결해야 해요.` : '아직 연결 전이에요.'}` }[liveState];
  // 꺼져 있으면 고를 기능을 바로 보여 줌. 다른 곳에 배포할 때 연결 전이면 배포할 곳 바로 아래 안내가 할 일을 알려 주므로 이 줄은 접어 둠([연결]로 펼침)
  const elsewhere = !!target && target !== 'lecpage';
  const liveBody = open.live || liveState === 'off' || (liveState === 'todo' && !elsewhere);
  const ACCESS = { link: '주소를 받은 사람만', password: '암호를 아는 사람만', public: '누구나' };
  const originals = (p.files || []).some((f) => f.key && !f.photos && !f.errors?.length); // 자료실에 함께 올릴 교재 원본이 있음(교재 원본 다운로드는 여기 공개 범위에서만 정함)
  // 고른 곳의 파일 하나 한도(바로 배포는 서버가 알려 준 값, 내 계정에 배포할 곳은 hostFileLimit)를 넘는 원본: 사이트에 넣지 않고 배포하므로(buildFiles) 체크 옆에 미리 한 줄.
  // '교재 슬라이드에서 모든 쪽을 볼 수 있어요'는 그 원본마다 사실일 때만(coverOf)
  const fileCap = target === 'lecpage' ? info?.limits?.maxFileBytes || 0 : hostFileLimit(target)?.maxFileBytes || 0;
  const coverNow = coverOf(p, matNums);
  const bigOrig = p.shareOriginals && fileCap ? (p.files || []).filter((f) => f.key && f.size > fileCap).map((f) => ({ name: f.name, size: f.size, full: coverNow(f) })) : [];
  const needPw = access === 'password' && !p.sitePassword;
  const notes = checks(p, target === 'lecpage' || (!target && autoLive) ? exp : null); // 보관 기간 알림은 바로 배포에 배포할 때만
  const day = isPastDate(bp.meta?.date) ? null : dayLine(daySt, bp.meta?.date); // 지난 날짜는 '확인할 곳'에서 한 번만 알림
  const rows = [];
  // 다른 기기에서 저장한 파일로 연 연수: 그 파일에 배포 열쇠가 있으면 같은 주소에 이을지 고르고, 없으면 예전 주소와 새 주소가 생긴다는 사실만
  const past = !p.deploy?.lastUrl ? p.pastDeploy : null;
  if (past) {
    const left = past.expiresAt ? (past.expiresAt > Date.now() ? `${md(past.expiresAt)}까지 열려 있어요` : '보관 기간이 끝났어요') : '';
    const where = <><a href={past.url} target="_blank" rel="noopener">{showUrl(past.url)}</a>{left ? ` (${left})` : ''}</>;
    rows.push(p.carryPending
      ? { k: 'past', title: '지난 배포', state: 'todo', line: <>다른 기기에서 {where}에 배포한 연수예요.</>,
        body: <>
          <p class="small">이 파일에 그 사이트의 관리자 키가 들어 있어요. 내가 저장한 파일이면 같은 주소·같은 QR로 이어서 배포해요. 남에게 받은 파일이면 [새 주소로 배포]를 골라 주세요.</p>
          <div class="btn-row">
            <button type="button" class="btn btn-sm btn-primary" onClick={() => { update((cur) => carryPatch(cur)); toast('같은 주소로 배포할 수 있어요.'); }}>같은 주소로 배포</button>
            <button type="button" class="btn btn-sm" onClick={() => update({ carryPending: undefined })}>새 주소로 배포</button>
          </div>
        </> }
      : { k: 'past', title: '지난 배포', state: 'note', line: <>{where}에 배포돼 있었어요. 이 기기에는 그 사이트의 관리자 키가 없어 여기서 배포하면 새 주소가 생겨요.</>,
        btn: [open.past ? '접기' : '같은 주소로 하려면', () => toggle('past')],
        body: open.past && <p class="small">처음 배포한 기기에서 [파일로 저장]을 누르고 '내 다른 기기에서 같은 주소로 이어 배포하기'를 켜요. 그 파일을 여기서 열어 주세요. 새 주소로 배포하면 인쇄한 QR과 보낸 주소도 새것으로 바꿔야 해요.</p> });
  }
  rows.push({ k: 'live', id: 'live-setup', title: '참여 기능', state: liveState === 'todo' || (liveState === 'off' && official) ? 'todo' : liveState === 'off' || liveState === 'demo' ? 'note' : 'done', line: liveLine,
    btn: liveState === 'todo' ? (elsewhere ? [open.live ? '접기' : '연결', () => toggle('live')] : null) : liveState === 'off' ? null : liveState === 'skip' ? ['바꾸기', () => setSkipLive(false)] : [open.live ? '접기' : liveState === 'demo' ? '보기' : '바꾸기', () => toggle('live')],
    body: liveBody && <>
      <div class="chips feat-chips" role="group" aria-label="켤 참여 기능">
        {FEATURES.map((x) => <button type="button" class="chip" aria-pressed={String(feats.includes(x.value))} title={x.desc} onClick={() => toggleFeat(x.value)}>{x.label}</button>)}
      </div>
      {liveOn && !autoHere && <LiveSetup p={p} update={update} prefer={liveOffHere?.next} />}
      {liveOn && autoOffer && !autoHere && !liveOffHere && <p class="small muted">아래 배포할 곳을 바로 배포로 바꾸면 따로 연결하지 않아도 켜져요.</p>}
      {liveState === 'todo' && !elsewhere && <div class="btn-row"><button type="button" class="btn btn-sm btn-quiet" onClick={() => { setSkipLive(true); setOpen((o) => ({ ...o, live: false })); }}>참여 기능 없이 배포</button></div>}
    </> });
  rows.push({ k: 'access', title: '공개 범위', state: needPw ? 'todo' : 'done', line: `${ACCESS[access]}${p.shareOriginals && originals ? ' · 교재 원본도 다운로드' : ''}`,
    btn: needPw ? null : [open.access ? '접기' : '바꾸기', () => toggle('access')],
    body: (open.access || needPw) && <>
      <div class="radio-cards" role="radiogroup" aria-label="공개 범위">
        {[['link', '주소를 받은 사람만', '검색에 나오지 않아요. 주소나 QR을 받은 사람만 들어와요.'], ['password', '암호를 아는 사람만', '교재 그림까지 암호로 잠가요. 안내 QR로 들어오면 바로 열려요.'], // 바로 배포 서버는 모든 사이트를 검색에서 뺌(hosting: x-robots-tag noindex) → 그곳을 골랐을 때는 '검색에도 나와요'라고 하지 않음(2026-11-24 운영에서 확인)
          ['public', '누구나', instantHere ? '주소를 아는 누구나 열어요. 바로 배포한 사이트는 검색에는 나오지 않아요(검색에 나오게 하려면 다른 곳에 배포).' : '검색에도 나와요. 공개 강의 홍보용이에요.']].map(([v, t, d]) => (
          <label class="radio-card"><input type="radio" name="access" checked={access === v} onChange={() => setAccess(v)} /><span><b>{t}</b><small>{d}</small></span></label>
        ))}
      </div>
      {access === 'password' && (
        <div class="row" style={{ alignItems: 'end' }}>
          <Field label="암호(4자 이상, 길수록 안전해요)"><input type={showPw ? 'text' : 'password'} value={p.sitePassword || ''} onInput={(e) => update({ sitePassword: e.target.value })} autoComplete="new-password" /></Field>
          <button class="btn btn-sm btn-quiet" onClick={() => setShowPw(!showPw)}>{showPw ? '숨기기' : '표시'}</button>
          <button class="btn btn-sm" onClick={() => update({ sitePassword: friendlyPassword() })}>새로 만들기</button>
        </div>
      )}
      {access === 'password' && p.sitePassword && E.passwordAdvice(p.sitePassword).level !== 'good' && <p class="small" role="status">{E.passwordAdvice(p.sitePassword).message}</p>}
      {originals && <label class="check"><input type="checkbox" checked={!!p.shareOriginals} onChange={(e) => update({ shareOriginals: e.target.checked })} /><span>교재 원본 다운로드 허용 <span class="small muted">(넣은 교재 파일이 그대로 사이트 자료실에 담겨요. 저작권을 먼저 확인해 주세요)</span></span></label>}
      {originals && bigOrig.length > 0 && <p class="small muted left-note" role="status">{leftLine(bigOrig)}</p>}
    </> });
  const warns = notes.filter((c) => c.k === 'warn').length;
  // 꼭 볼 것(warn)이 있으면 펼쳐 두고, 참고만 있으면 한 줄로 접어 둠([보기]로 펼침): 좁은 화면에서 누를 버튼이 멀어지지 않게
  const notesOpen = open.notes ?? warns > 0;
  if (notes.length) rows.push({ k: 'notes', title: '확인할 곳', state: warns ? 'todo' : 'note', line: warns ? `${notes.length}곳 · ${p.deploy?.lastUrl ? '다시 배포하기 전에' : '배포 전에'} 확인해 주세요.` : `${notes.length}곳`,
    btn: [notesOpen ? '접기' : '보기', () => setOpen((o) => ({ ...o, notes: !notesOpen }))],
    body: notesOpen && <ul class="warnings">{notes.map((c) => <li class={c.k === 'warn' ? 'is-warn' : ''}>· {c.t}{c.go && <> <button class="btn btn-sm btn-quiet" onClick={() => go(c.go)}>확인하러 가기</button></>}</li>)}</ul> });
  if (!p.deploy?.lastUrl) rows.push({ k: 'venue', title: '연수 장소 확인', state: day?.k === 'full' ? 'todo' : 'note', line: day && day.k !== 'ok' ? '' : '배포한 뒤 연수 전날, 그곳 Wi-Fi로 열리는지 확인해요.',
    btn: day && day.k !== 'ok' ? null : [open.venue ? '접기' : '보기', () => toggle('venue')],
    body: (open.venue || (day && day.k !== 'ok')) && <VenueBody p={p} url="" instantOn={instantHere} /> });
  if (old && target === 'lecpage') rows.push({ k: 'room', title: '지난 기록', state: room ? 'done' : 'todo',
    line: room === 'fresh' ? '비우고 배포해요. 주소·QR·관리자 키는 그대로예요.' : room === 'keep' ? '그대로 두고 배포해요.' : `${old.when}까지 남긴 기록(${old.line})이 그대로 있어요. 다시 배포해도 새 참가자에게 보여요.`,
    btn: room ? ['바꾸기', () => setRoom('')] : null,
    body: !room && <>
      <p class="small">필요한 기록은 먼저 강사 화면에서 CSV로 받아 두세요. 비우면 되돌릴 수 없어요.</p>
      <div class="btn-row">
        <button type="button" class="btn btn-sm" onClick={() => setRoom('fresh')}>기록 비우고 배포</button>
        <button type="button" class="btn btn-sm" onClick={() => setRoom('keep')}>그대로 두기</button>
        <button type="button" class="btn btn-sm btn-quiet" onClick={dupNew}>새 연수로 복제</button>
        {lecSite?.adminKey && <a class="btn btn-sm btn-quiet" href={String(p.deploy.lastUrl).replace(/\/?$/, '/') + 'console.html'} target="_blank" rel="noopener" onClick={() => copy(lecSite.adminKey, '관리자 키를 복사했어요. 강사 화면에 붙여 넣으세요.')}>강사 화면 열기</a>}
      </div>
      <p class="small muted">복제하면 새 주소·새 QR로 따로 배포해요.</p>
    </> });
  rows.push({ k: 'host', title: '배포할 곳', state: 'go', line: '',
    body: <>
      {p.demo ? <p class="small muted">실제로는 여기서 배포할 곳을 골라요. 바로 배포는 가입·토큰이 없어요.</p>
        : <Publish p={p} busy={busy} setBusy={setBusy} prog={prog} setProg={setProg} buildFiles={buildFiles} guard={guard} done={done} zip={zip} again={again} goNow={goNow} onTarget={setTarget} records={records} freshRoom={room === 'fresh'}
          onTry={(t) => update((cur) => ({ deploy: { ...(cur.deploy || {}), lecpageTry: t || null } }))}
          liveNote={liveOn && !p.demo ? { need: !liveReady && !skipLive, skip: !liveReady && skipLive, lecOnly, feats: featLine, onConnect: goLive, onSkip: () => setSkipLive(true), onUnskip: () => setSkipLive(false) } : null} />}
    </> });

  /** 배포할 곳 칸으로 내려가 지금 누를 버튼(주 버튼)을 잠깐 강조 */
  const toNext = () => {
    const box = document.querySelector('.publish, .demo-pub'); if (!box) return;
    box.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const b = box.querySelector('.btn-primary:not([disabled])'); if (!b) return;
    b.classList.add('nudge'); b.focus({ preventScroll: true }); setTimeout(() => b.classList.remove('nudge'), 2600);
  };
  return (
    <>
      <StepHead title="배포하기" desc={p.deploy?.lastUrl ? '고친 내용은 [다시 배포하기]를 누르면 같은 주소에 반영돼요.' : (p.demo ? '아래 순서대로 확인하고 [배포 연습하기]를 누르면 참가자에게 보낼 주소와 QR이 나와요.' : '아래 순서대로 확인하고 맨 아래 버튼을 누르면 참가자에게 보낼 주소와 QR이 나와요.')}>
        {/* 체크리스트가 다 끝났으면 맨 위에도 같은 단추(1366×768에서 아래 단추가 첫 화면 밖) */}
        {!p.demo && !p.deploy?.lastUrl && !rows.some((r) => r.state === 'todo') && <button class={`btn${!hostSeen ? ' btn-primary' : ''}`} disabled={!!busy || !!stale} onClick={() => (goNow.current ? goNow.current() : toNext())}>배포하기</button>}
      </StepHead>
      {/* 다른 탭에서 이 연수를 고쳐 이 탭이 저장을 멈춘 동안: 이 화면의 단추를 모두 잠금(배포·배포 취소·주소 저장의 결과를 적지 못함). 누를 곳은 위 빨간 띠의 [이 탭으로 다시 불러오기] 하나 */}
      {stale && <p class="small warn-line" role="status" data-stale-note>다른 탭에서 이 연수를 고쳤어요. [이 탭으로 다시 불러오기]를 누르면 여기서 이어서 배포할 수 있어요.</p>}
      <fieldset class="plain-fieldset" disabled={locked} inert={locked}>{/* inert: 단추처럼 보이는 링크(새 구글 시트 열기 등)도 함께 잠금 */}
      {p.demo && <DemoPublish p={p} buildFiles={buildFiles} />}
      {p.deploy?.lastUrl && <Success p={p} bp={bp} update={update} onEdit={() => go(2)} onRepublish={republish} onPrimary={setPrimary} busy={busy} onZip={(x) => guard((o) => zip(x && x.plain === true ? { ...o, plain: true } : o), false, 'zip')} instantOn={!!autoLive || p.deploy?.target === 'lecpage'} fontNote={fontNote} exp={exp} days={info?.limits?.days} />}

      <Sheet>
        <div class="stack">
          <h2 class="h-sub" id="pub-h" tabIndex={-1}>{p.deploy?.lastUrl ? '다시 배포 · 다른 곳에도 배포' : '배포 준비'}</h2>
          <ol class="ready" aria-label="배포 준비">
            {rows.map((r, i) => (
              <li class={`ready-i is-${r.state}`} id={r.id} key={r.k}>
                <div class="ready-h">
                  <span class="ready-n" aria-hidden="true">{r.state === 'done' ? '✓' : i + 1}</span>
                  <b class="ready-t">{r.title}</b>
                  {r.line && <span class="ready-s">{r.line}</span>}
                  {r.btn && <button type="button" class="btn btn-sm btn-quiet" aria-expanded={r.body ? 'true' : 'false'} onClick={r.btn[1]}>{r.btn[0]}</button>}
                </div>
                {r.body && <div class="ready-b">{r.body}</div>}
              </li>
            ))}
          </ol>
          <p class="small muted">배포한 내용은 <a href="#/help/terms">이용약관</a>에 따라 배포한 분이 책임져요. 교재의 저작권과 개인정보를 확인해 주세요.</p>
          {!p.demo && <div class="btn-row"><button class="btn btn-sm" onClick={teacherDoc}>강사용 파일 다운로드</button><span class="small muted">운영 안내·연수 정보·사이트 원본·인쇄본. 사이트에는 올라가지 않아요.</span></div>}
        </div>
      </Sheet>
      </fieldset>
      <div class="step-foot"><button class="btn btn-quiet" onClick={() => go(2)}>이전</button><a class="btn" href="#/">처음으로</a></div>

      <Dialog open={!!askRoom} onClose={() => setAskRoom(null)} label="지난 기록 확인">
        <h2 class="h-sub">지난 기록이 남아 있어요</h2>
        <p>{old ? `${old.when}까지 남긴 기록(${old.line})이 있어요. ` : ''}그대로 배포하면 새 참가자에게도 지난 질문·보드 글이 보여요. 필요한 기록은 먼저 강사 화면에서 CSV로 받아 두세요.</p>
        <div class="btn-row">
          <button class="btn btn-primary" onClick={() => { setAskRoom(null); setRoom('fresh'); setGoAgain((n) => n + 1); }}>기록 비우고 배포</button>
          <button class="btn" onClick={() => { setAskRoom(null); setRoom('keep'); setGoAgain((n) => n + 1); }}>그대로 두고 배포</button>
          <button class="btn btn-quiet" data-autofocus onClick={() => setAskRoom(null)}>닫기</button>
        </div>
      </Dialog>
      <Dialog open={!!ask} onClose={() => setAsk(null)} label="참여 기능 확인">
        <h2 class="h-sub">{lecOnly ? `${target === 'zip' ? 'ZIP' : SITE_LABEL[target] || '이곳'} 사이트에서는 참여 기능이 꺼져요` : '참여 기능이 아직 연결되지 않았어요'}</h2>
        <p>{lecOnly ? '참여 기능은 바로 배포한 사이트에서만 돼요. 참가자에게는 지금처럼 바로 배포 주소를 알려 주세요.'
          : '이대로 배포하면 질문·투표·출석이 모이지 않아요.'}{autoOffer && elsewhere && !lecOnly ? ' 바로 배포는 연결 없이 바로 쓸 수 있어요.' : ''}</p>
        <div class="btn-row">
          {autoOffer && elsewhere && !lecOnly && <button class="btn btn-primary" onClick={() => { setAsk(null); window.dispatchEvent(new CustomEvent('lp-pub-pick', { detail: 'lecpage' })); }}>바로 배포로 바꾸기</button>}
          <button class={`btn${autoOffer && elsewhere && !lecOnly ? '' : ' btn-primary'}`} onClick={() => { setAsk(null); goLive(); }}>참여 기능 연결</button>
          <button class="btn btn-quiet" onClick={() => { const run = ask; setAsk(null); if (staleNow.current) { toast('다른 탭에서 이 연수를 고쳤어요. [이 탭으로 다시 불러오기]를 누른 뒤 배포해 주세요.'); return; } setSkipLive(true); run({ liveOff: true }); }}>참여 기능 없이 배포</button>
        </div>
      </Dialog>
      <Dialog open={!!askMain} onClose={() => setAskMain('')} label="대표 주소 확인">
        <h2 class="h-sub">이 주소에는 참여 기능이 없어요</h2>
        <p>이 주소를 대표로 쓰면 QR과 강사 화면이 이 주소를 가리켜서, 참가자가 질문·투표·출석을 할 수 없어요.</p>
        <div class="btn-row">
          <button class="btn btn-primary" data-autofocus onClick={() => setAskMain('')}>그대로 두기</button>
          <button class="btn" onClick={() => { const t = askMain; setAskMain(''); setPrimary(t, true); }}>대표 주소로 쓰기</button>
        </div>
      </Dialog>
    </>
  );
}

/** 사람이 읽고 칠 수 있는 암호(낱말 셋 + 숫자 넷). 만드는 법은 엔진 하나(engine/src/protect.js) */
const friendlyPassword = () => E.friendlyPassword();

/** 배포한 주소가 참가자에게 실제로 열리는지 확인(GitHub Pages는 보통 1~2분, 길면 10분. 로그인 창이 걸려 있으면 열리지 않음) */
function OpenState({ url, at }) {
  const [st, setSt] = useState('wait');
  useEffect(() => {
    if (!/^https:/.test(url)) { setSt('skip'); return undefined; }
    let off = false, n = 0, timer = 0; setSt('wait');
    (async function tick() {
      const ok = await probeSite(url); if (off) return;
      // 처음 3분은 10초마다, 그 뒤 10분까지는 30초마다
      if (ok) setSt('ok'); else if (++n >= 32) setSt('no'); else { if (n === 18) setSt('slow'); timer = setTimeout(tick, n < 18 ? 10000 : 30000); }
    })();
    return () => { off = true; clearTimeout(timer); };
  }, [url, at]);
  if (st === 'skip') return null;
  return <p class="open-state" aria-live="polite"><span class={`ok-dot${st === 'ok' ? '' : ' wait'}`} aria-hidden="true" />{st === 'ok' ? '지금 열려요.' : st === 'wait' ? '열리는지 확인하는 중이에요. 처음에는 1~2분 걸릴 수 있어요.' : st === 'slow' ? '아직 확인하는 중이에요. 길면 10분까지 걸려요.' : '아직 열리지 않아요. 주소를 직접 열어 확인해 주세요.'}</p>;
}

/**
 * 짧은 주소: 손으로 칠 때 쓰는 주소. [짧은 주소 만들기] 한 번이면 is.gd에서 만들고, 다른 서비스(joo.is·bit.ly 등)에서 만든 주소를 붙여 넣을 수도 있음.
 * QR과 [주소 복사]는 언제나 원래 주소라서 짧은 주소 서비스가 막히거나 없어져도 사이트는 열림. 근거: docs/research/share-links-2026-11.md
 */
function ShortLink({ url, short, stale, update, onRepublish, busy: pubBusy, linkOnly }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState(false); // 다른 방법·바꾸기
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [back, setBack] = useState(false); // 다른 서비스에 다녀옴 → [붙여넣기]를 눈에 띄게
  const [isgdBad, setIsgdBad] = useState(false); // 이 망에서 is.gd에 닿지 않음(아직 짧은 주소가 없을 때 한 번 확인)
  useEffect(() => { if (short) return undefined; let off = false; reach('short:isgd').then((s) => { if (!off) setIsgdBad(s === 'blocked'); }); return () => { off = true; }; }, [!!short]);
  const went = useRef(false);
  useEffect(() => {
    const f = () => { if (went.current) { went.current = false; setBack(true); } };
    window.addEventListener('focus', f); return () => window.removeEventListener('focus', f);
  }, []);
  const save = (v) => update((cur) => patchDeploy(cur, (b) => ({ ...b, meta: { ...b.meta, shortUrl: v } })));
  async function make(alias = '') {
    setBusy(true); setErr('');
    try { save(await shortenUrl(url, alias)); setOpen(false); setName(''); toast('짧은 주소를 만들었어요.'); }
    catch (e) { setErr(e.message); if (e.code !== 'name') setOpen(true); }
    setBusy(false);
  }
  function take(v) {
    const r = checkShortUrl(v, url); setBack(false);
    if (r.error) { setErr(r.error); return; }
    save(r.url); setText(''); setErr(''); setOpen(false); toast('짧은 주소를 넣었어요.');
  }
  async function paste() {
    let v;
    try { v = await navigator.clipboard.readText(); }
    catch { setErr('입력 칸을 누르고 Ctrl+V(맥은 ⌘V)로 붙여 넣어 주세요.'); return; }
    take(v);
  }
  return (
    <div class="short">
      <div class="short-row">
        <b class="short-l">짧은 주소</b>
        {short
          ? <><span class="short-url">{showUrl(short)}</span>
            <button type="button" class="btn btn-sm" onClick={() => copy(short, '짧은 주소를 복사했어요.')}>복사</button>
            <button type="button" class="btn btn-sm btn-quiet" aria-expanded={String(open)} onClick={() => { setOpen(!open); setErr(''); }}>바꾸기</button></>
          : <><button type="button" class="btn btn-sm" disabled={busy} aria-busy={busy ? 'true' : undefined} onClick={() => make()}>{busy ? '만드는 중…' : '짧은 주소 만들기'}</button>
            <button type="button" class="btn btn-sm btn-quiet" aria-expanded={String(open)} onClick={() => { setOpen(!open); setErr(''); }}>다른 방법</button></>}
      </div>
      {short
        ? <p class="small">참가자가 직접 칠 때 알려 주세요. QR과 [주소 복사]는 원래 주소라서 짧은 주소가 막힌 곳에서도 열려요.</p>
        : isgdBad ? <p class="small" role="status">이 망에서 is.gd에 닿지 않아요. QR과 [주소 복사]는 원래 주소라 그대로 쓰면 돼요. 짧은 주소가 꼭 필요하면 [다른 방법]으로 만들어 넣어요.</p>
          : <p class="small">직접 칠 때 쓰는 주소예요. 사이트 주소를 is.gd로 보내 광고 없는 짧은 주소를 만들어요.</p>}
      {short && linkOnly && <p class="small">짧은 주소는 누구나 짐작해 넣어 볼 수 있어요. 참가자만 봐야 하면 [공개 범위]에서 암호를 거세요.</p>}
      {stale && <p class="small short-stale"><span>안내문과 발표 화면에는 다시 배포해야 {short ? '나와요' : '빠져요'}.</span> <button type="button" class="btn btn-sm" disabled={!!pubBusy} onClick={onRepublish}>다시 배포하기</button></p>}
      {err && <p class="small err" role="alert">{err}</p>}
      {open && <div class="short-more">
        <div class="short-line">
          <span class="short-k">이름 정하기</span>
          <span class="affix"><span class="affix-t">is.gd/</span><input value={name} onInput={(e) => { setName(shortName(e.target.value)); setErr(''); }} onKeyDown={(e) => e.key === 'Enter' && name.length >= 5 && make(name)} placeholder="yeonsu2026" maxLength={30} autoComplete="off" autoCapitalize="off" spellcheck={false} aria-label="짧은 주소 이름(영문·숫자 5자 이상)" /></span>
          <button type="button" class="btn btn-sm" disabled={busy || name.length < 5} onClick={() => make(name)}>만들기</button>
        </div>
        <div class="short-line">
          <span class="short-k">다른 서비스</span>
          {SHORTENERS.map((s) => <a class="btn btn-sm" href={s.url} target="_blank" rel="noopener" key={s.id} onClick={() => { went.current = true; copy(url, `사이트 주소를 복사했어요. ${s.name}에서 붙여 넣어 만드세요.`); }}>{s.name} 열기</a>)}
          <span class="small short-note">누르면 사이트 주소가 복사돼요. {SHORTENERS.map((s) => `${s.name}: ${s.note}`).join(' ')}</span>
        </div>
        <div class="short-line">
          <span class="short-k">만든 주소 넣기</span>
          <input class="input" value={text} onInput={(e) => { setText(e.target.value); setErr(''); }} onPaste={(e) => { const x = e.clipboardData?.getData('text'); if (x) { e.preventDefault(); take(x); } }} onKeyDown={(e) => e.key === 'Enter' && text && take(text)} placeholder="joo.is/우리연수" inputMode="url" autoComplete="off" autoCapitalize="off" spellcheck={false} aria-label="다른 서비스에서 만든 짧은 주소" />
          {text ? <button type="button" class="btn btn-sm" onClick={() => take(text)}>저장</button>
            : <button type="button" class={`btn btn-sm${back ? ' btn-primary attn' : ''}`} onClick={paste}>붙여넣기</button>}
        </div>
        {short && <div class="btn-row"><button type="button" class="btn btn-sm btn-quiet" onClick={() => { save(''); setOpen(false); setErr(''); toast('짧은 주소를 삭제했어요.'); }}>짧은 주소 삭제</button></div>}
      </div>}
    </div>
  );
}

/** QR 크게 보기: 발표 화면에 띄워 뒷자리에서도 찍히게(QR 한 변은 찍는 거리의 1/10쯤 필요). 흰 바탕에 검은 점 그대로 */
function JoinBig({ open, onClose, qr, title, shown, full }) {
  const ref = useRef();
  useEffect(() => { const d = ref.current; if (!d) return; if (open && !d.open) d.showModal?.(); if (!open && d.open) d.close(); }, [open]);
  return (
    <dialog ref={ref} class="join-big" aria-label="QR 크게 보기" onClose={onClose} onCancel={onClose}>
      {open && <div class="join-big-in">
        <div class="join-big-qr"><QR text={qr} size={720} alt="참가자용 QR 코드" /></div>
        <div class="join-big-t">
          <p class="join-big-h">{title}</p>
          <p class="join-big-cta">휴대폰 카메라로 QR을 찍어 주세요</p>
          <p class="join-big-url">{shown}</p>
          {full && <p class="join-big-full">{full}</p>}
        </div>
        <button type="button" class="btn join-big-x" onClick={onClose}>닫기</button>
      </div>}
    </dialog>
  );
}

function Success({ p, bp, update, onEdit, onRepublish, onPrimary, busy, onZip, instantOn, fontNote, exp, days = 30 }) {
  const url = p.deploy.lastUrl.replace(/\/?$/, '/');
  // 대표 주소의 사이트에 실제로 걸린 공개 범위·암호(배포할 때 적어 둔 것). 배포한 뒤 바꿨으면 다시 배포할 때까지 QR·주소는 지금 사이트 기준
  const lock = p.deploy.sites?.[p.deploy.target]?.lock;
  const mode = bp.access?.mode || 'link';
  const pw = (lock ? lock.mode : mode) === 'password' ? (lock ? lock.pw : p.sitePassword) : '';
  const lockStale = !!lock && (lock.mode !== mode || (mode === 'password' && lock.pw !== (p.sitePassword || '')));
  const shareUrl = pw ? E.unlockUrl(url, pw) : url;
  const m = bp.meta || {};
  const short = m.shortUrl && same(m.shortUrl) !== same(url) ? m.shortUrl : '';
  const stale = /^https:/.test(url) && (short || '') !== (p.deploy.shortLive || '');
  const [big, setBig] = useState(false);
  const when = whenText(m); // 사이트 첫 화면과 같은 꼴(2026. 11. 20.(금) 14:00~17:00)
  // 대표 주소의 사이트에 참여 기능이 없으면(참여 기능 없이 배포한 곳) 강사 화면·참여 안내를 보이지 않음
  const liveOn = (bp.live?.features || []).length > 0 && p.deploy?.sites?.[p.deploy?.target]?.live !== false;
  // 강사 화면 관리자 키: 바로 배포는 배포할 때 만든 키, 내 서버·시트는 연결할 때 앱이 만들어 이 기기에 기억한 키
  const [adminKey, setAdminKey] = useState('');
  const liveUrl = bp.live?.url || '';
  // 바로 배포 방의 키. 바로 배포 사이트를 강사 서버로 바꿨으면 그 서버의 키(고르는 규칙은 lib/console-key.js — '내 연수' 목록의 [강사 화면]도 같은 규칙)
  useEffect(() => { const src = consoleKeySource(p, bp.live, { liveOn }); if (src?.key) setAdminKey(src.key); else if (src?.url) adminKeyFor(src.url, src.code).then(setAdminKey); else setAdminKey(''); }, [liveUrl, p.deploy.target, p.liveOk, liveOn, p.deploy.lecpage?.adminKey]);
  const feats = bp.live?.features || [];
  // 받는 사람이 할 일 한 줄: 출석이 있으면 도착해서 [출석], 아니면 연수 중에 질문·참여
  const todo = feats.includes('attendance') ? '\n도착하면 이 사이트에서 [출석]을 눌러 주세요.' : liveOn ? '\n연수 중에 이 사이트로 질문하고 참여해요.' : '';
  const msg = `[${m.title}] 연수 사이트예요.\n${[when, m.venue].filter(Boolean).join(' · ')}\n주소: ${shareUrl}${todo}`;
  const gone = !!exp?.gone; // 보관 기간이 끝나 지워짐(다시 배포하면 새 주소)
  if (gone) {
    return (
      <Sheet class="success">
        <div class="stack">
          <div class="row"><Mascot size={48} mood="oops" /><h2 class="h-sub">보관 기간이 끝나 사이트가 지워졌어요</h2></div>
          <p>{`${md(exp.until)}에 지워졌어요. 다시 배포하면 새 주소로 열려요. 인쇄한 QR과 보낸 주소는 새것으로 바꿔 주세요.`}</p>
          <div class="btn-row"><button type="button" class="btn btn-primary" disabled={!!busy} onClick={onRepublish}>다시 배포하기</button></div>
        </div>
      </Sheet>
    );
  }
  return (
    <Sheet class="success">
      <div class="success-in">
        <div class="stack success-top">
          <div class="row"><Mascot size={48} mood="happy" /><h2 class="h-sub" id="done-h" tabIndex={-1}>참가자에게 보낼 주소가 생겼어요</h2></div>
          <a class="big-url" href={shareUrl} target="_blank" rel="noopener">{url}</a>
          {p.deploy.target === 'lecpage' ? <p class="open-state"><span class="ok-dot" aria-hidden="true" />{exp?.until ? `${md(exp.until)}까지 열려 있어요. 다시 배포하면 그날부터 ${exp.days}일로 늘어나요.` : `방문이 있는 동안은 계속 열려 있어요. ${days}일 동안 아무도 오지 않으면 지워져요.`}</p> : <OpenState url={url} at={p.deploy.at} />}
          {exp?.short && exp.until && <p class="small venue-day is-full" role="alert">{`연수 날(${md(exp.end - DAY)})에는 지워져 있어요. `}{exp.enough ? <>지금 다시 배포하면 {md(exp.again)}까지 열려요. <button type="button" class="btn btn-sm" disabled={!!busy} onClick={onRepublish}>다시 배포해 늘리기</button></> : keepAdvice(exp)}</p>}
          {p.deploy.target === 'lecpage' && p.deploy.lecpage?.altUrl && <p class="small muted">기관·회사 망에서 안 열리면 이 주소로: <a href={p.deploy.lecpage.altUrl} target="_blank" rel="noopener">{p.deploy.lecpage.altUrl.replace(/^https:\/\//, '')}</a></p>}
          {pw && <p class="small">암호: <b class="mono">{pw}</b> · QR과 안내 문구의 주소는 암호 없이 바로 열려요.</p>}
          {fontNote && <p class="small" role="status">{fontNote}</p>}
          {p.deploy.sites?.[p.deploy.target]?.left?.length > 0 && <p class="small left-note" role="status">{leftLine(p.deploy.sites[p.deploy.target].left, { after: true })}</p>}
          <div class="btn-row">
            <button class="btn btn-primary" onClick={() => copy(shareUrl, '주소를 복사했어요.')}>주소 복사</button>
            <button class="btn" onClick={() => copy(msg, '카톡에 붙여 넣을 안내 문구를 복사했어요.')}>카톡용 안내 문구 복사</button>
          </div>
        </div>
        <div class="qr-side">
          <button type="button" class="qr-box qr-zoom" onClick={() => setBig(true)} aria-haspopup="dialog" aria-label="QR 코드 크게 보기"><QR text={shareUrl} size={180} alt="" /><span class="qr-zoom-t">크게 보기</span></button>
          <div class="btn-row">
            <button class="btn btn-sm" onClick={async () => saveFile(safeName(m.title) + '_QR.png', await qrPng(shareUrl), 'image/png')}>QR 저장</button>
            <button class="btn btn-sm" onClick={async () => toast(await copyQr(shareUrl) ? 'QR 그림을 복사했어요. 발표 자료에 붙여 넣으세요.' : '이 브라우저에서는 그림 복사가 안 돼요. [QR 저장]을 눌러 주세요.')}>QR 복사</button>
          </div>
        </div>
        <div class="stack success-rest">
          {lockStale && <p class="small short-stale" role="status"><span>공개 범위나 암호를 바꿨어요. 다시 배포해야 사이트에 반영돼요.</span> <button type="button" class="btn btn-sm" disabled={!!busy} onClick={onRepublish}>다시 배포하기</button></p>}
          <Sites p={p} onPrimary={onPrimary} busy={busy} />
          {/^https:/.test(url) && <ShortLink url={url} short={short} stale={stale} update={update} onRepublish={onRepublish} busy={busy} linkOnly={bp.access?.mode !== 'password' && bp.access?.mode !== 'public'} />}
          {/* 연수 전날·당일에 쓸 것: 놓치지 않게 처음부터 펼쳐 둠(제목 줄을 눌러 접을 수 있음, 다시 그려도 접은 채로 — open 값이 그대로라 Preact가 건드리지 않음) */}
          <details class="day-kit day-fold" open>
            <summary><b class="small" id="venue-h">연수 전날 점검</b> <span class="small muted">그곳 Wi-Fi로 열리는지 확인</span></summary>
            <VenueBody p={p} url={url} instantOn={p.deploy.target === 'lecpage' && instantOn} />
          </details>
          <details class="day-kit day-fold" open>
            <summary><b class="small" id="day-kit-h">연수 당일</b> <span class="small muted">{liveOn ? '강사 화면 · 발표 화면 · QR 안내문' : '발표 화면 · QR 안내문'}</span></summary>
            {liveOn && <p class="small muted">강사 화면에서 발표 화면 띄우기·QR 안내문·접속 확인·휴대폰 연결을 모두 해요.</p>}
            <div class="btn-row">
              {/* 강사 화면이 출발점: 누르면 관리자 키를 먼저 복사해 두어 붙여 넣기만 하게 */}
              {liveOn && <a class="btn btn-sm" href={url + 'console.html'} target="_blank" rel="noopener" onClick={() => adminKey && copy(adminKey, '관리자 키를 복사했어요. 강사 화면에 붙여 넣으세요.')}>강사 화면 열기</a>}
              <a class="btn btn-sm" href={url + 'screen.html'} target="_blank" rel="noopener">발표 화면 열기</a>
              <a class="btn btn-sm" href={url + 'poster.html'} target="_blank" rel="noopener">QR 안내문 인쇄(A4)</a>
            </div>
            {/* 관리자 키는 가려 둠(발표 화면에 비추거나 화면을 공유해도 보이지 않게) */}
            {liveOn && (adminKey
              ? <SecretLine label="강사 화면 관리자 키" value={adminKey} copied="관리자 키를 복사했어요." />
              : <p class="small">강사 화면에는 참여 기능을 연결할 때 정한 관리자 키로 들어가요.</p>)}
          </details>
          <RescueKit p={p} update={update} url={url} shareUrl={shareUrl} onZip={onZip} busy={busy} />
          <p class="small">자료는 강사 화면의 자료실에서 올려요. <button type="button" class="btn btn-sm btn-quiet" onClick={onEdit}>수정하러 가기</button></p>
        </div>
      </div>
      <JoinBig open={big} onClose={() => setBig(false)} qr={shareUrl} title={m.title} shown={short ? showUrl(short) : showUrl(url)} full={short ? showUrl(url) : ''} />
    </Sheet>
  );
}

/** 배포한 곳: 곳마다 주소를 기억해 두고, 참가자에게 알릴 대표 주소를 고르고, 다른 곳에도 배포하러 감 */
function Sites({ p, onPrimary, busy }) {
  const d = p.deploy || {};
  const liveOn = (deployView(p)?.live?.features || []).length > 0;
  const sites = d.sites && Object.keys(d.sites).length ? d.sites : { [d.target || 'lecpage']: { url: d.lastUrl, at: d.at } };
  const rows = Object.entries(sites).filter(([, s]) => s?.url).sort((a, b) => (a[0] === d.target ? -1 : b[0] === d.target ? 1 : (b[1].at || 0) - (a[1].at || 0)));
  const ask = (to) => window.dispatchEvent(new CustomEvent('lp-pub-pick', { detail: to }));
  return (
    <div class="sites" role="group" aria-labelledby="sites-h">
      <b class="small" id="sites-h">배포한 곳</b>
      <ul class="sites-list">
        {rows.map(([t, s]) => {
          const main = t === d.target;
          return (
            <li class={main ? 'is-main' : ''} key={t}>
              <span class="sites-t"><b>{t === 'zip' ? '직접 올린 곳' : SITE_LABEL[t] || t}</b>{main && <em>대표 주소</em>}{liveOn && s.live === false && <i class="sites-nolive">참여 기능 없음</i>}</span>
              <a class="sites-u small" href={s.url} target="_blank" rel="noopener">{showUrl(s.url)}</a>
              {!main && <button type="button" class="btn btn-sm" disabled={!!busy} onClick={() => onPrimary(t)} aria-label={`${SITE_LABEL[t] || t} 주소를 대표 주소로 쓰기`}>대표 주소로 쓰기</button>}
              <button type="button" class="btn btn-sm btn-quiet sites-x" disabled={!!busy} aria-haspopup="dialog" onClick={() => window.dispatchEvent(new CustomEvent('lp-undeploy', { detail: t }))} aria-label={`${t === 'zip' ? '직접 올린 곳' : SITE_LABEL[t] || t} 배포 취소`}>배포 취소</button>
            </li>
          );
        })}
      </ul>
      {liveOn && rows.some(([t, s]) => s.live === false && t !== d.target) && siteHasLive(d) && <p class="small muted">참여 기능은 대표 주소에서만 돼요. 참가자에게는 대표 주소와 QR을 알려 주세요.</p>}
      <div class="btn-row">
        {!sites.lecpage && PUBLISH_API && <button type="button" class="btn btn-sm" disabled={!!busy} onClick={() => ask('lecpage')}>바로 배포로도 배포</button>}
        <button type="button" class="btn btn-sm" disabled={!!busy} onClick={() => ask('other')}>다른 곳에도 배포</button>
      </div>
    </div>
  );
}

/**
 * 체험 연수의 마지막 단추: 실제로 올리지 않음. 배포할 사이트 파일은 실제와 똑같이 만들어 보고(조립·글꼴 빼고), 다 되면 그렇다고만 알림
 */
function DemoPublish({ p, buildFiles }) {
  const [st, setSt] = useState(''); // '' | 'busy' | 'done' | 'bad'
  const [pct, setPct] = useState(0);
  async function run() {
    setSt('busy'); setPct(15);
    try { const r = await buildFiles({ dry: true }); setPct(70); await new Promise((x) => setTimeout(x, 500)); setPct(100); setSt('done'); toast(`배포 연습을 마쳤어요. 파일 ${Object.keys(r.files).length}개를 만들었고, 체험이라 올리지는 않았어요.`); }
    catch (e) { console.error(e); setSt('bad'); }
  }
  return (
    <div class="stack demo-pub">
      {st !== 'done' && <div class="btn-row"><button type="button" class="btn btn-primary btn-lg" data-coach={st ? undefined : ''} data-coach-room={st ? undefined : ''} disabled={st === 'busy'} aria-busy={st === 'busy' ? 'true' : undefined} onClick={run}>{st === 'busy' ? '배포할 파일 만드는 중…' : '배포 연습하기'}</button><span class="small muted">체험이라 실제로 올리지는 않아요.</span></div>}
      {st === 'busy' && <Progress pct={pct} />}
      {st === 'bad' && <p class="small err" role="alert">배포할 파일을 만들지 못했어요. 새로 고침한 뒤 다시 해 주세요.</p>}
      {st === 'done' && <div class="demo-done-main" role="status">
        <Mascot size={48} mood="happy" />
        <div class="stack"><b>여기까지가 전부예요.</b><span class="small">실제로는 이 버튼을 누르면 참가자에게 보낼 주소와 QR이 바로 나와요. 이제 내 교재로 해 보세요.</span>
          <div class="btn-row"><a class="btn btn-primary" href="#/">내 교재로 시작하기</a><button type="button" class="btn btn-quiet" onClick={() => setSt('')}>한 번 더 연습</button></div></div>
      </div>}
    </div>
  );
}
