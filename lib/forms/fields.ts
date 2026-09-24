/**
 * 담당자가 만든 신청서 칸 — **규칙의 단일 출처** (D-99).
 *
 * 담당자 화면(`app/staff/programs`)과 신청자 화면(`components/apply`)이
 * 각자 규칙을 갖지 않게 한다. 두 곳이 갈라지면 담당자가 본 것과 신청자가 낸 것이
 * 달라지고, 그건 없는 것보다 나쁘다 (`profileRows` 가 화면·PDF 를 한 곳에서
 * 먹이는 것과 같은 이유 — `lib/types/index.ts`).
 *
 * ⚠️ `lib/forms/index.ts`(전용 양식 등록소)는 React 컴포넌트를 import 하므로
 *    **이 파일은 그쪽을 부르지 않는다.** 담당자 화면이 등록소를 끌어오면
 *    쓰지도 않는 신청 화면이 통째로 딸려 온다.
 *
 * ── 저장 경로 ────────────────────────────────────────────────
 *   글 상자 · 동의 → `formValues[fid]` (원본, 수정 화면 되살리기용)
 *                    + `formData` 의 `{라벨, 값}` 한 줄 (사람이 읽는 사본)
 *   동의 본문      → `formValues[fid + BODY_SUFFIX]` — **동의한 그 시점의 전문**
 *   첨부          → `Application.files` (지금까지와 같음, 답 줄 없음)
 *
 * `formData` 에 태우는 것이 핵심이다. 시트는 O열 한 칸에 「라벨: 값」을 쌓고(D-50),
 * PDF·담당자 화면도 그 줄을 그대로 그린다 → **칸이 늘어도 규칙·시트 열·PDF·
 * 담당자 화면을 하나도 안 건드린다.**
 */

import type {
  GroupEntry,
  Program,
  ProgramField,
  ProgramFieldKind,
} from '@/lib/types'

/**
 * 단체 프로그램 안내 문구 두 벌 (D-99′).
 *
 * **전용 양식이 자기 문구를 갖고 있으면 그쪽이 이긴다**(D-95). 이 표는
 * 기본 신청서처럼 **아는 주체가 없을 때** 담당자가 고른 값으로 쓴다.
 * 문구를 화면에 흩어 두지 않는 이유는 D-95 와 같다 — 두 곳에 두면 갈라진다.
 */
export const GROUP_NOTICE: Record<
  GroupEntry,
  { howToApply: string; body: string }
> = {
  leader: {
    howToApply: '대표자가 팀원 명단과 함께',
    body:
      '대표자 한 분이 팀원의 이름·학번·전공·학년·연락처를 함께 제출합니다. ' +
      '팀원 전원에게 미리 동의를 받은 뒤 입력해 주세요. 신청서에서 동의 여부를 확인합니다.',
  },
  each: {
    howToApply: '팀원이 각자 신청 · 같은 팀명으로 묶임',
    body:
      '대표자 한 분이 팀 전체를 신청하는 것이 아니라, 팀원 모두가 따로 이 신청서를 냅니다. ' +
      '팀원 모두가 똑같은 팀명을 적어야 한 팀으로 묶이니, 팀명을 미리 정해 두세요. ' +
      '띄어쓰기 하나만 달라도 다른 팀으로 보입니다.',
  },
}

/** 공고가 고른 방식 — 없으면 지금까지의 동작(대표자 일괄) */
export function groupEntryOf(p: Pick<Program, 'groupEntry'>): GroupEntry {
  return p.groupEntry === 'each' ? 'each' : 'leader'
}

/** 동의 본문 스냅샷의 키 꼬리표 */
export const BODY_SUFFIX = '.body'
/** 칸 이름표 접두어 — 전용 양식의 손수 쓴 키(teamName·track…)와 절대 안 겹치게 */
export const FID_PREFIX = 'f_'
/** 한 공고의 칸 수 상한 — 시트 O열 한 칸에 전부 들어가므로 */
export const MAX_FIELDS = 12

export function bodyKey(fid: string): string {
  return fid + BODY_SUFFIX
}

/** 새 줄의 이름표. 짧게 — 담당자가 Firebase 콘솔에서 문서를 볼 때 읽혀야 한다 */
export function newFieldId(): string {
  return (
    FID_PREFIX +
    Math.random().toString(36).slice(2, 8) +
    Date.now().toString(36).slice(-4)
  )
}

export function fieldsOf(p: Pick<Program, 'formFields'>): ProgramField[] {
  return p.formFields ?? []
}

/** 첨부 칸 — 공고당 하나뿐이다 */
export function attachmentField(
  p: Pick<Program, 'formFields'>
): ProgramField | undefined {
  return fieldsOf(p).find((f) => f.kind === 'attachment')
}

