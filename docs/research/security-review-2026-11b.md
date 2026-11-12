# 2026-11 보안 검토(2차)

- 날짜: 2026-11-12. 범위: `git diff b005bb6..88bb19f`(main). AI 연결 개편, 짧은 주소, QR·안내문·발표 화면, 올릴 곳 연결, 도움말·체험, 교재 읽기 보강, 구성 정하기, 본문 칸(마크다운), AI 프롬프트·병합, 교재에서 찾은 주소 확인, 문구·동작 검사 도구, 디자인 효과.
- 방법: 코드 읽기 + 실제로 돌려 봄. 모든 글 칸에 XSS 입력을 넣은 설계도로 프리셋 27종 × 6쪽을 만들어 크롬(Playwright, 바깥 네트워크 차단)으로 http·file 두 방식으로 열고 스크립트 실행·이벤트 속성·`javascript:`/`data:` 주소를 찾음. 정규식은 긴 입력으로 시간을 잼(파일 안 정규식 전부 + 교재 읽기 끝에서 끝까지).
- 상태 표기는 [2026-11-review.md](2026-11-review.md) §5와 같음: **처리함**(커밋) · **보고만**(다른 작업자 파일, 고칠 방법 적음) · **참고**.
- 회귀 시험: `skills/lecpage/engine/test/security-review.test.mjs`(5건).

## 1. 발견 목록

| ID | 심각도 | 발견 | 상태 |
|---|---|---|---|
| M1 | 중간 | 글 칸(`text.md`)·FAQ 답의 소제목 줄에 빈칸이 길게 이어지면 빌드가 길이의 세제곱으로 느려짐. AI 답·가져온 설계도 하나로 앱 탭·CLI가 몇 분씩 멈춤 | **처리함** 6f58658 (검증에서 막음). 근본 정규식은 **보고만**(md-syntax.js) |
| M2 | 중간 | AI 답이 개인정보 설정(받을 정보·보관 기간·동의·처리자 목록)을 그대로 넘겨줌. 교재 속 지시로 동의 상자 생략, 가짜 처리자 목록(→ 바로 공개 때 운영자 서버가 처리자로 안 적힘) 가능 | **처리함** f65ee49 |
| L1 | 낮음 | 교재에서 찾은 회의·설문 주소(강사 확인 대기)가 초안의 글 칸·표 칸에서 눌러 가는 링크로 실림(회의 암호 `pwd=` 포함) | **처리함** f01f3bc (초안). AI 답 경로는 **보고만**(L5) |
| L2 | 낮음 | 사이트 주소 없이 짧은 주소만 있고 파일로 열면(USB·ZIP·CLI 안내문) QR·[주소 복사]가 짧은 주소로 감. 암호 보호면 `#k=암호`가 붙어 중간 화면이 있는 단축 서비스의 스크립트가 읽을 수 있음 | **처리함** ea236ab |
| L3 | 낮음 | 교재 읽기: 띄어쓰기 없는 긴 낱말에서 주최 줄·이메일 정규식이 길이의 제곱으로 느려짐(6만 자 한 문단에 15초~1분) | **처리함** 7b93577 (이번 범위 밖, 예전 코드) |
| L4 | 낮음 | 글 칸 렌더러의 자리 표시(`\u0000n\u0000`)가 코드(`` `…` ``)와 이어진 주소에서 풀리지 않아 페이지에 NUL 글자가 남고 코드 글자가 사라짐 | **처리함**(조율자): 주소 글자 묶음에서 자리 표시 글자를 뺌 |
| L5 | 낮음 | AI 답 경로에는 '교재에서 찾은 회의·설문 주소'를 막는 장치가 프롬프트 규칙(11번)뿐. AI가 `hero.ctas`·링크·글 칸에 그 주소를 넣으면 그대로 실림 | **처리함**(조율자): `applyInfo`가 확인 전 주소를 단추·링크에서 빼고, 섹션 주소는 비우고, 글 칸·FAQ 답·표 칸에서는 글자로만 |
| L6 | 낮음 | is.gd 자동 이름(자음·모음 번갈아 7자, 약 480만 가지)은 차례로 넣어 볼 수 있어, '주소를 받은 사람만'(link) 사이트 주소가 짧은 주소로 드러날 수 있음 | **처리함**(조율자): '주소를 받은 사람만'일 때 짧은 주소 아래 안내 한 줄 |
| I1 | 참고 | `checkShortUrl`이 보이지 않는 글자·방향 바꿈 글자(`%E2%80%AE` 등)를 받음. 강사가 넣은 값의 표시만 흐려짐 | **처리함**(조율자): 보이지 않는 글자·방향 바꿈 글자가 있으면 거절 |
| I2 | 참고 | AI 답이 `concept.source: "teacher"`를 적으면 다음에 다시 만들 때 '선생님이 고친 컨셉'으로 지켜짐(디자인 쏠림만) | **처리함**(조율자): 강사 값(prev)이 아니면 `ai`로 |
| I3 | 참고 | (호스팅, 범위 밖 fa1aa4c) 무료 요금제의 하루 요청 예산은 누구나 요청 6만 건으로 그날 새 사이트·새 방을 멈출 수 있음. 올라온 사이트는 열림. 방문으로 공개 기간이 1년까지 늘어남 | 참고(설계상 대가) |

