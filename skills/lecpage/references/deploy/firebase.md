# Firebase Hosting에 올리기

> 구글 계정으로 `https://<프로젝트>.web.app`에 올립니다. 무료(Spark)는 **전송 월 10GB**라 슬라이드가 많은 사이트를 자주 쓰기에는 빠듯합니다.

## 언제 고르나요
- 이미 Firebase 프로젝트가 있는 개발자, **작은 사이트**(슬라이드 적음)·적은 인원.
- 고르지 말 것: 사이트 크기 × 인원 × 3 × 월 연수 횟수가 약 9GB를 넘을 때(예: 30MB × 40명 × 3 = 3.6GB → 한 달에 두 번까지), 게시판 파일 올리기를 Firebase Storage로 하려는 경우(이제 **Blaze 요금제 필수**).
- lecpage 실시간 어댑터는 Firebase를 지원하지 않습니다 → 실시간은 Supabase·Sheets·cf-relay.

## 비용과 한도 (2026-11 확인)
- Spark(무료): 호스팅 저장 10GB, 전송 **월 10GB**, 내 도메인·SSL 가능. 넘으면 짧은 유예 뒤 **다음 달 1일까지 사이트가 꺼집니다**(요금 페이지에는 아직 "360MB/일"로 적혀 있지만, 호스팅 문서는 월 단위로 설명).
- Blaze(종량): 저장 10GB까지 무료 후 GB당 $0.026, 전송 월 10GB까지 무료 후 GB당 $0.15. 카드 등록 필요.
- Cloud Storage for Firebase는 2024-09 공지 이후 Spark 프로젝트에서 쓸 수 없습니다(Blaze 필요).
- 참고: Realtime Database Spark 동시 연결 100, Firestore 읽기 5만/일·쓰기 2만/일.
- 출처(2026-11-09 확인): https://firebase.google.com/docs/hosting/usage-quotas-pricing · https://firebase.google.com/pricing · https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024

## 준비물
- 구글 계정, Node.js 20 이상(터미널 필요 — 클릭만으로는 어려움).
- `templates/deploy/firebase/firebase.json`, `.firebaserc`.
- 빌드 결과 폴더(`dist/`)만 올립니다. 강사용 파일(`dist-강사용/`)은 넣지 않습니다. 공개 범위는 빌드할 때 링크(기본)·공개·암호 중에서 고릅니다.

## 따라 하기
1. https://console.firebase.google.com → **프로젝트 추가** → 이름 입력(애널리틱스 끄기 권장) → 만들기.
2. 터미널:
```bash
mkdir lec-firebase && cd lec-firebase
cp -r ../site ./site                                   # firebase.json 의 "public": "site"
cp ../skills/lecpage/templates/deploy/firebase/firebase.json .
cp ../skills/lecpage/templates/deploy/firebase/.firebaserc .
# .firebaserc 의 {{FIREBASE_PROJECT_ID}} 를 콘솔의 프로젝트 ID로, firebase.json 의 {{…}} 치환
npx firebase-tools@latest login
npx firebase-tools@latest deploy --only hosting
# → https://<프로젝트ID>.web.app
```
3. 미리 보기 채널(임시 주소, 7일): `npx firebase-tools@latest hosting:channel:deploy preview --expires 7d`

## 확인하기
- `…/check.html` 초록. 콘솔 **Hosting → 사용량**에서 이달 전송량 확인(연수 전날).

## 되돌리기·정리
- 콘솔 **Hosting → 출시 기록** → 이전 버전 **⋮ → 롤백**.
- 사이트 내리기: `npx firebase-tools@latest hosting:disable`.
- 프로젝트 삭제: 콘솔 **프로젝트 설정 → 일반 → 프로젝트 삭제**(30일 뒤 완전 삭제).

## 연수가 끝난 뒤
- 기록용이면 그대로 두되 `live.provider: none`으로 다시 빌드. 필요 없으면 `hosting:disable` 후 프로젝트 삭제.

## 자주 막히는 곳
- 갑자기 사이트가 안 열림: 월 10GB 초과 → 다음 달 1일까지 꺼짐(Blaze로 올리면 바로 복구). 급하면 Cloudflare에 바로 올리고 주소 재안내.
- 학교 관리 구글 계정은 Firebase 사용이 막혀 있을 수 있음 ⚠️ → 개인 계정.
