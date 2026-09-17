/**
 * 신청 CTA 의 "상태 기반" 스크롤 (09-18 다섯 번째 지시서).
 *
 * [신청서 작성하러 가기 ↓] 를 누르면 신청서 상태를 보고 세 갈래로 간다.
 *   A. 아무것도 안 썼음        → 신청 상자(#apply) 맨 위 (안내·동의 문구를 건너뛰지 않게)
 *   B. 쓰다 말았음(필수 빈 칸) → **화면 순서상 가장 위의 빈 필수 칸** — 파란 링 두 번 + 초점
 *   C. 필수 다 채움            → 제출 버튼 — 링 + 초점 (제출은 안 한다)
 * 폼이 없으면(로그인 전·마감·이미 신청) A 와 같이 #apply 로.
 *
 * 필수 여부의 단일 출처: 네이티브 `required` + 그룹 컨테이너의 `data-field-required`
 * (체크박스·라디오·첨부는 required 로 표현되지 않아서 — ApplicationForm 머리 주석).
 * 채움 여부: 네이티브 값 + `data-field-filled`(파일 input 은 값이 비워지므로 상태를 알려 준다).
 * 이 파일은 **스크롤과 초점만** 다룬다 — 검증을 부르거나 오류를 띄우지 않는다.
 */

type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement

const SKIP_TYPES = new Set(['hidden', 'submit', 'button', 'reset'])

/** 화면 순서대로, 보이는 것만. 같은 name 의 라디오·체크박스는 첫 것이 대표 */
export function collectFields(root: HTMLElement): Field[] {
  const all = Array.from(root.querySelectorAll<Field>('input, select, textarea'))
  const seen = new Set<string>()
  const out: Field[] = []
  for (const el of all) {
    const type = el instanceof HTMLInputElement ? el.type : el.tagName.toLowerCase()
    if (SKIP_TYPES.has(type)) continue
    if (el.disabled || (el as HTMLInputElement).readOnly) continue
    if (el.offsetParent === null) continue // display:none · 접힌 구획
    if (el.closest('[aria-hidden="true"]')) continue
    if ((type === 'radio' || type === 'checkbox') && el.name) {
      const key = type + ':' + el.name
      if (seen.has(key)) continue
      seen.add(key)
    }
    out.push(el)
  }
  return out
}

function groupOf(el: Field): Field[] {
  const type = (el as HTMLInputElement).type
  if ((type === 'radio' || type === 'checkbox') && el.name && el.form) {
    return Array.from(
      el.form.querySelectorAll<HTMLInputElement>(`input[type="${type}"][name="${CSS.escape(el.name)}"]`)
    )
  }
  return [el]
}

export function isFilled(el: Field): boolean {
  const marked = el.closest<HTMLElement>('[data-field-filled]')
  if (marked) return marked.dataset.fieldFilled === 'true'
  if (el instanceof HTMLSelectElement) return el.value !== ''
  if (el instanceof HTMLTextAreaElement) return el.value.trim() !== ''
  switch (el.type) {
    case 'radio':
    case 'checkbox':
      return groupOf(el).some((g) => (g as HTMLInputElement).checked)
    case 'file':
      return (el.files?.length ?? 0) > 0
    default:
      return el.value.trim() !== ''
  }
}

export function isRequired(el: Field): boolean {
  return (
    el.required ||
    el.getAttribute('aria-required') === 'true' ||
    el.closest('[data-field-required]') !== null
  )
}

/** 라벨을 포함한 필드 묶음 — 링을 두르고 스크롤 기준으로 삼는다 */
export function fieldGroup(el: Field): HTMLElement {
  return (
    el.closest<HTMLElement>('[data-field-group], fieldset') ??
    (el.type === 'checkbox' || el.type === 'radio' ? el.closest<HTMLElement>('label') : null) ??
    el.parentElement ??
    el
  )
}

