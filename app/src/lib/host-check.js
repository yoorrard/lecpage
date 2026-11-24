// 바로 배포 서버가 거절하는 내용(422 unsafe_site)을 배포 전에 브라우저에서 미리 봄. 규칙은 서버와 같은 코드(hosting/src/sitecheck.js)를 그대로 씀:
// 비밀번호 칸·로그인 화면 흉내·바깥으로 보내는 양식·글자 가림·서비스 워커·쿠키 쓰기·보조 쪽의 사이트 스크립트.
// 검수(gen/job.js inspectSite)에 문제로 넣어 [AI에게 고쳐 달라기]로 잇고, 바로 배포는 올리기 전에 멈춤(components/Publish.jsx). 서버 검사는 그대로 둠.
import { listProblems } from '@hosting/sitecheck.js';
import { ENGINE_FILES } from '@engine/src/kit/paths.js';

// 암호로 잠근 사이트에 lecpage가 넣는 잠금 풀기 스크립트(engine/src/protect.js). 조립이 아니라 잠글 때 들어가는 파일이라 ENGINE_FILES에는 없음.
// 이것을 사이트 스크립트로 보면 잠근 강사·발표·안내문 쪽마다 '보조 쪽의 사이트 스크립트'로 걸려, 암호 사이트는 바로 배포를 올리기도 전에 막혔음(2026-11-20~24)
const LOCK_FILES = new Set(['assets/unlock.js']);
/** 엔진 런타임이 아닌 .js(사이트가 직접 쓴 스크립트·조립이 옮긴 인라인 스크립트) */
export const isOwnScript = (path) => /\.m?js$/i.test(path) && !ENGINE_FILES.has(path) && !LOCK_FILES.has(path);

/** 조립 결과 → 서버 규칙에 걸리는 곳(파일마다 처음 하나) */
export function hostProblems(files) {
  try { return listProblems(files || {}, { isOwnScript }); } catch (e) { console.error('[host-check]', e); return []; }
}

/** HTML 안 위치 → 그 위치를 품은 섹션 id(없으면 '') */
function sectionAt(html, at) {
  if (typeof html !== 'string' || !(at >= 0)) return '';
  let id = '';
  const re = /<section\b[^>]*?\bid\s*=\s*["']?([\w-]+)/gi; let m;
  while ((m = re.exec(html)) && m.index <= at) id = m[1];
  if (!id) return '';
  // 그 섹션이 위치보다 앞에서 닫혔으면 섹션 밖
  const open = html.lastIndexOf('<section', at); const close = html.lastIndexOf('</section', at);
  return close > open ? '' : id;
}

/** 검수 문제 꼴(issue)로: 고칠 섹션을 찾으면 where.section(키로 연결한 AI가 그 섹션만 고침) */
export function hostIssues(files) {
  return hostProblems(files).map((x) => {
    const v = files[x.path];
    const html = typeof v === 'string' ? v : v && /\.html?$/i.test(x.path) ? new TextDecoder().decode(v) : '';
    return { id: `host-${x.rule}`, level: 'error', where: { file: x.path, selector: '', section: sectionAt(html, x.at) }, message_ko: x.message_ko, fix_hint_ko: '바로 배포 서버가 받지 않는 내용이에요. 이 부분을 빼 주세요.' };
  });
}
