// 첫 화면이 뜬 뒤 한가할 때 따로 받는 일(첫 화면 JS 크기에 들지 않음): 운영자 공지 한 번, 익명 이용 합계(앱 열기, 하루 한 번)
import { trackOpenOncePerDay } from './stats.js';
import { showNotice } from '../components/NoticeBar.jsx';

export function afterLoad() {
  trackOpenOncePerDay();
  showNotice().catch(() => { });
}
