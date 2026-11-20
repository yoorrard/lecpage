# AI가 사이트를 직접 짜는 구조로 바꿀 때 확인할 사실 (2026-11-20)

- 확인한 날: 2026-11-20. 질문: 코드가 교재 글을 뽑아 정해진 틀을 채우는 대신, **AI가 원본 교재(또는 코드가 그린 쪽 그림)를 직접 읽고 사이트 코드(HTML/CSS/JS)를 자유롭게 짜면**, 앱은 미리보기·고치기·점검·배포만 맡습니다. 이 구조에 필요한 사실을 모았습니다.
- 앞선 확인: [`ai-facts-2026-11-14.md`](ai-facts-2026-11-14.md)(모델 값·오류 모양·키·CORS 사전 요청), [`ai-connect-alternatives-2026-11.md`](ai-connect-alternatives-2026-11.md)(Sign in with ChatGPT, OpenRouter, 챗봇 프리필). 거기 있는 사실은 되풀이하지 않습니다.
- 방법
  - 공식 문서의 마크다운 판(`platform.claude.com/docs/*.md`·`llms-full.txt`, `developers.openai.com/*.md`, `ai.google.dev/*.md.txt`→`aistudio.google.com/docs/*.md`, `code.claude.com/docs/*.md`, `learn.chatgpt.com/docs/*.md`, `support.claude.com/*.md`)을 이 환경에서 직접 받아 읽었습니다.
  - CORS는 `Origin: https://lecpage.com`으로 사전 요청(OPTIONS)을 직접 보내 확인했습니다(키 없이). 실제 AI 생성 호출은 하지 않았습니다.
  - Chrome 기능 상태는 chromestatus API, 현재 안정판은 chromiumdash, WebKit 버그 상태는 bugs.webkit.org REST API로 확인했습니다.
  - **직접 못 읽은 곳**: `help.openai.com`(403·DNS 차단), `support.mozilla.org`(봇 확인 화면). 이 두 곳에 기대는 내용은 "검색 색인 기준(미확인)"으로 표시했습니다.
- 표시: **(확인)** = 공식 원문이나 직접 요청으로 확인, **(검색)** = 검색 결과 요약만 봄, **(미확인)** = 근거를 못 찾음, **(제안)** = 사실이 아니라 이 문서의 판단.

---

## 0. 결론과 권장

### 0.1 한 줄 요약

| 길 | 원본 교재 읽기 | 긴 HTML 받기 | 탭이 잠들 때 | 권장 |
|---|---|---|---|---|
| **API 키(브라우저 직접)** | 세 회사 모두 PDF를 그대로 보냄. Gemini 4는 PPTX·DOCX도 쪽 그림으로 읽음 | 한 번에 128K(Claude·GPT)·65,536(Gemini) 토큰 | **OpenAI·Gemini는 서버가 끝까지 돌리고 나중에 받는 방식이 브라우저에서 됨**. Claude는 안 됨(이어 쓰기 요청으로 복구) | 품질·안정성 1순위 |
| **내 PC의 Claude Code·Codex(다리 프로그램)** | 디스크의 PDF·그림을 에이전트가 직접 읽음(Claude Code는 20쪽씩) | 에이전트가 **파일로 씀** → 답 길이에 안 잘림 | PC 프로그램이 계속 돎 | 정책 회색지대(아래 0.3). 사용자가 켜는 선택 기능으로 |
| **쓰던 챗봇 창(키 없음)** | PDF 첨부는 세 곳 모두 됨(Claude는 100쪽까지만 그림까지 봄). PPTX는 Claude 목록에 없음 | 한 답의 최대 길이는 세 곳 모두 공식 숫자 없음 → 잘릴 수 있음 | 해당 없음 | 짧은 사이트·무료 사용자용. 붙여 넣은 답을 앱이 이어 붙이고 검사 |

### 0.2 API 키 길에서 바로 쓸 것 (사실 기반)

1. **Claude**: 브라우저에서 되는 것은 `/v1/messages`(+`/v1/models`, `/v1/messages/count_tokens`)뿐입니다. **`/v1/files`와 `/v1/messages/batches`는 사전 요청에 `400 Disallowed CORS origin`**(확인, 1.1). 그래서 PDF는 base64로 본문에 넣고(요청 128MB, 600쪽), 항상 스트리밍으로 받고, 끊기면 "받은 데까지 + 이어서 써 줘"를 **사용자 메시지로** 다시 보냅니다(Claude 4.6 이후는 assistant 프리필이 400).
2. **OpenAI**: Responses API의 **`background: true` + `stream: true` + `store: true`**가 브라우저에서 됩니다(POST·GET·DELETE 모두 CORS `*`, 확인). 연결이 끊기면 `GET /v1/responses/{id}?stream=true&starting_after=<마지막 sequence_number>`로 이어 받고, 다 받으면 `DELETE`로 지웁니다. `store`를 빼면 결과가 **약 10분** 뒤 지워져 탭이 오래 잠들면 못 받습니다.
3. **Gemini**: Interactions API(2026-06 정식, 새 프로젝트 권장)의 **`background: true`**가 브라우저에서 됩니다(CORS 확인). 단 **`store: false`와 같이 못 씀(400)** → 지금 앱이 `generateContent`에 넣는 `store:false` 원칙과 부딪힙니다. 무료 등급은 하루, 유료는 55일(7·14·28·55일 중 고름) 보관 → 받은 뒤 지우기. Gemini 4는 PPTX·DOCX를 쪽 그림(쪽당 약 560토큰)으로 읽습니다.
4. **새로 나온 모델(11-14 이후)**: OpenAI GPT-6.2 Astra·6.2 Sol(11-17, 모델 목록이 "잘 모르면 GPT-6.2 Astra"로 바뀜), Gemini 4 Neon(11-18, 유료 전용 $3/$15). 매일 자동 갱신(`ai-catalog.json`)이 잡아야 할 이름입니다.

### 0.3 내 PC의 Claude Code·Codex를 앱이 부르는 길 (정책)

- **Anthropic**(확인, 3.1): Claude Code 문서는 "**고치지 않은 Claude Code 프로그램에 사용자가 자기 구독으로 로그인하는 것은 막지 않는다**"고 적고, 동시에 "Anthropic은 제3자 개발자가 claude.ai 로그인이나 **rate limits(구독 한도)**를 자기 제품에 제공하는 것을 허용하지 않는다(사전 승인 없이는)"고 적습니다(Agent SDK 문서). lecpage 다리가 사용자의 `claude`를 실행하는 것은 앞 문장에 가깝지만 뒤 문장과도 겹칩니다. → **(제안)** 운영자가 Anthropic에 문의해 답을 받기 전까지는 '사용자가 직접 켜는 선택 기능'으로만, 토큰은 절대 만지지 않고, 자동·반복 호출은 하지 않습니다. 이미 있는 **Agent Skill 길(사용자가 Claude Code 안에서 lecpage 스킬을 씀)**은 평범한 Claude Code 사용이라 깨끗합니다.
- **OpenAI**(확인, 3.2): "Codex app-server 인증은 **상업용·호스팅 서비스에는 허용된 적이 없다**. 로컬·오픈소스 앱은 계속 써도 되지만 Sign in with ChatGPT로 옮기길 권한다." 그리고 **Sign in with ChatGPT의 요금제 사용은 오픈소스·로컬 앱에 열려 있음**(Plus·Pro, 콜백은 `http://127.0.0.1` 루프백만). → **(제안)** 다리를 오픈소스로 두면 Codex를 설치하지 않아도 다리가 직접 "ChatGPT로 계속"을 띄워 사용자의 Plus·Pro 요금제로 Responses API를 부를 수 있습니다. lecpage.com 웹앱 자체는 원격 호스팅이라 관심 신청서가 필요합니다(11-13 문서와 같음).

### 0.4 lecpage.com이 내 PC 프로그램과 이야기하는 법 (브라우저 규칙)

- Chrome(지금 안정판 159): 142부터 공개 사이트 → `127.0.0.1`·`localhost` 요청에 **권한 창**, 145부터 권한 이름이 `loopback-network`로 갈라짐, 147부터 **WebSocket도** 포함(확인). Firefox는 151부터 단계적으로 같은 권한 창(검색). **Safari는 https 페이지에서 `http://127.0.0.1` 요청을 혼합 콘텐츠로 막음**(WebKit 버그 171934 아직 NEW, 확인).
- **권장(제안)**: 다리 프로그램이 **앱 전체를 `http://127.0.0.1:<포트>/`에서 직접 보여 주고** 그 주소를 기본 브라우저로 엽니다. 같은 출처라 권한 창도 혼합 콘텐츠 문제도 없고 Safari에서도 됩니다. 이음오피스는 아예 Electron 데스크톱 앱입니다(3.4).

