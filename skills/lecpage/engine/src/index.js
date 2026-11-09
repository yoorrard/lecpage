// lecpage 엔진 공개 API (브라우저·Node 공통, ESM)
export { validate, safeUrl, makeCode, randomCode } from './validate.js';
export { build, collectEffects } from './build.js';
export { protectSite, unlockUrl, PROTECTED_PAGES } from './protect.js';
export { zipFiles } from './zip-write.js';
export { SECTION_DEFS, SECTION_TYPES, LIVE_FEATURES, LIVE_PROVIDERS, ARCHETYPES, DEPLOY_TARGETS, DEFAULT_SURVEY } from './schema/sections.js';
export { PRESETS, PRESET_IDS, getPreset } from './design/presets.js';
export { FONTS, fontAssets, fontStack } from './design/fonts.js';
export { themeCSS, themeTokens, htmlAttrs, presetWithOverrides } from './design/tokens.js';
export { PALETTE_SEEDS, FONT_PAIRS, PALETTE_BY_ID, FONT_PAIR_BY_ID } from './design/seeds.js';
export { contrast, mix, readableOn } from './design/color.js';
export { FX, TOPICS, TOPIC_LABELS } from './design/fx-catalog.js';
export { rankPresets, chooseEffects, resolveDesign, motionCap, fxInfo } from './decide/design.js';
export { decideInfra, BACKENDS, HOSTS, REALTIME_FEATURES, STORE_FEATURES } from './decide/infra.js';
export { decideArchetype, ARCHETYPE_SECTIONS } from './decide/archetype.js';
export { detectTopics, moodsForTopics, moodFromWords } from './decide/topic.js';
export { buildPrompt, extractJson, callProvider, listModels, blueprintGuide } from './prompt/bridge.js';
export const VERSION = '1.0.0';
