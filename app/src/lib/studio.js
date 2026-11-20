// 화면이 생성·조립 쪽을 부르는 단 한 곳(docs/plan-ai-first.md §15 앱 안의 약속). 화면은 이 파일만 import합니다.
// 지금은 가짜 구현을 씀 → 합칠 때 아래 두 경로만 진짜로 바꿈:
//   './gen/mock.js'  → './gen/index.js'         (생성 파이프라인, gen 작업자)
//   './kit-mock.js'  → 엔진 assemble·inspect     (kit 작업자, 예: '@engine/src/kit/index.js')
// 그 뒤 mock.js·kit-mock.js·data/temp-site.js는 지움(먼저 해보기 녹화는 data/demo-run.js가 따로 가짐).
export { startGeneration, resumeGeneration, stopGeneration, useGeneration, chatPrompt, acceptChatAnswer, editSite, chatEditPrompt, runInspect, fixIssues } from './gen/mock.js';
export { assemble, inspect } from './kit-mock.js';
