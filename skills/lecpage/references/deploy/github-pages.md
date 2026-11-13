# GitHub Pages에 올리기

> 공개 저장소에 사이트 파일을 넣으면 `https://<계정>.github.io/<저장소>/`로 열립니다. 무료. 사이트 1GB·파일 100MiB까지라 큰 사이트를 받아 줍니다.
> 2026-11-11 확인(`docs/research/hosting-2026-11.md` §3.3).

## 언제 고르나요
| 고릅니다 | 고르지 않습니다 → 대신 |
|---|---|
| 사이트가 100MB를 넘거나(Vercel 불가) 25MB가 넘는 파일이 있음(Cloudflare 불가) | 사이트 파일이 공개 저장소에 놓이면 곤란 → 암호(`--password`)로 빌드하거나 Vercel·Cloudflare |
| Cloudflare 다음 후보 | 사이트가 900MB를 넘음 → 슬라이드 화질을 낮추고 영상은 유튜브 링크로 |
| 강사가 GitHub를 쓰고 `gh`에 로그인돼 있음. 고친 기록을 남기고 싶음 | 학교망이 `*.github.io`를 막음 → 내 도메인(`custom-domain-and-short-url.md`) |

## 비용과 한도 (0원)
- 사이트 1GB(엔진은 900MB에서 막음), 파일 하나 100MiB, 월 100GB 전송(권고), 시간당 10빌드(권고), 배포 한 번에 10분.
- 무료 계정은 **공개 저장소만** 게시됩니다. 사이트 파일(교재 그림·원본 포함)을 누구나 내려받을 수 있습니다. 암호로 빌드하면 저장소에서도 내용이 보이지 않습니다.
- 브랜치에서 게시하려면 올리는 계정이 저장소 관리자이고 **이메일 인증**을 마쳤어야 합니다. 갓 가입한 계정이 여기서 막힙니다.
- 응답 헤더를 바꿀 수 없습니다(`_headers`는 무시됨). CSP는 엔진이 페이지마다 `<meta>`로 넣습니다.
- 출처: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits · https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github · https://docs.github.com/en/get-started/learning-about-github/githubs-plans

## skill: 명령으로 올리기
```bash
cd dist && git init -b main && git add -A && git commit -m site \
  && gh repo create lec-20261111 --public --source=. --push \
  && gh api -X POST "repos/{owner}/{repo}/pages" -f 'source[branch]=main' -f 'source[path]=/'
# → https://<계정>.github.io/lec-20261111/  (처음에는 1~2분, 길면 10분 뒤)
```
- 대화 없이 돕니다(gh 2.89.0 `--help`로 플래그 확인). 인증은 `gh auth status`가 로그인 상태이거나 `GH_TOKEN`.
- 다시 배포: 다시 빌드한 뒤 `cd dist && git add -A && git commit -m update && git push`. 주소는 그대로이고, 빌드는 `dist/.git`을 지우지 않습니다.
- `dist/.git`이 생깁니다. 같은 `dist/`를 `pack`(ZIP)이나 wrangler로도 내보내면 `.git`까지 나갑니다. 그때는 `.git`을 지우거나 `cloudflare.md`의 `.assetsignore`를 씁니다.
- Actions로 배포하려면 `templates/deploy/github-pages/.github/workflows/deploy-pages.yml`을 저장소에 넣고 **Settings → Pages**의 Source를 **GitHub Actions**로 바꿉니다(맨 위의 `.md`와 `.env`·`data/`가 빠짐).

## 명령어 없이
**앱**: 배포하기에서 GitHub Pages를 고릅니다. 토큰 만들기 화면에서 **Repository access**를 **All repositories**로 고르고(이 항목은 주소로 미리 채울 수 없음) 맨 아래 **Generate token**. 권한(Administration·Contents·Pages 쓰기)은 미리 채워져 있습니다.

**웹 업로드**(앱도 명령도 없이):
1. https://github.com 로그인 → 오른쪽 위 **+** → **New repository** → 이름(예: `lec-20261111`) → **Public** → **Create repository**.
2. **uploading an existing file**(또는 **Add file → Upload files**) → `dist/` **안의 내용물**을 끌어다 놓기 → **Commit changes**. 한 번에 100개·파일당 25MiB라 많으면 나눠 올립니다.
3. **Settings → Pages** → Source **Deploy from a branch** → Branch `main`, `/ (root)` → **Save**.
4. 1~2분(길면 10분) 뒤 같은 화면 위쪽에 주소가 나옵니다. 고칠 때는 바뀐 파일을 같은 방법으로 덮어씁니다.

> 메뉴 이름은 GitHub 화면 개편으로 바뀔 수 있습니다 ⚠️.

## 참여 기능과 같이 쓸 때
- 사이트 origin은 `https://<계정>.github.io`입니다. node-server의 `LEC_ORIGINS`, cf-relay의 `ALLOWED_ORIGINS`에는 이 주소를 넣습니다(경로 `/lec-20261111`은 넣지 않음).
- 엔진은 상대 경로를 쓰므로 하위 경로(`/<저장소>/`)에서도 그대로 동작합니다.

## 확인하기
skill은 `curl -sI https://<계정>.github.io/<저장소>/ | head -1`이 `200`이 될 때까지 기다린 뒤(처음에는 1~2분, 길면 10분) 주소를 건넵니다.
1. 주소를 휴대폰(데이터)과 학교 PC 두 곳에서 엽니다. 연수 전날에는 참가자가 쓸 망에서 한 번 더(`school-network-checklist.md`).
2. `…/check.html`(접속 확인)이 모두 초록인지 봅니다.
3. `…/console.html`에서 관리자 키를 넣고 연결 상태를 봅니다.

## 되돌리기·정리
- 이전 판으로: `git revert <커밋>` 뒤 push. 웹에서는 저장소 **Commits**의 이전 커밋에서 **Revert**.
- 내리기: **Settings → Pages → Unpublish site**(사이트만), 또는 **Settings → General → Delete this repository**(전부).

## 연수가 끝난 뒤
- 저장소를 그대로 두면 기록용 사이트가 됩니다. 실시간 주소를 닫았다면 `live.provider: none`으로 다시 빌드해 올립니다.
- 참여 기록은 저장소가 아니라 백엔드에 있습니다. 백엔드 안내의 삭제 순서를 따릅니다.

## 자주 막히는 곳
| 증상 | 원인 → 대처 |
|---|---|
| 올렸는데 사이트가 게시되지 않음 | GitHub 이메일 인증을 안 마친 계정 → 인증한 뒤 다시 push |
| 404 | Pages가 꺼져 있음, 또는 폴더째 올려 `index.html`이 한 단계 안에 있음 → 내용물만 다시 배포 |
| `git commit`이 "Please tell me who you are"로 멈춤 | `dist/`에서 `git config user.name <계정>`과 `git config user.email <계정>@users.noreply.github.com` |
| 앱에서 올리다 멈춤(403·429) | GitHub API의 2차 제한(콘텐츠를 만드는 요청은 대체로 분당 80·시간당 500). 그림이 450장을 넘으면 걸릴 수 있음 ⚠️ → 잠시 뒤 다시 하거나 위 명령으로 |
| 슬라이드가 안 보임 | 파일 이름의 대소문자가 다름(GitHub Pages는 대소문자를 가림) |
| 학교에서만 안 열림 | `*.github.io` 차단 → `custom-domain-and-short-url.md`, `school-network-checklist.md` |
