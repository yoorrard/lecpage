// 임시 사이트: 가짜 생성 API(lib/gen/mock.js)와 먼저 해보기 녹화(data/demo-run.js)가 돌려주는 'AI가 만든 사이트' 자리.
// 약속 A(docs/plan-ai-first.md §3) 꼴 그대로: index.html + assets/style.css + lecpage.json(meta), 키트 자리 표시(data-lp)를 씀.
// 레퍼런스 사이트(다른 작업자)와 진짜 생성 결과가 오면 이 파일은 지움.

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
function dayText(date) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || ''); if (!m) return '';
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return `${+m[2]}월 ${+m[3]}일(${DOW[d.getUTCDay()]})`;
}

const CSS = `:root{--lp-accent:#2f6b5e;--lp-ink:#1d2321;--lp-paper:#f6f3ec;--lp-font:"Pretendard","Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif;--lp-radius:14px;--soft:#e7efe9;--line:#d9d3c6;--muted:#58605c}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--lp-paper);color:var(--lp-ink);font:17px/1.7 var(--lp-font);word-break:keep-all;overflow-wrap:break-word}
img{max-width:100%;height:auto}
a{color:var(--lp-accent)}
.wrap{width:min(1080px,100% - 40px);margin:0 auto}
.top{position:sticky;top:0;z-index:5;background:color-mix(in srgb,var(--lp-paper) 92%,transparent);backdrop-filter:blur(8px);border-bottom:1px solid var(--line)}
.top .wrap{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:56px}
.top b{font-size:.95rem;letter-spacing:-.01em}
.top nav{display:flex;gap:4px;overflow-x:auto}
.top nav a{padding:6px 10px;border-radius:999px;text-decoration:none;color:var(--lp-ink);font-size:.9rem;white-space:nowrap}
.top nav a:hover{background:var(--soft)}
section{padding:72px 0;scroll-margin-top:56px}
section+section{border-top:1px solid var(--line)}
.hero{padding:88px 0 72px;background:radial-gradient(120% 90% at 100% 0,var(--soft),transparent 60%)}
.eyebrow{display:inline-block;margin:0 0 18px;padding:5px 12px;border-radius:999px;background:var(--lp-accent);color:#fff;font-size:.85rem;font-weight:700}
h1{margin:0;font-size:clamp(2rem,6vw,3.6rem);line-height:1.18;letter-spacing:-.03em}
h2{margin:0 0 8px;font-size:clamp(1.5rem,3.6vw,2.2rem);line-height:1.3;letter-spacing:-.02em}
h3{margin:0 0 6px;font-size:1.12rem;line-height:1.45}
.lead{max-width:36em;margin:18px 0 0;font-size:1.12rem;color:var(--muted)}
.when{display:flex;flex-wrap:wrap;gap:8px 18px;margin:28px 0 0;padding:0;list-style:none;font-weight:600}
.when li{display:flex;gap:8px;align-items:center}
.when li::before{content:"";width:8px;height:8px;border-radius:50%;background:var(--lp-accent)}
.go{display:inline-flex;margin-top:32px;padding:12px 22px;border-radius:999px;background:var(--lp-ink);color:var(--lp-paper);font-weight:700;text-decoration:none}
.cover{margin:40px 0 0;max-width:720px;border-radius:var(--lp-radius);overflow:hidden;border:1px solid var(--line);box-shadow:0 18px 40px -18px rgba(0,0,0,.25);background:#fff}
.cover img{display:block;width:100%;height:auto}
.sub{margin:0 0 28px;color:var(--muted)}
.flow{list-style:none;margin:0;padding:0;display:grid;gap:12px}
.flow li{display:grid;grid-template-columns:5.5em 1fr;gap:16px;padding:16px 18px;border-radius:var(--lp-radius);background:#fff;border:1px solid var(--line)}
.flow time{font-weight:800;color:var(--lp-accent);font-variant-numeric:tabular-nums}
.flow p{margin:2px 0 0;color:var(--muted);font-size:.95rem}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:14px}
.card{padding:22px;border-radius:var(--lp-radius);background:#fff;border:1px solid var(--line)}
.card .n{display:inline-grid;place-items:center;width:34px;height:34px;margin-bottom:12px;border-radius:10px;background:var(--soft);color:var(--lp-accent);font-weight:800}
.card p{margin:0;color:var(--muted);font-size:.95rem}
.step{margin-top:16px;padding:22px;border-radius:var(--lp-radius);background:#fff;border:1px solid var(--line)}
.step+.step{border-top:1px solid var(--line)}
.step ol{margin:10px 0 0;padding-left:1.3em}
.prompt{margin:14px 0 0;padding:14px 16px;border-radius:10px;background:var(--lp-ink);color:var(--lp-paper);font:15px/1.6 ui-monospace,Menlo,Consolas,monospace;white-space:pre-wrap}
.who{display:flex;gap:16px;align-items:center;margin-top:24px}
.who .face{width:56px;height:56px;border-radius:50%;background:var(--soft);display:grid;place-items:center;font-weight:800;color:var(--lp-accent)}
.who p{margin:0;color:var(--muted);font-size:.95rem}
footer{padding:36px 0 120px;color:var(--muted);font-size:.9rem}
@media (max-width:600px){section{padding:52px 0}.hero{padding:56px 0 52px}.flow li{grid-template-columns:1fr;gap:4px}.top nav{display:none}}`;

