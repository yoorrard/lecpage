#!/bin/sh
# lecpage 커넥트(macOS·Linux): lecpage.com과 이 PC를 이어 ChatGPT·Claude 계정으로 만들게 하는 프로그램. 터미널에 한 줄:
#   curl -fsSL https://github.com/yoorrard/lecpage/releases/download/studio-latest/lecpage-connect.sh | bash
# 관리자 권한 없이 이 사용자 폴더에만 씀(macOS ~/Library/Application Support/lecpage, Linux ~/.local/share/lecpage).
# 1) Node.js 22 이상: 있으면 그대로, 없으면 nodejs.org의 LTS(tar.gz, x64·arm64)를 받아 SHA-256 확인 뒤 풂(처음 한 번).
#    가장 새 LTS가 이 컴퓨터에서 돌지 않으면(오래된 macOS 등) 그다음 LTS로
# 2) lecpage 커넥트: GitHub 릴리스(studio-latest)의 VERSION이 바뀌었으면 묶음을 받아 SHA-256(공개 키를 넣었으면 ed25519 서명까지) 확인 뒤 바꿈
#    (못 받거나 확인에 실패하면 있던 판). 옆 폴더에 풀어 이름만 바꿔 끼우고(끼우다 실패하면 있던 묶음을 되돌림), 묶음 안의 BUILT(묶은 때)가
#    있던 것보다 앞서면(서명한 예전 묶음) 바꾸지 않음. lecpage 커넥트가 이미 켜져 있으면 여기서 바꾸지 않고 켜져 있는 커넥트가 스스로 바꾸게 함
#    (돌고 있는 커넥트 밑의 파일을 바꾸면 만들던 작업이 깨짐). 준비(Node.js·묶음)는 한 번에 한 창만(두 번 켰을 때 먼저 켠 쪽을 기다림)
# 3) 이 파일을 사용자 폴더(lecpage-connect.sh)에 둠: 컴퓨터를 켤 때 켜기(LaunchAgent·autostart)가 이 파일을 부름
# 4) node lecpage.mjs studio(브라우저로 lecpage.com이 열림). 끄기: Ctrl+C
# --autostart(컴퓨터를 켤 때): 창 없이 켜지고 기록은 사용자 폴더의 connect.log
# 바꿀 수 있는 값: LECPAGE_RELEASE_BASE(묶음 받을 곳) · LECPAGE_NODE_DIST(Node.js 받을 곳) · LECPAGE_DRY_RUN=1(켜기 직전에 멈춤, 점검용) ·
#   LECPAGE_CONNECT_PORTS(켜져 있는 커넥트를 살필 포트 범위, 기본 6600-6649. 시험용)
set -eu

