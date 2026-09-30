'use client'

import MemberGate from '@/components/auth/MemberGate'
import VerifyEmailNotice from '@/components/auth/VerifyEmailNotice'
import { useAuth } from '@/components/auth/AuthProvider'
import ReserveFlow from '@/components/reserve/ReserveFlow'

/**
 * 예약하기 — 회원 등록까지 마친 회원만 (D-52 ①, D-23).
 * 로그인·회원 판별은 MemberGate 가 하고, 실제 보안은 규칙이 한다.
 * 새로 가입한 이메일 계정은 인증을 마쳐야 예약할 수 있다 (09-30 — 행정실에 넘기는 명단이라 연락이 닿아야 한다).
 */
export default function ReservePage() {
  return (
    <MemberGate>
      <div className="container-page py-8">
        <div className="mx-auto max-w-3xl">
          <ReserveGate />
        </div>
      </div>
    </MemberGate>
  )
}

function ReserveGate() {
  const { verifyNeeded } = useAuth()
  if (verifyNeeded) {
    return <VerifyEmailNotice reason="시설 예약은 이메일 인증을 마친 뒤에 할 수 있습니다." />
  }
  return <ReserveFlow />
}
