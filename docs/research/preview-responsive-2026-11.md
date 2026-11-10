# 미리 보기 기기 크기와 화면 배치 기준(2026-11)

- 조사일: 2026-11-10. 대상: 편집기 미리 보기(기기 크기·배율·회전·전체 화면), 앱 화면 배치, 한국어 줄바꿈.
- 방법: 공개 소스와 npm 패키지에서 값을 직접 읽음(Chrome DevTools, Responsively, Primer, androidx, Flutter, KRDS, 토스 TDS, MDN 호환표). 이 환경에서 developer.chrome.com·m3.material.io·developer.apple.com·help.webflow.com·gs.statcounter.com·tossmini-docs.toss.im 등은 열리지 않아, 검색 결과 요약으로만 본 값에는 **(검색)** 표시. 한국어 줄바꿈은 Chrome 153(헤드리스, 글꼴 WenQuanYi Zen Hei)에서 직접 잼.
- 조사 전 lecpage: 'PC'는 패널 폭 그대로 그려 실제 PC 폭이 아니었고, '휴대폰'은 390px 고정, 배율·회전·전체 화면 없음. 만든 사이트의 경계는 600·900·1024px(`skills/lecpage/engine/runtime/lecpage.css`).
- 적용(2026-11): 모니터 1920×1080 · 노트북 1536×864(기본) · 태블릿 820×1180 · 휴대폰 360×780 · 맞춤. 고른 크기로 그리고 줄여 보여 주며 크기·배율 표시, 태블릿·휴대폰 돌리기, 크게 보기(Esc). 고르는 단추가 5개를 넘지 않게 아이폰 390×844는 따로 두지 않음(360에서 안 깨지면 390도 대부분 괜찮음). `app/src/components/Preview.jsx`

## 1. 도구별 미리 보기

| 도구 | 프리셋(CSS px) | 맞춤 배율·% 표시 | 회전 | 전체 화면 | 기본 |
|---|---|---|---|---|---|
| Chrome DevTools | 폭 막대: 320 Mobile S·375 M·425 L·768 Tablet·1024 Laptop·1440 Laptop L·2560 4K. 기기 목록 기본 노출: iPhone SE 375×667, iPhone 16 393×852, 16 Pro Max 440×956, Pixel 9·10 412×924, Galaxy A55 360×800, Z Fold 6 412×968, iPad Mini 768×1024, iPad Pro 13 1032×1376 | 'Fit to window'가 기본값, 고정 50·75·100·125·150·200%. 맞춤일 땐 % 대신 'Fit to window' 글자만 보임 | 버튼 | 없음 | Responsive(폭·높이 입력, 50~9999) |
| Webflow | Base(데스크톱) 992 이상, Tablet ≤991, Mobile landscape ≤767, Mobile portrait ≤479, 큰 화면 1280·1440·1920 추가 | 캔버스 폭(px)·줌(%)을 직접 지정. 화면보다 넓은 경계는 줄여서 맞춤 | 없음(가로 휴대폰은 따로 경계) | Preview 모드 | Base |
| Framer | Desktop 1200·Tablet 810·Phone 390 | 줄이지 않음. 창보다 넓은 경계는 미리 보기가 꺼짐 | 확인 못 함 | 미리 보기 창 | Desktop |
| Wix | Studio: 데스크톱 1001 이상(캔버스 1280)·태블릿 751~1000·모바일 320~750. 클래식 모바일은 viewport `width=320` | 확인 못 함 | 확인 못 함 | Preview | 데스크톱 |
| Squarespace | 데스크톱·태블릿·휴대폰 아이콘(폭은 공개 안 함) **(검색)** | 확인 못 함 | 확인 못 함 | 확인 못 함 | 확인 못 함 |
| Canva | 편집 화면 옆 'Mobile Preview' 패널이 고칠 때마다 바로 바뀜 | — | — | — | 데스크톱 편집 |
| Responsively | 기본 세트 iPhone 12 Pro 390×844 + iPad 768×1024 + MacBook Pro 1440×900을 나란히. 기기 30종 넘음 | 25~200% 단계. 여러 기기 55%, 한 기기 100%가 기본. 기기마다 이름·크기 표시 | 전체 또는 기기별(휴대 기기만) | 한 기기 보기 | 3종 동시 |
| Polypane | Mobile·Tablet·Desktop·Other 묶음(기본 폭은 확인 못 함) | 전체 줌 슬라이더로 모든 창을 화면에 맞추거나 100% **(검색)** | 확인 못 함 | 확인 못 함 | 여러 창 |
| Figma 프로토타입 | 프레임 크기에 맞는 기기를 고름(iPhone 15 Pro Max 프레임 → 같은 기기) | 발표 보기: 너비·높이 맞춤(키우지는 않음)·화면 채우기·실제 크기(100%) **(검색)** | 세로/가로 설정 | 발표 보기 | 프레임 따라감 |

