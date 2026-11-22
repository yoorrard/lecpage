# 제3자 구성 요소 (Third-party notices)

lecpage에 함께 들어 있거나(번들·벤더), 만든 사이트가 실행 중에 불러오는 외부 구성 요소입니다. 각 구성 요소의 저작권은 원저작자에게 있습니다.

## 함께 배포되는 것

| 구성 요소 | 버전 | 라이선스 | 어디에 |
|---|---|---|---|
| [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (Kazuhiko Arase) | 1.4.4 | MIT | 만든 사이트의 `assets/qr.js`(원본 `skills/lecpage/engine/runtime/vendor/qrcode.js`, 머리말 고지 유지), 웹앱 QR |
| [fflate](https://github.com/101arrowz/fflate) (Arjun Barrett) | 0.8.3 | MIT | 교재 해석(zip 읽기, 한글 HWP 압축 풀기)·ZIP 쓰기, `skills/lecpage/engine/vendor/fflate.js` (npm `esm/browser.js` 그대로, sha256 `b7ca4450b19559a1d50eb381adcee94b82449674be4cd17789d9beba7e6122a1`. 0.8.2의 GHSA-px8p-9vwx-vf98을 고친 판) |
| [Preact](https://github.com/preactjs/preact) | 10.26.4 | MIT | 웹앱 |
| [PDF.js (pdfjs-dist)](https://github.com/mozilla/pdf.js) (Mozilla Foundation) | 4.10.38 | Apache-2.0 | 웹앱 PDF 해석, lecpage 커넥트 묶음의 PDF 읽기(node_modules/pdfjs-dist에 라이선스와 함께). NOTICE 파일은 없음 |
| [OpenJPEG](https://github.com/uclouvain/openjpeg) | PDF.js에 포함 | BSD-2-Clause | PDF.js 워커 안의 JPEG 2000 해석기 |
| [pptx-renderer](https://github.com/aiden0z/pptx-renderer) (aiden0z) | 1.4.0 | Apache-2.0 | 웹앱: PPTX 교재를 브라우저 안에서 쪽 그림으로(PPTX를 넣을 때만 받음) |
| [docx-preview](https://github.com/VolodymyrBaydalka/docxjs) | 0.4.1 | Apache-2.0 | 웹앱: DOCX 교재를 브라우저 안에서 쪽 그림으로(DOCX를 넣을 때만 받음) |
| [snapDOM](https://github.com/zumerlab/snapdom) (zumerlab) | 3.8.2 | MIT | 웹앱: 그린 슬라이드·쪽을 그림 파일로 |
| [rhwp (@rhwp/core)](https://github.com/edwardkim/rhwp) (Edward Kim) | 0.9.1 | MIT | 웹앱: 한글(HWP·HWPX) 교재를 브라우저 안에서 쪽 그림으로(한글 파일을 넣을 때만 받음). 번들에는 JS 연결 코드만 넣고, WebAssembly 본체 `rhwp_bg.wasm`(27.9MB, 배포 한 파일 한도 초과)은 jsDelivr의 같은 판(`cdn.jsdelivr.net/npm/@rhwp/core@0.9.1/rhwp_bg.wasm`)에서 고치지 않은 파일을 받아 빌드 때 잰 SHA-256과 같을 때만 씀. 본체에 든 Rust 크레이트·글꼴 자료(MIT·Apache-2.0·BSD·Zlib·OFL 등 허용 라이선스)의 고지는 패키지의 `notices/THIRD_PARTY_LICENSES.md` |
| [JSZip](https://github.com/Stuk/jszip) (pako·lie·immediate 포함) | 3.10.2 | MIT(MIT 또는 GPLv3 가운데 MIT로 씀) | 위 두 도구의 zip 읽기 |
| [Apache ECharts](https://github.com/apache/echarts)·[ZRender](https://github.com/ecomfe/zrender)·[tslib](https://github.com/microsoft/tslib) | 6.1.0·6.1.0·2.3.0 | Apache-2.0·BSD-3-Clause·0BSD | pptx-renderer가 PPTX 속 차트를 그릴 때 |
| [Wanted Sans](https://github.com/wanteddev/wanted-sans) (The Wanted Sans Project Authors) | 1.0.3 | SIL OFL 1.1 | 웹앱 글꼴. npm 패키지의 분할 woff2를 고치지 않고 그대로 실음(예약 글꼴 이름 없음) |
| [models.dev](https://models.dev) 공개 모델 목록 (models.dev) | 매일 받음 | MIT | 웹앱 `ai-catalog.json`(AI 모델 값·출시일 표)의 일부. OpenRouter 공개 목록에 없는 모델만 이 목록에서 채움. `scripts/ai-catalog/refresh.mjs`가 하루 한 번 받아 모델 id·숫자·날짜만 담음 |

- `ai-catalog.json`의 나머지 자료는 OpenRouter 공개 모델 목록(`openrouter.ai/api/v1/models`, 키 없이 읽는 공개 API)과 Google Gemini 공식 문서(가격표·모델 문서)에서 뽑은 사실(모델 코드, 무료 등급인지)입니다. 글·설명은 옮기지 않습니다.
- 벤더 파일은 저작권 표시와 라이선스 고지를 파일 머리말에 둡니다.
- 웹앱 배포본은 압축 과정에서 머리말이 빠지는 것까지 포함해, 위 구성 요소의 저작권 표시와 라이선스 전문(MIT·Apache-2.0·BSD-2-Clause·OFL 1.1)을 `licenses.txt`에 모아 함께 배포합니다(`app/vite.config.js`가 빌드할 때 만듦).
- 만든 사이트에 들어가는 제3자 파일은 `assets/qr.js` 하나입니다. 머리말을 지우지 않으면 따로 할 일이 없습니다.

## 참고한 공개 형식 문서

- **한글 문서 파일 형식 5.0**(한글과컴퓨터): 예전 한글 파일(.hwp)을 읽는 `skills/lecpage/engine/src/ingest/hwp.js`·`cfb.js`와 시험용 파일을 만드는 `skills/lecpage/engine/test/fixtures/make_hwp.mjs`는 외부 라이브러리 없이 이 공개 문서를 보고 직접 썼습니다. 공개 문서의 조건에 따라 밝힙니다: **본 제품은 한글과컴퓨터의 한/글 문서 파일(.hwp) 공개 문서를 참고하여 개발하였습니다.**
- **[MS-CFB] Compound File Binary File Format**(Microsoft Open Specifications): .hwp를 담는 OLE 복합 문서 그릇을 읽는 데 참고했습니다.

## 만든 사이트가 실행 중에 불러오는 것(CDN)

lecpage가 파일을 함께 배포하지 않고, 사이트가 버전을 고정한 jsDelivr 주소에서 고치지 않은 파일을 불러옵니다. GSAP·Lenis·OGL은 AI가 쓰는 사이트가 쓸 수 있는 바깥 스크립트 허용 목록이라, 사이트가 실제로 쓸 때만 불러옵니다.

| 구성 요소 | 버전 | 라이선스 | 언제 |
|---|---|---|---|
| [GSAP](https://gsap.com) + ScrollTrigger (Webflow) | 3.15.1 | [Standard "No Charge" GSAP License](https://gsap.com/standard-license)(무료, 오픈소스 아님) | 사이트가 스크롤 연출에 쓸 때 |
| [Lenis](https://github.com/darkroomengineering/lenis) | 1.3.27 | MIT | 사이트가 부드러운 스크롤에 쓸 때 |
| [OGL](https://github.com/oframe/ogl) | 1.0.11 | Unlicense | 사이트가 3D 그래픽에 쓸 때 |
| [supabase-js](https://github.com/supabase/supabase-js) | 2.118.0 | MIT | 참여 기능을 Supabase로 연결한 경우 |

GSAP 조건(2025-04-30 시행, 2025-05-30 수정본 기준): 웹사이트에서 쓰는 것은 상업 이용까지 무료입니다. 저작권 표시를 지우거나 바꾸면 안 되고, Webflow의 시각적 애니메이션 제작 기능과 경쟁하는 "코드 없이 애니메이션을 만드는 도구"에 넣는 것은 금지입니다. lecpage는 정해 둔 효과를 켜고 끄기만 하며 애니메이션 편집 기능이 없습니다. 조건이 바뀔 수 있으니 버전을 올릴 때 다시 확인합니다.

## 웹 글꼴

만든 사이트는 기본으로 CDN(jsDelivr, Google Fonts, 네이버 `hangeul.pstatic.net`) 주소를 연결하고, 글꼴 함께 담기를 켜면(아래) 글꼴 파일을 사이트 안에 담습니다. 웹앱의 디자인 미리보기는 같은 CDN 주소에서 받습니다.

- 목록에 있는 글꼴은 모두 SIL OFL 1.1입니다. 네이버 나눔 계열(나눔스퀘어·나눔휴먼·마루 부리 등)은 OFL 1.1을 따르는 나눔글꼴 라이선스이고, G마켓 산스는 제작사가 OFL로 배포합니다.
- 글꼴마다 라이선스와 주소를 `skills/lecpage/engine/src/design/fonts.js`(`FONTS`의 `license`)와 `seeds.js`에 적습니다. 새 글꼴도 같은 기준으로 넣습니다.
- 파일 수정·재배포·웹 임베딩을 막는 글꼴은 넣지 않습니다. 조사 기록: `docs/research/fonts-2026-11.md`.
- 글꼴 함께 담기(`--bundle-fonts`, 앱과 skill `publish`의 기본값)는 글꼴 파일을 사이트 안(`assets/fonts/`)에 원본 그대로 담고, 사이트에 쓰인 글자만 남긴 파일을 함께 담습니다(글꼴 이름·라이선스 표는 원본 그대로). 다만 파일의 저작권·라이선스 설명(name 표 0·13번)에 예약 글꼴 이름(Reserved Font Name)이 적힌 글꼴은 줄인 판을 만들지 않고 원본만 담습니다(OFL 3항, `engine/src/font-subset.js`의 `hasReservedName`).

## 만든 사이트에 함께 넣는 사용자 자료
교재·사진·글은 사용자의 것입니다. 저작권(그림책 표지, 학생 작품 등) 확인은 사용자 몫이며, lecpage는 이 자료를 운영자 서버로 보내지 않습니다.

## 참고만 한 자료(코드·문장을 옮기지 않음)
문구 기준(`docs/writing.md`)을 세울 때 아래 공개 저장소를 읽고 원리만 lecpage 기준으로 다시 썼습니다. 저장소에 들어 있지 않고, 설치하지도 않습니다.

| 자료 | 라이선스 | 참고한 것 |
|---|---|---|
| [claudianus/toss-ux-writing-skill](https://github.com/claudianus/toss-ux-writing-skill) | MIT | 예외 판단 틀, 화면 자리별 패턴 |
| [Ksanbal/toss-ux-writing-skill](https://github.com/Ksanbal/toss-ux-writing-skill) | MIT | 다크 패턴 점검표 |
| [NariP/toss-ux-writing-skills](https://github.com/NariP/toss-ux-writing-skills) | MIT | 해요체·능동 예시 |
