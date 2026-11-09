# lecpage 실시간 서버 — Cloudflare Workers + Durable Objects

**무료 플랜으로 운영할 수 있는** 실시간 서버입니다. 연수 코드마다 Durable Object가 하나씩 생기고(SQLite 저장소), 참가자 화면과는 **WebSocket Hibernation**으로 연결합니다. 연결이 쉬는 동안에는 비용(Duration)이 들지 않고, 심장 박동(`ping`)은 객체를 깨우지 않고 응답합니다. WebSocket이 막힌 학교망에서는 SSE, 그것도 안 되면 5초 폴링으로 자동 전환합니다.

- 규칙: `docs/architecture.md` §5.1 HTTP 프로토콜 v1 (Node 서버와 같은 `src/protocol.js`)
- 파일 올리기: R2를 연결하면 켜지고, 없으면 `/upload`가 `503 uploads_disabled`로 답합니다(나머지 기능은 그대로).

## 1. 버튼으로 배포(가장 쉬움)

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/yoorrard/lecpage/tree/main/skills/lecpage/backends/cloudflare)

1. 버튼을 누르고 Cloudflare 계정으로 로그인합니다(무료 가입 가능).
2. GitHub(또는 GitLab) 연결을 허락하면 이 폴더만 담은 저장소가 내 계정에 복사됩니다.
3. **ADMIN_KEY**(강사 콘솔 비밀번호) 칸에 8자 이상의 값을 넣습니다. 혼자 쓰면 **SETUP_TOKEN**은 비워 둡니다.
4. 배포가 끝나면 `https://lecpage-live.<내계정>.workers.dev` 주소가 나옵니다. 이 주소를 lecpage 설정의 실시간 서버 주소(`live.provider = "http"`, `live.url`)에 넣습니다.
5. 확인: 브라우저로 `https://…workers.dev/api/health` → `{"ok":true,…}`

> 내 저장소에 직접 올려 둔 경우 버튼 주소의 `url=` 뒤를 내 저장소의 이 폴더 주소로 바꾸면 됩니다.

## 2. 명령줄로 배포

```bash
cd skills/lecpage/backends/cloudflare
npm install                 # wrangler(고정 버전)
npx wrangler login
npx wrangler secret put ADMIN_KEY        # 관리자 키 입력
npx wrangler deploy
```

설정 값(`wrangler.toml`의 `[vars]`):

| 이름 | 기본 | 설명 |
|---|---|---|
| `ALLOWED_ORIGINS` | (모두 허용) | 이 서버를 부를 사이트 주소. 예: `https://teacher.github.io` |
| `RETENTION_DAYS` | 30 | 마지막 사용 뒤 며칠 지나면 연수 데이터를 자동 삭제(알람) |
| `MAX_UPLOAD_MB` | 20 | 파일 크기 한도 |
| `ALLOWED_CODES` | (제한 없음) | 쓸 수 있는 연수 코드 목록 |
| `OPEN_INIT` | false | `true`면 `/init`을 처음 부른 사람이 코드를 차지(폐쇄망 전용) |
| 비밀 `ADMIN_KEY` | | 모든 코드에 통하는 관리자 키(한 강사 전용 서버) |
| 비밀 `SETUP_TOKEN` | | 공유 모드: 강사들이 코드를 등록할 때 쓰는 토큰 |

## 3. 공유 모드(운영자 한 명이 여러 연수를 받아 주기)

교육청·연구회 담당자가 Worker 하나를 올려 두고 여러 강사가 함께 쓰는 방식입니다. 각 연수는 자기 Durable Object(데이터·관리자 키)를 따로 가지므로 서로 보이지 않습니다.

1. 운영자: `ADMIN_KEY`는 **비워 두고** `npx wrangler secret put SETUP_TOKEN`으로 설정 토큰을 정해 강사들에게 알려 줍니다.
2. 강사: 연수 코드(영문·숫자 6자 이상, 예측하기 어렵게)와 관리자 키를 정하고 한 번 등록합니다. lecpage 앱의 배포 단계가 대신 해 주며, 손으로 하려면:

