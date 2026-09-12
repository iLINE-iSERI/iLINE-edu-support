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
 *    "동의 안 함"이 명시적으로 남아야 한다 —
 *    **기록이 없는 것과 거부한 것은 다르다.**
 *    그래서 묻지 않은 항목은 줄 자체를 만들지 않는다.
 *
 * ⚠️ **회원 문서의 `consents` 에는 이제 `personal_info` 하나만 들어간다.**
 *    초상권은 가입이 아니라 **프로그램 신청서**에서 받는다(D-44) —
 *    `Application.applicant.portraitConsent` 를 보라.
 *    가입 시점 초상권 기록이 남아 있는 옛 회원 문서가 있을 수 있는데,
 *    **그 값은 더 이상 어디에서도 읽지 않는다.**
 */
export type ConsentPurpose =
  /** 개인정보 수집·이용 (필수) — 가입 단계 */
  | 'personal_info'
  /** 사진·영상 촬영 및 초상권 활용 — **신청 단계로 이동(D-44).** 옛 문서 호환용 */
  | 'portrait'
  /** 증빙 서류 수집 — **D-40 으로 폐기.** 서류를 아예 받지 않는다. 옛 문서 호환용 */
  | 'identity_document'

export interface Consent {
  purpose: ConsentPurpose
  /** 동의 여부 — false(거부)도 그대로 남긴다 */
  agreed: boolean
  /** 약관 버전 — 문구가 바뀌면 올린다 */
  version: string
  agreedAt: Timestamp
}

/**
 * 회원 유형 (D-43)
 *
 * 처음에는 예비교원(학생)만 받는 전제로 학번·학년을 필수로 두었는데,
 * **교원과 일반인도 가입해야 한다**는 요구가 나왔다(09-06 교수님).
 * 유형에 따라 물어보는 것이 달라지므로 여기서 갈라준다.
 *
 * '교원'은 대학 교수와 초·중등 교사를 모두 포함한다. 사업명이
 * '교원양성'이라 용어를 맞췄다 — '교수'로 하면 현직 교사가 어디에
 * 속하는지 망설이게 된다.
 */
export type MemberType = 'student' | 'teacher' | 'general'

export const MEMBER_TYPE_LABEL: Record<MemberType, string> = {
  student: '학생',
  teacher: '교원',
  general: '일반',
}

/** 값이 없는 옛 회원은 학생으로 본다 — 그때는 학생만 받았다 */
export function memberTypeOf(t?: MemberType): MemberType {
  return t ?? 'student'
}

export interface SupportUser {
  uid: string
  /** 회원가입 시 인증한 이메일 — 별도로 받지 않는다 */
  email: string
  /** 'google' | 'password' */
  authProvider: string

  name: string
  /** 회원 유형 (D-43) — 값이 없는 옛 회원은 학생으로 본다 */
  memberType?: MemberType
  /** 소속 — 학생: 대학명 · 교원: 재직 기관 · 일반: 소속(선택) */
  affiliation: string
  /** 학과·전공 (학생·교원) — 교원은 담당 교과를 적기도 한다 */
  major: string
  /** 학번 — 학생만 */
  studentId: string
  /** 학년 — 학생만. '1'~'4', '5+', 'grad', 'etc' */
  grade: string
  /** 직위·직함 — 교원(교수·강사·교사 등)과 일반(선택) */
  position: string
  phone: string

  role: SupportRole
  status: MemberStatus
  consents: Consent[]

  createdAt: Timestamp
  updatedAt: Timestamp
}

/**
 * 이 **신청건**의 활동 사진을 갤러리·자료집에 써도 되는가 (D-44).
 *
 * ⚠️ 회원이 아니라 **신청서**를 받는다. 초상권 동의는 프로그램마다 따로
 *    받으므로 "이 사람이 동의했는가"라는 질문 자체가 성립하지 않는다.
 *    같은 사람이 A 프로그램은 동의하고 B 프로그램은 거부할 수 있다.
 *    사진을 올릴 때는 **그 사진이 나온 프로그램의 신청건**을 봐야 한다.
 */
