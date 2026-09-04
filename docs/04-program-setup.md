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
| `year` | number | ✅ | 사업 연도 (예: `2026`) |
| `participationType` | string | ✅ | **`individual`** 또는 **`group`** |
| `published` | boolean | ✅ | `true` 여야 목록에 보입니다 |
| `description` | string | | 한두 문장 소개 |
| `opensAt` | timestamp | | 접수 시작. 비우면 바로 접수중 |
| `closesAt` | timestamp | | 접수 마감. 비우면 상시 접수 |
| `maxTeamSize` | number | | 단체 프로그램일 때 최대 인원 (대표자 포함) |
| `createdAt` | timestamp | | 등록 시각 |
| `updatedAt` | timestamp | | 수정 시각 |

### `participationType` 정하기

| 값 | 언제 | 신청 방식 |
|---|---|---|
| **`individual`** | **기본값** | 팀으로 활동하더라도 **구성원이 각자 신청** |
| `group` | 단체 프로그램 | **대표자가 팀원 명단과 함께** 신청 |

> `group` 을 고르면 신청 화면에 팀원 입력표가 나타나고, 대표자가 팀원의
> 개인정보를 대신 입력하게 되므로 **"팀원 전원의 동의를 받았음" 확인**이
> 필수로 붙습니다.

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
