# 사이트 유형과 기능 모듈

## 1. 유형 고르기
| 유형 | 언제 | 기본 섹션 순서 |
|---|---|---|
| 스토리형 story | 특강·강의 60~120분, 메시지·사례 전달 | hero → message → steps5 → outline → schedule → deck → tools → stations → qa → board → materials → instructor → closing → survey |
| 실습형 lab | 워크숍 2~4시간, 따라 하기 | hero → readiness → outline → stations → prompts → tools → qa → board → reflection → materials → instructor → survey |
| 라이브형 live | 설명회·컨퍼런스 100~1000명 | hero → glance → schedule → speakers → qa → poll → deck → materials → faq → survey → closing |
| 과정형 course | 15·30시간 직무연수, 여러 차시 | hero → glance → sessions → readiness → stations → board → materials → attendance → faq → instructor → survey |

규칙(엔진 `decideArchetype`과 같음): 차시 3회 이상 → 과정형 / 150명 이상·컨퍼런스 → 라이브형 / 실습 비중 45% 이상·실습 중심 → 실습형 / 그 외 스토리형.
혼합: 실습형인데 90분 이상이면 앞에 스토리형 도입(message·outline), 스토리형인데 실습 20% 이상이면 stations를 넣는다.

## 2. 기능 34개와 섹션·실시간 기능
| 단계 | 기능 | 구현 | 실시간 기능 키 |
|---|---|---|---|
| 연수 전 | 안내 첫 화면 | hero | - |
| | 일정표(지금 순서 강조) | schedule | - |
| | 준비 점검 + 접속 진단 | readiness, check.html | - |
| | 사전 설문 | survey(사전) | - |
| | 참여 주소·QR | 공유 버튼, screen.html | - |
| 연수 중 | 입장(별명, 로그인 없음) | 참여 대화상자 | 모든 실시간 기능 |
| | 출석 확인(입실·퇴실) | attendance | attendance |
| | 교재 뷰어(넘김·전체 보기·검색·쪽별 도구) | deck | - |
| | 강사 쪽 따라가기 | deck + 콘솔 | (state) |
| | 실습 스테이션(단계·프롬프트 복사·완료 체크·메모) | stations | progress |
| | 막혔어요(자리 번호와 함께 도움 요청) | 도크 버튼, 스테이션 버튼 | help |
| | 실시간 질문(익명·공감·정렬) | qa | qa |
| | 참여 보드(파일 업로드) | board | board |
| | 투표·워드클라우드 | poll | poll |
| | 복습 퀴즈 | quiz | - |
| | 채팅 | (다음 판) | chat |
| | 반응(박수·좋아요) | 도크 | reactions |
| | 도구 모음·용어집·FAQ | tools, glossary, faq | - |
| 강사 콘솔 | 진행 현황판(스테이션별 완료·막힘) | console.html | progress |
| | 진행 맞추기(지금 실습·쪽 보내기) | console.html | (state) |
| | 타이머·공지 | console.html | (state) |
| | 질문·보드 관리(고정·답변 완료·숨기기) | console.html | qa, board |
| | 투표 열기·닫기·결과 | console.html, screen.html | poll |
| | 프로젝터 화면(큰 QR·질문·투표·타이머) | screen.html | - |
| | 기록 CSV·데이터 일괄 삭제 | console.html | - |
| 연수 후 | 만족도 조사 | survey | - |
| | 나의 기록 내려받기 | stations, reflection | - |
| | 자료실·이용 안내 | materials | - |
| | 참가 확인서 | (다음 판) | attendance |
| | 아카이브 전환 | live.provider를 none으로 다시 빌드 | - |
| | 후속 안내 | text, closing | - |

실시간 기능을 하나라도 쓰면 `live.provider`가 none이 아니어야 한다(6단계). 미리보기·리허설은 `local`(같은 기기 탭끼리만 동기화).
