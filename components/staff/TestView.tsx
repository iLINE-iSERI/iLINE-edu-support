'use client'

/**
 * 시험 데이터 보기 (D-124 · 10-03 sunbell — *"테스트 계정들의 내역이 보이는게 실제 업무를 보는 데에는 방해가 됩니다"*)
 *
 * 테스트 계정(D-111)이 낸 신청·정산·산출물·문의·예약은 시트·드라이브로는 안 가지만(D-111) 관리 화면에는
 * 실제 건과 섞여 보였다 — 정산 관리에서는 「시험」 배지도 없어 확인 대기 3건 중 2건이 시험이었다(10-03 확인).
 * 그래서 **기본은 모든 관리 화면의 목록과 숫자에서 뺀다.** 시험하는 사람(sunbell)만 관리 줄 오른쪽 끝의
 * 「시험 데이터 보기」를 켠다 — 켜면 어느 화면에서나 「시험」 배지를 달고 섞여 보이고, 맨 위에 귤색 띠가 뜬다.
 *
 *   · 한 스위치로 모든 관리 화면 — 시험은 신청 → 선정 → 정산처럼 화면을 이어 가는 일이라
 *   · 켠 상태는 **이 브라우저에만** 기억(localStorage) — 운영 담당자 화면은 늘 꺼진 채
 *   · 가려내는 기준: 「시험」 표시(`sheetSkipped === 'tester'` — 서버가 동기화 때 붙임) **또는** 주인이 지금
 *     테스트 계정. 예약에는 표시가 없어 주인 쪽이 꼭 필요하다. 한 번 표시가 붙은 건은 계정을 되돌려도 시험(D-111)
 *   · 행정실 전달 명단은 이 스위치와 상관없이 **늘** 뺀다 — 사이트 밖으로 나가는 것이라(화면 쪽에서)
 *
 * 화면은 `useTestView()` 의 `visible(list)` 로 거르고, 배지는 `isTest(doc)` 로 단다.
 * 테스트 계정 목록을 읽기 전(`ready` 가 false)에는 표시만으로 거른다 — 행정실 명단은 `ready` 를 기다린다.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '@/components/auth/AuthProvider'
import { listTesterUids } from '@/lib/firebase/members'

const STORAGE_KEY = 'iline.staff.showTests'

/** 시험인지 가려낼 수 있는 문서 — 신청·정산·산출물·문의는 표시가, 예약·회원은 uid 만 있다 */
export interface TestCheckable {
  uid?: string
  sheetSkipped?: string
}

interface TestViewValue {
  showTests: boolean
  setShowTests: (v: boolean) => void
  /** 테스트 계정 목록을 읽었는가(실패해도 true — 그때는 표시만으로) */
  ready: boolean
  isTest: (d: TestCheckable) => boolean
  /** 스위치가 꺼져 있으면 시험 건을 뺀 목록 */
  visible: <T extends TestCheckable>(list: readonly T[]) => T[]
}

const Ctx = createContext<TestViewValue>({
  showTests: false,
  setShowTests: () => {},
  ready: false,
  isTest: (d) => d.sheetSkipped === 'tester',
  visible: (list) => list.filter((d) => d.sheetSkipped !== 'tester'),
})

export function TestViewProvider({ children }: { children: ReactNode }) {
  const { member } = useAuth()
  const isStaff = member?.role === 'staff' && member.status === 'active'

  // 처음엔 늘 꺼진 상태로 그린다 — 서버 렌더링과 어긋나지 않게. 기억한 값은 그다음에 읽는다
  const [showTests, setShow] = useState(false)
  useEffect(() => {
    try {
      setShow(window.localStorage.getItem(STORAGE_KEY) === '1')
    } catch {
      // 저장소를 못 쓰는 브라우저 — 꺼진 채로
    }
  }, [])
  const setShowTests = useCallback((v: boolean) => {
    setShow(v)
    try {
      window.localStorage.setItem(STORAGE_KEY, v ? '1' : '0')
    } catch {
      // 기억만 못 할 뿐 이 화면에서는 바뀐다
    }
  }, [])

  const [testerUids, setTesterUids] = useState<ReadonlySet<string>>(new Set())
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (!isStaff) return
    listTesterUids()
      .then((uids) => setTesterUids(new Set(uids)))
      .catch((e) => console.warn('[iLINE] 테스트 계정 목록을 읽지 못했습니다 — 「시험」 표시만으로 거릅니다:', e))
      .finally(() => setReady(true))
  }, [isStaff])

  const value = useMemo<TestViewValue>(() => {
    const isTest = (d: TestCheckable) => d.sheetSkipped === 'tester' || (!!d.uid && testerUids.has(d.uid))
    return {
      showTests,
      setShowTests,
      ready,
      isTest,
      visible: (list) => (showTests ? [...list] : list.filter((d) => !isTest(d))),
    }
  }, [showTests, setShowTests, ready, testerUids])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useTestView() {
  return useContext(Ctx)
}
