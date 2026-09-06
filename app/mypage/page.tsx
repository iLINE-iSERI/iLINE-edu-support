'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import Placeholder from '@/components/ui/Placeholder'
import MemberGate from '@/components/auth/MemberGate'
import { useAuth } from '@/components/auth/AuthProvider'
import { listMyApplications, fileUrl } from '@/lib/firebase/applications'
import { listMySettlements } from '@/lib/firebase/settlements'
import SettlementSection from '@/components/settlement/SettlementSection'
import { firestoreErrorMessage } from '@/lib/firebase/errors'
import {
  APPLICATION_STATUS_LABEL,
  type Application,
  type Settlement,
} from '@/lib/types'

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
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!user) return
    try {
      const [list, mine] = await Promise.all([
        listMyApplications(user.uid),
        // 정산 조회가 실패해도 신청 현황은 보여야 한다 — 정산은 부가 정보다
        listMySettlements(user.uid).catch((e) => {
          console.warn('[iLINE] 정산 조회 실패:', e)
          return []
        }),
      ])
      setApps(list)
      setSettlements(mine)
    } catch (e) {
      console.error('[iLINE] 신청 목록 조회 실패:', e)
      setError(firestoreErrorMessage(e))
      setApps([])
    }
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

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

                    <div className="mt-3 flex flex-wrap gap-2">
                      {a.generatedPdfPath && (
                        <FileButton
                          path={a.generatedPdfPath}
                          label="제출한 신청서 (PDF)"
                          primary
                        />
                      )}
                      {a.files?.map((f) => (
                        <FileButton
                          key={f.storagePath}
                          path={f.storagePath}
                          label={f.fileName}
                        />
                      ))}
                    </div>

                    {/* 보완 요청·미선정 사유 (D-10) */}
                    {a.reviewNote && (
                      <div className="mt-3 rounded-lg bg-subtle p-3 text-sm leading-relaxed">
                        <p className="font-semibold">담당자 안내</p>
                        <p className="mt-1 text-ink-muted">{a.reviewNote}</p>
                      </div>
                    )}

                    {/* 정산 — 선정된 건에만 (D-19 / D-39).
                        아직 지급 대상이 아닌 사람에게 계좌를 물으면
                        쓸 일 없는 계좌를 보유하게 된다 (D-38) */}
                    {a.status === 'approved' && user && (
                      <SettlementSection
                        application={a}
                        settlement={
                          settlements.find((s) => s.applicationId === a.id) ??
                          null
                        }
                        uid={user.uid}
                        onDone={load}
                      />
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
        phase="Phase 4′ · 6"
        blockedBy="갤러리 공개 방침"
        items={[
          '산출물 제출 (D-19) — 선정 이후 노출',
          '회원정보 수정',
        ]}
      />
    </>
  )
}

/**
 * 제출한 파일 열기 — 신청서 PDF(D-28)와 첨부 서류 공용.
 *
 * 링크를 미리 만들어 두지 않고 누를 때 발급받는다.
 * Storage 다운로드 URL 은 토큰이 붙은 주소라, 목록에 박아두면
 * 화면을 캡처하거나 공유하는 것만으로 새어 나갈 수 있다.
 */
function FileButton({
  path,
  label,
  primary,
}: {
  path: string
  label: string
  primary?: boolean
}) {
  const [busy, setBusy] = useState(false)

  async function open() {
    setBusy(true)
    try {
      window.open(await fileUrl(path), '_blank', 'noopener')
    } catch (e) {
      console.error('[iLINE] 파일 열기 실패:', e)
      alert('파일을 여는 데 실패했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={open}
      disabled={busy}
      title={label}
      className={
        'inline-flex max-w-full items-center rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50 ' +
        (primary
          ? 'border-line-strong hover:bg-subtle'
          : 'border-line text-ink-muted hover:bg-subtle')
      }
    >
      <span className="truncate">{busy ? '여는 중…' : label}</span>
    </button>
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
