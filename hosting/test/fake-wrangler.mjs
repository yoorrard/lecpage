// 흉내 wrangler(설정 스크립트 시험용): 받은 인자를 적고, deploy면 흉내 Cloudflare에 Worker가 생겼다고 알림
import { appendFileSync, readFileSync } from 'node:fs';

const args = process.argv.slice(2);
if (process.env.FAKE_WRANGLER_LOG) appendFileSync(process.env.FAKE_WRANGLER_LOG, `${JSON.stringify(args)}\n`);
if (process.env.FAKE_WRANGLER_FAIL && args[0] === process.env.FAKE_WRANGLER_FAIL) process.exit(1);
if (args[0] === 'deploy' && !args.includes('--dry-run')) {
  const name = args.includes('wrangler.admin.jsonc') ? 'lecpage-admin' : 'lecpage-sites';
  const r = await fetch(`${process.env.CF_API_BASE}/__fake/scripts`, { method: 'POST', body: JSON.stringify({ name }) });
  if (!r.ok) process.exit(2);
}
if (args[0] === 'secret' && args[1] === 'put') readFileSync(0, 'utf8');
process.exit(0);
