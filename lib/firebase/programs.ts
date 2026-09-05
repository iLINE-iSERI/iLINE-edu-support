// 프로그램 (support_programs)
//
// 사업 안에 여러 프로그램이 있고, 프로그램마다 참여 방식과 신청 항목이 다르다.
// 그래서 신청서 폼을 하나로 고정하지 않고 프로그램에 붙여둔다.

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  Timestamp,
} from 'firebase/firestore'
import { getDb, COL } from './config'
import type { Program } from '@/lib/types'

/** 접수 상태 — opensAt / closesAt 으로 계산한다 */
export type ProgramPhase = 'upcoming' | 'open' | 'closed'

export function getProgramPhase(p: Program, now = new Date()): ProgramPhase {
  const opens = p.opensAt?.toDate()
  const closes = p.closesAt?.toDate()
  if (opens && now < opens) return 'upcoming'
  if (closes && now > closes) return 'closed'
  return 'open'
}

export const PHASE_LABEL: Record<ProgramPhase, string> = {
  upcoming: '접수 예정',
  open: '접수중',
  closed: '접수 마감',
}

/** 마감까지 남은 일수. 마감일이 없거나 이미 지났으면 null */
export function daysUntilClose(p: Program, now = new Date()): number | null {
  const closes = p.closesAt?.toDate()
  if (!closes) return null
  const diff = closes.getTime() - now.getTime()
  if (diff < 0) return null
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function toProgram(id: string, data: Record<string, unknown>): Program {
  return { id, ...data } as Program
}

/** 목록에서의 우선순위 — 작을수록 위 */
const PHASE_ORDER: Record<ProgramPhase, number> = {
  open: 0,
  upcoming: 1,
  closed: 2,
}

/**
 * 공개된 프로그램 목록.
 *
 * 정렬 기준은 **지금 신청할 수 있는 것이 위**다.
 *   ① 접수중 → 접수 예정 → 마감
 *   ② 같은 상태끼리는 **마감이 임박한 순** (예정은 시작이 가까운 순)
 *   ③ 그래도 같으면 최신 연도
 *
 * 연도 하나로만 정렬하면 같은 해 프로그램끼리 문서 ID 순으로 늘어서서,
 * **접수 예정이 접수중보다 위에 오는 일이 생긴다.** 지금 신청 가능한 건이
 * 뒤로 밀리면 접수 기간에 실제로 놓치는 사람이 나온다.
 *
 * ⚠️ 정렬을 Firestore에 맡기지 않고 여기서 한다.
 *    `where('published','==',true)` 와 `orderBy(...)` 를 함께 쓰면
 *    Firestore가 **복합 색인(composite index)** 을 요구하고,
 *    색인을 만들기 전까지 목록 조회가 통째로 실패한다(failed-precondition).
 *    애초에 위 기준은 '현재 시각'에 따라 달라져서 색인으로는 표현되지 않는다.
 *    프로그램은 많아야 수십 건이라 클라이언트 정렬로 충분하다.
 */
export async function listPublishedPrograms(): Promise<Program[]> {
  const q = query(
    collection(getDb(), COL.programs),
    where('published', '==', true)
  )
  const snap = await getDocs(q)
  const now = new Date()

  return snap.docs
    .map((d) => toProgram(d.id, d.data()))
    .sort((a, b) => {
      const pa = getProgramPhase(a, now)
      const pb = getProgramPhase(b, now)
      if (pa !== pb) return PHASE_ORDER[pa] - PHASE_ORDER[pb]

      // 접수 예정은 '시작이 가까운 순', 나머지는 '마감이 가까운 순'.
      // 날짜가 없는 건(상시 접수)은 맨 뒤로 보낸다.
      const key = (p: Program) =>
        (pa === 'upcoming' ? p.opensAt : p.closesAt)?.toDate().getTime()
      const ka = key(a)
      const kb = key(b)
      if (ka !== kb) {
        if (ka === undefined) return 1
        if (kb === undefined) return -1
        // 마감된 건은 '최근에 끝난 것'이 위로 오는 편이 자연스럽다
        return pa === 'closed' ? kb - ka : ka - kb
      }

      return (b.year ?? 0) - (a.year ?? 0)
    })
}

export async function getProgram(id: string): Promise<Program | null> {
  const snap = await getDoc(doc(getDb(), COL.programs, id))
  if (!snap.exists()) return null
  return toProgram(snap.id, snap.data())
}

/** 날짜 표기 — '2026. 9. 1.' */
export function formatDate(ts?: Timestamp): string {
  if (!ts) return ''
  return ts.toDate().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/** 기간 표기 — '2026. 9. 1. ~ 9. 18.' */
export function formatPeriod(from?: Timestamp, to?: Timestamp): string {
  if (!from && !to) return '상시'
  if (from && !to) return `${formatDate(from)}부터`
  if (!from && to) return `${formatDate(to)}까지`
  return `${formatDate(from)} ~ ${formatDate(to)}`
}
