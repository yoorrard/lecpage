import { useEffect, useRef, useState } from 'preact/hooks';
import { Mascot } from '../components/Mascot.jsx';
import { projects, storageKind, STORAGE_MSG } from '../lib/db.js';
import { newProject, setPendingFiles, isSavedFile, stageOf } from '../lib/project.js';
import { toast } from '../lib/util.js';
import { HeroStage } from '../landing/Hero.jsx';
import '../styles/landing.css';

// 첫 화면: 교재를 넣으면 연수 사이트가 나와요(AI가 교재로 만든 실제 사이트 셋을 노트북·휴대폰 틀에) → 아래 이야기(landing/More.jsx):
// 노하우(요청 설계·디자인 라이브러리·강의 엔진) → 교재가 사이트가 되기까지 → 강의 당일 세 화면 → 구독 계정 연결 → 배포·QR → 참고 디자인 → 무료·오픈 소스.
// 첫 화면은 엔진을 받지 않아요(그림은 미리 찍은 것). 구성과 근거: docs/research/landing-2026-11.md 10장
// .lecpage(AI 에이전트 스킬·다른 컴퓨터에서 저장한 연수)도 같은 곳에 놓으면 열림
const ACCEPT = '.pptx,.ppsx,.pdf,.hwpx,.docx,.txt,.md,.hwp,.ppt,.doc,.lecpage';
const DAY = 864e5;
/** 빈 연수: [교재 없이 시작하기]만 누르고 아무것도 넣지 않은 것(교재·초안·연수 정보 글이 하나도 없음) */
const FILLED = ['title', 'subtitle', 'organizer', 'date', 'start', 'end', 'venue', 'request', 'instructorName', 'instructorOrg', 'contact', 'surveyUrl', 'joinUrl'];
const isBlank = (p) => !p.blueprint && !p.site && !p.material && !(p.files || []).length && !p.imported && !p.origin && !p.fromExample && !String(p.request || '').trim() && !FILLED.some((k) => String(p.info?.[k] || '').trim());

