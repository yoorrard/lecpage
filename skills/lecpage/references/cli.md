# CLI 자세히

`L="node <skill 폴더>/scripts/lecpage.mjs"`. 모든 명령은 짧은 요약을 내고, `--json`을 붙이면 같은 내용을 JSON으로 냅니다. 실패하면 종료 코드 1.

## 목차
1. 작업 폴더
2. 명령
3. 패치 형식
4. 강사에게 직접 받는 값(info.json)
5. 문제가 생기면

## 1. 작업 폴더
`make 교재.pptx -o dist`를 실행한 폴더 기준:

| 경로 | 내용 | 올리나 |
|---|---|---|
| `dist/` | 참가자 사이트(index·강사 화면·발표 화면·접속 확인·자료) | 올림 |
| `dist-강사용/` | 운영안내.md · DESIGN.md · 설계도 사본, `publish` 뒤 `관리자-키.txt`(본인만 읽기)·`QR-안내문.pdf`·`강사-카드.pdf`·`발표화면.png` | **안 올림** |
| `work/material.json` | 교재 해석 결과(형식: `material-format.md`) | 안 올림 |
| `work/draft.json` | AI 없이 만든 설계도 초안 | 안 올림 |
| `work/blueprint.json` | 지금 설계도. `patch`가 고치는 파일 | 안 올림 |
| `work/blueprint.prev.json` | 직전 판(`patch --undo`) | 안 올림 |
| `work/assets/` | 쪽 그림(`slides/`)·교재 속 그림(`media/`) | 빌드가 `dist/assets/`로 복사 |
| `work/lecpage.state.json` | 마지막 빌드 위치(work 기준 상대 경로)·교재 해석 캐시 키·마지막으로 올린 곳(`deploy`: 이름·주소, 비밀 값 없음) | 안 올림 |
| `work/live-relay/` | `publish --live`가 `backends/cloudflare`를 복사해 이 연수 코드만 받게 한 중계(이름 `<사이트>-live`) | 강사 Cloudflare에 올림 |
| `qa/` | 점검 스크린샷 4장과 report.json | 안 올림 |

`--work 폴더`로 작업 폴더를 바꿀 수 있습니다.

## 2. 명령

