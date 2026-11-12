import { useMemo } from 'preact/hooks';
import qrcode from 'qrcode-generator';

/**
 * QR 코드 SVG 문자열(주소에 #k=암호가 붙어 있어도 됨).
 * 오류 정정 M(15%), 둘레 여백 4칸(QR 규격의 quiet zone)을 그림 안에 넣어 어두운 바탕·붙여 넣은 문서에서도 읽힘. 언제나 흰 바탕에 검은 점.
 */
export function qrSvg(text, { margin = 4, dark = '#000', light = '#fff' } = {}) {
  const q = qrcode(0, 'M'); q.addData(String(text || ''), 'Byte'); q.make();
  const n = q.getModuleCount(); const size = n + margin * 2;
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + margin} ${r + margin}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="${light}"/><path d="${d}" fill="${dark}"/></svg>`;
}

export function QR({ text, size = 200, label = 'QR 코드' }) {
  const svg = useMemo(() => qrSvg(text), [text]);
  const src = useMemo(() => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg), [svg]);
  return <img class="qr" src={src} width={size} height={size} alt={label} />;
}

/** QR을 PNG로 저장·복사할 때 쓸 Blob(1024px: A4 안내문·발표 자료에 넣어도 또렷함) */
export async function qrPng(text, px = 1024) {
  const svg = qrSvg(text);
  const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await img.decode();
  const c = document.createElement('canvas'); c.width = c.height = px;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(img, 0, 0, px, px);
  return new Promise((res) => c.toBlob(res, 'image/png'));
}

/** QR 그림을 클립보드에 복사(PPT·한글·카톡에 바로 붙여 넣게). 브라우저가 막으면 false */
export async function copyQr(text) {
  try {
    if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') return false;
    // Safari는 누른 그 자리에서 write를 불러야 해서 Blob을 약속(Promise)으로 넘김
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': qrPng(text) })]);
    return true;
  } catch { return false; }
}
