# 내 PC 연결 프로그램 (lecpage studio)

PC에 Claude Code나 Codex를 설치하고 로그인해 두면, lecpage 앱이 그 프로그램을 실행해 사이트를 만들어요. 요청은 내 구독 한도에서 차감돼요. 연결 프로그램은 앱 전체를 `http://127.0.0.1:<포트>/`에서 보여 줘서(같은 출처) Safari·Chrome 어디서나 돼요.

## 설치·띄우기
1. [Node.js](https://nodejs.org) 22 이상(LTS)을 설치해요.
2. Claude Code([설치](https://code.claude.com/docs/ko/setup)) 또는 Codex(`npm i -g @openai/codex`)를 설치하고 터미널에서 한 번 로그인해요: `claude auth login` / `codex login`.
3. 터미널에서 띄워요. 브라우저가 저절로 열려요.
   ```
   npx -y github:yoorrard/lecpage studio
   ```
   - Git이 없는 PC: `npx -y https://codeload.github.com/yoorrard/lecpage/tar.gz/refs/heads/main studio`
   - Skill을 설치했으면: `node <skill>/scripts/lecpage.mjs studio`
4. 앱의 AI 선택에서 "내 PC의 Claude Code·Codex"를 골라요. 끝내려면 터미널에서 Ctrl+C.

옵션: `--port 6600`(기본은 6600~6649 중 빈 곳, 같은 포트여야 지난 작업이 보여요) · `--no-open` · `--dist app/dist`(이 빌드본을 보여 줌, 없으면 저장소의 `app/dist` → 그것도 없으면 lecpage.com에서 받음) · `--remote`(늘 lecpage.com에서) · `--timeout 30`(작업 한도, 분).

## 정책
- **Claude 구독**: 내 구독으로 로그인한 Claude Code를 고치지 않고 쓰는 것은 허용되지만, 다른 제품이 구독 한도를 쓰게 하는 것은 Anthropic 승인이 필요해서, 이 연결은 켜는 사람이 직접 고르는 선택 기능이에요. 자동·반복 호출은 하지 않고 사람이 누를 때만 돌아요.
- **Codex**: OpenAI는 내 PC에서 도는 오픈소스 앱이 Codex 로그인을 쓰는 것을 허용해요.
- 로그인 정보(키체인·`~/.codex/auth.json`·토큰)는 읽지도 옮기지도 않아요. 로그인은 공식 명령으로만 해요.
- `ANTHROPIC_API_KEY`가 있으면 Claude Code가 구독 대신 그 키로 돌아요(연결 프로그램이 알려 줘요, 지우지는 않아요).

## 안전
- `127.0.0.1`에만 묶고, 띄울 때마다 새 토큰을 앱 HTML(`<meta name="lecpage-bridge">`)에 넣어요. `/bridge/*`는 머리글 `X-Lecpage-Bridge`가 맞아야 하고, `Host`·보낸 `Origin`이 이 주소와 정확히 같아야 해요(다른 사이트·DNS 리바인딩 거절, CORS 머리글 없음).
- 한 번에 작업 하나, 교재 파일 하나 100MB·모두 120MB·20개까지, 작업 30분 한도와 멈추기(프로세스 묶음째 끔).
- 에이전트는 새 빈 임시 폴더(훅·`.mcp.json` 없음)에서 돌아요. Claude Code: `--restricted`, 도구는 Read·Write·Edit·Glob·Grep과 검수 명령 하나만 허용한 Bash(윈도우는 PowerShell도 같은 명령만), 작업 폴더 밖 읽기·쓰기 막기, 훅 끔, MCP 없음, 묻는 대신 거절, 세션을 디스크에 남기지 않음. 시작할 때 MCP·웹 도구가 켜져 있으면 멈춰요. Codex: `--sandbox workspace-write`, `--ephemeral`. Codex는 내 설정(`~/.codex/config.toml`)의 MCP 서버를 그대로 켜요(설정을 빼면 로그인 저장 위치까지 바뀔 수 있어 빼지 않아요). MCP 도구를 부르는 순간 작업을 멈추니, Codex로 쓸 때는 설정의 MCP 서버를 꺼 두는 게 좋아요.
- 검수 실행기(`../bin/check.mjs`)는 작업 폴더 밖에 있어요. Claude Code에는 그 폴더를 `--add-dir`로 더해 검수 명령을 실행할 수 있게 하고(더하지 않으면 경로 검사가 검수 명령까지 막아요), 파일 도구로 고치는 것은 `Write`·`Edit` 거절 규칙으로 막아요. 강사 값(참여 서버·주소·공개 범위)은 에이전트에게 주지 않아요.
- 작업 지시(TASK.md)는 짧게: 목표 한 줄(강의 동반자 사이트), 강사 요청, 배포 조건, 쓰고 싶을 때만 쓰는 강의 기능 자리 표시, 원하면 쓰는 검수 명령. 읽는 법·디자인·화면 확인과 다듬기는 에이전트가 정해요(디자인 원칙·레퍼런스 사이트는 넣지 않아요).
- 작업이 끝나면 임시 폴더를 바로 지우고, 결과는 앱이 가져간 뒤 `DELETE`로 메모리에서도 지워요. 터미널에는 교재 내용·파일 이름·토큰을 적지 않아요.

## 문제 해결
| 증상 | 할 일 |
|---|---|
| "Claude Code가 이 PC에 없어요" | 설치 뒤 새 터미널에서 다시 띄우기. `claude --version`이 되는지 확인 |
| "로그인되어 있지 않아요" | `claude auth login` / `codex login` 뒤 앱에서 다시 |
| "2.1.314 이상이 필요해요" | `claude update` |
| `npm error … git … enoent` | Git이 없어요 → 위의 codeload 주소로 |
| 포트가 모두 쓰임 | 켜 둔 다른 연결 프로그램 창을 쓰거나 `--port`로 다른 번호 |
| 지난 작업이 안 보임 | 앱 저장소는 주소(포트 포함)마다 따로예요. 같은 포트로 띄우거나 [파일로 저장] → [저장한 파일 열기] |
| "앱 파일을 받지 못했어요" | 인터넷 확인. 저장소를 받았으면 `cd app && npm run build` 뒤 `--dist app/dist` |

## HTTP 약속 (앱이 부름, `docs/plan-ai-first.md` §10)
모든 요청에 `X-Lecpage-Bridge: <토큰>`. 오류는 `{ ok:false, error, message_ko }`(401 토큰·403 출처·409 바쁨/준비 안 됨·413 너무 큼·415 JSON 아님·421 주소).
- `GET /bridge/status` → `{ ok, version, app:'dist'|'remote', agents:[{ id, name, installed, version, auth:'subscription'|'api-key'|'unknown', loggedIn, ready, note_ko }], job, limits, policy_ko:{ claude, codex } }`
- `POST /bridge/jobs` `{ agent, kind:'make'|'edit', request, meta, reference, files:[{ name, type, base64 }], site?, target? }` → 202 `{ ok, jobId }`. `site` 값은 글 또는 `{ base64 }`. 새로 만들 때도 앱이 그린 쪽 그림을 `site['material/p-NNN.webp']`로 보내면 써요(이 PC에 LibreOffice·pdftoppm이 없으면 연결 프로그램이 쪽 그림을 못 그려요).
- `GET /bridge/jobs/:id/events`(SSE, `id:` 붙음, `Last-Event-ID`로 이어 받기): `{ type:'step', name, label_ko }` · `{ type:'log', text }` · `{ type:'done', label_ko, summary:{ errors, warnings, files } }` · `{ type:'error', code:'timeout'|'stopped'|'agent'|'prepare'|'unsafe'|…, error }`. 머리글이 필요해 `EventSource` 대신 `fetch`로 읽어요.
- `GET /bridge/jobs/:id` → `{ id, agent, kind, status:'running'|'done'|'error'|'stopped', step, startedAt, endedAt, error }`
- `GET /bridge/jobs/:id/result` → `{ site, meta, issues, warnings, material:{ pages }, dropped, agent }`. 글 파일은 글, 그림(`material/p-NNN.webp`·`assets/img/*`)은 `{ base64, type }`. `meta`에는 강사 값이 없어 앱이 지켜 둔 값을 다시 넣어요.
- `DELETE /bridge/jobs/:id` → 돌던 작업은 멈추고 지움 `{ ok, stopped }`
