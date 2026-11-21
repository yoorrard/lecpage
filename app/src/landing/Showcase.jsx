import { REFERENCES, referenceFor } from '../data/references.js';
import { SHOWCASES, shot, siteUrl } from './showcases.js';

/**
 * 참고 디자인(사례 셋): 긴 사이트 그림이 창 안에 들어 있고, 마우스를 올리거나 단추에 초점이 오면 아래로 천천히 흘러가요(사이트를 훑어보는 느낌).
 * 휴대폰에서는 옆으로 밀어 넘기는 줄. 고르면 새 연수의 참고 디자인으로 적고 교재 넣기로(Home의 fromExample, 두 번 눌러도 한 번만).
 */
export function Showcase({ busyProps, fromExample }) {
  const byId = Object.fromEntries(REFERENCES.map((r) => [r.id, r]));
  const list = [...SHOWCASES.map((s) => ({ ...s, ...(byId[s.id] || {}) })), ...REFERENCES.filter((r) => !SHOWCASES.some((s) => s.id === r.id))];
  return (
    <section class="ld-ex" aria-labelledby="ld-ex-h">
      <header class="ld-ex-head">
        <h2 id="ld-ex-h"><span class="ld-kicker">참고 디자인</span>교재가 다르면 사이트도 달라요</h2>
        <p>셋 다 AI가 교재 원본을 읽고 만든 강의 사이트예요. 참가자·강사·발표 화면과 QR 안내문까지 실제로 열어 볼 수 있어요. 마음에 드는 분위기를 고르면 내 교재로 그 결을 살려 만들어요.</p>
      </header>
      <ul class="ld-ex-row">
        {list.map((x, k) => {
          const t = shot(`tall-${x.id}`);
          return (
            <li class={`ld-ex-card${k ? '' : ' is-lead'}`} style={x.c1 ? { '--c1': x.c1 } : undefined}>
              <a class="ld-ex-win" href={siteUrl(x.id)} target="_blank" rel="noopener" aria-label={`${x.name || x.title} 사이트 새 창으로 보기`}>
                <img src={t.src || x.img} width={t.w || 640} height={t.h || 400} alt="" loading="lazy" decoding="async" style={t.h ? { '--h': t.h / t.w } : undefined} />
              </a>
              <div class="ld-ex-body">
                <p class="ld-ex-kind">{x.kind}</p>
                <h3>{x.name || x.title}</h3>
                {x.look && <p class="ld-ex-look">{x.look.join(' · ')}</p>}
                <div class="btn-row">
                  <button type="button" class="btn btn-sm btn-primary" {...busyProps(`ex-${x.id}`)} onClick={() => fromExample(referenceFor(x))}>이 디자인 참고해 만들기</button>
                  <a class="btn btn-sm" href={siteUrl(x.id)} target="_blank" rel="noopener">사이트 보기<span class="ld-sr"> (새 창)</span></a>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <p class="ld-ex-all"><a href="#/gallery">강사 화면·발표 화면까지 자세히 보기<span aria-hidden="true"> →</span></a></p>
    </section>
  );
}
