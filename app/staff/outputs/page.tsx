'use client'

/**
 * 담당자 산출물 관리 (D-76 · 09-17)
 *
 * 프로그램을 고르면 그 프로그램의 제출물이 전부 보인다. 이 화면의 핵심은
 * 목록보다 **「아직 안 낸 팀(사람)」** 줄이다 — 담당자가 실제로 궁금한 건
 * 낸 것보다 안 낸 쪽이다. 선정된 신청 건과 제출물을 맞대어 센다.
 *
 * 할 수 있는 일은 둘뿐이다 (iSERI 09-17: "일일이 승인 처리하고 그럴 수 없어요"):
 *   · 추가 요청 — 글을 달면 참여자 화면에 보이고, 참여자가 고쳐 다시 낸다
 *   · 내리기   — 사후 비상구. 사진 속 다른 사람이 빼 달라고 할 때. 지우지 않는다
 * 승인·반려는 없다. 제출된 것은 그대로 유효하다.
 */

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import MemberGate from '@/components/auth/MemberGate'
import { useAuth } from '@/components/auth/AuthProvider'
import OutputCard from '@/components/outputs/OutputCard'
import { listAllPrograms, listAllApplications } from '@/lib/firebase/staff'
import {
  listOutputsByProgram,
  requestOutputRevision,
  withdrawOutputRevision,
  setOutputHidden,
  requestOutputSync,
  outputPhase,
  isShared,
} from '@/lib/firebase/outputs'
import { firestoreErrorMessage } from '@/lib/firebase/errors'
import {
  teamNameOf,
  OUTPUT_VISIBILITY_LABEL,
  outputVisibilityOf,
  type Application,
  type Output,
  type Program,
} from '@/lib/types'

export default function StaffOutputsPage() {
  return (
    <MemberGate requireStaff>
      <Suspense fallback={null}>
        <StaffOutputsContent />
      </Suspense>
    </MemberGate>
  )
}

type Filter = '' | 'submitted' | 'revision' | 'hidden'

