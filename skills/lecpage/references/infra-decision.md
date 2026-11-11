# 인프라 결정 가이드 (어디에 올리고, 실시간은 무엇으로 할까)

> skill이 "배포·실시간" 단계에서 읽는 문서입니다. 순서: **1. 입력 모으기 → 2. `decide-infra` 실행(§4 규칙과 같은 결과) → 3. 경고 확인(§4 guards) → 4. 교사에게 설명(§9) → 5. 해당 `deploy/*.md`대로 올리기**.
> 숫자는 2026-11-11에 공식 문서에서 다시 확인했습니다(`docs/research/hosting-2026-11.md`, §11 출처). 확인 못 한 값은 ⚠️ 표시.
> 원칙: **강사가 직접 소유**(강사 계정·강사 서버), **비용 0원에 가깝게**, **학교망에서 끊겨도 화면은 살아 있게**.
> 올릴 곳의 기본값은 쓰는 사람에 따라 다릅니다. **앱(브라우저만, `skill: click`)은 Vercel**, **skill(명령 가능)은 Cloudflare Workers 정적 자산**.
> lecpage 운영자는 **공용 실시간 중계를 운영하지 않습니다**(이유: `docs/operations.md`). 실시간은 언제나 강사 소유 백엔드입니다.

---

## 1. 입력 (인터뷰에서 받는 값)

| 키 | 값 | 묻는 말(교사용) | 기본값 |
|---|---|---|---|
| `participants` | 정수 | 참여 인원은 몇 명인가요? | blueprint `audience.size` |
| `features` | `qa help progress poll reactions signal`(실시간) · `attendance board survey`(모으기) · `upload` | 연수 중에 질문 받기·도움 요청·진행 현황·투표·나눔 보드가 필요한가요? | blueprint `live.features` (+ `board.allowFiles`면 `upload`) |
| `duration` | `single` · `multi`(1주 안에 여러 번) · `course`(1주 넘게 띄엄띄엄) | 한 번 하는 연수인가요, 여러 차시인가요? | `meta.sessions` 개수와 날짜 간격 |
| `skill` | `click` · `basic` · `dev` | 회원가입·복사·붙여넣기까지 괜찮으세요? 터미널(명령어)을 써 보셨나요? | `click` |
| `budget` | `zero` · `low`(월 1만 원 이하) · `org`(기관 예산·기관 계정) | 비용은 0원이어야 하나요? | `zero` |
| `minor` | bool | 참여자가 학생(만 14세 미만 포함)인가요? | `audience.minor` |
| `realName` | bool | 이름·학교를 받아야 하나요? (별명만으로 충분한가요?) | `privacy.collect`에 name/school 있으면 true |
| `keepInKorea` | bool | 자료가 국내 서버에만 있어야 하나요?(기관 지침) | false |
| `network` | `good` · `slow` · `restricted` · `offline` | 연수 장소 인터넷이 막히거나 느린 편인가요? 인터넷이 아예 없나요? | `audience.network` |
| `blocked` | 문자열 목록 | 학교에서 막힌 사이트를 아시나요? (check.html 결과로 채움) | `audience.blocked` |
| `infra` | `github google cloudflare aws azure gcp docker-host school-server nas vps raspberry-pi laptop` | 이미 쓰는 계정·서버가 있나요?(GitHub, 구글, AWS, 학교 서버, NAS…) | `[]` |
| `customDomain` | bool | 내 도메인(예: lec.school.kr)이 있나요? | false |
| `paid` | bool | 강사료 등 대가를 받는 연수인가요? (Vercel 무료는 비상업만) | false |
| `previous` | 올릴 곳 id | 지난번에 올린 곳이 있나요? (같은 주소를 이어 씀) | 없음 |
| `connected` | 올릴 곳 id 목록 | 이미 쓰는 곳이 있나요? skill은 묻기 전에 셸에서 확인: `npx wrangler@4 whoami`, `gh auth status`, `VERCEL_TOKEN`·`NETLIFY_AUTH_TOKEN` | `[]` |
| `keep` | `long` | 연수 뒤에도 오래 둘 사이트인가요? | 없음 |
| `access` | `link` · `public` · `password` | 사이트를 누가 볼 수 있나요? 주소·QR을 받은 사람만 / 누구나(검색 허용) / 암호를 아는 사람만 | `link` |
| `siteMB` · `files` · `maxFileMB` | 수 | (빌드 결과) 사이트 크기, 파일 수, 가장 큰 파일. 앞의 둘은 빌드 요약 줄에, 큰 파일은 `find dist -type f -size +5M`로 | 빌드 결과 |
| `instant` | bool | (앱 전용) 운영자가 '바로 공개'를 켜 둔 앱인지. skill은 쓰지 않음 | false |

파생 값
- `realtime` = `features`에 `qa help progress poll reactions signal` 중 하나라도 있음.
- `store` = `features`에 `attendance board survey` 중 하나라도 있음(모으기만 하면 되는 기능).
- `liveNeeded` = `realtime` 또는 `store`. (`quiz`, `reflection`처럼 자기 기기 안에서 끝나는 것은 실시간이 아님 → `local`)
- `heavy` = `features`에 `reactions`가 있거나, 참가자가 60명 넘게 동시에 실시간 갱신을 받음
- `transferGB` = `siteMB × participants × 3 ÷ 1024` (1인당 평균 3번 접속 가정, 연수 1회 기준)
- `sessionsPerMonth` = 한 달에 이 사이트로 하는 연수 횟수(모르면 1)
- `wsBlocked` = `blocked`에 `websocket` 포함(check.html 결과)
- 강사 기기 2대(console, screen)는 참가자 수에 **더해서** 계산합니다.

---

## 2. 빠른 결론 표 (사람이 먼저 보는 표)

올릴 곳과 실시간은 따로 고릅니다. 올릴 곳이 Vercel·GitHub Pages여도 실시간은 Sheets·Supabase·Cloudflare 중계 그대로입니다(Vercel 안에 두지 않음).

### 2.1 올릴 곳 (모두 0원, 앞에 있을수록 추천)

| 상황 | 올릴 곳 | 가이드 |
|---|---|---|
| **앱(클릭만)** | **Vercel**(토큰으로 앱에서 바로, 다시 올려도 같은 주소) · GitHub Pages · Cloudflare(ZIP 끌어 놓기) · Netlify(이미 쓰는 분) | `deploy/vercel.md` |
| **skill(명령 가능)** | **Cloudflare Workers 정적 자산**(`wrangler deploy --assets`, 계정이 없으면 `--temporary`) · Vercel(`VERCEL_TOKEN`) · GitHub Pages(`gh`) · Netlify | `deploy/cloudflare.md` |
| 강사료를 받는 연수 | Cloudflare · GitHub Pages (Vercel 무료는 비상업만이라 뺌) | `deploy/cloudflare.md` |
| 사이트가 100MB를 넘음 | GitHub Pages (Vercel은 한 번에 100MB까지) | `deploy/github-pages.md` |
| 25MB 넘는 파일이 있음, 파일이 1,000개를 넘음 | Cloudflare를 맨 뒤로. 추천이 Cloudflare였으면 GitHub Pages | `deploy/github-pages.md` |
| 내 도메인을 붙일 계획, (skill) 학교망이 엄격함 | Cloudflare | `deploy/custom-domain-and-short-url.md` |
| 지난번에 올린 곳, 이미 연결해 둔 곳이 있음 | 그곳 먼저(Netlify는 이때만 앞에 옴) | 해당 가이드 |
| 인터넷이 없음 | 강사 노트북(교실 LAN) · ZIP | `deploy/local-lan-classroom.md`, `deploy/zip-usb-offline.md` |
| 실시간을 내 서버(node-server)로 돌림 | 같은 서버(Caddy/nginx) | `deploy/own-server-nginx-caddy.md`, `deploy/nas-synology.md` |
| 기관 AWS · Azure 계정 | S3 + CloudFront(콘솔만이면 Amplify) · Azure Static Web Apps | `deploy/aws-s3-cloudfront.md`, `deploy/azure-static-web-apps.md` |
| (앱 전용) '바로 공개'가 켜진 앱, 40MB·600개 안 | lecpage 주소(가입 없음, 30일 뒤 지워짐) | 앱 화면 |

