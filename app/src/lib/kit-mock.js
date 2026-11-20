// 가짜 조립·검수(약속 C, docs/plan-ai-first.md §5와 같은 이름·꼴). kit 작업자의 엔진 assemble/inspect가 오면 lib/studio.js 한 줄만 바꾸고 이 파일은 지움.
// 화면을 끝까지 만들고 시험하려는 것: 자리 표시(data-lp)를 연습용 부품으로 펼치고, 강사 화면·발표 화면·QR 안내문·접속 확인 쪽을 간단히 만듦.
// 브라우저 전용(DOMParser). 실제 런타임·CSP·실시간 연결은 넣지 않음.
import { qrSvg } from '../components/QR.jsx';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const first = (meta) => (meta.sessions || [])[0] || {};
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
function whenOf(meta) {
  const s = first(meta); const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.date || '');
  const day = m ? `${+m[2]}월 ${+m[3]}일(${DOW[new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay()]})` : '';
  return [day, [s.start, s.end].filter(Boolean).join('~')].filter(Boolean).join(' ');
}
const parse = (html) => new DOMParser().parseFromString(String(html || ''), 'text/html');
const out = (doc) => '<!doctype html>\n' + doc.documentElement.outerHTML;
const json = (v, d) => { try { return JSON.parse(v); } catch { return d; } };

const KIT_CSS = `.lpk{font:inherit;color:var(--lp-ink,inherit);margin:16px 0}
.lpk *{box-sizing:border-box}
.lpk-box{padding:18px;border-radius:var(--lp-radius,12px);background:color-mix(in srgb,var(--lp-paper,#fff) 70%,#fff);border:1px solid color-mix(in srgb,var(--lp-ink,#222) 16%,transparent)}
.lpk-btn{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:8px 16px;border-radius:999px;border:1px solid var(--lp-accent,#333);background:var(--lp-accent,#333);color:#fff;font:inherit;font-weight:700;cursor:pointer}
.lpk-btn.ghost{background:transparent;color:var(--lp-accent,#333)}
.lpk-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.lpk textarea,.lpk input{width:100%;min-height:44px;padding:10px 12px;border-radius:10px;border:1px solid color-mix(in srgb,var(--lp-ink,#222) 24%,transparent);font:inherit;background:#fff;color:#222}
.lpk-note{margin:8px 0 0;font-size:.85rem;opacity:.75}
.lpk-list{list-style:none;margin:12px 0 0;padding:0;display:grid;gap:8px}
.lpk-list li{padding:10px 12px;border-radius:10px;background:#fff;border:1px solid color-mix(in srgb,var(--lp-ink,#222) 12%,transparent)}
.lpk-deck{display:grid;grid-auto-flow:column;grid-auto-columns:min(78%,420px);gap:12px;overflow-x:auto;padding-bottom:6px}
.lpk-deck figure{margin:0;aspect-ratio:4/3;border-radius:10px;background:#fff;border:1px solid color-mix(in srgb,var(--lp-ink,#222) 14%,transparent);display:grid;place-items:center;overflow:hidden}
.lpk-deck img{width:100%;height:100%;object-fit:contain}
.lpk-dock{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:20;display:flex;gap:6px;padding:6px;border-radius:999px;background:var(--lp-ink,#222);box-shadow:0 8px 24px rgba(0,0,0,.18);margin:0;max-width:calc(100% - 20px);overflow-x:auto}
.lpk-dock button{min-height:44px;padding:6px 14px;border:0;border-radius:999px;background:transparent;color:var(--lp-paper,#fff);font:inherit;font-size:.9rem;font-weight:700;white-space:nowrap;cursor:pointer}
.lpk-dock button:hover,.lpk-dock button:focus-visible{background:rgba(255,255,255,.16)}
.lpk-done{display:inline-flex;margin-top:10px}`;

