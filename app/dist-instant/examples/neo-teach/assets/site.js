/* 질문이 먼저, AI는 그다음 — 사이트 움직임
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
      var parts = t.nodeValue.split(/(\s+)/), frag = d.createDocumentFragment();
      parts.forEach(function (p) {
        if (!p) return;
        if (/^\s+$/.test(p)) { frag.appendChild(d.createTextNode(p)); return; }
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
    h.setAttribute('aria-label', h.textContent.replace(/\s+/g, ' ').trim());
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
