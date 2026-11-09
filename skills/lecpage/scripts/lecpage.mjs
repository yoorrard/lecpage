#!/usr/bin/env node
// lecpage CLI — skill이 부르는 명령 모음. Node 22 이상, 외부 의존성 없음(qa만 Playwright 선택).
//   node lecpage.mjs presets | effects
//   node lecpage.mjs draft <material.json> [-i info.json] -o blueprint.json
//   node lecpage.mjs prompt <material.json> [-i info.json] -o prompt.txt
//   node lecpage.mjs validate <blueprint.json>
//   node lecpage.mjs decide-infra -i info.json      (또는 --size 30 --features qa,progress --skill click)
//   node lecpage.mjs design <blueprint.json>          (프리셋 순위·효과 결정 보기)
//   node lecpage.mjs build <blueprint.json> -o dist [--assets 폴더] [-i info.json] [--password 암호]  (강사용 파일은 dist-강사용/에)
//   node lecpage.mjs serve <dist> [--port 4173]
//   node lecpage.mjs qa <dist> [--out qa]
//   node lecpage.mjs pack <dist> -o site.zip
import { readFileSync, writeFileSync, existsSync, statSync, createReadStream, mkdirSync } from 'node:fs';
import { join, extname, resolve, dirname, relative, isAbsolute } from 'node:path';
import { createServer } from 'node:http';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ENGINE = join(HERE, '..', 'engine');
const E = await import(pathToFileURL(join(ENGINE, 'src', 'index.js')).href);
const N = await import(pathToFileURL(join(ENGINE, 'node.js')).href);

const [cmd, ...rest] = process.argv.slice(2);
const args = { _: [] };
for (let i = 0; i < rest.length; i++) {
  const a = rest[i];
  if (a.startsWith('--')) { const k = a.slice(2); const v = rest[i + 1] && !rest[i + 1].startsWith('-') ? rest[++i] : true; args[k] = v; }
  else if (a === '-o' || a === '-i') args[a.slice(1)] = rest[++i];
  else args._.push(a);
}
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const out = (data, file) => { const s = typeof data === 'string' ? data : JSON.stringify(data, null, 2); if (file) { mkdirSync(dirname(resolve(file)), { recursive: true }); writeFileSync(file, s); console.log(`→ ${file}`); } else console.log(s); };
const fail = (m) => { console.error('오류: ' + m); process.exit(1); };

async function ingestApi() {
  try { return await import(pathToFileURL(join(ENGINE, 'src', 'ingest', 'index.js')).href); } catch { return null; }
}

