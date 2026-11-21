import{m as g}from"./lecpage-DRD2yl-y.js";const m=`/* 질문이 먼저, AI는 그다음 — 사이트 움직임
   첫 화면 신경망(WebGL, 없으면 정지 그림) · 제목 글자 장면 · 노드 그래프 · 교재 쪽 고리 · 지금 상태 · 작은 손맛(자석 단추·빛 상자·커서)
   움직임 줄이기를 고르면 한 장면만 그리고, 쉬는 모습이 곧 완성된 모습이에요. */
(function () {
  'use strict';
  var d = document, de = d.documentElement;
  de.classList.add('js');
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches;
  var $ = function (s, r) { return (r || d).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  function rng(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
  var store = {
    get: function (k) { try { return JSON.parse(localStorage.getItem('neo-teach:' + k)); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem('neo-teach:' + k, JSON.stringify(v)); } catch (e) { /* 저장 안 됨 */ } }
  };

  /* ── 낱말 나누기: 글자 노드를 낱말(줄바꿈 안 되는 덩어리)로, 필요하면 글자로 ── */
  function splitWords(el, chars) {
    var i = 0, walker = d.createTreeWalker(el, 4, null), list = [], n;
    while ((n = walker.nextNode())) list.push(n);
    list.forEach(function (t) {
      var parts = t.nodeValue.split(/(\\s+)/), frag = d.createDocumentFragment();
      parts.forEach(function (p) {
        if (!p) return;
        if (/^\\s+$/.test(p)) { frag.appendChild(d.createTextNode(p)); return; }
        var w = d.createElement('span'); w.className = 'w'; w.style.setProperty('--i', i);
        if (chars) {
          Array.from(p).forEach(function (ch) { var c = d.createElement('span'); c.className = 'c'; c.textContent = ch; c.style.setProperty('--i', i++); w.appendChild(c); });
        } else { w.textContent = p; i++; }
        frag.appendChild(w);
      });
      t.parentNode.replaceChild(frag, t);
    });
    return i;
  }

  /* ── 첫 화면 제목: 글자가 접혀 올라오고, 'AI'는 신호처럼 풀려서 자리 잡음, 커서 둘레는 굵기가 숨 쉼 ── */
  function kinetic() {
    var h = $('[data-kin]'); if (!h) return;
    h.setAttribute('aria-label', h.textContent.replace(/\\s+/g, ' ').trim());
    $$('.kin-l1,.kin-l2', h).forEach(function (l) { l.setAttribute('aria-hidden', 'true'); });
    splitWords(h, true);
    h.classList.add('is-split');
    var cs = $$('.c', h);
    if (reduce) return;
    // AI 두 글자: 잠깐 다른 기호로 흔들리다 제자리
    var glyphs = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&*+=/<>';
    var ai = cs.filter(function (c) { return /^[AI]$/.test(c.textContent); });
    ai.forEach(function (c, k) {
      var real = c.textContent, t0 = performance.now() + 520 + k * 60, dur = 900;
      (function tick(now) {
        if (now < t0) { requestAnimationFrame(tick); return; }
        var p = (now - t0) / dur;
        if (p >= 1) { c.textContent = real; c.style.color = ''; return; }
        c.textContent = glyphs[(Math.random() * glyphs.length) | 0];
        c.style.color = '#a8ecff';
        setTimeout(function () { requestAnimationFrame(tick); }, 55);
      })(performance.now());
    });
    if (!fine) return;
    // 굵기 숨쉬기(가변 글꼴): 커서에 가까운 글자는 가늘게
    var hero = h.closest('section') || $('[data-hero]'), mx = -1e4, my = -1e4, rects = [], cur = cs.map(function () { return 820; }), on = false, raf = 0;
    if (!hero) return;
    function measure() { rects = cs.map(function (c) { var r = c.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2 + scrollY]; }); }
    function frame() {
      raf = 0; var moving = false;
      for (var i = 0; i < cs.length; i++) {
        var r = rects[i]; if (!r) continue;
        var dx = mx - r[0], dy = my - (r[1] - scrollY), dd = Math.sqrt(dx * dx + dy * dy);
        var target = on ? 820 - 520 * Math.pow(clamp(1 - dd / 260, 0, 1), 1.6) : 820;
        cur[i] = lerp(cur[i], target, .16);
        if (Math.abs(cur[i] - target) > .5) moving = true;
        cs[i].style.fontWeight = Math.round(cur[i]);
      }
      if (moving) raf = requestAnimationFrame(frame);
    }
    setTimeout(measure, 1600);
    addEventListener('resize', function () { setTimeout(measure, 100); });
    hero.addEventListener('pointerenter', function () { on = true; measure(); });
    hero.addEventListener('pointerleave', function () { on = false; if (!raf) raf = requestAnimationFrame(frame); });
    hero.addEventListener('pointermove', function (e) { mx = e.clientX; my = e.clientY; on = true; if (!raf) raf = requestAnimationFrame(frame); });
  }

  /* ── 첫 화면 신경망(WebGL): 다섯 층(질문→목표→증거→경험→성찰), 교사 노드는 주황, AI 연결은 하늘색 신호 ── */
  function neural() {
    var cv = $('[data-neural]'), hero = $('[data-hero]'); if (!cv || !hero) return;
    var gl = null;
    try { gl = cv.getContext('webgl', { antialias: true, alpha: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: 'high-performance' }); } catch (e) { gl = null; }
    if (!gl) { hero.classList.add('no-gl'); return; }
    de.classList.add('gl-on');
    var labels = $$('[data-labels] span');

    // 데이터(늘 같은 그림)
    var R = rng(20261209), L = 5, COUNTS = [8, 12, 15, 12, 8], layers = [], i, j, l;
    for (l = 0; l < L; l++) {
      var x = (l - 2) * 1.25, arr = [{ p: [x, 0, 0], l: l, main: 1 }];
      for (i = 0; i < COUNTS[l]; i++) {
        var a = R() * Math.PI * 2, r = .42 + Math.sqrt(R()) * (l === 2 ? 1.25 : 1.05);
        arr.push({ p: [x + (R() - .5) * .4, Math.sin(a) * r, Math.cos(a) * r * .9], l: l, main: 0 });
      }
      layers.push(arr);
    }
    var edges = [];
    for (l = 0; l < L - 1; l++) {
      var A = layers[l], B = layers[l + 1];
      edges.push({ a: A[0], b: B[0], type: 2, s: R() });
      for (i = 0; i < A.length; i++) {
        var k = A[i].main ? 4 : 2 + (R() < .4 ? 1 : 0);
        for (j = 0; j < k; j++) edges.push({ a: A[i], b: B[1 + Math.floor(R() * (B.length - 1))], type: R() < .2 ? 1 : 0, s: R() });
      }
    }
    function bez(e) { var a = e.a.p, b = e.b.p, dx = (b[0] - a[0]) * .55; return [a, [a[0] + dx, a[1], a[2]], [b[0] - dx, b[1], b[2]], b]; }
    function at(c, t) { var u = 1 - t, w0 = u * u * u, w1 = 3 * u * u * t, w2 = 3 * u * t * t, w3 = t * t * t; return [0, 1, 2].map(function (q) { return w0 * c[0][q] + w1 * c[1][q] + w2 * c[2][q] + w3 * c[3][q]; }); }
    var SEG = 14, lineData = [], pulseData = [], pointData = [];
    edges.forEach(function (e) {
      var c = bez(e), spd = .16 + e.s * .12;
      for (var s = 0; s < SEG; s++) {
        var t0 = s / SEG, t1 = (s + 1) / SEG, p0 = at(c, t0), p1 = at(c, t1);
        lineData.push(p0[0], p0[1], p0[2], t0, e.type, e.a.l, e.s, p1[0], p1[1], p1[2], t1, e.type, e.a.l, e.s);
      }
      if (e.type > 0) pulseData.push(c[0][0], c[0][1], c[0][2], c[1][0], c[1][1], c[1][2], c[2][0], c[2][1], c[2][2], c[3][0], c[3][1], c[3][2], e.a.l, e.s, e.type, spd);
    });
    layers.forEach(function (arr) { arr.forEach(function (n) { pointData.push(n.p[0], n.p[1], n.p[2], n.main ? .34 : .075 + R() * .05, n.main ? 1 : 0, n.l, R()); }); });
    for (i = 0; i < 240; i++) pointData.push((R() - .5) * 12, (R() - .5) * 7, (R() - .7) * 8, .025 + R() * .03, 3, -1, R());

    var COMMON = 'precision mediump float;uniform float uYaw,uPitch,uDist,uFocal,uAspect,uTime,uIntro,uDpr,uH,uGain;uniform vec2 uOff,uMouse;' +
      'vec3 rot(vec3 p){float cy=cos(uYaw),sy=sin(uYaw),cp=cos(uPitch),sp=sin(uPitch);p=vec3(cy*p.x+sy*p.z,p.y,-sy*p.x+cy*p.z);return vec3(p.x,cp*p.y-sp*p.z,sp*p.y+cp*p.z);}' +
      'vec4 proj(vec3 p,out float z){p=rot(p);z=uDist-p.z;vec2 q=p.xy*uFocal/z;q.x/=uAspect;return vec4(q+uOff,0.,1.);}';
    var VS_LINE = COMMON + 'attribute vec3 aPos;attribute vec4 aInfo;varying float vT,vType,vA,vSeed;varying vec2 vN;' +
      'void main(){float z;vec4 P=proj(aPos,z);gl_Position=P;vT=aInfo.x;vType=aInfo.y;vSeed=aInfo.w;vN=P.xy;' +
      'float rev=clamp(uIntro*6.-aInfo.z-aInfo.x*1.2,0.,1.);float fog=clamp(1.35-(z-uDist*.75)/(uDist*.8),.18,1.);vA=rev*fog*uGain;}';
    var FS_LINE = 'precision mediump float;uniform float uTime,uAspect;uniform vec2 uMouse;varying float vT,vType,vA,vSeed;varying vec2 vN;' +
      'void main(){vec3 c=vec3(.55,.63,.8);float a=.085;' +
      'if(vType>1.5){c=vec3(1.,.42,.24);a=.34;}else if(vType>.5){c=vec3(.32,.85,1.);a=.2;}' +
      'float k=fract(uTime*(.16+vSeed*.12)+vSeed);float pl=smoothstep(.11,0.,abs(vT-k));if(vType>.5)a+=pl*.9;' +
      'vec2 dm=vN-uMouse;dm.x*=uAspect;float m=smoothstep(.5,0.,length(dm));a+=m*.3;' +
      'gl_FragColor=vec4(c*a*vA,1.);}';
    var VS_PT = COMMON + 'attribute vec3 aPos;attribute vec4 aInfo;varying vec3 vC;varying float vA,vType;' +
      'void main(){vec3 p=aPos;float ty=aInfo.y;if(ty>2.5){p.y+=sin(uTime*.22+aInfo.w*40.)*.14;p.x+=cos(uTime*.17+aInfo.w*30.)*.14;}' +
      'float z;vec4 P=proj(p,z);gl_Position=P;float ap=ty>2.5?clamp(uIntro*2.,0.,1.):clamp(uIntro*6.-aInfo.z-.15,0.,1.);' +
      'vec2 dm=P.xy-uMouse;dm.x*=uAspect;float m=smoothstep(.36,0.,length(dm));' +
      'gl_PointSize=max(1.,aInfo.x*(1.+m*1.4)*ap*uFocal*uH*.5*uDpr/z);vType=ty;vA=ap*uGain*(ty>2.5?.5:1.)*(1.+m*.9);' +
      'vC=ty>.5&&ty<1.5?vec3(1.,.42,.24):(ty>2.5?vec3(.55,.7,1.):mix(vec3(.78,.84,.96),vec3(.32,.85,1.),m));}';
    var FS_PT = 'precision mediump float;varying vec3 vC;varying float vA,vType;' +
      'void main(){vec2 q=gl_PointCoord-.5;float r=length(q)*2.;if(r>1.)discard;float a;' +
      'if(vType>.5&&vType<1.5){a=smoothstep(.3,.2,r)+exp(-r*r*4.)*.8;}' +
      'else if(vType>2.5){a=exp(-r*r*6.);}' +
      'else{a=smoothstep(.62,.5,r)*smoothstep(.3,.42,r)+exp(-r*r*7.)*.35;}' +
      'gl_FragColor=vec4(vC*a*vA,1.);}';
    var VS_PU = COMMON + 'attribute vec3 aP0,aP1,aP2,aP3;attribute vec4 aInfo;varying vec3 vC;varying float vA,vType;' +
      'void main(){float t=fract(uTime*aInfo.w+aInfo.y),u=1.-t;vec3 p=u*u*u*aP0+3.*u*u*t*aP1+3.*u*t*t*aP2+t*t*t*aP3;' +
      'float z;vec4 P=proj(p,z);gl_Position=P;float ap=clamp(uIntro*6.-aInfo.x-1.,0.,1.);' +
      'gl_PointSize=max(1.,(aInfo.z>1.5?.2:.15)*sin(t*3.14159)*ap*uFocal*uH*.5*uDpr/z);vType=0.;vA=ap*uGain;' +
      'vC=aInfo.z>1.5?vec3(1.,.55,.35):vec3(.55,.92,1.);}';
    var FS_PU = 'precision mediump float;varying vec3 vC;varying float vA,vType;' +
      'void main(){vec2 q=gl_PointCoord-.5;float r=length(q)*2.;if(r>1.)discard;float a=smoothstep(.35,.1,r)*1.4+exp(-r*r*5.)*.7;gl_FragColor=vec4(vC*a*vA,1.);}';
    var VS_BG = 'attribute vec2 aPos;void main(){gl_Position=vec4(aPos,0.,1.);}';
    var FS_BG = 'precision mediump float;uniform vec2 uRes,uA,uB;uniform float uTime,uGain;' +
      'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}' +
      'float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}' +
      'void main(){vec2 uv=gl_FragCoord.xy/uRes;float ar=uRes.x/uRes.y;vec2 p=uv*2.-1.;p.x*=ar;' +
      'float nz=n(p*1.5+vec2(uTime*.03,-uTime*.02))*.6+n(p*3.3-vec2(uTime*.05,0.))*.4;' +
      'vec2 a=uA;a.x*=ar;vec2 b=uB;b.x*=ar;vec3 bg=vec3(.0196,.0235,.039);vec3 c=bg;' +
      'c+=vec3(1.,.42,.24)*.17*exp(-dot(p-a,p-a)*1.5)*(.55+.7*nz)*uGain;' +
      'c+=vec3(.32,.85,1.)*.13*exp(-dot(p-b,p-b)*.8)*(.55+.7*nz)*uGain;' +
      'c+=vec3(.25,.4,.7)*.03*nz;c*=1.-.45*dot(uv-.5,uv-.5);' +
      'c=mix(bg,c,smoothstep(0.,.28,uv.y));gl_FragColor=vec4(c,1.);}';

    function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
    function prog(vs, fs) { var p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); p.u = {}; return p; }
    function buf(arr) { var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW); return b; }
    var P;
    try {
      P = { line: prog(VS_LINE, FS_LINE), pt: prog(VS_PT, FS_PT), pu: prog(VS_PU, FS_PU), bg: prog(VS_BG, FS_BG) };
    } catch (e) { hero.classList.add('no-gl'); de.classList.remove('gl-on'); return; }
    var B = { line: buf(lineData), pt: buf(pointData), pu: buf(pulseData), bg: buf([-1, -1, 3, -1, -1, 3]) };
    var N = { line: lineData.length / 7, pt: pointData.length / 7, pu: pulseData.length / 16 };
    function u(p, name) { if (!(name in p.u)) p.u[name] = gl.getUniformLocation(p, name); return p.u[name]; }
    function attrs(p, b, spec, stride) {
      gl.bindBuffer(gl.ARRAY_BUFFER, b); var off = 0;
      spec.forEach(function (s) { var loc = gl.getAttribLocation(p, s[0]); if (loc >= 0) { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, s[1], gl.FLOAT, false, stride * 4, off * 4); } off += s[1]; });
      return function () { spec.forEach(function (s) { var loc = gl.getAttribLocation(p, s[0]); if (loc >= 0) gl.disableVertexAttribArray(loc); }); };
    }

    // 카메라 상태
    var W = 1, H = 1, dpr = 1, aspect = 1, cam = { yaw: .42, pitch: .14, dist: 7, focal: 1, offX: .36, offY: 0, gain: 1 };
    var mouse = { x: 0, y: 0, tx: 0, ty: 0, ndcX: 9, ndcY: 9 }, scrollK = 0, t0 = performance.now(), visible = true, raf = 0, lost = false;
    function layout() {
      var r = cv.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height);
      dpr = Math.min(window.devicePixelRatio || 1, W < 700 ? 1.5 : 1.75);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      aspect = W / H;
      cam.yaw = aspect < .75 ? .16 : .42;
      if (aspect >= 1) { cam.offX = .4; cam.offY = -.02; cam.focal = .5 * aspect * cam.dist / 2.5; }
      else if (aspect >= .75) { cam.offX = .25; cam.offY = -.25; cam.focal = .62 * aspect * cam.dist / 2.5; }
      else { cam.offX = .02; cam.offY = -.2; cam.focal = .74 * aspect * cam.dist / 2.5; }
      if (reduce) draw(performance.now());
    }
    function project(p, yaw, pitch, dist, focal) {
      var cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      var x = cy * p[0] + sy * p[2], y = p[1], z = -sy * p[0] + cy * p[2];
      var y2 = cp * y - sp * z, z2 = sp * y + cp * z, zz = dist - z2;
      return [x * focal / zz / aspect, y2 * focal / zz, zz];
    }
    function draw(now) {
      if (lost) return;
      var time = reduce ? 7.5 : (now - t0) / 1000;
      var intro = reduce ? 1 : clamp((now - t0 - 250) / 2600, 0, 1); intro = 1 - Math.pow(1 - intro, 3);
      mouse.x = lerp(mouse.x, mouse.tx, .06); mouse.y = lerp(mouse.y, mouse.ty, .06);
      var yaw = cam.yaw + mouse.x * .32 + (reduce ? 0 : Math.sin(time * .11) * .1) + scrollK * .7;
      var pitch = cam.pitch - mouse.y * .18 + scrollK * .2;
      var dist = cam.dist - scrollK * 2.2;
      var offX = cam.offX, offY = cam.offY + scrollK * .25, gain = 1 - scrollK * .55;
      gl.viewport(0, 0, cv.width, cv.height);
      gl.disable(gl.BLEND);
      // 바탕
      gl.useProgram(P.bg);
      var off = attrs(P.bg, B.bg, [['aPos', 2]], 2);
      var m0 = project(layers[0][0].p, yaw, pitch, dist, cam.focal), m4 = project(layers[4][0].p, yaw, pitch, dist, cam.focal);
      gl.uniform2f(u(P.bg, 'uRes'), cv.width, cv.height); gl.uniform1f(u(P.bg, 'uTime'), time); gl.uniform1f(u(P.bg, 'uGain'), gain);
      gl.uniform2f(u(P.bg, 'uA'), m0[0] + offX, m0[1] + offY); gl.uniform2f(u(P.bg, 'uB'), (m4[0] + offX + offX) / 2 + .15, m4[1] + offY);
      gl.drawArrays(gl.TRIANGLES, 0, 3); off();
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      function common(p) {
        gl.uniform1f(u(p, 'uYaw'), yaw); gl.uniform1f(u(p, 'uPitch'), pitch); gl.uniform1f(u(p, 'uDist'), dist); gl.uniform1f(u(p, 'uFocal'), cam.focal);
        gl.uniform1f(u(p, 'uAspect'), aspect); gl.uniform1f(u(p, 'uTime'), time); gl.uniform1f(u(p, 'uIntro'), intro); gl.uniform1f(u(p, 'uDpr'), dpr);
        gl.uniform1f(u(p, 'uH'), H); gl.uniform1f(u(p, 'uGain'), gain); gl.uniform2f(u(p, 'uOff'), offX, offY); gl.uniform2f(u(p, 'uMouse'), mouse.ndcX, mouse.ndcY);
      }
      gl.useProgram(P.line); common(P.line); off = attrs(P.line, B.line, [['aPos', 3], ['aInfo', 4]], 7); gl.drawArrays(gl.LINES, 0, N.line); off();
      gl.useProgram(P.pt); common(P.pt); off = attrs(P.pt, B.pt, [['aPos', 3], ['aInfo', 4]], 7); gl.drawArrays(gl.POINTS, 0, N.pt); off();
      if (!reduce) { gl.useProgram(P.pu); common(P.pu); off = attrs(P.pu, B.pu, [['aP0', 3], ['aP1', 3], ['aP2', 3], ['aP3', 3], ['aInfo', 4]], 16); gl.drawArrays(gl.POINTS, 0, N.pu); off(); }
      // 이름표: 다섯 노드 자리에
      for (var k = 0; k < labels.length; k++) {
        var q = project(layers[k][0].p, yaw, pitch, dist, cam.focal);
        var sx = ((q[0] + offX) * .5 + .5) * W, sy = (1 - ((q[1] + offY) * .5 + .5)) * H;
        var ap = clamp(intro * 6 - k - .4, 0, 1) * (1 - scrollK * 1.4);
        var lw = labels[k].offsetWidth, lx = clamp(sx - lw / 2, 6, W - lw - 6);
        labels[k].style.transform = 'translate3d(' + lx.toFixed(1) + 'px,' + (sy + 16).toFixed(1) + 'px,0)';
        labels[k].style.opacity = clamp(ap, 0, 1).toFixed(3);
      }
    }
    var last = 0, slow = 0;
    function loop(now) {
      raf = 0;
      if (!visible || d.hidden || lost) return;
      if (last && now - last > 30) { slow++; if (slow > 50 && dpr > 1) { slow = 0; dpr = 1; cv.width = Math.round(W); cv.height = Math.round(H); } } else slow = Math.max(0, slow - 1);
      last = now;
      draw(now);
      raf = requestAnimationFrame(loop);
    }
    function start() { if (!raf && !reduce) raf = requestAnimationFrame(loop); }
    cv.addEventListener('webglcontextlost', function (e) { e.preventDefault(); lost = true; hero.classList.add('no-gl'); de.classList.remove('gl-on'); });
    layout();
    if (window.ResizeObserver) new ResizeObserver(function () { layout(); }).observe(cv); else addEventListener('resize', layout);
    if (reduce) { draw(performance.now()); return; }
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) start(); }, { rootMargin: '80px' }).observe(hero);
    d.addEventListener('visibilitychange', function () { if (!d.hidden) start(); });
    hero.addEventListener('pointermove', function (e) {
      var r = cv.getBoundingClientRect();
      mouse.tx = ((e.clientX - r.left) / r.width - .5) * 2; mouse.ty = ((e.clientY - r.top) / r.height - .5) * 2;
      mouse.ndcX = mouse.tx; mouse.ndcY = -mouse.ty;
    });
    hero.addEventListener('pointerleave', function () { mouse.tx = 0; mouse.ty = 0; mouse.ndcX = 9; mouse.ndcY = 9; });
    neural.setScroll = function (k) { scrollK = k; };
    start();
  }

  /* ── 스크롤: 머리 막대 진행선·첫 화면 카메라 ── */
  function scrollFx() {
    var nav = $('[data-nav]'), hero = $('[data-hero]'), tick = false;
    function update() {
      tick = false;
      var y = scrollY, docH = de.scrollHeight - innerHeight;
      if (nav) nav.style.setProperty('--sp', docH > 0 ? clamp(y / docH, 0, 1).toFixed(4) : 0);
      if (hero && neural.setScroll) neural.setScroll(clamp(y / (hero.offsetHeight || 1), 0, 1));
    }
    function onScroll() { if (!tick) { tick = true; requestAnimationFrame(update); } }
    addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onScroll); update();
  }

  /* ── 머리 막대: 지금 보는 곳 ── */
  function navSpy() {
    var menu = $('[data-menu]'); if (!menu || !('IntersectionObserver' in window)) return;
    var pill = $('.menu-pill', menu), links = $$('a', menu);
    var map = { now: 'now', start: 'now', deck: 'deck', lab: 'deck', join: 'join', after: 'after' };
    function set(id) {
      links.forEach(function (a) {
        var on = a.getAttribute('href') === '#' + id;
        if (on) { a.setAttribute('aria-current', 'location'); menu.style.setProperty('--px', a.offsetLeft + 'px'); menu.style.setProperty('--pw', a.offsetWidth + 'px'); menu.style.setProperty('--po', 1); }
        else a.removeAttribute('aria-current');
      });
      if (!id) menu.style.setProperty('--po', 0);
    }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) set(map[e.target.id] || ''); });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(map).forEach(function (id) { var s = d.getElementById(id); if (s) io.observe(s); });
    var top = $('[data-hero]'); if (top) io.observe(top);
  }

  /* ── 섹션 제목: 낱말이 흐릿함에서 또렷하게(한 번) ── */
  function headings() {
    if (reduce || !('IntersectionObserver' in window)) return;
    var hs = $$('.sec .h2'); hs.forEach(function (h) { splitWords(h, false); h.classList.add('rv'); });
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { rootMargin: '0px 0px -8% 0px' });
    hs.forEach(function (h) { io.observe(h); });
  }

  /* ── 지금 상태: 연수 전(남은 날)·중(지금 순서와 그 할 일로 가는 단추)·후(과제 마감) ── */
  function now() {
    var chip = $('[data-now-chip]'), txt = $('[data-now-text]'), go = $('[data-now-go]'), bar = $('[data-tbar]'), needle = $('[data-tbar-now]');
    var rows = $$('.sched li'), dots = $$('[data-k-at]'), cards = $$('[data-lab-at]');
    var DAY = '2026-12-09';
    function kst(t) { return new Date(DAY + 'T' + t + ':00+09:00').getTime(); }
    function run() {
      var n = Date.now(), s0 = kst('14:00'), e = kst('17:00');
      var on = function (a, b) { return n >= kst(a) && n < kst(b); };
      rows.forEach(function (r) { r.classList.toggle('is-now', on(r.dataset.at, r.dataset.to)); });
      dots.forEach(function (k) { k.classList.toggle('is-now', on(k.dataset.kAt, k.dataset.kTo)); });
      cards.forEach(function (c) { c.classList.toggle('is-now', on(c.dataset.labAt, c.dataset.labTo)); });
      if (bar) { var live = n >= s0 && n < e; bar.classList.toggle('is-live', live); if (live && needle) needle.style.setProperty('--now', ((n - s0) / (e - s0) * 100).toFixed(2) + '%'); }
      if (!txt) return;
      chip.classList.remove('is-live');
      if (n < s0) {
        var today = new Date(n + 9 * 3600e3).toISOString().slice(0, 10), days = Math.round((Date.parse(DAY) - Date.parse(today)) / 864e5);
        txt.textContent = days > 0 ? 'D-' + days + ' · 12월 9일(수) 14:00 시작' : '오늘 14:00 시작';
      } else if (n < e) {
        var cur = rows.filter(function (r) { return r.classList.contains('is-now'); })[0];
        chip.classList.add('is-live');
        txt.textContent = cur ? '지금 · ' + $('.t', cur).textContent : '연수 중이에요';
        if (go && cur && cur.dataset.go) { go.removeAttribute('download'); go.setAttribute('href', cur.dataset.go); go.textContent = '지금 할 일'; }
      } else {
        txt.textContent = '연수가 끝났어요 · 과제는 12월 23일(수)까지';
        if (go) { go.removeAttribute('download'); go.setAttribute('href', '#after'); go.textContent = '과제 보기'; }
      }
    }
    run(); setInterval(run, 30000);
  }

  /* ── 휴대폰: 긴 프롬프트는 앞 몇 줄만 보이고 [전체 보기](복사는 늘 전체) ── */
  function folds() {
    $$('.prompt,.card-ex').forEach(function (f, n) {
      var code = $('.code', f) || $('ol', f); if (!code) return;
      code.id = code.id || 'fold-' + (n + 1);
      var b = d.createElement('button'); b.type = 'button'; b.className = 'code-more';
      b.setAttribute('aria-controls', code.id); b.setAttribute('aria-expanded', 'false'); b.textContent = '전체 보기';
      f.classList.add('is-folded'); f.appendChild(b);
      b.addEventListener('click', function () { var open = f.classList.toggle('is-folded') === false; b.setAttribute('aria-expanded', String(open)); b.textContent = open ? '접기' : '전체 보기'; });
    });
  }

  /* ── 준비물 체크(이 기기에만) ── */
  function checks() {
    $$('[data-checks]').forEach(function (box) {
      var key = 'checks-' + box.dataset.checks, saved = store.get(key) || {};
      $$('input[data-k]', box).forEach(function (inp) {
        inp.checked = !!saved[inp.dataset.k];
        inp.addEventListener('change', function () { saved[inp.dataset.k] = inp.checked; store.set(key, saved); });
      });
    });
  }

  /* ── 복사 단추 눈짓(복사·모음 담기는 키트가) ── */
  function copyFx() {
    d.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('.copy'); if (!b) return;
      b.classList.add('is-copied'); b.textContent = '복사됨';
      clearTimeout(b._t); b._t = setTimeout(function () { b.classList.remove('is-copied'); b.textContent = '복사'; }, 1600);
    });
  }

  /* ── 손맛: 자석 단추·빛 상자·커서 고리(가는 포인터, 움직임 허용일 때만) ── */
  function touchFx() {
    if (!fine || reduce) return;
    $$('.mag').forEach(function (el) {
      var inner = $('.btn-t', el);
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect(), x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2);
        el.style.transition = 'transform .15s linear'; el.style.transform = 'translate3d(' + (x * .26).toFixed(1) + 'px,' + (y * .34).toFixed(1) + 'px,0)';
        if (inner) inner.style.transform = 'translate3d(' + (x * .1).toFixed(1) + 'px,' + (y * .12).toFixed(1) + 'px,0)';
      });
      el.addEventListener('pointerleave', function () {
        el.style.transition = 'transform .7s cubic-bezier(.16,1,.3,1)'; el.style.transform = '';
        if (inner) { inner.style.transition = 'transform .7s cubic-bezier(.16,1,.3,1)'; inner.style.transform = ''; }
      });
    });
    var pend = null;
    d.addEventListener('pointermove', function (e) {
      pend = e;
      if (pend._q) return; pend._q = 1;
      requestAnimationFrame(function () {
        var s = pend.target.closest && pend.target.closest('.spot');
        if (s) { var r = s.getBoundingClientRect(); s.style.setProperty('--mx', (pend.clientX - r.left).toFixed(0) + 'px'); s.style.setProperty('--my', (pend.clientY - r.top).toFixed(0) + 'px'); }
      });
    }, { passive: true });
    // 커서 고리
    var cur = $('.cursor'); if (!cur) return;
    de.classList.add('has-cursor');
    var ring = $('.cursor-ring', cur), dot = $('.cursor-dot', cur), tx = -100, ty = -100, rx = -100, ry = -100, running = false;
    function step() {
      rx = lerp(rx, tx, .2); ry = lerp(ry, ty, .2);
      ring.style.transform = 'translate3d(' + rx.toFixed(1) + 'px,' + ry.toFixed(1) + 'px,0)';
      if (Math.abs(rx - tx) + Math.abs(ry - ty) > .2) requestAnimationFrame(step); else running = false;
    }
    d.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse' || !(e.movementX || e.movementY)) return;
      tx = e.clientX; ty = e.clientY; cur.style.opacity = 1;
      dot.style.transform = 'translate3d(' + tx + 'px,' + ty + 'px,0)';
      cur.classList.toggle('is-hot', !!(e.target.closest && e.target.closest('a,button,label,input,textarea,select,summary,[role="button"]')));
      if (!running) { running = true; requestAnimationFrame(step); }
    }, { passive: true });
    d.addEventListener('pointerleave', function () { cur.style.opacity = 0; });
  }

  function go() {
    kinetic();
    try { neural(); } catch (e) { var h = $('[data-hero]'); if (h) h.classList.add('no-gl'); de.classList.remove('gl-on'); }
    scrollFx();
    navSpy();
    headings();
    now();
    checks();
    folds();
    copyFx();
    touchFx();
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', go); else go();
})();
`,h=`/* 질문이 먼저, AI는 그다음 — 교재의 어두운 회로판(교사 노드 = 불씨 주황, AI 연결 = 이온 하늘색)을 웹으로.
   사이트는 연수 당일에 쓰는 도구: 지금 순서·출석·교재 넘기기·실습 원문·질문과 투표·과제와 자료 */
:root{
  --bg:#05060a; --bg-1:#090b11; --bg-2:#0e1119;
  --line:rgba(255,255,255,.08); --line-2:rgba(255,255,255,.15);
  --ink:#eef0f6; --ink-2:#bfc5d3; --ink-3:#8f96a9;
  --ember:#ff6a3d; --ember-2:#ffb08f; --ember-g:rgba(255,106,61,.42);
  --ion:#52d9ff; --ion-2:#a8ecff; --ion-g:rgba(82,217,255,.38);
  --f:'Pretendard Variable',Pretendard,system-ui,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;
  --f-num:'Space Grotesk','Pretendard Variable',Pretendard,system-ui,sans-serif;
  --f-mono:'JetBrains Mono','Pretendard Variable',Pretendard,ui-monospace,monospace;
  --wrap:1200px; --gut:clamp(16px,4.2vw,48px);
  --ease:cubic-bezier(.16,1,.3,1);
  --r:18px;
  /* 강의 기능 키트 */
  --lp-accent:#ff6a3d; --lp-ink:#eef0f6; --lp-paper:#0b0d14; --lp-font:var(--f); --lp-radius:14px; --lp-on-accent:#140805;
}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth;scroll-padding-top:88px;background:var(--bg)}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--f);font-size:17px;line-height:1.7;word-break:keep-all;overflow-wrap:break-word;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;overflow-x:clip}
img,svg,canvas{display:block;max-width:100%}
a{color:inherit}
h1,h2,h3,h4,p,ol,ul,dl,dd,figure{margin:0;padding:0}
ol,ul{list-style:none}
button{font:inherit;color:inherit}
:focus-visible{outline:2px solid var(--ion);outline-offset:3px;border-radius:6px}
::selection{background:var(--ember);color:#140805}
.num{font-family:var(--f-num);font-variant-numeric:tabular-nums;letter-spacing:0}
em{font-style:normal;color:var(--ember)}
.skip{position:absolute;left:16px;top:-80px;z-index:100;background:var(--ink);color:var(--bg);padding:12px 18px;border-radius:10px;font-weight:700;text-decoration:none}
.skip:focus{top:12px}

/* 바탕: 고정된 빛 두 점 + 점 격자 + 낟알 */
.aura{position:fixed;inset:0;z-index:-1;pointer-events:none;background:
  radial-gradient(60vmax 50vmax at 0% 0%,rgba(255,106,61,.07),transparent 60%),
  radial-gradient(60vmax 50vmax at 100% 100%,rgba(82,217,255,.06),transparent 60%),
  radial-gradient(rgba(255,255,255,.045) 1px,transparent 1.3px) 0 0/28px 28px;transform:translateZ(0)}
body::after{content:"";position:fixed;inset:0;z-index:90;pointer-events:none;opacity:.05;background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}

.wrap{width:100%;max-width:calc(var(--wrap) + var(--gut)*2);margin:0 auto;padding:0 var(--gut)}

/* ── 머리 막대(유리) ── */
.nav{position:fixed;top:12px;left:0;right:0;z-index:50;padding:0 var(--gut);pointer-events:none}
.nav-in{pointer-events:auto;max-width:var(--wrap);margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:12px;height:60px;padding:0 8px 0 16px;border-radius:20px;background:rgba(12,14,21,.62);border:1px solid rgba(255,255,255,.09);backdrop-filter:blur(18px) saturate(150%);-webkit-backdrop-filter:blur(18px) saturate(150%);box-shadow:0 10px 40px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.06);position:relative;overflow:hidden}
.nav-progress{position:absolute;left:calc(var(--gut) + 18px);right:calc(var(--gut) + 18px);top:58px;height:2px;max-width:calc(var(--wrap) - 36px);margin:0 auto;transform-origin:left;transform:scaleX(var(--sp,0));background:linear-gradient(90deg,var(--ember),var(--ion));border-radius:2px;opacity:.9}
.brand{display:flex;align-items:center;gap:10px;text-decoration:none;font-weight:750;font-size:16px;letter-spacing:-.02em;min-height:44px;flex:none}
.glyph{width:30px;height:20px;flex:none}
.menu{position:relative;display:flex;align-items:center;gap:2px}
.menu a{position:relative;z-index:1;display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 15px;border-radius:12px;font-size:15px;font-weight:600;color:var(--ink-2);text-decoration:none;white-space:nowrap;transition:color .3s}
.menu a:hover,.menu a[aria-current]{color:var(--ink)}
.menu a[aria-current="page"]{background:rgba(255,255,255,.08);box-shadow:inset 0 0 0 1px rgba(255,255,255,.08)}
.menu-pill{position:absolute;z-index:0;top:6px;bottom:6px;left:0;width:var(--pw,0);transform:translateX(var(--px,0));border-radius:12px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.08);opacity:var(--po,0);transition:transform .5s var(--ease),width .5s var(--ease),opacity .3s}

/* ── 첫 화면 ── */
.hero{position:relative;min-height:100vh;min-height:100svh;display:grid;grid-template-rows:1fr auto;padding:clamp(112px,15vh,160px) 0 calc(var(--lp-dock-h,58px) + 30px);overflow:hidden;isolation:isolate}
.neural{position:absolute;inset:0;width:100%;height:100%;z-index:-2;background:radial-gradient(70% 60% at 72% 45%,rgba(82,217,255,.10),transparent 70%),radial-gradient(40% 40% at 55% 52%,rgba(255,106,61,.10),transparent 70%),var(--bg)}
.hero::after{content:"";position:absolute;inset:auto 0 0;height:22%;z-index:-1;background:linear-gradient(transparent,var(--bg));pointer-events:none}
.hero-labels{position:absolute;inset:0;z-index:-1;pointer-events:none}
.hero-labels span{position:absolute;left:0;top:0;display:none;align-items:center;gap:7px;padding:5px 11px 5px 6px;border-radius:999px;font-size:13px;font-weight:650;color:var(--ink);background:rgba(10,12,18,.62);border:1px solid rgba(255,255,255,.12);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);white-space:nowrap;will-change:transform,opacity;opacity:0}
.hero-labels span b{display:grid;place-items:center;width:19px;height:19px;border-radius:50%;background:var(--ember);color:#140805;font:700 11px/1 var(--f-num)}
.gl-on .hero-labels span{display:inline-flex}
.hero-in{position:relative;width:100%;max-width:calc(var(--wrap) + var(--gut)*2);margin:0 auto;padding:0 var(--gut);align-self:center}
.hero-org{display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px;font-size:15px;font-weight:550;color:var(--ink-2);margin-bottom:clamp(18px,3vh,28px)}
.beacon{position:relative;width:8px;height:8px;border-radius:50%;background:var(--ember);flex:none;box-shadow:0 0 12px var(--ember)}
.kin{font-size:clamp(46px,8.6vw,124px);font-weight:820;line-height:1.02;letter-spacing:-.05em;max-width:12em;text-wrap:balance}
.kin-l1{color:var(--ember);text-shadow:0 0 60px rgba(255,106,61,.35)}
.kin-l2{color:var(--ink)}
.kin .w{display:inline-block;white-space:nowrap}
.kin .c{display:inline-block;transform-origin:50% 80%}
.hero-sub{margin-top:clamp(18px,2.6vh,28px);font-size:clamp(18px,1.9vw,24px);font-weight:500;color:var(--ink-2);letter-spacing:-.015em}
.hero-cta{display:flex;flex-wrap:wrap;gap:12px;margin-top:clamp(26px,4vh,40px)}
.btn{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:54px;padding:0 26px;border-radius:16px;font-size:17px;font-weight:700;letter-spacing:-.01em;text-decoration:none;white-space:nowrap;cursor:pointer;transition:background-color .3s,border-color .3s,box-shadow .4s var(--ease);will-change:transform}
.btn .ic{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;transition:transform .4s var(--ease)}
.btn:hover .ic{transform:translateX(3px)}
.btn-t{display:inline-block}
.btn-ember{background:var(--ember);color:#140805;box-shadow:0 0 0 1px rgba(255,176,143,.5) inset,0 12px 40px -8px var(--ember-g)}
.btn-ember:hover{background:#ff7d55;box-shadow:0 0 0 1px rgba(255,200,180,.7) inset,0 16px 56px -6px rgba(255,106,61,.6)}
.btn-glass{background:rgba(255,255,255,.06);color:var(--ink);border:1px solid rgba(255,255,255,.16);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}
.btn-glass:hover{background:rgba(255,255,255,.1);border-color:rgba(168,236,255,.4)}
.now-chip{display:inline-flex;flex-wrap:wrap;align-items:center;gap:6px 12px;margin-top:22px;padding:10px 12px 10px 16px;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid var(--line);font-size:15px;color:var(--ink-2)}
.now-chip a{display:inline-flex;align-items:center;min-height:32px;padding:0 10px;border-radius:9px;color:var(--ion-2);font-weight:600;text-decoration:none;background:rgba(82,217,255,.08)}
.now-chip a:hover{background:rgba(82,217,255,.16)}
.now-dot{width:8px;height:8px;border-radius:50%;background:var(--ion);flex:none}
.now-chip.is-live{color:var(--ink);border-color:rgba(255,106,61,.45)}
.now-chip.is-live .now-dot{background:var(--ember)}
.now-chip.is-live a{color:#140805;background:var(--ember)}
.hero-facts{position:relative;width:calc(100% - var(--gut)*2);max-width:var(--wrap);margin:clamp(28px,5vh,56px) auto 0;display:grid;grid-template-columns:1.1fr 1.3fr .9fr 1.2fr;border-radius:20px;background:rgba(12,14,21,.55);border:1px solid rgba(255,255,255,.09);backdrop-filter:blur(16px) saturate(140%);-webkit-backdrop-filter:blur(16px) saturate(140%);overflow:hidden}
.hero-facts > div{padding:18px 22px;border-left:1px solid var(--line)}
.hero-facts > div:first-child{border-left:0}
.hero-facts dt{font-size:13px;font-weight:600;color:var(--ink-3);margin-bottom:4px}
.hero-facts dd{font-size:16px;font-weight:650;line-height:1.45;letter-spacing:-.01em}
.hero-facts small{font-size:14px;font-weight:500;color:var(--ink-2);margin-left:4px}
.no-gl .neural{background:radial-gradient(60% 55% at 72% 50%,rgba(82,217,255,.14),transparent 70%),radial-gradient(40% 40% at 50% 60%,rgba(255,106,61,.14),transparent 70%),var(--bg)}

/* ── 섹션 공통 ── */
.sec{position:relative;padding:clamp(64px,7.5vw,104px) 0}
.sec + .sec{border-top:1px solid var(--line)}
.sec-h{max-width:860px;margin-bottom:clamp(26px,4vw,44px)}
.sec-k{font-size:15px;font-weight:600;color:var(--ember-2);margin-bottom:14px;line-height:1.6}
.sec-k a,.note a,.after p a{color:var(--ion-2);text-decoration:underline;text-decoration-color:rgba(168,236,255,.4);text-underline-offset:4px;display:inline-block;padding:4px 0}
.sec-k a:hover,.note a:hover{color:#fff}
.k-dot{position:relative;display:inline-block;vertical-align:-1px;width:10px;height:10px;border-radius:50%;border:2px solid var(--ember);margin-right:10px}
.k-dot.ion{border-color:var(--ion)}
.k-dot.is-now{background:var(--ember);box-shadow:0 0 14px var(--ember)}
.h2{font-size:clamp(32px,5vw,60px);font-weight:800;line-height:1.12;letter-spacing:-.045em;text-wrap:balance}
.h3{font-size:clamp(19px,1.8vw,22px);font-weight:750;letter-spacing:-.025em;line-height:1.35;display:flex;flex-wrap:wrap;align-items:center;gap:4px 12px;margin-bottom:14px}
.h3 small{font-size:14px;font-weight:500;color:var(--ink-3);letter-spacing:0}
.h4{font-size:15px;font-weight:700;color:var(--ink-2);margin-bottom:10px}
.lead{margin-top:14px;font-size:clamp(16px,1.4vw,18px);color:var(--ink-2);max-width:40em}
.pg{display:inline-flex;align-items:center;min-height:32px;font-size:14px;font-weight:600;color:var(--ion-2);text-decoration:none;border-bottom:1px dashed rgba(168,236,255,.45);line-height:1.2;letter-spacing:0}
.pg:hover{color:#fff;border-bottom-style:solid}

/* 빛이 따라오는 상자 */
.spot{position:relative;border-radius:var(--r);background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.015));border:1px solid var(--line);isolation:isolate}
.spot::before{content:"";position:absolute;inset:-1px;border-radius:inherit;padding:1px;background:radial-gradient(320px circle at var(--mx,50%) var(--my,-40%),rgba(168,236,255,.55),transparent 60%);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0);opacity:0;transition:opacity .4s;pointer-events:none}
.spot::after{content:"";position:absolute;inset:0;border-radius:inherit;z-index:-1;background:radial-gradient(420px circle at var(--mx,50%) var(--my,-40%),rgba(82,217,255,.07),transparent 60%);opacity:0;transition:opacity .4s;pointer-events:none}
.spot:hover::before,.spot:hover::after{opacity:1}

/* 노드 사슬: 이 칸이 다루는 노드 */
.chain{position:relative;display:inline-flex;gap:14px;margin-bottom:14px;padding:2px 0}
.chain::before{content:"";position:absolute;left:5px;right:5px;top:50%;border-top:1.5px solid rgba(255,255,255,.14)}
.chain.link::before{border-top:1.5px dashed var(--ion);box-shadow:0 0 8px var(--ion-g)}
.chain i{position:relative;width:11px;height:11px;border-radius:50%;border:1.5px solid rgba(200,215,240,.45);background:var(--bg)}
.chain i.on{background:var(--ember);border-color:var(--ember-2);box-shadow:0 0 12px var(--ember)}

/* ── 지금·흐름 ── */
.tbar{position:relative;display:flex;height:56px;gap:3px;margin-bottom:clamp(22px,3vw,36px)}
.tbar span{flex:var(--m) 1 0;display:flex;align-items:center;padding:0 12px;min-width:0;border-radius:10px;font-size:14px;font-weight:650;color:var(--ink-2);background:rgba(255,255,255,.05);border:1px solid var(--line);overflow:hidden;white-space:nowrap}
.tbar .lab{background:linear-gradient(180deg,rgba(255,106,61,.24),rgba(255,106,61,.10));border-color:rgba(255,106,61,.45);color:var(--ink)}
.tbar .rest{background:repeating-linear-gradient(135deg,rgba(255,255,255,.08) 0 4px,transparent 4px 9px);padding:0}
.tbar-now{position:absolute;top:-8px;bottom:-8px;left:var(--now,0%);width:2px;background:var(--ion);box-shadow:0 0 12px var(--ion);display:none}
.tbar.is-live .tbar-now{display:block}
.sched{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 clamp(24px,4vw,56px)}
.sched li{display:grid;grid-template-columns:60px minmax(0,1fr) auto;gap:14px;align-items:center;min-height:64px;padding:8px 0;border-bottom:1px solid var(--line)}
.sched time{font-size:16px;font-weight:600;color:var(--ink-3)}
.sched .t{font-size:16.5px;font-weight:600;line-height:1.45}
.sched .lab time{color:var(--ember)}
.sched .lab .t{font-weight:750}
.sched .rest .t{color:var(--ink-3);font-weight:500}
.sched .go{display:inline-flex;align-items:center;justify-content:center;min-height:40px;min-width:44px;padding:0 14px;border-radius:12px;font-size:14px;font-weight:700;color:var(--ion-2);text-decoration:none;white-space:nowrap;border:1px solid rgba(82,217,255,.28);background:rgba(82,217,255,.06);transition:background .3s,border-color .3s}
.sched .go:hover{background:rgba(82,217,255,.14);border-color:rgba(168,236,255,.6)}
.sched span.go{border:0;background:none;min-width:0;padding:0}
.sched li.is-now{position:relative}
.sched li.is-now::before{content:"지금";position:absolute;left:-2px;top:-9px;font:700 11px/1 var(--f);color:#140805;background:var(--ember);padding:3px 6px;border-radius:6px}
.sched li.is-now time{color:var(--ember)}
.sched li.is-now .go{background:var(--ember);border-color:var(--ember);color:#140805}

/* ── 시작 전에 ── */
.start-grid{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr) minmax(0,1fr);gap:clamp(16px,2.2vw,26px);align-items:start}
.start-c .h3 .n{display:inline-grid;place-items:center;width:30px;height:30px;border-radius:50%;border:1.5px solid var(--ember);color:var(--ember);font-size:14px;font-weight:700}
.pack{padding:20px 22px 12px}
.checks label{display:flex;align-items:flex-start;gap:12px;min-height:44px;padding:8px 0;cursor:pointer;font-size:15.5px;line-height:1.5}
.checks input{appearance:none;-webkit-appearance:none;flex:none;width:22px;height:22px;margin:1px 0 0;border-radius:7px;border:2px solid var(--ion);background:transparent;display:grid;place-items:center;cursor:pointer;transition:background .25s}
.checks input::after{content:"";width:10px;height:6px;border:2.5px solid #05060a;border-top:0;border-right:0;transform:rotate(-45deg) translate(1px,-1px) scale(0);transition:transform .25s var(--ease)}
.checks input:checked{background:var(--ion)}
.checks input:checked::after{transform:rotate(-45deg) translate(1px,-1px) scale(1)}
.checks input:checked + span{color:var(--ink-3);text-decoration:line-through;text-decoration-color:rgba(82,217,255,.6)}

/* ── 교재 ── */
.jump{margin-top:clamp(18px,2.4vw,28px)}
.jump ul{display:flex;flex-wrap:wrap;gap:8px}
.jump a{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 14px 0 8px;border-radius:12px;border:1px solid var(--line);background:rgba(255,255,255,.03);font-size:15px;font-weight:600;text-decoration:none;transition:border-color .3s,background .3s}
.jump a:hover{border-color:rgba(168,236,255,.45);background:rgba(82,217,255,.06)}
.jump b{display:inline-grid;place-items:center;min-width:30px;height:30px;padding:0 6px;border-radius:9px;background:rgba(255,106,61,.14);color:var(--ember-2);font-size:14px;font-weight:700}

/* ── 실습 들어가기 ── */
.labs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:clamp(14px,2vw,22px)}
.lab-c{padding:22px 22px 20px;display:flex;flex-direction:column;transition:transform .5s var(--ease),border-color .3s}
.lab-c:hover{border-color:rgba(255,106,61,.4)}
.lab-k{font-size:14.5px;font-weight:650;color:var(--ember-2)}
.lab-c h3{font-size:clamp(21px,2vw,26px);font-weight:800;letter-spacing:-.035em;line-height:1.25;margin:6px 0 18px}
.lab-go{margin-top:auto;display:inline-flex;align-items:center;gap:8px;align-self:flex-start;min-height:44px;padding:0 16px;border-radius:12px;background:rgba(255,255,255,.06);border:1px solid var(--line-2);font-size:15px;font-weight:700;text-decoration:none}
.lab-go::after{content:"";position:absolute;inset:0;border-radius:var(--r)}
.lab-go::before{content:"→";order:2;font-family:var(--f-num);transition:transform .4s var(--ease)}
.lab-c:hover .lab-go{background:var(--ember);border-color:var(--ember);color:#140805}
.lab-c:hover .lab-go::before{transform:translateX(3px)}
.lab-c.is-now{border-color:rgba(255,106,61,.6);box-shadow:0 0 0 1px rgba(255,106,61,.3),0 20px 60px -20px var(--ember-g)}
.lab-c.is-now .lab-go{background:var(--ember);border-color:var(--ember);color:#140805}

/* ── 질문·투표 ── */
.join-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:clamp(20px,3vw,40px);align-items:start}
.polls{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px;align-items:start}
.note{margin-top:16px;font-size:15.5px;color:var(--ink-2)}

/* ── 연수가 끝난 뒤 ── */
.after{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:clamp(14px,2vw,22px);margin-bottom:clamp(32px,4.5vw,56px)}
.after li{padding:22px 24px 24px}
.after .when{font-size:15px;font-weight:700;color:var(--ember);margin-bottom:6px}
.after h3{font-size:19px;font-weight:750;letter-spacing:-.02em;margin-bottom:6px;line-height:1.4}
.after p{font-size:15.5px;color:var(--ink-2)}
.after p a{padding:0}
.mail{font-family:var(--f-mono);font-size:15px;color:var(--ion-2);overflow-wrap:anywhere;display:inline-flex;min-height:32px;align-items:center}
.close-grid{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr);gap:clamp(20px,3vw,40px);align-items:start}
.close-side{display:grid;gap:clamp(20px,3vw,32px)}

/* ── 실습 쪽 ── */
.lab-top{position:relative;padding:clamp(116px,15vh,160px) 0 clamp(24px,3vw,36px);isolation:isolate;overflow:hidden}
.lab-top::before{content:"";position:absolute;z-index:-1;left:-10%;right:-10%;top:-20%;height:120%;background:radial-gradient(50% 60% at 18% 40%,rgba(255,106,61,.16),transparent 70%),radial-gradient(40% 60% at 85% 30%,rgba(82,217,255,.12),transparent 70%);pointer-events:none}
.kin-sm{font-size:clamp(40px,6.4vw,92px);max-width:none}
.kin-sm .kin-l1{text-shadow:0 0 50px rgba(255,106,61,.3)}
.safe{display:block;max-width:52em;margin:22px 0 26px;padding:14px 16px;border-radius:14px;border:1px solid rgba(82,217,255,.25);background:rgba(82,217,255,.05);font-size:15.5px;color:var(--ink-2);line-height:1.6}
.rail{position:relative;display:grid;grid-template-columns:repeat(3,1fr) auto;gap:clamp(8px,1.5vw,18px);align-items:center;padding:10px;border-radius:20px;border:1px solid var(--line);background:rgba(12,14,21,.55);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}
.rail a{position:relative;display:grid;grid-template-columns:auto 1fr;grid-template-rows:auto auto;column-gap:12px;align-items:center;min-height:60px;padding:8px 14px;border-radius:14px;text-decoration:none;transition:background .3s}
.rail a:hover{background:rgba(255,255,255,.05)}
.rail a i{grid-row:1/3;width:14px;height:14px;border-radius:50%;border:2px solid var(--ember);transition:background .3s,box-shadow .3s}
.rail a b{font-size:16px;font-weight:750;line-height:1.3}
.rail a span{font-size:14px;color:var(--ink-3);line-height:1.3}
.rail a.is-done i{background:var(--ember)}
.rail a[aria-current="step"]{background:rgba(255,106,61,.1)}
.rail a[aria-current="step"] i{box-shadow:0 0 0 5px rgba(255,106,61,.18),0 0 18px var(--ember)}
.rail-c{display:flex;flex-direction:column;gap:6px;padding:0 10px;font-size:14px;color:var(--ink-2);white-space:nowrap}
.rail-c b{color:var(--ink);font-size:16px}
.rail progress{appearance:none;-webkit-appearance:none;width:120px;height:4px;border:0;border-radius:4px;background:rgba(255,255,255,.1);overflow:hidden}
.rail progress::-webkit-progress-bar{background:rgba(255,255,255,.1)}
.rail progress::-webkit-progress-value{background:linear-gradient(90deg,var(--ember),var(--ion))}
.rail progress::-moz-progress-bar{background:linear-gradient(90deg,var(--ember),var(--ion))}
.step{position:relative;padding:clamp(32px,4vw,52px) 0;border-top:1px solid var(--line);scroll-margin-top:88px}
.step-grid{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:clamp(24px,4vw,56px);align-items:start}
.step-k{font-size:15px;font-weight:650;color:var(--ember-2);margin-bottom:6px;line-height:1.6}
.step-k .pg{min-height:28px;vertical-align:baseline;display:inline}
.step-h{font-size:clamp(28px,3.2vw,42px);font-weight:800;letter-spacing:-.04em;line-height:1.15}
.done{display:flex;flex-wrap:wrap;gap:2px 12px;align-items:baseline;margin-top:12px;font-size:16px;color:var(--ink)}
.done b{color:var(--ember-2);font-weight:750}
.todo{counter-reset:t;margin-top:14px}
.todo li{counter-increment:t;position:relative;padding:11px 0 11px 42px;border-bottom:1px solid var(--line);font-size:17px;line-height:1.55}
.todo li::before{content:counter(t,decimal-leading-zero);position:absolute;left:0;top:13px;font:700 14px/1.4 var(--f-num);color:var(--ember)}
.crit{margin-top:16px;font-size:15px;color:var(--ink-2);line-height:1.65}
.crit b{display:block;font-size:14px;color:var(--ion-2);margin-bottom:2px}
.crit .pg{display:inline;margin-left:6px}
.step-r{display:grid;gap:16px}
.prompt{overflow:hidden;background:linear-gradient(180deg,rgba(14,17,26,.92),rgba(9,11,17,.92));border-color:rgba(82,217,255,.22)}
.prompt figcaption{display:flex;align-items:center;gap:8px 14px;flex-wrap:wrap;padding:10px 10px 10px 18px;border-bottom:1px solid var(--line);background:rgba(255,255,255,.025)}
.p-t{flex:1 1 12em;font-size:15px;font-weight:700;color:var(--ion-2)}
.copy{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;min-width:84px;padding:0 18px;border-radius:12px;border:1px solid rgba(255,106,61,.6);background:var(--ember);color:#140805;font-size:15px;font-weight:750;cursor:pointer;transition:background .3s,box-shadow .3s}
.copy:hover{background:#ff7d55;box-shadow:0 8px 30px -6px var(--ember-g)}
.copy.is-copied{background:var(--ion);border-color:var(--ion)}
.code{display:block;padding:16px 18px 18px 0;font-family:var(--f-mono);font-size:15px;line-height:1.75;color:#dfe6f2;counter-reset:l;white-space:normal}
.code .l{display:block;position:relative;padding-left:52px;white-space:pre-wrap;word-break:keep-all;overflow-wrap:anywhere;counter-increment:l}
.code .l::before{content:counter(l);position:absolute;left:0;width:36px;text-align:right;color:#6f778b;font-size:13px;font-family:var(--f-num)}
.code i{font-style:normal;color:var(--ion);background:rgba(82,217,255,.1);border-radius:5px;padding:0 3px;box-decoration-break:clone;-webkit-box-decoration-break:clone}
.code-more{display:none}
.board{scroll-margin-top:96px}
.next{font-size:15px}
.break{display:flex;align-items:center;gap:14px;margin:0;padding:20px;border-top:1px solid var(--line);font-size:16px;font-weight:650;color:var(--ink-2);background:repeating-linear-gradient(135deg,rgba(255,255,255,.035) 0 6px,transparent 6px 14px)}
.break .num{color:var(--ink-3)}
.after-lab{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:14px 24px;margin:8px 0 clamp(40px,6vw,72px);padding:22px 24px;border-radius:var(--r);border:1px solid rgba(255,106,61,.35);background:linear-gradient(120deg,rgba(255,106,61,.12),rgba(255,106,61,.02))}
.after-lab p{font-size:17px;font-weight:650}
.after-lab .num{color:var(--ember);margin-right:8px}
.step .lpk.lpk-step-f{margin-top:28px}

/* 바닥 */
.foot{border-top:1px solid var(--line);padding:56px 0 0;color:var(--ink-2);font-size:15px;overflow:hidden}
.foot-in{display:grid;gap:8px}
.foot-b{display:flex;align-items:center;gap:10px;font-size:18px;font-weight:750;color:var(--ink);margin-bottom:6px}
.foot-l{display:flex;flex-wrap:wrap;gap:4px 18px;margin-top:6px}
.foot-l a{display:inline-flex;align-items:center;min-height:44px;color:var(--ink-2)}
.foot-l a:hover{color:var(--ink)}
.foot-s{font-size:14px;color:var(--ink-3);padding-bottom:28px}
.foot-mark{margin:clamp(12px,3vw,36px) 0 calc(-1 * clamp(14px,3vw,40px));text-align:center;white-space:nowrap;font-size:clamp(60px,17vw,250px);font-weight:850;letter-spacing:-.06em;line-height:.92;color:#141824;-webkit-mask-image:linear-gradient(#000 35%,transparent 92%);mask-image:linear-gradient(#000 35%,transparent 92%);user-select:none}
.foot-mark span{background:linear-gradient(180deg,rgba(255,106,61,.28),#141824 55%);-webkit-background-clip:text;background-clip:text;color:transparent}

/* ── 키트(색은 변수로, 유리 결만 더함) ── */
.lpk.lpk-w{background:linear-gradient(180deg,rgba(18,21,31,.9),rgba(11,13,20,.9));border-color:rgba(255,255,255,.1)}
.lpk .lp-btn-primary{box-shadow:0 10px 30px -10px var(--ember-g)}

/* 마우스 따라오는 고리(가는 포인터만) */
.cursor{position:fixed;left:0;top:0;z-index:95;pointer-events:none;display:none;opacity:0;transition:opacity .3s}
.cursor i{position:fixed;left:0;top:0;border-radius:50%;will-change:transform}
.cursor-dot{width:6px;height:6px;margin:-3px 0 0 -3px;background:var(--ember)}
.cursor-ring{width:36px;height:36px;margin:-18px 0 0 -18px;border:1px solid rgba(168,236,255,.55);transition:width .35s var(--ease),height .35s var(--ease),margin .35s var(--ease),border-color .3s,background-color .3s}
.cursor.is-hot .cursor-ring{width:64px;height:64px;margin:-32px 0 0 -32px;border-color:rgba(255,106,61,.7);background:rgba(255,106,61,.06)}
.has-cursor .cursor{display:block}

/* ── 움직임(줄이기를 고르지 않았을 때만) ── */
@media (prefers-reduced-motion:no-preference){
  .beacon::after{content:"";position:absolute;inset:-6px;border-radius:50%;border:1px solid var(--ember);animation:ping 2.4s var(--ease) infinite}
  @keyframes ping{from{transform:scale(.4);opacity:1}to{transform:scale(2.2);opacity:0}}
  .now-dot{animation:breathe 2.2s ease-in-out infinite}
  @keyframes breathe{50%{opacity:.45}}
  .js .kin.is-split .c{animation:kin-in 1.1s var(--ease) both;animation-delay:calc(var(--i) * 42ms + .1s)}
  @keyframes kin-in{from{opacity:0;transform:translateY(.42em) rotateX(-75deg) scale(.96);filter:blur(10px)}}
  .js .hero-sub,.js .hero-cta,.js .now-chip,.js .hero-org,.js .lab-top .safe,.js .lab-top .rail{animation:fade-up 1s var(--ease) both}
  .js .hero-org{animation-delay:.05s}.js .hero-sub{animation-delay:.75s}.js .hero-cta{animation-delay:.9s}.js .now-chip{animation-delay:1.05s}
  .js .lab-top .safe{animation-delay:.6s}.js .lab-top .rail{animation-delay:.75s}
  .js .hero-facts{animation:fade-up 1.1s 1.1s var(--ease) both}
  @keyframes fade-up{from{opacity:0;transform:translateY(18px)}}
  .k-dot.is-now::after{content:"";position:absolute;inset:-6px;border-radius:50%;border:1px solid var(--ember);animation:ping 2.4s var(--ease) infinite}
  .lab-c:hover{transform:translateY(-4px)}
  .js .h2.rv .w{display:inline-block;transition:transform 1s var(--ease),opacity 1s var(--ease),filter 1s var(--ease);transition-delay:calc(var(--i) * 45ms)}
  .js .h2.rv:not(.in) .w{opacity:0;transform:translateY(.5em);filter:blur(8px)}
}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}

/* ── 폭에 따라 ── */
@media (max-width:1023px){
  .step-grid,.close-grid,.join-grid{grid-template-columns:minmax(0,1fr)}
  .start-grid{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
  .start-grid .pack{grid-column:1/-1}
  .sched{grid-template-columns:minmax(0,1fr)}
  .after{grid-template-columns:minmax(0,1fr)}
  .rail{grid-template-columns:repeat(3,minmax(0,1fr))}
  .rail-c{grid-column:1/-1;flex-direction:row;align-items:center;justify-content:space-between;padding:6px 10px 2px}
  .rail progress{flex:1;max-width:none;margin-left:14px}
  .hero-facts{grid-template-columns:1fr 1fr}
  .hero-facts > div:nth-child(3){border-left:0}
  .hero-facts > div:nth-child(n+3){border-top:1px solid var(--line)}
}
@media (max-width:720px){
  body{font-size:16px}
  .nav{top:8px;padding:0 10px}
  .nav-in{height:56px;padding:0 4px 0 12px;border-radius:18px}
  .nav-progress{top:54px;left:28px;right:28px}
  .brand-t{display:none}
  .menu{gap:0}
  .menu a{padding:0 11px;font-size:15px}
  .hero{padding-top:96px;padding-bottom:28px;min-height:0}
  .hero-in{align-self:start}
  .hero-org{font-size:14px}
  .kin{font-size:clamp(42px,12.4vw,60px);letter-spacing:-.055em}
  .kin-sm{font-size:clamp(34px,10vw,46px)}
  .hero-sub{font-size:17px}
  .hero-cta{display:grid;grid-template-columns:1.25fr 1fr;gap:10px}
  .btn{min-height:52px;padding:0 16px;font-size:16px}
  .now-chip{font-size:14px;width:100%;justify-content:space-between}
  .hero-facts{grid-template-columns:minmax(0,1fr);margin-top:clamp(130px,22vh,200px);width:calc(100% - 32px)}
  .hero-facts > div{display:grid;grid-template-columns:3em 1fr;gap:10px;padding:11px 16px;border-left:0}
  .hero-facts > div + div{border-top:1px solid var(--line)}
  .hero-facts dt{margin:2px 0 0}
  .hero-facts dd{font-size:15px}
  .hero-facts small{display:inline;font-size:13.5px}
  .sec{padding:44px 0}
  .sec-h{margin-bottom:20px}
  .sec-k{font-size:14px;margin-bottom:8px}
  .h2{font-size:clamp(28px,8vw,34px)}
  .h3{margin-bottom:10px}
  .lead{margin-top:10px;font-size:15.5px}
  .tbar{height:10px;gap:2px;margin-bottom:12px}
  .tbar span{font-size:0;padding:0;border-radius:3px}
  .tbar-now{top:-5px;bottom:-5px}
  .sched li{grid-template-columns:48px minmax(0,1fr) auto;gap:10px;min-height:56px;padding:6px 0}
  .sched time{font-size:14.5px}
  .sched .t{font-size:15px}
  .sched .go{min-height:40px;padding:0 11px;font-size:13.5px}
  .start-grid{grid-template-columns:minmax(0,1fr);gap:20px}
  .pack{padding:16px 16px 6px}
  .checks label{padding:7px 0;font-size:15px}
  .jump ul{gap:6px}
  .jump a{font-size:14px;padding:0 12px 0 6px;gap:6px}
  .labs{grid-template-columns:minmax(0,1fr);gap:10px}
  .lab-c{display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"k go" "h go";align-items:center;column-gap:12px;padding:14px 14px 14px 16px}
  .lab-c .chain{display:none}
  .lab-k{grid-area:k;font-size:13.5px}
  .lab-c h3{grid-area:h;font-size:18px;margin:2px 0 0}
  .lab-go{grid-area:go;margin:0;padding:0 14px;font-size:14px}
  .polls{grid-template-columns:minmax(0,1fr)}
  .after{gap:10px;margin-bottom:28px}
  .after li{padding:16px 18px}
  .after h3{font-size:17.5px;margin-bottom:4px}
  .after p{font-size:15px}
  .lab-top{padding:96px 0 18px}
  .safe{margin:16px 0 18px;font-size:14.5px;padding:12px 14px}
  .rail{padding:6px;gap:4px}
  .rail a{grid-template-columns:minmax(0,1fr);min-height:56px;padding:8px 6px;justify-items:center;text-align:center;row-gap:4px}
  .rail a i{grid-row:auto}
  .rail a b{font-size:14.5px}
  .rail a span{font-size:13px}
  .step{padding:28px 0}
  .chain{margin-bottom:10px}
  .step-h{font-size:27px}
  .done{margin-top:8px;font-size:15px}
  .todo{margin-top:10px}
  .todo li{font-size:15.5px;padding:9px 0 9px 34px}
  .todo li::before{top:11px}
  .crit{margin-top:12px;font-size:14.5px}
  .step-r{gap:12px}
  .code{font-size:14px;line-height:1.65;padding:12px 14px 14px 0}
  .code .l{padding-left:30px}
  .code .l::before{width:20px;font-size:12px}
  .js .prompt.is-folded .code{max-height:7.4em;overflow:hidden;-webkit-mask-image:linear-gradient(#000 55%,transparent);mask-image:linear-gradient(#000 55%,transparent)}
  .js .code-more{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;min-height:44px;border:0;border-top:1px solid var(--line);background:rgba(255,255,255,.03);color:var(--ion-2);font-size:14.5px;font-weight:650;cursor:pointer}
  .prompt figcaption{display:grid;grid-template-columns:minmax(0,1fr) auto;column-gap:10px;padding:8px 8px 8px 14px}
  .prompt figcaption .p-t{grid-column:1;font-size:14.5px;line-height:1.4}
  .prompt figcaption .pg{grid-column:1;grid-row:2;min-height:28px;font-size:13.5px;justify-self:start}
  .prompt figcaption .copy{grid-column:2;grid-row:1/3}
  .after-lab{padding:16px 18px}
  .after-lab p{font-size:15.5px}
  .foot{padding:36px 0 0}
}
@media (max-width:380px){
  .menu a{padding:0 8px;font-size:14px}
  .kin{font-size:40px}
}
@media print{.nav,.cursor,.aura,.neural,.hero-labels{display:none!important}body{background:#fff;color:#000}}
`,u=`<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>질문이 먼저, AI는 그다음 · AI 시대 수업 설계 실습 연수</title>
<meta name="description" content="AI 시대 수업 설계 실습 연수 당일 사이트. 2026. 12. 9.(수) 14:00~17:00, 누리솔교육연수원 2층 미래수업실. 지금 순서·출석·교재·실습·질문·과제를 한곳에서.">
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="#05060a">
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Space+Grotesk:wght@500;600;700&display=swap">
<link rel="stylesheet" href="assets/style.css">
<script src="assets/site.js" defer><\/script>
</head>
<body>
<a class="skip" href="#main">본문으로 건너뛰기</a>
<div class="aura" aria-hidden="true"></div>
<div class="cursor" aria-hidden="true"><i class="cursor-ring"></i><i class="cursor-dot"></i></div>

<header class="nav" data-nav>
  <div class="nav-in">
    <a class="brand" href="#top" aria-label="질문이 먼저, AI는 그다음 · 맨 위로">
      <svg class="glyph" viewBox="0 0 30 20" aria-hidden="true"><path d="M5 10 C 12 10, 14 4, 24 4 M5 10 C 12 10, 14 16, 24 16" fill="none" stroke="#52d9ff" stroke-width="1.4" stroke-dasharray="2.4 2.4"/><circle cx="5" cy="10" r="3.6" fill="#ff6a3d"/><circle cx="24.5" cy="4" r="2.6" fill="#05060a" stroke="#a8ecff" stroke-width="1.4"/><circle cx="24.5" cy="16" r="2.6" fill="#05060a" stroke="#a8ecff" stroke-width="1.4"/></svg>
      <span class="brand-t">질문이 먼저</span>
    </a>
    <nav class="menu" aria-label="연수 사이트 차례" data-menu>
      <span class="menu-pill" aria-hidden="true"></span>
      <a href="#now">지금</a><a href="#deck">교재</a><a href="lab.html">실습</a><a href="#join">참여</a><a href="#after">자료</a>
    </nav>
  </div>
  <span class="nav-progress" aria-hidden="true"></span>
</header>

<main id="main">

<!-- 첫 화면 -->
<section class="hero" id="top" aria-labelledby="hero-h" data-hero>
  <canvas class="neural" data-neural aria-hidden="true"></canvas>
  <div class="hero-labels" data-labels aria-hidden="true">
    <span><b>1</b>질문</span><span><b>2</b>목표</span><span><b>3</b>증거</span><span><b>4</b>경험</span><span><b>5</b>성찰</span>
  </div>
  <div class="hero-in">
    <p class="hero-org"><span class="beacon" aria-hidden="true"></span>누리솔교육연수원 · AI 시대 수업 설계 실습 연수</p>
    <h1 id="hero-h" class="kin" data-kin><span class="kin-l1">질문이 먼저,</span><br><span class="kin-l2">AI는 그다음</span></h1>
    <p class="hero-sub">다섯 개의 노드로 다시 짜는 한 차시 수업</p>
    <div class="hero-cta">
      <a class="btn btn-ember mag" href="lab.html"><span class="btn-t">실습 열기</span><svg class="ic" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11M11 5l5 5-5 5"/></svg></a>
      <a class="btn btn-glass mag" href="#deck"><span class="btn-t">교재 보기</span></a>
    </div>
    <p class="now-chip" data-now-chip><span class="now-dot" aria-hidden="true"></span><span data-now-text>12월 9일(수) 14:00 시작</span><a href="assets/event.ics" download data-now-go>달력에 넣기</a></p>
  </div>
  <dl class="hero-facts">
    <div><dt>일시</dt><dd>2026. 12. 9.(수) <span class="num">14:00~17:00</span></dd></div>
    <div><dt>장소</dt><dd>누리솔교육연수원 2층 미래수업실</dd></div>
    <div><dt>강사</dt><dd>윤채온 <small>중학교 과학 교사</small></dd></div>
    <div><dt>이수</dt><dd>3시간 <small>출석 90% 이상 · 만족도 조사</small></dd></div>
  </dl>
</section>

<!-- 지금·오늘의 흐름 -->
<section class="sec" id="now" aria-labelledby="now-h">
  <div class="wrap">
    <header class="sec-h">
      <p class="sec-k"><span class="k-dot" aria-hidden="true"></span><span class="num">180</span>분 · 초·중·고 교사 30명 · <a href="#deck-p3">교재 3쪽 보기</a></p>
      <h2 id="now-h" class="h2">오늘의 흐름</h2>
    </header>
    <div class="tbar" data-tbar aria-hidden="true">
      <span style="--m:15">들어가며</span><span style="--m:30">1부</span><span class="lab" style="--m:40">실습 1</span><span class="rest" style="--m:10"></span><span class="lab" style="--m:40">실습 2</span><span class="lab" style="--m:30">실습 3</span><span style="--m:15">마무리</span>
      <i class="tbar-now" data-tbar-now></i>
    </div>
    <ol class="sched" aria-label="오늘의 흐름과 할 일">
      <li data-at="14:00" data-to="14:15" data-go="#start"><time class="num">14:00</time><span class="t">들어가며 · 출석과 첫 투표</span><a class="go" href="#start">출석</a></li>
      <li data-at="14:15" data-to="14:45" data-go="#deck-p5"><time class="num">14:15</time><span class="t">1부 · 다섯 노드로 보는 수업 설계</span><a class="go" href="#deck-p5">교재 5쪽</a></li>
      <li class="lab" data-at="14:45" data-to="15:25" data-go="lab.html#st-s1"><time class="num">14:45</time><span class="t">실습 1 · 질문 노드: 핵심 질문 만들기</span><a class="go" href="lab.html#st-s1">실습 1</a></li>
      <li class="rest" data-at="15:25" data-to="15:35"><time class="num">15:25</time><span class="t">쉬는 시간 10분</span><span class="go" aria-hidden="true"></span></li>
      <li class="lab" data-at="15:35" data-to="16:15" data-go="lab.html#st-s2"><time class="num">15:35</time><span class="t">실습 2 · 증거 노드: 평가 과제와 루브릭</span><a class="go" href="lab.html#st-s2">실습 2</a></li>
      <li class="lab" data-at="16:15" data-to="16:45" data-go="lab.html#st-s3"><time class="num">16:15</time><span class="t">실습 3 · 연결: AI 사용 카드 만들기</span><a class="go" href="lab.html#st-s3">실습 3</a></li>
      <li data-at="16:45" data-to="17:00" data-go="#join"><time class="num">16:45</time><span class="t">마무리 · 확인 문제와 만족도 조사</span><a class="go" href="#join">확인 문제</a></li>
    </ol>
  </div>
</section>

<!-- 시작 전에 -->
<section class="sec" id="start" aria-labelledby="start-h">
  <div class="wrap">
    <header class="sec-h">
      <p class="sec-k"><span class="k-dot" aria-hidden="true" data-k-at="14:00" data-k-to="14:15"></span><span class="num">14:00</span> · <a href="#deck-p2">교재 2쪽 보기</a></p>
      <h2 id="start-h" class="h2">시작 전에</h2>
      <p class="lead">출석을 누르고, 첫 투표에 답해요.</p>
    </header>
    <div class="start-grid">
      <div class="start-c"><h3 class="h3"><span class="n num">1</span>출석</h3><div data-lp="attend"></div></div>
      <div class="start-c"><h3 class="h3"><span class="n num">2</span>첫 투표</h3><div data-lp="poll" data-question="요즘 수업 준비에 AI를 얼마나 쓰나요?" data-options='["거의 안 써요","가끔, 자료 만들 때","매주 한두 번","거의 매일"]' data-page="2"></div></div>
      <div class="start-c spot pack">
        <h3 class="h3"><span class="n num">3</span>준비물 <a class="pg" href="#deck-p4">교재 4쪽</a></h3>
        <ul class="checks" data-checks="pack">
          <li><label><input type="checkbox" data-k="laptop"><span>노트북 또는 태블릿</span></label></li>
          <li><label><input type="checkbox" data-k="ai"><span>평소 쓰는 생성형 AI 하나(계정 로그인)</span></label></li>
          <li><label><input type="checkbox" data-k="std"><span>다음 학기에 가르칠 성취기준 한 개</span></label></li>
          <li><label><input type="checkbox" data-k="charger"><span>충전기</span></label></li>
        </ul>
      </div>
    </div>
  </div>
</section>

<!-- 교재 -->
<section class="sec" id="deck" aria-labelledby="deck-h">
  <div class="wrap">
    <header class="sec-h">
      <p class="sec-k"><span class="k-dot" aria-hidden="true"></span>교재 <span class="num">17</span>쪽</p>
      <h2 id="deck-h" class="h2">교재</h2>
      <p class="lead">강사 화면을 따라 넘어가요. 지난 쪽은 아래 목록에서 골라 봐요.</p>
    </header>
    <div data-lp="deck" data-pages="1-17"></div>
    <nav class="jump" aria-label="자주 찾는 쪽">
      <h3 class="h4">자주 찾는 쪽</h3>
      <ul>
        <li><a href="#deck-p3"><b class="num">3</b>오늘의 흐름</a></li>
        <li><a href="#deck-p5"><b class="num">5</b>다섯 노드</a></li>
        <li><a href="#deck-p6"><b class="num">6</b>누가 무엇을</a></li>
        <li><a href="#deck-p7"><b class="num">7</b>같은 성취기준</a></li>
        <li><a href="#deck-p13"><b class="num">13</b>사용 카드 예시</a></li>
        <li><a href="#deck-p14"><b class="num">14</b>안전하게 쓰기</a></li>
        <li><a href="#deck-p16"><b class="num">16</b>연수가 끝난 뒤</a></li>
      </ul>
    </nav>
  </div>
</section>

<!-- 실습 들어가기 -->
<section class="sec" id="lab" aria-labelledby="lab-h">
  <div class="wrap">
    <header class="sec-h">
      <p class="sec-k"><span class="k-dot" aria-hidden="true" data-k-at="14:45" data-k-to="16:45"></span><span class="num">14:45~16:45</span> · <a href="#deck-p8">교재 8쪽 보기</a></p>
      <h2 id="lab-h" class="h2">실습</h2>
      <p class="lead">할 일과 복사할 프롬프트는 실습 쪽에 있어요.</p>
    </header>
    <ol class="labs">
      <li class="lab-c spot" data-lab-at="14:45" data-lab-to="15:25">
        <span class="chain" aria-hidden="true"><i class="on"></i><i></i><i></i><i></i><i></i></span>
        <p class="lab-k"><span class="num">14:45</span> · 질문 노드 · 40분</p>
        <h3>핵심 질문 만들기</h3>
        <a class="lab-go" href="lab.html#st-s1">실습 1 열기</a>
      </li>
      <li class="lab-c spot" data-lab-at="15:35" data-lab-to="16:15">
        <span class="chain" aria-hidden="true"><i></i><i></i><i class="on"></i><i></i><i></i></span>
        <p class="lab-k"><span class="num">15:35</span> · 증거 노드 · 40분</p>
        <h3>평가 과제와 루브릭</h3>
        <a class="lab-go" href="lab.html#st-s2">실습 2 열기</a>
      </li>
      <li class="lab-c spot" data-lab-at="16:15" data-lab-to="16:45">
        <span class="chain link" aria-hidden="true"><i class="on"></i><i class="on"></i><i class="on"></i><i class="on"></i><i class="on"></i></span>
        <p class="lab-k"><span class="num">16:15</span> · 연결 · 30분</p>
        <h3>AI 사용 카드 만들기</h3>
        <a class="lab-go" href="lab.html#st-s3">실습 3 열기</a>
      </li>
    </ol>
  </div>
</section>

<!-- 질문·투표 -->
<section class="sec" id="join" aria-labelledby="join-h">
  <div class="wrap">
    <header class="sec-h">
      <p class="sec-k"><span class="k-dot" aria-hidden="true" data-k-at="16:45" data-k-to="17:00"></span>언제든 · 확인 문제는 <span class="num">16:45</span> · <a href="#deck-p15">교재 15쪽 보기</a></p>
      <h2 id="join-h" class="h2">질문·투표</h2>
      <p class="lead">질문은 이름 없이 올려요. 투표는 강사가 열면 답해요.</p>
    </header>
    <div class="join-grid">
      <div class="join-q"><h3 class="h3">질문</h3><div data-lp="qa"></div></div>
      <div class="join-p">
        <h3 class="h3">확인 문제</h3>
        <div class="polls">
          <div data-lp="poll" data-question="문제 1. 다섯 노드 중 가장 먼저 정하는 것은?" data-options='["경험","질문","증거","AI 도구"]' data-answer="2" data-page="15"></div>
          <div data-lp="poll" data-question="문제 2. AI에 맡기지 않을 일은?" data-options='["질문 후보 넓게 뽑기","루브릭 초안","최종 평가와 점수","활동 아이디어"]' data-answer="3" data-page="15"></div>
          <div data-lp="poll" data-question="문제 3. 점검 프롬프트로 찾는 것이 아닌 것은?" data-options='["수준 차이가 흐릿한 칸","AI 답을 옮겨도 잘함인 칸","글자 수가 많은 칸","목표와 이어지지 않는 요소"]' data-answer="3" data-page="15"></div>
          <div data-lp="poll" data-kind="word" data-question="한 낱말로: AI 시대, 교사의 일은 ○○이다." data-page="17"></div>
        </div>
        <p class="note">실습 결과는 <a href="lab.html#board">실습 쪽 보드</a>에 올려 나눠요.</p>
      </div>
    </div>
  </div>
</section>

<!-- 연수가 끝난 뒤 -->
<section class="sec" id="after" aria-labelledby="after-h">
  <div class="wrap">
    <header class="sec-h">
      <p class="sec-k"><span class="k-dot" aria-hidden="true"></span>다시 찾기 · <a href="#deck-p16">교재 16쪽 보기</a></p>
      <h2 id="after-h" class="h2">연수가 끝난 뒤</h2>
    </header>
    <ul class="after">
      <li class="spot"><p class="when num">2026. 12. 23.(수)까지</p><h3>과제 · 수업 설계 캔버스</h3><p>설계한 한 차시를 캔버스에 정리하고, 해 본 뒤 성찰 세 줄을 더해 <a href="lab.html#board">보드</a>에 올려요.</p></li>
      <li class="spot"><p class="when num">2027. 1. 6.(수) 16:00~17:00</p><h3>후속 모임 · 온라인</h3><p>접속 주소는 과제를 올린 분께 따로 안내해요.</p></li>
      <li class="spot"><p class="when">문의</p><h3>누리솔교육연수원 연수운영팀</h3><p><a class="mail" href="mailto:hello@nurisol.example">hello@nurisol.example</a></p></li>
    </ul>
    <div class="close-grid">
      <div class="close-c" id="survey">
        <h3 class="h3">만족도 조사 <small>연수 마지막 5분 · 이수에 필요해요</small></h3>
        <div data-lp="survey"></div>
      </div>
      <div class="close-side">
        <div class="close-c">
          <h3 class="h3">자료실</h3>
          <div data-lp="materials" data-items='[{"title":"수업 설계 캔버스(A4) · AI 사용 카드 양식","href":"files/수업설계캔버스.pdf"},{"title":"실습 프롬프트 모음","href":"files/실습프롬프트모음.txt"}]'></div>
        </div>
        <div class="close-c">
          <h3 class="h3">모음 <small>복사한 프롬프트가 여기 모여요</small></h3>
          <div data-lp="notebook"></div>
        </div>
      </div>
    </div>
  </div>
</section>

</main>

<footer class="foot">
  <div class="wrap foot-in">
    <p class="foot-b"><svg class="glyph" viewBox="0 0 30 20" aria-hidden="true"><path d="M5 10 C 12 10, 14 4, 24 4 M5 10 C 12 10, 14 16, 24 16" fill="none" stroke="#52d9ff" stroke-width="1.4" stroke-dasharray="2.4 2.4"/><circle cx="5" cy="10" r="3.6" fill="#ff6a3d"/><circle cx="24.5" cy="4" r="2.6" fill="#05060a" stroke="#a8ecff" stroke-width="1.4"/><circle cx="24.5" cy="16" r="2.6" fill="#05060a" stroke="#a8ecff" stroke-width="1.4"/></svg>질문이 먼저, AI는 그다음</p>
    <p>누리솔교육연수원 교원 직무연수 · AI 시대 수업 설계 실습 연수</p>
    <p class="foot-l"><a href="assets/event.ics" download>달력에 넣기</a><a href="check.html">접속 확인</a><a href="privacy.html">개인정보 안내</a></p>
    <p class="foot-s">예시용 가상 연수예요. 기관·강사·연락처는 실제가 아니에요.</p>
  </div>
  <p class="foot-mark" aria-hidden="true"><span>질문이 먼저</span></p>
</footer>
</body>
</html>
`,x=`<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>실습 · 질문이 먼저, AI는 그다음</title>
<meta name="description" content="실습 세 가지의 할 일과 복사할 프롬프트. 질문 노드·증거 노드·연결.">
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="#05060a">
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Space+Grotesk:wght@500;600;700&display=swap">
<link rel="stylesheet" href="assets/style.css">
<script src="assets/site.js" defer><\/script>
</head>
<body class="p-lab">
<a class="skip" href="#main">본문으로 건너뛰기</a>
<div class="aura" aria-hidden="true"></div>
<div class="cursor" aria-hidden="true"><i class="cursor-ring"></i><i class="cursor-dot"></i></div>

<header class="nav" data-nav>
  <div class="nav-in">
    <a class="brand" href="index.html" aria-label="질문이 먼저, AI는 그다음 · 첫 화면으로">
      <svg class="glyph" viewBox="0 0 30 20" aria-hidden="true"><path d="M5 10 C 12 10, 14 4, 24 4 M5 10 C 12 10, 14 16, 24 16" fill="none" stroke="#52d9ff" stroke-width="1.4" stroke-dasharray="2.4 2.4"/><circle cx="5" cy="10" r="3.6" fill="#ff6a3d"/><circle cx="24.5" cy="4" r="2.6" fill="#05060a" stroke="#a8ecff" stroke-width="1.4"/><circle cx="24.5" cy="16" r="2.6" fill="#05060a" stroke="#a8ecff" stroke-width="1.4"/></svg>
      <span class="brand-t">질문이 먼저</span>
    </a>
    <nav class="menu" aria-label="연수 사이트 차례" data-menu>
      <span class="menu-pill" aria-hidden="true"></span>
      <a href="index.html#now">지금</a><a href="index.html#deck">교재</a><a href="lab.html" aria-current="page">실습</a><a href="index.html#join">참여</a><a href="index.html#after">자료</a>
    </nav>
  </div>
  <span class="nav-progress" aria-hidden="true"></span>
</header>

<main id="main">
<section class="lab-top" aria-labelledby="lab-h">
  <div class="wrap">
    <p class="hero-org"><span class="beacon" aria-hidden="true"></span><span class="num">14:45~16:45</span> · <a class="pg" href="index.html#deck-p8">교재 8–13쪽 보기</a></p>
    <h1 id="lab-h" class="kin kin-sm" data-kin><span class="kin-l1">세 번의 실습,</span> <span class="kin-l2">세 개의 노드</span></h1>
    <p class="safe"><span class="k-dot ion" aria-hidden="true"></span>프롬프트를 복사해 [ ] 자리만 바꿔요. AI에 학생 이름·성적·상담 내용은 넣지 않아요. <a class="pg" href="index.html#deck-p14">교재 14쪽 보기</a></p>
    <nav class="rail" aria-label="실습 진행">
      <a href="#st-s1" data-st-link="s1"><i aria-hidden="true"></i><b>실습 1</b><span>질문 노드</span></a>
      <a href="#st-s2" data-st-link="s2"><i aria-hidden="true"></i><b>실습 2</b><span>증거 노드</span></a>
      <a href="#st-s3" data-st-link="s3"><i aria-hidden="true"></i><b>실습 3</b><span>연결</span></a>
      <p class="rail-c"><span><b class="num" data-st-count>0 / 3</b> 완료</span><progress data-st-progress max="3" value="0">0 / 3</progress></p>
    </nav>
  </div>
</section>

<div class="wrap">
  <!-- 실습 1 -->
  <section class="step" data-lp-step="s1" data-title="실습 1: 질문 노드 · 핵심 질문 만들기" data-minutes="40" aria-labelledby="s1-h">
    <div class="step-grid">
      <div class="step-l">
        <span class="chain" aria-hidden="true"><i class="on"></i><i></i><i></i><i></i><i></i></span>
        <p class="step-k"><span class="num">14:45</span> · 실습 1 · 질문 노드 · 40분 · <a class="pg" href="index.html#deck-p8">교재 8쪽</a></p>
        <h2 id="s1-h" class="step-h">핵심 질문 만들기</h2>
        <p class="done"><b>결과</b>고쳐 쓴 핵심 질문 한 문장</p>
        <ol class="todo">
          <li>가져온 성취기준 하나를 프롬프트의 [성취기준] 자리에 붙여 넣어요.</li>
          <li>AI가 낸 질문 10개를 세 기준으로 걸러요.</li>
          <li>남은 질문 하나를 골라 내 말로 고쳐 써요.</li>
          <li>짝과 바꿔 읽고, 짝의 질문에 첫 답을 달아 봐요.</li>
        </ol>
        <p class="crit"><b>거르는 기준</b>답이 하나로 정해지지 않는가 · 학생이 일상에서 쓰는 낱말인가 · 한 차시 안에 씨름할 수 있는 크기인가</p>
      </div>
      <div class="step-r">
        <figure class="prompt spot">
          <figcaption><span class="p-t">프롬프트 1 · 질문 후보 열 개 뽑기</span><a class="pg" href="index.html#deck-p9">교재 9쪽</a><button type="button" class="copy mag" data-copy-text="너는 [과목] 수업을 함께 설계하는 동료 교사야.
성취기준: [성취기준 원문]
학생: [학년], [우리 반 특징 한 줄]
이 성취기준으로 학생이 한 차시 내내 붙잡고 씨름할 핵심 질문 10개를 만들어 줘.
조건
- 정답이 하나로 정해지지 않는 질문
- 학생의 일상에서 쓰는 낱말로
- 한 문장, 40자 안
- 표로: 질문 / 학생이 처음 내놓을 법한 답 / 이 질문이 여는 개념">복사</button></figcaption>
          <code class="code"><span class="l">너는 <i>[과목]</i> 수업을 함께 설계하는 동료 교사야.</span><span class="l">성취기준: <i>[성취기준 원문]</i></span><span class="l">학생: <i>[학년]</i>, <i>[우리 반 특징 한 줄]</i></span><span class="l">이 성취기준으로 학생이 한 차시 내내 붙잡고 씨름할 핵심 질문 10개를 만들어 줘.</span><span class="l">조건</span><span class="l">- 정답이 하나로 정해지지 않는 질문</span><span class="l">- 학생의 일상에서 쓰는 낱말로</span><span class="l">- 한 문장, 40자 안</span><span class="l">- 표로: 질문 / 학생이 처음 내놓을 법한 답 / 이 질문이 여는 개념</span></code>
        </figure>
        <div class="board" id="board">
          <h3 class="h4">보드 · 다 했으면 핵심 질문을 올려요</h3>
          <div data-lp="board" data-prompt="실습 1의 핵심 질문, 실습 3의 AI 사용 카드를 올려요."></div>
        </div>
      </div>
    </div>
  </section>

  <p class="break"><span class="num">15:25</span>쉬는 시간 10분</p>

  <!-- 실습 2 -->
  <section class="step" data-lp-step="s2" data-title="실습 2: 증거 노드 · 평가 과제와 루브릭" data-minutes="40" aria-labelledby="s2-h">
    <div class="step-grid">
      <div class="step-l">
        <span class="chain" aria-hidden="true"><i></i><i></i><i class="on"></i><i></i><i></i></span>
        <p class="step-k"><span class="num">15:35</span> · 실습 2 · 증거 노드 · 40분 · <a class="pg" href="index.html#deck-p10">교재 10쪽</a></p>
        <h2 id="s2-h" class="step-h">평가 과제와 루브릭</h2>
        <p class="done"><b>결과</b>수행 과제 한 개와 3수준 루브릭 한 장</p>
        <ol class="todo">
          <li>실습 1의 핵심 질문과 목표를 프롬프트에 넣어요.</li>
          <li>AI가 낸 과제가 20분 안에 끝나는 크기인지 봐요.</li>
          <li>점검 프롬프트로 초안의 약점을 묻고 루브릭을 고쳐요.</li>
          <li>[AI 가능] 표시를 보고, 그 부분을 수업에서 어떻게 볼지 정해요.</li>
        </ol>
        <p class="crit"><b>마지막 확인</b>평가 요소 세 개가 모두 목표에서 나왔나 · '보통'과 '잘함'의 차이를 학생이 말할 수 있나 · AI 없이도 이 과제를 해낼 수 있나 · 점수는 내가 매기나</p>
      </div>
      <div class="step-r">
        <figure class="prompt spot">
          <figcaption><span class="p-t">프롬프트 2 · 과제와 루브릭 설계</span><a class="pg" href="index.html#deck-p10">교재 10쪽</a><button type="button" class="copy mag" data-copy-text="아래 핵심 질문과 목표로 수행 과제 하나와 루브릭을 설계해 줘.
핵심 질문: [실습 1에서 고른 질문]
목표: 학생은 [할 수 있게 될 일]
조건
- 수업 시간 안에 20분이면 끝나는 과제
- 루브릭은 잘함·보통·노력 필요 3수준, 평가 요소 3개
- 수준 설명은 학생이 읽고 알아들을 말로
- AI가 대신 해 줄 수 있는 부분이 있으면 [AI 가능]이라고 표시">복사</button></figcaption>
          <code class="code"><span class="l">아래 핵심 질문과 목표로 수행 과제 하나와 루브릭을 설계해 줘.</span><span class="l">핵심 질문: <i>[실습 1에서 고른 질문]</i></span><span class="l">목표: 학생은 <i>[할 수 있게 될 일]</i></span><span class="l">조건</span><span class="l">- 수업 시간 안에 20분이면 끝나는 과제</span><span class="l">- 루브릭은 잘함·보통·노력 필요 3수준, 평가 요소 3개</span><span class="l">- 수준 설명은 학생이 읽고 알아들을 말로</span><span class="l">- AI가 대신 해 줄 수 있는 부분이 있으면 [AI 가능]이라고 표시</span></code>
        </figure>
        <figure class="prompt spot">
          <figcaption><span class="p-t">프롬프트 2-1 · 깐깐한 동료의 눈</span><a class="pg" href="index.html#deck-p11">교재 11쪽</a><button type="button" class="copy mag" data-copy-text="방금 만든 루브릭을 깐깐한 동료 교사의 눈으로 다시 봐 줘.
1. 두 수준의 차이가 흐릿한 칸
2. 학생이 AI 답을 옮겨 써도 '잘함'을 받을 수 있는 칸
3. 목표와 이어지지 않는 평가 요소
세 가지를 찾아 표로 보여 주고, 고친 문장을 제안해 줘.">복사</button></figcaption>
          <code class="code"><span class="l">방금 만든 루브릭을 깐깐한 동료 교사의 눈으로 다시 봐 줘.</span><span class="l">1. 두 수준의 차이가 흐릿한 칸</span><span class="l">2. 학생이 AI 답을 옮겨 써도 '잘함'을 받을 수 있는 칸</span><span class="l">3. 목표와 이어지지 않는 평가 요소</span><span class="l">세 가지를 찾아 표로 보여 주고, 고친 문장을 제안해 줘.</span></code>
        </figure>
      </div>
    </div>
  </section>

  <!-- 실습 3 -->
  <section class="step" data-lp-step="s3" data-title="실습 3: 연결 · AI 사용 카드 만들기" data-minutes="30" aria-labelledby="s3-h">
    <div class="step-grid">
      <div class="step-l">
        <span class="chain link" aria-hidden="true"><i class="on"></i><i class="on"></i><i class="on"></i><i class="on"></i><i class="on"></i></span>
        <p class="step-k"><span class="num">16:15</span> · 실습 3 · 연결 · 30분 · <a class="pg" href="index.html#deck-p12">교재 12쪽</a></p>
        <h2 id="s3-h" class="step-h">AI 사용 카드 만들기</h2>
        <p class="done"><b>결과</b>학생에게 나눠 줄 AI 사용 카드 한 장</p>
        <ol class="todo">
          <li>장면 하나(도입·전개·정리 중)와 역할 하나를 골라요.</li>
          <li>카드에 옮기지 않는 장치와 개인정보 안내가 있는지 봐요.</li>
          <li>보드에 카드를 올리고 다른 선생님 카드 두 장을 읽어요.</li>
        </ol>
        <p class="crit"><b>AI 역할</b>질문 상대 · 반론 제기자 · 피드백 도우미 · 자료 정리자 <a class="pg" href="index.html#deck-p13">예시 카드 교재 13쪽</a></p>
      </div>
      <div class="step-r">
        <figure class="prompt spot">
          <figcaption><span class="p-t">프롬프트 3 · AI 사용 카드 초안</span><a class="pg" href="index.html#deck-p13">교재 13쪽</a><button type="button" class="copy mag" data-copy-text="내 수업에서 학생이 AI를 쓰는 장면을 하나만 설계해 줘.
수업 흐름: 도입 [한 줄] / 전개 [한 줄] / 정리 [한 줄]
AI 역할: [질문 상대·반론 제기자·피드백 도우미·자료 정리자 중 하나]
조건
- 학생이 AI에게 보낼 첫 문장 예시 하나
- AI 답을 그대로 옮기지 못하게 하는 장치 하나
- &quot;이름·학교·연락처는 넣지 않아요&quot; 안내 한 줄
학생에게 나눠 줄 'AI 사용 카드'를 5줄로 만들어 줘.">복사</button></figcaption>
          <code class="code"><span class="l">내 수업에서 학생이 AI를 쓰는 장면을 하나만 설계해 줘.</span><span class="l">수업 흐름: 도입 <i>[한 줄]</i> / 전개 <i>[한 줄]</i> / 정리 <i>[한 줄]</i></span><span class="l">AI 역할: <i>[질문 상대·반론 제기자·피드백 도우미·자료 정리자 중 하나]</i></span><span class="l">조건</span><span class="l">- 학생이 AI에게 보낼 첫 문장 예시 하나</span><span class="l">- AI 답을 그대로 옮기지 못하게 하는 장치 하나</span><span class="l">- "이름·학교·연락처는 넣지 않아요" 안내 한 줄</span><span class="l">학생에게 나눠 줄 'AI 사용 카드'를 5줄로 만들어 줘.</span></code>
        </figure>
        <p class="next"><a class="pg" href="#board">보드에 올리기</a></p>
      </div>
    </div>
  </section>

  <nav class="after-lab" aria-label="실습 다음">
    <p><span class="num">16:45</span> 다음 순서는 확인 문제와 만족도 조사예요.</p>
    <a class="btn btn-ember mag" href="index.html#join"><span class="btn-t">확인 문제로</span><svg class="ic" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11M11 5l5 5-5 5"/></svg></a>
  </nav>
</div>
</main>

<footer class="foot">
  <div class="wrap foot-in">
    <p class="foot-b"><svg class="glyph" viewBox="0 0 30 20" aria-hidden="true"><path d="M5 10 C 12 10, 14 4, 24 4 M5 10 C 12 10, 14 16, 24 16" fill="none" stroke="#52d9ff" stroke-width="1.4" stroke-dasharray="2.4 2.4"/><circle cx="5" cy="10" r="3.6" fill="#ff6a3d"/><circle cx="24.5" cy="4" r="2.6" fill="#05060a" stroke="#a8ecff" stroke-width="1.4"/><circle cx="24.5" cy="16" r="2.6" fill="#05060a" stroke="#a8ecff" stroke-width="1.4"/></svg>질문이 먼저, AI는 그다음</p>
    <p class="foot-l"><a href="index.html">첫 화면</a><a href="files/실습프롬프트모음.txt" download>프롬프트 모음 받기</a><a href="privacy.html">개인정보 안내</a></p>
    <p class="foot-s">예시용 가상 연수예요. 기관·강사·연락처는 실제가 아니에요.</p>
  </div>
</footer>
</body>
</html>
`,p=n=>n==="index.html"?0:/\.html?$/i.test(n)?1:/\.css$/i.test(n)?2:3;function b({files:n,html:t,css:c,js:s="",meta:d={}}){const r=n?{...n}:{"index.html":t,"assets/style.css":c,...s?{"assets/site.js":s}:{}},o=(e,i)=>"```"+e+`
`+String(i).replace(/\s+$/,"")+"\n```",f=()=>{const{v:e,...i}=d;return[...Object.keys(r).filter(a=>/\.(html?|css|m?js)$/i.test(a)&&r[a]!=null).sort((a,l)=>p(a)-p(l)||a.localeCompare(l)).map(a=>o(a,r[a])),o("lecpage.json",JSON.stringify(i,null,1))].join(`

`)};return(e={})=>e.name==="build"?f():""}const v=""+new URL("neo-teach-DF4J-lB1.pdf",import.meta.url).href,w=Object.assign({"../../../skills/lecpage/references/designs/neo-teach/site/assets/site.js":m,"../../../skills/lecpage/references/designs/neo-teach/site/assets/style.css":h,"../../../skills/lecpage/references/designs/neo-teach/site/index.html":u,"../../../skills/lecpage/references/designs/neo-teach/site/lab.html":x}),k=Object.fromEntries(Object.entries(w).map(([n,t])=>[n.replace(/^.*\/neo-teach\/site\//,""),t])),A={name:"질문이 먼저, AI는 그다음_교재.pdf",url:v},I={build:7},P=b({files:k,meta:g});export{A as DEMO_FILE,I as DEMO_PACE,P as demoAnswer};
