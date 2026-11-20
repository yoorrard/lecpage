// lecpage 엔진 공개 API (브라우저·Node 공통, ESM)
// AI가 사이트(HTML·CSS·JS)를 직접 쓰고, 엔진은 키트 조립·검수(kit/*), 배포 도구(잠그기·글꼴 담기·ZIP·배포할 곳 고르기)를 맡습니다.
export * as kit from './kit/index.js';
export { assemble, inspect, inspectRendered, readMeta as readSiteMeta } from './kit/index.js';
export { safeUrl, randomCode, makeCode } from './util.js';
export { protectSite, unlockUrl, PROTECTED_PAGES, PUBLIC_PAGES, passwordAdvice, friendlyPassword } from './protect.js';
export { zipFiles } from './zip-write.js';
export { bundleFonts, siteCodepoints, parseRange, usedWeights, deferFontLinks } from './font-bundle.js';
export { FONTS, fontAssets, fontStack, matchFont, fontFamilyName } from './design/fonts.js';
export { contrast, mix, readableOn, toOklch, fromOklch, ramp12 } from './design/color.js';
export { decideInfra, BACKENDS, HOSTS, HOST_STEPS, TEACHER_STEPS, REALTIME_FEATURES, STORE_FEATURES, decideHost, checkHost } from './decide/infra.js';
export { whenText, eventDays } from './hero-meta.js';
export { wordsFor, surveyFor, DEFAULT_SURVEY } from './words.js';
export { VERSION } from './version.js';
