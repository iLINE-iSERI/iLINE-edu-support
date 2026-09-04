'use client'

/**
 * 회원 전용 화면 보호막 (D-23).
 *
 * 로그인만으로는 통과시키지 않는다. 창의재단 회원 문서가 있어야 한다.
 * 그뤠잇 회원이 로그인한 채 넘어오면 회원 등록 화면으로 안내한다.
 *
 * ⚠️ 이건 UX 안내용이다. 실제 보안은 Firestore Rules가 담당한다.
 *    클라이언트 가드는 우회 가능하므로, Rules 없이 이것만 믿으면 안 된다.
 */

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, type ReactNode } from 'react'
import { useAuth } from './AuthProvider'
import SetupNotice from './SetupNotice'

export default function MemberGate({
  children,
  /** staff 전용 화면이면 true */
  requireStaff = false,
}: {
  children: ReactNode
  requireStaff?: boolean
}) {
  const { status, member, errorMessage, isSetupIssue } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (status === 'guest') {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`)
    }
  }, [status, router, pathname])

  if (status === 'loading') {
    return <Notice title="확인 중입니다…" />
  }

  if (status === 'guest') {
    return <Notice title="로그인이 필요합니다" desc="로그인 화면으로 이동합니다." />
  }

  if (status === 'error') {
    return (
      <div className="container-page py-16">
        <div className="mx-auto max-w-lg">
          {isSetupIssue ? (
            <SetupNotice message={errorMessage} />
          ) : (
            <Notice
              title="회원 정보를 확인하지 못했습니다"
              desc={errorMessage || '잠시 후 다시 시도해 주세요.'}
            />
          )}
        </div>
      </div>
    )
  }

  if (status === 'unregistered') {
    return (
      <Notice
        title="회원가입이 아직 끝나지 않았습니다"
        desc="계정은 만들어졌지만 참여 정보 입력이 남아 있습니다. 2단계를 마치시면 신청·정산 기능을 이용하실 수 있습니다."
        action={{ href: `/register?next=${encodeURIComponent(pathname)}`, label: '가입 마저 하기' }}
      />
    )
  }

  if (status === 'withdrawn') {
    return (
      <Notice
        title="탈퇴 처리된 계정입니다"
        desc="이용을 재개하시려면 담당자에게 문의해 주세요."
        action={{ href: '/notice/faq', label: '문의하기' }}
      />
    )
  }

  if (requireStaff && member?.role !== 'staff') {
    return (
      <Notice
        title="접근 권한이 없습니다"
        desc="담당자 전용 화면입니다."
        action={{ href: '/', label: '홈으로' }}
      />
    )
  }

  return <>{children}</>
}

function Notice({
  title,
  desc,
  action,
}: {
  title: string
  desc?: string
  action?: { href: string; label: string }
}) {
  return (
    <div className="container-page py-16">
      <div className="mx-auto max-w-lg rounded-2xl border border-line bg-surface p-6 text-center sm:p-8">
        <h2 className="text-lg font-bold">{title}</h2>
        {desc && (
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">{desc}</p>
        )}
        {action && (
          <Link
            href={action.href}
            className="touch-target mt-6 inline-flex items-center justify-center rounded-xl bg-brand-600 px-6 font-semibold text-white hover:bg-brand-700"
          >
            {action.label}
          </Link>
        )}
      </div>
    </div>
  )
}
