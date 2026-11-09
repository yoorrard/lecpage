#!/usr/bin/env bash
# lecpage 교재 쪽 그림 만들기: PPTX·HWPX·DOCX·PDF(…) → PDF(LibreOffice) → PNG(pdftoppm) → WebP(cwebp, 있으면)
#
#   bash render_slides.sh <교재 파일> <출력 폴더> [dpi=110]
#
# 결과: <출력 폴더>/slide-001.webp, slide-002.webp …  (cwebp가 없으면 PIL로 webp, 그것도 없으면 .png)
# 환경 변수: KEEP_PDF=1 이면 변환한 PDF를 <출력 폴더>/slides.pdf 로 남김, WEBP_QUALITY(기본 82)
# 필요: soffice(LibreOffice, PDF가 아닐 때), pdftoppm(poppler-utils). 한글 글꼴이 설치돼 있어야 글자가 깨지지 않습니다.
set -euo pipefail

if [ $# -lt 2 ]; then
  echo "사용법: bash render_slides.sh <교재 파일> <출력 폴더> [dpi=110]" >&2
  exit 2
fi
IN="$1"
OUT="$2"
DPI="${3:-110}"
QUALITY="${WEBP_QUALITY:-82}"

if [ ! -f "$IN" ]; then echo "파일을 찾을 수 없어요: $IN" >&2; exit 2; fi
if ! command -v pdftoppm >/dev/null 2>&1; then
  echo "pdftoppm이 없어요. 설치: (Ubuntu) sudo apt-get install -y poppler-utils / (macOS) brew install poppler" >&2
  exit 3
fi

mkdir -p "$OUT"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/lecpage-render.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT

ext="$(printf '%s' "${IN##*.}" | tr '[:upper:]' '[:lower:]')"
if [ "$ext" = "pdf" ]; then
  PDF="$TMP/input.pdf"
  cp "$IN" "$PDF"
else
  SOFFICE="$(command -v soffice || command -v libreoffice || true)"
  if [ -z "$SOFFICE" ] && [ -x "/Applications/LibreOffice.app/Contents/MacOS/soffice" ]; then
    SOFFICE="/Applications/LibreOffice.app/Contents/MacOS/soffice"
  fi
  if [ -z "$SOFFICE" ]; then
    echo "LibreOffice(soffice)가 없어요. 설치하거나, 교재를 PDF로 저장해 그 PDF로 다시 실행해 주세요." >&2
    exit 3
  fi
  # 같은 사용자 프로필을 쓰는 다른 LibreOffice와 부딪치지 않도록 임시 프로필 사용
  cp "$IN" "$TMP/input.$ext"
  if ! timeout 300 "$SOFFICE" "-env:UserInstallation=file://$TMP/profile" --headless --norestore --nolockcheck \
       --convert-to pdf --outdir "$TMP" "$TMP/input.$ext" >"$TMP/soffice.log" 2>&1; then
    echo "PDF 변환에 실패했어요(LibreOffice). 교재를 PDF로 저장해 그 PDF로 다시 실행해 주세요." >&2
    tail -n 3 "$TMP/soffice.log" >&2 || true
    exit 4
  fi
  PDF="$TMP/input.pdf"
  if [ ! -s "$PDF" ]; then
    if [ "$ext" = "hwpx" ] || [ "$ext" = "hwp" ]; then
      echo "이 LibreOffice는 한글 파일을 변환하지 못했어요. 한글에서 PDF로 저장해 그 PDF로 다시 실행해 주세요." >&2
    else
      echo "PDF 변환 결과가 없어요. 교재를 PDF로 저장해 그 PDF로 다시 실행해 주세요." >&2
    fi
    exit 4
  fi
fi

pdftoppm -r "$DPI" -png "$PDF" "$TMP/p"

# 기존 그림 지우기(쪽 수가 줄었을 때 남지 않도록)
rm -f "$OUT"/slide-[0-9][0-9][0-9]*.webp "$OUT"/slide-[0-9][0-9][0-9]*.png 2>/dev/null || true

HAS_CWEBP=0; command -v cwebp >/dev/null 2>&1 && HAS_CWEBP=1
HAS_PIL=0
if [ "$HAS_CWEBP" = 0 ] && command -v python3 >/dev/null 2>&1 && python3 -c 'from PIL import Image, features; assert features.check("webp")' >/dev/null 2>&1; then HAS_PIL=1; fi

n=0
# pdftoppm 이름(p-1.png / p-01.png / p-001.png)을 쪽 번호 순서로
for f in $(ls "$TMP"/p-*.png | sed -E 's/.*p-0*([0-9]+)\.png$/\1 &/' | sort -n | cut -d' ' -f2); do
  n=$((n + 1))
  name="$(printf 'slide-%03d' "$n")"
  if [ "$HAS_CWEBP" = 1 ]; then
    cwebp -quiet -q "$QUALITY" "$f" -o "$OUT/$name.webp"
  elif [ "$HAS_PIL" = 1 ]; then
    python3 -c 'import sys; from PIL import Image; Image.open(sys.argv[1]).save(sys.argv[2], "WEBP", quality=int(sys.argv[3]), method=4)' "$f" "$OUT/$name.webp" "$QUALITY"
  else
    cp "$f" "$OUT/$name.png"
  fi
done

if [ "${KEEP_PDF:-0}" = "1" ]; then cp "$PDF" "$OUT/slides.pdf"; fi
fmt="png"; { [ "$HAS_CWEBP" = 1 ] || [ "$HAS_PIL" = 1 ]; } && fmt="webp"
echo "쪽 그림 ${n}장 → $OUT (slide-001.$fmt …)"
