import { useEffect, useRef, useState } from 'preact/hooks';
import { Field, Dialog, Notice } from '../../../components/ui.jsx';
import { pageTitles } from '../../../lib/studio.js';
import { imageAt, getVar, setVar, readCss, writeCss } from '../../../lib/site-doc.js';
import { sameState } from '../../../lib/site-meta.js';
import { blobs } from '../../../lib/db.js';
import { toast, uid } from '../../../lib/util.js';

// 완성 화면(Studio)의 작은 부품: 섹션 목록·색·글꼴·그림 바꾸기·버전 기록·꼭 고칠 곳 한 줄
const KIT_KO = { qa: '질문', poll: '투표', board: '보드', attend: '출석', survey: '설문', deck: '교재', materials: '자료실', join: '접속 QR' };
/** 목록: 사이트의 섹션. 끌어서(또는 ↑↓) 순서, 숨기기, 지우기, 이름 바꾸기, 누르면 미리보기가 그 섹션으로 */
export function SectionsPanel({ sections, locked, onShow, onMove, onHide, onRemove, onRename, onAsk }) {
  const [drag, setDrag] = useState(null); const [over, setOver] = useState(null);
  const [rename, setRename] = useState(null); const [del, setDel] = useState(null);
  const listRef = useRef();
  /** 옮긴 뒤 초점: 옮긴 섹션의 같은 단추(↑·↓를 이어 누를 수 있게). 그 단추가 꺼졌으면(맨 위·맨 아래) 이름 칸 */
  const focusAt = (i, dir = '') => setTimeout(() => { const li = listRef.current?.querySelectorAll('.sec2')[i]; const b = dir && li?.querySelector(`button[aria-label$="${dir}"]:not([disabled])`); (b || li?.querySelector('.sec2-name'))?.focus(); }, 60);
  return (
    <div class="stack">
      <p class="small muted">끌어서 순서를 바꾸고, 누르면 미리보기가 그 섹션으로 가요. 글은 미리보기의 [글 수정]으로 고쳐요.</p>
      {locked && <p class="lock-note small">AI가 고치는 동안에는 바꿀 수 없어요.</p>}
      <ol class="sec2-list" ref={listRef} aria-label="섹션 목록">
        {sections.map((s, i) => (
          <li class={`sec2${s.hidden ? ' is-hidden' : ''}${over === i ? ' is-over' : ''}`} key={s.id} draggable={!locked && rename !== s.id}
            onDragStart={(e) => { setDrag(i); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', s.id); } catch { } }}
            onDragOver={(e) => { if (drag === null) return; e.preventDefault(); setOver(i); }} onDragLeave={() => setOver(null)}
            onDrop={(e) => { e.preventDefault(); if (drag !== null && drag !== i) { onMove(sections[drag].id, i); toast(`옮겼어요: ${sections[drag].name}`); } setDrag(null); setOver(null); }}
            onDragEnd={() => { setDrag(null); setOver(null); }}>
            <span class="sec2-grip" aria-hidden="true">⋮⋮</span>
            {rename === s.id ? <form class="sec2-rename" onSubmit={(e) => { e.preventDefault(); const v = e.currentTarget.elements.n.value.trim(); if (v) onRename(s.id, v); setRename(null); focusAt(i); }}>
              <input name="n" class="input" defaultValue={s.name} maxLength={60} aria-label={`${s.name} 새 이름`} ref={(el) => el && setTimeout(() => el.focus(), 0)} onKeyDown={(e) => e.key === 'Escape' && (setRename(null), focusAt(i))} />
              <button class="btn btn-sm btn-primary">바꾸기</button></form>
              : <button type="button" class="sec2-name" onClick={() => onShow(s.id)} title="미리보기에서 보기"><span class="ttl">{s.name}</span><small>{[s.hidden ? '숨김' : '', s.steps ? `실습 ${s.steps}단계` : '', ...s.kits.map((k) => KIT_KO[k] || k)].filter(Boolean).join(' · ')}</small></button>}
            <span class="sec2-acts">
              <button type="button" class="icon-btn" disabled={locked || i === 0} aria-label={`${s.name} 위로`} title="위로" onClick={() => { onMove(s.id, i - 1); focusAt(i - 1, '위로'); }}>↑</button>
              <button type="button" class="icon-btn" disabled={locked || i === sections.length - 1} aria-label={`${s.name} 아래로`} title="아래로" onClick={() => { onMove(s.id, i + 1); focusAt(i + 1, '아래로'); }}>↓</button>
              <details class="sec2-more"><summary class="icon-btn" aria-label={`${s.name} 더 보기`} title="더 보기">…</summary>
                <div class="sec2-menu">
                  <button type="button" class="btn btn-sm btn-quiet" disabled={locked} onClick={(e) => { e.currentTarget.closest('details').open = false; setRename(s.id); }}>이름 바꾸기</button>
                  <button type="button" class="btn btn-sm btn-quiet" disabled={locked} onClick={(e) => { e.currentTarget.closest('details').open = false; onHide(s.id, !s.hidden); }}>{s.hidden ? '숨기기 취소' : '숨기기'}</button>
                  <button type="button" class="btn btn-sm btn-quiet" disabled={locked} onClick={(e) => { e.currentTarget.closest('details').open = false; onAsk(s.id); }}>AI로 수정</button>
                  <button type="button" class="btn btn-sm btn-quiet sec2-del" disabled={locked} onClick={(e) => { e.currentTarget.closest('details').open = false; setDel(s); }}>삭제</button>
                </div></details>
            </span>
          </li>
        ))}
      </ol>
      {!sections.length && <p class="muted small">섹션(&lt;section&gt;)이 없는 사이트예요. 아래 AI 수정 칸에서 섹션을 나눠 달라고 할 수 있어요.</p>}
      <Dialog open={!!del} onClose={() => setDel(null)} label="섹션 삭제 확인">
        {del && <><h2 class="h-sub">'{del.name}' 섹션을 삭제할까요?</h2><p>숨기기는 사이트에서 감추기만 해요. 삭제한 것은 [실행 취소]나 [버전 기록]으로 되살릴 수 있어요.</p>
          <div class="btn-row"><button class="btn btn-quiet" data-autofocus onClick={() => setDel(null)}>닫기</button><button class="btn" onClick={() => { onHide(del.id, true); setDel(null); }}>숨기기</button><button class="btn btn-danger" onClick={() => { onRemove(del.id); setDel(null); toast(`삭제했어요: ${del.name}`); }}>삭제</button></div></>}
      </Dialog>
    </div>
  );
}
const FONTS = [{ value: '', label: '사이트 그대로' }, { value: '"Pretendard","Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif', label: '고딕' }, { value: '"Noto Serif KR","Nanum Myeongjo","AppleMyungjo",serif', label: '명조' }, { value: '"Nanum Square Round","Apple SD Gothic Neo","Malgun Gothic",sans-serif', label: '둥근 고딕' }];
function lum(hex) { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return null; const v = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; }
const ratio = (a, b) => { const x = lum(a), y = lum(b); if (x === null || y === null) return 0; return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const hex6 = (v) => { const s = String(v || '').trim(); if (/^#[0-9a-f]{6}$/i.test(s)) return s.toLowerCase(); const m = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(s); return m ? `#${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}`.toLowerCase() : ''; };
/** 색·글꼴: 사이트 CSS의 --lp-accent·--lp-ink·--lp-paper·--lp-font. 키트·QR 안내문·발표 화면도 같은 색을 이어받음(meta.theme) */
export function LookPanel({ p, change }) {
  const { css } = readCss(p.site || {});
  const cur = { accent: hex6(getVar(css, 'accent')) || p.meta?.theme?.accent || '', ink: hex6(getVar(css, 'ink')) || p.meta?.theme?.ink || '', paper: hex6(getVar(css, 'paper')) || p.meta?.theme?.paper || '' };
  const font = getVar(css, 'font');
  const uses = /var\(--lp-(accent|ink|paper)/.test(css);
  const set = (k, v) => change(k === 'font' ? '글꼴 바꾸기' : '색 바꾸기', (c) => {
    const { css: now } = readCss(c.site);
    const site = writeCss(c.site, setVar(now, k, v));
    const theme = { ...(c.meta?.theme || {}), [k]: k === 'font' ? v.split(',')[0].replace(/"/g, '') : v };
    return { site, meta: { ...(c.meta || {}), theme } };
  });
  const r = ratio(cur.ink, cur.paper);
  return (
    <div class="stack look">
      <p class="small muted">바꾸면 사이트와 참여 기능·QR 안내문·발표 화면이 같은 색을 써요.</p>
      {!uses && <Notice><span>이 사이트는 일부만 바뀔 수 있어요. AI 수정 칸에 적어 색을 바꿔 달라고 해도 돼요.</span></Notice>}
      <div class="look-colors">
        {[['accent', '강조색'], ['ink', '글자색'], ['paper', '바탕색']].map(([k, label]) => <label class="look-color"><input type="color" value={cur[k] || '#333333'} onChange={(e) => set(k, e.target.value)} /><span>{label}<small class="mono">{cur[k] || '정하지 않음'}</small></span></label>)}
      </div>
      {r > 0 && r < 4.5 && <p class="small warn-line" role="status">글자색과 바탕색의 대비가 {r.toFixed(1)}:1이라 읽기 어려워요. 4.5:1 넘게 해 주세요.</p>}
      <fieldset class="field plain-fieldset"><legend>글꼴</legend>
        <div class="radio-row" role="radiogroup" aria-label="글꼴">{FONTS.map((f) => <label><input type="radio" name="lp-font" checked={f.value ? font.replace(/\s/g, '') === f.value.replace(/\s/g, '') : !FONTS.slice(1).some((x) => x.value.replace(/\s/g, '') === font.replace(/\s/g, ''))} disabled={!f.value} onChange={() => f.value && set('font', f.value)} /><span style={{ fontFamily: f.value || undefined }}>{f.label}</span></label>)}</div>
        <small>참가자 기기에 그 글꼴이 없으면 비슷한 글꼴로 보여요.</small>
      </fieldset>
    </div>
  );
}

/** 그림 바꾸기: 교재 쪽 그림 또는 올린 사진 */
export function ImageDialog({ n, p, onClose, onPick }) {
  const [pages, setPages] = useState([]); const [alt, setAlt] = useState('');
  const cur = n === null ? null : imageAt(p.site?.['index.html'] || '', n);
  const titles = pageTitles(p); // 쪽 제목(연수 정보의 pages가 있으면 그것)
  const fileRef = useRef();
  useEffect(() => {
    if (n === null) return undefined;
    let off = false; const urls = [];
    setAlt(cur?.alt || '');
    blobs.keys(p.id).then(async (keys) => {
      const list = keys.filter((k) => /^(assets\/slides\/|site\/material\/)/.test(k) && /\.(webp|png|jpe?g)$/i.test(k));
      const seen = new Set(); const out = [];
      for (const k of list.sort()) {
        const num = +(/(\d+)\.\w+$/.exec(k)?.[1] || 0); if (seen.has(num)) continue; seen.add(num);
        const v = await blobs.get(p.id, k); const u = URL.createObjectURL(v instanceof Blob ? v : new Blob([v])); urls.push(u);
        out.push({ key: k, num, url: u });
      }
      if (!off) setPages(out);
    });
    return () => { off = true; urls.forEach((u) => URL.revokeObjectURL(u)); };
  }, [n]);
  async function usePage(pg) {
    const name = `material/p-${String(pg.num || 1).padStart(3, '0')}.${pg.key.split('.').pop()}`;
    if (!pg.key.startsWith('site/')) { const v = await blobs.get(p.id, pg.key); await blobs.put(p.id, 'site/' + name, v); }
    onPick(pg.key.startsWith('site/') ? pg.key.slice(5) : name, alt || `교재 ${pg.num}쪽`);
  }
  async function upload(f) {
    if (!f) return;
    if (!/^image\/(png|jpeg|webp|gif)$/.test(f.type)) { toast('PNG·JPG·WEBP 사진만 넣을 수 있어요.'); return; }
    if (f.size > 5e6) { toast('5MB보다 작은 사진을 넣어 주세요.'); return; }
    const ext = f.type === 'image/jpeg' ? 'jpg' : f.type.split('/')[1];
    const name = `assets/img/photo-${uid(6)}.${ext}`;
    await blobs.put(p.id, 'site/' + name, new Uint8Array(await f.arrayBuffer()));
    onPick(name, alt || f.name.replace(/\.[^.]+$/, ''));
  }
  return (
    <Dialog open={n !== null} onClose={onClose} label="그림 바꾸기" wide>
      {n !== null && <div class="stack">
        <h2 class="h-sub">그림 바꾸기</h2>
        <Field label="그림 설명" hint="화면 읽기 프로그램이 읽어요."><input class="input" value={alt} onInput={(e) => setAlt(e.target.value)} maxLength={120} placeholder="예: 실습 결과 차트" /></Field>
        <div class="btn-row"><button type="button" class="btn btn-primary" onClick={() => fileRef.current?.click()}>사진 업로드</button>{cur && <button type="button" class="btn btn-quiet" onClick={() => onPick(cur.src, alt)}>설명만 바꾸기</button>}</div>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }} />
        <b class="small">교재 쪽 그림</b>
        {pages.length ? <div class="page-grid">{pages.map((pg) => <button type="button" class="page-pick" onClick={() => usePage(pg)} title={titles[pg.num] || undefined} aria-label={`교재 ${pg.num}쪽${titles[pg.num] ? `(${titles[pg.num]})` : ''} 그림으로 바꾸기`}><img src={pg.url} alt="" /><span>{pg.num}쪽</span></button>)}</div>
          : <p class="small muted">교재 쪽 그림이 없어요. PDF 교재를 넣으면 쪽마다 그림이 생겨요.</p>}
      </div>}
    </Dialog>
  );
}

/** 꼭 고칠 곳: 배포에서 막히거나 화면·링크가 깨지는 문제만(글자 대비·제목 같은 작은 것은 뺌) */
const MINOR = /^(contrast|invisible-text|title|viewport)$/;
export const seriousOf = (issues) => (issues || []).filter((x) => x.level === 'error' && !MINOR.test(String(x.id || '')));
/** 꼭 고칠 곳 한 줄: [AI로 수정]과 접은 목록(이 곳 보기) */
export function IssueLine({ issues, onFix, onShow, locked, flash }) {
  if (!issues.length) return null;
  const n = issues.length;
  return (
    <div class={`st-issue${flash ? ' is-flash' : ''}`} id="st-issue" role="alert">
      <div class="st-issue-row">
        <span class="st-issue-t"><b>꼭 고칠 곳 {n}곳</b><small>{issues[0].message_ko}{n > 1 ? ` 외 ${n - 1}곳` : ''}</small></span>
        <button type="button" class="btn btn-sm btn-primary" disabled={locked} onClick={onFix}>AI로 수정</button>
      </div>
      <details class="st-issue-more"><summary class="small">자세히 보기</summary>
        <ul class="small">{issues.map((x) => <li key={x.key}>{x.message_ko}{x.fix_hint_ko ? <span class="muted"> {x.fix_hint_ko}</span> : null}{x.where?.section && <> <button type="button" class="btn-link small" onClick={() => onShow(x.where.section)}>이 곳 보기</button></>}</li>)}</ul>
      </details>
    </div>
  );
}

/** 버전 시각: 방금 · 3분 전 · 오늘 오후 3:05 · 11월 21일 오후 3:05 */
export function verTime(at, now = Date.now()) {
  if (!at) return '';
  const s = (now - at) / 1000;
  if (s < 60) return '방금';
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  const d = new Date(at); const t = d.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });
  return new Date(now).toDateString() === d.toDateString() ? `오늘 ${t}` : `${d.getMonth() + 1}월 ${d.getDate()}일 ${t}`;
}
const KIND_KO = { make: 'AI', ai: 'AI', chat: 'AI', fix: 'AI', edit: '직접', info: '정보', restore: '복원', prev: '이전' };

/** 버전 기록: 바뀔 때마다 남은 사이트(새것이 앞, 최근 20개). 맨 위가 지금. 복원하면 복원한 것도 새 버전으로 남음 */
export function Versions({ p, focus, onPick, onRemake }) {
  const list = p.versions || [];
  const nowAt = sameState(list[0], p) ? 0 : -1; // 맨 위가 지금 사이트인지
  useEffect(() => { if (focus) setTimeout(() => document.querySelector(`.versions li[data-id="${focus}"]`)?.scrollIntoView({ block: 'nearest' }), 60); }, [focus]);
  return (
    <div class="stack">
      <h2 class="h-sub">버전 기록</h2>
      <p class="small muted">AI 수정·직접 수정·연수 정보 수정이 바뀔 때마다 남아요(최근 20개). 복원해도 지금 버전은 기록에 남아요.</p>
      {list.length ? <ol class="versions">{list.map((v, i) => (
        <li key={v.id} data-id={v.id} class={`${focus === v.id ? 'is-focus' : ''}${i === nowAt ? ' is-now' : ''}`}>
          <span class={`ver-kind k-${v.kind || 'old'}`}>{KIND_KO[v.kind] || '이전'}</span>
          <span class="ver-t"><b>{v.label}</b><small>{verTime(v.at)}</small></span>
          {i === nowAt ? <span class="ver-now small">지금 버전</span> : <button type="button" class="btn btn-sm" onClick={() => onPick(v)}>이 버전으로 복원</button>}
        </li>))}</ol> : <p class="muted small">아직 기록이 없어요.</p>}
      <div class="btn-row"><button type="button" class="btn btn-quiet" onClick={onRemake}>처음부터 다시 만들기</button></div>
    </div>
  );
}
