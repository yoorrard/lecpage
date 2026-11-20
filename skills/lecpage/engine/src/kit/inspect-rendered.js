// 그려서 검수(약속 C): 브라우저 안에서 도는 함수. Playwright page.evaluate와 앱의 숨은 틀(iframe) 둘 다에서 씁니다.
// inspectRendered는 바깥 변수를 하나도 쓰지 않아 inspectRendered.toString()으로 그대로 넘길 수 있습니다(의존성 없음).
// issue: { id, level, where:{ file, selector, section, width }, message_ko, fix_hint_ko }

/**
 * 지금 창의 폭에서 검수.
 * @param opts { doc: 검수할 document(기본 document), file: 'index.html', max: 규칙마다 최대 수(8) }
 */
export function inspectRendered(opts) {
  opts = opts || {};
  var doc = opts.doc || document, win = doc.defaultView || window, W = win.innerWidth, H = win.innerHeight;
  var file = opts.file || 'index.html', MAX = opts.max || 8, out = [], count = {};
  function add(id, level, el, msg, fix) {
    count[id] = (count[id] || 0) + 1; if (count[id] > MAX) return;
    out.push({ id: id, level: level, where: { file: file, selector: sel(el), section: secOf(el), width: W }, message_ko: msg, fix_hint_ko: fix });
  }
  function sel(el) {
    if (!el || el.nodeType !== 1) return '';
    if (el.id) return el.tagName.toLowerCase() + '#' + el.id;
    var parts = [], n = el;
    for (var i = 0; n && n.nodeType === 1 && i < 4; i++) {
      var s = n.tagName.toLowerCase();
      if (n.id) { parts.unshift(s + '#' + n.id); break; }
      var lp = n.getAttribute('data-lp'); if (lp) { parts.unshift('[data-lp="' + lp + '"]'); break; }
      var cls = (n.getAttribute('class') || '').split(/\s+/).filter(Boolean).slice(0, 2);
      if (cls.length) s += '.' + cls.join('.');
      else if (n.parentElement) { var same = Array.prototype.filter.call(n.parentElement.children, function (c) { return c.tagName === n.tagName; }); if (same.length > 1) s += ':nth-of-type(' + (same.indexOf(n) + 1) + ')'; }
      parts.unshift(s); n = n.parentElement;
    }
    return parts.join(' > ');
  }
  function secOf(el) {
    var s = el && el.closest && el.closest('section,[data-lp-step]');
    if (!s) return '';
    if (s.id) return s.id;
    var h = s.querySelector('h1,h2,h3'); return h ? h.textContent.replace(/\s+/g, ' ').trim().slice(0, 40) : '';
  }
  // 색 읽기: 계산된 색(rgb·oklch·color-mix 등 무엇이든)을 그림판에 칠해 RGBA로
  var cv = doc.createElement('canvas'); cv.width = cv.height = 1; var cx = cv.getContext('2d', { willReadFrequently: true }); var cache = {};
  function rgba(c) {
    if (!c) return null; if (cache[c]) return cache[c];
    var m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(c);
    var r;
    if (m) r = [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : /%$/.test(m[4]) ? parseFloat(m[4]) / 100 : +m[4]];
    else if (cx) { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); var d = cx.getImageData(0, 0, 1, 1).data; r = [d[0], d[1], d[2], d[3] / 255]; }
    return (cache[c] = r || null);
  }
  function lum(c) { var a = [c[0], c[1], c[2]].map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]; }
  function ratio(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function over(top, under) { var a = top[3]; return [top[0] * a + under[0] * (1 - a), top[1] * a + under[1] * (1 - a), top[2] * a + under[2] * (1 - a), 1]; }
  // 글자 뒤의 바탕색: 위로 올라가며 칠한 바탕을 겹침. 그림·그러데이션 바탕을 만나면 모름(null)
  function bgOf(el) {
    var stack = [];
    for (var n = el; n && n.nodeType === 1; n = n.parentElement) {
      var cs = win.getComputedStyle(n);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return null;
      var c = rgba(cs.backgroundColor);
      if (c && c[3] > 0) { stack.push(c); if (c[3] >= 0.99) break; }
    }
    var base = [255, 255, 255, 1];
    for (var i = stack.length - 1; i >= 0; i--) base = over(stack[i], base);
    return base;
  }
  function visible(el, cs) {
    cs = cs || win.getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.visibility === 'collapse' || +cs.opacity === 0) return false;
    if (el.closest('[hidden],[aria-hidden="true"],dialog:not([open]),template,.lp-sr,.sr-only,.visually-hidden')) return false;
    var shut = el.closest('details:not([open])'); if (shut && !(el.closest('summary') && el.closest('summary').parentElement === shut)) return false; // 닫힌 접기 상자 안(제목줄 말고)은 그려지지 않음
    var r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false;
    for (var n = el; n && n.nodeType === 1; n = n.parentElement) { var c = win.getComputedStyle(n); if (+c.opacity === 0) return false; if (c.clip === 'rect(0px, 0px, 0px, 0px)' || c.clipPath === 'inset(50%)') return false; }
    return true;
  }
  var root = doc.documentElement, scrollW = Math.max(root.scrollWidth, doc.body ? doc.body.scrollWidth : 0);
  // 가로 넘침
  if (scrollW > W + 1) {
    var culprits = [];
    Array.prototype.forEach.call(doc.body.querySelectorAll('*'), function (el) {
      if (culprits.length > 40) return;
      var r = el.getBoundingClientRect(); if (r.right <= W + 1 || r.width < 1) return;
      var cs = win.getComputedStyle(el); if (cs.position === 'fixed') return;
      for (var p = el.parentElement; p && p !== doc.body; p = p.parentElement) { var pc = win.getComputedStyle(p); if (/(auto|scroll|hidden|clip)/.test(pc.overflowX)) return; }
      if (el.parentElement && el.parentElement.getBoundingClientRect().right > W + 1 && culprits.indexOf(el.parentElement) >= 0) return;
      culprits.push(el);
    });
    add('overflow-x', 'error', culprits[0] || doc.body, '화면이 가로로 ' + Math.round(scrollW - W) + 'px 넘쳐 옆으로 밀려요' + (culprits.length ? '(' + culprits.slice(0, 3).map(sel).join(', ') + ')' : '') + '.', '넓이를 고정한 요소에 max-width:100%를 주고, 긴 낱말·주소는 overflow-wrap:anywhere, 표는 overflow-x:auto 틀 안에 넣어 주세요.');
  }
  // 글자 요소 모으기(글자 노드를 직접 가진 요소)
  var texts = [];
  var tw = doc.createTreeWalker(doc.body, 4, null), node;
  while ((node = tw.nextNode())) {
    if (!node.nodeValue || !node.nodeValue.trim()) continue;
    var el = node.parentElement; if (!el || texts.indexOf(el) >= 0 || /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|OPTION)$/.test(el.tagName)) continue;
    texts.push(el); if (texts.length > 1500) break;
  }
  // 움직이는 중인 요소(색·투명도가 바뀌는 중)는 색 검사에서 뺌: 끝난 모습이 아니라서
  var moving = (doc.getAnimations ? doc.getAnimations() : []).filter(function (a) { return a.playState === 'running' && a.effect && a.effect.target; }).map(function (a) { return a.effect.target; });
  function isMoving(el) { return moving.some(function (m) { return m === el || (m.contains && m.contains(el)); }); }
  var vis = texts.filter(function (el) { return visible(el); });
  var small = W <= 480;
  var seenSmall = 0;
  vis.forEach(function (el) {
    var cs = win.getComputedStyle(el), r = el.getBoundingClientRect(), fs = parseFloat(cs.fontSize);
    var chrome = el.closest('.lpk-chrome,.lpk-now');
    // 화면 밖으로 잘린 글(가로)
    if (!chrome && cs.position !== 'fixed' && (r.left < -1 || r.right > W + 1) && r.width < W * 3) {
      var clipped = false; for (var p = el.parentElement; p && p !== doc.body; p = p.parentElement) { var pc = win.getComputedStyle(p); if (/(auto|scroll)/.test(pc.overflowX)) { clipped = true; break; } }
      if (!clipped) add('clipped-text', 'warn', el, '"' + el.textContent.trim().slice(0, 30) + '" 글이 화면 밖으로 잘려요.', '이 글의 상자 폭을 화면 안으로(max-width:100%) 줄이거나 줄바꿈되게 해 주세요.');
    }
    // 상자보다 긴 글(넘침 숨김)
    if (!chrome && /(hidden|clip)/.test(cs.overflowX + cs.overflow) && el.scrollWidth > el.clientWidth + 2 && cs.textOverflow !== 'ellipsis' && el.clientWidth > 0) add('clipped-text', 'warn', el, '"' + el.textContent.trim().slice(0, 30) + '" 글이 상자 안에서 잘려요.', 'overflow:hidden을 빼거나 글이 줄바꿈되게 해 주세요.');
    // 너무 작은 글자(휴대폰)
    if (small && fs < 12 && !el.closest('svg,[aria-hidden="true"]') && el.textContent.trim().length > 1 && seenSmall++ < 40) add('small-text', 'warn', el, '휴대폰에서 글자가 ' + fs.toFixed(1) + 'px로 너무 작아요("' + el.textContent.trim().slice(0, 24) + '").', '휴대폰 폭에서는 글자를 12px(가능하면 14px) 이상으로 해 주세요.');
    // 안 보이는 글(글자색 ≈ 바탕)
    var fg = rgba(cs.color), bg = bgOf(el);
    if (fg && bg && !el.closest('svg') && !isMoving(el)) {
      var c = ratio(over(fg, bg), bg), big = fs >= 24 || (fs >= 18.66 && +cs.fontWeight >= 700);
      if (c < 1.6) add('invisible-text', 'error', el, '"' + el.textContent.trim().slice(0, 30) + '" 글이 바탕과 거의 같은 색이라 안 보여요(' + c.toFixed(2) + ':1).', '글자색이나 바탕색을 바꿔 4.5:1 이상으로 맞춰 주세요.');
      else if (c < (big ? 3 : 4.5)) add('low-contrast', 'warn', el, '"' + el.textContent.trim().slice(0, 30) + '" 글의 대비가 ' + c.toFixed(2) + ':1이에요(' + (big ? '큰 글은 3' : '4.5') + ':1 이상).', '글자색을 더 진하게(밝은 바탕) 또는 더 밝게(어두운 바탕) 해 주세요.');
    }
  });
  // 겹친 글: 서로 품지 않는 글 요소의 상자가 크게 겹침
  var boxes = vis.filter(function (el) { return !el.closest('.lpk-chrome,.lpk-now,[aria-hidden="true"]') && win.getComputedStyle(el).position !== 'fixed'; }).map(function (el) {
    var range = doc.createRange(); range.selectNodeContents(el); var r = range.getBoundingClientRect();
    // 실제로 보이는 부분만: 넘치는 것을 가리는 조상(overflow hidden·clip·auto·scroll)의 틀로 자름(말줄임표로 줄인 글, 가로로 넘기는 칸)
    var L = r.left, T = r.top, R = r.right, B = r.bottom;
    for (var n = el; n && n !== doc.body && n !== doc.documentElement; n = n.parentElement) {
      var oc = win.getComputedStyle(n); if (oc.overflowX === 'visible' && oc.overflowY === 'visible') continue;
      var q = n.getBoundingClientRect();
      if (oc.overflowX !== 'visible') { L = Math.max(L, q.left); R = Math.min(R, q.right); }
      if (oc.overflowY !== 'visible') { T = Math.max(T, q.top); B = Math.min(B, q.bottom); }
    }
    return { el: el, l: L, t: T + win.scrollY, r: R, b: B + win.scrollY };
  }).filter(function (x) { return x.r - x.l > 2 && x.b - x.t > 2; }).sort(function (a, b) { return a.t - b.t; });
  var hits = 0;
  for (var i = 0; i < boxes.length && hits < 60; i++) {
    for (var j = i + 1; j < boxes.length && boxes[j].t < boxes[i].b; j++) {
      var a = boxes[i], b = boxes[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      var w = Math.min(a.r, b.r) - Math.max(a.l, b.l), h = Math.min(a.b, b.b) - Math.max(a.t, b.t);
      if (w <= 2 || h <= 2) continue;
      var area = w * h, sm = Math.min((a.r - a.l) * (a.b - a.t), (b.r - b.l) * (b.b - b.t));
      if (area > sm * 0.3) { hits++; add('overlap-text', 'warn', b.el, '"' + a.el.textContent.trim().slice(0, 20) + '"와 "' + b.el.textContent.trim().slice(0, 20) + '" 글이 겹쳐요.', '겹친 요소의 position·음수 margin·고정 높이를 확인해 주세요.'); }
    }
  }
  // 깨진 그림
  Array.prototype.forEach.call(doc.images, function (img) {
    if (!img.getAttribute('src') || img.loading === 'lazy' && !img.complete) return;
    if (img.complete && img.naturalWidth === 0) add('broken-image', 'error', img, '그림이 열리지 않아요(' + String(img.getAttribute('src')).slice(0, 60) + ').', '그림 경로와 파일을 확인해 주세요.');
  });
  // 누를 곳 크기
  var seenT = 0;
  Array.prototype.forEach.call(doc.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[tabindex]:not([tabindex="-1"])'), function (el) {
    if (seenT > 200 || !visible(el)) return; seenT++;
    var r = el.getBoundingClientRect(), cs = win.getComputedStyle(el);
    if (el.tagName === 'A' && cs.display === 'inline' && el.closest('p,li,dd,td,figcaption,blockquote')) return; // 문장 안 링크는 예외
    // 이름표 안의 고르기 칸은 이름표 전체가 누를 곳 → 이름표 크기로 잼
    if (el.tagName === 'INPUT' && /^(checkbox|radio)$/.test(el.type) && el.closest('label')) { var lb = el.closest('label').getBoundingClientRect(); if (lb.width >= 24 && lb.height >= 24) return; r = lb; }
    if (r.width < 24 || r.height < 24) add('small-target', 'warn', el, '누를 곳이 ' + Math.round(r.width) + '×' + Math.round(r.height) + 'px로 작아요("' + (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 20) + '").', '버튼·링크를 24×24px(휴대폰은 44px) 이상으로 해 주세요.');
  });
  // 빈 섹션
  Array.prototype.forEach.call(doc.querySelectorAll('section'), function (s) {
    var cs = win.getComputedStyle(s); if (cs.display === 'none' || s.closest('[hidden],[aria-hidden="true"]')) return; // 높이가 0이어도 빈 섹션
    if (!s.innerText.trim() && !s.querySelector('img,video,iframe,canvas,svg,picture')) add('empty-section', 'warn', s, '화면에 아무것도 보이지 않는 섹션이에요.', '내용을 채우거나 섹션을 빼 주세요.');
  });
  return out;
}

