@echo off
setlocal
rem lecpage PC program for Windows. Double-click: prepares Node.js (first time), gets the latest lecpage PC program, starts it, opens lecpage.com.
rem The batch part stays ASCII; the PowerShell part below (after the marker line) holds the Korean messages.
set "LECPAGE_SELF=%~f0"
set "LECPAGE_ARGS=%*"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$s=[IO.File]::ReadAllText($env:LECPAGE_SELF,[Text.Encoding]::UTF8); $i=$s.IndexOf('#'+'#PS#'+'#'); iex $s.Substring($i)"
set "RC=%ERRORLEVEL%"
if not "%RC%"=="0" pause
exit /b %RC%
##PS##
# lecpage PC 프로그램(Windows) — 관리자 권한 없이 이 사용자 폴더(%LOCALAPPDATA%\lecpage)에만 씀
# 1) Node.js 22 이상: 있으면 그대로, 없으면 nodejs.org의 LTS zip을 받아 SHA-256 확인 뒤 풂(처음 한 번)
# 2) lecpage PC 프로그램: GitHub 릴리스(studio-latest)의 VERSION이 바뀌었으면 zip을 받아 SHA-256 확인 뒤 바꿈(못 받으면 있던 판)
# 3) 이 파일을 사용자 폴더에 복사(컴퓨터를 켤 때 켜기에 씀) → 4) node lecpage.mjs studio(브라우저로 lecpage.com이 열림)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch { }
try { $Host.UI.RawUI.WindowTitle = 'lecpage PC 프로그램' } catch { }
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch { }
$Base = 'https://github.com/yoorrard/lecpage/releases/download/studio-latest'
if ($env:LECPAGE_RELEASE_BASE) { $Base = $env:LECPAGE_RELEASE_BASE }
$LP = Join-Path $env:LOCALAPPDATA 'lecpage'
New-Item -ItemType Directory -Force -Path $LP | Out-Null
function Say($t) { Write-Host $t }
function Sha($f) { (Get-FileHash -LiteralPath $f -Algorithm SHA256).Hash.ToLower() }
try {
  Say 'lecpage PC 프로그램을 준비해요. lecpage를 쓰는 동안 이 창을 열어 두세요.'
  $node = $null
  $c = Get-Command node -ErrorAction SilentlyContinue
  if ($c) { try { $v = & $c.Source -p 'process.versions.node'; if ([int]($v.Split('.')[0]) -ge 22) { $node = $c.Source } } catch { } }
  $nodeDir = Join-Path $LP 'node'
  if (-not $node -and (Test-Path (Join-Path $nodeDir 'node.exe'))) { $node = Join-Path $nodeDir 'node.exe' }
  if (-not $node) {
    Say 'Node.js를 받는 중이에요(처음 한 번, 약 30MB).'
    $idx = Invoke-RestMethod -Uri 'https://nodejs.org/dist/index.json' -UseBasicParsing
    $rel = $idx | Where-Object { $_.lts -and ([int]($_.version.TrimStart('v').Split('.')[0]) -ge 22) } | Select-Object -First 1
    if (-not $rel) { throw 'Node.js 판 목록을 읽지 못했어요.' }
    $arch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'x64' }
    $name = "node-$($rel.version)-win-$arch"
    $zip = Join-Path $env:TEMP "$name.zip"
    Invoke-WebRequest -Uri "https://nodejs.org/dist/$($rel.version)/$name.zip" -OutFile $zip -UseBasicParsing
    $sums = (Invoke-WebRequest -Uri "https://nodejs.org/dist/$($rel.version)/SHASUMS256.txt" -UseBasicParsing).Content
    $line = ($sums -split "`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ -match "\s$([regex]::Escape($name)).zip$" } | Select-Object -First 1)
    if (-not $line -or ($line -split '\s+')[0].ToLower() -ne (Sha $zip)) { throw 'Node.js 파일 확인(SHA-256)에 실패했어요.' }
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
    $latest = ([string](Invoke-WebRequest -Uri "$Base/VERSION" -UseBasicParsing).Content).Trim()
    if ($latest -and $latest -ne $have) {
      Say 'lecpage PC 프로그램 새 판을 받는 중이에요.'
      $zip = Join-Path $env:TEMP 'lecpage-studio.zip'
      Invoke-WebRequest -Uri "$Base/lecpage-studio.zip" -OutFile $zip -UseBasicParsing
      $want = (([string](Invoke-WebRequest -Uri "$Base/lecpage-studio.zip.sha256" -UseBasicParsing).Content).Trim() -split '\s+')[0].ToLower()
      if ((Sha $zip) -ne $want) { throw '받은 파일 확인(SHA-256)에 실패했어요.' }
      $tmp = Join-Path $LP 'studio-new'
      Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
      Expand-Archive -LiteralPath $zip -DestinationPath $tmp -Force
      Remove-Item -LiteralPath $app -Recurse -Force -ErrorAction SilentlyContinue
      Move-Item -LiteralPath $tmp -Destination $app
      Remove-Item -LiteralPath $zip -Force -ErrorAction SilentlyContinue
    }
  } catch {
    if (-not (Test-Path (Join-Path $app 'skills'))) { throw "lecpage PC 프로그램을 받지 못했어요($($_.Exception.Message))." }
    Say '새 판을 확인하지 못해 있던 판으로 켜요.'
  }
  $self = Join-Path $LP 'lecpage-studio.cmd'
  try { if ($env:LECPAGE_SELF -ne $self) { Copy-Item -LiteralPath $env:LECPAGE_SELF -Destination $self -Force } } catch { }
  $env:LECPAGE_LAUNCHER = $self
  $cli = Join-Path $app 'skills\lecpage\scripts\lecpage.mjs'
  $a = @('studio')
  if ("$env:LECPAGE_ARGS" -match '--autostart') { $a += '--autostart' }
  & $node $cli @a
  exit $LASTEXITCODE
} catch {
  Say ''
  Say "문제가 생겼어요: $($_.Exception.Message)"
  Say '인터넷 연결을 확인하고 이 파일을 다시 실행해 주세요. 계속 안 되면 lecpage.com 도움말의 [쓰던 AI로]로 만들 수 있어요.'
  exit 1
}