### 0.5 교재 쪽 그림

- PDF는 지금처럼 브라우저 pdf.js로 그립니다(긴 변 1,600~2,000px면 세 회사 모두 충분, 4절). `pdfjs-dist`는 앱이 4.10.38, 최신은 6.5.438(2026-11-01).
- PPTX·HWP/HWPX를 브라우저에서 그림으로 그리는 오픈소스는 2026년에 꽤 생겼습니다(PPTX: `@aiden0z/pptx-renderer` Apache-2.0 등, HWP/HWPX: `@rhwp/core` MIT). 다만 **충실도는 만든 사람 주장뿐이고 한글 글꼴 대체 문제가 있어** 직접 시험 전에는 보조로만. 가장 확실한 길은 여전히 "PDF로 저장해 올려 주세요"(제안).

### 0.6 AI가 짠 JS를 바로 배포 호스트에 올리려면

- 비교 대상: Netlify Drop은 피싱 때문에 **익명 사이트를 주인이 가져가기 전까지 암호로 잠그고, 1시간 안에 안 가져가면 지움**(Netlify 공식 블로그). Cloudflare는 임시 계정을 만들어 주고 **60분 안에 가져가지 않으면 지움**. GitHub Pages는 "비밀번호·카드 번호 같은 민감한 거래에 쓰지 말 것".
- **(제안)** 사이트마다 다른 출처(지금 `s-<id>.lecpage-view.pages.dev`) + `connect-src`를 실시간 방 주소로만, `form-action 'none'`, `img-src` 좁힘, 인라인 스크립트는 올릴 때 해시를 계산해 CSP에 넣기, 비밀번호 칸·외부 로그인 흉내는 올리기 전 검사로 거절. CSP로 못 막는 것(최상위 이동으로 정보 빼기)이 남는다는 점을 문서화(5절).

---

## 1. API를 브라우저에서 바로 부를 때 (파일·그림 포함)

### 1.1 CORS 사전 요청 결과 (2026-11-20, `Origin: https://lecpage.com`, 확인)

| 회사 | 주소 | 결과 |
|---|---|---|
| Anthropic | `POST /v1/messages`, `/v1/models`, `/v1/messages/count_tokens` | 200, `access-control-allow-origin: *` (머리글 `anthropic-dangerous-direct-browser-access` 허용 목록에 있음) |
| Anthropic | `POST /v1/messages/batches`, `/v1/files`, `/v1/messages/batches/{id}` | **400 `Disallowed CORS origin`**. 실제 요청 응답(401)에도 `access-control-allow-origin` 없음 → 브라우저에서 못 씀 |
| Anthropic | `/v1/sessions`, `/v1/agents`(Managed Agents) | 405 → 못 씀 |
| OpenAI | `POST /v1/responses`, `GET`·`DELETE /v1/responses/{id}` | 200, `allow-origin: *` |
| OpenAI | `POST /v1/files` | 200, `allow-origin: https://lecpage.com` |
| Google | `models/*:streamGenerateContent?alt=sse`, `POST /v1beta/interactions`, `GET /v1beta/interactions/{id}` | 200, `allow-origin: https://lecpage.com`, `content-type,x-goog-api-key` |
| Google | `POST /upload/v1beta/files`(재개 가능한 업로드 머리글 포함) | 사전 요청 200. 단 오류 응답의 `access-control-expose-headers`에 `X-Goog-Upload-URL`이 없음 → **성공 응답에서 업로드 주소 머리글을 읽을 수 있는지는 미확인**(키가 있어야 봄) |

### 1.2 Anthropic Claude 5.x

