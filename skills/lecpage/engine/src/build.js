// 설계도 → 연수 사이트 파일 묶음. Node(skill)와 브라우저(앱) 모두에서 같은 함수를 씁니다.
// runtime.read(path): engine/runtime 아래 파일 내용을 문자열로 돌려주는 함수(환경마다 다르게 주입)
import { validate } from './validate.js';
import { resolveDesign } from './decide/design.js';
import { decideInfra } from './decide/infra.js';
import { themeCSS, themeTokens, presetWithOverrides } from './design/tokens.js';
import { getPreset } from './design/presets.js';
import { renderIndex, renderConsole, renderScreen, renderCheck, renderPrivacy, designDoc, opsDoc } from './render/pages.js';
import { esc } from './render/html.js';

/** 사이트에 넣을 수 있는 사용자 자료(교재 그림·원본·사진·소리·영상) */
export const USER_ASSET = /^(?:assets\/)?(?:slides|media)\/[\w가-힣ㄱ-ㅎㅏ-ㅣ.\-()\[\] ]{1,140}\.(png|jpe?g|gif|webp|avif|pdf|mp3|m4a|mp4|webm|pptx|ppsx|docx|hwpx|xlsx|txt|zip)$/i;

const LIVE_FILES = { local: 'live/local.js', http: 'live/http.js', supabase: 'live/supabase.js', sheets: 'live/sheets.js' };

// fx.css에서 쓰는 효과 묶음만 남김(표지: 줄 맨 앞의 @fx:id 주석, 아이디가 별표면 공통)
export function pruneFxCss(css, ids) {
  const used = new Set(ids);
  return String(css || '').split(/^(?=\/\*@fx:)/m).filter((chunk, i) => {
    const m = /^\/\*@fx:(.*?)\*\//.exec(chunk);
    if (!m) return i === 0;
    const list = m[1].trim().split(/[\s,]+/).filter(Boolean);
    return list.includes('*') || list.some((x) => used.has(x));
  }).join('');
}

export function collectEffects(design, bp) {
  const ids = new Set();
  for (const v of Object.values(design.effects || {})) if (v) ids.add(v);
  for (const v of [design.graphic, design.closingGraphic, design.signature]) if (v) ids.add(v);
  if (design.motion > 0) ids.add('reveal-up');
  if (bp.sections.some((s) => s.type === 'stations')) ids.add('micro-copy');
  return [...ids];
}

