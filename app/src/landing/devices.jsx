// 기기 틀 공통 조각(첫 화면 휴대폰과 이야기 장면 휴대폰이 같이 써요)
export const lightBar = (hex) => { const n = parseInt(hex.slice(1), 16); return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 150; };

export function StatusIcons() {
  return (
    <svg viewBox="0 0 66 12">
      <rect x="0" y="7.5" width="3" height="4" rx=".8" /><rect x="4.4" y="5.5" width="3" height="6" rx=".8" /><rect x="8.8" y="3.2" width="3" height="8.3" rx=".8" /><rect x="13.2" y=".8" width="3" height="10.7" rx=".8" />
      <circle cx="27" cy="10" r="1.5" /><path class="ld-wifi" d="M23.9 7.1a4.4 4.4 0 0 1 6.2 0M20.9 4.1a8.6 8.6 0 0 1 12.2 0" />
      <rect class="ld-batt" x="38.5" y="1.5" width="23" height="9.5" rx="2.8" /><rect x="40.6" y="3.6" width="16.4" height="5.3" rx="1.4" /><rect class="ld-batt-nub" x="62.6" y="4.6" width="1.8" height="3.3" rx=".9" />
    </svg>
  );
}