## 2. 처리한 것

### M1 글 칸 소제목 줄의 긴 빈칸(중간) — 6f58658
- 위치: `skills/lecpage/engine/src/md-syntax.js:14` `HEADING = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/` — `(.+?)` 뒤의 `\s*#*\s*$`가 빈칸 묶음마다 다시 시도해 줄 길이의 세제곱.
- 재현: `{ "type": "text", "md": "# a" + " ".repeat(2000) + "x" }` → `build()` 3.9초, 6000자(글 칸 한도)면 약 1~2분. NBSP(`U+00A0`)·전각 빈칸(`U+3000`)도 같음. FAQ 답(1200자)·글 칸이 여럿이면 더해짐. 미리보기는 고칠 때마다 다시 그려 탭이 멈춤.
- 입력 경로: AI 답(교재 속 지시로 유도 가능), 가져온 `.lecpage`, 리뷰 패치, CLI 설계도. 교재 글은 `normText`가 빈칸을 줄여 해당 없음.
- 고침: `validate.js`에 `mdStr()` — `text.md`·`faq.a`의 소제목 줄(`#`로 시작) 안 빈칸 묶음만 한 칸으로. 보이는 글자는 같음(HTML은 빈칸을 하나로 보임). 6000자 줄 40ms.
- 남은 일 → **처리함**(조율자, 정규식 바꾸고 회귀 시험): `md-syntax.js:14`를 `^\s{0,3}(#{1,6})[^\S\n]+(.*)$`로 잡고, 끝의 `#`·빈칸은 반복문으로 떼기(`trimEnd` → 끝 `#` 반복 제거 → `trimEnd`). 렌더러가 검증을 거치지 않은 글을 받는 길이 생겨도 안전해짐.

### M2 개인정보 설정(중간) — f65ee49
- 위치: `skills/lecpage/engine/src/intake.js` `applyInfo` — `bp.privacy`를 AI 답에서 그대로 받음. `applyFeatures`는 `collect`가 있으면 "강사가 고른 값"으로 지킴.
- 재현: AI 답에 `"privacy": { "collect": ["nickname","name","school"], "retentionDays": 365, "consent": false, "processors": [{ "name": "가짜" }] }` → 참여 창이 동의 상자 없이 이름·소속을 받고, `privacy.html`에 가짜 처리자·365일. 처리자 목록이 비어 있지 않아 바로 공개 때 `Share.jsx`가 운영자 서버를 처리자로 넣지 않음. 앱의 '받을 정보' 단추로는 동의·처리자가 보이지 않음.
- 고침: `applyInfo`는 이전 설계도(강사 값)나 기본값(별명만·30일·동의·처리자 없음)만 씀(출석을 켜면 이름·소속은 그대로 `applyFeatures`가). `sanitizeImported`는 앱에서 보이는 받을 정보·보관 기간만 받고 동의·처리자·문의처는 버림. 리뷰 패치는 이미 `privacy`를 버림.

