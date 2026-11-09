# Fly.io에 실시간 서버(node-server) 올리기

> Docker 이미지를 도쿄 리전 근처의 작은 기계에 띄웁니다. 상시 실행 월 $2~4 수준. 정적 사이트는 다른 곳(Cloudflare 등)에 둡니다.

## 언제 고르나요
- 개발자, 내 서버가 없지만 node-server를 쓰고 싶을 때(데이터를 직접 소유).
- 고르지 말 것: 0원이어야 할 때(무료 플랜 없음, 체험 $1·7일), 클릭만 하는 선생님.

## 비용 (2026-11 확인)
- 체험: $1 크레딧(7일, 카드 없이).
- shared-cpu-1x 256MB 상시 실행 약 $2.19/30일, 512MB 약 $3.69. 볼륨은 GB당 별도. 공유 IPv4·IPv6 무료(전용 IPv4는 월 $2).
- 아시아 전송 GB당 $0.04 수준.
- 한국에서 가까운 리전: `nrt`(도쿄) ⚠️ 서울 리전 여부 미확인.
- 출처: https://fly.io/docs/about/pricing/ · https://fly.io/docs/about/free-trial/

## 따라 하기
```bash
# flyctl 설치: https://fly.io/docs/flyctl/install/
cd skills/lecpage/backends/node-server
cp ../../templates/deploy/fly/fly.toml .
[ -f Dockerfile ] || cp ../../templates/deploy/server/Dockerfile.node-server Dockerfile
# fly.toml 의 {{APP_NAME}} (예: lec-live-1104), {{SITE_ORIGIN}} (예: https://lec-1104.pages.dev) 치환
fly auth login
fly launch --no-deploy --copy-config --name lec-live-1104
fly volumes create lecdata --region nrt --size 1
fly secrets set LEC_ADMIN_KEY_HASH=$(node server.mjs --hash '내관리자키')   # 생략하면 첫 실행 로그(fly logs)에 키가 한 번 나옴
fly deploy --ha=false
fly status
```
- 실시간 주소 `https://lec-live-1104.fly.dev` → blueprint `live.url`, `{{LIVE_ORIGIN}}`에 `https://…`와 `wss://…`.
- 데이터가 기계 1대의 볼륨에 있으므로 **기계는 1대만**(`--ha=false`).
- `auto_stop_machines`가 켜져 있어 아무도 안 쓰면 멈춥니다. 연수 10분 전에 `console.html`을 열어 깨워 두세요.

## 확인하기
- `fly logs`, `curl -sI https://lec-live-1104.fly.dev/`, 사이트의 `check.html`.

## 되돌리기·정리
- `fly releases` → `fly deploy --image <이전 이미지>`.
- 전부 삭제: `fly apps destroy lec-live-1104`(볼륨·데이터 포함).

## 연수가 끝난 뒤
- 콘솔 CSV 내보내기 → **전부 삭제** → 앱 삭제(요금 중지).
