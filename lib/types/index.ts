/**
 * 창의재단 교원양성지원사업 — 도메인 타입
 *
 * 작업지시서 §6-3 스키마 기준. 컬렉션은 모두 `support_` 접두어로
 * iLINE 데이터와 분리한다 (D-8).
 */

import type { Timestamp } from 'firebase/firestore'

/* ─────────────────────────────────────────────────────────────
   회원 — support_users/{uid}   (D-6 / D-23 / D-25)
   지원사업 전용 Firebase 프로젝트를 쓰므로 인증 신원(uid)도
   iLINE과 완전히 별개다 (D-25). 다만 판별 규칙은 그대로다 —
   "로그인 여부"가 아니라 "이 문서의 존재 여부"로 접근을 판단한다.
   계정을 만들었더라도 이 문서가 없으면 회원이 아니다.
   ───────────────────────────────────────────────────────────── */

export type SupportRole = 'applicant' | 'staff'
export type MemberStatus = 'active' | 'withdrawn'

/**
 * 동의 이력 (§2-2 ①)
 *
 * ⚠️ 거부(agreed: false)도 반드시 기록한다.
 *    특히 초상권은 나중에 "이 사람 사진을 갤러리에 써도 되는가"를
 *    판단해야 하므로, "동의 안 함"이 명시적으로 남아야 한다.
 *    기록이 없는 것과 거부한 것은 다르다.
 */
export type ConsentPurpose =
  /** 개인정보 수집·이용 (필수) */
  | 'personal_info'
  /** 사진·영상 촬영 및 초상권 활용 (선택) */
  | 'portrait'
  /** 증빙 서류(신분증 등) 수집 — 신청 단계에서 별도 수집 */
  | 'identity_document'

export interface Consent {
  purpose: ConsentPurpose
  /** 동의 여부 — false(거부)도 그대로 남긴다 */
  agreed: boolean
  /** 약관 버전 — 문구가 바뀌면 올린다 */
  version: string
  agreedAt: Timestamp
}

export interface SupportUser {
  uid: string
  /** 회원가입 시 인증한 이메일 — 별도로 받지 않는다 */
  email: string
  /** 'google' | 'password' */
  authProvider: string

  name: string
  /** 학번 */
  studentId: string
  /** 전공 (학과) */
  major: string
  /** 학년 — '1' ~ '4', '5' 이상, '대학원', '기타' */
  grade: string
  phone: string

  role: SupportRole
  status: MemberStatus
  consents: Consent[]

  createdAt: Timestamp
  updatedAt: Timestamp
}

/** 초상권 활용에 동의했는가 — 갤러리 활동사진 게시 판단에 쓴다 */
export function hasPortraitConsent(user: SupportUser | null): boolean {
  if (!user) return false
  return user.consents.some((c) => c.purpose === 'portrait' && c.agreed)
}

/* ─────────────────────────────────────────────────────────────
   프로그램 — support_programs/{programId}
   
   사업 안에 여러 프로그램이 있고, 프로그램마다 신청 방식과
   신청서 항목이 다르다. 그래서 "신청서 폼"을 하나로 고정하지 않고
   프로그램에 붙여둔다.
   ───────────────────────────────────────────────────────────── */

/**
 * 참여 방식 (사용자 확정)
 *
 *  individual — 개인 신청. **기본값.** 팀으로 활동하더라도 구성원이 각자 신청한다.
 *  group      — 단체 프로그램. 대표자가 신청하며 팀원 명단을 함께 제출한다.
 *
 * ⚠️ group 인 경우 대표자가 팀원의 이름·학번·연락처를 대신 입력하므로
 *    **제3자 개인정보 대리 수집**이 발생한다. 반드시
 *    "팀원 전원의 동의를 받았음" 확인을 받아야 한다.
 */
export type ParticipationType = 'individual' | 'group'

export interface Program {
  id: string
  year: number
  title: string
  participationType: ParticipationType
  /** 단체 프로그램일 때 최대 인원 (대표자 포함) */
  maxTeamSize?: number
  description?: string
  /** 접수 기간 */
  opensAt?: Timestamp
  closesAt?: Timestamp

  /* ── 신청서 구성 (D-29) — 전부 선택 ─────────────────────────
     프로그램마다 신청 항목이 달라지는 문제를, 폼 빌더를 만드는 대신
     '자유 기재란 하나 + 첨부 하나'로 흡수한다.
     값이 없으면 그 칸 자체가 화면에 나타나지 않는다. */

  /** 자유 기재란의 이름 (예: '지원 동기'). 없으면 칸이 없다 */
  noteLabel?: string
  noteRequired?: boolean
  /** 첨부 안내 문구. 없으면 첨부란이 없다 */
  attachmentGuide?: string
  attachmentRequired?: boolean

