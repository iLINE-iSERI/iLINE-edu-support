'use client'

import PageHeader from '@/components/ui/PageHeader'
import Placeholder from '@/components/ui/Placeholder'
import MemberGate from '@/components/auth/MemberGate'
import { useAuth } from '@/components/auth/AuthProvider'

export default function MypagePage() {
  return (
    <MemberGate>
      <MypageContent />
    </MemberGate>
  )
}

function MypageContent() {
  const { member } = useAuth()

  return (
    <>
      <PageHeader
        title="마이페이지"
        description={
          member ? `${member.name}님, 안녕하세요.` : '신청 현황과 제출 서류를 확인합니다.'
        }
      />

      {member && (
        <div className="container-page pt-8">
          <dl className="grid gap-3 rounded-2xl border border-line bg-surface p-5 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-ink-subtle">소속</dt>
              <dd className="mt-0.5 font-medium">{member.affiliation}</dd>
            </div>
            <div>
              <dt className="text-ink-subtle">직위</dt>
              <dd className="mt-0.5 font-medium">{member.position}</dd>
            </div>
            <div>
              <dt className="text-ink-subtle">이메일</dt>
              <dd className="mt-0.5 break-all font-medium">{member.email}</dd>
            </div>
            <div>
              <dt className="text-ink-subtle">연락처</dt>
              <dd className="mt-0.5 font-medium">{member.phone}</dd>
            </div>
          </dl>
        </div>
      )}

      <Placeholder
        phase="Phase 3"
        blockedBy="H-1 신청서 폼 명세"
        items={[
          '내 신청 현황 — 상태 뱃지 + 보완 요청 사유 (D-11)',
          '산출물 제출 (D-19) — 선정 이후 노출',
          '정산 증빙 제출 (D-19) — 정산 기간 개시 후 노출',
          '제출 서류 보관함',
          '회원정보 수정',
        ]}
      />
    </>
  )
}
