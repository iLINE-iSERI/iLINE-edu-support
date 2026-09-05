'use client'

/**
 * 담당자 화면 (W3 · D-10)
 *
 * 백오피스가 아니다. 담당자가 사이트에서 해야 하는 **단 하나의 일** —
 * 신청 상태를 바꾸고 사유를 남기는 것 — 만 담는다(D-7).
 * 목록 정리·통계·집계는 구글 시트가 맡는다.
 *
 * 시트에서 상태를 고쳐도 사이트에는 반영되지 않는다. 상태의 원본은 여기다.
 */

import { useCallback, useEffect, useState } from 'react'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import MemberGate from '@/components/auth/MemberGate'
import { useAuth } from '@/components/auth/AuthProvider'
import {
  listAllApplications,
  updateApplicationStatus,
  retrySync,
} from '@/lib/firebase/staff'
import { listPublishedPrograms } from '@/lib/firebase/programs'
import { fileUrl } from '@/lib/firebase/applications'
import { firestoreErrorMessage } from '@/lib/firebase/errors'
import {
  APPLICATION_STATUS_LABEL,
  type Application,
  type ApplicationStatus,
  type Program,
} from '@/lib/types'

const FLOW: ApplicationStatus[] = [
  'submitted',
  'reviewing',
  'revision',
  'approved',
  'rejected',
]

export default function StaffPage() {
  return (
    <MemberGate requireStaff>
      <StaffContent />
    </MemberGate>
  )
}

