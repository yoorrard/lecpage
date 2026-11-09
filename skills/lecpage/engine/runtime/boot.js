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
})();
