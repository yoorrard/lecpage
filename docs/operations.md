# lecpage 웹앱 운영 결정

조사 근거: [research/app-operations.md](research/app-operations.md). 기준일 2026-11-09.

## 결론: 로컬 우선 정적 PWA, 운영비 거의 0원

| 항목 | 결정 | 이유 |
|---|---|---|
| 구조 | **정적 웹앱(PWA)**. 교재 해석·사이트 조립·ZIP 만들기를 모두 브라우저에서 | 서버가 없으면 운영비·장애·개인정보 책임이 사라짐. diagrams.net·Excalidraw·Squoosh와 같은 방식 |
| 호스팅 | 지금: **GitHub Pages**(이 저장소의 Actions로 자동 배포). 권장 최종: **Cloudflare Pages + 자기 도메인**, GitHub Pages는 예비 | Cloudflare는 정적 요청 무료·무제한·상업 이용 가능. GitHub Pages는 상업 SaaS 금지 조항이 있어 비상업 무료 도구로만 |
| 로그인 | **없음** | 계정을 저장하면 운영자가 개인정보처리자가 됨. 필요한 연결(AI·GitHub·Netlify)은 사용자의 토큰을 그 자리에서만 씀 |
| 저장 | IndexedDB(프로젝트·이미지) + `.lecpage` 프로젝트 파일 내보내기/열기 + 저장 공간 보호(persist) | 다른 PC로 옮기기, 공용 PC 정리 |
| AI | 복사·붙여넣기(기본), BYOK(Gemini 무료 키 등, 브라우저→AI 회사 직접), OpenRouter PKCE, AI 없는 초안. 모델 이름은 코드에 박지 않고 사용자의 키로 목록을 불러옴 | 운영자 AI 비용 0. 구독 로그인 재사용은 약관 위반이라 구현하지 않음 |
| 배포(생성 사이트) | ZIP(항상) · GitHub Pages(토큰, 브라우저에서 Git Data API) · Netlify(토큰, zip 한 번) · 나머지는 안내 문서 | 세 곳 모두 브라우저 CORS 확인됨. Cloudflare·Supabase 관리 API는 CORS가 없어 도우미가 필요 → 안내로 대체 |
| 미리보기 | `srcdoc` + `sandbox`(allow-same-origin 없음) | 미리보기 속 스크립트가 앱 저장소(키·프로젝트)에 닿지 못함 |
| 보안 | CSP(meta), 사용자·AI 입력은 JSON 데이터로만(렌더러 이스케이프, https 링크만), 키는 탭 기억이 기본·선택 시 WebCrypto 암호화, 의존성 버전 고정·lockfile, 분석 도구·쿠키 없음 | |
| 도우미 Worker | **지금은 없음**(선택). 필요해지면 Cloudflare Worker 하나로: GitHub OAuth 코드 교환, Cloudflare·Supabase API 중계, 공용 실시간 중계(기본 꺼짐, 종단간 암호화·24시간 삭제) | 무료 등급은 한도에서 멈추고 과금되지 않음 |

## 비용
- 월 1만 명까지: 0원(정적 호스팅). 도메인을 쓰면 연 1~3만 원.
- AI·호스팅·DB는 사용자 각자의 무료 등급이나 구독을 씀.

## 운영 점검 목록
- [ ] 자기 도메인 연결(Cloudflare Pages로 옮길 때) → `app/public/_headers`가 적용됨
- [ ] 의존성 업데이트는 lockfile 기준으로, pdf.js는 보안 수정 버전 이상 유지
- [ ] 오류 보고는 하지 않음(개인정보 없는 운영). 문제는 GitHub 이슈로 받음
- [ ] 개인정보 안내 페이지(앱 #/help/privacy) 유지
