// 교재 넣기 한도(앱, 파일 하나). 넘으면 그 줄에 "○MB가 넘어 읽지 않았어요"로 알리고 읽지 않음.
// 숫자는 실측한 크기에 여유를 두고(2026-11-24, Chromium·RAM 16GB·4코어, 사진이 큰 가짜 교재로 넣기 → 쪽 그림 → 저장 → 새로 고침 → 만들기 → 미리보기):
//   PDF  148·296·489MiB(100·200·300쪽): 32초·57초·89초, 탭 메모리 최고 1.2·1.7·2.3GB  → 500MB
//   PPTX 148·296·488MiB(100·200·300쪽): 54초·117초·186초, 탭 메모리 최고 2.1·2.6·3.5GB → 300MB(488MiB는 3.5GB라 올리지 않음)
//   DOCX 125·312MiB(60·150쪽): 30초·70초, 1.5·2.9GB                                    → 200MB(312MiB는 2.9GB라 올리지 않음)
// 올린 한도는 잰 조건에 가까운 기기에서만(roomy): 메모리 8GB 이상으로 알려 주는 Chromium 계열(navigator.deviceMemory >= 8, 이 값은 8이 상한)이고 휴대폰·태블릿이 아닐 때.
// 메모리가 적거나, 그 값을 알려 주지 않는 브라우저(Safari·Firefox), 휴대폰은 재지 못했으므로 예전 한도(100MB)와 예전 도구 한도 그대로(탭이 죽는 대신 예전처럼 알리거나 글자만 읽음).
// 한글(HWP·HWPX)과 그 밖의 형식은 큰 파일을 재지 못해 어디서나 100MB.
// 예전에 100MB 위에서 막히던 까닭: Chromium은 IndexedDB 한 값이 약 127MiB를 넘으면 받지 않음(→ db.js가 큰 바이트를 Blob으로 담음),
// PPTX 그리기 도구의 권장 한도가 그림 합계 192MiB(→ render-doc.js가 roomy일 때만 PPTX 한도에 맞춰 넓힘).
export const MB = 1024 * 1024;
export const OLD_MAX_MB = 100;
export const PDF_MAX_MB = 500;
export const PPTX_MAX_MB = 300;
export const DOCX_MAX_MB = 200;
const PPT = new Set(['pptx', 'ppsx', 'pptm', 'potx']);
const DOC = new Set(['docx', 'docm']);
const extOf = (name) => (String(name || '').split('.').pop() || '').toLowerCase();

/** 휴대폰·태블릿인지(브라우저가 알려 주는 값 먼저, 없으면 이름표로) */
function mobile(nav) {
  try {
    if (typeof nav?.userAgentData?.mobile === 'boolean') return nav.userAgentData.mobile || /Android/i.test(String(nav.userAgent || ''));
    return /Mobi|Android|iPhone|iPad|iPod/i.test(String(nav?.userAgent || ''));
  } catch { return true; }
}
/**
 * 올린 한도를 잰 조건에 드는 기기인지: 메모리 8GB 이상으로 알려 주는 Chromium 계열 데스크톱.
 * nav: 시험용(기본은 이 브라우저의 navigator)
 */
export function roomy(nav = globalThis.navigator) {
  try { return +nav?.deviceMemory >= 8 && !mobile(nav); } catch { return false; }
}
/** 이 파일 형식이 받는 가장 큰 크기(MB) */
export function fileMaxMB(name, nav) {
  if (!roomy(nav)) return OLD_MAX_MB;
  const ext = extOf(name);
  return ext === 'pdf' ? PDF_MAX_MB : PPT.has(ext) ? PPTX_MAX_MB : DOC.has(ext) ? DOCX_MAX_MB : OLD_MAX_MB;
}
/**
 * 엔진 읽기(ingest)에 줄 한도. 조건 밖 기기는 null → 엔진의 기본 한도 그대로(파일 100MB·풀린 크기 600MB·항목 200MB)
 * @returns {{ maxBytes: number, limits: { maxUncompressed: number, maxEntryBytes: number } } | null}
 */
export function readLimits(nav) {
  if (!roomy(nav)) return null;
  const top = PDF_MAX_MB * MB;
  return { maxBytes: top, limits: { maxUncompressed: 3 * top, maxEntryBytes: top } };
}
/**
 * PPTX 그리기 도구(@aiden0z/pptx-renderer)에 줄 ZIP 한도. 조건 밖 기기는 null → 도구의 권장 한도 그대로
 * (그림 합계 192MiB를 넘으면 예전처럼 쪽 그림 없이 글자만 읽음 — 탭이 죽지 않게)
 */
export function pptxZipLimits(nav) {
  if (!roomy(nav)) return null;
  const top = PPTX_MAX_MB * MB;
  return { maxEntryUncompressedBytes: top, maxTotalUncompressedBytes: Math.round(top * 1.25), maxMediaBytes: top };
}
export const tooBigFile = (f) => f.size > fileMaxMB(f.name) * MB;
export const tooBigNote = (f) => `${fileMaxMB(f.name)}MB가 넘어 읽지 않았어요. 나눠서 올려 주세요.`;
