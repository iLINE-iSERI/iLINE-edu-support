'use client'

import { useEffect, useState } from 'react'
import { cardText, CARD_TEXT_CLS, ITEM_MAX } from '@/lib/ui/programCardText'

/**
 * 담당자 화면 — 소개글이 **목록 카드에서 어떻게 보일지** 미리보기 (D-90 · 09-18).
 *
 * 빈 줄 없이 엔터만으로 쓴 공고가 목록에서 한 줄로 뭉개진 것을 배포 뒤에야 알았다. 저장·공개
 * 없이 입력하면서 바로 본다. 파싱은 목록 카드와 **같은 함수**(`lib/ui/programCardText`) —
 * 여기서 다시 구현하지 않는다. 카드 전체를 흉내 내지 않고 소개글 영역만.
 *
 * 폭: 목록 카드 글 영역의 데스크톱 실제 폭 — 컨테이너 1140 − 좌우 32×2 = 1076, 카드 패딩 20×2,
 * 포스터 240 + 간격 20 → **776px**. 폭이 다르면 줄바꿈 자리가 달라져 미리보기가 의미 없다.
 * (1440 이상 모니터에선 목록이 더 넓어 실제로는 덜 잘린다 — 캡션으로 알린다.)
 *
 * aria-live 없음 — 타이핑마다 읽어 주면 방해다. 비공개 프로그램을 목록에 노출하는 방식은
 * 택하지 않았다: 공개 조회에 권한 분기를 넣으면 실수 하나로 미공개 공고가 학생에게 보인다.
 */
export default function DescriptionPreview({ text }: { text: string }) {
  const [shown, setShown] = useState(text)
  useEffect(() => {
    const t = window.setTimeout(() => setShown(text), 200)
    return () => window.clearTimeout(t)
  }, [text])

  const { blurb, items, itemTotal } = cardText(shown)
  const empty = !blurb && items.length === 0

  return (
    <div className="mt-2">
      <p className="text-xs text-ink-subtle">목록 화면에서는 이렇게 보입니다</p>
      <div className="mt-1 max-w-[776px] rounded-xl border border-line bg-surface p-4">
        {empty ? (
          <p className="text-sm text-ink-subtle">
            소개글을 입력하면 목록에서 어떻게 보일지 여기에 표시됩니다.
          </p>
        ) : (
          <>
            {blurb && <p className={CARD_TEXT_CLS.blurb}>{blurb}</p>}
            {items.length > 0 && (
              <ul className={CARD_TEXT_CLS.list}>
                {items.map((line, i) => (
                  <li key={i} className={CARD_TEXT_CLS.item}>
                    {line}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
      <p className="mt-1 text-xs text-ink-subtle">
        {itemTotal > ITEM_MAX
          ? `목록에는 앞 ${ITEM_MAX}개만 보입니다.`
          : '실제 줄바꿈 위치는 화면 폭에 따라 조금 달라집니다.'}
      </p>
    </div>
  )
}
