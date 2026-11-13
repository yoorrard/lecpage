# 바로 공개 서버: 명령 한 번 설정, Pages 보기, 수용량, 학교망 (2026-11-13)

운영자 질문: "Cloudflare 연결 과정이 너무 복잡하다. 자동으로 할 방법 없나? Cloudflare가 최선인가?" 그리고 "학교 연수가 많다. 무료에서도 학교망 조건 때문에 사이트를 못 만들거나 연수 당일 접속이 막혀 강사가 당황하는 일이 없어야 한다."
구현: `hosting/scripts/setup.mjs`, `hosting/src/{pages-api,pages-site,blake3,capacity,admin-worker}.js`, Site·Gate·Room 변경. 운영 안내는 [`hosting/README.md`](../../hosting/README.md) §2·§4·§6·§7·§11·§12.

## 1. 결정

| 물음 | 결정 | 까닭 |
|---|---|---|
| 설정 | `npm run setup` 한 번(API 토큰 하나, 묻는 것은 이메일·웹훅) | 손으로 12단계 → 3~4단계. 다시 돌려도 안전, 실패하면 멈춘 단계와 다음 할 일 |
| 관리 화면 | 따로 작은 Worker `lecpage-admin` + Access(Worker 단위, 도메인 없이) | Access가 Worker 하나의 workers.dev 전체를 지킬 수 있음(공식). 도메인을 사지 않아도 됨 |
| 사이트 보기 | 기본 `VIEW=pages`(Cloudflare Pages 미리보기 배포, 사이트마다 브랜치 `s-<id>`) | 정적 요청은 Workers 하루 한도에 들지 않음 → 무료에서도 사이트가 멈추지 않음. 사이트마다 출처가 갈림 |
| 공개 기간 | `pages`는 마지막으로 올린 날부터 60일 | 방문이 Worker에 닿지 않아 '방문으로 늘리기'를 할 수 없음 |
| 영상·소리 | Pages에 올리지 않고 Worker(Durable Object)가 Range로 | Pages·Workers 정적 자산은 Range에 200을 줌. Safari 영상에 Range가 필요(공식) |
| 참여 기능 방 | Durable Object 그대로 + Pages 사이트 출처에만 CORS | 방을 옮길 까닭이 없음 |
| 학교망 | 예약형 수용량·상태 API·긴 대기·두 번째 주소 | §5 |

**Cloudflare가 최선인가**: 무료로 (1) 서버 쪽 검사(런타임 외 스크립트 금지) (2) 사이트마다 다른 주소 (3) 하루 한도와 무관한 보기 (4) 실시간 방을 한 계정에서 하는 곳을 찾지 못했다. Cloudflare 안에서도
- Workers Previews(`<이름>-<worker>.<계정>.workers.dev`)는 무료 Worker 하나에 미리보기 100개, 넘으면 오래된 것부터 **지워짐**(공식 workers/previews) → 사이트 저장소로 못 씀.
- Workers for Platforms는 유료.
- Pages: 미리보기 배포 개수 **무제한**, 사이트(배포)당 파일 20,000개·파일 25MiB, 프로젝트는 계정당 100개(하나만 씀), `_headers` 100규칙·`_redirects` 2,100개(공식 pages/platform/limits).

**위험**: wrangler 4.158에는 새 Pages 프로젝트를 Workers로 넘기는 장치('Cloudflare Pages, now part of Cloudflare Workers')가 들어 있다. Pages API는 그대로 돌지만 Cloudflare가 Workers 정적 자산 쪽으로 옮기는 중이므로 지켜볼 것. 약관(Developer Platform 서비스 약관, 2026-09-28 판)은 남의 콘텐츠를 올리는 것을 막지 않고, 최종 사용자의 콘텐츠·행위에 운영자가 책임지며 위반이 의심되면 Cloudflare가 제한할 수 있다고 적는다(Workers와 같음).

## 2. 공식 사실(developers.cloudflare.com `<경로>/index.md`, 2026-11-13)

