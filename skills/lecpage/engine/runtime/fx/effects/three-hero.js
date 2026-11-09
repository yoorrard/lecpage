/* three-hero — OGL(작은 WebGL 라이브러리, Unlicense)로 만든 점 구름 구체. 천천히 돌고 표면이 숨 쉬며 포인터 쪽으로 기운다
   OGL은 jsDelivr +esm 번들(버전 고정)로 지연 로드. 동작 줄이기·저사양·실패면 CSS 구가 그대로 남는다 */
LecFX.define('three-hero', {
  level: 3,
  loop: true,
  libs: ['https://cdn.jsdelivr.net/npm/ogl@1.0.11/+esm'],
  init: function (el, o, ctx) {
    var ly = ctx.layer(el);
    ly.classList.add('fx-three--css');
    if (o.align) ly.setAttribute('data-align', o.align);
    if (ctx.reduced || ctx.lowPower) return;
    var dead = false, px = 0, py = 0;
    ctx.esm(this.libs[0]).then(function (M) {
      if (dead || !M || !M.Renderer) return;
      try { build(M); } catch (e) { /* CSS 구 유지 */ }
    });
    var build = function (M) {
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      var renderer = new M.Renderer({ dpr: dpr, alpha: true, antialias: true, powerPreference: 'low-power' });
      var gl = renderer.gl;
      gl.clearColor(0, 0, 0, 0);
      gl.canvas.className = 'fx-canvas';
      gl.canvas.setAttribute('aria-hidden', 'true');
      var camera = new M.Camera(gl, { fov: 35 });
      camera.position.z = 6.2;
      var scene = new M.Transform();
      var N = o.count || 2400, pos = new Float32Array(N * 3), rnd = new Float32Array(N);
      for (var i = 0; i < N; i++) {
        var y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = i * 2.399963;
        pos[i * 3] = Math.cos(th) * r; pos[i * 3 + 1] = y; pos[i * 3 + 2] = Math.sin(th) * r; rnd[i] = Math.random();
      }
      var col = function (n) { var c = ctx.rgb(n, el); return [c[0] / 255, c[1] / 255, c[2] / 255]; };
      var program = new M.Program(gl, {
        vertex: 'attribute vec3 position;attribute float random;uniform mat4 modelViewMatrix;uniform mat4 projectionMatrix;uniform float uTime;uniform float uSize;varying float vR;varying float vY;' +
          'void main(){vec3 p=position;float w=sin(p.y*4.+uTime*.9+random*2.)*cos(p.x*3.+uTime*.6);p*=1.+.11*w+.03*sin(uTime*1.7+random*6.28);' +
          'vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=uSize*(.55+random*.9)/-mv.z;vR=random;vY=p.y;}',
        fragment: 'precision mediump float;uniform vec3 uC1;uniform vec3 uC2;varying float vR;varying float vY;' +
          'void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,.08,d);gl_FragColor=vec4(mix(uC1,uC2,clamp(vY*.5+.5+vR*.2-.1,0.,1.)),a*(.45+vR*.5));}',
        uniforms: { uTime: { value: 0 }, uSize: { value: 18 * dpr }, uC1: { value: col('primary') }, uC2: { value: col('accent') } },
        transparent: true, depthTest: false
      });
      var geo = new M.Geometry(gl, { position: { size: 3, data: pos }, random: { size: 1, data: rnd } });
      var mesh = new M.Mesh(gl, { mode: gl.POINTS, geometry: geo, program: program });
      mesh.setParent(scene);
      ly.appendChild(gl.canvas);
      var size = function () {
        var w = ly.clientWidth || 1, h = ly.clientHeight || 1;
        renderer.setSize(w, h);
        camera.perspective({ aspect: w / h });
        var side = ly.getAttribute('data-align') || 'right';
        mesh.position.x = w / h > 1.15 && side !== 'center' ? (side === 'left' ? -1.5 : 1.5) : 0;
        mesh.position.y = w / h > 1.15 ? 0 : -0.35;
      };
      size();
      var ro = 'ResizeObserver' in window ? new ResizeObserver(function () { size(); loop.redraw(); }) : null;
      if (ro) ro.observe(ly);
      var rx = 0, ry = 0;
      var loop = ctx.loop(ly, function (t) {
        rx += (py * 0.35 - rx) * 0.05; ry += (px * 0.5 - ry) * 0.05;
        program.uniforms.uTime.value = t;
        mesh.rotation.y = t * 0.12 + ry; mesh.rotation.x = 0.25 + rx;
        renderer.render({ scene: scene, camera: camera });
      }, { t: 3 });
      ly.classList.remove('fx-three--css');
      ly.classList.add('fx-three--gl');
      ctx.onTheme(function () { program.uniforms.uC1.value = col('primary'); program.uniforms.uC2.value = col('accent'); loop.redraw(); });
      if (ctx.fine) ctx.on(el, 'pointermove', function (e) { var r = el.getBoundingClientRect(); px = (e.clientX - r.left) / r.width - 0.5; py = (e.clientY - r.top) / r.height - 0.5; });
      ctx.cleanup(function () { if (ro) ro.disconnect(); var ext = gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext(); gl.canvas.remove(); });
    };
    return function () { dead = true; };
  }
});
