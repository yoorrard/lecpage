# 보안 정책 (Security policy)

## 문제를 찾았다면
- **공개 이슈에 올리지 말고** GitHub의 비공개 보안 제보를 써 주세요: 저장소 **Security → Report a vulnerability**. 이 버튼이 보이지 않으면 hello@lecpage.com으로 보내 주세요.
- 재현 방법, 영향(누가 무엇을 할 수 있게 되는지), 가능하면 고치는 방법을 적어 주세요.
- 참가자 개인정보나 실제 연수 자료는 첨부하지 마세요.
- 7일 안에 받았다는 답을 드리고, 확인되면 고친 판과 함께 알려 드려요.
- 바로 배포로 올라온 사이트가 피싱·저작권 침해 등에 쓰이면 그 사이트 아래 **신고** 링크를 눌러 주세요. 운영자가 확인해 사이트를 가리거나 지워요(가리면 그 사이트의 참여 기능도 함께 닫혀요).

## 지원하는 판
- `main` 브랜치의 최신 판만 보안 수정을 받습니다. 웹앱은 열 때마다 최신 판이에요.
- Skill은 설치한 때의 판이 남아요. 다시 설치하거나 쓰는 도구의 플러그인·스킬 업데이트 기능으로 최신 판을 받아요.
- 강사가 이미 배포한 연수 사이트는 자동으로 바뀌지 않아요. 중요한 수정은 README와 릴리스 노트에 "다시 만들어 배포하기"로 안내합니다.

## 범위
- 포함: 웹앱(`app/`), 엔진·Skill(`skills/lecpage/`), 실시간 서버(`skills/lecpage/backends/`), 배포 설정 파일(`skills/lecpage/templates/`), 바로 배포 서버와 운영자 관리 화면(`hosting/`).
- 제외: 강사가 직접 운영하는 계정·서버 설정(예: 약한 관리자 키, 공개 저장소 선택), 제3자 서비스(Netlify·GitHub·Google·Supabase·Cloudflare) 자체의 문제.

## 설계 원칙(요약)
- 웹앱에는 로그인·광고·추적 도구가 없고, 교재는 운영자 서버로 가지 않습니다. 쪽 그림은 브라우저에서 그리고, 교재 원본은 쓰는 분이 고른 AI(lecpage 커넥트를 쓰면 ChatGPT·Claude 계정이나 내 PC의 Codex, 키를 쓰면 Anthropic·OpenAI)로만 갑니다. 운영자가 바로 배포를 켠 경우에만 이름 없는 하루 합계(무슨 일인지 한 낱말)를 보내고, 설정이나 브라우저의 '추적 안 함'으로 끌 수 있어요.
- AI 키·배포 연결 코드는 열어 둔 탭 메모리에 두고, '이 기기에서 기억하기'(처음에 켜져 있음)를 켜 둔 것은 기기에 암호화해 저장합니다. 끄면 저장하지 않습니다.
- lecpage 키트(참여 기능 등)는 사용자 입력을 모두 이스케이프하고, 링크는 `https`·`mailto`만 허용합니다. AI가 직접 쓴 사이트 스크립트는 이 보장 밖이라, 조립·검수와 서버의 거절 규칙·CSP로 줄이고 배포 전 미리보기 확인을 안내합니다. lecpage는 AI가 쓴 코드를 스스로 고치지 않고(검수는 알리기만), 미리보기는 전용 CSP 안에서 그립니다. 사이트 스크립트가 있는 사이트의 강사 화면 관리자 키는 그 탭에만 둡니다. AI 답이나 남이 준 프로젝트 파일은 실시간 서버 주소·QR 대상을 바꿀 수 없습니다.
- 공개 저장소에는 비밀 값이 없어요. 운영 토큰·관리자 키·관리 화면 접근 규칙(Cloudflare Access)은 저장소 밖(Cloudflare 비밀 값·대시보드)에만 있어요.
- 바로 배포 서버는 AI가 직접 쓴 사이트 스크립트도 받지만, 사이트마다 출처가 갈리는 주소에서만 돌게 하고(모든 사이트가 같이 쓰는 주소에서는 엔진 스크립트만) 응답 머리글(CSP)을 서버가 정해요. 사이트가 연결할 수 있는 곳은 그 사이트와, 올린 사람이 사이트에 적어 둔 참여 기능 서버 주소(workers.dev·supabase.co·Apps Script)뿐이고, 비밀번호 칸·로그인 화면 흉내·다른 사이트로 보내는 양식·서비스 워커가 있으면 올릴 때 거절해요. 규칙 전체: [hosting/README.md](hosting/README.md) §6.
- CSP로 막을 수 없는 것이 있어요: 사이트 스크립트가 입력값을 주소에 붙여 다른 사이트로 **이동**시키는 것, 그 사이트의 참여 기능에 적어 두는 것. 이런 남용은 신고 링크로 받아 운영자가 가리거나 지우는 것으로 대응해요. 이 한계 자체는 취약점 제보 대상이 아니지만, CSP나 거절 규칙을 우회하는 방법을 찾았다면 위 방법으로 알려 주세요.
- Skill은 npm 패키지를 설치하지 않아요. 엔진은 외부 의존성이 없고, 압축 라이브러리 하나(fflate)를 고정본으로 담았어요. 담아 둔 라이브러리와 판을 고정한 배포 명령은 `skills/lecpage/engine/vendor/VENDOR.json`에 판·해시를 적고, CI가 OSV에서 알려진 취약점을 확인해요(`scripts/vendor-audit.mjs`).
- lecpage 커넥트(PC 프로그램, `lecpage studio`·`lecpage-connect.cmd`/`.sh`, 구독으로 연결, 2026-11-21): `127.0.0.1`에만 묶고, 모든 요청의 `Host`를 확인하고, `/bridge/*`는 허용한 출처(같은 출처·`https://lecpage.com`)의 정확한 `Origin`과 이 PC 사용자 폴더에 둔 짝 맞춤 토큰(머리글로만)이 맞을 때만 받아요. CORS는 그 출처에만, 사설망 접근 머리글은 사전 요청에만 붙여요. ChatGPT 계정(Sign in with ChatGPT) 토큰은 PC 사용자 폴더의 파일(0600)에만 두고 브라우저·로그로 내보내지 않으며, 요청은 이 PC에서 OpenAI로 바로 가요. Claude Code·Codex의 자격 파일은 읽거나 옮기지 않고, 설치·로그인은 공식 명령을 보이는 터미널 창에서만 실행해요. 구독은 사람이 누른 요청([만들기]·[AI로 수정])으로만 쓰고 저절로 다시 부르지 않아요. 길(ChatGPT 계정·Claude 계정·Codex·API 키)마다 처음 한 번 동의를 받고(체크와 [연결]), 동의 기록은 이 브라우저에만 두며 안내 글이 바뀌면 다시 받아요. 근거: [docs/research/ai-first-2026-11.md](docs/research/ai-first-2026-11.md) 3.5절
- 자세한 점검 기록: [docs/research/2026-11-review.md](docs/research/2026-11-review.md)

---

**Reporting:** please use GitHub private vulnerability reporting (Security → Report a vulnerability) instead of public issues. If it is unavailable, email hello@lecpage.com. We aim to acknowledge within 7 days. To report abuse of a site hosted by the instant-deploy service, use the **신고** (report) link at the bottom of that site.
