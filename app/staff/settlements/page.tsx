'use client'

/**
 * 담당자 정산 관리 (Phase 6 · D-39)
 *
 * 🔴 **지급 계좌는 받지 않는다** (D-108 · 09-25). 예전에는 이 화면에 계좌가
 *    나왔고(누를 때만 펼침), 시트·드라이브로는 내보내지 않았다(D-38).
 *    지금은 **증빙서류 파일만** 확인한다.
 *
 * 금액 칸은 없다(09-06 확정). 담당자가 영수증을 열어 읽고 합산한다.
 *
 * D-117 (09-30) — 신청 1건에 정산이 **여러 번** 온다(1차·2차 …).
 *   · 「한 건씩」: 들어온 순서대로. 「팀별로」: 프로그램 → 팀(개인 프로그램이면 사람)으로 묶어 본다
 *   · 회차는 **사람마다** 센다 — 팀 묶음은 보기용이다(대표자 1차 ≠ 팀 1차)
 *   · 「승인」은 「확인 완료」로 부른다(저장값은 그대로 approved)
 *
 * D-118 (09-30) — 학생이 「제출 완료」 회차를 **확인 완료 전까지** 고칠 수 있다.
 *   · 고친 건은 「수정됨 · 시각 · n회」 — 보완을 요청했다면 이것으로 들어온 것을 안다(반려하지 않아도 된다)
 *   · 확인 완료·반려는 화면에 떠 있던 상태·고친 횟수와 문서가 같을 때만 저장된다 — 보지 못한 파일을 확인 완료하지 않게
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import Badge from '@/components/ui/Badge'
import MemberGate from '@/components/auth/MemberGate'
import { useAuth } from '@/components/auth/AuthProvider'
import { useTestView } from '@/components/staff/TestView'
import {
  listAllSettlements,
  reviewSettlement,
  markSettlementPaid,
  requestSettlementSync,
  retrySettlementSync,
} from '@/lib/firebase/settlements'
import { listAllApplications, listAllPrograms } from '@/lib/firebase/staff'
import { toYmd } from '@/lib/reservations/window'
import { fileUrl } from '@/lib/firebase/applications'
import { firestoreErrorMessage, actionErrorMessage, UserFacingError } from '@/lib/firebase/errors'
import { SHOW_REVIEW_NOTE_TO_APPLICANT } from '@/lib/config/site'
import {
  DEFAULT_SETTLEMENT_DOC,
  SETTLEMENT_STATUS_LABEL,
  settlementDocSummary,
  settlementRoundOf,
  teamNameOf,
  type Application,
  type AttachedFile,
  type Program,
  type Settlement,
  type SettlementStatus,
} from '@/lib/types'

const FILTERS: SettlementStatus[] = [
  'submitted',
  'approved',
  'paid',
  'rejected',
  'draft',
]

type View = 'each' | 'team'

/** 팀별 보기의 한 묶음 — 팀 프로그램이면 팀, 개인 프로그램(또는 팀명 없음)이면 사람 */
interface Group {
  key: string
  programTitle: string
  label: string
  isTeam: boolean
  people: string[]
  rows: Settlement[]
}

export default function StaffSettlementsPage() {
  return (
    <MemberGate requireStaff>
      <StaffSettlementsContent />
    </MemberGate>
  )
}

