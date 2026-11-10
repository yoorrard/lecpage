# 교재 해석 결과(Material JSON) 형식

교재 파일(PPTX·PDF·HWPX·DOCX·TXT·MD)이나 링크를 읽은 결과입니다. 이 JSON에서 **설계도 초안**(`materialToDraft`)과 **AI용 교재 요약 글**(`materialToAIContext`)을 만듭니다.
JS 엔진(`engine/src/ingest`, 브라우저·Node 공통)과 파이썬 보조 스크립트(`scripts/ingest.py`)가 **같은 모양**을 만듭니다. 다른 점은 하나뿐입니다: 파이썬은 `detected`를 비워 두고(`null`), Node CLI가 JS 감지 규칙으로 채웁니다.

## 1. 만들기

보통은 `lecpage.mjs make 교재…`가 해석부터 빌드까지 한 번에 하고 `work/material.json`을 남깁니다. 이 JSON은 크므로(교재 13쪽에 4만 자 안팎) 통째로 읽지 말고 `lecpage.mjs brief work/material.json`으로 요약을 봅니다(1천 자 안팎: 쪽 수, 일시·장소·강사, 실습·프롬프트·도구와 쪽 번호, 유형, 글꼴, 빈칸).

```bash
# Node(권장): 여러 파일을 한 번에. PDF는 pdfjs-dist가 있으면 JS로, 없으면 자동으로 파이썬(PyMuPDF)으로 읽음
node $SKILL/scripts/ingest.mjs 교재.pptx 교재.pdf 안내.hwpx -o work/material.json \
     --images work/assets/media --slides work/assets/slides \
     --draft work/draft.json --context work/material.txt

# 파이썬만(파일 하나)
python3 $SKILL/scripts/ingest.py 교재.pdf -o work/material.json --images work/assets/media

# 쪽 그림만(LibreOffice + pdftoppm → slide-001.webp …)
bash $SKILL/scripts/render_slides.sh 교재.pptx work/assets/slides
```

| 옵션 | 뜻 |
|---|---|
| `--images 폴더` | 교재 속 그림을 `<그림 id>.<확장자>`로 저장하고 `images[].src`에 material.json 기준 상대 경로를 넣음 |
| `--slides 폴더` | 쪽 그림을 만들고 `pages[].image`에 경로를 넣음. PPTX와 그 PDF본을 함께 주면 PDF로 그림(원본 글꼴 그대로) |
| `--draft 파일` | AI 없이 만든 설계도 초안(blueprint v1) |
| `--context 파일` | AI 프롬프트에 넣을 교재 요약 글(쪽 번호·프롬프트 원문 유지) |
| `--max-chars 수` | 요약 글 길이 예산(기본 24000자) |
| `--today YYYY-MM-DD` | 연도 없는 날짜("11월 4일(수)")를 해석할 기준일 |

브라우저(웹앱)에서는 파일을 서버로 올리지 않고 `ingestFile(이름, File)`로 바로 읽습니다. PDF는 앱이 불러 둔 `globalThis.pdfjsLib`(jsDelivr 버전 고정)을 쓰고, 쪽 그림은 `render-pdf-browser.js`의 `renderPdfPages()`로 그립니다.

## 2. 전체 모양

```jsonc
{
  "version": 1,
  "kind": "lecpage-material",
  "generator": "lecpage-ingest-js/1",          // 파이썬은 lecpage-ingest-py/1, 섞이면 "…js/1+…py/1"
  "files": [ /* §3 파일 */ ],
  "pages": [ /* §4 쪽 */ ],
  "design": { /* §5 디자인 단서 */ },
  "meta": { "title": "", "author": "", "created": "", "modified": "" },   // 첫 파일의 문서 속성
  "boilerplate": [ { "file": "deck1", "text": "○○교육지원청 AI 연수" } ], // 절반 넘는 쪽에 반복돼 문단에서 뺀 머리글·바닥글
  "detected": { /* §6 감지 결과 (파이썬 단독 실행이면 null) */ },
  "errors":   [ { "code": "legacy-hwp", "message_ko": "예전 한글 파일(.hwp)은 …", "file": "계획.hwp" } ],
  "warnings": [ { "code": "hidden-slides", "message_ko": "숨긴 슬라이드 2장은 …", "file": "교재.pptx" } ]
}
```

