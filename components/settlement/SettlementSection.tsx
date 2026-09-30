'use client'

/**
 * 마이페이지 정산 영역 (D-19 / D-39 / D-108 / D-117)
 *
 * **선정(approved)된 신청건에만** 나타난다. 미선정·검토 중인 건에는 보이지
 * 않는다 — 아직 지급 대상이 아닌데 서류를 받을 이유가 없다.
 *
 * D-117 (09-30) — **정산은 여러 번 낸다.** 비용이 생길 때마다 증빙서류를 올려 청구한다.
 *   · 회차 목록(1차·2차…) + [새 정산 제출하기]. 앞 회차가 처리 중이어도 새 회차를 낼 수 있다
 *   · 반려된 회차만 [다시 제출] — 그 회차의 파일을 남기거나 빼고 더한다
 *   · D-118 (09-30): 「제출 완료」 회차도 [고치기] — 담당자가 「확인 완료」를 누르기 전까지.
 *     버튼에는 회차를 붙이지 않는다(iSERI — 줄 맨 앞에 이미 「1차」가 있다)
 *     담당자가 보완을 요청하면 반려 없이 학생이 바로 고친다. 담당자 카드에는 「수정됨」
 *   · 증빙서류는 공고가 정한 **종류마다** 올리는 칸이 따로 있다(`settlementDocsOf`). 「필수」 종류가
 *     비면 제출이 막힌다. 공고에 종류가 없으면 「증빙서류」 한 칸
 *
 * 🔴 **지급 계좌는 받지 않는다** (D-108). **증빙서류 한 장 이상이 필수**다 — 규칙도 막는다(D-117).
 */

