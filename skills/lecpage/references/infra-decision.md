# 인프라 결정 가이드 (어디에 올리고, 실시간은 무엇으로 할까)

> skill이 "배포·실시간" 단계에서 읽는 문서입니다. 순서: **1. 입력 모으기 → 2. 규칙 적용(§4 JSON) → 3. 경고 확인(§6) → 4. 교사에게 설명(§9) → 5. 해당 `deploy/*.md` 안내**.
> 숫자는 2026-11-09에 공식 페이지에서 확인했습니다(§11 출처). 확인 못 한 값은 ⚠️ 표시.
> 원칙: **강사가 직접 소유**(강사 계정·강사 서버), **비용 0원에 가깝게**, **학교망에서 끊겨도 화면은 살아 있게**.

---

## 1. 입력 (인터뷰에서 받는 값)

| 키 | 값 | 묻는 말(교사용) | 기본값 |
|---|---|---|---|
| `participants` | 정수 | 참여 인원은 몇 명인가요? | blueprint `audience.size` |
| `features` | `qa help progress board poll chat attendance reactions upload` 중 여러 개 | 연수 중에 질문 받기·도움 요청·진행 체크·투표·게시판이 필요한가요? | blueprint `live.features` (+ `board.allowFiles`면 `upload`) |
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
| `paid` | bool | 강사료 등 대가를 받는 연수인가요? (일부 무료 요금제 약관에 영향) | false |
| `siteMB` | 수 | (엔진이 계산) 빌드된 사이트 크기 | 빌드 결과 |
| `sharedRelay` | bool | (설정값) lecpage 운영자가 공용 중계 서버를 제공하는가 | false ⚠️ 현재 미정 |

파생 값
- `liveNeeded` = `features`가 비어 있지 않음. (`quiz`, `reflection`처럼 자기 기기 안에서 끝나는 것은 실시간이 아님 → `local`)
- `heavy` = `features`에 `chat`·`reactions`가 있거나, 참가자가 60명 넘게 동시에 실시간 갱신을 받음
- `transferGB` = `siteMB × participants × 3 ÷ 1024` (1인당 평균 3번 접속 가정, 연수 1회 기준)
- `wsBlocked` = `blocked`에 `websocket` 포함(check.html 결과)
- 강사 기기 2대(console, screen)는 참가자 수에 **더해서** 계산합니다.

---

## 2. 빠른 결론 표 (사람이 먼저 보는 표)

| 상황 | 정적 호스팅 | 실시간 | 월 비용 | 가이드 |
|---|---|---|---|---|
| 실시간 없음, 클릭만 | Cloudflare Pages 끌어 놓기 | none | 0원 | `deploy/cloudflare.md` |
| 실시간 없음, GitHub 씀 | GitHub Pages | none | 0원 | `deploy/github-pages.md` |
| 40명 이하, 질문·도움·진행·투표, 클릭만, 구글 계정 | Cloudflare Pages / GitHub Pages | Google Sheets + Apps Script | 0원 | `deploy/cloudflare.md` + backends/apps-script |
| 150명 이하, 실시간 다수, 회원가입 가능 | Cloudflare / GitHub Pages | Supabase(강사 소유, 서울 리전) | 0원 | `deploy/cloudflare.md` + backends/supabase |
| 150명 넘음·채팅·반응, 또는 여러 주 과정 | Cloudflare Workers 정적 자산 | Cloudflare DO 중계(강사 계정) | 0원(무료 한도 안) | `deploy/cloudflare.md` |
| 서버·NAS·VPS·학교 서버가 있음 | 같은 서버(Caddy/nginx) | node-server(Docker) | 기존 비용 | `deploy/own-server-nginx-caddy.md`, `deploy/nas-synology.md` |
| 인터넷이 없거나 심하게 막힘 | 강사 노트북(교실 LAN) | node-server(노트북) | 0원(+공유기) | `deploy/local-lan-classroom.md` |
| 실시간 필요 없고 인터넷도 없음 | USB·ZIP | none/local | 0원 | `deploy/zip-usb-offline.md` |
| 기관 AWS 계정 | S3 + CloudFront | Supabase 또는 Lightsail(서울) node-server | 0원~월 $5 | `deploy/aws-s3-cloudfront.md`, `deploy/aws-lightsail-docker.md` |
| 기관 Azure | Azure Static Web Apps(무료) | Supabase / node-server | 0원 | `deploy/azure-static-web-apps.md` |
| 학생(미성년) + 실명 | 학교 서버·NAS·노트북 | node-server(학교 안) 또는 local | 0원 | `deploy/local-lan-classroom.md` |

---

## 3. 결정 규칙 (사람이 읽는 순서)

실시간(live)을 먼저 정하고, 그 결과에 맞춰 정적 호스팅(static)을 고릅니다. 각 목록은 **위에서부터 처음 맞는 규칙 하나**만 씁니다. 그다음 §6 경고(guards)를 모두 검사합니다.

