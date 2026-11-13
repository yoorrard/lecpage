# lecpage skill 효율 조사와 결정 (2026-11)

- 날짜: 2026-11-09. 질문: 강사가 "AI에게 HTML을 바로 쓰게 하면 되지 않나?" 대신 lecpage를 쓸 이유를 어떻게 분명히 하고, skill이 쓰는 토큰과 시간을 어떻게 줄일까.
- 출처는 맨 아래. agentskills.io는 이 작업 환경에서 열리지 않아 같은 규격의 GitHub 원문(agentskills/agentskills)을 읽었습니다.

## 1. 결론
1. **결정적인 일은 스크립트로, 판단만 AI에게.** 해석→초안→검증→빌드→점검을 `make` 한 번으로 묶었다. 첫 사이트까지 AI가 쓰는 글은 명령 한 줄.
2. **큰 JSON은 읽히지 않는다.** `make`·`brief`가 칸 id·개수·빈칸·주의만 보여 준다(수백 토큰). 교재 해석(4만 자)과 설계도(1.6만 자)는 필요할 때 일부만.
3. **고칠 때는 바뀐 곳만.** 설계도 전체를 다시 쓰지 않고 `patch`(부분 병합 형식, `--set 경로=값`)로 고친다. 엔진 `applyBlueprintPatch`라 앱 검토 대화도 같은 형식을 쓴다.
4. **보는 결정은 그림 한 장으로.** 디자인 3안을 `options`가 비교 그림 한 장(약 1.5천 이미지 토큰)으로 만든다. 예전 방식(3안 × 스크린샷 4장)의 약 1/12.
5. **SKILL.md는 목차.** 본문 66줄, 자세한 것은 `references/` 한 단계 아래. 설명(description)은 "무엇을 + 언제"를 담고 조금 적극적으로.
- 측정(같은 교재, "첫 사이트 + 작은 수정 두 곳"): AI가 읽는 글 **84,231자 → 6,892자(1/12)**, AI가 쓰는 글 **16,823자 → 99자(1/170)**. 자세히는 §6.