  /* ── 정산 구성 (D-41) ────────────────────────────────────
     정산에 영수증이 필요한 프로그램도, 계좌만 받으면 되는 프로그램도 있다.
     신청서와 같은 방식으로 **프로그램이 정한다**. */

  /** 정산 안내 문구. 없으면 기본 문구가 나간다 */
  settlementGuide?: string
  /**
   * 영수증을 반드시 내야 하는가.
   * **값이 없으면 필수로 본다** — 증빙 없이 지급되는 쪽이 더 위험하다.
   */
  settlementReceiptRequired?: boolean

  /** 공개 여부 — 준비 중인 프로그램은 감춘다 */
  published: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}

/**
 * 단체 프로그램 신청 시 제출하는 팀원 정보.
 * 종이 양식(역할·이름·학번·전공·학년·연락처·이메일)과 같은 항목이다.
 */
export interface TeamMember {
  /** 역할 — '팀장' | '팀원' 등 자유 입력 */
  role: string
  name: string
  studentId: string
  major: string
  grade: string
  phone: string
  email: string
}

/* ─────────────────────────────────────────────────────────────
   신청서 — support_applications/{appId}   (D-29)

   신청자는 개인정보를 다시 입력하지 않는다. 회원 정보를 확인만 하고,
   제출 시점에 그 값을 **복사해서 신청서에 박아둔다**(스냅샷).
   회원이 나중에 연락처를 바꿔도 제출 당시의 신청서는 그대로여야 하고,
   D-28의 PDF가 '원본'이 되려면 이게 전제다.
   ───────────────────────────────────────────────────────────── */

/** 제출 시점의 신청자 정보 사본. 이후 회원 정보가 바뀌어도 변하지 않는다 */
export interface ApplicantSnapshot {
  name: string
  studentId: string
  major: string
  grade: string
  phone: string
  email: string
  /** 동의 여부 — 시트에 O/X 로 나간다 */
  personalInfoConsent: boolean
  portraitConsent: boolean
}

export type ApplicationStatus =
  | 'draft' // 작성 중
  | 'submitted' // 제출 완료
  | 'reviewing' // 검토 중
  | 'revision' // 보완 요청
  | 'approved' // 선정
  | 'rejected' // 미선정
  // 취소 — 신청자 요청 등으로 담당자가 물린 건. **지우지 않고 상태로 남긴다.**
  // 지워버리면 "신청한 적 있다"는 사실 자체가 사라져서 나중에 확인할 수 없다.
  | 'cancelled'

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  draft: '작성 중',
  submitted: '제출 완료',
  reviewing: '검토 중',
  revision: '보완 요청',
  approved: '선정',
  rejected: '미선정',
  cancelled: '취소됨',
}

/** 첨부 파일 — Storage 원본 + 공유 드라이브 사본 (D-9) */
export interface AttachedFile {
  /** 'id_card' | 'employment_cert' | 'receipt' | ... */
  type: string
  storagePath: string
  driveFileId?: string
  fileName: string
  size: number
  uploadedAt: Timestamp
}

export interface Application {
  id: string
  uid: string
  year: number
  status: ApplicationStatus

  /** 어느 프로그램에 신청했는가 */
  programId: string
  /** 신청 당시의 프로그램 이름 사본 — 프로그램이 수정돼도 이력이 남는다 */
  programTitle?: string
  /** 신청 시점의 참여 방식 스냅샷 — 프로그램 설정이 바뀌어도 이력은 남는다 */
  participationType: ParticipationType

  /**
   * 단체 프로그램일 때만 채워진다 (participationType === 'group').
   * 개인 신청이면 비어 있다.
   */
  teamName?: string
  teamMembers?: TeamMember[]
  /** 팀원 전원의 개인정보 제공 동의를 받았다는 대표자 확인 */
  teamConsentConfirmed?: boolean

  /** 제출 시점의 신청자 정보 사본 (D-29) */
  applicant: ApplicantSnapshot

  /** 프로그램의 noteLabel 에 대한 답. 요구하지 않은 프로그램이면 없다 */
  note?: string
  /** 답을 어떤 이름으로 물었는지 — 나중에 프로그램 설정이 바뀌어도 이력이 남는다 */
  noteLabel?: string

  files: AttachedFile[]

  /** 제출 시 자동 생성한 신청서 PDF (§2-3 ④) */
  generatedPdfPath?: string

  /** 시트 동기화 상태 (D-7) */
  sheetRowId?: string
  sheetSyncedAt?: Timestamp

  /** 공유 드라이브 신청건 폴더 (D-9) */
  driveFolderId?: string
  driveFolderUrl?: string
  driveSyncedAt?: Timestamp
  driveSyncError?: string

