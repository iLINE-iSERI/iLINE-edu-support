/**
 * 예약 대상 공간 — 코드 안의 상수 (설계 §5-1).
 *
 * **호실이 곧 예약 단위다 (09-13 · D-66).** 처음에는 "미디어랩 / 학습실 /
 * 스터디룸"이라는 **용도 분류**로 예약을 받았는데, 실제로는 분류마다 호실이
 * 하나씩 정해져 있고 안내판·행정실 서류가 전부 호실 이름으로 되어 있다.
 * 회원이 고르는 것도, 행정실에 보내는 것도 **"2316 디지털컨버전스수업실"**
 * 이어야 서로 같은 것을 말하게 된다. 분류(`category`)는 설명용으로만 남긴다.
 *
 * 단체대관은 별도 공간(2334)이 있다 — 다른 방을 통째로 빌리는 것이 아니다.
 * 회원 화면에는 안 보이고(`staffOnly`) 담당자 「직접 예약 추가」로만 잡는다.
 *
 * 관리자가 화면에서 좌석 수를 바꿀 일이 생기면 그때 컬렉션으로 옮긴다
 * (D-29 정신 — 미리 만들지 않기). 자리 수는 09-09 교수님이 실제와 같다고
 * 확인한 것이다 (J-1).
 *
 * 🔴 운영 시간과 마지막 칸은 **가정값**이다 (J-2). 행정실이 18시까지라
 *    17시 시작 = 마지막 칸으로 두었다. 확인되면 여기만 고친다.
 */

import type { VenueCode } from '@/lib/types'

/** 모든 공간이 있는 건물 — 화면에는 호실 앞에 붙여 쓴다 */
export const BUILDING = '사범대학 2호관'

export interface Venue {
  code: VenueCode
  /** 호실 번호 — '2316'. 예약 단위이자 행정실과 통하는 이름 */
  room: string
  /** 공식 명칭 — '디지털컨버전스수업실' */
  name: string
  /** 용도 분류 — 설명용. '개인학습실' 등. 예약 단위가 아니다 */
  category: string
  /** 자리를 부르는 말 — '랩실' · '좌석' · '테이블' · '공간' */
  unit: string
  /** 자리 번호 목록 — 예약 문서의 `seat` 값 그대로 */
  seats: string[]
  /** 한 자리당 인원 (안내용). 모르면 0 */
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
  /** 회원 화면에 안 보이고 담당자 「직접 추가」로만 잡는 공간 (단체대관용) */
  staffOnly?: boolean
}

function range(n: number, pad = 0): string[] {
  return Array.from({ length: n }, (_, i) => String(i + 1).padStart(pad, '0'))
}

export const VENUES: Venue[] = [
  {
    code: 'ST',
    room: '2316',
    name: '디지털컨버전스수업실',
    category: '개인학습실',
    unit: '좌석',
    seats: range(12, 2),
    capacity: 1,
    pick: 'map',
    mapColumns: 4,
    summary: '좌석 12개 · 1인',
    description: '개인 학습, 집중 작업',
  },
  {
    code: 'ML',
    room: '2317',
    name: '블렌디드수업실',
    category: '미디어·블렌디드',
    unit: '랩실',
    seats: range(3),
    capacity: 4,
    pick: 'auto',
    summary: '랩실 3개 · 실당 4명',
    description: '영상 제작·편집, 온라인 수업 진행',
  },
  {
    code: 'GR',
    room: '2319',
    name: '토론수업실',
    category: '그룹 스터디룸',
    unit: '테이블',
    seats: range(4),
    capacity: 6,
    pick: 'auto',
    summary: '테이블 4개 · 6명',
    description: '팀 프로젝트, 토론, 발표 연습',
  },
  {
    code: 'HY',
    room: '2334',
    name: '하이브리드러닝연구실',
    category: '단체대관용',
    unit: '공간',
    seats: ['1'],
    // 🔴 정원 미확인 (09-13) — 알게 되면 여기와 summary 를 고친다
    capacity: 0,
    pick: 'auto',
    summary: '공간 전체 · 단체 대관 전용',
    description: '문의 후 담당자가 등록',
    staffOnly: true,
  },
]

/** 회원이 직접 예약할 수 있는 공간 — 단체대관용은 뺀다 */
export const MEMBER_VENUES: Venue[] = VENUES.filter((v) => !v.staffOnly)

/** 호실 + 명칭 — '2316 디지털컨버전스수업실'. 명단·카드·확인 화면 공통 */
export function venueLabel(code: VenueCode): string {
  const v = venueOf(code)
  return `${v.room} ${v.name}`
}

/** 건물까지 — '사범대학 2호관 2316 디지털컨버전스수업실' (행정실 전달 명단 머리글용) */
export function venueFullLabel(code: VenueCode): string {
  return `${BUILDING} ${venueLabel(code)}`
}

export function venueOf(code: VenueCode): Venue {
  const v = VENUES.find((x) => x.code === code)
  if (!v) throw new Error(`알 수 없는 공간 코드: ${code}`)
  return v
}

/** 자리 이름 — '07번 좌석' · '랩실 2' · '테이블 3' · 자리가 하나뿐이면 '공간 전체' */
export function seatLabel(code: VenueCode, seat: string): string {
  const v = venueOf(code)
  if (v.seats.length === 1) return `${v.unit} 전체`
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
