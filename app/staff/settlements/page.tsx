'use client'

/**
 * 담당자 정산 관리 (Phase 6 · D-39)
 *
 * ⚠️ 이 화면에는 **계좌 정보가 나온다.** 시트·드라이브로는 절대 내보내지
 *    않기로 했으므로(D-38), 담당자가 지급하려면 볼 곳이 여기뿐이다.
 *    그래서 화면에 기본으로 펼쳐두지 않고 **누를 때만** 보여준다 —
 *    목록을 띄워둔 채 자리를 비우거나 화면을 공유할 때를 대비한 것이다.
 *
 * 금액 칸은 없다(09-06 확정). 담당자가 영수증을 열어 읽고 합산한다.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import MemberGate from '@/components/auth/MemberGate'
import { useAuth } from '@/components/auth/AuthProvider'
import {
  listAllSettlements,
  reviewSettlement,
} from '@/lib/firebase/settlements'
import { fileUrl } from '@/lib/firebase/applications'
import { firestoreErrorMessage } from '@/lib/firebase/errors'
import {
  SETTLEMENT_STATUS_LABEL,
  type Settlement,
  type SettlementStatus,
} from '@/lib/types'

const FILTERS: SettlementStatus[] = [
  'submitted',
  'approved',
  'rejected',
  'draft',
]

export default function StaffSettlementsPage() {
  return (
    <MemberGate requireStaff>
      <StaffSettlementsContent />
    </MemberGate>
  )
}

function StaffSettlementsContent() {
  const { user } = useAuth()
  const [rows, setRows] = useState<Settlement[] | null>(null)
  const [filter, setFilter] = useState<SettlementStatus | ''>('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      setRows(await listAllSettlements())
    } catch (e) {
      console.error('[iLINE] 정산 목록 조회 실패:', e)
      setError(firestoreErrorMessage(e))
      setRows([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const shown = (rows ?? []).filter((s) => !filter || s.status === filter)
  const count = (s: SettlementStatus) =>
    (rows ?? []).filter((r) => r.status === s).length

  return (
    <>
      <PageHeader
        title="정산 관리"
        description="제출된 지급 계좌와 영수증을 확인하고 승인합니다."
      />

      <div className="container-page space-y-6 py-8">
        <div className="flex flex-wrap gap-4 text-sm">
          <Link
            href="/staff"
            className="font-semibold text-ink-muted underline underline-offset-2"
          >
            ← 신청 관리
          </Link>
          <Link
            href="/staff/programs"
            className="font-semibold text-ink-muted underline underline-offset-2"
          >
            프로그램 관리
          </Link>
          <Link
            href="/staff/notices"
            className="font-semibold text-ink-muted underline underline-offset-2"
          >
            공지 관리
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as SettlementStatus | '')}
            aria-label="상태"
            className="touch-target rounded-xl border border-line-strong bg-surface px-3 text-sm"
          >
            <option value="">전체 상태</option>
            {FILTERS.map((s) => (
              <option key={s} value={s}>
                {SETTLEMENT_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={load}
            className="touch-target rounded-xl border border-line-strong px-4 text-sm font-semibold hover:bg-subtle"
          >
            새로고침
          </button>
          {rows && (
            <span className="text-sm text-ink-subtle">
              제출 {count('submitted')} · 승인 {count('approved')} · 반려{' '}
              {count('rejected')}
            </span>
          )}
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg bg-status-revision/10 px-3 py-2 text-sm text-status-revision"
          >
            {error}
          </p>
        )}

        {rows === null ? (
          <p className="text-sm text-ink-muted">불러오는 중…</p>
        ) : shown.length === 0 ? (
          <EmptyState
            title="정산 내역이 없습니다"
            desc="선정된 참여자가 정산을 제출하면 이곳에 표시됩니다."
          />
        ) : (
          <ul className="space-y-3">
            {shown.map((s) => (
              <SettlementRow
                key={s.id}
                row={s}
                reviewerUid={user?.uid ?? ''}
                onSaved={load}
              />
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

function SettlementRow({
  row,
  reviewerUid,
  onSaved,
}: {
  row: Settlement
  reviewerUid: string
  onSaved: () => void
}) {
  const [note, setNote] = useState(row.reviewNote || '')
  const [showBank, setShowBank] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function review(status: 'approved' | 'rejected') {
    if (status === 'rejected' && !note.trim()) {
      setMsg('반려 사유를 적어 주세요. 신청자에게 그대로 보입니다.')
      return
    }
    setBusy(true)
    setMsg('')
    try {
      await reviewSettlement(row.id, status, note, reviewerUid)
      setMsg(status === 'approved' ? '승인했습니다.' : '반려했습니다.')
      onSaved()
    } catch (e) {
      console.error('[iLINE] 정산 처리 실패:', e)
      setMsg(firestoreErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-subtle px-2.5 py-1 text-xs font-bold">
          {SETTLEMENT_STATUS_LABEL[row.status]}
        </span>
        <span className="text-xs text-ink-subtle">
          {row.submittedAt?.toDate().toLocaleString('ko-KR')} 제출
        </span>
      </div>

      <p className="mt-2 font-bold">
        {row.applicantName || '이름없음'} · {row.programTitle || row.programId}
      </p>

      {/* ── 지급 계좌 — 누를 때만 보여준다 ─────────────────── */}
      <div className="mt-3 rounded-lg bg-subtle p-3 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold">지급 계좌</p>
          <button
            type="button"
            onClick={() => setShowBank((v) => !v)}
            className="text-xs font-semibold text-ink-muted underline underline-offset-2"
          >
            {showBank ? '가리기' : '보기'}
          </button>
        </div>
        {showBank ? (
          <p className="mt-1.5 font-mono">
            {row.bankInfo?.bankName} {row.bankInfo?.accountNumber} (
            {row.bankInfo?.accountHolder})
          </p>
        ) : (
          <p className="mt-1.5 text-ink-subtle">
            지급할 때만 열어 보세요. 시트·드라이브에는 나가지 않습니다.
          </p>
        )}
      </div>

      {/* ── 영수증 ─────────────────────────────────────────── */}
      <div className="mt-3">
        <p className="text-xs font-semibold text-ink-subtle">
          {row.receipts?.length
            ? `영수증 ${row.receipts.length}장 — 금액은 파일을 열어 확인해 주세요`
            : // 영수증을 안 받는 프로그램일 수 있다(D-41). 누락과 구분되도록
              // "없음"이라고만 하지 않고 프로그램 설정을 확인하라고 알린다.
              '영수증 없음 — 이 프로그램이 영수증을 요구하지 않도록 설정되어 있을 수 있습니다'}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {row.receipts?.map((r) => (
            <FileButton
              key={r.storagePath}
              path={r.storagePath}
              label={r.fileName}
            />
          ))}
        </div>
      </div>

      {/* ── 처리 ───────────────────────────────────────────── */}
      <div className="mt-4 border-t border-line pt-4">
        <label
          htmlFor={`snote-${row.id}`}
          className="block text-sm font-semibold"
        >
          안내 문구 · 반려 사유
        </label>
        <p className="text-xs text-ink-subtle">
          여기 쓰신 내용이 <strong>신청자에게 그대로 보입니다.</strong> 반려라면
          무엇을 고쳐야 하는지 적어 주세요.
        </p>
        <textarea
          id={`snote-${row.id}`}
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-2 w-full rounded-xl border border-line-strong bg-surface p-3 text-base leading-relaxed outline-none focus:border-brand-600"
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => review('approved')}
            disabled={busy}
            className="touch-target rounded-xl bg-brand-600 px-5 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            승인
          </button>
          <button
            type="button"
            onClick={() => review('rejected')}
            disabled={busy}
            className="touch-target rounded-xl border border-status-revision px-5 text-sm font-bold text-status-revision hover:bg-status-revision/10 disabled:opacity-50"
          >
            반려
          </button>
          {msg && <span className="text-sm text-ink-muted">{msg}</span>}
        </div>
      </div>
    </li>
  )
}

function FileButton({ path, label }: { path: string; label: string }) {
  const [busy, setBusy] = useState(false)
  return (
    <button
      type="button"
      disabled={busy}
      title={label}
      onClick={async () => {
        setBusy(true)
        try {
          window.open(await fileUrl(path), '_blank', 'noopener')
        } catch (e) {
          console.error('[iLINE] 파일 열기 실패:', e)
          alert('파일을 여는 데 실패했습니다. 담당자 권한(Custom Claims)을 확인해 주세요.')
        } finally {
          setBusy(false)
        }
      }}
      className="inline-flex max-w-full items-center rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink-muted hover:bg-subtle disabled:opacity-50"
    >
      <span className="truncate">{busy ? '여는 중…' : label}</span>
    </button>
  )
}