### 3.1 실시간(live)
1. **L01** 실시간 기능이 없다 → `none` (자기 기기 안 퀴즈·기록만 있으면 `local`).
2. **L02** 인터넷이 없다(`offline`) → `node-server`를 **강사 노트북**에서(교실 LAN). 노트북이 어렵다면 `local`.
3. **L03** 학생(미성년) + 실명 수집 → `node-server`(학교 서버·NAS·노트북). 서버가 없으면 `local` + "실명 대신 별명" 권고. **공용 중계 금지.**
4. **L04** 국내 보관 지침 → `supabase`(서울 `ap-northeast-2`) 또는 국내 서버의 `node-server`(Lightsail 서울, 학교 서버, NAS). Cloudflare DO는 한국 지정 불가(관할 지정은 EU·FedRAMP만).
5. **L05** Docker가 도는 서버(NAS·VPS·학교 서버)가 있고 `skill`이 basic 이상 → `node-server`.
6. **L06** WebSocket이 막힌 학교(`wsBlocked`) → `cf-relay`(SSE·폴링 자동 전환). 클릭만 가능하면 `sheets`(일반 HTTPS만 씀).
7. **L07** 참가자 180명 초과 → `cf-relay` (Supabase 무료 동시 연결 200 한도). 클릭만 가능하면 `cf-relay-shared`(제공될 때) 아니면 기능 축소.
8. **L08** `heavy`이면서 60명 초과 → `cf-relay` (Supabase 초당 100메시지 한도는 받는 사람 수만큼 셈).
9. **L09** 여러 주 과정(`course`) → `cf-relay`(잠자기 없음). 클릭만 가능하면 `sheets`.
10. **L10** 클릭만 가능 → 구글 계정이 있고 40명 이하·파일 올리기 없음이면 `sheets`, 아니면 `cf-relay-shared`(제공될 때) 또는 `sheets`(기능 축소).
11. **L11** 회원가입·복사 정도 가능(`basic`) → `supabase`.
12. **L12** 개발자(`dev`) → `cf-relay` (대안: `supabase`, `node-server`).

### 3.2 정적 호스팅(static)
1. **S01** `offline` → live가 `node-server`면 `lan`(노트북이 사이트도 같이 제공), 아니면 `zip`.
2. **S02** live가 `node-server` → 같은 서버(`server`: Caddy/nginx, `/api`를 같은 주소로).
3. **S03** live가 `cf-relay`이고 `skill`≠click → `cloudflare`(Workers 정적 자산, 같은 계정에서 관리).
4. **S04** 기관 AWS 계정 + basic 이상 → `aws-s3-cloudfront` (콘솔만 쓰려면 `aws-amplify`).
5. **S05** 기관 Azure 계정 + basic 이상 → `azure-swa`.
6. **S06** 클릭만 가능 → `cloudflare-pages-drop`(끌어 놓기). 대안: `netlify`(Drop, 로그인 필수), `github-pages`(웹 업로드).
7. **S07** GitHub를 쓴다 → `github-pages`.
8. **S08** 그 밖 → `cloudflare`.

---

## 4. 규칙 블록 (엔진이 그대로 옮겨 쓰는 JSON)

엔진(`engine/src/decide/`)은 아래 JSON을 그대로 옮겨 씁니다. 해석 규칙:
- `when`의 각 키는 **모두** 맞아야 합니다(AND). `$or`는 배열 중 하나라도 맞으면 참.
- 값 비교: 스칼라 = 같음, 배열 = 그중 하나, `{"gt":n}` `{"gte":n}` `{"lt":n}` `{"lte":n}`, 목록 입력에는 `{"any":[..]}` `{"all":[..]}` `{"none":[..]}`, 불리언 파생값은 `true/false`.
- `live` 목록 → 처음 맞는 규칙의 `pick`. 그다음 `static` 목록(키 `live`로 앞 결과 참조). 마지막에 `guards`는 **맞는 것 전부** 경고로 보여 줍니다(`level`: `block`이면 그 조합을 쓰면 안 됨 → `fix`의 대안으로 교체).
- `expr` 문자열은 사람이 읽는 계산식입니다. 엔진은 같은 의미의 함수로 구현합니다.

