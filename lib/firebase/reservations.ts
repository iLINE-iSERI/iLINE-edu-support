// 시설 예약 (support_reservations) — D-52 · D-53 · D-55
//
// 설계 요지는 docs/4-기록/06-시설예약-설계.md, 화면은 09-시설예약-화면-설계.md.
//
// 핵심 두 가지:
//   · 예약 1건 = 예약 문서 + 슬롯 문서(시간당 1개) + 하루 열쇠 문서를
//     **한 묶음(batch)** 으로 쓴다. 슬롯·열쇠는 문서 ID 자체가 잠금이라
//     동시에 두 사람이 눌러도 한 명만 성공한다 (신청서의 열쇠 문서와 같은 방식)
//   · 우리 시스템은 진실의 원천이 아니다 — "예약되었습니다"라 하지 않는다.
//     상태는 received(접수됨) → confirmed(확정됨, 목요일 전달 뒤)

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  writeBatch,
  Timestamp,
} from 'firebase/firestore'
import { getDb, COL } from './config'
import { UserFacingError, firebaseErrorKind } from './errors'
import { snapshotOf } from './applications'
import { venueOf, START_HOURS, maxHoursFrom } from '@/lib/config/venues'
import {
  computeWindow,
  isSelectableDate,
  compactYmd,
  toYmd,
} from '@/lib/reservations/window'
import {
  DEFAULT_RESERVATION_SETTINGS,
  type Reservation,
  type ReservationSettings,
  type SupportUser,
  type VenueCode,
} from '@/lib/types'

/* ─────────────────────────────────────────────────────────────
   설정
   ───────────────────────────────────────────────────────────── */

/**
 * 운영 설정 — 문서가 없으면 기본값(가정값)을 쓴다.
 * 회원 화면도 읽어야 하므로 규칙에서 isMember 에게 get 을 연다.
 */
export async function getReservationSettings(): Promise<ReservationSettings> {
  const snap = await getDoc(doc(getDb(), COL.reservationSettings, 'main'))
  if (!snap.exists()) return DEFAULT_RESERVATION_SETTINGS
  const d = snap.data()
  return {
    closeWeekday: d.closeWeekday ?? DEFAULT_RESERVATION_SETTINGS.closeWeekday,
    closeHour: d.closeHour ?? DEFAULT_RESERVATION_SETTINGS.closeHour,
    deliverWeekday:
      d.deliverWeekday ?? DEFAULT_RESERVATION_SETTINGS.deliverWeekday,
    rangeWeeks: d.rangeWeeks ?? DEFAULT_RESERVATION_SETTINGS.rangeWeeks,
    closedDates: Array.isArray(d.closedDates) ? d.closedDates : [],
    updatedAt: d.updatedAt,
  }
}

/* ─────────────────────────────────────────────────────────────
   문서 ID — ⚠️ 보안 규칙도 똑같이 계산한다. 여기서 값을 다듬으면
   규칙과 어긋나 정상 예약까지 막힌다.
   ───────────────────────────────────────────────────────────── */

export function slotId(
  venue: VenueCode,
  seat: string,
  date: string,
  hour: number
): string {
  return `${venue}_${seat}_${compactYmd(date)}_${String(hour).padStart(2, '0')}`
}

/**
 * 하루 열쇠 — **공간마다** 하루 1건 (09-12 개정, D-57).
 * 처음엔 `{uid}_{날짜}` 로 공간을 가리지 않았는데, 오전에 좌석을 잡으면
 * 오후에 미디어랩을 못 쓰게 되어 이상했다(iSERI). 공간이 다르면 용도가
 * 다르므로 열쇠에 공간을 넣는다.
 */
export function dayKeyId(uid: string, venue: VenueCode, date: string): string {
  return `${uid}_${venue}_${compactYmd(date)}`
}

/** 격자 조회용 — 슬롯 문서에 함께 저장하는 `공간_날짜` 키 (설계 §5-1 참고) */
export function venueDateKey(venue: VenueCode, date: string): string {
  return `${venue}_${date}`
}

/**
 * 예약번호 — `ST-260922-K3QD` (설계 §3).
 * 조회 열쇠가 아니라 "말로 전하는 이름표"라 겹칠 확률만 낮으면 된다.
 * 0/O, 1/I/L 처럼 헷갈리는 글자는 뺐다.
 */
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export function makeReservationCode(venue: VenueCode, date: string): string {
  const yymmdd = compactYmd(date).slice(2)
  let tail = ''
  const buf = new Uint32Array(4)
  crypto.getRandomValues(buf)
  buf.forEach((n) => {
    tail += CODE_CHARS[n % CODE_CHARS.length]
  })
  return `${venue}-${yymmdd}-${tail}`
}

