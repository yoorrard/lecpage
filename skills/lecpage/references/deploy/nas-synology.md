# Synology NAS에 올리기 (Container Manager)

> 집·학교의 Synology NAS에서 사이트와 실시간 서버를 Docker로 함께 띄웁니다. 기록이 NAS 안에만 남습니다.

## 언제 고르나요
- Container Manager를 지원하는 Synology NAS(대부분 x86/일부 ARM64 모델, DSM 7.2 이상)가 있을 때 ⚠️ 모델 지원 목록 확인.
- 학교 안 NAS면 **학교 와이파이 안에서만** 쓰는 연수에 적합(외부 공개 불필요).
- 고르지 말 것: 집 인터넷 업로드 속도가 느릴 때(참가자 다수가 슬라이드를 받으면 느려짐), 공유기 포트를 열 수 없을 때(→ Cloudflare Tunnel 참고).

## 비용
- 기존 장비면 0원. 전기료 외 추가 비용 없음.

## 준비물
- DSM 관리자 계정, **패키지 센터 → Container Manager** 설치.
- File Station에 폴더 `docker/lecpage/` 만들고 다음을 넣기:
  - `docker-compose.yml`, `Caddyfile`, `.env`(← `templates/deploy/server/`, `.env.example`을 `.env`로)
  - `site/`(lecpage 빌드 결과), `node-server/`(backends/node-server)
- `.env`에서 **포트 바꾸기**: DSM이 80·443을 쓰므로 `LEC_HTTP_PORT=8080`, `LEC_HTTPS_PORT=8443`, `LEC_SITE_ADDRESS=:80`.

## 따라 하기 — 클릭
1. **Container Manager → 프로젝트 → 생성**.
2. 프로젝트 이름 `lecpage`, 경로 `docker/lecpage` 선택 → "기존 docker-compose.yml 사용" → 다음 → 완료(이미지 빌드에 몇 분).
3. 학교 안에서만: 참가자는 `http://<NAS IP>:8080` 으로 접속(QR은 screen.html에서 이 주소로).
4. 외부 공개(HTTPS)가 필요하면:
   1. **제어판 → 외부 액세스 → DDNS**: `내이름.synology.me` 만들기.
   2. **제어판 → 보안 → 인증서**: Let's Encrypt로 `내이름.synology.me` 인증서 발급.
   3. **제어판 → 로그인 포털 → 고급 → 역방향 프록시 → 생성**: 원본 `HTTPS / 내이름.synology.me / 443` → 대상 `HTTP / localhost / 8080`.
   4. 같은 창 **사용자 지정 머리글 → 생성 → WebSocket** (Upgrade·Connection 두 줄이 자동으로 들어감) → 저장.
   5. 공유기에서 443 포트를 NAS로 포워딩.
   6. `.env`의 `LEC_CSP_CONNECT_EXTRA=wss://내이름.synology.me` → 프로젝트 **다시 빌드/재시작**.

> 메뉴 위치는 DSM 버전마다 조금씩 다릅니다 ⚠️.

## 공유기 포트를 못 열 때 — Cloudflare Tunnel
- Cloudflare 계정 + 도메인이 있으면 NAS에서 `cloudflared` 컨테이너로 **이름 있는 터널**을 만들어 `https://lec.example.kr → http://web:80` 연결(포트 열기 불필요).
- `trycloudflare.com` 임시 터널(Quick Tunnel)은 **SSE 미지원·동시 요청 200개·가동 보장 없음** → 시험용으로만.
- 출처: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/

## 확인하기
- Container Manager에서 `lecpage-web-1`, `lecpage-live-1` 둘 다 실행 중.
- 같은 와이파이의 휴대폰으로 `http://<NAS IP>:8080/check.html`.
- 외부 공개 시 휴대폰 데이터로 `https://내이름.synology.me/check.html`, `console.html` 상태 `live`.

## 되돌리기·정리
- 사이트 교체: File Station에서 `site/` 내용 교체(재시작 불필요).
- 멈추기: 프로젝트 → **중지**. 삭제: 프로젝트 → **삭제** 후 `docker/lecpage/data` 폴더 삭제.

## 연수가 끝난 뒤
1. 콘솔 CSV 내보내기 → 2. **전부 삭제** → 3. `data/` 폴더 삭제 → 4. 외부 공개했다면 역방향 프록시 규칙과 공유기 포트포워딩도 지우기(공격 표면 줄이기).
5. Hyper Backup 등 NAS 백업에 연수 데이터가 남아 있으면 그 버전도 정리.