/** 담당자·신청자 화면에 보이는 이름 (첨부는 고정) */
export function fieldTitle(f: ProgramField): string {
  return f.kind === 'attachment' ? '첨부 서류' : (f.label ?? '').trim()
}

/** 고르기의 두 갈래 — 없으면 빈 두 칸 */
export function optionsOf(f: ProgramField): [string, string] {
  const o = f.options ?? ['', '']
  return [(o[0] ?? '').trim(), (o[1] ?? '').trim()]
}

/**
 * 신청자가 **읽고 답한 글 전체** — 이 글자가 달라지면 다시 물어야 한다.
 *
 * 🔴 **동의(`consent`)의 결과를 절대 바꾸면 안 된다.** 이미 제출된 신청서에는
 *    `f.body` 만 보관돼 있다. 여기에 뭘 더 이어 붙이면 **기존 동의 전부가
 *    「본문이 바뀐 것」으로 판정되어**, 낸 사람 모두가 다시 체크해야 한다.
 *    고르기는 D-100 에서 새로 생겼으므로 옛 기록이 없어 자유롭다.
 */
function sealText(f: ProgramField): string {
  if (f.kind === 'choice') return [f.body ?? '', ...optionsOf(f)].join('\n')
  return f.body ?? ''
}

/* ── 저장용 다듬기 ──────────────────────────────────────────── */

/**
 * 저장 직전 정리 — 「값이 없으면 칸도 없다」(D-29)를 배열에도 적용한다.
 *   · 이름과 본문이 **둘 다 빈 줄은 버린다** (「칸 추가」만 누르고 저장한 경우)
 *   · `label`·`body` 는 trim 후 비면 **키 자체를 안 만든다**
 *   · `required`·`multiline` 은 **참일 때만** 넣는다
 *   · 첨부는 **첫 하나만** 남긴다 (화면으로는 도달 불가 — 콘솔 대비 마지막 방어선)
 */
export function cleanFields(rows: ProgramField[]): ProgramField[] {
  const out: ProgramField[] = []
  let sawAttachment = false

  for (const r of rows) {
    const label = (r.label ?? '').trim()
    const body = (r.body ?? '').trim()
    // 고르기는 선택지만 적어 둔 줄도 살린다 — 버리면 담당자가 적은 것이 사라진다
    const filled = label || body || (r.kind === 'choice' && optionsOf(r).some(Boolean))
    if (!filled) continue
    if (r.kind === 'attachment') {
      if (sawAttachment) continue
      sawAttachment = true
    }

    const f: ProgramField = { fid: r.fid, kind: r.kind }
    if (label && r.kind !== 'attachment') f.label = label
    if (body) f.body = body
    if (r.multiline && r.kind === 'text') f.multiline = true
    // 고르기는 **선택지가 답의 뜻을 정하므로** 비어도 키를 남긴다.
    // 여기서 지우면 담당자 화면이 「두 갈래가 없는 고르기」를 그리게 된다.
    if (r.kind === 'choice') f.options = optionsOf(r)
    if (r.required) f.required = true
    out.push(f)
  }
  return out
}

/* ── 담당자 화면 검증 ───────────────────────────────────────── */

/**
 * 줄마다의 문제 — `{ 'row-<fid>': 사유 }`. 문제가 없으면 빈 객체.
 * `legacyLabel` 은 옛 자유 기재란 이름(있으면 이름 중복 검사에 함께 넣는다).
 */
export function fieldProblems(
  rows: ProgramField[],
  legacyLabel?: string
): Record<string, string> {
  const bad: Record<string, string> = {}
  const seen = new Map<string, number>()
  const add = (name: string) => seen.set(name, (seen.get(name) ?? 0) + 1)
  if (legacyLabel?.trim()) add(legacyLabel.trim())

  let attachments = 0
  for (const r of rows) {
    const key = `row-${r.fid}`
    const label = (r.label ?? '').trim()
    const body = (r.body ?? '').trim()

    if (r.kind === 'attachment') {
      attachments += 1
      if (attachments > 1) bad[key] = '첨부 칸은 하나만 둘 수 있습니다.'
      else if (!body) bad[key] = '무엇을 어떻게 내는지 적어 주세요.'
      continue
    }

    if (!label) {
      bad[key] = '칸 이름을 적어 주세요.'
      continue
    }
    add(label)
    if (r.kind === 'consent' && !body) {
      bad[key] = '신청자가 읽을 본문을 적어 주세요.'
    }
    if (r.kind === 'choice') {
      const [a, b] = optionsOf(r)
      // 하나만 적힌 경우를 먼저 잡는다 — 「고를 것이 하나」는 고르기가 아니다
      if (!a || !b) bad[key] = '고를 것을 두 개 다 적어 주세요.'
      else if (a === b) bad[key] = '고를 것 두 개가 같습니다.'
    }
  }

  // 이름 중복 — 미관 문제가 아니다. 담당자 신청 상세가 `formData` 를 라벨로
  // 구분해 그리므로, 같은 이름이 둘이면 어느 답인지 알 수 없다.
  for (const r of rows) {
    const key = `row-${r.fid}`
    if (bad[key] || r.kind === 'attachment') continue
    const label = (r.label ?? '').trim()
    if ((seen.get(label) ?? 0) > 1) bad[key] = '이름이 같은 칸이 있습니다.'
  }
  return bad
}

