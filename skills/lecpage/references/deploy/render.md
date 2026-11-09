# Render에 올리기

> GitHub 저장소를 연결하면 정적 사이트는 무료로, 실시간 서버(node-server)는 유료 인스턴스로 올릴 수 있습니다.

## 언제 고르나요
- Render를 이미 쓰는 개발자, 저장소 하나에 사이트와 서버를 함께 두고 싶을 때.
- 고르지 말 것: 큰 사이트(Hobby 대역폭 월 5GB), 무료로 실시간 서버를 운영하려는 경우.

## 비용과 한도 (2026-11 확인)
- Hobby 워크스페이스 0원(+사용한 컴퓨팅): 정적 사이트 무료, **대역폭 월 5GB 포함**. 넘으면 결제 수단이 없을 때 무료 서비스가 그 달 동안 정지.
- 무료 웹 서비스: 15분 동안 요청이 없으면 잠듦(깨어나는 데 약 1분), **파일 시스템이 지워짐**(디스크 불가), 월 750시간.
  → node-server를 무료로 올리면 연수 중 잠들거나 데이터가 사라질 수 있습니다. **실시간은 유료(Starter 월 $7부터) + 디스크**.
- 출처: https://render.com/docs/free · https://render.com/pricing

## 따라 하기 — Blueprint(저장소 하나로)
1. 저장소 구성: `site/`(빌드 결과), `node-server/`(backends/node-server 복사), 맨 위 `render.yaml`(`templates/deploy/render/render.yaml`, `{{…}}` 치환). 실시간이 필요 없으면 `lecpage-live` 부분을 지웁니다.
2. https://dashboard.render.com → **New → Blueprint** → 저장소 선택 → **Apply**.
3. 정적 사이트 주소 `https://lecpage-site.onrender.com`, 실시간 주소 `https://lecpage-live.onrender.com`.
4. 실시간 주소를 blueprint `live.url`·`{{LIVE_ORIGIN}}`에 넣고 다시 빌드·push.

## 따라 하기 — 정적 사이트만(클릭)
**New → Static Site** → 저장소 → Build Command 비움(또는 `echo`) → Publish directory `site` → **Create**.

## 확인하기
- `…/check.html` 초록. 대시보드 **Metrics → Bandwidth**.

## 되돌리기·정리
- 서비스 → **Events/Deploys** → 이전 배포 **Rollback**.
- 삭제: 서비스 **Settings → Delete**.

## 연수가 끝난 뒤
- 콘솔 CSV 내보내기 → **전부 삭제** → 유료 서비스는 바로 삭제(디스크 포함, 요금 중지).
