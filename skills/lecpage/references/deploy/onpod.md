# Onpod에 올리기

> 한국 서비스(주식회사 AI3)입니다. `publish work --host onpod` 한 번으로 `https://<이름>.onpod.ai`에 **사이트만** 올립니다. 한국어 화면·국내 리전, 카드 없이 무료.
> 2026-11-13 확인. 근거는 `docs/research/hosting-2026-11.md` §12. 실제 계정·배포로는 시험하지 않았습니다(가짜 CLI로 순서만 시험) ⚠️.

## 언제 고르나요
| 고릅니다 | 고르지 않습니다 → 대신 |
|---|---|
| 강사가 이미 Onpod을 쓰거나 `ONPOD_TOKEN`이 있음(강사가 더 할 일 없음) | 처음 올리는데 가장 빨리 → Cloudflare(가입·로그인 승인 2번, Onpod은 키를 만들어 건네야 해서 약 4번) |
| 한국 회사·한국어 화면을 원함 | 질문·투표 중계까지 한 계정에 → `publish work --host cloudflare --live` |
| 내 도메인을 무료로 붙이고 싶음(apex도 됨) | 사이트 100MB·파일 50MB·5,000개를 넘음 → Cloudflare·GitHub Pages |
| | 강사가 사이트를 계정당 10개 넘게 이미 올려 둠 → 안 쓰는 사이트를 지우거나 Cloudflare |
| | **앱(브라우저만)에서 올리기** → 못 합니다. Onpod API가 다른 사이트의 요청을 막습니다. 앱은 Vercel·GitHub Pages·Cloudflare ZIP |

## 비용과 한도 (무료 정적 사이트, 0원)
| 항목 | 한도 |
|---|---|
| 사이트 수 | 계정당 10개(11번째부터 결제가 켜진 계정은 사이트당 월 약 5,000원) |
| 크기 | 사이트 100MB, 파일 하나 50MB, 한 번에 5,000개 |
| 전송 | 월 100GB. 넘으면 **그달은 멈췄다가 다음 달 1일에 다시 열림**(요금이 붙지 않음) |
| 쉬는 사이트 | 지운다는 규정은 문서에 없음 ⚠️ |
| 다시 배포 | 같은 이름이면 무중단 교체. 그림·글꼴을 같은 파일 이름으로 바꾸면 최대 1시간 옛것이 보임 |

- 주소 이름은 **Onpod 전체에서 하나뿐**입니다. 이미 쓰이면 `--name`으로 바꿉니다.
- 출처: https://console.onpod.ai/docs/website · https://api.onpod.ai/v1/manual?brief=1 · https://console.onpod.ai/terms

## 키 (강사가 만듭니다)
1. https://console.onpod.ai/signup 에서 구글 계정으로 가입합니다(카드 없음).
2. 콘솔의 **API 키** 화면에서 키를 만들고 복사합니다(`op_u_…` 또는 `opk_…`).
3. 이 컴퓨터의 환경 변수 `ONPOD_TOKEN`에 넣습니다(또는 터미널에서 `onpod login --token <키>`). 대화에 붙여 넣지 않습니다.

Onpod CLI에는 브라우저 로그인이 없어 키를 건네는 단계가 남습니다. skill은 키를 환경 변수로만 쓰고 파일에 적지 않으며, 출력에서 `op_u_`·`opk_` 모양을 가립니다. 연수가 끝나면 콘솔에서 키를 지웁니다.

## skill: 한 번에 올리기
```bash
node <skill>/scripts/lecpage.mjs publish work --host onpod --dry-run   # 순서·강사가 할 일
ONPOD_TOKEN=… node <skill>/scripts/lecpage.mjs publish work --host onpod [--name lec-20261203]
node <skill>/scripts/lecpage.mjs publish work                            # 다음부터: 같은 곳·같은 주소로
```
`publish`가 하는 일:
1. `dist`를 빈 임시 폴더에 복사하며 `_headers`와 점으로 시작하는 파일을 뺍니다(Onpod은 `_headers`를 읽지 않습니다 → GitHub Pages와 같이 보안은 쪽마다 있는 meta CSP가 맡고, 강사 화면을 다른 사이트 틀에 넣는 것은 `console.js`가 스스로 막습니다).
2. 검색·AI 노출을 lecpage 공개 범위대로 맞춥니다. Onpod은 사이트에 없으면 `llms.txt`·`sitemap.xml`·`robots.txt`를 자동으로 채우고 첫 화면에 JSON-LD를 넣습니다(AI-Ready).
   - 기본(`link`)·암호: 짧은 `llms.txt`와 빈 `sitemap.xml`을 함께 올려 쪽 목록(강사 화면 포함)이 나가지 않게 합니다. `robots.txt`(`Disallow: /`)는 lecpage 것이 이깁니다. 첫 화면에 들어가는 JSON-LD는 막을 수 없지만 `noindex` 쪽이라 검색에 영향이 없습니다.
   - 공개(`public`): 첫 화면만 담은 `sitemap.xml`과 `robots.txt`의 `Sitemap:` 줄을 올립니다. 연수 날짜가 있으면 lecpage가 첫 화면에 Event JSON-LD를 넣으므로 Onpod이 자기 것을 더하지 않습니다.
3. `onpod static deploy <사본> --name <이름> --no-spa`(이미 깔린 `onpod`, 없으면 `npx --yes onpod@latest`. CDN이 최신 바이너리만 주어 버전을 고정하지 않습니다).
4. 지난번에 Cloudflare 참여 기능 중계(`--live`)를 올렸으면 중계가 새 주소도 받게 고칩니다(Cloudflare 로그인 필요).
5. 첫 화면·`check.html`을 열어 확인하고, 인쇄용 안내물(`QR-안내문.pdf` 등)을 `dist-강사용/`에 만듭니다.

손으로 올릴 때:
```bash
cp -r dist /tmp/lec && rm /tmp/lec/_headers
ONPOD_TOKEN=… npx --yes onpod@latest static deploy /tmp/lec --name lec-20261203 --no-spa
```

## 참여 기능
- 사이트만 Onpod에 두고 질문·투표는 Cloudflare 중계·Supabase·구글 시트를 그대로 씁니다(`../infra-decision.md`).
- Onpod 서버 앱(무료 절전형)에 `backends/node-server`를 올리는 길은 연결하지 않았습니다: 30분 쉬면 잠들고, 기본 주소의 WebSocket은 약 100초 무통신이면 끊기며(하트비트 필요), 무료에는 데이터 디스크가 없어 다시 올리면 기록이 사라집니다.

## 막혔을 때
| 증상 | 할 일 |
|---|---|
| "Onpod 로그인이 필요해요" | 위 '키' 1~3 |
| "이미 다른 사람이 써요" | `--name lec-<날짜>-<학교 약자>`처럼 다른 이름 |
| "무료 한도에 닿았어요" | `onpod static ls`로 사이트를 보고 `onpod static rm <이름> --yes`, 또는 `--host cloudflare` |
| 고쳤는데 그림이 그대로 | 같은 파일 이름의 그림은 최대 1시간 캐시. 주소 뒤에 `?v=1`을 붙여 확인하지 말고 기다리거나 파일 이름을 바꿈 |
| 학교망에서 안 열림 | 연수 전날 `check.html`로 확인. 막히면 내 도메인 연결(`onpod static domain connect <이름> <도메인>`) 또는 다른 곳 |
