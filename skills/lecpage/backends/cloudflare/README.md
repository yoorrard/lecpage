# lecpage 실시간 서버 — Cloudflare Workers + Durable Objects

**무료 플랜으로 운영할 수 있는** 실시간 서버입니다. 연수 코드마다 Durable Object가 하나씩 생기고(SQLite 저장소), 참가자 화면과는 **WebSocket Hibernation**으로 연결합니다. 연결이 쉬는 동안에는 비용(Duration)이 들지 않고, 심장 박동(`ping`)은 객체를 깨우지 않고 응답합니다. WebSocket이 막힌 학교망에서는 SSE, 그것도 안 되면 5초 폴링으로 자동 전환합니다.

- 규칙: `docs/architecture.md` §5.1 HTTP 프로토콜 v1 (Node 서버와 같은 `src/protocol.js`)
- 파일 올리기: R2를 연결하면 켜지고, 없으면 `/upload`가 `503 uploads_disabled`로 답합니다(나머지 기능은 그대로).

## 1. 버튼으로 배포(가장 쉬움)

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/yoorrard/lecpage/tree/main/skills/lecpage/backends/cloudflare)

1. 버튼을 누르고 Cloudflare 계정으로 로그인합니다(무료 가입 가능).
2. GitHub(또는 GitLab) 연결을 허락하면 이 폴더만 담은 저장소가 내 계정에 복사됩니다.
3. **ADMIN_KEY**(강사 화면 비밀번호) 칸에 **직접 만든 12자 이상**의 값을 넣습니다(예: `openssl rand -hex 12`). 짧거나 예시 값(`change-me…`)이면 서버가 모든 요청에 `503 weak_admin_key`로 답합니다. 혼자 쓰면 **SETUP_TOKEN**은 비워 둡니다.
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
| `MAX_PARTICIPANTS` | 500 | 연수 하나의 최대 참가자 수 |
| `MAX_SOCKETS_PER_IP` | 500 | IP 하나(학교 공유기 하나)가 연수 하나에 여는 실시간 연결 수 |
| `NEW_CODES_PER_HOUR` | 30 | IP 하나가 한 시간에 새로 만들 수 있는 연수 코드 수(자동 생성 모드) |
| 비밀 `ADMIN_KEY` | | 모든 코드에 통하는 관리자 키(한 강사 전용 서버). 12자 이상, 예시 값 금지 |
| 비밀 `SETUP_TOKEN` | | 공유 모드: 강사들이 코드를 등록할 때 쓰는 토큰(12자 이상) |

- 연수 코드는 **처음 쓰일 때** 생깁니다: `ADMIN_KEY`나 `ALLOWED_CODES`가 있으면 첫 참여·콘솔 연결이, 공유 모드면 `/init`이 만듭니다. 모르는 코드를 **읽기만** 해서는 저장소가 생기지 않고, 연수가 없는 객체는 알람 때 스스로 비웁니다. 혼자 쓰는 서버라면 `ALLOWED_CODES`에 내 코드만 적는 게 가장 안전합니다.
- `GUARD`(Durable Object)는 IP마다 틀린 관리자 키·새 코드 수를 모든 연수에 걸쳐 셉니다. `wrangler.toml`의 바인딩·마이그레이션(v2)을 그대로 두세요(배포 때 자동 적용).

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

- **WebSocket(기본)**: 접속할 때 요청 1번. 받는 메시지는 20개당 1요청으로 계산되고 내보내는 메시지는 무료입니다. 40명이 2시간 동안 질문·진행 현황를 해도 수천 요청 수준입니다.
- **SSE(WebSocket 차단 시)**: 연결이 열려 있는 동안 객체가 깨어 있어 Duration이 듭니다(128MB × 2시간 ≈ 900 GB-s, 한도의 7%).
- **폴링(둘 다 차단 시)**: 5초마다 1요청(변화가 없으면 10초, 숨긴 탭은 30초). 50명 × 2시간이면 약 4~7만 요청으로 하루 한도에 가깝습니다. 큰 연수(100명+)를 폴링만으로 해야 하는 학교망이라면 Node 서버나 유료 플랜(월 5달러)을 권합니다.

## 6. 로컬 실행과 시험

```bash
cp .dev.vars.example .dev.vars          # ADMIN_KEY= 에 직접 만든 12자 이상 값을 적기(비어 있으면 콘솔을 못 씀)
npx wrangler dev --port 8788            # 로그인 없이 로컬에서 동작
# 저장소 루트에서 프로토콜 시험(같은 서버로 여러 번 돌리면 NEW_CODES_PER_HOUR 를 크게):
#   npx wrangler dev --port 8788 --var ADMIN_KEY:cf-test-admin-key-2026 --var NEW_CODES_PER_HOUR:100000
LEC_CF_URL=http://127.0.0.1:8788 LEC_CF_ADMIN='cf-test-admin-key-2026' node --test skills/lecpage/engine/test/live-cloudflare.test.mjs
```

## 7. 보안 메모

- 관리자 키·참가자 토큰은 SHA-256 해시로만 다루고, 비교는 고정 길이 해시끼리 합니다.
- 모든 입력은 서버에서 다시 검사합니다(길이·형식·허용 컬렉션). HTML은 글자로만 저장합니다.
- 속도 제한은 참가자 토큰 기준(학교 NAT 하나에 수십 명이 있어도 서로 막지 않음), IP(`CF-Connecting-IP`) 기준은 넉넉한 보조 장치입니다(읽기 포함). 객체가 잠들면 카운터가 초기화되는 "부드러운" 제한입니다. 여러 연수를 한꺼번에 두드리는 공격은 Cloudflare 대시보드의 WAF 속도 제한 규칙(무료 1개)으로 더 막을 수 있습니다.
- **틀린 관리자 키**(헤더·WebSocket)는 (연수 코드, IP)마다 10분에 10번, IP마다 모든 코드를 합쳐 10분에 20번까지만 받고, 넘으면 맞는 키도 `429`(Retry-After)로 막습니다. WebSocket은 틀린 키 3번이면 끊깁니다.
- 별명 `강사`·`운영자`·`admin`·`lecpage`는 참가자가 쓸 수 없습니다. 답·진행·도움 요청의 `by`는 관리자와 본인에게만 보냅니다. 닫힌 투표의 답은 고칠 수 없습니다.
- **보드 파일(R2)**: 글에는 이 서버에 본인이 올린 파일만 붙일 수 있고(바깥 주소 거부), 파일은 보이는 글에 붙어 있는 동안만 제공합니다(`Cache-Control: private, max-age=300`). 강사가 숨기면 바로 404, 글을 지우면 R2에서도 지웁니다. 글에 붙지 않은 업로드는 다음 정리 알람 때 지웁니다. 콘솔이 `ui.uploads=false`(파일을 받지 않는 보드)를 적어 두면 업로드와 첨부를 서버가 거부합니다.
- 로그(Workers Logs)에는 오류 메시지만 남기고 내용·토큰·IP는 남기지 않습니다. `invocation_logs = false`.
- 참가자 화면에서 공개되는 것: 질문(작성자 ID 없음)·보드·도움 요청·진행·투표·채팅. 참가자 명단·출석·설문은 관리자 키로만 읽습니다.