/**
 * @param {object} o 연수 내용(교재에서 찾았다고 치는 값)
 * @returns {{ site: Record<string,string>, meta: object }}
 */
export function tempSite(o = {}) {
  const title = o.title || '새 연수';
  const sub = o.subtitle || '교재를 바탕으로 오늘 배울 것과 실습을 한곳에 모았어요.';
  const when = [dayText(o.date), [o.start, o.end].filter(Boolean).join('~')].filter(Boolean).join(' ');
  const flow = o.flow || [['14:00', '여는 이야기', '오늘의 목표와 흐름을 함께 봐요.'], ['14:20', '개념 익히기', '교재의 핵심을 짧게 정리해요.'], ['15:10', '실습', '단계마다 따라 하고 완료를 눌러요.'], ['16:30', '나누기와 마무리', '만든 것을 나누고 질문에 답해요.']];
  const goals = o.goals || [['핵심 개념', '교재의 큰 줄기를 한 장으로 정리해요.'], ['바로 쓰는 실습', '내 수업에 옮길 수 있게 직접 해 봐요.'], ['나눔', '서로 만든 것을 보며 아이디어를 더해요.']];
  const steps = o.steps || [['1단계: 자료 열기', ['교재의 예시 파일을 열어요.', '첫 장의 표를 살펴봐요.'], ''], ['2단계: 정리하기', ['표를 한 줄로 요약해요.', '요약을 옆 사람과 견줘 봐요.'], '']];
  const inst = o.instructor || { name: '', org: '' };
  const nav = [['flow', '흐름'], ['goals', '목표'], ['lab', '실습'], ['deck', '교재'], ['poll', '투표'], ['qa', '질문']];
  const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<link rel="stylesheet" href="assets/style.css">
</head>
<body>
<header class="top"><div class="wrap"><b>${esc(title)}</b><nav aria-label="바로 가기">${nav.map(([id, t]) => `<a href="#${id}">${t}</a>`).join('')}</nav></div></header>
<main>
<section class="hero" id="intro" data-title="첫 화면"><div class="wrap">
<p class="eyebrow">${esc(o.eyebrow || '오늘의 연수')}</p>
<h1>${esc(o.headline || title)}</h1>
<p class="lead">${esc(sub)}</p>
<ul class="when">${when ? `<li>${esc(when)}</li>` : ''}${o.venue ? `<li>${esc(o.venue)}</li>` : ''}</ul>
<a class="go" href="#flow">오늘의 흐름 보기</a>
${o.figure ? `<figure class="cover"><img src="${esc(o.figure)}" alt="교재 첫 쪽" width="1280" height="720"></figure>` : ''}
</div></section>
<section id="flow" data-title="오늘의 흐름"><div class="wrap">
<h2>오늘의 흐름</h2>
<p class="sub">시간은 연수 상황에 따라 조금 달라질 수 있어요.</p>
<ol class="flow">${flow.map(([t, h, d]) => `<li><time>${esc(t)}</time><div><h3>${esc(h)}</h3><p>${esc(d)}</p></div></li>`).join('')}</ol>
</div></section>
<section id="goals" data-title="오늘 가져갈 것"><div class="wrap">
<h2>오늘 가져갈 것</h2>
<p class="sub">연수가 끝나면 이 세 가지가 손에 남아요.</p>
<div class="cards">${goals.map(([h, d], i) => `<article class="card"><span class="n">${i + 1}</span><h3>${esc(h)}</h3><p>${esc(d)}</p></article>`).join('')}</div>
</div></section>
<section id="lab" data-title="실습"><div class="wrap">
<h2>실습</h2>
<p class="sub">단계를 마치면 [완료]를 눌러 주세요. 막히면 [도움 요청]을 눌러요.</p>
${steps.map(([h, items, prompt], i) => `<section class="step" data-lp-step="s${i + 1}" data-title="${esc(h)}"><h3>${esc(h)}</h3><ol>${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>${prompt ? `<pre class="prompt">${esc(prompt)}</pre>` : ''}</section>`).join('\n')}
</div></section>
<section id="deck" data-title="교재 보기"><div class="wrap">
<h2>교재 보기</h2>
<p class="sub">강사가 넘기는 쪽을 따라 함께 넘어가요.</p>
<div data-lp="deck" data-pages="1-${Math.max(1, Math.min(o.pages || 6, 12))}"></div>
</div></section>
<section id="poll" data-title="한마디 투표"><div class="wrap">
<h2>한마디 투표</h2>
<div data-lp="poll" data-question="${esc(o.poll?.[0] || '오늘 내용 가운데 가장 먼저 해 볼 것은?')}" data-options='${JSON.stringify(o.poll?.[1] || ['핵심 개념 정리', '실습 따라 하기', '동료와 나누기']).replace(/'/g, '&#39;')}'></div>
</div></section>
<section id="qa" data-title="질문"><div class="wrap">
<h2>궁금한 점을 남겨 주세요</h2>
<p class="sub">공감이 많은 질문부터 답해요. 이름은 보이지 않아요.</p>
<div data-lp="qa"></div>
</div></section>
<section id="closing" data-title="마무리"><div class="wrap">
<h2>${esc(o.closing || '오늘 함께해 주셔서 고마워요')}</h2>
<p class="sub">자료는 이 주소에 계속 남아 있어요. 수업에 써 보고 궁금한 점은 언제든 물어 주세요.</p>
${inst.name ? `<div class="who"><span class="face" aria-hidden="true">${esc(inst.name.slice(0, 1))}</span><div><b>${esc(inst.name)}</b><p>${esc(inst.org || '')}</p></div></div>` : ''}
</div></section>
</main>
<footer><div class="wrap">${esc(o.organizer || title)}</div></footer>
</body>
</html>
`;
  const meta = {
    v: 2, title, subtitle: sub, organizer: o.organizer || '',
    sessions: o.date || o.start ? [{ date: o.date || '', start: o.start || '', end: o.end || '' }] : [],
    venue: o.venue || '', mode: 'offline', audience: 'teachers',
    instructors: inst.name ? [{ name: inst.name, org: inst.org || '' }] : [],
    features: ['qa', 'poll', 'attendance', 'help', 'reactions', 'deck', 'progress'],
    theme: { accent: '#2f6b5e', ink: '#1d2321', paper: '#f6f3ec', font: 'Pretendard' },
    facts: (o.facts || []).map((f) => ({ ...f })),
    live: null, siteUrl: '', joinUrl: '', shortUrl: '', access: 'link',
  };
  return { site: { 'index.html': html, 'assets/style.css': CSS }, meta };
}