/** 연습 모드 동작(이 화면에서만): 질문·투표·보드·출석·실습 완료 */
const KIT_JS = `(function(){function on(sel,ev,fn){document.addEventListener(ev,function(e){var t=e.target.closest&&e.target.closest(sel);if(t)fn(e,t);});}
on('[data-lpk-send]','click',function(e,b){var box=b.closest('.lpk');var ta=box.querySelector('textarea,input');if(!ta||!ta.value.trim())return;var li=document.createElement('li');li.textContent=ta.value.trim();box.querySelector('.lpk-list').prepend(li);ta.value='';});
on('[data-lpk-vote]','click',function(e,b){var box=b.closest('.lpk');box.querySelectorAll('[data-lpk-vote]').forEach(function(x){x.setAttribute('aria-pressed',String(x===b));x.classList.toggle('ghost',x!==b);});var n=box.querySelector('.lpk-note');if(n)n.textContent='투표했어요. 결과는 강사가 열면 보여요.';});
on('[data-lpk-done]','click',function(e,b){b.textContent='완료했어요';b.disabled=true;});
on('[data-lpk-dock]','click',function(e,b){b.textContent=b.dataset.lpkDock+' ✓';});})();`;

function widget(doc, el, meta, opt) {
  const kind = el.getAttribute('data-lp');
  const box = doc.createElement('div');
  box.className = 'lpk lpk-' + kind;
  const live = opt.preview ? '<p class="lpk-note">연습 모드예요. 이 화면에서만 보여요.</p>' : '';
  if (kind === 'qa') box.innerHTML = `<div class="lpk-box"><label>질문<textarea rows="2" maxlength="500" placeholder="궁금한 점을 적어 주세요."></textarea></label><div class="lpk-row"><button type="button" class="lpk-btn" data-lpk-send>질문 올리기</button></div>${live}<ul class="lpk-list"></ul></div>`;
  else if (kind === 'poll') {
    const opts = json(el.getAttribute('data-options'), []);
    box.innerHTML = `<div class="lpk-box"><b>${esc(el.getAttribute('data-question') || '투표')}</b><div class="lpk-row" role="group">${(Array.isArray(opts) ? opts : []).map((o) => `<button type="button" class="lpk-btn ghost" aria-pressed="false" data-lpk-vote>${esc(o)}</button>`).join('')}</div><p class="lpk-note">강사가 투표를 열면 고를 수 있어요.</p></div>`;
  } else if (kind === 'board') box.innerHTML = `<div class="lpk-box"><b>${esc(el.getAttribute('data-prompt') || '나눔 보드')}</b><textarea rows="2" placeholder="생각을 적어 주세요."></textarea><div class="lpk-row"><button type="button" class="lpk-btn" data-lpk-send>붙이기</button></div>${live}<ul class="lpk-list"></ul></div>`;
  else if (kind === 'attend') box.innerHTML = '<div class="lpk-box"><b>출석</b><div class="lpk-row"><button type="button" class="lpk-btn" data-lpk-done>입실</button></div></div>';
  else if (kind === 'survey') box.innerHTML = '<div class="lpk-box"><b>만족도 조사</b><p class="lpk-note">연수가 끝나면 강사가 열어요.</p></div>';
  else if (kind === 'materials') box.innerHTML = '<div class="lpk-box"><b>자료실</b><p class="lpk-note">강사가 올린 파일과 링크가 여기에 보여요.</p></div>';
  else if (kind === 'join') box.innerHTML = `<div class="lpk-box"><b>휴대폰으로 들어오기</b><p class="lpk-note">${esc(meta.siteUrl || '배포하면 주소와 QR이 여기에 보여요.')}</p></div>`;
  else if (kind === 'deck') {
    const [a, b] = String(el.getAttribute('data-pages') || '1-4').split('-').map((x) => Math.max(1, +x || 1));
    const pages = []; for (let i = a; i <= Math.min(b || a, a + 40); i++) pages.push(i);
    box.innerHTML = `<div class="lpk-deck" role="list" aria-label="교재 쪽">${pages.map((n) => { const f = `material/p-${String(n).padStart(3, '0')}.webp`; return `<figure role="listitem">${opt.has(f) ? `<img src="${f}" alt="교재 ${n}쪽" loading="lazy">` : `<span>교재 ${n}쪽</span>`}</figure>`; }).join('')}</div>`;
  } else return false;
  el.replaceWith(box);
  return true;
}

