# iLINE 개편 — 준비 작업 요청서 (Setup Guide)

> **이 문서의 성격**: 제가 코드로 할 수 없고 **계정 소유자만 할 수 있는 작업** 목록입니다.
> 콘솔 화면은 수시로 바뀌므로 메뉴 이름이 조금 다를 수 있습니다. 안 보이면 알려주세요.
> **작성일**: 2026-09-04

---

## 🔴 지금 당장 필요한 것 — 이거 하나뿐입니다

### S-1. 레포지토리 접근

레포가 GitHub에 있고 이 PC에는 없다고 하셨으니, **가장 빠른 방법 순서로** 정리했습니다. **하나만** 하시면 됩니다.

#### 방법 A — 공개 레포라면: 주소만 주세요 ⭐ 가장 빠름

레포가 **Public**이면 주소만 알려주시면 제가 클라우드에서 바로 받아옵니다. 준비 작업 없음.

```
https://github.com/<계정>/<레포이름>
```

> 확인 방법: GitHub에서 레포를 열었을 때 이름 옆에 `Public`이면 방법 A, `Private`이면 B 또는 C.

#### 방법 B — 비공개 레포: PC에 내려받고 폴더 연결

1. 이 PC에 폴더를 하나 만듭니다 (예: `C:\Users\<사용자명>\Coding\iline`)
2. 그 폴더에서 명령 프롬프트를 열고:
   ```
   git clone https://github.com/<계정>/<레포이름>.git
   ```
   - `git`이 없다는 오류가 나면 [git-scm.com](https://git-scm.com/download/win)에서 설치
   - 로그인 창이 뜨면 GitHub 계정으로 로그인
3. **Claude 데스크톱 앱에서 그 폴더를 이 작업에 연결**해 주세요
4. 연결되면 제가 바로 읽고 수정할 수 있습니다

> 앞으로 계속 코드를 주고받을 거라면 **B를 권합니다.** 제가 파일을 직접 고쳐서 그 폴더에 저장할 수 있습니다.

#### 방법 C — 압축본 첨부 (일회성 조사용)

```
zip -r iline.zip . -x "node_modules/*" ".next/*" ".git/*" ".env*"
```
Windows라면 탐색기에서 `node_modules`, `.next`, `.git`, `.env*`를 뺀 나머지를 압축 → 채팅에 첨부.

#### 최소한 이것만이라도 (라우트 조사만 급할 때)

전체 레포가 부담스러우면 **아래 두 개만** 주셔도 301 리다이렉트 맵을 만들 수 있습니다.

- `package.json`
- `app/` 또는 `pages/` 폴더의 **파일 목록** (내용 없이 경로만)

---

## 🟠 Phase 2(인증) 전까지 필요한 것

### S-2. Firebase 프로젝트 확인

**먼저 확인해 주실 것**: iLINE이 쓰고 있는 **기존 Firebase 프로젝트가 있습니까?**

| 상황 | 해야 할 일 |
|---|---|
| **기존 프로젝트 있음** ⭐ | 그걸 그대로 씁니다 (D-8). 아래 S-2-1만 확인 |
| **새로 만들어야 함** | S-2-0부터 전부 |

> **왜 기존 것을 쓰는 게 좋은가**: 회원 데이터를 옮길 필요가 없고, **Storage 무료 사용량도 유지**됩니다. 2024년 9월 이후 만든 새 프로젝트는 Storage를 쓰려면 **Blaze(종량제) 요금제 + 신용카드 등록이 필수**입니다. 기존 프로젝트는 무료 한도(월 5GB 저장 등)가 그대로 남아 있습니다.

#### S-2-0. (새로 만드는 경우만) 프로젝트 생성
1. [console.firebase.google.com](https://console.firebase.google.com) 접속
2. `프로젝트 추가` → 이름 입력 (예: `iline-platform`)
3. Google 애널리틱스는 **끄셔도 됩니다**
4. ⚠️ **Storage를 쓰려면 Blaze 요금제 전환 필요** — 좌측 하단 `업그레이드`에서 신용카드 등록. 예산 알림을 월 1만원 등으로 걸어두시면 안전합니다

#### S-2-1. Authentication 켜기
1. 좌측 메뉴 `빌드 > Authentication` → `시작하기`
2. `Sign-in method` 탭에서 두 가지를 **사용 설정**:
   - **이메일/비밀번호**
   - **Google**
3. `설정 > 승인된 도메인`에 아래를 추가:
   - `iline.or.kr`
   - `localhost` (보통 기본 포함)
   - Vercel 프리뷰 도메인 (`*.vercel.app`) — 나중에 S-5에서

#### S-2-2. Firestore 만들기
1. `빌드 > Firestore Database` → `데이터베이스 만들기`
2. 위치: **`asia-northeast3` (서울)** ← 중요. 나중에 변경 불가
3. 모드: **프로덕션 모드**로 시작 (규칙은 제가 작성해 드립니다)

#### S-2-3. Storage 만들기
1. `빌드 > Storage` → `시작하기`
2. 위치: Firestore와 **같은 지역** 선택
3. 프로덕션 모드로 시작

#### S-2-4. 웹 앱 등록 → 설정값 확보
1. `프로젝트 설정(⚙️) > 일반` 하단 `내 앱`
2. 웹 앱(`</>`)이 이미 있으면 그걸 쓰고, 없으면 추가
3. 표시되는 `firebaseConfig` 값을 **메모해 두세요** (S-6에서 씁니다)

> ⚠️ 이 값들은 브라우저에 노출되는 공개 설정이라 비밀은 아니지만, **채팅에 붙여넣지 마세요.** 제가 없어도 코드를 씁니다.

---

## 🟠 Phase 5(시트·드라이브 연동) 전까지 필요한 것

### S-3. 서비스 계정 만들기

서버가 스프레드시트와 드라이브에 접근할 때 쓰는 **자동화용 계정**입니다.

1. [console.cloud.google.com](https://console.cloud.google.com) 접속
   - 상단 프로젝트 선택기에서 **Firebase와 같은 프로젝트**를 고릅니다 (Firebase 프로젝트는 GCP 프로젝트이기도 합니다)
2. **API 두 개를 사용 설정**: `API 및 서비스 > 라이브러리`에서 검색 후 각각 `사용`
   - **Google Sheets API**
   - **Google Drive API**
3. `API 및 서비스 > 사용자 인증 정보` → `사용자 인증 정보 만들기` → **서비스 계정**
   - 이름: `iline-sheets-sync` 등
   - 역할은 **지정하지 않아도 됩니다** (드라이브·시트 권한은 공유로 부여)
4. 만들어진 서비스 계정을 클릭 → `키` 탭 → `키 추가 > 새 키 만들기 > JSON`
   - JSON 파일이 다운로드됩니다
5. 📌 **그 JSON 안의 `client_email` 값(…@….iam.gserviceaccount.com)을 복사해 두세요.** S-4에서 씁니다

> 🔒 **JSON 파일 전체는 절대 채팅에 붙여넣지 마세요.** 안전한 곳에 보관하시고, 값은 Vercel 환경변수에만 넣습니다(S-5).

### S-4. 공유 드라이브 + 스프레드시트 준비

#### S-4-1. 공유 드라이브 생성
1. [drive.google.com](https://drive.google.com) → 좌측 `공유 드라이브` → `새로 만들기`
   - 이름: `2026 교원양성지원사업` 등
   - ⚠️ 이 메뉴가 안 보이면 Workspace 계정이 아니거나 관리자가 막아둔 것입니다 → 알려주세요
2. 드라이브 안에 폴더 두 개 생성: **`01_과제신청`**, **`02_정산`**
3. 우측 상단 `멤버 관리`에서 추가:
   - **S-3의 서비스 계정 이메일** → 권한 **`콘텐츠 관리자`**
   - **사업 담당자들** → `콘텐츠 관리자` 또는 `기여자`
4. 드라이브 설정에서 **외부 공유를 차단**해 주세요 (신분증이 들어가는 곳입니다)
5. 📌 주소창의 드라이브 ID를 메모: `drive.google.com/drive/folders/` **뒤의 문자열**

#### S-4-2. 스프레드시트 생성
1. **공유 드라이브 안에** 새 스프레드시트 생성 (개인 드라이브 아님)
   - 이름: `2026 교원양성지원사업 신청현황`
2. 시트 탭 두 개 만들기: **`신청`**, **`정산`** (열은 제가 폼 명세 확정 후 정의합니다)
3. 공유 → **S-3의 서비스 계정 이메일**을 **편집자**로 추가
4. 공유 설정을 **`제한됨`**(링크 공유 끔)으로 유지
5. 📌 주소창의 시트 ID를 메모: `docs.google.com/spreadsheets/d/` **와** `/edit` **사이의 문자열**

---

## 🟡 배포 시점에 필요한 것

### S-5. Vercel

1. [vercel.com](https://vercel.com) → GitHub 계정으로 로그인
2. `Add New > Project` → iLINE 레포 선택 → `Import`
   - Next.js는 자동 인식되므로 빌드 설정은 기본값 그대로
3. `Settings > Environment Variables`에 S-6의 값들을 입력
   - 각 변수마다 `Production` / `Preview` / `Development` 체크
4. `Settings > Domains`에서 `iline.or.kr` 연결
   - ⚠️ 이미 운영 중인 도메인이라면 **기존 배포와 충돌하지 않도록** 전환 시점을 잡아야 합니다. 전환 전에 알려주세요
5. 배포 후 생성된 `*.vercel.app` 주소를 **Firebase 승인된 도메인(S-2-1)에 추가**

### S-6. 환경변수 목록

Vercel과 로컬 `.env.local` 양쪽에 넣습니다. **이름은 제가 코드에서 이 이름으로 쓰겠습니다.**

| 변수명 | 출처 | 비고 |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | S-2-4 firebaseConfig | 공개값 |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | S-2-4 | 공개값 |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | S-2-4 | 공개값 |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | S-2-4 | 공개값 |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | S-2-4 | 공개값 |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | S-2-4 | 공개값 |
| `FIREBASE_ADMIN_PROJECT_ID` | 서비스 계정 JSON | 🔒 |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | 서비스 계정 JSON | 🔒 |
| `FIREBASE_ADMIN_PRIVATE_KEY` | 서비스 계정 JSON | 🔒 줄바꿈 `\n` 그대로 |
| `GOOGLE_SHEETS_ID` | S-4-2 | 🔒 |
| `GOOGLE_DRIVE_ID` | S-4-1 | 🔒 |
| `GOOGLE_DRIVE_FOLDER_APPLICATIONS` | `01_과제신청` 폴더 ID | 🔒 |
| `GOOGLE_DRIVE_FOLDER_SETTLEMENTS` | `02_정산` 폴더 ID | 🔒 |

> 🔒 표시된 값은 **절대 채팅·GitHub·문서에 올리지 마세요.** Vercel 대시보드와 로컬 `.env.local`에만. `.env.local`은 `.gitignore`에 반드시 포함되어야 합니다.

---

## ✅ 체크리스트

**지금**
- [ ] **S-1. 레포 주소 알려주기(공개) 또는 클론 후 폴더 연결(비공개)**

**Phase 2 전 (약 1~2주 내)**
- [ ] S-2. Firebase 프로젝트 확인 — 기존 것이 있는지부터
- [ ] S-2-1~4. Auth / Firestore / Storage / 웹앱 등록

**Phase 5 전**
- [ ] S-3. 서비스 계정 + Sheets·Drive API 사용 설정
- [ ] S-4. 공유 드라이브 + 스프레드시트

**배포 전**
- [ ] S-5. Vercel 프로젝트 연결 + 도메인
- [ ] S-6. 환경변수 등록

---

## 막히면

각 단계에서 화면이 문서와 다르거나 메뉴가 안 보이면, **그 화면을 캡처해서 보내주세요.** 이 PC 화면을 제가 직접 볼 수도 있으니 필요하면 말씀해 주시고요.

**S-1만 해결되면 바로 코드 작업이 이어집니다.** 나머지는 해당 Phase에 도달할 때 하셔도 늦지 않습니다.
