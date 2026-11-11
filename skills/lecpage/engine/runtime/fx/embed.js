/* LecFX 견본 스크립트(core.js 다음에 실행, classic script · 의존성 없음 · MIT-0)
 *
 * 1) 견본 전체: 쪽에 있는 효과 견본(article#fx-<id>)마다 effects/<id>.js를 불러오고, 위 메뉴(테마·강도·저사양)를 잇습니다.
 * 2) 효과 하나만(embed): demo.html?fx=<id>&embed=1[&theme=light|dark|auto]
 *    - 그 효과의 견본 장면 하나만 화면 가득 그립니다(메뉴·설명·스크롤 막대 없음). 280×170쯤의 작은 틀과 900×500쯤의 큰 틀 모두에서 읽히게 글자 크기가 틀에 맞춰집니다.
 *    - 몇 초마다 되풀이합니다. 스크롤·포인터·누름으로 움직이는 효과는 스크롤·포인터·누름을 흉내 내어 손대지 않아도 움직입니다
 *      (실제로 마우스를 올리면 흉내를 잠깐 멈추고 손에 맡깁니다).
 *    - 동작 줄이기 설정이면 되풀이·흉내를 하지 않고 완성된 모습만 보여 줍니다.
 *    - 바깥 라이브러리(GSAP·Lenis·OGL)가 막혀 있으면 그 효과는 멈춘 그림으로 남습니다. 나머지는 인터넷 없이도 움직입니다.
 *    - 모르는 효과 아이디면 작은 안내만 보여 줍니다.
 *    - effects/<id>.js 하나(와 꼭 필요한 짝)만 불러옵니다. 인라인 스크립트·이벤트 속성은 쓰지 않습니다.
 */
