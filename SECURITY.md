# 보안 정책 (Security policy)

## 문제를 찾았다면
- **공개 이슈에 올리지 말고** GitHub의 비공개 보안 제보를 써 주세요: 저장소 **Security → Report a vulnerability**. 이 버튼이 보이지 않으면 hello@lecpage.com으로 보내 주세요.
- 재현 방법, 영향(누가 무엇을 할 수 있게 되는지), 가능하면 고치는 방법을 적어 주세요.
- 참가자 개인정보나 실제 연수 자료는 첨부하지 마세요.
- 7일 안에 받았다는 답을 드리고, 확인되면 고친 판과 함께 알려 드려요.
- 바로 배포로 올라온 사이트가 피싱·저작권 침해 등에 쓰이면 그 사이트 아래 **신고** 링크를 눌러 주세요. 운영자가 확인해 사이트를 가리거나 지워요.

## 지원하는 판
- `main` 브랜치의 최신 판만 보안 수정을 받습니다. 웹앱은 열 때마다 최신 판이에요.
- Skill은 설치한 때의 판이 남아요. 다시 설치하거나 쓰는 도구의 플러그인·스킬 업데이트 기능으로 최신 판을 받아요.
- 강사가 이미 배포한 연수 사이트는 자동으로 바뀌지 않아요. 중요한 수정은 README와 릴리스 노트에 "다시 만들어 배포하기"로 안내합니다.

## 범위
- 포함: 웹앱(`app/`), 엔진·Skill(`skills/lecpage/`), 실시간 서버(`skills/lecpage/backends/`), 배포 설정 파일(`skills/lecpage/templates/`), 바로 배포 서버와 운영자 관리 화면(`hosting/`).
- 제외: 강사가 직접 운영하는 계정·서버 설정(예: 약한 관리자 키, 공개 저장소 선택), 제3자 서비스(Netlify·GitHub·Google·Supabase·Cloudflare) 자체의 문제.

## 설계 원칙(요약)
- 웹앱에는 로그인·광고·추적 도구가 없고, 교재는 브라우저 안에서만 읽습니다. 운영자가 바로 배포를 켠 경우에만 이름 없는 하루 합계(무슨 일인지 한 낱말)를 보내고, 설정이나 브라우저의 '추적 안 함'으로 끌 수 있어요.
- AI 키·배포 연결 코드는 기본적으로 탭 메모리에만 두고, 사용자가 고를 때만 기기에 암호화해 저장합니다.
- 생성 사이트의 사용자 입력은 모두 이스케이프하고, 링크는 `https`·`mailto`만 허용합니다. AI 답이나 남이 준 프로젝트 파일은 실시간 서버 주소·QR 대상을 바꿀 수 없습니다.
- 공개 저장소에는 비밀 값이 없어요. 운영 토큰·관리자 키·관리 화면 접근 규칙(Cloudflare Access)은 저장소 밖(Cloudflare 비밀 값·대시보드)에만 있어요. 코드가 공개돼도 안전하도록, 바로 배포 서버는 엔진이 만든 스크립트만 받고 응답 머리글(CSP)을 서버가 정해요.
- Skill은 npm 패키지를 설치하지 않아요. 엔진은 외부 의존성이 없고, 압축 라이브러리 하나(fflate)를 고정본으로 담았어요.
- 자세한 점검 기록: [docs/research/2026-11-review.md](docs/research/2026-11-review.md)

---

**Reporting:** please use GitHub private vulnerability reporting (Security → Report a vulnerability) instead of public issues. If it is unavailable, email hello@lecpage.com. We aim to acknowledge within 7 days. To report abuse of a site hosted by the instant-deploy service, use the **신고** (report) link at the bottom of that site.
