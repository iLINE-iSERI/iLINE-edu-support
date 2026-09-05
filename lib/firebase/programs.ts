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

/**
 * 공개된 프로그램 목록 (최신 연도 우선)
 *
 * ⚠️ 정렬을 Firestore에 맡기지 않고 여기서 한다.
 *    `where('published','==',true)` 와 `orderBy('year')` 를 함께 쓰면
 *    Firestore가 **복합 색인(composite index)** 을 요구하고,
 *    색인을 만들기 전까지 목록 조회가 통째로 실패한다(failed-precondition).
 *    프로그램은 많아야 수십 건이라 클라이언트 정렬로 충분하고,
 *    그 대가로 배포 절차가 하나 줄어든다.
 */
export async function listPublishedPrograms(): Promise<Program[]> {
  const q = query(
    collection(getDb(), COL.programs),
    where('published', '==', true)
  )
  const snap = await getDocs(q)
  return snap.docs
    .map((d) => toProgram(d.id, d.data()))
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
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
