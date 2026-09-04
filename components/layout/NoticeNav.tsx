import SubNav from '@/components/ui/SubNav'

/** 알림마당 하위 메뉴 (D-13 · 대메뉴 4) */
export const NOTICE_NAV = [
  { href: '/notice', label: '공지사항' },
  { href: '/notice/resources', label: '서식 자료실' },
  { href: '/notice/faq', label: 'FAQ · 문의' },
] as const

export default function NoticeNav() {
  return <SubNav items={NOTICE_NAV} />
}
