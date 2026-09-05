# 프로그램 등록하기

> 사업 안에 여러 프로그램이 있고 프로그램마다 신청 방식이 다르므로,
> 프로그램을 먼저 등록해야 `/apply` 목록에 나타납니다.

⏸ **담당자용 프로그램 등록 화면은 아직 없습니다.** 신청서 항목(H-1)이 확정된 뒤에
함께 만드는 것이 순서에 맞아서 미뤄뒀습니다. 그때까지는 아래처럼 **Firebase 콘솔에서
직접** 추가하시면 됩니다.

⚠️ **먼저 보안 규칙이 적용되어 있어야 합니다** (`docs/TODO-later.md` A항목).
규칙 적용 전에는 목록을 읽을 때 오류가 납니다.

---

## Firebase 콘솔에서 추가하기

1. Firebase 콘솔 → `빌드 > Firestore Database` → **데이터** 탭
2. **컬렉션 시작** → 컬렉션 ID: **`support_programs`**
3. 문서 ID는 **자동 ID**로 두거나, 알아보기 쉽게 직접 지정
   (예: `2026-ai-lesson`) — 주소에 그대로 노출됩니다
4. 아래 필드를 추가합니다

### 필드 목록

| 필드 | 유형 | 필수 | 설명 |
|---|---|:---:|---|
| `title` | string | ✅ | 프로그램 이름 |
| `year` | **int64** | ✅ | 사업 연도 (예: `2026`). 콘솔 드롭다운에 `number` 는 없고 정수는 `int64` 입니다 |
| `participationType` | string | ✅ | **`individual`** 또는 **`group`** |
| `published` | boolean | ✅ | `true` 여야 목록에 보입니다 |
| `description` | string | | 한두 문장 소개 |
| `opensAt` | timestamp | | 접수 시작. 비우면 바로 접수중 |
| `closesAt` | timestamp | | 접수 마감. 비우면 상시 접수 |
| `maxTeamSize` | **int64** | | 단체 프로그램일 때 최대 인원 (대표자 포함) |
| `noteLabel` | string | | **자유 기재란의 이름** (예: `지원 동기`). 없으면 칸이 안 생김 |
| `noteRequired` | boolean | | 자유 기재란 필수 여부 |
| `attachmentGuide` | string | | **첨부 안내 문구**. 없으면 첨부란이 안 생김 |
| `attachmentRequired` | boolean | | 첨부 필수 여부 |
| `createdAt` | timestamp | | 등록 시각 |
| `updatedAt` | timestamp | | 수정 시각 |

### 신청서 항목은 이 두 개로 조절합니다 (D-29)

프로그램마다 신청 항목이 다른 문제를, **자유 기재란 하나 + 첨부 하나**로 흡수합니다.
코드를 고치지 않고 **프로그램 문서의 글자만 바꾸면** 됩니다.

| 원하는 것 | 넣을 필드 |
|---|---|
| 아무것도 더 안 받음 | 둘 다 비움 → "내 정보 확인 후 제출"만 남음 |
| 지원 동기를 받고 싶음 | `noteLabel` = `지원 동기` |
| 영수증을 받고 싶음 | `attachmentGuide` = `영수증을 촬영해 첨부해 주세요. 사진 또는 PDF.` |
| 둘 다 필수로 | 위에 더해 `noteRequired`·`attachmentRequired` = `true` |

자세한 배경은 `docs/07-application-form.md` 를 보세요.

### `participationType` 정하기

| 값 | 언제 | 신청 방식 |
|---|---|---|
| **`individual`** | **기본값** | 팀으로 활동하더라도 **구성원이 각자 신청** |
| `group` | 단체 프로그램 | **대표자가 팀원 명단과 함께** 신청 |

> ⚠️ **D-29로 변경**: `group` 을 골라도 지금은 **신청서가 개인 기준 한 가지**입니다.
> 팀원 명단 입력란은 만들지 않았습니다 — 개인으로 접수받고 현장에서 팀을 짜는
> 방식이 더 흔하기 때문입니다. `group` 은 상세 화면에 안내 문구를 띄우는 용도로만
> 쓰입니다. 팀원 명단을 신청 시점에 꼭 받아야 하는 프로그램이 나오면 그때 붙입니다.

---

## 예시

**개인 신청 프로그램**

```
title:              AI 수업 설계 워크숍
year:               2026
participationType:  individual
published:          true
description:        예비교원이 AI를 활용한 수업 지도안을 직접 설계해 보는 프로그램입니다.
opensAt:            2026-09-01 09:00
closesAt:           2026-09-18 18:00
```

