/**
 * 예약 가능 날짜 범위 계산 — **한 곳에서만** (D-55).
 *
 * 규칙 (docs/1-운영/06-예약-시스템-운영-방안.md §1):
 *   · 매주 「마감 요일·시각」이 지나면 「전달 요일」에 그때까지 들어온 것을 보낸다
 *   · 회원은 **앞으로 N주** 안의 평일을 고른다
 *   · 「마감」은 사이트를 닫는 게 아니라 **첫 날짜를 한 주 미루는 것**이다
 *       마감 전  → 다음 주 월요일부터
 *       마감 뒤  → 다다음 주 월요일부터 (다음 주 것은 다음 전달 때 이미 지난 뒤라)
 *
 * 전부 **순수 함수**다 — `now` 를 인자로 받으므로 시험에서 날짜를 고정할 수 있다.
 * 날짜는 브라우저의 로컬 시간대로 계산한다 (이용자·행정실 모두 한국).
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
  /** 이미 행정실에 전달된 주 (이번 주) — 고를 수 없음 */
  | 'delivered'
  /** 마감이 지나 이번 전달에 못 들어가는 주 (마감 뒤의 다음 주) */
  | 'closed'
  | 'open'

export interface Week {
  monday: string
  friday: string
  /** 월~금 5일 */
  days: string[]
  state: WeekState
}

export interface ReservationWindow {
  /** 고를 수 있는 첫 날짜 (월요일) */
  firstDate: string
  /** 고를 수 있는 마지막 날짜 (금요일) */
  lastDate: string
  /** 이번 주 마감이 지났는가 */
  closePassed: boolean
  /** 지금 예약하면 언제까지 넣어야 다음 전달에 들어가나 */
  closeAt: Date
  /** 지금 예약하면 언제 행정실로 나가나 (YYYY-MM-DD) */
  deliverDate: string
  /** 화면에 보여줄 주 목록 — 잠긴 주(이번 주·마감 지난 다음 주) + 열린 주 N개 */
  weeks: Week[]
}

function weekOf(monday: Date, state: WeekState): Week {
  const days = [0, 1, 2, 3, 4].map((i) => toYmd(addDays(monday, i)))
  return { monday: days[0], friday: days[4], days, state }
}

export function computeWindow(
  settings: ReservationSettings,
  now: Date = new Date()
): ReservationWindow {
  const thisMonday = mondayOf(now)

  // 이번 주 마감 시각
  const closeThisWeek = addDays(thisMonday, (settings.closeWeekday + 6) % 7)
  closeThisWeek.setHours(settings.closeHour, 0, 0, 0)
  const closePassed = now.getTime() >= closeThisWeek.getTime()

  const closeAt = closePassed ? addDays(closeThisWeek, 7) : closeThisWeek
  closeAt.setHours(settings.closeHour, 0, 0, 0)

  // 전달일 — 마감이 속한 주의 전달 요일
  const deliverMonday = mondayOf(closeAt)
  const deliverDate = toYmd(
    addDays(deliverMonday, (settings.deliverWeekday + 6) % 7)
  )

  // 첫 열린 주: 마감 전이면 다음 주, 지났으면 다다음 주
  const firstMonday = addDays(thisMonday, closePassed ? 14 : 7)

  const weeks: Week[] = [weekOf(thisMonday, 'delivered')]
  if (closePassed) weeks.push(weekOf(addDays(thisMonday, 7), 'closed'))
  for (let i = 0; i < settings.rangeWeeks; i++) {
    weeks.push(weekOf(addDays(firstMonday, i * 7), 'open'))
  }

  const openWeeks = weeks.filter((w) => w.state === 'open')
  return {
    firstDate: openWeeks[0].monday,
    lastDate: openWeeks[openWeeks.length - 1].friday,
    closePassed,
    closeAt,
    deliverDate,
    weeks,
  }
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

/** 잠긴 주를 누른 회원에게 보여줄 이유 */
export function lockedReason(week: Week): string {
  if (week.state === 'delivered')
    return '이번 주는 이미 행정실에 전달되었습니다.'
  if (week.state === 'closed')
    return '이번 주 마감이 지나, 다음 주 이용분은 이번 전달에 넣을 수 없습니다.'
  return ''
}

/** '9/16(수) 18:00' */
export function closeAtLabel(closeAt: Date): string {
  return `${closeAt.getMonth() + 1}/${closeAt.getDate()}(${WEEKDAY_KO[closeAt.getDay()]}) ${String(closeAt.getHours()).padStart(2, '0')}:00`
}
