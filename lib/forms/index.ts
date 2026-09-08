/**
 * 프로그램 전용 신청 양식 등록소 (D-50).
 *
 * ── 왜 등록소인가 ─────────────────────────────────────────
 * 프로그램마다 신청 항목이 다르다. 그렇다고 **모든 경우를 담는 폼**을
 * 만들려다 막혔던 것이 D-29 이고, 그래서 기본 신청서는 자유 기재란
 * 하나 + 첨부 하나로 줄였다.
 *
 * 이 등록소는 그 판단을 뒤집지 않는다. **여전히 폼 빌더는 없다.**
 * 프로그램별로 화면을 하나씩 손으로 만들고, 여기에 이름을 걸어둘 뿐이다.
 * 신청서(`ApplicationForm`)는 어떤 양식이 있는지 알 필요가 없다 —
 * 프로그램 문서의 `formType` 으로 여기서 찾아 끼운다.
 *
 * ── 양식을 하나 더 만들 때 ───────────────────────────────
 *   ① `components/apply/forms/<이름>.tsx` 를 만든다
 *      (기본 내보내기 = 화면, `validate`, `toRows`)
 *   ② 아래 표에 한 줄 추가한다
 *   ③ 담당자 화면(`app/staff/programs`)의 선택지에 한 줄 추가한다
 *   **`ApplicationForm` 은 건드리지 않는다.**
 *
 * 양식이 서너 개 쌓이고 공통점이 눈에 보이면 그때 묶어도 늦지 않다.
 * 지금 미리 추상화하면 틀린 추상화가 된다.
 */

import type { ComponentType } from 'react'
import AiEdu2026Form, {
  AI_EDU_2026,
  validate as validateAiEdu2026,
  toRows as toRowsAiEdu2026,
} from '@/components/apply/forms/AiEdu2026Form'

export type FormValues = Record<string, string>

export interface ProgramForm {
  /** 담당자 화면에서 고를 때 보이는 이름 */
  label: string
  Component: ComponentType<{
    value: FormValues
    onChange: (key: string, val: string) => void
  }>
  /** 문제가 있으면 안내 문구, 없으면 null */
  validate: (v: FormValues) => string | null
  /**
   * 저장할 `{라벨, 값}` 목록.
   * 라벨을 함께 저장하는 이유는 `Application.formData` 주석 참고 —
   * 이 파일을 나중에 고쳐도 **옛 신청서가 무슨 질문에 답했는지** 남는다.
   */
  toRows: (v: FormValues) => { label: string; value: string }[]
}

export const PROGRAM_FORMS: Record<string, ProgramForm> = {
  [AI_EDU_2026]: {
    label: 'AI-EDU 연구반 (2026)',
    Component: AiEdu2026Form,
    validate: validateAiEdu2026,
    toRows: toRowsAiEdu2026,
  },
}

/** 프로그램에 걸린 전용 양식 — 없거나 모르는 이름이면 undefined */
export function formFor(formType?: string): ProgramForm | undefined {
  if (!formType) return undefined
  const found = PROGRAM_FORMS[formType]
  if (!found) {
    // 프로그램에 적힌 양식 이름을 여기서 못 찾는 상황.
    // 담당자가 오타를 냈거나, 양식을 지웠는데 프로그램이 남아 있는 경우다.
    // **신청 자체는 막지 않는다** — 기본 신청서로 받는 편이,
    // 접수 기간에 아무도 신청하지 못하는 것보다 낫다.
    console.warn(`[iLINE] 모르는 신청 양식입니다: ${formType}`)
  }
  return found
}

/** 담당자 화면의 선택 목록 */
export const FORM_OPTIONS = [
  { value: '', label: '기본 신청서 (자유 기재란 + 첨부)' },
  ...Object.entries(PROGRAM_FORMS).map(([value, f]) => ({
    value,
    label: f.label,
  })),
]