function favicon(design) {
  const p = presetWithOverrides(design);
  const t = themeTokens(p, p.theme, { accent: design.accent });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="${esc(t['--primary'])}"/><path d="M20 18h17l9 9v19a2 2 0 0 1-2 2H20a2 2 0 0 1-2-2V20a2 2 0 0 1 2-2z" fill="${esc(t['--primary-foreground'])}" opacity=".95"/><path d="M37 18v9h9" fill="none" stroke="${esc(t['--primary'])}" stroke-width="3"/></svg>`;
}

/**
 * @param {object} input 설계도(검증 전이어도 됨)
 * @param {object} opts { runtime: {read(path)}, assets: {path: Uint8Array|string}, infra: decideInfra 입력, include: { blueprint: true, teacherFiles: false } }
 * @returns {{ files: Object<string,string|Uint8Array>, teacher: Object<string,string>, blueprint, design, warnings, errors, infra, report }}
 * files = 올릴 사이트, teacher = 강사만 볼 파일(DESIGN.md·운영안내.md·설계도). include.teacherFiles=true면 files에도 넣음
 */
export function build(input, opts = {}) {
  const { blueprint: bp, errors, warnings } = validate(input);
  if (errors.length) return { files: {}, blueprint: bp, errors, warnings };
  const runtime = opts.runtime;
  if (!runtime || typeof runtime.read !== 'function') throw new Error('build(): runtime.read 함수가 필요합니다.');
  const read = (p) => { try { return runtime.read(p); } catch { return ''; } };

  const design = resolveDesign(bp);
  const hasLiveSections = bp.sections.some((s) => ['qa', 'board', 'poll', 'attendance'].includes(s.type) || (s.type === 'survey' && s.questions?.length));
  const live = bp.live.provider !== 'none' && (hasLiveSections || bp.live.features.length > 0);
  const theme = themeCSS(design);
  const preset = presetWithOverrides(design);
  const themeName = design.theme && design.theme !== 'preset' ? design.theme : preset.theme;
  const tok = themeTokens(preset, themeName === 'dark' ? 'dark' : 'light', { accent: design.accent });
  const effectIds = design.motion > 0 || design.graphic ? collectEffects(design, bp) : [];
  const ctx = { bp, design, live, fontLinks: theme.fontLinks, themeColor: tok['--background'], hasFx: effectIds.length > 0, ogImage: opts.ogImage || '' };

  const files = {};
  files['index.html'] = renderIndex(ctx);
  files['check.html'] = renderCheck(ctx);
  files['screen.html'] = renderScreen(ctx);
  if (live) { files['console.html'] = renderConsole(ctx); files['privacy.html'] = renderPrivacy(ctx); }

  files['assets/theme.css'] = theme.css;
  files['assets/lecpage.css'] = read('lecpage.css');
  files['assets/boot.js'] = read('boot.js');
  files['assets/lecpage.js'] = read('lecpage.js');
  files['assets/screen.js'] = read('screen.js');
  files['assets/qr.js'] = read('vendor/qrcode.js');
  files['assets/favicon.svg'] = favicon(design);
  if (live) {
    files['assets/console.js'] = read('console.js');
    files['assets/live.js'] = [read('live/core.js'), read(LIVE_FILES[bp.live.provider] || LIVE_FILES.local)].join('\n;\n');
  }

  const missingFx = [];
  if (effectIds.length) {
    const parts = [read('fx/core.js')];
    for (const id of effectIds) {
      const src = read(`fx/effects/${id}.js`);
      if (src) parts.push(src); else missingFx.push(id);
    }
    parts.push('if(window.LecFX){document.readyState!=="loading"?LecFX.start():document.addEventListener("DOMContentLoaded",function(){LecFX.start()})}');
    files['assets/fx.js'] = parts.join('\n;\n');
    files['assets/fx.css'] = pruneFxCss(read('fx/fx.css'), effectIds);
  }

  const infra = opts.infra ? decideInfra(opts.infra) : null;
  // 검색 노출: 'public'일 때만 허용(기본은 주소·QR을 받은 사람만)
  files['robots.txt'] = bp.access.mode === 'public' ? 'User-agent: *\nAllow: /\n' : 'User-agent: *\nDisallow: /\n';
  // 강사용 파일은 올리는 사이트와 따로 돌려줌(설계도에는 강사 메일 등 공개하지 않을 값이 있을 수 있음)
  const teacher = { 'DESIGN.md': designDoc(ctx), '운영안내.md': opsDoc(ctx, infra) };
  if (opts.include?.blueprint !== false) teacher['lecpage.blueprint.json'] = JSON.stringify(bp, null, 2);
  if (opts.include?.teacherFiles) Object.assign(files, teacher);

  // 사용자 자료는 정해진 폴더·형식만(엔진이 만든 파일은 절대 덮어쓰지 않음, 스크립트·SVG·HTML 금지)
  for (const [p, data] of Object.entries(opts.assets || {})) {
    if (!USER_ASSET.test(p) || p.includes('..') || p in files) { warnings.push({ path: p, message_ko: `허용되지 않는 자료라 뺐습니다: ${p}` }); continue; }
    files[p] = data;
  }
  if (missingFx.length) warnings.push({ path: 'design.effects', message_ko: `효과 파일이 없어 뺐습니다: ${missingFx.join(', ')}` });

  const report = {
    preset: design.preset, motion: design.motion, effects: effectIds.filter((x) => !missingFx.includes(x)), live: live ? bp.live.provider : 'none',
    pages: Object.keys(files).filter((f) => f.endsWith('.html')), sizeKB: Math.round(Object.values(files).reduce((a, v) => a + (typeof v === 'string' ? new TextEncoder().encode(v).length : v.byteLength || 0), 0) / 1024),
    notes: design._notes || [],
  };
  return { files, teacher, blueprint: bp, design, warnings, errors, infra, report };
}
