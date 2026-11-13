// 시험용 가짜 onpod CLI: 실제 Onpod 계정에 닿지 않고 publish --host onpod의 순서를 흉내 냅니다.
// 부른 명령과 올린 폴더의 파일 목록을 FAKE_ONPOD_LOG에 적습니다. ONPOD_TOKEN은 값 대신 앞부분만.
// FAKE_ONPOD_NOAUTH=1 → whoami 실패, FAKE_ONPOD_TAKEN=1 → 이름이 이미 쓰임
import { appendFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const argv = process.argv.slice(2);
const log = (s) => { if (process.env.FAKE_ONPOD_LOG) appendFileSync(process.env.FAKE_ONPOD_LOG, s + '\n'); };
const list = (d, base = d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? list(p, base) : [relative(base, p).replace(/\\/g, '/')]; });

if (argv[0] === 'whoami') {
  log('whoami');
  if (process.env.FAKE_ONPOD_NOAUTH && !process.env.ONPOD_TOKEN) { console.error('error: not logged in (run onpod login --token op_u_...)'); process.exit(1); }
  console.log('teacher@example.com · personal'); process.exit(0);
}
if (argv[0] === 'static' && argv[1] === 'deploy') {
  const dir = argv[2];
  const i = argv.indexOf('--name'); const name = i >= 0 ? argv[i + 1] : 'site';
  log(`static deploy <dir> ${argv.slice(3).join(' ')} token=${(process.env.ONPOD_TOKEN || '').slice(0, 5)}`);
  log('files ' + list(dir).sort().join(','));
  if (process.env.FAKE_ONPOD_TAKEN) { console.error(`error: name "${name}" is already taken (409)`); process.exit(1); }
  // 실제 CLI처럼 토큰 모양이 출력에 섞여도 publish가 가려야 함
  console.log(`uploading ${list(dir).length} files (auth ${process.env.ONPOD_TOKEN || 'session'})\n✅ https://${name}.onpod.ai (HTTP 200)`);
  process.exit(0);
}
console.error('unknown: ' + argv.join(' ')); process.exit(2);
