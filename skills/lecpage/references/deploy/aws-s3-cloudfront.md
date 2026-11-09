# AWS에 올리기 (S3 + CloudFront · Amplify 끌어 놓기)

> 기관 AWS 계정이 있을 때 쓰는 두 가지 방법입니다.
> - **개발자·IT 담당자: S3 + CloudFront.** 비공개 S3 버킷 + CDN. 전송 월 1TB까지 무료라 보통 0원.
> - **콘솔 클릭: Amplify 끌어 놓기.** ZIP을 놓으면 주소가 생깁니다. 대신 전송 GB당 요금이 붙습니다.

## 언제 고르나요
- 학교·기관이 AWS 계정을 이미 쓰고 있을 때, 서울 리전에 파일을 두고 싶을 때.
- 고르지 말 것: 개인이 AWS를 처음 만드는 경우(신규 무료 플랜은 6개월 뒤 계정이 닫힘, 카드 필요) → Cloudflare가 더 쉬움.
- 실시간 서버도 AWS에 두려면 `aws-lightsail-docker.md`(서울).

## 비용 (2026-11 확인. 이번 2026-11-09 재검증에서는 다시 보지 않음 ⚠️)
| | S3 + CloudFront | Amplify Hosting |
|---|---|---|
| 전송 | CloudFront 종량제 **상시 무료 월 1TB**(요청 1천만 건 포함이라는 2차 출처 ⚠️). 또는 정액제 Free($0/월: 요청 100만·전송 100GB, 초과 요금 없음) | GB당 $0.15 |
| 저장 | S3 GB당 월 몇십 원 | GB당 월 $0.023 |
| 예) 30MB × 40명 × 3회 ≈ 3.5GB | 0원 | 약 $0.5 |
| 기타 | 캐시 무효화 월 1,000경로 무료(`/*`는 1경로) ⚠️ | ZIP 끌어 놓기 최대 5GB, 빌드 없음 |
- 신규 계정(2025-07-15 이후): 크레딧 최대 $200, **무료 플랜은 6개월 또는 크레딧 소진 시 계정 닫힘**(유료 전환 전까지 과금 없음).
- 출처: https://aws.amazon.com/cloudfront/pricing/ · https://aws.amazon.com/cloudfront/pricing/pay-as-you-go/ · https://aws.amazon.com/amplify/pricing/ · https://docs.aws.amazon.com/amplify/latest/userguide/manual-deploys.html · https://aws.amazon.com/free/

## 올리기 전에
- 빌드 결과 폴더(`dist/`)만 올립니다. 강사용 파일(`dist-강사용/`의 운영안내·DESIGN·설계도)은 올리지 않습니다(`deploy-s3.sh`는 `.md`도 걸러 냄).
- 공개 범위는 빌드할 때 정합니다: 링크(기본, 검색 제외) · 공개 · 암호(페이지와 교재 그림 암호화).
- 준비물: AWS 계정과 권한(S3, CloudFront, CloudFormation 또는 Amplify). 개발자는 AWS CLI v2(`aws --version`), `aws configure` 또는 `aws sso login`.

## S3 + CloudFront — 개발자(권장: CloudFormation 한 번 + 스크립트)
```bash
cd skills/lecpage/templates/deploy/aws
# 1) 버킷·배포 만들기(5~15분)
aws cloudformation deploy --region ap-northeast-2 \
  --stack-name lec-20261104 \
  --template-file cloudformation-static-site.yaml \
  --parameter-overrides SiteName=lec-20261104 \
      LiveOrigin="https://abcd.supabase.co wss://abcd.supabase.co"
aws cloudformation describe-stacks --region ap-northeast-2 --stack-name lec-20261104 \
  --query 'Stacks[0].Outputs' --output table
# 2) 파일 올리기 + 캐시 무효화
BUCKET=<BucketName> DISTRIBUTION_ID=<DistributionId> ./deploy-s3.sh /path/to/dist
```
- 스크립트는 HTML·`site.json`은 `no-cache`, 슬라이드·미디어는 1시간, 나머지는 5분 캐시로 올리고 `.md`·`.env`·`data/`는 올리지 않습니다. `DRY_RUN=1`로 미리 보기.
- 보안 헤더(CSP 등)는 CloudFront 응답 헤더 정책이 붙입니다. 실시간 주소가 바뀌면 `LiveOrigin`만 바꿔 `deploy`를 다시 실행.

