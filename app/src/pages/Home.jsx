import { useEffect, useRef, useState } from 'preact/hooks';
import { Mascot } from '../components/Mascot.jsx';
import { Sheet } from '../components/ui.jsx';
import { projects } from '../lib/db.js';
import { newProject, importProjectFile } from '../lib/project.js';
import { fmtDate, toast } from '../lib/util.js';

const STEP_NAMES = ['', '자료', '연수 정보', 'AI 설계', '내용 다듬기', '디자인', '운영 방식', '완성·배포'];

export function Home() {
  const [list, setList] = useState(null);
  const fileRef = useRef();
  useEffect(() => { projects.all().then(setList, () => setList([])); }, []);
  const start = async (kind) => { const p = await newProject(kind); location.hash = `#/p/${p.id}/${kind === 'example' ? 5 : 1}`; };
  const onImport = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    try { const p = await importProjectFile(f); toast('프로젝트를 열었어요.'); location.hash = `#/p/${p.id}/${p.step || 1}`; }
    catch (err) { toast(err.message || '파일을 열지 못했어요.'); }
    e.target.value = '';
  };
  return (
    <>
      <section class="hero">
        <div>
          <h1>교재를 넣으면<br /><span class="hl">연수 사이트</span>가 나와요</h1>
          <p class="lead">PPT·PDF·한글 교재와 연수 정보만 준비하세요. 실습 안내, 프롬프트 복사, 실시간 질문, 진행 현황판까지 갖춘 사이트를 연수 주제에 맞는 디자인으로 만들어 드려요.</p>
          <div class="btn-row">
            <button class="btn btn-primary btn-lg" onClick={() => start('blank')}>새 연수 사이트 만들기</button>
            <button class="btn btn-lg" onClick={() => start('example')}>견본으로 둘러보기</button>
          </div>
          <p class="small muted" style={{ marginTop: '14px' }}>회원가입 없이 무료. 교재와 AI 키는 이 브라우저 밖으로 나가지 않아요.</p>
        </div>
        <div class="hero-art" aria-hidden="true">
          <div class="page-stack">
            <div class="sheet" style={{ padding: '18px' }}><div class="line-ph" style={{ width: '60%' }} /><div class="line-ph" /><div class="line-ph" style={{ width: '80%' }} /></div>
            <div class="sheet" style={{ padding: '18px' }}><div class="line-ph" style={{ width: '40%', background: 'var(--lav)' }} /><div class="line-ph" /><div class="line-ph" style={{ width: '70%' }} /></div>
            <div class="sheet"><Mascot size={150} look bob /></div>
          </div>
        </div>
      </section>

      <div class="steps-3">
        <div class="card"><span class="n">1</span><h3>교재를 올려요</h3><p class="muted">PPT·PDF·한글(HWPX)·워드. 브라우저 안에서 읽어서 쪽·실습 단계·프롬프트·도구를 찾아요.</p></div>
        <div class="card"><span class="n">2</span><h3>쓰고 있는 AI로 설계해요</h3><p class="muted">쓰는 챗봇에 복사해 붙여 넣거나, 무료 Gemini 키를 넣어요. AI 없이 자동 초안도 돼요.</p></div>
        <div class="card"><span class="n">3</span><h3>골라서 바로 배포해요</h3><p class="muted">디자인 3안 중 고르고, 인원·기능에 맞는 운영 방식을 추천받아 GitHub·Netlify에 올리거나 ZIP으로 받아요.</p></div>
      </div>

      <div class="section-title"><h2>내 연수</h2>
        <div class="btn-row"><button class="btn btn-sm" onClick={() => fileRef.current?.click()}>프로젝트 파일 열기(.lecpage)</button><input ref={fileRef} type="file" accept=".lecpage,.zip,.json" hidden onChange={onImport} /></div>
      </div>
      {list === null ? <p class="muted">불러오는 중…</p> : list.length === 0 ? (
        <div class="empty"><Mascot size={84} mood="sleep" /><p>아직 만든 연수가 없어요. 위의 "새 연수 사이트 만들기"로 시작해 보세요.</p></div>
      ) : (
        <div class="grid grid-3">
          {list.map((p) => (
            <a class="proj" href={`#/p/${p.id}/${p.step || 1}`}>
              <h3>{p.title || '이름 없는 연수'}</h3>
              <div class="meta"><span class="tag tag-lav">{STEP_NAMES[p.step || 1]} 단계</span>{p.blueprint?.design?.preset && <span>{p.blueprint.design.preset}</span>}<span>{fmtDate(p.updatedAt)}</span></div>
            </a>
          ))}
        </div>
      )}

      <div class="section-title"><h2>AI 도구 안에서도 쓸 수 있어요</h2></div>
      <Sheet>
        <div class="stack">
          <p>Claude Code·Codex·Cursor·Gemini CLI·Antigravity처럼 AI 도구를 쓰고 있다면, lecpage를 <b>skill</b>로 설치해 그 도구 안에서 바로 만들 수 있어요. 구독 중인 AI를 그대로 쓰니 키가 필요 없어요.</p>
          <pre class="prompt-box">npx skills add yoorrard/lecpage</pre>
          <p class="small muted">claude.ai에서는 저장소의 skills/lecpage 폴더를 ZIP으로 묶어 '스킬 올리기'로 추가할 수 있어요. 자세한 방법은 도움말에 있어요.</p>
        </div>
      </Sheet>
    </>
  );
}
