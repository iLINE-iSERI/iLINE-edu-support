'use client'

/**
 * 담당자 — 1:1 문의 관리 (D-93 · 09-18).
 *
 * 문의 목록(최신순) · 상태 필터 · 답 달기 · 종료. 한 문의에 답 하나(고쳐 쓰기는 됨).
 * 답을 달면 회원 화면에 「답변 완료」 + 「새 답변」 표시가 뜨고, 시트 「문의」 탭의 같은
 * 줄이 갱신된다. 메일은 안 보낸다 — 급한 건 회원이 적은 이메일·전화로 직접.
 * `?id=` 로 오면(시트 링크) 그 문의를 펼쳐 둔다.
 */

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import MemberGate from '@/components/auth/MemberGate'
import { useAuth } from '@/components/auth/AuthProvider'
import {
  listAllInquiries,
  answerInquiry,
  setInquiryStatus,
  requestInquirySync,
} from '@/lib/firebase/inquiries'
import { formatDateTime } from '@/lib/firebase/programs'
import { firestoreErrorMessage } from '@/lib/firebase/errors'
import { INQUIRY_STATUS_LABEL, type Inquiry, type InquiryStatus } from '@/lib/types'

import { INQUIRY_TONE } from '@/lib/ui/statusTone'

export default function StaffInquiriesPage() {
  return (
    <MemberGate requireStaff>
      <Suspense fallback={null}>
        <Inner />
      </Suspense>
    </MemberGate>
  )
}

