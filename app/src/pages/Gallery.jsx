import { useEffect, useState } from 'preact/hooks';
import { newProject } from '../lib/project.js';
import { toast } from '../lib/util.js';
import { REFERENCES, referenceFor } from '../data/references.js';
import '../styles/gallery.css';

// 참고 디자인(docs/plan-ai-first.md §11): AI가 교재 원본을 읽고 만든 강의 운영 사이트 사례(skills/lecpage/references/designs).
// 사이트는 빌드 때 엔진으로 조립해 둔 것(public/examples/<id>/)이라 참가자·강사·발표 화면과 QR 안내문까지 실제로 열어 볼 수 있어요.
// 고르면 새 연수의 '참고 디자인'에 적고, AI에게 그 분위기 설명(mood)을 건네 내 교재에 맞게 옮기게 함.
// 아래는 디자인 사전(GalleryDict.jsx, 미리보기 묶음이 커서 견본을 먼저 그린 뒤 따로 받음).
const PAGES = [['index.html', '참가자 화면'], ['console.html', '강사 화면'], ['screen.html', '발표 화면'], ['poster.html', 'QR 안내문']];
const KIT_KO = { attend: '출석', poll: '투표', quiz: '퀴즈', word: '낱말 투표', board: '나눔 보드', deck: '교재 넘기기', qa: '질문', survey: '만족도 조사', materials: '자료실', notebook: '모음', join: '접속 QR' };
/** notes.json의 kit(예: 'poll(quiz×3, data-answer)', 'step×3(펼침면)') → '출석 · 퀴즈 · 실습 3단계 · …'(같은 이름은 한 번) */
const kitLine = (kit = []) => [...new Set(kit.map((k) => {
  const st = /^step×(\d+)/.exec(k); if (st) return `실습 ${st[1]}단계`;
  const base = (/^\w+/.exec(k) || [''])[0], inner = (/\((\w+)/.exec(k) || [])[1];
  return base === 'poll' && KIT_KO[inner] ? KIT_KO[inner] : KIT_KO[base] || '';
}).filter(Boolean))].join(' · ');

/** 디자인 사전 조각(견본을 먼저 보여 주고 받음) */
function DictLazy({ open }) {
  const [C, setC] = useState(null);
  const [err, setErr] = useState(false);
  useEffect(() => { let on = true; import('./GalleryDict.jsx').then((m) => on && setC(() => m.GalleryDict), () => on && setErr(true)); return () => { on = false; }; }, []);
  if (err) return <p class="muted">디자인 사전을 불러오지 못했어요. 새로 고침해 주세요.</p>;
  return C ? <C open={open} /> : <p class="muted" aria-live="polite">디자인 사전을 불러오는 중…</p>;
}

export function Gallery({ tab = '' }) {
  /** 사례 고르기: 새 연수의 참고 디자인으로 적고 교재 넣기로 */
  async function chooseRef(r) {
    const p = await newProject({ reference: referenceFor(r) });
    toast(`'${r.title}'을 참고 디자인으로 골랐어요. 교재를 넣고 AI를 선택해 주세요.`);
    location.hash = `#/p/${p.id}/1`;
  }
  // 머리(제목·안내)는 main.jsx가 이 조각 밖에서 먼저 그려 둠(GalleryHead)
  return (
    <>
    <section class="refs" aria-labelledby="refs-h">
      <div class="section-title"><h2 id="refs-h">완성 견본</h2><p>AI가 교재 원본을 읽고 만든 강의 사이트예요. 참가자·강사·발표 화면과 QR 안내문까지 열어 볼 수 있어요.</p></div>
      <div class="grid grid-fill refs-row">
        {REFERENCES.map((r) => (
          <article class="ex-card">
            <a class="ex-img" href={r.url} target="_blank" rel="noopener" aria-label={`${r.title} 사이트 새 창으로 보기`}><img src={r.img} alt="" loading="lazy" width="640" height="400" onError={(e) => { e.currentTarget.style.display = 'none'; }} /></a>
            <div class="ex-body">
              <span class="tag tag-lav">{r.kind}</span>
              <h3>{r.title}</h3>
              {r.desc && <p class="small">{r.desc}</p>}
              <p class="small muted"><b>AI에게 건넬 분위기</b> {r.mood}</p>
              {r.kit.length > 0 && <p class="small muted">강의 기능: {kitLine(r.kit)}</p>}
              <p class="small ref-pages">{PAGES.map(([pg, label], i) => <>{i ? ' · ' : ''}<a href={r.url.replace(/index\.html$/, pg)} target="_blank" rel="noopener">{label}<span class="ext" aria-hidden="true">↗</span></a></>)}</p>
              <div class="btn-row"><button type="button" class="btn btn-sm btn-primary" onClick={() => chooseRef(r)}>이 디자인 참고해 만들기</button><a class="btn btn-sm" href={r.url} target="_blank" rel="noopener">사이트 보기</a></div>
            </div>
          </article>
        ))}
      </div>
      {!REFERENCES.length && <p class="muted">아직 사례가 없어요.</p>}
    </section>
    <DictLazy open={tab} />
    </>
  );
}
