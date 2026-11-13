# AI 연결 조사: 키 없이, 또는 키를 쉽게 (2026-11)

- 조사일: 2026-11-09. 대상: 서버 없는 정적 웹앱(lecpage)에서 비개발자 교사가 AI를 쓰는 가장 쉬운 길.
- 방법: 웹 검색 결과(공식 문서 우선)로 확인했습니다. 이 조사 환경에서는 제공자 도메인(ai.google.dev, openrouter.ai 등)을 직접 열 수 없어, 공식 페이지는 검색 색인 내용으로 확인했습니다. 출처끼리 다르면 **(불일치)**, 직접 확인하지 못한 것은 **(미확인)**으로 표시했습니다.
- 원칙: 구독 계정 로그인(ChatGPT Plus·Claude Pro 등)을 앱이 빌려 쓰는 방법은 약관 위반이라 쓰지 않습니다.

- **2026-11-13 갱신**: 연결 단순화 — 처음에 두 길(쓰던 챗봇 창 · API 키)을 고르고 기억, 프롬프트 1.4만 자 아래, 교재 지킴이. 아래 5절.
- **2026-11-12 갱신**: 아래는 11-09 조사 기록입니다. 그 뒤 공식 문서를 직접 읽어 바뀐 점: (1) OpenRouter 로그인은 고르는 화면에서 뺐습니다(낯선 서비스라 초보자에게 오히려 어려움. 저장해 둔 연결은 동작). (2) 앱의 순서는 키 연결이 기본이고 ChatGPT·Claude가 먼저이고 Gemini(무료)는 작은 단추로 둡니다(무료 키는 Flash 모델까지만 되고 한도가 있어 결과가 단순할 수 있음). (3) 최소 충전액, OpenAI 버튼 이름, Gemini 키 앞글자(`AQ.`)는 공식 문서에서 확인하지 못해 앱 문구에서 뺐습니다. (4) Claude Max·Team 등 일부 구독에는 API 크레딧이 들어 있습니다. (5) 모델 추천은 가격·출시일 기준으로 바뀌었습니다([`zero-cost-2026-11.md`](zero-cost-2026-11.md) §5). 지금 기준은 앱의 `app/src/lib/ai-guides.jsx` 머리말과 `ai.js`입니다.

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

## 5. 연결 단순화 (2026-11-13)

운영자 결정: 앱의 구조(교재를 넣고 만들 때 AI를 연결해 AI가 사이트를 짬)는 그대로 두고 **연결하는 일만 쉽게**. "AI 없이 만들기를 기본으로"는 하지 않음(품질이 떨어지고 결국 연결해야 해서 실망). 진짜 장벽은 키 복사보다 **API 결제 등록**(ChatGPT Plus를 내도 API는 따로 결제)이라, 많은 교사에게 가장 쉬운 연결은 이미 쓰는 챗봇 창.

### 5-1. 두 길(연결 창 첫 화면)

| 길 | 준비 | 돈 | 만들 때 | 화면 |
|---|---|---|---|---|
| **쓰던 챗봇 창으로 만들기** | 없음 | 추가 비용 없음(무료 계정도 됨) | 매번 복사·붙여넣기 | `AiPanel` Paste |
| **API 키 연결하기** | 처음 한 번 몇 분(결제 등록·키 복사) | 사이트 하나에 몇백 원쯤(Gemini 무료 키도 됨) | 버튼 한 번 | `AiConnect` |

- 고른 길은 이 브라우저에 기억(`lecpage:ai-way`). 다음에는 고르기 없이 그 길로. 교재 넣기 화면에 "쓰던 챗봇 창으로 만들어요 · 바꾸기" 한 줄(`AiWayLine`), 키가 있으면 지금처럼 연결 상태 한 줄(`AiStatus`).
- 예전의 작은 [키 없이 만들기]는 정식 길로 올렸고 이름을 하는 일로 바꿈(부정형 이름 없앰).

누르는 횟수(앱 안. 바깥 사이트에서 하는 일은 괄호)

