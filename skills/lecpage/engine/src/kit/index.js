// 키트·조립·검수(docs/plan-ai-first.md 약속 A~C) 공개 API. 브라우저·Node 공통(ESM)
export { readMeta, keepTeacherValues, defaultMeta, normDate, normTime, isDate, isTime, cleanFacts, themeFromCss, firstSession, liveFeatures, META_VERSION, KIT_FEATURES, LIVE_FEATURE_KEYS, TEACHER_KEYS, MODES, AUDIENCES } from './meta.js';
export { KIT_TYPES, TYPE_FEATURE, parsePages, kitSlug, qaBox, boardBox, pollBox, attendBox, surveyForm, deckBox, joinBox, materialsBox, dockInner, shareDialog, joinDialog, helpSheet, nowInner } from './widgets.js';
export { assemble, previewHtml, kitCsp, FONT_CSS_HOSTS, FRAME_SOURCES } from './assemble.js';
export { ENGINE_PAGES, ENGINE_FILES, SITE_FILE, siteFileOk, pagePath } from './paths.js';
export { inspect, issueSummary, issuesForAi, selectorOf } from './inspect.js';
export { inspectRendered, inspectRenderedSource, inspectRenderedScript, inspectPage } from './inspect-rendered.js';
export { packProjectV2, unpackProjectV2, openProjectFile, upgradeV1, PROJECT_V2, OLD_NOTE } from './project-v2.js';
export { scanTags, elementAt, textOf, resolvePath } from './html.js';
