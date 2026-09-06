'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import EmptyState from '@/components/ui/EmptyState'
import Badge from '@/components/ui/Badge'
import { getNotice } from '@/lib/firebase/notices'
import { formatDate } from '@/lib/firebase/programs'
import { isFirebaseConfigured } from '@/lib/firebase/config'
import type { Notice } from '@/lib/types'

export default function NoticeDetail() {
  const params = useParams<{ id: string }>()
  const [notice, setNotice] = useState<Notice | null | 'notfound'>(null)

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setNotice('notfound')
      return
    }
    getNotice(params.id)
      .then((n) => setNotice(n ?? 'notfound'))
      .catch((e) => {
        console.error('[iLINE] 공지 조회 실패:', e)
        setNotice('notfound')
      })
  }, [params.id])

  if (notice === null) {
    return <p className="text-sm text-ink-muted">불러오는 중…</p>
  }

  if (notice === 'notfound') {
    return (
      <EmptyState
        title="공지를 찾을 수 없습니다"
        desc="삭제되었거나 주소가 잘못되었을 수 있습니다."
        action={
          <Link
            href="/notice"
            className="touch-target inline-flex items-center justify-center rounded-xl border border-line-strong px-5 font-semibold"
          >
            공지사항 목록으로
          </Link>
        }
      />
    )
  }

  return (
    <article className="space-y-6">
      <header className="border-b border-line pb-5">
        {notice.pinned && <Badge tone="individual">공지</Badge>}
        <h2 className="mt-2 text-lg font-extrabold tracking-tight sm:text-xl">
          {notice.title}
        </h2>
        <p className="mt-2 text-xs text-ink-subtle">
          {formatDate(notice.createdAt)}
          {/* 고친 적이 있으면 알려준다. 안내가 바뀐 걸 모르고
              옛 내용대로 준비하는 일을 줄인다. */}
          {notice.updatedAt &&
            notice.createdAt &&
            notice.updatedAt.toMillis() - notice.createdAt.toMillis() > 60_000 && (
              <span> · {formatDate(notice.updatedAt)} 수정됨</span>
            )}
        </p>
      </header>

      {/* 줄바꿈을 그대로 살린다 — 본문은 서식 없는 글이다 */}
      <div className="whitespace-pre-line leading-relaxed text-ink-muted">
        {notice.content}
      </div>

      <div className="pt-2">
        <Link
          href="/notice"
          className="text-sm font-semibold text-ink-muted underline underline-offset-2"
        >
          ← 공지사항 목록
        </Link>
      </div>
    </article>
  )
}
