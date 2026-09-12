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
  markSettlementPaid,
  requestSettlementSync,
  retrySettlementSync,
} from '@/lib/firebase/settlements'
import { toYmd } from '@/lib/reservations/window'
import { fileUrl } from '@/lib/firebase/applications'
import { firestoreErrorMessage } from '@/lib/firebase/errors'
import { SHOW_REVIEW_NOTE_TO_APPLICANT } from '@/lib/config/site'
import {
  SETTLEMENT_STATUS_LABEL,
  type Settlement,
  type SettlementStatus,
} from '@/lib/types'

const FILTERS: SettlementStatus[] = [
  'submitted',
  'approved',
  'paid',
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
        description="제출된 지급 계좌와 영수증을 확인해 승인하고, 이체한 뒤 지급 완료로 표시합니다."
      />

      <div className="container-page space-y-6 py-8">
        <div className="flex flex-wrap gap-4 text-sm">
          <Link
            href="/staff"
            className="font-semibold text-ink-muted underline underline-offset-2"
          >
            ← 관리
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
              제출 {count('submitted')} · 승인(지급 대기) {count('approved')} · 지급 완료{' '}
              {count('paid')} · 반려 {count('rejected')}
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
  // 지급 완료 (09-12) — 이체한 날짜를 고른다. 기본은 오늘
  const [paidDate, setPaidDate] = useState(toYmd(new Date()))
  const [paidNote, setPaidNote] = useState('')

  async function markPaid() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(paidDate)) {
      setMsg('지급일을 골라 주세요.')
      return
    }
    setBusy(true)
    setMsg('')
    try {
      const [y, m, d] = paidDate.split('-').map(Number)
      await markSettlementPaid(row.id, new Date(y, m - 1, d), paidNote, reviewerUid)
      setMsg('지급 완료로 표시했습니다.')
      // 시트 「정산」 탭의 상태·지급일 칸을 따라 고친다 (D-65)
      await requestSettlementSync(row.id)
      onSaved()
    } catch (e) {
      console.error('[iLINE] 지급 완료 표시 실패:', e)
      setMsg(firestoreErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function review(status: 'approved' | 'rejected') {
    if (status === 'rejected' && !note.trim()) {
      // 사유는 신청자에게 안 보이지만(D-46) **여전히 필수**로 받는다.
      // 왜 반려했는지가 안 남으면 나중에 담당자 본인도 설명하지 못한다.
      setMsg('반려 사유를 적어 주세요. (담당자 기록용 — 신청자에게는 따로 알려주셔야 합니다)')
      return
    }
    setBusy(true)
    setMsg('')
    try {
      await reviewSettlement(row.id, status, note, reviewerUid)
      setMsg(status === 'approved' ? '승인했습니다.' : '반려했습니다.')
      await requestSettlementSync(row.id)
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
            : // 영수증은 선택이라 없는 것이 정상일 수 있다(D-41).
              // 필요한 회차인데 안 왔다면 사유를 적어 반려하면 된다.
              '영수증 없음 — 증빙이 필요한 프로그램이라면 사유를 적어 반려해 주세요'}
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

      {/* ── 드라이브·시트 반영 상태 (D-65) — "왜 드라이브에 없지?"를 여기서 */}
      {row.driveSyncError ? (
        <div className="mt-3 rounded-lg bg-status-revision/10 px-3 py-2 text-xs leading-relaxed text-status-revision">
          <p>
            <strong>드라이브·시트 반영 실패</strong> — {row.driveSyncError}
          </p>
          <p className="mt-1">
            정산 자체는 정상 접수되었습니다. 설정은 docs/2-학습/04-구글-시트-드라이브-연동.md 참고.
          </p>
          <SyncRetry id={row.id} onDone={onSaved} />
        </div>
      ) : row.sheetSyncedAt ? (
        <p className="mt-3 text-xs text-ink-subtle">
          드라이브·시트 반영 완료
          {row.driveFolderUrl && (
            <>
              {' · '}
              <a
                href={row.driveFolderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
              >
                드라이브 폴더 열기
              </a>
            </>
          )}
        </p>
      ) : row.status !== 'draft' ? (
        <p className="mt-3 text-xs text-ink-subtle">
          드라이브·시트에 아직 반영되지 않았습니다. <SyncRetry id={row.id} onDone={onSaved} inline />
        </p>
      ) : null}

      {/* ── 처리 ───────────────────────────────────────────── */}
      <div className="mt-4 border-t border-line pt-4">
        <label
          htmlFor={`snote-${row.id}`}
          className="block text-sm font-semibold"
        >
          반려 사유 · 처리 메모
        </label>
        <p className="text-xs text-ink-subtle">
          {SHOW_REVIEW_NOTE_TO_APPLICANT ? (
            <>
              여기 쓰신 내용이 <strong>신청자에게 그대로 보입니다.</strong>{' '}
              반려라면 무엇을 고쳐야 하는지 적어 주세요.
            </>
          ) : (
            <>
              <strong>담당자만 보는 기록입니다 (D-46).</strong> 반려하시면
              신청자 화면에는 <strong>&lsquo;반려&rsquo; 상태만</strong> 보이고
              이유는 나오지 않으므로, <strong>무엇을 고쳐야 하는지 메일·전화로
              반드시 따로 알려주세요.</strong> 안 알리면 같은 내용으로 다시
              제출합니다.
            </>
          )}
        </p>
        <textarea
          id={`snote-${row.id}`}
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-2 w-full rounded-xl border border-line-strong bg-surface p-3 text-base leading-relaxed outline-none focus:border-brand-600"
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {row.status !== 'paid' && (
            <>
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
            </>
          )}
          {msg && <span className="text-sm text-ink-muted">{msg}</span>}
        </div>
      </div>

      {/* ── 지급 완료 (09-12) — 승인된 건에만. 이체는 사이트 밖에서 하므로
          "했다"는 사실만 날짜와 함께 남긴다. 되돌리기는 두지 않는다 —
          잘못 눌렀으면 메모로 남기고 담당자끼리 정리한다 ── */}
      {row.status === 'approved' && (
        <div className="mt-3 rounded-lg border border-status-approved/40 bg-status-approved/10 p-3 text-sm">
          <p className="font-semibold">이체를 마쳤으면 지급 완료로 표시하세요</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5">
              <span className="text-ink-muted">지급일</span>
              <input
                type="date"
                value={paidDate}
                onChange={(e) => setPaidDate(e.target.value)}
                className="touch-target rounded-lg border border-line-strong bg-surface px-2 text-sm"
              />
            </label>
            <input
              value={paidNote}
              onChange={(e) => setPaidNote(e.target.value)}
              placeholder="메모 (선택 · 담당자만 봄)"
              className="touch-target min-w-[12rem] flex-1 rounded-lg border border-line-strong bg-surface px-3 text-sm"
            />
            <button
              type="button"
              onClick={markPaid}
              disabled={busy}
              className="touch-target rounded-xl bg-status-approved px-5 text-sm font-bold text-white disabled:opacity-50"
            >
              지급 완료
            </button>
          </div>
        </div>
      )}
      {row.status === 'paid' && (
        <p className="mt-3 rounded-lg bg-subtle p-3 text-sm text-ink-muted">
          <strong className="text-ink">지급 완료</strong> ·{' '}
          {row.paidAt?.toDate().toLocaleDateString('ko-KR')}
          {row.paidNote && <> · 메모: {row.paidNote}</>}
        </p>
      )}
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

/** 드라이브·시트 반영 재시도 (D-65) — 설정을 고친 뒤 이미 들어온 건을 다시 올린다 */
function SyncRetry({ id, onDone, inline = false }: { id: string; onDone: () => void; inline?: boolean }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function run() {
    setBusy(true)
    setErr('')
    try {
      await retrySettlementSync(id)
      onDone()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className={inline ? 'inline' : 'mt-2 block'}>
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className={
          inline
            ? 'font-semibold underline underline-offset-2 disabled:opacity-50'
            : 'touch-target rounded-lg border border-current px-3 text-xs font-semibold disabled:opacity-50'
        }
      >
        {busy ? '반영 중…' : '지금 반영'}
      </button>
      {err && <span className="ml-2 text-status-revision">{err}</span>}
    </span>
  )
}
