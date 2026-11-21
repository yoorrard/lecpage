// 시험용 가짜 claude·codex: 실제 AI에 닿지 않고 lecpage 커넥트(studio)가 기대하는 흐름을 흉내 냅니다.
// 쓰는 법: 시험이 PATH 앞 폴더에 `claude`·`codex` 실행 파일을 두고 `node fake-agent.mjs <claude|codex> "$@"`로 부름.
// 받은 인자·작업 폴더·폴더 안 파일을 FAKE_AGENT_LOG에 JSON 한 줄로 적고(시험이 옵션 이름을 확인),
// -p / exec이면 stream-json(JSONL)을 내며 TASK.md를 읽고 work/site에 그럴듯한 사이트를 쓰고 검수 명령을 실제로 돌립니다.
// TASK.md에 [fake:hang]이 있으면 끝나지 않고(시간 한도·멈추기 시험), [fake:nosite]면 사이트를 쓰지 않고 실패,
// [fake:mcp]면 init에 MCP 도구가 켜진 것처럼 알림.
// 설치·로그인 버튼 시험: FAKE_LOGIN_FILE이 있으면 그 파일이 있을 때만 로그인된 것으로. `claude auth login`은 코드 한 줄을 받은 뒤(또는 FAKE_LOGIN_AUTO_MS 뒤) 그 파일을 만듦.
import { appendFileSync, readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const [id, ...argv] = process.argv.slice(2);
const log = (o) => { if (process.env.FAKE_AGENT_LOG) appendFileSync(process.env.FAKE_AGENT_LOG, JSON.stringify(o) + '\n'); };
const out = (o) => process.stdout.write(JSON.stringify(o) + '\n');

if (id === 'claude' && argv[0] === 'auth' && argv[1] === 'login') {
  // 실제 2.1.330과 같은 글: 브라우저를 열고(여기선 안 엶), 직접 여는 주소와 코드 칸. 틀린 코드면 "Couldn't log in"으로 1
  console.log('Opening browser to sign in…');
  console.log("If the browser didn't open, visit:");
  console.log('https://claude.ai/oauth/authorize?z-fakecode');
  process.stdout.write('Paste code here if prompted > ');
  const ok = (v) => { if (process.env.FAKE_LOGIN_FILE) writeFileSync(process.env.FAKE_LOGIN_FILE, v); console.log('\nLogin successful.'); process.exit(0); };
  const t = setTimeout(() => { console.log('\nfake claude: 코드를 받지 못했어요'); process.exit(1); }, 20000);
  // FAKE_LOGIN_AUTO_MS: 브라우저에서 로그인해 이 PC의 localhost로 돌아온 것처럼 저절로 끝남 · FAKE_LOGIN_CANCEL_MS: 브라우저에서 취소
  if (process.env.FAKE_LOGIN_AUTO_MS) setTimeout(() => ok('browser'), +process.env.FAKE_LOGIN_AUTO_MS);
  if (process.env.FAKE_LOGIN_CANCEL_MS) setTimeout(() => { console.log("\nCouldn't log in: access_denied (sign-in was cancelled)"); process.exit(1); }, +process.env.FAKE_LOGIN_CANCEL_MS);
  let got = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (d) => {
    got += d;
    if (!got.includes('\n')) return;
    clearTimeout(t);
    if (/bad/.test(got)) { console.log("\nCouldn't log in: That code wasn't accepted. It may be incomplete, expired, already used, or from an earlier sign-in attempt. Sign in again to get a new code."); process.exit(1); }
    ok(got.trim());
  });
  await new Promise(() => {}); // 코드를 받거나 시간이 다 될 때까지(위에서 끝냄)
}
if (id === 'claude' && argv[0] === 'update') { console.log('Claude Code is up to date.'); process.exit(0); }
if (argv[0] === '--version') { console.log(id === 'claude' ? `${process.env.FAKE_CLAUDE_VERSION || '2.1.320'} (Claude Code)` : 'codex-cli 0.130.0'); process.exit(0); }
if (id === 'claude' && argv[0] === 'auth' && argv[1] === 'status') {
  const m = process.env.ANTHROPIC_API_KEY ? 'api_key' : process.env.FAKE_LOGGED_OUT || (process.env.FAKE_LOGIN_FILE && !existsSync(process.env.FAKE_LOGIN_FILE)) ? 'none' : 'claude.ai';
  console.log(JSON.stringify({ loggedIn: m !== 'none', authMethod: m, apiProvider: 'firstParty' }, null, 2));
  process.exit(m === 'none' ? 1 : 0);
}
if (id === 'codex' && argv[0] === 'login' && argv[1] === 'status') { console.error('Logged in using ChatGPT'); process.exit(0); }

const isRun = (id === 'claude' && argv[0] === '-p') || (id === 'codex' && argv[0] === 'exec');
if (!isRun) { console.error(`fake ${id}: unknown ${argv.join(' ')}`); process.exit(2); }

const cwd = process.cwd();
const task = existsSync('TASK.md') ? readFileSync('TASK.md', 'utf8') : '';
log({ id, argv, cwd, pid: process.pid, files: readdirSync(cwd), hasApiKey: !!process.env.ANTHROPIC_API_KEY, task });

