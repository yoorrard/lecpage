import { useEffect, useRef, useState } from 'preact/hooks';
import { Mascot } from '../components/Mascot.jsx';
import { Dialog } from '../components/ui.jsx';
import { projects } from '../lib/db.js';
import { newProject, importProjectFile, setPendingFiles, deleteProject, duplicateProject, stageOf } from '../lib/project.js';
import { copy, fmtDate, toast } from '../lib/util.js';
import { useInView } from '../landing/motion.js';
import { PRESET_COUNT } from '../landing/facts.js';
import { HeroFold } from '../landing/HeroFold.jsx';
import { Story } from '../landing/Story.jsx';
import { Showcase } from '../landing/Showcase.jsx';
import { Reach } from '../landing/Reach.jsx';
import { LiveDay } from '../landing/LiveDay.jsx';
import { Bench } from '../landing/Bench.jsx';
import '../styles/landing.css';

// 첫 화면: 교재 한 장이 연수 사이트가 되고, 참가자 휴대폰에 닿고, 연수 뒤까지 이어지는 이야기.
// 첫 화면은 엔진을 받지 않아요(숫자는 빌드 때 계산, 그림은 미리 찍은 것). 구성과 근거: docs/research/landing-2026-11.md
const STAGE = ['', '교재 넣기', '살펴보고 고치기', '공개하기'];
const ACCEPT = '.pptx,.ppsx,.pdf,.hwpx,.docx,.txt,.md,.hwp,.ppt,.doc';
const SKILL_CMD = 'npx skills add yoorrard/lecpage';
const EXAMPLES = [
  { id: 'data-lab', title: '데이터로 읽는 우리 반', kind: '디지털 연수 · 실습형 3시간', desc: '실습 5개, 도움 요청·진행 현황, 퀴즈, 만족도 조사', img: 'img/example-data-lab.webp' },
  { id: 'sel-story', title: '마음이 먼저 도착하는 교실', kind: '사회정서학습 연수 · 강의형 90분', desc: '핵심 메시지, 다섯 역량, 교재 보기, 투표·나눔 보드', img: 'img/example-sel-story.webp' },
];
const COMPARE = [
  ['내용', '그럴듯하게 지어낼 수 있어요', "교재 쪽을 근거로 짜고, 실습마다 '교재 n쪽'을 붙여요"],
  ['디자인', '비슷한 틀이 되풀이되고 점검이 없어요', `컨셉을 먼저 세우고 디자인 ${PRESET_COUNT}가지에서 골라요. 대비·줄바꿈·넘침·'AI 티'를 자동으로 점검해요`],
  ['기능', '정적인 페이지 한 장이에요', '교재 보기·실습·프롬프트 복사·질문·투표·나눔 보드·강사 화면·발표 화면·QR 안내문'],
  ['고칠 때', 'HTML 전체를 다시 써요', '설계도(JSON)에서 고칠 곳만 작은 패치로 바꿔요. 고칠 곳을 펜으로 표시해 보낼 수도 있어요'],
  ['공개', '받은 파일을 직접 올려요', '올릴 곳을 권하고 버튼 하나로 공개해요. 주소가 열리는지까지 확인해요'],
  ['휴대폰', '따로 열어 봐야 알아요', '모니터·노트북·태블릿·휴대폰 크기로 바꿔 보며 고쳐요'],
];

