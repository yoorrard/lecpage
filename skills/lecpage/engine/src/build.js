// 설계도 → 연수 사이트 파일 묶음. Node(skill)와 브라우저(앱) 모두에서 같은 함수를 씁니다.
// runtime.read(path): engine/runtime 아래 파일 내용을 문자열로 돌려주는 함수(환경마다 다르게 주입)
import { validate } from './validate.js';
import { resolveDesign } from './decide/design.js';
import { decideInfra } from './decide/infra.js';
import { themeCSS, themeTokens } from './design/tokens.js';
import { getPreset } from './design/presets.js';
import { renderIndex, renderConsole, renderScreen, renderCheck, renderPrivacy, designDoc, opsDoc } from './render/pages.js';
import { esc } from './render/html.js';

const LIVE_FILES = { local: 'live/local.js', http: 'live/http.js', supabase: 'live/supabase.js', sheets: 'live/sheets.js' };

export function collectEffects(design, bp) {
  const ids = new Set();
  for (const v of Object.values(design.effects || {})) if (v) ids.add(v);
  for (const v of [design.graphic, design.closingGraphic, design.signature]) if (v) ids.add(v);
  if (design.motion > 0) ids.add('reveal-up');
  if (bp.sections.some((s) => s.type === 'stations')) ids.add('micro-copy');
  return [...ids];
}

function favicon(design) {
  const p = getPreset(design.preset);
  const t = themeTokens(p, p.theme, { accent: design.accent });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="${esc(t['--primary'])}"/><path d="M20 18h17l9 9v19a2 2 0 0 1-2 2H20a2 2 0 0 1-2-2V20a2 2 0 0 1 2-2z" fill="${esc(t['--primary-foreground'])}" opacity=".95"/><path d="M37 18v9h9" fill="none" stroke="${esc(t['--primary'])}" stroke-width="3"/></svg>`;
}

/**
 * @param {object} input 설계도(검증 전이어도 됨)
 * @param {object} opts { runtime: {read(path)}, assets: {path: Uint8Array|string}, infra: decideInfra 입력, include: { blueprint: true } }
 * @returns {{ files: Object<string,string|Uint8Array>, blueprint, design, warnings, errors, infra, report }}
 */
export function build(input, opts = {}) {
  const { blueprint: bp, errors, warnings } = validate(input);
  if (errors.length) return { files: {}, blueprint: bp, errors, warnings };
  const runtime = opts.runtime;
  if (!runtime || typeof runtime.read !== 'function') throw new Error('build(): runtime.read 함수가 필요합니다.');
  const read = (p) => { try { return runtime.read(p); } catch { return ''; } };

  const design = resolveDesign(bp);
  const hasLiveSections = bp.sections.some((s) => ['qa', 'board', 'poll', 'attendance'].includes(s.type));
  const live = bp.live.provider !== 'none' && (hasLiveSections || bp.live.features.length > 0);
  const theme = themeCSS(design);
  const preset = getPreset(design.preset);
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
    files['assets/fx.css'] = read('fx/fx.css');
  }

  const infra = opts.infra ? decideInfra(opts.infra) : null;
  files['DESIGN.md'] = designDoc(ctx);
  files['운영안내.md'] = opsDoc(ctx, infra);
  if (opts.include?.blueprint !== false) files['lecpage.blueprint.json'] = JSON.stringify(bp, null, 2);

  for (const [p, data] of Object.entries(opts.assets || {})) {
    if (/^(assets|media|slides)\//.test(p) && !p.includes('..')) files[p] = data;
  }
  if (missingFx.length) warnings.push({ path: 'design.effects', message_ko: `효과 파일이 없어 뺐습니다: ${missingFx.join(', ')}` });

  const report = {
    preset: design.preset, motion: design.motion, effects: effectIds.filter((x) => !missingFx.includes(x)), live: live ? bp.live.provider : 'none',
    pages: Object.keys(files).filter((f) => f.endsWith('.html')), sizeKB: Math.round(Object.values(files).reduce((a, v) => a + (typeof v === 'string' ? new TextEncoder().encode(v).length : v.byteLength || 0), 0) / 1024),
    notes: design._notes || [],
  };
  return { files, blueprint: bp, design, warnings, errors, infra, report };
}
