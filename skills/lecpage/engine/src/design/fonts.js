// 생성 사이트가 쓰는 글꼴 목록. 모두 상업적 이용이 가능한 무료 글꼴(OFL 등)만 둡니다.
// css: 외부 스타일시트(버전 고정), face: 직접 @font-face를 만들 때의 파일 목록
const GF = (q) => `https://fonts.googleapis.com/css2?${q}&display=swap`;

export const FONTS = {
  pretendard: {
    family: 'Pretendard Variable', label: 'Pretendard', kind: 'sans', license: 'OFL-1.1',
    css: 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css',
    fallback: "'Pretendard', -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', system-ui, sans-serif",
  },
  suit: {
    family: 'SUIT Variable', label: 'SUIT', kind: 'sans', license: 'OFL-1.1',
    css: 'https://cdn.jsdelivr.net/gh/sun-typeface/SUIT@2.0.5/fonts/variable/woff2/SUIT-Variable.css',
    fallback: "'Pretendard Variable', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif",
  },
  wanted: {
    family: 'Wanted Sans Variable', label: 'Wanted Sans', kind: 'sans', license: 'OFL-1.1',
    css: 'https://cdn.jsdelivr.net/gh/wanteddev/wanted-sans@v1.0.3/packages/wanted-sans/fonts/webfonts/variable/split/WantedSansVariable.min.css',
    fallback: "'Pretendard Variable', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif",
  },
  gmarket: {
    family: 'GmarketSans', label: 'G마켓 산스', kind: 'display', license: 'OFL-1.1 (G마켓 공식 배포)',
    face: [
      { weight: 700, url: 'https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2001@1.1/GmarketSansBold.woff' },
    ],
    fallback: "'Pretendard Variable', 'Apple SD Gothic Neo', sans-serif",
  },
  maruburi: {
    family: 'MaruBuri', label: '마루 부리', kind: 'serif', license: '네이버 글꼴 라이선스(상업 이용 가능)',
    css: 'https://hangeul.pstatic.net/hangeul_static/css/maru-buri.css',
    fallback: "'Noto Serif KR', 'AppleMyungjo', 'Batang', serif",
  },
  notoSerif: { family: 'Noto Serif KR', label: 'Noto Serif KR', kind: 'serif', license: 'OFL-1.1', css: GF('family=Noto+Serif+KR:wght@400;600;800'), fallback: "'AppleMyungjo', 'Batang', serif" },
  hahmlet: { family: 'Hahmlet', label: '함렛', kind: 'serif', license: 'OFL-1.1', css: GF('family=Hahmlet:wght@300..900'), fallback: "'Noto Serif KR', serif" },
  gowunBatang: { family: 'Gowun Batang', label: '고운바탕', kind: 'serif', license: 'OFL-1.1', css: GF('family=Gowun+Batang:wght@400;700'), fallback: "'Noto Serif KR', serif" },
  gowunDodum: { family: 'Gowun Dodum', label: '고운돋움', kind: 'sans', license: 'OFL-1.1', css: GF('family=Gowun+Dodum'), fallback: "'Pretendard Variable', sans-serif" },
  jua: { family: 'Jua', label: '주아', kind: 'display', license: 'OFL-1.1', css: GF('family=Jua'), fallback: "'Pretendard Variable', sans-serif" },
  gaegu: { family: 'Gaegu', label: '개구', kind: 'hand', license: 'OFL-1.1', css: GF('family=Gaegu:wght@400;700'), fallback: "'Pretendard Variable', sans-serif" },
  blackHan: { family: 'Black Han Sans', label: '검은고딕', kind: 'display', license: 'OFL-1.1', css: GF('family=Black+Han+Sans'), fallback: "'Pretendard Variable', sans-serif" },
  doHyeon: { family: 'Do Hyeon', label: '도현', kind: 'display', license: 'OFL-1.1', css: GF('family=Do+Hyeon'), fallback: "'Pretendard Variable', sans-serif" },
  gasoek: { family: 'Gasoek One', label: '가석', kind: 'display', license: 'OFL-1.1', css: GF('family=Gasoek+One'), fallback: "'Black Han Sans', sans-serif" },
  orbit: { family: 'Orbit', label: '오르빗', kind: 'display', license: 'OFL-1.1', css: GF('family=Orbit'), fallback: "'Pretendard Variable', sans-serif" },
  plexKr: { family: 'IBM Plex Sans KR', label: 'IBM Plex Sans KR', kind: 'sans', license: 'OFL-1.1', css: GF('family=IBM+Plex+Sans+KR:wght@400;500;600;700'), fallback: "'Pretendard Variable', sans-serif" },
  plexMono: { family: 'IBM Plex Mono', label: 'IBM Plex Mono', kind: 'mono', license: 'OFL-1.1', css: GF('family=IBM+Plex+Mono:wght@400;500;600'), fallback: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
  jetbrains: { family: 'JetBrains Mono', label: 'JetBrains Mono', kind: 'mono', license: 'OFL-1.1', css: GF('family=JetBrains+Mono:wght@400;600'), fallback: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
  spaceGrotesk: { family: 'Space Grotesk', label: 'Space Grotesk', kind: 'latin', license: 'OFL-1.1', css: GF('family=Space+Grotesk:wght@400;500;700'), fallback: 'system-ui, sans-serif' },
  fraunces: { family: 'Fraunces', label: 'Fraunces', kind: 'latin-serif', license: 'OFL-1.1', css: GF('family=Fraunces:opsz,wght@9..144,400..800'), fallback: 'Georgia, serif' },
  bricolage: { family: 'Bricolage Grotesque', label: 'Bricolage Grotesque', kind: 'latin', license: 'OFL-1.1', css: GF('family=Bricolage+Grotesque:opsz,wght@12..96,400..800'), fallback: 'system-ui, sans-serif' },
};

export function fontStack(key) {
  const f = FONTS[key];
  if (!f) return FONTS.pretendard.fallback;
  return `'${f.family}', ${f.fallback}`;
}

/** 글꼴 키 목록 → <link> 태그용 URL 목록과 @font-face CSS */
export function fontAssets(keys) {
  const links = []; let faceCss = '';
  for (const k of [...new Set(keys.filter(Boolean))]) {
    const f = FONTS[k]; if (!f) continue;
    if (f.css) links.push(f.css);
    if (f.face) for (const fc of f.face) {
      faceCss += `@font-face{font-family:'${f.family}';src:url('${fc.url}') format('woff');font-weight:${fc.weight};font-display:swap}\n`;
    }
  }
  return { links: [...new Set(links)], faceCss };
}
