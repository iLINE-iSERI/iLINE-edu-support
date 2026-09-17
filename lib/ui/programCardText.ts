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
 *         (나) 하나도 없으면 남은 줄을 순서대로 · 최대 ITEM_MAX · 각 1줄 클램프
 *   (가)(나) 를 섞지 않는다 — 「요약 → 줄글 문단 → 이모지 항목」에서 줄글이 자리를 차지해 뒤
 *   이모지 항목이 밀리면 안 된다. 넘치면 앞에서 ITEM_MAX 개("외 N개" 없음 — 자세한 건 상세에서).
 *
 * 휴리스틱이다 — 근본 해법은 `highlights` 필드(백로그). 원문은 가공하지 않는다(이모지 유지).
 */

export const ITEM_MAX = 3

const ITEM_RE = [
  // (a) 이모지로 시작 — tsconfig target 이 es5 라 리터럴 /…/u 가 안 통해 생성자로(브라우저는 다 됨)
  new RegExp('^\\s*\\p{Extended_Pictographic}', 'u'),
  /^\s*[-•·※▪◦*]/, // (b) 불릿 기호
  /^.{0,12}:/, // (c) 앞 12자 안에 콜론 — "대상: …"
]
const isPattern = (line: string) => ITEM_RE.some((re) => re.test(line))

export type CardText = {
  blurb: string
  items: string[]
  /** 자르기 전 후보 줄 수 — 미리보기가 "앞 3개만 보입니다" 를 띄우는 근거 */
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
  return { blurb, items: candidates.slice(0, ITEM_MAX), itemTotal: candidates.length }
}

/** 요약·항목의 글자 스타일 — 목록 카드와 미리보기가 같은 클래스를 쓴다 */
export const CARD_TEXT_CLS = {
  blurb: 'line-clamp-2 break-keep text-sm leading-[1.65] text-ink-muted',
  list: 'mt-1.5 space-y-0.5 text-sm leading-[1.6] text-ink-muted',
  item: 'line-clamp-1 break-keep',
} as const
