import { shot, shotSize } from './facts.js';

/**
 * 같은 교재·같은 AI로 견준 실제 결과(2026-11-21 측정). 왜 lecpage(Why.jsx) 머리 아래, 장부 앞에 놓여요.
 * 그림: 두 결과의 첫 화면을 그대로 찍은 것(넓은 화면 1280px, 좁은 화면 390px). shots/cmp-*.webp, 크기는 shots.json.
 * 수치: 측정 기록 그대로. 재는 방법과 한계: docs/research/benchmark-2026-11.md 7장. 다시 재면 이 표와 그림을 함께 바꿔요.
 */
const ROWS = [
  ['첫 화면', '정보를 늘어놓은 페이지', '주제를 그린 삽화'],
  ['휴대폰 낱말 갈림', '4곳', '0곳'],
  ['교재 사실 25개', '25개 맞음', '25개 맞음'],
  ['참여 기능', '없음', '질문·출석·도움 요청 등'],
  ['배포·QR', '강사가 직접', '앱에서 바로'],
  ['만든 시간', '약 3분', '약 12분'],
];

function Shot({ name, lane, alt }) {
  const big = shotSize(name), small = shotSize(`${name}-m`);
  return (
    <figure class={`ld-cmp-shot ${lane}`}>
      <figcaption class="ld-lane">{lane === 'is-lp' ? 'lecpage' : 'AI 에이전트에 그냥 맡길 때'}</figcaption>
      <div class="ld-cmp-frame">
        <i class="ld-bar"><b /><b /><b /></i>
        <picture>
          <source media="(max-width: 699.98px)" srcset={shot(`${name}-m`)} width={small.w} height={small.h} />
          <img src={shot(name)} alt={alt} width={big.w} height={big.h} loading="lazy" decoding="async" />
        </picture>
      </div>
    </figure>
  );
}

export function Compare() {
  return (
    <div class="ld-cmp">
      <h3 class="ld-h3">같은 교재, 같은 AI로 만들어 봤어요</h3>
      <p class="ld-cmp-sub">lecpage는 교재 원본과 목표 한 문장만 건네고 디자인은 AI에게 맡겨요. 같은 AI의 실력은 그대로 살리고, 강의에 필요한 것을 더해요.</p>
      <div class="ld-cmp-shots">
        <Shot name="cmp-agent" lane="is-base" alt="그냥 맡겨 만든 사이트의 첫 화면: 연수명과 일정 표를 늘어놓은 정보 페이지" />
        <Shot name="cmp-lecpage" lane="is-lp" alt="lecpage로 만든 사이트의 첫 화면: 빨간 펜으로 고친 수업 지도안과 손글씨 메모를 그린 삽화, 공책 줄 바탕" />
      </div>
      <table class="ld-cmp-t">
        <thead><tr><th scope="col"><span class="ld-sr">견준 것</span></th><th scope="col">그냥 맡길 때</th><th scope="col">lecpage</th></tr></thead>
        <tbody>{ROWS.map(([k, a, b]) => <tr><th scope="row">{k}</th><td>{a}</td><td>{b}</td></tr>)}</tbody>
      </table>
      <p class="ld-bench-foot">2026-11-21, 30쪽 PDF 교재(가상의 교원 연수)를 Claude에게 한 번씩 맡겨 잰 값이에요. lecpage는 내 PC 연결(Claude Code)로 만들었고, 복사할 요청 글 7개도 교재 원문 그대로였어요. 키로 연결하면 약 8분 걸렸어요.</p>
    </div>
  );
}
