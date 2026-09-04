# `.env.local` 이 뭐고, 어떻게 만드는가

---

## 1. 이게 뭔가요

**프로젝트가 실행될 때 읽는 설정값 파일**입니다. 코드에 직접 적지 않고 밖으로 빼두는 값들이죠.

예를 들어 `lib/firebase/config.ts` 안에는 이렇게 되어 있습니다.

```ts
apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
```

여기 실제 키 문자열이 아니라 **"환경변수에서 가져와라"** 라고만 적혀 있습니다.
그 값을 공급하는 게 `.env.local` 파일입니다.

### 왜 이렇게 하나요

| 이유 | 설명 |
|---|---|
| **비밀값을 코드에서 분리** | 서비스 계정 키 같은 건 GitHub에 올라가면 안 됩니다 |
| **환경마다 다른 값** | 내 PC / 테스트 서버 / 운영 서버가 각각 다른 값을 쓸 수 있습니다 |
| **사람마다 다른 값** | 팀원이 각자 자기 값을 씁니다 |

그래서 **`.env.local` 은 Git에 올라가지 않습니다.** `.gitignore`에 이미 넣어뒀습니다.
대신 **어떤 이름의 변수가 필요한지만** 알려주는 `.env.local.example` 이 레포에 들어 있습니다.

> 정리하면: `.env.local.example` = **양식** (공유됨) · `.env.local` = **실제 값** (내 PC에만)

---

## 2. 지금 만들어야 하는 이유

**만들지 않아도 사이트는 뜹니다.** 홈·사업소개·갤러리 같은 화면은 Firebase를 쓰지 않으니까요.

하지만 **로그인·회원가입은 동작하지 않습니다.** 브라우저 개발자도구(F12) 콘솔에 이런 경고가 뜹니다.

```
[iLINE] Firebase 환경변수가 없습니다. .env.local 을 설정하면 로그인 기능이 활성화됩니다.
```

---

## 3. 넣을 값은 어디서 가져오나

**그뤠잇과 같은 Firebase 프로젝트를 씁니다(D-8).** 그러니 새로 발급받을 필요 없이 **그뤠잇 값을 그대로** 쓰면 됩니다.

### 가장 쉬운 방법 — 그뤠잇 레포에서 복사

그뤠잇 레포(`iLINE-iSERI/iline`) 최상단에 **`.env.local.txt`** 파일이 있습니다.
GitHub 웹에서 바로 열어볼 수 있습니다. 그 안에 필요한 6줄이 그대로 들어 있습니다.

```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

### 다른 방법 — Firebase 콘솔에서

1. [console.firebase.google.com](https://console.firebase.google.com) → 프로젝트 선택
2. 좌측 상단 **⚙️ → 프로젝트 설정**
3. **일반** 탭 맨 아래 **내 앱** → 웹 앱(`</>`) 선택
4. **SDK 설정 및 구성** → `구성` 라디오 선택 → `firebaseConfig` 값이 보입니다

콘솔에는 `apiKey: "AIza..."` 형태로 나오니, 위 변수 이름에 맞춰 옮겨 적으시면 됩니다.

| 콘솔 표기 | `.env.local` 변수명 |
|---|---|
| `apiKey` | `NEXT_PUBLIC_FIREBASE_API_KEY` |
| `authDomain` | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` |
| `projectId` | `NEXT_PUBLIC_FIREBASE_PROJECT_ID` |
| `storageBucket` | `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` |
| `messagingSenderId` | `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` |
| `appId` | `NEXT_PUBLIC_FIREBASE_APP_ID` |

---

## 4. 파일 만들기 (Windows)

⚠️ **탐색기에서 "새 텍스트 문서"로는 만들기 어렵습니다.** 윈도우가 점(`.`)으로 시작하는 파일명을 거부합니다.
아래 방법 중 하나를 쓰세요.

### 방법 A — 명령 프롬프트 (가장 확실)

프로젝트 폴더에서:

```
cd D:\work\iLINE-edu-support
copy .env.local.example .env.local
notepad .env.local
```

