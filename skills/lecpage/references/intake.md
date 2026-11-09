# 빈칸 인터뷰 질문

교재와 대화에서 이미 알아낸 항목은 묻지 않는다. 남은 것만 **최대 10개**, 고르기형으로 묻는다(선택지 + "직접 입력").
첫 메시지에서 교재에서 알아낸 것을 한 줄로 요약해 신뢰를 준다. 예: "교재 86쪽을 읽었어요. Gemini 실습 7개, 프롬프트 23개가 있어 실습형+스토리형으로 잡았어요. 네 가지만 확인할게요."

질문 순서(중요도 순). 답은 `work/info.json`에 아래 키로 저장한다.

| # | 질문 | 선택지 | info 키 | 정해지는 것 |
|---|---|---|---|---|
| 1 | 참가 인원은? | 30명 이하 / 31~100명 / 101~300명 / 300명 넘음 | `size` (대표값 25/60/200/500) | 운영 단계, 사이트 유형 |
| 2 | 연수 형식은? | 강의 중심 / 실습 중심 / 강의+실습 / 설명회·컨퍼런스 / 여러 차시 과정 | `format`: lecture·practice·workshop·conference·course | 사이트 유형 |
| 3 | 꼭 필요한 참여 기능(여러 개) | 실시간 질문 / 막혔어요·진행 현황 / 결과물 공유 보드 / 투표·워드클라우드 / 출석·이수 확인 / 채팅 / 필요 없음 | `features`: qa, help+progress, board, poll, attendance, chat | 모듈, 운영 단계 |
| 4 | 참가자는 주로 무엇으로 접속하나요? | 개인 노트북 / 학교 크롬북 / 태블릿 / 휴대폰만 / 섞여 있음 | `devices` | 휴대폰 우선, 모션 상한 |
| 5 | 연수 장소 인터넷은? | 잘 됨 / 느림 / 학교망이라 막히는 곳이 있음 / 인터넷 없음 | `network`: good·slow·restricted·offline | 접속 진단, 교실 서버(LAN) |
| 6 | 사이트 분위기는? | 차분하고 따뜻하게 / 밝고 경쾌하게 / 미래적·테크 / 공식적·단정하게 / 감성적·울림 / 손그림·아날로그 / 직접 입력 | `mood` (낱말 그대로) | 프리셋 |
| 7 | 움직임은 어느 정도? | 차분하게 / 보통 / 화려하게 | `motion`: 1·2·3 | 모션 단계 |
| 8 | 기관 색이나 로고가 있나요? | 없음 / 색만(예: #12306b) / 로고 파일 있음 | `accent`, `logo` | 강조색 |
| 9 | 사이트 관리 숙련도는? | 클릭만 할게요 / 설정값 붙여넣기 정도 / 코드도 고칠 수 있어요 | `skill`: click·set·dev | 배포 방식 |
| 10 | 이미 가진 서버·계정이 있나요?(여러 개) | 없음 / GitHub / Cloudflare / Supabase / 구글 계정 / AWS / 학교·기관 서버 / NAS | `infra` | 호스팅·백엔드 |

상황에 따라 추가로(10개 한도 안에서 바꿔 묻기)
- 대상이 학생(만 14세 미만)인가? → `minor: true` (별명만 받기, 업로드 제한)
- 교육청 승인 직무연수인가? → `admin: official` (출석 2회·이수율·출석부)
- 사이트 유지 기간? 당일 / 한 달 / 여러 주 → `duration`: day·month·long
- 강사료가 있는 유료 연수인가? → `commercial: true` (Vercel 무료 회피)
- 교재 내려받기를 허용할까? → deck.download, materials
- 만족도 조사 주소(구글 설문 등)가 있나? → survey.url

기본값(사용자가 "알아서"라고 할 때): size 30, format workshop, features [qa, help, progress], devices [laptop], network good, mood 교재 주제에서 추론, motion 2, skill click, infra [], duration day.

info.json 예시
```json
{ "size": 28, "format": "workshop", "features": ["qa", "help", "progress", "board"], "devices": ["laptop", "chromebook"],
  "network": "good", "mood": ["밝고 경쾌하게"], "motion": 2, "accent": "", "skill": "set", "infra": ["github"], "duration": "day" }
```
