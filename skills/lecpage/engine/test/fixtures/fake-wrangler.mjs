// 시험용 가짜 wrangler: 실제 Cloudflare 계정에 닿지 않고 publish의 순서를 흉내 냅니다.
// 부른 명령을 FAKE_WRANGLER_LOG에 한 줄씩 적습니다(비밀 값은 길이만).
import { readFileSync, appendFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const log = (s) => { if (process.env.FAKE_WRANGLER_LOG) appendFileSync(process.env.FAKE_WRANGLER_LOG, s + '\n'); };
const stdin = () => { try { return readFileSync(0, 'utf8'); } catch { return ''; } };
const tomlName = () => { const f = join(process.cwd(), 'wrangler.toml'); return existsSync(f) ? (readFileSync(f, 'utf8').match(/^name = "(.+)"$/m) || [])[1] : ''; };

if (argv[0] === 'whoami') { log('whoami'); console.log('You are logged in with an OAuth Token, associated with the email teacher@example.com.'); process.exit(0); }
if (argv[0] === 'secret' && argv[1] === 'list') { log('secret list'); console.log(process.env.FAKE_HAS_SECRET ? '[{"name":"ADMIN_KEY","type":"secret_text"}]' : '[]'); process.exit(0); }
if (argv[0] === 'secret' && argv[1] === 'put') {
  const v = stdin().trim();
  log(`secret put ${argv[2]} (길이 ${v.length})`);
  if (v.length < 12) { console.error('too short'); process.exit(1); }
  console.log('✨ Success! Uploaded secret ' + argv[2]); process.exit(0);
}
if (argv[0] === 'deploy') {
  const i = argv.indexOf('--name');
  const name = i >= 0 ? argv[i + 1] : tomlName();
  log(`deploy ${argv.slice(1).join(' ')}`);
  console.log(`Uploaded ${name}\nDeployed ${name} triggers\n  https://${name}.fake-account.workers.dev\nCurrent Version ID: 0000`);
  process.exit(0);
}
console.error('unknown: ' + argv.join(' ')); process.exit(2);
