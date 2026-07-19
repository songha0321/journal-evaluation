# 시대인재 Design System

> 시대인재 패밀리사이트를 위한 디자인 시스템.
> 브랜드 가이드라인과 디지털 UI 토큰·컴포넌트 규격을 한 문서에 정의합니다.

**Version** 2.0 · **Typeface** Pretendard · **운영** 주식회사 하이컨시(HICONSY)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Design Principles](#2-design-principles)
3. [Brand](#3-brand)
4. [Foundations](#4-foundations)
5. [Surfaces](#5-surfaces)
6. [Components](#6-components)
7. [Patterns](#7-patterns)
8. [Content & Voice](#8-content--voice)
9. [Accessibility](#9-accessibility)
10. [Assets & Resources](#10-assets--resources)
11. [Changelog](#11-changelog)

---

## 1. Overview

### 1.1 목적

이 문서는 시대인재 패밀리사이트 전반에서 일관된 브랜드·UI를 유지하기 위한 단일 기준점입니다. 디자이너와 개발자가 동일한 토큰과 컴포넌트 규격을 공유하도록 합니다.

### 1.2 적용 범위

| 사이트 | 도메인 | 성격 | 표면(Surface) |
| --- | --- | --- | --- |
| 시대인재 학원 | `sdij.com/aca` | 학원 본 사이트 | Marketing |
| 시대인재N | `sdij.com/sdn` | 온라인·N 라인 | Marketing |
| 시대인재 재수종합 | `sdijc.com` | 재수종합반 | Marketing |
| 시대인재 BOOKS | `sdijbooks.com` | 교재·출판 | Marketing |
| 운영 관리자 | `*-admin.hiconsysvc.com` | 내부 관리 콘솔 | Application |

콘텐츠는 사이트마다 다르지만 로고·컬러·타이포그래피·컴포넌트는 본 문서를 공유합니다.

### 1.3 출처 표기

각 항목은 출처를 다음 태그로 구분합니다.

| 태그 | 의미 |
| --- | --- |
| `[브랜드]` | 브랜드 가이드라인 원본(.ai) 확정 규정 — 임의 변경 금지 |
| `[관측]` | 라이브 사이트·관리자 화면에서 직접 확인된 값 |
| `[제안]` | 시스템 일관성을 위해 파생·정의한 값 — 운영하며 보완 가능 |

원본 자산: `시대인재_심볼_로고타입_국문.ai`, `시대인재_로고타입_영문.ai`, 공개 사이트 캡처(메인·시간표·시대N 백과사전), 관리자 콘솔 캡처(대시보드·수강생관리·문자발송).

---

## 2. Design Principles

시대인재 패밀리사이트가 공통으로 따르는 4가지 원칙입니다.

**절제 (Restraint).** 색과 장식을 최소화하고 화이트 스페이스로 위계를 만듭니다. 공개 사이트는 화이트·블랙·그레이의 모노크롬을 기본으로 합니다.

**명료 (Clarity).** 정보는 직설적으로 전달합니다. 큰 타이포와 분명한 대비로 핵심을 먼저 보여줍니다.

**신뢰 (Trust).** 교육 브랜드로서 과장 없는 톤을 유지합니다. 차분하고 정제된 표현을 사용합니다.

**위계 (Hierarchy).** 크기·굵기·여백의 단계로 중요도를 표현하며, 강조색은 화면당 한 곳에 집중합니다.

---

## 3. Brand

### 3.1 Logo

`[브랜드]`

| 구분 | 설명 | 용도 |
| --- | --- | --- |
| Symbol | 삼각형 기하 심볼 | 파비콘, 앱 아이콘, 워터마크 |
| Symbol + Logotype (국문) | 심볼 + `시대인재` | 기본 로고. 대부분의 매체에 우선 사용 |
| Logotype (국문) | `시대인재` 워드마크 단독 | 좁은 영역 |
| Logotype (영문) | `sdij` 워드마크 | 영문·글로벌 매체 |

**서브 브랜드 락업** — 영문 워드마크 `sdij` 기준: `sdij BOOKS`, `sdij N 대치`, `sdij N 재수종합`.

`[관측]` 라이브 사이트 헤더에서는 국문 로고타입 옆에 패밀리사이트 스위처(`시대인재 ｜ N ｜ C ｜ BOOKS`)를 함께 배치합니다. 현재 사이트는 N(시대인재N)/C(재수종합)/BOOKS로 표기됩니다.

### 3.2 Clear Space & Minimum Size

`[브랜드]`

- **Clear Space** — 로고 내 `O`(또는 심볼 원형)의 높이를 `1X`로 정의. 사방에 최소 `1X` 여백 확보.
- **최소 크기** — 높이 3mm(print) / 20px(screen) 이하로 축소 금지.
- 화면용 최소 표기: 심볼 단독 16×16px(파비콘), 24×24px(앱 바) 이상. `[제안]`

### 3.3 Logo Color

`[브랜드]` 기본 컬러 로고 사용을 권장하며, 배경 명도에 따라 가시성이 확보되도록 적용합니다.

| 배경 | 로고 색상 |
| --- | --- |
| 화이트 / 라이트 그레이 | Ink `#231F20` |
| SDIJ Blue `#0077C1` | White `#FFFFFF` |
| Black `#000000` | White `#FFFFFF` |

### 3.4 Logo Misuse — Don't

`[브랜드]`

- 임의로 늘리거나 각도를 조절하지 않습니다.
- 구성 요소의 형태·간격을 변형하지 않습니다.
- 그라데이션·임의 색 조합을 사용하지 않습니다.
- 복잡한 배경 위, 최소 크기 미만으로 사용하지 않습니다.
- Drop Shadow / Outer Glow / Inner Glow 효과를 사용하지 않습니다.

### 3.5 Owl Motif (부엉이)

`[관측]` 부엉이는 시대인재의 상징 모티브입니다(예: 콘텐츠 채널 '부엉이포스트'). "새벽에 비상하는 부엉이"라는 브랜드 내러티브를 가집니다. 보조 그래픽·일러스트 모티브로 활용하되 §3.1 정식 로고를 대체하지 않으며, §3.4 Don't 원칙에 준해 절제해 사용합니다.

---

## 4. Foundations

### 4.1 Color

#### Brand Colors `[브랜드]`

| Token | HEX | 설명 |
| --- | --- | --- |
| `brand/blue` | `#0077C1` | SDIJ Blue. 로고 공식 컬러 |
| `brand/ink` | `#231F20` | 로고 다크. 텍스트 최상위 톤 |

> 라이브 공개 사이트는 모노크롬으로 운용되어 `brand/blue`가 거의 노출되지 않습니다. 블루는 로고·링크·소수 강조에 한해 사용하고, 화면의 주조색은 아래 Neutral이 담당합니다.

#### Neutral `[관측]` + `[제안]`

순수 그레이 스케일. `neutral-0`·`neutral-50`·`neutral-1000`은 라이브 사이트에서 확인된 값(`#FFFFFF`·`#F5F5F5`·`#000000`)이며 중간 단계는 보간 제안값입니다.

| Token | HEX | 용도 |
| --- | --- | --- |
| `neutral-0` | `#FFFFFF` | 페이지 배경, 카드 표면 |
| `neutral-50` | `#F5F5F5` | 섹션·패널 배경 (관측) |
| `neutral-100` | `#EDEDED` | 입력 비활성 배경 |
| `neutral-200` | `#E0E0E0` | 보더, 디바이더 |
| `neutral-300` | `#CACACA` | 입력 보더 |
| `neutral-400` | `#A6A6A6` | placeholder |
| `neutral-500` | `#808080` | 보조 텍스트 |
| `neutral-600` | `#5E5E5E` | 캡션 |
| `neutral-700` | `#424242` | 본문 보조 |
| `neutral-800` | `#2B2B2B` | 본문 |
| `neutral-900` | `#141414` | 제목 |
| `neutral-1000` | `#000000` | 핵심 텍스트, Marketing 주요 액션 (관측) |

#### Console `[관측]`

관리자 콘솔(Application) 전용 다크 톤.

| Token | HEX | 용도 |
| --- | --- | --- |
| `console/chrome` | `#32373D` | 관리자 상단 헤더·내비 바 |
| `console/section` | `#F2F3F5` | 카드 헤더, 테이블 헤더 배경 |

#### Accent `[관측]`

| Token | HEX | 용도 |
| --- | --- | --- |
| `accent/coral` | `#FC5163` | 관리자 주요·파괴적 액션(발송·삭제) |
| `accent/coral-hover` | `#E63E54` | coral hover |
| `accent/coral-pressed` | `#C9344A` | coral pressed |
| `accent/indigo` | `#544E8C` | 관리자 보조 액션(파일 선택 등) |

#### Status `[관측]` + `[제안]`

관리자 통계·상태 표시에서 확인된 색을 정리한 의미 색상 세트.

| Token | HEX | 배경(`-bg`) | 용도 |
| --- | --- | --- | --- |
| `status/success` | `#1F9D3D` | `#E8F6EC` | 성공·정상 |
| `status/info` | `#0077C1` | `#EAF4FB` | 안내 (= brand/blue) |
| `status/warning` | `#F39A0C` | `#FDF1DC` | 경고·주의 |
| `status/error` | `#E5343B` | `#FCE9E9` | 오류·미처리·결석 등 경고 텍스트 |

#### 명도 대비

`brand/blue` 대비 화이트 4.76:1 — 일반 텍스트 AA 통과(작은 텍스트는 `neutral` 계열 권장). `neutral-1000`·`#231F20`는 화이트 대비 16:1 이상으로 본문에 안전합니다.

### 4.2 Typography

#### Typeface

| 역할 | 서체 | 출처 |
| --- | --- | --- |
| Logotype / Brand Display | 전용 디스플레이 서체 | `[브랜드]` 로고 전용 |
| UI·본문 전체 | **Pretendard** | `[브랜드]` 보조 서체로 명시, 라이브 사이트 본문 적용 |

```css
font-family: "Pretendard", "Pretendard Variable", -apple-system,
  "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
```

`[관측]` 공개 사이트는 영문·국문 모두 대형 헤드라인을 적극 사용합니다(예: "The New Paradigm Navigate To Perfection", "학습의 흐름을 재정의"). 헤드라인은 굵기를 키우기보다 **크기와 여백**으로 임팩트를 만듭니다.

#### Weight

| Token | Pretendard | 용도 |
| --- | --- | --- |
| `regular` | 400 | 본문 |
| `medium` | 500 | 라벨, 내비 메뉴 |
| `semibold` | 600 | 소제목, 버튼, 헤드라인 |
| `bold` | 700 | 제목 |
| `black` | 900 | 디스플레이 강조 (브랜드 사용 가중치) |

#### Type Scale `[제안]` (라이브 사이트 위계 반영)

| Token | Size / Line-height | Weight | 용도 |
| --- | --- | --- | --- |
| `display-xl` | 72 / 80 | semibold–bold | 메인 히어로 헤드라인 |
| `display-lg` | 56 / 64 | semibold–bold | 페이지 대제목 |
| `display-md` | 40 / 48 | semibold | 섹션 헤드라인 |
| `h1` | 32 / 40 | bold | 페이지 제목 |
| `h2` | 28 / 36 | bold | 섹션 제목 |
| `h3` | 24 / 32 | semibold | 하위 제목 |
| `h4` | 20 / 28 | semibold | 카드 제목 |
| `body-lg` | 18 / 30 | regular | 강조 본문 |
| `body` | 16 / 26 | regular | 기본 본문 |
| `body-sm` | 14 / 22 | regular | 보조 본문, 내비 |
| `caption` | 12 / 18 | medium | 캡션, 메타정보 |

- 한글 가독성을 위해 line-height는 글자 크기의 1.4~1.6배 유지.
- 자간: 디스플레이·제목 `-0.01em`, 본문 `0`.

### 4.3 Spacing

`4px` 기준 배수 스케일.

| Token | px | Token | px |
| --- | --- | --- | --- |
| `space-1` | 4 | `space-8` | 32 |
| `space-2` | 8 | `space-10` | 40 |
| `space-3` | 12 | `space-12` | 48 |
| `space-4` | 16 | `space-16` | 64 |
| `space-5` | 20 | `space-20` | 80 |
| `space-6` | 24 | `space-24` | 96 |

`[관측]` 공개 사이트는 섹션 간 여백을 크게 사용합니다. 마케팅 페이지 섹션 간격은 `space-20`~`space-24` 이상을 기본으로 합니다.

### 4.4 Layout & Grid `[제안]`

| 항목 | 값 |
| --- | --- |
| 콘텐츠 최대폭 | `1200px` (마케팅) / `1440px` (관리자 와이드) |
| 그리드 | 12 컬럼 |
| 거터(gutter) | `24px` |
| 페이지 좌우 여백 | `24px`(mobile) / `40px` 이상(desktop) |

**브레이크포인트**

| Token | min-width |
| --- | --- |
| `sm` | 640px |
| `md` | 768px |
| `lg` | 1024px |
| `xl` | 1280px |
| `2xl` | 1536px |

### 4.5 Border Radius `[관측]` + `[제안]`

| Token | px | 용도 |
| --- | --- | --- |
| `radius-xs` | 4 | 배지, 작은 태그 |
| `radius-sm` | 6 | 입력 필드, 세그먼트 탭 |
| `radius-md` | 8 | 버튼, 카드, 정보 패널 |
| `radius-lg` | 12 | 모달, 큰 패널 |
| `radius-xl` | 16 | 히어로 카드 |
| `radius-pill` | 9999 | 필 버튼, 필터 칩 |

`[관측]` 라이브 사이트의 필터/CTA는 완전 라운드(`radius-pill`)를, 세그먼트 탭·정보 패널은 작은~중간 라운드를 사용합니다.

### 4.6 Elevation `[제안]`

`[브랜드]` 로고에는 그림자를 사용하지 않습니다. 아래는 UI 컴포넌트 한정.

| Token | 값 |
| --- | --- |
| `shadow-sm` | `0 1px 2px rgba(0,0,0,0.06)` |
| `shadow-md` | `0 4px 12px rgba(0,0,0,0.08)` |
| `shadow-lg` | `0 12px 32px rgba(0,0,0,0.12)` |

`[관측]` 마케팅 표면은 그림자보다 **보더와 여백**으로 구획을 나눕니다. 그림자는 관리자 콘솔과 모달·드롭다운에 한해 절제해 사용합니다.

### 4.7 Iconography `[제안]`

- 선형(line) 아이콘, 굵기 `1.5~2px`, 기본 사이즈 `24px`.
- 색상은 텍스트 색을 따름(`currentColor`).
- 햄버거 메뉴·드롭다운 셰브론 등 라이브 사이트에서 쓰이는 최소 UI 아이콘부터 우선 정비.

---

## 5. Surfaces

시대인재 제품은 성격이 다른 두 표면을 가지며, 각 표면은 위 Foundations 토큰을 의미 토큰으로 매핑해 사용합니다.

### 5.1 Marketing Surface — 공개 사이트

모노크롬 에디토리얼. 화이트 배경에 블랙 텍스트, 강조도 블랙.

| 의미 토큰 | 값 |
| --- | --- |
| `bg/base` | `neutral-0` |
| `bg/sunken` | `neutral-50` |
| `text/primary` | `neutral-1000` |
| `text/secondary` | `neutral-500` |
| `border/default` | `neutral-200` |
| `action/primary` | `neutral-1000` (블랙 필·탭) |
| `action/primary-text` | `neutral-0` |
| `link` | `brand/blue` |

### 5.2 Application Surface — 관리자 콘솔

차콜 크롬 + 코랄 액션. 정보 밀도가 높은 운영 화면.

| 의미 토큰 | 값 |
| --- | --- |
| `bg/base` | `neutral-0` |
| `bg/sunken` | `neutral-50` |
| `chrome/header` | `console/chrome` |
| `section/header` | `console/section` |
| `text/primary` | `neutral-900` |
| `border/default` | `neutral-200` |
| `action/primary` | `accent/coral` |
| `action/secondary` | `console/chrome` |
| `action/tertiary` | `accent/indigo` |

---

## 6. Components

토큰을 조합한 핵심 컴포넌트 규격. 상태값은 모두 위 토큰을 참조합니다.

### 6.1 Global Header `[관측]`

- 좌측: 로고 + 패밀리사이트 스위처(`시대인재 ｜ N ｜ C ｜ BOOKS`).
- 우측: 캠퍼스 선택 드롭다운(예: `대치 ▾`), 주요 메뉴, 햄버거(전체 메뉴).
- 높이 `64px`(desktop) / `56px`(mobile), 배경 `bg/base`, 하단 보더 `border/default`.
- 메뉴 텍스트 `body-sm` medium / `text/secondary`, 현재 메뉴 `text/primary` + 굵기 강조.

### 6.2 Family-site Switcher `[관측]`

패밀리사이트 간 이동 토글. 현재 사이트는 활성, 나머지는 흐린 회색(`neutral-400`)으로 표기. `N`·`C`는 작은 사각 뱃지로 처리.

### 6.3 Button

#### Marketing

| 종류 | 배경 | 텍스트 | 보더 | 형태 |
| --- | --- | --- | --- | --- |
| Primary (Pill) | `neutral-1000` | `neutral-0` | 없음 | `radius-pill` |
| Outline (Pill) | 투명 | `text/primary` | `neutral-300` 1px | `radius-pill` |
| Text | 투명 | `text/primary` | 없음 | — |

#### Application

| 종류 | 배경 | 텍스트 |
| --- | --- | --- |
| Primary | `accent/coral` | `neutral-0` |
| Secondary | `console/chrome` | `neutral-0` |
| Tertiary | `accent/indigo` | `neutral-0` |
| Destructive | `accent/coral` | `neutral-0` |

- 공통: 높이 `40px`(기본)/`48px`(large)/`32px`(small), 좌우 패딩 `space-4`, 폰트 `body` semibold.
- Disabled: 배경 `neutral-200` / 텍스트 `neutral-400`.

### 6.4 Segmented Tabs `[관측]`

`고3 / 고2 / 고1 …` 또는 `학습 시스템 / 콘텐츠 / 시그니처 / 생활 인프라` 형태의 균등 분할 탭.

- 활성 탭: 배경 `neutral-0` + 보더 `neutral-200`, 텍스트 `text/primary`.
- 비활성 탭: 배경 `neutral-50`, 텍스트 `text/secondary`.
- radius `radius-sm`, 높이 `48~56px`.

### 6.5 Filter Chip `[관측]`

시간표 하위 필터(예: `2026 고3 정규 시간표`)에 쓰이는 칩.

- 활성: 배경 `neutral-1000`, 텍스트 `neutral-0`, `radius-pill`.
- 비활성: 배경 없음, 텍스트 `text/secondary`.

### 6.6 Info Panel `[관측]`

연락처·안내 정보를 담는 라이트 그레이 박스(시간표 페이지의 전화 문의 영역).

- 배경 `bg/sunken`(`neutral-50`), radius `radius-md`, 패딩 `space-6`~`space-8`.
- 라벨은 굵게(`semibold`), 값은 `regular`. 키-값 정렬.

### 6.7 Card

- 표면 `neutral-0`, 보더 `border/default` 1px, radius `radius-md`, 패딩 `space-6`.
- 관리자 카드: 상단에 `section/header` 배경의 헤더 바 + 우측 액션(`+` 등).
- 떠 있는 카드는 보더 대신 `shadow-md` 사용(둘 중 하나만).

### 6.8 Data Table `[관측]`

관리자 콘솔 핵심 컴포넌트.

- 헤더 행 배경 `section/header`, 텍스트 `body-sm` medium.
- 셀 보더 `border/default` 1px, 행 높이 `40~44px`.
- 빈 상태: "리스트가 없습니다" 등 안내 문구를 중앙 정렬, `text/secondary`.

### 6.9 Form Controls `[관측]`

- **Input** — 배경 `neutral-0`, 보더 `neutral-300` 1px, radius `radius-sm`, 높이 `40px`, 내부 패딩 `space-3`. Focus 시 보더 `brand/blue` + 외곽선 `0 0 0 3px rgba(0,119,193,0.15)`.
- **Dropdown / Select** — Input과 동일 규격 + 셰브론 아이콘.
- **Radio / Checkbox** — 활성 시 표면색은 surface별 `action/primary`.
- **Textarea** — 우측 하단 글자 수 카운터(예: `0/2000 byte`) 노출 가능.
- placeholder `neutral-400`, 라벨 `body-sm` medium / `text/secondary`.

### 6.10 Badge / Tag

- 높이 `20~24px`, radius `radius-xs`~`radius-pill`, 폰트 `caption`.
- 상태형: `status/*-bg` 배경 + 해당 `status/*` 텍스트.

### 6.11 Divider

- `border/default` 1px 라인. 섹션 구분 시 상하 `space-8` 여백 동반.

---

## 7. Patterns

### 7.1 Hero Section `[관측]`

공개 사이트 첫 화면의 표준 패턴.

- 화이트 배경에 대형 헤드라인(`display-xl`~`display-lg`)을 좌측 정렬 또는 중앙 정렬.
- 헤드라인 외 요소는 최소화하고 여백으로 호흡을 줌.
- 보조 카피는 `body`~`body-lg` / `text/secondary`로 헤드라인과 위계 차이를 둠.

### 7.2 Page Header `[관측]`

- 페이지 제목(`display-md`~`h1`)을 좌측, 주요 액션 버튼을 우측에 배치.
- 필요 시 바로 아래 Info Panel 또는 Segmented Tabs로 연결.

### 7.3 Empty State `[관측]`

- 데이터가 없을 때 영역 중앙에 안내 문구 한 줄(`text/secondary`).
- 예: "리스트가 없습니다", "조건에 맞는 수강생이 없습니다".

---

## 8. Content & Voice

### 8.1 Brand Philosophy `[관측]`

공개 사이트가 밝히는 시대인재의 지향점:

> 정직하게 많은 시간을 공부해도 일부만 성공하는 입시 현실을 거슬러, 한 차원 다른 강의와 콘텐츠의 창조적 재배열을 통해 **Shortcut**을 실현하고, 운의 영역을 넘어 학생 각자의 **Hidden Score**를 끌어내는 **만점구조시스템**을 구현한다.

핵심 키워드 — **The New Paradigm · Navigate To Perfection · Shortcut · Hidden Score · 만점구조시스템**. 카피·메시지에서 이 개념 체계를 일관되게 사용합니다.

### 8.2 Tone of Voice

교육 브랜드로서 **신뢰감·명료함·전문성**을 핵심 인상으로 둡니다.

- **명료하게** — 군더더기 없이 핵심을 먼저. 사실과 데이터로 말합니다.
- **차분하게** — 과장·자극적 표현을 피하고 절제된 톤을 유지합니다.
- **존중하며** — 학습자를 압박하지 않고 지지하는 어조를 사용합니다.

| 권장 | 지양 |
| --- | --- |
| "성적 분석 리포트를 확인하세요." | "지금 안 보면 손해!" |
| "수업은 3월 2일에 시작합니다." | "역대급 커리큘럼 대공개!!!" |

### 8.3 Information Architecture `[관측]`

패밀리사이트 글로벌 내비게이션 기준 메뉴(사이트별 가감 가능):

- **시대인재 학원** — About SDIJ · 공지사항 · 학원시설 · 오시는길 · 강좌안내 · 시간표 · 입시 R&D 센터 · 입시설명회 · 컨설팅 · 부엉이포스트 · 채용 · 콘텐츠
- **시대인재N** — 백과사전 · 명예의 전당 · 모집요강 · 응시원서 접수

---

## 9. Accessibility

- 본문 텍스트는 배경 대비 최소 **WCAG AA 4.5:1**을 유지합니다.
- 모노크롬 특성상 색만으로 상태를 구분하지 않습니다. 텍스트·아이콘·밑줄 등 보조 단서를 함께 제공합니다.
- 인터랙티브 요소는 키보드 포커스 링(`brand/blue` 외곽선)을 제공합니다.
- 터치 타깃 최소 `44×44px`.
- 모든 이미지·아이콘에 의미 있는 대체 텍스트를 제공합니다.

---

## 10. Assets & Resources

### 10.1 Logo Files

| 파일 | 내용 |
| --- | --- |
| `시대인재_심볼_로고타입_국문.ai` | 국문 심볼+로고타입, Clear Space, Color, Partnerships, Don't |
| `시대인재_로고타입_영문.ai` | 영문 워드마크 `sdij`, 서브 락업, 타이포그래피 |

권장: `.ai` 원본과 함께 웹용 `SVG`, `PNG`(투명·1x/2x/3x), 파비콘 세트를 `/assets/logo/`로 관리.

### 10.2 Typeface

- **Pretendard** — self-host 또는 CDN 로드. Variable 폰트 사용 시 가중치 단계를 토큰과 일치시킬 것.

### 10.3 Token 운용

- 본 문서의 토큰을 디자인 툴(Variables)과 코드(CSS Custom Properties / 디자인 토큰 JSON)에 동일 이름으로 동기화합니다.
- 원시 컬러(`neutral-*` 등)는 직접 쓰지 않고 §5 의미 토큰을 통해 참조하는 것을 권장합니다.

---

## 11. Changelog

| 버전 | 변경 내용 |
| --- | --- |
| 1.0 | 브랜드 가이드라인(.ai) 기반 초기 토큰·컴포넌트 정의 |
| 1.1 | 공식 웹사이트 기반 브랜드 철학·부엉이 모티브·IA 추가 |
| 2.0 | 라이브 사이트·관리자 콘솔 화면 분석 반영. 모노크롬 Marketing 표면·Console 표면 분리, 보편적 디자인 시스템 문서 구조로 전면 재구성 |

---

## 부록 A. 후속 확인 항목

라이브 캡처 기반으로 대부분 확정했으나, 다음은 원자료가 있으면 정밀화할 수 있습니다.

| 항목 | 확정에 필요한 자료 |
| --- | --- |
| 디스플레이 헤드라인 서체 | 로고 전용 디스플레이 서체의 정확한 이름 |
| Type Scale 수치 | Figma Dev Mode의 실제 폰트 크기·행간 토큰 |
| 컴포넌트 상태값 | Figma 컴포넌트의 hover/pressed/disabled 정의 |
| 모바일 레이아웃 | 모바일 화면 캡처(현재 데스크톱 기준) |

---

*`[브랜드]` 항목은 브랜드 가이드라인 원본 규정으로 임의 변경할 수 없습니다.*
*`[관측]` 항목은 라이브 화면에서 확인된 값이며, `[제안]` 항목은 운영 데이터를 반영해 보완하세요.*