```bash
HASH=$(printf '%s' '강사A의관리자키' | sha256sum | cut -d' ' -f1)
curl -X POST https://relay.example.workers.dev/api/AB12CD/init \
  -H 'Content-Type: application/json' -H 'X-Lec-Setup: 설정토큰(한글이면 URL 인코딩)' \
  -d "{\"adminKeyHash\":\"$HASH\",\"settings\":{\"retentionDays\":14}}"
```

3. 등록하지 않은 코드는 `404 unknown_training`. 관리자 키를 바꾸려면 같은 요청에 `X-Lec-Admin: 지금 키`를 붙여 다시 보냅니다.

## 4. 파일 올리기(R2, 선택)

R2는 결제 수단을 등록해야 켤 수 있습니다(10GB까지 무료).

```bash
npx wrangler r2 bucket create lecpage-uploads
```

`wrangler.toml` 맨 아래 `[[r2_buckets]]` 세 줄의 `#`을 지우고 다시 배포합니다. 파일은 `/api/<코드>/files/<임의 이름>`으로 제공되며, 내용(매직 바이트)으로 이미지·PDF·MP3·MP4만 받습니다. 연수 데이터가 지워질 때 그 코드의 파일도 함께 지웁니다.

## 5. 무료 플랜으로 충분할까?

무료 한도(하루, UTC 0시 초기화): Workers 요청 10만, Durable Object 요청 10만, Duration 13,000 GB-s, 저장 5GB.

- **WebSocket(기본)**: 접속할 때 요청 1번. 받는 메시지는 20개당 1요청으로 계산되고 내보내는 메시지는 무료입니다. 40명이 2시간 동안 질문·진행 체크를 해도 수천 요청 수준입니다.
- **SSE(WebSocket 차단 시)**: 연결이 열려 있는 동안 객체가 깨어 있어 Duration이 듭니다(128MB × 2시간 ≈ 900 GB-s, 한도의 7%).
- **폴링(둘 다 차단 시)**: 5초마다 1요청(변화가 없으면 10초, 숨긴 탭은 30초). 50명 × 2시간이면 약 4~7만 요청으로 하루 한도에 가깝습니다. 큰 연수(100명+)를 폴링만으로 해야 하는 학교망이라면 Node 서버나 유료 플랜(월 5달러)을 권합니다.

## 6. 로컬 실행과 시험

```bash
cp .dev.vars.example .dev.vars          # ADMIN_KEY 값 확인
npx wrangler dev --port 8788            # 로그인 없이 로컬에서 동작
# 저장소 루트에서 프로토콜 시험:
LEC_CF_URL=http://127.0.0.1:8788 LEC_CF_ADMIN='change-me-관리자키' node --test skills/lecpage/engine/test/live-cloudflare.test.mjs
```

## 7. 보안 메모

- 관리자 키·참가자 토큰은 SHA-256 해시로만 다루고, 비교는 고정 길이 해시끼리 합니다.
- 모든 입력은 서버에서 다시 검사합니다(길이·형식·허용 컬렉션). HTML은 글자로만 저장합니다.
- 속도 제한은 참가자 토큰 기준(학교 NAT 하나에 수십 명이 있어도 서로 막지 않음), IP 기준은 넉넉한 보조 장치입니다. 객체가 잠들면 카운터가 초기화되는 "부드러운" 제한입니다.
- 로그(Workers Logs)에는 오류 메시지만 남기고 내용·토큰·IP는 남기지 않습니다. `invocation_logs = false`.
- 참가자 화면에서 공개되는 것: 질문(작성자 ID 없음)·보드·도움 요청·진행·투표·채팅. 참가자 명단·출석·설문은 관리자 키로만 읽습니다.
