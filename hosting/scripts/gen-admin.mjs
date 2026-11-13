#!/usr/bin/env node
// 관리 화면 파일(public/admin/)을 관리 Worker(wrangler.admin.jsonc)에 글자로 넣는 모듈 src/admin-ui.js를 만듭니다.
// 관리 Worker는 정적 자산을 쓰지 않습니다: 정적 자산이 있으면 Access 정보(ctx.access)가 Worker에 오지 않아서(공식 문서
// workers/configuration/cloudflare-access, "ctx.access limitations").
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOSTING = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.env.LECPAGE_ADMIN_UI_OUT || join(HOSTING, 'src', 'admin-ui.js');
const FILES = { '/admin/': ['index.html', 'text/html; charset=utf-8'], '/admin/app.js': ['app.js', 'text/javascript; charset=utf-8'], '/admin/app.css': ['app.css', 'text/css; charset=utf-8'] };

export function render() {
  const rows = Object.entries(FILES).map(([path, [name, type]]) => `  ${JSON.stringify(path)}: [${JSON.stringify(type)}, ${JSON.stringify(readFileSync(join(HOSTING, 'public', 'admin', name), 'utf8'))}],`);
  return `// 자동으로 만든 파일입니다. 고치지 마세요 → node scripts/gen-admin.mjs (원본: public/admin/)\nexport const ADMIN_UI = {\n${rows.join('\n')}\n};\n`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const text = render();
  if (!existsSync(OUT) || readFileSync(OUT, 'utf8') !== text) writeFileSync(OUT, text);
  console.log('admin-ui.js: 관리 화면 파일 3개');
}
