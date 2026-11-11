# lecpage 실시간 서버 (Node, 의존성 없음)

연수 사이트의 실시간 기능(익명 질문·공감, "도움 요청", 실습 진행, 나눔 보드와 파일 올리기, 투표·워드클라우드, 채팅, 출석, 반응, 강사 화면 상태)을 받아 주는 작은 서버입니다. **생성한 연수 사이트도 함께 제공**하므로 컨테이너 하나, 컴퓨터 한 대로 모든 것이 끝납니다.

- 필요한 것: **Node.js 22.13 이상**(22.5~22.12도 `--experimental-sqlite`를 붙이면 동작). `npm install`이 필요 없습니다.
- 저장: 내장 SQLite(`node:sqlite`) 파일 하나 + 올린 파일 폴더(`data/`).
- 실시간: WebSocket → SSE → 5초 새로 읽기(폴링) 순서로 자동 전환. 학교망이 WebSocket을 막아도 SSE나 폴링으로 이어집니다.
- 규칙: `docs/architecture.md` §5.1 HTTP 프로토콜 v1. Cloudflare 판(`../cloudflare`)과 같은 코드(`lib/protocol.js`)를 씁니다.

## 1. 내 컴퓨터에서 바로 (강의실 와이파이·리허설)

```bash
cd skills/lecpage/backends/node-server
node --experimental-sqlite server.mjs --static ../../../../my-site
```

- 브라우저에서 `http://localhost:8787` → 연수 사이트, `http://localhost:8787/console.html` → 강사 화면.
- 같은 와이파이의 참가자는 `http://<내 컴퓨터 IP>:8787` 로 들어옵니다(Windows는 처음 실행 때 "방화벽 허용"을 누르세요).
- 관리자 키를 정하지 않으면 첫 실행 때 만들어 **`data/admin-key.txt`(나만 읽을 수 있는 파일)** 에 둡니다. 로그에는 남기지 않아요. 키를 적어 둔 뒤 그 파일은 지워도 됩니다(해시는 `data/admin-key.sha256`).
- 직접 정할 때는 `--admin-key '…'`: **12자 이상**, 예시 값(`change-me…` 등)이 아니어야 서버가 켜집니다. 만들기: `openssl rand -hex 12`.
- 사이트 설정(blueprint `live`)은 `provider: "http"`, `url: ""`(같은 주소) 또는 서버 주소로 둡니다.

## 2. 설정(명령줄 옵션 = 환경 변수)

| 옵션 | 환경 변수 | 기본값 | 설명 |
|---|---|---|---|
| `--port` | `PORT` | 8787 | 포트 |
| `--host` | `LEC_HOST` | 0.0.0.0 | 듣는 주소 |
| `--data` | `LEC_DATA` | ./data | DB·올린 파일 폴더 |
| `--static` | `LEC_STATIC` | (없음) | 함께 제공할 사이트 폴더 |
| `--admin-key` | `LEC_ADMIN_KEY` | (자동 생성) | 관리자 키(모든 연수 코드에 적용). 12자 이상, 예시 값 금지 |
| `--admin-key-hash` | `LEC_ADMIN_KEY_HASH` | | 키 대신 SHA-256 해시. `node server.mjs --hash '키'`로 만듭니다 |
| `--setup-token` | `LEC_SETUP_TOKEN` | | 여러 강사가 함께 쓰는 서버: `/init`으로 코드별 관리자 키 등록 허용(12자 이상) |
| `--codes` | `LEC_CODES` | | 쓸 수 있는 연수 코드 목록(쉼표) |
| `--origins` | `LEC_ORIGINS` | (모두 허용) | 이 서버를 부를 사이트 주소(쉼표). 사이트를 따로 올렸다면 꼭 적으세요 |
| `--max-upload-mb` | `LEC_MAX_UPLOAD_MB` | 20 | 파일 크기 한도 |
| `--retention-days` | `LEC_RETENTION_DAYS` | 30 | 마지막 사용 뒤 이 기간이 지나면 자동 삭제 |
| `--trusted-proxies` | `LEC_TRUSTED_PROXIES` | 0 | 앞에 둔 프록시 수(Caddy·nginx 하나면 `1`). 참가자 IP를 `X-Forwarded-For`의 **오른쪽에서** 그 수만큼 세어 읽습니다. 0이면 헤더를 무시(위조 불가). 예전 `LEC_TRUST_PROXY=1`은 `1`과 같습니다 |
| `--max-participants` | `LEC_MAX_PARTICIPANTS` | 500 | 연수 하나의 최대 참가자 수 |
| `--max-connections` | `LEC_MAX_CONNECTIONS` | 5000 | 서버 전체 동시 연결 수 |
| `--max-sockets-per-ip` | `LEC_MAX_SOCKETS_PER_IP` | 500 | IP 하나(학교 공유기 하나)의 실시간 연결 수 |
| `--no-uploads` | `LEC_UPLOADS=0` | | 파일 올리기 끄기 |
| `--quiet` | `LEC_LOG=0` | | 요청 기록 끄기 |

