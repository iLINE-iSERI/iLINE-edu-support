'use client'

/**
 * 마이페이지 정산 영역 (D-19 / D-39)
 *
 * **선정(approved)된 신청건에만** 나타난다. 미선정·검토 중인 건에는 보이지
 * 않는다 — 아직 지급 대상이 아닌데 계좌를 입력받으면, 쓸 일 없는 계좌를
 * 보유하게 된다(D-38의 '정산 단계에 받는다'는 판단이 여기서 실현된다).
 */

import { useEffect, useState } from 'react'
import {
  submitSettlement,
  resubmitSettlement,
} from '@/lib/firebase/settlements'
import { fileUrl } from '@/lib/firebase/applications'
import { firestoreErrorMessage } from '@/lib/firebase/errors'
import { getProgram } from '@/lib/firebase/programs'
import {
  SETTLEMENT_STATUS_LABEL,
  type Application,
  type Program,
  type Settlement,
} from '@/lib/types'

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/webp',
  'application/pdf',
]
const ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'heic', 'heif', 'webp', 'pdf']
const MAX_BYTES = 20 * 1024 * 1024
const MAX_FILES = 10

function rejectReason(f: File, picked: number): string | null {
  const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
  if (!ALLOWED_TYPES.includes(f.type) && !ALLOWED_EXT.includes(ext)) {
    return '사진 또는 PDF만 올릴 수 있습니다'
  }
  if (f.size > MAX_BYTES) {
    return `20MB를 넘습니다 (${(f.size / 1024 / 1024).toFixed(1)}MB)`
  }
  if (picked >= MAX_FILES) return `영수증은 최대 ${MAX_FILES}장까지입니다`
  return null
}