| 명령 | 하는 일 | 출력 |
|---|---|---|
| `make <교재...> [-i info.json] [-o dist] [--preset id] [--password 암호] [--fresh] [--no-qa] [--no-slides]` | 해석 → 초안 → 검증 → 빌드 → 점검. 교재가 그대로면 해석을 재사용(쪽 그림이 가장 느림, 다시 읽기는 `--reingest`). 이미 있는 `blueprint.json`은 지키고, `--fresh`일 때만 새 초안으로 바꿈. `info.json`의 인터뷰 답(분위기·움직임·강조색·참여 기능·대상)을 설계도에 넣음 | 15줄 안팎: 교재 요약, 칸 목록, 빈칸, **교재 반영**(프롬프트·실습 단계·링크·질문답·교재 줄이 보이는 칸에 실렸는지, 빠진 것 3개까지. 교재 보기는 빼고 셈), 빌드, 점검 |
| `brief [work\|blueprint.json\|material.json]` | 큰 JSON 대신 읽는 요약. 칸 id·항목 수, 구성(흐름·권하는 기능), 실습별 단계·프롬프트 수와 쪽, 빈칸, **싣지 못한 것 n개**, 주의, 글꼴. 교재 요약에는 찾은 것과 교재에서 찾은 주소(강사 확인 뒤 `info.json`) | 10줄 안팎(수백 토큰) |
| `structure [work\|blueprint.json] [-i info.json] [--add-leftovers]` | 구성 정하기: 흐름·이유·칸 순서·권하는 기능·싣지 못한 것. `--add-leftovers`는 그것을 교재 순서 자리에 글 칸으로 넣는 `work/leftovers.patch.json`을 씀 → `patch`로 반영 | 6줄 안팎 |
| `patch <blueprint.json> [patch.json\|'{…}'] [--set 경로=값]… [-i info.json] [--undo] [--no-build] [--qa]` | 패치 적용 → 검증 → 저장(직전 판 보관) → 마지막 빌드 위치에 다시 빌드 | 바뀐 점 한 줄씩 + 교재 반영 한 줄 |
| `options <blueprint.json> [--presets a,b,c] [--mood calm,bold] [-o 폴더]` | `--mood`: 강사가 말한 느낌(calm·warm·bold·minimal·playful·formal·tech·editorial·energetic…)으로 순위. 추천 3안(또는 고른 안)을 따로 빌드하고 PC 첫 화면·PC 본문·휴대폰을 한 장(`work/options/contact-sheet.png`)에 모음 | 안마다 한 줄 |
| `doctor` | Node·Playwright·LibreOffice·pdftoppm·PDF 읽기·한글 글꼴 확인과 설치 명령 | 도구마다 한 줄 |
| `review <dist> [--port 4180] [--out 폴더]` | 사이트를 127.0.0.1에 띄우고 '수정 요청' 단추를 붙임. 강사가 펜·네모·화살표·글자로 표시하고 글을 쓰면 `work/feedback/NNN.png`·`NNN.json`(글·칸 id·시각)으로 저장 | 주소 한 줄 |
| `qa <dist> [--password 암호]` | 내부 http로 열어 휴대폰·PC × 밝게·어둡게: 스크립트 오류, 가로 넘침, 대체 텍스트, h1, 이름 없는 버튼, 깨진 자료 경로. 디자인 검사(`scripts/design-lint.mjs`, error면 실패)·겹침 검사(`overlap-lint.mjs`, error면 실패)·움직임 검사(`motion-check.mjs`, PC 화면 한 번: 첫 화면 그림이 실제로 도는지·등장이 숨은 채 남지 않는지, 알림만)·문구 검사(`copy-lint.mjs`, 알림만)가 있으면 함께. 암호 사이트는 `--password`로 풀어서 점검 | 문제만 줄마다 |
| `build <bp> -o dist [--assets work/assets] [-i info.json] [--password 암호] [--bundle-fonts]` | 빌드만 | 한 줄 |
| `validate <bp>` | 검증만(주의 8개까지, 나머지는 `--json`) | 몇 줄 |
| `design <bp>` · `decide-infra -i info.json` | 프리셋 순위·효과 / 호스팅 × 실시간 백엔드 추천 | 몇 줄 |
| `app [work] [-o 연수.lecpage]` | 앱으로 넘기기: 설계도·연수 정보·교재 해석·쪽 그림(앱과 같은 이름 `slide-<쪽>.webp`)·교재 그림·교재 원본을 앱이 [저장한 파일 열기]로 여는 파일 하나로. 참여 기능 연결·관리자 키·사이트 암호·온라인 접속 주소·내 컴퓨터 경로는 담지 않음(앱에서 다시 정함). 앱은 `https://yoorrard.github.io/lecpage/` | 5줄 안팎 |
| `app 연수.lecpage [-o work] [--force]` | 반대로: 앱에서 [파일로 저장]한 연수를 작업 폴더(설계도·`info.json`·교재 해석·`assets/`·교재 원본 `src/`)로 풀고 옆 `dist/`에 빌드. 이미 있는 설계도는 `--force` 없이 덮지 않음. 접속 주소·참여 기능 키는 강사에게 다시 받음 | 4줄 |
| `publish [work] [--host cloudflare] [--live] [--features qa,poll] [--name 이름] [--dry-run] [--temporary] [--no-handouts] [--no-qa]` | 강사 Cloudflare 계정에 올리기. `--live`: 중계 올리기 → 관리자 키를 만들어 중계 비밀로 넣고 `dist-강사용/관리자-키.txt`에만(화면에 안 찍음, 이미 있으면 그대로) → `info.json` `live`에 중계 주소·연수 코드 → `patch -i`로 다시 빌드·점검 → 빈 임시 폴더에서 사이트 올리기 → 중계가 이 사이트만 받게(`ALLOWED_ORIGINS`, 연수 코드는 `ALLOWED_CODES`) → 사이트·`check.html`·중계 `/api/health` 확인 → `handouts`. 인증은 `wrangler login`이나 `CLOUDFLARE_API_TOKEN`(+`CLOUDFLARE_ACCOUNT_ID`) 환경 변수만. `--dry-run`은 순서와 강사가 할 일만 보여 주고 아무것도 바꾸지 않음. 다시 올릴 때 같은 명령(이름·키 그대로). 다른 곳은 한 줄 명령을 알려 주고 멈춤 | 10줄 안팎 |
| `handouts <올린 주소\|dist> [-o 폴더] [--password 암호]` | `poster.html`·`screen.html`을 열어 `QR-안내문.pdf`(참가자용 A4 한 장)·`강사-카드.pdf`·`발표화면.png`·`발표화면-QR-크게.png`. 폴더를 주면 로컬 주소라 QR이 다른 기기에서 안 열린다고 알림. Playwright가 없으면 건너뜀 | 3줄 |
| `serve dist [--port 4173] [--host 0.0.0.0]` · `pack dist -o site.zip` | 미리보기 서버 / ZIP | 한 줄 |
| `draft` · `prompt` · `presets` · `effects` | 초안만, AI 프롬프트 파일, 목록 | |
| `guard <AI 답.json\|txt> <material.json> [-i info.json] [-o blueprint.json]` | 교재 지킴이: 다른 AI가 짠 설계도(챗봇 답 글도 됨)를 교재 초안과 견줘 프롬프트 원문·실습 단계·일정·FAQ·목표·교재 주소를 교재대로 되돌리고, 교재에 없는 주소는 뺌 | 되돌린 곳 한 줄씩 |

