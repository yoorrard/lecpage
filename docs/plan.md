# lecpage 기획서

> v1.1(2026-11-11)까지는 "교재 → 설계도(blueprint) → 프리셋·섹션 렌더러"의 템플릿 방식이었고, 2026-11-20에 **AI가 교재를 읽고 사이트를 직접 쓰는 방식**으로 바꿨습니다(템플릿 코드는 지움). 지금 흐름·약속은 [AI 중심 개편 설계](plan-ai-first.md), 코드 계약은 [아키텍처](architecture.md)가 기준입니다. 이 문서에는 바뀌지 않은 결정만 남겼습니다.

## 1. 한 줄 정의
연수 교재(PPT·PDF·한글 HWP·HWPX·워드)와 연수 정보로, 그 연수만을 위한 사이트를 **내용 구성·디자인·모션·실시간 참여 기능·서버 운영 방식·배포**까지 맞춰 만들어 주는 Agent Skill과 웹앱. 쓰는 사람은 학교·기업·공공기관·학원 등에서 강의·연수를 진행하는 강사와 연수 담당자예요.

| AI가 하는 일 | lecpage가 하는 일 |
|---|---|
| 교재를 읽고 흐름·구성·디자인·HTML·CSS·JS를 씀, 검수 결과를 보고 고침 | 교재를 AI가 읽기 좋은 꼴로(원본·쪽 그림·보조 글), 강의 기능 키트, 조립(CSP·강사·발표 화면·QR 안내문·접속 확인·개인정보 안내), 검수, 배포 |

## 2. 바뀌지 않은 결정
| 항목 | 결정 | 이유 |
|---|---|---|
| 엔진 위치 | **skills/lecpage/engine 하나**를 skill과 웹앱이 함께 씀 | `npx skills add`로 받은 skill이 자체 완결, 복사본 없음 |
| 실시간 | **어댑터 5종**(브라우저 미리보기·Supabase·Sheets·Cloudflare·자체 서버) + 공통 HTTP 프로토콜 | 인원·인프라·인터넷 없는 교실까지 대응 |
| 참가자 로그인 | **로그인 없음, 참여 토큰** | Supabase 익명 로그인은 IP당 시간당 30회라 한 학교(공인 IP 하나)에서 31번째부터 막힘 |
| AI 연결 | 내 PC의 Claude Code·Codex(첫 추천) · 키 붙여넣기(Claude · OpenAI) · 쓰던 AI 창에 복사·붙여넣기 · skill. Gemini는 만들기에서 뺌(2026-11-21) | 구독 계정 로그인을 앱이 빌려 쓰지 않음 |
| 웹앱 운영 | **로컬 우선 정적 PWA**, 로그인·운영자 DB 없음, Cloudflare Workers 정적 자산 + lecpage.com, GitHub Pages는 미러 | 운영비 0원(도메인 값만) |

## 3. 운영 방식 결정
입력: 인원·필요 기능·기간·숙련도·가진 인프라·네트워크·유료 여부·미성년자.
- 기록이 필요 없음 → 정적(서버 없음)
- 모으기만, 40명 이하 → Google Sheets
- 클릭만 하는 강사, 50명 이하(질문·도움 요청·진행 현황 포함) → Google Sheets
- 실시간, 100명 이하 → Supabase 무료(강사 소유)
- 100명 초과 → Cloudflare Workers + Durable Objects(강사 계정, Deploy 버튼)
- 운영자 공용 중계는 두지 않음(모두 강사 소유)
- 가진 서버(AWS·학교·NAS) + 설정 가능 → 자체 Node 서버(Docker)
- 인터넷 없음 → 강사 노트북 서버(LAN)
올릴 곳(2026-11-11 재조사, `docs/research/hosting-2026-11.md`): 앱은 **Vercel**(토큰 하나로 앱에서 바로, 다시 올려도 같은 주소) → GitHub Pages → Cloudflare(ZIP 끌어 놓기) → Netlify, skill은 **Cloudflare Workers 정적 자산**(`wrangler`, 상업 이용 가능·요청 무제한) 먼저. 강사료를 받는 연수는 Vercel 무료를 빼고, 사이트 크기·파일 수·지난번에 올린 곳·연결해 둔 곳을 보고 순서를 바꿈(`decideHost`, `checkHost`). 운영자가 켜면 가입 없이 30일 동안 여는 '바로 공개'(`hosting/`)도 고를 수 있음. 그 밖: Firebase · AWS · 자체 서버 · ZIP/USB. 상세: `references/infra-decision.md`, `references/deploy/*.md`(15종).
생성 사이트 공개 범위: 링크(기본, 검색 제외) · 공개 · 암호(AES-GCM 암호화, QR `#k=`로 자동 열기). 강사용 파일(운영안내.md)은 올리는 사이트에 넣지 않음.

## 4. 개인정보·보안
별명 + 연수 코드가 기본, 이름·소속은 출석 기능에서만(동의 화면·처리 안내 자동), 보관 30일 후 일괄 삭제, 14세 미만은 별명만. 관리자 키는 해시만 서버에. AI가 쓴 사이트는 조립이 CSP(`script-src 'self'`+고정 라이브러리, `connect-src`는 연결한 참여 서버만)·바깥 스크립트 빼기로 감싸고, 키트·보조 쪽은 모든 글을 이스케이프, 링크는 https만. 웹앱은 키를 탭에만 기억(선택 시 WebCrypto 암호화), 미리보기는 샌드박스.

## 5. 로드맵
- **v1.0~v1.1(완료, 2026-11)**: 템플릿 엔진·실시간 어댑터 5·백엔드 4·skill·웹앱·앱에서 바로 공개. 템플릿 부분은 2026-11-20에 지움.
- **AI 중심 개편(2026-11-20)**: AI가 사이트를 쓰고 lecpage는 키트·조립·검수·배포. 순서는 [plan-ai-first.md](plan-ai-first.md) §14.
- **다음**: 참가 확인서(PDF), 사전·사후 설문 비교, 로그인으로 연결(Vercel·GitHub·Cloudflare), Supabase 원클릭 준비, Google Drive 저장, 챗봇 연결(MCP).

## 6. 남은 결정(운영자)
1. ~~웹앱 주소~~ → 2026-11-09 결정: Cloudflare Workers 정적 자산 + lecpage.com, GitHub Pages 미러(`docs/operations.md`)
2. Sign in with ChatGPT 대기 신청 여부
3. ~~공용 실시간 중계 운영 여부~~ → 2026-11-09 결정: 운영하지 않음. 강사 소유 백엔드를 쉽게(`docs/research/2026-11-review.md`)
