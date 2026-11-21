# CLI 자세히

`L="node <skill 폴더>/scripts/lecpage.mjs"`. 모든 명령은 짧은 요약을 내고, `--json`을 붙이면 같은 내용을 JSON으로 내요. `<명령> --help`는 그 명령 도움말만 보이고 실행하지 않아요. `$L --version`은 판, 새 판 받기는 `claude plugin update lecpage@lecpage`(Claude Code 플러그인)·`npx skills update`(그 밖에는 설치한 명령을 다시).

종료 코드: **0** 성공 · **1** 실패(`check`는 고칠 곳이 있으면 1 — 조립 결과는 그대로 쓸 수 있음) · **2** 명령·옵션을 잘못 씀(모르는 옵션은 비슷한 이름을 알려 줌). 오류는 한국어 한 줄과 다음 할 일, 자세한 기록은 `LECPAGE_DEBUG=1`.

## 1. 작업 폴더
| 경로 | 누가 | 내용 | 올리나 |
|---|---|---|---|
| `work/site/` | 에이전트 | 사이트: `index.html`(필수, 다른 `.html`도 맨 위에만), `assets/style.css`·`site.js`·`img/`, `files/`(자료실) | 조립해서 올림 |
| `work/site/material/p-NNN.webp` | prepare | 교재 쪽 그림(여러 교재는 번호를 이어 매김) | 쓴 것만 의미 있음 |
| `work/lecpage.json` | 에이전트 | 연수 정보·참여 기능·색(`references/kit.md`) | 조립에 씀 |
| `work/lecpage.teacher.json` | 강사 값 | `live`·`siteUrl`·`joinUrl`·`shortUrl`·`access`·`surveyUrl`·`privacy`·`keepUntil`. 강사가 알려 준 값만. `publish --live`가 `live`를 적음 | 조립에 씀 |
| `work/material.md` | prepare | PDF가 아닌 교재(PPTX·HWP·HWPX·DOCX)에서 코드가 뽑은 쪽마다 글자·발표자 노트. 쪽 그림과 다르면 쪽 그림이 맞음(PDF는 원본을 직접 읽어 두지 않음) | 안 올림 |
| `work/README.md` | prepare | 이 작업의 경로 요약(교재 원본·쪽 범위·키트 설명서·확인 명령) | 안 올림 |
| `work/dist/` | check·preview·publish | 조립 결과(참가자 사이트 + 강사 화면·발표 화면·안내문·접속 확인·개인정보 안내·`_headers`) | **이것을 올림** |
| `work/dist-강사용/` | 조립·publish | `운영안내.md`, `publish --live` 뒤 `관리자-키.txt`(본인만 읽기), `QR-안내문.pdf`·`발표화면.png` | **안 올림** |
| `work/check/` | check | `issues.md`(고칠 곳, AI가 읽기 좋은 꼴)·`report.json`·`<쪽>-390.png`·`-1280.png` | 안 올림 |
| `work/.lecpage/` | prepare | 교재에서 뽑은 쪽 제목(`pages.json`, 고칠 때는 `lecpage.json`의 `pages`)·교재 목록(`sources.json`) | 안 올림 |
| `work/lecpage.state.json` | CLI | 마지막으로 올린 곳(이름·주소, 비밀 값 없음) | 안 올림 |
| `work/live-relay/` | publish --live | 참여 기능 중계(backends/cloudflare 사본, 이 연수 코드만 받음) | 강사 Cloudflare에 |