/** 연수 전·중·뒤: 화면에 들어오면 선이 그려져요 */
function Days() {
  const box = useRef();
  const on = useInView(box, { margin: '-20% 0px', once: true });
  return (
    <section class={`ld-days${on ? ' is-on' : ''}`} ref={box} aria-labelledby="ld-days-h">
      <header class="ld-head">
        <h2 id="ld-days-h">연수 전부터 연수 뒤까지</h2>
        <p class="ld-sub">같은 주소가 연수 전에는 안내, 당일에는 참여, 끝난 뒤에는 다시 보기 자리가 돼요.</p>
      </header>
      <svg class="ld-days-line" viewBox="0 0 1200 48" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M4 30 C 140 6, 260 44, 400 24 S 660 4, 800 24 S 1060 44, 1196 18" /></svg>
      <ol class="ld-days-list">
        <li style={{ '--i': 0 }}><h3><span>전</span>연수 전</h3><ul><li>안내·일정·준비 점검</li><li>접속 확인 페이지</li><li>QR 안내문 인쇄</li></ul></li>
        <li style={{ '--i': 1 }}><h3><span>중</span>연수 중</h3><ul><li>교재 보기·강사 따라 넘기기</li><li>실습 단계·프롬프트 복사·완료 체크</li><li>질문·투표·나눔 보드·퀴즈</li></ul></li>
        <li style={{ '--i': 2 }}><h3><span>뒤</span>연수 뒤</h3><ul><li>다시 보기·자료실</li><li>만족도 조사·나의 기록 내려받기</li><li>이수자 명단 CSV</li></ul></li>
      </ol>
    </section>
  );
}

