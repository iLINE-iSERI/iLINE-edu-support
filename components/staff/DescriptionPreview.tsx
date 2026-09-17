'use client'

import { useEffect, useState } from 'react'
import { cardText, visibleItems, CARD_TEXT, type CardMode } from '@/lib/ui/programCardText'

/**
 * 담당자 화면 — 소개글이 **목록 카드에서 어떻게 보일지** 미리보기 (D-90 → D-91 · 09-18).
 *
 * 빈 줄 없이 엔터만으로 쓴 공고가 목록에서 한 줄로 뭉개진 것을 배포 뒤에야 알았다. 저장·공개
 * 없이 입력하면서 바로 본다. 파싱은 목록 카드와 **같은 함수**(`lib/ui/programCardText`) —
 * 여기서 다시 구현하지 않는다. 카드 전체를 흉내 내지 않고 소개글 영역만.
 *
 * D-91: [휴대폰] [PC] 토글, 기본 **휴대폰** — 학생 대부분이 휴대폰으로 보고 잘림도 거기서만
 * 생긴다(D-90 에서 "모바일은 범위 밖" 이라 한 판단을 뒤집음). 폭·개수·클램프는 CARD_TEXT
 * (단일 출처)에서 가져온다 — 미리보기에 값을 따로 적지 않는다.
 *
 * aria-live 없음 — 타이핑마다 읽어 주면 방해다. 비공개 프로그램을 목록에 노출하는 방식은
 * 택하지 않았다: 공개 조회에 권한 분기를 넣으면 실수 하나로 미공개 공고가 학생에게 보인다.
 */
const MODES: CardMode[] = ['mobile', 'desktop']
const MODE_LABEL: Record<CardMode, string> = { mobile: '휴대폰', desktop: 'PC' }

export default function DescriptionPreview({ text }: { text: string }) {
  const [mode, setMode] = useState<CardMode>('mobile')
  const [shown, setShown] = useState(text)
  useEffect(() => {
    const t = window.setTimeout(() => setShown(text), 200)
    return () => window.clearTimeout(t)
  }, [text])

  const rule = CARD_TEXT[mode]
  const { blurb, items: all, itemTotal } = cardText(shown)
  const items = visibleItems(all, mode)
  const empty = !blurb && items.length === 0

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-xs text-ink-subtle">목록 화면에서는 이렇게 보입니다</p>
        <div
          className="inline-flex rounded-lg border border-line p-0.5"
          role="group"
          aria-label="미리보기 화면 폭"
        >
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={
                'rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ' +
                (mode === m ? 'bg-brand-600 text-white' : 'text-ink-muted hover:bg-ink/5')
              }
            >
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-subtle">학생 대부분은 휴대폰으로 봅니다.</p>
      </div>
      {/* 상자 안쪽 폭 = 규칙 폭 (패딩 16×2 를 더한다) */}
      <div
        className="mt-1.5 rounded-xl border border-line bg-surface p-4"
        style={{ maxWidth: rule.width + 32 }}
      >
        {empty ? (
          <p className="text-sm text-ink-subtle">
            소개글을 입력하면 목록에서 어떻게 보일지 여기에 표시됩니다.
          </p>
        ) : (
          <>
            {blurb && <p className={CARD_TEXT.blurbBase + ' ' + rule.blurbClamp}>{blurb}</p>}
            {items.length > 0 && (
              <ul className={CARD_TEXT.listBase}>
                {items.map((line, i) => (
                  <li key={i} className={CARD_TEXT.itemBase + ' ' + rule.itemClamp}>
                    {line}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
      <p className="mt-1 text-xs text-ink-subtle">
        {itemTotal > rule.itemMax
          ? `${MODE_LABEL[mode]}에서는 앞 ${rule.itemMax}개만 보입니다.`
          : '실제 줄바꿈 위치는 화면 폭에 따라 조금 달라집니다.'}
      </p>
    </div>
  )
}
