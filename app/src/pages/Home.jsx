import { useEffect, useRef, useState } from 'preact/hooks';
import { Mascot } from '../components/Mascot.jsx';
import { Dialog } from '../components/ui.jsx';
import { projects } from '../lib/db.js';
import { newProject, importProjectFile, setPendingFiles, deleteProject, duplicateProject, stageOf } from '../lib/project.js';
import { fmtDate, toast } from '../lib/util.js';

const STAGE = ['', '교재 넣기', '살펴보고 고치기', '공유하기'];
const EXAMPLES = [
  { id: 'data-lab', title: '데이터로 읽는 우리 반', kind: '실습형 · 3시간', desc: '실습 다섯 정거장, 막혔어요·진행 체크, 퀴즈, 만족도 설문', img: 'img/example-data-lab.webp' },
  { id: 'forest-story', title: '숲이 교과서가 되는 날', kind: '이야기형 · 90분', desc: '핵심 메시지, 교재 넘겨 보기, 숲 관찰 도구, 나눔 보드', img: 'img/example-forest-story.webp' },
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
          <p class="lead">PPT·PDF·한글 교재를 놓으면 실습 안내, 프롬프트 복사, 교재 넘겨 보기를 갖춘 사이트 초안이 바로 나와요. 질문 받기·진행 체크·만족도 설문도 켤 수 있어요.</p>
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
          <p class="small muted" style={{ marginTop: '10px' }}>회원가입 없이 무료. 교재는 이 브라우저 안에서만 읽어요.</p>
        </div>
        <div class="hero-art" aria-hidden="true">
          <div class="page-stack">
            <div class="sheet" style={{ padding: '18px' }}><div class="line-ph" style={{ width: '60%' }} /><div class="line-ph" /><div class="line-ph" style={{ width: '80%' }} /></div>
            <div class="sheet" style={{ padding: '18px' }}><div class="line-ph" style={{ width: '40%', background: 'var(--lav)' }} /><div class="line-ph" /><div class="line-ph" style={{ width: '70%' }} /></div>
            <div class="sheet"><Mascot size={150} look bob /></div>
          </div>
        </div>
      </section>

      <div class="section-title"><h2>견본에서 시작하기</h2><span class="small muted">마음에 들면 그대로 고쳐 쓰세요.</span></div>
      <div class="grid grid-2">
        {EXAMPLES.map((x) => (
          <article class="ex-card">
            <a class="ex-img" href={`examples/${x.id}/index.html`} target="_blank" rel="noopener" aria-label={`${x.title} 견본 사이트 새 창으로 보기`}><img src={x.img} alt="" loading="lazy" width="640" height="400" onError={(e) => { e.currentTarget.style.display = 'none'; }} /></a>
            <div class="ex-body">
              <span class="tag tag-lav">{x.kind}</span>
              <h3>{x.title}</h3>
              <p class="small muted">{x.desc}</p>
              <div class="btn-row"><button class="btn btn-sm btn-primary" onClick={() => fromExample(x.id)}>이 견본으로 시작</button><a class="btn btn-sm" href={`examples/${x.id}/index.html`} target="_blank" rel="noopener">견본 보기</a></div>
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
