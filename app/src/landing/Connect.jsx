import { useRef } from 'preact/hooks';
import { useInView } from './motion.js';
import { Ic } from './icons.jsx';

/**
 * 구독 계정 연결: lecpage.com ⇄ PC 프로그램 ⇄ ChatGPT·Claude 계정. 화면에 들어오면 선을 따라 신호가 흐르고 짝 맞춤·로그인 표시가 켜져요.
 * 그 밖의 길(API 키 · Claude Code·Codex · AI 에이전트 Skill)은 아래 한 칸. 동작 줄이기면 다 켜진 정지 모습.
 */
export function Connect() {
  const box = useRef();
  useInView(box);
  return (
    <section class="ld-conn" aria-labelledby="ld-conn-h">
      <header class="ld-conn-head">
        <p class="ld-kicker">AI 연결</p>
        <h2 id="ld-conn-h">쓰던 ChatGPT·Claude 구독으로 바로 만들어요</h2>
        <p>API 키를 따로 만들지 않아요. 작은 프로그램 lecpage 커넥트가 lecpage.com과 저절로 짝을 맞춰요. 내 계정으로 로그인하면 끝이에요. 사용량은 그 계정의 요금제에서 써요.</p>
      </header>
      <div class="ld-conn-map" ref={box}>
        <div class="ld-node ld-node-web"><span class="ld-node-ic"><Ic n="web" /></span><b>lecpage.com</b><small>교재 넣기 · 미리보기 · 배포</small></div>
        <i class="ld-wire" aria-hidden="true" />
        <div class="ld-node ld-node-pc"><span class="ld-node-ic"><Ic n="plug" /></span><b>lecpage 커넥트</b><small class="ld-pair">짝 맞춤 완료</small></div>
        <i class="ld-wire" aria-hidden="true" />
        <div class="ld-node ld-node-ai"><span class="ld-node-ic"><Ic n="user" /></span><b>ChatGPT · Claude</b><small class="ld-login">내 계정으로 로그인</small></div>
      </div>
      <ol class="ld-conn-steps">
        <li><b>lecpage 커넥트 실행</b><span>Windows·Mac·Linux에서 한 번 받아 실행해요.</span></li>
        <li><b>저절로 짝 맞춤</b><span>lecpage.com이 다시 열리며 이 PC와 연결돼요.</span></li>
        <li><b>계정으로 로그인</b><span>로그인하면 바로 만들기가 시작돼요.</span></li>
      </ol>
      <div class="ld-conn-more">
        <article><h3>다른 방법</h3><p>API 키 연결, PC의 Claude Code·Codex, AI 에이전트에 넣는 lecpage Skill로도 만들어요. 어느 길이든 끝은 같은 앱이에요.</p></article>
      </div>
    </section>
  );
}
