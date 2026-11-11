# Cloudflare에 올리기 (끌어 놓기 · wrangler · 실시간 중계)

> 정적 파일 요청이 **무료·무제한**이고 강사료를 받는 연수에도 쓸 수 있습니다. skill(명령 가능)의 기본 올릴 곳이고, 같은 계정에 실시간 중계(Durable Objects)도 둘 수 있습니다.
> 2026-11-11 확인(`docs/research/hosting-2026-11.md` §3.2). 대시보드 글자는 공식 문서 기준이고 실제 배포는 해 보지 않았습니다 ⚠️.

## 어느 길로
| 길 | 누가 | 주소 | 한도 |
|---|---|---|---|
| **끌어 놓기**(Pages) | 클릭만 하는 강사. 앱에서 받은 ZIP을 그대로 | `<이름>.pages.dev` | 1,000개, 파일당 25MiB |
| **wrangler**(Workers 정적 자산) | skill | `<이름>.<계정>.workers.dev` | 20,000개, 파일당 25MiB |
| ↳ 계정이 아직 없으면 `--temporary` | skill | 같은 모양. **60분 안에 Claim** | 1,000개, 파일당 5MiB |
| Cloudflare Drop | 가입 전에 먼저 보기 | `workers.dev`. 60분 안에 **Claim** | 1,000개, 파일당 5MiB |
| GitHub 연결(Workers Builds) | 저장소로 관리하는 개발자 | `workers.dev` | 빌드 월 3,000분 |
| 실시간 중계(cf-relay) | 100명 넘는 연수, 웹소켓이 막힌 학교 | 따로 만든 Worker | 아래 "비용과 한도" |

- Cloudflare는 새 프로젝트를 Workers로 시작하라고 안내합니다(Pages 종료 일정은 없음). 대시보드 끌어 놓기는 Pages에만 있습니다.
- `decide-infra`는 파일이 1,000개를 넘거나 25MB가 넘는 파일이 있으면 Cloudflare를 맨 뒤로 보냅니다(끌어 놓기·임시 계정 기준). 로그인한 wrangler는 20,000개까지 올립니다.

## 비용과 한도
- 정적 자산 요청은 **무료·무제한**입니다(Worker 코드가 도는 요청만 하루 10만). 상업 이용 가능. 한도를 넘으면 오류가 날 뿐 요금이 청구되지 않습니다.
- `_headers` 규칙은 100개까지. 엔진이 만든 `dist/_headers`를 그대로 읽습니다.
- `workers.dev` 주소는 Cloudflare가 "개인·취미용"으로 봅니다. Browser Integrity Check를 끌 수 없습니다.
- Workers 정적 자산은 `Range` 요청에도 파일 전체를 `200`으로 줍니다. Safari에서 사이트 안 동영상이 안 나올 수 있으니 영상은 유튜브 링크로 둡니다.
- 'Workers Caching'과 `run_worker_first`는 켜지 않습니다. 켜면 정적 요청도 하루 10만 한도에 들어갑니다.
- 실시간 중계(무료): Workers 요청 10만/일, Durable Objects 요청 10만/일·13,000GB-s/일, SQLite 읽기 500만 행/일·쓰기 10만 행/일·저장 5GB. 들어오는 웹소켓 메시지 20개가 요청 1개. **매일 09:00(한국 시간)에 초기화**, 넘으면 오류 1027.
- 출처: https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/ · https://developers.cloudflare.com/workers/platform/limits/ · https://developers.cloudflare.com/pages/platform/limits/ · https://developers.cloudflare.com/workers/configuration/routing/workers-dev/ · https://developers.cloudflare.com/durable-objects/platform/pricing/

## 올리기 전에
- 빌드 결과 폴더(`dist/`, 앱에서는 "사이트 파일")만 올립니다. **강사용 파일**(`dist-강사용/`, 앱에서는 따로 받는 파일)은 올리지 않습니다.
- 공개 범위(링크·공개·암호)는 빌드할 때 정합니다(`../infra-decision.md` §3.3).

