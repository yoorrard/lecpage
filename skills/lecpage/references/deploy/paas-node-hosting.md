# 클라우드에 실시간 서버(node-server) 올리기 — Fly.io · Railway · Render

> 내 서버가 없는 개발자가 `node-server`(Docker)를 클라우드에 띄우는 방법입니다. 세 곳 모두 **실시간 서버는 유료**(월 $2~7)이고, 순서는 거의 같습니다. 아래는 Fly.io로 따라 하고, Railway·Render는 다른 점만 적습니다.
> 정적 사이트는 Cloudflare·GitHub Pages에 두고 실시간만 여기에 둡니다(Render는 정적 사이트도 같이 둘 수 있음).

## 언제 고르나요
- 개발자이고, 데이터를 직접 소유하는 node-server를 쓰고 싶은데 학교 서버·NAS·VPS가 없을 때.
- 고르지 말 것: 0원이어야 할 때(→ Supabase·Sheets·Cloudflare 중계), 클릭만 하는 선생님, 국내 보관이 필요할 때(→ `aws-lightsail-docker.md`의 서울 리전).

## 세 곳 비교 (2026-11 확인. 이번 2026-11-09 재검증에서는 다시 보지 않음 ⚠️)
| | Fly.io | Railway | Render |
|---|---|---|---|
| 무료로 해 보기 | 체험 $1(7일, 카드 없이) | 체험 $5(1회), 이후 Free 월 $1 | 정적 사이트 무료. 무료 웹 서비스는 실시간에 못 씀(아래) |
| 실시간 서버 비용 | 256MB 상시 약 $2.19/30일, 512MB 약 $3.69 + 볼륨 | Hobby 월 $5(사용료 포함) | Starter 월 $7부터 + 디스크 |
| 한국에서 가까운 곳 | `nrt`(도쿄). 서울 리전 미확인 ⚠️ | 싱가포르 ⚠️ | 싱가포르 ⚠️ |
| 데이터 보관 | 볼륨(기계 1대에 붙음) | 볼륨 | 유료 디스크 |
| 설정 파일 | `templates/deploy/fly/fly.toml` | 대시보드 또는 CLI | `templates/deploy/render/render.yaml` |
| 주소 | `*.fly.dev` | `*.up.railway.app` | `*.onrender.com` |
| 출처 | https://fly.io/docs/about/pricing/ · https://fly.io/docs/about/free-trial/ | https://docs.railway.com/reference/pricing/plans | https://render.com/docs/free · https://render.com/pricing |

- **Render 무료 웹 서비스는 쓰지 마세요.** 15분 동안 요청이 없으면 잠들고(깨는 데 약 1분) **파일이 지워집니다**. 연수 중 기록이 사라질 수 있습니다.
- Render 정적 사이트는 워크스페이스 전체 **대역폭 월 5GB**입니다. 넘으면(결제 수단이 없을 때) 그 달 동안 무료 서비스가 모두 멈춥니다. 슬라이드 사이트라면 Cloudflare·GitHub Pages가 낫습니다.

## 공통 준비
- `skills/lecpage/backends/node-server/`. Dockerfile이 없으면 `templates/deploy/server/Dockerfile.node-server`를 그 폴더에 `Dockerfile`로 복사.
- 환경 변수(이름은 `server.mjs` 머리말 기준): `PORT=8787`, `LEC_DATA=/data`, `LEC_TRUST_PROXY=1`, `TZ=Asia/Seoul`, `LEC_ORIGINS=<사이트 주소>`(쉼표로 여러 개), `LEC_ADMIN_KEY_HASH=<해시>`.
  - 해시 만들기: `node server.mjs --hash '내관리자키'`. 비우면 첫 실행 로그에 관리자 키가 한 번 나옵니다. 로그는 남으니 해시를 넣는 편이 안전합니다.
- 사이트에는 빌드 결과(`dist/`)만 올립니다. 강사용 파일(`dist-강사용/`)은 올리지 않습니다.

## 따라 하기 — Fly.io
```bash
# flyctl 설치: https://fly.io/docs/flyctl/install/
cd skills/lecpage/backends/node-server
cp ../../templates/deploy/fly/fly.toml .
[ -f Dockerfile ] || cp ../../templates/deploy/server/Dockerfile.node-server Dockerfile
# fly.toml 의 {{APP_NAME}} (예: lec-live-1104), {{SITE_ORIGIN}} (예: https://lec-1104.pages.dev) 치환
fly auth login
fly launch --no-deploy --copy-config --name lec-live-1104
fly volumes create lecdata --region nrt --size 1
fly secrets set LEC_ADMIN_KEY_HASH=$(node server.mjs --hash '내관리자키')
fly deploy --ha=false
fly status
```
- 실시간 주소 `https://lec-live-1104.fly.dev` → blueprint `live.provider: "http"`, `live.url`. CSP를 쓰면 `{{LIVE_ORIGIN}}`에 `https://…`와 `wss://…`.
- 데이터가 기계 1대의 볼륨에 있으므로 **기계는 1대만**(`--ha=false`).
- `auto_stop_machines`가 켜져 있어 아무도 안 쓰면 멈춥니다. 연수 10분 전에 `console.html`을 열어 깨워 두세요.
- 되돌리기: `fly releases` → `fly deploy --image <이전 이미지>`. 전부 삭제: `fly apps destroy lec-live-1104`(볼륨·데이터 포함).

## Railway에서 다른 점
1. 저장소에 `node-server/`를 넣고 https://railway.com → **New Project → Deploy from GitHub repo** → 서비스 **Settings → Root Directory** `node-server`.
2. **Variables**에 공통 환경 변수.
3. 서비스 우클릭 → **Attach Volume** → 마운트 경로 `/data`.
4. **Settings → Networking → Generate Domain** → `https://<이름>.up.railway.app`.
- CLI: `railway login && railway init && railway up`, `railway volume add --mount-path /data`, `railway domain`(옵션 이름은 버전마다 다를 수 있음 ⚠️ `railway --help`).
- 되돌리기: **Deployments** → 이전 배포 **Redeploy**. 삭제: **Settings → Danger → Delete Project**(볼륨 포함).

## Render에서 다른 점
1. 저장소 구성: `site/`(빌드 결과), `node-server/`, 맨 위 `render.yaml`(`templates/deploy/render/render.yaml`, `{{…}}` 치환). 실시간이 필요 없으면 `lecpage-live` 부분을 지웁니다.
2. https://dashboard.render.com → **New → Blueprint** → 저장소 → **Apply**.
3. 정적 사이트 `https://lecpage-site.onrender.com`, 실시간 `https://lecpage-live.onrender.com`(유료 인스턴스 + 디스크).
- 정적 사이트만: **New → Static Site** → 저장소 → Build Command 비움 → Publish directory `site`.
- 되돌리기: 서비스 → **Events/Deploys** → 이전 배포 **Rollback**. 삭제: 서비스 **Settings → Delete**.

## 확인하기
- 사이트의 `check.html` 초록, `console.html` 상태 `live`(웹소켓).
- `curl -s https://<실시간 주소>/api/health` → `{"ok":true,…}`.
- 로그: `fly logs` / Railway **Deployments → Logs** / Render **Logs**.

## 연수가 끝난 뒤
- 콘솔 CSV 내보내기 → 콘솔 **전부 삭제** → 앱·프로젝트·서비스 삭제(요금 중지, 볼륨·디스크 포함).
