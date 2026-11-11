# 보안 정책 (Security policy)

## 문제를 찾았다면
- **공개 이슈에 올리지 말고** GitHub의 비공개 보안 제보를 써 주세요: 저장소 **Security → Report a vulnerability**.
- 재현 방법, 영향(누가 무엇을 할 수 있게 되는지), 가능하면 고치는 방법을 적어 주세요.
- 참가자 개인정보나 실제 연수 자료는 첨부하지 마세요.
- 7일 안에 받았다는 답을 드리고, 확인되면 고친 판과 함께 알려 드려요.

## 지원하는 판
- `main` 브랜치의 최신 판만 보안 수정을 받습니다.
- 강사가 이미 올린 연수 사이트는 자동으로 바뀌지 않아요. 중요한 수정은 README와 릴리스 노트에 "다시 만들어 올리기"로 안내합니다.

## 범위
- 포함: 웹앱(`app/`), 엔진·Skill(`skills/lecpage/`), 실시간 서버(`skills/lecpage/backends/`), 배포 설정 파일(`templates/`).
- 제외: 강사가 직접 운영하는 계정·서버 설정(예: 약한 관리자 키, 공개 저장소 선택), 제3자 서비스(Netlify·GitHub·Google·Supabase·Cloudflare) 자체의 문제.

## 설계 원칙(요약)
- 웹앱은 서버·로그인·분석 도구가 없고, 교재는 브라우저 안에서만 읽습니다.
- AI 키·배포 연결 코드는 기본적으로 탭 메모리에만 두고, 사용자가 고를 때만 기기에 암호화해 저장합니다.
- 생성 사이트의 사용자 입력은 모두 이스케이프하고, 링크는 `https`·`mailto`만 허용합니다. AI 답이나 남이 준 프로젝트 파일은 실시간 서버 주소·QR 대상을 바꿀 수 없습니다.
- 자세한 점검 기록: [docs/research/2026-11-review.md](docs/research/2026-11-review.md)

---

**Reporting:** please use GitHub private vulnerability reporting (Security → Report a vulnerability) instead of public issues. We aim to acknowledge within 7 days.