import { useState } from 'react'
import Button from '@/components/ui/Button'
import {
  submitSettlement,
  resubmitSettlement,
  requestSettlementSync,
  nextSettlementRound,
} from '@/lib/firebase/settlements'
import { fileUrl } from '@/lib/firebase/applications'
import { actionErrorMessage, firebaseErrorKind } from '@/lib/firebase/errors'
import { SHOW_REVIEW_NOTE_TO_APPLICANT } from '@/lib/config/site'
import {
  SETTLEMENT_STATUS_LABEL,
  canEditSettlement,
  settlementDocsOf,
  settlementDocSummary,
  settlementRoundOf,
  type Application,
  type AttachedFile,
  type Program,
  type Settlement,
  type SettlementDocKind,
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
/** 한 번 낼 때 모든 종류를 합친 최대 장수 */
const MAX_FILES = 10

function rejectReason(f: File, picked: number): string | null {
  const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
  if (!ALLOWED_TYPES.includes(f.type) && !ALLOWED_EXT.includes(ext)) {
    return '사진 또는 PDF만 올릴 수 있습니다'
  }
  if (f.size > MAX_BYTES) {
    return `20MB를 넘습니다 (${(f.size / 1024 / 1024).toFixed(1)}MB)`
  }
  if (picked >= MAX_FILES) return `한 번에 최대 ${MAX_FILES}장까지입니다`
  return null
}

/** 이 파일이 어느 종류 칸에 속하나 — 종류가 없는 옛 파일(D-117 이전)은 첫 칸으로 */
function kindIdOf(f: AttachedFile, kinds: SettlementDocKind[]): string {
  return f.docKind && kinds.some((k) => k.id === f.docKind) ? f.docKind : kinds[0].id
}

const STATUS_TEXT: Partial<Record<Settlement['status'], string>> = {
  submitted: '담당자가 확인한 뒤 지급됩니다. 확인 전까지는 [고치기]로 파일을 바꾸거나 더할 수 있습니다.',
  approved: '담당자가 확인했습니다. 지급이 끝나면 여기에 표시됩니다.',
}

export default function SettlementSection({
  application,
  settlements,
  program,
  uid,
  onDone,
}: {
  application: Application
  /** 이 신청 건의 정산 전부 (회차 순서는 여기서 정렬) */
  settlements: Settlement[]
  /** 증빙서류 종류를 알려고 — 없으면 기본 한 칸 */
  program: Program | null
  uid: string
  onDone: () => void
}) {
  const kinds = settlementDocsOf(program)
  const sorted = [...settlements].sort((a, b) => settlementRoundOf(a) - settlementRoundOf(b))
  /** 열린 폼 — 새 회차 · 반려된 회차 다시 내기 */
  const [mode, setMode] = useState<null | { round: number; settlement?: Settlement }>(null)

  return (
    <div className="mt-4 rounded-xl border border-line bg-subtle p-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold">
            정산{sorted.length > 0 && <span className="ml-1 font-normal text-ink-subtle">· {sorted.length}건</span>}
          </h3>
          {sorted.length === 0 && !mode && (
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              활동비가 생길 때마다 <strong>증빙서류</strong>를 올려 정산을 청구합니다. 여러 번 낼 수 있습니다.
              무엇을 내야 하는지는 프로그램 공고를 확인해 주세요.
            </p>
          )}
        </div>
        {!mode && (
          <Button
            onClick={() => setMode({ round: nextSettlementRound(settlements, application.id) })}
            className="shrink-0"
          >
            {sorted.length === 0 ? '정산 제출하기' : '새 정산 제출하기'}
          </Button>
        )}
      </div>

      {/* 회차 목록 */}
      {sorted.length > 0 && (
        <ul className="mt-3 space-y-2">
          {sorted.map((s) => (
            <li key={s.id} className="rounded-lg bg-surface p-3 text-sm">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <strong>{settlementRoundOf(s)}차</strong>
                <span className="rounded-full bg-subtle px-2.5 py-0.5 text-xs font-bold">
                  {SETTLEMENT_STATUS_LABEL[s.status]}
                </span>
                <span className="text-xs text-ink-subtle">
                  {s.submittedAt?.toDate().toLocaleDateString('ko-KR')} 제출 · {settlementDocSummary(s.receipts)}
                </span>
                {/* 반려 → 다시 제출 · 제출 완료 → 고치기 (D-118). 확인 완료·지급 완료 뒤에는 없다 */}
                {canEditSettlement(s) && !mode && (
                  <Button
                    variant="secondary"
                    className="ml-auto"
                    onClick={() => setMode({ round: settlementRoundOf(s), settlement: s })}
                  >
                    {s.status === 'submitted' ? '고치기' : '다시 제출'}
                  </Button>
                )}
              </div>
              {STATUS_TEXT[s.status] && (
                <p className="mt-1 text-xs text-ink-muted">{STATUS_TEXT[s.status]}</p>
              )}
              {s.status === 'paid' && (
                <p className="mt-1 text-xs text-ink-muted">
                  {s.paidAt?.toDate().toLocaleDateString('ko-KR')} 지급되었습니다. 입금이 확인되지 않으면 담당자에게
                  문의해 주세요.
                </p>
              )}
              {s.status === 'rejected' && (
                <p className="mt-1 text-xs text-status-revision">
                  반려되었습니다. 담당자 안내에 따라 이 회차를 고쳐 다시 제출해 주세요.
                </p>
              )}
              {/* 담당자 안내 — 지금은 표시하지 않는다(D-46). 반려 이유는 담당자가 따로 알린다 */}
              {SHOW_REVIEW_NOTE_TO_APPLICANT && s.reviewNote && (
                <p className="mt-1 whitespace-pre-line text-xs text-ink-muted">담당자 안내: {s.reviewNote}</p>
              )}
              {s.receipts?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {s.receipts.map((r) => (
                    <FileButton key={r.storagePath} path={r.storagePath} label={r.fileName} tag={r.docLabel} />
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {mode && (
        <SettlementForm
          application={application}
          uid={uid}
          kinds={kinds}
          round={mode.round}
          settlement={mode.settlement}
          onCancel={() => setMode(null)}
          onDone={() => {
            setMode(null)
            onDone()
          }}
        />
      )}
    </div>
  )
}

/** 한 회차 제출 폼 — 새 회차 또는 반려된 회차 다시 내기 */
function SettlementForm({
  application,
  uid,
  kinds,
  round,
  settlement,
  onCancel,
  onDone,
}: {
  application: Application
  uid: string
  kinds: SettlementDocKind[]
  round: number
  /** 있으면 다시 내기 */
  settlement?: Settlement
  onCancel: () => void
  onDone: () => void
}) {
  /** 종류 id → 새로 고른 파일 */
  const [picked, setPicked] = useState<Record<string, File[]>>({})
  const [rejected, setRejected] = useState<{ name: string; why: string }[]>([])
  /** 다시 낼 때 빼기로 한 기존 파일 */
  const [dropped, setDropped] = useState<Set<string>>(() => new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  /** 제출 완료 회차 고치기(D-118) — 반려 뒤 다시 내기와 문구만 다르다 */
  const editing = settlement?.status === 'submitted'
  const verb = !settlement ? '제출' : editing ? '고치기' : '다시 제출'
  const prev: AttachedFile[] = settlement?.receipts ?? []
  const kept = prev.filter((r) => !dropped.has(r.storagePath))
  const pickedCount = Object.values(picked).reduce((n, list) => n + list.length, 0)

  function handleFiles(kind: SettlementDocKind, list: FileList | null, input: HTMLInputElement | null) {
    if (!list || list.length === 0) return
    const mine = [...(picked[kind.id] ?? [])]
    let total = kept.length + pickedCount
    const bad: { name: string; why: string }[] = []
    for (const f of Array.from(list)) {
      const why = rejectReason(f, total)
      if (why) bad.push({ name: `${kind.label} · ${f.name}`, why })
      else {
        mine.push(f)
        total++
      }
    }
    setPicked({ ...picked, [kind.id]: mine })
    setRejected(bad)
    if (bad.length === 0) setError('')
    if (input) input.value = ''
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    // 필수 종류마다 한 장 이상 — 남긴 옛 파일도 센다
    const missing = kinds.filter(
      (k) =>
        k.required &&
        kept.filter((r) => kindIdOf(r, kinds) === k.id).length + (picked[k.id]?.length ?? 0) === 0
    )
    if (missing.length > 0) {
      return setError(`${missing.map((k) => k.label).join(' · ')}을(를) 한 장 이상 올려 주세요.`)
    }
    if (kept.length + pickedCount === 0) {
      return setError('증빙서류를 한 장 이상 올려 주세요.')
    }
    if (rejected.length > 0) {
      return setError('첨부하지 못한 파일이 있습니다. 확인하시거나 [무시하고 계속]을 눌러 주세요.')
    }

    setBusy(true)
    try {
      const files = kinds.flatMap((k) => (picked[k.id] ?? []).map((file) => ({ file, kind: k })))
      let id: string
      if (settlement) {
        await resubmitSettlement(settlement, { application, uid, files, keepReceipts: kept })
        id = settlement.id
      } else {
        id = await submitSettlement({ application, uid, files, round })
      }
      // 증빙서류 → 드라이브, 한 줄 → 시트. 실패해도 제출은 끝난 것이라 기다리지 않는다 (D-65)
      void requestSettlementSync(id)
      onDone()
    } catch (err) {
      console.error('[iLINE] 정산 제출 실패:', err)
      setError(
        firebaseErrorKind(err) === 'permission-denied'
          ? settlement
            ? // 고치는 사이 담당자가 확인 완료한 경우(D-118) — 규칙이 막는다
              `담당자가 방금 ${round}차 정산 확인을 마쳤을 수 있습니다. 화면을 새로고침해 확인해 주세요.`
            : // 같은 회차가 이미 들어간 경우(탭 두 개 등) — 번호가 겹쳐 막힌다(D-117)
              `${round}차 정산을 이미 내셨을 수 있습니다. 화면을 새로고침해 확인해 주세요.`
          : actionErrorMessage(err)
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="mt-4 space-y-4 rounded-lg bg-surface p-4">
      <div>
        <p className="text-sm font-bold">
          {round}차 정산 {verb}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-ink-subtle">
          사진 또는 PDF · 1장당 20MB 이하 · 한 번에 최대 {MAX_FILES}장. 이 회차에 쓴 비용의 증빙을 올려 주세요.
          다른 날 쓴 비용은 나중에 <strong>새 정산</strong>으로 따로 내시면 됩니다.
        </p>
        {editing && (
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">
            이미 낸 파일을 빼거나 새 파일을 더할 수 있습니다. 고치면 담당자 화면에 <strong>「수정됨」</strong>으로
            보입니다. 담당자가 「확인 완료」를 누른 뒤에는 고칠 수 없습니다.
          </p>
        )}
      </div>

      {kinds.map((k) => {
        const mineNew = picked[k.id] ?? []
        const minePrev = prev.filter((r) => kindIdOf(r, kinds) === k.id)
        return (
          <div key={k.id} className="rounded-lg border border-line p-3">
            <p className="text-sm font-semibold">
              {k.label}
              {k.required ? (
                <span className="ml-1 text-status-revision" aria-hidden="true">*</span>
              ) : (
                <span className="ml-1 text-xs font-normal text-ink-subtle">(선택)</span>
              )}
            </p>

            {minePrev.length > 0 && (
              <ul className="mt-2 space-y-1.5 text-sm">
                {minePrev.map((r) => {
                  const off = dropped.has(r.storagePath)
                  return (
                    <li key={r.storagePath} className="flex items-center justify-between gap-3">
                      <span className={'min-w-0 ' + (off ? 'line-through opacity-50' : '')}>
                        <FileButton path={r.storagePath} label={r.fileName} />
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
            )}

            <input
              type="file"
              multiple
              accept={ALLOWED_TYPES.join(',')}
              aria-label={`${k.label} 파일 고르기`}
              onChange={(e) => handleFiles(k, e.target.files, e.target)}
              className="mt-2 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-600 file:px-4 file:py-2 file:font-semibold file:text-white"
            />
            {mineNew.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {mineNew.map((f, i) => (
                  <li
                    key={`${f.name}-${i}`}
                    className="flex items-center justify-between gap-3 rounded-lg bg-subtle px-3 py-1.5 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate">{f.name}</span>
                    <button
                      type="button"
                      onClick={() => setPicked({ ...picked, [k.id]: mineNew.filter((_, j) => j !== i) })}
                      className="shrink-0 text-xs font-semibold text-ink-muted underline"
                    >
                      삭제
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}

      {dropped.size > 0 && (
        <p className="text-xs text-status-revision">삭제 표시한 {dropped.size}장은 제출할 때 지워집니다.</p>
      )}

      {rejected.length > 0 && (
        <div role="alert" className="rounded-xl border border-status-revision/40 bg-status-revision/10 p-3 text-sm">
          <p className="font-bold text-status-revision">첨부하지 못한 파일 {rejected.length}개</p>
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

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy}>
          {busy ? '제출 중…' : editing ? '고친 내용 제출' : `${round}차 정산 ${verb}`}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
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

function FileButton({ path, label, tag }: { path: string; label: string; tag?: string }) {
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
          console.error('[iLINE] 증빙서류 열기 실패:', e)
          alert('파일을 여는 데 실패했습니다.')
        } finally {
          setBusy(false)
        }
      }}
      className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink-muted transition-colors hover:border-brand-600 hover:bg-brand-soft hover:text-brand-600 disabled:opacity-50"
    >
      {tag && <span className="shrink-0 rounded bg-subtle px-1.5 py-0.5 text-[10px] font-bold">{tag}</span>}
      <span className="truncate">{busy ? '여는 중…' : label}</span>
    </button>
  )
}
