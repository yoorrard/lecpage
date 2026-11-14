// 운영자가 켠 '바로 배포' 서버 주소(hosting/README.md).
// 빌드 변수 VITE_PUBLISH_API가 있으면 그 값. 없으면 운영자의 앱 주소(lecpage.com·GitHub Pages 미러)에서 열렸을 때만 운영 서버를 씀.
// 포크나 다른 주소에서는 비어 있어 바로 배포·익명 합계·공지가 보이지 않음(서버도 운영자 앱 주소에서 온 요청만 받음)
const OPERATOR_HOSTS = ['lecpage.com', 'www.lecpage.com', 'yoorrard.github.io'];
const OPERATOR_API = 'https://lecpage-sites.lecpage.workers.dev';
const host = typeof location === 'undefined' ? '' : location.hostname;
export const PUBLISH_API = String(import.meta.env?.VITE_PUBLISH_API || (OPERATOR_HOSTS.includes(host) ? OPERATOR_API : '')).replace(/\/+$/, '');
