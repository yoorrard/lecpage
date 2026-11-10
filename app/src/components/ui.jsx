import { useEffect, useRef, useState } from 'preact/hooks';
import { onToast } from '../lib/util.js';

/** 로고의 접힌 모서리 */
export function Fold() {
  return (
    <svg class="fold" viewBox="0 0 34 34" aria-hidden="true">
      <path d="M0 -1H35V34Z" style={{ fill: 'var(--bg)' }} />
      <path d="M.5 .5L33.5 33.5H9.5Q.5 33.5 .5 24.5Z" style={{ fill: 'var(--lav-fold)' }} stroke="var(--line-strong)" stroke-width="1" stroke-linejoin="round" />
    </svg>
  );
}
export function Sheet({ fold = true, class: cls = '', children, ...rest }) {
  return <section class={`sheet ${cls}`} {...rest}>{fold && <Fold />}{children}</section>;
}

export function Toast() {
  const [msg, setMsg] = useState(''); const [on, setOn] = useState(false); const t = useRef();
  useEffect(() => onToast((m) => { setMsg(m); setOn(true); clearTimeout(t.current); t.current = setTimeout(() => setOn(false), 2600); }), []);
  return <div class={`toast${on ? ' on' : ''}`} role="status" aria-live="polite">{msg}</div>;
}

export function Field({ label, hint, children }) {
  return <label class="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

/** 고르기 칩: multiple이면 배열 값 */
export function Chips({ options, value, onChange, multiple = false, label }) {
  const isOn = (v) => (multiple ? (value || []).includes(v) : value === v);
  const toggle = (v) => {
    if (!multiple) return onChange(v);
    const cur = new Set(value || []); cur.has(v) ? cur.delete(v) : cur.add(v); onChange([...cur]);
  };
  return (
    <div class="chips" role="group" aria-label={label}>
      {options.map((o) => {
        const v = typeof o === 'string' ? o : o.value; const t = typeof o === 'string' ? o : o.label;
        return <button type="button" class="chip" aria-pressed={String(isOn(v))} onClick={() => toggle(v)}>{t}</button>;
      })}
    </div>
  );
}

export function Seg({ options, value, onChange, label }) {
  return (
    <div class="seg" role="group" aria-label={label}>
      {options.map((o) => <button type="button" aria-pressed={String(value === o.value)} onClick={() => onChange(o.value)}>{o.label}</button>)}
    </div>
  );
}

export function Dialog({ open, onClose, children, label, wide }) {
  const ref = useRef();
  useEffect(() => { const d = ref.current; if (!d) return; if (open && !d.open) d.showModal?.(); if (!open && d.open) d.close(); }, [open]);
  return <dialog ref={ref} class={`dlg${wide ? ' dlg-wide' : ''}`} aria-label={label} onClose={onClose} onCancel={onClose}><div class="dlg-in">{children}<button class="icon-btn dlg-x" onClick={onClose} aria-label="닫기">✕</button></div></dialog>;
}

/** 탭(내용·디자인·참여 기능·연수 정보·수정 요청) */
export function Tabs({ tabs, value, onChange, label }) {
  return (
    <div class="tabs" role="tablist" aria-label={label}>
      {tabs.map((t) => <button type="button" role="tab" id={`tab-${t.value}`} aria-selected={String(value === t.value)} aria-controls={`panel-${t.value}`} tabIndex={value === t.value ? 0 : -1}
        onClick={() => onChange(t.value)}
        onKeyDown={(e) => { const i = tabs.findIndex((x) => x.value === value); const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (d) { e.preventDefault(); const n = tabs[(i + d + tabs.length) % tabs.length]; onChange(n.value); setTimeout(() => document.getElementById(`tab-${n.value}`)?.focus(), 0); } }}>{t.label}{t.badge ? <span class="tab-badge">{t.badge}</span> : null}</button>)}
    </div>
  );
}

export function Progress({ pct }) { return <div class="progress" role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100"><i style={{ '--w': `${pct}%` }} /></div>; }

export function Notice({ kind = '', children }) { return <div class={`notice ${kind}`}>{children}</div>; }
