/**
 * 창의재단 교원양성지원사업 — 도메인 타입
 *
 * 작업지시서 §6-3 스키마 기준. 컬렉션은 모두 `support_` 접두어로
 * 그뤠잇 데이터와 분리한다 (D-8).
 */

import type { Timestamp } from 'firebase/firestore'

/* ─────────────────────────────────────────────────────────────
   회원 — support_users/{uid}   (D-6 / D-8 / D-23)
   인증 신원(uid)은 그뤠잇과 공유하되, 이 문서가 있어야
   창의재단 회원으로 인정한다. "로그인 여부"가 아니라
   "이 문서의 존재 여부"로 접근을 판단한다.
   ───────────────────────────────────────────────────────────── */

export type SupportRole = 'applicant' | 'staff'
export type MemberStatus = 'active' | 'withdrawn'

/** 개인정보 수집·이용 동의 이력 (§2-2 ①) */
export interface Consent {
  /** 동의 목적 — 예: 'signup', 'identity_document', 'settlement' */
  purpose: string
  /** 약관 버전 — 문구가 바뀌면 올린다 */
  version: string
  agreedAt: Timestamp
}

export interface SupportUser {
  uid: string
  email: string
  /** 'google' | 'password' */
  authProvider: string

  name: string
  affiliation: string // 소속 (학교/기관)
  position: string // 직위
  phone: string

  role: SupportRole
  status: MemberStatus
  consents: Consent[]

  createdAt: Timestamp
  updatedAt: Timestamp
}

/* ─────────────────────────────────────────────────────────────
   신청서 — support_applications/{appId}
   ⏸ 세부 필드는 H-1(폼 명세) 확정 후 채운다.
   ───────────────────────────────────────────────────────────── */

export type ApplicationStatus =
  | 'draft' // 작성 중
  | 'submitted' // 제출 완료
  | 'reviewing' // 검토 중
  | 'revision' // 보완 요청
  | 'approved' // 선정
  | 'rejected' // 미선정

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  draft: '작성 중',
  submitted: '제출 완료',
  reviewing: '검토 중',
  revision: '보완 요청',
  approved: '선정',
  rejected: '미선정',
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

  /** ⏸ H-1 대기 — 폼 명세 확정 시 구체 타입으로 대체 */
  applicantInfo?: Record<string, unknown>
  projectPlan?: Record<string, unknown>

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

export interface SettlementItem {
  /** 'transport' | 'lodging' | 'meal' | ... */
  category: string
  amount: number
  receiptPath: string
  driveFileId?: string
  memo?: string
}

export interface Settlement {
  id: string
  applicationId: string
  uid: string
  status: SettlementStatus
  totalAmount: number
  /** 계좌 정보 — 민감정보. Rules로 본인·담당자만 읽기 */
  bankInfo?: {
    bankName: string
    accountNumber: string
    accountHolder: string
  }
  items: SettlementItem[]
  driveFolderId?: string
  reviewNote?: string
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
