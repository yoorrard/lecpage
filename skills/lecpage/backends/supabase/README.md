# lecpage 실시간 — Supabase (무료 플랜)

서버를 직접 운영하지 않고 Supabase 무료 프로젝트 하나로 실시간 기능을 쓰는 방법입니다. `schema.sql` 한 파일을 SQL Editor에 붙여 넣으면 끝납니다.

## 왜 이렇게 만들었나

- **Supabase Auth(익명 로그인)를 쓰지 않습니다.** 익명 로그인은 IP당 시간당 30번으로 제한되는데, 학교는 보통 한 개의 공인 IP(NAT)로 나가므로 한 반만 들어와도 막힙니다. 대신 참가자가 들어올 때 서버가 임의의 비밀 토큰을 만들어 주고(데이터베이스에는 SHA-256만 저장), 모든 쓰기는 이 토큰이나 관리자 키를 확인하는 **SECURITY DEFINER 함수(RPC)** 로만 합니다.
- **읽기는 RLS(행 수준 보안)** 로 막습니다. 브라우저는 요청마다 `x-lec-code: <연수 코드>` 헤더를 보내고, 정책은 그 코드의 행만 보여 줍니다. 코드를 모르면 아무것도 읽을 수 없습니다. 질문 작성자 ID 열은 아예 읽을 권한을 주지 않고(익명 보장), 숨긴 글의 내용은 공개 표에서 빼서 비공개 표로 옮깁니다. 참가자 명단·출석·설문은 관리자 키로만 읽습니다.
- **실시간은 Broadcast의 작은 "틱" 신호만** 보냅니다. 무료 플랜은 동시 연결 200, 초당 메시지 100(받는 사람마다 1개로 셈)이 한도라서, 100명이 동시에 "완료"를 눌러도 메시지가 폭주하지 않게 데이터베이스가 채널마다 **2초에 한 번**까지만 `{rev, rx}`를 보냅니다. 브라우저는 틱을 받으면 자기 커서(rev) 이후 바뀐 행만 RLS로 읽어 오고, 반응 수는 `lec_reactions()`로 데이터베이스에서 읽습니다.
- **틱은 힌트일 뿐입니다.** 공개 채널에는 publishable 키를 가진 누구나 메시지를 보낼 수 있어서, 브라우저는 틱 내용(반응 수 포함)을 화면에 그대로 쓰지 않고, 다시 읽기도 일정 간격으로 묶습니다(가짜 틱이 새 데이터를 가져오지 못하면 간격이 30초까지 늘어남). 비공개 채널(Realtime Authorization)은 쓰지 않습니다: Supabase 문서상 비공개 채널은 **로그인한(authenticated) 사용자만** 구독할 수 있는데, 이 설계는 학교 NAT 때문에 Supabase Auth를 쓰지 않기 때문입니다.
  - 공개 채널 `lec:<코드>`: 질문·보드·도움·진행·투표·채팅·상태·반응
  - 콘솔 채널 `lec:<코드>:adm`: 참가자·출석·설문까지 모든 변화(1초 간격)
  - 2초 안에 다시 쓴 사람은 응답의 `_flush` 시간 뒤에 `lec_flush()`를 불러 남은 틱을 내보냅니다(pg_cron 없이도 마지막 변화가 묻히지 않음).
- WebSocket이 막힌 학교망이면 7초마다 새로 읽기(폴링)로 자동 전환합니다.

## 설치(10분)

