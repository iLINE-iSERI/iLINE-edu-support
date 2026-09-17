'use client'

/**
 * 산출물 제출창 (D-76 · 09-17) — **제목 · 내용 · 파일** 세 줄이 전부다.
 *
 * 항목 이름이나 양식을 두지 않는다. iSERI: "괜히 명칭 붙여둬서 그것만 낼 수
 * 있는 화면인 것 같은 느낌 주지 말고 그냥 제출창이라고만." 무엇을 올릴지는
 * 담당자가 공고에 적은 안내(outputGuide)가 말해 준다.
 *
 * 새로 낼 때와 「다시 제출하기」(editing) 둘 다 이 화면. 다시 낼 때는 기존 파일이
 * 보이고 뺄 수 있다 — 정산 재제출(09-12)과 같은 방식.
 */

import { useState } from 'react'
import Button from '@/components/ui/Button'
import {
  submitOutput,
  updateMyOutput,
  outputRejectReason,
  OUTPUT_FILE_TYPES,
  OUTPUT_MAX_FILES,
} from '@/lib/firebase/outputs'
import { fileUrl } from '@/lib/firebase/applications'
import { firestoreErrorMessage } from '@/lib/firebase/errors'
import type { Application, AttachedFile, Output, Program, SupportUser } from '@/lib/types'

const ACCEPT = Object.keys(OUTPUT_FILE_TYPES)
  .map((ext) => `.${ext}`)
  .join(',')

