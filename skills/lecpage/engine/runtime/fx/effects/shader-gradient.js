/* shader-gradient — WebGL 조각 셰이더로 만든 흐르는 잡음 그라데이션(도메인 워핑 + 미세 그레인). three.js 없음
   절반 해상도·초당 30회로 그리고, WebGL이 없거나 동작 줄이기면 같은 색의 CSS 그라데이션으로 대신한다 */
LecFX.define('shader-gradient', {
  level: 3,
  loop: true,
  init: function (el, o, ctx) {
    var ly = ctx.layer(el);
    var css = function () { ly.classList.add('fx-shader--css'); };
    if (ctx.reduced && o.cssWhenReduced !== false) { css(); return; }
    var cv = ctx.canvas(ly, { gl: true, scale: o.scale || 0.5 }), gl = cv.g;
    if (!gl) { cv.el.remove(); css(); return; }
    var VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
    var FS = 'precision mediump float;uniform vec2 r;uniform float t;uniform vec3 c0,c1,c2,c3,bg;uniform float veil;' +
      'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}' +
      'float n(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1.,0.)),u.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),u.x),u.y);}' +
      'float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}' +
      'void main(){vec2 uv=gl_FragCoord.xy/r;vec2 p=uv*vec2(r.x/r.y,1.)*1.5;float T=t*.05;' +
      'vec2 q=vec2(fbm(p+vec2(T,-T*.6)),fbm(p+vec2(5.2,1.3)-T));float f=fbm(p+2.4*q+vec2(T*.7,-T*.4));' +
      'vec3 col=mix(c0,c1,smoothstep(.2,.8,f));col=mix(col,c2,smoothstep(.45,.95,q.x)*.85);col=mix(col,c3,smoothstep(.5,1.,q.y)*.6);' +
      'col=mix(col,bg,veil*(1.-uv.y*.35));col+=(h(gl_FragCoord.xy+fract(t))-.5)*.03;gl_FragColor=vec4(col,1.);}';
    var sh = function (type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
    var vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS), pr = gl.createProgram();
    if (!vs || !fs) { cv.el.remove(); css(); return; }
    gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { cv.el.remove(); css(); return; }
    gl.useProgram(pr);
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(pr, 'p');
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var U = {}; ['r', 't', 'c0', 'c1', 'c2', 'c3', 'bg', 'veil'].forEach(function (k) { U[k] = gl.getUniformLocation(pr, k); });
    var col = function (name) { var c = ctx.rgb(name, el); return [c[0] / 255, c[1] / 255, c[2] / 255]; };
    var colors = function () {
      var bg = col('background'), p = col('primary');
      gl.uniform3fv(U.c0, bg.map(function (v, i) { return v * 0.55 + p[i] * 0.45; }));
      gl.uniform3fv(U.c1, p); gl.uniform3fv(U.c2, col('accent')); gl.uniform3fv(U.c3, col('accent-2')); gl.uniform3fv(U.bg, bg);
      gl.uniform1f(U.veil, o.veil == null ? 0.28 : +o.veil);
    };
    colors();
    var lost = false;
    ctx.on(cv.el, 'webglcontextlost', function (e) { e.preventDefault(); lost = true; cv.el.remove(); css(); });
    var loop = ctx.loop(ly, function (t) {
      if (lost) return;
      gl.viewport(0, 0, cv.el.width, cv.el.height);
      gl.uniform2f(U.r, cv.el.width, cv.el.height);
      gl.uniform1f(U.t, t);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }, { fps: 30, t: 14 });
    cv.onResize = function () { loop.redraw(); };
    ctx.onTheme(function () { if (!lost) { colors(); loop.redraw(); } });
  }
});
