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
import { firestoreErrorMessage, firebaseErrorKind } from '@/lib/firebase/errors'
import type { Program, SupportUser } from '@/lib/types'

/**
 * 첨부 가능한 형식 — **Storage 규칙과 같은 범위**로 맞춘다.
 *
 * ⚠️ `<input accept>` 는 파일 선택창의 기본 필터일 뿐이다. 사용자가 '모든 파일'로
 *    바꾸면 무엇이든 고를 수 있으므로 **여기서 직접 검사해야** 한다.
 *    검사하지 않으면 Storage 규칙이 거부할 때까지 아무도 모르고, 그때는 이미
 *    PDF 생성과 일부 업로드가 끝난 뒤라 **고아 파일**이 남는다.
 */
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/webp',
  'application/pdf',
]
/** 확장자 대비책 — HEIC 등은 브라우저가 MIME 타입을 비워 보낼 때가 있다 */
const ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'heic', 'heif', 'webp', 'pdf']
const ACCEPT = ALLOWED_TYPES.join(',')
const MAX_BYTES = 20 * 1024 * 1024
const MAX_FILES = 5

/** 거부 사유 — 받아도 되는 파일이면 null */
function rejectReason(f: File, alreadyPicked: number): string | null {
  const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
  if (!ALLOWED_TYPES.includes(f.type) && !ALLOWED_EXT.includes(ext)) {
    return '사진 또는 PDF만 올릴 수 있습니다'
  }
  if (f.size > MAX_BYTES) {
    return `20MB를 넘습니다 (${(f.size / 1024 / 1024).toFixed(1)}MB)`
  }
  if (alreadyPicked >= MAX_FILES) {
    return `첨부는 최대 ${MAX_FILES}개까지입니다`
  }
  return null
}

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
  /**
   * 첨부에서 걸러진 파일들 — 제출 오류(error)와 **따로** 둔다.
   * 같은 상태에 담아두면 제출 버튼을 누르는 순간 지워져서,
   * "경고는 떴는데 그대로 제출되더라"가 된다. (09-05 실제 발생)
   */
  const [rejected, setRejected] = useState<{ name: string; why: string }[]>([])
  /** PDF로 뜰 인쇄본 — 화면 밖에 그려둔다 */
  const sheetRef = useRef<HTMLDivElement>(null)

  const wantsNote = Boolean(program.noteLabel)
  const wantsFiles = Boolean(program.attachmentGuide)

  const consent = (purpose: string) =>
    member.consents.some((c) => c.purpose === purpose && c.agreed)

  /**
   * 고른 파일을 한 개씩 판정한다.
   *
   * 통과한 것만 목록에 넣고, 걸러진 것은 **사유와 함께 화면에 남긴다.**
   * 예전에는 문제가 하나라도 있으면 전부 버리고 경고만 띄웠는데,
   * 그 경고가 제출 시 지워져 **첨부한 줄 알고 제출하는 사고**가 났다.
   */
  function handleFiles(list: FileList | null, input: HTMLInputElement | null) {
    if (!list || list.length === 0) return

    const accepted: File[] = [...files]
    const bad: { name: string; why: string }[] = []

    for (const f of Array.from(list)) {
      const why = rejectReason(f, accepted.length)
      if (why) bad.push({ name: f.name, why })
      else accepted.push(f)
    }

    setFiles(accepted)
    setRejected(bad)
    if (bad.length === 0) setError('')

    // 같은 파일을 다시 고를 수 있도록 입력칸을 비운다.
    // 비우지 않으면 '같은 파일 재선택'이 change 이벤트를 일으키지 않아
    // 사용자가 다시 시도해도 아무 반응이 없다.
    if (input) input.value = ''
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
    // 걸러진 파일이 남아 있으면 제출을 막는다.
    // 그대로 보내면 신청자는 첨부한 줄 알고, 담당자는 서류가 없다고 본다.
    if (rejected.length > 0) {
      setError(
        '첨부하지 못한 파일이 있습니다. 아래 안내를 확인하고 다시 올리시거나, ' +
          '그대로 제출하시려면 [무시하고 계속]을 눌러 주세요.'
      )
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
      // 규칙이 막은 경우 원인은 사실상 둘뿐이다 — 접수 기간이 아니거나,
      // 이미 신청한 프로그램이거나. 일반적인 '권한 없음' 문구를 그대로 보여주면
      // 신청자는 자기가 뭘 잘못했는지 알 수 없다.
      setError(
        firebaseErrorKind(err) === 'permission-denied'
          ? '접수 기간이 아니거나 이미 신청하신 프로그램입니다. ' +
              '화면을 새로고침해 상태를 확인해 주세요.'
          : firestoreErrorMessage(err)
      )
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
            onChange={(e) => handleFiles(e.target.files, e.target)}
            className="mt-4 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-600 file:px-4 file:py-2.5 file:font-semibold file:text-white"
          />
          <p className="mt-2 text-xs text-ink-subtle">
            사진 또는 PDF · 1개당 20MB 이하 · 최대 {MAX_FILES}개
          </p>

          {/* 걸러진 파일 — 제출할 때까지 사라지지 않는다 */}
          {rejected.length > 0 && (
            <div
              role="alert"
              className="mt-3 rounded-xl border border-status-revision/40 bg-status-revision/10 p-3 text-sm"
            >
              <p className="font-bold text-status-revision">
                첨부하지 못한 파일 {rejected.length}개
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