export function Home() {
  const [list, setList] = useState(null);
  const [more, setMore] = useState(false);
  const [drag, setDrag] = useState(false);
  const [Mine, setMine] = useState(null); // '내 연수' 목록(만든 연수가 있을 때만 받음)
  const [More, setMoreC] = useState(null); // 첫 화면 아래 이야기(늦게 받는 묶음: 첫 화면 JS를 가볍게)
  const fileRef = useRef(); const pickRef = useRef();
  // 빈 연수는 쌓이지 않게: 목록에서 빼고, 하루 넘은 것은 지우고, [교재 없이 시작하기]는 남은 빈 연수를 다시 씀
  const blankRef = useRef(null);
  const reload = () => projects.all().then((list0) => {
    let all = list0;
    all = all.filter((p) => !p.demo); // 체험 연수는 목록에 없음
    const blanks = all.filter(isBlank); const now = Date.now();
    for (const b of blanks) if (now - (b.updatedAt || b.createdAt || 0) > DAY) projects.remove(b.id).catch(() => { });
    blankRef.current = blanks.find((b) => now - (b.updatedAt || b.createdAt || 0) <= DAY) || null;
    setList(all.filter((p) => !isBlank(p)));
  }, () => setList([]));
  useEffect(() => { reload(); }, []);
  // 아래 이야기 코드는 첫 그림을 그린 다음 틈에 받음(첫 화면은 기다리지 않음)
  useEffect(() => {
    let off = false;
    const id = requestAnimationFrame(() => setTimeout(() => import('../landing/More.jsx').then((m) => { if (!off) setMoreC(() => m.More); }, () => { if (!off) setMoreC(() => () => null); }), 0));
    return () => { off = true; cancelAnimationFrame(id); };
  }, []);
  // 첫 화면을 먼저 그리고(첫 그림이 빨리 뜨게), 그 아래 이야기는 다음 틈에. 만든 연수 목록과 함께 한 번에 넣어 위쪽이 밀리지 않게
  useEffect(() => {
    if (more) return;
    // 목록이 오래 걸리면(저장소가 막힘) 기다리지 않음
    if (list === null) { const t = setTimeout(() => setMore(true), 1500); return () => clearTimeout(t); }
    let t, id, off = false;
    const go = () => { if (off) return; id = requestAnimationFrame(() => { t = setTimeout(() => setMore(true), 0); }); };
    // 만든 연수가 있을 때만 '내 연수' 목록 코드를 받고, 받은 뒤 아래 이야기와 함께 넣음(위쪽이 밀리지 않게)
    if (list.length && !Mine) import('../landing/Mine.jsx').then((m) => { if (!off) setMine(() => m.Mine); go(); }, go); else go();
    return () => { off = true; cancelAnimationFrame(id); clearTimeout(t); };
  }, [list]);
  // 두 번 눌러도 한 번만(interaction.md 1절): 누르는 순간 막고, 0.3초 넘게 걸리면 누른 버튼에 '만드는 중…'
  const running = useRef(false);
  const [busy, setBusy] = useState('');
  async function once(key, fn, { stay = false, fail = '연수를 만들지 못했어요. 새로 고침한 뒤 다시 눌러 주세요.' } = {}) {
    if (running.current) return;
    running.current = true;
    const t = setTimeout(() => setBusy(key), 300);
    let ok = false;
    try { await fn(); ok = true; } catch (e) { console.error(e); toast(STORAGE_MSG[storageKind(e)] || fail); }
    clearTimeout(t); setBusy('');
    if (!ok || stay) running.current = false; // 다른 화면으로 넘어가면 이 화면은 닫히니 그대로 막아 둠
  }
  const busyProps = (key, label = '만드는 중…') => ({ 'aria-busy': busy === key ? 'true' : undefined, 'data-busy': label });
  function startWith(fileList) {
    const files = Array.from(fileList || []); // 입력칸을 비우기 전에 먼저 복사
    if (files.length === 1 && isSavedFile(files[0])) return openSaved(files[0]); // 저장한 연수 파일이면 교재가 아니라 연수로 열기
    return once('blank', async () => {
      const p = blankRef.current || await newProject(); blankRef.current = null;
      if (files.length) setPendingFiles(p.id, files);
      location.hash = `#/p/${p.id}/1`;
    });
  }
  // 교재 파일을 첫 화면 어디에 놓아도 시작(놓을 자리를 찾지 않게). 놓았을 때만 시작하고, 끌어 오는 중에 화면 밖으로 빼거나 Esc를 누르면 취소.
  // 브라우저마다 dragleave가 빠지기도 해서(창 밖으로 빼기·Esc) 세는 대신 '끌어 오는 중' 신호(dragover)가 끊기면 안내를 닫음
  useEffect(() => {
    let on = false, cancelled = false, last = 0, timer = 0;
    const files = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
    const show = (v) => { if (on !== v) { on = v; setDrag(v); } if (!v) clearInterval(timer); };
    const watch = () => { clearInterval(timer); timer = setInterval(() => { if (Date.now() - last > 400) show(false); }, 150); };
    const enter = (e) => { if (!files(e)) return; if (!on) cancelled = false; last = Date.now(); if (!cancelled) { show(true); watch(); } };
    const over = (e) => { if (!files(e)) return; e.preventDefault(); last = Date.now(); if (cancelled) { e.dataTransfer.dropEffect = 'none'; return; } e.dataTransfer.dropEffect = 'copy'; if (!on) { show(true); watch(); } };
    const leave = (e) => { if (!files(e)) return; if (!e.relatedTarget || e.clientX <= 0 || e.clientY <= 0 || e.clientX >= innerWidth || e.clientY >= innerHeight) show(false); };
    const key = (e) => { if (e.key === 'Escape' && on) { cancelled = true; show(false); } };
    const drop = (e) => { if (!files(e)) return; e.preventDefault(); const go = on && !cancelled; show(false); cancelled = false; if (go && e.dataTransfer.files?.length) startWith(e.dataTransfer.files); };
    addEventListener('dragenter', enter); addEventListener('dragleave', leave); addEventListener('dragover', over); addEventListener('drop', drop); addEventListener('keydown', key);
    return () => { clearInterval(timer); removeEventListener('dragenter', enter); removeEventListener('dragleave', leave); removeEventListener('dragover', over); removeEventListener('drop', drop); removeEventListener('keydown', key); };
  }, []);
  const pick = () => pickRef.current?.click();
  // 참고 디자인으로 시작: 새 연수의 '참고 디자인'에 적어 두고 교재 넣기로(AI가 그 분위기를 내 교재에 맞게 옮김). ref: { id, name, mood }
  const fromExample = (ref) => once(`ex-${ref.id}`, async () => { const p = await newProject({ reference: ref }); location.hash = `#/p/${p.id}/1`; });
  async function openSaved(f) {
    const m = await import('../lib/open-saved.js').catch(() => null); // 파일을 열 때만 받음(첫 화면 묶음을 가볍게)
    if (!m) { toast('파일 여는 도구를 받지 못했어요. 인터넷 연결을 확인하고 새로 고침해 주세요.'); return; }
    try { toast(await m.openSaved(f)); }
    catch (err) { toast(m.openFailMessage(err)); }
  }
  // 다시 온 강사: 가장 최근에 고친 연수로 바로 이어 가는 단추(첫 화면 단추 줄, '먼저 체험해 보기' 자리). '내 연수' 목록은 아래 그대로
  const recent = list?.[0];
  async function onImport(e) {
    const f = e.target.files?.[0]; if (!f) return;
    await openSaved(f);
    e.target.value = '';
  }
  return (
    <div class="ld">
      <section class="ld-hero" aria-labelledby="ld-h1">
        <p class="ld-kicker">강의·연수용 · 무료 · 오픈소스 · 회원가입 없음</p>
        <h1 id="ld-h1"><span>교재를 넣으면</span> <span><em>연수 사이트</em>가 나와요</span></h1>
        <div class="ld-hero-t">
          <p class="ld-lead">AI가 교재 원본을 직접 읽고, 이 강의만의 디자인으로 사이트를 만들어요. 참가자는 교재를 따라 넘기며 출석·질문·투표·실습을 하고, 강사는 발표 화면과 강사 화면으로 진행해요.</p>
          <button type="button" class={`ld-drop${drag ? ' over' : ''}`} onClick={pick} aria-describedby="ld-drop-sub">
            <span class="ld-drop-btn">교재 넣고 시작하기</span>
            <span class="ld-drop-sub" id="ld-drop-sub"><span><span class="on-mouse">파일을 여기에 놓거나 눌러서 골라요</span><span class="on-touch">눌러서 교재 파일을 골라요</span></span><span>PPT·PDF·한글(HWP·HWPX)·워드</span></span>
          </button>
          <input ref={pickRef} type="file" multiple hidden accept={ACCEPT} onChange={(e) => { startWith(e.target.files); e.target.value = ''; }} />
          <div class="ld-hero-more">
            {recent ? <a class="btn ld-try ld-resume" href={`#/p/${recent.id}/${recent.stage || stageOf(recent.step || 1)}`}><span>계속 만들기:</span><span class="ld-resume-t">{recent.title || '이름 없는 연수'}</span><span aria-hidden="true">→</span></a>
              : <a class="btn ld-try" href="#/demo">먼저 해보기<span aria-hidden="true"> →</span></a>}
            <button type="button" class="btn btn-quiet" {...busyProps('blank')} onClick={() => startWith([])}>교재 없이 시작하기</button>
            <button type="button" class="btn btn-quiet" onClick={() => fileRef.current?.click()}>저장한 파일 열기</button>
            <input ref={fileRef} type="file" accept=".lecpage,.zip,.json" hidden onChange={onImport} />
          </div>
        </div>
        <HeroStage />
      </section>

      {/* '내 연수'와 아래 이야기는 함께 넣어 위쪽이 밀리지 않게(아래 이야기 코드를 받지 못해도 '내 연수'는 보임) */}
      {!(more && More) && <div class="ld-later" aria-hidden="true" />}
      {more && More && list?.length > 0 && Mine && <Mine list={list} once={once} busyProps={busyProps} reload={reload} />}
      {more && More && <More pick={pick} busyProps={busyProps} fromExample={fromExample} />}

      {drag && <div class="ld-dropall" aria-hidden="true"><p><Mascot size={64} mood="wow" />놓으면 이 교재로 시작해요<small>그만두려면 화면 밖으로 빼거나 Esc를 눌러요</small></p></div>}
    </div>
  );
}