### L1 교재에서 찾은 회의·설문 주소(낮음) — f01f3bc
- 위치: `skills/lecpage/engine/src/ingest/compose.js` `unitToMd` — 주석은 "skip 주소는 글자만 둠"인데, 새 글 칸 렌더러(`render/markdown.js:22`)가 글 속 `https://` 주소를 링크로 바꿈. 표 칸도 같음.
- 재현: DOCX 문단 `줌 입장: https://zoom.us/j/9876543210?pwd=abc` → `detected.addresses.join`에 후보로 잡히고 `meta.joinUrl`은 비지만, 초안 사이트 글 칸에 `<a href="https://zoom.us/j/…?pwd=abc">`.
- 고침: `keepUrlText()` — 글 칸 마크다운·표 칸에서 그 주소로 시작하는 덩어리를 `` `…` ``(코드)로 감싸 글자로만 남김. 1단계에서 강사가 [입장 단추로 싣기]·[설문으로 싣기]를 누르면 실리는 흐름은 그대로. 그 밖의 교재 주소는 지금처럼 링크.

### L2 짧은 주소가 QR·복사로(낮음) — ea236ab
- 위치: `runtime/lecpage.js` `pageUrl`·`joinUrl`, `runtime/screen.js` `joinUrl`, `runtime/console.js` 참여 QR — 파일로 열고(`file:`) `meta.siteUrl`이 없으면 `DATA.shortUrl`을 QR·복사에 씀.
- 재현: CLI `info.json`에 `shortUrl`만 넣고(사이트 주소 없이) 암호 보호로 빌드 → `poster.html`을 파일로 열면 QR이 `https://is.gd/…#k=암호`. bit.ly 무료처럼 중간 화면을 보여 주는 단축 서비스는 그 화면의 스크립트가 `location.hash`(암호)를 읽음. 단축 서비스가 멈추면 QR도 안 열림. 규칙(QR·복사는 늘 원래 주소) 위반.
- 고침: 원래 주소(`siteUrl()`)와 보여 줄 주소(`pageUrl()`)를 나눔. 원래 주소를 모르면 짧은 주소는 글자로만 보이고 QR 자리에 "인터넷에 올리면 QR이 나와요."

### L3 교재 읽기 정규식(낮음) — 7b93577
- 위치: `skills/lecpage/engine/src/ingest/detect.js` `ORG_LINE`(주최 줄, `[가-힣]+…[가-힣]*`)·`EMAIL`(앞 경계 없는 `[\w.+-]+@`).
- 재현: `ingestText('가'.repeat(60000))` 15초, `'a1'.repeat(50000)` 1분 넘게(메인 스레드라 탭 멈춤). 교재 파일 한도 100MB라 한 문단 수십만 자도 가능.
- 고침: 주최 줄은 80자 넘는 줄을 보지 않음, 이메일은 `(?<![\w.+-])`로 낱말 첫머리에서만 시작(찾는 결과 같음). 30여 가지 긴 낱말(영문·숫자·기호·한글) 3만 자 모두 100ms 안.

## 3. 보고만 한 것(다른 작업자 파일·설계 결정)

### L4 글 칸 자리 표시가 남음 — `skills/lecpage/engine/src/render/markdown.js:13-31`
- 재현: 글 칸 `https://ok.example/` 다음에 `` `c` ``(띄어 쓰지 않음) → 코드가 먼저 자리 표시 `\u00000\u0000`로 바뀌고, 주소 찾기(22행)가 그 글자까지 주소로 삼아 링크 글자 안에 자리 표시가 들어감. 마지막 복원(31행)은 한 번만 돌아 `\u0000`이 페이지에 남고(`index.html`이 '바이너리'로 보임) 코드 글자 `c`가 사라짐. `[j](https://ok.example/a`b`)`도 같음. XSS는 아님(주소는 `URL`을 거쳐 속성에 들어가고 자리 표시 내용은 이미 이스케이프됨).
- 고칠 방법: 22행·17행의 주소 글자 묶음에서 `\u0000`을 뺌(`[^\s<>"'）)\u0000]`, `[^)\s\u0000]`). 또는 복원을 자리 표시가 없을 때까지 되풀이.

