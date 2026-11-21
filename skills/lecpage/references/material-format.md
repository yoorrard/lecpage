# 교재 해석 결과(Material JSON) 형식 — 개발용

엔진(`engine/src/ingest`, 브라우저·Node 공통)과 파이썬 보조(`scripts/ingest.py`, pdf.js가 없을 때 PDF용)가 만드는 같은 모양이에요. `prepare`가 이것으로 쪽 그림(`site/material/p-NNN.webp`)과 PDF가 아닌 교재의 보조 글자(`material.md`)를, 앱이 원본을 보내지 못한 교재의 보조 글자를 만들어요.
교재의 뜻은 코드가 해석하지 않아요. AI는 원본·쪽 그림을 직접 읽어요(이 문서는 AI 에이전트가 읽을 필요가 없어요).

## 1. 전체 모양

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
  "errors":   [ { "code": "hwp-distribution", "message_ko": "배포용 문서로 저장된 한글 파일이라 …", "file": "계획.hwp" } ],
  "warnings": [ { "code": "hidden-slides", "message_ko": "숨긴 슬라이드 2장은 …", "file": "교재.pptx" } ]
}
```

## 2. 파일(`files[]`)

| 필드 | 뜻 |
|---|---|
| `id` | 파일 id. 슬라이드형(PPTX·PDF)은 `deck1`, `deck2`…, 문서형(DOCX·HWP·HWPX·TXT·MD)은 `doc1`…, 링크는 `link1`… |
| `name` | 파일 이름(NFC로 정리) |
| `type` | `pptx` · `pdf` · `docx` · `hwp` · `hwpx` · `txt` · `md` · `link` |
| `size` | 바이트 |
| `pages`, `unit` | 쪽 수와 단위: `slide`(PPTX), `page`(PDF), `section`(문서형: 제목 기준으로 나눈 부분), `link` |
| `title`, `author`, `modified` | 문서 속성(있을 때) |
| `slideSize` | `{ width, height, ratio: "16:9" }` (px, PPTX·PDF) |
| `url` | 링크로 받은 자료의 원래 주소 |
| `renderOf` / `renderSource` | 같은 교재의 PDF본을 함께 올리면 PDF에 `renderOf:"deck1"`, PPTX에 `renderSource:"deck2"`. PDF본은 **보조 글자에서 빠지고 쪽 그림 원본으로만** 씀 |
| `path`, `rendered`, `pageImages` | CLI 전용: 원본 경로, 만든 쪽 그림 수, 문서형의 실제 쪽 그림 목록 |

## 3. 쪽(`pages[]`)

```jsonc
{
  "file": "deck1", "page": 8, "kind": "slide",          // kind: slide | page(PDF) | section(문서형) | link
  "title": "실습 1. 제미나이로 영상 요약하기",
  "titleGuessed": true,                                  // 제목 자리표시자가 없어 글자 크기·위치로 추정했을 때만
  "layout": "content",                                    // PPTX·PDF 힌트: title(표지) section(간지) content two-content comparison
                                                          //   title-only blank picture content-caption table custom
  "layoutName": "Title and Content",                     // PPTX 레이아웃 원래 이름
  "hidden": true,                                         // 숨긴 슬라이드(보조 글자·쪽 번호에서 뺌)
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

## 4. 디자인 단서(`design`)

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
HWP·HWPX는 `fonts`에 한글 기본 글꼴(예: 함초롬바탕)과 `fontsUsed`를, PDF는 `slideSize`만 채웁니다.

## 5. 오류 코드(`errors[].code`)

예외를 던지지 않고 이 목록으로 돌려줍니다. 화면에는 `message_ko`를 그대로 보여 주면 됩니다(개발용 `detail`은 보여 주지 않음).

| code | 상황 |
|---|---|
| `empty` · `too-large` · `not-found` | 빈 파일 · 100MB 초과(바꿀 수 있음) · 경로 없음(CLI) |
| `legacy-hwp` · `legacy-ppt` · `legacy-doc` · `legacy-office` | 예전 형식(한글 97 이전 HWP·PPT·DOC) → HWP·HWPX·PPTX·DOCX·PDF로 다시 저장 안내 |
| `hwp-distribution` | 배포용으로 저장한 한글 문서 → 원본이나 PDF로 |
| `encrypted` · `pdf-encrypted` · `drm` | 암호·문서 보안(DRM, 학교 문서보안 프로그램) |
| `corrupt` · `parse-failed` · `zip-bomb` | 손상 · 해석 실패 · 압축을 풀면 지나치게 큰 파일(선언 크기 합계 600MB·파일 하나 200MB·항목 2만 개 상한) |
| `unsupported` · `keynote` · `odf` · `spreadsheet` | 지원하지 않는 형식(안내 포함) |
| `needs-pdfjs` | pdf.js가 없음. Node에서는 `fallback:"python"`이 붙고 CLI가 자동으로 `ingest.py`를 씀 |
| `pdf-failed` · `bad-url` | PDF 해석 실패 · 잘못된 주소 |

경고(`warnings[].code`): `no-text`(스캔 PDF), `no-content`, `hidden-slides`, `too-many-pages`(1000쪽 넘으면 앞부분만), `images-unsupported`(EMF·WMF), `link-only`·`link-fetch-failed`(링크만 받음), `python-fallback`, `render-failed`.