export function fieldLabel(el: Field): string {
  const g = fieldGroup(el)
  // 묶음(fieldset)이면 그 제목(legend)이 "역할"처럼 짧고 정확하다 — 개별 라디오 글자보다
  const legend = g.tagName === 'FIELDSET' ? g.querySelector('legend') : null
  // 라벨 없는 칸(첨부 input)은 그 구획의 제목(h2)으로
  const heading = el.closest('section')?.querySelector('h2, h3')
  const raw = (legend?.textContent ?? el.labels?.[0]?.textContent ?? heading?.textContent ?? '')
    .replace(/\*|필수|선택/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const txt = raw.length > 40 ? raw.slice(0, 40) + '…' : raw
  return txt || '다음'
}

/* ── 스크롤·피드백 ───────────────────────────────────────────────────── */

function headerOffset(): number {
  const h = document.querySelector('header')?.offsetHeight ?? 112
  return h + 24
}

function afterScrollSettled(cb: () => void) {
  let done = false
  const fire = () => {
    if (done) return
    done = true
    window.removeEventListener('scrollend', fire)
    cb()
  }
  const w = window as Window & { onscrollend?: unknown }
  if ('onscrollend' in w) {
    window.addEventListener('scrollend', fire)
    window.setTimeout(fire, 900) // Safari 등 scrollend 미지원 방어
  } else {
    window.setTimeout(fire, 600)
  }
}

function announce(text: string) {
  let live = document.getElementById('seek-live')
  if (!live) {
    live = document.createElement('div')
    live.id = 'seek-live'
    live.setAttribute('aria-live', 'polite')
    live.className = 'sr-only'
    document.body.appendChild(live)
  }
  live.textContent = ''
  window.setTimeout(() => {
    live!.textContent = text
  }, 50)
}

function pulse(el: HTMLElement, cls: 'form-arrive' | 'field-seek-target') {
  // 중복 하이라이트 방지 — 이전 것부터 뗀다
  document
    .querySelectorAll('.field-seek-target, .form-arrive')
    .forEach((n) => n.classList.remove('field-seek-target', 'form-arrive'))
  el.classList.remove(cls)
  void el.offsetWidth // 애니메이션을 다시 돌리기 위한 리플로
  el.classList.add(cls)
  if (cls === 'field-seek-target') {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const remove = () => el.classList.remove(cls)
    if (reduced) window.setTimeout(remove, 1400)
    else el.addEventListener('animationend', remove, { once: true })
  }
}

export function scrollToTarget(
  el: HTMLElement,
  opts: { pulse: 'form-arrive' | 'field-seek-target'; focus?: HTMLElement | null; announce?: string }
) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const top = Math.max(0, window.scrollY + el.getBoundingClientRect().top - headerOffset())
  window.scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' })
  afterScrollSettled(() => {
    pulse(el, opts.pulse)
    opts.focus?.focus({ preventScroll: true }) // preventScroll — 없으면 smooth 와 충돌해 튄다
    if (opts.announce) announce(opts.announce)
  })
}

/**
 * 진입점. `formRoot` 가 없으면(폼이 안 열려 있음) 신청 상자로 간다.
 */
export function seekApplication(applyBox: HTMLElement | null, formRoot: HTMLFormElement | null) {
  if (!formRoot) {
    if (applyBox) scrollToTarget(applyBox, { pulse: 'form-arrive', focus: applyBox })
    return
  }
  const fields = collectFields(formRoot)
  const anyFilled = fields.some(isFilled)

  // A. 손대지 않음 — 안내 상자 맨 위 (현행 그대로)
  if (!anyFilled) {
    if (applyBox) scrollToTarget(applyBox, { pulse: 'form-arrive', focus: applyBox })
    return
  }

  // B. 쓰다 말음 — 가장 위의 빈 필수 칸
  const missing = fields.find((f) => isRequired(f) && !isFilled(f))
  if (missing) {
    const group = fieldGroup(missing)
    scrollToTarget(group, {
      pulse: 'field-seek-target',
      focus: missing,
      announce: `${fieldLabel(missing)} 항목으로 이동했습니다.`,
    })
    return
  }

  // C. 다 채움 — 제출 버튼
  const submit = formRoot.querySelector<HTMLElement>('button[type="submit"]')
  if (submit) {
    scrollToTarget(submit, {
      pulse: 'field-seek-target',
      focus: submit,
      announce: '모든 필수 항목이 작성되었습니다. 제출 버튼으로 이동했습니다.',
    })
  }
}
