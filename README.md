<p align="center"><img src="app/public/favicon.svg" width="88" alt=""></p>

<h1 align="center">lecpage</h1>

<p align="center"><b>교재를 넣으면 연수 사이트가 나와요.</b><br>
바쁜 강사님의 시간과 토큰을 아껴드립니다</p>

<p align="center">강의·연수를 하는 강사와 연수 담당자가 쓰는 무료 오픈소스 도구예요. 회원가입이 없어요.</p>

<p align="center"><a href="https://lecpage.com/"><b>웹앱 열기</b></a> · <a href="https://lecpage.com/#/demo">먼저 체험해 보기</a> · <a href="#ai-에이전트에서-쓰기">AI 에이전트에서 쓰기</a></p>

<p align="center"><img src="docs/images/app-home.webp" width="49%" alt="lecpage 첫 화면: 교재를 놓으면 시작"> <img src="docs/images/app-edit.webp" width="49%" alt="살펴보고 고치기: 디자인 탭과 기기별 미리보기"></p>

| | |
|---|---|
| **무엇** | PPT·PDF·한글(HWP·HWPX)·워드 교재로 그 연수의 사이트를 만들어요. 일정·실습 안내·프롬프트 복사·교재 보기에 질문·투표·나눔 보드, 강사 화면·발표 화면·QR 안내문까지 들어 있어요 |
| **누가** | 강의·연수·워크숍을 하는 강사와 연수 담당자(학교·기업·공공기관·학원 등) |
| **어떻게** | 내용은 쓰던 AI(ChatGPT·Claude·Gemini 창, API 키, AI 에이전트)가 짜고, 디자인·배포·진행·마무리는 lecpage가 해요 |

## 누구나 만들 수 있지만, 잘 만들어 나누려면 노하우가 필요합니다

AI 에이전트에 맡겨도 사이트는 나와요. 그다음 단계마다 강사가 할 일과 드는 토큰이 달라요.

| 단계 | AI 에이전트에 그냥 맡길 때 | lecpage |
|---|---|---|
| 교재 옮기기 | 옮겨 쓴 프롬프트가 교재와 같은지 강사가 맞춰 봐요 | AI는 내용을 짤 때 한 번만 불러요. 바뀌거나 빠진 프롬프트는 교재 지킴이가 교재 원문대로 되돌려요 |
| 디자인 | AI가 그때그때 정하고, 바꾸려면 다시 요청해요 | 컨셉을 먼저 세우고 주제에 맞는 디자인을 골라요. 디자인을 바꿀 때 AI를 부르지 않아요 |
| 배포 | ZIP 압축 풀기·배포할 곳에 로그인·폴더 끌어 놓기·사이트 이름 바꾸기·QR 페이지 열기·주소 확인을 강사가 해요 | [배포하기]를 누르면 앱이 해요 |
| 질문·투표 준비 | 투표 서비스에 가입해 행사·문항을 만들고 링크를 넣어 다시 배포해요. 참가자는 사이트 밖에서 투표해요 | 질문·투표·출석이 사이트 안에 있어요 |
| 연수 당일·연수 후 | 고칠 때마다 다시 요청하고 다시 배포해요. 명단은 설문을 새로 만들어 받아요 | 명단은 강사 화면에서 버튼 하나로 CSV로 받아요 |

**잰 값**: 같은 교재(실습형 연수 PPT 21장)·같은 요청으로 만들기부터 연수 후 CSV까지 견줬어요. 2026-11-13 · [재는 방법](docs/research/benchmark-2026-11.md)

| | AI 에이전트에 그냥 맡길 때 | lecpage |
|---|---:|---:|
| AI 비용(토큰 단가 환산, lecpage를 1로) | 약 127 | **1** |
| AI가 읽은 글(입력 토큰) | 약 2,630만 | **6,643** |
| AI가 쓴 글(출력 토큰) | 약 22만 | **약 6,000** |
| 배포·질문·투표 준비로 강사가 할 일 | 12가지 | **0가지**(같은 기기 두 번째 연수부터) |

<p align="center"><img src="docs/images/presets.webp" width="98%" alt="같은 연수 내용을 디자인 27가지로 만든 첫 화면"></p>
<p align="center"><img src="docs/images/example-data.webp" width="49%" alt="예시: 디지털 연수 '데이터로 읽는 우리 반'(실습형)"> <img src="docs/images/example-sel.webp" width="49%" alt="예시: 사회정서학습 연수 '마음이 먼저 도착하는 교실'(강의형)"></p>

## 시작하기

**웹앱**: **https://lecpage.com/** 에 교재 파일을 놓으면 시작해요. 교재는 브라우저 안에서 읽고, AI를 쓸 때만 연결한 AI 회사로 보내요.

1. **교재 넣기**: 연수명·날짜·장소를 교재에서 찾아 채워요.
2. **AI로 만들기**: 쓰던 ChatGPT·Claude·Gemini 창에 붙여 넣거나(추가 비용 없음), API 키로 버튼 한 번에 만들어요.
3. **살펴보고 고치기**: 휴대폰·태블릿·PC 크기로 보며 디자인과 내용을 고쳐요. 디자인은 말로도 고쳐요.
4. **배포하기**: 주소·QR·카톡 안내 문구가 나와요. 연수 당일에는 강사 화면에서 [발표 화면 띄우기]로 프로젝터에 띄우고, QR을 찍어 휴대폰으로도 진행해요.

