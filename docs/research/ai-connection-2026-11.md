# AI 연결 조사: 키 없이, 또는 키를 쉽게 (2026-11)

- 조사일: 2026-11-09. 대상: 서버 없는 정적 웹앱(lecpage)에서 비개발자 교사가 AI를 쓰는 가장 쉬운 길.
- 방법: 웹 검색 결과(공식 문서 우선)로 확인했습니다. 이 조사 환경에서는 제공자 도메인(ai.google.dev, openrouter.ai 등)을 직접 열 수 없어, 공식 페이지는 검색 색인 내용으로 확인했습니다. 출처끼리 다르면 **(불일치)**, 직접 확인하지 못한 것은 **(미확인)**으로 표시했습니다.
- 원칙: 구독 계정 로그인(ChatGPT Plus·Claude Pro 등)을 앱이 빌려 쓰는 방법은 약관 위반이라 쓰지 않습니다.

- **2026-11-12 갱신**: 아래는 11-09 조사 기록입니다. 그 뒤 공식 문서를 직접 읽어 바뀐 점: (1) OpenRouter 로그인은 고르는 화면에서 뺐습니다(낯선 서비스라 초보자에게 오히려 어려움. 저장해 둔 연결은 동작). (2) 앱의 순서는 키 연결이 기본이고 ChatGPT·Claude·Gemini(무료) 순입니다(흔히 쓰는 순). (3) 최소 충전액, OpenAI 버튼 이름, Gemini 키 앞글자(`AQ.`)는 공식 문서에서 확인하지 못해 앱 문구에서 뺐습니다. (4) Claude Max·Team 등 일부 구독에는 API 크레딧이 들어 있습니다. (5) 모델 추천은 가격·출시일 기준으로 바뀌었습니다([`zero-cost-2026-11.md`](zero-cost-2026-11.md) §5). 지금 기준은 앱의 `app/src/lib/ai-guides.jsx` 머리말과 `ai.js`입니다.

---

## 0. 결론

| 순서 | 길 | 설정 | 비용 | 쓰는 곳 |
|---|---|---|---|---|
| 기본 | **AI 없이 초안** | 없음 | 무료 | [사이트 만들기]가 바로 초안을 만듦 |
| 1 | **챗봇에 붙여넣기 + '문구만 다듬기'** | 없음(쓰던 챗봇) | 무료 | 지시문 약 2~5천 자, 답은 바뀐 문구만 담은 작은 JSON → 무료 챗봇에서도 잘 안 끊김 |
| 2 | **OpenRouter로 로그인**(OAuth PKCE) | 버튼 → 로그인 → Authorize | 무료 모델 하루 50번 | 키를 복사할 필요가 없음. 한 번 연결하면 [AI로 문구 다듬기] 버튼 하나 |
| 3 | **Gemini API 키** | AI Studio에서 4단계 | 무료 등급 | 무료 중 품질이 가장 안정적. 개인 구글 계정·만 18세 이상 |
| 4 | OpenAI·Claude 키 | 결제 등록 후 키 | 최소 5달러 충전 | 품질 우선일 때 |

- **추천**: 처음에는 1(붙여넣기)로 바로 쓰고, 자주 쓰면 2(OpenRouter 로그인) 또는 3(Gemini 무료 키)으로 한 번 연결합니다. 앱은 이 순서대로 보여 줍니다.
- **채택하지 않음**: Puter.js(제3자 스크립트가 앱 저장소 전체에 접근, 팝업·CSP·COOP 충돌, 무료 한도 비공개), Chrome 내장 AI(한국어 미지원, 고사양), WebLLM(수 GB 다운로드, 한국어 품질), 구독 로그인 재사용(약관). 'Sign in with ChatGPT'는 오픈소스 프로젝트에 열려 있어 **후속 검토 후보**입니다(아래 2-5).

---

## 1. 회사별 키 만드는 법(2026-11 화면 기준)

### 1-1. Google Gemini(무료 등급 있음)

