// 시험용 가짜 Vercel CLI(커넥트의 Vercel 한 번에 배포용): 실제 계정에 닿지 않고 로그인(Device Flow)·팀·올리기·배포 보호·지우기를 흉내 냄.
// 출력 모양은 vercel 66.6.0을 터미널 없이 실측한 것(whoami --json, login의 "Visit …", missing_scope의 choices)과 CLI 소스의 deploy --json 모양을 따름.
// 상태는 FAKE_VC_STATE(JSON 파일): { loggedIn, approve, teams:[slug…], projects:{ 이름:{ id, sso, team, files } }, sso(새 프로젝트의 보호 기본값), fail:{ deploy|delete|protect:'문구' }, expire(로그인 만료 흉내) }
// 부른 명령은 FAKE_VERCEL_LOG에 한 줄씩.
import { readFileSync, writeFileSync, appendFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const FILE = process.env.FAKE_VC_STATE;
const read = () => JSON.parse(readFileSync(FILE, 'utf8'));
const write = (s) => writeFileSync(FILE, JSON.stringify(s));
const log = (s) => { if (process.env.FAKE_VERCEL_LOG) appendFileSync(process.env.FAKE_VERCEL_LOG, s + '\n'); };
const arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : ''; };
const out = (o) => console.log(JSON.stringify(o, null, 2));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const count = (d) => { let n = 0; for (const f of readdirSync(d)) { const p = join(d, f); n += statSync(p).isDirectory() ? count(p) : 1; } return n; };

const s = read();
const flags = new Set(['--non-interactive', '--no-color', '--json', '--prod', '--yes', '--create-if-missing', '--sso']);
const valued = new Set(['-Q', '--scope', '--project', '--confirm-name']);
const pos = []; for (let i = 0; i < argv.length; i++) { if (valued.has(argv[i])) i++; else if (!flags.has(argv[i])) pos.push(argv[i]); }
const cmd = pos[0] === 'project' ? pos.slice(0, pos[1] === 'protection' ? 3 : 2).join(' ') : pos[0];
const scope = arg('--scope');
log(`${cmd}${scope ? ' @' + scope : ''}${arg('--project') ? ' ' + arg('--project') : ''}${cmd === 'api' ? ' ' + pos[1] : ''}`);
if (!argv.includes('--non-interactive') || !arg('-Q')) { console.error('test expects --non-interactive and -Q'); process.exit(2); }

if (cmd === 'whoami') {
  if (!s.loggedIn) { out({ loggedIn: false, cliVersion: '0.0.0-fake', linkedProject: null }); process.exit(0); }
  out({ team: null, plan: 'hobby', username: s.user || 'teacher', email: `${s.user || 'teacher'}@example.com`, name: null, teams: s.teams || [], linkedProject: null, cliVersion: '0.0.0-fake' });
  process.exit(0);
}
if (cmd === 'login') {
  console.error('\n> \n  Visit https://vercel.com/oauth/device?user_code=FAKE-CODE\n');
  for (let i = 0; i < 400; i++) { if (read().approve) { const n = read(); n.loggedIn = true; n.approve = false; write(n); console.error('  Congratulations! You are now signed in.'); process.exit(0); } await sleep(25); }
  console.error('Error: The device code has expired.'); process.exit(1);
}
if (cmd === 'logout') {
  if (s.fail?.logout) { console.error(`Error: ${s.fail.logout}`); process.exit(1); } // 망이 끊긴 채 로그아웃(로그인 파일은 그대로 남음)
  const n = read(); n.loggedIn = false; write(n); console.error('Logged out!'); process.exit(0);
}
// 돌린 폴더와 설정 폴더(-Q)에 로그인 파일이 있는 것처럼: 시험이 '로그아웃하면 이 PC의 로그인 파일을 지움'을 봄
if (s.loggedIn && arg('-Q') && !existsSync(join(arg('-Q'), 'auth.json'))) writeFileSync(join(arg('-Q'), 'auth.json'), '{"token":"fake-vercel-login"}');
if (process.env.FAKE_VERCEL_CWD) appendFileSync(process.env.FAKE_VERCEL_CWD, [process.cwd(), existsSync(join(process.cwd(), 'package.json')), pos[0] === 'deploy' ? pos[1] : ''].join('\t') + '\n');