| 항목 | 사실 | 출처 |
|---|---|---|
| (a) CORS | 위 표. 직접 호출은 `anthropic-dangerous-direct-browser-access: true` 필요(11-14 확인 그대로) | 1.1, [authentication](https://platform.claude.com/docs/en/manage-claude/authentication.md) |
| (b) PDF | `document` 블록에 base64(파일 ID는 Files API가 필요해 브라우저에선 못 씀). **요청 전체 128MB, 600쪽(문맥 창 1M 미만 요청은 100쪽)**. 쪽마다 글자(쪽당 1,500~3,000토큰)와 쪽 그림(쪽당 최대 1,568 시각 토큰)이 함께 들어감. 빽빽한 PDF는 쪽 한도 전에 문맥이 찰 수 있음. `.docx`·`.xlsx`는 document 블록 불가 → 글이나 PDF로 바꿔야 함 | [pdf-support](https://platform.claude.com/docs/en/build-with-claude/pdf-support.md) |
| (c) 그림 | 요청당 **600장**(200K 문맥 모델은 100장), claude.ai는 메시지당 20장. 한 장 최대 8000×8000px, base64 10MB. **20장 넘게 넣으면 장마다 더 엄격한 크기 제한**(각 변 3,000px 아래 권장). 토큰 = ⌈가로/28⌉×⌈세로/28⌉. **Claude 4.7 이후(Opus 5.5 포함)는 고해상도 등급: 긴 변 2,576px·최대 4,784토큰**(그 밖 1,568px·1,568토큰). 예: 1920×1080 → 2,691토큰, 1000×1000 → 1,296토큰 | [vision](https://platform.claude.com/docs/en/build-with-claude/vision.md) |
| (d) 출력 | Fable 5.2·Opus 5.5·Sonnet 5.5·Haiku 5.5 모두 **동기 요청 최대 128K 토큰**, 문맥 1M. Batches는 베타 머리글로 300K(브라우저에선 못 씀) | [models/overview](https://platform.claude.com/docs/en/models/overview.md) |
| (d) 스트리밍 | SSE(`event:` 이름 + `data:` JSON): `message_start` → `content_block_start` / `content_block_delta`(`text_delta`) / `content_block_stop` → `message_delta`(`stop_reason`) → `message_stop`, 중간에 `ping`, 오류는 `event: error` | [streaming](https://platform.claude.com/docs/en/build-with-claude/streaming.md) |
| (d)(e) 긴 요청 | "스트리밍이나 Batches 없이 큰 `max_tokens`를 쓰지 말 것: 일부 네트워크는 쉬는 연결을 끊음". SDK는 스트리밍 아닌 요청이 **10분**을 넘을 것 같으면 막음. 시간 초과는 504(또는 500) `timeout_error` | [errors#long-requests](https://platform.claude.com/docs/en/api/errors.md) |
| (f) 이어 쓰기 | **Claude 4.6 이후는 마지막 assistant 프리필이 400**. 공식 복구: 받은 데까지 저장 → 새 요청에 **사용자 메시지**로 "Your previous response was interrupted and ended with [previous_response]. Continue from where you left off." `tool_use`·`thinking` 블록은 중간부터 복구 불가(마지막 text 블록부터). `stop_reason: max_tokens`도 같은 방식("Please continue from where you left off.") | streaming.md "Error recovery", [handling-stop-reasons](https://platform.claude.com/docs/en/build-with-claude/handling-stop-reasons.md), llms-full "Prefilling is not supported on Claude 4.6 and later" |
| (f) 비동기 | Message Batches(대부분 1시간 안, 최대 24시간, 결과 29일)뿐이고 **브라우저 CORS 막힘**(1.1) → 탭이 잠들면 스트림이 끊기고 위 이어 쓰기로만 복구 | [batch-processing](https://platform.claude.com/docs/en/build-with-claude/batch-processing.md) |

- 앱 현재 상태: `ai.js`가 이미 스트리밍(`stream: true`)·`max_tokens ≥ 32000`·직접 호출 머리글을 씀. AI가 사이트 전체를 짜면 `max_tokens`를 64K~128K로 올리고, 끊겼을 때 위 공식 문구로 이어 받는 처리가 필요합니다(제안).
- 참고: Anthropic **Linked billing(베타)** — 앱이 자기 조직에서 Claude를 돌리고 비용만 사용자의 Console 조직에 청구. 구독 요금제는 연결 불가, 앱 쪽 등록·서버가 필요한 구조로 보임(세부 미확인). [support 18467148](https://support.claude.com/en/articles/18467148-use-your-claude-platform-account-in-a-third-party-app.md)

### 1.3 OpenAI GPT-6.x (Responses vs Chat Completions)

| 항목 | 사실 | 출처 |
|---|---|---|
| 모델 | 목록 첫 줄이 **"잘 모르면 GPT-6.2 Astra, 균형은 GPT-6.2 Sol, 대량은 GPT-6 Luna"**(11-17 출시). 6.2 Astra $8/$40, 6.2 Sol $2/$10, 6.1 Terra $1/$5, 6 Luna $0.10/$0.50. 모두 문맥 1,050,000·입력 최대 922,000·**출력 최대 128,000**, 글·그림 입력. 6.2는 Responses·Chat Completions 둘 다 되지만 **도구 호출은 Responses만** | [models](https://developers.openai.com/api/docs/models.md), [gpt-6.2-astra](https://developers.openai.com/api/docs/models/gpt-6.2-astra.md), [changelog](https://developers.openai.com/api/docs/changelog.md) 11-17 |
| (a) CORS | 1.1 표(키는 `Authorization: Bearer`) | 1.1 |
| (b) PDF | Responses `input_file`: `file_data`(base64 data URL)·`file_id`·`file_url`. **PDF는 글자와 쪽 그림을 함께** 모델에 줌(그림 입력 되는 모델). `detail`: `auto`·`low`·`high`(GPT-5.6 이후 `auto`=`high`). **파일마다 50MB 미만, 요청 안 파일 합계 50MB**. 쪽 수 한도는 문서에 없음(미확인). Chat Completions는 **PDF만**(`file` 부분), `detail` 없음 | [file-inputs](https://developers.openai.com/api/docs/guides/file-inputs.md) |
| (b) 다른 형식 | Responses는 `.docx`·`.pptx`·`.odt`·Keynote 등도 받지만 **글자만 뽑음(안의 그림·도표는 안 넣음)** → "도표를 살리려면 PDF로 바꿔 보내라"고 명시. HWP는 목록에 없음 | file-inputs.md |
| (c) 그림 | 요청당 **1,500장**, 요청 512MB. 32px 조각(patch) 단위, 한 장 3만 조각 넘으면 거절. `gpt-6-astra`의 `high`는 최대 2,500조각×1.2 = **약 3,000토큰**(1024×1024 → 1,229토큰). `original`은 원래 크기. 표에 6.1·6.2 값은 아직 없음(미확인) | [images-vision](https://developers.openai.com/api/docs/guides/images-vision.md) |
| (d) 스트리밍 | `stream: true` → SSE 의미 이벤트: `response.created`, `response.output_text.delta`, `response.completed`, `error` 등. WebSocket 방식도 있음 | [streaming-responses](https://developers.openai.com/api/docs/guides/streaming-responses.md) |
| (d) 잘림 | 한도에 닿으면 `status: "incomplete"`, `incomplete_details.reason: "max_output_tokens"`(보이는 글이 나오기 전에 생각 토큰만 쓰고 끝날 수도 있음). 처음에는 생각+출력에 **2만 5천 토큰 이상** 남기라고 권함 | [reasoning](https://developers.openai.com/api/docs/guides/reasoning.md) |
| (e) 시간 | SDK 기본 시간 제한 10분(배경 모드 예제 주석 "SDK's default ten minutes"). 서버가 스트리밍 아닌 요청을 몇 분에 끊는지는 문서에 없음(미확인) | [background](https://developers.openai.com/api/docs/guides/background.md) |
| (f) **배경 모드** | `background: true` → 바로 응답 ID. `GET /v1/responses/{id}`로 `queued`·`in_progress`가 끝날 때까지 폴링, `POST …/cancel`로 취소. 기본 창(`soonest`)에서 `stream: true`를 같이 주면 **끊겨도 `?stream=true&starting_after=<sequence_number>`로 이어 받음**(만들 때 스트리밍이 아니었으면 나중에 스트리밍 불가). `2h`·`8h` 창(공개 베타)은 30%·40% 할인, 스트리밍 안 됨 | background.md |
| (f) 보관 | 배경 모드는 `store:false`여도 임시 저장. **기본 창에서 `store`를 빼거나 false면 약 10분 뒤 지움**, `store:true`면 표준 보관(최소 30일) → 받은 뒤 `DELETE /v1/responses/{id}` | [your-data](https://developers.openai.com/api/docs/guides/your-data.md), [responses/delete](https://developers.openai.com/api/reference/resources/responses/methods/delete.md) |
| (f) 이어 쓰기 | `previous_response_id`로 앞 응답을 잇고 "이어서" 요청(대화 상태 가이드). GPT-6.2부터 앞부분을 고치면 생각 항목을 버림 → 앞부분을 바꾸지 말 것, 반복되는 지시는 맨 앞 `developer` 메시지로 | [conversation-state](https://developers.openai.com/api/docs/guides/conversation-state.md), [latest-model gpt-6.2](https://developers.openai.com/api/docs/guides/latest-model/gpt-6.2-astra.md) |

- 앱 현재 상태: `ai.js`는 OpenAI를 **Chat Completions**(`max_completion_tokens`)로 부릅니다. PDF 원본·배경 모드·이어 받기를 쓰려면 Responses로 옮겨야 합니다(제안).

### 1.4 Google Gemini 4 (Carbon·Argon·Neon·Hydrogen)·3.x Flash

| 항목 | 사실 | 출처 |
|---|---|---|
| API | **Interactions API가 2026-06 정식, 새 프로젝트 권장**. `generateContent`는 "legacy"지만 계속 지원. Batch API·명시적 캐시는 아직 Interactions에 없음 | [interactions-overview](https://aistudio.google.com/docs/interactions-overview.md) |
| 모델 | Gemini 4 Neon 11-18 정식(유료 전용 $3/$15, 생각 수준 4단계). Carbon·Argon 유료 전용, Hydrogen 무료 등급 됨(11-14 확인 그대로) | [changelog](https://aistudio.google.com/docs/changelog.md) |
| (a) CORS | 1.1 표 | 1.1 |
| (b) 문서 | **PDF 파일당 50MB·1,000쪽, Office/ODF는 2,000쪽**(인라인·Files API 모두). Gemini 4는 `.docx`·`.pptx`·`.odt`를 **쪽·슬라이드 그림(중간 해상도, 쪽당 약 560토큰)**으로 읽음(`.doc`·`.ppt`·`.odp`도 그림), Gemini 3·2.5는 `.docx`·`.pptx`를 글자(+안의 그림)로. PDF·Office 쪽은 Gemini가 **2메가픽셀(288DPI)**로 직접 그리므로 입력 해상도는 토큰과 상관없음. `processing.page_options`로 쪽 범위만 보내면 그만큼만 청구. `generateContent`(`inline_data`)와 Interactions(`type: "document"`) 둘 다 설명됨. HWP는 목록에 없음 | [document-processing](https://aistudio.google.com/docs/document-processing.md) (`?generate-content=true` 판도 같은 표) |
| (b) 크기 | 인라인 **요청당 100MB(PDF는 50MB)**, Files API 파일당 2GB·프로젝트 20GB·**48시간 보관**. 단 그림 이해 문서의 주석은 "인라인 요청 합계 20MB" → **문서끼리 불일치** | [file-input-methods](https://aistudio.google.com/docs/file-input-methods.md), [image-understanding](https://aistudio.google.com/docs/image-understanding.md) |
| (c) 그림 | 요청당 **3,600장**. Gemini 4·3 그림 토큰: 기본 1,120 / `low` 280 / `medium` 560 / `high` 1,120 / `ultra_high` 2,240(항목별만). PDF 권장은 `medium`(560, "OCR은 high로 올려도 거의 안 나아짐") | [media-resolution](https://aistudio.google.com/docs/media-resolution.md) |
| (d) 출력 | Gemini 4 모두 **한 응답 65,536토큰**(생각+출력), **long decode로 최대 1,048,576**. 3.8 Flash 65,536. 스트리밍 아닌 한 번(hop)은 Carbon·Argon **32,768**, Neon·Hydrogen 65,536 | [models/gemini-4-*](https://aistudio.google.com/docs/models/gemini-4-carbon.md), [long-decode](https://aistudio.google.com/docs/long-decode.md) |
| (d) 스트리밍 | `generateContent`: `…:streamGenerateContent?alt=sse`. Interactions: `stream: true` → SSE `interaction.created`, `interaction.status_update`, `step.start`/`step.delta`/`step.stop`, `interaction.completed`, `done` | [streaming](https://aistudio.google.com/docs/streaming.md) |
| (e) 시간 | 구글 문서: "일반 HTTP 요청은 보통 **60초** 뒤 닫힘" → 오래 걸리는 일은 배경 실행 | [background-execution](https://aistudio.google.com/docs/background-execution.md) |
| (f) **배경 실행** | Interactions `background: true` → `in_progress` 상태로 바로 돌아옴, `GET /v1beta/interactions/{id}`로 폴링, 스트림은 `last_event_id`로 이어 받음. 지원: gemini-4-carbon·argon·neon·hydrogen, gemini-3.8-flash. **`store=true` 필수(`store=false`면 400)**. 보관: 유료 55일(AI Studio에서 7·14·28·55일), **무료 1일** → 받은 뒤 삭제 | background-execution.md |
| (f) 이어 쓰기 | long decode: 배경 실행이면 서버가 64K마다 이어서 돌림, 아니면 "client-side continuation"(앞 hop 결과를 넣어 다시) | long-decode.md |

- 주의(제안): 무료 등급 내용은 "구글 제품 개선에 쓰일 수 있음"(11-14 문서). 배경 실행은 저장이 필수라, 무료 키 + 학생 정보가 든 교재 조합은 피하도록 안내해야 합니다.

### 1.5 세 회사 비교 — 탭이 잠들어도 결과를 받는 법

| | Claude | OpenAI | Gemini |
|---|---|---|---|
| 브라우저에서 서버 쪽 비동기 | **없음**(Batches·Files CORS 막힘) | Responses `background` | Interactions `background` |
| 끊긴 스트림 이어 받기 | 없음 → 이어 쓰기 요청(새 비용) | `starting_after` | `last_event_id` |
| 저장 필요 | 해당 없음 | `store:true` 권장(아니면 10분) | `store=true` 필수 |
| 원본 PDF | base64, 128MB·600쪽 | base64, 50MB | 인라인 50MB·1,000쪽 |
| PPTX 원본 | 안 됨 | 글자만 | Gemini 4는 슬라이드 그림 |

---

## 2. 쓰던 챗봇 창 (키 없음)

### 2.1 첨부와 읽기

| | ChatGPT | Claude.ai | Gemini 앱 |
|---|---|---|---|
| 첨부 한도 | 3시간에 80개, **무료는 하루 3개**(OpenAI FAQ 조각, 검색). 파일당 512MB·글 200만 토큰(2차 자료, 검색) | **파일당 500MB, 대화당 20개, 그림 8000×8000, PDF 1,000쪽**. 프로젝트 파일은 30MB(확인) | **한 번에 10개, 파일당 100MB**(영상 2GB), ZIP 10개·100MB, 파일 붙인 대화는 시간당 한도 있음(확인) |
| 받는 형식 | (미확인: 도움말 차단) API 기준: PDF는 글+쪽 그림, PPTX·DOCX는 글만 | PDF·DOCX·CSV·TXT·HTML·ODT·RTF·EPUB·JSON·XLSX(코드 실행 켜야), 그림 JPEG·PNG·GIF·WebP. **PPTX·HWP는 목록에 없음** | "대부분의 형식"(목록 없음). HWP 명시 없음 |
| 그림·배치까지 읽나 | (미확인) | **PDF 100쪽 이하만 그림·도표까지 봄, 101~1,000쪽은 글만. PDF 아닌 문서는 글만** | 문맥 1M(유료)이면 "약 1,500쪽 글" |
| 출처 | [검색](https://help.openai.com/en/articles/8555545-file-uploads-faq) | [8241126](https://support.claude.com/en/articles/8241126-upload-files-to-claude.md) | [14903178](https://support.google.com/gemini/answer/14903178?hl=en) |

### 2.2 긴 HTML 한 파일을 받는 법

| | 파일로 받기 | 한 답 최대 길이 |
|---|---|---|
| ChatGPT | 캔버스 오른쪽 위 **Download**, 형식은 내용에 따라(코드는 언어에 맞는 확장자). HTML 지원은 공식 문구 없음(검색). 'Work' 모드는 문서·발표·스프레드시트·PDF를 만들어 내려받게 함(확인). **ChatGPT Sites**: ChatGPT·Codex에서 설명만으로 웹사이트를 만들어 호스팅·공유(확인, 요금제·한도는 도움말이라 미확인. 공개 접미사 목록에 `chatgpt.site`가 있음) | 공식 숫자 없음(미확인) |
| Claude.ai | 새 아티팩트(2026-09-16 이후)는 **'코드 실행과 파일 만들기'를 켜야** 하고, 템플릿 Design은 **standalone HTML로 내보내기**. 옛 아티팩트는 코드 보기·복사·내려받기. 파일 만들기 기능은 xlsx·pptx·docx·pdf를 내려받게 함(파일당 30MB). '링크 있는 누구나' 공유는 Pro 이상(무료는 옛 아티팩트 게시만) | 공식 숫자 없음. 문맥은 유료 최신 모델 1M, 코드 실행이 켜져 있으면 긴 대화를 자동 요약(확인) |
| Gemini 앱 | 캔버스 **Code 보기**에서 직접 고침, **Share & export**: 공개 링크(`g.co/gemini/share`, "링크가 있으면 누구나 앱 데이터를 보고 고칠 수 있음"), **Copy contents**, Docs·Slides(PDF)로 내보내기. HTML 파일 내려받기는 문서에 없음 | 공식 숫자 없음 |

출처: [Claude 아티팩트](https://support.claude.com/en/articles/17153992-what-are-artifacts-and-how-do-i-use-them.md), [공유](https://support.claude.com/en/articles/9547008-share-artifacts.md), [파일 만들기](https://support.claude.com/en/articles/12111783-create-and-edit-files-with-claude.md), [길이 한도](https://support.claude.com/en/articles/11647753-how-do-usage-and-length-limits-work.md), [Gemini 캔버스](https://support.google.com/gemini/answer/16047321?hl=en), [ChatGPT Sites](https://learn.chatgpt.com/docs/sites.md), [ChatGPT 웹](https://learn.chatgpt.com/docs/web.md), [캔버스(검색)](https://help.openai.com/en/articles/9930697-what-is-the-canvas-feature-in-chatgpt-and-how-do-i-use-it).

### 2.3 가장 안전한 지시 방식 (제안 — 공식 근거 아님, 시험 필요)

1. 교재는 **PDF로 첨부**(세 곳 공통으로 됨. Claude는 100쪽 넘으면 그림을 안 봄 → 앱이 필요한 쪽만 잘라 PDF로 만들어 주기).
2. "**HTML 파일 하나**, `<!DOCTYPE html>`로 시작해 `</html>`로 끝, CSS·JS는 안에, 외부 주소는 [허용 목록]만, 설명 없이 **코드 블록 하나**" + 캔버스·아티팩트로 만들라고 명시(파일 내려받기 버튼이 생김).
3. 출력량을 줄이는 설계: 사이트가 크면 AI가 **lecpage가 제공하는 공통 런타임(호스트가 이미 허용한 스크립트)**을 쓰고 내용·배치·작은 맞춤 코드만 쓰게 함 → 잘림 위험과 5절의 보안 문제를 같이 줄임.
4. 잘렸을 때: "앞 답의 마지막 줄 다음부터, 코드 블록만, 앞부분 반복 없이". 앱은 붙여 넣은 여러 조각에서 가장 긴 ```html 블록들을 이어 붙이고 겹친 줄을 지운 뒤 `</html>` 유무로 완성 여부를 판단(지금 JSON만 뽑는 방식의 확장).
5. 앱이 받는 쪽: 붙여넣기와 **내려받은 .html 파일 끌어 놓기** 둘 다.

---

## 3. 내 PC의 Claude Code·Codex를 앱이 부르는 길 (이음오피스 방식)

### 3.1 Claude Code

**쓰는 법(확인)** — [headless](https://code.claude.com/docs/en/headless.md), [cli-reference](https://code.claude.com/docs/en/cli-reference.md), [authentication](https://code.claude.com/docs/en/authentication.md), [permissions](https://code.claude.com/docs/en/permissions.md), [tools-reference](https://code.claude.com/docs/en/tools-reference.md)

- `claude -p "…"`: 한 번 실행 후 끝. `--output-format text|json|stream-json`(`stream-json`은 줄마다 JSON, 글자 단위는 `--verbose --include-partial-messages`). `--input-format stream-json`으로 표준 입력에서 메시지를 계속 받음. `json` 출력에 `session_id`·`total_cost_usd`(클라이언트 추정). `--json-schema`로 정해진 모양의 답.
- 이어 하기: `--continue`(가장 최근), `--resume <session_id>`, `--fork-session`, `--session-id <uuid>`, 저장 끄기 `--no-session-persistence`.
- 권한: `--allowedTools "Read,Write,Edit"`(규칙 문법), `--disallowedTools`(맨 이름이면 도구 자체를 뺌, `"mcp__*"`), **`--tools ""`(모든 내장 도구 끔) 또는 `"Read,Write"`**, `--permission-mode default|acceptEdits|plan|auto|dontAsk|bypassPermissions`, 사람 없을 때 `--permission-prompts none`(v2.1.259+). `--max-turns`, `--max-budget-usd`(API 비용 추정 기준), `--add-dir`, `--model`, `--strict-mcp-config`, `--setting-sources user,project,local`, `--settings '{"disableAllHooks": true}'`.
- **작업 폴더 주의**: `-p`는 신뢰 창이 없어서, 그 폴더의 `.claude/settings.json` 훅·`env`·`apiKeyHelper`와 `.mcp.json` 서버를 **묻지 않고 실행**합니다. 문서 권장: `--setting-sources user`, `--bare`, `--settings '{"disableAllHooks": true}'`.
- **구독 로그인이 쓰이나**: 같은 OS 사용자로 실행하면 `/login`·`claude auth login`으로 저장된 구독 자격(macOS 키체인, Windows `%USERPROFILE%\.claude\.credentials.json`)을 씀. 우선순위상 **`ANTHROPIC_API_KEY`가 환경에 있으면 `-p`는 항상 그 키를 씀**(구독 대신 API 과금). **`--bare`는 구독 로그인·`CLAUDE_CODE_OAUTH_TOKEN`을 읽지 않음** → 구독으로 돌리려면 `--bare` 금지. `claude auth status`가 JSON으로 `authMethod`(`claude.ai`·`api_key`·`oauth_token` 등)를 알려 줌 → 다리가 실행 전에 확인 가능.
- 파일 읽기: **PDF는 10쪽 이하면 통째로, 넘으면 `pages`로 한 번에 20쪽까지**, 쪽 범위 읽기는 `pdftoppm`(poppler) 필요(Windows·macOS 기본 설치 아님). 그림(PNG·JPEG·GIF·WebP)은 모델 한도에 맞게 줄여 보여 줌, 128MB 넘으면 거절.

**정책 원문(확인, 2026-11-20에 읽음)**

- Claude Code 문서 [Legal and compliance](https://code.claude.com/docs/en/legal-and-compliance.md)(페이지에 날짜 없음):
  - "Unless we've mutually agreed otherwise, preinstalling or running Claude Code in your products or services (e.g. in hosted sandboxes or other agent infrastructure) requires agreeing to our Commercial Terms of Service and complying with the conditions below: **The Claude Code binary must not be modified.** … **Customers may not pay for, resell, or intermediate Claude usage on their end users' behalf.** Each end user must authenticate with their own Anthropic API key, Claude subscription plan credentials, or 3P inference provider credential …"
  - "**OAuth authentication** is intended exclusively for purchasers of Claude Free, Pro, Max, Ultra, Team, and Enterprise subscription plans and is designed to support ordinary use of Claude Code and other native Anthropic applications."
  - "**Developers** building products or services that interact with Claude's capabilities, including those using the Agent SDK, should use API key authentication … Anthropic does not permit third-party developers to offer Claude.ai login into their own applications, or to route requests through Free, Pro, Max, or Ultra plan credentials on behalf of their users. Moreover, developers may not collect, store, or intermediate Claude.ai credentials or session tokens — sign-in to a Claude account must complete through Anthropic's own flow."
  - "… Nor does it prevent **an end user from signing in to the unmodified Claude Code binary with their own Claude subscription**, including where a platform hosts Claude Code as described under *Can customers offer Claude Code in their products?* above."
  - "Advertised usage limits for Pro, Max, and Ultra plans assume **ordinary, individual usage** of Claude Code and the Agent SDK." / "Anthropic reserves the right to take measures to enforce these restrictions and may do so without prior notice."
- [Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview.md): "Unless previously approved, Anthropic does not allow third party developers to offer **claude.ai login or rate limits** for their products, including agents built on the Claude Agent SDK."
- [Consumer Terms](https://www.anthropic.com/legal/consumer-terms)(Effective **Oct 8, 2025**, 오늘 기준 현행): 금지 항목 "Except when you are accessing our Services via an Anthropic API Key or where we otherwise explicitly permit it, to access the Services through automated or non-human means, whether through a bot, script, or otherwise."
- 해석(제안): (1) 토큰을 읽거나 옮기는 방식은 명백히 금지. (2) 고치지 않은 `claude`에 사용자가 직접 로그인하고 lecpage는 그 프로그램을 실행만 하는 방식은 Legal 문서의 마지막 문장에 맞지만, 'lecpage라는 제품이 구독 한도를 쓰게 하는 것'으로 볼 여지가 Agent SDK 문구에 있음. (3) 제품 안에서 Claude Code를 "실행"하면 상업 약관 동의가 조건으로 붙음. → 운영자 확인(Anthropic 문의) 전에는 기본값으로 켜지 않고, 사용자가 사람이 누를 때만 한 번씩 실행(이음오피스도 자동 호출에는 구독을 기본으로 안 씀, 3.4).

### 3.2 Codex CLI

**쓰는 법(확인)** — [non-interactive-mode](https://learn.chatgpt.com/docs/non-interactive-mode.md), [developer-commands](https://learn.chatgpt.com/docs/developer-commands.md?surface=cli), [auth](https://learn.chatgpt.com/docs/auth.md), [image-inputs](https://learn.chatgpt.com/docs/image-inputs.md)

- `codex exec "…"`(`codex e`): 진행은 stderr, 마지막 답만 stdout. `--json`이면 JSONL 이벤트(`thread.started`, `turn.started`, `item.*`, `turn.completed`(usage), `turn.failed`, `error`). `-o/--output-last-message <파일>`, `--output-schema <schema.json>`, `--ephemeral`(세션 파일 안 남김).
- 샌드박스: 기본 **읽기 전용**, `--sandbox workspace-write`, `--sandbox danger-full-access`. `--full-auto`는 없어짐(`--approve-for-me`). 프로젝트 설정·프로젝트 MCP는 **신뢰한 프로젝트에서만** 읽음(`--trust`). `--ignore-user-config`(`$CODEX_HOME/config.toml` 안 읽음), `--ignore-rules`. Git 저장소가 아니면 `--skip-git-repo-check` 필요. 폴더 `--cd/-C`, 쓰기 폴더 추가 `--add-dir`, 그림 `-i/--image a.png,b.png`.
- 이어 하기: `codex exec resume --last "…"` 또는 `resume <SESSION_ID>`, `codex exec fork`.
- 인증: 저장된 로그인(`~/.codex/auth.json`, ChatGPT 로그인 또는 API 키)을 기본으로 씀. 한 번만 키로: `CODEX_API_KEY=… codex exec`. 요금: ChatGPT 요금제 사용량은 요금제 허용량, 키는 API 요금([pricing](https://learn.chatgpt.com/docs/pricing.md): Codex는 Free·Go·Plus·Pro·Business·Edu·Enterprise에 포함).
- PDF: Codex가 PDF를 직접 읽는다는 문서는 못 찾음(미확인). 그림은 첨부하거나 "PC의 그림을 살펴보라"고 할 수 있음 → 다리가 쪽 그림(PNG)을 만들어 `--image`로 넘기는 편이 확실(제안).

**정책 원문(확인)**

- [Codex App Server](https://learn.chatgpt.com/docs/app-server.md) "Auth endpoints": "If you've built a local or open-source application using Codex app-server authentication, you can continue using it, though we recommend migrating to Sign in with ChatGPT … **App-server authentication has never been permitted for commercial or hosted services.** We launched Sign in with ChatGPT to support these use cases …"
- [Sign in with ChatGPT](https://developers.openai.com/siwc/llms-full.txt): "Eligible **ChatGPT Plus and Pro** users can use their ChatGPT plan for AI requests in participating apps", "ChatGPT plan usage is available to **all open-source partners** and selected private clients", "These docs explain ChatGPT plan usage for open-source and locally hosted apps. If you're interested in offering it in a paid or remotely hosted app, complete the interest form."
  - 등록: `client_id=dynamic_agent_client`로 처음 등록(클라이언트 비밀 없음, PKCE), 호스트마다 `ext_agent_host_id`, `redirect_uri`는 **`http://127.0.0.1:<포트>/auth/callback`만(`localhost` 대신 쓰면 안 됨)**.
  - 미리보기 한계: **`store: false`·`stream: true` 필수**, `background`·`max_output_tokens`·`previous_response_id`(HTTP)·`temperature` 등은 빼야 함, 글·그림·파일 입력은 됨(Files 업로드 API는 안 됨).
- 해석(제안): 오픈소스 로컬 다리라면 (A) 사용자의 Codex를 실행하거나, (B) **다리 자신이 SIWC로 ChatGPT 요금제를 받아 Responses를 직접 부르는** 두 길이 문서상 열려 있음. (B)가 OpenAI 권장 쪽이고 Codex 설치가 필요 없음. 단 무료 요금제는 대상 아님, 출력 길이 지정 불가(`max_output_tokens` 금지).

### 3.3 lecpage.com 웹앱이 내 PC 다리와 이야기하는 법

| 방법 | 지금(2026-11) 사실 | 판단 |
|---|---|---|
| https://lecpage.com → `http://127.0.0.1:포트` fetch | **Chrome 142부터 '로컬 네트워크 접근' 권한 창**(보안 출처에서만 요청 가능, 허락하면 혼합 콘텐츠도 풀어 줌). 145에 `local-network`·**`loopback-network`**로 나뉨, 146 기업 정책 2개 추가, **147부터 WebSocket·WebTransport도 포함**, 156에 임시 해제 정책 제거. 지금 안정판 159(Windows, chromiumdash). 서비스 워커의 요청은 그 출처가 미리 권한을 받아 있어야 함(블로그) | 교사가 "다른 앱과 기기에 접근" 같은 창을 한 번 눌러야 함. 학교 관리 PC는 정책으로 막힐 수 있음 |
| 같은 방법, Firefox | **Firefox 151부터 단계적으로 기본 켜짐**, 카메라 권한 같은 창, `network.lna.enabled`·`network.lna.skip-domains`(검색: SUMO 본문은 봇 확인으로 못 읽음). chromestatus도 "Firefox Shipped/Shipping" | Chrome과 비슷 |
| 같은 방법, Safari | **https 페이지의 `http://127.0.0.1` 요청을 혼합 콘텐츠로 막음**. WebKit 버그 171934 "loopback을 혼합 콘텐츠로 보지 말 것" 상태 **NEW**(마지막 변경 2026-08-19). 관련 회귀 279249는 2025-03 일부 수정(범위 미확인) | **Mac Safari에서는 안 된다고 봐야 함** |
| `https://localhost` + 자체 서명 인증서 | 브라우저가 인증서 경고를 띄움. 피하려면 루트 인증서를 시스템에 설치(관리자 권한) 해야 함(일반 지식, 공식 문서로 따로 확인 안 함) | 비전공 교사에게 부적합 |
| 사용자 지정 주소(`lecpage://`) | 웹의 `registerProtocolHandler`는 `web+…`나 정해진 이름만, 처리기는 같은 출처의 https 주소만(MDN) → 웹으로 네이티브 앱을 부르는 용도가 아님. 설치 프로그램이 OS에 주소를 등록하면 브라우저가 "열까요?"를 묻고 앱을 띄울 수 있지만 **답을 웹으로 돌려받는 통로가 없음**(한 방향) | 다리를 '깨우는' 용도로만 |
| **다리가 앱 전체를 `http://127.0.0.1:포트`에서 서비스** | 페이지와 다리가 **같은 출처** → 로컬 네트워크 권한·CORS·혼합 콘텐츠 모두 해당 없음. `localhost`·`127.0.0.1`은 스펙상 "potentially trustworthy"(보안 컨텍스트)라 Chrome·Firefox에서 Web Crypto·서비스 워커 등이 됨([Secure Contexts](https://w3c.github.io/webappsec-secure-contexts/)). Safari에서 보안 컨텍스트 기능이 모두 되는지는 미확인 | **권장** |
| 데스크톱 앱(Electron·Tauri)으로 감쌈 | 이음오피스 방식(3.4). 서명 안 한 설치 파일은 Windows "알 수 없는 게시자" 경고(이음오피스 README가 그대로 안내) | 가장 매끄럽지만 서명 비용·배포 부담 |

출처: [Chrome 블로그](https://developer.chrome.com/blog/local-network-access), [chromestatus 5152728072060928](https://chromestatus.com/feature/5152728072060928)(2026-07-15 갱신), [chromiumdash](https://chromiumdash.appspot.com/fetch_releases?channel=Stable&platform=Windows&num=3), [WebKit 171934](https://bugs.webkit.org/show_bug.cgi?id=171934), [WebKit 279249](https://bugs.webkit.org/show_bug.cgi?id=279249), [Firefox SUMO(검색)](https://support.mozilla.org/en-US/kb/control-personal-device-local-network-permissions-firefox), [MDN registerProtocolHandler](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/registerProtocolHandler).

**권장 구성(제안, Windows·macOS 비전공 교사 기준)**

1. 작은 다리 프로그램 하나(설치형 또는 한 파일 실행). 켜면 `127.0.0.1`의 빈 포트에 **빌드된 lecpage 앱(app/dist)과 `/bridge` API를 함께** 열고, 일회용 토큰을 붙인 주소(`http://127.0.0.1:포트/#t=…`)를 기본 브라우저로 엶.
2. 앱은 출처가 `127.0.0.1`이면 '내 PC의 Claude Code·Codex' 연결 칸을 보여 줌. lecpage.com에서 들어온 사람에게는 "다리 프로그램을 켜면 이 화면이 내 PC에서 열려요" 안내만(로컬 네트워크 권한 창을 기본 경로로 쓰지 않음).
3. IndexedDB는 출처마다 따로라 lecpage.com의 작업물이 `127.0.0.1` 쪽에 보이지 않음 → 내보내기·가져오기(파일) 또는 다리가 작업 폴더를 저장소로 쓰기.
4. 다리는 에이전트를 **빈 임시 작업 폴더**에서 돌리고, 에이전트가 사이트 파일을 그 폴더에 쓰면 앱이 읽어 미리보기·점검·배포. 긴 HTML도 답 길이 제한에 안 걸림.

### 3.4 이음오피스는 실제로 어떻게 하나 (공개 자료, 확인)

- 정체: **Electron 데스크톱 앱**(루트 `package.json`의 `shell` 스크립트가 `electron apps/shell`), GenOffice(Apache-2.0)를 고친 것. 워드·엑셀·파워포인트·PDF·HWP·마크다운·HTML·마인드맵. Windows 기본, Mac·Linux 베타, 설치 파일 서명 없음. 저장소 [pblsketch/ieumoffice](https://github.com/pblsketch/ieumoffice)(README 직접 읽음). 리뷰 기사는 개발자를 충남 아산의 국어 교사로 소개([리뷰타임스](https://www.reviewtimes.co.kr/news/articleView.html?idxno=13129), 검색).
- 연결 네 가지: (1) PC에 설치·로그인된 **Claude Code를 실행**("2.1.248 이상"), (2) **ChatGPT로 계속** = SIWC로 받은 토큰으로 PC에서 `api.openai.com`에 바로 요청, (3) PC의 **Codex를 실행**, (4) 무료: OpenRouter 브라우저 연결·Gemini 키.
- 설치·로그인 버튼은 공식 명령을 **보이는 터미널 창**에서 실행(`irm https://claude.ai/install.ps1 | iex`, `winget install OpenAI.Codex`, `claude auth login`, `codex login`).
- 실행 방식: "프로그램은 **빈 임시 폴더에서 자체 도구를 모두 끈 채로** 실행되고, Claude가 쓸 수 있는 도구가 하나라도 남아 있다고 알려 오면 그 실행은 거부". 문서를 고치는 일은 앱이 하고 AI는 '두뇌'만.
- 약속: 로그인 정보(`~/.codex/auth.json`, Claude 자격 저장소, 세션 토큰)를 읽지도 복사하지도 않음, 앱 안에 로그인 화면 없음, 프로그램을 고치거나 감싸지 않음, 대신 내거나 되팔지 않음, 사용자가 시킬 때만 요청, 요금이 나가는 연결로 스스로 바꾸지 않음.
- **터미널 명령·MCP로 들어온 자동 요청은 기본적으로 구독을 안 씀**("프로그램이 자동으로 구독을 쓰는 것은 Anthropic과 OpenAI 모두 권장하지 않고, 계정에 제한이 걸릴 수 있습니다", 설정에서 켜야 함). README는 "앱에서 Codex 구독을 쓰는 것은 OpenAI가 공식 권장하는 방식이 아닙니다"라고도 밝힘.
- 알려진 한계(README): 요청마다 프로그램을 띄워 첫 글자까지 수 초(Claude 약 4초), Codex는 `~/.codex/AGENTS.md` 등 개인 설정을 완전히 끌 수 없음.

### 3.5 다리 보안 모델 (제안 + 근거)

| 위협 | 막는 장치 |
|---|---|
| 같은 PC·같은 망의 다른 기기가 접속 | `127.0.0.1`에만 바인딩(`0.0.0.0` 금지), 임의의 높은 포트 |
| 아무 웹사이트가 다리에 요청(CSRF·드라이브바이) | 실행마다 바뀌는 **짝 맞춤 토큰**을 머리글(`Authorization`)로만 받기(쿠키 금지), `Origin`을 `http://127.0.0.1:<포트>`(및 허용한 경우 `https://lecpage.com`)와 정확히 비교, 사용자 지정 머리글을 요구해 사전 요청을 강제, `Access-Control-Allow-Origin: *` 금지 |
| DNS 리바인딩 | `Host` 머리글이 `127.0.0.1:<포트>`·`localhost:<포트>`가 아니면 거절 |
| 에이전트가 PC 파일·명령을 건드림 | 실행마다 **새 빈 임시 폴더를 작업 폴더로**(그 폴더엔 `.claude/`·`.mcp.json`이 없으니 프로젝트 훅이 없음). Claude: `--tools "Read,Write,Edit"`(글만 받으면 `--tools ""`) + `--allowedTools "Read,Write,Edit"`(`dontAsk`는 허용 규칙에 없는 쓰기를 거절하므로 함께 줘야 함), `--disallowedTools "mcp__*"`, `--strict-mcp-config`, `--setting-sources user`, `--settings '{"disableAllHooks": true, "permissions": {"blockReadsOutsideWorkingDirectories": true, "blockWritesOutsideWorkingDirectories": true}}'`(두 키는 모든 모드에서 파일 도구가 작업 폴더 밖을 거절하게 함, 쓰기 쪽은 v2.1.314+, 셸 명령은 못 막으므로 Bash는 빼기), `--permission-mode dontAsk`, `--permission-prompts none`, `--max-turns`. Codex: `--sandbox read-only`(쓸 땐 `workspace-write`), `--cd <임시 폴더>`, `--skip-git-repo-check`, `--ephemeral`, `--ignore-user-config`. 끝나면 결과 파일만 앱으로 가져오고 폴더 삭제 |
| 구독 대신 API 과금이 몰래 됨 | 실행 전 `claude auth status`의 `authMethod` 확인, 자식 프로세스 환경에서 `ANTHROPIC_API_KEY`가 있으면 사용자에게 알림(지우지는 않음), `--bare` 금지 |
| 토큰 유출·약관 위반 | 자격 파일·키체인을 읽지 않음, 로그인은 공식 명령으로만, 자동 반복 호출 없음, 사람이 누를 때만 |
| 교재가 다른 앱으로 샘 | 다리는 교재를 임시 폴더에만 두고, 로그·분석에 내용·경로 안 남김 |

참고: Chrome 블로그도 로컬 네트워크 권한의 목적을 "라우터 등 로컬 기기에 대한 CSRF와 지문 수집 방지"로 설명합니다. 다리가 위 장치를 갖추면 그 권한 창 없이(같은 출처) 돌아도 같은 위협을 막습니다.

---

## 4. 교재 쪽 그림

### 4.1 브라우저에서 PDF 쪽 그리기

- pdf.js: `pdfjs-dist` 최신 **6.5.438(2026-11-01), Apache-2.0**. 앱은 **4.10.38**을 씀(`app/package.json`). 큰 판 올림이라 올릴 때 `page.render` 인자 등 바뀐 점 확인 필요(미확인).
- 앱에 이미 있는 것: `skills/lecpage/engine/src/ingest/render-pdf-browser.js` `renderPdfPages` — 한 쪽씩 차례로 그림, `scale 1.5`·**`maxWidth 1600`**·WebP 0.82, `page.cleanup()`, 캔버스 크기를 0으로 되돌려 메모리 반환, 끝에 `doc.destroy()`, 최대 400쪽, 한글 CMap·표준 글꼴은 같은 출처에서.
- AI에 보낼 크기(위 1절 숫자로 계산, 제안): Claude 고해상도 등급은 긴 변 2,576px까지 쓰지만 쪽당 최대 4,784토큰, 표준 1,568px. OpenAI `high`는 2,500조각(정사각 1600×1600쯤)에서 상한. Gemini는 PDF를 스스로 2MP로 그림. → **긴 변 1,600~2,000px·WebP/JPEG 0.8**이면 세 회사 모두 충분하고, 원본 PDF를 그대로 보낼 수 있으면 그게 더 쌈(Gemini 쪽당 560토큰, Claude는 글+그림).
- 메모리(제안): 지금처럼 한 장씩 그려 Blob으로 바꾸고 캔버스 해제, 모든 쪽 비트맵을 동시에 들고 있지 않기. 필요하면 `OffscreenCanvas`로 워커에서.

### 4.2 브라우저에서 PPTX·HWP/HWPX를 그림으로 (npm 레지스트리, 2026-11-20)

| 라이브러리 | 최신·날짜 | 라이선스 | 방식·주장 | 월 내려받기 |
|---|---|---|---|---|
| `@aiden0z/pptx-renderer` | 1.4.0 · 2026-10-18 | Apache-2.0 | HTML/SVG DOM으로 그림. 도형·글·그림·표·차트·SmartArt·수식. PowerPoint와 SSIM 비교 시험이 있다고 주장 | 약 141만 |
| `pptx-preview` | 1.0.7 · 2025-10-17 | ISC | 순수 프런트엔드(중국어 설명), 저장소 표기 없음 | 약 115만 |
| `@office-kit/pptx-preview` | 0.21.0 · 2026-10-25 | MIT | 슬라이드 → SVG(브라우저·Node), Node에선 PNG. "실험적" | 약 29만 |
| `@silurus/ooxml` | 0.90.1 · 2026-11-17 | MIT | Rust/WASM 파서 + Canvas, docx·xlsx·pptx. "코드 전부 AI 에이전트가 작성"이라고 밝힘 | 약 162만 |
| `pptxviewjs` | 1.1.9 · 2026-03-22 | MIT | Canvas, 차트는 Chart.js | 약 47만 |
| `docx-preview` | 0.4.1 · 2026-09-21 | Apache-2.0 | DOCX → HTML | — |
| `@rhwp/core` | 0.9.1 · **2026-11-18** | MIT | **Rust+WASM HWP/HWPX 파서·렌더러, SVG로 그림**(한국어 README) | 약 29만 |
| `kordoc` | 4.25.2 · 2026-11-19 | MIT | HWP 3·5, HWPX, PDF, DOCX, PPTX → Markdown(+배치 보존 SVG 렌더러), CLI·MCP | 약 28만 |
| `hwp.js` | 0.0.3 · 2020-10-01 | Apache-2.0 | 오래 멈춤 | — |
| `mupdf`(WASM) | 1.28.6 · 2026-11-09 | **AGPL-3.0** | PDF 등. 라이선스 때문에 lecpage(배포본)에 넣기 어려움 | — |

- 판단(제안): 충실도는 **모두 만든 사람 주장**이고 직접 시험하지 않았습니다. 한국 교재 PPTX는 맑은 고딕 등 브라우저에 없는 글꼴을 써서 대체 글꼴로 줄바꿈·배치가 달라질 수 있습니다. → 쪽 그림의 1순위는 "PDF로 저장해 올리기", Gemini 4 키가 있으면 PPTX 원본을 그대로 보내기, 브라우저 렌더러는 미리보기·보조로. HWP/HWPX는 `@rhwp/core`가 가장 유력한 후보(시험 필요).

### 4.3 CLI·에이전트 길에서 변환

- **LibreOffice**: 지금 안정판 26.8.3(26.2.7도 지원). `soffice --headless --convert-to pdf --outdir <폴더> <파일>`([도움말](https://help.libreoffice.org/latest/en-US/text/shared/guide/start_parameters.html)). HWP 5·HWPX는 기본 필터로 안정적으로 안 되고, 서드파티 확장 **H2Orestart**(HWP v5·HWPX)가 데비안 등에 패키지로 있음(검색).
- **LibreOffice 없이 Windows**: PowerPoint가 설치돼 있으면 COM 자동화 `Presentation.SaveAs(경로, ppSaveAsPDF=32)` 또는 `ppSaveAsPNG=18`([PpSaveAsFileType](https://learn.microsoft.com/en-us/office/vba/api/powerpoint.ppsaveasfiletype)). 한컴오피스 자동화로 PDF 저장은 알려져 있으나 확인 안 함(미확인).
- **macOS**: Keynote·PowerPoint for Mac의 AppleScript 내보내기는 확인 안 함(미확인).
- **에이전트가 직접 읽기**: Claude Code Read는 PDF(10쪽 넘으면 20쪽씩, `pdftoppm` 필요)·그림을 읽음(3.1). Codex는 그림 첨부·보기 되고 PDF 직접 읽기는 문서 없음. → 다리가 pdf.js(Node)나 브라우저 쪽에서 쪽 그림을 만들어 넘기면 두 에이전트 모두 같은 입력을 받음(제안). HWP는 `kordoc`(MCP)·`@rhwp/core`로 에이전트가 읽게 할 수 있음(시험 필요).

---

## 5. AI가 짠 JS를 안전하게 호스팅하기 (짧게)

### 5.1 비슷한 무료 호스트가 하는 일 (확인)

- **Netlify Drop**(공식 블로그 [thirteen years of Netlify Drop](https://www.netlify.com/blog/thirteen-years-of-netlify-drop.md)): 익명 배포가 피싱·사기에 쓰여 2020년 내부에서 기능 종료까지 논의. 2022-01 주인이 가져가는 기한을 24시간 → **1시간**, IP당 익명 사이트 **3개**. 2024년 사기 신고 대부분이 익명 배포여서 **가져가기 전까지 암호로 잠금**. 2025년 가져가지 않은 사이트는 정지 후 1주 뒤 삭제.
- **Cloudflare** 임시 계정([claim-deployments](https://developers.cloudflare.com/workers/platform/claim-deployments/index.md)): 플랫폼이 작업 증명(proof-of-work) 문제를 풀고 사용자가 약관에 동의해야 임시 계정 생성, `workers.dev`에 배포, **60분 안에 가져가지 않으면 계정과 자원 삭제**. 정적 자산 1,000개·파일당 5MiB. Cloudflare Drop이 이 방식의 예.
- **GitHub Pages**([limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)): "비밀번호나 카드 번호 같은 민감한 거래에 쓰지 말 것", 다른 사이트를 베낀 학습용 사본은 "사용자 데이터를 모으지 말고 관련 없음을 크게 밝힐 것".
- tiiny.host·static.app·Glitch 후속: 이번에 공식 문서를 확인하지 못함(미확인).

### 5.2 출처·사이트 분리 (확인 + 제안)

- 공개 접미사 목록(PSL)에 `pages.dev`, `workers.dev`, `github.io`, `netlify.app`, `vercel.app`, `chatgpt.site`가 있음(확인) → 그 아래 이름 하나가 '사이트'(등록 가능 도메인) 단위.
- lecpage 호스트의 Pages 보기 `s-<id>.lecpage-view.pages.dev`는 **사이트마다 출처는 다르지만(저장소 분리됨) 모두 같은 '사이트' `lecpage-view.pages.dev`**입니다. 같은 사이트끼리는 SameSite 쿠키가 같이 가고, 피싱 신고로 경고가 걸릴 때 범위가 어디까지인지는 확인하지 못함(미확인). 앱(lecpage.com)과 다른 등록 도메인이라는 원칙은 이미 지킴(`hosting/README.md` §1).

### 5.3 CSP로 할 수 있는 것과 못 하는 것 (MDN 확인 + 제안)

- `connect-src`는 `fetch()`·`fetchLater()`·`XMLHttpRequest`·`WebSocket`·`EventSource`·`navigator.sendBeacon()`·`<a ping>`을 막음([MDN connect-src](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/connect-src)). `form-action`은 폼 제출 대상. `sandbox` 지시어도 있음. **`navigate-to`는 MDN에서 사라짐** → `location = 'https://악성?d=…'` 같은 최상위 이동으로 정보를 빼는 것은 CSP로 못 막음.
- 지금 호스트 CSP(`hosting/src/csp.js`): `script-src 'self'`(올라온 .js는 엔진 런타임만), `connect-src 'self' https: wss:`, `img-src … https:`, `form-action 'none'`, `frame-src 'none'`.
- AI가 짠 JS를 받을 때의 봉투(제안):
  - `script-src 'self' 'sha256-…'` — 호스트가 올릴 때 HTML 안 인라인 스크립트마다 해시를 계산해 넣음(`'unsafe-inline'`·`'unsafe-eval'` 없음). 외부 스크립트는 허용 목록의 고정 파일만(지금 `scripts` 인자와 같음).
  - `connect-src 'self' wss://<실시간 방 호스트> https://<실시간 방 호스트>` — `https:` 전체 허용을 없애 사이트가 임의 서버로 입력값을 보내지 못하게.
  - `img-src 'self' data: blob:` + 필요한 CDN만(이미지 요청으로 빼내기 줄임), `form-action 'none'` 유지, `frame-src 'none'`, `base-uri 'none'`, `object-src 'none'`, `Permissions-Policy`로 카메라·마이크·위치·결제 등 끔.
  - CSP 밖의 검사: `<input type="password">`, 다른 회사 로그인 화면을 흉내 낸 글(네이버·카카오·구글 로그인 등), 외부로 가는 `<form>`·`location` 대입이 있으면 올리기 거절 또는 운영자 검토. 신고 창구·보관 기간·사이트 수 제한은 지금처럼.
  - 대안: 임의 JS가 필요한 사람은 Cloudflare 임시 계정처럼 **사용자 자신의 계정으로 가져가게** 하는 길(가입 장벽은 생김).

---

## 6. 확인하지 못한 것 (구현 전 직접 볼 것)

- ChatGPT 첨부 한도·캔버스의 HTML 내려받기·ChatGPT Sites 요금제(도움말 `help.openai.com` 차단). 세 챗봇의 **한 답 최대 길이**(공식 숫자 없음) → 실제 계정으로 6만~10만 자 HTML을 받아 보는 시험 필요.
- Gemini Files API 재개 가능한 업로드의 성공 응답에서 `X-Goog-Upload-URL`을 브라우저가 읽을 수 있는지(키 필요). Gemini 인라인 한도 100MB vs 20MB 불일치.
- OpenAI PDF 쪽 수 한도, GPT-6.1·6.2의 그림 토큰 배수, 스트리밍 아닌 요청의 서버 시간 제한.
- Anthropic이 'lecpage 다리가 사용자의 `claude -p`를 실행'하는 것을 허용하는지(문서 문구가 두 방향) → 운영자 문의.
- Firefox 로컬 네트워크 권한의 정확한 버전·WebSocket 포함 여부(SUMO 본문 못 읽음), Safari 279249 수정 범위, `http://127.0.0.1` 출처에서 Safari의 보안 컨텍스트 기능.
- PPTX·HWP 브라우저 렌더러의 실제 충실도(한국 교재 표본으로 시험), pdf.js 4 → 6 판 올림 때 바뀐 점.
- Codex `--ignore-user-config`가 ChatGPT 로그인 사용에 영향이 없는지, Codex의 PDF 직접 읽기.
