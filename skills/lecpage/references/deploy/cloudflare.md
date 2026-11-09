# Cloudflare에 올리기 (끌어 놓기 · GitHub 연결 · 실시간 중계)

> 사이트 파일은 **무료·무제한**으로 제공되고, 같은 계정에 실시간 중계(Durable Objects)까지 둘 수 있습니다. 한도를 넘으면 오류가 날 뿐 요금이 청구되지 않습니다.

## 언제 고르나요
| 방법 | 맞는 선생님 | 특징 |
|---|---|---|
| **끌어 놓기(Pages)** | 클릭만 하는 선생님 | 폴더를 놓으면 끝. 파일 1,000개까지. 나중에 GitHub 연결로 못 바꿈 |
| **GitHub 연결(Workers Builds)** | GitHub에 사이트를 올려 두는 선생님 | 저장소에 올릴 때마다 자동 배포. 명령어 없음 |
| **명령줄(Wrangler)** | 개발자 | 파일 2만 개까지. 가장 빠름 |
| **실시간 중계(cf-relay)** | 100명 넘는 연수, 채팅·반응, 웹소켓이 막힌 학교 | **Deploy to Cloudflare 버튼**으로 명령어 없이 가능(가입 필요) |

Cloudflare는 새 프로젝트를 Pages보다 **Workers**로 시작하라고 안내합니다. 다만 Workers에는 화면 끌어 놓기가 없어서, 클릭만 하는 선생님께는 Pages 끌어 놓기를 그대로 권합니다.

## 비용과 한도 (2026-11-09 확인)
- 정적 파일 요청: **무료·무제한**(Workers 하루 10만 요청 한도에 들어가지 않음).
- 파일 수: 끌어 놓기 1,000개, Workers·Wrangler 2만 개. 파일당 25MiB. `_headers` 규칙 100개.
- GitHub 연결 빌드(Workers Builds, 무료): 월 3,000분, 동시 1개, 한 번에 20분까지.
- 실시간 중계(무료 플랜): Workers 요청 10만/일, Durable Objects 요청 10만/일·실행 13,000GB-s/일, SQLite 저장 5GB(계정 전체). 들어오는 웹소켓 메시지 20개가 요청 1개. **매일 09:00(한국 시간)에 초기화**. 넘으면 오류 1027.
- 상업 이용 가능.
- 출처: https://developers.cloudflare.com/workers/platform/pricing/ · https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/ · https://developers.cloudflare.com/pages/platform/limits/ · https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/

## 올리기 전에
- 빌드 결과 폴더(`dist/`, 앱에서는 "사이트 파일")만 올립니다. **강사용 파일**(`dist-강사용/`의 운영안내·DESIGN·설계도, 앱에서는 따로 받는 파일)은 올리지 않습니다.
- 공개 범위는 빌드할 때 정합니다. **링크**(기본: 주소·QR을 받은 사람만, 검색에서 빠짐) · **공개**(검색 허용) · **암호**(내용과 교재 그림까지 암호화). 암호는 10자 넘게, 낱말 서너 개를 이어 길게 정하세요. 잠긴 파일은 누구나 내려받을 수 있어서 짧은 암호는 컴퓨터로 맞혀 볼 수 있습니다.
- 계정: https://dash.cloudflare.com/sign-up (이메일만, 결제 정보 필요 없음).

## 끌어 놓기
1. https://dash.cloudflare.com 로그인 → 왼쪽 **Workers & Pages**.
2. **Create application** → **Pages** → **Drag and drop your files**(Upload assets).
3. Project name: 예) `lec-20261104` (주소가 `lec-20261104.pages.dev`가 됩니다).
4. 사이트 **폴더**(또는 ZIP)를 끌어다 놓기 → **Deploy site**.
5. 1분 안에 `https://lec-20261104.pages.dev`가 열립니다.
6. 고칠 때: 프로젝트 → **Create a new deployment** → 다시 끌어 놓기.

