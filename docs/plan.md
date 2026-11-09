# lecpage 기획서 v1.0

> 초안(v0.1, 2026-11-09 대화)에서 이름을 **lecpage**로 정하고, 조사 결과를 반영해 고도화한 판입니다. 같은 날 v1.0 구현과 함께 확정했습니다.

## 1. 한 줄 정의
연수 교재(PPT·PDF·한글 HWPX·워드)와 연수 정보로, 그 연수만을 위한 사이트를 **내용 구성·디자인·모션·실시간 참여 기능·서버 운영 방식·배포**까지 맞춰 만들어 주는 Agent Skill과 웹앱.

## 2. v0.1 → v1.0에서 바뀐 결정
| 항목 | v0.1 | v1.0 | 이유 |
|---|---|---|---|
| 사이트 틀 | Astro | **빌드 도구 없는 정적 생성기**(문자열 렌더러 + 클래식 런타임) | 웹앱이 브라우저 안에서 바로 사이트를 조립·ZIP으로 만들 수 있어야 함. 어떤 호스팅·USB·file://에서도 동작 |
| 엔진 위치 | 별도 패키지 | **skills/lecpage/engine 하나**를 skill과 웹앱이 함께 씀 | `npx skills add`로 받은 skill이 자체 완결, 복사본 없음 |
| 디자인 | 프리셋 6종·효과 25종 | **프리셋 12종 × 효과 52종 × 슬롯 18개**, 주제·분위기·기기·네트워크로 자동 선택 + 변주(seed) | 같은 프리셋이라도 연수마다 다르게, 학교 기기에서도 안전하게 |
| 실시간 | Supabase 중심 | **어댑터 5종**(브라우저 미리보기·Supabase·Sheets·Cloudflare·자체 서버) + 공통 HTTP 프로토콜 | 인원·인프라·인터넷 없는 교실까지 대응 |
| 참가자 로그인 | 익명 로그인 | **로그인 없음, 참여 토큰** | Supabase 익명 로그인은 IP당 시간당 30회라 한 학교(공인 IP 하나)에서 31번째부터 막힘 |
| AI 연결 | BYOK + 계정 연결 | 복사·붙여넣기(기본) · BYOK(Gemini 무료 키) · OpenRouter PKCE · AI 없는 초안 · skill | Claude·Google 구독 OAuth 재사용은 약관 금지(정지 사례). 모델 이름은 사용자 키로 목록을 불러와 고름 |
| 웹앱 운영 | 미정 | **로컬 우선 정적 PWA**, 로그인·운영자 DB 없음, **Cloudflare Workers 정적 자산(Workers Builds) + lecpage.com**, GitHub Pages는 미러 | 운영비 0원(도메인 값만), 개인정보 책임 최소. diagrams.net·Excalidraw 방식. 순서: `docs/operations.md` |

## 3. 구성
1. **엔진**(`skills/lecpage/engine/src`): 설계도 검증·자동 보정 → 결정 규칙(유형·디자인·운영) → 렌더러(섹션 28종, 페이지 5종) → 빌드(파일 묶음) · 교재 해석(PPTX·PDF·HWPX·DOCX) · AI 프롬프트 팩.
2. **런타임**(`engine/runtime`): 참가자 화면(교재 뷰어·실습 스테이션·프롬프트 복사·접속 진단·실시간 UI), 강사 콘솔, 프로젝터 화면, 효과 레지스트리(fx), 실시간 어댑터(live).
3. **백엔드**(`skills/lecpage/backends`): Supabase SQL(RLS·RPC·속도 제한), Apps Script, Cloudflare Worker+Durable Objects, 의존성 없는 Node 서버(SQLite·SSE·WebSocket, Docker).
4. **skill**(`skills/lecpage/SKILL.md` + references 10여 개 + scripts): 10단계 흐름, 인터뷰 질문, 설계도 작성법, 디자인·운영·배포·개인정보·점검 기준.
5. **웹앱**(`app/`): 7단계 마법사(자료 → 연수 정보 → AI 설계 → 내용 다듬기 → 디자인 → 운영 방식 → 완성·배포), 디자인 사전, 도움말, 설정.

