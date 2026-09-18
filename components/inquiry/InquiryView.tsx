'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/components/auth/AuthProvider'
import EmptyState from '@/components/ui/EmptyState'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { SITE } from '@/lib/config/site'
import {
  createInquiry,
  listMyInquiries,
  markAnswerSeen,
  hasUnseenAnswer,
  requestInquirySync,
  inquiryRejectReason,
  INQUIRY_TITLE_MAX,
  INQUIRY_BODY_MAX,
} from '@/lib/firebase/inquiries'
import { firestoreErrorMessage } from '@/lib/firebase/errors'
import { INQUIRY_STATUS_LABEL, type Inquiry } from '@/lib/types'
import { formatDateTime } from '@/lib/firebase/programs'

/**
 * 회원 쪽 1:1 문의 (D-93 · 09-18).
 *   로그인 전   안내 카드 — "왜 로그인이 필요한지" + 비회원 문의처
 *   로그인 뒤   [새 문의] 폼 + 내 문의 목록(최신순). 답이 달린 것은 「답변 완료」 배지,
 *               아직 안 본 답변은 「새 답변」 표시 → 펼치면 봤음으로 기록
 * 한 문의에 답 하나. 고치기·지우기 없음 — 더 물을 게 있으면 새 문의.
 */
const TONE: Record<Inquiry['status'], 'upcoming' | 'open' | 'neutral'> = {
  open: 'upcoming',
  answered: 'open',
  closed: 'neutral',
}

