import { newProject } from '../lib/project.js';
import { toast } from '../lib/util.js';
import { REFERENCES, referenceFor } from '../data/references.js';

// 참고 디자인(docs/plan-ai-first.md §11): AI가 교재를 읽고 자유롭게 만든 강의 사이트 사례(skills/lecpage/references/designs).
// 사이트는 빌드 때 엔진으로 조립해 둔 것(public/examples/<id>/)이라 참가자·강사·발표 화면과 QR 안내문까지 실제로 열어 볼 수 있어요.
// 고르면 새 연수의 '참고 디자인'에 적고, AI에게는 분위기 설명(mood)만 건넴(따를 의무 없음).
const PAGES = [['index.html', '참가자 화면'], ['console.html', '강사 화면'], ['screen.html', '발표 화면'], ['poster.html', 'QR 안내문']];
const KIT_KO = { attend: '출석', poll: '투표', 'poll(word)': '낱말 투표', board: '보드', deck: '교재 넘기기', qa: '질문', survey: '설문', materials: '자료실', join: '접속 QR' };
const kitLine = (kit = []) => kit.map((k) => { const m = /^step×(\d+)$/.exec(k); return m ? `실습 ${m[1]}단계` : KIT_KO[k] || ''; }).filter(Boolean).join(' · ');

export function Gallery() {
  /** 사례 고르기: 새 연수의 참고 디자인으로 적고 교재 넣기로 */
  async function chooseRef(r) {
    const p = await newProject({ reference: referenceFor(r) });
    toast(`'${r.title}'을 참고 디자인으로 골랐어요. 교재를 넣고 AI를 선택해 주세요.`);
    location.hash = `#/p/${p.id}/1`;
  }
  // 머리(제목·안내)는 main.jsx가 이 조각 밖에서 먼저 그려 둠(GalleryHead)
  return (
    <section class="refs" aria-label="강의 사이트 사례">
      <div class="grid grid-fill">
        {REFERENCES.map((r) => (
          <article class="ex-card">
            <a class="ex-img" href={r.url} target="_blank" rel="noopener" aria-label={`${r.title} 사이트 새 창으로 보기`}><img src={r.img} alt="" loading="lazy" width="640" height="400" onError={(e) => { e.currentTarget.style.display = 'none'; }} /></a>
            <div class="ex-body">
              <span class="tag tag-lav">{r.kind}</span>
              <h3>{r.title}</h3>
              {r.desc && <p class="small">{r.desc}</p>}
              <p class="small muted"><b>AI에게 건넬 분위기</b> {r.mood}</p>
              {r.kit.length > 0 && <p class="small muted">참여 기능: {kitLine(r.kit)}</p>}
              <p class="small ref-pages">{PAGES.map(([pg, label], i) => <>{i ? ' · ' : ''}<a href={r.url.replace(/index\.html$/, pg)} target="_blank" rel="noopener">{label}<span class="ext" aria-hidden="true">↗</span></a></>)}</p>
              <div class="btn-row"><button type="button" class="btn btn-sm btn-primary" onClick={() => chooseRef(r)}>이 디자인 참고해 만들기</button><a class="btn btn-sm" href={r.url} target="_blank" rel="noopener">사이트 보기</a></div>
            </div>
          </article>
        ))}
      </div>
      {!REFERENCES.length && <p class="muted">아직 사례가 없어요.</p>}
    </section>
  );
}
