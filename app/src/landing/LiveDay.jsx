import { useEffect, useRef, useState } from 'preact/hooks';
import { useInView } from './motion.js';
import { useSeen } from './motion-more.js';
import { EX } from './example.js';

/**
 * 연수 당일: 참가자 휴대폰에서 질문이 올라가고, 발표 화면에 투표 결과가 차오르는 장면(예시 화면).
 * 발표 화면은 엔진의 발표 화면(screen.html)과 같은 짜임: 위 막대(연수명·상태) · 큰 질문과 결과 막대 · 오른쪽 '휴대폰으로 참여' QR.
 * 질문 문구·투표 수는 그림을 위한 예시이고, 투표 질문과 보기는 예시 연수에서 옮겼어요. 그림이 화면 안에 60% 넘게 들어왔을 때만 움직여요(막대가 화면 밖에서 차오르지 않게).
 * 발표 화면의 QR은 진짜로 찍히는 QR(예시 연수 사이트로 감). 그리는 코드는 이 구간에 가까워질 때 받아요(배포 장면과 같은 모듈).
 */
const VOTES = [11, 7, 4, 2];
const QS = ['피벗 테이블은 구글 시트에서도 되나요?', '학생 이름은 어떻게 가리면 좋을까요?'];
const FEATURES = [
  ['질문 받기', '이름 없이 올리고, 공감이 많은 질문부터 답해요'],
  ['투표·워드클라우드', '결과는 강사가 공개할 때 보여요'],
  ['나눔 보드', '글·사진·파일로 결과물을 모아요'],
  ['도움 요청·진행 현황', '실습에서 막힌 자리를 강사 화면에 알려요'],
  ['발표 화면', '큰 QR·질문·투표 결과·이름 뽑기·모둠·타이머'],
  ['강사 화면', '질문 고르기·공지·출석·이수자 명단 CSV'],
];
export function LiveDay() {
  const box = useRef();
  const on = useSeen(box, { amount: 0.6 });
  const near = useInView(box, { margin: '600px 0px', once: true });
  const [qr, setQr] = useState('');
  useEffect(() => {
    if (!near) return;
    // 짧은 주소(폴더)로: 점이 적어 작은 그림에서도 또렷함
    const url = new URL('examples/data-lab/', location.href.split('#')[0]).href;
    import('../components/QR.jsx').then((m) => setQr('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(m.qrSvg(url, { margin: 1 })))).catch(() => { });
  }, [near]);
  const total = VOTES.reduce((a, b) => a + b, 0), top = Math.max(...VOTES);
  return (
    <section class="ld-live" aria-labelledby="ld-live-h">
      <div class="ld-live-t">
        <header class="ld-head">
          <p class="ld-kicker">연수 당일</p>
          <h2 id="ld-live-h">휴대폰으로 묻고,<br />화면으로 함께 봐요</h2>
        </header>
        <p class="ld-sub">참가자는 휴대폰으로 질문을 남기고 투표해요. 강사는 강사 화면에서 질문을 고르고, 투표 결과를 발표 화면에 띄워요. 모두 연수 사이트 안이라 참가자는 다른 서비스에 가입하지 않아요.</p>
        <dl class="ld-feat">{FEATURES.map(([a, b]) => <div><dt>{a}</dt><dd>{b}</dd></div>)}</dl>
      </div>
      <div class={`ld-live-vis${on ? ' is-on' : ''}`} ref={box} aria-hidden="true">
        <div class="ld-screen">
          <div class="ld-scr-top"><b>{EX.title}</b><span>진행 중</span></div>
          <div class="ld-scr-main">
            <p class="ld-scr-q">{EX.poll.q}</p>
            <ol class="ld-bars">{EX.poll.options.map((o, i) => <li class={VOTES[i] === top ? 'is-top' : ''} style={{ '--v': VOTES[i] / total, '--i': i }}><span>{o}</span><b>{Math.round((VOTES[i] / total) * 100)}%<small>{VOTES[i]}명</small></b><i /></li>)}</ol>
            <p class="ld-scr-meta">응답 {total}명</p>
          </div>
          <div class="ld-scr-rail"><b>휴대폰으로 참여</b><i class="ld-mini-qr">{qr && <img src={qr} alt="" width="96" height="96" />}</i></div>
        </div>
        <div class="ld-phone ld-phone-live">
          <i class="ld-phone-notch" />
          <div class="ld-phone-screen ld-qa">
            <b class="ld-qa-h">궁금한 점을 남겨 주세요</b>
            <small class="ld-qa-lead">이름 없이 올라가요.</small>
            <div class="ld-qa-input"><span class="ld-typing">{QS[0]}</span><i class="ld-send">보내기</i></div>
            <ul class="ld-qa-list">
              <li class="ld-qa-new"><span>{QS[0]}</span><small>공감 1</small></li>
              <li><span>{QS[1]}</span><small>공감 6</small></li>
              <li><span>차트는 몇 가지만 알면 되나요?</span><small>공감 3</small></li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