출처: DevTools [EmulatedDevices.ts](https://github.com/ChromeDevTools/devtools-frontend/blob/main/front_end/models/emulation/EmulatedDevices.ts)·[DeviceModeView.ts](https://github.com/ChromeDevTools/devtools-frontend/blob/main/front_end/panels/emulation/DeviceModeView.ts)·[DeviceModeToolbar.ts](https://github.com/ChromeDevTools/devtools-frontend/blob/main/front_end/panels/emulation/DeviceModeToolbar.ts) · Webflow [경계](https://help.webflow.com/hc/en-us/articles/33961300305811)·[큰 화면 경계](https://webflow.com/feature/design-for-even-larger-screens-with-3-new-breakpoints)·[캔버스 크기](https://webflow.com/feature/resize-the-designer-canvas-to-preview-site-on-larger-screens) **(검색)** · Framer [경계](https://www.framer.com/marketplace/tutorials/framer-breakpoints/)·[미리 보기](https://www.framer.com/help/articles/how-to-preview-your-site/)·[꺼진 경계](https://www.framer.com/help/articles/breakpoint-preview-disabled/) **(검색)** · Wix [Studio 경계](https://www.wix.com/studio/academy/tutorials/how-to-work-with-breakpoints)·[모바일 viewport](https://support.wix.com/en/article/viewport-configuration-for-mobile-devices) **(검색)** · [Canva](https://www.canva.com/help/publishing-canva-websites/) **(검색)** · Responsively [deviceList.ts](https://github.com/responsively-org/responsively-app/blob/main/desktop-app/src/common/deviceList.ts)·[renderer](https://github.com/responsively-org/responsively-app/blob/main/desktop-app/src/renderer/store/features/renderer/index.ts) · [Polypane](https://polypane.app/docs/global-zoom/) · [Figma](https://help.figma.com/hc/en-us/articles/21158597546391)

- 맞춤 배율은 사실상 표준이다. 배율 숫자를 보여 주는 도구(Webflow·Responsively)는 화면이 왜 작게 보이는지 바로 알 수 있다.
- 회전은 휴대 기기에만 붙는다(Responsively는 휴대 기기만 돌리고, Webflow는 가로 휴대폰을 경계 하나로 둠).
- 기본은 대부분 데스크톱이다. Responsively만 세 기기를 한꺼번에 보여 준다.

## 2. 한국 화면 통계(StatCounter, 검색)

- 휴대폰(2026-08): 414×896 19.76%, 384×832 10.19%, 360×780 9.27%, 412×892 7.32%, 390×844 5.33%, 412×915 2.99%. 393×852는 6위 밖. [출처](https://gs.statcounter.com/screen-resolution-stats/mobile/south-korea)
- 데스크톱(2026-08): 1920×1080 37.4%, 2560×1440 14.95%, 1536×864 4.81%. 같은 표에 384×832·360×780이 섞여 나와 분류가 깔끔하지 않다. [출처](https://gs.statcounter.com/screen-resolution-stats/desktop/south-korea)
- 태블릿(2026-09): 1205×753 6.64%, 820×1180 4.11%, 1280×800 3.72%, 768×1024 3.59%. [출처](https://gs.statcounter.com/screen-resolution-stats/tablet/south-korea)
- 모두 screen 크기다. 실제 viewport 높이는 주소창·탭만큼 작다.
- 414×896(아이폰 XR·11 크기)이 1위인 까닭은 확인 못 함. 최신 아이폰 크기가 아니어서 그대로 믿기 어렵다.
- 기기별 값(DevTools 목록): 아이폰 12~14·16e 390×844, 14 Pro~16 393×852, 16 Pro 402×874, 16 Pro Max 440×956. 갤럭시 S20 Ultra 412×915, A51/71 412×914, A55 360×800, S8+ 360×740, Z Fold 5 344×882. 갤럭시 S24·S25 기본형은 사이트마다 360×780과 384×832로 갈려 확정 못 함([yesviz](https://yesviz.com/devices/samsung-s25/) 등 제3자). 아이폰 17·17 Pro 402×874, 17 Pro Max 440×956, Air 420×912도 제3자 값([yesviz](https://yesviz.com/devices/iphone-17/)).

## 3. lecpage 프리셋 제안

| 이름 | CSS 크기 | 까닭 |
|---|---|---|
| 모니터 | 1920×1080 | 한국 데스크톱 1위(37.4%). 강의실 화면과 강사 콘솔 확인용 |
| 노트북 | 1536×864 | 1920×1080 화면을 125%로 쓸 때의 값(1920÷1.25). 한국 데스크톱 상위. 높이가 낮아 첫 화면에 무엇이 들어오는지 보기 좋음 |
| 태블릿 | 820×1180, 돌리면 1180×820 | 한국 태블릿 2위(4.11%, 아이패드 10세대·Air). 세로는 사이트의 600~899 배치, 가로는 1024 이상 배치를 확인 |
| 갤럭시 | 360×780 | 한국 상위권(9.27%) 가운데 가장 좁음. 여기서 안 깨지면 384·390·412도 대부분 괜찮음. 휴대폰 기본값 |
| 아이폰 | 390×844 | 한국 5.33%, 아이폰 12~14·16e. 지금 휴대폰 보기 폭과 같아 기존 확인 결과를 그대로 씀 |

- 384×832(10.19%)는 360과 390 사이라 따로 두지 않는다. 412×915는 2.99%.
- 기본 기기: 노트북(맞춤). 편집은 PC에서 하고, 맞춤 배율이 모니터보다 덜 작아진다. 마지막 선택은 브라우저에 기억.
- 배율: 맞춤이 기본이고 맞춤일 때도 %를 보인다("맞춤 · 52%"). 메뉴는 맞춤·50·75·100%. 맞춤 = min(1, 남은 폭÷기기 폭, 남은 높이÷기기 높이), 패널 크기가 바뀌면 다시 계산(ResizeObserver).
- 회전 버튼은 태블릿·휴대폰에서만. 전체 화면은 기기 틀 없이 창 전체(1:1)로 열고 Esc로 닫는다.
- 틀 위에 "노트북 · 1536×864 · 52%" 한 줄. iframe은 기기 크기 그대로 그리고 줄이기만 한다.

```css
.stage{width:calc(var(--w)*var(--s)*1px);height:calc(var(--h)*var(--s)*1px);overflow:hidden}
.stage iframe{width:calc(var(--w)*1px);height:calc(var(--h)*1px);transform:scale(var(--s));transform-origin:0 0;border:0}
```

## 4. 화면 배치 기준

**간격**: Material 3은 작은 요소 4dp·큰 요소 8dp 격자, 바깥 여백 compact 16dp·medium 이상 24dp **(검색)**, 창 나눔 간격 24dp([Compose 소스](https://github.com/androidx/androidx/blob/androidx-main/compose/material3/adaptive/adaptive-layout/src/commonMain/kotlin/androidx/compose/material3/adaptive/layout/PaneScaffoldDirective.kt)). Primer는 2·4·6·8·12·16·20·24·28·32·36·40·44·48·64·80·96·112·128px([size.json5](https://github.com/primer/primitives/blob/main/src/tokens/base/size/size.json5)). KRDS는 1rem=10px에 0·1·2·4·6·8·10·12·16·20·24·28·32·36·40·44·48·56·64·72·80·96px([krds-uiux 1.1.0](https://www.npmjs.com/package/krds-uiux)). Geist는 gap이 4px 격자라는 것만 확인 **(검색)**([Geist](https://vercel.com/geist/grid)).
→ 규칙: 여백·간격은 4의 배수만(테두리 1·2px 제외). 점검은 CSS에서 4의 배수가 아닌 px 찾기.
```css
:root{--sp-1:4px;--sp-2:8px;--sp-3:12px;--sp-4:16px;--sp-6:24px;--sp-8:32px;--sp-12:48px}
```

**정렬**: 공식 수치가 있는 건 컨트롤 크기뿐이다. Primer 컨트롤 높이 24·28·32·40·48px, 같은 줄 간격은 작은 크기 4px·중간 이상 8px, 중간 크기 좌우 안쪽 여백 12px([size.json5](https://github.com/primer/primitives/blob/main/src/tokens/functional/size/size.json5)). lecpage 규칙: 한 툴바는 높이 하나, 한 영역의 왼쪽 끝은 하나, 아이콘과 글자는 `align-items:center`.

**경계(창 크기 등급)**
| 체계 | 경계 |
|---|---|
| Material 3 | compact <600 · medium 600~839 · expanded 840~1199 · large 1200~1599 · extra-large ≥1600(dp) [WindowSizeClass.kt](https://github.com/androidx/androidx/blob/androidx-main/window/window-core/src/commonMain/kotlin/androidx/window/core/layout/WindowSizeClass.kt) |
| Apple HIG | 숫자 없이 compact·regular 두 등급. 아이폰 세로는 가로 compact, 아이패드 전체 화면은 가로·세로 regular, 분할 화면에선 compact가 될 수 있음 **(검색)** [Layout](https://developer.apple.com/design/human-interface-guidelines/layout) |
| Primer | 320·544·768·1012·1280·1400. React 반응형 값은 narrow <768 · regular ≥768 · wide ≥1400 [breakpoints.json5](https://github.com/primer/primitives/blob/main/src/tokens/functional/size/breakpoints.json5), [primer/react](https://github.com/primer/react/blob/main/packages/react/src/hooks/useResponsiveValue.ts) |
| KRDS | 360·768·1024·1280·1440 (`_variables_for_code.scss`) |
| Geist·토스 TDS | 확인 못 함(토스는 모바일 앱 전용 문서) |

**툴바·세그먼트**: 선택지는 2~5개([Flutter SegmentedButton](https://api.flutter.dev/flutter/material/SegmentedButton/SegmentedButton.html)), 기기 5종은 이 안에 든다. Primer SegmentedControl은 768 미만에서 라벨을 숨기고 아이콘만(`hideLabels`) 쓰거나 드롭다운(`dropdown`)으로 바꾸고, 아이콘만일 땐 `aria-label`과 툴팁이 필수, 선택 상태는 `aria-pressed`, 크기는 small 28·medium 32px([소스](https://github.com/primer/react/tree/main/packages/react/src/SegmentedControl)).
```css
.seg{display:inline-flex;gap:4px}
.seg button{min-height:32px;padding-inline:12px;white-space:nowrap}
@media (max-width:767.98px){.seg .label{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}}
```

**최소 터치 크기**: WCAG 2.2 2.5.8(AA) 24×24 CSS px, 작으면 24px 원끼리 겹치지 않게 띄움 / 2.5.5(AAA) 44×44([Understanding 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)). Apple 44×44pt **(검색)**([HIG](https://developer.apple.com/design/human-interface-guidelines/accessibility)). Material 48×48dp(Flutter `kMinInteractiveDimension = 48.0`, [constants.dart](https://github.com/flutter/flutter/blob/master/packages/flutter/lib/src/material/constants.dart)). Primer 터치 44px·마우스 16px(`control.minTarget`). KRDS 버튼 높이 32·40·48·56·64px.
→ 편집기: 마우스 32px 이상, 터치 기기 44px.
```css
.btn,.seg button{min-height:32px}
@media (pointer:coarse){.btn,.seg button{min-height:44px;min-width:44px}}
```

## 5. 한국어 줄바꿈과 글줄(지원 버전은 [MDN 호환표](https://github.com/mdn/browser-compat-data) 2026-11)

1. **어절 단위로 끊기**: `word-break: keep-all`(Chrome 44·Firefox 15·Safari 9). KRDS도 body에 `keep-all` + `word-wrap: break-word`.
2. **`overflow-wrap: anywhere` vs `break-word`**: anywhere로 생긴 끊을 자리는 min-content 계산에 들어가고 break-word는 안 들어간다([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/overflow-wrap)). 240px flex·grid 줄에서 잰 값: 긴 URL은 break-word 556px(넘침)·anywhere 184px, 띄어쓰기 없는 "초등학교교사직무연수운영계획안최종본"은 288px(넘침)·184px. keep-all을 쓰면 긴 어절이 안 끊기므로 꼭 함께 둔다(anywhere: Chrome 80·Firefox 65·Safari 15.4).
   ```css
   body{word-break:keep-all;overflow-wrap:break-word}
   .row>*,.grid>*{min-width:0;overflow-wrap:anywhere}
   ```
3. **제목 균형**: `text-wrap: balance`(Chrome 114·Firefox 121·Safari 17.5). Chromium은 6줄, Firefox는 10줄 이하만 적용([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/text-wrap-style)).
4. **본문 끝줄**: `text-wrap: pretty`(Chrome 117·Safari 26, Firefox 미지원). Chrome은 끝줄 한 단어를 두 단어 이상으로 맞추고([Intent to Ship](https://groups.google.com/a/chromium.org/g/blink-dev/c/rwBWqqOB_ag)) 마지막 4줄만 손본다 **(검색)**. 잰 결과: keep-all 없이 pretty만 주면 한국어는 그대로, keep-all과 함께 주면 한 어절 끝줄이 두 어절이 됨("정리합니다." → "방법을 정리합니다.", "꼭" → "봅니다 꼭").
   ```css
   h1,h2,h3,.title{word-break:keep-all;text-wrap:balance}
   p,li{word-break:keep-all;text-wrap:pretty}
   ```
5. **`word-break: auto-phrase`**: Chrome 119부터, 호환표 메모상 `ko`는 ICU 규칙을 씀. 잰 결과 keep-all과 똑같았고 Safari는 Technology Preview만, Firefox는 미지원이라 keep-all을 쓴다.
6. **한 어절만 남는 끝줄**(Firefox·짧은 문구 대비): 엔진이 제목·버튼·카드 문구에서 마지막 어절이 2글자 이하면 그 앞 공백을 U+00A0로 바꾼다. 본문은 4번으로 충분.
7. **행간**: KRDS 본문 1.5(`--krds-line-height-base`). 토스 TDS는 11~18px 글자가 1.5배(16→24, 17→25.5), 그 위는 +9~10px(24→33, 30→40, 42→52)([@toss/tds-typography](https://www.npmjs.com/package/@toss/tds-typography)). [klreq](https://w3c.github.io/klreq/)는 160%를 예로 듦. WCAG 1.4.12는 사용자가 행간을 1.5배로 늘려도 잘리지 않을 것을 요구하므로 글 상자 높이를 고정하지 않는다([Understanding 1.4.12](https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html)).
   ```css
   body{line-height:1.5} .prose p{line-height:1.6}
   h1,h2,h3{line-height:1.3}
   ```
8. **버튼 라벨 한 줄**: `white-space: nowrap`(KRDS `.krds-btn`도 같음). 200px 줄에 '미리 보기·전체 화면·내려받기'를 두고 잰 결과: nowrap 없으면 두 줄(높이 46px), keep-all만으론 띄어쓰기에서 끊겨 여전히 두 줄, nowrap이면 한 줄(25px)이지만 270px로 넘침. 넘칠 때 어디서 줄을 바꿀지 함께 정해야 한다.
   ```css
   .btn{white-space:nowrap;flex:none}
   .toolbar{display:flex;flex-wrap:wrap;gap:8px} /* 또는 좁을 때 라벨 숨김(4장) */
   ```

## 6. 확인 못 한 것
- Polypane 기본 창 폭, Framer·Wix·Squarespace·Polypane 회전, Squarespace 휴대폰 폭, Geist 경계·간격, 토스 TDS 간격·버튼 높이, Apple HIG 원문(44pt는 검색 요약).
- StatCounter 원문 표. 검색 요약 값이라 위 사이트가 열리면 다시 맞춰 본다.
