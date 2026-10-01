// Firebase Authentication 래퍼
//
// 계정은 iLINE과 별개다 (D-25 — 프로젝트가 다르므로 명부도 다르다).
// 그리고 계정이 있다고 회원인 것도 아니다. 이용 자격은
// support_users 문서의 존재 여부로 판단한다 (D-23).
// 이 파일은 "인증"만 다루고, "회원 자격"은 lib/firebase/members.ts 가 다룬다.

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  sendEmailVerification,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth'
import { getAuthClient } from './config'

const googleProvider = new GoogleAuthProvider()
// 계정 선택 화면을 항상 띄운다 — iLINE 계정과 헷갈리지 않도록
googleProvider.setCustomParameters({ prompt: 'select_account' })

/** 이메일/비밀번호 회원가입 — 가입 직후 인증 메일을 보낸다 */
export async function signUpWithEmail(email: string, password: string) {
  const cred = await createUserWithEmailAndPassword(getAuthClient(), email, password)
  try {
    await sendVerificationEmail(cred.user)
  } catch {
    // 인증 메일 발송 실패가 가입 자체를 막지는 않게 한다 — 인증 안내 카드에서 다시 보낼 수 있다
  }
  return cred.user
}

/* ── 이메일 인증 (09-30 · 순서표 10번) ─────────────────────────────
   iSERI 09-29 — *"이메일 계정을 통해 가입하는 시스템인데 확인할 방법이 없음"*(없는 주소로도 가입됨).
   가입 때 인증 메일은 원래 보내고 있었지만 **아무 데서도 확인하지 않아** 안 눌러도 똑같이 쓸 수 있었다.

   · **이 시각 이후에 만든 이메일·비밀번호 계정만** 인증을 요구한다. 그 전 회원(123 계정)은 막지 않는다 —
     이미 신청·선정되어 오프라인에서 확인된 사람들이라 사이트 이용에 불편이 없어야 한다(iSERI 09-30)
   · 가르는 기준은 **계정을 만든 시각**(Firebase 가 기록 — 화면에서 못 바꾼다)
   · 구글 가입은 구글이 확인한 주소라 처음부터 「인증됨」
   · 인증 전에 막는 것: 새 프로그램 신청 · 새 시설 예약 · 1:1 문의. 이미 낸 신청의 수정·정산·산출물은 막지 않는다
   · 🔴 지금은 **화면만** 막는다. 보안 규칙(`request.auth.token.email_verified`)으로 막는 것은 10/7 뒤 */

/** 이 시각 이후에 만든 이메일 계정만 인증을 요구한다 — 09-30 21:20 (그 전 계정 123개는 기존 회원) */
export const EMAIL_VERIFY_REQUIRED_FROM = Date.parse('2026-09-30T21:20:00+09:00')

/** 이메일·비밀번호로 만든 계정인가 (구글 계정은 처음부터 인증됨) */
export function isPasswordAccount(user: User | null): boolean {
  return Boolean(user?.providerData.some((p) => p.providerId === 'password'))
}

/**
 * 인증을 마쳐야 쓸 수 있는 계정인가 — 새로 가입한 이메일 계정 + 아직 인증 전.
 * `emailVerified` 를 따로 받는 까닭: `user.reload()` 뒤에도 User 객체는 같은 것이라
 * 리액트가 바뀐 줄 모른다. AuthProvider 가 따로 들고 있는 값을 넘긴다.
 */
export function needsEmailVerification(
  user: User | null,
  emailVerified: boolean = Boolean(user?.emailVerified)
): boolean {
  if (!user || emailVerified || !isPasswordAccount(user)) return false
  const created = Date.parse(user.metadata.creationTime ?? '')
  return Number.isFinite(created) && created >= EMAIL_VERIFY_REQUIRED_FROM
}

/**
 * 인증 메일 보내기. 링크를 눌러 인증을 마치면 [계속] 버튼이 사이트 마이페이지로 돌려보낸다.
 * 돌아올 주소가 Firebase 「승인된 도메인」에 없으면 Firebase 가 거절하므로, 그때는 돌아올 주소 없이 다시 보낸다.
 */
export async function sendVerificationEmail(user: User): Promise<void> {
  const url = typeof window !== 'undefined' ? `${window.location.origin}/mypage` : ''
  try {
    await sendEmailVerification(user, url ? { url } : undefined)
  } catch (e) {
    const code = errCode(e)
    if (url && /continue-uri|unauthorized-domain/.test(code)) {
      await sendEmailVerification(user)
      return
    }
    throw e
  }
}

/**
 * 인증했는지 Firebase 에 다시 묻는다. 메일의 링크를 눌러도 이미 열려 있는 화면은 모른다 —
 * 계정 정보를 새로 읽어야(`reload`) 바뀐다. 인증됐으면 로그인 토큰도 새로 받는다
 * (토큰 안의 email_verified — 나중에 보안 규칙이 이것을 본다).
 */
