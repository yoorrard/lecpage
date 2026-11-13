import { useEffect, useRef, useState } from 'preact/hooks';
import { Mascot } from '../components/Mascot.jsx';
import { projects } from '../lib/db.js';
import { newProject, importProjectFile, setPendingFiles } from '../lib/project.js';
import { toast } from '../lib/util.js';
import { HeroFold } from '../landing/HeroFold.jsx';
import '../styles/landing.css';

// 첫 화면: 어떤 AI로 만들든 마무리는 lecpage 한 곳(왜) → 교재 한 장이 연수 사이트가 되고, 참가자 휴대폰에 닿고, 연수 뒤까지 이어지는 이야기.
// 첫 화면은 엔진을 받지 않아요(숫자는 빌드 때 계산, 그림은 미리 찍은 것). 구성과 근거: docs/research/landing-2026-11.md
// .lecpage(에이전트 스킬·다른 컴퓨터에서 저장한 연수)도 같은 곳에 놓으면 열림
const ACCEPT = '.pptx,.ppsx,.pdf,.hwpx,.docx,.txt,.md,.hwp,.ppt,.doc,.lecpage';
const isSaved = (f) => /\.lecpage$/i.test(f?.name || '');

export function Home() {
  const [list, setList] = useState(null);
  const [more, setMore] = useState(false);
  const [drag, setDrag] = useState(false);
  const [Mine, setMine] = useState(null); // '내 연수' 목록(만든 연수가 있을 때만 받음)
  const [More, setMoreC] = useState(null); // 첫 화면 아래 이야기(늦게 받는 묶음: 첫 화면 JS를 가볍게)
  const fileRef = useRef(); const pickRef = useRef();
  const reload = () => projects.all().then(setList, () => setList([]));
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
    try { await fn(); ok = true; } catch (e) { console.error(e); toast(fail); }
    clearTimeout(t); setBusy('');
    if (!ok || stay) running.current = false; // 다른 화면으로 넘어가면 이 화면은 닫히니 그대로 막아 둠
  }
  const busyProps = (key, label = '만드는 중…') => ({ 'aria-busy': busy === key ? 'true' : undefined, 'data-busy': label });
  function startWith(fileList) {
    const files = Array.from(fileList || []); // 입력칸을 비우기 전에 먼저 복사
    if (files.length === 1 && isSaved(files[0])) return openSaved(files[0]); // 저장한 연수 파일이면 교재가 아니라 연수로 열기
    return once('blank', async () => {
      const p = await newProject('blank');
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
  const fromExample = (id) => once(`ex-${id}`, async () => { const p = await newProject('example', id); location.hash = `#/p/${p.id}/2`; });
  async function openSaved(f) {
    try { const p = await importProjectFile(f); toast(p.origin === 'skill' ? '에이전트에서 만든 연수를 열었어요.' : '저장한 파일을 열었어요. 참여 기능 연결과 공개 주소는 다시 정해 주세요.'); location.hash = `#/p/${p.id}/${p.stage || 1}`; }
    catch (err) { toast(err.friendly ? err.message : '파일을 열지 못했어요. lecpage에서 저장한 .lecpage 파일인지 확인해 주세요.'); }
  }
  async function onImport(e) {
    const f = e.target.files?.[0]; if (!f) return;
    await openSaved(f);
    e.target.value = '';
  }
  return (
    <div class="ld">
      <section class="ld-hero" aria-labelledby="ld-h1">
        <div class="ld-hero-t">
          <p class="ld-kicker">강의·연수용 · 무료 · 회원가입 없음</p>
          <h1 id="ld-h1"><span>교재를 넣으면</span> <span><span class="ld-hl">연수 사이트</span>가 나와요</span></h1>
          <p class="ld-lead">교재(PPT·PDF·한글·워드)를 놓으면 쓰던 AI가 내용을 짜요. lecpage가 주제에 맞는 디자인·공개·QR·질문과 투표까지 이어서 만들어요.</p>
          <button type="button" class={`ld-drop${drag ? ' over' : ''}`} onClick={pick} aria-describedby="ld-drop-sub">
            <span class="ld-drop-btn">교재 넣고 시작하기</span>
            <span class="ld-drop-sub" id="ld-drop-sub"><span><span class="on-mouse">파일을 여기에 놓거나 눌러서 골라요</span><span class="on-touch">눌러서 교재 파일을 골라요</span></span><span>PPT·PDF·한글(HWP·HWPX)·워드</span></span>
          </button>
          <input ref={pickRef} type="file" multiple hidden accept={ACCEPT} onChange={(e) => { startWith(e.target.files); e.target.value = ''; }} />
          <div class="ld-hero-more">
            <a class="btn ld-try" href="#/demo">먼저 체험해 보기<span aria-hidden="true"> →</span></a>
            <button type="button" class="btn btn-quiet" {...busyProps('blank')} onClick={() => startWith([])}>교재 없이 시작하기</button>
            <button type="button" class="btn btn-quiet" onClick={() => fileRef.current?.click()}>저장한 파일 열기</button>
            <input ref={fileRef} type="file" accept=".lecpage,.zip,.json" hidden onChange={onImport} />
          </div>
          <p class="ld-note">교재는 이 브라우저에서 읽고, AI를 쓸 때만 연결한 AI 회사로 보내요.</p>
        </div>
        <HeroFold />
      </section>

      {/* '내 연수'와 아래 이야기는 함께 넣어 위쪽이 밀리지 않게(아래 이야기 코드를 받지 못해도 '내 연수'는 보임) */}
      {!(more && More) && <div class="ld-later" aria-hidden="true" />}
      {more && More && list?.length > 0 && Mine && <Mine list={list} once={once} busyProps={busyProps} reload={reload} />}
      {more && More && <More pick={pick} busyProps={busyProps} fromExample={fromExample} />}

      {drag && <div class="ld-dropall" aria-hidden="true"><p><Mascot size={64} mood="wow" />놓으면 이 교재로 시작해요<small>그만두려면 화면 밖으로 빼거나 Esc를 눌러요</small></p></div>}
    </div>
  );
}
