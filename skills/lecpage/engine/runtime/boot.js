/* lecpage boot: 첫 그리기 전에 테마·움직임 설정을 적용합니다. */
(function () {
  var d = document.documentElement;
  d.classList.add('js');
  try {
    var t = localStorage.getItem('lp-theme');
    if (t === 'light' || t === 'dark') d.setAttribute('data-theme', t);
    if (localStorage.getItem('lp-motion-paused') === '1') d.classList.add('lp-paused');
  } catch (e) { /* 저장소를 못 쓰는 환경 */ }
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) d.classList.add('lp-reduced');
  // 바깥 글꼴 스타일시트(media="print"로 받는 중)를 다 받으면 화면에도 씀. 글꼴 서버가 막혀도 첫 화면은 기본 글꼴로 바로 뜸
  var fl = document.querySelectorAll('link[data-lp-font]');
  for (var i = 0; i < fl.length; i++) (function (l) { if (l.sheet) l.media = 'all'; else l.addEventListener('load', function () { l.media = 'all'; }); })(fl[i]);
})();