function StaffSettlementsContent() {
  const { user } = useAuth()
  const [rawRows, setRows] = useState<Settlement[] | null>(null)
  // D-124: 「시험 데이터」 스위치가 꺼져 있으면 테스트 계정 정산을 목록·건수·팀 묶음에서 뺀다
  const { visible } = useTestView()
  const rows = useMemo(() => (rawRows === null ? null : visible(rawRows)), [rawRows, visible])
  const [programs, setPrograms] = useState<Program[]>([])
  const [apps, setApps] = useState<Map<string, Application>>(new Map())
  const [filter, setFilter] = useState<SettlementStatus | ''>('')
  const [programId, setProgramId] = useState('')
  const [view, setView] = useState<View>('each')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      // 팀명은 신청서에서 읽는다(teamNameOf) — 정산 문서에는 팀명이 없다.
      // 제출하는 브라우저가 적은 팀명을 믿지 않으려는 것(보안 점검 08 B)
      const [settlements, programList, applications] = await Promise.all([
        listAllSettlements(),
        listAllPrograms(),
        listAllApplications(),
      ])
      setRows(settlements)
      setPrograms(programList)
      setApps(new Map(applications.map((a) => [a.id, a])))
    } catch (e) {
      console.error('[iLINE] 정산 목록 조회 실패:', e)
      setError(firestoreErrorMessage(e))
      setRows([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const programOf = useCallback(
    (id: string) => programs.find((p) => p.id === id) ?? null,
    [programs]
  )
  const teamOf = useCallback(
    (s: Settlement) => teamNameOf(apps.get(s.applicationId), programOf(s.programId)),
    [apps, programOf]
  )

  // 정산이 들어온 프로그램만 고를 수 있게
  const programOptions = useMemo(() => {
    const seen = new Map<string, string>()
    for (const s of rows ?? []) {
      if (!seen.has(s.programId)) {
        seen.set(s.programId, programOf(s.programId)?.title || s.programTitle || s.programId)
      }
    }
    return Array.from(seen.entries())
  }, [rows, programOf])

  const inProgram = (rows ?? []).filter((s) => !programId || s.programId === programId)
  const shown = inProgram.filter((s) => !filter || s.status === filter)
  const count = (st: SettlementStatus) => inProgram.filter((r) => r.status === st).length

  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group>()
    for (const s of shown) {
      const team = teamOf(s)
      const key = `${s.programId}::${team ? `team:${team}` : `uid:${s.uid}`}`
      let g = map.get(key)
      if (!g) {
        g = {
          key,
          programTitle: programOf(s.programId)?.title || s.programTitle || s.programId,
          label: team ? `${team} 팀` : s.applicantName || '이름없음',
          isTeam: Boolean(team),
          people: [],
          rows: [],
        }
        map.set(key, g)
      }
      g.rows.push(s)
      const name = s.applicantName || '이름없음'
      if (!g.people.includes(name)) g.people.push(name)
    }
    const list = Array.from(map.values())
    // 묶음 안: 사람 → 회차 순. 묶음끼리: 프로그램 → 이름 순
    for (const g of list) {
      g.rows.sort(
        (a, b) =>
          (a.applicantName ?? '').localeCompare(b.applicantName ?? '', 'ko') ||
          settlementRoundOf(a) - settlementRoundOf(b)
      )
    }
    return list.sort(
      (a, b) =>
        a.programTitle.localeCompare(b.programTitle, 'ko') || a.label.localeCompare(b.label, 'ko')
    )
  }, [shown, teamOf, programOf])

  const selectCls = 'touch-target rounded-lg border border-line-strong bg-surface px-3 text-sm'

  return (
    <>
      <PageHeader
        title="정산 관리"
        description="제출된 증빙서류를 확인해 「확인 완료」로 표시하고, 지급한 뒤 지급 완료로 표시합니다."
      />

      <div className="container-page space-y-6 py-8">
        {/* 돌아가기·다른 관리 화면 링크는 머리말 위 관리 메뉴 줄로 옮겼다 (10-02 · components/staff/StaffNav) */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={programId}
            onChange={(e) => setProgramId(e.target.value)}
            aria-label="프로그램"
            className={selectCls}
          >
            <option value="">전체 프로그램</option>
            {programOptions.map(([id, title]) => (
              <option key={id} value={id}>
                {title}
              </option>
            ))}
          </select>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as SettlementStatus | '')}
            aria-label="상태"
            className={selectCls}
          >
            <option value="">전체 상태</option>
            {FILTERS.map((s) => (
              <option key={s} value={s}>
                {SETTLEMENT_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <div role="group" aria-label="보기" className="inline-flex overflow-hidden rounded-lg border border-line-strong">
            {(
              [
                ['each', '한 건씩'],
                ['team', '팀별로'],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={
                  'touch-target px-4 text-sm font-semibold ' +
                  (view === v ? 'bg-brand-600 text-white' : 'bg-surface text-ink-muted')
                }
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={load}
            className="touch-target rounded-lg border border-line-strong px-4 text-sm font-semibold"
          >
            새로고침
          </button>
          {rows && (
            <span className="text-sm text-ink-subtle">
              제출 {count('submitted')} · 확인 완료(지급 대기) {count('approved')} · 지급 완료{' '}
              {count('paid')} · 반려 {count('rejected')}
            </span>
          )}
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg bg-status-revision/10 px-3 py-2 text-sm text-status-revision"
          >
            {error}
          </p>
        )}

        {rows === null ? (
          <p className="text-sm text-ink-muted">불러오는 중…</p>
        ) : shown.length === 0 ? (
          <EmptyState
            title="정산 내역이 없습니다"
            desc="선정된 참여자가 정산을 제출하면 이곳에 표시됩니다."
          />
        ) : view === 'each' ? (
          <ul className="space-y-3">
            {shown.map((s) => (
              <SettlementRow
                key={s.id}
                row={s}
                team={teamOf(s)}
                reviewerUid={user?.uid ?? ''}
                onSaved={load}
              />
            ))}
          </ul>
        ) : (
          <div className="space-y-6">
            <p className="text-xs leading-relaxed text-ink-subtle">
              팀 프로그램은 신청서의 팀명으로, 개인 프로그램은 사람으로 묶었습니다.
              <strong> 회차(1차·2차)는 사람마다 셉니다</strong> — 같은 팀이어도 각자 낸 차수입니다.
            </p>
            {groups.map((g) => {
              const waiting = g.rows.filter((r) => r.status === 'submitted').length
              return (
                <section key={g.key} className="space-y-3">
                  <div className="border-b border-line pb-2">
                    <p className="text-xs font-semibold text-ink-subtle">{g.programTitle}</p>
                    <h2 className="font-bold">
                      {g.label}
                      <span className="ml-2 text-sm font-semibold text-ink-muted">
                        정산 {g.rows.length}건{waiting > 0 && ` · 확인 대기 ${waiting}`}
                      </span>
                    </h2>
                    {g.isTeam && (
                      <p className="mt-0.5 text-xs text-ink-subtle">낸 사람: {g.people.join(', ')}</p>
                    )}
                  </div>
                  <ul className="space-y-3">
                    {g.rows.map((s) => (
                      <SettlementRow
                        key={s.id}
                        row={s}
                        team={teamOf(s)}
                        grouped
                        reviewerUid={user?.uid ?? ''}
                        onSaved={load}
                      />
                    ))}
                  </ul>
                </section>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}

/** 증빙서류를 종류별로 — 종류가 안 붙은 옛 파일은 「증빙서류」 */
function byDocKind(files: AttachedFile[] | undefined): [string, AttachedFile[]][] {
  const map = new Map<string, AttachedFile[]>()
  for (const f of files ?? []) {
    const label = f.docLabel?.trim() || DEFAULT_SETTLEMENT_DOC.label
    map.set(label, [...(map.get(label) ?? []), f])
  }
  return Array.from(map.entries())
}

function SettlementRow({
  row,
  team,
  grouped = false,
  reviewerUid,
  onSaved,
}: {
  row: Settlement
  team: string | undefined
  /** 팀별 보기 안 — 프로그램·팀은 묶음 제목에 있으므로 줄에서는 뺀다 */
  grouped?: boolean
  reviewerUid: string
  onSaved: () => void
}) {
  const [note, setNote] = useState(row.reviewNote || '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  // 지급 완료 (09-12) — 이체한 날짜를 고른다. 기본은 오늘
  const [paidDate, setPaidDate] = useState(toYmd(new Date()))
  const [paidNote, setPaidNote] = useState('')
  const { isTest } = useTestView()

  async function markPaid() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(paidDate)) {
      setMsg('지급일을 골라 주세요.')
      return
    }
    setBusy(true)
    setMsg('')
    try {
      const [y, m, d] = paidDate.split('-').map(Number)
      await markSettlementPaid(row.id, new Date(y, m - 1, d), paidNote, reviewerUid)
      setMsg('지급 완료로 표시했습니다.')
      // 시트 「정산」 탭의 상태·지급일 칸을 따라 고친다 (D-65)
      await requestSettlementSync(row.id)
      onSaved()
    } catch (e) {
      console.error('[iLINE] 지급 완료 표시 실패:', e)
      setMsg(firestoreErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function review(status: 'approved' | 'rejected') {
    if (status === 'rejected' && !note.trim()) {
      // 사유는 신청자에게 안 보이지만(D-46) **여전히 필수**로 받는다.
      // 왜 반려했는지가 안 남으면 나중에 담당자 본인도 설명하지 못한다.
      setMsg('반려 사유를 적어 주세요. (담당자 기록용 — 신청자에게는 따로 알려주셔야 합니다)')
      return
    }
    setBusy(true)
    setMsg('')
    try {
      // 화면에 떠 있던 것과 문서가 같을 때만 (D-118) — 그 사이 학생이 고쳤으면 막고 목록을 새로 부른다
      await reviewSettlement(row.id, status, note, reviewerUid, {
        status: row.status,
        editCount: row.editCount ?? 0,
      })
      setMsg(status === 'approved' ? '확인 완료로 표시했습니다.' : '반려했습니다.')
      await requestSettlementSync(row.id)
      onSaved()
    } catch (e) {
      console.error('[iLINE] 정산 처리 실패:', e)
      setMsg(actionErrorMessage(e))
      if (e instanceof UserFacingError) onSaved()
    } finally {
      setBusy(false)
    }
  }

  const kinds = byDocKind(row.receipts)

  return (
    <li className="rounded-2xl border border-line bg-surface shadow-card p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-bold text-brand-700">
          {settlementRoundOf(row)}차
        </span>
        <span className="rounded-full bg-subtle px-2.5 py-1 text-xs font-bold">
          {SETTLEMENT_STATUS_LABEL[row.status]}
        </span>
        <span className="text-xs text-ink-subtle">
          {row.submittedAt?.toDate().toLocaleString('ko-KR')} 제출
        </span>
        {/* 테스트 계정이 낸 것 (D-124) — 「시험 데이터」를 켰을 때만 목록에 나온다 */}
        {isTest(row) && <Badge tone="warn">시험</Badge>}
        {/* 학생이 고친 흔적 (D-118) — 보완을 요청했다면 이것으로 들어온 것을 안다 */}
        {(row.editCount ?? 0) > 0 && (
          <span className="rounded-full bg-status-revision/10 px-2.5 py-1 text-xs font-bold text-status-revision">
            수정됨 · {row.lastEditedAt?.toDate().toLocaleString('ko-KR')} · {row.editCount}회
          </span>
        )}
      </div>

      <p className="mt-2 font-bold">
        {row.applicantName || '이름없음'}
        {!grouped && (
          <>
            {' · '}
            {row.programTitle || row.programId}
            {team && <span className="font-semibold text-ink-muted"> · {team} 팀</span>}
          </>
        )}
      </p>

      {/* ── 증빙서류 — 종류별로 ─────────────────────────────── */}
      <div className="mt-3 space-y-2">
        <p className="text-xs font-semibold text-ink-subtle">
          {row.receipts?.length
            ? `증빙서류 ${row.receipts.length}개 (${settlementDocSummary(row.receipts)}) — 금액은 파일을 열어 확인해 주세요`
            : // D-108 뒤로는 한 장 이상 필수라 옛 기록에서만 나온다
              '증빙서류 없음 — 사유를 적어 반려해 주세요'}
        </p>
        {kinds.map(([label, files]) => (
          <div key={label}>
            {kinds.length > 1 && (
              <p className="text-xs font-bold text-ink-muted">
                {label} {files.length}
              </p>
            )}
            <div className="mt-1 flex flex-wrap gap-2">
              {files.map((r) => (
                <FileButton key={r.storagePath} path={r.storagePath} label={r.fileName} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ── 드라이브·시트 반영 상태 (D-65) — "왜 드라이브에 없지?"를 여기서 */}
      {row.driveSyncError ? (
        <div className="mt-3 rounded-lg bg-status-revision/10 px-3 py-2 text-xs leading-relaxed text-status-revision">
          <p>
            <strong>드라이브·시트 반영 실패</strong> — {row.driveSyncError}
          </p>
          <p className="mt-1">
            정산 자체는 정상 접수되었습니다. 설정은 docs/2-학습/04-구글-시트-드라이브-연동.md 참고.
          </p>
          <SyncRetry id={row.id} onDone={onSaved} />
        </div>
      ) : row.sheetSyncedAt ? (
        <p className="mt-3 text-xs text-ink-subtle">
          드라이브·시트 반영 완료
          {row.driveFolderUrl && (
            <>
              {' · '}
              <a
                href={row.driveFolderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
              >
                드라이브 폴더 열기
              </a>
            </>
          )}
          {/* 반영이 끝난 건도 다시 올릴 수 있게 (09-30) — 시트 열·폴더 구조가 바뀌었을 때(D-117)
              옛 건을 새 모양으로 다시 쓰는 길. 몇 번 눌러도 결과가 같다(파일은 중복 업로드 안 됨) */}
          {' · '}
          <SyncRetry id={row.id} onDone={onSaved} inline />
        </p>
      ) : row.status !== 'draft' ? (
        <p className="mt-3 text-xs text-ink-subtle">
          드라이브·시트에 아직 반영되지 않았습니다. <SyncRetry id={row.id} onDone={onSaved} inline />
        </p>
      ) : null}

      {/* ── 처리 ───────────────────────────────────────────── */}
      <div className="mt-4 border-t border-line pt-4">
        <label
          htmlFor={`snote-${row.id}`}
          className="block text-sm font-semibold"
        >
          반려 사유 · 처리 메모
        </label>
        <p className="text-xs text-ink-subtle">
          {SHOW_REVIEW_NOTE_TO_APPLICANT ? (
            <>
              여기 쓰신 내용이 <strong>신청자에게 그대로 보입니다.</strong>{' '}
              반려라면 무엇을 고쳐야 하는지 적어 주세요.
            </>
          ) : (
            <>
              <strong>담당자만 보는 기록입니다 (D-46).</strong> 반려하시면
              신청자 화면에는 <strong>&lsquo;반려&rsquo; 상태만</strong> 보이고
              이유는 나오지 않으므로, <strong>무엇을 고쳐야 하는지 메일·전화로
              반드시 따로 알려주세요.</strong> 안 알리면 같은 내용으로 다시
              제출합니다.
            </>
          )}
        </p>
        <textarea
          id={`snote-${row.id}`}
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-2 w-full rounded-xl border border-line-strong bg-surface p-3 text-base leading-relaxed outline-none focus:border-brand-600"
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {row.status !== 'paid' && (
            <>
              <button
                type="button"
                onClick={() => review('approved')}
                disabled={busy}
                className="touch-target rounded-lg bg-brand-600 px-5 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                확인 완료
              </button>
              <button
                type="button"
                onClick={() => review('rejected')}
                disabled={busy}
                className="touch-target rounded-lg border border-status-revision px-5 text-sm font-bold text-status-revision hover:bg-status-revision/10 disabled:opacity-50"
              >
                반려
              </button>
            </>
          )}
          {msg && <span className="text-sm text-ink-muted">{msg}</span>}
        </div>
      </div>

      {/* ── 지급 완료 (09-12) — 확인 완료된 건에만. 이체는 사이트 밖에서 하므로
          "했다"는 사실만 날짜와 함께 남긴다. 되돌리기는 두지 않는다 —
          잘못 눌렀으면 메모로 남기고 담당자끼리 정리한다 ── */}
      {row.status === 'approved' && (
        <div className="mt-3 rounded-lg border border-status-approved/40 bg-status-approved/10 p-3 text-sm">
          <p className="font-semibold">이체를 마쳤으면 지급 완료로 표시하세요</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5">
              <span className="text-ink-muted">지급일</span>
              <input
                type="date"
                value={paidDate}
                onChange={(e) => setPaidDate(e.target.value)}
                className="touch-target rounded-lg border border-line-strong bg-surface px-2 text-sm"
              />
            </label>
            <input
              value={paidNote}
              onChange={(e) => setPaidNote(e.target.value)}
              placeholder="메모 (선택 · 담당자만 봄)"
              className="touch-target min-w-[12rem] flex-1 rounded-lg border border-line-strong bg-surface px-3 text-sm"
            />
            <button
              type="button"
              onClick={markPaid}
              disabled={busy}
              className="touch-target rounded-lg bg-status-approved px-5 text-sm font-bold text-white disabled:opacity-50"
            >
              지급 완료
            </button>
          </div>
        </div>
      )}
      {row.status === 'paid' && (
        <p className="mt-3 rounded-lg bg-subtle p-3 text-sm text-ink-muted">
          <strong className="text-ink">지급 완료</strong> ·{' '}
          {row.paidAt?.toDate().toLocaleDateString('ko-KR')}
          {row.paidNote && <> · 메모: {row.paidNote}</>}
        </p>
      )}
    </li>
  )
}

function FileButton({ path, label }: { path: string; label: string }) {
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
          alert('파일을 여는 데 실패했습니다. 담당자 권한(Custom Claims)을 확인해 주세요.')
        } finally {
          setBusy(false)
        }
      }}
      className="inline-flex max-w-full items-center rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink-muted hover:border-brand-600 hover:text-brand-600 disabled:opacity-50"
    >
      <span className="truncate">{busy ? '여는 중…' : label}</span>
    </button>
  )
}

/** 드라이브·시트 반영 재시도 (D-65) — 설정을 고친 뒤 이미 들어온 건을 다시 올린다 */
function SyncRetry({ id, onDone, inline = false }: { id: string; onDone: () => void; inline?: boolean }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function run() {
    setBusy(true)
    setErr('')
    try {
      await retrySettlementSync(id)
      onDone()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className={inline ? 'inline' : 'mt-2 block'}>
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className={
          inline
            ? 'font-semibold underline underline-offset-2 disabled:opacity-50'
            : 'touch-target rounded-lg border border-current px-3 text-xs font-semibold disabled:opacity-50'
        }
      >
        {busy ? '반영 중…' : '지금 반영'}
      </button>
      {err && <span className="ml-2 text-status-revision">{err}</span>}
    </span>
  )
}
