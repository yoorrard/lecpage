# 학교망 점검표 (IT 담당자에게 보내는 문서)

> 연수 1~2주 전에 이 문서의 "요청서" 부분을 학교 정보 담당자(정보부장·전산 담당·교육청 망 담당)에게 보냅니다. 연수 3일 전과 당일 아침에 **check.html**(접속 확인)로 다시 확인합니다. 어디에 올렸든 **연수 전날, 참가자가 쓸 망에서 사이트 주소를 한 번 열어 봅니다**.

## 1. check.html로 먼저 확인하기
1. 연수 장소에서, 참가자가 쓸 **같은 망**(교사용 업무망/학생 무선망 등)에 붙은 기기로 `https://<사이트>/check.html`을 엽니다.
2. 항목별로 초록(됨)/빨강(막힘)/노랑(느림)이 나옵니다. 설계도의 `readiness.checks`(도구 사이트들)와 실시간 연결(WebSocket → SSE → 폴링)을 차례로 시험합니다 ⚠️ 세부 항목은 check.html 구현 기준.
3. 결과를 **복사**(또는 화면 캡처)해서 IT 담당자에게 보냅니다.
4. 결과를 blueprint `audience.blocked`에 넣으면 skill이 대안을 다시 고릅니다(infra-decision.md 규칙 G01·G19·G20).

## 2. 요청서 (복사해서 보내세요)

> 안녕하세요. ○월 ○일 ○시 ○○실에서 교원 연수(약 ○○명)를 진행합니다. 연수 사이트와 실시간 질문·투표 기능을 쓰려 하니, 아래 주소가 **교사/학생 무선망에서 HTTPS(443)로 열리도록** 확인 부탁드립니다.
>
> **1) 연수 사이트**
> - `{{SITE_HOST}}` (예: lec-1104.○○.workers.dev / lec-1104.vercel.app / lec-1104.pages.dev / ○○.github.io / lec.example.kr)
>
> **2) 글꼴·화면 효과(없어도 내용은 보이지만 있으면 좋음)**
> - `cdn.jsdelivr.net`
> - `fonts.googleapis.com`, `fonts.gstatic.com`
> - `hangeul.pstatic.net` (마루부리 글꼴을 쓸 때만)
>
> **3) 실시간 기능(아래 중 사용하는 것 하나)**
> - Supabase: `{{REF}}.supabase.co` — HTTPS와 **WebSocket(wss)** 둘 다
> - Google Sheets: `script.google.com`, `script.googleusercontent.com`
> - Cloudflare 중계: `{{RELAY_HOST}}` (예: lec-relay.○○.workers.dev) — HTTPS, **WebSocket(wss)**, **SSE(text/event-stream)**
> - 학교 서버: `{{SERVER_HOST}}` — 같은 조건
>
> **4) 연수 중 쓰는 도구 사이트**
> - {{TOOLS_HOSTS}} (예: chatgpt.com, gemini.google.com, padlet.com, canva.com …)
>
> **5) 기술 조건**
> - 포트: 443(HTTPS)만 사용합니다.
> - WebSocket 업그레이드를 허용해 주세요. 막혀 있으면 SSE·긴 대기 묻기(바뀌면 바로, 없으면 20초마다 한 번)로 자동 전환되지만 반응이 몇 초 늦어집니다. 30초 안쪽으로 붙잡는 HTTPS 요청을 끊지 않게 부탁드립니다.
> - 보안 장비의 **HTTPS 검사(SSL 복호화)** 가 WebSocket·SSE를 끊는 경우가 있습니다. 위 실시간 주소는 검사 예외로 해 주시면 좋습니다.
> - 응답 버퍼링(프록시가 SSE를 모아서 보내는 것)을 하지 않도록 부탁드립니다.
> - 참가자 ○○명이 같은 공인 IP로 나갑니다. 같은 IP에서 짧은 시간에 많은 요청이 생기니 IP별 속도 제한이 있다면 연수 시간 동안 완화 부탁드립니다.
>
> **6) 와이파이**
> - 동시 접속 ○○대가 가능한지(AP 한 대당 접속 한도), 연수실 AP 상태 확인 부탁드립니다.
>
> 감사합니다. (연락처: ○○○)

