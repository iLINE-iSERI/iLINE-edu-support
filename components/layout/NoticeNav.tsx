import SubNav from '@/components/ui/SubNav'

/**
 * 알림마당 하위 메뉴 (D-13 · 대메뉴 4)
 *
 * ⏸ **「서식 자료실」 탭은 숨겨 두었다** (D-106 · 09-25 iSERI). 화면은 늘
 *    「등록된 자료가 없습니다」였고 담당자가 자료를 올릴 화면도 없었다 —
 *    방문자에게 빈 탭만 보이던 것을 치웠다. **코드는 남겨 두었다**
 *    (`app/notice/resources/page.tsx` · 규칙 `support_resources`).
 *    살릴지는 교수님 답(한 장 ⑧)을 보고 정한다. 되살리려면 아래 줄을
 *    공지사항 다음에 다시 넣고, **자료를 올리는 담당자 화면부터** 만든다.
 *      { href: '/notice/resources', label: '서식 자료실' },
 */
export const NOTICE_NAV = [
  { href: '/notice', label: '공지사항' },
  { href: '/notice/faq', label: 'FAQ · 문의' },
  { href: '/notice/inquiry', label: '1:1 문의' },
] as const

export default function NoticeNav() {
  return <SubNav items={NOTICE_NAV} />
}
