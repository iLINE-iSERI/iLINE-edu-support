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
import type {
  SupportUser,
  Consent,
  ConsentPurpose,
  MemberType,
} from '@/lib/types'

/** 현재 약관 버전 — 문구를 바꾸면 반드시 올린다 (동의 이력 추적용) */
export const CONSENT_VERSION = '2026-09-01'

/** 회원 문서 조회. 없으면 null — 이 null이 "미등록 회원"을 뜻한다. */
export async function getMember(uid: string): Promise<SupportUser | null> {
  const snap = await getDoc(doc(getDb(), COL.users, uid))
  if (!snap.exists()) return null
  return { uid: snap.id, ...snap.data() } as SupportUser
}

export interface RegisterInput {
  /** 회원 유형 (D-43) — 유형에 따라 채워지는 칸이 다르다 */
  memberType: MemberType
  name: string
  /** 소속 — 학생: 대학명 · 교원: 재직 기관 · 일반: 선택 */
  affiliation: string
  /** 학과·전공 (교원은 담당 교과) */
  major: string
  /** 학번 — 학생만 */
  studentId: string
  /** 학년 — 학생만 */
  grade: string
  /** 직위·직함 — 교원·일반 */
  position: string
  phone: string
  /**
   * 가입 단계에서 받은 동의 — 거부(false)도 그대로 기록한다.
   *
   * ⚠️ **물어본 것만 담는다.** 예전에는 세 항목을 모두 채우도록 되어 있어
   *    묻지도 않은 초상권·증빙서류에 `false` 가 박혔다. 그러면 나중에
   *    "거부한 것"과 "물어본 적 없는 것"이 기록상 똑같아진다 — 동의 이력을
   *    남기는 목적 자체가 무너진다.
   *
   *    지금 가입 단계에서 묻는 것은 **개인정보 수집·이용 하나뿐**이다.
   *    초상권은 프로그램 신청서에서 받는다 (D-44).
   */
  consents: Partial<Record<ConsentPurpose, boolean>>
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
    Object.entries(input.consents) as [ConsentPurpose, boolean | undefined][]
  )
    // 값이 없는 항목 = 물어보지 않은 항목. 줄을 만들지 않는다 (위 주석 참고)
    .filter((e): e is [ConsentPurpose, boolean] => typeof e[1] === 'boolean')
    .map(([purpose, agreed]) => ({
      purpose,
      agreed,
      version: CONSENT_VERSION,
      agreedAt: now,
    }))

  await setDoc(doc(getDb(), COL.users, uid), {
    email,
    authProvider,
    name: input.name.trim(),
    memberType: input.memberType,
    affiliation: input.affiliation.trim(),
    major: input.major.trim(),
    // 유형에 안 맞는 값은 빈 문자열로 들어온다 (MemberInfoForm 참고).
    // undefined 를 넣으면 Firestore 가 저장을 거부하므로 빈 문자열을 쓴다.
    studentId: input.studentId.trim(),
    grade: input.grade,
    position: input.position.trim(),
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
  // D-43: 유형별로 채우는 칸이 다르므로 수정 대상도 그만큼 넓어졌다.
  // memberType 자체도 고칠 수 있어야 한다 — 학생이 졸업해 교원이 되는 경우가 있다.
  patch: Partial<
    Pick<
      SupportUser,
      | 'name'
      | 'memberType'
      | 'affiliation'
      | 'major'
      | 'studentId'
      | 'grade'
      | 'position'
      | 'phone'
    >
  >
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