/** 문자열로 넘길 때(숨은 틀·page.evaluate 글): (function inspectRendered(opts){…}) */
export const inspectRenderedSource = `(${inspectRendered.toString()})`;

/**
 * 숨은 틀에 넣을 스크립트: 다 그려지면 검수해 부모 창에 { type:'lp-inspect', id, width, issues }로 보냄.
 * 앱은 previewHtml(files, page, { extraBody: inspectRenderedScript({ id }) })로 넣고 message를 기다림
 */
export function inspectRenderedScript({ id = '', file = 'index.html', delay = 600 } = {}) {
  return `<script>(function(){var f=${inspectRenderedSource};function go(){var r;try{r=f({file:${JSON.stringify(file)}})}catch(e){r=[{id:'inspect-failed',level:'warn',where:{file:${JSON.stringify(file)},selector:'',section:'',width:innerWidth},message_ko:'화면 검수를 마치지 못했어요: '+e.message,fix_hint_ko:''}]}parent.postMessage({type:'lp-inspect',id:${JSON.stringify(id)},width:innerWidth,issues:r},'*')}if(document.readyState==='complete')setTimeout(go,${+delay});else addEventListener('load',function(){setTimeout(go,${+delay})})})();<\/script>`;
}

/**
 * Playwright 도우미: 찍고 재기 전에 화면을 '다 본 뒤' 모습으로. 늦게 받는 그림(loading="lazy")을 바로 받게 하고, 끝까지 한 번 스크롤해
 * 화면에 들어와야 도는 움직임·늦게 만드는 부품을 깨우고, 그림이 다 오길 기다린 뒤 끝이 있는 움직임(CSS·Web Animations)은 끝 상태로 보내고 맨 위로.
 * 전체 그림(fullPage)이 빈 그림·시작 전 모습으로 찍히던 것(교재 썸네일·차트 선 긋기 등)을 막음
 */