switch (cmd) {
  case 'presets':
    for (const p of E.PRESETS) console.log(`${p.id.padEnd(16)} ${p.name_ko} — ${p.desc_ko}\n${''.padEnd(17)}분위기 ${p.moods.join(', ')} · 주제 ${p.topics.join(', ')} · 모션 ${p.motion}`);
    break;
  case 'effects':
    for (const f of E.FX) console.log(`${String(f.id).padEnd(20)} L${f.level} ${f.name_ko}  [${(f.slots || []).join(', ')}]${f.libs?.length ? ' (외부 라이브러리)' : ''}`);
    break;
  case 'draft': {
    const ing = await ingestApi(); if (!ing?.materialToDraft) fail('ingest 모듈을 찾지 못했습니다.');
    const material = readJson(args._[0]); const info = args.i ? readJson(args.i) : {};
    out(ing.materialToDraft(material, info), args.o);
    break;
  }
  case 'prompt': {
    const ing = await ingestApi();
    const material = args._[0] ? readJson(args._[0]) : null; const info = args.i ? readJson(args.i) : {};
    const context = material && ing?.materialToAIContext ? ing.materialToAIContext(material, { maxChars: 60000 }) : '';
    const draft = material && ing?.materialToDraft ? ing.materialToDraft(material, info) : null;
    out(E.buildPrompt({ context, info, draft }), args.o);
    break;
  }
  case 'validate': {
    const r = E.validate(readJson(args._[0]));
    for (const w of r.warnings) console.log('주의 ' + w.path + ': ' + w.message_ko);
    for (const e of r.errors) console.log('오류 ' + e.path + ': ' + e.message_ko);
    console.log(r.errors.length ? '검증 실패' : `검증 통과 (섹션 ${r.blueprint.sections.length}개)`);
    if (args.o) out(r.blueprint, args.o);
    process.exit(r.errors.length ? 1 : 0);
  }
  case 'decide-infra': {
    const info = args.i ? readJson(args.i) : { size: +args.size || 30, features: String(args.features || '').split(',').filter(Boolean), skill: args.skill || 'click', duration: args.duration || 'day', network: args.network || 'good', infra: String(args.infra || '').split(',').filter(Boolean), commercial: !!args.commercial, minor: !!args.minor };
    out(E.decideInfra(info));
    break;
  }
  case 'design': {
    const { blueprint: bp } = E.validate(readJson(args._[0]));
    const ranked = E.rankPresets({ moods: bp.design.mood, topics: bp.design.topics.length ? bp.design.topics : E.detectTopics(bp.meta.title + ' ' + bp.meta.subtitle), archetype: bp.archetype.primary, admin: bp.meta.admin.kind, minor: bp.audience.minor });
    out({ ranked, resolved: E.resolveDesign(bp) });
    break;
  }
  case 'build': {
    if (!args._[0]) fail('설계도 파일을 지정해 주세요.');
    const bp = readJson(args._[0]);
    const assets = args.assets ? N.readAssetDir(resolve(args.assets), '') : {};
    const info = args.i ? readJson(args.i) : null;
    const r = E.build(bp, { runtime: N.nodeRuntime(), assets, infra: info });
    for (const w of r.warnings) console.log('주의 ' + w.path + ': ' + w.message_ko);
    if (r.errors.length) { for (const e of r.errors) console.log('오류 ' + e.path + ': ' + e.message_ko); process.exit(1); }
    const dir = resolve(args.o || 'dist');
    const password = args.password || process.env.LECPAGE_PASSWORD || '';
    let files = r.files;
    if (r.blueprint.access.mode === 'password' && !password) fail('이 설계도는 암호 보호(access.mode=password)예요. --password 값이나 LECPAGE_PASSWORD 환경 변수를 주세요.');
    if (password) {
      const { webcrypto } = await import('node:crypto');
      files = await E.protectSite(files, password, { runtime: N.nodeRuntime(), title: r.blueprint.meta.title, crypto: webcrypto });
      console.log('암호 보호: 페이지와 교재 그림을 잠갔어요. 참가자용 QR은 주소 뒤에 #k=암호 를 붙이면 저절로 열려요.');
    }
    const n = N.writeFiles(dir, files).length;
    const tdir = dir + '-강사용';
    N.writeFiles(tdir, r.teacher);
    console.log(`완료: ${dir} (파일 ${n}개, 약 ${r.report.sizeKB}KB) · 프리셋 ${r.report.preset} · 모션 ${r.report.motion} · 실시간 ${r.report.live} · 공개 ${password ? "암호" : r.blueprint.access.mode}`);
    console.log(`강사용 파일(올리지 마세요): ${tdir} (DESIGN.md · 운영안내.md · 설계도)`);
    console.log('효과: ' + (r.report.effects.join(', ') || '없음'));
    break;
  }
  case 'serve': {
    const dir = resolve(args._[0] || 'dist'); const port = +args.port || 4173;
    const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.md': 'text/markdown; charset=utf-8', '.pdf': 'application/pdf', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.woff2': 'font/woff2' };
    createServer((req, res) => {
      let p; try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400); return res.end('bad request'); }
      if (p.endsWith('/')) p += 'index.html';
      const f = join(dir, p); const rel = relative(dir, f);
      if (rel.startsWith('..') || isAbsolute(rel) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
      res.writeHead(200, { 'content-type': types[extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); createReadStream(f).pipe(res);
    }).listen(port, args.host || '127.0.0.1', () => console.log(`미리보기: http://localhost:${port}/  (끝내려면 Ctrl+C${args.host ? '' : ' · 같은 와이파이의 다른 기기에서 보려면 --host 0.0.0.0'})`));
    break;
  }
  case 'qa': {
    const dir = resolve(args._[0] || 'dist'); const outDir = resolve(args.out || join(dir, '..', 'qa'));
    let pw; try { pw = await import('playwright'); } catch { try { const { createRequire } = await import('node:module'); pw = createRequire(import.meta.url)('playwright'); } catch { fail('Playwright가 없습니다. `npm i -D playwright` 후 다시 실행하세요.'); } }
    mkdirSync(outDir, { recursive: true });
    const browser = await pw.chromium.launch(); const report = [];
    for (const [w, h, name] of [[1280, 860, 'desktop'], [390, 844, 'phone']]) {
      for (const scheme of ['light', 'dark']) {
        const page = await browser.newPage({ viewport: { width: w, height: h }, colorScheme: scheme });
        const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
        await page.goto(pathToFileURL(join(dir, 'index.html')).href, { waitUntil: 'load' }); await page.waitForTimeout(900);
        const m = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, imgsNoAlt: [...document.images].filter((i) => !i.hasAttribute('alt')).length, h1: document.querySelectorAll('h1').length, btnNoName: [...document.querySelectorAll('button')].filter((b) => !(b.textContent.trim() || b.getAttribute('aria-label'))).length }));
        await page.screenshot({ path: join(outDir, `${name}-${scheme}.png`), fullPage: false });
        report.push({ view: `${name}-${scheme}`, errors: errs.filter((e) => !/net::ERR|Failed to load resource/.test(e)), ...m });
        await page.close();
      }
    }
    await browser.close();
    out(report, join(outDir, 'report.json'));
    const bad = report.filter((r) => r.errors.length || r.overflow || r.imgsNoAlt || r.h1 !== 1 || r.btnNoName);
    console.log(bad.length ? `점검 결과 문제 ${bad.length}건 — ${join(outDir, 'report.json')} 확인` : '점검 통과: 오류·가로 넘침·대체 텍스트·제목 구조 이상 없음');
    process.exit(bad.length ? 1 : 0);
  }
  case 'pack': {
    const dir = resolve(args._[0] || 'dist');
    const files = N.readAssetDir(dir, '');
    const zip = E.zipFiles(files);
    const target = args.o || 'site.zip'; writeFileSync(target, zip); console.log(`→ ${target} (${Math.round(zip.length / 1024)}KB, 파일 ${Object.keys(files).length}개)`);
    break;
  }
  default:
    console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 13).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
}
