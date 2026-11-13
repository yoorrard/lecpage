# Vercel에 올리기

> 토큰 하나로 `https://<프로젝트>.vercel.app`에 올립니다. 앱(브라우저만)의 기본 올릴 곳입니다.
> 2026-11-11 확인. 근거와 API 순서는 `docs/research/hosting-2026-11.md` §3.1·§10. 실제 배포로 끝까지 시험하지는 않았습니다 ⚠️.

## 언제 고르나요
| 고릅니다 | 고르지 않습니다 → 대신 |
|---|---|
| 앱에서 클릭만으로 공개(새 계정도 바로 열리고, 파일이 공개 저장소에 올라가지 않음) | 방문이 아주 많은 행사 → Cloudflare |
| 강사가 이미 Vercel을 쓰거나 `VERCEL_TOKEN`이 있음 | 사이트가 100MB를 넘음 → GitHub Pages |
| | 참여 기능 서버를 Vercel 안에 두려 함 → Sheets·Supabase·cf-relay(`../infra-decision.md`) |

Vercel 함수의 WebSocket은 최대 실행 시간(Hobby 300초)에 끊기고 상태를 둘 곳이 없습니다. 실시간 백엔드로 쓰지 않습니다.

## 비용과 한도 (Hobby, 0원)
| 항목 | 한도 |
|---|---|
| 한 번에 올리는 파일 | 합계 100MB, 15,000개(CLI 문서 기준) |
| 올리는 횟수 | 배포 하루 100회, 파일 업로드 하루 5,000개(다시 올릴 때는 바뀐 파일만 올라감) |
| 전송·요청 | 월 100GB, CDN 요청 월 100만(어림: 인원 × 파일 수 × 3) |
| 프로젝트·도메인 | 프로젝트 200개, 프로젝트당 도메인 50개 |
| 넘으면 | 대개 30일 뒤에 다시 쓸 수 있음 |

- Hobby에는 암호 보호가 없습니다. 잠가야 하면 lecpage의 암호(`--password`)를 씁니다.
- 출처: https://vercel.com/docs/limits · https://vercel.com/docs/plans/hobby · https://vercel.com/docs/limits/fair-use-guidelines · https://vercel.com/docs/functions/websockets

## 토큰 (강사가 만듭니다)
1. https://vercel.com/signup 에서 가입합니다(이메일 6자리 코드, 또는 GitHub·GitLab·Bitbucket 계정).
2. https://vercel.com/account/tokens → 이름 `lecpage` → **Scope**(내 팀) → **Expiration** → **Create**.
3. `vcp_`로 시작하는 값은 **한 번만** 보입니다. 바로 복사합니다.

skill은 토큰을 환경 변수 `VERCEL_TOKEN`으로만 넘기고 파일(설계도·info.json·`dist/`)에 적지 않습니다. 연수가 끝나면 같은 페이지에서 지웁니다.

## skill: 명령으로 올리기
```bash
S=<skill 폴더>/templates/deploy/vercel
cp $S/vercel.json $S/.vercelignore dist/     # 한 번만. 다시 빌드해도 남습니다
VERCEL_TOKEN=… npx vercel@latest deploy ./dist --prod --yes --project lec-20261111 --create-if-missing
```
- 대화 없이 돕니다(CLI 65.14.0 `--help`로 플래그 확인). 팀이 여럿이면 `--scope <팀>`.
- **참가자 주소는 운영 주소 `https://lec-20261111.vercel.app`** 입니다. 명령이 stdout에 내는 것은 배포별 주소(`<프로젝트>-<해시>-<팀>.vercel.app`)입니다. 그 판만 가리키고 Vercel 로그인을 요구할 수 있으니 **나눠 주지 않습니다**.
- 이름을 다른 사람이 쓰고 있으면 운영 주소가 `<프로젝트>-<팀>.vercel.app`처럼 잡힙니다. 프로젝트 **Settings → Domains**에서 확인합니다.
- 프로젝트 이름: 소문자·숫자·`.` `_` `-`, 100자까지, `---` 금지.
- 계정 없이 미리 보기만: `npx vercel@latest deploy ./dist --temporary`. 임시 주소이고, 화면에 나오는 시간 안에 **Claim Project**를 해야 남습니다. 연수 주소로 쓰지 않습니다.

