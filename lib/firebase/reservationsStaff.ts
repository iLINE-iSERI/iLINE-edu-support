// 시설 예약 — 담당자 쪽 (2단계) — D-53 · D-55
//
// 화면 넷: 행정실 전달 명단 · 예약 현황 · 직접 예약 추가 · 운영 설정.
// 설계는 docs/4-기록/09-시설예약-화면-설계.md §3~§6, 기술은 06 §5-5.
//
// 핵심: **전달 명단은 날짜가 아니라 상태로** 뽑는다(D-55).
//   새 요청 = status 'received'
//   취소   = cancelNoticePending == true (확정된 뒤 취소된 것)
// [전달 완료]는 **화면에 떠 있던 그 건들만** 바꾼다 — 누르는 사이 들어온
// 예약을 보내지도 않고 확정하면 안 된다.

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  runTransaction,
  writeBatch,
  serverTimestamp,
  deleteField,
  setDoc,
} from 'firebase/firestore'
import { getDb, COL } from './config'
import { UserFacingError, firebaseErrorKind } from './errors'
import {
  slotId,
  dayKeyId,
  venueDateKey,
  makeReservationCode,
} from './reservations'
import { venueOf } from '@/lib/config/venues'
import type {
  Reservation,
  ReservationDelivery,
  ReservationSettings,
  VenueCode,
} from '@/lib/types'

const toRes = (d: { id: string; data: () => Record<string, unknown> }) =>
  ({ id: d.id, ...d.data() }) as Reservation

/* ─────────────────────────────────────────────────────────────
   전달 명단
   ───────────────────────────────────────────────────────────── */

export interface DeliveryList {
  /** 아직 안 보낸 접수 건 — 공간 → 날짜 → 시각 순 */
  fresh: Reservation[]
  /** 보낸 뒤 취소된 건 */
  cancelled: Reservation[]
  /** 마지막 전달 (되돌리기 대상) */
  last: ReservationDelivery | null
}

const byVenueDateHour = (a: Reservation, b: Reservation) =>
  a.venue.localeCompare(b.venue) ||
  a.date.localeCompare(b.date) ||
  a.startHour - b.startHour ||
  a.seat.localeCompare(b.seat)

export async function loadDeliveryList(): Promise<DeliveryList> {
  const db = getDb()
  const [freshSnap, cancelSnap, lastSnap] = await Promise.all([
    getDocs(query(collection(db, COL.reservations), where('status', '==', 'received'))),
    getDocs(
      query(collection(db, COL.reservations), where('cancelNoticePending', '==', true))
    ),
    getDocs(
      query(
        collection(db, COL.reservationDeliveries),
        orderBy('deliveredAt', 'desc'),
        limit(1)
      )
    ),
  ])
  const lastDoc = lastSnap.docs[0]
  return {
    fresh: freshSnap.docs.map(toRes).sort(byVenueDateHour),
    cancelled: cancelSnap.docs.map(toRes).sort(byVenueDateHour),
    last: lastDoc ? ({ id: lastDoc.id, ...lastDoc.data() } as ReservationDelivery) : null,
  }
}

export interface DeliverResult {
  deliveryId: string
  confirmed: number
  cancelNoticed: number
  /** 화면에 있었지만 그 사이 상태가 바뀌어 건너뛴 건 */
  skipped: number
}

/**
 * [전달 완료] — 화면에 떠 있던 ID 목록만 처리한다.
 *
 * 트랜잭션으로 각 문서를 다시 읽어, **그 사이 회원이 취소한 건은 확정하지
 * 않는다.** 그 건은 다음 명단에 (확정 안 됐으니 취소 묶음에도 안 들어가고)
 * 그냥 사라진다 — 행정실은 몰라도 된다.
 */
export async function deliverReservations(
  newIds: string[],
  cancelIds: string[],
  staffUid: string
): Promise<DeliverResult> {
  if (newIds.length + cancelIds.length === 0)
    throw new UserFacingError('전달할 것이 없습니다.')
  if (newIds.length + cancelIds.length > 400)
    throw new UserFacingError('한 번에 400건까지만 처리할 수 있습니다. 나눠서 눌러 주세요.')

  const db = getDb()
  const deliveryRef = doc(collection(db, COL.reservationDeliveries))

  return runTransaction(db, async (tx) => {
    // 읽기는 전부 먼저 (트랜잭션 규칙)
    const newSnaps = await Promise.all(
      newIds.map((id) => tx.get(doc(db, COL.reservations, id)))
    )
    const cancelSnaps = await Promise.all(
      cancelIds.map((id) => tx.get(doc(db, COL.reservations, id)))
    )

    const confirmedIds: string[] = []
    const noticedIds: string[] = []
    let skipped = 0

    newSnaps.forEach((s) => {
      if (s.exists() && s.data().status === 'received') {
        tx.update(s.ref, {
          status: 'confirmed',
          deliveredAt: serverTimestamp(),
          deliveryId: deliveryRef.id,
          updatedAt: serverTimestamp(),
        })
        confirmedIds.push(s.id)
      } else skipped++
    })
    cancelSnaps.forEach((s) => {
      if (s.exists() && s.data().cancelNoticePending === true) {
        tx.update(s.ref, {
          cancelNoticePending: false,
          cancelDeliveredAt: serverTimestamp(),
          cancelDeliveryId: deliveryRef.id,
          updatedAt: serverTimestamp(),
        })
        noticedIds.push(s.id)
      } else skipped++
    })

    tx.set(deliveryRef, {
      deliveredAt: serverTimestamp(),
      byUid: staffUid,
      newIds: confirmedIds,
      cancelIds: noticedIds,
    })

    return {
      deliveryId: deliveryRef.id,
      confirmed: confirmedIds.length,
      cancelNoticed: noticedIds.length,
      skipped,
    }
  })
}

