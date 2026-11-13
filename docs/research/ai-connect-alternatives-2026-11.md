# 키도 운영비도 없이 AI를 붙이는 방법 (2026-11-13)

질문(운영자): BYOK는 초보자에게 장벽이고, AI에 익숙한 사람은 에이전트를 쓰면 된다. 운영자는 AI 비용을 내지 않는다. 그러면 더 쉬운 연결 방법은?

## 결론과 결정
- **앱의 기본은 AI 없이 바로 만들기**로 바꿈(엔진 초안이 교재 핵심 항목 95~100%를 담음, purpose-fit-2026-11.md). AI는 '더 다듬기' 선택.
- 다듬기 순서: ① **쓰던 챗봇 창**(ChatGPT·Claude·Gemini, 무료 계정으로 됨, 키·운영비 없음) ② **키 연결**(자주 만드는 사람) ③ **Agent Skill**(에이전트를 쓰는 사람).
- 챗봇 창 쪽 손 덜기: 프롬프트를 줄여(지금 19,751자) Claude의 공식 프리필 주소(`claude.ai/new?q=`, 약 1.4만 자에서 잘림) 안에 들어가게 하면 붙여넣기 한 번이 줄어듦. 답은 대화 전체를 붙여 넣어도 JSON만 뽑음.
- **Sign in with ChatGPT(사용자의 ChatGPT 요금제로 AI 사용)**: 가장 이상적이지만 지금은 **컴퓨터에 설치해 쓰는 오픈소스 도구**용. 웹에 올린 앱은 OpenAI 관심 신청서 → 승인 필요. 운영자가 신청할 일(무료). 승인되면 '더 다듬기'의 첫째로.
- 넣지 않음(지금): OpenRouter 로그인(무료 모델 하루 요청 한도가 작고 품질·데이터 정책이 모델마다 다름. 유료는 키와 같은 장벽), Puter.js(약관·개인정보·한도 확인 안 됨, 계정 하나 더), 크롬 내장 AI(한국어 미지원으로 보임), ChatGPT 앱·Claude 커넥터(원격 MCP 서버 필요 → 운영비 0과 충돌. 나중 후보).

