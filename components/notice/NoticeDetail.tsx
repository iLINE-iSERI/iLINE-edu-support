'use client'

/**
 * 공지 상세 (알림마당).
 *
 * 공개 범위 (D-113) — 겉장(제목)을 먼저 읽고, 속지(본문·첨부 목록)는 따로 읽는다.
 *  · 전체 공개 → 누구나 본문·첨부
 *  · 회원만   → 제목은 보이고, 회원이 아니면 본문 자리에 「로그인 / 가입 마저 하기」 안내
 *  · 비공개   → 담당자만. 다른 사람에게는 「찾을 수 없습니다」(규칙이 겉장부터 막는다)
 * 로그인 상태가 정해진 뒤에 읽는다 — 확인 중에 읽으면 담당자·회원도 한순간 막혀 보인다.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import EmptyState from '@/components/ui/EmptyState'
import Badge from '@/components/ui/Badge'
import { useAuth } from '@/components/auth/AuthProvider'
import {
  getNotice,
  getNoticeBody,
  noticeFileLinks,
  visibilityOf,
  fileSizeLabel,
  type NoticeFileLink,
} from '@/lib/firebase/notices'
import { formatDate } from '@/lib/firebase/programs'
import { isFirebaseConfigured } from '@/lib/firebase/config'
import type { Notice, NoticeBody } from '@/lib/types'

export default function NoticeDetail() {
  const params = useParams<{ id: string }>()
  const { status } = useAuth()
  const [notice, setNotice] = useState<Notice | null | 'notfound'>(null)
  /** 속지 — null: 읽는 중 · 'locked': 자격 없음(회원만) */
  const [body, setBody] = useState<NoticeBody | null | 'locked'>(null)
  /**
   * 첨부 받을 주소 — null: 받는 중 · 'failed': 실패.
   * 누를 때가 아니라 **화면을 열 때** 받아 둔다 — 진짜 링크가 되어야 휴대폰에서 길게 눌러
   * 저장할 수 있고, 누른 뒤 기다렸다 새 창을 여는 방식은 사파리가 막기도 한다
   */
  const [links, setLinks] = useState<NoticeFileLink[] | null | 'failed'>(null)

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setNotice('notfound')
      return
    }
    if (status === 'loading') return
    let alive = true
    getNotice(params.id)
      .then((n) => alive && setNotice(n ?? 'notfound'))
      .catch((e) => {
        // 비공개 공지를 담당자가 아닌 사람이 열면 여기로 온다 — 「없는 공지」와 똑같이 보인다
        console.error('[iLINE] 공지 조회 실패:', e)
        if (alive) setNotice('notfound')
      })
    return () => {
      alive = false
    }
  }, [params.id, status])

  useEffect(() => {
    if (!notice || notice === 'notfound') return
    let alive = true
    setBody(null)
    getNoticeBody(notice)
      .then((b) => alive && setBody(b))
      .catch((e) => {
        console.error('[iLINE] 공지 본문 조회 실패:', e)
        if (alive) setBody('locked')
      })
    return () => {
      alive = false
    }
  }, [notice])

  const files = body && body !== 'locked' ? (body.files ?? []) : []
  useEffect(() => {
    if (!notice || notice === 'notfound' || files.length === 0) return
    let alive = true
    setLinks(null)
    noticeFileLinks(notice.id)
      .then((l) => alive && setLinks(l === 'locked' ? 'failed' : l))
      .catch((e) => {
        console.error('[iLINE] 공지 첨부 주소 받기 실패:', e)
        if (alive) setLinks('failed')
      })
    return () => {
      alive = false
    }
    // 속지가 바뀔 때만 다시 받는다 — files 는 매번 새 배열이라 의존성에 넣으면 끝없이 돈다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body])

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

  const visibility = visibilityOf(notice)
  const urlOf = (path: string) =>
    Array.isArray(links) ? links.find((l) => l.storagePath === path)?.url : undefined

  return (
    <article className="space-y-6">
      <header className="border-b border-line pb-5">
        <div className="flex flex-wrap gap-1.5">
          {notice.pinned && <Badge tone="individual">공지</Badge>}
          {visibility === 'members' && <Badge tone="neutral">회원 공개</Badge>}
          {visibility === 'private' && <Badge tone="warn">비공개</Badge>}
        </div>
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

      {visibility === 'private' && (
        <p className="rounded-lg bg-subtle px-3 py-2 text-sm leading-relaxed text-ink-muted">
          <strong className="font-semibold">비공개 공지입니다.</strong> 담당자에게만 보이고 알림마당
          목록에는 나오지 않습니다. 공개하려면 공지 관리에서 공개 범위를 바꿔 주세요.
        </p>
      )}

      {body === null ? (
        <p className="text-sm text-ink-muted">불러오는 중…</p>
      ) : body === 'locked' ? (
        <MembersOnly noticeId={notice.id} status={status} />
      ) : (
        <>
          {/* 줄바꿈을 그대로 살린다 — 본문은 서식 없는 글이다 */}
          <div className="whitespace-pre-line leading-relaxed text-ink-muted">{body.content}</div>

          {files.length > 0 && (
            <section
              aria-labelledby="notice-files"
              className="rounded-xl border border-line bg-subtle p-4"
            >
              <h3 id="notice-files" className="text-sm font-bold">
                첨부 파일 {files.length}
              </h3>
              <ul className="mt-2 space-y-1.5">
                {files.map((f) => {
                  const url = urlOf(f.storagePath)
                  return (
                    <li
                      key={f.storagePath}
                      className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm"
                    >
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
                        {links === null && ' · 준비 중…'}
                        {links === 'failed' && ' · 지금 받을 수 없습니다. 잠시 후 새로고침해 주세요'}
                      </span>
                    </li>
                  )
                })}
              </ul>
              {/* 주소는 한 시간짜리다 — 화면을 오래 열어 뒀다가 누르면 만료될 수 있다 */}
              <p className="mt-2 text-xs text-ink-subtle">
                받기가 안 되면 새로고침한 뒤 다시 눌러 주세요.
              </p>
            </section>
          )}
        </>
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

/** 「회원만」 공지를 회원이 아닌 사람이 열었을 때 — 지금 상태에서 할 수 있는 한 가지를 안내 */
function MembersOnly({
  noticeId,
  status,
}: {
  noticeId: string
  status: ReturnType<typeof useAuth>['status']
}) {
  const next = encodeURIComponent(`/notice/${noticeId}`)
  const guide =
    status === 'guest'
      ? { desc: '로그인하면 본문과 첨부 파일을 볼 수 있습니다.', href: `/login?next=${next}`, label: '로그인' }
      : status === 'unregistered'
        ? {
            desc: '참여 정보 입력(가입 2단계)을 마치면 볼 수 있습니다.',
            href: `/register?next=${next}`,
            label: '가입 마저 하기',
          }
        : status === 'withdrawn'
          ? { desc: '탈퇴 처리된 계정입니다. 담당자에게 문의해 주세요.', href: '', label: '' }
          : { desc: '지금은 볼 수 없습니다. 잠시 후 새로고침해 주세요.', href: '', label: '' }

  return (
    <div className="rounded-xl border border-line bg-subtle p-5 text-center sm:p-6">
      <p className="font-bold">회원만 볼 수 있는 공지입니다</p>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{guide.desc}</p>
      {guide.href && (
        <Link
          href={guide.href}
          className="touch-target mt-4 inline-flex items-center justify-center rounded-xl bg-brand-600 px-6 font-semibold text-white hover:bg-brand-700"
        >
          {guide.label}
        </Link>
      )}
      {status === 'guest' && (
        <p className="mt-3 text-xs text-ink-subtle">
          처음이신가요?{' '}
          <Link href={`/signup?next=${next}`} className="font-semibold underline underline-offset-2">
            회원가입
          </Link>
        </p>
      )}
    </div>
  )
}
