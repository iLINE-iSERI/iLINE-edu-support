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
  addDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { ref, uploadBytes } from 'firebase/storage'
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
  file: File
): Promise<Omit<AttachedFile, 'uploadedAt'>> {
  // 파일명에 한글·공백이 섞여도 경로가 깨지지 않도록 시각을 접두어로 쓴다.
  const safeName = file.name.replace(/[^\w.\-가-힣]/g, '_')
  const path = `${STORAGE_ROOT}/applications/${uid}/${Date.now()}_${safeName}`

  await uploadBytes(ref(getStorageClient(), path), file)

  return {
    type: 'application',
    storagePath: path,
    fileName: file.name,
    size: file.size,
    // uploadedAt 은 여기서 만들지 않는다. 클라이언트 시계는 틀릴 수 있으므로
    // 문서를 저장할 때 서버 시각(serverTimestamp)으로 채운다.
  }
}

export interface SubmitInput {
  program: Program
  member: SupportUser
  uid: string
  note?: string
  files: File[]
}

/**
 * 신청서 제출.
 *
 * 임시저장을 두지 않으므로 바로 `submitted` 상태로 만든다 (D-29).
 * 파일을 먼저 올리고 문서를 만든다 — 순서가 반대면 업로드가 실패했을 때
 * 첨부가 비어 있는 신청서만 남는다.
 */
export async function submitApplication(input: SubmitInput): Promise<string> {
  const { program, member, uid, note, files } = input

  const attached: Omit<AttachedFile, 'uploadedAt'>[] = []
  for (const f of files) {
    attached.push(await uploadAttachment(uid, f))
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
    files: attached.map((a) => ({ ...a, uploadedAt: now })),
    submittedAt: now,
    createdAt: now,
    updatedAt: now,
  }

  if (note && note.trim()) {
    payload.note = note.trim()
    payload.noteLabel = program.noteLabel ?? '추가 기재'
  }

  const written = await addDoc(collection(getDb(), COL.applications), payload)
  return written.id
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