## 3. 파일(`files[]`)

| 필드 | 뜻 |
|---|---|
| `id` | 파일 id. 슬라이드형(PPTX·PDF)은 `deck1`, `deck2`…, 문서형(DOCX·HWPX·TXT·MD)은 `doc1`…, 링크는 `link1`… |
| `name` | 파일 이름(NFC로 정리) |
| `type` | `pptx` · `pdf` · `docx` · `hwpx` · `txt` · `md` · `link` |
| `size` | 바이트 |
| `pages`, `unit` | 쪽 수와 단위: `slide`(PPTX), `page`(PDF), `section`(문서형: 제목 기준으로 나눈 부분), `link` |
| `title`, `author`, `modified` | 문서 속성(있을 때) |
| `slideSize` | `{ width, height, ratio: "16:9" }` (px, PPTX·PDF) |
| `url` | 링크로 받은 자료의 원래 주소 |
| `renderOf` / `renderSource` | 같은 교재의 PDF본을 함께 올리면 PDF에 `renderOf:"deck1"`, PPTX에 `renderSource:"deck2"`. PDF본은 **감지에서 빠지고 쪽 그림 원본으로만** 씀 |
| `path`, `rendered`, `pageImages` | CLI 전용: 원본 경로, 만든 쪽 그림 수, 문서형의 실제 쪽 그림 목록 |

## 4. 쪽(`pages[]`)

```jsonc
{
  "file": "deck1", "page": 8, "kind": "slide",          // kind: slide | page(PDF) | section(문서형) | link
  "title": "실습 1. 제미나이로 영상 요약하기",
  "titleGuessed": true,                                  // 제목 자리표시자가 없어 글자 크기·위치로 추정했을 때만
  "layout": "content",                                    // PPTX·PDF 힌트: title(표지) section(간지) content two-content comparison
                                                          //   title-only blank picture content-caption table custom
  "layoutName": "Title and Content",                     // PPTX 레이아웃 원래 이름
  "hidden": true,                                         // 숨긴 슬라이드(감지·초안에서 뺌)
  "paragraphs": [
    { "text": "유튜브 영상 주소를 복사합니다.", "level": 0, "num": 2, "block": 1, "role": "body", "size": 18 },
    { "text": "프롬프트: 이 영상을 한국어로 요약해줘", "level": 0, "block": 2, "role": "text", "gap": true }
  ],
  "notes": "영상은 3분 이내로 고르도록 안내합니다.\n…",   // 발표자 노트(PPTX). 사이트에 그대로 내보내지 않음
  "links":  [ { "url": "https://gemini.google.com/", "label": "제미나이 바로가기", "from": "text" } ],
  "images": [ { "id": "deck1-p8-1", "name": "image2.png", "path": "ppt/media/image2.png", "mime": "image/png",
                "width": 422, "height": 264, "share": 0.13, "alt": "제미나이 화면", "src": "assets/media/deck1-p8-1.png" } ],
  "tables": [ { "rows": [ ["도구", "잘하는 일"], ["Gemini", "검색·요약"] ] } ],
  "image": "assets/slides/slide-008.webp"               // --slides로 만든 쪽 그림(있을 때)
}
```

문단(`paragraphs[]`) 필드

| 필드 | 뜻 |
|---|---|
| `text` | 글(NFC, 보이지 않는 글자 제거, 공백 접기). 한 문단 안 줄바꿈은 `\n`으로 유지 |
| `level` | 글머리 수준 0~8(들여쓰기) |
| `bullet` | 글머리표 문단이면 `true` |
| `num` | 자동 번호 목록이면 번호(1, 2, 3…). 글 안에 "1." 이 없는 번호도 여기로 잡힘 |
| `block` | 같은 글상자(도형)·같은 묶음이면 같은 수. 여러 줄 프롬프트를 묶는 데 씀 |
| `role` | `subtitle`(부제 자리) · `body`(본문 자리) · `text`(글상자) · `heading`(문서 안 소제목) · `code`(마크다운 코드 블록) · `diagram`(SmartArt) · `chart` · `quote` |
| `gap` | 앞에 빈 줄이 있었음 |
| `size` | 글자 크기(pt, 알 때만) |