function page(meta, title, body, extraCss = '') {
  const t = meta.theme || {};
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · ${esc(meta.title || '')}</title><style>:root{--a:${t.accent || '#333'};--i:${t.ink || '#1d1d1d'};--p:${t.paper || '#faf8f4'}}body{margin:0;font:17px/1.6 ${t.font ? `"${esc(t.font)}",` : ''}system-ui,"Malgun Gothic",sans-serif;background:var(--p);color:var(--i);word-break:keep-all}main{width:min(960px,100% - 32px);margin:0 auto;padding:32px 0}h1{font-size:clamp(1.6rem,4vw,2.6rem);line-height:1.25;margin:0 0 8px}.muted{opacity:.7}.box{padding:18px;border-radius:14px;background:#fff;border:1px solid rgba(0,0,0,.1);margin-top:14px}${extraCss}</style></head><body>${body}</body></html>`;
}

/**
 * 조립. site: { 'index.html', 'assets/style.css', … (그림은 Uint8Array) }, meta: lecpage.json
 * @returns {{ files: Record<string,string|Uint8Array>, warnings: object[] }}
 */
export async function assemble(site, meta = {}, opt = {}) {
  const files = { ...site }; const warnings = [];
  const has = (k) => files[k] !== undefined;
  const doc = parse(site['index.html'] || '<!doctype html><html lang="ko"><head></head><body></body></html>');
  // 인라인 <script> → assets/site.js
  const moved = [];
  doc.querySelectorAll('script:not([src])').forEach((s) => { if (/json/i.test(s.type || '')) return; moved.push(s.textContent); s.remove(); });
  if (moved.length) files['assets/site.js'] = [files['assets/site.js'] || '', ...moved].filter(Boolean).join('\n;\n');
  let n = 0;
  doc.querySelectorAll('[data-lp]').forEach((el) => { if (widget(doc, el, meta, { ...opt, has })) n++; else warnings.push({ id: 'kit-unknown', level: 'warn', message_ko: `모르는 자리 표시(data-lp="${el.getAttribute('data-lp')}")라 그대로 뒀어요.` }); });
  doc.querySelectorAll('section[data-lp-step]').forEach((s) => { const b = doc.createElement('div'); b.className = 'lpk'; b.innerHTML = '<button type="button" class="lpk-btn lpk-done" data-lpk-done>완료</button>'; s.appendChild(b); });
  const feats = meta.features || [];
  if (feats.some((f) => ['attendance', 'qa', 'help', 'reactions'].includes(f)) && !doc.querySelector('.lpk-dock')) {
    const dock = doc.createElement('nav'); dock.className = 'lpk lpk-dock'; dock.setAttribute('aria-label', '참여');
    dock.innerHTML = [['attendance', '출석'], ['qa', '질문'], ['help', '도움 요청'], ['reactions', '반응']].filter(([k]) => feats.includes(k)).map(([, t]) => `<button type="button" data-lpk-dock="${t}">${t}</button>`).join('');
    doc.body.appendChild(dock);
  }
  const st = doc.createElement('style'); st.textContent = KIT_CSS; doc.head.appendChild(st);
  const data = doc.createElement('script'); data.type = 'application/json'; data.id = 'lp-data'; data.textContent = JSON.stringify({ title: meta.title || '', features: feats }).replace(/</g, '\\u003c'); doc.body.appendChild(data);
  const kit = doc.createElement('script'); kit.textContent = KIT_JS; doc.body.appendChild(kit);
  files['index.html'] = out(doc);
  // 보조 화면
  const url = meta.siteUrl || 'https://lecpage.com/';
  const qr = qrSvg(url);
  const when = whenOf(meta);
  const polls = []; const steps = [];
  parse(site['index.html']).querySelectorAll('[data-lp="poll"]').forEach((p) => polls.push(p.getAttribute('data-question') || '투표'));
  parse(site['index.html']).querySelectorAll('section[data-lp-step]').forEach((s) => steps.push(s.getAttribute('data-title') || s.querySelector('h1,h2,h3')?.textContent || '실습'));
  files['console.html'] = page(meta, '강사 화면', `<main><p class="muted">강사 화면</p><h1>${esc(meta.title || '')}</h1><div class="box"><b>투표</b><ul>${polls.map((q) => `<li>${esc(q)} <button type="button">열기</button></li>`).join('') || '<li class="muted">투표가 없어요.</li>'}</ul></div><div class="box"><b>실습 진행</b><ul>${steps.map((s) => `<li>${esc(s)} · 완료 0명</li>`).join('') || '<li class="muted">실습 단계가 없어요.</li>'}</ul></div><div class="box"><b>질문</b><p class="muted">참가자 질문이 공감순으로 보여요.</p></div></main>`);
  files['screen.html'] = page(meta, '발표 화면', `<main style="display:grid;grid-template-columns:1fr auto;gap:32px;align-items:center;min-height:90vh"><div><h1 style="font-size:clamp(2rem,5vw,4rem)">${esc(meta.title || '')}</h1><p style="font-size:1.4rem">${esc([when, meta.venue].filter(Boolean).join(' · '))}</p><p class="muted">휴대폰 카메라로 QR을 찍어 들어오세요.</p></div><div style="width:min(38vw,360px)">${qr}</div></main>`);
  files['poster.html'] = page(meta, 'QR 안내문', `<main style="text-align:center;max-width:720px"><p class="muted">연수 안내</p><h1>${esc(meta.title || '')}</h1><p>${esc(meta.subtitle || '')}</p><p><b>${esc(when)}</b>${meta.venue ? ` · ${esc(meta.venue)}` : ''}</p><div style="width:min(70%,320px);margin:24px auto">${qr}</div><p class="muted">${esc(url.replace(/^https?:\/\//, ''))}</p>${(meta.instructors || []).length ? `<p>강사 ${esc(meta.instructors.map((x) => x.name).join(', '))}</p>` : ''}</main>`, '@media print{body{background:#fff}}');
  files['check.html'] = page(meta, '접속 확인', `<main><h1>접속 확인</h1><div class="box"><b>이 화면이 보이면 연수 사이트에 들어올 수 있어요.</b><p class="muted">${esc(meta.title || '')}</p></div></main>`);
  files['lecpage.json'] = JSON.stringify(meta, null, 2);
  if (!opt.preview) files['_headers'] = '/*\n  X-Content-Type-Options: nosniff\n';
  return { files, warnings, kits: n };
}

/**
 * 정적 검사. @returns issue[] { id, level, where:{ file, selector, section }, message_ko, fix_hint_ko }
 */
export function inspect(files = {}, meta = {}) {
  const issues = [];
  const doc = parse(files['index.html'] || '');
  const add = (id, level, where, message_ko, fix_hint_ko) => issues.push({ id, level, where: { file: 'index.html', ...where }, message_ko, fix_hint_ko });
  doc.querySelectorAll('img').forEach((img, i) => {
    const sec = img.closest('section[id]')?.id || '';
    if (!img.hasAttribute('alt')) add(`img-alt-${i}`, 'warn', { selector: `img:nth-of-type(${i + 1})`, section: sec }, '그림에 설명(alt)이 없어요. 화면 읽기 프로그램이 읽을 글이 없어요.', '그림마다 무엇을 보여 주는지 한 줄 설명을 넣어 주세요.');
    const src = img.getAttribute('src') || '';
    if (src && !/^(https?:|data:)/.test(src) && files[src] === undefined) add(`img-src-${i}`, 'error', { selector: `img[src="${src}"]`, section: sec }, `그림 파일(${src})을 찾지 못해 깨져 보여요.`, '있는 그림으로 바꾸거나 그림을 빼 주세요.');
  });
  doc.querySelectorAll('main section[id]').forEach((s) => {
    if (s.hasAttribute('hidden')) return;
    const text = (s.textContent || '').replace(/\s+/g, '');
    if (text.length < 6 && !s.querySelector('img,[data-lp],.lpk')) add(`empty-${s.id}`, 'warn', { selector: `#${s.id}`, section: s.id }, `'${s.getAttribute('data-title') || s.id}' 섹션이 비어 있어요.`, '내용을 채우거나 섹션을 지워 주세요.');
  });
  if (!(meta.sessions || []).some((x) => x.date)) issues.push({ id: 'meta-date', level: 'warn', where: { file: 'lecpage.json' }, message_ko: '연수 날짜가 비어 있어요. QR 안내문과 일정 파일에 쓰여요.', fix_hint_ko: '연수 정보에서 날짜를 넣어 주세요.' });
  if (!meta.title) issues.push({ id: 'meta-title', level: 'error', where: { file: 'lecpage.json' }, message_ko: '연수 제목이 비어 있어요.', fix_hint_ko: '연수 정보에서 제목을 넣어 주세요.' });
  return issues;
}