/**
 * 마지막 전달 되돌리기 — 잘못 눌렀을 때.
 *
 * 그 전달로 확정된 건은 접수됨으로, 취소 알림 처리된 건은 다시 알림 대기로.
 * 확정된 뒤 회원이 이미 취소한 건은 **취소 알림 대기를 풀어 준다** — 전달이
 * 없던 일이 되면 행정실에 취소를 알릴 이유도 없어지기 때문이다.
 */
export async function undoDelivery(delivery: ReservationDelivery): Promise<void> {
  if (delivery.undoneAt) throw new UserFacingError('이미 되돌린 전달입니다.')
  const db = getDb()
  const ref = doc(db, COL.reservationDeliveries, delivery.id)

  await runTransaction(db, async (tx) => {
    const cur = await tx.get(ref)
    if (!cur.exists() || cur.data().undoneAt)
      throw new UserFacingError('이미 되돌린 전달입니다. 새로고침해 주세요.')

    const newSnaps = await Promise.all(
      delivery.newIds.map((id) => tx.get(doc(db, COL.reservations, id)))
    )
    const cancelSnaps = await Promise.all(
      delivery.cancelIds.map((id) => tx.get(doc(db, COL.reservations, id)))
    )

    newSnaps.forEach((s) => {
      if (!s.exists() || s.data().deliveryId !== delivery.id) return
      if (s.data().status === 'confirmed') {
        tx.update(s.ref, {
          status: 'received',
          deliveredAt: deleteField(),
          deliveryId: deleteField(),
          updatedAt: serverTimestamp(),
        })
      } else if (s.data().status === 'cancelled') {
        // 전달 뒤 취소된 건 — 전달이 없던 일이 되므로 취소 알림도 필요 없다
        tx.update(s.ref, {
          cancelNoticePending: false,
          deliveredAt: deleteField(),
          deliveryId: deleteField(),
          updatedAt: serverTimestamp(),
        })
      }
    })
    cancelSnaps.forEach((s) => {
      if (!s.exists() || s.data().cancelDeliveryId !== delivery.id) return
      tx.update(s.ref, {
        cancelNoticePending: true,
        cancelDeliveredAt: deleteField(),
        cancelDeliveryId: deleteField(),
        updatedAt: serverTimestamp(),
      })
    })

    tx.update(ref, { undoneAt: serverTimestamp() })
  })
}

/* ─────────────────────────────────────────────────────────────
   현황
   ───────────────────────────────────────────────────────────── */

/** 며칠치 예약 전부 (취소 제외) — 날짜 30개까지 */
export async function listReservationsOn(dates: string[]): Promise<Reservation[]> {
  if (dates.length === 0) return []
  const snap = await getDocs(
    query(collection(getDb(), COL.reservations), where('date', 'in', dates.slice(0, 30)))
  )
  return snap.docs
    .map(toRes)
    .filter((r) => r.status !== 'cancelled')
    .sort(byVenueDateHour)
}

/**
 * 담당자 취소 — 회원 예약이든 직접 추가한 것이든.
 * 확정된 것을 취소하면 다음 명단의 취소 묶음에 들어간다.
 */
export async function staffCancelReservation(
  r: Reservation,
  note: string
): Promise<void> {
  const db = getDb()
  const batch = writeBatch(db)
  batch.update(doc(db, COL.reservations, r.id), {
    status: 'cancelled',
    cancelledAt: serverTimestamp(),
    cancelNoticePending: r.status === 'confirmed',
    staffNote: note.trim() || deleteField(),
    updatedAt: serverTimestamp(),
  })
  for (let h = r.startHour; h < r.startHour + r.hours; h++) {
    batch.delete(doc(db, COL.reservationSlots, slotId(r.venue, r.seat, r.date, h)))
  }
  if (r.source === 'member' && r.uid) {
    batch.delete(doc(db, COL.reservationDays, dayKeyId(r.uid, r.venue, r.date)))
  }
  await batch.commit()
}

/* ─────────────────────────────────────────────────────────────
   직접 예약 추가 (D-53 ⑥)
   ───────────────────────────────────────────────────────────── */

export interface StaffAddInput {
  venue: VenueCode
  /** 자리 여러 개 — 대관이면 전체 */
  seats: string[]
  date: string
  startHour: number
  /** 끝 시각 (정시). 종일이면 18 */
  endHour: number
  /** 회원이 아니어도 된다 — 단체명도 가능 */
  displayName: string
  phone: string
  note: string
  /** 이미 행정실과 협의된 것이면 바로 확정으로 넣는다 */
  confirmed: boolean
}

