# Railway에 실시간 서버(node-server) 올리기

> GitHub 저장소나 CLI로 Docker 서비스를 띄우고 볼륨을 붙입니다. 체험 $5(1회), 이후 Hobby 월 $5.

## 언제 고르나요
- 개발자, 화면 클릭 위주로 서버를 관리하고 싶을 때.
- 고르지 말 것: 0원이어야 할 때(Free 플랜은 월 $1 크레딧뿐), 국내 보관이 필요할 때.

## 비용 (2026-11 확인)
- Trial: 1회 $5 크레딧. Free: 월 $1 크레딧, 서비스당 RAM 0.5GB·1 vCPU·볼륨 0.5GB. Hobby: 월 $5(사용료에 포함).
- 한국에서 가까운 리전: 싱가포르(`asia-southeast1`) ⚠️.
- 출처: https://docs.railway.com/reference/pricing/plans

## 따라 하기 — 대시보드
1. 저장소에 `node-server/`(backends/node-server 복사) 넣기.
2. https://railway.com → **New Project → Deploy from GitHub repo** → 저장소 선택 → 서비스 **Settings → Root Directory** `node-server`(Dockerfile이 없으면 `templates/deploy/server/Dockerfile.node-server`를 `node-server/Dockerfile`로 복사).
3. **Variables**: `PORT=8787`, `LEC_DATA=/data`, `LEC_TRUST_PROXY=1`, `LEC_ORIGINS=<사이트 주소>`, `TZ=Asia/Seoul`, (선택) `LEC_ADMIN_KEY_HASH=<해시>` — 비우면 첫 실행 로그에 관리자 키가 한 번 나옴.
4. 서비스 우클릭 → **Attach Volume** → 마운트 경로 `/data`.
5. **Settings → Networking → Generate Domain** → `https://<이름>.up.railway.app`.

## 따라 하기 — CLI (옵션 이름은 CLI 버전에 따라 다를 수 있음 ⚠️ `railway --help`로 확인)
```bash
npm i -g @railway/cli
cd skills/lecpage/backends/node-server
railway login && railway init
railway up
railway variables --set "LEC_DATA=/data" --set "PORT=8787" --set "LEC_TRUST_PROXY=1"
railway volume add --mount-path /data
railway domain
```

## 확인하기
- 대시보드 **Deployments → Logs**, 사이트의 `check.html`, `console.html` 상태 `live`.

## 되돌리기·정리
- **Deployments** → 이전 배포 **Redeploy**.
- 삭제: 프로젝트 **Settings → Danger → Delete Project**(볼륨 포함).

## 연수가 끝난 뒤
- 콘솔 CSV 내보내기 → **전부 삭제** → 프로젝트 삭제.