```json
{
  "schema": "lecpage.infra-rules/1",
  "checked": "2026-11-09",
  "derive": {
    "liveNeeded": "features ∩ {qa,help,progress,board,poll,chat,attendance,reactions,upload} ≠ ∅",
    "heavy": "features has chat|reactions OR participants > 60",
    "wsBlocked": "blocked has websocket",
    "transferGB": "siteMB * participants * 3 / 1024",
    "devices": "participants + 2"
  },
  "live": [
    {"id":"L01","when":{"liveNeeded":false},"pick":"none","alt":["local"]},
    {"id":"L02","when":{"network":"offline"},"pick":"node-server","place":"lan","alt":["local"]},
    {"id":"L03","when":{"minor":true,"realName":true,"$or":[{"infra":{"any":["docker-host","school-server","nas","vps","raspberry-pi","laptop"]}}]},"pick":"node-server","place":"school","alt":["local"]},
    {"id":"L03b","when":{"minor":true,"realName":true},"pick":"local","note":"실명 대신 별명으로 바꾸면 sheets/supabase도 가능"},
    {"id":"L04","when":{"keepInKorea":true,"skill":["basic","dev"]},"pick":"supabase","region":"ap-northeast-2","alt":["node-server"]},
    {"id":"L04b","when":{"keepInKorea":true},"pick":"node-server","place":"school","alt":["local"]},
    {"id":"L05","when":{"infra":{"any":["docker-host","school-server","nas","vps","raspberry-pi"]},"skill":["basic","dev"]},"pick":"node-server","place":"own"},
    {"id":"L06","when":{"wsBlocked":true,"skill":["basic","dev"]},"pick":"cf-relay","alt":["node-server"]},
    {"id":"L06b","when":{"wsBlocked":true},"pick":"sheets"},
    {"id":"L07","when":{"participants":{"gt":180},"skill":["basic","dev"]},"pick":"cf-relay","alt":["node-server"]},
    {"id":"L07b","when":{"participants":{"gt":180},"sharedRelay":true},"pick":"cf-relay-shared"},
    {"id":"L08","when":{"heavy":true,"participants":{"gt":60},"skill":["basic","dev"]},"pick":"cf-relay","alt":["node-server","supabase"]},
    {"id":"L09","when":{"duration":"course","skill":["basic","dev"]},"pick":"cf-relay","alt":["node-server","sheets"]},
    {"id":"L09b","when":{"duration":"course"},"pick":"sheets"},
    {"id":"L10","when":{"skill":"click","infra":{"any":["google"]},"participants":{"lte":40},"features":{"none":["upload","chat"]}},"pick":"sheets"},
    {"id":"L10b","when":{"skill":"click","sharedRelay":true},"pick":"cf-relay-shared"},
    {"id":"L10c","when":{"skill":"click"},"pick":"sheets","note":"기능 축소: upload·chat 끄고 폴링 10초"},
    {"id":"L11","when":{"skill":"basic"},"pick":"supabase","region":"ap-northeast-2","alt":["sheets","cf-relay"]},
    {"id":"L12","when":{},"pick":"cf-relay","alt":["supabase","node-server"]}
  ],
  "static": [
    {"id":"S01","when":{"network":"offline","live":"node-server"},"pick":"lan"},
    {"id":"S01b","when":{"network":"offline"},"pick":"zip"},
    {"id":"S02","when":{"live":"node-server"},"pick":"server"},
    {"id":"S03","when":{"live":"cf-relay","skill":["basic","dev"]},"pick":"cloudflare"},
    {"id":"S04","when":{"infra":{"any":["aws"]},"skill":["basic","dev"]},"pick":"aws-s3-cloudfront","alt":["aws-amplify"]},
    {"id":"S05","when":{"infra":{"any":["azure"]},"skill":["basic","dev"]},"pick":"azure-swa"},
    {"id":"S06","when":{"skill":"click"},"pick":"cloudflare-pages-drop","alt":["netlify","github-pages"]},
    {"id":"S07","when":{"infra":{"any":["github"]}},"pick":"github-pages","alt":["cloudflare"]},
    {"id":"S08","when":{},"pick":"cloudflare","alt":["github-pages","netlify"]}
  ],
  "guards": [
    {"id":"G01","when":{"hostDomainBlocked":true},"level":"block","warn":"학교망이 호스팅 기본 주소(*.github.io, *.pages.dev 등)를 막음","fix":"customDomain 연결 또는 다른 호스팅 / IT 담당자에게 허용 요청(deploy/school-network-checklist.md)"},
    {"id":"G02","when":{"static":"firebase","expr":"transferGB > 0.3"},"level":"block","warn":"Firebase Spark 호스팅 전송 360MB/일 초과 예상","fix":"cloudflare 또는 github-pages"},
    {"id":"G03","when":{"static":"vercel","paid":true},"level":"block","warn":"Vercel Hobby는 비상업 개인 용도만(강사료 받는 연수는 회색지대)","fix":"cloudflare 또는 github-pages"},
    {"id":"G04","when":{"static":"netlify","expr":"transferGB*20 + deploys*15 > 250"},"level":"warn","warn":"Netlify 무료 300크레딧/월 근접. 다 쓰면 계정의 모든 사이트가 멈춤","fix":"배포 횟수 줄이기(1회=15크레딧) 또는 cloudflare"},
    {"id":"G05","when":{"static":"render","expr":"transferGB*sessionsPerMonth > 5"},"level":"warn","warn":"Render Hobby 대역폭 월 5GB 포함","fix":"cloudflare"},
    {"id":"G06","when":{"static":"azure-swa","siteMB":{"gt":240}},"level":"block","warn":"Azure SWA 무료: 환경당 250MB","fix":"슬라이드 화질 낮추기 또는 cloudflare"},
    {"id":"G07","when":{"static":"github-pages","siteMB":{"gt":900}},"level":"block","warn":"GitHub Pages 사이트 1GB 한도","fix":"슬라이드 화질 낮추기 또는 cloudflare(파일당 25MiB, 2만 개)"},
    {"id":"G08","when":{"static":"cloudflare-pages-drop","expr":"fileCount > 1000"},"level":"block","warn":"끌어 놓기 업로드는 1,000개 파일까지","fix":"wrangler CLI(2만 개) 또는 ZIP 정리"},
    {"id":"G09","when":{"live":"supabase","expr":"devices > 190"},"level":"block","warn":"Supabase 무료 실시간 동시 연결 200","fix":"cf-relay"},
    {"id":"G10","when":{"live":"supabase","expr":"broadcastsPerSec * (participants + 1) > 80"},"level":"warn","warn":"Supabase 무료 초당 100메시지(받는 사람마다 1개로 셈). 넘으면 연결이 끊김","fix":"반응(reactions) 2초 묶음 전송, 참가자 화면은 필요한 채널만 구독"},
    {"id":"G11","when":{"live":"supabase","participants":{"gt":25}},"level":"warn","warn":"익명 로그인은 IP당 시간당 30회(기본). 학교는 모두 같은 공인 IP라 31번째부터 실패","fix":"Supabase 대시보드 → Authentication → Rate Limits에서 익명 로그인 한도를 참가자×2 이상으로"},
    {"id":"G12","when":{"live":"supabase","duration":["multi","course"]},"level":"warn","warn":"무료 프로젝트는 7일간 활동이 적으면 일시 정지","fix":"연수 2~3일 전 대시보드 열기 + check.html 실행. 정지되면 대시보드에서 Resume(1년 안)"},
    {"id":"G13","when":{"live":"supabase"},"level":"info","warn":"무료 프로젝트는 계정당 2개까지(정지된 것 제외)","fix":"연수 끝나면 데이터 지우고 프로젝트 정지·삭제"},
    {"id":"G14","when":{"live":["cf-relay","cf-relay-shared"],"expr":"participants * (3600/pollSec) * hours > 80000"},"level":"warn","warn":"WebSocket이 막혀 폴링으로 돌면 Workers 무료 10만 요청/일을 넘을 수 있음(09:00 KST 초기화)","fix":"폴링 간격 10~15초, 또는 node-server"},
    {"id":"G15","when":{"live":"sheets","participants":{"gt":40}},"level":"warn","warn":"Apps Script는 사용자당 동시 실행 30개. 많은 인원이 짧은 간격으로 부르면 실패","fix":"폴링 10초 이상, 기능 축소, 또는 supabase"},
    {"id":"G16","when":{"live":"sheets","features":{"any":["upload"]}},"level":"block","warn":"Sheets 백엔드는 파일 올리기 미지원","fix":"게시판은 외부 링크(패들렛 등)로, 또는 supabase"},
    {"id":"G17","when":{"live":"node-server","place":"lan"},"level":"warn","warn":"학교 와이파이는 기기끼리 통신을 막는 경우가 많음(AP 격리). 휴대폰 핫스폿은 동시 접속 수가 적음","fix":"전용 공유기 준비(deploy/local-lan-classroom.md)"},
    {"id":"G18","when":{"live":"cf-relay-shared"},"level":"warn","warn":"운영자 서버에 데이터가 저장됨 → privacy.processors에 운영자 표기, 미성년 실명 금지","fix":"강사 소유 cf-relay로 전환 가능"},
    {"id":"G19","when":{"wsBlocked":true,"live":"supabase"},"level":"warn","warn":"Supabase 실시간은 WebSocket 필요","fix":"어댑터 폴링 모드 확인, 안 되면 cf-relay/node-server(SSE·폴링)"},
    {"id":"G20","when":{"blocked":{"any":["cdn.jsdelivr.net","fonts.googleapis.com","fonts.gstatic.com"]}},"level":"warn","warn":"글꼴·라이브러리 CDN 차단","fix":"글꼴·라이브러리를 사이트 안에 포함(자체 호스팅). 시스템 글꼴로도 내용은 보임"},
    {"id":"G21","when":{"minor":true,"live":["sheets","supabase","cf-relay","cf-relay-shared"]},"level":"warn","warn":"만 14세 미만 개인정보는 법정대리인 동의 필요","fix":"별명만 받기(realName=false), 보관 기간 짧게, 연수 뒤 즉시 삭제"},
    {"id":"G22","when":{"static":["github-pages","cloudflare","netlify","vercel"],"expr":"repoOrUploadContains(adminKey|service_role)"},"level":"block","warn":"관리자 키·서비스 키가 공개 파일에 들어감","fix":"키는 사이트에 넣지 않음(서버엔 SHA-256만). Supabase는 anon/publishable 키만"}
  ],
  "hosts": {
    "cloudflare-pages-drop": {"target":"cloudflare","guide":"deploy/cloudflare.md#끌어-놓기","headers":"_headers","cost":"0","limits":"끌어 놓기 1,000파일·25MiB/파일, 정적 요청 무제한","domain":"*.pages.dev"},
    "cloudflare":   {"target":"cloudflare","guide":"deploy/cloudflare.md","template":"templates/deploy/cloudflare/","headers":"_headers","cost":"0","limits":"2만 파일·25MiB/파일, 정적 요청 무료·무제한","domain":"*.workers.dev / *.pages.dev"},
    "github-pages": {"target":"github-pages","guide":"deploy/github-pages.md","template":"templates/deploy/github-pages/","headers":"meta","cost":"0","limits":"사이트 1GB, 월 100GB(권고), 무료는 공개 저장소","domain":"*.github.io"},
    "netlify":      {"target":"netlify","guide":"deploy/netlify.md","template":"templates/deploy/netlify/","headers":"_headers","cost":"0","limits":"월 300크레딧(배포 15, GB당 20, 1만 요청당 2)","domain":"*.netlify.app"},
    "vercel":       {"target":"vercel","guide":"deploy/vercel.md","template":"templates/deploy/vercel/","headers":"vercel.json","cost":"0","limits":"비상업만, 월 100GB·CDN 요청 100만","domain":"*.vercel.app"},
    "firebase":     {"target":"firebase","guide":"deploy/firebase.md","template":"templates/deploy/firebase/","headers":"firebase.json","cost":"0","limits":"저장 10GB, 전송 360MB/일","domain":"*.web.app"},
    "aws-s3-cloudfront": {"target":"s3","guide":"deploy/aws-s3-cloudfront.md","template":"templates/deploy/aws/","headers":"cloudfront-policy","cost":"0~소액","limits":"CloudFront 종량제 상시 무료 월 1TB","domain":"*.cloudfront.net"},
    "aws-amplify":  {"target":"s3","guide":"deploy/aws-amplify.md","headers":"amplify-console","cost":"GB당 $0.15 전송","domain":"*.amplifyapp.com"},
    "azure-swa":    {"target":"server","guide":"deploy/azure-static-web-apps.md","template":"templates/deploy/azure/","headers":"staticwebapp.config.json","cost":"0","limits":"월 100GB, 환경당 250MB, 도메인 2개","domain":"*.azurestaticapps.net"},
    "render":       {"target":"server","guide":"deploy/render.md","template":"templates/deploy/render/","headers":"render.yaml","cost":"0(정적)","limits":"월 5GB 대역폭(Hobby)","domain":"*.onrender.com"},
    "server":       {"target":"server","guide":"deploy/own-server-nginx-caddy.md","template":"templates/deploy/server/","headers":"Caddyfile/nginx.conf","cost":"기존 서버"},
    "nas":          {"target":"server","guide":"deploy/nas-synology.md","template":"templates/deploy/server/","headers":"Caddyfile","cost":"기존 NAS"},
    "lan":          {"target":"server","guide":"deploy/local-lan-classroom.md","template":"templates/deploy/server/","headers":"Caddyfile","cost":"0(+공유기)"},
    "zip":          {"target":"zip","guide":"deploy/zip-usb-offline.md","headers":"none","cost":"0"}
  },
  "backends": {
    "none":            {"provider":"none"},
    "local":           {"provider":"local","note":"기기 안에만 저장(localStorage)"},
    "sheets":          {"provider":"sheets","code":"backends/apps-script/","origins":["https://script.google.com","https://script.googleusercontent.com"],"limits":"동시 실행 30/사용자, 실행당 6분"},
    "supabase":        {"provider":"supabase","code":"backends/supabase/","origins":["https://<ref>.supabase.co","wss://<ref>.supabase.co"],"limits":"동시 200, 초당 100메시지, 월 200만 메시지, DB 500MB, 파일 1GB, 7일 비활성 정지"},
    "cf-relay":        {"provider":"http","code":"backends/cloudflare/","origins":["https://<name>.<sub>.workers.dev","wss://<name>.<sub>.workers.dev"],"limits":"요청 10만/일(정적 제외), DO 요청 10만/일·13,000GB-s/일, 들어오는 WS 메시지 20:1"},
    "cf-relay-shared": {"provider":"http","origins":["{{SHARED_RELAY_ORIGIN}}"],"note":"⚠️ 운영자 제공 여부 미정"},
    "node-server":     {"provider":"http","code":"backends/node-server/","origins":["'self'"],"limits":"서버 성능만큼"}
  }
}
```

