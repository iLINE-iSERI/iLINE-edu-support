'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import PosterImage from '@/components/ui/PosterImage'

/**
 * 포스터 뷰어 (D-81 · 09-18) — 3:4 칸에 contain 으로 보여 주고, 누르면 원본을 띄운다.
 *
 * 라이브러리 없이 브라우저 기본 `<dialog>` 를 쓴다 — ESC·바깥 클릭으로 닫히고,
 * 초점이 안에 갇히고, 화면 읽기에도 모달로 알린다.
 *
 * 확대·축소 (09-18 두 번째 지시서 3): 포스터 안 작은 글씨를 읽을 수 있게.
 *   [−] [+] 25% 단위, 50%~250% · 휠로도 · 100% 넘으면 끌어서 이동(pan) · [↺] 맞춤으로.
 *   그림은 `transform: translate() scale()` 하나로 움직인다 — 레이아웃을 다시 계산하지 않아
 *   부드럽다. 휠은 모달 안에서만 잡으므로 페이지 스크롤과 안 섞인다.
 *
 * D-86 (09-18): 본문 그림은 `PosterImage`(next/image · 표시 폭만큼) 로, **원본은 뷰어를
 * 여는 순간에 처음** 받는다 — 250% 확대까지 있어 여기만 원본이 맞고, 상세를 여는 모두가
 * 원본을 받을 이유는 없다. 원본이 오는 동안 "불러오는 중" 을 띄운다.
 */

const MIN = 0.5
const MAX = 2.5
const STEP = 0.25

export default function PosterViewer({
  url,
  title,
  className = '',
}: {
  url: string
  title: string
  className?: string
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [scale, setScale] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null)

  const clamp = (v: number) => Math.min(MAX, Math.max(MIN, Math.round(v * 100) / 100))
  const reset = useCallback(() => {
    setScale(1)
    setPos({ x: 0, y: 0 })
  }, [])
  const zoomBy = (d: number) =>
    setScale((s) => {
      const next = clamp(s + d)
      if (next <= 1) setPos({ x: 0, y: 0 }) // 맞춤 이하로 줄면 가운데로
      return next
    })

  /** 뷰어를 한 번이라도 열었나 — 그때부터 원본 <img> 를 그린다 (그 전엔 요청도 없음) */
  const [opened, setOpened] = useState(false)
  const [origLoaded, setOrigLoaded] = useState(false)

  const open = () => {
    reset()
    setOpened(true)
    ref.current?.showModal()
  }
  const close = () => ref.current?.close()

  /* 휠 — 브라우저 기본(페이지 스크롤)을 막아야 해서 passive: false 로 직접 단다.
     React 의 onWheel 은 passive 라 preventDefault 가 안 먹는다. */
  const stageRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      zoomBy(e.deltaY < 0 ? STEP / 2 : -STEP / 2)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  /* 끌어서 이동 — 100% 넘을 때만. 포인터 캡처로 그림 밖으로 나가도 이어진다 */
  const onPointerDown = (e: React.PointerEvent) => {
    if (scale <= 1) return
    drag.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    setPos({
      x: drag.current.px + (e.clientX - drag.current.x),
      y: drag.current.py + (e.clientY - drag.current.y),
    })
  }
  const onPointerUp = () => {
    drag.current = null
  }

  const btn =
    'touch-target flex items-center justify-center rounded-lg bg-white/15 text-white hover:bg-white/30 disabled:opacity-30 disabled:hover:bg-white/15'

  return (
    <>
      <button
        type="button"
        onClick={open}
        className={
          'group relative block overflow-hidden rounded-xl bg-surface shadow-md ' + className
        }
        aria-label={`${title} 포스터 크게 보기`}
      >
        {/* 본문 폭: max-w-sm(24rem) — 큰 모니터의 18px 루트에서도 432px 이 최대 */}
        <PosterImage
          url={url}
          alt={`${title} 포스터`}
          sizes="(max-width: 640px) 88vw, 432px"
          quality={80}
          priority
          className="w-full"
        />
        <span
          aria-hidden="true"
          className="absolute bottom-3 right-3 rounded-lg bg-ink/70 px-2.5 py-1 text-xs font-bold text-white opacity-80 transition group-hover:opacity-100"
        >
          크게 보기
        </span>
      </button>

      <dialog
        ref={ref}
        className="h-[100dvh] max-h-none w-screen max-w-none bg-transparent p-0 backdrop:bg-ink/85"
        onClose={reset}
        onClick={(e) => {
          // 그림·도구 막대 밖(백드롭 = dialog 자신)을 누르면 닫는다
          if (e.target === ref.current) close()
        }}
      >
        {/* 도구 막대 — 위 가운데 고정 */}
        <div
          className="pointer-events-none fixed inset-x-0 top-3 z-10 flex justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="pointer-events-auto flex items-center gap-1 rounded-xl bg-ink/80 p-1 text-white shadow-lg backdrop-blur"
            role="toolbar"
            aria-label="포스터 보기 도구"
          >
            <button type="button" onClick={() => zoomBy(-STEP)} disabled={scale <= MIN} className={btn} aria-label="축소">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14" /></svg>
            </button>
            <span className="min-w-[3.5rem] text-center text-sm font-bold tabular-nums" aria-live="polite">
              {Math.round(scale * 100)}%
            </span>
            <button type="button" onClick={() => zoomBy(STEP)} disabled={scale >= MAX} className={btn} aria-label="확대">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            </button>
            <button type="button" onClick={reset} className={btn} aria-label="맞춤 크기로">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></svg>
            </button>
            <span className="mx-1 h-6 w-px bg-white/30" aria-hidden="true" />
            <button type="button" onClick={close} className={btn} aria-label="닫기">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {/* 무대 — 그림이 여기 안에서 커지고 움직인다. 넘치는 부분은 잘리고 끌어서 본다 */}
        <div
          ref={stageRef}
          className="relative flex h-full w-full items-center justify-center overflow-hidden p-4 pt-16"
          onClick={(e) => {
            // 무대(빈 곳)를 눌러도 닫히게 — 그림 위는 제외
            if (e.target === stageRef.current) close()
          }}
        >
          {opened && !origLoaded && (
            <p
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-ink/70 px-3 py-2 text-sm font-semibold text-white"
              role="status"
            >
              원본을 불러오는 중…
            </p>
          )}
          {opened && (
          <img
            src={url}
            alt={`${title} 포스터`}
            draggable={false}
            onLoad={() => setOrigLoaded(true)}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onDoubleClick={() => (scale === 1 ? zoomBy(1) : reset())}
            style={{
              transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
              cursor: scale > 1 ? (drag.current ? 'grabbing' : 'grab') : 'zoom-in',
              transition: drag.current ? 'none' : 'transform 120ms ease-out',
            }}
            className={
              'max-h-full max-w-full select-none rounded-xl object-contain shadow-2xl ' +
              (origLoaded ? '' : 'opacity-0')
            }
          />
          )}
        </div>
      </dialog>
    </>
  )
}
