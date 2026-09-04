// Firebase Authentication 래퍼
//
// 인증 신원(uid)은 그뤠잇과 공유하지만, 창의재단 이용 자격은
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
// 계정 선택 화면을 항상 띄운다 — 그뤠잇 계정과 헷갈리지 않도록
googleProvider.setCustomParameters({ prompt: 'select_account' })

/** 이메일/비밀번호 회원가입 — 가입 직후 인증 메일을 보낸다 */
export async function signUpWithEmail(email: string, password: string) {
  const cred = await createUserWithEmailAndPassword(getAuthClient(), email, password)
  try {
    await sendEmailVerification(cred.user)
  } catch {
    // 인증 메일 발송 실패가 가입 자체를 막지는 않게 한다
  }
  return cred.user
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
