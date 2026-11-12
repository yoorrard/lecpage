import { useEffect, useRef, useState } from 'preact/hooks';
import { Seg, Dialog } from '../components/ui.jsx';
import { SiteThumb } from '../components/SiteThumb.jsx';
import { FxGallery } from '../components/FxGallery.jsx';
import { E, buildSite, previewHtml } from '../lib/engine.js';
import { loadExample } from '../lib/project.js';
import { TASTES, inTaste, mixOrder } from '../lib/tastes.js';

const MOTION = ['정적', '차분하게', '보통', '스크롤 연출'];
const SAMPLES = [{ value: 'sel-story', label: '사회정서학습 연수' }, { value: 'data-lab', label: '디지털 연수' }];
const fontLabel = (k) => E.FONTS[k]?.label || '';
const ENTER_KO = { rise: '떠오름', fade: '번짐', side: '옆에서', wipe: '왼쪽부터 펼침', clip: '위에서 펼침', scale: '살짝 커짐', drop: '내려앉음', flip: '넘어옴' };
/** 본문 연출 한 줄: 섹션이 들어오는 방식(겹치지 않게) + 스크롤·카드 칸의 효과 이름 */
function planLine(p) {
  const plan = E.presetPlan(p);
  const enter = [...new Set(Object.values(plan.enter))].map((m) => ENTER_KO[m] || m).slice(0, 4);
  const fx = [...new Set(Object.values(plan.slots).map((l) => l[0]))].map((id) => E.FX.find((f) => f.id === id)?.name_ko).filter(Boolean).slice(0, 3);
  return `섹션 등장 ${enter.join('·')}${fx.length ? ` · ${fx.join(' · ')}` : ''}`;
}

/** 디자인 하나를 크게: 실제 사이트를 그 디자인으로 만들어 움직이는 그대로 보여 줌 */
function PresetLive({ bp, presetId }) {
  const box = useRef(); const [html, setHtml] = useState(''); const [s, setS] = useState(0.5); const [run, setRun] = useState(0);
  useEffect(() => {
    const el = box.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setS(e.contentRect.width / 1280)); ro.observe(el); return () => ro.disconnect();
  }, []);
  useEffect(() => {
    let off = false; setHtml('');
    const b = { ...bp, design: { ...bp.design, preset: presetId, palette: '', accent: '', fontPair: '', graphic: undefined, signature: '', effects: {}, motion: undefined }, live: { ...(bp.live || {}), provider: 'none', features: [] } };
    buildSite(b, {}).then((r) => { if (!off && !r.errors?.length) setHtml(previewHtml(r.files, 'index.html', { tour: true })); }).catch(() => { });
    return () => { off = true; };
  }, [bp, presetId, run]);
  return (
    <div class="preset-live" ref={box} style={{ '--s': s }}>
      {html ? <iframe sandbox="allow-scripts" srcdoc={html} title="디자인 미리보기" style={{ width: '1280px', height: `${Math.round(720 / 1)}px` }} /> : <span class="thumb-wait" />}
      <button type="button" class="btn btn-sm preset-live-tour" onClick={() => setRun(run + 1)}>본문까지 다시 둘러보기</button>
    </div>
  );
}

export function Gallery() {
  const [sample, setSample] = useState('sel-story');
  const [bp, setBp] = useState(null);
  const [open, setOpen] = useState(null);
  const [taste, setTaste] = useState('all');
  useEffect(() => { let off = false; loadExample(sample).then((b) => { if (!off) setBp(E.validate(b).blueprint); }); return () => { off = true; }; }, [sample]);
  return (
    <div class="stack gallery">
      <div class="step-head"><div class="step-head-t"><h1>디자인 둘러보기</h1><p>연수 주제와 분위기에 맞춰 고르는 디자인 {E.PRESETS.length}가지와 효과 {E.FX.length}가지예요. 눌러서 크게 보세요.</p></div></div>

      <div class="section-title gallery-title"><div><h2>디자인 {E.PRESETS.length}가지</h2><p>같은 내용을 디자인만 바꿔 만든 실제 화면이에요. 카드에 마우스를 올리면 본문까지 내려가요.</p></div>
        <Seg label="예시 내용" value={sample} onChange={setSample} options={SAMPLES} /></div>
      <Seg label="분위기" value={taste} onChange={setTaste} options={TASTES.map((t) => ({ value: t.value, label: t.value === 'all' ? `전체 ${E.PRESETS.length}` : t.label }))} />
      <div class="thumbs gallery-presets">
        {bp ? mixOrder(E.PRESETS).filter((p) => inTaste(p, taste)).map((p) => (
          <button type="button" class="thumb" key={`${sample}-${p.id}`} onClick={() => setOpen(p)}>
            <SiteThumb bp={bp} presetId={p.id} />
            <span class="thumb-cap"><b>{p.name_ko}</b><small>{p.desc_ko}</small></span>
          </button>
        )) : <p class="muted">불러오는 중…</p>}
      </div>

      <div class="section-title"><h2>효과 {E.FX.length}가지</h2><p>카드마다 실제로 움직여요. 사이트에서는 디자인이 알맞은 자리에 골라 쓰고, 대표 효과 하나만 두드러지게 해요.</p></div>
      <FxGallery />
      <p class="small muted">모든 효과는 기기의 '동작 줄이기' 설정과 사이트의 가벼운 모드를 따라요. 실습·질문·교재 화면은 늘 차분해요.</p>

      <Dialog open={!!open} onClose={() => setOpen(null)} label={open?.name_ko || '디자인'} wide>
        {open && bp && <div class="stack">
          <PresetLive bp={bp} presetId={open.id} />
          <h2 class="h-sub">{open.name_ko}</h2>
          <p>{open.desc_ko}</p>
          <dl class="fx-facts">
            <div><dt>글꼴</dt><dd>{[...new Set([fontLabel(open.fonts?.display), fontLabel(open.fonts?.body)].filter(Boolean))].join(' · ')}</dd></div>
            <div><dt>글 배치</dt><dd>{E.LAYOUT_KO[open.layout] || '왼쪽 정렬'}</dd></div>
            <div><dt>페이지 연출</dt><dd>{MOTION[open.motion] || MOTION[1]}</dd></div>
            <div><dt>본문 연출</dt><dd>{planLine(open)}</dd></div>
            <div><dt>{open.showcase ? '첫 화면 그림' : '대표 효과'}</dt><dd>{E.FX.find((f) => f.id === (open.showcase ? open.graphic : open.signature))?.name_ko || (open.showcase ? '연수 제목에서 나온 그림' : '없음')}</dd></div>
          </dl>
          <p class="small muted">교재를 넣으면 주제와 분위기에 맞는 디자인을 먼저 골라 주고, '살펴보고 고치기'에서 바꿀 수 있어요.</p>
          <div class="btn-row"><a class="btn btn-primary" href="#/">교재 넣고 만들기</a><button class="btn btn-quiet" onClick={() => setOpen(null)}>닫기</button></div>
        </div>}
      </Dialog>
    </div>
  );
}
