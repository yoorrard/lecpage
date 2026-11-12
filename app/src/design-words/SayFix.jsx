import { useMemo, useRef, useState } from 'preact/hooks';
import { findFixes, SAYINGS } from './symptoms.js';
import { applyWords, wordById, KIND_KO } from './words.js';
import { MiniSite } from './MiniSite.jsx';
import './words.css';

/** 안이 바꾸는 것 한 줄: "디자인 숲의 숨 · 움직임 차분하게" */
export const changesLine = (ids) => ids.map(wordById).filter(Boolean).map((w) => `${w.kind === 'body' ? w.section : w.sub === 'theme' ? '밝기' : w.sub === 'accent' ? '강조색' : w.sub === 'palette' ? '색 조합' : KIND_KO[w.kind]} ${w.kind === 'color' && w.sub === 'accent' ? w.key : w.name}`).join(' · ');

/**
 * 말로 고치기: 보이는 느낌을 적거나 예시를 누르면 고칠 안 2~3가지를 '지금 → 바꾸면' 실제 화면으로 보여 주고, 누르면 적용해요.
 * @param bp 지금 설계도 · onApply(fix) 적용 · onTry(fix|null) 큰 미리보기로 비교(없으면 버튼을 안 보임)
 * @param applied 방금 적용한 안의 key · onUndo 되돌리기 · tried 큰 화면으로 비교 중인 안의 key
 * @param more 찾지 못했을 때 덧붙이는 다음 할 일 · sayings 예시 말 · title 제목(h 수준은 hTag)
 */
export function SayFix({ bp, onApply, onTry, applied, onUndo, tried, assets, more = '', sayings = SAYINGS, title = '말로 고치기', hTag = 'h3', desc = '보이는 느낌을 적으면 고칠 곳을 찾아 바꾼 모습을 보여 줘요.', idp = 'say' }) {
  const [text, setText] = useState('');
  const [asked, setAsked] = useState('');
  const [base, setBase] = useState(null); // 찾을 때의 설계도(결과를 그 기준으로 고정)
  const input = useRef();
  const res = useMemo(() => (asked && base ? findFixes(base, asked) : null), [asked, base]);
  const ask = (t) => { const v = String(t || '').trim(); if (!v) { input.current?.focus(); return; } setText(v); setBase(bp); setAsked(v); };
  const H = hTag;
  return (
    <section class="sayfix" aria-labelledby={`${idp}-h`}>
      <div class="sayfix-head"><H id={`${idp}-h`}>{title}</H>{desc && <p class="small muted">{desc}</p>}</div>
      <form class="sayfix-form" role="search" onSubmit={(e) => { e.preventDefault(); ask(text); }}>
        <input ref={input} type="text" value={text} onInput={(e) => setText(e.currentTarget.value)} maxLength={120} placeholder="예: 좀 답답해 보여요" aria-label="보이는 느낌" enterkeyhint="search" />
        <button type="submit" class="btn btn-ink">찾기</button>
      </form>
      <div class="say-chips" role="group" aria-label="예시 말">
        {sayings.map((s) => <button type="button" class="chip" aria-pressed={String(asked === s)} onClick={() => ask(s)}>{s}</button>)}
      </div>
      <div class="sayfix-out" aria-live="polite">
        {res && !res.fixes.length && <p class="small">{res.already?.length ? `'${res.already.join(', ')}'${res.already.length > 1 ? '는' : '은'} 이미 쓰고 있어요.` : '이 말로는 고칠 곳을 찾지 못했어요. 위의 예시처럼 보이는 느낌으로 적어 보세요.'}{more && ` ${more}`}</p>}
        {res && res.fixes.length > 0 && <>
          <p class="small muted">{res.heard.length ? `알아들은 말: ${res.heard.join(' · ')} · ` : ''}고칠 곳 {res.fixes.length}가지</p>
          <ol class="fix-list">
            {res.fixes.map((f) => <FixCard key={f.key} f={f} bp={bp} done={applied === f.key} trying={tried === f.key} onApply={onApply} onTry={onTry} onUndo={onUndo} assets={assets} />)}
          </ol>
        </>}
      </div>
    </section>
  );
}

function FixCard({ f, bp, done, trying, onApply, onTry, onUndo, assets }) {
  const after = useMemo(() => applyWords(bp, f.ids), [bp, f.key]);
  // 제목에 낱말 이름이 다 들어 있으면 '바뀌는 것' 줄은 되풀이라 뺌
  const what = f.ids.map(wordById).every((w) => w && f.title.includes(w.name)) ? '' : changesLine(f.ids);
  return (
    <li class={`fix-card${done ? ' is-done' : ''}`}>
      {!done && <div class="fix-shots">
        <figure><MiniSite bp={bp} focus={f.focus} assets={assets} /><figcaption>지금</figcaption></figure>
        <span class="fix-arrow" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg></span>
        <figure><MiniSite bp={after} focus={f.focus} assets={assets} /><figcaption>바꾸면</figcaption></figure>
      </div>}
      <div class="fix-t">
        <b>{f.title}</b>
        <p class="small muted">{f.why}</p>
        {what && <p class="fix-what small">{what}</p>}
      </div>
      <div class="btn-row">
        {done ? <><span class="fix-ok small" role="status">적용했어요</span>{onUndo && <button type="button" class="btn btn-sm" onClick={onUndo}>되돌리기</button>}</>
          : <><button type="button" class="btn btn-sm btn-primary" onClick={() => onApply(f)}>적용하기</button>
            {onTry && <button type="button" class={`btn btn-sm${trying ? ' btn-ink' : ''}`} aria-pressed={String(!!trying)} onClick={() => onTry(trying ? null : f)}>{trying ? '크게 보는 중' : '크게 비교'}</button>}</>}
      </div>
    </li>
  );
}