export default function OutputForm({
  application,
  program,
  member,
  editing,
  onDone,
  onCancel,
}: {
  application: Application
  program: Program
  member: SupportUser
  /** 있으면 「다시 제출하기」 */
  editing?: Output | null
  onDone: (outputId: string) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState(editing?.title ?? '')
  const [text, setText] = useState(editing?.text ?? '')
  const [files, setFiles] = useState<File[]>([])
  const [rejected, setRejected] = useState<{ name: string; why: string }[]>([])
  const [dropped, setDropped] = useState<Set<string>>(() => new Set())
  const prevFiles: AttachedFile[] = editing?.files ?? []
  const kept = prevFiles.filter((f) => !dropped.has(f.storagePath))

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function handleFiles(list: FileList | null, input: HTMLInputElement | null) {
    if (!list || list.length === 0) return
    const accepted = [...files]
    const bad: { name: string; why: string }[] = []
    for (const f of Array.from(list)) {
      const why = outputRejectReason(f, kept.length + accepted.length)
      if (why) bad.push({ name: f.name, why })
      else accepted.push(f)
    }
    setFiles(accepted)
    setRejected(bad)
    if (bad.length === 0) setError('')
    if (input) input.value = ''
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!title.trim()) return setError('제목을 적어 주세요.')
    if (!text.trim() && kept.length + files.length === 0) {
      return setError('내용을 적거나 파일을 하나 이상 붙여 주세요.')
    }
    if (rejected.length > 0) {
      return setError('붙이지 못한 파일이 있습니다. 확인하시거나 [무시하고 계속]을 눌러 주세요.')
    }

    setBusy(true)
    try {
      let id: string
      if (editing) {
        await updateMyOutput({
          output: editing,
          uid: member.uid,
          title,
          text,
          files,
          keepFiles: kept,
        })
        id = editing.id
      } else {
        id = await submitOutput({
          application,
          program,
          uid: member.uid,
          authorName: member.name,
          authorAffiliation: [member.affiliation, member.major].filter(Boolean).join(' · ') || undefined,
          title,
          text,
          files,
        })
      }
      onDone(id)
    } catch (err) {
      console.error('[iLINE] 산출물 제출 실패:', err)
      setError(firestoreErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4 rounded-2xl border border-line shadow-card bg-surface p-4 sm:p-5">
      <p className="text-base font-extrabold">{editing ? '다시 제출하기' : '새로 제출하기'}</p>

      <label className="block">
        <span className="text-sm font-semibold">제목</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={INPUT}
          maxLength={100}
        />
      </label>

      <label className="block">
        <span className="text-sm font-semibold">
          내용 <span className="text-xs font-semibold text-ink-subtle">(선택)</span>
        </span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          className={INPUT}
          maxLength={5000}
        />
      </label>

      <div>
        <p className="text-sm font-semibold">
          파일 <span className="text-xs font-semibold text-ink-subtle">(선택 · 최대 {OUTPUT_MAX_FILES}개 · 하나에 50MB)</span>
        </p>
        <p className="mt-1 text-xs leading-relaxed text-ink-subtle">
          사진 · PDF · 한글 · 워드 · 파워포인트 · 엑셀 · 압축 · 영상(mp4). 다른 사람이 함께 나온
          사진은 <strong>그분의 동의를 받고</strong> 올려 주세요.
        </p>

        {prevFiles.length > 0 && (
          <div className="mt-3 rounded-lg bg-subtle p-3">
            <p className="text-xs font-semibold text-ink-subtle">
              이미 올린 파일 {prevFiles.length}개 — <strong>그대로 유지됩니다.</strong> 잘못 올린 것은 [빼기]
            </p>
            <ul className="mt-2 space-y-1.5 text-sm">
              {prevFiles.map((f) => {
                const off = dropped.has(f.storagePath)
                return (
                  <li key={f.storagePath} className="flex items-center justify-between gap-3">
                    <span className={'min-w-0 ' + (off ? 'line-through opacity-50' : '')}>
                      <FileLink path={f.storagePath} label={f.fileName} />
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const next = new Set(dropped)
                        if (off) next.delete(f.storagePath)
                        else next.add(f.storagePath)
                        setDropped(next)
                      }}
                      className="shrink-0 text-xs font-semibold text-ink-muted underline"
                    >
                      {off ? '되살리기' : '빼기'}
                    </button>
                  </li>
                )
              })}
            </ul>
            {dropped.size > 0 && (
              <p className="mt-2 text-xs text-status-revision">
                뺀 {dropped.size}개는 제출할 때 지워집니다.
              </p>
            )}
          </div>
        )}

        <input
          type="file"
          multiple
          accept={ACCEPT}
          onChange={(e) => handleFiles(e.target.files, e.target)}
          className="mt-3 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-600 file:px-4 file:py-2.5 file:font-semibold file:text-white"
        />

        {rejected.length > 0 && (
          <div role="alert" className="mt-3 rounded-xl border border-status-revision/40 bg-status-revision/10 p-3 text-sm">
            <p className="font-bold text-status-revision">붙이지 못한 파일 {rejected.length}개</p>
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

        {files.length > 0 && (
          <ul className="mt-3 space-y-2">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-3 rounded-lg bg-subtle px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{f.name}</span>
                <span className="shrink-0 text-xs text-ink-subtle">{(f.size / 1024 / 1024).toFixed(1)}MB</span>
                <button
                  type="button"
                  onClick={() => setFiles(files.filter((_, j) => j !== i))}
                  className="shrink-0 text-xs font-semibold text-ink-muted underline"
                >
                  빼기
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <Button type="submit" disabled={busy}>
          {busy ? '올리는 중…' : editing ? '다시 제출' : '제출'}
        </Button>
        <Button type="button" variant="secondary" disabled={busy} onClick={onCancel}>
          취소
        </Button>
        {error && (
          <span role="alert" className="text-sm font-semibold leading-relaxed text-status-revision">
            {error}
          </span>
        )}
      </div>
    </form>
  )
}

const INPUT =
  'mt-1.5 w-full rounded-xl border border-line-strong bg-surface p-3 text-base outline-none focus:border-brand-600'

/** 올린 파일 열기 — 규칙을 통과한 사람만 주소를 받는다 */
export function FileLink({ path, label }: { path: string; label: string }) {
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
          alert('파일을 여는 데 실패했습니다.')
        } finally {
          setBusy(false)
        }
      }}
      className="inline-flex max-w-full items-center rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-ink-muted transition-colors hover:border-brand-600 hover:bg-brand-soft hover:text-brand-600 disabled:opacity-50"
    >
      <span className="truncate">{busy ? '여는 중…' : label}</span>
    </button>
  )
}
