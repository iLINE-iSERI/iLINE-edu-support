'use client'

/**
 * 행정실 전달 명단 — **이 시스템의 핵심 산출물** (화면 설계 §3, D-53 ④ · D-55).
 *
 * 목요일에 담당자가 여는 화면. 손으로 정리하지 않아도 되게 만드는 것이 전부다.
 *   ■ 새 사용 요청 — 아직 안 보낸 접수 건 전부 (다음 주 것도, 3주 뒤 것도)
 *   ■ 취소        — 지난번에 보낸 것 중 회원이 취소한 것
 * 행정실에 어떻게 전달할지(메일·구두·인쇄)는 운영진이 정한다(09-12 iSERI) —
 * 그래서 이 화면은 **정돈된 목록과 [인쇄]만** 두고, 메일용 복사 같은 기능은 두지 않는다.
 * [전달 완료]는 **화면에 떠 있던 건만** 확정.
 */

import { useCallback, useEffect, useState } from 'react'
import MemberGate from '@/components/auth/MemberGate'
import EmptyState from '@/components/ui/EmptyState'
import { useAuth } from '@/components/auth/AuthProvider'
import {
  loadDeliveryList,
  deliverReservations,
  undoDelivery,
  type DeliveryList,
} from '@/lib/firebase/reservationsStaff'
import { actionErrorMessage, firestoreErrorMessage } from '@/lib/firebase/errors'
import { VENUES, venueLabel, seatLabel, hourLabel } from '@/lib/config/venues'
import { shortDate } from '@/lib/reservations/window'
import type { Reservation, ReservationDelivery } from '@/lib/types'

export default function DeliveryPage() {
  return (
    <MemberGate requireStaff>
      <Content />
    </MemberGate>
  )
}

function groupByVenue(list: Reservation[]) {
  return VENUES.map((v) => ({ venue: v, items: list.filter((r) => r.venue === v.code) })).filter(
    (g) => g.items.length > 0
  )
}

function deliveredLabel(r: Reservation): string {
  const d = r.deliveredAt?.toDate?.()
  return d ? `${d.getMonth() + 1}/${d.getDate()} 전달분` : ''
}

