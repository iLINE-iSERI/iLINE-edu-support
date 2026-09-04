'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import Badge from '@/components/ui/Badge'
import { useAuth } from '@/components/auth/AuthProvider'
import {
  getProgram,
  getProgramPhase,
  PHASE_LABEL,
  daysUntilClose,
  formatPeriod,
} from '@/lib/firebase/programs'
import { isFirebaseConfigured } from '@/lib/firebase/config'
import type { Program } from '@/lib/types'

/**
 * 프로그램 상세 + 신청 진입.
 *
 * 신청서 본문은 H-1(프로그램별 항목) 확정 후 붙인다.
 * 지금은 "누가 신청할 수 있는지"와 "어떻게 신청하는지"까지만 안내한다.
 */
export default function ProgramDetailPage() {
  const params = useParams<{ programId: string }>()
  const { status } = useAuth()

  const [program, setProgram] = useState<Program | null | 'notfound'>(null)

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setProgram('notfound')
      return
    }
    getProgram(params.programId)
      .then((p) => setProgram(p ?? 'notfound'))
      .catch((e) => {
        console.error(e)
        setProgram('notfound')
      })
  }, [params.programId])

  if (program === null) {
    return (
      <div className="container-page py-16">
        <p className="text-sm text-ink-muted">불러오는 중…</p>
      </div>
    )
  }

  if (program === 'notfound') {
    return (
      <>
        <PageHeader title="프로그램 신청" />
        <div className="container-page py-10">
          <EmptyState
            title="프로그램을 찾을 수 없습니다"
            desc="공개가 중단되었거나 주소가 잘못되었을 수 있습니다."
            action={
              <Link
                href="/apply"
                className="touch-target inline-flex items-center justify-center rounded-xl border border-line-strong px-5 font-semibold"
              >
                프로그램 목록으로
              </Link>
            }
          />
        </div>
      </>
    )
  }

  const phase = getProgramPhase(program)
  const dday = phase === 'open' ? daysUntilClose(program) : null
  const isGroup = program.participationType === 'group'

  return (
    <>
      <PageHeader title={program.title} />

      <div className="container-page space-y-8 py-10">
        {/* 요약 */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={phase}>{PHASE_LABEL[phase]}</Badge>
          <Badge tone={isGroup ? 'group' : 'individual'}>
            {isGroup ? '단체 프로그램' : '개인 신청'}
          </Badge>
          {dday !== null && (
            <span className="text-sm font-semibold text-ink-subtle">
              {dday === 0 ? '오늘 마감' : `마감까지 D-${dday}`}
            </span>
          )}
        </div>

        {program.description && (
          <p className="max-w-3xl leading-relaxed text-ink-muted">
            {program.description}
          </p>
        )}

        {/* 접수 정보 */}
        <dl className="grid gap-3 rounded-2xl border border-line bg-surface p-5 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-ink-subtle">접수 기간</dt>
            <dd className="mt-0.5 font-medium">
              {formatPeriod(program.opensAt, program.closesAt)}
            </dd>
          </div>
          <div>
            <dt className="text-ink-subtle">신청 방식</dt>
            <dd className="mt-0.5 font-medium">
              {isGroup
                ? '대표자가 팀원 명단과 함께 신청'
                : '개인별 신청 (팀 활동이어도 각자 신청)'}
            </dd>
          </div>
          {isGroup && program.maxTeamSize && (
            <div>
              <dt className="text-ink-subtle">팀 구성</dt>
              <dd className="mt-0.5 font-medium">
                최대 {program.maxTeamSize}명 (대표자 포함)
              </dd>
            </div>
          )}
        </dl>

        {/* 단체 프로그램 안내 — 개인정보 대리 수집 주의 */}
        {isGroup && (
          <div className="rounded-xl border border-status-revision/40 bg-status-revision/10 p-4 text-sm leading-relaxed">
            <p className="font-bold text-status-revision">
              단체 프로그램 신청 안내
            </p>
            <p className="mt-1.5 text-ink-muted">
              대표자 한 분이 팀원의 이름·학번·전공·학년·연락처를 함께
              제출합니다. <strong>팀원 전원에게 미리 동의를 받은 뒤</strong>{' '}
              입력해 주세요. 신청서에서 동의 여부를 확인합니다.
            </p>
          </div>
        )}

        {/* 신청 진입 */}
        <div className="rounded-2xl border border-dashed border-line-strong bg-subtle p-6">
          {phase === 'closed' ? (
            <p className="text-sm text-ink-muted">
              접수가 마감된 프로그램입니다.
            </p>
          ) : phase === 'upcoming' ? (
            <p className="text-sm text-ink-muted">
              아직 접수가 시작되지 않았습니다. 접수 시작일에 다시 방문해 주세요.
            </p>
          ) : status === 'guest' ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-ink-muted">
                신청하시려면 로그인이 필요합니다.
              </p>
              <Link
                href={`/login?next=${encodeURIComponent(`/apply/${program.id}`)}`}
                className="touch-target inline-flex items-center justify-center rounded-xl bg-brand-600 px-6 font-bold text-white hover:bg-brand-700"
              >
                로그인
              </Link>
            </div>
          ) : status === 'unregistered' ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-ink-muted">
                회원 등록을 마치시면 신청하실 수 있습니다.
              </p>
              <Link
                href={`/register?next=${encodeURIComponent(`/apply/${program.id}`)}`}
                className="touch-target inline-flex items-center justify-center rounded-xl bg-brand-600 px-6 font-bold text-white hover:bg-brand-700"
              >
                회원 등록
              </Link>
            </div>
          ) : (
            <div>
              <p className="text-sm font-semibold text-ink-muted">
                신청서 작성 — 준비 중
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-subtle">
                프로그램별 신청 항목이 확정되는 대로 이 자리에 신청서가
                열립니다. 작성 중인 내용은 임시저장되며, 제출 전까지 수정하실 수
                있습니다.
              </p>
            </div>
          )}
        </div>

        <Link
          href="/apply"
          className="inline-block text-sm text-ink-muted underline underline-offset-2"
        >
          ← 프로그램 목록
        </Link>
      </div>
    </>
  )
}