function Inner() {
  const { member } = useAuth()
  const params = useSearchParams()
  const focusId = params.get('id') || ''

  const [rows, setRows] = useState<Inquiry[] | null>(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'' | InquiryStatus>('open')

  const load = useCallback(async () => {
    try {
      setRows(await listAllInquiries())
      setError('')
    } catch (e) {
      setError(firestoreErrorMessage(e))
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  // 시트 링크로 온 문의는 필터와 무관하게 보인다
  const shown = (rows ?? []).filter((i) => !filter || i.status === filter || i.id === focusId)
  const count = (s: InquiryStatus) => (rows ?? []).filter((i) => i.status === s).length

  return (
    <>
      <PageHeader
        title="문의 관리"
        description="회원이 남긴 1:1 문의입니다. 답을 달면 회원 화면과 시트에 바로 반영됩니다. 사유·메모가 아니라 회원에게 그대로 보이는 글입니다."
      />
      <div className="container-page space-y-6 py-8">
        <div className="flex flex-wrap gap-2">
          <Link href="/staff" className="touch-target inline-flex items-center justify-center rounded-lg border border-line-strong px-5 text-sm font-semibold">
            ← 신청 관리
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm">
            <span className="sr-only">상태</span>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as '' | InquiryStatus)}
              className="rounded-lg border border-line-strong bg-surface px-3 py-2"
            >
              <option value="open">답변 대기 ({count('open')})</option>
              <option value="answered">답변 완료 ({count('answered')})</option>
              <option value="closed">종료 ({count('closed')})</option>
              <option value="">전체 ({rows?.length ?? 0})</option>
            </select>
          </label>
        </div>

        {error && <EmptyState title="문의를 불러오지 못했습니다" description={error} />}

        {rows && !error && shown.length === 0 && (
          <EmptyState
            icon="inbox"
            title={filter === 'open' ? '답변을 기다리는 문의가 없습니다' : '해당하는 문의가 없습니다'}
            description="회원이 알림마당 → 1:1 문의에서 글을 남기면 여기에 쌓입니다."
          />
        )}

        {shown.length > 0 && (
          <div className="space-y-4">
            {shown.map((i) => (
              <InquiryRow
                key={i.id}
                inquiry={i}
                staffUid={member?.uid ?? ''}
                defaultOpen={i.id === focusId || i.status === 'open'}
                onChanged={load}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}

function InquiryRow({
  inquiry: i,
  staffUid,
  defaultOpen,
  onChanged,
}: {
  inquiry: Inquiry
  staffUid: string
  defaultOpen: boolean
  onChanged: () => Promise<void>
}) {
  const [open, setOpen] = useState(defaultOpen)
  const [answer, setAnswer] = useState(i.answer ?? '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const send = async () => {
    if (!answer.trim()) {
      setMsg('답변 내용을 적어 주세요.')
      return
    }
    setBusy(true)
    setMsg('')
    try {
      await answerInquiry(i.id, staffUid, answer)
      await requestInquirySync(i.id)
      await onChanged()
      setMsg('답변을 보냈습니다. 회원 화면에 바로 보입니다.')
    } catch (e) {
      setMsg(firestoreErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const close = async () => {
    if (!confirm('이 문의를 종료합니다. 회원 화면에는 「종료」로 보입니다.')) return
    setBusy(true)
    try {
      await setInquiryStatus(i.id, 'closed')
      await requestInquirySync(i.id)
      await onChanged()
    } catch (e) {
      setMsg(firestoreErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const reopen = async () => {
    setBusy(true)
    try {
      await setInquiryStatus(i.id, i.answer ? 'answered' : 'open')
      await requestInquirySync(i.id)
      await onChanged()
    } catch (e) {
      setMsg(firestoreErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-3 p-5 text-left"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={INQUIRY_TONE[i.status]}>{INQUIRY_STATUS_LABEL[i.status]}</Badge>
            <span className="text-sm font-semibold">{i.authorName}</span>
            <span className="text-xs text-ink-subtle">{i.authorEmail}</span>
            <span className="text-xs text-ink-subtle">· {formatDateTime(i.createdAt)}</span>
          </div>
          <p className="mt-2 break-keep font-bold">{i.title}</p>
        </div>
        <span aria-hidden="true" className="mt-1 shrink-0 text-ink-subtle">
          {open ? '−' : '+'}
        </span>
      </button>

      {open && (
        <div className="border-t border-line px-5 pb-5 pt-4 text-sm leading-relaxed">
          <p className="whitespace-pre-line break-keep">{i.body}</p>

          {i.sheetSyncError && (
            <p className="mt-3 text-xs text-status-revision">
              시트 반영 실패: {i.sheetSyncError} — 답을 달거나 종료하면 다시 시도합니다.
            </p>
          )}

          <div className="mt-4 border-t border-line pt-4">
            <label htmlFor={`ans-${i.id}`} className="block text-sm font-bold">
              답변 — 회원에게 그대로 보입니다
              {i.answeredAt && (
                <span className="ml-2 font-normal text-ink-subtle">
                  (마지막 답변 {formatDateTime(i.answeredAt)} · 고쳐 쓰면 덮어씁니다)
                </span>
              )}
            </label>
            <textarea
              id={`ans-${i.id}`}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={5}
              disabled={busy || i.status === 'closed'}
              placeholder="어디서 무엇을 하면 되는지 적어 주세요. 개인정보(다른 사람 이름·연락처)는 넣지 마세요."
              className="mt-1.5 w-full rounded-xl border border-line-strong bg-surface p-3 text-base outline-none focus:border-brand-600 disabled:opacity-60"
            />
            {msg && <p className="mt-2 text-sm font-semibold text-ink-muted">{msg}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {i.status !== 'closed' ? (
                <>
                  <Button onClick={send} disabled={busy || !answer.trim()}>
                    {i.answer ? '답변 고쳐서 보내기' : '답변 보내기'}
                  </Button>
                  <Button variant="secondary" onClick={close} disabled={busy}>
                    종료
                  </Button>
                </>
              ) : (
                <Button variant="secondary" onClick={reopen} disabled={busy}>
                  다시 열기
                </Button>
              )}
              <a
                href={`mailto:${i.authorEmail}?subject=${encodeURIComponent('[교원양성지원사업] 문의 답변: ' + i.title)}`}
                className="touch-target inline-flex items-center rounded-lg px-3 text-sm font-semibold text-ink-muted underline underline-offset-2"
              >
                메일로 답하기
              </a>
            </div>
          </div>
        </div>
      )}
    </article>
  )
}