function Content() {
  const { user } = useAuth()
  const [data, setData] = useState<DeliveryList | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState('')

  const load = useCallback(async () => {
    try {
      setData(await loadDeliveryList())
      setError('')
    } catch (e) {
      console.error('[iLINE] 전달 명단 조회 실패:', e)
      setError(firestoreErrorMessage(e))
      setData({ fresh: [], cancelled: [], last: null })
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const deliver = async () => {
    if (!data || !user) return
    setBusy(true)
    setActionError('')
    setNotice('')
    try {
      const r = await deliverReservations(
        data.fresh.map((x) => x.id),
        data.cancelled.map((x) => x.id),
        user.uid
      )
      setNotice(
        `전달 완료로 기록했습니다 — 확정 ${r.confirmed}건 · 취소 알림 ${r.cancelNoticed}건` +
          (r.skipped > 0
            ? ` · 그 사이 상태가 바뀌어 건너뛴 ${r.skipped}건 (새로고침하면 사라집니다)`
            : '')
      )
      await load()
    } catch (e) {
      console.error('[iLINE] 전달 완료 실패:', e)
      setActionError(actionErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const undo = async (d: ReservationDelivery) => {
    setBusy(true)
    setActionError('')
    setNotice('')
    try {
      await undoDelivery(d)
      setNotice('마지막 전달을 되돌렸습니다. 그 건들이 다시 명단에 나타납니다.')
      await load()
    } catch (e) {
      console.error('[iLINE] 되돌리기 실패:', e)
      setActionError(actionErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const total = data ? data.fresh.length + data.cancelled.length : 0
  const last = data?.last && !data.last.undoneAt ? data.last : null
  const lastAt = last?.deliveredAt?.toDate?.()

  return (
    <div className="container-page py-8">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* 지난 전달 · 되돌리기 */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4 text-sm">
          <p className="text-ink-muted">
            {lastAt ? (
              <>
                지난 전달: <strong className="text-ink">{lastAt.toLocaleString('ko-KR')}</strong> ·
                새 요청 {last!.newIds.length} · 취소 {last!.cancelIds.length}
              </>
            ) : (
              '아직 전달한 적이 없습니다.'
            )}
          </p>
          {last && (
            <button
              type="button"
              disabled={busy}
              onClick={() => undo(last)}
              className="touch-target rounded-xl border border-line px-4 text-sm font-semibold hover:bg-subtle disabled:opacity-50"
            >
              마지막 전달 되돌리기
            </button>
          )}
        </div>

        {notice && (
          <p role="status" className="rounded-xl border border-status-approved/40 bg-status-approved/10 p-4 text-sm">
            {notice}
          </p>
        )}
        {actionError && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-200">
            {actionError}
          </p>
        )}

        {data === null ? (
          <p className="text-sm text-ink-muted">불러오는 중…</p>
        ) : error ? (
          <EmptyState title="명단을 불러오지 못했습니다" desc={error} />
        ) : total === 0 ? (
          <EmptyState
            title="지난 전달 이후 새 요청·취소가 없습니다"
            desc="보낼 것이 없습니다."
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold tracking-tight">
                이번 전달 — 새 요청 {data.fresh.length} · 취소 {data.cancelled.length}
              </h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="touch-target rounded-xl border border-line-strong px-4 text-sm font-semibold hover:bg-subtle print:hidden"
                >
                  인쇄
                </button>
              </div>
            </div>

            {data.fresh.length > 0 && (
              <Section title={`■ 새 사용 요청 (${data.fresh.length}건)`}>
                {groupByVenue(data.fresh).map((g) => (
                  <VenueBlock key={g.venue.code} name={venueLabel(g.venue.code)} items={g.items} />
                ))}
              </Section>
            )}

            {data.cancelled.length > 0 && (
              <Section title={`■ 취소 (${data.cancelled.length}건) — 지난번에 보낸 것 중 취소됨`}>
                {groupByVenue(data.cancelled).map((g) => (
                  <VenueBlock key={g.venue.code} name={venueLabel(g.venue.code)} items={g.items} showDelivered />
                ))}
              </Section>
            )}

            <div className="rounded-2xl border border-brand-200 bg-brand-50 p-5 text-sm dark:border-brand-800 dark:bg-brand-900/30 print:hidden">
              <p className="leading-relaxed text-ink-muted">
                행정실에 보낸 <strong className="text-ink">뒤에</strong> 누르세요. 위 {total}건이
                처리된 것으로 기록되고, 새 요청은 회원 화면에 <strong className="text-ink">확정됨</strong>으로
                바뀝니다. 누르는 사이에 들어온 예약은 다음 명단으로 넘어갑니다.
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={deliver}
                className="touch-target mt-3 inline-flex items-center justify-center rounded-xl bg-brand-600 px-6 font-bold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {busy ? '처리 중…' : `행정실 전달 완료 — ${total}건`}
              </button>
            </div>

          </>
        )}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h3 className="font-bold">{title}</h3>
      <div className="mt-3 space-y-4">{children}</div>
    </section>
  )
}

function VenueBlock({
  name,
  items,
  showDelivered = false,
}: {
  name: string
  items: Reservation[]
  showDelivered?: boolean
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-ink-muted">{name}</p>
      <ul className="mt-1.5 divide-y divide-line text-sm">
        {items.map((r) => (
          <li key={r.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-1.5">
            <span className="font-semibold">
              {shortDate(r.date)} {hourLabel(r.startHour)}~{hourLabel(r.startHour + r.hours)}
            </span>
            <span>{seatLabel(r.venue, r.seat)}</span>
            <span>
              {r.source === 'staff' ? `${r.displayName ?? r.applicant.name} (담당자 추가)` : r.applicant.name}
            </span>
            <span className="text-ink-muted">
              {[r.applicant.affiliation, r.applicant.major].filter(Boolean).join(' ')}
            </span>
            <span className="text-ink-muted">{r.applicant.phone}</span>
            {showDelivered && deliveredLabel(r) && (
              <span className="text-xs text-ink-subtle">({deliveredLabel(r)})</span>
            )}
            <span className="ml-auto font-mono text-xs text-ink-subtle">{r.code}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

