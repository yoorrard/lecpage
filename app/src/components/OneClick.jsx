// 바깥 계정에 '버튼 하나'로 배포·연결하는 화면의 공통 조각. 곳(Cloudflare·Vercel·Netlify·GitHub·Supabase …)과
// 연결 방법(커넥트 경유 로그인·브라우저 로그인·토큰 붙여넣기)이 달라도 모양은 같게:
//   [○○ 계정으로 배포] 하나 → 처음에만 로그인·허용 → 다음부터는 [다시 배포하기]만 · 진행은 한 줄 + 사람이 할 일 하나 · 실패는 까닭 + 누를 곳 하나
//   OneClickCard: 카드 모양(칸 → 버튼 → 진행 → 실패 → 접힌 '다른 방법')  ·  RunProgress · RunFail · AskPick · AskName · useRun
// view(진행 상태)는 { running, phase, seconds?, loginUrl?, ask?: { kind, … }, account?: { name } } — 커넥트의 createRunner.view()와 같은 꼴
import { useEffect, useRef, useState } from 'preact/hooks';

/** 물음: 여럿 가운데 하나 고르기(계정·팀·프로젝트). items [{ id, name }] */
export function AskPick({ label, items, onPick }) {
  const [sent, setSent] = useState(false);
  return (
    <div class="stack" style={{ gap: '6px' }} role="group" aria-label={label}>
      {items.map((x) => <button type="button" class="btn btn-sm run-pick" key={x.id} disabled={sent} onClick={() => { setSent(true); onPick(x.id); }}>{x.name || String(x.id).slice(0, 8)}</button>)}
    </div>
  );
}
/** 물음: 이름 하나 정하기(주소에 들어갈 이름 등). suggest를 채워 두고 [계속]. problem: 다시 묻는 까닭 한 줄, round: 몇 번째 물음인지 */
export function AskName({ label, lead, suggest = '', pattern, clean = (v) => v, problem = '', round = 0, onName }) {
  const [v, setV] = useState(suggest);
  const [sent, setSent] = useState(false);
  useEffect(() => { setSent(false); }, [problem, round]); // 같은 까닭으로 다시 물어도 버튼이 살아나게
  const ok = pattern.test(v);
  const go = () => { if (ok && !sent) { setSent(true); onName(v); } };
  return (
    <div class="stack" style={{ gap: '6px' }}>
      {lead && <p class="small">{typeof lead === 'function' ? lead(v) : lead}</p>}
      <div class="row token-row">
        <input class="input" value={v} maxLength={63} autoComplete="off" autoCapitalize="off" spellcheck={false} aria-label={label} aria-invalid={v && !ok ? 'true' : undefined}
          onInput={(e) => { setV(clean(e.target.value)); setSent(false); }} onKeyDown={(e) => e.key === 'Enter' && go()} />
        <button type="button" class="btn btn-sm btn-primary" disabled={!ok || sent} onClick={go}>계속</button>
      </div>
      {problem && !sent && <p class="small err" role="alert">{problem}</p>}
    </div>
  );
}

/**
 * 진행: 지금 단계 한 줄 + 사람이 할 일이 있으면 그것 하나.
 * phases { 단계: 문구 } · slow: 첫 단계가 길어질 때 덧붙일 말 · login: { hint, ok(url) → 열어도 되는 주소인지 } · asks { kind: (ask) → JSX } · onCancel
 */
export function RunProgress({ view, phases, slow = '', login = null, asks = {}, onCancel }) {
  if (!view?.running) return null;
  const a = view.ask;
  const link = view.phase === 'login' && login?.ok?.(view.loginUrl) ? view.loginUrl : '';
  return (
    <div class="run-box stack" style={{ gap: '8px' }} role="status" aria-live="polite">
      <p class="small"><span class="run-dot" aria-hidden="true" /><b>{phases[view.phase] || '진행하는 중…'}</b>{slow && view.phase === 'tool' && view.seconds > 6 ? ` ${slow}` : ''}{view.account?.name && !a ? <span class="muted"> · {view.account.name}</span> : null}</p>
      {view.phase === 'login' && login && <>
        {login.hint && <p class="small muted">{login.hint}</p>}
        {link && <div class="btn-row"><a class="btn btn-sm" href={link} target="_blank" rel="noopener">로그인 창 열기</a></div>}
      </>}
      {a && asks[a.kind]?.(a)}
      {onCancel && <div class="btn-row"><button type="button" class="btn btn-sm btn-quiet" onClick={onCancel}>중지</button></div>}
    </div>
  );
}

/** 실패: 까닭(t) + 누를 곳 하나(action { label, onClick }). 닫기는 조용히. children: 버튼 대신 넣을 것(새 버전으로 바꾸기 등) */
export function RunFail({ fail, onClose, children }) {
  const box = useRef(null);
  useEffect(() => { if (fail) box.current?.focus(); }, [fail]);
  if (!fail) return null;
  return (
    <div ref={box} tabIndex={-1} role="alert" class="notice bad run-fail"><div class="stack" style={{ gap: '6px', flex: 1 }}>
      <b>{fail.title || '끝내지 못했어요.'}</b>
      <span>{fail.t}</span>
      {fail.more && <span class="small">{fail.more}</span>}
      {children || <div class="btn-row">
        {fail.action && <button type="button" class="btn btn-sm btn-primary" onClick={fail.action.onClick}>{fail.action.label}</button>}
        {onClose && <button type="button" class="btn btn-sm btn-quiet" onClick={onClose}>닫기</button>}
      </div>}
    </div></div>
  );
}

/**
 * 카드 모양: note(한 줄 안내) → fields(주소 이름 같은 칸) → 버튼 하나 → 진행 → 실패 → foot(작은 줄) → alt(접힌 '다른 방법').
 * go { label, again, on, busy, disabled, onClick }: 처음엔 label([○○ 계정으로 배포]), 배포한 적이 있으면 [다시 배포하기]
 * alt { label, body, open?, onToggle? }: open·onToggle을 주면 바깥에서 펼침(실패 안내의 [토큰으로 연결]이 이 칸을 엶)
 */
export function OneClickCard({ note, fields, go, progress, fail, foot, alt }) {
  return (
    <div class="stack one-click">
      {note}
      {fields}
      {go && <div class="btn-row"><button class="btn btn-primary btn-lg" disabled={go.disabled || !!go.busy} aria-busy={go.on ? 'true' : undefined} onClick={go.onClick}>{go.on ? go.onLabel || '배포하는 중…' : go.again ? go.againLabel || '다시 배포하기' : go.label}</button></div>}
      {progress}
      {fail}
      {foot}
      {alt && <details class="run-alt" open={alt.open || undefined} onToggle={alt.onToggle ? (e) => alt.onToggle(e.currentTarget.open) : undefined}><summary class="small">{alt.label}</summary><div class="run-alt-body">{alt.body}</div></details>}
    </div>
  );
}

/**
 * 오래 걸리는 일 하나를 돌리며 진행(view)을 그리는 훅. run(fn): fn({ onView, signal })을 돌림(한 번에 하나, 돌고 있으면 undefined).
 */
export function useRun() {
  const [view, setView] = useState(null);
  const [busy, setBusy] = useState(false);
  const ctl = useRef(null); const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  async function run(fn) {
    if (ctl.current) return undefined;
    const c = new AbortController(); ctl.current = c; setBusy(true); setView(null);
    try { return await fn({ onView: (v) => { if (alive.current) setView(v); }, signal: c.signal }); }
    finally { ctl.current = null; if (alive.current) { setBusy(false); setView(null); } }
  }
  return { view, busy, run, cancel: () => ctl.current?.abort() };
}
