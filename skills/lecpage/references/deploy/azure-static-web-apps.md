# Azure Static Web Apps에 올리기

> Microsoft 계정으로 무료 정적 사이트(`https://<임의이름>.azurestaticapps.net`)를 만듭니다.

## 언제 고르나요
- 학교·기관이 Microsoft 365/Azure를 쓰고 있어 Azure 구독이 있을 때.
- 고르지 말 것: 사이트가 250MB를 넘을 때, Azure 구독(결제 수단)이 없을 때.

## 비용과 한도 (2026-11 확인)
- Free 플랜 0원: 전송 월 100GB, 환경당 저장 250MB(전체 500MB), 파일 15,000개, 내 도메인 2개, 미리보기 환경 3개.
- 출처: https://learn.microsoft.com/en-us/azure/static-web-apps/quotas · https://azure.microsoft.com/en-us/pricing/details/app-service/static/

## 준비물
- Azure 구독, Node.js(CLI 배포용).
- 사이트 폴더 맨 위에 `staticwebapp.config.json`(`templates/deploy/azure/`에서 복사, `{{…}}` 치환).
- 빌드 결과 폴더(`dist/`)만 올립니다. 강사용 파일(`dist-강사용/`)은 올리지 않습니다. 공개 범위는 빌드할 때 정합니다: 링크(기본, 검색 제외) · 공개 · 암호(페이지와 교재 그림 암호화, https 주소에서만 열림).

## 따라 하기 — 포털 + CLI
1. https://portal.azure.com → **리소스 만들기** → "Static Web App" 검색 → **만들기**.
2. 구독·리소스 그룹(새로 만들기: `lec-rg`), 이름 `lec-20261104`, 요금제 **Free**, 배포 원본 **기타(Other)** → **검토 + 만들기**.
3. 만든 리소스 → **개요 → 배포 토큰 관리**에서 토큰 복사.
4. 터미널:
```bash
cd site
cp ../skills/lecpage/templates/deploy/azure/staticwebapp.config.json .
npx @azure/static-web-apps-cli@latest deploy . --deployment-token "<토큰>" --env production
```
5. 개요의 **URL**로 접속.

> GitHub 저장소를 쓰면 2단계에서 배포 원본을 **GitHub**로 고르면 워크플로가 자동으로 만들어집니다(앱 위치 `/`, 빌드 없음).

## 확인하기
- `…/check.html` 초록. `curl -sI <URL> | grep -i content-security`.

## 되돌리기·정리
- 이전 폴더로 다시 `deploy`.
- 삭제: 리소스 그룹 `lec-rg` 삭제(안의 모든 것 삭제).

## 연수가 끝난 뒤
- 실시간 데이터는 백엔드에서 삭제. 사이트를 남기지 않으면 리소스 그룹 삭제.

## 자주 막히는 곳
- 배포 토큰은 비밀번호와 같습니다. 저장소에 올리지 마세요(유출 시 포털에서 **토큰 다시 설정**).
