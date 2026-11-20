// 사이트 폴더(약속 A)에 들어갈 수 있는 파일 이름. 가벼운 모듈(앱 첫 화면·.lecpage 열기에서도 씀)

/** 엔진이 만드는 쪽(AI가 같은 이름을 쓰면 뺌) */
export const ENGINE_PAGES = ['console.html', 'screen.html', 'poster.html', 'check.html', 'privacy.html'];
/** 엔진이 만드는 파일 */
export const ENGINE_FILES = new Set(['_headers', '_redirects', 'robots.txt', 'assets/lecpage.js', 'assets/live.js', 'assets/kit.css', 'assets/qr.js', 'assets/boot.js', 'assets/theme.css', 'assets/lecpage.css', 'assets/aux-pages.css', 'assets/screen.js', 'assets/check.js', 'assets/console.js', 'assets/favicon.svg', 'assets/event.ics', 'assets/fx.js', 'assets/fx.css']);
/**
 * 받는 꼴: 맨 위의 *.html · assets/(세 단계까지)의 css·js·json·그림(png·jpg·webp·gif·avif, SVG 아님)·글꼴·영상·소리 ·
 * material/p-NNN.webp(교재 쪽 그림) · files/(자료실, 엔진 USER_ASSET과 같은 형식)
 */
export const SITE_FILE = /^(?:[\w가-힣.\-]{1,100}\.html|assets\/(?:[\w가-힣.\-() ]{1,80}\/){0,3}[\w가-힣.\-() ]{1,120}\.(?:css|js|mjs|json|png|jpe?g|webp|gif|avif|woff2?|ttf|otf|mp4|webm|mp3|m4a|vtt|txt)|material\/p-\d{3,4}\.(?:webp|png|jpe?g)|(?:assets\/)?files\/[\w가-힣ㄱ-ㅎㅏ-ㅣ.\-()\[\] ]{1,140}\.(?:png|jpe?g|gif|webp|avif|pdf|mp3|m4a|mp4|webm|pptx?|ppsx|docx?|hwpx?|xlsx?|csv|txt|md|zip|key|pages|numbers|odt|odp|ods))$/i;

/** 사이트 파일 이름 검사: 받을 수 있는 경로·형식만(SVG·숨김 파일·'..'·엔진 파일 이름 빼기) */
export function siteFileOk(p) {
  return typeof p === 'string' && SITE_FILE.test(p) && !p.includes('..') && !p.includes('//') && !/(^|\/)\./.test(p) && !ENGINE_FILES.has(p) && !ENGINE_PAGES.includes(p);
}
/** 교재 쪽 그림 경로: material/p-001.webp */
export const pagePath = (n) => `material/p-${String(n).padStart(3, '0')}.webp`;