### 2.2 실시간

| 상황 | 실시간 | 월 비용 | 가이드 |
|---|---|---|---|
| 참여 기록이 필요 없음 | none | 0원 | — |
| 출석·제출만 모음, 40명 이하 | Google Sheets + Apps Script | 0원 | backends/apps-script |
| **50명 이하, 질문·도움 요청·진행 현황·투표, 클릭만** | **Google Sheets + Apps Script**(강사 구글 계정, 7초마다 새로 읽기) | 0원 | 앱의 "구글 시트 연결" 안내 + backends/apps-script |
| 100명 이하, 회원가입 가능 | Supabase(강사 소유, 서울 리전) | 0원 | backends/supabase |
| 100명 넘음, 또는 반응이 많음 | Cloudflare DO 중계(강사 계정, **Deploy to Cloudflare 버튼**. GitHub 계정도 필요) | 0원(무료 한도 안) | `deploy/cloudflare.md` |
| 서버·NAS·VPS·학교 서버가 있음 | node-server(Docker). 사이트도 같은 서버 | 기존 비용 | `deploy/own-server-nginx-caddy.md`, `deploy/nas-synology.md` |
| 서버는 없지만 node-server를 쓰고 싶은 개발자 | node-server(Fly.io·Railway·Render, 유료) | 월 $2~7 | `deploy/paas-node-hosting.md` |
| 인터넷이 없거나 심하게 막힘 | node-server(강사 노트북, 교실 LAN) | 0원(+공유기) | `deploy/local-lan-classroom.md` |
| 기관 AWS 계정 | Supabase 또는 Lightsail(서울) node-server | 0원~월 $5 | `deploy/aws-lightsail-docker.md` |
| 학생(미성년) + 실명 | node-server(학교 서버·NAS·노트북) 또는 local | 0원 | `deploy/local-lan-classroom.md` |

---

## 3. 결정 규칙 (사람이 읽는 순서)

실시간(live)을 먼저 정하고, 그 결과에 맞춰 정적 호스팅(static)을 고릅니다. 각 목록은 **위에서부터 처음 맞는 규칙 하나**만 씁니다. 그다음 §4의 경고(guards)를 모두 검사합니다.
★ 표시는 엔진 `decideInfra()`(`decide-infra` 명령)가 그대로 구현한 규칙입니다. ★ 없는 규칙은 엔진 입력에 없는 값(실명·국내 보관·WS 차단·Azure·GitHub)으로만 걸리므로, 그 값이 없으면 결과가 엔진과 같습니다.

### 3.1 실시간(live)
1. ★ **L01** 실시간·모으기 기능이 없다 → `none` (자기 기기 안 퀴즈·기록만 있으면 `local`).
2. ★ **L02** 인터넷이 없다(`offline`) → `node-server`를 **강사 노트북**에서(교실 LAN). 노트북이 어렵다면 `local`.
3. **L03** 학생(미성년) + 실명 수집 → `node-server`(학교 서버·NAS·노트북). 서버가 없으면 `local` + "실명 대신 별명" 권고.
4. **L04** 국내 보관 지침 → `supabase`(서울 `ap-northeast-2`) 또는 국내 서버의 `node-server`(Lightsail 서울, 학교 서버, NAS). Cloudflare DO는 한국 지정 불가(관할 지정은 EU·FedRAMP만).
5. ★ **L05** Docker가 도는 서버(NAS·VPS·학교 서버)나 기관 AWS가 있고 `skill`이 basic 이상 → `node-server`.
6. **L06** WebSocket이 막힌 학교(`wsBlocked`) → `cf-relay`(SSE·새로 읽기 자동 전환). 클릭만 가능하면 `sheets`(일반 HTTPS만 씀).
7. ★ **L07** 출석·제출처럼 **모으기만**(`realtime` 없음) + 40명 이하 → `sheets`.
8. ★ **L08** **클릭만 가능 + 50명 이하 → `sheets`.** 질문·도움 요청·진행 현황·투표·반응도 됩니다(7초마다 새로 읽기). 구글 계정만 있으면 앱의 안내를 따라 10분 안에 연결하고 "연결 확인"으로 시험합니다.
9. ★ **L09** 100명 이하 → `supabase`(강사 소유, 서울 리전). 클릭만 하는 강사에게도 이 결과가 나오면 회원가입이 필요하다고 먼저 알립니다(G23).
10. ★ **L10** 그 밖(100명 초과) → `cf-relay`(강사 Cloudflare 계정). 명령어 없이 **Deploy to Cloudflare 버튼**으로 만들 수 있습니다. 대안: `node-server`.

### 3.2 정적 호스팅(static)
1. ★ **S01** `offline` → live가 `node-server`면 `lan`(노트북이 사이트도 같이 제공). 실시간이 없으면 `zip`(엔진은 `lan`만 보여 줌).
2. ★ **S02** live가 `node-server` → 같은 서버(`server`: Caddy/nginx, `/api`를 같은 주소로).
3. ★ **S03** live가 `cf-relay` → `cloudflare`(Workers 정적 자산, 같은 계정에서 관리).
4. ★ **S04** 기관 AWS 계정 + basic 이상 → `aws-s3-cloudfront` (콘솔만 쓰려면 Amplify 끌어 놓기, 같은 가이드).
5. **S05** 기관 Azure 계정 + basic 이상 → `azure-swa`.
6. ★ **S06** 클릭만 가능 → `netlify`(앱의 '주소 만들기': 연결 코드 한 번, 다시 올려도 같은 주소, 원본 비공개). 대안: `cloudflare-pages-drop`(끌어 놓기), `github-pages`(공개 저장소). 앱 없이 skill로 폴더만 받았다면 Cloudflare 끌어 놓기가 가장 쉽습니다.
7. **S07** GitHub를 쓴다 → `github-pages`.
8. ★ **S08** 그 밖 → `cloudflare`(대안 `github-pages`, `netlify`).