function StaffOutputsContent() {
  const { user } = useAuth()
  // 시트의 「사이트에서 열기」 링크가 ?program= 을 달고 온다
  const params = useSearchParams()
  const [programs, setPrograms] = useState<Program[]>([])
  const [programId, setProgramId] = useState(params.get('program') ?? '')
  const [apps, setApps] = useState<Application[]>([])
  const [rows, setRows] = useState<Output[] | null>(null)
  const [filter, setFilter] = useState<Filter>('')
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')
  /** 추가 요청 글을 쓰는 중인 산출물 */
  const [noteFor, setNoteFor] = useState<string | null>(null)
  const [note, setNote] = useState('')

  useEffect(() => {
    listAllPrograms()
      .then((list) => {
        setPrograms(list)
        // 처음엔 활동 중(제출 가능)인 프로그램 중 첫 것을 고른다
        const open = list.find((p) => p.published && outputPhase(p) === 'open')
        setProgramId((cur) => cur || open?.id || list[0]?.id || '')
      })
      .catch((e) => {
        console.error('[iLINE] 프로그램 목록 조회 실패:', e)
        setError(firestoreErrorMessage(e))
      })
  }, [])

  const load = useCallback(async () => {
    if (!programId) return
    setError('')
    setRows(null)
    try {
      const [outputs, applications] = await Promise.all([
        listOutputsByProgram(programId),
        listAllApplications(programId),
      ])
      setRows(outputs)
      setApps(applications.filter((a) => a.status === 'approved'))
    } catch (e) {
      console.error('[iLINE] 산출물 목록 조회 실패:', e)
      setError(firestoreErrorMessage(e))
      setRows([])
    }
  }, [programId])

  useEffect(() => {
    void load()
  }, [load])

  const program = programs.find((p) => p.id === programId) ?? null

  /* ── 누가 냈고 누가 안 냈나 — 팀 프로그램은 팀명으로, 개인은 사람으로 ── */
  const units = useMemo(() => {
    const map = new Map<string, { label: string; isTeam: boolean; count: number }>()
    for (const a of apps) {
      const team = teamNameOf(a)
      const key = team ? `team:${team}` : `uid:${a.uid}`
      if (!map.has(key)) {
        map.set(key, { label: team ? `${team} 팀` : a.applicant?.name ?? '(이름 없음)', isTeam: Boolean(team), count: 0 })
      }
    }
    for (const o of rows ?? []) {
      const key = o.teamName ? `team:${o.teamName}` : `uid:${o.uid}`
      const u = map.get(key)
      if (u) u.count += 1
    }
    return Array.from(map.values())
  }, [apps, rows])
  const submittedUnits = units.filter((u) => u.count > 0)
  const missingUnits = units.filter((u) => u.count === 0)

  const visible = (rows ?? []).filter((o) => {
    if (filter === 'hidden') return o.hiddenByStaff
    if (filter === 'revision') return o.status === 'revision' && !o.hiddenByStaff
    if (filter === 'submitted') return o.status === 'submitted' && !o.hiddenByStaff
    return true
  })
  const counts = {
    all: rows?.length ?? 0,
    revision: (rows ?? []).filter((o) => o.status === 'revision' && !o.hiddenByStaff).length,
    hidden: (rows ?? []).filter((o) => o.hiddenByStaff).length,
  }

  async function act(id: string, fn: () => Promise<void>) {
    setBusyId(id)
    setError('')
    try {
      await fn()
      void requestOutputSync(id) // 시트 같은 줄 갱신 — 기다리지 않는다
      await load()
    } catch (e) {
      console.error('[iLINE] 산출물 처리 실패:', e)
      setError(firestoreErrorMessage(e))
    } finally {
      setBusyId('')
    }
  }

  return (
    <>
      <PageHeader
        title="산출물 관리"
        description="참여자가 올린 산출물입니다. 승인은 없습니다 — 필요하면 추가 요청을 달고, 문제가 있는 것만 내립니다."
      />

      <div className="container-page space-y-6 py-8">
        <div className="flex flex-wrap gap-2">
          <Link href="/staff" className="touch-target inline-flex items-center justify-center rounded-xl border border-line-strong px-5 text-sm font-semibold">
            ← 신청 관리
          </Link>
          <Link href="/staff/programs" className="touch-target inline-flex items-center justify-center rounded-xl border border-line-strong px-5 text-sm font-semibold">
            프로그램 관리 →
          </Link>
        </div>

        {/* 프로그램 · 필터 */}
        <div className="flex flex-wrap gap-3">
          <select
            value={programId}
            onChange={(e) => {
              setProgramId(e.target.value)
              setFilter('')
              setNoteFor(null)
            }}
            aria-label="프로그램"
            className="touch-target rounded-xl border border-line-strong bg-surface px-3 text-sm"
          >
            {programs.length === 0 && <option value="">프로그램이 없습니다</option>}
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
                {!p.published ? ' (비공개)' : ''}
              </option>
            ))}
          </select>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as Filter)}
            aria-label="상태"
            className="touch-target rounded-xl border border-line-strong bg-surface px-3 text-sm"
          >
            <option value="">전체 ({counts.all})</option>
            <option value="submitted">제출됨</option>
            <option value="revision">추가 요청 ({counts.revision})</option>
            <option value="hidden">내려짐 ({counts.hidden})</option>
          </select>
        </div>

        {error && (
          <p role="alert" className="rounded-xl border border-status-revision/40 bg-status-revision/10 p-4 text-sm text-status-revision">
            {error}
          </p>
        )}

        {/* 프로그램 설정 한 줄 + 제출 현황 */}
        {program && (
          <div className="rounded-2xl border-2 border-line-strong bg-surface p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge tone={isShared(program) ? 'open' : 'neutral'}>
                {OUTPUT_VISIBILITY_LABEL[outputVisibilityOf(program)]}
              </Badge>
              <Badge tone={outputPhase(program) === 'open' ? 'open' : 'closed'}>
                {outputPhase(program) === 'open' ? '제출 받는 중' : outputPhase(program) === 'upcoming' ? '제출 전' : '제출 마감'}
              </Badge>
              <Link href="/staff/programs" className="text-xs font-semibold text-ink-muted underline underline-offset-2">
                설정은 프로그램 관리에서
              </Link>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-bold text-ink-subtle">
                  낸 {units.length > 0 && units[0].isTeam ? '팀' : '사람'} {submittedUnits.length} / {units.length}
                </p>
                <p className="mt-1 flex flex-wrap gap-1.5">
                  {submittedUnits.length === 0 && <span className="text-sm text-ink-muted">아직 없음</span>}
                  {submittedUnits.map((u) => (
                    <span key={u.label} className="rounded-full bg-status-approved/12 px-2.5 py-1 text-xs font-bold text-status-approved">
                      {u.label} · {u.count}건
                    </span>
                  ))}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold text-ink-subtle">아직 안 낸 {missingUnits.length}</p>
                <p className="mt-1 flex flex-wrap gap-1.5">
                  {missingUnits.length === 0 && units.length > 0 && (
                    <span className="text-sm text-status-approved">모두 냈습니다</span>
                  )}
                  {units.length === 0 && <span className="text-sm text-ink-muted">선정된 신청 건이 없습니다</span>}
                  {missingUnits.map((u) => (
                    <span key={u.label} className="rounded-full bg-status-revision/12 px-2.5 py-1 text-xs font-bold text-status-revision">
                      {u.label}
                    </span>
                  ))}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 목록 */}
        {rows === null ? (
          <p className="text-sm text-ink-muted">불러오는 중…</p>
        ) : visible.length === 0 ? (
          <EmptyState
            title={rows.length === 0 ? '올라온 산출물이 없습니다' : '이 조건에 맞는 산출물이 없습니다'}
            desc={rows.length === 0 ? '참여자가 「산출물 제출」에서 올리면 여기 보입니다.' : undefined}
          />
        ) : (
          <div className="space-y-3">
            {visible.map((o) => {
              const busy = busyId === o.id
              const writing = noteFor === o.id
              return (
                <div key={o.id} className="space-y-2">
                  <OutputCard
                    output={o}
                    who="staff"
                    compact
                    actions={
                      <>
                        {o.status === 'revision' ? (
                          <Button
                            variant="secondary"
                            disabled={busy}
                            onClick={() => act(o.id, () => withdrawOutputRevision(o.id))}
                          >
                            요청 거두기
                          </Button>
                        ) : (
                          <Button
                            variant="secondary"
                            disabled={busy}
                            onClick={() => {
                              setNoteFor(writing ? null : o.id)
                              setNote('')
                            }}
                          >
                            추가 요청
                          </Button>
                        )}
                        <Button
                          variant={o.hiddenByStaff ? 'secondary' : 'danger'}
                          disabled={busy}
                          onClick={() => {
                            if (!o.hiddenByStaff && !confirm('이 산출물을 내릴까요? 참여자 공유 목록에서 사라지고, 본인과 담당자에게는 「내려짐」으로 남습니다.')) return
                            void act(o.id, () => setOutputHidden(o.id, !o.hiddenByStaff))
                          }}
                        >
                          {o.hiddenByStaff ? '되살리기' : '내리기'}
                        </Button>
                      </>
                    }
                  />
                  {writing && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault()
                        if (!note.trim() || !user) return
                        void act(o.id, async () => {
                          await requestOutputRevision(o.id, note, user.uid)
                          setNoteFor(null)
                          setNote('')
                        })
                      }}
                      className="rounded-2xl border-2 border-status-revision/40 bg-status-revision/5 p-4"
                    >
                      <label className="block">
                        <span className="text-sm font-bold">추가 요청 — 참여자에게 그대로 보입니다</span>
                        <textarea
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          rows={3}
                          autoFocus
                          placeholder="무엇을 더 올리거나 고쳐야 하는지 적어 주세요."
                          className="mt-1.5 w-full rounded-xl border border-line-strong bg-surface p-3 text-base outline-none focus:border-brand-600"
                        />
                      </label>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button type="submit" disabled={busy || !note.trim()}>
                          요청 보내기
                        </Button>
                        <Button type="button" variant="secondary" onClick={() => setNoteFor(null)} disabled={busy}>
                          취소
                        </Button>
                      </div>
                    </form>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
