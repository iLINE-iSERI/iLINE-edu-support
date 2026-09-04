/**
 * 회원가입 2단계 진행 표시.
 *
 * 가입이 두 단계로 나뉜 이유(D-23)를 화면에서 알려주지 않으면
 * "가입했는데 왜 또 등록하라고 하지?" 하고 혼란스럽다.
 * 시작할 때부터 전체 그림을 보여준다.
 */
export default function SignupSteps({ current }: { current: 1 | 2 }) {
  const steps = [
    { n: 1, label: '계정 만들기' },
    { n: 2, label: '회원 정보 입력' },
  ] as const

  return (
    <ol className="mb-6 flex items-center gap-2" aria-label="회원가입 진행 단계">
      {steps.map((s, i) => {
        const done = current > s.n
        const active = current === s.n
        return (
          <li key={s.n} className="flex flex-1 items-center gap-2">
            <span
              aria-current={active ? 'step' : undefined}
              className={
                'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ' +
                (done
                  ? 'bg-status-approved text-white'
                  : active
                    ? 'bg-brand-600 text-white'
                    : 'bg-subtle text-ink-subtle')
              }
            >
              {done ? '✓' : s.n}
            </span>
            <span
              className={
                'text-xs font-semibold ' +
                (active ? 'text-ink' : 'text-ink-subtle')
              }
            >
              {s.label}
            </span>
            {i === 0 && <span className="h-px flex-1 bg-line" />}
          </li>
        )
      })}
    </ol>
  )
}