그림(`images[]`): `bytes`(Uint8Array)는 `withImages` 옵션일 때만 메모리에 있고 JSON에는 쓰지 않습니다. `repeated:true`는 여러 쪽에 반복되는 로고 등, `web:false`는 EMF·WMF처럼 웹에서 바로 안 보이는 형식, `link`는 그림에 걸린 링크(영상 등)입니다.

## 5. 디자인 단서(`design`)

```jsonc
{
  "theme": "Office Theme",
  "colors": { "dk1": "#000000", "lt1": "#FFFFFF", "accent1": "#4F81BD", "…": "accent2~6, dk2, lt2, hlink, folHlink" },
  "fonts": { "major": { "latin": "Calibri", "ea": "맑은 고딕" }, "minor": { "latin": "Calibri", "ea": "맑은 고딕" } },
  "fontsUsed": [ { "name": "맑은 고딕", "count": 2244 } ],   // 실제 글자 수 기준(한글 글꼴 감각을 잡는 데 유용)
  "palette": [ { "color": "#FF6A4D", "count": 120 } ],       // 글자에 직접 쓴 색(검정·흰색 제외)
  "background": "#101827", "dark": true,                    // 마스터 배경색(있을 때)
  "slideSize": { "width": 1280, "height": 720, "ratio": "16:9" }
}
```
HWPX는 `fonts`에 한글 기본 글꼴(예: 함초롬바탕)과 `fontsUsed`를, PDF는 `slideSize`만 채웁니다.

## 6. 감지 결과(`detected`)

모두 **추정**입니다. 초안·AI가 쓰기 전에 사람이 확인할 수 있게 쪽 번호(`file`·`page`, 여러 파일이면 `refs`)를 함께 둡니다.

| 키 | 모양 | 찾는 방법(요약) |
|---|---|---|
| `title`, `subtitle` | 문자열 | 첫 쪽 제목·부제 → 문서 속성 → 파일 이름 |
| `event` | `{date:"2026-11-04", dateText, weekday:"수", start:"15:10", end:"16:40", venue, organizer, mode:"offline|online|hybrid", joinUrl, dates?[], file, page}` | "2026. 11. 4.(수)", "2026년 11월 4일", "11월 4일(수)"(요일로 연도 추정), "15:10~16:40", "오후 3시 10분 ~ 4시 40분", "장소:", "주최·주관:", 온라인 낱말·줌/미트 링크 |
| `instructor` | `{name, role, org, bio[], email, links[], photo(그림 id), file, page}` 또는 `null` | "강사 소개·프로필·약력" 제목, "현)·전)" 줄, 이메일, 사진 |
| `agenda` | `{file, page, title, items:[{text, part?, no?, start?, end?}]}` 또는 `null` | "목차·차례·오늘의 흐름·진행 순서·시간표" 쪽의 목록 |
| `sections` | `[{no, label:"PART 1", title, desc, file, page, pages[], start?, end?}]` | "Part/PART n", "1부", "제1장", "첫째 마당", 로마 숫자, 간지·표지 레이아웃, 차례 항목과 같은 제목 |
| `prompts` | `[{title, text, file, page, pages[], refs[], cue, score}]` | `cue`: `label`("프롬프트:" 이름표) · `template`(역할:/목표:/형식:·[자리] 틀) · `quote`(“…”라고 입력) · `request`(~해줘·~만들어줘·~정리해줘…, 해요체는 AI에게 하는 말일 때만) · `english` · `code` · `block` · `notes`. **원문 그대로**(앞의 번호·STEP·"질문하기:"만 뗌) |
| `steps` | `[{title, items[], file, page, kind}]` | `kind`: `numbered`(1. 1) (1) ①… STEP 1, 1단계, 첫째, 자동 번호) · `imperative`(실습 쪽의 "~하기·클릭·접속" 목록) · `table`(단계 표). 아래 수준 줄은 앞 단계에 `\n`으로 붙음 |
| `links` | `[{url, label, kind, toolId?, file, pages[], refs[], from}]` | 하이퍼링크 + 글 속 주소(gemini.google.com처럼 https 없는 주소 포함). `kind`: video · form · meeting · doc · tool · web |
| `tools` | `[{id, name, url, category, categoryLabel, icon, accountNeeded, account, minors, korean, count, file, pages[], refs[]}]` | `tools-db.js`(100개 넘게) 별칭·도메인 일치. 한국어는 조사 경계로 판단("제미나이로"는 잡고 "감마선"·"플립러닝"은 안 잡음). 강사 소개 쪽은 세지 않음 |
| `quiz` | `[{q, options[], answer(0부터, 모르면 -1), explain, file, page}]` | 물음 줄 + ①②③④·1) 2)·A. B.·O/X 선택지, 노트·본문의 "정답:"·"해설:" |
| `faq` | `[{q, a, file, page}]` | "Q." / "A." 쌍 |
| `glossary` | `[{term, desc, file, page}]` | "용어: 설명", "할루시네이션(Hallucination)은 …현상", 용어 표 |
| `messages` | `[{text, file, page, score, closing?}]` | 글이 적은 강조 쪽, "핵심·기억하세요", 따옴표 문장, 마무리 쪽 |
| `practice` | `{pages:[{file,page}], count, ratio}` | 실습 낱말·단계·프롬프트·링크·동작 낱말 점수 3점 이상인 쪽. 비율 = 실습 쪽 ÷ 내용 쪽(표지·차례·강사·간지·마무리 제외) |
| `archetype` | `{primary:"story|lab|live|course", mix[], format, reason_ko, sessions}` | 차시 3개 이상 → course, 행사+여러 연사 → live, 실습 비율 45% 이상(또는 실습 4쪽+30%) → lab, 그 밖 → story |
| `stats` | `{pages, hidden, chars, images, tables, notes}` | |

