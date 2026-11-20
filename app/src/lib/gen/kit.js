// 조립·검수 함수를 부르는 한 곳. 생성 파이프라인(gen/*)은 이 파일만 씁니다.
// TODO(kit 합치기): 엔진 키트(skills/lecpage/engine/src/kit/)가 들어오면 아래 줄을
//   export { assemble, inspect, inspectRendered, readMeta, themeFromCss, KIT_TYPES, KIT_FEATURES } from '@engine/src/kit/index.js';
// 로 바꾸고 kit-shim.js를 지웁니다. inspectRendered는 숨은 틀 안에서 문자열로 돌리므로(render-check.js) 바깥 것을 쓰지 않는 함수여야 하고,
// 그렇지 않으면 엔진이 INSPECT_RENDERED_JS(틀에 넣을 스크립트 글)를 내보내게 해서 render-check.js에서 그것을 씁니다.
export { assemble, inspect, inspectRendered, readMeta, themeFromCss, KIT_TYPES, KIT_FEATURES } from './kit-shim.js';
export const KIT_SHIM = true;
