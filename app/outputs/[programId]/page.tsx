'use client'

/**
 * 참여자 자료실 — 한 프로그램의 공유된 산출물 (D-76 · 09-17).
 *
 * 담당자가 공고에서 「참여자 공유」로 둔 프로그램만 열린다. 로그인한 회원
 * 누구나 본다 — "그 프로그램 참여자만"으로 정확히 막는 것은 규칙이 남의 신청서를
 * 읽어야 해서 비싸고, 회원가입 자체가 예비교원 대상이라 실질 차이가 작다(D-75 ⑥).
 *
 * **이름을 쓰지 않는다** — 팀명, 없으면 소속·전공만 (참고 사이트에서 배운 것).
 * 담당자가 내린 것(hiddenByStaff)은 질의 단계에서 빠진다.
 */

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import MemberGate from '@/components/auth/MemberGate'
import { useAuth } from '@/components/auth/AuthProvider'
import OutputCard from '@/components/outputs/OutputCard'
import { getProgram } from '@/lib/firebase/programs'
import { listSharedOutputs, isShared } from '@/lib/firebase/outputs'
import { firestoreErrorMessage } from '@/lib/firebase/errors'
import type { Output, Program } from '@/lib/types'

export default function SharedOutputsPage() {
  return (
    <MemberGate>
      <SharedContent />
    </MemberGate>
  )
}

function SharedContent() {
  const { user } = useAuth()
  const params = useParams<{ programId: string }>()
  const programId = params?.programId ?? ''

  const [program, setProgram] = useState<Program | null | undefined>(undefined)
  const [outputs, setOutputs] = useState<Output[] | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!programId) return
    setError('')
    try {
      const p = await getProgram(programId)
      setProgram(p)
      if (!p || !isShared(p)) {
        setOutputs([])
        return
      }
      setOutputs(await listSharedOutputs(programId))
    } catch (e) {
      console.error('[iLINE] 참여자 자료실 조회 실패:', e)
      setError(firestoreErrorMessage(e))
      setOutputs([])
    }
  }, [programId])

  useEffect(() => {
    void load()
  }, [load])

  const title = program?.title ?? '참여자 자료실'

  return (
    <>
      <PageHeader
        title={program ? `${program.title} — 참여자 자료실` : '참여자 자료실'}
        description="같은 프로그램에 참여한 분들이 공유한 산출물입니다. 올린 사람의 이름은 보이지 않습니다."
      />
      <div className="container-page space-y-6 py-8">
        <div>
          <Button variant="text" href="/outputs">
            ← 산출물 제출로
          </Button>
        </div>

        {error && (
          <p role="alert" className="rounded-xl border border-status-revision/40 bg-status-revision/10 p-4 text-sm text-status-revision">
            {error}
          </p>
        )}

        {program === undefined || outputs === null ? (
          <p className="text-sm text-ink-muted">불러오는 중…</p>
        ) : program === null ? (
          <EmptyState title="프로그램을 찾을 수 없습니다" />
        ) : !isShared(program) ? (
          <EmptyState
            title="이 프로그램의 산출물은 공유되지 않습니다"
            desc="담당자가 「비공개」로 둔 프로그램입니다. 올린 것은 본인과 담당자만 봅니다."
          />
        ) : outputs.length === 0 ? (
          <EmptyState
            title="아직 공유된 산출물이 없습니다"
            desc={`${title} 참여자가 올리면 이곳에 보입니다.`}
          />
        ) : (
          <>
            <p className="text-sm text-ink-muted">
              <Badge tone="open">참여자 공유</Badge>
              <span className="ml-2">{outputs.length}건</span>
            </p>
            <div className="grid gap-3.5 md:grid-cols-2">
              {outputs.map((o) => (
                <OutputCard
                  key={o.id}
                  output={o}
                  who="shared"
                  compact
                  actions={
                    user && o.uid === user.uid ? (
                      <Badge tone="info">내가 올린 것</Badge>
                    ) : undefined
                  }
                />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  )
}
