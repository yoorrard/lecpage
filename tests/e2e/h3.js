// 새 흐름용 배포 e2e 공용: share-pass/h2.js(가짜 Vercel·GitHub·Netlify·is.gd)를 그대로 쓰고,
// 배포하기 화면까지 가는 길(openShare)만 새 흐름으로: 교재 넣기 → 쓰던 앱(키 없이)으로 받은 답 → 완성 → 연수 정보 확인 → 배포하기
const H = require('./h2.js');
const FIX = require('path').resolve(__dirname, '../../skills/lecpage/engine/test/fixtures/workshop.pdf');
const BASE = process.env.BASE || H.BASE;
const ANSWER = '```html\n<!doctype html>\n<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>마음이 먼저 도착하는 교실</title><style>:root{--lp-accent:#7a3e9d;--lp-ink:#221b26;--lp-paper:#fbf8fd}body{margin:0;font-family:system-ui,sans-serif;background:var(--lp-paper);color:var(--lp-ink)}main{max-width:900px;margin:0 auto;padding:24px}</style></head><body><main>\n<section id="hello" data-title="첫 화면"><h1>마음이 먼저 도착하는 교실</h1><p>사회정서학습 연수</p><div data-lp="join"></div></section>\n<section id="talk" data-title="나눔"><h2>나눔</h2><div data-lp="poll" data-question="오늘 마음 날씨는?" data-options=\'["맑음","흐림","비"]\'></div><div data-lp="board" data-prompt="한 줄 소감"></div></section>\n<section id="ask" data-title="질문"><h2>질문</h2><div data-lp="qa"></div></section>\n</main></body></html>\n```\n```json\n{"v":2,"title":"마음이 먼저 도착하는 교실","sessions":[{"date":"2027-03-17","start":"14:00","end":"15:30"}],"venue":"강당","features":["qa","poll","board","attendance"],"instructors":[{"name":"김하늘","org":"한빛초"}]}\n```';

async function openShare(p) {
  await p.goto(BASE, { waitUntil: 'load' });
  await p.setInputFiles('.ld-hero input[type=file][multiple]', [FIX]);
  await p.waitForSelector('.ai-nokey .btn:not([disabled])', { timeout: 90000 });
  await p.click('.ai-nokey button:has-text("쓰던 ChatGPT로")');
  await p.fill('#chat-way textarea', ANSWER);
  await p.click('#chat-way button:has-text("이 답으로 만들기")');
  await p.waitForSelector('.st-info button:has-text("이 정보가 맞아요")', { timeout: 30000 });
  await p.click('.st-info button:has-text("이 정보가 맞아요")');
  await p.click('.head-tools button:has-text("배포하기")');
  await p.waitForSelector('.publish', { timeout: 30000 });
}

module.exports = { ...H, BASE, openShare };
