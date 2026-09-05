'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import Placeholder from '@/components/ui/Placeholder'
import MemberGate from '@/components/auth/MemberGate'
import { useAuth } from '@/components/auth/AuthProvider'
import { listMyApplications } from '@/lib/firebase/applications'
import { firestoreErrorMessage } from '@/lib/firebase/errors'
import { APPLICATION_STATUS_LABEL, type Application } from '@/lib/types'

export default function MypagePage() {
  return (
    <MemberGate>
      <Suspense fallback={null}>
        <MypageContent />
      </Suspense>
    </MemberGate>
  )
}

function MypageContent() {
  const { member, user } = useAuth()
  const params = useSearchParams()
  const justSubmitted = params.get('submitted') === '1'

  const [apps, setApps] = useState<Application[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return
    listMyApplications(user.uid)
      .then(setApps)
      .catch((e) => {
        console.error('[iLINE] 신청 목록 조회 실패:', e)
        setError(firestoreErrorMessage(e))
        setApps([])
      })
  }, [user])

  return (
    <>
      <PageHeader
        title="마이페이지"
        description={
          member
            ? `${member.name}님, 안녕하세요.`
            : '신청 현황과 제출 서류를 확인합니다.'
        }
      />

      <div className="container-page space-y-8 py-8">
        {justSubmitted && (
          <div
            role="status"
            className="rounded-xl border border-status-approved/40 bg-status-approved/10 p-4 text-sm leading-relaxed"
          >
            <p className="font-bold text-status-approved">
              신청서가 제출되었습니다
            </p>
            <p className="mt-1 text-ink-muted">
              검토 결과는 아래 신청 현황에서 확인하실 수 있습니다.
            </p>
          </div>
        )}

        {/* ── 내 신청 현황 (D-11) ──────────────────────────── */}
        <section>
          <h2 className="text-lg font-bold tracking-tight">내 신청 현황</h2>

          <div className="mt-4">
            {apps === null ? (
              <p className="text-sm text-ink-muted">불러오는 중…</p>
            ) : error ? (
              <EmptyState title="신청 내역을 불러오지 못했습니다" desc={error} />
            ) : apps.length === 0 ? (
              <EmptyState
                title="아직 신청하신 프로그램이 없습니다"
                desc="접수 중인 프로그램을 확인해 보세요."
                action={
                  <Link
                    href="/apply"
                    className="touch-target inline-flex items-center justify-center rounded-xl bg-brand-600 px-6 font-bold text-white hover:bg-brand-700"
                  >
                    프로그램 보기
                  </Link>
                }
              />
            ) : (
              <ul className="space-y-3">
                {apps.map((a) => (
                  <li
                    key={a.id}
                    className="rounded-2xl border border-line bg-surface p-5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-subtle px-2.5 py-1 text-xs font-bold">
                        {APPLICATION_STATUS_LABEL[a.status]}
                      </span>
                      {a.submittedAt && (
                        <span className="text-xs text-ink-subtle">
                          {a.submittedAt.toDate().toLocaleDateString('ko-KR')}{' '}
                          제출
                        </span>
                      )}
                    </div>

                    <p className="mt-2 font-bold">
                      {a.programTitle || a.programId}
                    </p>

                    {a.files?.length > 0 && (
                      <p className="mt-1 text-sm text-ink-muted">
                        첨부 {a.files.length}건
                      </p>
                    )}

                    {/* 보완 요청·미선정 사유 (D-10) */}
                    {a.reviewNote && (
                      <div className="mt-3 rounded-lg bg-subtle p-3 text-sm leading-relaxed">
                        <p className="font-semibold">담당자 안내</p>
                        <p className="mt-1 text-ink-muted">{a.reviewNote}</p>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* ── 내 정보 ──────────────────────────────────────── */}
        {member && (
          <section>
            <h2 className="text-lg font-bold tracking-tight">내 정보</h2>
            <dl className="mt-4 grid gap-3 rounded-2xl border border-line bg-surface p-5 text-sm sm:grid-cols-2">
              <Row label="학번" value={member.studentId} />
              <Row
                label="전공 · 학년"
                value={`${member.major} · ${member.grade}`}
              />
              <Row label="이메일" value={member.email} />
              <Row label="연락처" value={member.phone} />
            </dl>
          </section>
        )}
      </div>

      <Placeholder
        phase="Phase 5 · 6"
        blockedBy="선정 결과 · 정산 일정"
        items={[
          '산출물 제출 (D-19) — 선정 이후 노출',
          '정산 증빙 제출 (D-19) — 정산 기간 개시 후 노출',
          '회원정보 수정',
        ]}
      />
    </>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-ink-subtle">{label}</dt>
      <dd className="mt-0.5 break-all font-medium">{value}</dd>
    </div>
  )
}
