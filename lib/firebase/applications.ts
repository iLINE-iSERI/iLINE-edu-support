// 신청서 (support_applications) — D-29
//
// 설계 요지는 docs/07-application-form.md 참고.
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
import type {
  Application,
  ApplicantSnapshot,
  AttachedFile,
  Program,
  SupportUser,
} from '@/lib/types'

/** 회원 정보 → 제출 시점 스냅샷 */
export function snapshotOf(member: SupportUser): ApplicantSnapshot {
  const agreed = (purpose: string) =>
    member.consents.some((c) => c.purpose === purpose && c.agreed)

  return {
    name: member.name,
    studentId: member.studentId,
    major: member.major,
    grade: member.grade,
    phone: member.phone,
    email: member.email,
    personalInfoConsent: agreed('personal_info'),
    portraitConsent: agreed('portrait'),
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
  const { program, member, uid, note, files, pdf } = input

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
    applicant: snapshotOf(member),
    // ⚠️ 배열 안에는 serverTimestamp() 를 넣을 수 없다 (Firestore 제약).
    //    그래서 첨부 시각만 클라이언트 시각을 쓴다. 몇 초 어긋날 수 있지만
    //    이 값은 참고용이고, 제출 시각(submittedAt)은 서버 시각이라 문제없다.
    files: attached.map((a) => ({ ...a, uploadedAt: Timestamp.now() })),
    submittedAt: now,
    createdAt: now,
    updatedAt: now,
  }

  if (generatedPdfPath) payload.generatedPdfPath = generatedPdfPath
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

/** 이 프로그램에 이미 신청했는가 — 중복 신청 방지 */
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
  const first = snap.docs[0]
  return first ? ({ id: first.id, ...first.data() } as Application) : null
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
