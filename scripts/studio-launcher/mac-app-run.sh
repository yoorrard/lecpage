#!/bin/sh
# lecpage Connect.app(macOS, 선택)의 실행 파일: Finder에서 두 번 누르면 Terminal 창을 열어 lecpage 커넥트를 켬
# (창이 있어야 안내가 보이고 Ctrl+C로 끌 수 있음). 앱 안의 lecpage-connect.sh를 사용자 폴더에 .command로 옮겨 Terminal로 엶.
# cp 대신 cat으로 옮겨 다운로드 격리 표시(확장 속성)를 따라가지 않게 함. Apple 이벤트를 쓰지 않아 "제어 허용"을 묻지 않음.
set -eu
LP="$HOME/Library/Application Support/lecpage"
mkdir -p "$LP"
R="$(cd "$(dirname "$0")/../Resources" && pwd)"
cat "$R/lecpage-connect.sh" > "$LP/lecpage-connect.command.new"
chmod 755 "$LP/lecpage-connect.command.new"
mv -f "$LP/lecpage-connect.command.new" "$LP/lecpage-connect.command"
exec open -a Terminal "$LP/lecpage-connect.command"
