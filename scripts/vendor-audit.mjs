#!/usr/bin/env node
// skill에 담아 둔 라이브러리·판을 고정한 명령(skills/lecpage/engine/vendor/VENDOR.json)의 알려진 취약점을 OSV(api.osv.dev, 키 없음)에서 찾음.
// npm audit·Dependabot은 package.json에 없는 이 파일들을 보지 못해서 따로 돌림(CI '담아 둔 라이브러리 보안 점검').
//   node scripts/vendor-audit.mjs           → 취약점이 있으면 종료 코드 1
// 함께 확인: skill 문서·코드의 `npx <이름>@<판>`이 표의 판과 같은지, 판을 고정하지 않은 `@latest`가 표에 적힌 것(까닭이 있는 것)뿐인지
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKILL = join(ROOT, 'skills', 'lecpage');
const table = JSON.parse(readFileSync(join(SKILL, 'engine', 'vendor', 'VENDOR.json'), 'utf8'));
const items = [...table.files, ...table.tools].filter((x) => /^\d/.test(x.version));
const problems = [];

// 1) 문서·코드 속 npx 판이 표와 같은지
const pinned = new Map(table.tools.map((t) => [t.name, t.version]));
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? (n === 'node_modules' || n === 'vendor' || n === 'test' ? [] : walk(p)) : /\.(md|m?js)$/.test(n) ? [p] : []; });
for (const f of walk(SKILL)) {
  for (const m of readFileSync(f, 'utf8').matchAll(/npx (?:--yes )?(@?[a-z][\w./-]*?)@([\w.]+)/g)) {
    const [, name, ver] = m; const want = pinned.get(name);
    if (!want) continue;
    if (name === 'wrangler' && /^\d+$/.test(ver)) continue; // 강사가 손으로 치는 로그인 안내(npx wrangler@4 login). publish는 표의 판을 씀
    if (ver !== want) problems.push(`${f.slice(ROOT.length + 1)}: npx ${name}@${ver} — 표(VENDOR.json)는 ${want}`);
  }
}

// 2) 알려진 취약점(OSV)
let res;
try {
  const r = await fetch('https://api.osv.dev/v1/querybatch', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ queries: items.map((x) => ({ package: { name: x.name, ecosystem: 'npm' }, version: x.version })) }), signal: AbortSignal.timeout(20000) });
  res = (await r.json()).results;
} catch (e) {
  console.error(`OSV에 닿지 못했어요(${e.message}). 인터넷이 되는 곳에서 다시 돌려 주세요${process.env.HTTPS_PROXY && !process.env.NODE_USE_ENV_PROXY ? ' — 프록시 뒤면 NODE_USE_ENV_PROXY=1' : ''}.`);
  process.exit(2);
}
items.forEach((x, i) => {
  const v = res?.[i]?.vulns || [];
  console.log(`${v.length ? '✕' : '✓'} ${x.name}@${x.version}${v.length ? ' ' + v.map((y) => y.id).join(', ') : ''}`);
  if (v.length) problems.push(`${x.name}@${x.version}: ${v.map((y) => `https://osv.dev/vulnerability/${y.id}`).join(' ')}`);
});
for (const t of table.tools.filter((x) => !/^\d/.test(x.version))) console.log(`– ${t.name}@${t.version} (판 고정 안 함: ${t.why})`);
if (problems.length) { console.error(problems.map((p) => '문제 ' + p).join('\n')); process.exit(1); }
console.log(`담아 둔 라이브러리 ${table.files.length}개·고정한 명령 ${table.tools.length}개: 알려진 취약점 없음`);
