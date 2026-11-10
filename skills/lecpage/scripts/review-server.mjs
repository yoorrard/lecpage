#!/usr/bin/env node
// lecpage 로컬 검토 서버: 빌드한 사이트를 띄우고 페이지마다 '수정 요청' 도구를 넣습니다. Node 22 이상, 외부 의존성 없음.
//   node review-server.mjs <dist> [--port 4180] [--out work/feedback]
// 강사가 화면 왼쪽 아래 [수정 요청]을 눌러 표시하고 글을 적어 보내면 work/feedback/NNN.png + NNN.json 으로 저장해요.
// AI 에이전트는 이 두 파일을 읽고 설계도 패치를 만들어 적용합니다(lecpage.mjs patch work/blueprint.json patch.json).
// 보안: 127.0.0.1에만 열고, 같은 출처에서 온 JSON 요청만 받습니다(Host·Origin·Content-Type 확인, CSRF·DNS 리바인딩 막기).
//   본문은 12MB까지, PNG 서명을 확인하고, 파일 이름은 서버가 번호로 정합니다. 배포 파일(dist)은 바꾸지 않아요.
import { readFileSync, existsSync, statSync, createReadStream, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve, relative, isAbsolute, extname, dirname } from 'node:path';
import { createServer } from 'node:http';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const RUNTIME = join(HERE, '..', 'engine', 'runtime', 'review');
const MAX_BODY = 12 * 1024 * 1024;
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif', '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.pdf': 'application/pdf', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.webm': 'video/webm', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.enc': 'application/octet-stream' };
const SCRIPT_PATH = '/__lecpage/review.js', POST_PATH = '/__lecpage/feedback';
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** 검토 도구 스크립트(화면 담기 + 펜 + 표시 도구) */
export function reviewScript() {
  return ['vendor/modern-screenshot.js', 'vendor/perfect-freehand.js', 'annotate.js'].map((f) => readFileSync(join(RUNTIME, f), 'utf8')).join('\n;\n');
}
/** HTML에 검토 도구를 넣음(</body> 앞, 없으면 끝) */
export function injectReview(html) {
  const tag = `<script src="${SCRIPT_PATH}" data-lp-review="${POST_PATH}"></script>`;
  return /<\/body>/i.test(html) ? html.replace(/<\/body>(?![\s\S]*<\/body>)/i, () => tag + '</body>') : html + tag;
}

const clean = (s, max) => String(typeof s === 'string' ? s : '').normalize('NFC').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').slice(0, max);
const shown = (p) => { const r = relative(process.cwd(), p); return r && !r.startsWith('..') ? r : p; };
const num = (v) => Math.max(0, Math.min(1e6, Math.round(+v || 0)));

/** 받은 수정 요청을 검사해 저장할 모양으로(잘못되면 오류 메시지) */
export function parseFeedback(body) {
  let j; try { j = JSON.parse(body); } catch { return { error: 'JSON이 아니에요.' }; }
  if (!j || typeof j !== 'object' || Array.isArray(j)) return { error: '모양이 맞지 않아요.' };
  let png = null;
  if (j.png !== undefined && j.png !== '') {
    const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String(j.png));
    if (!m) return { error: '그림은 PNG data URL이어야 해요.' };
    png = Buffer.from(m[1], 'base64');
    if (png.length < 64 || !png.subarray(0, 8).equals(PNG_SIG)) return { error: 'PNG 그림이 아니에요.' };
  }
  const text = clean(j.text, 4000).trim();
  if (!text && !png) return { error: '보낼 글이나 그림이 없어요.' };
  const list = (a, n, max, re) => (Array.isArray(a) ? a : []).map((x) => clean(x, max).trim()).filter((x) => x && (!re || re.test(x))).slice(0, n);
  const rec = {
    text,
    sections: list(j.sections, 10, 80, /^[0-9A-Za-z가-힣_-]+$/),
    notes: list(j.notes, 10, 80),
    page: clean(j.page, 200).replace(/[^\w가-힣./%-]/g, ''),
    viewport: j.viewport && typeof j.viewport === 'object' ? { w: num(j.viewport.w), h: num(j.viewport.h) } : null,
    scroll: j.scroll && typeof j.scroll === 'object' ? { x: num(j.scroll.x), y: num(j.scroll.y) } : null,
  };
  return { rec, png };
}

/** 다음 번호(001, 002 …)로 저장. 같은 번호를 동시에 쓰지 않게 'wx'로 만듦 */
export function saveFeedback(outDir, rec, png) {
  mkdirSync(outDir, { recursive: true });
  let n = readdirSync(outDir).reduce((m, f) => { const x = /^(\d{3,6})\.json$/.exec(f); return x ? Math.max(m, +x[1]) : m; }, 0);
  for (let tries = 0; tries < 20; tries++) {
    n++; const id = String(n).padStart(3, '0');
    try {
      writeFileSync(join(outDir, `${id}.json`), JSON.stringify({ id, time: new Date().toISOString(), ...rec, image: png ? `${id}.png` : null }, null, 2) + '\n', { flag: 'wx' });
      if (png) writeFileSync(join(outDir, `${id}.png`), png, { flag: 'wx' });
      return id;
    } catch (e) { if (e.code !== 'EEXIST') throw e; }
  }
  throw new Error('저장할 번호를 찾지 못했어요.');
}