메모장이 열리면 값을 채우고 저장(`Ctrl+S`) 후 닫습니다.

### 방법 B — VS Code

1. VS Code로 `D:\work\iLINE-edu-support` 폴더 열기
2. 탐색기 패널에서 **새 파일** 아이콘 → 이름을 `.env.local` 로 입력
3. `.env.local.example` 내용을 복사해 붙여넣고 값 채우기

---

## 5. 무엇을 채우나

**지금은 위쪽 6개만 채우면 됩니다.** 나머지는 나중 단계에서 씁니다.

```env
# ✅ 지금 필요 — 로그인·회원가입 동작에 필요
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...실제값
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=xxxx.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=xxxx
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=xxxx.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123:web:abc

# 선택 — 헤더의 "iLINE 홈" 링크. 비워두면 https://iline.or.kr 로 갑니다
NEXT_PUBLIC_INTRO_URL=https://iline.or.kr

# ⏸ 나중에 (Phase 5 시트·드라이브 연동) — 지금은 비워두세요
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=""
GOOGLE_SHEETS_ID=
GOOGLE_DRIVE_ID=
GOOGLE_DRIVE_FOLDER_APPLICATIONS=
GOOGLE_DRIVE_FOLDER_SETTLEMENTS=
```

**작성 규칙**
- `=` 앞뒤에 **공백을 넣지 마세요** (`KEY=값`, `KEY = 값` ❌)
- 값에 **따옴표를 두르지 마세요** (여러 줄인 `FIREBASE_ADMIN_PRIVATE_KEY` 만 예외)
- 줄 끝에 세미콜론·쉼표를 붙이지 마세요
- `#` 으로 시작하는 줄은 주석입니다

---

## 6. ⚠️ 저장 후 반드시 서버를 껐다 켜세요

**환경변수는 실행 중에 다시 읽히지 않습니다.** 파일만 고치면 반영되지 않습니다.

```
Ctrl + C     (실행 중인 개발 서버 종료)
npm run dev  (다시 시작)
```

---

## 7. 잘 됐는지 확인

1. `http://localhost:3000/login` 접속
2. **F12 → Console 탭**을 열어둡니다
3. `[iLINE] Firebase 환경변수가 없습니다` 경고가 **사라졌으면 성공**입니다
4. 실제로 회원가입을 한번 해보세요 → 이메일/비밀번호로 가입 → 회원 등록 화면으로 넘어가면 정상

---

## 8. `NEXT_PUBLIC_` 이 붙은 것과 아닌 것의 차이

이게 **가장 중요한 규칙**입니다.

| 구분 | 어디까지 노출되나 | 예 |
|---|---|---|
| `NEXT_PUBLIC_` **있음** | **브라우저까지 전달됨.** 누구나 볼 수 있음 | Firebase 웹 설정 |
| `NEXT_PUBLIC_` **없음** | **서버에만 존재.** 브라우저로 안 나감 | 서비스 계정 키 |

> 🔒 **서비스 계정 키나 Admin 비밀키에는 절대 `NEXT_PUBLIC_` 을 붙이지 마세요.**
> 붙이는 순간 브라우저 코드에 그대로 박혀서 전 세계에 공개됩니다.

Firebase 웹 설정값(`NEXT_PUBLIC_FIREBASE_*`)이 공개돼도 괜찮은 이유는,
그 값들이 **원래 브라우저에 노출되도록 설계**되었기 때문입니다.
Firebase 보안은 이 값이 아니라 **Security Rules** 가 담당합니다.
그래서 규칙 작업(TODO-later.md A항목)이 중요한 것입니다.

---

## 9. Vercel 배포할 때는?

`.env.local` 은 **내 PC에만** 있는 파일입니다. Git에 안 올라가니 Vercel도 모릅니다.

배포 시에는 **Vercel 대시보드에 같은 값을 따로 입력**해야 합니다.

`Vercel 프로젝트 > Settings > Environment Variables` 에서 변수명과 값을 하나씩 등록하고,
`Production` / `Preview` / `Development` 를 체크합니다.

→ 배포 단계 체크리스트는 `docs/TODO-later.md` C항목 참고
