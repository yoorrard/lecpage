# 내 서버·학교 서버·VPS에 올리기 (Caddy 또는 nginx + node-server)

> 사이트와 실시간 서버를 **같은 주소**로 한 번에 운영합니다. 기록이 내(학교) 서버에만 남습니다.

## 언제 고르나요
- 학교·교육청 서버, 개인 VPS(국내 업체 포함), 연구실 서버, 라즈베리 파이가 있을 때.
- 국내 보관·학생 실명 등 개인정보 지침이 엄격할 때.
- 고르지 말 것: 서버를 관리할 사람이 없을 때(보안 업데이트·장애 대응 필요).

## 비용
- 기존 서버면 0원. 새 VPS는 월 $5 안팎(서울 리전 예: AWS Lightsail → `aws-lightsail-docker.md`). 국내 웹호스팅(카페24·가비아 등)의 일반 웹호스팅 상품은 Docker·WebSocket이 안 되는 경우가 많아 **정적 파일만** 올릴 수 있습니다 ⚠️.

## 준비물
- Linux 서버(Ubuntu 22.04/24.04 등), 공인 IP 또는 학교 내부 IP, (인터넷 공개 시) 도메인과 80·443 포트.
- `templates/deploy/server/` 의 `docker-compose.yml`, `Caddyfile`, `.env.example` (또는 `nginx.conf`).
- `skills/lecpage/backends/node-server/` (의존성 없는 Node 서버, Node 22.5 이상), lecpage 사이트 폴더(빌드 결과 `dist/`만. 강사용 파일 `dist-강사용/`은 서버에 두지 않음).
- 공개 범위는 빌드할 때 정합니다: 링크(기본, 검색 제외) · 공개 · 암호(페이지와 교재 그림 암호화, https 주소에서만 열림). 학교 내부망에서 http로만 쓰면 암호는 고르지 마세요.

## 방법 A — Docker Compose + Caddy (권장, HTTPS 자동)
```bash
sudo apt-get update && sudo apt-get install -y docker.io docker-compose-v2
mkdir -p ~/lecpage && cd ~/lecpage
cp /path/to/skills/lecpage/templates/deploy/server/{docker-compose.yml,Caddyfile,.env.example} .
cp -r /path/to/site ./site
cp -r /path/to/skills/lecpage/backends/node-server ./node-server
cp .env.example .env
# .env: LEC_SITE_ADDRESS=lec.school.kr  (학교 내부망만이면 :80)
#       LEC_ADMIN_KEY_HASH= (비우면 첫 실행 때 키를 만들어 data/admin-key.txt에 둠)
#       LEC_CSP_CONNECT_EXTRA=wss://lec.school.kr
docker compose up -d
docker compose logs -f web      # "certificate obtained successfully" 확인
docker compose exec live cat /data/admin-key.txt   # 관리자 키 확인
```
- DNS: `lec.school.kr`의 A 레코드를 서버 IP로. 80·443이 인터넷에서 열려 있어야 인증서가 발급됩니다.
- 라즈베리 파이(64비트 OS)도 같은 방법(caddy·node 이미지가 arm64 지원).
- 사이트 교체: `site/` 내용만 바꾸면 바로 반영(재시작 불필요).

## 방법 B — nginx(이미 nginx가 있는 서버)
1. 정적 파일: `/var/www/lecpage/site/`에 복사.
2. node-server를 `127.0.0.1:8787`에만 열기(빌드 없이 공식 Node 이미지로)
```bash
docker run -d --name lec-live --restart unless-stopped \
  -p 127.0.0.1:8787:8787 \
  -v /path/to/node-server:/app:ro -v /srv/lecpage-data:/data -w /app \
  -e LEC_DATA=/data -e LEC_TRUST_PROXY=1 -e TZ=Asia/Seoul \
  node:24-alpine node --disable-warning=ExperimentalWarning server.mjs
docker exec lec-live cat /data/admin-key.txt     # 첫 실행 때 만든 관리자 키
```
   Docker가 없으면 Node 22.5 이상으로 직접 실행: `LEC_DATA=/srv/lecpage-data LEC_TRUST_PROXY=1 node server.mjs --host 127.0.0.1` (systemd 서비스로 등록 권장). 옵션 목록은 `server.mjs` 머리말.
3. `templates/deploy/server/nginx.conf`를 `/etc/nginx/conf.d/lecpage.conf`로 복사 → `{{DOMAIN}}`, `{{SITE_ROOT}}`, `{{LIVE_UPSTREAM}}`(=`127.0.0.1:8787`) 치환.
4. 인증서: `sudo certbot --nginx -d lec.school.kr` → `sudo nginx -t && sudo systemctl reload nginx`.
- 핵심 설정: `/api/`에 WebSocket 업그레이드 헤더, SSE를 위한 `proxy_buffering off`, `proxy_read_timeout 1h`.

## 정적 파일만 올리는 경우(웹호스팅·학교 홈페이지 서버)
- FTP/SFTP로 사이트 내용물을 웹 루트(`public_html`, `www` 등)에 올립니다. 실시간은 Supabase·Sheets·cf-relay.
- Apache면 사이트 폴더에 `.htaccess`로 헤더 추가 가능(모듈 허용 시) ⚠️:
```apache
<IfModule mod_headers.c>
  Header always set X-Content-Type-Options "nosniff"
  Header always set Referrer-Policy "strict-origin-when-cross-origin"
</IfModule>
```
- 헤더를 못 바꾸면 CSP는 `csp-meta.html` 방식(엔진 옵션).

## 확인하기
```bash
curl -sI https://lec.school.kr/ | grep -i -E "content-security|strict-transport"
curl -s https://lec.school.kr/api/health        # {"ok":true,...}
```
- `check.html` 초록, `console.html` 상태 `live`(WebSocket). `polling`이면 프록시의 WebSocket 설정 확인.

## 되돌리기·정리
- 사이트: 이전 `site/` 폴더로 교체.
- 서버: `docker compose down`(데이터 유지) / `docker compose down && rm -rf ./data`(데이터 삭제).

## 연수가 끝난 뒤
1. 콘솔 CSV 내보내기 → 2. 콘솔 **전부 삭제** → 3. `./data` 폴더 확인 후 삭제 → 4. 백업본에도 남아 있지 않은지 확인(학교 백업 정책).

## 자주 막히는 곳
- 인증서 실패: 80 포트가 막혔거나 DNS가 아직 전파 안 됨.
- 실시간이 `polling`으로만 됨: 앞단 프록시·방화벽이 WebSocket 차단 → 학교 IT에 `school-network-checklist.md` 전달.
- 학교 내부망 전용 서버: 외부(휴대폰 데이터)에서는 접속 불가가 정상. 참가자 모두 학교 와이파이에 붙도록 안내.
