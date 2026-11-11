/* LecFX 견본 — 첫 줄에서 실행(깜빡임 방지). 주소 값을 <html>에 옮깁니다.
 *   demo.html?theme=dark&motion=2&lowpower=0          견본 전체(설정 복원)
 *   demo.html?fx=<id>&embed=1[&theme=light|dark|auto] 효과 하나만 화면 가득(앱 갤러리의 작은 미리보기) — embed.js가 그립니다
 */
(function () {
  var q = new URLSearchParams(location.search), h = document.documentElement;
  var embed = q.get('embed') === '1';
  var theme = q.get('theme');
  if (theme === 'auto') theme = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  if (theme === 'light' || theme === 'dark') h.setAttribute('data-theme', theme);
  if (/^[0-3]$/.test(q.get('motion') || '')) h.setAttribute('data-motion', q.get('motion'));
  if (/^[01]$/.test(q.get('lowpower') || '')) h.setAttribute('data-fx-lowpower', q.get('lowpower'));
  if (embed) {
    h.classList.add('fx-embed');
    h.setAttribute('data-motion', '3');       // 미리보기는 효과가 제 단계에서 돌게(작은 틀 하나라 부담이 작음)
    h.setAttribute('data-fx-lowpower', '0');
    h.setAttribute('data-fx-toggle', 'off');  // 멈춤 버튼은 만들지 않음(틀 안이 좁음). 동작 줄이기 설정은 그대로 따름
    h.setAttribute('data-fx-autostart', 'off');
    window.__lecfxEmbed = { id: (q.get('fx') || '').replace(/[^a-z0-9-]/g, '').slice(0, 40) };
  } else {
    h.classList.add('fx-boot'); setTimeout(function () { h.classList.remove('fx-boot'); }, 2500);
  }
})();
