/**
 * 프로그램 소개 본문 → 목록 카드에 보일 { 요약, 항목[] } (D-87 → D-88 → D-89 → D-90 · 09-18).
 *
 * **공용 함수 하나.** 목록 카드(`components/apply/ProgramCard`)와 담당자 화면의 미리보기
 * (`components/staff/DescriptionPreview`)가 이 함수를 같이 쓴다 — 두 곳이 갈라지면 미리보기가
 * 거짓말을 하고, 그건 미리보기가 없는 것보다 나쁘다(D-90). 규칙이 바뀌면 여기만 고친다.
 *
 * 내력: D-87 은 "이모지가 문장 중간에 박힌다" 를 보고 첫 문단만 남겼는데, 그러자 「💰 지원:
 * 팀당 최대 50만 원…」처럼 지원을 결심시키는 줄이 사라졌다. 문제는 이모지가 아니라 **줄 구조가
 * 지워진 것**이었다 — 줄 앞머리의 이모지는 훑기를 돕는 불릿이다(D-88). D-88 은 "첫 문단 뒤의
 * 패턴 줄"만 항목으로 봐서 빈 줄 없이 엔터로만 쓴 공고가 한 줄로 뭉개졌다 → D-89 2단 판별.
 *
 *   요약  빈 줄이 있으면 첫 문단(안의 줄바꿈은 공백 — 두 줄로 감싼 요약을 반 토막 내지 않게),
 *         빈 줄이 없으면 첫 줄 · 화면에서 2줄 클램프
 *   항목  나머지 줄 중 (가) 패턴 줄(이모지·불릿·앞 12자 안 콜론)이 하나라도 있으면 패턴 줄만,
 *         (나) 하나도 없으면 남은 줄을 순서대로 · 개수·클램프는 CARD_TEXT(모드별)
 *   (가)(나) 를 섞지 않는다 — 「요약 → 줄글 문단 → 이모지 항목」에서 줄글이 자리를 차지해 뒤
 *   이모지 항목이 밀리면 안 된다. 넘치면 앞에서 itemMax 개("외 N개" 없음 — 자세한 건 상세에서).
 *
 * 휴리스틱이다 — 근본 해법은 `highlights` 필드(백로그). 원문은 가공하지 않는다(이모지 유지).
 */

/**
 * 목록 카드와 담당자 미리보기가 공유하는 **표시 규칙의 단일 출처** (D-91 보충).
 *
 * 규칙이 화면별로 둘로 갈라지면서(휴대폰/PC) 목록 카드는 CSS 브레이크포인트로, 미리보기는
 * JS 토글로 모드를 가른다 — 메커니즘이 달라도 **숫자와 클래스는 여기서만** 읽는다. 화면 파일에
 * `3`, `'line-clamp-1'` 같은 값을 직접 쓰지 않는다.
 *
 *   휴대폰  요약 2줄 · 항목 3개 × 각 2줄 (1줄 클램프는 좁은 폭에서 「💰 지원: 팀당 최대 …」처럼
 *          숫자를 통째로 날려 없느니만 못했다. 지시서는 2개였으나 실제 공고가 👥→📊→💰 순이라
 *          2개면 결심시키는 💰 줄이 통째로 빠진다 → 3개 · iSERI 09-18)
 *   PC     요약 2줄 · 항목 3개 × 각 1줄
 * width 는 미리보기 재현용 — 휴대폰 343(375 − 16×2) · PC 776(컨테이너 1076 − 카드 패딩 40 − 포스터 240 − 간격 20)
 *
 * 목록 카드의 개수 차이는 JS 로 폭을 재서 분기하지 않고 **CSS 로 숨긴다** — 서버 렌더링 때는 폭을
 * 알 수 없어 하이드레이션 불일치가 난다(테마에서 같은 문제로 하이드레이션 전 스크립트를 쓴다).
 */
export const CARD_TEXT = {
  mobile: { itemMax: 3, itemClamp: 'line-clamp-2', blurbClamp: 'line-clamp-2', width: 343 },
  desktop: { itemMax: 3, itemClamp: 'line-clamp-1', blurbClamp: 'line-clamp-2', width: 776 },

  /**
   * 목록 카드(반응형)용 정적 클래스. ⚠️ 위 mobile/desktop 값과 반드시 일치시킬 것.
   * ⚠️ 템플릿 리터럴로 조합하지 말 것 — Tailwind 가 글자 그대로 찾으므로 빌드에서 누락된다.
   * (lib 의 클래스는 tailwind.config content 에 `lib/**` 가 있어야 나간다 — D-91 에서 추가)
   */
  responsive: {
    blurbClamp: 'line-clamp-2',
    itemClamp: 'line-clamp-2 md:line-clamp-1',
    /** mobile.itemMax 를 넘는 항목에 붙인다 — 휴대폰에서 숨기고 PC 에서 다시 보인다 */
    itemOverflow: 'hidden md:list-item',
  },

  /** 글자 스타일 — 클램프를 뺀 공통 부분 */
  blurbBase: 'break-keep text-sm leading-[1.65] text-ink-muted',
  listBase: 'mt-1.5 space-y-0.5 text-sm leading-[1.6] text-ink-muted',
  itemBase: 'break-keep',
} as const

export type CardMode = 'mobile' | 'desktop'

/** 모드에 맞게 자른다 — 자르기는 모드를 아는 쪽에서 (cardText 는 자르지 않는다) */
export function visibleItems(items: string[], mode: CardMode): string[] {
  return items.slice(0, CARD_TEXT[mode].itemMax)
}

const ITEM_RE = [
  // (a) 이모지로 시작 — tsconfig target 이 es5 라 리터럴 /…/u 가 안 통해 생성자로(브라우저는 다 됨)
  new RegExp('^\\s*\\p{Extended_Pictographic}', 'u'),
  /^\s*[-•·※▪◦*]/, // (b) 불릿 기호
  /^.{0,12}:/, // (c) 앞 12자 안에 콜론 — "대상: …"
]
const isPattern = (line: string) => ITEM_RE.some((re) => re.test(line))

export type CardText = {
  blurb: string
  /** 항목 후보 전부 — 자르지 않는다. 몇 개 보일지는 모드를 아는 쪽(visibleItems)이 정한다 */
  items: string[]
  /** = items.length. 미리보기가 "앞 N개만 보입니다" 를 띄우는 근거 */
  itemTotal: number
}

export function cardText(text?: string): CardText {
  const src = (text ?? '').trim()
  if (!src) return { blurb: '', items: [], itemTotal: 0 }
  const paras = src.split(/\n\s*\n/)
  let blurb: string
  let restLines: string[]
  if (paras.length > 1) {
    blurb = paras[0].replace(/\s*\n\s*/g, ' ').trim()
    restLines = paras.slice(1).join('\n').split('\n')
  } else {
    const lines = src.split('\n')
    blurb = (lines[0] ?? '').trim()
    restLines = lines.slice(1)
  }
  const rest = restLines.map((l) => l.trim()).filter(Boolean)
  const patterned = rest.filter(isPattern)
  const candidates = patterned.length > 0 ? patterned : rest
  return { blurb, items: candidates, itemTotal: candidates.length }
}
