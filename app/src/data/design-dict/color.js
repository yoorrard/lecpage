// ⑥ 색. 팔레트는 데이터로 만들고 명도 대비(WCAG)를 계산해 함께 보여 줌
const lum = (hex) => {
  const v = hex.replace('#', '').match(/../g).map((x) => parseInt(x, 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const grade = (r) => (r >= 7 ? 'AAA' : r >= 4.5 ? 'AA' : r >= 3 ? '큰 글자만' : '부족');
const on = (bg) => (ratio(bg, '#ffffff') >= ratio(bg, '#111111') ? '#ffffff' : '#111111');

// [id, 이름, 영어, { bg, ink, acc, acc2?, acc3?, soft }, 어울릴 때, 태그, 한 줄]
const PAL = [
  ['pal-hanji', '먹과 한지', 'Ink & Hanji', { bg: '#f3eee3', ink: '#1d1b18', acc: '#b23a2b', soft: '#e4dccb' }, '전통·역사·인문 강의. 인주 빨강은 지금·중요 표시에만.', ['전통', '미색', '빨강'], '한지 미색 바탕에 먹색 글자, 도장 빨강 한 점.'],
  ['pal-dancheong', '단청', 'Dancheong Palette', { bg: '#f5efe2', ink: '#1f2a2a', acc: '#c8442f', acc2: '#1f6b57', acc3: '#e2a92b', soft: '#e7dcc6' }, '한국 문화·지역 축제. 넓은 면은 바탕색, 단청색은 작게.', ['전통', '오방색', '축제'], '단청의 주홍·녹청·황색을 절제해 쓴 짝.'],
  ['pal-navy', '남색 교실', 'Navy Classroom', { bg: '#0f1f3d', ink: '#f2f4f8', acc: '#ffb547', soft: '#1b2f56' }, '직무연수·기관 행사처럼 신뢰가 필요하면서 어둡게 보는 발표 화면.', ['남색', '신뢰', '어두운 바탕'], '깊은 남색 바탕과 호박색 강조.'],
  ['pal-forest', '숲', 'Forest', { bg: '#e8eedf', ink: '#1e3b2f', acc: '#a8641a', soft: '#d3dfc3' }, '환경·생태·숲 교육, 차분한 성찰 연수.', ['자연', '초록', '흙색'], '이끼 초록 바탕에 짙은 숲색 글자, 흙빛 강조.'],
  ['pal-ocean', '바다와 산호', 'Ocean & Coral', { bg: '#e9f3f5', ink: '#0b3954', acc: '#e4572e', soft: '#cde4ea' }, '과학·해양·여름 캠프처럼 시원한 강의.', ['바다', '파랑', '산호'], '맑은 물빛 바탕, 깊은 바다 글자, 산호 강조.'],
  ['pal-riso', '리소 별색', 'Riso Spot Colors', { bg: '#faf6ee', ink: '#1a1a1a', acc: '#e8399e', acc2: '#0078bf', acc3: '#ffe800', soft: '#efe8da' }, '예술·워크숍·청소년 행사. 별색끼리 곱하기로 겹쳐요.', ['인쇄', '분홍', '파랑'], '형광 분홍·파랑·노랑 리소 잉크 세 가지.'],
  ['pal-night', '밤하늘', 'Night Sky', { bg: '#0b1020', ink: '#e7e9f5', acc: '#ffd580', acc2: '#8ab4ff', soft: '#161d36' }, '디지털·AI·천문 주제, 어두운 강의실 발표 화면.', ['어두운 바탕', '별빛', '미래'], '밤 남색 바탕에 별빛 노랑과 하늘색.'],
  ['pal-blossom', '벚꽃', 'Cherry Blossom', { bg: '#fff5f7', ink: '#3b2a30', acc: '#c43e6c', soft: '#fbdde5' }, '봄 행사·입학·학부모 설명회처럼 부드러운 분위기.', ['봄', '분홍', '부드러움'], '연분홍 바탕과 진한 꽃잎 분홍.'],
  ['pal-mono', '흑백과 강조색 하나', 'Monochrome + One Accent', { bg: '#ffffff', ink: '#111111', acc: '#e63900', soft: '#efefef' }, '정보가 많은 안내·스위스 격자. 강조색은 지금·주요 버튼에만.', ['흑백', '절제', '주황'], '흰 바탕과 검정, 그리고 주황 하나.'],
  ['pal-dopamine', '도파민 파스텔', 'Dopamine Pastel', { bg: '#fff0d6', ink: '#1a1a2e', acc: '#ef5350', acc2: '#26a69a', acc3: '#ffd54f', soft: '#ffe3b3' }, '초등·캠프·축제처럼 신나는 분위기.', ['쨍한 색', '파스텔', '축제'], '버터 바탕에 토마토·민트·레몬.'],
];

const pal = ([id, ko, en, c, fit, tags, desc]) => {
  const sw = [['바탕', c.bg], ['글자', c.ink], ['강조', c.acc], c.acc2 && ['보조', c.acc2], c.acc3 && ['보조', c.acc3], ['면', c.soft]].filter(Boolean);
  const r1 = ratio(c.ink, c.bg), r2 = ratio(c.acc, c.bg);
  return {
    id, ko, en: `${en} Palette`, desc, fit,
    tech: `--bg:${c.bg}; --ink:${c.ink}; --accent:${c.acc}${c.acc2 ? `; --accent-2:${c.acc2}` : ''} (글자 대비 ${r1.toFixed(1)}:1)`,
    tags: ['팔레트', ...tags],
    css: `body{background:${c.bg};color:${c.ink}}
.w{position:absolute;inset:5vmin 6vmin;display:grid;grid-template-rows:auto 1fr auto;gap:2.4vmin}
.hd{display:flex;justify-content:space-between;align-items:center}
.hd b{font-size:4.6vmin;letter-spacing:-.03em}
.now{background:${c.acc};color:${on(c.acc)};border-radius:99px;padding:.8vmin 2.4vmin;font-size:2.4vmin;font-weight:700}
.rows{display:grid;gap:1.2vmin;align-content:start}
.rw{display:flex;justify-content:space-between;background:${c.soft};border-radius:1.4vmin;padding:1.6vmin 2.4vmin;font-size:2.7vmin}
.rw.on{outline:.5vmin solid ${c.acc};outline-offset:-.5vmin;font-weight:700}
.rw i{font-style:normal;opacity:.65;font-variant-numeric:tabular-nums}
.ft{display:flex;gap:1.4vmin;align-items:stretch}
.sw{flex:1;border-radius:1.4vmin;min-height:12vmin;padding:1.2vmin;display:flex;flex-direction:column;justify-content:flex-end;font:1.9vmin/1.3 ui-monospace,monospace;box-shadow:inset 0 0 0 1px rgba(127,127,127,.25);animation:up .6s both}
.sw:nth-child(2){animation-delay:.06s}.sw:nth-child(3){animation-delay:.12s}.sw:nth-child(4){animation-delay:.18s}.sw:nth-child(5){animation-delay:.24s}.sw:nth-child(6){animation-delay:.3s}
@keyframes up{from{opacity:0;transform:translateY(2vmin)}}
.cr{font-size:2.2vmin;opacity:.8}`,
    html: `<div class="w"><div class="hd"><b>오늘의 흐름</b><span class="now">지금 · 실습 2</span></div><div class="rows"><div class="rw"><span>여는 말</span><i>13:00</i></div><div class="rw on"><span>실습 2 · 프롬프트 다듬기</span><i>13:50</i></div><div class="rw"><span>모둠 나눔</span><i>14:40</i></div><p class="cr">글자/바탕 대비 ${r1.toFixed(1)}:1 ${grade(r1)} · 강조/바탕 ${r2.toFixed(1)}:1 ${grade(r2)}</p></div><div class="ft">${sw.map(([k, v]) => `<div class="sw" style="background:${v};color:${on(v)}">${k}<br>${v}</div>`).join('')}</div></div>`,
  };
};

export default [
  ...PAL.map(pal),
  {
    id: 'mesh-gradient', ko: '메시 그라데이션', en: 'Mesh Gradient',
    desc: '여러 색 점이 서로 번지며 섞이는 부드러운 색면. 천천히 흐르게 하면 살아 있는 바탕이 돼요.',
    fit: '첫 화면 바탕 한 곳. 글자 아래에는 대비가 충분한 판을 깔아요.',
    tech: 'radial-gradient 여러 겹(각자 다른 위치·색) + @property로 위치 변수를 천천히 애니메이션',
    tags: ['그라데이션', 'radial', '@property', '바탕'],
    css: `@property --a{syntax:'<percentage>';inherits:false;initial-value:20%}@property --b{syntax:'<percentage>';inherits:false;initial-value:80%}
body{background:radial-gradient(at var(--a) 20%,#ffb86b 0,transparent 55%),radial-gradient(at var(--b) 30%,#ff5e8a 0,transparent 50%),radial-gradient(at 30% var(--b),#7c6cff 0,transparent 55%),radial-gradient(at 80% var(--a),#43d1c0 0,transparent 50%),#ffe8d6;animation:m 10s ease-in-out infinite alternate}
@keyframes m{to{--a:70%;--b:30%}}
.t{position:absolute;left:6vmin;bottom:6vmin;background:rgba(255,255,255,.78);border-radius:2vmin;padding:2.4vmin 3vmin;font-size:2.8vmin;color:#2a1b2e}.t b{display:block;font-size:4.6vmin}`,
    html: `<div class="t"><b>봄 학기 여는 날</b>색이 천천히 흐르는 바탕</div>`,
  },
  {
    id: 'aurora', ko: '오로라 그라데이션', en: 'Aurora Gradient',
    desc: '어두운 바탕 위로 흐린 빛 띠가 일렁이는 북극광 같은 배경.',
    fit: '밤·우주·AI 주제의 어두운 첫 화면. 한 곳만, 움직임은 아주 느리게.',
    tech: '크게 흐린(filter:blur) 색 덩어리 여러 개 + 느린 회전·이동 keyframes + mix-blend-mode:screen',
    tags: ['어두운 바탕', '빛', 'blur', '배경'],
    css: `body{background:#05070f}
.a{position:absolute;inset:-30%;filter:blur(8vmin);opacity:.9}
.a i{position:absolute;width:70%;height:30%;left:15%;border-radius:50%;mix-blend-mode:screen;animation:fl 12s ease-in-out infinite alternate}
.a i:nth-child(1){top:30%;background:#00ffa3;transform:rotate(-12deg)}.a i:nth-child(2){top:42%;background:#3b82f6;animation-delay:-4s;transform:rotate(8deg)}.a i:nth-child(3){top:36%;background:#a855f7;animation-delay:-8s;width:50%}
@keyframes fl{to{transform:translate(12%,-10%) rotate(10deg) scale(1.2)}}
.t{position:absolute;left:0;right:0;bottom:12vmin;text-align:center;color:#e9f1ff;font:300 6vmin/1.2 system-ui;letter-spacing:-.02em}.t b{font-weight:800}`,
    html: `<div class="a"><i></i><i></i><i></i></div><div class="t">밤하늘을 <b>읽는</b> 시간</div>`,
  },
  {
    id: 'conic-gradient', ko: '원뿔 그라데이션', en: 'Conic Gradient',
    desc: '한 점을 중심으로 색이 빙 돌아가는 그라데이션. 원그래프·회전하는 빛 테두리를 만들어요.',
    fit: '투표 결과 원그래프, 지금 진행 중인 카드의 빛나는 테두리.',
    tech: 'conic-gradient(from var(--ang), …) + @property --ang로 회전 + mask로 테두리만 남기기',
    tags: ['conic', '원그래프', '테두리', '@property'],
    css: `@property --ang{syntax:'<angle>';inherits:false;initial-value:0deg}
body{background:#0f0f13;color:#fff}
.w{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:8vmin}
.pie{width:34vmin;height:34vmin;border-radius:50%;background:conic-gradient(#ff6b6b 0 46%,#feca57 0 74%,#48dbfb 0 90%,#5f6c80 0);position:relative}
.pie::after{content:"46%";position:absolute;inset:9vmin;border-radius:50%;background:#0f0f13;display:grid;place-items:center;font:700 5vmin system-ui}
.cd{position:relative;width:38vmin;height:24vmin;border-radius:3vmin;background:#1b1b22;display:grid;place-content:center;text-align:center;font-size:2.8vmin}
.cd::before{content:"";position:absolute;inset:-.6vmin;border-radius:3.4vmin;background:conic-gradient(from var(--ang),#ff6b6b,#feca57,#48dbfb,#a29bfe,#ff6b6b);z-index:-1;animation:rot 3s linear infinite}
.cd b{display:block;font-size:4vmin}
@keyframes rot{to{--ang:360deg}}`,
    html: `<div class="w"><div class="pie"></div><div class="cd"><span>진행 중</span><b>실습 2</b></div></div>`,
  },
  {
    id: 'dark-mode', ko: '다크 모드', en: 'Dark Mode / light-dark()',
    desc: '기기 설정에 맞춰 밝은 화면과 어두운 화면이 저절로 바뀌는 색 체계.',
    fit: '어두운 강의실에서 휴대폰을 보는 참가자, 발표 화면.',
    tech: 'color-scheme:light dark + 색마다 light-dark(밝은값, 어두운값) + prefers-color-scheme',
    tags: ['다크 모드', 'light-dark()', 'color-scheme', '접근성'],
    css: `:root{color-scheme:light}
.th{position:absolute;inset:0;background:light-dark(#f7f5f0,#121214);color:light-dark(#1b1b1f,#eeeef0);transition:background .6s,color .6s;padding:6vmin 7vmin;display:grid;align-content:start;gap:2.4vmin}
.th.dk{color-scheme:dark}
.hd{display:flex;justify-content:space-between;align-items:center}.hd b{font-size:4.8vmin}
.tg{width:12vmin;height:6.4vmin;border-radius:99px;background:light-dark(#e2dfd8,#2c2c33);position:relative}.tg i{position:absolute;top:.8vmin;left:.8vmin;width:4.8vmin;height:4.8vmin;border-radius:50%;background:light-dark(#ffb300,#c7d2fe);transition:transform .5s cubic-bezier(.3,1.5,.5,1);box-shadow:inset -1.4vmin -.6vmin 0 light-dark(transparent,#2c2c33)}.dk .tg i{transform:translateX(5.6vmin)}
.cd{background:light-dark(#fff,#1d1d22);border:1px solid light-dark(#e6e2da,#2f2f37);border-radius:2vmin;padding:2.6vmin;font-size:2.8vmin;transition:background .6s,border-color .6s}
.cd small{color:light-dark(#6b6b73,#9a9aa5)}
.bt{justify-self:start;background:light-dark(#1b1b1f,#eeeef0);color:light-dark(#fff,#121214);border-radius:1.4vmin;padding:1.4vmin 3vmin;font-size:2.6vmin;font-weight:700;transition:background .6s,color .6s}`,
    html: `<div class="th"><div class="hd"><b>오늘의 강의</b><div class="tg"><i></i></div></div><div class="cd"><small>지금</small><br>실습 2 · 프롬프트 다듬기</div><div class="cd"><small>다음</small><br>모둠 나눔 · 14:40</div><span class="bt">질문 쓰기</span></div>`,
    js: `var t=document.querySelector('.th');t.onclick=function(){t.classList.toggle('dk')};if(!RM)setInterval(function(){t.classList.toggle('dk')},2200);if(!CSS.supports('color','light-dark(#000,#fff)'))t.style.background='#f7f5f0';`,
  },
  {
    id: 'contrast', ko: '명도 대비', en: 'Color Contrast (WCAG)',
    desc: '글자와 바탕의 밝기 차이. 본문은 4.5:1 이상, 큰 글자는 3:1 이상이어야 잘 읽혀요.',
    fit: '모든 강의 사이트. 강당 뒷자리·햇빛 아래 휴대폰에서도 읽히게.',
    tech: '상대 휘도로 대비 계산((L1+0.05)/(L2+0.05)) → 본문 AA 4.5:1, 큰 글자 3:1, AAA 7:1',
    tags: ['접근성', 'WCAG', '대비', '가독성'],
    css: `body{background:#fff;font-family:system-ui}
.w{position:absolute;inset:4vmin 5vmin;display:grid;grid-template-columns:repeat(2,1fr);gap:2vmin}
.s{border-radius:2vmin;padding:2.6vmin;display:flex;flex-direction:column;justify-content:space-between;transition:background .4s,color .4s}
.s b{font-size:4.2vmin;line-height:1.2}.s span{font-size:2.3vmin;opacity:.9}
.g{display:inline-block;margin-top:1vmin;font:700 2.2vmin ui-monospace,monospace;padding:.4vmin 1.4vmin;border-radius:9px;background:rgba(255,255,255,.85);color:#111;align-self:flex-start}
.g.bad{background:#d92d20;color:#fff}`,
    html: `<div class="w"><div class="s" data-b="#f2f2f2" data-c="#999999"><b>연한 회색 글자</b><span class="g"></span></div><div class="s" data-b="#f2f2f2" data-c="#3d3d3d"><b>진한 회색 글자</b><span class="g"></span></div><div class="s" data-b="#ffcd38" data-c="#ffffff"><b>노랑 위 흰 글자</b><span class="g"></span></div><div class="s" data-b="#1d3a8a" data-c="#ffffff"><b>남색 위 흰 글자</b><span class="g"></span></div></div>`,
    js: `function L(h){var v=h.slice(1).match(/../g).map(function(x){x=parseInt(x,16)/255;return x<=.03928?x/12.92:Math.pow((x+.055)/1.055,2.4)});return .2126*v[0]+.7152*v[1]+.0722*v[2]}function R(a,b){var x=L(a),y=L(b);if(x<y){var t=x;x=y;y=t}return (x+.05)/(y+.05)}document.querySelectorAll('.s').forEach(function(s){var b=s.dataset.b,c=s.dataset.c,r=R(b,c),g=s.querySelector('.g');s.style.background=b;s.style.color=c;g.textContent=r.toFixed(1)+':1 '+(r>=7?'AAA':r>=4.5?'AA':r>=3?'큰 글자만':'부족');if(r<4.5)g.classList.add('bad')});`,
  },
  {
    id: 'oklch', ko: 'OKLCH와 색 섞기', en: 'OKLCH & color-mix()',
    desc: '사람 눈에 고르게 밝아지는 색 공간. 한 색에서 밝기 단계를 만들면 HSL보다 고르게 나와요.',
    fit: '강조색 하나로 밝은 면·테두리·눌림 색까지 자동으로 만들 때.',
    tech: 'oklch(L C H)로 밝기만 바꾼 단계 + color-mix(in oklch, var(--accent) 20%, white) 연한 면',
    tags: ['OKLCH', 'color-mix()', '단계', '최신 기능'],
    css: `body{background:#fff;font-family:system-ui;color:#222}
.w{position:absolute;inset:5vmin 6vmin;display:grid;gap:2.6vmin;align-content:center}
.r{display:grid;grid-template-columns:16vmin repeat(7,1fr);gap:1vmin;align-items:center;font-size:2.3vmin}
.r i{height:10vmin;border-radius:1.2vmin;animation:in .5s both;animation-delay:calc(var(--i)*50ms)}
@keyframes in{from{transform:scaleY(.2);opacity:0}}
.r small{grid-column:2/-1;font:1.9vmin ui-monospace,monospace;color:#999}
.mx{display:flex;gap:1.4vmin;align-items:center;font-size:2.4vmin}.mx span{padding:1.4vmin 2.4vmin;border-radius:1.2vmin}`,
    html: `<div class="w"><div class="r"><b>HSL</b></div><div class="r"><b>OKLCH</b></div><div class="mx"><span style="background:color-mix(in oklch,#e4572e 15%,white)">15%</span><span style="background:color-mix(in oklch,#e4572e 40%,white)">40%</span><span style="background:#e4572e;color:#fff">강조색</span><span style="background:color-mix(in oklch,#e4572e 70%,black);color:#fff">눌림</span></div></div>`,
    js: `var rs=document.querySelectorAll('.r');for(var i=0;i<7;i++){var a=document.createElement('i'),b=document.createElement('i');a.style.cssText='--i:'+i+';background:hsl(250 80% '+(20+i*11)+'%)';b.style.cssText='--i:'+i+';background:oklch('+(.3+i*.1)+' .16 270)';rs[0].appendChild(a);rs[1].appendChild(b)}`,
  },
];
