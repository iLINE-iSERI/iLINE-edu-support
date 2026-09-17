'use client'

/**
 * 산출물 한 건 (D-76) — 세 화면이 같은 카드를 쓴다.
 *
 *   참여자 본인 화면   who = 'mine' | 'team'   [다시 제출하기] · 추가 요청 글 보임
 *   참여자 자료실     who = 'shared'          이름 없이 팀명(또는 소속)만
 *   담당자 화면       who = 'staff'           이름·팀명 다 보이고 버튼은 밖에서 붙인다
 *
 * 한 군데서 만들어 쓰는 이유는 정산 카드와 같다 — 화면마다 따로 그리면
 * 한쪽만 고쳤을 때 참여자가 본 것과 담당자가 본 것이 달라진다.
 */

import { useState, type ReactNode } from 'react'
import Badge from '@/components/ui/Badge'
import { FileLink } from './OutputForm'
import { outputOwnerLabel } from '@/lib/firebase/outputs'
import { OUTPUT_STATUS_LABEL, type Output } from '@/lib/types'

function shortDate(o: Output): string {
  const d = (o.lastEditedAt ?? o.submittedAt)?.toDate()
  if (!d) return ''
  return `${d.getMonth() + 1}. ${d.getDate()}.`
}

export default function OutputCard({
  output: o,
  who,
  actions,
  compact,
}: {
  output: Output
  who: 'mine' | 'team' | 'shared' | 'staff'
  /** 오른쪽 아래 버튼 자리 — 화면마다 다르다 */
  actions?: ReactNode
  /** 목록이 길 때 본문을 접는다 */
  compact?: boolean
}) {
  const [open, setOpen] = useState(!compact)
  const edited = (o.editCount ?? 0) > 0
  const showNote = o.status === 'revision' && o.reviewNote && who !== 'shared'

  return (
    <article
      className={
        'rounded-2xl border-2 bg-surface p-4 sm:p-5 ' +
        (o.hiddenByStaff ? 'border-dashed border-line opacity-70' : 'border-line-strong')
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {who === 'shared' && <Badge tone="info">{outputOwnerLabel(o)}</Badge>}
            {who === 'team' && <Badge tone="neutral">{o.authorName}님이 올림</Badge>}
            {who === 'staff' && (
              <Badge tone={o.teamName ? 'group' : 'individual'}>
                {o.teamName ? `${o.teamName} 팀 · ${o.authorName}` : o.authorName}
              </Badge>
            )}
            {o.status === 'revision' && who !== 'shared' && (
              <Badge tone="warn">{OUTPUT_STATUS_LABEL.revision}</Badge>
            )}
            {o.hiddenByStaff && <Badge tone="closed">내려짐</Badge>}
          </div>
          <h3 className="mt-2 break-keep text-lg font-bold leading-snug">{o.title}</h3>
          <p className="mt-1 text-sm text-ink-muted">
            {shortDate(o)} {edited ? `제출 (${o.editCount}회 수정)` : '제출'}
            {o.files?.length ? ` · 파일 ${o.files.length}개` : ''}
          </p>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2 max-sm:basis-full">{actions}</div>}
      </div>

      {showNote && (
        <div className="mt-3 rounded-xl border border-status-revision/40 bg-status-revision/10 p-3 text-sm leading-relaxed">
          <p className="font-bold text-status-revision">담당자 요청</p>
          <p className="mt-1 whitespace-pre-line text-ink">{o.reviewNote}</p>
        </div>
      )}

      {o.text && (
        <div className="mt-3">
          <p
            className={
              'whitespace-pre-line break-keep text-[15px] leading-relaxed text-ink ' +
              (open ? '' : 'line-clamp-3')
            }
          >
            {o.text}
          </p>
          {compact && o.text.length > 120 && (
            <button
              type="button"
              onClick={() => setOpen(!open)}
              className="mt-1 text-xs font-semibold text-ink-muted underline underline-offset-2"
            >
              {open ? '접기' : '더 보기'}
            </button>
          )}
        </div>
      )}

      {o.files?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {o.files.map((f) => (
            <FileLink key={f.storagePath} path={f.storagePath} label={f.fileName} />
          ))}
        </div>
      )}
    </article>
  )
}
