# AWS Lightsail에 실시간 서버(node-server) 올리기

> 서울 리전의 작은 가상 서버(월 $5부터)에 Docker로 **사이트 + 실시간 서버**를 함께 띄웁니다. 국내 보관이 필요할 때 좋습니다.

## 언제 고르나요
- 기관 AWS 계정이 있고, 데이터를 **한국(서울)** 에 두고 싶을 때.
- 여러 연수를 계속 운영할 서버가 필요할 때.
- 고르지 말 것: 한 번 하는 연수에 비용 0원이어야 할 때 → Supabase(서울)나 cf-relay.
- App Runner는 2026년 신규 고객을 받지 않습니다(기존 고객만). 새로 시작하면 Lightsail 또는 ECS Express Mode.

## 비용 (2026-11 확인)
- 가상 서버(인스턴스): IPv4 포함 월 $5부터, **IPv6 전용 $3.5**(학교망이 IPv6를 못 쓰면 접속 불가 → IPv4 권장).
- 컨테이너 서비스: Nano(0.25 vCPU, 512MB) 월 $7, 전송 500GB 포함.
- 신규 계정은 무료 크레딧으로 차감될 수 있음.
- 출처: https://aws.amazon.com/lightsail/pricing/ · https://docs.aws.amazon.com/apprunner/latest/dg/apprunner-availability-change.html

## 방법 1 — 가상 서버 + Docker Compose (권장)
1. Lightsail 콘솔 → **인스턴스 생성** → 리전 **서울(ap-northeast-2)** → 플랫폼 Linux → 블루프린트 **OS 전용 → Ubuntu 24.04 LTS** → 요금제 $5(IPv4) → 만들기.
2. **네트워킹** 탭 → 고정 IP 만들기·연결 → IPv4 방화벽에 **HTTPS(443)** 추가(HTTP 80은 기본 열림).
3. 도메인 DNS에 A 레코드 `lec.example.kr → 고정 IP`(도메인이 없으면 `custom-domain-and-short-url.md` 참고).
4. 브라우저 SSH(콘솔의 **연결**)에서:
```bash
sudo apt-get update && sudo apt-get install -y docker.io docker-compose-v2
sudo usermod -aG docker $USER && newgrp docker
mkdir -p ~/lecpage && cd ~/lecpage
# 아래 파일들을 올립니다(scp 또는 git clone):
#   docker-compose.yml, Caddyfile, .env  ← skills/lecpage/templates/deploy/server/
#   site/        ← lecpage 빌드 결과(dist/만. 강사용 파일 dist-강사용/은 올리지 않음)
#   node-server/ ← skills/lecpage/backends/node-server/ (빌드 없이 node:24 이미지로 실행됨)
cp .env.example .env && nano .env      # LEC_SITE_ADDRESS=lec.example.kr
docker compose up -d
docker compose logs -f web             # 인증서 발급 로그 확인 후 Ctrl+C
docker compose logs live | grep 관리자  # 처음 한 번 나오는 관리자 키를 적어 두기
```
5. `https://lec.example.kr/check.html` 확인.
- 공개 범위는 빌드할 때 정합니다: 링크(기본, 검색 제외) · 공개 · 암호(페이지와 교재 그림 암호화, https 주소에서만 열림).

## 방법 2 — 컨테이너 서비스(서버 관리 없음)
```bash
cd skills/lecpage/backends/node-server
# Dockerfile 이 없으면: cp ../../templates/deploy/server/Dockerfile.node-server Dockerfile
docker build -t lec-live .
aws lightsail create-container-service --region ap-northeast-2 --service-name lec-live --power nano --scale 1
aws lightsail push-container-image --region ap-northeast-2 --service-name lec-live --label live --image lec-live
# 출력된 이미지 이름(:lec-live.live.N)으로 배포 JSON 작성 후
aws lightsail create-container-service-deployment --region ap-northeast-2 --service-name lec-live \
  --containers '{"live":{"image":":lec-live.live.1","environment":{"PORT":"8787","LEC_DATA":"/data","LEC_ADMIN_KEY_HASH":"<해시>","LEC_TRUST_PROXY":"1"},"ports":{"8787":"HTTP"}}}' \
  --public-endpoint '{"containerName":"live","containerPort":8787,"healthCheck":{"path":"/api/health"}}'
```
- 주의: 컨테이너 서비스는 **영구 디스크가 없습니다** → 재배포·재시작 때 node-server 데이터가 사라질 수 있음 ⚠️. 한 번 하는 연수에만 쓰고, 끝나기 전에 CSV 내보내기.
- 공개 주소의 WebSocket 지원 여부는 확인하지 못함 ⚠️ → 클라이언트가 SSE·폴링으로 자동 전환.
- 정적 사이트는 S3+CloudFront·Cloudflare에 두고 `live.url`을 이 서비스 주소로.

## 확인하기
- `docker compose ps`(모두 running), `curl -sI https://lec.example.kr/`.
- `console.html`에서 실시간 상태 `live`.

## 되돌리기·정리
- 사이트만 바꾸기: `site/` 폴더 교체 → `docker compose restart web`(정적은 재시작도 필요 없음).
- 서버 전체 삭제: 인스턴스 **삭제** + 고정 IP **해제**(연결 안 된 고정 IP는 요금이 붙음).

## 연수가 끝난 뒤
1. 콘솔 CSV 내보내기 → 2. 콘솔 **전부 삭제** → 3. `docker compose down && rm -rf ./data`.
4. 더 안 쓰면 인스턴스 삭제(스냅샷을 남기면 스냅샷 요금이 붙음).
