import { useEffect, useState } from 'preact/hooks';
import { Dialog } from './ui.jsx';
import { useConsentAsk, answerConsent, consentText } from '../lib/connection.js';

// 연결 동의 창: 길마다 처음 연결할 때 한 번(lib/connection.js askConsent). 세 줄 안내 + 체크 하나 + [연결] → 바로 로그인·키 넣기로
export function ConsentHost() {
  const a = useConsentAsk();
  const [ok, setOk] = useState(false);
  useEffect(() => { setOk(false); }, [a]);
  // 창이 열린 채 다른 화면으로 가면(브라우저 뒤로 가기 등) 묻던 것을 '닫음'으로 끝냄: 안 그러면 다음에 들어간 화면에서 누르지도 않은 동의 창이 다시 뜸
  useEffect(() => () => { answerConsent(false); }, []);
  const t = a && consentText(a.id);
  return (
    <Dialog open={!!t} onClose={() => answerConsent(false)} label={t?.title || '연결'}>
      {t && <div class="stack consent">
        <h2 class="h-sub">{t.title}</h2>
        <ul class="consent-lines">{t.lines.map((x) => <li>{x}</li>)}</ul>
        <label class="check consent-ok"><input type="checkbox" checked={ok} data-autofocus onChange={(e) => setOk(e.currentTarget.checked)} /><span>위 내용을 확인했고 동의해요</span></label>
        <p class="small muted"><a href="#/help/terms" target="_blank" rel="noopener">이용약관</a> · <a href="#/help/privacy" target="_blank" rel="noopener">개인정보 처리방침</a></p>
        <div class="btn-row"><button type="button" class="btn btn-primary" disabled={!ok} onClick={() => answerConsent(true)}>연결</button><button type="button" class="btn btn-quiet" onClick={() => answerConsent(false)}>닫기</button></div>
      </div>}
    </Dialog>
  );
}
