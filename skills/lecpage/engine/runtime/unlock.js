/*! lecpage unlock — 암호로 잠근 연수 사이트를 브라우저 안에서 엽니다(PBKDF2-SHA256 + AES-GCM, StatiCrypt 방식).
 * 1) 잠금 화면: 암호(또는 주소의 #k=암호, 기억한 열쇠)로 페이지를 풀어 그 자리에 다시 씁니다.
 * 2) 풀린 페이지: 잠긴 교재 그림·자료(*.enc)를 받아 풀고 화면에 붙입니다.
 * 열쇠는 이 탭(sessionStorage)에만, '기억하기'를 고르면 이 기기(localStorage)에도 둡니다. 암호 원문은 저장하지 않습니다.
 */
(function () {
  'use strict';
  var doc = document, subtle = window.crypto && window.crypto.subtle;
  var lockedEl = doc.getElementById('lp-locked');
  var MIME = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', pdf: 'application/pdf', mp3: 'audio/mpeg', mp4: 'video/mp4', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', hwpx: 'application/haansofthwpx', zip: 'application/zip' };

  function fromB64(s) { var bin = atob(s), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
  function toB64(u8) { var s = ''; for (var i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
  function store(kind) { try { return window[kind]; } catch (e) { return null; } }
  function getSaved(salt) { var k = 'lp-key:' + salt, s = store('sessionStorage'), l = store('localStorage'); try { return (s && s.getItem(k)) || (l && l.getItem(k)) || ''; } catch (e) { return ''; } }
  function saveKey(salt, raw, remember) {
    var k = 'lp-key:' + salt, v = toB64(raw), s = store('sessionStorage'), l = store('localStorage');
    try { if (s) s.setItem(k, v); } catch (e) { }
    try { if (l) { if (remember) l.setItem(k, v); } } catch (e) { }
  }
  function forget(salt) { var k = 'lp-key:' + salt; try { store('sessionStorage').removeItem(k); } catch (e) { } try { store('localStorage').removeItem(k); } catch (e) { } }
  function importRaw(raw) { return subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['decrypt']); }
  function derive(pw, salt, iter) {
    return subtle.importKey('raw', new TextEncoder().encode(pw.normalize ? pw.normalize('NFC') : pw), 'PBKDF2', false, ['deriveKey'])
      .then(function (base) { return subtle.deriveKey({ name: 'PBKDF2', salt: fromB64(salt), iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, true, ['decrypt']); })
      .then(function (key) { return subtle.exportKey('raw', key).then(function (raw) { return { key: key, raw: new Uint8Array(raw) }; }); });
  }
  function decrypt(key, bytes) { return subtle.decrypt({ name: 'AES-GCM', iv: bytes.subarray(0, 12) }, key, bytes.subarray(12)); }

  // ── 1) 잠금 화면 ──────────────────────────────────────────────
  if (lockedEl) {
    var P = JSON.parse(lockedEl.textContent || '{}');
    var form = doc.querySelector('[data-lp-lock]'), msg = doc.querySelector('[data-lp-lock-msg]');
    var say = function (t) { if (msg) msg.textContent = t; };
    if (!subtle) { say('이 브라우저(또는 http 주소)에서는 열 수 없어요. https 주소로 열어 주세요.'); return; }
    var blob = fromB64(P.data);
    var open = function (key, raw, remember) {
      return decrypt(key, blob).then(function (buf) {
        saveKey(P.salt, raw, remember);
        var html = new TextDecoder().decode(buf);
        // 풀린 글은 서버가 살펴볼 수 없으므로 여기서 한 번 더 거름: 다른 곳으로 넘기는 meta refresh와 base는 뺌(스크립트는 CSP가 막음)
        html = html.replace(/<meta\b[^>]*http-equiv\s*=\s*["']?refresh[^>]*>/gi, '').replace(/<base\b[^>]*>/gi, '');
        doc.open(); doc.write(html); doc.close();
      });
    };
    var tryPassword = function (pw, remember) {
      say('여는 중…');
      var btn = form && form.querySelector('button'); if (btn) btn.disabled = true;
      return derive(pw, P.salt, P.iter).then(function (r) { return open(r.key, r.raw, remember); })
        .catch(function () { say('암호가 맞지 않아요. 다시 넣어 주세요.'); if (btn) btn.disabled = false; var i = form && form.querySelector('input[type=password]'); if (i) { i.select(); i.focus(); } });
    };
    // 주소의 #k=암호 → 바로 열고 주소에서 지움(화면 공유·전달 때 새지 않게)
    var m = /(?:^#|&)k=([^&]+)/.exec(location.hash || '');
    var fromUrl = m ? decodeURIComponent(m[1]) : '';
    if (fromUrl) { try { var h = location.hash.replace(/(^#|&)k=[^&]*/, '$1').replace(/^#&/, '#'); history.replaceState(null, '', location.pathname + location.search + (h === '#' ? '' : h)); } catch (e) { } }
    var saved = getSaved(P.salt);
    var start = saved
      ? importRaw(fromB64(saved)).then(function (key) { return open(key, fromB64(saved), !!(store('localStorage') && store('localStorage').getItem('lp-key:' + P.salt))); }).catch(function () { forget(P.salt); if (fromUrl) return tryPassword(fromUrl, false); })
      : (fromUrl ? tryPassword(fromUrl, false) : Promise.resolve());
    start.then(function () { var i = form && form.querySelector('input[type=password]'); if (i && doc.contains(i)) i.focus(); });
    if (form) form.addEventListener('submit', function (e) {
      e.preventDefault();
      var pw = (form.querySelector('input[type=password]').value || '');
      if (!pw) return say('암호를 넣어 주세요.');
      tryPassword(pw, !!(form.querySelector('[name=remember]') || {}).checked);
    });
    return;
  }

  // ── 2) 풀린 페이지: 잠긴 그림·자료 채우기 ─────────────────────────
  var nodes = Array.prototype.slice.call(doc.querySelectorAll('[data-lp-enc-src],[data-lp-enc-href]'));
  if (!nodes.length || !subtle) return;
  var tag = doc.querySelector('script[data-lp-assets]');
  var saltKey = tag ? getSaved(tag.getAttribute('data-lp-assets')) : '';
  if (!saltKey) return;
  importRaw(fromB64(saltKey)).then(function (key) {
    var queue = nodes.slice(), running = 0, cache = {};
    function mime(path) { var ext = (path.replace(/\.enc$/, '').split('.').pop() || '').toLowerCase(); return MIME[ext] || 'application/octet-stream'; }
    function load(path) {
      if (!cache[path]) cache[path] = fetch(path, { credentials: 'same-origin' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
        .then(function (buf) { return decrypt(key, new Uint8Array(buf)); })
        .then(function (plain) { return URL.createObjectURL(new Blob([plain], { type: mime(path) })); });
      return cache[path];
    }
    function next() {
      while (running < 4 && queue.length) {
        var n = queue.shift(); running++;
        (function (n) {
          var src = n.getAttribute('data-lp-enc-src'), href = n.getAttribute('data-lp-enc-href');
          load(src || href).then(function (url) {
            if (src) { n.src = url; n.removeAttribute('data-lp-enc-src'); }
            else { n.href = url; n.removeAttribute('data-lp-enc-href'); if (!n.hasAttribute('download')) n.setAttribute('download', href.split('/').pop().replace(/\.enc$/, '')); n.removeAttribute('target'); }
          }).catch(function () { if (src) n.alt = (n.alt || '') + ' (불러오지 못했어요)'; }).then(function () { running--; next(); });
        })(n);
      }
    }
    // 지금 보이는 그림부터
    queue.sort(function (a, b) { var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); var va = ra.width > 0 ? Math.abs(ra.top) : 1e9, vb = rb.width > 0 ? Math.abs(rb.top) : 1e9; return va - vb; });
    next();
  }).catch(function () { });

  // 링크·QR에 붙여 쓰는 도우미(암호 원문은 모르므로 #k를 만들지 않음)
  window.LecUnlock = { locked: true };
})();
