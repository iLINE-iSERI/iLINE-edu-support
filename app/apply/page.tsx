'use client'

import { useEffect, useState } from 'react'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import ProgramCard from '@/components/apply/ProgramCard'
import { listPublishedPrograms, getProgramPhase } from '@/lib/firebase/programs'
import { isFirebaseConfigured } from '@/lib/firebase/config'
import { firestoreErrorMessage } from '@/lib/firebase/errors'
import type { Program } from '@/lib/types'

/**
 * 프로그램 신청 — 공개된 프로그램 목록.
 *
 * 신청서 항목은 프로그램마다 다르므로(사용자 확정), 이 화면에서
 * 프로그램을 먼저 고르고 상세로 들어간다.
 */
export default function ApplyPage() {
  const [programs, setPrograms] = useState<Program[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setPrograms([])
      return
    }
    listPublishedPrograms()
      .then(setPrograms)
      .catch((e) => {
        // 원인을 추측해 한 문장으로 덮어쓰지 않는다.
        // 규칙 문제인지 색인 문제인지 네트워크 문제인지 구분해서 알려줘야
        // 어디를 고쳐야 할지 알 수 있다.
        console.error('[iLINE] 프로그램 목록 조회 실패:', e)
        setError(firestoreErrorMessage(e))
        setPrograms([])
      })
  }, [])

  const open = programs?.filter((p) => getProgramPhase(p) !== 'closed') ?? []
  const closed = programs?.filter((p) => getProgramPhase(p) === 'closed') ?? []

  return (
    <>
      <PageHeader
        title="프로그램 신청"
        description="참여하실 프로그램을 선택해 신청하세요. 프로그램마다 신청 항목과 참여 방식이 다릅니다."
      />

      <div className="container-page space-y-8 py-10">
        {programs === null ? (
          <p className="text-sm text-ink-muted">불러오는 중…</p>
        ) : error ? (
          <EmptyState title="목록을 불러오지 못했습니다" desc={error} />
        ) : programs.length === 0 ? (
          <EmptyState
            title="공개된 프로그램이 없습니다"
            desc="접수가 시작되면 이곳에 프로그램이 표시됩니다. 공고는 알림마당에서도 확인하실 수 있습니다."
          />
        ) : (
          <>
            {open.length > 0 && (
              <section>
                <h2 className="text-lg font-bold tracking-tight">접수중 · 예정</h2>
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {open.map((p) => (
                    <ProgramCard key={p.id} program={p} />
                  ))}
                </div>
              </section>
            )}

            {closed.length > 0 && (
              <section>
                <h2 className="text-lg font-bold tracking-tight text-ink-muted">
                  지난 프로그램
                </h2>
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {closed.map((p) => (
                    <ProgramCard key={p.id} program={p} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </>
  )
}
