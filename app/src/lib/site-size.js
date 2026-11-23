// 사이트 크기와 올릴 곳의 한도: 바로 배포 서버가 알려 준 한도로 보기, '교재 원본 다운로드 허용'의 큰 원본 빼기, 그것을 알리는 한 줄.
// 다른 모듈을 불러오지 않음(앱의 배포 화면과 Node 시험이 같이 씀). deploy.js가 다시 내보냄
const MBS = 1024 * 1024;
/** 크기를 읽기 쉬운 글로(1MB 아래는 KB) */
export const sizeText = (n) => (n >= MBS ? `${Math.round(n / MBS)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`);
/**
 * 바로 배포 서버가 알려 준 한도(/api/info의 limits)로 사이트 크기를 봄. 엔진의 E.checkHost와 같은 꼴({ ok, errors }).
 * 숫자는 서버 것을 그대로 씀(서버 한도가 바뀌어도 앱을 고치지 않게)
 * @param {{ bytes: number, maxFile: number, files: number, kept?: number }} stat siteStat() 결과(kept: 웹 문서(HTML)·영상·소리의 합계)
 * @param {{ maxBytes?: number, maxFileBytes?: number, maxFiles?: number, maxMediaBytes?: number }} lim
 */
export function instantFit(stat, lim = {}) {
  const errors = []; const up = (n) => Math.ceil(n / MBS); const cap = (n) => Math.floor(n / MBS);
  if (lim.maxBytes && stat.bytes > lim.maxBytes) errors.push(`사이트가 ${up(stat.bytes)}MB예요. 바로 배포에는 ${cap(lim.maxBytes)}MB까지 올릴 수 있어요.`);
  if (lim.maxFileBytes && stat.maxFile > lim.maxFileBytes) errors.push(`${up(stat.maxFile)}MB짜리 파일이 있어요. 바로 배포에는 파일 하나가 ${cap(lim.maxFileBytes)}MB까지예요. 영상은 유튜브 링크로 바꾸면 좋아요.`);
  if (lim.maxFiles && stat.files > lim.maxFiles) errors.push(`파일이 ${stat.files.toLocaleString('en-US')}개예요. 바로 배포에는 ${lim.maxFiles.toLocaleString('en-US')}개까지 올릴 수 있어요.`);
  // 서버가 따로 보는 합계(hosting MAX_MEDIA_BYTES: 영상·소리와 웹 문서는 사이트마다 이만큼까지). 올리기 전에 알려 하루 몫을 쓰고 거절당하지 않게
  if (lim.maxMediaBytes && stat.kept > lim.maxMediaBytes) errors.push(`영상·소리 파일과 웹 문서(HTML)가 합쳐 ${up(stat.kept)}MB예요. 바로 배포에는 이 둘을 합쳐 ${cap(lim.maxMediaBytes)}MB까지 올릴 수 있어요. 영상은 유튜브 같은 곳에 올려 링크로 넣으면 좋아요.`);
  return { ok: !errors.length, errors };
}
/**
 * '교재 원본 다운로드 허용'으로 사이트에 넣는 원본 가운데 올릴 곳의 한도에 걸리는 것을 고름. 크기 때문에 배포가 실패하지 않게 원본만 빼고,
 * 교재 쪽 그림과 사이트 파일은 절대 빼지 않음(참가자는 교재 슬라이드에서 모든 쪽을 봄).
 *  1 파일 하나 한도(maxFileBytes)를 넘는 원본은 뺌
 *  2 그래도 사이트 전체(maxBytes)를 넘으면 남은 원본을 큰 것부터 뺌
 * @param {{ name: string, size: number }[]} originals
 * @param {number} baseBytes 원본을 뺀 사이트 크기(모르면 0: 1번만 봄)
 * @param {{ maxBytes?: number, maxFileBytes?: number }} lim
 * @returns {{ keep: object[], left: object[] }} 넣을 것과 뺀 것(넣은 순서 그대로)
 */
export function fitOriginals(originals, baseBytes = 0, lim = {}) {
  const left = new Set();
  for (const o of originals) if (lim.maxFileBytes && o.size > lim.maxFileBytes) left.add(o);
  if (lim.maxBytes) {
    let total = baseBytes + originals.reduce((n, o) => n + (left.has(o) ? 0 : o.size), 0);
    for (const o of [...originals].filter((x) => !left.has(x)).sort((a, b) => b.size - a.size)) { if (total <= lim.maxBytes) break; left.add(o); total -= o.size; }
  }
  return { keep: originals.filter((o) => !left.has(o)), left: originals.filter((o) => left.has(o)) };
}
/**
 * 뺀 원본을 알리는 한 줄(배포하기 화면·완료 카드가 같이 씀). left: [{ name, size, full }]
 * '참가자는 교재 슬라이드에서 모든 쪽을 볼 수 있어요'는 뺀 원본 모두가 그런 교재일 때만 덧붙임(full: slidesCover로 파일마다 확인한 값).
 * 하나라도 아니면(글자만 읽은 교재·쪽 그림을 일부만 그린 교재·교재 슬라이드가 없는 사이트) '넣지 않아요'에서 끝냄
 */
