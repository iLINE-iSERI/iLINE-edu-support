'use client'

/**
 * 폼이 열리면 그 폼으로 화면을 옮긴다.
 *
 * ── 왜 필요한가 ─────────────────────────────────────────────
 * 담당자 화면들은 목록 **아래에** 등록·수정 폼이 열린다. 그런데 [수정]을
 * 눌러도 화면은 그대로라, **폼이 열린 것을 못 보고** "안 눌렸나" 하게 된다.
 * 공고가 여러 개 쌓이면 목록이 길어져 더 심해진다. (09-08 iSERI 제기)
 *
 * ── 왜 커서(포커스)까지 옮기지 않는가 ───────────────────────
 * 첫 입력칸에 커서를 두면 **휴대폰에서 키보드가 즉시 올라와** 폼을 절반쯤
 * 가린다. 문제였던 것은 "폼이 열린 줄 모르는 것"이므로 **스크롤만으로
 * 해결된다.** 대신 제목에 포커스를 옮겨, 화면 낭독기를 쓰는 사람도
 * "무엇이 열렸는지" 알 수 있게 한다.
 *
 * ── 쓰는 법 ─────────────────────────────────────────────────
 *   const formRef = useRevealForm(editingId)
 *   ...
 *   <form ref={formRef}>
 *     <h2 data-reveal-title tabIndex={-1}>…</h2>
 *
 * `key` 가 **null 이 아닌 값으로 바뀔 때마다** 움직인다. 그래서 다른 항목의
 * [수정]을 연달아 눌러도 그때마다 따라간다.
 */

import { useEffect, useRef } from 'react'

export function useRevealForm<T extends HTMLElement = HTMLFormElement>(
  key: string | null
) {
  const ref = useRef<T>(null)

  useEffect(() => {
    if (key === null) return
    const el = ref.current
    if (!el) return

    // 렌더가 끝난 뒤에 움직여야 위치가 정확하다.
    const id = window.requestAnimationFrame(() => {
      // 움직임을 불편해하는 설정을 존중한다.
      const still = window.matchMedia?.(
        '(prefers-reduced-motion: reduce)'
      ).matches
      el.scrollIntoView({
        behavior: still ? 'auto' : 'smooth',
        block: 'start',
      })

      // 제목으로 포커스만 옮긴다 — 입력칸이 아니다 (위 주석 참고).
      const title = el.querySelector<HTMLElement>('[data-reveal-title]')
      title?.focus({ preventScroll: true })
    })

    return () => window.cancelAnimationFrame(id)
  }, [key])

  return ref
}