보안을 위해 사이트 폴더 안의 `.`으로 시작하는 파일·폴더, `*.md`(운영 메모), `lecpage.blueprint.json`, 관리자 키 파일, DB 파일은 **절대 내보내지 않습니다**(404).

## 3. Docker / docker compose (학교 서버·NAS·VPS)

```bash
cd skills/lecpage/backends/node-server
mkdir -p site && cp -r /경로/연수사이트/* site/
docker compose up -d                                  # → http://localhost:8787 (이 컴퓨터에서만)
docker compose exec live cat /data/admin-key.txt     # 처음 만든 관리자 키
```

- **교실 와이파이의 참가자도 들어오게** 하려면 열어 줄 때만 명시합니다: `LEC_BIND=0.0.0.0 docker compose up -d` → `http://서버주소:8787`. 암호화 없는 HTTP라 교실 안에서만 쓰세요.
- 키를 직접 정하려면: `docker compose run --rm live node server.mjs --hash '내관리자키(12자 이상)'` 로 해시를 만든 뒤 `.env`에 `LEC_ADMIN_KEY_HASH=…`.
- 도메인이 있으면 HTTPS까지: `.env`에 `LEC_DOMAIN=lec.school.kr`, `LEC_TRUSTED_PROXIES=1`을 적고 `docker compose --profile https up -d`. Caddy가 인증서를 자동으로 받고, 8787은 이 컴퓨터에만 열려 있습니다(80·443 포트가 이 서버로 열려 있어야 함).
- 사이트(Caddy)와 실시간 서버를 나눠 띄우는 구성은 `skills/lecpage/templates/deploy/server/`의 `docker-compose.yml`·`Caddyfile`을 쓰세요. nginx를 쓰면 `nginx.conf`처럼 `X-Forwarded-For`를 `$remote_addr`로 **덮어쓰고** `LEC_TRUSTED_PROXIES=1`로 띄웁니다.
- 컨테이너는 **root가 아닌 `node` 사용자**, 읽기 전용 파일시스템, 모든 권한(capability) 제거로 실행됩니다. 데이터는 Docker 볼륨(`live_data`)에 쌓여 권한을 따로 맞출 필요가 없습니다. 완전 삭제: `docker compose down -v`.
- 예전 구성(`./data` 폴더를 붙여 root로 실행)에서 올리면 "데이터 폴더에 쓸 수 없습니다"가 뜹니다. 그 폴더를 계속 쓰려면 `sudo chown -R 1000:1000 data`를 한 번 실행하세요.
- **Synology NAS**: Container Manager → 프로젝트 → 이 폴더 선택 → 빌드. 공유기에서 포트를 열거나 Synology의 역방향 프록시(HTTPS)를 쓰세요.

## 4. 클라우드에 올리기

| 곳 | 방법 | 주의 |
|---|---|---|
| **AWS Lightsail / EC2** | Ubuntu 인스턴스 → `sudo apt install docker.io docker-compose-v2` → 이 폴더 복사 → 위 3번 그대로 | 방화벽(Lightsail "네트워킹")에서 80·443(또는 8787) 열기. 가장 싼 플랜으로 충분 |
| **Fly.io** | `fly launch`(Dockerfile 자동 인식) → `fly volumes create lecdata --size 1` → `fly.toml`에 `[mounts] source="lecdata" destination="/data"` → `fly secrets set LEC_ADMIN_KEY=…` → `fly deploy` | 볼륨 없으면 재배포 때 데이터가 사라짐 |
| **Railway** | 새 프로젝트 → GitHub 저장소의 이 폴더(Root Directory) → Variables에 `LEC_ADMIN_KEY` → Volume을 `/data`에 연결 | |
| **Render** | Web Service → Docker → Root Directory 이 폴더 → Environment에 `LEC_ADMIN_KEY` → Disk를 `/data`에 연결(유료 인스턴스) | 무료 인스턴스는 디스크가 없고 15분 쉬면 잠듭니다. 연수 직전 접속해 깨우고, 끝나면 CSV를 바로 받으세요 |

어디서나 HTTPS 주소(예: `https://lec-live.fly.dev`)를 blueprint `live.url`에 넣습니다. 사이트를 다른 곳(GitHub Pages 등)에 올렸다면 `LEC_ORIGINS=https://내사이트주소`를 꼭 설정하세요.

## 5. 여러 강사가 한 서버를 함께 쓸 때(공유 모드)

운영자가 `LEC_SETUP_TOKEN`을 정해 강사들에게 알려 주면, 각 강사는 자기 연수 코드와 관리자 키의 해시를 등록합니다(최초 1회).