| 경우 | 전 | 후 |
|---|---|---|
| 챗봇 길, 처음 | 4: 만들기 → 작은 [키 없이 만들기] → [ChatGPT 열기] (붙여넣기·보내기·답 복사) → [답 붙여넣기] | 4: 만들기 → [쓰던 챗봇 창으로 만들기] → [ChatGPT 열기] (같음) → [답 넣기] |
| 챗봇 길, 두 번째부터 | 4(매번 연결 창을 거침) | **3**: 만들기 → [ChatGPT 열기] → [답 넣기]. PC는 돌아와 Ctrl+V만 눌러도 됨(2 + 키 하나) |
| 챗봇 길, Claude | 바깥에서 붙여넣기 필요 | 프롬프트가 13,900자 이하면 **입력 칸이 채워진 채 열림**(바깥에서 보내기만) |
| 키 길, 처음 | 4: 만들기 → 결제 페이지 → 키 페이지 → [붙여넣기] | 5(길 고르기 한 번 더). 연결 뒤에는 1(같음) |
| 결제 없음 오류 | [결제 페이지 열기]·[다른 AI 연결]만 | 주 버튼 **[쓰던 ChatGPT로 만들기]**(Claude 키면 Claude) → 그 챗봇이 먼저인 챗봇 창 |

### 5-2. 챗봇 창 길 세부

- **[ChatGPT 열기]·[Claude 열기]·[Gemini 열기]** 한 번에 프롬프트 복사 + 새 창. 복사는 누르는 순간 동기로(대화상자 안 임시 글 칸 + `execCommand`, 안 되면 Clipboard API) — 새 창이 열려 이 창이 초점을 잃으면 비동기 복사가 막히는 브라우저가 있어서. 링크(`<a target=_blank>`)라 팝업 차단에 걸리지 않음. 지난번에 쓴 챗봇이 맨 앞·주 버튼(`lecpage:chatbot`).
- **Claude 프리필**: `https://claude.ai/new?q=` + 프롬프트(인코딩). 프롬프트가 `PREFILL_MAX` 13,900자 이하일 때만, 그래도 클립보드에는 늘 복사(입력 칸이 비어 있으면 붙여 넣으면 됨). 근거·한계:
  - 공식 문서(support.claude.com/en/articles/14729294 "Open Claude Desktop with a link", 2026-11-13 읽음)는 **데스크톱 앱의 `claude://claude.ai/new?q=`** 를 설명하고 "q는 약 14,000자에서 잘림, 자동으로 보내지 않음"이라고 함. 웹 주소 `https://claude.ai/new?q=`는 같은 경로이고 널리 쓰이지만(크롬 주소창 검색 등록 등) **웹의 길이 한도는 문서에 없음**.
  - 한국어 1.3만 자를 인코딩하면 주소가 약 58KB. claude.ai 앞단(Cloudflare)은 64KB 주소까지 414 없이 받았음(이 환경에서 로그인 없이 GET으로 확인, 그 위는 이 환경의 프록시 한도라 못 잼). 로그인한 실제 브라우저에서 1.3만 자 프롬프트가 채워지는지는 **운영자가 한 번 확인할 일**. 안 되면 `CHATBOTS`의 `prefill`만 지우면 됨(복사+열기로 돌아감).
  - ChatGPT `?q=`는 공식 문서가 없어 쓰지 않음. Gemini는 프리필 주소가 없음.
- **돌아오면**(focus·visibilitychange) 2걸음으로 넘어가 **[답 넣기]에 초점·깜빡임**. 누르면 그때만 클립보드를 읽음. 못 읽으면(권한 거절·iOS) 붙여넣기 칸에 초점 + "길게 눌러 [붙여넣기]" 안내. 대화상자 어디서든 Ctrl+V도 받음.
- **답 읽기**(엔진 `readAnswer`): 프롬프트 끝 줄 뒤만 답으로 보고(대화 전체를 붙여 넣어도 됨), 코드 블록·앞뒤 설명을 걸러 짝 맞는 `{…}` 중 설계도처럼 생긴 것을 고름. 가려내는 경우:
  - 끊긴 답 → "답이 중간에 끊겼어요" + [이어 쓰기 요청 복사](`CONTINUE_ASK`) → 이어진 답을 [이어진 답 넣기]로 넣으면 앞 답 뒤에 붙임(`joinAnswer`: 겹친 곳 한 번만, "이어서 쓸게요" 같은 앞 설명 줄 빼기, 처음부터 다시 쓴 답이면 그것만).
  - JSON 없이 질문 → "챗봇이 답 대신 질문을 했어요" + [다시 요청 글 복사](`JSON_ONLY_ASK`: "질문이나 설명 없이, 모르는 것은 빈칸으로 두고 … JSON 하나만"). 설명만 한 답도 같은 버튼.
  - 프롬프트를 붙여 넣음 → "붙여 넣은 글이 프롬프트예요. 챗봇이 쓴 답을 복사해 주세요."