export function Home() {
  const [list, setList] = useState(null);
  const [more, setMore] = useState(false);
  const [drag, setDrag] = useState(false);
  const [del, setDel] = useState(null);
  const fileRef = useRef(); const pickRef = useRef();
  const reload = () => projects.all().then(setList, () => setList([]));
  useEffect(() => { reload(); }, []);
  // 첫 화면을 먼저 그리고(첫 그림이 빨리 뜨게), 그 아래 이야기는 다음 틈에. 만든 연수 목록과 함께 한 번에 넣어 위쪽이 밀리지 않게
  useEffect(() => {
    if (more) return;
    // 목록이 오래 걸리면(저장소가 막힘) 기다리지 않음
    if (list === null) { const t = setTimeout(() => setMore(true), 1500); return () => clearTimeout(t); }
    let t; const id = requestAnimationFrame(() => { t = setTimeout(() => setMore(true), 0); });
    return () => { cancelAnimationFrame(id); clearTimeout(t); };
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
    return once('blank', async () => {
      const p = await newProject('blank');
      if (files.length) setPendingFiles(p.id, files);
      location.hash = `#/p/${p.id}/1`;
    });
  }
  // 교재 파일을 첫 화면 어디에 놓아도 시작(놓을 자리를 찾지 않게)
  useEffect(() => {
    let n = 0;
    const files = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
    const enter = (e) => { if (!files(e)) return; n++; setDrag(true); };
    const leave = (e) => { if (!files(e)) return; n = Math.max(0, n - 1); if (!n) setDrag(false); };
    const over = (e) => { if (files(e)) e.preventDefault(); };
    const drop = (e) => { if (!files(e)) return; e.preventDefault(); n = 0; setDrag(false); if (e.dataTransfer.files?.length) startWith(e.dataTransfer.files); };
    addEventListener('dragenter', enter); addEventListener('dragleave', leave); addEventListener('dragover', over); addEventListener('drop', drop);
    return () => { removeEventListener('dragenter', enter); removeEventListener('dragleave', leave); removeEventListener('dragover', over); removeEventListener('drop', drop); };
  }, []);
  const pick = () => pickRef.current?.click();
  const fromExample = (id) => once(`ex-${id}`, async () => { const p = await newProject('example', id); location.hash = `#/p/${p.id}/2`; });
  async function onImport(e) {
    const f = e.target.files?.[0]; if (!f) return;
    try { const p = await importProjectFile(f); toast(p.origin === 'skill' ? '에이전트에서 만든 연수를 열었어요.' : '저장한 파일을 열었어요. 참여 기능 연결과 공개 주소는 다시 정해 주세요.'); location.hash = `#/p/${p.id}/${p.stage || 1}`; }
    catch (err) { toast(err.friendly ? err.message : '파일을 열지 못했어요. lecpage에서 저장한 .lecpage 파일인지 확인해 주세요.'); }
    e.target.value = '';
  }
  return (
    <div class="ld">
      <section class="ld-hero" aria-labelledby="ld-h1">
        <div class="ld-hero-t">
          <p class="ld-kicker">교사 연수용 · 무료 · 회원가입 없음</p>
          <h1 id="ld-h1"><span>교재를 넣으면</span> <span><span class="ld-hl">연수 사이트</span>가 나와요</span></h1>
          <p class="ld-lead">PPT·PDF·한글·워드 교재를 놓으면 AI가 읽고 연수 흐름과 문구를 짜요. 주제에 맞는 디자인으로 사이트를 만들고, 공개하면 참가자에게 보낼 주소와 QR이 나와요.</p>
          <button type="button" class={`ld-drop${drag ? ' over' : ''}`} onClick={pick} aria-describedby="ld-drop-sub">
            <span class="ld-drop-btn">교재 넣고 시작하기</span>
            <span class="ld-drop-sub" id="ld-drop-sub"><span><span class="on-mouse">파일을 여기에 놓거나 눌러서 골라요</span><span class="on-touch">눌러서 교재 파일을 골라요</span></span><span>PPT·PDF·한글(HWPX)·워드</span></span>
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

      {!more && <div class="ld-later" aria-hidden="true" />}
      {more && list?.length > 0 && (
        <section class="ld-mine" aria-labelledby="ld-mine-h">
          <div class="section-title"><h2 id="ld-mine-h">내 연수</h2><p class="muted">이 브라우저에 저장돼 있어요. 눌러서 이어서 만들어요.</p></div>
          <div class="grid grid-3">
            {list.map((p) => {
              const st = p.stage || stageOf(p.step || 1);
              return (
                <div class="proj">
                  <a class="proj-link" href={`#/p/${p.id}/${st}`}><h3>{p.title || '이름 없는 연수'}</h3></a>
                  <div class="meta"><span class="tag tag-lav">{STAGE[st]}</span>{p.deploy?.lastUrl && <span class="tag tag-mint">공유 중</span>}<span>{fmtDate(p.updatedAt)}</span></div>
                  <div class="proj-actions">
                    <button class="btn btn-sm btn-quiet" {...busyProps(`dup-${p.id}`, '복제 중…')} onClick={() => once(`dup-${p.id}`, async () => { await duplicateProject(p); toast('복제했어요.'); reload(); }, { stay: true, fail: '복제하지 못했어요. 설정에서 저장 공간을 확인해 주세요.' })}>복제</button>
                    <button class="btn btn-sm btn-quiet" onClick={() => setDel(p)}>지우기</button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {more && <>
      <Story />
      <Showcase />
      <Reach />
      <LiveDay />
      <Days />

      <section class="ld-vs" aria-labelledby="ld-vs-h">
        <header class="ld-head">
          <h2 id="ld-vs-h">AI에게 그냥 맡길 때와 다른 점</h2>
        </header>
        <div class="ld-vs-t" role="table" aria-labelledby="ld-vs-h">
          <div class="ld-vs-r ld-vs-head" role="row"><span role="columnheader"><span class="sr">항목</span></span><span role="columnheader">AI에게 그냥 맡길 때</span><span role="columnheader">lecpage</span></div>
          {COMPARE.map(([k, a, b]) => (
            <div class="ld-vs-r" role="row"><b role="rowheader">{k}</b><span role="cell" data-k="AI에게 그냥 맡길 때">{a}</span><span role="cell" data-k="lecpage">{b}</span></div>
          ))}
        </div>
        <Bench />
      </section>

      <section class="ld-cost" aria-labelledby="ld-cost-h">
        <header class="ld-head">
          <h2 id="ld-cost-h">lecpage에 내는 돈은 없어요</h2>
        </header>
        <dl class="ld-cost-list">
          <div><dt>lecpage</dt><dd><b>0원</b><span>회원가입이 없어요. 교재 읽기부터 사이트 조립까지 이 브라우저 안에서 해요.</span></dd></div>
          <div><dt>AI</dt><dd><b>사이트 하나에 몇백 원쯤</b><span>ChatGPT(OpenAI)나 Claude의 API 키를 한 번 붙여 넣어요. 쓴 만큼 그 회사에 직접 내요. Gemini 무료 키도 되지만 Flash 모델이라 구성과 문구가 단순할 수 있어요. AI 없이 기본 초안만 만들 수도 있어요.</span></dd></div>
          <div><dt>공개·참여 기능</dt><dd><b>강사님 계정의 무료 한도 안에서</b><span>사이트는 Vercel·GitHub Pages 같은 강사님 계정에 올려요. 참여 기능은 구글 시트·Supabase 같은 강사님 계정에 연결해요. 올릴 곳마다 무료 한도를 넘으면 어떻게 되는지 한 줄로 알려 줘요.</span></dd></div>
        </dl>
      </section>

      <section class="ld-skill" aria-labelledby="ld-skill-h">
        <div>
          <p class="ld-kicker">Agent Skill</p>
          <h2 id="ld-skill-h">쓰던 AI 도구에서도 만들어요</h2>
          <p class="ld-sub">Claude Code·Codex·Cursor·Gemini CLI 같은 도구에 넣어 써요. 쓰던 구독 그대로, 같은 엔진으로 만들어요. AI가 HTML을 직접 쓰지 않고 설계도와 짧은 명령으로 만들어요.</p>
        </div>
        <div class="ld-cmd">
          <code>{SKILL_CMD}</code>
          <button type="button" class="btn btn-sm" aria-label="설치 명령 복사" onClick={() => copy(SKILL_CMD, '명령을 복사했어요.')}>복사</button>
          <a class="ld-cmd-help" href="#/help/skill">AI 도구에서 쓰는 법</a>
        </div>
      </section>

      <section class="ld-ex" aria-labelledby="ld-ex-h">
        <div class="section-title"><h2 id="ld-ex-h">예시로 시작하기</h2><p class="muted">마음에 들면 그대로 고쳐 쓰세요.</p></div>
        <div class="grid grid-fill">
          {EXAMPLES.map((x) => (
            <article class="ex-card">
              <a class="ex-img" href={`examples/${x.id}/index.html`} target="_blank" rel="noopener" aria-label={`${x.title} 예시 사이트 새 창으로 보기`}><img src={x.img} alt="" loading="lazy" width="640" height="400" onError={(e) => { e.currentTarget.style.display = 'none'; }} /></a>
              <div class="ex-body">
                <span class="tag tag-lav">{x.kind}</span>
                <h3>{x.title}</h3>
                <p class="small muted">{x.desc}</p>
                <div class="btn-row"><button class="btn btn-sm btn-primary" {...busyProps(`ex-${x.id}`)} onClick={() => fromExample(x.id)}>이 예시로 시작</button><a class="btn btn-sm" href={`examples/${x.id}/index.html`} target="_blank" rel="noopener">예시 보기</a></div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section class="ld-end" aria-labelledby="ld-end-h">
        <Mascot size={72} mood="happy" />
        <h2 id="ld-end-h">교재 하나면 시작할 수 있어요</h2>
        <div class="btn-row">
          <button type="button" class="btn btn-primary btn-lg" onClick={pick}>교재 넣고 시작하기</button>
          <a class="btn btn-lg" href="#/demo">먼저 체험해 보기</a>
          <a class="btn btn-quiet" href="#/help/start">도움말</a>
        </div>
      </section>
      </>}

      {drag && <div class="ld-dropall" aria-hidden="true"><p><Mascot size={64} mood="wow" />놓으면 이 교재로 시작해요</p></div>}
      <Dialog open={!!del} onClose={() => setDel(null)} label="연수 지우기 확인">
        <h2 class="h-sub">"{del?.title || '이름 없는 연수'}"를 지울까요?</h2>
        <p>이 브라우저에 있는 교재·그림·고친 내용이 지워져요. 이미 올린 사이트는 그대로예요. 필요하면 먼저 파일로 저장해 두세요.</p>
        <div class="btn-row"><button class="btn btn-danger" onClick={async () => { await deleteProject(del.id); setDel(null); toast('지웠어요.'); reload(); }}>지우기</button><button class="btn btn-quiet" data-autofocus onClick={() => setDel(null)}>닫기</button></div>
      </Dialog>
    </div>
  );
}