export async function settlePage(page, { pause = 60, imgWait = 4000, settle = 350, maxScroll = 60000 } = {}) {
  await page.evaluate(async ({ pause, imgWait, maxScroll }) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const go = (y) => scrollTo({ top: y, left: 0, behavior: 'instant' }); // 사이트의 scroll-behavior:smooth와 상관없이 바로
    document.querySelectorAll('img[loading="lazy"]').forEach((n) => { n.loading = 'eager'; });
    const H = () => Math.min(document.documentElement.scrollHeight, maxScroll);
    for (let y = 0; y < H(); y += Math.max(240, Math.round(innerHeight * 0.8))) { go(y); await sleep(pause); }
    go(H()); await sleep(pause * 2);
    const wait = [...document.images].filter((i) => i.getAttribute('src') && !i.complete).map((i) => new Promise((r) => { i.addEventListener('load', r, { once: true }); i.addEventListener('error', r, { once: true }); }));
    await Promise.race([Promise.all(wait), sleep(imgWait)]);
    go(0);
  }, { pause, imgWait, maxScroll });
  await page.waitForTimeout(settle);
  await page.evaluate(() => {
    for (const a of document.getAnimations ? document.getAnimations() : []) {
      try {
        if (a.timeline && typeof DocumentTimeline !== 'undefined' && !(a.timeline instanceof DocumentTimeline)) continue; // 스크롤에 묶인 움직임은 그대로
        const t = a.effect && a.effect.getComputedTiming();
        if (t && Number.isFinite(t.endTime) && a.playState !== 'finished') a.finish();
      } catch { /* 끝낼 수 없는 움직임 */ }
    }
  });
  await page.waitForTimeout(80);
}

/**
 * Playwright 도우미: 두 폭(390·1280)에서 검수하고 화면 그림을 찍음.
 * @param page Playwright page(이미 사이트를 연 상태가 아니어도 됨) @param url 열 주소
 * @param opts { widths:[390,1280], shots: (width)=>파일 경로 | null, file, fullPage:true, wait: 800, settle:true(settlePage 뒤에 재고 찍음) }
 * @returns issues[](폭마다 where.width)
 */
export async function inspectPage(page, url, { widths = [390, 1280], shots = null, file = 'index.html', fullPage = true, wait = 800, settle = true } = {}) {
  const all = [];
  for (const w of widths) {
    await page.setViewportSize({ width: w, height: w <= 480 ? 844 : 800 });
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForTimeout(wait);
    if (settle) await settlePage(page);
    const issues = await page.evaluate(`${inspectRenderedSource}({ file: ${JSON.stringify(file)} })`);
    all.push(...issues);
    if (shots) { const p = shots(w); if (p) await page.screenshot({ path: p, fullPage, animations: 'disabled' }); }
  }
  return all;
}
