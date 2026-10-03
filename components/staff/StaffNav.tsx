'use client'

/**
 * 관리 메뉴 줄 (10-02 sunbell — 관리 첫 화면을 「신청 관리」로 · 시안 ⓑ-2 · D-122)
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
 *
 * D-124 — 줄 오른쪽 끝에 「시험 데이터 보기」 스위치(`components/staff/TestView.tsx`). 켜져 있으면 줄 아래 귤색 띠 —
 * 켜 둔 채 잊고 실제 업무 숫자로 착각하지 않게. 문의 숫자도 스위치를 따른다.
 */

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import SubNav from '@/components/ui/SubNav'
import { useAuth } from '@/components/auth/AuthProvider'
import { useTestView } from '@/components/staff/TestView'
import { listOpenInquiries } from '@/lib/firebase/inquiries'
import type { Inquiry } from '@/lib/types'

export default function StaffNav() {
  const { member } = useAuth()
  const pathname = usePathname()
  const { showTests, setShowTests, visible } = useTestView()
  const isStaff = member?.role === 'staff' && member.status === 'active'
  const [openInquiries, setOpenInquiries] = useState<Inquiry[]>([])

  useEffect(() => {
    if (!isStaff) return
    listOpenInquiries()
      .then(setOpenInquiries)
      .catch(() => {})
  }, [isStaff, pathname])

  if (!isStaff) return null

  return (
    <>
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
          { href: '/staff/inquiries', label: '문의', badge: visible(openInquiries).length },
          { href: '/staff/members', label: '회원' },
        ]}
        trailing={
          // 10-03 sunbell — 처음 판(text-xs · ink-subtle · 「시험 데이터」)은 글자가 흐려 잘 안 보였다 →
          // 메뉴 칸과 같은 크기·색, 켜져 있으면 귤색 굵게(띠와 같은 색)
          <label
            className={
              'flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg px-3 py-3 text-sm transition-colors hover:bg-ink/5 ' +
              (showTests ? 'font-bold text-warn-ink' : 'font-medium text-ink-muted hover:text-ink')
            }
          >
            <input
              type="checkbox"
              checked={showTests}
              onChange={(e) => setShowTests(e.target.checked)}
              className="h-4 w-4 accent-warn"
            />
            시험 데이터 보기
          </label>
        }
      />
      {showTests && (
        <div role="status" className="border-b border-warn/40 bg-warn-soft">
          <div className="container-page flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm text-warn-ink">
            <span>
              🧪 <strong className="font-semibold">시험 데이터를 함께 보는 중</strong> — 테스트 계정이 낸 신청·정산·예약 등이
              「시험」 배지를 달고 섞여 보이고, 숫자도 실제 업무와 다릅니다.
            </span>
            <button
              type="button"
              onClick={() => setShowTests(false)}
              className="font-semibold underline underline-offset-2"
            >
              끄기
            </button>
          </div>
        </div>
      )}
    </>
  )
}