- Workers Free 요청 10만/일(00:00 UTC), CPU 10ms, 하위 요청 50/호출. DO Free 요청 10만/일·duration 13,000 GB-s/일·행 읽기 500만·쓰기 10만/일·저장 5GB, DO 한 요청 CPU 30초, 바깥으로 보내는 본문 100MiB. Paid: Workers 1,000만/월(+$0.30/100만), DO 요청 100만/월(+$0.15/100만), duration 40만 GB-s/월.
- DO duration은 '깨어 있고 잠들 수 없는 동안'만. 잠들 수 있는 유휴 상태는 과금 없음(pricing).
- Pages 정적 요청은 무료·무제한(Functions만 Workers 요청으로 셈, pages/functions/pricing). 빌드 월 500회는 "Git에 올릴 때마다 빌드" 기준으로 적혀 있음(직접 올리기가 드는지 문서에 없음 → §6).
- Pages 직접 올리기 API는 문서에 있음: `GET …/pages/projects/{p}/upload-token`(JWT) → `POST /pages/assets/check-missing` · `upload`(`[{key, value(base64), metadata:{contentType}, base64:true}]`) · `upsert-hashes`(JWT) → `POST …/deployments`(multipart: `manifest`, `branch`, `_headers`, `_redirects`; 권한 Pages Write) → `DELETE …/deployments/{id}?force=true`("별칭이 걸린 미리보기 배포도 지움"). 열쇠 계산은 wrangler와 같게 blake3(base64 + 확장자) 앞 32자.
- 이 자산 API는 **브라우저에서 부를 수 없음**: OPTIONS·POST 응답에 `Access-Control-Allow-Origin`이 없음(직접 확인). 어차피 JWT를 브라우저에 주면 남의 파일을 바꿔치기할 수 있어 주지 않음.
- 미리보기 별칭: 브랜치 이름을 소문자·붙임표로 바꾼 `<브랜치>.<프로젝트>.pages.dev`, 미리보기 배포에는 `X-Robots-Tag: noindex`. 배포마다 고유 주소 `<해시>.<프로젝트>.pages.dev`가 남음.
- Pages 기본 머리글에 `Access-Control-Allow-Origin: *`, `_headers`에서 `! 이름`으로 뗄 수 있음, 같은 머리글은 쉼표로 이어짐. 404.html이 없으면 SPA로 보고 모든 주소에 첫 화면. `.html`은 확장자 없는 주소로 308.
- Access: Worker 단위 앱(`destinations: [{type:'worker', worker_id}]`)이 그 Worker의 workers.dev·미리보기 전체를 지킴. 웹소켓은 Worker 단위 Access에서 403(관리 Worker는 안 씀). 정적 자산이 있는 Worker에는 `ctx.access`가 오지 않음.
- Zero Trust 조직 만들기: 대시보드에서 팀 이름 → 요금제 → **결제 정보 입력(Free도 입력, 청구 없음)**(cloudflare-one/setup).
- 토큰: 사용자 토큰을 API로 만드는 권한(API Tokens Edit)은 'Create additional tokens' 템플릿에만 있음. 계정 소유 토큰은 Account API Tokens Edit로 만들 수 있음 → Worker가 쓸 'Pages Write만' 토큰을 설정 스크립트가 계정 소유로 만듦.
- wrangler OAuth(`wrangler login`) 범위에 Access가 없음 → `--login` 길에서는 Access를 대시보드로 안내.
- 무료 WAF 속도 제한: 규칙 1개, 경로 필드, IP 기준, 10초 기간·10초 막기.

## 3. 흐름(VIEW=pages)

앱 → `POST /api/sites`(예약 날짜·인원) → `POST deploys` → `PUT blobs`(Durable Object가 sha256·런타임 대조 → HTML 원본·영상·소리는 저장, 나머지는 blake3 열쇠로 Pages에 바로 올리고 열쇠만 기록) → `POST live` → `POST publish`(HTML 손보기·`robots.txt`·`404.html`·`_headers`·`_redirects` → check-missing으로 사라진 자산 확인 → 배포 → 준비 기다림 → 지난 배포 지움) → `{ url: https://s-<id>.….pages.dev/, altUrl: https://<호스트>/s/<id>/ }`.
가리기는 안내 화면 배포, 풀기는 기록해 둔 목록으로 다시 배포, 지우기·기간 끝은 배포 삭제(가장 최근 것을 못 지우면 '기간 끝' 화면만 남김).

## 4. 수용량(README §4 표의 근거)

어림식(`hosting/src/capacity.js`): 자리 = 참가자 + 2(강사·발표 화면). Worker 보기 사이트 요청 25/자리, 참여 기능 15/자리, 묻기 5/분(긴 대기 2.4/분) × 묻기로 바뀌는 몫(good 0.2·slow 0.5·restricted 1). 40명 2시간: `pages` 학교망 25,830 → 무료 하루 3~4회(예약은 70%까지라 2개), 긴 대기 반영 뒤 12,730 → 7회(예약 5개). 긴 대기는 기다리는 동안 방이 깨어 있어 duration을 씀(2시간 ≈ 900 GB-s, 무료 하루 14개 분) → 무료에서는 요청 수가 먼저 참. 5초 묻기만 쓸 때 duration은 처리하는 몇 ms씩이라 작음.
Paid에서는 DO 요청 포함분(월 100만)이 먼저 차서 학교망 연수 약 38회가 $5 안, 그 뒤 1회 약 1.2센트.

## 5. 학교망

