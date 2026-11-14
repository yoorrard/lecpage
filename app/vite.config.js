import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { fileURLToPath, pathToFileURL } from 'node:url';
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
      // ai-catalog.json(하루 한 번 모으는 AI 모델 값표)에 models.dev 자료 일부가 들어감(scripts/ai-catalog)
      out.push(`models.dev (model prices and release dates in ai-catalog.json) — MIT\nhttps://models.dev\n\n${MIT('Copyright (c) 2025 models.dev')}`);
      // Vite가 번들에 넣는 작은 도우미(모듈 미리 읽기 등)
      out.push(`vite (build helpers) — MIT\nhttps://vite.dev\n\n${read('node_modules/vite/LICENSE.md').split('# Licenses of bundled dependencies')[0].replace('# Vite core license\nVite is released under the MIT license:\n\n', '').trim()}`);
      this.emitFile({ type: 'asset', fileName: 'licenses.txt', source: out.join(`\n\n${'='.repeat(72)}\n\n`) + '\n' });
    },
  };
}

// 첫 화면(랜딩)이 쓰는 엔진의 사실(디자인·효과 수, 쇼케이스 디자인 이름)을 빌드 때 계산해 작은 모듈로 냅니다.
// 첫 화면이 엔진 전체(약 370KB)를 받지 않게 하려는 것. 쓰는 곳: src/landing/facts.js (import facts from 'virtual:lp-facts')
function landingFacts() {
  const id = 'virtual:lp-facts', rid = '\0' + id;
  return {
    name: 'lecpage-landing-facts',
    resolveId: (s) => (s === id ? rid : null),
    async load(s) {
      if (s !== rid) return null;
      const E = await import(pathToFileURL(here('../skills/lecpage/engine/src/index.js')).href);
      let show = [];
      try { show = JSON.parse(read('src/landing/shots/shots.json')).showcase || []; } catch { /* 그림이 아직 없음 */ }
      const designs = Object.fromEntries(show.map((k) => E.getPreset(k)).filter(Boolean).map((p) => [p.id, { name: p.name_ko, desc: p.desc_ko }]));
      const layouts = Object.values(E.BODY_VARIANTS).reduce((n, v) => n + Object.keys(v).length, 0); // 본문 배치(섹션 종류마다 다른 짜임) 수
      return `export default ${JSON.stringify({ presets: E.PRESETS.length, fx: E.FX.length, layouts, designs })};`;
    },
  };
}

// 오프라인용 목록 sw-warm.json: 연수 화면(#/p)에 처음 들어가면 서비스 워커(public/sw.js)가 이 목록의 조각을 미리 받아 둡니다.
// 첫 화면(쉘)·만들기 화면·교재 읽기·미리보기 런타임·도움말·설정과 그 조각들이 정적으로 가져오는 조각·CSS. heavy: PDF 읽기 도구(약 1.4MB, 마우스 화면에서만)
// 첫 방문 랜딩에서는 받지 않음(휴대폰 데이터). 빌드마다 조각 이름(해시)이 바뀌므로 목록도 빌드 때 만듦
const WARM = ['src/pages/Project.jsx', 'src/lib/ingest.js', 'src/lib/runtime-files.js', 'src/pages/Help.jsx', 'src/pages/Settings.jsx'];
function swWarm() {
  return {
    name: 'lecpage-sw-warm',
    apply: 'build',
    generateBundle(_, bundle) {
      const chunks = Object.values(bundle).filter((c) => c.type === 'chunk');
      const files = new Set(); const heavy = new Set();
      const add = (c) => {
        if (!c || files.has(c.fileName)) return;
        files.add(c.fileName);
        for (const css of c.viteMetadata?.importedCss || []) files.add(css);
        for (const a of c.viteMetadata?.importedAssets || []) if (/pdf\.worker/.test(a)) heavy.add(a);
        for (const i of c.imports) add(bundle[i]);
      };
      add(chunks.find((c) => c.isEntry));
      for (const w of WARM) {
        const c = chunks.find((x) => (x.facadeModuleId || '').replace(/\\/g, '/').endsWith('/' + w));
        if (!c) throw new Error(`sw-warm.json: ${w} 조각을 찾지 못했습니다(파일을 옮겼으면 vite.config.js의 WARM을 고치세요).`);
        add(c);
      }
      this.emitFile({ type: 'asset', fileName: 'sw-warm.json', source: JSON.stringify({ files: [...files].sort(), heavy: [...heavy] }) + '\n' });
    },
  };
}

// base: './' — GitHub Pages(하위 경로)·Cloudflare·로컬 파일 어디서든 같은 빌드가 동작하게
export default defineConfig({
  base: './',
  plugins: [preact(), licensesTxt(), landingFacts(), swWarm()],
  resolve: { alias: { '@engine': here('../skills/lecpage/engine') } },
  server: { fs: { allow: ['..'] } },
  build: { target: 'es2020', outDir: 'dist', assetsInlineLimit: 0, chunkSizeWarningLimit: 1600 },
  worker: { format: 'es' },
});