# curl … | bash로 돌 때도 끝까지 받은 뒤에 실행되게(중간에 끊기면 아무것도 하지 않음) 모두 main 안에
main() {
  # 묶음 서명 공개 키(ed25519, base64url, 띄어 써서 여럿). 기준은 skills/lecpage/scripts/studio-update.mjs의 SIGNING_KEYS(같은지 시험이 확인,
  # 넣고 빼기는 scripts/studio-launcher/signing-key.mjs). 비어 있으면 SHA-256만 확인, 있으면 서명(.sig)까지 맞아야 새 판으로 바꿈
  SIGNING_KEYS='fXeJSCSG_l5AvDuyLpaefYer_g6vv4WdMP-iIOx_85o'
  BASE="${LECPAGE_RELEASE_BASE:-https://github.com/yoorrard/lecpage/releases/download/studio-latest}"
  NDIST="${LECPAGE_NODE_DIST:-https://nodejs.org/dist}"
  case "$(uname -s)" in
    Darwin) LP="$HOME/Library/Application Support/lecpage"; OS=darwin ;;
    Linux) LP="${XDG_DATA_HOME:-$HOME/.local/share}/lecpage"; OS=linux ;;
    *) echo "이 운영체제에서는 아직 쓸 수 없어요(macOS·Linux·Windows만)."; exit 1 ;;
  esac
  mkdir -p "$LP"
  case " $* " in
    *" --autostart "*) [ -f "$LP/connect.log" ] && mv -f "$LP/connect.log" "$LP/connect.log.1"; exec >"$LP/connect.log" 2>&1; chmod 600 "$LP/connect.log" "$LP/connect.log.1" 2>/dev/null ;; # 기록은 이 사용자만 읽게
  esac
  if ! command -v curl >/dev/null 2>&1 && ! command -v wget >/dev/null 2>&1; then
    say "파일을 받을 curl(또는 wget)이 없어요. 먼저 설치해 주세요(예: sudo apt install curl)."; exit 1
  fi
  say "lecpage 커넥트를 준비해요. lecpage를 쓰는 동안 이 창을 열어 두세요."
  # 준비(Node.js 받기·묶음 바꾸기)는 한 번에 한 창만: 두 번 켰을 때 둘이 같은 폴더를 함께 바꾸지 않게 먼저 켠 쪽을 기다림
  LOCK="$LP/prepare.lock"
  lock_take
  trap 'lock_free' EXIT
  trap 'lock_free; exit 130' INT TERM HUP

  NODE=""
  if command -v node >/dev/null 2>&1 && node_ok node; then NODE=$(command -v node); fi
  if [ -z "$NODE" ] && [ -x "$LP/node/bin/node" ] && node_ok "$LP/node/bin/node"; then NODE="$LP/node/bin/node"; fi
  if [ -z "$NODE" ]; then
    case "$(uname -m)" in
      arm64|aarch64) ARCH=arm64 ;;
      x86_64|amd64) ARCH=x64 ;;
      *) say "이 CPU($(uname -m))용 Node.js는 받을 수 없어요. https://nodejs.org 에서 Node.js 22 이상을 설치한 뒤 다시 실행해 주세요."; exit 1 ;;
    esac
    say "Node.js를 받는 중이에요(처음 한 번, 약 50MB)."
    # LTS 판: 큰 판(24·22 …)마다 가장 새것, 새것부터
    VERS=$(dl "$NDIST/index.json" | tr '{' '\n' | grep '"lts":"' | sed -n 's/.*"version":"\(v[0-9.]*\)".*/\1/p' |
      awk -F. '{ m = substr($1, 2) + 0; if (m >= 22 && !(m in seen)) { seen[m] = 1; print } }')
    [ -n "$VERS" ] || { say "Node.js 버전 목록을 읽지 못했어요. 인터넷 연결을 확인해 주세요."; exit 1; }
    for VER in $VERS; do
      NAME="node-$VER-$OS-$ARCH"
      T=$(mktemp -d)
      if dl "$NDIST/$VER/$NAME.tar.gz" > "$T/n.tgz"; then
        WANT=$(dl "$NDIST/$VER/SHASUMS256.txt" | grep " $NAME.tar.gz\$" | cut -d' ' -f1)
        if [ -z "$WANT" ] || [ "$WANT" != "$(sha "$T/n.tgz")" ]; then
          say "Node.js 파일 확인(SHA-256)에 실패했어요. 다시 실행해 주세요."; rm -rf "$T"; exit 1
        fi
        tar -xzf "$T/n.tgz" -C "$T"
        if node_ok "$T/$NAME/bin/node"; then
          rm -rf "$LP/node"; mv "$T/$NAME" "$LP/node"; rm -rf "$T"; NODE="$LP/node/bin/node"; break
        fi
        say "Node.js $VER이 이 컴퓨터에서 돌지 않아 다른 버전을 받아요."
      fi
      rm -rf "$T"
    done
    [ -n "$NODE" ] || { say "이 컴퓨터에서 도는 Node.js를 받지 못했어요. https://nodejs.org 에서 Node.js 22 이상을 설치한 뒤 다시 실행해 주세요."; exit 1; }
  fi

  APP="$LP/studio"
  HAVE=$(cat "$APP/VERSION" 2>/dev/null || true)
  if LATEST=$(dl "$BASE/VERSION" 2>/dev/null) && [ -n "$LATEST" ]; then
    if [ "$LATEST" != "$HAVE" ]; then
      # 스스로 새 판으로 바꿀 수 있는 커넥트가 이미 켜져 있으면 여기서 묶음을 갈아 끼우지 않음(돌고 있는 커넥트 밑의 파일이 바뀌면 만들던 작업이 깨짐).
      # 새 판은 켜져 있는 커넥트가 받아 바꿈: 아래에서 켜는 studio가 그 커넥트에 부탁함(LECPAGE_CONNECT_LATEST)
      if [ -f "$APP/skills/lecpage/scripts/studio-update.mjs" ] && connect_running; then
        say "lecpage 커넥트가 이미 켜져 있어요. 새 버전은 켜져 있는 커넥트가 바꿔요."
        LECPAGE_CONNECT_LATEST="$LATEST"; export LECPAGE_CONNECT_LATEST
      else
        say "lecpage 커넥트 새 버전을 받는 중이에요."
        fetch_app "$APP" && FR=0 || FR=$?
        if [ "$FR" -ne 0 ]; then
          [ -d "$APP/skills" ] || { say "lecpage 커넥트를 받지 못했어요. 인터넷 연결을 확인하고 다시 실행해 주세요."; exit 1; }
          if [ "$FR" -eq 2 ]; then say "받은 파일이 지금 버전보다 예전 것이라 바꾸지 않았어요. 쓰던 버전으로 켜요."
          else say "새 버전을 받지 못해 쓰던 버전으로 켜요."; fi
        fi
      fi
    fi
  elif [ ! -d "$APP/skills" ]; then
    say "lecpage 커넥트를 받지 못했어요. 인터넷 연결을 확인하고 다시 실행해 주세요."; exit 1
  else
    say "새 버전을 확인하지 못해 쓰던 버전으로 켜요."
  fi

  # 컴퓨터를 켤 때 켜기용 복사본: 묶음 안의 이 파일(없으면 지금 도는 파일). 도는 중에 바꿔도 되게 새 파일로 쓴 뒤 옮김
  SELF="$LP/lecpage-connect.sh"
  SRC=""
  if [ -f "$APP/lecpage-connect.sh" ]; then SRC="$APP/lecpage-connect.sh"
  else case "$0" in *.sh|*.command) [ -f "$0" ] && SRC="$0" ;; esac
  fi
  if [ -n "$SRC" ] && [ "$SRC" != "$SELF" ]; then
    { cp "$SRC" "$SELF.new" && chmod 755 "$SELF.new" && mv -f "$SELF.new" "$SELF"; } 2>/dev/null || true
  fi
  if [ -f "$SELF" ]; then LECPAGE_LAUNCHER="$SELF"; export LECPAGE_LAUNCHER; fi

  CLI="$APP/skills/lecpage/scripts/lecpage.mjs"
  if [ -n "${LECPAGE_DRY_RUN:-}" ]; then say "점검: $NODE $CLI studio $*"; exit 0; fi
  lock_free; trap - EXIT INT TERM HUP # exec 뒤에는 trap이 돌지 않으므로 여기서 풂
  exec "$NODE" "$CLI" studio "$@"
}

