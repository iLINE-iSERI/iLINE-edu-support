'use client'

import { Suspense, useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import { useAuth } from '@/components/auth/AuthProvider'
import { findMyApplication } from '@/lib/firebase/applications'
import Button from '@/components/ui/Button'
import { getProgram } from '@/lib/firebase/programs'
import ProgramDetailView from '@/components/apply/ProgramDetailView'
import { isFirebaseConfigured } from '@/lib/firebase/config'
import type { Program, Application } from '@/lib/types'

/**
 * 프로그램 상세 + 신청.
 *
 * 신청서는 D-29의 최소 구성이다 — 개인정보는 회원 정보에서 가져오고,
 * 자유 기재란·첨부는 프로그램이 요구할 때만 나타난다.
 *
 * 09-18 (D-81 · Gemini 지시서 §5): PC 는 본문 7 : 오른쪽 고정 카드 3. 고정 카드에
 * 상태·마감·기간·방식·문의처와 [바로 신청하기] — 누르면 **같은 화면의 신청 폼으로
 * 내려간다**(모달 아님 — D-29 임시저장 없음·D-73 수정과 얽히지 않게). 휴대폰은 화면
 * 아래 고정 바(상태 + 신청 버튼). 포스터가 있으면 본문 맨 위에 3:4 로, 누르면 확대.
 */
export default function ProgramDetailPage() {
  // useSearchParams 는 Suspense 경계가 필요하다 (Next 14 빌드 요구)
  return (
    <Suspense
      fallback={
        <div className="container-page py-16">
          <p className="text-sm text-ink-muted">불러오는 중…</p>
        </div>
      }
    >
      <ProgramDetailContent />
    </Suspense>
  )
}

function ProgramDetailContent() {
  const params = useParams<{ programId: string }>()
  const search = useSearchParams()
  /** 마이페이지 [수정하기]로 들어온 경우 (D-73) — 같은 화면을 수정 모드로 연다 */
  const wantsEdit = search.get('edit') === '1'
  const { status, member, user } = useAuth()

  const [program, setProgram] = useState<Program | null | 'notfound'>(null)
  /** 이미 신청했는가 — undefined: 확인 전, null: 안 함 */
  const [mine, setMine] = useState<Application | null | undefined>(undefined)

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
    // 로그인이 확인되면 **다시** 부른다 (D-111). 비공개 공고는 담당자·테스트 계정만 읽을 수
    // 있는데, 주소를 바로 열면 로그인 정보가 붙기 전에 첫 요청이 나가 규칙에 막히고
    // 「찾을 수 없습니다」로 굳었다. 공개 공고는 두 번 읽어도 결과가 같다.
  }, [params.programId, user?.uid])

  // 중복 신청 방지 — 회원으로 확인된 뒤에만 조회한다
  useEffect(() => {
    if (status !== 'member' || !user) return
    findMyApplication(user.uid, params.programId)
      .then(setMine)
      .catch((e) => {
        // 조회 실패를 '신청 안 함'으로 처리하면 중복 제출이 생긴다.
        // 확인이 안 되면 폼을 열지 않고 안내만 한다.
        console.error('[iLINE] 기존 신청 확인 실패:', e)
        setMine(undefined)
      })
  }, [status, user, params.programId])

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
              <Button variant="secondary" href="/apply">
                프로그램 목록으로
              </Button>
            }
          />
        </div>
      </>
    )
  }

  return (
    <ProgramDetailView
      program={program}
      status={status}
      member={member}
      user={user}
      mine={mine}
      wantsEdit={wantsEdit}
    />
  )
}
