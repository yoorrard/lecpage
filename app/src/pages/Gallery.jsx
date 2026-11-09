import { useState } from 'preact/hooks';
import { Sheet, Chips } from '../components/ui.jsx';
import { E } from '../lib/engine.js';

const SLOT_KO = { 'hero.title': '첫 화면 제목', 'hero.graphic': '첫 화면 그래픽', 'hero.cta': '시작 버튼', 'section.title': '섹션 제목', 'section.enter': '섹션 등장', divider: '구분 띠', cards: '카드', list: '목록', numbers: '숫자', message: '핵심 문장', schedule: '일정', gallery: '사진', 'closing.title': '마무리 문장', 'closing.graphic': '마무리 그래픽', cursor: '커서', scroll: '스크롤', progress: '진행 표시', celebrate: '축하' };
const LV = ['', '차분', '보통', '화려'];

export function Gallery() {
  const [lv, setLv] = useState('all');
  const fx = E.FX.filter((f) => lv === 'all' || String(f.level) === lv);
  return (
    <div class="stack">
      <div class="step-head"><h1>디자인 사전</h1><p>lecpage가 연수 주제와 분위기에 맞춰 골라 쓰는 프리셋과 효과예요. 이름을 알아 두면 "제목은 글자 등장 효과로" 처럼 부탁하기 쉬워요.</p></div>
      <div class="btn-row">
        <a class="btn btn-primary" href="examples/sel-story/index.html" target="_blank" rel="noopener">견본: 스토리형(SEL 연수)</a>
        <a class="btn btn-primary" href="examples/ai-lab/index.html" target="_blank" rel="noopener">견본: 실습형(AI 실습실)</a>
        <a class="btn" href="fx-demo/demo.html" target="_blank" rel="noopener">효과 전체를 움직여 보기</a>
      </div>
      <div class="section-title"><h2>무드 프리셋 {E.PRESETS.length}종</h2></div>
      <div class="grid grid-3">
        {E.PRESETS.map((p) => { const t = p[p.theme]; return (
          <div class="card preset-card" style={{ padding: 0 }}>
            <div class="sw">{[t.bg, t.primary, t.accent, t.accent2, t.fg].map((c) => <i style={{ background: c }} />)}</div>
            <div class="pc-body"><b>{p.name_ko} <span class="latin muted small">{p.name_en}</span></b><small>{p.desc_ko}</small><small>모션 {LV[p.motion] || '정지'} · 대표 효과 {p.signature || '없음'}</small></div>
          </div>); })}
      </div>
      <div class="section-title"><h2>효과 {E.FX.length}가지</h2>
        <Chips value={lv} onChange={setLv} options={[{ value: 'all', label: '전체' }, { value: '1', label: '차분' }, { value: '2', label: '보통' }, { value: '3', label: '화려' }]} label="강도" />
      </div>
      <div class="fx-grid">
        {fx.map((f) => (
          <div class="card fx-card">
            <div class="spread"><b>{f.name_ko}</b><span class="lv">L{f.level}</span></div>
            <span class="latin small muted">{f.name_en}</span>
            {f.desc_ko && <p class="small">{f.desc_ko}</p>}
            <p class="small muted">쓰는 곳: {(f.slots || []).map((s) => SLOT_KO[s] || s).join(', ')}</p>
            {f.libs?.length > 0 && <span class="tag tag-butter" style={{ justifySelf: 'start' }}>외부 라이브러리</span>}
          </div>
        ))}
      </div>
      <Sheet fold={false}><p class="small">효과는 모두 '움직임 줄이기' 설정과 사이트의 '움직임 멈춤' 버튼을 지켜요. 실습·질문·교재 화면은 늘 차분하게 유지돼요.</p></Sheet>
    </div>
  );
}
