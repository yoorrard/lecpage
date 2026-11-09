# Netlify에 올리기 (Netlify Drop 포함)

> 폴더를 끌어다 놓으면 바로 주소가 생깁니다. 무료는 **월 300크레딧**이고, 다 쓰면 **계정의 모든 사이트가 멈춥니다**.

## 언제 고르나요
- 지금 당장 모양을 확인하는 **미리 보기**(Drop), 클릭만 하는 선생님의 작은 사이트.
- 고르지 말 것: 슬라이드가 많은 큰 사이트를 여러 번 고쳐 올릴 때(배포 1회 15크레딧), 같은 계정에 중요한 다른 사이트가 있을 때(크레딧 소진 시 함께 멈춤).

## 비용과 한도 (2026-11 확인, 2025-09-04 이후 가입 계정 기준)
- Free: 월 300크레딧 **하드 한도**(추가 구매 불가).
  - 운영 배포 1회 = 15크레딧, 전송 1GB = 20크레딧, 요청 1만 건 = 2크레딧, 폼 제출 무료.
  - 예) 30MB 사이트 × 40명 × 3회 ≈ 3.5GB → 70크레딧 + 배포 10회 150크레딧 = 220크레딧.
- 다 쓰면 모든 프로젝트가 "Site not available"이 되고 다음 달까지 배포도 안 됩니다.
- 새 계정의 새 프로젝트는 **비공개로 시작**합니다 → 공개(publish)를 눌러야 참가자가 볼 수 있습니다.
- **Netlify Drop(계정 없이 올리기)**:
  - 올리는 데는 계정이 필요 없지만, **저장(claim)하기 전에는 비밀번호로 잠겨 있어 참가자가 볼 수 없습니다.** 나누려면 가입하고 저장해야 합니다.
  - **1시간 안에** 저장하지 않으면 사이트가 정지되고, 1주 뒤 지워집니다.
  - 익명으로 올릴 수 있는 사이트는 **IP 하나당 3개**. 학교는 건물 전체가 IP 하나라 사실상 학교당 3개입니다.
  - 2026년 여름부터 Drop으로 만든 사이트도 다시 올리기·내 도메인 연결이 됩니다.
- 출처(2026-11-09 확인): https://www.netlify.com/blog/thirteen-years-of-netlify-drop · https://www.netlify.com/pricing/ · https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/ · https://docs.netlify.com/deploy/create-deploys/

## 준비물
- 빌드 결과 폴더(`dist/`, 앱에서는 "사이트 파일"). 강사용 파일(`dist-강사용/`)은 올리지 않습니다. 필요하면 `netlify.toml`(`templates/deploy/netlify/`).
- 공개 범위는 빌드할 때 정합니다: 링크(기본, 검색 제외) · 공개 · 암호(내용 암호화). Netlify 자체 비밀번호 기능은 유료라, 잠가야 하면 lecpage의 **암호**를 쓰세요.

## 따라 하기 — Netlify Drop (클릭만)
1. https://app.netlify.com/drop 접속.
2. 사이트 **폴더**를 점선 상자에 끌어다 놓기(ZIP이면 먼저 압축 풀기).
3. 주소(예: `https://random-name-123.netlify.app`)가 생깁니다.
4. **1시간 안에** 화면 안내에 따라 로그인/가입 → 프로젝트를 내 팀에 저장(claim). 저장 전에는 비밀번호로 잠겨 있어 참가자가 볼 수 없습니다.
5. 프로젝트가 비공개로 표시되면 **Publish / Make public**(공개)을 누릅니다 ⚠️ 메뉴 이름은 바뀔 수 있음.
6. **Project configuration → Change project name**으로 주소를 `lec-20261104.netlify.app`처럼 바꿉니다.
7. 고칠 때: 프로젝트 **Deploys** 화면 아래 끌어 놓기 칸에 폴더를 다시 놓기.

## 따라 하기 — CLI
```bash
cd site
npx netlify-cli@latest login
npx netlify-cli@latest deploy --dir . --prod      # 처음엔 새 프로젝트 만들기 선택
```

## 확인하기
- `…/check.html` 초록 확인, 개발자 도구에서 CSP 오류 없음.
- **Team → Usage & billing**에서 남은 크레딧 확인(연수 전날 꼭).

## 되돌리기·정리
- **Deploys** → 이전 배포 → **Publish deploy**.
- 삭제: **Project configuration → Delete project**.

## 연수가 끝난 뒤
- 기록용으로 남기거나 삭제. 남길 때는 배포를 더 하지 않으면 크레딧이 거의 들지 않습니다.
- 실시간 데이터는 백엔드에서 삭제.

## 자주 막히는 곳
- 참가자가 "Not found/비공개"·비밀번호 창: 아직 저장(claim)하지 않았거나 프로젝트가 비공개. 저장한 뒤 공개로 바꿉니다.
- Drop이 더 안 올라감: 학교 IP의 익명 사이트 3개를 다 씀 → 가입해서 올리기.
- 갑자기 모든 사이트가 멈춤: 크레딧 소진. 다른 호스팅(Cloudflare)에 바로 다시 올리고 주소를 다시 안내.
