# Vercel에 올리기

> Git 저장소를 연결하거나 CLI 한 줄로 `https://<이름>.vercel.app`에 올립니다. 무료(Hobby)는 **비상업 개인 용도만**.

## 언제 고르나요
- 이미 Vercel을 쓰는 개발자, 사이트만 올릴 때(실시간은 Supabase·Sheets·cf-relay).
- 고르지 말 것: **강사료를 받는 연수**(Hobby 약관상 회색지대 → Cloudflare·GitHub Pages 권장), 실시간 서버를 Vercel 안에 두려는 경우(WebSocket은 공개 베타이고 Hobby 함수 최대 300초라 연결이 5분마다 끊김).
- 끌어 놓기도 됩니다(**Vercel Drop**, 아래). 다만 계속 쓰려면 가입해야 하고, 가입 뒤에도 Hobby의 비상업 조건은 같습니다.

## 비용과 한도 (2026-11 확인)
- Hobby 0원: 전송 월 100GB, CDN 요청 월 100만, 함수 호출 100만, 프로젝트 200개.
- 넘으면 대부분 **30일 동안 그 기능을 못 씀**. 상업 이용은 Pro 이상.
- 상업 이용의 예: 사이트 제작·호스팅에 대가를 받음, 광고, 결제. (기부 요청은 해당 안 됨)
- Vercel Drop(2026-06~): 계정 없이 정적 폴더를 올리면 **임시 주소**가 생기고, 저장(claim)하지 않으면 만료됩니다. 파일당 100MB, 한 번에 1GB.
- 출처(2026-11-09 확인): https://vercel.com/docs/drop · https://vercel.com/docs/plans/hobby · https://vercel.com/docs/limits/fair-use-guidelines · https://vercel.com/docs/functions/websockets

## 준비물
- Vercel 계정(GitHub 로그인 가능), Node.js(CLI 쓸 때).
- 사이트 폴더 맨 위에 `vercel.json`, `.vercelignore` (`templates/deploy/vercel/`에서 복사, `{{…}}` 치환).
- 빌드 결과 폴더(`dist/`)만 올립니다. 강사용 파일(`dist-강사용/`)은 넣지 않습니다. 공개 범위는 빌드할 때 링크(기본)·공개·암호 중에서 고릅니다.

## 따라 하기 — Vercel Drop(빠른 미리 보기)
1. https://vercel.com/drop 에 사이트 폴더를 끌어다 놓습니다.
2. 임시 주소가 생깁니다. 화면의 남은 시간이 지나면 사라집니다.
3. 계속 쓰려면 로그인해서 저장(claim)합니다.

## 따라 하기 — Git 연결(웹)
1. 사이트를 GitHub 저장소에 올립니다(`github-pages.md`의 1~5단계).
2. https://vercel.com/new → **Import Git Repository** → 저장소 선택.
3. Framework Preset: **Other**, Build Command: 비움, Output Directory: `.`(사이트가 하위 폴더면 그 폴더) → **Deploy**.
4. 이후 저장소에 올릴 때마다 자동 배포.

## 따라 하기 — CLI
```bash
cd site
cp ../skills/lecpage/templates/deploy/vercel/vercel.json .
cp ../skills/lecpage/templates/deploy/vercel/.vercelignore .
npx vercel@latest login
npx vercel@latest deploy --prod        # 처음엔 프로젝트 이름 질문에 답함
```

## 확인하기
- `https://<이름>.vercel.app/check.html` 초록 확인.
- `curl -sI https://<이름>.vercel.app/ | grep -i -E "content-security|x-frame"` 로 헤더 적용 확인.
- 대시보드 **Usage**에서 전송량 확인.

## 되돌리기·정리
- 대시보드 → 프로젝트 → **Deployments** → 이전 배포 **⋯ → Promote to Production**(즉시 되돌리기).
- 삭제: 프로젝트 **Settings → General → Delete Project**.

## 연수가 끝난 뒤
- 실시간 데이터는 백엔드 쪽에서 내보내기·삭제.
- 사이트를 남길지 정하고, 남기면 `live.provider: none`으로 다시 빌드해 배포.

## 자주 막히는 곳
- 미리보기 주소(`…-git-…vercel.app`)에 로그인 창: 미리보기 보호 기능. 참가자에게는 **Production 주소**만 안내.
- 헤더가 안 붙음: `vercel.json`이 Output Directory 맨 위에 있어야 함.
