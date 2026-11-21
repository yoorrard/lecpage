#!/usr/bin/env bash
# 합치기 전 검증을 한 번에. 지금 git 인덱스(스테이징한 상태)를 그대로 떠서 검사하고, 결과는 요약 줄만 찍습니다.
# 사용: bash scripts/verify.sh [--e2e] [--hosting]     (npm run verify / npm run verify:full)
#   기본: 엔진 테스트 · 예시 빌드 · 앱 빌드
#   --e2e: 앱 미리보기(4175·4182)를 띄워 앱 흐름(flow·more·share-flow·hosts·studio2·studio3·doc-render·start-dict·instant·flow2·live-hosts). tests/e2e/ 는 작업 폴더의 것을 씁니다
#   --hosting: 바로 공개 서버 테스트
# 환경변수: VERIFY_DIR(검사용 복사본 위치) · OUT_DIR(로그·스크린샷, 기본 .out/verify)
# 자세한 기록: .out/verify/log-*.txt, 스크린샷: .out/verify/shots/
set -u
R=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
O=${OUT_DIR:-$R/.out/verify}
V=${VERIFY_DIR:-$O/wt}
E2E=0; HOST=0
for a in "$@"; do [ "$a" = --e2e ] && E2E=1; [ "$a" = --hosting ] && HOST=1; done
mkdir -p "$O/shots"

rm -rf "$V" && (cd "$R" && git checkout-index -a --prefix="$V/")
# node_modules는 작업 폴더 것을 연결(worktree라 없으면 본 체크아웃 것)
M=$(cd "$R" && cd "$(git rev-parse --git-common-dir)/.." && pwd)
for d in app skills/lecpage/engine hosting; do
  for b in "$R" "$M"; do [ -d "$b/$d/node_modules" ] && { ln -s "$b/$d/node_modules" "$V/$d/node_modules"; break; }; done
done

cd "$V/skills/lecpage/engine"
npm test > "$O/log-engine.txt" 2>&1
echo "engine: $(grep -a -E "^# (pass|fail|skipped)" "$O/log-engine.txt" | tr '\n' ' ')"
grep '^not ok' "$O/log-engine.txt" | head -5
if npm run examples > "$O/log-examples.txt" 2>&1; then echo "examples: ok"; else echo "examples: FAIL"; tail -5 "$O/log-examples.txt"; fi

cd "$V/app"
if npm run build > "$O/log-build.txt" 2>&1; then echo "app build: ok"; else echo "app build: FAIL"; tail -8 "$O/log-build.txt"; fi

if [ $HOST = 1 ]; then
  cd "$V/hosting"; npm test > "$O/log-hosting.txt" 2>&1
  echo "hosting: $(grep -E '^# (pass|fail)' "$O/log-hosting.txt" | tr '\n' ' ')"; grep '^not ok' "$O/log-hosting.txt" | head -5
fi

if [ $E2E = 1 ]; then
  if ! (cd "$R/tests/e2e" && node -e "require('./pw.js')" 2>&1 | grep -q SKIP) ; then :; else
    echo "e2e: 건너뜀 (playwright 없음: npm i -g playwright 또는 NODE_PATH 지정)"; E2E=0
  fi
fi
if [ $E2E = 1 ]; then
  cd "$V/app"
  (npx vite preview --host 127.0.0.1 --port 4175 --strictPort > /dev/null 2>&1 &)
  sleep 4
  cd "$R/tests/e2e"
  for t in flow more share-flow hosts studio2 studio3 doc-render start-dict; do
    BASE=http://localhost:4175/ OUT="$O/shots/" timeout 600 node "$t.js" > "$O/log-e2e-$t.txt" 2>&1
    f=$(grep -c "^FAIL" "$O/log-e2e-$t.txt"); p=$(grep -c "^PASS" "$O/log-e2e-$t.txt")
    if [ "$f" = 0 ] && [ "$p" -gt 0 ] && ! grep -q "TimeoutError\|pageerror\|SCRIPT ERROR" "$O/log-e2e-$t.txt"; then echo "e2e $t: ok ($p pass)"; else echo "e2e $t: FAIL ($f)"; grep -m3 "^FAIL\|Error" "$O/log-e2e-$t.txt"; fi
  done
  pkill -f "vite preview --host 127.0.0.1 --port 4175"
  # 바로 배포(가짜 서버 https://publish.mock.test): 거절 문구·사이트 스크립트 안내. 그 주소로 따로 빌드
  cd "$V/app"
  if VITE_PUBLISH_API=https://publish.mock.test npx vite build --outDir dist-instant > "$O/log-build-instant.txt" 2>&1; then
    (npx vite preview --outDir dist-instant --host 127.0.0.1 --port 4182 --strictPort > /dev/null 2>&1 &)
    sleep 4; cd "$R/tests/e2e"
    BASE2=http://localhost:4182/ OUT="$O/shots/" timeout 300 node instant.js > "$O/log-e2e-instant.txt" 2>&1
    f=$(grep -c "^FAIL" "$O/log-e2e-instant.txt"); p=$(grep -c "^PASS" "$O/log-e2e-instant.txt")
    if [ "$f" = 0 ] && [ "$p" -gt 0 ] && ! grep -q "SCRIPT ERROR" "$O/log-e2e-instant.txt"; then echo "e2e instant: ok ($p pass)"; else echo "e2e instant: FAIL ($f)"; grep -m3 "^FAIL\|Error" "$O/log-e2e-instant.txt"; fi
    # 바로 배포 → 다른 곳 배포 → 대표 주소 바꾸기
    BASE2=http://localhost:4182/ BASE=http://localhost:4182/ OUT="$O/shots/" timeout 400 node flow2.js > "$O/log-e2e-flow2.txt" 2>&1
    f=$(grep -c "^FAIL" "$O/log-e2e-flow2.txt"); p=$(grep -c "^PASS" "$O/log-e2e-flow2.txt")
    if [ "$f" = 0 ] && [ "$p" -gt 0 ] && ! grep -q "SCRIPT ERROR" "$O/log-e2e-flow2.txt"; then echo "e2e flow2: ok ($p pass)"; else echo "e2e flow2: FAIL ($f)"; grep -m3 "^FAIL\|Error" "$O/log-e2e-flow2.txt"; fi
    # 참여 기능 × 배포할 곳: 다른 곳 안내, 바로 배포 방을 다른 곳 사이트에 넣지 않음, 대표 주소 지킴
    BASE2=http://localhost:4182/ BASE=http://localhost:4182/ OUT="$O/shots/" timeout 400 node live-hosts.js > "$O/log-e2e-live-hosts.txt" 2>&1
    f=$(grep -c "^FAIL" "$O/log-e2e-live-hosts.txt"); p=$(grep -c "^PASS" "$O/log-e2e-live-hosts.txt")
    if [ "$f" = 0 ] && [ "$p" -gt 0 ] && ! grep -q "SCRIPT ERROR" "$O/log-e2e-live-hosts.txt"; then echo "e2e live-hosts: ok ($p pass)"; else echo "e2e live-hosts: FAIL ($f)"; grep -m3 "^FAIL\|Error" "$O/log-e2e-live-hosts.txt"; fi
    pkill -f "vite preview --outDir dist-instant"
  else echo "app build (instant): FAIL"; fi
fi
true
