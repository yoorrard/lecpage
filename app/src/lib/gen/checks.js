// 검수(job.js inspectSite)에 더하는 검사 한 곳: 생성 단계 구조와 상관없이 조립 결과·AI 파일만 봄.
//  - 바로 배포 서버가 거절하는 내용(비밀번호 칸·로그인 흉내·바깥 양식·글자 가림·서비스 워커·쿠키 쓰기): 서버와 같은 코드(hosting/src/sitecheck.js, lib/host-check.js)
// 문제는 검수 문제 꼴(issue)이라 검수 탭의 [AI에게 고쳐 달라기]로 이어짐(섹션이 정해지면 키로 연결한 AI가 그 섹션만 고침)
import { hostIssues } from '../host-check.js';

/** @returns {Promise<issue[]>} */
export async function extraIssues(pid, files, site, meta, project = null) {
  const out = [];
  if (files) out.push(...hostIssues(files));
  return out;
}
