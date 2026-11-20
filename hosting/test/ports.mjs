// 시험이 띄우는 로컬 서버의 포트. 기본은 OS가 고르고(0), LECPAGE_TEST_PORTS="6400-6449"처럼 주면 그 범위에서만 고릅니다
// (같은 기계에서 다른 작업과 포트 범위를 나눠 쓸 때). 시험 파일들이 함께 돌아도 겹치지 않게 임시 폴더에 표시를 남겼다가 끝나면 지웁니다.
import { createServer } from 'node:net';
import { mkdirSync, rmSync, writeFileSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const RANGE = /^(\d{2,5})-(\d{2,5})$/.exec(String(process.env.LECPAGE_TEST_PORTS || '').trim());
const held = new Map(); // 포트 → 표시 폴더
process.on('exit', () => { for (const d of held.values()) rmSync(d, { recursive: true, force: true }); });

const canListen = (port) => new Promise((res) => {
  const s = createServer();
  s.once('error', () => res(false));
  s.listen(port, '127.0.0.1', () => s.close(() => res(true)));
});
/** 다른 시험 프로세스가 쥐고 있는 표시인지(그 프로세스가 끝났거나 오래된 표시면 아님) */
function busy(mark) {
  try {
    const pid = Number(readFileSync(join(mark, 'pid'), 'utf8'));
    try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
  } catch {
    try { return Date.now() - statSync(mark).mtimeMs < 60000; } catch { return false; } // 막 만들어 pid를 쓰기 전
  }
}

/** 빈 포트 하나. 범위를 정했으면 그 안에서 겹치지 않게 */
export async function freePort() {
  if (!RANGE) {
    return new Promise((res, rej) => {
      const s = createServer();
      s.on('error', rej);
      s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => res(port)); });
    });
  }
  const lo = Number(RANGE[1]); const n = Number(RANGE[2]) - lo + 1;
  for (let i = 0; i < n; i++) {
    const port = lo + ((i + process.pid) % n);
    const mark = join(tmpdir(), `lecpage-test-port-${port}`);
    try { mkdirSync(mark); } catch {
      if (busy(mark)) continue;
      rmSync(mark, { recursive: true, force: true });
      try { mkdirSync(mark); } catch { continue; }
    }
    writeFileSync(join(mark, 'pid'), String(process.pid));
    if (await canListen(port)) { held.set(port, mark); return port; }
    rmSync(mark, { recursive: true, force: true });
  }
  throw new Error(`LECPAGE_TEST_PORTS(${RANGE[0]})에 빈 포트가 없어요.`);
}
/** 서버를 끈 뒤 포트 표시를 지움 */
export function releasePort(port) {
  const d = held.get(port);
  if (d) { rmSync(d, { recursive: true, force: true }); held.delete(port); }
}
