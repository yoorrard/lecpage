// 시험용 키트 사이트: 시험용 레퍼런스 사이트(test/fixtures/ref-site)를 조립해 보조 쪽·런타임·참가자 쪽을 만듦.
// 런타임(lecpage.js·console.js·screen.js·live/*)과 보조 쪽을 시험하는 파일이 함께 씀.
import fs from 'node:fs';
import path from 'node:path';
import * as K from '../src/kit/index.js';
import { nodeRuntime } from '../node.js';

export const REF = path.join(import.meta.dirname, 'fixtures/ref-site');
const TEXT = /\.(html|css|m?js|json|txt)$/i;

/** 레퍼런스 사이트 폴더 → { 경로: 글|bytes } */
export function refSite() {
  const out = {};
  const dir = path.join(REF, 'site');
  const walk = (d) => { for (const n of fs.readdirSync(d)) { const f = path.join(d, n); if (fs.statSync(f).isDirectory()) walk(f); else { const k = path.relative(dir, f).split(path.sep).join('/'); out[k] = TEXT.test(k) ? fs.readFileSync(f, 'utf8') : new Uint8Array(fs.readFileSync(f)); } } };
  walk(dir);
  return out;
}
export const refMeta = () => JSON.parse(fs.readFileSync(path.join(REF, 'lecpage.json'), 'utf8'));

/**
 * 조립한 사이트. meta: lecpage.json에 덮을 칸, prev: 강사 값(live·siteUrl·access·privacy …), site: 사이트를 바꾸려면(기본 레퍼런스)
 * @returns assemble 결과 { files, blueprint, collected, … }
 */
export function kitBuild({ meta = {}, prev = null, site = null, preview = false, today = '2026-11-20', materials } = {}) {
  const r = K.assemble(site || refSite(), { ...refMeta(), ...meta }, { runtime: nodeRuntime(), prev, preview, today, materials });
  if (r.errors?.length) throw new Error(r.errors.map((e) => e.message_ko).join(' '));
  return r;
}

const LIVE = ['qa', 'help', 'progress', 'board', 'poll', 'attendance', 'reactions', 'signal'];
/**
 * 예전 시험의 설계도 꼴 설정({ live, meta, access, audience, privacy })을 레퍼런스 사이트 조립으로 옮김.
 * live.features는 참여 기능(사이트의 다른 기능 deck·survey·timer는 그대로), 강사 값(live·access·siteUrl·shortUrl·privacy)은 prev로
 */
export function bpBuild(bp = {}, opts = {}) {
  const lv = bp.live || {}, m = bp.meta || {}, ref = refMeta();
  const meta = {
    ...(lv.features ? { features: [...new Set([...lv.features, ...ref.features.filter((f) => !LIVE.includes(f))])] } : {}),
    ...(m.title ? { title: m.title } : {}),
    ...(m.date ? { sessions: [{ date: m.date, start: m.start || '', end: m.end || '' }] } : {}),
    ...(bp.audience?.minor ? { audience: 'students' } : {}),
  };
  const prev = {
    ...(lv.provider && lv.provider !== 'none' ? { live: { provider: lv.provider, url: lv.url || '', code: lv.code || '', anonKey: lv.anonKey || '', ...(typeof lv.uploads === 'boolean' ? { uploads: lv.uploads } : {}), ...(lv.anonymous === false ? { anonymous: false } : {}) } } : {}),
    ...(bp.access?.mode ? { access: bp.access.mode } : {}), ...(m.siteUrl ? { siteUrl: m.siteUrl } : {}), ...(m.shortUrl ? { shortUrl: m.shortUrl } : {}), ...(m.joinUrl ? { joinUrl: m.joinUrl } : {}),
    ...(bp.privacy ? { privacy: bp.privacy } : {}),
  };
  return kitBuild({ meta, prev, ...opts });
}

/** 아주 작은 키트 사이트(자리 표시 몇 개) */
export function tinySite(body, head = '') {
  return { 'index.html': `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>시험 연수</title>${head}</head><body><main><h1>시험 연수</h1>${body}</main></body></html>` };
}

/** 폴더에 쓰기 */
export function writeSite(dir, files) {
  for (const [p, v] of Object.entries(files)) { const f = path.join(dir, p); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, typeof v === 'string' ? v : Buffer.from(v)); }
  return dir;
}
