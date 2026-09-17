'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { getThemeFromPath } from '@/lib/theme'

/**
 * 화면 안에서 메뉴를 옮길 때(클라이언트 라우팅) body 의 data-theme 를 갱신한다.
 * 첫 로드는 layout 의 THEME_BOOT_SCRIPT 가 먼저 붙이므로 깜빡임이 없다.
 */
export default function ThemeSync() {
  const pathname = usePathname()
  useEffect(() => {
    document.body.setAttribute('data-theme', getThemeFromPath(pathname))
  }, [pathname])
  return null
}
