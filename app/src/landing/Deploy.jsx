import { useRef } from 'preact/hooks';
import { useInView } from './motion.js';
import { Qr } from './LiveDay.jsx';

const ITEMS = [
  ['가입 없이 바로 배포', '회원가입 없이 버튼 한 번으로 인터넷 주소가 생겨요.'],
  ['배포 전 점검', '예시 주소나 지난 날짜처럼 놓치기 쉬운 곳을 배포 전에 알려 줘요.'],
  ['배포 방법별 개인정보 안내', '배포할 곳에 맞는 참가자 개인정보 안내를 함께 붙여요.'],
  ['QR 안내문 · 접속 확인 · 프롬프트 모음', '강의실에 붙일 안내문, 전날 Wi-Fi 점검 쪽, 실습 프롬프트 모음까지 만들어요.'],
  ['내 계정에도', 'Vercel·GitHub Pages·Netlify·Cloudflare에도 배포해요.'],
];

/**
 * 배포·QR: [배포하기]가 주소로 바뀌고 QR 안내문 위에 QR이 칸칸이 찍혀요(화면에 들어올 때 한 번). 오른쪽은 배포가 해 주는 일 목록.
 * QR은 lecpage.com(진짜로 찍혀요). 동작 줄이기면 다 찍힌 정지 모습.
 */
export function Deploy() {
  const box = useRef();
  useInView(box);
  return (
    <section class="ld-dep" ref={box} aria-labelledby="ld-dep-h">
      <div class="ld-dep-vis" aria-hidden="true">
        <div class="ld-dep-btn"><span class="ld-dep-go">배포하기</span><span class="ld-dep-url"><i />주소가 생겼어요<em>복사</em></span></div>
        <div class="ld-poster">
          <small>누리솔교육연수원 · 12월 9일(수) 14:00</small>
          <b>질문이 먼저, AI는 그다음</b>
          <Qr cls="ld-qr ld-qr-big" />
          <span>휴대폰 카메라로 찍으면 연수 사이트가 열려요</span>
        </div>
      </div>
      <div class="ld-dep-t">
        <p class="ld-kicker">배포와 QR</p>
        <h2 id="ld-dep-h">누르면 배포, 주소와 QR까지</h2>
        <ul class="ld-dep-list">{ITEMS.map(([h, p], i) => <li style={{ '--k': i }}><h3>{h}</h3><p>{p}</p></li>)}</ul>
      </div>
    </section>
  );
}
