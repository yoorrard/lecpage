// 쪽이 많은 교재(쪽 그림 합계가 미리보기 한 장 HTML의 한도 8MB를 넘음): 뒤쪽 쪽 그림이 미리보기에서 깨지지 않고,
// 그려서 검사가 "그림이 열리지 않아요(material/p-NNN.webp)"를 꼭 고칠 곳으로 알리지 않음(사이트 파일에는 그림이 다 있음).
// 예전: 124쪽 PPT에서 "꼭 고칠 곳 16곳 · 그림이 열리지 않아요(material/p-113.webp) 외 15곳"(폭 둘 × 8곳), 미리보기의 뒤쪽 쪽이 깨짐.
// 고친 길: 한 장 HTML에 못 담은 그림은 틀 안 문서에 Blob으로 따로 넘김(app/src/lib/late-files.js, 엔진 previewHtml의 skipped).
//   BASE=http://localhost:4175/ node tests/e2e/late-images.js
const L = require('./lib.js');
const { chromium, ok, summary, BASE } = L;
const PAGES = 24; // 잡음 사진 한 장씩: 쪽 그림(WebP)이 장당 0.4MB쯤 → 합계 약 10MB(8MB 한도를 넘음)

/** 쪽마다 JPEG 한 장이 든 PDF(바이트). jpgs: Buffer[] (1600×900) */
function pdfOf(jpgs) {
  const parts = []; let at = 0; const offs = new Map();
  const put = (b) => { const x = Buffer.isBuffer(b) ? b : Buffer.from(b, 'latin1'); parts.push(x); at += x.length; };
  const obj = (n, body) => { offs.set(n, at); put(`${n} 0 obj\n`); for (const b of [].concat(body)) put(b); put('\nendobj\n'); };
  put('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n');
  let n = 3; const font = n++; obj(font, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const kids = [];
  jpgs.forEach((jpg, i) => {
    const img = n++; obj(img, [`<< /Type /XObject /Subtype /Image /Width 1600 /Height 900 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`, jpg, '\nendstream']);
    const txt = `BT /F1 18 Tf 40 500 Td (Page ${i + 1} many pages test) Tj ET\nq 880 0 0 495 40 0 cm /Im0 Do Q\n`;
    const cont = n++; obj(cont, `<< /Length ${txt.length} >>\nstream\n${txt}endstream`);
    const page = n++; obj(page, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 960 540] /Resources << /Font << /F1 ${font} 0 R >> /XObject << /Im0 ${img} 0 R >> >> /Contents ${cont} 0 R >>`);
    kids.push(page);
  });
  obj(2, `<< /Type /Pages /Count ${kids.length} /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] >>`);
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  const xref = at; put(`xref\n0 ${n}\n0000000000 65535 f \n`);
  for (let k = 1; k < n; k++) put(`${String(offs.get(k)).padStart(10, '0')} 00000 n \n`);
  put(`trailer\n<< /Size ${n} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return Buffer.concat(parts);
}
const gallery = (n) => Array.from({ length: n }, (_, i) => `<img src="material/p-${String(i + 1).padStart(3, '0')}.webp" alt="${i + 1}쪽" width="160" height="90">`).join('');
const answer = (n) => '```html\n<!doctype html>\n<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>쪽 많은 교재</title></head><body><main><section id="top" data-title="첫 화면"><h1>쪽 많은 교재</h1><p>교재 슬라이드로 봐요.</p></section>'
  + `<section id="deck" data-title="교재"><h2>교재</h2><div data-lp="deck"></div></section><section id="all" data-title="전체 쪽"><h2>전체 쪽</h2>${gallery(n)}</section></main></body></html>\n` + '```\n\n```json\n{"title":"쪽 많은 교재","sessions":[{"date":"2026-12-09","start":"14:00","end":"17:00"}]}\n```';

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage(); const errs = L.watch(p);
  await L.mockAi(ctx, null, { fallback: true });
  await p.goto(BASE, { waitUntil: 'load' });
  // 잡음 사진(JPEG)을 브라우저에서 만들어 PDF로 묶음(저장소에 큰 견본을 두지 않음)
  const jpgs = await p.evaluate(async (count) => {
    const out = [];
    for (let i = 0; i < count; i++) {
      const c = document.createElement('canvas'); c.width = 1600; c.height = 900; const x = c.getContext('2d');
      const d = x.createImageData(1600, 900); const a = d.data; let s = 1234567 + i * 7919;
      for (let k = 0; k < a.length; k += 4) { s = (s * 1103515245 + 12345) & 0x7fffffff; a[k] = s & 255; a[k + 1] = (s >> 8) & 255; a[k + 2] = (s >> 16) & 255; a[k + 3] = 255; }
      x.putImageData(d, 0, 0); x.fillStyle = '#fff'; x.fillRect(40, 40, 520, 140); x.fillStyle = '#000'; x.font = '64px sans-serif'; x.fillText('PAGE ' + (i + 1), 70, 135);
      out.push(c.toDataURL('image/jpeg', 0.8).split(',')[1]);
    }
    return out;
  }, PAGES);
  const pdf = pdfOf(jpgs.map((s) => Buffer.from(s, 'base64')));
  await p.setInputFiles('.ld-hero input[type=file][multiple]', [{ name: '쪽 많은 교재.pdf', mimeType: 'application/pdf', buffer: pdf }]);
  await p.waitForSelector('.files li', { timeout: 60000 });
  await L.aiReady(p, 300000);
  const pid = L.pidOf(p);
  const sizes = () => p.evaluate((id) => new Promise((res) => { const q = indexedDB.open('lecpage'); q.onsuccess = () => { const st = q.result.transaction('blobs').objectStore('blobs'); const r = st.openCursor(IDBKeyRange.bound(id + ':site/material/', id + ':site/material/￿')); let n = 0, bytes = 0; r.onsuccess = () => { const c = r.result; if (!c) return res({ n, bytes }); const v = c.value; n++; bytes += v?.size ?? v?.byteLength ?? 0; c.continue(); }; }; }), pid);
  await L.makeWith(p, answer(PAGES), 300000);
  await L.waitStudio(p, 120000, { folds: false });
  const mat = await sizes();
  ok(`site has every page image (${PAGES}) and they are over the 8MB preview budget`, mat.n === PAGES && mat.bytes > 8.5e6, JSON.stringify(mat));
  // 1 그려서 검사: 깨진 그림을 알리지 않음
  const proj = await L.readProject(p, pid);
  const broken = (proj.inspect?.issues || []).filter((x) => x.id === 'broken-image');
  ok('inspection: no "그림이 열리지 않아요" for page images beyond the preview budget', broken.length === 0, broken.slice(0, 2).map((x) => x.message_ko).join(' / '));
  ok('finished screen: no "꼭 고칠 곳" banner about images', !/그림이 열리지 않아요/.test(await p.locator('body').innerText()));
  // 2 미리보기: 모든 그림이 열림(뒤쪽 쪽 그림은 틀 안에서 만든 blob: 주소로)
  const fr = p.frameLocator('.pv-device iframe').frameLocator('iframe');
  await fr.locator('img').first().waitFor({ timeout: 30000 });
  const stat = async () => fr.locator('img').evaluateAll((els) => ({ total: els.length, broken: els.filter((i) => i.complete && i.naturalWidth === 0).length, pending: els.filter((i) => !i.complete && i.loading !== 'lazy').length, late: els.filter((i) => /^blob:/.test(i.currentSrc || i.src || '')).length, relative: els.filter((i) => /^material\//.test(i.getAttribute('src') || '')).length }));
  let s = await stat();
  for (let i = 0; i < 40 && (s.pending || s.relative || s.broken); i++) { await p.waitForTimeout(250); s = await stat(); }
  ok('preview: every image opens, none left on a site-relative address', s.total >= PAGES * 2 && s.broken === 0 && s.relative === 0, JSON.stringify(s));
  ok('preview: images beyond the budget were handed over as blobs (fixture exceeds the budget)', s.late > 0, JSON.stringify(s));
  // 3 교재 슬라이드에서 마지막 쪽으로: 나중에 넣는 주소(img.src = 'material/p-024.webp')도 열림
  const last = await fr.locator('body').evaluate(async (body, n) => {
    const img = document.createElement('img'); img.alt = 'late'; img.width = 10; body.appendChild(img);
    img.src = `material/p-${String(n).padStart(3, '0')}.webp`;
    await new Promise((r) => { img.onload = r; img.onerror = r; setTimeout(r, 4000); });
    const viaAttr = document.createElement('img'); viaAttr.alt = 'late2'; viaAttr.width = 10; body.appendChild(viaAttr);
    viaAttr.setAttribute('src', `./material/p-${String(n - 1).padStart(3, '0')}.webp`);
    await new Promise((r) => { viaAttr.onload = r; viaAttr.onerror = r; setTimeout(r, 4000); });
    const viaHtml = document.createElement('div'); viaHtml.innerHTML = `<img alt="late3" width="10" src="material/p-${String(n - 2).padStart(3, '0')}.webp">`; body.appendChild(viaHtml);
    await new Promise((r) => setTimeout(r, 800));
    const out = [img.naturalWidth, viaAttr.naturalWidth, viaHtml.querySelector('img').naturalWidth]; img.remove(); viaAttr.remove(); viaHtml.remove(); return out;
  }, PAGES);
  ok('preview: a page image set later (img.src, setAttribute, inserted HTML) opens too', last.every((w) => w > 0), JSON.stringify(last));
  // 글로 끼워 넣은 <img src="material/…">는 브라우저가 먼저 열어 보다 막힌 뒤(콘솔에 CSP 한 줄) 바뀜: 위 3에서 일부러 만든 그 한 줄만 빼고 오류 없음
  const real = errs.filter((e) => !new RegExp(`material/p-${String(PAGES - 2).padStart(3, '0')}\\.webp`).test(e));
  ok('no page errors (static page images never try a blocked address)', real.length === 0, real.slice(0, 2).join(' | '));
  await b.close();
  summary();
})().catch((e) => { console.log('SCRIPT ERROR', e.message); process.exit(1); });
