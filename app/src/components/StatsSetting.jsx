// 설정: 익명 이용 합계 끄기. 바로 배포 서버가 켜진 앱에서만 보입니다(그 밖에는 보내는 것이 없음).
import { useState } from 'preact/hooks';
import { statsAvailable, statsOff, setStatsOff } from '../lib/stats.js';
import { toast } from '../lib/util.js';

export function StatsSetting() {
  const [on, setOn] = useState(() => !statsOff());
  if (!statsAvailable()) return null;
  const change = (v) => { setOn(v); setStatsOff(!v); toast(v ? '익명 이용 합계를 보내요.' : '익명 이용 합계를 보내지 않아요.'); };
  return (
    <section>
      <h2 class="h-sub">이용 합계</h2>
      <label class="check"><input type="checkbox" checked={on} onChange={(e) => change(e.target.checked)} /><span>익명 이용 합계 보내기 <span class="small muted">앱 열기·만들기·배포가 하루에 몇 번인지 숫자만 운영자 서버에 더해요. 누가 했는지, 교재 내용, 주소는 보내지 않아요. <a href="#/help/privacy">개인정보 안내</a></span></span></label>
    </section>
  );
}