say() { printf '%s\n' "$*"; }
dl() { if command -v curl >/dev/null 2>&1; then curl -fsSL "$1"; else wget -qO- "$1"; fi; }
sha() { if command -v shasum >/dev/null 2>&1; then shasum -a 256 "$1" | cut -d' ' -f1; else sha256sum "$1" | cut -d' ' -f1; fi; }
# ed25519 서명 확인(Node.js 내장 crypto): $1 묶음 · $2 .sig(base64 서명 한 줄에 하나) → SIGNING_KEYS 중 하나로 맞으면 0.
# lecpage-connect.cmd에도 같은 글이 있음(시험이 같은지 확인). 큰따옴표·$·느낌표·역따옴표를 쓰지 않음(셸·PowerShell 5.1이 건드리지 않게)
VERIFY_JS="const c=require('crypto'),f=require('fs'),e=process.env;let ok=false;try{const d=f.readFileSync(e.LECPAGE_VERIFY_FILE);const s=f.readFileSync(e.LECPAGE_VERIFY_SIG,'utf8').split(/\s+/).filter(Boolean).slice(0,8).map(x=>Buffer.from(x,'base64')).filter(b=>b.length===64);for(const x of String(e.LECPAGE_VERIFY_KEYS||'').split(/\s+/).filter(Boolean)){try{const k=c.createPublicKey({key:{kty:'OKP',crv:'Ed25519',x},format:'jwk'});for(const b of s)if(c.verify(null,d,k,b))ok=true}catch(_){}}}catch(_){}process.exit(ok?0:1)"
sig_ok() { LECPAGE_VERIFY_FILE="$1" LECPAGE_VERIFY_SIG="$2" LECPAGE_VERIFY_KEYS="$SIGNING_KEYS" "$NODE" -e "$VERIFY_JS" >/dev/null 2>&1; }
node_ok() { "$1" -e 'process.exit(+process.versions.node.split(".")[0] >= 22 ? 0 : 1)' >/dev/null 2>&1; }
# 이 PC에 lecpage 커넥트가 켜져 있는지(Node.js 내장 http, 포트 6600~6649): 토큰 없이 물으면 커넥트는 401 { error:'token' }으로 답함 → 있으면 0.
# 토큰은 보내지 않음. lecpage-connect.cmd에도 같은 글이 있음(시험이 같은지 확인). VERIFY_JS처럼 큰따옴표·$·느낌표·역따옴표를 쓰지 않음
RUNNING_JS="const h=require('http'),m=/^(\d+)-(\d+)/.exec(process.env.LECPAGE_CONNECT_PORTS||'6600-6649')||[0,6600,6649];let n=0,f=false;const fin=()=>process.exit(f?0:1);setTimeout(fin,4000);for(let p=+m[1];p<=+m[2]&&p-m[1]<64;p++){n++;let k=false;const done=()=>{if(k)return;k=true;if(f||--n<=0)fin()};const q=h.get({host:'127.0.0.1',port:p,path:'/bridge/status',timeout:1500},r=>{let b='';r.on('data',d=>{if(b.length<4096)b+=d});r.on('error',done);r.on('end',()=>{try{if(r.statusCode===401&&JSON.parse(b).error==='token')f=true}catch(_){}done()})});q.on('timeout',()=>q.destroy());q.on('error',done)}if(n===0)fin()"
connect_running() { "$NODE" -e "$RUNNING_JS" >/dev/null 2>&1; }
# 준비 잠금($LOCK 폴더: mkdir은 하나만 성공). 10분 넘은 잠금(먼저 켠 창이 중간에 닫힘)은 치우고 가져감. 잠글 수 없으면 잠금 없이 이어 감
lock_take() {
  LW=0
  while ! mkdir "$LOCK" 2>/dev/null; do
    [ -d "$LOCK" ] || { LOCK=""; return 0; }
    if [ "$LW" -ge 300 ] || [ -n "$(find "$LOCK" -maxdepth 0 -mmin +10 2>/dev/null)" ]; then
      rmdir "$LOCK" 2>/dev/null || { LOCK=""; return 0; }
      continue
    fi
    [ "$LW" -ne 0 ] || say "다른 창에서 lecpage 커넥트를 준비하고 있어요. 끝날 때까지 잠시 기다려요."
    LW=$((LW + 1)); sleep 2
  done
}
lock_free() { if [ -n "${LOCK:-}" ]; then rmdir "$LOCK" 2>/dev/null || true; LOCK=""; fi; }
# 받은 묶음($1)이 있던 묶음($2)보다 예전 것인지: 묶음 안의 BUILT(묶은 때, 1970년부터 센 초. 서명에 함께 들어감).
# 있던 것에 BUILT가 있는데 받은 것에 없거나 더 앞서면 예전 것(0). 있던 것에 없으면(이 확인을 넣기 전 판) 견주지 않음(1)
older() {
  OB=$(cat "$2/BUILT" 2>/dev/null || true); NB=$(cat "$1/BUILT" 2>/dev/null || true)
  case "$OB" in ''|*[!0-9]*) return 1 ;; esac
  [ "${#OB}" -ge 9 ] && [ "${#OB}" -le 12 ] || return 1
  case "$NB" in ''|*[!0-9]*) return 0 ;; esac
  [ "${#NB}" -ge 9 ] && [ "${#NB}" -le 12 ] || return 0
  [ "$NB" -lt "$OB" ]
}
# 묶음 받기 → SHA-256 확인 → (공개 키가 있으면) 서명 확인 → 옆 폴더에 풀기 → 예전 것이 아닌지 확인 → 이름을 바꿔 갈아 끼움.
# 하나라도 안 되면 있던 것을 그대로 두고 1(받은 것이 예전 묶음이면 2). 부르는 쪽이 있던 판으로 켬
fetch_app() {
  FT=$(mktemp -d)
  if ! dl "$BASE/lecpage-connect.tar.gz" > "$FT/s.tgz"; then rm -rf "$FT"; return 1; fi
  FW=$(dl "$BASE/lecpage-connect.tar.gz.sha256" | cut -d' ' -f1)
  if [ -z "$FW" ] || [ "$FW" != "$(sha "$FT/s.tgz")" ]; then say "받은 파일 확인(SHA-256)에 실패했어요."; rm -rf "$FT"; return 1; fi
  if [ -n "$SIGNING_KEYS" ] && ! { dl "$BASE/lecpage-connect.tar.gz.sig" > "$FT/s.sig" && sig_ok "$FT/s.tgz" "$FT/s.sig"; }; then
    say "받은 파일의 서명을 확인하지 못했어요."; rm -rf "$FT"; return 1
  fi
  # 같은 디스크의 옆 폴더에 풂(임시 폴더는 다른 디스크일 수 있어 옮기다 끊기면 반쯤 옮긴 묶음이 남음). 커넥트가 스스로 바꿀 때 쓰는 이름(.new·.old)과 겹치지 않게
  FN="$1.new-launcher"; FO="$1.old-launcher"
  rm -rf "$FN" "$FO"
  if ! { mkdir "$FN" && tar -xzf "$FT/s.tgz" -C "$FN" && [ -d "$FN/skills" ]; }; then rm -rf "$FT" "$FN"; return 1; fi
  rm -rf "$FT"
  if older "$FN" "$1"; then rm -rf "$FN"; return 2; fi
  if [ -e "$1" ] && ! mv "$1" "$FO"; then rm -rf "$FN"; return 1; fi
  if ! mv "$FN" "$1"; then
    if [ -e "$FO" ]; then mv "$FO" "$1" || true; fi
    rm -rf "$FN"; return 1
  fi
  rm -rf "$FO"
}

main "$@"
