# 짧은 주소·QR 조사와 결정 (2026-11-12)

- 조사일 **2026-11-11~12**. 각 서비스의 공식 페이지를 직접 내려받아 읽고, API는 실제로 불러 봤습니다(시험 주소는 가짜 도메인).
- ⚠️ = 직접 확인하지 못한 것. "2차" = 공식이 아닌 출처.
- 관련 코드: `app/src/lib/deploy.js`(`shortenUrl`·`checkShortUrl`), `app/src/pages/steps/Share.jsx`(`ShortLink`·`JoinBig`), `app/src/components/QR.jsx`, 엔진 `runtime/lecpage.js`·`screen.js`·`console.js`, `src/render/pages.js`.

## 1. 결정

1. **QR과 [주소 복사]·카톡 안내 문구는 언제나 원래 주소**를 씁니다. 짧은 주소는 손으로 칠 글자에만 씁니다(공개하기 화면, 안내문, 발표 화면, 강사 화면, 사이트의 공유 창에서 짧은 주소를 크게, 원래 주소를 작게). 짧은 주소 서비스가 없어지거나 막혀도 만든 사이트는 그대로 열립니다.
2. **[짧은 주소 만들기] 한 번**: 브라우저에서 is.gd API를 바로 불러 만듭니다. 운영자 서버·키가 필요 없습니다. 이름은 앱이 치기 쉬운 영문 소문자 7자(자음·모음 번갈아)로 짓고, 강사가 직접 정할 수도 있습니다(`is.gd/이름`).
3. **다른 서비스에서 만든 주소 넣기**: [joo.is 열기]·[bit.ly 열기]를 누르면 사이트 주소를 복사하고 새 탭을 엽니다. 만든 주소를 [붙여넣기]로 넣으면 앱이 확인하고(https만, 계정·포트·IP·`javascript:` 등 거름) `meta.shortUrl`에 저장합니다. 어느 서비스의 주소든 넣을 수 있습니다.
4. 짧은 주소는 **암호(#k=…)를 뺀 주소**로만 만듭니다. 사이트 주소가 바뀌면(다른 곳에 올림·내림) 짧은 주소를 지웁니다.
5. 안내문·발표 화면 같은 사이트 안의 표시는 사이트에 구워 넣으므로 **다시 올려야** 바뀝니다. 성공 카드에 한 줄과 [다시 올리기] 단추를 둡니다(지난번에 올린 곳이 연결돼 있으면 한 번에 올라감). 주소 창의 `#…`로 넘기는 방법은 남이 만든 링크로 안내문에 엉뚱한 주소를 띄울 수 있어 쓰지 않았습니다.

## 2. 비교 (무료로 쓸 때)

| | 가입 | 한 번에(브라우저 API) | 광고·중간 화면 | 한도·만료 | 이름 정하기 | 메모 |
|---|---|---|---|---|---|---|
| **is.gd** | 없음 | ✓ `access-control-allow-origin: *`, 키 없음 | 없음("3rd party advertising 없이 운영", 바로 301 이동) | IP당 시간당 200개. 지우지 않음("last forever") | 영문·숫자·`_` 5~30자. 한글 ✗ | 한 번 만들면 고치거나 지울 수 없음. 영국에서 운영 |
| v.gd | 없음 | ✓ | **미리보기 화면이 먼저 뜸** | is.gd와 같음 | 같음 | is.gd의 자매 서비스 |
| **joo.is** | 필요 | ✗(공개 API 없음 ⚠️) | 언급 없음 ⚠️ | 무료 짧은 링크 50개 | 한글 주소 가능(`joo.is/5학년환경`) | 교사용 서비스. QR 내려받기 포함 |
| bit.ly | 필요 | ✗(토큰 필요) | **무료는 "With Ads"**(2025-02부터 중간 광고, 2차) | 월 5개, 이름 정하기 월 3개 | ✓ | |
| TinyURL | 계정이면 월 30개 | ✗(`api-create.php`는 `allow-origin: https://tinyurl.com`만) | ⚠️ | 만료 없음 | ✓ | 가입 없이 만드는 길은 확인 안 함 ⚠️ |
| vo.la | 필요(무료 개인 플랜) | ✗(키 필요) | "브랜딩 제거"가 유료 ⚠️ | 월 100개, 통계 15일 | 유료 | 보안 목록에 오른 기록(2차) |
| han.gl | — | — | — | **무료 플랜 종료** | — | 최저 월 8,800원 |
| url.kr | 없음 | ⚠️ | ⚠️ | **기본 3년 뒤 만료**, 하루 접속 5,000회 | ⚠️ | |
| me2.do | — | ✗(네이버 클라우드 API 키가 필요한 것으로 보임 ⚠️) | — | — | ✗ | `me2.do/` 첫 화면은 404. 웹에서 직접 만드는 화면을 찾지 못함 |
| buly.kr | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | 조사 환경에서 접속되지 않음 |

키 없이 브라우저에서 불리는 곳은 is.gd·v.gd 말고도 da.gd·spoo.me가 있었습니다(둘 다 `allow-origin: *`). spoo.me는 `http://` 주소를 돌려주고, 둘 다 운영 방침·한도 문서가 is.gd만큼 분명하지 않아 쓰지 않았습니다.

## 3. 근거

- **is.gd API를 브라우저에서 바로 부를 수 있음**: `https://is.gd/create.php?format=json&url=…` 응답에 `access-control-allow-origin: *`. curl과 실제 브라우저(다른 출처의 `fetch`) 둘 다 확인. 오류도 같은 헤더로 JSON(`errorcode` 1 주소 문제·2 이름 문제·3 한도·4 서비스)이 옵니다.
- **무료 호스팅 주소를 받아 줌**: `*.vercel.app`·`*.github.io/…`·`*.pages.dev`·`*.netlify.app`·`*.workers.dev` 모두 만들어졌습니다. 다른 짧은 주소(예: bit.ly/…)는 거절합니다.
- **치기 쉬운 이름**: is.gd가 지어 주는 이름은 대소문자·숫자가 섞여(`IPUQib`) 휴대폰에서 치기 어렵습니다. 그래서 앱이 소문자 이름을 지어 `shorturl=`로 보냅니다. 조회 API로 세어 보니 자음·모음을 번갈아 쓴 6자는 16개 중 6개가 이미 쓰였고 7자·8자는 0개였습니다 → 7자, 겹치면 다시(3번), 그다음 8자, 끝내 안 되면 is.gd가 짓는 이름.
- **bit.ly 무료는 광고**: 요금 페이지의 무료 플랜 이름이 "Free — With Ads", 월 5개. 연수 중에 광고 화면이 먼저 뜨면 곤란해서 도우미 단추 옆에 한 줄로 알립니다.
- **무료 정책은 바뀜**: han.gl은 무료 플랜을 끝냈고, 구글 goo.gl은 2025-08-25부터 쓰이지 않던 링크를 껐습니다. 그래서 QR에 짧은 주소를 넣지 않습니다.
- **막힐 수 있음**: 짧은 주소 도메인은 필터에서 한 묶음으로 막는 범주입니다(예: HaGeZi "URL Shortener" 목록에 is.gd·bit.ly·vo.la·han.gl·tinyurl.com·buly.kr·me2.do가 모두 있음, joo.is는 없음). 한국 학교망에서 실제로 무엇이 막히는지는 확인하지 못했습니다 ⚠️. 막혀도 QR·원래 주소로 들어옵니다.
- **개인정보**: is.gd는 원래 주소와 만든 사람의 IP(남용 추적용)를 저장하고, "짧은 주소는 비공개가 아니며 짐작될 수 있다"고 적어 둡니다. 앱은 사이트 주소만 보내고(`referrerPolicy: no-referrer`, 암호 조각 제외), 누르기 전에 "사이트 주소를 is.gd로 보내"라고 알립니다. 내용을 지켜야 하는 사이트는 '암호를 아는 사람만'으로 공개하라고 도움말에 적었습니다.

## 4. 다른 도구는 어떻게 들어오게 하나

- **Mentimeter**: 참여 링크, QR(발표 중 화면에 띄우거나 미리 내려받기), `menti.com` + 숫자 코드의 세 가지 길.
- Slido(`slido.com` + `#코드`), Kahoot(`kahoot.it` + PIN), Padlet(링크·QR)도 같은 모양입니다(이번에 공식 문서를 다시 읽지는 못함 ⚠️).
- 공통점: **발표 화면에 QR을 크게**, 그 옆에 **손으로 칠 짧은 글자**. lecpage는 사이트마다 주소가 달라 "고정 도메인 + 코드"를 운영자 서버 없이 만들 수 없으므로, QR을 먼저 두고 짧은 주소를 곁들입니다.

## 5. 교실에서 읽히는 QR

- 오류 정정 **M**(15%, DENSO WAVE가 "표준"으로 드는 값). 로고를 넣지 않으므로 H는 필요 없고, 낮을수록 점이 커져 멀리서 잘 읽힙니다.
- **둘레 여백 4칸**(규격의 quiet zone)을 그림 안에 넣었습니다. 앱·사이트·저장한 PNG 어디서나 같고, 어두운 화면·붙여 넣은 문서에서도 읽힙니다. 언제나 흰 바탕에 검은 점(반전 없음).
- **크기**: QR 한 변은 찍는 거리의 1/10쯤이 필요합니다(2차, 여러 안내의 경험칙). 10m 뒤에서 찍으려면 화면에서 1m → 발표 화면과 앱에 **[크게 보기]**(화면 가득)를 넣었습니다. A4 안내문의 QR은 한 변 120mm로 키웠습니다.
- **내보내기**: [QR 저장]은 PNG 1024px(300dpi로 8.6cm), [QR 복사]는 그림을 클립보드로(발표 자료·한글 문서에 바로 붙여넣기). 크게 인쇄할 때는 안내문 페이지가 벡터(SVG)로 인쇄됩니다. SVG 내려받기 단추는 쓰는 사람이 드물어 넣지 않았습니다.

## 6. 확인 못 한 것

- 한국 시도교육청 망에서 is.gd·joo.is·bit.ly가 실제로 열리는지.
- joo.is 무료 링크에 광고가 붙는지, TinyURL·vo.la 무료 링크의 중간 화면.
- buly.kr 전체(접속 불가), me2.do의 현재 정책(공식 문서를 열지 못함).
- Slido·Kahoot·Padlet의 현재 참여 화면(이번에는 Mentimeter 도움말만 읽음).
- is.gd의 실제 가동률(공식 수치 없음). 닿지 않으면 앱이 쉬운 말로 알리고 다른 방법을 펼칩니다.

## 7. 출처

- is.gd: [API](https://is.gd/apishorteningreference.php) · [한도](https://is.gd/usagelimits.php) · [FAQ](https://is.gd/faq.php) · [약관](https://is.gd/terms.php) · [개인정보](https://is.gd/privacy.php)
- joo.is: [첫 화면](https://joo.is/) · 요금제·URL 단축 안내(사이트 안 페이지)
- Bitly: [요금](https://bitly.com/pages/pricing) · 중간 광고 도입 기사(2차): [Tedium 2025-02-07](https://tedium.co/2025/02/07/bitly-terms-of-service-change/)
- TinyURL: [요금](https://tinyurl.com/app/pricing) · vo.la: [가격 정책](https://vo.la/pricing) · han.gl: [요금정책](https://han.gl/pricing) · [url.kr](https://url.kr/)
- 네이버 단축 URL(me2.do): 검색 결과에 나온 네이버 클라우드 nShortURL API 문서(2차, 문서 페이지는 열지 못함 ⚠️)
- goo.gl 종료: [Google Developers Blog](https://developers.googleblog.com/en/google-url-shortener-links-will-no-longer-be-available/)
- 차단 목록: [HaGeZi DNS Blocklists — URL Shortener](https://github.com/hagezi/dns-blocklists#urlshortener)
- Mentimeter: [How to participate in a Menti](https://help.mentimeter.com/en/articles/410537-how-to-participate-in-a-menti)
- QR: [DENSO WAVE — 여백과 오류 정정](https://www.qrcode.com/en/howto/code.html) · 거리 10:1 경험칙(2차): [qr-code-generator.com](https://www.qr-code-generator.com/blog/qr-code-distance/)
