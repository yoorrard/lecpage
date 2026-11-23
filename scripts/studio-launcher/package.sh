#!/bin/sh
# lecpage 커넥트 릴리스 파일 묶기. .github/workflows/studio-release.yml이 부르고, 내 컴퓨터에서도 같은 결과(올리지는 않음).
#   sh scripts/studio-launcher/package.sh [out 폴더(기본 out)]
# 만드는 것(out/):
#   lecpage-connect.cmd(Windows, CRLF) · lecpage-connect.sh / .command(macOS·Linux) ·
#   lecpage-connect.zip / .tar.gz(+ .sha256: 실행 파일이 받아 확인 후 씀) · lecpage-connect-mac.zip(+ .sha256, 선택: lecpage Connect.app) · VERSION
#   서명(.sig)은 여기서 만들지 않음: 워크플로의 서명 단계만 비밀 키를 받음(scripts/studio-launcher/signing-key.mjs sign)
#   예전 이름 lecpage-studio.{cmd,sh,command,zip,tar.gz}(+ .sha256)도 같은 내용으로(예전 링크·이미 깔린 실행 파일이 받는 이름)
# 묶음에는 skills/(시험·평가 제외)와 알림 파일, VERSION·BUILT(판 이름·묶은 때), 실행 파일(lecpage-connect.sh·lecpage-connect.cmd: 자동 시작이 부르는 복사본의 원본, 확인을 마친 묶음에서 복사)을 넣음.
set -eu
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
cd "$ROOT"
OUT="${1:-out}"
sha() { if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | cut -d' ' -f1; else shasum -a 256 "$1" | cut -d' ' -f1; fi; }

SEMVER=$(node -p "require('./skills/lecpage/engine/package.json').version")
V="$SEMVER-$(git rev-parse --short HEAD 2>/dev/null || echo local)"
rm -rf "$OUT"
mkdir -p "$OUT/pkg"
# 저장소에 있는(또는 .gitignore에 걸리지 않은) 파일만: 내 컴퓨터의 node_modules·임시 파일이 섞이지 않게
if git rev-parse --git-dir >/dev/null 2>&1; then
  git -c core.quotePath=false ls-files -co --exclude-standard -- skills | while IFS= read -r f; do [ -f "$f" ] && printf '%s\n' "$f"; done | tar -cf - -T - | tar -xf - -C "$OUT/pkg"
else
  cp -r skills "$OUT/pkg/"
