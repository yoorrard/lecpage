# Cloudflare에 올리기 (Pages 끌어 놓기 · Workers 정적 자산 · 실시간 중계)

> 사이트 파일은 **무료·무제한**으로 제공되고, 같은 계정에 실시간 중계(Durable Objects)까지 둘 수 있습니다. lecpage 기본 추천.

## 언제 고르나요
- **끌어 놓기(Pages)**: 클릭만 할 수 있는 선생님. 실시간 없음, 또는 Sheets·Supabase 사용.
- **Workers 정적 자산(CLI)**: 파일이 1,000개를 넘거나, 실시간 중계(cf-relay)를 같은 계정에 둘 때.
- **실시간 중계(cf-relay)**: 150명 넘음, 채팅·반응, 여러 주 과정, WebSocket 막힌 학교(SSE·폴링 자동 전환).

## 비용과 한도 (2026-11 확인)
- 정적 파일 요청: **무료·무제한**(Workers 요청 한도에 들어가지 않음).
- 끌어 놓기: 파일 1,000개·파일당 25MiB. Wrangler(CLI): 2만 개·25MiB. `_headers` 규칙 100개.
- 실시간 중계(무료 플랜): Workers 요청 10만/일, Durable Objects 요청 10만/일·실행 13,000GB-s/일, SQLite 저장 5GB(계정 전체). 들어오는 WebSocket 메시지는 20개가 요청 1개로 계산. **매일 00:00 UTC(한국 09:00)에 초기화**. 넘으면 오류 1027.
- 상업 이용 가능. 내 도메인 연결 가능(도메인 DNS를 Cloudflare로 옮기면 가장 쉬움).
- 출처: https://developers.cloudflare.com/workers/platform/pricing/ · https://developers.cloudflare.com/pages/platform/limits/ · https://developers.cloudflare.com/pages/get-started/direct-upload/

## 준비물
- 이메일로 Cloudflare 계정 만들기(https://dash.cloudflare.com/sign-up). 결제 정보 필요 없음.
- lecpage 사이트 폴더. 폴더 안에 `_headers`(엔진이 넣어 줌. 없으면 `templates/deploy/_headers` 복사 후 `{{…}}` 치환).

## 끌어 놓기
1. https://dash.cloudflare.com 로그인 → 왼쪽 **Workers & Pages**.
2. **Create application** → **Pages** 탭(또는 Get started) → **Drag and drop your files**.
3. Project name: 예) `lec-20261104` (주소가 `lec-20261104.pages.dev`가 됨).
4. 사이트 **폴더**(또는 ZIP)를 끌어다 놓기 → **Deploy site**.
5. 1분 안에 `https://lec-20261104.pages.dev` 가 열립니다.
6. 고칠 때: 프로젝트 → **Create a new deployment** → 다시 끌어 놓기.

> 주의: 끌어 놓기로 만든 프로젝트는 나중에 Git 자동 배포로 바꿀 수 없습니다(새 프로젝트를 만들어야 함). 메뉴 이름은 바뀔 수 있습니다 ⚠️.

## Workers 정적 자산 — 개발자(CLI)
```bash
# 폴더 구성: ./wrangler.jsonc , ./site/(index.html, _headers, .assetsignore …)
cp skills/lecpage/templates/deploy/cloudflare/wrangler.jsonc .
cp skills/lecpage/templates/deploy/cloudflare/.assetsignore site/
cp skills/lecpage/templates/deploy/_headers site/          # 엔진이 이미 넣었다면 생략
# wrangler.jsonc 의 {{SITE_NAME}}, {{COMPAT_DATE}} 치환
npx wrangler@4 login
npx wrangler@4 deploy
# → https://lec-20261104.<계정-하위도메인>.workers.dev
```
- `html_handling: auto-trailing-slash`(기본)라서 `/console.html`은 `/console`로 이동(307)해 열립니다. 링크는 그대로 동작합니다.
- 이전 버전으로: `npx wrangler@4 deployments list` → `npx wrangler@4 rollback <버전ID>`.

## 실시간 중계(cf-relay) 배포
코드는 `skills/lecpage/backends/cloudflare/`에 있습니다(백엔드 README가 최종 기준 ⚠️).
```bash
cd skills/lecpage/backends/cloudflare
npx wrangler@4 deploy                     # Durable Objects(SQLite)는 무료 플랜에서 사용 가능
# 설정 토큰 등 비밀값은 secret으로:
npx wrangler@4 secret put LEC_SETUP_TOKEN  # ⚠️ 이름은 백엔드 README 기준
```
- 나온 주소(예: `https://lec-relay.<계정>.workers.dev`)를 blueprint `live.url`에, 그리고 `{{LIVE_ORIGIN}}`에 `https://…` 와 `wss://…` 둘 다 넣고 다시 빌드합니다.
- 사이트 주소를 중계의 허용 목록에 넣습니다(설정 이름은 백엔드 README 기준 ⚠️).
- 클라이언트는 WebSocket → SSE → 폴링 순서로 붙습니다. WebSocket은 하이버네이션으로 쉬는 동안 비용이 들지 않습니다.

## 확인하기
1. `https://<주소>/check.html` → 모두 초록.
2. `console.html`에서 관리자 키 → 상태가 `live`(또는 `polling`)인지.
3. 개발자: `curl -sI https://<주소>/ | grep -i content-security-policy` 로 헤더 적용 확인.
4. 실시간: 대시보드 **Workers & Pages → (중계) → Metrics**에서 요청 수가 하루 10만에 한참 못 미치는지.

## 되돌리기·정리
- Pages: 프로젝트 → **Deployments** → 이전 배포의 **⋯ → Rollback**.
- Workers: `wrangler rollback`.
- 삭제: 프로젝트(또는 Worker) → **Settings → Delete**.

## 연수가 끝난 뒤
1. 콘솔에서 CSV 내보내기(출석·진행·질문·설문) → 보관.
2. 콘솔의 **전부 삭제**(purge) → 중계 저장소의 연수 데이터가 지워집니다.
3. 중계 Worker를 더 쓰지 않으면 삭제. 사이트는 `live.provider: none`으로 다시 빌드해 기록용으로 남겨도 됩니다.

## 자주 막히는 곳
- 학교에서 `*.pages.dev`·`*.workers.dev`가 막힘 → 내 도메인 연결(`custom-domain-and-short-url.md`).
- 한국에서 느림: 통신사별로 Cloudflare 경로가 해외를 거칠 수 있음 ⚠️ → check.html의 응답 시간을 보고, 느리면 슬라이드 화질을 낮추거나 다른 호스팅 비교.
- 오후에 실시간이 멈춤: 오류 1027(일일 한도). 폴링 간격을 늘리고 다음 날 09:00 KST 이후 재시도, 급하면 Workers Paid($5/월).