/**
 * 검토 서버 시작.
 * @param {string} dist 빌드한 사이트 폴더
 * @param {{port?:number, out?:string, quiet?:boolean}} [o] out 기본값: dist 옆 work/feedback
 * @returns {Promise<import('node:http').Server>}
 */
export function startReviewServer(dist, { port = 4180, out, quiet = false } = {}) {
  const dir = resolve(dist);
  if (!existsSync(join(dir, 'index.html'))) throw new Error(`${dir}에 index.html이 없어요. 먼저 사이트를 빌드해 주세요.`);
  const outDir = resolve(out || join(dirname(dir), 'work', 'feedback'));
  const script = reviewScript();
  const log = quiet ? () => { } : (...a) => console.log(...a);
  const server = createServer((req, res) => {
    const addr = server.address(); const p0 = addr && typeof addr === 'object' ? addr.port : port;
    const hosts = [`127.0.0.1:${p0}`, `localhost:${p0}`];
    const send = (code, body, type = 'application/json; charset=utf-8', extra = {}) => { res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', ...extra }); res.end(body); };
    if (!hosts.includes(String(req.headers.host || '').toLowerCase())) return send(421, '{"error":"잘못된 Host"}'); // DNS 리바인딩
    let path; try { path = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { return send(400, '{"error":"잘못된 주소"}'); }

    if (path === POST_PATH) {
      if (req.method !== 'POST') return send(405, '{"error":"POST만 받아요"}', undefined, { allow: 'POST' });
      const origin = String(req.headers.origin || '');
      if (origin && !hosts.map((h) => `http://${h}`).includes(origin)) return send(403, '{"error":"다른 사이트에서 온 요청은 받지 않아요"}');
      if (req.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(req.headers['sec-fetch-site'])) return send(403, '{"error":"같은 사이트에서만 보낼 수 있어요"}');
      if (!/^application\/json\b/i.test(String(req.headers['content-type'] || ''))) return send(415, '{"error":"JSON으로 보내 주세요"}');
      if (+req.headers['content-length'] > MAX_BODY) { send(413, '{"error":"너무 커요"}'); return req.destroy(); }
      const chunks = []; let size = 0, over = false;
      req.on('data', (c) => { size += c.length; if (size > MAX_BODY) { over = true; req.destroy(); } else chunks.push(c); });
      req.on('end', () => {
        if (over) return;
        const r = parseFeedback(Buffer.concat(chunks).toString('utf8'));
        if (r.error) return send(400, JSON.stringify({ error: r.error }));
        try {
          const id = saveFeedback(outDir, r.rec, r.png);
          log(`수정 요청 ${id}: ${r.rec.text.slice(0, 80) || '(글 없음)'}${r.rec.sections.length ? ` · 칸 ${r.rec.sections.join(', ')}` : ''} → ${shown(join(outDir, id + '.json'))}`);
          send(200, JSON.stringify({ ok: true, id }));
        } catch (e) { send(500, JSON.stringify({ error: '저장하지 못했어요: ' + e.message })); }
      });
      req.on('error', () => { });
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(405, '{"error":"읽기만 돼요"}', undefined, { allow: 'GET, HEAD' });
    if (path === SCRIPT_PATH) return send(200, script, 'text/javascript; charset=utf-8');
    if (path.endsWith('/')) path += 'index.html';
    const f = join(dir, path); const rel = relative(dir, f);
    if (!rel || rel.startsWith('..') || isAbsolute(rel) || rel.split(/[\\/]/).some((x) => x.startsWith('.')) || !existsSync(f) || statSync(f).isDirectory()) return send(404, 'not found', 'text/plain; charset=utf-8');
    if (extname(f) === '.html') return send(200, injectReview(readFileSync(f, 'utf8')), TYPES['.html']);
    res.writeHead(200, { 'content-type': TYPES[extname(f).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
    if (req.method === 'HEAD') return res.end();
    createReadStream(f).pipe(res);
  });
  return new Promise((ok, no) => {
    server.once('error', no);
    server.listen(port, '127.0.0.1', () => {
      const a = server.address();
      log(`검토 페이지: http://127.0.0.1:${a.port}/  — 화면 왼쪽 아래 [수정 요청]을 눌러 표시하고 보내면 ${shown(outDir)}/에 저장돼요. (끝내려면 Ctrl+C)`);
      ok(server);
    });
  });
}

// 명령으로 직접 실행할 때
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const a = process.argv.slice(2); const opt = { _: [] };
  for (let i = 0; i < a.length; i++) { if (a[i] === '--port' || a[i] === '--out') opt[a[i].slice(2)] = a[++i]; else if (a[i] === '-h' || a[i] === '--help') opt.help = true; else opt._.push(a[i]); }
  if (opt.help || !opt._[0]) { console.log('사용법: node review-server.mjs <dist> [--port 4180] [--out work/feedback]'); process.exit(opt.help ? 0 : 2); }
  startReviewServer(opt._[0], { port: +opt.port || 4180, out: opt.out }).catch((e) => { console.error('오류: ' + e.message); process.exit(1); });
}