## 끌어 놓기
강사가 직접 합니다. ZIP은 앱의 "사이트 파일 받기(ZIP)"나 `pack dist -o site.zip`으로 만듭니다.
1. https://dash.cloudflare.com/sign-up 에서 가입합니다(이메일만, 결제 정보 없음).
2. 왼쪽 **Workers & Pages** → **Create application** → **Get started** → **Drag and drop your files**.
3. 프로젝트 이름을 적습니다. 예) `lec-20261111` → 주소가 `lec-20261111.pages.dev`.
4. ZIP을 **그대로** 끌어다 놓고(폴더도 됨) **Deploy site**.
5. 고칠 때: 프로젝트에서 **Create a new deployment** → 새 ZIP. 주소는 그대로입니다.

- 끌어 놓기로 만든 프로젝트는 나중에 Git 연결로 바꿀 수 없습니다.
- 가입 전에 먼저 보려면 https://www.cloudflare.com/drop/ 에 ZIP을 놓습니다. `workers.dev` 주소가 바로 생기고, **60분 안에 Claim**(가입·이메일 인증)하지 않으면 지워집니다. claim한 뒤 브라우저로 같은 주소에 다시 올리는 방법은 문서에 없습니다 ⚠️. 연수 주소는 위 순서로 만듭니다.

## skill: wrangler로 올리기
```bash
# 작업 폴더(dist/의 위)에서. 이름은 소문자·숫자·하이픈
D="$PWD/dist"; (cd "$(mktemp -d)" && npx wrangler@4 deploy --assets "$D" --name lec-20261111 --compatibility-date 2026-11-11)
# → https://lec-20261111.<계정>.workers.dev
```
설정 파일 없이, 대화 없이 돕니다(4.160.0에서 `--dry-run`으로 확인).

**빈 임시 폴더에서 돌리는 까닭**: wrangler는 실행한 폴더와 그 위쪽 폴더에서 `wrangler.json`·`wrangler.jsonc`·`wrangler.toml`을 찾아 읽습니다. 하나라도 있으면 그 프로젝트의 코드와 변수가 이 이름으로 함께 올라갑니다(dry-run으로 확인. lecpage 저장소 맨 위에도 `wrangler.jsonc`가 있음). `decide-infra`가 내는 한 줄(`--assets ./dist`)은 위쪽에 그런 파일이 없을 때만 그대로 씁니다. 아래 wrangler 명령도 같은 식으로 돌립니다.

인증은 위에서부터 맞는 것 하나:

| 상태 | 하는 일 |
|---|---|
| `npx wrangler@4 whoami`가 계정을 보여 줌 | 위 명령 그대로 |
| 강사가 API 토큰을 환경 변수로 넣어 줌(**Edit Cloudflare Workers** 템플릿) | `CLOUDFLARE_API_TOKEN`·`CLOUDFLARE_ACCOUNT_ID`가 있으면 위 명령 그대로 |
| 계정은 있는데 로그인 전 | 강사에게 `npx wrangler@4 login`을 부탁(브라우저에서 승인. 브라우저가 안 열리는 환경은 `--device`) |
| 계정이 없음 | 명령 끝에 `--temporary` |

`--temporary`(임시 계정에 먼저 올리기)
- 올린 뒤 나오는 claim 주소를 강사에게 줍니다. **60분 안에** 그 주소에서 가입해야 사이트가 남고, 아니면 계정째 지워집니다.
- 1,000개·파일당 5MiB까지. 넘으면 쓰지 않습니다.
- 대화 없는 셸에서는 Cloudflare 약관·개인정보 처리방침에 동의한 것으로 치고 바로 진행합니다. **실행하기 전에 강사에게 알리고 동의를 받습니다.**
- 이미 로그인했거나 토큰이 있으면 오류가 납니다. 그때는 빼고 실행합니다.
- `--help`에 나오지 않는 플래그입니다(4.160.0 소스에서 확인, 4.102.0 이상).
- claim한 뒤 고칠 때는 `npx wrangler@4 login` 다음 `--temporary` 없이 같은 명령.

