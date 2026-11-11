import { useEffect, useRef, useState } from 'preact/hooks';
import { Seg, Dialog } from '../components/ui.jsx';
import { SiteThumb } from '../components/SiteThumb.jsx';
import { FxGallery } from '../components/FxGallery.jsx';
import { E, buildSite, previewHtml } from '../lib/engine.js';
import { loadExample } from '../lib/project.js';

const MOTION = ['움직임 없음', '차분하게', '보통', '화려하게'];
const SAMPLES = [{ value: 'sel-story', label: '사회정서학습 연수' }, { value: 'data-lab', label: '디지털 연수' }];
const fontLabel = (k) => E.FONTS[k]?.label || '';

/** 디자인 하나를 크게: 실제 사이트를 그 디자인으로 만들어 움직이는 그대로 보여 줌 */
function PresetLive({ bp, presetId }) {
  const box = useRef(); const [html, setHtml] = useState(''); const [s, setS] = useState(0.5);
  useEffect(() => {
    const el = box.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setS(e.contentRect.width / 1280)); ro.observe(el); return () => ro.disconnect();
  }, []);
  useEffect(() => {
    let off = false; setHtml('');
    const b = { ...bp, design: { ...bp.design, preset: presetId, palette: '', accent: '', fontPair: '', graphic: undefined, signature: '', effects: {}, motion: undefined }, live: { ...(bp.live || {}), provider: 'none', features: [] } };
    buildSite(b, {}).then((r) => { if (!off && !r.errors?.length) setHtml(previewHtml(r.files, 'index.html')); }).catch(() => { });
    return () => { off = true; };
  }, [bp, presetId]);
  return (
    <div class="preset-live" ref={box} style={{ '--s': s }}>
      {html ? <iframe sandbox="allow-scripts" srcdoc={html} title="디자인 미리보기" style={{ width: '1280px', height: `${Math.round(720 / 1)}px` }} /> : <span class="thumb-wait" />}
    </div>
  );
}

export function Gallery() {
  const [sample, setSample] = useState('sel-story');
  const [bp, setBp] = useState(null);
  const [open, setOpen] = useState(null);
  useEffect(() => { let off = false; loadExample(sample).then((b) => { if (!off) setBp(E.validate(b).blueprint); }); return () => { off = true; }; }, [sample]);
  return (
    <div class="stack gallery">
      <div class="step-head"><div class="step-head-t"><h1>디자인 둘러보기</h1><p>연수 주제와 분위기에 맞춰 고르는 디자인 {E.PRESETS.length}가지와 효과 {E.FX.length}가지예요. 눌러서 크게 보세요.</p></div></div>

      <div class="section-title gallery-title"><div><h2>디자인 {E.PRESETS.length}가지</h2><p>같은 내용을 디자인만 바꿔 만든 실제 첫 화면이에요.</p></div>
        <Seg label="예시 내용" value={sample} onChange={setSample} options={SAMPLES} /></div>
      <div class="thumbs gallery-presets">
        {bp ? E.PRESETS.map((p) => (
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
            <div><dt>움직임</dt><dd>{MOTION[open.motion] || MOTION[1]}</dd></div>
            <div><dt>대표 효과</dt><dd>{E.FX.find((f) => f.id === open.signature)?.name_ko || '없음'}</dd></div>
          </dl>
          <p class="small muted">교재를 넣으면 주제와 분위기에 맞는 디자인을 먼저 골라 주고, '살펴보고 고치기'에서 바꿀 수 있어요.</p>
          <div class="btn-row"><a class="btn btn-primary" href="#/">교재 넣고 만들기</a><button class="btn btn-quiet" onClick={() => setOpen(null)}>닫기</button></div>
        </div>}
      </Dialog>
    </div>
  );
}