화면별 안내는 앱의 [도움말](https://lecpage.com/#/help/start)에 있어요.

### AI 에이전트에서 쓰기

쓰던 AI 에이전트에 lecpage 스킬을 넣으면 쓰던 구독 그대로 앱과 같은 엔진으로 만들어요. 만든 연수는 `.lecpage` 파일로 웹앱에서 열어 고치고 배포해요.

| 도구 | 설치(한 줄) |
|---|---|
| Claude Code | 대화창에 `/plugin install lecpage --marketplace yoorrard/lecpage`(터미널은 `claude plugin install lecpage --marketplace yoorrard/lecpage`) |
| Codex | `$skill-installer https://github.com/yoorrard/lecpage/tree/main/skills/lecpage` |
| Gemini CLI | `gemini skills install https://github.com/yoorrard/lecpage.git --path skills/lecpage` |
| Cursor 등 그 밖의 도구 | `npx skills add yoorrard/lecpage`(모든 프로젝트에 쓰려면 `-g`) |
| claude.ai | `skills/lecpage` 폴더를 ZIP으로 묶어 설정 → 기능 → 스킬 올리기 |

그다음 "이 PPT로 연수 사이트 만들어 줘"라고 말해요. 명령과 흐름은 [SKILL.md](skills/lecpage/SKILL.md)에 있어요. 설치 근거: [Claude Code 플러그인](https://code.claude.com/docs/en/plugins/install) · [Codex 스킬](https://developers.openai.com/codex/skills) · [Gemini CLI 스킬](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/skills.md) · [skills CLI](https://github.com/vercel-labs/skills)

## 드는 돈

| | |
|---|---|
| lecpage | **0원**. 회원가입이 없어요 |
| AI | 쓰던 ChatGPT·Claude·Gemini 창이면 **0원**. API 키를 쓰면 사이트 하나에 몇백 원쯤을 그 AI 회사에 직접 내요(Gemini 무료 키는 0원, 대신 하루 횟수가 정해져 있음) |
| 배포·참여 기능 | 강사가 연결한 계정(Vercel·GitHub Pages·Netlify·Cloudflare·구글 시트 등)의 무료 한도 안에서 돌아가요 |

## 더 알아보기

- 무엇을 만들어 주나요: [기획서](docs/plan.md)(사이트 유형·섹션·강사용 화면) · [디자인 27가지와 효과](skills/lecpage/references/design.md) · 앱의 [디자인 둘러보기](https://lecpage.com/#/gallery)
- 배포와 참여 기능: [배포할 곳 안내서](skills/lecpage/references/deploy) · [참여 기능 연결 고르기](skills/lecpage/references/infra-decision.md) · [운영비와 멈추지 않기](docs/research/zero-cost-2026-11.md)
- 개발자용: [아키텍처와 계약](docs/architecture.md) · [문구 기준](docs/writing.md) · [동작 기준](docs/interaction.md) · [웹앱 운영 안내](docs/operations.md) · [바로 배포 서버](hosting/README.md) · [조사 기록](docs/research)
- 약속: [보안 정책](SECURITY.md) · [이용약관](docs/legal/terms.md) · [개인정보 처리방침](docs/legal/privacy.md) · [참가자 개인정보 안내 가이드(강사용)](docs/legal/participant-privacy-guide.md)

## 개발

```bash
npm test                     # 엔진 테스트
npm run examples             # 예시 사이트 2개 빌드(.out/)
npm --prefix app install
npm run app:dev              # 웹앱 개발 서버
```

```
skills/lecpage/   Agent Skill(자체 완결): SKILL.md · references · engine(설계도 검증·디자인·렌더러·교재 해석) · backends · scripts
app/              웹앱(Vite + Preact, 정적 배포). 같은 엔진을 씀
hosting/          바로 배포 서버(선택, Cloudflare Worker)
docs/             기획서·아키텍처·운영·약관·조사 기록
```

## 라이선스

| 무엇 | 라이선스 | 뜻 |
|---|---|---|
| 엔진·Skill·웹앱(기본) | **Apache-2.0** | 쓰고 고치고 배포할 수 있어요. 특허 사용 허락이 명시돼 있고, 이름·로고 권리는 넘기지 않아요 |
| 만든 사이트에 복사되는 실행 파일(`engine/runtime`), 실시간 서버(`backends`), 배포 설정 파일(`templates`) | **MIT-0** | 출처 표시 의무도 없어요. 만든 연수 사이트에 라이선스 문구를 넣지 않아도 돼요 |
| lecpage로 만든 사이트·문서 | 만든 사람의 것 | lecpage 라이선스와 상관없어요 |
| 이름 "lecpage"와 마스코트 로고 | 상표 정책 | [TRADEMARKS.md](TRADEMARKS.md) |

함께 쓰는 라이브러리·글꼴은 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)에, 앱에 묶인 라이브러리의 라이선스 전문은 앱의 `licenses.txt`에 있어요.

만든 사람: 유영재([yoorrard](https://github.com/yoorrard)) · © 2026 lecpage 기여자
