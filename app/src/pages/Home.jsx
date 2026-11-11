import { useEffect, useRef, useState } from 'preact/hooks';
import { E } from '../lib/engine.js';
import { Mascot } from '../components/Mascot.jsx';
import { Dialog } from '../components/ui.jsx';
import { projects } from '../lib/db.js';
import { newProject, importProjectFile, setPendingFiles, deleteProject, duplicateProject, stageOf } from '../lib/project.js';
import { fmtDate, toast } from '../lib/util.js';

const STAGE = ['', '교재 넣기', '살펴보고 고치기', '공개하기'];
const EXAMPLES = [
  { id: 'data-lab', title: '데이터로 읽는 우리 반', kind: '디지털 연수 · 실습형 3시간', desc: '실습 5개, 도움 요청·진행 현황, 퀴즈, 만족도 설문', img: 'img/example-data-lab.webp' },
  { id: 'sel-story', title: '마음이 먼저 도착하는 교실', kind: '사회정서학습 연수 · 강의형 90분', desc: '핵심 메시지, 다섯 역량, 교재 보기, 투표·나눔 보드', img: 'img/example-sel-story.webp' },
];

export function Home() {
  const [list, setList] = useState(null);
  const [over, setOver] = useState(false);
  const [del, setDel] = useState(null);
  const fileRef = useRef(); const dropRef = useRef();
  const reload = () => projects.all().then(setList, () => setList([]));
  useEffect(() => { reload(); }, []);
  async function startWith(fileList) {
    const files = Array.from(fileList || []); // 입력칸을 비우기 전에 먼저 복사
    const p = await newProject('blank');
    if (files.length) setPendingFiles(p.id, files);
    location.hash = `#/p/${p.id}/1`;
  }
  async function fromExample(id) { const p = await newProject('example', id); location.hash = `#/p/${p.id}/2`; }
  async function onImport(e) {
    const f = e.target.files?.[0]; if (!f) return;
    try { const p = await importProjectFile(f); toast('프로젝트를 열었어요. 참여 기능 연결과 공개 주소는 다시 정해 주세요.'); location.hash = `#/p/${p.id}/${p.stage || 1}`; }
    catch (err) { toast(err.message || '파일을 열지 못했어요.'); }
    e.target.value = '';
  }
  return (
    <>
      <section class="hero">
        <div>
          <h1>교재를 넣으면<br /><span class="hl">연수 사이트</span>가 나와요</h1>
          <p class="lead">PPT·PDF·한글 교재를 놓으면 AI가 연수 흐름과 문구를 짜고, 주제에 맞는 디자인으로 사이트를 만들어요. 단추 하나로 공개하면 주소와 QR이 나와요.</p>
          <div class={`drop drop-home${over ? ' over' : ''}`} ref={dropRef} role="button" tabIndex={0} aria-label="교재 파일을 골라 새 연수 만들기"
            onClick={() => dropRef.current?.querySelector('input')?.click()} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && dropRef.current?.querySelector('input')?.click()}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); startWith(e.dataTransfer.files); }}>
            <b><span class="on-mouse">교재 파일을 여기에 놓으세요</span><span class="on-touch">교재 파일 고르기</span></b>
            <span class="small muted">PPT·PDF·한글(HWPX)·워드<span class="on-mouse"> · 눌러서 골라도 돼요</span></span>
            <input type="file" multiple hidden accept=".pptx,.ppsx,.pdf,.hwpx,.docx,.txt,.md,.hwp,.ppt,.doc" onClick={(e) => e.stopPropagation()} onChange={(e) => { startWith(e.target.files); e.target.value = ''; }} />
          </div>
          <div class="btn-row" style={{ marginTop: '12px' }}>
            <button class="btn btn-quiet" onClick={() => startWith([])}>교재 없이 시작하기</button>
            <button class="btn btn-quiet" onClick={() => fileRef.current?.click()}>저장한 파일 열기(.lecpage)</button>
            <input ref={fileRef} type="file" accept=".lecpage,.zip,.json" hidden onChange={onImport} />
          </div>
          <p class="small muted" style={{ marginTop: '10px' }}>회원가입 없이 무료. 교재는 이 브라우저에서 읽고, AI를 쓸 때만 연결한 AI 회사로 보내요.</p>
        </div>
        <div class="hero-art" aria-hidden="true">
          <div class="shot shot-back"><i class="shot-bar"><b /><b /><b /></i><img src="img/example-data-lab.webp" alt="" width="640" height="400" /></div>
          <div class="shot shot-front"><i class="shot-bar"><b /><b /><b /></i><img src="img/example-sel-story.webp" alt="" width="640" height="400" /></div>
          <div class="shot-file"><Mascot size={64} /><span><b>연수교재.pptx</b><small>32쪽</small></span></div>
        </div>
      </section>

      <section class="why" aria-labelledby="why-h">
        <h2 id="why-h" class="sr">lecpage의 강점</h2>
        <dl class="why-list">
          <div><dt>교재만 넣으면 공개 주소까지</dt><dd>AI가 교재를 읽어 구성과 문구를 짜고, 단추 하나로 공개해요. 주소·QR·카톡 안내 문구가 함께 나와요.</dd></div>
          <div><dt>'AI가 만든 티'가 나지 않아요</dt><dd>디자인 {E.PRESETS.length}가지마다 첫 화면 구성과 글꼴이 다르고, 정적인 페이지부터 스크롤 연출까지 골라요. 교재의 주제와 글꼴을 읽어 고르고, 흔한 AI 사이트의 버릇은 자동 점검으로 걸러요.</dd></div>
          <div><dt>연수에 필요한 것이 이미 들어 있어요</dt><dd>실습 안내·프롬프트 복사·교재 보기, 질문·도움 요청·진행 현황, 발표 화면 QR과 이수자 명단까지. 일반 홈페이지 도구에는 없는 것들이에요.</dd></div>
          <div><dt>무료이고 가벼워요</dt><dd>회원가입이 없고, AI는 바꿀 곳만 읽어 비용이 적게 들어요. 참가자 기록은 강사님 계정에만 쌓여요.</dd></div>
        </dl>
      </section>
      <div class="section-title"><h2>예시로 시작하기</h2><p class="muted">마음에 들면 그대로 고쳐 쓰세요.</p></div>
      <div class="grid grid-fill">
        {EXAMPLES.map((x) => (
          <article class="ex-card">
            <a class="ex-img" href={`examples/${x.id}/index.html`} target="_blank" rel="noopener" aria-label={`${x.title} 예시 사이트 새 창으로 보기`}><img src={x.img} alt="" loading="lazy" width="640" height="400" onError={(e) => { e.currentTarget.style.display = 'none'; }} /></a>
            <div class="ex-body">
              <span class="tag tag-lav">{x.kind}</span>
              <h3>{x.title}</h3>
              <p class="small muted">{x.desc}</p>
              <div class="btn-row"><button class="btn btn-sm btn-primary" onClick={() => fromExample(x.id)}>이 예시로 시작</button><a class="btn btn-sm" href={`examples/${x.id}/index.html`} target="_blank" rel="noopener">예시 보기</a></div>
            </div>
          </article>
        ))}
      </div>

      <div class="section-title"><h2>내 연수</h2></div>
      {list === null ? <p class="muted">불러오는 중…</p> : list.length === 0 ? (
        <div class="empty"><Mascot size={84} mood="sleep" /><p>아직 만든 연수가 없어요. 위에 교재 파일을 놓아 시작해 보세요.</p></div>
      ) : (
        <div class="grid grid-3">
          {list.map((p) => {
            const st = p.stage || stageOf(p.step || 1);
            return (
              <div class="proj">
                <a class="proj-link" href={`#/p/${p.id}/${st}`}><h3>{p.title || '이름 없는 연수'}</h3></a>
                <div class="meta"><span class="tag tag-lav">{STAGE[st]}</span>{p.deploy?.lastUrl && <span class="tag tag-mint">공유 중</span>}<span>{fmtDate(p.updatedAt)}</span></div>
                <div class="proj-actions">
                  <button class="btn btn-sm btn-quiet" onClick={async () => { await duplicateProject(p); toast('복제했어요.'); reload(); }}>복제</button>
                  <button class="btn btn-sm btn-quiet" onClick={() => setDel(p)}>지우기</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <Dialog open={!!del} onClose={() => setDel(null)} label="연수 지우기 확인">
        <h2 class="h-sub">"{del?.title || '이름 없는 연수'}"를 지울까요?</h2>
        <p>이 브라우저에 있는 교재·그림·고친 내용이 지워져요. 이미 올린 사이트는 그대로예요. 필요하면 먼저 파일로 저장해 두세요.</p>
        <div class="btn-row"><button class="btn btn-danger" onClick={async () => { await deleteProject(del.id); setDel(null); toast('지웠어요.'); reload(); }}>지우기</button><button class="btn btn-quiet" onClick={() => setDel(null)}>취소</button></div>
      </Dialog>
    </>
  );
}
