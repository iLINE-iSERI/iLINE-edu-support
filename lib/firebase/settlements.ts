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
import { ref, uploadBytes, deleteObject } from 'firebase/storage'
import { getDb, getStorageClient, getAuthClient, COL, STORAGE_ROOT } from './config'
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
  /**
   * 재제출 때 **남길** 기존 영수증 (09-12). 없으면 전부 남긴다.
   * 여기서 빠진 파일은 Storage 에서 지우고, 드라이브 사본도 동기화 때 휴지통으로.
   */
  keepReceipts?: AttachedFile[]
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

/**
 * 반려된 정산을 고쳐서 다시 내는 경우.
 *
 * 기존 영수증은 **기본으로 남고**, 신청자가 뺀 것(`keepReceipts` 에 없는 것)만
 * Storage 에서 지운다 (09-12 iSERI: "기존 파일이 뭔지 알고 고칠 수 있어야").
 * 삭제 실패는 무시한다 — 목록에서 빠지면 담당자 화면에도 안 보이고,
 * 드라이브 사본은 동기화가 휴지통으로 보낸다.
 */
export async function resubmitSettlement(
  input: SettlementInput
): Promise<void> {
  const { application, uid, files } = input
  const id = settlementIdOf(application.id)

  const before = await getSettlement(id)
  const prev = before?.receipts ?? []
  const keep = input.keepReceipts ?? prev
  const keepPaths = new Set(keep.map((r) => r.storagePath))
  const removed = prev.filter((r) => !keepPaths.has(r.storagePath))

  const added: AttachedFile[] = []
  for (const f of files) {
    added.push(await uploadReceipt(uid, id, f))
  }

  for (const r of removed) {
    await deleteObject(ref(getStorageClient(), r.storagePath)).catch((e) =>
      console.warn('[iLINE] 뺀 영수증 삭제 실패(목록에서는 빠짐):', e)
    )
  }

  await updateDoc(doc(getDb(), COL.settlements, id), {
    status: 'submitted',
    bankInfo: {
      bankName: input.bankName.trim(),
      accountNumber: input.accountNumber.replace(/\s/g, ''),
      accountHolder: input.accountHolder.trim(),
    },
    receipts: [...keep, ...added],
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
 * ⚠️ `reviewNote` 는 **09-08(D-46)부터 신청자에게 보이지 않는다.**
 *    그래서 반려하면 신청자 화면에는 **'반려' 상태만** 뜨고 이유가 없다.
 *    무엇을 고쳐야 하는지는 **담당자가 메일·전화로 알려야** 하고,
 *    안 알리면 같은 내용으로 다시 제출한다. 저장은 계속 하므로
 *    `SHOW_REVIEW_NOTE_TO_APPLICANT` 를 켜면 즉시 다시 보인다.
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

/**
 * 지급 완료 표시 (09-12).
 *
 * 승인된 건만. `paidAt` 은 **실제 이체일**이라 담당자가 고른다 —
 * 버튼 누른 시각으로 박으면 며칠 뒤에 몰아서 표시할 때 날짜가 틀어진다.
 */
export async function markSettlementPaid(
  id: string,
  paidAt: Date,
  paidNote: string,
  staffUid: string
): Promise<void> {
  await updateDoc(doc(getDb(), COL.settlements, id), {
    status: 'paid',
    paidAt: Timestamp.fromDate(paidAt),
    paidBy: staffUid,
    paidNote: paidNote.trim(),
    updatedAt: serverTimestamp(),
  })
}

/* ── 드라이브·시트 반영 (09-12 · D-65) ───────────────────────────
   영수증은 드라이브 02_정산 폴더로, 정산 한 줄은 시트 「정산」 탭으로.
   ⚠️ 계좌는 나가지 않는다 — 서버 쪽 googleSync.ts 가 읽지 않는다 (D-38). */

async function callSettlementSync(settlementId: string) {
  const token = await getAuthClient().currentUser?.getIdToken()
  if (!token) throw new Error('로그인 정보를 확인할 수 없습니다.')

  const res = await fetch('/api/sync/settlement', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ settlementId }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || '동기화에 실패했습니다.')
  return data as { ok?: boolean; skipped?: string; uploaded?: number }
}

/**
 * 제출·상태 변경 직후 부른다. **실패해도 정산 자체는 이미 끝난 것**이라
 * 오류를 던지지 않고 기록만 한다 (신청서의 requestSync 와 같은 원칙).
 * 실패 사유는 정산 문서 `driveSyncError` 에 남아 담당자 화면에 보인다.
 */
export async function requestSettlementSync(settlementId: string): Promise<void> {
  try {
    await callSettlementSync(settlementId)
  } catch (e) {
    console.warn('[iLINE] 정산 드라이브·시트 반영 실패(정산은 정상 처리됨):', e)
  }
}

/** 담당자용 재시도 — 설정을 고친 뒤 이미 들어온 건을 다시 올릴 때 */
export async function retrySettlementSync(settlementId: string): Promise<void> {
  const data = await callSettlementSync(settlementId)
  if (data.skipped === 'not-configured') {
    throw new Error('서버에 구글 연동 설정이 없습니다. 환경변수를 확인해 주세요.')
  }
}