### L5 AI 답 경로의 회의·설문 주소 — `skills/lecpage/engine/src/intake.js` `applyInfo`, `src/prompt/bridge.js:107`
- 재현: AI 답 `hero.ctas: [{ "label": "입장", "href": "<교재의 zoom 주소>" }]` → 강사 확인 없이 첫 화면 단추로 실림(프롬프트 규칙만 있음). 초안 글 칸을 '그대로 살리라'는 지시 때문에 AI 답의 글 칸에도 주소가 남음(이 경우 L1의 `` `…` ``가 이어지면 링크는 안 됨).
- 고칠 방법(안): `applyInfo`에서 `material.detected.addresses`의 주소 중 `info.joinUrl`·`info.surveyUrl`이 아닌 것을 `url`·`href`·`ctas`·`links`에서 빼고, 글 칸·표 칸에는 `keepUrlText`를 적용. 회의 주소가 실린 곳을 강사에게 알리는 경고도 함께.

### L6 짧은 주소 추측 — `app/src/lib/deploy.js:316` `easyName`
- 자동 이름은 `bdgjklmnprstvz`·`aeiou`를 번갈아 7자(14⁴×5³ ≈ 480만). is.gd는 공개 단축 서비스라 차례로 넣어 보면 '주소를 받은 사람만' 사이트가 드러날 수 있음. 암호(`#k=`)는 is.gd로 보내지 않음(확인함).
- 제안: 공개 범위가 '주소를 받은 사람만'일 때 짧은 주소 칸에 "짧은 주소는 누구나 짐작해 볼 수 있어요. 참가자만 봐야 하면 암호를 거세요." 한 줄(Share.jsx).

### I1 짧은 주소의 보이지 않는 글자 — `app/src/lib/deploy.js:366` `checkShortUrl`
- `https://is.gd/a%E2%80%AEgnp.exe` → 통과, 안내문·발표 화면에 `decodeURI`로 방향이 뒤집힌 글자가 보임. 강사가 넣는 값이라 영향 작음. 제안: 디코딩한 경로에 `[\u200B-\u200F\u202A-\u202E\u2066-\u2069\u00AD\uFEFF]`가 있으면 거절.

### I2 컨셉의 '선생님' 표시 — `skills/lecpage/engine/src/decide/concept.js:93`
- AI 답이 `source: "teacher"`를 적으면 그대로 남아 다음 AI 답이 컨셉을 바꾸지 못함. 제안: `applyInfo`에서 초안이 아닌 설계도의 컨셉 `source`가 `teacher`면 `ai`로(강사 값은 `prev`에서만).