**단체 프로그램**

```
title:              AI 교육 콘텐츠 공동 개발
year:               2026
participationType:  group
maxTeamSize:        4
published:          true
description:        팀을 이루어 AI 교육 콘텐츠를 개발합니다. 대표자가 팀을 대표해 신청합니다.
opensAt:            2026-09-01 09:00
closesAt:           2026-09-25 18:00
```

---

## 확인

`/apply` 로 접속하면 등록한 프로그램이 카드로 보입니다.

- 접수 상태(**접수 예정 / 접수중 / 접수 마감**)는 `opensAt`·`closesAt` 으로 **자동 계산**됩니다. 따로 바꾸지 않으셔도 됩니다
- 마감이 다가오면 `D-14` 처럼 남은 일수가 표시됩니다
- 마감된 프로그램은 "지난 프로그램" 아래로 내려갑니다

## 잠시 감추고 싶을 때

`published` 를 `false` 로 바꾸면 목록에서 사라집니다. 삭제하지 않아도 됩니다.

---

## 시험용 샘플 3벌

실제 프로그램이 확정되기 전에 화면을 확인하려고 만든 가짜 값입니다.
**세 개를 다 넣으면 접수중 / 접수 예정 / 지난 프로그램 세 가지 표시를 한 번에 확인**할 수 있습니다.
확인이 끝나면 문서를 지우거나 `published` 를 `false` 로 내리면 됩니다.

### 샘플 1 — 개인 신청, 접수중 (마감 임박)

문서 ID: `test-individual`

```
title              (string)     [테스트] AI 수업 설계 워크숍
year               (int64)      2026
participationType  (string)     individual
published          (boolean)    true
description        (string)     예비교원이 AI를 활용한 수업 지도안을 직접 설계해 보는 프로그램입니다.
opensAt            (timestamp)  2026-09-01 09:00
closesAt           (timestamp)  2026-09-15 18:00
```

### 샘플 2 — 단체 프로그램, 접수 예정

문서 ID: `test-group`

```
title              (string)     [테스트] AI 교육 콘텐츠 공동 개발
year               (int64)      2026
participationType  (string)     group
maxTeamSize        (int64)      4
published          (boolean)    true
description        (string)     팀을 이루어 AI 교육 콘텐츠를 개발합니다. 대표자가 팀을 대표해 신청합니다.
opensAt            (timestamp)  2026-10-01 09:00
closesAt           (timestamp)  2026-10-20 18:00
```

### 샘플 3 — 이미 마감된 프로그램

문서 ID: `test-closed`

```
title              (string)     [테스트] 2025 예비교원 AI 캠프
year               (int64)      2025
participationType  (string)     individual
published          (boolean)    true
description        (string)     지난 회차 프로그램입니다. 목록 아래쪽 "지난 프로그램"에 표시되는지 확인용입니다.
opensAt            (timestamp)  2025-07-01 09:00
closesAt           (timestamp)  2025-07-31 18:00
```

> `createdAt` · `updatedAt` 은 목록 표시에 쓰이지 않으므로 시험용에서는 **넣지 않아도 됩니다.**

### 입력할 때 자주 걸리는 것

- **유형(type)을 꼭 맞춰 주세요.** 특히
  - `year` 는 `string` 이 아니라 **`int64`** — 드롭다운에 `number` 라는 항목은 없습니다.
    정수는 `int64`, 소수는 `double` 로 나뉘어 있습니다
  - `published` 는 `"true"` 가 아니라 **`boolean`**
  - `opensAt` · `closesAt` 는 **`timestamp`** — 유형 선택창에서 timestamp 를 고르면 달력이 나옵니다
  유형이 틀리면 오류는 안 나고 **그냥 목록에 안 보이거나 상태가 이상하게 나옵니다.** 찾기 어려운 편이라 먼저 의심하세요.
- 문서 ID(`test-individual` 등)는 **주소에 그대로 노출됩니다** (`/apply/test-individual`).
- `participationType` 값은 반드시 **소문자** `individual` / `group`.

### 확인할 것

1. `/apply` 에 카드 3개가 뜨는가
2. 샘플 1은 **접수중** + 남은 일수 표시, 샘플 2는 **접수 예정**, 샘플 3은 **"지난 프로그램"** 아래로 내려가는가
3. 샘플 2 상세로 들어가면 **단체 프로그램 안내**가 보이는가
4. **스마트폰**에서 카드가 세로로 잘 쌓이고 글자가 잘리지 않는가
