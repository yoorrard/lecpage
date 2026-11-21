# lecpage — 작업 메모(새 세션이 먼저 읽음)

강사가 교재(PDF·PPT·HWP·워드)를 넣으면 AI가 **강의 당일 참가자가 휴대폰에 열어 두고 쓰는 강의 사이트**를 만들고, lecpage가 참여 기능·강사/발표 화면·QR·배포를 더하는 도구. 앱 https://lecpage.com(로컬 우선 Vite+Preact), Skill(`skills/lecpage/`), 바로 배포 서버(`hosting/`, Cloudflare Worker).

## 구조(어디를 고치나)
- `app/` 앱. 만들기 흐름 `src/lib/gen/`(job.js 실행·이어 받기, prompts.js 요청문, providers/ 회사별), 연결 `src/lib/connection.js`·`components/AiPick.jsx`, 미리보기 `components/Preview.jsx`, 랜딩 `src/landing/`, 도움말 `pages/Help.jsx`, 먼저 해보기 `src/data/demo/`.
- `skills/lecpage/` Skill. `SKILL.md`, `references/`(kit.md 키트 자리 표시, design-library.md 디자인 서재, designs/ 견본 셋: neo-teach·picture-heart·data-pulse), `scripts/`(lecpage.mjs CLI, studio.mjs lecpage 커넥트 다리(파일 lecpage-connect.cmd/.sh, 예전 이름 lecpage-studio.*는 별칭), studio-siwc.mjs ChatGPT 로그인), `engine/`(src/kit 조립·검수, runtime/ 참가자·강사·발표 화면 JS).
- `hosting/` 바로 배포. 런타임 JS를 바꾸면 **먼저** `node hosting/scripts/gen-runtime.mjs --keep` → `hosting/runtime-history.json`에 바뀌는 조각만 남기고 note는 원문 유지.
- 문서: `docs/legal/{privacy,terms}.md`, `SECURITY.md`, `README.md`, `docs/operations.md`, `docs/writing.md`(문구·용어표 4절), 조사 기록 `docs/research/`(기록이라 고치지 않음).

## 사용자(운영자)가 정한 원칙 — 어기지 말 것
1. **AI 중심, 코드는 간섭 금지.** AI에게 교재 원본 + 짧은 목적 요청(강의 진행 사이트) + 선택 참고 디자인 서재 + 배포 조건만. 단계 나누기·부품 제한·디자인 규칙·자동 고치기·코드로 교재 해석·대조는 넣지 않음(전에 넣었다가 결과가 그냥 에이전트보다 나빠져 모두 뺌).
2. **강의 사이트 = 강의 운영·참여 도구.** 교재 내용은 교재 넘기기(쪽 그림, `data-lp="deck"`)와 강사의 강의로 전해짐. 첫 쪽은 짧게, 긴 실습은 따로 쪽으로 나눌 수 있음. 사이트에는 지금 순서·출석·교재 보기·실습 안내와 복사할 원문·질문/투표/보드·자료·과제/설문, 교재 내용은 핵심 한두 줄만. 한 쪽/여러 쪽은 AI가 정함.
3. 디자인은 그냥 에이전트보다 확실히 나아야 함(기준: 화려하고 세련된 최신 기법·모션, 교재 정체성, AI 티 없음). 새 기능·문구는 **실제 AI로 A/B 실측**해 나아질 때만 남김.
4. AI 연결: **구독 계정 우선**(**lecpage 커넥트**: Windows는 받아 두 번 누르고 Mac·Linux는 터미널 한 줄 → lecpage.com과 자동 짝 → ChatGPT로 로그인(SIWC, Codex 설치 불필요)·Claude 계정(커넥트가 Claude Code를 자동 설치·브라우저 로그인)), 접힌 '다른 방법'(API 키·Codex·Skill). lecpage 앱 안에서 끝나는 길만 둠: '쓰던 AI로'(바깥 AI 창에 복사·붙여넣기)는 사용자 결정으로 뺐음. Gemini는 만들기에서 뺐음. 길(ChatGPT·Claude 계정·Codex·API 키)마다 처음 한 번 **연결 동의**(체크+[연결], 세 줄 안내; 이 브라우저에 길별로 기억, 글이 바뀌면 다시, [모든 데이터 삭제]로 지움). 정책은 보수적으로 잡지 않고 편의 우선(Claude 구독도 기본 허용).
5. 배포: 바로 배포는 가입 없이, 사이트를 지우거나 기간이 끝나면 예전 주소 전부를 안내 쪽으로 덮음. Vercel·Netlify는 첫 배포 때 계정 기본 보호(Vercel 배포 보호·Netlify 팀 로그인)를 앱이 자동으로 풂(Make public 안내 금지). ZIP은 바로 내려받음.
6. 강사가 준 교재·사진은 임의로 빼지 않음. 교재에 없는 사실은 지어내지 않음. 강사 값(live·siteUrl·joinUrl·shortUrl·access·surveyUrl·privacy·keepUntil)은 강사에게서만.
7. 사용자는 앱에서 돈을 내지 않음(AI 비용은 각자 구독·키). 운영비 ≈ 0. 비밀값은 저장소·대화·로그에 남기지 않음(키는 request_credential).
8. 초보자 기준 UX: 화면마다 누를 곳 하나가 분명하게, 과한 기능 노출 없이.
9. 랜딩·문서는 강점만(한계·AI 자유도·시간 비교 같은 말 금지), 사실만. 학교 전용 말투 금지(학교·회사·기관 모두에 맞게, 학교 얘기일 때만 학교).

