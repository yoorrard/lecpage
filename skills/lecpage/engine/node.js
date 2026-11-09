// Node 전용 도우미: 런타임 파일 읽기, 결과 파일 쓰기, 자산 폴더 읽기
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ENGINE_DIR = dirname(fileURLToPath(import.meta.url));
export const RUNTIME_DIR = join(ENGINE_DIR, 'runtime');

export function nodeRuntime(dir = RUNTIME_DIR) {
  return { read: (p) => readFileSync(join(dir, p), 'utf8') };
}

export function writeFiles(outDir, files) {
  const written = [];
  for (const [p, content] of Object.entries(files)) {
    if (p.includes('..')) continue;
    const full = join(outDir, p);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, typeof content === 'string' ? content : Buffer.from(content));
    written.push(p);
  }
  return written;
}

/** 폴더 안 파일을 {상대경로: Uint8Array}로 (assets/·media/·slides/ 아래만 빌드에 들어감) */
export function readAssetDir(dir, prefix = '') {
  const out = {};
  if (!dir || !existsSync(dir)) return out;
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const full = join(d, name);
      const st = statSync(full);
      if (st.isDirectory()) walk(full);
      else out[(prefix + relative(dir, full)).split(sep).join('/')] = new Uint8Array(readFileSync(full));
    }
  };
  walk(dir);
  return out;
}
