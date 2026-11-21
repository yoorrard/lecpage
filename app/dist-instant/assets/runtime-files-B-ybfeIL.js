const r=`/* lecpage 보조 화면: 강사 화면(console) · 발표 화면(screen) · QR 안내문(poster) · 접속 확인(check) · 개인정보 처리 안내(privacy).
   색·글꼴·단추·상자 모양은 참가자 화면과 같은 theme.css·lecpage.css(프리셋 data-*)를 그대로 씁니다. 여기는 쪽마다의 배치만.
   규칙(references/design-quality.md): 상자는 떼어 낼 수 있는 패널에만, 위계는 글자 크기·굵기·가는 선으로, 강조색 하나, 한쪽 색 띠·알약 꼬리표 없음. */

/* ═══ 공통 ═══ */
/* 모티프 장식 줄(강사 화면 들어가기·QR 안내문): 색은 theme.css 변수만 */
.lp-motif{display:block;width:100%;height:100%}
.lp-motif .a{fill:var(--primary)}.lp-motif .b{fill:var(--accent)}.lp-motif .c{fill:var(--accent-2)}.lp-motif .f{fill:var(--foreground)}
.lp-mrule{width:100%;height:100%;overflow:visible}
.lp-body-con,.lp-body-scr,.lp-body-doc,.lp-body-pst{min-height:100vh;min-height:100dvh}
.lp-ax-bar{position:sticky;top:0;z-index:40;padding-top:env(safe-area-inset-top,0px);background:color-mix(in srgb,var(--background) 92%,transparent);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border-bottom:1px solid var(--rule-c)}
.lp-ax-in{display:flex;align-items:center;gap:12px;max-width:1160px;min-height:56px;margin:0 auto;padding:6px max(16px,env(safe-area-inset-right,0px)) 6px max(16px,env(safe-area-inset-left,0px))}
/* 보조 화면 머리 왼쪽: 무슨 화면인지(작게) 위에, 연수 제목 아래 — 강사 화면·안내문·접속 확인·개인정보가 같은 꼴 */
.lp-ax-id{display:flex;align-items:center;gap:12px;flex:1 1 12em;min-width:0}
.lp-ax-id > span:last-child{display:grid;min-width:0;line-height:1.3}
.lp-ax-id small{font-size:var(--fs-xs);font-weight:600;color:var(--muted-foreground)}
.lp-ax-id b{font-size:var(--fs-md);font-weight:700;letter-spacing:-.01em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lp-ax-act{margin-left:auto;display:flex;align-items:center;gap:6px}
.lp-ax-act .lp-btn{flex:none}
.lp-btn-danger{background:var(--danger);color:var(--background);border-color:transparent}
.lp-btn-danger:hover{background:color-mix(in srgb,var(--danger) 86%,var(--foreground))}
.lp-btn[aria-pressed="true"]{background:var(--foreground);color:var(--background);border-color:var(--foreground)}
.lp-btn:disabled{opacity:.5;cursor:not-allowed}
.lp-con-check{display:flex;align-items:center;gap:10px;min-height:44px;font-size:var(--fs-sm);font-weight:600;cursor:pointer}
.lp-con-check input{flex:none;width:20px;height:20px;margin:0;accent-color:var(--primary)}
/* 켜고 끄는 단추(role=switch): 상태를 글자로도("켜짐"·"꺼짐") */
.lp-switch{display:inline-flex;align-items:center;gap:10px;min-height:40px;padding:0;border:0;background:none;color:inherit;font:inherit;font-size:var(--fs-sm);font-weight:600;cursor:pointer;text-align:left}
.lp-switch i{position:relative;flex:none;width:40px;height:24px;border-radius:999px;background:color-mix(in srgb,var(--foreground) 22%,transparent);transition:background var(--dur-2)}
.lp-switch i::after{content:"";position:absolute;left:3px;top:3px;width:18px;height:18px;border-radius:50%;background:var(--background);box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform var(--dur-2) var(--ease-out)}
.lp-switch[aria-checked="true"] i{background:var(--primary)}
.lp-switch[aria-checked="true"] i::after{transform:translateX(16px);background:var(--primary-foreground)}
.lp-switch small{font-size:var(--fs-xs);font-weight:600;color:var(--muted-foreground)}
.lp-in{min-width:0;min-height:44px;padding:8px 12px;border-radius:var(--radius-sm);border:var(--border-w) solid color-mix(in srgb,var(--foreground) 26%,transparent);background:var(--background);color:var(--foreground)}
.lp-in:focus-visible{outline:2px solid var(--ring);outline-offset:1px}
.lp-in::placeholder{color:color-mix(in srgb,var(--muted-foreground) 85%,transparent)}
/* 연결 상태: 점 + 글자(색만으로 알리지 않음) */
:is(.lp-con-conn,.lp-scr-conn){display:inline-flex;align-items:center;gap:8px;margin:0;font-size:var(--fs-sm);font-weight:600;color:var(--muted-foreground);white-space:nowrap}
:is(.lp-con-conn,.lp-scr-conn) i{flex:none;width:10px;height:10px;border-radius:50%;background:color-mix(in srgb,var(--foreground) 35%,transparent)}
:is(.lp-con-conn,.lp-scr-conn)[data-state="live"] i{background:var(--success)}
:is(.lp-con-conn,.lp-scr-conn)[data-state="polling"] i{background:var(--warning)}
:is(.lp-con-conn,.lp-scr-conn)[data-state="local"] i{background:var(--primary)}
:is(.lp-con-conn,.lp-scr-conn)[data-state="offline"]{color:var(--danger)}
:is(.lp-con-conn,.lp-scr-conn)[data-state="offline"] i{background:var(--danger);animation:lp-blink 1.2s steps(2) infinite}

/* ═══ 강사 화면 ═══ */
.lp-con{min-height:100dvh;display:flex;flex-direction:column}
.lp-con-bar{position:sticky;top:0;z-index:40;padding-top:env(safe-area-inset-top,0px);background:color-mix(in srgb,var(--background) 94%,transparent);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border-bottom:1px solid var(--rule-c)}
.lp-con-bar-in{display:flex;flex-wrap:wrap;align-items:center;gap:8px 20px;max-width:1480px;margin:0 auto;padding:10px max(16px,env(safe-area-inset-right,0px)) 10px max(16px,env(safe-area-inset-left,0px))}
.lp-con-id{display:flex;align-items:center;gap:12px;flex:1 1 240px;min-width:0}
.lp-con-id h1{display:grid;min-width:0;font-family:var(--font-sans);font-size:var(--fs-md);font-weight:700;letter-spacing:-.01em;line-height:1.3}
.lp-con-id h1 small{font-size:var(--fs-xs);font-weight:600;color:var(--muted-foreground)}
.lp-con-id h1 span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lp-con-go{display:flex;flex-wrap:wrap;gap:8px}
.lp-con-go[hidden],.lp-con-conn[hidden]{display:none}
.lp-con-me{display:flex;align-items:center;gap:4px}
/* 더보기: 이름 + 한 줄 설명(설명 없이도 고를 수 있게). 들어간 뒤에만 보임 */
.lp-con-more{position:relative}
.lp-con-menu{position:absolute;right:0;top:calc(100% + 6px);z-index:60;list-style:none;display:grid;gap:2px;width:max-content;min-width:256px;max-width:min(340px,calc(100vw - 32px));padding:6px;border-radius:var(--radius);border:var(--border-w) solid var(--border);background:var(--card);color:var(--card-foreground);box-shadow:0 18px 48px rgba(0,0,0,.22)}
.lp-con-menu[hidden]{display:none}
.lp-con-menu :is(a,button){display:flex;align-items:flex-start;gap:12px;width:100%;min-height:44px;padding:10px 12px;border:0;border-radius:var(--radius-sm);background:none;color:inherit;font:inherit;text-align:left;text-decoration:none;cursor:pointer}
.lp-con-menu :is(a,button):hover{background:var(--tint)}
.lp-con-menu :is(a,button):focus-visible{background:var(--tint);outline:2px solid var(--ring);outline-offset:-2px}
.lp-con-menu .lp-ic{flex:none;margin-top:1px;color:var(--muted-foreground)}
.lp-con-menu span{display:grid;gap:1px;min-width:0}
.lp-con-menu b{font-size:var(--fs-sm);font-weight:700;line-height:1.4}
.lp-con-menu small{font-size:var(--fs-xs);line-height:1.45;color:var(--muted-foreground)}
/* 들어가기 */
/* 상자는 위에 붙임(가운데 맞춤이면 글꼴이 늦게 와 글 높이가 바뀔 때 상자 전체가 밀림) */
.lp-con-login{flex:1;display:grid;place-items:start center;padding:clamp(24px,7vh,88px) 16px}
.lp-con-login-card{display:grid;gap:12px;width:min(460px,100%);padding:clamp(24px,4vw,40px);box-shadow:var(--shadow)}
/* 강사용 화면이라는 것과 참가자 길: 열쇠 칸보다 먼저(휴대폰에서도 첫 화면에) */
.lp-con-for{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 12px;margin-bottom:6px;padding-bottom:16px;border-bottom:1px solid var(--rule-c);font-size:var(--fs-sm);font-weight:700;line-height:1.5}
.lp-con-for .lp-btn{flex:none}
@media (max-width:480px){.lp-con-for{flex-direction:column;align-items:flex-start}} /* 좁은 폭: 글과 단추를 늘 두 줄로(글꼴이 늦게 와 한 줄↔두 줄로 바뀌며 상자 안이 밀리지 않게) */
.lp-con-login-mark{width:144px;height:24px;margin-bottom:4px}
.lp-con-login-card h2{font-size:var(--fs-h2s);line-height:1.2}
.lp-con-login-lead{color:var(--muted-foreground);font-size:var(--fs-sm);line-height:1.65}
.lp-con-field{margin-top:6px;font-size:var(--fs-sm);font-weight:700}
.lp-con-keyrow{display:flex;gap:6px;align-items:center}
.lp-con-keyrow input{flex:1;min-width:0;min-height:52px;padding:10px 14px;border-radius:var(--radius-sm);border:var(--border-w) solid color-mix(in srgb,var(--foreground) 30%,transparent);background:var(--background);color:var(--foreground);font-family:var(--font-mono);letter-spacing:.04em}
.lp-con-keyrow input[aria-invalid="true"]{border-color:var(--danger);box-shadow:0 0 0 1px var(--danger)}
.lp-con-keyrow .lp-icon-btn{width:48px;height:48px}
.lp-con-hint{font-size:var(--fs-xs);line-height:1.6;color:var(--muted-foreground)}
.lp-con-hint[data-warn]{color:var(--foreground);font-weight:600}
.lp-con-msg{font-size:var(--fs-sm);font-weight:700;line-height:1.55;color:var(--danger)}
.lp-con-msg:empty{display:none}
.lp-con-noscript{max-width:460px;margin:24px auto;padding:0 16px;font-weight:700}
/* 대시보드: 맨 위 상자 → 지금 띠(읽는 것: 참가자·도움 요청·신호·실습 막힘·투표·질문 숫자) → 넓은 화면 두 단
   (왼쪽 질문·투표·보드, 오른쪽 진행(공지·타이머)·도움 요청·신호·실습 진행·참가자 화면(이끌기·자료 링크)·기록), 좁으면 한 단(자주 누르는 것·급한 것부터) */
.lp-con-main{width:100%;max-width:1480px;margin:0 auto;padding:16px max(16px,env(safe-area-inset-right,0px)) 32px max(16px,env(safe-area-inset-left,0px));display:grid;grid-template-columns:minmax(0,1fr);gap:16px;align-items:start}
.lp-con-main:focus{outline:0}
.lp-con-col{display:contents}
@media (min-width:1080px){
  .lp-con-main{grid-template-columns:minmax(0,7fr) minmax(360px,5fr)}
  .lp-con-strip{grid-column:1 / -1}
  .lp-con-col{display:grid;gap:16px;align-content:start;min-width:0}
}
@media (max-width:1079px){
  .lp-con-strip{order:0}
  /* 한 단: 공지·타이머 → 도움 요청 → 질문·투표(결과 공개) → 신호·실습 진행(숫자는 위 띠에) → 보드 → 이끌기·자료 링크 → 기록 */
  .lp-con-panel[data-area="pres"],.lp-con-panel[data-area="run"]{order:1}.lp-con-panel[data-area="att"],.lp-con-panel[data-area="help"]{order:2}.lp-con-panel[data-area="qa"]{order:3}.lp-con-panel[data-area="poll"]{order:4}
  .lp-con-panel[data-area="signal"]{order:5}.lp-con-panel[data-area="heat"]{order:6}.lp-con-panel[data-area="board"]{order:7}.lp-con-panel[data-area="lead"]{order:8}.lp-con-panel[data-area="data"]{order:9}
}
/* 맨 위 상자(console.js): 발표 화면(지금 보이는 것·참여 QR 크게) · 묻기 방식(연결·접속 확인) · 연수 뒤 */
.lp-con-net{grid-column:1 / -1;display:grid;min-width:0;padding:0 16px;border-radius:var(--radius-sm);border:var(--border-w) solid var(--rule-c);background:var(--card);color:var(--card-foreground);font-size:var(--fs-sm);line-height:1.6}
.lp-con-net-r{display:grid;gap:4px;min-width:0;padding:10px 0}
.lp-con-net-r + .lp-con-net-r{border-top:1px solid var(--rule-c)}
.lp-con-stage,.lp-con-after{display:flex;flex-wrap:wrap;align-items:center;gap:4px 16px}
.lp-con-stage > .lp-con-net-h,.lp-con-after > .lp-con-net-h{flex:1 1 18em;min-width:0}
.lp-con-stage > .lp-con-net-do{flex-basis:100%;font-weight:600}
.lp-con-net-act{display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px}
.lp-con-net-h{display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 10px;font-weight:600}
.lp-con-net-h b{font-size:var(--fs-xs);font-weight:700;color:var(--muted-foreground)}
.lp-con-net-do[hidden]{display:none}
.lp-con-net-ck{font-size:var(--fs-xs);color:var(--muted-foreground)}
.lp-con-net-ck a{color:inherit;font-weight:700;text-decoration:underline;text-underline-offset:2px}
.lp-con-net[data-state="polling"]{border-color:color-mix(in srgb,var(--warning) 55%,var(--rule-c))}
.lp-con-net[data-state="offline"]{border-color:var(--danger);background:color-mix(in srgb,var(--danger) 7%,var(--card))}
/* 넓은 화면: 발표 화면 | 묻기 방식을 나란히(위 상자가 낮아져 공지·타이머가 첫 화면에). '연수 뒤'는 아래 한 줄 */
@media (min-width:1080px){
  .lp-con-net{grid-template-columns:repeat(2,minmax(0,1fr));column-gap:24px;align-items:start}
  .lp-con-net-r + .lp-con-net-r{border-top:0}
  .lp-con-net > .lp-con-net-r:nth-child(2){padding-left:24px;border-left:1px solid var(--rule-c);align-self:stretch}
  .lp-con-net > .lp-con-after{grid-column:1 / -1;border-top:1px solid var(--rule-c)}
}
/* 지금 띠: 숫자 여섯~일곱 개를 가는 선으로 나눈 한 줄(누르면 그 칸으로) */
.lp-con-strip{display:grid;grid-template-columns:repeat(auto-fit,minmax(136px,1fr));gap:1px;overflow:hidden;border-radius:var(--radius);border:var(--border-w) solid var(--border);background:var(--rule-c)}
.lp-con-kpi{display:grid;gap:2px;align-content:start;min-width:0;padding:14px 18px 16px;background:var(--card);color:var(--card-foreground);text-decoration:none}
a.lp-con-kpi:hover{background:color-mix(in srgb,var(--foreground) 4%,var(--card))}
.lp-con-kpi span{order:-1;font-size:var(--fs-xs);font-weight:700;color:var(--muted-foreground)}
.lp-con-kpi b{font-family:var(--font-num);font-weight:var(--num-weight);font-size:clamp(1.75rem,1.2rem + 1.1vw,2.5rem);line-height:1.08;font-variant-numeric:tabular-nums;letter-spacing:-.01em}
.lp-con-kpi small{font-size:var(--fs-xs);color:var(--muted-foreground);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lp-con-kpi[data-alert]{background:color-mix(in srgb,var(--danger) 9%,var(--card))}
.lp-con-kpi[data-alert] b,.lp-con-kpi[data-alert] span{color:var(--danger)}
/* 패널: 떼어 낼 수 있는 상자(프리셋의 상자 모양 data-card를 따름) */
.lp-con-panel{display:grid;gap:14px;align-content:start;min-width:0;grid-template-columns:minmax(0,1fr);padding:clamp(16px,1.5vw,22px);scroll-margin-top:84px}
/* 패널 안 칸은 패널 폭을 넘지 않게(긴 실습 이름이 든 고르기 상자·글꼴이 넓은 프리셋) */
.lp-con-panel > div,.lp-con-sec{min-width:0;grid-template-columns:minmax(0,1fr)}
.lp-con-row > select.lp-in{flex:1 1 12em;width:0;max-width:100%}
.lp-con-ph{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;min-height:36px}
.lp-con-ph h2{font-family:var(--font-sans);font-size:var(--fs-md);font-weight:700;letter-spacing:-.01em;line-height:1.3}
.lp-con-ph h2 small{margin-left:.35em;font-family:var(--font-num);font-weight:var(--num-weight);font-variant-numeric:tabular-nums;color:var(--muted-foreground)}
.lp-con-ph-act{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;margin-left:auto}
.lp-con-sub{font-size:var(--fs-xs);line-height:1.6;color:var(--muted-foreground)}
.lp-con-sec{display:grid;gap:10px;padding-top:14px;border-top:1px solid var(--rule-c)}
.lp-con-sec > h3{font-family:var(--font-sans);font-size:var(--fs-xs);font-weight:700;letter-spacing:0;color:var(--muted-foreground)}
.lp-con-row{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.lp-con-row > .lp-in{flex:1 1 9em}
.lp-con-empty{padding:18px 0 6px;color:var(--muted-foreground);font-size:var(--fs-sm)}
/* 거르기(열림·답변 완료·숨김): 붙은 단추 줄 */
.lp-seg{display:inline-flex;flex-wrap:wrap;gap:2px;padding:2px;border-radius:var(--radius-sm);background:var(--tint)}
.lp-seg button{min-height:32px;padding:4px 10px;border:0;border-radius:calc(var(--radius-sm) - 2px);background:none;color:var(--muted-foreground);font-size:var(--fs-xs);font-weight:700;cursor:pointer}
.lp-seg button[aria-pressed="true"]{background:var(--card);color:var(--foreground);box-shadow:0 1px 2px rgba(0,0,0,.12)}
/* 목록(질문·도움 요청·보드 글): 상자 없이 줄과 가는 선 */
.lp-con-list{list-style:none;display:grid;max-height:min(64vh,620px);overflow:auto;overscroll-behavior:contain;border-top:1px solid var(--rule-c);scrollbar-gutter:stable}
.lp-con-item{display:grid;grid-template-columns:3.4rem minmax(0,1fr);gap:4px 12px;padding:12px 4px 12px 0;border-bottom:1px solid var(--rule-c)}
.lp-con-item.is-nov{grid-template-columns:minmax(0,1fr)}
.lp-con-v{grid-row:span 3;display:grid;justify-items:center;align-content:start;gap:0;padding-top:2px}
.lp-con-v b{font-family:var(--font-num);font-weight:var(--num-weight);font-size:1.5rem;line-height:1.1;font-variant-numeric:tabular-nums}
.lp-con-v span{font-size:var(--fs-xs);color:var(--muted-foreground)}
.lp-con-t{font-size:var(--fs-base);line-height:1.6;white-space:pre-line;overflow-wrap:anywhere;word-break:keep-all}
.lp-con-who{font-weight:700}
.lp-con-m{display:flex;flex-wrap:wrap;gap:0 .7em;font-size:var(--fs-xs);color:var(--muted-foreground)}
.lp-con-m b{color:var(--primary);font-weight:700}
.lp-con-m em{font-style:normal;font-weight:700;color:var(--foreground)}
.lp-con-a{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}
.lp-con-item.is-pinned{background:color-mix(in srgb,var(--primary) 6%,transparent)}
.lp-con-item.is-off .lp-con-t{color:var(--muted-foreground)}
/* 투표 */
.lp-con-poll{display:grid;gap:12px;padding:16px;border-radius:var(--radius-sm);background:color-mix(in srgb,var(--primary) 7%,var(--card))}
.lp-con-poll-h{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 12px}
.lp-con-poll-h p{flex:1 1 14em;font-size:var(--fs-md);font-weight:700;line-height:1.45;overflow-wrap:anywhere}
.lp-con-poll-h small{font-size:var(--fs-sm);font-weight:600;color:var(--muted-foreground)}
.lp-con-tally{list-style:none;display:grid;gap:10px}
.lp-con-tl{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 10px;align-items:baseline;font-size:var(--fs-sm)}
.lp-con-tl > span{overflow-wrap:anywhere}
.lp-con-tl > b{font-family:var(--font-num);font-weight:var(--num-weight);font-variant-numeric:tabular-nums}
.lp-con-tl > i{grid-column:1 / -1;display:block;height:10px;border-radius:2px;background:var(--tint);overflow:hidden}
.lp-con-tl > i::before{content:"";display:block;height:100%;width:var(--w,0%);background:var(--primary);transition:width var(--dur-4) var(--ease-out)}
.lp-con-words{display:flex;flex-wrap:wrap;gap:6px}
.lp-con-word{display:inline-flex;align-items:center;gap:6px;padding:2px 2px 2px 10px;border:1px solid var(--rule-c);border-radius:var(--radius-sm);font-size:var(--fs-sm)}
.lp-con-word.is-off{color:var(--muted-foreground);text-decoration:line-through}
.lp-con-polls{list-style:none;display:grid}
.lp-con-polls li{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;padding:10px 0;border-bottom:1px solid var(--rule-c)}
.lp-con-polls li > p{flex:1 1 12em;min-width:0;font-size:var(--fs-sm);font-weight:600;overflow-wrap:anywhere}
.lp-con-polls li > p small{display:block;font-weight:500;color:var(--muted-foreground)}
.lp-con-quick > summary{display:flex;align-items:center;gap:8px;min-height:44px;font-weight:700;font-size:var(--fs-sm);cursor:pointer;list-style:none}
.lp-con-quick > summary::-webkit-details-marker{display:none}
.lp-con-quick > summary .lp-ic{transition:transform var(--dur-2)}
.lp-con-quick[open] > summary .lp-ic{transform:rotate(45deg)}
.lp-con-quick form{display:grid;gap:8px;padding-top:4px}
.lp-con-opts{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px}
/* 투표·퀴즈: 지금 쪽에 묶인 투표, 퀴즈 정답 */
.lp-con-polls li.is-here{background:color-mix(in srgb,var(--primary) 7%,transparent);margin:0 -8px;padding-inline:8px;border-radius:var(--radius-sm)}
.lp-con-tl.is-answer > span{font-weight:800}
.lp-con-tl.is-answer > i::before{background:var(--success)}
/* 발표: 지금 쪽·다음 쪽 미리 보기, 넘기기, 발표 화면에 띄우기 */
.lp-con-deck{display:grid;grid-template-columns:minmax(0,3fr) minmax(0,1.2fr);gap:12px;align-items:start}
.lp-con-thumb{display:grid;gap:4px;margin:0;min-width:0}
.lp-con-thumb img{display:block;width:100%;aspect-ratio:var(--lp-deck-ratio,16/9);object-fit:contain;border-radius:var(--radius-sm);border:1px solid var(--rule-c);background:#111}
.lp-con-thumb figcaption{font-size:var(--fs-xs);font-weight:600;color:var(--muted-foreground);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lp-con-thumb.is-now figcaption{color:var(--foreground);font-size:var(--fs-sm)}
.lp-con-thumb.is-next{opacity:.85}
.lp-con-before{align-content:center;min-height:9rem;padding:16px;border-radius:var(--radius-sm);border:1px dashed var(--rule-c);background:var(--tint);font-weight:700}
.lp-con-pager{gap:8px}
.lp-con-pager > .lp-btn{min-width:6.5em}
.lp-con-pageno{min-width:5.5em;text-align:center;font-family:var(--font-num);font-weight:var(--num-weight);font-variant-numeric:tabular-nums;font-size:var(--fs-md)}
.lp-con-goto{margin-left:auto;flex-wrap:nowrap}
.lp-con-goto .lp-in{width:6em;flex:0 0 6em}
.lp-con-here{display:grid;gap:6px}
.lp-con-here:empty{display:none}
.lp-con-now-poll{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;padding:10px 12px;border-radius:var(--radius-sm);background:color-mix(in srgb,var(--primary) 9%,var(--card))}
.lp-con-now-poll p{flex:1 1 14em;font-size:var(--fs-sm);font-weight:700;overflow-wrap:anywhere}
.lp-con-ovs{display:flex;flex-wrap:wrap;gap:6px}
.lp-con-ovs button{min-height:40px;padding:6px 12px;border-radius:var(--radius-sm);border:var(--border-w) solid var(--rule-c);background:var(--card);color:var(--card-foreground);font:inherit;font-size:var(--fs-sm);font-weight:700;cursor:pointer}
.lp-con-ovs button[aria-pressed="true"]{background:var(--foreground);color:var(--background);border-color:var(--foreground)}
.lp-con-ovs button:focus-visible{outline:2px solid var(--ring);outline-offset:2px}
.lp-con-presets .lp-btn{white-space:nowrap}
/* 출석 명단 */
.lp-con-tbl-w{max-height:min(64vh,620px);overflow:auto;overscroll-behavior:contain;border-top:1px solid var(--rule-c)}
.lp-con-tbl{width:100%;border-collapse:collapse;font-size:var(--fs-sm)}
.lp-con-tbl :is(th,td){padding:8px 6px;text-align:left;vertical-align:middle;border-bottom:1px solid var(--rule-c)}
.lp-con-tbl thead th{position:sticky;top:0;z-index:1;background:var(--card);font-size:var(--fs-xs);font-weight:700;color:var(--muted-foreground)}
.lp-con-tbl tbody th{font-weight:700;overflow-wrap:anywhere}
.lp-con-tbl tbody th small{margin-left:.4em;padding:0 .4em;border-radius:4px;background:var(--tint);font-size:var(--fs-xs);font-weight:700;color:var(--muted-foreground)}
.lp-con-tbl .lp-con-at{font-family:var(--font-num);font-variant-numeric:tabular-nums;white-space:nowrap}
.lp-con-tbl .lp-con-at[title]{text-decoration:underline dotted;text-underline-offset:3px}
.lp-con-tbl .lp-con-a{display:table-cell;margin:0;text-align:right;white-space:nowrap}
.lp-con-tbl .lp-con-a .lp-btn + .lp-btn{margin-left:4px}
.lp-con-edit > td{background:color-mix(in srgb,var(--primary) 5%,var(--card))}
.lp-con-editf{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px 10px;align-items:end;padding:4px 0}
.lp-con-editf label{display:grid;gap:4px;font-size:var(--fs-xs);font-weight:700;color:var(--muted-foreground)}
.lp-con-editf > .lp-con-row,.lp-con-editf > .lp-con-sub{grid-column:1 / -1}
/* 진행: 공지·타이머·따라 넘기기 */
.lp-con-now{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;padding:10px 12px;border-radius:var(--radius-sm);background:var(--foreground);color:var(--background);font-weight:700;overflow-wrap:anywhere}
.lp-con-now p{flex:1 1 12em}
.lp-con-now .lp-btn{color:var(--background);border-color:color-mix(in srgb,var(--background) 45%,transparent)}
.lp-con-now .lp-btn:hover{background:color-mix(in srgb,var(--background) 14%,transparent)}
.lp-con-clock{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 14px}
.lp-con-clock b{font-family:var(--font-num);font-weight:var(--num-weight);font-size:clamp(2rem,1.4rem + 1.4vw,2.75rem);line-height:1;font-variant-numeric:tabular-nums}
.lp-con-clock[data-over] b{color:var(--danger)}
.lp-con-mats{list-style:none;display:grid}
.lp-con-mats li{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px solid var(--rule-c);font-size:var(--fs-sm)}
.lp-con-mats a{overflow-wrap:anywhere}
/* 신호·진행 현황 막대 */
.lp-sig{display:flex;height:16px;border-radius:3px;overflow:hidden;background:var(--tint)}
.lp-sig i{display:block;height:100%}
.lp-sig .g{background:#1f7a46}.lp-sig .y{background:#d9a400}.lp-sig .r{background:#c4302b}
.lp-sig-l{list-style:none;display:flex;flex-wrap:wrap;gap:4px 18px;font-size:var(--fs-sm)}
.lp-sig-l li{display:inline-flex;align-items:center;gap:6px}
.lp-sig-l i{display:inline-grid;place-items:center;width:1.25em;height:1.25em;border-radius:50%;font-style:normal;font-weight:800;font-size:.8em;color:#fff}
.lp-sig-l .g{background:#1f7a46}.lp-sig-l .y{background:#d9a400;color:#111}.lp-sig-l .r{background:#c4302b}
.lp-sig-l b{font-family:var(--font-num);font-variant-numeric:tabular-nums}
.lp-heat{list-style:none;display:grid;gap:10px}
.lp-heat li{display:grid;grid-template-columns:minmax(6em,10em) minmax(0,1fr);gap:4px 12px;align-items:center;font-size:var(--fs-sm)}
.lp-heat li > span{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lp-heat li > small{grid-column:2;font-size:var(--fs-xs);color:var(--muted-foreground)}
.lp-heat-bar{display:flex;height:12px;border-radius:3px;overflow:hidden;background:var(--tint)}
.lp-heat-bar i{display:block;height:100%}
.lp-heat-bar .done{background:var(--success)}.lp-heat-bar .doing{background:var(--primary)}.lp-heat-bar .stuck{background:var(--danger)}
/* 기록·정리 */
.lp-con-dl{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:6px}
.lp-con-dl .lp-btn{justify-content:flex-start}
.lp-con-join{display:grid;grid-template-columns:auto minmax(0,1fr);gap:14px;align-items:center}
.lp-con-join .lp-qr{width:112px}
.lp-con-join dl{display:grid;gap:6px;margin:0;font-size:var(--fs-sm)}
.lp-con-join dt{font-size:var(--fs-xs);font-weight:700;color:var(--muted-foreground)}
.lp-con-join dd{margin:0;font-family:var(--font-mono);overflow-wrap:anywhere}
.lp-con-help{width:100%;max-width:1480px;margin:0 auto 32px;padding:0 max(16px,env(safe-area-inset-right,0px)) 0 max(16px,env(safe-area-inset-left,0px))}
.lp-con-help > summary{display:flex;align-items:center;min-height:48px;font-weight:700;cursor:pointer;border-top:1px solid var(--rule-c)}
.lp-con-help .lp-prose{max-width:72ch;padding:4px 0 16px}
.lp-con-dlg p{line-height:1.65}
/* 휴대폰에서 열기: QR은 [QR 보이기]를 누를 때만(관리자 키가 들어 있음) */
.lp-con-phone-box{display:grid;place-items:center;min-height:248px;padding:16px;border-radius:var(--radius-sm);background:var(--tint)}
.lp-con-phone-box[hidden],.lp-con-phone-box > [hidden]{display:none}
.lp-con-phone-box .lp-qr{width:min(232px,100%);aspect-ratio:1;background:#fff;padding:0;border-radius:var(--radius-sm)}
.lp-con-phone-box .lp-qr svg{width:100%;height:100%}
.lp-con-phone-cover{display:grid;justify-items:center;gap:10px;max-width:30ch;text-align:center;font-size:var(--fs-sm);font-weight:600}
.lp-con-phone-cover > .lp-ic{width:28px;height:28px;color:var(--muted-foreground)}
/* 칸 이동 줄·질문 접기: 휴대폰에서만(console.js) */
.lp-con-jump,.lp-con-fold{display:none}
@media (max-width:640px){
  .lp-con-jump{display:flex;gap:4px;position:sticky;top:0;z-index:30;margin:0 -16px;padding:8px 16px;overflow-x:auto;scrollbar-width:none;background:color-mix(in srgb,var(--background) 95%,transparent);border-bottom:1px solid var(--rule-c)}
  .lp-con-jump::-webkit-scrollbar{display:none}
  .lp-con-jump a{flex:none;display:inline-flex;align-items:center;min-height:40px;padding:0 11px;border-radius:999px;border:1px solid var(--rule-c);background:var(--card);color:var(--card-foreground);font-size:var(--fs-sm);font-weight:700;text-decoration:none}
  .lp-con-jump a:focus-visible{outline:2px solid var(--ring,var(--primary));outline-offset:2px}
  .lp-con-panel{scroll-margin-top:72px}
  .lp-con-list[data-fold] > .lp-con-item:nth-child(n+6){display:none}
  .lp-con-fold{display:block;list-style:none}
  .lp-con-fold .lp-btn{width:100%}
  .lp-con-bar{position:static}
  .lp-con-go{order:3;width:100%}
  .lp-con-go .lp-btn,.lp-con-more{flex:1 1 auto}
  .lp-con-more > .lp-btn{width:100%}
  /* 휴대폰(리모컨으로 쓸 때)에서는 발표 화면을 이 기기에 띄울 일이 없음. 무선으로 띄울 화면(크롬캐스트 등)이 있을 때만 */
  :root:not([data-pres]) .lp-con-go [data-screen-open]{display:none}
  .lp-con-kpi{padding:10px 14px 12px}
  .lp-con-kpi b{font-size:1.625rem}
  .lp-con-strip{grid-template-columns:repeat(2,minmax(0,1fr))}
  .lp-con-kpi:nth-child(odd):last-child{grid-column:1 / -1}
  .lp-con-item{grid-template-columns:2.8rem minmax(0,1fr)}
  /* 휴대폰을 리모컨으로: 지금 쪽만 작게, 넘기기 단추를 크게 */
  .lp-con-deck{grid-template-columns:minmax(0,1fr)}
  .lp-con-thumb.is-next{display:none}
  .lp-con-pager > .lp-btn{flex:1 1 0;min-height:52px}
  .lp-con-goto{margin-left:0;width:100%}
  .lp-con-goto .lp-in{flex:1 1 auto}
}

/* ═══ 발표 화면: 프로젝터·뒷자리에서 읽히게. 넓은 화면은 한 화면에 다 들어가게(넘침 없음) ═══ */
/* 휴대폰으로 잘못 온 사람에게만: 프로젝터용 화면이라는 것과 참가자 길(프로젝터·노트북 폭에는 안 보임) */
.lp-scr-for{display:none}
@media (max-width:699px){
  /* 한 줄 고정(글은 왼쪽 칸 안에서 두 줄까지, 높이는 단추 44px가 정함): 글꼴이 늦게 와도 줄 수가 바뀌어 아래 화면이 밀리지 않게 */
  .lp-scr-for{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:calc(64px + env(safe-area-inset-top,0px));margin:0;padding:calc(10px + env(safe-area-inset-top,0px)) 16px 10px;background:var(--foreground);color:var(--background);font-size:var(--fs-sm);font-weight:700;line-height:1.5}
  .lp-scr-for{position:relative;z-index:35} /* 교재 쪽(화면 가득) 위에도 보이게 */
  .lp-scr-for > span{flex:1 1 auto;min-width:0;max-height:3em;overflow:hidden}
  .lp-scr-for .lp-btn{flex:none;color:var(--background);border-color:color-mix(in srgb,var(--background) 45%,transparent)}
  .lp-scr-for .lp-btn:hover{background:color-mix(in srgb,var(--background) 14%,transparent)}
}
/* 강사 화면이 프로젝터로 띄운 쪽(받는 쪽)은 누를 사람이 없어 버튼을 숨김. 전체 화면에서는 마우스를 멈추면 버튼을 숨김 */
.lp-scr[data-receiver] .lp-scr-act{display:none}
.lp-scr-act{transition:opacity var(--dur-3)}
.lp-scr[data-full][data-idle] .lp-scr-act:not(:focus-within){opacity:0}
.lp-scr[data-full][data-idle]{cursor:none}
.lp-scr-go{width:min(520px,calc(100% - 32px))}
.lp-scr{--scr-pad:clamp(16px,2.2vw,40px);min-height:100dvh;display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:auto auto auto minmax(0,1fr);grid-template-areas:"top" "notice" "side" "stage"}
.lp-scr-top{grid-area:top;display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px;padding:calc(10px + env(safe-area-inset-top,0px)) var(--scr-pad) 10px;border-bottom:1px solid var(--rule-c)}
.lp-scr-title{display:flex;align-items:center;gap:12px;flex:1 1 16em;min-width:0;font-family:var(--font-sans);font-size:clamp(1rem,.8rem + .7vw,1.6rem);font-weight:700;letter-spacing:-.01em;line-height:1.3}
.lp-scr-title > span:last-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lp-scr-conn{font-size:clamp(.85rem,.7rem + .4vw,1.1rem)}
.lp-scr-act{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.lp-scr-notice{grid-area:notice;margin:0;padding:clamp(12px,1.6vw,22px) var(--scr-pad);background:var(--foreground);color:var(--background);font-size:clamp(1.3rem,.9rem + 1.8vw,3rem);font-weight:800;line-height:1.3;letter-spacing:-.01em;overflow-wrap:anywhere}
.lp-scr-stage{grid-area:stage;position:relative;display:grid;align-content:start;min-width:0;min-height:0;padding:clamp(18px,3vh,48px) var(--scr-pad)}
.lp-scr-main{display:grid;gap:clamp(12px,2.2vh,28px);align-content:start;min-width:0;min-height:0}
.lp-scr-side{grid-area:side;display:flex;flex-direction:column;gap:clamp(12px,2vh,24px);min-width:0;min-height:0;padding:clamp(16px,2.4vh,32px) var(--scr-pad);background:var(--card);color:var(--card-foreground);border-bottom:1px solid var(--rule-c)}
/* 프로젝터 가로 화면(옛 800×600 포함): 무대 + 오른쪽 레일, 한 화면에 다 들어가게 */
@media (min-width:760px) and (min-aspect-ratio:1/1){
  .lp-scr{height:100vh;height:100dvh;overflow:hidden;grid-template-columns:minmax(0,1fr) clamp(280px,27vw,460px);grid-template-rows:auto auto minmax(0,1fr);grid-template-areas:"top top" "notice notice" "stage side"}
  .lp-scr-side{border-bottom:0;border-left:1px solid var(--rule-c);overflow:hidden}
  .lp-scr-stage{overflow:hidden}
  /* 로비: 레일을 넓혀 참여 QR을 화면 높이의 절반쯤(1080에서 약 560px). QR 한 변은 찍는 거리의 1/10쯤이 필요해
     80인치 스크린(높이 약 1m)에서 QR 무늬가 약 41cm → 4m 뒤에서도 찍힘(지금 배치의 300px는 약 2m) */
  .lp-scr[data-lobby]{grid-template-columns:minmax(0,1fr) minmax(300px,min(calc(52vh + 2 * var(--scr-pad)),46vw))}
  .lp-scr[data-lobby] .lp-scr-side{justify-content:center}
  .lp-scr[data-lobby] .lp-scr-join :is(.lp-qr-zoom,.lp-qr){width:min(100%,52vh)}
  .lp-scr[data-lobby] .lp-scr-url{font-size:clamp(1.25rem,3.6vh,2.6rem)}
  .lp-scr[data-lobby] .lp-scr-stage{align-content:center}
  .lp-scr[data-lobby] .lp-scr-empty{min-height:0;padding-bottom:6vh}
  /* 큰 제목이 무대에 있으니 머리의 작은 제목은 감춤(자리는 그대로 — 질문이 와도 머리 높이가 같게) */
  .lp-scr[data-lobby] .lp-scr-title{opacity:0}
}
/* 참여 QR: 흰 바탕 위 검은 점(어느 테마에서나), 크기는 레일 폭에 맞춤 */
/* 레일 안에서 QR이 남는 높이만큼 커지고(타이머·신호가 오면 줄어듦) 넘치지 않음 */
.lp-scr-join{display:grid;grid-template-columns:minmax(0,1fr);justify-items:center;gap:clamp(6px,1.2vh,14px);text-align:center}
.lp-scr-join-h{font-size:clamp(.95rem,min(.8rem + .7vw,3vh),1.6rem);font-weight:700}
.lp-scr-join .lp-qr-zoom{display:grid;justify-items:center;gap:6px;max-width:100%;padding:0;border:0;background:none;color:inherit;font:inherit;cursor:zoom-in;border-radius:var(--radius-sm)}
.lp-scr-join .lp-qr-zoom:disabled{cursor:default}
.lp-scr-join .lp-qr-zoom:focus-visible{outline:3px solid var(--ring);outline-offset:4px}
/* 레일이 빠듯하면(screen.js가 data-tight) 'QR 크게 보기' 글자를 빼고 간격을 줄임 — 크게 보기는 위 [QR 크게] 단추로 */
.lp-scr-side[data-tight]{gap:8px;padding-block:12px}
.lp-scr-side[data-tight] .lp-qr-zoom-t{display:none}
.lp-scr-side[data-tight] :is(.lp-scr-timer,.lp-scr-signal){padding-top:8px}
/* 크기는 레일 폭에 맞추고, 타이머·신호가 와서 넘치면 screen.js가 QR만 줄임(뒷자리용은 [QR 크게]) */
.lp-scr-join .lp-qr{width:min(100%,clamp(170px,24vw,420px));aspect-ratio:1;border-radius:var(--radius-sm);padding:0}
.lp-scr-join .lp-qr svg{width:100%;height:100%}
/* localhost로 연 발표 화면(screen.js data-loop): QR 대신 바꾸는 법을 크고 분명하게(찍어도 아무도 못 들어오는 QR을 띄우지 않음) */
.lp-qr-zoom[data-loop] .lp-qr{aspect-ratio:auto;display:grid;place-items:center;border:3px dashed var(--warning);background:var(--card)}
.lp-qr-zoom[data-loop] .lp-qr-off{font-size:clamp(1rem,.7rem + .8vw,1.5rem);font-weight:700;line-height:1.5;color:var(--card-foreground);padding:clamp(12px,1.6vw,24px)}
.lp-scr-side > *{flex:none}
.lp-qr-zoom-t{display:inline-flex;align-items:center;gap:4px;font-size:var(--fs-xs);font-weight:600;color:var(--muted-foreground)}
.lp-qr-zoom-t .lp-ic{width:14px;height:14px}
.lp-qr-zoom:hover .lp-qr-zoom-t{color:var(--foreground)}
/* 참여 주소: 한 줄(screen.js fitUrl이 넘치면 글자를 줄임). 그래도 넘치면(data-wrap) 점·빗금 뒤에서만 줄바꿈 — 조각(span)은 끊지 않음 */
.lp-scr-url,.lp-joinbig-url{max-width:100%;white-space:nowrap;overflow-wrap:normal}
.lp-scr-url > span,.lp-joinbig-url > span{white-space:nowrap}
:is(.lp-scr-url,.lp-joinbig-url):not([data-wrap]) > wbr{display:none}
:is(.lp-scr-url,.lp-joinbig-url):is([data-wrap],[data-plain]){white-space:normal}
:is(.lp-scr-url,.lp-joinbig-url)[data-wrap="any"] > span{white-space:normal;overflow-wrap:anywhere}
.lp-scr-url[data-plain],.lp-joinbig-url[data-plain]{overflow-wrap:anywhere;font-family:var(--font-sans)}
.lp-scr-url{font-family:var(--font-mono);font-size:clamp(1rem,min(.7rem + 1.15vw,3.8vh),2rem);font-weight:700;line-height:1.25}
.lp-scr-full{font-family:var(--font-mono);font-size:clamp(.8rem,.65rem + .4vw,1.05rem);color:var(--muted-foreground);overflow-wrap:anywhere}
.lp-scr-code{font-size:clamp(.85rem,min(.75rem + .45vw,2.6vh),1.2rem);color:var(--muted-foreground)}
.lp-scr-code b{margin-left:.3em;font-family:var(--font-mono);font-size:1.35em;letter-spacing:.12em;color:var(--foreground)}
/* 큰 타이머 */
.lp-scr-timer{display:grid;justify-items:center;gap:2px;padding-top:clamp(10px,1.8vh,22px);border-top:1px solid var(--rule-c)}
.lp-scr-timer-h{font-size:clamp(.8rem,min(.7rem + .4vw,2.4vh),1.15rem);font-weight:700;color:var(--muted-foreground)}
.lp-scr-timer b{font-family:var(--font-num);font-weight:var(--num-weight);font-size:clamp(2.6rem,min(1.6rem + 4.4vw,10vh),7rem);line-height:1;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.lp-scr-timer[data-soon] b{color:var(--warning)}
.lp-scr-timer[data-over] b{color:var(--danger)}
.lp-scr-timer[data-over] .lp-scr-timer-h{color:var(--danger)}
.lp-timers{display:flex;flex-wrap:wrap;gap:10px;justify-content:center}
.lp-timer-card{flex:1 1 140px;display:grid;gap:2px;padding:10px 14px;border-radius:var(--radius-sm);border:1px solid var(--rule-c);text-align:center}
.lp-timer-card span{font-size:clamp(.85rem,.7rem + .3vw,1.05rem);font-weight:700;overflow-wrap:anywhere}
.lp-timer-card b{font-family:var(--font-num);font-weight:var(--num-weight);font-size:clamp(1.8rem,1.2rem + 1.8vw,3.2rem);line-height:1.05;font-variant-numeric:tabular-nums}
.lp-timer-card.is-over{border-color:var(--danger)}.lp-timer-card.is-over b{color:var(--danger)}
.lp-timer-card.is-paused b{opacity:.55}
/* 이해 신호 */
.lp-scr-signal{display:grid;gap:8px;padding-top:clamp(10px,1.8vh,22px);border-top:1px solid var(--rule-c)}
.lp-scr-signal .lp-sig{height:clamp(14px,1.6vh,22px)}
.lp-scr-signal .lp-sig-l{font-size:clamp(.85rem,min(.75rem + .45vw,2.6vh),1.25rem);justify-content:center}
/* 무대: 질문 */
.lp-scr-h{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 18px}
.lp-scr-h h2{font-size:clamp(1.6rem,1rem + 2.2vw,3.4rem);line-height:1.2}
.lp-scr-h p{font-size:clamp(.95rem,.75rem + .55vw,1.4rem);font-weight:600;color:var(--muted-foreground)}
.lp-scr-qs{list-style:none;display:grid}
.lp-scr-q{display:grid;grid-template-columns:clamp(3.2rem,2.4rem + 3vw,6rem) minmax(0,1fr);gap:0 clamp(12px,1.6vw,28px);align-items:start;padding:clamp(10px,1.8vh,22px) 0;border-top:1px solid var(--rule-c)}
.lp-scr-q:last-child{border-bottom:1px solid var(--rule-c)}
.lp-scr-q-v{display:grid;justify-items:center;line-height:1}
.lp-scr-q-v b{font-family:var(--font-num);font-weight:var(--num-weight);font-size:clamp(1.8rem,1.1rem + 2.2vw,3.6rem);font-variant-numeric:tabular-nums}
.lp-scr-q-v small{margin-top:4px;font-size:clamp(.75rem,.6rem + .35vw,1rem);font-weight:700;color:var(--muted-foreground)}
.lp-scr-q-t{font-size:clamp(1.25rem,.85rem + 1.45vw,2.6rem);font-weight:600;line-height:1.4;letter-spacing:-.01em;overflow-wrap:anywhere;word-break:keep-all}
.lp-scr-q-tag{display:block;margin-bottom:.2em;font-size:.5em;font-weight:800;color:var(--primary)}
.lp-scr-q.is-pinned{background:color-mix(in srgb,var(--primary) 8%,transparent)}
.lp-scr-more{font-size:clamp(.9rem,.75rem + .45vw,1.25rem);font-weight:600;color:var(--muted-foreground)}
/* 무대: 투표 막대 */
.lp-scr-pq{font-size:clamp(1.8rem,1rem + 2.8vw,4.4rem);line-height:1.2;overflow-wrap:anywhere}
.lp-scr-bars{list-style:none;display:grid;gap:clamp(10px,2vh,26px)}
.lp-scr-bar{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px 18px;align-items:baseline}
.lp-scr-bar > span{font-size:clamp(1.15rem,.8rem + 1.2vw,2.3rem);font-weight:600;line-height:1.3;overflow-wrap:anywhere}
.lp-scr-bar > b{font-family:var(--font-num);font-weight:var(--num-weight);font-size:clamp(1.3rem,.9rem + 1.4vw,2.6rem);font-variant-numeric:tabular-nums;white-space:nowrap}
.lp-scr-bar > b small{margin-left:.5em;font-size:.55em;font-weight:600;color:var(--muted-foreground)}
.lp-scr-bar > i{grid-column:1 / -1;display:block;height:clamp(14px,2.4vh,34px);border-radius:3px;background:var(--tint);overflow:hidden}
.lp-scr-bar > i::before{content:"";display:block;height:100%;width:var(--w,0%);background:var(--primary);transition:width var(--dur-5) var(--ease-out)}
.lp-scr-bar.is-top > span{font-weight:800}
/* 퀴즈 정답·강사가 고른 질문·빈 투표 */
.lp-scr-bar.is-answer > span{font-weight:800}
.lp-scr-bar.is-answer > i::before{background:var(--success)}
.lp-scr-ans{display:inline-block;margin-left:.5em;padding:.05em .45em;border-radius:6px;background:var(--success);color:#fff;font-style:normal;font-size:.62em;font-weight:800;vertical-align:.18em}
.lp-scr-spot{display:grid;gap:clamp(10px,2vh,24px);align-content:center;min-height:min(60vh,560px)}
.lp-scr-spot-k{font-size:clamp(1rem,.8rem + .6vw,1.5rem);font-weight:800;color:var(--primary)}
.lp-scr-spot-t{font-size:clamp(1.8rem,1rem + 3vw,4.6rem);font-weight:700;line-height:1.3;letter-spacing:-.01em;overflow-wrap:anywhere;word-break:keep-all;max-width:22em}
.lp-scr-msg{display:grid;gap:12px;align-content:center;min-height:min(50vh,420px)}
.lp-scr-msg h2{font-size:clamp(1.6rem,1rem + 2.2vw,3.4rem)}
.lp-scr-msg p{font-size:clamp(1rem,.8rem + .6vw,1.5rem);color:var(--muted-foreground)}
/* 교재 쪽(발표): 화면 가득, 위 띠는 마우스를 움직일 때만. 공지 띠·타이머는 교재 위에 작게 */
.lp-scr-deck{position:fixed;inset:0;z-index:20;display:grid;place-items:center;background:#0b0b0d;overflow:hidden}
.lp-scr-deck[hidden]{display:none}
.lp-scr-deck img{display:block;width:100%;height:100%;object-fit:contain}
.lp-scr[data-view="deck"] .lp-scr-top{position:fixed;inset:0 0 auto 0;z-index:30;background:color-mix(in srgb,var(--background) 94%,transparent);transition:opacity var(--dur-3)}
.lp-scr[data-view="deck"][data-idle] .lp-scr-top:not(:focus-within){opacity:0;pointer-events:none}
.lp-scr[data-view="deck"][data-idle]{cursor:none}
.lp-scr-pg{position:absolute;left:clamp(10px,1.4vw,24px);bottom:clamp(10px,1.4vw,24px);margin:0;padding:.2em .7em;border-radius:999px;background:rgba(0,0,0,.55);color:#fff;font-family:var(--font-num);font-variant-numeric:tabular-nums;font-size:clamp(.85rem,.7rem + .4vw,1.2rem);font-weight:700;transition:opacity var(--dur-3)}
.lp-scr[data-idle] .lp-scr-pg{opacity:0}
.lp-scr-chip{position:absolute;right:clamp(10px,1.4vw,24px);bottom:clamp(10px,1.4vw,24px);margin:0;padding:.25em .8em;border-radius:12px;background:rgba(0,0,0,.72);color:#fff;font-family:var(--font-num);font-variant-numeric:tabular-nums;font-size:clamp(1.2rem,.8rem + 1.6vw,2.6rem);font-weight:800;line-height:1.2}
.lp-scr-chip[data-over]{background:#b3261e}
.lp-scr:not([data-idle]) .lp-scr-dnotice{top:var(--scr-top-h,0px)}
.lp-scr-dnotice{position:absolute;inset:0 0 auto 0;transition:top var(--dur-3);margin:0;padding:clamp(10px,1.4vw,22px) clamp(16px,2.4vw,40px);background:var(--foreground);color:var(--background);font-size:clamp(1.2rem,.8rem + 1.6vw,2.6rem);font-weight:800;line-height:1.3;overflow-wrap:anywhere;text-align:center}
/* 겹쳐 띄우기: 큰 타이머·큰 공지·가림 */
.lp-scr-ov{position:fixed;inset:0;z-index:26;display:grid;place-content:center;justify-items:center;gap:2vh;padding:4vh 5vw;background:var(--background);color:var(--foreground);text-align:center}
.lp-scr-ov[hidden]{display:none}
.lp-scr-ov.is-blank{background:#000}
.lp-scr-ov-h{font-size:clamp(1.2rem,.8rem + 1.6vw,2.8rem);font-weight:700;color:var(--muted-foreground)}
.lp-scr-ov-n{font-family:var(--font-num);font-weight:var(--num-weight);font-size:clamp(5rem,22vw,40vh);line-height:1;font-variant-numeric:tabular-nums;letter-spacing:-.03em}
.lp-scr-ov[data-over] :is(.lp-scr-ov-n,.lp-scr-ov-h){color:var(--danger)}
.lp-scr-ov-t{max-width:18em;font-size:clamp(2rem,1rem + 4.4vw,6rem);font-weight:800;line-height:1.25;letter-spacing:-.01em;overflow-wrap:anywhere;word-break:keep-all}
.lp-scr-keyl{display:grid;gap:6px;margin:4px 0 8px}
.lp-scr-keyl > div{display:grid;grid-template-columns:minmax(8em,auto) minmax(0,1fr);gap:12px;align-items:baseline}
.lp-scr-keyl dt{font-family:var(--font-mono);font-size:var(--fs-sm);font-weight:700}
.lp-scr-keyl dd{margin:0;font-size:var(--fs-sm)}
.lp-scr-keys{width:min(520px,calc(100% - 32px))}
.lp-scr-pmeta{font-size:clamp(1rem,.8rem + .6vw,1.5rem);font-weight:600;color:var(--muted-foreground)}
.lp-scr-wait{display:flex;align-items:baseline;gap:.3em;font-size:clamp(1.4rem,1rem + 1.6vw,2.8rem);font-weight:700}
.lp-scr-wait b{font-family:var(--font-num);font-weight:var(--num-weight);font-size:2.4em;line-height:1;font-variant-numeric:tabular-nums;color:var(--primary)}
.lp-scr-cloud{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:.2em .6em;padding:clamp(8px,2vh,24px) 0}
.lp-scr-cloud span{font-weight:800;line-height:1.1;color:var(--primary)}
.lp-scr-cloud span:nth-child(3n+2){color:var(--foreground)}
.lp-scr-cloud span:nth-child(3n){color:var(--muted-foreground)}
/* 무대: 비어 있을 때 = 로비(큰 연수 제목 + 세 단계 한 줄). 단계 글자는 무대 폭에 맞춰(cqi) 한 줄 */
.lp-scr-main{container-type:inline-size}
.lp-scr-empty{display:grid;gap:clamp(12px,2.4vh,32px);align-content:center;min-height:min(60vh,520px)}
.lp-scr-lobby-t{font-family:var(--font-display);font-weight:var(--display-weight);letter-spacing:var(--display-tracking);font-size:clamp(1.8rem,7.2cqi,6rem);line-height:1.15;text-wrap:balance;max-width:14em;overflow-wrap:anywhere;word-break:keep-all}
.lp-scr-empty-s{font-size:clamp(1.05rem,.8rem + .8vw,1.8rem);color:var(--muted-foreground);max-width:30em}
.lp-scr-steps{list-style:none;display:flex;flex-wrap:wrap;gap:.4em 1.4em;font-size:clamp(1rem,2.3cqi,2rem);font-weight:600}
.lp-scr-steps li{display:inline-flex;align-items:baseline;gap:.5em;white-space:nowrap}
.lp-scr-steps b{font-family:var(--font-num);font-weight:var(--num-weight);color:var(--primary)}
/* 도구: 뽑은 이름·모둠을 무대 가득 */
.lp-scr-tool{display:grid;gap:16px;margin-bottom:clamp(12px,2vh,24px);padding:clamp(16px,2.4vw,32px);border-radius:var(--radius-lg);background:var(--card);border:var(--border-w) solid var(--border);box-shadow:var(--shadow)}
.lp-stage-h{display:flex;justify-content:space-between;align-items:center;gap:12px}
.lp-stage-h h2{font-family:var(--font-sans);font-size:clamp(1.2rem,.9rem + 1vw,2rem)}
.lp-pick{font-family:var(--font-display);font-weight:var(--display-weight);font-size:clamp(3rem,1.5rem + 8vw,10rem);line-height:1.1;text-align:center;overflow-wrap:anywhere;word-break:keep-all}
.lp-pick.is-rolling{opacity:.55}
.lp-groups{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}
.lp-group{display:grid;gap:6px;align-content:start;padding:14px 16px;border-radius:var(--radius);border:1px solid var(--rule-c)}
.lp-group h3{font-family:var(--font-sans);font-size:clamp(1.05rem,.8rem + .7vw,1.6rem)}
.lp-group ul{list-style:none;display:grid;gap:2px;font-size:clamp(1.05rem,.8rem + .7vw,1.6rem)}
/* 도구 서랍 */
.lp-drawer{position:fixed;top:0;right:0;bottom:0;z-index:70;width:min(420px,100%);overflow:auto;overscroll-behavior:contain;display:grid;gap:16px;align-content:start;padding:calc(18px + env(safe-area-inset-top,0px)) max(20px,env(safe-area-inset-right,0px)) 28px 20px;background:var(--card);color:var(--card-foreground);border-left:1px solid var(--border);box-shadow:-20px 0 60px rgba(0,0,0,.25)}
.lp-drawer-h{display:flex;justify-content:space-between;align-items:center}
.lp-drawer-h h2{font-family:var(--font-sans);font-size:1.25rem}
.lp-drawer-links{display:flex;flex-wrap:wrap;gap:8px 18px}
.lp-tool{display:grid;gap:10px;padding-top:16px;border-top:1px solid var(--rule-c)}
.lp-tool h3{font-family:var(--font-sans);font-size:1rem}
.lp-tool label{display:grid;gap:4px;font-size:var(--fs-sm);font-weight:600}
.lp-tool textarea,.lp-tool input{width:100%;min-height:44px;border-radius:var(--radius-sm);border:var(--border-w) solid color-mix(in srgb,var(--foreground) 26%,transparent);background:var(--background);color:var(--foreground);padding:8px 10px;font-weight:400}
.lp-tool .lp-row input{width:auto;flex:1;min-width:0}
.lp-tool .lp-btn{min-height:44px}
.lp-tlist{list-style:none;display:grid}
.lp-tlist li{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:8px 0;border-bottom:1px solid var(--rule-c)}
.lp-tlist b{font-family:var(--font-num);font-variant-numeric:tabular-nums;min-width:4.2em}
.lp-tlist span{flex:1;min-width:4em;overflow-wrap:anywhere}
/* QR 크게 보기: 화면 가득(찍는 거리의 1/10 크기) */
.lp-joinbig{border:0;padding:0;margin:0;width:100vw;height:100vh;height:100dvh;max-width:none;max-height:none;background:var(--background);color:var(--foreground)}
.lp-joinbig::backdrop{background:var(--background)}
.lp-joinbig-in{position:relative;height:100%;display:grid;grid-template-columns:auto minmax(0,1fr);gap:clamp(20px,5vw,72px);align-items:center;justify-content:center;padding:clamp(16px,4vw,56px)}
.lp-joinbig .lp-qr{width:min(80vh,52vw);border-radius:var(--radius-sm);padding:0}
.lp-joinbig-t{display:grid;gap:clamp(8px,1.6vw,20px);min-width:0}
.lp-joinbig h2{font-family:var(--font-sans);font-size:clamp(1.3rem,2.6vw,2.6rem);font-weight:700;letter-spacing:-.02em;line-height:1.25}
.lp-joinbig-url{font-family:var(--font-mono);font-size:clamp(1.4rem,3.4vw,3.6rem);font-weight:700;line-height:1.2}
.lp-joinbig-full{font-family:var(--font-mono);font-size:clamp(.9rem,1.5vw,1.3rem);color:var(--muted-foreground);overflow-wrap:anywhere}
.lp-joinbig-x{position:absolute;top:clamp(12px,2vw,24px);right:clamp(12px,2vw,24px)}
@media (max-aspect-ratio:1/1){.lp-joinbig-in{grid-template-columns:minmax(0,1fr);justify-items:center;text-align:center;align-content:center}.lp-joinbig .lp-qr{width:min(86vw,56vh)}}
.lp-scr .lp-reactions{right:clamp(16px,30vw,480px);bottom:24px}
.lp-scr .lp-reactions span{font-size:3rem}
@media (max-width:759px),(max-aspect-ratio:1/1){
  .lp-scr-join{grid-template-columns:auto minmax(0,1fr);justify-items:start;text-align:left;align-items:center;column-gap:16px}
  .lp-scr-join .lp-qr-zoom{grid-column:1;grid-row:1 / span 5;width:auto}
  .lp-scr-join > :not(.lp-qr-zoom){grid-column:2;min-width:0}
  .lp-scr-join .lp-qr{width:clamp(128px,34vw,220px)!important}
  .lp-scr-act .lp-btn span{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
  .lp-scr-act .lp-btn{min-width:44px;padding-inline:10px}
  /* 머리: 제목 한 줄, 그 아래 연결 상태 + 단추(연결 글이 바뀌거나 글꼴이 늦게 와도 줄이 바뀌지 않게) */
  .lp-scr-title{flex-basis:100%}
  .lp-scr-act{margin-left:auto}
}

/* ═══ QR 안내문: A4 한 장 + 자리 카드. 종이는 늘 흰 바탕 검은 글자(흑백 인쇄) ═══ */
.lp-body-pst{background:var(--surface-2)}
.lp-pst-bar{position:sticky;top:0;z-index:40;background:color-mix(in srgb,var(--background) 94%,transparent);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border-bottom:1px solid var(--rule-c)}
.lp-pst-bar-in{display:flex;flex-wrap:wrap;align-items:center;gap:8px 18px;max-width:1080px;margin:0 auto;padding:10px max(16px,env(safe-area-inset-right,0px)) 10px max(16px,env(safe-area-inset-left,0px))}
.lp-pst-bar-in > .lp-ax-id{flex:1 1 14em}
.lp-pst-bar-t{flex:1 1 16em;min-width:0;font-size:var(--fs-sm);line-height:1.5;color:var(--muted-foreground)}
.lp-pst-opts{display:flex;flex-wrap:wrap;gap:0 16px;margin:0;padding:0;border:0}
.lp-pst{display:grid;justify-items:center;gap:28px;padding:28px 16px 56px}
/* 쪽(종이 한 장)이 크기 기준(container): 안의 글자·QR·여백을 종이 폭의 몇 %로(cqw) 정해 화면 미리보기와 인쇄가 같은 비율 */
.lp-pst-page{width:min(210mm,100%);container-type:inline-size}
.lp-pst-sheet{--ink:#111;--ink-2:#3d3d3d;--paper:#fff;position:relative;width:100%;background:var(--paper);color:var(--ink);box-shadow:0 1px 2px rgba(0,0,0,.08),0 14px 40px rgba(0,0,0,.16);border-radius:2px;color-scheme:light}
.lp-pst-sheet .lp-qr{background:#fff;padding:0;border-radius:0}
/* A4 한 장: 폭에 맞춰 글자·QR이 함께 커지고 줄어듦(cqw, 인쇄 폭 190mm에서도 같은 비율) */
.lp-pst-a4{aspect-ratio:210 / 297;display:flex;flex-direction:column;align-items:center;gap:2.2cqw;padding:6cqw 8cqw 5cqw;text-align:center;overflow:hidden;border-top:2.2cqw solid var(--primary)}
.lp-pst-head{display:grid;justify-items:center;gap:1.4cqw;max-width:100%}
.lp-pst-org{font-size:max(11px,2.5cqw);font-weight:700;color:var(--ink-2)}
.lp-pst-a4 h1{max-width:100%;font-size:max(20px,6.4cqw);line-height:1.18;color:var(--ink);overflow-wrap:anywhere}
.lp-pst-a4[data-len="s"] h1{font-size:max(22px,8.2cqw)}
.lp-pst-a4[data-len="l"] h1{font-size:max(18px,4.8cqw)}
.lp-pst-sub{max-width:60ch;font-size:max(12px,2.7cqw);line-height:1.5;color:var(--ink-2)}
.lp-pst-rule{width:28cqw;height:3cqw;margin-top:.6cqw}
.lp-pst-meta{display:flex;flex-wrap:wrap;justify-content:center;gap:.6cqw 4cqw;margin:0;font-size:max(12px,2.9cqw)}
.lp-pst-meta div{display:flex;gap:1.6cqw}
.lp-pst-meta dt{flex:none;white-space:nowrap;font-weight:800} /* 장소가 길어도 이름표 '장소'가 세로로 끊기지 않게 */
.lp-pst-meta dd{min-width:0}
.lp-pst-meta dd{margin:0}
/* QR: 높이를 먼저 정하고 너비가 따라감(글이 길면 QR만 조금 줄어 한 장에 들어감). 둘레 여백 4칸은 그림 안에 있음 */
.lp-pst-qr{flex:0 1 58cqw;min-height:34cqw;width:auto;max-width:100%;aspect-ratio:1;margin-top:1cqw;padding:1.2cqw!important;border:.45cqw solid var(--ink);box-sizing:border-box}
.lp-pst-qr svg{width:100%;height:100%}
.lp-pst-cta{font-size:max(13px,3.4cqw);font-weight:800}
.lp-pst-type{display:grid;justify-items:center;gap:.8cqw;max-width:100%}
.lp-pst-type-h{font-size:max(11px,2.3cqw);color:var(--ink-2)}
.lp-pst-url{max-width:100%;font-family:var(--font-mono);font-size:max(14px,4.3cqw);font-weight:700;line-height:1.25;overflow-wrap:anywhere}
.lp-pst-full{max-width:100%;font-family:var(--font-mono);font-size:max(10px,2.1cqw);color:var(--ink-2);overflow-wrap:anywhere}
.lp-pst-code{font-size:max(11px,2.5cqw);color:var(--ink-2)}
.lp-pst-code b{margin-left:.3em;font-family:var(--font-mono);font-size:1.5em;letter-spacing:.12em;color:var(--ink)}
.lp-pst-wifi{display:grid;grid-template-columns:auto auto auto minmax(0,1fr) auto minmax(0,1fr);gap:1.6cqw;align-items:end;width:100%;max-width:150mm;margin-top:auto;font-size:max(11px,2.6cqw)}
.lp-pst-wifi .lp-ic{width:3.4cqw;height:3.4cqw;min-width:14px;min-height:14px}
.lp-pst-wifi i{display:block;height:1.4em;border-bottom:1.5px solid var(--ink-2)}
.lp-pst-join{display:flex;flex-wrap:wrap;gap:.4em 1.2cqw;align-items:center;justify-content:center;width:100%;max-width:150mm;margin:auto 0 0;font-size:max(11px,2.6cqw);overflow-wrap:anywhere}
.lp-pst-join .lp-ic{width:3.4cqw;height:3.4cqw;min-width:14px;min-height:14px}
/* 자리 카드: 2단 × 4줄, 점선으로 자름 */
.lp-pst-cards{padding:5cqw 5cqw 6cqw}
.lp-pst-cut{display:flex;align-items:center;justify-content:center;gap:1.4cqw;margin-bottom:3cqw;font-size:max(11px,2.3cqw);color:var(--ink-2)}
.lp-pst-cut .lp-ic{width:3.2cqw;height:3.2cqw;min-width:14px;min-height:14px}
.lp-pst-grid{display:grid;grid-template-columns:1fr 1fr;border-top:1px dashed #777;border-left:1px dashed #777}
.lp-pst-mini{display:grid;grid-template-columns:auto minmax(0,1fr);grid-template-rows:auto 1fr auto;gap:1cqw 3cqw;align-items:start;min-width:0;padding:3.4cqw;border-right:1px dashed #777;border-bottom:1px dashed #777;text-align:left}
.lp-pst-mini-t{grid-column:2;font-size:max(11px,2.5cqw);font-weight:800;line-height:1.3;overflow-wrap:anywhere}
.lp-pst-mini-qr{grid-row:1 / span 3;width:19cqw;aspect-ratio:1}
.lp-pst-mini-u{grid-column:2;align-self:end;font-family:var(--font-mono);font-size:max(9px,1.9cqw);font-weight:700;line-height:1.3;overflow-wrap:anywhere}
.lp-pst-mini-c{grid-column:2;font-size:max(9px,1.8cqw);color:var(--ink-2)}
.lp-pst-sheet:not(.lp-pst-a4) .lp-qr-off,.lp-pst-a4 .lp-qr-off{font-size:max(10px,2.2cqw)}
.lp-cards-off [data-part="cards"]{display:none}
/* 휴대폰: 첫 줄은 다른 보조 화면처럼 [무슨 화면 · 제목][참가자 화면으로], 그 아래 인쇄 */
@media (max-width:520px){
  .lp-pst-bar-in > .lp-ax-id{flex-basis:8em}
  .lp-pst-bar-in > .lp-btn-ghost{order:1}
  .lp-pst-bar-t{order:2;flex-basis:100%}
  .lp-pst-opts{order:3}
  .lp-pst-bar [data-print]{order:4;flex:1 1 auto}
}
@media print{
  @page{size:A4 portrait;margin:10mm}
  :root{color-scheme:light}
  .lp-pst-bar,.lp-toast,.lp-ax-bar,.lp-con-bar{display:none!important}
  .lp-body-pst{background:#fff}
  .lp-pst{display:block;padding:0}
  :root,:root[data-theme]{color-scheme:light!important;background:#fff!important}
  .lp-pst-page{width:190mm;margin:0 auto}
  .lp-pst-page + .lp-pst-page{break-before:page}
  .lp-pst-sheet{box-shadow:none;border-radius:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .lp-pst-a4{height:277mm;aspect-ratio:auto}
  .lp-pst-cards{height:auto}
}

/* ═══ 접속 확인 ═══ */
.lp-chk{width:100%;max-width:1160px;margin:0 auto;padding:clamp(28px,5vw,64px) max(16px,env(safe-area-inset-right,0px)) 56px max(16px,env(safe-area-inset-left,0px));display:grid;gap:clamp(20px,3vw,32px)}
.lp-chk-head{display:grid;gap:10px}
.lp-chk-head h1{font-size:var(--fs-xl);line-height:1.2}
.lp-chk-lead{max-width:34em;font-size:var(--fs-md);line-height:1.65;color:var(--muted-foreground)}
/* 결과 한 줄: 큰 글자 + 표시(색만으로 알리지 않게 모양도 다름) */
.lp-chk-verdict{display:grid;grid-template-columns:auto minmax(0,1fr);grid-template-areas:"mark say" "mark do";gap:12px clamp(16px,2.4vw,28px);align-items:center;padding:clamp(20px,3vw,32px);border-radius:var(--radius);background:var(--card);color:var(--card-foreground);border:var(--border-w) solid var(--border)}
.lp-chk-mark{grid-area:mark;display:grid;place-items:center;width:clamp(56px,7vw,88px);aspect-ratio:1;border-radius:50%;background:var(--tint);color:var(--muted-foreground)}
.lp-chk-mark > span{display:none}
.lp-chk-mark .lp-ic{width:55%;height:55%;stroke-width:2.4}
.lp-chk-verdict[data-state="wait"] [data-m="wait"],.lp-chk-verdict[data-state="ok"] [data-m="ok"],.lp-chk-verdict[data-state="warn"] [data-m="warn"],.lp-chk-verdict[data-state="fail"] [data-m="fail"]{display:contents}
.lp-chk-verdict[data-state="wait"] .lp-chk-mark .lp-ic{animation:lp-spin 1.4s linear infinite}
.lp-chk-verdict[data-state="ok"] .lp-chk-mark{background:var(--success);color:var(--background)}
.lp-chk-verdict[data-state="warn"] .lp-chk-mark{background:var(--warning);color:var(--background)}
.lp-chk-verdict[data-state="fail"] .lp-chk-mark{background:var(--danger);color:var(--background)}
.lp-chk-say{grid-area:say;display:grid;gap:4px;min-width:0}
.lp-chk-say h2{font-size:clamp(1.6rem,1.1rem + 2vw,2.75rem);line-height:1.22}
.lp-chk-say p{font-size:var(--fs-md);line-height:1.6;color:var(--muted-foreground)}
.lp-chk-do{grid-area:do;display:flex;flex-wrap:wrap;gap:8px}
@keyframes lp-spin{to{transform:rotate(360deg)}}
.lp-chk-cols{display:grid;grid-template-columns:minmax(0,1fr);gap:clamp(20px,3vw,40px)}
@media (min-width:900px){.lp-chk-cols{grid-template-columns:repeat(3,minmax(0,1fr))}}
/* 좁은 화면은 막힌 것·할 일이 먼저 */
@media (max-width:899px){.lp-chk-col[data-col="fail"]{order:1}.lp-chk-col[data-col="todo"]{order:2}.lp-chk-col[data-col="ok"]{order:3}}
.lp-chk-col{display:grid;gap:12px;align-content:start;min-width:0}
.lp-chk-col h2{display:flex;align-items:baseline;gap:.4em;padding-bottom:10px;border-bottom:max(2px,var(--border-w)) solid var(--foreground);font-family:var(--font-sans);font-size:var(--fs-lg);letter-spacing:-.01em}
.lp-chk-col h2 span{font-family:var(--font-num);font-weight:var(--num-weight);font-variant-numeric:tabular-nums;color:var(--muted-foreground)}
.lp-chk-col[data-col="fail"][data-has] h2,.lp-chk-col[data-col="fail"][data-has] h2 span{color:var(--danger);border-color:var(--danger)}
.lp-chk-col ul,.lp-chk-col ol{list-style:none;display:grid}
.lp-chk-col li{display:grid;grid-template-columns:1.5rem minmax(0,1fr);gap:2px 10px;align-items:baseline;padding:10px 0;border-bottom:1px solid var(--rule-c)}
.lp-chk-col li > .lp-ic{width:1.15rem;height:1.15rem;align-self:start;margin-top:.25em;stroke-width:2.4}
/* 표시(아이콘·번호) 말고는 모두 둘째 칸: 칸을 정하지 않으면 줄의 넷째 것('없어도 연수는 할 수 있어요')이 첫 칸(1.5rem)에 들어가 한 글자씩 세로로 섬 */
.lp-chk-col li > :not(.lp-ic){grid-column:2;min-width:0}
.lp-chk-col[data-col="ok"] li > .lp-ic{color:var(--success)}
.lp-chk-col[data-col="fail"] li > .lp-ic{color:var(--danger)}
.lp-chk-col li b{font-size:var(--fs-base);font-weight:700;overflow-wrap:anywhere}
.lp-chk-col li small{font-size:var(--fs-xs);color:var(--muted-foreground);overflow-wrap:anywhere}
.lp-chk-col li p{font-size:var(--fs-sm);line-height:1.6}
.lp-chk-col li em{font-style:normal;font-size:var(--fs-xs);font-weight:700;color:var(--muted-foreground)}
.lp-chk-col ol{counter-reset:todo}
.lp-chk-col ol > li{counter-increment:todo}
.lp-chk-col ol > li::before{content:counter(todo);font-family:var(--font-num);font-weight:var(--num-weight);font-size:var(--fs-md);line-height:1.3;color:var(--primary)}
.lp-chk-col ol > li > p{font-size:var(--fs-base);line-height:1.6}
.lp-chk-col li.lp-chk-none{display:block;color:var(--muted-foreground);font-size:var(--fs-sm)}
.lp-chk-col ol > li.lp-chk-none::before{content:none}
.lp-chk-note{max-width:var(--measure);font-size:var(--fs-sm);line-height:1.65;color:var(--muted-foreground)}
.lp-chk-more{max-width:46rem;font-size:var(--fs-sm)}
.lp-chk-more > summary{display:flex;align-items:center;min-height:44px;font-weight:700;cursor:pointer}
.lp-chk-more p{max-width:var(--measure);color:var(--muted-foreground);line-height:1.6;overflow-wrap:anywhere}
@media (max-width:560px){.lp-chk-verdict{grid-template-columns:minmax(0,1fr);grid-template-areas:"mark" "say" "do"}.lp-chk-do .lp-btn{flex:1 1 auto}}
@media print{.lp-chk-do,.lp-chk-back{display:none}.lp-chk-verdict{border:1px solid #999}}

/* ═══ 개인정보 처리 안내: 읽는 문서 ═══ */
.lp-doc{width:100%;max-width:46rem;margin:0 auto;padding:clamp(32px,6vw,72px) max(20px,env(safe-area-inset-right,0px)) 72px max(20px,env(safe-area-inset-left,0px))}
.lp-doc h1{font-size:var(--fs-xl);line-height:1.2}
.lp-doc-lead{font-size:var(--fs-md);line-height:1.65;color:var(--muted-foreground)}
.lp-doc > p{max-width:var(--measure)}
.lp-doc h2{margin-top:var(--sp-5)}
.lp-doc-sum{display:grid;gap:10px;padding:clamp(18px,2.6vw,28px);border-radius:var(--radius);background:var(--tint)}
.lp-doc-sum h2{margin:0;font-family:var(--font-sans);font-size:var(--fs-sm);color:var(--muted-foreground)}
.lp-doc-sum dl{display:grid;margin:0}
.lp-doc-sum dl > div{display:grid;grid-template-columns:7.5em minmax(0,1fr);gap:4px 16px;padding:10px 0;border-top:1px solid var(--rule-c)}
.lp-doc-sum dt{font-weight:700}
.lp-doc-sum dd{margin:0;overflow-wrap:anywhere}
.lp-doc-foot{font-size:var(--fs-sm);color:var(--muted-foreground)}
.lp-table-wrap{overflow-x:auto}
.lp-table{width:100%;border-collapse:collapse;font-size:var(--fs-sm)}
.lp-table th,.lp-table td{text-align:left;vertical-align:top;padding:8px 10px;border-top:1px solid var(--border)}
.lp-table tr:last-child th,.lp-table tr:last-child td{border-bottom:1px solid var(--border)}
.lp-table th{width:9.5em;font-weight:600;color:var(--muted-foreground);white-space:nowrap}
@media (max-width:480px){.lp-table th{width:6.5em;white-space:normal}.lp-doc-sum dl > div{grid-template-columns:minmax(0,1fr)}}

/* 동작 줄이기: 회전·깜박임·막대 움직임 없이 */
@media (prefers-reduced-motion:reduce){
  .lp-chk-verdict[data-state="wait"] .lp-chk-mark .lp-ic,:is(.lp-con-conn,.lp-scr-conn)[data-state="offline"] i{animation:none}
  .lp-scr-bar > i::before,.lp-con-tl > i::before{transition:none}
}
`,a=`/* lecpage boot: 첫 그리기 전에 테마·움직임 설정을 적용합니다. */
(function () {
  var d = document.documentElement;
  d.classList.add('js');
  try {
    var t = localStorage.getItem('lp-theme');
    if (t === 'light' || t === 'dark') d.setAttribute('data-theme', t);
    if (localStorage.getItem('lp-motion-paused') === '1') d.classList.add('lp-paused');
  } catch (e) { /* 저장소를 못 쓰는 환경 */ }
  var reduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (reduced) d.classList.add('lp-reduced');
  // 바깥 글꼴 스타일시트(media="print"로 받는 중)를 다 받으면 화면에도 씀. 글꼴 서버가 막혀도 첫 화면은 기본 글꼴로 바로 뜸
  var fl = document.querySelectorAll('link[data-lp-font]');
  for (var i = 0; i < fl.length; i++) (function (l) { if (l.sheet) l.media = 'all'; else l.addEventListener('load', function () { l.media = 'all'; }); })(fl[i]);
  /* 등장 효과의 깜빡임 방지: 효과 스크립트(fx.js, defer)가 늦게 오면 제목이 다 보였다가 사라진 뒤 다시 들어와 튐.
     움직임이 켜진 사이트는 효과가 시작할 때까지(최대 3초) 등장 효과 대상만 숨겨 둠(fx.css html.fx-boot, core.js start가 걷어 냄) */
  if (d.hasAttribute('data-rest') && +d.getAttribute('data-motion') > 0 && !reduced) { // 참가자 화면(강사·발표 화면은 효과 스크립트를 싣지 않음)
    d.classList.add('fx-boot');
    setTimeout(function () { d.classList.remove('fx-boot'); }, 3000);
  }
})();
`,i=`/* lecpage check — 접속 확인: 연수에 쓰는 곳이 이 기기·이 네트워크에서 열리는지 재고, 결과를 '되는 것 / 안 되는 것 / 할 일'로 크게 보여 줍니다.
 * 참여 기능은 주소를 찌르지 않고 실제로 연결해 봄(실시간·새로 읽기 중 어느 방식인지까지). 보조 쪽(개인정보 안내)의 밝게·어둡게도 맡음. */
(function () {
  'use strict';
  var doc = document, root = doc.documentElement, $ = function (s, r) { return (r || doc).querySelector(s); };
  function el(tag, cls, text) { var n = doc.createElement(tag); if (cls) n.className = cls; if (text !== undefined && text !== null) n.textContent = text; return n; }
  var tb = $('[data-theme-toggle]');
  if (tb) tb.addEventListener('click', function () {
    var cur = root.getAttribute('data-theme'), dark = cur === 'dark' || (cur !== 'light' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
    root.setAttribute('data-theme', dark ? 'light' : 'dark'); try { localStorage.setItem('lp-theme', dark ? 'light' : 'dark'); } catch (e) { }
  });
  var page = $('[data-check-page]'); if (!page) return;
  var DATA = {}; try { DATA = JSON.parse($('#lp-data').textContent); } catch (e) { }
  var items = []; try { items = JSON.parse(page.getAttribute('data-items') || '[]'); } catch (e) { }
  // 글꼴을 사이트에 함께 담았으면(assets/fonts.css) 글꼴 CDN은 확인할 까닭이 없음: 빼고, 같은 곳이 움직임 효과 파일도 보내면 그 영향만 남김
  if ($('link[href$="assets/fonts.css"]')) items = items.filter(function (it) { return !it.font || it.fxImpact; }).map(function (it) { return it.font ? { name: it.fxName, url: it.url, need: it.need, impact: it.fxImpact, fix: it.fxFix } : it; });
  var liveInfo = null; try { liveInfo = JSON.parse(page.getAttribute('data-live-check') || 'null'); } catch (e) { }
  var tt; function toast(m) { var t = $('[data-toast]'); if (!t) return; t.textContent = m; t.classList.add('is-on'); clearTimeout(tt); tt = setTimeout(function () { t.classList.remove('is-on'); }, 2400); }
  var IC = {
    ok: '<svg class="lp-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    fail: '<svg class="lp-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  };
  var verdict = $('[data-verdict]'), big = $('[data-verdict-big]'), sub = $('[data-verdict-sub]');
  var results = [], running = false;

  function probe(url) {
    return new Promise(function (res) {
      var done = false, t = setTimeout(function () { if (!done) { done = true; res('fail'); } }, 7000);
      try {
        fetch(url, { mode: 'no-cors', cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' }).then(function () { if (!done) { done = true; clearTimeout(t); res('ok'); } }, function () { if (!done) { done = true; clearTimeout(t); res('fail'); } });
      } catch (e) { done = true; clearTimeout(t); res('fail'); }
    });
  }
  /** 참여 기능: 실제로 연결해 보고 방식(실시간·새로 읽기)과 걸린 시간을 적음 */
  function liveCheck() {
    if (!liveInfo || !DATA.live) return Promise.resolve(null);
    var t0 = Date.now(), name = '참여 기능(질문·투표)';
    // 암호로 잠근 사이트: 이 쪽은 누구나 열 수 있어 서버 주소·연수 코드를 싣지 않음 → 서버가 닿는지만 봄(실시간 방식은 강사 화면이 보여 줌)
    if (DATA.live.health) {
      return probe(DATA.live.health).then(function (st) {
        if (st === 'ok') return { name: name, host: liveInfo.name + ' · 서버에 닿아요', state: 'ok', need: 'must', note: '암호로 잠근 사이트라 여기서는 서버에 닿는지만 봐요. 실시간으로 받는지는 강사 화면 맨 위에 나와요.' };
        return { name: name, host: liveInfo.name, state: 'fail', need: 'must', impact: '질문·투표·도움 요청이 동작하지 않아요.', fix: '인터넷 연결을 확인하고, 학교·회사 망이면 정보 담당자에게 참여 기능 서버 주소를 열어 달라고 하세요. 참가자는 휴대폰 데이터로 들어오게 안내할 수 있어요.' };
      });
    }
    if (!window.LecLive || !DATA.live.code) return Promise.resolve(null);
    return new Promise(function (res) {
      var c, done = false, end = function (r) { if (done) return; done = true; try { c && c.close(); } catch (e) { } res(r); };
      setTimeout(function () { end({ name: name, host: liveInfo.name, state: 'fail', need: 'must', impact: '질문·투표·도움 요청이 동작하지 않아요.', fix: '인터넷 연결을 확인하고, 학교·회사 망이면 정보 담당자에게 참여 기능 서버 주소를 열어 달라고 하세요. 참가자는 휴대폰 데이터로 들어오게 안내할 수 있어요.' }); }, 15000);
      try { c = LecLive.create(Object.assign({}, DATA.live, { identity: 'session' })); } catch (e) { return end({ name: name, host: liveInfo.name, state: 'fail', need: 'must', impact: '참여 기능을 불러오지 못했어요.', fix: '새로 고침한 뒤 다시 확인해 주세요.' }); }
      c.connect().then(function (r) {
        var ms = Date.now() - t0, mode = r && r.mode;
        if (mode === 'local') return end({ name: name, host: '리허설', state: 'ok', need: 'must', note: '리허설 설정이라 이 브라우저 안에서만 돌고, 참가자 휴대폰과 이어지지 않아요.', fix: '실제 연수 전에 참여 기능 서버를 연결해 다시 배포하세요.', todo: true, warn: true });
        if (mode === 'polling') return end({ name: name, host: liveInfo.name + ' · 천천히 묻기', state: 'ok', need: 'must', way: '천천히 묻기', note: '이 망이 웹소켓을 막아 천천히 물어요. 질문·투표가 몇 초 늦게 보여요.', fix: '그대로 써도 돼요. 더 빠르게 하려면 기관 정보 담당자에게 웹소켓 연결을 열어 달라고 하세요.', todo: true });
        end({ name: name, host: liveInfo.name + ' · 실시간 · ' + (ms / 1000).toFixed(1) + '초', state: 'ok', need: 'must', way: '실시간' });
      }, function (e) {
        end({ name: name, host: liveInfo.name, state: 'fail', need: 'must', impact: '질문·투표·도움 요청이 동작하지 않아요.' + (e && e.message ? ' (' + e.message + ')' : ''), fix: '인터넷 연결을 확인하고, 학교·회사 망이면 정보 담당자에게 참여 기능 서버 주소를 열어 달라고 하세요. 참가자는 휴대폰 데이터로 들어오게 안내할 수 있어요.' });
      });
    });
  }
  /** 이 기기: 저장소(별명·참여 정보를 기억), 최신 브라우저 기능 */
  function deviceCheck() {
    var ok = true; try { localStorage.setItem('__lp', '1'); localStorage.removeItem('__lp'); } catch (e) { ok = false; }
    var modern = typeof fetch === 'function' && typeof Promise === 'function' && !!window.HTMLDialogElement && !!(window.CSS && CSS.supports && CSS.supports('display', 'grid'));
    if (!modern) return { name: '이 브라우저', host: '오래된 브라우저', state: 'fail', need: 'must', impact: '참여하기 창·질문 칸이 제대로 보이지 않을 수 있어요.', fix: '크롬·엣지·사파리·삼성 인터넷의 최신 판으로 열어 주세요.' };
    if (!ok) return { name: '이 브라우저의 저장소', host: '사생활 보호 모드이거나 막힘', state: 'fail', need: 'nice', impact: '새로 고침하면 별명을 다시 넣어야 해요.', fix: '일반 창으로 열거나 사이트 데이터 저장을 허용해 주세요.' };
    return { name: '이 브라우저', host: (navigator.userAgent.match(/(Edg|SamsungBrowser|Whale|Chrome|Firefox|Version)\\/[\\d.]+/) || ['최신 브라우저'])[0].replace('Version', 'Safari').replace(/\\/(\\d+).*/, ' $1'), state: 'ok', need: 'must' };
  }
  function row(r, list) {
    var li = el('li'); li.innerHTML = list === 'ok' ? IC.ok : IC.fail;
    li.appendChild(el('b', '', r.name)); li.appendChild(el('small', '', r.host || ''));
    if (list === 'fail' && r.impact) li.appendChild(el('p', '', r.impact));
    if (list === 'ok' && r.note) li.appendChild(el('p', '', r.note));
    if (list === 'fail' && r.need === 'nice') li.appendChild(el('em', '', '없어도 연수는 할 수 있어요'));
    return li;
  }
  function paint(final) {
    var ok = results.filter(function (r) { return r.state === 'ok'; }), fail = results.filter(function (r) { return r.state === 'fail'; });
    var must = fail.filter(function (r) { return r.need === 'must'; });
    [['ok', ok], ['fail', fail]].forEach(function (x) {
      var ul = $('[data-list="' + x[0] + '"]'), n = $('[data-n="' + x[0] + '"]'); ul.textContent = '';
      x[1].forEach(function (r) { ul.appendChild(row(r, x[0])); });
      if (!x[1].length) ul.appendChild(el('li', 'lp-chk-none', final ? (x[0] === 'fail' ? '막힌 곳이 없어요.' : '열린 곳이 없어요.') : '확인하는 중…'));
      if (n) n.textContent = String(x[1].length);
    });
    var col = $('[data-col="fail"]'); if (col) { if (fail.length) col.setAttribute('data-has', ''); else col.removeAttribute('data-has'); }
    // 할 일: 막힌 곳마다 고칠 방법(같은 문장은 한 번) + 쓸 수는 있지만 알아 둘 것
    var todo = [], seen = {};
    fail.concat(ok.filter(function (r) { return r.todo; })).forEach(function (r) { if (r.fix && !seen[r.fix]) { seen[r.fix] = 1; todo.push(r.fix); } });
    if (fail.length) todo.push('[결과 복사]로 이 결과를 기관 정보 담당자에게 보내면 무엇을 열어야 하는지 바로 알 수 있어요.');
    var ol = $('[data-list="todo"]'); ol.textContent = '';
    if (!todo.length) ol.appendChild(el('li', 'lp-chk-none', final ? '할 일이 없어요. 연수 당일에도 같은 Wi-Fi를 쓰면 돼요.' : '확인이 끝나면 여기에 적어요.'));
    todo.forEach(function (t) { var li = el('li'); li.appendChild(el('p', '', t)); ol.appendChild(li); });
    if (!final) return;
    var warnOk = ok.filter(function (r) { return r.warn; });
    var state = must.length ? 'fail' : fail.length || warnOk.length ? 'warn' : 'ok';
    verdict.setAttribute('data-state', state);
    big.textContent = state === 'ok' ? '모두 열려요' : state === 'warn' ? (warnOk.length && !fail.length ? '참여 기능은 리허설 설정이에요' : '연수는 할 수 있어요') : '꼭 필요한 곳 ' + must.length + '곳이 막혔어요';
    sub.textContent = state === 'ok' ? '이 기기와 이 네트워크에서 연수에 쓰는 곳이 모두 열려요.' : state === 'warn' ? (fail.length ? '없어도 되는 곳 ' + fail.length + '곳이 막혔어요. ' : '') + (warnOk.length ? warnOk[0].note + ' ' : '') + '아래 할 일을 확인해 주세요.' : '아래 할 일을 연수 전에 해 주세요. 결과를 복사해 보낼 수 있어요.';
    // 강사 화면(같은 사이트)이 '전날 점검' 결과로 보여 줌: 이 기기에만 남기고 어디로도 보내지 않음
    var lv = results.filter(function (r) { return r.way || (r.name || '').indexOf('참여 기능') === 0; })[0];
    try { localStorage.setItem('lp-check:' + location.pathname.replace(/[^/]*$/, ''), JSON.stringify({ at: Date.now(), state: state, verdict: big.textContent, live: lv ? (lv.state === 'ok' ? lv.way || '열림' : '막힘') : '' })); } catch (e) { }
  }
  function go() {
    if (running) return; running = true; results = [];
    verdict.setAttribute('data-state', 'wait'); big.textContent = '확인하는 중…';
    var total = items.length + (liveInfo ? 1 : 0) + 1, doneN = 0;
    var step = function (r) { if (r) results.push(r); doneN++; sub.textContent = total + '곳 가운데 ' + doneN + '곳을 확인했어요.'; paint(false); };
    paint(false);
    step(deviceCheck());
    var jobs = items.map(function (it) { return probe(it.url).then(function (st) { step({ name: it.name, host: (function () { try { return new URL(it.url).host.replace(/^www\\./, ''); } catch (e) { return it.url; } })(), state: st, need: it.need, impact: it.impact, fix: it.fix }); }); });
    jobs.push(liveCheck().then(function (r) { if (r) step(r); }));
    Promise.all(jobs).then(function () {
      running = false;
      // 꼭 필요한 것·막힌 것이 위로
      results.sort(function (a, b) { return (a.need === 'must' ? 0 : 1) - (b.need === 'must' ? 0 : 1); });
      paint(true);
    });
  }
  var run = $('[data-diag-run]'); if (run) run.addEventListener('click', go);
  var env = $('[data-env]');
  if (env) env.textContent = '브라우저: ' + navigator.userAgent.replace(/\\s*\\([^)]*\\)/g, ' ').replace(/\\s+/g, ' ').slice(0, 160) + ' · 화면 ' + innerWidth + '×' + innerHeight + (navigator.onLine === false ? ' · 오프라인' : '') + (navigator.connection && navigator.connection.effectiveType ? ' · 네트워크 ' + navigator.connection.effectiveType : '');
  var cp = $('[data-diag-copy]');
  if (cp) cp.addEventListener('click', function () {
    var lines = ['접속 확인 결과 (' + new Date().toLocaleString('ko-KR') + ')', (DATA.title || '') + ' · ' + location.href.split('#')[0], big.textContent + ' — ' + sub.textContent]
      .concat(results.map(function (r) { return (r.state === 'ok' ? '[열림] ' : '[막힘] ') + r.name + ' · ' + (r.host || '') + (r.state === 'fail' && r.fix ? ' → ' + r.fix : ''); }), env ? [env.textContent] : []);
    var text = lines.join('\\n');
    var fb = function () { toast('복사하지 못했어요. 화면을 찍어 보내 주세요.'); };
    try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { toast('결과를 복사했어요. 메신저에 붙여 넣어 보내세요.'); }, fb); else fb(); } catch (e) { fb(); }
  });
  go();
})();
`,o=`/* lecpage console — 강사 화면. 모든 화면 출력은 textContent로 만듭니다(HTML 주입 금지).
 * 켜진 기능과 섹션의 패널만 만듭니다. 맨 위 '지금' 띠: 참가자·도움 요청·모르겠어요 신호·실습 막힘·열린 투표·질문·설문.
 * 관리자 키: 이 탭(sessionStorage)에만 두고, '이 기기에서 기억하기'를 고르면 이 기기(localStorage)에도. 주소·화면·기록에는 남기지 않음.
 * 사이트에 직접 쓴 스크립트가 있으면(DATA.keyTab) 기억하기를 끔: 같은 주소의 사이트 스크립트가 이 기기 저장소는 읽을 수 있지만 다른 탭의 sessionStorage는 못 읽음.
 * 발표: 교재 쪽(BP.deck)을 미리 보며 넘기고(리모컨 PageDown·PageUp도), 발표 화면에 겹쳐 띄울 것(ui.ov)을 고름. 출석 명단은 손으로 더하고 고침. */
(function () {
  'use strict';
  // 휴대폰에서 열기 QR(#key=…): 읽자마자 주소에서 지움(주소창·화면 공유·방문 기록에 남지 않게). 키는 이 탭에만 둠
  var qrKey = '';
  try {
    var hk = /(?:^#|&)key=([^&]+)/.exec(location.hash || '');
    if (hk) {
      qrKey = decodeURIComponent(hk[1]);
      var rest = location.hash.replace(/(^#|&)key=[^&]*/, '$1').replace(/^#&/, '#');
      history.replaceState(null, '', location.pathname + location.search + (rest === '#' ? '' : rest));
    }
  } catch (e) { }
  // 다른 사이트가 강사 화면을 틀(iframe)에 넣어 관리자 키를 가로채지 못하게(헤더를 못 바꾸는 GitHub Pages 대비). 앱 미리보기는 예외
  try { if (window.top !== window.self && !document.body.hasAttribute('data-lp-preview')) { document.documentElement.innerHTML = '<body><p style="font:16px sans-serif;padding:24px">강사 화면은 새 창에서 열어 주세요.<\\/p><\\/body>'; return; } } catch (e) { return; }
  var doc = document, root = doc.documentElement, $ = function (s, r) { return (r || doc).querySelector(s); };
  var DATA = {}, BP = {};
  try { DATA = JSON.parse($('#lp-data').textContent); BP = JSON.parse($('#lp-blueprint').textContent); } catch (e) { }
  function el(tag, cls, text) { var n = doc.createElement(tag); if (cls) n.className = cls; if (text !== undefined && text !== null) n.textContent = text; return n; }
  function btn(text, cls, fn, key) { var b = el('button', 'lp-btn lp-btn-sm ' + (cls || 'lp-btn-ghost'), text); b.type = 'button'; if (key) b.setAttribute('data-k', key); if (fn) b.addEventListener('click', fn); return b; }
  var tt; function toast(m) { var t = $('[data-toast]'); if (!t) return; t.textContent = m; t.classList.add('is-on'); clearTimeout(tt); tt = setTimeout(function () { t.classList.remove('is-on'); }, 2600); }
  function save(name, text) { var u = URL.createObjectURL(new Blob([text.charAt(0) === '\\uFEFF' ? text : '\\uFEFF' + text], { type: 'text/csv;charset=utf-8' })); var a = el('a'); a.href = u; a.download = name; doc.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 1500); }
  function ago(t) { if (!t) return ''; var s = Math.round((Date.now() - t) / 1000); return s < 60 ? '방금' : s < 3600 ? Math.floor(s / 60) + '분 전' : Math.floor(s / 3600) + '시간 전'; }
  function mmss(ms) { var s = Math.max(0, Math.round(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }

  // 밝게·어둡게(참가자 화면과 같은 저장 값)
  var tb = $('[data-theme-toggle]');
  if (tb) tb.addEventListener('click', function () {
    var cur = root.getAttribute('data-theme'), dark = cur === 'dark' || (cur !== 'light' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
    root.setAttribute('data-theme', dark ? 'light' : 'dark'); try { localStorage.setItem('lp-theme', dark ? 'light' : 'dark'); } catch (e) { }
  });

  var form = $('[data-admin-form]'), main = $('[data-console-main]'), box = $('[data-admin-box]');
  var PREVIEW = doc.body.hasAttribute('data-lp-preview'), LOCALPAGE = /^(file|about|blob|data):$/.test(location.protocol);
  /** 이 사이트의 폴더 주소(…/). /console.html이든 /console(확장자 없는 주소)이든 같음. 파일로 열었거나 미리보기면 '' */
  // localhost·127.x로 연 강사 화면: 그 주소는 이 컴퓨터에서만 열림. 참가자·휴대폰 QR에는 Node 서버가 알려 주는 같은 와이파이 주소(/api/lan)를,
  // 모르면 QR 자리에 바꾸는 법을 보임
  var LOOP = !DATA.siteUrl && !LOCALPAGE && /^(localhost|127(?:\\.\\d+){3}|\\[::1\\])$/.test(location.hostname), LAN = '', onLan = [];
  var LOOP_MSG = 'localhost 주소는 이 컴퓨터에서만 열려요. 노트북의 와이파이 주소(예: http://192.168.0.10:8787)로 이 화면을 다시 열면 참가자 QR이 나와요.';
  function siteDir() { if (LOCALPAGE) return ''; var dir = location.pathname.replace(/[^/]*$/, ''); return LOOP ? (LAN ? LAN + dir : '') : location.origin + dir; }
  if (LOOP && window.fetch) fetch('/api/lan', { cache: 'no-store', credentials: 'omit' }).then(function (r) { return r.ok ? r.json() : {}; }).then(function (j) {
    var u = j && j.urls && j.urls[0];
    if (typeof u === 'string' && /^http:\\/\\/[\\d.]+:\\d+\\/?$/.test(u)) { LAN = u.replace(/\\/$/, ''); onLan.forEach(function (f) { f(); }); }
  }, function () { });
  /** 들어간 뒤에만 보이는 것(위 띠의 다른 화면·도움말): 강사용 화면에 잘못 온 참가자에게는 열쇠 칸과 [참가자 화면으로]만 */
  function showAfterLogin() { [].forEach.call(doc.querySelectorAll('[data-after-login]'), function (n) { n.hidden = false; }); }

  // ── 더보기(참가자 화면·QR 안내문·접속 확인·휴대폰에서 열기·도움말) ──
  var moreBox = $('[data-more]'), moreBtn = $('[data-more-btn]'), moreMenu = $('[data-more-menu]');
  function menuItems() { return [].slice.call(moreMenu.querySelectorAll('li:not([hidden]) a, li:not([hidden]) button')); }
  function setMenu(open, focusFirst) {
    if (!moreMenu) return;
    moreMenu.hidden = !open; moreBtn.setAttribute('aria-expanded', String(open));
    // 열린 동안 아래 칸은 잠시 누를 수 없게(메뉴 밖을 누르면 닫히기만 하고, 메뉴에 반쯤 가린 단추를 잘못 누르지 않게)
    [main, $('[data-console-help]')].forEach(function (n) { if (n) n.inert = open; });
    if (open && focusFirst) { var f = menuItems()[0]; if (f) f.focus(); }
  }
  if (moreBtn && moreMenu) {
    moreBtn.addEventListener('click', function (e) { setMenu(moreMenu.hidden, e.detail === 0); });
    moreMenu.addEventListener('click', function (e) { if (e.target.closest('a,button')) setMenu(false); });
    moreMenu.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      var its = menuItems(), i = its.indexOf(doc.activeElement); e.preventDefault();
      var n = its[(i + (e.key === 'ArrowDown' ? 1 : -1) + its.length) % its.length]; if (n) n.focus();
    });
    moreBox.addEventListener('focusout', function (e) { if (!moreMenu.hidden && e.relatedTarget && !moreBox.contains(e.relatedTarget)) setMenu(false); });
    doc.addEventListener('click', function (e) { if (!moreMenu.hidden && !moreBox.contains(e.target)) setMenu(false); });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !moreMenu.hidden) { setMenu(false); moreBtn.focus(); } });
  }
  var helpBtn = $('[data-help-open]'), help = $('[data-console-help]');
  if (helpBtn && help) helpBtn.addEventListener('click', function () { help.open = true; var sm = $('summary', help); help.scrollIntoView({ block: 'start' }); if (sm) sm.focus({ preventScroll: true }); });

  // ── 발표 화면 띄우기 ──
  // 1) 크롬·엣지에 프로젝터(두 번째 화면)가 이어져 있으면 Presentation API로 그 화면에 바로 전체 화면(고르는 창이 한 번 뜸).
  //    받는 쪽은 저장소가 따로라 관리자 키를 받지 않음(발표 화면은 보기만 하면 됨)
  // 2) 아니면 새 창(탭이 아니라 창이라 프로젝터 쪽으로 끌기 쉬움). 발표 화면이 '전체 화면' 안내를 띄움.
  //    이미 연 창이 있으면 다시 불러오지 않고 앞으로만
  var SCREEN = 'screen.html', scrWin = null, pres = null, presReq = null, presAvail = false, hintT = 0;
  function say2(t) { if (C.stageHint) { C.stageHint.textContent = t || ''; C.stageHint.hidden = !t; clearTimeout(hintT); if (t) hintT = setTimeout(function () { say2(''); }, 30000); } else if (t) toast(t); }
  try {
    if (!PREVIEW && !LOCALPAGE && window.PresentationRequest && navigator.presentation) {
      presReq = new PresentationRequest([SCREEN]);
      presReq.getAvailability().then(function (a) {
        var sync = function () { presAvail = !!a.value; var w = $('[data-screen-window]'); if (w) w.closest('li').hidden = !presAvail; if (presAvail) root.setAttribute('data-pres', ''); else root.removeAttribute('data-pres'); };
        sync(); a.onchange = sync;
      }, function () { presAvail = false; });
    }
  } catch (e) { presReq = null; }
  function setPres(c) {
    pres = c; paintStage();
    var off = function () { if (pres === c) { pres = null; paintStage(); } };
    c.addEventListener('close', off); c.addEventListener('terminate', off);
  }
  function openWindow() {
    if (scrWin && !scrWin.closed) { try { scrWin.focus(); } catch (e) { } say2('발표 화면 창은 이미 열려 있어요. 앞으로 가져왔어요.'); return; }
    if (PREVIEW) { say2('미리보기에서는 새 창을 열지 않아요. 미리볼 화면에서 [발표 화면]을 고르세요.'); return; }
    var w = null;
    try {
      // 이름이 같은 창이 이미 있으면(강사 화면을 새로 고친 뒤) 다시 불러오지 않고 그 창을 씀.
      // 파일로 열었으면(USB) 빈 창 주소를 읽을 수 없으니 바로 그 주소로
      w = window.open('', 'lp-screen', 'popup,width=1280,height=720');
      if (w) { var fresh = true; try { fresh = w.location.href === 'about:blank' || !/screen(\\.html)?$/.test(w.location.pathname); } catch (x) { } if (fresh) w.location.replace(new URL(SCREEN, location.href).href); }
    } catch (e) { }
    if (!w) { say2('브라우저가 새 창을 막았어요. 주소창 오른쪽의 팝업 표시를 눌러 허용한 뒤 다시 눌러 주세요.'); return; }
    scrWin = w; try { w.focus(); } catch (e) { }
    say2('새 창으로 열었어요. 창을 프로젝터 화면으로 끌어다 놓고 그 창의 [전체 화면]을 누르세요.');
  }
  function openScreen(windowOnly) {
    if (pres && pres.state === 'connected') { say2('발표 화면이 프로젝터에 떠 있어요. 끄려면 [발표 화면 끄기]를 누르세요.'); return; }
    if (!windowOnly && presReq && presAvail) {
      presReq.start().then(function (c) { setPres(c); say2('프로젝터에 발표 화면을 띄웠어요. 이 화면에서 누르는 것이 바로 보여요.'); }, function (err) {
        if (err && err.name === 'NotFoundError') openWindow();
        else say2('프로젝터를 고르지 않았어요. 창으로 열려면 [더보기] → [발표 화면 새 창]을 누르세요.');
      });
      return;
    }
    openWindow();
  }
  var scrBtn = $('[data-screen-open]'), scrWinBtn = $('[data-screen-window]');
  if (scrBtn) scrBtn.addEventListener('click', function () { openScreen(false); });
  if (scrWinBtn) scrWinBtn.addEventListener('click', function () { openScreen(true); });

  var C = {};
  if (!DATA.live || !window.LecLive) {
    if (box) box.hidden = true;
    showAfterLogin();
    if (main) { main.hidden = false; main.appendChild(el('p', 'lp-con-empty', '이 사이트는 참여 기능이 꺼져 있어 강사 화면을 쓸 수 없어요. [발표 화면 띄우기]로 QR과 도구(이름 뽑기·모둠·타이머)를 띄울 수 있어요.')); }
    return;
  }

  var U = LecLive.util, X = U.ext;
  var LOCAL = DATA.live.provider === 'local';
  var feats = DATA.live.features || [], secs = BP.sections || [], stations = BP.stations || [];
  function has(f) { return feats.indexOf(f) >= 0; }
  function hasSec(t) { return secs.some(function (s) { return s.type === t; }); }
  var polls = []; secs.forEach(function (s) { if (s.type === 'poll' && s.items) polls = polls.concat(s.items); });
  var MODERATE = secs.some(function (s) { return s.type === 'board' && s.moderation; });
  // 파일 올리기: 보드가 파일을 받지 않으면(allowFiles:false, 만 14세 미만 연수 등) 서버도 받지 않게 상태에 적어 둠
  var NOFILES = !secs.some(function (s) { return s.type === 'board' && s.allowFiles !== false && s.maxFiles !== 0; });
  var ON = {
    progress: stations.length > 0 && has('progress'), help: has('help'), qa: hasSec('qa') || has('qa'), signal: has('signal'),
    board: hasSec('board') || has('board'), survey: (DATA.survey || 0) > 0, attend: has('attendance') || hasSec('attendance'),
  };
  // 명단 손으로 더하기·고치기: 실제 서버(http)와 리허설(local)만. 시트·Supabase는 CSV로 받아 고침
  var ROSTER_EDIT = DATA.live.provider === 'local' || DATA.live.provider === 'http';
  // 교재 쪽 그림 [쪽, 경로, 제목]: 발표 화면이 띄우는 쪽. 참가자 교재 넘기기(BP.pages)가 있으면 같은 쪽들
  var DECK = (Array.isArray(BP.deck) ? BP.deck : []).filter(function (x) { return Array.isArray(x) && +x[0] > 0 && typeof x[1] === 'string'; });
  var PAGES = DECK.length ? DECK.map(function (x) { return +x[0]; }) : (BP.pages || []);
  function deckAt(n) { return DECK.filter(function (x) { return +x[0] === +n; })[0] || null; }
  // 투표 패널은 늘 둠: 미리 넣은 문항이 없어도 즉석 투표(polls 모음)를 바로 띄울 수 있게
  var COLS = ['participants', 'polls', 'answers'].concat(ON.attend ? ['attendance'] : [], ON.progress ? ['progress'] : [], ON.help ? ['help'] : [], ON.qa ? ['questions'] : [], ON.board ? ['posts'] : [], ON.survey ? ['survey'] : []);
  var conn = null, data = {}, state = {}, P = {};
  COLS.forEach(function (c) { data[c] = {}; });
  function vals(c) { var b = data[c] || {}; return Object.keys(b).map(function (k) { return b[k]; }); }
  function now() { return conn && conn.now ? conn.now() : Date.now(); }

  // ── 관리자 키 ──
  // 키 이름에 사이트 경로를 넣음: 여러 사이트가 한 출처를 쓰는 서버(바로 배포)에서 다른 사이트의 화면이 이 키를 쓰지 못하게
  var ADMIN_SLOT = 'lp-admin:' + location.pathname.replace(/[^/]*$/, '') + ':' + DATA.live.code;
  function store(kind) { try { return window[kind]; } catch (e) { return null; } }
  var KEY_TAB = !!DATA.keyTab;
  function savedKey() { var s = store('sessionStorage'), l = KEY_TAB ? null : store('localStorage'); try { return (s && s.getItem(ADMIN_SLOT)) || (l && l.getItem(ADMIN_SLOT)) || ''; } catch (e) { return ''; } }
  function keepKey(key, remember) {
    var s = store('sessionStorage'), l = store('localStorage');
    try { if (s) s.setItem(ADMIN_SLOT, key); } catch (e) { }
    try { if (l) { if (remember && !KEY_TAB) l.setItem(ADMIN_SLOT, key); else l.removeItem(ADMIN_SLOT); } } catch (e) { }
  }
  function forgetKey() { [store('sessionStorage'), store('localStorage')].forEach(function (s) { try { if (s) s.removeItem(ADMIN_SLOT); } catch (e) { } }); }
  var keyIn = $('#lp-key'), msg = $('[data-key-msg]'), go = $('[data-key-go]'), rem = $('[data-remember]'), remHint = $('[data-remember-hint]');
  var fails = 0, waitUntil = 0, waitT = 0, busy = false;
  function say(t) { if (msg) msg.textContent = t || ''; if (keyIn) keyIn.setAttribute('aria-invalid', t ? 'true' : 'false'); }
  function holdFor(sec, why) {
    waitUntil = Date.now() + sec * 1000; clearInterval(waitT);
    var tick = function () {
      var left = Math.ceil((waitUntil - Date.now()) / 1000);
      if (left <= 0) { clearInterval(waitT); go.disabled = false; go.textContent = '들어가기'; return; }
      go.disabled = true; go.textContent = left + '초 뒤에 다시';
    };
    say(why); tick(); waitT = setInterval(tick, 500);
  }
  if (rem && KEY_TAB) {
    // 예전에 이 기기에 기억해 둔 키도 지움(사이트 스크립트가 읽을 수 있는 곳)
    try { var l0 = store('localStorage'); if (l0) l0.removeItem(ADMIN_SLOT); } catch (e) { }
    rem.checked = false; rem.disabled = true;
    if (remHint) remHint.textContent = '이 사이트에는 직접 쓴 스크립트가 있어 키를 이 탭에만 둬요. 탭을 닫으면 다시 넣어 주세요.';
  } else if (rem) {
    try { rem.checked = !!(store('localStorage') && store('localStorage').getItem(ADMIN_SLOT)); } catch (e) { }
    var remSay = function () { if (!remHint) return; remHint.textContent = rem.checked ? '이 기기에 남아요. 공용 컴퓨터라면 끄고, 다 쓴 뒤 [나가기]를 눌러 지워 주세요.' : '끄면 이 탭을 닫을 때 잊어요. 공용 컴퓨터에서는 켜지 마세요.'; if (rem.checked) remHint.setAttribute('data-warn', ''); else remHint.removeAttribute('data-warn'); };
    rem.addEventListener('change', remSay); remSay();
  }
  // ⑪ 교실 LAN 서버 등 http(암호화 없음)로 키가 오가면 한 줄. localhost는 이 컴퓨터 안이라 뺌
  (function () {
    var plain = function (u) { try { var x = new URL(u, location.href); return x.protocol === 'http:' && !/^(localhost|127\\.\\d+\\.\\d+\\.\\d+|\\[::1\\])$/.test(x.hostname); } catch (e) { return false; } };
    if (!LOCAL && msg && (plain(location.href) || plain(DATA.live.url || ''))) {
      var w = el('p', 'lp-con-hint', '이 연결은 암호화되지 않아요(http). 같은 Wi-Fi의 다른 기기가 관리자 키를 엿볼 수 있으니 연수가 끝나면 키를 바꿔 주세요.');
      w.setAttribute('data-warn', ''); w.setAttribute('data-insecure', ''); msg.parentNode.insertBefore(w, msg);
    }
  })();
  var show = $('[data-key-show]');
  if (show && keyIn) show.addEventListener('click', function () { var on = keyIn.type === 'password'; keyIn.type = on ? 'text' : 'password'; show.setAttribute('aria-pressed', String(on)); show.setAttribute('aria-label', on ? '키 숨기기' : '키 표시'); keyIn.focus(); });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var k = String(keyIn.value || '').trim();
    if (!k) { say('관리자 키를 넣어 주세요.'); keyIn.focus(); return; }
    if (Date.now() < waitUntil) return;
    start(k, !!(rem && rem.checked), '');
  });
  var saved = savedKey(), ADMIN_KEY = '';
  // 휴대폰에서 열기 QR로 왔으면 그 키로(이 탭에만). 아니면 이 탭·이 기기에 둔 키
  if (qrKey) start(qrKey, false, 'qr');
  else if (saved) start(saved, !KEY_TAB && !!(store('localStorage') && (function () { try { return store('localStorage').getItem(ADMIN_SLOT); } catch (e) { return ''; } })()), 'saved');
  else if (keyIn) setTimeout(function () { keyIn.focus(); }, 0);

  /** from: ''(직접 넣음) · 'saved'(기억해 둔 키) · 'qr'(휴대폰에서 열기 QR) */
  function start(key, remember, from) {
    var auto = from === 'saved';
    if (busy) return; busy = true; say(''); go.disabled = true; go.textContent = '확인하는 중…';
    setConn('connecting');
    var c;
    try { c = LecLive.create(DATA.live); } catch (e) { busy = false; go.disabled = false; go.textContent = '들어가기'; say('참여 기능을 불러오지 못했어요. 새로 고침해 주세요.'); return; }
    // 공개 연결부터 열고, 키는 한 번만 물어 확인(틀린 키가 요청마다 여러 번 세어져 맞는 키까지 막히지 않게)
    c.connect().then(function () { return c.useAdminKey(key); }).then(function (ok) {
      if (!ok) throw LecLive.error('admin_required', '관리자 키가 맞지 않아요.', { status: 403 });
      return c.getState().then(function (s) { state = s || {}; });
    }).then(function () {
      busy = false; fails = 0; conn = c; ADMIN_KEY = key; keepKey(key, remember); if (keyIn) keyIn.value = '';
      enter();
    }, function (err) {
      busy = false; try { c.close(); } catch (e) { }
      setConn('idle');
      go.disabled = false; go.textContent = '들어가기';
      var st = err && err.status;
      // 같은 학교망의 다른 기기가 틀린 키를 넣어도 이렇게 막힘: 기억해 둔 키는 지우지 않음(이미 들어온 강사 화면은 세션으로 계속 씀)
      if (st === 429) { holdFor(Math.min(900, Math.max(10, +err.retryAfter || 60)), '키가 여러 번 틀려 서버가 잠시 막았어요. 기다린 뒤 다시 넣어 주세요. 이미 열어 둔 강사 화면은 그대로 쓸 수 있어요.'); return; }
      if (st === 401 || st === 403 || (err && err.code === 'admin_required')) {
        if (auto) { forgetKey(); say('기억해 둔 관리자 키가 맞지 않아 지웠어요. 다시 넣어 주세요.'); return; }
        if (from === 'qr') { say('QR에 든 관리자 키가 맞지 않아요. 노트북의 강사 화면에서 QR을 다시 보이거나 키를 넣어 주세요.'); if (keyIn) keyIn.focus(); return; }
        fails++;
        // 틀린 키를 계속 넣으면 이 화면에서도 조금씩 늦춤(서버도 따로 셈)
        if (fails >= 3) holdFor(Math.min(60, Math.pow(2, fails - 2) * 5), '관리자 키가 맞지 않아요. 배포할 때 받은 키를 다시 확인해 주세요.');
        else say('관리자 키가 맞지 않아요. 배포할 때 받은 키를 다시 확인해 주세요.');
        if (keyIn) { keyIn.select(); keyIn.focus(); }
        return;
      }
      say('참여 기능 서버에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 해 주세요. 참가자 화면의 교재·실습은 그대로 열리니, 질문은 구두로 받아 주세요. 계속 안 되면 접속 확인(check.html)을 열어 보세요.');
    });
  }
  var logout = $('[data-logout]');
  if (logout) logout.addEventListener('click', function () {
    forgetKey(); try { if (conn) conn.close(); } catch (e) { }
    location.reload();
  });

  // ── 연결 상태 ──
  var connEl = $('[data-conn]'), connTx = $('[data-conn-text]');
  function setConn(s) {
    if (!connEl) return;
    var t = { idle: '들어가기 전', connecting: '연결하는 중…', live: LOCAL ? '리허설 · 이 브라우저에서만' : '연결됨 · 실시간', polling: '연결됨 · 천천히 묻는 중', offline: '연결이 끊겼어요 · 다시 잇는 중' }[s] || s;
    connEl.setAttribute('data-state', LOCAL && s === 'live' ? 'local' : s); if (connTx) connTx.textContent = t;
  }

  // ── 묻기 방식·할 일·전날 점검(맨 위 한 줄) ──
  // 학교망에서 실시간 연결이 막히면 참가자 화면은 '긴 대기 묻기'(바뀌면 바로, 없으면 20초마다)나 간격 묻기로 바뀜. 강사가 무엇을 할지 한 줄로
  function secText(ms) { return Math.max(1, Math.round((ms || 0) / 1000)) + '초'; }
  function netWords(st, ni) {
    var t = ni.transport, hint = ni.hint >= 10000 ? ' 오늘 서버가 붐벼 ' + secText(ni.hint) + ' 간격으로 늘렸어요.' : '';
    if (LOCAL) return ['리허설 · 이 브라우저 안에서만', '참가자 휴대폰과는 이어지지 않아요. 실제 연수 전에 참여 기능 서버를 연결해 다시 배포하세요.'];
    if (st === 'offline') return ['연결이 끊겼어요 · 다시 잇는 중', '참가자 화면의 교재·실습·프롬프트는 그대로 열려요. 질문은 구두로 받고, 설문은 QR로 다른 설문지를 띄워도 돼요. 연결되면 쌓인 글이 들어와요.'];
    if (t === 'ws' || t === 'realtime') return ['연결됨 · 바로 받음(웹소켓)', ''];
    if (t === 'sse') return ['연결됨 · 바로 받음(SSE)', ''];
    if (t === 'long') return ['긴 대기 묻기 · 바뀌면 바로, 없으면 ' + (ni.wait || 20) + '초마다', '이 망이 웹소켓을 막아 천천히 묻는 중이에요. 질문·투표가 몇 초 늦게 보여요. 그대로 써도 돼요.' + hint];
    if (t === 'poll') return [(ni.every ? secText(ni.every) + '마다 묻기' : '간격 묻기'), '이 망이 웹소켓을 막아 정해진 간격으로 물어요. 질문·투표가 조금 늦게 보여요. 그대로 써도 돼요.' + hint];
    return ['연결됨', ''];
  }
  /** 접속 확인(check.html)이 이 기기에 남긴 마지막 결과(다른 기기에서 한 확인은 여기서 알 수 없음) */
  function lastCheck() { try { var v = JSON.parse(localStorage.getItem('lp-check:' + location.pathname.replace(/[^/]*$/, '')) || 'null'); return v && v.at ? v : null; } catch (e) { return null; } }
  function paintNet() {
    if (!C.net) return;
    var st = conn ? conn.status : 'offline', ni = conn && conn.netInfo ? conn.netInfo() : {};
    var w = netWords(st, ni), ck = lastCheck();
    C.box.setAttribute('data-state', LOCAL ? 'local' : st === 'offline' ? 'offline' : ni.transport === 'long' || ni.transport === 'poll' ? 'polling' : 'live');
    C.netWay.textContent = w[0]; C.netDo.textContent = w[1]; C.netDo.hidden = !w[1];
    C.netCk.textContent = '';
    if (ck) {
      var d = new Date(ck.at), when = (d.getMonth() + 1) + '. ' + d.getDate() + '. ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
      C.netCk.appendChild(doc.createTextNode('이 기기에서 한 접속 확인 ' + when + ' · ' + (ck.verdict || '') + (ck.live ? ' · 참여 기능 ' + ck.live : '') + ' '));
    } else C.netCk.appendChild(doc.createTextNode('이 기기에서는 아직 접속 확인을 하지 않았어요. 전날 연수 장소 Wi-Fi로 열어 보세요. '));
    var a = el('a', '', ck ? '다시 확인' : '접속 확인 열기'); a.href = 'check.html'; a.target = '_blank'; a.rel = 'noopener'; C.netCk.appendChild(a);
  }
  /** 맨 위 상자: 발표 화면(지금 크게 보이는 것·참여 QR 크게·끄기) · 묻기 방식(연결·접속 확인) · 연수가 끝났으면 기록 정리로 */
  function buildNet() {
    C.box = el('div', 'lp-con-net');
    var r1 = el('div', 'lp-con-net-r lp-con-stage'); r1.setAttribute('role', 'group'); r1.setAttribute('aria-labelledby', 'lp-stage-l');
    var h1 = el('p', 'lp-con-net-h'), b1 = el('b', '', '발표 화면'); b1.id = 'lp-stage-l'; h1.appendChild(b1); C.stageNow = el('span'); h1.appendChild(C.stageNow); r1.appendChild(h1);
    var act = el('div', 'lp-con-net-act');
    C.qrSw = el('button', 'lp-switch'); C.qrSw.type = 'button'; C.qrSw.setAttribute('role', 'switch'); C.qrSw.setAttribute('data-k', 'qrbig');
    C.qrSw.appendChild(el('i')); C.qrSw.appendChild(el('span', '', '참여 QR 크게')); C.qrSwS = el('small'); C.qrSw.appendChild(C.qrSwS);
    C.qrSw.addEventListener('click', function () { var on = !qrBig(); setState({ ui: { qrBig: on ? true : null } }, on ? '발표 화면에 참여 QR을 크게 띄웠어요.' : '발표 화면의 큰 QR을 내렸어요.'); });
    act.appendChild(C.qrSw);
    C.presOff = btn('발표 화면 끄기', '', function () { try { if (pres) pres.terminate(); } catch (e) { } say2('프로젝터의 발표 화면을 껐어요.'); }, 'presoff'); C.presOff.hidden = true; act.appendChild(C.presOff);
    r1.appendChild(act);
    C.stageHint = el('p', 'lp-con-net-do'); C.stageHint.setAttribute('role', 'status'); C.stageHint.hidden = true; r1.appendChild(C.stageHint);
    C.box.appendChild(r1);
    C.net = el('div', 'lp-con-net-r'); C.net.setAttribute('role', 'status'); C.net.setAttribute('aria-label', '연결 상태');
    var h = el('p', 'lp-con-net-h'); h.appendChild(el('b', '', '묻기 방식')); C.netWay = el('span'); h.appendChild(C.netWay); C.net.appendChild(h);
    C.netDo = el('p', 'lp-con-net-do'); C.net.appendChild(C.netDo);
    C.netCk = el('p', 'lp-con-net-ck'); C.net.appendChild(C.netCk);
    // 사이트 보관 끝 예정일(배포할 곳이 정한 값, meta.keepUntil): 연수 마지막 날보다 먼저 닫히면 다시 배포하라고 함께
    var ku = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(DATA.keepUntil || ''), last = ((DATA.phase && DATA.phase.end) || DATA.date || '').slice(0, 10);
    if (ku) C.net.appendChild(el('p', 'lp-con-net-ck', '사이트는 ' + (+ku[2]) + '월 ' + (+ku[3]) + '일까지 열려 있어요.' + (last && DATA.keepUntil < last ? ' 연수 날보다 먼저 닫혀요. 연수 전에 다시 배포해 주세요.' : '')));
    C.box.appendChild(C.net);
    if (ended()) {
      var r3 = el('div', 'lp-con-net-r lp-con-after'), h3 = el('p', 'lp-con-net-h');
      h3.appendChild(el('b', '', '연수 뒤')); h3.appendChild(el('span', '', '연수가 끝났어요. 명단·결과를 CSV로 받은 뒤 지워 주세요.')); r3.appendChild(h3);
      var go3 = el('a', 'lp-btn lp-btn-primary lp-btn-sm', '기록·정리로'); go3.href = '#lp-p-data';
      go3.addEventListener('click', function (e) { var t = $('#lp-p-data'); if (!t) return; e.preventDefault(); t.scrollIntoView({ block: 'start' }); var f = t.querySelector('button'); if (f) f.focus({ preventScroll: true }); });
      r3.appendChild(go3); C.box.appendChild(r3);
    }
    return C.box;
  }
  /** 연수 날짜·시간이 지났나(참가자 화면의 '끝난 연수'와 같은 기준). 주소 끝 ?phase=after로 미리보기 */
  function ended() { if (/[?&]phase=after\\b/.test(location.search)) return true; var e = DATA.phase && Date.parse(DATA.phase.end); return !!e && Date.now() > e; }
  function qrBig() { return (state.ui || {}).qrBig === true; }
  function clip(t, n) { var c = Array.from ? Array.from(String(t || '')) : String(t || '').split(''); return c.length > n ? c.slice(0, n).join('') + '…' : c.join(''); }
  /** 발표 화면에 지금 크게 보이는 것(발표 화면과 같은 규칙: 열린 투표 > 질문 > 기다리는 화면) */
  function stageWords() {
    var op = allPolls().filter(function (p) { return p.id === state.openPoll; })[0], out = [], ov = ovNow();
    if (ov === 'timer' || ov === 'notice' || ov === 'blank') out.push({ timer: '큰 타이머', notice: '큰 공지', blank: '가림' }[ov]);
    else if (DECK.length && !ov && curPage()) out.push('교재 ' + curPage() + '쪽');
    else if (op && ov !== 'qa') out.push('투표 「' + clip(op.question, 24) + '」 · ' + (X.revealed(state, op.id) ? '결과 공개' : '응답 수만'));
    else if (ON.qa) { var n = vals('questions').filter(function (q) { return q.status === 'open' || (q.pinned && q.status !== 'hidden'); }).length; out.push(n ? '질문 ' + n + '개(공감순)' : '질문을 기다리는 화면'); }
    else out.push('참여 안내');
    if (state.notice && state.notice.text) out.push('공지');
    if (state.timer && state.timer.running && state.timer.endsAt > now()) out.push('타이머');
    if (qrBig()) out.push('QR 크게');
    return out.join(' · ');
  }
  function paintStage() {
    if (!C.stageNow) return;
    C.stageNow.textContent = stageWords();
    var on = qrBig(); C.qrSw.setAttribute('aria-checked', String(on)); C.qrSwS.textContent = on ? '켜짐' : '꺼짐';
    C.presOff.hidden = !(pres && pres.state === 'connected');
  }

  function enter() {
    if (box) box.hidden = true; main.hidden = false; if (logout) logout.hidden = false; showAfterLogin(); if (connEl) connEl.hidden = false;
    conn.on('status', setConn); setConn(conn.status === 'polling' ? 'polling' : conn.status === 'offline' ? 'offline' : 'live');
    conn.on('status', function () { paintNet(); }); conn.on('net', function () { paintNet(); });
    addEventListener('storage', function (e) { if (e.key && e.key.indexOf('lp-check:') === 0) paintNet(); }); // 다른 탭에서 접속 확인을 마치면
    build(); loadAll(); conn.subscribe(onEvent);
    // 보드 '먼저 확인'(board.moderation)·파일 끄기: 서버가 새 글을 숨긴 채·파일 없이 받도록 상태에 적어 둠(관리자만 바꿀 수 있음)
    var mod = MODERATE || null, nof = NOFILES ? false : null, ui0 = state.ui || {}, pol = {};
    if ((ui0.moderation || null) !== mod) pol.moderation = mod;
    if ((ui0.uploads === false ? false : null) !== nof) pol.uploads = nof;
    if (Object.keys(pol).length) conn.setState({ ui: pol }).catch(function () { });
    // 참가자 교재 넘기기가 있으면 '강사 따라 넘기기'를 처음부터 켬(강사가 끈 적이 없으면)
    if ((BP.pages || []).length && !state.follow && !(state.ui || {}).followOff) setState({ follow: true });
    try { main.focus({ preventScroll: true }); } catch (e) { main.focus(); }
    setInterval(function () { if (!doc.hidden) { queue(); paintNet(); } }, 30000); // '몇 분 전'·묻기 간격을 새로
  }
  function loadAll() {
    COLS.forEach(function (c) { conn.list(c, {}).then(function (a) { (a || []).forEach(function (d) { data[c][d.id] = d; }); queue(); }, function () { }); });
  }
  function onEvent(ev) {
    if (!ev) return;
    if (ev.type === 'state') { state = ev.doc || ev.state || {}; queue(); return; }
    if (ev.type === 'reset') { COLS.forEach(function (c) { data[c] = {}; }); queue(); return; }
    var bag = data[ev.col]; if (!bag || !ev.doc) return;
    if (ev.type === 'remove') delete bag[ev.doc.id]; else bag[ev.doc.id] = Object.assign(bag[ev.doc.id] || {}, ev.doc);
    if (ev.col === 'help' && ev.type === 'add') toast('도움 요청: ' + (ev.doc.nickname || '참가자') + (ev.doc.seat ? ' · ' + ev.doc.seat : ''));
    queue();
  }
  // 여러 기록이 한꺼번에 와도 한 번만 다시 그림
  var raf = 0; function queue() { if (raf) return; raf = (window.requestAnimationFrame || setTimeout)(function () { raf = 0; render(); }); }
  function setState(patch, ok) { return conn.setState(patch).then(function (s) { state = s || Object.assign(state, patch); queue(); if (ok) toast(ok); }, function (e) { toast('보내지 못했어요: ' + (e && e.message || '연결을 확인해 주세요.')); }); }
  function err(e) { toast('처리하지 못했어요: ' + (e && e.message || '권한이나 연결을 확인해 주세요.')); }
  /** 다시 그려도 누르던 단추에 초점이 남게(data-k로 찾음) */
  function keep(node, fn) {
    var a = doc.activeElement, k = a && node.contains(a) && a.getAttribute('data-k'); fn();
    if (k) { var b = node.querySelector('[data-k="' + k.replace(/"/g, '') + '"]'); if (b) b.focus(); }
  }

  // ── 틀 ──
  function panel(id, title, area, col) {
    var p = el('section', 'lp-card lp-con-panel'); p.id = 'lp-p-' + id; p.setAttribute('data-area', area); p.setAttribute('aria-labelledby', 'lp-ph-' + id);
    var h = el('div', 'lp-con-ph'), h2 = el('h2', '', title); h2.id = 'lp-ph-' + id; h.appendChild(h2);
    var act = el('div', 'lp-con-ph-act'); h.appendChild(act); p.appendChild(h);
    var body = el('div'); body.style.display = 'grid'; body.style.gap = '14px'; p.appendChild(body); col.appendChild(p);
    P[id] = { box: p, h: h2, act: act, body: body, title: title }; return body;
  }
  function count(id, n) { var x = P[id]; if (!x) return; x.h.textContent = x.title; if (n != null) { var s = el('small', '', String(n)); x.h.appendChild(s); } }
  function build() {
    main.textContent = '';
    main.appendChild(buildNet()); paintNet();
    C.strip = el('div', 'lp-con-strip'); C.strip.setAttribute('role', 'region'); C.strip.setAttribute('aria-label', '지금 상황'); main.appendChild(C.strip);
    // 휴대폰(교실을 돌며 한 손으로): 칸이 한 줄로 길게 늘어서므로 위에 붙는 짧은 칸 이동 줄(투표 열기·다음 쪽까지 한 번에). 넓은 화면에서는 숨김(aux.css)
    var jump = el('nav', 'lp-con-jump'); jump.setAttribute('aria-label', '칸 바로 가기');
    [['pres', '발표'], ['run', '진행'], ON.attend && ['att', '출석'], ON.help && ['help', '도움'], ON.qa && ['qa', '질문'], ['poll', '투표'], ON.board && ['board', '보드'], ['lead', '이끌기'], ['data', '기록']].filter(Boolean).forEach(function (x) { var a = el('a', '', x[1]); a.href = '#lp-p-' + x[0]; jump.appendChild(a); });
    main.appendChild(jump);
    // 오른쪽 단: 자주 누르는 공지·타이머 → 읽는 것(도움 요청·이해 신호·실습 진행) → 가끔 쓰는 폼(이끌기·자료 링크) → 기록.
    // 참가자 수·도움 요청·신호·실습 막힘은 맨 위 띠에 숫자로 먼저 보임. 왼쪽 단: 질문·투표·보드
    var a = el('div', 'lp-con-col'), b = el('div', 'lp-con-col'); main.appendChild(a); main.appendChild(b);
    panel('pres', '발표', 'pres', a); buildPres();
    if (ON.qa) { panel('qa', '질문', 'qa', a); buildQA(); }
    panel('poll', '투표·퀴즈', 'poll', a); buildPoll();
    if (ON.board) { panel('board', '보드', 'board', a); buildBoard(); }
    panel('run', '진행', 'run', b); buildRun();
    if (ON.attend) { panel('att', '출석 명단', 'att', b); buildAtt(); }
    if (ON.help) panel('help', '도움 요청', 'help', b);
    if (ON.signal) panel('signal', '이해 신호', 'signal', b);
    if (ON.progress) panel('heat', '실습 진행 현황', 'heat', b);
    panel('lead', '참가자 화면', 'lead', b); buildLead();
    panel('data', '기록·정리', 'data', b); buildData();
    render();
  }

  // ── 그리기 ──
  function render() {
    if (!C.strip) return;
    var parts = vals('participants'), help = vals('help'), qs = vals('questions');
    var openHelp = help.filter(function (h) { return h.status !== 'done'; });
    var sig = ON.signal ? signalCounts() : null;
    var op = allPolls().filter(function (p) { return p.id === state.openPoll; })[0];
    keep(C.strip, function () {
      C.strip.textContent = '';
      kpi(parts.length, '참가자', parts.length ? ((DATA.words && DATA.words.code) || '연수 코드') + ' ' + DATA.live.code : '아직 들어온 사람이 없어요', '');
      if (ON.attend) { var rc = rosterCount(); kpi(rc.in, '입실', '퇴실 ' + rc.out + '명' + (rc.manual ? ' · 직접 추가 ' + rc.manual : ''), '#lp-p-att'); }
      if (ON.help) kpi(openHelp.length, '도움 요청', openHelp[0] ? (openHelp[0].nickname || '참가자') + (openHelp[0].seat ? ' · ' + openHelp[0].seat : '') : '없어요', '#lp-p-help', openHelp.length > 0);
      if (ON.signal) { var rs = sig.total ? Math.round(sig.red / sig.total * 100) : 0; kpi(rs + '%', '모르겠어요', sig.total + '명 중 ' + sig.red + '명', '#lp-p-signal', sig.total > 0 && rs >= 25); }
      if (ON.progress) { var pc = { done: 0, doing: 0, stuck: 0 }; latestProgress().forEach(function (x) { if (pc[x.status] !== undefined) pc[x.status]++; }); kpi(pc.stuck, '실습 막힘', '완료 ' + pc.done + ' · 하는 중 ' + pc.doing, '#lp-p-heat', pc.stuck > 0); }
      kpi(op ? pollAnswers(op.id).length : '–', '지금 투표', op ? op.question : '열린 투표가 없어요', '#lp-p-poll');
      if (ON.qa) kpi(qs.filter(function (q) { return q.status === 'open'; }).length, '열린 질문', '전체 ' + qs.length + '개', '#lp-p-qa');
      if (ON.survey) kpi(vals('survey').length, '설문 응답', '', '#lp-p-data');
    });
    doc.title = (openHelp.length ? '(' + openHelp.length + ') ' : '') + '강사 화면 · ' + (DATA.title || '');
    if (ON.qa) renderQA(qs);
    renderPres();
    if (ON.attend) renderAtt();
    renderPolls();
    if (ON.board) renderBoard();
    if (ON.help) renderHelp(openHelp);
    syncRun();
    if (ON.signal) renderSignal(sig);
    if (ON.progress) renderHeat(parts);
    paintStage();
  }
  function kpi(value, label, sub, href, alert) {
    var d = el(href ? 'a' : 'div', 'lp-con-kpi'); if (href) { d.href = href; d.setAttribute('data-k', 'kpi' + label); }
    if (alert) d.setAttribute('data-alert', '');
    d.appendChild(el('b', '', String(value))); d.appendChild(el('span', '', label)); if (sub) d.appendChild(el('small', '', sub));
    C.strip.appendChild(d);
  }

  // 질문: 거르기(열림·답변 완료·숨김) + 고정·답변 완료·숨기기, 새 질문 받기 잠그기
  var qaFilter = 'open';
  function lockSwitch(which, label) {
    var b = el('button', 'lp-switch'); b.type = 'button'; b.setAttribute('role', 'switch'); b.setAttribute('data-k', 'lock-' + which);
    b.appendChild(el('i')); b.appendChild(el('span', '', label)); var s = el('small'); b.appendChild(s);
    var said = { qa: ['새 질문을 잠갔어요. 참가자 화면에 안내가 떠요.', '질문을 다시 받아요.'], board: ['새 보드 글을 잠갔어요.', '보드 글을 다시 받아요.'], join: ['참여를 닫았어요. 이미 들어온 사람은 그대로 써요.', '참여를 다시 받아요.'] }[which];
    b.addEventListener('click', function () { var lock = !X.locked(state, which); setState(X.lockPatch(which, lock), said[lock ? 0 : 1]); });
    b._sync = function () { var on = !X.locked(state, which); b.setAttribute('aria-checked', String(on)); s.textContent = on ? '켜짐' : '꺼짐'; };
    return b;
  }
  function buildQA() {
    var b = P.qa.body;
    C.qaLock = lockSwitch('qa', '질문 받기'); P.qa.act.appendChild(C.qaLock);
    var seg = el('div', 'lp-seg'); seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', '보일 질문');
    C.qaSeg = {};
    [['open', '열림'], ['answered', '답변 완료'], ['hidden', '숨김']].forEach(function (x) {
      var s = el('button', '', x[1]); s.type = 'button'; s.setAttribute('data-k', 'f-' + x[0]); s.setAttribute('aria-pressed', String(qaFilter === x[0]));
      s.addEventListener('click', function () { qaFilter = x[0]; Object.keys(C.qaSeg).forEach(function (k) { C.qaSeg[k].setAttribute('aria-pressed', String(k === qaFilter)); }); renderQA(vals('questions')); });
      C.qaSeg[x[0]] = s; seg.appendChild(s);
    });
    b.appendChild(seg);
    C.qaList = el('ul', 'lp-con-list'); C.qaList.setAttribute('aria-label', '질문 목록'); b.appendChild(C.qaList);
    b.appendChild(el('p', 'lp-con-sub', '공감이 많은 순, 고정한 질문이 맨 위예요. 숨긴 질문은 참가자·발표 화면에서 사라져요. 링크가 든 질문은 발표 화면에서 주소를 가려요.'));
  }
  function renderQA(qs) {
    if (C.qaLock) C.qaLock._sync();
    var n = { open: 0, answered: 0, hidden: 0 }; qs.forEach(function (q) { if (n[q.status] !== undefined) n[q.status]++; });
    Object.keys(C.qaSeg).forEach(function (k) { C.qaSeg[k].textContent = ({ open: '열림', answered: '답변 완료', hidden: '숨김' })[k] + ' ' + n[k]; });
    count('qa', qs.length);
    var list = qs.filter(function (q) { return (q.status || 'open') === qaFilter; }).sort(function (a, b) { return (!!b.pinned - !!a.pinned) || (b.votes || 0) - (a.votes || 0) || (b.createdAt || 0) - (a.createdAt || 0); });
    keep(C.qaList, function () {
      C.qaList.textContent = '';
      if (!list.length) { C.qaList.appendChild(el('li', 'lp-con-empty', qaFilter === 'open' ? '아직 질문이 없어요. 참가자 화면의 [질문]에서 올라와요.' : '해당하는 질문이 없어요.')); return; }
      list.forEach(function (q) {
        var li = el('li', 'lp-con-item' + (q.pinned ? ' is-pinned' : '') + (q.status === 'hidden' ? ' is-off' : ''));
        var v = el('div', 'lp-con-v'); v.appendChild(el('b', '', String(q.votes || 0))); v.appendChild(el('span', '', '공감')); li.appendChild(v);
        li.appendChild(el('p', 'lp-con-t', q.text || ''));
        var m = el('p', 'lp-con-m');
        if (q.pinned) m.appendChild(el('b', '', '고정'));
        m.appendChild(el('span', '', q.anonymous || !q.nickname ? '익명' : q.nickname)); m.appendChild(el('span', '', ago(q.createdAt)));
        if (U.hasLink && U.hasLink(q.text)) m.appendChild(el('em', '', '링크 있음'));
        li.appendChild(m);
        var a = el('div', 'lp-con-a');
        var spot = (state.ui || {}).q === q.id && ovNow() === 'qa';
        if (q.status !== 'hidden') a.appendChild(btn(spot ? '발표 화면에서 내리기' : '발표 화면에 크게', spot ? 'lp-btn-primary' : '', function () { setState(spot ? { ui: { q: null, ov: null } } : { ui: { q: q.id, ov: 'qa', qrBig: null } }, spot ? '발표 화면에서 질문을 내렸어요.' : '발표 화면에 이 질문을 크게 띄웠어요.'); }, 'spot' + q.id));
        a.appendChild(btn(q.pinned ? '고정 풀기' : '고정', '', function () { conn.update('questions', q.id, { pinned: !q.pinned }).catch(err); }, 'pin' + q.id));
        if (q.status !== 'hidden') a.appendChild(btn(q.status === 'answered' ? '다시 열기' : '답변 완료', '', function () { conn.update('questions', q.id, { status: q.status === 'answered' ? 'open' : 'answered' }).catch(err); }, 'ans' + q.id));
        a.appendChild(btn(q.status === 'hidden' ? '숨기기 취소' : '숨기기', '', function () { conn.update('questions', q.id, { status: q.status === 'hidden' ? 'open' : 'hidden', pinned: false }).catch(err); }, 'hide' + q.id));
        li.appendChild(a); C.qaList.appendChild(li);
      });
      // 휴대폰에서는 처음 5개만(질문이 몰리면 투표·진행 칸이 한참 아래로 밀리지 않게). 넓은 화면은 모두(aux.css)
      var fold = list.length > 5;
      C.qaList.toggleAttribute('data-fold', fold && !C.qaAll);
      if (fold) { var fl = el('li', 'lp-con-fold'); fl.appendChild(btn(C.qaAll ? '처음 5개만 보기' : '질문 ' + list.length + '개 모두 보기', '', function () { C.qaAll = !C.qaAll; renderQA(vals('questions')); }, 'qafold')); C.qaList.appendChild(fl); }
    });
  }

  // 투표: 지금 열린 투표(막대) · 나머지 투표 · 즉석 투표 만들기
  function quickPolls() {
    return vals('polls').filter(function (q) { return q.question && Array.isArray(q.options) && q.options.length && !/^bp:/.test(q.cid || ''); })
      .sort(function (a, b) { return (a.createdAt || 0) - (b.createdAt || 0); })
      .map(function (q) { return { id: q.id, question: q.question, kind: 'choice', options: q.options, quick: true, open: q.open !== false }; });
  }
  // 미리 넣은 투표·퀴즈는 교재 쪽 순서로(쪽이 없는 것은 사이트에 적힌 순서대로 뒤에)
  polls = polls.map(function (p, i) { return Object.assign({ _i: i }, p); }).sort(function (a, b) { return (a.page || 1e9) - (b.page || 1e9) || a._i - b._i; });
  function isQuiz(p) { return typeof p.answer === 'number' && p.answer >= 0 && p.options && p.options[p.answer] !== undefined; }
  function allPolls() { return polls.concat(quickPolls()); }
  function pollAnswers(id) { return vals('answers').filter(function (a) { return a.poll === id; }); }
  /** 열기·닫기. 즉석 투표는 닫으면 서버에서도 닫아 늦은 답을 받지 않음 */
  function togglePoll(p, openNow) {
    // 미리 넣은 투표를 처음 열 때 서버에 보기를 알려 둠(cid 'bp:<id>', 여러 번 보내도 하나): 서버가 보기 밖 답을 거절
    if (!openNow && !p.quick) registerPoll(p);
    // 열면 발표 화면에도 그 투표를 띄우고, 닫으면 투표를 띄워 둔 발표 화면을 교재로 돌림
    var ui = openNow ? (ovNow() === 'poll' ? { ov: null } : null) : { ov: 'poll', qrBig: null };
    setState(Object.assign({ openPoll: openNow ? '' : p.id }, ui ? { ui: ui } : {}), openNow ? '투표를 닫았어요.' : '투표를 띄웠어요. 참가자 화면과 발표 화면에 나와요.');
    if (p.quick && p.open === openNow) conn.update('polls', p.id, { open: !openNow }).catch(function () { });
  }
  function registerPoll(p) {
    if (LOCAL || !p || !p.id || String(p.id).length > 37) return;
    var kind = p.kind === 'word' || p.kind === 'scale' ? p.kind : 'choice';
    var opts = (p.options || []).map(function (o) { return String(o).slice(0, 100); }).slice(0, 20);
    if (kind === 'scale' && !opts.length) opts = ['1', '2', '3', '4', '5'];
    conn.add('polls', { question: String(p.question || p.id).slice(0, 200), kind: kind, options: kind === 'word' ? [] : opts, open: true, cid: 'bp:' + p.id }).catch(function () { });
  }
  function buildPoll() {
    var b = P.poll.body;
    C.pollNow = el('div'); b.appendChild(C.pollNow);
    C.pollList = el('ul', 'lp-con-polls'); C.pollList.setAttribute('aria-label', '투표 목록'); b.appendChild(C.pollList);
    var d = el('details', 'lp-con-quick'); var sm = el('summary'); sm.innerHTML = '<svg class="lp-ic" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>'; sm.appendChild(el('span', '', '즉석 투표 만들기')); d.appendChild(sm);
    var f = el('form'); f.setAttribute('aria-label', '즉석 투표 만들기');
    var lq = el('label', 'lp-con-sub', '질문 한 줄'); var q = el('input', 'lp-in'); q.maxLength = 120; q.placeholder = '예: 지금 몇 번 실습을 하고 있나요?'; q.id = 'lp-qp-q'; lq.htmlFor = 'lp-qp-q';
    f.appendChild(lq); f.appendChild(q);
    var og = el('div', 'lp-con-opts'), opts = [];
    function addOpt() { if (opts.length >= 5) return; var o = el('input', 'lp-in'); o.maxLength = 40; o.placeholder = '보기 ' + (opts.length + 1); o.setAttribute('aria-label', '보기 ' + (opts.length + 1)); opts.push(o); og.appendChild(o); more.hidden = opts.length >= 5; return o; }
    var more = btn('보기 추가', '', function () { var o = addOpt(); if (o) o.focus(); });
    f.appendChild(og); addOpt(); addOpt(); addOpt();
    var row = el('div', 'lp-con-row'); var goB = el('button', 'lp-btn lp-btn-primary lp-btn-sm', '바로 띄우기'); goB.type = 'submit';
    row.appendChild(goB); row.appendChild(more); f.appendChild(row);
    f.appendChild(el('p', 'lp-con-sub', '보기는 2~5개. 띄우면 지금 열린 투표 대신 이 투표가 나와요.'));
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var question = q.value.trim(), list = [];
      opts.forEach(function (o) { var v = o.value.trim(); if (v && list.indexOf(v) < 0) list.push(v); });
      if (!question) { toast('질문을 적어 주세요.'); q.focus(); return; }
      if (list.length < 2) { toast('보기를 두 개 이상 적어 주세요.'); (opts[list.length] || opts[0]).focus(); return; }
      goB.disabled = true;
      conn.add('polls', { question: question, kind: 'choice', options: list, open: true }).then(function (dd) {
        if (!dd || !dd.id) throw new Error('투표를 만들지 못했어요.');
        data.polls[dd.id] = dd; q.value = ''; opts.forEach(function (o) { o.value = ''; });
        return setState({ openPoll: dd.id, ui: { ov: 'poll', qrBig: null } }, '투표를 띄웠어요. 참가자 화면과 발표 화면에 나와요.');
      }).catch(err).then(function () { goB.disabled = false; });
    });
    d.appendChild(f); b.appendChild(d);
  }
  function tally(p, list) { return X.tally(list); }
  function renderPolls() {
    var all = allPolls(), op = all.filter(function (p) { return p.id === state.openPoll; })[0], hidden = X.hiddenWords(state);
    count('poll', all.length || null);
    keep(C.pollNow, function () {
      C.pollNow.textContent = '';
      if (!op) { C.pollNow.appendChild(el('p', 'lp-con-sub', all.length ? '지금 열린 투표가 없어요. 아래에서 열거나 즉석 투표를 만들어요.' : '미리 넣은 투표가 없어요. 아래 [즉석 투표 만들기]로 바로 띄울 수 있어요.')); return; }
      var list = pollAnswers(op.id), shown = X.revealed(state, op.id), box = el('div', 'lp-con-poll'), quiz = isQuiz(op);
      var h = el('div', 'lp-con-poll-h'); h.appendChild(el('p', '', (quiz ? '퀴즈 · ' : '') + op.question)); h.appendChild(el('small', '', (op.page ? op.page + '쪽 · ' : '') + '응답 ' + list.length + '명')); box.appendChild(h);
      if (op.kind === 'word') {
        var words = U.wordCloud(list, op.id, {}), wl = el('div', 'lp-con-words');
        words.slice(0, 24).forEach(function (w) {
          var off = hidden.indexOf(w.word) >= 0, chip = el('span', 'lp-con-word' + (off ? ' is-off' : ''));
          chip.appendChild(el('span', '', w.word + ' ' + w.count));
          chip.appendChild(btn(off ? '숨기기 취소' : '숨기기', '', function () { setState(X.hiddenPatch(state, w.word, !off)); }, 'w' + w.word));
          wl.appendChild(chip);
        });
        if (!words.length) wl.appendChild(el('p', 'lp-con-sub', '아직 낱말이 없어요.'));
        box.appendChild(wl);
      } else {
        var t = tally(op, list), opts = op.options && op.options.length ? op.options : Object.keys(t), total = Math.max(list.length, 1), ul = el('ol', 'lp-con-tally');
        opts.forEach(function (o, k) { var n = t[o] || 0, ok = quiz && k === op.answer, li = el('li', 'lp-con-tl' + (ok ? ' is-answer' : '')); li.appendChild(el('span', '', (ok ? '정답 · ' : '') + o)); li.appendChild(el('b', '', Math.round(n / total * 100) + '% · ' + n + '명')); var i = el('i'); i.style.setProperty('--w', Math.round(n / total * 100) + '%'); li.appendChild(i); ul.appendChild(li); });
        box.appendChild(ul);
      }
      var row = el('div', 'lp-con-row');
      // 퀴즈: 결과와 정답을 함께 공개(정답은 이때 처음 보냄 — 참가자 화면·발표 화면에는 미리 실리지 않음)
      var rv = btn(shown ? (quiz ? '결과·정답 숨기기' : '결과 숨기기') : (quiz ? '정답 공개' : '결과 공개'), shown ? '' : 'lp-btn-primary', function () {
        var patch = X.revealPatch(state, op.id, !shown);
        if (quiz && X.answerPatch) patch.ui.ans = X.answerPatch(state, op.id, shown ? -1 : op.answer).ui.ans;
        if (!shown && ovNow() !== 'poll') { patch.ui.ov = 'poll'; patch.ui.qrBig = null; }
        setState(patch, shown ? '참가자 화면에서 결과를 숨겼어요.' : quiz ? '정답과 결과를 공개했어요. 발표 화면에도 보여요.' : '참가자 화면에 결과를 공개했어요.');
      }, 'rv' + op.id);
      row.appendChild(rv); row.appendChild(btn('투표 닫기', '', function () { togglePoll(op, true); }, 'cl' + op.id));
      box.appendChild(row);
      box.appendChild(el('p', 'lp-con-sub', shown ? '참가자 화면과 발표 화면에 결과가 보여요.' : '결과는 아직 강사 화면에만 보여요. 발표 화면에는 응답 수만 나와요.'));
      C.pollNow.appendChild(box);
    });
    keep(C.pollList, function () {
      C.pollList.textContent = '';
      var here = curPage();
      all.filter(function (p) { return p !== op; }).forEach(function (p) {
        var li = el('li', p.page && p.page === here ? 'is-here' : ''), t = el('p', '', (p.quick ? '즉석 · ' : isQuiz(p) ? '퀴즈 · ' : '') + p.question); t.appendChild(el('small', '', (p.page ? p.page + '쪽' + (p.page === here ? '(지금 쪽)' : '') + ' · ' : '') + '응답 ' + pollAnswers(p.id).length + '명' + (p.quick && !p.open ? ' · 닫힘' : '')));
        li.appendChild(t); li.appendChild(btn('열기', '', function () { togglePoll(p, false); }, 'op' + p.id)); C.pollList.appendChild(li);
      });
    });
  }

  // 보드: 새 글 받기 잠그기, 먼저 확인(보드에 올리기), 숨기기
  function buildBoard() {
    C.bLock = lockSwitch('board', '새 글 받기'); P.board.act.appendChild(C.bLock);
    C.bList = el('ul', 'lp-con-list'); C.bList.setAttribute('aria-label', '보드 글 목록'); P.board.body.appendChild(C.bList);
    if (MODERATE) P.board.body.appendChild(el('p', 'lp-con-sub', '먼저 확인하기가 켜져 있어요. 새 글은 [보드에 올리기]를 눌러야 참가자에게 보여요.'));
  }
  function renderBoard() {
    C.bLock._sync();
    var posts = vals('posts').sort(function (a, b) { return (!!b.hidden - !!a.hidden) * (MODERATE ? 1 : 0) || (b.createdAt || 0) - (a.createdAt || 0); });
    var waiting = posts.filter(function (p) { return p.hidden; }).length;
    count('board', MODERATE && waiting ? '확인 기다림 ' + waiting : posts.length);
    keep(C.bList, function () {
      C.bList.textContent = '';
      if (!posts.length) { C.bList.appendChild(el('li', 'lp-con-empty', '아직 글이 없어요.')); return; }
      posts.forEach(function (p) {
        var li = el('li', 'lp-con-item is-nov' + (p.hidden ? ' is-off' : ''));
        var t = el('p', 'lp-con-t'); t.appendChild(el('span', 'lp-con-who', (p.nickname || '익명') + ' ')); t.appendChild(doc.createTextNode(p.text || (p.files && p.files.length ? '(파일 ' + p.files.length + '개)' : ''))); li.appendChild(t);
        var m = el('p', 'lp-con-m'); m.appendChild(el('span', '', ago(p.createdAt))); if (p.files && p.files.length) m.appendChild(el('span', '', '파일 ' + p.files.length + '개'));
        if (p.hidden) m.appendChild(el('em', '', MODERATE ? '확인 기다림' : '숨김')); if (U.hasLink && U.hasLink(p.text)) m.appendChild(el('em', '', '링크 있음'));
        li.appendChild(m);
        var a = el('div', 'lp-con-a');
        a.appendChild(btn(p.hidden ? (MODERATE ? '보드에 올리기' : '숨기기 취소') : '숨기기', p.hidden && MODERATE ? 'lp-btn-primary' : '', function () { conn.update('posts', p.id, { hidden: !p.hidden }).catch(err); }, 'ph' + p.id));
        li.appendChild(a); C.bList.appendChild(li);
      });
    });
  }

  // 도움 요청
  function renderHelp(open) {
    open.sort(function (a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });
    count('help', open.length);
    var hb = P.help.body;
    keep(hb, function () {
      hb.textContent = '';
      var ul = el('ul', 'lp-con-list'); ul.setAttribute('aria-label', '도움 요청 목록');
      if (!open.length) ul.appendChild(el('li', 'lp-con-empty', '지금은 도움 요청이 없어요.'));
      open.forEach(function (h) {
        var st = stations.filter(function (s) { return s.id === h.station; })[0];
        var li = el('li', 'lp-con-item is-nov' + (h.status === 'claimed' ? ' is-pinned' : ''));
        li.appendChild(el('p', 'lp-con-t lp-con-who', (h.nickname || '참가자') + (h.seat ? ' · ' + h.seat : '')));
        if (h.message) li.appendChild(el('p', 'lp-con-t', h.message));
        var m = el('p', 'lp-con-m'); m.appendChild(el('span', '', st ? st.name || st.title : '실습 칸 모름')); m.appendChild(el('span', '', ago(h.createdAt))); if (h.status === 'claimed') m.appendChild(el('b', '', (h.assignee || '강사') + ' 가는 중')); li.appendChild(m);
        var a = el('div', 'lp-con-a');
        if (h.status !== 'claimed') a.appendChild(btn('갈게요', '', function () { conn.update('help', h.id, { status: 'claimed', assignee: '강사' }).catch(err); }, 'go' + h.id));
        a.appendChild(btn('해결', 'lp-btn-primary', function () { conn.update('help', h.id, { status: 'done' }).catch(err); }, 'ok' + h.id));
        li.appendChild(a); ul.appendChild(li);
      });
      hb.appendChild(ul);
    });
  }

  // 진행(공지·타이머) · 참가자 화면(따라 넘기기·실습·교재 쪽·자료 링크)
  function runPart(title, id) { var s = el('div', 'lp-con-sec'); s.appendChild(el('h3', '', title)); P[id || 'run'].body.appendChild(s); return s; }
  function buildRun() {
    // ② 참여 받기: 모두 들어온 뒤 끄면 새 참가자(낯선 기기·도배)를 받지 않음. 이미 들어온 사람은 그대로
    C.joinLock = lockSwitch('join', '참여 받기'); P.run.act.appendChild(C.joinLock);
    var s1 = runPart('공지'); C.notice = el('div'); s1.appendChild(C.notice);
    var r1 = el('form', 'lp-con-row'); var nt = el('input', 'lp-in'); nt.placeholder = '예: 15:10까지 실습하고 앞을 봐 주세요'; nt.maxLength = 120; nt.setAttribute('aria-label', '공지 문구');
    var nb = el('button', 'lp-btn lp-btn-primary lp-btn-sm', '공지 보내기'); nb.type = 'submit';
    r1.appendChild(nt); r1.appendChild(nb); s1.appendChild(r1);
    // 긴 공지: 휴대폰 '지금' 줄에는 두 줄(40자쯤)까지 보이고 나머지는 [더 보기]로 펼침 → 칠 때만 한 줄 알림
    var nh = el('p', 'lp-con-sub', '휴대폰에서는 앞 40자쯤 보이고 나머지는 [더 보기]로 펼쳐요. 중요한 말을 앞에 두세요.'); nh.hidden = true; s1.appendChild(nh);
    nt.addEventListener('input', function () { nh.hidden = nt.value.trim().length <= 40; });
    r1.addEventListener('submit', function (e) { e.preventDefault(); var v = nt.value.trim(); if (!v) { nt.focus(); return; } setState({ notice: { text: v, level: 'info' } }, '공지를 보냈어요. 참가자·발표 화면 위에 보여요.').then(function () { nt.value = ''; nh.hidden = true; }); });

    var s2 = runPart('타이머'); C.clock = el('div', 'lp-con-clock'); s2.appendChild(C.clock);
    var r2 = el('div', 'lp-con-row');
    [1, 3, 5, 10, 15].forEach(function (m) { r2.appendChild(btn(m + '분', '', function () { startTimer(m); }, 't' + m)); });
    s2.appendChild(r2);
    // 실습 단계에 적힌 시간(data-minutes): 단계 이름을 붙인 타이머 단추
    var timed = stations.filter(function (st) { return st.minutes > 0; });
    if (timed.length) {
      var r2s = el('div', 'lp-con-row lp-con-presets'); r2s.setAttribute('role', 'group'); r2s.setAttribute('aria-label', '실습 시간');
      timed.forEach(function (st) {
        // 짧은 이름: '실습 1: …'·'1단계: …'는 앞부분만
        var t0 = st.title || st.name || '', sh = /[:：]/.test(t0) ? t0.split(/[:：]/)[0].trim() : (st.name || t0); sh = sh.slice(0, 16);
        var b0 = btn(sh + ' · ' + st.minutes + '분', '', function () { startTimer(st.minutes, sh); }, 'ts' + st.id); b0.title = t0; r2s.appendChild(b0);
      });
      s2.appendChild(el('p', 'lp-con-sub', '실습 시간'));
      s2.appendChild(r2s);
    }
    var r2b = el('form', 'lp-con-row'); var tm = el('input', 'lp-in'); tm.type = 'number'; tm.min = 1; tm.max = 180; tm.placeholder = '분'; tm.style.flex = '0 1 6em'; tm.setAttribute('aria-label', '타이머 분');
    var tl = el('input', 'lp-in'); tl.maxLength = 40; tl.placeholder = '이름(선택, 예: 모둠 토의)'; tl.setAttribute('aria-label', '타이머 이름');
    var tg = el('button', 'lp-btn lp-btn-sm', '시작'); tg.type = 'submit';
    r2b.appendChild(tm); r2b.appendChild(tl); r2b.appendChild(tg); s2.appendChild(r2b);
    r2b.addEventListener('submit', function (e) { e.preventDefault(); var m = Math.round(+tm.value); if (!(m >= 1 && m <= 180)) { toast('1~180분 사이로 넣어 주세요.'); tm.focus(); return; } startTimer(m, tl.value.trim()); tm.value = ''; tl.value = ''; });
    function startTimer(m, label) { setState({ timer: { endsAt: now() + m * 60000, label: label || '', running: true } }, m + '분 타이머를 시작했어요.'); }
    s2.appendChild(el('p', 'lp-con-sub', '타이머 여러 개·이름 뽑기·모둠 만들기는 발표 화면의 [도구]에 있어요.'));
    clearInterval(C.tick); C.tick = setInterval(drawClock, 1000);
  }
  function buildLead() {
    var s3 = runPart('이끌기', 'lead');
    C.follow = el('button', 'lp-switch'); C.follow.type = 'button'; C.follow.setAttribute('role', 'switch'); C.follow.setAttribute('data-k', 'follow');
    C.follow.appendChild(el('i')); C.follow.appendChild(el('span', '', '강사 따라 넘기기')); C.followS = el('small'); C.follow.appendChild(C.followS);
    C.follow.addEventListener('click', toggleFollow);
    s3.appendChild(C.follow);
    if (stations.length) {
      var r3 = el('div', 'lp-con-row'); var sel = el('select', 'lp-in'); sel.setAttribute('aria-label', '지금 실습');
      var o0 = el('option', '', '지금 실습 고르기'); o0.value = ''; sel.appendChild(o0);
      stations.forEach(function (s, i) { var o = el('option', '', (i + 1) + '. ' + (s.name || s.title)); o.value = s.id; sel.appendChild(o); });
      sel.addEventListener('change', function () { setState({ step: sel.value }); }); r3.appendChild(sel);
      r3.appendChild(btn('다음 실습', '', function () { var i = stations.findIndex(function (s) { return s.id === state.step; }); var n = stations[Math.min(stations.length - 1, i + 1)]; if (n) setState({ step: n.id }); }));
      s3.appendChild(r3); C.step = sel;
    }
    // 자료 링크: 연수 중에 덧붙이면 참가자 화면의 자료실에 바로 보임(파일은 드라이브 등에 올린 공유 주소로)
    var s4 = runPart('자료 링크', 'lead');
    var r5 = el('form', 'lp-con-row'); var mt = el('input', 'lp-in'); mt.placeholder = '자료 이름'; mt.maxLength = 40; mt.setAttribute('aria-label', '자료 이름');
    var mu = el('input', 'lp-in'); mu.type = 'url'; mu.placeholder = 'https://'; mu.setAttribute('aria-label', '자료 주소(https)'); mu.style.flex = '2 1 12em';
    var mb = el('button', 'lp-btn lp-btn-sm', '자료 추가'); mb.type = 'submit';
    r5.appendChild(mt); r5.appendChild(mu); r5.appendChild(mb); s4.appendChild(r5);
    r5.addEventListener('submit', function (e) {
      e.preventDefault(); var patch = X.materialAdd(state, mu.value, mt.value);
      if (patch.error) { toast(patch.error); mu.focus(); return; }
      setState(patch, '자료를 추가했어요. 참가자 화면의 자료실에 보여요.'); mt.value = ''; mu.value = '';
    });
    C.mats = el('ul', 'lp-con-mats'); s4.appendChild(C.mats);
  }
  function drawClock() {
    if (!C.clock) return;
    var t = state.timer, run = t && t.running && t.endsAt;
    if (!run) { if (C.clock.getAttribute('data-on') !== '0') { C.clock.setAttribute('data-on', '0'); C.clock.textContent = ''; C.clock.appendChild(el('p', 'lp-con-sub', '돌아가는 타이머가 없어요.')); } return; }
    var left = t.endsAt - now();
    if (C.clock.getAttribute('data-on') !== '1') {
      C.clock.setAttribute('data-on', '1'); C.clock.textContent = '';
      C.clockB = el('b'); C.clockL = el('span', 'lp-con-sub'); C.clock.appendChild(C.clockB); C.clock.appendChild(C.clockL);
      C.clockX = btn('멈춤', '', function () { var over = !!(state.timer && state.timer.endsAt <= now()); setState({ timer: null }, over ? '타이머를 지웠어요.' : '타이머를 멈췄어요.'); }, 'tstop');
      C.clock.appendChild(C.clockX);
    }
    // 끝난 뒤: 참가자 화면은 '끝났어요'를 잠깐 보인 뒤 지우고, 발표 화면은 0:00을 그대로 둠 → 여기서는 [삭제]
    C.clockB.textContent = left <= 0 ? '0:00' : mmss(left); C.clockL.textContent = (t.label ? t.label + ' · ' : '') + (left <= 0 ? '시간이 다 됐어요 · 참가자 화면에서는 곧 사라져요' : '남은 시간');
    C.clockX.textContent = left <= 0 ? '삭제' : '멈춤';
    if (left <= 0) C.clock.setAttribute('data-over', ''); else C.clock.removeAttribute('data-over');
  }
  function syncRun() {
    if (!C.notice) return;
    if (C.joinLock) C.joinLock._sync();
    keep(C.notice, function () {
      C.notice.textContent = '';
      if (state.notice && state.notice.text) { var n = el('div', 'lp-con-now'); n.appendChild(el('p', '', state.notice.text)); n.appendChild(btn('공지 내리기', '', function () { setState({ notice: null }, '공지를 내렸어요.'); }, 'nclear')); C.notice.appendChild(n); }
      else C.notice.appendChild(el('p', 'lp-con-sub', '보낸 공지가 없어요.'));
    });
    drawClock();
    [C.follow, C.follow2].forEach(function (f) { if (!f) return; f.setAttribute('aria-checked', String(!!state.follow)); f.lastChild.textContent = state.follow ? '켜짐' : '꺼짐'; });
    if (C.step && doc.activeElement !== C.step) C.step.value = state.step || '';

    keep(C.mats, function () {
      C.mats.textContent = '';
      X.materials(state).forEach(function (m) {
        var li = el('li'); var a = el('a', '', m.title); a.href = m.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; li.appendChild(a);
        li.appendChild(btn('삭제', '', function () { setState(X.materialRemove(m.slot), '자료를 지웠어요.'); }, 'mat' + m.slot));
        C.mats.appendChild(li);
      });
    });
  }

  // ── 발표: 교재 쪽 미리 보기·넘기기(참가자·발표 화면이 같은 쪽), 발표 화면에 겹쳐 띄우기 ──
  function toggleFollow() { var on = !state.follow; setState({ follow: on, ui: { followOff: on ? null : true } }, on ? '참가자 화면이 강사가 고른 실습·쪽으로 움직여요.' : '참가자가 자유롭게 넘겨요.'); }
  function near(n) { return PAGES.reduce(function (b, p) { return Math.abs(p - n) < Math.abs(b - n) ? p : b; }, PAGES[0]); }
  /** 지금 쪽(0: 아직 넘기기 전 — 발표 화면은 참여 안내) */
  function curPage() { return PAGES.length && state.slide > 0 ? near(state.slide) : 0; }
  /** 쪽 보내기: 바로 그리고(리모컨을 빠르게 눌러도 한 쪽씩) 서버에 알림 */
  function goPage(p, say) {
    if (!PAGES.length) return;
    p = near(p); if (p === state.slide) return;
    state.slide = p; queue();
    // 교재로 돌아오기: 투표·질문·큰 타이머 등을 띄워 두었으면 내림(QR 크게는 그대로)
    var ui = (state.ui || {}).ov ? { ov: null } : null;
    conn.setState(Object.assign({ slide: p }, ui ? { ui: ui } : {})).then(function (st) { if (st) { state = st; queue(); } if (say) toast(say); }, err);
  }
  function stepPage(d) { var c0 = curPage(); if (!c0) { if (d > 0) goPage(PAGES[0]); return; } var i = PAGES.indexOf(c0); goPage(PAGES[Math.max(0, Math.min(PAGES.length - 1, i + d))]); }
  var OVS = [['', '교재'], ['join', '참여 QR'], ['poll', '투표'], ['qa', '질문'], ['timer', '타이머'], ['notice', '공지'], ['blank', '화면 숨기기']];
  function ovNow() { return qrBig() ? 'join' : (state.ui || {}).ov || ''; }
  /** 발표 화면에 겹쳐 띄우기: 같은 것을 다시 누르면 내림. 참여 QR은 예전 'QR 크게'(ui.qrBig)와 같은 값 */
  function setOv(v) {
    if (v && v === ovNow()) v = '';
    var said = { '': DECK.length ? '발표 화면을 교재로 돌렸어요.' : '발표 화면에 참여 안내를 띄웠어요.', join: '발표 화면에 참여 QR을 크게 띄웠어요.', poll: '발표 화면에 투표를 띄웠어요.', qa: '발표 화면에 질문을 띄웠어요.', timer: '발표 화면에 타이머를 크게 띄웠어요.', notice: '발표 화면에 공지를 크게 띄웠어요.', blank: '발표 화면을 가렸어요.' }[v];
    setState({ ui: { ov: v && v !== 'join' ? v : null, qrBig: v === 'join' ? true : null, q: v === 'qa' ? (state.ui || {}).q || null : null } }, said);
  }
  function thumb(n, cls) {
    var d = deckAt(n), f = el('figure', 'lp-con-thumb ' + cls);
    if (!d) { f.appendChild(el('span', 'lp-con-sub', '끝')); return f; }
    var im = el('img'); im.src = d[1]; im.alt = n + '쪽' + (d[2] ? ': ' + d[2] : ''); im.decoding = 'async'; im.loading = cls === 'is-next' ? 'lazy' : 'eager'; f.appendChild(im);
    f.appendChild(el('figcaption', '', n + '쪽' + (d[2] ? ' · ' + d[2] : ''))); return f;
  }
  function buildPres() {
    var b = P.pres.body;
    if (PAGES.length) {
      C.presView = el('div', 'lp-con-deck'); b.appendChild(C.presView);
      var r = el('div', 'lp-con-row lp-con-pager');
      r.appendChild(btn('앞 쪽', '', function () { stepPage(-1); }, 'pprev'));
      C.pageNo = el('span', 'lp-con-pageno'); C.pageNo.setAttribute('aria-live', 'polite'); r.appendChild(C.pageNo);
      r.appendChild(btn('다음 쪽', 'lp-btn-primary', function () { stepPage(1); }, 'pnext'));
      var f = el('form', 'lp-con-row lp-con-goto'); var inp = el('input', 'lp-in'); inp.type = 'number'; inp.min = PAGES[0]; inp.max = PAGES[PAGES.length - 1]; inp.placeholder = '쪽'; inp.setAttribute('aria-label', '갈 쪽(' + PAGES[0] + '~' + PAGES[PAGES.length - 1] + ')');
      var go = el('button', 'lp-btn lp-btn-sm', '가기'); go.type = 'submit'; f.appendChild(inp); f.appendChild(go);
      f.addEventListener('submit', function (e) { e.preventDefault(); var n = Math.round(+inp.value); if (!n) { inp.focus(); return; } var p = near(n); goPage(p, p === n ? '' : '교재에 ' + n + '쪽이 없어 가장 가까운 ' + p + '쪽으로 갔어요.'); inp.value = ''; });
      r.appendChild(f); b.appendChild(r);
      if ((BP.pages || []).length) {
        C.follow2 = el('button', 'lp-switch'); C.follow2.type = 'button'; C.follow2.setAttribute('role', 'switch'); C.follow2.setAttribute('data-k', 'follow2');
        C.follow2.appendChild(el('i')); C.follow2.appendChild(el('span', '', '참가자 교재도 같은 쪽으로')); C.follow2.appendChild(el('small'));
        C.follow2.addEventListener('click', toggleFollow); P.pres.act.appendChild(C.follow2);
      }
      C.pageHere = el('div', 'lp-con-here'); b.appendChild(C.pageHere);
    }
    var s = el('div', 'lp-con-sec'); s.appendChild(el('h3', '', '발표 화면에 띄우기'));
    C.ovRow = el('div', 'lp-seg lp-con-ovs'); C.ovRow.setAttribute('role', 'group'); C.ovRow.setAttribute('aria-label', '발표 화면에 띄우기');
    C.ovBtn = {};
    OVS.forEach(function (x) {
      if (x[0] === 'qa' && !ON.qa) return;
      var bt = el('button', '', x[0] === '' && !DECK.length ? '참여 안내' : x[1]); bt.type = 'button'; bt.setAttribute('data-k', 'ov-' + (x[0] || 'none'));
      bt.addEventListener('click', function () { setOv(x[0]); }); C.ovBtn[x[0]] = bt; C.ovRow.appendChild(bt);
    });
    s.appendChild(C.ovRow);
    s.appendChild(el('p', 'lp-con-sub', PAGES.length ? '리모컨이나 PageDown·PageUp으로도 넘겨요(입력 칸 밖에서). 발표 화면에서 넘겨도 여기와 참가자 화면이 함께 바뀌어요.' : '발표 화면에서는 키 하나로도 띄워요: J 참여 QR · V 투표 · Q 질문 · T 타이머 · N 공지 · B 화면 숨기기.'));
    b.appendChild(s);
  }
  function renderPres() {
    if (!P.pres) return;
    var ov = ovNow();
    Object.keys(C.ovBtn).forEach(function (k) { C.ovBtn[k].setAttribute('aria-pressed', String(k === ov)); });
    if (!C.presView) return;
    var cur = curPage(), i = PAGES.indexOf(cur), nx = PAGES[i + 1];
    if (C.presView._p !== cur) {
      C.presView._p = cur; C.presView.textContent = '';
      if (!cur) { var w0 = el('div', 'lp-con-thumb is-now lp-con-before'); w0.appendChild(el('p', '', '시작 전이에요. 발표 화면에는 참여 안내(큰 QR)가 떠 있어요.')); w0.appendChild(el('p', 'lp-con-sub', '[다음 쪽]이나 리모컨을 누르면 ' + PAGES[0] + '쪽부터 띄워요.')); C.presView.appendChild(w0); if (DECK.length) C.presView.appendChild(thumb(PAGES[0], 'is-next')); }
      else if (DECK.length) { C.presView.appendChild(thumb(cur, 'is-now')); C.presView.appendChild(thumb(nx, 'is-next')); }
      else C.presView.appendChild(el('p', 'lp-con-sub', '참가자 교재 ' + cur + '쪽'));
    }
    C.pageNo.textContent = cur ? cur + ' / ' + PAGES[PAGES.length - 1] + '쪽' : '시작 전';
    // 이 쪽에 묶인 투표·퀴즈: 바로 열기
    keep(C.pageHere, function () {
      C.pageHere.textContent = '';
      var here = polls.filter(function (p) { return p.page === cur; });
      if (!here.length) return;
      here.forEach(function (p) {
        var open = p.id === state.openPoll, row = el('div', 'lp-con-now-poll');
        row.appendChild(el('p', '', (isQuiz(p) ? '이 쪽의 퀴즈 · ' : '이 쪽의 투표 · ') + p.question));
        row.appendChild(btn(open ? '열려 있어요' : '바로 열기', open ? '' : 'lp-btn-primary', function () { if (!open) togglePoll(p, false); }, 'here' + p.id));
        C.pageHere.appendChild(row);
      });
    });
  }
  // 리모컨(발표용 클리커): PageDown·PageUp(와 →·←)을 보냄. 입력 칸·대화상자 밖에서만. B·마침표는 화면 가리기, F5는 발표 화면 띄우기
  doc.addEventListener('keydown', function (e) {
    if (!conn || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    var t = e.target, tag = t && t.tagName || '';
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag) || (t && t.isContentEditable) || doc.querySelector('dialog[open]')) return;
    var k = e.key, onCtl = /^(BUTTON|A|SUMMARY)$/.test(tag) || (t && t.getAttribute && t.getAttribute('role') === 'switch');
    if (PAGES.length && (k === 'PageDown' || (!onCtl && (k === 'ArrowRight' || k === ' ')))) { e.preventDefault(); stepPage(1); return; }
    if (PAGES.length && (k === 'PageUp' || (!onCtl && k === 'ArrowLeft'))) { e.preventDefault(); stepPage(-1); return; }
    if (!onCtl && (k === 'b' || k === 'B' || k === '.')) { e.preventDefault(); setOv('blank'); return; }
    if (k === 'F5') { e.preventDefault(); openScreen(false); }
  });

  // ── 출석 명단: 이름·소속·입실·퇴실(실시간). 휴대폰 없는 사람은 손으로 더하고, 빠뜨린 퇴실·잘못 누른 시각은 고침 ──
  function fmtAt(ms) {
    if (!ms) return '';
    var d = new Date(ms), now = new Date(), hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    return d.toDateString() === now.toDateString() ? hm : (d.getMonth() + 1) + '/' + d.getDate() + ' ' + hm;
  }
  function hmOf(ms) { if (!ms) return ''; var d = new Date(ms); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  /** 'HH:MM' → 그날(기준 시각이 있으면 그날, 없으면 오늘) 그 시각의 ms */
  function atOf(hm, base) { var m = /^(\\d{1,2}):(\\d{2})$/.exec(hm || ''); if (!m) return 0; var d = base ? new Date(base) : new Date(); d.setHours(+m[1], +m[2], 0, 0); return d.getTime(); }
  function roster() {
    var m = {};
    vals('attendance').forEach(function (a) { var r = m[a.by] || (m[a.by] = {}); r[a.kind === 'out' ? 'out' : 'in'] = a; });
    return vals('participants').filter(function (p) { return p.name || m[p.id]; }).map(function (p) { var r = m[p.id] || {}; return { p: p, i: r['in'], o: r.out }; })
      .sort(function (a, b) { var x = a.p.name || a.p.nickname || '', y = b.p.name || b.p.nickname || ''; return x.localeCompare(y, 'ko'); });
  }
  function rosterCount() { var c = { in: 0, out: 0, manual: 0 }; roster().forEach(function (r) { if (r.i) c.in++; if (r.o) c.out++; if (r.p.manual) c.manual++; }); return c; }
  var attFind = '', attEdit = '';
  function buildAtt() {
    var b = P.att.body;
    C.attSum = el('p', 'lp-con-sub'); b.appendChild(C.attSum);
    var fl = el('label', 'lp-con-row'); var fi = el('input', 'lp-in'); fi.type = 'search'; fi.placeholder = '이름·소속으로 찾기'; fi.setAttribute('aria-label', '명단에서 찾기');
    fi.addEventListener('input', function () { attFind = fi.value.trim(); renderAtt(); }); fl.appendChild(fi); b.appendChild(fl);
    C.attBox = el('div', 'lp-con-roster'); b.appendChild(C.attBox);
    if (!ROSTER_EDIT) { b.appendChild(el('p', 'lp-con-sub', '이 연결 방식에서는 명단을 여기서 고칠 수 없어요. [기록·정리]에서 출석 CSV를 받아 고쳐 주세요.')); return; }
    var d = el('details', 'lp-con-quick'); var sm = el('summary'); sm.innerHTML = '<svg class="lp-ic" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>'; sm.appendChild(el('span', '', '휴대폰 없는 분 추가')); d.appendChild(sm);
    var f = el('form'); f.setAttribute('aria-label', '명단에 추가');
    var nm = el('input', 'lp-in'); nm.maxLength = 40; nm.required = true; nm.placeholder = '이름'; nm.setAttribute('aria-label', '이름'); nm.autocomplete = 'off';
    var sc = el('input', 'lp-in'); sc.maxLength = 60; sc.placeholder = '소속(선택)'; sc.setAttribute('aria-label', '소속'); sc.autocomplete = 'off';
    var r1 = el('div', 'lp-con-row'); r1.appendChild(nm); r1.appendChild(sc); f.appendChild(r1);
    var cl = el('label', 'lp-con-check'); var cb = el('input'); cb.type = 'checkbox'; cb.required = true; cl.appendChild(cb); cl.appendChild(el('span', '', '본인에게 출석 확인에 쓴다고 알리고 동의를 받았어요')); f.appendChild(cl);
    var go = el('button', 'lp-btn lp-btn-primary lp-btn-sm', '추가하고 입실로 적기'); go.type = 'submit'; var r2 = el('div', 'lp-con-row'); r2.appendChild(go); f.appendChild(r2);
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = nm.value.trim(); if (!name) { nm.focus(); return; }
      if (!cb.checked) { toast('동의를 받았는지 확인해 주세요.'); cb.focus(); return; }
      go.disabled = true;
      conn.add('participants', { name: name, school: sc.value.trim(), consent: true }).then(function (pd) {
        if (!pd || !pd.id) throw new Error('명단에 추가하지 못했어요.');
        data.participants[pd.id] = pd;
        return conn.add('attendance', { by: pd.id, kind: 'in' }).then(function (ad) { if (ad && ad.id) data.attendance[ad.id] = ad; });
      }).then(function () { nm.value = ''; sc.value = ''; cb.checked = false; queue(); toast(name + ' 님을 명단에 추가하고 입실로 적었어요.'); nm.focus(); }, err).then(function () { go.disabled = false; });
    });
    d.appendChild(f); b.appendChild(d);
  }
  function setAt(r, kind, ms) {
    var doc0 = kind === 'in' ? r.i : r.o;
    if (!ms) return doc0 ? conn.remove('attendance', doc0.id).then(function () { delete data.attendance[doc0.id]; }) : Promise.resolve();
    if (doc0 && Math.abs((doc0.at || 0) - ms) < 60000) return Promise.resolve();
    return conn.add('attendance', { by: r.p.id, kind: kind, at: ms }).then(function (ad) { if (ad && ad.id) data.attendance[ad.id] = ad; });
  }
  function renderAtt() {
    if (!C.attBox) return;
    var all = roster(), c = rosterCount();
    C.attSum.textContent = '명단 ' + all.length + '명 · 입실 ' + c.in + ' · 퇴실 ' + c.out + (c.in > c.out && c.out ? ' · 퇴실 전 ' + (c.in - c.out) : '') + '. 참가자가 [입실 확인]·[퇴실 확인]을 누르면 바로 생겨요.';
    // 고치는 칸에 적는 중이면 다시 그리지 않음(다른 사람이 입실해도 적던 글이 지워지지 않게)
    var a0 = doc.activeElement; if (attEdit && a0 && C.attBox.contains(a0) && a0.closest('.lp-con-edit')) return;
    var q = attFind.toLowerCase();
    var list = q ? all.filter(function (r) { return ((r.p.name || '') + ' ' + (r.p.school || '') + ' ' + (r.p.nickname || '')).toLowerCase().indexOf(q) >= 0; }) : all;
    keep(C.attBox, function () {
      C.attBox.textContent = '';
      if (!list.length) { C.attBox.appendChild(el('p', 'lp-con-empty', all.length ? '찾는 이름이 없어요.' : '아직 입실한 사람이 없어요.')); return; }
      var tb = el('table', 'lp-con-tbl'), th = el('thead'), hr = el('tr');
      ['이름', '소속', '입실', '퇴실', ''].forEach(function (x, k) { var c0 = el('th', '', x); c0.scope = 'col'; if (k === 4) c0.appendChild(el('span', 'lp-sr', '고치기')); hr.appendChild(c0); });
      th.appendChild(hr); tb.appendChild(th);
      var bd = el('tbody'); tb.appendChild(bd);
      list.forEach(function (r) {
        var p = r.p, tr = el('tr'), nmC = el('th', '', p.name || p.nickname || '이름 없음'); nmC.scope = 'row';
        if (p.manual) nmC.appendChild(el('small', '', '직접'));
        tr.appendChild(nmC); tr.appendChild(el('td', '', p.school || ''));
        var ti = el('td', 'lp-con-at', r.i ? fmtAt(r.i.at || r.i.createdAt) : '–'), to = el('td', 'lp-con-at', r.o ? fmtAt(r.o.at || r.o.createdAt) : '–');
        if (r.i && r.i.byHost) ti.title = '강사가 적은 시각'; if (r.o && r.o.byHost) to.title = '강사가 적은 시각';
        tr.appendChild(ti); tr.appendChild(to);
        var ac = el('td', 'lp-con-a');
        if (ROSTER_EDIT) {
          if (!r.i) ac.appendChild(btn('입실', '', function () { setAt(r, 'in', now()).then(function () { queue(); toast((p.name || p.nickname) + ' 님 입실을 적었어요.'); }, err); }, 'ain' + p.id));
          else if (!r.o) ac.appendChild(btn('퇴실', '', function () { setAt(r, 'out', now()).then(function () { queue(); toast((p.name || p.nickname) + ' 님 퇴실을 적었어요.'); }, err); }, 'aout' + p.id));
          ac.appendChild(btn(attEdit === p.id ? '닫기' : '고치기', '', function () { attEdit = attEdit === p.id ? '' : p.id; renderAtt(); }, 'aed' + p.id));
        }
        tr.appendChild(ac); bd.appendChild(tr);
        if (attEdit === p.id && ROSTER_EDIT) bd.appendChild(editRow(r));
      });
      var w = el('div', 'lp-con-tbl-w'); w.appendChild(tb); C.attBox.appendChild(w);
    });
  }
  function editRow(r) {
    var p = r.p, tr = el('tr', 'lp-con-edit'), td = el('td'); td.colSpan = 5;
    var f = el('form', 'lp-con-editf'); f.setAttribute('aria-label', (p.name || p.nickname) + ' 고치기');
    var fld = function (label, input) { var l = el('label'); l.appendChild(el('span', '', label)); l.appendChild(input); f.appendChild(l); return input; };
    var nm = null, sc = null;
    // 이름·소속은 동의를 받은 사람만(동의 없이 이름을 새로 남기지 않게)
    if (p.consentAt) { nm = fld('이름', el('input', 'lp-in')); nm.value = p.name || ''; nm.maxLength = 40; sc = fld('소속', el('input', 'lp-in')); sc.value = p.school || ''; sc.maxLength = 60; }
    var ti = fld('입실', el('input', 'lp-in')); ti.type = 'time'; ti.value = r.i ? hmOf(r.i.at || r.i.createdAt) : '';
    var to = fld('퇴실', el('input', 'lp-in')); to.type = 'time'; to.value = r.o ? hmOf(r.o.at || r.o.createdAt) : '';
    var row = el('div', 'lp-con-row'), sv = el('button', 'lp-btn lp-btn-primary lp-btn-sm', '저장'); sv.type = 'submit'; row.appendChild(sv);
    row.appendChild(btn('명단에서 빼기', 'lp-btn-danger', function () {
      if (!window.confirm((p.name || p.nickname) + ' 님을 명단에서 뺄까요? 입실·퇴실 기록도 함께 지워져요.')) return;
      var jobs = [r.i, r.o].filter(Boolean).map(function (a) { return conn.remove('attendance', a.id).then(function () { delete data.attendance[a.id]; }); });
      if (p.manual) jobs.push(conn.remove('participants', p.id).then(function () { delete data.participants[p.id]; }));
      Promise.all(jobs).then(function () { attEdit = ''; queue(); toast('명단에서 뺐어요.'); }, err);
    }, 'adel' + p.id));
    f.appendChild(row);
    f.appendChild(el('p', 'lp-con-sub', '시각을 지우면 그 기록을 지워요. 고친 시각은 CSV의 \\'강사 입력\\' 칸에 표시돼요.'));
    f.addEventListener('submit', function (e) {
      e.preventDefault(); sv.disabled = true;
      var base = (r.i && (r.i.at || r.i.createdAt)) || (r.o && (r.o.at || r.o.createdAt)) || now();
      var inAt = atOf(ti.value, base), outAt = atOf(to.value, base);
      if (inAt && outAt && outAt < inAt) { sv.disabled = false; toast('퇴실 시각이 입실보다 빨라요.'); to.focus(); return; }
      var jobs = [];
      if (nm && (nm.value.trim() !== (p.name || '') || sc.value.trim() !== (p.school || ''))) {
        if (!nm.value.trim()) { sv.disabled = false; toast('이름을 적어 주세요.'); nm.focus(); return; }
        jobs.push(conn.update('participants', p.id, { name: nm.value.trim(), school: sc.value.trim() }).then(function (d) { if (d && d.id) data.participants[d.id] = Object.assign(data.participants[d.id] || {}, d); }));
      }
      jobs.push(setAt(r, 'in', inAt)); jobs.push(setAt(r, 'out', outAt));
      Promise.all(jobs).then(function () { attEdit = ''; queue(); toast('고쳤어요.'); }, err).then(function () { sv.disabled = false; });
    });
    td.appendChild(f); tr.appendChild(td); return tr;
  }

  // 이해 신호
  function signalCounts() {
    var reset = X.signalReset(state), latest = {};
    vals('answers').forEach(function (a) {
      if (a.poll !== 'signal') return; var t = a.updatedAt || a.createdAt || 0;
      if (t < reset) return;
      var who = a.by || a.id; // one signal doc per participant: the id works when \`by\` is not shown
      if (!latest[who] || t >= (latest[who].updatedAt || latest[who].createdAt || 0)) latest[who] = a;
    });
    var c = { green: 0, yellow: 0, red: 0, total: 0 };
    Object.keys(latest).forEach(function (k) { var v = latest[k].value; if (c[v] !== undefined) { c[v]++; c.total++; } });
    return c;
  }
  var SIG = [['green', 'g', '✓', '이해했어요'], ['yellow', 'y', '?', '조금 헷갈려요'], ['red', 'r', '!', '모르겠어요']];
  var sigAlert = false;
  function renderSignal(c) {
    var sg = P.signal.body; count('signal', c.total || null);
    keep(sg, function () {
      sg.textContent = '';
      if (!c.total) sg.appendChild(el('p', 'lp-con-sub', '참가자가 신호를 보내면 여기에 모여요.'));
      else {
        var bar = el('div', 'lp-sig'); bar.setAttribute('aria-hidden', 'true');
        SIG.forEach(function (x) { var i = el('i', x[1]); i.style.width = (c[x[0]] / c.total * 100) + '%'; bar.appendChild(i); });
        var lg = el('ul', 'lp-sig-l'); SIG.forEach(function (x) { var li = el('li'); var i = el('i', x[1], x[2]); i.setAttribute('aria-hidden', 'true'); li.appendChild(i); li.appendChild(doc.createTextNode(x[3] + ' ')); li.appendChild(el('b', '', c[x[0]] + '명')); lg.appendChild(li); });
        sg.appendChild(bar); sg.appendChild(lg);
        var red = c.red / c.total;
        if (red >= 0.25 && !sigAlert) { sigAlert = true; toast('모르겠어요 신호가 ' + Math.round(red * 100) + '%예요. 잠시 멈추고 확인해 보세요.'); }
        if (red < 0.2) sigAlert = false;
      }
      var r = X.signalReset(state), row = el('div', 'lp-con-row');
      row.appendChild(btn('신호 비우기', '', function () { setState({ ui: { signalReset: now() } }, '신호를 비웠어요. 참가자 화면의 선택도 지워져요.'); }, 'sreset'));
      if (r) row.appendChild(el('span', 'lp-con-sub', '마지막으로 비운 때 ' + new Date(r).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })));
      sg.appendChild(row);
    });
  }
  // 실습 진행 현황: 참가자·실습 칸마다 마지막 기록
  function latestProgress() {
    var latest = {}; vals('progress').forEach(function (p) { var k = (p.by || p.id) + '|' + p.station; if (!latest[k] || (p.at || p.createdAt) >= (latest[k].at || latest[k].createdAt)) latest[k] = p; });
    return Object.keys(latest).map(function (k) { return latest[k]; });
  }
  function renderHeat(parts) {
    var prog = latestProgress();
    var hb = P.heat.body; hb.textContent = '';
    var total = Math.max(parts.length, 1), ul = el('ul', 'lp-heat');
    stations.forEach(function (s) {
      var c = { done: 0, doing: 0, stuck: 0 }; prog.forEach(function (p) { if (p.station === s.id && c[p.status] !== undefined) c[p.status]++; });
      var li = el('li'); li.appendChild(el('span', '', s.name || s.title));
      var bar = el('div', 'lp-heat-bar'); bar.setAttribute('aria-hidden', 'true'); ['done', 'doing', 'stuck'].forEach(function (t) { var i = el('i', t); i.style.width = (c[t] / total * 100) + '%'; bar.appendChild(i); });
      li.appendChild(bar); li.appendChild(el('small', '', '완료 ' + c.done + ' · 하는 중 ' + c.doing + (c.stuck ? ' · 막힘 ' + c.stuck : ''))); ul.appendChild(li);
    });
    hb.appendChild(ul);
    hb.appendChild(el('p', 'lp-con-sub', '초록 완료 · 강조색 하는 중 · 빨강 막힘. 참가자 ' + parts.length + '명 기준이에요.'));
  }

  // 기록·정리: CSV(칸마다 수식 막기를 한 번 더), 모든 데이터 삭제(확인 창), 참여 QR
  var KINDS = [
    ['participants', '참가자', true], ['attendance', '출석', true], ['completion', '이수자 명단', true], ['progress', '실습 진행', ON.progress],
    ['questions', '질문', ON.qa], ['posts', '보드 글', ON.board], ['help', '도움 요청', ON.help], ['answers', '투표·신호 응답', true], ['survey', '설문 응답', ON.survey],
  ];
  /** 투표 응답 CSV의 첫 열(투표 id)을 질문 글로 바꿈: 즉석 투표 id는 알아보기 어려움 */
  function pollNames(csv) {
    var names = { signal: '신호등' }; allPolls().forEach(function (p) { names[p.id] = p.question; });
    return String(csv || '').split('\\n').map(function (line, i) {
      var c = line.indexOf(','); if (!i || c < 1) return line;
      var n = names[line.slice(0, c)]; if (!n) return line;
      return '"' + n.replace(/"/g, '""') + '"' + line.slice(c);
    }).join('\\n');
  }
  /** 이수 기준(출석 %)을 교재·강사가 정했는지(siteData admin.rateSet) */
  function rateOn() { var a = DATA.admin || {}; return a.rateSet !== false && a.completionRate > 0; }
  /** 기준이 없을 때 이수자 명단의 '이수' 칸(O·X·확인 필요)을 비움: 도구가 정한 비율로 판정하지 않게 */
  function noVerdict(csv) {
    return String(csv || '').split('\\n').map(function (line, i) { return i ? line.replace(/,(?:O|X|확인 필요)(\\r?)$/, ',$1') : line.replace(/,이수(\\r?)$/, ',이수(기준 없음)$1'); }).join('\\n');
  }
  function completionOpts() { return { date: DATA.date || '', start: DATA.start || '', end: DATA.end || '', rate: (DATA.admin || {}).completionRate, survey: (DATA.survey || 0) > 0, stations: stations.length }; }
  function buildData() {
    var b = P.data.body;
    var s1 = el('div', 'lp-con-sec'); s1.style.borderTop = '0'; s1.style.paddingTop = '0'; s1.appendChild(el('h3', '', 'CSV 다운로드'));
    var g = el('div', 'lp-con-dl');
    KINDS.filter(function (k) { return k[2]; }).forEach(function (x) {
      g.appendChild(btn(x[1], '', function () {
        conn.exportCsv(x[0], x[0] === 'completion' ? completionOpts() : undefined).then(function (csv) {
          if (x[0] === 'answers') csv = pollNames(csv);
          if (x[0] === 'completion' && !rateOn()) csv = noVerdict(csv);
          save((DATA.title || 'lecpage').replace(/[\\\\/:*?"<>|]/g, '').slice(0, 60) + '_' + x[1].replace(/[·\\s]/g, '') + '.csv', U.csvGuard ? U.csvGuard(csv || '') : csv || '');
          toast(x[1] + ' 기록을 내려받았어요.');
        }, err);
      }, 'dl' + x[0]));
    });
    s1.appendChild(g);
    // 이수 기준(출석 비율)은 교재·강사가 정한 값(lecpage.json admin.completionRate)만. 없으면 규칙을 지어 쓰지 않고 '이수' 칸을 비움
    s1.appendChild(el('p', 'lp-con-sub', rateOn() ? '이수자 명단: 연수 시간(' + (DATA.start || '?') + '~' + (DATA.end || '?') + ')의 ' + DATA.admin.completionRate + '% 이상 머물렀고' + ((DATA.survey || 0) > 0 ? ' 설문을 낸' : '') + ' 사람을 O로 적어요. 입실·퇴실 기록이 없으면 \\'확인 필요\\'예요.'
      : '이수자 명단: 사람마다 입실·퇴실 시각, 머문 시간, 실습 완료, 설문 제출을 적어요. 이수 기준(출석 비율)이 연수 정보에 없어 \\'이수\\' 칸은 비워 둬요. 기관 기준으로 판단해 주세요.'));
    b.appendChild(s1);
    var s2 = el('div', 'lp-con-sec'); s2.appendChild(el('h3', '', '삭제'));
    s2.appendChild(el('p', 'lp-con-sub', LOCAL ? '리허설 기록은 이 브라우저에만 있어요. 실제 연수 전에 지워 두세요.' : '다 쓰면 [모든 데이터 삭제]로 지워 주세요. 그대로 두면 ' + ((DATA.privacy || {}).keep || ('마지막 기록 뒤 ' + ((DATA.privacy || {}).retentionDays || 30) + '일')) + '이 지나 지워져요' + (/^(sheets|supabase)$/.test((DATA.live || {}).provider || '') ? '(자동 삭제를 켜 둔 경우)' : '') + '. 내려받은 CSV에도 별명이 들어 있어요.'));
    var dlg = $('[data-purge-dialog]');
    var del = btn('모든 데이터 삭제', 'lp-btn-danger', function () { if (dlg && dlg.showModal) dlg.showModal(); else if (window.confirm('모든 기록을 지울까요? 되돌릴 수 없어요.')) purge(); }, 'purge');
    var r = el('div', 'lp-con-row'); r.appendChild(del); s2.appendChild(r); b.appendChild(s2);
    var goP = dlg && $('[data-purge-go]', dlg);
    if (goP) goP.addEventListener('click', function () { dlg.close(); purge(); });
    if (dlg) dlg.addEventListener('close', function () { del.focus(); });
    // 참여 QR: 파일로 열었거나 미리보기면 주소 대신 안내(meta.siteUrl이 있으면 그 주소). 암호 보호면 #k=를 QR에만 붙임
    var local = /^(file|about|blob|data):$/.test(location.protocol);
    var s3 = el('div', 'lp-con-sec'); s3.appendChild(el('h3', '', '참여 주소'));
    var j = el('div', 'lp-con-join'); s3.appendChild(j); b.appendChild(s3);
    // QR에는 원래 주소만(짧은 주소는 글자로만 — 중간 화면이 있는 서비스에는 #k=가 보임). 파일로 열어 원래 주소를 모르면 짧은 주소를 글자로.
    // localhost로 열었으면 서버가 같은 와이파이 주소를 알려 줄 때 다시 그림
    function paintJoin() {
      var site = DATA.siteUrl || siteDir();
      var u = site || (local ? DATA.shortUrl || '' : '');
      var ul = $('meta[name="lp-unlock"]'), qu = site ? site.split('#')[0] + (ul && ul.getAttribute('content') ? '#' + ul.getAttribute('content') : '') : '';
      j.textContent = '';
      var q = el('div', 'lp-qr'); q.setAttribute('role', 'img'); q.setAttribute('aria-label', '참여 QR 코드'); // copy-ok: 화면 읽기 이름표는 'QR 코드'도 됨(writing.md 4절)
      if (qu && window.qrcode) { try { if (qrcode.stringToBytesFuncs) qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8']; var qq = qrcode(0, 'M'); qq.addData(qu); qq.make(); q.innerHTML = qq.createSvgTag({ cellSize: 4, margin: 16, scalable: true }); } catch (e) { } }
      else q.appendChild(el('span', 'lp-qr-off', LOOP && !site ? 'localhost라 QR을 만들지 않았어요' : '배포하면 QR이 나와요.'));
      var su = String(DATA.shortUrl || ''); if (!u || su.replace(/\\/$/, '') === u.replace(/\\/$/, '')) su = '';
      var dl = el('dl'); var add = function (k, v) { var dv = el('div'); dv.appendChild(el('dt', '', k)); dv.appendChild(el('dd', '', v)); dl.appendChild(dv); };
      add('참가자 주소', u ? u.replace(/^https?:\\/\\//, '') : LOOP ? LOOP_MSG : '배포하면 여기에 나와요.');
      if (su) { su = su.replace(/^https?:\\/\\//, '').replace(/\\/$/, ''); try { su = decodeURI(su); } catch (e) { } add('짧은 주소', su); }
      add((DATA.words && DATA.words.code) || '연수 코드', DATA.live.code);
      j.appendChild(q); j.appendChild(dl);
      if (LOOP && site) j.appendChild(el('p', 'lp-con-sub', '이 노트북의 와이파이 주소예요. 참가자는 같은 와이파이에서 이 주소로 들어와요.'));
    }
    paintJoin(); onLan.push(paintJoin);
  }
  function purge() { conn.purge().then(function () { COLS.forEach(function (k) { data[k] = {}; }); queue(); toast('모든 기록을 지웠어요.'); }, err); }

  // ── 휴대폰에서 열기: 관리자 키가 든 QR(주소 뒤 #key=, 서버로 가지 않음) ──
  // 누를 때만 보이고 60초 뒤·창을 떠나면·대화상자를 닫으면 가림. 프로젝터에 비칠 수 있어 [QR 보이기]를 한 번 더 누르게 함
  var phone = $('[data-phone-dialog]'), phoneBtn = $('[data-phone-open]'), phoneT = 0;
  function phoneHide() {
    if (!phone) return; clearInterval(phoneT);
    var q = $('[data-phone-qr]', phone); q.hidden = true; q.textContent = '';
    $('[data-phone-cover]', phone).hidden = false; $('[data-phone-left]', phone).textContent = '';
  }
  function phoneUrl() {
    var dir = siteDir(); if (!dir || !ADMIN_KEY) return '';
    var ul = $('meta[name="lp-unlock"]'), k = ul && ul.getAttribute('content');
    return dir + 'console.html#' + (k ? k + '&' : '') + 'key=' + encodeURIComponent(ADMIN_KEY);
  }
  function phoneShow() {
    var u = phoneUrl(), q = $('[data-phone-qr]', phone); if (!u || !window.qrcode) return;
    try { if (qrcode.stringToBytesFuncs) qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8']; var qq = qrcode(0, 'M'); qq.addData(u); qq.make(); q.innerHTML = qq.createSvgTag({ cellSize: 4, margin: 16, scalable: true }); } catch (e) { return; }
    q.hidden = false; $('[data-phone-cover]', phone).hidden = true;
    var left = 60, lt = $('[data-phone-left]', phone), tick = function () { lt.textContent = left + '초 뒤에 가려요.'; if (left-- <= 0) phoneHide(); };
    clearInterval(phoneT); tick(); phoneT = setInterval(tick, 1000);
    var cl = $('button[value="close"]', phone); if (cl) cl.focus();
  }
  if (phone && phoneBtn) {
    var lead0 = $('[data-phone-lead]', phone).textContent;
    // 왜 못 쓰는지는 열 때마다 다시 봄(localhost면 서버가 와이파이 주소를 알려 준 뒤에는 쓸 수 있음)
    var phoneWhy = function () {
      var why = LOCAL ? '리허설 설정이라 휴대폰과 이어지지 않아요. 참여 기능 서버를 연결해 다시 배포하면 쓸 수 있어요.' : !siteDir() ? (LOOP ? LOOP_MSG : '배포하면 쓸 수 있어요.') : '';
      $('[data-phone-lead]', phone).textContent = why || lead0; $('[data-phone-box]', phone).hidden = !!why;
    };
    phoneWhy();
    phoneBtn.addEventListener('click', function () { phoneHide(); phoneWhy(); if (phone.showModal) phone.showModal(); });
    $('[data-phone-show]', phone).addEventListener('click', phoneShow);
    phone.addEventListener('close', function () { phoneHide(); if (moreBtn) moreBtn.focus(); });
    phone.addEventListener('click', function (e) { if (e.target === phone) phone.close(); });
    addEventListener('blur', phoneHide); doc.addEventListener('visibilitychange', function () { if (doc.hidden) phoneHide(); });
  }
})();
`,l=`/* lecpage 키트 CSS — AI가 쓴 사이트에 끼운 강의 기능(질문·투표·보드·출석·설문·교재·자료실·접속 QR·도크·'지금' 줄·대화상자)의 모양.
   모든 규칙은 .lpk 아래에만 있어 AI의 CSS를 건드리지 않습니다. 색·글꼴·둥근 정도는 사이트 CSS 변수
   --lp-accent --lp-ink --lp-paper --lp-font --lp-radius를 따르고, 없으면 연수 정보 theme(조립이 --lpk-*로 적음),
   그것도 없으면 주변 글자색·글꼴을 이어받습니다. 떠 있는 부품(도크·대화상자·알림)은 바탕을 몰라도 읽히게 늘 제 바탕을 깝니다. */
.lpk{
  --_ink:var(--lp-ink,var(--lpk-ink,currentColor));
  --_ac:var(--lp-accent,var(--lpk-accent,var(--_ink)));
  --_on:var(--lp-on-accent,var(--lpk-on-accent,Canvas));
  --_act:color-mix(in oklab,var(--_ac) 62%,var(--_ink));
  --_surf:var(--lp-paper,var(--lpk-surf,transparent));
  --_paper:var(--lp-paper,var(--lpk-paper,Canvas));
  --_text:var(--lp-ink,var(--lpk-ink,CanvasText));
  --_r:var(--lp-radius,var(--lpk-radius,12px));
  --_rs:min(var(--_r),10px);
  --_line:color-mix(in srgb,var(--_ink) 22%,transparent);
  --_tint:color-mix(in srgb,var(--_ink) 6%,transparent);
  --_danger:#c22f3a;
  font-family:var(--lp-font,var(--lpk-font,inherit));
  color:var(--_ink);
  line-height:1.6;
  text-align:start;
  word-break:keep-all;
  overflow-wrap:anywhere;
  -webkit-text-size-adjust:100%;
}
/* 강조색 위 글자(주 단추·누른 공감·고른 별점): 강조색의 밝기(WCAG 상대 휘도)로 흰색·검정을 고름 → 어두운 모드에서 --lp-accent를 밝게 바꿔도 4.5:1 이상.
   --lp-on-accent를 주면 그 색. 상대 색 문법을 모르는 옛 브라우저는 조립이 연수 정보 theme로 정한 --lpk-on-accent */
@supports (color:color(from red srgb-linear r g b)){
  .lpk{
    --_on-auto:color(from var(--lp-accent,var(--lpk-accent)) srgb-linear clamp(0,(.1791 - (.2126*r + .7152*g + .0722*b))*1e6,1) clamp(0,(.1791 - (.2126*r + .7152*g + .0722*b))*1e6,1) clamp(0,(.1791 - (.2126*r + .7152*g + .0722*b))*1e6,1));
    --_on:var(--lp-on-accent,var(--_on-auto,var(--lpk-on-accent,Canvas)));
  }
}
.lpk *,.lpk *::before,.lpk *::after{box-sizing:border-box}
.lpk :where(p,h2,h3,h4,ul,ol,dl,figure,fieldset,legend,form){margin:0;padding:0}
.lpk :where(ul,ol){list-style:none}
.lpk :where(button,input,textarea,select){font:inherit;color:inherit;letter-spacing:normal;text-transform:none}
.lpk [hidden]{display:none!important}
.lpk .lp-sr{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
.lpk .lp-ic{width:1.15em;height:1.15em;flex:none}
.lpk :focus-visible{outline:2px solid var(--_act);outline-offset:2px}

/* 자리 표시를 채운 칸: 사이트가 --lp-paper를 정했으면 그 바탕을 깔고(사진·짙은 띠 위에서도 읽힘), 아니면 주변 바탕 그대로 */
.lpk.lpk-w{display:block;background:var(--_surf);border-radius:var(--_r);padding:clamp(14px,3.2vw,24px);border:1px solid var(--_line);max-width:100%}
.lpk.lpk-w > * + *{margin-top:12px}

/* 단추 */
.lpk .lp-btn{display:inline-flex;align-items:center;justify-content:center;gap:.5em;min-height:44px;padding:.55em 1.1em;border-radius:var(--_rs);border:1.5px solid var(--_line);background:transparent;color:var(--_ink);font-weight:650;font-size:.95rem;line-height:1.2;text-decoration:none;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;transition:background .2s,border-color .2s,transform .12s}
.lpk .lp-btn:hover{background:var(--_tint);border-color:color-mix(in srgb,var(--_ink) 45%,transparent)}
.lpk .lp-btn:active{transform:scale(.98)}
.lpk .lp-btn:disabled{opacity:.55;cursor:not-allowed}
.lpk .lp-btn-primary{background:var(--_ac);border-color:var(--_ac);color:var(--_on)}
.lpk .lp-btn-primary:hover{background:color-mix(in srgb,var(--_ac) 86%,var(--_ink));border-color:transparent}
.lpk .lp-btn-sm{min-height:38px;padding:.4em .85em;font-size:.875rem}
.lpk .lp-icon-btn{display:inline-grid;place-items:center;width:44px;height:44px;border-radius:50%;border:0;background:transparent;color:inherit;cursor:pointer}
.lpk .lp-icon-btn:hover{background:var(--_tint)}
.lpk .lp-link{color:var(--_act);font-weight:600}
.lpk .lp-note,.lpk .lp-small,.lpk .lpk-empty{font-size:.9rem;color:color-mix(in srgb,var(--_ink) 78%,transparent)}
.lpk .lp-note{padding:10px 12px;border-radius:var(--_rs);background:var(--_tint)}
.lpk .lp-empty{font-weight:600;color:color-mix(in srgb,var(--_ink) 80%,transparent)}

/* 입력 칸 */
.lpk :is(textarea,input:not([type=checkbox]):not([type=radio]):not([type=file]),select){width:100%;min-height:44px;padding:10px 12px;border-radius:var(--_rs);border:1.5px solid var(--_line);background:color-mix(in srgb,var(--_paper) 92%,transparent);color:var(--_text);font-size:1rem;line-height:1.5}
.lpk textarea{resize:vertical;min-height:4.6em}
.lpk :is(textarea,input,select)::placeholder{color:color-mix(in srgb,var(--_text) 60%,transparent)}
.lpk :is(textarea,input,select):focus-visible{outline:2px solid var(--_act);outline-offset:1px;border-color:transparent}
.lpk input[type=checkbox],.lpk input[type=radio]{accent-color:var(--_ac);width:1.15em;height:1.15em}
.lpk .lp-compose{display:grid;gap:10px}
.lpk .lp-compose-f{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
.lpk .lp-compose-f small{font-size:.85rem;color:color-mix(in srgb,var(--_ink) 75%,transparent)}
.lpk .lp-file,.lpk .lp-inline{display:grid;gap:4px;font-size:.9rem}
.lpk .lp-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.lpk .lp-row input{flex:1 1 12em;width:auto}

/* 질문 */
.lpk .lp-tabs{display:flex;gap:18px;flex-wrap:wrap;border-bottom:1px solid var(--_line);margin-top:16px}
.lpk .lp-tabs button{border:0;background:none;padding:10px 0;margin-bottom:-1px;font-size:.92rem;font-weight:600;cursor:pointer;color:color-mix(in srgb,var(--_ink) 72%,transparent);border-bottom:2px solid transparent;min-height:44px}
.lpk .lp-tabs button[aria-pressed="true"]{color:var(--_ink);border-bottom-color:var(--_ac)}
.lpk .lp-qa-list{display:grid}
.lpk .lp-qa-item{display:grid;grid-template-columns:auto minmax(0,1fr);gap:14px;padding:14px 0;border-bottom:1px solid var(--_line)}
.lpk .lp-qa-item.is-pinned{background:linear-gradient(90deg,color-mix(in srgb,var(--_ac) 12%,transparent),transparent 85%)}
.lpk .lp-qa-item.is-answered{opacity:.72}
.lpk .lp-qa-list > .lp-empty,.lpk .lp-board-grid > .lp-empty{padding:14px 0}
.lpk .lp-vote{display:grid;justify-items:center;align-content:start;gap:2px;min-width:3.2em;min-height:44px;padding:6px;border-radius:var(--_rs);border:1.5px solid var(--_line);background:transparent;color:inherit;cursor:pointer;font-weight:700;font-variant-numeric:tabular-nums}
.lpk .lp-vote[aria-pressed="true"]{background:var(--_ac);border-color:var(--_ac);color:var(--_on)}
.lpk .lp-qa-meta{display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;font-size:.8rem;color:color-mix(in srgb,var(--_ink) 72%,transparent)}

/* 보드 */
.lpk .lpk-prompt{font-weight:650}
.lpk .lp-board-bar{display:flex;justify-content:space-between;align-items:end;gap:12px;flex-wrap:wrap;border-bottom:1px solid var(--_line)}
.lpk .lp-board-bar .lp-tabs{margin:0;border-bottom:0}
.lpk .lp-board-bar .lp-btn{margin-bottom:8px}
.lpk .lp-board-form{margin:16px 0}
.lpk .lp-seg{display:flex;flex-wrap:wrap;border:0}
.lpk .lp-seg label{position:relative;cursor:pointer}
.lpk .lp-seg input{position:absolute;opacity:0;width:1px;height:1px}
.lpk .lp-seg span{display:inline-flex;align-items:center;min-height:40px;padding:6px 14px;border:1.5px solid var(--_line);margin-left:-1.5px;font-size:.9rem}
.lpk .lp-seg label:first-child span{border-radius:var(--_rs) 0 0 var(--_rs);margin-left:0}
.lpk .lp-seg label:last-child span{border-radius:0 var(--_rs) var(--_rs) 0}
.lpk .lp-seg input:checked + span{background:var(--_ink);color:var(--_paper);border-color:var(--_ink)}
.lpk .lp-seg input:focus-visible + span{outline:2px solid var(--_act)}
.lpk .lp-board-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,240px),1fr));gap:12px;margin-top:16px}
.lpk .lp-board-grid > .lp-empty{grid-column:1 / -1}
.lpk .lp-card.lp-post{display:grid;gap:10px;align-content:start;padding:14px;border-radius:var(--_rs);border:1px solid var(--_line);background:var(--_paper);color:var(--_text)}
.lpk .lp-post-files{display:grid;gap:6px}
.lpk .lp-post-files img{display:block;width:100%;max-height:220px;object-fit:cover;border-radius:6px}
.lpk .lp-post-files :is(audio,video){width:100%}
.lpk .lp-post-f{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:.8rem;color:color-mix(in srgb,var(--_text) 72%,transparent)}
.lpk .lp-like{display:inline-flex;align-items:center;gap:4px;min-height:36px;border:0;background:none;color:inherit;font-weight:650;cursor:pointer}
.lpk .lp-like[aria-pressed="true"]{color:var(--_danger)}

/* 투표 */
.lpk .lpk-poll-q{font-weight:700;font-size:1.05rem}
.lpk .lp-poll:has([data-poll-live] h3) .lpk-poll-q{display:none}
.lpk .lp-poll-live{display:grid;gap:12px;padding:16px;border-radius:var(--_r);background:var(--_tint)}
.lpk .lp-poll-live:has(> .lp-empty){padding:4px 0;background:none}
.lpk .lp-poll-live h3{font-size:1.1rem;line-height:1.4}
.lpk .lp-poll-opts{display:grid;gap:8px}
.lpk .lp-poll-opts button{min-height:48px;padding:12px 16px;text-align:start;border-radius:var(--_rs);border:1.5px solid var(--_line);background:var(--_paper);color:var(--_text);font-weight:650;cursor:pointer}
.lpk .lp-poll-opts button:hover{border-color:var(--_ac)}
.lpk .lp-bars{display:grid;gap:10px}
.lpk .lp-bar{display:grid;gap:4px;font-size:.92rem}
.lpk .lp-bar-track{height:10px;border-radius:3px;background:color-mix(in srgb,var(--_ink) 12%,transparent);overflow:hidden}
.lpk .lp-bar-fill{height:100%;width:var(--w,0%);background:var(--_ac);transition:width .5s}
.lpk .lp-cloud{display:flex;flex-wrap:wrap;gap:6px 14px;justify-content:center;align-items:center;padding:12px}
.lpk .lp-cloud span{font-weight:800;line-height:1.1;color:var(--_act)}
.lpk .lp-cloud span:nth-child(2n){color:var(--_ink)}
.lpk .lp-poll-list{font-size:.9rem}

/* 퀴즈(정답 공개 뒤) */
.lpk .lp-bar.is-answer > span{font-weight:800}
.lpk .lp-bar.is-answer .lp-bar-fill{background:var(--_act)}
.lpk .lp-bar-tag{display:inline-block;margin-inline-start:.4em;padding:0 .45em;border-radius:4px;background:var(--_ac);color:var(--_on);font-size:.78rem;font-weight:800}
.lpk .lp-quiz-me{font-weight:700}

/* 모음(이 기기에만) */
.lpk .lp-nb{display:grid;gap:12px}
.lpk .lp-nb-list{display:grid;counter-reset:nb}
.lpk .lp-nb-list > li:not(.lp-empty){display:grid;gap:6px;padding:12px 0;border-top:1px solid var(--_line)}
.lpk .lp-nb-list > li:last-child{border-bottom:1px solid var(--_line)}
.lpk .lp-nb-src{font-size:.8rem;font-weight:700;color:color-mix(in srgb,var(--_ink) 72%,transparent)}
.lpk .lp-nb-t{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;font-size:.93rem;line-height:1.55;max-height:9.5em;overflow:auto}
.lpk .lp-nb-a{display:flex;gap:6px;justify-content:flex-end}
.lpk .lp-nb-list > .lp-empty{padding:8px 0}

/* 출석 */
.lpk .lp-attend{display:grid;gap:12px;justify-items:start}
.lpk .lp-ctas{display:flex;gap:8px;flex-wrap:wrap}
.lpk [data-attend].is-done{background:var(--_tint);border-color:var(--_line);color:var(--_ink)}

/* 설문 */
.lpk .lp-survey-form{display:grid;gap:16px}
.lpk .lp-sv-list{display:grid;gap:0}
.lpk .lp-sv-list > li{padding:16px 0;border-top:1px solid var(--_line)}
.lpk .lp-sv-list fieldset{border:0;display:grid;gap:10px;min-width:0}
.lpk :is(.lp-sv-list legend,.lp-sv-q){display:flex;gap:10px;align-items:baseline;font-weight:700;font-size:1.02rem;margin-bottom:6px}
.lpk .lp-idx{font-variant-numeric:tabular-nums;color:var(--_act);font-weight:800;flex:none;white-space:nowrap} /* 문항 번호 '02'가 휴대폰에서 '0/2'로 쪼개지지 않게 */
.lpk .lp-sv-text{display:grid;gap:8px}
.lpk .lp-sv-opts{display:flex;flex-wrap:wrap;gap:8px}
.lpk .lp-sv-opts label{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:8px 14px;border-radius:var(--_rs);border:1.5px solid var(--_line);background:var(--_paper);color:var(--_text);cursor:pointer}
.lpk .lp-sv-opts label:has(input:checked){border-color:var(--_ac);box-shadow:inset 0 0 0 1.5px var(--_ac)}
.lpk .lp-sv-scale .lp-sv-opts{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:0}
.lpk .lp-sv-scale label{position:relative;justify-content:center;align-items:flex-start;min-height:68px;padding:8px 2px;border-radius:0;text-align:center}
.lpk .lp-sv-scale label + label{margin-left:-1.5px}
.lpk .lp-sv-scale label:first-child{border-radius:var(--_rs) 0 0 var(--_rs)}
.lpk .lp-sv-scale label:last-child{border-radius:0 var(--_rs) var(--_rs) 0}
.lpk .lp-sv-scale input{position:absolute;opacity:0;width:1px;height:1px}
.lpk .lp-sv-scale label:has(input:checked){z-index:1;background:var(--_ac);border-color:var(--_ac);color:var(--_on);box-shadow:none}
.lpk .lp-sv-scale label:has(input:focus-visible){z-index:2;outline:2px solid var(--_act);outline-offset:2px}
.lpk .lp-sv-scale label span{display:grid;gap:2px;line-height:1.25}
.lpk .lp-sv-scale label b{font-size:1.05rem;font-variant-numeric:tabular-nums}
.lpk .lp-sv-scale label i{font-style:normal;font-size:max(12px,.75rem)}
/* 좁은 휴대폰(360px 이하): 다섯 칸에 '보통이에요'가 '보통이에/요'로 쪼개지지 않게 가운데 셋의 이름은 숨기고(화면 낭독기에는 그대로) 양 끝(전혀 아니에요·매우 그래요)만 */
@media (max-width:360px){
  .lpk .lp-sv-scale label{min-height:56px}
  .lpk .lp-sv-scale label:not(:first-child):not(:last-child) i{position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
  .lpk .lp-sv-scale label i{font-size:12px;line-height:1.2}
}
/* 화면은 넓어도 사이트가 설문을 카드 안에 넣어 다섯 칸이 좁을 때(휴대폰 390px에 카드 두 겹이면 칸 57px): 같은 규칙을 설문 너비로 */
.lpk .lp-sv-scale .lp-sv-opts{container-type:inline-size}
@container (max-width:21rem){
  .lpk .lp-sv-scale label{min-height:56px}
  .lpk .lp-sv-scale label:not(:first-child):not(:last-child) i{position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
  .lpk .lp-sv-scale label i{font-size:12px;line-height:1.2}
}

/* 교재 넘기기 */
.lpk .lp-deck{display:grid;gap:10px;grid-template-columns:minmax(0,1fr)}
.lpk .lp-deck-stage{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,260px),1fr));gap:16px;outline:none}
.lpk .lp-deck-stage:focus-visible{outline:2px solid var(--_act);outline-offset:4px}
.lpk .lp-slide{display:grid;gap:6px;margin:0}
.lpk .lp-slide img{display:block;width:100%;height:auto;aspect-ratio:var(--lp-deck-ratio,var(--lpk-deck-ratio,16/9));object-fit:contain;background:var(--_paper);border:1px solid var(--_line);border-radius:var(--_rs)}
.lpk .lp-slide figcaption{display:flex;gap:8px;font-size:.85rem;color:color-mix(in srgb,var(--_ink) 78%,transparent)}
.lpk .lp-slide-no{font-weight:800;font-variant-numeric:tabular-nums;color:var(--_act)}
.lpk .lp-deck.is-ready .lp-deck-stage{display:block}
.lpk .lp-deck.is-ready .lp-slide:not(.is-active){display:none}
.lpk .lp-deck.is-ready .lp-slide figcaption{min-height:1.6em}
.lpk .lp-deck-bar{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.lpk .lp-deck-count{font-variant-numeric:tabular-nums;font-size:.95rem}
.lpk .lp-grow{flex:1}
.lpk .lp-follow{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 6px;font-size:.88rem;cursor:pointer}
.lpk .lp-deck-thumbs{display:flex;gap:8px;overflow-x:auto;padding:2px 2px 8px;scrollbar-width:thin}
.lpk .lp-deck-thumbs button{flex:none;width:112px;padding:0;border:2px solid transparent;border-radius:6px;background:none;cursor:pointer;color:inherit;overflow:hidden}
.lpk .lp-deck-thumbs button[aria-current="true"]{border-color:var(--_ac)}
.lpk .lp-deck-thumbs img{display:block;width:100%;aspect-ratio:var(--lp-deck-ratio,var(--lpk-deck-ratio,16/9));object-fit:cover;background:var(--_paper)}
.lpk .lp-thumb-t{display:grid;gap:2px;padding:6px;font-size:max(12px,.75rem);text-align:start}
.lpk .lp-thumb-t i{font-style:normal;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* 휴대폰: '전체 보기'·'전체 화면'은 그림 단추(이름은 화면 낭독기에 그대로)로 줄여 쪽 넘기기와 한 줄에, '강사 따라 넘기기'는 다음 줄에 누를 곳 크기로.
   (칸 폭 질의(container)는 쓰지 않음: 사이트가 키트를 내용 폭 상자(flex 등)에 넣으면 폭이 0으로 줄어서) */
@media (max-width:480px){
  .lpk .lp-deck-bar{gap:2px}
  .lpk .lp-deck-bar .lp-btn-sm{min-width:44px;min-height:44px;padding:0}
  .lpk .lp-deck-bar .lp-btn-sm span{position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
  .lpk .lp-follow{flex-basis:100%}
}
.lpk .lp-deck:fullscreen{background:#111;color:#fff;padding:16px;align-content:center}
.lpk .lp-deck:fullscreen .lp-slide img{max-height:calc(100vh - 140px);border:0;background:#111}
dialog.lpk.lp-overview{width:min(1100px,calc(100% - 24px));max-height:calc(100% - 24px);padding:0;border:0;border-radius:var(--_r);background:var(--_paper);color:var(--_text);box-shadow:0 24px 64px rgba(0,0,0,.35)}
dialog.lpk.lp-overview::backdrop{background:rgba(0,0,0,.55)}
.lpk .lp-overview-h{position:sticky;top:0;display:flex;gap:8px;padding:12px;background:var(--_paper);border-bottom:1px solid var(--_line)}
.lpk .lp-overview-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;padding:12px}
.lpk .lp-overview-grid button{display:grid;gap:4px;padding:0;border:1px solid var(--_line);border-radius:6px;background:none;color:inherit;font-size:.8rem;text-align:start;cursor:pointer;overflow:hidden}
.lpk .lp-overview-grid button span{padding:4px 6px}
.lpk .lp-overview-grid img{display:block;width:100%;aspect-ratio:var(--lp-deck-ratio,var(--lpk-deck-ratio,16/9));object-fit:cover}

/* 접속 QR */
.lpk .lp-qr{width:180px;max-width:100%;aspect-ratio:1;background:#fff;border-radius:8px;padding:4px;display:grid;place-items:center;flex:none}
.lpk .lp-qr svg,.lpk .lp-qr img{display:block;width:100%;height:auto}
.lpk .lp-qr-lg{width:min(280px,70vw);margin:0 auto}
.lpk .lp-qr-off{padding:8px;font-size:.84rem;line-height:1.45;color:#333;text-align:center}
.lpk .lpk-join-in{display:flex;gap:20px;align-items:center;flex-wrap:wrap}
.lpk .lpk-join-t{display:grid;gap:6px;justify-items:start;min-width:0;flex:1 1 220px}
.lpk .lpk-join-k{font-size:.9rem;color:color-mix(in srgb,var(--_ink) 78%,transparent)}
.lpk .lpk-join-url{font-size:clamp(1.05rem,.9rem + 1vw,1.5rem);font-weight:800;line-height:1.3;word-break:break-all}
.lpk .lpk-join-full{font-size:.85rem;word-break:break-all;color:color-mix(in srgb,var(--_ink) 75%,transparent)}
.lpk .lpk-join-code b{font-size:1.25rem;letter-spacing:.12em;font-variant-numeric:tabular-nums}

/* 자료실 */
.lpk .lp-materials{display:grid}
.lpk .lp-materials > li{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:12px;align-items:center;padding:12px 0;border-bottom:1px solid var(--_line)}
.lpk .lp-materials h3{font-size:1rem;line-height:1.4}
.lpk .lp-materials :is(p,small){font-size:.85rem;color:color-mix(in srgb,var(--_ink) 75%,transparent)}
.lpk .lp-file-kind{font-size:max(12px,.75rem);font-weight:800;letter-spacing:.04em;color:var(--_act);min-width:3em}

/* 실습 단계 끝 */
.lpk.lpk-step-f{display:flex;gap:8px;flex-wrap:wrap;margin-top:20px}
.lpk .lp-btn-check[aria-pressed="true"]{background:var(--_ac);border-color:var(--_ac);color:var(--_on)}
.lpk-anchor{display:block;position:relative;height:0;overflow:hidden}

/* 키트가 연수 중에 더하는 칸(즉석 투표·강사가 올린 자료) */
.lpk.lpk-extra{display:block}
.lpk.lpk-extra:empty{display:none}
.lpk.lpk-extra > .lp-sec{display:block;max-width:960px;margin:32px auto;padding:clamp(14px,3vw,24px);border:1px solid var(--_line);border-radius:var(--_r);background:var(--_surf)}
.lpk.lpk-extra .lp-h2{font-size:1.3rem;margin-bottom:12px}

/* ── 떠 있는 부품: 늘 제 바탕(사이트 --lp-paper, 없으면 브라우저 바탕색)과 글자색 ── */
.lpk.lpk-chrome,.lpk.lpk-now,.lpk.lpk-dock{--_ink:var(--_text);color:var(--_text)}
.lpk .lp-dock,.lpk.lp-dock{position:fixed;z-index:2147483001;right:max(12px,env(safe-area-inset-right,0px));bottom:calc(12px + env(safe-area-inset-bottom,0px));display:flex;align-items:center;gap:6px;padding:6px;border-radius:999px;background:var(--_paper);color:var(--_text);border:1px solid color-mix(in srgb,var(--_text) 18%,transparent);box-shadow:0 8px 26px rgba(0,0,0,.2);max-width:calc(100% - 24px);flex-wrap:wrap;justify-content:flex-end}
.lpk.lpk-dock--placed .lp-dock{position:static;box-shadow:none;max-width:none}
.lpk .lp-btn-dock{min-height:44px;border-radius:999px;border:0;background:var(--_text);color:var(--_paper);padding:.4em 1em;font-size:.9rem}
.lpk .lp-btn-dock:hover{background:color-mix(in srgb,var(--_text) 85%,var(--_paper))}
.lpk .lp-live-dot{width:10px;height:10px;border-radius:50%;margin:0 4px;background:color-mix(in srgb,var(--_text) 45%,transparent)}
.lpk .lp-live-dot[data-state="live"]{background:#1f8a4c}
.lpk .lp-live-dot[data-state="polling"]{background:#c98a00}
.lpk .lp-live-dot[data-state="offline"]{background:var(--_danger)}
.lpk .lp-fold{position:relative;display:flex}
.lpk .lp-fold-btn{display:grid;place-items:center;width:44px;height:44px;border:0;border-radius:50%;background:transparent;color:inherit;cursor:pointer}
.lpk .lp-fold-btn:hover,.lpk .lp-fold.is-open > .lp-fold-btn{background:color-mix(in srgb,var(--_text) 9%,transparent)}
.lpk .lp-fold-list{display:none;position:absolute;right:-6px;bottom:calc(100% + 12px);gap:2px;padding:6px;border-radius:14px;background:var(--_paper);color:var(--_text);border:1px solid color-mix(in srgb,var(--_text) 18%,transparent);box-shadow:0 10px 30px rgba(0,0,0,.2)}
.lpk .lp-fold.is-open > .lp-fold-list{display:flex}
.lpk .lp-fold-list button{display:flex;align-items:center;justify-content:center;gap:10px;min-width:44px;min-height:44px;border:0;border-radius:8px;background:transparent;color:inherit;font-weight:600;font-size:.9rem;white-space:nowrap;cursor:pointer}
.lpk .lp-fold-list button:hover{background:color-mix(in srgb,var(--_text) 9%,transparent)}
.lpk .lp-signal .lp-fold-list{flex-direction:column}
.lpk .lp-signal .lp-fold-list button{justify-content:flex-start;padding:6px 14px 6px 8px}
.lpk .lp-signal .lp-fold-list button[aria-pressed="true"]{box-shadow:inset 0 0 0 2px var(--_text)}
.lpk .lp-signal i{flex:none;display:grid;place-items:center;width:24px;height:24px;border-radius:50%;font-style:normal;font-weight:800;font-size:.8rem;line-height:1;color:#fff}
.lpk .lp-signal [data-signal="green"] i,.lpk .lp-signal i[data-v="green"]{background:#1f7a46}
.lpk .lp-signal [data-signal="yellow"] i,.lpk .lp-signal i[data-v="yellow"]{background:#e8b100;color:#111}
.lpk .lp-signal [data-signal="red"] i,.lpk .lp-signal i[data-v="red"]{background:#c4302b}
.lpk .lp-signal i[data-signal-now]:not([data-v]){width:28px;border-radius:0;background:radial-gradient(circle,#1f7a46 3.5px,transparent 4px) 0 50%/9.33px 100%,radial-gradient(circle,#e8b100 3.5px,transparent 4px) 50% 50%/9.33px 100%,radial-gradient(circle,#c4302b 3.5px,transparent 4px) 100% 50%/9.33px 100%;background-repeat:no-repeat}
.lpk .lpk-share{min-height:44px;border-radius:999px;border-color:transparent}
.lpk .lp-reactions{position:fixed;right:24px;bottom:96px;width:60px;height:60vh;pointer-events:none;z-index:2147482990}
.lpk .lp-reactions span{position:absolute;bottom:0;font-size:2rem;color:var(--_act);animation:lpk-float 2.6s cubic-bezier(.16,1,.3,1) forwards}
.lpk .lp-reactions span .lp-ic{display:block;width:2rem;height:2rem;stroke-width:2}
@keyframes lpk-float{to{transform:translate(var(--dx,0),-55vh) scale(1.2);opacity:0}}
/* 도크가 페이지 끝 글을 가리지 않게: 사이트 CSS는 건드리지 않고 키트 부품 묶음(본문 맨 끝)이 도크 높이만큼 자리를 차지 */
html.lp-dock-on{scroll-padding-bottom:calc(var(--lp-dock-h,58px) + 24px)}
html.lp-dock-on .lpk.lpk-chrome{display:block;height:calc(var(--lp-dock-h,58px) + 20px)}
.lpk.lpk-chrome{display:block;height:0;margin:0;padding:0}

/* '지금' 줄·끝난 연수 줄: 아래에 떠 있는 띠(사이트 머리·메뉴를 가리지 않게 도크 바로 위, 가운데 좁게) */
.lpk.lpk-now{position:fixed;z-index:2147483000;bottom:calc(12px + env(safe-area-inset-bottom,0px));left:50%;transform:translateX(-50%);width:min(720px,calc(100% - 16px))}
html.lp-dock-on .lpk.lpk-now{bottom:calc(var(--lp-dock-h,58px) + 22px + env(safe-area-inset-bottom,0px))}
.lpk.lpk-now:not(:has(> :not([hidden]))){display:none}
.lpk.lpk-now--placed{position:static;transform:none;width:auto}
.lpk .lp-now-in{display:flex;align-items:center;gap:10px;padding:6px 6px 6px 14px;border-radius:var(--_rs);background:var(--_paper);color:var(--_text);border:1px solid color-mix(in srgb,var(--_text) 20%,transparent);box-shadow:0 8px 24px rgba(0,0,0,.18)}
.lpk.lpk-now .lp-now.has-notice .lp-now-in,.lpk .lp-now.has-notice .lp-now-in{background:var(--_text);color:var(--_paper);border-color:transparent}
.lpk .lp-now[data-level="warn"] .lp-now-in{background:#f5b041;color:#111}
.lpk .lp-now-tag{flex:none;font-size:.78rem;font-weight:800;color:var(--_act)}
.lpk .lp-now.has-notice .lp-now-tag,.lpk .lp-now[data-level="warn"] .lp-now-tag,.lpk .lp-phase .lp-now-tag{color:inherit}
.lpk .lp-now-text{flex:1;min-width:0;display:grid;line-height:1.35;font-size:.92rem}
.lpk .lp-now-text b{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.lpk .lp-now.is-open .lp-now-text b{display:block;-webkit-line-clamp:unset}
.lpk .lp-now-text span{font-size:.8rem;opacity:.9;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lpk .lp-now-text :is(b,span):empty{display:none}
.lpk .lp-now-more{flex:none;min-height:36px;border:0;background:none;color:inherit;font-weight:700;text-decoration:underline;cursor:pointer}
.lpk .lp-now-timer{flex:none;padding:2px 8px;border-radius:4px;border:1.5px solid currentColor;font-weight:700;font-variant-numeric:tabular-nums}
.lpk .lp-now-timer.is-over{background:var(--_danger);color:#fff}
.lpk .lp-now-cta{flex:none;min-height:40px}

/* 대화상자·알림(맨 위 층) */
.lpk .lp-dialog{width:min(440px,calc(100% - 24px));max-height:calc(100% - 24px);padding:0;border:0;border-radius:var(--_r);background:var(--_paper);color:var(--_text);box-shadow:0 24px 64px rgba(0,0,0,.35);overscroll-behavior:contain}
.lpk .lp-dialog::backdrop{background:rgba(0,0,0,.5)}
.lpk .lp-dialog-in{display:grid;gap:14px;padding:22px}
.lpk .lp-dialog h2{font-size:1.25rem;line-height:1.3;font-weight:750}
.lpk .lp-dialog label{display:grid;gap:4px;font-size:.92rem;font-weight:600}
.lpk .lp-dialog .lp-consent{grid-template-columns:auto 1fr;align-items:start;font-weight:400;font-size:.84rem}
.lpk .lp-sheet-h{display:flex;justify-content:space-between;align-items:center;gap:12px}
.lpk .lp-share-url,.lpk .lp-share-full{text-align:center;word-break:break-all;font-size:.86rem}
.lpk .lp-share-code{text-align:center}
.lpk .lp-share-code b{font-size:1.35rem;letter-spacing:.12em}
.lpk .lp-share-scr{text-align:center}
.lpk .lp-share-scr a{color:inherit;font-weight:700;text-decoration:underline}
.lpk .lp-dialog [data-join-err]{color:var(--_danger)!important}
.lpk .lp-toast{position:fixed;z-index:2147483002;left:50%;bottom:calc(84px + env(safe-area-inset-bottom,0px));transform:translate(-50%,20px);max-width:calc(100% - 32px);padding:10px 18px;border-radius:var(--_rs);background:var(--_text);color:var(--_paper);font-weight:650;font-size:.92rem;text-align:center;opacity:0;pointer-events:none;transition:opacity .2s,transform .3s}
.lpk .lp-toast.is-on{opacity:1;transform:translate(-50%,0)}
html.lp-dock-on .lpk .lp-toast{bottom:calc(var(--lp-dock-h,58px) + 26px + env(safe-area-inset-bottom,0px))}
/* '지금' 줄이 떠 있으면 알림은 그 위로 */
html:has(.lpk-now [data-now]:not([hidden])) .lpk .lp-toast{bottom:calc(var(--lp-dock-h,0px) + 96px + env(safe-area-inset-bottom,0px))}
.lpk .lp-live-down{margin-bottom:8px}

@media (max-width:600px){
  .lpk .lp-dock{left:8px;right:8px;bottom:calc(8px + env(safe-area-inset-bottom,0px));justify-content:center;max-width:none}
  .lpk .lp-btn-dock{padding:.4em .8em}
  .lpk .lp-dock .lpk-dock-share{display:none} /* 휴대폰 도크는 한 줄로(QR은 발표 화면·접속 칸에) */
  .lpk .lp-materials > li{grid-template-columns:minmax(0,1fr) auto}
  .lpk .lp-materials .lp-file-kind{display:none}
  .lpk .lpk-join-in{justify-content:center}
  .lpk .lp-qr{width:min(200px,60vw)}
}
@media (prefers-reduced-motion:reduce){
  .lpk *{transition:none!important;animation:none!important}
}
@media print{.lpk.lpk-chrome,.lpk.lpk-now{display:none!important}}
`,s=`/* lecpage 보조 쪽 CSS(강사 화면·발표 화면·QR 안내문·접속 확인·개인정보 안내, 쪽 배치는 aux-pages.css) — 색은 theme.css의 변수만 씁니다.
   부품 변형은 <html data-*> 속성(보조 쪽 틀 두 벌, design/presets.js)으로 바뀝니다. AI가 쓴 참가자 쪽은 이 파일을 싣지 않습니다(키트 CSS kit.css만).
   디자인 규칙(references/design-quality.md): 상자는 꼭 필요할 때만. 구분은 글자 크기·굵기·여백·가는 선으로.
   알약 모양 꼬리표·한쪽 색 띠·그라데이션 글자·상자 속 상자를 쓰지 않습니다. */
:root{
  /* 글자 크기 단계(본문 17px 기준, 1.25~1.6배씩) */
  --fs-xs:.8125rem;--fs-sm:.9375rem;--fs-base:1.0625rem;--fs-md:1.1875rem;
  --fs-h2s:clamp(1.75rem,1.2rem + 1.6vw,2.5rem);   /* 두 단 섹션 제목·큰 번호 */
  --fs-num:clamp(2.25rem,1.6rem + 2.4vw,3.5rem);  /* 큰 숫자 */
  --fs-lg:clamp(1.25rem,1.08rem + .7vw,1.5rem);
  --fs-xl:clamp(2rem,1.1rem + 3.3vw,3.75rem);
  --fs-2xl:clamp(2.5rem,1.3rem + 5.2vw,5.5rem);
  /* 여백 단계(4px 바탕) */
  --sp-1:4px;--sp-2:8px;--sp-3:12px;--sp-4:16px;--sp-5:24px;--sp-6:32px;--sp-7:48px;--sp-8:64px;--sp-9:96px;
  --measure:38em;            /* 한국어 본문 한 줄 30~40자 */
  --rule-c:color-mix(in srgb,var(--foreground) 14%,transparent);
  --rule:var(--border-w) solid var(--rule-c);
  --tint:color-mix(in srgb,var(--foreground) 4%,transparent);
  --display-tracking:-.03em;
  /* 큰 글자 세 가지: 띠의 문장 · 아주 큰 숫자 · 마무리 문장. 그리고 목표처럼 크게 읽는 문장 */
  --fs-statement:clamp(2rem,1.1rem + 3.9vw,4.75rem);
  --fs-figure:clamp(3.5rem,1.7rem + 7.2vw,8rem);
  --fs-closing:clamp(2.75rem,1.2rem + 6.6vw,7.75rem);
  --fs-goal:clamp(1.25rem,1rem + 1.25vw,2rem);
}
[data-card="outline"],[data-card="paper"]{--rule-c:color-mix(in srgb,var(--foreground) 20%,transparent)}
[data-heading="heavy"]{--display-tracking:-.035em}

*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;overflow-x:clip} /* 안전망: 글자를 크게 키운 좁은 화면에서 한 칸이 넘쳐도 옆으로 밀리지 않게(원인은 각 칸에서 고침, sticky는 그대로) */
/* 위 메뉴(sticky)에 가리지 않게: 옮겨 가는 곳(섹션·#주소·본문의 칸, 따라 넘기기가 옮기는 교재·실습 칸)에만 위 여백(--lp-head = 메뉴 높이 + 16px, lecpage.js).
   html의 scroll-padding-top은 쓰지 않음: 메뉴 안 단추에 초점이 가면 그 여백에 가린 것으로 보고 화면이 위로 튐 */
:where(section[id],[id]:target,main [id],main :is(a[href],button,input,select,textarea,summary,[tabindex]),[data-deck],[data-stations]){scroll-margin-top:var(--lp-head,84px)}
body{margin:0;background:var(--background);color:var(--foreground);font-family:var(--font-sans);font-size:var(--fs-base);line-height:1.75;word-break:keep-all;overflow-wrap:break-word;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;font-feature-settings:"kern"}
/* 글자 크게(브라우저 글꼴 크기 키움)에서도 가로로 넘치지 않게: 낱말 단위 줄바꿈(keep-all)은 그대로, 한 낱말이 칸보다 길 때만 그 안에서 나눔(격자·줄 칸이 긴 낱말에 밀려 넓어지지 않음) */
:is(h1,h2,h3,h4,p,dt,dd,li,blockquote,figcaption){overflow-wrap:anywhere}
::selection{background:var(--selection)}
img,svg,video{max-width:100%;height:auto}
a{color:var(--primary);text-underline-offset:.22em;text-decoration-thickness:1px}
h1,h2,h3,h4{margin:0;font-weight:700;line-height:1.3;letter-spacing:-.01em;text-wrap:balance}
h1,h2{font-family:var(--font-display);font-weight:var(--display-weight);letter-spacing:var(--display-tracking)}
p{margin:0;text-wrap:pretty}
ul,ol{margin:0;padding:0}
button,input,select,textarea{font:inherit;color:inherit}
input,textarea,select{font-size:max(16px,1em)}
:focus-visible{outline:2px solid var(--ring);outline-offset:3px;border-radius:2px}
[hidden]{display:none!important}
.lp-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.lp-skip{position:absolute;left:12px;top:-60px;z-index:100;background:var(--primary);color:var(--primary-foreground);padding:8px 14px;border-radius:var(--radius-sm);text-decoration:none}
.lp-skip:focus{top:12px}
main[tabindex="-1"]:focus{outline:0}
.lp-theming,.lp-theming *,.lp-theming *::before,.lp-theming *::after{transition:none!important} /* 밝게·어둡게 바꾸는 한 장면(lecpage.js) */ /* 건너뛰기 링크로 온 초점: 본문 첫머리에서 Tab이 이어지게(테두리는 그리지 않음) */
.lp-ic{flex:none;width:1.1em;height:1.1em}
.lp-num,.lp-idx,time{font-variant-numeric:tabular-nums}

/* 틀·섹션 */
.lp-wrap{width:100%;max-width:1160px;margin:0 auto;padding-left:max(20px,env(safe-area-inset-left,0px));padding-right:max(20px,env(safe-area-inset-right,0px))}
.lp-sec{--band-primary:var(--primary);position:relative;padding-block:clamp(48px,5.8vw,92px);background:var(--background);color:var(--foreground);isolation:isolate}
.lp-tinted{background:var(--surface-2)}
/* 큰 연수(pages.js data-big): 화면 밖 칸의 배치·그리기를 미룸. 칸 안쪽(.lp-wrap)에만 걸어 칸 둘레 꾸밈은 잘리지 않게, 한 번 그린 높이는 기억(auto) */
[data-big] main > .lp-sec:not(.lp-hero):not(.lp-bleed):not(.lp-invert) > .lp-wrap{content-visibility:auto;contain-intrinsic-size:auto 900px} /* 색 띠(bleed·invert) 칸은 그대로: 화면 밖에서도 배경 대비를 재는 도구(axe)가 헷갈리지 않게 */
/* 섹션 머리: 번호 줄(.lp-head-k) + 제목 + 설명. 번호 줄의 모양은 프리셋마다 다릅니다(<html data-head>) */
.lp-head{display:grid;gap:var(--sp-3);margin-bottom:clamp(24px,3.4vw,48px)}
.lp-head > *{max-width:46rem}
.lp-head-k{display:flex;align-items:center;gap:.75em;font-size:var(--fs-sm);font-weight:700;line-height:1.2;color:var(--muted-foreground);font-variant-numeric:tabular-nums}
.lp-head-no{color:var(--primary)}
/* chapter: 윤곽선으로 그린 큰 번호 */
[data-head="chapter"] .lp-head-k{align-items:flex-end;gap:var(--sp-3);margin-bottom:var(--sp-1)}
[data-head="chapter"] .lp-head-no{font-family:var(--font-num);font-weight:var(--num-weight);font-size:var(--fs-num);line-height:.82;letter-spacing:-.04em;color:transparent;-webkit-text-stroke:1.5px var(--primary)}
[data-head="chapter"] .lp-head-label{padding-bottom:.2em}
/* tab: 실습지의 문항 번호 칸 */
.lp-h1{font-size:var(--fs-2xl);line-height:1.12}
.lp-h2{font-size:var(--fs-xl);line-height:1.22}
.lp-head--sm .lp-h2{font-size:var(--fs-h2s);line-height:1.25} /* 참여·도움 칸: 한 단 작은 머리(섹션 머리 두 단계) */
.lp-lead{font-size:var(--fs-md);line-height:1.65;color:var(--muted-foreground);max-width:32em}
.lp-small{font-size:var(--fs-sm);color:var(--muted-foreground)}
.lp-note{font-size:var(--fs-sm);color:var(--muted-foreground);margin-top:var(--sp-4);max-width:var(--measure)}
.lp-src{font-size:var(--fs-sm);color:var(--muted-foreground)}
.lp-src a{color:inherit;display:inline-block;min-width:24px;min-height:24px;padding:2px 3px;margin:-2px -3px;text-align:center} /* 누르는 곳 24px 이상(줄 간격은 그대로) */
.lp-empty{list-style:none;color:var(--muted-foreground);padding:var(--sp-6) 0;border-top:var(--rule)}
.lp-grow{flex:1}

/* 섹션 틀(data-frame): split = 머리 왼쪽(붙박이)·내용 오른쪽 · stack/wide = 머리 위(설명이 있으면 제목 왼쪽·설명 오른쪽 아래) · band = 화면 폭 띠.
   줄 목록(일정·FAQ·자료·연수 후·차시)만 split을 쓰고, 연달아 나오면 한 칸 걸러 wide(두 단 목록)로 바뀝니다(render/sections.js frameOf) */
@media (min-width:1024px){
  .lp-sec[data-frame="split"] > .lp-wrap{display:grid;grid-template-columns:minmax(0,4fr) minmax(0,8fr);column-gap:clamp(32px,5vw,88px);align-items:start}
  .lp-sec[data-frame="split"] > .lp-wrap > *{grid-column:2}
  .lp-sec[data-frame="split"] > .lp-wrap > .lp-head{grid-column:1;grid-row:1 / span 8;position:sticky;top:96px;margin-bottom:0}
  .lp-sec[data-frame="split"] .lp-h2{font-size:var(--fs-h2s)}
  .lp-sec:is([data-frame="stack"],[data-frame="wide"]) .lp-head:has(> .lp-lead){max-width:none;grid-template-columns:minmax(0,7fr) minmax(0,5fr);column-gap:clamp(32px,5vw,88px)}
  .lp-sec:is([data-frame="stack"],[data-frame="wide"]) .lp-head:has(> .lp-lead) > *{grid-column:1}
  .lp-sec:is([data-frame="stack"],[data-frame="wide"]) .lp-head:has(> .lp-lead) > .lp-lead{grid-column:2;grid-row:1 / span 2;align-self:end;padding-bottom:.35em}
  .lp-sec[data-frame="wide"] :is(.lp-faq,.lp-materials,.lp-sessions){grid-template-columns:minmax(0,1fr) minmax(0,1fr);column-gap:clamp(32px,5vw,88px);max-width:none}
}

/* 버튼·링크 */
.lp-btn{display:inline-flex;align-items:center;justify-content:center;gap:.5em;min-height:44px;padding:.6em 1.15em;border-radius:var(--radius-sm);border:var(--border-w) solid transparent;background:var(--secondary);color:var(--secondary-foreground);font-weight:650;font-size:var(--fs-sm);line-height:1.2;text-decoration:none;cursor:pointer;touch-action:manipulation;transition:transform var(--dur-1) var(--ease-out),background var(--dur-2),box-shadow var(--dur-2),color var(--dur-2);-webkit-tap-highlight-color:transparent}
.lp-btn:active{transform:scale(.98)}
.lp-btn-primary{background:var(--primary);color:var(--primary-foreground)}
.lp-btn-primary:hover{background:color-mix(in srgb,var(--primary) 88%,var(--foreground))}
.lp-btn-ghost{background:transparent;border-color:color-mix(in srgb,var(--foreground) 22%,transparent);color:var(--foreground)}
.lp-btn-ghost:hover{background:var(--tint);border-color:color-mix(in srgb,var(--foreground) 40%,transparent)}
.lp-btn-sm{min-height:36px;padding:.4em .85em;font-size:var(--fs-xs)}
.lp-btn-lg{min-height:52px;padding:.8em 1.5em;font-size:var(--fs-base)}
[data-btn="pill"] .lp-btn{border-radius:999px}
.lp-icon-btn{display:inline-grid;place-items:center;width:40px;height:40px;border-radius:999px;border:0;background:transparent;color:var(--foreground);cursor:pointer;text-decoration:none;transition:background var(--dur-2)}
.lp-icon-btn:hover{background:var(--tint)}
.lp-icon-btn[aria-pressed="true"]{background:var(--foreground);color:var(--background)}
.lp-textbtn{background:none;border:0;padding:4px 2px;color:var(--muted-foreground);cursor:pointer;font-size:var(--fs-sm);display:inline-flex;gap:4px;align-items:center;text-decoration:underline;text-underline-offset:3px}
.lp-link{display:inline-flex;align-items:center;gap:.35em;font-weight:600;text-decoration:none}
.lp-link:hover{text-decoration:underline}
.lp-link .lp-ic{width:1em;height:1em}
/* 꼬리표: 알약이 아니라 작은 글자. 목록은 가운뎃점으로 잇기(한국어 표기 관례) */
.lp-chip,.lp-st-tag,.lp-schedule-part{display:inline;font-size:var(--fs-xs);font-weight:600;color:var(--muted-foreground);background:none;padding:0;border-radius:0}
.lp-tags{display:flex;flex-wrap:wrap;list-style:none;font-size:var(--fs-sm);color:var(--muted-foreground)}
.lp-tags li+li::before{content:"·";margin:0 .35em;color:color-mix(in srgb,var(--muted-foreground) 70%,transparent)}

/* 상자(꼭 필요한 곳만: 강사 콘솔 패널·보드 글·대화상자) */
.lp-card{background:var(--card);color:var(--card-foreground);border-radius:var(--radius);border:var(--border-w) solid var(--border)}
[data-card="glass"] .lp-card{background:color-mix(in srgb,var(--card) 70%,transparent);border-color:color-mix(in srgb,var(--foreground) 12%,transparent)}
[data-card="paper"] .lp-card{border-color:color-mix(in srgb,var(--foreground) 14%,transparent);box-shadow:var(--shadow)}

/* 메뉴 */
.lp-nav{position:sticky;top:0;z-index:40;padding-top:env(safe-area-inset-top,0px);background:color-mix(in srgb,var(--background) 90%,transparent);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border-bottom:1px solid var(--rule-c)}
.lp-nav-in{display:flex;align-items:center;gap:16px;max-width:1160px;margin:0 auto;padding:8px max(20px,env(safe-area-inset-right,0px)) 8px max(20px,env(safe-area-inset-left,0px))}
.lp-brand{display:inline-flex;align-items:center;gap:10px;font-weight:700;font-size:var(--fs-sm);color:var(--foreground);text-decoration:none;white-space:nowrap;max-width:16em;overflow:hidden;text-overflow:ellipsis}
.lp-brand>span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lp-brand img{border-radius:6px}
.lp-brand-dot{width:10px;height:10px;border-radius:2px;background:var(--primary);flex:none}
.lp-nav-links{display:flex;align-items:center;gap:2px;flex:1;min-width:0}
.lp-nav-scroll{display:flex;gap:2px;overflow-x:auto;scrollbar-width:none;min-width:0}
.lp-nav-scroll::-webkit-scrollbar{display:none}
.lp-nav-links a{position:relative;padding:10px 10px;color:var(--muted-foreground);text-decoration:none;font-size:var(--fs-sm);font-weight:600;white-space:nowrap;transition:color var(--dur-2)}
.lp-nav-links a:hover{color:var(--foreground)}
.lp-nav-links a[aria-current="true"]{color:var(--foreground)}
.lp-nav-links a[aria-current="true"]::after{content:"";position:absolute;left:10px;right:10px;bottom:2px;height:2px;background:var(--primary)}
.lp-nav-act{display:flex;gap:2px;margin-left:auto}
.lp-nav-act .lp-icon-btn{width:40px;height:40px}
.lp-scrollbar{position:absolute;left:0;bottom:-1px;height:2px;width:100%;transform-origin:0 50%;transform:scaleX(var(--p,0));background:var(--primary);pointer-events:none}
/* 진행 막대 효과(guided-progress)를 단 막대: 막대 자체는 줄이지 않고(안의 .fx-gp-fill이 채워짐) 머리 아래에 둠 */
.lp-nav .lp-scrollbar.fx-gp{position:absolute;top:auto;bottom:-1px;height:3px;transform:none;background:none}
/* 옆 단계 점(body에 붙음)은 본문(첫 화면 최대 1320px) 오른쪽에 자리가 남을 때만. 좁으면 숨겨 본문 글자에 겹치지 않게(숨기면 Tab도 가지 않음) */
@media (max-width:1379px){.fx-gp-steps{display:none}}

/* 첫 화면: 공통 조각. 구성(.lp-hero--이름)마다 뼈대·격자·글자 다루기가 다릅니다(render/hero.js) */
.lp-hero{min-height:min(92svh,940px);display:grid;align-content:center;overflow:hidden;overflow:clip;padding-block:clamp(72px,9vw,128px) clamp(48px,6vw,88px)}
.lp-hero > .lp-wrap,.lp-hero-strip > .lp-wrap,.lp-brief-band > .lp-wrap{max-width:1320px}
.lp-hero-graphic,.lp-hero-overlay,.lp-closing-graphic{position:absolute;inset:0;z-index:-1;pointer-events:none}
.lp-hero-overlay{z-index:0}
.lp-hero-inner{position:relative;display:grid;gap:clamp(28px,4vw,56px)}
.lp-hero-copy{display:grid;gap:var(--sp-5);justify-items:start;align-content:start;min-width:0}
.lp-hero-top{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:var(--sp-2) var(--sp-5)}
.lp-hero-org{font-size:var(--fs-sm);font-weight:600;color:var(--muted-foreground)}
.lp-hero-state{display:inline-flex;align-items:center;gap:.55em;font-size:var(--fs-sm);font-weight:700;color:var(--foreground);font-variant-numeric:tabular-nums;white-space:nowrap}
.lp-hero-state i{flex:none;width:8px;height:8px;border-radius:50%;background:var(--primary)}
[data-phase="during"] .lp-hero-state i{box-shadow:0 0 0 4px color-mix(in srgb,var(--primary) 28%,transparent)}
.lp-hero-state .lp-hero-attend{flex:none;margin-left:.3em;font-variant-numeric:normal}
.lp-hero-attend svg{width:1.05em;height:1.05em}
[data-phase="after"] .lp-hero-state i{background:var(--muted-foreground)}
.lp-h1{font-size:var(--fs-hero,var(--fs-2xl));line-height:1.1}
/* 긴 공식 연수명(hero.js titleLen): 한 단계·두 단계 낮춤(프리셋마다 정한 --fs-hero에 비율로, 너무 작아지지 않게 바닥) */
.lp-h1[data-tlen="long"]{font-size:max(1.75rem,calc(var(--fs-hero,var(--fs-2xl)) * .76))}
.lp-h1[data-tlen="xlong"]{font-size:max(1.5rem,calc(var(--fs-hero,var(--fs-2xl)) * .56));letter-spacing:-.02em}
.lp-accent{font-style:normal;color:var(--primary)}
.lp-hero-sub{font-size:var(--fs-lg);line-height:1.6;color:var(--muted-foreground);max-width:30em}
.lp-ctas{display:flex;flex-wrap:wrap;gap:10px}
.lp-hero-meta{margin:0;display:grid;gap:var(--sp-4) var(--sp-6);font-size:var(--fs-sm)}
.lp-hero-meta > div,.lp-gl{display:grid;gap:2px;align-content:start;min-width:0}
.lp-hero-meta dt,.lp-gl dt{font-size:var(--fs-xs);font-weight:600;color:var(--muted-foreground)}
.lp-hero-meta dd,.lp-gl dd{margin:0;font-weight:600;font-size:var(--fs-base);line-height:1.5}
.lp-hero-meta a{color:inherit}
.lp-gl dd{display:flex;align-items:baseline;gap:.2em;flex-wrap:wrap}
.lp-unit{font-size:var(--fs-sm);font-weight:600;color:var(--muted-foreground)}
.lp-num-t{font-size:var(--fs-h2s)}
.lp-date{display:block;font-family:var(--font-num);font-weight:var(--num-weight);font-size:var(--fs-num);line-height:1;letter-spacing:var(--display-tracking);font-variant-numeric:tabular-nums}
.lp-date-sub{display:block;margin-top:6px;font-size:var(--fs-sm);font-weight:600;color:var(--muted-foreground)}

/* 1 cinema(밤하늘 서사): 영화 첫 장면. 화면 가득한 제목, 뒤에 큰 날짜 윤곽, 아래 '한눈에 보기' 띠 */
.lp-hero--cinema{min-height:calc(100svh - 58px);align-content:stretch;grid-template-rows:minmax(0,1fr) auto;padding-block:clamp(24px,3vw,40px) 0;background:radial-gradient(90% 58% at 50% 122%,color-mix(in srgb,var(--hero-from) 52%,transparent),transparent 72%),linear-gradient(180deg,var(--background) 30%,color-mix(in srgb,var(--background) 78%,var(--hero-to)) 140%)}
.lp-hero--cinema .lp-hero-graphic{-webkit-mask-image:linear-gradient(#000 50%,transparent 96%);mask-image:linear-gradient(#000 50%,transparent 96%)}
.lp-hero--cinema .lp-hero-inner{grid-template-rows:auto minmax(0,1fr) auto;gap:clamp(20px,3vw,40px);padding-bottom:clamp(28px,4vw,56px)}
.lp-hero--cinema .lp-hero-top{padding-bottom:var(--sp-4);border-bottom:1px solid var(--rule-c)}
.lp-hero--cinema .lp-h1{--fs-hero:clamp(3rem,9.6vw,9.5rem);line-height:1.03;letter-spacing:-.04em;align-self:end;max-width:10.5em}
.lp-hero--cinema .lp-hero-foot{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:var(--sp-5) var(--sp-8);align-items:end}
.lp-cine-date{position:absolute;right:-.03em;top:.06em;z-index:-1;margin:0;font-family:var(--font-num);font-weight:var(--num-weight);font-size:clamp(7rem,28vw,27rem);line-height:.8;letter-spacing:-.06em;color:transparent;-webkit-text-stroke:1px color-mix(in srgb,var(--foreground) 15%,transparent);font-variant-numeric:tabular-nums;white-space:nowrap;-webkit-user-select:none;user-select:none}
.lp-cine-date i{font-style:normal;-webkit-text-stroke-color:color-mix(in srgb,var(--primary) 75%,transparent)}
.lp-hero-strip{position:relative;border-top:1px solid var(--rule-c);background:color-mix(in srgb,var(--background) 60%,transparent);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}
.lp-hero-strip > .lp-wrap{display:grid;grid-template-columns:auto minmax(0,1fr);gap:var(--sp-7);align-items:center;padding-block:var(--sp-5)}
.lp-strip-label{font-size:var(--fs-xs);font-weight:700;color:var(--primary)}
.lp-hero-strip .lp-hero-meta{grid-auto-flow:column;grid-auto-columns:minmax(0,auto);justify-content:space-between;gap:var(--sp-6)}
.lp-hero-strip .lp-hero-meta > div + div{padding-left:var(--sp-6);border-left:1px solid var(--rule-c)}
.lp-hero-strip .lp-num{font-size:var(--fs-h2s);font-weight:500}

/* 2 worksheet(종이 워크북): 모눈 종이 위 큰 제목(형광펜) + 실제 실습 목록이 적힌 라임 실습지 */
.lp-hero--worksheet{--mk:58%;background-image:radial-gradient(color-mix(in srgb,var(--foreground) 11%,transparent) 1px,transparent 1.5px);background-size:22px 22px}
.lp-hero--worksheet .lp-hero-inner{grid-template-columns:minmax(0,7fr) minmax(0,5fr);align-items:center;gap:clamp(32px,5vw,88px)}
.lp-hero--worksheet .lp-hero-inner.is-solo{grid-template-columns:minmax(0,1fr)}
.lp-hero--worksheet .lp-h1{--fs-hero:clamp(2.75rem,7.4vw,7.25rem);line-height:1.05;letter-spacing:-.02em}
.lp-hero--worksheet .lp-accent{color:inherit;background:linear-gradient(transparent var(--mk),var(--accent) var(--mk) 94%,transparent 94%);-webkit-box-decoration-break:clone;box-decoration-break:clone;padding-inline:.05em;margin-inline:-.05em}
.lp-hero--worksheet .lp-hero-meta{grid-template-columns:repeat(auto-fit,minmax(170px,1fr));width:100%;padding-top:var(--sp-4);border-top:var(--rule)}
.lp-wsheet{position:relative;justify-self:end;width:min(100%,430px);padding:22px 24px 18px 48px;background:var(--accent);color:var(--accent-foreground);border:1.5px solid var(--foreground);border-radius:6px;transform:rotate(2.2deg);box-shadow:-18px 14px 0 -1.5px var(--card),-18px 14px 0 0 var(--foreground)}
.lp-wsheet::after{content:"";position:absolute;left:17px;top:0;bottom:0;width:12px;background:radial-gradient(circle,var(--background) 5px,transparent 5.6px) 50% 0/12px 33.33% repeat-y}
.lp-wsheet-h{display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding-bottom:10px;border-bottom:1.5px solid currentColor}
.lp-wsheet-t{font-family:var(--font-display);font-weight:var(--display-weight);font-size:var(--fs-lg);letter-spacing:var(--display-tracking);line-height:1.2}
.lp-wsheet-d{font-family:var(--font-mono);font-size:var(--fs-xs);font-weight:600;font-variant-numeric:tabular-nums}
.lp-wsheet-list{list-style:none;display:grid}
.lp-wsheet-list li + li{border-top:1px dashed color-mix(in srgb,currentColor 42%,transparent)}
.lp-wsheet-list a,.lp-wsheet-row{display:grid;grid-template-columns:20px 1.8em minmax(0,1fr) auto;gap:8px;align-items:center;min-height:46px;padding:6px 0;color:inherit;text-decoration:none;font-weight:600;font-size:var(--fs-sm);line-height:1.35}
.lp-wsheet-list a:hover .lp-wsheet-name{text-decoration:underline;text-underline-offset:.2em}
.lp-wsheet-box{display:block;width:18px;height:18px;border:1.5px solid currentColor;border-radius:3px;background:color-mix(in srgb,var(--accent) 30%,#fff)}
.lp-wsheet-box::after{content:"";display:block;width:5px;height:10px;margin:1px 0 0 5px;border:solid currentColor;border-width:0 2px 2px 0;transform:rotate(45deg) scale(0);transition:transform var(--dur-2) var(--ease-out)}
.is-done > .lp-wsheet-box::after{transform:rotate(45deg) scale(1)}
.is-done > .lp-wsheet-name{text-decoration:line-through;text-decoration-thickness:1.5px}
.lp-wsheet-n,.lp-wsheet-min{font-family:var(--font-mono);font-size:var(--fs-xs);font-weight:600;font-variant-numeric:tabular-nums}
.lp-wsheet-n{opacity:.72}
.lp-wsheet-f{margin-top:2px;padding-top:10px;border-top:1.5px solid currentColor;font-size:var(--fs-xs);font-weight:600}

/* 3 bento(유리 실험실): 크기가 다른 칸으로 짠 요약판. 유리는 칸에만, 뒤에 은은한 빛 */
.lp-hero--bento{padding-block:clamp(20px,2.6vw,36px);background:radial-gradient(58% 48% at 10% 8%,color-mix(in srgb,var(--accent-3) 15%,transparent),transparent 70%),radial-gradient(48% 44% at 94% 18%,color-mix(in srgb,var(--accent) 15%,transparent),transparent 70%),radial-gradient(70% 60% at 50% 112%,color-mix(in srgb,var(--hero-from) 24%,transparent),transparent 70%),var(--background)}
.lp-hero--bento .lp-hero-graphic{opacity:.5}
.lp-bento{grid-template-columns:repeat(12,minmax(0,1fr));gap:14px}
.lp-tile{position:relative;display:grid;align-content:space-between;gap:var(--sp-4);min-width:0;padding:clamp(18px,2vw,26px);border-radius:var(--radius);border:1px solid color-mix(in srgb,var(--foreground) 13%,transparent);background:color-mix(in srgb,var(--card) 56%,transparent);-webkit-backdrop-filter:blur(16px) saturate(1.4);backdrop-filter:blur(16px) saturate(1.4);box-shadow:inset 0 1px 0 color-mix(in srgb,var(--foreground) 9%,transparent)}
.lp-tile-main{grid-column:1 / span 8;display:flex;flex-direction:column;align-items:flex-start;gap:var(--sp-5);min-height:clamp(380px,58svh,580px);padding:clamp(24px,3.4vw,48px);border-radius:var(--radius-lg)}
.lp-tile-main .lp-h1{margin-top:auto}
.lp-hero--bento .lp-h1{--fs-hero:clamp(2.5rem,5.7vw,5.6rem);line-height:1.08;letter-spacing:-.035em}
.lp-bento-side{grid-column:9 / -1;grid-auto-rows:minmax(0,1fr);gap:14px}
.lp-bento-side .lp-tile-when{grid-row:span 2}
.lp-bento-side .lp-date{font-size:clamp(3rem,5.4vw,5rem);font-weight:500;letter-spacing:-.05em}
.lp-bento-foot{grid-column:1 / -1;display:flex;gap:14px;margin:0}
.lp-bento-foot .lp-tile{flex:1 1 0}
.lp-bento-foot .lp-tile:first-child{flex-grow:1.4}
.lp-bento-foot .lp-tile-live{flex-grow:2.2}
.lp-tile-num .lp-num,.lp-tile-live .lp-num{font-size:var(--fs-num);font-weight:500}
.lp-tile-live dt::before{content:"";display:inline-block;width:8px;height:8px;margin-right:.55em;border-radius:50%;background:var(--success)}

/* 4 poster(놀이터): 원색 포스터. 기울어진 흰 제목 상자(딱딱한 그림자), 원색 블록, 아래 도구 이름 띠 */
.lp-hero--poster{--ink:var(--accent-2-foreground);--foreground:var(--accent-2-foreground);--muted-foreground:color-mix(in srgb,var(--accent-2-foreground) 80%,var(--accent-2));--rule-c:var(--accent-2-foreground);align-content:stretch;grid-template-rows:minmax(0,1fr) auto;padding-block:clamp(32px,4vw,56px) 0;background:var(--accent-2);color:var(--foreground)}
.lp-hero--poster .lp-hero-inner{grid-template-columns:minmax(0,8fr) minmax(0,4fr);grid-template-areas:"top top" "title blocks" "copy blocks";gap:clamp(20px,2.6vw,36px) clamp(16px,2vw,28px);align-content:center;padding-bottom:clamp(36px,5vw,64px)}
.lp-hero--poster .lp-hero-top{grid-area:top}
.lp-hero--poster .lp-hero-org{font-weight:700}
.lp-poster-title{grid-area:title;justify-self:start;max-width:100%;padding:clamp(16px,2.2vw,30px) clamp(18px,2.8vw,40px) clamp(18px,2.4vw,34px);background:var(--card);color:var(--card-foreground);border:3px solid var(--ink);border-radius:var(--radius-sm);box-shadow:10px 10px 0 var(--ink);transform:rotate(-1.6deg);transform-origin:0 100%}
.lp-hero--poster .lp-h1{--fs-hero:clamp(2.6rem,6.8vw,6.5rem);line-height:1.12;letter-spacing:-.01em}
.lp-poster-copy{grid-area:copy;display:grid;gap:var(--sp-4);justify-items:start;align-content:start;max-width:40rem;padding-top:var(--sp-3)}
.lp-hero--poster .lp-hero-sub{color:var(--foreground);font-weight:600}
.lp-hero--poster .lp-btn-ghost{background:var(--card);color:var(--card-foreground)}
.lp-poster-who{grid-auto-flow:column;justify-content:start}
.lp-poster-who > div{grid-auto-flow:column;gap:.6em;align-items:baseline}
.lp-blocks{grid-area:blocks;grid-template-columns:1fr 1fr;gap:14px;align-content:center;margin-left:clamp(-56px,-3vw,-16px);z-index:1}
.lp-block{padding:14px 16px 16px;border:3px solid var(--ink);border-radius:var(--radius-sm);box-shadow:5px 5px 0 var(--ink);background:var(--card);color:var(--card-foreground);align-content:space-between;gap:var(--sp-3)}
.lp-block dt,.lp-block .lp-unit,.lp-block .lp-date-sub{color:inherit}
.lp-block[data-k="when"]{grid-column:1 / -1;background:var(--primary);color:var(--primary-foreground);transform:rotate(1.4deg)}
.lp-block[data-k="when"] .lp-date{font-size:clamp(3rem,5.6vw,5.25rem)}
.lp-block[data-k="where"],.lp-block[data-k="done"]{grid-column:1 / -1}
.lp-block.lp-gl:nth-of-type(odd){background:var(--accent);color:var(--accent-foreground);transform:rotate(-1.2deg)}
.lp-block.lp-gl:nth-of-type(even){background:var(--accent-3);color:var(--accent-3-foreground);transform:rotate(1deg)}
.lp-block .lp-num{color:inherit}
.lp-band{border-top:3px solid var(--ink);background:var(--ink);color:var(--accent-2);overflow:hidden}
.lp-band-list{list-style:none;display:flex;flex-wrap:wrap;justify-content:center;font-family:var(--font-display);font-weight:var(--display-weight);font-size:var(--fs-lg);line-height:1.2;white-space:nowrap;padding:12px 0}
.lp-band-list.fx-marquee{flex-wrap:nowrap;justify-content:flex-start;--fx-mq-gap:0px;-webkit-mask-image:none;mask-image:none}
.lp-band-list li{display:inline-flex;align-items:center;gap:var(--sp-6);padding-left:var(--sp-6)}
.lp-band-list li::after{content:"";width:.42em;height:.42em;background:currentColor;transform:rotate(45deg)}

/* 5 quiet(숲의 숨): 넓은 여백 아래쪽에 조용한 부리 글꼴 제목, 달력 한 장, 언덕과 나이테 */
.lp-hero--quiet{min-height:min(96svh,980px);align-content:end;padding-block:clamp(120px,17vw,240px) clamp(104px,13vw,184px);background:linear-gradient(180deg,var(--background) 40%,color-mix(in srgb,var(--background) 84%,var(--accent-3)) 100%)}
.lp-hero--quiet .lp-hero-inner{grid-template-columns:minmax(0,8fr) minmax(0,3fr);gap:clamp(32px,6vw,104px);align-items:end}
.lp-hero--quiet .lp-hero-copy{gap:var(--sp-6)}
.lp-hero--quiet .lp-h1{--fs-hero:clamp(2.25rem,4.9vw,4.9rem);line-height:1.26;letter-spacing:-.012em}
.lp-quiet-meta{grid-template-columns:minmax(0,1fr);gap:0;border-top:1px solid var(--rule-c)}
.lp-quiet-meta > div{padding:var(--sp-4) 0;border-bottom:1px solid var(--rule-c)}
.lp-leaf .lp-date{font-family:var(--font-num);font-size:clamp(3.25rem,5.6vw,5.25rem);color:var(--primary)}
.lp-hills{position:absolute;inset:auto 0 0 0;height:clamp(96px,17vw,240px);z-index:-1;background:radial-gradient(62% 100% at 20% 100%,color-mix(in srgb,var(--primary) 20%,transparent) 99.4%,transparent 100%),radial-gradient(56% 76% at 80% 100%,color-mix(in srgb,var(--primary) 13%,transparent) 99.4%,transparent 100%),radial-gradient(42% 52% at 52% 100%,color-mix(in srgb,var(--primary) 10%,transparent) 99.4%,transparent 100%)}
.lp-rings{position:absolute;right:-14vw;top:-20vw;width:60vw;aspect-ratio:1;z-index:-1;border-radius:50%;background:repeating-radial-gradient(circle,transparent 0 23px,color-mix(in srgb,var(--primary) 13%,transparent) 23px 24px);-webkit-mask-image:radial-gradient(circle,#000 24%,transparent 68%);mask-image:radial-gradient(circle,#000 24%,transparent 68%)}

/* 6 brief(공식 브리핑): 남색 머리띠와 세 칸 색 막대, 제목 옆 정보 표, 아래 큰 숫자 줄 */
.lp-hero--brief{min-height:0;align-content:start;padding-block:0 clamp(48px,6vw,80px)}
.lp-brief-band{background:var(--primary);color:var(--primary-foreground)}
.lp-brief-band::after{content:"";display:block;height:6px;background:linear-gradient(90deg,var(--primary) 0 30%,var(--accent) 30% 62%,color-mix(in srgb,var(--accent) 42%,var(--background)) 62%)}
.lp-brief-band > .lp-wrap{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:4px var(--sp-5);padding-block:14px}
.lp-brief-band .lp-hero-org{color:inherit;font-weight:700}
.lp-brief-d{font-size:var(--fs-sm);font-weight:600;font-variant-numeric:tabular-nums}
.lp-hero--brief .lp-hero-inner{grid-template-columns:minmax(0,7fr) minmax(0,5fr);gap:clamp(36px,5vw,72px) clamp(32px,5vw,88px);align-items:start;padding-top:clamp(48px,6.5vw,96px)}
.lp-hero--brief .lp-h1{--fs-hero:clamp(2.25rem,4.7vw,4.4rem);line-height:1.2;letter-spacing:-.03em}
.lp-brief-table{grid-template-columns:minmax(0,1fr);gap:0;border-top:2px solid var(--foreground)}
.lp-brief-table > div{grid-template-columns:5.5em minmax(0,1fr);gap:var(--sp-4);align-items:baseline;padding:15px 0;border-bottom:1px solid var(--rule-c)}
.lp-brief-table dt{font-size:var(--fs-sm)}
.lp-brief-glance{grid-column:1 / -1;display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin:0;border-top:1px solid var(--rule-c)}
.lp-brief-glance .lp-gl{gap:var(--sp-2);padding:var(--sp-5) var(--sp-5) 0 0}
.lp-brief-glance .lp-gl + .lp-gl{padding-left:var(--sp-5);border-left:1px solid var(--rule-c)}
.lp-brief-glance .lp-num{font-size:clamp(2.75rem,5.4vw,4.75rem);color:var(--primary)}

/* 7 masthead(잉크 잡지): 겹줄 표제 띠, 화면 폭을 채우는 명조 제목, 세로 규칙선으로 나눈 세 단 */
.lp-hero--masthead{min-height:0;align-content:start;padding-block:clamp(16px,2vw,28px) clamp(56px,7vw,96px)}
.lp-hero--masthead .lp-hero-inner{gap:0}
.lp-mast{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:4px var(--sp-5);padding:10px 0;border-top:1px solid var(--foreground);border-bottom:3px double var(--foreground);font-size:var(--fs-sm)}
.lp-mast .lp-hero-org{color:var(--foreground);font-weight:700}
.lp-mast-d{font-variant-numeric:tabular-nums}
.lp-hero--masthead .lp-h1{--fs-hero:clamp(3rem,9.4vw,9.25rem);line-height:1.08;letter-spacing:-.03em;padding-block:clamp(28px,4.6vw,76px) clamp(24px,3.8vw,60px)}
.lp-mast-cols{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,4fr) minmax(0,3fr);border-top:1px solid var(--foreground)}
.lp-mast-cols > *{padding:var(--sp-5) var(--sp-6) 0}
.lp-mast-cols > :first-child{padding-left:0}
.lp-mast-cols > :last-child{padding-right:0}
.lp-mast-cols > * + *{border-left:1px solid var(--rule-c)}
.lp-standfirst{max-width:none;font-size:var(--fs-lg);line-height:1.7;color:var(--foreground)}
.lp-standfirst::first-letter{float:left;margin:.06em .12em 0 0;font-family:var(--font-display);font-weight:var(--display-weight);font-size:3.1em;line-height:.9;color:var(--primary)}
.lp-hero--masthead .lp-hero-meta{grid-template-columns:minmax(0,1fr);gap:var(--sp-3);align-content:start}
.lp-hero--masthead .lp-hero-meta > div{grid-template-columns:3.5em minmax(0,1fr);gap:var(--sp-3);align-items:baseline}
.lp-mast-act{display:grid;gap:var(--sp-4);align-content:start;justify-items:start}
.lp-mast-nums{display:flex;flex-wrap:wrap;gap:4px var(--sp-4);font-size:var(--fs-sm);color:var(--muted-foreground)}
.lp-mast-nums b{color:var(--foreground);font-variant-numeric:tabular-nums}

/* 8 sticker(도파민 팝): 화면을 채우는 통통한 제목(겹쳐 찍힌 그림자), 겹쳐 붙인 동그란 날짜 스티커 */
.lp-hero--sticker{background:radial-gradient(44vw 44vw at 104% 110%,color-mix(in srgb,var(--accent) 36%,transparent) 99.6%,transparent 100%),radial-gradient(circle,color-mix(in srgb,var(--foreground) 12%,transparent) 1.2px,transparent 1.7px) 0 0/20px 20px,var(--background)}
.lp-hero--sticker .lp-hero-inner{gap:clamp(18px,2.6vw,32px)}
.lp-hero--sticker .lp-hero-top{justify-content:flex-start}
.lp-hero--sticker .lp-h1{--fs-hero:clamp(3.25rem,10.6vw,10.25rem);line-height:1.04;letter-spacing:-.01em;text-shadow:.04em .045em 0 var(--accent);max-width:9.5em}
.lp-stickers{position:absolute;right:0;top:clamp(-8px,1vw,24px);margin:0}
.lp-stk{display:grid;place-content:center;justify-items:center;gap:4px;text-align:center;border:var(--border-w) solid var(--foreground);box-shadow:5px 6px 0 var(--foreground)}
.lp-stk dt{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.lp-stk dd{margin:0;display:grid;justify-items:center}
.lp-stk-date{width:clamp(8.5rem,15.5vw,14rem);aspect-ratio:1;border-radius:50%;background:var(--primary);color:var(--primary-foreground);transform:rotate(9deg);outline:2px dashed color-mix(in srgb,var(--primary-foreground) 62%,transparent);outline-offset:-11px}
.lp-stk-date .lp-date{font-size:clamp(2.1rem,3.9vw,3.9rem)} /* 기운 동그라미 안에 날짜가 다 들어가게(1280에서 화면 끝을 넘던 것) */
.lp-stk-date .lp-date-sub{color:inherit;line-height:1.35}
.lp-stk-num{position:absolute;right:clamp(7rem,13vw,12rem);top:clamp(6.5rem,11.5vw,10.5rem);width:clamp(6rem,9.6vw,8.75rem);aspect-ratio:1;border-radius:30%;background:var(--accent-3);color:var(--accent-3-foreground);transform:rotate(-10deg)}
.lp-stk-num dd{grid-auto-flow:column;align-items:baseline;gap:.15em}
.lp-stk-num .lp-num,.lp-stk-num .lp-unit{color:inherit}
.lp-pop-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:var(--sp-5) var(--sp-8);align-items:end;padding-top:var(--sp-5);border-top:var(--border-w) solid var(--foreground)}
.lp-pop-meta{grid-template-columns:repeat(auto-fit,minmax(200px,max-content));gap:var(--sp-3) var(--sp-8)}

/* 9 board(칠판 교실): 나무 틀 칠판에 분필 제목과 밑줄, 오늘의 차례, 분필 받침. 칠판 아래 버튼과 정보 */
.lp-hero--board{padding-block:clamp(28px,3.6vw,52px) clamp(40px,5vw,64px);background:color-mix(in srgb,var(--background) 93%,var(--foreground))}
.lp-hero--board .lp-hero-inner{gap:var(--sp-5)}
.lp-chalk{--background:#1f3a30;--foreground:#eef2e9;--muted-foreground:#bccabd;--primary:#f2d35e;--accent:#ff9a85;--rule-c:rgba(238,242,233,.24);position:relative;isolation:isolate;display:grid;grid-template-columns:minmax(0,7fr) minmax(0,4fr);gap:clamp(24px,4vw,64px);min-height:clamp(360px,56svh,560px);padding:clamp(28px,4.6vw,68px) clamp(22px,4.6vw,68px) clamp(60px,6.4vw,92px);color:var(--foreground);background:radial-gradient(80% 60% at 28% 18%,rgba(255,255,255,.055),transparent 70%),radial-gradient(60% 50% at 82% 84%,rgba(255,255,255,.04),transparent 70%),var(--background);border:clamp(8px,1vw,14px) solid #8a5a33;border-radius:10px;box-shadow:inset 0 0 0 2px rgba(0,0,0,.28),inset 0 0 64px rgba(0,0,0,.26),0 22px 44px -22px rgba(0,0,0,.5)}
.lp-chalk.is-solo{grid-template-columns:minmax(0,1fr)}
.lp-chalk > .lp-hero-graphic{opacity:.75}
.lp-chalk-main{display:grid;gap:var(--sp-4);justify-items:start;align-content:center;min-width:0}
.lp-hero--board .lp-h1{--fs-hero:clamp(2.4rem,5.3vw,5rem);line-height:1.18;letter-spacing:-.005em}
.lp-chalk-line{display:block;width:min(100%,24rem);height:14px;margin-top:-4px;overflow:visible}
.lp-chalk-line path{fill:none;stroke:var(--primary);stroke-width:4;stroke-linecap:round;opacity:.92}
.lp-chalk-agenda{align-self:center;display:grid;gap:var(--sp-3);min-width:0;padding-left:clamp(20px,3vw,44px);border-left:1.5px dashed var(--rule-c)}
.lp-chalk-k{font-family:var(--font-display);font-weight:var(--display-weight);font-size:var(--fs-lg);color:var(--primary)}
.lp-chalk-agenda ol{list-style:none;display:grid;gap:10px}
.lp-chalk-agenda li{display:grid;grid-template-columns:minmax(3.3em,max-content) minmax(0,1fr);gap:var(--sp-3);align-items:baseline;font-weight:600;line-height:1.45}
.lp-chalk-t{font-family:var(--font-mono);font-size:var(--fs-sm);color:var(--muted-foreground);font-variant-numeric:tabular-nums;white-space:nowrap} /* 글자 크게(200%)에서도 시각이 '14:/00'으로 접히지 않게 */
.lp-chalk-more{font-size:var(--fs-sm);color:var(--muted-foreground)}
.lp-chalk-tray{position:absolute;left:0;right:0;bottom:0;height:16px;display:flex;align-items:flex-end;gap:12px;padding-inline:clamp(22px,4.6vw,68px);background:linear-gradient(#a06f41,#7b4f2a);border-top:1px solid rgba(0,0,0,.4)}
.lp-chalk-tray i{display:block;width:40px;height:9px;border-radius:2px;background:#f4f1e8;transform:translateY(-16px)}
.lp-chalk-tray i:nth-child(2){width:30px;background:#f2d35e;transform:translateY(-16px) rotate(-5deg)}
.lp-chalk-tray i:nth-child(3){width:22px;background:#ff9a85}
.lp-chalk-tray b{display:block;width:66px;height:22px;margin-left:auto;border-radius:3px;background:linear-gradient(#c9a274 46%,#2c2c2c 46%);transform:translateY(-16px)}
.lp-chalk-under{display:grid;grid-template-columns:auto minmax(0,1fr);gap:var(--sp-4) var(--sp-8);align-items:center}
.lp-chalk-under .lp-hero-meta{grid-template-columns:repeat(auto-fit,minmax(170px,1fr))}

/* 10 spec(설계도): 도면 틀. 제목 아래 치수선(연수 시간), 오른쪽에 고정폭 이름표의 표제란 */
.lp-hero--spec{--ln:color-mix(in srgb,var(--primary) 46%,transparent);padding-block:clamp(36px,4.6vw,68px);background-image:linear-gradient(color-mix(in srgb,var(--primary) 7%,transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb,var(--primary) 7%,transparent) 1px,transparent 1px);background-size:96px 96px;background-position:-1px -1px}
.lp-hero--spec > .lp-hero-inner{grid-template-columns:minmax(0,7fr) minmax(0,5fr);gap:0;width:calc(100% - 40px);padding-inline:0;border:1px solid var(--ln)}
.lp-spec-id{grid-column:1 / -1;display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:4px var(--sp-5);margin:0;padding:10px clamp(16px,2.4vw,28px);border-bottom:1px solid var(--ln);font-family:var(--font-mono);font-size:var(--fs-xs);color:var(--muted-foreground);background:color-mix(in srgb,var(--background) 86%,transparent)}
.lp-spec-id .lp-hero-org{font:inherit;color:var(--foreground)}
.lp-spec-id .lp-hero-state{font:inherit;font-weight:600;color:var(--primary)}
.lp-hero--spec .lp-hero-copy{align-content:center;gap:var(--sp-5);padding:clamp(32px,5vw,72px) clamp(16px,2.6vw,36px)}
.lp-hero--spec .lp-h1{--fs-hero:clamp(2.5rem,5.7vw,5.6rem);line-height:1.12;letter-spacing:-.035em}
.lp-spec-dim{position:relative;width:100%;max-width:27rem;margin:0;padding-top:10px;border-top:1px solid var(--primary);font-family:var(--font-mono);font-size:var(--fs-xs);font-weight:500;color:var(--primary);font-variant-numeric:tabular-nums}
.lp-spec-dim::before,.lp-spec-dim::after{content:"";position:absolute;top:-6px;width:1px;height:11px;background:var(--primary)}
.lp-spec-dim::before{left:0}
.lp-spec-dim::after{right:0}
.lp-spec{display:flex;flex-wrap:wrap;align-content:stretch;gap:1px;background:var(--ln);border-left:1px solid var(--ln)}
.lp-spec-c{flex:1 1 calc(50% - 1px);align-content:space-between;gap:var(--sp-3);padding:16px clamp(14px,1.8vw,22px);background:var(--background)}
.lp-spec-c[data-k="when"],.lp-spec-c[data-k="where"],.lp-spec-c[data-k="aud"],.lp-spec-c[data-k="prep"]{flex-basis:100%}
.lp-spec-c dt{font-family:var(--font-mono);font-weight:500}
.lp-spec-n .lp-num{font-size:var(--fs-num);font-weight:500}

/* 11 zine(형광 인쇄): 두 색 잉크. 판이 어긋난 굵은 제목, 망점 원, 비스듬한 도장, 고정폭 정보 줄 */
.lp-hero--zine{--ink2:var(--accent);padding-block:clamp(40px,5vw,72px) clamp(48px,6vw,88px)}
.lp-halftone{position:absolute;right:-5vw;top:-9vw;width:min(56vw,720px);aspect-ratio:1;z-index:-1;border-radius:50%;background:radial-gradient(circle,var(--accent) 33%,transparent 35%) 0 0/14px 14px,radial-gradient(circle,var(--accent-3) 26%,transparent 28%) 6px 5px/14px 14px;-webkit-mask-image:radial-gradient(circle,#000 30%,transparent 70%);mask-image:radial-gradient(circle,#000 30%,transparent 70%)}
.lp-hero--zine .lp-hero-inner{gap:clamp(18px,2.8vw,36px)}
.lp-zine-top{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:4px var(--sp-5);padding-bottom:10px;border-bottom:var(--border-w) solid var(--foreground);font-family:var(--font-mono);font-size:var(--fs-sm)}
.lp-zine-top .lp-hero-org,.lp-zine-top .lp-hero-state{font:inherit;font-weight:600;color:var(--foreground)}
.lp-zine-d{font-variant-numeric:tabular-nums}
.lp-hero--zine .lp-h1{--fs-hero:clamp(3rem,9vw,8.9rem);line-height:1.08;letter-spacing:-.012em;color:var(--primary);text-shadow:-.034em .03em 0 color-mix(in srgb,var(--accent) 84%,transparent);max-width:10em}
.lp-hero--zine .lp-accent{color:var(--foreground);text-shadow:.03em -.026em 0 var(--accent-3)}
.lp-stamp{justify-self:end;display:flex;gap:var(--sp-5);margin:clamp(-64px,-5vw,-20px) clamp(0px,3vw,48px) 0 0;padding:12px 20px 14px;border:3px double var(--accent);border-radius:8px;transform:rotate(-6deg);background:color-mix(in srgb,var(--background) 70%,transparent)}
.lp-stamp .lp-gl + .lp-gl{padding-left:var(--sp-5);border-left:1px solid var(--accent)}
.lp-stamp .lp-num{font-size:var(--fs-num);color:var(--primary)}
.lp-stamp .lp-gl{gap:6px}
.lp-stamp .lp-num.lp-num-t{font-size:var(--fs-h2s);line-height:1.2} /* 글이 섞인 값(2시간 30분)은 한 단계 작게, 위 이름표와 겹치지 않게 */
.lp-zine-row{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,6fr);gap:var(--sp-5) var(--sp-8);align-items:end;padding-top:var(--sp-5);border-top:var(--border-w) solid var(--foreground)}
.lp-zine-copy{display:grid;gap:var(--sp-5);justify-items:start}
.lp-hero--zine .lp-hero-meta{grid-template-columns:repeat(auto-fit,minmax(170px,1fr))}
.lp-hero--zine .lp-hero-meta dt{font-family:var(--font-mono)}

/* 12 invite(새벽빛): 초대장. 왼쪽 날짜 기둥과 세로 규칙선, 바탕 글꼴 제목, 지평선 위로 떠오르는 해 */
.lp-hero--invite{min-height:min(94svh,960px);background:linear-gradient(180deg,color-mix(in srgb,var(--hero-to) 30%,var(--background)) 0%,var(--background) 48%,color-mix(in srgb,var(--hero-from) 34%,var(--background)) 100%);border-bottom:1px solid color-mix(in srgb,var(--foreground) 28%,transparent)}
.lp-sun{position:absolute;right:clamp(-120px,3vw,96px);bottom:0;width:min(48vw,640px);aspect-ratio:2/1;z-index:-1;overflow:hidden}
.lp-sun i{position:absolute;inset:0 0 auto 0;aspect-ratio:1;border-radius:50%;background:radial-gradient(circle at 50% 38%,color-mix(in srgb,var(--hero-from) 62%,#fff) 0%,var(--hero-from) 58%,color-mix(in srgb,var(--primary) 62%,var(--hero-from)) 100%)}
.lp-sun::before{content:"";position:absolute;inset:-34% -17% auto -17%;aspect-ratio:1;border-radius:50%;border:1px solid color-mix(in srgb,var(--primary) 34%,transparent);box-shadow:0 0 0 clamp(28px,4vw,56px) color-mix(in srgb,var(--hero-from) 16%,transparent)}
.lp-hero--invite .lp-sun{overflow:visible;-webkit-clip-path:inset(-60% -30% 0 -30%);clip-path:inset(-60% -30% 0 -30%)}
.lp-hero--invite .lp-hero-inner{grid-template-columns:auto minmax(0,1fr);gap:clamp(24px,4vw,64px)}
.lp-hero--invite .lp-hero-inner.is-solo{grid-template-columns:minmax(0,1fr)}
.lp-invite-date{margin:0;padding-right:clamp(20px,3.4vw,56px);border-right:1px solid color-mix(in srgb,var(--foreground) 32%,transparent)}
.lp-invite-date time{display:grid;gap:4px;justify-items:start;font-family:var(--font-display);font-weight:var(--display-weight)}
.lp-invite-date b{font-weight:var(--num-weight);font-family:var(--font-num);font-size:clamp(5rem,11.4vw,11rem);line-height:.88;letter-spacing:-.04em;color:var(--primary);font-variant-numeric:lining-nums}
.lp-invite-m,.lp-invite-w{font-size:var(--fs-lg);line-height:1.3}
.lp-invite-t{margin-top:var(--sp-2);font-family:var(--font-mono);font-weight:500;font-size:var(--fs-sm);color:var(--muted-foreground);font-variant-numeric:tabular-nums}
.lp-hero--invite .lp-hero-copy{max-width:46rem;align-content:center}
.lp-hero--invite .lp-h1{--fs-hero:clamp(2.5rem,5.7vw,5.5rem);line-height:1.22;letter-spacing:-.018em}
.lp-hero--invite .lp-hero-meta{grid-template-columns:repeat(auto-fit,minmax(180px,max-content));gap:var(--sp-3) var(--sp-8);width:100%;padding-top:var(--sp-4);border-top:1px solid var(--rule-c)}

/* 13 keynote(어두운 키노트): 위에서 떨어지는 무대 조명, 화면 가득한 제목(둘째 줄은 한 톤 낮게), 지평선 불빛과 정보 레일 */
.lp-hero--keynote{min-height:calc(100svh - 58px);align-content:stretch;padding-block:clamp(24px,3vw,40px) clamp(28px,3.4vw,48px);background:radial-gradient(64% 50% at 50% -8%,color-mix(in srgb,var(--primary) 36%,transparent),transparent 72%),var(--background)}
.lp-key-light{position:absolute;inset:auto 0 0 0;height:1px;background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--primary) 80%,var(--foreground)) 50%,transparent);box-shadow:0 0 90px 26px color-mix(in srgb,var(--primary) 28%,transparent)}
.lp-hero--keynote .lp-hero-inner{grid-template-rows:auto minmax(0,1fr) auto;gap:clamp(20px,3vw,40px)}
.lp-key-top{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:var(--sp-2) var(--sp-5)}
.lp-key-title{display:grid;gap:var(--sp-5);justify-items:start;align-content:center;min-width:0}
.lp-hero--keynote .lp-h1{--fs-hero:clamp(3rem,8.6vw,8.75rem);line-height:1.05;letter-spacing:-.04em;max-width:11em}
.lp-hero--keynote .lp-accent{color:color-mix(in srgb,var(--foreground) 50%,var(--background))}
.lp-key-rail{grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:0;padding-top:var(--sp-5);border-top:1px solid var(--rule-c)}
.lp-key-rail > div{padding-right:var(--sp-5)}
.lp-key-rail > div + div{padding-left:var(--sp-5);border-left:1px solid var(--rule-c)}
.lp-key-rail .lp-num{font-size:var(--fs-h2s)}
/* 14 panel(깔끔한 기업형): 제목 옆에 겹쳐 놓인 오늘의 일정 카드 */
.lp-hero--panel{background:linear-gradient(180deg,color-mix(in srgb,var(--hero-from) 60%,var(--background)),var(--background) 72%)}
.lp-hero--panel .lp-hero-inner{grid-template-columns:minmax(0,7fr) minmax(0,5fr);gap:clamp(32px,5vw,88px);align-items:center}
.lp-hero--panel .lp-hero-inner.is-solo{grid-template-columns:minmax(0,1fr)}
.lp-hero--panel .lp-h1{--fs-hero:clamp(2.5rem,5.4vw,5.25rem);line-height:1.14;letter-spacing:-.04em}
.lp-hero--panel .lp-hero-meta{grid-template-columns:repeat(auto-fit,minmax(170px,1fr));width:100%;padding-top:var(--sp-4);border-top:var(--rule)}
.lp-panel-card{position:relative;justify-self:end;width:min(100%,440px);padding:clamp(20px,2.2vw,30px);background:var(--card);color:var(--card-foreground);border:1px solid var(--rule-c);border-radius:var(--radius-lg);box-shadow:0 1px 2px rgba(10,37,64,.06),0 28px 56px -24px rgba(10,37,64,.32)}
.lp-panel-card::before{content:"";position:absolute;inset:20px -16px -16px 20px;z-index:-1;border-radius:inherit;background:color-mix(in srgb,var(--primary) 16%,var(--background))}
.lp-panel-h{display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding-bottom:var(--sp-3);border-bottom:1px solid var(--rule-c)}
.lp-panel-h b{font-size:var(--fs-md)}
.lp-panel-h time{font-family:var(--font-mono);font-size:var(--fs-xs);color:var(--muted-foreground);font-variant-numeric:tabular-nums}
.lp-panel-card ol{list-style:none;display:grid}
.lp-panel-card li{display:grid;grid-template-columns:3.7em minmax(0,1fr);gap:var(--sp-3);align-items:baseline;padding:var(--sp-3) 0;font-weight:600;line-height:1.45}
.lp-panel-card li + li{border-top:1px solid var(--rule-c)}
.lp-panel-t{font-family:var(--font-num);font-weight:var(--num-weight);color:var(--primary);font-variant-numeric:tabular-nums}
.lp-panel-more{padding-top:var(--sp-3);border-top:1px solid var(--rule-c);font-size:var(--fs-sm);color:var(--muted-foreground)}
/* 15 soft(부드러운 파스텔): 아치·원·알약 도형, 아치 안의 날짜 */
.lp-hero--soft{background:linear-gradient(180deg,color-mix(in srgb,var(--hero-from) 46%,var(--background)),var(--background) 64%)}
.lp-hero--soft .lp-hero-inner{grid-template-columns:minmax(0,7fr) minmax(0,5fr);gap:clamp(24px,4vw,64px);align-items:center}
.lp-hero--soft .lp-h1{--fs-hero:clamp(2.5rem,5.6vw,5.4rem);line-height:1.18;letter-spacing:-.03em}
.lp-hero--soft .lp-hero-meta{grid-template-columns:repeat(auto-fit,minmax(170px,max-content));gap:var(--sp-3) var(--sp-7)}
.lp-soft-art{position:relative;justify-self:end;width:min(100%,440px);aspect-ratio:1}
.lp-soft-art i{position:absolute;display:block}
.lp-soft-art i:nth-child(1){inset:0 18% 22% 0;border-radius:999px 999px 28px 28px;background:var(--accent)}
.lp-soft-art i:nth-child(2){right:0;top:8%;width:44%;aspect-ratio:1;border-radius:50%;background:var(--accent-2)}
.lp-soft-art i:nth-child(3){left:10%;right:0;bottom:0;height:26%;border-radius:999px;background:var(--accent-3)}
.lp-soft-date{position:absolute;left:0;right:18%;top:27%;margin:0;text-align:center;color:var(--accent-foreground)}
.lp-soft-date time{display:grid;gap:6px}
.lp-soft-date b{font-family:var(--font-num);font-weight:var(--num-weight);font-size:clamp(3rem,6vw,5.6rem);line-height:1;letter-spacing:-.04em;font-variant-numeric:tabular-nums}
.lp-soft-date span{font-size:var(--fs-sm);font-weight:700}
/* 16 ticker(움직이는 글자): 넘치는 제목과 윤곽선 메아리 줄, 굵은 선의 정보 칸 */
.lp-hero--ticker{min-height:0;align-content:start;padding-block:clamp(20px,2.6vw,36px) clamp(40px,5vw,72px)}
.lp-hero--ticker .lp-hero-inner{gap:0}
.lp-hero--ticker .lp-hero-top{padding-bottom:var(--sp-3);border-bottom:max(3px,var(--border-w)) solid var(--foreground)}
.lp-hero--ticker .lp-h1{--fs-hero:clamp(3.25rem,11vw,11.25rem);line-height:1;letter-spacing:-.04em;padding-top:clamp(16px,2.4vw,36px)}
.lp-kin-echo{margin:clamp(4px,1vw,14px) 0 clamp(20px,3vw,44px);overflow:hidden;white-space:nowrap;font-family:var(--font-display);font-weight:var(--display-weight);font-size:clamp(2rem,5.6vw,5.5rem);line-height:1.12;letter-spacing:-.04em;color:color-mix(in srgb,var(--foreground) 14%,transparent);-webkit-user-select:none;user-select:none} /* 한글 윤곽선은 획이 겹쳐 보여 옅은 채움 */
.lp-kin-echo span{display:inline-block;padding-left:max(20px,env(safe-area-inset-left,0px))}
.lp-kin-foot{position:relative;display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:var(--sp-5) var(--sp-8);align-items:start}
.lp-kin-foot > .lp-hero-sub,.lp-kin-foot > .lp-ctas{grid-column:1}
.lp-kin-meta{grid-column:2;grid-row:1 / span 2;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 var(--sp-6)}
.lp-kin-meta > div{padding:var(--sp-3) 0 var(--sp-4);border-top:max(3px,var(--border-w)) solid var(--foreground)}
/* 17 column(따뜻한 미니멀): 넓은 여백, 명조 제목, 가는 큰 날짜 하나, 점선으로 이은 정보 */
.lp-hero--column{min-height:min(88svh,880px);align-content:stretch;padding-block:clamp(20px,2.6vw,36px) clamp(40px,5vw,72px)}
.lp-hero--column .lp-hero-inner{grid-template-columns:minmax(0,7fr) minmax(0,5fr);grid-template-rows:auto minmax(0,1fr);gap:clamp(28px,4vw,56px) clamp(32px,6vw,104px)}
.lp-min-rule{grid-column:1 / -1;display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:var(--sp-2) var(--sp-5);padding-bottom:var(--sp-3);border-bottom:1px solid var(--foreground)}
.lp-hero--column .lp-hero-copy{align-content:end;gap:var(--sp-6)}
.lp-hero--column .lp-h1{--fs-hero:clamp(2.4rem,4.8vw,4.6rem);line-height:1.26;letter-spacing:-.02em}
.lp-min-side{display:grid;align-content:space-between;gap:var(--sp-6);min-width:0}
.lp-min-date{margin:0;justify-self:end;font-family:var(--font-num);font-weight:400;font-size:clamp(7rem,17vw,16rem);line-height:.8;letter-spacing:-.05em;color:var(--primary);font-variant-numeric:lining-nums}
.lp-min-meta{grid-template-columns:minmax(0,1fr);gap:0}
.lp-min-meta > div{grid-template-columns:4em minmax(0,1fr);gap:var(--sp-3);align-items:baseline;padding:var(--sp-3) 0;border-top:1px dotted color-mix(in srgb,var(--foreground) 42%,transparent)}
[data-preset="corporate-clean"] .lp-head-no{font-size:var(--fs-h2s);color:var(--primary);-webkit-text-stroke:0}
@media (max-width:900px){
  .lp-hero--panel .lp-hero-inner,.lp-hero--soft .lp-hero-inner,.lp-hero--column .lp-hero-inner,.lp-kin-foot{grid-template-columns:minmax(0,1fr)}
  .lp-kin-meta{grid-column:1;grid-row:auto}
  .lp-panel-card,.lp-soft-art{justify-self:start}
  .lp-soft-art{width:min(100%,340px)}
  .lp-key-rail{grid-auto-flow:row;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--sp-4) var(--sp-5)}
  .lp-key-rail > div,.lp-key-rail > div + div{padding:0;border-left:0}
  .lp-min-date{justify-self:start;font-size:clamp(5rem,26vw,8rem)}
}
@media (max-width:600px){
  .lp-hero--keynote{min-height:calc(100svh - 62px)}
  .lp-hero--column{min-height:0}
  .lp-panel-card::before{inset:12px -8px -8px 12px}
}
@media (prefers-reduced-motion:no-preference){@supports (animation-timeline:view()){
  html:is([data-motion="2"],[data-motion="3"]):not(.lp-paused):not(.fx-paused) .lp-kin-echo span{animation:lp-kin-run linear both;animation-timeline:scroll(root);animation-range:0 130vh}
}}
@keyframes lp-kin-run{to{transform:translate3d(-24%,0,0)}}

/* ── 살아 있는 첫 화면(쇼케이스) ───────────────────────────────────────
   글은 HTML 그대로, 그림은 서버가 정지 모습으로 먼저 그려 둡니다. 효과(runtime/fx)가 실리면 기울기·넘기기·그려지기·지금 바늘·회전·물살이 더해집니다.
   공통 뼈대(.lp-show): 넓은 화면은 글·정보 왼쪽에 그림 오른쪽, 좁은 화면은 글 → 그림 → 정보(그림이 제목·버튼을 덮지 않음) */
.lp-show{grid-template-columns:minmax(0,6fr) minmax(0,6fr);grid-template-areas:"copy art" "meta art";gap:var(--sp-6) clamp(24px,4vw,72px);align-items:center}
.lp-show.is-solo{grid-template-columns:minmax(0,1fr);grid-template-areas:"copy" "meta"}
.lp-show > .lp-hero-copy{grid-area:copy;align-self:end}
.lp-show > .lp-hero-meta{grid-area:meta;align-self:start;grid-template-columns:repeat(auto-fit,minmax(150px,max-content));gap:var(--sp-3) var(--sp-7);padding-top:var(--sp-5);border-top:var(--rule)}
.lp-show > :is(.lp-fan,.lp-dial,.lp-orbit,.lp-stream){grid-area:art}
.lp-show .lp-h1{--fs-hero:clamp(2.6rem,5.6vw,5.5rem);line-height:1.1;letter-spacing:-.04em}
/* 18 collage(펼친 교재): 교재 쪽 3D 부채. 장마다 제 색, 맨 위 장만 제목을 보이고 뒤 장은 쪽 번호만.
   목록 상자는 누름을 받지 않음(pointer-events:none): 3D 공간에서 목록 면이 뒤로 물러난 장들 앞에 있어 뒤 장을 누를 수 없게 되기 때문 */
.lp-hero--collage{background:radial-gradient(60% 70% at 86% 40%,color-mix(in srgb,var(--hero-from) 70%,transparent),transparent 70%),radial-gradient(40% 50% at 70% 96%,color-mix(in srgb,var(--hero-to) 80%,transparent),transparent 70%),var(--background)}
.lp-fan{position:relative;justify-self:center;width:min(100%,580px);aspect-ratio:1/.7;perspective:1400px}
.lp-fan-list{list-style:none;position:absolute;inset:0;pointer-events:none;transform-style:preserve-3d;transform:translate3d(0,calc(var(--sy,0) * -28px),0) rotateX(calc(8deg - var(--ty,0) * 6deg)) rotateY(calc(-13deg + var(--tx,0) * 8deg));transition:transform .6s var(--ease-out)}
.lp-fan-card{position:absolute;left:1%;top:25%;width:60%;aspect-ratio:16/10;pointer-events:auto;z-index:calc(10 - var(--i));transform-origin:10% 100%;transform:translate3d(calc(var(--i) * (9.5% + var(--sy,0) * 1.5%)),calc(var(--i) * (-5% - var(--sy,0) * 2%)),calc(var(--i) * -46px)) rotateZ(calc(var(--i) * 6deg - 7deg));transition:transform .7s var(--ease-out)}
.lp-fan-face{position:relative;display:grid;align-content:space-between;width:100%;height:100%;padding:6% 4.5% 6.5% 7.5%;overflow:hidden;background:var(--card);color:var(--card-foreground);border:1px solid var(--rule-c);border-radius:clamp(10px,1.2vw,16px);box-shadow:0 30px 54px -30px rgba(10,8,30,.5),-14px 6px 26px -18px rgba(10,8,30,.38);text-decoration:none}
.lp-fan-face img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.lp-fan-card:nth-child(5n+1) .lp-fan-face{background:color-mix(in srgb,var(--band-primary,var(--primary)) var(--band-mix,100%),var(--card));color:var(--band-fg,var(--primary-foreground));border-color:transparent}
.lp-fan-card:nth-child(5n+3) .lp-fan-face{background:var(--accent);color:var(--accent-foreground);border-color:transparent}
.lp-fan-card:nth-child(5n) .lp-fan-face{background:var(--accent-2);color:var(--accent-2-foreground);border-color:transparent}
.lp-fan-card .lp-fan-face:has(> img){background:var(--card);border-color:var(--rule-c)}
.lp-fan-pg{justify-self:end;font-family:var(--font-num);font-weight:var(--num-weight);font-size:clamp(.95rem,1.5vw,1.3rem);line-height:1;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.lp-fan-face b{max-width:11em;font-family:var(--font-display);font-weight:var(--display-weight);font-size:clamp(1.05rem,2vw,1.75rem);line-height:1.25;letter-spacing:var(--display-tracking);text-wrap:balance;opacity:0;transition:opacity .35s}
.lp-fan:not(.fx-fan) .lp-fan-card:first-child b,.lp-fan-card.is-top b{opacity:1}
.lp-fan-face:focus-visible{outline:3px solid var(--ring);outline-offset:3px}
.lp-fan-next{position:absolute;left:1%;bottom:0;z-index:20;background:var(--card)}
/* 19 dial(하루 시계): 일정 시계 + 목록 */
.lp-hero--dial{background:radial-gradient(52% 60% at 78% 40%,color-mix(in srgb,var(--hero-from) 46%,transparent),transparent 72%),var(--background)}
.lp-dial{display:grid;grid-template-columns:minmax(0,1fr);gap:var(--sp-6);justify-items:center;min-width:0}
.lp-dial-ring{position:relative;width:min(100%,410px);aspect-ratio:1}
.lp-dial-ring svg{display:block;width:100%;height:100%;overflow:visible}
.lp-dial-track{fill:none;stroke:color-mix(in srgb,var(--foreground) 8%,transparent);stroke-width:22}
.lp-dial-bezel{fill:none;stroke:color-mix(in srgb,var(--foreground) 50%,transparent);stroke-width:8}
.lp-dial-seg{fill:none;stroke:var(--primary);stroke-width:22;stroke-linecap:butt;cursor:pointer;pointer-events:stroke;transition:stroke-width var(--dur-2),opacity var(--dur-2)}
.lp-dial-seg:nth-child(even){stroke:color-mix(in srgb,var(--primary) 52%,var(--accent-2))}
.lp-dial-seg.is-rest{stroke:color-mix(in srgb,var(--foreground) 26%,transparent)}
.lp-dial.has-hot .lp-dial-seg:not(.is-hot){opacity:.35}
.lp-dial-seg.is-hot,.lp-dial-seg.is-now{stroke-width:30}
.lp-dial-seg.is-done{opacity:.3}
.lp-dial-ticks text{font-family:var(--font-mono);font-size:12px;fill:var(--muted-foreground);text-anchor:middle;font-variant-numeric:tabular-nums}
.lp-dial-hand{stroke:var(--accent);stroke-width:4;stroke-linecap:round;opacity:0}
.lp-dial.is-live .lp-dial-hand{opacity:1}
.lp-dial-center{position:absolute;inset:27%;display:grid;place-content:center;justify-items:center;gap:2px;margin:0;text-align:center;pointer-events:none}
.lp-dial-center b{font-family:var(--font-num);font-weight:var(--num-weight);font-size:clamp(3rem,7vw,5.5rem);line-height:.9;letter-spacing:-.05em;font-variant-numeric:tabular-nums}
.lp-dial-center b.lp-dial-dt{font-size:var(--fs-h2s);letter-spacing:-.03em}
.lp-dial-center span{font-size:var(--fs-md);font-weight:700}
.lp-dial-center small{margin-top:6px;font-family:var(--font-mono);font-size:var(--fs-xs);color:var(--muted-foreground);font-variant-numeric:tabular-nums}
.lp-dial-center em{font-style:normal;font-weight:700;font-size:var(--fs-md);line-height:1.35;text-wrap:balance}
.lp-dial-list{list-style:none;display:grid;grid-auto-flow:column;grid-template-rows:repeat(var(--r,3),auto);grid-auto-columns:minmax(0,1fr);gap:0 var(--sp-6);width:100%;border-bottom:1px solid var(--rule-c)}
.lp-dial-list a{display:grid;grid-template-columns:3.4em minmax(0,1fr) auto;gap:var(--sp-3);align-items:baseline;height:100%;min-height:40px;padding:8px 0;border-top:1px solid var(--rule-c);color:inherit;text-decoration:none;font-size:var(--fs-sm);font-weight:600;line-height:1.4}
.lp-dial-list time{font-family:var(--font-mono);font-weight:500;color:var(--primary);font-variant-numeric:tabular-nums}
.lp-dial-list small{font-size:var(--fs-xs);font-weight:500;color:var(--muted-foreground);font-variant-numeric:tabular-nums}
.lp-dial-list li.is-hot a,.lp-dial-list a:hover{color:var(--primary)}
/* 효과가 실리면: 화면에 들어올 때 호가 차례로 그려짐 */
.lp-dial[data-fx-pre] .lp-dial-seg{stroke-dasharray:0 1000}
.lp-dial[data-fx-pre] :is(.lp-dial-ticks,.lp-dial-center,.lp-dial-bezel){opacity:0}
.lp-dial[data-fx-in] .lp-dial-seg{transition:stroke-dasharray .9s var(--ease-out) calc(var(--i) * 110ms),stroke-width var(--dur-2),opacity var(--dur-2)}
.lp-dial[data-fx-in] :is(.lp-dial-ticks,.lp-dial-center,.lp-dial-bezel){transition:opacity .6s ease .5s}
/* 20 orbit(입체 궤도): 점으로 짠 입체 매듭 + 둘레를 도는 낱말 */
.lp-hero--orbit{background:radial-gradient(44% 54% at 76% 46%,color-mix(in srgb,var(--hero-from) 62%,transparent),transparent 72%),var(--background)}
.lp-hero--orbit .lp-h1{--fs-hero:clamp(2.5rem,5vw,4.9rem);letter-spacing:-.03em}
.lp-orbit{position:relative;justify-self:center;width:min(100%,600px);aspect-ratio:1}
.lp-orbit svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.lp-orbit path{fill:none;stroke-linecap:round}
.lp-orbit-ring{stroke:var(--foreground);stroke-width:2.2;stroke-dasharray:.1 14;opacity:.4}
.lp-orbit-p{stroke:var(--primary)}
.lp-orbit-f{stroke:var(--foreground)}
.lp-orbit-a{stroke:var(--accent)}
.lp-orbit [data-z="0"]{stroke-width:2.6;opacity:.3}
.lp-orbit [data-z="1"]{stroke-width:4.2;opacity:.64}
.lp-orbit [data-z="2"]{stroke-width:6;opacity:.97}
.lp-orbit-tags{list-style:none;position:absolute;inset:0;z-index:1}
.lp-orbit-tags li{position:absolute;display:flex;align-items:center;gap:.5em;transform:translate(calc(var(--x,50) * -1%),-50%);font-size:var(--fs-xs);font-weight:600;white-space:nowrap;color:var(--foreground);opacity:calc(.42 + var(--z,.5) * .58);text-shadow:0 0 12px var(--background),0 0 4px var(--background)}
.lp-orbit-tags li::before{content:"";flex:none;width:5px;height:5px;border-radius:50%;background:var(--primary)}
/* 21 stream(돌과 물결): 연수 제목으로 그린 그림 한 장(액자) */
.lp-hero--stream{background:radial-gradient(50% 60% at 80% 50%,color-mix(in srgb,var(--hero-from) 60%,transparent),transparent 74%),var(--background)}
.lp-hero--stream .lp-h1{line-height:1.18;letter-spacing:-.02em}
.lp-stream{position:relative;justify-self:end;display:grid;gap:var(--sp-3);width:min(100%,440px);margin:0}
.lp-stream-plate{position:relative;aspect-ratio:4/5;overflow:hidden;background:var(--card);border:1px solid var(--rule-c);border-radius:var(--radius-sm);box-shadow:0 1px 2px rgba(20,20,30,.06),0 34px 64px -36px color-mix(in srgb,var(--foreground) 55%,transparent)}
.lp-stream svg{position:absolute;inset:0;width:100%;height:100%}
.lp-stream-l{fill:none;stroke:var(--foreground);stroke-width:.9;stroke-linecap:round;stroke-linejoin:round;opacity:.6}
.lp-stream-b{stroke-width:1.7;opacity:.82}
.lp-stream-s0{fill:var(--accent)}
.lp-stream-s1{fill:var(--primary)}
.lp-stream-s2{fill:var(--foreground)}
.lp-stream figcaption{font-size:var(--fs-xs);color:var(--muted-foreground)}
/* 다른 첫 화면에 꾸밈으로 놓일 때 */
.lp-hero-graphic > .lp-fan{position:absolute;right:max(2vw,calc((100% - 1320px) / 2));top:50%;width:min(40vw,520px);margin-top:calc(min(40vw,520px) * -.42);opacity:.5}
.lp-hero-graphic > .lp-dial{position:absolute;right:max(3vw,calc((100% - 1320px) / 2));top:50%;width:min(34vw,440px);margin-top:calc(min(34vw,440px) * -.5);opacity:.5}
.lp-hero-graphic > .lp-orbit{position:absolute;right:max(1vw,calc((100% - 1360px) / 2));top:50%;width:min(42vw,560px);margin-top:calc(min(42vw,560px) * -.5);opacity:.6}
.lp-hero-graphic > .lp-stream{position:absolute;right:max(1vw,calc((100% - 1360px) / 2));top:50%;width:min(40vw,520px);margin-top:calc(min(40vw,520px) * -.5);opacity:.5;-webkit-mask-image:radial-gradient(closest-side,#000 58%,transparent);mask-image:radial-gradient(closest-side,#000 58%,transparent)}
.lp-hero-graphic .lp-stream-plate{aspect-ratio:1;background:none;border:0;box-shadow:none}
.lp-hero-graphic .lp-stream figcaption{display:none}
@media (max-width:760px){
  .lp-show{grid-template-columns:minmax(0,1fr);grid-template-areas:"copy" "art" "meta";row-gap:var(--sp-7)}
  .lp-show > .lp-hero-meta{grid-template-columns:minmax(0,1fr)}
  .lp-fan{width:min(100%,400px);aspect-ratio:1/.76;margin-block:var(--sp-2) 0}
  .lp-fan-card{top:22%}
  .lp-dial-ring{width:min(84%,300px)}
  .lp-dial-list{grid-auto-flow:row;grid-template-rows:none}
  .lp-orbit{width:min(100%,360px)}
  .lp-stream{justify-self:stretch;width:100%}
  .lp-stream-plate{aspect-ratio:1}
}
@media (min-width:761px) and (max-width:1100px){.lp-dial-list{grid-auto-flow:row;grid-template-rows:none}}
@media (max-width:900px){
  .lp-hero-graphic > :is(.lp-fan,.lp-dial,.lp-orbit,.lp-stream){display:none}
}

/* ── 배치가 다른 첫 화면(render/hero-graphic.js): 왼쪽 정렬이 아닌 문법 여섯 가지 ─────────────────
   가운데 축 · 자료 그림 · 반반 화면 · 그림 가득 · 세로쓰기(오른쪽 맞춤) · 어긋난 격자. 본문 문법은 아래 '본문 정렬 문법'(<html data-align>) */
/* 22 ripple(번지는 파문): 모든 글이 가운데 축에. 뒤에서 물결 고리 세 벌이 번져 겹침(글 뒤는 옅게) */
.lp-hero--ripple{text-align:center;background:radial-gradient(70% 60% at 50% 44%,color-mix(in srgb,var(--hero-from) 72%,transparent),transparent 76%),var(--background)}
.lp-rip{position:absolute;inset:0;z-index:-1;-webkit-mask-image:radial-gradient(ellipse 44% 38% at 50% 47%,rgba(0,0,0,.26),#000 100%);mask-image:radial-gradient(ellipse 44% 38% at 50% 47%,rgba(0,0,0,.26),#000 100%)}
.lp-rip svg{display:block;width:100%;height:100%}
.lp-rip circle{fill:none;stroke-width:1.3;vector-effect:non-scaling-stroke}
.lp-rip-g0,.lp-rip-drop{stroke:var(--primary)}
.lp-rip-g1{stroke:var(--accent)}
.lp-rip-g2{stroke:var(--accent-2)}
.lp-hero--ripple .lp-hero-inner{justify-items:center;gap:var(--sp-5)}
.lp-rip-top{display:flex;flex-wrap:wrap;justify-content:center;align-items:baseline;gap:var(--sp-2) var(--sp-5)}
.lp-hero--ripple .lp-h1{--fs-hero:clamp(2.6rem,7vw,6.5rem);max-width:13em;line-height:1.16;letter-spacing:-.045em;text-wrap:balance}
.lp-hero--ripple .lp-hero-sub{max-width:28em;text-wrap:balance}
.lp-hero--ripple .lp-ctas{justify-content:center;margin-top:var(--sp-3)}
.lp-rip-rail{display:flex;flex-wrap:wrap;justify-content:center;gap:var(--sp-4) 0;width:min(100%,62rem);margin-top:clamp(16px,3.4vw,48px);padding-top:var(--sp-5);border-top:1px solid var(--rule-c)}
.lp-rip-rail > div{justify-items:center;padding-inline:clamp(14px,2.6vw,40px)}
.lp-rip-rail > div + div{border-left:1px solid var(--rule-c)}
.lp-rip-rail dd{justify-content:center}
.lp-rip-rail .lp-num{font-size:var(--fs-lg)}
/* 23 minutes(시간 점묘): 고정폭 표제 줄, 제목 옆 정보, 화면 폭의 점 지도(한 줄이 30분·한 시간)와 그 아래 일정 풀이.
   점 지도 옆 일정 칸은 17rem 아래로 줄지 않음(점이 대신 작아짐): 1024 안팎에서 일정 글자가 세로로 한 글자씩 쌓이지 않게 */
.lp-hero--minutes .lp-hero-inner{grid-template-columns:minmax(0,8fr) minmax(0,4fr);grid-template-areas:"top top" "copy meta" "art art";gap:clamp(20px,3vw,44px) clamp(24px,4vw,64px);align-items:end}
.lp-hero--minutes .lp-hero-inner.is-solo{grid-template-areas:"top top" "copy meta"}
.lp-min-top{grid-area:top;display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:var(--sp-2) var(--sp-5);padding-bottom:var(--sp-3);border-bottom:max(2px,var(--border-w)) solid var(--foreground)}
.lp-min-d{font-family:var(--font-mono);font-size:var(--fs-sm);font-variant-numeric:tabular-nums;color:var(--muted-foreground)}
.lp-hero--minutes .lp-hero-copy{grid-area:copy}
.lp-hero--minutes .lp-h1{--fs-hero:clamp(2.4rem,5.6vw,5.25rem);letter-spacing:-.04em}
.lp-hero--minutes .lp-accent{color:var(--accent)}
.lp-hero--minutes .lp-hero-meta{grid-area:meta;grid-template-columns:minmax(0,1fr);gap:0;align-self:end}
.lp-hero--minutes .lp-hero-meta > div{grid-template-columns:4.2em minmax(0,1fr);align-items:baseline;gap:var(--sp-3);padding:.6em 0;border-top:1px solid var(--rule-c)}
.lp-hero--minutes .lp-hero-meta dt{font-family:var(--font-mono)}
.lp-minmap{grid-area:art;display:grid;grid-template-columns:minmax(0,auto) minmax(17rem,1fr);align-items:start;gap:var(--sp-5) clamp(28px,5vw,80px);min-width:0;padding-top:var(--sp-5);border-top:1px solid var(--rule-c)}
.lp-min-field{display:grid;gap:clamp(5px,.75vw,10px)}
.lp-min-row{display:grid;grid-template-columns:3.6em minmax(0,1fr);align-items:center;gap:var(--sp-3)}
.lp-min-row time,.lp-min-legend time,.lp-min-legend small,.lp-min-key{font-family:var(--font-mono);font-size:var(--fs-xs);font-variant-numeric:tabular-nums;color:var(--muted-foreground)}
.lp-min-dots{display:grid;grid-template-columns:repeat(var(--c),minmax(0,var(--dot-w,26px)));gap:clamp(2px,.5vw,7px)}
.lp-min-field[data-c="60"]{--dot-w:14px}
.lp-min-field[data-c="30"],.lp-min-field[data-c="24"]{--dot-w:20px}
.lp-min-dots i{aspect-ratio:1;border-radius:50%;background:var(--dot,var(--foreground));transition:opacity .25s}
.lp-minmap .c0{--dot:var(--accent)}
.lp-minmap .c1{--dot:var(--accent-2)}
.lp-minmap .c2{--dot:var(--accent-3)}
.lp-minmap .c3{--dot:var(--foreground)}
.lp-minmap i.r{background:none;box-shadow:inset 0 0 0 1.5px color-mix(in srgb,var(--foreground) 36%,transparent)}
.lp-min-side{display:grid;gap:var(--sp-3)}
.lp-min-legend{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,270px),1fr));column-gap:var(--sp-6);border-top:1px solid var(--rule-c)}
.lp-min-legend a{display:grid;grid-template-columns:auto auto minmax(0,1fr) auto;align-items:baseline;gap:.65em;padding:.5em 0;border-bottom:1px solid var(--rule-c);color:inherit;text-decoration:none;font-size:var(--fs-sm);transition:border-color .2s}
.lp-min-legend a > i{align-self:center;width:.7em;height:.7em;border-radius:50%;background:var(--dot)}
.lp-min-legend span{min-width:0;font-weight:600}
.lp-min-legend a:is(:hover,:focus-visible),.lp-min-legend li.is-on a{border-bottom-color:var(--foreground)}
.lp-min-key{margin:0}
.lp-minmap[data-on] .lp-min-dots i:not(.is-on){opacity:.2}
.lp-min-dots i.is-past{opacity:.42}
.lp-min-dots i.is-now{opacity:1;box-shadow:0 0 0 3px var(--background),0 0 0 5px var(--foreground)}
.fx-minmap .lp-min-dots i{transition:opacity .5s var(--d,0ms),transform .6s cubic-bezier(.2,1.4,.4,1) var(--d,0ms)}
.fx-minmap[data-fx-pre] .lp-min-dots i{opacity:.14;transform:scale(.5)}
/* 24 mosaic(도형 모자이크): 화면을 반으로. 왼쪽은 화면 끝까지 닿는 도형 타일 그림, 오른쪽은 글. 그림 모서리에 날짜 딱지 */
.lp-hero--mosaic{grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-content:stretch;align-items:center;padding-block:0}
.lp-mosaic{position:relative;align-self:stretch;min-height:min(92svh,940px);overflow:hidden;--t0:var(--card);background:var(--t0)}
.lp-mosaic-svg{position:absolute;inset:0;width:100%;height:100%}
.lp-tile .t0{fill:var(--t0)}
.lp-tile :is(.t1,.c1){fill:var(--primary)}
.lp-tile :is(.t2,.c2){fill:var(--accent)}
.lp-tile :is(.t3,.c3){fill:var(--accent-2)}
.lp-tile :is(.t4,.c4){fill:var(--foreground)}
.lp-tile :is(.s1,.s2,.s3,.s4){fill:none;stroke-width:14}
.lp-tile .s1{stroke:var(--primary)}
.lp-tile .s2{stroke:var(--accent)}
.lp-tile .s3{stroke:var(--accent-2)}
.lp-tile .s4{stroke:var(--foreground)}
.lp-tile-s{transform-box:fill-box;transform-origin:50% 50%;transition:transform .6s cubic-bezier(.16,1,.3,1)}
@media (hover:hover){.lp-tile:hover .lp-tile-s{transform:rotate(90deg)}}
.lp-mosaic-date{position:absolute;right:0;bottom:0;display:grid;place-content:center;gap:4px;width:40%;min-width:150px;aspect-ratio:2/1;margin:0;padding:var(--sp-3) var(--sp-4);background:var(--foreground);color:var(--background)}
.lp-mosaic-date time{display:grid;gap:4px}
.lp-mosaic-date b{font-family:var(--font-num);font-weight:var(--num-weight);font-size:clamp(1.9rem,3.6vw,3.4rem);line-height:1;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.lp-mosaic-date span{font-size:var(--fs-sm);font-weight:600}
.lp-hero--mosaic > .lp-wrap{justify-self:start;max-width:720px;margin:0;padding:clamp(48px,6vw,96px) clamp(20px,5vw,80px)}
.lp-hero--mosaic .lp-h1{--fs-hero:clamp(2.4rem,4.7vw,4.9rem);line-height:1.16;letter-spacing:-.03em}
.lp-hero--mosaic .lp-hero-meta{grid-template-columns:repeat(auto-fit,minmax(150px,1fr));padding-top:var(--sp-5);border-top:max(2px,var(--border-w)) solid var(--foreground)}
/* 25 cover(표지 한 장): 그림이 위쪽을 가득 채우고(교재 쪽 그림, 없으면 제목 첫 글자를 크게 자른 포스터) 제목 판이 그림에 걸침 */
.lp-hero--cover{--fig-h:clamp(280px,52svh,540px);--lap:clamp(64px,8vw,128px);align-content:start;padding-top:0}
.lp-cover-fig{position:absolute;inset:0 0 auto;z-index:-1;height:var(--fig-h);margin:0;overflow:hidden;background:var(--primary)}
.lp-cover-fig img{display:block;width:100%;height:100%;object-fit:cover}
.lp-cover-glyph{position:absolute;left:var(--gx,44%);bottom:-.16em;font-family:var(--font-display);font-weight:var(--display-weight);font-size:calc(var(--fig-h) * 1.02);line-height:1;letter-spacing:-.06em;white-space:nowrap;color:color-mix(in srgb,var(--primary-foreground) 17%,var(--primary));-webkit-user-select:none;user-select:none}
.lp-cover-disc{position:absolute;left:var(--dx,70%);top:var(--dy,36%);width:calc(var(--ds,28) * 1vmin);max-width:300px;aspect-ratio:1;border-radius:50%;background:var(--accent-2);transform:translate(-50%,-50%)}
.lp-cover-bars{position:absolute;right:-4%;top:-30%;width:44%;height:170%;background:repeating-linear-gradient(90deg,color-mix(in srgb,var(--primary-foreground) 24%,var(--primary)) 0 9px,transparent 9px 27px);transform:rotate(var(--ba,12deg));-webkit-mask-image:linear-gradient(90deg,transparent,#000 60%);mask-image:linear-gradient(90deg,transparent,#000 60%)}
.lp-hero--cover .lp-hero-inner{grid-template-columns:minmax(0,8fr) minmax(0,4fr);align-items:end;gap:var(--sp-6) clamp(24px,4vw,64px);padding-top:calc(var(--fig-h) - var(--lap))}
.lp-cover-card{display:grid;gap:var(--sp-4);justify-items:start;padding:clamp(22px,3vw,44px) clamp(22px,3vw,44px) 0;margin-left:calc(clamp(22px,3vw,44px) * -1);background:var(--background);border-radius:var(--radius-lg) var(--radius-lg) 0 0}
.lp-cover-top{display:flex;flex-wrap:wrap;align-items:baseline;gap:var(--sp-2) var(--sp-5)}
.lp-hero--cover .lp-h1{--fs-hero:clamp(2.3rem,4.8vw,4.6rem);line-height:1.14;letter-spacing:-.035em}
.lp-cover-rail{grid-template-columns:minmax(0,1fr);gap:0;margin-top:calc(var(--lap) + var(--sp-4))}
.lp-cover-rail > div{grid-template-columns:4.2em minmax(0,1fr);align-items:baseline;gap:var(--sp-3);padding:.6em 0;border-top:1px solid var(--rule-c)}
.lp-cover-rail .lp-num{font-size:var(--fs-lg)}
/* 26 vertical(세로쓰기): 세로로 쓴 제목(오른쪽에서 왼쪽으로)과 날짜 도장, 뒤에 큰 원 하나. 글·버튼·정보는 오른쪽 맞춤 */
.lp-vt-moon{position:absolute;right:max(3vw,calc((100% - 1320px) / 2 + 24px));top:48%;z-index:-1;width:min(46vw,64svh,580px);aspect-ratio:1;border-radius:50%;background:var(--hero-from);transform:translateY(-50%)}
.lp-hero--vertical .lp-hero-inner{grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"copy title" "meta title";align-items:end;gap:var(--sp-6) clamp(28px,5vw,96px);min-height:min(62svh,600px)}
.lp-vt-title{grid-area:title;align-self:stretch;display:flex;flex-direction:row-reverse;align-items:flex-start;gap:var(--sp-5)}
.lp-vt-h{--fs-hero:clamp(2.2rem,min(6.2vw,calc(56svh / var(--len,7))),6rem);margin:0;writing-mode:vertical-rl;text-orientation:mixed;line-height:1.3;letter-spacing:.05em;white-space:nowrap}
.lp-vt-l{display:block}
.lp-tcy{-webkit-text-combine:horizontal;text-combine-upright:all}
.lp-vt-seal{align-self:flex-end;margin:0}
.lp-vt-seal time{display:grid;place-content:center;justify-items:center;width:4.1em;aspect-ratio:1;font-family:var(--font-display);font-size:var(--fs-sm);font-weight:700;line-height:1.2;background:var(--primary);color:var(--primary-foreground);border-radius:5px}
.lp-vt-seal b{font-weight:inherit}
.lp-vt-seal span{font-size:.82em;opacity:.86}
.lp-vt-copy{grid-area:copy;display:grid;gap:var(--sp-4);justify-items:end;text-align:right}
.lp-vt-copy .lp-hero-sub{text-wrap:balance}
.lp-vt-copy .lp-ctas{justify-content:flex-end}
.lp-hero--vertical .lp-hero-meta{grid-area:meta;display:flex;flex-wrap:wrap;justify-content:flex-end;gap:var(--sp-3) var(--sp-7);padding-top:var(--sp-4);border-top:1px solid var(--rule-c);text-align:right}
.lp-hero--vertical .lp-hero-meta > div{justify-items:end}
.lp-hero--vertical .is-flat{grid-template-columns:minmax(0,1fr);grid-template-areas:"title" "copy" "meta";min-height:0}
.lp-hero--vertical .is-flat .lp-vt-title{flex-direction:column;align-items:flex-end;text-align:right}
.lp-hero--vertical .is-flat .lp-h1{--fs-hero:clamp(2.4rem,5.4vw,5rem);line-height:1.2}
/* 27 offset(어긋난 격자): 굵은 선 아래 계단처럼 어긋난 큰 제목이 오른쪽 색면에 걸침. 가장자리에 세워 쓴 날짜, 아래에 칸을 달리한 정보·글·숫자 */
.lp-off-block{position:absolute;top:0;right:0;z-index:-1;width:41.666%;height:64%;background:color-mix(in srgb,var(--primary) 13%,var(--background));box-shadow:inset 0 -12px 0 var(--primary)}
.lp-off-spine{display:none;position:absolute;left:calc((100% - 1320px) / 2 - 34px);top:50%;margin:0;writing-mode:vertical-rl;transform:translateY(-50%) rotate(180deg);font-family:var(--font-mono);font-size:var(--fs-xs);letter-spacing:.16em;white-space:nowrap;color:var(--muted-foreground)}
@media (min-width:1420px){.lp-off-spine{display:block}}
.lp-hero--offset .lp-hero-inner{gap:clamp(22px,3.2vw,48px)}
.lp-off-top{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:var(--sp-2) var(--sp-5);padding-bottom:var(--sp-3);border-bottom:max(2px,var(--border-w)) solid var(--foreground)}
.lp-off-h{--fs-hero:clamp(2.7rem,8vw,7.75rem);display:grid;gap:.08em;line-height:1.04;letter-spacing:-.05em}
.lp-off-l{display:block;padding-left:calc(var(--n,0) * 16.666%)}
.lp-off-row{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));column-gap:clamp(12px,2vw,28px);align-items:start;padding-top:var(--sp-5);border-top:1px solid var(--rule-c)}
.lp-off-row > .lp-hero-meta{grid-column:1 / span 4;grid-template-columns:minmax(0,1fr);gap:var(--sp-3)}
.lp-off-copy{grid-column:6 / span 5;display:grid;gap:var(--sp-4);justify-items:start}
.lp-off-nums{grid-column:11 / span 2;display:grid;gap:var(--sp-3);justify-items:end;margin:0;text-align:right}
.lp-off-nums .lp-gl{justify-items:end}
@media (max-width:900px){
  .lp-hero--minutes .lp-hero-inner{grid-template-columns:minmax(0,1fr);grid-template-areas:"top" "copy" "art" "meta"}
  .lp-hero--minutes .lp-hero-inner.is-solo{grid-template-areas:"top" "copy" "meta"}
  .lp-minmap{grid-template-columns:minmax(0,1fr)}
  .lp-hero--mosaic{grid-template-columns:minmax(0,1fr)}
  .lp-mosaic{min-height:clamp(210px,54vw,360px);display:flex;align-items:flex-end;justify-content:flex-end}
  .lp-mosaic-date{position:relative;width:46%} /* 흐름 안에 둠: 글자를 키워 날짜 칸이 커지면 그림 칸도 함께 커짐(잘리지 않게) */
  .lp-hero--mosaic > .lp-wrap{max-width:none;padding-block:var(--sp-7) var(--sp-8)}
  .lp-hero--cover{--fig-h:clamp(200px,34svh,320px);--lap:44px}
  .lp-hero--cover .lp-hero-inner{grid-template-columns:minmax(0,1fr)}
  .lp-cover-card{margin:0 0 0 -20px;padding:var(--sp-5) var(--sp-5) 0 20px;border-radius:0 var(--radius-lg) 0 0}
  .lp-cover-rail{margin-top:0}
  .lp-off-block{width:46%;height:clamp(200px,30svh,250px)}
  .lp-off-row > .lp-hero-meta,.lp-off-copy,.lp-off-nums{grid-column:1 / -1}
  .lp-off-row{row-gap:var(--sp-5)}
  .lp-off-nums{display:flex;gap:var(--sp-6);justify-items:start;text-align:left}
  .lp-off-nums .lp-gl{justify-items:start}
  .lp-off-l{padding-left:calc(var(--n,0) * 9%)}
}
@media (max-width:700px){
  .lp-rip-rail{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:var(--sp-4) var(--sp-3)}
  .lp-rip-rail > div{padding:0}
  .lp-rip-rail > div + div{border:0}
  .lp-min-field[data-c="60"] .lp-min-dots{--c:30}
  .lp-min-field[data-c="24"] .lp-min-dots{--c:12}
  .lp-min-row{grid-template-columns:3em minmax(0,1fr);align-items:start;gap:var(--sp-2)}
  .lp-hero--vertical .lp-hero-inner{grid-template-columns:minmax(0,1fr);grid-template-areas:"title" "copy" "meta";min-height:0}
  .lp-vt-h{--fs-hero:clamp(2.1rem,min(11vw,calc(44svh / var(--len,7))),3.4rem)}
  .lp-vt-moon{right:-14vw;top:9%;width:78vw;transform:none}
}
@media (prefers-reduced-motion:no-preference){
  /* 도형 모자이크: 여섯 칸에 하나꼴로 타일이 저마다 다른 때에 천천히 돎(꾸밈). 첫 화면이 화면 밖이면 쉼 */
  html:is([data-motion="2"],[data-motion="3"]):not(.lp-paused):not(.fx-paused):not(.lp-lowpower):not(.lp-hero-off) .lp-tile:nth-child(5n+2):not(:hover) .lp-tile-s{animation:lp-tile-turn 30s cubic-bezier(.6,0,.2,1) infinite;animation-delay:calc(var(--i) * -1.37s)}
  @supports (animation-timeline:view()){
    html:is([data-motion="2"],[data-motion="3"]):not(.lp-paused):not(.fx-paused) .lp-cover-glyph{animation:lp-cover-glyph linear both;animation-timeline:scroll(root);animation-range:0 90vh}
    html:is([data-motion="2"],[data-motion="3"]):not(.lp-paused):not(.fx-paused) .lp-cover-disc{animation:lp-cover-disc linear both;animation-timeline:scroll(root);animation-range:0 90vh}
    html:is([data-motion="2"],[data-motion="3"]):not(.lp-paused):not(.fx-paused) .lp-vt-moon{animation:lp-vt-moon linear both;animation-timeline:scroll(root);animation-range:0 100vh}
    html:is([data-motion="2"],[data-motion="3"]):not(.lp-paused):not(.fx-paused) .lp-off-block{animation:lp-off-block linear both;animation-timeline:scroll(root);animation-range:0 90vh}
  }
}
@keyframes lp-tile-turn{0%,21%{transform:rotate(0)}25%,46%{transform:rotate(90deg)}50%,71%{transform:rotate(180deg)}75%,96%{transform:rotate(270deg)}100%{transform:rotate(360deg)}}
@keyframes lp-cover-glyph{to{transform:translate3d(-3%,14%,0)}}
@keyframes lp-cover-disc{to{transform:translate(-50%,-50%) translate3d(0,-60%,0) scale(1.12)}}
@keyframes lp-vt-moon{to{transform:translateY(-34%) scale(1.06)}}
@keyframes lp-off-block{to{transform:translate3d(0,-22%,0)}}

/* 어두운 테마에서 달라지는 첫 화면 조각 */
:root[data-theme="dark"] .lp-hero--worksheet{--mk:86%}
:root[data-theme="dark"] .lp-halftone{opacity:.55}
@media (prefers-color-scheme:dark){:root[data-theme="auto"] .lp-hero--worksheet{--mk:86%}:root[data-theme="auto"] .lp-halftone{opacity:.55}}

/* 스크롤에 맞춘 첫 화면 움직임(보통·스크롤 연출 단계, 브라우저가 지원할 때만). 꺼져도 완성된 모습 */
@media (prefers-reduced-motion:no-preference){@supports (animation-timeline:view()){
  html:is([data-motion="2"],[data-motion="3"]):not(.lp-paused):not(.fx-paused) :is(.lp-hero--cinema,.lp-hero--masthead,.lp-hero--sticker,.lp-hero--zine) .lp-h1{animation:lp-hero-out linear both;animation-timeline:view();animation-range:exit 5% exit 95%}
  html:is([data-motion="2"],[data-motion="3"]):not(.lp-paused):not(.fx-paused) .lp-cine-date{animation:lp-drift linear both;animation-timeline:scroll(root);animation-range:0 100vh}
  html:is([data-motion="2"],[data-motion="3"]):not(.lp-paused):not(.fx-paused) .lp-sun i{animation:lp-sunrise linear both;animation-timeline:scroll(root);animation-range:0 90vh}
  html:is([data-motion="2"],[data-motion="3"]):not(.lp-paused):not(.fx-paused) :is(.lp-halftone,.lp-rings){animation:lp-turn linear both;animation-timeline:scroll(root);animation-range:0 120vh}
}}
@keyframes lp-hero-out{to{opacity:.25;transform:translate3d(0,-7vh,0) scale(.965)}}
@keyframes lp-drift{to{transform:translate3d(-6vw,10vh,0)}}
@keyframes lp-sunrise{from{transform:translate3d(0,26%,0)}to{transform:none}}
@keyframes lp-turn{to{transform:rotate(24deg) scale(1.08)}}

/* 구분 띠(첫 화면 아래 낱말 띠) */
.lp-divider{display:flex;flex-wrap:wrap;gap:var(--sp-2) var(--sp-6);overflow:hidden;padding:var(--sp-5) max(20px,env(safe-area-inset-left,0px));border-block:var(--rule);background:var(--background);font-family:var(--font-display);font-weight:var(--display-weight);font-size:clamp(1.125rem,1rem + .8vw,1.5rem);color:var(--muted-foreground);justify-content:center}
.lp-divider span{flex:none}

/* 화면 폭 띠(핵심 메시지·마무리). 바탕은 프리셋마다(<html data-band>): tint 옅은 바탕 · accent 강조색 면 · invert 반대 테마 색(theme.css의 .lp-invert) · glow 어두운 바탕 위 빛 */
.lp-bleed{padding-block:clamp(72px,9.6vw,152px)}
[data-band="tint"] .lp-bleed{background:var(--surface-2)}
[data-band="glow"] .lp-bleed{background:radial-gradient(70% 90% at 10% 112%,color-mix(in srgb,var(--hero-from) 30%,transparent),transparent 70%),radial-gradient(60% 80% at 102% -12%,color-mix(in srgb,var(--hero-to) 26%,transparent),transparent 70%),var(--background)}

/* 핵심 메시지: 띠를 채우는 큰 문장. 넓은 화면에서는 문장 왼쪽·덧붙임 글 오른쪽 아래 */
.lp-message{display:grid;grid-template-columns:minmax(0,1fr);gap:clamp(24px,4vw,56px)}
.lp-statement,.lp-quote p,.lp-formula-rows{font-family:var(--font-display);font-weight:var(--display-weight);font-size:var(--fs-statement);line-height:1.24;letter-spacing:var(--display-tracking)}
.lp-statement,.lp-quote p{max-width:17em;text-wrap:balance}
.lp-quote{margin:0;display:grid;grid-template-columns:minmax(0,1fr);gap:var(--sp-5)}
.lp-quote::before{content:"“";display:block;height:.42em;font-family:var(--font-display);font-weight:var(--display-weight);font-size:clamp(4.5rem,9vw,8rem);line-height:.8;color:var(--primary)}
.lp-quote cite{font-style:normal;font-size:var(--fs-md);font-weight:600;color:var(--muted-foreground)}
.lp-quote cite::before{content:"";display:inline-block;width:2em;height:1px;margin-right:.7em;background:currentColor;vertical-align:.3em}
/* 공식: 세로셈. 한 줄에 한 항, 줄을 긋고, 답을 강조색으로 */
.lp-formula{margin:0}
.lp-formula-rows{display:grid;grid-template-columns:auto minmax(0,1fr);justify-content:start;align-items:baseline;line-height:1.18}
.lp-op{align-self:stretch;display:grid;align-items:center;min-width:1.1em;padding-right:clamp(14px,2.6vw,40px);font-family:var(--font-mono);font-weight:400;font-size:.62em;text-align:right;color:var(--muted-foreground)}
.lp-term{padding-block:.16em;text-wrap:balance}
.lp-eq,.lp-result{margin-top:.34em;padding-top:.44em;border-top:max(2px,var(--border-w)) solid var(--foreground)}
.lp-op.lp-eq{margin-top:.548em;padding-top:.71em}
.lp-result{color:var(--primary)}
.lp-message-side{display:grid;gap:var(--sp-3);align-content:end;max-width:27rem}
.lp-message-note{font-size:var(--fs-md);line-height:1.7;color:var(--muted-foreground)}
/* 메시지 덧말은 띠 색 위에서 4.5:1이 되게 흐리지 않음 */
@media (min-width:1024px){.lp-message:has(> .lp-message-side){grid-template-columns:minmax(0,8fr) minmax(0,4fr);column-gap:clamp(32px,5vw,88px);align-items:end}}
/* 보통 단계부터: 스크롤에 맞춰 낱말(공식은 줄)이 차례로 진해짐. 브라우저가 지원하고 움직임이 켜져 있을 때만 — 아니면 처음부터 다 보임 */
@media (prefers-reduced-motion:no-preference){@supports (animation-timeline:view()){
  html:is([data-rest="2"],[data-rest="3"]):not(.lp-paused):not(.fx-paused) :is(.lp-statement,.lp-quote p,.lp-formula-rows){view-timeline:--lp-msg block}
  html:is([data-rest="2"],[data-rest="3"]):not(.lp-paused):not(.fx-paused) :is(.lp-statement,.lp-quote p) .lp-w{animation:lp-w-fill linear both;animation-timeline:--lp-msg;animation-range:cover calc(16% + var(--i) * 30% / var(--n)) cover calc(25% + var(--i) * 30% / var(--n))}
  html:is([data-rest="2"],[data-rest="3"]):not(.lp-paused):not(.fx-paused) .lp-formula-rows > *{animation:lp-term-in linear both;animation-timeline:--lp-msg;animation-range:cover calc(12% + var(--i) * 30% / var(--n)) cover calc(26% + var(--i) * 30% / var(--n))}
}}
/* 아직 차지 않은 글도 읽히는 진하기에서 시작(멈춘 화면·캡처에서도 읽힘) */
@keyframes lp-w-fill{from{opacity:.45}}
@keyframes lp-term-in{from{opacity:.45}}

/* 연수 목표: 큰 번호 + 큰 문장(전체 폭). 대상·이수는 아래 작은 표 */
.lp-goals{display:grid;grid-template-columns:minmax(0,1fr);gap:var(--sp-6)}
.lp-goal-list{list-style:none;display:grid;grid-template-columns:minmax(0,1fr);border-top:max(2px,var(--border-w)) solid var(--foreground)}
.lp-goal-list li{display:grid;grid-template-columns:clamp(3.25rem,10.5vw,9.5rem) minmax(0,1fr);gap:var(--sp-4);align-items:baseline;padding:clamp(18px,2.3vw,30px) 0;border-bottom:var(--rule)}
.lp-goal-no{font-family:var(--font-num);font-weight:var(--num-weight);font-size:var(--fs-num);line-height:1;letter-spacing:var(--display-tracking);color:var(--primary);font-variant-numeric:tabular-nums}
.lp-goal-list p{max-width:27em;font-size:var(--fs-goal);font-weight:650;line-height:1.42;letter-spacing:-.02em;text-wrap:balance}
.lp-goal-meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:var(--sp-3) var(--sp-7);margin:0;font-size:var(--fs-sm)}
.lp-goal-meta > p{display:grid;grid-template-columns:3.2em minmax(0,1fr);gap:var(--sp-3);align-items:baseline;max-width:var(--measure);color:var(--muted-foreground)}
.lp-goal-meta b{font-weight:700;color:var(--primary)}
@media (min-width:900px){.lp-goal-meta{padding-left:calc(clamp(3.25rem,10.5vw,9.5rem) + var(--sp-4))}}

/* 요약 숫자: 아주 큰 숫자(자릿수 고정). 첫 칸이 두 칸 폭 */
.lp-glance-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));margin:0;border-top:max(2px,var(--border-w)) solid var(--foreground)}
.lp-glance-item{display:grid;gap:var(--sp-2);align-content:start;padding:var(--sp-5) var(--sp-4) var(--sp-5) 0;border-bottom:var(--rule)}
.lp-glance-item:nth-child(even){padding-left:var(--sp-5);border-left:1px solid var(--rule-c)}
.lp-glance-item dt{order:2;font-size:var(--fs-sm);font-weight:700}
.lp-glance-item dd{display:contents}
.lp-fig{order:1;display:flex;align-items:baseline;gap:.12em;min-width:0}
.lp-glance-item small{order:3;margin-top:-4px;font-size:var(--fs-xs);color:var(--muted-foreground)}
.lp-num{font-family:var(--font-num);font-weight:var(--num-weight);font-size:var(--fs-num);line-height:1;letter-spacing:var(--display-tracking);color:var(--foreground);font-variant-numeric:tabular-nums lining-nums}
.lp-fig .lp-num{font-size:var(--fs-figure);line-height:.92;letter-spacing:-.045em}
.lp-fig .lp-unit{font-size:var(--fs-lg);font-weight:700;color:var(--foreground)}
@media (min-width:900px){
  .lp-glance-grid{grid-template-columns:repeat(calc(var(--n) + 1),minmax(0,1fr))}
  .lp-glance-item,.lp-glance-item:nth-child(even){padding:var(--sp-5) var(--sp-5) var(--sp-2) var(--sp-5);border-left:1px solid var(--rule-c);border-bottom:0}
  .lp-glance-item:first-child{grid-column:span 2;padding-left:0;border-left:0}
  .lp-glance-item:first-child .lp-num{color:var(--primary)}
}

/* 핵심 단계: 위로 한 칸씩 올라가는 계단. 칸마다 선과 점, 큰 낱말 */
.lp-steps5{list-style:none;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--sp-5) 0}
.lp-steps5 li{position:relative;display:grid;gap:var(--sp-2);align-content:start;padding:var(--sp-4) var(--sp-4) 0 0;border-top:max(2px,var(--border-w)) solid var(--foreground)}
.lp-steps5 li::before{content:"";position:absolute;left:0;top:-6px;width:10px;height:10px;border-radius:50%;background:var(--primary);box-shadow:0 0 0 4px var(--background)}
.lp-steps5 h3{font-family:var(--font-display);font-weight:var(--display-weight);font-size:var(--fs-lg);line-height:1.25;letter-spacing:var(--display-tracking)}
.lp-steps5 p{max-width:16em;font-size:var(--fs-sm);line-height:1.6;color:var(--muted-foreground)}
.lp-idx{font-family:var(--font-mono);font-size:var(--fs-xs);font-weight:600;color:var(--primary);font-variant-numeric:tabular-nums}
.lp-close-line::before{content:"";display:block;width:2.5em;height:max(2px,var(--border-w));margin-bottom:var(--sp-4);background:var(--primary)}
.lp-close-line{margin-top:clamp(28px,4vw,56px);max-width:24em;font-size:var(--fs-goal);font-weight:650;line-height:1.45;letter-spacing:-.02em;text-wrap:balance}
@media (min-width:900px){
  .lp-steps5{grid-template-columns:repeat(var(--n),minmax(0,1fr));align-items:start}
  .lp-steps5 li{margin-top:calc((var(--n) - 1 - var(--i)) * 14px)}
  .lp-close-line{margin-left:auto}
}

/* 차례: 큰 번호가 붙은 넓은 판. 보통 단계부터 넓은 화면에서 판이 차례로 겹쳐 쌓임(sticky) */
.lp-outline{list-style:none;display:grid;grid-template-columns:minmax(0,1fr);gap:var(--sp-4)}
.lp-outline-item{display:grid;grid-template-columns:clamp(4.5rem,13vw,12rem) minmax(0,1fr);gap:var(--sp-4) clamp(16px,3vw,48px);align-items:start;padding:clamp(20px,3vw,44px);background:var(--card);color:var(--card-foreground);border:var(--border-w) solid var(--border);border-radius:var(--radius-lg)}
.lp-outline-no{font-family:var(--font-num);font-weight:var(--num-weight);font-size:var(--fs-figure);line-height:.84;letter-spacing:-.045em;color:var(--primary);font-variant-numeric:tabular-nums lining-nums}
.lp-outline-body{display:grid;gap:var(--sp-2);align-content:start;min-width:0}
.lp-outline-part{font-size:var(--fs-sm);font-weight:700;color:var(--primary)}
.lp-outline-item h3{font-family:var(--font-display);font-weight:var(--display-weight);font-size:var(--fs-h2s);line-height:1.25;letter-spacing:var(--display-tracking)}
.lp-outline-body > p:not(.lp-outline-part){max-width:30em;font-size:var(--fs-md);line-height:1.65;color:var(--muted-foreground)}
.lp-outline-thumb{display:block;width:min(100%,13rem);aspect-ratio:16/9;object-fit:cover;border-radius:min(var(--radius-sm),8px);border:1px solid var(--rule-c);background:var(--surface-2)}
.lp-outline-side{grid-column:2;display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:var(--sp-2) var(--sp-5);padding-top:var(--sp-4);border-top:var(--rule)}
[data-card="glass"] .lp-outline-item{border-color:color-mix(in srgb,var(--foreground) 13%,transparent)}
[data-card="paper"] .lp-outline-item{box-shadow:var(--shadow)}
@media (min-width:1024px){
  .lp-outline-item{grid-template-columns:clamp(4.5rem,13vw,12rem) minmax(0,1fr) minmax(11rem,auto)}
  .lp-outline-side{grid-column:3;align-self:stretch;flex-direction:column;flex-wrap:nowrap;align-items:flex-end;padding-top:0;border-top:0;text-align:right}
  .lp-outline-side .lp-tags{flex-direction:column;align-items:flex-end}
  .lp-outline-side .lp-tags li + li::before{content:none}
}
@media (min-width:1024px) and (min-height:640px) and (prefers-reduced-motion:no-preference){
  html:is([data-rest="2"],[data-rest="3"]):not(.lp-paused):not(.fx-paused) .lp-outline:not(.fx-stack) .lp-outline-item{position:sticky;top:calc(96px + var(--i) * 20px)}
  html:is([data-rest="2"],[data-rest="3"]):not(.lp-paused):not(.fx-paused) .lp-outline{padding-bottom:calc((var(--n) - 1) * 20px)}
}
.lp-outline.fx-stack{gap:var(--sp-4);padding-bottom:0}

/* 일정: 시간 레일. 위에 길이에 비례한 시간 막대, 아래에 큰 시각 | 점과 선 | 내용 | 걸리는 시간. 줄 높이도 길이에 비례 */
.lp-sched{display:grid;grid-template-columns:minmax(0,1fr);gap:clamp(20px,3vw,36px);min-width:0}
.lp-sched-bar{position:relative;display:flex;gap:3px;padding-bottom:1.75em}
.lp-sched-bar i{position:relative;flex:var(--min) 1 0;min-width:0;height:12px;background:color-mix(in srgb,var(--primary) 30%,var(--background));container-type:inline-size}
.lp-sched-bar i:nth-child(even){background:color-mix(in srgb,var(--primary) 62%,var(--background))}
.lp-sched-bar i:first-child{border-radius:2px 0 0 2px}
.lp-sched-bar i:nth-last-child(2){border-radius:0 2px 2px 0}
.lp-sched-bar i.is-done{background:color-mix(in srgb,var(--foreground) 16%,var(--background))}
.lp-sched-bar i.is-now{background:var(--primary)}
.lp-sched-bar b,.lp-sched-bar em{position:absolute;top:20px;font-family:var(--font-mono);font-size:var(--fs-xs);font-weight:500;font-style:normal;line-height:1;color:var(--muted-foreground);font-variant-numeric:tabular-nums}
.lp-sched-bar b{left:0}
.lp-sched-bar em{right:0}
@container (max-width:46px){.lp-sched-bar b{display:none}}
.lp-sched-bar i:nth-last-child(2) b{display:none}
@container (min-width:96px){.lp-sched-bar i:nth-last-child(2) b{display:block}}
.lp-schedule{list-style:none;position:relative;display:grid;grid-template-columns:minmax(0,1fr);--tw:clamp(4.25rem,7vw,6.5rem);--fx-ld-x:calc(var(--tw) + 20px);--fx-ld-pad:0px}
.lp-schedule::before{content:"";position:absolute;left:var(--fx-ld-x);top:12px;bottom:12px;width:1px;background:var(--rule-c)}
.lp-schedule.fx-ld::before{display:none}
.lp-schedule .fx-ld-rail{top:12px;bottom:12px}
.lp-schedule li{position:relative;display:grid;grid-template-columns:var(--tw) minmax(0,1fr) auto;column-gap:40px;align-items:start;min-height:max(60px,calc(var(--min,15) * 1.5px + 30px));padding:var(--sp-3) 0 var(--sp-4)}
.lp-schedule li::before{content:"";position:absolute;left:var(--fx-ld-x);top:calc(var(--sp-3) + .58em);width:9px;height:9px;margin-left:-4.5px;box-sizing:border-box;border:1.5px solid var(--muted-foreground);border-radius:50%;background:var(--background);z-index:1}
.lp-tinted .lp-schedule li::before{background:var(--surface-2)}
.lp-schedule time{display:grid;font-family:var(--font-num);font-weight:var(--num-weight);font-size:var(--fs-lg);line-height:1.25;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.lp-schedule time span{font-size:var(--fs-xs);font-weight:400;letter-spacing:0;color:var(--muted-foreground)}
.lp-schedule h3{font-size:var(--fs-md);font-weight:700;line-height:1.4}
.lp-schedule p{margin-top:2px;max-width:var(--measure);font-size:var(--fs-sm);color:var(--muted-foreground)}
.lp-schedule .lp-chip,.lp-schedule-part{justify-self:end;padding-top:.3em;white-space:nowrap}
.lp-schedule-min{font-family:var(--font-mono);font-variant-numeric:tabular-nums}
.lp-schedule li.is-now::after{content:"";position:absolute;inset:0 0 0 calc(var(--fx-ld-x) + 1px);z-index:-1;background:linear-gradient(90deg,color-mix(in srgb,var(--primary) 11%,transparent),transparent 82%)}
.lp-schedule li.is-now::before{border-color:var(--primary);background:var(--primary);box-shadow:0 0 0 4px color-mix(in srgb,var(--primary) 24%,transparent)}
.lp-schedule li.is-now time{color:var(--primary)}
.lp-schedule li.is-now h3::after{content:"지금";margin-left:.6em;font-size:var(--fs-xs);font-weight:700;color:var(--primary)}
.lp-schedule li.is-done{color:var(--muted-foreground)}
.lp-schedule li.is-done::before{border-color:var(--rule-c);background:var(--muted-foreground)}
.lp-schedule li.is-done h3{font-weight:600}

/* 준비 점검 */
.lp-ready{display:grid;grid-template-columns:minmax(0,1fr);gap:var(--sp-6);align-items:start}
@media (min-width:1024px){.lp-ready:not(.is-solo){grid-template-columns:minmax(0,7fr) minmax(0,5fr);gap:clamp(32px,5vw,72px)}.lp-ready .lp-diag{position:sticky;top:96px}}
.lp-ready .lp-diag{margin-top:0}
.lp-checklist{list-style:none;display:grid;grid-template-columns:minmax(0,1fr);max-width:46rem;border-top:max(2px,var(--border-w)) solid var(--foreground)}
.lp-checklist li:last-child{border-bottom:var(--rule)}
.lp-checklist li{display:flex;gap:var(--sp-3);align-items:flex-start;justify-content:space-between;padding:var(--sp-4) 0}
.lp-checklist li + li{border-top:var(--rule)}
.lp-checklist label{display:flex;gap:var(--sp-3);align-items:flex-start;cursor:pointer;flex:1}
.lp-checklist input{width:22px;height:22px;accent-color:var(--primary);margin-top:3px;flex:none}
.lp-checklist b{display:block;font-weight:650}
.lp-checklist small{display:block;color:var(--muted-foreground);font-size:var(--fs-sm)}
.lp-checklist input:checked+span b{text-decoration:line-through;text-decoration-color:var(--primary);color:var(--muted-foreground)}
.lp-diag{margin-top:var(--sp-6);padding:var(--sp-5);border-radius:var(--radius);background:var(--tint);display:grid;gap:var(--sp-3);max-width:46rem;container-type:inline-size}
.lp-diag-h{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
.lp-diag-h h2,.lp-diag-h h3{font-size:var(--fs-md);font-family:var(--font-sans)}
.lp-diag-list{list-style:none;display:grid;gap:6px}
.lp-diag-list li{display:grid;grid-template-columns:auto 1fr auto auto;gap:10px;align-items:center;font-size:var(--fs-sm)}
.lp-diag-list small{color:var(--muted-foreground);font-size:var(--fs-xs);overflow-wrap:anywhere}
.lp-diag-dot{width:10px;height:10px;border-radius:50%;background:var(--border)}
.lp-diag-list li[data-state="ok"] .lp-diag-dot{background:var(--success)}
.lp-diag-list li[data-state="fail"] .lp-diag-dot{background:var(--danger)}
.lp-diag-list li[data-state="wait"] .lp-diag-dot{background:var(--warning);animation:lp-blink 1s infinite}
.lp-diag-state{font-size:var(--fs-xs);white-space:nowrap}
/* 칸이 좁으면(휴대폰, 넓은 화면의 오른쪽 칸 1024px 언저리) 주소를 이름 아래로: 한 줄로 두면 틀 밖으로 나감 */
@container (max-width:25rem){.lp-diag-list li{grid-template-columns:auto minmax(0,1fr) auto;row-gap:0}.lp-diag-list small{grid-column:2;grid-row:2}.lp-diag-state{grid-column:3;grid-row:1}}
@keyframes lp-blink{50%{opacity:.3}}

/* 교재 뷰어 */
.lp-deck{display:grid;gap:var(--sp-3);grid-template-columns:minmax(0,1fr)}
.lp-deck-stage{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr));gap:var(--sp-5);outline:none}
.lp-deck-stage:focus-visible{outline:2px solid var(--ring);outline-offset:4px;border-radius:min(var(--radius),12px)}
.lp-slide{margin:0;display:grid;gap:var(--sp-2)}
.lp-slide img{width:100%;aspect-ratio:16/9;object-fit:contain;background:var(--card);border-radius:min(var(--radius),12px);border:1px solid var(--rule-c)}
/* 그림이 없는 쪽: 16:9 슬라이드 한 장. 글자 크기는 슬라이드 폭에 맞춰 커지고 줄어듦(cqw). 표지(cover)·부 시작(part)·본문(body) */
.lp-slide-text{position:relative;container-type:inline-size;display:grid;grid-template-rows:auto minmax(0,1fr);width:100%;aspect-ratio:16/9;overflow:hidden;background:var(--card);color:var(--card-foreground);border:1px solid var(--rule-c);border-radius:min(var(--radius),12px)}
.lp-slide-top{display:flex;justify-content:space-between;gap:1em;padding:3.4cqw 5cqw 0;font-family:var(--font-mono);font-size:max(10px,1.4cqw);line-height:1.2;color:var(--muted-foreground);font-variant-numeric:tabular-nums}
.lp-slide-top span:first-child{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.lp-slide-top span:last-child{flex:none}
.lp-slide-main{position:relative;z-index:1;display:grid;align-content:center;gap:2.2cqw;min-height:0;max-width:82%;padding:1cqw 5cqw 5.4cqw}
.lp-slide-part{font-family:var(--font-mono);font-size:max(11px,1.7cqw);font-weight:600;line-height:1.2;color:var(--primary)}
.lp-slide-text h3{font-family:var(--font-display);font-weight:var(--display-weight);font-size:max(18px,4.5cqw);line-height:1.22;letter-spacing:var(--display-tracking);text-wrap:balance}
.lp-slide-lead{max-width:30em;font-size:max(13px,2.25cqw);line-height:1.62;color:var(--muted-foreground)}
.lp-slide-points{list-style:none;display:grid;gap:1.1cqw;font-size:max(13px,2.2cqw);line-height:1.5}
.lp-slide-points li{position:relative;padding-left:1.5em}
.lp-slide-points li::before{content:"";position:absolute;left:0;top:.7em;width:.7em;height:2px;background:var(--primary)}
.lp-slide-kw,.lp-slide-flow{list-style:none;display:flex;flex-wrap:wrap;align-items:center;gap:1.2cqw 0;font-size:max(14px,2.7cqw);font-weight:700;line-height:1.3}
.lp-slide-kw li + li::before{content:"/";margin:0 .6em;font-weight:400;color:var(--primary)}
.lp-slide-flow{counter-reset:lp-fl}
.lp-slide-flow li{display:inline-flex;align-items:center;gap:.5em;counter-increment:lp-fl}
.lp-slide-flow li::before{content:counter(lp-fl);display:inline-grid;place-items:center;width:1.9em;height:1.9em;border:1px solid currentColor;border-radius:50%;font-family:var(--font-mono);font-size:.56em;font-weight:600;color:var(--primary)}
.lp-slide-flow li + li{margin-left:.8em;padding-left:1.7em;background:linear-gradient(var(--muted-foreground),var(--muted-foreground)) 0 50%/1em 1px no-repeat}
.lp-slide-pg{position:absolute;right:3.4cqw;bottom:.6cqw;font-family:var(--font-num);font-weight:var(--num-weight);font-size:17cqw;line-height:.8;letter-spacing:-.05em;color:transparent;-webkit-text-stroke:1px color-mix(in srgb,var(--foreground) 15%,transparent);font-variant-numeric:tabular-nums lining-nums;pointer-events:none;-webkit-user-select:none;user-select:none}
.lp-slide-text[data-kind="cover"]{--muted-foreground:var(--band-fg,var(--primary-foreground));background:color-mix(in srgb,var(--band-primary,var(--primary)) var(--band-mix,100%),var(--card));color:var(--band-fg,var(--primary-foreground));border-color:transparent}
.lp-slide-text[data-kind="cover"] h3{font-size:max(22px,6.3cqw);line-height:1.14}
.lp-slide-text[data-kind="cover"] :is(.lp-slide-top,.lp-slide-lead){opacity:.92} /* 4.5:1 이상(표지 한 장 #b3421a 위에서도) */
.lp-slide-text[data-kind="cover"] .lp-slide-pg{-webkit-text-stroke-color:color-mix(in srgb,var(--band-fg,var(--primary-foreground)) 30%,transparent)}
.lp-slide-text[data-kind="part"]{background:color-mix(in srgb,var(--primary) 9%,var(--card))}
.lp-slide-text[data-kind="part"] h3{font-size:max(20px,5.4cqw)}
.lp-slide-text[data-kind="part"] .lp-slide-pg{-webkit-text-stroke-color:color-mix(in srgb,var(--primary) 42%,transparent)}
/* 프리셋 표식 한 가지씩 */
@supports not (width:1cqw){.lp-slide-text h3{font-size:var(--fs-lg)}.lp-slide-pg{display:none}}
.lp-slide figcaption{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px var(--sp-3);font-size:var(--fs-sm);color:var(--muted-foreground)}
.lp-slide-no{font-family:var(--font-mono);font-weight:600;color:var(--foreground);font-variant-numeric:tabular-nums}
.lp-slide-tools{display:inline-flex;gap:var(--sp-3);flex-wrap:wrap;margin-left:auto}
.lp-slide-tools a{display:inline-flex;gap:4px;align-items:center;font-size:var(--fs-sm);font-weight:600;text-decoration:none}
.lp-deck.is-ready .lp-deck-stage{display:block}
.lp-deck.is-ready .lp-slide{display:none}
.lp-deck.is-ready .lp-slide.is-active{display:grid}
.lp-deck-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.lp-deck-count{font-family:var(--font-mono);font-variant-numeric:tabular-nums;min-width:5.5em;text-align:center}
.lp-follow{display:inline-flex;gap:6px;align-items:center;font-size:var(--fs-sm);color:var(--muted-foreground)}
.lp-deck-thumbs{display:flex;gap:8px;overflow-x:auto;padding-bottom:6px;scroll-snap-type:x proximity}
/* 쪽 미리보기 띠: 화면 밖(띠 안에서 옆으로 밀린) 미리보기는 그리지 않음(교재 수백 쪽에서 처음 멈춤 줄이기) */
.lp-deck-thumbs button{content-visibility:auto;contain-intrinsic-size:112px 67px}
.lp-deck-thumbs button{flex:none;width:112px;padding:0;border:2px solid transparent;border-radius:6px;background:var(--card);cursor:pointer;scroll-snap-align:start;overflow:hidden;font-size:var(--fs-xs);color:var(--muted-foreground)}
.lp-deck-thumbs button[aria-current="true"]{border-color:var(--primary)}
.lp-deck-thumbs img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover}
.lp-deck-thumbs span{display:block;aspect-ratio:16/9;padding:6px;text-align:left;overflow:hidden}
.lp-deck-thumbs span.lp-thumb-t,.lp-overview-grid .lp-thumb-t{display:grid;align-content:space-between;gap:2px;aspect-ratio:16/9;padding:7px 8px;text-align:left;overflow:hidden;background:var(--card);color:var(--card-foreground)}
.lp-thumb-t b{font-family:var(--font-mono);font-size:10px;font-weight:600;line-height:1;color:var(--primary);font-variant-numeric:tabular-nums}
.lp-thumb-t i{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-style:normal;font-size:11px;font-weight:700;line-height:1.3;color:inherit}
.lp-thumb-t[data-kind="cover"]{background:color-mix(in srgb,var(--band-primary,var(--primary)) var(--band-mix,100%),var(--card));color:var(--band-fg,var(--primary-foreground))}
.lp-thumb-t[data-kind="cover"] b{color:inherit}
.lp-thumb-t[data-kind="part"]{background:color-mix(in srgb,var(--primary) 9%,var(--card))}
.lp-overview-grid .lp-thumb-t{padding:12px 14px}
.lp-overview-grid .lp-thumb-t i{font-size:var(--fs-sm)}
.lp-deck:fullscreen .lp-slide-text{width:min(100%,calc(84vh * 16 / 9));margin-inline:auto}
.lp-deck-dl{display:flex;gap:8px}
.lp-deck:fullscreen{background:#000;padding:24px;display:grid;align-content:center}
.lp-deck:fullscreen .lp-slide img{max-height:84vh;border:0}
.lp-overview{position:fixed;inset:0;z-index:80;width:auto;height:auto;max-width:none;max-height:none;margin:0;border:0;color:var(--foreground);background:color-mix(in srgb,var(--background) 96%,transparent);overflow:auto;overscroll-behavior:contain;padding:calc(16px + env(safe-area-inset-top,0px)) max(16px,env(safe-area-inset-right,0px)) 32px max(16px,env(safe-area-inset-left,0px))}
.lp-overview::backdrop{background:transparent}
.lp-overview-h{display:flex;gap:10px;align-items:center;max-width:1160px;margin:0 auto 16px;position:sticky;top:0}
.lp-overview-h input{flex:1;min-height:44px;border-radius:var(--radius-sm);border:var(--border-w) solid var(--border);background:var(--card);padding:0 14px}
.lp-overview-grid{max-width:1160px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px}
.lp-overview-grid button{border:2px solid transparent;border-radius:8px;background:var(--card);padding:0;cursor:pointer;text-align:left;color:var(--foreground);overflow:hidden}
.lp-overview-grid button:hover{border-color:var(--primary)}
.lp-overview-grid img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover}
.lp-overview-grid span{display:block;padding:6px 8px;font-size:var(--fs-xs)}

/* 실습 스테이션 */
.lp-st-shell{display:grid;grid-template-columns:240px minmax(0,1fr);gap:clamp(24px,4vw,56px);align-items:start}
.lp-st-side{position:sticky;top:84px;display:grid;gap:var(--sp-5);max-height:calc(100vh - 100px);overflow:auto;min-width:0}
.lp-st-side nav{min-width:0}
.lp-st-side ol{list-style:none;display:grid;border-top:var(--rule)}
.lp-st-side a{display:grid;grid-template-columns:2em 1fr auto;gap:6px;align-items:center;padding:10px 4px;border-bottom:var(--rule);color:var(--muted-foreground);text-decoration:none;font-weight:600;font-size:var(--fs-sm);line-height:1.4}
.lp-st-side a:hover{color:var(--foreground)}
.lp-st-side a[aria-current="step"]{color:var(--foreground);box-shadow:inset 0 -2px 0 var(--primary)}
.lp-st-side a[aria-current="step"] .lp-st-n{color:var(--primary)}
.lp-st-n{font-family:var(--font-mono);font-size:var(--fs-xs);font-variant-numeric:tabular-nums}
.lp-st-ck{width:16px;height:16px;border-radius:50%;border:1.5px solid currentColor;opacity:.35}
.lp-st-side a.is-done .lp-st-ck{opacity:1;background:var(--success);border-color:var(--success);box-shadow:inset 0 0 0 3px var(--background)}
.lp-st-record{display:grid;gap:var(--sp-2)}
.lp-st-record-h{display:flex;justify-content:space-between;font-size:var(--fs-sm)}
.lp-st-record progress{width:100%;height:6px;accent-color:var(--primary)}
.lp-st-record small{color:var(--muted-foreground);font-size:var(--fs-xs)}
.lp-st-panels{display:grid;gap:var(--sp-8);min-width:0}
.lp-st{display:grid;gap:var(--sp-6);min-width:0}
.lp-st-shell.is-ready .lp-st{display:none}
.lp-st-shell.is-ready .lp-st.is-active{display:grid}
.lp-st-h{display:grid;grid-template-columns:auto 1fr;gap:var(--sp-5);align-items:start}
.lp-st-big{font-family:var(--font-num);font-weight:var(--num-weight);font-size:var(--fs-num);line-height:.9;color:var(--primary);letter-spacing:var(--display-tracking);font-variant-numeric:tabular-nums}
.lp-st-h div{display:grid;gap:var(--sp-2);justify-items:start}
.lp-st-h h3{font-family:var(--font-display);font-weight:var(--display-weight);font-size:var(--fs-h2s);letter-spacing:var(--display-tracking);line-height:1.25}
.lp-st-h p{color:var(--muted-foreground);max-width:var(--measure)}
.lp-st-h small{display:inline-flex;gap:4px;align-items:center;color:var(--muted-foreground);font-size:var(--fs-sm)}
.lp-st-links{display:flex;flex-wrap:wrap;gap:8px}
.lp-steps{list-style:none;counter-reset:st;display:grid;gap:var(--sp-4);max-width:44rem}
.lp-steps li{counter-increment:st;display:grid;grid-template-columns:2rem 1fr;gap:var(--sp-2)}
.lp-steps li::before{content:counter(st);font-family:var(--font-mono);font-weight:700;font-size:var(--fs-sm);color:var(--primary);font-variant-numeric:tabular-nums;padding-top:.15em}
.lp-st-images{border-top:var(--rule);border-bottom:var(--rule);padding:var(--sp-3) 0}
.lp-st-images summary{cursor:pointer;font-weight:650;font-size:var(--fs-sm)}
.lp-st-gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,220px),1fr));gap:10px;margin-top:12px}
.lp-st-gallery figure{margin:0}
.lp-st-gallery img{border-radius:6px;border:1px solid var(--rule-c);display:block}
.lp-st-gallery figcaption{font-size:var(--fs-xs);color:var(--muted-foreground);margin-top:4px}
.lp-prompts{display:grid;gap:var(--sp-5)}
.lp-prompts h4{font-size:var(--fs-sm);font-family:var(--font-sans);color:var(--muted-foreground)}
.lp-prompt{display:grid;gap:var(--sp-2)}
.lp-prompt-h{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
.lp-prompt-h b{font-weight:650}
.lp-prompt-h span{display:inline-flex;gap:8px;align-items:center}
.lp-prompt-text{width:100%;resize:vertical;border-radius:var(--radius-sm);border:1px solid color-mix(in srgb,var(--primary) 30%,var(--rule-c));background:color-mix(in srgb,var(--primary) 6%,var(--background));color:var(--foreground);padding:14px 16px;font-family:var(--font-sans);font-size:1rem;line-height:1.7;field-sizing:content;min-height:calc(2lh + 30px)}
.lp-st-help{display:grid;gap:6px;max-width:var(--measure);padding:var(--sp-4) var(--sp-5);border-radius:var(--radius-sm);border:1px solid var(--rule-c);background:var(--tint);font-size:var(--fs-sm)}
.lp-st-help b{display:inline-flex;gap:6px;align-items:center;color:var(--primary);font-weight:700;white-space:nowrap}
.lp-st-help p{color:var(--foreground)}
.lp-cal{margin-top:var(--sp-5)}
.lp-todo{padding:var(--sp-3) var(--sp-4);border:1.5px dashed var(--rule-c);border-radius:var(--radius-sm)}
.lp-prompt-text:focus{border-color:var(--ring);outline:none;box-shadow:0 0 0 3px color-mix(in srgb,var(--ring) 22%,transparent)}
.lp-prompt-lib{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,380px),1fr));gap:var(--sp-7) var(--sp-6)}
.lp-prompt-lib .lp-tags{margin-top:-4px}
.lp-st-done{display:grid;gap:var(--sp-4);padding-top:var(--sp-5);border-top:var(--rule)}
.lp-outcome b{margin-right:6px}
.lp-st-actions{display:flex;gap:10px;flex-wrap:wrap}
.lp-btn-check{background:transparent;border-color:color-mix(in srgb,var(--foreground) 22%,transparent);color:var(--foreground)}
.lp-btn-check[aria-pressed="true"]{background:var(--success);border-color:var(--success);color:#fff}
.lp-memo{display:grid;gap:6px;font-size:var(--fs-sm);font-weight:600}
.lp-memo textarea,.lp-compose textarea,.lp-reflect textarea,.lp-dialog input,.lp-compose input,.lp-compose select,.lp-login input{width:100%;border-radius:var(--radius-sm);border:var(--border-w) solid var(--border);background:var(--card);padding:10px 12px;font-weight:400}
.lp-st-pn{display:flex;justify-content:space-between;gap:10px}

/* 도구: 크기가 다른 칸(12칸 격자에 7·5, 5·7 …). 이름은 크게, 주소는 고정폭, 칸 전체가 링크. 첫 칸은 강조색 면 */
.lp-tools{list-style:none;display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:var(--sp-4)}
.lp-tools-item{position:relative;grid-column:span 12;display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-rows:auto minmax(0,1fr) auto auto;gap:var(--sp-2) var(--sp-4);min-height:clamp(176px,17vw,244px);padding:clamp(18px,2.2vw,30px);overflow:hidden;background:var(--card);color:var(--card-foreground);border:var(--border-w) solid var(--border);border-radius:var(--radius);transition:border-color var(--dur-2),transform var(--dur-2) var(--ease-out),box-shadow var(--dur-2)}
.lp-tools-item:has(h3 a):hover{border-color:var(--primary)}
.lp-tools-item:has(h3 a:focus-visible){outline:2px solid var(--ring);outline-offset:3px}
.lp-tools-no{grid-column:1;grid-row:1;font-family:var(--font-mono);font-size:var(--fs-xs);font-weight:600;color:var(--primary);font-variant-numeric:tabular-nums}
.lp-tools-host{grid-column:2;grid-row:1;justify-self:end;font-family:var(--font-mono);font-size:var(--fs-xs);color:var(--muted-foreground)}
.lp-tools-item h3{grid-column:1 / -1;grid-row:2;align-self:end;font-family:var(--font-display);font-weight:var(--display-weight);font-size:var(--fs-h2s);line-height:1.2;letter-spacing:var(--display-tracking)}
.lp-tools-item h3 a{display:inline-flex;align-items:center;gap:.3em;color:inherit;text-decoration:none;outline:0}
.lp-tools-item h3 a::after{content:"";position:absolute;inset:0;z-index:1}
.lp-tools-item h3 .lp-ic{width:.62em;height:.62em;color:var(--muted-foreground);transition:transform var(--dur-2) var(--ease-out),color var(--dur-2)}
.lp-tools-item:hover h3 .lp-ic{transform:translate(2px,-2px);color:var(--primary)}
.lp-tools-item p{grid-column:1 / -1;max-width:28em;font-size:var(--fs-sm);line-height:1.6;color:var(--muted-foreground)}
.lp-tools-item .lp-pages{grid-column:1 / -1;position:relative;z-index:2;justify-self:start}
.lp-tools-mark{position:absolute;right:.04em;bottom:-.2em;z-index:-1;font-family:var(--font-num);font-weight:var(--num-weight);font-size:clamp(7.5rem,15vw,13rem);line-height:.8;color:transparent;-webkit-text-stroke:1px color-mix(in srgb,var(--foreground) 11%,transparent);pointer-events:none;-webkit-user-select:none;user-select:none;transition:-webkit-text-stroke-color var(--dur-3)}
.lp-tools-item:hover .lp-tools-mark{-webkit-text-stroke-color:color-mix(in srgb,var(--primary) 50%,transparent)}
.lp-tools-item{isolation:isolate}
.lp-tools-item:first-child{--foreground:var(--band-fg,var(--primary-foreground));--muted-foreground:var(--band-fg,var(--primary-foreground));--card-foreground:var(--band-fg,var(--primary-foreground));--rule-c:color-mix(in srgb,var(--band-fg,var(--primary-foreground)) 40%,transparent);background:color-mix(in srgb,var(--band-primary,var(--primary)) var(--band-mix,100%),var(--card));color:var(--band-fg,var(--primary-foreground));border-color:transparent}
.lp-tools-item:first-child > *{--primary:var(--band-fg,var(--primary-foreground))}
.lp-tools-item:first-child:hover{border-color:var(--band-fg,var(--primary-foreground))}
[data-card="glass"] .lp-tools-item:not(:first-child){background:color-mix(in srgb,var(--card) 70%,transparent);border-color:color-mix(in srgb,var(--foreground) 13%,transparent)}
[data-card="paper"] .lp-tools-item{box-shadow:var(--shadow)}
@media (min-width:700px){.lp-tools-item[data-w="7"]{grid-column:span 7}.lp-tools-item[data-w="5"]{grid-column:span 5}.lp-tools-item[data-w="12"]{min-height:0}}
.lp-pages{font-size:var(--fs-xs);color:var(--muted-foreground)} /* 한 줄 글: 칸 사이 틈(gap)으로 "교재 3 쪽"처럼 벌어지지 않게 */
.lp-pages a{font-family:var(--font-mono);color:var(--foreground);text-decoration:underline;text-decoration-color:var(--rule-c);padding:1px 8px;margin:-1px -8px} /* 쪽 번호 한 글자도 누르는 곳은 24px(여백만큼 바깥 여백을 빼 배치는 그대로) */

/* 자료: 한 줄씩(형식 · 제목 · 크기 · 받기) */
.lp-materials{list-style:none;display:grid;border-bottom:var(--rule)}
.lp-materials li{display:grid;grid-template-columns:4.5rem minmax(0,1fr) auto;gap:var(--sp-4);align-items:center;padding:var(--sp-5) 0;border-top:var(--rule)}
.lp-materials h3{font-size:var(--fs-md);font-weight:700}
.lp-materials-live{margin-top:var(--sp-5)}
.lp-materials+.lp-materials-live{margin-top:0;border-top:0}
.lp-quick-poll{display:grid;gap:4px;padding-bottom:var(--sp-3);margin-bottom:var(--sp-3);border-bottom:1px solid var(--rule-c)}
.lp-materials p,.lp-materials small{color:var(--muted-foreground);font-size:var(--fs-sm)}
.lp-file-kind{font-family:var(--font-mono);font-size:var(--fs-xs);font-weight:700;color:var(--primary);align-self:baseline;padding-top:.3em}
.lp-notice-box{margin-top:var(--sp-5);display:grid;gap:4px;font-size:var(--fs-sm);color:var(--muted-foreground);max-width:var(--measure)}
.lp-notice-box b{color:var(--foreground)}

/* 사람: 큰 이름 + 소개(왼쪽), 이력 표(오른쪽) */
.lp-person{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:clamp(28px,5vw,88px);align-items:start}
.lp-person+.lp-person{margin-top:var(--sp-8);padding-top:var(--sp-8);border-top:var(--rule)}
.lp-person-card{display:grid;gap:var(--sp-3);justify-items:start}
.lp-avatar{width:104px;height:104px;border-radius:50%;object-fit:cover}
.lp-avatar-text{display:grid;place-items:center;background:var(--background);color:var(--primary);font-family:var(--font-display);font-size:var(--fs-h2s);font-weight:var(--display-weight);border:var(--border-w) solid var(--rule-c)}
.lp-person-card h3{margin-top:var(--sp-2);font-family:var(--font-display);font-weight:var(--display-weight);font-size:var(--fs-xl);line-height:1.15;letter-spacing:var(--display-tracking)}
.lp-person-role{color:var(--muted-foreground);font-size:var(--fs-sm);font-weight:600}
.lp-person-bio{max-width:var(--measure);font-size:var(--fs-base)}
.lp-contact{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding-top:var(--sp-3);border-top:var(--rule);width:100%}
.lp-email{font-family:var(--font-mono);font-size:var(--fs-sm);user-select:all}
.lp-person-links{display:flex;flex-wrap:wrap;gap:var(--sp-4)}
.lp-timeline{display:grid;grid-template-columns:minmax(0,1fr);border-top:max(2px,var(--border-w)) solid var(--foreground)}
.lp-tl-group{display:grid;grid-template-columns:minmax(4em,1fr) minmax(0,5fr);gap:var(--sp-4);padding:var(--sp-4) 0;border-bottom:var(--rule)}
.lp-tl-group h4{padding-top:var(--sp-2);font-size:var(--fs-sm);font-family:var(--font-sans);font-weight:700;color:var(--primary)}
.lp-tl-group ul{list-style:none;display:grid}
.lp-tl-group li{display:flex;justify-content:space-between;align-items:baseline;gap:var(--sp-4);padding:var(--sp-2) 0;font-weight:600}
.lp-tl-group li + li{border-top:var(--rule)}
.lp-tl-group small{font-family:var(--font-mono);color:var(--muted-foreground);white-space:nowrap;font-size:var(--fs-xs);font-weight:400;font-variant-numeric:tabular-nums}
.lp-speakers{list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,240px),1fr));gap:var(--sp-7) var(--sp-6)}
.lp-speakers li{display:grid;gap:var(--sp-2);justify-items:start;align-content:start;padding-top:var(--sp-5);border-top:var(--rule)}
.lp-speakers .lp-avatar{width:72px;height:72px;font-size:var(--fs-lg)}
.lp-speakers h3{font-size:var(--fs-lg)}
.lp-speakers small{display:inline-flex;gap:4px;align-items:center;color:var(--muted-foreground);font-size:var(--fs-sm)}
.lp-sessions{list-style:none;display:grid;border-bottom:var(--rule)}
.lp-sessions li{display:grid;grid-template-columns:4.5rem minmax(0,1fr) auto;gap:var(--sp-4);padding:var(--sp-5) 0;border-top:var(--rule);align-items:baseline}
.lp-sessions .lp-idx{font-size:var(--fs-sm)}
.lp-sessions li[data-status="now"]{background:linear-gradient(90deg,color-mix(in srgb,var(--primary) 9%,transparent),transparent 85%)}
.lp-sessions li[data-status="done"]{color:var(--muted-foreground)}
.lp-sessions h3{font-size:var(--fs-md);font-family:var(--font-sans);font-weight:700}
.lp-sessions small{font-size:var(--fs-sm);color:var(--muted-foreground)}
.lp-sessions p{font-size:var(--fs-sm);color:var(--muted-foreground)}
.lp-sessions .lp-chip,.lp-status{font-size:var(--fs-xs);font-weight:700;color:var(--muted-foreground)}
.lp-sessions li[data-status="now"] .lp-chip,.lp-sessions li[data-status="now"] .lp-status{color:var(--primary)}

/* 참여 */
.lp-compose{display:grid;gap:var(--sp-3)}
.lp-compose-f{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
.lp-compose-f small{color:var(--muted-foreground);font-size:var(--fs-sm)}
.lp-tabs{display:flex;gap:var(--sp-5);flex-wrap:wrap;margin:var(--sp-6) 0 0;border-bottom:var(--rule)}
.lp-tabs button{border:0;background:transparent;padding:10px 0;margin-bottom:-1px;font-size:var(--fs-sm);font-weight:600;cursor:pointer;color:var(--muted-foreground);border-bottom:2px solid transparent}
.lp-tabs button:hover{color:var(--foreground)}
.lp-tabs button[aria-pressed="true"]{color:var(--foreground);border-bottom-color:var(--primary)}
.lp-qa-list{list-style:none;display:grid}
.lp-qa-item{display:grid;grid-template-columns:auto 1fr;gap:var(--sp-4);padding:var(--sp-4) 0;border-bottom:var(--rule)}
.lp-qa-item.is-pinned{background:linear-gradient(90deg,color-mix(in srgb,var(--primary) 9%,transparent),transparent 85%)}
.lp-qa-item.is-answered{opacity:.7}
.lp-vote{display:grid;justify-items:center;align-content:start;gap:2px;min-width:3.2em;min-height:44px;padding:6px;border-radius:var(--radius-sm);border:1px solid var(--rule-c);background:transparent;cursor:pointer;font-weight:700;font-variant-numeric:tabular-nums}
.lp-vote[aria-pressed="true"]{background:var(--primary);color:var(--primary-foreground);border-color:var(--primary)}
.lp-qa-meta{font-size:var(--fs-xs);color:var(--muted-foreground);display:flex;gap:8px;margin-top:4px}
.lp-board-bar{display:flex;justify-content:space-between;align-items:end;gap:12px;flex-wrap:wrap;border-bottom:var(--rule)}
.lp-board-bar .lp-tabs{margin:0;border-bottom:0}
.lp-board-bar .lp-btn{margin-bottom:var(--sp-2)}
.lp-board-form{margin:var(--sp-5) 0}
.lp-seg{display:flex;gap:0;border:0;padding:0;margin:0}
.lp-seg label{cursor:pointer;position:relative}
.lp-seg input{position:absolute;opacity:0;width:1px;height:1px;left:0;top:0;pointer-events:none}
.lp-seg span{display:inline-block;padding:8px 14px;border:1px solid var(--rule-c);font-size:var(--fs-sm);margin-left:-1px}
.lp-seg label:first-child span{border-radius:var(--radius-sm) 0 0 var(--radius-sm);margin-left:0}
.lp-seg label:last-child span{border-radius:0 var(--radius-sm) var(--radius-sm) 0}
.lp-seg input:checked+span{background:var(--foreground);color:var(--background);border-color:var(--foreground)}
.lp-seg input:focus-visible+span{outline:2px solid var(--ring)}
.lp-file,.lp-inline{display:grid;gap:4px;font-size:var(--fs-sm)}
.lp-board-grid{list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,260px),1fr));gap:var(--sp-4);margin-top:var(--sp-5)}
.lp-board-grid>.lp-empty{grid-column:1 / -1}
.lp-post{padding:var(--sp-4);display:grid;gap:10px;align-content:start}
.lp-post-files{display:grid;gap:6px}
.lp-post-files img{border-radius:6px;display:block;max-height:220px;width:100%;object-fit:cover}
.lp-post-files audio,.lp-post-files video{width:100%}
.lp-post-f{display:flex;justify-content:space-between;align-items:center;font-size:var(--fs-xs);color:var(--muted-foreground)}
.lp-like{display:inline-flex;gap:4px;align-items:center;border:0;background:none;color:inherit;cursor:pointer;font-weight:600;min-height:32px}
.lp-like[aria-pressed="true"]{color:var(--danger)}
.lp-poll-live{padding:var(--sp-5);border-radius:var(--radius);background:var(--tint);display:grid;gap:var(--sp-3)}
.lp-poll-live>.lp-empty{border:0;padding:var(--sp-2) 0}
/* 빈 상태: 회색 막대(불러오는 중처럼 보이는 뼈대)·점선 상자 없이 안내 한 줄. 할 일(질문 쓰기·글쓰기)은 바로 위 양식·단추 */
.lp-poll-live:has(>.lp-empty){background:none;border:0;padding-inline:0}
.lp-qa-list>.lp-empty,.lp-board-grid>.lp-empty{padding:var(--sp-4) 0;border:0;font-weight:600}
.lp-poll-opts{display:grid;gap:8px}
.lp-poll-opts button{text-align:left;padding:12px 16px;border-radius:var(--radius-sm);border:var(--border-w) solid var(--border);background:var(--card);color:var(--card-foreground);cursor:pointer;font-weight:600;min-height:44px}
.lp-poll-opts button[aria-pressed="true"]{border-color:var(--primary);background:color-mix(in srgb,var(--primary) 12%,var(--background))}
.lp-bars{display:grid;gap:8px}
.lp-bar{display:grid;gap:4px;font-size:var(--fs-sm)}
.lp-bar-track{height:10px;border-radius:2px;background:var(--tint);overflow:hidden}
.lp-bar-fill{height:100%;width:var(--w,0%);background:var(--primary);transition:width var(--dur-4) var(--ease-out)}
.lp-cloud{display:flex;flex-wrap:wrap;gap:6px 14px;justify-content:center;align-items:center;padding:12px}
.lp-cloud span{font-weight:800;line-height:1.1;color:var(--primary)}
.lp-cloud span:nth-child(3n+2){color:var(--accent-2)}
.lp-cloud span:nth-child(3n){color:var(--foreground)}
.lp-poll-list{margin-top:var(--sp-3);font-size:var(--fs-sm);color:var(--muted-foreground)}
.lp-poll-list ol{padding-left:1.4em;margin-top:6px}
.lp-quiz{list-style:none;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,400px),1fr));column-gap:clamp(32px,5vw,72px);border-bottom:var(--rule)}
.lp-quiz>li{padding:var(--sp-6) 0;border-top:var(--rule)}
.lp-quiz fieldset{border:0;margin:0;padding:0;display:grid;gap:8px}
.lp-quiz legend{font-weight:700;font-size:var(--fs-md);margin-bottom:var(--sp-3);display:flex;gap:var(--sp-3);align-items:baseline}
.lp-quiz label{display:flex;gap:10px;align-items:center;min-height:44px;padding:10px 12px;border-radius:var(--radius-sm);border:1px solid var(--rule-c);cursor:pointer}
.lp-quiz label:hover{border-color:color-mix(in srgb,var(--foreground) 40%,transparent)}
.lp-quiz label.is-right{border-color:var(--success);background:color-mix(in srgb,var(--success) 10%,transparent)}
.lp-quiz label.is-wrong{border-color:var(--danger);background:color-mix(in srgb,var(--danger) 8%,transparent)}
.lp-quiz input{accent-color:var(--primary)}
.lp-quiz-fb{font-size:var(--fs-sm);margin-top:8px}
.lp-attend{display:grid;gap:12px;justify-items:start}
.lp-reflect{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:var(--sp-5) var(--sp-5);align-items:start}
.lp-reflect > .lp-compose-f{grid-column:1 / -1}
.lp-reflect label span{min-height:3em;display:grid;align-content:end}
.lp-reflect textarea{min-height:9.5rem}
.lp-reflect label{display:grid;gap:6px;font-weight:600}

/* 설문·마무리 */
.lp-survey{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:clamp(24px,5vw,72px);align-items:center;padding-top:var(--sp-6);border-top:var(--rule)}
.lp-survey>div{display:grid;gap:var(--sp-4);justify-items:start}
.lp-survey-form{display:grid;gap:var(--sp-5)}
.lp-sv-list{list-style:none;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,440px),1fr));column-gap:clamp(32px,5vw,72px);border-bottom:var(--rule)}
.lp-sv-list > li:has(.lp-sv-text){grid-column:1 / -1}
.lp-sv-text textarea{max-width:52rem}
.lp-sv-list>li{padding:var(--sp-6) 0;border-top:var(--rule)}
.lp-sv-list fieldset{border:0;margin:0;padding:0;display:grid;gap:var(--sp-3)}
.lp-sv-list legend,.lp-sv-q{font-weight:700;font-size:var(--fs-md);display:flex;gap:var(--sp-3);align-items:baseline;margin-bottom:var(--sp-2)}
.lp-sv-list .lp-idx{flex:none;white-space:nowrap} /* 문항 번호 '04'가 휴대폰에서 '0/4'로 쪼개지지 않게 */
.lp-sv-text{display:grid;gap:8px}
.lp-sv-text textarea{width:100%;border-radius:var(--radius-sm);border:var(--border-w) solid var(--border);background:var(--card);padding:10px 12px}
.lp-sv-opts{display:flex;flex-wrap:wrap;gap:8px}
.lp-sv-opts label{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:8px 14px;border-radius:var(--radius-sm);border:var(--border-w) solid var(--border);cursor:pointer;background:var(--card);color:var(--card-foreground)}
.lp-sv-opts label:has(input:checked){border-color:var(--primary);background:color-mix(in srgb,var(--primary) 10%,transparent)}
.lp-sv-opts input{accent-color:var(--primary)}
/* 5점 척도: 숫자 칸 다섯 개가 한 줄로 이어진 눈금. 고르면 칸 전체가 강조색 */
.lp-sv-scale .lp-sv-opts{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:0}
.lp-sv-scale label{position:relative;justify-content:center;align-items:flex-start;min-height:72px;padding:10px 4px;border-radius:0;text-align:center}
.lp-sv-scale label + label{margin-left:calc(var(--border-w) * -1)}
.lp-sv-scale label:first-child{border-radius:var(--radius-sm) 0 0 var(--radius-sm)}
.lp-sv-scale label:last-child{border-radius:0 var(--radius-sm) var(--radius-sm) 0}
.lp-sv-scale input{position:absolute;opacity:0;width:1px;height:1px}
.lp-sv-scale label:has(input:checked){z-index:1;background:var(--primary);border-color:var(--primary);color:var(--primary-foreground)}
.lp-sv-scale label:has(input:focus-visible){z-index:2;outline:2px solid var(--ring);outline-offset:2px}
.lp-sv-scale label span{display:grid;gap:2px;line-height:1.3}
.lp-sv-scale label b{font-family:var(--font-mono);font-size:var(--fs-md);font-variant-numeric:tabular-nums}
.lp-sv-scale label i{font-style:normal;font-size:var(--fs-xs);word-break:keep-all;overflow-wrap:break-word}
/* 휴대폰도 한 줄 다섯 칸(세로 다섯 줄로 길어지지 않게). 칸이 좁아 '보통이에요'가 음절 중간에서 끊기므로 낱말은 양 끝(1·5)만 보이고 가운데는 화면 낭독기에만 */
@media (max-width:600px){.lp-sv-scale label{min-height:64px;padding:8px 2px}.lp-sv-scale label:not(:first-child):not(:last-child) i{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}}
/* :has()를 모르는 브라우저(iOS 15.3 이하·예전 앱 안 브라우저): 고른 답과 초점을 글자 칸(span)에 표시 */
@supports not selector(:has(*)){
  .lp-sv-opts input:checked + span{font-weight:800;text-decoration:underline;text-underline-offset:3px}
  .lp-sv-scale input:checked + span{border-radius:var(--radius-sm);background:var(--primary);color:var(--primary-foreground);box-shadow:0 0 0 6px var(--primary)}
  .lp-sv-scale input:focus-visible + span{outline:2px solid var(--ring);outline-offset:6px}
}
/* QR: 둘레 여백 4칸은 그림(SVG) 안에 들어 있음. 어떤 테마에서도 흰 바탕에 검은 점 */
.lp-qr{width:200px;aspect-ratio:1;background:#fff;border-radius:8px;padding:4px;display:grid;place-items:center}
.lp-qr svg,.lp-qr img{width:100%;height:auto;display:block}
.lp-qr-lg{width:min(280px,70vw);margin:0 auto}
.lp-qr-off{font-size:.86rem;line-height:1.45;color:#333;text-align:center;padding:8px;word-break:keep-all;overflow-wrap:anywhere}
/* 마무리: 화면 폭 띠에 아주 큰 문장 + 서명 줄. 프리셋의 첫 화면 표식을 한 번 더 써서 끝을 맺음(.lp-closing--구성) */
.lp-closing{display:grid;align-content:center;min-height:min(86svh,820px);overflow:hidden;overflow:clip;padding-block:clamp(88px,12vw,176px) clamp(56px,7vw,104px)}
.lp-closing > .lp-wrap{position:relative;display:grid;gap:var(--sp-5);justify-items:start}
.lp-closing-lead{max-width:22em;font-size:var(--fs-goal);font-weight:600;line-height:1.5;letter-spacing:-.015em;color:var(--muted-foreground);text-wrap:balance}
.lp-closing-text{max-width:11.5em;font-family:var(--font-display);font-weight:var(--display-weight);font-size:var(--fs-closing);line-height:1.1;letter-spacing:var(--display-tracking);text-wrap:balance}
.lp-closing-foot{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:var(--sp-3) var(--sp-7);width:100%;margin-top:clamp(28px,5vw,72px);padding-top:var(--sp-4);border-top:1px solid var(--rule-c)}
.lp-closing-thanks{font-size:var(--fs-md);font-weight:700}
.lp-closing-sign{display:flex;flex-wrap:wrap;font-size:var(--fs-sm);color:var(--muted-foreground)}
.lp-closing-sign span + span::before{content:"·";margin:0 .6em}
/* 스크롤 연출 단계: 이 연수의 낱말이 아래 띠로 흐름. 가벼운 모드·동작 줄이기에서는 멈춘 한 줄 */
.lp-closing-band{margin-top:clamp(40px,6vw,88px);overflow:hidden;border-block:1px solid var(--rule-c)}
.lp-closing-band ul{list-style:none;display:flex;flex-wrap:wrap;justify-content:center;row-gap:var(--sp-2);padding:var(--sp-4) 0;font-family:var(--font-display);font-weight:var(--display-weight);font-size:var(--fs-h2s);line-height:1.2;letter-spacing:var(--display-tracking);white-space:nowrap}
.lp-closing-band li{display:inline-flex;align-items:center;gap:var(--sp-6);padding-left:var(--sp-6)}
.lp-closing-band li::after{content:"";width:.34em;height:.34em;border-radius:50%;background:var(--primary)}
.lp-closing-band li:last-child::after{display:none}
.lp-closing-band li:nth-child(even){color:color-mix(in srgb,var(--foreground) 46%,transparent)} /* 한글은 윤곽선(text-stroke)이면 획이 겹친 선이 보여 옅은 채움으로 */
/* 구성별 표식 */
.lp-closing .lp-cine-date{top:auto;bottom:-.06em;right:-.03em}
.lp-closing.lp-closing--cinema{background:radial-gradient(90% 60% at 50% 124%,color-mix(in srgb,var(--hero-from) 46%,transparent),transparent 72%),linear-gradient(180deg,var(--background) 20%,color-mix(in srgb,var(--background) 80%,var(--hero-to)) 150%)}
.lp-closing--quiet{padding-bottom:clamp(120px,17vw,240px)}
.lp-closing.lp-closing--invite{padding-bottom:clamp(140px,19vw,280px);background:linear-gradient(180deg,var(--surface-2) 0%,var(--background) 46%,color-mix(in srgb,var(--hero-from) 34%,var(--background)) 100%)}
.lp-closing--invite .lp-sun{right:clamp(-80px,4vw,120px);width:min(52vw,600px)}
.lp-closing--zine .lp-closing-text{color:var(--primary);text-shadow:-.034em .03em 0 color-mix(in srgb,var(--accent) 84%,transparent)}
.lp-closing--zine .lp-halftone{opacity:.5}
.lp-closing--sticker .lp-closing-text{text-shadow:.04em .045em 0 color-mix(in srgb,var(--accent) 80%,var(--foreground))}
.lp-closing-stk{position:absolute;right:clamp(16px,6vw,96px);top:clamp(24px,5vw,72px);display:grid;place-content:center;justify-items:center;gap:2px;width:clamp(7rem,13vw,11.5rem);aspect-ratio:1;margin:0;border-radius:50%;background:var(--accent-3);color:var(--accent-3-foreground);border:var(--border-w) solid var(--accent-3-foreground);box-shadow:5px 6px 0 var(--accent-3-foreground);transform:rotate(9deg);font-weight:700;font-size:var(--fs-sm);line-height:1.2}
.lp-closing-stk b{font-family:var(--font-num);font-weight:var(--num-weight);font-size:var(--fs-h2s);line-height:1}
.lp-closing--poster .lp-closing-text{padding:.18em .32em .22em;background:var(--card);color:var(--card-foreground);border:3px solid var(--card-foreground);border-radius:var(--radius-sm);box-shadow:10px 10px 0 var(--card-foreground);transform:rotate(-1.4deg);transform-origin:0 100%}
.lp-closing.lp-closing--board{--background:#1f3a30;--foreground:#eef2e9;--muted-foreground:#bccabd;--primary:#f2d35e;--card:#264638;--card-foreground:#eef2e9;--rule-c:rgba(238,242,233,.24);margin:0 clamp(12px,3vw,40px) clamp(24px,4vw,56px);background:radial-gradient(80% 60% at 28% 18%,rgba(255,255,255,.055),transparent 70%),#1f3a30;color:var(--foreground);border:clamp(8px,1vw,14px) solid #8a5a33;border-radius:10px;box-shadow:inset 0 0 0 2px rgba(0,0,0,.28),inset 0 0 64px rgba(0,0,0,.26)}
.lp-closing--board .lp-closing-text{color:var(--primary)}
.lp-closing--spec .lp-closing-text{padding-bottom:.3em;background:linear-gradient(var(--primary),var(--primary)) 0 100%/100% 1px no-repeat,linear-gradient(var(--primary),var(--primary)) 0 100%/1px .22em no-repeat,linear-gradient(var(--primary),var(--primary)) 100% 100%/1px .22em no-repeat}
.lp-closing--spec .lp-closing-sign,.lp-closing--zine .lp-closing-sign{font-family:var(--font-mono);word-spacing:-.3em} /* 고정폭 글꼴의 빈칸(0.6em)이 한글 사이에서 두 칸처럼 보이지 않게 */
.lp-closing--masthead .lp-closing-foot{border-top:3px double var(--foreground)}
.lp-closing--masthead .lp-closing-text::after{content:"";display:inline-block;width:.34em;height:.34em;margin-left:.2em;background:var(--primary)}
.lp-closing--brief::before{content:"";position:absolute;inset:0 0 auto 0;height:6px;background:linear-gradient(90deg,var(--primary) 0 30%,var(--accent) 30% 62%,color-mix(in srgb,var(--accent) 42%,var(--background)) 62%)}
.lp-closing.lp-closing--bento{background:radial-gradient(58% 60% at 8% 110%,color-mix(in srgb,var(--accent-3) 16%,transparent),transparent 70%),radial-gradient(50% 60% at 96% -6%,color-mix(in srgb,var(--accent) 16%,transparent),transparent 70%),var(--surface-2)}
.lp-closing-check{position:absolute;right:clamp(20px,7vw,112px);top:clamp(28px,5vw,72px);width:clamp(56px,8vw,112px);aspect-ratio:1;border:max(3px,.34vw) solid currentColor;border-radius:14%;transform:rotate(6deg)}
.lp-closing-check::after{content:"";position:absolute;left:32%;top:6%;width:32%;height:62%;border:solid currentColor;border-width:0 max(5px,.7vw) max(5px,.7vw) 0;transform:rotate(42deg)}
/* 보통 단계부터 마무리 문장이 스크롤에 맞춰 자리 잡음(따로 효과가 붙지 않았을 때) */
@media (prefers-reduced-motion:no-preference){@supports (animation-timeline:view()){
  html:is([data-motion="2"],[data-motion="3"]):not([data-rest="1"]):not(.lp-paused):not(.fx-paused) .lp-closing-text:not([data-fx]){animation:lp-closing-in linear both;animation-timeline:view();animation-range:entry 10% cover 42%}
  html[data-motion="3"]:not([data-rest="1"]):not(.lp-paused):not(.fx-paused) .lp-closing-lead{animation:lp-w-fill linear both;animation-timeline:view();animation-range:entry 20% cover 30%}
}}
@keyframes lp-closing-in{from{opacity:.5;transform:translate3d(0,.4em,0) scale(.94)}}

/* FAQ: 번호가 붙은 질문 줄 */
.lp-faq{display:grid;grid-template-columns:minmax(0,1fr);align-items:start;max-width:48rem;counter-reset:lp-faq}
.lp-faq details{border-top:var(--rule)}
.lp-faq details:last-child{border-bottom:var(--rule)}
.lp-faq summary{cursor:pointer;font-weight:700;font-size:var(--fs-md);line-height:1.5;list-style:none;display:grid;grid-template-columns:2.4em minmax(0,1fr) auto;gap:var(--sp-2);align-items:baseline;padding:var(--sp-5) 0;min-height:44px}
.lp-faq summary::-webkit-details-marker{display:none}
.lp-faq summary::before{counter-increment:lp-faq;content:counter(lp-faq,decimal-leading-zero);font-family:var(--font-mono);font-size:var(--fs-xs);font-weight:600;color:var(--primary);font-variant-numeric:tabular-nums}
.lp-faq summary::after{content:"";flex:none;width:12px;height:12px;align-self:center;background:linear-gradient(currentColor,currentColor) center/100% 1.5px no-repeat,linear-gradient(currentColor,currentColor) center/1.5px 100% no-repeat;transition:transform var(--dur-2) var(--ease-out);color:var(--muted-foreground)}
.lp-faq details[open] summary::after{transform:rotate(45deg)}
.lp-faq details[open] summary{color:var(--primary)}
.lp-faq details>div{padding:0 0 var(--sp-5) calc(2.4em + var(--sp-2));color:var(--muted-foreground);display:grid;gap:var(--sp-3);max-width:var(--measure)}
/* 용어: 큰 낱말 왼쪽, 풀이 오른쪽의 색인 */
.lp-glossary{display:grid;grid-template-columns:minmax(0,1fr);margin:0;border-top:max(2px,var(--border-w)) solid var(--foreground)}
.lp-glossary div{display:grid;gap:var(--sp-1) clamp(20px,4vw,64px);align-items:baseline;padding:var(--sp-5) 0;border-bottom:var(--rule)}
.lp-glossary dt{font-family:var(--font-display);font-weight:var(--display-weight);font-size:var(--fs-lg);line-height:1.3;letter-spacing:var(--display-tracking)}
.lp-glossary dd{margin:0;max-width:var(--measure);color:var(--muted-foreground)}
@media (min-width:800px){.lp-glossary div{grid-template-columns:minmax(0,4fr) minmax(0,8fr)}}
.lp-videos,.lp-gallery{list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,280px),1fr));gap:var(--sp-6) var(--sp-5)}
.lp-video-link{display:grid;gap:var(--sp-2);text-decoration:none;color:var(--foreground)}
.lp-video-link img,.lp-video-ph{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:min(var(--radius),10px);background:var(--tint);display:grid;place-items:center}
.lp-video-t{font-weight:650}
.lp-video-t small{color:var(--muted-foreground);font-weight:400}
.lp-gallery figure{margin:0}
.lp-gallery img{border-radius:min(var(--radius),10px);display:block;aspect-ratio:4/3;object-fit:cover;width:100%}
.lp-gallery figcaption{font-size:var(--fs-sm);color:var(--muted-foreground);margin-top:6px}
.lp-prose{max-width:var(--measure);display:grid;gap:var(--sp-4)}
.lp-prose ul,.lp-prose ol{padding-left:1.3em}
.lp-prose h2{font-size:var(--fs-lg);font-family:var(--font-sans);margin-top:var(--sp-3)}
.lp-prose h3{font-size:var(--fs-md)}

/* 바닥글 */
.lp-foot{padding-block:var(--sp-8) calc(var(--sp-8) + env(safe-area-inset-bottom,0px));border-top:var(--rule);background:var(--background);font-size:var(--fs-sm);color:var(--muted-foreground)}
.lp-foot .lp-wrap{display:grid;gap:var(--sp-5)}
.lp-foot-title{font-weight:700;color:var(--foreground)}
.lp-foot-links,.lp-foot-meta{display:flex;flex-wrap:wrap;gap:8px 20px}
.lp-foot a{color:inherit}
.lp-totop{margin-left:auto;display:inline-flex;gap:4px;align-items:center}

/* 실시간 도크·대화상자·알림 */
.lp-dock{position:fixed;right:max(14px,env(safe-area-inset-right,0px));bottom:calc(14px + env(safe-area-inset-bottom,0px));z-index:50;display:flex;gap:6px;align-items:center;padding:6px;border-radius:999px;background:var(--card);border:1px solid var(--rule-c);box-shadow:0 6px 20px rgba(0,0,0,.14)}
.lp-btn-dock{min-height:44px;border-radius:999px;background:var(--foreground);color:var(--background);padding:.4em 1em;font-size:var(--fs-sm)}
/* 도크의 접는 단추(이해 정도·반응): 도크에는 단추 하나, 누르면 위로 펼침(휴대폰에서도 도크가 한 줄) */
.lp-fold{position:relative;display:flex}
.lp-fold-btn{display:grid;place-items:center;width:44px;height:44px;border:0;border-radius:50%;background:transparent;color:var(--foreground);cursor:pointer;transition:background var(--dur-2)}
.lp-fold-btn:hover,.lp-fold.is-open > .lp-fold-btn{background:var(--tint)}
.lp-fold-btn .lp-ic{width:22px;height:22px}
.lp-fold-list{display:none;position:absolute;right:-6px;bottom:calc(100% + 14px);gap:2px;padding:6px;border-radius:var(--radius-lg);background:var(--card);border:1px solid var(--rule-c);box-shadow:0 10px 30px rgba(0,0,0,.18)}
.lp-fold.is-open > .lp-fold-list{display:flex}
.lp-fold-list button{display:flex;align-items:center;justify-content:center;gap:10px;min-width:44px;min-height:44px;border:0;border-radius:var(--radius-sm);background:transparent;color:var(--foreground);font:inherit;font-size:var(--fs-sm);font-weight:600;cursor:pointer;white-space:nowrap;transition:background var(--dur-2),transform var(--dur-1) var(--ease-out)}
.lp-fold-list button:hover{background:var(--tint)}
.lp-fold-list button:active{transform:scale(.96)}
.lp-react .lp-fold-list button .lp-ic{width:22px;height:22px}
.lp-signal .lp-fold-list{flex-direction:column}
.lp-signal .lp-fold-list button{justify-content:flex-start;padding:6px 14px 6px 8px}
.lp-signal .lp-fold-list button[aria-pressed="true"]{background:var(--tint);box-shadow:inset 0 0 0 2px var(--foreground)}
/* 첫 화면이 화면 아래쪽에 걸려 있는 동안은 도크를 숨김(첫 화면을 가리지 않게). 키보드로 들어오면 바로 보임 */
.lp-dock{transition:opacity var(--dur-3),transform var(--dur-3) var(--ease-out)}
html.lp-hero-in .lp-dock:not(:focus-within){opacity:0;pointer-events:none;transform:translateY(16px)}
/* 아래 떠 있는 도크가 Tab으로 옮긴 칸을 가리지 않게(--lp-dock-h는 lecpage.js가 도크 높이로 넣음) */
html.lp-dock-on{scroll-padding-bottom:calc(var(--lp-dock-h,58px) + 30px + env(safe-area-inset-bottom,0px))}
.lp-signal i{flex:none;width:24px;height:24px;border-radius:50%;display:grid;place-items:center;font-style:normal;font-weight:800;font-size:.8rem;line-height:1;color:#fff}
.lp-signal [data-signal="green"] i,.lp-signal i[data-v="green"]{background:#1f7a46}.lp-signal [data-signal="yellow"] i,.lp-signal i[data-v="yellow"]{background:#e8b100;color:#111}.lp-signal [data-signal="red"] i,.lp-signal i[data-v="red"]{background:#c4302b}
/* 아직 보내지 않았으면 신호등 세 점 */
.lp-signal i[data-signal-now]:not([data-v]){width:28px;border-radius:0;background:radial-gradient(circle,#1f7a46 3.5px,transparent 4px) 0 50%/9.33px 100%,radial-gradient(circle,#e8b100 3.5px,transparent 4px) 50% 50%/9.33px 100%,radial-gradient(circle,#c4302b 3.5px,transparent 4px) 100% 50%/9.33px 100%;background-repeat:no-repeat}
.lp-signal-bar{display:flex;height:18px;border-radius:4px;overflow:hidden;background:var(--muted)}
.lp-signal-bar i{display:block;height:100%}
.lp-live-dot{width:10px;height:10px;border-radius:50%;background:var(--muted-foreground);margin:0 4px}
.lp-live-dot[data-state="live"]{background:var(--success)}
.lp-live-dot[data-state="polling"]{background:var(--warning)}
.lp-live-dot[data-state="offline"]{background:var(--danger)}
.lp-dialog{border:0;border-radius:var(--radius-lg);padding:0;background:var(--card);color:var(--foreground);box-shadow:0 24px 64px rgba(0,0,0,.3);width:min(440px,calc(100% - 32px));overscroll-behavior:contain}
.lp-dialog::backdrop{background:rgba(0,0,0,.5)}
.lp-dialog-in{display:grid;gap:14px;padding:24px}
.lp-dialog h2{font-size:1.3rem;font-family:var(--font-sans);font-weight:700;letter-spacing:-.01em}
.lp-dialog label{display:grid;gap:4px;font-size:var(--fs-sm);font-weight:600}
.lp-consent{grid-template-columns:auto 1fr!important;align-items:start;font-weight:400!important;font-size:.84rem!important;color:var(--muted-foreground)}
.lp-share-url{font-family:var(--font-mono);font-size:.84rem;word-break:break-all;text-align:center;color:var(--muted-foreground)}
.lp-share-full{font-family:var(--font-mono);font-size:.76rem;word-break:break-all;text-align:center;color:var(--muted-foreground);margin-top:-8px}
.lp-share-full:not([hidden])~.lp-share-off{display:none}
.lp-share-code{text-align:center}
.lp-share-code b{font-family:var(--font-mono);font-size:1.4rem;letter-spacing:.12em}
.lp-share-scr{text-align:center;color:var(--muted-foreground)}
.lp-share-scr a{font-weight:700;color:var(--foreground);text-decoration:underline;text-underline-offset:2px}
.lp-toast{position:fixed;left:50%;bottom:calc(84px + env(safe-area-inset-bottom,0px));transform:translate(-50%,20px);z-index:90;background:var(--foreground);color:var(--background);padding:10px 18px;border-radius:var(--radius-sm);font-weight:600;font-size:var(--fs-sm);opacity:0;pointer-events:none;transition:opacity var(--dur-2),transform var(--dur-3) var(--ease-out);max-width:calc(100% - 32px);text-align:center}
.lp-toast.is-on{opacity:1;transform:translate(-50%,0)}
html.lp-dock-on .lp-toast{bottom:calc(var(--lp-dock-h,58px) + 26px + env(safe-area-inset-bottom,0px))}
html.lp-dock-on .lp-foot{padding-bottom:calc(var(--lp-dock-h,58px) + 48px + env(safe-area-inset-bottom,0px))}
.lp-reactions{position:fixed;right:24px;bottom:90px;width:60px;height:60vh;pointer-events:none;z-index:44}
.lp-reactions span{position:absolute;bottom:0;font-size:2rem;color:var(--primary);animation:lp-float 2.6s var(--ease-out) forwards}
.lp-reactions span .lp-ic{display:block;width:2rem;height:2rem;stroke-width:2}
@keyframes lp-float{to{transform:translate(var(--dx,0),-55vh) scale(1.2);opacity:0}}

/* 겹침 순서(z-index) 한 곳에서 정함: 본문 < 지금 줄(메뉴 안, 40) < 더보기 41 < 반응 44 < 도크 50 < 움직임 멈춤 60 < 도구 서랍 70 < 전체 보기 80 < 알림 90 < 건너뛰기 100. 대화상자는 top layer.
   휴대폰: 위는 메뉴+지금 줄(함께 붙음), 아래는 도크(가로 전체). 알림·반응은 도크 위로, 움직임 멈춤은 메뉴 버튼이 있으면 숨김. */
[data-pause-btn="nav"] .fx-toggle{display:none!important}

/* 메뉴: 더보기·목차 */
.lp-more{position:relative;flex:none}
.lp-more summary{list-style:none;display:inline-flex;align-items:center;gap:2px;min-height:40px;padding:6px 8px 6px 10px;color:var(--muted-foreground);font-size:var(--fs-sm);font-weight:600;cursor:pointer;white-space:nowrap}
.lp-more summary::-webkit-details-marker{display:none}
.lp-more summary:hover,.lp-more[open] summary,.lp-more.is-current summary{color:var(--foreground)}
.lp-more[open] summary .lp-ic{transform:rotate(180deg)}
.lp-more-list{position:absolute;right:0;top:calc(100% + 6px);z-index:41;min-width:180px;list-style:none;display:grid;padding:6px;border-radius:var(--radius-sm);background:var(--card);border:1px solid var(--rule-c);box-shadow:0 12px 32px rgba(0,0,0,.16)}
.lp-nav-links .lp-more-list a{display:flex;align-items:center;min-height:44px;padding:8px 10px}
.lp-nav-links .lp-more-list a[aria-current="true"]::after{left:10px;right:auto;width:1.5em;bottom:6px}
.lp-toc-btn{display:none!important}
.lp-sheet-h{display:flex;justify-content:space-between;align-items:center;gap:12px}
.lp-toc-list{list-style:none;display:grid;max-height:62vh;overflow:auto;border-top:var(--rule)}
.lp-toc-list a{display:flex;align-items:center;min-height:52px;padding:8px 4px;border-bottom:var(--rule);color:var(--foreground);text-decoration:none;font-weight:600}
.lp-toc-list a[aria-current="true"]{color:var(--primary);font-weight:800}
.lp-dialog textarea{width:100%;border-radius:var(--radius-sm);border:var(--border-w) solid var(--border);background:var(--card);padding:10px 12px;font-weight:400}
.lp-dialog input,.lp-dialog textarea{min-height:44px}

/* 지금 줄(실시간 상태)·연수 후 줄 */
.lp-now{padding:0 max(12px,env(safe-area-inset-right,0px)) 8px max(12px,env(safe-area-inset-left,0px))}
.lp-now-in{max-width:1136px;margin:0 auto;display:flex;align-items:center;gap:12px;padding:6px 6px 6px 14px;border-radius:var(--radius-sm);background:var(--card);color:var(--card-foreground);border:1px solid var(--rule-c)}
.lp-now.has-notice .lp-now-in{background:var(--foreground);color:var(--background);border-color:transparent}
.lp-now[data-level="warn"] .lp-now-in{background:var(--warning);color:#111}
.lp-now-tag{flex:none;font-size:var(--fs-xs);font-weight:800;color:var(--primary)}
.lp-now.has-notice .lp-now-tag,.lp-now[data-level="warn"] .lp-now-tag{color:inherit}
.lp-now-text{flex:1;min-width:0;display:grid;line-height:1.35;font-size:var(--fs-sm)}
.lp-now-text b{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.lp-now-text span{font-size:var(--fs-xs);opacity:.86;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lp-now-text b:empty,.lp-now-text span:empty{display:none}
.lp-now.is-open .lp-now-text b{display:block;-webkit-line-clamp:unset;overflow:visible;overflow-wrap:anywhere}
.lp-now-more{flex:none;align-self:center;min-height:40px;padding:0 10px;border:0;border-radius:var(--radius-sm);background:transparent;color:inherit;font:inherit;font-size:var(--fs-xs);font-weight:700;text-decoration:underline;text-underline-offset:3px;cursor:pointer}
.lp-now-more:focus-visible{outline:2px solid currentColor;outline-offset:2px}
.lp-now-timer{flex:none;font-family:var(--font-mono);font-weight:700;font-variant-numeric:tabular-nums;padding:2px 8px;border-radius:4px;border:1.5px solid currentColor}
.lp-now-timer.is-over{background:var(--danger);color:#fff}
.lp-now-cta{flex:none;min-height:40px}

/* 줄 하나에 늘어놓는 입력·버튼(참가자 화면의 낱말 투표 등) */
.lp-row{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.lp-row input,.lp-row select,.lp-row textarea{border-radius:var(--radius-sm);border:var(--border-w) solid var(--border);background:var(--card);padding:8px 10px;min-height:40px}
.lp-row textarea{width:100%}

/* 첫 화면: 좁은 화면 */
@media (max-width:900px){
  .lp-hero--worksheet .lp-hero-inner,.lp-hero--quiet .lp-hero-inner,.lp-hero--brief .lp-hero-inner,.lp-hero--spec > .lp-hero-inner,.lp-chalk,.lp-chalk-under,.lp-zine-row,.lp-mast-cols,.lp-hero--cinema .lp-hero-foot{grid-template-columns:minmax(0,1fr)}
  .lp-wsheet{justify-self:start;margin:6px 0 10px 18px}
  .lp-tile-main,.lp-bento-side{grid-column:1 / -1}
  .lp-tile-main{min-height:0}
  .lp-bento-side{grid-template-columns:repeat(auto-fit,minmax(190px,1fr));grid-auto-rows:auto}
  .lp-bento-side .lp-tile-when{grid-row:auto}
  .lp-hero--poster .lp-hero-inner{grid-template-columns:minmax(0,1fr);grid-template-areas:"top" "title" "blocks" "copy"}
  .lp-blocks{margin-left:0}
  .lp-mast-cols > *{padding:var(--sp-5) 0 0}
  .lp-mast-cols > * + *{margin-top:var(--sp-5);border-left:0;border-top:1px solid var(--rule-c)}
  .lp-chalk-agenda{padding:var(--sp-5) 0 0;border-left:0;border-top:1.5px dashed var(--rule-c)}
  .lp-spec{border-left:0;border-top:1px solid var(--ln)}
  .lp-hero--quiet{padding-block:clamp(88px,15vw,160px) clamp(96px,17vw,150px)}
  .lp-stickers{position:static;display:flex;flex-wrap:wrap;gap:var(--sp-5);align-items:center;padding:4px 0 8px 6px}
  .lp-stk-num{position:static}
  .lp-hero-strip > .lp-wrap{grid-template-columns:minmax(0,1fr);gap:var(--sp-3)}
  .lp-hero-strip .lp-hero-meta{grid-auto-flow:row;grid-template-columns:repeat(2,minmax(0,1fr));justify-content:stretch;gap:var(--sp-4) var(--sp-5)}
  .lp-hero-strip .lp-hero-meta > div + div{padding-left:0;border-left:0}
  .lp-stamp{margin-top:0}
}
@media (max-width:600px){
  .lp-hero{min-height:0;padding-block:clamp(36px,9vw,56px) clamp(40px,10vw,56px)}
  .lp-hero--cinema{min-height:calc(100svh - 62px);padding-bottom:0}
  .lp-hero--brief{padding-top:0}
  .lp-hero--poster{padding-bottom:0}
  .lp-hero--masthead{padding-top:12px}
  .lp-hero--quiet{min-height:0;padding-block:72px 104px}
  .lp-hero--invite{min-height:0;padding-bottom:clamp(120px,36vw,180px)}
  .lp-hero--invite .lp-hero-inner{grid-template-columns:minmax(0,1fr)}
  .lp-invite-date{padding:0 0 var(--sp-4);border-right:0;border-bottom:1px solid color-mix(in srgb,var(--foreground) 32%,transparent)}
  .lp-invite-date time{grid-template-columns:auto auto minmax(0,1fr);align-items:end;column-gap:.6em}
  .lp-invite-date b{grid-row:span 2;font-size:5.5rem}
  .lp-invite-t{grid-column:2 / -1;margin:0}
  .lp-sun{right:-12vw;width:92vw}
  .lp-bento,.lp-bento-side,.lp-bento-foot{gap:10px}
  .lp-bento-side{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
  .lp-bento-side .lp-tile-when{grid-column:1 / -1}
  .lp-bento-foot{flex-wrap:wrap}
  .lp-bento-foot .lp-tile{flex-basis:calc(50% - 5px)}
  .lp-bento-foot .lp-tile-live{flex-basis:100%}
  .lp-tile-main{padding:22px 20px 24px}
  .lp-poster-title{box-shadow:6px 6px 0 var(--ink)}
  .lp-wsheet{width:calc(100% - 22px);padding:18px 16px 14px 40px;box-shadow:-12px 10px 0 -1.5px var(--card),-12px 10px 0 0 var(--foreground)}
  .lp-wsheet::after{left:13px}
  .lp-chalk{padding:24px 18px 56px;min-height:0}
  .lp-hero--spec > .lp-hero-inner{width:calc(100% - 24px)}
  .lp-spec-c{flex-basis:100%}
  .lp-spec-n{flex-basis:calc(50% - 1px)}
  .lp-cine-date{top:auto;bottom:38%;font-size:44vw}
  .lp-halftone{right:-30vw;top:-24vw;width:110vw}
  .lp-rings{right:-40vw;top:-40vw;width:120vw}
  .lp-brief-glance{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
  .lp-brief-glance .lp-gl:nth-child(odd){padding-left:0;border-left:0}
  .lp-brief-glance .lp-gl:nth-child(n+3){margin-top:var(--sp-4);border-top:1px solid var(--rule-c)}
  .lp-pop-row{grid-template-columns:minmax(0,1fr)}
  .lp-ctas .lp-btn{flex:1 1 auto}
}
/* 휴대폰 첫 화면: 대표 단추는 한 줄을 다 씀. 기본 글꼴에서는 이미 두 줄이라, 글꼴이 늦게 와 단추 줄 수가 바뀌며 아래가 밀리지 않게 */
@media (max-width:480px){.lp-hero .lp-ctas > .lp-btn-primary{flex-basis:100%}}

/* 반응형 */
/* 메뉴: 1024 아래(태블릿·좁은 노트북)는 가로 메뉴 대신 [목차] 하나 — 메뉴 글이 가로 띠에서 중간에 잘리지 않게 */
@media (max-width: 1023px){
  .lp-nav-links{display:none}
  .lp-toc-btn{display:inline-flex!important;min-height:44px}
  .lp-brand{min-width:0;flex:1;max-width:none}
}
@media (max-width: 900px){
  .lp-st-shell{grid-template-columns:minmax(0,1fr)}
  .lp-st-side{position:static;max-height:none}
  .lp-st-side ol{display:flex;overflow-x:auto;gap:0;border-top:0;border-bottom:var(--rule);scrollbar-width:none}
  .lp-st-side ol::-webkit-scrollbar{display:none}
  .lp-st-side a{white-space:nowrap;border-bottom:0;padding:10px 12px;min-height:44px}
  .lp-st-record{grid-template-columns:1fr auto;align-items:center}
  .lp-st-record-h{grid-column:1 / -1}
  .lp-person{grid-template-columns:minmax(0,1fr)}
  .lp-survey{grid-template-columns:minmax(0,1fr)}
}
@media (max-width: 600px){
  body{font-size:16px}
  :root{--fs-base:1rem;--fs-md:1.0625rem}
  .lp-sec{padding-block:clamp(56px,14vw,80px)}
  .lp-nav-in{gap:8px}
  .lp-nav-act .lp-icon-btn{width:44px;height:44px}
  .lp-lite-btn{width:44px;padding:0} /* 휴대폰: 그림 단추로(글은 화면 낭독기에만) → 연수 이름이 덜 잘림 */
  .lp-lite-btn span{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
  .lp-sheet{width:100%;max-width:100%;margin:auto 0 0;border-radius:var(--radius-lg) var(--radius-lg) 0 0;max-height:88vh;padding-bottom:env(safe-area-inset-bottom,0px)}
  .lp-sheet[open]{animation:lp-sheet-up var(--dur-3) var(--ease-out)}
  .lp-now-in{gap:8px}
  .lp-glance-item:nth-child(even){padding-left:var(--sp-4)}
  .lp-dock{left:max(10px,env(safe-area-inset-left,0px));right:max(10px,env(safe-area-inset-right,0px));bottom:calc(10px + env(safe-area-inset-bottom,0px));justify-content:space-between;flex-wrap:wrap;gap:2px;padding:5px;border-radius:26px} /* 보통 글자 크기에서는 한 줄. 글자를 크게 키운 기기에서만 두 줄로 */
  .lp-btn-dock{padding:.4em .85em}
  .lp-btn-dock-2{width:44px;padding:0}
  .lp-btn-dock-2 span{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
  .lp-reactions{right:14px;bottom:calc(90px + env(safe-area-inset-bottom,0px))}
  html.lp-dock-on .fx-toggle{bottom:calc(84px + env(safe-area-inset-bottom,0px))}
  .lp-card-grid{grid-template-columns:1fr}
  .lp-schedule{--tw:3.5rem;--fx-ld-x:calc(var(--tw) + 13px)}
  .lp-schedule li{grid-template-columns:var(--tw) minmax(0,1fr);column-gap:28px}
  .lp-schedule time{font-size:var(--fs-base)}
  .lp-schedule .lp-chip,.lp-schedule-part{grid-column:2;justify-self:start;padding-top:2px}
  /* 차례: 휴대폰에서는 번호를 왼쪽 작은 단으로, 교재 쪽 그림은 작게(한 항목이 화면 높이의 1/3을 넘지 않게) */
  .lp-outline-item{grid-template-columns:auto minmax(0,1fr);gap:var(--sp-2) var(--sp-3);padding:var(--sp-4)}
  .lp-outline-no{font-size:var(--fs-num)}
  .lp-outline-item h3{font-size:var(--fs-lg)}
  .lp-outline-body > p:not(.lp-outline-part){font-size:var(--fs-sm);line-height:1.6}
  .lp-outline-thumb{width:6.5rem}
  .lp-outline-side{grid-column:2;padding-top:var(--sp-2)}
  .lp-goal-list li{grid-template-columns:minmax(0,1fr);gap:var(--sp-2)}
  .lp-tl-group{grid-template-columns:minmax(0,1fr);gap:0}
  .lp-closing{min-height:0}
  .lp-materials li{grid-template-columns:3.25rem minmax(0,1fr);row-gap:var(--sp-2)}
  .lp-materials li .lp-btn{grid-column:2;justify-self:start}
  .lp-sessions li{grid-template-columns:3.75rem minmax(0,1fr);row-gap:4px}
  .lp-sessions .lp-chip,.lp-sessions .lp-status{grid-column:2}
  .lp-st-h{grid-template-columns:1fr;gap:var(--sp-2)}
  .lp-st-big{font-size:2.5rem}
  .lp-prompt-lib{grid-template-columns:1fr}
}

@keyframes lp-sheet-up{from{transform:translateY(32px);opacity:.4}}

/* ── 스크롤 연출(움직임 3단계) ─────────────────────────────────────────
   첫 화면이 겹겹이 물러나고(시차), 다음 내용이 종이처럼 덮고, 화면 폭 띠가 둥근 판에서 화면 가득 펼쳐지고,
   단계가 스크롤에 맞춰 차례로 켜지고 일정 선이 그려집니다. transform·opacity·clip-path만 움직입니다.
   섹션의 등장(머리·목표·도구·숫자·강사)은 모든 단계에서 프리셋의 페이지 연출 계획(render/sections.js enterFx)이 맡습니다 — 같은 요소를 두 가지가 움직이지 않게.
   동작 줄이기 · 가벼운 모드(lp-paused) · 저사양(lp-lowpower) · 지원하지 않는 브라우저에서는 모두 꺼지고 완성된 정지 모습입니다.
   실습·질문·교재·보드·투표(data-calm)에는 붙이지 않습니다. 실습형(data-rest="1")은 첫 화면만. */
@media (prefers-reduced-motion:no-preference){@supports (animation-timeline:view()){
  @media (min-width:900px){
    html[data-motion="3"]:not(.lp-paused):not(.fx-paused):not(.lp-lowpower) main > .lp-hero > :is(.lp-hero-inner,.lp-hero-strip,.lp-brief-band){animation:lp-hero-park linear both;animation-timeline:scroll(root);animation-range:0 100vh}
    html[data-motion="3"]:not(.lp-paused):not(.fx-paused):not(.lp-lowpower) main > .lp-hero > :is(.lp-hero-graphic,.lp-hills,.lp-rings,.lp-halftone,.lp-sun){animation:lp-hero-far linear both;animation-timeline:scroll(root);animation-range:0 100vh}
    html[data-motion="3"]:not(.lp-paused):not(.fx-paused):not(.lp-lowpower) main > .lp-hero + *{border-radius:clamp(20px,2.4vw,36px) clamp(20px,2.4vw,36px) 0 0;margin-top:calc(clamp(20px,2.4vw,36px) * -1);box-shadow:0 -28px 60px -36px rgba(0,0,0,.4)}
    html[data-motion="3"]:not(.lp-paused):not(.fx-paused):not(.lp-lowpower) .lp-hero :is(.lp-cine-date,.lp-sun,.lp-rings,.lp-halftone,.lp-wsheet,.lp-stickers,.lp-blocks,.lp-stamp,.lp-bento-side){translate:calc(var(--px,0) * -14px) calc(var(--py,0) * -9px);transition:translate .6s var(--ease-out)}
  }
  html[data-motion="3"]:not([data-rest="1"]):not(.lp-paused):not(.fx-paused):not(.lp-lowpower) .lp-sec.lp-bleed:not(.lp-closing){animation:lp-bleed-open linear both;animation-timeline:view();animation-range:entry 0% entry 96%}
  html[data-motion="3"]:not([data-rest="1"]):not(.lp-paused):not(.fx-paused):not(.lp-lowpower) .lp-steps5 li{animation:lp-step-on linear both;animation-timeline:view();animation-range:entry calc(30% + var(--i) * 16%) entry calc(110% + var(--i) * 16%)}
  html[data-motion="3"]:not([data-rest="1"]):not(.lp-paused):not(.fx-paused):not(.lp-lowpower) .lp-schedule:not(.fx-ld)::after{content:"";position:absolute;left:var(--fx-ld-x);top:12px;bottom:12px;width:2px;margin-left:-1px;background:var(--primary);transform-origin:50% 0;animation:lp-rail linear both;animation-timeline:view();animation-range:cover 14% cover 64%}
}}
@keyframes lp-hero-park{to{transform:translate3d(0,30vh,0) scale(.965);opacity:.2}}
@keyframes lp-hero-far{to{transform:translate3d(0,46vh,0)}}
@keyframes lp-bleed-open{from{clip-path:inset(7% 4.5% 0 4.5% round 36px)}to{clip-path:inset(0 0 0 0 round 0)}}
@keyframes lp-step-on{from{opacity:.5;transform:translate3d(0,14px,0)}}
@keyframes lp-rail{from{transform:scaleY(0)}}

/* 어두운 키노트: ① 섹션마다 아주 큰 윤곽 번호 ② 위에서 빛이 떨어지는 판 ③ 옅은 바탕 띠의 무대 조명과 지평선 불빛 */
[data-preset="keynote-dark"] .lp-head-no{font-size:var(--fs-figure);line-height:.8;-webkit-text-stroke:1px color-mix(in srgb,var(--primary) 78%,transparent)}
[data-preset="keynote-dark"] .lp-sec[data-frame="split"] .lp-head-no{font-size:var(--fs-num)}
[data-preset="keynote-dark"] :is(.lp-outline-item,.lp-tools-item:not(:first-child),.lp-poll-live,.lp-diag),[data-preset="keynote-dark"] .lp-slide-text[data-kind="body"]{background:radial-gradient(120% 90% at 50% -40%,color-mix(in srgb,var(--primary) 26%,transparent),transparent 62%),color-mix(in srgb,var(--card) 86%,transparent);border-color:color-mix(in srgb,var(--foreground) 12%,transparent);box-shadow:inset 0 1px 0 color-mix(in srgb,var(--foreground) 16%,transparent)}
[data-preset="keynote-dark"] .lp-tinted{background:radial-gradient(64% 54% at 50% 0,color-mix(in srgb,var(--primary) 17%,transparent),transparent 72%),var(--surface-2)}
[data-preset="keynote-dark"] .lp-tinted::after{content:"";position:absolute;inset:auto 0 0 0;height:1px;z-index:-1;background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--primary) 70%,var(--foreground)) 50%,transparent);box-shadow:0 0 70px 18px color-mix(in srgb,var(--primary) 22%,transparent)}
[data-preset="keynote-dark"] .lp-goal-no,[data-preset="keynote-dark"] .lp-outline-no{color:transparent;-webkit-text-stroke:1.5px var(--primary)}

/* 깔끔한 기업형: ① 섹션 머리의 짧은 강조 막대 ② 겹 그림자로 띄운 판과 번호 칸 ③ 표처럼 번갈아 깔린 줄, 문서 선 */
[data-preset="corporate-clean"] .lp-head::before{content:"";width:40px;height:4px;border-radius:2px;background:var(--primary)}
[data-preset="corporate-clean"] :is(.lp-outline-item,.lp-tools-item,.lp-diag,.lp-slide-text){border-color:var(--rule-c);box-shadow:0 1px 2px rgba(10,37,64,.06),0 18px 36px -22px rgba(10,37,64,.3)}
@media (min-width:601px){[data-preset="corporate-clean"] .lp-outline-item{background:linear-gradient(90deg,color-mix(in srgb,var(--primary) 8%,var(--card)) 0 calc(clamp(4.5rem,13vw,12rem) + clamp(20px,3vw,44px) + clamp(8px,1.5vw,24px)),var(--card) 0)}}
[data-preset="corporate-clean"] .lp-goal-list li:nth-child(odd),[data-preset="corporate-clean"] .lp-glossary div:nth-child(odd),[data-preset="corporate-clean"] .lp-tl-group:nth-child(odd){background:var(--surface-2)}
[data-preset="corporate-clean"] .lp-goal-list li,[data-preset="corporate-clean"] .lp-glossary div,[data-preset="corporate-clean"] .lp-tl-group{padding-inline:clamp(12px,2vw,28px);border-bottom:0}
[data-preset="corporate-clean"] .lp-tinted{border-block:1px solid var(--rule-c)}
[data-preset="corporate-clean"] .lp-glance-grid{padding-inline:clamp(16px,2.4vw,32px);border-top:0;border-radius:var(--radius-lg);background:var(--surface-2)}

/* 잉크 잡지: ① 신문 단(세로 규칙선) ② 겹줄 사이의 끌어 쓴 문장 ③ 긴 글의 큰 첫 글자(휴대폰에서도 줄이 깨지지 않게) */
@media (max-width:600px){.lp-standfirst::first-letter,[data-preset="editorial-ink"] :is(.lp-person-bio,.lp-prose > p:first-child)::first-letter{float:none;margin:0;font-size:1.5em;line-height:1}}

/* ── 본문 정렬 문법(<html data-align>, 프리셋 variants.align) ─────────────────────────────
   섹션 머리와 내용이 놓이는 자리·맞춤을 프리셋마다 달리함:
   center 가운데 축 · right 머리가 오른쪽에 섬 · offset 섹션마다 좌우로 엇갈림 · split 머리 왼쪽·내용 오른쪽의 두 단 · ledger 좁은 이름표 단 + 넓은 내용 단.
   좁은 화면에서는 모두 한 단(머리 위·내용 아래)이고 맞춤만 남음. 따라 하는 칸(data-calm)과 화면 폭 띠는 제 폭을 그대로 씀 */
[data-align="center"] .lp-head{justify-items:center;text-align:center}
[data-align="center"] .lp-head-k{justify-content:center}
[data-align="center"] .lp-head .lp-lead,[data-align="center"] .lp-closing-lead{text-wrap:balance}
[data-align="center"] .lp-message{justify-items:center;text-align:center}
[data-align="center"] .lp-formula-rows{justify-items:center}
[data-align="center"] .lp-closing > .lp-wrap{justify-items:center;text-align:center}
[data-align="center"] .lp-closing-foot{justify-content:center}
[data-align="center"] .lp-goal-list li{grid-template-columns:minmax(0,1fr);justify-items:center;gap:var(--sp-2);text-align:center}
[data-align="center"] .lp-goal-meta{padding-left:0;justify-items:center}
[data-align="center"] .lp-close-line{margin-inline:auto;text-align:center}
/* 메모·안내 줄은 가운데 프리셋이어도 글은 왼쪽 맞춤(여러 줄 메모가 읽기 쉽게). 짧은 줄은 폭이 줄어 덩어리째 가운데, 실습 카드 안에서는 단계와 같은 줄에 */
[data-align="center"] .lp-note{width:fit-content;margin-inline:auto;text-align:start}
[data-align="center"] .lp-st .lp-note{margin-inline:0}
[data-align="center"] .lp-survey-form,[data-align="center"] .lp-sec-survey .lp-wrap > :is(.lp-btn,p){margin-inline:auto}
@media (min-width:1024px){
  [data-align="center"] .lp-sec:is([data-frame="stack"],[data-frame="wide"]) .lp-head:has(> .lp-lead){grid-template-columns:minmax(0,1fr)}
  [data-align="center"] .lp-sec:is([data-frame="stack"],[data-frame="wide"]) .lp-head:has(> .lp-lead) > .lp-lead{grid-column:1;grid-row:auto;align-self:auto;padding-bottom:0}
  [data-align="center"] .lp-sec[data-frame="split"] > .lp-wrap{display:block}
  [data-align="center"] .lp-sec[data-frame="split"] > .lp-wrap > .lp-head{position:static;margin-bottom:clamp(24px,3.4vw,48px)}
  [data-align="center"] .lp-sec[data-frame="split"] > .lp-wrap > :not(.lp-head){max-width:840px;margin-inline:auto}
  [data-align="center"] .lp-sec[data-frame="split"] .lp-h2{font-size:var(--fs-xl)}
}
@media (min-width:768px){
  [data-align="right"] .lp-head{justify-items:end;text-align:right}
  [data-align="right"] .lp-head-k{flex-direction:row-reverse}
  [data-align="right"] .lp-closing > .lp-wrap{justify-items:end;text-align:right}
  [data-align="right"] .lp-message{justify-items:end;text-align:right}
}
@media (min-width:1024px){
  [data-align="right"] .lp-sec[data-frame="split"] > .lp-wrap{grid-template-columns:minmax(0,8fr) minmax(0,4fr)}
  [data-align="right"] .lp-sec[data-frame="split"] > .lp-wrap > *{grid-column:1}
  [data-align="right"] .lp-sec[data-frame="split"] > .lp-wrap > .lp-head{grid-column:2}
  [data-align="right"] .lp-sec:is([data-frame="stack"],[data-frame="wide"]) .lp-head:has(> .lp-lead){grid-template-columns:minmax(0,5fr) minmax(0,7fr)}
  [data-align="right"] .lp-sec:is([data-frame="stack"],[data-frame="wide"]) .lp-head:has(> .lp-lead) > *{grid-column:2}
  [data-align="right"] .lp-sec:is([data-frame="stack"],[data-frame="wide"]) .lp-head:has(> .lp-lead) > .lp-lead{grid-column:1;justify-self:start;text-align:left}
  /* offset: 짝수 번째 섹션은 머리가 오른쪽(줄 목록은 머리 단이 오른쪽으로), 홀수 번째는 머리와 내용을 두 칸 들여 씀 */
  [data-align="offset"] main > .lp-sec:nth-of-type(even):not(.lp-bleed) .lp-head{justify-items:end;text-align:right}
  [data-align="offset"] main > .lp-sec:nth-of-type(even):not(.lp-bleed) .lp-head-k{flex-direction:row-reverse}
  [data-align="offset"] main > .lp-sec:nth-of-type(even)[data-frame="split"] > .lp-wrap{grid-template-columns:minmax(0,8fr) minmax(0,4fr)}
  [data-align="offset"] main > .lp-sec:nth-of-type(even)[data-frame="split"] > .lp-wrap > *{grid-column:1}
  [data-align="offset"] main > .lp-sec:nth-of-type(even)[data-frame="split"] > .lp-wrap > .lp-head{grid-column:2}
  [data-align="offset"] main > .lp-sec:nth-of-type(even):is([data-frame="stack"],[data-frame="wide"]) .lp-head:has(> .lp-lead){grid-template-columns:minmax(0,5fr) minmax(0,7fr)}
  [data-align="offset"] main > .lp-sec:nth-of-type(even):is([data-frame="stack"],[data-frame="wide"]) .lp-head:has(> .lp-lead) > *{grid-column:2}
  [data-align="offset"] main > .lp-sec:nth-of-type(even):is([data-frame="stack"],[data-frame="wide"]) .lp-head:has(> .lp-lead) > .lp-lead{grid-column:1;justify-self:start;text-align:left}
  [data-align="offset"] main > .lp-sec:nth-of-type(odd):is([data-frame="stack"],[data-frame="wide"]):not([data-calm]):not(.lp-hero) > .lp-wrap > *{margin-left:16.666%}
  /* split·ledger: 모든 섹션이 두 단(머리는 왼쪽에 붙박이). split은 4:8, ledger는 3:9 */
  :is([data-align="split"],[data-align="ledger"]) .lp-sec:is([data-frame="stack"],[data-frame="wide"]):not([data-calm]) > .lp-wrap{display:grid;grid-template-columns:minmax(0,4fr) minmax(0,8fr);column-gap:clamp(32px,5vw,88px);align-items:start}
  :is([data-align="split"],[data-align="ledger"]) .lp-sec:is([data-frame="stack"],[data-frame="wide"]):not([data-calm]) > .lp-wrap > *{grid-column:2}
  :is([data-align="split"],[data-align="ledger"]) .lp-sec:is([data-frame="stack"],[data-frame="wide"]):not([data-calm]) > .lp-wrap > .lp-head{grid-column:1;grid-row:1 / span 8;position:sticky;top:96px;margin-bottom:0;grid-template-columns:minmax(0,1fr)}
  :is([data-align="split"],[data-align="ledger"]) .lp-sec:is([data-frame="stack"],[data-frame="wide"]):not([data-calm]) .lp-head:has(> .lp-lead) > .lp-lead{grid-column:1;grid-row:auto;align-self:auto;padding-bottom:0}
  :is([data-align="split"],[data-align="ledger"]) .lp-sec:is([data-frame="stack"],[data-frame="wide"]):not([data-calm]) .lp-h2{font-size:var(--fs-h2s)}
  [data-align="ledger"] .lp-sec:is([data-frame="stack"],[data-frame="wide"],[data-frame="split"]):not([data-calm]) > .lp-wrap{grid-template-columns:minmax(0,3fr) minmax(0,9fr);column-gap:clamp(24px,3.4vw,56px)}
  [data-align="split"] .lp-sec:is([data-frame="stack"],[data-frame="wide"],[data-frame="split"]):not([data-calm]) > .lp-wrap{background:linear-gradient(var(--rule-c),var(--rule-c)) calc(33.333% + clamp(32px,5vw,88px) / 6) 0 / 1px 100% no-repeat content-box}
}

/* 마무리에 한 번 더 쓰는 표식(첫 화면 그림의 되풀이): 도형 한 줄 · 큰 원 · 색면 · 큰 첫 글자 · 점 줄 */
.lp-closing-tiles{position:absolute;inset:auto 0 0;z-index:-1;height:clamp(56px,7.2vw,104px);--t0:transparent;overflow:hidden}
.lp-closing-tiles .lp-mosaic-svg{position:absolute;inset:0;width:100%;height:100%}
.lp-closing--mosaic{padding-bottom:clamp(120px,15vw,220px)}
.lp-closing > .lp-vt-moon{right:auto;left:max(3vw,calc((100% - 1320px) / 2));top:50%;width:min(52vw,70svh,620px);background:color-mix(in srgb,var(--primary) 12%,transparent);transform:translateY(-50%)}
.lp-closing > .lp-off-block{height:100%;width:33.333%;background:color-mix(in srgb,var(--primary) 26%,transparent);box-shadow:inset 12px 0 0 var(--primary)}
.lp-closing-glyph{position:absolute;right:max(-.05em,calc((100% - 1320px) / 2));bottom:-.24em;z-index:-1;font-family:var(--font-display);font-weight:var(--display-weight);font-size:clamp(14rem,44vw,40rem);line-height:1;letter-spacing:-.06em;color:color-mix(in srgb,var(--primary) 26%,transparent);pointer-events:none;-webkit-user-select:none;user-select:none}
.lp-closing-dots{position:absolute;inset:auto 0 clamp(20px,3vw,44px);z-index:-1;height:56px;background:radial-gradient(circle,color-mix(in srgb,var(--foreground) 42%,transparent) 3.2px,transparent 3.8px) 0 0 / 14px 14px;-webkit-mask-image:linear-gradient(90deg,#000,transparent 92%);mask-image:linear-gradient(90deg,#000,transparent 92%)}
.lp-closing--minutes{padding-bottom:clamp(120px,14vw,200px)}
[data-align="right"]{--fx-rv-dir:-1}

/* ── 본문 미세 동작(차분 단계부터): 가리키거나 초점이 오면 한 번 움직이고 멈춤. 포인터와 키보드가 같음. 정적 단계(data-rest="0")·가벼운 모드에서는 없음 ── */
html:not([data-rest="0"]):not(.lp-paused) :is(.lp-materials > li > div,.lp-faq summary > span,.lp-link > svg,.lp-btn > svg){transition:transform .28s var(--ease-out)}
@media (hover:hover){
  html:not([data-rest="0"]):not(.lp-paused) .lp-materials > li:hover > div,html:not([data-rest="0"]):not(.lp-paused) .lp-faq summary:hover > span{transform:translate3d(5px,0,0)}
  html:not([data-rest="0"]):not(.lp-paused) :is(.lp-link,.lp-btn):hover > svg{transform:translate3d(3px,0,0)}
}
html:not([data-rest="0"]):not(.lp-paused) .lp-materials > li:focus-within > div,html:not([data-rest="0"]):not(.lp-paused) .lp-faq summary:focus-visible > span{transform:translate3d(5px,0,0)}
html:not([data-rest="0"]):not(.lp-paused) :is(.lp-link,.lp-btn):focus-visible > svg{transform:translate3d(3px,0,0)}
/* 아코디언이 열릴 때 내용이 살짝 내려앉으며 나타남 */
@media (prefers-reduced-motion:no-preference){
  html:not([data-rest="0"]):not(.lp-paused) .lp-faq details[open] > div{animation:lp-acc .36s var(--ease-out)}
}
@keyframes lp-acc{from{opacity:0;transform:translate3d(0,-8px,0)}}

/* 움직임 줄이기·멈춤 */
@media (prefers-reduced-motion: reduce){
  *,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important}
}
html.lp-paused *,html.lp-paused *::before,html.lp-paused *::after{animation-play-state:paused!important}

/* 인쇄 */
@media print{
  .lp-nav,.lp-dock,.lp-toast,.lp-now,.lp-hero-graphic,.lp-closing-graphic,.lp-st-side,.lp-deck-bar,.lp-st-pn{display:none!important}
  .lp-st-shell.is-ready .lp-st,.lp-deck.is-ready .lp-slide{display:grid!important}
  /* 스크롤 연출·전환이 화면에서 멈춘 상태(흐림·밀림)로 새지 않게: 인쇄는 언제나 완성된 정지 모습 */
  *,*::before,*::after{animation:none!important;transition:none!important}
  /* 칸 하나를 통째로 다음 장으로 넘기지 않음(빈 쪽이 생겨 장수가 늘었음). 머리는 내용과 붙이고, 작은 덩어리만 쪼개지 않음 */
  .lp-sec{padding-block:24px;break-inside:auto}
  .lp-sec .lp-head{position:static;break-after:avoid}
  :is(.lp-sec h2,.lp-sec h3){break-after:avoid}
  :is(.lp-sec li,figure,tr,.lp-card,.lp-slide){break-inside:avoid}
  .lp-hero{min-height:0!important}
  html,body{background:#fff!important;color:#111}
  /* 종이에는 누를 것을 빼고 내용만: 참여 칸의 입력·단추(질문 올리기·투표·공감·좋아요), 복사·완료·도움 요청·달력 단추 */
  main button,main input:not([type="radio"]):not([type="checkbox"]),.lp-compose,.lp-board-bar,.lp-board-form,.lp-tabs,.lp-poll-live,.lp-live-down,.lp-cal,.lp-follow,.lp-survey-form .lp-compose-f,.lp-reflect .lp-compose-f{display:none!important}
}

/* 읽기 우선: 아주 굵은 포스터 글꼴을 쓰는 디자인은 큰 제목에만 그 글꼴을 쓰고, 카드·단계·교재 쪽·용어의 작은 제목은 본문 글꼴 굵게 */
:is([data-preset="riso-zine"],[data-preset="retro-pop"],[data-preset="playground"],[data-preset="kinetic-type"]) :is(.lp-outline-item h3,.lp-steps5 h3,.lp-tools h3,.lp-slide-text h3,.lp-wsheet-t,.lp-glossary dt,.lp-dict dt,.lp-gcards dt){font-family:var(--font-body);font-weight:800;letter-spacing:-.02em}

/* ═══ 본문 칸: 절차(procedure) · 사례(cases) · 함께 나눌 질문(discuss) · 표(table) · 글 칸의 표·인용·강조 상자 ═══
   렌더러: src/render/content.js, src/render/markdown.js. 색은 theme.css 변수만 쓰고, 상자 대신 가는 선·여백·글자 크기로 나눕니다.
   프리셋별 변형([data-preset]·[data-card])은 이 묶음 아래에 덧붙이면 됩니다. */
/* 절차: 번호 | 단계 이름·설명 | 시간·담당 */
.lp-proc{list-style:none;display:grid;max-width:54rem;border-bottom:var(--rule)}
.lp-proc > li{display:grid;grid-template-columns:3.2rem minmax(0,1fr) auto;column-gap:var(--sp-4);row-gap:4px;align-items:baseline;padding:var(--sp-5) 0;border-top:var(--rule)}
.lp-proc-no{font-family:var(--font-display);font-weight:var(--display-weight);font-size:var(--fs-lg);line-height:1.2;color:var(--primary);font-variant-numeric:tabular-nums}
.lp-proc-b{display:grid;gap:4px;min-width:0}
.lp-proc h3{font-family:var(--font-sans);font-size:var(--fs-md);font-weight:700;line-height:1.45}
.lp-proc-b p{max-width:var(--measure);color:var(--muted-foreground)}
.lp-proc-meta{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:0 .7em;font-size:var(--fs-sm);font-weight:600;white-space:nowrap}
.lp-proc-meta > span + span::before{content:"·";margin-right:.7em;color:var(--muted-foreground)}
/* 사례: 큰 번호 | 제목·본문·인용 */
.lp-cases{display:grid;border-bottom:var(--rule)}
.lp-case{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,10fr);column-gap:clamp(20px,4vw,64px);align-items:start;padding:var(--sp-6) 0;border-top:var(--rule)}
.lp-case:not(:has(> .lp-case-k)){grid-template-columns:minmax(0,1fr)}
.lp-case-k{font-family:var(--font-display);font-weight:var(--display-weight);font-size:var(--fs-h2s);line-height:1;color:var(--primary);font-variant-numeric:tabular-nums}
.lp-case-b{display:grid;gap:var(--sp-3);max-width:44rem;min-width:0}
.lp-case h3{font-size:var(--fs-lg);line-height:1.35}
/* 인용(사례·글 칸): 큰 따옴표 하나 + 굵은 문장. 한쪽 색 띠는 쓰지 않음 */
.lp-bq{position:relative;margin:0;display:grid;gap:var(--sp-2);padding-left:1.7em}
.lp-bq::before{content:"“";position:absolute;left:0;top:-.06em;font-family:var(--font-display);font-weight:var(--display-weight);font-size:2.3em;line-height:1;color:var(--primary)}
.lp-bq p{font-size:var(--fs-md);font-weight:600;line-height:1.6}
.lp-bq cite{font-style:normal;font-size:var(--fs-sm);color:var(--muted-foreground)}
/* 함께 나눌 질문: 큰 번호 질문 | 진행 규칙 */
.lp-discuss{display:grid;grid-template-columns:minmax(0,8fr) minmax(0,4fr);column-gap:clamp(32px,5vw,88px);row-gap:var(--sp-6);align-items:start}
.lp-discuss.is-solo{grid-template-columns:minmax(0,1fr)}
.lp-discuss-q{list-style:none;display:grid;border-bottom:var(--rule)}
.lp-discuss-q > li{display:grid;grid-template-columns:2.8rem minmax(0,1fr);column-gap:var(--sp-3);align-items:baseline;padding:var(--sp-5) 0;border-top:var(--rule)}
.lp-discuss-no{font-family:var(--font-display);font-weight:var(--display-weight);font-size:var(--fs-h2s);line-height:1;color:var(--primary);font-variant-numeric:tabular-nums}
.lp-discuss-q p{max-width:26em;font-size:var(--fs-lg);font-weight:600;line-height:1.45;text-wrap:balance}
.lp-discuss-rules{position:sticky;top:96px;display:grid;gap:var(--sp-3);padding-top:var(--sp-5);border-top:max(2px,var(--border-w)) solid var(--foreground)}
.lp-discuss-rules h3{font-family:var(--font-sans);font-size:var(--fs-sm);font-weight:700;color:var(--muted-foreground)}
.lp-discuss-rules ul{list-style:none;display:grid;gap:var(--sp-3);font-size:var(--fs-sm);line-height:1.65}
.lp-discuss-rules li{position:relative;padding-left:1.1em}
.lp-discuss-rules li::before{content:"";position:absolute;left:0;top:.68em;width:.38em;height:.38em;border-radius:50%;background:var(--primary)}
/* 표: 머리글 아래 굵은 선, 줄마다 가는 선. 휴대폰에서 칸 4개 이하는 줄마다 카드, 5개 이상은 가로로 밂 */
.lp-tbl-wrap{max-width:100%;min-width:0}
.lp-tbl-wrap[data-mode="scroll"]{overflow-x:auto;-webkit-overflow-scrolling:touch}
.lp-tbl{width:100%;border-collapse:collapse;font-size:var(--fs-sm);line-height:1.6}
.lp-sec-table .lp-tbl{font-size:var(--fs-base)}
.lp-tbl th,.lp-tbl td{text-align:left;vertical-align:top;padding:var(--sp-3) var(--sp-4) var(--sp-3) 0;border-top:var(--rule)}
.lp-tbl thead th{border-top:0;border-bottom:max(2px,var(--border-w)) solid var(--foreground);font-size:var(--fs-xs);font-weight:700;color:var(--muted-foreground);white-space:nowrap}
.lp-tbl thead + tbody tr:first-child > *{border-top:0}
.lp-tbl tbody tr:last-child > *{border-bottom:var(--rule)}
.lp-tbl tbody th{min-width:5em;font-weight:700}
.lp-tbl-k{display:none}
.lp-tbl-wrap[data-mode="scroll"] .lp-tbl{min-width:calc(var(--cols,5) * 8.5rem)}
@media (max-width:640px){
  .lp-proc > li{grid-template-columns:2.4rem minmax(0,1fr)}
  .lp-proc-meta{grid-column:2;justify-content:flex-start;white-space:normal}
  .lp-case{grid-template-columns:minmax(0,1fr);row-gap:var(--sp-2);padding:var(--sp-5) 0}
  .lp-case-k{font-size:var(--fs-lg)}
  .lp-discuss-q > li{grid-template-columns:2rem minmax(0,1fr)}
  .lp-discuss-no{font-size:var(--fs-lg)}
  .lp-discuss-q p{font-size:var(--fs-md)}
  .lp-tbl-wrap[data-mode="cards"] :is(.lp-tbl,tbody,tr,td,tbody th){display:block}
  .lp-tbl-wrap[data-mode="cards"] thead{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
  .lp-tbl-wrap[data-mode="cards"] :is(td,tbody th){padding:0;border:0!important}
  .lp-tbl-wrap[data-mode="cards"] tr{padding:var(--sp-4) 0;border-top:var(--rule)}
  .lp-tbl-wrap[data-mode="cards"] tr:last-child{border-bottom:var(--rule)}
  .lp-tbl-wrap[data-mode="cards"] tbody th{margin-bottom:var(--sp-2);font-size:var(--fs-md)}
  .lp-tbl-wrap[data-mode="cards"] td + td{margin-top:var(--sp-2)}
  .lp-tbl-wrap[data-mode="cards"] td[data-empty]{display:none}
  .lp-tbl-wrap[data-mode="cards"] .lp-tbl-k{display:block;font-size:var(--fs-xs);font-weight:600;line-height:1.5;color:var(--muted-foreground)}
}
@media (max-width:900px){
  .lp-discuss{grid-template-columns:minmax(0,1fr)}
  .lp-discuss-rules{position:static}
}
/* 글 칸: 소제목·가로줄·코드·강조 상자 */
.lp-prose h4{font-family:var(--font-sans);font-size:var(--fs-base);font-weight:700}
.lp-prose hr{width:100%;margin:var(--sp-2) 0;border:0;border-top:var(--rule)}
.lp-prose li + li,.lp-prose li > ul{margin-top:4px}
.lp-prose > .lp-tbl-wrap,.lp-prose > .lp-pre{min-width:0}
.lp-pre{margin:0;padding:var(--sp-4);border-radius:var(--radius-sm);background:var(--tint);font-family:var(--font-mono);font-size:var(--fs-sm);line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere}
.lp-callout{display:grid;gap:var(--sp-2);padding:var(--sp-4) var(--sp-5);border-radius:var(--radius-sm);background:var(--tint)}
.lp-callout-h{display:flex;flex-wrap:wrap;align-items:center;gap:.2em .6em;font-size:var(--fs-sm);line-height:1.5}
.lp-callout-h b{color:var(--primary)}
.lp-callout-h > span{font-weight:700}
.lp-callout-copy{margin-left:auto}
.lp-callout-b{display:grid;gap:var(--sp-3);min-width:0;font-size:var(--fs-sm);line-height:1.7}
.lp-callout-b > :is(p,ul,ol){max-width:29em} /* 작은 글자라 한 줄이 40자 안팎을 넘지 않게(영문이 섞여도) */
@media print{
  .lp-callout-copy{display:none!important}
  .lp-discuss-rules{position:static}
  .lp-proc > li,.lp-case,.lp-discuss-q > li,.lp-tbl tr{break-inside:avoid}
}

/* 터치 화면: 누르는 곳 44px(docs/interaction.md 7절). 보이는 모양이 작은 링크는 안쪽 여백을 주고 같은 만큼 바깥 여백을 빼서
   누르는 영역만 넓힘(줄 간격·배치는 그대로). 입력칸은 16px(iOS가 확대하지 않게) */
@media (pointer:coarse){
  .lp-brand,.lp-totop,.lp-follow,.lp-textbtn,.lp-btn,.lp-btn-sm,.lp-link{min-height:44px}
  :is(.lp-tt,.lp-trw,.lp-tools-item) h3 a{display:inline-flex;align-items:center;gap:.3em;min-height:44px}
  .lp-icon-btn,.lp-nav-act .lp-icon-btn{min-width:44px;min-height:44px}
  .lp-tabs button{min-width:44px}
  .lp-min-legend a{min-height:44px}
  .lp-poll-list > summary{padding-block:9px}
  .lp-foot-links,.lp-foot-meta{row-gap:0}
  .lp-foot-links a,.lp-foot-meta a{display:inline-flex;align-items:center;min-width:44px;min-height:44px}
  .lp-toc-pg a{padding-block:13px}
  .lp-pages a{display:inline-grid;place-items:center;min-width:44px;min-height:44px;margin:-10.5px -18px}
  .lp-prompt-text{font-size:1rem}
}
`,p=`/* lecpage runtime — 참가자 화면. 빌드 도구 없이 동작하는 클래식 스크립트입니다. */
(function () {
  'use strict';
  var doc = document, root = doc.documentElement;
  var $ = function (s, r) { return (r || doc).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); };
  var DATA = {};
  try { DATA = JSON.parse(($('#lp-data') || {}).textContent || '{}'); } catch (e) { DATA = {}; }
  // 참가자 화면이 부르는 진행자 이름(교사 연수 '강사', 학생 수업 '선생님', 설명회·행사 '발표자' — words.js host)
  var HOST = (DATA.words && DATA.words.host) || '강사';
  var HOST_GA = HOST + (function (w) { var c = w.charCodeAt(w.length - 1); return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 ? '이' : '가'; })(HOST);
  var KEY = DATA.key || 'lp';
  var RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 저장 공간을 못 쓰는 곳(앱 미리보기의 샌드박스·막힌 브라우저·가득 참)에서는 화면이 열린 동안 메모리에 둠(연습 출석 시각 등이 사라지지 않게)
  var mem = {};
  var memGet = function (key, d) { return Object.prototype.hasOwnProperty.call(mem, key) ? JSON.parse(mem[key]) : d; };
  var store = {
    get: function (k, d) { var key = KEY + ':' + k; try { var v = localStorage.getItem(key); return v === null ? memGet(key, d) : JSON.parse(v); } catch (e) { return memGet(key, d); } },
    set: function (k, v) { var key = KEY + ':' + k, s = JSON.stringify(v); try { localStorage.setItem(key, s); delete mem[key]; } catch (e) { mem[key] = s; } },
    del: function (k) { var key = KEY + ':' + k; delete mem[key]; try { localStorage.removeItem(key); } catch (e) { } },
    /** 이 연수의 열쇠 이름들(앞의 KEY: 를 뗀 것). 저장 공간과 메모리 둘 다 */
    keys: function () {
      var pre = KEY + ':', out = [], k;
      try { for (var i = 0; i < localStorage.length; i++) { k = localStorage.key(i); if (k && k.indexOf(pre) === 0) out.push(k.slice(pre.length)); } } catch (e) { }
      for (k in mem) if (k.indexOf(pre) === 0 && out.indexOf(k.slice(pre.length)) < 0) out.push(k.slice(pre.length));
      return out;
    }
  };
  var toastTimer;
  function toast(msg) {
    var t = $('[data-toast]'); if (!t) return;
    t.textContent = msg; t.classList.add('is-on'); clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('is-on'); }, 2400);
  }
  function el(tag, cls, text) { var n = doc.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; }
  function copyText(text, okMsg, fallbackEl) {
    function fb() { if (fallbackEl && fallbackEl.select) { fallbackEl.focus(); fallbackEl.select(); toast('글자를 선택했어요. Ctrl+C로 복사해 주세요.'); } else toast('복사하지 못했어요. 직접 선택해 복사해 주세요.'); }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).then(function () { toast(okMsg || '복사했어요.'); return true; }, function () { fb(); return false; });
    } catch (e) { }
    fb(); return Promise.resolve(false);
  }
  // 카카오톡·네이버 앱 등 안의 브라우저는 파일 내려받기를 막음(눌러도 아무 일 없음) → 기록을 복사해 줌
  var IN_APP = /KAKAOTALK|NAVER\\(inapp|Instagram|FBAN|FBAV|\\bLine\\//i.test(navigator.userAgent || '');
  function download(name, text, okMsg) {
    if (IN_APP) return copyText(text, '이 앱에서는 내려받을 수 없어 기록을 복사했어요. 메모에 붙여 넣어 두세요.');
    var url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    var a = el('a'); a.href = url; a.download = name; doc.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
    if (okMsg) toast(okMsg);
  }
  window.LecPage = { toast: toast, store: store, data: DATA, copy: copyText };

  /* ── QR ─────────────────────────────── */
  // qr.js(56KB)는 처음에 싣지 않습니다. 공유 대화상자를 열거나 QR 칸이 화면에 가까워지면 불러옵니다.
  // 강사 화면·발표 화면·안내문처럼 QR이 바로 필요한 쪽은 <script>로 먼저 실려 있어 그대로 씁니다.
  var qrLoading = null;
  function needQR() {
    if (window.qrcode) return Promise.resolve(true);
    if (qrLoading) return qrLoading;
    qrLoading = new Promise(function (res) {
      var sc = doc.createElement('script'); sc.src = 'assets/qr.js'; sc.async = true;
      sc.onload = function () { res(true); }; sc.onerror = function () { qrLoading = null; res(false); };
      doc.head.appendChild(sc);
    });
    return qrLoading;
  }
  function qrSvg(text) {
    if (!window.qrcode) return '';
    try {
      if (qrcode.stringToBytesFuncs && qrcode.stringToBytesFuncs['UTF-8']) qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
      var q = qrcode(0, 'M'); q.addData(text); q.make();
      // 둘레 여백 4칸(QR 규격의 quiet zone): 어두운 바탕·사진 위에서도 읽히게 그림 안에 넣음
      return q.createSvgTag({ cellSize: 6, margin: 24, scalable: true });
    } catch (e) { return ''; }
  }
  window.LecPage.qr = qrSvg; window.LecPage.needQR = needQR;
  // 주소: 파일로 열었거나(file:) 앱 미리보기(about:)면 진짜 주소가 없으니 안내 문구를 보여 줍니다(meta.siteUrl이 있으면 그 주소).
  var LOCAL_PAGE = /^(file|about|blob|data):$/.test(location.protocol);
  var URL_OFF = '배포하면 여기에 참가자 주소와 QR이 나와요.';
  // localhost·127.x로 연 쪽(강사 노트북에서 Node 서버를 켜고 연 안내문 등): 그 주소는 이 컴퓨터에서만 열림.
  // 서버가 같은 와이파이 주소를 알려 주면(/api/lan) 그 주소를 QR·복사에 쓰고, 모르면 QR 대신 바꾸는 법을 보임
  var LOOP = !DATA.siteUrl && !LOCAL_PAGE && /^(localhost|127(?:\\.\\d+){3}|\\[::1\\])$/.test(location.hostname);
  var URL_LOOP = 'localhost 주소는 이 컴퓨터에서만 열려요. 노트북의 와이파이 주소(예: http://192.168.0.10:8787)로 이 쪽을 다시 열면 참가자 QR이 나와요.';
  var LAN_BASE = '';
  function offText(short) { return LOOP ? (short ? '이 컴퓨터 밖에서는 열리지 않는 주소예요' : URL_LOOP) : URL_OFF; }
  // 지금 주소의 경로(보조 화면이면 그 폴더 = 참가자 화면. /poster.html이든 /poster(확장자 없는 주소)든 같음)
  function herePath() { return location.href.split('#')[0].split('?')[0].replace(/^[a-z]+:\\/\\/[^/]+/i, '').replace(/(check|console|screen|privacy|poster)(\\.html)?$/, ''); }
  // 원래 주소(QR·복사): 강사가 준 사이트 주소, 없으면 지금 페이지 주소. 파일로 열었거나 localhost인데 와이파이 주소를 모르면 ''
  function siteUrl() {
    if (DATA.siteUrl) return DATA.siteUrl;
    if (LOCAL_PAGE) return '';
    if (LOOP) return LAN_BASE ? LAN_BASE + herePath() : '';
    return location.origin + herePath();
  }
  function askLan() {
    if (!LOOP || !window.fetch) return Promise.resolve('');
    return fetch('/api/lan', { cache: 'no-store', credentials: 'omit' }).then(function (r) { return r.ok ? r.json() : {}; }).then(function (j) {
      var u = j && j.urls && j.urls[0]; return typeof u === 'string' && /^http:\\/\\/[\\d.]+:\\d+\\/?$/.test(u) ? u.replace(/\\/$/, '') : '';
    }, function () { return ''; });
  }
  // 보여 줄 주소: 원래 주소를 모르면(파일로 연 안내문) 강사가 넣은 짧은 주소라도 글자로 보여 줌. QR·복사에는 쓰지 않음
  function pageUrl() { return siteUrl() || (LOCAL_PAGE ? DATA.shortUrl || '' : ''); }
  // 손으로 칠 주소: 강사가 넣은 짧은 주소가 있으면 그것을 크게 보여 주고 원래 주소는 그 아래 작게.
  // QR과 [주소 복사]는 언제나 원래 주소라서 짧은 주소 서비스가 멈추거나 막혀도 들어올 수 있습니다.
  // 한글이 든 주소(joo.is/우리연수)는 %EC… 대신 한글로 보여 줌
  function bare(u) { var s = String(u || '').replace(/^https?:\\/\\//, '').replace(/\\/$/, ''); try { return decodeURI(s); } catch (e) { return s; } }
  function shortShown() { var s = bare(DATA.shortUrl), u = bare(pageUrl()); return s && u && s !== u ? s : ''; }
  function fillUrls() {
    var u = pageUrl(), s = shortShown();
    $$('[data-url-self]').forEach(function (n) { n.textContent = s || (u ? bare(u) : offText(true)); });
    $$('[data-url-full]').forEach(function (n) { n.hidden = !s; n.textContent = s ? bare(u) : ''; });
  }
  // 방 안에 있는 사람용 주소(QR·복사): 암호 보호 사이트면 #k=…를 붙여 바로 열리게(보이는 글자에는 붙이지 않음)
  function unlockFrag() { var m = $('meta[name="lp-unlock"]'); return m && m.getAttribute('content') ? '#' + m.getAttribute('content') : ''; }
  // 짧은 주소는 QR·복사에 넣지 않음: 짧은 주소 서비스가 멈추면 못 들어오고, 중간 화면이 있는 서비스에는 #k=(암호)가 보임
  function joinUrl() { var u = siteUrl(); return u ? u.split('#')[0] + unlockFrag() : ''; }
  function siblingUrl(page) {
    if (LOOP) return LAN_BASE ? LAN_BASE + location.pathname.replace(/[^/]*$/, '') + page : '';
    if (!LOCAL_PAGE) return location.href.split('#')[0].split('?')[0].replace(/[^/]*$/, '') + page;
    var b = (DATA.base || '').split('#')[0].split('?')[0]; if (!b) return '';
    return (/\\.html?$/i.test(b) ? b.replace(/[^/]*$/, '') : b.replace(/\\/?$/, '/')) + page;
  }
  function fillQR(n, url, offText) {
    if (url) { n.innerHTML = qrSvg(url); return; }
    n.textContent = ''; n.appendChild(el('span', 'lp-qr-off', offText || (LOOP ? URL_LOOP : URL_OFF)));
  }
  function paintQRs() {
    $$('[data-qr]').forEach(function (n) { n.innerHTML = qrSvg(n.getAttribute('data-qr')); });
    $$('[data-qr-self]').forEach(function (n) { if (!n.closest('dialog')) fillQR(n, joinUrl(), pageUrl() ? '배포하면 QR이 나와요.' : ''); });
    $$('[data-qr-page]').forEach(function (n) { fillQR(n, siblingUrl(n.getAttribute('data-qr-page')), LOOP ? URL_LOOP : '배포하면 QR이 나와요.'); });
  }
  function drawQRs() {
    // 대화상자 밖에 QR 칸이 있으면(설문 QR·안내문): 이미 실려 있으면 바로, 아니면 화면에 가까워질 때 불러와 그림
    var boxes = $$('[data-qr],[data-qr-page]').concat($$('[data-qr-self]').filter(function (n) { return !n.closest('dialog'); }));
    if (boxes.length) {
      if (window.qrcode) paintQRs();
      else if ('IntersectionObserver' in window) {
        var qio = new IntersectionObserver(function (es) { if (es.some(function (e) { return e.isIntersecting; })) { qio.disconnect(); needQR().then(paintQRs); } }, { rootMargin: '600px 0px' });
        boxes.forEach(function (n) { qio.observe(n); });
      } else needQR().then(paintQRs);
    }
    fillUrls();
    var pages = function () { $$('[data-url-page]').forEach(function (n) { n.textContent = siblingUrl(n.getAttribute('data-url-page')) || (LOOP ? '노트북의 와이파이 주소 + ' : '배포한 사이트 주소 + ') + n.getAttribute('data-url-page'); }); };
    pages();
    // localhost로 열었으면 같은 와이파이 주소를 물어 QR·주소를 그 주소로 다시 그림(모르면 바꾸는 법을 그대로 보임)
    askLan().then(function (b) { if (!b) return; LAN_BASE = b; fillUrls(); pages(); if (window.qrcode) paintQRs(); });
  }
  window.LecPage.urls = { page: pageUrl, join: joinUrl, sibling: siblingUrl, short: shortShown, off: URL_OFF };

  /* ── 목록을 다시 그릴 때 키보드 초점 지키기 ──
     그리기 전 초점이 목록 안이면 같은 항목(data-id)의 같은 단추로, 그 항목이 없어졌으면 목록 첫 단추나 목록 자체로.
     목록 밖 같은 칸의 양식이 닫히며 초점을 잃으면(보드 올리기 뒤) back()이 주는 단추로. 화면 낭독기·키보드 사용자가 맨 위로 튀지 않게 */
  var FOCUSABLE = 'button,a[href],input,textarea,select';
  function keepFocus(draw, list, back) {
    return function () {
      var host = list(), a = doc.activeElement, sec = host && host.closest('section');
      if (!host || !a || a === doc.body || !(sec || host).contains(a)) return draw.apply(this, arguments);
      var inList = host.contains(a), item = inList && a.closest('[data-id]'), id = item ? item.getAttribute('data-id') : null;
      var k = $$(FOCUSABLE, item || host).indexOf(a), cls = a.className;
      var r = draw.apply(this, arguments);
      var now = doc.activeElement;
      if (now && now !== doc.body && now.isConnected && now.getClientRects().length) return r; // 초점이 그대로 살아 있음
      var t = null;
      if (inList) {
        var ni = id ? $$('[data-id]', host).filter(function (n) { return n.getAttribute('data-id') === id; })[0] : host;
        var cand = ni ? $$(FOCUSABLE, ni) : [];
        t = (cls ? cand.filter(function (n) { return n.className === cls; })[0] : null) || cand[k] || $$(FOCUSABLE, host)[0] || host;
      } else t = back && back();
      if (!t) return r;
      if (t === host && !host.hasAttribute('tabindex')) host.setAttribute('tabindex', '-1');
      try { t.focus({ preventScroll: true }); } catch (e) { }
      return r;
    };
  }

  /* ── 대화상자: 열 때 누른 버튼을 기억했다가 닫으면 그 버튼으로 초점을 돌려줍니다 ── */
  function closeDialog(d) { if (d.close && d.open) d.close(); else d.removeAttribute('open'); }
  function openDialog(d, opener) {
    if (!d) return;
    d._opener = opener || doc.activeElement;
    if (!d._hooked) {
      d._hooked = true;
      d.addEventListener('close', function () { var o = d._opener; d._opener = null; if (o && o.focus && doc.contains(o)) setTimeout(function () { o.focus(); }, 0); });
      d.addEventListener('click', function (e) { if (e.target === d) closeDialog(d); });
      $$('[data-sheet-close]', d).forEach(function (b) { b.addEventListener('click', function () { closeDialog(d); }); });
    }
    if (d.showModal) { if (!d.open) d.showModal(); } else d.setAttribute('open', '');
  }
  // 메뉴 높이만큼 앵커 이동 여백을 맞춤(지금 줄이 생기면 메뉴가 길어짐)
  function fitScrollPad() { var h = $('.lp-nav'); if (h) root.style.setProperty('--lp-head', (h.offsetHeight + 16) + 'px'); }
  function goTo(id) {
    var t = doc.getElementById(id); if (!t) return;
    if (location.hash === '#' + id) t.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' }); else location.hash = id;
    if (!t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1');
    try { t.focus({ preventScroll: true }); } catch (e) { }
  }

  /* ── 테마·움직임 ───────────────────────── */
  // 가벼운 모드 적용: <html data-motion>을 1로, data-fx-lowpower를 1로. 효과(LecFX)가 시작하기 전에 불러야 함
  var MOTION0 = root.getAttribute('data-motion'), REST0 = root.getAttribute('data-rest');
  function applyLite(on) {
    root.classList.toggle('lp-lite', on); root.classList.toggle('lp-paused', on);
    if (on) {
      if (+MOTION0 > 1) root.setAttribute('data-motion', '1');
      if (+REST0 > 1) root.setAttribute('data-rest', '1');
      root.setAttribute('data-fx-lowpower', '1');
    } else {
      if (MOTION0 !== null) root.setAttribute('data-motion', MOTION0);
      if (REST0 !== null) root.setAttribute('data-rest', REST0);
      root.setAttribute('data-fx-lowpower', '0'); // 직접 껐으면 저사양 기기 자동 낮춤도 하지 않음(사용자 선택이 우선)
    }
  }
  // 저장된 선택(또는 예전의 '움직임 멈춤')을 되살림: 이 스크립트는 효과(LecFX)가 시작하기 전에 실행됨.
  // 선택한 적이 없으면 그대로 두고, 저사양 기기는 효과 쪽(LecFX)이 알아서 한 단계 낮춤
  try {
    var lite0 = localStorage.getItem('lp-lite');
    if (lite0 === '1' || (lite0 === null && localStorage.getItem('lp-motion-paused') === '1')) { applyLite(true); if (window.LecFX) LecFX.pause(); }
    else if (lite0 === '0') root.setAttribute('data-fx-lowpower', '0');
  } catch (e) { }

  // 스크롤 연출(움직임 3단계) 준비: 정말 약한 기기(코어 2개·메모리 2GB 이하)·데이터 절약 모드는 CSS 연출을 쉬게 하고(lp-lowpower),
  // 휴대폰(굵은 포인터·좁은 화면)은 무거운 흐림(backdrop-filter)만 뺌(lp-handheld). 스크롤에 묶인 CSS 움직임은 transform·opacity라 휴대폰에서도 가벼움.
  // 넓은 화면에서는 첫 화면이 포인터에 살짝 반응(--px·--py)
  function initScrollShow() {
    var n = navigator, c = n.connection || {}, mm = window.matchMedia ? function (q) { return matchMedia(q).matches; } : function () { return false; };
    var low = (n.hardwareConcurrency && n.hardwareConcurrency <= 2) || (n.deviceMemory && n.deviceMemory <= 2) || c.saveData;
    if (low && root.getAttribute('data-fx-lowpower') !== '0') root.classList.add('lp-lowpower');
    if (mm('(pointer: coarse)') && innerWidth < 700) root.classList.add('lp-handheld');
    var hero = $('main > .lp-hero');
    if (!hero || RM || +MOTION0 < 3 || !mm('(hover: hover) and (pointer: fine)')) return;
    var q = 0, ex = 0, ey = 0;
    hero.addEventListener('pointermove', function (e) {
      ex = e.clientX; ey = e.clientY; if (q) return;
      q = requestAnimationFrame(function () { q = 0; if (root.classList.contains('lp-paused')) return; var r = hero.getBoundingClientRect(); hero.style.setProperty('--px', ((ex - r.left) / r.width * 2 - 1).toFixed(3)); hero.style.setProperty('--py', ((ey - r.top) / r.height * 2 - 1).toFixed(3)); });
    }, { passive: true });
  }

  function initChrome() {
    var tb = $('[data-theme-toggle]');
    if (tb) tb.addEventListener('click', function () {
      var cur = root.getAttribute('data-theme');
      if (cur === 'auto') cur = (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
      var next = cur === 'dark' ? 'light' : 'dark';
      // 색이 바뀌는 수천 개 칸이 한꺼번에 전환(transition)을 만들지 않게 한 장면 동안 끔(큰 연수에서 누른 뒤 멈칫하던 것)
      root.classList.add('lp-theming');
      root.setAttribute('data-theme', next);
      requestAnimationFrame(function () { requestAnimationFrame(function () { root.classList.remove('lp-theming'); }); });
      try { localStorage.setItem('lp-theme', next); } catch (e) { }
    });
    // 가벼운 모드: 움직임을 차분 단계(1)로 낮추고, 무거운 효과(WebGL·외부 라이브러리·끝없이 도는 그림)를 끈 뒤 효과를 다시 시작
    var lb = $('[data-lite-toggle]');
    function setLite(on) {
      applyLite(on);
      if (lb) lb.setAttribute('aria-pressed', String(on));
      try { localStorage.setItem('lp-lite', on ? '1' : '0'); localStorage.setItem('lp-motion-paused', on ? '1' : '0'); } catch (e) { }
      if (window.LecFX) { try { LecFX.stop(); if (on) LecFX.pause(); else LecFX.resume(); LecFX.start(); } catch (e) { } }
      toast(on ? '가벼운 모드를 켰어요. 움직임을 줄였어요.' : '가벼운 모드를 껐어요.');
    }
    if (lb) {
      lb.setAttribute('aria-pressed', String(root.classList.contains('lp-lite')));
      lb.addEventListener('click', function () { setLite(!root.classList.contains('lp-lite')); });
    }

    // 공유 단추·주소 복사: 엔진 쪽은 하나씩, 키트 사이트는 접속 칸·도크·대화상자에 여럿일 수 있어 모두 이음
    var dlg = $('[data-share-dialog]');
    if (dlg) $$('[data-share]').forEach(function (share) {
      share.addEventListener('click', function () {
        var u = pageUrl(), j = joinUrl(), su = $('[data-share-url]', dlg), off = $('[data-url-off]', dlg), cb = $('[data-copy-url]', dlg);
        if (su) su.textContent = shortShown() || u; if (off) { off.hidden = !!u; if (!u) off.textContent = offText(); } if (cb) cb.hidden = !j;
        $$('[data-qr-self]', dlg).forEach(function (n) { n.hidden = !j; if (j) needQR().then(function () { fillQR(n, j); }); });
        openDialog(dlg, share);
      });
    });
    $$('[data-copy-url]').forEach(function (cu) { cu.addEventListener('click', function () { copyText(joinUrl(), '주소를 복사했어요.'); }); });

    // 메뉴 '더보기'(데스크톱)와 '목차' 시트(휴대폰)
    var more = $('[data-more]');
    if (more) {
      doc.addEventListener('click', function (e) { if (more.open && !more.contains(e.target)) more.open = false; });
      more.addEventListener('keydown', function (e) { if (e.key === 'Escape' && more.open) { more.open = false; more.querySelector('summary').focus(); } });
      more.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('a')) more.open = false; });
    }
    var tocBtn = $('[data-toc-open]'), toc = $('[data-toc-sheet]');
    if (tocBtn && toc) {
      tocBtn.addEventListener('click', function () { openDialog(toc, tocBtn); var c = $('[data-toc-link][aria-current="true"]', toc); if (c) c.focus(); });
      toc.addEventListener('click', function (e) {
        var a = e.target.closest && e.target.closest('[data-toc-link]'); if (!a) return;
        e.preventDefault(); toc._opener = null; closeDialog(toc); goTo(a.getAttribute('data-toc-link'));
      });
    }
    fitScrollPad(); window.addEventListener('resize', fitScrollPad);

    // 메뉴 현재 위치 + 스크롤 진행 막대
    var links = $$('[data-nav-link]');
    if (links.length && 'IntersectionObserver' in window) {
      var map = {}; links.forEach(function (a) { map[a.getAttribute('data-nav-link')] = a; });
      var tocLinks = $$('[data-toc-link]');
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (!e.isIntersecting) return;
          links.forEach(function (a) { a.removeAttribute('aria-current'); });
          tocLinks.forEach(function (a) { if (a.getAttribute('data-toc-link') === e.target.id) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
          var a = map[e.target.id];
          if (more) more.classList.toggle('is-current', !!(a && more.contains(a)));
          if (a) { a.setAttribute('aria-current', 'true'); if (a.scrollIntoView && a.parentNode.scrollWidth > a.parentNode.clientWidth) a.parentNode.scrollTo({ left: a.offsetLeft - 40, behavior: RM ? 'auto' : 'smooth' }); }
        });
      }, { rootMargin: '-40% 0px -55% 0px' });
      $$('main > section[id]').forEach(function (s) { io.observe(s); });
    }
    var bar = $('[data-scrollbar]');
    if (bar) { var tick = false; window.addEventListener('scroll', function () { if (tick) return; tick = true; requestAnimationFrame(function () { var h = doc.documentElement.scrollHeight - innerHeight; bar.style.setProperty('--p', h > 0 ? Math.min(1, scrollY / h) : 0); tick = false; }); }, { passive: true }); }
  }

  /* ── 복사·프롬프트 ─────────────────────── */
  function initPrompts() {
    // 글 상자는 글이 다 보이는 높이: CSS field-sizing을 모르는 브라우저는 폭이 바뀔 때(처음 보일 때 포함)만 글 높이에 맞춤
    var sized = window.CSS && CSS.supports && CSS.supports('field-sizing', 'content');
    var fit = function (ta) { if (sized || !ta.offsetWidth) return; ta.style.height = 'auto'; ta.style.height = (ta.scrollHeight + 2) + 'px'; };
    var ro = !sized && window.ResizeObserver ? new ResizeObserver(function (es) { es.forEach(function (e) { var w = Math.round(e.contentRect.width); if (w && w !== e.target._lpw) { e.target._lpw = w; fit(e.target); } }); }) : null;
    $$('[data-prompt]').forEach(function (ta) {
      var k = 'prompt:' + ta.getAttribute('data-prompt'), orig = ta.value, saved = store.get(k, null);
      var restore = ta.parentNode.querySelector('[data-restore]');
      if (saved !== null && saved !== orig) { ta.value = saved; if (restore) restore.hidden = false; }
      if (ro) ro.observe(ta);
      ta.addEventListener('input', function () { store.set(k, ta.value); if (restore) restore.hidden = ta.value === orig; fit(ta); });
      if (restore) restore.addEventListener('click', function () { ta.value = orig; store.del(k); restore.hidden = true; fit(ta); toast('원문으로 되돌렸어요.'); });
    });
    doc.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-copy]');
      if (b) {
        var box = b.closest('.lp-prompt'); var ta = box && box.querySelector('textarea');
        if (ta) copyText(ta.value, notebook.add(ta.value, labelOf(b)) ? '복사했어요. 모음에도 담았어요.' : '복사했어요. AI 도구에 붙여 넣으세요.', ta).then(function (ok) { if (ok) { b.classList.add('is-copied'); var s = b.querySelector('span'); var o = s && s.textContent; if (s) s.textContent = '복사됨'; setTimeout(function () { b.classList.remove('is-copied'); if (s) s.textContent = o; }, 1600); } });
        // 사이트 스크립트가 복사하는 단추(data-copy="글 상자 id"): 복사는 사이트가, 모음에 담기만 여기서
        else { var src = b.getAttribute('data-copy'), pre = src && /^[A-Za-z][\\w-]*$/.test(src) ? doc.getElementById(src) : null; if (pre && notebook.add(pre.value !== undefined ? pre.value : pre.textContent, labelOf(b))) toast('모음에도 담았어요.'); }
        return;
      }
      var c = e.target.closest && e.target.closest('[data-copy-text]');
      if (c) { var tx = c.getAttribute('data-copy-text'); copyText(tx, notebook.add(tx, labelOf(c)) ? '복사했어요. 모음에도 담았어요.' : '복사했어요.'); }
    });
  }

  /* ── 모음(data-lp="notebook"): 복사한 프롬프트·내 메모를 이 기기에 모으고 .txt로 받기 ── */
  // 사이트에 모음 칸이 있을 때만(어느 쪽이든) 복사할 때마다 담음. 사이트 스크립트는 LecPage.notebook.add(글, 제목)로 더함
  var NB_MAX = 200;
  function nbList() { var a = store.get('nb', []); return Array.isArray(a) ? a.filter(function (x) { return x && typeof x.t === 'string'; }) : []; }
  /** 복사 단추의 이름: 단추·감싼 칸의 data-title, 아니면 그 앞의 가장 가까운 제목 */
  function labelOf(el) {
    var own = el.getAttribute('data-title'); if (own) return own.slice(0, 60);
    for (var n = el.parentElement, i = 0; n && i < 7; n = n.parentElement, i++) {
      var dt = n.getAttribute && n.getAttribute('data-title'); if (dt) return dt.slice(0, 60);
      var hs = n.querySelectorAll ? n.querySelectorAll('h1,h2,h3,h4,h5,figcaption,legend') : [];
      for (var k = hs.length - 1; k >= 0; k--) if (hs[k].compareDocumentPosition(el) & 4) return hs[k].textContent.replace(/\\s+/g, ' ').trim().slice(0, 60);
    }
    return '';
  }
  var notebook = {
    on: function () { return !!DATA.notebook; },
    list: function () { return nbList().map(function (x) { return { text: x.t, title: x.s || '', at: x.at || 0 }; }); },
    /** 담으면 true(같은 글이 이미 있으면 맨 아래로 옮기기만) */
    add: function (text, title) {
      if (!DATA.notebook) return false;
      var t = String(text == null ? '' : text).replace(/\\r\\n?/g, '\\n').trim(); if (!t) return false;
      t = t.slice(0, 4000);
      var a = nbList().filter(function (x) { return x.t !== t; });
      a.push({ t: t, s: String(title || '').replace(/\\s+/g, ' ').trim().slice(0, 60), at: Date.now() });
      store.set('nb', a.slice(-NB_MAX)); drawNotebook(true); return true;
    }
  };
  window.LecPage.notebook = notebook;
  function nbText() {
    var t = (DATA.title || '연수') + ' · 모음\\n' + new Date().toLocaleDateString('ko-KR') + '\\n';
    nbList().forEach(function (x, i) { t += '\\n■ ' + String(i + 1).padStart(2, '0') + (x.s ? ' ' + x.s : '') + '\\n' + x.t + '\\n'; });
    return t;
  }
  function drawNotebook(added) {
    var a = nbList();
    $$('[data-notebook]').forEach(function (box) {
      var ul = $('[data-nb-list]', box); if (!ul) return;
      ul.textContent = '';
      if (!a.length) ul.appendChild(el('li', 'lp-empty', '아직 담은 글이 없어요. 프롬프트의 [복사]를 누르면 여기에 모여요.'));
      a.forEach(function (x, i) {
        var li = el('li');
        if (x.s) li.appendChild(el('span', 'lp-nb-src', x.s));
        li.appendChild(el('pre', 'lp-nb-t', x.t));
        var act = el('div', 'lp-nb-a');
        var cp = el('button', 'lp-btn lp-btn-ghost lp-btn-sm', '복사'); cp.type = 'button'; cp.setAttribute('aria-label', (i + 1) + '번째 글 복사');
        cp.addEventListener('click', function () { copyText(x.t, '복사했어요.'); });
        var out = el('button', 'lp-btn lp-btn-ghost lp-btn-sm', '빼기'); out.type = 'button'; out.setAttribute('aria-label', (i + 1) + '번째 글 빼기');
        out.addEventListener('click', function () { store.set('nb', nbList().filter(function (y) { return y.t !== x.t; })); drawNotebook(); var f = $('[data-nb-form] textarea', box); if (f) f.focus(); toast('모음에서 뺐어요.'); });
        act.appendChild(cp); act.appendChild(out); li.appendChild(act); ul.appendChild(li);
      });
      ['[data-nb-save]', '[data-nb-copy]', '[data-nb-clear]'].forEach(function (q) { var b = $(q, box); if (b) b.disabled = !a.length; });
      var c = $('[data-nb-count]', box); if (c) c.textContent = a.length ? '담은 글 ' + a.length + '개' : '';
      var nw = $('[data-nb-news]', box); if (nw && added) nw.textContent = '모음에 담았어요. 모두 ' + a.length + '개';
    });
  }
  function initNotebook() {
    var boxes = $$('[data-notebook]'); if (!boxes.length) return;
    boxes.forEach(function (box) {
      var f = $('[data-nb-form]', box);
      if (f) f.addEventListener('submit', function (e) { e.preventDefault(); var ta = f.querySelector('textarea'); if (notebook.add(ta.value, '내 메모')) { ta.value = ''; toast('모음에 담았어요.'); } });
      var sv = $('[data-nb-save]', box); if (sv) sv.addEventListener('click', function () { download((DATA.title || '연수').replace(/[\\\\/:*?"<>|]/g, '').slice(0, 60) + '_모음.txt', nbText(), '모음을 .txt로 받았어요.'); });
      var cp = $('[data-nb-copy]', box); if (cp) cp.addEventListener('click', function () { copyText(nbText(), '모음을 모두 복사했어요.'); });
      var cl = $('[data-nb-clear]', box); if (cl) cl.addEventListener('click', function () { if (!window.confirm('모음을 모두 지울까요? 이 기기에서만 지워져요.')) return; store.del('nb'); drawNotebook(); toast('모음을 비웠어요.'); });
    });
    // 다른 탭(사이트의 다른 쪽)에서 담으면 여기도
    window.addEventListener('storage', function (e) { if (e.key === KEY + ':nb') drawNotebook(); });
    drawNotebook();
  }

  /* ── 일정: 지금 순서 ─────────────────────── */
  function initSchedule() {
    // 기본 시간 레일(.lp-schedule)과 배치 변형(가로 트랙·시계판·시간표·블록: [data-sched])이 같은 표시. 시간 도식의 조각([data-seg])도 함께
    $$('.lp-schedule, [data-sched]').forEach(function (ol) {
      var dg = ol.closest('[data-diagram]');
      var segs = ol.classList.contains('lp-schedule') ? $$('.lp-sched-bar i', ol.parentNode) : dg && dg !== ol ? $$('[data-seg]', dg) : []; // 위의 시간 막대도 같은 표시(지금·지남)
      var rows = ol.tagName === 'TABLE' ? $$('tbody > tr', ol) : $$(':scope > li', ol);
      function upd() {
        var now = new Date(), today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
        var mins = now.getHours() * 60 + now.getMinutes();
        var q = /[?&]now=(\\d{1,2}):(\\d{2})\\b/.exec(location.search); // 미리 보기: ?now=15:45 (연수 날 그 시각처럼 표시)
        if (q) { mins = +q[1] * 60 + +q[2]; today = ol.getAttribute('data-date') || today; }
        segs.forEach(function (x) { x.classList.remove('is-now', 'is-done'); });
        rows.forEach(function (li, i) {
          var d = li.getAttribute('data-date') || ol.getAttribute('data-date');
          li.classList.remove('is-now', 'is-done');
          if (d && d !== today) return;
          var s = toMin(li.getAttribute('data-start')), en = toMin(li.getAttribute('data-end'));
          if (s === null) return;
          if (en === null) { var nx = li.nextElementSibling; en = nx ? toMin(nx.getAttribute('data-start')) : s + 30; }
          var st = mins >= s && mins < en ? 'is-now' : mins >= en ? 'is-done' : '';
          if (st) { li.classList.add(st); if (segs[i]) segs[i].classList.add(st); }
        });
      }
      upd(); setInterval(upd, 30000);
    });
  }
  function toMin(t) { var m = /^(\\d{1,2}):(\\d{2})/.exec(t || ''); return m ? (+m[1]) * 60 + (+m[2]) : null; }
  function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

  /* ── 본문 배치 변형의 움직임과 조작(runtime/body.css) ──
     · 스크롤 연동 단계(data-rest 2·3)이고 브라우저가 스크롤 연동 애니메이션을 지원하면 html.lp-sdt(동작 줄이기·저사양이면 붙이지 않음)
     · 넘김([data-pager]): 낱말 링크를 누르면 그 판으로 부드럽게, 넘기면 지금 낱말 표시. 링크·스크롤은 JS 없이도 동작
     · 필름 띠([data-film]): 이전·다음 버튼과 지금 장면 번호. 방향키는 띠에 초점이 있을 때 브라우저가 처리
     · 도식 잇기([data-linked]): 목록 줄을 가리키거나 초점이 오면 그림의 같은 번호([data-seg]·[data-node])가 켜짐
     · 질문 색인([data-spy]): 읽고 있는 답의 질문이 색인에서 켜짐 */
  function initBody() {
    // 도표의 '표로 보기'는 인쇄할 때 펼쳐 둠(종이에서는 누를 수 없으므로)
    if ($('details[data-print-open]')) {
      window.addEventListener('beforeprint', function () { $$('details[data-print-open]:not([open])').forEach(function (d) { d.open = true; d.setAttribute('data-print-opened', ''); }); });
      window.addEventListener('afterprint', function () { $$('details[data-print-opened]').forEach(function (d) { d.open = false; d.removeAttribute('data-print-opened'); }); });
    }
    var rest = +(root.getAttribute('data-rest') || 0), sup = window.CSS && CSS.supports && CSS.supports('animation-timeline: view()');
    if (rest >= 2 && sup && !RM && !root.classList.contains('lp-lowpower')) root.classList.add('lp-sdt');
    var smooth = RM ? 'auto' : 'smooth';
    function current(links, i) { links.forEach(function (a, k) { if (k === i) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); }); }
    function nearest(track, kids) { var x = track.scrollLeft, best = 0, d = 1e9; kids.forEach(function (c, i) { var e = Math.abs(c.offsetLeft - track.firstElementChild.offsetLeft - x); if (e < d) { d = e; best = i; } }); return best; }
    $$('[data-pager]').forEach(function (pg) {
      var track = $('.lp-tb-panels', pg), panels = $$('.lp-tb-panel', pg), links = $$('.lp-tb-list a', pg);
      if (!track || !panels.length) return;
      links.forEach(function (a, i) {
        a.addEventListener('click', function (e) { e.preventDefault(); track.scrollTo({ left: panels[i].offsetLeft - panels[0].offsetLeft, behavior: smooth }); current(links, i); });
        a.addEventListener('keydown', function (e) { var k = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (!k) return; e.preventDefault(); var j = (i + k + links.length) % links.length; links[j].focus(); links[j].click(); });
      });
      var q = 0; track.addEventListener('scroll', function () { if (q) return; q = requestAnimationFrame(function () { q = 0; current(links, nearest(track, panels)); }); }, { passive: true });
    });
    $$('[data-film]').forEach(function (fm) {
      var track = $('.lp-film-track', fm), cards = $$('.lp-film-card', fm), cur = $('[data-film-cur]', fm), nav = $('.lp-film-nav', fm);
      if (!track || !cards.length) return;
      if (nav) nav.hidden = false;
      function go(d) { var i = Math.max(0, Math.min(cards.length - 1, nearest(track, cards) + d)); track.scrollTo({ left: cards[i].offsetLeft - cards[0].offsetLeft, behavior: smooth }); }
      var p = $('[data-film-prev]', fm), n = $('[data-film-next]', fm);
      if (p) p.addEventListener('click', function () { go(-1); });
      if (n) n.addEventListener('click', function () { go(1); });
      var q = 0; track.addEventListener('scroll', function () { if (q) return; q = requestAnimationFrame(function () { q = 0; var i = nearest(track, cards); if (cur) cur.textContent = String(i + 1); if (p) p.disabled = track.scrollLeft < 4; if (n) n.disabled = track.scrollLeft > track.scrollWidth - track.clientWidth - 4; }); }, { passive: true });
      if (p) p.disabled = true;
    });
    $$('[data-linked]').forEach(function (box) {
      var items = $$('ol > li, ul > li, dl > div', box).filter(function (x) { return !x.closest('[aria-hidden="true"]') && x.parentNode.closest('[data-linked]') === box; });
      var segs = $$('[data-seg]', box), nodes = $$('[data-node]', box);
      function hot(i) { [segs, nodes, items].forEach(function (list) { list.forEach(function (x, k) { x.classList.toggle('is-hot', k === i); }); }); }
      items.forEach(function (it, i) {
        it.addEventListener('pointerenter', function () { hot(i); });
        it.addEventListener('focusin', function () { hot(i); });
      });
      box.addEventListener('pointerleave', function () { hot(-1); });
      box.addEventListener('focusout', function (e) { if (!box.contains(e.relatedTarget)) hot(-1); });
    });
    if ('IntersectionObserver' in window) $$('[data-spy]').forEach(function (sp) {
      var links = $$('nav a', sp), items = links.map(function (a) { return doc.getElementById(decodeURIComponent(a.getAttribute('href').slice(1))); });
      var io = new IntersectionObserver(function (ens) { ens.forEach(function (en) { if (en.isIntersecting) current(links, items.indexOf(en.target)); }); }, { rootMargin: '-30% 0px -60% 0px' });
      items.forEach(function (x) { if (x) io.observe(x); });
    });
  }

  /* ── 차시: 날짜로 마침·오늘·다음 표시(상태를 직접 적지 않은 경우) ── */
  function initSessions() {
    $$('[data-sessions-auto]').forEach(function (ol) {
      var today = ymd(new Date()), next = false;
      $$('li[data-date]', ol).forEach(function (li) {
        var d = li.getAttribute('data-date'), st = d < today ? 'done' : d === today ? 'now' : (!next ? (next = true, 'next') : '');
        li.setAttribute('data-status', st);
        var c = $('[data-session-chip]', li); if (c) { c.textContent = { done: '마침', now: '오늘', next: '다음' }[st] || ''; c.hidden = !st; }
      });
    });
  }

  /* ── 연수 전·중·후: 끝난 뒤에는 '연수 후 안내'를 첫 화면 아래로 올리고 회의 입장 버튼을 숨김(?phase=after로 미리 보기) ──
     열어 둔 화면도 시각이 지나면 바뀌게 30초마다(그리고 화면으로 돌아올 때) 다시 셈. 단계가 바뀌면 'lp:phase' 알림(참여 기능이 도크·출석·'지금' 줄을 맞춤) */
  // 앱 미리보기(한 장 HTML)는 주소에 ?phase를 붙일 수 없어 <html data-lp-phase>로 받음(예: 먼저 해보기의 지난 날짜 견본을 '연수 전'으로)
  var PHASE_Q = /[?&]phase=(before|during|after)\\b/.exec(location.search) || /^(before|during|after)$/.exec(doc.documentElement.getAttribute('data-lp-phase') || '');
  /** 지금 단계와 오늘의 연수 시간(여러 날이면 그날, 없으면 다음 날) */
  function phaseNow() {
    var w = DATA.phase; if (!w || !w.end) return null;
    var now = new Date(), days = w.days && w.days.length ? w.days : [{ start: w.start, end: w.end }];
    var cur = null, next = null;
    for (var i = 0; i < days.length; i++) {
      var s = new Date(days[i].start), e = new Date(days[i].end);
      if (now >= s && now <= e) cur = days[i];
      if (!next && now < s) next = days[i];
    }
    var phase = PHASE_Q ? PHASE_Q[1] : now > new Date(w.end) ? 'after' : now >= new Date(w.start) ? 'during' : 'before';
    return { phase: phase, day: cur, next: next, w: w };
  }
  /** 출석을 받는 때: 오늘 연수 시작 30분 전부터 끝날 때까지(미리 보기 ?phase=during이면 늘) */
  function attendWindow() {
    var p = phaseNow(); if (!p || p.phase === 'after') return false;
    if (PHASE_Q) return p.phase === 'during';
    var w = p.w, days = w.days && w.days.length ? w.days : [{ start: w.start, end: w.end }], now = new Date();
    return days.some(function (d) { return now >= new Date(new Date(d.start) - 30 * 60000) && now <= new Date(d.end); });
  }
  var phaseShown = '';
  function initPhase() {
    if (!DATA.phase || !DATA.phase.end) return;
    applyPhase();
    if (!PHASE_Q) {
      setInterval(applyPhase, 30000);
      doc.addEventListener('visibilitychange', function () { if (!doc.hidden) applyPhase(); });
    }
  }
  function applyPhase() {
    var p = phaseNow(); if (!p) return;
    heroState(p);
    if (p.phase === phaseShown) { doc.dispatchEvent(new CustomEvent('lp:tick', { detail: p.phase })); return; }
    var first = !phaseShown; phaseShown = p.phase;
    root.setAttribute('data-phase', p.phase);
    if (p.phase === 'after') {
      $$('[data-phase-hide="after"]').forEach(function (n) { n.hidden = true; });
      $$('[data-phase-show="after"]').forEach(function (n) { n.hidden = false; });
      var fu = $('[data-followup]'), hero = $('main > .lp-hero');
      if (fu && hero) { var at = hero.nextElementSibling; if (at && at.classList.contains('lp-divider')) at = at.nextElementSibling; if (at !== fu) hero.parentNode.insertBefore(fu, at); }
      var bar = $('[data-phase-bar]');
      if (bar) {
        // 키트 사이트: '종료' 줄이 키트 상자(.lpk) 밖에 있으면(사이트가 옮겼거나 조립 결과를 다시 쓴 경우) 키트 줄 상자에 넣어 모양을 갖춤
        if (root.hasAttribute('data-lpk') && !bar.closest('.lpk')) { var box = el('div', 'lpk lpk-now'); doc.body.appendChild(box); box.appendChild(bar); }
        bar.hidden = false; fitScrollPad();
      }
    }
    if (!first) doc.dispatchEvent(new CustomEvent('lp:phase', { detail: p.phase }));
  }

  // 첫 화면 한 줄: 연수 전 '시작까지 3일'(이틀 안쪽이면 시간·분), 연수 중 '지금 진행 중'(여러 날이면 쉬는 날에는 '다음 …'), 끝나면 '끝난 연수'
  function heroState(p) {
    var box = $('[data-hero-state]'), out = box && $('[data-hero-state-text]', box); if (!out) return;
    function left(at) {
      var ms = new Date(at) - new Date();
      if (ms <= 0) return '곧 시작해요';
      var min = Math.ceil(ms / 60000);
      if (min < 60) return '시작까지 ' + min + '분';
      if (min < 48 * 60) return '시작까지 ' + Math.floor(min / 60) + '시간';
      return '시작까지 ' + Math.floor(min / 1440) + '일';
    }
    var words = DATA.words || {}, t;
    if (p.phase === 'before') t = left(p.w.start);
    else if (p.phase === 'during') t = p.day || PHASE_Q || !(p.w.days && p.w.days.length) ? '지금 진행 중' : p.next ? (new Date(p.next.start) - new Date() < 12 * 3600000 ? left(p.next.start) : '다음 ' + (new Date(p.next.start).getMonth() + 1) + '. ' + new Date(p.next.start).getDate() + '.') : '지금 진행 중';
    else t = words.ended || '끝난 연수';
    if (out.textContent !== t) out.textContent = t;
    box.hidden = false;
  }

  /* ── 준비 점검·접속 확인 ──────────────────── */
  function initReadiness() {
    $$('[data-checklist]').forEach(function (ul) {
      var k = 'check:' + ul.getAttribute('data-checklist'), st = store.get(k, {});
      $$('input[data-check]', ul).forEach(function (cb) {
        cb.checked = !!st[cb.getAttribute('data-check')];
        cb.addEventListener('change', function () { st[cb.getAttribute('data-check')] = cb.checked; store.set(k, st); });
      });
    });
    $$('[data-diag]').forEach(function (box) {
      var run = $('[data-diag-run]', box);
      function probe(url) {
        return new Promise(function (res) {
          var done = false, t = setTimeout(function () { if (!done) { done = true; res('fail'); } }, 7000);
          try {
            fetch(url, { mode: 'no-cors', cache: 'no-store', credentials: 'omit' }).then(function () { if (!done) { done = true; clearTimeout(t); res('ok'); } }, function () { if (!done) { done = true; clearTimeout(t); res('fail'); } });
          } catch (e) { done = true; clearTimeout(t); res('fail'); }
        });
      }
      function go() {
        var items = $$('li[data-url]', box);
        items.forEach(function (li) { li.setAttribute('data-state', 'wait'); $('.lp-diag-state', li).textContent = '확인 중'; });
        return Promise.all(items.map(function (li) {
          return probe(li.getAttribute('data-url')).then(function (r) { li.setAttribute('data-state', r); $('.lp-diag-state', li).textContent = r === 'ok' ? '열림' : '막힘'; });
        })).then(function () {
          var bad = items.filter(function (li) { return li.getAttribute('data-state') === 'fail'; }).length;
          toast(bad ? '열리지 않는 곳이 ' + bad + '개 있어요.' : '모두 열려요.');
        });
      }
      if (run) run.addEventListener('click', go);
      if (box.hasAttribute('data-diag-auto')) go();
      var env = $('[data-env]', box);
      if (env) env.textContent = '브라우저: ' + navigator.userAgent.replace(/\\s*\\([^)]*\\)/g, ' ').replace(/\\s+/g, ' ').slice(0, 140) + ' · 화면 ' + innerWidth + '×' + innerHeight + (navigator.onLine === false ? ' · 오프라인' : '');
      var cp = $('[data-diag-copy]', box);
      if (cp) cp.addEventListener('click', function () {
        var lines = $$('li[data-url]', box).map(function (li) { return (li.getAttribute('data-state') === 'ok' ? '[열림] ' : li.getAttribute('data-state') === 'fail' ? '[막힘] ' : '[미확인] ') + li.querySelector('small').textContent; });
        var lv = $('[data-live-diag]', box);
        copyText(['접속 확인 결과 (' + new Date().toLocaleString('ko-KR') + ')', location.href].concat(lines, lv ? [lv.textContent] : [], env ? [env.textContent] : []).join('\\n'), '결과를 복사했어요.');
      });
      var lvd = $('[data-live-diag]', box);
      if (lvd && DATA.live && window.LecLive) {
        try {
          var lv = LecLive.create(DATA.live);
          lv.connect().then(function (r) { lvd.textContent = '참여 기능 연결 방식: ' + ({ realtime: '실시간', polling: '천천히 묻기(이 망이 웹소켓을 막음)', local: '이 기기 안에서만' }[r && r.mode] || (r && r.mode) || '알 수 없음'); }, function (e) { lvd.textContent = '참여 기능 서버에 연결하지 못했어요: ' + (e && e.message || e); });
        } catch (e) { lvd.textContent = '참여 기능 서버에 연결하지 못했어요.'; }
      }
    });
  }

  /* ── 교재 보기 ─────────────────────────── */
  var deckApi = null;
  function initDeck() {
    var deck = $('[data-deck]'); if (!deck) return;
    var slides = $$('.lp-slide', deck); if (!slides.length) return;
    var stage = $('.lp-deck-stage', deck), bar = $('.lp-deck-bar', deck), cur = 0;
    deck.classList.add('is-ready'); bar.hidden = false;
    var thumbs = el('div', 'lp-deck-thumbs'); thumbs.setAttribute('aria-label', '쪽 미리보기');
    // 쪽 미리보기 단추는 교재가 화면에 가까워질 때 만듦(교재 수백 쪽이면 단추 수백 개 — 첫 화면을 그리는 동안 만들지 않게)
    var made = false;
    function makeThumbs() {
      if (made) return; made = true;
      var frag = doc.createDocumentFragment();
      slides.forEach(function (s, i) {
        var b = el('button'); b.type = 'button';
        var img = s.querySelector('img');
        // 그림만 있는 버튼은 쪽 번호를 이름으로, 글자가 보이는 버튼은 보이는 글자가 곧 이름(접근성: 이름과 보이는 글이 같아야 함)
        if (img) { b.setAttribute('aria-label', s.getAttribute('data-page') + '쪽'); var t = el('img'); t.loading = 'lazy'; t.alt = ''; t.src = img.src; b.appendChild(t); img._lpThumb = t; } else b.appendChild(thumbText(s));
        b.addEventListener('click', function () { go(i); });
        frag.appendChild(b);
      });
      thumbs.appendChild(frag);
      go(cur, { quiet: true });
    }
    bar.parentNode.insertBefore(thumbs, bar.nextSibling);
    if (slides.length > 24 && 'IntersectionObserver' in window) {
      var tio = new IntersectionObserver(function (es) { if (es.some(function (e) { return e.isIntersecting; })) { tio.disconnect(); makeThumbs(); } }, { rootMargin: '900px 0px' });
      tio.observe(deck);
    } else makeThumbs();
    // 그림 주소가 나중에 바뀌면(암호 보호 사이트의 blob: 주소) 미리보기도 따라 바꿈
    if (window.MutationObserver) new MutationObserver(function (ms) { ms.forEach(function (m) { if (m.target._lpThumb) m.target._lpThumb.src = m.target.src; }); }).observe(stage, { attributes: true, attributeFilter: ['src'], subtree: true });
    function go(i, opt) {
      cur = Math.max(0, Math.min(slides.length - 1, i));
      slides.forEach(function (s, k) { s.classList.toggle('is-active', k === cur); });
      $('[data-deck-cur]', deck).textContent = slides[cur].getAttribute('data-page');
      $$('button', thumbs).forEach(function (b, k) { if (k === cur) { b.setAttribute('aria-current', 'true'); if (b.scrollIntoView && !(opt && opt.quiet)) thumbs.scrollTo({ left: b.offsetLeft - thumbs.clientWidth / 2 + 56, behavior: RM ? 'auto' : 'smooth' }); } else b.removeAttribute('aria-current'); });
      [cur + 1, cur + 2].forEach(function (k) { var im = slides[k] && slides[k].querySelector('img'); if (im) im.loading = 'eager'; });
    }
    $('[data-deck-prev]', deck).addEventListener('click', function () { go(cur - 1); });
    $('[data-deck-next]', deck).addEventListener('click', function () { go(cur + 1); });
    stage.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight' || e.key === 'PageDown') { go(cur + 1); e.preventDefault(); } if (e.key === 'ArrowLeft' || e.key === 'PageUp') { go(cur - 1); e.preventDefault(); } });
    var sx = null; stage.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
    stage.addEventListener('touchend', function (e) { if (sx === null) return; var dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 50) go(cur + (dx < 0 ? 1 : -1)); sx = null; });
    var fb = $('[data-deck-full]', deck);
    if (fb) {
      if (!deck.requestFullscreen) fb.hidden = true;
      else fb.addEventListener('click', function () {
        if (doc.fullscreenElement) return doc.exitFullscreen().catch(function () { });
        deck.requestFullscreen().then(function () {
          if (!(window.matchMedia && matchMedia('(orientation: portrait)').matches)) return;
          var o = screen.orientation, tip = function () { toast('휴대폰을 가로로 돌리면 쪽이 크게 보여요.'); };
          if (o && o.lock) o.lock('landscape').catch(tip); else tip();
        }, function () { });
      });
    }
    var ob = $('[data-deck-overview]', deck);
    if (ob) ob.addEventListener('click', function () { overview(slides, function (i) { go(i); stage.focus(); }, ob); });
    function fromHash() { var m = /^#deck-p(\\d+)$/.exec(location.hash); if (!m) return false; var i = slides.findIndex(function (s) { return s.getAttribute('data-page') === m[1]; }); if (i >= 0) { go(i); deck.scrollIntoView({ block: 'start', behavior: RM ? 'auto' : 'smooth' }); } return true; }
    window.addEventListener('hashchange', fromHash);
    if (!fromHash()) go(0, { quiet: true });
    deckApi = { go: function (page) {
      var i = slides.findIndex(function (s) { return +s.getAttribute('data-page') === +page; }); if (i < 0 || i === cur) return;
      // 쪽만 맞추고 화면은 옮기지 않음(발표 내내 따라 넘기기가 켜져 있어 다른 칸을 읽는 사람을 끌어오지 않게). 교재가 화면 밖이면 '지금' 줄에 [N쪽 보기]
      go(i);
    }, has: function (page) { return slides.some(function (s) { return +s.getAttribute('data-page') === +page; }); }, follow: function () { var c = $('[data-deck-follow]', deck); return !c || c.checked; }, showFollow: function () { var l = $('.lp-follow', deck); if (l) l.hidden = false; } };
  }
  // 글만 있는 쪽의 작은 미리보기: 쪽 번호 + 제목(표지·부 시작은 큰 슬라이드와 같은 바탕)
  function thumbText(s) {
    var t = el('span', 'lp-thumb-t'), st = s.querySelector('.lp-slide-text'), h = st && st.querySelector('h3');
    if (st) t.setAttribute('data-kind', st.getAttribute('data-kind') || 'body');
    t.appendChild(el('b', '', s.getAttribute('data-page'))); t.appendChild(el('i', '', (h && h.textContent) || s.getAttribute('data-title') || ''));
    return t;
  }
  function overview(slides, pick, opener) {
    var ov = el('dialog', 'lp-overview' + (root.hasAttribute('data-lpk') ? ' lpk' : '')); ov.setAttribute('aria-label', '전체 쪽 보기');
    var h = el('div', 'lp-overview-h'); var inp = el('input'); inp.type = 'search'; inp.placeholder = '제목·내용으로 찾기'; inp.setAttribute('aria-label', '쪽 찾기');
    var close = el('button', 'lp-btn lp-btn-ghost', '닫기'); close.type = 'button';
    h.appendChild(inp); h.appendChild(close); ov.appendChild(h);
    var grid = el('div', 'lp-overview-grid'); ov.appendChild(grid);
    var picked = -1;
    var btns = slides.map(function (s, i) {
      var b = el('button'); b.type = 'button'; var img = s.querySelector('img');
      if (img) { var t = el('img'); t.loading = 'lazy'; t.alt = ''; t.src = img.src; b.appendChild(t); b.appendChild(el('span', '', s.getAttribute('data-page') + '. ' + (s.getAttribute('data-title') || ''))); }
      else b.appendChild(thumbText(s));
      b.addEventListener('click', function () { picked = i; ov.close(); });
      b._q = ((s.getAttribute('data-title') || '') + ' ' + (s.getAttribute('data-text') || '')).toLowerCase();
      grid.appendChild(b); return b;
    });
    inp.addEventListener('input', function () { var q = inp.value.trim().toLowerCase(); btns.forEach(function (b) { b.hidden = !!q && b._q.indexOf(q) < 0; }); });
    close.addEventListener('click', function () { ov.close(); });
    ov.addEventListener('close', function () { ov.remove(); if (picked >= 0) pick(picked); else if (opener && doc.contains(opener)) opener.focus(); });
    doc.body.appendChild(ov);
    if (ov.showModal) ov.showModal(); else ov.setAttribute('open', '');
    inp.focus();
  }

  /* ── 실습 ─────────────────────────────── */
  var stApi = null;
  function initStations() {
    var shell = $('[data-stations]'); if (!shell) return;
    var arts = $$('.lp-st', shell); if (!arts.length) return;
    var links = $$('[data-st-link]', shell);
    var done = store.get('done', []), cur = -1;
    // 키트(data-layout="kit"): AI가 쓴 섹션이 실습 단계 — 한 칸씩 보이기(is-ready) 없이, 강사 따라가기는 그 단계로 옮기고 스크롤로 지금 단계를 셈
    var layout = shell.getAttribute('data-layout'), kit = layout === 'kit';
    if (layout !== 'scroll' && !kit) shell.classList.add('is-ready');
    function idOf(i) { return arts[i].getAttribute('data-st'); }
    function paint() {
      links.forEach(function (a) { a.classList.toggle('is-done', done.indexOf(a.getAttribute('data-st-link')) >= 0); });
      // 첫 화면 실습지(종이 워크북)의 체크 칸도 함께
      $$('[data-hero-st]').forEach(function (a) { a.classList.toggle('is-done', done.indexOf(a.getAttribute('data-hero-st')) >= 0); });
      $$('[data-done]', shell).forEach(function (b) {
        var id = b.closest('.lp-st').getAttribute('data-st'), on = done.indexOf(id) >= 0;
        b.setAttribute('aria-pressed', String(on)); b.querySelector('span').textContent = on ? '완료했어요' : '완료 체크';
      });
      var c = $('[data-st-count]', shell); if (c) c.textContent = done.length + ' / ' + arts.length;
      var p = $('[data-st-progress]', shell); if (p) { p.max = arts.length; p.value = done.length; } // 최대는 단계 수(사이트가 max를 적지 않아도)
    }
    function show(i, scroll) {
      if (i < 0 || i >= arts.length) return;
      cur = i;
      arts.forEach(function (a, k) { a.classList.toggle('is-active', k === i); });
      links.forEach(function (a, k) { if (k === i) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current'); });
      store.set('last', idOf(i));
      if (scroll && kit) arts[i].scrollIntoView({ block: 'start', behavior: RM ? 'auto' : 'smooth' });
      else if (scroll && layout !== 'scroll') shell.scrollIntoView({ block: 'start', behavior: RM ? 'auto' : 'smooth' });
      if (live.ready) live.progress(idOf(i), done.indexOf(idOf(i)) >= 0 ? 'done' : 'doing');
    }
    function fromHash(scroll) { var m = /^#st-(.+)$/.exec(location.hash); if (!m) return false; var i = arts.findIndex(function (a) { return a.getAttribute('data-st') === decodeURIComponent(m[1]); }); if (i >= 0) { show(i, scroll); return true; } return false; }
    window.addEventListener('hashchange', function () { fromHash(true); });
    if (!fromHash(false)) { var last = store.get('last', null); var li = last ? arts.findIndex(function (a) { return a.getAttribute('data-st') === last; }) : 0; show(li < 0 ? 0 : li, false); }
    shell.addEventListener('click', function (e) {
      var b = e.target.closest('[data-done]');
      if (b) {
        var id = b.closest('.lp-st').getAttribute('data-st'), k = done.indexOf(id);
        if (k >= 0) { done.splice(k, 1); toast('완료 체크를 풀었어요.'); } else { done.push(id); toast('완료했어요.'); } // 완료 반응은 체크가 그려지는 차분한 움직임(CSS)뿐: 실습 칸은 1단계까지만
        store.set('done', done); paint();
        if (live.ready) live.progress(id, k >= 0 ? 'doing' : 'done');
        return;
      }
      var s = e.target.closest('[data-stuck]');
      if (s) live.help(s.closest('.lp-st').getAttribute('data-st'));
    });
    $$('[data-memo]', shell).forEach(function (ta) {
      var k = 'memo:' + ta.getAttribute('data-memo'); ta.value = store.get(k, '');
      ta.addEventListener('input', function () { store.set(k, ta.value); });
    });
    var ex = $('[data-st-export]', shell);
    if (ex) ex.addEventListener('click', function () {
      var t = (DATA.title || '연수') + ' · 나의 실습 기록\\n' + new Date().toLocaleDateString('ko-KR') + '\\n\\n';
      arts.forEach(function (a, i) {
        var id = a.getAttribute('data-st');
        t += (done.indexOf(id) >= 0 ? '[완료] ' : '[진행 전] ') + String(i + 1).padStart(2, '0') + ' ' + ((a.querySelector('h3,h2,h4') || {}).textContent || a.getAttribute('data-title') || id) + '\\n';
        var memo = store.get('memo:' + id, ''); if (memo) t += '  메모: ' + memo.replace(/\\n/g, '\\n        ') + '\\n';
        $$('[data-prompt]', a).forEach(function (ta) { var v = store.get('prompt:' + ta.getAttribute('data-prompt'), null); if (v !== null) t += '  고친 프롬프트: ' + v.replace(/\\n/g, ' ') + '\\n'; });
        t += '\\n';
      });
      download((DATA.title || '연수').replace(/[\\\\/:*?"<>|]/g, '') + '_나의기록.txt', t, '실습 기록을 내려받았어요.');
    });
    paint();
    // 키트: 화면 가운데를 지나는 단계가 '지금 실습'(진행 현황·도움 요청이 이 단계를 셈)
    if (kit && 'IntersectionObserver' in window) {
      var sio = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { var i = arts.indexOf(e.target); if (i >= 0 && i !== cur) show(i, false); } }); }, { rootMargin: '-45% 0px -50% 0px' });
      arts.forEach(function (a) { sio.observe(a); });
    }
    stApi = { go: function (id) { var i = arts.findIndex(function (a) { return a.getAttribute('data-st') === id; }); if (i >= 0 && i !== cur) { show(i, true); toast('' + HOST_GA + ' 보는 실습으로 이동했어요.'); } }, current: function () { return cur >= 0 ? idOf(cur) : null; }, done: function () { return done.slice(); } };
  }

  /* ── 퀴즈·기록 ─────────────────────────── */
  function initQuiz() {
    $$('[data-quiz] li').forEach(function (li) {
      li.addEventListener('change', function (e) {
        var r = e.target; if (!r || r.type !== 'radio') return;
        $$('label', li).forEach(function (l) { l.classList.remove('is-right', 'is-wrong'); });
        var ok = r.getAttribute('data-correct') === '1';
        r.closest('label').classList.add(ok ? 'is-right' : 'is-wrong');
        if (!ok) { var right = li.querySelector('input[data-correct="1"]'); if (right) right.closest('label').classList.add('is-right'); }
        var fb = $('.lp-quiz-fb', li); fb.hidden = false; fb.textContent = (ok ? '정답이에요. ' : '아쉬워요. ') + (fb.getAttribute('data-explain') || '');
      });
    });
    $$('[data-reflect]').forEach(function (f) {
      var k = 'reflect:' + f.getAttribute('data-reflect'), st = store.get(k, {});
      $$('textarea', f).forEach(function (ta) { var q = ta.getAttribute('data-reflect-q'); ta.value = st[q] || ''; ta.addEventListener('input', function () { st[q] = ta.value; store.set(k, st); }); });
      var b = $('[data-reflect-save]', f);
      if (b) b.addEventListener('click', function () {
        var t = (DATA.title || '연수') + ' · 나의 기록\\n\\n';
        $$('label', f).forEach(function (l) { t += '■ ' + l.querySelector('span').textContent + '\\n' + (l.querySelector('textarea').value || '(비어 있음)') + '\\n\\n'; });
        download((DATA.title || '연수').replace(/[\\\\/:*?"<>|]/g, '') + '_나의기록.txt', t, '내려받았어요.');
      });
    });
  }

  /* ── 실시간 ─────────────────────────────── */
  var live = { ready: false, progress: function () { }, help: function () { toast('참여 기능이 꺼져 있어요. 손을 들어 강사에게 알려 주세요.'); } };
  function initLive() {
    if (!DATA.live || !window.LecLive || !$('[data-dock]') && !$('[data-qa]') && !$('[data-board]') && !$('[data-survey]')) return;
    var conn;
    try { conn = LecLive.create(DATA.live); } catch (e) { return; }
    var me = store.get('me', null), feats = DATA.live.features || [];
    var dock = $('[data-dock]'), dot = $('[data-live-status]');
    var qs = {}, posts = {}, answers = {}, state = {}, voted = store.get('voted', {});
    var X = LecLive.util.ext, U = LecLive.util;
    if (dock && root.getAttribute('data-phase') !== 'after') { // 끝난 연수에는 도움 요청·신호 도크를 띄우지 않음
      dock.hidden = false; root.classList.add('lp-dock-on');
      // 도크 높이(휴대폰에서는 두 줄이 되기도 함)를 --lp-dock-h로: Tab으로 옮긴 칸이 도크 밑에 숨지 않게 scroll-padding-bottom에 씀(lecpage.css)
      var dockH = function () { root.style.setProperty('--lp-dock-h', dock.offsetHeight + 'px'); };
      dockH(); if ('ResizeObserver' in window) new ResizeObserver(dockH).observe(dock);
      // 첫 화면이 화면 아래쪽에 걸려 있는 동안은 도크를 감춤(첫 화면 오른쪽 아래를 가리지 않게). 지나가면 나타남
      var hero0 = $('main > .lp-hero');
      if (hero0 && scrollY < innerHeight * 0.5) root.classList.add('lp-hero-in');
      if (hero0 && 'IntersectionObserver' in window) {
        new IntersectionObserver(function (es) {
          var on = es[es.length - 1].isIntersecting;
          if (on && dock.contains(doc.activeElement)) return; // 도크를 쓰는 중이면 그대로 둠
          root.classList.toggle('lp-hero-in', on);
        }, { rootMargin: '-78% 0px 0px 0px' }).observe(hero0);
      }
    }
    $$('[data-live-off]').forEach(function (n) { n.hidden = true; });
    if (feats.indexOf('help') >= 0) $$('[data-stuck]').forEach(function (b) { b.hidden = false; });
    if (deckApi) deckApi.showFollow();

    // 서버에 닿지 않아 이 기기에 쌓아 둔 글(연결되면 보냄): '올렸어요' 대신 '연결되면 보내요'라고 말함(도움 요청과 같은 말)
    function queued(d) { return !!(d && (d._pending || d.queued)); }
    function liveErr(err, dflt) { return err && /^(locked|poll_closed|rate_limited|too_long|hidden|reserved_nickname|uploads_disabled)$/.test(err.code) && err.message ? err.message : dflt; }
    // 연결이 끊긴 동안 쌓아 둔 글이 나중에 거절되면(잠금·닫힌 투표 등) 조용히 사라지지 않게 알림
    if (conn.on) conn.on('error', function (err, op) { if (op && err && err.status && err.status < 500) toast(liveErr(err, '보내지 못한 기록이 있어요. 다시 해 주세요.')); });
    function setStatus(s) {
      if (dot) { dot.setAttribute('data-state', s); dot.title = { live: '참여 기능 연결됨', polling: '연결됨(조금 늦게 보여요)', offline: '연결 끊김', connecting: '연결 중', local: '이 기기 안에서만' }[s] || s; }
      // 참여 기능 서버에 닿지 않으면(처음부터 못 이었거나 20초 넘게 끊김) 참여 칸마다 차분한 한 줄. 교재·실습·프롬프트 복사는 그대로
      clearTimeout(downT);
      if (s === 'offline') downT = setTimeout(function () { setDown(true); }, live.ready ? 20000 : 0);
      else if (s === 'live' || s === 'polling' || s === 'local') setDown(false);
    }
    var down = false, downT = 0;
    var DOWN = '참여 기능 서버에 지금 닿지 않아요. 교재·실습·프롬프트는 그대로 쓸 수 있어요. 질문은 손을 들어 해 주세요.';
    function setDown(on) {
      if (on === down) return; down = on;
      root.classList.toggle('lp-live-down', on);
      $$('[data-live-down]').forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
      if (!on) return;
      [$('[data-qa]'), $('[data-board]')].concat($$('[data-poll]'), $$('[data-survey]')).forEach(function (box) {
        if (!box || !box.parentNode) return;
        var n = el('p', 'lp-note lp-live-down', DOWN); n.setAttribute('data-live-down', ''); n.setAttribute('role', 'status');
        box.parentNode.insertBefore(n, box);
      });
    }
    setStatus('connecting');
    // 이름·소속은 입실할 때만 받음(설계도가 받기로 한 경우). 투표·공감·질문·도움 요청은 창 없이 바로(별명은 서버가 '참가자123'처럼 붙임,
    // 한 사람 한 번은 서버가 이 기기의 참가자 번호로 지킴). 별명은 다른 사람에게 이름이 보이는 보드 글(질문을 실명으로 받는 연수면 질문도)에서만 물음
    var NEED_ID = !!(DATA.privacy && (DATA.privacy.collect || []).some(function (c) { return c === 'name' || c === 'school'; }));
    var named = function () { return !!(me && me.token && me.nickname && !me.auto); };
    /** o.attend: 입실 확인(이름·소속이 필요하면 받음) · o.nick: 남에게 보이는 별명이 필요함(보드 글) */
    function ensureJoin(o) {
      o = o || {};
      var forId = !!o.attend && NEED_ID, forNick = !!o.nick;
      // 서버에 닿지 않는 동안 처음 참여하려 하면 빈 창을 띄우지 않고 그 사실만(이미 참여했으면 보낼 글은 연결되면 보냄)
      if (down && !(me && me.token)) { toast('참여 기능 서버에 지금 닿지 않아요. 교재와 실습은 그대로 쓸 수 있어요.'); return Promise.reject(new Error('cancel')); }
      if (me && me.token && !(forId && !me.named) && !(forNick && !named())) return Promise.resolve(me);
      if (!forId && !forNick) {
        // 창 없이 참여: 투표·공감·질문·도움 요청·설문
        return conn.join({ nickname: '' }).then(function (r) {
          var m0 = conn.me ? conn.me() : null;
          me = { id: r.id, token: r.token, nickname: (m0 && m0.nickname) || '', auto: true }; store.set('me', me); return me;
        }, function (err) { toast(liveErr(err, '참여하지 못했어요. 잠시 뒤 다시 해 주세요.')); throw new Error('cancel'); });
      }
      var dlg = $('[data-join-dialog]');
      return new Promise(function (resolve, reject) {
        if (!dlg) return reject(new Error('no dialog'));
        var f = $('[data-join-form]', dlg), errBox = $('[data-join-err]', dlg), lead = $('[data-join-lead]', dlg), nick = f.elements.nickname, go = $('[data-join-go]', dlg);
        var profileOnly = !!(me && me.token) && forId; // 이미 참여함: 이름·소속만 더함
        if (lead && !lead._orig) lead._orig = lead.textContent;
        // 입실: 이름·소속·동의만(별명은 따로 받지 않음 — 이름은 출석 확인에만 쓰고 남에게 보이는 별명은 보드에 글을 쓸 때 정함)
        if (lead) lead.textContent = forId ? '입실 확인에 쓸 이름' + ($('input[name="school"]', dlg) ? '·소속' : '') + '을 적어 주세요.' : lead._orig;
        if (go) go.textContent = forId ? '입실' : '참여';
        // 쓰지 않는 칸은 감추고 꺼 둠(꺼진 칸은 필수 검사와 보내는 값에서 빠짐)
        $$('[data-join-id]', dlg).forEach(function (l) { l.hidden = !forId; $$('input', l).forEach(function (i) { i.disabled = !forId; }); });
        var nl = $('[data-join-nick]', dlg); if (nl) { nl.hidden = forId; nick.disabled = forId; if (!forId && me && me.auto) nick.value = ''; }
        function sayErr(t, field) {
          if (!errBox) { toast(t); return; }
          errBox.textContent = t || ''; errBox.hidden = !t;
          [nick].concat($$('[data-join-id] input', dlg)).forEach(function (i) { if (i) i.removeAttribute('aria-invalid'); });
          if (t && field) { field.setAttribute('aria-invalid', 'true'); field.focus(); if (field.select) field.select(); }
        }
        sayErr('');
        function onSubmit(e) {
          e.preventDefault();
          var fd = new FormData(f), nm = (fd.get('name') || '').trim(), sc = (fd.get('school') || '').trim(), consent = !!fd.get('consent');
          var sent, nk = forId ? '' : (fd.get('nickname') || '').trim();
          if (profileOnly) sent = conn.update('participants', me.id, { name: nm || undefined, school: sc || undefined, consent: consent }).then(function () { return { id: me.id, token: me.token }; });
          else sent = conn.join({ nickname: nk, name: forId ? nm || undefined : undefined, school: forId ? sc || undefined : undefined, consent: forId && consent });
          sent.then(function (r) {
            var m0 = conn.me ? conn.me() : null, auto = forId ? (me ? me.auto !== false : true) : false;
            me = { id: r.id, token: r.token, nickname: nk || (m0 && m0.nickname) || (me && me.nickname) || '', named: forId || !!(me && me.named), auto: forId ? auto : false };
            store.set('me', me); dlg.close(); cleanup(); resolve(me);
          }, function (err) {
            // 오류는 창 안 그 칸 옆에(토스트는 창 뒤에 가려짐). 적은 것은 그대로 둠
            var code = err && err.code, m = err && err.message;
            if (code === 'reserved_nickname' || (code === 'too_long' && !forId)) sayErr(m || '이 별명은 쓸 수 없어요. 다른 별명을 골라 주세요.', nick);
            else if (code === 'locked') sayErr(m || '지금은 새로 참여할 수 없어요. 강사에게 알려 주세요.', null);
            else sayErr('참여하지 못했어요: ' + (m || '잠시 뒤 다시 해 주세요.'), forId ? null : nick);
          });
        }
        function onCancel() { dlg.close(); cleanup(); reject(new Error('cancel')); }
        function onInput() { if (errBox && !errBox.hidden) sayErr(''); }
        function cleanup() { f.removeEventListener('submit', onSubmit); f.removeEventListener('input', onInput); var c = $('[data-join-cancel]', dlg); if (c) c.removeEventListener('click', onCancel); }
        f.addEventListener('submit', onSubmit); f.addEventListener('input', onInput); var c = $('[data-join-cancel]', dlg); if (c) c.addEventListener('click', onCancel);
        dlg.showModal ? dlg.showModal() : dlg.setAttribute('open', '');
        setTimeout(function () { var first = forId ? $('[data-join-id] input:not([disabled])', dlg) : nick; if (first) first.focus(); }, 30);
      });
    }

    // 질문·보드 목록은 화면 읽기 알림 영역이 아님: 남의 공감 한 번에 목록 전부를 다시 읽지 않게.
    // 새로 올라온 남의 글만 목록 밖 숨은 한 줄([data-list-news])로 몇 초에 한 번 모아 짧게 알림('새 질문 2개')
    function newsLine(box, unit) {
      var n = box && $('[data-list-news]', box), seen = null, mine = {}, pend = 0, t = 0, clr = 0;
      return {
        prime: function (docs) { seen = {}; docs.forEach(function (d) { seen[d.id] = 1; }); },
        mine: function (d) { if (d) { mine[d.id] = 1; if (d.cid) mine[d.cid] = 1; } },
        see: function (docs) {
          if (!n || !seen) return;
          docs.forEach(function (d) { if (seen[d.id] || /^tmp_/.test(d.id)) return; seen[d.id] = 1; if (!mine[d.id] && !(d.cid && mine[d.cid])) pend++; });
          if (!pend || t) return;
          t = setTimeout(function () { t = 0; if (!pend) return; n.textContent = '새 ' + unit + ' ' + pend + '개'; pend = 0; clearTimeout(clr); clr = setTimeout(function () { n.textContent = ''; }, 5000); }, 2500);
        }
      };
    }
    // 목록 맞추기: 같은 글은 그 자리의 노드를 그대로 두고(바뀐 것만 새로), 순서만 맞춤. 공감·좋아요 수는 숫자만 바꿈
    function syncList(list, arr, make, sig, count) {
      var old = {};
      $$(':scope > li', list).forEach(function (li) { var id = li.getAttribute('data-id'); if (id) old[id] = li; else li.remove(); });
      arr.forEach(function (d, i) {
        var li = old[d.id], s = sig(d);
        if (!li || li._sig !== s) { var nl = make(d); nl._sig = s; if (li) list.replaceChild(nl, li); li = nl; }
        else if (count) count(li, d);
        delete old[d.id];
        if (list.children[i] !== li) list.insertBefore(li, list.children[i] || null);
      });
      Object.keys(old).forEach(function (k) { old[k].remove(); });
    }
    function emptyRow(list, text) { list.textContent = ''; list.appendChild(el('li', 'lp-empty', text)); }

    // 질문
    var qaBox = $('[data-qa]'), sortBy = 'votes', qaNews = newsLine(qaBox, '질문');
    function voteCount(li, q) {
      var v = li._vote, on = !!voted[q.id]; if (!v) return;
      v.setAttribute('aria-pressed', String(on)); v.setAttribute('aria-label', '공감 ' + (q.votes || 0)); v.lastChild.textContent = String(q.votes || 0);
    }
    function qaItem(q) {
      var li = el('li', 'lp-qa-item' + (q.pinned ? ' is-pinned' : '') + (q.status === 'answered' ? ' is-answered' : '')); li.setAttribute('data-id', q.id);
      var v = el('button', 'lp-vote'); v.type = 'button'; li._vote = v;
      v.appendChild(el('span', '', '▲')); v.appendChild(el('b', '', String(q.votes || 0))); voteCount(li, q);
      v.addEventListener('click', function () {
        if (voted[q.id]) return toast('이미 공감했어요.');
        ensureJoin().then(function () { return conn.vote(q.id); }).then(function (r) {
          voted[q.id] = 1; store.set('voted', voted);
          if (r && r.votes !== undefined && qs[q.id]) qs[q.id].votes = r.votes;
          drawQA(); if (r && r.already) toast('이미 공감했어요.');
        }, function (err) { if (err && err.message !== 'cancel') toast(liveErr(err, '공감을 보내지 못했어요.')); });
      });
      var body = el('div'); body.appendChild(el('p', '', q.text));
      var meta = el('p', 'lp-qa-meta'); meta.appendChild(el('span', '', q.anonymous || !q.nickname ? '익명' : q.nickname)); if (q.status === 'answered') meta.appendChild(el('span', '', '답변 완료')); if (q.pinned) meta.appendChild(el('span', '', HOST + ' 고정'));
      body.appendChild(meta); li.appendChild(v); li.appendChild(body);
      return li;
    }
    function drawQA() {
      if (!qaBox) return;
      var list = $('[data-qa-list]', qaBox);
      var arr = Object.keys(qs).map(function (k) { return qs[k]; }).filter(function (q) { return q.status !== 'hidden'; });
      arr.sort(function (a, b) { if (!!b.pinned - !!a.pinned) return !!b.pinned - !!a.pinned; return sortBy === 'votes' ? ((b.votes || 0) - (a.votes || 0) || (b.createdAt || 0) - (a.createdAt || 0)) : (b.createdAt || 0) - (a.createdAt || 0); });
      var hl = $('[data-hero-live]'); if (hl) { hl.hidden = false; $('[data-hero-live-n]', hl).textContent = arr.length; } // 첫 화면 유리 칸: 지금 올라온 질문 수
      qaNews.see(arr);
      if (!arr.length) return emptyRow(list, '아직 질문이 없어요. 첫 질문을 올려 주세요.');
      syncList(list, arr, qaItem, function (q) { return [q.text, q.pinned, q.status, q.anonymous, q.nickname].join('\\u0001'); }, voteCount);
    }
    if (qaBox) {
      var qf = $('[data-qa-form]', qaBox), cnt = $('[data-count]', qaBox);
      qf.querySelector('textarea').addEventListener('input', function (e) { if (cnt) cnt.textContent = e.target.value.length + ' / 500'; });
      qf.addEventListener('submit', function (e) {
        e.preventDefault(); var ta = qf.querySelector('textarea'), text = ta.value.trim(); if (!text) return;
        ensureJoin({ nick: DATA.live.anonymous === false }).then(function () { return conn.add('questions', { text: text, anonymous: DATA.live.anonymous !== false, nickname: me.nickname }); }).then(function (d) { qaNews.mine(d); if (d && d.id) qs[d.id] = d; ta.value = ''; if (cnt) cnt.textContent = '0 / 500'; drawQA(); toast(queued(d) ? '연결되면 질문을 올려요. 급하면 손을 들어 물어봐 주세요.' : '질문을 올렸어요.'); }, function (err) { if (err && err.message !== 'cancel') toast(liveErr(err, '질문을 올리지 못했어요. 잠시 뒤 다시 해 주세요.')); });
      });
      $$('[data-sort]', qaBox).forEach(function (b) { b.addEventListener('click', function () { sortBy = b.getAttribute('data-sort'); $$('[data-sort]', qaBox).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); drawQA(); }); });
    }

    // 보드
    var bBox = $('[data-board]'), cat = '', boardNews = newsLine(bBox, '글');
    function likeCount(li, p) {
      var lk = li._like; if (!lk) return;
      lk.setAttribute('aria-pressed', String(!!store.get('like:' + p.id, false))); lk.setAttribute('aria-label', '좋아요 ' + (p.likes || 0)); lk.textContent = '♥ ' + (p.likes || 0);
    }
    function postItem(p) {
      var li = el('li', 'lp-card lp-post'); li.setAttribute('data-id', p.id);
      if (p.files && p.files.length) {
        var fl = el('div', 'lp-post-files');
        p.files.forEach(function (f) {
          if (!/^(https?:|blob:|data:image)/.test(f.url || '')) return;
          var t = f.type || '', n;
          if (t.indexOf('image/') === 0) { n = el('img'); n.src = f.url; n.alt = f.name || ''; n.loading = 'lazy'; }
          else if (t.indexOf('audio/') === 0) { n = el('audio'); n.controls = true; n.preload = 'none'; n.src = f.url; }
          else if (t.indexOf('video/') === 0) { n = el('video'); n.controls = true; n.preload = 'none'; n.src = f.url; }
          else { n = el('a', 'lp-link', f.name || '파일 열기'); n.href = f.url; n.target = '_blank'; n.rel = 'noopener'; }
          fl.appendChild(n);
        });
        li.appendChild(fl);
      }
      if (p.text) li.appendChild(el('p', '', p.text));
      var ft = el('div', 'lp-post-f'); ft.appendChild(el('span', '', (p.nickname || '익명') + ' · ' + new Date(p.createdAt || Date.now()).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })));
      if (conn.like) {
        var lk = el('button', 'lp-like'); lk.type = 'button'; li._like = lk; likeCount(li, p);
        lk.addEventListener('click', function () {
          if (store.get('like:' + p.id, false)) return toast('이미 좋아요를 눌렀어요.');
          ensureJoin().then(function () { return conn.like(p.id); }).then(function (r) { store.set('like:' + p.id, true); var cur = posts[p.id] || p; cur.likes = (r && r.likes !== undefined) ? r.likes : (cur.likes || 0) + 1; drawBoard(); if (r && r.already) toast('이미 좋아요를 눌렀어요.'); }, function (err) { if (err && err.message !== 'cancel') toast(liveErr(err, '좋아요를 보내지 못했어요.')); });
        });
        ft.appendChild(lk);
      }
      li.appendChild(ft);
      return li;
    }
    function drawBoard() {
      if (!bBox) return;
      var list = $('[data-board-list]', bBox);
      var all = Object.keys(posts).map(function (k) { return posts[k]; }).filter(function (p) { return !p.hidden; });
      boardNews.see(all);
      var arr = all.filter(function (p) { return !cat || p.kind === cat; }).sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
      if (!arr.length) return emptyRow(list, '아직 올라온 글이 없어요. 첫 글을 올려 주세요.');
      syncList(list, arr, postItem, function (p) { return JSON.stringify([p.text, p.nickname, p.createdAt, (p.files || []).map(function (f) { return f.url; })]); }, likeCount);
    }
    if (bBox) {
      var bf = $('[data-board-form]', bBox), maxFiles = +bBox.getAttribute('data-max-files') || 0;
      $('[data-board-write]', bBox).addEventListener('click', function () { ensureJoin({ nick: true }).then(function () { bf.hidden = false; bf.querySelector('textarea').focus(); }, function () { }); });
      $('[data-board-cancel]', bBox).addEventListener('click', function () { bf.hidden = true; });
      $$('[data-cat]', bBox).forEach(function (b) { b.addEventListener('click', function () { cat = b.getAttribute('data-cat'); $$('[data-cat]', bBox).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); drawBoard(); }); });
      bf.addEventListener('submit', function (e) {
        e.preventDefault(); var fd = new FormData(bf), files = (bf.querySelector('input[type=file]') || {}).files || [];
        if (files.length > maxFiles) return toast('파일은 ' + maxFiles + '개까지 올릴 수 있어요.');
        var btn = bf.querySelector('[type=submit]'); btn.disabled = true; toast('올리는 중이에요…');
        var ups = Array.prototype.slice.call(files).map(function (f) { return conn.upload(f); });
        Promise.all(ups).then(function (fs) { return conn.add('posts', { kind: fd.get('kind') || '', text: (fd.get('text') || '').trim(), nickname: me.nickname, files: fs, license: fd.get('license') || 'own' }); })
          .then(function (d) { boardNews.mine(d); if (d && d.id) posts[d.id] = d; bf.reset(); bf.hidden = true; drawBoard(); toast(queued(d) ? '연결되면 보드에 올려요.' : d && d.hidden ? '보냈어요. ' + HOST_GA + ' 확인하면 보드에 보여요.' : '올렸어요.'); }, function (err) { toast('올리지 못했어요: ' + (err && err.message || '파일 크기나 종류를 확인해 주세요.')); })
          .then(function () { btn.disabled = false; });
      });
    }
    // 같은 기기의 다른 탭에서 공감·좋아요를 누르면 이 탭도 눌린 것으로(다시 눌러 아무 일 없는 것처럼 보이지 않게)
    window.addEventListener('storage', function (e) {
      if (!e.key || e.key.indexOf(KEY + ':') !== 0) return;
      var k = e.key.slice(KEY.length + 1);
      if (k === 'voted') { var nv = {}; try { nv = JSON.parse(e.newValue || '{}') || {}; } catch (x) { } for (var id in nv) voted[id] = nv[id]; drawQA(); }
      else if (k.indexOf('like:') === 0) drawBoard();
    });

    // 투표: 설계도의 문항(data-poll) + 강사 화면에서 바로 띄운 즉석 투표(polls 모음, 질문 한 줄·보기 2~5개)
    // 키트 사이트는 투표 자리가 여럿일 수 있음: 문항은 모두 모으고, 열린 투표는 그 문항이 적힌 자리에 그림(즉석 투표는 첫 자리)
    var pollBoxes = $$('[data-poll]'), pollBox = pollBoxes[0] || null, pollDefs = [], quick = {};
    function defsOf(b) { try { return JSON.parse(b.getAttribute('data-poll') || '[]') || []; } catch (e) { return []; } }
    pollBoxes.forEach(function (b) { pollDefs = pollDefs.concat(defsOf(b)); });
    function boxOf(id) { return pollBoxes.filter(function (b) { return defsOf(b).some(function (x) { return x.id === id; }); })[0] || pollBoxes[0] || null; }
    function openPoll() {
      var id = state.openPoll; if (!id) return null;
      var p = pollDefs.filter(function (x) { return x.id === id; })[0]; if (p) return p;
      var q = quick[id];
      return q && q.question && Array.isArray(q.options) && q.options.length ? { id: q.id, question: q.question, kind: 'choice', options: q.options } : null;
    }
    // 투표 칸이 없는 사이트에서 즉석 투표가 열리면 마무리 앞에 칸을 만듦(자료 링크와 같은 방식)
    function ensurePollBox() {
      if (pollBox) return pollBox;
      var s = el('section', 'lp-sec lp-sec-poll'); s.id = 'live-poll'; s.setAttribute('data-frame', 'plain');
      var w = el('div', 'lp-wrap'), h = el('header', 'lp-head'); h.appendChild(el('h2', 'lp-h2', '투표')); w.appendChild(h);
      var box = el('div', 'lp-poll'); box.setAttribute('data-poll', '[]');
      var live0 = el('div', 'lp-poll-live'); live0.setAttribute('data-poll-live', ''); box.appendChild(live0);
      w.appendChild(box); s.appendChild(w);
      var before = $('.lp-sec-closing'), main = $('[data-lp-extra]') || $('main');
      if (before && before.parentNode) before.parentNode.insertBefore(s, before); else if (main) main.appendChild(s); else return null;
      pollBox = box; pollBoxes.push(box); return box;
    }
    function pollSecId() { var s = pollBox && (pollBox.closest('section[id]') || pollBox.closest('[id]')); return s ? s.id : ''; }
    // 투표 칸이 화면 가운데쯤 보이는지('지금' 줄의 [투표하기]·[결과 보기]를 뺄 때)
    var pollVis = false;
    function watchPoll() {
      if (!('IntersectionObserver' in window)) return;
      pollBoxes.forEach(function (b) {
        if (b._io) return;
        b._io = new IntersectionObserver(function (es) { b._vis = es[es.length - 1].isIntersecting; var v = !!(pollBox && pollBox._vis); if (v !== pollVis) { pollVis = v; drawNow(); } }, { rootMargin: '-25% 0px -25% 0px' });
        b._io.observe(b);
      });
    }
    function drawPoll() {
      var p = openPoll();
      if (!pollBox && !p) return;
      if (!ensurePollBox()) return;
      if (pollBoxes.length > 1) {
        var nb = (p && boxOf(p.id)) || pollBox;
        if (nb !== pollBox) { var oh = $('[data-poll-live]', pollBox); if (oh) { oh._ask = ''; oh.textContent = ''; oh.appendChild(el('p', 'lp-empty', '' + HOST_GA + ' 투표를 열면 여기에 나타나요.')); } pollBox = nb; pollVis = !!nb._vis; }
      }
      watchPoll();
      var host = $('[data-poll-live]', pollBox);
      var mine = p ? store.get('ans:' + p.id, null) : null;
      // 답하기 칸(낱말 입력·보기 단추)은 열린 투표·내 응답이 바뀔 때만 새로 그림. 남의 응답·결과 공개가 올 때마다 다시 그리면
      // 치던 낱말(한글 조합 중인 글자까지)이 지워져, 많이 몰릴수록 아무도 못 냄. 답하기 칸에는 남의 응답이 보이지 않으므로 그대로 둠
      var askKey = p && mine === null ? [p.id, p.kind, p.question].concat(p.options || []).join('\\u0001') : '';
      if (askKey && host._ask === askKey) return;
      host._ask = askKey; host.textContent = '';
      if (!p) { host.appendChild(el('p', 'lp-empty', '' + HOST_GA + ' 투표를 열면 여기에 나타나요.')); return; }
      host.appendChild(el('h3', '', p.question));
      var list = Object.keys(answers).map(function (k) { return answers[k]; }).filter(function (a) { return a.poll === p.id; });
      var tally = X.tally(list); // 응답자당 한 표(강사·발표 화면과 같은 수)
      if (mine === null) {
        if (p.kind === 'word') {
          var f = el('form', 'lp-row'); var i = el('input'); i.maxLength = 20; i.placeholder = '낱말 하나'; i.required = true; i.setAttribute('aria-label', '응답'); i.autocomplete = 'off';
          var b = el('button', 'lp-btn lp-btn-primary', '보내기'); b.type = 'submit'; f.appendChild(i); f.appendChild(b);
          f.addEventListener('submit', function (e) { e.preventDefault(); if (b.disabled) return; b.disabled = true; answer(p, i.value.trim(), function () { b.disabled = false; }); }); host.appendChild(f);
        } else {
          var opts = p.kind === 'scale' && !p.options.length ? ['1', '2', '3', '4', '5'] : p.options;
          var ol = el('div', 'lp-poll-opts'); opts.forEach(function (o) { var b = el('button', '', o); b.type = 'button'; b.addEventListener('click', function () { if (ol._busy) return; ol._busy = true; answer(p, o, function () { ol._busy = false; }); }); ol.appendChild(b); }); host.appendChild(ol);
        }
      } else {
        host.appendChild(el('p', 'lp-small', '응답했어요: ' + mine));
        // 결과는 강사가 '결과 공개'를 눌러야 보임(먼저 본 답에 끌려가지 않게)
        if (!X.revealed(state, p.id)) { host.appendChild(el('p', 'lp-note', '결과는 ' + HOST_GA + ' 공개하면 여기에 보여요.')); return; }
        // 공개 전에는 서버가 남의 응답 값을 보내지 않음(sealed). 공개되면 다시 받아 오는 동안 한 줄만
        if (list.some(function (a) { return a.sealed; })) { host.appendChild(el('p', 'lp-note', '결과를 불러오는 중이에요.')); return; }
        var total = list.length || 1;
        if (p.kind === 'word') {
          var words = U.wordCloud(list, p.id, { hidden: X.hiddenWords(state) }), wt = words.reduce(function (a, w) { return a + w.count; }, 0) || 1;
          var cl = el('div', 'lp-cloud'); words.slice(0, 40).forEach(function (w) { var s = el('span', '', w.word); s.style.fontSize = (1 + Math.min(2.4, w.count / wt * 6)) + 'rem'; s.title = w.count + '명'; cl.appendChild(s); });
          if (!words.length) cl.appendChild(el('p', 'lp-small', '아직 보여 줄 낱말이 없어요.'));
          host.appendChild(cl);
        }
        else {
          // 퀴즈: 강사가 정답을 공개하면(ui.ans) 그 보기에 '정답'과 내 답이 맞았는지
          var ai = X.answerOf ? X.answerOf(state, p.id) : -1, right = ai >= 0 ? p.options[ai] : undefined;
          if (right !== undefined) host.appendChild(el('p', 'lp-quiz-me', mine === right ? '맞았어요.' : '정답은 ‘' + right + '’이에요.'));
          var bars = el('div', 'lp-bars');
          (p.options.length ? p.options : Object.keys(tally)).forEach(function (o) {
            var n = tally[o] || 0; var row = el('div', 'lp-bar' + (o === right ? ' is-answer' : '')); var lb = el('span', '', o + ' · ' + n + '명'); if (o === right) lb.appendChild(el('b', 'lp-bar-tag', '정답')); row.appendChild(lb);
            var tr = el('div', 'lp-bar-track'); var fi = el('div', 'lp-bar-fill'); fi.style.setProperty('--w', Math.round(n / total * 100) + '%'); tr.appendChild(fi); row.appendChild(tr); bars.appendChild(row);
          });
          host.appendChild(bars);
        }
      }
    }
    function answer(p, v, done) {
      if (!v) { if (done) done(); return; }
      ensureJoin().then(function () { return conn.add('answers', { poll: p.id, value: v }); }).then(function (d) { store.set('ans:' + p.id, v); if (d && d.id) answers[d.id] = d; drawPoll(); drawNow(); toast(queued(d) ? '연결되면 응답을 보내요.' : '응답했어요.'); }, function (err) { if (done) done(); if (err && err.message !== 'cancel') { toast(liveErr(err, '응답을 보내지 못했어요. 잠시 뒤 다시 해 주세요.')); drawPoll(); } });
    }

    // 출석: 입실·퇴실 시각은 이 기기에 적어 두고(여러 날 연수는 날마다) 새로 고침해도 출석 칸에 다시 보여 줌.
    // [출석](도크·첫 화면 줄)은 연수 시간(그날 시작 30분 전부터 끝까지)에 아직 입실하지 않았을 때만. 시각이 지나면 다시 셈
    var da = $('[data-dock-attend]'), ha = $('[data-hero-attend]'), gate = da ? da.getAttribute('data-dock-attend') === 'in' : !!ha;
    var multiDay = !!(DATA.phase && DATA.phase.days && DATA.phase.days.length);
    var attKey = function (kind) { return 'att:' + kind + (multiDay ? ':' + ymd(new Date()) : ''); };
    var hhmm = function () { return new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }); };
    function paintAttend() {
      var tin = store.get(attKey('in'), null), tout = store.get(attKey('out'), null);
      $$('[data-attend-state]').forEach(function (n) { n.textContent = [tin && '입실 확인 ' + tin, tout && '퇴실 확인 ' + tout].filter(Boolean).join(' · '); });
      $$('button[data-attend="in"]').forEach(function (b) { b.classList.toggle('is-done', !!tin); b.setAttribute('aria-pressed', tin ? 'true' : 'false'); });
      $$('button[data-attend="out"]').forEach(function (b) { b.classList.toggle('is-done', !!tout); b.setAttribute('aria-pressed', tout ? 'true' : 'false'); });
      var open = root.getAttribute('data-phase') !== 'after' && !tin;
      if (da) da.hidden = !(open && (gate ? attendWindow() : true));
      if (ha) ha.hidden = !(open && attendWindow());
    }
    function attend(kind) {
      return ensureJoin({ attend: kind === 'in' }).then(function () { return conn.add('attendance', { kind: kind }); }).then(function () {
        store.set(attKey(kind), hhmm()); paintAttend();
        toast(kind === 'in' ? (gate ? '입실을 확인했어요.' : '출석했어요. 고마워요.') : '퇴실을 확인했어요.');
      }, function (err) { if (err && err.message !== 'cancel') toast('출석을 보내지 못했어요. 잠시 뒤 다시 눌러 주세요.'); });
    }
    $$('[data-attend]').forEach(function (b) {
      if (!b.getAttribute('data-attend') || b.tagName !== 'BUTTON') return;
      b.addEventListener('click', function () { attend(b.getAttribute('data-attend')); });
    });
    if (da) da.addEventListener('click', function () { attend('in'); });
    if (ha) ha.addEventListener('click', function () { attend('in'); });
    paintAttend();
    doc.addEventListener('lp:tick', paintAttend);
    doc.addEventListener('lp:phase', function (e) {
      // 끝난 연수: 도크를 내리고 '지금' 줄(투표·타이머)을 정리
      if (e.detail === 'after' && dock) { dock.hidden = true; root.classList.remove('lp-dock-on', 'lp-hero-in'); }
      paintAttend(); drawNow();
    });

    // 도움 요청
    var hd = $('[data-help-dialog]'), hf = hd && $('[data-help-form]', hd);
    function sendHelp(station, seat, message) {
      store.set('seat', seat);
      return conn.add('help', { station: station, seat: seat.slice(0, 20), nickname: me.nickname, message: message }).then(function (d) { toast(down || queued(d) ? '연결되면 도움 요청을 보내요. 급하면 손을 들어 알려 주세요.' : '도움을 요청했어요. 곧 갈게요.'); if (live.ready && station) live.progress(station, 'stuck'); }, function (err) { toast('보내지 못했어요: ' + (err && err.message || '잠시 뒤 다시 해 주세요.')); });
    }
    live.help = function (stationId) {
      var opener = doc.activeElement;
      ensureJoin().then(function () {
        var station = stationId || (stApi && stApi.current()) || '';
        if (!hf) return sendHelp(station, store.get('seat', ''), '');
        hd._station = station; hf.elements.seat.value = store.get('seat', ''); hf.elements.message.value = '';
        openDialog(hd, opener);
        var f = hf.elements.seat.value ? hf.elements.message : hf.elements.seat; setTimeout(function () { f.focus(); }, 30);
      }, function () { });
    };
    if (hf) hf.addEventListener('submit', function (e) {
      e.preventDefault();
      var seat = hf.elements.seat.value.trim(), msg = hf.elements.message.value.trim();
      closeDialog(hd); sendHelp(hd._station || '', seat, msg);
    });
    var dh = $('[data-dock-help]'); if (dh) dh.addEventListener('click', function () { live.help(stApi && stApi.current()); });
    var dq = $('[data-dock-qa]'); if (dq) dq.addEventListener('click', function () { if (qaBox) { qaBox.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'center' }); var t = qaBox.querySelector('textarea'); if (t) setTimeout(function () { t.focus(); }, 300); } });
    // 신호등: 참가자당 하나(answers, poll='signal')를 덮어씀
    var mySignal = store.get('signal', null);
    if (typeof mySignal === 'string') mySignal = mySignal ? { v: mySignal, at: 0 } : null;
    var SIG_G = { green: '✓', yellow: '?', red: '!' };
    function paintSignal() {
      $$('[data-signal]').forEach(function (b) { b.setAttribute('aria-pressed', String(!!mySignal && b.getAttribute('data-signal') === mySignal.v)); });
      // 도크의 접은 단추에는 지금 보낸 신호(없으면 신호등 세 점)
      $$('[data-signal-now]').forEach(function (n) { if (mySignal && SIG_G[mySignal.v]) { n.setAttribute('data-v', mySignal.v); n.textContent = SIG_G[mySignal.v]; } else { n.removeAttribute('data-v'); n.textContent = ''; } });
    }
    function checkSignalReset() {
      var r = X.signalReset(state);
      if (mySignal && r && r > (mySignal.at || 0)) { mySignal = null; store.del('signal'); paintSignal(); if ($('[data-signal]')) toast('' + HOST_GA + ' 신호를 새로 받아요. 지금 상태를 다시 눌러 주세요.'); }
    }
    paintSignal();
    $$('[data-signal]').forEach(function (b) {
      b.addEventListener('click', function () {
        var v = b.getAttribute('data-signal'); closeFolds();
        ensureJoin().then(function () { return conn.add('answers', { poll: 'signal', value: v }); }).then(function () { mySignal = { v: v, at: conn.now ? conn.now() : Date.now() }; store.set('signal', mySignal); paintSignal(); toast({ green: '‘이해했어요’를 보냈어요.', yellow: '‘조금 헷갈려요’를 보냈어요.', red: '‘모르겠어요’를 보냈어요. 곧 갈게요.' }[v]); }, function () { });
      });
    });
    // 도크의 접는 단추(이해 정도·반응): 단추 하나를 누르면 위로 펼침. 바깥을 누르거나 Esc면 닫힘
    var folds = $$('.lp-fold');
    function setFold(box, open) { box.classList.toggle('is-open', open); $('[data-fold-toggle]', box).setAttribute('aria-expanded', String(open)); }
    function closeFolds() { folds.forEach(function (x) { setFold(x, false); }); }
    folds.forEach(function (box) {
      var t = $('[data-fold-toggle]', box);
      t.addEventListener('click', function () {
        var open = !box.classList.contains('is-open'); closeFolds(); setFold(box, open);
        if (open) { var f = $('[aria-pressed="true"]', box) || $('.lp-fold-list button', box); if (f) f.focus(); }
      });
      box.addEventListener('keydown', function (e) { if (e.key === 'Escape' && box.classList.contains('is-open')) { setFold(box, false); t.focus(); } });
    });
    if (folds.length) doc.addEventListener('click', function (e) { folds.forEach(function (x) { if (x.classList.contains('is-open') && !x.contains(e.target)) setFold(x, false); }); });
    $$('[data-react]').forEach(function (b) { b.addEventListener('click', function () { var e = b.getAttribute('data-react'); floatReaction(e); closeFolds(); if (conn.react) conn.react(e).catch(function () { }); }); });

    // 만족도 설문(참가자당 하나, 다시 내면 덮어씀)
    $$('[data-survey]').forEach(function (f) {
      var sk = 'survey:' + f.getAttribute('data-survey'), saved = store.get(sk, null), st = $('[data-sv-state]', f);
      function collect() {
        var out = {}, missing = 0;
        $$('[data-sv-key]', f).forEach(function (n) {
          var key = n.getAttribute('data-sv-key'), v;
          if (n.tagName === 'TEXTAREA') v = n.value.trim();
          else { var c = n.querySelector('input:checked'); v = c ? c.value : ''; if (!v) missing++; }
          if (v) out[key] = n.className.indexOf('lp-sv-scale') >= 0 && /^\\d+$/.test(v) ? +v : v;
        });
        return { answers: out, missing: missing };
      }
      if (saved) {
        $$('[data-sv-key]', f).forEach(function (n) {
          var v = saved[n.getAttribute('data-sv-key')]; if (v === undefined) return;
          if (n.tagName === 'TEXTAREA') n.value = v; else $$('input', n).forEach(function (i) { i.checked = String(i.value) === String(v); });
        });
        if (st) st.textContent = '제출했어요. 고칠 게 있으면 바꾼 뒤 다시 내 주세요.';
      }
      var sbtn = f.querySelector('[type=submit]'), sLabel = sbtn ? sbtn.textContent : '', ask = 0;
      f.addEventListener('change', function () { if (ask) { ask = 0; if (sbtn) sbtn.textContent = sLabel; } });
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        var r = collect();
        if (!Object.keys(r.answers).length) { if (st) st.textContent = '한 문항 이상 답해 주세요.'; return; }
        if (r.missing && ask !== r.missing) { ask = r.missing; if (st) st.textContent = r.missing + '문항이 비었어요. 그대로 내도 돼요.'; if (sbtn) sbtn.textContent = '그대로 내기'; return; }
        ask = 0; if (sbtn) sbtn.textContent = sLabel;
        var btn = sbtn; if (btn) btn.disabled = true;
        ensureJoin().then(function () { return conn.add('survey', { answers: r.answers }); }).then(function (d) {
          store.set(sk, r.answers); if (st) st.textContent = queued(d) ? '연결되면 설문을 보내요. 이 화면을 닫지 말아 주세요.' : '제출했어요. 고칠 게 있으면 바꾼 뒤 다시 내 주세요.'; toast(queued(d) ? '연결되면 설문을 보내요.' : '제출했어요. 고마워요.');
        }, function (err) { if (err && err.message !== 'cancel') toast('제출하지 못했어요: ' + (err.message || '잠시 뒤 다시 해 주세요.')); }).then(function () { if (btn) btn.disabled = false; });
      });
    });

    var lastProg = {};
    live.progress = function (station, status) {
      if (!station || !me || feats.indexOf('progress') < 0) return;
      if (lastProg[station] === status) return; lastProg[station] = status;
      conn.add('progress', { station: station, status: status }).catch(function () { });
    };

    // 상태 → '지금' 줄: 열린 투표 > 공지 > 새 자료 > 강사가 보는 실습·쪽, 오른쪽에 타이머. 할 일 하나만 버튼으로
    var nowEl = $('[data-now]'), timerIv, nowKey = '', nowOpen = false;
    // 끝난 타이머: '끝났어요'를 잠깐(OVER_MS) 보인 뒤 띠에서 내림(강사가 [멈춤]을 잊어도 빨간 숫자가 연수 내내 남지 않게).
    // 발표 화면은 0:00과 '시간이 다 됐어요'를 그대로 둠
    var OVER_MS = 90000;
    function nowMs() { return conn.now ? conn.now() : Date.now(); }
    function runningTimer() {
      var on = function (t) { return t && t.running && t.endsAt && t.endsAt - nowMs() > -OVER_MS; };
      if (on(state.timer)) return state.timer;
      return X.timers(state).filter(on)[0] || null;
    }
    // 연수 중에 강사가 더한 자료: 처음 연 뒤 새로 생긴 것만 '지금' 줄에 몇 분 동안 한 번(맨 아래 자료실에 조용히 붙기만 하지 않게)
    var matSeen = null, matNew = null, matT = 0, MAT_MS = 180000;
    function freshMat() { return matNew && Date.now() < matNew.until ? matNew : null; }
    function drawNow() {
      if (!nowEl) return;
      // 끝난 연수: 남은 공지·타이머·투표 대신 맨 위 '종료' 줄만(initPhase)
      if (root.getAttribute('data-phase') === 'after') { clearInterval(timerIv); if (!nowEl.hidden) { nowEl.hidden = true; fitScrollPad(); } return; }
      var main = '', sub = '', where = '', cta = null, sts = DATA.stations || [];
      var p = openPoll(), fm = freshMat();
      var si = state.step ? sts.map(function (x) { return x.id; }).indexOf(state.step) : -1;
      if (si >= 0 && stApi) {
        where = (si + 1) + '번 실습 · ' + sts[si].name;
        if (stApi.current() !== state.step) cta = { label: (si + 1) + '번 실습 열기', href: '#st-' + state.step };
      } else if (state.slide > 0 && deckApi && deckApi.has(state.slide)) {
        where = '교재 ' + state.slide + '쪽';
        cta = { label: state.slide + '쪽 보기', href: '#deck-p' + state.slide };
      }
      if (p) {
        // 답한 뒤에는 기다리는 동안 할 일이 없다는 것을 띠에서도(결과는 강사가 공개하면 [결과 보기])
        var mine = store.get('ans:' + p.id, null), shown = X.revealed(state, p.id);
        main = '투표: ' + p.question;
        sub = mine === null ? where : [shown ? '' + HOST_GA + ' 결과를 공개했어요' : '응답했어요 · 결과는 ' + HOST_GA + ' 공개하면 보여요', where].filter(Boolean).join(' · ');
        // 투표 칸을 이미 보고 있으면 그리 가는 단추는 빼고(같은 것 두 번) 실습·쪽 단추만
        var pollCta = !pollVis && (mine === null ? '투표하기' : shown ? '결과 보기' : '');
        if (pollCta) cta = { label: pollCta, href: '#' + pollSecId(), poll: true };
      } else if (fm) {
        main = '새 자료: ' + fm.title; sub = where;
        cta = { label: '자료 열기', href: fm.url, ext: true };
      } else main = where;
      var notice = state.notice && state.notice.text;
      if (notice) { sub = main; main = notice; }
      var t = runningTimer();
      nowEl.classList.toggle('has-notice', !!notice);
      if (notice && state.notice.level) nowEl.setAttribute('data-level', state.notice.level); else nowEl.removeAttribute('data-level');
      var key = main + '|' + sub, mb = $('[data-now-main]', nowEl);
      if (key !== nowKey) { nowKey = key; mb.textContent = main; $('[data-now-sub]', nowEl).textContent = sub; nowOpen = false; }
      var a = $('[data-now-cta]', nowEl);
      a.hidden = !cta;
      if (cta) {
        a.textContent = cta.label; a.setAttribute('href', cta.href); a._poll = !!cta.poll;
        if (cta.ext) { a.target = '_blank'; a.rel = 'noopener noreferrer'; } else { a.removeAttribute('target'); a.removeAttribute('rel'); }
      }
      var tm = $('[data-timer]', nowEl); clearInterval(timerIv);
      tm.hidden = !t;
      if (t) {
        var tick = function () {
          var ms = t.endsAt - nowMs(), left = Math.ceil(ms / 1000);
          if (ms <= -OVER_MS) { clearInterval(timerIv); drawNow(); return; }
          tm.classList.toggle('is-over', left <= 0);
          tm.textContent = (t.label ? t.label + ' ' : '') + (left <= 0 ? '끝났어요' : Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0'));
          tm.setAttribute('aria-label', (t.label || '타이머') + (left <= 0 ? ' 시간이 다 됐어요' : ' 남은 시간'));
        };
        tick(); timerIv = setInterval(tick, 1000);
      }
      var was = nowEl.hidden; nowEl.hidden = !main && !t;
      fitNowMore();
      if (was !== nowEl.hidden) fitScrollPad();
    }
    // 긴 공지: 휴대폰에서 두 줄을 넘으면 [더 보기]로 펼침(공지의 뒷부분 — 장소·시각 — 이 잘리지 않게)
    var nowMore = nowEl && $('[data-now-more]', nowEl);
    function fitNowMore() {
      if (!nowMore) return;
      nowEl.classList.toggle('is-open', nowOpen);
      var mb = $('[data-now-main]', nowEl), cut = !nowOpen && !nowEl.hidden && mb.scrollHeight > mb.clientHeight + 2;
      nowMore.hidden = !(cut || nowOpen);
      nowMore.setAttribute('aria-expanded', String(nowOpen)); nowMore.textContent = nowOpen ? '접기' : '더 보기';
    }
    if (nowMore) {
      nowMore.addEventListener('click', function () { nowOpen = !nowOpen; fitNowMore(); fitScrollPad(); });
      window.addEventListener('resize', function () { if (!nowEl.hidden) fitNowMore(); });
    }
    if (nowEl) {
      $('[data-now-cta]', nowEl).addEventListener('click', function (e) {
        if (!this._poll) { if (this.target === '_blank') { matNew = null; setTimeout(drawNow, 0); } return; }
        if (!pollBox || !pollSecId()) return;
        e.preventDefault(); goTo(pollSecId());
        setTimeout(function () { var f = pollBox.querySelector('[data-poll-live] input, [data-poll-live] button'); if (f) f.focus({ preventScroll: true }); }, RM ? 0 : 400);
      });
      window.addEventListener('hashchange', function () { setTimeout(drawNow, 0); });
    }
    function applyState(s) {
      state = s || {};
      if (state.follow) {
        if (state.step && stApi) stApi.go(state.step);
        if (state.slide && deckApi && deckApi.follow()) deckApi.go(state.slide);
      }
      checkSignalReset(); drawPoll(); drawMats(); drawNow(); drawLocks();
    }
    // 강사가 질문·보드를 잠그면 쓰는 칸을 막고 까닭을 보임(서버도 같은 규칙으로 거절)
    function drawLocks() {
      [[qaBox, 'qa', '[data-qa-form]', '지금은 질문을 받지 않아요. ' + HOST_GA + ' 다시 열면 보낼 수 있어요.'], [bBox, 'board', '[data-board-write]', '지금은 보드에 글을 받지 않아요. ' + HOST_GA + ' 다시 열면 올릴 수 있어요.']].forEach(function (x) {
        if (!x[0]) return;
        var on = X.locked(state, x[1]), f = $(x[2], x[0]), note = $('[data-lock-note]', x[0]);
        if (on && !note && f) { note = el('p', 'lp-note', x[3]); note.setAttribute('data-lock-note', ''); note.setAttribute('role', 'status'); f.parentNode.insertBefore(note, f); }
        if (note) note.hidden = !on;
        if (f) $$('textarea,input,button,select', f.tagName === 'FORM' ? f : f.parentNode).forEach(function (n) { if (f.tagName === 'FORM' || n === f) n.disabled = on; });
      });
    }
    // 강사가 연수 중에 덧붙인 자료 링크 → 자료실 아래에 보임. 자료실이 없으면 마무리 앞에 만듦. 새로 생긴 것은 '지금' 줄에도 몇 분
    function drawMats() {
      var list = X.materials(state), box = $('[data-live-materials]');
      var keyOf = function (m) { return m.url + '\\u0001' + m.title; };
      if (!matSeen) { matSeen = {}; list.forEach(function (m) { matSeen[keyOf(m)] = 1; }); }
      else list.forEach(function (m) {
        if (matSeen[keyOf(m)]) return; matSeen[keyOf(m)] = 1;
        matNew = { title: m.title, url: m.url, until: Date.now() + MAT_MS };
        clearTimeout(matT); matT = setTimeout(drawNow, MAT_MS + 50);
      });
      if (matNew && !list.some(function (m) { return m.url === matNew.url; })) matNew = null; // 강사가 지운 자료
      if (!box) {
        if (!list.length) return;
        box = el('ul', 'lp-materials lp-materials-live'); box.setAttribute('data-live-materials', ''); box.setAttribute('aria-label', '' + HOST_GA + ' 추가한 자료');
        var sec = $('.lp-sec-materials .lp-wrap');
        if (sec) sec.appendChild(box);
        else {
          var s = el('section', 'lp-sec lp-sec-materials'); s.id = 'live-materials'; s.setAttribute('data-layout', 'files'); s.setAttribute('data-frame', 'plain');
          var w = el('div', 'lp-wrap'), h = el('header', 'lp-head'); h.appendChild(el('h2', 'lp-h2', (DATA.words && DATA.words.materials) || '연수 자료')); w.appendChild(h); w.appendChild(box); s.appendChild(w);
          var before = $('.lp-sec-closing'), main = $('[data-lp-extra]') || $('main');
          if (before && before.parentNode) before.parentNode.insertBefore(s, before); else if (main) main.appendChild(s); else return;
        }
      }
      box.textContent = '';
      list.forEach(function (m) {
        var li = el('li'); li.appendChild(el('span', 'lp-file-kind', '링크'));
        var d = el('div'); d.appendChild(el('h3', '', m.title)); d.appendChild(el('small', '', m.url.replace(/^https:\\/\\/(www\\.)?/, '').split(/[/?#]/)[0])); li.appendChild(d);
        var a = el('a', 'lp-btn lp-btn-ghost lp-btn-sm', '열기'); a.href = m.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; li.appendChild(a);
        box.appendChild(li);
      });
      box.hidden = !list.length;
      $$('[data-lpk-mats-empty]').forEach(function (n) { n.hidden = !!list.length; });
    }
    function floatReaction(emoji) {
      var host = $('[data-reactions]'); if (!host || RM) return;
      // 이모지 값(프로토콜)을 도크의 선 아이콘으로 바꿔 보여 줌. 모르는 값이면 글자 그대로
      var src = null; $$('[data-react]').forEach(function (b) { if (!src && b.getAttribute('data-react') === emoji) src = b.querySelector('svg'); });
      var s = el('span', '', src ? '' : emoji); if (src) s.appendChild(src.cloneNode(true));
      s.style.left = Math.round(Math.random() * 30) + 'px'; s.style.setProperty('--dx', (Math.random() * 40 - 20) + 'px');
      host.appendChild(s); setTimeout(function () { s.remove(); }, 2700);
    }
    // 강사가 [데이터 모두 지우기]: 열린 화면의 목록과 이 기기에 남은 이 연수의 참여 기록(응답·좋아요·출석·설문·신호)을 비움.
    // 서버의 참가자 명단도 지워졌으니 이 기기의 참여 정보도 비워, 다음에 참여할 때 별명(입실이면 이름·소속)을 새로 받음
    function onReset() {
      [qs, posts, answers, quick, voted, lastProg].forEach(function (b) { for (var k in b) delete b[k]; });
      store.keys().filter(function (k) { return /^(ans|like|att|survey):|^(voted|signal)$/.test(k); }).forEach(store.del);
      me = null; store.del('me'); if (conn.leave) conn.leave();
      mySignal = null; paintSignal();
      paintAttend();
      $$('[data-survey]').forEach(function (f) { f.reset(); var st = $('[data-sv-state]', f); if (st) st.textContent = ''; });
      drawQA(); drawBoard(); applyState({}); // 서버의 진행 상태(공지·투표)도 함께 지워짐
    }
    function onEvent(ev) {
      if (!ev) return;
      if (ev.type === 'reset') return onReset();
      if (ev.type === 'state') return applyState(ev.doc || ev.state);
      if (ev.type === 'reaction') return floatReaction((ev.doc && ev.doc.emoji) || ev.emoji);
      var d = ev.doc; if (!d || !d.id) return;
      var bag = { questions: qs, posts: posts, answers: answers, polls: quick }[ev.col]; if (!bag) return;
      if (ev.type === 'remove') delete bag[d.id]; else bag[d.id] = Object.assign(bag[d.id] || {}, d);
      if (ev.col === 'questions') drawQA(); else if (ev.col === 'posts') drawBoard(); else { drawPoll(); if (ev.col === 'polls') drawNow(); }
    }
    drawQA = keepFocus(drawQA, function () { return qaBox && $('[data-qa-list]', qaBox); });
    drawBoard = keepFocus(drawBoard, function () { return bBox && $('[data-board-list]', bBox); }, function () { return bBox && $('[data-board-write]', bBox); });
    drawPoll = keepFocus(drawPoll, function () { return pollBox && $('[data-poll-live]', pollBox); });
    function loadAll() {
      var jobs = [];
      if (qaBox) jobs.push(conn.list('questions', {}).then(function (a) { (a || []).forEach(function (d) { qs[d.id] = d; }); qaNews.prime(Object.keys(qs).map(function (k) { return qs[k]; })); drawQA(); }));
      if (bBox) jobs.push(conn.list('posts', {}).then(function (a) { (a || []).forEach(function (d) { posts[d.id] = d; }); boardNews.prime(Object.keys(posts).map(function (k) { return posts[k]; })); drawBoard(); }));
      // 투표 칸이 없어도 읽음: 강사가 즉석 투표를 띄우면 바로 보여야 함
      jobs.push(conn.list('polls', {}).then(function (a) { (a || []).forEach(function (d) { quick[d.id] = d; }); }));
      jobs.push(conn.list('answers', {}).then(function (a) { (a || []).forEach(function (d) { answers[d.id] = d; }); }));
      jobs.push(conn.getState().then(applyState));
      return Promise.all(jobs.map(function (j) { return j.catch(function () { }); }));
    }
    conn.connect().then(function (r) {
      live.ready = true; setStatus(r && r.mode === 'polling' ? 'polling' : r && r.mode === 'local' ? 'local' : 'live');
      conn.subscribe(onEvent);
      if (conn.on) conn.on('status', function (s) { setStatus(s); });
      loadAll();
      if (stApi && me) live.progress(stApi.current(), stApi.done().indexOf(stApi.current()) >= 0 ? 'done' : 'doing');
    }, function () {
      setStatus('offline');
      // 서버가 되살아나면 core가 차츰 길게 다시 이어 봄: 이어지면 한 줄을 거두고 참여 칸을 채움
      if (conn.on) conn.on('status', function (s) {
        setStatus(s);
        if ((s === 'live' || s === 'polling') && !live.ready) { live.ready = true; conn.subscribe(onEvent); loadAll(); }
      });
    });
  }

  /* ── 내 달력에 넣기: 빌드 때 사이트 주소를 몰랐으면(설계도에 siteUrl 없음) 내려받을 때 지금 주소를 넣음 ──
     연수 날 달력 알림에서 바로 사이트로. 암호 보호 사이트의 #k=(암호)는 넣지 않음. 앱 안 브라우저는 파일 그대로(내려받기를 막으므로) */
  function initCal() {
    var a = $('a[href$="event.ics"]'); if (!a || DATA.siteUrl || IN_APP || !window.fetch || !window.Blob) return;
    a.addEventListener('click', function (e) {
      var u = siteUrl().split('#')[0]; if (!/^https?:\\/\\//.test(u)) return;
      e.preventDefault();
      fetch(a.getAttribute('href'), { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('ics'); return r.text(); }).then(function (t) {
        var line = 'URL:' + u, parts = [line.slice(0, 75)]; for (var i = 75; i < line.length; i += 74) parts.push(' ' + line.slice(i, i + 74)); // 75바이트 접기(주소는 ASCII)
        if (!/\\r\\nURL:/.test(t)) t = t.replace(/\\r\\nBEGIN:VALARM/g, '\\r\\n' + parts.join('\\r\\n') + '\\r\\nBEGIN:VALARM'); // 여러 날 연수면 날마다
        var url = URL.createObjectURL(new Blob([t], { type: 'text/calendar;charset=utf-8' }));
        var x = el('a'); x.href = url; x.download = 'event.ics'; doc.body.appendChild(x); x.click(); x.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
      }).catch(function () { location.href = a.href; });
    });
  }

  /* ── 인쇄용 QR 안내문 ─────────────────── */
  function initPoster() {
    var pb = $('[data-print]'); if (pb) pb.addEventListener('click', function () { window.print(); });
    // 자리 카드 8장(잘라 쓰기): 고를 때만 인쇄·미리보기에 나옴
    var cc = $('input[data-part-print="cards"]');
    if (cc) {
      cc.checked = store.get('cards-print', false) === true;
      var upc = function () { doc.body.classList.toggle('lp-cards-off', !cc.checked); };
      upc(); cc.addEventListener('change', function () { store.set('cards-print', cc.checked); upc(); });
    }
  }

  function start() {
    // 페이지 안에서만 쓰는 양식은 제출해도 페이지를 다시 불러오지 않게
    doc.addEventListener('submit', function (e) { var f = e.target; if (f && f.matches && f.matches('[data-survey],[data-reflect]')) e.preventDefault(); }, true);
    $$('[data-survey]').forEach(function (f) { if (!DATA.live) f.addEventListener('submit', function () { toast('실시간 연결이 꺼져 있어 설문을 모을 수 없어요.'); }); });
    drawQRs(); initChrome(); initCal(); initScrollShow(); initPhase(); initPrompts(); initSchedule(); initSessions(); initBody(); initReadiness(); initDeck(); initStations(); initQuiz(); initNotebook(); initPoster(); initLive();
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else start();
})();
`,d=`/*! lecpage live core — window.LecLive (classic script, no modules, works from file://)
 * Contract: docs/architecture.md §5. Providers register with LecLive.register(name, factory).
 *   var live = LecLive.create(config);  // config = blueprint.live (+ adminKey)
 *   live.connect().then(function (info) { ... });
 *   live.onChange('questions', function (docs) { render(docs); });   // render with textContent only
 * The client wraps an adapter with: retries, status events, identity persistence, offline write queue,
 * dedupe, an in-memory store per collection (merge by id, \`since\` cursors), text limits and profanity masking.
 */
(function (root) {
  'use strict';
  if (root.LecLive && root.LecLive.__core) return;

  var VERSION = '1.0.0';
  var COLS = ['participants', 'attendance', 'progress', 'help', 'questions', 'posts', 'polls', 'answers', 'survey', 'chat'];
  // 연수 코드만 알면 읽는 것(남의 투표 응답은 강사가 결과를 공개한 뒤에만 값이 옴) / 강사만 읽고 참가자는 자기 것만 읽는 것
  var PUBLIC_COLS = ['questions', 'posts', 'polls', 'answers', 'chat'];
  var PRIVATE_COLS = ['participants', 'attendance', 'survey', 'help', 'progress'];
  var LIMITS = {
    nickname: 20, name: 40, school: 60, question: 500, post: 1000, chat: 300, help: 300, seat: 20, id: 64, kind: 32,
    pollQuestion: 200, option: 100, answer: 200, notice: 300, timerLabel: 40, fileName: 120, files: 5, license: 40,
    assignee: 20, uploadMb: 20, options: 20, answerItems: 5,
  };
  // col → field → [limit, multiline, mask]
  var FIELDS = {
    participants: { nickname: [LIMITS.nickname, 0, 1], name: [LIMITS.name, 0, 0], school: [LIMITS.school, 0, 0] },
    questions: { text: [LIMITS.question, 1, 1] },
    posts: { text: [LIMITS.post, 1, 1], kind: [LIMITS.kind, 0, 0], license: [LIMITS.license, 0, 0] },
    chat: { text: [LIMITS.chat, 1, 1] },
    help: { message: [LIMITS.help, 1, 1], seat: [LIMITS.seat, 0, 0], station: [LIMITS.id, 0, 0], assignee: [LIMITS.assignee, 0, 1] },
    polls: { question: [LIMITS.pollQuestion, 0, 0] },
    answers: { value: [LIMITS.answer, 0, 1], poll: [LIMITS.id, 0, 0] },
    progress: { station: [LIMITS.id, 0, 0] },
  };
  // 한 기기에서 보내는 빠르기: [창 안 최대 개수, 창(ms), 다음 것까지 최소 간격(ms)]. 서버 한도(protocol.js RATE)보다 조금 낮게
  var CLIENT_RATE = { questions: [6, 60e3, 3000], posts: [10, 60e3, 2500], help: [4, 60e3, 5000], chat: [20, 60e3, 800], answers: [40, 60e3, 300] };
  var UPLOAD_TYPES = { 'image/png': 1, 'image/jpeg': 1, 'image/gif': 1, 'image/webp': 1, 'application/pdf': 1, 'audio/mpeg': 1, 'video/mp4': 1 };
  var EMOJIS = ['👍', '❤️', '👏', '🎉', '😂', '😮', '🤔', '🙏', '🔥', '💯', '🙌', '😢', '✅', '❓', '💡'];

  // ---------------------------------------------------------------- storage (never throws)
  function store(kind) {
    var s = null;
    try { s = kind === 'session' ? root.sessionStorage : root.localStorage; if (s) { s.setItem('__lec', '1'); s.removeItem('__lec'); } } catch (e) { s = null; }
    var mem = {};
    return {
      get: function (k) { try { if (s) { var v = s.getItem(k); return v == null ? null : JSON.parse(v); } } catch (e) { /* ignore */ } return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
      set: function (k, v) { mem[k] = v; try { if (s) s.setItem(k, JSON.stringify(v)); } catch (e) { /* quota or blocked */ } },
      del: function (k) { delete mem[k]; try { if (s) s.removeItem(k); } catch (e) { /* ignore */ } },
      keys: function (prefix) { var out = []; try { if (s) for (var i = 0; i < s.length; i++) { var k = s.key(i); if (k && k.indexOf(prefix) === 0) out.push(k); } } catch (e) { /* ignore */ } if (!s) for (var m in mem) if (m.indexOf(prefix) === 0) out.push(m); return out; },
      persistent: !!s,
    };
  }
  var local = store('local');
  var session = store('session');

  // ---------------------------------------------------------------- small utils
  function uid(n) {
    n = n || 16; var a = new Uint8Array(n); var c = root.crypto || root.msCrypto;
    if (c && c.getRandomValues) c.getRandomValues(a); else for (var i = 0; i < n; i++) a[i] = Math.floor(Math.random() * 256);
    var s = ''; for (var j = 0; j < a.length; j++) s += ('0' + a[j].toString(16)).slice(-2);
    return s.slice(0, n);
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function jitter(ms, f) { f = f == null ? 0.3 : f; return Math.round(ms * (1 - f + Math.random() * 2 * f)); }
  function backoff(attempt, base, max) { return jitter(Math.min(max || 30000, (base || 1000) * Math.pow(2, attempt))); }
  function assign(t) { for (var i = 1; i < arguments.length; i++) { var s = arguments[i]; if (s) for (var k in s) if (Object.prototype.hasOwnProperty.call(s, k)) t[k] = s[k]; } return t; }
  function clone(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }
  function same(a, b) { try { return JSON.stringify(a) === JSON.stringify(b); } catch (e) { return false; } }
  function cps(s) { return Array.from ? Array.from(s) : s.split(''); }
  function hashStr(s) { var h = 5381; s = String(s || ''); for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
  function normCode(c) { return String(c || '').trim().toUpperCase(); }
  function isHidden() { try { return root.document && root.document.visibilityState === 'hidden'; } catch (e) { return false; } }
  /** 간격 묻기의 다음 간격(밀리초). 모든 어댑터가 같이 씀(학교망에서 요청 수를 줄이는 규칙 한 곳):
   *  오류면 두 배씩(1분까지) · 화면이 숨겨졌으면 1분(강사 화면은 30초, 다시 보이면 어댑터가 바로 물음)
   *  · 바뀐 것 없는 묻기가 이어지면 1.5배·2배·3배로(20초까지, 서버 권고가 더 길면 그만큼) · 서버 권고(hint)는 아래 한도 */
  function pollDelay(base, o) {
    o = o || {};
    var b = Math.max(base || 5000, o.hint || 0);
    if (o.err) return Math.min(60000, b * Math.pow(2, o.err));
    if (isHidden()) return Math.max(o.admin ? 30000 : 60000, b);
    var e = o.empty || 0;
    if (e > 6) b = Math.min(Math.max(20000, o.hint || 0), b * (e > 24 ? 3 : e > 12 ? 2 : 1.5));
    return Math.round(b);
  }

  /** Emitter with error isolation. */
  function Emitter() { this._l = {}; }
  Emitter.prototype.on = function (e, cb) { var l = this._l[e] || (this._l[e] = []); l.push(cb); var self = this; return function () { self.off(e, cb); }; };
  Emitter.prototype.off = function (e, cb) { var l = this._l[e]; if (!l) return; var i = l.indexOf(cb); if (i >= 0) l.splice(i, 1); };
  Emitter.prototype.emit = function (e) {
    var l = this._l[e]; if (!l || !l.length) return;
    var args = Array.prototype.slice.call(arguments, 1);
    l.slice().forEach(function (cb) { try { cb.apply(null, args); } catch (err) { if (root.console) console.error('[LecLive]', err); } });
  };

  /** Error type thrown by adapters and the client. */
  function LiveError(code, message, opts) {
    var e = new Error(message || code);
    e.name = 'LiveError'; e.code = code || 'error';
    opts = opts || {};
    e.status = opts.status || 0;
    e.retryable = opts.retryable != null ? !!opts.retryable : (!e.status || e.status >= 500 || e.status === 429 || e.status === 408);
    if (opts.retryAfter) e.retryAfter = opts.retryAfter;
    if (opts.detail) e.detail = opts.detail;
    return e;
  }

  // ---------------------------------------------------------------- sha256 (Web Crypto if possible, small JS fallback for file://)
  function utf8(s) { if (root.TextEncoder) return new TextEncoder().encode(s); var b = unescape(encodeURIComponent(s)); var a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
  function hex(buf) { var a = new Uint8Array(buf); var s = ''; for (var i = 0; i < a.length; i++) s += ('0' + a[i].toString(16)).slice(-2); return s; }
  var K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  function sha256js(bytes) {
    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var l = bytes.length; var n = ((l + 9 + 63) >> 6) << 6; var m = new Uint8Array(n); m.set(bytes); m[l] = 0x80;
    var bits = l * 8; m[n - 4] = (bits >>> 24) & 255; m[n - 3] = (bits >>> 16) & 255; m[n - 2] = (bits >>> 8) & 255; m[n - 1] = bits & 255;
    m[n - 5] = Math.floor(bits / 4294967296) & 255;
    var w = new Array(64);
    for (var o = 0; o < n; o += 64) {
      for (var i = 0; i < 16; i++) w[i] = (m[o + i * 4] << 24) | (m[o + i * 4 + 1] << 16) | (m[o + i * 4 + 2] << 8) | m[o + i * 4 + 3];
      for (i = 16; i < 64; i++) {
        var x = w[i - 15], y = w[i - 2];
        var s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
        var s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (i = 0; i < 64; i++) {
        var S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        var t1 = (h + S1 + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
        var S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        var t2 = (S0 + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    var out = ''; for (i = 0; i < 8; i++) out += ('0000000' + (H[i] >>> 0).toString(16)).slice(-8);
    return out;
  }
  function sha256(text) {
    var bytes = utf8(String(text));
    var c = root.crypto;
    if (c && c.subtle && root.isSecureContext !== false) {
      return c.subtle.digest('SHA-256', bytes).then(hex, function () { return sha256js(bytes); });
    }
    return Promise.resolve(sha256js(bytes));
  }

  // ---------------------------------------------------------------- script loader (never rejects: resolves false)
  // loadScript(url, timeoutMs, { integrity: 'sha384-…' }) — a remote (http/https) script without an SRI hash is refused.
  var loading = {};
  function loadScript(url, timeoutMs, opts) {
    var integrity = opts && typeof opts.integrity === 'string' ? opts.integrity : '';
    if (/^(https?:)?\\/\\//i.test(String(url)) && !/^sha(256|384|512)-[A-Za-z0-9+/=]{40,}$/.test(integrity)) return Promise.resolve(false);
    if (loading[url]) return loading[url];
    loading[url] = new Promise(function (resolve) {
      if (!root.document) return resolve(false);
      var s = root.document.createElement('script');
      var done = false;
      var t = setTimeout(function () { finish(false); }, timeoutMs || 12000);
      function finish(ok) { if (done) return; done = true; clearTimeout(t); if (!ok) delete loading[url]; resolve(ok); }
      if (integrity) s.integrity = integrity;
      s.src = url; s.async = true; s.crossOrigin = 'anonymous';
      s.onload = function () { finish(true); };
      s.onerror = function () { finish(false); };
      (root.document.head || root.document.documentElement).appendChild(s);
    });
    return loading[url];
  }

  // ---------------------------------------------------------------- text cleanup & profanity masking
  // 글자로 보이지 않는 문자: 제어 문자, 폭 없는 공백, 방향 바꿈(가짜 글 순서), 한글 채움 문자(빈 별명), 태그 문자.
  // 줄바꿈·탭·ZWJ(이모지 잇기)·이모지 모양 선택자(FE0F)는 남김. 결합 부호는 한 글자에 둘까지(위아래로 쌓아 화면을 덮는 글 막기)
  var CTRL = /[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F-\\u009F\\u00AD\\u034F\\u061C\\u115F\\u1160\\u17B4\\u17B5\\u180B-\\u180F\\u200B\\u200C\\u200E\\u200F\\u202A-\\u202E\\u2060-\\u2064\\u2066-\\u206F\\u2800\\u3164\\uFE00-\\uFE0E\\uFEFF\\uFFA0\\uFFF9-\\uFFFB]|\\uDB40[\\uDC00-\\uDDEF]/g;
  var COMB = /([\\u0300-\\u036F\\u0483-\\u0489\\u1AB0-\\u1AFF\\u1DC0-\\u1DFF\\u20D0-\\u20FF\\uFE20-\\uFE2F]{2})[\\u0300-\\u036F\\u0483-\\u0489\\u1AB0-\\u1AFF\\u1DC0-\\u1DFF\\u20D0-\\u20FF\\uFE20-\\uFE2F]+/g;
  function cleanText(v, max, multiline) {
    if (v == null) return '';
    var s = String(v).replace(/\\r\\n?/g, '\\n');
    if (s.normalize) s = s.normalize('NFC');
    s = s.replace(CTRL, '').replace(COMB, '$1');
    if (!multiline) s = s.replace(/\\s+/g, ' ');
    else s = s.replace(/[^\\S\\n]+\\n/g, '\\n').replace(/\\n{4,}/g, '\\n\\n\\n');
    s = s.trim();
    var c = cps(s);
    if (max && c.length > max) s = c.slice(0, max).join('').trim();
    return s;
  }
  // 글 속 주소(링크처럼 보이는 것). 발표 화면은 가려서 보여 줌: 참가자가 올린 주소가 프로젝터에서 '공식 안내'처럼 보이지 않게
  var LINKISH = /(?:\\b(?:https?|ftp):\\/\\/|\\bwww\\.)[^\\s<>"']+|\\b[a-z0-9][a-z0-9-]{0,62}(?:\\.[a-z0-9-]{1,63}){0,4}\\.(?:com|net|org|kr|io|ly|gl|gd|me|co|app|dev|xyz|site|link|info|biz|to|be|cc|tk|top|shop|club|online|live|page|ai)\\b(?:\\/[^\\s<>"']*)?/gi;
  function hasLink(s) { var r = new RegExp(LINKISH.source, 'i').test(String(s || '')); return r; }
  function linkless(s, label) { return String(s || '').replace(LINKISH, label || '(링크)'); }
  var DEFAULT_WORDS = [
    '씨발', '씨바', '씨빨', '씨팔', '시발', '시바', '시팔', 'ㅅㅂ', 'ㅆㅂ', 'ㅆㅃ', 'ㅄ', '병신', '븅신', '빙신', 'ㅂㅅ', '개새끼', '개새기', '개색기', '개색끼', '개쉐이',
    '좆', '좇같', '존나', 'ㅈㄴ', '지랄', 'ㅈㄹ', '미친놈', '미친년', '미친새끼', '닥쳐', '꺼져', '썅', '엿먹어', '느금마', '니애미', '니애비', '애미뒤', '염병', '찐따',
    'fuck', 'fucking', 'fucker', 'motherfucker', 'shit', 'bullshit', 'bitch', 'asshole', 'bastard', 'cunt', 'dickhead', 'retard', 'slut', 'whore', 'nigger', 'faggot',
  ];
  var DEFAULT_ALLOW = ['시발점', '시발역', '시발택시', '시바견', '시바이누', '시바 견'];
  function escRe(s) { return s.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&'); }
  function makeMasker(cfg) {
    if (cfg === false) return function (s) { return s; };
    cfg = cfg && typeof cfg === 'object' ? cfg : {};
    var words = (cfg.words || DEFAULT_WORDS).concat(cfg.extra || []).filter(Boolean);
    var allow = (cfg.allow || DEFAULT_ALLOW).filter(Boolean);
    if (!words.length) return function (s) { return s; };
    var sep = '[\\\\s._\\\\-*~!^0-9]{0,2}';
    var parts = words.map(function (w) {
      var ascii = /^[a-z]+$/i.test(w);
      if (ascii) return '\\\\b' + escRe(w) + '\\\\w*';
      return cps(w).map(escRe).join(sep);
    });
    parts.sort(function (a, b) { return b.length - a.length; });
    var re = new RegExp('(' + parts.join('|') + ')', 'gi');
    var allowRe = allow.length ? new RegExp(allow.map(escRe).join('|'), 'g') : null;
    return function (s) {
      if (!s || typeof s !== 'string') return s;
      var saved = [];
      var t = allowRe ? s.replace(allowRe, function (m) { saved.push(m); return '\\u0001' + (saved.length - 1) + '\\u0002'; }) : s;
      t = t.replace(re, function (m) { return cps(m).map(function (ch) { return /\\s/.test(ch) ? ch : '*'; }).join(''); });
      if (saved.length) t = t.replace(/\\u0001(\\d+)\\u0002/g, function (_, i) { return saved[+i]; });
      return t;
    };
  }

  // ---------------------------------------------------------------- CSV & export tables (same layout as the servers)
  // 수식 주입 막기: 엑셀·구글 시트·리브레오피스가 수식으로 읽는 첫 글자(앞 빈칸·전각 기호 포함)면 앞에 ' 를 붙임
  var FORMULA = /^[\\s\\u00A0\\u3000]*[=+\\-@\\uFF1D\\uFF0B\\uFF0D\\uFF20]|^[\\t\\r\\n]/;
  function csvCell(v) {
    if (v == null) return '';
    var s = Array.isArray(v) ? v.join(' / ') : typeof v === 'object' ? JSON.stringify(v) : String(v);
    if (FORMULA.test(s)) s = "'" + s;
    if (/[",\\n\\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  /** 받은 CSV를 칸마다 다시 읽어 수식 막기를 한 번 더 씌움(예전 서버가 만든 파일도 안전하게 내려받게). 첫 줄(머리글)은 그대로 */
  function csvGuard(text) {
    var src = String(text || '').replace(/^\\uFEFF/, ''), rows = [], row = [], cell = '', q = false, i = 0, quoted = false;
    for (; i < src.length; i++) {
      var ch = src.charAt(i);
      if (q) { if (ch === '"') { if (src.charAt(i + 1) === '"') { cell += '"'; i++; } else q = false; } else cell += ch; continue; }
      if (ch === '"' && cell === '') { q = true; quoted = true; }
      else if (ch === ',') { row.push(cell); cell = ''; quoted = false; }
      else if (ch === '\\n' || ch === '\\r') { if (ch === '\\r' && src.charAt(i + 1) === '\\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; quoted = false; }
      else cell += ch;
    }
    if (cell !== '' || quoted || row.length) { row.push(cell); rows.push(row); }
    return '\\uFEFF' + rows.map(function (r, n) {
      // 이미 ' 가 붙은 칸은 첫 글자가 ' 라 그대로(두 번 붙지 않음)
      return r.map(function (c) { return n ? csvCell(c) : /[",\\n\\r]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(',');
    }).join('\\r\\n') + '\\r\\n';
  }
  function toCsv(columns, rows) {
    return '\uFEFF' + [columns].concat(rows).map(function (r) { return r.map(csvCell).join(','); }).join('\\r\\n') + '\\r\\n';
  }
  function fmtTime(ms, tz) {
    if (!ms) return '';
    try {
      return new Intl.DateTimeFormat('sv-SE', { timeZone: tz || 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date(ms));
    } catch (e) { return new Date(ms).toISOString(); }
  }
  var STATUS_KO = { doing: '하는 중', done: '완료', stuck: '도움 요청', open: '대기', claimed: '가는 중', answered: '답변함', hidden: '숨김' };
  function uniq(a) { var s = {}; var o = []; a.forEach(function (x) { if (!s[x]) { s[x] = 1; o.push(x); } }); return o; }
  function exportTable(kind, data, tz, opts) {
    var t = function (ms) { return fmtTime(ms, tz); };
    if (kind === 'completion') return completionTable(data, opts, tz);
    var P = data.participants || []; var people = {}; P.forEach(function (p) { people[p.id] = p; });
    var nick = function (id) { return (people[id] || {}).nickname || ''; };
    switch (kind) {
      case 'participants': return { columns: ['별명', '이름', '소속', '참여 시각', '동의 시각'], rows: P.map(function (p) { return [p.nickname, p.name, p.school, t(p.createdAt), t(p.consentAt)]; }) };
      case 'attendance': {
        var m = {}; (data.attendance || []).forEach(function (a) { var r = m[a.by] || (m[a.by] = {}); var at = a.at || a.createdAt; r[a.kind] = !r[a.kind] ? at : a.kind === 'in' ? Math.min(r[a.kind], at) : Math.max(r[a.kind], at); if (a.byHost) r[a.kind + 'Host'] = true; });
        return { columns: ['별명', '이름', '소속', '입실', '퇴실', '동의 시각', '강사 입력'], rows: P.map(function (p) { var r = m[p.id] || {}; return [p.nickname, p.name, p.school, t(r['in']), t(r.out), t(p.consentAt), [p.manual && '명단', r.inHost && '입실', r.outHost && '퇴실'].filter(Boolean).join('·')]; }) };
      }
      case 'progress': {
        var pr = data.progress || []; var st = uniq(pr.map(function (x) { return x.station; })); var mm = {}; var order = [];
        pr.forEach(function (x) { if (!mm[x.by]) { mm[x.by] = {}; order.push(x.by); } mm[x.by][x.station] = x.status; });
        return { columns: ['별명', '이름'].concat(st, ['완료 수']), rows: order.map(function (by) { var r = mm[by]; return [nick(by), (people[by] || {}).name].concat(st.map(function (s) { return STATUS_KO[r[s]] || ''; }), [st.filter(function (s) { return r[s] === 'done'; }).length]); }) };
      }
      case 'questions': return { columns: ['작성 시각', '질문', '작성자', '공감', '상태', '고정'], rows: (data.questions || []).map(function (q) { return [t(q.createdAt), q.text, q.anonymous ? '익명' : q.nickname, q.votes, STATUS_KO[q.status] || q.status, q.pinned ? '예' : '']; }) };
      case 'survey': {
        var sv = data.survey || []; var keys = uniq([].concat.apply([], sv.map(function (s) { return Object.keys(s.answers || {}); })));
        return { columns: ['별명', '이름', '소속', '제출 시각'].concat(keys), rows: sv.map(function (s) { var p = people[s.by] || {}; return [p.nickname, p.name, p.school, t(s.updatedAt)].concat(keys.map(function (k) { return (s.answers || {})[k]; })); }) };
      }
      case 'posts': return { columns: ['작성 시각', '종류', '내용', '별명', '파일', '좋아요', '숨김'], rows: (data.posts || []).map(function (x) { return [t(x.createdAt), x.kind, x.text, x.nickname, (x.files || []).map(function (f) { return f.url; }), x.likes, x.hidden ? '예' : '']; }) };
      case 'help': return { columns: ['요청 시각', '별명', '활동', '자리', '내용', '상태', '담당'], rows: (data.help || []).map(function (x) { return [t(x.createdAt), x.nickname, x.station, x.seat, x.message, STATUS_KO[x.status] || x.status, x.assignee]; }) };
      case 'chat': return { columns: ['시각', '별명', '내용', '숨김'], rows: (data.chat || []).map(function (x) { return [t(x.createdAt), x.nickname, x.text, x.hidden ? '예' : '']; }) };
      case 'answers': return { columns: ['투표', '별명', '응답', '시각'], rows: (data.answers || []).map(function (x) { return [x.poll, nick(x.by), x.value, t(x.updatedAt)]; }) };
      default: throw LiveError('bad_kind', '내보낼 수 없는 종류예요: ' + kind, { status: 400 });
    }
  }

  // ---------------------------------------------------------------- completion (이수 확인) — same rule as protocol.js
  // opts: { date:'YYYY-MM-DD', start:'HH:MM', end:'HH:MM', rate: 0~100, survey: bool (site has survey questions), stations: n }
  function tzOffset(ms, tz) {
    try {
      var p = {}; new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
        .formatToParts(new Date(ms)).forEach(function (x) { p[x.type] = +x.value; });
      return Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
    } catch (e) { return 9 * 3600000; }
  }
  /** Wall-clock date + 'HH:MM' in a time zone → epoch ms (null when malformed). */
  function zonedMs(date, hm, tz) {
    var d = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(date || ''), h = /^(\\d{1,2}):(\\d{2})$/.exec(hm || '');
    if (!d || !h) return null;
    var guess = Date.UTC(+d[1], +d[2] - 1, +d[3], +h[1], +h[2]);
    var off = tzOffset(guess, tz || 'Asia/Seoul'), ms = guess - off, off2 = tzOffset(ms, tz || 'Asia/Seoul');
    return off2 === off ? ms : guess - off2;
  }
  function dayOf(ms, tz) { return fmtTime(ms, tz).slice(0, 10); }
  var COMPLETION_COLS = ['별명', '이름', '소속', '입실', '퇴실', '머문 시간(분)', '실습 완료(n/전체)', '설문 제출', '이수'];
  function completionTable(data, opts, tz) {
    opts = opts || {}; tz = tz || 'Asia/Seoul';
    var rate = typeof opts.rate === 'number' && opts.rate >= 0 && opts.rate <= 100 ? opts.rate : 90;
    var att = {}, done = {}, sv = {}, seen = {}, stations = [];
    // earliest check-in and latest check-out per participant
    (data.attendance || []).forEach(function (a) {
      var r = att[a.by] || (att[a.by] = {}); var at = a.at || a.createdAt;
      if (a.kind === 'in') r['in'] = r['in'] ? Math.min(r['in'], at) : at; else if (a.kind === 'out') r.out = r.out ? Math.max(r.out, at) : at;
    });
    (data.progress || []).forEach(function (x) { if (!seen[x.station]) { seen[x.station] = 1; stations.push(x.station); } if (x.status === 'done') (done[x.by] || (done[x.by] = {}))[x.station] = 1; });
    (data.survey || []).forEach(function (s) { if (s.by) sv[s.by] = 1; });
    var total = opts.stations > 0 ? Math.floor(opts.stations) : stations.length;
    // one row per person: the same name and school on two devices (or a re-join) is merged
    var groups = {}, order = [];
    (data.participants || []).slice().sort(function (a, b) { return (a.createdAt || 0) - (b.createdAt || 0); }).forEach(function (p) {
      var key = p.name ? 'n:' + p.name + '|' + (p.school || '') : 'id:' + p.id;
      var g = groups[key]; if (!g) { g = groups[key] = { nick: [], name: p.name, school: p.school, inAt: 0, outAt: 0, done: {}, survey: false }; order.push(g); }
      if (p.nickname && g.nick.indexOf(p.nickname) < 0) g.nick.push(p.nickname);
      var r = att[p.id] || {};
      if (r['in']) g.inAt = g.inAt ? Math.min(g.inAt, r['in']) : r['in'];
      if (r.out) g.outAt = Math.max(g.outAt, r.out);
      for (var st in (done[p.id] || {})) g.done[st] = 1;
      if (sv[p.id]) g.survey = true;
    });
    var rows = order.map(function (g) {
      var inAt = g.inAt || 0, outAt = g.outAt || 0;
      var day = opts.date || (inAt ? dayOf(inAt, tz) : '');
      var s0 = zonedMs(day, opts.start, tz), s1 = zonedMs(day, opts.end, tz);
      var sched = s0 != null && s1 != null && s1 > s0 ? s1 - s0 : 0;
      var mins = '';
      if (inAt && outAt && outAt >= inAt) mins = Math.max(0, Math.round((Math.min(outAt, sched ? s1 : outAt) - Math.max(inAt, sched ? s0 : inAt)) / 60000));
      var n = Object.keys(g.done).length;
      var verdict = '확인 필요';
      if (mins !== '' && sched) verdict = mins >= Math.ceil(sched / 60000 * rate / 100) && (!opts.survey || g.survey) ? 'O' : 'X';
      return [g.nick.join(' / '), g.name, g.school, fmtTime(inAt, tz), fmtTime(outAt, tz), mins, total ? Math.min(n, total) + ' / ' + total : '해당 없음', opts.survey ? (g.survey ? 'O' : 'X') : '해당 없음', verdict];
    });
    return { columns: COMPLETION_COLS.slice(), rows: rows };
  }

  // ---------------------------------------------------------------- word cloud cleaning
  var PARTICLES = '은는이가을를의에도요';
  var KEEP_WORDS = ['고양이', '어린이', '호랑이', '원숭이', '지렁이', '올챙이', '두꺼비'];
  var BANNED = DEFAULT_BANNED();
  function DEFAULT_BANNED() {
    return ['바보', '멍청이', '등신', '쓰레기', '죽어', '죽을래', '한남', '한녀', '틀딱', '맘충', '급식충', '김치녀', '섹스', 'sex', 'porn', '야동'];
  }
  /** NFC, trim, lowercase latin, drop tag-like bits ('<b>굵게</b>' → '굵게'), join a Hangul-only answer typed with spaces
   *  ('맑 음' = '맑음'), strip edge punctuation and one trailing particle (when ≥2 chars remain). */
  function normWord(v) {
    if (v == null) return '';
    var s = String(v); if (s.normalize) s = s.normalize('NFC');
    s = s.replace(CTRL, '').replace(/<\\/?[A-Za-z][^<>]{0,40}>/g, ' ').replace(/\\s+/g, ' ').trim().toLowerCase();
    if (/^[가-힣ㄱ-ㅎㅏ-ㅣ ]+$/.test(s)) s = s.replace(/ /g, '');
    s = s.replace(/^[\\s.,!?~…·'"“”‘’()\\[\\]{}<>:;-]+|[\\s.,!?~…·'"“”‘’()\\[\\]{}<>:;-]+$/g, '');
    var c = cps(s);
    if (c.length >= 3 && PARTICLES.indexOf(c[c.length - 1]) >= 0 && KEEP_WORDS.indexOf(s) < 0) s = c.slice(0, -1).join('').trim();
    return s;
  }
  function makeBanned(extra) {
    var list = BANNED.concat(DEFAULT_WORDS, extra || []).map(normWord).filter(Boolean);
    return function (w) {
      if (!w || /^[*\\s]+$/.test(w) || w.indexOf('**') >= 0) return true;
      for (var i = 0; i < list.length; i++) if (w.indexOf(list[i]) >= 0) return true;
      return false;
    };
  }
  /** answers[] of one poll → [{word, count}] merged by normWord, minus hidden and banned words, most first. */
  function wordCloud(answers, pollId, opts) {
    opts = opts || {};
    var hidden = {}; (opts.hidden || []).forEach(function (w) { hidden[normWord(w)] = 1; });
    var banned = makeBanned(opts.banned);
    var tally = {}, order = [];
    (answers || []).forEach(function (a) {
      if (!a || (pollId && a.poll !== pollId)) return;
      [].concat(a.value).forEach(function (v) {
        var w = normWord(v); if (!w || hidden[w] || banned(w)) return;
        if (!tally[w]) { tally[w] = 0; order.push(w); }
        tally[w]++;
      });
    });
    return order.map(function (w) { return { word: w, count: tally[w] }; }).sort(function (a, b) { return b.count - a.count; });
  }

  // ---------------------------------------------------------------- state extensions
  // Servers keep unknown top-level state keys out, so new instructor settings live in state.ui (scalars, ≤200 chars):
  //   ui.reveal = 'pollA|pollB'   ui.signalReset = ms   ui.hiddenWords = 'w1|w2'   ui.timers = '[[label,endsAt,remaining,running]…]'
  //   ui.m1…m8 = '<https url> <title>' (자료 링크: 강사 화면에서 연수 중에 덧붙임)
  // Readers also accept the top-level forms (pollReveal{}, signalReset, hiddenWords[], timers[]) if a backend stores them.
  var UI_MAX = 200;
  var MAT_MAX = 8, MAT_URL = /^https:\\/\\/[^\\s<>"'\`]+$/i;
  function splitList(s) { return typeof s === 'string' && s ? s.split('|').filter(Boolean) : []; }
  function joinList(list) {
    var a = list.filter(Boolean).map(function (x) { return String(x).replace(/\\|/g, ' '); });
    while (a.length && a.join('|').length > UI_MAX) a.shift();
    return a.join('|');
  }
  function uiOf(st) { return (st && st.ui) || {}; }
  var ext = {
    revealed: function (st, id) { return !!(st && ((st.pollReveal && st.pollReveal[id]) || splitList(uiOf(st).reveal).indexOf(id) >= 0)); },
    revealPatch: function (st, id, on) {
      var list = splitList(uiOf(st).reveal).filter(function (x) { return x !== id; });
      if (on) list.push(id);
      return { ui: { reveal: joinList(list) || null } };
    },
    /** 퀴즈 정답(강사가 공개할 때만 보냄): ui.ans = 'p1:2|p3:0'(투표 id:보기 번호, 0부터) → 번호, 없으면 -1 */
    answerOf: function (st, id) {
      var hit = splitList(uiOf(st).ans).filter(function (x) { return x.slice(0, x.lastIndexOf(':')) === id; })[0];
      var n = hit ? +hit.slice(hit.lastIndexOf(':') + 1) : -1;
      return n >= 0 && n < 100 ? n : -1;
    },
    answerPatch: function (st, id, idx) {
      var list = splitList(uiOf(st).ans).filter(function (x) { return x.slice(0, x.lastIndexOf(':')) !== id; });
      if (idx >= 0) list.push(String(id).replace(/[|:]/g, '-') + ':' + Math.floor(idx));
      return { ui: { ans: joinList(list) || null } };
    },
    signalReset: function (st) { return Math.max(+(st && st.signalReset) || 0, +uiOf(st).signalReset || 0); },
    hiddenWords: function (st) { return (st && Array.isArray(st.hiddenWords) ? st.hiddenWords : []).concat(splitList(uiOf(st).hiddenWords)); },
    hiddenPatch: function (st, word, hide) {
      var w = normWord(word); var list = splitList(uiOf(st).hiddenWords).filter(function (x) { return x !== w; });
      if (hide && w) list.push(w);
      return { ui: { hiddenWords: joinList(list) || null } };
    },
    /** → [{label, endsAt, remaining, running}] */
    timers: function (st) {
      if (st && Array.isArray(st.timers)) return st.timers;
      var raw = uiOf(st).timers; if (!raw) return [];
      try { return JSON.parse(raw).map(function (t) { return { label: String(t[0] || ''), endsAt: +t[1] || 0, remaining: +t[2] || 0, running: !!t[3] }; }); } catch (e) { return []; }
    },
    /** 강사가 연수 중에 덧붙인 자료 링크(ui.m1…m8 = '<https 주소> <이름>') → [{slot, url, title}] */
    materials: function (st) {
      var ui = uiOf(st), out = [];
      for (var i = 1; i <= MAT_MAX; i++) {
        var v = ui['m' + i]; if (typeof v !== 'string' || !v) continue;
        var sp = v.indexOf(' '); var url = sp < 0 ? v : v.slice(0, sp);
        if (!MAT_URL.test(url)) continue;
        out.push({ slot: i, url: url, title: (sp < 0 ? '' : v.slice(sp + 1).trim()) || url.replace(/^https:\\/\\/(www\\.)?/, '').slice(0, 40) });
      }
      return out;
    },
    /** 자료 링크 하나 넣기 → setState에 줄 patch. 넣을 수 없으면 { error: 까닭 } */
    materialAdd: function (st, url, title) {
      url = String(url || '').trim(); if (/^[\\w-]+(\\.[\\w-]+)+(\\/|$)/.test(url)) url = 'https://' + url; // drive.google.com/… 처럼 앞을 뺀 주소
      var okUrl = MAT_URL.test(url);
      if (okUrl) { try { var u = new URL(url); okUrl = u.protocol === 'https:' && u.hostname.indexOf('.') > 0; } catch (e) { okUrl = false; } }
      if (!okUrl) return { error: 'https://로 시작하는 주소를 넣어 주세요.' };
      if (url.length > UI_MAX - 30) return { error: '주소가 너무 길어요. 짧은 주소로 바꿔 넣어 주세요.' };
      var ui = uiOf(st), slot = 0;
      for (var i = 1; i <= MAT_MAX; i++) if (!ui['m' + i]) { slot = i; break; }
      if (!slot) return { error: '자료 링크는 ' + MAT_MAX + '개까지 넣을 수 있어요.' };
      var t = cps(String(title || '').replace(/\\s+/g, ' ').trim()).slice(0, UI_MAX - url.length - 1).join('');
      var patch = {}; patch['m' + slot] = t ? url + ' ' + t : url;
      return { ui: patch };
    },
    materialRemove: function (slot) { var patch = {}; patch['m' + slot] = null; return { ui: patch }; },
    /** 투표 집계: 응답자(답 기록) 하나에 한 표. 예전 서버에 남은 배열 답은 첫 보기 하나로 셈(강사·발표·참가자 화면이 같은 수) */
    tally: function (list) {
      var t = {};
      (list || []).forEach(function (a) { var v = Array.isArray(a.value) ? a.value[0] : a.value; if (v == null || v === '') return; v = String(v); t[v] = (t[v] || 0) + 1; });
      return t;
    },
    /** 강사가 잠근 칸: 'qa'(새 질문) · 'board'(새 보드 글) · 'join'(새 참여). 서버도 ui.lockQa·ui.lockBoard·ui.lockJoin을 보고 거절 */
    locked: function (st, which) { var ui = uiOf(st); return which === 'qa' ? ui.lockQa === true : which === 'board' ? ui.lockBoard === true : which === 'join' ? ui.lockJoin === true : false; },
    lockPatch: function (which, on) { var patch = {}; patch[which === 'qa' ? 'lockQa' : which === 'join' ? 'lockJoin' : 'lockBoard'] = on ? true : null; return { ui: patch }; },
    timersValue: function (list) {
      var out = (list || []).slice(0, 8).map(function (t) { return [cps(String(t.label || '')).slice(0, 12).join(''), t.endsAt || 0, t.remaining || 0, t.running ? 1 : 0]; });
      var s = JSON.stringify(out);
      while (out.length && s.length > UI_MAX) { out.pop(); s = JSON.stringify(out); }
      return out.length ? s : null;
    },
  };

  // ---------------------------------------------------------------- photo uploads (④)
  // JPEG·WebP photos (and big PNGs) are drawn on a canvas, long side at most 1600 px, and sent as JPEG: the copy
  // carries no EXIF (GPS location, camera, time) and is a few hundred KB. If that fails the photo is not sent at all
  // (sending the original would send the location). PNG screenshots and diagrams up to 3 MB stay sharp: their
  // metadata chunks (eXIf, text, time) are cut out and the pixels kept as they are. GIF has no EXIF.
  var IMG_SIDE = 1600, IMG_QUALITY = 0.82, PNG_KEEP = 3 * 1048576;
  var PNG_DROP = { eXIf: 1, tEXt: 1, zTXt: 1, iTXt: 1, tIME: 1 };
  function imgErr() { return LiveError('image_failed', '사진을 줄이지 못해 올리지 않았어요(위치 정보가 함께 올라가지 않게). 화면을 캡처해 다시 올려 주세요.', { status: 422, retryable: false }); }
  function readBytes(blob) {
    if (blob && typeof blob.arrayBuffer === 'function') return blob.arrayBuffer().then(function (b) { return new Uint8Array(b); });
    return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(new Uint8Array(r.result)); }; r.onerror = rej; r.readAsArrayBuffer(blob); });
  }
  function sniffImage(b) {
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
    if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
    return '';
  }
  function asFile(blob, name, type) {
    try { return new File([blob], name, { type: type }); } catch (e) { var b = new Blob([blob], { type: type }); try { b.name = name; } catch (x) { /* read-only */ } return b; }
  }
  function renamed(name, ext) { return String(name || 'photo').replace(/\\.[A-Za-z0-9]{1,5}$/, '') + '.' + ext; }
  /** PNG without metadata chunks (eXIf·tEXt·zTXt·iTXt·tIME); pixels untouched. null when the bytes are not a valid PNG. */
  function stripPng(b) {
    var out = [b.subarray(0, 8)], i = 8;
    while (i + 12 <= b.length) {
      var len = ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0, end = i + 12 + len;
      if (end > b.length) return null;
      var type = String.fromCharCode(b[i + 4], b[i + 5], b[i + 6], b[i + 7]);
      if (!PNG_DROP[type]) out.push(b.subarray(i, end));
      i = end;
      if (type === 'IEND') return out;
    }
    return null;
  }
  function decodeImage(file) {
    if (typeof root.createImageBitmap === 'function') {
      return root.createImageBitmap(file, { imageOrientation: 'from-image' }).catch(function () { return root.createImageBitmap(file); });
    }
    return new Promise(function (res, rej) {
      if (!root.URL || !root.Image) return rej(new Error('no image'));
      var u = URL.createObjectURL(file), img = new root.Image();
      img.onload = function () { res(img); setTimeout(function () { URL.revokeObjectURL(u); }, 0); };
      img.onerror = function () { URL.revokeObjectURL(u); rej(new Error('decode')); };
      img.src = u;
    });
  }
  function shrinkImage(file) {
    return decodeImage(file).then(function (img) {
      var w = img.width || img.naturalWidth, h = img.height || img.naturalHeight;
      if (!w || !h) throw new Error('size');
      var k = Math.min(1, IMG_SIDE / Math.max(w, h)), cw = Math.max(1, Math.round(w * k)), ch = Math.max(1, Math.round(h * k));
      var cv = root.document.createElement('canvas'); cv.width = cw; cv.height = ch;
      var g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cw, ch); g.drawImage(img, 0, 0, cw, ch);
      if (img.close) { try { img.close(); } catch (e) { /* ignore */ } }
      return new Promise(function (res, rej) { cv.toBlob(function (b) { if (b && b.size) res(b); else rej(new Error('encode')); }, 'image/jpeg', IMG_QUALITY); });
    }).then(function (blob) { return asFile(blob, renamed(file.name, 'jpg'), 'image/jpeg'); });
  }
  function prepUpload(file) {
    var head = file.slice ? file.slice(0, 16) : file;
    return readBytes(head).then(function (h) {
      var kind = sniffImage(h);
      if (!kind) return file; // PDF·MP3·MP4·GIF: as they are (the server checks the type from the bytes)
      if (kind === 'image/png' && file.size <= PNG_KEEP) {
        return readBytes(file).then(function (b) { var parts = stripPng(b); if (!parts) throw imgErr(); return asFile(new Blob(parts, { type: 'image/png' }), renamed(file.name, 'png'), 'image/png'); });
      }
      if (!root.document || !root.document.createElement) throw imgErr();
      return shrinkImage(file).catch(function () { throw imgErr(); });
    }, function () { throw imgErr(); });
  }

  // ---------------------------------------------------------------- registry & global events
  var registry = {};
  var globalBus = new Emitter();
  var current = null;

  function defaultState() { return { step: null, slide: 0, follow: false, timer: null, notice: null, openPoll: null, ui: {}, updatedAt: 0 }; }
  function byCreated(a, b) { return (a.createdAt || 0) - (b.createdAt || 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0); }

  // ---------------------------------------------------------------- the client
  function Client(config) {
    var self = this;
    config = assign({}, config || {});
    config.provider = config.provider || 'local';
    config.code = normCode(config.code || 'DEMO');
    if (config.provider === 'none') throw LiveError('no_provider', '참여 기능이 꺼져 있어요. 강사에게 알려 주세요.');
    var factory = registry[config.provider];
    if (!factory) throw LiveError('unknown_provider', '참여 기능(' + config.provider + ')을 불러오지 못했어요. 새로 고침해 주세요.');
    this.config = config;
    this.provider = config.provider;
    this.code = config.code;
    this.status = 'offline';
    this.mode = null;
    this.lastError = null;
    this._bus = new Emitter();
    this._docs = {}; COLS.forEach(function (c) { self._docs[c] = {}; });
    this._state = defaultState();
    this._cursor = 0;
    this._skew = 0;
    this._ns = 'lecLive:' + config.provider + ':' + hashStr(config.url || '') + ':' + config.code;
    this._idStore = config.identity === 'session' ? session : local;
    this._me = this._idStore.get(this._ns + ':me');
    this._adminKey = config.adminKey || session.get(this._ns + ':admin') || null;
    this._adminSess = null; this._loadSession();
    this._queue = local.get(this._ns + ':queue') || [];
    this._voted = local.get(this._ns + ':voted') || {};
    this._mine = local.get(this._ns + ':mine') || {};
    this._mask = makeMasker(config.profanity);
    this._syncing = null; this._syncAgain = false;
    this._reactAt = []; this._hits = {};
    this._closed = false;
    var ctx = {
      config: config,
      token: function () { return self._me && self._me.token; },
      me: function () { return self._me; },
      // the instructor session (after one accepted key) goes instead of the key; adapters send whatever this returns
      adminKey: function () { return self._adminSess ? self._adminSess.t : self._adminKey; },
      dropSession: function () { self._dropSession(); },
      cursor: function () { return self._cursor; },
      emit: function (evt) { return self._onEvent(evt); },
      storage: { local: local, session: session, ns: this._ns },
      util: api.util,
      error: LiveError,
    };
    this._ctx = ctx;
    this._adapter = factory(assign({}, config, { adminKey: undefined }), ctx);
    if (!this._adapter) throw LiveError('bad_adapter', '참여 기능을 준비하지 못했어요. 새로 고침해 주세요.');
    if (typeof this._adapter.subscribe === 'function') this._unsubAdapter = this._adapter.subscribe(function (evt) { return self._onEvent(evt); });
    this._onOnline = function () {
      if (self._closed) return;
      if (self.status === 'offline') self._reconnectSoon(500);
      else if (self._queue.length) setTimeout(function () { self._flushQueue(); }, 300);
    };
    if (root.addEventListener) root.addEventListener('online', this._onOnline);
    // 숨겼던 탭으로 돌아오면 기다리지 않고 바로 다시 이어 봄
    this._onVisible = function () {
      if (self._closed || isHidden() || self.status !== 'offline' || !self._reconnectTimer) return;
      clearTimeout(self._reconnectTimer); self._reconnectTimer = null; self._reconnectSoon(300);
    };
    try { if (root.document) root.document.addEventListener('visibilitychange', this._onVisible); } catch (e) { /* 없음 */ }
    current = this;
  }
  var C = Client.prototype;

  // ----- events
  C.on = function (evt, cb) { return this._bus.on(evt, cb); };
  C.off = function (evt, cb) { this._bus.off(evt, cb); };
  C._emitChange = function (change) {
    this._bus.emit('change', change);
    if (change.col) this._bus.emit('change:' + change.col, this.store(change.col), change);
    if (change.type === 'state') this._bus.emit('change:state', this._state, change);
    if (change.type === 'reaction') this._bus.emit('reaction', change.doc);
    this._bus.emit('event', change);
    globalBus.emit('change', change, this);
  };
  /** onChange(col, cb) → cb(docs, change). col: a collection, 'state', or '*' (cb(change)). */
  C.onChange = function (col, cb) {
    if (col === '*') return this.on('change', cb);
    return this.on('change:' + col, cb);
  };
  /** Contract: subscribe(handler) → unsubscribe. handler({type, col, doc}) after the store merged it. */
  C.subscribe = function (handler) { return this.on('event', handler); };
  C._setStatus = function (s) {
    if (!s || s === this.status) return;
    this.status = s;
    this._bus.emit('status', s, this);
    globalBus.emit('status', s, this);
    if ((s === 'live' || s === 'polling') && this._queue.length) this._flushQueue();
  };

  // ----- store
  C.store = function (col, opts) {
    if (col === 'state') return this._state;
    var m = this._docs[col]; if (!m) return [];
    var out = []; for (var k in m) out.push(m[k]);
    if (opts && opts.visible) out = out.filter(function (d) { return d.status !== 'hidden' && !d.hidden; });
    if (opts && opts.mine) { var mine = this._mine[col] || {}; var me = this._me && this._me.id; out = out.filter(function (d) { return mine[d.id] || (me && d.by === me); }); }
    return out.sort(byCreated);
  };
  C.get = function (col, id) { var m = this._docs[col]; return m ? m[id] || null : null; };
  Object.defineProperty(C, 'state', { get: function () { return this._state; } });
  C.now = function () { return Date.now() + this._skew; };
  C.me = function () { return this._me ? { id: this._me.id, nickname: this._me.nickname } : null; };
  C.isAdmin = function () { return !!this._adminKey; };
  /** 지금 묻기 방식: { provider, status, transport: 'ws'|'sse'|'long'|'poll'|'realtime'|'local'|null, every(ms, 묻기 간격), wait(s, 긴 대기), hint(ms, 서버 권고) } */
  C.netInfo = function () {
    var a = this._adapter, i = {};
    try { i = (a && typeof a.netInfo === 'function' ? a.netInfo() : null) || {}; } catch (e) { i = {}; }
    if (!i.transport) i.transport = this.provider === 'local' ? 'local' : this.mode === 'polling' ? 'poll' : this.status === 'live' ? 'realtime' : null;
    return assign({ provider: this.provider, status: this.status }, i);
  };
  C.voted = function (id) { return !!this._voted[id]; };
  C.mine = function (col) { return this.store(col, { mine: true }); };

  /** 받은 글을 화면에 쓰기 전에: 보이지 않는 문자·방향 바꿈·쌓인 결합 부호를 빼고 길이를 자르고 욕설을 가림.
   *  서버가 이미 거르지만, 예전 서버나 직접 넣은 기록도 강사·발표 화면을 깨뜨리지 못하게 여기서 한 번 더 */
  C._maskDoc = function (col, doc) {
    var f = FIELDS[col]; if (!f || !doc) return doc;
    for (var k in f) {
      if (typeof doc[k] === 'string') { doc[k] = cleanText(doc[k], f[k][0], !!f[k][1]); if (f[k][2]) doc[k] = this._mask(doc[k]); }
      else if (Array.isArray(doc[k]) && f[k][0]) doc[k] = doc[k].slice(0, LIMITS.answerItems).map(function (x) { return typeof x === 'string' ? cleanText(x, f[k][0], false) : x; });
    }
    if (typeof doc.nickname === 'string') { doc.nickname = cleanText(doc.nickname, LIMITS.nickname, false); if (col !== 'participants') doc.nickname = this._mask(doc.nickname); }
    if (col === 'polls' && Array.isArray(doc.options)) doc.options = doc.options.slice(0, LIMITS.options).map(function (o) { return cleanText(o, LIMITS.option, false); }).filter(Boolean);
    if (col === 'posts' && Array.isArray(doc.files)) doc.files.forEach(function (x) { if (x && typeof x.name === 'string') x.name = cleanText(x.name, LIMITS.fileName, false); });
    return doc;
  };
  /** 한 기기에서 너무 빨리 보내는 것(도배)을 먼저 막음. 서버도 따로 셈(같은 학교가 한 IP여서 서버 쪽은 넉넉함) */
  C._throttle = function (col) {
    var r = this.config.throttle === false ? null : CLIENT_RATE[col]; if (!r) return null;
    var now = Date.now(), hits = (this._hits[col] || []).filter(function (t) { return now - t < r[1]; });
    var last = hits[hits.length - 1] || 0, wait = 0;
    if (hits.length >= r[0]) wait = hits[0] + r[1] - now;
    if (r[2] && now - last < r[2]) wait = Math.max(wait, last + r[2] - now);
    if (wait > 0) return LiveError('rate_limited', '조금 천천히 보내 주세요. ' + Math.max(1, Math.ceil(wait / 1000)) + '초 뒤에 다시 보낼 수 있어요.', { status: 429, retryable: false, retryAfter: Math.ceil(wait / 1000) });
    hits.push(now); this._hits[col] = hits;
    return null;
  };
  C._merge = function (col, doc, type) {
    if (!doc || doc.id == null || !this._docs[col]) return false;
    var m = this._docs[col];
    doc = this._maskDoc(col, clone(doc));
    var old = m[doc.id];
    if (old && !old._pending && old.updatedAt && doc.updatedAt && doc.updatedAt < old.updatedAt) return false;
    // Servers show \`by\` of answers/progress/help only to their owner (and the admin); public events omit it.
    // Same id = same owner, so keep what we knew.
    if (old && old.by != null && doc.by == null) doc.by = old.by;
    // 결과 공개 전 남의 응답은 값 없이(sealed) 옴: 이미 값을 아는 응답(내 것·공개 뒤 받은 것)을 빈 값으로 덮지 않음
    if (col === 'answers' && doc.sealed && old && !old.sealed && old.value !== undefined) { doc.value = old.value; delete doc.sealed; }
    // 공개되어 값이 온 응답: 화면들이 Object.assign으로 합치므로 '봉인' 표시를 분명히 거둠
    if (col === 'answers' && old && old.sealed && !doc.sealed) doc.sealed = false;
    if (doc.cid) {
      for (var k in m) {
        if (m[k]._pending && m[k].cid === doc.cid && k !== doc.id) {
          var tmp = m[k]; delete m[k];
          this._emitChange({ type: 'remove', col: col, doc: { id: tmp.id, replacedBy: doc.id } });
        }
      }
    }
    if (old && old._pending && !doc._pending) doc._pending = false; // listeners that Object.assign() see the flag clear
    if (old && same(old, doc)) return false;
    m[doc.id] = doc;
    this._emitChange({ type: old ? 'update' : (type === 'update' ? 'update' : 'add'), col: col, doc: doc });
    return true;
  };
  C._drop = function (col, id) {
    var m = this._docs[col]; if (!m || !m[id]) return false;
    delete m[id];
    this._emitChange({ type: 'remove', col: col, doc: { id: id } });
    return true;
  };
  C._setState = function (st) {
    if (!st) return false;
    if (this._state.updatedAt && st.updatedAt && st.updatedAt < this._state.updatedAt) return false;
    var next = assign(defaultState(), st);
    if (same(next, this._state)) return false;
    var before = this._state;
    this._state = next;
    this._emitChange({ type: 'state', col: null, doc: next });
    this._fetchRevealed(before, next);
    return true;
  };
  /** 강사가 결과를 공개한 투표가 새로 생기면 그 응답 값을 다시 받아 옴(공개 전에는 서버가 값을 보내지 않음).
   *  같은 순간 수백 명이 한꺼번에 묻지 않게 0~1.5초 흩어서 */
  C._fetchRevealed = function (before, next) {
    var self = this;
    if (this._adminKey || this.provider === 'local' || typeof this._adapter.list !== 'function') return;
    var fresh = splitList(uiOf(next).reveal).concat(Object.keys(next.pollReveal || {}).filter(function (k) { return next.pollReveal[k]; }))
      .filter(function (id) { return !ext.revealed(before, id); });
    if (!fresh.length || this._revealT) return;
    var run = function (n) {
      self._revealT = setTimeout(function () {
        self._revealT = 0;
        // 못 받으면 한 번 더(8초 뒤): '결과를 불러오는 중'에 머물지 않게
        self._call('list', ['answers', {}], { tries: 2 }).then(function (docs) { (docs || []).forEach(function (d) { self._merge('answers', d); }); }, function () { if (!n && !self._closed) run(1); });
      }, n ? 8000 : Math.round(Math.random() * 1500));
    };
    run(0);
  };
  C._reset = function () {
    var self = this;
    COLS.forEach(function (c) { self._docs[c] = {}; });
    this._state = defaultState();
    this._cursor = 0;
    this._mine = {}; local.del(this._ns + ':mine');
    this._emitChange({ type: 'reset', col: null, doc: null });
    COLS.forEach(function (c) { self._bus.emit('change:' + c, [], { type: 'reset', col: c }); });
  };
  /** Applies a snapshot {state, <col>[], removed[], now, time, full}. Returns number of changes. */
  C._applySnapshot = function (snap, full) {
    var self = this; var n = 0;
    if (!snap) return 0;
    if (snap.time) this._skew = snap.time - Date.now();
    COLS.forEach(function (col) {
      var list = snap[col]; if (!Array.isArray(list)) return;
      if (full) {
        var seen = {}; list.forEach(function (d) { seen[d.id] = 1; });
        var m = self._docs[col];
        for (var id in m) if (!seen[id] && !m[id]._pending) { self._drop(col, id); n++; }
      }
      list.forEach(function (d) { if (self._merge(col, d)) n++; });
    });
    (snap.removed || []).forEach(function (r) { if (self._drop(r.col, r.id)) n++; });
    if (snap.state && this._setState(snap.state)) n++;
    if (snap.now != null) this._cursor = snap.now;
    return n;
  };

  C._onEvent = function (evt) {
    if (!evt || this._closed) return;
    switch (evt.type) {
      case 'add': case 'update': this._merge(evt.col, evt.doc, evt.type); break;
      case 'remove': if (evt.doc) this._drop(evt.col, evt.doc.id); break;
      case 'state': this._setState(evt.doc); break;
      case 'reaction': if (evt.doc && EMOJIS.indexOf(evt.doc.emoji) >= 0) this._emitChange({ type: 'reaction', col: null, doc: { emoji: evt.doc.emoji, count: Math.min(50, Math.max(1, evt.doc.count | 0 || 1)) } }); break;
      case 'reset': this._reset(); return this.sync(true);
      case 'status': this._setStatus(evt.status); if (evt.mode) this.mode = evt.mode; break;
      case 'resync': return this.sync(!!evt.full);
      case 'hello': if (evt.now) this._skew = evt.now - Date.now(); break;
      // 어댑터가 따로 받은 묻기 결과(긴 대기): 동기화 차례(_syncing)를 붙잡지 않고 바로 합침 → { changes }
      case 'snapshot': return { changes: this._applySnapshot(evt.doc, false) };
      // 묻기 방식이 바뀜(실시간 ↔ 긴 대기 ↔ 간격 묻기, 간격 권고): 강사 화면이 '묻기 방식'을 다시 그림
      case 'net': this._bus.emit('net', this.netInfo()); break;
      case 'error': this.lastError = evt.error; this._bus.emit('error', evt.error); break;
      default: break;
    }
  };

  // ----- calls with retry
  C._call = function (name, args, opts) {
    var self = this; opts = opts || {};
    var tries = opts.tries == null ? 3 : opts.tries;
    var fn = this._adapter[name];
    if (typeof fn !== 'function') return Promise.reject(LiveError('unsupported', '이 연결 방식은 "' + name + '" 기능을 지원하지 않아요.', { status: 501, retryable: false }));
    var attempt = 0;
    function run() {
      return Promise.resolve().then(function () { return fn.apply(self._adapter, args); }).catch(function (err) {
        if (!err || typeof err !== 'object') err = LiveError('error', String(err));
        if (err.code === 'session_expired' && self._adminSess && !opts.noResess) {
          opts.noResess = true; self._dropSession();
          return run().then(function (r) { self._getSession(); return r; });
        }
        if (err.code === 'invalid_token' && !opts.noRejoin && self._me && name !== 'join') {
          opts.noRejoin = true;
          return self._rejoin().then(run);
        }
        attempt++;
        if (err.retryable !== false && attempt < tries) return sleep(err.retryAfter ? Math.min(10000, err.retryAfter * 1000) : backoff(attempt - 1, 600, 5000)).then(run);
        self.lastError = err;
        throw err;
      });
    }
    return run();
  };
  C._rejoin = function () {
    var prev = this._me || {};
    this._me = null; this._idStore.del(this._ns + ':me');
    return this.join({ nickname: prev.nickname });
  };
  C._ensureJoined = function () {
    if (this._me && this._me.token) return Promise.resolve(this._me);
    var p = local.get('lecLive:profile') || {};
    return this.join({ nickname: this.config.nickname || p.nickname || '' });
  };

  // ----- connect / sync
  C.connect = function () {
    var self = this;
    if (this._connecting) return this._connecting;
    this._closed = false;
    this._setStatus('connecting');
    this._connecting = this._call('connect', [], { tries: 2 }).then(function (info) {
      info = info || {};
      self.mode = info.mode || 'realtime';
      var as = self._adapter.status;
      self._setStatus(as === 'live' || as === 'polling' ? as : (info.mode === 'polling' ? 'polling' : 'live'));
      if (self._adminKey && !self._adminSess) self._getSession();
      return self.sync(true).then(function () { self._flushQueue(); return info; });
    }, function (err) {
      self._setStatus('offline');
      self._connecting = null;
      self._reconnectSoon();
      throw err;
    });
    return this._connecting;
  };
  C._reconnectSoon = function (ms) {
    var self = this;
    if (this._reconnectTimer || this._closed) return;
    this._reconnectN = (this._reconnectN || 0) + 1;
    this._reconnectTimer = setTimeout(function () {
      self._reconnectTimer = null;
      if (self._closed || self.status !== 'offline') return;
      self.connect().then(function () { self._reconnectN = 0; }, function () { /* next round scheduled */ });
    }, ms || backoff(Math.min(self._reconnectN, 5), 2000, isHidden() ? 60000 : 10000)); // 화면을 보고 있으면 10초 안에 다시(서버가 돌아오면 곧 이어짐), 숨긴 탭은 길게
  };
  /** Fetches changes since the cursor (or everything when full) and merges them. → {changes} */
  C.sync = function (full) {
    var self = this;
    if (this._syncing) { this._syncAgain = this._syncAgain || (full ? 'full' : true); return this._syncing; }
    var since = full ? 0 : this._cursor;
    var job;
    if (typeof this._adapter.snapshot === 'function') job = this._call('snapshot', [{ since: since, admin: !!this._adminKey }], { tries: 2 });
    else job = this._listAll(since);
    this._syncing = job.then(function (snap) {
      var n = self._applySnapshot(snap, since === 0);
      if (since === 0) self._synced = true;
      return { changes: n };
    }).catch(function (err) {
      self.lastError = err;
      return { changes: 0, error: err };
    }).then(function (r) {
      self._syncing = null;
      var again = self._syncAgain; self._syncAgain = false;
      if (again) return self.sync(again === 'full').then(function (r2) { return { changes: r.changes + r2.changes }; });
      return r;
    });
    return this._syncing;
  };
  C._listAll = function (since) {
    var self = this;
    var cols = this._adminKey ? COLS : PUBLIC_COLS;
    var snap = { now: null, since: since };
    return Promise.all(cols.map(function (c) {
      return self._call('list', [c, { since: since }], { tries: 2 }).then(function (docs) { snap[c] = docs || []; }, function () { /* skip col */ });
    })).then(function () { return self._call('getState', [], { tries: 2 }); }).then(function (st) {
      snap.state = st;
      var max = since; COLS.forEach(function (c) { (snap[c] || []).forEach(function (d) { if (d.updatedAt > max) max = d.updatedAt; }); });
      snap.now = max;
      return snap;
    });
  };
  C.disconnect = C.close = function () {
    this._closed = true;
    if (this._reconnectTimer) { clearTimeout(this._reconnectTimer); this._reconnectTimer = null; }
    if (this._flushTimer) { clearTimeout(this._flushTimer); this._flushTimer = null; }
    if (root.removeEventListener) root.removeEventListener('online', this._onOnline);
    try { if (root.document) root.document.removeEventListener('visibilitychange', this._onVisible); } catch (e) { /* 없음 */ }
    this._connecting = null;
    var a = this._adapter;
    this._setStatus('offline');
    return Promise.resolve(a.close ? a.close() : (a.disconnect ? a.disconnect() : null));
  };

  // ----- identity
  C.join = function (profile) {
    var self = this; profile = profile || {};
    var p = {
      nickname: cleanText(profile.nickname, LIMITS.nickname, false),
      name: cleanText(profile.name, LIMITS.name, false) || undefined,
      school: cleanText(profile.school, LIMITS.school, false) || undefined,
      consent: !!profile.consent,
    };
    p.nickname = this._mask(p.nickname) || '참가자' + String(Math.floor(Math.random() * 900) + 100);
    if (this._me && this._me.token && !profile.force) {
      if (p.nickname && p.nickname !== this._me.nickname && profile.nickname) {
        return this.update('participants', this._me.id, { nickname: p.nickname }).then(function () {
          self._me.nickname = p.nickname; self._idStore.set(self._ns + ':me', self._me); return { id: self._me.id, token: self._me.token };
        }, function () { return { id: self._me.id, token: self._me.token }; });
      }
      return Promise.resolve({ id: this._me.id, token: this._me.token });
    }
    if (this._joining) return this._joining;
    this._joining = this._call('join', [p], { tries: 3 }).then(function (r) {
      self._joining = null;
      if (!r || !r.id || !r.token) throw LiveError('bad_response', '참여 응답이 올바르지 않아요. 새로 고침한 뒤 다시 들어와 주세요.');
      self._me = { id: r.id, token: r.token, nickname: r.nickname || p.nickname, at: Date.now() };
      self._idStore.set(self._ns + ':me', self._me);
      local.set('lecLive:profile', { nickname: self._me.nickname });
      self._bus.emit('join', self.me());
      if (self._queue.length) self._flushQueue();
      return { id: r.id, token: r.token };
    }, function (e) { self._joining = null; throw e; });
    return this._joining;
  };
  /** Forget this device's participant identity (shared computers). */
  C.leave = function () { this._me = null; this._idStore.del(this._ns + ':me'); this._voted = {}; local.del(this._ns + ':voted'); };
  C.setAdminKey = function (key) {
    if ((key ? String(key) : null) !== this._adminKey) this._dropSession();
    this._adminKey = key ? String(key) : null;
    if (key) session.set(this._ns + ':admin', String(key)); else session.del(this._ns + ':admin');
    this._loadSession();
    var a = this._adapter, self = this;
    var p = (this._adminKey ? this._getSession() : Promise.resolve()).then(function () { return a.setAdmin ? a.setAdmin(self._ctx.adminKey()) : null; });
    return p.then(function () { return self.status === 'offline' ? null : self.sync(true); });
  };
  // ----- instructor session: one accepted admin key → a 12-hour token the server keeps only as a hash.
  // Requests then carry the token instead of the key, and the server's wrong-key lockout (counted per school IP)
  // never reaches a console that is already in. Kept in this tab (sessionStorage), tied to the key it came from.
  C._loadSession = function () {
    this._adminSess = null;
    var s = this._adminKey ? session.get(this._ns + ':asess') : null;
    if (s && typeof s.t === 'string' && s.h === hashStr(this._adminKey) && s.exp > Date.now() + 60000) this._adminSess = s;
  };
  C._dropSession = function () { this._adminSess = null; session.del(this._ns + ':asess'); };
  C._getSession = function () {
    var self = this, a = this._adapter, key = this._adminKey;
    if (!key || this._adminSess || typeof a.adminSession !== 'function' || /^lps1\\./.test(key)) return Promise.resolve(this._adminSess);
    if (this._sessJob) return this._sessJob;
    this._sessJob = Promise.resolve().then(function () { return a.adminSession(key); }).then(function (r) {
      self._sessJob = null;
      if (!r || typeof r.session !== 'string' || self._adminKey !== key) return null;
      self._adminSess = { t: r.session, exp: Number(r.expiresAt) || Date.now() + 12 * 3600e3, h: hashStr(key) };
      session.set(self._ns + ':asess', self._adminSess);
      return self._adminSess;
    }, function () { self._sessJob = null; return null; }); // older server or locked right now: keep using the key
    return this._sessJob;
  };
  /** 강사 화면: 관리자 키를 한 번만 물어 확인하고(틀린 키는 서버가 한 번으로 셈), 맞으면 이 연결에만 씀(저장소에 두지 않음). → true/false */
  C.useAdminKey = function (key) {
    var self = this, prev = this._adminKey;
    this._adminKey = key ? String(key) : null;
    if (!this._adminKey) { this._adminKey = prev; return Promise.resolve(false); }
    if (this._adminKey !== prev) this._loadSession(); // a session this tab already holds for this key: no key attempt
    return this.checkAdmin().then(function (ok) {
      if (!ok) { self._adminKey = prev; self._loadSession(); return false; }
      var a = self._adapter;
      return self._getSession().then(function () { return a.setAdmin ? a.setAdmin(self._ctx.adminKey()) : null; })
        .then(function () { return self.status === 'offline' ? true : self.sync(true).then(function () { return true; }); });
    }, function (e) { self._adminKey = prev; self._loadSession(); throw e; });
  };
  /** Resolves true when the admin key is accepted by the backend. */
  C.checkAdmin = function () {
    if (!this._adminKey) return Promise.resolve(false);
    if (typeof this._adapter.checkAdmin === 'function') return this._call('checkAdmin', [], { tries: 2 }).then(function (ok) { return !!ok; });
    return this._call('exportCsv', ['participants'], { tries: 1 }).then(function () { return true; }, function (e) { if (e.status === 401 || e.status === 403) return false; throw e; });
  };

  // ----- writes (queued when offline)
  C._prepare = function (col, doc) {
    var f = FIELDS[col] || {}; var out = {};
    for (var k in doc) {
      if (!Object.prototype.hasOwnProperty.call(doc, k) || k.charAt(0) === '_') continue;
      var v = doc[k];
      if (f[k] && typeof v === 'string') { v = cleanText(v, f[k][0], !!f[k][1]); if (f[k][2]) v = this._mask(v); }
      else if (f[k] && Array.isArray(v)) v = v.map(function (x) { return typeof x === 'string' ? cleanText(x, f[k][0], false) : x; });
      out[k] = v;
    }
    return out;
  };
  C._online = function () { return this.status === 'live' || this.status === 'polling'; };
  C._persistQueue = function () { local.set(this._ns + ':queue', this._queue.slice(-100)); this._bus.emit('queue', this._queue.length); };
  C._enqueue = function (op) {
    this._queue.push(op);
    if (this._queue.length > 100) this._queue.shift();
    this._persistQueue();
    this._scheduleFlush(5000);
  };
  C._scheduleFlush = function (ms) {
    var self = this;
    if (this._flushTimer || this._closed) return;
    this._flushTimer = setTimeout(function () {
      self._flushTimer = null;
      if (!self._queue.length) return;
      if (self._online()) self._flushQueue(); else self._scheduleFlush(Math.min(60000, (ms || 5000) * 2));
    }, ms || 5000);
  };
  C._optimistic = function (op) {
    var now = this.now();
    if (op.op === 'add') {
      var tmp = assign({}, op.doc, { id: 'tmp_' + op.cid, cid: op.cid, createdAt: now, updatedAt: now, _pending: true });
      if (this._me) tmp.by = this._me.id;
      if (op.col === 'questions') assign(tmp, { votes: 0, status: 'open', pinned: false, nickname: op.doc.anonymous === false && this._me ? this._me.nickname : '' });
      if (op.col === 'posts') assign(tmp, { likes: 0, hidden: !!(this._state.ui || {}).moderation, nickname: this._me ? this._me.nickname : '' });
      if (op.col === 'chat' || op.col === 'help') tmp.nickname = this._me ? this._me.nickname : '';
      if (op.col === 'help') assign(tmp, { status: 'open', assignee: '' });
      if (op.col === 'progress' || op.col === 'answers' || op.col === 'survey' || op.col === 'attendance') {
        // keyed upserts replace the existing doc of mine
        var me = this._me && this._me.id; var m = this._docs[op.col];
        for (var k in m) {
          var d = m[k];
          if (d.by === me && ((op.col === 'progress' && d.station === op.doc.station) || (op.col === 'answers' && d.poll === op.doc.poll) || op.col === 'survey' || (op.col === 'attendance' && d.kind === op.doc.kind))) {
            var up = assign({}, d, op.doc, { updatedAt: now, _pending: true, cid: op.cid }); this._docs[op.col][k] = up;
            this._emitChange({ type: 'update', col: op.col, doc: up }); return up;
          }
        }
      }
      this._docs[op.col][tmp.id] = tmp;
      this._emitChange({ type: 'add', col: op.col, doc: tmp });
      return tmp;
    }
    if (op.op === 'update') {
      var cur = this.get(op.col, op.id); if (!cur) return null;
      var next = assign({}, cur, op.patch, { _pending: true });
      this._docs[op.col][op.id] = next;
      this._emitChange({ type: 'update', col: op.col, doc: next });
      return next;
    }
    return null;
  };
  C._exec = function (op) {
    var self = this;
    var needsToken = !(op.admin) && op.op !== 'remove';
    var pre = needsToken ? this._ensureJoined() : Promise.resolve();
    return pre.then(function () {
      switch (op.op) {
        case 'add': return self._call('add', [op.col, assign({}, op.doc, { cid: op.cid })]).then(function (doc) {
          if (doc && doc.id) { self._markMine(op.col, doc.id); if (!doc.cid) doc.cid = op.cid; self._merge(op.col, doc); }
          return doc;
        });
        case 'update': return self._call('update', [op.col, op.id, op.patch]).then(function (doc) { if (doc && doc.id) self._merge(op.col, doc, 'update'); return doc; });
        case 'vote': return self._call('vote', [op.id]);
        case 'like': return self._call('like', [op.id]);
        default: throw LiveError('bad_op', op.op);
      }
    });
  };
  C._markMine = function (col, id) {
    var m = this._mine[col] || (this._mine[col] = {});
    m[id] = 1;
    var keys = Object.keys(m); if (keys.length > 300) delete m[keys[0]];
    local.set(this._ns + ':mine', this._mine);
  };
  C._write = function (op) {
    var self = this;
    if (!this._online()) {
      this._enqueue(op);
      return Promise.resolve(this._optimistic(op) || { queued: true });
    }
    return this._exec(op).catch(function (err) {
      if (err && err.retryable !== false && !err.status) {
        self._enqueue(op);
        return self._optimistic(op) || { queued: true };
      }
      throw err;
    });
  };
  C._flushQueue = function () {
    var self = this;
    if (this._flushing || !this._queue.length || !this._online()) return this._flushing || Promise.resolve();
    this._flushing = (function next() {
      if (!self._queue.length || !self._online()) return Promise.resolve();
      var op = self._queue[0];
      return self._exec(op).then(function () {
        self._queue.shift(); self._persistQueue(); return next();
      }, function (err) {
        if (err && err.retryable !== false && !err.status) { self._scheduleFlush(10000); return; }
        self._queue.shift(); self._persistQueue();
        if (op.op === 'add') self._drop(op.col, 'tmp_' + op.cid);
        // 덮어쓰는 기록(투표 답·진행·설문·출석)과 고치기는 미리 바꿔 둔 화면을 서버 값으로 되돌림(닫힌 투표에 늦게 낸 답 등)
        if (op.op === 'update' || op.op === 'vote' || (op.op === 'add' && /^(answers|progress|survey|attendance)$/.test(op.col))) self.sync(true);
        self._bus.emit('error', err, op);
        return next();
      });
    })().then(function () { self._flushing = null; }, function () { self._flushing = null; });
    return this._flushing;
  };

  C.add = function (col, doc) {
    if (COLS.indexOf(col) < 0) return Promise.reject(LiveError('unknown_collection', '없는 컬렉션: ' + col, { status: 400, retryable: false }));
    var d = this._prepare(col, doc || {});
    var cid = d.cid || uid(16); delete d.cid;
    // 강사 명단: 휴대폰 없는 사람을 손으로 더하기(participants)·입실·퇴실 시각 넣기·고치기(attendance에 by) — 관리자만, 대기열 없이 바로
    var roster = !!this._adminKey && (col === 'participants' || (col === 'attendance' && d.by != null));
    var op = { op: 'add', col: col, doc: d, cid: cid, at: Date.now(), admin: col === 'polls' || roster };
    if (op.admin) return this._exec(op);
    if (!this._adminKey) {
      // 강사가 잠근 칸·닫은 투표는 보내기 전에 알려 줌(연결이 끊겨 대기열에 넣었다가 나중에 조용히 버려지지 않게). 서버도 같은 규칙으로 거절
      var lock = col === 'questions' ? 'qa' : col === 'posts' ? 'board' : '';
      if (lock && ext.locked(this._state, lock)) return Promise.reject(LiveError('locked', lock === 'qa' ? '지금은 질문을 받지 않아요. 강사가 다시 열면 보낼 수 있어요.' : '지금은 보드에 글을 받지 않아요. 강사가 다시 열면 올릴 수 있어요.', { status: 409, retryable: false }));
      var poll = col === 'answers' && d.poll ? this.get('polls', d.poll) : null;
      if (poll && poll.open === false) return Promise.reject(LiveError('poll_closed', '투표가 닫혔어요.', { status: 409, retryable: false }));
      var slow = this._throttle(col); if (slow) return Promise.reject(slow);
    }
    return this._write(op);
  };
  C.update = function (col, id, patch) {
    var op = { op: 'update', col: col, id: id, patch: this._prepare(col, patch || {}), at: Date.now() };
    var mine = this._me && (this.get(col, id) || {}).by === this._me.id || (this._mine[col] || {})[id] || (col === 'participants' && this._me && id === this._me.id);
    if (this._adminKey && !mine) { op.admin = true; return this._exec(op); }
    return this._write(op);
  };
  C.remove = function (col, id) {
    var self = this;
    return this._call('remove', [col, id]).then(function (r) { self._drop(col, id); return r === undefined ? true : r; });
  };
  C.vote = function (questionId) {
    var self = this;
    if (this._voted[questionId]) { var q = this.get('questions', questionId); return Promise.resolve({ votes: q ? q.votes : 0, already: true }); }
    this._voted[questionId] = 1; local.set(this._ns + ':voted', this._voted);
    var q0 = this.get('questions', questionId);
    if (q0) { var bumped = assign({}, q0, { votes: (q0.votes || 0) + 1 }); this._docs.questions[questionId] = bumped; this._emitChange({ type: 'update', col: 'questions', doc: bumped }); }
    return this._write({ op: 'vote', id: questionId, at: Date.now() }).then(function (r) {
      var q = self.get('questions', questionId);
      if (r && typeof r.votes === 'number' && q && q.votes !== r.votes) { var fixed = assign({}, q, { votes: r.votes }); self._docs.questions[questionId] = fixed; self._emitChange({ type: 'update', col: 'questions', doc: fixed }); }
      return r;
    }, function (err) {
      delete self._voted[questionId]; local.set(self._ns + ':voted', self._voted);
      if (q0) self._merge('questions', assign({}, q0, { updatedAt: (q0.updatedAt || 0) + 0.001 }));
      throw err;
    });
  };
  C.like = function (postId) {
    var self = this; var key = 'post:' + postId;
    if (this._voted[key]) { var p = this.get('posts', postId); return Promise.resolve({ likes: p ? p.likes : 0, already: true }); }
    this._voted[key] = 1; local.set(this._ns + ':voted', this._voted);
    return this._write({ op: 'like', id: postId, at: Date.now() }).catch(function (err) { delete self._voted[key]; local.set(self._ns + ':voted', self._voted); throw err; });
  };
  C.list = function (col, opts) {
    var self = this;
    // After the first full sync the store is already current (realtime/polling keep it so): no extra request.
    if (this._synced && this._online() && !(opts && opts.since) && (PUBLIC_COLS.indexOf(col) >= 0 || this._adminKey)) return Promise.resolve(this.store(col));
    return this._call('list', [col, opts || {}]).then(function (docs) { (docs || []).forEach(function (d) { self._merge(col, d); }); return self.store(col); });
  };
  C.getState = function () {
    var self = this;
    if (this._online() && this._state.updatedAt) return Promise.resolve(this._state);
    return this._call('getState', []).then(function (st) { self._setState(st); return self._state; });
  };
  C.setState = function (patch) {
    var self = this;
    return this._call('setState', [patch || {}]).then(function (st) { self._setState(st); return self._state; });
  };
  C.react = function (emoji) {
    if (EMOJIS.indexOf(emoji) < 0) return Promise.reject(LiveError('invalid_value', '보낼 수 없는 반응이에요.', { status: 400, retryable: false }));
    var now = Date.now();
    this._reactAt = this._reactAt.filter(function (t) { return now - t < 1000; });
    if (this._reactAt.length >= 6) return Promise.resolve(false);
    this._reactAt.push(now);
    this._emitChange({ type: 'reaction', col: null, doc: { emoji: emoji, count: 1, self: true } });
    if (!this._online()) return Promise.resolve(false);
    var self = this;
    return this._ensureJoined().then(function () { return self._call('react', [emoji], { tries: 1 }); }).then(function () { return true; }, function () { return false; });
  };
  C.upload = function (file) {
    var self = this;
    if (!file || typeof file.size !== 'number') return Promise.reject(LiveError('invalid_value', '파일을 골라 주세요.', { status: 400, retryable: false }));
    var maxMb = this.config.maxUploadMb || LIMITS.uploadMb;
    if (file.type && !UPLOAD_TYPES[file.type]) return Promise.reject(LiveError('unsupported_type', '사진·PDF·MP3·MP4만 올릴 수 있어요.', { status: 415, retryable: false }));
    // ④ photos are drawn again before they leave the device: location (EXIF GPS) and other metadata go, size drops
    return prepUpload(file).then(function (f) {
      if (f.size > maxMb * 1048576) throw LiveError('too_large', '파일은 ' + maxMb + 'MB까지 올릴 수 있어요.', { status: 413, retryable: false });
      return self._ensureJoined().then(function () { return self._call('upload', [f], { tries: 2 }); });
    });
  };
  /** exportCsv(kind, opts) — opts only matter for 'completion' (see completionTable). Servers that do not know
   *  'completion' yet are covered by building it here from the admin store. */
  C.exportCsv = function (kind, opts) {
    var self = this; kind = kind || 'attendance';
    return this._call('exportCsv', [kind, opts || {}], { tries: 2 }).catch(function (err) {
      if (kind !== 'completion' || !self._adminKey || !err || !(err.code === 'bad_kind' || err.code === 'unsupported' || err.status === 400 || err.status === 404)) throw err;
      var data = {}; ['participants', 'attendance', 'progress', 'survey'].forEach(function (c) { data[c] = self.store(c); });
      var t = completionTable(data, opts);
      return toCsv(t.columns, t.rows);
    });
  };
  C.purge = function () {
    var self = this;
    return this._call('purge', [], { tries: 1 }).then(function (r) { self._reset(); return r === undefined ? true : r; });
  };

  // ---------------------------------------------------------------- public API
  var api = {
    __core: true,
    version: VERSION,
    cols: COLS.slice(), publicCols: PUBLIC_COLS.slice(), privateCols: PRIVATE_COLS.slice(),
    limits: LIMITS, emojis: EMOJIS.slice(), uploadTypes: Object.keys(UPLOAD_TYPES),
    register: function (name, factory) { registry[name] = factory; return api; },
    providers: function () { return Object.keys(registry); },
    has: function (name) { return !!registry[name]; },
    create: function (config) { return new Client(config); },
    current: function () { return current; },
    /** LecLive.on('status', cb(status, client)) / LecLive.on('change', cb(change, client)) — any client. */
    on: function (evt, cb) { return globalBus.on(evt, cb); },
    off: function (evt, cb) { globalBus.off(evt, cb); },
    /** Current docs of the most recently created client. */
    store: function (col, opts) { return current ? current.store(col, opts) : (col === 'state' ? defaultState() : []); },
    onChange: function (col, cb) {
      return globalBus.on('change', function (change, client) {
        if (client !== current) return;
        if (col === '*') cb(change);
        else if (col === 'state' && change.type === 'state') cb(client.state, change);
        else if (change.col === col || change.type === 'reset') cb(client.store(col), change);
      });
    },
    mask: function (text, cfg) { return makeMasker(cfg)(text); },
    error: LiveError,
    util: {
      uid: uid, sleep: sleep, jitter: jitter, backoff: backoff, assign: assign, clone: clone, sha256: sha256, sha256sync: function (s) { return sha256js(utf8(String(s))); },
      loadScript: loadScript, cleanText: cleanText, toCsv: toCsv, csvGuard: csvGuard, hasLink: hasLink, linkless: linkless, exportTable: exportTable, fmtTime: fmtTime, Emitter: Emitter,
      storage: { local: local, session: session }, isHidden: isHidden, pollDelay: pollDelay, normCode: normCode, defaultState: defaultState, hashStr: hashStr,
      fields: FIELDS, normWord: normWord, wordCloud: wordCloud, banned: makeBanned, zonedMs: zonedMs, completionColumns: COMPLETION_COLS.slice(), ext: ext,
    },
  };
  root.LecLive = api;
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
`,c=`/*! lecpage live — provider 'http': HTTP protocol v1 (Cloudflare Worker or the Node server).
 * Transport: WebSocket → SSE → polling (snapshot?since). Each realtime try gets 4 s to say hello.
 * Heartbeats, reconnect with jittered backoff, resync on every reconnect, slower polling in hidden tabs,
 * and upgrade attempts while polling (3 → 6 → 12 → 30 min apart, none while hidden). A transport that keeps failing is skipped for 10 minutes.
 * Polling (학교망: 웹소켓·SSE가 막힘) is a long-poll when the server holds \`snapshot?since=&wait=20\` until something changes
 * (lecpage 바로 공개 서버). A server that answers at once is detected after two quick empty answers and polled on an interval instead.
 * The server's \`X-Lec-Poll-Ms\` is the lower bound of the gap between polls (busy free-plan days ask for 10–20 s).
 * Server down: two network failures in a row while polling → 'offline' (the page shows its "server unreachable" line;
 * writes wait in the queue), and a reconnect only falls back to polling when the server answers over HTTP — so a dead
 * server is never shown as "polling", and its realtime failures are not held against WebSocket. When the server is
 * back, polling resumes and WebSocket is tried again within ~10 s (then on the usual 3 → 6 → 12 → 30 min schedule).
 * config: { url, code, pollMs?, transports?: ['ws','sse','poll'], longPoll?: false, waitS?: 20 }
 */
(function (root) {
  'use strict';
  var L = root.LecLive;
  if (!L || !L.register) return;
  var U = L.util;
  var CONNECT_TIMEOUT = 4000;
  var WAIT_S = 20; // 긴 대기: 서버가 바뀔 때까지 붙잡는 최대 초(서버 상한 25초 안)

  L.register('http', function (config, ctx) {
    var code = U.normCode(config.code);
    var base = String(config.url || '').trim().replace(/\\/+$/, '');
    if (!/\\/api$/.test(base)) base += '/api';
    var prefix = base + '/' + encodeURIComponent(code);
    var abs = (function () { try { return new URL(prefix, root.location ? root.location.href : undefined).href; } catch (e) { return prefix; } })();
    var origin = (function () { try { return new URL(abs).origin; } catch (e) { return ''; } })();
    var order = (config.transports || ['ws', 'sse', 'poll']).filter(function (t) { return t === 'ws' || t === 'sse' || t === 'poll'; });
    if (order.indexOf('poll') < 0) order.push('poll');
    var pollMs = Math.min(60000, Math.max(2000, Number(config.pollMs) || 5000));
    var WAIT = Math.min(25, Math.max(1, Number(config.waitS) || WAIT_S));
    var ss = U.storage.session; var skipKey = ctx.storage.ns + ':skip';
    var handlers = [];
    var a = { status: 'offline' };
    var kind = null, ws = null, es = null;
    var timers = {};
    var lastMsg = 0, openedAt = 0, attempt = 0, closed = true, pollErr = 0, emptyPolls = 0, netErr = 0;
    // 긴 대기: null 아직 모름 · true 서버가 붙잡아 줌 · false 바로 답하는 서버(간격 묻기). quick: 붙잡지 않은 빈 답이 이어진 수
    var longOk = config.longPoll === false ? false : null, quick = 0, lpFail = 0, hintMs = 0, every = 0, upgradeN = 0, lpCtl = null;
    var authBad = false; // the server refused the admin key on the socket: stop resending it until setAdmin()

    function emit(evt) { var r; handlers.forEach(function (h, i) { try { var x = h(evt); if (i === 0) r = x; } catch (e) { /* isolate */ } }); return r; }
    function setStatus(s, mode) { if (a.status === s) return; a.status = s; emit({ type: 'status', status: s, mode: mode }); }
    function clear(name) { if (timers[name]) { clearTimeout(timers[name]); clearInterval(timers[name]); timers[name] = null; } }
    function skipped(t) { var s = ss.get(skipKey) || {}; return s[t] && s[t] > Date.now(); }
    function markFail(t) {
      var f = a['_fails_' + t] = (a['_fails_' + t] || 0) + 1;
      if (f >= 3) { var s = ss.get(skipKey) || {}; s[t] = Date.now() + 10 * 60000; ss.set(skipKey, s); a['_fails_' + t] = 0; }
    }

    // ---------------------------------------------------------------- requests
    function request(method, path, opts) {
      opts = opts || {};
      var headers = {};
      var token = opts.noToken ? null : ctx.token(); var admin = opts.admin || ctx.adminKey();
      if (token) headers['X-Lec-Token'] = token;
      if (admin) headers['X-Lec-Admin'] = encodeURIComponent(admin); // headers must be Latin-1 (Korean keys)
      var body;
      if (opts.form) body = opts.form;
      else if (opts.body !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(opts.body); }
      var ctl = typeof AbortController === 'function' ? new AbortController() : null;
      if (opts.ctl) opts.ctl(ctl);
      var to = setTimeout(function () { if (ctl) ctl.abort(); }, opts.timeout || 12000);
      return fetch(prefix + path, { method: method, headers: headers, body: body, signal: ctl ? ctl.signal : undefined, cache: 'no-store', credentials: 'omit', mode: 'cors' })
        .then(function (res) {
          clearTimeout(to);
          readHint(res);
          if (opts.text && res.ok) return res.text();
          return res.text().then(function (txt) {
            var data = null; try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = null; }
            if (!res.ok) {
              var ra = Number(res.headers.get('Retry-After')) || (data && data.retryAfter) || 0;
              throw L.error((data && data.error) || 'http_' + res.status, (data && data.message) || '서버 오류(' + res.status + ')', { status: res.status, retryAfter: ra, detail: data });
            }
            return data;
          });
        }, function (e) {
          clearTimeout(to);
          throw L.error(e && e.name === 'AbortError' ? 'timeout' : 'network', '서버에 연결하지 못했어요.', { status: 0, retryable: true });
        });
    }
    /** 서버의 묻기 간격 권고(X-Lec-Poll-Ms): 붐비는 날 길게. 2~60초만 받음 */
    function readHint(res) {
      var h = 0; try { h = Number(res.headers.get('X-Lec-Poll-Ms')) || 0; } catch (e) { h = 0; }
      if (h >= 2000 && h <= 60000 && h !== hintMs) { hintMs = h; if (kind === 'poll') emit({ type: 'net' }); }
    }
    function absUrl(u) { return u && u.charAt(0) === '/' ? origin + u : u; }
    // Servers store board files as '/api/<code>/files/<name>' (their own uploads only); show them from this server.
    function fixDoc(d) {
      if (d && Array.isArray(d.files)) d.files = d.files.map(function (f) { return f && typeof f.url === 'string' && f.url.indexOf('/api/') === 0 ? U.assign({}, f, { url: absUrl(f.url) }) : f; });
      return d;
    }
    function fixList(list) { if (Array.isArray(list)) list.forEach(fixDoc); return list; }

    // ---------------------------------------------------------------- realtime transports
    function onMessage(raw) {
      lastMsg = Date.now();
      if (raw === 'pong') return null;
      var m; try { m = JSON.parse(raw); } catch (e) { return null; }
      if (!m || typeof m !== 'object') return null;
      if (m.type === 'hello') { emit({ type: 'hello', now: m.now }); return m; }
      if (m.type === 'auth') {
        // an expired instructor session: send the key on this socket instead
        if (m.ok === false && m.error === 'session_expired' && ctx.dropSession) {
          ctx.dropSession(); var k0 = ctx.adminKey();
          if (k0 && ws && ws.readyState === 1) { try { ws.send(JSON.stringify({ type: 'auth', admin: k0 })); } catch (e) { /* closed */ } }
          return m;
        }
        if (m.ok === false) {
          authBad = true;
          emit({ type: 'error', error: L.error(m.error || 'admin_required', m.message || '관리자 키가 맞지 않아요.', { status: m.error === 'rate_limited' ? 429 : 403, retryAfter: m.retryAfter || 0 }) });
        }
        return m;
      }
      if (m.type === 'ping' || m.type === 'pong') return m;
      if (m.col === 'posts' && m.doc) fixDoc(m.doc);
      emit(m);
      return m;
    }
    function tryWs() {
      return new Promise(function (resolve, reject) {
        if (typeof root.WebSocket !== 'function') return reject(new Error('no ws'));
        var url = abs.replace(/^http/, 'ws') + '/ws';
        var s; var done = false;
        try { s = new root.WebSocket(url); } catch (e) { return reject(e); }
        var t = setTimeout(function () { fail(); }, CONNECT_TIMEOUT);
        function fail() { if (done) return; done = true; clearTimeout(t); try { s.close(); } catch (e) { /* ignore */ } reject(new Error('ws failed')); }
        s.onmessage = function (e) {
          var m = onMessage(typeof e.data === 'string' ? e.data : '');
          if (!done && m && m.type === 'hello') {
            done = true; clearTimeout(t);
            s.onclose = function () { if (ws === s) lost('ws'); };
            s.onerror = function () { /* onclose follows */ };
            resolve(s);
          }
        };
        s.onopen = function () { var k = ctx.adminKey(); if (k && !authBad) s.send(JSON.stringify({ type: 'auth', admin: k })); };
        s.onerror = fail;
        s.onclose = fail;
      });
    }
    function trySse() {
      return new Promise(function (resolve, reject) {
        if (typeof root.EventSource !== 'function') return reject(new Error('no sse'));
        var s; var done = false;
        try { s = new root.EventSource(abs + '/events'); } catch (e) { return reject(e); }
        var t = setTimeout(function () { fail(); }, CONNECT_TIMEOUT);
        function fail() { if (done) return; done = true; clearTimeout(t); try { s.close(); } catch (e) { /* ignore */ } reject(new Error('sse failed')); }
        s.onmessage = function (e) {
          var m = onMessage(e.data);
          if (!done && m && m.type === 'hello') {
            done = true; clearTimeout(t);
            s.onerror = function () { if (es === s) lost('sse'); };
            resolve(s);
          }
        };
        s.onerror = fail;
      });
    }
    function startHeartbeat(k) {
      clear('hb');
      timers.hb = setInterval(function () {
        if (k === 'ws' && ws && ws.readyState === 1) { try { ws.send('ping'); } catch (e) { /* ignore */ } }
        var silent = Date.now() - lastMsg;
        if (silent > (k === 'ws' ? 60000 : 50000)) lost(k);
      }, k === 'ws' ? 25000 : 10000);
      // admins do not get private-collection events over SSE; refresh them slowly
      clear('adminSync');
      if (k === 'sse') timers.adminSync = setInterval(function () { if (ctx.adminKey()) ctx.emit({ type: 'resync' }); }, 15000);
    }
    function stopRealtime() {
      clear('hb'); clear('adminSync');
      if (ws) { var w = ws; ws = null; w.onclose = null; w.onmessage = null; try { w.close(); } catch (e) { /* ignore */ } }
      if (es) { var s = es; es = null; s.onerror = null; s.onmessage = null; try { s.close(); } catch (e) { /* ignore */ } }
    }
    /** Tries transports in order; resolves with the kind that worked ('ws'|'sse'|'poll').
     *  probe: before settling for polling, ask the server over plain HTTP (a reconnect after a drop). If even that
     *  fails the server is down, not the network blocking WebSockets: reject (→ 'offline') and do not count the
     *  realtime failures against WebSocket/SSE. */
    function openBest(realtimeOnly, probe) {
      var list = order.filter(function (t) { return t === 'poll' ? !realtimeOnly : !skipped(t); });
      var i = 0, failed = [];
      function marks() { failed.forEach(markFail); failed = []; }
      function next() {
        if (closed) return Promise.reject(new Error('closed'));
        var t = list[i++];
        if (!t) { if (realtimeOnly) marks(); return Promise.reject(new Error('no transport')); }
        if (t === 'poll') {
          if (!probe) { marks(); return Promise.resolve('poll'); }
          return request('GET', '/state', { timeout: 8000 }).then(function (st) { marks(); if (st) emit({ type: 'state', doc: st }); return 'poll'; });
        }
        return (t === 'ws' ? tryWs() : trySse()).then(function (sock) {
          if (closed) { try { sock.close(); } catch (e) { /* ignore */ } throw new Error('closed'); }
          stopRealtime(); stopPolling();
          if (t === 'ws') ws = sock; else es = sock;
          kind = t; openedAt = lastMsg = Date.now();
          startHeartbeat(t);
          setStatus('live', 'realtime');
          return t;
        }, function () { failed.push(t); return next(); });
      }
      return next().then(function (t) { if (t === 'poll') startPolling(); return t; });
    }
    function lost(k) {
      if (closed || kind !== k) return;
      if (Date.now() - openedAt < 30000) markFail(k);
      stopRealtime();
      kind = null;
      setStatus('connecting');
      attempt++;
      clear('reconnect');
      timers.reconnect = setTimeout(reconnect, U.backoff(Math.min(attempt - 1, 5), 1000, U.isHidden() ? 30000 : 8000));
    }
    function reconnect() {
      if (closed) return;
      openBest(false, true).then(function () { attempt = 0; ctx.emit({ type: 'resync' }); }, function () {
        if (closed) return;
        setStatus('offline');
        // 화면을 보고 있으면 10초 안쪽으로 다시(서버가 돌아오면 곧 이어짐), 숨긴 탭은 1분까지 늘림
        timers.reconnect = setTimeout(reconnect, U.backoff(Math.min(attempt++, 5), 2000, U.isHidden() ? 60000 : 10000));
      });
    }

    // ---------------------------------------------------------------- polling
    function startPolling() {
      stopRealtime();
      kind = 'poll'; pollErr = 0; netErr = 0; emptyPolls = 0; quick = 0; lpFail = 0; upgradeN = 0;
      setStatus('polling', 'polling');
      emit({ type: 'net' });
      schedulePoll(pollMs);
      scheduleUpgrade();
    }
    /** 실시간으로 다시 올라가 보기: 3분 → 6분 → 12분 → 30분 간격(시도마다 서버 요청 1~2개라 학교망에서는 드물게), 숨겨진 화면에서는 하지 않음 */
    function scheduleUpgrade() {
      clear('upgrade');
      if (order[0] === 'poll' || closed) return;
      timers.upgrade = setTimeout(function () {
        if (kind !== 'poll' || closed) return;
        if (U.isHidden()) return scheduleUpgrade();
        upgradeN++;
        openBest(true).then(function () { clear('upgrade'); ctx.emit({ type: 'resync' }); }, function () { if (kind === 'poll') scheduleUpgrade(); });
      }, Math.min(30, 3 * Math.pow(2, upgradeN)) * 60000);
    }
    function stopPolling() { clear('poll'); clear('upgrade'); var c = lpCtl; lpCtl = null; if (c) { try { c.abort(); } catch (e) { /* ignore */ } } }
    function schedulePoll(ms) { clear('poll'); every = ms; timers.poll = setTimeout(pollOnce, ms); }
    /** 긴 대기 한 번: 바뀐 것이 있으면 바로, 없으면 WAIT초 뒤에 답이 옴. 결과는 동기화 차례를 붙잡지 않게 'snapshot' 사건으로 넘김 */
    function longPoll() {
      var t0 = Date.now();
      return request('GET', '/snapshot?since=' + encodeURIComponent(ctx.cursor() || 0) + '&wait=' + WAIT, { timeout: (WAIT + 10) * 1000, ctl: function (c) { lpCtl = c; } })
        .then(function (snap) {
          lpCtl = null; lpFail = 0;
          if (snap) { snap.time = snap.now; fixList(snap.posts); }
          var r = ctx.emit({ type: 'snapshot', doc: snap }) || { changes: 0 };
          var held = Date.now() - t0 >= Math.max(WAIT * 700, WAIT * 1000 - 3000); // 서버가 실제로 붙잡았는지
          if (!r.changes && !held) { if (++quick >= 2 && longOk !== false) { longOk = false; emit({ type: 'net' }); } }
          else { quick = 0; if (held && longOk !== true) { longOk = true; emit({ type: 'net' }); } }
          return r;
        }, function (e) {
          lpCtl = null;
          // 오래 붙잡은 요청을 망(프록시)이 끊으면 간격 묻기로. 서버가 아예 닿지 않는 것은 그다음 묻기가 가림
          if (kind === 'poll' && !closed && e && (e.code === 'timeout' || e.code === 'network') && ++lpFail >= 2 && longOk !== false) { longOk = false; emit({ type: 'net' }); }
          return { changes: 0, error: e };
        });
    }
    function pollOnce() {
      if (closed || kind !== 'poll') return;
      var useLong = longOk !== false && !U.isHidden() && (ctx.cursor() || 0) > 0, t0 = Date.now();
      Promise.resolve(useLong ? longPoll() : ctx.emit({ type: 'resync' })).then(function (r) {
        if (closed || kind !== 'poll') return;
        if (r && r.error) {
          pollErr++;
          // the server did not answer at all (not an HTTP error): two in a row → offline. A long-poll cut after a while
          // is a proxy on the way (handled by longOk), not a dead server
          var net = !r.error.status && (r.error.code === 'network' || r.error.code === 'timeout') && (!useLong || Date.now() - t0 < 3000);
          netErr = net ? netErr + 1 : 0;
          if (pollErr >= 3 || netErr >= 2) setStatus('offline');
        } else {
          var back = a.status === 'offline';
          if (pollErr) setStatus('polling', 'polling');
          pollErr = 0; netErr = 0;
          emptyPolls = r && r.changes ? 0 : emptyPolls + 1;
          // back after an outage: try realtime again soon (the outage may have been the server, not the network)
          if (back && order[0] !== 'poll') { upgradeN = 0; clear('upgrade'); timers.upgrade = setTimeout(function () { if (kind === 'poll' && !closed && !U.isHidden()) openBest(true).then(function () { clear('upgrade'); ctx.emit({ type: 'resync' }); }, function () { if (kind === 'poll') scheduleUpgrade(); }); else scheduleUpgrade(); }, U.jitter(8000, 0.3)); }
        }
        // 긴 대기는 쉬는 틈만(바뀐 것이 오면 그 틈 동안 모아 다음 대기에서 받음). 간격 묻기는 바뀐 것 없이 이어지면 늘림
        var ms = useLong && !pollErr && longOk !== false ? Math.max(pollMs, hintMs || 0) : netErr ? Math.min(30000, 4000 * netErr) : U.pollDelay(pollMs, { err: pollErr, empty: emptyPolls, hint: hintMs, admin: !!ctx.adminKey() });
        schedulePoll(U.jitter(ms, 0.15));
      });
    }
    function onVisible() {
      if (closed || U.isHidden()) return;
      if (kind === 'poll') { if (!lpCtl) schedulePoll(50); }
      else if (kind && Date.now() - lastMsg > 60000) lost(kind);
      else if (!kind && timers.reconnect) { clear('reconnect'); reconnect(); } // 끊긴 채 숨겼던 탭: 돌아오면 바로 다시
    }
    function onOnline() { if (!closed && a.status === 'offline') { clear('reconnect'); attempt = 0; reconnect(); } }

    // ---------------------------------------------------------------- adapter API (contract §5)
    a.subscribe = function (h) { handlers.push(h); return function () { handlers = handlers.filter(function (x) { return x !== h; }); }; };
    a.connect = function () {
      closed = false;
      setStatus('connecting');
      // Probe first so a dead server is reported as offline instead of "polling".
      return request('GET', '/state', { timeout: 8000 }).then(function (st) {
        if (st) emit({ type: 'state', doc: st });
        if (root.document && !a._hooked) {
          a._hooked = true;
          root.document.addEventListener('visibilitychange', onVisible);
          if (root.addEventListener) root.addEventListener('online', onOnline);
        }
        return openBest(false);
      }).then(function (t) { return { mode: t === 'poll' ? 'polling' : 'realtime', transport: t }; }, function (e) {
        setStatus('offline');
        throw e;
      });
    };
    a.close = function () {
      closed = true; stopRealtime(); stopPolling(); clear('reconnect'); kind = null;
      setStatus('offline');
    };
    a.transport = function () { return kind; };
    /** 강사 화면의 '묻기 방식' 한 줄: transport 'ws'|'sse'|'long'|'poll', every 다음 묻기까지(ms), hint 서버 권고(ms) */
    a.netInfo = function () {
      var t = kind === 'poll' ? (longOk === false || U.isHidden() ? 'poll' : 'long') : kind;
      return { transport: t, every: kind === 'poll' ? every : 0, wait: t === 'long' ? WAIT : 0, hint: hintMs, longOk: longOk };
    };
    a.setAdmin = function (key) { authBad = false; if (ws && ws.readyState === 1 && key) ws.send(JSON.stringify({ type: 'auth', admin: key })); };
    /** ① the admin key → an instructor session { session, expiresAt } (POST /session); older servers answer 404 */
    a.adminSession = function (key) { return request('POST', '/session', { body: {}, admin: key, noToken: true, timeout: 8000 }); };
    a.join = function (p) { return request('POST', '/join', { body: p }); };
    a.snapshot = function (o) {
      return request('GET', '/snapshot?since=' + encodeURIComponent((o && o.since) || 0)).then(function (s) { if (s) { s.time = s.now; fixList(s.posts); } return s; });
    };
    a.list = function (col, o) { return request('GET', '/' + encodeURIComponent(col) + '?since=' + encodeURIComponent((o && o.since) || 0)).then(fixList); };
    a.add = function (col, doc) { return request('POST', '/' + encodeURIComponent(col), { body: doc }).then(fixDoc); };
    a.update = function (col, id, patch) { return request('PATCH', '/' + encodeURIComponent(col) + '/' + encodeURIComponent(id), { body: patch }).then(fixDoc); };
    a.remove = function (col, id) { return request('DELETE', '/' + encodeURIComponent(col) + '/' + encodeURIComponent(id)).then(function () { return true; }); };
    a.vote = function (id) { return request('POST', '/questions/' + encodeURIComponent(id) + '/vote', { body: {} }); };
    a.like = function (id) { return request('POST', '/posts/' + encodeURIComponent(id) + '/like', { body: {} }); };
    a.getState = function () { return request('GET', '/state'); };
    a.setState = function (patch) { return request('PUT', '/state', { body: patch }); };
    a.react = function (emoji) { return request('POST', '/react', { body: { emoji: emoji }, timeout: 5000 }).then(function () { return true; }); };
    a.upload = function (file) {
      var fd = new FormData(); fd.append('file', file, file.name || 'file');
      return request('POST', '/upload', { form: fd, timeout: 180000 }).then(function (r) { r.url = absUrl(r.url); return r; });
    };
    a.checkAdmin = function () {
      // without the participant token: a token alone would read its own record and look like success
      if (!ctx.adminKey()) return Promise.resolve(false);
      return request('GET', '/participants?since=9000000000000', { noToken: true }).then(function () { return true; }, function (e) { if (e.status === 401 || e.status === 403) return false; throw e; });
    };
    a.exportCsv = function (kindName, opts) {
      var q = '?kind=' + encodeURIComponent(kindName);
      if (kindName === 'completion' && opts) ['date', 'start', 'end', 'rate', 'stations'].forEach(function (k) { if (opts[k] != null && opts[k] !== '') q += '&' + k + '=' + encodeURIComponent(opts[k]); });
      if (kindName === 'completion' && opts && opts.survey) q += '&survey=1';
      return request('GET', '/export.csv' + q, { text: true });
    };
    a.purge = function () { return request('DELETE', '').then(function () { return true; }); };
    return a;
  });
})(typeof window !== 'undefined' ? window : globalThis);
`,u=`/*! lecpage live — provider 'local': no server. Tabs of one browser sync through BroadcastChannel
 * (or \`storage\` events where BroadcastChannel is missing) and localStorage. For previews, demos and rehearsal.
 * Admin actions are always allowed here (single device). Data stays in this browser only.
 */
(function (root) {
  'use strict';
  var L = root.LecLive;
  if (!L || !L.register) return;
  var U = L.util;
  var PUBLIC = L.publicCols;

  L.register('local', function (config, ctx) {
    var code = U.normCode(config.code || 'DEMO');
    var P = 'lecLive:local:' + code + ':';
    var ls = U.storage.local;
    var tabId = U.uid(8);
    var handlers = [];
    var chan = null;
    var adapter = { status: 'offline' };

    function emit(evt) { handlers.forEach(function (h) { try { h(evt); } catch (e) { /* isolate */ } }); }
    function err(code, msg, status) { return L.error(code, msg, { status: status || 400, retryable: false }); }
    function stamp() {
      var last = ls.get(P + 'stamp') || 0;
      var t = Math.max(Date.now(), last + 1);
      ls.set(P + 'stamp', t);
      return t;
    }
    function key(col, id) { return P + 'd:' + col + ':' + id; }
    function readCol(col) {
      return ls.keys(P + 'd:' + col + ':').map(function (k) { return ls.get(k); }).filter(Boolean);
    }
    function outDoc(col, d) {
      if (!d) return d;
      var o = U.clone(d);
      if (col === 'questions') delete o.by;
      delete o._token;
      return o;
    }
    function broadcast(evt) {
      var msg = { src: tabId, evt: evt };
      if (chan) { try { chan.postMessage(msg); } catch (e) { /* ignore */ } }
      else ls.set(P + 'evt', { n: U.uid(6), m: msg });
      emit(evt);
    }
    function onRemote(msg) {
      if (!msg || msg.src === tabId || !msg.evt) return;
      emit(msg.evt);
    }
    function me() {
      var t = ctx.token();
      var id = t ? ls.get(P + 't:' + t) : null;
      var p = id ? ls.get(key('participants', id)) : null;
      if (!p) throw L.error('invalid_token', '참여 정보가 없어요. 다시 참여해 주세요.', { status: 401, retryable: false });
      return p;
    }
    function save(col, doc, type) {
      ls.set(key(col, doc.id), doc);
      ls.del(P + 'tomb:' + col + ':' + doc.id);
      broadcast({ type: type, col: col, doc: outDoc(col, doc) });
      return outDoc(col, doc);
    }

    adapter.subscribe = function (h) { handlers.push(h); return function () { handlers = handlers.filter(function (x) { return x !== h; }); }; };
    adapter.connect = function () {
      if (!chan && typeof root.BroadcastChannel === 'function') {
        try { chan = new root.BroadcastChannel('lecLive:local:' + code); chan.onmessage = function (e) { onRemote(e.data); }; } catch (e) { chan = null; }
      }
      if (!chan && root.addEventListener && !adapter._storageHooked) {
        adapter._storageHooked = true;
        root.addEventListener('storage', function (e) {
          if (e.key !== P + 'evt' || !e.newValue) return;
          try { onRemote(JSON.parse(e.newValue).m); } catch (x) { /* ignore */ }
        });
      }
      adapter.status = 'live';
      emit({ type: 'status', status: 'live', mode: 'local' });
      return Promise.resolve({ mode: 'local' });
    };
    adapter.close = function () { if (chan) { try { chan.close(); } catch (e) { /* ignore */ } chan = null; } adapter.status = 'offline'; };
    adapter.join = function (p) {
      var now = stamp(); var id = 'p' + U.uid(12); var token = U.uid(16) + U.uid(16);
      var doc = { id: id, nickname: p.nickname || '참가자', name: p.name || '', school: p.school || '', consentAt: p.consent ? now : null, createdAt: now, updatedAt: now };
      if ((doc.name || doc.school) && !p.consent) return Promise.reject(err('consent_required', '이름·소속을 남기려면 개인정보 수집·이용에 동의해 주세요.'));
      if ((adapter._state().ui || {}).lockJoin === true) return Promise.reject(err('locked', '지금은 새로 참여할 수 없어요. 강사에게 알려 주세요.', 409));
      ls.set(P + 't:' + token, id);
      save('participants', doc, 'add');
      return Promise.resolve({ id: id, token: token, nickname: doc.nickname });
    };
    adapter.snapshot = function (opts) {
      var since = (opts && opts.since) || 0;
      var now = ls.get(P + 'stamp') || 0;
      var out = { state: adapter._state(), now: now, time: Date.now(), since: since, full: !since, removed: [] };
      var cols = opts && opts.admin ? L.cols : PUBLIC;
      cols.forEach(function (c) { out[c] = readCol(c).filter(function (d) { return d.updatedAt > since; }).map(function (d) { return outDoc(c, d); }); });
      if (!(opts && opts.admin)) {
        var mine = null; try { mine = me().id; } catch (e) { /* not joined */ }
        if (mine) ['attendance', 'survey'].forEach(function (c) { out[c] = readCol(c).filter(function (d) { return d.by === mine && d.updatedAt > since; }); });
      }
      if (since) out.removed = ls.keys(P + 'tomb:').map(function (k) { var t = ls.get(k); return t && t.at > since ? { col: t.col, id: t.id } : null; }).filter(Boolean);
      return Promise.resolve(out);
    };
    adapter.list = function (col, opts) {
      var since = (opts && opts.since) || 0;
      return Promise.resolve(readCol(col).filter(function (d) { return d.updatedAt > since; }).map(function (d) { return outDoc(col, d); }));
    };
    adapter._state = function () { return U.assign(U.defaultState(), ls.get(P + 'state') || {}); };
    adapter.getState = function () { return Promise.resolve(adapter._state()); };
    adapter.setState = function (patch) {
      var cur = adapter._state();
      var next = U.assign({}, cur, patch || {});
      if (patch && patch.ui) next.ui = U.assign({}, cur.ui || {}, patch.ui);
      next.updatedAt = stamp();
      ls.set(P + 'state', next);
      broadcast({ type: 'state', doc: next });
      return Promise.resolve(next);
    };
    adapter.add = function (col, doc) {
      return Promise.resolve().then(function () {
        if (L.cols.indexOf(col) < 0) throw err('unknown_collection', '없는 컬렉션이에요.', 404);
        // 강사 명단(실제 서버와 같은 규칙): 손으로 더한 사람, 입실·퇴실 시각 넣기·고치기
        if (col === 'participants' || (col === 'attendance' && doc.by != null)) {
          if (!ctx.adminKey()) throw err(col === 'participants' ? 'use_join' : 'admin_required', col === 'participants' ? '참가자는 참여하기로 만들어요.' : '관리자 키가 필요해요.', col === 'participants' ? 405 : 401);
          var t0 = stamp();
          if (col === 'participants') {
            if (!doc.name) throw err('required', '이름을 적어 주세요.');
            if (doc.consent !== true) throw err('consent_required', '이름·소속을 남기려면 개인정보 수집·이용에 동의해 주세요.');
            return save('participants', { id: 'p' + U.uid(12), nickname: doc.nickname || String(doc.name).slice(0, 20), name: doc.name, school: doc.school || '', consentAt: t0, manual: true, createdAt: t0, updatedAt: t0 }, 'add');
          }
          if (!ls.get(key('participants', doc.by))) throw err('not_found', '없는 참가자예요.', 404);
          var at = typeof doc.at === 'number' && doc.at > 0 && doc.at <= Date.now() + 60e3 ? doc.at : Date.now();
          var prev = readCol('attendance').filter(function (x) { return x.by === doc.by && x.kind === doc.kind; })[0];
          if (prev) return save('attendance', U.assign({}, prev, { at: at, byHost: true, updatedAt: t0 }), 'update');
          return save('attendance', { id: 'a' + U.uid(12), by: doc.by, kind: doc.kind === 'out' ? 'out' : 'in', at: at, byHost: true, createdAt: t0, updatedAt: t0 }, 'add');
        }
        var p = col === 'polls' ? null : me();
        var by = p ? p.id : null;
        // 리허설도 실제 서버와 같은 규칙: 강사가 잠근 칸, 닫힌 투표
        var ui = adapter._state().ui || {};
        if ((col === 'questions' && ui.lockQa === true) || (col === 'posts' && ui.lockBoard === true)) throw err('locked', col === 'questions' ? '지금은 질문을 받지 않아요. 강사가 다시 열면 보낼 수 있어요.' : '지금은 보드에 글을 받지 않아요. 강사가 다시 열면 올릴 수 있어요.', 409);
        if (col === 'answers') { var pl = ls.get(key('polls', doc.poll)); if (pl && pl.open === false) throw err('poll_closed', '투표가 닫혔어요.', 409); }
        if (doc.cid) {
          var dup = readCol(col).filter(function (d) { return d.cid === doc.cid && d.by === by; })[0];
          if (dup) return outDoc(col, dup);
        }
        var now = stamp();
        var d = U.assign({}, doc, { createdAt: now, updatedAt: now });
        if (by) d.by = by;
        var match = null;
        if (col === 'progress') { d.at = now; match = function (x) { return x.by === by && x.station === d.station; }; }
        if (col === 'attendance') { d.at = now; match = function (x) { return x.by === by && x.kind === d.kind; }; }
        if (col === 'answers') match = function (x) { return x.by === by && x.poll === d.poll; };
        if (col === 'survey') match = function (x) { return x.by === by; };
        if (col === 'questions') U.assign(d, { anonymous: d.anonymous !== false, votes: 0, status: 'open', pinned: false, nickname: d.anonymous === false ? p.nickname : '' });
        if (col === 'posts') U.assign(d, { likes: 0, hidden: !!(config.moderation || (adapter._state().ui || {}).moderation), nickname: p.nickname, files: d.files || [] });
        if (col === 'chat') U.assign(d, { nickname: p.nickname, hidden: false });
        if (col === 'help') U.assign(d, { nickname: p.nickname, status: 'open', assignee: '' });
        if (col === 'polls') d.open = !!d.open;
        var old = match ? readCol(col).filter(match)[0] : null;
        if (old && col === 'attendance' && old.at) d.at = d.kind === 'in' ? Math.min(old.at, d.at) : Math.max(old.at, d.at); // the first check-in stays
        if (old) { d = U.assign({}, old, d, { id: old.id, createdAt: old.createdAt }); return save(col, d, 'update'); }
        d.id = col.charAt(0) + U.uid(12);
        return save(col, d, 'add');
      });
    };
    adapter.update = function (col, id, patch) {
      return Promise.resolve().then(function () {
        var cur = ls.get(key(col, id));
        if (!cur) throw err('not_found', '지워진 글이에요. 새로 고침해 주세요.', 404);
        var next = U.assign({}, cur, patch || {}, { id: id, updatedAt: stamp() });
        if (col === 'participants' && patch && patch.consent === true && !cur.consentAt) next.consentAt = next.updatedAt;
        delete next.consent;
        return save(col, next, 'update');
      });
    };
    adapter.remove = function (col, id) {
      ls.del(key(col, id));
      ls.set(P + 'tomb:' + col + ':' + id, { col: col, id: id, at: stamp() });
      ls.keys(P + 'v:' + col + ':' + id + ':').forEach(function (k) { ls.del(k); });
      broadcast({ type: 'remove', col: col, doc: { id: id } });
      return Promise.resolve(true);
    };
    function vote(col, id, field) {
      return Promise.resolve().then(function () {
        var p = me();
        var cur = ls.get(key(col, id));
        if (!cur) throw err('not_found', '지워진 글이에요. 새로 고침해 주세요.', 404);
        var vk = P + 'v:' + col + ':' + id + ':' + p.id;
        if (ls.get(vk)) { var r0 = {}; r0[field] = cur[field] || 0; r0.already = true; return r0; }
        ls.set(vk, 1);
        var n = ls.keys(P + 'v:' + col + ':' + id + ':').length;
        var next = U.assign({}, cur); next[field] = n; next.updatedAt = stamp();
        save(col, next, 'update');
        var r = {}; r[field] = n; r.voted = true; return r;
      });
    }
    adapter.vote = function (id) { return vote('questions', id, 'votes'); };
    adapter.like = function (id) { return vote('posts', id, 'likes'); };
    adapter.react = function (emoji) { broadcast({ type: 'reaction', doc: { emoji: emoji, count: 1 } }); return Promise.resolve(true); };
    adapter.upload = function (file) {
      return new Promise(function (resolve, reject) {
        var meta = { name: file.name || 'file', type: file.type || 'application/octet-stream', size: file.size };
        if (file.size <= 300 * 1024 && root.FileReader) {
          var fr = new FileReader();
          fr.onload = function () { resolve(U.assign(meta, { url: String(fr.result) })); };
          fr.onerror = function () { reject(err('read_failed', '파일을 읽지 못했어요.')); };
          fr.readAsDataURL(file);
        } else if (root.URL && URL.createObjectURL) {
          resolve(U.assign(meta, { url: URL.createObjectURL(file), localOnly: true }));
        } else reject(err('unsupported', '이 브라우저는 미리보기 파일을 지원하지 않아요.', 501));
      });
    };
    adapter.checkAdmin = function () { return Promise.resolve(true); };
    adapter.exportCsv = function (kind, opts) {
      var data = {}; L.cols.forEach(function (c) { data[c] = readCol(c).sort(function (a, b) { return a.createdAt - b.createdAt; }); });
      var t = U.exportTable(kind, data, undefined, opts);
      return Promise.resolve(U.toCsv(t.columns, t.rows));
    };
    adapter.purge = function () {
      ls.keys(P).forEach(function (k) { ls.del(k); });
      broadcast({ type: 'reset' });
      return Promise.resolve(true);
    };
    return adapter;
  });
})(typeof window !== 'undefined' ? window : globalThis);
`,f=`/*! lecpage live — provider 'sheets': Google Apps Script web app (backends/apps-script/Code.gs).
 * GET for public reads, POST with Content-Type text/plain (a "simple request": no CORS preflight, which
 * Apps Script cannot answer). No push channel: polls the snapshot every pollMs (default 7 s, 5–60 s),
 * backs off on errors and in hidden tabs. Writes are serialised on the server with LockService.
 * config: { url: 'https://script.google.com/macros/s/…/exec', code, pollMs? }
 */
(function (root) {
  'use strict';
  var L = root.LecLive;
  if (!L || !L.register) return;
  var U = L.util;

  L.register('sheets', function (config, ctx) {
    var code = U.normCode(config.code);
    var url = String(config.url || '').trim();
    var pollMs = Math.min(60000, Math.max(5000, Number(config.pollMs) || 7000));
    var maxUploadMb = Number(config.maxUploadMb) || 10;
    var handlers = [];
    var a = { status: 'offline' };
    var timers = {};
    var closed = true, pollErr = 0, emptyPolls = 0, rs = 0, epoch = null, every = pollMs;

    function emit(evt) { var r; handlers.forEach(function (h, i) { try { var x = h(evt); if (i === 0) r = x; } catch (e) { /* isolate */ } }); return r; }
    function setStatus(s, mode) { if (a.status === s) return; a.status = s; emit({ type: 'status', status: s, mode: mode }); }
    function clear(n) { if (timers[n]) { clearTimeout(timers[n]); timers[n] = null; } }

    function unwrap(p) {
      return p.then(function (res) {
        if (!res.ok) throw L.error('http_' + res.status, 'Apps Script 오류(' + res.status + ')', { status: res.status >= 500 ? 503 : res.status });
        return res.text();
      }, function () {
        throw L.error('network', '구글 시트 서버에 연결하지 못했어요.', { status: 0 });
      }).then(function (txt) {
        var j; try { j = JSON.parse(txt); } catch (e) { throw L.error('bad_response', '웹 앱 응답이 JSON이 아니에요. 배포 설정(액세스: 모든 사용자)을 확인해 주세요.', { status: 502, retryable: false }); }
        if (!j || !j.ok) throw L.error((j && j.error) || 'error', (j && j.message) || '오류', { status: (j && j.status) || 500, retryAfter: j && j.retryAfter });
        return j.data;
      });
    }
    function get(params) {
      var q = Object.keys(params).filter(function (k) { return params[k] != null; }).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); }).join('&');
      return unwrap(fetch(url + (url.indexOf('?') >= 0 ? '&' : '?') + q, { method: 'GET', redirect: 'follow', cache: 'no-store', credentials: 'omit' }));
    }
    function post(body) {
      body.code = code;
      return unwrap(fetch(url, { method: 'POST', redirect: 'follow', credentials: 'omit', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) }));
    }
    function writeDone(x) { schedulePoll(1500); return x; } // pick up other people's changes soon after mine

    // ---------------------------------------------------------------- polling
    function schedulePoll(ms) { if (closed) return; clear('poll'); timers.poll = setTimeout(pollOnce, ms); }
    function pollOnce() {
      timers.poll = null;
      if (closed) return;
      Promise.resolve(ctx.emit({ type: 'resync' })).then(function (r) {
        if (closed) return;
        if (r && r.error) { pollErr++; if (pollErr >= 3) setStatus('offline'); }
        else { if (pollErr || a.status !== 'polling') setStatus('polling', 'polling'); pollErr = 0; emptyPolls = r && r.changes ? 0 : emptyPolls + 1; }
        // 묻기 간격 규칙은 core의 pollDelay 한 곳(숨겨진 화면 1분, 바뀐 것 없이 이어지면 늘림). 예전 core에서는 그대로
        var ms = U.pollDelay ? U.pollDelay(pollMs, { err: pollErr, empty: emptyPolls, admin: !!ctx.adminKey() }) : pollErr ? Math.min(60000, pollMs * Math.pow(2, pollErr)) : U.isHidden() ? Math.max(30000, pollMs * 3) : emptyPolls > 8 ? Math.min(pollMs + 3000, 10000) : pollMs;
        every = ms;
        schedulePoll(U.jitter(ms, 0.2));
      });
    }
    function onVisible() { if (!closed && !U.isHidden()) schedulePoll(100); }

    // ---------------------------------------------------------------- adapter API (contract §5)
    a.subscribe = function (h) { handlers.push(h); return function () { handlers = handlers.filter(function (x) { return x !== h; }); }; };
    a.connect = function () {
      closed = false;
      if (!/^https:\\/\\/script\\.google(usercontent)?\\.com\\//.test(url) && !config.allowAnyUrl) return Promise.reject(L.error('config', 'Apps Script 웹 앱 주소(https://script.google.com/…/exec)가 필요해요.', { status: 400, retryable: false }));
      setStatus('connecting');
      return get({ a: 'ping' }).then(function () {
        if (root.document && !a._hooked) { a._hooked = true; root.document.addEventListener('visibilitychange', onVisible); }
        setStatus('polling', 'polling');
        schedulePoll(pollMs);
        return { mode: 'polling' };
      }, function (e) { setStatus('offline'); throw e; });
    };
    a.close = function () { closed = true; Object.keys(timers).forEach(clear); setStatus('offline'); };
    a.netInfo = function () { return { transport: 'poll', every: every }; };
    a.join = function (p) { return post({ a: 'join', nickname: p.nickname || '', name: p.name || '', school: p.school || '', consent: !!p.consent }); };
    a.snapshot = function (o) {
      var since = (o && o.since) || 0;
      var job = ctx.adminKey() || ctx.token()
        ? post({ a: 'snapshot', since: since, rs: rs, token: ctx.token() || undefined, admin: ctx.adminKey() || undefined })
        : get({ a: 'snapshot', code: code, since: since, rs: rs });
      return job.then(function (s) {
        if (s && s.reactions && rs) s.reactions.forEach(function (r) { emit({ type: 'reaction', doc: { emoji: r.emoji, count: r.count } }); });
        if (s && s.reactionsAt) rs = s.reactionsAt;
        if (s && s.epoch != null) {
          // the sheet was wiped (purge): forget everything and reload
          if (epoch !== null && s.epoch !== epoch) { epoch = s.epoch; setTimeout(function () { ctx.emit({ type: 'reset' }); }, 0); }
          epoch = s.epoch;
        }
        return s;
      });
    };
    a.list = function (col, o) { return a.snapshot({ since: (o && o.since) || 0 }).then(function (s) { return (s && s[col]) || []; }); };
    a.add = function (col, doc) { return post({ a: 'add', col: col, doc: doc, token: ctx.token(), admin: col === 'polls' ? ctx.adminKey() : undefined }).then(writeDone); };
    a.update = function (col, id, patch) { return post({ a: 'update', col: col, id: id, patch: patch, token: ctx.token(), admin: ctx.adminKey() || undefined }).then(writeDone); };
    a.remove = function (col, id) { return post({ a: 'remove', col: col, id: id, admin: ctx.adminKey() }).then(function () { return true; }); };
    a.vote = function (id) { return post({ a: 'vote', id: id, token: ctx.token() }); };
    a.like = function (id) { return post({ a: 'like', id: id, token: ctx.token() }); };
    a.getState = function () { return get({ a: 'state', code: code }); };
    a.setState = function (patch) { return post({ a: 'setState', patch: patch, admin: ctx.adminKey() }); };
    a.react = function (emoji) { return post({ a: 'react', emoji: emoji, token: ctx.token() }).then(function () { return true; }); };
    a.upload = function (file) {
      if (file.size > maxUploadMb * 1048576) return Promise.reject(L.error('too_large', '구글 시트 방식은 ' + maxUploadMb + 'MB까지 올릴 수 있어요.', { status: 413, retryable: false }));
      return new Promise(function (resolve, reject) {
        var fr = new FileReader();
        fr.onload = function () { resolve(String(fr.result).split(',')[1] || ''); };
        fr.onerror = function () { reject(L.error('read_failed', '파일을 읽지 못했어요.', { status: 400, retryable: false })); };
        fr.readAsDataURL(file);
      }).then(function (b64) { return post({ a: 'upload', name: file.name || 'file', type: file.type, data: b64, token: ctx.token() }); });
    };
    a.checkAdmin = function () { return post({ a: 'checkAdmin', admin: ctx.adminKey() || '' }).then(function (ok) { return ok === true; }); };
    /** ① the admin key → an instructor session { session, expiresAt } (older scripts answer bad_action) */
    a.adminSession = function (key) { return post({ a: 'session', admin: key }); };
    a.exportCsv = function (kind, opts) {
      // 'completion' needs the course times, which the sheet does not know: build it from the admin snapshot here
      if (kind === 'completion') return post({ a: 'snapshot', since: 0, admin: ctx.adminKey() }).then(function (s) { var t = U.exportTable(kind, s || {}, undefined, opts); return U.toCsv(t.columns, t.rows); });
      return post({ a: 'export', kind: kind, admin: ctx.adminKey() });
    };
    a.purge = function () { return post({ a: 'purge', admin: ctx.adminKey() }).then(function () { return true; }); };
    return a;
  });
})(typeof window !== 'undefined' ? window : globalThis);
`,m=`/*! lecpage live — provider 'supabase' (backends/supabase/schema.sql).
 * supabase-js v2 is loaded lazily from a pinned jsDelivr URL. Only the anon/publishable key is used and
 * Supabase Auth is NOT used (anonymous sign-in is rate limited per IP; a school NAT would be blocked).
 *  - writes: SECURITY DEFINER RPCs with the participant token (or admin key) as an argument
 *  - reads: lec_snapshot (RLS by the x-lec-code header) with a rev cursor
 *  - realtime: public Broadcast channels lec:<CODE> (and lec:<CODE>:adm for the console) carry throttled
 *    "tick" messages only; on a tick the client fetches rows newer than its cursor. Anyone with the publishable key
 *    can send to a public channel, so a payload is only a hint: resyncs are throttled (and back off while hints bring
 *    nothing new) and reaction counts come from lec_reactions(), never from the payload.
 *  - files: the bucket is private; posts carry a Storage path and the client asks for 1-hour signed URLs (re-signed
 *    by a full resync every 45 minutes). The console deletes trashed files (removed posts, purge, retention).
 *  - fallback: polling the snapshot every pollMs (default 7 s) when the realtime socket cannot connect.
 *  - 라이브러리 주소(cdn.jsdelivr.net)가 막힌 망: supabase-js 없이 같은 RPC·Storage REST를 fetch로 부르는 작은 클라이언트(lite)로
 *    묻기만 함(실시간 없음). 참여 기능은 그대로 됨.
 * config: { url: 'https://<ref>.supabase.co', anonKey, code, pollMs? }
 */
(function (root) {
  'use strict';
  var L = root.LecLive;
  if (!L || !L.register) return;
  var U = L.util;
  var LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.js';
  // Subresource Integrity for LIB (sha384 of that exact file); the loader refuses remote scripts without one.
  var LIB_SRI = 'sha384-TcHRA3zBbn+Lexh5n+Oil4guNPOS3rjNDpGRAN46u/s/mB2IZ50ceC6TYDU2yvgK';
  var BUCKET = 'lec-uploads';

  /** supabase-js를 불러오지 못했을 때: rpc·파일(서명 주소·올리기·지우기)만 REST로. 머리글은 supabase-js와 같게(apikey·Authorization·x-lec-code) */
  function lite(url, key, code) {
    var base = String(url || '').replace(/\\/+$/, '');
    function hdr(extra) { return U.assign({ apikey: key, Authorization: 'Bearer ' + key, 'x-lec-code': code }, extra || {}); }
    function call(path, init) {
      return fetch(base + path, U.assign({ cache: 'no-store', credentials: 'omit', mode: 'cors' }, init)).then(function (res) {
        return res.text().then(function (t) {
          var d = null; try { d = t ? JSON.parse(t) : null; } catch (e) { d = t; }
          if (res.ok) return { data: d, error: null, status: res.status };
          return { data: null, error: d && typeof d === 'object' ? U.assign({ statusCode: res.status }, d) : { message: String(d || res.status), statusCode: res.status }, status: res.status };
        });
      });
    }
    var enc = function (p) { return String(p).split('/').map(encodeURIComponent).join('/'); };
    return {
      lite: true,
      rpc: function (name, args) { return call('/rest/v1/rpc/' + name, { method: 'POST', headers: hdr({ 'Content-Type': 'application/json', Accept: 'application/json' }), body: JSON.stringify(args || {}) }); },
      storage: {
        from: function (bucket) {
          return {
            createSignedUrls: function (paths, exp) {
              return call('/storage/v1/object/sign/' + bucket, { method: 'POST', headers: hdr({ 'Content-Type': 'application/json' }), body: JSON.stringify({ expiresIn: exp, paths: paths }) }).then(function (r) {
                if (r.error) return r;
                return { data: (r.data || []).map(function (x) { return x && U.assign({}, x, { signedUrl: x.signedURL ? base + '/storage/v1' + x.signedURL : null }); }), error: null };
              });
            },
            upload: function (path, file, o) { return call('/storage/v1/object/' + bucket + '/' + enc(path), { method: 'POST', headers: hdr({ 'Content-Type': (o && o.contentType) || 'application/octet-stream', 'cache-control': 'max-age=' + ((o && o.cacheControl) || 300), 'x-upsert': 'false' }), body: file }); },
            remove: function (paths) { return call('/storage/v1/object/' + bucket, { method: 'DELETE', headers: hdr({ 'Content-Type': 'application/json' }), body: JSON.stringify({ prefixes: paths }) }); },
          };
        },
      },
      removeChannel: function () { }, removeAllChannels: function () { },
    };
  }

  L.register('supabase', function (config, ctx) {
    var code = U.normCode(config.code);
    var pollMs = Math.min(60000, Math.max(3000, Number(config.pollMs) || 7000));
    var handlers = [];
    var a = { status: 'offline' };
    var sb = null, chan = null, admChan = null;
    var timers = {};
    var realtimeOk = false, closed = true, pollErr = 0, emptyPolls = 0, every = pollMs;
    var reactBuf = {};
    var hint = { gap: 1500, last: 0, full: false }; // resync hints from ticks: min gap, doubled while they bring nothing
    var rx = null, rxAt = 0;                        // last reaction batch seen (lec_reactions)
    var signed = {};                                // storage path → { url, exp }
    var sweptAt = 0;

    function emit(evt) { var r; handlers.forEach(function (h, i) { try { var x = h(evt); if (i === 0) r = x; } catch (e) { /* isolate */ } }); return r; }
    function setStatus(s, mode) { if (a.status === s) return; a.status = s; emit({ type: 'status', status: s, mode: mode }); }
    function clear(n) { if (timers[n]) { clearTimeout(timers[n]); clearInterval(timers[n]); timers[n] = null; } }

    function toError(error, status) {
      var c = String((error && error.code) || '');
      var st = /^PT\\d{3}$/.test(c) ? Number(c.slice(2)) : (status || 0);
      if (!st && c && /^[0-9A-Z]{5}$/.test(c)) st = c === '57014' || c === '53300' ? 503 : 400;
      var msg = (error && (error.hint || error.message)) || '서버 오류';
      if (!st) msg = 'Supabase에 연결하지 못했어요.';
      return L.error(/^PT\\d{3}$/.test(c) ? error.message : (st ? 'error_' + (c || st) : 'network'), msg, { status: st, retryable: !st || st >= 500 || st === 429 });
    }
    function rpc(name, args) {
      if (!sb) return Promise.reject(L.error('not_connected', '아직 연결되지 않았어요.', { status: 0 }));
      return Promise.resolve(sb.rpc(name, args)).then(function (res) {
        if (res.error) throw toError(res.error, res.status);
        var d = res.data;
        if (d && typeof d === 'object' && !Array.isArray(d) && '_flush' in d) { scheduleFlush(d._flush); delete d._flush; }
        return d;
      }, function () { throw L.error('network', 'Supabase에 연결하지 못했어요.', { status: 0 }); });
    }
    // A write inside the throttle window leaves a tick pending; whoever wrote nudges it out a moment later.
    function scheduleFlush(ms) {
      if (!(ms > 0) || timers.flush) return;
      timers.flush = setTimeout(function () {
        timers.flush = null;
        rpc('lec_flush', { p_code: code }).catch(function () { /* next write will flush */ });
      }, ms + 60);
    }

    // ---------------------------------------------------------------- realtime
    /** A resync asked for by a tick. At most one per \`hint.gap\`; the gap doubles (to 30 s) while hints bring nothing
     *  new (forged ticks), and resets once one does. Reads of a full room are spread over ~0.5 s. */
    function hintResync(full) {
      if (full) hint.full = true;
      if (timers.resync) return;
      var wait = Math.max(0, hint.last + hint.gap - Date.now()) + Math.floor(Math.random() * 500);
      timers.resync = setTimeout(function () {
        timers.resync = null; hint.last = Date.now();
        var f = hint.full; hint.full = false;
        Promise.resolve(ctx.emit({ type: 'resync', full: f })).then(function (r) {
          hint.gap = r && r.changes ? 1500 : Math.min(30000, hint.gap * 2);
        });
      }, wait);
    }
    /** Reaction batches: the tick only says "batch rx exists"; the counts come from the database. */
    function fetchReactions() {
      if (timers.rx || !sb) return;
      timers.rx = setTimeout(function () {
        timers.rx = null; rxAt = Date.now();
        rpc('lec_reactions', { p_code: code }).then(function (b) {
          if (!b || typeof b.rx !== 'number') return;
          var fresh = rx !== null && b.rx > rx;
          rx = Math.max(rx || 0, b.rx);
          if (fresh && b.r && typeof b.r === 'object') Object.keys(b.r).forEach(function (e) { emit({ type: 'reaction', doc: { emoji: e, count: Math.min(50, Number(b.r[e]) || 1) } }); });
        }, function () { /* best effort */ });
      }, Math.max(0, rxAt + 1500 - Date.now()) + Math.floor(Math.random() * 300));
    }
    function onTick(p) {
      if (!p || typeof p !== 'object') return;
      // never trust the payload: a "reset" only asks for a (throttled) full reload from the database
      if (p.reset) { hintResync(true); return; }
      if (typeof p.rx === 'number' && (rx === null || p.rx > rx)) fetchReactions();
      if (typeof p.rev === 'number' && p.rev > (Number(ctx.cursor()) || 0)) hintResync(false);
    }
    function join(topic, onLost) {
      if (!sb || typeof sb.channel !== 'function') return Promise.resolve(null); // REST만(lite): 실시간 없이 묻기
      return new Promise(function (resolve) {
        var c = sb.channel(topic, { config: { broadcast: { self: false, ack: false }, private: false } });
        c.on('broadcast', { event: 'tick' }, function (m) { onTick(m && m.payload); });
        var settled = false;
        var t = setTimeout(function () { finish(false); }, 6000);
        function finish(ok) { if (settled) return; settled = true; clearTimeout(t); resolve(ok ? c : null); if (!ok) { try { sb.removeChannel(c); } catch (e) { /* ignore */ } } }
        c.subscribe(function (status) {
          if (status === 'SUBSCRIBED') { if (!settled) finish(true); else onLost(true); }
          else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') { if (!settled) finish(false); else if (!closed) onLost(false); }
        });
      });
    }
    function onPublicState(up) {
      if (closed) return;
      if (up) { realtimeOk = true; stopPolling(); setStatus('live', 'realtime'); ctx.emit({ type: 'resync' }); }
      else { realtimeOk = false; startPolling(); } // supabase-js rejoins by itself; poll meanwhile
    }
    function joinAdmin() {
      if (!sb || admChan || !ctx.adminKey()) return Promise.resolve();
      return join('lec:' + code + ':adm', function () { /* public channel state drives status */ }).then(function (c) { admChan = c; });
    }

    // ---------------------------------------------------------------- files (private bucket, signed URLs)
    function filePath(f) {
      if (!f) return null;
      if (typeof f.path === 'string' && f.path) return f.path;
      var m = /\\/storage\\/v1\\/object\\/(?:public|sign|authenticated)\\/lec-uploads\\/([^?#]+)/.exec(String(f.url || ''));
      try { return m ? decodeURIComponent(m[1]) : null; } catch (e) { return null; }
    }
    /** Fills files[].url of posts with signed URLs (1 h). Paths the database refuses (hidden posts) stay without a URL. */
    function signPosts(list) {
      list = Array.isArray(list) ? list : [];
      var need = {}, now = Date.now();
      list.forEach(function (d) { (d && d.files || []).forEach(function (f) { var p = filePath(f); if (p && !(signed[p] && signed[p].exp - now > 20 * 60000)) need[p] = 1; }); });
      var paths = Object.keys(need);
      var job = paths.length && sb && sb.storage
        ? Promise.resolve(sb.storage.from(BUCKET).createSignedUrls(paths, 3600)).then(function (res) {
          ((res && res.data) || []).forEach(function (x) { var u = x && (x.signedUrl || x.signedURL); if (x && x.path && u && !x.error) signed[x.path] = { url: u, exp: Date.now() + 3600e3 }; });
        }, function () { /* no URL this time */ })
        : Promise.resolve();
      return job.then(function () {
        list.forEach(function (d) {
          if (d && Array.isArray(d.files)) d.files = d.files.map(function (f) { var p = filePath(f); return p ? U.assign({}, f, { path: p, url: signed[p] ? signed[p].url : '' }) : f; });
        });
        if (Object.keys(signed).length && !timers.resign) timers.resign = setTimeout(function () { timers.resign = null; if (!closed) ctx.emit({ type: 'resync', full: true }); }, 45 * 60000);
        return list;
      });
    }
    /** Console only: delete the files the database put in the trash (removed posts, purge, retention). */
    function sweep(force) {
      if (!sb || !ctx.adminKey() || (!force && Date.now() - sweptAt < 60000)) return Promise.resolve();
      sweptAt = Date.now();
      return rpc('lec_trash', { p_code: code, p_admin: ctx.adminKey() }).then(function (r) {
        var paths = (r && r.paths) || []; var jobs = [];
        for (var i = 0; i < paths.length; i += 100) jobs.push(Promise.resolve(sb.storage.from(BUCKET).remove(paths.slice(i, i + 100))));
        return Promise.all(jobs);
      }).then(function () { return true; }, function () { return false; });
    }

    // ---------------------------------------------------------------- polling
    function startPolling() {
      if (timers.poll || closed) return;
      pollErr = 0; emptyPolls = 0;
      setStatus('polling', 'polling');
      schedulePoll(pollMs);
    }
    function stopPolling() { clear('poll'); }
    function schedulePoll(ms) { clear('poll'); timers.poll = setTimeout(pollOnce, ms); }
    function pollOnce() {
      timers.poll = null;
      if (closed || realtimeOk) return;
      Promise.resolve(ctx.emit({ type: 'resync' })).then(function (r) {
        if (closed || realtimeOk) return;
        if (r && r.error) { pollErr++; if (pollErr >= 3) setStatus('offline'); }
        else { if (pollErr) setStatus('polling', 'polling'); pollErr = 0; emptyPolls = r && r.changes ? 0 : emptyPolls + 1; }
        var ms = U.pollDelay ? U.pollDelay(pollMs, { err: pollErr, empty: emptyPolls, admin: !!ctx.adminKey() }) : pollErr ? Math.min(60000, pollMs * Math.pow(2, pollErr)) : U.isHidden() ? Math.max(30000, pollMs * 3) : emptyPolls > 6 ? Math.min(pollMs * 2, 20000) : pollMs;
        every = ms;
        schedulePoll(U.jitter(ms, 0.15));
      });
    }
    function onVisible() { if (!closed && !U.isHidden() && !realtimeOk && a.status !== 'offline') schedulePoll(50); }

    // ---------------------------------------------------------------- adapter API (contract §5)
    a.subscribe = function (h) { handlers.push(h); return function () { handlers = handlers.filter(function (x) { return x !== h; }); }; };
    a.connect = function () {
      closed = false;
      setStatus('connecting');
      if (!config.url || !config.anonKey) return Promise.reject(L.error('config', 'Supabase 주소와 anon 키가 필요해요.', { status: 400, retryable: false }));
      return U.loadScript(LIB, 10000, { integrity: LIB_SRI }).then(function (ok) {
        // 라이브러리가 막히면(학교·회사 망의 CDN 차단) 실시간 없이 REST로 묻기. Supabase 주소 자체가 막혔으면 아래 첫 rpc가 가림
        if (!ok || !root.supabase || !root.supabase.createClient) { if (!sb) sb = lite(config.url, config.anonKey, code); }
        else if (!sb || sb.lite) {
          sb = root.supabase.createClient(config.url, config.anonKey, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
            global: { headers: { 'x-lec-code': code } },
            realtime: { params: { eventsPerSecond: 5 } },
          });
        }
        return rpc('lec_snapshot', { p_code: code, p_since: 9007199254740991 }); // reachability probe, returns state only
      }).then(function (s) {
        if (s && s.state) emit({ type: 'state', doc: s.state });
        if (root.document && !a._hooked) { a._hooked = true; root.document.addEventListener('visibilitychange', onVisible); }
        // baseline for reaction batches (older schemas have no lec_reactions: no reactions then)
        rpc('lec_reactions', { p_code: code }).then(function (b) { if (b && typeof b.rx === 'number' && rx === null) rx = b.rx; }, function () { });
        sweep();
        return join('lec:' + code, onPublicState);
      }).then(function (c) {
        chan = c;
        if (c) { realtimeOk = true; setStatus('live', 'realtime'); return joinAdmin().then(function () { return { mode: 'realtime' }; }); }
        startPolling();
        return { mode: 'polling' };
      }, function (e) { setStatus('offline'); throw e; });
    };
    a.close = function () {
      closed = true; realtimeOk = false;
      Object.keys(timers).forEach(clear);
      if (sb) { try { sb.removeAllChannels(); } catch (e) { /* ignore */ } }
      chan = admChan = null;
      setStatus('offline');
    };
    a.netInfo = function () { return { transport: realtimeOk ? 'realtime' : 'poll', every: realtimeOk ? 0 : every, lib: sb && sb.lite ? 'rest' : 'sdk' }; };
    a.setAdmin = function (key) {
      if (!key && admChan) { try { sb.removeChannel(admChan); } catch (e) { /* ignore */ } admChan = null; }
      if (key) sweep();
      return key ? joinAdmin() : null;
    };
    a.join = function (p) {
      return rpc('lec_join', { p_code: code, p_nickname: p.nickname || '', p_name: p.name || null, p_school: p.school || null, p_consent: !!p.consent });
    };
    function withFiles(s) { return s && s.posts && s.posts.length ? signPosts(s.posts).then(function () { return s; }) : s; }
    a.snapshot = function (o) {
      var since = (o && o.since) || 0;
      if (ctx.adminKey()) return rpc('lec_admin_snapshot', { p_code: code, p_admin: ctx.adminKey(), p_since: since }).then(withFiles);
      return rpc('lec_snapshot', { p_code: code, p_since: since }).then(function (s) {
        if (!ctx.token() || since) return s;
        return rpc('lec_mine', { p_code: code, p_token: ctx.token() }).then(function (m) {
          s.attendance = m.attendance; s.survey = m.survey; s.me = m.me;
          // my own progress/answers/help come back with \`by\` (the public snapshot leaves it out)
          ['progress', 'answers', 'help'].forEach(function (c) {
            if (!Array.isArray(m[c]) || !Array.isArray(s[c])) return;
            var mine = {}; m[c].forEach(function (d) { mine[d.id] = d; });
            s[c] = s[c].map(function (d) { var x = mine[d.id]; delete mine[d.id]; return x || d; }).concat(Object.keys(mine).map(function (k) { return mine[k]; }));
          });
          return s;
        }, function () { return s; });
      }).then(withFiles);
    };
    a.list = function (col, o) {
      return a.snapshot({ since: (o && o.since) || 0 }).then(function (s) { return (s && s[col]) || []; });
    };
    function signDoc(col) { return function (d) { return col === 'posts' && d && d.files ? signPosts([d]).then(function () { return d; }) : d; }; }
    a.add = function (col, doc) { return rpc('lec_add', { p_code: code, p_token: ctx.token() || null, p_col: col, p_doc: doc, p_admin: col === 'polls' ? ctx.adminKey() : null }).then(signDoc(col)); };
    a.update = function (col, id, patch) { return rpc('lec_update', { p_code: code, p_token: ctx.token() || null, p_admin: ctx.adminKey() || null, p_col: col, p_id: String(id), p_patch: patch }).then(signDoc(col)); };
    a.remove = function (col, id) {
      return rpc('lec_remove', { p_code: code, p_admin: ctx.adminKey() || null, p_col: col, p_id: String(id) }).then(function () { if (col === 'posts') sweep(true); return true; });
    };
    a.vote = function (id) { return rpc('lec_vote', { p_code: code, p_token: ctx.token(), p_id: String(id) }); };
    a.like = function (id) { return rpc('lec_like', { p_code: code, p_token: ctx.token(), p_id: String(id) }); };
    a.getState = function () { return rpc('lec_snapshot', { p_code: code, p_since: 9007199254740991 }).then(function (s) { return s.state; }); };
    a.setState = function (patch) { return rpc('lec_set_state', { p_code: code, p_admin: ctx.adminKey() || null, p_patch: patch }); };
    a.react = function (emoji) {
      // one RPC per second per person at most; the database adds the counts into the next tick
      reactBuf[emoji] = (reactBuf[emoji] || 0) + 1;
      if (!timers.react) timers.react = setTimeout(function () {
        timers.react = null;
        var counts = reactBuf; reactBuf = {};
        rpc('lec_react', { p_code: code, p_token: ctx.token(), p_counts: counts }).catch(function () { /* best effort */ });
      }, 1000);
      return Promise.resolve(true);
    };
    a.upload = function (file) {
      var type = file.type || '';
      return rpc('lec_upload_ticket', { p_code: code, p_token: ctx.token(), p_name: file.name || 'file', p_type: type, p_size: file.size }).then(function (t) {
        return Promise.resolve(sb.storage.from(t.bucket || BUCKET).upload(t.path, file, { contentType: type, upsert: false, cacheControl: '300' })).then(function (res) {
          if (res.error) throw L.error('upload_failed', '파일을 올리지 못했어요: ' + (res.error.message || ''), { status: Number(res.error.statusCode) || 0 });
          // private bucket: the post keeps the path; readers get a signed URL once the post is visible
          return { path: t.path, url: '', name: t.name || file.name, type: type, size: file.size };
        });
      });
    };
    a.checkAdmin = function () { return rpc('lec_check_admin', { p_code: code, p_admin: ctx.adminKey() || '' }).then(function (ok) { return ok === true; }); };
    /** ① the admin key → an instructor session { session, expiresAt }; schemas without lec_admin_session simply fail */
    a.adminSession = function (key) { return rpc('lec_admin_session', { p_code: code, p_admin: key }); };
    a.exportCsv = function (kind, opts) {
      // lec_export returns the whole admin snapshot; 'completion' is built from it here (no schema change needed)
      return rpc('lec_export', { p_code: code, p_admin: ctx.adminKey() || null, p_kind: kind === 'completion' ? 'attendance' : kind }).then(function (data) {
        var t = U.exportTable(kind, data, undefined, opts);
        return U.toCsv(t.columns, t.rows);
      });
    };
    a.purge = function () {
      return rpc('lec_purge', { p_code: code, p_admin: ctx.adminKey() || null }).then(function (r) {
        var files = (r && r.files) || [];
        var jobs = [];
        for (var i = 0; i < files.length; i += 100) jobs.push(Promise.resolve(sb.storage.from(BUCKET).remove(files.slice(i, i + 100))));
        // whatever is left (a closed tab, a failed request) is deleted the next time the console connects (lec_trash)
        return Promise.all(jobs).then(function () { return sweep(true); }, function () { return sweep(true); }).then(function () { return true; });
      });
    };
    return a;
  });
})(typeof window !== 'undefined' ? window : globalThis);
`,h=`/* lecpage screen — 발표 화면: 교재 쪽(강사 화면·참가자 화면과 같은 쪽, 리모컨·키보드로 넘김), 키 하나로 겹쳐 띄우기
 * (J 참여 QR · V 투표 · Q 질문 · T 큰 타이머 · N 공지 · B 화면 숨기기 · Esc 교재로), 참여 QR, 공지, 큰 타이머, 신호등, 인기 질문, 투표 결과, 반응.
 * 프로젝터·뒷자리에서 읽히게 크게, 넓은 화면에서는 한 화면에 들어가게(넘치는 질문은 개수로만 알림).
 * 참가자가 쓴 글은 textContent로만 넣고, 글 속 주소는 '(링크)'로 가림(프로젝터에 비친 주소가 공식 안내처럼 보이지 않게).
 * '도구'(이름 뽑기·모둠 만들기·타이머 여러 개)는 실시간 연결 없이도 이 화면 안에서 동작합니다(기록은 이 기기에만). */
(function () {
  'use strict';
  var doc = document, root = doc.documentElement, $ = function (s, r) { return (r || doc).querySelector(s); };
  var DATA = {}, BP = {};
  try { DATA = JSON.parse($('#lp-data').textContent); BP = JSON.parse($('#lp-blueprint').textContent); } catch (e) { }
  function el(tag, cls, text) { var n = doc.createElement(tag); if (cls) n.className = cls; if (text !== undefined && text !== null) n.textContent = text; return n; }
  function btn(text, cls, fn) { var b = el('button', 'lp-btn lp-btn-sm ' + (cls || 'lp-btn-ghost'), text); b.type = 'button'; if (fn) b.addEventListener('click', fn); return b; }
  var RM = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var NS = (DATA.key || 'lp') + ':screen:';
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(NS + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(NS + k, JSON.stringify(v)); } catch (e) { } }
  };
  var tt; function toast(m) { var t = $('[data-toast]'); if (!t) return; t.textContent = m; t.classList.add('is-on'); clearTimeout(tt); tt = setTimeout(function () { t.classList.remove('is-on'); }, 2600); }
  function rnd(n) { try { var a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; } catch (e) { return Math.floor(Math.random() * n); } }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = rnd(i + 1), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function mmss(ms) { var s = Math.round(ms / 1000), a = Math.abs(s); return (s < 0 ? '-' : '') + Math.floor(a / 60) + ':' + String(a % 60).padStart(2, '0'); }
  /** 참가자 글을 발표 화면에 쓸 때: 주소 가리기 + 길이 자르기(긴 글은 강사 화면에서 다 보임) */
  function shown(s, max) {
    var t = String(s || ''); if (window.LecLive && LecLive.util.linkless) t = LecLive.util.linkless(LecLive.util.cleanText(t, 0, true), '(링크)');
    var c = Array.from ? Array.from(t) : t.split(''); return c.length > max ? c.slice(0, max).join('').replace(/\\s+\\S*$/, '') + '…' : t;
  }

  // 밝게·어둡게: 강의실 조명에 맞춰(참가자 화면과 같은 저장 값)
  var tb = $('[data-theme-toggle]');
  if (tb) tb.addEventListener('click', function () {
    var cur = root.getAttribute('data-theme'), dark = cur === 'dark' || (cur !== 'light' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
    root.setAttribute('data-theme', dark ? 'light' : 'dark'); try { localStorage.setItem('lp-theme', dark ? 'light' : 'dark'); } catch (e) { }
  });
  // 전체 화면
  var scr = $('[data-screen]'), fs = $('[data-fullscreen]');
  function goFull() { return doc.documentElement.requestFullscreen().catch(function () { toast('전체 화면을 열지 못했어요. 브라우저의 F11을 눌러 주세요.'); }); }
  if (fs) {
    if (!doc.documentElement.requestFullscreen) fs.hidden = true;
    else {
      fs.addEventListener('click', function () { if (doc.fullscreenElement) doc.exitFullscreen(); else goFull(); });
      doc.addEventListener('fullscreenchange', function () {
        var on = !!doc.fullscreenElement; fs.setAttribute('aria-pressed', String(on)); var s = fs.querySelector('span'); if (s) s.textContent = on ? '전체 화면 끝' : '전체 화면';
        if (scr) { if (on) scr.setAttribute('data-full', ''); else scr.removeAttribute('data-full'); } idle();
      });
    }
  }
  // 전체 화면에서는 위 버튼을 숨겼다가 마우스를 움직이거나 키보드로 오면 다시 보임(프로젝터에는 내용만)
  var idleT = 0;
  function idle() {
    if (!scr) return; clearTimeout(idleT); scr.removeAttribute('data-idle');
    if (scr.hasAttribute('data-full') || scr.getAttribute('data-view') === 'deck') idleT = setTimeout(function () { scr.setAttribute('data-idle', ''); }, 2500);
  }
  ['mousemove', 'pointerdown', 'keydown'].forEach(function (t) { doc.addEventListener(t, idle, { passive: true }); });
  // 강사 화면의 [발표 화면 띄우기]로 연 쪽
  // - 프로젝터(Presentation API)로 띄웠으면 받는 쪽: 이미 전체 화면이고 누를 사람이 없어 버튼을 모두 숨김
  // - 새 창으로 열었으면: 프로젝터 쪽으로 끌어다 놓고 [전체 화면]을 누르라는 안내 한 번
  var RECEIVER = !!(navigator.presentation && navigator.presentation.receiver);
  if (RECEIVER && scr) scr.setAttribute('data-receiver', '');
  var fsDlg = $('[data-fs-dialog]');
  if (fsDlg) {
    var fsGo = $('[data-fs-go]', fsDlg);
    if (!doc.documentElement.requestFullscreen) fsGo.hidden = true;
    fsGo.addEventListener('click', function () { fsDlg.close(); goFull(); });
    if (!RECEIVER && window.name === 'lp-screen' && !doc.fullscreenElement && doc.documentElement.requestFullscreen && fsDlg.showModal) fsDlg.showModal();
  }

  // ── 참여 QR·주소(파일로 열었거나 미리보기면 안내 문구, 암호 보호면 #k=는 QR에만) ──
  // 손으로 칠 주소는 강사가 넣은 짧은 주소가 있으면 그것을 크게, 원래 주소는 그 아래 작게. QR은 언제나 원래 주소(짧은 주소 서비스가 멈춰도 열림).
  var LOCAL = /^(file|about|blob|data):$/.test(location.protocol);
  // localhost·127.x로 연 발표 화면(강사 노트북에서 Node 서버를 켜고 연 경우): 그 주소는 이 컴퓨터에서만 열려 QR을 찍어도 아무도 못 들어옴.
  // 서버가 같은 와이파이 주소를 알려 주면(/api/lan, 이 컴퓨터에서 온 요청에만) 그 주소를 QR·글자에 쓰고, 모르면 QR 자리에 바꾸는 법을 크게
  var LOOP = !DATA.siteUrl && !LOCAL && /^(localhost|127(?:\\.\\d+){3}|\\[::1\\])$/.test(location.hostname);
  var LOOP_MSG = 'localhost 주소는 이 컴퓨터에서만 열려요. 노트북의 와이파이 주소(예: http://192.168.0.10:8787)로 이 화면을 다시 열면 참가자 QR이 나와요.';
  var ul = $('meta[name="lp-unlock"]');
  function bare(u) { var s = String(u || '').replace(/^https?:\\/\\//, '').replace(/\\/$/, ''); try { return decodeURI(s); } catch (e) { return s; } }
  var siteUrl = '', joinUrl = '', qrUrl = '', fullUrl = '', shortUrl = '', qrMarkup = '';
  // 손으로 칠 주소: 한 줄에 맞춤(fitUrl, 원래 크기의 60%까지 줄임). 안 되면 점·빗금 뒤에서만 줄을 바꿈(조각은 끊지 않음 — 's-'·'lecpage-'에서 끊기지 않게)
  function urlNodes(n, u) {
    n.textContent = ''; n.removeAttribute('data-plain');
    u.replace(/([./])/g, '$1\\n').split('\\n').filter(Boolean).forEach(function (part, i) { if (i) n.appendChild(doc.createElement('wbr')); n.appendChild(el('span', '', part)); });
  }
  /** 참여 주소를 정하고 QR·글자를 그림. lan = 서버가 알려 준 같은 와이파이 주소(http://IP:포트) */
  function setJoin(lan) {
    // /screen.html이든 /screen(확장자 없는 주소)이든 그 폴더(= 참가자 화면)를 가리킴
    var dir = location.pathname.replace(/[^/]*$/, '');
    siteUrl = DATA.siteUrl || (LOCAL ? '' : LOOP ? (lan ? lan + dir : '') : location.origin + dir);
    joinUrl = siteUrl || (LOCAL ? DATA.shortUrl || '' : '');
    qrUrl = siteUrl ? siteUrl.split('#')[0] + (ul && ul.getAttribute('content') ? '#' + ul.getAttribute('content') : '') : '';
    fullUrl = bare(joinUrl); shortUrl = bare(DATA.shortUrl); if (!fullUrl || shortUrl === fullUrl) shortUrl = '';
    qrMarkup = '';
    // 둘레 여백 4칸(QR 규격의 quiet zone)을 그림 안에 넣음
    if (qrUrl && window.qrcode) { try { if (qrcode.stringToBytesFuncs) qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8']; var qq = qrcode(0, 'M'); qq.addData(qrUrl); qq.make(); qrMarkup = qq.createSvgTag({ cellSize: 6, margin: 24, scalable: true }); } catch (e) { } }
    var q = $('[data-qr-join]');
    if (q) {
      q.textContent = '';
      if (qrMarkup) q.innerHTML = qrMarkup;
      else if (!qrUrl) q.appendChild(el('span', 'lp-qr-off', LOOP ? LOOP_MSG : '배포하면 QR이 나와요.'));
      var zb = q.closest('[data-join-zoom]'); if (zb) zb.toggleAttribute('data-loop', LOOP && !qrUrl);
    }
    [].forEach.call(doc.querySelectorAll('[data-join-url]'), function (n) {
      var u = shortUrl || fullUrl;
      if (u) urlNodes(n, u); else { n.textContent = LOOP ? '이 컴퓨터 밖에서는 열리지 않는 주소예요' : '배포하면 여기에 참가자 주소가 나와요.'; n.setAttribute('data-plain', ''); }
    });
    [].forEach.call(doc.querySelectorAll('[data-join-full]'), function (n) { n.hidden = !shortUrl; n.textContent = shortUrl ? fullUrl : ''; });
    var bq = big && $('[data-qr-big]', big); if (bq) bq.textContent = '';
    if (zoom && big) {
      var off = !qrMarkup || !big.showModal;
      zoom.disabled = off; var zt = $('.lp-qr-zoom-t', zoom); if (zt) zt.hidden = off; if (jo) jo.hidden = off;
    }
  }
  function fitUrl(n) {
    if (!n || n.hasAttribute('data-plain') || !n.getClientRects().length) return;
    n.style.fontSize = ''; n.removeAttribute('data-wrap');
    var base = parseFloat(getComputedStyle(n).fontSize) || 16, f = base, min = Math.max(14, base * 0.6);
    while (n.scrollWidth > n.clientWidth + 1 && f > min) { f = Math.max(min, Math.floor(f * 0.93)); n.style.fontSize = f + 'px'; }
    // 많이 줄여도 안 들어가면(좁은 레일) 원래 크기로 두고 점·빗금 뒤에서 줄을 바꿈(작은 한 줄보다 큰 두세 줄이 뒷자리에서 읽힘)
    if (n.scrollWidth > n.clientWidth + 1) {
      n.style.fontSize = ''; n.setAttribute('data-wrap', '');
      // 조각 하나가 칸보다 길면(긴 경로 이름) 그 조각이 들어갈 만큼만 줄이고, 그래도 넘치면 조각 안에서도 끊음
      f = base; while (n.scrollWidth > n.clientWidth + 1 && f > 12) { f = Math.max(12, Math.floor(f * 0.93)); n.style.fontSize = f + 'px'; }
      if (n.scrollWidth > n.clientWidth + 1) n.setAttribute('data-wrap', 'any');
    }
  }
  function fitUrls() { [].forEach.call(doc.querySelectorAll('[data-join-url]'), fitUrl); }
  // QR 크게 보기: 뒷자리에서도 찍히게 화면 가득(QR 한 변은 찍는 거리의 1/10쯤이 필요)
  var zoom = $('[data-join-zoom]'), big = $('[data-joinbig]'), jo = $('[data-join-open]');
  function openBig() { if (!qrMarkup) return; var bq = $('[data-qr-big]', big); if (bq && !bq.firstChild) bq.innerHTML = qrMarkup; if (!big.open) big.showModal(); fitUrl($('[data-join-url]', big)); }
  setJoin('');
  if (zoom && big && big.showModal) {
    zoom.addEventListener('click', openBig); if (jo) jo.addEventListener('click', openBig);
    big.addEventListener('click', function (e) { if (e.target === big) big.close(); });
  }
  if (LOOP && window.fetch) {
    fetch('/api/lan', { cache: 'no-store', credentials: 'omit' }).then(function (r) { return r.ok ? r.json() : {}; }).then(function (j) {
      var u = j && j.urls && j.urls[0];
      if (typeof u === 'string' && /^http:\\/\\/[\\d.]+:\\d+\\/?$/.test(u)) { setJoin(u.replace(/\\/$/, '')); if (typeof fitRail === 'function') fitRail(); fitUrls(); }
    }, function () { });
  }


  // ── 무대: 뽑힌 이름·모둠을 크게 ──
  var stage = $('[data-tool-stage]');
  if (stage) stage.className = 'lp-scr-tool';
  function showStage(title, node) {
    if (!stage) return;
    $('[data-stage-title]', stage).textContent = title;
    var body = $('[data-stage-body]', stage); body.textContent = ''; body.appendChild(node);
    stage.hidden = false; setLobby(); fit();
  }
  if (stage) $('[data-stage-close]', stage).addEventListener('click', function () { stage.hidden = true; setLobby(); fit(); var o = $('[data-tools-open]'); if (o) o.focus(); });

  // ── 도구 서랍 ──
  var drawer = $('[data-tools]'), opener = $('[data-tools-open]');
  function setDrawer(open) {
    if (!drawer) return;
    drawer.hidden = !open; if (opener) opener.setAttribute('aria-expanded', String(open));
    doc.body.classList.toggle('lp-tools-on', open);
    if (open) { var h = $('#lp-tools-h'); if (h) h.focus(); } else if (opener) opener.focus();
  }
  if (drawer && opener) {
    opener.addEventListener('click', function () { setDrawer(drawer.hidden); });
    $('[data-tools-close]', drawer).addEventListener('click', function () { setDrawer(false); });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !drawer.hidden) setDrawer(false); });
  }
  var tbody = drawer && $('[data-tools-body]', drawer);
  var conn = null, X = null, canWrite = false, lastTimers = null;

  // 이름 뽑기: 한 번 뽑힌 사람은 모두 뽑힐 때까지 다시 나오지 않아요
  var namesTa, pickInfo, picked = store.get('picked', []);
  function names() { var seen = {}; return String(namesTa ? namesTa.value : '').split(/[\\n,]+/).map(function (x) { return x.trim().slice(0, 30); }).filter(function (x) { if (!x || seen[x]) return false; seen[x] = 1; return true; }); }
  function pickStatus() { var all = names(), left = all.filter(function (n) { return picked.indexOf(n) < 0; }).length; if (pickInfo) pickInfo.textContent = all.length ? '남은 사람 ' + left + '명 / 전체 ' + all.length + '명' : '이름을 적거나 불러와 주세요.'; }
  function pick() {
    var all = names();
    if (!all.length) { toast('이름 목록을 먼저 적어 주세요.'); namesTa.focus(); return; }
    var left = all.filter(function (n) { return picked.indexOf(n) < 0; });
    if (!left.length) { picked = []; left = all; toast('모두 한 번씩 뽑혔어요. 처음부터 다시 뽑아요.'); }
    var name = left[rnd(left.length)]; picked.push(name); store.set('picked', picked); pickStatus();
    var bigName = el('p', 'lp-pick'); showStage('이름 뽑기', bigName);
    if (RM || all.length < 2) { bigName.textContent = name; return; }
    stage.setAttribute('aria-busy', 'true'); bigName.classList.add('is-rolling');
    var n = 0, iv = setInterval(function () {
      bigName.textContent = all[rnd(all.length)];
      if (++n >= 10) { clearInterval(iv); bigName.textContent = name; bigName.classList.remove('is-rolling'); stage.removeAttribute('aria-busy'); }
    }, 80);
  }
  function makeGroups(k) {
    var all = shuffle(names());
    if (all.length < 2) { toast('이름이 두 명 이상 있어야 모둠을 만들 수 있어요.'); namesTa.focus(); return; }
    k = Math.max(2, Math.min(20, k | 0 || 4, all.length));
    var gs = []; for (var i = 0; i < k; i++) gs.push([]);
    all.forEach(function (nm, i) { gs[i % k].push(nm); });
    store.set('groups', gs);
    var grid = el('div', 'lp-groups');
    gs.forEach(function (g, i) { var c = el('section', 'lp-group'); c.appendChild(el('h3', '', (i + 1) + '모둠 · ' + g.length + '명')); var ulx = el('ul'); g.forEach(function (nm) { ulx.appendChild(el('li', '', nm)); }); c.appendChild(ulx); grid.appendChild(c); });
    showStage('모둠 ' + k + '개', grid);
  }
  function loadNicknames() {
    if (!conn) return;
    conn.list('participants', {}).then(function (a) {
      var nn = (a || []).map(function (p) { return p.nickname; }).filter(Boolean);
      if (!nn.length) return toast('아직 참여한 사람이 없어요.');
      namesTa.value = nn.join('\\n'); store.set('names', namesTa.value); picked = []; store.set('picked', picked); pickStatus(); toast('참가자 별명 ' + nn.length + '명을 불러왔어요.');
    }, function () { toast('참가자 별명은 강사 화면에서 연 발표 화면에서만 불러올 수 있어요.'); });
  }

  // 타이머 여러 개: [{id, label, dur, endsAt, remaining, running}]
  var timers = store.get('timers', []), tStrip = $('[data-timers]'), tList, tIv, overSaid = {};
  function tNow() { return conn && conn.now ? conn.now() : Date.now(); }
  function left(t) { return t.running ? t.endsAt - tNow() : t.remaining; }
  function saveTimers(sync) {
    store.set('timers', timers); drawTimers();
    if (sync && conn && canWrite && X) {
      lastTimers = X.timersValue(timers.map(function (t) { return { label: t.label, endsAt: t.running ? t.endsAt : 0, remaining: t.running ? 0 : t.remaining, running: t.running }; }));
      conn.setState({ ui: { timers: lastTimers } }).catch(function () { canWrite = false; });
    }
  }
  function drawTimers() {
    clearInterval(tIv);
    if (tStrip) {
      tStrip.textContent = ''; tStrip.hidden = !timers.length;
      timers.forEach(function (t) {
        var c = el('div', 'lp-timer-card'); c.setAttribute('role', 'timer'); c.appendChild(el('span', '', t.label)); c.appendChild(el('b')); tStrip.appendChild(c); t._card = c;
      });
    }
    if (tList) {
      tList.textContent = '';
      if (!timers.length) tList.appendChild(el('li', 'lp-small', '타이머를 더하면 화면에 크게 보여요.'));
      timers.forEach(function (t) {
        var li = el('li'); li.appendChild(el('span', '', t.label)); var b = el('b'); li.appendChild(b); t._row = b;
        li.appendChild(btn(t.running ? '멈춤' : '시작', t.running ? '' : 'lp-btn-primary', function () {
          if (t.running) { t.remaining = Math.max(0, t.endsAt - tNow()); t.running = false; } else { if (t.remaining <= 0) t.remaining = t.dur; t.endsAt = tNow() + t.remaining; t.running = true; overSaid[t.id] = 0; }
          saveTimers(true);
        }));
        li.appendChild(btn('처음으로', '', function () { t.running = false; t.remaining = t.dur; overSaid[t.id] = 0; saveTimers(true); }));
        var rm = btn('삭제', '', function () { timers = timers.filter(function (x) { return x !== t; }); saveTimers(true); }); rm.setAttribute('aria-label', t.label + ' 삭제'); li.appendChild(rm);
        tList.appendChild(li);
      });
    }
    tick(); fit(); if (typeof fitRail === 'function') fitRail();
    if (timers.some(function (t) { return t.running; })) tIv = setInterval(tick, 500);
  }
  function tick() {
    timers.forEach(function (t) {
      var l = left(t), txt = mmss(l), over = t.running && l <= 0;
      if (t._card) { t._card.querySelector('b').textContent = txt; t._card.classList.toggle('is-over', over); t._card.classList.toggle('is-paused', !t.running); t._card.setAttribute('aria-label', t.label + (over ? ' 시간이 다 됐어요' : ' 남은 시간 ' + txt)); }
      if (t._row) t._row.textContent = txt;
      if (over && !overSaid[t.id]) { overSaid[t.id] = 1; toast(t.label + ' 시간이 다 됐어요.'); }
    });
  }
  function adoptTimers(st) {
    if (!X) return;
    var raw = (st.ui || {}).timers || null;
    if (raw === lastTimers) return;
    lastTimers = raw;
    timers = X.timers(st).map(function (t, i) { var rem = t.running ? Math.max(0, t.endsAt - tNow()) : t.remaining; return { id: 's' + i + Date.now(), label: t.label || (i + 1) + '번 타이머', dur: rem || 60000, endsAt: t.endsAt, remaining: rem, running: t.running }; });
    store.set('timers', timers); drawTimers();
  }

  function section(title) { var s = el('section', 'lp-tool'); s.appendChild(el('h3', '', title)); tbody.appendChild(s); return s; }
  if (tbody) {
    var s1 = section('이름 뽑기');
    var lab = el('label'); lab.appendChild(el('span', '', '이름 목록(한 줄에 한 명, 쉼표로 나눠도 돼요)'));
    namesTa = el('textarea'); namesTa.rows = 5; namesTa.maxLength = 4000; namesTa.value = store.get('names', ''); lab.appendChild(namesTa); s1.appendChild(lab);
    namesTa.addEventListener('input', function () { store.set('names', namesTa.value); pickStatus(); });
    var r1 = el('div', 'lp-row');
    r1.appendChild(btn('한 명 뽑기', 'lp-btn-primary', pick));
    r1.appendChild(btn('처음부터 다시', '', function () { picked = []; store.set('picked', picked); pickStatus(); toast('뽑은 기록을 지웠어요.'); }));
    if (DATA.live) r1.appendChild(btn('참가자 별명 불러오기', '', loadNicknames));
    s1.appendChild(r1);
    pickInfo = el('p', 'lp-small'); s1.appendChild(pickInfo); pickStatus();

    var s2 = section('모둠 만들기');
    var r2 = el('div', 'lp-row'); var gl = el('label', 'lp-row'); gl.appendChild(el('span', '', '모둠 수')); var gn = el('input'); gn.type = 'number'; gn.min = 2; gn.max = 20; gn.value = store.get('groupCount', 4); gn.style.width = '6em'; gl.appendChild(gn); r2.appendChild(gl);
    gn.addEventListener('change', function () { store.set('groupCount', +gn.value || 4); });
    r2.appendChild(btn('무작위로 나누기', 'lp-btn-primary', function () { makeGroups(+gn.value); }));
    s2.appendChild(r2); s2.appendChild(el('p', 'lp-small', '위 이름 목록을 섞어서 나눠요.'));

    var s3 = section('타이머 여러 개');
    var tf = el('form', 'lp-row'); var tl = el('input'); tl.placeholder = '이름(예: 1모둠)'; tl.maxLength = 12; tl.setAttribute('aria-label', '타이머 이름');
    var tm = el('input'); tm.type = 'number'; tm.min = 1; tm.max = 180; tm.value = 5; tm.style.maxWidth = '5.5em'; tm.setAttribute('aria-label', '분');
    var add = el('button', 'lp-btn lp-btn-primary lp-btn-sm', '추가'); add.type = 'submit';
    tf.appendChild(tl); tf.appendChild(tm); tf.appendChild(el('span', '', '분')); tf.appendChild(add); s3.appendChild(tf);
    tf.addEventListener('submit', function (e) {
      e.preventDefault();
      if (timers.length >= 6) return toast('타이머는 6개까지 둘 수 있어요.');
      var m = Math.max(1, Math.min(180, +tm.value || 5)), dur = Math.round(m * 60000);
      timers.push({ id: 't' + Date.now(), label: tl.value.trim() || (timers.length + 1) + '번 타이머', dur: dur, remaining: dur, endsAt: 0, running: false });
      tl.value = ''; saveTimers(true);
    });
    tList = el('ul', 'lp-tlist'); s3.appendChild(tList);
  }

  // 넓은 화면은 한 화면에 들어가게: 무대가 넘치면 아래 질문부터 덜어 내고 "질문 n개 더"로 알림
  var mainBox = $('[data-screen-main]'), stageBox = $('.lp-scr-stage');
  function fit() {
    if (!mainBox || !stageBox) return;
    var list = mainBox.querySelector('.lp-scr-qs'); if (!list) return;
    var more = mainBox.querySelector('[data-more]'), hiddenN = +(list.getAttribute('data-hidden') || 0);
    if (getComputedStyle(stageBox).overflow !== 'hidden') return; // 좁은 화면은 그냥 내려 읽음
    while (list.children.length > 1 && stageBox.scrollHeight > stageBox.clientHeight + 1) { list.removeChild(list.lastElementChild); hiddenN++; }
    list.setAttribute('data-hidden', String(hiddenN));
    if (more) { more.hidden = !hiddenN; more.textContent = '질문 ' + hiddenN + '개 더 · 강사 화면에서 볼 수 있어요'; }
  }
  // 레일(QR·타이머·신호)이 넘치면 QR만 줄임(넓은 화면에서 한 화면에 다 보이게)
  var side = $('.lp-scr-side'), sideQr = $('.lp-scr-join .lp-qr');
  function fitRail() {
    if (!side || !sideQr) return;
    sideQr.style.width = ''; side.removeAttribute('data-tight'); fitUrls();
    if (getComputedStyle(side).overflow !== 'hidden') return;
    var over = side.scrollHeight - side.clientHeight;
    if (over > 0) sideQr.style.width = Math.max(96, sideQr.getBoundingClientRect().width - over) + 'px';
    // QR을 가장 작게 해도 넘치면 덧말을 빼고 간격을 줄임(그래도 넘치면 QR을 더 줄임)
    if (side.scrollHeight > side.clientHeight + 1) { side.setAttribute('data-tight', ''); var o2 = side.scrollHeight - side.clientHeight; if (o2 > 0) sideQr.style.width = Math.max(72, sideQr.getBoundingClientRect().width - o2) + 'px'; }
  }
  fitRail();
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(fitRail); // 글꼴이 바뀌면 주소 폭도 바뀜
  if (window.ResizeObserver && side) { var sT = 0; new ResizeObserver(function () { clearTimeout(sT); sT = setTimeout(fitRail, 80); }).observe(side); }
  if (window.ResizeObserver && stageBox) { var rT = 0; new ResizeObserver(function () { clearTimeout(rT); rT = setTimeout(function () { if (draw.last) draw(); }, 120); }).observe(stageBox); }

  drawTimers();

  // 로비: 질문·투표가 없을 때(도구 결과도 없을 때) 참여 QR을 화면 높이의 절반쯤으로 크게 + 큰 연수 제목 + 세 단계.
  // 첫 질문·투표가 오면 지금 배치(무대 + 오른쪽 레일)로. 처음 모습은 aux-pages.js가 그려 둠(같은 꼴)
  function setLobby() {
    if (!scr || !mainBox) return;
    var on = !!mainBox.querySelector('.lp-scr-empty') && !(stage && !stage.hidden);
    if (on === scr.hasAttribute('data-lobby')) return;
    if (on) scr.setAttribute('data-lobby', ''); else scr.removeAttribute('data-lobby');
    fitRail();
  }
  function lobbyStage() {
    if (!mainBox.querySelector('.lp-scr-empty')) { // 이미 로비면 다시 그리지 않음(읽어 주기 되풀이 없게)
      var e = el('div', 'lp-scr-empty'), t = el('p', 'lp-scr-lobby-t', DATA.title || ''); t.setAttribute('aria-hidden', 'true'); e.appendChild(t);
      var st = el('ol', 'lp-scr-steps');
      ['QR을 찍어 들어와요', '[질문]에 올려요', '마음에 드는 질문에 공감을 눌러요'].forEach(function (x, i) { var li = el('li'); li.appendChild(el('b', '', String(i + 1))); li.appendChild(el('span', '', x)); st.appendChild(li); });
      e.appendChild(st); mainBox.textContent = ''; mainBox.appendChild(e);
    }
    setLobby();
  }
  // ── 교재 쪽(발표)·겹쳐 띄우기 ──
  // 쪽: 상태 slide(강사 화면·참가자 화면과 같은 번호). 겹쳐 띄우기: 상태 ui.ov('' 교재 · poll · qa · timer · notice · blank), 참여 QR은 ui.qrBig.
  // 이 화면에서 넘기거나 띄우면 관리자 키가 있을 때(강사 화면이 연 창) 상태로 보내고, 없으면 이 화면에서만 바뀜
  var DECK = (Array.isArray(BP.deck) ? BP.deck : []).filter(function (x) { return Array.isArray(x) && +x[0] > 0 && typeof x[1] === 'string'; });
  var deckEl = $('[data-scr-deck]'), dImg = deckEl && $('[data-scr-img]', deckEl), dPg = deckEl && $('[data-scr-pg]', deckEl), ovEl = $('[data-scr-ov]');
  var cur = 0, started = false, ov = '', force = '', rSlide = null, rOv = null, slideAt = 0, ovAt = 0, resyncT = 0, jumpBuf = '', jumpT = 0, ovT = 0, warned = false;
  if (!DECK.length && deckEl) deckEl.hidden = true;
  function st0() { return typeof state === 'object' && state ? state : {}; }
  function push(patch) {
    if (!(conn && canWrite)) { if (DATA.live && !warned) { warned = true; toast('이 화면에서만 바뀌어요. 강사 화면의 [발표 화면 띄우기]로 열면 함께 바뀌어요.'); } return; }
    conn.setState(patch).catch(function () { toast('보내지 못했어요. 이 화면에서만 바뀌어요.'); });
  }
  function showPage(i, send) {
    if (!DECK.length) return;
    cur = Math.max(0, Math.min(DECK.length - 1, i));
    var d = DECK[cur];
    if (dImg && dImg.getAttribute('src') !== d[1]) { dImg.src = d[1]; dImg.alt = '교재 ' + d[0] + '쪽' + (d[2] ? ': ' + d[2] : ''); }
    if (dPg) dPg.textContent = d[0] + ' / ' + DECK[DECK.length - 1][0];
    [cur + 1, cur - 1].forEach(function (k) { if (DECK[k]) { var im = new Image(); im.decoding = 'async'; im.src = DECK[k][1]; } });
    if (send) { started = true; slideAt = Date.now(); rSlide = +d[0]; var pt = { slide: +d[0] }; if (ov) { pt.ui = { ov: null }; } push(pt); }
  }
  function pageIndex(n) { var b = 0; DECK.forEach(function (x, k) { if (Math.abs(+x[0] - n) < Math.abs(+DECK[b][0] - n)) b = k; }); return b; }
  function step(d) {
    if (ov) { setOv('', true); return; } // 겹쳐 띄운 것이 있으면 먼저 교재로(리모컨의 다음 단추로도 닫힘)
    if (big && big.open) { closeQr(); return; }
    if (!started) { if (d > 0) { showPage(0, true); applyOv(); } return; } // 시작 전(참여 안내) → 첫 쪽부터
    showPage(cur + d, true);
  }
  // 첫 쪽을 넘기기 전(상태 slide 0)에는 참여 안내(로비: 큰 QR·제목)를 보이고, 넘기기 시작하면 교재
  function viewOf() { return ov === 'poll' || ov === 'qa' || !DECK.length || !started ? 'live' : 'deck'; }
  /** 겹쳐 띄우기 그리기: 투표·질문은 참여 화면(무대+QR 레일)을, 큰 타이머·공지·가림은 덮개를 */
  function applyOv() {
    force = ov === 'poll' || ov === 'qa' ? ov : '';
    if (scr) { scr.setAttribute('data-view', viewOf()); if (ov) scr.setAttribute('data-ov', ov); else scr.removeAttribute('data-ov'); }
    if (deckEl) deckEl.hidden = viewOf() !== 'deck';
    clearInterval(ovT);
    if (ovEl) {
      var cover = ov === 'timer' || ov === 'notice' || ov === 'blank';
      ovEl.hidden = !cover; ovEl.className = 'lp-scr-ov' + (cover ? ' is-' + ov : ''); ovEl.textContent = '';
      if (ov === 'timer') { ovEl.appendChild(el('p', 'lp-scr-ov-h')); ovEl.appendChild(el('p', 'lp-scr-ov-n')); bigTick(); ovT = setInterval(bigTick, 500); }
      else if (ov === 'notice') { var nt = st0().notice && st0().notice.text; ovEl.appendChild(el('p', nt ? 'lp-scr-ov-t' : 'lp-scr-ov-h', nt || '보낸 공지가 없어요. 강사 화면의 [공지]에서 보내요.')); }
    }
    idle(); if (draw.last) draw(); else drawChrome();
  }
  function setOv(v, send) {
    v = v || ''; if (v === ov && v) v = '';
    ov = v; rOv = v; ovAt = Date.now(); applyOv();
    if (send) push({ ui: { ov: v || null, qrBig: null } });
  }
  function timerNow() { var t = st0().timer; return t && t.running && t.endsAt ? t : null; }
  function bigTick() {
    if (!ovEl || ov !== 'timer') return;
    var t = timerNow(), h = $('.lp-scr-ov-h', ovEl), n = $('.lp-scr-ov-n', ovEl); if (!h || !n) return;
    if (!t) { h.textContent = '돌아가는 타이머가 없어요'; n.textContent = '--:--'; ovEl.removeAttribute('data-over'); return; }
    var l = t.endsAt - tNow(); h.textContent = l <= 0 ? '시간이 다 됐어요' : (t.label ? t.label + ' · 남은 시간' : '남은 시간'); n.textContent = l <= 0 ? '0:00' : mmss(l);
    if (l <= 0) ovEl.setAttribute('data-over', ''); else ovEl.removeAttribute('data-over');
  }
  /** 교재 위의 작은 것: 공지 띠, 오른쪽 아래 타이머 */
  function drawChrome() {
    if (!deckEl) return;
    var nEl = $('[data-scr-dnotice]', deckEl), cEl = $('[data-scr-chip]', deckEl), sn = st0().notice;
    if (nEl) { nEl.hidden = !(sn && sn.text); nEl.textContent = sn && sn.text ? sn.text : ''; }
    if (cEl) {
      var t = timerNow(); cEl.hidden = !t;
      if (t) { var l = t.endsAt - tNow(); cEl.textContent = (t.label ? t.label + ' ' : '') + (l <= 0 ? '끝' : mmss(l)); cEl.toggleAttribute('data-over', l <= 0); }
    }
  }
  setInterval(function () { if (viewOf() === 'deck') drawChrome(); }, 1000);
  /** 상태가 바뀌면(강사 화면·다른 화면에서 넘김) 따라감. 방금 이 화면에서 누른 것은 늦게 온 옛 상태로 되돌리지 않음 */
  function syncDeck() {
    var s1 = st0(), now = Date.now(), freshS = now - slideAt < 800, freshO = now - ovAt < 800, later = false;
    var wasStarted = started;
    if (DECK.length && s1.slide > 0 && +s1.slide !== rSlide) { if (freshS) later = true; else { rSlide = +s1.slide; started = true; showPage(pageIndex(+s1.slide)); } }
    if (started !== wasStarted) { rOv = (s1.ui || {}).ov || ''; ov = rOv; applyOv(); return true; }
    var o = (s1.ui || {}).ov || '';
    // 방금 이 화면에서 바꾼 것은 잠깐 지킴(늦게 온 옛 상태로 되돌지 않게). 그사이 온 다른 변화는 조금 뒤 다시 맞춤
    if (o !== rOv && freshO) later = true;
    if (later) { clearTimeout(resyncT); resyncT = setTimeout(function () { if (draw.last) draw(); else syncDeck(); }, 850); }
    if (o !== rOv && !freshO) { rOv = o; ov = o; applyOv(); return true; }
    if (ov === 'notice' && ovEl) { var tx = $('.lp-scr-ov-t, .lp-scr-ov-h', ovEl), nt = s1.notice && s1.notice.text; if (tx && nt && tx.textContent !== nt) applyOv(); }
    drawChrome();
    return false;
  }
  function closeQr() { if (DATA.live && conn && canWrite && (st0().ui || {}).qrBig) push({ ui: { qrBig: null } }); else if (big && big.open) big.close(); }
  function toggleQr() {
    if (!qrMarkup) return toast(LOOP ? LOOP_MSG : '배포하면 QR이 나와요.');
    if (big && big.open) return closeQr();
    if (conn && canWrite) push({ ui: { qrBig: true, ov: null } }); else openBig();
  }
  if (DECK.length) showPage(0);
  // 위 띠가 보이는 동안 교재 위 공지 띠를 그 아래로(띠 높이는 글꼴·폭에 따라 바뀜)
  var topEl = $('.lp-scr-top');
  if (deckEl && topEl && scr && window.ResizeObserver) new ResizeObserver(function () { scr.style.setProperty('--scr-top-h', topEl.offsetHeight + 'px'); }).observe(topEl);
  applyOv();
  // 키(발표용 리모컨: PageDown·PageUp·→·←, 화면 숨기기 'B'·'.', 시작 F5)
  doc.addEventListener('keydown', function (e) {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    var t = e.target, tag = (t && t.tagName) || '';
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag) || (t && t.isContentEditable)) return;
    if (drawer && !drawer.hidden) return;
    var k = e.key, onCtl = /^(BUTTON|A|SUMMARY)$/.test(tag) && !(t.closest && t.closest('[data-scr-deck]'));
    var keysDlg = $('[data-keys-dialog]');
    if (doc.querySelector('dialog[open]:not([data-joinbig])')) return; // 단축키 안내·전체 화면 안내가 열려 있으면 그 창이 먼저
    if (/^[0-9]$/.test(k) && DECK.length) { jumpBuf = (jumpBuf + k).slice(-4); toast(jumpBuf + '쪽으로 가려면 Enter'); clearTimeout(jumpT); jumpT = setTimeout(function () { jumpBuf = ''; }, 2500); e.preventDefault(); return; }
    if (k === 'Enter' && jumpBuf) { var n = +jumpBuf; jumpBuf = ''; if (ov) setOv('', true); showPage(pageIndex(n), true); applyOv(); e.preventDefault(); return; }
    var go = null;
    switch (k) {
      case 'PageDown': case 'ArrowRight': case 'ArrowDown': go = 1; break;
      case ' ': case 'Enter': if (!onCtl) go = 1; break;
      case 'PageUp': case 'ArrowLeft': case 'ArrowUp': case 'Backspace': go = -1; break;
      case 'Home': if (DECK.length) { showPage(0, true); applyOv(); e.preventDefault(); } return;
      case 'End': if (DECK.length) { showPage(DECK.length - 1, true); applyOv(); e.preventDefault(); } return;
      case 'j': case 'J': if (DATA.live) { toggleQr(); e.preventDefault(); } return;
      case 'v': case 'V': if (DATA.live) { setOv('poll', true); e.preventDefault(); } return;
      case 'q': case 'Q': if (DATA.live) { setOv('qa', true); e.preventDefault(); } return;
      case 't': case 'T': setOv('timer', true); e.preventDefault(); return;
      case 'n': case 'N': if (DATA.live) { setOv('notice', true); e.preventDefault(); } return;
      case 'b': case 'B': case '.': setOv('blank', true); e.preventDefault(); return;
      case 'Escape': if (big && big.open) return; if (ov) { setOv('', true); e.preventDefault(); } return;
      case 'f': case 'F': case 'F5': if (doc.documentElement.requestFullscreen) { if (doc.fullscreenElement) doc.exitFullscreen(); else goFull(); } e.preventDefault(); return;
      case '?': case 'h': case 'H': if (keysDlg && keysDlg.showModal) keysDlg.showModal(); e.preventDefault(); return;
      default: return;
    }
    if (go !== null && (DECK.length || ov || (big && big.open))) { e.preventDefault(); step(go); }
  });
  // 태블릿: 교재를 밀어 넘기기
  if (deckEl) {
    var sx = null;
    deckEl.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
    deckEl.addEventListener('touchend', function (e) { if (sx === null) return; var dx = e.changedTouches[0].clientX - sx; sx = null; if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1); });
  }
  var ko = $('[data-keys-open]'), kd = $('[data-keys-dialog]');
  if (ko && kd && kd.showModal) ko.addEventListener('click', function () { kd.showModal(); }); else if (ko) ko.hidden = true;

  function draw() { draw.last = true; }
  if (!DATA.live || !window.LecLive) return;

  // ── 실시간 ──
  X = LecLive.util.ext;
  var U = LecLive.util;
  var slot = 'lp-admin:' + location.pathname.replace(/[^/]*$/, '') + ':' + DATA.live.code;
  var key = ''; try { key = sessionStorage.getItem(slot) || ''; } catch (e) { } if (!key) { try { key = localStorage.getItem(slot) || ''; } catch (e) { } }
  try { conn = LecLive.create(Object.assign({}, DATA.live, key ? { adminKey: key } : {})); } catch (e) { return; }
  canWrite = DATA.live.provider === 'local' || !!key;
  var state = {}, qs = {}, answers = {}, quick = {}, tiv;
  var polls = []; (BP.sections || []).forEach(function (s) { if (s.type === 'poll' && s.items) polls = polls.concat(s.items); });
  // 연결 상태
  var connEl = $('[data-conn]'), connTx = $('[data-conn-text]');
  function setConn(s) { if (!connEl) return; var lc = DATA.live.provider === 'local'; connEl.setAttribute('data-state', lc && s === 'live' ? 'local' : s); connTx.textContent = { connecting: '연결하는 중…', live: lc ? '리허설' : '연결됨', polling: '연결됨(천천히 묻는 중)', offline: '연결이 끊겼어요 · 다시 잇는 중' }[s] || s; }
  conn.on('status', setConn);
  // 열린 투표: 설계도 문항, 없으면 강사 화면에서 바로 띄운 즉석 투표(polls 모음)
  function openPoll() {
    var p = polls.filter(function (x) { return x.id === state.openPoll; })[0]; if (p) return p;
    var qd = state.openPoll && quick[state.openPoll];
    return qd && qd.question && Array.isArray(qd.options) && qd.options.length ? { id: qd.id, question: qd.question, kind: 'choice', options: qd.options } : null;
  }
  var SIG = [['green', 'g', '✓', '이해했어요'], ['yellow', 'y', '?', '헷갈려요'], ['red', 'r', '!', '모르겠어요']];
  function drawSignal() {
    var box = $('[data-screen-signal]'); if (!box) return;
    var reset = X.signalReset(state), latest = {}, c = { green: 0, yellow: 0, red: 0 }, total = 0;
    Object.keys(answers).forEach(function (k) { var a = answers[k]; if (a.poll !== 'signal') return; var t = a.updatedAt || a.createdAt || 0; if (t < reset) return; var who = a.by || a.id; if (!latest[who] || t >= (latest[who].updatedAt || latest[who].createdAt || 0)) latest[who] = a; });
    Object.keys(latest).forEach(function (k) { var v = latest[k].value; if (c[v] !== undefined) { c[v]++; total++; } });
    box.hidden = !total; box.textContent = ''; if (!total) return;
    var bar = el('div', 'lp-sig'); bar.setAttribute('aria-hidden', 'true');
    SIG.forEach(function (x) { var i = el('i', x[1]); i.style.width = (c[x[0]] / total * 100) + '%'; bar.appendChild(i); });
    var lg = el('ul', 'lp-sig-l');
    SIG.forEach(function (x) { var li = el('li'); var i = el('i', x[1], x[2]); i.setAttribute('aria-hidden', 'true'); li.appendChild(i); li.appendChild(doc.createTextNode(x[3] + ' ')); li.appendChild(el('b', '', String(c[x[0]]))); lg.appendChild(li); });
    box.appendChild(bar); box.appendChild(lg);
  }
  function drawTimer() {
    var t = $('[data-timer]'), v = $('[data-timer-v]', t), h = $('.lp-scr-timer-h', t); clearInterval(tiv);
    if (!(state.timer && state.timer.running && state.timer.endsAt)) { t.hidden = true; return; }
    t.hidden = false;
    var tk = function () {
      var l = state.timer.endsAt - tNow();
      v.textContent = l <= 0 ? '0:00' : mmss(l);
      h.textContent = l <= 0 ? '시간이 다 됐어요' : (state.timer.label ? state.timer.label + ' · 남은 시간' : '남은 시간');
      if (l <= 0) t.setAttribute('data-over', ''); else t.removeAttribute('data-over');
      if (l > 0 && l <= 60000) t.setAttribute('data-soon', ''); else t.removeAttribute('data-soon');
    };
    tk(); tiv = setInterval(tk, 500);
  }
  // 강사 화면의 [참여 QR 크게]: 상태(ui.qrBig)를 따라 QR을 화면 가득 열고 닫음. 이 화면에서 닫으면(관리자 키가 있을 때) 상태도 끔
  var bigByState = false;
  function syncBig() {
    if (!big || !qrMarkup || !big.showModal) return;
    var want = (state.ui || {}).qrBig === true;
    if (want && !big.open) { openBig(); bigByState = true; }
    else if (!want && big.open && bigByState) { bigByState = false; big.close(); }
  }
  if (big) big.addEventListener('close', function () {
    if (bigByState && (state.ui || {}).qrBig === true && canWrite) conn.setState({ ui: { qrBig: null } }).catch(function () { });
    bigByState = false;
  });
  draw = function () {
    draw.last = true;
    if (syncDeck()) return; // 겹쳐 띄우기가 바뀌었으면 applyOv가 다시 그림
    syncBig(); bigTick();
    var n = $('[data-notice]'); if (state.notice && state.notice.text) { n.hidden = false; n.textContent = state.notice.text; } else n.hidden = true;
    drawTimer(); drawSignal(); fitRail();
    var p = force === 'qa' ? null : openPoll();
    var arr = Object.keys(qs).map(function (k) { return qs[k]; }).filter(function (x) { return x.status === 'open' || (x.pinned && x.status !== 'hidden'); }).sort(function (a, b) { return (!!b.pinned - !!a.pinned) || (b.votes || 0) - (a.votes || 0) || (a.createdAt || 0) - (b.createdAt || 0); });
    // V(투표)를 눌렀는데 열린 투표가 없음
    if (force === 'poll' && !p) { mainBox.textContent = ''; setLobby(); var m0 = el('div', 'lp-scr-msg'); m0.appendChild(el('h2', '', '열린 투표가 없어요')); m0.appendChild(el('p', '', '강사 화면에서 투표를 열면 여기에 나와요. Esc를 누르면 교재로 돌아가요.')); mainBox.appendChild(m0); return fit(); }
    // 강사가 고른 질문 하나를 크게(강사 화면의 [발표 화면에 크게])
    var sq = force === 'qa' && (state.ui || {}).q ? qs[state.ui.q] : null;
    if (sq && sq.status !== 'hidden') {
      mainBox.textContent = ''; setLobby();
      var sp = el('div', 'lp-scr-spot'); sp.appendChild(el('p', 'lp-scr-spot-k', '강사가 고른 질문'));
      sp.appendChild(el('p', 'lp-scr-spot-t', shown(sq.text, 280))); sp.appendChild(el('p', 'lp-scr-pmeta', '공감 ' + (sq.votes || 0)));
      mainBox.appendChild(sp); return fit();
    }
    if (!p && !arr.length) { lobbyStage(); return; }
    mainBox.textContent = ''; setLobby();
    if (p) {
      mainBox.appendChild(el('h2', 'lp-scr-pq', shown(p.question, 140)));
      var list = Object.keys(answers).map(function (k) { return answers[k]; }).filter(function (a) { return a.poll === p.id; }), total = list.length;
      // 결과는 강사가 '결과 공개'를 누른 뒤에만(먼저 보이면 다른 사람 답을 따라가게 됨)
      if (X.revealed && !X.revealed(state, p.id)) {
        var w = el('p', 'lp-scr-wait'); w.appendChild(el('b', '', String(total))); w.appendChild(doc.createTextNode('명이 답했어요')); mainBox.appendChild(w);
        mainBox.appendChild(el('p', 'lp-scr-pmeta', '결과는 강사가 공개하면 여기에 보여요.'));
        return fit();
      }
      if (p.kind === 'word') {
        var words = U.wordCloud(list, p.id, { hidden: X.hiddenWords(state) }), top = words.length ? words[0].count : 1;
        var cl = el('div', 'lp-scr-cloud'); words.slice(0, 40).forEach(function (wd) { var s = el('span', '', shown(wd.word, 24)); s.style.fontSize = 'clamp(1.2rem,' + (1 + wd.count / top * 4).toFixed(2) + 'vw + .6rem,' + (2 + wd.count / top * 4.5).toFixed(2) + 'rem)'; cl.appendChild(s); });
        if (!words.length) cl.appendChild(el('p', 'lp-scr-pmeta', '아직 보여 줄 낱말이 없어요.'));
        mainBox.appendChild(cl);
      } else {
        var tally = X.tally(list); // 응답자당 한 표(강사·참가자 화면과 같은 수)
        var opts = (p.options.length ? p.options : Object.keys(tally)).slice(0, 8), best = 0; opts.forEach(function (o) { best = Math.max(best, tally[o] || 0); });
        var bars = el('ol', 'lp-scr-bars'), ai = X.answerOf ? X.answerOf(state, p.id) : -1, right = ai >= 0 ? p.options[ai] : undefined;
        opts.forEach(function (o) {
          var c = tally[o] || 0, pct = Math.round(c / Math.max(total, 1) * 100), r = el('li', 'lp-scr-bar' + (right !== undefined ? (o === right ? ' is-answer' : '') : c && c === best ? ' is-top' : ''));
          var lb = el('span', '', shown(o, 60)); if (o === right) lb.appendChild(el('em', 'lp-scr-ans', '정답')); r.appendChild(lb); var b = el('b', '', pct + '%'); b.appendChild(el('small', '', c + '명')); r.appendChild(b);
          var tr = el('i'); tr.setAttribute('aria-hidden', 'true'); tr.style.setProperty('--w', pct + '%'); r.appendChild(tr); bars.appendChild(r);
        });
        mainBox.appendChild(bars);
      }
      mainBox.appendChild(el('p', 'lp-scr-pmeta', '응답 ' + total + '명'));
      return fit();
    }
    var head = el('div', 'lp-scr-h'); head.appendChild(el('h2', '', '질문')); head.appendChild(el('p', '', '공감이 많은 순 · ' + arr.length + '개')); mainBox.appendChild(head);
    var ulq = el('ol', 'lp-scr-qs');
    arr.slice(0, 6).forEach(function (x) {
      var li = el('li', 'lp-scr-q' + (x.pinned ? ' is-pinned' : ''));
      var v = el('div', 'lp-scr-q-v'); v.appendChild(el('b', '', String(x.votes || 0))); v.appendChild(el('small', '', '공감')); li.appendChild(v);
      var t = el('p', 'lp-scr-q-t'); if (x.pinned) t.appendChild(el('span', 'lp-scr-q-tag', '강사가 고른 질문')); t.appendChild(doc.createTextNode(shown(x.text, 160))); li.appendChild(t);
      ulq.appendChild(li);
    });
    ulq.setAttribute('data-hidden', String(Math.max(0, arr.length - 6)));
    mainBox.appendChild(ulq);
    var more = el('p', 'lp-scr-more'); more.setAttribute('data-more', ''); more.hidden = arr.length <= 6; more.textContent = '질문 ' + Math.max(0, arr.length - 6) + '개 더 · 강사 화면에서 볼 수 있어요'; mainBox.appendChild(more);
    fit();
  };
  function react(e) { var h = $('[data-reactions]'); if (!h || RM) return; var s = el('span', '', e); s.style.left = Math.round(Math.random() * 30) + 'px'; h.appendChild(s); setTimeout(function () { s.remove(); }, 2700); }
  var rq = 0; function redraw() { if (rq) return; rq = (window.requestAnimationFrame || setTimeout)(function () { rq = 0; draw(); }); }
  conn.connect().then(function () {
    conn.subscribe(function (ev) {
      if (!ev) return;
      if (ev.type === 'state') { state = ev.doc || ev.state || {}; adoptTimers(state); return redraw(); }
      if (ev.type === 'reaction') return react((ev.doc && ev.doc.emoji) || ev.emoji);
      if (ev.type === 'reset') { qs = {}; answers = {}; return redraw(); }
      var bag = ev.col === 'questions' ? qs : ev.col === 'answers' ? answers : ev.col === 'polls' ? quick : null; if (!bag || !ev.doc) return;
      if (ev.type === 'remove') delete bag[ev.doc.id]; else bag[ev.doc.id] = Object.assign(bag[ev.doc.id] || {}, ev.doc); redraw();
    });
    return Promise.all([conn.getState().then(function (s) { state = s || {}; adoptTimers(state); }), conn.list('questions', {}).then(function (a) { (a || []).forEach(function (d) { qs[d.id] = d; }); }), conn.list('answers', {}).then(function (a) { (a || []).forEach(function (d) { answers[d.id] = d; }); }), conn.list('polls', {}).then(function (a) { (a || []).forEach(function (d) { quick[d.id] = d; }); })].map(function (pr) { return pr.catch(function () { }); }));
  }).then(draw, function () { setConn('offline'); draw(); });
})();
`,g=`/*! lecpage unlock — 암호로 잠근 연수 사이트를 브라우저 안에서 엽니다(PBKDF2-SHA256 + AES-GCM, StatiCrypt 방식).
 * 1) 잠금 화면: 암호(또는 주소의 #k=암호, 기억한 열쇠)로 페이지를 풀어 그 자리에 다시 씁니다.
 * 2) 풀린 페이지: 잠긴 교재 그림·자료(*.enc)를 받아 풀고 화면에 붙입니다.
 * 열쇠는 이 탭(sessionStorage)에만, '기억하기'를 고르면 이 기기(localStorage)에도 둡니다. 암호 원문은 저장하지 않습니다.
 */
(function () {
  'use strict';
  var doc = document, subtle = window.crypto && window.crypto.subtle;
  var lockedEl = doc.getElementById('lp-locked');
  var MIME = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', pdf: 'application/pdf', mp3: 'audio/mpeg', mp4: 'video/mp4', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', hwpx: 'application/haansofthwpx', zip: 'application/zip' };

  function fromB64(s) { var bin = atob(s), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
  function toB64(u8) { var s = ''; for (var i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
  function store(kind) { try { return window[kind]; } catch (e) { return null; } }
  function getSaved(salt) { var k = 'lp-key:' + salt, s = store('sessionStorage'), l = store('localStorage'); try { return (s && s.getItem(k)) || (l && l.getItem(k)) || ''; } catch (e) { return ''; } }
  function saveKey(salt, raw, remember) {
    var k = 'lp-key:' + salt, v = toB64(raw), s = store('sessionStorage'), l = store('localStorage');
    try { if (s) s.setItem(k, v); } catch (e) { }
    try { if (l) { if (remember) l.setItem(k, v); } } catch (e) { }
  }
  function forget(salt) { var k = 'lp-key:' + salt; try { store('sessionStorage').removeItem(k); } catch (e) { } try { store('localStorage').removeItem(k); } catch (e) { } }
  function importRaw(raw) { return subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['decrypt']); }
  function derive(pw, salt, iter) {
    return subtle.importKey('raw', new TextEncoder().encode(pw.normalize ? pw.normalize('NFC') : pw), 'PBKDF2', false, ['deriveKey'])
      .then(function (base) { return subtle.deriveKey({ name: 'PBKDF2', salt: fromB64(salt), iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, true, ['decrypt']); })
      .then(function (key) { return subtle.exportKey('raw', key).then(function (raw) { return { key: key, raw: new Uint8Array(raw) }; }); });
  }
  function decrypt(key, bytes) { return subtle.decrypt({ name: 'AES-GCM', iv: bytes.subarray(0, 12) }, key, bytes.subarray(12)); }

  // ── 1) 잠금 화면 ──────────────────────────────────────────────
  if (lockedEl) {
    var P = JSON.parse(lockedEl.textContent || '{}');
    var form = doc.querySelector('[data-lp-lock]'), msg = doc.querySelector('[data-lp-lock-msg]');
    var say = function (t) { if (msg) msg.textContent = t; };
    if (!subtle) { say('이 브라우저(또는 http 주소)에서는 열 수 없어요. https 주소로 열어 주세요.'); return; }
    var blob = fromB64(P.data);
    var open = function (key, raw, remember) {
      return decrypt(key, blob).then(function (buf) {
        saveKey(P.salt, raw, remember);
        var html = new TextDecoder().decode(buf);
        // 풀린 글은 서버가 살펴볼 수 없으므로 여기서 한 번 더 거름: 다른 곳으로 넘기는 meta refresh와 base는 뺌(스크립트는 CSP가 막음)
        html = html.replace(/<meta\\b[^>]*http-equiv\\s*=\\s*["']?refresh[^>]*>/gi, '').replace(/<base\\b[^>]*>/gi, '');
        doc.open(); doc.write(html); doc.close();
      });
    };
    var tryPassword = function (pw, remember) {
      say('여는 중…');
      var btn = form && form.querySelector('button'); if (btn) btn.disabled = true;
      return derive(pw, P.salt, P.iter).then(function (r) { return open(r.key, r.raw, remember); })
        .catch(function () { say('암호가 맞지 않아요. 다시 넣어 주세요.'); if (btn) btn.disabled = false; var i = form && form.querySelector('input[type=password]'); if (i) { i.select(); i.focus(); } });
    };
    // 주소의 #k=암호 → 바로 열고 주소에서 지움(화면 공유·전달 때 새지 않게)
    var m = /(?:^#|&)k=([^&]+)/.exec(location.hash || '');
    var fromUrl = m ? decodeURIComponent(m[1]) : '';
    if (fromUrl) { try { var h = location.hash.replace(/(^#|&)k=[^&]*/, '$1').replace(/^#&/, '#'); history.replaceState(null, '', location.pathname + location.search + (h === '#' ? '' : h)); } catch (e) { } }
    var saved = getSaved(P.salt);
    var start = saved
      ? importRaw(fromB64(saved)).then(function (key) { return open(key, fromB64(saved), !!(store('localStorage') && store('localStorage').getItem('lp-key:' + P.salt))); }).catch(function () { forget(P.salt); if (fromUrl) return tryPassword(fromUrl, false); })
      : (fromUrl ? tryPassword(fromUrl, false) : Promise.resolve());
    start.then(function () { var i = form && form.querySelector('input[type=password]'); if (i && doc.contains(i)) i.focus(); });
    if (form) form.addEventListener('submit', function (e) {
      e.preventDefault();
      var pw = (form.querySelector('input[type=password]').value || '');
      if (!pw) return say('암호를 넣어 주세요.');
      tryPassword(pw, !!(form.querySelector('[name=remember]') || {}).checked);
    });
    return;
  }

  // ── 2) 풀린 페이지: 잠긴 그림·자료 채우기 ─────────────────────────
  var nodes = Array.prototype.slice.call(doc.querySelectorAll('[data-lp-enc-src],[data-lp-enc-href]'));
  if (!nodes.length || !subtle) return;
  var tag = doc.querySelector('script[data-lp-assets]');
  var saltKey = tag ? getSaved(tag.getAttribute('data-lp-assets')) : '';
  if (!saltKey) return;
  importRaw(fromB64(saltKey)).then(function (key) {
    var queue = nodes.slice(), running = 0, cache = {};
    function mime(path) { var ext = (path.replace(/\\.enc$/, '').split('.').pop() || '').toLowerCase(); return MIME[ext] || 'application/octet-stream'; }
    function load(path) {
      if (!cache[path]) cache[path] = fetch(path, { credentials: 'same-origin' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
        .then(function (buf) { return decrypt(key, new Uint8Array(buf)); })
        .then(function (plain) { return URL.createObjectURL(new Blob([plain], { type: mime(path) })); });
      return cache[path];
    }
    function next() {
      while (running < 4 && queue.length) {
        var n = queue.shift(); running++;
        (function (n) {
          var src = n.getAttribute('data-lp-enc-src'), href = n.getAttribute('data-lp-enc-href');
          load(src || href).then(function (url) {
            if (src) { n.src = url; n.removeAttribute('data-lp-enc-src'); }
            else { n.href = url; n.removeAttribute('data-lp-enc-href'); if (!n.hasAttribute('download')) n.setAttribute('download', href.split('/').pop().replace(/\\.enc$/, '')); n.removeAttribute('target'); }
          }).catch(function () { if (src) n.alt = (n.alt || '') + ' (불러오지 못했어요)'; }).then(function () { running--; next(); });
        })(n);
      }
    }
    // 지금 보이는 그림부터
    queue.sort(function (a, b) { var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); var va = ra.width > 0 ? Math.abs(ra.top) : 1e9, vb = rb.width > 0 ? Math.abs(rb.top) : 1e9; return va - vb; });
    next();
  }).catch(function () { });

  // 링크·QR에 붙여 쓰는 도우미(암호 원문은 모르므로 #k를 만들지 않음)
  window.LecUnlock = { locked: true };
})();
`,v=`/*!
 * qrcode-generator 1.4.4 (QR Code Generator for JavaScript) — https://github.com/kazuhikoarase/qrcode-generator
 * The original file follows unmodified below this header. lecpage copies it into generated sites as assets/qr.js.
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2009 Kazuhiko Arase
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
//---------------------------------------------------------------------
//
// QR Code Generator for JavaScript
//
// Copyright (c) 2009 Kazuhiko Arase
//
// URL: http://www.d-project.com/
//
// Licensed under the MIT license:
//  http://www.opensource.org/licenses/mit-license.php
//
// The word 'QR Code' is registered trademark of
// DENSO WAVE INCORPORATED
//  http://www.denso-wave.com/qrcode/faqpatent-e.html
//
//---------------------------------------------------------------------

var qrcode = function() {

  //---------------------------------------------------------------------
  // qrcode
  //---------------------------------------------------------------------

  /**
   * qrcode
   * @param typeNumber 1 to 40
   * @param errorCorrectionLevel 'L','M','Q','H'
   */
  var qrcode = function(typeNumber, errorCorrectionLevel) {

    var PAD0 = 0xEC;
    var PAD1 = 0x11;

    var _typeNumber = typeNumber;
    var _errorCorrectionLevel = QRErrorCorrectionLevel[errorCorrectionLevel];
    var _modules = null;
    var _moduleCount = 0;
    var _dataCache = null;
    var _dataList = [];

    var _this = {};

    var makeImpl = function(test, maskPattern) {

      _moduleCount = _typeNumber * 4 + 17;
      _modules = function(moduleCount) {
        var modules = new Array(moduleCount);
        for (var row = 0; row < moduleCount; row += 1) {
          modules[row] = new Array(moduleCount);
          for (var col = 0; col < moduleCount; col += 1) {
            modules[row][col] = null;
          }
        }
        return modules;
      }(_moduleCount);

      setupPositionProbePattern(0, 0);
      setupPositionProbePattern(_moduleCount - 7, 0);
      setupPositionProbePattern(0, _moduleCount - 7);
      setupPositionAdjustPattern();
      setupTimingPattern();
      setupTypeInfo(test, maskPattern);

      if (_typeNumber >= 7) {
        setupTypeNumber(test);
      }

      if (_dataCache == null) {
        _dataCache = createData(_typeNumber, _errorCorrectionLevel, _dataList);
      }

      mapData(_dataCache, maskPattern);
    };

    var setupPositionProbePattern = function(row, col) {

      for (var r = -1; r <= 7; r += 1) {

        if (row + r <= -1 || _moduleCount <= row + r) continue;

        for (var c = -1; c <= 7; c += 1) {

          if (col + c <= -1 || _moduleCount <= col + c) continue;

          if ( (0 <= r && r <= 6 && (c == 0 || c == 6) )
              || (0 <= c && c <= 6 && (r == 0 || r == 6) )
              || (2 <= r && r <= 4 && 2 <= c && c <= 4) ) {
            _modules[row + r][col + c] = true;
          } else {
            _modules[row + r][col + c] = false;
          }
        }
      }
    };

    var getBestMaskPattern = function() {

      var minLostPoint = 0;
      var pattern = 0;

      for (var i = 0; i < 8; i += 1) {

        makeImpl(true, i);

        var lostPoint = QRUtil.getLostPoint(_this);

        if (i == 0 || minLostPoint > lostPoint) {
          minLostPoint = lostPoint;
          pattern = i;
        }
      }

      return pattern;
    };

    var setupTimingPattern = function() {

      for (var r = 8; r < _moduleCount - 8; r += 1) {
        if (_modules[r][6] != null) {
          continue;
        }
        _modules[r][6] = (r % 2 == 0);
      }

      for (var c = 8; c < _moduleCount - 8; c += 1) {
        if (_modules[6][c] != null) {
          continue;
        }
        _modules[6][c] = (c % 2 == 0);
      }
    };

    var setupPositionAdjustPattern = function() {

      var pos = QRUtil.getPatternPosition(_typeNumber);

      for (var i = 0; i < pos.length; i += 1) {

        for (var j = 0; j < pos.length; j += 1) {

          var row = pos[i];
          var col = pos[j];

          if (_modules[row][col] != null) {
            continue;
          }

          for (var r = -2; r <= 2; r += 1) {

            for (var c = -2; c <= 2; c += 1) {

              if (r == -2 || r == 2 || c == -2 || c == 2
                  || (r == 0 && c == 0) ) {
                _modules[row + r][col + c] = true;
              } else {
                _modules[row + r][col + c] = false;
              }
            }
          }
        }
      }
    };

    var setupTypeNumber = function(test) {

      var bits = QRUtil.getBCHTypeNumber(_typeNumber);

      for (var i = 0; i < 18; i += 1) {
        var mod = (!test && ( (bits >> i) & 1) == 1);
        _modules[Math.floor(i / 3)][i % 3 + _moduleCount - 8 - 3] = mod;
      }

      for (var i = 0; i < 18; i += 1) {
        var mod = (!test && ( (bits >> i) & 1) == 1);
        _modules[i % 3 + _moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
      }
    };

    var setupTypeInfo = function(test, maskPattern) {

      var data = (_errorCorrectionLevel << 3) | maskPattern;
      var bits = QRUtil.getBCHTypeInfo(data);

      // vertical
      for (var i = 0; i < 15; i += 1) {

        var mod = (!test && ( (bits >> i) & 1) == 1);

        if (i < 6) {
          _modules[i][8] = mod;
        } else if (i < 8) {
          _modules[i + 1][8] = mod;
        } else {
          _modules[_moduleCount - 15 + i][8] = mod;
        }
      }

      // horizontal
      for (var i = 0; i < 15; i += 1) {

        var mod = (!test && ( (bits >> i) & 1) == 1);

        if (i < 8) {
          _modules[8][_moduleCount - i - 1] = mod;
        } else if (i < 9) {
          _modules[8][15 - i - 1 + 1] = mod;
        } else {
          _modules[8][15 - i - 1] = mod;
        }
      }

      // fixed module
      _modules[_moduleCount - 8][8] = (!test);
    };

    var mapData = function(data, maskPattern) {

      var inc = -1;
      var row = _moduleCount - 1;
      var bitIndex = 7;
      var byteIndex = 0;
      var maskFunc = QRUtil.getMaskFunction(maskPattern);

      for (var col = _moduleCount - 1; col > 0; col -= 2) {

        if (col == 6) col -= 1;

        while (true) {

          for (var c = 0; c < 2; c += 1) {

            if (_modules[row][col - c] == null) {

              var dark = false;

              if (byteIndex < data.length) {
                dark = ( ( (data[byteIndex] >>> bitIndex) & 1) == 1);
              }

              var mask = maskFunc(row, col - c);

              if (mask) {
                dark = !dark;
              }

              _modules[row][col - c] = dark;
              bitIndex -= 1;

              if (bitIndex == -1) {
                byteIndex += 1;
                bitIndex = 7;
              }
            }
          }

          row += inc;

          if (row < 0 || _moduleCount <= row) {
            row -= inc;
            inc = -inc;
            break;
          }
        }
      }
    };

    var createBytes = function(buffer, rsBlocks) {

      var offset = 0;

      var maxDcCount = 0;
      var maxEcCount = 0;

      var dcdata = new Array(rsBlocks.length);
      var ecdata = new Array(rsBlocks.length);

      for (var r = 0; r < rsBlocks.length; r += 1) {

        var dcCount = rsBlocks[r].dataCount;
        var ecCount = rsBlocks[r].totalCount - dcCount;

        maxDcCount = Math.max(maxDcCount, dcCount);
        maxEcCount = Math.max(maxEcCount, ecCount);

        dcdata[r] = new Array(dcCount);

        for (var i = 0; i < dcdata[r].length; i += 1) {
          dcdata[r][i] = 0xff & buffer.getBuffer()[i + offset];
        }
        offset += dcCount;

        var rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
        var rawPoly = qrPolynomial(dcdata[r], rsPoly.getLength() - 1);

        var modPoly = rawPoly.mod(rsPoly);
        ecdata[r] = new Array(rsPoly.getLength() - 1);
        for (var i = 0; i < ecdata[r].length; i += 1) {
          var modIndex = i + modPoly.getLength() - ecdata[r].length;
          ecdata[r][i] = (modIndex >= 0)? modPoly.getAt(modIndex) : 0;
        }
      }

      var totalCodeCount = 0;
      for (var i = 0; i < rsBlocks.length; i += 1) {
        totalCodeCount += rsBlocks[i].totalCount;
      }

      var data = new Array(totalCodeCount);
      var index = 0;

      for (var i = 0; i < maxDcCount; i += 1) {
        for (var r = 0; r < rsBlocks.length; r += 1) {
          if (i < dcdata[r].length) {
            data[index] = dcdata[r][i];
            index += 1;
          }
        }
      }

      for (var i = 0; i < maxEcCount; i += 1) {
        for (var r = 0; r < rsBlocks.length; r += 1) {
          if (i < ecdata[r].length) {
            data[index] = ecdata[r][i];
            index += 1;
          }
        }
      }

      return data;
    };

    var createData = function(typeNumber, errorCorrectionLevel, dataList) {

      var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectionLevel);

      var buffer = qrBitBuffer();

      for (var i = 0; i < dataList.length; i += 1) {
        var data = dataList[i];
        buffer.put(data.getMode(), 4);
        buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber) );
        data.write(buffer);
      }

      // calc num max data.
      var totalDataCount = 0;
      for (var i = 0; i < rsBlocks.length; i += 1) {
        totalDataCount += rsBlocks[i].dataCount;
      }

      if (buffer.getLengthInBits() > totalDataCount * 8) {
        throw 'code length overflow. ('
          + buffer.getLengthInBits()
          + '>'
          + totalDataCount * 8
          + ')';
      }

      // end code
      if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {
        buffer.put(0, 4);
      }

      // padding
      while (buffer.getLengthInBits() % 8 != 0) {
        buffer.putBit(false);
      }

      // padding
      while (true) {

        if (buffer.getLengthInBits() >= totalDataCount * 8) {
          break;
        }
        buffer.put(PAD0, 8);

        if (buffer.getLengthInBits() >= totalDataCount * 8) {
          break;
        }
        buffer.put(PAD1, 8);
      }

      return createBytes(buffer, rsBlocks);
    };

    _this.addData = function(data, mode) {

      mode = mode || 'Byte';

      var newData = null;

      switch(mode) {
      case 'Numeric' :
        newData = qrNumber(data);
        break;
      case 'Alphanumeric' :
        newData = qrAlphaNum(data);
        break;
      case 'Byte' :
        newData = qr8BitByte(data);
        break;
      case 'Kanji' :
        newData = qrKanji(data);
        break;
      default :
        throw 'mode:' + mode;
      }

      _dataList.push(newData);
      _dataCache = null;
    };

    _this.isDark = function(row, col) {
      if (row < 0 || _moduleCount <= row || col < 0 || _moduleCount <= col) {
        throw row + ',' + col;
      }
      return _modules[row][col];
    };

    _this.getModuleCount = function() {
      return _moduleCount;
    };

    _this.make = function() {
      if (_typeNumber < 1) {
        var typeNumber = 1;

        for (; typeNumber < 40; typeNumber++) {
          var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, _errorCorrectionLevel);
          var buffer = qrBitBuffer();

          for (var i = 0; i < _dataList.length; i++) {
            var data = _dataList[i];
            buffer.put(data.getMode(), 4);
            buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber) );
            data.write(buffer);
          }

          var totalDataCount = 0;
          for (var i = 0; i < rsBlocks.length; i++) {
            totalDataCount += rsBlocks[i].dataCount;
          }

          if (buffer.getLengthInBits() <= totalDataCount * 8) {
            break;
          }
        }

        _typeNumber = typeNumber;
      }

      makeImpl(false, getBestMaskPattern() );
    };

    _this.createTableTag = function(cellSize, margin) {

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      var qrHtml = '';

      qrHtml += '<table style="';
      qrHtml += ' border-width: 0px; border-style: none;';
      qrHtml += ' border-collapse: collapse;';
      qrHtml += ' padding: 0px; margin: ' + margin + 'px;';
      qrHtml += '">';
      qrHtml += '<tbody>';

      for (var r = 0; r < _this.getModuleCount(); r += 1) {

        qrHtml += '<tr>';

        for (var c = 0; c < _this.getModuleCount(); c += 1) {
          qrHtml += '<td style="';
          qrHtml += ' border-width: 0px; border-style: none;';
          qrHtml += ' border-collapse: collapse;';
          qrHtml += ' padding: 0px; margin: 0px;';
          qrHtml += ' width: ' + cellSize + 'px;';
          qrHtml += ' height: ' + cellSize + 'px;';
          qrHtml += ' background-color: ';
          qrHtml += _this.isDark(r, c)? '#000000' : '#ffffff';
          qrHtml += ';';
          qrHtml += '"/>';
        }

        qrHtml += '</tr>';
      }

      qrHtml += '</tbody>';
      qrHtml += '</table>';

      return qrHtml;
    };

    _this.createSvgTag = function(cellSize, margin, alt, title) {

      var opts = {};
      if (typeof arguments[0] == 'object') {
        // Called by options.
        opts = arguments[0];
        // overwrite cellSize and margin.
        cellSize = opts.cellSize;
        margin = opts.margin;
        alt = opts.alt;
        title = opts.title;
      }

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      // Compose alt property surrogate
      alt = (typeof alt === 'string') ? {text: alt} : alt || {};
      alt.text = alt.text || null;
      alt.id = (alt.text) ? alt.id || 'qrcode-description' : null;

      // Compose title property surrogate
      title = (typeof title === 'string') ? {text: title} : title || {};
      title.text = title.text || null;
      title.id = (title.text) ? title.id || 'qrcode-title' : null;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var c, mc, r, mr, qrSvg='', rect;

      rect = 'l' + cellSize + ',0 0,' + cellSize +
        ' -' + cellSize + ',0 0,-' + cellSize + 'z ';

      qrSvg += '<svg version="1.1" xmlns="http://www.w3.org/2000/svg"';
      qrSvg += !opts.scalable ? ' width="' + size + 'px" height="' + size + 'px"' : '';
      qrSvg += ' viewBox="0 0 ' + size + ' ' + size + '" ';
      qrSvg += ' preserveAspectRatio="xMinYMin meet"';
      qrSvg += (title.text || alt.text) ? ' role="img" aria-labelledby="' +
          escapeXml([title.id, alt.id].join(' ').trim() ) + '"' : '';
      qrSvg += '>';
      qrSvg += (title.text) ? '<title id="' + escapeXml(title.id) + '">' +
          escapeXml(title.text) + '</title>' : '';
      qrSvg += (alt.text) ? '<description id="' + escapeXml(alt.id) + '">' +
          escapeXml(alt.text) + '</description>' : '';
      qrSvg += '<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>';
      qrSvg += '<path d="';

      for (r = 0; r < _this.getModuleCount(); r += 1) {
        mr = r * cellSize + margin;
        for (c = 0; c < _this.getModuleCount(); c += 1) {
          if (_this.isDark(r, c) ) {
            mc = c*cellSize+margin;
            qrSvg += 'M' + mc + ',' + mr + rect;
          }
        }
      }

      qrSvg += '" stroke="transparent" fill="black"/>';
      qrSvg += '</svg>';

      return qrSvg;
    };

    _this.createDataURL = function(cellSize, margin) {

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var min = margin;
      var max = size - margin;

      return createDataURL(size, size, function(x, y) {
        if (min <= x && x < max && min <= y && y < max) {
          var c = Math.floor( (x - min) / cellSize);
          var r = Math.floor( (y - min) / cellSize);
          return _this.isDark(r, c)? 0 : 1;
        } else {
          return 1;
        }
      } );
    };

    _this.createImgTag = function(cellSize, margin, alt) {

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;

      var img = '';
      img += '<img';
      img += '\\u0020src="';
      img += _this.createDataURL(cellSize, margin);
      img += '"';
      img += '\\u0020width="';
      img += size;
      img += '"';
      img += '\\u0020height="';
      img += size;
      img += '"';
      if (alt) {
        img += '\\u0020alt="';
        img += escapeXml(alt);
        img += '"';
      }
      img += '/>';

      return img;
    };

    var escapeXml = function(s) {
      var escaped = '';
      for (var i = 0; i < s.length; i += 1) {
        var c = s.charAt(i);
        switch(c) {
        case '<': escaped += '&lt;'; break;
        case '>': escaped += '&gt;'; break;
        case '&': escaped += '&amp;'; break;
        case '"': escaped += '&quot;'; break;
        default : escaped += c; break;
        }
      }
      return escaped;
    };

    var _createHalfASCII = function(margin) {
      var cellSize = 1;
      margin = (typeof margin == 'undefined')? cellSize * 2 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var min = margin;
      var max = size - margin;

      var y, x, r1, r2, p;

      var blocks = {
        '██': '█',
        '█ ': '▀',
        ' █': '▄',
        '  ': ' '
      };

      var blocksLastLineNoMargin = {
        '██': '▀',
        '█ ': '▀',
        ' █': ' ',
        '  ': ' '
      };

      var ascii = '';
      for (y = 0; y < size; y += 2) {
        r1 = Math.floor((y - min) / cellSize);
        r2 = Math.floor((y + 1 - min) / cellSize);
        for (x = 0; x < size; x += 1) {
          p = '█';

          if (min <= x && x < max && min <= y && y < max && _this.isDark(r1, Math.floor((x - min) / cellSize))) {
            p = ' ';
          }

          if (min <= x && x < max && min <= y+1 && y+1 < max && _this.isDark(r2, Math.floor((x - min) / cellSize))) {
            p += ' ';
          }
          else {
            p += '█';
          }

          // Output 2 characters per pixel, to create full square. 1 character per pixels gives only half width of square.
          ascii += (margin < 1 && y+1 >= max) ? blocksLastLineNoMargin[p] : blocks[p];
        }

        ascii += '\\n';
      }

      if (size % 2 && margin > 0) {
        return ascii.substring(0, ascii.length - size - 1) + Array(size+1).join('▀');
      }

      return ascii.substring(0, ascii.length-1);
    };

    _this.createASCII = function(cellSize, margin) {
      cellSize = cellSize || 1;

      if (cellSize < 2) {
        return _createHalfASCII(margin);
      }

      cellSize -= 1;
      margin = (typeof margin == 'undefined')? cellSize * 2 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var min = margin;
      var max = size - margin;

      var y, x, r, p;

      var white = Array(cellSize+1).join('██');
      var black = Array(cellSize+1).join('  ');

      var ascii = '';
      var line = '';
      for (y = 0; y < size; y += 1) {
        r = Math.floor( (y - min) / cellSize);
        line = '';
        for (x = 0; x < size; x += 1) {
          p = 1;

          if (min <= x && x < max && min <= y && y < max && _this.isDark(r, Math.floor((x - min) / cellSize))) {
            p = 0;
          }

          // Output 2 characters per pixel, to create full square. 1 character per pixels gives only half width of square.
          line += p ? white : black;
        }

        for (r = 0; r < cellSize; r += 1) {
          ascii += line + '\\n';
        }
      }

      return ascii.substring(0, ascii.length-1);
    };

    _this.renderTo2dContext = function(context, cellSize) {
      cellSize = cellSize || 2;
      var length = _this.getModuleCount();
      for (var row = 0; row < length; row++) {
        for (var col = 0; col < length; col++) {
          context.fillStyle = _this.isDark(row, col) ? 'black' : 'white';
          context.fillRect(row * cellSize, col * cellSize, cellSize, cellSize);
        }
      }
    }

    return _this;
  };

  //---------------------------------------------------------------------
  // qrcode.stringToBytes
  //---------------------------------------------------------------------

  qrcode.stringToBytesFuncs = {
    'default' : function(s) {
      var bytes = [];
      for (var i = 0; i < s.length; i += 1) {
        var c = s.charCodeAt(i);
        bytes.push(c & 0xff);
      }
      return bytes;
    }
  };

  qrcode.stringToBytes = qrcode.stringToBytesFuncs['default'];

  //---------------------------------------------------------------------
  // qrcode.createStringToBytes
  //---------------------------------------------------------------------

  /**
   * @param unicodeData base64 string of byte array.
   * [16bit Unicode],[16bit Bytes], ...
   * @param numChars
   */
  qrcode.createStringToBytes = function(unicodeData, numChars) {

    // create conversion map.

    var unicodeMap = function() {

      var bin = base64DecodeInputStream(unicodeData);
      var read = function() {
        var b = bin.read();
        if (b == -1) throw 'eof';
        return b;
      };

      var count = 0;
      var unicodeMap = {};
      while (true) {
        var b0 = bin.read();
        if (b0 == -1) break;
        var b1 = read();
        var b2 = read();
        var b3 = read();
        var k = String.fromCharCode( (b0 << 8) | b1);
        var v = (b2 << 8) | b3;
        unicodeMap[k] = v;
        count += 1;
      }
      if (count != numChars) {
        throw count + ' != ' + numChars;
      }

      return unicodeMap;
    }();

    var unknownChar = '?'.charCodeAt(0);

    return function(s) {
      var bytes = [];
      for (var i = 0; i < s.length; i += 1) {
        var c = s.charCodeAt(i);
        if (c < 128) {
          bytes.push(c);
        } else {
          var b = unicodeMap[s.charAt(i)];
          if (typeof b == 'number') {
            if ( (b & 0xff) == b) {
              // 1byte
              bytes.push(b);
            } else {
              // 2bytes
              bytes.push(b >>> 8);
              bytes.push(b & 0xff);
            }
          } else {
            bytes.push(unknownChar);
          }
        }
      }
      return bytes;
    };
  };

  //---------------------------------------------------------------------
  // QRMode
  //---------------------------------------------------------------------

  var QRMode = {
    MODE_NUMBER :    1 << 0,
    MODE_ALPHA_NUM : 1 << 1,
    MODE_8BIT_BYTE : 1 << 2,
    MODE_KANJI :     1 << 3
  };

  //---------------------------------------------------------------------
  // QRErrorCorrectionLevel
  //---------------------------------------------------------------------

  var QRErrorCorrectionLevel = {
    L : 1,
    M : 0,
    Q : 3,
    H : 2
  };

  //---------------------------------------------------------------------
  // QRMaskPattern
  //---------------------------------------------------------------------

  var QRMaskPattern = {
    PATTERN000 : 0,
    PATTERN001 : 1,
    PATTERN010 : 2,
    PATTERN011 : 3,
    PATTERN100 : 4,
    PATTERN101 : 5,
    PATTERN110 : 6,
    PATTERN111 : 7
  };

  //---------------------------------------------------------------------
  // QRUtil
  //---------------------------------------------------------------------

  var QRUtil = function() {

    var PATTERN_POSITION_TABLE = [
      [],
      [6, 18],
      [6, 22],
      [6, 26],
      [6, 30],
      [6, 34],
      [6, 22, 38],
      [6, 24, 42],
      [6, 26, 46],
      [6, 28, 50],
      [6, 30, 54],
      [6, 32, 58],
      [6, 34, 62],
      [6, 26, 46, 66],
      [6, 26, 48, 70],
      [6, 26, 50, 74],
      [6, 30, 54, 78],
      [6, 30, 56, 82],
      [6, 30, 58, 86],
      [6, 34, 62, 90],
      [6, 28, 50, 72, 94],
      [6, 26, 50, 74, 98],
      [6, 30, 54, 78, 102],
      [6, 28, 54, 80, 106],
      [6, 32, 58, 84, 110],
      [6, 30, 58, 86, 114],
      [6, 34, 62, 90, 118],
      [6, 26, 50, 74, 98, 122],
      [6, 30, 54, 78, 102, 126],
      [6, 26, 52, 78, 104, 130],
      [6, 30, 56, 82, 108, 134],
      [6, 34, 60, 86, 112, 138],
      [6, 30, 58, 86, 114, 142],
      [6, 34, 62, 90, 118, 146],
      [6, 30, 54, 78, 102, 126, 150],
      [6, 24, 50, 76, 102, 128, 154],
      [6, 28, 54, 80, 106, 132, 158],
      [6, 32, 58, 84, 110, 136, 162],
      [6, 26, 54, 82, 110, 138, 166],
      [6, 30, 58, 86, 114, 142, 170]
    ];
    var G15 = (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0);
    var G18 = (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0);
    var G15_MASK = (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1);

    var _this = {};

    var getBCHDigit = function(data) {
      var digit = 0;
      while (data != 0) {
        digit += 1;
        data >>>= 1;
      }
      return digit;
    };

    _this.getBCHTypeInfo = function(data) {
      var d = data << 10;
      while (getBCHDigit(d) - getBCHDigit(G15) >= 0) {
        d ^= (G15 << (getBCHDigit(d) - getBCHDigit(G15) ) );
      }
      return ( (data << 10) | d) ^ G15_MASK;
    };

    _this.getBCHTypeNumber = function(data) {
      var d = data << 12;
      while (getBCHDigit(d) - getBCHDigit(G18) >= 0) {
        d ^= (G18 << (getBCHDigit(d) - getBCHDigit(G18) ) );
      }
      return (data << 12) | d;
    };

    _this.getPatternPosition = function(typeNumber) {
      return PATTERN_POSITION_TABLE[typeNumber - 1];
    };

    _this.getMaskFunction = function(maskPattern) {

      switch (maskPattern) {

      case QRMaskPattern.PATTERN000 :
        return function(i, j) { return (i + j) % 2 == 0; };
      case QRMaskPattern.PATTERN001 :
        return function(i, j) { return i % 2 == 0; };
      case QRMaskPattern.PATTERN010 :
        return function(i, j) { return j % 3 == 0; };
      case QRMaskPattern.PATTERN011 :
        return function(i, j) { return (i + j) % 3 == 0; };
      case QRMaskPattern.PATTERN100 :
        return function(i, j) { return (Math.floor(i / 2) + Math.floor(j / 3) ) % 2 == 0; };
      case QRMaskPattern.PATTERN101 :
        return function(i, j) { return (i * j) % 2 + (i * j) % 3 == 0; };
      case QRMaskPattern.PATTERN110 :
        return function(i, j) { return ( (i * j) % 2 + (i * j) % 3) % 2 == 0; };
      case QRMaskPattern.PATTERN111 :
        return function(i, j) { return ( (i * j) % 3 + (i + j) % 2) % 2 == 0; };

      default :
        throw 'bad maskPattern:' + maskPattern;
      }
    };

    _this.getErrorCorrectPolynomial = function(errorCorrectLength) {
      var a = qrPolynomial([1], 0);
      for (var i = 0; i < errorCorrectLength; i += 1) {
        a = a.multiply(qrPolynomial([1, QRMath.gexp(i)], 0) );
      }
      return a;
    };

    _this.getLengthInBits = function(mode, type) {

      if (1 <= type && type < 10) {

        // 1 - 9

        switch(mode) {
        case QRMode.MODE_NUMBER    : return 10;
        case QRMode.MODE_ALPHA_NUM : return 9;
        case QRMode.MODE_8BIT_BYTE : return 8;
        case QRMode.MODE_KANJI     : return 8;
        default :
          throw 'mode:' + mode;
        }

      } else if (type < 27) {

        // 10 - 26

        switch(mode) {
        case QRMode.MODE_NUMBER    : return 12;
        case QRMode.MODE_ALPHA_NUM : return 11;
        case QRMode.MODE_8BIT_BYTE : return 16;
        case QRMode.MODE_KANJI     : return 10;
        default :
          throw 'mode:' + mode;
        }

      } else if (type < 41) {

        // 27 - 40

        switch(mode) {
        case QRMode.MODE_NUMBER    : return 14;
        case QRMode.MODE_ALPHA_NUM : return 13;
        case QRMode.MODE_8BIT_BYTE : return 16;
        case QRMode.MODE_KANJI     : return 12;
        default :
          throw 'mode:' + mode;
        }

      } else {
        throw 'type:' + type;
      }
    };

    _this.getLostPoint = function(qrcode) {

      var moduleCount = qrcode.getModuleCount();

      var lostPoint = 0;

      // LEVEL1

      for (var row = 0; row < moduleCount; row += 1) {
        for (var col = 0; col < moduleCount; col += 1) {

          var sameCount = 0;
          var dark = qrcode.isDark(row, col);

          for (var r = -1; r <= 1; r += 1) {

            if (row + r < 0 || moduleCount <= row + r) {
              continue;
            }

            for (var c = -1; c <= 1; c += 1) {

              if (col + c < 0 || moduleCount <= col + c) {
                continue;
              }

              if (r == 0 && c == 0) {
                continue;
              }

              if (dark == qrcode.isDark(row + r, col + c) ) {
                sameCount += 1;
              }
            }
          }

          if (sameCount > 5) {
            lostPoint += (3 + sameCount - 5);
          }
        }
      };

      // LEVEL2

      for (var row = 0; row < moduleCount - 1; row += 1) {
        for (var col = 0; col < moduleCount - 1; col += 1) {
          var count = 0;
          if (qrcode.isDark(row, col) ) count += 1;
          if (qrcode.isDark(row + 1, col) ) count += 1;
          if (qrcode.isDark(row, col + 1) ) count += 1;
          if (qrcode.isDark(row + 1, col + 1) ) count += 1;
          if (count == 0 || count == 4) {
            lostPoint += 3;
          }
        }
      }

      // LEVEL3

      for (var row = 0; row < moduleCount; row += 1) {
        for (var col = 0; col < moduleCount - 6; col += 1) {
          if (qrcode.isDark(row, col)
              && !qrcode.isDark(row, col + 1)
              &&  qrcode.isDark(row, col + 2)
              &&  qrcode.isDark(row, col + 3)
              &&  qrcode.isDark(row, col + 4)
              && !qrcode.isDark(row, col + 5)
              &&  qrcode.isDark(row, col + 6) ) {
            lostPoint += 40;
          }
        }
      }

      for (var col = 0; col < moduleCount; col += 1) {
        for (var row = 0; row < moduleCount - 6; row += 1) {
          if (qrcode.isDark(row, col)
              && !qrcode.isDark(row + 1, col)
              &&  qrcode.isDark(row + 2, col)
              &&  qrcode.isDark(row + 3, col)
              &&  qrcode.isDark(row + 4, col)
              && !qrcode.isDark(row + 5, col)
              &&  qrcode.isDark(row + 6, col) ) {
            lostPoint += 40;
          }
        }
      }

      // LEVEL4

      var darkCount = 0;

      for (var col = 0; col < moduleCount; col += 1) {
        for (var row = 0; row < moduleCount; row += 1) {
          if (qrcode.isDark(row, col) ) {
            darkCount += 1;
          }
        }
      }

      var ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5;
      lostPoint += ratio * 10;

      return lostPoint;
    };

    return _this;
  }();

  //---------------------------------------------------------------------
  // QRMath
  //---------------------------------------------------------------------

  var QRMath = function() {

    var EXP_TABLE = new Array(256);
    var LOG_TABLE = new Array(256);

    // initialize tables
    for (var i = 0; i < 8; i += 1) {
      EXP_TABLE[i] = 1 << i;
    }
    for (var i = 8; i < 256; i += 1) {
      EXP_TABLE[i] = EXP_TABLE[i - 4]
        ^ EXP_TABLE[i - 5]
        ^ EXP_TABLE[i - 6]
        ^ EXP_TABLE[i - 8];
    }
    for (var i = 0; i < 255; i += 1) {
      LOG_TABLE[EXP_TABLE[i] ] = i;
    }

    var _this = {};

    _this.glog = function(n) {

      if (n < 1) {
        throw 'glog(' + n + ')';
      }

      return LOG_TABLE[n];
    };

    _this.gexp = function(n) {

      while (n < 0) {
        n += 255;
      }

      while (n >= 256) {
        n -= 255;
      }

      return EXP_TABLE[n];
    };

    return _this;
  }();

  //---------------------------------------------------------------------
  // qrPolynomial
  //---------------------------------------------------------------------

  function qrPolynomial(num, shift) {

    if (typeof num.length == 'undefined') {
      throw num.length + '/' + shift;
    }

    var _num = function() {
      var offset = 0;
      while (offset < num.length && num[offset] == 0) {
        offset += 1;
      }
      var _num = new Array(num.length - offset + shift);
      for (var i = 0; i < num.length - offset; i += 1) {
        _num[i] = num[i + offset];
      }
      return _num;
    }();

    var _this = {};

    _this.getAt = function(index) {
      return _num[index];
    };

    _this.getLength = function() {
      return _num.length;
    };

    _this.multiply = function(e) {

      var num = new Array(_this.getLength() + e.getLength() - 1);

      for (var i = 0; i < _this.getLength(); i += 1) {
        for (var j = 0; j < e.getLength(); j += 1) {
          num[i + j] ^= QRMath.gexp(QRMath.glog(_this.getAt(i) ) + QRMath.glog(e.getAt(j) ) );
        }
      }

      return qrPolynomial(num, 0);
    };

    _this.mod = function(e) {

      if (_this.getLength() - e.getLength() < 0) {
        return _this;
      }

      var ratio = QRMath.glog(_this.getAt(0) ) - QRMath.glog(e.getAt(0) );

      var num = new Array(_this.getLength() );
      for (var i = 0; i < _this.getLength(); i += 1) {
        num[i] = _this.getAt(i);
      }

      for (var i = 0; i < e.getLength(); i += 1) {
        num[i] ^= QRMath.gexp(QRMath.glog(e.getAt(i) ) + ratio);
      }

      // recursive call
      return qrPolynomial(num, 0).mod(e);
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // QRRSBlock
  //---------------------------------------------------------------------

  var QRRSBlock = function() {

    var RS_BLOCK_TABLE = [

      // L
      // M
      // Q
      // H

      // 1
      [1, 26, 19],
      [1, 26, 16],
      [1, 26, 13],
      [1, 26, 9],

      // 2
      [1, 44, 34],
      [1, 44, 28],
      [1, 44, 22],
      [1, 44, 16],

      // 3
      [1, 70, 55],
      [1, 70, 44],
      [2, 35, 17],
      [2, 35, 13],

      // 4
      [1, 100, 80],
      [2, 50, 32],
      [2, 50, 24],
      [4, 25, 9],

      // 5
      [1, 134, 108],
      [2, 67, 43],
      [2, 33, 15, 2, 34, 16],
      [2, 33, 11, 2, 34, 12],

      // 6
      [2, 86, 68],
      [4, 43, 27],
      [4, 43, 19],
      [4, 43, 15],

      // 7
      [2, 98, 78],
      [4, 49, 31],
      [2, 32, 14, 4, 33, 15],
      [4, 39, 13, 1, 40, 14],

      // 8
      [2, 121, 97],
      [2, 60, 38, 2, 61, 39],
      [4, 40, 18, 2, 41, 19],
      [4, 40, 14, 2, 41, 15],

      // 9
      [2, 146, 116],
      [3, 58, 36, 2, 59, 37],
      [4, 36, 16, 4, 37, 17],
      [4, 36, 12, 4, 37, 13],

      // 10
      [2, 86, 68, 2, 87, 69],
      [4, 69, 43, 1, 70, 44],
      [6, 43, 19, 2, 44, 20],
      [6, 43, 15, 2, 44, 16],

      // 11
      [4, 101, 81],
      [1, 80, 50, 4, 81, 51],
      [4, 50, 22, 4, 51, 23],
      [3, 36, 12, 8, 37, 13],

      // 12
      [2, 116, 92, 2, 117, 93],
      [6, 58, 36, 2, 59, 37],
      [4, 46, 20, 6, 47, 21],
      [7, 42, 14, 4, 43, 15],

      // 13
      [4, 133, 107],
      [8, 59, 37, 1, 60, 38],
      [8, 44, 20, 4, 45, 21],
      [12, 33, 11, 4, 34, 12],

      // 14
      [3, 145, 115, 1, 146, 116],
      [4, 64, 40, 5, 65, 41],
      [11, 36, 16, 5, 37, 17],
      [11, 36, 12, 5, 37, 13],

      // 15
      [5, 109, 87, 1, 110, 88],
      [5, 65, 41, 5, 66, 42],
      [5, 54, 24, 7, 55, 25],
      [11, 36, 12, 7, 37, 13],

      // 16
      [5, 122, 98, 1, 123, 99],
      [7, 73, 45, 3, 74, 46],
      [15, 43, 19, 2, 44, 20],
      [3, 45, 15, 13, 46, 16],

      // 17
      [1, 135, 107, 5, 136, 108],
      [10, 74, 46, 1, 75, 47],
      [1, 50, 22, 15, 51, 23],
      [2, 42, 14, 17, 43, 15],

      // 18
      [5, 150, 120, 1, 151, 121],
      [9, 69, 43, 4, 70, 44],
      [17, 50, 22, 1, 51, 23],
      [2, 42, 14, 19, 43, 15],

      // 19
      [3, 141, 113, 4, 142, 114],
      [3, 70, 44, 11, 71, 45],
      [17, 47, 21, 4, 48, 22],
      [9, 39, 13, 16, 40, 14],

      // 20
      [3, 135, 107, 5, 136, 108],
      [3, 67, 41, 13, 68, 42],
      [15, 54, 24, 5, 55, 25],
      [15, 43, 15, 10, 44, 16],

      // 21
      [4, 144, 116, 4, 145, 117],
      [17, 68, 42],
      [17, 50, 22, 6, 51, 23],
      [19, 46, 16, 6, 47, 17],

      // 22
      [2, 139, 111, 7, 140, 112],
      [17, 74, 46],
      [7, 54, 24, 16, 55, 25],
      [34, 37, 13],

      // 23
      [4, 151, 121, 5, 152, 122],
      [4, 75, 47, 14, 76, 48],
      [11, 54, 24, 14, 55, 25],
      [16, 45, 15, 14, 46, 16],

      // 24
      [6, 147, 117, 4, 148, 118],
      [6, 73, 45, 14, 74, 46],
      [11, 54, 24, 16, 55, 25],
      [30, 46, 16, 2, 47, 17],

      // 25
      [8, 132, 106, 4, 133, 107],
      [8, 75, 47, 13, 76, 48],
      [7, 54, 24, 22, 55, 25],
      [22, 45, 15, 13, 46, 16],

      // 26
      [10, 142, 114, 2, 143, 115],
      [19, 74, 46, 4, 75, 47],
      [28, 50, 22, 6, 51, 23],
      [33, 46, 16, 4, 47, 17],

      // 27
      [8, 152, 122, 4, 153, 123],
      [22, 73, 45, 3, 74, 46],
      [8, 53, 23, 26, 54, 24],
      [12, 45, 15, 28, 46, 16],

      // 28
      [3, 147, 117, 10, 148, 118],
      [3, 73, 45, 23, 74, 46],
      [4, 54, 24, 31, 55, 25],
      [11, 45, 15, 31, 46, 16],

      // 29
      [7, 146, 116, 7, 147, 117],
      [21, 73, 45, 7, 74, 46],
      [1, 53, 23, 37, 54, 24],
      [19, 45, 15, 26, 46, 16],

      // 30
      [5, 145, 115, 10, 146, 116],
      [19, 75, 47, 10, 76, 48],
      [15, 54, 24, 25, 55, 25],
      [23, 45, 15, 25, 46, 16],

      // 31
      [13, 145, 115, 3, 146, 116],
      [2, 74, 46, 29, 75, 47],
      [42, 54, 24, 1, 55, 25],
      [23, 45, 15, 28, 46, 16],

      // 32
      [17, 145, 115],
      [10, 74, 46, 23, 75, 47],
      [10, 54, 24, 35, 55, 25],
      [19, 45, 15, 35, 46, 16],

      // 33
      [17, 145, 115, 1, 146, 116],
      [14, 74, 46, 21, 75, 47],
      [29, 54, 24, 19, 55, 25],
      [11, 45, 15, 46, 46, 16],

      // 34
      [13, 145, 115, 6, 146, 116],
      [14, 74, 46, 23, 75, 47],
      [44, 54, 24, 7, 55, 25],
      [59, 46, 16, 1, 47, 17],

      // 35
      [12, 151, 121, 7, 152, 122],
      [12, 75, 47, 26, 76, 48],
      [39, 54, 24, 14, 55, 25],
      [22, 45, 15, 41, 46, 16],

      // 36
      [6, 151, 121, 14, 152, 122],
      [6, 75, 47, 34, 76, 48],
      [46, 54, 24, 10, 55, 25],
      [2, 45, 15, 64, 46, 16],

      // 37
      [17, 152, 122, 4, 153, 123],
      [29, 74, 46, 14, 75, 47],
      [49, 54, 24, 10, 55, 25],
      [24, 45, 15, 46, 46, 16],

      // 38
      [4, 152, 122, 18, 153, 123],
      [13, 74, 46, 32, 75, 47],
      [48, 54, 24, 14, 55, 25],
      [42, 45, 15, 32, 46, 16],

      // 39
      [20, 147, 117, 4, 148, 118],
      [40, 75, 47, 7, 76, 48],
      [43, 54, 24, 22, 55, 25],
      [10, 45, 15, 67, 46, 16],

      // 40
      [19, 148, 118, 6, 149, 119],
      [18, 75, 47, 31, 76, 48],
      [34, 54, 24, 34, 55, 25],
      [20, 45, 15, 61, 46, 16]
    ];

    var qrRSBlock = function(totalCount, dataCount) {
      var _this = {};
      _this.totalCount = totalCount;
      _this.dataCount = dataCount;
      return _this;
    };

    var _this = {};

    var getRsBlockTable = function(typeNumber, errorCorrectionLevel) {

      switch(errorCorrectionLevel) {
      case QRErrorCorrectionLevel.L :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
      case QRErrorCorrectionLevel.M :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
      case QRErrorCorrectionLevel.Q :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
      case QRErrorCorrectionLevel.H :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
      default :
        return undefined;
      }
    };

    _this.getRSBlocks = function(typeNumber, errorCorrectionLevel) {

      var rsBlock = getRsBlockTable(typeNumber, errorCorrectionLevel);

      if (typeof rsBlock == 'undefined') {
        throw 'bad rs block @ typeNumber:' + typeNumber +
            '/errorCorrectionLevel:' + errorCorrectionLevel;
      }

      var length = rsBlock.length / 3;

      var list = [];

      for (var i = 0; i < length; i += 1) {

        var count = rsBlock[i * 3 + 0];
        var totalCount = rsBlock[i * 3 + 1];
        var dataCount = rsBlock[i * 3 + 2];

        for (var j = 0; j < count; j += 1) {
          list.push(qrRSBlock(totalCount, dataCount) );
        }
      }

      return list;
    };

    return _this;
  }();

  //---------------------------------------------------------------------
  // qrBitBuffer
  //---------------------------------------------------------------------

  var qrBitBuffer = function() {

    var _buffer = [];
    var _length = 0;

    var _this = {};

    _this.getBuffer = function() {
      return _buffer;
    };

    _this.getAt = function(index) {
      var bufIndex = Math.floor(index / 8);
      return ( (_buffer[bufIndex] >>> (7 - index % 8) ) & 1) == 1;
    };

    _this.put = function(num, length) {
      for (var i = 0; i < length; i += 1) {
        _this.putBit( ( (num >>> (length - i - 1) ) & 1) == 1);
      }
    };

    _this.getLengthInBits = function() {
      return _length;
    };

    _this.putBit = function(bit) {

      var bufIndex = Math.floor(_length / 8);
      if (_buffer.length <= bufIndex) {
        _buffer.push(0);
      }

      if (bit) {
        _buffer[bufIndex] |= (0x80 >>> (_length % 8) );
      }

      _length += 1;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qrNumber
  //---------------------------------------------------------------------

  var qrNumber = function(data) {

    var _mode = QRMode.MODE_NUMBER;
    var _data = data;

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return _data.length;
    };

    _this.write = function(buffer) {

      var data = _data;

      var i = 0;

      while (i + 2 < data.length) {
        buffer.put(strToNum(data.substring(i, i + 3) ), 10);
        i += 3;
      }

      if (i < data.length) {
        if (data.length - i == 1) {
          buffer.put(strToNum(data.substring(i, i + 1) ), 4);
        } else if (data.length - i == 2) {
          buffer.put(strToNum(data.substring(i, i + 2) ), 7);
        }
      }
    };

    var strToNum = function(s) {
      var num = 0;
      for (var i = 0; i < s.length; i += 1) {
        num = num * 10 + chatToNum(s.charAt(i) );
      }
      return num;
    };

    var chatToNum = function(c) {
      if ('0' <= c && c <= '9') {
        return c.charCodeAt(0) - '0'.charCodeAt(0);
      }
      throw 'illegal char :' + c;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qrAlphaNum
  //---------------------------------------------------------------------

  var qrAlphaNum = function(data) {

    var _mode = QRMode.MODE_ALPHA_NUM;
    var _data = data;

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return _data.length;
    };

    _this.write = function(buffer) {

      var s = _data;

      var i = 0;

      while (i + 1 < s.length) {
        buffer.put(
          getCode(s.charAt(i) ) * 45 +
          getCode(s.charAt(i + 1) ), 11);
        i += 2;
      }

      if (i < s.length) {
        buffer.put(getCode(s.charAt(i) ), 6);
      }
    };

    var getCode = function(c) {

      if ('0' <= c && c <= '9') {
        return c.charCodeAt(0) - '0'.charCodeAt(0);
      } else if ('A' <= c && c <= 'Z') {
        return c.charCodeAt(0) - 'A'.charCodeAt(0) + 10;
      } else {
        switch (c) {
        case ' ' : return 36;
        case '$' : return 37;
        case '%' : return 38;
        case '*' : return 39;
        case '+' : return 40;
        case '-' : return 41;
        case '.' : return 42;
        case '/' : return 43;
        case ':' : return 44;
        default :
          throw 'illegal char :' + c;
        }
      }
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qr8BitByte
  //---------------------------------------------------------------------

  var qr8BitByte = function(data) {

    var _mode = QRMode.MODE_8BIT_BYTE;
    var _data = data;
    var _bytes = qrcode.stringToBytes(data);

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return _bytes.length;
    };

    _this.write = function(buffer) {
      for (var i = 0; i < _bytes.length; i += 1) {
        buffer.put(_bytes[i], 8);
      }
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qrKanji
  //---------------------------------------------------------------------

  var qrKanji = function(data) {

    var _mode = QRMode.MODE_KANJI;
    var _data = data;

    var stringToBytes = qrcode.stringToBytesFuncs['SJIS'];
    if (!stringToBytes) {
      throw 'sjis not supported.';
    }
    !function(c, code) {
      // self test for sjis support.
      var test = stringToBytes(c);
      if (test.length != 2 || ( (test[0] << 8) | test[1]) != code) {
        throw 'sjis not supported.';
      }
    }('\\u53cb', 0x9746);

    var _bytes = stringToBytes(data);

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return ~~(_bytes.length / 2);
    };

    _this.write = function(buffer) {

      var data = _bytes;

      var i = 0;

      while (i + 1 < data.length) {

        var c = ( (0xff & data[i]) << 8) | (0xff & data[i + 1]);

        if (0x8140 <= c && c <= 0x9FFC) {
          c -= 0x8140;
        } else if (0xE040 <= c && c <= 0xEBBF) {
          c -= 0xC140;
        } else {
          throw 'illegal char at ' + (i + 1) + '/' + c;
        }

        c = ( (c >>> 8) & 0xff) * 0xC0 + (c & 0xff);

        buffer.put(c, 13);

        i += 2;
      }

      if (i < data.length) {
        throw 'illegal char at ' + (i + 1);
      }
    };

    return _this;
  };

  //=====================================================================
  // GIF Support etc.
  //

  //---------------------------------------------------------------------
  // byteArrayOutputStream
  //---------------------------------------------------------------------

  var byteArrayOutputStream = function() {

    var _bytes = [];

    var _this = {};

    _this.writeByte = function(b) {
      _bytes.push(b & 0xff);
    };

    _this.writeShort = function(i) {
      _this.writeByte(i);
      _this.writeByte(i >>> 8);
    };

    _this.writeBytes = function(b, off, len) {
      off = off || 0;
      len = len || b.length;
      for (var i = 0; i < len; i += 1) {
        _this.writeByte(b[i + off]);
      }
    };

    _this.writeString = function(s) {
      for (var i = 0; i < s.length; i += 1) {
        _this.writeByte(s.charCodeAt(i) );
      }
    };

    _this.toByteArray = function() {
      return _bytes;
    };

    _this.toString = function() {
      var s = '';
      s += '[';
      for (var i = 0; i < _bytes.length; i += 1) {
        if (i > 0) {
          s += ',';
        }
        s += _bytes[i];
      }
      s += ']';
      return s;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // base64EncodeOutputStream
  //---------------------------------------------------------------------

  var base64EncodeOutputStream = function() {

    var _buffer = 0;
    var _buflen = 0;
    var _length = 0;
    var _base64 = '';

    var _this = {};

    var writeEncoded = function(b) {
      _base64 += String.fromCharCode(encode(b & 0x3f) );
    };

    var encode = function(n) {
      if (n < 0) {
        // error.
      } else if (n < 26) {
        return 0x41 + n;
      } else if (n < 52) {
        return 0x61 + (n - 26);
      } else if (n < 62) {
        return 0x30 + (n - 52);
      } else if (n == 62) {
        return 0x2b;
      } else if (n == 63) {
        return 0x2f;
      }
      throw 'n:' + n;
    };

    _this.writeByte = function(n) {

      _buffer = (_buffer << 8) | (n & 0xff);
      _buflen += 8;
      _length += 1;

      while (_buflen >= 6) {
        writeEncoded(_buffer >>> (_buflen - 6) );
        _buflen -= 6;
      }
    };

    _this.flush = function() {

      if (_buflen > 0) {
        writeEncoded(_buffer << (6 - _buflen) );
        _buffer = 0;
        _buflen = 0;
      }

      if (_length % 3 != 0) {
        // padding
        var padlen = 3 - _length % 3;
        for (var i = 0; i < padlen; i += 1) {
          _base64 += '=';
        }
      }
    };

    _this.toString = function() {
      return _base64;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // base64DecodeInputStream
  //---------------------------------------------------------------------

  var base64DecodeInputStream = function(str) {

    var _str = str;
    var _pos = 0;
    var _buffer = 0;
    var _buflen = 0;

    var _this = {};

    _this.read = function() {

      while (_buflen < 8) {

        if (_pos >= _str.length) {
          if (_buflen == 0) {
            return -1;
          }
          throw 'unexpected end of file./' + _buflen;
        }

        var c = _str.charAt(_pos);
        _pos += 1;

        if (c == '=') {
          _buflen = 0;
          return -1;
        } else if (c.match(/^\\s$/) ) {
          // ignore if whitespace.
          continue;
        }

        _buffer = (_buffer << 6) | decode(c.charCodeAt(0) );
        _buflen += 6;
      }

      var n = (_buffer >>> (_buflen - 8) ) & 0xff;
      _buflen -= 8;
      return n;
    };

    var decode = function(c) {
      if (0x41 <= c && c <= 0x5a) {
        return c - 0x41;
      } else if (0x61 <= c && c <= 0x7a) {
        return c - 0x61 + 26;
      } else if (0x30 <= c && c <= 0x39) {
        return c - 0x30 + 52;
      } else if (c == 0x2b) {
        return 62;
      } else if (c == 0x2f) {
        return 63;
      } else {
        throw 'c:' + c;
      }
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // gifImage (B/W)
  //---------------------------------------------------------------------

  var gifImage = function(width, height) {

    var _width = width;
    var _height = height;
    var _data = new Array(width * height);

    var _this = {};

    _this.setPixel = function(x, y, pixel) {
      _data[y * _width + x] = pixel;
    };

    _this.write = function(out) {

      //---------------------------------
      // GIF Signature

      out.writeString('GIF87a');

      //---------------------------------
      // Screen Descriptor

      out.writeShort(_width);
      out.writeShort(_height);

      out.writeByte(0x80); // 2bit
      out.writeByte(0);
      out.writeByte(0);

      //---------------------------------
      // Global Color Map

      // black
      out.writeByte(0x00);
      out.writeByte(0x00);
      out.writeByte(0x00);

      // white
      out.writeByte(0xff);
      out.writeByte(0xff);
      out.writeByte(0xff);

      //---------------------------------
      // Image Descriptor

      out.writeString(',');
      out.writeShort(0);
      out.writeShort(0);
      out.writeShort(_width);
      out.writeShort(_height);
      out.writeByte(0);

      //---------------------------------
      // Local Color Map

      //---------------------------------
      // Raster Data

      var lzwMinCodeSize = 2;
      var raster = getLZWRaster(lzwMinCodeSize);

      out.writeByte(lzwMinCodeSize);

      var offset = 0;

      while (raster.length - offset > 255) {
        out.writeByte(255);
        out.writeBytes(raster, offset, 255);
        offset += 255;
      }

      out.writeByte(raster.length - offset);
      out.writeBytes(raster, offset, raster.length - offset);
      out.writeByte(0x00);

      //---------------------------------
      // GIF Terminator
      out.writeString(';');
    };

    var bitOutputStream = function(out) {

      var _out = out;
      var _bitLength = 0;
      var _bitBuffer = 0;

      var _this = {};

      _this.write = function(data, length) {

        if ( (data >>> length) != 0) {
          throw 'length over';
        }

        while (_bitLength + length >= 8) {
          _out.writeByte(0xff & ( (data << _bitLength) | _bitBuffer) );
          length -= (8 - _bitLength);
          data >>>= (8 - _bitLength);
          _bitBuffer = 0;
          _bitLength = 0;
        }

        _bitBuffer = (data << _bitLength) | _bitBuffer;
        _bitLength = _bitLength + length;
      };

      _this.flush = function() {
        if (_bitLength > 0) {
          _out.writeByte(_bitBuffer);
        }
      };

      return _this;
    };

    var getLZWRaster = function(lzwMinCodeSize) {

      var clearCode = 1 << lzwMinCodeSize;
      var endCode = (1 << lzwMinCodeSize) + 1;
      var bitLength = lzwMinCodeSize + 1;

      // Setup LZWTable
      var table = lzwTable();

      for (var i = 0; i < clearCode; i += 1) {
        table.add(String.fromCharCode(i) );
      }
      table.add(String.fromCharCode(clearCode) );
      table.add(String.fromCharCode(endCode) );

      var byteOut = byteArrayOutputStream();
      var bitOut = bitOutputStream(byteOut);

      // clear code
      bitOut.write(clearCode, bitLength);

      var dataIndex = 0;

      var s = String.fromCharCode(_data[dataIndex]);
      dataIndex += 1;

      while (dataIndex < _data.length) {

        var c = String.fromCharCode(_data[dataIndex]);
        dataIndex += 1;

        if (table.contains(s + c) ) {

          s = s + c;

        } else {

          bitOut.write(table.indexOf(s), bitLength);

          if (table.size() < 0xfff) {

            if (table.size() == (1 << bitLength) ) {
              bitLength += 1;
            }

            table.add(s + c);
          }

          s = c;
        }
      }

      bitOut.write(table.indexOf(s), bitLength);

      // end code
      bitOut.write(endCode, bitLength);

      bitOut.flush();

      return byteOut.toByteArray();
    };

    var lzwTable = function() {

      var _map = {};
      var _size = 0;

      var _this = {};

      _this.add = function(key) {
        if (_this.contains(key) ) {
          throw 'dup key:' + key;
        }
        _map[key] = _size;
        _size += 1;
      };

      _this.size = function() {
        return _size;
      };

      _this.indexOf = function(key) {
        return _map[key];
      };

      _this.contains = function(key) {
        return typeof _map[key] != 'undefined';
      };

      return _this;
    };

    return _this;
  };

  var createDataURL = function(width, height, getPixel) {
    var gif = gifImage(width, height);
    for (var y = 0; y < height; y += 1) {
      for (var x = 0; x < width; x += 1) {
        gif.setPixel(x, y, getPixel(x, y) );
      }
    }

    var b = byteArrayOutputStream();
    gif.write(b);

    var base64 = base64EncodeOutputStream();
    var bytes = b.toByteArray();
    for (var i = 0; i < bytes.length; i += 1) {
      base64.writeByte(bytes[i]);
    }
    base64.flush();

    return 'data:image/gif;base64,' + base64;
  };

  //---------------------------------------------------------------------
  // returns qrcode function.

  return qrcode;
}();

// multibyte support
!function() {

  qrcode.stringToBytesFuncs['UTF-8'] = function(s) {
    // http://stackoverflow.com/questions/18729405/how-to-convert-utf8-string-to-byte-array
    function toUTF8Array(str) {
      var utf8 = [];
      for (var i=0; i < str.length; i++) {
        var charcode = str.charCodeAt(i);
        if (charcode < 0x80) utf8.push(charcode);
        else if (charcode < 0x800) {
          utf8.push(0xc0 | (charcode >> 6),
              0x80 | (charcode & 0x3f));
        }
        else if (charcode < 0xd800 || charcode >= 0xe000) {
          utf8.push(0xe0 | (charcode >> 12),
              0x80 | ((charcode>>6) & 0x3f),
              0x80 | (charcode & 0x3f));
        }
        // surrogate pair
        else {
          i++;
          // UTF-16 encodes 0x10000-0x10FFFF by
          // subtracting 0x10000 and splitting the
          // 20 bits of 0x0-0xFFFFF into two halves
          charcode = 0x10000 + (((charcode & 0x3ff)<<10)
            | (str.charCodeAt(i) & 0x3ff));
          utf8.push(0xf0 | (charcode >>18),
              0x80 | ((charcode>>12) & 0x3f),
              0x80 | ((charcode>>6) & 0x3f),
              0x80 | (charcode & 0x3f));
        }
      }
      return utf8;
    }
    return toUTF8Array(s);
  };

}();

(function (factory) {
  if (typeof define === 'function' && define.amd) {
      define([], factory);
  } else if (typeof exports === 'object') {
      module.exports = factory();
  }
}(function () {
    return qrcode;
}));
`,b=Object.assign({"../../../skills/lecpage/engine/runtime/aux-pages.css":r,"../../../skills/lecpage/engine/runtime/boot.js":a,"../../../skills/lecpage/engine/runtime/check.js":i,"../../../skills/lecpage/engine/runtime/console.js":o,"../../../skills/lecpage/engine/runtime/kit.css":l,"../../../skills/lecpage/engine/runtime/lecpage.css":s,"../../../skills/lecpage/engine/runtime/lecpage.js":p,"../../../skills/lecpage/engine/runtime/live/core.js":d,"../../../skills/lecpage/engine/runtime/live/http.js":c,"../../../skills/lecpage/engine/runtime/live/local.js":u,"../../../skills/lecpage/engine/runtime/live/sheets.js":f,"../../../skills/lecpage/engine/runtime/live/supabase.js":m,"../../../skills/lecpage/engine/runtime/screen.js":h,"../../../skills/lecpage/engine/runtime/unlock.js":g,"../../../skills/lecpage/engine/runtime/vendor/qrcode.js":v}),e={};for(const[n,t]of Object.entries(b))e[n.replace(/^.*\/engine\/runtime\//,"")]=t;const x={read:n=>{if(!(n in e))throw new Error("없음: "+n);return e[n]}};export{x as runtime};