const C = id === 'claude';
let n = 0;
const tool = (name, input) => {
  const tid = `t${++n}`;
  if (C) out({ type: 'assistant', message: { content: [{ type: 'tool_use', id: tid, name, input }] }, parent_tool_use_id: null });
  else if (name === 'Bash') out({ type: 'item.started', item: { id: tid, type: 'command_execution', command: input.command, status: 'in_progress' } });
  else if (name === 'Write' || name === 'Edit') out({ type: 'item.completed', item: { id: tid, type: 'file_change', changes: [{ path: input.file_path, kind: 'add' }], status: 'completed' } });
  else out({ type: 'item.started', item: { id: tid, type: 'command_execution', command: `cat ${input.file_path}`, status: 'in_progress' } });
};
const say = (text) => (C ? out({ type: 'assistant', message: { content: [{ type: 'text', text }] }, parent_tool_use_id: null }) : out({ type: 'item.completed', item: { id: `m${++n}`, type: 'agent_message', text } }));

if (C) {
  const ti = argv.indexOf('--tools');
  const tools = ti >= 0 ? argv[ti + 1].split(',') : [];
  out({ type: 'system', subtype: 'init', cwd, session_id: 'fake', tools: task.includes('[fake:mcp]') ? [...tools, 'mcp__evil__run'] : tools, mcp_servers: [], model: 'fake-model' });
} else { out({ type: 'thread.started', thread_id: 'fake' }); out({ type: 'turn.started' }); }

for (const f of ['TASK.md', 'kit.md', 'work/material.md']) if (existsSync(f)) tool('Read', { file_path: join(cwd, f) });
if (existsSync('work/site/material/p-001.webp')) tool('Read', { file_path: join(cwd, 'work/site/material/p-001.webp') });
say('교재를 읽었어요. 따뜻한 색으로 연수 사이트를 짤게요.');

if (task.includes('[fake:hang]')) { setInterval(() => say('아직 하는 중'), 200); }
else if (task.includes('[fake:nosite]')) {
  if (C) out({ type: 'result', subtype: 'error_during_execution', is_error: true, result: '가짜 실패', num_turns: 1 });
  else out({ type: 'turn.failed', error: { message: '가짜 실패' } });
  process.exit(1);
} else {
  const edit = /강의 사이트 고치기/.test(task);
  mkdirSync('work/site/assets', { recursive: true });
  const img = existsSync('work/site/material/p-001.webp') ? '<img src="material/p-001.webp" alt="교재 1쪽">' : '';
  const page = (body) => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>시험 연수</title><link rel="stylesheet" href="assets/style.css"></head><body><main><h1>시험 연수</h1>${body}</main></body></html>`;
  tool('Write', { file_path: join(cwd, 'work/site/assets/style.css') });
  writeFileSync('work/site/assets/style.css', ':root{--lp-accent:#b4441c;--lp-ink:#1f1a17;--lp-paper:#fbf6ee}body{margin:0;font-family:sans-serif;color:var(--lp-ink);background:var(--lp-paper)}main{max-width:720px;margin:0 auto;padding:24px}img{max-width:100%}\n');
  if (!edit) {
    tool('Write', { file_path: join(cwd, 'work/site/index.html') });
    writeFileSync('work/site/index.html', page(`<section id="intro"><h2>소개</h2><p>교재로 만든 시험 사이트예요.</p>${img}</section><section id="ask"><h2>질문</h2><div data-lp="qa"></div></section><section><h2>투표</h2><div data-lp="poll" data-question="어땠나요?" data-options='["좋아요","보통이에요"]'></div></section>`));
  } else {
    tool('Edit', { file_path: join(cwd, 'work/site/index.html') });
    writeFileSync('work/site/index.html', readFileSync('work/site/index.html', 'utf8').replace('</main>', '<section id="added"><h2>더한 섹션</h2><p>고친 부분이에요.</p></section></main>'));
  }
  tool('Write', { file_path: join(cwd, 'work/lecpage.json') });
  const meta = JSON.parse(readFileSync('work/lecpage.json', 'utf8'));
  writeFileSync('work/lecpage.json', JSON.stringify({ ...meta, v: 2, title: meta.title || '시험 연수', features: ['qa', 'poll'], facts: [{ label: '제목', value: '시험 연수', page: 1 }] }, null, 2));
  // 실제 에이전트처럼 검수 명령을 그대로 돌림(Bash 도구)
  const cmd = (task.match(/```\n(node [^\n]+)\n```/) || [])[1] || '';
  tool('Bash', { command: cmd });
  const parts = cmd.split(' ');
  const r = spawnSync(process.execPath, parts.slice(1), { cwd, encoding: 'utf8' });
  log({ id, check: { cmd, status: r.status, out: String(r.stdout).split('\n')[0], err: String(r.stderr).slice(0, 300) } });
  if (C) out({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: `t${n}`, content: String(r.stdout).slice(0, 200) }] } });
  else out({ type: 'item.completed', item: { id: `t${n}`, type: 'command_execution', command: cmd, aggregated_output: String(r.stdout).slice(0, 200), exit_code: r.status, status: 'completed' } });
  tool('Edit', { file_path: join(cwd, 'work/site/assets/style.css') });
  say('검수에서 고칠 곳이 없어요. 다 만들었어요.');
  if (C) out({ type: 'result', subtype: 'success', is_error: false, result: '시험 사이트를 만들었어요.', num_turns: 9, total_cost_usd: 0.12, permission_denials: [] });
  else out({ type: 'turn.completed', usage: { input_tokens: 10, output_tokens: 20 } });
}
