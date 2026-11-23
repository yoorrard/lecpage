# lecpage 커넥트 (lecpage Connect) — ChatGPT·Claude 구독으로 연결

API 키 없이, 쓰고 있는 ChatGPT(Plus·Pro)나 Claude 계정으로 lecpage.com 화면에서 바로 사이트를 만들게 하는 작은 PC 프로그램 **lecpage 커넥트**예요(예전 이름 lecpage studio, CLI는 `connect`·`studio` 둘 다). 사용량은 그 계정의 요금제에서 차감돼요.
- **ChatGPT 계정**: lecpage 커넥트가 [Sign in with ChatGPT](https://developers.openai.com/siwc)(오픈소스·로컬 앱의 ChatGPT 요금제 사용)로 로그인하고, 이 PC에서 OpenAI Responses API를 바로 불러요. Codex 설치가 필요 없어요.
- **Claude 계정**: PC에 설치·로그인한 Claude Code를 고치지 않고 빈 임시 폴더에서 실행해요. [Claude 계정으로 로그인]을 누르면 터미널 없이 이어져요: 없으면 공식 설치 명령을 창 없이 돌리고(받는 파일 크기로 진행 막대), 이어서 `claude auth login`을 돌려 Claude가 여는 브라우저 창에서 승인하면 끝나요(창이 안 열리면 앱의 [로그인 창 열기]와 코드 칸). Claude 데스크톱 앱이 있으면 그 안의 Claude Code를 써서 설치를 건너뛰어요. 공식 명령을 보이는 터미널 창에서 하는 길은 앱의 '다른 방법'에 있어요.
- **Codex**(선택): 설치·로그인한 Codex도 같은 방식으로 써요.

## 설치·띄우기
- **Windows**: lecpage.com의 AI 선택 → [ChatGPT·Claude 계정으로 연결] → 다운로드 → 받은 `lecpage-connect.cmd`를 두 번 눌러 실행. 경고 창이 뜨면 [추가 정보] → [실행].
- **macOS·Linux(기본 길)**: 터미널에 한 줄: `curl -fsSL https://github.com/yoorrard/lecpage/releases/download/studio-latest/lecpage-connect.sh | bash`. 이 길을 기본으로 둔 까닭: 브라우저로 받은 `.command`·`.sh`는 실행 권한이 빠져 두 번 눌러도 돌지 않고, 서명 없는 파일은 Gatekeeper가 막아요. `curl`로 받은 파일에는 격리 표시가 붙지 않아 경고 창이 하나도 뜨지 않아요(Node.js도 같은 길로 받음).
- **macOS 앱(선택)**: `lecpage-connect-mac.zip`을 풀어 `lecpage Connect.app`을 두 번 누르면 Terminal 창에서 위와 같은 실행 파일이 돌아요. 서명이 없어 처음에 막히면 시스템 설정 → 개인정보 보호 및 보안 → [그래도 열기].
- 예전 이름(`lecpage-studio.cmd`·`.sh`·`.command`·`.zip`·`.tar.gz`)도 같은 내용으로 계속 올라가요(예전 링크·이미 깔린 실행 파일·켜 둔 자동 시작이 그 이름을 받음).
- 실행 파일은 Node.js 22가 없으면 nodejs.org의 LTS(Windows zip · macOS·Linux tar.gz, x64·arm64)를 사용자 폴더(`%LOCALAPPDATA%\lecpage` · `~/Library/Application Support/lecpage` · `~/.local/share/lecpage`)에 받고(SHA-256 확인, 관리자 권한 없음. macOS·Linux는 가장 새 LTS가 그 컴퓨터에서 돌지 않으면 그다음 LTS로), GitHub 릴리스 `studio-latest`의 묶음(`lecpage-connect.zip`·`.tar.gz`)을 받아(새 판이 있을 때만, SHA-256 확인(운영자가 공개 키를 넣은 판부터는 ed25519 서명까지). 못 받으면 있던 판으로) `node lecpage.mjs studio`로 켜요. 묶음에는 PDF 읽기 도구(pdf.js, 앱과 같은 판)가 들어 있어 강사 PC에 따로 설치할 것이 없어요. 그래도 교재 미리 읽기가 안 되면 작업은 멈추지 않고 교재 원본과 앱이 그린 쪽 그림으로 이어 가요. 릴리스는 `.github/workflows/studio-release.yml`이 main에 바뀐 것이 있을 때마다 갱신하고, 묶기는 `scripts/studio-launcher/package.sh`(내 컴퓨터에서도 같은 결과)예요. 점검: `LECPAGE_DRY_RUN=1`이면 켜기 직전에 멈춰요.
- 켜 둔 동안에도 새 판으로 바꿔요(`scripts/studio-update.mjs`): 앱의 [새 버전으로 바꾸기](`POST /bridge/update`)나, 10분 넘게 쓰지 않고 돌고 있는 일이 없을 때 저절로(켜고 2분 뒤, 그다음 3시간마다). 같은 릴리스의 `lecpage-connect.tar.gz`를 받아 `.sha256`으로 확인한 뒤에만 옆 폴더에 풀어 갈아 끼우고(예전 판은 `studio.old`), 같은 인자·같은 포트·같은 짝 맞춤 토큰으로 다시 켜요(처음 바꿀 때 켜 둔 프로세스가 감독이 되어 새 판을 같은 창에서 띄움). 새 판이 바로 꺼지면 예전 판으로 되돌려요. 받은 실행 파일로 켠 묶음에서만 하고, 저장소·Skill에서 직접 켠 것은 끄고 다시 켜요.
- 개발자: `npx -y github:yoorrard/lecpage connect`(Git 필요) · Skill을 설치했으면 `node <skill>/scripts/lecpage.mjs connect`(`studio`도 같은 명령)

켜면 기본 브라우저로 `https://lecpage.com/#pair=<토큰>&port=<포트>`를 열어 짝을 맞춰요. 앱이 토큰·포트를 이 브라우저에 기억하고 주소에서 바로 지워요. 받기 안내를 연 lecpage 탭이 있으면 그 탭이 이어 받고 새 탭은 닫혀요. 그다음부터 lecpage.com 화면이 `http://127.0.0.1:<포트>/bridge/*`를 직접 불러요(연수는 lecpage.com 저장소 그대로). Chrome·Edge는 처음 한 번 "로컬 네트워크" 접근을 물어요([허용]). 받기를 누른 브라우저가 기본 브라우저가 아니면 받기 안내의 [이 브라우저와 연결]이 켜진 커넥트를 찾아 `GET /pair`로 그 브라우저와도 짝을 맞춰요. 예비 주소는 lecpage 전용 출처 `https://lecpage.github.io/`와만 짝을 맞추고, 예전 예비 주소(`https://yoorrard.github.io/lecpage/`)와는 짝을 맞추지 않아요(같은 계정의 다른 GitHub Pages 사이트와 출처를 함께 써서). 장애 때 예비 주소에서는 API 키로 연결해요. 짝 맞춤 토큰은 이 PC 사용자 폴더(`%APPDATA%\lecpage` · `~/Library/Application Support/lecpage` · `~/.config/lecpage`)의 `studio.json`에 두어 다시 켜도 저절로 다시 붙어요.

이미 쓰던 짝(커넥트가 답한 적 있는 토큰)은 다른 토큰의 `#pair=` 주소로 바로 바뀌지 않아요. 그 포트의 커넥트가 새 토큰에 답할 때만 바꿔요(다른 사이트가 건 주소로 연결이 끊기지 않게). `--new-token`으로 다시 켠 커넥트는 새 토큰에 답하므로 그대로 다시 짝이 맞아요. 처음 짝·같은 토큰(포트만 바뀜)·아직 답한 적 없는 짝(Safari 포함)은 바로 바뀌어요.

이미 켜져 있는데 또 켜면(실행 파일을 다시 두 번 누름·자동 시작 뒤 또 켬) 둘째는 다른 포트에 띄우지 않아요. 6600~6649를 살펴(토큰 없이 먼저 물어 커넥트처럼 답하는 곳에만 토큰을 보냄) 켜진 커넥트를 찾으면 그것으로 lecpage.com을 열고 끝나요(`--autostart`·`--no-open`이면 열지 않음). 켜진 것이 예전 판이면 새 판으로 바꾸게 하고 그것을 써요. 스스로 바꿀 수 없는 아주 예전 판이면 새 판을 따로 켜요. `--port`·`--dist`·`--remote`로 켜거나 새 판으로 다시 켤 때는 찾지 않아요.

**Safari**는 https 화면에서 `http://127.0.0.1` 요청을 막아요(WebKit 171934). 그래서 lecpage 커넥트는 앱 전체를 `http://127.0.0.1:<포트>/`에서도 보여 줘요(같은 출처, 토큰은 앱 HTML의 `<meta name="lecpage-bridge">`). 이 화면은 저장소가 따로라 연수는 [파일로 저장] → [저장한 파일 열기]로 옮겨요. 바로 배포 서버는 `http://127.0.0.1:6600~6602`도 허용해요.

옵션: `--port 6600`(기본은 6600~6649 중 빈 곳) · `--no-open` · `--open lecpage|local` · `--autostart`(컴퓨터를 켤 때 켜짐: 브라우저를 열지 않음) · `--new-token`(짝을 새로, 켜진 커넥트가 없을 때만) · `--dist app/dist`(이 빌드본을 보여 주고 그 주소를 엶) · `--remote` · `--timeout 30`. 환경 변수: `LECPAGE_STUDIO_APP_URL`(짝 맞출 앱 주소) · `LECPAGE_STUDIO_ORIGINS`(더 받을 출처, 쉼표) · `LECPAGE_STUDIO_HOME`(토큰·자격 폴더).

받은 실행 파일(`lecpage-connect.cmd`·`.sh`)로 켰으면 앱에 [컴퓨터를 켤 때 켜기]가 보여요(실행 파일이 사용자 폴더에 둔 자기 복사본을 `LECPAGE_LAUNCHER`로 알려 줄 때만). Windows: `HKCU\…\Run`의 `lecpage-studio` 값에 `cmd /c start /min …lecpage-connect.cmd --autostart`(작업 표시줄에 작게) · macOS: `~/Library/LaunchAgents/com.lecpage.connect.plist`(RunAtLoad) · Linux: `~/.config/autostart/lecpage-connect.desktop`(XDG). macOS·Linux는 창 없이 뒤에서 켜지고 기록은 사용자 폴더의 `connect.log`예요. 켤 때마다 실행 파일이 새 판을 확인해요.

## 정책
- **ChatGPT 계정**(공식 문서 developers.openai.com/siwc, 2026-11-21에 다시 읽음): "ChatGPT plan usage is available to all open-source partners", 이 문서는 "open-source and locally hosted apps"용. 요금제가 있는 원격 호스팅 앱은 관심 신청서가 따로 필요 → lecpage.com이 아니라 **오픈소스 PC 프로그램인 lecpage 커넥트가** 로그인·요청을 맡아요. Plus·Pro만 대상이에요. Plus의 5시간 한도는 다른 앱과 함께 써요. 지킨 조건: `client_id=dynamic_agent_client`로 처음 등록하고 받은 client_id를 저장, `ext_agent_host_id`(`urn:uuid:`, PC마다 하나), 콜백 `http://127.0.0.1:<포트>/auth/callback`, PKCE S256·state·nonce, ID 토큰 RS256(JWKS)·iss·aud·exp·nonce 확인, scope에 `chatgpt.tokens.use.direct`가 있어야 요청, 요청은 `store:false`·`stream:true`이고 `background`·`max_output_tokens`·`previous_response_id`·`temperature` 등은 뺌(lecpage 커넥트가 한 번 더 걸러 냄), 갱신은 한 번에 하나(돌아가며 바뀌는 refresh 토큰), 연결 해제는 refresh 토큰 취소 뒤 토큰만 지움(등록·host ID는 남김). 서버에서 이어 받기(background)가 없어서, 끊기거나 길이에 닿으면 앱이 받은 글로 '이어서'를 사용자 메시지로 다시 보내요.
- **Claude 구독**: 이 PC에 로그인한 Claude Code를 고치지 않고 그대로 실행해요. 요청은 이 PC에서 Anthropic으로 바로 가고, 로그인 정보는 읽거나 옮기지 않아요.
- **Codex**: OpenAI는 내 PC에서 도는 오픈소스 앱이 Codex 로그인을 쓰는 것을 허용해요.
- Claude Code·Codex의 로그인 정보(키체인·`~/.claude/.credentials.json`·`~/.codex/auth.json`)는 읽지도 옮기지도 않아요. 설치·로그인은 공식 명령(`irm https://claude.ai/install.ps1 | iex` · `curl -fsSL https://claude.ai/install.sh | bash` · `claude auth login` · `irm https://chatgpt.com/codex/install.ps1 | iex` · `curl -fsSL https://chatgpt.com/codex/install.sh | sh` · `codex login`)을 **보이는 터미널 창**에서 돌려요(Windows 새 PowerShell 창 · macOS Terminal(`.command` 파일을 `open -a Terminal`로, Apple 이벤트 권한을 묻지 않음) · Linux `x-terminal-emulator` → `gnome-terminal` → `konsole` → `xfce4-terminal` → `mate-terminal` → `xterm`). 창을 못 열면(화면 없는 Linux 등) 같은 명령을 lecpage 커넥트 안에서 돌리고 출력을 앱(`GET /bridge/term`)과 lecpage 커넥트 창에 보여 줘요. 브라우저는 Windows `rundll32 url.dll`(= start) · macOS `open` · Linux `xdg-open` → `gio open` → `sensible-browser` → `x-www-browser`(WSL은 `wslview`)로 열고, 못 열면 주소를 창에 적어요.
- 구독은 사람이 누른 요청([만들기]·[AI로 수정]·꼭 고칠 곳의 [AI로 수정])으로만 써요. ChatGPT 계정 작업은 새로 고침·망 복구 뒤 저절로 다시 부르지 않고 [계속 만들기]를 기다려요.
- `ANTHROPIC_API_KEY`가 있으면 Claude Code가 구독 대신 그 키로 돌아요(lecpage 커넥트가 알려 줘요, 지우지는 않아요).

## 안전
- 커넥트가 보여 주는 화면·글(토큰이 든 첫 화면 포함)에는 `Cross-Origin-Resource-Policy: same-origin`을 붙여요. `/bridge/*`(CORS)·앱 부품(JS·CSS·그림·글꼴)·참고 디자인(`/examples/*`)에는 붙이지 않아요.
- `127.0.0.1`에만 묶어요. 모든 요청의 `Host`가 `127.0.0.1:<포트>`와 정확히 같아야 해요(DNS 리바인딩 거절). `/bridge/*`는 머리글 `X-Lecpage-Bridge`(짝 맞춤 토큰, 쿠키·주소에 넣지 않음)가 맞고, `Origin`이 이 주소나 허용 목록(`https://lecpage.com`·`https://www.lecpage.com`·개발 주소 `http://localhost:5173`·`:4173`·`LECPAGE_STUDIO_ORIGINS`, 예비 주소는 넣지 않음)과 정확히 같아야 해요. CORS(`Access-Control-Allow-Origin`은 그 출처만, `Vary: Origin`)와 사설망 머리글(`Access-Control-Allow-Private-Network: true`)은 허용한 출처에만 붙여요.
- ChatGPT 토큰은 이 PC 사용자 폴더의 `chatgpt.json`(0600, 원자적 쓰기)에만 두고, 앱에는 연결 여부·이메일·모델 목록만 줘요. 터미널 기록에도 남기지 않아요. `/auth/callback`은 OpenAI가 보내는 최상위 이동이라 토큰 대신 state로 확인해요.
- 한 번에 작업 하나, 교재 파일 하나 100MB·모두 120MB·20개까지, 작업 30분 한도와 멈추기(프로세스 묶음째 끔).
- 에이전트는 새 빈 임시 폴더(훅·`.mcp.json` 없음)에서 돌아요. Claude Code: `--restricted`, 도구는 Read·Write·Edit·Glob·Grep과 검수 명령 하나만 허용한 Bash(윈도우는 PowerShell도 같은 명령만), 작업 폴더 밖 읽기·쓰기 막기, 훅 끔, MCP 없음, 묻는 대신 거절, 세션을 디스크에 남기지 않음. 시작할 때 MCP·웹 도구가 켜져 있으면 멈춰요. Codex: `--sandbox workspace-write`, `--ephemeral`. Codex는 내 설정(`~/.codex/config.toml`)의 MCP 서버를 그대로 켜요(설정을 빼면 로그인 저장 위치까지 바뀔 수 있어 빼지 않아요). MCP 도구를 부르는 순간 작업을 멈추니, Codex로 쓸 때는 설정의 MCP 서버를 꺼 두는 게 좋아요.
- 검수 실행기(`../bin/check.mjs`)는 작업 폴더 밖에 있어요. Claude Code에는 그 폴더를 `--add-dir`로 더해 검수 명령을 실행할 수 있게 하고(더하지 않으면 경로 검사가 검수 명령까지 막아요), 파일 도구로 고치는 것은 `Write`·`Edit` 거절 규칙으로 막아요. 강사 값(참여 서버·주소·공개 범위)은 에이전트에게 주지 않아요.
- 작업 지시(TASK.md)는 짧게: 목표(강의 진행 사이트), 강사 요청과 참고 디자인에서 담은 디자인 목록, 배포 조건, 쓰고 싶을 때만 쓰는 강의 기능 자리 표시, 원하면 쓰는 검수 명령. 디자인 서재(`design-library.md`)는 작업 폴더에 두고 필요하면 참고하게 해요(따를 의무 없음). 읽는 법·디자인·화면 확인과 다듬기는 에이전트가 정해요(디자인 규칙·레퍼런스 사이트는 넣지 않아요).
- 교재는 있는 그대로 알려요. 원본은 `material/`에 두고, 앱이 그려 보낸 쪽 그림(`site['material/p-NNN.webp']`)이 있으면 그 그림을 그대로 써요(다시 그리지 않아요). 쪽 그림은 교재 하나의 것이라, 교재가 여럿이면 앱이 표시한(`files[].pageImages`) 교재의 쪽 그림이라고 적고, 표시가 없으면 어느 교재 것인지 모른다고 적어요. 슬라이드는 쪽마다 그림 번호를 맞추고(숨긴 슬라이드는 그림이 없어요), 한글·워드는 실제 쪽과 읽은 '부분'의 차례가 달라 번호를 맞추지 않아요.
- PDF가 아닌 교재의 글·표·발표자 노트는 `work/material.md`에, 글자·단추에 걸려 있어 쪽 그림과 PDF 원본에서는 보이지 않는 링크 주소는 `work/links.md`에 둬요(PDF 교재도). 이 PC에 PDF를 쪽별로 여는 도구(poppler)가 없으면 Claude Code는 PDF를 통째로만, 20MB까지만 읽어요. 그보다 큰 PDF는 코드가 뽑은 글도 `work/material.md`에 넣고 작업 지시에 그렇게 적어요.
- 읽지 못한 교재(예전 `.ppt`·`.doc`, 손상·보안 문서, 쪽이 없는 파일)는 말없이 빼지 않아요. 다른 교재가 있으면 작업 지시에 '읽지 못한 교재'로 적고 이어 가고, 하나도 읽지 못하면 어느 파일이 왜 안 됐는지와 할 일을 알리고 멈춰요.
- 결과에 키·토큰·이 PC의 폴더 경로처럼 보이는 글이 있으면 받지 않아요. 문서·묶음 파일(PDF·PPT·한글·워드·엑셀·ZIP 등)은 강사가 준 파일과 똑같을 때만, 그림·글꼴·소리·영상은 그 형식이 맞을 때만 받고 나머지는 빼요(교재 속 지시문에 속은 에이전트가 이 PC 파일을 사이트에 넣지 않게).
- 작업이 끝나면 임시 폴더를 바로 지우고, 결과는 앱이 가져간 뒤 `DELETE`로 메모리에서도 지워요. 터미널에는 교재 내용·파일 이름·토큰을 적지 않아요.

## 문제 해결
| 증상 | 할 일 |
|---|---|
| lecpage.com이 lecpage 커넥트를 켜 달라고 해요 | 받은 `lecpage-connect.cmd`를 두 번 누르거나(Windows) 터미널 한 줄을 다시(macOS·Linux). 켰는데도 그대로면 주소창 왼쪽 아이콘 → 사이트 설정에서 "로컬 네트워크"를 허용 |
| "짝이 맞지 않아요" | lecpage 커넥트를 끄고 다시 켜기(lecpage.com이 다시 열리며 짝을 맞춤) |
| "이 PC에 Claude Code가 없어요" | 앱의 [Claude 계정으로 로그인]이 설치(창 없이)와 로그인(브라우저)을 이어서 해요. 보안 프로그램·회사 네트워크가 막으면 claude.ai·downloads.claude.ai를 허용하거나 '다른 방법'의 [터미널 창에서 하기] |
| "로그인되어 있지 않아요" | 앱의 [Claude 계정으로 로그인] (또는 `claude auth login` / `codex login`) |
| "2.1.314 이상이 필요해요" | 앱의 [Claude 계정으로 로그인](공식 설치 명령으로 새 버전) 또는 `claude update` |
| "ChatGPT 요금제 사용을 허락하지 않았어요" | [ChatGPT 계정으로 로그인]을 다시 눌러 동의 화면에서 허락 |
| "ChatGPT 사용 한도에 닿았어요" | 한도가 차면 [계속 만들기]. 사용량: chatgpt.com/settings/usage |
| `npm error … git … enoent` | Git이 없어요 → 위의 codeload 주소로 |
| 포트가 모두 쓰임 | 켜 둔 다른 lecpage 커넥트 창(또는 자동 시작으로 켜진 것)을 쓰거나 `--port`로 다른 번호 |
| 127.0.0.1 화면에서 지난 작업이 안 보임 | 그 화면의 저장소는 주소(포트 포함)마다 따로예요. lecpage.com 화면(Chrome·Edge)에서 쓰거나 [파일로 저장] → [저장한 파일 열기] |
| "앱 파일을 받지 못했어요" | 인터넷 확인. 저장소를 받았으면 `cd app && npm run build` 뒤 `--dist app/dist` |

## HTTP 약속 (앱이 부름, `docs/plan-ai-first.md` §10)
모든 요청에 `X-Lecpage-Bridge: <토큰>`. 오류는 `{ ok:false, error, message_ko }`(401 토큰·403 출처·409 바쁨/준비 안 됨·413 너무 큼·415 JSON 아님·421 주소·429 연달아 누름).
- `GET /bridge/status` → `{ ok, version, build, caps:[…], update:{ can, build, latest, available, state:idle|download|install|restart|error, to, error?, error_ko? }, app:'dist'|'remote', platform, port, agents:[{ id, name, installed, version, auth:'subscription'|'api-key'|'unknown', loggedIn, ready, need:''|'install'|'login'|'update', note_ko }], chatgpt:{ connected, plan, email, pending, welcome, needsLogin, usageUrl }, autostart:{ available, on }, term:null|{ agent, action, running, code, startedAt }, job, limits, policy_ko:{ claude, codex, chatgpt } }` (`?fresh`면 에이전트를 새로 살핌)
- `POST /bridge/chatgpt/login` `{ open?, reconsent? }` → `{ ok, url }`(OpenAI 로그인 주소. `open`이면 lecpage 커넥트가 기본 브라우저로 엶) · `GET /auth/callback`(토큰 없음, state 확인) · `GET /bridge/chatgpt` → 위 `chatgpt` · `DELETE /bridge/chatgpt` → `{ revoked, … }` · `POST /bridge/chatgpt/welcome` · `GET /bridge/chatgpt/models` → `{ models:[{ id, label }] }`
- `POST /bridge/chatgpt/responses` (Responses 요청 본문: `model`·`instructions`·`input`·`text`·`reasoning`만 씀) → OpenAI SSE 그대로. 거절은 `{ ok:false, error, code, status, message, message_ko }`(예: 429 `subscription_sharing_usage_limit_exceeded`, 403 `subscription_sharing_user_not_eligible`, 401 `not-connected`)
- `POST /bridge/agents/:id/install|login|update` (id: `claude`·`codex`) → `{ ok:true, action, how }`(터미널 창을 엶: `powershell`·`terminal`·리눅스 터미널 이름) 또는 `{ ok:false, action, how:'inline', command, message_ko }`(창을 못 열어 lecpage 커넥트 안에서 돌림). 이미 설치돼 있으면 install은 login(또는 update)으로
- `POST /bridge/agents/claude/setup` → `{ ok, setup }`(터미널 없이 연결 시작, 하는 중이면 그것) · `GET /bridge/setup` → `{ setup:null|{ step:check|install|login|done|error|stopped, running, install:''|run|done|skip, progress:{ phase:download|setup|done, done, total }, loginUrl, waitingCode, codeSent, from:''|desktop, error:{ code:offline|blocked|cancelled|timeout|bad-code|memory|install-failed|login-failed|missing|old, at, title_ko, message_ko }, tail? } }` · `POST /bridge/setup/code` `{ code }`(가운데 # 포함, Claude Code 표준 입력으로만, 기록 안 함. 400 bad-code · 409 not-waiting) · `DELETE /bridge/setup`(취소). `/bridge/status`의 `setup`(tail 없이)으로 새로 고쳐도 이어 그림
- `GET /bridge/term` → `{ term:null|{ agent, action, running, code, output, startedAt } }`(창 없이 돌린 설치·로그인의 출력, 뒤 16KB, 색 코드 뺌) · `POST /bridge/term/input` `{ text }`(한 줄 보냄: 로그인 코드 붙여 넣기, 409 돌고 있지 않음) · `DELETE /bridge/term`(멈춤)
- `GET /bridge/update`(`?fresh`면 릴리스를 다시 확인) → `{ ok, update }` · `POST /bridge/update` → 202 `{ ok, update }`(받아서 바꾸고 다시 켬. 앱은 `/bridge/status`의 `build`가 바뀔 때까지 기다림) · 200 `{ upToDate:true }` · 409 `update-unavailable`(받은 묶음이 아님)·`busy`(작업·연결·ChatGPT 요청 중) · 502 `update-network`. 바꾸는 동안 다른 `/bridge/*`는 503 `updating`. `caps`가 없거나 앱이 쓰는 것(`claude-setup` 등)이 빠졌으면 앱은 예전 판으로 보고 [새 버전으로 바꾸기](없으면 다시 켜는 법)를 보여 줘요. 예전 판에 없는 경로는 404 `not-found`라 앱이 같은 안내로 바꿔 보여 줘요
- `GET·POST /bridge/autostart` `{ on }` → `{ available, on }`(Windows·macOS·Linux, 받은 실행 파일로 켰을 때만. 아니면 409)
- `GET /bridge/convert` → `{ ok, platform, apps:[{ id, name }], exts:{ pptx:['powerpoint','libreoffice'], … } }` · `POST /bridge/convert?name=<파일 이름>`(본문: 파일 바이트, 100MB까지) → `{ ok, via, app, pdf: base64 }` 또는 422 `{ error:'no-app'|'convert-failed'|'macro'|'hwp-script'|'hwp-unreadable'|'mac-office', message_ko }`. 이 PC에 깔린 프로그램으로 교재를 PDF로 바꿈(`scripts/studio-convert.mjs`): Windows PowerPoint·Word·한글(COM) → macOS PowerPoint·Keynote·Word·Pages(AppleScript) → LibreOffice. 바꿀 때 매크로는 돌리지 않아요(PowerPoint·Word는 문서를 열기 전에 매크로를 끄고 읽기 전용으로, LibreOffice는 매크로를 끈 새 프로필로). 한글은 스크립트 매크로가 한글이 넣는 빈 틀뿐일 때만, macOS PowerPoint·Word는 매크로 없는 .pptx·.docx(파일 내용으로 확인)일 때만 열어요. 아니면 그 프로그램을 건너뛰어요(옛 형식은 Keynote·Pages·LibreOffice로). 매크로가 든 형식(pptm·docm 등)은 바꾸지 않고 422 `macro`로 거절해요. 앱은 교재를 넣을 때 이 PDF로 쪽 그림을 그리고 AI에게 원본처럼 건네요(없으면 브라우저 안 그리기, 그것도 안 되면 글자만). 한 번에 하나씩 바꿔요. 한글은 보안 모듈이 없으면 '파일 접근' 창이 떠서 [모두 허용]을 눌러야 해요
- `POST /bridge/jobs` `{ agent, kind:'make'|'edit', request, meta, reference, files:[{ name, type, base64, pageImages? }], site?, target? }` → 202 `{ ok, jobId }`. `site` 값은 글 또는 `{ base64 }`. 새로 만들 때도 앱이 그린 쪽 그림을 `site['material/p-NNN.webp']`로 보내면 써요(이 PC에 LibreOffice·pdftoppm이 없으면 lecpage 커넥트가 쪽 그림을 못 그려요).
- `GET /bridge/jobs/:id/events`(SSE, `id:` 붙음, `Last-Event-ID`로 이어 받기): `{ type:'step', name, label_ko }` · `{ type:'log', text }` · `{ type:'done', label_ko, summary:{ errors, warnings, files } }` · `{ type:'error', code:'timeout'|'stopped'|'agent'|'prepare'|'unsafe'|…, error }`. 머리글이 필요해 `EventSource` 대신 `fetch`로 읽어요.
- `GET /bridge/jobs/:id` → `{ id, agent, kind, status:'running'|'done'|'error'|'stopped', step, startedAt, endedAt, error }`
- `GET /bridge/jobs/:id/result` → `{ site, meta, issues, warnings, material:{ pages }, dropped, agent }`. 글 파일은 글, 그림(`material/p-NNN.webp`·`assets/img/*`)은 `{ base64, type }`. `meta`에는 강사 값이 없어 앱이 지켜 둔 값을 다시 넣어요.
- `DELETE /bridge/jobs/:id` → 돌던 작업은 멈추고 지움 `{ ok, stopped }`
