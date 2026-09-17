'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * 상세 화면 오른쪽 고정 카드의 틀 (09-18 네 번째 지시서).
 *
 * 맨 위(scrollY < 100)에서는 카드가 틀의 위에 붙어 왼쪽 포스터와 줄이 맞고,
 * 스크롤을 내리면 **헤더 아래 영역의 세로 가운데**까지 부드럽게 미끄러진다(0.35s).
 * 다시 올리면 제자리로. 화면 높이가 750px 미만이면 가운데로 안 내린다(버튼이 잘림).
 *
 * 틀(.sticky-side)은 헤더 아래부터 화면 끝까지 sticky 로 서 있고, 카드만 transform 으로
 * 움직인다 — 지시서의 `top: 50vh` 전환은 sticky 위치 자체를 바꿔 덜컥거리고 페이지 맨
 * 위에서 제목 띠를 덮기 때문에, 위치는 두고 카드만 옮기는 쪽으로 했다.
 */
export default function StickyAside({ children }: { children: ReactNode }) {
  const frame = useRef<HTMLElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    const update = () => {
      const f = frame.current
      const c = card.current
      if (!f || !c) return
      const atTop = window.scrollY < 100
      const tall = window.innerHeight >= 750
      const room = f.clientHeight - c.offsetHeight
      setOffset(!atTop && tall && room > 0 ? Math.round(room / 2) : 0)
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    // 카드 안 내용(상태 확인 → 버튼)이 바뀌면 높이도 바뀐다
    const ro = card.current ? new ResizeObserver(update) : null
    if (card.current && ro) ro.observe(card.current)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      ro?.disconnect()
    }
  }, [])

  return (
    <aside ref={frame} className="sticky-side">
      <div
        ref={card}
        style={{
          transform: `translateY(${offset}px)`,
          transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {children}
      </div>
    </aside>
  )
}
