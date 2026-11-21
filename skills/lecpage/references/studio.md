# PC 프로그램 (lecpage studio) — ChatGPT·Claude 구독으로 연결

API 키 없이, 쓰고 있는 ChatGPT(Plus·Pro)나 Claude 계정으로 lecpage.com 화면에서 바로 사이트를 만들게 하는 작은 PC 프로그램이에요. 사용량은 그 계정의 요금제에서 차감돼요.
- **ChatGPT 계정**: PC 프로그램이 [Sign in with ChatGPT](https://developers.openai.com/siwc)(오픈소스·로컬 앱의 ChatGPT 요금제 사용)로 로그인하고, 이 PC에서 OpenAI Responses API를 바로 불러요. Codex 설치가 필요 없어요.
- **Claude 계정**: PC에 설치·로그인한 Claude Code를 고치지 않고 빈 임시 폴더에서 실행해요. 없으면 [설치]·[로그인] 버튼이 공식 명령을 보이는 터미널 창에서 돌려요.
- **Codex**(선택): 설치·로그인한 Codex도 같은 방식으로 써요.

## 설치·띄우기
- **Windows(초보자)**: lecpage.com의 AI 선택 → [ChatGPT·Claude 계정으로 연결] → [PC 프로그램 다운로드] → 받은 `lecpage-studio.cmd`를 두 번 눌러 실행. 경고 창이 뜨면 [추가 정보] → [실행].
- **macOS**: 터미널에 한 줄: `curl -fsSL https://github.com/yoorrard/lecpage/releases/download/studio-latest/lecpage-studio.sh | bash`
- 실행 파일은 Node.js 22가 없으면 nodejs.org의 LTS를 사용자 폴더에 받고(SHA-256 확인, 관리자 권한 없음), GitHub 릴리스 `studio-latest`의 묶음을 받아(새 판이 있을 때만, SHA-256 확인) `node lecpage.mjs studio`로 켜요. 릴리스는 `.github/workflows/studio-release.yml`이 main에 바뀐 것이 있을 때마다 갱신해요.
- 개발자: `npx -y github:yoorrard/lecpage studio`(Git 필요) · Skill을 설치했으면 `node <skill>/scripts/lecpage.mjs studio`

켜면 기본 브라우저로 `https://lecpage.com/#pair=<토큰>&port=<포트>`를 열어 짝을 맞춰요. 앱이 토큰·포트를 이 브라우저에 기억하고 주소에서 바로 지워요. 받기 안내를 연 lecpage 탭이 있으면 그 탭이 이어 받고 새 탭은 닫혀요. 그다음부터 lecpage.com 화면이 `http://127.0.0.1:<포트>/bridge/*`를 직접 불러요(연수는 lecpage.com 저장소 그대로). Chrome·Edge는 처음 한 번 "로컬 네트워크" 접근을 물어요([허용]). 짝 맞춤 토큰은 이 PC 사용자 폴더(`%APPDATA%\lecpage` · `~/Library/Application Support/lecpage` · `~/.config/lecpage`)의 `studio.json`에 두어 다시 켜도 저절로 다시 붙어요.

**Safari**는 https 화면에서 `http://127.0.0.1` 요청을 막아요(WebKit 171934). 그래서 PC 프로그램은 앱 전체를 `http://127.0.0.1:<포트>/`에서도 보여 줘요(같은 출처, 토큰은 앱 HTML의 `<meta name="lecpage-bridge">`). 이 화면은 저장소가 따로라 연수는 [파일로 저장] → [저장한 파일 열기]로 옮겨요. 바로 배포 서버는 `http://127.0.0.1:6600~6602`도 허용해요.

옵션: `--port 6600`(기본은 6600~6649 중 빈 곳) · `--no-open` · `--open lecpage|local` · `--autostart`(로그인할 때 켜짐: 창을 열지 않음) · `--new-token`(짝을 새로) · `--dist app/dist`(이 빌드본을 보여 주고 그 주소를 엶) · `--remote` · `--timeout 30`. 환경 변수: `LECPAGE_STUDIO_APP_URL`(짝 맞출 앱 주소) · `LECPAGE_STUDIO_ORIGINS`(더 받을 출처, 쉼표) · `LECPAGE_STUDIO_HOME`(토큰·자격 폴더).

Windows에서 받은 파일로 켰으면 앱에 [컴퓨터를 켤 때 PC 프로그램도 켜기]가 보여요(`HKCU\…\Run`에 `cmd /c start /min …lecpage-studio.cmd --autostart`, 작업 표시줄에 작게). macOS의 로그인 항목은 아직 없어요.

## 정책
- **ChatGPT 계정**(공식 문서 developers.openai.com/siwc, 2026-11-21에 다시 읽음): "ChatGPT plan usage is available to all open-source partners", 이 문서는 "open-source and locally hosted apps"용. 요금제가 있는 원격 호스팅 앱은 관심 신청서가 따로 필요 → lecpage.com이 아니라 **오픈소스 PC 프로그램이** 로그인·요청을 맡아요. Plus·Pro만 대상(무료 요금제는 [쓰던 AI로]). Plus의 5시간 한도는 다른 앱과 함께 써요. 지킨 조건: `client_id=dynamic_agent_client`로 처음 등록하고 받은 client_id를 저장, `ext_agent_host_id`(`urn:uuid:`, PC마다 하나), 콜백 `http://127.0.0.1:<포트>/auth/callback`, PKCE S256·state·nonce, ID 토큰 RS256(JWKS)·iss·aud·exp·nonce 확인, scope에 `chatgpt.tokens.use.direct`가 있어야 요청, 요청은 `store:false`·`stream:true`이고 `background`·`max_output_tokens`·`previous_response_id`·`temperature` 등은 뺌(PC 프로그램이 한 번 더 걸러 냄), 갱신은 한 번에 하나(돌아가며 바뀌는 refresh 토큰), 연결 해제는 refresh 토큰 취소 뒤 토큰만 지움(등록·host ID는 남김). 서버에서 이어 받기(background)가 없어서, 끊기거나 길이에 닿으면 앱이 받은 글로 '이어서'를 사용자 메시지로 다시 보내요.
- **Claude 구독**: 내 구독으로 로그인한 Claude Code를 고치지 않고 쓰는 것은 허용되지만, 다른 제품이 구독 한도를 쓰게 하는 것은 Anthropic 승인이 필요해서, 이 연결은 켜는 사람이 직접 고르는 선택 기능이에요. 자동·반복 호출은 하지 않고 사람이 누를 때만 돌아요.
- **Codex**: OpenAI는 내 PC에서 도는 오픈소스 앱이 Codex 로그인을 쓰는 것을 허용해요.
- Claude Code·Codex의 로그인 정보(키체인·`~/.claude/.credentials.json`·`~/.codex/auth.json`)는 읽지도 옮기지도 않아요. 설치·로그인은 공식 명령(`irm https://claude.ai/install.ps1 | iex` · `curl -fsSL https://claude.ai/install.sh | bash` · `claude auth login` · `irm https://chatgpt.com/codex/install.ps1 | iex` · `curl -fsSL https://chatgpt.com/codex/install.sh | sh` · `codex login`)을 **보이는 터미널 창**에서만 돌려요(윈도우 새 PowerShell 창, macOS Terminal). 터미널 창을 못 열면 명령을 앱에 보여 줘요.
- 구독은 사람이 누른 요청([만들기]·[AI로 수정]·검수의 [AI로 수정])으로만 써요. ChatGPT 계정 작업은 새로 고침·망 복구 뒤 저절로 다시 부르지 않고 [계속 만들기]를 기다려요.
- `ANTHROPIC_API_KEY`가 있으면 Claude Code가 구독 대신 그 키로 돌아요(연결 프로그램이 알려 줘요, 지우지는 않아요).

## 안전
- `127.0.0.1`에만 묶어요. 모든 요청의 `Host`가 `127.0.0.1:<포트>`와 정확히 같아야 해요(DNS 리바인딩 거절). `/bridge/*`는 머리글 `X-Lecpage-Bridge`(짝 맞춤 토큰, 쿠키·주소에 넣지 않음)가 맞고, `Origin`이 이 주소나 허용 목록(`https://lecpage.com`·`https://www.lecpage.com`·개발 주소 `http://localhost:5173`·`:4173`·`LECPAGE_STUDIO_ORIGINS`)과 정확히 같아야 해요. CORS(`Access-Control-Allow-Origin`은 그 출처만, `Vary: Origin`)와 사설망 머리글(`Access-Control-Allow-Private-Network: true`)은 허용한 출처에만 붙여요.
- ChatGPT 토큰은 이 PC 사용자 폴더의 `chatgpt.json`(0600, 원자적 쓰기)에만 두고, 앱에는 연결 여부·이메일·모델 목록만 줘요. 터미널 기록에도 남기지 않아요. `/auth/callback`은 OpenAI가 보내는 최상위 이동이라 토큰 대신 state로 확인해요.
- 한 번에 작업 하나, 교재 파일 하나 100MB·모두 120MB·20개까지, 작업 30분 한도와 멈추기(프로세스 묶음째 끔).
- 에이전트는 새 빈 임시 폴더(훅·`.mcp.json` 없음)에서 돌아요. Claude Code: `--restricted`, 도구는 Read·Write·Edit·Glob·Grep과 검수 명령 하나만 허용한 Bash(윈도우는 PowerShell도 같은 명령만), 작업 폴더 밖 읽기·쓰기 막기, 훅 끔, MCP 없음, 묻는 대신 거절, 세션을 디스크에 남기지 않음. 시작할 때 MCP·웹 도구가 켜져 있으면 멈춰요. Codex: `--sandbox workspace-write`, `--ephemeral`. Codex는 내 설정(`~/.codex/config.toml`)의 MCP 서버를 그대로 켜요(설정을 빼면 로그인 저장 위치까지 바뀔 수 있어 빼지 않아요). MCP 도구를 부르는 순간 작업을 멈추니, Codex로 쓸 때는 설정의 MCP 서버를 꺼 두는 게 좋아요.
- 검수 실행기(`../bin/check.mjs`)는 작업 폴더 밖에 있어요. Claude Code에는 그 폴더를 `--add-dir`로 더해 검수 명령을 실행할 수 있게 하고(더하지 않으면 경로 검사가 검수 명령까지 막아요), 파일 도구로 고치는 것은 `Write`·`Edit` 거절 규칙으로 막아요. 강사 값(참여 서버·주소·공개 범위)은 에이전트에게 주지 않아요.
- 작업 지시(TASK.md)는 짧게: 목표 한 줄(강의 동반자 사이트), 강사 요청, 배포 조건, 쓰고 싶을 때만 쓰는 강의 기능 자리 표시, 원하면 쓰는 검수 명령. 읽는 법·디자인·화면 확인과 다듬기는 에이전트가 정해요(디자인 규칙·레퍼런스 사이트는 넣지 않아요).
- 작업이 끝나면 임시 폴더를 바로 지우고, 결과는 앱이 가져간 뒤 `DELETE`로 메모리에서도 지워요. 터미널에는 교재 내용·파일 이름·토큰을 적지 않아요.

## 문제 해결
| 증상 | 할 일 |
|---|---|
| "PC 프로그램을 켜 주세요" | 받은 파일을 두 번 눌러 실행. 켰는데도 그대로면 주소창 왼쪽 아이콘 → 사이트 설정에서 "로컬 네트워크"를 허용 |
| "짝이 맞지 않아요" | PC 프로그램을 끄고 다시 켜기(lecpage.com이 다시 열리며 짝을 맞춤) |
| "이 PC에 Claude Code가 없어요" | 앱의 [Claude 계정으로 로그인]이 설치와 로그인을 터미널 창에서 이어서 해요 |
| "로그인되어 있지 않아요" | 앱의 [Claude 계정으로 로그인] (또는 `claude auth login` / `codex login`) |
| "2.1.314 이상이 필요해요" | 앱의 [Claude Code 업데이트] (또는 `claude update`) |
| "ChatGPT 요금제 사용을 허락하지 않았어요" | [ChatGPT 계정으로 로그인]을 다시 눌러 동의 화면에서 허락 |
| "ChatGPT 사용 한도에 닿았어요" | 한도가 차면 [계속 만들기]. 사용량: chatgpt.com/settings/usage |
| `npm error … git … enoent` | Git이 없어요 → 위의 codeload 주소로 |
| 포트가 모두 쓰임 | 켜 둔 다른 연결 프로그램 창을 쓰거나 `--port`로 다른 번호 |
| 127.0.0.1 화면에서 지난 작업이 안 보임 | 그 화면의 저장소는 주소(포트 포함)마다 따로예요. lecpage.com 화면(Chrome·Edge)에서 쓰거나 [파일로 저장] → [저장한 파일 열기] |
| "앱 파일을 받지 못했어요" | 인터넷 확인. 저장소를 받았으면 `cd app && npm run build` 뒤 `--dist app/dist` |

## HTTP 약속 (앱이 부름, `docs/plan-ai-first.md` §10)
모든 요청에 `X-Lecpage-Bridge: <토큰>`. 오류는 `{ ok:false, error, message_ko }`(401 토큰·403 출처·409 바쁨/준비 안 됨·413 너무 큼·415 JSON 아님·421 주소·429 연달아 누름).
- `GET /bridge/status` → `{ ok, version, app:'dist'|'remote', platform, port, agents:[{ id, name, installed, version, auth:'subscription'|'api-key'|'unknown', loggedIn, ready, need:''|'install'|'login'|'update', note_ko }], chatgpt:{ connected, plan, email, pending, welcome, needsLogin, usageUrl }, autostart:{ available, on }, job, limits, policy_ko:{ claude, codex, chatgpt } }` (`?fresh`면 에이전트를 새로 살핌)
- `POST /bridge/chatgpt/login` `{ open?, reconsent? }` → `{ ok, url }`(OpenAI 로그인 주소. `open`이면 PC 프로그램이 기본 브라우저로 엶) · `GET /auth/callback`(토큰 없음, state 확인) · `GET /bridge/chatgpt` → 위 `chatgpt` · `DELETE /bridge/chatgpt` → `{ revoked, … }` · `POST /bridge/chatgpt/welcome` · `GET /bridge/chatgpt/models` → `{ models:[{ id, label }] }`
- `POST /bridge/chatgpt/responses` (Responses 요청 본문: `model`·`instructions`·`input`·`text`·`reasoning`만 씀) → OpenAI SSE 그대로. 거절은 `{ ok:false, error, code, status, message, message_ko }`(예: 429 `subscription_sharing_usage_limit_exceeded`, 403 `subscription_sharing_user_not_eligible`, 401 `not-connected`)
- `POST /bridge/agents/:id/install|login|update` (id: `claude`·`codex`) → `{ ok, action }` 또는 `{ ok:false, command, message_ko }`(터미널 창을 못 엶). 이미 설치돼 있으면 install은 login(또는 update)으로
- `GET·POST /bridge/autostart` `{ on }` → `{ available, on }`(Windows, 받은 파일로 켰을 때만)
- `POST /bridge/jobs` `{ agent, kind:'make'|'edit', request, meta, reference, files:[{ name, type, base64 }], site?, target? }` → 202 `{ ok, jobId }`. `site` 값은 글 또는 `{ base64 }`. 새로 만들 때도 앱이 그린 쪽 그림을 `site['material/p-NNN.webp']`로 보내면 써요(이 PC에 LibreOffice·pdftoppm이 없으면 연결 프로그램이 쪽 그림을 못 그려요).
- `GET /bridge/jobs/:id/events`(SSE, `id:` 붙음, `Last-Event-ID`로 이어 받기): `{ type:'step', name, label_ko }` · `{ type:'log', text }` · `{ type:'done', label_ko, summary:{ errors, warnings, files } }` · `{ type:'error', code:'timeout'|'stopped'|'agent'|'prepare'|'unsafe'|…, error }`. 머리글이 필요해 `EventSource` 대신 `fetch`로 읽어요.
- `GET /bridge/jobs/:id` → `{ id, agent, kind, status:'running'|'done'|'error'|'stopped', step, startedAt, endedAt, error }`
- `GET /bridge/jobs/:id/result` → `{ site, meta, issues, warnings, material:{ pages }, dropped, agent }`. 글 파일은 글, 그림(`material/p-NNN.webp`·`assets/img/*`)은 `{ base64, type }`. `meta`에는 강사 값이 없어 앱이 지켜 둔 값을 다시 넣어요.
- `DELETE /bridge/jobs/:id` → 돌던 작업은 멈추고 지움 `{ ok, stopped }`
