'use client'

/**
 * 담당자 공지 작성 화면 (🟠W 의 첫 조각)
 *
 * 이 화면이 생기기 전까지 공지를 올리는 수단은 **Firebase 콘솔뿐**이었다.
 * 콘솔 권한은 컬렉션 단위로 쪼갤 수 없어서, 공지 하나 쓰자고 권한을 주면
 * 신청자 개인정보까지 통째로 열린다. 그래서 이 화면이 필요하다.
 *
 * 목록·작성·수정·삭제를 한 화면에 둔다. 공지는 건수가 적고 흐름이 짧아서
 * 화면을 나누면 오히려 왔다 갔다 하는 품이 늘어난다.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import Badge from '@/components/ui/Badge'
import MemberGate from '@/components/auth/MemberGate'
import { useAuth } from '@/components/auth/AuthProvider'
import {
  listNotices,
  createNotice,
  updateNotice,
  deleteNotice,
  type NoticeInput,
} from '@/lib/firebase/notices'
import { formatDate } from '@/lib/firebase/programs'
import { firestoreErrorMessage } from '@/lib/firebase/errors'
import type { Notice } from '@/lib/types'

const EMPTY: NoticeInput = { title: '', content: '', pinned: false }

export default function StaffNoticesPage() {
  return (
    <MemberGate requireStaff>
      <StaffNoticesContent />
    </MemberGate>
  )
}

function StaffNoticesContent() {
  const { user } = useAuth()
  const [notices, setNotices] = useState<Notice[] | null>(null)
  const [error, setError] = useState('')

  /** 편집 중인 대상 — null: 안 열림, '': 새 글, 그 외: 수정할 공지 ID */
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<NoticeInput>(EMPTY)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setError('')
    try {
      setNotices(await listNotices())
    } catch (e) {
      console.error('[iLINE] 공지 목록 조회 실패:', e)
      setError(firestoreErrorMessage(e))
      setNotices([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function openNew() {
    setEditingId('')
    setForm(EMPTY)
    setError('')
  }

  function openEdit(n: Notice) {
    setEditingId(n.id)
    setForm({ title: n.title, content: n.content, pinned: n.pinned })
    setError('')
  }

  function close() {
    setEditingId(null)
    setForm(EMPTY)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return

    if (!form.title.trim()) {
      setError('제목을 입력해 주세요.')
      return
    }
    if (!form.content.trim()) {
      setError('내용을 입력해 주세요.')
      return
    }

    setBusy(true)
    setError('')
    try {
      if (editingId) await updateNotice(editingId, form)
      else await createNotice(form, user.uid)
      close()
      await load()
    } catch (e) {
      console.error('[iLINE] 공지 저장 실패:', e)
      setError(firestoreErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function remove(n: Notice) {
    // 되돌릴 수 없으므로 제목을 보여주며 한 번 더 묻는다.
    if (!confirm(`"${n.title}" 공지를 삭제합니다. 되돌릴 수 없습니다.`)) return

    setBusy(true)
    setError('')
    try {
      await deleteNotice(n.id)
      if (editingId === n.id) close()
      await load()
    } catch (e) {
      console.error('[iLINE] 공지 삭제 실패:', e)
      setError(firestoreErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="공지 관리"
        description="알림마당에 게시할 공지사항을 작성하고 수정합니다."
      />

      <div className="container-page space-y-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/staff"
            className="text-sm font-semibold text-ink-muted underline underline-offset-2"
          >
            ← 신청 관리
          </Link>
          {editingId === null && (
            <button
              type="button"
              onClick={openNew}
              className="touch-target inline-flex items-center justify-center rounded-xl bg-brand-600 px-5 font-bold text-white hover:bg-brand-700"
            >
              새 공지 작성
            </button>
          )}
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg bg-status-revision/10 px-3 py-2 text-sm leading-relaxed text-status-revision"
          >
            {error}
          </p>
        )}

        {/* ── 작성 · 수정 폼 ─────────────────────────────── */}
        {editingId !== null && (
          <form
            onSubmit={save}
            className="space-y-4 rounded-2xl border border-line bg-surface p-5"
          >
            <h2 className="font-bold">
              {editingId ? '공지 수정' : '새 공지 작성'}
            </h2>

            <div>
              <label htmlFor="title" className="block text-sm font-semibold">
                제목
              </label>
              <input
                id="title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="mt-2 w-full rounded-xl border border-line-strong bg-surface p-3 text-base outline-none focus:border-brand-600"
                placeholder="예: 2026학년도 1학기 프로그램 참여자 모집"
              />
            </div>

            <div>
              <label htmlFor="content" className="block text-sm font-semibold">
                내용
              </label>
              <textarea
                id="content"
                rows={12}
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                className="mt-2 w-full rounded-xl border border-line-strong bg-surface p-3 text-base leading-relaxed outline-none focus:border-brand-600"
                placeholder={
                  '줄바꿈은 그대로 표시됩니다.\n\n문단을 나누려면 빈 줄을 넣으세요.'
                }
              />
              <p className="mt-1.5 text-xs text-ink-subtle">
                굵게·표 같은 서식은 지원하지 않습니다. 줄바꿈과 빈 줄로 구분해
                주세요.
              </p>
            </div>

            <label className="flex items-start gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={form.pinned}
                onChange={(e) => setForm({ ...form, pinned: e.target.checked })}
                className="mt-0.5 size-4"
              />
              <span>
                <strong className="font-semibold">목록 맨 위에 고정</strong>
                <span className="block text-xs text-ink-subtle">
                  모집 공고처럼 계속 보여야 하는 안내에만 쓰세요. 여러 개를
                  고정하면 고정의 의미가 없어집니다.
                </span>
              </span>
            </label>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="submit"
                disabled={busy}
                className="touch-target inline-flex items-center justify-center rounded-xl bg-brand-600 px-6 font-bold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {busy ? '저장 중…' : '저장'}
              </button>
              <button
                type="button"
                onClick={close}
                disabled={busy}
                className="touch-target inline-flex items-center justify-center rounded-xl border border-line-strong px-6 font-semibold disabled:opacity-50"
              >
                취소
              </button>
            </div>
          </form>
        )}

        {/* ── 목록 ───────────────────────────────────────── */}
        {notices === null ? (
          <p className="text-sm text-ink-muted">불러오는 중…</p>
        ) : notices.length === 0 ? (
          <EmptyState
            title="등록된 공지가 없습니다"
            desc="위 [새 공지 작성]으로 첫 공지를 올려 보세요."
          />
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {notices.map((n) => (
              <li
                key={n.id}
                className="flex flex-wrap items-start gap-3 px-5 py-4"
              >
                {n.pinned && <Badge tone="individual">고정</Badge>}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{n.title}</p>
                  <p className="mt-1 text-xs text-ink-subtle">
                    {formatDate(n.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2 text-sm">
                  <Link
                    href={`/notice/${n.id}`}
                    className="font-semibold text-ink-muted underline underline-offset-2"
                  >
                    보기
                  </Link>
                  <button
                    type="button"
                    onClick={() => openEdit(n)}
                    disabled={busy}
                    className="font-semibold text-ink-muted underline underline-offset-2 disabled:opacity-50"
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(n)}
                    disabled={busy}
                    className="font-semibold text-status-revision underline underline-offset-2 disabled:opacity-50"
                  >
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
