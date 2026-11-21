import { useCart } from '../lib/design-cart.js';

// 첫 화면 CSS(app.css)를 늘리지 않게 모양은 여기에
const S = { display: 'inline-grid', placeItems: 'center', minWidth: '18px', height: '18px', padding: '0 5px', marginLeft: '6px', borderRadius: '99px', background: 'var(--accent)', color: 'var(--on-accent)', fontSize: '.72rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' };

/** 주 메뉴 [참고 디자인] 옆 담은 디자인 개수(담은 게 있을 때만) */
export function CartBadge() {
  const n = useCart().length;
  return n ? <span class="nav-n" style={S} aria-label={`담은 디자인 ${n}개`}>{n}</span> : null;
}
