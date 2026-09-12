'use client'

import MemberGate from '@/components/auth/MemberGate'
import ReserveFlow from '@/components/reserve/ReserveFlow'

/**
 * 예약하기 — 회원 등록까지 마친 회원만 (D-52 ①, D-23).
 * 로그인·회원 판별은 MemberGate 가 하고, 실제 보안은 규칙이 한다.
 */
export default function ReservePage() {
  return (
    <MemberGate>
      <div className="container-page py-8">
        <div className="mx-auto max-w-3xl">
          <ReserveFlow />
        </div>
      </div>
    </MemberGate>
  )
}
