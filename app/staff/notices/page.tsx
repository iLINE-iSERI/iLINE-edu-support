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
 *
 * 첨부 파일 (D-112) — 고른 파일은 **저장할 때** 올라간다. 산출물 제출창과 같은 손놀림
 * (이미 올린 것은 [빼기]/[되살리기], 새로 고른 것은 [빼기], 못 붙인 것은 이유와 함께).
 * 🔴 공개 경로라 로그인 안 한 사람도 받는다 — 경고를 파일 칸에 늘 보인다.
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
  noticeFileRejectReason,
  noticeFileUrl,
  fileSizeLabel,
  NOTICE_ACCEPT,
  NOTICE_MAX_FILES,
  type NoticeInput,
} from '@/lib/firebase/notices'
import { formatDate } from '@/lib/firebase/programs'
import { firestoreErrorMessage } from '@/lib/firebase/errors'
import { useRevealForm } from '@/lib/hooks/useRevealForm'
import type { AttachedFile, Notice } from '@/lib/types'

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
  /** 폼이 열리면 그리로 화면을 옮긴다 (프로그램 관리와 같은 구조) */
  const formRef = useRevealForm(editingId)
  const [form, setForm] = useState<NoticeInput>(EMPTY)
  const [busy, setBusy] = useState(false)
  /** 저장 중 파일 올리기 진행 — 「파일 올리는 중 (1/3)」 */
  const [progress, setProgress] = useState('')
  /** 잘못된 칸 → 칸 이름 옆에 붙일 사유. 폼이 길어서 맨 위 안내는 눈에 안 띈다 */
  const [fieldError, setFieldError] = useState<{ title?: string; content?: string }>({})

  /* ── 첨부 (D-112) ── */
  /** 새로 고른 파일 — 저장할 때 올라간다 */
  const [newFiles, setNewFiles] = useState<File[]>([])
  /** 이미 올린 파일 중 뺀 것(경로) — 저장하면 지워진다 */
  const [dropped, setDropped] = useState<Set<string>>(() => new Set())
  /** 붙이지 못한 파일과 이유 */
  const [rejected, setRejected] = useState<{ name: string; why: string }[]>([])
  const editingNotice = editingId ? (notices?.find((n) => n.id === editingId) ?? null) : null
  const prevFiles: AttachedFile[] = editingNotice?.files ?? []
  const kept = prevFiles.filter((f) => !dropped.has(f.storagePath))

  function resetFiles() {
    setNewFiles([])
    setDropped(new Set())
    setRejected([])
  }

  function handleFiles(list: FileList | null, input: HTMLInputElement | null) {
    if (!list || list.length === 0) return
    const accepted = [...newFiles]
    const bad: { name: string; why: string }[] = []
    for (const f of Array.from(list)) {
      const why = noticeFileRejectReason(f, kept.length + accepted.length)
      if (why) bad.push({ name: f.name, why })
      else accepted.push(f)
    }
    setNewFiles(accepted)
    setRejected(bad)
    if (bad.length === 0) setError('')
    // 같은 파일을 빼고 다시 고를 수 있게 비운다
    if (input) input.value = ''
  }

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
    setFieldError({})
    resetFiles()
  }

  function openEdit(n: Notice) {
    setEditingId(n.id)
    setForm({ title: n.title, content: n.content, pinned: n.pinned })
    setError('')
    setFieldError({})
    resetFiles()
  }

  function close() {
    setEditingId(null)
    setForm(EMPTY)
    setFieldError({})
    setError('')
    resetFiles()
  }

  /** 문제가 난 칸으로 데려간다 — 커서까지 넣어 바로 고칠 수 있게 */
  function focusField(key: 'title' | 'content', message: string) {
    setFieldError({ [key]: message })
    setError('표시된 칸을 확인해 주세요.')
    const el = document.getElementById(key)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    window.setTimeout(() => el.focus({ preventScroll: true }), 250)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return

    if (!form.title.trim()) return focusField('title', '제목을 입력해 주세요')
    if (!form.content.trim()) return focusField('content', '내용을 입력해 주세요')
    // 못 붙인 파일이 있는 채로 저장하면 "올린 줄 알았던 파일"이 빠진 공지가 나간다
    if (rejected.length > 0) {
      return setError('붙이지 못한 파일이 있습니다. 확인하시거나 [무시하고 계속]을 눌러 주세요.')
    }
    // 수정하던 공지가 그 사이 지워졌으면 새 공지로 만들지 않는다
    if (editingId && !editingNotice) {
      return setError('수정하던 공지를 찾을 수 없습니다. [취소]를 누르고 목록을 확인해 주세요.')
    }

    setBusy(true)
    setError('')
    setFieldError({})
    const onProgress = (done: number, total: number) =>
      setProgress(`파일 올리는 중 (${done + 1}/${total})…`)
    try {
      if (editingNotice) {
        await updateNotice(editingNotice, form, { keep: kept, add: newFiles }, onProgress)
      } else {
        await createNotice(form, newFiles, user.uid, onProgress)
      }
      close()
      await load()
    } catch (e) {
      console.error('[iLINE] 공지 저장 실패:', e)
      setError(saveErrorMessage(e))
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  async function remove(n: Notice) {
    // 되돌릴 수 없으므로 제목을 보여주며 한 번 더 묻는다.
    const withFiles = n.files?.length ? ` 첨부 파일 ${n.files.length}개도 함께 지워집니다.` : ''
    if (!confirm(`"${n.title}" 공지를 삭제합니다.${withFiles} 되돌릴 수 없습니다.`)) return

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
            ← 관리
          </Link>
          {editingId === null && (
            <button
              type="button"
              onClick={openNew}
              className="touch-target inline-flex items-center justify-center rounded-lg bg-brand-600 px-5 font-bold text-white hover:bg-brand-700"
            >
              새 공지 작성
            </button>
          )}
        </div>

        {/* 폼이 닫혀 있을 때의 오류(목록 조회 실패 등)만 여기 표시한다.
            폼이 열려 있으면 저장 버튼 옆에 붙는다 — 누른 자리에서 결과를 본다 */}
        {error && editingId === null && (
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
            ref={formRef}
            onSubmit={save}
            noValidate
            className="space-y-4 rounded-2xl border border-line bg-surface shadow-card p-5"
          >
            <h2 className="font-bold" data-reveal-title tabIndex={-1}>
              {editingId ? '공지 수정' : '새 공지 작성'}
            </h2>

            <div>
              <label htmlFor="title" className="flex flex-wrap items-baseline gap-2">
                <span className="text-sm font-semibold">제목</span>
                {fieldError.title && (
                  <span className="text-xs font-semibold text-status-revision">
                    {fieldError.title}
                  </span>
                )}
              </label>
              <input
                id="title"
                value={form.title}
                onChange={(e) => {
                  setForm({ ...form, title: e.target.value })
                  if (fieldError.title) setFieldError({ ...fieldError, title: undefined })
                }}
                aria-invalid={Boolean(fieldError.title)}
                className={
                  'mt-2 w-full rounded-xl border bg-surface p-3 text-base outline-none ' +
                  (fieldError.title
                    ? 'border-status-revision focus:border-status-revision'
                    : 'border-line-strong focus:border-brand-600')
                }
                placeholder="예: 2026학년도 1학기 프로그램 참여자 모집"
              />
            </div>

            <div>
              <label htmlFor="content" className="flex flex-wrap items-baseline gap-2">
                <span className="text-sm font-semibold">내용</span>
                {fieldError.content && (
                  <span className="text-xs font-semibold text-status-revision">
                    {fieldError.content}
                  </span>
                )}
              </label>
              <textarea
                id="content"
                rows={12}
                value={form.content}
                onChange={(e) => {
                  setForm({ ...form, content: e.target.value })
                  if (fieldError.content)
                    setFieldError({ ...fieldError, content: undefined })
                }}
                aria-invalid={Boolean(fieldError.content)}
                className={
                  'mt-2 w-full rounded-xl border bg-surface p-3 text-base leading-relaxed outline-none ' +
                  (fieldError.content
                    ? 'border-status-revision focus:border-status-revision'
                    : 'border-line-strong focus:border-brand-600')
                }
                placeholder={
                  '줄바꿈은 그대로 표시됩니다.\n\n문단을 나누려면 빈 줄을 넣으세요.'
                }
              />
              <p className="mt-1.5 text-xs text-ink-subtle">
                굵게·표 같은 서식은 지원하지 않습니다. 줄바꿈과 빈 줄로 구분해
                주세요.
              </p>
            </div>

            {/* ── 첨부 파일 (D-112) ── */}
            <div>
              <p className="text-sm font-semibold">
                첨부 파일{' '}
                <span className="text-xs font-semibold text-ink-subtle">
                  (선택 · 최대 {NOTICE_MAX_FILES}개 · 하나에 20MB 미만)
                </span>
              </p>
              <p className="mt-1 text-xs leading-relaxed text-ink-subtle">
                PDF · 한글 · 워드 · 엑셀 · 파워포인트 · 사진 · 압축. 고른 파일은 [저장]을 누를 때
                올라갑니다.
              </p>
              {/* 공개 범위 경고 — 공지 본문보다 파일이 더 쉽게 퍼진다(내려받아 돌려 본다) */}
              <p className="mt-2 rounded-lg bg-status-revision/10 px-3 py-2 text-xs leading-relaxed text-status-revision">
                <strong className="font-bold">첨부 파일은 로그인하지 않은 사람도 받을 수 있습니다.</strong>{' '}
                이름·연락처·학번이 담긴 파일(선정자 명단 등)은 올리지 마세요. 명단은 본문에 정한
                범위만 적습니다.
              </p>

              {prevFiles.length > 0 && (
                <div className="mt-3 rounded-lg bg-subtle p-3">
                  <p className="text-xs font-semibold text-ink-subtle">
                    이미 올린 파일 {prevFiles.length}개 — <strong>그대로 유지됩니다.</strong> 잘못
                    올린 것은 [빼기]
                  </p>
                  <ul className="mt-2 space-y-1.5 text-sm">
                    {prevFiles.map((f) => {
                      const off = dropped.has(f.storagePath)
                      return (
                        <li key={f.storagePath} className="flex items-center justify-between gap-3">
                          <span className={'min-w-0 ' + (off ? 'line-through opacity-50' : '')}>
                            <StaffFileLink file={f} />
                          </span>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              const next = new Set(dropped)
                              if (off) next.delete(f.storagePath)
                              else next.add(f.storagePath)
                              setDropped(next)
                            }}
                            className="shrink-0 text-xs font-semibold text-ink-muted underline disabled:opacity-50"
                          >
                            {off ? '되살리기' : '빼기'}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                  {dropped.size > 0 && (
                    <p className="mt-2 text-xs text-status-revision">
                      뺀 {dropped.size}개는 저장할 때 지워집니다.
                    </p>
                  )}
                </div>
              )}

              <input
                type="file"
                multiple
                accept={NOTICE_ACCEPT}
                disabled={busy}
                aria-label="첨부 파일 고르기"
                onChange={(e) => handleFiles(e.target.files, e.target)}
                className="mt-3 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-600 file:px-4 file:py-2.5 file:font-semibold file:text-white disabled:opacity-50"
              />

              {rejected.length > 0 && (
                <div
                  role="alert"
                  className="mt-3 rounded-xl border border-status-revision/40 bg-status-revision/10 p-3 text-sm"
                >
                  <p className="font-bold text-status-revision">
                    붙이지 못한 파일 {rejected.length}개
                  </p>
                  <ul className="mt-1.5 space-y-1 text-ink-muted">
                    {rejected.map((r, i) => (
                      <li key={`${r.name}-${i}`} className="leading-relaxed">
                        <span className="break-all font-medium">{r.name}</span>
                        <span className="text-ink-subtle"> — {r.why}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => {
                      setRejected([])
                      setError('')
                    }}
                    className="mt-2 text-xs font-semibold text-ink-muted underline underline-offset-2"
                  >
                    무시하고 계속
                  </button>
                </div>
              )}

              {newFiles.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {newFiles.map((f, i) => (
                    <li
                      key={`${f.name}-${i}`}
                      className="flex items-center justify-between gap-3 rounded-lg bg-subtle px-3 py-2 text-sm"
                    >
                      <span className="min-w-0 flex-1 truncate">{f.name}</span>
                      <span className="shrink-0 text-xs text-ink-subtle">
                        {fileSizeLabel(f.size)}
                      </span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setNewFiles(newFiles.filter((_, j) => j !== i))}
                        className="shrink-0 text-xs font-semibold text-ink-muted underline disabled:opacity-50"
                      >
                        빼기
                      </button>
                    </li>
                  ))}
                </ul>
              )}
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

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={busy}
                className="touch-target inline-flex items-center justify-center rounded-lg bg-brand-600 px-6 font-bold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {busy ? progress || '저장 중…' : '저장'}
              </button>
              <button
                type="button"
                onClick={close}
                disabled={busy}
                className="touch-target inline-flex items-center justify-center rounded-lg border border-line-strong px-6 font-semibold disabled:opacity-50"
              >
                취소
              </button>
              {error && (
                <span
                  role="alert"
                  className="text-sm font-semibold leading-relaxed text-status-revision"
                >
                  {error}
                </span>
              )}
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
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
            {notices.map((n) => (
              <li
                key={n.id}
                className="flex flex-wrap items-start gap-3 px-5 py-4"
              >
                {n.pinned && <Badge tone="info">고정</Badge>}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{n.title}</p>
                  <p className="mt-1 text-xs text-ink-subtle">
                    {formatDate(n.createdAt)}
                    {n.files && n.files.length > 0 && <> · 첨부 {n.files.length}</>}
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

/**
 * 저장 실패 문구 — Storage 권한 오류는 코드가 `storage/unauthorized` 라 공통 문구로는
 * "처리 중 문제"로 뭉개진다. 담당자 계정에 Storage 권한(Custom Claims)이 없을 때 나므로 그걸 알려 준다.
 */
function saveErrorMessage(e: unknown): string {
  const code =
    typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : ''
  if (code === 'storage/unauthorized') {
    return '파일을 올릴 권한이 없습니다. 담당자 계정에 Storage 권한(Custom Claims)이 있는지 확인해 주세요.'
  }
  return firestoreErrorMessage(e)
}

/** 이미 올린 파일 열기 — 올바르게 올라갔는지 담당자가 눌러 확인한다 */
function StaffFileLink({ file }: { file: AttachedFile }) {
  const [busy, setBusy] = useState(false)
  return (
    <button
      type="button"
      disabled={busy}
      title={file.fileName}
      onClick={async () => {
        setBusy(true)
        try {
          window.open(await noticeFileUrl(file.storagePath), '_blank', 'noopener')
        } catch (e) {
          console.error('[iLINE] 공지 첨부 열기 실패:', e)
          alert('파일을 여는 데 실패했습니다.')
        } finally {
          setBusy(false)
        }
      }}
      className="inline-flex max-w-full items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-ink-muted transition-colors hover:border-brand-600 hover:bg-brand-soft hover:text-brand-600 disabled:opacity-50"
    >
      <span className="truncate">{busy ? '여는 중…' : file.fileName}</span>
      <span className="shrink-0 text-xs font-normal text-ink-subtle">{fileSizeLabel(file.size)}</span>
    </button>
  )
}
