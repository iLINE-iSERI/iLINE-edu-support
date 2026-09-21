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
 *   ② 아래 표에 한 줄 추가한다 — **끝이다.**
 *      담당자 화면의 선택지(`FORM_OPTIONS`)는 이 표에서 자동으로 만들어진다.
 *      `ApplicationForm` 도 담당자 화면도 건드리지 않는다.
 *      (예전 주석은 담당자 화면에도 한 줄 넣으라고 했으나, `FORM_OPTIONS` 가
 *       생기면서 필요 없어졌다 — 09-22 확인.)
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
import Hackathon2026Form, {
  HACKATHON_2026,
  validate as validateHackathon2026,
  toRows as toRowsHackathon2026,
} from '@/components/apply/forms/Hackathon2026Form'

export type FormValues = Record<string, string>

export interface ProgramForm {
  /** 담당자 화면에서 고를 때 보이는 이름 */
  label: string
  /**
   * 단체 프로그램 공고 화면에 나갈 안내 — **양식이 스스로 말한다** (D-95).
   *
   * 없으면 공고 화면이 기본 문구(대표자 일괄 제출)를 쓴다. 그 기본값은
   * 기본 신청서 기준이라, **전용 양식이 다른 방식을 쓰면 여기에 적어야 한다.**
   *
   * 왜 양식이 가지나: 공고 화면은 "단체면 대표자가 일괄 제출할 것"이라고
   * **짐작**해서 문구를 냈는데, AI-EDU 전용 양식은 「팀원 각자 신청」이었다.
   * 그래서 로그인 전 공고에는 "대표자가 낸다", 로그인 뒤 신청서에는
   * "각자 낸다" 가 같이 떠 있었다. 짐작하는 쪽이 말하면 언젠가 어긋난다 —
   * 규칙을 아는 쪽(양식)이 말하면 갈라질 자리가 없다.
   */
  groupNotice?: {
    /** 요약 카드 「신청 방식」 한 줄. `maxTeamSize` 는 화면이 뒤에 붙인다 */
    howToApply: string
    /** 「단체 프로그램 신청 안내」 상자 본문 */
    body: string
  }
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
    groupNotice: {
      howToApply: '팀원이 각자 신청 · 같은 팀명으로 묶임',
      body:
        '팀장 한 분이 팀 전체를 신청하는 것이 아니라, 팀원 모두가 따로 이 신청서를 냅니다. ' +
        '팀원 모두가 똑같은 팀명을 적어야 한 팀으로 묶이니, 팀명을 미리 정해 두세요. ' +
        '띄어쓰기 하나만 달라도 다른 팀으로 보입니다.',
    },
    Component: AiEdu2026Form,
    validate: validateAiEdu2026,
    toRows: toRowsAiEdu2026,
  },
  [HACKATHON_2026]: {
    label: 'AI-EDU Next Class 해커톤 (2026)',
    groupNotice: {
      howToApply: '팀원이 각자 신청 · 같은 팀명으로 묶임',
      body:
        '2인 1팀으로 참가하며, 대표자 한 분이 팀 전체를 신청하는 것이 아니라 ' +
        '두 사람 모두 따로 이 신청서를 냅니다. 두 사람이 똑같은 팀명을 적어야 ' +
        '한 팀으로 묶이니, 팀명을 미리 정해 두세요. 띄어쓰기 하나만 달라도 ' +
        '다른 팀으로 보입니다. 지원 트랙·과제와 제출 서류는 대표자만 작성합니다.',
    },
    Component: Hackathon2026Form,
    validate: validateHackathon2026,
    toRows: toRowsHackathon2026,
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
