'use client'

/**
 * 마이페이지 정산 영역 (D-19 / D-39 / D-108)
 *
 * **선정(approved)된 신청건에만** 나타난다. 미선정·검토 중인 건에는 보이지
 * 않는다 — 아직 지급 대상이 아닌데 서류를 받을 이유가 없다.
 *
 * 🔴 **지급 계좌는 받지 않는다** (D-108 · 09-25). 예전에는 은행·계좌번호·예금주를
 *    받았다. 지금은 **영수증·증빙 파일만**이고, 그래서 **한 장 이상이 필수**다 —
 *    파일 없이 낸 정산은 무엇을 낸 것인지 알 수 없다.
 */

import { useState } from 'react'
import Button from '@/components/ui/Button'
import {
  submitSettlement,
  resubmitSettlement,
  requestSettlementSync,
} from '@/lib/firebase/settlements'
import { fileUrl } from '@/lib/firebase/applications'
import { firestoreErrorMessage } from '@/lib/firebase/errors'
import { SHOW_REVIEW_NOTE_TO_APPLICANT } from '@/lib/config/site'
import {
  SETTLEMENT_STATUS_LABEL,
  type Application,
  type AttachedFile,
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

  const [files, setFiles] = useState<File[]>([])
  const [rejected, setRejected] = useState<{ name: string; why: string }[]>([])
  // 재제출 때 **빼기로 한** 기존 영수증 (09-12). 기본은 전부 남긴다
  const [dropped, setDropped] = useState<Set<string>>(() => new Set())
  const prevReceipts: AttachedFile[] = settlement?.receipts ?? []
  const kept = prevReceipts.filter((r) => !dropped.has(r.storagePath))

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function handleFiles(list: FileList | null, input: HTMLInputElement | null) {
    if (!list || list.length === 0) return
    const accepted = [...files]
    const bad: { name: string; why: string }[] = []

    for (const f of Array.from(list)) {
      // 남기는 기존 영수증도 장수에 포함
      const why = rejectReason(f, kept.length + accepted.length)
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

    /* 한 장 이상 필수 (D-108). 예전에는 선택이었는데(D-41) 그건 계좌가 정산의
       본체였을 때 이야기다. 계좌가 빠지니 파일이 정산의 전부다.
       재제출이면 **남기기로 한 기존 파일도** 센다. */
    if (kept.length + files.length === 0) {
      return setError('영수증이나 증빙 서류를 한 장 이상 올려 주세요.')
    }
    if (rejected.length > 0) {
      return setError(
        '첨부하지 못한 파일이 있습니다. 확인하시거나 [무시하고 계속]을 눌러 주세요.',
      )
    }

    setBusy(true)
    try {
      const input = {
        application,
        uid,
        files,
        keepReceipts: kept,
      }
      let id: string
      if (settlement) {
        await resubmitSettlement(input)
        id = settlement.id
      } else {
        id = await submitSettlement(input)
      }

      // 영수증 → 드라이브, 한 줄 → 시트. 실패해도 제출은 끝난 것이므로 기다리지 않는다 (D-65)
      void requestSettlementSync(id)

      setFiles([])
      setDropped(new Set())
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
      {/* 제목·안내와 버튼을 **한 줄로 묶는다** (09-10).
          예전에는 제목 줄에만 버튼이 있고 안내 문구가 그 아래에 따로 있어서,
          상자는 두 줄 높이인데 **버튼만 위쪽에 붙어** 보였다.
          안내를 왼쪽 칸 안으로 들여 `items-center` 로 묶으면
          버튼이 **상자 가운데 높이**에 온다. */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold">정산</h3>
            {settlement && (
              <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-bold">
                {SETTLEMENT_STATUS_LABEL[settlement.status]}
              </span>
            )}
          </div>

          {/* 한 줄짜리 상태 안내 — 버튼과 같은 높이에서 균형을 잡는다 */}
          {!settlement && !open && (
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              활동비 정산을 위해 <strong>영수증·증빙 서류</strong>를 올려
              주세요. 무엇을 내야 하는지는 프로그램 공고를 확인해 주세요.
            </p>
          )}
          {settlement?.status === 'submitted' && (
            <p className="mt-2 text-sm text-ink-muted">
              제출이 완료되었습니다. 담당자 확인 후 지급됩니다.
            </p>
          )}
          {settlement?.status === 'approved' && (
            <p className="mt-2 text-sm text-ink-muted">
              정산이 승인되었습니다. 지급이 끝나면 이곳에 표시됩니다.
            </p>
          )}
          {settlement?.status === 'paid' && (
            <p className="mt-2 text-sm text-ink-muted">
              {settlement.paidAt?.toDate().toLocaleDateString('ko-KR')}{' '}
              지급되었습니다. 입금이 확인되지 않으면 담당자에게 문의해 주세요.
            </p>
          )}
        </div>

        {editable && !open && (
          <Button onClick={() => setOpen(true)} className="shrink-0">
            {settlement ? '정산 다시 제출' : '정산 제출하기'}
          </Button>
        )}
      </div>

      {/* 담당자 안내 — 반려 사유가 여기 온다.
          **지금은 표시하지 않는다** (D-46). 그래서 반려됐을 때 신청자는
          이유를 화면에서 알 수 없다 — 담당자가 메일·전화로 알려야 한다. */}
      {SHOW_REVIEW_NOTE_TO_APPLICANT && settlement?.reviewNote && (
        <div className="mt-3 rounded-lg bg-surface p-3 text-sm leading-relaxed">
          <p className="font-semibold">담당자 안내</p>
          <p className="mt-1 whitespace-pre-line text-ink-muted">
            {settlement.reviewNote}
          </p>
        </div>
      )}

      {/* 이미 낸 영수증 — 폼이 열리면 폼 안에서 남기기/빼기로 다룬다 */}
      {settlement && settlement.receipts?.length > 0 && !open && (
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

      {/* ── 입력 폼 ────────────────────────────────────── */}
      {open && (
        <form onSubmit={submit} noValidate className="mt-4 space-y-4">
          <div className="rounded-lg bg-surface p-4">
            <p className="text-sm font-bold">
              영수증 · 증빙 서류
              <span className="ml-1 text-status-revision" aria-hidden="true">
                *
              </span>
            </p>
            <p className="mt-1 text-xs leading-relaxed text-ink-subtle">
              영수증과, <strong>회의록처럼 프로그램이 요구한 증빙</strong>을 함께
              올려 주세요. 사진 또는 PDF · 1장당 20MB 이하 · 최대 {MAX_FILES}장.
              <br />
              <strong>한 장 이상 올려야 제출됩니다.</strong> 무엇을 내야 하는지는
              프로그램 공고를 확인해 주세요.
            </p>

            {/* 재제출: 기존 영수증을 보여주고 뺄 수 있게 (09-12) */}
            {prevReceipts.length > 0 && (
              <div className="mt-3 rounded-lg bg-subtle p-3">
                <p className="text-xs font-semibold text-ink-subtle">
                  이미 낸 영수증 {prevReceipts.length}장 —{' '}
                  <strong>그대로 유지됩니다.</strong> 잘못 낸 것은 [삭제]를
                  누르세요
                </p>
                <ul className="mt-2 space-y-1.5 text-sm">
                  {prevReceipts.map((r) => {
                    const off = dropped.has(r.storagePath)
                    return (
                      <li
                        key={r.storagePath}
                        className="flex items-center justify-between gap-3"
                      >
                        <span
                          className={
                            'flex min-w-0 items-center gap-2 ' +
                            (off ? 'line-through opacity-50' : '')
                          }
                        >
                          <ReceiptButton
                            path={r.storagePath}
                            label={r.fileName}
                          />
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const next = new Set(dropped)
                            if (off) next.delete(r.storagePath)
                            else next.add(r.storagePath)
                            setDropped(next)
                          }}
                          className="shrink-0 text-xs font-semibold text-ink-muted underline"
                        >
                          {off ? '되살리기' : '삭제'}
                        </button>
                      </li>
                    )
                  })}
                </ul>
                {dropped.size > 0 && (
                  <p className="mt-2 text-xs text-status-revision">
                    삭제 표시한 {dropped.size}장은 제출할 때 지워집니다.
                  </p>
                )}
              </div>
            )}

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
            <Button type="submit" disabled={busy}>
              {busy ? '제출 중…' : '정산 제출'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setOpen(false)
                setError('')
                setRejected([])
              }}
              disabled={busy}
            >
              취소
            </Button>
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
      className="inline-flex max-w-full items-center rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink-muted transition-colors hover:border-brand-600 hover:bg-brand-soft hover:text-brand-600 disabled:opacity-50"
    >
      <span className="truncate">{busy ? '여는 중…' : label}</span>
    </button>
  )
}
