// 누리봄중학교 신입생 학부모 설명회 — 글자 크기, '지금' 순서, 차례 표시, 입학 준비 체크
(function () {
  'use strict';
  var root = document.documentElement;
  var store = {
    get: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* 저장이 막혀도 화면은 그대로 */ } },
  };

  // ── 글자 크게(이 기기에 기억) ──────────────────────
  var tsize = document.querySelector('[data-tsize]');
  function setBig(on) {
    root.classList.toggle('is-big', on);
    if (tsize) tsize.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  setBig(root.classList.contains('is-big'));
  if (tsize) tsize.addEventListener('click', function () {
    var on = !root.classList.contains('is-big');
    setBig(on);
    store.set('nuribom-big', on ? '1' : '0');
  });

  // ── '지금' 순서: 설명회 날짜와 순서표 시간으로 ────────────
  // 시험용: ?now=19:42 (설명회 날 그 시각) 또는 ?now=2027-02-19T09:00
  var nowBox = document.querySelector('[data-brief]');
  var agenda = Array.prototype.slice.call(document.querySelectorAll('[data-agenda] li'));
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function mins(hhmm) { var p = String(hhmm).split(':'); return (+p[0]) * 60 + (+p[1]); }
  function clock() {
    var q = (location.search.match(/[?&]now=([^&]+)/) || [])[1];
    var d = new Date();
    if (q) {
      q = decodeURIComponent(q);
      if (/^\d{1,2}:\d{2}$/.test(q)) return { day: nowBox ? nowBox.getAttribute('data-day') : '', t: mins(q) };
      var m = q.match(/^(\d{4}-\d{2}-\d{2})T(\d{1,2}:\d{2})$/);
      if (m) return { day: m[1], t: mins(m[2]) };
    }
    return { day: d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()), t: d.getHours() * 60 + d.getMinutes() };
  }
  function paintNow() {
    if (!nowBox) return;
    var day = nowBox.getAttribute('data-day');
    var c = clock();
    var tag = nowBox.querySelector('[data-brief-tag]');
    var text = nowBox.querySelector('[data-brief-text]');
    var go = nowBox.querySelector('[data-brief-go]');
    var first = agenda.length ? mins(agenda[0].getAttribute('data-from')) : 0;
    var last = agenda.length ? mins(agenda[agenda.length - 1].getAttribute('data-to')) : 0;
    var live = false, current = null;
    agenda.forEach(function (li) { li.classList.remove('is-now', 'is-past'); li.removeAttribute('aria-current'); });
    go.hidden = true;

    if (c.day < day) {
      tag.textContent = '안내';
      text.textContent = '2월 18일(목) 저녁 7시에 시작해요.';
    } else if (c.day === day && c.t < first) {
      tag.textContent = '오늘';
      text.textContent = '오늘 저녁 7시, 본관 2층 누리홀에서 시작해요.';
    } else if (c.day === day && c.t < last) {
      live = true;
      agenda.forEach(function (li) {
        var a = mins(li.getAttribute('data-from')), b = mins(li.getAttribute('data-to'));
        if (c.t >= a && c.t < b) current = li;
        else if (c.t >= b) li.classList.add('is-past');
      });
      tag.textContent = '지금';
      if (current) {
        current.classList.add('is-now');
        current.setAttribute('aria-current', 'time');
        var title = current.querySelector('b').textContent.replace(/^\d+\.\s*/, '');
        text.textContent = title + ' · ' + current.getAttribute('data-to') + '까지';
        var target = current.getAttribute('data-go');
        if (target) {
          go.href = '#' + target;
          go.textContent = target === 'ask' ? '질문 남기기' : '이 내용 보기';
          go.hidden = false;
        }
      }
    } else {
      tag.textContent = '끝';
      text.textContent = '설명회가 끝났어요. 자료와 자주 묻는 질문은 여기서 다시 볼 수 있어요.';
      go.href = '#slides';
      go.textContent = '자료 보기';
      go.hidden = false;
    }
    nowBox.classList.toggle('is-live', live);
  }
  paintNow();
  window.setInterval(paintNow, 30000);

  // ── 차례: 지금 읽는 장 표시 ─────────────────────────
  var links = Array.prototype.slice.call(document.querySelectorAll('.toc [data-toc-for]'));
  var secs = Array.prototype.slice.call(document.querySelectorAll('main .sec[id]'));
  if ('IntersectionObserver' in window && links.length && secs.length) {
    var mark = function (id) {
      links.forEach(function (a) {
        var hit = (' ' + a.getAttribute('data-toc-for') + ' ').indexOf(' ' + id + ' ') !== -1;
        if (hit) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      });
    };
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) mark(e.target.id); });
    }, { rootMargin: '-25% 0px -65% 0px' });
    secs.forEach(function (s) { io.observe(s); });
  }

  // ── 입학 준비: 끝낸 일 표시(이 기기에만) ──────────────
  var boxes = Array.prototype.slice.call(document.querySelectorAll('[data-todo-id]'));
  var done = {};
  try { done = JSON.parse(store.get('nuribom-todo') || '{}') || {}; } catch (e) { done = {}; }
  boxes.forEach(function (b) {
    var id = b.getAttribute('data-todo-id');
    b.checked = !!done[id];
    b.addEventListener('change', function () {
      done[id] = b.checked;
      store.set('nuribom-todo', JSON.stringify(done));
    });
  });
})();
