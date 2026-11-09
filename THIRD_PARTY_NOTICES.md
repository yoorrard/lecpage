# 제3자 구성 요소 (Third-party notices)

lecpage에 함께 들어 있거나(번들·벤더), 만든 사이트가 실행 중에 불러오는 외부 구성 요소입니다. 각 구성 요소의 저작권은 원저작자에게 있습니다.

## 함께 배포되는 것

| 구성 요소 | 버전 | 라이선스 | 어디에 |
|---|---|---|---|
| [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (Kazuhiko Arase) | 1.4.4 | MIT | 만든 사이트의 `assets/qr.js` (머리말 고지 유지) |
| [fflate](https://github.com/101arrowz/fflate) | 0.8.2 | MIT | 교재 해석(zip 읽기)·ZIP 쓰기, `skills/lecpage/engine/vendor/fflate.js` |
| [Preact](https://github.com/preactjs/preact) | 10.26.4 | MIT | 웹앱 |
| [PDF.js (pdfjs-dist)](https://github.com/mozilla/pdf.js) | 4.10.38 | Apache-2.0 | 웹앱 PDF 해석 |
| [Pretendard](https://github.com/orioncactus/pretendard) | 1.3.9 | SIL OFL 1.1 | 웹앱 글꼴 |
| [Jua](https://fonts.google.com/specimen/Jua) (@fontsource/jua) | 5.2.5 | SIL OFL 1.1 | 웹앱 제목 글꼴 |
| [Quicksand](https://fonts.google.com/specimen/Quicksand) (@fontsource/quicksand) | 5.2.6 | SIL OFL 1.1 | 웹앱 로고 글꼴 |

MIT 전문은 각 파일 머리말과 원 저장소에 있습니다. SIL OFL 1.1 전문: https://openfontlicense.org

## 만든 사이트가 실행 중에 불러오는 것(CDN, 효과를 켠 경우만)

| 구성 요소 | 버전 | 라이선스 |
|---|---|---|
| [GSAP](https://gsap.com) + ScrollTrigger | 3.15.1 | GSAP Standard "No Charge" License(무료, 오픈소스 아님) |
| [Lenis](https://github.com/darkroomengineering/lenis) | 1.3.27 | MIT |
| [OGL](https://github.com/oframe/ogl) | 1.0.11 | Unlicense |
| 웹 글꼴(Pretendard, SUIT, Wanted Sans, Noto, Gowun, Jua 등) | — | 대부분 SIL OFL 1.1. G마켓 산스 등 일부는 제작사 무료 라이선스 |

글꼴 목록과 출처: `skills/lecpage/engine/src/design/fonts.js`, `seeds.js`.

## 만든 사이트에 함께 넣는 사용자 자료
교재·사진·글은 사용자의 것입니다. 저작권(그림책 표지, 학생 작품 등) 확인은 사용자 몫이며, lecpage는 이 자료를 운영자 서버로 보내지 않습니다.
