import { useEffect, useRef, useState } from 'preact/hooks';
import { useInView } from './motion.js';
import { useSeen } from './motion-more.js';
import { shot, shotSize } from './facts.js';

/**
 * 배포하면 주소와 QR: 진짜로 찍히는 QR(이 앱에 들어 있는 예시 사이트로 감)과, 휴대폰 안에서 천천히 내려가는 참가자 화면(실제 예시 사이트를 찍은 그림).
 * QR 그리는 코드는 이 구간에 가까워질 때 받아요(첫 화면을 가볍게). 휴대폰 화면은 휴대폰 그림이 화면 안에 들어왔을 때만 움직여요
 * (휴대폰 너비에서는 구간이 길어, 구간을 보면 그림이 아직 화면 밖일 때 움직이기 시작함).
 */
export function Reach() {
  const box = useRef(); const phone = useRef();
  const near = useInView(box, { margin: '500px 0px', once: true });
  const on = useSeen(phone, { amount: 0.6 });
  const [qr, setQr] = useState('');
  const url = new URL('examples/data-lab/index.html', location.href.split('#')[0]).href;
  useEffect(() => {
    if (!near) return;
    import('../components/QR.jsx').then((m) => setQr('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(m.qrSvg(url)))).catch(() => { });
  }, [near]);
  const sz = shotSize('phone-data-lab');
  return (
    <section class="ld-reach" ref={box} aria-labelledby="ld-reach-h">
      <div class="ld-reach-t">
        <header class="ld-head">
          <h2 id="ld-reach-h">배포하면 바로<br />주소와 QR이 나와요</h2>
        </header>
        <p class="ld-sub">배포할 곳은 lecpage가 골라 줘요. [배포하기]를 누르면 카톡 안내 문구도 함께 나오고, 주소가 실제로 열리는지도 확인해요. 참가자는 회원가입 없이 QR로 들어와요.</p>
        <dl class="ld-facts">
          <div><dt>배포할 곳</dt><dd>Vercel·GitHub Pages·Netlify는 앱에서 바로 배포하고, 기관 서버·USB에는 ZIP으로 옮겨요.</dd></div>
          <div><dt>공개 범위</dt><dd>주소를 받은 사람만(기본) · 암호를 아는 사람만 · 누구나</dd></div>
          <div><dt>다시 배포</dt><dd>고친 뒤 [다시 배포하기]를 한 번 눌러요. 주소는 그대로예요.</dd></div>
        </dl>
      </div>
      <div class="ld-reach-vis">
        <figure class="ld-qr">
          {qr ? <img src={qr} width="168" height="168" alt="예시 연수 사이트로 가는 QR" /> : <span class="ld-qr-wait" />}
          <figcaption><b>휴대폰 카메라로 찍어 보세요</b><span>예시 연수 사이트가 열려요.</span><a href="examples/data-lab/index.html" target="_blank" rel="noopener">예시 사이트 새 창으로 열기</a></figcaption>
        </figure>
        <div class={`ld-phone${on ? ' is-on' : ''}`} ref={phone} aria-hidden="true">
          <i class="ld-phone-notch" />
          <div class="ld-phone-screen">{near && <img src={shot('phone-data-lab')} alt="" width={sz.w} height={sz.h} decoding="async" />}</div>
        </div>
      </div>
    </section>
  );
}
