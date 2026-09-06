'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import EmptyState from '@/components/ui/EmptyState'
import Badge from '@/components/ui/Badge'
import { listNotices } from '@/lib/firebase/notices'
import { formatDate } from '@/lib/firebase/programs'
import { isFirebaseConfigured } from '@/lib/firebase/config'
import { firestoreErrorMessage } from '@/lib/firebase/errors'
import type { Notice } from '@/lib/types'

/**
 * 공지 목록.
 *
 * 로그인 없이 보이는 화면이다 — 공고 안내는 회원이 되기 전에 읽는 것이므로
 * 회원 게이트를 두지 않는다. 보안 규칙도 `allow read: if true` 다.
 */
export default function NoticeList() {
  const [notices, setNotices] = useState<Notice[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setNotices([])
      return
    }
    listNotices()
      .then(setNotices)
      .catch((e) => {
        console.error('[iLINE] 공지 목록 조회 실패:', e)
        setError(firestoreErrorMessage(e))
        setNotices([])
      })
  }, [])

  if (notices === null) {
    return <p className="text-sm text-ink-muted">불러오는 중…</p>
  }

  if (error) {
    return <EmptyState title="공지를 불러오지 못했습니다" desc={error} />
  }

  if (notices.length === 0) {
    return (
      <EmptyState
        title="등록된 공지사항이 없습니다"
        desc="사업 공고와 일정 변경 등 안내가 이곳에 게시됩니다."
      />
    )
  }

  return (
    <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
      {notices.map((n) => (
        <li key={n.id}>
          <Link
            href={`/notice/${n.id}`}
            className="flex items-start gap-3 px-5 py-4 hover:bg-subtle"
          >
            {/* 고정 공지는 목록 어디에 있든 눈에 띄어야 한다 */}
            {n.pinned && <Badge tone="individual">공지</Badge>}
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{n.title}</p>
              <p className="mt-1 text-xs text-ink-subtle">
                {formatDate(n.createdAt)}
              </p>
            </div>
            <span aria-hidden="true" className="text-ink-subtle">
              →
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
