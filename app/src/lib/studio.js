// 화면이 생성·조립 쪽을 부르는 단 한 곳(docs/plan-ai-first.md §15 앱 안의 약속). 화면은 이 파일만 import합니다.
// 조립·검수는 엔진 키트(E.kit, skills/lecpage/engine/src/kit). 생성은 아직 가짜 구현:
//   './gen/mock.js' → './gen/index.js'(gen 작업자) 한 줄만 바꾸고, mock.js·data/mock-sites.js·data/fixtures/는 지움
//   (먼저 해보기 녹화는 data/demo-run.js가 따로 가짐).
export { startGeneration, resumeGeneration, stopGeneration, useGeneration, chatPrompt, acceptChatAnswer, editSite, chatEditPrompt, runInspect, fixIssues } from './gen/mock.js';
export { assemble, inspect, previewHtml, inspectRenderedScript, readMeta, keepTeacherValues, issuesForAi } from '@engine/src/kit/index.js';