1. [Google AI Studio](https://aistudio.google.com/api-keys)에 개인 구글 계정으로 로그인. 처음이면 약관 동의.
2. 오른쪽 위 **Create API key**.
3. 대화상자에서 프로젝트를 고르거나(없으면 **Create project**) **Create key**. 대화상자 문구는 "Create a new key", "Name your key", "Choose an imported project" (3자 가이드 기준, 일부 **(미확인)**).
4. 키 복사 버튼 → 앱에 붙여 넣기.

- **키 형식**: 새 키는 **`AQ.`**(Auth key)로 시작. 예전 키는 `AIza…`. AI Studio는 이제 AQ 키만 만듦(구글 포럼 운영자 답변). 제한 없는 AIza 키는 2026-06-19부터 거부되기 시작했고, 9월에 모든 표준 키가 거부된다는 보도가 있음 **(불일치: 날짜)**. AQ 키는 네이티브 엔드포인트(`x-goog-api-key` 헤더)에서 동작하고, OpenAI 호환 엔드포인트에서는 400/401이 날 수 있음 → lecpage는 네이티브 엔드포인트만 씀.
- **지역·나이**: 대한민국은 지원 지역. 만 18세 이상만 사용 가능(약관). 나이 인증이 안 된 계정은 '지원 지역 아님' 페이지로 보내짐.
- **학교 계정**: Workspace for Education 계정은 관리자가 'Google AI Studio' 추가 서비스를 꺼 둔 경우가 많음(관리 콘솔 → 앱 → 추가 Google 서비스). 앱 안내는 "개인 구글 계정으로"로 통일.
- **무료 등급**: 카드 없이 키 생성·사용 가능. 한도는 모델별 RPM·RPD로 AI Studio에서 확인. 2026년 들어 Pro 모델은 무료에서 빠졌고, Flash 계열 하루 한도도 줄었다는 보고가 있음 **(불일치: 20~1,000회/일)**. 무료 등급 입력은 구글 제품 개선에 쓰이고 사람이 검토할 수 있음 → 학생 개인정보 금지 안내.
- **오류**: 400 `INVALID_ARGUMENT`/`API_KEY_INVALID`(키 틀림), 400 `FAILED_PRECONDITION`(그 지역에서 무료 등급 불가 → 결제 필요), 403 `PERMISSION_DENIED`(권한·제한된 키), 429 `RESOURCE_EXHAUSTED`(분당·일일 한도), 500/503(서버 바쁨).

### 1-2. OpenAI(유료)

1. [OpenAI Platform](https://platform.openai.com/api-keys) 로그인(ChatGPT 계정 그대로).
2. **Settings → Billing**에서 카드 등록, 크레딧 충전(최소 5달러, 기본 10달러, 1년 뒤 만료, 대체로 환불 불가).
3. **API keys → Create new secret key** → 이름·프로젝트 → **Create secret key**.
4. 키는 한 번만 보임. 형식 `sk-proj-…`(예전 `sk-…`).

- ChatGPT Plus 구독과 API 결제는 별개. 신규 계정 무료 크레딧은 공식 보장이 없음 **(불일치)**.
- **오류**: 401 `invalid_api_key`, 429 `insufficient_quota`(크레딧 없음, 한도 초과와 같은 429라 메시지로 구분), 429 rate limit, 403 `unsupported_country_region_territory`.
- 최신 모델은 `max_tokens` 대신 `max_completion_tokens`를 받음 → 앱 호출은 `max_completion_tokens` 사용.

### 1-3. Anthropic Claude(유료)

1. [Claude Console](https://platform.claude.com/settings/keys) 로그인(console.anthropic.com은 platform.claude.com으로 넘어감).
2. **Settings → Billing**에서 크레딧 충전(최소 5달러).
3. **Settings → API keys → Create Key** → 이름 → **Add** (버튼 이름 **(미확인)**).
4. 키는 한 번만 보임. 형식 `sk-ant-…`.

- Claude Pro·Max 구독과 별개. 소액 무료 크레딧은 일부 국가만 **(불일치)**. 2026-02 약관 개정으로 구독 OAuth 토큰을 제3자 도구에서 쓰는 것이 금지됨.
- 브라우저 직접 호출은 `anthropic-dangerous-direct-browser-access: true` 헤더가 필요(CORS). 지금도 SDK가 쓰는 방식.
- **오류**: 401 `authentication_error`, 400 "credit balance is too low"(크레딧 없음), 429 `rate_limit_error`, 529 `overloaded_error`.

### 1-4. OpenRouter(무료 모델 있음)

- 키 직접 만들기: [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys) → **Create API Key** → 이름 → **Create**. 형식 `sk-or-v1-…`.
- 크레딧 구매: 최소 5달러, 수수료 5.5%(최소 0.80달러), 1년 뒤 만료 가능.
- **오류**: 401(키 틀림·삭제), 402(크레딧 부족, 유료 모델), 429(분당 20회 또는 `free-models-per-day`).

---

## 2. 키 없이, 또는 덜 번거롭게

### 2-1. OpenRouter OAuth PKCE(채택, 이미 구현돼 있던 것을 다듬음)

- 흐름: `https://openrouter.ai/auth?callback_url=…&code_challenge=…&code_challenge_method=S256` → 사용자가 로그인·승인 → `callback_url?code=…`로 돌아옴 → `POST https://openrouter.ai/api/v1/auth/keys` `{code, code_verifier, code_challenge_method}` → 사용자 소유 키. 앱 등록이 필요 없음.
- callback_url 제약: "HTTPS 443·3000 포트만"이라는 보고와 "localhost는 아무 포트나"라는 보고가 엇갈림 **(불일치)**. 배포 주소(GitHub Pages·Cloudflare, 443)는 문제없음.
- 무료 한도: 크레딧을 10달러 미만 산 계정은 무료 모델 하루 50번, 10달러 이상이면 하루 1,000번, 분당 20번(공식 FAQ 문구, 숫자는 3자 인용 **(불일치: 기준 9~10달러)**).
- `GET /api/v1/key`의 `is_free_tier`로 무료 계정인지 알 수 있음 → 무료 계정은 유료 모델(402)을 고르지 않게 **`openrouter/free`**(무료 모델 자동 선택 라우터)를 기본으로 씀.
- 데이터: OpenRouter 자체는 기본 로그를 남기지 않지만, 무료 모델 제공자 일부는 프롬프트를 학습에 씀 → 학생 개인정보 금지 안내.
- **고친 버그**: 로그인 후 돌아오면 주소에 `#/…`가 없어 첫 화면에 머물렀음(`history.replaceState`는 hashchange를 일으키지 않음). 이제 하던 화면으로 돌아가고 AI 창이 연결된 상태로 다시 열림.

### 2-2. Puter.js 'User-Pays'(채택 안 함)

- 방식: 사용자가 Puter 계정으로 로그인하고 자기 계정의 월 무료 허용량·결제로 AI를 씀. 개발자 비용 0, 키 없음. 400개 이상 모델.
- 걸림돌
  - **보안**: `js.puter.com` 스크립트를 앱 문서에 넣어야 함 → 제3자 코드가 앱 출처의 IndexedDB(암호화된 키·교재)까지 접근 가능. lecpage의 '교재는 이 브라우저에만' 약속과 충돌.
  - **CSP·COOP**: 지금 CSP `script-src`는 self·jsDelivr만 허용. 로그인은 팝업(`window.open`)과 `postMessage`인데, 배포 헤더의 `Cross-Origin-Opener-Policy: same-origin`이 팝업과의 연결을 끊음. 팝업 차단 시 `popup_blocked` 오류.
  - **한도·약관**: 월 무료 허용량 금액 비공개, 초과 시 402. "무료·무제한" 홍보와 실제 한도가 다르다는 이슈가 있음(HeyPuter/puter #1704). 개인·비상업 이용 조건이라는 보고 **(미확인)**.
  - 교사가 낯선 서비스(Puter)에 또 가입해야 함 → 단계가 OpenRouter 로그인보다 줄지 않음.
- 재검토 조건: 샌드박스 iframe(별도 출처)으로 격리하고 약관·한도가 공개되면.

### 2-3. Chrome 내장 AI(Prompt API, Gemini Nano)(채택 안 함)

- 상태: Chrome 148(2026-05)부터 웹에서 정식(데스크톱 Windows·macOS·Linux·Chromebook Plus). 확장 프로그램은 138부터.
- 요건: 프로필 디스크 여유 22GB, RAM 16GB와 CPU 4코어 또는 VRAM 4GB 이상 GPU. 첫 사용 때 모델 다운로드. 관리되는 기업·학교 프로필은 정책으로 꺼질 수 있음.
- 언어: 입력·출력 `en`, `ja`, `es`(문서에 따라 `de`, `fr`도) → **한국어 미지원**. 문맥 창 약 4천~9천 토큰.
- 결론: 한국어 문구 다듬기에 못 씀. 학교 PC 사양도 대부분 미달. 한국어가 지원되면 '제목 하나 다듬기' 같은 작은 일에 다시 볼 만함(`LanguageModel.availability({languages:['ko']})`로 감지).

### 2-4. WebLLM(채택 안 함)

- WebGPU로 브라우저 안에서 모델 실행. 모델 다운로드 1~5GB, 첫 실행이 느리고 저사양 PC·크롬북에서 어려움. 작은 오픈 모델은 한국어 문장 품질이 낮음. 교사용 도구의 '바로 된다' 기대와 맞지 않음.

### 2-5. 그 밖의 새 길

- **Sign in with ChatGPT**(OpenAI, 2026-09-29 DevDay에서 구독 사용량 연결 확대): Plus·Pro 사용자가 자기 플랜 사용량(Codex 허용량)을 협력 앱에서 씀. 오픈소스·개인 프로젝트는 쓸 수 있고, 유료·서버형 앱은 별도 신청. lecpage는 오픈소스라 **후보**. 단, 정적 웹앱용 클라이언트 등록 방식·브라우저 호출 가능 여부는 **(미확인)** → 공식 문서 확인 후 별도 작업으로.
- **Gemini API OAuth**: 구글 클라우드 OAuth 클라이언트와 민감 범위 앱 검증이 필요하고, 사용량이 개발자 프로젝트로 잡힘 → 정적 오픈소스 앱에 부적합.
- **구독 로그인 재사용**(ChatGPT·Claude 웹 세션 토큰 등): 약관 위반. 쓰지 않음. 대신 '챗봇에 붙여넣기'와 AI 도구 안의 lecpage skill이 구독을 정당하게 쓰는 길.

---

## 3. 앱에 반영한 것

- **AI 창 구조**(`app/src/components/AiPanel.jsx`)
  - 기본 작업은 **문구만 다듬기**(`app/src/lib/polish.js`): 제목·안내 문장 목록만 보내고 `{"changes":[{"k":번호,"text":…}]}`만 받음. 실습 단계·프롬프트 원문·링크·순서는 건드리지 않음. 견본 기준 지시문 약 2.4천 자(전체 설계도 방식은 14~50천 자).
  - 체크 하나로 '칸 구성과 순서까지 새로 짜기'(기존 전체 설계도 방식). 첫 단계(초안 전)에서는 기본으로 켜짐.
  - 방법 두 가지(세그먼트): **챗봇에 붙여넣기**(연결이 없으면 기본) / **AI 연결**(연결돼 있으면 기본, 버튼 하나).
  - AI 연결: 맨 위 [OpenRouter로 로그인], 그 아래 'API 키 붙여넣기' 한 칸. 키 앞부분으로 회사를 알아냄(`AQ.`·`AIza`→Gemini, `sk-or-`→OpenRouter, `sk-ant-`→Claude, `sk-`→OpenAI). [연결 확인]은 돈이 드는 생성 없이 모델 목록·키 정보로 확인하고 쓸 모델을 고름.
  - 'API 키 만드는 법'은 접어 두고, 키 오류가 나면 그 회사 안내가 저절로 펼쳐짐.
- **오류 안내**(`app/src/lib/ai.js` `explainError`): 상태 코드·메시지로 종류를 가려 한 줄 제목 + 할 일 + 버튼(붙여넣기로 하기 / 키 페이지 / 결제 페이지).

| 종류 | 언제 | 안내 |
|---|---|---|
| bad-key | 401, `API_KEY_INVALID`, invalid x-api-key | 끝까지 복사했는지, 지웠으면 새로 |
| forbidden | 403 | Gemini: 학교 계정 막힘 → 개인 계정 |
| region | `FAILED_PRECONDITION`, 지역 미지원 | 만 18세·개인 계정, 안 되면 붙여넣기 |
| billing | 402, `insufficient_quota`, credit balance too low | 결제 페이지, 또는 붙여넣기 |
| quota-day | 429 + per-day | 내일 또는 붙여넣기 |
| quota | 429, `RESOURCE_EXHAUSTED` | 1분 뒤, 또는 붙여넣기 |
| network | fetch 실패 | 학교망 차단 가능 → 핫스팟 또는 붙여넣기 |
| truncated | 출력 한도 | 문구만 다듬기로 |

- **모델 자동 선택**: 회사별 목록에서 음성·이미지·임베딩·미리보기 모델을 빼고 고름(Gemini `gemini-flash-latest` 우선, OpenAI `gpt-*-mini`, Claude Sonnet, OpenRouter 무료 계정은 `openrouter/free`). 모델 이름을 코드에 고정하지 않음.
- **안내 문서**: 앱 안 접힘 안내와 도움말(AI로 다듬기)이 같은 데이터(`app/src/lib/ai-guides.jsx`)를 씀.
- **다른 기능과 공유**: `getActiveAI()` → `{provider, key, model, label, freeTier, supportsImages}`(연결 없으면 null). 기존 `PROVIDERS`·`loadKey`·`saveKey`·`forgetKey` 이름과 인자는 그대로.

## 4. 실제 계정으로 다시 확인할 것

- OpenRouter 승인 화면의 버튼 이름(Authorize)과 localhost 비표준 포트 콜백 허용 여부.
- Claude Console 키 대화상자 버튼(Add), Gemini 키 대화상자 문구.
- Gemini 무료 등급의 현재 Flash 일일 한도(AI Studio → 사용량).
- Sign in with ChatGPT의 정적 웹앱 지원 여부.

## 출처

- Gemini API 지역: https://ai.google.dev/gemini-api/docs/available-regions
- Gemini API 약관(18세): https://ai.google.dev/gemini-api/terms
- Gemini API 키: https://ai.google.dev/gemini-api/docs/api-key
- Gemini 요청 한도: https://ai.google.dev/gemini-api/docs/rate-limits
- Gemini 오류: https://ai.google.dev/gemini-api/docs/troubleshooting
- AQ 키 전환(포럼): https://discuss.ai.google.dev/t/bring-back-aiza-format-api-keys/170016 , https://discuss.ai.google.dev/t/my-api-key-is-only-aq-not-standard/172262 , https://dev.to/rapls/i-created-a-gemini-api-key-and-got-aq-instead-of-aiza-3dp3
- AI Studio 키 대화상자(3자): https://forum.arduino.cc/t/unable-to-use-the-cloud-llm-app-due-api-key-error/1449170
- Gemini 무료 한도 보고(3자, 불일치): https://www.cloudzero.com/blog/gemini-pricing/ , https://imisofts.com/blog/gemini-api-free-tier-limits/
- AI Studio와 Workspace(포럼): https://discuss.ai.google.dev/t/configuration-requirements-for-using-google-ai-studio-with-google-workspace-and-gcp/94050
- OpenAI 키·결제(3자): https://www.aifreeapi.com/en/posts/openai-api-key , https://byoklist.com/guides/openai-api-key
- Claude 키: https://platform.claude.com/docs/en/get-api-key
- Claude 결제(3자): https://blog.keysoft.tech/posts/anthropic-api-keys-credits-cost.html
- Anthropic CORS 헤더: https://simonwillison.net/2024/Aug/23/anthropic-dangerous-direct-browser-access
- OpenRouter OAuth PKCE: https://openrouter.ai/docs/guides/overview/auth/oauth , https://openrouter.ai/docs/api/api-reference/oauth/exchange-authorization-code-for-api-key
- OpenRouter 콜백 제약(엇갈림): https://github.com/mrgoonie/openrouter-cli/blob/main/plans/reports/researcher-260417-1442-openrouter-api-reference.md , https://github.com/ai-ecoverse/slicc-jerk/issues/110
- OpenRouter 무료 한도: https://openrouter.ai/docs/faq , https://freellm.net/providers/openrouter
- OpenRouter 무료 라우터·데이터: https://openrouter.ai/openrouter/free , https://openrouter.ai/docs/guides/privacy/provider-logging
- OpenRouter 수수료: https://usagebox.com/articles/openrouter-pricing-2026
- Puter User-Pays: https://docs.puter.com/user-pays-model/ , https://docs.puter.com/rate-limits-and-quotas/ , https://docs.puter.com/Auth/signIn/ , https://github.com/HeyPuter/puter/issues/1704
- Chrome Prompt API: https://developer.chrome.com/docs/ai/prompt-api , https://developer.chrome.com/docs/ai/built-in-apis , https://developer.chrome.com/docs/modern-web-guidance/guides/built-in-ai/language-model
- Sign in with ChatGPT: https://thenewstack.io/sign-in-with-chatgpt/ , https://www.developersdigest.tech/blog/sign-in-with-chatgpt-coding-agents-plan-usage-2026
