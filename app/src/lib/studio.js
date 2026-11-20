// 화면이 생성·조립 쪽을 부르는 단 한 곳(docs/plan-ai-first.md §15 앱 안의 약속). 화면은 이 파일만 import합니다.
// 생성(키·내 PC·먼저 해보기·쓰던 AI 창)은 lib/gen, 조립은 엔진 키트(E.kit)를 lib/gen/preview.js의 assembleProject 한 곳으로.
export { startGeneration, resumeGeneration, stopGeneration, forgetGeneration, useGeneration, chatPrompt, acceptChatAnswer, editSite, chatEditPrompt, runInspect, fixIssues, bridgeStatus, assembleProject } from './gen/index.js';
export { previewHtml } from '@engine/src/kit/index.js';