> 메뉴 이름은 바뀔 수 있습니다 ⚠️. 파일이 1,000개를 넘으면(슬라이드가 아주 많으면) 아래 GitHub 연결이나 명령줄을 쓰세요.

## GitHub 연결(Workers Builds)
명령어 없이, 저장소에 올리면 Cloudflare가 알아서 배포합니다.
1. GitHub 저장소를 이렇게 만듭니다(웹 업로드로 충분).
   - `site/` ← 빌드 결과 폴더의 내용물, 그리고 `templates/deploy/cloudflare/.assetsignore`
   - 맨 위 `wrangler.jsonc` ← `templates/deploy/cloudflare/wrangler.jsonc`. `{{SITE_NAME}}`(예: `lec-20261104`)과 `{{COMPAT_DATE}}`(오늘 날짜)를 바꿔 씁니다.
2. Cloudflare → **Workers & Pages** → **Create application** → **GitHub**(저장소 가져오기) → Cloudflare GitHub 앱을 **이 저장소만** 허용 → 저장소 선택.
3. 설정:
   - 이름: `wrangler.jsonc`의 `name`과 **똑같이**(다르면 실패).
   - Build command: 비움. Deploy command: `npx wrangler deploy`(기본값). Root directory: 비움.
4. **Save and Deploy** → `https://lec-20261104.<계정>.workers.dev`.
5. 고칠 때: 저장소의 `site/`를 고쳐 커밋하면 1~2분 뒤 자동 반영.

## 명령줄(Wrangler) — 개발자
```bash
# 폴더 구성: ./wrangler.jsonc , ./site/(index.html, _headers, .assetsignore …)
cp skills/lecpage/templates/deploy/cloudflare/wrangler.jsonc .
cp skills/lecpage/templates/deploy/cloudflare/.assetsignore site/
# wrangler.jsonc 의 {{SITE_NAME}}, {{COMPAT_DATE}} 치환
npx wrangler@4 login
npx wrangler@4 deploy
# → https://lec-20261104.<계정-하위도메인>.workers.dev
```
- `html_handling: auto-trailing-slash`(기본)라서 `/console.html`은 `/console`로 이동(307)해 열립니다. 링크는 그대로 동작합니다.
- 이전 버전으로: `npx wrangler@4 deployments list` → `npx wrangler@4 rollback <버전ID>`.
- 'Workers Caching'과 `run_worker_first`는 켜지 않습니다. 켜면 정적 요청도 하루 10만 한도에 들어갑니다.

## 실시간 중계(cf-relay)
코드: `skills/lecpage/backends/cloudflare/`(최종 기준은 그 폴더의 README). 강사 본인 계정에 올립니다. lecpage 운영자가 대신 운영하는 공용 중계는 없습니다.

