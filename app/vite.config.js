import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { fileURLToPath } from 'node:url';

// base: './' — GitHub Pages(하위 경로)·Cloudflare·로컬 파일 어디서든 같은 빌드가 동작하게
export default defineConfig({
  base: './',
  plugins: [preact()],
  resolve: { alias: { '@engine': fileURLToPath(new URL('../skills/lecpage/engine', import.meta.url)) } },
  server: { fs: { allow: ['..'] } },
  build: { target: 'es2020', outDir: 'dist', assetsInlineLimit: 0, chunkSizeWarningLimit: 1600 },
  worker: { format: 'es' },
});