알아 둘 것
- wrangler는 `dist/` 안의 숨은 폴더도 그대로 올립니다(로컬에서 확인). `dist/.git`이 있으면(GitHub Pages에 올린 적이 있으면) `<skill 폴더>/templates/deploy/cloudflare/.assetsignore`를 `dist/`에 복사합니다.
- `/console.html`은 `/console`로 307 이동해 열립니다. 링크는 그대로 동작합니다.
- 다시 올리기: 같은 `--name`으로 같은 명령. 주소는 그대로입니다.
- 이전 판으로: `npx wrangler@4 deployments list --name <이름>` → `npx wrangler@4 rollback <버전ID> --name <이름>`.

`pages.dev` 주소로 올릴 때(내 도메인을 CNAME만으로 붙이려 할 때 등):
```bash
D="$PWD/dist"; cd "$(mktemp -d)"
npx wrangler@4 pages project create lec-20261111 --production-branch main   # 처음 한 번
npx wrangler@4 pages deploy "$D" --project-name lec-20261111 --branch main
```

## GitHub 연결(Workers Builds)
저장소에 올릴 때마다 Cloudflare가 배포합니다. 명령어는 필요 없습니다.
1. 저장소 구성: `site/`에 `dist/`의 내용물과 `templates/deploy/cloudflare/.assetsignore`, 맨 위에 `templates/deploy/cloudflare/wrangler.jsonc`(`{{SITE_NAME}}`, `{{COMPAT_DATE}}`를 바꿔 씀).
2. Cloudflare → **Workers & Pages** → **Create application** → 저장소 가져오기 → Cloudflare GitHub 앱을 **이 저장소만** 허용.
3. 이름은 `wrangler.jsonc`의 `name`과 **똑같이**(다르면 실패). Build command는 비우고 Deploy command는 `npx wrangler deploy` 그대로.
4. 배포되면 `https://<이름>.<계정>.workers.dev`. 고칠 때는 `site/`를 고쳐 커밋합니다.

## 실시간 중계(cf-relay)
코드: `skills/lecpage/backends/cloudflare/`(최종 기준은 그 폴더의 README). 강사 본인 계정에 올립니다. lecpage 운영자가 대신 운영하는 공용 중계는 없습니다.

**skill이 직접**: README §2의 명령을 그대로 돌립니다. 강사는 `npx wrangler login`으로 로그인하거나 토큰을 환경 변수로 넣어 주기만 하고, 관리자 키는 skill이 만들어 파일로 건넵니다.

