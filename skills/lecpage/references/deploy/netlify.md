# Netlify에 올리기

> 이미 Netlify를 쓰는 강사를 위한 선택지입니다. 새로 가입하는 강사에게는 권하지 않습니다. 2026-07-28 이후 만든 팀은 프로젝트가 **비공개로 시작**하고, 무료는 한 달에 20번쯤만 올릴 수 있고, 크레딧을 다 쓰면 **계정의 모든 사이트가 멈춥니다**.
> 2026-11-11 확인(`docs/research/hosting-2026-11.md` §3.4).

## 언제 고르나요
| 고릅니다 | 고르지 않습니다 → 대신 |
|---|---|
| 강사가 Netlify 계정·토큰을 이미 갖고 있음 | 새로 가입해야 함 → Vercel(앱), Cloudflare(skill) |
| 지난번에도 여기에 올림(같은 주소 유지) | 여러 번 고쳐 올릴 사이트, 같은 계정에 중요한 다른 사이트가 있음 → Cloudflare |

## 비용과 한도 (Free, 월 300크레딧)
- 크레딧은 **하드 한도**입니다: 운영 배포 1회 15, 전송 1GB당 20, 요청 1만 건당 2. 배포만 해도 한 달 20번이 끝입니다.
- 다 쓰면 모든 프로젝트가 "Site not available"이 되고 다음 달까지 올릴 수도 없습니다.
- API로 올리기는 분당 3회·하루 100회. ZIP은 파일 25,000개까지(크기 한도는 문서에 없음 ⚠️).
- **2026-07-28 이후 만든 팀**: 새 프로젝트가 비공개로 시작합니다(API·Drop·CLI 모두). 비공개 프로젝트는 소유자만 보고, 다른 사람에게는 권한 없음 화면이 나옵니다. API로 공개로 바꾸는 방법은 문서에 없습니다 ⚠️. 강사가 화면에서 바꿉니다.
- 2026-08-19 이후 무료 새 프로젝트에는 "Powered by Netlify" 배지가 붙습니다(설정에서 끌 수 있음).
- 출처: https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/ · https://docs.netlify.com/manage/security/secure-access-to-sites/project-visibility/ · https://docs.netlify.com/manage/projects/powered-by-netlify-badge/ · https://docs.netlify.com/api-and-cli-guides/api-guides/get-started-with-api/

## 토큰 (강사가 만듭니다)
https://app.netlify.com/user/applications#personal-access-tokens → **New access token** → 이름 `lecpage` → **Expiration** → **Generate token**. skill은 환경 변수 `NETLIFY_AUTH_TOKEN`으로만 넘기고 파일에 적지 않습니다.

## skill: 명령으로 올리기
```bash
NETLIFY_AUTH_TOKEN=… npx netlify-cli deploy --dir dist --prod --no-build --site-name lec-20261111
# 다음부터: --site-name 대신 --site <Project ID 또는 이름>
```
- 대화 없이 돕니다(netlify-cli 27.17.0 `--help`로 플래그 확인). `--site-name`은 없는 이름이면 새로 만듭니다. 팀이 여럿이면 `--team <slug>`.
- 올린 뒤 **강사에게 꼭 알립니다**: Netlify 프로젝트 화면에서 **Make public**을 눌러야 참가자가 봅니다(2026-07-28 이후 팀). 같은 설정은 **Project configuration → General → Visitor access → Project visibility**에 있습니다.
- 응답 헤더는 `dist/_headers`를 그대로 읽습니다.

## 명령어 없이
- **앱**: 배포하기에서 Netlify를 고르고 토큰을 붙여 넣습니다. 올린 뒤 **Make public**.
- **Netlify Drop**: 로그인한 채 https://app.netlify.com/drop 에 폴더를 놓습니다. 계정 없이 올리면 1시간 안에 claim해야 하고, claim 전에는 비밀번호로 잠겨 있으며, claim 뒤에도 새 팀은 비공개입니다. 익명 올리기는 하루 한도도 있습니다(학교는 공인 IP 하나를 같이 씀). 연수 주소로는 권하지 않습니다.
- 고칠 때: 프로젝트 **Deploys** 화면 아래 끌어 놓는 자리에 폴더를 다시 놓습니다.

## 확인하기
skill은 `curl -sI <주소>/ | head -1`로 먼저 봅니다. 비공개 프로젝트가 어떤 응답을 주는지는 확인하지 못했으니 ⚠️ `200`이어도 강사에게 아래 1번을 부탁합니다.
1. **로그아웃한 창**에서 주소를 엽니다. 권한 없음 화면이면 아직 비공개입니다.
2. `…/check.html`(접속 확인)이 모두 초록인지 봅니다. 연수 전날에는 참가자가 쓸 망에서 한 번 더(`school-network-checklist.md`).
3. **Team → Usage & billing**에서 남은 크레딧을 봅니다(연수 전날 꼭).

## 되돌리기·정리
- **Deploys** → 이전 배포 → **Publish deploy**.
- 삭제: **Project configuration → Delete project**. 토큰도 지웁니다.

## 연수가 끝난 뒤
- 남겨 둘 때는 더 올리지 않으면 크레딧이 거의 들지 않습니다.
- 참여 기록은 백엔드에서 내려받고 지웁니다.

## 자주 막히는 곳
| 증상 | 원인 → 대처 |
|---|---|
| 참가자에게 권한 없음·로그인 화면 | 프로젝트가 비공개 → **Make public**. 앞으로 만들 프로젝트는 **Team settings → General → Visitor access → Default project visibility** |
| 비밀번호 창 | 계정 없이 올린 Drop을 아직 claim하지 않음 → claim하고 **Make public** |
| 모든 사이트가 "Site not available" | 크레딧 소진 → 다른 곳(Cloudflare)에 바로 올리고 주소를 다시 안내 |
| 올리기가 거부됨(429) | 분당 3회·하루 100회 한도 → 잠시 뒤 다시 |
