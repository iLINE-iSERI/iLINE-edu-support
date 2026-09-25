'use client'

/**
 * 담당자 프로그램(공고) 관리 — D-37 / Phase 5.5
 *
 * 이 화면이 생기기 전까지 공고를 올리는 수단은 Firebase 콘솔뿐이었다.
 * 콘솔 권한은 컬렉션 단위로 쪼갤 수 없어서, 공고 하나 올리자고 권한을 주면
 * **신청자 개인정보와 회원 문서까지 통째로 열린다.** 그래서 이 화면이 필요하다.
 *
 * 삭제 기능은 **일부러 만들지 않았다.** 신청서가 딸린 프로그램을 지우면 그
 * 신청 기록이 어느 공고 것인지 알 수 없는 고아가 된다. 내리는 것은
 * `published: false` 로 한다.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import Badge from '@/components/ui/Badge'
import DescriptionPreview from '@/components/staff/DescriptionPreview'
import ProgramFieldRows from '@/components/staff/ProgramFieldRows'
import MemberGate from '@/components/auth/MemberGate'
import {
  listAllPrograms,
  programIdTaken,
  createProgram,
  updateProgram,
  setProgramPublished,
  uploadProgramPoster,
  deleteProgramPoster,
  posterRejectReason,
  type ProgramInput,
} from '@/lib/firebase/staff'
import {
  getProgramPhase,
  PHASE_LABEL,
  formatPeriod,
} from '@/lib/firebase/programs'
import { firestoreErrorMessage } from '@/lib/firebase/errors'
import { useRevealForm } from '@/lib/hooks/useRevealForm'
import { FORM_OPTIONS } from '@/lib/forms'
import { blankField, fieldProblems, newFieldId } from '@/lib/forms/fields'
import { Timestamp } from 'firebase/firestore'
import type {
  GroupEntry,
  Program,
  ProgramPoster,
  ProgramField,
  ProgramFieldKind,
} from '@/lib/types'

/* ── 날짜 칸 ↔ Timestamp ───────────────────────────────────────────
   `datetime-local` 은 '2026-09-10T09:00' 같은 문자열을 주고받는다.
   `new Date(문자열)` 은 **브라우저 시간대**로 읽으므로, 담당자가 한국에서
   입력하면 한국 시각으로 저장된다. 서버(UTC)가 아니라 여기서 변환하는 것이
   맞다 — 입력하는 사람이 보는 시각이 기준이어야 한다. */

function toInputValue(ts?: Timestamp): string {
  if (!ts) return ''
  const d = ts.toDate()
  const p = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
    `T${p(d.getHours())}:${p(d.getMinutes())}`
  )
}

function fromInputValue(v: string): Date | undefined {
  if (!v) return undefined
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? undefined : d
}

