/**
 * 1:1 문의 (D-93 · 09-18) — 회원이 쓰고 담당자가 답한다.
 *
 * 설계(iSERI 09-18):
 *   · 비공개 — 쓴 사람과 담당자만 본다. 학번·신청 상황 같은 개인 사정이 섞이는 문의가 대부분.
 *   · 회원만 쓴다 — 누가 물었는지 확실하고 스팸이 없다. 비회원은 FAQ 의 메일·전화로.
 *   · 한 문의에 답 하나 — 더 물을 것이 있으면 새 문의. 대화 스레드는 안 만든다(1차).
 *   · 메일 없음 — 담당자는 관리 화면 배지 + 시트 「문의」 탭, 회원은 마이페이지 표시.
 *
 * 규칙(firestore.rules)이 실제 방어선이다: 본인은 만들기 + 「답변 봤음」 시각만, 담당자는
 * 답·상태만. 시트 반영은 서버(/api/sync/inquiry)가 Admin 으로 한다.
 */

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { getDb, getAuthClient, COL } from './config'
import { UserFacingError } from './errors'
import type { Inquiry, InquiryStatus, SupportUser } from '@/lib/types'

export const INQUIRY_TITLE_MAX = 100
export const INQUIRY_BODY_MAX = 3000

function toInquiry(id: string, data: Record<string, unknown>): Inquiry {
  return { id, ...data } as Inquiry
}

function byNewest(a: Inquiry, b: Inquiry) {
  return (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0)
}

/* ── 회원 ─────────────────────────────────────────────────────────── */

export function inquiryRejectReason(title: string, body: string): string | null {
  if (!title.trim()) return '제목을 적어 주세요'
  if (title.trim().length > INQUIRY_TITLE_MAX) return `제목은 ${INQUIRY_TITLE_MAX}자까지입니다`
  if (!body.trim()) return '문의 내용을 적어 주세요'
  if (body.trim().length > INQUIRY_BODY_MAX) return `내용은 ${INQUIRY_BODY_MAX}자까지입니다`
  return null
}

/** 문의 쓰기 — 만든 문서 ID 를 돌려준다. 시트 반영은 호출한 쪽이 requestInquirySync 로 */
export async function createInquiry(
  me: Pick<SupportUser, 'uid' | 'name' | 'email'>,
  title: string,
  body: string
): Promise<string> {
  const reason = inquiryRejectReason(title, body)
  if (reason) throw new UserFacingError(reason)
  const ref = await addDoc(collection(getDb(), COL.inquiries), {
    uid: me.uid,
    authorName: me.name,
    authorEmail: me.email,
    title: title.trim(),
    body: body.trim(),
    status: 'open' satisfies InquiryStatus,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

/** 내 문의 전부 — 최신순 */
export async function listMyInquiries(uid: string): Promise<Inquiry[]> {
  const q = query(collection(getDb(), COL.inquiries), where('uid', '==', uid))
  const snap = await getDocs(q)
  return snap.docs.map((d) => toInquiry(d.id, d.data())).sort(byNewest)
}

/** 답변을 열어 봤다 — 마이페이지 「새 답변」 표시를 끈다 */
export async function markAnswerSeen(id: string): Promise<void> {
  await updateDoc(doc(getDb(), COL.inquiries, id), { answerSeenAt: serverTimestamp() })
}

/** 답이 달렸는데 아직 안 본 문의 */
export function hasUnseenAnswer(i: Inquiry): boolean {
  if (i.status === 'open' || !i.answeredAt) return false
  return !i.answerSeenAt || i.answerSeenAt.toMillis() < i.answeredAt.toMillis()
}

/* ── 담당자 ───────────────────────────────────────────────────────── */

export async function listAllInquiries(): Promise<Inquiry[]> {
  const q = query(collection(getDb(), COL.inquiries), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => toInquiry(d.id, d.data()))
}

/** 답변 대기 건수 — 관리 화면 배지 */
export async function countOpenInquiries(): Promise<number> {
  const q = query(collection(getDb(), COL.inquiries), where('status', '==', 'open'))
  const snap = await getDocs(q)
  return snap.size
}

export async function getInquiry(id: string): Promise<Inquiry | null> {
  const snap = await getDoc(doc(getDb(), COL.inquiries, id))
  return snap.exists() ? toInquiry(snap.id, snap.data()) : null
}

/** 답 달기 — 상태가 answered 로. 이미 답이 있으면 고쳐 쓰는 것 */
export async function answerInquiry(id: string, staffUid: string, answer: string): Promise<void> {
  const text = answer.trim()
  if (!text) throw new UserFacingError('답변 내용을 적어 주세요')
  await updateDoc(doc(getDb(), COL.inquiries, id), {
    answer: text,
    status: 'answered' satisfies InquiryStatus,
    answeredAt: serverTimestamp(),
    answeredBy: staffUid,
    updatedAt: serverTimestamp(),
  })
}

/** 종료 — 답 없이 닫거나(중복·부적절), 답한 뒤 정리. 회원 화면엔 「종료」로 보인다 */
export async function setInquiryStatus(id: string, status: InquiryStatus): Promise<void> {
  await updateDoc(doc(getDb(), COL.inquiries, id), { status, updatedAt: serverTimestamp() })
}

/* ── 시트 반영 — 서버를 거친다 ───────────────────────────────────── */

export async function requestInquirySync(inquiryId: string): Promise<void> {
  try {
    const token = await getAuthClient().currentUser?.getIdToken()
    if (!token) return
    const res = await fetch('/api/sync/inquiry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ inquiryId }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `HTTP ${res.status}`)
    }
  } catch (e) {
    // 시트는 사본 — 실패해도 문의 자체는 저장돼 있다
    console.warn('[iLINE] 문의 시트 반영 실패(문의는 정상 저장됨):', e)
  }
}
