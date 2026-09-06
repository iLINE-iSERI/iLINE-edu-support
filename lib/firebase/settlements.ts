// 정산 (support_settlements) — D-39
//
// 최소 구성이다: **지급 계좌 3칸 + 영수증 파일.**
// 지출 항목을 줄 단위로 받지 않는다(D-29와 같은 판단).
//
// ⚠️ 계좌 정보는 **시트·드라이브로 절대 내보내지 않는다**(D-38).
//    사이트 안에서 담당자만 본다. 영수증만 드라이브로 나간다.
//
// 정산은 **선정된 신청건(approved)** 에만 붙는다. 신청 1건 : 정산 1건.

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { ref, uploadBytes } from 'firebase/storage'
import { getDb, getStorageClient, COL, STORAGE_ROOT } from './config'
import type { AttachedFile, Settlement, Application } from '@/lib/types'

/**
 * 정산 문서 ID = 신청번호.
 *
 * 신청 1건에 정산 1건이므로 신청번호를 그대로 쓴다. 그러면 **중복 제출이
 * 구조적으로 불가능**해진다 — 신청서에서 열쇠 문서를 따로 둔 것과 같은 효과를
 * 별도 장치 없이 얻는다. 규칙도 두 번째 쓰기를 update 로 판정한다.
 */
export function settlementIdOf(applicationId: string): string {
  return applicationId
}

async function uploadReceipt(
  uid: string,
  settlementId: string,
  file: File
): Promise<AttachedFile> {
  const safeName = file.name.replace(/[^\w.\-가-힣]/g, '_')
  const path =
    `${STORAGE_ROOT}/settlements/${uid}/${settlementId}/` +
    `${Date.now()}_${safeName}`

  await uploadBytes(ref(getStorageClient(), path), file)

  return {
    type: 'receipt',
    storagePath: path,
    fileName: file.name,
    size: file.size,
    // ⚠️ 배열 안에는 serverTimestamp() 를 못 넣는다 (Firestore 제약).
    uploadedAt: Timestamp.now(),
  }
}

export interface SettlementInput {
  application: Application
  uid: string
  bankName: string
  accountNumber: string
  accountHolder: string
  files: File[]
}

/**
 * 정산 제출.
 *
 * 파일을 먼저 올리고 마지막에 문서를 쓴다. 업로드가 중간에 실패하면 문서가
 * 아예 안 만들어지므로 '영수증 없는 정산'이 남지 않는다. (신청서와 같은 순서)
 */
export async function submitSettlement(
  input: SettlementInput
): Promise<string> {
  const { application, uid, files } = input
  const id = settlementIdOf(application.id)

  const receipts: AttachedFile[] = []
  for (const f of files) {
    receipts.push(await uploadReceipt(uid, id, f))
  }

  const now = serverTimestamp()
  await setDoc(doc(getDb(), COL.settlements, id), {
    applicationId: application.id,
    uid,
    status: 'submitted',
    programId: application.programId,
    programTitle: application.programTitle ?? '',
    applicantName: application.applicant?.name ?? '',
    bankInfo: {
      bankName: input.bankName.trim(),
      accountNumber: input.accountNumber.replace(/\s/g, ''),
      accountHolder: input.accountHolder.trim(),
    },
    receipts,
    submittedAt: now,
    createdAt: now,
    updatedAt: now,
  })

  return id
}

/** 반려된 정산을 고쳐서 다시 내는 경우 — 영수증은 덧붙인다 */
export async function resubmitSettlement(
  input: SettlementInput
): Promise<void> {
  const { application, uid, files } = input
  const id = settlementIdOf(application.id)

  const before = await getSettlement(id)
  const added: AttachedFile[] = []
  for (const f of files) {
    added.push(await uploadReceipt(uid, id, f))
  }

  await updateDoc(doc(getDb(), COL.settlements, id), {
    status: 'submitted',
    bankInfo: {
      bankName: input.bankName.trim(),
      accountNumber: input.accountNumber.replace(/\s/g, ''),
      accountHolder: input.accountHolder.trim(),
    },
    receipts: [...(before?.receipts ?? []), ...added],
    // 반려 사유는 지운다 — 다시 낸 뒤에도 남아 있으면 아직 반려 상태로 보인다
    reviewNote: '',
    submittedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function getSettlement(id: string): Promise<Settlement | null> {
  const snap = await getDoc(doc(getDb(), COL.settlements, id))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as Settlement
}

/** 내 정산 목록 — 마이페이지에서 신청건과 짝지어 쓴다 */
export async function listMySettlements(uid: string): Promise<Settlement[]> {
  const q = query(collection(getDb(), COL.settlements), where('uid', '==', uid))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Settlement)
}

/* ── 담당자 ────────────────────────────────────────────────────── */

export async function listAllSettlements(): Promise<Settlement[]> {
  const snap = await getDocs(collection(getDb(), COL.settlements))
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Settlement)
    .sort(
      (a, b) =>
        (b.submittedAt?.toMillis() ?? 0) - (a.submittedAt?.toMillis() ?? 0)
    )
}

/**
 * 승인 / 반려.
 *
 * `reviewNote` 는 신청자에게 그대로 보인다. 반려라면 **무엇을 고쳐야 하는지**
 * 적어야 한다 — 그게 없으면 신청자는 전화로 물어보게 된다.
 */
export async function reviewSettlement(
  id: string,
  status: 'approved' | 'rejected',
  reviewNote: string,
  reviewerUid: string
): Promise<void> {
  await updateDoc(doc(getDb(), COL.settlements, id), {
    status,
    reviewNote: reviewNote.trim(),
    reviewedBy: reviewerUid,
    reviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}