## 3. 호스팅별 기본 주소(필터에 걸리는지 확인할 것)
| 호스팅 | 주소 모양 |
|---|---|
| GitHub Pages | `*.github.io` |
| Cloudflare | `*.pages.dev`, `*.workers.dev` |
| Netlify | `*.netlify.app` |
| Vercel | `*.vercel.app` |
| Firebase | `*.web.app`, `*.firebaseapp.com` |
| AWS | `*.cloudfront.net`, `*.amplifyapp.com` |
| Azure | `*.azurestaticapps.net` |
| Render·Fly·Railway(`paas-node-hosting.md`) | `*.onrender.com`, `*.fly.dev`, `*.up.railway.app` |
| Cloudflare Quick Tunnel(임시) | `*.trycloudflare.com` |

공용 호스팅 주소는 같은 주소 아래 다른 사람 사이트도 있어서 **분류 필터가 통째로 막는 경우**가 있습니다 ⚠️. 이때 가장 확실한 해결은 **내 도메인**(`custom-domain-and-short-url.md`)입니다.

- 학교망만의 일이 아닙니다. 2024-05에는 국내 통신사 DNS에서 `*.vercel.app`이 안 열린다는 보고가 있었고, 내 도메인을 붙이면 열렸습니다(커뮤니티 글, 지금도 그런지는 모름 ⚠️).
- 교육청·학교망이 위 주소들을 막는다는 공개 자료는 찾지 못했습니다 ⚠️. 학교마다 다르니 현장에서 확인합니다.

## 4. 막혔을 때 대안 (우선순위)
1. **내 도메인 연결** → 필터 예외를 한 주소만 받으면 됨.
2. **실시간을 SSE·폴링이 되는 쪽으로**: cf-relay 또는 node-server(자동 전환). Sheets는 일반 HTTPS만 써서 잘 통과하는 편.
3. **글꼴·라이브러리 자체 포함**(CDN 차단 시) → 앱은 바로 배포(Pages)·Vercel·Netlify·Cloudflare·ZIP에 올릴 때 글꼴을 사이트 안에 담는 것이 기본, skill은 `publish`와 학교망(`network: restricted`)으로 답한 `make`에서 기본(끄기 `--no-bundle-fonts`), 그 밖에는 `--bundle-fonts`. Supabase 라이브러리(`cdn.jsdelivr.net`)가 막히면 실시간 없이 묻기로 이어 감.
4. **교실 LAN**(`local-lan-classroom.md`): 학교망을 아예 쓰지 않음.
5. **휴대폰 데이터로 접속** 안내(참가자 동의 하에, 데이터 소모 안내).
6. **ZIP 배포**(`zip-usb-offline.md`): 실시간 없이 자료만.

## 5. 비용
- 0원. 다만 IT 담당자의 작업 시간이 필요하니 **1~2주 전**에 요청하세요.

## 6. 당일 아침 체크리스트
- [ ] 연수실 와이파이로 `check.html` 모두 초록(또는 대안 결정)
- [ ] `console.html` 관리자 키 입력 → 맨 위 '묻기 방식'이 '연결됨'이나 '긴 대기 묻기'(학교망), 그 아래 오늘 접속 확인 결과
- [ ] `screen.html` 프로젝터 출력, QR을 휴대폰 2대(안드로이드·아이폰)로 찍어 보기
- [ ] Supabase라면 프로젝트가 "일시 정지" 아님(lecpage는 익명 로그인을 쓰지 않아 한도 조정은 필요 없음)
- [ ] Cloudflare 중계라면 오늘 요청 수가 여유 있음(09:00 KST 초기화)
- [ ] 노트북 절전 끄기, 전원 연결
- [ ] 비상용: 앱 공개 카드의 '혹시 안 열리면'에서 받은 안내 한 장(두 번째 주소·접속 확인 QR·휴대폰 데이터 안내)과 사이트 ZIP·실습 인쇄본

## 7. 연수가 끝난 뒤
- 연수용으로 임시 허용한 예외(실시간 주소, HTTPS 검사 예외, 속도 제한 완화)는 **원래대로 돌려 달라고** IT 담당자에게 알립니다.
- 다음 연수에도 같은 주소를 쓰면 "상시 허용"으로 요청하는 편이 서로 편합니다(내 도메인 하나로 묶어 두면 쉬움).