**버튼으로(강사가 명령어 없이)**
1. 백엔드 README의 **Deploy to Cloudflare** 버튼을 누릅니다(https://deploy.workers.cloudflare.com/?url=https://github.com/yoorrard/lecpage/tree/main/skills/lecpage/backends/cloudflare).
2. Cloudflare에 로그인하고 GitHub(또는 GitLab) 연결을 허락합니다. 이 폴더만 담은 저장소가 **강사의 GitHub 계정에 복사**되므로 GitHub 계정도 있어야 합니다. 자동 배포(Workers Builds)가 붙습니다.
3. 값 넣기:
   - **`ADMIN_KEY`**: 강사 화면 비밀번호. 16자 넘게 길고 짐작하기 어렵게. 예시 값(`change-me-…`)을 그대로 두지 않습니다.
   - `SETUP_TOKEN`: 비워 둡니다(여러 강사가 함께 쓰는 서버에만 씀).
4. 배포가 끝나면 `https://lecpage-live.<계정>.workers.dev`가 나옵니다. 확인: 주소 뒤에 `/api/health` → `{"ok":true,…}`.

**사이트와 잇기**
- 중계 주소를 `info.json`의 `live`(`provider: "http"`, `url`)에 넣고 `patch work/blueprint.json -i work/info.json`으로 다시 빌드합니다.
- 사이트 주소를 **`ALLOWED_ORIGINS`**(쉼표로 구분, 예: `https://lec-20261111.pages.dev,https://lec.example.kr`)에 넣습니다. 버튼으로 만든 경우 내 GitHub에 복사된 저장소의 `wrangler.toml` `[vars]`를 고쳐 커밋하면 다시 배포됩니다(대시보드에서만 바꾸면 다음 배포 때 파일 값으로 돌아갈 수 있음).
- 그 밖의 값: `RETENTION_DAYS`(기본 30일), `MAX_UPLOAD_MB`, `ALLOWED_CODES`. `OPEN_INIT`은 `false` 그대로.
- 참가자 화면은 웹소켓 → SSE → 새로 읽기 순서로 붙습니다. 웹소켓은 쉬는 동안 비용이 들지 않습니다.

## 내 도메인
- Worker(wrangler·GitHub 연결·중계)에 내 도메인을 붙이려면 도메인이 **Cloudflare에 등록된 영역**이어야 합니다(네임서버를 Cloudflare로). Pages는 하위 도메인이면 CNAME만으로 됩니다.
- 순서와 가격: `custom-domain-and-short-url.md`.

## 확인하기
1. `https://<주소>/check.html`(접속 확인) → 모두 초록.
2. `console.html`에서 관리자 키 → 상태가 `live`(또는 `polling`).
3. `curl -sI https://<주소>/ | grep -i -E "^HTTP|x-content-type"`로 응답과 헤더 확인.
4. 연수 전날, 참가자가 쓸 망에서 주소를 엽니다(`school-network-checklist.md`).
5. 실시간: 대시보드 **Workers & Pages → (중계) → Metrics**에서 오늘 요청 수가 10만에 한참 못 미치는지.

## 되돌리기·정리
- Pages: 프로젝트 → **Deployments** → 이전 배포의 **⋯ → Rollback**.
- Workers: 대시보드 **Deployments**에서 이전 버전으로, 또는 `wrangler rollback`.
- 삭제: 프로젝트(또는 Worker) → **Settings → Delete**. 명령은 `npx wrangler@4 delete <이름>`.

## 연수가 끝난 뒤
1. 강사 화면에서 CSV 내보내기(출석·진행·질문·설문) → 보관.
2. 강사 화면의 **전부 삭제**(purge) → 중계 저장소의 연수 데이터가 지워집니다.
3. 중계 Worker를 더 쓰지 않으면 삭제. 사이트는 `live.provider: none`으로 다시 빌드해 기록용으로 남겨도 됩니다.

## 자주 막히는 곳
| 증상 | 원인 → 대처 |
|---|---|
| 임시로 올린 사이트가 사라짐 | 60분 안에 claim하지 않음 → 가입한 뒤 다시 올리고 주소를 다시 안내 |
| "Could not authenticate … non-interactive" | 로그인·토큰이 없음 → 위 인증 표 |
| "already authenticated … `--temporary` can't be used" | `--temporary`를 빼고 실행 |
| "register a workers.dev subdomain" 오류로 멈춤 | 새 계정이라 `workers.dev` 주소가 아직 없음. 대화 없는 셸에서는 wrangler가 만들어 주지 않음 → 오류에 나온 `https://dash.cloudflare.com/<계정 ID>/workers/onboarding`을 강사가 한 번 열어 이름을 정한 뒤 다시 실행 |
| 끌어 놓기가 거부됨 | 파일 1,000개 또는 파일당 25MiB를 넘음 → wrangler(20,000개), 큰 파일은 GitHub Pages나 유튜브 링크 |
| 학교·통신사에서 `*.pages.dev`·`*.workers.dev`가 안 열림 | 내 도메인 연결(`custom-domain-and-short-url.md`) |
| 한국에서 첫 접속이 느림 | 통신사에 따라 해외 데이터센터로 연결되기도 함(커뮤니티 보고, 공식 확인 없음 ⚠️). `https://<주소>/cdn-cgi/trace`의 `colo=`가 `ICN`이면 서울. 느리면 슬라이드 화질을 낮춤 |
| 오후에 실시간이 멈춤 | 오류 1027(일일 한도). 새로 읽기 간격을 늘리고 다음 날 09:00 뒤에 다시. 급하면 Workers Paid(월 $5) |
| GitHub 연결 빌드 실패 "name mismatch" | 대시보드 이름과 `wrangler.jsonc`의 `name`을 같게 |
