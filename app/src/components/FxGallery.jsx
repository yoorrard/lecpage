import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Seg, Dialog } from './ui.jsx';
import { E } from '../lib/engine.js';

// 효과를 '어디에 쓰는지'로 묶어 보여 줍니다(디자인 용어를 몰라도 고를 수 있게).
export const FX_GROUPS = [
  { value: 'all', label: '전체' },
  { value: 'text', label: '글자' },
  { value: 'scroll', label: '스크롤' },
  { value: 'interaction', label: '반응' },
  { value: 'graphic', label: '배경' },
];
const GROUP_OF = (f) => (f.group === 'lib' ? 'scroll' : f.group);
const LV = ['늘 켜짐', '차분', '보통', '화려'];
const SLOT_KO = { 'hero.title': '첫 화면 제목', 'hero.graphic': '첫 화면 배경', 'hero.cta': '시작 단추', 'section.title': '섹션 제목', 'section.enter': '섹션이 나타날 때', divider: '구분 띠', cards: '카드', list: '목록', numbers: '숫자', message: '핵심 메시지', schedule: '일정표', gallery: '사진', progress: '진행 표시', scroll: '스크롤', cursor: '마우스', celebrate: '완료했을 때', 'closing.title': '마무리 문장', 'closing.graphic': '마무리 배경' };
export const slotsKo = (f) => [...new Set((f.slots || []).map((s) => SLOT_KO[s] || s))].join(' · ');
const TREND = { up: '요즘 많이 써요', warn: '아껴 써요' };

/** 효과 하나가 실제로 움직이는 작은 화면. 보일 때만 켜고, 멀어지면 끕니다(한꺼번에 수십 개가 돌지 않게) */
export function FxLive({ id, theme = '', big = false }) {
  const box = useRef(); const [on, setOn] = useState(big);
  useEffect(() => {
    if (big) return;
    const el = box.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => setOn(e.isIntersecting), { rootMargin: '120px' });
    io.observe(el); return () => io.disconnect();
  }, [big]);
  const src = `fx-demo/demo.html?fx=${encodeURIComponent(id)}&embed=1${theme ? `&theme=${theme}` : ''}`;
  return (
    <div class={`fx-live${big ? ' big' : ''}`} ref={box}>
      {on ? <iframe src={src} title="" tabIndex={-1} aria-hidden="true" loading="lazy" sandbox="allow-scripts allow-same-origin" /> : <span class="thumb-wait" />}
    </div>
  );
}

/**
 * 효과 모음: 카드마다 움직이는 미리보기. 누르면 크게 보고 설명을 읽습니다.
 * onUse(f)가 있으면 크게 보기에 [이 효과 쓰기]가 생깁니다. usable(f)로 쓸 수 있는 효과만 고를 수 있게 합니다.
 */
export function FxGallery({ onUse, usable, picked, useLabel = '이 효과 쓰기', only }) {
  const [group, setGroup] = useState('all');
  const [lv, setLv] = useState('all');
  const [open, setOpen] = useState(null);
  const all = useMemo(() => (only ? E.FX.filter(only) : E.FX), [only]);
  const list = all.filter((f) => (group === 'all' || GROUP_OF(f) === group) && (lv === 'all' || String(f.level) === lv));
  const groups = FX_GROUPS.filter((g) => g.value === 'all' || all.some((f) => GROUP_OF(f) === g.value));
  return (
    <div class="stack">
      <div class="fx-filters">
        <Seg label="종류" value={group} onChange={setGroup} options={groups.map((g) => ({ value: g.value, label: g.value === 'all' ? `전체 ${all.length}` : g.label }))} />
        <Seg label="움직임 세기" value={lv} onChange={setLv} options={[{ value: 'all', label: '세기 전체' }, { value: '1', label: '차분' }, { value: '2', label: '보통' }, { value: '3', label: '화려' }]} />
      </div>
      <div class="fx-grid">
        {list.map((f) => (
          <button type="button" class="fx-card" key={f.id} aria-pressed={picked === f.id ? 'true' : undefined} onClick={() => setOpen(f)}>
            <FxLive id={f.id} />
            <span class="fx-cap"><b>{f.name_ko}</b><span class="lv">{LV[f.level] || ''}</span></span>
            <span class="fx-where">{slotsKo(f)}</span>
          </button>
        ))}
        {!list.length && <p class="muted">이 조건에 맞는 효과가 없어요.</p>}
      </div>
      <Dialog open={!!open} onClose={() => setOpen(null)} label={open?.name_ko || '효과'} wide>
        {open && <div class="stack">
          <FxLive id={open.id} big />
          <div class="spread"><h2 class="h-sub">{open.name_ko}</h2><span class="fx-tags"><span class="lv">{LV[open.level]}</span>{TREND[open.trend] && <span class="small muted">{TREND[open.trend]}</span>}</span></div>
          <p>{open.desc_ko}</p>
          <dl class="fx-facts">
            <div><dt>쓰는 곳</dt><dd>{slotsKo(open)}</dd></div>
            {open.a11y_ko && <div><dt>배려</dt><dd>{open.a11y_ko}</dd></div>}
            {open.libs?.length > 0 && <div><dt>참고</dt><dd>바깥 파일을 받아 써요. 학교망에서 막히면 이 효과만 저절로 빠져요.</dd></div>}
          </dl>
          {onUse && <div class="btn-row">
            {(!usable || usable(open)) ? <button class="btn btn-primary" onClick={() => { onUse(open); setOpen(null); }}>{picked === open.id ? '쓰는 중이에요' : useLabel}</button> : <span class="small muted">이 효과는 디자인이 알맞은 자리에 알아서 써요.</span>}
            <button class="btn btn-quiet" onClick={() => setOpen(null)}>닫기</button>
          </div>}
        </div>}
      </Dialog>
    </div>
  );
}