/**
 * 담당자가 직접 넣는 예약 — 단체대관·당일·주말·야간이 전부 이 통로다.
 *
 * 마감·공간별 1건·2시간·주말을 **무시**한다. 대신 회원 예약과 **같은 슬롯
 * 문서**를 쓴다 — 그래야 그 시간에 회원이 같은 자리를 못 잡는다(이중 예약
 * 방지). 자리마다 예약 문서 하나씩 만든다(슬롯 → 예약 연결이 1:1이어야
 * 취소·되돌리기가 단순하다).
 */
export async function staffAddReservations(
  input: StaffAddInput,
  staffUid: string
): Promise<number> {
  const venue = venueOf(input.venue)
  const seats = input.seats.filter((s) => venue.seats.includes(s))
  if (seats.length === 0) throw new UserFacingError('자리를 하나 이상 고르세요.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date))
    throw new UserFacingError('날짜가 올바르지 않습니다.')
  const hours = input.endHour - input.startHour
  if (hours < 1 || input.startHour < 0 || input.endHour > 24)
    throw new UserFacingError('시간 범위가 올바르지 않습니다.')
  const name = input.displayName.trim()
  if (!name) throw new UserFacingError('이름(또는 단체명)을 적어 주세요.')

  const db = getDb()

  // 이미 찬 자리가 있으면 어느 자리인지 말해 준다
  const occ = await getDocs(
    query(
      collection(db, COL.reservationSlots),
      where('vd', '==', venueDateKey(input.venue, input.date))
    )
  )
  const clash = new Set<string>()
  occ.forEach((s) => {
    const d = s.data()
    if (seats.includes(String(d.seat)) && d.hour >= input.startHour && d.hour < input.endHour)
      clash.add(String(d.seat))
  })
  if (clash.size > 0)
    throw new UserFacingError(
      `이미 예약이 있는 자리가 있습니다: ${Array.from(clash).sort().join(', ')}. 현황에서 확인한 뒤 다시 시도해 주세요.`
    )

  const now = serverTimestamp()
  const batch = writeBatch(db)
  for (const seat of seats) {
    const ref = doc(collection(db, COL.reservations))
    batch.set(ref, {
      code: makeReservationCode(input.venue, input.date),
      uid: '',
      applicant: {
        name,
        memberType: 'general',
        affiliation: '',
        major: '',
        studentId: '',
        grade: '',
        position: '',
        phone: input.phone.trim(),
        email: '',
        personalInfoConsent: false,
        portraitConsent: false,
      },
      venue: input.venue,
      seat,
      date: input.date,
      startHour: input.startHour,
      hours,
      status: input.confirmed ? 'confirmed' : 'received',
      source: 'staff',
      displayName: name,
      staffNote: input.note.trim(),
      addedBy: staffUid,
      createdAt: now,
      updatedAt: now,
      ...(input.confirmed ? { deliveredAt: now } : {}),
    })
    for (let h = input.startHour; h < input.endHour; h++) {
      batch.set(doc(db, COL.reservationSlots, slotId(input.venue, seat, input.date, h)), {
        reservationId: ref.id,
        venue: input.venue,
        seat,
        date: input.date,
        hour: h,
        vd: venueDateKey(input.venue, input.date),
        createdAt: now,
      })
    }
  }

  try {
    await batch.commit()
  } catch (e) {
    if (firebaseErrorKind(e) === 'permission-denied')
      throw new UserFacingError(
        '그 사이 누군가 같은 자리를 예약했습니다. 현황을 새로고침한 뒤 다시 시도해 주세요.'
      )
    throw e
  }
  return seats.length
}

/* ─────────────────────────────────────────────────────────────
   설정
   ───────────────────────────────────────────────────────────── */

export async function saveReservationSettings(s: ReservationSettings): Promise<void> {
  if (s.closeWeekday < 0 || s.closeWeekday > 6 || s.deliverWeekday < 0 || s.deliverWeekday > 6)
    throw new UserFacingError('요일이 올바르지 않습니다.')
  if (s.closeHour < 0 || s.closeHour > 23) throw new UserFacingError('마감 시각이 올바르지 않습니다.')
  if (s.rangeWeeks < 1 || s.rangeWeeks > 12) throw new UserFacingError('범위는 1~12주 사이여야 합니다.')
  const closedDates = Array.from(
    new Set(s.closedDates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))
  ).sort()
  await setDoc(doc(getDb(), COL.reservationSettings, 'main'), {
    closeWeekday: s.closeWeekday,
    closeHour: s.closeHour,
    deliverWeekday: s.deliverWeekday,
    rangeWeeks: s.rangeWeeks,
    closedDates,
    updatedAt: serverTimestamp(),
  })
}

/** 설정 문서가 있는지 — 화면에서 "지금은 기본값(가정값)입니다" 표시용 */
export async function hasSavedSettings(): Promise<boolean> {
  return (await getDoc(doc(getDb(), COL.reservationSettings, 'main'))).exists()
}