## S3 + CloudFront — 콘솔(IT 담당자용 요약)
1. **S3** → 버킷 만들기(서울 리전, "모든 퍼블릭 액세스 차단" 켜 둠) → 사이트 내용물 업로드.
2. **CloudFront** → 배포 생성 → 원본: 그 버킷 → **Origin access control(OAC)** 새로 만들기 → 뷰어: Redirect HTTP to HTTPS → 기본 루트 객체 `index.html` → 응답 헤더 정책: 보안 헤더(CSP는 `templates/deploy/_headers`의 값을 복사) → 만들기.
3. 화면 안내의 **버킷 정책 복사** → S3 버킷 **권한 → 버킷 정책**에 붙여넣기.
4. 배포 주소 `https://dxxxx.cloudfront.net` 확인.

## Amplify 끌어 놓기
1. 사이트 폴더의 **내용물**을 ZIP으로 압축(index.html이 ZIP 맨 위에 오게).
2. AWS 콘솔 → **AWS Amplify** → **새 앱 만들기** → **Git 없이 배포(Deploy without Git)**.
3. 앱 이름·브랜치 이름(예: `main`) → **끌어 놓기** → ZIP 놓기 → **저장 및 배포**.
4. 주소: `https://main.<앱ID>.amplifyapp.com`.
5. 보안 헤더: 앱 → **호스팅 → 사용자 지정 헤더**에 YAML로 입력 ⚠️(콘솔 형식 확인):
```yaml
customHeaders:
  - pattern: '**'
    headers:
      - key: Content-Security-Policy
        value: "<templates/deploy/_headers의 CSP 한 줄>"
      - key: X-Content-Type-Options
        value: nosniff
      - key: Referrer-Policy
        value: strict-origin-when-cross-origin
  - pattern: 'assets/slides/**'
    headers:
      - key: Cache-Control
        value: 'public, max-age=3600'
```
6. 고칠 때: 새 ZIP을 다시 끌어 놓기.
- CLI(개발자): `aws amplify create-app` → `create-branch` → `create-deployment`로 받은 `zipUploadUrl`에 `curl -T site.zip` → `start-deployment`.

## 내 도메인
- CloudFront: ACM 인증서를 **us-east-1(버지니아 북부)**에서 발급(DNS 검증) → 스택 파라미터 `DomainName`, `AcmCertificateArn` 넣고 다시 `deploy` → DNS에 CNAME `lec.example.kr → dxxxx.cloudfront.net`.
- Amplify: 앱 → **도메인 관리**에서 추가(화면의 CNAME 값).

## 확인하기
- `curl -sI https://<주소>/ | grep -i -E "content-security|strict-transport"`.
- `…/check.html` 초록. **CloudFront → 모니터링** 또는 Amplify **모니터링**에서 전송량.
- **Billing → Budgets**에 월 $1 예산 알림을 만들어 두면 안심.

## 되돌리기·정리
- S3: 이전 사이트 폴더로 `deploy-s3.sh` 다시 실행(버킷 버전 관리를 켜 두면 객체 단위 복구도 가능). 전부 지우기:
```bash
aws s3 rm s3://<BucketName> --recursive
aws cloudformation delete-stack --region ap-northeast-2 --stack-name lec-20261104
```
- Amplify: 이전 ZIP을 다시 끌어 놓기. 삭제: 앱 → **앱 설정 → 일반 → 앱 삭제**(저장 요금이 계속 붙으니 안 쓰면 지움).

## 연수가 끝난 뒤
- 기록용으로 남기면 S3+CloudFront 비용은 거의 없음. 남기지 않으면 위 "전부 지우기".
- 실시간 데이터는 백엔드(Supabase·Lightsail 등)에서 내보내기 → 삭제.

## 자주 막히는 곳
- 403 AccessDenied: 버킷 정책(OAC) 누락, 또는 파일 경로 대소문자.
- 고쳤는데 안 바뀜: 캐시 무효화(`/*`)를 했는지, HTML이 `no-cache`로 올라갔는지.
- 스택 삭제 실패: 버킷이 비어 있지 않음 → 먼저 `aws s3 rm … --recursive`.
