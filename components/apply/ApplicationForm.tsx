'use client'

/**
 * 신청서 (D-29) — 최소 구성.
 *
 * 신청자는 개인정보를 다시 입력하지 않는다. 회원가입 때 받은 것을
 * **확인만** 하고 제출한다. 프로그램이 요구할 때만 자유 기재란과
 * 첨부란이 나타난다. 설계 배경은 docs/07-application-form.md 참고.
 */

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { submitApplication, requestSync } from '@/lib/firebase/applications'
import ApplicationSheet from './ApplicationSheet'
import { elementToPdfBlob } from '@/lib/pdf/applicationPdf'
import { firestoreErrorMessage } from '@/lib/firebase/errors'
import type { Program, SupportUser } from '@/lib/types'

/** 첨부 가능한 형식 — Storage 규칙과 같은 범위로 맞춘다 */
const ACCEPT = 'image/jpeg,image/png,image/heic,image/heif,image/webp,application/pdf'
const MAX_BYTES = 20 * 1024 * 1024
const MAX_FILES = 5

export default function ApplicationForm({
  program,
  member,
  uid,
}: {
  program: Program
  member: SupportUser
  uid: string
}) {
  const router = useRouter()
  const [note, setNote] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState('')
  const [error, setError] = useState('')
  /** PDF로 뜰 인쇄본 — 화면 밖에 그려둔다 */
  const sheetRef = useRef<HTMLDivElement>(null)

  const wantsNote = Boolean(program.noteLabel)
  const wantsFiles = Boolean(program.attachmentGuide)

  const consent = (purpose: string) =>
    member.consents.some((c) => c.purpose === purpose && c.agreed)

  function handleFiles(list: FileList | null) {
    setError('')
    if (!list) return

    const picked = Array.from(list)
    const tooBig = picked.find((f) => f.size > MAX_BYTES)
    if (tooBig) {
      setError(`"${tooBig.name}" 파일이 20MB를 넘습니다.`)
      return
    }
    const merged = [...files, ...picked].slice(0, MAX_FILES)
    if (files.length + picked.length > MAX_FILES) {
      setError(`첨부는 최대 ${MAX_FILES}개까지입니다.`)
    }
    setFiles(merged)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (program.noteRequired && !note.trim()) {
      setError(`${program.noteLabel}을(를) 입력해 주세요.`)
      return
    }
    if (program.attachmentRequired && files.length === 0) {
      setError('첨부 서류를 올려 주세요.')
      return
    }

    setBusy(true)
    try {
      // ① 제출 시점의 신청서를 PDF 원본으로 뜬다 (D-28).
      //    실패해도 제출 자체는 막지 않는다 — PDF는 사본 성격이고,
      //    이것 때문에 학생이 신청을 못 하게 되는 게 더 큰 문제다.
      setStep('신청서를 만드는 중…')
      let pdf: Blob | null = null
      try {
        if (sheetRef.current) pdf = await elementToPdfBlob(sheetRef.current)
      } catch (e) {
        console.error('[iLINE] 신청서 PDF 생성 실패 — 제출은 계속합니다:', e)
      }

      setStep(files.length > 0 ? '파일을 올리는 중…' : '제출하는 중…')
      const appId = await submitApplication({ program, member, uid, note, files, pdf })

      // 시트·드라이브 반영. 실패해도 제출은 이미 끝났으므로 기다리지 않는다.
      void requestSync(appId)

      router.replace('/mypage?submitted=1')
    } catch (err) {
      console.error('[iLINE] 신청서 제출 실패:', err)
      setError(firestoreErrorMessage(err))
      setStep('')
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* PDF 원본 — 화면에는 보이지 않는다 */}
      <ApplicationSheet
        ref={sheetRef}
        program={program}
        member={member}
        note={note}
        fileNames={files.map((f) => f.name)}
      />

      {/* ── 신청자 정보 — 확인만 ────────────────────────────── */}
      <section className="rounded-2xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-bold">신청자 정보</h2>
          <Link
            href="/mypage"
            className="text-xs text-ink-muted underline underline-offset-2"
          >
            내용이 다르면 회원정보 수정
          </Link>
        </div>
        <p className="mt-1 text-xs text-ink-subtle">
          회원가입 때 등록하신 정보입니다. 제출 시점의 내용이 신청서에
          그대로 보관됩니다.
        </p>

        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <Row label="이름" value={member.name} />
          <Row label="학번" value={member.studentId} />
          <Row label="전공" value={member.major} />
          <Row label="학년" value={member.grade} />
          <Row label="연락처" value={member.phone} />
          <Row label="이메일" value={member.email} />
        </dl>

        <dl className="mt-4 grid gap-3 border-t border-line pt-4 text-sm sm:grid-cols-2">
          <Row
            label="개인정보 수집·이용 동의"
            value={consent('personal_info') ? 'O (동의)' : 'X (미동의)'}
          />
          <Row
            label="초상권 활용 동의"
            value={consent('portrait') ? 'O (동의)' : 'X (미동의)'}
          />
        </dl>
      </section>

      {/* ── 자유 기재란 — 프로그램이 요구할 때만 ─────────────── */}
      {wantsNote && (
        <section className="rounded-2xl border border-line bg-surface p-5">
          <label htmlFor="note" className="block font-bold">
            {program.noteLabel}
            {program.noteRequired && (
              <span className="ml-1 text-status-revision" aria-hidden="true">
                *
              </span>
            )}
          </label>
          <textarea
            id="note"
            rows={6}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="mt-3 w-full rounded-xl border border-line-strong bg-surface p-3 text-base leading-relaxed outline-none focus:border-brand-600"
            placeholder="자유롭게 작성해 주세요."
          />
        </section>
      )}

      {/* ── 첨부 — 프로그램이 요구할 때만 ────────────────────── */}
      {wantsFiles && (
        <section className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="font-bold">
            첨부 서류
            {program.attachmentRequired && (
              <span className="ml-1 text-status-revision" aria-hidden="true">
                *
              </span>
            )}
          </h2>
          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink-muted">
            {program.attachmentGuide}
          </p>

          {/* D-24: capture 속성을 두지 않아 '카메라 촬영'과 '파일 선택'이
                   모두 뜨게 한다. 휴대폰에서 영수증을 바로 찍어 올릴 수 있다. */}
          <input
            type="file"
            multiple
            accept={ACCEPT}
            onChange={(e) => handleFiles(e.target.files)}
            className="mt-4 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-600 file:px-4 file:py-2.5 file:font-semibold file:text-white"
          />
          <p className="mt-2 text-xs text-ink-subtle">
            사진 또는 PDF · 1개당 20MB 이하 · 최대 {MAX_FILES}개
          </p>

          {files.length > 0 && (
            <ul className="mt-3 space-y-2">
              {files.map((f, i) => (
                <li
                  key={`${f.name}-${i}`}
                  className="flex items-center justify-between gap-3 rounded-lg bg-subtle px-3 py-2 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate">{f.name}</span>
                  <button
                    type="button"
                    onClick={() => setFiles(files.filter((_, j) => j !== i))}
                    className="shrink-0 text-xs font-semibold text-ink-muted underline"
                  >
                    삭제
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-lg bg-status-revision/10 px-3 py-2 text-sm leading-relaxed text-status-revision"
        >
          {error}
        </p>
      )}

      <div className="rounded-xl bg-subtle p-4 text-sm leading-relaxed text-ink-muted">
        제출하시면 <strong>수정할 수 없습니다.</strong> 내용을 바꾸셔야 하는
        경우 담당자에게 문의해 주세요. 제출 시점의 신청서는{' '}
        <strong>PDF 원본으로 보관</strong>되며, 결과는 마이페이지에서 확인하실
        수 있습니다.
      </div>

      <button
        type="submit"
        disabled={busy}
        className="touch-target w-full rounded-xl bg-brand-600 font-bold text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {busy ? step || '제출 중…' : '신청서 제출'}
      </button>
    </form>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-ink-subtle">{label}</dt>
      <dd className="mt-0.5 break-all font-medium">{value || '—'}</dd>
    </div>
  )
}