export default function SettlementSection({
  application,
  settlement,
  uid,
  onDone,
}: {
  application: Application
  settlement: Settlement | null
  uid: string
  onDone: () => void
}) {
  const editable = !settlement || settlement.status === 'rejected'
  const [open, setOpen] = useState(false)

  const [bankName, setBankName] = useState(settlement?.bankInfo?.bankName ?? '')
  const [accountNumber, setAccountNumber] = useState(
    settlement?.bankInfo?.accountNumber ?? ''
  )
  const [accountHolder, setAccountHolder] = useState(
    settlement?.bankInfo?.accountHolder ?? ''
  )
  const [files, setFiles] = useState<File[]>([])
  const [rejected, setRejected] = useState<{ name: string; why: string }[]>([])

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  /**
   * 정산 구성은 **프로그램이 정한다** (D-41).
   * 영수증이 필요한 프로그램도, 계좌만 받으면 되는 프로그램도 있어서
   * 폼에 고정하지 않는다 — 신청서에서와 같은 판단(D-29).
   *
   * 조회에 실패하거나 값이 없으면 **필수로 본다.** 증빙 없이 지급되는 쪽이
   * 더 위험하므로, 모를 때는 받는 쪽으로 기운다.
   */
  const [program, setProgram] = useState<Program | null>(null)
  useEffect(() => {
    getProgram(application.programId)
      .then(setProgram)
      .catch((e) => console.warn('[iLINE] 프로그램 조회 실패:', e))
  }, [application.programId])

  const receiptRequired = program?.settlementReceiptRequired !== false

  function handleFiles(list: FileList | null, input: HTMLInputElement | null) {
    if (!list || list.length === 0) return
    const accepted = [...files]
    const bad: { name: string; why: string }[] = []

    for (const f of Array.from(list)) {
      const why = rejectReason(f, accepted.length)
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

    if (!bankName.trim()) return setError('은행 이름을 입력해 주세요.')
    if (!accountNumber.trim()) return setError('계좌번호를 입력해 주세요.')
    if (!accountHolder.trim()) return setError('예금주를 입력해 주세요.')

    const already = settlement?.receipts?.length ?? 0
    if (receiptRequired && files.length === 0 && already === 0) {
      return setError('영수증을 1장 이상 첨부해 주세요.')
    }
    if (rejected.length > 0) {
      return setError(
        '첨부하지 못한 파일이 있습니다. 확인하시거나 [무시하고 계속]을 눌러 주세요.'
      )
    }

    setBusy(true)
    try {
      const input = {
        application,
        uid,
        bankName,
        accountNumber,
        accountHolder,
        files,
      }
      if (settlement) await resubmitSettlement(input)
      else await submitSettlement(input)

      setFiles([])
      setOpen(false)
      onDone()
    } catch (err) {
      console.error('[iLINE] 정산 제출 실패:', err)
      setError(firestoreErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-line bg-subtle p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-bold">정산</h3>
          {settlement && (
            <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-bold">
              {SETTLEMENT_STATUS_LABEL[settlement.status]}
            </span>
          )}
        </div>

        {editable && !open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="touch-target inline-flex items-center justify-center rounded-xl bg-brand-600 px-5 text-sm font-bold text-white hover:bg-brand-700"
          >
            {settlement ? '정산 다시 제출' : '정산 제출하기'}
          </button>
        )}
      </div>

      {/* 담당자 안내 — 반려 사유가 여기 온다 */}
      {settlement?.reviewNote && (
        <div className="mt-3 rounded-lg bg-surface p-3 text-sm leading-relaxed">
          <p className="font-semibold">담당자 안내</p>
          <p className="mt-1 whitespace-pre-line text-ink-muted">
            {settlement.reviewNote}
          </p>
        </div>
      )}

      {/* 이미 낸 영수증 */}
      {settlement && settlement.receipts?.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold text-ink-subtle">
            제출한 영수증 {settlement.receipts.length}장
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {settlement.receipts.map((r) => (
              <ReceiptButton
                key={r.storagePath}
                path={r.storagePath}
                label={r.fileName}
              />
            ))}
          </div>
        </div>
      )}

      {!settlement && !open && (
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          활동비 지급을 위해 <strong>지급 계좌</strong>
          {receiptRequired ? (
            <>
              와 <strong>영수증</strong>을 제출해 주세요.
            </>
          ) : (
            <> 정보를 입력해 주세요. 영수증은 선택입니다.</>
          )}
        </p>
      )}

      {settlement?.status === 'submitted' && (
        <p className="mt-2 text-sm text-ink-muted">
          제출이 완료되었습니다. 담당자 확인 후 지급됩니다.
        </p>
      )}
      {settlement?.status === 'approved' && (
        <p className="mt-2 text-sm text-ink-muted">
          정산이 승인되었습니다.
        </p>
      )}

      {/* ── 입력 폼 ────────────────────────────────────── */}
      {open && (
        <form onSubmit={submit} noValidate className="mt-4 space-y-4">
          <div className="rounded-lg bg-surface p-4">
            <p className="text-sm font-bold">지급 계좌</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-subtle">
              본인 명의 계좌만 입력해 주세요. 계좌 정보는{' '}
              <strong>담당자만</strong> 볼 수 있고, 구글 시트나 드라이브로
              나가지 않습니다.
            </p>

            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="text-xs font-semibold">은행</span>
                <input
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="농협"
                  className={INPUT}
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs font-semibold">계좌번호</span>
                <input
                  inputMode="numeric"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="- 없이 숫자만"
                  className={INPUT}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold">예금주</span>
                <input
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value)}
                  className={INPUT}
                />
              </label>
            </div>
          </div>

          <div className="rounded-lg bg-surface p-4">
            <p className="text-sm font-bold">
              영수증
              {!receiptRequired && (
                <span className="ml-1.5 text-xs font-semibold text-ink-subtle">
                  (선택)
                </span>
              )}
            </p>
            <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-ink-subtle">
              {program?.settlementGuide ||
                '지출 증빙을 촬영하거나 PDF로 첨부해 주세요.'}
              {'\n'}사진 또는 PDF · 1장당 20MB 이하 · 최대 {MAX_FILES}장
              {!receiptRequired && ' · 이 프로그램은 영수증 없이도 제출됩니다'}
            </p>

            <input
              type="file"
              multiple
              accept={ALLOWED_TYPES.join(',')}
              onChange={(e) => handleFiles(e.target.files, e.target)}
              className="mt-3 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-600 file:px-4 file:py-2.5 file:font-semibold file:text-white"
            />

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
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={busy}
              className="touch-target inline-flex items-center justify-center rounded-xl bg-brand-600 px-6 font-bold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {busy ? '제출 중…' : '정산 제출'}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setError('')
                setRejected([])
              }}
              disabled={busy}
              className="touch-target inline-flex items-center justify-center rounded-xl border border-line-strong px-6 font-semibold disabled:opacity-50"
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
    </div>
  )
}

const INPUT =
  'mt-1.5 w-full rounded-xl border border-line-strong bg-surface p-3 text-base outline-none focus:border-brand-600'

function ReceiptButton({ path, label }: { path: string; label: string }) {
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
          console.error('[iLINE] 영수증 열기 실패:', e)
          alert('파일을 여는 데 실패했습니다.')
        } finally {
          setBusy(false)
        }
      }}
      className="inline-flex max-w-full items-center rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink-muted hover:bg-surface disabled:opacity-50"
    >
      <span className="truncate">{busy ? '여는 중…' : label}</span>
    </button>
  )
}
