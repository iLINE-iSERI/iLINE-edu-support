// 신청서 (support_applications) — D-29
//
// 설계 요지는 docs/4-기록/01-신청서-설계.md 참고.
// 핵심: 신청자는 개인정보를 다시 입력하지 않는다. 제출 시점에
//       회원 정보를 **복사해서** 신청서에 박아둔다.

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
  serverTimestamp,
  writeBatch,
  Timestamp,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { getDb, getStorageClient, COL, STORAGE_ROOT } from './config'
import { CONSENT_VERSION } from './members'
import type {
  Application,
  ApplicantSnapshot,
  AttachedFile,
  Program,
  SupportUser,
} from '@/lib/types'

/**
 * 회원 정보 → 제출 시점 스냅샷.
 *
 * ⚠️ **초상권 동의만은 회원 문서에서 오지 않는다** (D-44). 이 신청서에서
 *    방금 받은 답을 인자로 받는다. 회원 문서를 읽어버리면 가입 때의 옛 답이
 *    조용히 딸려 들어와, 신청 화면에서 '동의하지 않음'을 골라도 시트에는
 *    'O' 가 찍히게 된다. **화면과 기록이 어긋나는 종류의 사고**라
 *    아무도 눈치채지 못한 채 사진이 게시될 수 있다.
 */
export function snapshotOf(
  member: SupportUser,
  portraitConsent: boolean
): ApplicantSnapshot {
  const agreed = (purpose: string) =>
    member.consents.some((c) => c.purpose === purpose && c.agreed)

  return {
    name: member.name,
    // 유형(D-43)에 따라 채워지는 칸이 다르다. 없는 값은 빈 문자열 —
    // Firestore 는 undefined 를 저장하지 못한다.
    memberType: member.memberType ?? 'student',
    affiliation: member.affiliation ?? '',
    major: member.major ?? '',
    studentId: member.studentId ?? '',
    grade: member.grade ?? '',
    position: member.position ?? '',
    phone: member.phone,
    email: member.email,
    // 가입 때 받은 것 (회원 문서에서 복사)
    personalInfoConsent: agreed('personal_info'),
    // 이 신청서에서 방금 받은 것 (위 주석 참고)
    portraitConsent,
  }
}

/** 첨부 파일 업로드 — 본인 경로에만 올라간다 (Storage 규칙과 일치) */
async function uploadAttachment(
  uid: string,
  appId: string,
  file: File
): Promise<Omit<AttachedFile, 'uploadedAt'>> {
  // 파일명에 한글·공백이 섞여도 경로가 깨지지 않도록 정리한다.
  const safeName = file.name.replace(/[^\w.\-가-힣]/g, '_')
  const path = `${STORAGE_ROOT}/applications/${uid}/${appId}/${Date.now()}_${safeName}`

  await uploadBytes(ref(getStorageClient(), path), file)

  return {
    type: 'application',
    storagePath: path,
    fileName: file.name,
    size: file.size,
    // uploadedAt 은 문서를 저장할 때 채운다 (아래 주석 참고).
  }
}

export interface SubmitInput {
  program: Program
  member: SupportUser
  uid: string
  /**
   * 초상권 활용 동의 — 이 신청서에서 받은 답 (D-44).
   * 선택 항목이지만 **답은 반드시 골라야** 여기까지 온다 (거부도 기록 대상).
   */
  portraitConsent: boolean
  /** 프로그램 전용 항목의 답 (D-50) — 라벨과 값을 함께 저장한다 */
  formData?: { label: string; value: string }[]
  note?: string
  files: File[]
  /** 제출 시점에 만든 신청서 PDF (D-28). 없으면 그냥 넘어간다 */
  pdf?: Blob | null
}

/**
 * 신청서 제출.
 *
 * 임시저장을 두지 않으므로 바로 `submitted` 상태로 만든다 (D-29).
 *
 * ⚠️ 문서 ID를 **미리 만들고** 파일부터 올린 뒤 마지막에 문서를 쓴다.
 *    이유가 둘이다.
 *      · 첨부와 PDF를 신청건별 폴더에 모을 수 있다
 *      · 제출된(submitted) 신청서는 규칙상 신청자가 수정할 수 없다.
 *        문서를 먼저 만들고 나중에 PDF 경로를 덧붙이려 하면 막힌다.
 *    업로드가 중간에 실패하면 문서가 아예 안 만들어지므로,
 *    '첨부 없는 신청서'가 남는 일도 없다.
 */
