# 내 도메인·짧은 주소·QR

> 참가자가 쉽게 치고, 학교 필터에 덜 막히고, 호스팅을 바꿔도 주소가 그대로인 방법.

## 무엇을 고를까
| 방법 | 비용 | 주소 예 | 장점 | 단점 |
|---|---|---|---|---|
| 호스팅 기본 주소 | 0원 | `lec-1104.pages.dev` | 바로 됨 | 길다, 학교가 `*.pages.dev`·`*.github.io` 등을 막는 경우 |
| **내 도메인 + 경로**(권장) | 도메인 연 1~3만 원 ⚠️ | `lec.example.kr/1104` | 짧고 오래감, 연수마다 경로만 추가 | 처음 한 번 설정 |
| 학교·기관 도메인의 하위 주소 | 0원 | `lec.○○.hs.kr` | 학교망에서 신뢰 | 교육청·IT 승인 필요(어려운 경우 많음) |
| 단축 URL 서비스 | 0원~ | `vo.la/abcd` | 즉석 | 만료·광고·차단 위험, 서비스 종료 위험 |

## 1. 도메인 사기
- 국내 등록업체(가비아, 후이즈, 카페24 등): `.kr`·`.한국` 가능. 가격은 업체·이벤트마다 다름 ⚠️.
- Cloudflare Registrar: 원가 판매, DNS가 바로 Cloudflare에 있어 연결이 가장 쉬움(`.kr`은 지원하지 않는 것으로 알려짐 ⚠️ → `.com`·`.org` 등).
- 이름 팁: 짧게, 소문자, 헷갈리는 글자(0/o, 1/l) 피하기. 예) `lec-yoo.com`, `aiclass.kr`.

## 2. 호스팅에 연결하기
| 호스팅 | 어디서 | DNS에 넣을 값 |
|---|---|---|
| Cloudflare Pages | 프로젝트 → **Custom domains → Set up a domain** | 도메인이 Cloudflare에 있으면 자동. 아니면 CNAME `lec → lec-1104.pages.dev` |
| Cloudflare Workers | `wrangler.jsonc`의 `routes`에 `{ "pattern": "lec.example.kr", "custom_domain": true }` | 자동(도메인이 Cloudflare DNS에 있어야 함) |
| GitHub Pages | 저장소 **Settings → Pages → Custom domain** 입력 → **Enforce HTTPS** | 하위 도메인: CNAME `lec → <아이디>.github.io` / 루트 도메인: A `185.199.108.153` `185.199.109.153` `185.199.110.153` `185.199.111.153` |
| Netlify | **Domain management → Add a domain** | CNAME `lec → <이름>.netlify.app` |
| Vercel | 프로젝트 **Settings → Domains** | 화면에 나오는 CNAME/A 값 |
| Firebase | **Hosting → 커스텀 도메인 추가** | 화면에 나오는 TXT·A 값 |
| CloudFront | `aws-s3-cloudfront.md`의 "내 도메인" | CNAME `lec → dxxxx.cloudfront.net` (+ us-east-1 ACM 인증서) |
| 내 서버(Caddy) | `.env`의 `LEC_SITE_ADDRESS=lec.example.kr` | A `lec → 서버 IP` (인증서 자동) |

- DNS 반영은 몇 분~몇 시간. HTTPS 인증서는 대부분 자동으로 붙습니다.
- 실시간 주소(Supabase 등)는 바꿀 필요 없습니다. 단 node-server의 `LEC_ORIGINS`·cf-relay의 허용 목록에 **새 사이트 주소**를 추가하세요.

## 3. 경로형 짧은 주소 만들기 (`lec.example.kr/1104`)
도메인 하나로 연수마다 짧은 경로를 만들고 실제 사이트로 넘깁니다.
- **Cloudflare(도메인이 Cloudflare에 있을 때)**: 대시보드 → 도메인 → **Rules → Redirect Rules** → "URI 경로가 `/1104`이면 `https://lec-1104.pages.dev/`로 302". 또는 작은 Pages 프로젝트에 `_redirects` 파일:
```
/1104   https://lec-1104.pages.dev/   302
/0312   https://lec-0312.pages.dev/   302
```
- **GitHub Pages**: 저장소에 `1104/index.html`을 만들고 안에 `<meta http-equiv="refresh" content="0; url=https://…">` + 링크 한 줄.
- 302(임시)를 쓰면 나중에 목적지를 바꿀 수 있습니다.

## 4. 단축 URL 서비스 (도메인이 없을 때)
- 쓰기 전에 학교망에서 열리는지 꼭 확인(단축 URL 도메인을 막는 필터가 있음 ⚠️).
- TinyURL: 계정 없이 가능, 링크가 만료되지 않는다고 안내됨 ⚠️.
- Bitly: 국내 점유율이 높지만 무료 기능이 많이 줄었다는 평가 ⚠️ 한도 확인.
- 국내: `vo.la`, `han.gl` 등 ⚠️ 운영·무료 정책 직접 확인.
- 네이버 단축 URL(me2.do): 신규 생성 종료, 기존 링크도 2026-09-30 이후 중단 예정이라는 정보 ⚠️(단일 출처) → 쓰지 않기.
- goo.gl: 신규 생성 불가(2018). 2025-08 이후 활동 없는 링크는 중단, 활발한 링크만 유지.

## 5. QR 코드
- **screen.html**이 사이트 주소의 큰 QR을 직접 그립니다(외부 서비스 불필요). 인쇄물도 이 화면을 캡처하거나 엔진이 만든 QR 이미지를 쓰세요.
- QR에는 **짧은 주소가 아니라 전체 주소**를 넣어도 됩니다(길이가 문제되지 않음). 단축 서비스가 사라져도 QR은 살아 있습니다.
- 인터넷 "QR 생성기" 중 **동적 QR**은 체험 기간이 끝나면 멈추는 경우가 많습니다 → 정적 QR만.
- 인쇄 크기: 한 변 3cm 이상, 프로젝터는 화면 높이의 1/3 이상. 안드로이드·아이폰 기본 카메라와 네이버/카카오 스캔으로 시험.
- 칠판·자료에 **주소 글자도 함께** 적습니다(QR을 못 찍는 기기 대비).

## 확인하기·되돌리기
- 확인: 휴대폰 데이터와 학교 와이파이 둘 다에서 `https://<내 도메인>/check.html`, 주소창 자물쇠(HTTPS) 확인. `nslookup lec.example.kr`로 DNS 값 확인(개발자).
- 되돌리기: 호스팅에서 도메인 연결을 지우고 DNS 레코드를 삭제하면 기본 주소(`*.pages.dev` 등)로 돌아갑니다. 경로형 주소는 리다이렉트 규칙만 고치면 됩니다.

## 연수가 끝난 뒤
- 경로형 주소(`/1104`)는 기록 사이트로 계속 넘기거나, 지우면 404가 됩니다. 인쇄물에 남은 QR을 생각해 한동안 유지 권장.
- 도메인 자동 연장 여부를 확인합니다(만료되면 다른 사람이 살 수 있음).
