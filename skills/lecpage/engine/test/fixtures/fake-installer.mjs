// 시험용 가짜 Claude Code 공식 설치 명령(install.sh처럼): ~/.claude/downloads/claude-<판>-<기기>를 조금씩 받고 "Setting up Claude Code..." →
// ~/.local/bin/claude(가짜 claude, fake-agent.mjs)를 두고 "✅ Installation complete!". 실제 망에는 닿지 않음.
// FAKE_INSTALL_MODE: ok(기본) · offline(curl: (6)) · blocked(curl: (60) 인증서) · FAKE_INSTALL_BYTES: 받을 크기(기본 600000)
import { mkdirSync, appendFileSync, rmSync, writeFileSync, chmodSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const mode = process.env.FAKE_INSTALL_MODE || 'ok';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
if (mode === 'offline') { console.error('curl: (6) Could not resolve host: claude.ai'); process.exit(6); }
if (mode === 'blocked') { console.error('curl: (60) SSL certificate problem: unable to get local issuer certificate'); process.exit(60); }
const home = homedir();
const dl = join(home, '.claude', 'downloads'); mkdirSync(dl, { recursive: true });
const f = join(dl, 'claude-2.1.330-linux-x64');
const total = +(process.env.FAKE_INSTALL_BYTES || 600000);
for (let n = 0; n < total; n += total / 6) { appendFileSync(f, Buffer.alloc(total / 6)); await wait(250); }
console.log('Setting up Claude Code...');
await wait(300);
rmSync(f, { force: true });
const bin = join(home, '.local', 'bin'); mkdirSync(bin, { recursive: true });
const agent = join(dirname(fileURLToPath(import.meta.url)), 'fake-agent.mjs');
writeFileSync(join(bin, 'claude'), `#!/bin/sh\nexec "${process.execPath}" "${agent}" claude "$@"\n`); chmodSync(join(bin, 'claude'), 0o755);
console.log('');
console.log('✅ Installation complete!');
