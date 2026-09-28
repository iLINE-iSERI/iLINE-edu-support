/**
 * 예약 가능 날짜 범위 계산 — **한 곳에서만** (D-55 · D-115).
 *
 * 규칙 (D-115 · 09-28 운영진 결정 — docs/1-운영/06-예약-시스템-운영-방안.md §1):
 *   · 이용일 **N일 전 23:59 까지** 예약한다(기본 3일 · 달력 기준 — 주말도 하루로 센다)
 *     → 지금 고를 수 있는 첫 날짜는 **오늘 + N일**. 그날의 마감이 **오늘 23:59** 다
 *   · 전달은 담당자가 명단을 열 때마다(요일 없음). 명단은 원래 날짜가 아니라 상태로 뽑는다(D-55)
 *   · 범위는 **앞으로 N주** — 첫 날짜가 든 주부터 센다
 *   · 잠금은 **날짜 단위**다. 예전(「매주 수요일 마감 → 목요일 전달」)에는 주를 통째로 잠갔다
 *
 * 전부 **순수 함수**다 — `now` 를 인자로 받으므로 시험에서 날짜를 고정할 수 있다.
 * 날짜는 브라우저의 로컬 시간대로 계산한다 (이용자·행정실 모두 한국).
 * 보안 규칙은 날짜 범위를 검사하지 않는다(형식만) — 화면과 lib(createReservation)가 이 판단을 쓴다.
 */

import type { ReservationSettings } from '@/lib/types'

/* ── 날짜 문자열 (YYYY-MM-DD) 유틸 ───────────────────────────── */

export function toYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 로컬 자정의 Date — 시간대 밀림을 피하려고 `new Date(str)` 를 쓰지 않는다 */
export function fromYmd(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  r.setHours(0, 0, 0, 0)
  return r
}

/** 그 주 월요일 (로컬 자정) */
export function mondayOf(d: Date): Date {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  const wd = r.getDay() // 0=일
  const diff = wd === 0 ? -6 : 1 - wd
  return addDays(r, diff)
}

/** 슬롯·열쇠 문서 ID 에 쓰는 압축형 — 20260922 */
export function compactYmd(ymd: string): string {
  return ymd.replace(/-/g, '')
}

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토']

/** '9/22(화)' */
export function shortDate(ymd: string): string {
  const d = fromYmd(ymd)
  return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAY_KO[d.getDay()]})`
}

/** '2026. 9. 22.(화)' */
export function longDate(ymd: string): string {
  const d = fromYmd(ymd)
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.(${WEEKDAY_KO[d.getDay()]})`
}

export function weekdayKo(n: number): string {
  return WEEKDAY_KO[n]
}

/* ── 범위 계산 ───────────────────────────────────────────────── */

export type WeekState =
  /** 고를 수 있는 날이 하나도 없는 주 — 마감이 다 지났다 */
  | 'closed'
  /** 고를 수 있는 날이 있는 주 (앞쪽 며칠은 마감이 지났을 수 있다 — 날짜별로 본다) */
  | 'open'

export interface Week {
  monday: string
  friday: string
  /** 월~금 5일 */
  days: string[]
  state: WeekState
}

export interface ReservationWindow {
  /** 고를 수 있는 첫 날짜 — 오늘 + N일 (주말일 수도 있다. 주말은 어차피 못 고른다) */
  firstDate: string
  /** 고를 수 있는 마지막 날짜 (금요일) */
  lastDate: string
  /**
   * 실제로 고를 수 있는 가장 가까운 날 — firstDate 가 주말·휴관일이면 그다음 평일.
   * 안내 문구는 이것을 쓴다(「10/3(토)부터」라고 하면 토요일을 고를 수 있는 줄 안다)
   */
  firstOpenDate: string
  /** firstOpenDate 의 예약 마감 — 그날 N일 전 23:59 */
  closeAt: Date
  /** 며칠 전까지 받나 (안내 문구용) */
  leadDays: number
  /** 화면에 보여줄 주 목록 — 이번 주부터 마지막 주까지 */
  weeks: Week[]
}

function weekOf(monday: Date, state: WeekState): Week {
  const days = [0, 1, 2, 3, 4].map((i) => toYmd(addDays(monday, i)))
  return { monday: days[0], friday: days[4], days, state }
}

/** 이 날 또는 그 뒤의 첫 평일 */
function onOrAfterWeekday(d: Date): Date {
  let r = new Date(d)
  while (r.getDay() === 0 || r.getDay() === 6) r = addDays(r, 1)
  return r
}

export function computeWindow(
  settings: ReservationSettings,
  now: Date = new Date()
): ReservationWindow {
  const leadDays = Math.max(0, settings.leadDays)
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)

  const first = addDays(today, leadDays)

  // 범위: 첫 날짜가 주말이면 그다음 평일이 든 주부터 N주
  const firstMonday = mondayOf(onOrAfterWeekday(first))
  const lastMonday = addDays(firstMonday, (Math.max(1, settings.rangeWeeks) - 1) * 7)
  const firstDate = toYmd(first)
  const lastDate = toYmd(addDays(lastMonday, 4))

  // 가장 가까운 「고를 수 있는 날」과 그 마감(그날 N일 전 23:59) — 안내 문구용
  let open = onOrAfterWeekday(first)
  while (settings.closedDates.includes(toYmd(open)) && toYmd(open) <= lastDate) {
    open = onOrAfterWeekday(addDays(open, 1))
  }
  const closeAt = addDays(open, -leadDays)
  closeAt.setHours(23, 59, 0, 0)

  // 이번 주부터 보여 준다 — 마감이 지난 날도 「왜 안 되나」를 보여 주려고
  const weeks: Week[] = []
  for (let m = mondayOf(today); m.getTime() <= lastMonday.getTime(); m = addDays(m, 7)) {
    const w = weekOf(m, 'open')
    w.state = w.friday < firstDate ? 'closed' : 'open'
    weeks.push(w)
  }

  return { firstDate, lastDate, firstOpenDate: toYmd(open), closeAt, leadDays, weeks }
}

/** 이 날짜를 지금 고를 수 있는가 — 화면과 lib 양쪽에서 같은 판단을 쓴다 */
export function isSelectableDate(
  win: ReservationWindow,
  settings: ReservationSettings,
  ymd: string
): boolean {
  if (ymd < win.firstDate || ymd > win.lastDate) return false
  const wd = fromYmd(ymd).getDay()
  if (wd === 0 || wd === 6) return false
  if (settings.closedDates.includes(ymd)) return false
  return true
}

/** 마감이 지난 날짜를 누른 회원에게 보여줄 이유 */
export function pastReason(win: ReservationWindow): string {
  return `예약 마감이 지났습니다 — 이용일 ${win.leadDays}일 전 23:59까지 예약할 수 있습니다.`
}

/** 잠긴 주(고를 날이 하나도 없는 주)를 누른 회원에게 보여줄 이유 */
export function lockedReason(week: Week, win: ReservationWindow): string {
  if (week.state !== 'closed') return ''
  return `이 주는 예약 마감이 모두 지났습니다. 이용일 ${win.leadDays}일 전 23:59까지 예약할 수 있습니다.`
}

/** '9/28(월) 23:59' */
export function closeAtLabel(closeAt: Date): string {
  const hh = String(closeAt.getHours()).padStart(2, '0')
  const mm = String(closeAt.getMinutes()).padStart(2, '0')
  return `${closeAt.getMonth() + 1}/${closeAt.getDate()}(${WEEKDAY_KO[closeAt.getDay()]}) ${hh}:${mm}`
}