export async function submitApplication(input: SubmitInput): Promise<string> {
  const { program, member, uid, portraitConsent, formData, note, files, pdf } = input

  const appRef = doc(collection(getDb(), COL.applications))
  const base = `${STORAGE_ROOT}/applications/${uid}/${appRef.id}`

  const attached: Omit<AttachedFile, 'uploadedAt'>[] = []
  for (const f of files) {
    attached.push(await uploadAttachment(uid, appRef.id, f))
  }

  let generatedPdfPath: string | undefined
  if (pdf) {
    generatedPdfPath = `${base}/신청서.pdf`
    await uploadBytes(ref(getStorageClient(), generatedPdfPath), pdf, {
      contentType: 'application/pdf',
    })
  }

  const now = serverTimestamp()
  const payload: Record<string, unknown> = {
    uid,
    year: program.year,
    status: 'submitted',
    programId: program.id,
    programTitle: program.title, // 프로그램이 수정돼도 신청 이력은 남는다
    participationType: program.participationType ?? 'individual',
    applicant: snapshotOf(member, portraitConsent),
    // 어느 문구에 동의한 것인지 (D-44). 동의 시각은 submittedAt(서버 시각).
    portraitConsentVersion: CONSENT_VERSION,
    // ⚠️ 배열 안에는 serverTimestamp() 를 넣을 수 없다 (Firestore 제약).
    //    그래서 첨부 시각만 클라이언트 시각을 쓴다. 몇 초 어긋날 수 있지만
    //    이 값은 참고용이고, 제출 시각(submittedAt)은 서버 시각이라 문제없다.
    files: attached.map((a) => ({ ...a, uploadedAt: Timestamp.now() })),
    submittedAt: now,
    createdAt: now,
    updatedAt: now,
  }

  if (generatedPdfPath) payload.generatedPdfPath = generatedPdfPath
  // 값이 없으면 칸 자체를 만들지 않는다 — 빈 배열이 남으면 화면이
  // "항목이 있는데 비었다"로 오해한다 (D-43에서 배운 것)
  if (formData && formData.length > 0) payload.formData = formData
  if (note && note.trim()) {
    payload.note = note.trim()
    payload.noteLabel = program.noteLabel ?? '추가 기재'
  }

  // 신청서와 '열쇠' 문서를 **한 묶음으로** 쓴다.
  //
  // 열쇠 문서 ID는 `{uid}_{programId}` 로 정해져 있고, 규칙이 생성만 허용한다.
  // 그래서 같은 사람이 같은 프로그램에 두 번째로 제출하면 열쇠 쓰기가 거부되고,
  // 묶음이 통째로 취소되어 **신청서도 안 만들어진다.**
  //
  // 화면에도 중복 확인(findMyApplication)이 있지만 그것만으로는 부족하다.
  // 탭을 두 개 열어두거나 제출 직후 뒤로가기로 다시 누르면 통과해 버리고,
  // 그러면 시트에 두 줄, 드라이브에 PDF 두 개가 쌓인다.
  const batch = writeBatch(getDb())
  batch.set(appRef, payload)
  batch.set(doc(getDb(), COL.applicationKeys, applicationKeyId(uid, program.id)), {
    uid,
    programId: program.id,
    applicationId: appRef.id,
    createdAt: now,
  })
  await batch.commit()

  return appRef.id
}

/**
 * 열쇠 문서 ID.
 *
 * ⚠️ 보안 규칙도 똑같이 `uid + '_' + programId` 로 계산한다.
 *    여기서 값을 다듬으면 규칙과 어긋나 정상 제출까지 막힌다.
 *    프로그램 ID는 Firestore 문서 ID라 슬래시가 들어갈 수 없으므로 그대로 붙인다.
 */
export function applicationKeyId(uid: string, programId: string): string {
  return `${uid}_${programId}`
}

/** 저장된 파일의 임시 열람 URL — 규칙을 통과한 사용자에게만 발급된다 */
export async function fileUrl(storagePath: string): Promise<string> {
  return getDownloadURL(ref(getStorageClient(), storagePath))
}

/** 내 신청 목록 — 최신 제출 순 */
export async function listMyApplications(
  uid: string
): Promise<Application[]> {
  // 정렬은 여기서 한다. where + orderBy 조합은 복합 색인을 요구한다.
  const q = query(collection(getDb(), COL.applications), where('uid', '==', uid))
  const snap = await getDocs(q)
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Application)
    .sort(
      (a, b) =>
        (b.submittedAt?.toMillis() ?? 0) - (a.submittedAt?.toMillis() ?? 0)
    )
}

/**
 * 이 프로그램에 이미 신청했는가 — 중복 신청 방지.
 *
 * ⚠️ **취소된 건(`cancelled`)은 세지 않는다.** 취소는 문서를 지우지 않고
 *    상태로만 남기므로(W-2), 상태를 안 보면 취소해 준 뒤에도 화면이 계속
 *    "이미 신청하셨습니다"로 막는다.
 *
 *    담당자가 취소하면 **열쇠 문서(규칙 차단)와 이 판정(화면 차단) 둘 다**
 *    풀려야 재신청이 된다. 하나만 풀면 폼이 안 열리거나, 열려도 제출이 거부된다.
 *    (09-06: 여기를 빠뜨려 재신청이 막혔던 적 있음)
 */