```bash
HASH=$(node server.mjs --hash '강사A의관리자키')
curl -X POST https://서버/api/AB12CD/init -H 'Content-Type: application/json' \
     -H "X-Lec-Setup: $(node -p "encodeURIComponent('설정토큰')")" \
     -d "{\"adminKeyHash\":\"$HASH\",\"settings\":{\"retentionDays\":14,\"maxUploadMb\":10}}"
```

이때는 `LEC_ADMIN_KEY`를 비워 둡니다(등록되지 않은 코드는 404). 관리자 키·설정 토큰에 한글을 쓰면 헤더에는 `encodeURIComponent`로 바꿔 보냅니다(브라우저 어댑터는 자동으로 처리).

## 6. 개인정보·보안

- 참가자 토큰과 관리자 키는 **SHA-256 해시만** 저장하고, 관리자 키는 고정 시간 비교를 합니다.
- 모든 입력은 서버에서 다시 검사합니다(길이: 별명 20·질문 500·글 1000·채팅 300자, 형식, 허용 컬렉션). HTML은 그대로 글자로 저장하고, 화면은 `textContent`로만 그립니다.
- 파일은 **내용(매직 바이트)으로** 형식을 확인합니다: PNG·JPG·GIF·WEBP·PDF·MP3·MP4만, 기본 20MB. SVG·HTML은 받지 않고, 파일 응답에는 `nosniff`와 CSP를 붙입니다.
- 속도 제한은 참가자 토큰 기준(질문 8/분, 도움 요청 6/분, 쓰기 90/분 …)이고, IP 기준은 학교 한 곳(NAT) 전체가 막히지 않을 만큼 넉넉합니다(쓰기·읽기 각각 분당 6,000).
- **틀린 관리자 키**(헤더·WebSocket 모두)는 (연수 코드, IP)마다 10분에 10번, IP마다 10분에 20번까지만 받습니다. 넘으면 그 시간이 끝날 때까지 맞는 키도 `429`(Retry-After)로 막힙니다. WebSocket은 틀린 키 3번이면 끊깁니다. 콘솔이 막혔다면 몇 분 기다리거나 다른 네트워크(휴대폰 핫스폿)에서 여세요.
- 별명 `강사`·`운영자`·`admin`·`lecpage`(대소문자·띄어쓰기 무시)는 참가자가 쓸 수 없습니다.
- 답·진행·도움 요청의 `by`(참가자 id)는 강사(관리자 키)와 본인에게만 보냅니다. 닫힌 투표의 답은 고칠 수 없습니다.
- **보드 파일**: 글에는 이 서버에 **본인이 올린 파일만** 붙일 수 있습니다(바깥 주소·남의 파일·다른 글의 파일은 거부). 파일은 보이는 글에 붙어 있는 동안만 내려받을 수 있고(`Cache-Control: private, max-age=300`), 강사가 글을 숨기면 바로 404, 지우면 파일도 지웁니다. 글에 붙지 않은 업로드는 하루 뒤 지웁니다.
- 강사 화면은 보드가 파일을 받지 않게 만든 사이트(`allowFiles:false`, 만 14세 미만 연수 등)에서 상태(`ui.uploads=false`)를 적어 두어, 서버도 업로드와 파일 첨부를 거부합니다(`/init`의 `settings.uploads:false`도 같음). 보드 '먼저 확인'(`moderation`)도 서버가 지킵니다.
- 요청 기록에는 시각·방법·경로·상태만 남고 IP·토큰·내용은 남기지 않습니다.
- 마지막 사용 뒤 보관 기간이 지나면 연수 데이터와 파일을 자동으로 지웁니다. 강사 화면의 "모두 지우기"(`DELETE /api/<코드>`)로 바로 지울 수도 있습니다.
- 백업: 서버를 멈추고 `data/` 폴더를 복사하면 됩니다.

## 7. 확인과 테스트

```bash
curl http://localhost:8787/api/health                 # {"ok":true,...}
node --test skills/lecpage/engine/test/live-server.test.mjs    # 프로토콜 시험(저장소 루트에서)
```

## 8. 한계

- 프로세스 하나로 동작합니다(여러 대로 늘리지 않음). 수업 몇 개(동시 접속 수백 명)는 가장 작은 서버로 충분합니다. 연수 하나에 글은 컬렉션마다 20,000개까지입니다.
- 속도 제한·틀린 키 카운터는 메모리에 있어 재시작하면 초기화됩니다.
- 관리자 키가 있는 서버는 처음 쓰이는 코드를 자동으로 만듭니다(IP마다 시간당 30개까지). 혼자 쓰는 서버라면 `LEC_CODES`에 내 코드만 적는 게 가장 안전합니다.
- SSE 연결에는 관리자 전용 알림(참가자 명단·출석·설문)이 오지 않습니다. 콘솔은 WebSocket을 쓰고, 막히면 15초마다 새로 읽습니다.