function StaffContent() {
  const { user } = useAuth()
  const [programs, setPrograms] = useState<Program[]>([])
  const [programId, setProgramId] = useState('')
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | ''>('')
  const [apps, setApps] = useState<Application[] | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      setApps(await listAllApplications(programId || undefined))
    } catch (e) {
      console.error('[iLINE] 신청 목록 조회 실패:', e)
      setError(firestoreErrorMessage(e))
      setApps([])
    }
  }, [programId])

  useEffect(() => {
    listPublishedPrograms().then(setPrograms).catch(() => {})
  }, [])

  useEffect(() => {
    setApps(null)
    load()
  }, [load])

  const shown = (apps ?? []).filter(
    (a) => !statusFilter || a.status === statusFilter
  )

  /** 상태별 건수 — 무엇부터 봐야 하는지 한눈에 */
  const counts = FLOW.map((s) => ({
    status: s,
    n: (apps ?? []).filter((a) => a.status === s).length,
  }))

  return (
    <>
      <PageHeader
        title="신청 관리"
        description="상태를 바꾸고 사유를 남깁니다. 목록 정리와 집계는 구글 스프레드시트에서 하세요."
      />

      <div className="container-page space-y-6 py-8">
        {/* 필터 */}
        <div className="flex flex-wrap gap-3">
          <select
            value={programId}
            onChange={(e) => setProgramId(e.target.value)}
            aria-label="프로그램"
            className="touch-target rounded-xl border border-line-strong bg-surface px-3 text-sm"
          >
            <option value="">전체 프로그램</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as ApplicationStatus | '')
            }
            aria-label="상태"
            className="touch-target rounded-xl border border-line-strong bg-surface px-3 text-sm"
          >
            <option value="">전체 상태</option>
            {FLOW.map((s) => (
              <option key={s} value={s}>
                {APPLICATION_STATUS_LABEL[s]}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={load}
            className="touch-target rounded-xl border border-line-strong px-4 text-sm font-semibold hover:bg-subtle"
          >
            새로고침
          </button>
        </div>

        {/* 상태별 건수 */}
        {apps && apps.length > 0 && (
          <div className="flex flex-wrap gap-2 text-sm">
            {counts.map(({ status, n }) => (
              <span
                key={status}
                className="rounded-full bg-subtle px-3 py-1.5"
              >
                {APPLICATION_STATUS_LABEL[status]}{' '}
                <strong className={n > 0 ? '' : 'text-ink-subtle'}>{n}</strong>
              </span>
            ))}
          </div>
        )}

        {apps === null ? (
          <p className="text-sm text-ink-muted">불러오는 중…</p>
        ) : error ? (
          <EmptyState title="목록을 불러오지 못했습니다" desc={error} />
        ) : shown.length === 0 ? (
          <EmptyState
            title="해당하는 신청이 없습니다"
            desc="필터를 바꾸거나, 접수가 시작되기를 기다려 주세요."
          />
        ) : (
          <ul className="space-y-4">
            {shown.map((a) => (
              <ApplicationRow
                key={a.id}
                app={a}
                reviewerUid={user?.uid || ''}
                onSaved={load}
              />
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

function ApplicationRow({
  app,
  reviewerUid,
  onSaved,
}: {
  app: Application
  reviewerUid: string
  onSaved: () => void
}) {
  const [status, setStatus] = useState<ApplicationStatus>(app.status)
  const [note, setNote] = useState(app.reviewNote || '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const dirty = status !== app.status || note !== (app.reviewNote || '')

  async function save() {
    setBusy(true)
    setMsg('')
    try {
      await updateApplicationStatus(app.id, status, note, reviewerUid)
      setMsg('저장했습니다.')
      onSaved()
    } catch (e) {
      console.error('[iLINE] 상태 변경 실패:', e)
      setMsg(firestoreErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const ap = app.applicant

  return (
    <li className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-subtle px-2.5 py-1 text-xs font-bold">
          {APPLICATION_STATUS_LABEL[app.status]}
        </span>
        <span className="text-xs text-ink-subtle">
          {app.submittedAt?.toDate().toLocaleString('ko-KR')} 제출
        </span>
      </div>

      <p className="mt-2 font-bold">{app.programTitle || app.programId}</p>

      {/* 신청자 — 제출 시점 스냅샷이다. 현재 회원 정보와 다를 수 있다 */}
      {ap && (
        <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          <Item k="이름" v={ap.name} />
          <Item k="학번" v={ap.studentId} />
          <Item k="전공 · 학년" v={`${ap.major} · ${ap.grade}`} />
          <Item k="연락처" v={ap.phone} />
          <Item k="이메일" v={ap.email} />
          <Item
            k="동의 (개인정보 / 초상권)"
            v={`${ap.personalInfoConsent ? 'O' : 'X'} / ${
              ap.portraitConsent ? 'O' : 'X'
            }`}
          />
        </dl>
      )}

      {app.note && (
        <div className="mt-3 rounded-lg bg-subtle p-3 text-sm leading-relaxed">
          <p className="font-semibold">{app.noteLabel || '추가 기재'}</p>
          <p className="mt-1 whitespace-pre-line text-ink-muted">{app.note}</p>
        </div>
      )}

      {/* 파일 — Storage 규칙은 Custom Claims 로 담당자를 판별한다.
          Claims 가 없으면 여기서 열기를 눌러도 실패한다 (docs/08-staff-setup.md) */}
      <div className="mt-3 flex flex-wrap gap-2">
        {app.generatedPdfPath && (
          <FileButton path={app.generatedPdfPath} label="신청서 PDF" />
        )}
        {app.files?.map((f) => (
          <FileButton key={f.storagePath} path={f.storagePath} label={f.fileName} />
        ))}
      </div>

      {/* 시트 동기화 상태 — 담당자가 "왜 시트에 없지?"를 여기서 알 수 있게 */}
      {app.driveSyncError ? (
        <div className="mt-3 rounded-lg bg-status-revision/10 px-3 py-2 text-xs leading-relaxed text-status-revision">
          <p>
            <strong>구글 시트 반영 실패</strong> — {app.driveSyncError}
          </p>
          <p className="mt-1">
            신청 자체는 정상 접수되었습니다. 설정은 docs/11-sheet-drive-setup.md 참고.
          </p>
          <SyncRetry id={app.id} onDone={onSaved} />
        </div>
      ) : app.sheetSyncedAt ? (
        <p className="mt-3 text-xs text-ink-subtle">
          구글 시트 반영 완료
          {app.driveFolderUrl && (
            <>
              {' · '}
              <a
                href={app.driveFolderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
              >
                드라이브에서 열기
              </a>
            </>
          )}
        </p>
      ) : null}

      {/* ── 상태 변경 ─────────────────────────────────────── */}
      <div className="mt-4 border-t border-line pt-4">
        <div className="flex flex-wrap gap-2">
          {FLOW.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={
                'rounded-lg border px-3 py-2 text-sm font-semibold ' +
                (status === s
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-line hover:bg-subtle')
              }
            >
              {APPLICATION_STATUS_LABEL[s]}
            </button>
          ))}
        </div>

        <label htmlFor={`note-${app.id}`} className="mt-3 block text-sm font-semibold">
          사유 · 안내 문구
        </label>
        <p className="text-xs text-ink-subtle">
          여기 쓰신 내용이 <strong>신청자 마이페이지에 그대로 보입니다.</strong>
        </p>
        <textarea
          id={`note-${app.id}`}
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="보완 요청 사유나 안내 사항을 적어 주세요. 비워두면 표시되지 않습니다."
          className="mt-2 w-full rounded-xl border border-line-strong bg-surface p-3 text-base leading-relaxed outline-none focus:border-brand-600"
        />

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={!dirty || busy}
            className="touch-target rounded-xl bg-brand-600 px-6 font-bold text-white hover:bg-brand-700 disabled:opacity-40"
          >
            {busy ? '저장 중…' : '변경 저장'}
          </button>
          {msg && <span className="text-sm text-ink-muted">{msg}</span>}
        </div>
      </div>
    </li>
  )
}

/** 설정을 고친 뒤 이미 들어온 건을 다시 올릴 때 (신청서 재제출 없이) */
function SyncRetry({ id, onDone }: { id: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function run() {
    setBusy(true)
    setMsg('')
    try {
      await retrySync(id)
      setMsg('반영했습니다.')
      onDone()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className="mt-2 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="rounded-md border border-status-revision/50 px-3 py-1.5 font-semibold disabled:opacity-50"
      >
        {busy ? '다시 시도 중…' : '다시 시도'}
      </button>
      {msg && <span className="text-ink-muted">{msg}</span>}
    </span>
  )
}

function Item({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-ink-subtle">{k}</dt>
      <dd className="min-w-0 break-all font-medium">{v || '—'}</dd>
    </div>
  )
}

function FileButton({ path, label }: { path: string; label: string }) {
  const [busy, setBusy] = useState(false)

  async function open() {
    setBusy(true)
    try {
      window.open(await fileUrl(path), '_blank', 'noopener')
    } catch (e) {
      console.error('[iLINE] 파일 열기 실패:', e)
      alert(
        '파일을 열 수 없습니다. 담당자 계정에 Storage 권한(Custom Claims)이 부여되었는지 확인해 주세요. docs/08-staff-setup.md 참고.'
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={open}
      disabled={busy}
      title={label}
      className="inline-flex max-w-full items-center rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink-muted hover:bg-subtle disabled:opacity-50"
    >
      <span className="truncate">{busy ? '여는 중…' : label}</span>
    </button>
  )
}