fi
rm -rf "$OUT/pkg/skills/lecpage/engine/test" "$OUT/pkg/skills/lecpage/evals"
find "$OUT/pkg" -name __pycache__ -type d -prune -exec rm -rf {} +
cp LICENSE NOTICE THIRD_PARTY_NOTICES.md TRADEMARKS.md "$OUT/pkg/"
# PDF 읽기 도구(pdf.js): 커넥트가 PDF 교재를 읽어 쪽 수·글을 셀 때 씀(engine/src/ingest/pdf.js가 node_modules/pdfjs-dist를 찾음).
# 강사 PC에 설치할 것이 없게 묶음에 넣음. 앱과 같은 판(app/package.json)을 받아 app/package-lock.json의 sha512와 맞을 때만 쓰고,
# Node에서 쓰는 것만(legacy/build의 pdf.mjs·pdf.worker.mjs, 한글 CMap, 표준 글꼴, 라이선스). 그림 그리기용 선택 모듈(@napi-rs/canvas)은 넣지 않음(글 읽기에 필요 없음)
PDFJS_VER=$(node -p "require('./app/package.json').dependencies['pdfjs-dist']")
PDFJS_SRI=$(node -p "require('./app/package-lock.json').packages['node_modules/pdfjs-dist'].integrity")
mkdir -p "$OUT/pdfjs"
(cd "$OUT/pdfjs" && npm pack --silent "pdfjs-dist@$PDFJS_VER" > /dev/null)
TGZ=$(ls "$OUT/pdfjs"/pdfjs-dist-*.tgz)
GOT="sha512-$(node -e "process.stdout.write(require('crypto').createHash('sha512').update(require('fs').readFileSync(process.argv[1])).digest('base64'))" "$TGZ")"
if [ "$GOT" != "$PDFJS_SRI" ]; then echo "pdfjs-dist $PDFJS_VER 확인(sha512)에 실패했어요" >&2; exit 1; fi
tar -xzf "$TGZ" -C "$OUT/pdfjs"
P="$OUT/pkg/node_modules/pdfjs-dist"
mkdir -p "$P/legacy/build"
cp "$OUT/pdfjs/package/package.json" "$OUT/pdfjs/package/LICENSE" "$P/"
cp "$OUT/pdfjs/package/legacy/build/pdf.mjs" "$OUT/pdfjs/package/legacy/build/pdf.worker.mjs" "$P/legacy/build/"
cp -r "$OUT/pdfjs/package/cmaps" "$OUT/pdfjs/package/standard_fonts" "$P/"
rm -rf "$OUT/pdfjs"
# 실행 파일: Windows 배치 파일은 CRLF, macOS·Linux는 그대로(실행 비트)
sed 's/\r$//; s/$/\r/' scripts/studio-launcher/lecpage-connect.cmd > "$OUT/lecpage-connect.cmd"
cp "$OUT/lecpage-connect.cmd" "$OUT/pkg/lecpage-connect.cmd"
cp scripts/studio-launcher/lecpage-connect.sh "$OUT/pkg/lecpage-connect.sh"
chmod 755 "$OUT/pkg/lecpage-connect.sh"
printf '%s\n' "$V" > "$OUT/pkg/VERSION"
# 묶은 때(1970년부터 센 초): 받은 묶음이 있던 것보다 예전 것(서명한 예전 묶음을 다시 내놓음)이면 실행 파일·커넥트가 바꾸지 않음.
# 묶음 안에 있어 SHA-256·서명에 함께 들어감. 판 이름(VERSION)은 같은 semver에 커밋 줄임말만 달라 앞뒤를 가릴 수 없어서 따로 둠
date -u +%s > "$OUT/pkg/BUILT"
printf '%s\n' "$V" > "$OUT/VERSION"
(cd "$OUT/pkg" && zip -qr ../lecpage-connect.zip . && tar -czf ../lecpage-connect.tar.gz .)

cp scripts/studio-launcher/lecpage-connect.sh "$OUT/lecpage-connect.sh"
cp scripts/studio-launcher/lecpage-connect.sh "$OUT/lecpage-connect.command"
chmod 755 "$OUT/lecpage-connect.sh" "$OUT/lecpage-connect.command"

# macOS 앱(선택, 서명 없음): 두 번 누르면 Terminal 창에서 lecpage-connect.sh를 켬. zip이 실행 비트를 지켜 줌
APPC="$OUT/mac/lecpage Connect.app/Contents"
mkdir -p "$APPC/MacOS" "$APPC/Resources"
cp scripts/studio-launcher/mac-app-run.sh "$APPC/MacOS/lecpage-connect"
cp scripts/studio-launcher/lecpage-connect.sh "$APPC/Resources/lecpage-connect.sh"
chmod 755 "$APPC/MacOS/lecpage-connect" "$APPC/Resources/lecpage-connect.sh"
cat > "$APPC/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key><string>lecpage-connect</string>
  <key>CFBundleIdentifier</key><string>com.lecpage.connect.app</string>
  <key>CFBundleName</key><string>lecpage Connect</string>
  <key>CFBundleDisplayName</key><string>lecpage Connect</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>$SEMVER</string>
  <key>CFBundleVersion</key><string>$SEMVER</string>
  <key>LSMinimumSystemVersion</key><string>11.0</string>
  <key>LSUIElement</key><true/>
</dict>
</plist>
EOF
(cd "$OUT/mac" && zip -qry ../lecpage-connect-mac.zip "lecpage Connect.app")

# 예전 이름도 같은 내용으로
for x in cmd sh command zip tar.gz; do cp -p "$OUT/lecpage-connect.$x" "$OUT/lecpage-studio.$x"; done
for f in lecpage-connect.zip lecpage-connect.tar.gz lecpage-connect-mac.zip lecpage-studio.zip lecpage-studio.tar.gz; do
  sha "$OUT/$f" > "$OUT/$f.sha256"
done
rm -rf "$OUT/pkg" "$OUT/mac"
ls -la "$OUT"