## 4. 확인했지만 문제없던 것
- **XSS**: 새 본문 칸(절차·사례·나눌 질문·표·글)·마크다운(표·인용·강조 상자·링크·코드)·첫 화면 그림(파문·시간 점묘·모자이크·표지·세로쓰기·어긋난 격자)·마무리 그림, `structure.reasons`·`leftovers`(앱은 Preact 글자, 엔진은 `<>` 제거), 짧은 주소 표시(`textContent`). 크롬에서 27 프리셋 × 6쪽(http·file)에 스크립트 실행·`on*` 속성·`javascript:`/`data:` 주소 0건. `safeUrl`이 `javascript:`·`data:`·`vbscript:`를 막음. `jsonScript`는 `<`를 `<`로 바꿔 `</script>` 탈출 없음. 앱에 `dangerouslySetInnerHTML` 없음. 효과 견본(`fx/demo-boot.js`)의 `?fx=`는 `[a-z0-9-]`만.
- **신뢰 경계**: AI 답·가져온 파일은 `live.*`·`meta.siteUrl/joinUrl/shortUrl`·공개 범위를 바꾸지 못함(`applyInfo`·`keepDraftParts`·`sanitizeImported` 실제 호출로 확인). 리뷰 패치는 `live`·`access`·`concept`·`privacy`·주소를 버림. `patch.js`의 `mergeDeep`은 `__proto__` 등을 건너뜀. `keepDraftParts`는 교재 보기의 쪽 그림을 초안 것으로만 채움(AI의 `slides[].src` 무시). 권하는 기능은 강사가 눌러야 켜짐.
- **키·토큰**: 키는 탭 메모리 + '기억하기'면 AES-GCM(추출 불가 키)으로 IndexedDB. `withWorkspace`는 키별 `Map`에 이 탭에서만, 같은 키로 `api.anthropic.com`에만 물어봄. 오류문 `link`는 `https://aistudio.google.com/verify?project=숫자`만(정규식이 그 부분만 꺼냄, 없으면 고정 주소). 클립보드 읽기는 단추를 누를 때만, Ctrl+V는 사용자의 붙여넣기 이벤트. 올릴 곳 토큰은 그 회사 API로만, 오류문에 토큰이 들어가지 않음. 챗봇 열기는 고정 주소 셋.
- **짧은 주소**: `checkShortUrl`이 `@`(계정)·포트·IP(`127.0.0.1`·`0x7f.1`·`2130706433`·`[::1]`)·`localhost`·`%2F` 호스트·`javascript:`·`data:`·빈칸(전각·NBSP·탭 포함)·200자 넘는 주소를 거절. 유니코드 호스트는 퓨니코드로 보임(`xn--…`). is.gd 요청은 `#` 앞까지만, `referrerPolicy: no-referrer`, 답은 `https://is.gd/\w{3,40}`만 받음. 온라인에서는 QR·복사가 원래 주소(시험으로 확인).
- **교재 파서**: ZIP 항목 수·선언 크기·XML 크기 상한, ZIP 이름은 묶음 안에서만 찾음(파일 시스템에 쓰지 않음), DOCX 각주는 같은 묶음의 파일만, HWPX 각주 재귀는 문서 깊이만큼(XML 해석은 반복문). 새 정규식(`SIZE_LINE`·`SESSION_HEAD`·`LABEL_LINE` 등)은 `normText`가 빈칸을 줄인 뒤라 4만 자 문단 20가지(DOCX 읽기 → 초안 → 빌드)에서 단계마다 0.4초 안. `md-syntax.js`의 표·목록·인용·강조 상자·링크 문법과 `mdIssues`는 글 칸 한도(6000자)의 두 배에서도 0.3초 안(소제목만 M1).
- **CSP·외부 요청**: 생성 사이트 CSP는 바뀌지 않음, 새 효과(arc-ripple·minute-map)는 바깥 파일 없음, is.gd는 앱에서만 부름(앱 CSP `connect-src https:`는 예전 그대로). `fx/demo.html`은 사이트에 들어가지 않음.
- **호스팅**: 이번 범위의 변경 없음. 새 런타임 파일 2개는 `npm test`·배포 때 `runtime-allow.js`에 자동으로 들어감(확인). 런타임 파일이 바뀌었으니(이번 범위 + 이 검토의 lecpage·screen·console.js) 서버를 다시 배포해야 새 앱이 올릴 수 있음. 예전 앱도 받으려면 `hosting/README.md`의 순서대로 지금 배포된 판을 `runtime-history.json`에 남김.
- **의존성**: `npm audit` app·hosting 0건(엔진은 의존성 없음).

## 5. 시험
- 엔진 `npm test`: 283건 중 280 통과·3 건너뜀(브라우저 없는 환경용 기존 시험), 실패 0. 새 시험 5건(`security-review.test.mjs`)은 고치기 전 코드에서 모두 실패하는 것을 확인.
- 호스팅 `npm test`: 77 통과. 앱 `npm run build` 통과.