## 7. 오류 코드(`errors[].code`)

예외를 던지지 않고 이 목록으로 돌려줍니다. 화면에는 `message_ko`를 그대로 보여 주면 됩니다(개발용 `detail`은 보여 주지 않음).

| code | 상황 |
|---|---|
| `empty` · `too-large` · `not-found` | 빈 파일 · 100MB 초과(바꿀 수 있음) · 경로 없음(CLI) |
| `legacy-hwp` · `legacy-ppt` · `legacy-doc` · `legacy-office` | 예전 형식 → HWPX·PPTX·DOCX·PDF로 다시 저장 안내 |
| `encrypted` · `pdf-encrypted` · `drm` | 암호·문서 보안(DRM, 학교 문서보안 프로그램) |
| `corrupt` · `parse-failed` · `zip-bomb` | 손상 · 해석 실패 · 압축을 풀면 지나치게 큰 파일(선언 크기 합계 600MB·파일 하나 200MB·항목 2만 개 상한) |
| `unsupported` · `keynote` · `odf` · `spreadsheet` | 지원하지 않는 형식(안내 포함) |
| `needs-pdfjs` | pdf.js가 없음. Node에서는 `fallback:"python"`이 붙고 CLI가 자동으로 `ingest.py`를 씀 |
| `pdf-failed` · `bad-url` | PDF 해석 실패 · 잘못된 주소 |

경고(`warnings[].code`): `no-text`(스캔 PDF), `no-content`, `hidden-slides`, `too-many-pages`(1000쪽 넘으면 앞부분만), `images-unsupported`(EMF·WMF), `link-only`·`link-fetch-failed`(링크만 받음), `python-fallback`, `render-failed`.

## 8. 쓸 때 지킬 것

- **프롬프트·실습 단계는 원문 그대로** 설계도에 옮깁니다. 감지가 잘못 잡은 것만 빼고, 고쳐 쓰지 않습니다.
- `notes`(발표자 노트)와 강사 `email`은 개인적인 내용일 수 있어 초안이 사이트에 그대로 싣지 않습니다(이메일 `showEmail:false`).
- 감지값(`event`·`instructor`·`archetype`)은 인터뷰에서 확인할 **후보**입니다. 확신이 없으면 묻습니다.
- 글이 거의 없는 PDF(`no-text`)는 쪽 그림만 쓰고 내용은 사용자에게 받습니다.
