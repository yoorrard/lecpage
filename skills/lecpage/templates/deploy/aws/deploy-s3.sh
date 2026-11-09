#!/usr/bin/env bash
# lecpage 생성 사이트 → Amazon S3 + CloudFront 배포 스크립트
#
# 사용법
#   BUCKET=my-lec-site DISTRIBUTION_ID=E123ABC ./deploy-s3.sh ./site
#   DRY_RUN=1 BUCKET=... ./deploy-s3.sh ./site        # 올리지 않고 무엇이 바뀌는지만 보기
#   AWS_PROFILE=school BUCKET=... ./deploy-s3.sh ./site
#
# 필요: AWS CLI v2 (aws --version), 버킷·배포는 cloudformation-static-site.yaml 로 먼저 만듭니다.
# 하는 일
#   1) 슬라이드·미디어: 1시간 캐시
#   2) CSS·JS·그 밖의 파일: 5분 캐시
#   3) HTML·site.json: 매번 새로 확인(no-cache)
#   4) 로컬에 없는 파일은 버킷에서 지움(--delete)
#   5) CloudFront 캐시 무효화("/*" 한 줄 = 경로 1개로 계산)
# 공개하면 안 되는 파일(.md, .env, data/)은 올리지 않습니다.

set -euo pipefail

SITE_DIR="${1:-./site}"
BUCKET="${BUCKET:?BUCKET 환경 변수를 넣으세요. 예) BUCKET=my-lec-site}"
DISTRIBUTION_ID="${DISTRIBUTION_ID:-}"
DRY_RUN="${DRY_RUN:-0}"

if [[ ! -f "${SITE_DIR}/index.html" ]]; then
  echo "오류: ${SITE_DIR}/index.html 이 없습니다. 사이트 폴더를 확인하세요." >&2
  exit 1
fi
command -v aws >/dev/null 2>&1 || { echo "오류: AWS CLI가 없습니다. https://aws.amazon.com/cli/" >&2; exit 1; }

DRY=()
if [[ "${DRY_RUN}" == "1" ]]; then
  DRY=(--dryrun)
  echo "[DRY RUN] 실제로 올리지 않습니다."
fi

COMMON_EXCLUDES=(--exclude "*.md" --exclude ".*" --exclude "*/.*" --exclude "data/*" --exclude "node_modules/*")

echo "1/4 슬라이드·미디어 (1시간 캐시)"
aws s3 sync "${SITE_DIR}" "s3://${BUCKET}" --delete ${DRY[@]+"${DRY[@]}"} \
  --exclude "*" --include "assets/slides/*" --include "assets/media/*" \
  "${COMMON_EXCLUDES[@]}" \
  --cache-control "public, max-age=3600"

echo "2/4 CSS·JS 등 (5분 캐시)"
aws s3 sync "${SITE_DIR}" "s3://${BUCKET}" --delete ${DRY[@]+"${DRY[@]}"} \
  --exclude "*.html" --exclude "assets/site.json" \
  --exclude "assets/slides/*" --exclude "assets/media/*" \
  "${COMMON_EXCLUDES[@]}" \
  --cache-control "public, max-age=300"

echo "3/4 HTML·site.json (no-cache)"
aws s3 sync "${SITE_DIR}" "s3://${BUCKET}" --delete ${DRY[@]+"${DRY[@]}"} \
  --exclude "*" --include "*.html" --include "assets/site.json" \
  "${COMMON_EXCLUDES[@]}" \
  --cache-control "no-cache"

if [[ -n "${DISTRIBUTION_ID}" && "${DRY_RUN}" != "1" ]]; then
  echo "4/4 CloudFront 캐시 무효화"
  aws cloudfront create-invalidation --distribution-id "${DISTRIBUTION_ID}" --paths "/*" \
    --query 'Invalidation.{Id:Id,Status:Status}' --output table
  DOMAIN="$(aws cloudfront get-distribution --id "${DISTRIBUTION_ID}" --query 'Distribution.DomainName' --output text)"
  echo "완료: https://${DOMAIN}/  (무효화는 보통 1~5분 걸립니다)"
else
  echo "4/4 건너뜀(DISTRIBUTION_ID 없음 또는 DRY_RUN)"
fi
