# lecpage 실시간 서버 (Node, 의존성 없음)

연수 사이트의 실시간 기능(익명 질문·공감, "막혔어요", 실습 진행, 참여 보드와 파일 올리기, 투표·워드클라우드, 채팅, 출석, 반응, 강사 콘솔 상태)을 받아 주는 작은 서버입니다. **생성한 연수 사이트도 함께 제공**하므로 컨테이너 하나, 컴퓨터 한 대로 모든 것이 끝납니다.

- 필요한 것: **Node.js 22.13 이상**(22.5~22.12도 `--experimental-sqlite`를 붙이면 동작). `npm install`이 필요 없습니다.
- 저장: 내장 SQLite(`node:sqlite`) 파일 하나 + 올린 파일 폴더(`data/`).
- 실시간: WebSocket → SSE → 5초 새로 읽기(폴링) 순서로 자동 전환. 학교망이 WebSocket을 막아도 SSE나 폴링으로 이어집니다.
- 규칙: `docs/architecture.md` §5.1 HTTP 프로토콜 v1. Cloudflare 판(`../cloudflare`)과 같은 코드(`lib/protocol.js`)를 씁니다.

## 1. 내 컴퓨터에서 바로 (강의실 와이파이·리허설)

```bash
cd skills/lecpage/backends/node-server
node --experimental-sqlite server.mjs --static ../../../../my-site --admin-key '관리자키-8자-이상'
```

- 브라우저에서 `http://localhost:8787` → 연수 사이트, `http://localhost:8787/console.html` → 강사 콘솔.
- 같은 와이파이의 참가자는 `http://<내 컴퓨터 IP>:8787` 로 들어옵니다(Windows는 처음 실행 때 "방화벽 허용"을 누르세요).
- `--admin-key`를 빼면 첫 실행 때 키를 만들어 **화면에 한 번만** 보여 주고, 해시만 `data/admin-key.sha256`에 저장합니다.
- 사이트 설정(blueprint `live`)은 `provider: "http"`, `url: ""`(같은 주소) 또는 서버 주소로 둡니다.

## 2. 설정(명령줄 옵션 = 환경 변수)

| 옵션 | 환경 변수 | 기본값 | 설명 |
|---|---|---|---|
| `--port` | `PORT` | 8787 | 포트 |
| `--host` | `LEC_HOST` | 0.0.0.0 | 듣는 주소 |
| `--data` | `LEC_DATA` | ./data | DB·올린 파일 폴더 |
| `--static` | `LEC_STATIC` | (없음) | 함께 제공할 사이트 폴더 |
| `--admin-key` | `LEC_ADMIN_KEY` | (자동 생성) | 관리자 키(모든 연수 코드에 적용) |
| `--admin-key-hash` | `LEC_ADMIN_KEY_HASH` | | 키 대신 SHA-256 해시. `node server.mjs --hash '키'`로 만듭니다 |
| `--setup-token` | `LEC_SETUP_TOKEN` | | 여러 강사가 함께 쓰는 서버: `/init`으로 코드별 관리자 키 등록 허용 |
| `--codes` | `LEC_CODES` | | 쓸 수 있는 연수 코드 목록(쉼표) |
| `--origins` | `LEC_ORIGINS` | (모두 허용) | 이 서버를 부를 사이트 주소(쉼표). 사이트를 따로 올렸다면 꼭 적으세요 |
| `--max-upload-mb` | `LEC_MAX_UPLOAD_MB` | 20 | 파일 크기 한도 |
| `--retention-days` | `LEC_RETENTION_DAYS` | 30 | 마지막 사용 뒤 이 기간이 지나면 자동 삭제 |
| `--trust-proxy` | `LEC_TRUST_PROXY=1` | | Caddy·nginx 뒤에서 `X-Forwarded-For`로 IP 구분 |
| `--no-uploads` | `LEC_UPLOADS=0` | | 파일 올리기 끄기 |
| `--quiet` | `LEC_LOG=0` | | 요청 기록 끄기 |

보안을 위해 사이트 폴더 안의 `.`으로 시작하는 파일·폴더, `*.md`(운영 메모), `lecpage.blueprint.json`, DB 파일은 **절대 내보내지 않습니다**(404).

## 3. Docker / docker compose (학교 서버·NAS·VPS)

```bash
cd skills/lecpage/backends/node-server
mkdir -p site data && cp -r /경로/연수사이트/* site/
docker compose up -d                       # → http://서버주소:8787
docker compose logs live | grep 관리자      # 처음 만든 관리자 키 확인(한 번만 나옴)
```

- 키를 직접 정하려면: `docker compose run --rm live node server.mjs --hash '내관리자키'` 로 해시를 만든 뒤 `.env`에 `LEC_ADMIN_KEY_HASH=…`.
- 도메인이 있으면 HTTPS까지: `.env`에 `LEC_DOMAIN=lec.school.kr`, `LEC_TRUST_PROXY=1`을 적고 `docker compose --profile https up -d`. Caddy가 인증서를 자동으로 받습니다(80·443 포트가 이 서버로 열려 있어야 함).
- 사이트(Caddy)와 실시간 서버를 나눠 띄우는 구성은 `skills/lecpage/templates/deploy/server/`의 `docker-compose.yml`·`Caddyfile`을 쓰세요.
- 컨테이너는 읽기 전용 파일시스템, 모든 권한(capability) 제거로 실행됩니다. 데이터는 `./data`에만 쌓입니다.
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
- 속도 제한은 참가자 토큰 기준(질문 8/분, 도움 요청 6/분, 쓰기 90/분 …)이고, IP 기준은 학교 한 곳(NAT) 전체가 막히지 않을 만큼 넉넉합니다(분당 6,000).
- 요청 기록에는 시각·방법·경로·상태만 남고 IP·토큰·내용은 남기지 않습니다.
- 마지막 사용 뒤 보관 기간이 지나면 연수 데이터와 파일을 자동으로 지웁니다. 강사 콘솔의 "모두 지우기"(`DELETE /api/<코드>`)로 바로 지울 수도 있습니다.
- 백업: 서버를 멈추고 `data/` 폴더를 복사하면 됩니다.

## 7. 확인과 테스트

```bash
curl http://localhost:8787/api/health                 # {"ok":true,...}
node --test skills/lecpage/engine/test/live-server.test.mjs    # 프로토콜 시험(저장소 루트에서)
```

## 8. 한계

- 프로세스 하나로 동작합니다(여러 대로 늘리지 않음). 수업 몇 개(동시 접속 수백 명)는 가장 작은 서버로 충분합니다.
- 속도 제한 카운터는 메모리에 있어 재시작하면 초기화됩니다.
- SSE 연결에는 관리자 전용 알림(참가자 명단·출석·설문)이 오지 않습니다. 콘솔은 WebSocket을 쓰고, 막히면 15초마다 새로 읽습니다.
