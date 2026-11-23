// 시험용 가짜 wrangler(커넥트의 Cloudflare 한 번에 배포용): 실제 계정에 닿지 않고 로그인·계정·workers.dev 이름·올리기·지우기를 흉내 냄.
// 상태는 FAKE_CF_STATE(JSON 파일): { loggedIn, approve, accounts:[{id,name}], sub, workers:{ 이름:{ secrets:[], assets, files } }, token, fail:{ deploy:'email' } }
// 부른 명령은 FAKE_WRANGLER_LOG에 한 줄씩(비밀 값은 길이만).
import { readFileSync, writeFileSync, appendFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const FILE = process.env.FAKE_CF_STATE;
const read = () => JSON.parse(readFileSync(FILE, 'utf8'));
const write = (s) => writeFileSync(FILE, JSON.stringify(s));
const log = (s) => { if (process.env.FAKE_WRANGLER_LOG) appendFileSync(process.env.FAKE_WRANGLER_LOG, s + '\n'); };
const stdin = () => { try { return readFileSync(0, 'utf8'); } catch { return ''; } };
const arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : ''; };
const tomlName = () => { const f = join(process.cwd(), 'wrangler.toml'); return existsSync(f) ? (readFileSync(f, 'utf8').match(/^name = "(.+)"$/m) || [])[1] : ''; };
const nameOf = () => arg('--name') || tomlName();
const die = (msg, code = 1) => { console.error(`\n✘ [ERROR] ${msg}\n`); process.exit(code); };
const count = (d) => { let n = 0; for (const f of readdirSync(d)) { const p = join(d, f); n += statSync(p).isDirectory() ? count(p) : 1; } return n; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

console.log(' ⛅️ wrangler 0.0.0-fake\n───────────────────');
const s = read();
const cmd = argv[0] === 'auth' || argv[0] === 'secret' ? `${argv[0]} ${argv[1]}` : argv[0];
log(`${cmd}${nameOf() ? ' ' + nameOf() : ''}${process.env.CLOUDFLARE_ACCOUNT_ID ? ' @' + process.env.CLOUDFLARE_ACCOUNT_ID.slice(0, 4) : ''}`);

if (cmd === 'whoami') {
  if (!argv.includes('--json')) die('test expects --json', 2);
  if (!s.loggedIn) { console.log('{"loggedIn":false}'); process.exit(1); }
  console.log(JSON.stringify({ loggedIn: true, authType: 'OAuth Token', email: 'teacher@example.com', accounts: s.accounts, tokenPermissions: ['workers:write'] }, null, 2));
  process.exit(0);
}
if (cmd === 'login') {
  if (!argv.includes('--browser=false')) die('test expects --browser=false', 2);
  console.log('Attempting to login via OAuth...');
  console.log('Visit this link to authenticate: http://127.0.0.1:9/oauth2/auth?response_type=code&client_id=fake&state=fake');
  for (let i = 0; i < 400; i++) { // 시험이 approve를 켤 때까지(20초)
    const n = read();
    if (n.approve) { n.loggedIn = true; n.approve = false; write(n); console.log('Successfully logged in.'); process.exit(0); }
    await sleep(50);
  }
  die('Timed out waiting for authorization code');
}
if (cmd === 'logout') { s.loggedIn = false; write(s); console.log('Successfully logged out.'); process.exit(0); }
if (!s.loggedIn) die('You are not authenticated. Please run `wrangler login`.');
if (cmd === 'auth token') { console.log(JSON.stringify({ type: 'oauth', token: s.token }, null, 2)); process.exit(0); }
if (s.accounts.length > 1 && !process.env.CLOUDFLARE_ACCOUNT_ID) die('More than one account available but unable to select one in non-interactive mode.\nPlease set the appropriate `account_id` in your Wrangler configuration file or assign it to the `CLOUDFLARE_ACCOUNT_ID` environment variable.');
const name = nameOf();
s.workers = s.workers || {};
if (cmd === 'secret put') {
  const v = stdin().trim();
  log(`  ${argv[2]} (길이 ${v.length})`);
  if (v.length < 12) die('too short');
  const w = s.workers[name] = s.workers[name] || { secrets: [], draft: true };
  if (!w.secrets.includes(argv[2])) w.secrets.push(argv[2]);
  w.key = `len${v.length}:${v.slice(0, 2)}`; // 시험이 어떤 키가 들어갔는지 앞 두 글자로만 봄
  write(s); console.log(`✨ Success! Uploaded secret ${argv[2]}`); process.exit(0);
}
if (cmd === 'deploy') {
  if (s.fail?.deploy === 'email') die('A request to the Cloudflare API (/accounts/x/workers/scripts/y) failed.\n\n  You need to verify your email address to use Workers. [code: 10034]');
  if (!s.sub) die('You need to register a workers.dev subdomain before publishing to workers.dev\n\nYou can either deploy your worker to one or more routes by specifying them in your wrangler.toml file, or register a workers.dev subdomain here:\nhttps://dash.cloudflare.com/x/workers/onboarding');
  const assets = arg('--assets');
  if (assets && !existsSync(join(assets, 'index.html'))) die('no index.html in assets');
  const w = s.workers[name] = s.workers[name] || { secrets: [] };
  delete w.draft; w.deploys = (w.deploys || 0) + 1;
  if (assets) { w.assets = true; w.files = count(assets); w.index = readFileSync(join(assets, 'index.html'), 'utf8').slice(0, 2000); }
  write(s);
  console.log(`Uploaded ${name}\nDeployed ${name} triggers\n  https://${name}.${s.sub}.workers.dev\nCurrent Version ID: 0000`);
  process.exit(0);
}
if (cmd === 'delete') {
  if (!argv.includes('--force')) die('test expects --force', 2);
  if (!s.workers[name]) die('A request to the Cloudflare API failed.\n  This Worker does not exist on your account. [code: 10007]');
  delete s.workers[name]; write(s); console.log(`Successfully deleted ${name}`); process.exit(0);
}
die('unknown: ' + argv.join(' '), 2);
