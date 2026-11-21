import { useEffect, useState } from 'preact/hooks';
import { Dialog } from './ui.jsx';
import { useConsentAsk, answerConsent, consentText } from '../lib/connection.js';

// 연결 동의 창: 길마다 처음 연결할 때 한 번(lib/connection.js askConsent). 세 줄 안내 + 체크 하나 + [연결] → 바로 로그인·키 넣기로
export function ConsentHost() {
  const a = useConsentAsk();
  const [ok, setOk] = useState(false);
  useEffect(() => { setOk(false); }, [a]);
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
