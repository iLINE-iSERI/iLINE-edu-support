'use client'

/**
 * 프로그램 한 묶음 — 산출물 제출 화면의 본체 (D-76).
 * 안내 · 우리 팀(개인이면 내) 제출물 · [새로 제출하기] · [다시 제출하기].
 * 페이지 파일(app/outputs/page.tsx)은 목록을 모아 이걸 프로그램마다 그린다.
 */

import { useEffect, useState } from 'react'
import { Timestamp } from 'firebase/firestore'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import OutputForm from './OutputForm'
import OutputCard from './OutputCard'
import { formatPeriodShort } from '@/lib/firebase/programs'
import { outputPhase, outputWindow, canSubmitOutput, isShared, requestOutputSync } from '@/lib/firebase/outputs'
import type { Application, Output, Program, SupportUser } from '@/lib/types'

export type Bundle = {
  app: Application
  program: Program
  /** 우리 팀(개인이면 나)의 제출물 */
  outputs: Output[]
  teamName?: string
}

export default function ProgramOutputs({
  bundle: { app, program, outputs, teamName },
  member,
  onChange,
}: {
  bundle: Bundle
  member: SupportUser
  onChange: () => void
}) {
  /** null: 닫힘 · '': 새로 · 그 외: 다시 제출할 산출물 ID */
  const [editing, setEditing] = useState<string | null>(null)
  const [justDone, setJustDone] = useState('')

  const phase = outputPhase(program)
  const canSubmit = canSubmitOutput(app, program)
  const { opens, closes } = outputWindow(program)
  const shared = isShared(program)
  const ts = (d?: Date) => (d ? Timestamp.fromDate(d) : undefined)

  // 활동 종료일에서 온 마감은 날짜만 보인다 — "11. 30.(월) 23:59까지"는 이상하다
  const closesTs = program.outputClosesAt ?? program.activityEnd ?? ts(closes)
  const periodText =
    phase === 'upcoming'
      ? `${formatPeriodShort(program.outputOpensAt ?? program.activityStart ?? ts(opens))} 올릴 수 있습니다`
      : closesTs
        ? `${formatPeriodShort(undefined, closesTs)} 올릴 수 있습니다`
        : '활동 기간 중 언제든 올릴 수 있습니다'

  // 다시 제출하려던 것이 목록에서 사라졌으면(새로고침 등) 조용히 닫는다
  useEffect(() => {
    if (editing && !outputs.some((o) => o.id === editing)) setEditing(null)
  }, [editing, outputs])

  return (
    <section
      aria-labelledby={`out-${app.id}`}
      className="rounded-2xl border-2 border-line-strong bg-surface p-5 sm:p-6"
    >
      {/* 머리 */}
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {teamName && <Badge tone="group">{teamName} 팀</Badge>}
            {shared && <Badge tone="open">참여자 공유</Badge>}
            {phase === 'closed' && <Badge tone="closed">제출 마감</Badge>}
          </div>
          <h2 id={`out-${app.id}`} className="mt-2 break-keep text-xl font-extrabold leading-snug">
            {program.title}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">{periodText}</p>
        </div>
        {shared && (
          <Button variant="secondary" href={`/outputs/${program.id}`} className="shrink-0">
            참여자 자료실 →
          </Button>
        )}
      </div>

      {/* 담당자 안내 */}
      {program.outputGuide && (
        <div className="mt-4 rounded-xl bg-subtle p-4 text-sm leading-relaxed">
          <p className="font-bold">무엇을 올리나요</p>
          <p className="mt-1 whitespace-pre-line text-ink-muted">{program.outputGuide}</p>
        </div>
      )}

      {justDone && (
        <p role="status" className="mt-4 rounded-xl border border-status-approved/40 bg-status-approved/10 p-3 text-sm font-semibold text-status-approved">
          {justDone}
        </p>
      )}

      {/* 목록 */}
      <div className="mt-5 space-y-3">
        {outputs.length === 0 && editing === null && (
          <p className="rounded-xl border border-dashed border-line-strong p-5 text-center text-sm text-ink-muted">
            {teamName ? '우리 팀이 올린 것이 아직 없습니다.' : '올린 것이 아직 없습니다.'}
          </p>
        )}
        {outputs.map((o) => {
          const mine = o.uid === member.uid
          const canEdit = mine && canSubmit && editing === null
          return editing === o.id ? (
            <OutputForm
              key={o.id}
              application={app}
              program={program}
              member={member}
              editing={o}
              onDone={(id) => {
                void requestOutputSync(id) // 시트 한 줄 — 실패해도 제출은 끝난 것
                setEditing(null)
                setJustDone('다시 제출했습니다.')
                onChange()
              }}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <OutputCard
              key={o.id}
              output={o}
              who={mine ? 'mine' : 'team'}
              compact={outputs.length > 3}
              actions={
                canEdit ? (
                  <Button
                    variant={o.status === 'revision' ? 'primary' : 'secondary'}
                    onClick={() => {
                      setJustDone('')
                      setEditing(o.id)
                    }}
                  >
                    다시 제출하기
                  </Button>
                ) : undefined
              }
            />
          )
        })}
      </div>

      {/* 새로 제출 */}
      {editing === '' && (
        <div className="mt-4">
          <OutputForm
            application={app}
            program={program}
            member={member}
            onDone={(id) => {
              void requestOutputSync(id)
              setEditing(null)
              setJustDone('제출했습니다.')
              onChange()
            }}
            onCancel={() => setEditing(null)}
          />
        </div>
      )}
      {editing === null && canSubmit && (
        <div className="mt-4">
          <Button
            onClick={() => {
              setJustDone('')
              setEditing('')
            }}
          >
            + 새로 제출하기
          </Button>
        </div>
      )}
      {editing === null && !canSubmit && phase === 'closed' && (
        <p className="mt-4 text-sm text-ink-muted">
          제출 기간이 끝났습니다. 꼭 올려야 할 것이 남았으면 담당자에게 문의해 주세요.
        </p>
      )}
    </section>
  )
}
