import { useMemo } from 'preact/hooks';
import qrcode from 'qrcode-generator';

/** QR 코드 SVG 문자열(주소에 #k=암호가 붙어 있어도 됨) */
export function qrSvg(text, { margin = 2, dark = '#000', light = '#fff' } = {}) {
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

/** QR을 PNG로 저장할 때 쓸 Blob */
export async function qrPng(text, px = 1024) {
  const svg = qrSvg(text);
  const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await img.decode();
  const c = document.createElement('canvas'); c.width = c.height = px;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(img, 0, 0, px, px);
  return new Promise((res) => c.toBlob(res, 'image/png'));
}