---

## 5. 선택지 카탈로그

### 5.1 정적 호스팅 (사이트 파일을 올리는 곳)

| 선택지 | 무료 범위(2026-11 확인) | 상업 이용 | 내 도메인·HTTPS | 난이도 | 실패하는 경우 | 가이드 |
|---|---|---|---|---|---|---|
| **Cloudflare Pages(끌어 놓기)** | 정적 요청 무료·무제한, 1,000파일/25MiB(끌어 놓기) | 가능 | ✓ / 자동 | ★ | 끌어 놓기로 만든 프로젝트는 나중에 Git 연결로 못 바꿈 | `deploy/cloudflare.md` |
| **Cloudflare Workers 정적 자산** | 정적 요청 무료·무제한, 2만 파일 | 가능 | ✓ / 자동 | ★★ | Workers 무료 요청 한도는 실시간 중계에만 해당 | `deploy/cloudflare.md` |
| **GitHub Pages** | 사이트 1GB, 월 100GB(권고), 시간당 10회 빌드(Actions는 예외) | 상업 SaaS·온라인 사업 금지 | ✓ / 자동 | ★★ | 무료 계정은 공개 저장소만, 헤더 설정 불가(CSP는 meta) | `deploy/github-pages.md` |
| **Netlify(+Drop)** | 월 300크레딧(배포 1회 15, GB당 20) | 가능 | ✓ / 자동 | ★ | 크레딧 소진 시 **계정의 모든 사이트 정지**, 새 프로젝트는 비공개로 시작 | `deploy/netlify.md` |
| **Vercel Hobby** | 월 100GB 전송, CDN 요청 100만 | **비상업 개인만** | ✓ / 자동 | ★★ | 한도 넘으면 30일 기다림, 강사료 연수는 회색지대 | `deploy/vercel.md` |
| **Firebase Hosting(Spark)** | 저장 10GB, **전송 360MB/일** | 가능 | ✓ / 자동 | ★★★ | 슬라이드 많은 사이트는 하루 한도 초과 | `deploy/firebase.md` |
| **AWS S3+CloudFront** | CloudFront 종량제 상시 무료 월 1TB·요청 1천만 ⚠️(요청 수는 2차 출처) | 가능 | ✓ / ACM | ★★★ | 신규 계정 무료 플랜은 6개월 뒤 닫힘, 설정 실수로 과금 | `deploy/aws-s3-cloudfront.md` |
| **AWS Amplify Hosting** | 신규 계정은 크레딧, 이후 GB당 $0.15 | 가능 | ✓ / 자동 | ★★ | 트래픽 많으면 S3+CF보다 비쌈 | `deploy/aws-amplify.md` |
| **Azure Static Web Apps(Free)** | 월 100GB, 환경당 250MB, 도메인 2개 | 가능 | ✓ / 자동 | ★★ | 사이트 250MB 초과 불가 | `deploy/azure-static-web-apps.md` |
| **Render(정적)** | Hobby 월 5GB 대역폭 | 가능 | ✓ / 자동 | ★★ | 대역폭 작음 | `deploy/render.md` |
| **Surge** | 무료, 내 도메인·인증서 포함, 프로젝트 450MB/10,100파일 | 가능 | ✓ / 자동 | ★★(CLI) | 헤더 설정 불가(Pro만 라우터) | (research 참고) |
| **Tiiny 류 드롭 호스팅** | ⚠️ 무료 1개·3MB·기간 제한(출처마다 다름) | 유료 플랜 유도 | 유료 | ★ | 슬라이드 사이트는 용량 초과 | 비권장 |
| **Google Cloud Run** | 요청 200만/월 등(컨테이너) | 가능 | ✓ | ★★★★ | 결제 계정 필수, 정적만이면 과함 | (research 참고) |
| **네이버 클라우드 Object Storage** | 무료 없음(종량) | 가능 | Global Edge 연동 시 HTTPS | ★★★ | 웹사이트 엔드포인트는 HTTP만 | (research 참고) |
| **카페24·가비아 웹호스팅** | ⚠️ 월 수백~수천 원대(가격 미확인) | 가능 | 상품별 | ★★(FTP) | 오래된 PHP 호스팅, WebSocket 불가 | (research 참고) |
| **학교·교육청 서버** | 기관 | 기관 규정 | 기관 | IT 담당자 | 업로드 권한 없음이 보통 | `deploy/own-server-nginx-caddy.md` |
| **개인 서버·VPS** | 서버 비용 | 가능 | Caddy 자동 | ★★★ | 서버 관리 책임 | `deploy/own-server-nginx-caddy.md` |
| **NAS(Synology)** | 기존 장비 | 가능 | DDNS+Let's Encrypt | ★★★ | 공유기 포트 열기·집 회선 속도 | `deploy/nas-synology.md` |
| **라즈베리 파이** | 기존 장비 | 가능 | LAN이면 불필요 | ★★★ | SD카드 고장 → 백업 필수 | `deploy/local-lan-classroom.md` |
| **강사 노트북(교실 LAN)** | 0원 | — | http(내부망) | ★★ | AP 격리, 노트북 절전 | `deploy/local-lan-classroom.md` |
| **USB·ZIP** | 0원 | — | 없음(file://) | ★ | 실시간 불가, 아이패드에서 열기 어려움 | `deploy/zip-usb-offline.md` |

### 5.2 실시간 백엔드

| 선택지 | 누가 소유 | 무료 범위(2026-11 확인) | 잘 맞는 경우 | 실패하는 경우 → 대처 |
|---|---|---|---|---|
| **none** | — | — | 읽기 전용 연수 | — |
| **local** | 참가자 기기 | — | 자기 진도 체크·기록 | 기기 바꾸면 사라짐 → 내려받기 버튼 |
| **Google Sheets + Apps Script** | 강사 구글 계정 | 동시 실행 30/사용자, 실행당 6분, URL Fetch 2만/일 | 40명 이하, 질문·도움·진행·투표 | 학교 관리 계정은 "모든 사용자" 배포가 막힐 수 있음 ⚠️ → 개인 gmail 계정 |
| **Supabase** | 강사 Supabase 계정(서울 리전 가능) | 활성 프로젝트 2개, DB 500MB, 파일 1GB, 전송 5GB, 실시간 동시 200·초당 100·월 200만 메시지 | 150명 이하 대부분의 기능 | 7일 비활성 정지 → 연수 전 열기 / 익명 로그인 30회/시/IP → 한도 올리기 / 메시지 폭주 → 반응 묶기 |
| **Cloudflare DO 중계(강사 계정)** | 강사 Cloudflare 계정 | Workers 요청 10만/일(00:00 UTC=09:00 KST 초기화), DO 요청 10만/일·13,000GB-s/일·SQLite 5GB, 들어오는 WS 메시지 20개=요청 1개 | 큰 인원, 채팅·반응, 여러 주 과정, WS 막힌 학교(SSE·폴링) | 폴링이 길게 돌면 요청 한도 → 간격 늘리기 / 한도 초과 시 오류 1027 → 다음 날 09시까지 |
| **Cloudflare DO 중계(운영자 공용)** ⚠️ 제공 미정 | lecpage 운영자 | 운영자 유료 플랜 | 클릭만 가능한 강사 | 제3자 보관 → 개인정보 안내에 운영자 표기, 미성년 실명 금지 |
| **node-server(Docker)** | 강사·학교 서버 | 서버 성능만큼 | 학교 서버, NAS, VPS, 노트북 LAN, 국내 보관 | 서버 꺼지면 끝 → 연수 전 점검, 데이터 폴더 백업 |
| Firebase(RTDB/Firestore) | 강사 구글 계정 | RTDB 동시 100, Firestore 읽기 5만/일; **Storage는 Blaze 필수** | (어댑터 없음) | lecpage 어댑터 미지원 → supabase 권장 |
| PocketBase | 자체 서버 | 오픈소스(SQLite, 실시간 SSE) | 자체 서버 대안 | 1.0 전이라 호환성 보장 안 됨, 어댑터 없음 → node-server 권장 |
| Appwrite Cloud / Convex | 각 서비스 계정 | Appwrite: 한도 넘으면 프로젝트 동결 / Convex: 함수 호출 100만/월 | (어댑터 없음) | 참고만 |

### 5.3 조합할 때 지켜야 할 것
- **주소(origin)** : 정적 호스팅 주소와 실시간 주소가 다르면 CSP `connect-src`에 실시간 주소를 넣습니다(§10). node-server를 같은 서버에 두면 `'self'`로 끝납니다.
- **CORS** : Supabase·Apps Script는 기본 허용. node-server는 `LEC_ORIGINS`(비우면 모두 허용), cf-relay는 백엔드 설정의 허용 목록에 사이트 주소를 넣습니다.
- **비밀값** : 관리자 키는 사이트에 넣지 않습니다(서버엔 SHA-256만). Supabase는 anon(publishable) 키만 사이트에. `service_role` 키는 절대 금지.

---

## 6. 용량 계산 (숫자로 확인하기)

| 계산 | 식 | 예: 40명, 사이트 30MB, 90분 |
|---|---|---|
| 정적 전송량(연수 1회) | `siteMB × 인원 × 3` | 30×40×3 = 3.6GB → Firebase Spark(360MB/일) ✗, 나머지 ✓ |
| Netlify 크레딧 | `전송GB×20 + 배포횟수×15 + 요청/1만×2` | 3.5×20 + 10×15 + 1 ≈ 221 / 300 → 아슬아슬 |
| Supabase 초당 메시지 | `초당 방송 수 × (인원+1)` | 반응을 그대로 보내면 1회 = 41메시지 → 초당 2번만 넘어도 위험. 2초 묶음이면 안전 |
| Supabase 월 메시지 | `방송 수 × (받는 사람+1)` | 90분 동안 3초마다 상태 갱신 = 1,800 × 41 ≈ 7.4만 → 월 200만 한도의 4% |
| Workers 요청(폴링 시) | `인원 × 3600/폴링초 × 시간` | 40×360×1.5 = 21,600 (5초) / WS면 연결 1회+보낸 메시지/20 |
| Apps Script 동시 실행 | `인원 ÷ 폴링초 × 평균 실행초` | 40÷10×0.7 ≈ 3 (한도 30) / 120명·5초면 ≈ 17 → 위험 |
| DO 실행 시간 | `연결 유지 시간 × 0.125GB` (깨어 있는 동안) | 2시간 = 900GB-s (한도 13,000/일) |

슬라이드가 많으면 엔진의 슬라이드 화질(WebP 품질·가로 폭)을 낮추는 것이 가장 효과가 큽니다(1장 150KB 안팎 권장).

---

## 7. 실패 모드와 대처

| 증상 | 원인 | 미리 막기 | 그날 대처 |
|---|---|---|---|
| 30명쯤부터 입장이 안 됨(Supabase) | 익명 로그인 IP당 30회/시, 학교는 공인 IP 하나 | 대시보드 → Authentication → Rate Limits → 익명 로그인 한도 상향 | 한도 바로 올리기(즉시 반영) / 어댑터가 익명 로그인 없이 join하도록 설정 |
| 접속은 되는데 실시간이 안 됨 | 학교망 WebSocket 차단, TLS 검사 장비 | check.html로 사전 확인 | http 어댑터는 SSE→폴링 자동 전환. Supabase는 폴링 모드 ⚠️ |
| "프로젝트가 일시 정지됨" | Supabase 무료 7일 비활성 | 연수 2~3일 전 대시보드 열기 + check.html | 대시보드 → Resume(몇 분 걸림) → 그동안 local 모드로 진행 |
| 오후에 갑자기 실시간 중단(Cloudflare) | 무료 일일 한도(오류 1027), 폴링 과다 | 폴링 간격 10초 이상, WS 우선 | 09:00 KST에 초기화. 급하면 Workers Paid($5/월) |
| 사이트가 아예 안 열림 | 학교 필터가 `*.github.io`·`*.pages.dev` 등 차단 | 내 도메인 연결, IT에 허용 요청 | 휴대폰 데이터로 접속 안내 / ZIP 배포 |
| 글꼴이 깨지거나 효과가 안 나옴 | jsDelivr·Google Fonts 차단 | 글꼴 자체 호스팅 | 시스템 글꼴로도 내용은 보임(설계 원칙) |
| 사이트가 "Site not available"(Netlify) | 월 크레딧 소진 → 계정 전체 정지 | 배포 횟수 줄이기, 큰 사이트는 Cloudflare | 다른 호스팅에 즉시 재배포(5분) |
| Vercel에서 한도 초과 | Hobby 한도, 30일 대기 | 큰 사이트는 Cloudflare | 다른 호스팅 |
| 노트북 서버에 아무도 못 붙음 | 와이파이 AP 격리, 방화벽 | 전용 공유기, 방화벽 허용 | 노트북을 핫스폿으로(10명 안팎) |
| 질문이 늦게 뜸(Sheets) | Apps Script 동시 실행 한도·지연 | 폴링 10초, 40명 이하 | 화면에 "새로고침" 안내 |
| 업로드 실패(Supabase) | 파일 1GB, 파일당 크기 | 이미지 줄이기(엔진이 리사이즈) | 링크로 공유 |

---

## 8. 개인정보·미성년자 (요약, 법률 자문 아님 ⚠️)

- **별명만 받기**가 기본입니다. 이름·학교는 이수 처리에 꼭 필요할 때만.
- 만 14세 미만의 개인정보를 받으려면 법정대리인 동의가 필요합니다(개인정보 보호법). 학생 대상이면 **별명만 + 연수 뒤 즉시 삭제**.
- 해외 서버(Supabase 서울 외 리전, Cloudflare, Google)에 개인정보를 두면 개인정보 처리 안내(privacy.html)에 **처리 위탁·국외 이전** 사실(업체, 국가, 항목, 기간)을 적습니다. → blueprint `privacy.processors`.
- 국내 보관이 필요하면: Supabase 서울(`ap-northeast-2`), AWS Lightsail 서울, 네이버 클라우드, 학교 서버·NAS·노트북.
- 연수가 끝나면: CSV 내보내기 → `purge()`(콘솔의 "전부 삭제") → 프로젝트·서버 정리. 각 가이드의 "연수가 끝난 뒤"를 따릅니다.

---

## 9. 교사에게 설명하는 말 (추천별 대본)

짧게, 무엇을 하는지·돈·주의점 순서로 말합니다.

**A. Cloudflare Pages 끌어 놓기 + 실시간 없음**
> "연수 사이트를 Cloudflare라는 무료 서비스에 올릴게요. 회원가입하고, 만들어 드린 폴더를 끌어다 놓기만 하면 주소가 생깁니다. 비용은 없고, 참가자가 많아도 괜찮아요. 선생님 계정이라 나중에 지우는 것도 선생님이 직접 하실 수 있어요."

**B. GitHub Pages + 실시간 없음**
> "GitHub 저장소에 사이트 파일을 올리면 GitHub가 무료로 사이트를 열어 줍니다. 저장소는 공개라서 사이트 파일도 누구나 볼 수 있어요. 비밀번호 같은 건 들어가지 않으니 걱정하지 않으셔도 됩니다."

**C. Google Sheets(Apps Script) 실시간**
> "질문·도움 요청은 선생님 구글 스프레드시트에 쌓이게 할게요. 시트 하나 만들고, 붙여 넣을 코드 한 덩어리와 '배포' 버튼만 누르시면 됩니다. 40명 정도까지 잘 맞고, 화면은 5~10초마다 새로 고쳐져요. 끝나면 시트를 지우면 기록도 사라집니다."

**D. Supabase 실시간**
> "Supabase라는 무료 데이터베이스를 선생님 이름으로 하나 만들게요. 서울 서버를 고를 수 있어요. 질문·투표가 바로바로 뜹니다. 두 가지만 기억해 주세요. 일주일 넘게 안 쓰면 잠들어서 연수 2~3일 전에 한 번 열어 주셔야 하고, 학교에서 30명 넘게 들어오면 설정에서 '익명 로그인 한도'를 올려야 해요. 제가 순서대로 안내해 드릴게요."

**E. Cloudflare 중계(DO) + Cloudflare 사이트**
> "사이트와 실시간 서버를 둘 다 선생님 Cloudflare 계정에 올릴게요. 인원이 많거나 채팅·반응을 쓰셔도 무료 범위 안에서 충분합니다. 무료 한도는 매일 오전 9시에 다시 채워져요. 명령어 몇 줄이 필요해서 제가 그대로 복사할 수 있게 드릴게요."

**F. 운영자 공용 중계** ⚠️
> "설치 없이 lecpage가 운영하는 실시간 서버를 빌려 쓰는 방법이에요. 가장 쉽지만 기록이 lecpage 서버에 잠시 저장되므로 개인정보 안내에 적어 둘게요. 학생 이름은 받지 않는 게 좋아요."

**G. 학교 서버·NAS·VPS(node-server + Caddy)**
> "선생님(학교) 서버에 사이트와 실시간 서버를 한 번에 띄우는 설정 파일을 드릴게요. 기록이 학교 안 서버에만 남아서 개인정보 면에서 가장 안전합니다. 서버 담당자께 '도커 컴포즈 파일 하나 실행'이라고 전하시면 됩니다."

**H. 교실 LAN(노트북 서버)**
> "학교 인터넷이 막혀도 되도록 선생님 노트북을 서버로 쓸게요. 작은 공유기 하나를 켜고 참가자들이 그 와이파이에 붙은 뒤 화면의 QR을 찍으면 됩니다. 인터넷이 없어도 질문·투표가 돼요. 노트북 절전만 꺼 주세요."

**I. USB·ZIP**
> "인터넷 없이도 볼 수 있게 사이트를 ZIP 파일로 드릴게요. 압축을 풀고 index.html을 두 번 누르면 열립니다. 이 방식에서는 질문·투표 같은 실시간 기능은 쓸 수 없어요."

**J. AWS(S3+CloudFront)**
> "기관 AWS 계정에 사이트를 올리는 설정 파일과 명령어를 드릴게요. 한 달 1TB까지는 전송 비용이 무료라 보통 0원이고, 저장 비용은 몇십 원 수준입니다. 연수 뒤에 지우는 명령어도 같이 드릴게요."

**K. Netlify Drop(빠른 미리 보기)**
> "지금 바로 모양을 확인하려고 Netlify에 끌어다 놓을게요. 로그인하지 않으면 한 시간 뒤 사라지니, 계속 쓰려면 로그인해서 '내 것으로' 저장하고 '공개'를 눌러 주세요."

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

- 파일: `_headers`(Cloudflare·Netlify 공용), `csp-meta.html`(GitHub Pages 등 헤더 불가 호스팅), `vercel/vercel.json`(+`.vercelignore`), `netlify/netlify.toml`, `cloudflare/wrangler.jsonc`(+`.assetsignore`), `firebase/firebase.json`(+`.firebaserc`), `aws/deploy-s3.sh`·`aws/cloudformation-static-site.yaml`, `azure/staticwebapp.config.json`, `server/nginx.conf`·`server/Caddyfile`·`server/docker-compose.yml`·`server/.env.example`·`server/Dockerfile.node-server`, `fly/fly.toml`, `render/render.yaml`, `github-pages/.github/workflows/deploy-pages.yml`.
- CSP 기본: 스크립트는 자기 사이트와 `cdn.jsdelivr.net`만, 글꼴은 jsDelivr·Google Fonts·`hangeul.pstatic.net`(마루부리), 프레임은 YouTube·Vimeo만. 다른 외부 임베드를 쓰면 `frame-src`에 추가.
- `file://`(ZIP)·LAN(http)에서는 CSP meta를 넣지 않거나 `upgrade-insecure-requests`를 뺍니다.
- 같은 주소 WebSocket은 대부분 브라우저에서 `'self'`로 허용되지만, 오래된 Safari 대비로 `wss://<도메인>`을 함께 적는 것을 권장 ⚠️.

---

## 11. 출처 (2026-11-09 확인)

- GitHub Pages 한도: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
- Cloudflare Workers 요금·한도: https://developers.cloudflare.com/workers/platform/pricing/ · https://developers.cloudflare.com/workers/platform/limits/
- Durable Objects 한도·위치: https://developers.cloudflare.com/durable-objects/platform/limits/ · https://developers.cloudflare.com/durable-objects/reference/data-location/
- Cloudflare Pages 한도·끌어 놓기: https://developers.cloudflare.com/pages/platform/limits/ · https://developers.cloudflare.com/pages/get-started/direct-upload/
- Supabase 요금·실시간·인증 한도·정지: https://supabase.com/pricing · https://supabase.com/docs/guides/realtime/limits · https://supabase.com/docs/guides/platform/manage-your-usage/realtime-messages · https://supabase.com/docs/guides/auth/rate-limits · https://supabase.com/docs/guides/platform/project-pausing
- Apps Script 할당량: https://developers.google.com/apps-script/guides/services/quotas
- Vercel Hobby·공정 사용: https://vercel.com/docs/plans/hobby · https://vercel.com/docs/limits/fair-use-guidelines · https://vercel.com/docs/functions/websockets
- Netlify 크레딧: https://www.netlify.com/pricing/ · https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/
- Firebase 요금·Storage 변경: https://firebase.google.com/pricing · https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024
- AWS: https://aws.amazon.com/free/ · https://aws.amazon.com/cloudfront/pricing/ · https://aws.amazon.com/cloudfront/pricing/pay-as-you-go/ · https://aws.amazon.com/amplify/pricing/ · https://aws.amazon.com/lightsail/pricing/ · https://docs.aws.amazon.com/apprunner/latest/dg/apprunner-availability-change.html
- 그 밖: `docs/research/hosting.md`
