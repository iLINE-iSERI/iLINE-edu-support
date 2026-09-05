# 배포하기 (Vercel + 가비아)

> 목표: `support.iline.or.kr` 로 접속되게 만듭니다.
> 20~30분. 도메인 연결은 반영에 시간이 더 걸릴 수 있습니다.

**iLINE 사이트는 이 과정에서 건드리지 않습니다.** 별도의 Vercel 프로젝트를 새로 만듭니다(D-20).

---

## 0. 순서

1. Vercel 프로젝트 생성 + 환경변수 등록 → **임시 주소로 먼저 확인**
2. 가비아에서 `support` 한 줄 추가
3. Vercel에 도메인 연결
4. Firebase 승인된 도메인에 추가 ← **빠뜨리면 로그인이 전부 실패합니다**

1번만 해도 사이트는 뜹니다. 도메인은 나중에 붙여도 됩니다.

---

## 1. Vercel 프로젝트 만들기

1. [vercel.com](https://vercel.com) 로그인 → **Add New → Project**
2. GitHub 저장소 목록에서 **`iLINE-edu-support`** → **Import**
   - 안 보이면 `Adjust GitHub App Permissions` 로 저장소 접근을 허용해 주세요
3. 설정은 **그대로 두세요.** Next.js 는 자동 인식됩니다
   - Framework Preset: `Next.js`
   - Build Command / Output Directory: **비워둠**
4. **Environment Variables** 를 펼쳐 아래 6개를 넣습니다 ← **가장 중요**

### 환경변수 6개

`.env.local` 에 적으신 값과 **똑같습니다.** 그 파일을 열어 그대로 옮기세요.

| Key | Value |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | `.env.local` 의 값 |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | 〃 |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | 〃 |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | 〃 |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | 〃 |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | 〃 |

- **따옴표 없이** 값만 붙여넣습니다
- 환경(Environments)은 **기본값 `Production and Preview` 그대로** 두세요
  *(`Development` 는 Vercel에서 값을 내려받아 로컬에서 쓸 때 쓰는 것인데,
   우리는 `.env.local` 을 직접 쓰므로 필요 없습니다)*
- Vercel 의 붙여넣기 상자에 `.env.local` 내용을 통째로 붙이면 한 번에 들어갑니다

> ⚠️ **하나라도 빠지면 배포는 성공하지만 로그인이 안 됩니다.** 화면은 뜨는데
> 콘솔에 `Firebase 환경변수가 없습니다` 가 찍힙니다. 가장 흔한 실수입니다.

5. **Deploy** → 1~2분

### 확인

배포가 끝나면 `iline-edu-support.vercel.app` 같은 주소가 나옵니다.
**아직 로그인은 안 됩니다** — 4번(승인된 도메인)을 해야 됩니다. 화면이 뜨는지만 보세요.

---

## 2. 가비아에서 `support` 추가

1. [가비아](https://www.gabia.com) 로그인 → **My가비아**
2. **서비스 관리 → 도메인** → `iline.or.kr` → **DNS 관리** (또는 `DNS 정보 → 설정`)
3. **레코드 수정** → **레코드 추가**

| 항목 | 값 |
|---|---|
| 타입 | **CNAME** |
| 호스트 | **`support`** ← `support.iline.or.kr` 이 아니라 `support` 만 |
| 값/위치 | **Vercel 화면에 나온 주소** (보통 `cname.vercel-dns.com.`) |
| TTL | 기본값 (600 등) |

4. **저장**

> **값은 Vercel 이 알려주는 것을 그대로 쓰세요.** 아래 3번에서 도메인을 추가하면
> Vercel 이 "이 레코드를 넣으세요" 하고 정확한 값을 보여줍니다.
> 프로젝트에 따라 다를 수 있어서, 여기 적힌 값을 외워 쓰지 마시고 화면 값을 복사하세요.

> 가비아는 값 끝에 **점(`.`)** 을 요구하는 경우가 있습니다. 저장이 거부되면
> `cname.vercel-dns.com.` 처럼 점을 붙여 보세요.

> ⚠️ **기존 레코드는 절대 건드리지 마세요.** `@`, `www` 는 운영 중인 iLINE 사이트가
> 쓰고 있습니다. 지우거나 고치면 **iLINE 이 즉시 멈춥니다.** 새 줄만 추가하세요.

---

## 3. Vercel 에 도메인 연결

1. Vercel → 방금 만든 프로젝트 → **Settings → Domains**
2. `support.iline.or.kr` 입력 → **Add**
3. Vercel 이 필요한 DNS 레코드를 보여줍니다. 2번에서 넣은 값과 다르면 **화면 값으로 고치세요**
4. 연결되면 `Valid Configuration` 으로 바뀝니다

DNS 반영은 보통 **몇 분**, 길면 몇 시간 걸립니다. 바로 안 된다고 설정을 다시 만지지 마세요.

---

## 4. Firebase 승인된 도메인 — 빼먹으면 로그인 전부 실패

**Authentication → 설정 → 승인된 도메인 → 도메인 추가**

두 개를 넣습니다.

- `support.iline.or.kr` *(이미 넣으셨으면 통과)*
- **Vercel 임시 주소** — `iline-edu-support.vercel.app` 처럼 실제 발급된 정확한 이름

> **와일드카드(`*.vercel.app`)는 받지 않습니다.** 정확한 이름을 적으세요.
> Vercel 의 미리보기(preview) 주소는 배포마다 달라져서 이 목록으로는 감당이 안 됩니다.
> 미리보기에서 로그인 테스트가 필요하면 별도 방법이 필요합니다.

---

## 5. 배포 후 점검

- [ ] 첫 화면이 뜨는가
- [ ] **회원가입 → 로그인** 이 되는가 ← 4번이 됐는지 보는 시험
- [ ] `/apply` 에 프로그램이 보이는가
- [ ] 신청서 제출 → **PDF 가 만들어지는가**
- [ ] 마이페이지에서 첨부·PDF 가 열리는가
- [ ] 담당자 화면에서 상태 변경이 되는가
- [ ] **휴대폰으로 접속** — 이제 실기기 확인이 가능합니다 (D-24)

---

## 앞으로

`main` 브랜치에 **push 하면 자동으로 다시 배포됩니다.** 따로 할 일이 없습니다.

배포가 잘못되면 Vercel 의 **Deployments** 목록에서 이전 배포를 **Promote to Production**
으로 되돌릴 수 있습니다. 몇 초면 됩니다.

---

## 자주 나는 문제

| 증상 | 원인 |
|---|---|
| 화면은 뜨는데 로그인이 안 됨 | **승인된 도메인** 누락 (4번) |
| 콘솔에 `환경변수가 없습니다` | Vercel 환경변수 누락 또는 오타 |
| 빌드 실패 | 로컬에서 `npm run build` 를 돌려 같은 오류가 나는지 확인 |
| 도메인이 계속 `Invalid Configuration` | DNS 반영 대기 중이거나 호스트를 `support.iline.or.kr` 로 적음 (→ `support` 만) |
| iLINE 사이트가 멈춤 | **가비아에서 기존 레코드를 건드림.** 즉시 되돌리세요 |
