import { useRef } from 'preact/hooks';
import { useInView } from './motion.js';
import { EX } from './facts.js';

/**
 * 연수 당일: 참가자 휴대폰에서 질문이 올라가고, 발표 화면에 투표 결과가 차오르는 장면(예시 화면).
 * 질문 문구·투표 수는 그림을 위한 예시이고, 투표 질문과 보기는 예시 연수에서 옮겼어요. 이 구간이 보일 때만 움직여요.
 */
const VOTES = [11, 7, 4, 2];
const QS = ['피벗 테이블은 구글 시트에서도 되나요?', '학생 이름은 어떻게 가리면 좋을까요?'];
const FEATURES = [
  ['질문 받기', '이름 없이 올리고, 공감이 많은 질문부터 답해요'],
  ['투표·워드클라우드', '결과는 강사가 공개할 때 보여요'],
  ['나눔 보드', '글·사진·파일로 결과물을 모아요'],
  ['도움 요청·진행 현황', '실습에서 막힌 자리를 강사 화면에 알려요'],
  ['발표 화면', '큰 QR·질문·투표 결과·이름 뽑기·모둠·타이머'],
  ['강사 화면', '질문 관리·공지·이수자 명단 CSV'],
];
export function LiveDay() {
  const box = useRef();
  const on = useInView(box, { margin: '-10% 0px' });
  const total = VOTES.reduce((a, b) => a + b, 0);
  return (
    <section class="ld-live" aria-labelledby="ld-live-h">
      <div class="ld-live-t">
        <header class="ld-head">
          <p class="ld-kicker">연수 당일</p>
          <h2 id="ld-live-h">휴대폰으로 묻고,<br />화면으로 함께 봐요</h2>
        </header>
        <p class="ld-sub">참가자는 휴대폰으로 질문을 남기고 투표해요. 강사는 강사 화면에서 질문을 고르고, 발표 화면에 결과를 띄워요. 참여 기능은 강사님 계정(구글 시트·Supabase·Cloudflare 등)에 바로 연결해, lecpage 운영자는 참가자 기록을 보지 않아요.</p>
        <dl class="ld-feat">{FEATURES.map(([a, b]) => <div><dt>{a}</dt><dd>{b}</dd></div>)}</dl>
      </div>
      <div class={`ld-live-vis${on ? ' is-on' : ''}`} ref={box} aria-hidden="true">
        <div class="ld-screen">
          <div class="ld-screen-head"><b>잠깐 투표</b><span>발표 화면 · 예시</span></div>
          <p class="ld-screen-q">{EX.poll.q}</p>
          <ul class="ld-bars">{EX.poll.options.map((o, i) => <li style={{ '--v': VOTES[i] / total, '--i': i }}><span>{o}</span><i /><b>{VOTES[i]}</b></li>)}</ul>
          <div class="ld-screen-side"><i class="ld-mini-qr" /><small>QR로 들어와요</small></div>
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