**버튼으로(명령어 없음)**
1. 백엔드 README의 **Deploy to Cloudflare** 버튼을 누릅니다(https://deploy.workers.cloudflare.com/?url=https://github.com/yoorrard/lecpage/tree/main/skills/lecpage/backends/cloudflare).
2. Cloudflare 로그인 → GitHub 연결을 허락하면 이 폴더만 담은 저장소가 내 계정에 복사되고, 자동 배포(Workers Builds)가 붙습니다.
3. 값 넣기:
   - **`ADMIN_KEY`**: 강사 콘솔 비밀번호. 16자 넘게 길고 짐작하기 어렵게. 예시 값(`change-me-…`)을 그대로 두지 마세요.
   - `SETUP_TOKEN`: 비워 둡니다(여러 강사가 함께 쓰는 서버에만 씀).
4. 배포가 끝나면 `https://lecpage-live.<계정>.workers.dev`가 나옵니다. 확인: 주소 뒤에 `/api/health` → `{"ok":true,…}`.

**명령줄로**
```bash
cd skills/lecpage/backends/cloudflare
npm install                          # wrangler 4.151.3 고정
npx wrangler login
npx wrangler secret put ADMIN_KEY    # 한 강사 전용 서버. 공유 서버만 SETUP_TOKEN
npx wrangler deploy
```

**사이트와 잇기**
- 중계 주소를 blueprint `live.provider: "http"`, `live.url`에 넣고 다시 빌드합니다. CSP를 쓰는 호스팅이면 `{{LIVE_ORIGIN}}`에 `https://…`와 `wss://…`를 둘 다 넣습니다.
- 사이트 주소를 **`ALLOWED_ORIGINS`**(쉼표로 구분, 예: `https://lec-1104.pages.dev,https://lec.example.kr`)에 넣습니다. 버튼으로 만든 경우 내 GitHub에 복사된 저장소의 `wrangler.toml` `[vars]`를 고쳐 커밋하면 다시 배포됩니다(대시보드에서만 바꾸면 다음 배포 때 파일 값으로 돌아갈 수 있음).
- 그 밖의 값: `RETENTION_DAYS`(기본 30일), `MAX_UPLOAD_MB`, `ALLOWED_CODES`. `OPEN_INIT`은 `false` 그대로.
- 참가자 화면은 웹소켓 → SSE → 새로 읽기 순서로 붙습니다. 웹소켓은 쉬는 동안 비용이 들지 않습니다.

## 내 도메인
- Worker(GitHub 연결·명령줄·중계)에 내 도메인을 붙이려면 도메인이 **Cloudflare에 등록된 영역**이어야 합니다(네임서버를 Cloudflare로). Pages 끌어 놓기는 하위 도메인이면 CNAME만으로도 됩니다.
- 순서와 가격: `custom-domain-and-short-url.md`.

## 확인하기
1. `https://<주소>/check.html` → 모두 초록.
2. `console.html`에서 관리자 키 → 상태가 `live`(또는 `polling`).
3. 개발자: `curl -sI https://<주소>/ | grep -i -E "content-security|x-frame"`로 헤더 확인.
4. 실시간: 대시보드 **Workers & Pages → (중계) → Metrics**에서 오늘 요청 수가 10만에 한참 못 미치는지.

## 되돌리기·정리
- Pages: 프로젝트 → **Deployments** → 이전 배포의 **⋯ → Rollback**.
- Workers: 대시보드 **Deployments**에서 이전 버전으로, 또는 `wrangler rollback`. GitHub 연결이면 이전 커밋으로 되돌려도 됩니다.
- 삭제: 프로젝트(또는 Worker) → **Settings → Delete**.

## 연수가 끝난 뒤
1. 콘솔에서 CSV 내보내기(출석·진행·질문·설문) → 보관.
2. 콘솔의 **전부 삭제**(purge) → 중계 저장소의 연수 데이터가 지워집니다.
3. 중계 Worker를 더 쓰지 않으면 삭제. 사이트는 `live.provider: none`으로 다시 빌드해 기록용으로 남겨도 됩니다.

## 자주 막히는 곳
- 학교에서 `*.pages.dev`·`*.workers.dev`가 막힘 → 내 도메인 연결(`custom-domain-and-short-url.md`).
- 한국에서 첫 접속이 느림: 통신사에 따라 해외 데이터센터로 연결되기도 합니다(2026년 커뮤니티 보고, 공식 확인 없음 ⚠️). `https://<주소>/cdn-cgi/trace`의 `colo=`가 `ICN`이면 서울입니다. 느리면 슬라이드 화질을 낮춥니다. 두 번째 접속부터는 브라우저 캐시라 빠릅니다.
- 오후에 실시간이 멈춤: 오류 1027(일일 한도). 새로 읽기 간격을 늘리고 다음 날 09:00 이후 다시 시도, 급하면 Workers Paid(월 $5).
- GitHub 연결 빌드 실패 "name mismatch": 대시보드 이름과 `wrangler.jsonc`의 `name`을 같게.
