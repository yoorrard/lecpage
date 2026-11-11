import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const read = (p) => readFileSync(here(p), 'utf8');

// 배포본에 묶이는 제3자 코드·글꼴의 라이선스 전문을 dist/licenses.txt로 냅니다.
// 압축(minify)하면 preact·pdf.js 본체·qrcode-generator의 머리말 고지가 빠지므로, MIT·Apache-2.0·OFL이 요구하는
// "저작권 표시와 허락 문구(라이선스 사본)를 함께 배포"를 이 파일로 지킵니다. 사람이 읽는 목록: THIRD_PARTY_NOTICES.md
// package.json의 dependencies를 모두 넣고, 라이선스 파일을 못 찾으면 빌드를 멈춥니다(새 의존성을 빠뜨리지 않게).
const VENDORED = [
  ['fflate (vendored)', '../skills/lecpage/engine/vendor/fflate.js'],
  ['modern-screenshot (vendored)', '../skills/lecpage/engine/runtime/review/vendor/modern-screenshot.js'],
  ['perfect-freehand (vendored)', '../skills/lecpage/engine/runtime/review/vendor/perfect-freehand.js'],
];
const MIT = (holder) => `MIT License\n\n${holder}\n\nPermission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

// pdf.js 워커 안에 들어 있는 JPEG 2000 해석기(OpenJPEG). pdfjs-dist 4.x 패키지에는 이 고지 파일이 없어 직접 싣습니다.
// 출처: https://github.com/uclouvain/openjpeg/blob/master/LICENSE (pdfjs-dist를 올릴 때 다시 확인)
const OPENJPEG = `The copyright in this software is being made available under the 2-clauses
BSD License, included below. This software may be subject to other third
party and contributor rights, including patent rights, and no such rights
are granted under this license.

Copyright (c) 2002-2014, Universite catholique de Louvain (UCL), Belgium
Copyright (c) 2002-2014, Professor Benoit Macq
Copyright (c) 2003-2014, Antonin Descampe
Copyright (c) 2003-2009, Francois-Olivier Devaux
Copyright (c) 2005, Herve Drolon, FreeImage Team
Copyright (c) 2002-2003, Yannick Verschueren
Copyright (c) 2001-2003, David Janssens
Copyright (c) 2011-2012, Centre National d'Etudes Spatiales (CNES), France
Copyright (c) 2012, CS Systemes d'Information, France

All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions
are met:
1. Redistributions of source code must retain the above copyright
   notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright
   notice, this list of conditions and the following disclaimer in the
   documentation and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS \`AS IS'
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
ARE DISCLAIMED.  IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE
LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
POSSIBILITY OF SUCH DAMAGE.`;

function licensesTxt() {
  return {
    name: 'lecpage-licenses',
    apply: 'build',
    generateBundle() {
      const app = JSON.parse(read('package.json'));
      const out = [`lecpage web app — notices and third-party licenses
This file carries the lecpage NOTICE and the copyright notices and license texts of the third-party code and fonts bundled in this build.
lecpage license (Apache-2.0): https://github.com/yoorrard/lecpage/blob/main/LICENSE — the same Apache License 2.0 text is reproduced in the pdfjs-dist section below.
Overview (Korean): https://github.com/yoorrard/lecpage/blob/main/THIRD_PARTY_NOTICES.md`, `NOTICE\n\n${read('../NOTICE').trim()}`];
      for (const name of Object.keys(app.dependencies || {})) {
        const dir = `node_modules/${name}`;
        const pkg = JSON.parse(read(`${dir}/package.json`));
        const file = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'fonts/OFL.txt', 'OFL.txt'].map((f) => `${dir}/${f}`).find((p) => existsSync(here(p)));
        let text = file ? read(file).trim() : '';
        // 라이선스 파일에 저작권 줄이 없으면(pdf.js) 본체 머리말에서, 파일이 아예 없으면(qrcode-generator) 머리말로 MIT 전문을 만듭니다
        const main = pkg.main && existsSync(here(`${dir}/${pkg.main}`)) ? read(`${dir}/${pkg.main}`).slice(0, 4000) : '';
        const holder = (/Copyright (?:\(c\) )?\d{4}[^\n*]*/.exec(main) || [''])[0].trim();
        if (!text && pkg.license === 'MIT' && holder) text = MIT(holder);
        else if (text && !/Copyright (?:\(c\) )?\d{4}/.test(text) && holder) text = `${holder}\n\n${text}`;
        if (!text) throw new Error(`licenses.txt: ${name}의 라이선스 파일을 찾지 못했습니다. vite.config.js에 직접 추가하세요.`);
        const home = pkg.homepage || String(pkg.repository?.url || pkg.repository || '').replace(/^git\+|\.git$/g, '');
        out.push(`${name} ${pkg.version} — ${pkg.license}${home ? `\n${home}` : ''}\n\n${text}`);
      }
      for (const [label, p] of VENDORED) {
        const head = (/^\/\*![\s\S]*?\*\//.exec(read(p)) || [''])[0];
        if (!/Permission is hereby granted/.test(head)) throw new Error(`licenses.txt: ${p} 머리말에 MIT 고지가 없습니다.`);
        out.push(`${label} — MIT\n\n${head}`);
      }
      out.push(`OpenJPEG (inside the pdf.js worker) — BSD-2-Clause\nhttps://github.com/uclouvain/openjpeg\n\n${OPENJPEG}`);
      // Vite가 번들에 넣는 작은 도우미(모듈 미리 읽기 등)
      out.push(`vite (build helpers) — MIT\nhttps://vite.dev\n\n${read('node_modules/vite/LICENSE.md').split('# Licenses of bundled dependencies')[0].replace('# Vite core license\nVite is released under the MIT license:\n\n', '').trim()}`);
      this.emitFile({ type: 'asset', fileName: 'licenses.txt', source: out.join(`\n\n${'='.repeat(72)}\n\n`) + '\n' });
    },
  };
}

// base: './' — GitHub Pages(하위 경로)·Cloudflare·로컬 파일 어디서든 같은 빌드가 동작하게
export default defineConfig({
  base: './',
  plugins: [preact(), licensesTxt()],
  resolve: { alias: { '@engine': here('../skills/lecpage/engine') } },
  server: { fs: { allow: ['..'] } },
  build: { target: 'es2020', outDir: 'dist', assetsInlineLimit: 0, chunkSizeWarningLimit: 1600 },
  worker: { format: 'es' },
});