- **휴대폰**(390, 터치 흉내): 길 고르기·챗봇 창 가로 넘침 0, 누르는 곳 모두 44px 이상, 안내 문구가 "길게 눌러 붙여넣기"로, 앱 전환 뒤 돌아오면 [답 넣기] 초점, 클립보드를 못 읽으면 붙여넣기 칸(글자 16px)에 초점 → 붙여 넣어 만들기까지 됨(`ai-chat.js`).

### 5-3. 프롬프트 줄이기(모든 길)

같은 교재(실습형 practice-ai-lesson.pptx, `lecpage.mjs prompt`), 토큰은 o200k_base로 셈.

| | 글자 | 토큰 |
|---|---:|---:|
| 601f1d7(조사 때) | 19,751 | 9,903 |
| main ffc950a(교재 충실도 반영) | 19,904 | 10,037 |
| **이번** | **13,646** | **6,585**(−34%) |
| 앱 경로(연수 정보 포함) main → 이번 | 20,450 → **13,773** | 10,246 → **6,619** |
| 체험 교재 workshop.pptx(앱) | — → 12,377 | Claude 채움 주소에 들어감 |

같은 글을 두 번 보내지 않는 것이 대부분(품질에 쓰이는 규칙·형식·컨셉·문구 규칙·교재 속 지시 무시 규칙은 그대로):
1. **교재 줄 ↔ 초안**(−2,400자): 초안에 그대로 옮긴 교재 줄은 교재 쪽에서 뺌(표 칸·링크·문장 조각이 모두 초안에 있을 때만, 말끝 '~다/~어요' 차이는 같은 것으로). 줄이 다 빠진 쪽은 머리줄도 빼고 "(초안에 모두 옮긴 쪽: p.3·5·…)" 한 줄. 초안에 없는 줄(노트·일시 표기·메일 등)은 그대로.
2. **초안 안의 겹침**(−900자): 실습 칸 프롬프트를 그대로 모은 프롬프트 모음 items, 도구 모음과 같은 접속 확인 checks는 빼고 "비워 두면 엔진이 채움"(교재 지킴이가 채움). 연수 정보와 같은 meta 값, meta와 같은 첫 화면 글, 엔진 기본 첫 화면 버튼, 도구 그림 이름, 실습 제목 끝과 같은 짧은 이름, 강사 이력 중 직함과 같은 줄도 뺌.
3. **안내 줄이기**(−1,400자): 엔진이 고른 흐름만 큰 줄기까지(다른 흐름은 이름만), 초안에 이미 있는 칸의 신호 줄은 뺌, 초안이 있으면 '섹션 순서(기본)' 뺌, 켜지 않은 참여 기능 칸(qa·board·poll·attendance) 필드 안내 뺌, 형식에서 live·privacy·강사 메일(강사 값으로만 정해짐) 뺌, 연수 정보 JSON을 한 줄로·빈 값 뺌.
4. 교재 보기(deck)는 이미 AI가 쓰지 않음(쪽 그림·쪽 글은 엔진이 채움). 프리셋은 엔진이 고른 6종 그대로(시험이 6종을 확인).

검증: 엔진 시험 326개 통과(새 `guard.test.mjs` 13개 포함), 흉내 답(초안 기반)이 검증·빌드를 통과.

### 5-4. 교재 지킴이(guardMaterial)

어떤 AI로 만들든(키·쓰던 챗봇·에이전트) 결과는 lecpage로 이어지고 **교재 글은 엔진이 지킴**. 엔진 `src/guard.js`, 앱 `guardAnswer`(blueprint.js) → `keepDraftParts`, CLI `guard`.
- 같은 교재로 만든 초안과 AI 답을 견줘 **프롬프트 원문 · 실습 단계(순서·빠진 것·교재에 없는 단계) · 일정 시각·제목 · FAQ 질문·답 · 목표 문장 · 교재의 링크**가 바뀌거나 빠졌으면 교재대로. 교재·초안·강사 값에 없는 주소는 뺌(링크 목록은 항목째, 도구는 주소만, 글 칸 링크는 글자만).
- 건드리지 않음: 섹션 순서·구성, 제목·소개·설명·확인 문장·메모, 디자인·컨셉. 빠진 칸(목표·일정·실습·FAQ)은 초안 순서를 보고 알맞은 자리에. 앞뒤 버튼 이름만 덜어 낸 프롬프트·내용·방식으로 나눠 옮긴 일정 제목은 그대로 둠.
- 앱: 답을 넣은 직후 진행 띠에 "교재와 달라진 N곳을 교재대로 되돌렸어요 [보기]" → 곳마다 AI 답 / 교재 견주기, [AI 답으로 되돌리기](그곳만, `undoRestore` — 강사가 고친 다른 곳은 그대로). 다른 칸과 같은 목록을 채운 것은 조용히(세지 않음).
- 효과(교재 practice-ai-lesson, facts-practice.json, `site-score.mjs`. 교재 보기의 쪽 글이 모든 글을 담아 고쳐 쓴 곳을 가리므로 세 경우 모두 교재 보기를 빼고 잼):

