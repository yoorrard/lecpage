// 신고 화면: 주소의 ?site= 값을 채우고, /api/report로 보냅니다.
(function () {
  'use strict';
  var form = document.querySelector('[data-report]');
  if (!form) return;
  var status = form.querySelector('[data-status]');
  var button = form.querySelector('button');
  var say = function (text, kind) { status.textContent = text; status.dataset.kind = kind || ''; };

  var site = new URLSearchParams(location.search).get('site') || '';
  if (/^[0-9a-z]{10}$/.test(site)) form.site.value = location.origin + '/s/' + site + '/';
  else if (site) form.site.value = site.slice(0, 300);

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var body = { site: form.site.value.trim(), reason: form.reason.value.trim(), contact: form.contact.value.trim() };
    if (!body.site) { say('사이트 주소를 넣어 주세요.', 'error'); form.site.focus(); return; }
    if (!body.reason) { say('신고하는 까닭을 적어 주세요.', 'error'); form.reason.focus(); return; }
    button.disabled = true; say('보내는 중…');
    fetch('/api/report', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (res.ok) { form.reason.value = ''; say('신고를 받았습니다. 확인한 뒤 조치하겠습니다.'); }
        else say((res.j.error && res.j.error.message_ko) || '보내지 못했어요. 잠시 뒤에 다시 해 주세요.', 'error');
      })
      .catch(function () { say('보내지 못했어요. 인터넷을 확인하고 다시 해 주세요.', 'error'); })
      .then(function () { button.disabled = false; });
  });
})();
