<p align="center"><img src="app/public/favicon.svg" width="96" alt=""></p>

# lecpage

**교재를 넣으면 연수 사이트가 나와요.** 연수 교재(PPT·PDF·한글 HWPX·워드)와 연수 정보로, 그 연수에 맞는 디자인·모션·실습 안내·실시간 참여 기능·서버 운영 방식까지 갖춘 연수 사이트를 만들어 주는 도구입니다.

- **웹앱**: 회원가입 없이 브라우저에서. 교재와 AI 키는 브라우저 밖으로 나가지 않아요.
- **Agent Skill**: Claude Code·Codex·Cursor·Gemini CLI·Antigravity 등 내가 쓰는 AI 도구 안에서 구독 그대로.

```bash
npx skills add yoorrard/lecpage
```

## 무엇을 만들어 주나요
| | |
|---|---|
| 사이트 유형 4가지 | 스토리형(특강) · 실습형(워크숍) · 라이브형(설명회·컨퍼런스) · 과정형(여러 차시 직무연수) |
| 섹션 28종 | 첫 화면, 핵심 메시지, 오늘의 차례, 일정(지금 순서 강조), 준비 점검+접속 진단, 교재 뷰어(넘김·전체 보기·검색·쪽별 도구), 실습 스테이션(단계·프롬프트 복사·완료 체크·메모), 도구 모음, 실시간 질문, 참여 보드, 투표·워드클라우드, 퀴즈, 자료실, 강사 소개, 만족도 조사(QR), 마무리 등 |
| 강사용 화면 | 강사 콘솔(진행 현황·막힌 사람·질문 관리·공지·타이머·강사 따라가기·CSV·일괄 삭제), 프로젝터 화면(큰 QR·질문·투표 결과), 접속 진단 |
| 디자인 | 무드 프리셋 12종 × 효과 52가지(글자 등장, 스크롤 글 차오름, 톤 여정, 원근 격자, 오로라, 칠판, 리소 망점 …). 연수 주제·분위기·기기·네트워크에 맞춰 자동으로 고르고, 시그니처 효과는 하나만 |
| 운영 | 인원·기능·기간·숙련도로 호스팅 × 실시간 백엔드 결정: 정적 / Google Sheets / Supabase / Cloudflare / 자체 서버(Docker) / 인터넷 없는 교실(강사 노트북) |
| 배포 | ZIP, GitHub Pages·Netlify 원클릭, Cloudflare·Vercel·Firebase·AWS·학교 서버·NAS·USB 안내 18가지 |

## 저장소 구조
```
skills/lecpage/        Agent Skill (자체 완결: SKILL.md, references, engine, scripts, backends, templates, examples)
  engine/src/          설계도 검증·결정 규칙·디자인 토큰·렌더러·교재 해석·AI 프롬프트 (브라우저+Node 공용)
  engine/runtime/      생성 사이트에 들어가는 런타임(효과 fx/, 실시간 live/, 콘솔·프로젝터)
  backends/            supabase · apps-script · cloudflare · node-server
app/                   웹앱 (Vite + Preact, 정적 배포)
docs/                  기획서, 아키텍처 계약, 운영 결정, 조사 자료
```

## 개발
```bash
npm test                       # 엔진 테스트
npm run examples               # 견본 사이트 2개 빌드(.out/)
npm --prefix app install
npm run app:dev                # 웹앱 개발 서버
node skills/lecpage/scripts/lecpage.mjs build skills/lecpage/examples/sel-story.blueprint.json -o dist
node skills/lecpage/scripts/lecpage.mjs qa dist
```

## 문서
- [기획서](docs/plan.md) · [아키텍처와 계약](docs/architecture.md) · [웹앱 운영 결정](docs/operations.md)
- 조사: [앱 운영 방식](docs/research/app-operations.md) · [호스팅](docs/research/hosting.md) · [모션·그래픽](docs/research/motion-graphics.md) · [참여 플랫폼](docs/research/platforms.md)

## 라이선스
MIT. 함께 쓰는 라이브러리·글꼴은 각자의 라이선스(MIT·OFL 등)를 따릅니다. GSAP는 Standard "no charge" License로 선택 효과에서만 지연 로드합니다.
