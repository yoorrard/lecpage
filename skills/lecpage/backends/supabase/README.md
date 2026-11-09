# lecpage 실시간 — Supabase (무료 플랜)

서버를 직접 운영하지 않고 Supabase 무료 프로젝트 하나로 실시간 기능을 쓰는 방법입니다. `schema.sql` 한 파일을 SQL Editor에 붙여 넣으면 끝납니다.

## 왜 이렇게 만들었나

- **Supabase Auth(익명 로그인)를 쓰지 않습니다.** 익명 로그인은 IP당 시간당 30번으로 제한되는데, 학교는 보통 한 개의 공인 IP(NAT)로 나가므로 한 반만 들어와도 막힙니다. 대신 참가자가 들어올 때 서버가 임의의 비밀 토큰을 만들어 주고(데이터베이스에는 SHA-256만 저장), 모든 쓰기는 이 토큰이나 관리자 키를 확인하는 **SECURITY DEFINER 함수(RPC)** 로만 합니다.
- **읽기는 RLS(행 수준 보안)** 로 막습니다. 브라우저는 요청마다 `x-lec-code: <연수 코드>` 헤더를 보내고, 정책은 그 코드의 행만 보여 줍니다. 코드를 모르면 아무것도 읽을 수 없습니다. 질문 작성자 ID 열은 아예 읽을 권한을 주지 않고(익명 보장), 숨긴 글의 내용은 공개 표에서 빼서 비공개 표로 옮깁니다. 참가자 명단·출석·설문은 관리자 키로만 읽습니다.
- **실시간은 Broadcast의 작은 "틱" 신호만** 보냅니다. 무료 플랜은 동시 연결 200, 초당 메시지 100(받는 사람마다 1개로 셈)이 한도라서, 100명이 동시에 "완료"를 눌러도 메시지가 폭주하지 않게 데이터베이스가 채널마다 **2초에 한 번**까지만 `{rev, r:{반응}}`을 보냅니다. 브라우저는 틱을 받으면 자기 커서(rev) 이후 바뀐 행만 RLS로 읽어 옵니다. 틱 내용은 믿지 않으므로(받으면 데이터베이스에서 다시 읽을 뿐) 누가 가짜 메시지를 보내도 질문·상태 같은 화면 데이터는 바뀌지 않습니다. 반응 이모지 수만 그대로 띄웁니다.
  - 공개 채널 `lec:<코드>`: 질문·보드·도움·진행·투표·채팅·상태·반응
  - 콘솔 채널 `lec:<코드>:adm`: 참가자·출석·설문까지 모든 변화(1초 간격)
  - 2초 안에 다시 쓴 사람은 응답의 `_flush` 시간 뒤에 `lec_flush()`를 불러 남은 틱을 내보냅니다(pg_cron 없이도 마지막 변화가 묻히지 않음).
- WebSocket이 막힌 학교망이면 7초마다 새로 읽기(폴링)로 자동 전환합니다.

## 설치(10분)