/* ─────────────────────────────────────────────────────────────
   조회
   ───────────────────────────────────────────────────────────── */

/**
 * 한 공간·한 주의 **차 있는 자리** — `{date}_{hour}` → 자리 번호 집합.
 *
 * 슬롯 문서를 `vd`(공간_날짜) 키로 `in` 조회한다. 등호+범위 조합은 복합
 * 색인이 필요해서 콘솔 작업이 하나 더 생기는데, `in` 하나면 단일 필드
 * 색인으로 끝난다. 한 주 = 5개 값이라 `in` 상한(30) 안이다.
 */
export async function loadOccupancy(
  venue: VenueCode,
  days: string[]
): Promise<Map<string, Set<string>>> {
  const taken = new Map<string, Set<string>>()
  if (days.length === 0) return taken
  const keys = days.map((d) => venueDateKey(venue, d))
  const snap = await getDocs(
    query(collection(getDb(), COL.reservationSlots), where('vd', 'in', keys))
  )
  snap.forEach((s) => {
    const d = s.data()
    const k = `${d.date}_${d.hour}`
    if (!taken.has(k)) taken.set(k, new Set())
    taken.get(k)!.add(String(d.seat))
  })
  return taken
}

/** 내 예약 전부 (취소 포함) — 최근 이용일 순 */
export async function listMyReservations(uid: string): Promise<Reservation[]> {
  // orderBy 를 붙이면 (uid, date) 복합 색인이 필요하다. 한 사람 것은 몇십 건이라
  // 그냥 가져와서 화면에서 정렬한다.
  const snap = await getDocs(
    query(collection(getDb(), COL.reservations), where('uid', '==', uid))
  )
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Reservation)
  return list.sort((a, b) =>
    a.date === b.date ? b.startHour - a.startHour : b.date.localeCompare(a.date)
  )
}

/** 살아 있는(취소 아닌) 예약만 — 격자에서 "그 날 이미 예약함"을 표시할 때 */
export function activeReservations(list: Reservation[]): Reservation[] {
  return list.filter((r) => r.status !== 'cancelled')
}

/* ─────────────────────────────────────────────────────────────
   예약하기
   ───────────────────────────────────────────────────────────── */

export interface ReserveInput {
  venue: VenueCode
  seat: string
  date: string
  startHour: number
  hours: number
}

/**
 * 예약 생성. 성공하면 만들어진 예약을 돌려준다.
 *
 * 화면이 이미 다 걸러서 보내지만, 여기서 **한 번 더 검사**한다 — 화면은
 * 최종 방어선이 아니다(D-36). 그리고 규칙이 거부했을 때 "왜"를 이용자에게
 * 말해 주려면 어떤 잠금에 걸렸는지 미리 확인해 두어야 한다: 규칙 거부는
 * 전부 permission-denied 한 가지로만 돌아온다.
 */
