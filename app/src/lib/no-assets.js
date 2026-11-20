// 자료 없이 그리는 작은 그림·움직이는 미리보기(디자인 카드·말로 찾기·크게 비교)용 설계도.
// 설계도 속 쪽 그림·자료 주소(assets/…)를 비움: 비우지 않으면 srcdoc 틀이 앱 주소로 그 파일을 받으려다 404·ORB 차단이 나고
// 쪽 그림 자리가 빈칸이 됨(비우면 엔진이 그 쪽을 글 쪽으로 그림). 미리보기(Preview)·배포는 진짜 자료를 넣으므로 쓰지 않음
import { E } from './engine.js';

export const noAssets = (bp) => E.dropMissingAssets(bp, []).blueprint;