교재 해석만 따로 할 때: `node <skill>/scripts/ingest.mjs 교재.pptx -o work/material.json --images work/assets/media --slides work/assets/slides`.

## 3. 패치 형식
설계도를 통째로 다시 쓰지 않습니다. 바뀐 곳만 보냅니다. 앱의 검토 대화도 같은 형식을 씁니다(엔진 `applyBlueprintPatch`).

```json
{
  "meta":   { "venue": "본관 3층 시청각실" },
  "design": { "preset": "paper-workbook", "accent": "#12306b" },
  "sections": {
    "stations": { "title": "실습 다섯 가지" },
    "quiz": null
  },
  "add":   [ { "after": "deck", "section": { "type": "faq", "items": [ { "q": "…", "a": "…" } ] } } ],
  "order": [ "hero", "schedule", "stations" ],
  "note":  "장소 바꾸고 퀴즈 뺌"
}
```
- `meta`·`design`·`audience`·`archetype`·`privacy`·`live`: 부분 병합. 객체는 깊게, 배열은 통째로 바꿈, `null`은 그 값을 지움.
- `sections`: 칸 id(`brief`의 칸 목록)로 찾아 얕게 병합. 배열(`items` 등)은 통째로 바꿈. `null`이면 칸 삭제. 숨기기는 `{"hidden": true}`.
- `add`: `after`가 없거나 `null`이면 맨 끝. `order`: 적은 칸을 앞에 그 순서로, 나머지는 원래 순서로 뒤에.
- 모르는 id·종류는 경고만 하고 건너뜀. 결과는 항상 검증을 거침.

**`--set` 한 줄 고치기**(배열 안 한 항목도 됨, 번호는 0부터):
```bash
$L patch work/blueprint.json --set meta.venue="본관 3층" --set sections.stations.items.1.title="활동지 만들기" --set sections.quiz.hidden=true
```
값은 JSON으로 읽히면 JSON(`true`, `3`, `null`, `["a"]`), 아니면 글자 그대로. 패치 파일 없이 `'{"meta":{…}}'`처럼 바로 줘도 됩니다.

## 4. 강사에게 직접 받는 값(info.json)
패치는 AI 출력에서 오므로 아래 값은 **패치로 바꿀 수 없습니다**(경고와 함께 빠짐): `meta.siteUrl`·`joinUrl`·`shortUrl`, `live.url`·`code`·`anonKey`, `access`.
강사가 직접 알려 준 값만 `info.json`에 적고 `make -i info.json` 또는 `patch <bp> -i info.json`으로 넣습니다.

```json
{ "access": "link", "siteUrl": "https://…", "joinUrl": "https://…",
  "live": { "provider": "sheets", "url": "https://script.google.com/…", "anonKey": "", "features": ["qa", "help", "progress"] } }
```
암호는 파일에 쓰지 않습니다: `--password '<암호>'` 또는 `LECPAGE_PASSWORD`. `--password`를 주면 `access`는 저절로 `password`.

글꼴 CDN이 막힌 학교망: `make`·`build`에 `--bundle-fonts`를 붙이면 사이트에 쓰인 글자가 든 글꼴 조각만 `assets/fonts/`로 담아 쪽을 열 때 외부 요청이 0이 됩니다(woff2·쓰는 굵기만 담아 예시 한 벌 0.8~1.4MB 더해짐. 앱은 대부분의 올릴 곳에서 기본으로 담음, `make`로 한 번 켜면 `patch`로 다시 만들 때도 이어짐). 글꼴을 못 받으면 CDN 주소 그대로 두고 알려 줌. 프록시를 거치는 곳은 `NODE_USE_ENV_PROXY=1`.

## 5. 문제가 생기면
| 증상 | 할 일 |
|---|---|
| 점검이 "화면 검사 건너뜀" | `doctor`의 Playwright 설치 명령. 빌드 결과는 그대로 쓸 수 있음 |
| 쪽 그림이 없음(`render-failed`) | 교재를 PDF로 저장해 함께 넣기(`make 교재.pptx 교재.pdf`), 또는 `doctor`의 LibreOffice·pdftoppm 설치 |
| PDF 글이 비어 있음(`no-text`) | 스캔본. 쪽 그림만 쓰고 내용은 강사에게 받기 |
| `깨진 자료 N` | 설계도의 `src`가 `work/assets/`에 없는 그림을 가리킴. 경로를 고치거나 칸을 숨김 |
| 엔진을 고친 뒤 해석이 예전 그대로 | `make … --reingest` |
| 패치를 잘못 적용 | `patch work/blueprint.json --undo` |
