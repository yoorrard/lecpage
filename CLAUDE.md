# lecpage — 작업 메모(새 세션이 먼저 읽음)

강사가 교재(PDF·PPT·HWP·워드)를 넣으면 AI가 **강의 당일 참가자가 휴대폰에 열어 두고 쓰는 강의 사이트**를 만들고, lecpage가 참여 기능·강사/발표 화면·QR·배포를 더하는 도구. 앱 https://lecpage.com(로컬 우선 Vite+Preact), Skill(`skills/lecpage/`), 바로 배포 서버(`hosting/`, Cloudflare Worker).

## 구조(어디를 고치나)
- `app/` 앱. 만들기 흐름 `src/lib/gen/`(job.js 실행·이어 받기, prompts.js 요청문, providers/ 회사별), 연결 `src/lib/connection.js`·`components/AiPick.jsx`, 미리보기 `components/Preview.jsx`, 랜딩 `src/landing/`, 도움말 `pages/Help.jsx`, 먼저 해보기 `src/data/demo/`.
- `skills/lecpage/` Skill. `SKILL.md`, `references/`(kit.md 키트 자리 표시, design-library.md 디자인 서재, designs/ 견본 셋: neo-teach·picture-heart·data-pulse), `scripts/`(lecpage.mjs CLI, studio.mjs lecpage 커넥트 다리(파일 lecpage-connect.cmd/.sh, 예전 이름 lecpage-studio.*는 별칭), studio-siwc.mjs ChatGPT 로그인), `engine/`(src/kit 조립·검수, runtime/ 참가자·강사·발표 화면 JS).
- 예비 주소 https://lecpage.github.io: 조직 저장소 `lecpage/lecpage.github.io`의 `mirror.yml`이 2시간마다 이 저장소 main을 빌드해 Pages로(`mirror.txt`에 올린 판). Claude GitHub 앱이 그 조직에도 있음. 그 조직에 다른 Pages 사이트를 만들지 말 것(커넥트가 그 출처를 믿음).
- 배포하기 화면(`components/Publish.jsx`·`lib/deploy.js`): 바로 배포는 실패해도 만든 사이트를 다시 씀(`instantTries`, 실패마다 하루 몫을 쓰지 않게), 실패는 화면에 까닭·[다시 배포]로 남김, 못 쓸 때는 흐린 카드에 까닭. [배포 취소]는 `Undeploy`(바로 배포 삭제·Vercel 프로젝트 삭제·Netlify 사이트 삭제·GitHub Pages 끄기·직접 배포한 곳은 목록에서만).
- `hosting/` 바로 배포. 런타임 JS를 바꾸면 **먼저** `node hosting/scripts/gen-runtime.mjs --keep`(note는 스크립트가 그대로 둠) → 다 바꾼 뒤 `runtime-history.json`에서 지금 판과 같은 조각(안 바뀐 것)은 지우고 note에 날짜·바뀐 파일을 한 줄.
- 참가자 화면 바닥 부품: 'Made with Lecpage' 표시는 조립이 참가자 쪽 `.lpk-chrome` 맨 앞에 넣음(`kit/widgets.js` madeWith, `runtime/lecpage.js` initMade, `kit.css` .lpk-made). AI 요청문에는 넣지 않음.
- 문서: `docs/legal/{privacy,terms}.md`, `SECURITY.md`, `README.md`, `docs/operations.md`, `docs/writing.md`(문구·용어표 4절), 조사 기록 `docs/research/`(기록이라 고치지 않음).