(function () {
  'use strict';
  var w = window, d = document, h = d.documentElement, E = w.__lecfxEmbed;
  function load(src, cb) { var s = d.createElement('script'); s.src = src; s.async = false; s.onload = s.onerror = function () { if (cb) cb(); }; d.head.appendChild(s); }
  function $(s, r) { return (r || d).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); }

  /* ── 1) 견본 전체 ───────────────────────────── */
  if (!E) {
    $$('article.demo-fx[id^="fx-"]').forEach(function (a) { load('effects/' + a.id.slice(3) + '.js'); });
    var th = $('#demo-theme'), mo = $('#demo-motion'), lo = $('#demo-low');
    if (!th || !mo || !lo) return;
    th.value = h.getAttribute('data-theme') || 'light';
    mo.value = h.getAttribute('data-motion') || '3';
    lo.value = h.getAttribute('data-fx-lowpower') || '';
    var restart = function () { if (!w.LecFX) return; w.LecFX.stop(); w.LecFX.start(); };
    th.addEventListener('change', function (e) { h.setAttribute('data-theme', e.target.value); });
    mo.addEventListener('change', function (e) { h.setAttribute('data-motion', e.target.value); restart(); });
    lo.addEventListener('change', function (e) { if (e.target.value) h.setAttribute('data-fx-lowpower', e.target.value); else h.removeAttribute('data-fx-lowpower'); restart(); });
    /* 탭 견본(실제 사이트에서는 lecpage.js 몫) */
    var tabs = $$('.demo-tabs [role=tab]');
    tabs.forEach(function (t) { t.addEventListener('click', function () { tabs.forEach(function (x) { var on = x === t; x.setAttribute('aria-selected', on); x.tabIndex = on ? 0 : -1; d.getElementById(x.getAttribute('aria-controls')).hidden = !on; }); }); });
    return;
  }

  /* ── 2) 효과 하나만 ───────────────────────────── */
  var id = E.id, FX = w.LecFX;
  var RM = !!(w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var VW = function () { return w.innerWidth; }, VH = function () { return w.innerHeight; };
  // 원래 견본 쪽의 내용은 걷어 냄(효과가 숨은 견본까지 훑지 않게)
  d.body.removeAttribute('data-fx');
  Array.prototype.slice.call(d.body.children).forEach(function (n) { if (n.tagName !== 'SCRIPT') n.remove(); });
  var root = d.createElement('div'); root.id = 'em-root'; d.body.appendChild(root);

  /* 장면에 쓰는 글(실제 연수에서 볼 만한 내용) */
  var COPY = [
    ['사회정서학습 연수', '마음이 먼저<br>도착하는 교실', '5월 13일 · 시청각실'],
    ['디지털 역량 연수', '데이터로 읽는<br>우리 반', '12월 16일 · 디지털실습실'],
    ['독서 교육 연수', '그림책으로 여는<br>감정 수업', '6월 10일 · 도서관'],
    ['생태전환교육 연수', '학교 숲에서<br>한 시간', '4월 22일 · 학교 숲'],
    ['수업 설계 연수', 'AI와 함께<br>짜는 수업', '11월 4일 · 온라인'],
    ['과학 수업 나눔', '질문이 자라는<br>과학 시간', '9월 3일 · 과학실']
  ];
  function hash(s) { var x = 7; for (var i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) >>> 0; return x; }
  function copy(k) { var c = COPY[hash(k) % COPY.length]; return '<div class="em-copy"><p class="em-k">' + c[0] + '</p><h2 class="em-h">' + c[1] + '</h2><p class="em-s">' + c[2] + '</p></div>'; }
  function opts(o) { return o ? " data-fx-opts='" + JSON.stringify(o) + "'" : ''; }
  /* 배경 그래픽 장면: 첫 화면처럼 글을 얹어 보여 줌 */
  function stage(k, o, cls) { return '<div class="em em-stage' + (cls ? ' ' + cls : '') + '" data-fx="' + k + '"' + opts(o) + '>' + copy(k) + '</div>'; }
  function cards(list) { return list.map(function (c) { return '<article class="em-card"><h4>' + c[0] + '</h4><p>' + c[1] + '</p></article>'; }).join(''); }
  var ST3 = [['실습 1', '감정 낱말 카드 만들기'], ['실습 2', '마음 날씨 나누기'], ['실습 3', '멈추고·말하고·고르기']];
  var SCHED = '<li><time>15:30</time><b>마음 날씨로 시작하기</b><span>지금 마음을 한 낱말로</span></li><li><time>15:40</time><b>왜 마음이 먼저인가</b><span>감정과 배움의 관계</span></li><li><time>16:05</time><b>짝 활동</b><span>멈추고·말하고·고르기</span></li><li><time>16:35</time><b>나눔과 질문</b><span>우리 반에 옮기기</span></li><li><time>16:50</time><b>마무리</b><span>내일 해 볼 한 가지</span></li>';
  var PARTS = [['1부', '왜 마음이 먼저인가', '감정이 흔들리면 배움도 멈추는 까닭'], ['2부', '하루를 여는 감정 체크인', '아침 5분, 마음 날씨와 감정 낱말'], ['3부', '갈등을 배움으로 바꾸는 대화', '멈추고, 말하고, 함께 고르기'], ['마무리', '내일 해 볼 한 가지', '아침 인사에 한마디 더하기']];
  function sections(attr) { return PARTS.map(function (p, i) { return '<section class="em em-sec" id="em-s' + (i + 1) + '"' + attr(p, i) + '><p class="em-k">' + p[0] + '</p><h2 class="em-h sm">' + p[1] + '</h2><p class="em-s">' + p[2] + '</p></section>'; }).join(''); }

  /* 장면 목록: html(그릴 것) · replay(다시 시작 간격 ms) · scroll(자동 스크롤) · run(포인터·누름 흉내) · also(함께 불러올 효과) */
  var S = {
    // 글자
    'split-reveal': { html: '<div class="em"><p class="em-k">사회정서학습 연수</p><h2 class="em-h" data-fx="split-reveal">마음을 여는 첫 질문,<br>함께 시작해요</h2></div>', replay: 4200 },
    'kinetic-weight': { html: function () { return '<div class="em"><p class="em-k">마우스가 지나가는 글자가 굵어져요</p><p class="em-h" data-fx="kinetic-weight"' + opts({ mode: 'pointer', radius: Math.round(VW() * 0.26) }) + '>생각이 자라는 교실</p></div>'; }, run: function (P) { P.path(function () { var r = P.rect('.em-h'); var y = r.top + r.height / 2; return [[r.left - 20, y + 10], [r.right + 20, y - 4], [r.left - 20, y + 6]]; }, 4200, 500); } },
    'scroll-fill': { html: '<div class="em em-tall"><p class="em-lead" data-fx="scroll-fill">아이들의 감정은 고쳐야 할 문제가 아니라 함께 읽어야 할 신호입니다. 오늘은 그 신호를 알아차리고, 이름 붙이고, 다정하게 답하는 연습을 합니다.</p></div>', scroll: { down: 4600, hold: 900, up: 900, rest: 500 } },
    'scramble': { html: '<div class="em"><p class="em-k">디지털 역량 연수</p><h2 class="em-h" data-fx="scramble">데이터로 읽는 우리 반</h2></div>', replay: 3800 },
    'gradient-text': { html: '<div class="em"><p class="em-k">수업 설계 연수</p><h2 class="em-h" data-fx="gradient-text">미래 교실 실험실</h2></div>' },
    'marquee': { html: '<div class="em em-full"><ul class="em-mq" data-fx="marquee"><li>공감</li><li>경청</li><li>질문</li><li>기록</li><li>회복</li><li>연결</li></ul><ul class="em-mq em-mq2" data-fx="marquee"' + opts({ reverse: true, speed: 30 }) + '><li>Padlet</li><li>Mentimeter</li><li>CASEL</li><li>구글 시트</li><li>Gemini</li></ul></div>' },
    'counter': { html: '<div class="em"><div class="em-nums"><div><strong data-fx="counter">28명</strong><span>참가 선생님</span></div><div><strong data-fx="counter">90분</strong><span>연수 시간</span></div><div><strong data-fx="counter">5개</strong><span>실습</span></div></div></div>', replay: 4000 },
    'typewriter': { html: '<div class="em"><p class="em-k">오늘의 질문</p><h2 class="em-h sm" data-fx="typewriter">오늘 아침, 가장 먼저 표정이 보인 아이는 누구였나요?</h2></div>', replay: 5600 },
    'highlight-sweep': { html: '<div class="em"><p class="em-lead" data-fx="highlight-sweep">좋은 피드백은 <mark>구체적인 행동</mark>을 짚고, <mark>다음 한 걸음</mark>을 함께 정합니다.</p></div>', replay: 3600 },
    'word-rotate': { html: '<div class="em"><p class="em-k">교원 연수</p><h2 class="em-h"><span data-fx="word-rotate"' + opts({ words: ['함께', '즐겁게', '깊이'] }) + '>함께</span> 배우는 연수</h2></div>' },
    'link-underline': { html: '<div class="em"><ul class="em-links" data-fx="link-underline"><li><a href="#em-root">연수 자료 내려받기</a></li><li><a href="#em-root">사전 설문 참여하기</a></li><li><a href="#em-root">강사 소개 보기</a></li></ul></div>', run: function (P) { var i = 0; P.every(1300, function () { var a = P.all('.em-links a'); a.forEach(function (x) { x.classList.remove('em-hover'); }); var t = a[i++ % a.length]; var r = t.getBoundingClientRect(); P.glide(r.left + r.width * 0.6, r.top + r.height * 0.6, 420, function () { t.classList.add('em-hover'); }); }); } },
    // 스크롤·배치
    'reveal-up': { html: '<div class="em"><div class="em-grid" data-fx="reveal-up">' + cards(ST3) + '</div></div>', replay: 3400 },
    'clip-reveal': { html: '<div class="em em-full"><div class="em-photo" data-fx="clip-reveal"><figure><div class="ph ph-c"></div><figcaption>학교 숲 한 시간</figcaption></figure></div></div>', replay: 3800 },
    'parallax-soft': { html: '<div class="em em-par"><div class="ph ph-a em-par-a" data-fx="parallax-soft"' + opts({ speed: 0.1 }) + '></div><div class="ph ph-b em-par-b" data-fx="parallax-soft"' + opts({ speed: -0.1 }) + '></div><div class="em-copy"><p class="em-k">생태전환교육 연수</p><h2 class="em-h">학교 숲에서<br>한 시간</h2></div></div>', scroll: { down: 3600, hold: 300, up: 3600, rest: 200 } },
    'line-draw': { html: '<div class="em em-tall em-tall-sm"><ol class="em-sched" data-fx="line-draw">' + SCHED + '</ol></div>', scroll: { down: 5200, hold: 900, up: 900, rest: 500 } },
    'guided-progress': { html: '<div data-fx="guided-progress"' + opts({ top: '0px' }) + '></div>' + sections(function (p) { return ' data-nav="' + p[0] + '"'; }), scroll: { down: 6400, hold: 700, up: 1000, rest: 500 } },
    'sticky-scrolly': { html: '<div class="em-scrolly" data-fx="sticky-scrolly"><ol class="em-steps"><li data-step="1"><h4>알아차리기</h4><p>지금 내 몸과 마음을 살펴요.</p></li><li data-step="2"><h4>이름 붙이기</h4><p>감정 낱말 카드에서 골라요.</p></li><li data-step="3"><h4>들어 주기</h4><p>판단하지 않고 끝까지 들어요.</p></li><li data-step="4"><h4>함께 정하기</h4><p>교실에서 쓸 약속 하나를 정해요.</p></li></ol></div>', scroll: { down: 7000, hold: 700, up: 1100, rest: 500 } },
    'stack-cards': { html: '<div class="em-stackwrap"><div class="em-stack" data-fx="stack-cards"' + opts({ top: '9vh' }) + '>' + PARTS.map(function (p) { return '<article class="em-card em-big"><p class="em-k">' + p[0] + '</p><h4>' + p[1] + '</h4><p>' + p[2] + '</p></article>'; }).join('') + '</div></div>', scroll: { down: 6400, hold: 800, up: 1100, rest: 500 } },
    'horizontal-snap': { html: '<div class="em em-full"><p class="em-k em-pad">추천 도구</p><ul class="em-hsnap" data-fx="horizontal-snap"' + opts({ label: '추천 도구' }) + '>' + [['Padlet', '마음 날씨 보드'], ['Mentimeter', '한 낱말 워드클라우드'], ['구글 시트', '학습 기록 모으기'], ['Looker Studio', '우리 반 대시보드'], ['Gemini', '표 해석 돕기'], ['CASEL', '다섯 역량 읽기']].map(function (c) { return '<li class="em-card"><h4>' + c[0] + '</h4><p>' + c[1] + '</p></li>'; }).join('') + '</ul></div>', run: function (P) { var n = 0; P.every(1500, function () { var dir = Math.floor(n / 3) % 2 ? '-1' : '1'; n++; var b = P.one('.fx-hsnap-btn[data-dir="' + dir + '"]'); if (b) b.click(); }); } },
    'tone-journey': { html: '<div data-fx="tone-journey">' + [['night', '밤', '불이 꺼진 교실, 말하지 못한 마음'], ['dawn', '새벽', '감정에 이름을 붙이면 조금씩 밝아져요'], ['day', '낮', '다시 만난 아이들과 나누는 질문'], ['night', '다시 밤', '내일 해 볼 한 가지를 적어요']].map(function (t) { return '<section class="em em-sec" data-tone="' + t[0] + '"><h2 class="em-h">' + t[1] + '</h2><p class="em-s">' + t[2] + '</p></section>'; }).join('') + '</div>', scroll: { down: 6800, hold: 600, up: 1200, rest: 400 } },
    'zoom-through': { html: '<div class="em-zoom" data-fx="zoom-through"><div class="ph ph-c" data-zoom-media></div><p class="em-zoom-copy">학교 숲에서 한 시간</p></div><section class="em em-sec"><p class="em-k">1부</p><h2 class="em-h sm">숲에서 찾은 질문</h2></section>', scroll: { down: 5200, hold: 700, up: 1100, rest: 500 } },
    // 상호작용
    'magnetic': { html: '<div class="em em-c"><p class="em-k">마우스가 가까이 오면 끌려와요</p><div class="em-row"><a class="em-btn" href="#em-root" data-fx="magnetic">첫 실습 시작하기</a><a class="em-btn ghost" href="#em-root" data-fx="magnetic">교재 보기</a></div></div>', run: function (P) { P.path(function () { var r = P.rect('.em-btn'), cx = r.left + r.width / 2, cy = r.top + r.height / 2, a = r.width * 0.5, b = r.height * 0.9; var pts = [[cx - a * 2.2, cy + b * 2.4]]; for (var i = 0; i <= 8; i++) { var t = Math.PI + i * Math.PI / 4; pts.push([cx + Math.cos(t) * a, cy + Math.sin(t) * b]); } pts.push([cx + a * 2.4, cy + b * 2.2]); return pts; }, 4600, 700); } },
    'tilt': { html: '<div class="em"><div class="em-grid two" data-fx="tilt">' + cards([['감정 카드', '스물네 가지 감정 낱말'], ['마음 날씨', '오늘 내 마음은 어떤 날씨']]) + '</div></div>', run: function (P) { P.path(function () { var c = P.all('.em-card').map(function (x) { return x.getBoundingClientRect(); }); var pts = []; c.forEach(function (r) { pts.push([r.left + r.width * 0.12, r.top + r.height * 0.18], [r.left + r.width * 0.86, r.top + r.height * 0.3], [r.left + r.width * 0.2, r.top + r.height * 0.84], [r.left + r.width * 0.8, r.top + r.height * 0.8]); }); return pts; }, 6000, 500); } },
    'spotlight': { html: '<div class="em em-dark em-spot" data-fx="spotlight"><p class="em-k">실시간 참여</p><h2 class="em-h sm">질문 · 손들기 · 진행 현황 · 보드 · 타이머 · 교재 · 출석</h2></div>', run: function (P) { P.liss(0.36, 0.3, 5200); } },
    'cursor-follower': { html: '<div data-fx="cursor-follower"></div><div class="em"><p class="em-k">링크 위에서 고리가 커져요</p><ul class="em-links"><li><a href="#em-root">연수 자료 내려받기</a></li><li><a href="#em-root">사전 설문 참여하기</a></li><li><a href="#em-root">강사 소개 보기</a></li></ul></div>', run: function (P) { P.path(function () { var pts = [[VW() * 0.82, VH() * 0.2]]; P.all('.em-links a').forEach(function (a) { var r = a.getBoundingClientRect(); pts.push([r.left + r.width * 0.3, r.top + r.height / 2], [r.left + r.width * 0.8, r.top + r.height / 2]); }); pts.push([VW() * 0.8, VH() * 0.82]); return pts; }, 5600, 400); } },
    'micro-copy': { html: '<div class="em"><div class="em-prompt" data-fx="micro-copy"><p id="em-pr">초등 4학년 국어 시간에 쓸 감정 낱말 활동을 20분 분량으로 설계해 줘.</p><button class="em-btn sm" type="button" data-copy-target="#em-pr">복사</button></div></div>', run: function (P) { P.every(3200, function () { var b = P.one('.em-btn'); P.press(b, function () { if (FX.copied) FX.copied(b); }); }, 700); } },
    'confetti': { also: ['ripple'], html: '<div class="em em-c"><p class="em-k">실습 3 · 멈추고·말하고·고르기</p><button class="em-btn" type="button" data-fx="confetti ripple">완료 체크</button></div>', run: function (P) { P.every(2800, function () { var b = P.one('.em-btn'); P.press(b, function () { FX.celebrate({ el: b }); }); }, 600); } },
    'ripple': { html: '<div class="em em-c"><div class="em-row" data-fx="ripple"><button class="em-btn" type="button">질문 보내기</button><button class="em-btn ghost" type="button">도움 요청</button></div></div>', run: function (P) { var i = 0; P.every(1500, function () { var b = P.all('.em-btn'); P.press(b[i++ % b.length]); }, 500); } },
    'view-transition': { html: '<div class="em"><div class="em-tabs" data-fx="view-transition"><div role="tablist" aria-label="실습"><button role="tab" aria-selected="true" type="button">실습 1</button><button role="tab" aria-selected="false" type="button">실습 2</button><button role="tab" aria-selected="false" type="button">실습 3</button></div><div class="em-panel"><h4>감정 낱말 카드 만들기</h4><p>스물네 가지 낱말에서 오늘의 마음을 골라요.</p></div></div></div>', run: function (P) { var i = 0, T = [['감정 낱말 카드 만들기', '스물네 가지 낱말에서 오늘의 마음을 골라요.'], ['마음 날씨 나누기', '맑음·흐림·비로 지금 마음을 말해요.'], ['멈추고·말하고·고르기', '갈등 장면 카드로 대화를 연습해요.']]; P.every(2400, function () { i = (i + 1) % 3; var tabs = P.all('[role=tab]'), t = tabs[i]; P.press(t, function () { var go = function () { tabs.forEach(function (x, k) { x.setAttribute('aria-selected', String(k === i)); }); var p = P.one('.em-panel'); p.querySelector('h4').textContent = T[i][0]; p.querySelector('p').textContent = T[i][1]; }; if (FX.swap) FX.swap(go); else go(); }); }, 900); } },
    'border-beam': { html: '<div class="em"><article class="em-card em-big" data-fx="border-beam"><p class="em-k">지금 진행 중</p><h4>실습 2 · 마음 날씨 나누기</h4><p>테두리를 따라 빛줄기가 돌아요.</p></article></div>' },
    // 그래픽 배경
    'aurora': { html: stage('aurora') }, 'mesh-gradient': { html: stage('mesh-gradient') }, 'grain': { html: stage('grain') },
    'perspective-grid': { html: stage('perspective-grid', { sun: true }) }, 'starfield': { html: stage('starfield', { shooting: true }) },
    'particles-network': { html: stage('particles-network'), run: function (P) { P.liss(0.3, 0.26, 7000, true); } },
    'dot-grid': { html: stage('dot-grid'), run: function (P) { P.liss(0.32, 0.28, 6400, true); } },
    'topo-lines': { html: stage('topo-lines') }, 'waves': { html: stage('waves') }, 'blobs-morph': { html: stage('blobs-morph') }, 'bokeh': { html: stage('bokeh') },
    'paper-stack': { html: stage('paper-stack', { title: '감정 일기', note: '오늘 나를 웃게 한 일은?' }) },
    'doodle-scribbles': { html: '<div class="em"><h2 class="em-h sm">오늘의 <span data-fx="doodle-scribbles"' + opts({ mode: 'circle' }) + '>핵심 질문</span>은<br><span data-fx="doodle-scribbles"' + opts({ mode: 'underline', color: 'primary' }) + '>무엇일까요</span></h2><p class="em-lead em-lead-sm"><span data-fx="doodle-scribbles"' + opts({ mode: 'highlight', color: 'accent-2' }) + '>형광펜</span>과 <span data-fx="doodle-scribbles"' + opts({ mode: 'box' }) + '>상자</span>로 짚어요</p></div>', replay: 4600 },
    'confetti-shapes': { html: stage('confetti-shapes'), run: function (P) { P.liss(0.3, 0.26, 7000, true); } },
    'chalkboard': { html: stage('chalkboard') }, 'shader-gradient': { html: stage('shader-gradient') },
    'noise-orb': { html: stage('noise-orb', {}), run: function (P) { P.liss(0.28, 0.24, 7000, true); } },
    'riso': { html: stage('riso') },
    'blueprint-grid': { html: stage('blueprint-grid'), run: function (P) { P.liss(0.32, 0.28, 7000, true); } },
    // 라이브러리(막히면 멈춘 그림)
    'smooth-scroll': { html: '<div data-fx="smooth-scroll"></div>' + sections(function () { return ''; }), run: function (P) { P.wheel(); } },
    'gsap-scroll': { html: '<div class="em em-gsap" data-fx="gsap-scroll"><h4 class="em-h sm" data-gsap-item>핵심 메시지</h4><p class="em-lead em-lead-sm" data-gsap-item>아침 5분</p><p class="em-lead em-lead-sm" data-gsap-item>감정 낱말 하나</p><p class="em-lead em-lead-sm" data-gsap-item>들어 주는 한 사람</p></div><section class="em em-sec"><p class="em-k">다음</p><h2 class="em-h sm">배울 준비가 된 교실</h2></section>', scroll: { down: 6000, hold: 700, up: 1200, rest: 500 } },
    'three-hero': { html: '<div class="em em-stage em-orb" data-fx="three-hero"' + opts({}) + '><i class="em-orb-still" aria-hidden="true"></i>' + copy('three-hero') + '</div>', run: function (P) { P.liss(0.26, 0.22, 7000, true); P.after(3200, function () { if (root.querySelector('canvas')) root.classList.add('has-canvas'); }); } }
  };

  var sc = S[id];
  if (!sc || !FX) { root.innerHTML = '<div class="em em-c em-none"><p>미리 볼 수 없는 효과예요</p>' + (id ? '<code>' + id + '</code>' : '') + '</div>'; return; }

  /* ── 흉내 내기 도구 ───────────────────────────── */
  var cur = d.createElement('div'); cur.className = 'em-cur'; cur.setAttribute('aria-hidden', 'true');
  cur.innerHTML = '<svg viewBox="0 0 20 20"><path d="M3 2l13 7.2-5.6 1.5L8 16.5z" fill="#111" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>';
  d.body.appendChild(cur);
  var chain = [], px = -99, py = -99, userUntil = 0, timers = [], rafs = [], gen = 0;
  var now = function () { return w.performance.now(); };
  var ease = function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
  function fire(type, x, y, target, bubbles) {
    try { target.dispatchEvent(new w.PointerEvent(type, { bubbles: bubbles !== false, cancelable: true, composed: true, clientX: x, clientY: y, pointerType: 'mouse', isPrimary: true, pointerId: 1, view: w })); } catch (e) { /* 아주 오래된 브라우저 */ }
  }
  function moveTo(x, y, quiet) {
    px = x; py = y;
    cur.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
    cur.classList.toggle('is-on', !quiet);
    var t = d.elementFromPoint(x, y) || d.body, nc = [];
    for (var a = t; a && a.nodeType === 1; a = a.parentElement) nc.push(a);
    chain.forEach(function (n) { if (nc.indexOf(n) < 0) fire('pointerleave', x, y, n, false); });
    nc.forEach(function (n) { if (chain.indexOf(n) < 0) fire('pointerenter', x, y, n, false); });
    chain = nc;
    fire('pointermove', x, y, t);
  }
  function leave() { chain.forEach(function (n) { fire('pointerleave', px, py, n, false); }); chain = []; fire('pointerleave', px, py, d, false); cur.classList.remove('is-on'); }
  function raf(fn) { var g = gen; var f = function (t) { if (g !== gen) return; if (fn(t) !== false) rafs.push(w.requestAnimationFrame(f)); }; rafs.push(w.requestAnimationFrame(f)); }
  function later(ms, fn) { var g = gen; timers.push(setTimeout(function () { if (g === gen) fn(); }, ms)); }
  var hands = function () { return now() < userUntil; }; // 손으로 다루는 중이면 흉내를 쉼
  var P = {
    one: function (s) { return root.querySelector(s); },
    all: function (s) { return $$(s, root); },
    rect: function (s) { var e = root.querySelector(s); return e ? e.getBoundingClientRect() : { left: 0, top: 0, right: VW(), bottom: VH(), width: VW(), height: VH() }; },
    after: later,
    every: function (ms, fn, first) { var g = gen; var tick = function () { if (g !== gen) return; if (!hands()) fn(); timers.push(setTimeout(tick, ms)); }; timers.push(setTimeout(tick, first == null ? 500 : first)); },
    /* 점들을 따라 부드럽게 한 바퀴(dur) → 잠깐 쉼(rest) → 되풀이 */
    path: function (pointsFn, dur, rest) {
      var t0 = 0, pts = null;
      raf(function (t) {
        if (hands()) { t0 = 0; return; }
        if (!t0) { t0 = t; pts = pointsFn(); }
        var e = t - t0;
        if (e > dur) { if (e < dur + (rest || 0)) { if (chain.length) leave(); return; } t0 = 0; return; }
        var n = pts.length - 1, f = (e / dur) * n, i = Math.min(n - 1, Math.floor(f)), k = ease(f - i);
        moveTo(pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k);
      });
    },
    /* 화면 가운데를 도는 8자 모양(배경 그래픽이 포인터에 반응하는 모습). quiet면 화살표를 숨김 */
    liss: function (ax, ay, period, quiet) {
      raf(function (t) { if (hands()) return; var a = (t / period) * Math.PI * 2; moveTo(VW() * (0.5 + ax * Math.sin(a)), VH() * (0.5 + ay * Math.sin(a * 2 + 0.6)), quiet); });
    },
    glide: function (x, y, ms, done) {
      var x0 = px < 0 ? x + VW() * 0.2 : px, y0 = py < 0 ? y + VH() * 0.2 : py, t0 = 0;
      raf(function (t) { if (!t0) t0 = t; var k = Math.min(1, (t - t0) / ms); moveTo(x0 + (x - x0) * ease(k), y0 + (y - y0) * ease(k)); if (k >= 1) { if (done) done(); return false; } });
    },
    /* 단추로 가서 누름: pointerdown·up을 보내고(물결 등) 이어서 할 일을 부름 */
    press: function (el, then) {
      if (!el) return;
      var r = el.getBoundingClientRect(), x = r.left + r.width * 0.55, y = r.top + r.height * 0.55;
      P.glide(x, y, 460, function () { cur.classList.add('is-down'); fire('pointerdown', x, y, el); later(140, function () { fire('pointerup', x, y, el); cur.classList.remove('is-down'); if (then) then(); }); });
    },
    /* 부드러운 스크롤(Lenis): 휠을 굴린 것처럼. 라이브러리가 없으면 그냥 자동 스크롤 */
    wheel: function () {
      var dir = 1;
      later(1600, function () {
        if (!w.__lecLenis) { autoScroll({ down: 6400, hold: 600, up: 1200, rest: 500 }); return; }
        P.every(1300, function () {
          var max = h.scrollHeight - VH(), y = w.pageYOffset;
          if (y >= max - 4) dir = -1; else if (y <= 4) dir = 1;
          try { w.dispatchEvent(new w.WheelEvent('wheel', { deltaY: dir * VH() * 0.9, deltaMode: 0, bubbles: true, cancelable: true })); } catch (e) { /* 무시 */ }
        }, 100);
      });
    }
  };
  /* 자동 스크롤: 아래로(down) → 머묾(hold) → 위로(up) → 쉼(rest) */
  function autoScroll(o) {
    var t0 = 0, total = o.down + o.hold + o.up + (o.rest || 0);
    raf(function (t) {
      if (hands()) { t0 = 0; return; }
      if (!t0) t0 = t - (w.pageYOffset > 2 ? o.down : 0);
      var e = (t - t0) % total, m = Math.max(0, h.scrollHeight - VH()), y;
      if (e < o.down) y = ease(e / o.down) * m; else if (e < o.down + o.hold) y = m; else if (e < o.down + o.hold + o.up) y = (1 - ease((e - o.down - o.hold) / o.up)) * m; else y = 0;
      w.scrollTo(0, y);
    });
  }
  // 실제로 마우스·휠·손가락을 쓰면 3초 동안 흉내를 쉼
  ['pointermove', 'pointerdown', 'wheel', 'touchstart', 'keydown'].forEach(function (type) {
    w.addEventListener(type, function (e) { if (e.isTrusted) { userUntil = now() + 3000; cur.classList.remove('is-on'); } }, { passive: true, capture: true });
  });

  /* ── 그리기·되풀이 ───────────────────────────── */
  function build() {
    gen++; timers.forEach(clearTimeout); timers = []; rafs.forEach(w.cancelAnimationFrame); rafs = [];
    if (chain.length) leave();
    try { FX.stop(root); } catch (e) { /* 무시 */ }
    root.innerHTML = typeof sc.html === 'function' ? sc.html() : sc.html;
    w.scrollTo(0, 0);
    FX.start(root);
    if (RM) return; // 동작 줄이기: 완성된 모습 그대로
    if (sc.scroll) autoScroll(sc.scroll);
    if (sc.run) sc.run(P);
    if (sc.replay) later(sc.replay, build);
  }
  var files = [id].concat(sc.also || []), left = files.length;
  // 글꼴이 실린 뒤에 그림(글자 자리를 재는 효과가 어긋나지 않게). 글꼴이 막혀 있으면 1.2초 뒤 그냥 시작
  var began = false, begin = function () { if (began || left) return; began = true; build(); };
  var fontsReady = function () { var p = d.fonts && d.fonts.ready; if (p && p.then) { p.then(begin, begin); setTimeout(begin, 1200); } else begin(); };
  files.forEach(function (f) { load('effects/' + f + '.js', function () { if (--left === 0) fontsReady(); }); });
  // 틀 크기가 바뀌면(작은 카드 → 크게 보기) 다시 그림
  var rw = VW(), rt = 0;
  w.addEventListener('resize', function () { if (Math.abs(VW() - rw) < 24) return; rw = VW(); clearTimeout(rt); rt = setTimeout(function () { if (began) build(); }, 200); });
})();
