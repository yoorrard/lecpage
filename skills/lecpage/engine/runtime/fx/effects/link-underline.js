/* link-underline — 링크 밑줄이 마우스·포커스에서 왼쪽부터 굵게 차오른다. 쉬는 상태에도 밑줄은 있다(링크 구분) */
LecFX.define('link-underline', {
  level: 1,
  init: function (el) {
    el.classList.add('fx-link-underline');
    return function () { el.classList.remove('fx-link-underline'); };
  }
});
