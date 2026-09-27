'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import EmptyState from '@/components/ui/EmptyState'
import Badge from '@/components/ui/Badge'
import { getNotice, noticeFileUrl, fileSizeLabel } from '@/lib/firebase/notices'
import { formatDate } from '@/lib/firebase/programs'
import { isFirebaseConfigured } from '@/lib/firebase/config'
import type { Notice } from '@/lib/types'

export default function NoticeDetail() {
  const params = useParams<{ id: string }>()
  const [notice, setNotice] = useState<Notice | null | 'notfound'>(null)
  /**
   * 첨부 받을 주소 (D-112) — 경로 → 주소. 없으면 아직 받는 중, null 이면 실패.
   * 누를 때가 아니라 **화면을 열 때** 받아 둔다 — 진짜 링크가 되어야 휴대폰에서 길게 눌러
   * 저장할 수 있고, 누른 뒤 기다렸다 새 창을 여는 방식은 사파리가 막기도 한다
   */
  const [urls, setUrls] = useState<Record<string, string | null>>({})

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

  const files = notice && notice !== 'notfound' ? (notice.files ?? []) : []
  useEffect(() => {
    if (files.length === 0) return
    let alive = true
    void Promise.all(
      files.map((f) =>
        noticeFileUrl(f.storagePath)
          .then((u) => [f.storagePath, u] as const)
          .catch((e) => {
            console.error('[iLINE] 공지 첨부 주소 받기 실패:', f.storagePath, e)
            return [f.storagePath, null] as const
          })
      )
    ).then((pairs) => {
      if (alive) setUrls(Object.fromEntries(pairs))
    })
    return () => {
      alive = false
    }
    // 공지가 바뀔 때만 다시 받는다 — files 는 매번 새 배열이라 의존성에 넣으면 끝없이 돈다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notice])

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

      {files.length > 0 && (
        <section aria-labelledby="notice-files" className="rounded-xl border border-line bg-subtle p-4">
          <h3 id="notice-files" className="text-sm font-bold">
            첨부 파일 {files.length}
          </h3>
          <ul className="mt-2 space-y-1.5">
            {files.map((f) => {
              const url = urls[f.storagePath]
              return (
                <li key={f.storagePath} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all font-semibold text-brand-600 underline underline-offset-2 hover:text-brand-700"
                    >
                      {f.fileName}
                    </a>
                  ) : (
                    <span className="break-all font-semibold text-ink-muted">{f.fileName}</span>
                  )}
                  <span className="text-xs text-ink-subtle">
                    {fileSizeLabel(f.size)}
                    {url === undefined && ' · 준비 중…'}
                    {url === null && ' · 지금 받을 수 없습니다. 잠시 후 새로고침해 주세요'}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      )}

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
