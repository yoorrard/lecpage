@echo off
setlocal
rem lecpage Connect for Windows. Double-click: prepares Node.js (first time), gets the latest lecpage Connect, starts it, opens lecpage.com.
rem The batch part stays ASCII; the PowerShell part below (after the marker line) holds the Korean messages.
set "LECPAGE_SELF=%~f0"
set "LECPAGE_ARGS=%*"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$s=[IO.File]::ReadAllText($env:LECPAGE_SELF,[Text.Encoding]::UTF8); $i=$s.IndexOf('#'+'#PS#'+'#'); iex $s.Substring($i)"
set "RC=%ERRORLEVEL%"
if not "%RC%"=="0" pause
exit /b %RC%
##PS##
# lecpage 커넥트(Windows): 관리자 권한 없이 이 사용자 폴더(%LOCALAPPDATA%\lecpage)에만 씀
# 1) Node.js 22 이상: 있으면 그대로, 없으면 nodejs.org의 LTS zip(x64·arm64)을 받아 SHA-256 확인 뒤 풂(처음 한 번)
# 2) lecpage 커넥트: GitHub 릴리스(studio-latest)의 VERSION이 바뀌었으면 zip을 받아 SHA-256(공개 키를 넣었으면 ed25519 서명까지) 확인 뒤 바꿈
#    (못 받거나 확인에 실패하면 있던 판). 옆 폴더에 풀어 이름만 바꿔 끼우고(끼우다 실패하면 있던 묶음을 되돌림), 묶음 안의 BUILT(묶은 때)가
#    있던 것보다 앞서면(서명한 예전 묶음) 바꾸지 않음. lecpage 커넥트가 이미 켜져 있으면 여기서 바꾸지 않고 켜져 있는 커넥트가 스스로 바꾸게 함
#    (돌고 있는 커넥트 밑의 파일을 바꾸면 만들던 작업이 깨짐). 준비(Node.js·묶음)는 한 번에 한 창만(두 번 켰을 때 먼저 켠 쪽을 기다림)
# 3) 묶음 안의 이 파일을 사용자 폴더(lecpage-connect.cmd)에 복사(컴퓨터를 켤 때 켜기에 씀) → 4) node lecpage.mjs studio(브라우저로 lecpage.com이 열림)
# 바꿀 수 있는 값: LECPAGE_RELEASE_BASE(묶음 받을 곳) · LECPAGE_NODE_DIST(Node.js 받을 곳) · LECPAGE_DRY_RUN=1(켜기 직전에 멈춤, 점검용)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch { }
try { $Host.UI.RawUI.WindowTitle = 'lecpage 커넥트' } catch { }
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch { }
$Base = 'https://github.com/yoorrard/lecpage/releases/download/studio-latest'
if ($env:LECPAGE_RELEASE_BASE) { $Base = $env:LECPAGE_RELEASE_BASE }
$NDist = 'https://nodejs.org/dist'
if ($env:LECPAGE_NODE_DIST) { $NDist = $env:LECPAGE_NODE_DIST }
# 묶음 서명 공개 키(ed25519, base64url). 기준은 skills/lecpage/scripts/studio-update.mjs의 SIGNING_KEYS(같은지 시험이 확인, 넣고 빼기는
# scripts/studio-launcher/signing-key.mjs). 비어 있으면 SHA-256만 확인, 있으면 서명(.sig)까지 맞아야 바꿈.
# Windows PowerShell 5.1에는 ed25519가 없어 1)에서 준비한 Node.js로 확인(lecpage-connect.sh와 같은 글. 큰따옴표가 없어 인자로 그대로 넘어감)
$SigningKeys = @('fXeJSCSG_l5AvDuyLpaefYer_g6vv4WdMP-iIOx_85o')
$VerifyJs = @'
const c=require('crypto'),f=require('fs'),e=process.env;let ok=false;try{const d=f.readFileSync(e.LECPAGE_VERIFY_FILE);const s=f.readFileSync(e.LECPAGE_VERIFY_SIG,'utf8').split(/\s+/).filter(Boolean).slice(0,8).map(x=>Buffer.from(x,'base64')).filter(b=>b.length===64);for(const x of String(e.LECPAGE_VERIFY_KEYS||'').split(/\s+/).filter(Boolean)){try{const k=c.createPublicKey({key:{kty:'OKP',crv:'Ed25519',x},format:'jwk'});for(const b of s)if(c.verify(null,d,k,b))ok=true}catch(_){}}}catch(_){}process.exit(ok?0:1)
'@
# 이 PC에 lecpage 커넥트가 켜져 있는지(포트 6600~6649): 토큰 없이 물으면 커넥트는 401 { error:'token' }으로 답함. 토큰은 보내지 않음(lecpage-connect.sh와 같은 글)
$RunningJs = @'
const h=require('http'),m=/^(\d+)-(\d+)/.exec(process.env.LECPAGE_CONNECT_PORTS||'6600-6649')||[0,6600,6649];let n=0,f=false;const fin=()=>process.exit(f?0:1);setTimeout(fin,4000);for(let p=+m[1];p<=+m[2]&&p-m[1]<64;p++){n++;let k=false;const done=()=>{if(k)return;k=true;if(f||--n<=0)fin()};const q=h.get({host:'127.0.0.1',port:p,path:'/bridge/status',timeout:1500},r=>{let b='';r.on('data',d=>{if(b.length<4096)b+=d});r.on('error',done);r.on('end',()=>{try{if(r.statusCode===401&&JSON.parse(b).error==='token')f=true}catch(_){}done()})});q.on('timeout',()=>q.destroy());q.on('error',done)}if(n===0)fin()
'@
$LP = Join-Path $env:LOCALAPPDATA 'lecpage'
New-Item -ItemType Directory -Force -Path $LP | Out-Null
function Say($t) { Write-Host $t }
function Sha($f) { (Get-FileHash -LiteralPath $f -Algorithm SHA256).Hash.ToLower() }
# 서명 확인 → $true/$false. 파일·.sig·공개 키는 환경 변수로 넘김
function SigOk($nodeExe, $file, $sig) {
  $env:LECPAGE_VERIFY_FILE = $file; $env:LECPAGE_VERIFY_SIG = $sig; $env:LECPAGE_VERIFY_KEYS = ($SigningKeys -join ' ')
  try { & $nodeExe -e $VerifyJs | Out-Null; $LASTEXITCODE -eq 0 }
  finally { Remove-Item Env:LECPAGE_VERIFY_FILE, Env:LECPAGE_VERIFY_SIG, Env:LECPAGE_VERIFY_KEYS -ErrorAction SilentlyContinue }
}
# 켜져 있는 lecpage 커넥트가 있는지 → $true/$false
function ConnectRunning($nodeExe) { try { & $nodeExe -e $RunningJs | Out-Null; $LASTEXITCODE -eq 0 } catch { $false } }
# 묶음 안의 BUILT(묶은 때, 1970년부터 센 초. 서명에 함께 들어감) → 수 | $null
function Built($dir) { try { $t = ([IO.File]::ReadAllText((Join-Path $dir 'BUILT'))).Trim(); if ($t -match '^[0-9]{9,12}$') { [long]$t } else { $null } } catch { $null } }
# 이름 바꾸기·옮기기. 백신·검색이 방금 푼 파일을 잠깐 잡고 있으면 잠시 뒤 다시(최대 약 10초)
function MoveRetry($from, $to) {
  for ($i = 0; ; $i++) {
    try { Move-Item -LiteralPath $from -Destination $to -ErrorAction Stop; return }
    catch { if ($i -ge 19) { throw }; Start-Sleep -Milliseconds 500 }
  }
}
# 배치 머리 부분(##PS## 줄 앞, ASCII)
function Head($f) { $t = [Text.Encoding]::ASCII.GetString([IO.File]::ReadAllBytes($f)); $i = $t.IndexOf('##PS##'); if ($i -lt 0) { '' } else { $t.Substring(0, $i) } }
# 글 받기. GitHub 릴리스 파일(VERSION·.sha256)은 application/octet-stream이라 .Content가 글이 아닌 바이트 배열로 옴 → UTF-8로 풂
function GetText($u) { $c = (Invoke-WebRequest -Uri $u -UseBasicParsing).Content; if ($c -is [byte[]]) { $c = [Text.Encoding]::UTF8.GetString($c) }; ([string]$c).Trim() }
$lock = Join-Path $LP 'prepare.lock'
$locked = $false
try {
  Say 'lecpage 커넥트를 준비해요. lecpage를 쓰는 동안 이 창을 열어 두세요.'
  # 준비(Node.js 받기·묶음 바꾸기)는 한 번에 한 창만: 두 번 눌렀을 때 둘이 같은 폴더를 함께 바꾸지 않게 먼저 켠 쪽을 기다림.
  # 10분 넘은 잠금(먼저 켠 창이 중간에 닫힘)은 치우고 가져감. 잠글 수 없으면 잠금 없이 이어 감
  $waited = 0
  while (-not $locked) {
    try { New-Item -ItemType Directory -Path $lock -ErrorAction Stop | Out-Null; $locked = $true }
    catch {
      $held = Get-Item -LiteralPath $lock -ErrorAction SilentlyContinue
      if (-not $held) { break }
      if ($waited -ge 300 -or ((Get-Date) - $held.LastWriteTime).TotalMinutes -gt 10) {
        Remove-Item -LiteralPath $lock -Force -ErrorAction SilentlyContinue
        if (Test-Path -LiteralPath $lock) { break }
        continue
      }
      if ($waited -eq 0) { Say '다른 창에서 lecpage 커넥트를 준비하고 있어요. 끝날 때까지 잠시 기다려요.' }
      $waited++
      Start-Sleep -Seconds 2
    }
  }
  $node = $null
  $c = Get-Command node -ErrorAction SilentlyContinue
  if ($c) { try { $v = & $c.Source -p 'process.versions.node'; if ([int]($v.Split('.')[0]) -ge 22) { $node = $c.Source } } catch { } }
  $nodeDir = Join-Path $LP 'node'
  if (-not $node -and (Test-Path (Join-Path $nodeDir 'node.exe'))) { $node = Join-Path $nodeDir 'node.exe' }
  if (-not $node) {
    Say 'Node.js를 받는 중이에요(처음 한 번, 약 30MB).'
    $idx = Invoke-RestMethod -Uri "$NDist/index.json" -UseBasicParsing
    $rel = $idx | Where-Object { $_.lts -and ([int]($_.version.TrimStart('v').Split('.')[0]) -ge 22) } | Select-Object -First 1
    if (-not $rel) { throw 'Node.js 버전 목록을 읽지 못했어요.' }
    $arch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'x64' }
    $name = "node-$($rel.version)-win-$arch"
    $zip = Join-Path $env:TEMP "$name.zip"
    Invoke-WebRequest -Uri "$NDist/$($rel.version)/$name.zip" -OutFile $zip -UseBasicParsing
    $sums = GetText "$NDist/$($rel.version)/SHASUMS256.txt"
    $line = ($sums -split "`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ -match "\s$([regex]::Escape($name)).zip$" } | Select-Object -First 1)
    if (-not $line -or ($line -split '\s+')[0].ToLower() -ne (Sha $zip)) { throw 'Node.js 파일 확인(SHA-256)에 실패했어요.' }
    try { Unblock-File -LiteralPath $zip } catch { }
    $tmp = Join-Path $LP 'node-new'
    Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
    Expand-Archive -LiteralPath $zip -DestinationPath $tmp -Force
    Remove-Item -LiteralPath $nodeDir -Recurse -Force -ErrorAction SilentlyContinue
    Move-Item -LiteralPath (Join-Path $tmp $name) -Destination $nodeDir
    Remove-Item -LiteralPath $tmp, $zip -Recurse -Force -ErrorAction SilentlyContinue
    $node = Join-Path $nodeDir 'node.exe'
  }
  $app = Join-Path $LP 'studio'
  $verFile = Join-Path $app 'VERSION'
  $have = if (Test-Path $verFile) { (Get-Content -LiteralPath $verFile -Raw).Trim() } else { '' }
  try {
    $latest = GetText "$Base/VERSION"
    # 스스로 새 판으로 바꿀 수 있는 커넥트가 이미 켜져 있으면 여기서 묶음을 갈아 끼우지 않음(돌고 있는 커넥트 밑의 파일이 바뀌면 만들던 작업이 깨짐).
    # 새 판은 켜져 있는 커넥트가 받아 바꿈: 아래에서 켜는 studio가 그 커넥트에 부탁함(LECPAGE_CONNECT_LATEST)
    if ($latest -and $latest -ne $have -and (Test-Path -LiteralPath (Join-Path $app 'skills\lecpage\scripts\studio-update.mjs')) -and (ConnectRunning $node)) {
      Say 'lecpage 커넥트가 이미 켜져 있어요. 새 버전은 켜져 있는 커넥트가 바꿔요.'
      $env:LECPAGE_CONNECT_LATEST = $latest
    } elseif ($latest -and $latest -ne $have) {
      Say 'lecpage 커넥트 새 버전을 받는 중이에요.'
      $zip = Join-Path $env:TEMP 'lecpage-connect.zip'
      Invoke-WebRequest -Uri "$Base/lecpage-connect.zip" -OutFile $zip -UseBasicParsing
      $want = ((GetText "$Base/lecpage-connect.zip.sha256") -split '\s+')[0].ToLower()
      if ((Sha $zip) -ne $want) { throw '받은 파일 확인(SHA-256)에 실패했어요.' }
      if ($SigningKeys.Count -gt 0) {
        $sig = Join-Path $env:TEMP 'lecpage-connect.zip.sig'
        Invoke-WebRequest -Uri "$Base/lecpage-connect.zip.sig" -OutFile $sig -UseBasicParsing
        $ok = SigOk $node $zip $sig
        Remove-Item -LiteralPath $sig -Force -ErrorAction SilentlyContinue
        if (-not $ok) { throw '받은 파일의 서명을 확인하지 못했어요.' }
      }
      # 확인을 마친 파일에서만 다운로드 표시(Zone.Identifier)를 지움. PowerShell로 받은 파일에는 보통 없지만, 붙어 있으면 푼 파일마다 따라감
      try { Unblock-File -LiteralPath $zip } catch { }
      $tmp = Join-Path $LP 'studio-new'
      $old = Join-Path $LP 'studio-old'
      Remove-Item -LiteralPath $tmp, $old -Recurse -Force -ErrorAction SilentlyContinue
      Expand-Archive -LiteralPath $zip -DestinationPath $tmp -Force
      Remove-Item -LiteralPath $zip -Force -ErrorAction SilentlyContinue
      if (-not (Test-Path -LiteralPath (Join-Path $tmp 'skills'))) { Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue; throw '받은 묶음에 lecpage 커넥트가 없어요.' }
      # 서명한 예전 묶음으로 내리지 않음: 있던 묶음에 BUILT가 있는데 받은 것에 없거나 더 앞서면 바꾸지 않음
      $haveBuilt = Built $app
      $newBuilt = Built $tmp
      if ($null -ne $haveBuilt -and ($null -eq $newBuilt -or $newBuilt -lt $haveBuilt)) {
        Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
        throw '받은 파일이 지금 버전보다 예전 것이에요.'
      }
      # 지우고 옮기지 않고 이름만 바꿔 갈아 끼움: 있던 묶음을 반쯤 지운 채 멈추지 않게(쓰는 중이라 이름을 못 바꾸면 있던 묶음 그대로).
      # 새 묶음을 끼우다 실패하면 있던 묶음을 되돌림
      $hadApp = Test-Path -LiteralPath $app
      try {
        if ($hadApp) { MoveRetry $app $old }
        try { MoveRetry $tmp $app }
        catch { if ($hadApp -and -not (Test-Path -LiteralPath $app)) { Move-Item -LiteralPath $old -Destination $app -ErrorAction SilentlyContinue }; throw }
      } catch { Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue; throw }
      Remove-Item -LiteralPath $old -Recurse -Force -ErrorAction SilentlyContinue
    }
  } catch {
    if (-not (Test-Path (Join-Path $app 'skills'))) { throw "lecpage 커넥트를 받지 못했어요($($_.Exception.Message))." }
    if ("$($_.Exception.Message)" -match '예전 것이에요') { Say '받은 파일이 지금 버전보다 예전 것이라 바꾸지 않았어요. 쓰던 버전으로 켜요.' }
    else { Say '새 버전을 확인하지 못해 쓰던 버전으로 켜요.' }
  }
  # 컴퓨터를 켤 때 켜기용 복사본: 묶음 안의 이 파일(위에서 확인을 마친 것, 없으면 지금 도는 파일). 예전 이름(lecpage-studio.cmd) 복사본이 있으면
  # (예전에 켜 둔 자동 시작이 그 파일을 부름) 그것도 새것으로. 지금 도는 파일은 배치 머리 부분(##PS## 앞)이 같을 때만 바꿈(cmd는 명령을 마치면
  # 같은 바이트 자리부터 파일을 다시 읽음). 묶음에서 온 복사본은 다운로드 표시를 지움: 브라우저로 받은 파일을 복사하면 표시가 따라와 컴퓨터를 켤 때마다
  # 보안 경고 창이 뜸. 브라우저로 받은 원래 파일(다운로드 폴더)은 건드리지 않음
  $self = Join-Path $LP 'lecpage-connect.cmd'
  $src = Join-Path $app 'lecpage-connect.cmd'
  $fromPkg = Test-Path -LiteralPath $src
  if (-not $fromPkg) { $src = $env:LECPAGE_SELF }
  foreach ($dst in @($self, (Join-Path $LP 'lecpage-studio.cmd'))) {
    if ($dst -ne $self -and -not (Test-Path -LiteralPath $dst)) { continue }
    try {
      if ($src -ne $dst -and (-not (Test-Path -LiteralPath $dst) -or (Sha $src) -ne (Sha $dst))) {
        if ($dst -eq $env:LECPAGE_SELF -and (Head $src) -cne (Head $dst)) { continue }
        Copy-Item -LiteralPath $src -Destination $dst -Force
      }
      if ($fromPkg) { Unblock-File -LiteralPath $dst }
    } catch { }
  }
  $env:LECPAGE_LAUNCHER = $self
  $cli = Join-Path $app 'skills\lecpage\scripts\lecpage.mjs'
  $a = @('studio')
  if ("$env:LECPAGE_ARGS" -match '--autostart') { $a += '--autostart' }
  if ($env:LECPAGE_DRY_RUN) { Say "점검: $node $cli $($a -join ' ') (자동 시작용 복사본: $self)"; exit 0 }
  # 준비가 끝났으니 잠금을 풂(커넥트는 켜 둔 동안 내내 돌므로 그 전에)
  if ($locked) { Remove-Item -LiteralPath $lock -Force -ErrorAction SilentlyContinue; $locked = $false }
  & $node $cli @a
  exit $LASTEXITCODE
} catch {
  Say ''
  Say "문제가 생겼어요: $($_.Exception.Message)"
  Say "인터넷 연결을 확인하고 이 파일을 다시 실행해 주세요. 계속 안 되면 lecpage.com의 '다른 방법'(API 키)으로 만들 수 있어요."
  exit 1
} finally {
  if ($locked) { Remove-Item -LiteralPath $lock -Force -ErrorAction SilentlyContinue }
}
