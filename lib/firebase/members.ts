// 창의재단 회원 자격 (support_users)
//
// D-23의 핵심:
//   접근 판별은 "로그인했는가"가 아니라 "이 서비스의 회원 문서가 있는가"로 한다.
//   iLINE 회원이 로그인한 채로 넘어와도, 이 문서가 없으면 회원이 아니다.

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  where,
} from 'firebase/firestore'
import { getDb, getAuthClient, COL } from './config'
import { UserFacingError } from './errors'
import type {
  SupportUser,
  Consent,
  ConsentPurpose,
  MemberType,
  RoleChange,
} from '@/lib/types'

/** 현재 약관 버전 — 문구를 바꾸면 반드시 올린다 (동의 이력 추적용) */
export const CONSENT_VERSION = '2026-09-01'

/** 회원 문서 조회. 없으면 null — 이 null이 "미등록 회원"을 뜻한다. */
export async function getMember(uid: string): Promise<SupportUser | null> {
  const snap = await getDoc(doc(getDb(), COL.users, uid))
  if (!snap.exists()) return null
  return { uid: snap.id, ...snap.data() } as SupportUser
}

/**
 * 전체 회원 — 담당자 「회원 관리」 화면용 (D-114). **읽기만 한다.**
 * 규칙이 목록 읽기를 담당자에게만 연다(`allow list: if isStaff()`). 최근 가입 순.
 * 정렬은 여기서 한다 — orderBy 를 걸면 `createdAt` 이 없는 문서가 빠진다.
 */
export async function listMembers(): Promise<SupportUser[]> {
  const snap = await getDocs(collection(getDb(), COL.users))
  return snap.docs
    .map((d) => ({ uid: d.id, ...d.data() }) as SupportUser)
    .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0))
}

/**
 * 지금 테스트 계정인 회원의 uid (D-124) — 관리 화면이 시험 데이터를 가려낼 때 쓴다.
 * 예약에는 「시험」 표시(`sheetSkipped`)가 없어 주인으로만 알 수 있다. 몇 개뿐이라 한 번 읽는다.
 */
export async function listTesterUids(): Promise<string[]> {
  const snap = await getDocs(query(collection(getDb(), COL.users), where('role', '==', 'tester')))
  return snap.docs.map((d) => d.id)
}

/**
 * 담당자 지정·회수 기록 전체 (D-120) — 담당자만 읽는다. 최근 것부터.
 * 몇 건 안 되므로 통째로 읽고 화면이 사람별로 나눈다(색인을 만들 일이 없다).
 */
export async function listRoleChanges(): Promise<RoleChange[]> {
  const snap = await getDocs(collection(getDb(), COL.roleChanges))
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as RoleChange)
    .sort((a, b) => (b.at?.toMillis() ?? 0) - (a.at?.toMillis() ?? 0))
}

/**
 * 담당자로 지정 / 담당자 권한 회수 (D-120) — 서버(`/api/staff/role`)가 한다.
 *
 * 회원 문서의 `role` 은 규칙이 브라우저에서 못 바꾸게 막는다(담당자도). 서버가 요청자를 다시
 * 확인하므로, 이 함수를 부를 수 있다는 것만으로 권한이 생기지는 않는다.
 * 서버가 거절한 까닭(자기 회수 · 인증 안 된 계정 등)은 그대로 화면에 보인다.
 */
export async function changeStaffRole(
  uid: string,
  action: 'grant' | 'revoke',
  reason: string
): Promise<void> {
  const token = await getAuthClient().currentUser?.getIdToken()
  if (!token) throw new UserFacingError('로그인 정보를 확인할 수 없습니다. 다시 로그인해 주세요.')

  const res = await fetch('/api/staff/role', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ uid, action, reason }),
  }).catch(() => null)
  if (!res) throw new UserFacingError('네트워크 연결을 확인해 주세요.')

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new UserFacingError(data.error || '처리하지 못했습니다. 잠시 후 다시 시도해 주세요.')
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