## 조율자가 공식 문서를 직접 읽어 확인한 것
- OpenAI Sign in with ChatGPT 개요(https://developers.openai.com/siwc.md), 오픈소스 요금제 사용(https://developers.openai.com/siwc/token-sharing-open-source.md):
  "These docs explain ChatGPT plan usage for open-source and locally hosted apps. If you're interested in offering it in a paid or remotely hosted app, complete the interest form."
- 등록·로그인(https://developers.openai.com/siwc/token-sharing-open-source/sign-in.md): `redirect_uri`는 "HTTP loopback callback on 127.0.0.1"만(웹 페이지에서 받을 수 없음). 범위 `offline_access resource.invoke chatgpt.tokens.use.direct`, 클라이언트 비밀 없음(PKCE).
- 웹사이트용(https://developers.openai.com/siwc/website.md): "currently available to selected commercial partners through a limited trial".
- 미리보기 한계(https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations.md): 텍스트·이미지·파일 입력 가능, 코드 실행·파일 검색 등 호스팅 도구는 안 됨(lecpage 요청에는 필요 없음).
- OpenRouter OAuth PKCE(https://openrouter.ai/docs/use-cases/oauth-pkce): 브라우저에서 `openrouter.ai/auth?callback_url=…&code_challenge=…` → `POST /api/v1/auth/keys`로 사용자 키 교환, "billed to their own OpenRouter credits". 무료 모델 한도 표는 https://openrouter.ai/docs/api-reference/limits (값은 아래 조사 요약 기준).
- 확인 날짜 2026-11-13. help.openai.com·openai.com은 이 환경에서 403이라 직접 못 읽음.

---

아래는 조사 작업자의 원 보고(웹 검색 요약 기반, 공식 본문 대조 전)입니다.


## 먼저 알아둘 한계
- 이 세션에서는 공식 사이트(developer.chrome.com, docs.puter.com, openrouter.ai 등)를 직접 열 수 없었어요(네트워크 차단, WebFetch가 DNS 오류).
- 그래서 아래 근거는 전부 "웹 검색 결과 요약"이에요. 공식 주소가 검색에 잡힌 경우는 주소를 적었지만, 본문을 직접 열어 대조하지는 못했어요.
- 공식 문서를 직접 확인한 항목은 없어요. 구현 전에 공식 페이지를 직접 열어 재확인이 필요해요.
- 모든 사실의 확인 날짜는 2026-11-13이에요.

## 1. 한눈에 보는 표

| 방법 | 교사가 할 일 | 비용 부담 | 품질 | 개인정보 | 위험 | 지금 쓸 수 있나 |
|---|---|---|---|---|---|---|
| A. 챗봇 창 프리필 링크(claude.ai/new?q= 등) | 링크 클릭 → 전송 → 답 복사 → 앱에 붙여넣기 (4~5단계) | 교사 무료 계정 | 챗봇 모델 수준 | 교재가 챗봇 회사로 감 | 길이 제한(Claude 약 1.4만 자), 비공식 주소가 바뀜 | Claude만 공식. 나머지는 비공식 |
| B. 지금 방식(복사 붙여넣기) | 프롬프트 복사 → 챗봇 → 답 복사 → 붙여넣기 (4단계) | 교사 무료 계정 | 챗봇 수준 | 위와 같음 | 무료 한도, 긴 입력 | 가능 |
| C. Puter.js User-Pays | 로그인 팝업 1회 (1~2단계) | 사용자 Puter 계정(무료 월 한도 후 유료) | 다양한 모델 | Puter 약관 미확인 | 의존성, 약관 확인 못 함 | 운영 중으로 보임, 세부 확인 못 함 |
| D. OpenRouter OAuth PKCE | 로그인·승인 (2~3단계) | 사용자(무료 모델은 한도 있음) | 무료 모델은 들쭉날쭉 | 모델별 제공사 정책 | 하루 50회 한도, 무료 모델 정책 제각각 | 가능 |
| E. 크롬 내장 AI(Gemini Nano) | 처음 모델 다운로드 대기 | 무료(기기에서 실행) | 작은 모델, 설계도 JSON엔 약함 | 기기 안에서 처리 | 한국어 미지원, 22GB 여유, 1만 토큰 입력 불확실 | 부적합 |
| F. ChatGPT 앱(Apps SDK)/MCP 커넥터 | 앱 추가(심사 통과 시) 또는 개발자 모드(복잡) | 사용자 구독 | ChatGPT 수준 | OpenAI | 서버 필요(운영비 0 원칙 위배) | 부적합 |
| G. Claude 사용자 지정 커넥터(원격 MCP) | 주소 붙이기 | 사용자 구독 | Claude 수준 | Anthropic | 원격 MCP 서버 필요(운영비 발생) | 부적합 |
| H. Claude Skills | ZIP 업로드, 대화에서 호출 | 사용자 구독 | Claude 수준 | Anthropic | 교사에게 어려움 | 가능하나 교사용으론 비현실적 |
| I. Sign in with ChatGPT(요금제 사용) | 로그인 (1~2단계) | 사용자 ChatGPT 구독 | ChatGPT 수준 | OpenAI | 제3자 웹앱에는 사실상 닫혀 있음 | 불가(초청제) |
| J. 구글 OAuth로 Gemini API | 구글 로그인·동의 | 사용자 쿼터 | Gemini | Google | 동의 화면 검증 확인 못 함 | 확인 못 함 |
| K. AI 없이 엔진 규칙 초안 | 0단계 | 없음 | 낮음 | 외부 전송 없음 | 품질 | 가능(현재 구현) |

## 2. 항목별 근거

### 2-1. 챗봇 창 프리필 주소
- Claude: 공식 안내가 있어요. `q`로 새 채팅을 열면 입력창에 채워지고 사용자가 검토 후 보내요. 값은 URL 인코딩이 필요하고 약 14,000자에서 잘려요. 자동 전송이 아니에요. 출처: https://support.claude.com/en/articles/14729294 (검색 요약, 2026-11-13). 2만 자 프롬프트는 안 들어가요(약 1.4만 자 초과분 잘림).
- Claude 자동 전송: 2025년에 URL로 자동 제출되던 동작이 멈췄다는 보고가 있어요. 출처: https://github.com/anthropics/claude-code/issues/8827 (검색 요약).
- ChatGPT: `?q=`로 입력창이 채워지는 것은 여러 곳에서 보고되지만 OpenAI 공식 문서는 못 찾았어요. OpenAI 커뮤니티 답변은 공식 지원 메커니즘이 아니라고 해요. 출처: https://community.openai.com/t/url-to-pass-prompt-into-gpt/574003. 자동 전송 여부는 출처마다 달라서 확인 못 함. Tenable은 `?q=`로 프롬프트 주입이 가능하다고 보고했어요: https://www.tenable.com/security/research/tra-2025-22. 길이 한도는 확인 못 함.
- Gemini: 공식 프리필 주소를 못 찾았어요(확장 프로그램 README는 기본 미지원이라고 함). 확인 못 함.
- Copilot(copilot.microsoft.com), Perplexity: 제3자 글만 있어요. Perplexity `?q=` 보고 있음, Copilot 홈 `?q=` 보고 있음. 공식 문서 확인 못 함.
- 로그인 안 한 사용자: 확인 못 함.
- 해석: 프롬프트가 1.4만 자를 넘으면 링크 방식은 잘려요. 링크 대신 "복사 버튼 + 챗봇 열기 버튼"이 안전해요. 링크는 짧은 프롬프트용 보조로만 써야 해요.

### 2-2. 무료 요금제로 2만 자 입력 + 6천 토큰 출력
- ChatGPT Free: 기본 모델 GPT-5.5 Instant, 약 5시간당 10건 안팎(공식 수치 아님), 파일 업로드 하루 3건, 컨텍스트는 27K~16K 등 출처마다 달라 불확실. 출처: https://ai.zenken.co.jp/en/post/chatgpt-usage/, https://freeacademy.ai/blog/chatgpt-free-plan-limits-2026 (제3자). 8월에 한도가 없어졌다는 보도도 있지만 확인 못 함.
- Claude Free: Sonnet·Haiku 사용, 5시간 롤링 한도, 컨텍스트 200K로 보고됨. 메시지 수는 공식 고정값 없음. 출처: https://fast.io/resources/is-claude-ai-free/ (제3자). 공식 도움말은 못 열었어요.
- Gemini 앱 무료: 컨텍스트 32K로 보고됨(2만 자는 한국어 기준 대략 1만 토큰이라 들어갈 가능성이 높지만 확인 못 함). 2026년 5월부터 고정 횟수 대신 연산량 기준 한도라는 보도. 출처: https://www.ai-toolbox.co/gemini-management-and-productivity/gemini-usage-limits-2026 (제3자). 공식 확인 못 함.
- 6천 토큰 JSON 출력이 끊기지 않는지는 확인 못 함. 직접 시험이 필요해요.

### 2-3. Puter.js User-Pays
- 운영 여부: 공식 문서 "User-Pays Model" 페이지가 검색에 잡혀요. https://docs.puter.com/user-pays-model/ (검색 요약).
- 방식: 개발자 비용은 0, 사용자가 자기 Puter 계정의 무료 월 한도를 쓰고 넘으면 Puter에 직접 내요. 한도는 사용자 계정 단위. 출처: https://developer.puter.com/pricing/, https://docs.puter.com/rate-limits-and-quotas/ (검색 요약).
- 로그인: Puter 팝업 로그인, 앱은 비밀번호를 못 봐요. 출처: https://docs.puter.com/Auth/signIn/ (검색 요약).
- 주의: Puter 튜토리얼은 "무료 접근은 연동 테스트용이고 운영 트래픽용이 아니다"라고 하고, 가격 페이지는 어떤 규모든 개발자 비용 0이라고 해서 서로 어긋나요. https://developer.puter.com/tutorials/free-llm-api/
- 월 무료 한도 금액, 쓸 수 있는 모델 목록, 개인정보·보관·학습 정책, 상업·교육 약관, 한국 이용 가능 여부: 모두 확인 못 함(약관은 puter.com/terms, puter.com/privacy로 추정되나 못 읽음).

### 2-4. OpenRouter OAuth PKCE
- 흐름: 앱이 /auth로 보내고(callback_url, code_challenge) → 사용자 승인 → code를 받아 POST /auth/keys로 사용자 키로 교환. 앱은 사용자 비밀번호를 못 봐요. 출처: https://openrouter.ai/docs/guides/overview/auth/oauth, https://openrouter.ai/docs/use-cases/oauth-pkce (검색 요약). 클라이언트 ID·시크릿 불필요는 제3자 주장이라 확인 못 함.
- 무료 모델 한도: `:free` 모델은 분당 20회. 하루 한도는 누적 충전 10달러 미만 50회, 이상 1,000회. 출처: https://openrouter.ai/docs/limits (검색 요약). 크레딧 없는 교사는 하루 50회라서 연수 사이트 몇 개 만들기엔 충분해요.
- 무료 모델 데이터 정책: 공식 단일 정책은 못 찾았어요. 모델·제공사마다 보관·학습 사용이 달라요(일부는 학습에 쓸 수 있음). 출처: https://www.developersdigest.tech/models/free-api/openrouter (제3자). 교재에 학생 정보가 있으면 위험해요.
- 무료 모델이 2만 자 입력과 6천 토큰 JSON 출력을 안정적으로 처리하는지는 확인 못 함.

### 2-5. 크롬 내장 AI(Prompt API)
- 웹 페이지 정식 출시: 제3자는 Chrome 148부터 안정(stable)이라고 해요. 구글 문서는 148 옆에 샘플링 파라미터 오리진 트라이얼을 표기해 모호해요. 출처: https://pasqualepillitteri.it/en/news/3145/gemini-nano-chrome-built-in-ai-client-side-en, https://developer.chrome.com/docs/ai/prompt-api (검색 요약). 정식 여부는 사실상 확인 못 함.
- 하드웨어: VRAM 4GB 초과, 프로필 볼륨 여유 22GB 이상, 무제한 네트워크, Windows 10/11·macOS 13+·Linux. 안드로이드·iOS 미지원. 출처: https://developer.chrome.com/docs/ai/get-started (2025년 5월 갱신본 캐시, 최신 여부 불확실).
- 언어: 공식 문서는 en, ja, es, de, fr만 열거. 한국어 미지원으로 보여요. 출처: https://developer.chrome.com/docs/ai/prompt-api (검색 요약).
- 입력 토큰 한도: 수치 확인 못 함(session.inputQuota로 조회).
- Edge 대응: 확인 못 함.
- 결론: 교사 PC 사양과 한국어 때문에 핵심 경로로 부적합해요.

### 2-6. ChatGPT 앱·MCP, Claude 커넥터
- ChatGPT 앱: 2025년 12월 출시 시 EEA·스위스·영국 제외, 로그인한 Free·Go·Plus·Pro 사용자가 쓸 수 있어요. 개발자는 제출 후 심사(가이드라인 준수)를 받아요. 출처: https://openai.com/index/developers-can-now-submit-apps-to-chatgpt/, https://developers.openai.com/apps-sdk/app-submission-guidelines (검색 요약). 한국 포함 여부와 현재 요금제 변경은 확인 못 함.
- 개발자 모드(주소 직접 연결): Business·Enterprise·Edu에서 전체 MCP 베타, Plus·Pro는 읽기 전용이라는 제3자 설명 등 출처가 엇갈려요. 출처: https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-connectors. 정확한 요금제 확인 못 함.
- Claude 사용자 지정 커넥터: Free(커넥터 1개)·Pro·Max·Team·Enterprise에서 원격 MCP 주소를 붙일 수 있어요. 출처: https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp (검색 요약).
- 구독이 AI 비용을 내는 구조: 맞아요(사용자 구독의 챗봇이 호출). 하지만 MCP 서버가 인터넷에 떠 있어야 해서 서버 없는 운영비 0 원칙과 충돌해요. 브라우저 앱만으로는 불가능해요.

### 2-7. Skills
- Claude: 도움말은 Free·Pro·Max·Team·Enterprise 모두 가능하다고 하고, 코드 실행·파일 생성을 켜야 해요. ZIP 업로드로 개인 계정에 추가. 출처: https://support.claude.com/en/articles/12512180 (검색 요약, 다른 자료는 Free 제외로 표기해 불일치). 코드 실행 환경의 Node.js 사용 여부와 결과 ZIP 다운로드: 확인 못 함.
- ChatGPT: 도움말에 Skills와 ZIP 업로드 경로가 있어요. 요금제는 Business·Enterprise·Edu·Healthcare 중심이고 Free·Plus·Pro는 불확실. 출처: https://help.openai.com/en/articles/20001066-skills-in-chatgpt. Custom GPT가 2026-12-11 종료되고 플러그인으로 이전된다는 보도가 있어요(확인 못 함).
- 교사에게 ZIP 업로드와 호출을 시키는 것은 단계가 많아 부담이 커요.

### 2-8. 구독으로 제3자 웹앱이 모델 호출
- OpenAI: "Sign in with ChatGPT"에 요금제 사용(plan usage)이 생겼고, 2026-09-29 DevDay에서 제휴 16곳과 함께 발표됐어요. 출처: https://thenewstack.io/sign-in-with-chatgpt/, https://help.openai.com/en/articles/20001542-using-your-chatgpt-plan-in-other-apps-and-sites. 그러나 상용 앱은 선별된 파트너 제한 시범(대기 명단), 오픈소스 앱만 자체 등록이라고 해요. 출처: https://developers.openai.com/siwc/request-client-id, https://developers.openai.com/siwc/quickstart (검색 요약, 본문 못 읽음). lecpage가 오픈소스로 공개하면 길이 열릴 수도 있지만, 브라우저 전용 앱도 되는지(리다이렉트·토큰 처리), Free 요금제 포함 여부는 확인 못 함. 가장 유망하지만 반드시 공식 문서 직접 확인이 필요해요.
- Anthropic: 2026년 2월 약관 개정, 4월부터 구독 OAuth 토큰의 제3자 사용 차단. 출처: https://www.theregister.com/2026/02/20/anthropic_clarifies_ban_third_party_claude_access (검색 요약). 5월 이후 일부 복원 보도는 단일 출처라 확인 못 함. 사실상 불가.
- Google: Gemini 구독을 외부 앱에서 쓰는 공식 방법 없음(보도 요약). 구글 OAuth로 Gemini API 호출 문서는 있고 외부 앱은 동의 화면 검증이 필요하다고 해요(제3자). 출처: https://ai.google.dev/gemini-api/docs/oauth. 필요한 스코프가 민감/제한 스코프인지, 검증 비용·기간은 확인 못 함. 교사가 별도 구글 클라우드 프로젝트·API 설정을 해야 할 가능성도 있어요.

### 2-9. 추가 후보
- 확인하지 못한 것: Gemini API 무료 키(이미 지원 중), Hugging Face·Cloudflare 무료 모델, WebLLM(브라우저 로컬 실행, 모델 다운로드 큼) 등은 이번에 조사하지 못했어요. 확인 못 함.

## 3. 추천 순서와 이유
1. 기존 "복사 붙여넣기"를 기본으로 유지하고 다듬기. 서버·키·약관 위험이 없고, 무료 챗봇에 2만 자가 들어가는지(특히 Gemini 32K, ChatGPT Free)만 시험 필요. 프리필 링크는 짧은 프롬프트일 때만 보조로.
2. Gemini 무료 키·사용자 키는 파워 사용자용으로 유지.
3. 신규 후보 1순위: OpenRouter OAuth. 로그인 한 번으로 키가 생겨 교사 부담이 작고 서버가 필요 없어요. 단 무료 모델 품질·데이터 정책 고지가 필요해요.
4. Puter.js는 약관·무료 한도·한국 이용 확인이 끝나면 2순위. 현재는 확인 못 함이 너무 많아요.
5. Sign in with ChatGPT는 가장 이상적이지만 상용 앱은 초청제라서 대기 명단 신청과 오픈소스 경로 검토를 병행하고, 크롬 내장 AI·MCP·Skills는 한국어·서버·난이도 때문에 제외하는 게 좋아요.
