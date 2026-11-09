# AWS Amplify Hosting에 올리기 (끌어 놓기)

> AWS 콘솔에서 ZIP을 끌어다 놓으면 `https://<브랜치>.<앱ID>.amplifyapp.com`이 생깁니다. AWS 안에서 가장 쉬운 방법.

## 언제 고르나요
- 기관 AWS 계정은 있는데 S3·CloudFront 설정은 부담스러울 때.
- 고르지 말 것: 트래픽이 많을 때(전송 GB당 요금 → S3+CloudFront의 상시 무료 1TB가 더 유리), AWS 계정이 없을 때.

## 비용 (2026-11 확인)
- 전송 GB당 $0.15, 저장 GB당 월 $0.023, 빌드 분당 $0.01(끌어 놓기는 빌드 없음).
- 예) 30MB × 40명 × 3회 ≈ 3.5GB → 약 $0.5.
- 2025-07-15 이후 신규 계정은 무료 크레딧(최대 $200)으로 차감. 예전 계정의 12개월 무료(월 15GB 전송·5GB 저장)는 기간이 지나면 끝.
- ZIP 끌어 놓기 최대 5GB.
- 출처: https://aws.amazon.com/amplify/pricing/ · https://docs.aws.amazon.com/amplify/latest/userguide/manual-deploys.html

## 따라 하기 — 콘솔
1. 사이트 폴더의 **내용물**을 ZIP으로 압축(index.html이 ZIP 맨 위에 오게).
2. AWS 콘솔 → **AWS Amplify** → **새 앱 만들기(Create new app)** → **Git 없이 배포(Deploy without Git)**.
3. 앱 이름·브랜치 이름(예: `main`) 입력 → **끌어 놓기(Drag and drop)** → ZIP 놓기 → **저장 및 배포**.
4. 주소 확인: `https://main.<앱ID>.amplifyapp.com`.
5. 보안 헤더: 앱 → **호스팅 → 사용자 지정 헤더**에 `_headers`의 내용을 YAML 형식으로 입력 ⚠️(콘솔 형식 확인):
```yaml
customHeaders:
  - pattern: '**'
    headers:
      - key: Content-Security-Policy
        value: "<_headers의 CSP 한 줄>"
      - key: X-Content-Type-Options
        value: nosniff
      - key: Referrer-Policy
        value: strict-origin-when-cross-origin
  - pattern: 'assets/slides/**'
    headers:
      - key: Cache-Control
        value: 'public, max-age=3600'
```
6. 고칠 때: 같은 화면에서 새 ZIP을 다시 끌어 놓기.

## 따라 하기 — CLI(개발자)
```bash
APP_ID=$(aws amplify create-app --name lec-20261104 --query app.appId --output text)
aws amplify create-branch --app-id $APP_ID --branch-name main
# 업로드 URL을 받아 ZIP 올린 뒤 배포 시작
read JOB URL < <(aws amplify create-deployment --app-id $APP_ID --branch-name main --query '[jobId,zipUploadUrl]' --output text)
curl -T site.zip "$URL"
aws amplify start-deployment --app-id $APP_ID --branch-name main --job-id $JOB
```

## 확인하기
- `…/check.html` 초록, 콘솔 **모니터링**에서 전송량.

## 되돌리기·정리
- 이전 ZIP을 다시 끌어 놓기.
- 삭제: 앱 → **앱 설정 → 일반 → 앱 삭제** 또는 `aws amplify delete-app --app-id $APP_ID`.

## 연수가 끝난 뒤
- 남길 이유가 없으면 앱 삭제(저장 요금이 계속 붙음).
