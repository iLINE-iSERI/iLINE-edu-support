'use client'

/**
 * 산출물 제출 — 상단 대메뉴 (D-76 · 09-17).
 *
 * 교수님(09-14): "프로그램 진행 중에 활용할 페이지". iSERI(09-17): 헤더에 들어갈
 * 정도의 기능, 교수님 동의. 그래서 마이페이지 하위(D-19)가 아니라 **대메뉴**다.
 *
 *   로그인 전        이 화면이 무엇인지 + [로그인]
 *   선정 건 없음      "참여 중인 프로그램이 없습니다" + [프로그램 보기]
 *   선정 건 있음      프로그램마다 한 묶음 — 안내 · 우리 팀(또는 내) 제출물 · [새로 제출하기]
 *
 * 팀 프로그램이면 같은 팀명의 다른 계정 것까지 함께 보인다(서버가 묶어 준다).
 * 제출은 팀원 누구나, 보기는 팀 단위 (iSERI 09-17).
 */

import { useCallback, useEffect, useState } from 'react'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import Button from '@/components/ui/Button'
import MemberGate from '@/components/auth/MemberGate'
import { useAuth } from '@/components/auth/AuthProvider'
import ProgramOutputs, { type Bundle } from '@/components/outputs/ProgramOutputs'
import { listMyApplications } from '@/lib/firebase/applications'
import { listPublishedPrograms } from '@/lib/firebase/programs'
import { listMyOutputs, listTeamOutputs } from '@/lib/firebase/outputs'
import { firestoreErrorMessage } from '@/lib/firebase/errors'
import { teamNameOf } from '@/lib/types'

export default function OutputsPage() {
  const { status } = useAuth()
  if (status === 'guest') return <GuestIntro />
  return (
    <MemberGate>
      <OutputsContent />
    </MemberGate>
  )
}

/* ── 로그인 전 ─────────────────────────────────────────────────── */

function GuestIntro() {
  return (
    <>
      <PageHeader
        title="산출물 제출"
        description="프로그램에 선정된 참여자가 활동 산출물과 사진을 올리는 곳입니다."
      />
      <div className="container-page py-10">
        <div className="mx-auto max-w-xl rounded-2xl border-2 border-line-strong bg-surface p-6 sm:p-8">
          <p className="text-lg font-bold">로그인하면 내가 참여 중인 프로그램이 보입니다</p>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            선정된 프로그램마다 제출창이 열리고, 활동 기간 중 언제든 지도안·발표자료·활동 사진을
            올릴 수 있습니다. 담당자가 추가로 요청한 것이 있으면 여기에서 확인하고 다시 낼 수 있습니다.
          </p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            <Button href="/login?next=%2Foutputs">로그인</Button>
            <Button variant="secondary" href="/apply">
              프로그램 보기
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}

/* ── 회원 ─────────────────────────────────────────────────────── */

function OutputsContent() {
  const { member, user } = useAuth()
  const [bundles, setBundles] = useState<Bundle[] | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!user) return
    setError('')
    try {
      const [apps, programs, mine] = await Promise.all([
        listMyApplications(user.uid),
        listPublishedPrograms(),
        listMyOutputs(user.uid),
      ])
      const approved = apps.filter((a) => a.status === 'approved')
      const out: Bundle[] = []
      for (const app of approved) {
        const program = programs.find((p) => p.id === app.programId)
        if (!program) continue
        const teamName = teamNameOf(app)
        let outputs = mine.filter((o) => o.applicationId === app.id)
        if (teamName) {
          // 팀이면 서버가 팀원 것까지 묶어 준다. 실패하면 내 것만이라도 보인다
          try {
            outputs = await listTeamOutputs(program.id)
          } catch (e) {
            console.warn('[iLINE] 팀 산출물 조회 실패(내 것만 표시):', e)
          }
        }
        out.push({ app, program, outputs, teamName })
      }
      setBundles(out)
    } catch (e) {
      console.error('[iLINE] 산출물 화면 조회 실패:', e)
      setError(firestoreErrorMessage(e))
      setBundles([])
    }
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <>
      <PageHeader
        title="산출물 제출"
        description="프로그램에 선정된 참여자가 활동 산출물과 사진을 올리는 곳입니다."
      />
      <div className="container-page space-y-8 py-8">
        {error && (
          <p role="alert" className="rounded-xl border border-status-revision/40 bg-status-revision/10 p-4 text-sm text-status-revision">
            {error}
          </p>
        )}

        {bundles === null ? (
          <p className="text-sm text-ink-muted">불러오는 중…</p>
        ) : bundles.length === 0 ? (
          <EmptyState
            title="참여 중인 프로그램이 없습니다"
            desc="프로그램에 선정되면 이곳에 제출창이 열립니다. 신청 현황은 마이페이지에서 확인하세요."
            action={
              <div className="flex flex-wrap justify-center gap-2.5">
                <Button variant="secondary" href="/apply">
                  프로그램 보기
                </Button>
                <Button variant="secondary" href="/mypage">
                  마이페이지
                </Button>
              </div>
            }
          />
        ) : (
          bundles.map((b) =>
            member ? (
              <ProgramOutputs key={b.app.id} bundle={b} member={member} onChange={load} />
            ) : null
          )
        )}
      </div>
    </>
  )
}
