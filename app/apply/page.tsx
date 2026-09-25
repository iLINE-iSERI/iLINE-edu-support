'use client'

import { useEffect, useState } from 'react'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import ProgramCard from '@/components/apply/ProgramCard'
import { listPublishedPrograms, getProgramPhase } from '@/lib/firebase/programs'
import { isFirebaseConfigured } from '@/lib/firebase/config'
import { firestoreErrorMessage } from '@/lib/firebase/errors'
import { useAuth } from '@/components/auth/AuthProvider'
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
  /** 테스트 계정이면 비공개 공고까지 보인다 (D-111) — 역할이 확인된 뒤 다시 불러온다 */
  const { member } = useAuth()
  const isTester = member?.role === 'tester'

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setPrograms([])
      return
    }
    listPublishedPrograms({ includeHidden: isTester })
      .then(setPrograms)
      .catch((e) => {
        // 원인을 추측해 한 문장으로 덮어쓰지 않는다.
        // 규칙 문제인지 색인 문제인지 네트워크 문제인지 구분해서 알려줘야
        // 어디를 고쳐야 할지 알 수 있다.
        console.error('[iLINE] 프로그램 목록 조회 실패:', e)
        setError(firestoreErrorMessage(e))
        setPrograms([])
      })
  }, [isTester])

  const open = programs?.filter((p) => getProgramPhase(p) !== 'closed') ?? []
  const closed = programs?.filter((p) => getProgramPhase(p) === 'closed') ?? []

  return (
    <>
      <PageHeader
        title="프로그램 신청"
        description="참여하실 프로그램을 선택해 신청하세요. 프로그램마다 신청 항목과 참여 방식이 다릅니다."
      />

      <div className="container-page space-y-8 py-10">
        {/* 테스트 계정이라는 걸 늘 알 수 있게 — 모르고 실제 공고에 시험 신청을 넣지 않도록 */}
        {isTester && (
          <p className="rounded-lg border-l-4 border-warn bg-warn-soft px-3 py-2 text-sm leading-relaxed text-warn-ink">
            <strong>테스트 계정으로 로그인 중입니다.</strong> 비공개 공고도 보이고 신청해 볼 수
            있습니다. 이 계정이 낸 것은 <strong>구글 시트·드라이브로 가지 않습니다.</strong>
          </p>
        )}
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
                <h2 className="section-title">접수중 · 예정</h2>
                {/* 한 줄에 한 장 — 가로 분할 카드(D-81). 프로그램이 서너 개라 두 칸보다 낫다 */}
                <div className="mt-4 grid gap-4">
                  {open.map((p) => (
                    <ProgramCard key={p.id} program={p} />
                  ))}
                </div>
              </section>
            )}

            {closed.length > 0 && (
              <section>
                <h2 className="section-title">지난 프로그램</h2>
                <div className="mt-4 grid gap-4">
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
