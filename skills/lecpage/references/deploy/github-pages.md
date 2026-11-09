# GitHub Pages에 올리기

> GitHub 저장소에 사이트 파일을 넣으면 `https://<아이디>.github.io/<저장소>/` 주소로 열립니다. 무료.

## 언제 고르나요
- 실시간 기능이 없거나, 실시간은 Supabase·Sheets·Cloudflare 중계처럼 **다른 곳**에 둘 때.
- GitHub 계정이 있거나 만들 수 있을 때. 연수를 여러 번 고쳐 올릴 때(기록이 남음).
- 고르지 말 것: 사이트가 1GB를 넘을 때, 저장소를 비공개로 해야 할 때(무료는 공개 저장소만), 학교망이 `*.github.io`를 막을 때(내 도메인으로 해결 가능).

## 비용과 한도 (2026-11 확인)
- 0원. 사이트 1GB, 월 100GB 전송(권고 한도), 시간당 10번 빌드(Actions 배포는 예외).
- 온라인 사업·상업용 SaaS 용도는 금지. 연수 안내 사이트는 해당하지 않습니다.
- **응답 헤더를 바꿀 수 없습니다** → 보안 정책(CSP)은 `templates/deploy/csp-meta.html`의 `<meta>`로 넣습니다(엔진이 처리).
- 출처: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits

## 준비물
- GitHub 계정, lecpage가 만든 사이트 폴더(`dist/`, `index.html`이 맨 위에 있는 폴더). 강사용 파일(`dist-강사용/`의 운영안내·DESIGN·설계도)은 **올리지 않습니다**.
- 무료 계정은 **공개 저장소**라서 사이트 파일(교재 그림·원본 자료 포함)을 누구나 내려받을 수 있습니다. 공개 범위를 빌드할 때 정하세요: 링크(기본, 검색 제외) · 공개 · **암호**(페이지와 교재 그림까지 암호화되어 저장소에서도 내용이 안 보임). 교재 원본을 자료실에 넣었다면 암호를 권합니다.
- 파일이 100개를 넘으면(슬라이드가 많으면) 웹 업로드는 여러 번 나눠야 합니다(한 번에 100개, 파일당 25MiB). → GitHub Desktop 또는 아래 CLI 방법이 편합니다.

## 따라 하기 — 클릭만 (웹 업로드, 가장 쉬움)
1. https://github.com 로그인 → 오른쪽 위 **+** → **New repository**.
2. Repository name: 예) `lec-20261104` → **Public** 선택 → **Create repository**.
3. 새 저장소 화면의 **uploading an existing file** 링크(또는 **Add file → Upload files**)를 누릅니다.
4. 사이트 폴더 **안의 내용물**(index.html, console.html, assets 폴더 …)을 끌어다 놓습니다. 폴더 자체가 아니라 내용물입니다.
5. 아래 **Commit changes** 누르기.
6. 저장소 **Settings → Pages** → Build and deployment의 Source: **Deploy from a branch** → Branch: `main`, 폴더 `/ (root)` → **Save**.
7. 1~2분 뒤 같은 화면 위쪽에 `Your site is live at https://<아이디>.github.io/lec-20261104/`가 뜹니다.

> 메뉴 이름은 GitHub 화면 개편으로 바뀔 수 있습니다 ⚠️. "Pages" 설정만 찾으면 됩니다.

## 따라 하기 — 개발자 (Actions 자동 배포, 권장)
`templates/deploy/github-pages/.github/workflows/deploy-pages.yml`을 저장소에 넣으면 `main`에 올릴 때마다 자동 배포됩니다. `.md`·`.env`·`data/`는 자동으로 빠집니다.

```bash
cd site                                   # lecpage 빌드 결과 폴더
git init -b main
mkdir -p .github/workflows
cp ../skills/lecpage/templates/deploy/github-pages/.github/workflows/deploy-pages.yml .github/workflows/
git add . && git commit -m "lecpage site"
gh repo create lec-20261104 --public --source . --push
# 저장소 Settings → Pages → Source: GitHub Actions (한 번만)
gh workflow run deploy-pages.yml           # 또는 다음 push 때 자동
gh run watch
```
- 사이트가 `site/` 하위 폴더에 있으면 워크플로의 `SITE_DIR: "site"`로 바꿉니다.
- 공식 예시 기준 액션 버전: checkout@v6, configure-pages@v5, upload-pages-artifact@v4, deploy-pages@v4.

## 실시간 백엔드와 같이 쓸 때
- 주소가 `https://<아이디>.github.io` 이므로 node-server의 `LEC_ORIGINS`(또는 cf-relay의 허용 목록)에 이 주소를 넣습니다(경로 `/lec-20261104`는 넣지 않음).
- blueprint `deploy.base`는 `/<저장소이름>/`입니다. 엔진은 상대 경로를 쓰므로 보통 그대로 동작합니다.

## 확인하기
1. 주소를 휴대폰(데이터)과 학교 PC 두 곳에서 엽니다.
2. `…/check.html`을 열어 모두 초록인지 봅니다.
3. `…/console.html`에서 관리자 키 입력 → 실시간 연결 상태 확인.
4. 브라우저 개발자 도구 콘솔에 `Content-Security-Policy` 오류가 없는지(개발자).

## 되돌리기·고치기
- 웹: 고친 파일을 다시 **Upload files**로 덮어쓰기 → 자동 재배포.
- 이전 버전으로: 저장소 **Commits**에서 이전 커밋 → **Revert**(웹) 또는 `git revert <커밋>` 후 push.

## 연수가 끝난 뒤
- 보관: 저장소를 그대로 두면 기록용 사이트가 됩니다. 실시간 주소가 죽었다면 엔진에서 `live.provider: none`으로 다시 빌드해 올리면 깔끔합니다.
- 내리기: **Settings → Pages → Unpublish site**(사이트만 내림) 또는 **Settings → General → Delete this repository**(전부 삭제).
- 실시간 데이터는 저장소가 아니라 백엔드에 있습니다. 백엔드 가이드의 삭제 절차를 따릅니다.

## 자주 막히는 곳
- 404: Pages 설정이 안 됐거나, 폴더째 올려서 `index.html`이 한 단계 안에 있음 → 내용물만 다시 올리기.
- 슬라이드가 안 보임: 대소문자 다른 파일 이름(GitHub Pages는 대소문자 구분).
- 학교에서만 안 열림: `*.github.io` 차단 → `custom-domain-and-short-url.md` 또는 `school-network-checklist.md`.
