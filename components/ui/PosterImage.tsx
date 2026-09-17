'use client'

import { useState } from 'react'
import Image from 'next/image'

/**
 * 포스터 그림 한 장 — 목록 카드·상세 화면 공용 (D-86 · 09-18).
 *
 * `next/image` 로 화면 크기에 맞는 WebP 를 받는다. 09-18 실측: 5346×7560(40MP) 원본을
 * 260px 칸에 그대로 내려받고 있었다(1.4초, 유선). `sizes` 가 없으면 Next 가 100vw 로
 * 보고 큰 그림을 고르므로 **호출하는 쪽이 실제 표시 폭을 반드시 넘긴다.**
 *
 * 도착 전에는 테마색 6% 단색 자리(.poster-skeleton) — shimmer 는 안 쓴다(카드가 쌓이면
 * 화면 전체가 번쩍인다). 도착하면 200ms 페이드인, 움직임 줄이기 설정이면 즉시.
 *
 * 최적화가 실패하면(Vercel 한도 초과 402 · 변환 오류) 원본 주소로 되돌아간다 — 그림이
 * 안 뜨는 것보다 크게 받는 게 낫다. Firebase 주소는 `?alt=media&token=` 까지가 주소다 —
 * 가공하지 않고 그대로 넘긴다.
 */
export default function PosterImage({
  url,
  alt,
  sizes,
  priority = false,
  quality = 78,
  className = '',
}: {
  url: string
  alt: string
  /** 실제 표시 폭 — 예: "(max-width: 640px) 240px, 260px" */
  sizes: string
  /** 첫 화면의 주인공(상세 포스터)이면 true — 목록은 false(lazy) */
  priority?: boolean
  quality?: number
  /** 3:4 틀에 줄 클래스 (폭·여백). aspect·relative 는 여기서 준다 */
  className?: string
}) {
  const [loaded, setLoaded] = useState(false)
  const [fallback, setFallback] = useState(false)

  return (
    <span className={'poster-skeleton relative block aspect-[3/4] overflow-hidden ' + className}>
      <Image
        src={url}
        alt={alt}
        fill
        sizes={sizes}
        quality={quality}
        priority={priority}
        unoptimized={fallback}
        onLoad={() => setLoaded(true)}
        onError={() => {
          if (!fallback) setFallback(true)
        }}
        className={'poster-img object-contain ' + (loaded ? 'is-loaded' : '')}
      />
    </span>
  )
}