1. [supabase.com](https://supabase.com)에서 무료 프로젝트를 만듭니다. 지역은 **Northeast Asia (Seoul)** 를 고릅니다.
2. 왼쪽 **SQL Editor → New query** 에 `schema.sql` 전체를 붙여 넣고 **Run**. (여러 번 실행해도 안전합니다. 새 버전이 나오면 다시 실행하면 함수가 갱신됩니다.)
3. 같은 곳에서 연수를 등록합니다. 관리자 키는 8자 이상, 강사만 알게 정하세요.
   ```sql
   select lec_private.init_training('AB12CD', '관리자키를-여기에', '{"retentionDays": 30}');
   ```
   SQL Editor 기록에 키가 남는 것이 싫다면 lecpage 앱이 만들어 주는 해시 버전을 쓰세요: `select lec_private.init_training_hash('AB12CD', '<SHA-256 hex>', '{}');`
4. **Project Settings → API Keys** 에서 프로젝트 주소(`https://<ref>.supabase.co`)와 **publishable 키(`sb_publishable_…`)**(예전 이름: anon 키)를 복사해 lecpage 설정에 넣습니다(`live.provider = "supabase"`, `live.url`, `live.anonKey`, `live.code`). **secret / service_role 키는 절대 넣지 마세요.**
5. 연수 사이트 `check.html`(접속 진단)에서 "실시간 연결 방식"이 나오면 끝입니다.

> 2026년 10월부터 새 표는 Data API에 자동으로 열리지 않습니다. `schema.sql`이 필요한 권한(GRANT)만 직접 주므로 따로 할 일은 없습니다.

## 파일 올리기

`schema.sql`이 공개 버킷 `lec-uploads`(20MB, PNG·JPG·GIF·WEBP·PDF·MP3·MP4만)를 만듭니다. 참가자는 `lec_upload_ticket()`으로 10분짜리 업로드 자리(임의 경로)를 받아야만 올릴 수 있고, 목록 보기는 허용하지 않습니다. 연수별 한도는 `settings.maxUploadMb`(최대 20), 끄려면 `settings.uploads = false`.

무료 플랜 저장 용량은 1GB입니다. 영상(MP4)은 금방 차므로 큰 연수라면 링크 공유를 권합니다.

## 보관 기간과 자동 정리

- `select lec_private.cleanup();` 은 마지막 사용 뒤 `retention_days`가 지난 연수의 모든 행을 지웁니다.
- 매일 자동으로: **Integrations → Cron** 을 켠 뒤 `schema.sql`을 다시 실행하면 `lecpage-cleanup`(매일 03:17 UTC)이 예약됩니다.
- **올린 파일은 SQL로 지울 수 없습니다**(Storage API로만 삭제 가능). 강사 콘솔의 "모두 지우기"(`lec_purge`)는 10분 동안 그 연수 폴더 삭제를 허용하고 브라우저가 파일까지 지웁니다. 자동 정리로 지워진 연수의 파일은 **Storage → lec-uploads → <코드> 폴더**를 직접 지우세요.

## 여러 강사가 한 프로젝트를 함께 쓸 때

운영자가 설정 토큰을 정하면 강사들이 API로 연수를 등록할 수 있습니다(`lec_init`, 이미 있는 코드는 거절).

```sql
select lec_private.set_setup_secret('강사들에게-알려줄-설정토큰');
```

무료 플랜의 Realtime 한도(동시 연결 200, 초당 100 메시지)는 **프로젝트 전체**에 적용되므로 동시에 여는 연수가 많으면 `flushMs`를 3000~5000으로 늘리세요(`init_training`의 settings).

## 꼭 알아 둘 점

- 무료 프로젝트는 **7일 동안 요청이 없으면 일시 정지**됩니다. 연수 하루 전 접속 진단으로 깨어 있는지 확인하세요(정지되면 대시보드에서 Restore).
- 공개 Broadcast 채널은 코드를 아는 사람 누구나 구독할 수 있습니다(틱에는 내용이 없음). 연수 코드는 6자 이상 예측하기 어렵게 정하세요.
- 관리자 키를 맞히려는 시도를 DB가 따로 막지 않습니다. **12자 이상의 긴 키**를 쓰세요.
- 속도 제한(분 단위, 참가자 토큰 기준): 쓰기 90, 질문 8, 도움 6, 보드 12, 채팅 30, 공감 120, 반응 90, 파일 10. 들어오기는 연수당 분당 600, 같은 IP 분당 300(느슨함).
- 점검: 대시보드 **Advisors → Security** 에서 "Function Search Path Mutable"·"RLS Disabled" 경고가 없어야 합니다(모든 함수에 `search_path = ''`, 모든 표에 RLS).

## 함수 목록(API)

| 함수 | 누가 | 하는 일 |
|---|---|---|
| `lec_join(code, nickname, name?, school?, consent?)` | 누구나 | 참가 → `{id, token}` |
| `lec_snapshot(code, since)` | 누구나(헤더 필요, RLS) | rev 커서 이후 바뀐 공개 데이터 |
| `lec_mine(code, token)` | 참가자 | 내 출석·설문 |
| `lec_add(code, token, col, doc, admin?)` | 참가자(투표 만들기는 관리자) | 글 추가(진행·응답·출석·설문은 덮어쓰기) |
| `lec_update(code, token, admin, col, id, patch)` | 본인 또는 관리자 | 허용된 칸만 고치기 |
| `lec_vote` / `lec_like(code, token, id)` | 참가자 | 1인 1회 공감/좋아요 |
| `lec_react(code, token, {emoji: n})` | 참가자 | 반응(틱에 모아서 전송) |
| `lec_flush(code)` | 누구나 | 밀린 틱 내보내기 |
| `lec_set_state(code, admin, patch)` | 관리자 | 지금 단계·쪽·따라오기·타이머·공지 |
| `lec_remove`, `lec_admin_snapshot`, `lec_export`, `lec_purge`, `lec_check_admin` | 관리자 | 삭제·전체 보기·내보내기·모두 지우기·키 확인 |
| `lec_upload_ticket(code, token, name, type, size)` | 참가자 | 업로드 자리 받기 |
| `lec_init(code, adminKeyHash, setup, settings)` | 설정 토큰 | 공유 프로젝트에서 연수 등록 |

오류는 PostgREST 규칙(`PTxyz` → HTTP xyz)으로 돌아오며, `message`는 기계용 코드(`too_long`, `rate_limited` …), `hint`는 한국어 설명입니다.

## 시험

저장소 루트에서 `node --test skills/lecpage/engine/test/live-supabase.test.mjs` — 로컬 PostgreSQL(서버 바이너리 필요)에 Supabase 역할·`realtime.send`·storage 표를 흉내 내어 스키마 전체를 검사합니다.