/* ── 신청자 화면 ────────────────────────────────────────────── */

type Values = Record<string, string>

/** 동의 칸이 「확인함」인가 */
export function isAgreed(v: Values, f: ProgramField): boolean {
  return v[f.fid] === 'y'
}

/**
 * 고르기에서 **고른 값** — 아직 안 골랐거나, 담당자가 선택지를 고쳐
 * 옛 답이 어느 쪽도 아니게 되었으면 빈 문자열.
 */
export function pickedOf(v: Values, f: ProgramField): string {
  const val = (v[f.fid] ?? '').trim()
  return val && optionsOf(f).includes(val) ? val : ''
}

/**
 * 이 동의 칸을 **다시 물어야 하는가** (D-98 결함 ② 수정).
 *
 * 보관된 본문이 지금 공고 본문과 다르거나 아예 없으면 다시 묻는다.
 * 이것이 없으면 — 제출 뒤 담당자가 본문을 새로 적었을 때, 신청자가 다른 이유로
 * 수정 저장하는 순간 **읽은 적 없는 동의가 기록된다.**
 */
export function isStale(v: Values, f: ProgramField): boolean {
  if (f.kind !== 'consent' && f.kind !== 'choice') return false
  const kept = v[bodyKey(f.fid)]
  return kept === undefined || kept !== sealText(f)
}

/** 수정 화면을 **열 때** 한 번 — 본문이 달라진 동의는 답과 스냅샷을 비운다 */
export function clearStale(fields: ProgramField[], v: Values): Values {
  const out = { ...v }
  for (const f of fields) {
    if ((f.kind === 'consent' || f.kind === 'choice') && isStale(v, f)) {
      delete out[f.fid]
      delete out[bodyKey(f.fid)]
    }
  }
  return out
}

/**
 * 제출 직전 한 번 — 신청자가 **읽은 글을 그 시점 값으로 확정**한다 (동의·고르기).
 * ⚠️ **거부한 동의의 본문도 남긴다.** `Consent` 주석의 "거부도 반드시 기록한다"와
 *    같은 이유 — 기록이 없는 것과 거부한 것은 다르다.
 *
 * 🔴 **고르기에는 답을 대신 채워 넣지 않는다** (D-100). 동의는 체크박스 하나라
 *    안 누른 것을 `'n'`(거부)으로 적을 수밖에 없었는데, 그 때문에 **선택 동의에서
 *    「그냥 지나친 사람」이 「거부한 사람」으로 기록되는** 문제가 있었다. 고르기는
 *    두 갈래를 다 적어 두므로 **안 고르면 답이 없는 채로** 둔다 — 답이 없으면
 *    신청서에 줄도 생기지 않는다(「묻지 않은 항목은 줄을 만들지 않는다」).
 *    거부를 반드시 남겨야 하는 항목이면 **필수로 두고 「동의하지 않음」을 고르게** 한다.
 */
export function sealBodies(fields: ProgramField[], v: Values): Values {
  const out = { ...v }
  for (const f of fields) {
    if (f.kind !== 'consent' && f.kind !== 'choice') continue
    // 안 고른 고르기도 본문은 얼린다 — 안 그러면 다음 수정 화면에서
    // 「내용이 바뀌었습니다」 경고가 뜬다(바뀐 게 없는데도)
    if (out[bodyKey(f.fid)] === undefined) out[bodyKey(f.fid)] = sealText(f)
    if (f.kind === 'consent' && out[f.fid] === undefined) out[f.fid] = 'n'
  }
  return out
}

/**
 * 첫 번째 문제의 안내 문구 — 없으면 null.
 * **배열 순서대로 돈다** = 화면 순서대로. 위에 있는 문제를 먼저 지적해야 한다.
 */