## 명령어 없이
- **앱**: 공개하기에서 Vercel을 고르고 토큰을 붙여 넣은 뒤 [주소 만들기]. 앱이 `_headers`를 `vercel.json`으로 바꿔 올립니다.
- **Vercel Drop**: https://vercel.com/drop 에 폴더나 ZIP을 놓고, 로그인해 팀과 프로젝트 이름을 고른 다음 **Deploy**. 헤더를 붙이려면 폴더 맨 위에 `vercel.json`을 넣어 둡니다. 계정 없이 올리면 임시 주소입니다(파일당 100MB·합계 1GB, **Claim Project**를 눌러야 남음).

## 다시 올리기
- skill·앱: 같은 프로젝트 이름으로 다시 올립니다. 운영 주소가 새 배포로 옮겨 가고 주소는 그대로입니다.
- Drop으로 만든 프로젝트(Git 연결 없음): 대시보드의 그 프로젝트 위에 폴더를 놓으면 새 운영 배포가 됩니다.

## 응답 헤더
Vercel은 `_headers`를 읽지 않습니다. 올리는 폴더 맨 위 `vercel.json`의 `headers`가 맡습니다. 템플릿은 엔진이 만든 `dist/_headers`와 같은 규칙이라 그대로 복사합니다. CSP는 엔진이 페이지마다 `<meta>`로 넣습니다.

## 확인하기
1. 로그아웃한 창(시크릿 창)에서 `https://<프로젝트>.vercel.app/check.html`을 엽니다(접속 확인).
2. `curl -sI https://<프로젝트>.vercel.app/ | head -1`이 `200`인지 봅니다. `401`이면 아래 "로그인 창".
3. 연수 전날, 참가자가 쓸 망에서 주소를 엽니다(`school-network-checklist.md`).

## 자주 막히는 곳
| 증상 | 원인 → 대처 |
|---|---|
| 운영 주소에 Vercel 로그인 창(401) | 팀 기본값이 모든 배포 보호(All Deployments). 프로젝트 **Settings → Deployment Protection**에서 **Vercel Authentication**을 끕니다. 명령으로는 `curl -X PATCH "https://api.vercel.com/v9/projects/<프로젝트>" -H "Authorization: Bearer $VERCEL_TOKEN" -H "Content-Type: application/json" -d '{"ssoProtection":null}'`(Full Account 토큰으로 팀 프로젝트를 고칠 때는 `?teamId=…`). 끄면 예전 배포 주소도 모두 공개됩니다 |
| 참가자만 로그인 창을 봄 | 배포별 주소를 나눠 줌 → 운영 주소로 다시 안내 |
| "The token in VERCEL_TOKEN is not valid", 403 | 토큰이 틀렸거나 만료됐거나 범위 밖 → 새 토큰 |
| 429 | 하루 100배포·업로드 5,000개를 넘음 → 다음 날. 급하면 다른 곳에 올림 |
| 헤더가 안 붙음 | `vercel.json`이 올린 폴더 맨 위에 없음 |
| 특정 통신사·학교에서만 안 열림 | 2024-05에 국내 통신사 DNS에서 `*.vercel.app`이 안 열린다는 보고가 있었음(지금도 그런지는 모름 ⚠️) → 내 도메인(`custom-domain-and-short-url.md`) |

## 되돌리기·정리
- 이전 판으로: 대시보드 프로젝트 → **Deployments** → 이전 배포 **⋯ → Promote to Production**. 명령은 `npx vercel@latest rollback <배포 주소>`.
- 삭제: 프로젝트 **Settings → General → Delete Project**. 토큰도 토큰 페이지에서 지웁니다.

## 연수가 끝난 뒤
- 참여 기록은 백엔드 쪽에서 내려받고 지웁니다.
- 사이트를 남기면 `live.provider: none`으로 다시 빌드해 올립니다.
