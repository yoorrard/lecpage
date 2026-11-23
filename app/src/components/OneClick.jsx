// 바깥 계정에 '버튼 하나'로 배포·연결하는 화면의 공통 조각. 곳(Cloudflare·Vercel·Netlify·GitHub·Supabase …)과
// 연결 방법(커넥트 경유 로그인·브라우저 로그인·토큰 붙여넣기)이 달라도 모양은 같게:
//   [○○ 계정으로 배포] 하나 → 처음에만 로그인·허용 → 다음부터는 [다시 배포하기]만 · 진행은 한 줄 + 사람이 할 일 하나 · 실패는 까닭 + 누를 곳 하나
//   OneClickCard: 카드 모양(칸 → 버튼 → 진행 → 실패 → 접힌 '다른 방법')  ·  RunProgress · RunFail · AskPick · AskName · useRun
// view(진행 상태)는 { running, phase, seconds?, loginUrl?, ask?: { kind, … }, account?: { name } } — 커넥트의 createRunner.view()와 같은 꼴
import { useEffect, useRef, useState } from 'preact/hooks';

/** 물음: 여럿 가운데 하나 고르기(계정·팀·프로젝트). items [{ id, name }] */
/** 답을 보냈는데 받는 쪽이 받지 못함(커넥트에 닿지 않음·기다리는 물음이 없음): onPick·onName이 준 답으로 가림(null·ok:false·4xx 이상) */
const notTaken = (r) => r === null || r?.ok === false || r?.status >= 400;
export function AskPick({ label, lead = '', items, onPick }) {
  const [sent, setSent] = useState(false);
  // 답이 가지 못했으면 버튼을 다시 살림(그대로 두면 고를 수도 멈출 수도 없이 기다리게 됨)
  const pick = (id) => { setSent(true); Promise.resolve(onPick(id)).then((r) => { if (notTaken(r)) setSent(false); }, () => setSent(false)); };
  return (
    <div class="stack" style={{ gap: '6px' }} role="group" aria-label={label}>
      {lead && <p class="small">{lead}</p>}
      {items.map((x) => <button type="button" class="btn btn-sm run-pick" key={x.id} disabled={sent} onClick={() => pick(x.id)}>{x.name || String(x.id).slice(0, 8)}</button>)}
    </div>
  );
}
/** 물음: 이름 하나 정하기(주소에 들어갈 이름 등). suggest를 채워 두고 [계속]. problem: 다시 묻는 까닭 한 줄, round: 몇 번째 물음인지 */
export function AskName({ label, lead, suggest = '', pattern, clean = (v) => v, problem = '', round = 0, onName }) {
  const [v, setV] = useState(suggest);
  const [sent, setSent] = useState(false);
  useEffect(() => { setSent(false); }, [problem, round]); // 같은 까닭으로 다시 물어도 버튼이 살아나게
  // 끝에 붙은 하이픈(빈칸·기호를 하이픈으로 바꾸다 남은 것)은 보낼 때 떼어 냄: 까닭 없이 [계속]이 꺼져 있지 않게
  const val = v.replace(/-+$/, '');
  const ok = pattern.test(val);
  const go = () => { if (ok && !sent) { setSent(true); Promise.resolve(onName(val)).then((r) => { if (notTaken(r)) setSent(false); }, () => setSent(false)); } };
  return (
    <div class="stack" style={{ gap: '6px' }}>
      {lead && <p class="small">{typeof lead === 'function' ? lead(val) : lead}</p>}
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
  const box = useRef(null);
  const a = view?.running ? view.ask : null;
  const link = view?.running && view.phase === 'login' && login?.ok?.(view.loginUrl) ? view.loginUrl : '';
  // 새 창이 막혔으면(view.blocked) 사실대로 알리고 [로그인 창 열기]를 눈에 띄게: 그 버튼이 지금 누를 곳
  const blocked = !!link && !!view.blocked;
  // 물음(계정·팀 고르기, 이름 정하기)이 뜨면 첫 선택지·입력 칸으로, 새 창이 막혔으면 [로그인 창 열기]로 초점을 옮김(키보드·화면 읽기 프로그램이 할 일을 바로 만나게)
  useEffect(() => { if (a) box.current?.querySelector('.run-pick, input')?.focus(); }, [a?.kind, a?.n]);
  useEffect(() => { if (blocked) box.current?.querySelector('.run-login')?.focus(); }, [blocked]);
  if (!view?.running) return null;
  return (
    <div ref={box} class="run-box stack" style={{ gap: '8px' }} role="status" aria-live="polite" tabIndex={-1}>
      <p class="small"><span class="run-dot" aria-hidden="true" /><b>{blocked ? '새 창이 막혔어요. [로그인 창 열기]를 눌러 주세요.' : phases[view.phase] || '진행하는 중…'}</b>{slow && view.phase === 'tool' && view.seconds > 6 ? ` ${slow}` : ''}{view.account?.name && !a ? <span class="muted"> · {view.account.name}</span> : null}</p>
      {view.phase === 'login' && login && <>
        {login.hint && <p class="small muted">{login.hint}</p>}
        {link && <div class="btn-row"><a class={`btn btn-sm run-login${blocked ? ' btn-primary' : ''}`} href={link} target="_blank" rel="noopener">로그인 창 열기</a></div>}
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
  // 이 알림의 버튼을 누르면 알림이 사라지므로(다시 시도·닫기) 초점을 이어질 자리로 옮김: 진행 줄 → 펼쳐진 '다른 방법' → 카드의 큰 버튼(키보드·화면 읽기 프로그램이 길을 잃지 않게)
  const then = (fn) => () => {
    const host = box.current?.closest('.one-click') || box.current?.parentElement;
    fn?.();
    setTimeout(() => {
      const a = document.activeElement;
      if (a && a !== document.body && a.isConnected) return; // 눌린 버튼이 남아 있거나 다른 곳이 초점을 가져감
      const to = host?.querySelector('.run-box') || host?.querySelector('.run-alt[open] input, .run-alt[open] a[href], .run-alt[open] button:not([disabled])') || host?.querySelector('.btn-lg:not([disabled])');
      if (to) to.focus();
      else if (host?.isConnected) { if (!host.hasAttribute('tabindex')) host.setAttribute('tabindex', '-1'); host.focus(); } // 큰 버튼이 잠겨 있는 동안(배포하는 중)은 카드 자체로
    }, 60);
  };
  return (
    <div ref={box} tabIndex={-1} role="alert" class="notice bad run-fail"><div class="stack" style={{ gap: '6px', flex: 1 }}>
      <b>{fail.title || '끝내지 못했어요.'}</b>
      <span>{fail.t}</span>
      {fail.more && <span class="small">{fail.more}</span>}
      {children || <div class="btn-row">
        {fail.action && <button type="button" class="btn btn-sm btn-primary" onClick={then(fail.action.onClick)}>{fail.action.label}</button>}
        {onClose && <button type="button" class="btn btn-sm btn-quiet" onClick={then(onClose)}>닫기</button>}
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