export default function InquiryView() {
  const { status, member } = useAuth()
  const [list, setList] = useState<Inquiry[] | null>(null)
  const [error, setError] = useState('')
  const [writing, setWriting] = useState(false)

  const load = useCallback(async () => {
    if (!member) return
    try {
      setList(await listMyInquiries(member.uid))
      setError('')
    } catch (e) {
      setError(firestoreErrorMessage(e))
    }
  }, [member])

  useEffect(() => {
    if (status === 'member') void load()
  }, [status, load])

  if (status === 'loading') {
    return <p className="text-sm text-ink-muted">확인 중입니다…</p>
  }

  if (status !== 'member' || !member) {
    return (
      <EmptyState
        variant="gate"
        title="로그인하면 문의를 남기고 답변을 받아볼 수 있습니다"
        description={`문의 내용은 본인과 담당자만 봅니다. 회원이 아니시면 ${SITE.contact.email} 또는 ${SITE.contact.phone} 로 연락해 주세요.`}
        primaryAction={{ label: '로그인', href: '/login?next=/notice/inquiry' }}
        secondaryAction={{ label: 'FAQ · 문의처 보기', href: '/notice/faq' }}
      />
    )
  }

  return (
    <div className="space-y-8">
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="section-title">내 문의</h2>
          {!writing && (
            <Button onClick={() => setWriting(true)}>새 문의 쓰기</Button>
          )}
        </div>

        {writing && (
          <InquiryForm
            me={member}
            onDone={async () => {
              setWriting(false)
              await load()
            }}
            onCancel={() => setWriting(false)}
          />
        )}

        {error && (
          <div className="mt-4">
            <EmptyState title="문의를 불러오지 못했습니다" description={error} />
          </div>
        )}

        {list && list.length === 0 && !writing && !error && (
          <div className="mt-4">
            <EmptyState
              icon="inbox"
              title="아직 남긴 문의가 없습니다"
              description="궁금한 것을 남기면 담당자가 확인하고 이 자리에 답을 답니다. 답변이 달리면 마이페이지에도 표시됩니다."
              primaryAction={{ label: '새 문의 쓰기', onClick: () => setWriting(true) }}
            />
          </div>
        )}

        {list && list.length > 0 && (
          <ul className="mt-4 space-y-3">
            {list.map((i) => (
              <InquiryCard key={i.id} inquiry={i} onSeen={load} />
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs leading-relaxed text-ink-subtle">
        답변은 보통 {SITE.contact.hours}에 달립니다. 급한 일은 {SITE.contact.phone} 로 전화해 주세요.
        한 문의에는 답이 한 번 달립니다 — 더 궁금한 것은 새 문의로 남겨 주세요.
      </p>
    </div>
  )
}

function InquiryForm({
  me,
  onDone,
  onCancel,
}: {
  me: { uid: string; name: string; email: string }
  onDone: () => Promise<void>
  onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const reason = inquiryRejectReason(title, body)
    if (reason) {
      setMsg(reason)
      return
    }
    setBusy(true)
    setMsg('')
    try {
      const id = await createInquiry(me, title, body)
      await requestInquirySync(id)
      await onDone()
    } catch (err) {
      setMsg(firestoreErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const inputCls =
    'mt-2 block w-full rounded-xl border border-line-strong bg-surface px-3.5 py-3 text-ink placeholder:text-ink-subtle'

  return (
    <form onSubmit={submit} className="card mt-4 space-y-4 p-5 sm:p-6" noValidate>
      <div>
        <label htmlFor="inq-title" className="block text-sm font-semibold">
          제목
        </label>
        <input
          id="inq-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={INQUIRY_TITLE_MAX}
          placeholder="예: 신청서 첨부 파일을 바꾸고 싶습니다"
          className={inputCls}
        />
      </div>
      <div>
        <label htmlFor="inq-body" className="block text-sm font-semibold">
          문의 내용
        </label>
        <p className="mt-1 text-xs text-ink-subtle">
          어떤 화면에서 무엇을 하려다 막혔는지 적어 주시면 빨리 답할 수 있습니다. 비밀번호나 계좌번호는 적지 마세요.
        </p>
        <textarea
          id="inq-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={INQUIRY_BODY_MAX}
          rows={6}
          className={inputCls}
        />
        <p className="mt-1 text-right text-xs text-ink-subtle">
          {body.length} / {INQUIRY_BODY_MAX}
        </p>
      </div>
      {msg && <p className="text-sm font-semibold text-status-revision">{msg}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy} className="max-sm:w-full">
          {busy ? '보내는 중…' : '문의 보내기'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={busy} className="max-sm:w-full">
          취소
        </Button>
      </div>
    </form>
  )
}

function InquiryCard({ inquiry: i, onSeen }: { inquiry: Inquiry; onSeen: () => Promise<void> }) {
  const unseen = hasUnseenAnswer(i)
  const [open, setOpen] = useState(unseen)

  const toggle = async () => {
    const next = !open
    setOpen(next)
    if (next && unseen) {
      await markAnswerSeen(i.id).catch(() => {})
      await onSeen()
    }
  }

  // 처음부터 펼쳐진 「새 답변」은 화면에 보인 순간 봤음으로
  useEffect(() => {
    if (open && unseen) {
      markAnswerSeen(i.id).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <li className="card">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-3 p-5 text-left"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={TONE[i.status]}>{INQUIRY_STATUS_LABEL[i.status]}</Badge>
            {unseen && (
              <span className="text-[13px] font-bold text-warn-ink">새 답변</span>
            )}
            <span className="text-xs text-ink-subtle">{formatDateTime(i.createdAt)}</span>
          </div>
          <p className="mt-2 break-keep font-bold">{i.title}</p>
        </div>
        <span aria-hidden="true" className="mt-1 shrink-0 text-ink-subtle">
          {open ? '−' : '+'}
        </span>
      </button>
      {open && (
        <div className="border-t border-line px-5 pb-5 pt-4 text-sm leading-relaxed">
          <p className="whitespace-pre-line break-keep text-ink-muted">{i.body}</p>
          {i.answer ? (
            <div className="mt-4 rounded-xl border-l-4 border-theme bg-theme-tint p-4">
              <p className="text-xs font-bold text-theme-strong">
                담당자 답변 · {formatDateTime(i.answeredAt)}
              </p>
              <p className="mt-2 whitespace-pre-line break-keep">{i.answer}</p>
            </div>
          ) : i.status === 'closed' ? (
            <p className="mt-4 text-xs text-ink-subtle">담당자가 종료한 문의입니다.</p>
          ) : (
            <p className="mt-4 text-xs text-ink-subtle">담당자가 확인하면 여기에 답이 달립니다.</p>
          )}
        </div>
      )}
    </li>
  )
}