### 3.3 공개 범위(access)
- `link`(기본): 모든 페이지에 `noindex`, `robots.txt`는 `Disallow: /`. 주소·QR을 받은 사람만 들어옵니다. 접근 제어는 아닙니다.
- `public`: 검색 허용(`robots.txt` `Allow: /`).
- `password`: 페이지(index·console·screen)와 교재 그림·원본 자료를 **AES-GCM**으로 암호화하고, 열쇠는 암호에서 **PBKDF2-SHA256 60만 회**로 만듭니다(StatiCrypt 방식). `check.html`·`privacy.html`은 누구나 봅니다. QR에 `#k=암호`를 붙이면 찍은 사람은 저절로 열립니다. **https 주소에서만** 열리므로 LAN(http)·ZIP(file://)에는 쓰지 않습니다(G24). 암호화된 파일은 누구나 내려받을 수 있어 **약한 암호는 오프라인으로 맞혀 볼 수 있습니다**. 10자 넘게, 낱말 서너 개를 이어 쓰게 안내합니다.
- 강사용 파일(DESIGN.md·운영안내.md·lecpage.blueprint.json)은 어느 경우에도 사이트에 들어가지 않습니다(CLI는 `<out>-강사용/`, 앱은 따로 내려받기).

---

## 4. 규칙 블록 (JSON)

엔진(`engine/src/decide/infra.js`)은 아래에서 `"engine": true`인 규칙을 같은 순서로 구현합니다. 나머지는 skill이 대화에서 덧붙이는 규칙입니다. 해석 규칙:
- `when`의 각 키는 **모두** 맞아야 합니다(AND). `$or`는 배열 중 하나라도 맞으면 참.
- 값 비교: 스칼라 = 같음, 배열 = 그중 하나, `{"gt":n}` `{"gte":n}` `{"lt":n}` `{"lte":n}`, 목록 입력에는 `{"any":[..]}` `{"all":[..]}` `{"none":[..]}`, 불리언 파생값은 `true/false`.
- `live` 목록 → 처음 맞는 규칙의 `pick`. 그다음 `static` 목록(키 `live`로 앞 결과 참조). 마지막에 `guards`는 **맞는 것 전부** 경고로 보여 줍니다(`level`: `block`이면 그 조합을 쓰면 안 됨 → `fix`의 대안으로 교체).
- `expr` 문자열은 사람이 읽는 계산식입니다.

엔진 입력·결과와 이 문서의 이름 대응

| 이 문서 | 엔진 `decideInfra()` |
|---|---|
| `participants` | `size` |
| `skill`: `click` · `basic` · `dev` | `skill`: `click` · `set` · `dev` |
| `duration`: `single` · `multi` · `course` | `duration`: `day` · `month` · `long`(Supabase 정지 경고에만 씀) |
| `infra`: `docker-host` `school-server` `nas` `vps` `raspberry-pi` `aws` | `infra`: `server` `school-server` `nas` `aws` |
| `paid` | `commercial` |
| live `none` · `sheets` · `supabase` · `cf-relay` · `node-server`(own/school) · `node-server`(lan) | backend `none` · `sheets` · `supabase` · `cloudflare` · `server` · `lan` |
| static `aws-s3-cloudfront` · `cloudflare`/`cloudflare-pages-drop` · `server`/`nas` | hosts `s3` · `cloudflare` · `server` |

```json
{
  "schema": "lecpage.infra-rules/2",
  "checked": "2026-11-09",
  "derive": {
    "realtime": "features ∩ {qa,help,progress,poll,reactions,signal} ≠ ∅",
    "store": "features ∩ {attendance,board,survey} ≠ ∅",
    "liveNeeded": "realtime OR store",
    "heavy": "features has reactions OR participants > 60",
    "wsBlocked": "blocked has websocket",
    "transferGB": "siteMB * participants * 3 / 1024",
    "sessionsPerMonth": "한 달 연수 횟수(모르면 1)",
    "devices": "participants + 2"
  },
  "live": [
    {"id":"L01","engine":true,"when":{"liveNeeded":false},"pick":"none","alt":["local"]},
    {"id":"L02","engine":true,"when":{"network":"offline"},"pick":"node-server","place":"lan","alt":["local"]},
    {"id":"L03","when":{"minor":true,"realName":true,"infra":{"any":["docker-host","school-server","nas","vps","raspberry-pi","laptop"]}},"pick":"node-server","place":"school","alt":["local"]},
    {"id":"L03b","when":{"minor":true,"realName":true},"pick":"local","note":"실명 대신 별명으로 바꾸면 sheets/supabase도 가능"},
    {"id":"L04","when":{"keepInKorea":true,"skill":["basic","dev"]},"pick":"supabase","region":"ap-northeast-2","alt":["node-server"]},
    {"id":"L04b","when":{"keepInKorea":true},"pick":"node-server","place":"school","alt":["local"]},
    {"id":"L05","engine":true,"when":{"infra":{"any":["docker-host","school-server","nas","vps","raspberry-pi","aws"]},"skill":["basic","dev"]},"pick":"node-server","place":"own"},
    {"id":"L06","when":{"wsBlocked":true,"skill":["basic","dev"]},"pick":"cf-relay","alt":["node-server"]},
    {"id":"L06b","when":{"wsBlocked":true},"pick":"sheets"},
    {"id":"L07","engine":true,"when":{"realtime":false,"participants":{"lte":40}},"pick":"sheets","note":"출석·제출처럼 모으기만"},
    {"id":"L08","engine":true,"when":{"skill":"click","participants":{"lte":50}},"pick":"sheets","alt":["supabase"],"note":"질문·도움 요청·진행 현황 포함. 7초 새로 읽기. 앱의 안내 + 연결 확인"},
    {"id":"L09","engine":true,"when":{"participants":{"lte":100}},"pick":"supabase","region":"ap-northeast-2","alt":["cf-relay","node-server"]},
    {"id":"L10","engine":true,"when":{},"pick":"cf-relay","alt":["supabase","node-server"],"note":"강사 계정. Deploy to Cloudflare 버튼(가입 필요) 또는 wrangler"}
  ],
  "static": [
    {"id":"S01","engine":true,"when":{"network":"offline","live":"node-server"},"pick":"lan"},
    {"id":"S01b","when":{"network":"offline"},"pick":"zip"},
    {"id":"S02","engine":true,"when":{"live":"node-server"},"pick":"server"},
    {"id":"S03","engine":true,"when":{"live":"cf-relay"},"pick":"cloudflare"},
    {"id":"S04","engine":true,"when":{"infra":{"any":["aws"]},"skill":["basic","dev"]},"pick":"aws-s3-cloudfront","alt":["aws-amplify"]},
    {"id":"S05","when":{"infra":{"any":["azure"]},"skill":["basic","dev"]},"pick":"azure-swa"},
    {"id":"S06","engine":true,"when":{"skill":"click"},"pick":"netlify","alt":["cloudflare-pages-drop","github-pages"],"note":"앱 없이 폴더만 있으면 cloudflare-pages-drop이 가장 쉬움"},
    {"id":"S07","when":{"infra":{"any":["github"]}},"pick":"github-pages","alt":["cloudflare"]},
    {"id":"S08","engine":true,"when":{},"pick":"cloudflare","alt":["github-pages","netlify"]}
  ],
  "guards": [
    {"id":"G01","when":{"hostDomainBlocked":true},"level":"block","warn":"학교망이 호스팅 기본 주소(*.github.io, *.pages.dev 등)를 막음","fix":"customDomain 연결 또는 다른 호스팅 / IT 담당자에게 허용 요청(deploy/school-network-checklist.md)"},
    {"id":"G02","when":{"static":"firebase","expr":"transferGB * sessionsPerMonth > 9"},"level":"block","warn":"Firebase Spark 호스팅 전송 월 10GB. 넘으면 다음 달 1일까지 사이트가 꺼짐","fix":"cloudflare 또는 github-pages"},
    {"id":"G03","when":{"static":"vercel","paid":true},"level":"block","warn":"Vercel Hobby는 비상업 개인 용도만(강사료 받는 연수는 회색지대)","fix":"cloudflare 또는 github-pages"},
    {"id":"G04","when":{"static":"netlify","expr":"transferGB*20 + deploys*15 > 250"},"level":"warn","warn":"Netlify 무료 300크레딧/월 근접. 다 쓰면 계정의 모든 사이트가 멈춤","fix":"배포 횟수 줄이기(1회=15크레딧) 또는 cloudflare"},
    {"id":"G05","when":{"static":"render","expr":"transferGB*sessionsPerMonth > 5"},"level":"warn","warn":"Render Hobby 대역폭 월 5GB 포함","fix":"cloudflare"},
    {"id":"G06","when":{"static":"azure-swa","siteMB":{"gt":240}},"level":"block","warn":"Azure SWA 무료: 환경당 250MB","fix":"슬라이드 화질 낮추기 또는 cloudflare"},
    {"id":"G07","when":{"static":"github-pages","siteMB":{"gt":900}},"level":"block","warn":"GitHub Pages 사이트 1GB 한도","fix":"슬라이드 화질 낮추기 또는 cloudflare(파일당 25MiB, 2만 개)"},
    {"id":"G08","when":{"static":"cloudflare-pages-drop","expr":"fileCount > 1000"},"level":"block","warn":"끌어 놓기 업로드는 1,000개 파일까지","fix":"GitHub 연결(Workers Builds)·wrangler(2만 개) 또는 ZIP 정리"},
    {"id":"G09","when":{"live":"supabase","expr":"devices > 190"},"level":"block","warn":"Supabase 무료 실시간 동시 연결 200","fix":"cf-relay"},
    {"id":"G10","when":{"live":"supabase","expr":"broadcastsPerSec * (participants + 1) > 80"},"level":"warn","warn":"Supabase 무료 초당 100메시지(받는 사람마다 1개로 셈). 넘으면 연결이 끊김","fix":"반응(reactions) 2초 묶음 전송, 참가자 화면은 필요한 채널만 구독. heavy이면서 60명 넘으면 cf-relay"},
    {"id":"G12","when":{"live":"supabase","duration":["multi","course"]},"level":"warn","warn":"무료 프로젝트는 7일간 활동이 적으면 일시 정지","fix":"연수 2~3일 전 대시보드 열기 + check.html 실행. 정지되면 대시보드에서 Resume(1년 안). 오래 가는 과정이면 cf-relay"},
    {"id":"G13","when":{"live":"supabase"},"level":"info","warn":"무료 프로젝트는 계정당 2개까지(정지된 것 제외)","fix":"연수 끝나면 데이터 지우고 프로젝트 정지·삭제"},
    {"id":"G14","when":{"live":"cf-relay","expr":"participants * (3600/pollSec) * hours > 80000"},"level":"warn","warn":"WebSocket이 막혀 새로 읽기로 돌면 Workers 무료 10만 요청/일을 넘을 수 있음(09:00 KST 초기화)","fix":"새로 읽기 간격 10~15초, 또는 node-server"},
    {"id":"G15","when":{"live":"sheets","participants":{"gt":40}},"level":"warn","warn":"Apps Script는 사용자당 동시 실행 30개. 많은 인원이 짧은 간격으로 부르면 늦어지거나 실패","fix":"새로 읽기 7~10초 유지, 반응 줄이기, 60명 넘으면 supabase"},
    {"id":"G16","when":{"live":"sheets","features":{"any":["upload"]}},"level":"warn","warn":"Sheets 파일 올리기는 기본 꺼짐. 그래서 생성 사이트도 live.uploads가 true일 때만 나눔 보드에 파일 칸을 보임. 켜면 보드에 보이는 동안 드라이브 '링크가 있는 모든 사용자'로 공유","fix":"시트 메뉴 '파일 올리기 켜기/끄기'로 켠 뒤 `patch … --set live.uploads=true`로 다시 빌드. 학교 계정은 외부 공유가 막힐 수 있음. 14세 미만이면 끄기"},
    {"id":"G17","when":{"live":"node-server","place":"lan"},"level":"warn","warn":"학교 와이파이는 기기끼리 통신을 막는 경우가 많음(AP 격리). 휴대폰 핫스폿은 동시 접속 수가 적음","fix":"전용 공유기 준비 또는 Quick Tunnel(deploy/local-lan-classroom.md)"},
    {"id":"G19","when":{"wsBlocked":true,"live":"supabase"},"level":"info","warn":"Supabase 실시간은 WebSocket이 필요. 막히면 어댑터가 7초 새로 읽기로 바뀜(반응이 늦어짐)","fix":"그대로 써도 됨. 빠른 반응이 필요하면 cf-relay/node-server(SSE)"},
    {"id":"G20","when":{"blocked":{"any":["cdn.jsdelivr.net","fonts.googleapis.com","fonts.gstatic.com"]}},"level":"warn","warn":"글꼴·라이브러리 CDN 차단","fix":"글꼴·라이브러리를 사이트 안에 포함(자체 호스팅). 시스템 글꼴로도 내용은 보임"},
    {"id":"G21","when":{"minor":true,"live":["sheets","supabase","cf-relay"]},"level":"warn","warn":"만 14세 미만 개인정보는 법정대리인 동의 필요","fix":"별명만 받기(realName=false), 파일 올리기 끄기, 보관 기간 짧게, 연수 뒤 즉시 삭제"},
    {"id":"G22","when":{"static":["github-pages","cloudflare","netlify","vercel"],"expr":"repoOrUploadContains(adminKey|service_role)"},"level":"block","warn":"관리자 키·서비스 키가 공개 파일에 들어감","fix":"키는 사이트에 넣지 않음(서버엔 SHA-256만). Supabase는 anon/publishable 키만"},
    {"id":"G23","when":{"skill":"click","live":["supabase","cf-relay"]},"level":"info","warn":"클릭만 하는 강사에게 회원가입이 필요한 방법이 나옴(50명 초과)","fix":"supabase는 단계별 안내, cf-relay는 Deploy to Cloudflare 버튼. 가입이 어렵다면 sheets로 줄이기(새로 읽기 10초, 반응 끄기)"},
    {"id":"G24","when":{"access":"password","static":["lan","zip"]},"level":"block","warn":"암호 보호는 https 주소에서만 열림(LAN http·file://에서는 내용이 안 보임)","fix":"access=link로 빌드. 인터넷에 올릴 때만 password"},
    {"id":"G25","when":{"static":"github-pages","access":["link","public"]},"level":"info","warn":"무료 GitHub Pages는 공개 저장소라 사이트 파일(교재 그림·원본 포함)을 누구나 내려받을 수 있음","fix":"교재 원본은 빼거나 access=password(파일까지 암호화)"}
  ],
  "hosts": {
    "cloudflare-pages-drop": {"target":"cloudflare","guide":"deploy/cloudflare.md#끌어-놓기","headers":"_headers","cost":"0","limits":"끌어 놓기 1,000파일·25MiB/파일, 정적 요청 무제한","domain":"*.pages.dev"},
    "cloudflare":   {"target":"cloudflare","guide":"deploy/cloudflare.md","template":"templates/deploy/cloudflare/","headers":"_headers","cost":"0","limits":"2만 파일·25MiB/파일, 정적 요청 무료·무제한, Git 연결 빌드 월 3,000분","domain":"*.workers.dev / *.pages.dev"},
    "github-pages": {"target":"github-pages","guide":"deploy/github-pages.md","template":"templates/deploy/github-pages/","headers":"meta","cost":"0","limits":"사이트 1GB, 월 100GB(권고), 무료는 공개 저장소","domain":"*.github.io"},
    "netlify":      {"target":"netlify","guide":"deploy/netlify.md","template":"templates/deploy/netlify/","headers":"_headers","cost":"0","limits":"월 300크레딧(배포 15, GB당 20, 1만 요청당 2). Drop: 익명은 IP당 3개, claim 전 비밀번호 잠금, 1시간 안에 claim","domain":"*.netlify.app"},
    "vercel":       {"target":"vercel","guide":"deploy/vercel.md","template":"templates/deploy/vercel/","headers":"vercel.json","cost":"0","limits":"비상업만, 월 100GB·CDN 요청 100만. Drop: 계정 없이 임시, claim해야 유지","domain":"*.vercel.app"},
    "firebase":     {"target":"firebase","guide":"deploy/firebase.md","template":"templates/deploy/firebase/","headers":"firebase.json","cost":"0","limits":"저장 10GB, 전송 월 10GB(넘으면 다음 달까지 꺼짐)","domain":"*.web.app"},
    "aws-s3-cloudfront": {"target":"s3","guide":"deploy/aws-s3-cloudfront.md","template":"templates/deploy/aws/","headers":"cloudfront-policy","cost":"0~소액","limits":"CloudFront 종량제 상시 무료 월 1TB","domain":"*.cloudfront.net"},
    "aws-amplify":  {"target":"s3","guide":"deploy/aws-s3-cloudfront.md#amplify-끌어-놓기","headers":"amplify-console","cost":"GB당 $0.15 전송","domain":"*.amplifyapp.com"},
    "azure-swa":    {"target":"server","guide":"deploy/azure-static-web-apps.md","template":"templates/deploy/azure/","headers":"staticwebapp.config.json","cost":"0","limits":"월 100GB, 환경당 250MB, 도메인 2개","domain":"*.azurestaticapps.net"},
    "render":       {"target":"server","guide":"deploy/paas-node-hosting.md","template":"templates/deploy/render/","headers":"render.yaml","cost":"0(정적)","limits":"월 5GB 대역폭(Hobby)","domain":"*.onrender.com"},
    "server":       {"target":"server","guide":"deploy/own-server-nginx-caddy.md","template":"templates/deploy/server/","headers":"Caddyfile/nginx.conf","cost":"기존 서버"},
    "nas":          {"target":"server","guide":"deploy/nas-synology.md","template":"templates/deploy/server/","headers":"Caddyfile","cost":"기존 NAS"},
    "lan":          {"target":"server","guide":"deploy/local-lan-classroom.md","template":"templates/deploy/server/","headers":"Caddyfile","cost":"0(+공유기)"},
    "zip":          {"target":"zip","guide":"deploy/zip-usb-offline.md","headers":"none","cost":"0"}
  },
  "backends": {
    "none":        {"provider":"none"},
    "local":       {"provider":"local","note":"기기 안에만 저장(localStorage)"},
    "sheets":      {"provider":"sheets","code":"backends/apps-script/","origins":["https://script.google.com","https://script.googleusercontent.com"],"limits":"동시 실행 30/사용자, 실행당 6분, 7초 새로 읽기, 50명 안팎"},
    "supabase":    {"provider":"supabase","code":"backends/supabase/","origins":["https://<ref>.supabase.co","wss://<ref>.supabase.co"],"limits":"동시 200, 초당 100메시지, 월 200만 메시지, DB 500MB, 파일 1GB, 7일 비활성 정지"},
    "cf-relay":    {"provider":"http","code":"backends/cloudflare/","deploy":"Deploy to Cloudflare 버튼 또는 wrangler. 비밀 ADMIN_KEY, 변수 ALLOWED_ORIGINS","origins":["https://<name>.<sub>.workers.dev","wss://<name>.<sub>.workers.dev"],"limits":"요청 10만/일(정적 제외), DO 요청 10만/일·13,000GB-s/일, 들어오는 WS 메시지 20:1"},
    "node-server": {"provider":"http","code":"backends/node-server/","guides":["deploy/own-server-nginx-caddy.md","deploy/local-lan-classroom.md","deploy/aws-lightsail-docker.md","deploy/paas-node-hosting.md"],"origins":["'self'"],"limits":"서버 성능만큼"}
  }
}
```

---

## 5. 선택지 카탈로그

### 5.1 정적 호스팅 (사이트 파일을 올리는 곳)

| 선택지 | 무료 범위(2026-11-09 확인) | 상업 이용 | 내 도메인·HTTPS | 난이도 | 실패하는 경우 | 가이드 |
|---|---|---|---|---|---|---|
| **Cloudflare Pages(끌어 놓기)** | 정적 요청 무료·무제한, 1,000파일/25MiB(끌어 놓기) | 가능 | ✓ / 자동 | ★ | 끌어 놓기로 만든 프로젝트는 나중에 Git 연결로 못 바꿈 | `deploy/cloudflare.md` |
| **Cloudflare Workers 정적 자산** | 정적 요청 무료·무제한, 2만 파일, Git 연결 빌드 월 3,000분 | 가능 | ✓ / 자동(도메인이 Cloudflare 영역이어야 함) | ★★(Git 연결 대시보드 또는 CLI) | Workers 무료 요청 한도는 실시간 중계에만 해당 | `deploy/cloudflare.md` |
| **GitHub Pages** | 사이트 1GB, 월 100GB(권고), 시간당 10회 빌드(Actions는 예외) | 상업 SaaS·온라인 사업 금지 | ✓ / 자동 | ★★ | 무료 계정은 공개 저장소만, 헤더 설정 불가(CSP는 meta) | `deploy/github-pages.md` |
| **Netlify(+Drop)** | 월 300크레딧(배포 1회 15, GB당 20). Drop은 계정 없이 올리지만 나누려면 claim(가입) | 가능 | ✓ / 자동 | ★ | 크레딧 소진 시 **계정의 모든 사이트 정지**, 새 프로젝트는 비공개로 시작, 익명 Drop은 IP당 3개 | `deploy/netlify.md` |
| **Vercel Hobby(+Drop)** | 월 100GB 전송, CDN 요청 100만. Drop은 계정 없이 임시 주소 | **비상업 개인만** | ✓ / 자동 | ★★ | 한도 넘으면 30일 기다림, 강사료 연수는 회색지대 | `deploy/vercel.md` |
| **Firebase Hosting(Spark)** | 저장 10GB, **전송 월 10GB** | 가능 | ✓ / 자동 | ★★★ | 넘으면 다음 달 1일까지 사이트가 꺼짐 | `deploy/firebase.md` |
| **AWS S3+CloudFront** | CloudFront 종량제 상시 무료 월 1TB·요청 1천만 ⚠️(요청 수는 2차 출처) | 가능 | ✓ / ACM | ★★★ | 신규 계정 무료 플랜은 6개월 뒤 닫힘, 설정 실수로 과금 | `deploy/aws-s3-cloudfront.md` |
| **AWS Amplify Hosting** | 신규 계정은 크레딧, 이후 GB당 $0.15 | 가능 | ✓ / 자동 | ★★ | 트래픽 많으면 S3+CF보다 비쌈 | `deploy/aws-s3-cloudfront.md` |
| **Azure Static Web Apps(Free)** | 월 100GB, 환경당 250MB, 도메인 2개 | 가능 | ✓ / 자동 | ★★ | 사이트 250MB 초과 불가 | `deploy/azure-static-web-apps.md` |
| **Render(정적)** | Hobby 월 5GB 대역폭 | 가능 | ✓ / 자동 | ★★ | 대역폭 작음 | `deploy/paas-node-hosting.md` |
| **Surge** | 무료, 내 도메인·인증서 포함, 프로젝트 450MB/10,100파일 | 가능 | ✓ / 자동 | ★★(CLI) | 헤더 설정 불가(Pro만 라우터) | (research 참고) |
| **Tiiny 류 드롭 호스팅** | 무료 1개·3MB(2차 출처) | 유료 플랜 유도 | 유료 | ★ | 슬라이드 사이트는 용량 초과 | 비권장 |
| **Deno Deploy** | — | — | — | — | 2026-10 Cloudflare 합류, 약 6개월 뒤(2027-04 무렵) 종료 예정 | 비권장 |
| **Google Cloud Run** | 요청 200만/월 등(컨테이너) | 가능 | ✓ | ★★★★ | 결제 계정 필수, 정적만이면 과함 | (research 참고) |
| **네이버 클라우드 Object Storage** | 무료 없음(종량) | 가능 | Global Edge 연동 시 HTTPS | ★★★ | 웹사이트 엔드포인트는 HTTP만 | (research 참고) |
| **카페24·가비아 웹호스팅** | ⚠️ 월 수백~수천 원대(가격 미확인) | 가능 | 상품별 | ★★(FTP) | 오래된 PHP 호스팅, WebSocket 불가 | (research 참고) |
| **학교·교육청 서버** | 기관 | 기관 규정 | 기관 | IT 담당자 | 업로드 권한 없음이 보통 | `deploy/own-server-nginx-caddy.md` |
| **개인 서버·VPS** | 서버 비용 | 가능 | Caddy 자동 | ★★★ | 서버 관리 책임 | `deploy/own-server-nginx-caddy.md` |
| **NAS(Synology)** | 기존 장비 | 가능 | DDNS+Let's Encrypt | ★★★ | 공유기 포트 열기·집 회선 속도 | `deploy/nas-synology.md` |
| **라즈베리 파이** | 기존 장비 | 가능 | LAN이면 불필요 | ★★★ | SD카드 고장 → 백업 필수 | `deploy/local-lan-classroom.md` |
| **강사 노트북(교실 LAN)** | 0원 | — | http(내부망). 잠깐 외부 공개는 Quick Tunnel | ★★ | AP 격리, 노트북 절전 | `deploy/local-lan-classroom.md` |
| **USB·ZIP** | 0원 | — | 없음(file://) | ★ | 실시간 불가, 아이패드에서 열기 어려움, 암호 보호 불가 | `deploy/zip-usb-offline.md` |

### 5.2 실시간 백엔드 (모두 강사 소유)

| 선택지 | 누가 소유 | 무료 범위(2026-11-09 확인) | 잘 맞는 경우 | 실패하는 경우 → 대처 |
|---|---|---|---|---|
| **none** | — | — | 읽기 전용 연수 | — |
| **local** | 참가자 기기 | — | 자기 진도 체크·기록 | 기기 바꾸면 사라짐 → 내려받기 버튼 |
| **Google Sheets + Apps Script** | 강사 구글 계정 | 동시 실행 30/사용자, 실행당 6분, URL Fetch 2만/일 | **클릭만 하는 강사, 50명 안팎**, 질문·도움·진행·투표 | 학교 관리 계정은 "모든 사용자" 배포가 막힐 수 있음 ⚠️ → 개인 gmail 계정 / 파일 올리기는 드라이브에 남음 → 연수 뒤 직접 정리 |
| **Supabase** | 강사 Supabase 계정(서울 리전 가능) | 활성 프로젝트 2개, DB 500MB, 파일 1GB, 전송 5GB, 실시간 동시 200·초당 100·월 200만 메시지 | 100명 이하 대부분의 기능 | 7일 비활성 정지 → 연수 전 열기 / 메시지 폭주 → 반응 묶기. lecpage는 익명 로그인을 쓰지 않아 학교 IP 하나로도 막히지 않음 |
| **Cloudflare DO 중계(cf-relay)** | 강사 Cloudflare 계정(Deploy 버튼으로 생성 가능) | Workers 요청 10만/일(09:00 KST 초기화), DO 요청 10만/일·13,000GB-s/일·SQLite 5GB, 들어오는 WS 메시지 20개=요청 1개 | 큰 인원, 반응이 많은 연수, 여러 주 과정, WS 막힌 학교(SSE·새로 읽기) | 새로 읽기가 길게 돌면 요청 한도 → 간격 늘리기 / 한도 초과 시 오류 1027 → 다음 날 09시까지 |
| **node-server(Docker)** | 강사·학교 서버 | 서버 성능만큼 | 학교 서버, NAS, VPS, 노트북 LAN, 국내 보관 | 서버 꺼지면 끝 → 연수 전 점검, 데이터 폴더 백업 |
| Firebase(RTDB/Firestore) | 강사 구글 계정 | RTDB 동시 100, Firestore 읽기 5만/일; **Storage는 Blaze 필수** | (어댑터 없음) | lecpage 어댑터 미지원 → supabase 권장 |
| PocketBase | 자체 서버 | 오픈소스(SQLite, 실시간 SSE) | 자체 서버 대안 | 1.0 전이라 호환성 보장 안 됨, 어댑터 없음 → node-server 권장 |
| Appwrite Cloud / Convex | 각 서비스 계정 | Appwrite: 한도 넘으면 프로젝트 동결 / Convex: 함수 호출 100만/월 | (어댑터 없음) | 참고만 |

**lecpage 운영자 공용 중계는 없습니다.** 운영자가 참가자 기록을 맡으면 개인정보 처리자가 되고, 무료 한도가 여러 강사의 공용 공격 대상이 되며, 신고·삭제 의무와 사용자에 비례하는 비용이 생깁니다. 대신 Sheets 안내(연결 확인 포함)와 Deploy to Cloudflare 버튼으로 강사 소유를 쉽게 만듭니다.

### 5.3 조합할 때 지켜야 할 것
- **주소(origin)** : 정적 호스팅 주소와 실시간 주소가 다르면 CSP `connect-src`에 실시간 주소를 넣습니다(§10). node-server를 같은 서버에 두면 `'self'`로 끝납니다.
- **CORS** : Supabase·Apps Script는 기본 허용. node-server는 `LEC_ORIGINS`(비우면 모두 허용), cf-relay는 `ALLOWED_ORIGINS`(쉼표 구분, 비우면 모두 허용)에 사이트 주소를 넣습니다.
- **비밀값** : 관리자 키는 사이트에 넣지 않습니다(서버엔 SHA-256만). cf-relay는 `ADMIN_KEY`를 secret으로. Supabase는 anon(publishable) 키만 사이트에. `service_role` 키는 절대 금지.

---

## 6. 용량 계산 (숫자로 확인하기)

| 계산 | 식 | 예: 40명, 사이트 30MB, 90분 |
|---|---|---|
| 정적 전송량(연수 1회) | `siteMB × 인원 × 3` | 30×40×3 = 3.6GB → Firebase Spark(월 10GB)는 한 달에 연수 2회까지, Render(월 5GB)는 1회, 나머지 ✓ |
| Netlify 크레딧 | `전송GB×20 + 배포횟수×15 + 요청/1만×2` | 3.5×20 + 10×15 + 1 ≈ 221 / 300 → 아슬아슬 |
| Supabase 초당 메시지 | `초당 방송 수 × (인원+1)` | 반응을 그대로 보내면 1회 = 41메시지 → 초당 2번만 넘어도 위험. 2초 묶음이면 안전 |
| Supabase 월 메시지 | `방송 수 × (받는 사람+1)` | 90분 동안 3초마다 상태 갱신 = 1,800 × 41 ≈ 7.4만 → 월 200만 한도의 4% |
| Workers 요청(새로 읽기 시) | `인원 × 3600/간격초 × 시간` | 40×720×1.5 = 43,200 (5초) / WS면 연결 1회+보낸 메시지/20 |
| Apps Script 동시 실행 | `인원 ÷ 간격초 × 평균 실행초` | 40÷7×0.7 ≈ 4 (한도 30) / 120명·5초면 ≈ 17 → 위험 |
| DO 실행 시간 | `연결 유지 시간 × 0.125GB` (깨어 있는 동안) | 2시간 = 900GB-s (한도 13,000/일) |

슬라이드가 많으면 엔진의 슬라이드 화질(WebP 품질·가로 폭)을 낮추는 것이 가장 효과가 큽니다(1장 150KB 안팎 권장).

---

## 7. 실패 모드와 대처

| 증상 | 원인 | 미리 막기 | 그날 대처 |
|---|---|---|---|
| 접속은 되는데 실시간이 안 됨 | 학교망 WebSocket 차단, TLS 검사 장비 | check.html로 사전 확인 | http 어댑터는 SSE→새로 읽기, Supabase 어댑터는 7초 새로 읽기로 자동 전환 |
| "프로젝트가 일시 정지됨" | Supabase 무료 7일 비활성 | 연수 2~3일 전 대시보드 열기 + check.html | 대시보드 → Resume(몇 분 걸림) → 그동안 local 모드로 진행 |
| 오후에 갑자기 실시간 중단(Cloudflare) | 무료 일일 한도(오류 1027), 새로 읽기 과다 | 간격 10초 이상, WS 우선 | 09:00 KST에 초기화. 급하면 Workers Paid($5/월) |
| 사이트가 아예 안 열림 | 학교 필터가 `*.github.io`·`*.pages.dev` 등 차단 | 내 도메인 연결, IT에 허용 요청 | 휴대폰 데이터로 접속 안내 / ZIP 배포 |
| 글꼴이 깨지거나 효과가 안 나옴 | jsDelivr·Google Fonts 차단 | 글꼴 자체 호스팅 | 시스템 글꼴로도 내용은 보임(설계 원칙) |
| 사이트가 "Site not available"(Netlify) | 월 크레딧 소진 → 계정 전체 정지 | 배포 횟수 줄이기, 큰 사이트는 Cloudflare | 다른 호스팅에 즉시 재배포(5분) |
| Netlify Drop 주소에 비밀번호 창 | claim 전이라 잠겨 있음 | 1시간 안에 가입·저장, 공개로 | 저장 후 공개. 늦었으면 다시 올리기 |
| 사이트가 꺼짐(Firebase) | 월 10GB 초과 → 다음 달 1일까지 비활성 | 큰 사이트는 Cloudflare | Blaze로 올리거나 다른 호스팅에 재배포 |
| Vercel에서 한도 초과 | Hobby 한도, 30일 대기 | 큰 사이트는 Cloudflare | 다른 호스팅 |
| 노트북 서버에 아무도 못 붙음 | 와이파이 AP 격리, 방화벽 | 전용 공유기, 방화벽 허용 | 노트북을 핫스폿으로(10명 안팎) 또는 Quick Tunnel |
| 질문이 늦게 뜸(Sheets) | 7초 새로 읽기, Apps Script 동시 실행 한도 | 50명 안팎까지 | 화면에 "몇 초 늦게 보여요" 안내 |
| 암호 화면에서 안 열림 | http·file:// 주소, 오래된 브라우저 | https 호스팅에만 password | QR(`#k=암호`)로 다시 들어오기, 크롬·엣지·웨일 |
| 업로드 실패(Supabase) | 파일 1GB, 파일당 크기 | 이미지 줄이기(엔진이 리사이즈) | 링크로 공유 |

---

## 8. 개인정보·미성년자 (요약, 법률 자문 아님 ⚠️)

- **별명만 받기**가 기본입니다. 이름·학교는 이수 처리에 꼭 필요할 때만.
- 만 14세 미만의 개인정보를 받으려면 법정대리인 동의가 필요합니다(개인정보 보호법). 학생 대상이면 **별명만 + 연수 뒤 즉시 삭제**. 학생 개인정보를 다루는 사이트는 교육부 '학습지원 소프트웨어' 기준과 학교운영위원회 심의 대상이 될 수 있습니다(교원 대상 연수는 해당 없음).
- 해외 서버(Supabase 서울 외 리전, Cloudflare, Google)에 개인정보를 두면 개인정보 처리 안내(privacy.html)에 **처리 위탁·국외 이전** 사실(업체, 국가, 항목, 기간)을 적습니다. → blueprint `privacy.processors`.
- 국내 보관이 필요하면: Supabase 서울(`ap-northeast-2`), AWS Lightsail 서울, 네이버 클라우드, 학교 서버·NAS·노트북.
- 연수가 끝나면: CSV 내보내기 → `purge()`(콘솔의 "전부 삭제") → 프로젝트·서버 정리. Sheets·Supabase에 올라간 파일은 따로 지워야 할 수 있습니다. 각 가이드의 "연수가 끝난 뒤"를 따릅니다.

---

## 9. 교사에게 설명하는 말 (추천별 대본)

짧게, 무엇을 하는지·돈·주의점 순서로 말합니다.

**A. Cloudflare Pages 끌어 놓기 + 실시간 없음**
> "연수 사이트를 Cloudflare라는 무료 서비스에 올릴게요. 회원가입하고, 만들어 드린 폴더를 끌어다 놓기만 하면 주소가 생깁니다. 비용은 없고, 참가자가 많아도 괜찮아요. 선생님 계정이라 나중에 지우는 것도 선생님이 직접 하실 수 있어요."

**B. GitHub Pages + 실시간 없음**
> "GitHub 저장소에 사이트 파일을 올리면 GitHub가 무료로 사이트를 열어 줍니다. 무료 저장소는 공개라서 사이트 파일을 누구나 내려받을 수 있어요. 교재를 아무나 보면 곤란하면 암호를 걸어 둘게요. 강사용 메모와 설계도는 올라가지 않아요."

**C. Google Sheets(Apps Script) 실시간**
> "질문·도움 요청·진행 현황은 선생님 구글 시트에 쌓이게 할게요. 구글 계정만 있으면 화면 안내를 따라 10분이면 연결되고, 마지막에 '연결 확인'으로 바로 시험해 볼 수 있어요. 50명 안팎까지 잘 맞고, 화면은 7초마다 새로 읽어서 몇 초 늦게 보일 수 있어요. 끝나면 시트를 지우면 기록도 사라집니다."

**D. Supabase 실시간**
> "Supabase라는 무료 데이터베이스를 선생님 이름으로 하나 만들게요. 서울 서버를 고를 수 있어요. 질문·투표가 바로바로 뜹니다. 하나만 기억해 주세요. 일주일 넘게 안 쓰면 잠들어서 연수 2~3일 전에 한 번 열어 주셔야 해요. 제가 순서대로 안내해 드릴게요."

**E. Cloudflare 중계(DO) + Cloudflare 사이트**
> "사이트와 실시간 서버를 둘 다 선생님 Cloudflare 계정에 올릴게요. 'Deploy to Cloudflare' 버튼을 누르고 관리자 키만 정하시면 명령어 없이 만들어집니다. 인원이 많거나 반응을 쓰셔도 무료 범위 안에서 충분하고, 무료 한도는 매일 오전 9시에 다시 채워져요."

**F. "lecpage 서버를 그냥 빌려 쓰면 안 되나요?"라고 물을 때**
> "lecpage는 참가자 기록을 대신 맡아 주는 서버를 두지 않아요. 기록을 맡는 순간 그 기록의 책임이 운영자에게 넘어가고, 여러 연수가 한 서버를 나눠 쓰면 한 곳에 문제가 생길 때 모두가 멈추거든요. 대신 선생님 구글 계정이나 Cloudflare 계정에 10분 안에 만드는 방법을 안내해 드릴게요. 기록은 선생님만 보고, 선생님이 지울 수 있어요."

**G. 학교 서버·NAS·VPS(node-server + Caddy)**
> "선생님(학교) 서버에 사이트와 실시간 서버를 한 번에 띄우는 설정 파일을 드릴게요. 기록이 학교 안 서버에만 남아서 개인정보 면에서 가장 안전합니다. 서버 담당자께 '도커 컴포즈 파일 하나 실행'이라고 전하시면 됩니다."

**H. 교실 LAN(노트북 서버)**
> "학교 인터넷이 막혀도 되도록 선생님 노트북을 서버로 쓸게요. 작은 공유기 하나를 켜고 참가자들이 그 와이파이에 붙은 뒤 화면의 QR을 찍으면 됩니다. 인터넷이 없어도 질문·투표가 돼요. 노트북 절전만 꺼 주세요."

**I. USB·ZIP**
> "인터넷 없이도 볼 수 있게 사이트를 ZIP 파일로 드릴게요. 압축을 풀고 index.html을 두 번 누르면 열립니다. 이 방식에서는 질문·투표 같은 실시간 기능과 암호 잠금은 쓸 수 없어요."

**J. AWS(S3+CloudFront)**
> "기관 AWS 계정에 사이트를 올리는 설정 파일과 명령어를 드릴게요. 한 달 1TB까지는 전송 비용이 무료라 보통 0원이고, 저장 비용은 몇십 원 수준입니다. 연수 뒤에 지우는 명령어도 같이 드릴게요."

**K. Netlify Drop(빠른 미리 보기)**
> "지금 바로 모양을 확인하려고 Netlify에 끌어다 놓을게요. 로그인 전엔 비밀번호로 잠겨 참가자가 못 보고, 1시간 안에 저장(claim)하지 않으면 정지돼요. 참가자와 나누려면 가입해서 '내 것으로' 저장하고 '공개'를 눌러 주세요."

**L. 공개 범위 고르기**
> "기본은 '링크를 받은 사람만'이에요. 검색에는 안 나오지만 주소를 아는 사람은 들어올 수 있어요. 교재를 꼭 지켜야 하면 '암호'를 고르세요. 연수장 QR로 들어오면 저절로 열리고, 주소만 전달받은 사람은 암호를 물어봐요. 암호는 낱말 서너 개를 이어 길게 정해 주세요."

---

## 10. 템플릿 치환 규칙 (`templates/deploy/`)

| 토큰 | 값 | 예 |
|---|---|---|
| `{{LIVE_ORIGIN}}` | 실시간 백엔드 origin(https·wss) 공백 구분. none/local은 빈 문자열 | Supabase: `https://abcd.supabase.co wss://abcd.supabase.co` / Sheets: `https://script.google.com https://script.googleusercontent.com` / http: `https://relay.x.workers.dev wss://relay.x.workers.dev` |
| `{{SCRIPT_HASHES}}` | 인라인 `<script>`의 `'sha256-…'` 목록. 없으면 빈 문자열 | `'sha256-AbC…='` |
| `{{SITE_NAME}}` | 소문자·숫자·하이픈 | `lec-20261104` |
| `{{COMPAT_DATE}}` | 빌드 날짜 | `2026-11-09` |
| `{{SITE_ORIGIN}}` | 정적 사이트 주소 | `https://lec-20261104.pages.dev` |
| `{{APP_NAME}}` · `{{FIREBASE_PROJECT_ID}}` | 서비스 이름 | |

- 파일: `_headers`(Cloudflare·Netlify 공용), `csp-meta.html`(GitHub Pages 등 헤더 불가 호스팅), `vercel/vercel.json`(+`.vercelignore`), `netlify/netlify.toml`, `cloudflare/wrangler.jsonc`(+`.assetsignore`), `firebase/firebase.json`(+`.firebaserc`), `aws/deploy-s3.sh`·`aws/cloudformation-static-site.yaml`, `azure/staticwebapp.config.json`, `server/nginx.conf`·`server/Caddyfile`·`server/docker-compose.yml`·`server/.env.example`·`server/Dockerfile.node-server`, `fly/fly.toml`·`render/render.yaml`(가이드: `deploy/paas-node-hosting.md`), `github-pages/.github/workflows/deploy-pages.yml`.
- CSP 기본: 스크립트는 자기 사이트와 `cdn.jsdelivr.net`만, 글꼴은 jsDelivr·Google Fonts·`hangeul.pstatic.net`(마루부리), 프레임은 YouTube·Vimeo만. 다른 외부 임베드를 쓰면 `frame-src`에 추가.
- `file://`(ZIP)·LAN(http)에서는 CSP meta를 넣지 않거나 `upgrade-insecure-requests`를 뺍니다.
- 같은 주소 WebSocket은 대부분 브라우저에서 `'self'`로 허용되지만, 오래된 Safari 대비로 `wss://<도메인>`을 함께 적는 것을 권장 ⚠️.

---

## 11. 출처 (2026-11-09 확인)

- GitHub Pages 한도: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
- Cloudflare Workers 요금·한도·정적 자산: https://developers.cloudflare.com/workers/platform/pricing/ · https://developers.cloudflare.com/workers/platform/limits/ · https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/
- Cloudflare Workers Builds·Deploy 버튼: https://developers.cloudflare.com/workers/ci-cd/builds/ · https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/ · https://developers.cloudflare.com/workers/platform/deploy-buttons/
- Durable Objects 한도·위치: https://developers.cloudflare.com/durable-objects/platform/limits/ · https://developers.cloudflare.com/durable-objects/platform/pricing/ · https://developers.cloudflare.com/durable-objects/reference/data-location/
- Cloudflare Pages 한도·끌어 놓기: https://developers.cloudflare.com/pages/platform/limits/ · https://developers.cloudflare.com/pages/get-started/direct-upload/
- Cloudflare Quick Tunnel: https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/
- Supabase 요금·실시간·정지: https://supabase.com/pricing · https://supabase.com/docs/guides/realtime/limits · https://supabase.com/docs/guides/platform/manage-your-usage/realtime-messages · https://supabase.com/docs/guides/platform/project-pausing
- Apps Script 할당량: https://developers.google.com/apps-script/guides/services/quotas
- Vercel Hobby·Drop·공정 사용: https://vercel.com/docs/plans/hobby · https://vercel.com/docs/drop · https://vercel.com/docs/limits/fair-use-guidelines · https://vercel.com/docs/functions/websockets
- Netlify 크레딧·Drop: https://www.netlify.com/pricing/ · https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/ · https://www.netlify.com/blog/thirteen-years-of-netlify-drop
- Firebase 호스팅 사용량·요금·Storage 변경: https://firebase.google.com/docs/hosting/usage-quotas-pricing · https://firebase.google.com/pricing · https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024
- Deno Deploy 종료 예정: https://deno.com/blog/cloudflare
- AWS: https://aws.amazon.com/free/ · https://aws.amazon.com/cloudfront/pricing/ · https://aws.amazon.com/cloudfront/pricing/pay-as-you-go/ · https://aws.amazon.com/amplify/pricing/ · https://aws.amazon.com/lightsail/pricing/ · https://docs.aws.amazon.com/apprunner/latest/dg/apprunner-availability-change.html
- 그 밖: `docs/research/hosting.md`, `docs/research/2026-11-review.md`