  /** 보완 요청·미선정 사유 (담당자 입력, D-10) */
  reviewNote?: string
  reviewedBy?: string
  reviewedAt?: Timestamp

  submittedAt?: Timestamp
  createdAt: Timestamp
  updatedAt: Timestamp
}

/* ─────────────────────────────────────────────────────────────
   정산 — support_settlements/{id}
   신청 1건 : 정산 1건 (v0.11). 팀이어도 각자 신청하므로 개인 단위.
   팀 공동 경비는 다루지 않는다 (D-18).
   ───────────────────────────────────────────────────────────── */

export type SettlementStatus = 'draft' | 'submitted' | 'approved' | 'rejected'

export const SETTLEMENT_STATUS_LABEL: Record<SettlementStatus, string> = {
  draft: '작성 중',
  submitted: '제출 완료',
  approved: '승인',
  rejected: '반려',
}

/**
 * 정산 (D-39) — 최소 구성.
 *
 * 지출 항목을 줄 단위로 받지 않는다. 신청서에서와 같은 판단이다(D-29):
 * 회차마다 달라지는 항목을 미리 예측해 폼에 넣으려 하면 만들다 막힌다.
 * **계좌 3칸 + 영수증 파일**이 전부다.
 *
 * ⚠️ 금액 칸이 없다. 담당자가 영수증을 열어 읽고 직접 합산한다(09-06 확정).
 *    건수가 늘어 부담이 되면 숫자 한 칸을 추가하면 된다.
 *
 * ⚠️ `bankInfo` 는 **시트·드라이브로 절대 내보내지 않는다**(D-38).
 *    사이트 안에서 담당자만 본다. 영수증은 드라이브 `02_정산` 으로 나간다.
 */
export interface Settlement {
  id: string
  /** 어느 신청건에 대한 정산인가 — 선정된 건에만 붙는다 */
  applicationId: string
  uid: string
  status: SettlementStatus

  /** 신청 당시 정보 사본 — 신청서가 바뀌어도 정산 이력은 남는다 */
  programId: string
  programTitle?: string
  applicantName?: string

  /** 지급 계좌 — 사이트 밖으로 나가지 않는다 */
  bankInfo: {
    bankName: string
    accountNumber: string
    accountHolder: string
  }

  /** 영수증 등 지출 증빙 */
  receipts: AttachedFile[]

  /** 담당자가 남기는 안내 — 신청자에게 그대로 보인다 */
  reviewNote?: string
  reviewedBy?: string
  reviewedAt?: Timestamp

  /* 시트·드라이브 반영 상태 (신청서와 같은 방식) */
  driveFolderUrl?: string
  driveSyncError?: string
  sheetRowId?: number
  sheetSyncedAt?: Timestamp

  submittedAt?: Timestamp
  createdAt: Timestamp
  updatedAt: Timestamp
}

/* ─────────────────────────────────────────────────────────────
   갤러리 — support_outputs/{id}   (D-12 / D-15 / D-17)
   산출물 / 활동사진 2뎁스. 팀은 텍스트 표기만 (J1).
   담당자가 승인한 것만 공개된다.
   ───────────────────────────────────────────────────────────── */

export type OutputCategory = 'output' | 'photo'
export type OutputType = 'lesson-plan' | 'video' | 'case' | 'etc'
export type Visibility = 'public' | 'member' | 'selected'

export interface Contributor {
  name: string
  affiliation?: string
}

export interface Output {
  id: string
  applicationId?: string
  submittedByUid: string

  category: OutputCategory
  type: OutputType

  /** 'individual' | 'team' (D-17) */
  activityType: 'individual' | 'team'
  /** 팀 활동일 때. 자유 입력 + 자동완성 */
  teamName?: string
  /** 갤러리 표기용 — 팀명 또는 개인명 */
  ownerName: string
  contributors: Contributor[]

  title: string
  description?: string
  tags: string[]
  files: AttachedFile[]
  /** YouTube 임베드 URL — Storage 직접 서빙 금지 (§6-2 ④) */
  videoUrl?: string

  /** 담당자 공개 승인 (§4-3) — 승인 전에는 갤러리에 노출되지 않는다 */
  approved: boolean
  approvedBy?: string
  approvedAt?: Timestamp
  visibility: Visibility

  createdAt: Timestamp
  updatedAt: Timestamp
}

/* ─────────────────────────────────────────────────────────────
   알림마당 — support_notices / support_resources
   ───────────────────────────────────────────────────────────── */

export interface Notice {
  id: string
  title: string
  content: string
  pinned: boolean
  authorUid: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface Resource {
  id: string
  title: string
  description?: string
  files: AttachedFile[]
  authorUid: string
  createdAt: Timestamp
}
