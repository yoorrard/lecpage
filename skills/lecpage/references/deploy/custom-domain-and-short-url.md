# 내 도메인·짧은 주소·QR

> 참가자가 쉽게 치고, 학교 필터에 덜 막히고, 호스팅을 바꿔도 주소가 그대로인 방법.

## 무엇을 고를까
| 방법 | 비용 | 주소 예 | 장점 | 단점 |
|---|---|---|---|---|
| 호스팅 기본 주소 | 0원 | `lec-1104.pages.dev` | 바로 됨 | 길다, 학교가 `*.pages.dev`·`*.github.io` 등을 막는 경우 |
| **내 도메인 + 경로**(권장) | `.com` 연 약 1.6만 원(Cloudflare), `.kr` 연 약 2.2~2.3만 원(가비아 ⚠️) | `lec.example.kr/1104` | 짧고 오래감, 연수마다 경로만 추가 | 처음 한 번 설정 |
| 학교·기관 도메인의 하위 주소 | 0원 | `lec.○○.hs.kr` | 학교망에서 신뢰 | 교육청·IT 승인 필요(어려운 경우 많음) |
| 단축 URL 서비스 | 0원~ | `vo.la/abcd` | 즉석 | 만료·광고·차단 위험, 서비스 종료 위험 |

## 1. 도메인 사기
| 어디서 | 살 수 있는 것 | 가격(등록 / 갱신, 2026-11-09) | 연결 |
|---|---|---|---|
| **Cloudflare Registrar**(권장) | `.com` `.net` `.app` `.dev` `.page` `.io` 등. **`.kr`·`.co.kr`은 팔지 않음** | `.com` $11.17 / $11.17 · `.page` $10.20 / $10.20 · `.dev` $8.20 / $12.20 · `.app` $8.20 / **$14.20** · `.io` $32 / **$50** (2차 출처, 사기 전 화면에서 확인) | 사자마자 Cloudflare DNS. 따로 할 일 없음 |
| 국내 등록업체(가비아·후이즈·카페24 등) | `.kr` `.co.kr` `.한국` 등 | `.kr` 연 약 2.2~2.3만 원(가비아, VAT 포함 ⚠️ 확인 못 함) | Cloudflare에 연결하려면 **네임서버를 Cloudflare로 바꿈**(아래) |

- Cloudflare Registrar는 원가 판매라 갱신 때도 값이 거의 같습니다. `.app`·`.io`처럼 갱신 값이 오르는 이름은 피하는 편이 좋습니다.
- `.app` `.dev` `.page`는 https로만 열립니다(모든 호스팅이 https라 문제없음).
- 이름 팁: 짧게, 소문자, 헷갈리는 글자(0/o, 1/l) 피하기. 예) `lec-yoo.com`, `aiclass.kr`.
- 사고 나서: 등록업체 계정 2단계 인증, **자동 갱신** 켜기(만료되면 다른 사람이 살 수 있음).

### 국내에서 산 도메인(.kr)을 Cloudflare에 연결하기
1. Cloudflare 대시보드 → **Add a domain**(사이트 추가) → 도메인 입력 → **Free** 플랜.
2. Cloudflare가 알려 주는 **네임서버 2개**를 적어 둡니다.
3. 가비아 → **My가비아 → 도메인 관리 → 네임서버 설정**에서 두 값으로 바꿉니다. `.kr`·`.한국`은 네임서버를 바꿀 때 **본인 인증**을 요구하기도 합니다(등록업체 안내, 2차 출처).
4. 몇 분~하루 뒤 Cloudflare에서 "Active"가 되면 끝. 그 뒤 DNS는 Cloudflare에서 고칩니다.

> Workers(GitHub 연결·명령줄·실시간 중계)에 내 도메인을 붙이려면 이처럼 **네임서버를 Cloudflare로 옮겨야** 합니다. CNAME만 바꾸는 방식은 Cloudflare 유료(Business) 기능이라 쓸 수 없습니다. Pages(끌어 놓기)는 하위 도메인이면 CNAME만으로도 됩니다.
> 출처: https://www.cloudflare.com/tld-policies/ · https://developers.cloudflare.com/registrar/top-level-domains/ · https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/ · https://developers.cloudflare.com/dns/zone-setups/partial-setup/

## 2. 호스팅에 연결하기
| 호스팅 | 어디서 | DNS에 넣을 값 |
|---|---|---|
| Cloudflare Pages | 프로젝트 → **Custom domains → Set up a domain** | 도메인이 Cloudflare에 있으면 자동. 아니면 CNAME `lec → lec-1104.pages.dev`(하위 도메인만) |
| Cloudflare Workers | Worker → **Settings → Domains & Routes → Add → Custom domain**, 또는 `wrangler.jsonc`의 `routes`에 `{ "pattern": "lec.example.kr", "custom_domain": true }` | 자동(DNS·인증서). **도메인이 Cloudflare 영역(네임서버)에 있어야 함** |
| GitHub Pages | 저장소 **Settings → Pages → Custom domain** 입력 → **Enforce HTTPS** | 하위 도메인: CNAME `lec → <아이디>.github.io` / 루트 도메인: A `185.199.108.153` `185.199.109.153` `185.199.110.153` `185.199.111.153` |
| Netlify | **Domain management → Add a domain** | CNAME `lec → <이름>.netlify.app` |
| Vercel | 프로젝트 **Settings → Domains** | 화면에 나오는 CNAME/A 값 |
| Firebase | **Hosting → 커스텀 도메인 추가** | 화면에 나오는 TXT·A 값 |
| CloudFront | `aws-s3-cloudfront.md`의 "내 도메인" | CNAME `lec → dxxxx.cloudfront.net` (+ us-east-1 ACM 인증서) |
| 내 서버(Caddy) | `.env`의 `LEC_SITE_ADDRESS=lec.example.kr` | A `lec → 서버 IP` (인증서 자동) |

- DNS 반영은 몇 분~몇 시간. HTTPS 인증서는 대부분 자동으로 붙습니다.
- 실시간 주소(Supabase 등)는 바꿀 필요 없습니다. 단 node-server의 `LEC_ORIGINS`·cf-relay의 `ALLOWED_ORIGINS`에 **새 사이트 주소**를 추가하세요.

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
- 암호로 잠근 사이트는 QR 주소 끝에 `#k=암호`를 붙이면 찍은 사람은 저절로 열립니다. 이 QR은 연수장 안에서만 보여 주고, 단톡방 등에는 주소만(암호 따로) 나눕니다. `#` 뒤는 서버로 전송되지 않습니다.
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