| 답 | 핵심 항목 | 프롬프트 원문 | 교재에 없는 주소 |
|---|---:|---:|---:|
| 좋은 답(스킬 결과) | 60/61 | 9/9 | 0 |
| 흉내 무료 챗봇 답(프롬프트 3개 고쳐 씀·단계 1·FAQ 1 뺌·시각 1 바꿈·목표 말끝·지어낸 주소 2) | 57/61 | 6/9 | 2 |
| 그 답 + 교재 지킴이 | **60/61** | **9/9** | **0** |

  되돌린 곳 9(목표 1·시각 1·FAQ 1·단계 1·프롬프트 3·주소 2), 좋은 답에서는 0. 빠진 1개(장소)는 원래 답에서도 빠진 것.

### 5-5. 오류 안내(새 두 길에 맞춤)

| 경우 | 전 | 후 |
|---|---|---|
| 결제 없음(OpenAI·Claude) | "크레딧이 없어요." [결제 페이지 열기] [다른 AI 연결] | "API 크레딧이 없어요. ChatGPT 구독과 API 결제는 따로예요. 지금은 쓰던 ChatGPT 창으로 만들 수 있어요…" **[쓰던 ChatGPT로 만들기]**(주 버튼) [OpenAI 결제 페이지 열기] |
| 키가 틀림 | [키 페이지 열기] | + [쓰던 ○○로 만들기] |
| 한도·이번 달 금액·서버 바쁨·모델 없음·거절 | (일부만 챗봇 길) | 모두 [쓰던 ○○로 만들기]가 함께 |
| Gemini 휴대폰 확인·결제 연결 프로젝트 | [확인 페이지]·[다른 AI 연결] | + [쓰던 Gemini로 만들기] |
| 진행 띠의 결제 안내 | 결제 링크 없음 | [○○ 결제 페이지 열기] |
| 챗봇 답 | 끊김·형식만 | 끊김(이어 받기)·질문만·설명만·프롬프트를 붙여 넣음·빈 답 |

버튼 이름은 회사의 챗봇 이름으로(`chatLabel`): OpenAI 키 → "쓰던 ChatGPT로 만들기", Claude 키 → "쓰던 Claude로 만들기". 누르면 그 챗봇이 맨 앞인 챗봇 창(구성까지 새로 짜기 켜짐).

### 5-6. 확인

- 엔진 시험 326 통과. 앱 빌드. 문구 검사 고칠 곳 0(바꾼 파일 모두). 동작 검사(앱) 통과 54·실패 0.
- e2e(흉내 응답, 실제 키·챗봇 로그인 없음): ai-flow·ai-quota·ai-paid·ai-models·ai-errors(길 고르기를 거치게 고침) + 새 ai-chat(챗봇 길 전체·결제 없음 → 챗봇 길·휴대폰) 모두 통과.

### 5-7. 남은 일

- 로그인한 실제 브라우저에서 `claude.ai/new?q=`에 1.3만 자 한국어 프롬프트가 채워지는지(웹 한도 문서 없음). 안 되면 `PREFILL_MAX`를 줄이거나 `prefill`을 뺌.
- 무료 ChatGPT·Gemini가 1.3만 자 입력 + 설계도 JSON(4~8천 자)을 끊지 않고 답하는지 실제 계정으로 몇 번(끊기면 이어 받기가 있음).
- 도움말 글·캡처(`help-shots.mjs`의 연결 창 두 장) 다시 뽑기. Sign in with ChatGPT 관심 신청(운영자).
- 교재 지킴이가 고친 곳을 실제 무료 모델 답으로 더 모아 문턱값(닮음 0.3·0.35) 다듬기.

## 출처

- Claude 데스크톱 링크(q 약 14,000자에서 잘림): https://support.claude.com/en/articles/14729294 · 모바일 앱 링크: https://support.claude.com/en/articles/14898120
- Cloudflare 주소 길이: https://developers.cloudflare.com/fundamentals/reference/connection-limits/

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
