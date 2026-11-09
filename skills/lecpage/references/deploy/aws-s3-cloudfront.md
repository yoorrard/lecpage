# AWS S3 + CloudFront에 올리기

> 비공개 S3 버킷에 파일을 두고 CloudFront(CDN)로 HTTPS 제공. 기관 AWS 계정이 있을 때 가장 표준적인 방법입니다.

## 언제 고르나요
- 학교·기관이 AWS 계정을 이미 쓰고 있을 때, 서울 리전에 파일을 두고 싶을 때.
- 개발자이거나, IT 담당자가 도와줄 때(콘솔 단계가 많음).
- 고르지 말 것: 개인이 AWS를 처음 만드는 경우(신규 무료 플랜은 6개월 뒤 계정이 닫힘) → Cloudflare가 더 쉬움.

## 비용 (2026-11 확인)
- CloudFront 종량제: **상시 무료로 매달 인터넷 전송 1TB** 포함(요청 1천만 건도 포함된다고 알려짐 ⚠️ 2차 출처). 연수 사이트는 보통 0원.
- CloudFront 정액제 Free 플랜($0/월): 요청 100만·전송 100GB·S3 5GB 크레딧 포함, 초과 요금 없음. (무료 플랜 상태 계정은 가입 불가라는 2차 출처 있음 ⚠️)
- S3 저장: GB당 월 몇십 원 수준. 캐시 무효화는 월 1,000경로까지 무료(`/*`는 1경로) ⚠️.
- 신규 계정(2025-07-15 이후): 크레딧 최대 $200, **무료 플랜은 6개월 또는 크레딧 소진 시 계정 닫힘**(유료 전환 전까지 과금 없음).
- 출처: https://aws.amazon.com/cloudfront/pricing/ · https://aws.amazon.com/cloudfront/pricing/pay-as-you-go/ · https://aws.amazon.com/free/

## 준비물
- AWS 계정과 권한(S3, CloudFront, CloudFormation). AWS CLI v2(`aws --version`), `aws configure` 또는 `aws sso login`.
- `templates/deploy/aws/cloudformation-static-site.yaml`, `templates/deploy/aws/deploy-s3.sh`.

## 따라 하기 — 개발자(권장: CloudFormation 한 번 + 스크립트)
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
BUCKET=<BucketName> DISTRIBUTION_ID=<DistributionId> ./deploy-s3.sh /path/to/site
```
- 스크립트는 HTML·`site.json`은 `no-cache`, 슬라이드·미디어는 1시간, 나머지는 5분 캐시로 올리고 `.md`·`.env`·`data/`는 올리지 않습니다. `DRY_RUN=1`로 미리 보기.
- 보안 헤더(CSP 등)는 CloudFront 응답 헤더 정책이 붙입니다. 실시간 주소가 바뀌면 `LiveOrigin`만 바꿔 `deploy`를 다시 실행.

## 따라 하기 — 콘솔(클릭, IT 담당자용 요약)
1. **S3** → 버킷 만들기(서울 리전, "모든 퍼블릭 액세스 차단" 켜 둠) → 사이트 내용물 업로드.
2. **CloudFront** → 배포 생성 → 원본: 그 버킷 → **Origin access control(OAC)** 새로 만들기 → 뷰어: Redirect HTTP to HTTPS → 기본 루트 객체 `index.html` → 응답 헤더 정책: 보안 헤더(CSP는 `_headers`의 값을 복사) → 만들기.
3. 화면 안내의 **버킷 정책 복사** → S3 버킷 **권한 → 버킷 정책**에 붙여넣기.
4. 배포 주소 `https://dxxxx.cloudfront.net` 확인.

## 내 도메인
- ACM 인증서를 **us-east-1(버지니아 북부)** 에서 발급(DNS 검증) → 스택 파라미터 `DomainName`, `AcmCertificateArn` 넣고 다시 `deploy` → DNS에 CNAME `lec.example.kr → dxxxx.cloudfront.net`.

## 확인하기
- `curl -sI https://<주소>/ | grep -i -E "content-security|strict-transport"`.
- `…/check.html` 초록. **CloudFront → 모니터링**에서 요청·전송량.
- **Billing → Budgets**에 월 $1 예산 알림을 만들어 두면 안심.

## 되돌리기·정리
- 이전 파일로: 이전 사이트 폴더로 `deploy-s3.sh` 다시 실행(버킷 버전 관리를 켜 두면 객체 단위 복구도 가능).
- 전부 지우기:
```bash
aws s3 rm s3://<BucketName> --recursive
aws cloudformation delete-stack --region ap-northeast-2 --stack-name lec-20261104
```

## 연수가 끝난 뒤
- 기록용으로 남기면 비용은 거의 없음. 남기지 않으면 위 "전부 지우기".
- 실시간 데이터는 백엔드(Supabase·Lightsail 등)에서 내보내기 → 삭제.

## 자주 막히는 곳
- 403 AccessDenied: 버킷 정책(OAC) 누락, 또는 파일 경로 대소문자.
- 고쳤는데 안 바뀜: 캐시 무효화(`/*`)를 했는지, HTML이 `no-cache`로 올라갔는지.
- 스택 삭제 실패: 버킷이 비어 있지 않음 → 먼저 `aws s3 rm … --recursive`.