if (!s.loggedIn || s.expire) { console.error('Error: No existing credentials found. Please run `vercel login` or pass "--token"'); process.exit(1); }
// 팀 범위: 하나면 그 팀, 여럿이면 --scope가 있어야 함(없으면 되물음)
const teams = s.teams || [];
if (!scope && teams.length !== 1) {
  out({ status: 'action_required', reason: 'missing_scope', message: teams.length ? 'Provide --scope explicitly. No default is applied in non-interactive mode.' : 'No teams available.', choices: teams.map((t, i) => ({ id: `team_${i}`, name: t })), next: [] });
  process.exit(1);
}
const team = scope || teams[0];
if (!teams.includes(team)) { console.error(`Error: The specified scope does not exist: ${team}`); process.exit(1); }
const pj = (name) => { const p = read().projects?.[name]; return p && p.team === team ? p : null; };

if (cmd === 'api') {
  const m = String(pos[1] || '').match(/^\/v9\/projects\/([a-z0-9-]+)$/);
  if (!m) { out({ error: { code: 'not_found', message: 'no route' } }); process.exit(1); }
  const p = pj(m[1]);
  if (!p) { out({ error: { code: 'not_found', message: 'The project was not found.' } }); process.exit(1); }
  out({ id: p.id, name: m[1], accountId: `team_${team}`, ssoProtection: p.sso ? { deploymentType: 'all_except_custom_domains' } : null, targets: { production: { alias: [`${m[1]}-teacher-projects.vercel.app`, `${m[1]}.vercel.app`] } } });
  process.exit(0);
}
if (cmd === 'deploy') {
  const dir = pos[1]; const name = arg('--project');
  if (!dir || !existsSync(join(dir, 'index.html'))) { out({ status: 'error', reason: 'no_files', message: 'No index.html' }); process.exit(1); }
  if (!name || !argv.includes('--prod') || !argv.includes('--yes') || !argv.includes('--create-if-missing') || !argv.includes('--json')) { console.error('test expects --prod --yes --project <name> --create-if-missing --json'); process.exit(2); }
  if (s.fail?.deploy) { out({ status: 'error', reason: 'deploy_failed', message: s.fail.deploy }); process.exit(1); }
  const n = read(); n.projects = n.projects || {};
  const had = n.projects[name];
  n.projects[name] = { id: had?.id || `prj_${Object.keys(n.projects).length + 1}`, sso: had ? had.sso : !!n.sso, team, files: count(dir), deploys: (had?.deploys || 0) + 1, vercelJson: existsSync(join(dir, 'vercel.json')) };
  write(n);
  out({ id: 'dpl_fake', url: `https://${name}-abc123-teacher-projects.vercel.app`, productionUrl: `https://${name}.vercel.app`, inspectorUrl: null, readyState: 'READY', target: 'production', deploymentProtection: n.projects[name].sso ? ['sso'] : null });
  process.exit(0);
}
if (cmd === 'project protection disable') {
  const name = pos[3];
  if (s.fail?.protect) { out({ status: 'error', message: s.fail.protect }); process.exit(1); }
  const n = read(); const p = n.projects?.[name];
  if (!p || p.team !== team || !argv.includes('--sso')) { out({ status: 'error', message: 'Project not found' }); process.exit(1); }
  p.sso = false; write(n); out({ name, ssoProtection: null });
  process.exit(0);
}
if (cmd === 'project delete') {
  const name = pos[2];
  if (arg('--confirm-name') !== name) { console.error('Error: --confirm-name must match'); process.exit(1); }
  if (s.fail?.delete) { console.error(`Error: ${s.fail.delete}`); process.exit(1); }
  const n = read();
  if (!pj(name)) { console.error('Error: Project not found'); process.exit(1); }
  delete n.projects[name]; write(n); console.error(`Success! Project ${name} removed`);
  process.exit(0);
}
console.error(`fake vercel: unknown command ${argv.join(' ')}`); process.exit(2);
