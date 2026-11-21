#!/bin/sh
# lecpage PC 프로그램(macOS·Linux). 터미널에 한 줄:
#   curl -fsSL https://github.com/yoorrard/lecpage/releases/download/studio-latest/lecpage-studio.sh | bash
# 관리자 권한 없이 이 사용자 폴더에만 씀(macOS ~/Library/Application Support/lecpage, Linux ~/.local/share/lecpage).
# 1) Node.js 22 이상: 있으면 그대로, 없으면 nodejs.org의 LTS를 받아 SHA-256 확인 뒤 풂(처음 한 번)
# 2) lecpage PC 프로그램: GitHub 릴리스(studio-latest)의 VERSION이 바뀌었으면 받아 SHA-256 확인 뒤 바꿈(못 받으면 있던 판)
# 3) node lecpage.mjs studio(브라우저로 lecpage.com이 열림). 끄기: Ctrl+C
set -eu
BASE="${LECPAGE_RELEASE_BASE:-https://github.com/yoorrard/lecpage/releases/download/studio-latest}"
case "$(uname -s)" in
  Darwin) LP="$HOME/Library/Application Support/lecpage"; OS=darwin ;;
  Linux) LP="${XDG_DATA_HOME:-$HOME/.local/share}/lecpage"; OS=linux ;;
  *) echo "이 운영체제에서는 아직 쓸 수 없어요."; exit 1 ;;
esac
mkdir -p "$LP"
say() { printf '%s\n' "$*"; }
sha() { if command -v shasum >/dev/null 2>&1; then shasum -a 256 "$1" | cut -d' ' -f1; else sha256sum "$1" | cut -d' ' -f1; fi; }
say "lecpage PC 프로그램을 준비해요. lecpage를 쓰는 동안 이 창을 열어 두세요."

NODE=""
if command -v node >/dev/null 2>&1; then
  M=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
  if [ "$M" -ge 22 ] 2>/dev/null; then NODE=$(command -v node); fi
fi
if [ -z "$NODE" ] && [ -x "$LP/node/bin/node" ]; then NODE="$LP/node/bin/node"; fi
if [ -z "$NODE" ]; then
  say "Node.js를 받는 중이에요(처음 한 번, 약 40MB)."
  case "$(uname -m)" in arm64|aarch64) ARCH=arm64 ;; x86_64|amd64) ARCH=x64 ;; *) say "이 CPU에서는 아직 쓸 수 없어요."; exit 1 ;; esac
  VER=$(curl -fsSL https://nodejs.org/dist/index.json | tr '{' '\n' | grep '"lts":"' | sed -n 's/.*"version":"\(v[0-9.]*\)".*/\1/p' | awk -F. '{ if (substr($1,2)+0 >= 22) { print; exit } }')
  [ -n "$VER" ] || { say "Node.js 판 목록을 읽지 못했어요. 인터넷 연결을 확인해 주세요."; exit 1; }
  NAME="node-$VER-$OS-$ARCH"
  T=$(mktemp -d)
  curl -fsSL "https://nodejs.org/dist/$VER/$NAME.tar.gz" -o "$T/n.tgz"
  WANT=$(curl -fsSL "https://nodejs.org/dist/$VER/SHASUMS256.txt" | grep " $NAME.tar.gz\$" | cut -d' ' -f1)
  [ -n "$WANT" ] && [ "$WANT" = "$(sha "$T/n.tgz")" ] || { say "Node.js 파일 확인(SHA-256)에 실패했어요. 다시 실행해 주세요."; rm -rf "$T"; exit 1; }
  tar -xzf "$T/n.tgz" -C "$T"
  rm -rf "$LP/node"; mv "$T/$NAME" "$LP/node"; rm -rf "$T"
  NODE="$LP/node/bin/node"
fi

APP="$LP/studio"
HAVE=$(cat "$APP/VERSION" 2>/dev/null || true)
if LATEST=$(curl -fsSL "$BASE/VERSION" 2>/dev/null) && [ -n "$LATEST" ]; then
  if [ "$LATEST" != "$HAVE" ]; then
    say "lecpage PC 프로그램 새 판을 받는 중이에요."
    T=$(mktemp -d)
    curl -fsSL "$BASE/lecpage-studio.tar.gz" -o "$T/s.tgz"
    WANT=$(curl -fsSL "$BASE/lecpage-studio.tar.gz.sha256" | cut -d' ' -f1)
    [ "$WANT" = "$(sha "$T/s.tgz")" ] || { say "받은 파일 확인(SHA-256)에 실패했어요. 다시 실행해 주세요."; rm -rf "$T"; exit 1; }
    mkdir "$T/x"; tar -xzf "$T/s.tgz" -C "$T/x"
    rm -rf "$APP"; mv "$T/x" "$APP"; rm -rf "$T"
  fi
elif [ ! -d "$APP/skills" ]; then
  say "lecpage PC 프로그램을 받지 못했어요. 인터넷 연결을 확인하고 다시 실행해 주세요."; exit 1
else
  say "새 판을 확인하지 못해 있던 판으로 켜요."
fi
exec "$NODE" "$APP/skills/lecpage/scripts/lecpage.mjs" studio "$@"
