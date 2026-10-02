'use client'

/**
 * 관리 메뉴 줄 (10-02 sunbell — 관리 첫 화면을 「신청 관리」로 · 시안 ⓑ-2)
 *
 * 예전에는 관리 첫 화면(`/staff`)이 신청 목록이면서 그 위에 다른 관리 화면 일곱 개로 가는 버튼 묶음을
 * 들고 있었고, 다른 화면은 「← 관리」(글자 링크)나 「← 신청 관리」(버튼)로 돌아갔다 — 두 모양이 섞여 있었다.
 * 첫 화면 이름을 「신청 관리」로 바꾸면서 버튼 묶음을 **모든 관리 화면 머리말 위의 이 줄**로 뺐다.
 * 어느 관리 화면에서든 다른 관리 화면으로 한 번에 가고, 돌아가기 링크는 없앴다(줄 맨 앞 「신청」).
 *
 * 모양은 예약 관리의 하위 메뉴 줄과 같은 부품(`SubNav`). 예약 관리는 이 줄 아래 머리말, 그 아래 자기 줄 — 두 단.
 * 헤더의 [관리]는 그대로 — 누르면 「신청」이 먼저 열린다.
 *
 * 담당자에게만 보인다 — 화면마다 `MemberGate requireStaff` 가 막지만, 그 판정 전에도 줄이 먼저 그려지면 안 되므로.
 * 답변 대기 문의 수(D-93 — 예전 「문의 관리 →」 버튼의 숫자)는 화면을 옮길 때마다 다시 센다(답을 달면 줄어들게).
 */

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import SubNav from '@/components/ui/SubNav'
import { useAuth } from '@/components/auth/AuthProvider'
import { countOpenInquiries } from '@/lib/firebase/inquiries'

export default function StaffNav() {
  const { member } = useAuth()
  const pathname = usePathname()
  const isStaff = member?.role === 'staff' && member.status === 'active'
  const [openInquiries, setOpenInquiries] = useState(0)

  useEffect(() => {
    if (!isStaff) return
    countOpenInquiries()
      .then(setOpenInquiries)
      .catch(() => {})
  }, [isStaff, pathname])

  if (!isStaff) return null

  return (
    <SubNav
      label="관리"
      ariaLabel="관리 메뉴"
      prefix
      items={[
        { href: '/staff', label: '신청', exact: true },
        { href: '/staff/programs', label: '프로그램' },
        { href: '/staff/notices', label: '공지' },
        { href: '/staff/settlements', label: '정산' },
        { href: '/staff/outputs', label: '산출물' },
        { href: '/staff/reservations', label: '예약' },
        { href: '/staff/inquiries', label: '문의', badge: openInquiries },
        { href: '/staff/members', label: '회원' },
      ]}
    />
  )
}
