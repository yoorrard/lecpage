// 교재 넣기 한도(앱, 파일 하나). 넘으면 그 줄에 "○MB가 넘어 읽지 않았어요"로 알리고 읽지 않음.
// 숫자는 실측한 크기까지만 올림(2026-11-24, Chromium·RAM 16GB·4코어, 사진이 큰 가짜 교재로 넣기 → 쪽 그림 → 저장 → 새로 고침 → 만들기 → 미리보기):
//   PDF  148·296·489MiB(100·200·300쪽): 32초·57초·89초, 탭 메모리 최고 1.2·1.7·2.3GB
//   PPTX 148·296·488MiB(100·200·300쪽): 54초·117초·186초, 탭 메모리 최고 2.1·2.6·3.5GB
//   DOCX 125·312MiB(60·150쪽): 30초·70초, 1.5·2.9GB
//   교재 둘(PDF 489 + PPTX 488MiB): 읽기·만들기 됨. 하나를 빼고 다시 읽을 때 탭 메모리 최고 5.0GB였던 것은 남은 교재의 원본만 꺼내게 고침(Start.jsx)
// 그보다 큰 것·한글(HWP·HWPX)의 큰 파일은 재지 못해 예전 한도(100MB) 그대로.
// 올린 한도는 잰 조건에서만: 메모리 8GB 이상으로 알려 주는 Chromium 계열(navigator.deviceMemory >= 8). 메모리가 적거나 그 값을 알려 주지 않는 브라우저(Safari·Firefox)는 재지 못했으므로 예전 한도(100MB) 그대로.
// 예전에 100MB 위에서 막히던 까닭: Chromium은 IndexedDB 한 값이 약 127MiB를 넘으면 받지 않음(→ db.js가 큰 바이트를 Blob으로 담음),
// PPTX 그리기 도구의 권장 한도가 그림 합계 192MiB(→ render-doc.js가 이 한도에 맞춰 넓힘).
export const MB = 1024 * 1024;
const BIG = new Set(['pdf', 'pptx', 'ppsx', 'pptm', 'potx']);
const roomy = () => { try { return +globalThis.navigator?.deviceMemory >= 8; } catch { return false; } };
const extOf = (name) => (String(name || '').split('.').pop() || '').toLowerCase();
/** 이 파일 형식이 받는 가장 큰 크기(MB) */
export function fileMaxMB(name) {
  const ext = extOf(name);
  if (BIG.has(ext)) return roomy() ? 500 : 100;
  if (ext === 'docx' || ext === 'docm') return roomy() ? DOCX_MAX_MB : 100;
  return 100;
}
export const DOCX_MAX_MB = 300;
/** 가장 큰 한도(엔진 읽기·그리기 도구의 안전 한도를 여기에 맞춤) */
export const FILE_MAX_MB = 500;
export const FILE_MAX = FILE_MAX_MB * MB;
export const tooBigFile = (f) => f.size > fileMaxMB(f.name) * MB;
export const tooBigNote = (f) => `${fileMaxMB(f.name)}MB가 넘어 읽지 않았어요. 나눠서 올려 주세요.`;