## 말투·용어
해요체(법률 문서는 그 문서 말투), 번역투 금지, 간결한 표준 용어(`docs/writing.md` 4절: AI로 수정·버전 기록·실행 취소·삭제·다운로드·다시 시도·중지·연결 해제·API 키 연결 …), 널리 쓰는 외래어는 억지로 번역하지 않음(세트·패턴·태그·스타일). '배포'(공개는 '공개 범위'·'결과 공개'에만), 'AI'(챗봇 아님), 'AI 에이전트'는 Claude Code·Codex 같은 것만. 랜딩 고정 문장 두 개는 글자 그대로: "누구나 만들 수 있지만, 잘 만들어 나누려면 노하우가 필요합니다" / "바쁜 강사님의 시간과 토큰을 아껴드립니다".

## 검증(합치기 전 한 번)
- `npm test`(엔진·카탈로그) · `npm run examples`(견본 조립·검수) · `npm --prefix app run build` · `node app/scripts/copy-lint.mjs`(고칠 곳 0) · `npm --prefix hosting test`
- 앱 흐름 e2e·가짜 AI: `bash scripts/verify.sh [--e2e] [--hosting]`(포트 4175·4182 — 동시에 두 개 돌리지 말 것)
- 가끔 부하 때문에 시간 초과로 실패하는 엔진 시험(리허설·'지금' 띠·따라 넘기기)은 단독으로 다시 돌려 확인
- 커밋 꼬리말: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` + 세션 줄. 코드·문서·커밋에 모델 이름 금지. main에 push 전 `git fetch && git merge origin/main`(AI 카탈로그 봇이 매일 커밋).

## 토큰 아끼기(작업 방식)
- 큰 파일은 통째로 읽지 말고 grep·부분 읽기. 그림은 꼭 볼 것만.
- 일을 나눌 때는 파일 소유를 겹치지 않게, 기계적인 일은 가벼운 모델로. 검증은 합칠 때 한 번.
- 실제 AI 실측은 이 컨테이너의 `claude -p`(lecpage 커넥트 길)로 1~2회만.
- 긴 세션이 되면 새 세션으로 옮기고 이 파일을 갱신.

## 아직 사람이 확인할 것
실제 ChatGPT 계정 로그인(SIWC), 실제 PC의 Claude 브라우저 로그인, 실제 윈도우·맥에서 lecpage 커넥트 실행·경고 창·자동 시작·스스로 새 판 바꾸기(백신이 파일을 잡을 때)·매크로 끈 채 Office·한글 교재 변환(한글 COM·맥 AppleScript 쪽 매크로 설정은 아직 못 끔), 실제 Vercel·Netlify 계정으로 참여 기능(구글 시트·Supabase) 연결 후 배포한 사이트에서 질문·투표 전송, 실제 윈도우·맥 글꼴로 본 한글(HWP) 쪽 그림, Safari·Firefox에서 PPTX·한글 쪽 그림, 휴대폰 실기기에서 랜딩·사이트 스크롤 연출. 요청문 변경(디자인 수준)은 교재 둘에서 한 번씩만 실측함.

## 다음 세션에 넘긴 일(2026-11-21, 끝나면 이 절을 지우거나 줄일 것)
런타임(`skills/lecpage/engine/runtime/`)을 바꾸면 먼저 `node hosting/scripts/gen-runtime.mjs --keep`.
1. 참가자 사이트: 참여 기능 서버에 닿지 않을 때 "참여 기능 서버에 지금 닿지 않아요…"가 위젯마다(최대 4번, 모두 role=status) 붙음 → 한 곳에만(`runtime/lecpage.js` setDown).
2. 강사 화면 로그인: 사이트 스크립트가 있으면(거의 늘) 꺼진 '이 기기에서 기억하기'와 "직접 쓴 스크립트가 있어…" 문구가 나옴 → 그때는 체크박스를 숨기고 "보안을 위해 관리자 키는 이 탭에만 둬요. 탭을 닫으면 다시 넣어 주세요."
3. 참여 기능 없이 배포한 사이트의 안내 한 줄(`data-live-off`)이 AI가 만든 카드 안에서 회색 상자로 한 번 더 감싸임 → 바탕·안쪽 여백 없이(`runtime/kit.css`).
4. 커넥트 짝 덮어쓰기: 아무 사이트나 `lecpage.com/#pair=<가짜>`로 짝을 덮어 연결을 끊을 수 있음(새는 것은 없음) → 새 짝은 `/bridge/status`가 맞을 때만 기존 짝을 바꿈(`app/src/lib/pair.js` capturePairing). [모든 데이터 삭제] 때 커넥트 토큰도 새로(`--new-token`과 같게) 바꾸는 것 검토.
5. 앱 CSP: `script-src 'unsafe-inline'`을 빌드본 인라인 스크립트 해시로, jsDelivr는 쓰는 패키지 경로로 좁히기(`app/index.html`·`public/_headers`). 미리보기 틀의 `allow-popups-to-escape-sandbox` 필요한지 검토. DOCX 미리 그리기(docx-preview, CSS를 이스케이프하지 않음)를 sandbox 틀 안으로(`app/src/lib/render-doc.js`). 커넥트 첫 화면에 `Cross-Origin-Resource-Policy: same-origin`.
6. 교재 변환 매크로: 한글(COM) 매크로 보안 설정, 맥 Office(AppleScript)로 옛 형식을 열 때 매크로 끄기(지금은 Keynote·Pages·LibreOffice를 먼저 쓰고 Office는 마지막) — 못 하면 그 길을 빼는 것 검토(`skills/lecpage/scripts/studio-convert.mjs`).
7. 커넥트 새 판 서명: 묶음에 ed25519 서명 + 공개 키를 실행 파일·`studio-update.mjs`에 박아 확인. 서명 키는 운영자가 GitHub Actions 비밀로 등록해야 함(키를 대화·저장소에 두지 말 것, 운영자에게 할 일 안내).
8. 앞서 남긴 것: 바로 배포 서버 Retry-After(운영자 수동 배포 필요), 자기 도메인 참여 기능 서버 + 바로 배포(바로 배포 CSP가 막음 → 안내 또는 허용), 커넥트를 두 번 켤 때, 받은 파일 경고(Mark-of-the-Web).
9. 경험 점검에서 미룬 것: 교재 넣기의 '교재 원본도 참가자가 내려받게'와 공개 범위의 같은 설정 중복(원칙 8: 한 곳에), 교재를 다 읽을 때 화면 밀림(CLS 0.06~0.12), 연결 동의 창의 "[만들기]·요청 글" 문구(바꾸면 모두 다시 동의하게 되니 그 영향까지 판단).
10. 예비 주소(yoorrard.github.io)에서는 커넥트가 연결되지 않음(다른 Pages와 출처 공유라 뺌). 필요하면 전용 출처로 옮기는 방법을 운영자에게 제안.
