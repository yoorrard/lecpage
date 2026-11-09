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

## 2. 기능 35개와 섹션·실시간 기능
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
| | 신호등(이해했어요·조금 헷갈려요·도와주세요) | 도크, 콘솔 집계·경보 | signal |
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

### 2.1 참가자·강사 화면에 덧붙은 것(2026-11)
- 휴대폰(600px 아래): 메뉴 대신 **목차** 버튼(아래에서 올라오는 시트), 위쪽 **'지금' 줄**(열린 투표·공지·타이머·강사가 보는 실습/쪽과 버튼 하나), 막혔어요는 자리를 묻는 작은 시트로(자리는 기기에 기억). 데스크톱 메뉴는 6개까지 보이고 나머지는 '더보기'.
- 콘솔: 켜진 기능의 패널만, 맨 위 '지금' 띠(참여자·도움 요청·도와주세요 %·열린 투표), **기록 내려받기** 한 메뉴(참여자·출석·**이수 확인**·실습 진행·질문·보드 글·도움 요청·투표 응답·설문), 투표 **결과 공개/숨기기**(참가자는 공개 뒤에만 결과를 봄), **신호 초기화**, 워드클라우드 **단어 숨기기**.
- 이수 확인 CSV(`completion`): 별명·이름·소속·입실·퇴실·머문 시간(분, 연수 시간 안만)·실습 완료(n / 전체)·설문 제출·이수(O·X·확인 필요). 기준은 `meta.admin.completionRate`%와 설문 문항이 있으면 설문 제출. 입실·퇴실 기록이 없으면 '확인 필요'. 개인 번호는 담지 않음.
- 프로젝터(`screen.html`)의 **도구**: 이름 뽑기(모두 뽑힐 때까지 중복 없음, 참가자 별명 불러오기), 모둠 무작위 나누기, 타이머 여러 개. 실시간 연결 없이도 동작.
- `poster.html`: A4 한 장 QR 안내문(제목·일시·장소·큰 QR·주소·참여 코드·Wi-Fi 적는 줄) + 따로 인쇄되는 '강사만' 카드(콘솔·프로젝터·진단 주소).
- 새 상태 값은 서버가 모르는 키를 버리므로 `state.ui`에 둡니다: `ui.reveal`('투표id|…'), `ui.signalReset`(ms), `ui.hiddenWords`('낱말|…'), `ui.timers`(JSON 문자열). 워드클라우드는 NFC·소문자·조사 하나(은는이가을를의에도요) 떼기·합치기·금지어 빼기를 거칩니다.
