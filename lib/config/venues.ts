/**
 * 예약 대상 공간 — 코드 안의 상수 (설계 §5-1).
 *
 * 관리자가 화면에서 좌석 수를 바꿀 일이 생기면 그때 컬렉션으로 옮긴다
 * (D-29 정신 — 미리 만들지 않기). 숫자는 09-09 교수님이 실제와 같다고
 * 확인한 것이다 (J-1).
 *
 * 🔴 운영 시간과 마지막 칸은 **가정값**이다 (J-2). 행정실이 18시까지라
 *    17시 시작 = 마지막 칸으로 두었다. 확인되면 여기만 고친다.
 */

import type { VenueCode } from '@/lib/types'

export interface Venue {
  code: VenueCode
  name: string
  /** 자리를 부르는 말 — '랩실' · '좌석' · '테이블' */
  unit: string
  /**
   * 사범대학 몇 호실인지 — 🔴 **아직 모름** (iSERI 가 추후 알려주기로, 09-12).
   * 값이 들어오면 화면·명단에 자동으로 붙는다 (`venueLabel`).
   */
  room?: string
  /** 자리 번호 목록 — 예약 문서의 `seat` 값 그대로 */
  seats: string[]
  /** 한 자리당 인원 (안내용) */
  capacity: number
  /**
   * 자리를 어떻게 정하나 (화면 설계 §1-4)
   *   map  — 배치도에서 회원이 직접 고른다 (좌석 — 창가·구석 선호가 실제로 있다)
   *   auto — 비어 있는 것 중 하나를 자동으로 준다 (랩실·테이블 — 차이가 적다)
   */
  pick: 'map' | 'auto'
  /** 배치도 열 수 (pick === 'map' 일 때) */
  mapColumns?: number
  summary: string
  description: string
}

function range(n: number, pad = 0): string[] {
  return Array.from({ length: n }, (_, i) => String(i + 1).padStart(pad, '0'))
}

export const VENUES: Venue[] = [
  {
    code: 'ML',
    name: '미디어·블렌디드 랩',
    unit: '랩실',
    seats: range(3),
    capacity: 4,
    pick: 'auto',
    summary: '랩실 3개 · 실당 4명',
    description: '영상 제작·편집, 온라인 수업 진행',
  },
  {
    code: 'ST',
    name: '개인·협업 학습실',
    unit: '좌석',
    seats: range(12, 2),
    capacity: 1,
    pick: 'map',
    mapColumns: 4,
    summary: '좌석 12개 · 1인',
    description: '개인 학습, 집중 작업',
  },
  {
    code: 'GR',
    name: '그룹 스터디룸',
    unit: '테이블',
    seats: range(4),
    capacity: 6,
    pick: 'auto',
    summary: '테이블 4개 · 6명',
    description: '팀 프로젝트, 토론, 발표 연습',
  },
]

/** 공간 이름 + 호실 — '개인·협업 학습실 (사범대 2호관 305호)'. 호실이 없으면 이름만 */
export function venueLabel(code: VenueCode): string {
  const v = venueOf(code)
  return v.room ? `${v.name} (${v.room})` : v.name
}

export function venueOf(code: VenueCode): Venue {
  const v = VENUES.find((x) => x.code === code)
  if (!v) throw new Error(`알 수 없는 공간 코드: ${code}`)
  return v
}

/** 자리 이름 — '07번 좌석' · '랩실 2' · '테이블 3' */
export function seatLabel(code: VenueCode, seat: string): string {
  const v = venueOf(code)
  return v.pick === 'map' ? `${seat}번 ${v.unit}` : `${v.unit} ${seat}`
}

/* ── 운영 시간 (J-2 가정값) ───────────────────────────────────── */

/** 문 여는 시각 — 첫 칸 시작 */
export const OPEN_HOUR = 9
/** 문 닫는 시각 — 모든 예약이 이 시각 안에 끝나야 한다 */
export const CLOSE_HOUR = 18
/** 한 번에 최대 몇 시간 (설계 §2-3) */
export const MAX_HOURS = 2

/** 고를 수 있는 시작 시각 목록 — 9, 10, …, 17 */
export const START_HOURS: number[] = Array.from(
  { length: CLOSE_HOUR - OPEN_HOUR },
  (_, i) => OPEN_HOUR + i
)

/** 그 시각에 시작해 몇 시간까지 가능한가 — 17시 시작이면 1시간뿐 */
export function maxHoursFrom(startHour: number): number {
  return Math.max(0, Math.min(MAX_HOURS, CLOSE_HOUR - startHour))
}

export function hourLabel(h: number): string {
  return `${String(h).padStart(2, '0')}:00`
}