## 4. 사이트 유형과 기능
- 유형 4: 스토리형·실습형·라이브형·과정형(혼합 가능). 결정 규칙은 `references/modules.md`.
- 기능 34개: 연수 전(안내·일정·준비 점검·접속 진단·QR) / 연수 중(입장·출석·교재 뷰어·강사 따라가기·실습 스테이션·막혔어요·실시간 질문·참여 보드·투표·퀴즈·반응) / 강사 콘솔(진행 현황판·진행 맞추기·타이머·공지·관리·프로젝터·CSV·일괄 삭제) / 연수 후(설문·나의 기록·자료실·아카이브).

## 5. 디자인 체계
무드 프리셋 → 디자인 토큰(shadcn 이름, 라이트·다크, 대비 자동 검사) → 부품 변형(첫 화면·카드·메뉴·버튼) → 모션 단계(0~3) → 슬롯별 효과 → 시그니처 하나. 생성 사이트마다 `DESIGN.md`를 함께 출력해 나중에 어떤 AI로 고쳐도 일관성 유지. 상세: `skills/lecpage/references/design.md`, 조사: `docs/research/motion-graphics.md`.

## 6. 운영 방식 결정
입력: 인원·필요 기능·기간·숙련도·가진 인프라·네트워크·유료 여부·미성년자.
- 기록이 필요 없음 → 정적(서버 없음)
- 모으기만, 40명 이하 → Google Sheets
- 클릭만 하는 강사, 50명 이하(질문·막혔어요·진행 포함) → Google Sheets
- 실시간, 100명 이하 → Supabase 무료(강사 소유)
- 100명 초과 → Cloudflare Workers + Durable Objects(강사 계정, Deploy 버튼)
- 운영자 공용 중계는 두지 않음(모두 강사 소유)
- 가진 서버(AWS·학교·NAS) + 설정 가능 → 자체 Node 서버(Docker)
- 인터넷 없음 → 강사 노트북 서버(LAN)
호스팅: Cloudflare(기본 권장) · GitHub Pages · Netlify · Vercel(비상업만) · Firebase · AWS · 자체 서버 · ZIP/USB. 상세: `references/infra-decision.md`, `references/deploy/*.md`(15종).
생성 사이트 공개 범위: 링크(기본, 검색 제외) · 공개 · 암호(AES-GCM 암호화, QR `#k=`로 자동 열기). 강사용 파일(DESIGN.md·운영안내.md·설계도)은 올리는 사이트에 넣지 않음.

## 7. 개인정보·보안
별명 + 참여 코드가 기본, 이름·소속은 출석 기능에서만(동의 화면·처리 안내 자동), 보관 30일 후 일괄 삭제, 14세 미만은 별명만. 관리자 키는 해시만 서버에. AI·사용자 입력은 JSON 데이터로만 다루고 렌더러가 모두 이스케이프, 링크는 https만. 웹앱은 키를 탭에만 기억(선택 시 WebCrypto 암호화), 미리보기는 샌드박스.

## 8. 로드맵
- **v1.0(완료)**: 엔진·런타임·효과 52·프리셋 12·실시간 어댑터 5·백엔드 4·skill·웹앱·배포 안내 18·테스트
- **v1.1**: 참가 확인서(PDF), 채팅 UI, 모둠 편성, 교재 도우미 AI(강사 키), 사전·사후 설문 비교
- **v1.2**: Cloudflare 도우미 Worker(GitHub OAuth, Cloudflare·Supabase 원클릭 프로비저닝), Google Drive 저장
- **v2**: 챗봇 연결(MCP 서버·MCP Apps, ChatGPT 플러그인·Claude 커넥터), Sign in with ChatGPT(승인 시), 설계도 공유·복제 갤러리

## 9. 남은 결정(운영자)
1. ~~웹앱 주소~~ → 2026-11-09 결정: Cloudflare Workers 정적 자산 + lecpage.com, GitHub Pages 미러(`docs/operations.md`)
2. Sign in with ChatGPT 대기 신청 여부
3. ~~공용 실시간 중계 운영 여부~~ → 2026-11-09 결정: 운영하지 않음. 강사 소유 백엔드를 쉽게(`docs/research/2026-11-review.md`)