/** 활동 기간은 날짜만 (D-72) — 'YYYY-MM-DD' ↔ 그날 00:00 */
function toDateInput(ts?: Timestamp): string {
  if (!ts) return ''
  const d = ts.toDate()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
function fromDateInput(v: string): Date | undefined {
  if (!v) return undefined
  const d = new Date(`${v}T00:00`)
  return Number.isNaN(d.getTime()) ? undefined : d
}

interface FormState {
  id: string
  title: string
  year: string
  participationType: 'individual' | 'group'
  formType: string
  maxTeamSize: string
  groupEntry: GroupEntry
  description: string
  opensAt: string
  closesAt: string
  activityStart: string
  activityEnd: string
  noteLabel: string
  noteRequired: boolean
  attachmentGuide: string
  cautionText: string
  attachmentRequired: boolean
  /** 담당자가 만든 칸들 (D-99) — 배열 순서가 곧 화면 순서 */
  fields: ProgramField[]
  /** 산출물 제출 (D-76) */
  outputVisibility: 'private' | 'members'
  outputOpensAt: string
  outputClosesAt: string
  outputGuide: string
  /** 포스터 (D-81) — 저장된 것. 새로 고른 파일은 posterFile(폼 밖 상태)에 */
  poster: ProgramPoster | null
  published: boolean
}

/**
 * 잘못된 칸 → 그 칸 옆에 붙일 사유.
 * 담당자가 만든 줄은 `row-<fid>` 로 담는다 (D-99) — 인덱스가 아니라 이름표를 쓰는
 * 이유는 `ProgramField.fid` 주석 참고(줄이 움직여도 오류가 그 줄에 붙어 있어야 한다).
 */
type FieldKey = keyof FormState | `row-${string}`
type FieldErrors = Partial<Record<FieldKey, string>>

const EMPTY: FormState = {
  id: '',
  title: '',
  year: String(new Date().getFullYear()),
  participationType: 'individual',
  formType: '',
  maxTeamSize: '',
  groupEntry: 'leader',
  description: '',
  opensAt: '',
  closesAt: '',
  activityStart: '',
  activityEnd: '',
  noteLabel: '',
  noteRequired: false,
  attachmentGuide: '',
  cautionText: '',
  attachmentRequired: false,
  fields: [],
  outputVisibility: 'private',
  outputOpensAt: '',
  outputClosesAt: '',
  outputGuide: '',
  poster: null,
  // 새 공고는 항상 비공개로 시작한다. 미리보기가 없으므로,
  // 공개로 시작하면 작성 중인 내용이 그대로 학생에게 보인다.
  published: false,
}

function toForm(p: Program): FormState {
  return {
    id: p.id,
    title: p.title ?? '',
    year: String(p.year ?? ''),
    participationType: p.participationType ?? 'individual',
    formType: p.formType ?? '',
    maxTeamSize: p.maxTeamSize ? String(p.maxTeamSize) : '',
    groupEntry: p.groupEntry === 'each' ? 'each' : 'leader',
    description: p.description ?? '',
    opensAt: toInputValue(p.opensAt),
    closesAt: toInputValue(p.closesAt),
    activityStart: toDateInput(p.activityStart),
    activityEnd: toDateInput(p.activityEnd),
    noteLabel: p.noteLabel ?? '',
    noteRequired: Boolean(p.noteRequired),
    attachmentGuide: p.attachmentGuide ?? '',
    cautionText: p.cautionText ?? '',
    attachmentRequired: Boolean(p.attachmentRequired),
    // 줄 객체까지 복사한다 — 얕게 두면 폼에서 고친 값이 목록의 원본에 새어 나간다
    fields: (p.formFields ?? []).map((f) => ({ ...f })),
    outputVisibility: p.outputVisibility === 'members' ? 'members' : 'private',
    outputOpensAt: toInputValue(p.outputOpensAt),
    outputClosesAt: toInputValue(p.outputClosesAt),
    outputGuide: p.outputGuide ?? '',
    poster: p.poster ?? null,
    published: Boolean(p.published),
  }
}

/**
 * 문제가 난 칸으로 데려간다.
 *
 * 폼이 길어서 안내를 맨 위에만 띄우면, 담당자는 위로 올라가 읽고 다시
 * 내려와 해당 칸을 찾아야 한다. **화면을 옮겨 주고 커서까지 넣어**
 * 바로 고칠 수 있게 한다.
 */
function focusField(key: FieldKey) {
  const el = document.getElementById(`pf-${key}`)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  // 스크롤이 끝난 뒤 커서를 넣는다. 바로 부르면 브라우저가 스크롤을
  // 한 번 더 튕겨서 화면이 흔들린다.
  window.setTimeout(() => (el as HTMLInputElement).focus({ preventScroll: true }), 250)
}

/**
 * 새 단체 공고에 「팀명」 칸을 **미리 한 줄** 넣는다 (D-107 · 09-25 iSERI).
 *
 * 팀명 칸을 만들고 「이 칸이 팀명입니다」까지 체크해야 산출물이 팀으로 묶이는데
 * (D-105), 담당자가 이걸 매번 기억하기를 바라면 **한 번은 반드시 빠뜨린다.**
 * 단체를 고르는 순간 체크된 채로 넣어 두면 빠뜨릴 수가 없다.
 *
 * 🔴 **새 공고에서만.** 이미 올라간 공고에 넣으면 이미 낸 사람들의 신청서에
 *    빈 필수 칸이 생긴다 — 데이터 디깅에서 「칸 추가」 팀명이 이미 있던 것처럼
 *    **팀명 칸이 둘**이 될 수도 있다. 그래서 `isNew` 가 아니면 아무것도 안 한다.
 *
 * **전용 양식을 고르면 넣지 않는다** — AI-EDU·해커톤은 양식이 팀명을 따로 받는다.
 *
 * 개인으로 되돌리거나 전용 양식을 고르면 **손대지 않은 경우에만** 뺀다
 * (`isUntouchedTeamRow`). 담당자가 이름·안내·필수를 하나라도 고쳤으면 그 칸은
 * 담당자 것이므로 남긴다.
 */
function isUntouchedTeamRow(r: ProgramField): boolean {
  return (
    r.kind === 'text' &&
    r.isTeamName === true &&
    (r.label ?? '') === '팀명' &&
    !(r.body ?? '').trim() &&
    r.required === true &&
    !r.multiline
  )
}

function syncTeamRow(f: FormState, isNew: boolean): FormState {
  if (!isNew) return f
  const want = f.participationType === 'group' && !f.formType
  const hasTeamName = f.fields.some((r) => r.kind === 'text' && r.isTeamName)
  if (want && !hasTeamName) {
    // 맨 위에 — 팀명은 신청서에서 가장 먼저 정해져 있어야 하는 것이다
    const row: ProgramField = {
      fid: newFieldId(),
      kind: 'text',
      label: '팀명',
      required: true,
      isTeamName: true,
    }
    return { ...f, fields: [row, ...f.fields] }
  }
  if (!want) {
    const kept = f.fields.filter((r) => !isUntouchedTeamRow(r))
    if (kept.length !== f.fields.length) return { ...f, fields: kept }
  }
  return f
}

export default function StaffProgramsPage() {
  return (
    <MemberGate requireStaff>
      <StaffProgramsContent />
    </MemberGate>
  )
}

function StaffProgramsContent() {
  const [programs, setPrograms] = useState<Program[] | null>(null)
  /** 목록 조회 실패 등 폼과 무관한 오류 */
  const [pageError, setPageError] = useState('')
  const [busy, setBusy] = useState(false)

  /** null: 폼 닫힘 · '': 새 공고 · 그 외: 수정 중인 프로그램 ID */
  const [editingId, setEditingId] = useState<string | null>(null)
  /** 폼이 열리면 그리로 화면을 옮긴다 — 안 그러면 열린 줄 모른다 */
  const formRef = useRevealForm(editingId)
  const [form, setForm] = useState<FormState>(EMPTY)
  /** 새로 고른 포스터 파일 — 저장할 때 올린다 (D-81). 미리보기는 objectURL */
  const [posterFile, setPosterFile] = useState<File | null>(null)
  const [posterMsg, setPosterMsg] = useState('')
  /** 고른 파일의 미리보기 주소 — 파일이 바뀔 때만 만들고, 바뀌면 이전 것을 놓아준다 */
  const [posterPreview, setPosterPreview] = useState<string | null>(null)
  useEffect(() => {
    if (!posterFile) {
      setPosterPreview(null)
      return
    }
    const url = URL.createObjectURL(posterFile)
    setPosterPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [posterFile])
  const [errors, setErrors] = useState<FieldErrors>({})
  /** 저장 버튼 옆에 뜨는 한 줄 — 어느 칸이 문제인지 또는 저장 실패 사유 */
  const [saveMsg, setSaveMsg] = useState('')

  const load = useCallback(async () => {
    setPageError('')
    try {
      setPrograms(await listAllPrograms())
    } catch (e) {
      console.error('[iLINE] 프로그램 목록 조회 실패:', e)
      setPageError(firestoreErrorMessage(e))
      setPrograms([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  /** 값이 바뀌면 그 칸의 오류 표시는 지운다 — 고치는 중에 빨간 글씨가 남으면 헷갈린다 */
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => {
      const next = { ...f, [k]: v }
      // 팀명 칸 미리 넣기(D-107)는 이 둘이 바뀔 때만 — 불러오기(수정 열기)에는 안 탄다
      return k === 'participationType' || k === 'formType'
        ? syncTeamRow(next, editingId === '')
        : next
    })
    setErrors((e) => (e[k] ? { ...e, [k]: undefined } : e))
  }

  /* ── 담당자가 만든 칸 (D-99) ─────────────────────────────────
     줄은 **이름표(fid)로** 찾는다. 인덱스로 찾으면 줄을 지웠을 때
     같은 번호가 다른 질문을 가리킨다 (ProgramField.fid 주석). */

  const setRow = (fid: string, patch: Partial<ProgramField>) => {
    setForm((f) => ({
      ...f,
      fields: f.fields.map((r) => (r.fid === fid ? { ...r, ...patch } : r)),
    }))
    setErrors((e) => (e[`row-${fid}`] ? { ...e, [`row-${fid}`]: undefined } : e))
  }

  const addRow = (kind: ProgramFieldKind) => {
    const row = blankField(kind)
    setForm((f) => ({ ...f, fields: [...f.fields, row] }))
    // 새 줄로 데려간다 — 폼이 길어서 맨 아래에 붙으면 생긴 줄 모른다.
    // 그리기가 끝난 뒤라야 찾을 수 있어 다음 틱으로 미룬다.
    window.setTimeout(() => focusField(`row-${row.fid}`), 0)
  }

  const moveRow = (fid: string, dir: -1 | 1) => {
    setForm((f) => {
      const i = f.fields.findIndex((r) => r.fid === fid)
      const j = i + dir
      if (i < 0 || j < 0 || j >= f.fields.length) return f
      const next = [...f.fields]
      ;[next[i], next[j]] = [next[j], next[i]]
      return { ...f, fields: next }
    })
  }

  const removeRow = (fid: string) => {
    setForm((f) => ({ ...f, fields: f.fields.filter((r) => r.fid !== fid) }))
    setErrors((e) => ({ ...e, [`row-${fid}`]: undefined }))
  }

  function openNew() {
    setForm(EMPTY)
    setPosterFile(null)
    setPosterMsg('')
    setEditingId('')
    setErrors({})
    setSaveMsg('')
    setPageError('')
  }

  function openEdit(p: Program) {
    setForm(toForm(p))
    setPosterFile(null)
    setPosterMsg('')
    setEditingId(p.id)
    setErrors({})
    setSaveMsg('')
    setPageError('')
  }

  function close() {
    setEditingId(null)
    setForm(EMPTY)
    setPosterFile(null)
    setPosterMsg('')
    setErrors({})
    setSaveMsg('')
  }

  function toInput(f: FormState): ProgramInput {
    return {
      title: f.title,
      year: Number(f.year),
      participationType: f.participationType,
      // 단체가 아니면 뜻이 없는 값이라 안 넘긴다 (D-99′)
      groupEntry: f.participationType === 'group' ? f.groupEntry : undefined,
      // 빈 문자열은 '기본 신청서' — toDoc 이 걸러서 저장하지 않는다
      formType: f.formType || undefined,
      maxTeamSize: f.maxTeamSize ? Number(f.maxTeamSize) : undefined,
      description: f.description,
      opensAt: fromInputValue(f.opensAt),
      closesAt: fromInputValue(f.closesAt),
      activityStart: fromDateInput(f.activityStart),
      activityEnd: fromDateInput(f.activityEnd),
      noteLabel: f.noteLabel,
      noteRequired: f.noteRequired,
      attachmentGuide: f.attachmentGuide,
      cautionText: f.cautionText,
      attachmentRequired: f.attachmentRequired,
      // 팀명 표시(D-105)는 단체일 때만 뜻이 있다 — 개인으로 바꾼 공고에 남아 있으면
      // 산출물이 「팀」으로 묶여 버린다. 저장할 때 떼서 문서에 안 남긴다
      formFields:
        f.participationType === 'group'
          ? f.fields
          : f.fields.map((r) => ({ ...r, isTeamName: undefined })),
      outputVisibility: f.outputVisibility,
      outputOpensAt: fromInputValue(f.outputOpensAt),
      outputClosesAt: fromInputValue(f.outputClosesAt),
      outputGuide: f.outputGuide,
      poster: f.poster ?? undefined,
      published: f.published,
    }
  }

  /** 공개/비공개만 뒤집기 — 폼을 열지 않고 목록에서 바로 */
  async function togglePublished(p: Program) {
    setBusy(true)
    setPageError('')
    try {
      // 문서를 재조립하지 않는다 — 공개 여부 한 칸만 (D-99).
      // 예전에는 toInput(toForm(p)) 로 전체를 다시 만들어 넘겼는데,
      // 그러면 공고에 칸이 하나 늘 때마다 FormState·EMPTY·toForm·toInput
      // 네 곳을 다 고쳐야 하고 하나라도 빠뜨리면 이 버튼에 값이 날아갔다.
      await setProgramPublished(p.id, !p.published)
      await load()
    } catch (e) {
      console.error('[iLINE] 공개 상태 변경 실패:', e)
      setPageError(firestoreErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  /**
   * 오류를 칸에 붙이고 **화면에서 가장 위에 있는** 문제 칸으로 데려간다.
   *
   * 객체에 넣은 순서에 기대지 않고 이 목록으로 정한다. 검사 순서를 바꾸면
   * 화면은 그대로인데 커서만 아래에서 위로 튀는 일이 생긴다.
   */
  function reject(found: FieldErrors) {
    setErrors(found)

    // 담당자가 만든 줄은 화면에서 산출물 설정보다 위에 있으므로 그 사이에 끼운다.
    // 정적 배열로 두면 줄이 늘어날 때마다 여기를 고쳐야 한다 (D-99).
    const ORDER: FieldKey[] = [
      'id', 'title', 'year', 'opensAt', 'closesAt', 'activityStart', 'activityEnd',
      ...form.fields.map((f) => `row-${f.fid}` as const),
      'outputClosesAt',
    ]
    const first = ORDER.find((k) => found[k])
    if (!first) return

    const count = Object.values(found).filter(Boolean).length
    setSaveMsg(
      count > 1
        ? `표시된 ${count}곳을 확인해 주세요.`
        : '표시된 칸을 확인해 주세요.'
    )
    focusField(first)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaveMsg('')

    const found: FieldErrors = {}

    if (editingId === '' && !/^[a-z0-9-]+$/.test(form.id)) {
      found.id = form.id.trim()
        ? '영문 소문자·숫자·붙임표(-)만 쓸 수 있습니다'
        : '주소용 ID를 입력해 주세요'
    }

    if (!form.title.trim()) found.title = '프로그램 이름을 입력해 주세요'

    const year = Number(form.year)
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      found.year = '네 자리 숫자로 입력해 주세요 (예: 2026)'
    }

    const opens = fromInputValue(form.opensAt)
    const closes = fromInputValue(form.closesAt)
    if (opens && closes && opens >= closes) {
      found.closesAt = '접수 시작보다 빠릅니다'
    }

    const aStart = fromDateInput(form.activityStart)
    const aEnd = fromDateInput(form.activityEnd)
    if (aStart && aEnd && aStart > aEnd) {
      found.activityEnd = '활동 시작보다 빠릅니다'
    }

    const oOpens = fromInputValue(form.outputOpensAt)
    const oCloses = fromInputValue(form.outputClosesAt)
    if (oOpens && oCloses && oOpens >= oCloses) {
      found.outputClosesAt = '제출 시작보다 빠릅니다'
    }

    // 담당자가 만든 칸 (D-99) — 규칙은 lib/forms/fields.ts 한 곳에 있다.
    // 옛 자유 기재란 이름도 넘겨 이름 중복을 함께 본다.
    Object.assign(found, fieldProblems(form.fields, form.noteLabel))

    /* 중복 ID 확인도 **여기서 함께** 한다.
       예전에는 형식 검사를 모두 통과한 뒤에 물어봤는데, 그러면 연도가 틀려
       있을 때 ID 중복은 검사조차 되지 않아 담당자가 문제를 하나씩 발견하게
       된다. 서버에 한 번 더 물어보는 비용보다 그 왕복이 비싸다.
       (형식이 틀린 ID 는 물어볼 필요가 없으므로 그때만 건너뛴다) */
    setBusy(true)
    if (editingId === '' && !found.id) {
      try {
        if (await programIdTaken(form.id)) {
          found.id = '이미 이 ID를 쓰는 프로그램이 있습니다'
        }
      } catch (e) {
        // ⚠️ 확인에 실패하면 **저장을 멈춘다.** 저장은 통째로 덮어쓰기라서,
        //    중복인 줄 모르고 진행하면 기존 공고를 조용히 날려버린다.
        console.error('[iLINE] ID 중복 확인 실패:', e)
        setBusy(false)
        setSaveMsg('ID 중복 확인에 실패했습니다. 잠시 후 다시 시도해 주세요.')
        return
      }
    }

    if (Object.values(found).some(Boolean)) {
      setBusy(false)
      return reject(found)
    }

    setErrors({})
    try {
      const before = editingId ? programs?.find((p) => p.id === editingId) : undefined
      const input = toInput(form)

      // 포스터 (D-81): 새 파일이 있으면 먼저 올리고 그 결과를 문서에 넣는다.
      // 문서 저장이 실패하면 방금 올린 파일이 남지만, 공개 경로의 고아 파일 하나라
      // 다음 저장 때 덮이거나 지워진다 — 되돌리기 코드는 넣지 않는다.
      const programId = editingId || form.id
      if (posterFile) input.poster = await uploadProgramPoster(programId, posterFile)

      if (editingId) {
        await updateProgram(editingId, input, before?.createdAt)
      } else {
        await createProgram(form.id, input)
      }

      // 옛 포스터 파일 정리 — 바꿨거나 지웠을 때
      const oldPath = before?.poster?.path
      if (oldPath && oldPath !== input.poster?.path) await deleteProgramPoster(oldPath)

      close()
      await load()
    } catch (e) {
      console.error('[iLINE] 프로그램 저장 실패:', e)
      setSaveMsg(firestoreErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="프로그램 관리"
        description="참여 프로그램(공고)을 등록하고 접수 기간과 공개 여부를 관리합니다."
      />

      <div className="container-page space-y-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-4 text-sm">
            <Link
              href="/staff"
              className="font-semibold text-ink-muted underline underline-offset-2"
            >
              ← 관리
            </Link>
            <Link
              href="/staff/notices"
              className="font-semibold text-ink-muted underline underline-offset-2"
            >
              공지 관리
            </Link>
          </div>
          {editingId === null && (
            <button
              type="button"
              onClick={openNew}
              className="touch-target inline-flex items-center justify-center rounded-lg bg-brand-600 px-5 font-bold text-white hover:bg-brand-700"
            >
              새 프로그램 등록
            </button>
          )}
        </div>

        {/* 폼과 무관한 오류만 여기 — 입력 오류는 각 칸 옆에 붙는다 */}
        {pageError && (
          <p
            role="alert"
            className="rounded-lg bg-status-revision/10 px-3 py-2 text-sm leading-relaxed text-status-revision"
          >
            {pageError}
          </p>
        )}

        {/* ── 등록 · 수정 폼 ─────────────────────────────── */}
        {editingId !== null && (
          <form
            ref={formRef}
            onSubmit={save}
            noValidate
            className="space-y-5 rounded-2xl border border-line bg-surface shadow-card p-5"
          >
            <h2 className="font-bold" data-reveal-title tabIndex={-1}>
              {editingId ? `프로그램 수정 · ${editingId}` : '새 프로그램 등록'}
            </h2>

            {/* 주소용 ID — 새로 만들 때만 */}
            {editingId === '' && (
              <Field
                id="id"
                label="주소용 ID"
                error={errors.id}
                hint="인터넷 주소에 그대로 나옵니다. 영문 소문자·숫자·붙임표(-). 만든 뒤에는 바꿀 수 없습니다."
              >
                <input
                  id="pf-id"
                  value={form.id}
                  onChange={(e) => set('id', e.target.value)}
                  placeholder="2026-ai-workshop"
                  className={inputCls(errors.id)}
                  aria-invalid={Boolean(errors.id)}
                />
              </Field>
            )}

            <Field id="title" label="프로그램 이름" error={errors.title}>
              <input
                id="pf-title"
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder="2026 AI 수업 설계 워크숍"
                className={inputCls(errors.title)}
                aria-invalid={Boolean(errors.title)}
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="year" label="사업 연도" error={errors.year}>
                <input
                  id="pf-year"
                  inputMode="numeric"
                  value={form.year}
                  onChange={(e) => set('year', e.target.value)}
                  className={inputCls(errors.year)}
                  aria-invalid={Boolean(errors.year)}
                />
              </Field>

              <Field
                id="participationType"
                label="참여 방식"
                hint="단체를 고르면 신청 방법·팀 인원을 정하게 되고, 새 공고에는 신청서에 「팀명」 칸이 체크된 채로 한 줄 들어갑니다."
              >
                <select
                  id="pf-participationType"
                  value={form.participationType}
                  onChange={(e) =>
                    set(
                      'participationType',
                      e.target.value as FormState['participationType']
                    )
                  }
                  className={inputCls()}
                >
                  <option value="individual">개인 신청</option>
                  <option value="group">단체 프로그램</option>
                </select>
              </Field>
            </div>

            <Field
              id="formType"
              label="신청 양식"
              hint="이 프로그램만의 신청 항목이 필요할 때 고릅니다. 대부분은 '기본 신청서'입니다."
            >
              <select
                id="pf-formType"
                value={form.formType}
                onChange={(e) => set('formType', e.target.value)}
                className={inputCls()}
              >
                {FORM_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {form.formType && (
                <p className="mt-1.5 text-xs leading-relaxed text-ink-subtle">
                  이 프로그램에는 <strong>전용 신청 항목</strong>이 붙습니다.
                  아래에서 만든 칸과 <strong>함께</strong> 나타나므로, 전용 양식에
                  이미 있는 것을 또 묻지 않도록 확인해 주세요.
                  <br />
                  🔴 <strong>전용 양식은 고른 값에 따라 일부 항목을 감출 수
                  있습니다</strong> — 예를 들어 해커톤은 「팀 대표자」를 골랐을 때만
                  트랙·과제·제출 서류가 나옵니다. <strong>화면에 안 보인다고 없는
                  것이 아닙니다.</strong> 같은 질문을 여기서 또 만들기 전에
                  담당자에게 확인해 주세요.
                </p>
              )}
            </Field>

            {form.participationType === 'group' && (
              <Field id="maxTeamSize" label="팀 최대 인원 (대표자 포함)">
                <input
                  id="pf-maxTeamSize"
                  inputMode="numeric"
                  value={form.maxTeamSize}
                  onChange={(e) => set('maxTeamSize', e.target.value)}
                  placeholder="4"
                  className={inputCls()}
                />
              </Field>
            )}

            {/* 단체일 때 **누가 내는가** (D-99′) — 참여 방식과 다른 축이다.
                전용 양식이 자기 문구를 갖고 있으면 그쪽이 이기므로,
                여기서 고른 값은 기본 신청서에만 쓰인다 */}
            {form.participationType === 'group' && (
              <Field
                id="groupEntry"
                label="신청은 누가 하나"
                hint="공고 상세의 「신청 방식」 줄과 안내 상자 문구가 이것에 따라 바뀝니다. 전용 양식이 걸린 공고는 그 양식의 문구가 우선합니다."
              >
                <select
                  id="pf-groupEntry"
                  value={form.groupEntry}
                  onChange={(e) => set('groupEntry', e.target.value as GroupEntry)}
                  className={inputCls()}
                >
                  <option value="leader">대표자 1인이 팀원 명단과 함께 신청</option>
                  <option value="each">팀원이 각자 신청 (같은 팀명으로 묶임)</option>
                </select>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-subtle">
                  {form.groupEntry === 'each' ? (
                    <>
                      <strong>팀명 칸을 꼭 만드세요</strong> — 아래 「칸 추가 → 글 상자」로
                      만들고 필수로 두면, 같은 팀명을 적은 신청끼리 묶입니다.
                    </>
                  ) : (
                    <>
                      대표자가 <strong>남의 개인정보를 대신 입력</strong>하게 되므로,
                      신청 화면에 「팀원 전원에게 미리 동의를 받으라」는 안내가 함께 나갑니다.
                    </>
                  )}
                </p>
              </Field>
            )}

            <Field id="description" label="소개 (선택)">
              <textarea
                id="pf-description"
                rows={3}
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                placeholder="한두 문장으로 프로그램을 설명해 주세요."
                className={inputCls()}
              />
              {/* D-90: 목록 카드 소개글 미리보기 — 저장 없이, 공개 여부와 무관하게 */}
              <DescriptionPreview text={form.description} />
            </Field>

            {/* ── 포스터 (D-81) ──────────────────────────── */}
            <Field
              id="poster"
              label="포스터 (선택)"
              hint="세로(3:4) 이미지가 가장 잘 맞습니다. JPG · PNG · WEBP, 5MB 이하. 홈·목록·상세에 보이고, 누르면 원본 크기로 뜹니다. 누구나 볼 수 있는 곳에 저장되니 개인정보가 든 이미지는 올리지 마세요."
            >
              <div className="flex flex-wrap items-start gap-4">
                {/* 파일을 고른 직후 한 번은 미리보기 주소가 아직 없다(useEffect 뒤에 생김) —
                    그때 form.poster 도 없으면 그릴 게 없으니 건너뛴다 (09-18 iSERI 발견) */}
                {(posterPreview ?? form.poster?.url) && (
                  <img
                    src={posterPreview ?? form.poster?.url}
                    alt="포스터 미리보기"
                    className="aspect-[3/4] w-28 rounded-lg border border-line bg-subtle object-contain"
                  />
                )}
                <div className="min-w-0 flex-1 space-y-2">
                  <input
                    id="pf-poster"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null
                      if (!f) return
                      const reason = posterRejectReason(f)
                      if (reason) {
                        setPosterMsg(reason)
                        e.target.value = ''
                        return
                      }
                      setPosterMsg('')
                      setPosterFile(f)
                    }}
                    className="block w-full text-sm text-ink-muted file:mr-3 file:rounded-lg file:border file:border-line-strong file:bg-surface file:px-3 file:py-2 file:text-sm file:font-semibold file:text-ink hover:file:border-brand-600 hover:file:text-brand-600"
                  />
                  {posterMsg && <p className="text-xs font-semibold text-warn-ink">{posterMsg}</p>}
                  {(posterFile || form.poster) && (
                    <button
                      type="button"
                      onClick={() => {
                        // 새로 고른 파일만 취소 — 저장된 포스터는 그대로. 저장된 것을 지우는 건 다음 누름
                        if (posterFile) setPosterFile(null)
                        else set('poster', null)
                        setPosterMsg('')
                      }}
                      className="text-xs font-semibold text-ink-muted underline underline-offset-2 hover:text-warn-ink"
                    >
                      {posterFile ? '고른 파일 취소' : '포스터 지우기 (저장하면 반영)'}
                    </button>
                  )}
                </div>
              </div>
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                id="opensAt"
                label="접수 시작"
                error={errors.opensAt}
                hint="비우면 곧바로 접수중이 됩니다."
              >
                <input
                  id="pf-opensAt"
                  type="datetime-local"
                  value={form.opensAt}
                  onChange={(e) => set('opensAt', e.target.value)}
                  className={inputCls(errors.opensAt)}
                  aria-invalid={Boolean(errors.opensAt)}
                />
              </Field>
              <Field
                id="closesAt"
                label="접수 마감"
                error={errors.closesAt}
                hint="비우면 상시 접수입니다. 시각까지 정하세요 — 00:00 이면 그날 시작하자마자 마감입니다."
              >
                <input
                  id="pf-closesAt"
                  type="datetime-local"
                  value={form.closesAt}
                  onChange={(e) => set('closesAt', e.target.value)}
                  className={inputCls(errors.closesAt)}
                  aria-invalid={Boolean(errors.closesAt)}
                />
              </Field>
            </div>

            {/* 활동 기간 (D-72) — 접수와 별개. 홈에는 접수 중인 것만 오르고,
                이 값은 목록·상세에 "활동 기간"으로 보인다 */}
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                id="activityStart"
                label="활동 시작일"
                error={errors.activityStart}
                hint="선택. 프로그램이 실제로 진행되는 기간 — 목록·상세에 표시됩니다."
              >
                <input
                  id="pf-activityStart"
                  type="date"
                  value={form.activityStart}
                  onChange={(e) => set('activityStart', e.target.value)}
                  className={inputCls(errors.activityStart)}
                  aria-invalid={Boolean(errors.activityStart)}
                />
              </Field>
              <Field
                id="activityEnd"
                label="활동 종료일"
                error={errors.activityEnd}
                hint="선택. 산출물 제출 기한을 따로 두지 않으면 이 날까지 받습니다."
              >
                <input
                  id="pf-activityEnd"
                  type="date"
                  value={form.activityEnd}
                  onChange={(e) => set('activityEnd', e.target.value)}
                  className={inputCls(errors.activityEnd)}
                  aria-invalid={Boolean(errors.activityEnd)}
                />
              </Field>
            </div>

            {/* ── 신청서 구성 (D-29 → D-99) ─────────────────
                옛 칸 셋(자유 기재란·첨부·유의사항)은 **값이 있을 때만** 보인다.
                새 공고는 아래 목록만 쓴다 — 옛 칸을 만들 길을 없앤 일방통행이다. */}
            <div className="space-y-5 rounded-xl bg-subtle p-4">
              <div>
                <h3 className="font-bold">신청서에 추가할 칸</h3>
                <p className="mt-1 text-xs leading-relaxed text-ink-subtle">
                  비워두면 신청서는 <strong>내 정보 확인 후 제출</strong>만
                  있습니다. 필요한 만큼 <strong>글 상자 · 첨부 · 동의</strong>를
                  더하고, 칸마다 필수 여부를 정하세요.
                </p>
              </div>

              <ProgramFieldRows
                rows={form.fields}
                errors={errors}
                onChange={setRow}
                onAdd={addRow}
                onMove={moveRow}
                onRemove={removeRow}
                isGroup={form.participationType === 'group'}
                // 팀원이 각자 신청 + 기본 신청서면 팀명 칸이 **있어야** 산출물이 묶인다.
                // 전용 양식은 자기가 팀명을 받으므로 여기서 요구하지 않는다 (D-105)
                teamNameExpected={
                  form.participationType === 'group' &&
                  form.groupEntry === 'each' &&
                  !form.formType
                }
              />

              {/* 옛 방식 칸 (D-29) — **값이 있는 공고에만** 보인다.
                  새 공고는 위 목록만 쓴다. 지우고 저장하면 그 칸이 문서에서
                  사라지므로, 담당자가 스스로 졸업시킬 수 있다 (이주 스크립트 없음). */}
              {(form.noteLabel.trim() ||
                form.attachmentGuide.trim() ||
                form.cautionText.trim()) && (
                <div className="space-y-5 rounded-lg border border-line-strong bg-surface p-4">
                  <p className="text-sm font-bold">
                    옛 방식 칸
                    <span className="ml-2 font-normal text-xs text-ink-subtle">
                      이 공고가 예전 방식으로 만들어졌습니다. 그대로 두셔도 되고,
                      지우고 위 목록으로 옮기셔도 됩니다.
                    </span>
                  </p>
              <Field
                id="noteLabel"
                label="자유 기재란 이름 (선택)"
                hint="적으면 그 이름의 글쓰는 칸이 생깁니다. 비우면 칸이 없습니다."
              >
                <input
                  id="pf-noteLabel"
                  value={form.noteLabel}
                  onChange={(e) => set('noteLabel', e.target.value)}
                  placeholder="지원 동기"
                  className={inputCls()}
                />
              </Field>
              {form.noteLabel.trim() && (
                <Check
                  checked={form.noteRequired}
                  onChange={(v) => set('noteRequired', v)}
                  label="이 칸을 필수로"
                />
              )}

              <Field
                id="attachmentGuide"
                label="첨부 안내 문구 (선택)"
                hint="적으면 파일 첨부칸이 생깁니다. 무엇을 어떻게 내는지 적어주세요."
              >
                <textarea
                  id="pf-attachmentGuide"
                  rows={2}
                  value={form.attachmentGuide}
                  onChange={(e) => set('attachmentGuide', e.target.value)}
                  placeholder="재학증명서를 촬영해 첨부해 주세요. 사진 또는 PDF, 20MB 이하."
                  className={inputCls()}
                />
              </Field>
              {form.attachmentGuide.trim() && (
                <Check
                  checked={form.attachmentRequired}
                  onChange={(v) => set('attachmentRequired', v)}
                  label="첨부를 필수로"
                />
              )}

              {/* 참가 유의사항 (D-98) — 신청자가 읽고 동의하는 글.
                  코드가 아니라 여기 있어야 담당자가 배포 없이 고친다 */}
              <Field
                id="cautionText"
                label="참가 유의사항 (선택)"
                hint="적으면 신청서에 그대로 펼쳐지고 「확인하였습니다」 체크가 필수로 붙습니다. 비우면 나오지 않습니다."
              >
                <textarea
                  id="pf-cautionText"
                  rows={5}
                  value={form.cautionText}
                  onChange={(e) => set('cautionText', e.target.value)}
                  placeholder={
                    '참가 확정 후 중도 포기 시 처리, 일정 참석 의무, 결과물 활용 범위처럼\n' +
                    '나중에 다툼이 생겼을 때 근거가 되는 내용을 적어 주세요.\n' +
                    '줄을 바꾸면 신청서에도 그대로 줄이 바뀝니다.'
                  }
                  className={inputCls()}
                />
              </Field>
                </div>
              )}
            </div>

            {/* ── 산출물 제출 (D-76) ─────────────────────── */}
            <div className="space-y-5 rounded-xl bg-subtle p-4">
              <div>
                <h3 className="font-bold">산출물 제출</h3>
                <p className="mt-1 text-xs leading-relaxed text-ink-subtle">
                  선정된 참여자가 「산출물 제출」 메뉴에서 활동 산출물·사진을
                  올립니다. 제출창은 항상 <strong>제목 · 내용 · 파일</strong>이고,
                  낸 것은 바로 반영됩니다(승인 없음). 전부 비워 두어도 됩니다.
                </p>
              </div>

              <Field
                id="outputVisibility"
                label="올린 것을 누가 보나"
                hint="비공개면 본인과 담당자만. 참여자 공유면 로그인한 회원 누구나 「참여자 자료실」에서 봅니다 — 이름은 안 보이고 팀명(또는 소속)만 보입니다."
              >
                <select
                  id="pf-outputVisibility"
                  value={form.outputVisibility}
                  onChange={(e) => set('outputVisibility', e.target.value as 'private' | 'members')}
                  className={inputCls()}
                >
                  <option value="private">비공개 — 본인 + 담당자</option>
                  <option value="members">참여자 공유 — 로그인한 회원 누구나</option>
                </select>
              </Field>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  id="outputOpensAt"
                  label="제출 시작"
                  hint="비우면 활동 시작일부터 (그것도 없으면 선정 뒤 언제든)."
                >
                  <input
                    id="pf-outputOpensAt"
                    type="datetime-local"
                    value={form.outputOpensAt}
                    onChange={(e) => set('outputOpensAt', e.target.value)}
                    className={inputCls()}
                  />
                </Field>
                <Field
                  id="outputClosesAt"
                  label="제출 마감"
                  error={errors.outputClosesAt}
                  hint="비우면 활동 종료일 밤까지 (그것도 없으면 제한 없음)."
                >
                  <input
                    id="pf-outputClosesAt"
                    type="datetime-local"
                    value={form.outputClosesAt}
                    onChange={(e) => set('outputClosesAt', e.target.value)}
                    className={inputCls(errors.outputClosesAt)}
                    aria-invalid={Boolean(errors.outputClosesAt)}
                  />
                </Field>
              </div>

              <Field
                id="outputGuide"
                label="제출 안내 (선택)"
                hint="무엇을 올리라는 것인지 한 문단. 제출창 위에 그대로 보입니다."
              >
                <textarea
                  id="pf-outputGuide"
                  rows={3}
                  value={form.outputGuide}
                  onChange={(e) => set('outputGuide', e.target.value)}
                  placeholder="활동이 끝나면 수업 지도안(PDF)과 발표자료를 올려 주세요. 활동 사진은 있는 대로 함께 올리셔도 됩니다."
                  className={inputCls()}
                />
              </Field>
            </div>

            <Check
              checked={form.published}
              onChange={(v) => set('published', v)}
              label="공개 — 학생에게 보이기"
              hint="미리보기가 없습니다. 내용을 다 채우고 확인한 뒤에 켜세요."
            />

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={busy}
                className="touch-target inline-flex items-center justify-center rounded-lg bg-brand-600 px-6 font-bold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {busy ? '저장 중…' : '저장'}
              </button>
              <button
                type="button"
                onClick={close}
                disabled={busy}
                className="touch-target inline-flex items-center justify-center rounded-lg border border-line-strong px-6 font-semibold disabled:opacity-50"
              >
                취소
              </button>

              {/* 버튼 바로 옆 — 누른 자리에서 결과를 본다 */}
              {saveMsg && (
                <span
                  role="alert"
                  className="text-sm font-semibold leading-relaxed text-status-revision"
                >
                  {saveMsg}
                </span>
              )}
            </div>
          </form>
        )}

        {/* ── 목록 ───────────────────────────────────────── */}
        {programs === null ? (
          <p className="text-sm text-ink-muted">불러오는 중…</p>
        ) : programs.length === 0 ? (
          <EmptyState
            title="등록된 프로그램이 없습니다"
            desc="위 [새 프로그램 등록]으로 첫 공고를 올려 보세요."
          />
        ) : (
          <ul className="space-y-3">
            {programs.map((p) => {
              const phase = getProgramPhase(p)
              return (
                <li
                  key={p.id}
                  className="rounded-2xl border border-line bg-surface shadow-card p-5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={phase}>{PHASE_LABEL[phase]}</Badge>
                    <Badge
                      tone={
                        p.participationType === 'group' ? 'group' : 'individual'
                      }
                    >
                      {p.participationType === 'group' ? '단체' : '개인'}
                    </Badge>
                    {!p.published && <Badge tone="closed">비공개</Badge>}
                  </div>

                  <p className="mt-2 font-bold">{p.title}</p>
                  <p className="mt-1 text-xs text-ink-subtle">
                    {p.year} · {formatPeriod(p.opensAt, p.closesAt)} ·{' '}
                    <span className="font-mono">{p.id}</span>
                  </p>

                  <div className="mt-3 flex flex-wrap gap-3 text-sm">
                    <button
                      type="button"
                      onClick={() => openEdit(p)}
                      disabled={busy}
                      className="font-semibold text-ink-muted underline underline-offset-2 disabled:opacity-50"
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      onClick={() => togglePublished(p)}
                      disabled={busy}
                      className="font-semibold text-ink-muted underline underline-offset-2 disabled:opacity-50"
                    >
                      {p.published ? '비공개로 내리기' : '공개하기'}
                    </button>
                    <Link
                      href={`/apply/${p.id}`}
                      className="font-semibold text-ink-muted underline underline-offset-2"
                    >
                      신청 화면 보기
                    </Link>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        <p className="text-xs leading-relaxed text-ink-subtle">
          프로그램 <strong>삭제 기능은 두지 않았습니다.</strong> 신청서가 딸린
          프로그램을 지우면 그 신청 기록이 어느 공고 것인지 알 수 없게 됩니다.
          내리실 때는 <strong>비공개</strong>로 바꿔 주세요. 접수가 끝난 공고는
          그대로 두면 &ldquo;지난 프로그램&rdquo;으로 내려갑니다.
        </p>
      </div>
    </>
  )
}

/* ── 작은 조각들 ──────────────────────────────────────────────── */

/** 문제가 있는 칸은 테두리로도 표시한다 — 색만으로 알리면 못 보는 사람이 있다 */
function inputCls(error?: string) {
  return (
    'mt-2 w-full rounded-xl bg-surface p-3 text-base outline-none border ' +
    (error
      ? 'border-status-revision focus:border-status-revision'
      : 'border-line-strong focus:border-brand-600')
  )
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string
  label: string
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={`pf-${id}`} className="flex flex-wrap items-baseline gap-2">
        <span className="text-sm font-semibold">{label}</span>
        {/* 사유를 칸 이름 바로 옆에 붙인다. 맨 위 안내문은 폼이 길면 눈에 안 띈다 */}
        {error && (
          <span className="text-xs font-semibold text-status-revision">
            {error}
          </span>
        )}
      </label>
      {children}
      {hint && (
        <p className="mt-1.5 text-xs leading-relaxed text-ink-subtle">{hint}</p>
      )}
    </div>
  )
}

function Check({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  hint?: string
}) {
  return (
    <label className="flex items-start gap-2.5 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4"
      />
      <span>
        <strong className="font-semibold">{label}</strong>
        {hint && (
          <span className="block text-xs leading-relaxed text-ink-subtle">
            {hint}
          </span>
        )}
      </span>
    </label>
  )
}
