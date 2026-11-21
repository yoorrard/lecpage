// lecpage.com(https://lecpage.com/) QR 칸(25×25, 오류 정정 M). 랜딩의 발표 화면·배포 장면에 그려요(QR 도구를 받지 않게 미리 계산).
// 다시 만들려면(app 폴더): qrcode-generator로 (0,'M') · addData('https://lecpage.com/') · make() 한 뒤 줄마다 0·1을 36진수로
const ROWS = 'jtsov,a669t,ekkt9,ekt3x,ek95p,a7fwh,jvfy7,2hhc,eu9a4,79nvm,f7dmz,j5k35,3oel3,er3my,a8t4r,amwtt,dlnn8,2h3s,jtu8n,a7iu1,eku7r,el5gf,el2ml,a6f09,jvse7';
/** 줄마다 '0101…'(1 = 검은 칸) */
export const QR = ROWS.split(',').map((s) => parseInt(s, 36).toString(2).padStart(25, '0'));
/** SVG path(d): 검은 칸을 줄마다 이어 붙인 사각형 */
export const qrPath = () => QR.map((row, y) => {
  let d = '';
  for (let x = 0; x < row.length;) {
    if (row[x] !== '1') { x++; continue; }
    let w = 1; while (row[x + w] === '1') w++;
    d += `M${x} ${y}h${w}v1h-${w}z`; x += w;
  }
  return d;
}).join('');