## 2. Agent Skills 모범 사례(Anthropic 문서)
| 원칙 | 내용 | lecpage 적용 |
|---|---|---|
| 점진적 공개 | 시작할 때는 name·description(약 100단어)만 올라오고, SKILL.md는 쓸 때, 참고 파일은 필요할 때 읽는다 | SKILL.md는 흐름·규칙·참고표만. 명령 자세히는 `references/cli.md` |
| SKILL.md 크기 | 본문 500줄 이하(규격: 지시 5천 토큰 이하 권장). 한 번 읽히면 대화 내내 남아 "모든 줄이 반복 비용" | 94줄 → 66줄, 5,814자 → 5,068자(장점 설명을 넣고도 줄임) |
| 참고는 한 단계 | 참고 파일에서 또 다른 파일로 이어지면 일부만 읽는다(`head -100`). 100줄 넘는 참고 파일은 맨 위에 목차 | 모든 참고 파일을 SKILL.md 표에서 직접 연결. `cli.md`에 목차 |
| 결정적인 일은 스크립트 | 스크립트는 내용이 아니라 출력만 토큰을 쓴다. "목록 정렬을 토큰으로 하는 것은 알고리즘보다 훨씬 비싸다". 오류는 스크립트가 처리(solve, don't punt) | 해석·초안·검증·빌드·점검·디자인 비교 모두 스크립트. 없는 도구는 그 단계만 건너뛰고 `doctor`가 설치 명령을 줌 |
| 계획-검증-실행 | 중간 파일(계획)을 만들고 스크립트로 검증한 뒤 적용. 검증 메시지는 고칠 방법까지 | 패치 → `validate` → 저장(직전 판 보관) → 빌드. 모르는 칸 id면 있는 id 목록을 알려 줌 |
| 되먹임 고리 | 검사 → 고침 → 다시 검사 | `patch --qa`, 점검 결과는 문제만 줄마다 |
| description | 3인칭, 무엇을 하는지와 언제 쓰는지, 1,024자 이하. Claude Code 목록에서는 1,536자에서 자름 | 702자. 한국어 요청 예시 + 영어 트리거. 수정·배포 요청에도 켜지게 |
| 평가 먼저 | 실제 과제 3개 이상으로 skill 없이/있이 비교 | `evals/` 6개 + 켜짐 확인 14개 |

도구 출력 설계(Anthropic "Writing tools for agents"): 간결 출력이 자세한 출력보다 약 1/3(예: 206 → 72토큰), 자주 이어지는 여러 단계는 도구 하나로, 오류 메시지는 다음 행동을 알려 주게. → 모든 명령은 기본 요약, `--json`은 기계용.

## 3. 공개 규격과 설치
- 규격(agentskills): `name` 1~64자(소문자·숫자·하이픈, 폴더 이름과 같게), `description` 1~1,024자, 선택 `license`·`compatibility`(500자 이하)·`metadata`·`allowed-tools`. 폴더는 `scripts/`·`references/`·`assets/`. 검사는 `skills-ref validate`.
- `npx skills add owner/repo`(vercel-labs/skills, Node 22.20+): 저장소 맨 위, `skills/`, `skills/.curated/` 등을 세 단계까지 찾고, 설치된 에이전트를 감지해 고르게 한다. 기본은 프로젝트, `-g`는 전역. 설치 위치: Claude Code `.claude/skills/`, Codex·Cursor·Gemini CLI·Antigravity `.agents/skills/`(전역은 도구마다 다름).
- 시사점: 에이전트마다 skill 폴더가 달라 `${CLAUDE_SKILL_DIR}` 같은 변수에 기대지 않는다. SKILL.md는 "이 SKILL.md가 있는 폴더" 기준으로 쓴다. 스크립트는 외부 패키지 없이 Node 22만으로 돌고, Playwright·LibreOffice는 있으면 쓰는 선택 도구로 둔다.

## 4. 잘 되는 skill들의 공통점
| skill | 배울 점 |
|---|---|
| anthropics/skills `frontend-design` | 흔한 기본값(같은 카드 격자, 장식 그라데이션, 모든 섹션 페이드업, 대문자 라벨)을 이름으로 금지하고, 주제에서 시각 결정을 끌어내게 함. 계획(색 4~6개·글꼴 역할)을 먼저 쓰고 스스로 상투성을 검사 |
| `pptx` | 작업 종류별 갈래(만들기·고치기·읽기)를 표로. 그림으로 바꿔 직접 보는 점검 고리("첫 결과에는 보통 문제가 있다"고 가정). 배치는 썸네일 격자 한 장으로 고름 |
| `docx` | 갈래별 도구를 고정하고(만들기 docx-js, 고치기 XML, 읽기 pandoc) 검증 스크립트(`validate.py --auto-repair`)로 마무리 |
| `skill-creator` | description은 일부러 조금 적극적으로("undertrigger" 방지). 평가는 skill 있음/없음을 같은 차례에 나란히, 켜짐 평가는 해당 8~10 + 비슷하지만 아닌 것 8~10 |
| obra/superpowers | 작고 한 가지 일만 하는 skill, "제안이 아니라 지켜야 할 흐름". description에는 언제 쓰는지만 쓰고 흐름 요약은 넣지 않음(요약만 보고 본문을 안 읽게 됨). 실패를 먼저 본 뒤 skill을 씀(RED-GREEN) |

lecpage에 옮긴 것: 디자인 상투를 엔진 프리셋·디자인 검사로 막고(frontend-design), 비교 그림 한 장(pptx 썸네일), 갈래별 고정 명령(docx), 적극적 description과 켜짐 평가(skill-creator), "설계도를 직접 다시 쓰지 않는다" 같은 짧은 강한 규칙(superpowers).

## 5. 토큰을 줄이는 방식 → 적용
| 방식 | 적용 |
|---|---|
| 한 번에 끝나는 파이프라인 | `make`: 해석·초안·검증·빌드·점검 + 요약. 인터뷰 뒤 `make -i info.json --fresh` |
| 요약(brief) 출력 | 교재: 쪽 수·일시·장소·강사·실습/프롬프트/도구와 쪽 번호·유형·글꼴·빈칸(약 900자). 설계도: 칸 id·개수·실습별 단계·빈칸·주의(약 500자) |
| 스키마 기반 부분 수정 | `patch`(meta·design 깊은 병합, 칸은 id로 얕은 병합, `add`·`order`·`null` 삭제) + `--set sections.stations.items.1.title=…`. 결과는 늘 검증, 직전 판 보관, `--undo` |
| 중간 파일 캐시 | 교재가 같으면(경로·크기·수정 시각·엔진 판) 해석과 쪽 그림을 다시 하지 않음. 고친 설계도는 다시 만들어도 지킴 |
| 기계용 출력은 따로 | 모든 명령 `--json` |
| 그림 한 장 | `options` 비교 그림(PC 첫 화면·본문·휴대폰 × 3안) |
| 출력은 문제만 | 점검은 통과면 한 줄, 문제는 화면마다 한 줄. 경로는 작업 폴더 기준 짧게 |

## 6. 측정
같은 견본 교재(workshop.pptx + pdf, 13쪽), "첫 사이트 + 장소·실습 제목 두 곳 고치기".

| | 예전 흐름 | 새 흐름 |
|---|---|---|
| AI가 읽는 글 | SKILL.md 5,814 + blueprint.md 3,819 + material.json 38,647 + draft.json 16,523 + 명령 출력 2,905 + 고치기 전 설계도 다시 읽기 16,523 = **84,231자** | SKILL.md 5,068 + make 1,153 + brief 460 + patch 211 = **6,892자** |
| AI가 쓰는 글 | 설계도 16,523 + 고치기 300 = **16,823자** | patch 명령 **99자** |
| 디자인 고르기 | 3번 빌드 + 3번 점검 + 스크린샷 12장(약 1.5천 토큰씩) | `options` 한 번, 출력 617자 + 그림 한 장(약 1.5천 토큰) |
| 걸린 시간(이 환경) | 명령 6번 + 설계도 1.6만 자 생성 | `make` 8~13초, `patch` 1초 안팎, `options` 16초 |

쓰는 글이 줄어든 효과가 가장 크다. 출력 토큰은 입력보다 비싸고 느리다.

## 7. "AI에게 HTML을 바로 쓰게 하기"와 비교
한 번의 대화로 HTML 한 장을 받는 것도 가능하다. lecpage가 그보다 낫다고 말하려면 아래를 보여 줘야 하고, 지금 보여 줄 수 있다.

| 강사가 원하는 것 | HTML 바로 쓰기 | lecpage |
|---|---|---|
| 교재 내용이 정확함 | 요약·의역이 섞이고, 프롬프트 문장이 바뀌기 쉬움 | 프롬프트·실습 단계 원문 그대로, 쪽 번호 연결, 교재 뷰어. 지어낸 값은 빈칸으로 남겨 물음 |
| 품질이 고르게 높음 | 대화마다 결과가 다름, 대비·휴대폰·어두운 화면 미확인 | 프리셋 12종 모두 대비 4.5:1 검사, 매 빌드 4화면 자동 점검, 깨진 자료 검사, 교재 글꼴 따름 |
| 연수 당일 기능 | 서버가 없어 질문·진행 체크·설문이 안 됨 | 질문·막혔어요·진행 현황·투표·보드·설문·이수 CSV, 강사 화면·발표 화면·QR 안내문. 강사 계정의 시트·Supabase·Cloudflare·학교 서버 |
| 안전 | 검색 노출, 개인정보·키 처리 미정 | 검색 제외 기본, 암호 보호(AES-GCM), 강사용 파일 분리, CSP·SRI, 별명만 수집, 교재 속 숨은 지시 차단 |
| 비용·시간 | 페이지 하나만 해도 HTML·CSS·JS를 모두 생성(이 사이트 수준이면 코드 32만 자) | 명령 한 줄, 1분 안. 고칠 때는 패치 한 줄 |
| 다시 고치기 | 매번 큰 파일을 다시 생성하거나 직접 편집 | `patch` → 바뀐 점 한 줄씩, `--undo` |

## 8. 이번 판에서 바꾼 것
- `scripts/lecpage.mjs`: `make`·`brief`·`patch`·`options`·`doctor` 추가, 모든 명령 짧은 요약 + `--json`. `qa`가 http로 열어 점검하고(암호를 주면 `#k=`로 풀어서), 깨진 자료 경로, 디자인·문구 검사 파일을 함께 돌림(없으면 건너뜀).
- `engine/src/patch.js`: `applyBlueprintPatch`·`diffSummary`(앱과 공용). 패치로는 `meta.siteUrl·joinUrl·shortUrl`, `live.url·code·anonKey`, `access`를 못 바꿈.
- 고친 문제: ① `build --assets`가 쪽 그림을 `dist/slides/`에 써서 교재 뷰어 그림이 깨지던 것(설계도는 `assets/slides/`를 가리킴), 점검은 "Failed to load resource"를 걸러 놓쳐 왔음 ② 마크다운 교재의 `<!-- -->` 주석 속 주소가 실습 링크로 사이트에 실리던 것 ③ 암호 잠금 화면이 휴대폰에서 가로로 넘치던 것.
- SKILL.md 다시 씀, `references/cli.md` 새로, `qa-checklist.md` 정리, `evals/` 추가.
- 연수 정보 → 설계도 규칙을 엔진 `intake.js`로 합침(앱 `lib/blueprint.js`와 CLI가 함께 씀). 온라인 접속 주소(`meta.joinUrl`)는 강사가 적은 `info.joinUrl`만.

## 9. 다음 후보
- 오피스 기본 테마 색(#4F81BD 등)을 기관 색으로 쓰지 않기(초안의 `design.accent`).
- 마크다운 교재의 강사 줄("강사: 이름(소속)") 감지.
- 켜짐 평가를 실제로 돌려 description을 다듬기(세 번씩, 해당/비해당 나눠).

## 10. 전 과정 비교 뒤 고친 것 (2026-11-13)
같은 교재로 6단계(디자인 3안 → 고르기·초록 → 공개 준비 → 질문·투표 → 안내물 → 연수 후 CSV)를 시켰을 때, 스킬은 출력 토큰이 절반이었지만 4·5·6단계에서 이미 있는 기능 위에 올리기 스크립트·안내물 PDF 스크립트·잠근 강사 안내 쪽을 새로 짜서 비용이 그냥 에이전트보다 11% 컸고, 만들기 단계에서도 교재와 사이트를 손으로 대조했습니다(도구 63번).
- 손 대조 대신: `make`·`patch` 요약에 `교재 반영` 한 줄(프롬프트·실습 단계·링크·질문답·교재 줄, 교재 보기는 빼고 셈, `materialCoverage`).
- 새로 짜던 것을 명령·화면으로: `publish work --live --features qa,poll`(중계·관리자 키·다시 빌드·올리기·허용 주소·확인·안내물), `handouts <주소>`(QR-안내문.pdf·강사-카드.pdf·발표화면.png), 강사 화면 도움말 칸(운영안내.md와 같은 글), 즉석 투표, 참가자 화면 [출석] 한 번, `options --mood`.
- 참여 기능 결정에 강사가 할 일 수(`TEACHER_STEPS`): skill은 Cloudflare 중계(가입·로그인 2번)가 Supabase(3번)·시트(약 20번)보다 앞.
- SKILL.md 11.3KB → 9.3KB, '이미 있는 것' 표와 '언제 무엇을 읽나' 표.
- 같은 교재·같은 요청으로 다시 돌린 어림(작업자 한 번, 토큰은 재지 않음): 만들기 2~3번(info.json·make), 1단계 2번(options·비교 그림 보기), 2단계 1~2번(patch --qa), 3단계 1~2번(decide-infra·publish --dry-run), 4단계 1~2번(publish --live --dry-run), 5단계 1~2번(handouts), 6단계 0~1번(이미 있음) → 약 10~14번. 지난 측정은 스킬 175번(만들기 63·고치기 7·6단계 105), 그냥 에이전트 117번.

## 출처
- Anthropic, Skill authoring best practices: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
- Anthropic, Equipping agents for the real world with Agent Skills: https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills
- Anthropic, Writing effective tools for agents: https://www.anthropic.com/engineering/writing-tools-for-agents
- Claude Code, Skills: https://code.claude.com/docs/en/skills
- Agent Skills 규격: https://raw.githubusercontent.com/agentskills/agentskills/main/docs/specification.mdx (agentskills.io 원문)
- vercel-labs/skills: https://github.com/vercel-labs/skills · docs/creating-skills.md · docs/agents.md
- anthropics/skills: skills/frontend-design · skills/pptx · skills/docx · skills/skill-creator (https://github.com/anthropics/skills)
- obra/superpowers: README, skills/writing-skills (https://github.com/obra/superpowers)
- JSON Merge Patch RFC 7396(패치의 meta·design 병합 규칙): https://www.rfc-editor.org/rfc/rfc7396