1. [supabase.com](https://supabase.com)에서 무료 프로젝트를 만듭니다. 지역은 **Northeast Asia (Seoul)** 를 고릅니다.
2. 왼쪽 **SQL Editor → New query** 에 `schema.sql` 전체를 붙여 넣고 **Run**. (여러 번 실행해도 안전합니다. 새 버전이 나오면 다시 실행하면 함수가 갱신됩니다.)
3. 같은 곳에서 연수를 등록합니다. 관리자 키는 **직접 만든 12자 이상**(예시 값·같은 글자 반복은 거부), 강사만 알게 정하세요.
   ```sql
   select lec_private.init_training('AB12CD', '직접-만든-관리자-키', '{"retentionDays": 30}');
   ```
   SQL Editor 기록에 키가 남는 것이 싫다면 lecpage 앱이 만들어 주는 해시 버전을 쓰세요: `select lec_private.init_training_hash('AB12CD', '<SHA-256 hex>', '{}');`
4. **Project Settings → API Keys** 에서 프로젝트 주소(`https://<ref>.supabase.co`)와 **publishable 키(`sb_publishable_…`)**(예전 이름: anon 키)를 복사해 lecpage 설정에 넣습니다(`live.provider = "supabase"`, `live.url`, `live.anonKey`, `live.code`). **secret / service_role 키는 절대 넣지 마세요.**
5. 연수 사이트 `check.html`(접속 확인)에서 "실시간 연결 방식"이 나오면 끝입니다.

> 2026년 10월부터 새 표는 Data API에 자동으로 열리지 않습니다. `schema.sql`이 필요한 권한(GRANT)만 직접 주므로 따로 할 일은 없습니다.

## 파일 올리기

`schema.sql`이 **비공개** 버킷 `lec-uploads`(20MB, PNG·JPG·GIF·WEBP·PDF·MP3·MP4만)를 만듭니다.

- 참가자는 `lec_upload_ticket()`으로 10분짜리 업로드 자리(임의 경로)를 받아야만 올릴 수 있습니다. Storage가 크기·형식 정보를 넘겨 주면 표에 적힌 크기·형식과 다를 때도 거절합니다. 파일 내용(매직 바이트)은 SQL로 읽을 수 없어 검사하지 못합니다. 그래서 파일은 선언된 형식(이미지·PDF·음성·영상)으로만, 그리고 아래처럼 서명된 주소로만 제공합니다.
- 글에는 **그 연수에서 본인이 올린 파일만** 붙일 수 있습니다(바깥 주소·남의 파일·다른 글의 파일은 거부). 글에는 경로만 저장하고, 브라우저가 **1시간짜리 서명 주소**를 받아 보여 줍니다(45분마다 새로 받음).
- 서명 주소는 **보이는 글에 붙은 파일**에만 나옵니다. 강사가 글을 숨기면 바로 읽을 수 없고, 글을 지우거나 "모두 지우기"를 하거나 보관 기간이 지나면 파일이 `lec_private.file_trash`에 들어갑니다.
- 끄려면 `settings.uploads = false`. 강사 화면은 보드가 파일을 받지 않는 사이트(만 14세 미만 연수 등)에서 상태에 `ui.uploads=false`를 적어 두어, 업로드 자리와 파일 첨부를 데이터베이스가 거부합니다. 보드 '먼저 확인'(`settings.moderation` 또는 `ui.moderation`)이면 새 글은 숨긴 채로 들어옵니다.
- **업데이트할 때**: 예전 `schema.sql`(공개 버킷)을 쓰던 프로젝트에서 이 파일을 다시 실행하면 버킷이 비공개로 바뀌므로, 연수 사이트도 **새로 만들어 다시 올려야** 보드 사진이 보입니다(예전 사이트는 공개 주소를 쓰기 때문).

무료 플랜 저장 용량은 1GB입니다. 영상(MP4)은 금방 차므로 큰 연수라면 링크 공유를 권합니다.

## 보관 기간과 자동 정리

- `select lec_private.cleanup();` 은 마지막 사용 뒤 `retention_days`가 지난 연수의 모든 행을 지웁니다.
- 매일 자동으로: **Integrations → Cron** 을 켠 뒤 `schema.sql`을 다시 실행하면 `lecpage-cleanup`(매일 03:17 UTC)이 예약됩니다.
- **올린 파일은 SQL로 지울 수 없습니다**(Storage API로만 삭제 가능). 그래서 지울 파일은 `lec_private.file_trash`에 모아 두고(누구도 더는 읽을 수 없음), **강사 화면이 열릴 때마다** 그 연수의 휴지통과, 이미 지워진 연수의 휴지통을 Storage에서 지웁니다(`lec_trash`). 글을 지우거나 "모두 지우기"를 하면 바로 지웁니다. 글에 붙지 않은 업로드는 하루 뒤 휴지통으로 갑니다.
- **남는 손일(선택)**: 프로젝트를 더 쓰지 않아 콘솔이 다시 열리지 않으면 휴지통의 파일이 Storage에 남습니다(읽을 수는 없음). 확인: `select count(*) from lec_private.file_trash;` — 0이 아니면 **Storage → lec-uploads**에서 그 코드 폴더를 지우세요. 프로젝트째 지우면 모두 사라집니다.

## 여러 강사가 한 프로젝트를 함께 쓸 때

운영자가 설정 토큰을 정하면 강사들이 API로 연수를 등록할 수 있습니다(`lec_init`, 이미 있는 코드는 거절).

```sql
select lec_private.set_setup_secret('강사들에게-알려줄-설정토큰');
```

무료 플랜의 Realtime 한도(동시 연결 200, 초당 100 메시지)는 **프로젝트 전체**에 적용되므로 동시에 여는 연수가 많으면 `flushMs`를 3000~5000으로 늘리세요(`init_training`의 settings).

## 꼭 알아 둘 점

- 무료 프로젝트는 **7일 동안 요청이 없으면 일시 정지**됩니다. 연수 하루 전 접속 확인으로 깨어 있는지 확인하세요(정지되면 대시보드에서 Restore).
- 공개 Broadcast 채널은 코드를 아는 사람 누구나 구독할 수 있습니다(틱에는 내용이 없음). 연수 코드는 6자 이상 예측하기 어렵게 정하세요.
- **틀린 관리자 키**는 (연수 코드, IP)와 IP마다 10분 단위로 세어, 10번(같은 IP 모든 코드 합쳐 20번)을 넘으면 맞는 키도 `429`로 막습니다. 틀린 키는 오류를 던지지 않고 PostgREST `response.status`로 403을 돌려주기 때문에 횟수가 지워지지 않습니다. IP는 `X-Forwarded-For`의 맨 오른쪽(앞단 프록시가 붙인 값)과 맨 왼쪽을 함께 셉니다. Supabase 앞단 구성에 따라 여러 사람이 한 IP로 묶일 수 있어, 그때는 그 연수의 관리자 연결이 10분 동안 막힐 수 있습니다.
- 별명 `강사`·`운영자`·`admin`·`lecpage`는 참가자가 쓸 수 없습니다. 연수 하나에 참가자는 500명까지(`settings.maxParticipants`). 닫힌 투표의 답은 고칠 수 없습니다.
- 답·진행·도움 요청의 작성자 ID(`by`)는 공개 읽기에서 뺐습니다. 본인 것은 `lec_mine()`으로, 강사는 관리자 스냅숏으로 봅니다.
- `lec_flush`는 보낼 틱이 없거나 아직 이르면 잠금 없이 바로 돌아가고, 동시에 여러 명이 불러도 한 명만 처리합니다. 커서보다 새 데이터가 없으면 `lec_snapshot`은 상태만 돌려줍니다.
- 속도 제한(분 단위, 참가자 토큰 기준): 쓰기 90, 질문 8, 도움 6, 보드 12, 채팅 30, 공감 120, 반응 90, 파일 10. 들어오기는 연수당 분당 600, 같은 IP 분당 600(느슨함).
- 점검: 대시보드 **Advisors → Security** 에서 "Function Search Path Mutable"·"RLS Disabled" 경고가 없어야 합니다(모든 함수에 `search_path = ''`, 모든 표에 RLS).

## 함수 목록(API)

| 함수 | 누가 | 하는 일 |
|---|---|---|
| `lec_join(code, nickname, name?, school?, consent?)` | 누구나 | 참가 → `{id, token}` |
| `lec_snapshot(code, since)` | 누구나(헤더 필요, RLS) | rev 커서 이후 바뀐 공개 데이터 |
| `lec_mine(code, token)` | 참가자 | 내 출석·설문, 내 진행·응답·도움 요청 |
| `lec_add(code, token, col, doc, admin?)` | 참가자(투표 만들기는 관리자) | 글 추가(진행·응답·출석·설문은 덮어쓰기) |
| `lec_update(code, token, admin, col, id, patch)` | 본인 또는 관리자 | 허용된 칸만 고치기 |
| `lec_vote` / `lec_like(code, token, id)` | 참가자 | 1인 1회 공감/좋아요 |
| `lec_react(code, token, {emoji: n})` | 참가자 | 반응(틱에 모아서 전송) |
| `lec_flush(code)` | 누구나 | 밀린 틱 내보내기 |
| `lec_reactions(code)` | 누구나 | 마지막 반응 묶음 `{rx, r}` |
| `lec_trash(code, admin?)` | 관리자(없으면 지워진 연수 것만) | Storage에서 지울 파일 경로 |
| `lec_set_state(code, admin, patch)` | 관리자 | 지금 단계·쪽·따라오기·타이머·공지 |
| `lec_remove`, `lec_admin_snapshot`, `lec_export`, `lec_purge`, `lec_check_admin` | 관리자 | 삭제·전체 보기·내보내기·모두 지우기·키 확인 |
| `lec_upload_ticket(code, token, name, type, size)` | 참가자 | 업로드 자리 받기 |
| `lec_init(code, adminKeyHash, setup, settings)` | 설정 토큰 | 공유 프로젝트에서 연수 등록 |

오류는 PostgREST 규칙(`PTxyz` → HTTP xyz)으로 돌아오며, `message`는 기계용 코드(`too_long`, `rate_limited` …), `hint`는 한국어 설명입니다. 관리자 키 오류(401/403)는 같은 모양의 본문을 `response.status`와 함께 **정상 반환**합니다(실패 횟수가 남도록).

## 시험

저장소 루트에서 `node --test skills/lecpage/engine/test/live-supabase.test.mjs` — 로컬 PostgreSQL(서버 바이너리 필요)에 Supabase 역할·`realtime.send`·storage 표를 흉내 내어 스키마 전체를 검사합니다.
