// 정산 (support_settlements) — D-39
//
// 최소 구성이다: **영수증·증빙 파일만** (D-108).
// 지출 항목을 줄 단위로 받지 않는다(D-29와 같은 판단).
//
// 🔴 지급 계좌는 **받지 않는다** (D-108 · 09-25). 예전 구성은 「계좌 3칸 + 영수증」
//    이었다(D-39). 첫 정산이 들어오기 전에 없앴으므로 계좌가 담긴 문서는 없다.
//    영수증은 드라이브로 나간다.
//
// 정산은 **선정된 신청건(approved)** 에만 붙는다.
//
// D-117 (09-30) — **신청 1건 : 정산 여러 번.** 비용이 생길 때마다 따로 청구한다(iSERI · 운영).
//   · 번호: 1차 = 신청번호 그대로(옛 정산이 그대로 1차), 2차부터 `신청번호_2` …
//   · 회차는 사람(신청서)마다 센다 — 팀 회차가 아니다(팀은 담당자 화면의 보기용 묶음)
//   · 증빙서류는 공고마다 종류가 있다(`settlementDocsOf`) — 파일마다 docKind·docLabel
//   · 앞 정산이 처리 중이어도 새 회차를 낼 수 있다. 반려된 회차는 그 회차만 고쳐 다시 낸다
//
// D-118 (09-30) — **「제출 완료」 상태에서도 본인이 고친다** — 담당자가 「확인 완료」를 누르기 전까지.
//   담당자가 회의록 보완을 요청했는데 학생이 고칠 길이 없어, 따로 받아 드라이브에 손으로 넣은 일이 있었다.
//   고칠 때마다 editCount +1 · lastEditedAt → 담당자 카드 「수정됨」. 담당자의 확인 완료·반려는
//   화면에 떠 있던 것과 문서가 같을 때만 저장된다(`reviewSettlement` 의 expected)

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
  updateDoc,
  runTransaction,
  serverTimestamp,
  increment,
  Timestamp,
  deleteField,
} from 'firebase/firestore'
import { ref, uploadBytes, deleteObject } from 'firebase/storage'
import { getDb, getStorageClient, getAuthClient, COL, STORAGE_ROOT } from './config'
import { UserFacingError } from './errors'
import {
  SETTLEMENT_STATUS_LABEL,
  canEditSettlement,
  settlementRoundOf,
  type AttachedFile,
  type Settlement,
  type Application,
  type SettlementDocKind,
  type SettlementStatus,
} from '@/lib/types'

/**
 * 정산 문서 ID — **1차 = 신청번호**, 2차부터 `신청번호_2` (D-117).
 *
 * 번호가 회차로 정해져 있어 **같은 회차를 두 번 내면 두 번째가 막힌다**(규칙이 두 번째 쓰기를
 * update 로 판정해 거부) — 탭 두 개·뒤로가기 재제출이 중복을 만들지 않는다.
 * ⚠️ 보안 규칙이 같은 모양을 검사한다(`firestore.rules` 정산 create). 여기를 바꾸면 거기도.
 */
export function settlementIdOf(applicationId: string, round = 1): string {
  return round <= 1 ? applicationId : `${applicationId}_${round}`
}

/** 이 신청 건의 다음 회차 — 낸 정산 중 가장 큰 회차 + 1 */
export function nextSettlementRound(mine: Settlement[], applicationId: string): number {
  const rounds = mine.filter((s) => s.applicationId === applicationId).map(settlementRoundOf)
  return rounds.length ? Math.max(...rounds) + 1 : 1
}

async function uploadReceipt(
  uid: string,
  settlementId: string,
  file: File,
  kind: SettlementDocKind
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
    // D-117: 어느 증빙서류인가 — 이름은 낸 때의 사본(담당자가 나중에 이름을 바꿔도 기록은 그대로)
    docKind: kind.id,
    docLabel: kind.label.trim(),
  }
}