export async function findMyApplication(
  uid: string,
  programId: string
): Promise<Application | null> {
  const q = query(
    collection(getDb(), COL.applications),
    where('uid', '==', uid),
    where('programId', '==', programId)
  )
  const snap = await getDocs(q)

  // 상태 조건까지 질의에 넣으면 복합 색인을 요구받는다. 한 사람이 한
  // 프로그램에 남기는 문서는 많아야 몇 개라 여기서 거르는 편이 싸다.
  const live = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Application)
    .filter((a) => a.status !== 'cancelled')

  return live[0] ?? null
}

/**
 * 신청자가 **직접 취소할 수 있는 상태인가** (D-48).
 *
 * 담당자 취소(`cancelApplication`)와 조건이 다르다. 담당자는 언제든 취소할 수
 * 있지만, 본인 취소는 **접수 기간 중 · 제출 완료/검토 중/보완 요청**일 때만이다.
 *
 * '검토 중'을 처음에는 막았다가 **열었다**(09-08). 검토 중은 담당자가 보고
 * 있다는 표시일 뿐 확정이 아니고, 참여 못 하게 된 사람을 붙잡을 이유가 없다.
 * 오히려 일찍 알수록 담당자의 헛심사가 준다.
 *
 * 마감 뒤를 막는 이유: 그때는 **재신청이 불가능**해서 "없던 일로 되돌리기"가
 * 성립하지 않는다. 마감 후의 취소는 참여 포기이고, 담당자가 알아야 하는
 * 사건이라 문의로 돌린다.
 *
 * ⚠️ **이 판정은 화면을 정리하기 위한 것이고, 진짜 차단은 보안 규칙이 한다.**
 *    여기 조건을 고치면 `firestore.rules` 의 본인 취소 규칙도 함께 고칠 것.
 *    한쪽만 고치면 버튼은 보이는데 눌러도 거부되거나, 그 반대가 된다.
 */
export function canCancelMyself(app: Application, program: Program | null): boolean {
  const CANCELLABLE = ['submitted', 'reviewing', 'revision']
  if (!CANCELLABLE.includes(app.status)) return false
  if (!program || !program.published) return false

  const now = Date.now()
  const opens = program.opensAt?.toMillis()
  const closes = program.closesAt?.toMillis()
  if (opens !== undefined && now < opens) return false
  if (closes !== undefined && now > closes) return false
  return true
}

/**
 * 신청자 본인이 신청을 취소한다 (D-48).
 *
 * 담당자 취소와 **똑같이** 두 가지를 한 묶음으로 처리한다.
 *   · 신청서 상태 → `cancelled`  (화면이 신청 폼을 다시 열어주는 근거)
 *   · 열쇠 문서 삭제              (보안 규칙이 재제출을 허용하는 근거)
 *
 * 둘 중 하나만 하면 어중간해진다 — 09-06에 이걸 빠뜨려 재신청이 막힌 적이
 * 있다. 그래서 batch 로 묶어 **둘 다 되거나 둘 다 안 되게** 한다.
 *
 * 문서를 지우지 않는 이유도 같다. 지우면 "신청했던 사실"까지 사라져서
 * 나중에 "왜 이 사람 신청이 없느냐"를 확인할 수 없다.
 */
export async function cancelMyApplication(
  app: Application,
  reason: string
): Promise<void> {
  const db = getDb()
  const batch = writeBatch(db)

  // ⚠️ 규칙이 바꿀 수 있는 칸을 네 개로 제한한다. 여기서 다른 칸을 건드리면
  //    권한 오류로 통째로 거부된다.
  batch.update(doc(db, COL.applications, app.id), {
    status: 'cancelled',
    cancelReason: reason.trim(),
    cancelledAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  batch.delete(
    doc(db, COL.applicationKeys, applicationKeyId(app.uid, app.programId))
  )

  await batch.commit()
}

export async function getApplication(id: string): Promise<Application | null> {
  const snap = await getDoc(doc(getDb(), COL.applications, id))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as Application
}

/**
 * 제출 직후 구글 시트·드라이브 동기화를 요청한다 (D-7 / D-30).
 *
 * ⚠️ **실패해도 신청은 이미 완료다.** 그래서 오류를 던지지 않고 기록만 한다.
 *    시트는 담당자 편의를 위한 사본이고, 원본은 Firebase 에 있다.
 *    여기서 예외를 던지면 "제출은 됐는데 실패 화면이 뜨는" 최악이 된다.
 *
 * 서버 설정이 없으면 응답이 skipped 로 오고, 그것도 정상이다.
 */
export async function requestSync(applicationId: string): Promise<void> {
  try {
    const auth = (await import('./config')).getAuthClient()
    const token = await auth.currentUser?.getIdToken()
    if (!token) return

    const res = await fetch('/api/sync/application', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ applicationId }),
    })

    if (!res.ok) {
      console.warn('[iLINE] 시트 동기화 실패(신청은 정상 접수됨):', await res.text())
    }
  } catch (e) {
    console.warn('[iLINE] 시트 동기화 요청 실패(신청은 정상 접수됨):', e)
  }
}