export function hasPortraitConsent(
  application: { applicant?: { portraitConsent?: boolean } } | null
): boolean {
  return application?.applicant?.portraitConsent === true
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

  /**
   * 이 프로그램 **전용 신청 항목**의 식별자 (D-50).
   *
   * 없으면 기본 신청서(자유 기재란 + 첨부)만 나온다 — 지금까지의 모든
   * 프로그램이 그렇다. 값이 있으면 그 이름의 전용 화면이 신청서 안에
   * 끼워진다. 등록된 양식은 `lib/forms/index.ts` 참고.
   *
   * ⚠️ **범용 폼 빌더를 만들지 않기로 한 것이 D-29 다.** 프로그램마다
   *    항목이 다르다고 '모든 경우를 담는 폼'을 설계하려다 막혔던 적이 있다.
   *    그래서 프로그램별로 **화면을 하나씩 따로** 만들고, 이 값으로 고른다.
   *    양식이 서너 개 쌓이고 공통점이 보이면 그때 묶어도 늦지 않다.
   */
  formType?: string

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
/**
 * 제출 시점의 신청자 정보 사본.
 *
 * 회원이 나중에 정보를 고쳐도 **낸 신청서는 그대로여야** 하므로 복사해 둔다.
 * 유형(D-43)에 따라 채워지는 칸이 다르다 — 교원·일반은 학번·학년이 비고,
 * 학생은 직위가 빈다.
 */
export interface ApplicantSnapshot {
  name: string
  memberType?: MemberType
  /** 소속 — 대학명 · 재직 기관 등 */
  affiliation?: string
  major: string
  studentId: string
  grade: string
  /** 직위·직함 — 교원·일반 */
  position?: string
  phone: string
  email: string
  /** 개인정보 수집·이용 동의 — **회원 문서에서 복사**한 값 (가입 시 받음) */
  personalInfoConsent: boolean
  /**
   * 초상권 활용 동의 — **이 신청서에서 직접 받은 답** (D-44).
   *
   * 회원 문서에서 복사해 오는 값이 아니다. 신청할 때마다 다시 묻고,
   * 그 프로그램의 활동 사진에 대한 답으로 여기 남는다.
   * 동의한 문구의 버전은 `Application.portraitConsentVersion`,
   * 동의한 시각은 `Application.submittedAt`(서버 시각)이다.
   */
  portraitConsent: boolean
}

/**
 * 유형에 맞는 '신분' 한 줄 — 시트·PDF·목록에서 공통으로 쓴다.
 *
 *   학생 → '20260000 · 3학년'
 *   교원 → '부교수'
 *   일반 → '연구원' (없으면 빈 문자열)
 */
export function identityLine(a: {
  memberType?: MemberType
  studentId?: string
  grade?: string
  position?: string
}): string {
  if (memberTypeOf(a.memberType) === 'student') {
    const g = a.grade ? GRADE_LABEL[a.grade] ?? a.grade : ''
    return [a.studentId, g].filter(Boolean).join(' · ')
  }
  return a.position ?? ''
}

/**
 * 유형에 맞는 인적사항 표 — **화면·PDF·담당자 목록이 모두 이걸 쓴다** (D-43).
 *
 * 유형과 상관없이 칸을 고정해 두면 교원 신청서에 '학번 —', '학년 —' 같은
 * 빈칸이 남는다. 그 빈칸은 "안 적은 것"인지 "물어보지 않은 것"인지 구분되지
 * 않아서, 담당자가 신청자에게 다시 물어보게 만든다.
 * 그래서 **물어보지 않은 칸은 아예 만들지 않는다.**
 *
 * 한 군데서 만들어 쓰는 이유: 화면과 PDF 가 각자 목록을 갖고 있으면
 * 한쪽만 고쳤을 때 **신청자가 본 것과 제출된 것이 달라진다.**
 *
 * SupportUser 와 ApplicantSnapshot 이 같은 칸 이름을 쓰므로 둘 다 들어온다.
 */
export function profileRows(p: {
  memberType?: MemberType
  name?: string
  affiliation?: string
  major?: string
  studentId?: string
  grade?: string
  position?: string
  phone?: string
  email?: string
}): [string, string][] {
  const type = memberTypeOf(p.memberType)
  const rows: [string, string][] = [
    ['회원 유형', MEMBER_TYPE_LABEL[type]],
    ['이름', p.name ?? ''],
  ]

  if (type === 'student') {
    rows.push(
      ['소속 대학', p.affiliation ?? ''],
      ['학과·전공', p.major ?? ''],
      ['학번', p.studentId ?? ''],
      ['학년', p.grade ? GRADE_LABEL[p.grade] ?? p.grade : '']
    )
  } else if (type === 'teacher') {
    rows.push(
      ['소속 기관', p.affiliation ?? ''],
      ['학과·담당 교과', p.major ?? ''],
      ['직위', p.position ?? '']
    )
  } else {
    // 일반 — 소속·직함은 선택 항목이라 비어 있으면 줄 자체를 넣지 않는다
    if (p.affiliation) rows.push(['소속', p.affiliation])
    if (p.position) rows.push(['직함', p.position])
  }

  rows.push(['연락처', p.phone ?? ''], ['이메일', p.email ?? ''])
  return rows
}

/** 학년 코드 → 사람이 읽는 말 */
export const GRADE_LABEL: Record<string, string> = {
  '1': '1학년',
  '2': '2학년',
  '3': '3학년',
  '4': '4학년',
  '5+': '5학년 이상',
  grad: '대학원',
  etc: '기타',
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

/**
 * 상태 이름표.
 *
 * ⚠️ `reviewing`('검토 중')은 **09-08부터 새로 부여하지 않는다** (D-49).
 *    담당자 화면의 버튼에서 뺐다. 여기 남겨둔 것은 **옛 문서 호환용**이다 —
 *    지우면 그 값을 가진 문서가 화면에서 빈칸으로 보인다.
 */
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

  /**
   * 프로그램 **전용 항목의 답** (D-50).
   *
   * ⚠️ 키가 아니라 **라벨과 값을 함께** 저장한다. 코드에 라벨 표를 두고
   *    키만 저장하면, 나중에 그 양식 코드를 고치거나 지웠을 때 **옛 신청서가
   *    무슨 질문에 답한 것인지 알 수 없게 된다.** 신청서는 제출 시점의
   *    원본이어야 하므로(D-28 / D-29), 질문 문구도 그때 그대로 박아둔다.
   *
   *    덕분에 시트·PDF·담당자 화면은 **양식을 몰라도 그대로 뿌릴 수 있다.**
   */
  formData?: { label: string; value: string }[]

  /**
   * 신청자가 스스로 취소하며 남긴 사유 (D-48 · 선택).
   *
   * 담당자가 적는 `reviewNote` 와 **방향이 반대다** — 이건 신청자가 담당자에게
   * 남기는 말이고, 담당자 화면에만 보인다. 취소가 잦아질 때 **왜 그런지 알 수
   * 있는 유일한 단서**라서 선택으로라도 받아둔다.
   */
  cancelReason?: string
  /** 취소 시각 — 담당자 취소든 본인 취소든 여기 남는다 */
  cancelledAt?: Timestamp

  /**
   * 초상권 동의서의 문구 버전 (D-44).
   *
   * 동의 자체는 `applicant.portraitConsent`, 동의 시각은 `submittedAt`.
   * **버전이 없으면 "어느 문구에 동의한 것인지" 나중에 증명할 수 없다.**
   * 동의서 문구를 고칠 때는 `CONSENT_VERSION` 을 반드시 올린다.
   */
  portraitConsentVersion?: string

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

/**
 * 정산 상태.
 *
 * `paid`(지급 완료)는 09-12에 추가했다 — 승인은 "서류가 맞다"이고 지급은
 * "돈이 나갔다"라 다른 사건인데, 승인에서 끝나면 담당자가 바뀌었을 때
 * **누구에게 보냈고 누구에게 안 보냈는지** 사이트에서 알 수 없다.
 * 승인 → 지급 완료 순서만 있고, 지급 완료에서 되돌리는 화면은 두지 않는다.
 */
export type SettlementStatus = 'draft' | 'submitted' | 'approved' | 'paid' | 'rejected'

export const SETTLEMENT_STATUS_LABEL: Record<SettlementStatus, string> = {
  draft: '작성 중',
  submitted: '제출 완료',
  approved: '승인',
  paid: '지급 완료',
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

  /**
   * 영수증 등 지출 증빙 — **선택이다** (D-41).
   *
   * 증빙이 필요한 회차도 계좌만 받으면 되는 회차도 있어서, 프로그램마다
   * 설정을 두는 대신 **항상 낼 수 있게** 두었다. 필요 여부는 공고문과
   * 담당자의 검토가 판단한다 — 증빙이 없어야 하는데 왔거나 있어야 하는데
   * 없으면, 담당자가 반려하면서 사유를 적으면 된다.
   */
  receipts: AttachedFile[]

  /** 담당자가 남기는 안내 — 신청자에게 그대로 보인다 */
  reviewNote?: string
  reviewedBy?: string
  reviewedAt?: Timestamp

  /** 지급 완료 (09-12) — 실제로 이체한 날. 담당자가 적는다 */
  paidAt?: Timestamp
  paidBy?: string
  /** 지급 메모 — 담당자만 본다 (예: 계좌 오류로 재이체) */
  paidNote?: string

  /* 시트·드라이브 반영 상태 (09-12 · D-65) — 영수증은 드라이브 02_정산,
     시트는 「정산」 탭 한 줄. 계좌는 나가지 않는다. sheetRowId 가 있으면
     다음 반영 때 그 줄을 고친다 (재제출·승인·지급 완료가 같은 줄에). */
  driveFolderUrl?: string
  driveSyncError?: string
  sheetRowId?: number | null
  sheetSyncedAt?: Timestamp
  driveSyncedAt?: Timestamp

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

/* ─────────────────────────────────────────────────────────────
   시설 예약 — support_reservations/{id}   (D-52 · D-53 · D-55)

   지원사업 회원에게 사범대 공부실을 예약해 주는 기능.
   우리 시스템은 **진실의 원천이 아니다** — 시설은 사범대 것이고 최종
   권한은 행정실에 있다. 그래서 상태가 두 단계다:
     received(접수됨) → (목요일 행정실 전달) → confirmed(확정됨)
   정책·근거는 docs/4-기록/06-시설예약-설계.md.
   ───────────────────────────────────────────────────────────── */

/** 공간 코드 — 예약번호 접두어이기도 하다 (설계 §3) */
export type VenueCode = 'ML' | 'ST' | 'GR'

export type ReservationStatus =
  /** 신청 접수됨 — 아직 행정실에 보내지 않음 */
  | 'received'
  /** 행정실 전달 완료 — 확정 */
  | 'confirmed'
  | 'cancelled'

export const RESERVATION_STATUS_LABEL: Record<ReservationStatus, string> = {
  received: '접수됨',
  confirmed: '확정됨',
  cancelled: '취소됨',
}

/**
 * 예약 한 건.
 *
 * 신청자 정보는 회원 문서에서 **복사**해 넣는다 (D-28 스냅샷 원칙).
 * 예약 뒤 회원이 연락처를 바꿔도 이 예약에는 예약 당시 값이 남는다 —
 * 행정실에 보낸 명단과 어긋나지 않게 하기 위해서다.
 */
export interface Reservation {
  id: string
  /** 말로 전하는 이름표 — `ST-260922-K3QD` (설계 §3). 조회 열쇠가 아니다 */
  code: string
  uid: string
  applicant: ApplicantSnapshot

  venue: VenueCode
  /** 자리 번호 — 랩실 '1'~'3' · 좌석 '01'~'12' · 테이블 '1'~'4' */
  seat: string
  /** 이용일 `YYYY-MM-DD` (로컬 날짜, 시간대 없음) */
  date: string
  /** 시작 시각 (정시, 24시간제) */
  startHour: number
  /** 길이 — 1 또는 2 (설계 §2-3: 최대 2시간) */
  hours: number

  status: ReservationStatus
  /** member — 회원이 직접 · staff — 담당자 직접 추가(D-53 ⑥, 2단계) */
  source: 'member' | 'staff'
  /** 담당자 직접 추가일 때 이름을 직접 적을 수 있다 (단체명 등) */
  displayName?: string
  staffNote?: string

  createdAt: Timestamp
  updatedAt: Timestamp
  /** 행정실 전달 시각 — 있으면 확정됨 */
  deliveredAt?: Timestamp
  deliveryId?: string
  cancelledAt?: Timestamp
  /**
   * **확정된 뒤** 취소되어 행정실에 아직 알리지 않은 것 — 명단의 「취소」 묶음이
   * 이 값으로 조회된다(설계 §5-5). 취소 시 `이전 상태 == confirmed` 로 정해지며
   * 규칙이 그 값을 검사한다. 전달 완료 뒤 false 로 바뀐다.
   */
  cancelNoticePending?: boolean
  /** 확정 뒤 취소된 것을 행정실에 알린 시각 */
  cancelDeliveredAt?: Timestamp
  cancelDeliveryId?: string
}

/**
 * 행정실 전달 한 번 = 문서 하나 — support_reservation_deliveries/{id}
 * (설계 §5-5). "지난 전달: 9/10(목)" 표시와 **되돌리기**가 이 문서 하나로 된다.
 */
export interface ReservationDelivery {
  id: string
  deliveredAt: Timestamp
  byUid: string
  /** 새 요청으로 보낸 예약 ID */
  newIds: string[]
  /** 취소로 알린 예약 ID */
  cancelIds: string[]
  /** 되돌린 시각 — 있으면 이 전달은 무효 */
  undoneAt?: Timestamp
}

/**
 * 예약 운영 설정 — support_reservation_settings/main  (D-53 · D-55)
 *
 * 요일·범위를 코드에 박지 않는 이유: 관리자가 학생이라 시간표에 따라
 * 편한 요일이 달라진다. 문서가 없으면 코드의 기본값을 쓴다.
 *
 * 🔴 아래 기본값은 **교수님 답을 기다리지 않으려고 임의로 정한 가정값**이다.
 *    접수 개시 전에 실제 값으로 확인해야 한다 — docs/3-할일/02 J 표.
 */
export interface ReservationSettings {
  /** 마감 요일 — 0=일 … 3=수 … 6=토 */
  closeWeekday: number
  /** 마감 시각 (정시) */
  closeHour: number
  /** 전달 요일 */
  deliverWeekday: number
  /** 앞으로 몇 주까지 받나 */
  rangeWeeks: number
  /** 휴관일 `YYYY-MM-DD` 목록 — 시험 기간 등 */
  closedDates: string[]
  updatedAt?: Timestamp
}

export const DEFAULT_RESERVATION_SETTINGS: ReservationSettings = {
  closeWeekday: 3,
  closeHour: 18,
  deliverWeekday: 4,
  rangeWeeks: 4,
  closedDates: [],
}
