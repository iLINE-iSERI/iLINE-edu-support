// 창의재단 회원 자격 (support_users)
//
// D-23의 핵심:
//   접근 판별은 "로그인했는가"가 아니라 "이 서비스의 회원 문서가 있는가"로 한다.
//   iLINE 회원이 로그인한 채로 넘어와도, 이 문서가 없으면 회원이 아니다.

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { getDb, COL } from './config'
import type { SupportUser, Consent, ConsentPurpose } from '@/lib/types'

/** 현재 약관 버전 — 문구를 바꾸면 반드시 올린다 (동의 이력 추적용) */
export const CONSENT_VERSION = '2026-09-01'

/** 회원 문서 조회. 없으면 null — 이 null이 "미등록 회원"을 뜻한다. */
export async function getMember(uid: string): Promise<SupportUser | null> {
  const snap = await getDoc(doc(getDb(), COL.users, uid))
  if (!snap.exists()) return null
  return { uid: snap.id, ...snap.data() } as SupportUser
}

export interface RegisterInput {
  name: string
  /** 학번 */
  studentId: string
  /** 전공(학과) */
  major: string
  /** 학년 */
  grade: string
  phone: string
  /**
   * 동의 결과 — 거부(false)도 그대로 기록한다.
   * 초상권은 나중에 갤러리 게시 가부 판단에 쓰이므로 특히 중요.
   */
  consents: Record<ConsentPurpose, boolean>
}

/**
 * 창의재단 회원 등록.
 * 인증은 이미 되어 있는 상태(uid 보유)에서 프로필과 동의 이력을 얹는다.
 */
export async function registerMember(
  uid: string,
  email: string,
  authProvider: string,
  input: RegisterInput
): Promise<void> {
  const now = Timestamp.now()
  const consents: Consent[] = (
    Object.entries(input.consents) as [ConsentPurpose, boolean][]
  ).map(([purpose, agreed]) => ({
    purpose,
    agreed,
    version: CONSENT_VERSION,
    agreedAt: now,
  }))

  await setDoc(doc(getDb(), COL.users, uid), {
    email,
    authProvider,
    name: input.name.trim(),
    studentId: input.studentId.trim(),
    major: input.major.trim(),
    grade: input.grade,
    phone: input.phone.replace(/[^0-9]/g, ''),
    role: 'applicant',
    status: 'active',
    consents,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

/** 회원정보 수정 */
export async function updateMember(
  uid: string,
  patch: Partial<Pick<SupportUser, 'name' | 'studentId' | 'major' | 'grade' | 'phone'>>
): Promise<void> {
  await updateDoc(doc(getDb(), COL.users, uid), {
    ...patch,
    updatedAt: serverTimestamp(),
  })
}

/**
 * 탈퇴 = 문서 삭제가 아니라 비활성화 (§2-2 ②).
 * 신청·정산 이력은 국고사업 보존 의무 대상이므로 남긴다.
 */
export async function withdrawMember(uid: string): Promise<void> {
  await updateDoc(doc(getDb(), COL.users, uid), {
    status: 'withdrawn',
    updatedAt: serverTimestamp(),
  })
}