export function leftLine(left, { after = false } = {}) {
  if (!left?.length) return '';
  const names = left.slice(0, 2).map((o) => `${o.name}(${sizeText(o.size)})`).join(', ') + (left.length > 2 ? ` 외 ${left.length - 2}개` : '');
  // 끝이 '…MB)'·'…KB)'·'… 외 N개'라 조사는 늘 '는'
  return `${names}는 커서 사이트에 ${after ? '넣지 않았어요' : '넣지 않아요'}.${left.every((o) => o.full === true) ? ' 참가자는 교재 슬라이드에서 모든 쪽을 볼 수 있어요.' : ''}`;
}
/**
 * 원본을 사이트에 넣지 않아도 참가자가 그 교재의 모든 쪽을 교재 슬라이드에서 볼 수 있는지(그럴 때만 그렇게 말함).
 *  - 사이트에 쪽을 고르지 않은 교재 슬라이드가 있고(deckAll: data-pages 없는 data-lp="deck" → 놓인 쪽 그림을 모두 보여 줌)
 *  - 이 교재의 쪽 그림 묶음(set: { first, count })이 끝 쪽까지 그려졌으며: 쪽 수(pages)만큼 있고, 그리다 멈추거나 몫이 모자라 일부만 그린 것(slidesPart)이 아니고,
 *    모든 교재를 합친 쪽 그림 몫(maxSlides)의 끝에 닿지 않았고(닿았으면 뒤가 잘렸을 수 있음)
 *  - 그 번호의 쪽 그림이 사이트에 모두 놓여 있음(pageNums: 사이트의 material/p-NNN 번호)
 * @param file 그 쪽 그림을 그린 교재 줄({ pages, slidesPart }) · set: 그 교재의 묶음(없으면 false)
 */
export function slidesCover(file, set, { pageNums = [], deckAll = false, maxSlides = 400 } = {}) {
  if (!deckAll || !file || !set || !(set.count > 0) || !(set.first > 0)) return false;
  const end = set.first + set.count - 1;
  if (file.slidesPart || !(file.pages > 0) || set.count < file.pages || end >= maxSlides) return false;
  const have = new Set(pageNums);
  for (let n = set.first; n <= end; n++) if (!have.has(n)) return false;
  return true;
}

/**
 * 작은 파일을 묶음으로 나눔(바로 배포: 요청 하나에 파일 여럿 — 글꼴 조각 수백 개를 파일마다 요청하지 않게).
 * 묶음 하나는 합계 bytes 이하·파일 수 files 이하, 넣은 순서 그대로. 묶음 하나보다 큰 것은 넣지 않음(부른 쪽이 하나씩 보냄)
 * @param {[string, number][]} items [sha256, 크기][]
 * @param {{ bytes: number, files?: number }} lim 서버가 알려 준 묶음 한도(/api/info limits.bundle)
 * @returns {[string, number][][]}
 */
export function bundlesOf(items, { bytes, files = 500 } = {}) {
  const out = []; let cur = []; let size = 0;
  for (const it of items) {
    if (!(bytes > 0) || it[1] > bytes) continue;
    if (cur.length && (size + it[1] > bytes || cur.length >= files)) { out.push(cur); cur = []; size = 0; }
    cur.push(it); size += it[1];
  }
  if (cur.length) out.push(cur);
  return out;
}
/**
 * 묶음 요청의 본문(서버 hosting/src/site.js uploadBundle과 같은 모양): [머리 길이 4바이트(큰 끝)] [머리 JSON: [[sha256, 크기], …]] [내용을 그 순서대로].
 * Blob으로 이어 붙여 내용을 한 덩어리로 다시 복사하지 않음
 * @param {[string, number, Uint8Array][]} items
 */
export function packBundle(items) {
  const head = new TextEncoder().encode(JSON.stringify(items.map(([h, n]) => [h, n])));
  const len = new Uint8Array(4); new DataView(len.buffer).setUint32(0, head.length);
  return new Blob([len, head, ...items.map((x) => x[2])], { type: 'application/octet-stream' });
}
