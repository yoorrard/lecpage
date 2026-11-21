/* lecpage boot: 첫 그리기 전에 테마·움직임 설정을 적용합니다. */
(function () {
  var d = document.documentElement;
  d.classList.add('js');
  try {
    var t = localStorage.getItem('lp-theme');
    if (t === 'light' || t === 'dark') d.setAttribute('data-theme', t);
    if (localStorage.getItem('lp-motion-paused') === '1') d.classList.add('lp-paused');
  } catch (e) { /* 저장소를 못 쓰는 환경 */ }
  var reduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (reduced) d.classList.add('lp-reduced');
  // 바깥 글꼴 스타일시트(media="print"로 받는 중)를 다 받으면 화면에도 씀. 글꼴 서버가 막혀도 첫 화면은 기본 글꼴로 바로 뜸
  var fl = document.querySelectorAll('link[data-lp-font]');
  for (var i = 0; i < fl.length; i++) (function (l) { if (l.sheet) l.media = 'all'; else l.addEventListener('load', function () { l.media = 'all'; }); })(fl[i]);
  /* 등장 효과의 깜빡임 방지: 효과 스크립트(fx.js, defer)가 늦게 오면 제목이 다 보였다가 사라진 뒤 다시 들어와 튐.
     움직임이 켜진 사이트는 효과가 시작할 때까지(최대 3초) 등장 효과 대상만 숨겨 둠(fx.css html.fx-boot, core.js start가 걷어 냄) */
  if (d.hasAttribute('data-rest') && +d.getAttribute('data-motion') > 0 && !reduced) { // 참가자 화면(강사·발표 화면은 효과 스크립트를 싣지 않음)
    d.classList.add('fx-boot');
    setTimeout(function () { d.classList.remove('fx-boot'); }, 3000);
  }
})();
