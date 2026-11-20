// 누리봄중학교 신입생 학부모 설명회 — 글자 크게, '지금' 순서와 그 자료 쪽, 입학 전 챙길 것 표시
(function () {
  'use strict';
  var root = document.documentElement;
  var store = {
    get: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* 저장이 막혀도 화면은 그대로 */ } },
  };

  // ── 글자 크게(이 기기에 기억, 그리기 전 적용은 pre.js) ──
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

  // ── '지금': 설명회 날짜·순서표 시간으로 지금 순서와 그 자료 쪽 ──
  // 시험용 주소: ?now=19:42(설명회 날 그 시각) · ?now=2027-02-19T09:00
  var box = document.querySelector('[data-brief]');
  var rows = Array.prototype.slice.call(document.querySelectorAll('[data-agenda] li'));
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function mins(s) { var p = String(s).split(':'); return (+p[0]) * 60 + (+p[1]); }
  function clock() {
    var q = (location.search.match(/[?&]now=([^&]+)/) || [])[1];
    if (q) {
      q = decodeURIComponent(q);
      if (/^\d{1,2}:\d{2}$/.test(q)) return { day: box.getAttribute('data-day'), t: mins(q) };
      var m = q.match(/^(\d{4}-\d{2}-\d{2})T(\d{1,2}:\d{2})$/);
      if (m) return { day: m[1], t: mins(m[2]) };
    }
    var d = new Date();
    return { day: d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()), t: d.getHours() * 60 + d.getMinutes() };
  }
  function paint() {
    if (!box || !rows.length) return;
    var day = box.getAttribute('data-day'), c = clock();
    var tag = box.querySelector('[data-brief-tag]'), text = box.querySelector('[data-brief-text]'), go = box.querySelector('[data-brief-go]');
    var first = mins(rows[0].getAttribute('data-from')), last = mins(rows[rows.length - 1].getAttribute('data-to'));
    var cur = null, live = false;
    rows.forEach(function (li) { li.classList.remove('is-now', 'is-past'); li.removeAttribute('aria-current'); });
    go.hidden = true;
    if (c.day < day) {
      tag.textContent = '안내';
      text.textContent = '2월 18일(목) 저녁 7시에 시작해요.';
    } else if (c.day === day && c.t < first) {
      tag.textContent = '오늘';
      text.textContent = '오늘 저녁 7시, 본관 2층 누리홀에서 시작해요.';
    } else if (c.day === day && c.t < last) {
      live = true;
      rows.forEach(function (li) {
        var a = mins(li.getAttribute('data-from')), b = mins(li.getAttribute('data-to'));
        if (c.t >= a && c.t < b) cur = li; else if (c.t >= b) li.classList.add('is-past');
      });
      tag.textContent = '지금';
      if (cur) {
        cur.classList.add('is-now');
        cur.setAttribute('aria-current', 'time');
        text.textContent = cur.querySelector('strong').textContent + ' · ' + cur.getAttribute('data-to') + '까지';
        if (cur.hasAttribute('data-ask')) { go.href = '#ask'; go.textContent = '질문 남기기'; }
        else { go.href = '#deck-p' + cur.getAttribute('data-page'); go.textContent = '자료 ' + cur.getAttribute('data-page') + '쪽부터 보기'; }
        go.hidden = false;
      }
    } else {
      tag.textContent = '끝';
      text.textContent = '설명회가 끝났어요. 입학 전 챙길 날짜와 자료는 여기 그대로 있어요.';
      go.href = '#ready';
      go.textContent = '챙길 것 보기';
      go.hidden = false;
    }
    box.classList.toggle('is-live', live);
  }
  paint();
  window.setInterval(paint, 30000);

  // ── 입학 전 챙길 것: 끝낸 일 표시(이 기기에만) ──
  var done = {};
  try { done = JSON.parse(store.get('nuribom-todo') || '{}') || {}; } catch (e) { done = {}; }
  Array.prototype.forEach.call(document.querySelectorAll('[data-todo-id]'), function (b) {
    var id = b.getAttribute('data-todo-id');
    b.checked = !!done[id];
    b.addEventListener('change', function () { done[id] = b.checked; store.set('nuribom-todo', JSON.stringify(done)); });
  });
})();