export function firstProblem(
  fields: ProgramField[],
  v: Values,
  ctx: { isEdit: boolean; fileCount: number }
): string | null {
  for (const f of fields) {
    const name = fieldTitle(f)
    if (f.kind === 'text') {
      if (f.required && !(v[f.fid] ?? '').trim()) {
        return `「${name}」을(를) 입력해 주세요.`
      }
    } else if (f.kind === 'attachment') {
      // 수정 모드에서는 첨부를 못 바꾸므로 묻지 않는다
      if (f.required && !ctx.isEdit && ctx.fileCount === 0) {
        return '첨부 서류를 올려 주세요.'
      }
    } else if (f.kind === 'choice') {
      // 고르기 — 필수면 골라야 하고, 보여 준 글이 바뀌었으면 수정 중에도 다시 묻는다
      const must = f.required && (!ctx.isEdit || isStale(v, f))
      if (must && !pickedOf(v, f)) {
        return `「${name}」에서 하나를 골라 주세요.`
      }
    } else {
      // 동의 — 필수면 체크해야 하고, 본문이 바뀌었으면 수정 중에도 다시 묻는다
      const must = f.required && (!ctx.isEdit || isStale(v, f))
      if (must && !isAgreed(v, f)) {
        return `「${name}」을(를) 확인하고 체크해 주세요.`
      }
    }
  }
  return null
}

/**
 * 신청서에 저장할 `{라벨, 값}` 줄.
 * · 첨부는 건너뛴다 — 답이 없다(파일 이름은 PDF 「첨부 서류」와 드라이브에 있다)
 * · 빈 글 상자는 줄을 만들지 않는다 (「묻지 않은 항목은 줄 자체를 만들지 않는다」)
 * · 동의는 「확인함 / 확인하지 않음」 — **본문은 여기 넣지 않는다**(시트가 비대해진다)
 */
export function rowsForFields(
  fields: ProgramField[],
  v: Values
): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = []
  for (const f of fields) {
    if (f.kind === 'attachment') continue
    const label = fieldTitle(f)
    if (!label) continue
    if (f.kind === 'consent') {
      if (v[f.fid] === undefined) continue
      rows.push({ label, value: isAgreed(v, f) ? '확인함' : '확인하지 않음' })
    } else if (f.kind === 'choice') {
      // 고른 글자를 그대로 — 안 골랐으면 줄을 만들지 않는다
      const picked = pickedOf(v, f)
      if (picked) rows.push({ label, value: picked })
    } else {
      const val = (v[f.fid] ?? '').trim()
      if (val) rows.push({ label, value: val })
    }
  }
  return rows
}

/**
 * PDF 「동의·선택한 내용」에 그릴 것 — **읽은 글 전문까지.**
 * 공고를 나중에 고쳐도 이 PDF 는 그때의 글을 들고 있다.
 *
 * 고르기도 함께 넣는다 — 「동의함 / 동의하지 않음」을 고르게 한 항목은
 * **무엇을 보고 골랐는지**가 동의와 똑같이 근거가 된다 (D-100).
 */
export function answerSnapshots(
  fields: ProgramField[],
  v: Values
): { label: string; body: string; answer: string }[] {
  const out: { label: string; body: string; answer: string }[] = []
  for (const f of fields) {
    const kept = v[bodyKey(f.fid)] ?? f.body ?? ''
    if (f.kind === 'consent') {
      if (v[f.fid] === undefined) continue
      out.push({
        label: fieldTitle(f),
        body: kept,
        answer: isAgreed(v, f) ? '확인함' : '확인하지 않음',
      })
    } else if (f.kind === 'choice') {
      const picked = pickedOf(v, f)
      if (!picked) continue
      // 얼려 둔 글에는 선택지도 이어져 있다 — 본문만 떼어 낸다
      const body = choiceBody(kept)
      // 읽을 글이 없으면 이 상자에 넣지 않는다 — 「신청 내용」 표에 이미
      // `라벨: 답` 으로 있어서, 넣으면 PDF 에 **같은 것이 두 번** 나온다.
      // 동의는 본문이 근거라 표와 상자에 둘 다 있는 것이 맞다(D-99).
      if (!body.trim()) continue
      out.push({ label: fieldTitle(f), body, answer: picked })
    }
  }
  return out
}

/** 얼려 둔 고르기 글에서 **본문만** — 뒤 두 줄은 선택지다 (`sealText` 의 짝) */
function choiceBody(kept: string): string {
  const lines = kept.split('\n')
  return lines.length > 2 ? lines.slice(0, -2).join('\n') : ''
}

/** 담당자 화면의 「+ 글 상자」 등이 만드는 빈 줄 */
export function blankField(kind: ProgramFieldKind): ProgramField {
  if (kind === 'text') return { fid: newFieldId(), kind, multiline: true }
  // 고르기는 **필수가 기본**이다. 두 갈래를 다 적어 두는 칸에서 「안 고름」을
  // 허용하면, 그 답이 무슨 뜻인지 담당자도 알 수 없다 (D-100).
  if (kind === 'choice') {
    return { fid: newFieldId(), kind, options: ['', ''], required: true }
  }
  return { fid: newFieldId(), kind }
}