export interface SettlementInput {
  application: Application
  uid: string
  /** 새로 올릴 파일 — 증빙서류 종류와 함께 (D-117) */
  files: { file: File; kind: SettlementDocKind }[]
  /**
   * 재제출 때 **남길** 기존 파일 (09-12). 없으면 전부 남긴다.
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
  input: SettlementInput & { round: number }
): Promise<string> {
  const { application, uid, files, round } = input
  const id = settlementIdOf(application.id, round)

  const receipts: AttachedFile[] = []
  for (const f of files) {
    receipts.push(await uploadReceipt(uid, id, f.file, f.kind))
  }

  const now = serverTimestamp()
  // ⚠️ 규칙이 넣을 수 있는 칸을 목록으로 못 박는다(D-117) — 여기 칸을 더하면 규칙도
  await setDoc(doc(getDb(), COL.settlements, id), {
    applicationId: application.id,
    uid,
    status: 'submitted',
    round,
    programId: application.programId,
    programTitle: application.programTitle ?? '',
    applicantName: application.applicant?.name ?? '',
    receipts,
    submittedAt: now,
    createdAt: now,
    updatedAt: now,
  })

  return id
}

/**
 * 낸 정산을 고친다 — **반려된 회차 다시 내기**와 **「제출 완료」 회차 고치기**(D-118) 둘 다.
 *
 * 기존 파일은 **기본으로 남고**, 신청자가 뺀 것(`keepReceipts` 에 없는 것)만
 * Storage 에서 지운다 (09-12 iSERI: "기존 파일이 뭔지 알고 고칠 수 있어야").
 * 삭제 실패는 무시한다 — 목록에서 빠지면 담당자 화면에도 안 보이고,
 * 드라이브 사본은 동기화가 휴지통으로 보낸다.
 *
 * 둘의 차이 (규칙이 같은 구분을 한다):
 *   · 반려 뒤 다시 내기 — 반려 사유를 지우고 제출 시각을 새로 (예전과 같음)
 *   · 제출 완료 고치기 — **담당자 메모와 처음 제출 시각은 그대로**. 규칙이 이 둘을 못 바꾸게 막는다
 * 둘 다 editCount +1 · lastEditedAt → 담당자 카드 「수정됨」.
 */
export async function resubmitSettlement(
  settlement: Settlement,
  input: SettlementInput
): Promise<void> {
  const { uid, files } = input
  // D-117: 회차마다 번호가 달라서 계산하지 않고 그 정산의 번호를 그대로 쓴다
  const id = settlement.id

  // 그 사이 담당자가 확인 완료했으면 올리기 전에 멈춘다 — 파일만 올라가고 저장이 막히는 일을 줄인다
  const before = await getSettlement(id)
  if (!before) throw new UserFacingError('정산을 찾을 수 없습니다. 새로고침해 주세요.')
  if (!canEditSettlement(before)) {
    throw new UserFacingError(
      `이 정산은 그 사이 「${SETTLEMENT_STATUS_LABEL[before.status]}」(으)로 바뀌어 고칠 수 없습니다. 새로고침해 확인해 주세요.`
    )
  }
  const wasRejected = before.status !== 'submitted'

  const prev = before.receipts ?? []
  const keep = input.keepReceipts ?? prev
  const keepPaths = new Set(keep.map((r) => r.storagePath))
  const removed = prev.filter((r) => !keepPaths.has(r.storagePath))

  const added: AttachedFile[] = []
  for (const f of files) {
    added.push(await uploadReceipt(uid, id, f.file, f.kind))
  }

  await updateDoc(doc(getDb(), COL.settlements, id), {
    status: 'submitted',
    // 계좌는 받지 않는다(D-108). 혹시 남아 있는 값이 있으면 이 기회에 지운다 —
    // 계좌 없이 낸 문서에는 원래 없으므로 아무 일도 일어나지 않는다
    bankInfo: deleteField(),
    receipts: [...keep, ...added],
    // D-118: 담당자 카드 「수정됨」 — 규칙이 정확히 1 늘고 시각이 지금인지 본다
    editCount: increment(1),
    lastEditedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    // 반려 뒤 다시 낼 때만 — 반려 사유를 지우고(남아 있으면 아직 반려로 보인다) 제출 시각을 새로.
    // 제출 완료 상태에서 고칠 때는 담당자가 적어 둔 메모를 지우면 안 된다
    ...(wasRejected ? { reviewNote: '', submittedAt: serverTimestamp() } : {}),
  })

  // 뺀 파일은 저장이 **된 뒤에** 지운다 (D-118). 먼저 지우면, 그 사이 담당자가 확인 완료해
  // 저장이 막혔을 때 문서가 **없는 파일**을 가리키게 된다. (새로 올린 파일이 남는 쪽이 낫다)
  for (const r of removed) {
    await deleteObject(ref(getStorageClient(), r.storagePath)).catch((e) =>
      console.warn('[iLINE] 뺀 증빙서류 삭제 실패(목록에서는 빠짐):', e)
    )
  }
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
 * 확인 완료(저장값 approved) / 반려. D-117 에 「승인」을 「확인 완료」로 불렀다.
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
  reviewerUid: string,
  /**
   * 담당자 **화면에 떠 있던** 상태·고친 횟수 (D-118). 넘기면 저장 직전에 문서와 대조한다.
   * 학생이 「제출 완료」 상태에서 고칠 수 있게 되어, 담당자가 **보지 못한 파일**을 확인 완료하는 일을 막는다
   * (신청서의 `updateApplicationStatus` expectedStatus 와 같은 방식)
   */
  expected?: { status: SettlementStatus; editCount: number }
): Promise<void> {
  const ref = doc(getDb(), COL.settlements, id)
  await runTransaction(getDb(), async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) throw new UserFacingError('정산을 찾을 수 없습니다.')
    const cur = snap.data() as Settlement
    if (expected && (cur.status !== expected.status || (cur.editCount ?? 0) !== expected.editCount)) {
      throw new UserFacingError(
        cur.status !== expected.status
          ? `이 정산은 그 사이 「${SETTLEMENT_STATUS_LABEL[cur.status]}」(으)로 바뀌었습니다. 목록을 새로 불러왔으니 다시 확인해 주세요.`
          : '신청자가 그 사이 이 정산을 고쳤습니다(파일이 바뀌었을 수 있음). 목록을 새로 불러왔으니 파일을 다시 확인해 주세요.'
      )
    }
    tx.update(ref, {
      status,
      reviewNote: reviewNote.trim(),
      reviewedBy: reviewerUid,
      reviewedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
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
   증빙서류는 드라이브 「정산」 폴더로(D-117: 프로그램 / 팀 또는 이름), 정산 한 줄은 시트 「정산」 탭으로.
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