export async function createReservation(
  member: SupportUser,
  input: ReserveInput,
  settings?: ReservationSettings
): Promise<Reservation> {
  const s = settings ?? (await getReservationSettings())
  const win = computeWindow(s)
  const venue = venueOf(input.venue)

  if (!venue.seats.includes(input.seat))
    throw new UserFacingError('자리 번호가 올바르지 않습니다.')
  if (!isSelectableDate(win, s, input.date))
    throw new UserFacingError(
      '지금은 그 날짜를 예약할 수 없습니다. 화면을 새로고침한 뒤 다시 골라 주세요.'
    )
  if (!START_HOURS.includes(input.startHour))
    throw new UserFacingError('시작 시각이 올바르지 않습니다.')
  if (input.hours < 1 || input.hours > maxHoursFrom(input.startHour))
    throw new UserFacingError('그 시각에는 그만큼 길게 예약할 수 없습니다.')

  const db = getDb()

  // 같은 시간에 다른 공간 예약이 있으면 막는다 — 한 사람이 두 곳에 있을 수
  // 없다. 이건 규칙이 아니라 여기서만 막는다: 우회해도 생기는 일이 "자기
  // 자리 두 개를 같은 시간에 잡음"뿐이고, 담당자 현황에 그대로 보인다.
  const mine = activeReservations(await listMyReservations(member.uid))
  const clash = mine.find(
    (r) =>
      r.date === input.date &&
      r.startHour < input.startHour + input.hours &&
      input.startHour < r.startHour + r.hours
  )
  if (clash)
    throw new UserFacingError(
      `같은 시간에 ${venueOf(clash.venue).name} 예약이 이미 있습니다. 시간을 바꾸거나 그 예약을 먼저 취소해 주세요.`
    )

  // 공간마다 하루 1건 — 먼저 확인해서 이유를 말해 준다. (규칙도 막지만 그때는
  // "권한 없음"으로만 돌아와서 이용자가 영문을 모른다)
  const dayRef = doc(
    db,
    COL.reservationDays,
    dayKeyId(member.uid, input.venue, input.date)
  )
  if ((await getDoc(dayRef)).exists())
    throw new UserFacingError(
      `그 날 ${venue.name}은 이미 예약하셨습니다. 한 공간은 하루에 한 건만 예약할 수 있습니다.`
    )

  const resRef = doc(collection(db, COL.reservations))
  const now = serverTimestamp()
  const payload = {
    code: makeReservationCode(input.venue, input.date),
    uid: member.uid,
    // 초상권 동의는 예약과 무관하다 — 스냅샷 함수가 요구하는 자리라 false 를 준다
    applicant: snapshotOf(member, false),
    venue: input.venue,
    seat: input.seat,
    date: input.date,
    startHour: input.startHour,
    hours: input.hours,
    status: 'received' as const,
    source: 'member' as const,
    createdAt: now,
    updatedAt: now,
  }

  const batch = writeBatch(db)
  batch.set(resRef, payload)
  for (let h = input.startHour; h < input.startHour + input.hours; h++) {
    batch.set(doc(db, COL.reservationSlots, slotId(input.venue, input.seat, input.date, h)), {
      reservationId: resRef.id,
      venue: input.venue,
      seat: input.seat,
      date: input.date,
      hour: h,
      vd: venueDateKey(input.venue, input.date),
      createdAt: now,
    })
  }
  batch.set(dayRef, {
    uid: member.uid,
    venue: input.venue,
    date: input.date,
    reservationId: resRef.id,
    createdAt: now,
  })

  try {
    await batch.commit()
  } catch (e) {
    // 하루 열쇠는 위에서 확인했으니, 여기서 거부되면 슬롯 — 즉 그 사이 누군가
    // 같은 자리·시간을 잡은 것이다.
    if (firebaseErrorKind(e) === 'permission-denied')
      throw new UserFacingError(
        '방금 다른 회원이 그 자리를 예약했습니다. 다른 자리나 시간을 골라 주세요.'
      )
    throw e
  }

  return {
    id: resRef.id,
    ...payload,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  }
}

/* ─────────────────────────────────────────────────────────────
   취소
   ───────────────────────────────────────────────────────────── */

/**
 * 회원이 스스로 취소할 수 있는가 — **이용일 전날까지** (J-5 가정값).
 *
 * 확정된 것도 취소할 수 있다(D-55). 4주 범위라 3주 뒤 계획은 바뀌기
 * 마련이고, 그때마다 담당자에게 연락하게 하는 것은 비현실적이다.
 * 확정 뒤 취소는 다음 목요일 명단의 「취소」 묶음으로 행정실에 알린다.
 */
export function canCancelMyself(r: Reservation, now: Date = new Date()): boolean {
  if (r.status === 'cancelled') return false
  return r.date > toYmd(now)
}

/**
 * 취소 — 예약 상태 변경 + 슬롯·하루 열쇠 삭제를 한 묶음으로.
 *
 * 문서를 지우지 않는다. 확정된 것을 취소했으면 행정실에 알려야 하므로
 * "취소했다는 사실" 자체가 기록이어야 한다 (설계 §5-5).
 */
export async function cancelMyReservation(r: Reservation): Promise<void> {
  if (!canCancelMyself(r))
    throw new UserFacingError('이용일이 지났거나 당일이라 취소할 수 없습니다.')

  const db = getDb()
  const batch = writeBatch(db)
  // ⚠️ 규칙이 바꿀 수 있는 칸을 네 개로 제한한다.
  //    cancelNoticePending — 확정된 것을 취소하면 행정실에 알려야 하므로 true.
  //    규칙이 "이전 상태가 confirmed 였는가"와 같은지 검사한다.
  batch.update(doc(db, COL.reservations, r.id), {
    status: 'cancelled',
    cancelledAt: serverTimestamp(),
    cancelNoticePending: r.status === 'confirmed',
    updatedAt: serverTimestamp(),
  })
  for (let h = r.startHour; h < r.startHour + r.hours; h++) {
    batch.delete(doc(db, COL.reservationSlots, slotId(r.venue, r.seat, r.date, h)))
  }
  batch.delete(doc(db, COL.reservationDays, dayKeyId(r.uid, r.venue, r.date)))
  await batch.commit()
}