## 2. 명령
| 명령 | 하는 일 |
|---|---|
| `prepare <교재...> [-o work] [--no-slides]` | 교재(PDF·PPTX·HWP·HWPX·DOCX·https 주소)를 읽어 쪽 그림·빈 `lecpage.json`·`README.md`(PDF가 아닌 교재가 있으면 `material.md`도). PPTX와 같은 내용의 PDF를 함께 주면 쪽 그림이 원본 글꼴. 쪽 그림이 모자라면 `doctor`의 LibreOffice·pdftoppm. 100쪽이 넘으면 진행 줄이 stderr에 나옴(멈춘 것 아님) |
| `check [work] [--no-shots] [--port 0]` | 조립(`work/dist`) → 정적 검수(HTML 구조·빈 칸·깨진 경로·키트 표시·금지 패턴·크기·글자 대비) → 그려서 검수(390·1280px: 가로 넘침·겹침·안 보이는 글·잘린 글·깨진 그림·작은 글자·작은 단추·스크립트 오류·CSP 막힘) → 화면 그림. 고칠 곳이 있으면 종료 코드 1 |
| `preview [work] [--port 4173] [--host 0.0.0.0]` | 조립해서 띄움. 강사 화면(`console.html`)·발표 화면(`screen.html`)·QR 안내문(`poster.html`)도. 참여 기능은 연습 모드(같은 브라우저 안에서만 이어짐) |
| `app [work] [-o 연수.lecpage]` | 앱으로 넘기기(.lecpage v2): 사이트 폴더·연수 정보·쪽 그림·쪽 제목·교재 원본(100MB까지). 참여 기능 키·관리자 키는 담지 않음. 강사가 https://lecpage.com/ [저장한 파일 열기]로 열어 미리보기·고치기·배포 |
| `app 연수.lecpage [-o work] [--force]` | 반대로: 앱에서 저장한 파일을 작업 폴더로(사이트·`lecpage.json`·원본 `src/`). 파일 안의 강사 값은 `lecpage.teacher.from-file.json`에 따로 두니, 강사에게 확인받고 `lecpage.teacher.json`으로 옮김. 예전 방식(설계도)으로 만든 연수는 교재 쪽 그림·연수 정보·원본만 옮기니(`site/index.html`은 새로 써요) `prepare 원본 -o work`로 이어 가요 |
| `studio [--port 6600] [--no-open] [--dist app/dist] [--remote] [--timeout 30]` | 내 PC 연결 프로그램: 앱을 `http://127.0.0.1:<포트>/`에서 열고, 앱이 이 PC에 설치·로그인된 Claude Code·Codex로 사이트를 만들게 함(그 사람의 구독 한도). 자세히 `references/studio.md` |
| `publish [work] [--host cloudflare\|onpod] [--live] [--name 이름] [--dry-run] [--temporary] [--no-handouts] [--no-bundle-fonts] [--password 암호]` | 조립(글꼴 CDN의 글꼴을 쓰인 글자만 사이트 안에 담음, 끄기 `--no-bundle-fonts` · `--password`면 쪽·교재 쪽 그림·자료실 파일을 암호로 잠금) → 강사 계정에 올리기 → 주소 확인 → 안내물. `--dry-run`은 순서와 **강사가 할 일**만 보여 줌. `--live`(Cloudflare): 중계 올리기 → 관리자 키를 중계 비밀로 넣고 `dist-강사용/관리자-키.txt`에만 → `lecpage.teacher.json`의 `live`에 중계 주소·연수 코드 → 다시 조립 → 올리기 → 중계가 이 사이트만 받게 → 확인. 인증은 `npx wrangler@4 login`이나 `CLOUDFLARE_API_TOKEN`(Onpod은 `ONPOD_TOKEN`) 환경 변수만. 다시 올릴 때는 `publish work`만(지난번 곳·주소) |
| `handouts <배포한 주소\|work> [-o 폴더]` | `QR-안내문.pdf`(참가자용 A4)·`발표화면.png`·`발표화면-QR-크게.png`. 작업 폴더를 주면 로컬 주소라 QR이 다른 기기에서 안 열린다고 알림 |
| `pack [work\|work/dist] -o site.zip [--bundle-fonts] [--password 암호]` | 조립한 사이트를 ZIP 하나로(USB·교실 LAN). 강사용 폴더는 담지 않음. 인터넷이 막힌 교실이면 `--bundle-fonts` |
| `serve [work\|폴더] [--port 4173] [--live]` | 작업 폴더면 `preview`와 같음, 다른 폴더는 그대로 띄움. `--live`(작업 폴더, 포트 기본 8787): 노트북이 참여 기능 서버(`backends/node-server`)까지 맡아 교실 와이파이의 여러 기기가 실제로 참여(QR은 와이파이 주소, 기록·관리자 키는 `dist-강사용/live-data/`, 올리는 `dist`는 그대로) |
| `doctor` | 판·Node·Playwright·LibreOffice·pdftoppm·PDF 읽기·한글 글꼴 확인과 설치 명령(윈도우·macOS·리눅스) |
| `decide-infra [-i 답.json] [--size 30] [--features qa,poll] [--skill set] [--network good\|restricted\|offline] [--minor]` | 배포할 곳 × 참여 기능 서버 추천(강사가 할 일 수로 고름). 이미 연결한 곳은 `-i`의 JSON에 `connected:["cloudflare"]` 등(`references/infra-decision.md`) |

예전 방식(코드가 교재를 해석해 설계도로 그리던 흐름)의 명령(`make`·`build`·`patch` …)은 없어졌어요. 부르면 새 흐름을 안내하고 종료 코드 2로 멈춰요.

## 3. 강사 값(`work/lecpage.teacher.json`)
AI가 정하지 않는 칸이에요. 강사가 알려 준 값만 적고, `lecpage.json`에 써도 조립이 무시해요(남이 준 파일·교재 속 지시로 바뀌지 않게).
```json
{ "access": "link", "siteUrl": "https://…", "joinUrl": "https://zoom.us/j/…", "surveyUrl": "https://forms.gle/…",
  "live": { "provider": "sheets", "url": "https://script.google.com/…", "code": "AB12CD" },
  "privacy": { "collect": ["nickname", "name", "school"], "retentionDays": 30 }, "keepUntil": "2026-12-31" }
```
- `access`: `link`(기본, 주소를 받은 사람만·검색 제외) · `public`(검색 허용). 새 흐름은 아직 암호를 걸 수 없어요.
- `live` 없이 참여 기능을 켜면 연습 모드(`local`, 이 기기 안에서만). 서버는 `publish --live`(Cloudflare) 또는 강사가 만든 구글 시트·Supabase(`backends/*/README.md`)의 주소를 강사에게 받아 적어요.

## 4. 문제가 생기면
| 증상 | 할 일 |
|---|---|
| 쪽 그림이 없음 | 교재를 PDF로 저장해 함께 넣기(`prepare 교재.pptx 교재.pdf`), 또는 `doctor`의 LibreOffice·pdftoppm 설치 |
| PDF 글이 비어 있음 | 스캔본이에요. 쪽 그림을 보고 읽고, 원문이 필요한 글(프롬프트 등)은 강사에게 받기 |
| 구형 PPT·DOC, 암호·배포용 HWP | PDF·PPTX·HWPX로 저장해 달라고 해요 |
| `check`가 "화면 검수 건너뜀" | `doctor`의 Playwright 설치 명령. 정적 검수 결과는 그대로 |
| `CSP가 막은 것` | 인라인 스크립트·`onclick`·바깥 주소를 빼고 `assets/site.js` + `addEventListener`로(`references/kit.md`) |
| `features에 …가 있는데 자리 표시가 없어요` | 자리 표시를 넣거나 `features`에서 빼요 |
| 쪽이 많아 오래 걸림 | 명령 시간 제한을 10분으로 늘리거나 백그라운드로(진행 줄이 나옴) |