## 사용자(운영자)가 정한 원칙 — 어기지 말 것
1. **AI 중심, 코드는 간섭 금지.** AI에게 교재 원본 + 짧은 목적 요청(강의 진행 사이트) + 선택 참고 디자인 서재 + 배포 조건만. 단계 나누기·부품 제한·디자인 규칙·자동 고치기·코드로 교재 해석·대조는 넣지 않음(전에 넣었다가 결과가 그냥 에이전트보다 나빠져 모두 뺌).
2. **강의 사이트 = 강의 운영·참여 도구.** 교재 내용은 교재 슬라이드(쪽 그림, `data-lp="deck"`. 화면 이름은 2026-11-23부터 '교재 슬라이드', AI 요청문 안의 '교재 넘기기'는 그대로 — 바꾸려면 원칙 3대로 실측)와 강사의 강의로 전해짐. 첫 쪽은 짧게, 긴 실습은 따로 쪽으로 나눌 수 있음. 사이트에는 지금 순서·출석·교재 보기·실습 안내와 복사할 원문·질문/투표/보드·자료·과제/설문, 교재 내용은 핵심 한두 줄만. 한 쪽/여러 쪽은 AI가 정함.
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
- 새 컨테이너: `npm --prefix app ci && npm --prefix hosting ci`, PDF 시험은 CI처럼 맨 위에 `npm install --no-save pdfjs-dist@<app 판>`(없으면 PDF 시험 3개가 실패). CPU 4개면 Workflow는 에이전트를 2개씩만 돌림 → 많이 나눌 때는 Agent 도구로 동시에
- 커밋 꼬리말: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` + 세션 줄. 코드·문서·커밋에 모델 이름 금지. main에 push 전 `git fetch && git merge origin/main`(AI 카탈로그 봇이 매일 커밋).

## 토큰 아끼기(작업 방식)
- 큰 파일은 통째로 읽지 말고 grep·부분 읽기. 그림은 꼭 볼 것만.
- 일을 나눌 때는 파일 소유를 겹치지 않게, 기계적인 일은 가벼운 모델로. 검증은 합칠 때 한 번.
- 실제 AI 실측은 이 컨테이너의 `claude -p`(lecpage 커넥트 길)로 1~2회만.
- 긴 세션이 되면 새 세션으로 옮기고 이 파일을 갱신.

## 아직 사람이 확인할 것
실제 ChatGPT 계정 로그인(SIWC), 실제 PC의 Claude 브라우저 로그인, 실제 윈도우·맥에서 lecpage 커넥트 실행·경고 창·자동 시작(로그인 때 보안 경고가 없는지)·두 번 켜기·스스로 새 판 바꾸기(백신이 파일을 잡을 때)·서명 확인(테스트 키로: 맞는 .sig 설치, 없거나 틀리면 거절, PowerShell 5.1에서 node 검사 인자)·교재 변환(한글: 보통 파일·스크립트 매크로 파일(건너뛰고 앱 그리기)·배포용·암호 파일, 맥: .pptx·.docx는 Office, .ppt·.doc은 Keynote·Pages·LibreOffice), Chrome 로컬 네트워크 권한이 뜬 채 `--new-token` 뒤 다시 짝, 자기 도메인 참여 기능 서버 + 바로 배포 사이트, Safari·Firefox에서 DOCX(sandbox 틀) 그림, 실제 휴대폰(노치·카카오톡 안 브라우저)에서 'Made with Lecpage' 표시·좁은 화면 '지금' 띠, 실제 Chrome의 파일 고르기·끌어 놓기 때 교재 넣기 화면 밀림, axe 접근성 검사, 실제 Vercel·GitHub Pages 계정으로 [배포 취소](Netlify 삭제 API와 바로 배포는 실제로 확인함), AI 요청문의 '교재 넘기기'를 '교재 슬라이드'로 바꿀지 실측, 실제 Vercel·Netlify 계정으로 참여 기능(구글 시트·Supabase) 연결 후 배포한 사이트에서 질문·투표 전송, 실제 윈도우·맥 글꼴로 본 한글(HWP) 쪽 그림, Safari·Firefox에서 PPTX·한글 쪽 그림, 휴대폰 실기기에서 랜딩·사이트 스크롤 연출. 요청문 변경(디자인 수준)은 교재 둘에서 한 번씩만 실측함.

## 다음 세션에 넘긴 일(2026-11-23, 끝나면 이 절을 지우거나 줄일 것)
2026-11-23 배포 상태: main에 올린 것까지 CI·바로 배포 서버 새 판 확인. 실제 서버에서 확인함: 큰 파일(520KB~18MB)·쪽 그림 120장 사이트 배포, lecpage.com에서 바로 배포 → 열림 → 배포 취소(내림 안내) → 다시 배포.
2026-11-23에 고친 큰 문제(다시 생기지 않게 시험 있음): ① 바로 배포가 512KB 넘는 파일·쪽이 많은 사이트에서 끝나지 않던 것(Pages에 올린 뒤 upsert-hashes로 등록하지 않음. `hosting/src/site.js` uploadPages, 가짜 Cloudflare `test/fake-cf.mjs`도 실제처럼 '등록한 열쇠만 있음'으로) ② 커넥트 묶음에 PDF 읽기 도구가 없던 것(`package.sh`가 pdf.js를 넣고 릴리스가 묶음만으로 PDF를 읽는지 확인) ③ 커넥트 서명 공개 키를 넣자 시험이 깨지던 것.
**할 순서**: ① 1 전문가 점검 이어서 ② 2의 나머지(④~⑩) ③ 3 CSP 해시 ④ 4 남은 위험. 고칠 때마다 그 영역 시험을 더하고, 합치기 전 `bash scripts/verify.sh --e2e --hosting` 한 번. (출석·이수: 구글 시트·Supabase는 아직 날짜별 값 `days`를 저장하지 않아 여러 날에 걸친 사람은 '확인 필요' → `backends/apps-script`·`backends/supabase`의 출석 저장에 days를 더하면 됨)
바로 배포 수용량(운영자 질문, 2026-11-23): 기기당 하루 새 사이트 10개(다시 배포는 세지 않음), 전체 하루 새 사이트 200·방 100(Pages 보기 기본). 사이트는 Pages 정적이라 방문이 많아도 0원. 한도는 참여 기능(Worker 요청 하루 10만)이고, 차면 사이트는 그대로 받고 참여 기능만 강사 계정으로 넘김. 더 받으려면 Workers Paid 월 $5 + `PLAN: "paid"`(hosting/README 4절, 운영자가 구독한 뒤에 바꿀 것): 월 활성 강사 1,000명 약 $7~9, 1만 명 약 $43~107(`node hosting/scripts/capacity-model.mjs`).
1. **전문가 그룹 정밀 실측 점검 이어서**(토큰이 모자라 치명만 보고 멈춤). 9개 시점: 초보 강사(학교·회사·기관)·참가자(휴대폰)·HRD 담당자·디자이너·프런트엔드·백엔드·접근성·보안·UX 라이터. 읽기만 하는 점검 에이전트에게 빌드본(`.out/review-app`, 바로 배포 가짜 `VITE_PUBLISH_API=https://publish.mock.test` 빌드, `.out/<견본>/dist`)·node-server 참여 서버·`tests/e2e/lib.js` 가짜 AI를 주고 1280·390 × 밝게·어둡게로 실측, 포트 범위를 나눠 주고 JSON(제목·심각도·파일:줄·증거·고칠 방법)으로 받음. 이번에 못 본 곳: 앱 전체 화면(디자이너·접근성), 앱 대화상자 초점, 참가자 설문·보드 사진·자료 받기·교재 슬라이드·가로 화면·카카오톡·429 안내, Settings 모든 데이터 삭제·내 연수 복제/삭제, 브라우저 뒤로 가기, Vercel·Netlify 토큰 뒤, hosting sitecheck·rewrite·notice·tally·capacity·pages-site, studio.mjs runJob·studio-siwc, Skill CLI(Windows 경로·인코딩), Supabase·시트 제공자, 서명 경로·변환 POST 보안.
2. 점검에서 찾았지만 미룬 것(확인된 것): ①②③ (고침) ④ 휴대폰에서 'Made with Lecpage' 줄이 꽉 찬 바닥글 아래 바탕색 띠로 보임 ⑤ 강사 화면 320px 가로 넘침(377px), 강사 화면 다크 모드가 안 바뀜 ⑥ 문구: Help '이 주소에 이어서 배포'(실제 '같은 주소로 배포')·자동 시작은 맥·리눅스도 됨·'받기'→'다운로드'·'새 판'과 '새 버전' 섞임·'실시간 서버'→'참여 기능 서버'·운영안내.md 합니다체 섞임·privacy.html '[데이터 모두 지우기]'(실제 [모든 데이터 삭제])·개인정보 안내 8절에 설문 답이 이 기기에 남는 것 ⑦ 바로 배포 카드 '참여 기능까지 바로 켜져요'(/api/info에 live가 없어도), '학교·기관 망' 같은 학교·기관만의 말(Publish.jsx 574, deploy.js) ⑧ 방 요청 한도를 빈·긴 X-Lec-Admin 머리글로 비켜 감(Room.fetch) ⑨ [모든 데이터 삭제]가 IndexedDB `lecpage-gen`을 지우지 않고 도는 작업을 멈추지 않음(확인 안 함) ⑩ sitecheck COOKIE_JS를 `document['coo'+'kie']`로 비켜 감(Pages 보기 쿠키), 커넥트가 배포판에서도 localhost:5173·4173 출처를 믿음.
3. 앱 CSP `script-src 'unsafe-inline'` → 해시: 미리보기 srcdoc 틀(`Preview.jsx`·`lib/gen/render-check.js`·GalleryDict)을 sandbox URL 틀(`public/frame.html`, 자체 CSP, postMessage로 HTML 받아 씀, `self.origin === 'null'`일 때만)로 옮긴 뒤 빌드 플러그인으로 남은 인라인(homeOnlyPreload) 해시. PPTX 그리기도 sandbox 틀로 옮길 수 있음(echarts 때문에 묶음이 큼).
4. 남은 위험(작음): 실행 파일이 켜진 커넥트가 있어도 묶음 폴더를 갈아 끼움(실행 파일이 먼저 켜진 커넥트를 살피게), 앱 `findPc`가 6600~6609에 토큰을 바로 보냄(두 단계로), 암호 HWP에 Scripts가 없으면 한글이 4분 기다림(`suspendpassword:true` 실측), 서명한 예전 판으로 내리는 것은 막지 않음.
6. 커넥트 교재 형식 점검(2026-11-23)에서 남긴 것: ① 앱이 쪽 그림을 교재 하나만 그림(`Start.jsx`·`gen/material.js`) → 교재가 여럿이면 나머지 PPTX·DOCX·HWP는 구독 계정 길에서 글자만 감(교재마다 쪽 그림을 그리게 — 가장 큰 구조 과제) ② API 키·ChatGPT 길은 PDF에 걸린 링크 주소를 AI에 주지 않음(커넥트 길은 `work/links.md`) ③ 20MB 넘는 PDF·숨긴 슬라이드 PPTX·교재 둘의 `pageImages` 표시를 실제 PC에서 확인 ④ `fitFiles`가 120MB를 넘으면 같은 이름 PDF가 있는 원본을 말없이 뺌(발표자 노트를 잃음) ⑤ Skill CLI가 LibreOffice로 그린 DOCX·HWPX 쪽 그림을 버림(`ingest/cli.js`).
5. 운영자 일: 모두 끝(2026-11-22 확인). 커넥트 서명 키(공개 키 `fXeJ…85o`, 비밀 `CONNECT_SIGNING_KEY`, studio-latest 묶음 셋 서명 맞음), 예비 주소 https://lecpage.github.io (열림·mirror 성공·바로 배포 CORS 허용), 조직에 Claude GitHub 앱 설치. 키를 바꿀 때는 docs/operations.md 15절.
