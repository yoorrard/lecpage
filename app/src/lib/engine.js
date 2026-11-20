// 엔진(skills/lecpage/engine)을 앱에서 쓰기: 배포 화면(바로 배포·글꼴 담기·잠그기·ZIP·참여 기능 연결)이 쓰는 엔진 묶음과 실행 파일.
// 조립·검수는 키트(lib/gen/kit.js) 한 곳. 실행 파일(runtime)도 그곳의 것을 같이 씀(처음 쓸 때 한 번만 받음).
import * as E from '@engine/src/index.js';

export { E };
export { kitRuntime as loadRuntime } from './gen/kit.js';