- **예약형 수용량**: 공개할 때 앱이 날짜·시작·끝·인원·네트워크·참여 기능 여부를 보냄(`booking`). Gate가 날짜별로 쌓고, 그날 어림이 예산의 70%를 넘으면 사이트를 만들 때(그날이 아니라) `429 rate_limited` + `reason:'booked'`. 오늘 아직 끝나지 않은 예약의 남은 몫만큼 새 일을 일찍 멈춤. 관리 화면에 앞으로 7일 표.
- **상태 API** `GET /api/status?date=&site=`(1분 캐시): 오늘 쓴 몫·예약 몫, 그날 연수·참가자·어림·남은 자리, 사이트 상태·방 상태·예약.
- **묻기 비용**: 긴 대기(`snapshot?since=&wait=`, 최대 25초, 바뀌면 바로), 간격 권고 머리글 `X-Lec-Poll-Ms`(예산 50% 10초, 80% 20초). 304는 지금 런타임이 오류로 봐서 쓰지 않음. SSE는 이미 런타임이 웹소켓 다음으로 시도(연결 하나에 요청 하나지만 방이 깨어 있어 duration).
- **차단 가능성**(공개 자료, 2026-11-13 검색): 한국 교육청·학교 필터의 `*.pages.dev`·`*.workers.dev` 분류는 공개 자료를 찾지 못함. 보안 제품·통신사 보안 기능은 대개 피싱으로 신고된 하위 도메인 하나를 막고(Malwarebytes 'pages dev' 탐지 설명, 통신사 보안 기능이 pages.dev 하위 도메인을 막은 사용자 보고), `*.pages.dev` 전체를 나라 단위로 막은 사례가 있음. 두 도메인이 피싱에 많이 쓰인다는 보안 업체 보고(Cofense, BleepingComputer 'Cloudflare's developer domains increasingly abused', PhishFort)가 있어 평판·새 사이트 기준 필터에 걸릴 수 있음.
  - 대응: 사이트마다 하위 도메인(한 사이트가 막혀도 나머지는 그대로), 두 번째 주소 `/s/<id>/`(운영자 도메인을 붙이면 그 도메인), 연수 전날 그 학교망에서 열어 보기. 사이트마다 운영자 도메인 하위 도메인은 Pages 와일드카드 도메인 불가·유료 인증서 관리라 하지 않음.

## 6. 실제 계정에서 확인할 것

1. Pages 자산 열쇠(blake3)·`contentType`이 그대로 쓰이는지, Durable Object에서 자산 API·배포 API를 부르는 것(하위 요청 50개 안), JWT 수명.
2. 직접 올리기 배포가 '빌드 월 500회'에 드는지.
3. `force=true`로 가장 최근(별칭) 미리보기 배포가 지워지는지, 배포가 없는 별칭 주소가 404인지 본 배포로 가는지(본 배포는 '없는 사이트' 안내라 어느 쪽이든 괜찮게 해 둠). 지운 배포의 자산이 언제 사라지는지(가림을 풀 때 다시 배포할 수 있는 기간).
4. `_headers`: `! Access-Control-Allow-Origin`으로 기본 머리글 떼기, `/*.svg` 같은 확장자 규칙, CSP가 HTML에 붙는지. `_redirects`의 바깥 주소 302와 한글 파일 이름(퍼센트 인코딩) 주소.
5. 미리보기 주소의 `X-Robots-Tag: noindex`와 카카오톡·슬랙 미리보기 봇, pages.dev의 Browser Integrity Check가 봇을 막지 않는지.
6. Worker에서 같은 계정의 `*.pages.dev`를 가져오는 두 번째 주소(`/s/<id>/`)가 되는지.
7. Access 앱(`type: worker`)을 API로 만들 때 필요한 것, 관리 Worker에 `ctx.access`와 `Cf-Access-Jwt-Assertion`이 오는지, One-time PIN 로그인.
8. 계정 소유 토큰을 'Pages Write' 권한 묶음으로 만들 수 있는지(이름 확인), 사용자 지정 토큰에서 Account API Tokens Edit를 고를 수 있는지.
9. `PUT /workers/subdomain`, `GET /workers/workers/{이름}`의 `id`가 Access의 `worker_id`인지.
10. 무료 WAF 규칙 식에 `starts_with`를 쓸 수 있는지.
11. 아이폰 Safari에서 영상(Worker의 206)이 `_redirects`를 거쳐 열리는지.

## 7. 런타임(engine/runtime) 쪽에서 이어서 고칠 것

1. `live/http.js` 묻기: `kind === 'poll'`일 때 `snapshot?since=…&wait=20`을 붙이고 그 요청의 제한 시간을 `wait + 10초`로(지금 12초). 긴 대기를 쓰면 `emptyPolls` 배로 늘리기는 끔.
2. snapshot 응답의 `X-Lec-Poll-Ms`를 읽어 다음 간격의 아래 한도로 씀(다른 출처에서도 읽히게 서버가 `Access-Control-Expose-Headers`를 붙임).
3. 런타임이 1·2를 쓰면 서버 `POLL_LONG=on`(예약 어림이 낮아짐).
4. 강사 화면: 묻기로 바뀌었을 때 "학교망에서 실시간 연결이 막혀 천천히 묻는 중" 한 줄과 상태 API로 그날 남은 몫·방 상태(연수 전날 점검).
5. `pages` 보기에서는 서버가 강사 화면에 공지 띠를 끼울 수 없음 → 강사 화면이 `GET <호스트>/api/notice?for=teacher`를 직접 부르게(서버의 `/api/notice` CORS에 Pages 사이트 출처를 더해야 함).