export async function reloadEmailVerified(): Promise<boolean> {
  const u = getAuthClient().currentUser
  if (!u) return false
  await u.reload()
  if (u.emailVerified) await u.getIdToken(true)
  return u.emailVerified
}

/**
 * 담당자 권한 표시를 로그인 토큰에 맞춘다 (D-120 · 10-02).
 *
 * 담당자 권한은 두 곳에 있다 — 회원 문서 `role`(관리 화면 · Firestore 규칙)과 로그인 토큰의
 * `supportStaff`(Storage 첨부·PDF — Storage 규칙은 Firestore 를 못 읽는다). 토큰은 한 번 받으면
 * 최대 1시간 그대로라, 예전에는 지정·회수된 사람이 **로그아웃 뒤 다시 로그인**해야 첨부가 열렸다.
 * 사이트를 열 때 둘이 다르면 토큰을 새로 받는다 → **새로고침만 하면 된다.**
 * 토큰 읽기는 브라우저에 있는 것을 써서 네트워크를 쓰지 않고, 다를 때만 새로 받는다.
 */
export async function syncStaffClaim(user: User, isStaff: boolean): Promise<void> {
  try {
    const t = await user.getIdTokenResult()
    if ((t.claims.supportStaff === true) !== isStaff) await user.getIdToken(true)
  } catch {
    // 못 맞춰도 로그인·화면은 그대로 — 다음에 사이트를 열 때 다시 한다
  }
}

export async function signInWithEmail(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(getAuthClient(), email, password)
  return cred.user
}

export async function signInWithGoogle() {
  const cred = await signInWithPopup(getAuthClient(), googleProvider)
  return cred.user
}

export async function resetPassword(email: string) {
  await sendPasswordResetEmail(getAuthClient(), email)
}

export async function logOut() {
  await signOut(getAuthClient())
}

export function onAuthChange(cb: (user: User | null) => void) {
  return onAuthStateChanged(getAuthClient(), cb)
}

function errCode(err: unknown): string {
  return typeof err === 'object' && err !== null && 'code' in err
    ? String((err as { code: unknown }).code)
    : ''
}

/**
 * 자격 증명 오류인가 — 이메일이 없거나 비밀번호가 틀린 경우.
 *
 * ⚠️ Firebase는 **"가입 안 된 이메일"과 "비밀번호 틀림"을 구분해서
 *    알려주지 않는다.** 둘 다 `auth/invalid-credential` 로 돌아온다.
 *    공격자가 이메일을 하나씩 넣어보며 가입 여부를 알아내는 것
 *    (이메일 열거 공격)을 막기 위한 Firebase의 기본 보호 장치다.
 *
 *    그래서 "가입되지 않은 이메일입니다"라고 단정할 수 없다. 대신
 *    두 가능성을 함께 안내하고 회원가입 길을 같이 열어준다.
 */
export function isCredentialError(err: unknown): boolean {
  const code = errCode(err)
  return (
    code === 'auth/invalid-credential' ||
    code === 'auth/user-not-found' ||
    code === 'auth/wrong-password'
  )
}

/**
 * Firebase 인증 오류 코드를 한국어 안내 문구로 변환한다.
 * 사용자에게 영어 코드를 그대로 보여주지 않기 위함.
 */
export function authErrorMessage(err: unknown): string {
  const code = errCode(err)

  switch (code) {
    case 'auth/invalid-email':
      return '이메일 형식이 올바르지 않습니다.'
    case 'auth/user-disabled':
      return '사용이 중지된 계정입니다. 담당자에게 문의해 주세요.'
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      // 가입 여부를 단정할 수 없으므로 두 가능성을 모두 안내한다
      return '이메일 또는 비밀번호가 맞지 않습니다. 아직 가입하지 않으셨다면 회원가입을 진행해 주세요.'
    case 'auth/email-already-in-use':
      return '이미 가입된 이메일입니다. 로그인해 주세요.'
    case 'auth/weak-password':
      return '비밀번호는 6자 이상이어야 합니다.'
    case 'auth/too-many-requests':
      return '시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.'
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return '로그인 창이 닫혔습니다. 다시 시도해 주세요.'
    case 'auth/popup-blocked':
      return '브라우저가 팝업을 차단했습니다. 팝업 허용 후 다시 시도해 주세요.'
    case 'auth/network-request-failed':
      return '네트워크 연결을 확인해 주세요.'
    case 'auth/operation-not-allowed':
      return '해당 로그인 방식이 아직 활성화되지 않았습니다. 담당자에게 문의해 주세요.'
    default:
      return '처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.'
  }
}
