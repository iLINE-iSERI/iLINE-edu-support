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
import MemberGate from '@/components/auth/MemberGate'
import {
  listAllPrograms,
  programIdTaken,
  createProgram,
  updateProgram,
  type ProgramInput,
} from '@/lib/firebase/staff'
import {
  getProgramPhase,
  PHASE_LABEL,
  formatPeriod,
} from '@/lib/firebase/programs'
import { firestoreErrorMessage } from '@/lib/firebase/errors'
import { Timestamp } from 'firebase/firestore'
import type { Program } from '@/lib/types'

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

interface FormState {
  id: string
  title: string
  year: string
  participationType: 'individual' | 'group'
  maxTeamSize: string
  description: string
  opensAt: string
  closesAt: string
  noteLabel: string
  noteRequired: boolean
  attachmentGuide: string
  attachmentRequired: boolean
  published: boolean
}

const EMPTY: FormState = {
  id: '',
  title: '',
  year: String(new Date().getFullYear()),
  participationType: 'individual',
  maxTeamSize: '',
  description: '',
  opensAt: '',
  closesAt: '',
  noteLabel: '',
  noteRequired: false,
  attachmentGuide: '',
  attachmentRequired: false,
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
    maxTeamSize: p.maxTeamSize ? String(p.maxTeamSize) : '',
    description: p.description ?? '',
    opensAt: toInputValue(p.opensAt),
    closesAt: toInputValue(p.closesAt),
    noteLabel: p.noteLabel ?? '',
    noteRequired: Boolean(p.noteRequired),
    attachmentGuide: p.attachmentGuide ?? '',
    attachmentRequired: Boolean(p.attachmentRequired),
    published: Boolean(p.published),
  }
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
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  /** null: 폼 닫힘 · '': 새 공고 · 그 외: 수정 중인 프로그램 ID */
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)

  const load = useCallback(async () => {
    setError('')
    try {
      setPrograms(await listAllPrograms())
    } catch (e) {
      console.error('[iLINE] 프로그램 목록 조회 실패:', e)
      setError(firestoreErrorMessage(e))
      setPrograms([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  function openNew() {
    setForm(EMPTY)
    setEditingId('')
    setError('')
  }

  function openEdit(p: Program) {
    setForm(toForm(p))
    setEditingId(p.id)
    setError('')
  }

  function close() {
    setEditingId(null)
    setForm(EMPTY)
  }

  /** 공개/비공개만 뒤집기 — 폼을 열지 않고 목록에서 바로 */
  async function togglePublished(p: Program) {
    setBusy(true)
    setError('')
    try {
      await updateProgram(p.id, { ...toInput(toForm(p)), published: !p.published }, p.createdAt)
      await load()
    } catch (e) {
      console.error('[iLINE] 공개 상태 변경 실패:', e)
      setError(firestoreErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  function toInput(f: FormState): ProgramInput {
    return {
      title: f.title,
      year: Number(f.year),
      participationType: f.participationType,
      maxTeamSize: f.maxTeamSize ? Number(f.maxTeamSize) : undefined,
      description: f.description,
      opensAt: fromInputValue(f.opensAt),
      closesAt: fromInputValue(f.closesAt),
      noteLabel: f.noteLabel,
      noteRequired: f.noteRequired,
      attachmentGuide: f.attachmentGuide,
      attachmentRequired: f.attachmentRequired,
      published: f.published,
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!form.title.trim()) return setError('프로그램 이름을 입력해 주세요.')

    const year = Number(form.year)
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return setError('사업 연도를 네 자리 숫자로 입력해 주세요. (예: 2026)')
    }

    const opens = fromInputValue(form.opensAt)
    const closes = fromInputValue(form.closesAt)
    if (opens && closes && opens >= closes) {
      return setError('접수 마감이 접수 시작보다 빠릅니다. 날짜를 확인해 주세요.')
    }

    if (editingId === '') {
      // 문서 ID 는 주소에 그대로 나오고, 만든 뒤에는 바꿀 수 없다.
      if (!/^[a-z0-9-]+$/.test(form.id)) {
        return setError(
          '주소용 ID 는 영문 소문자·숫자·붙임표(-)만 쓸 수 있습니다. (예: 2026-ai-workshop)'
        )
      }
    }

    setBusy(true)
    try {
      if (editingId) {
        const before = programs?.find((p) => p.id === editingId)
        await updateProgram(editingId, toInput(form), before?.createdAt)
      } else {
        if (await programIdTaken(form.id)) {
          setBusy(false)
          return setError(
            `이미 "${form.id}" 를 쓰는 프로그램이 있습니다. 다른 ID 를 정해 주세요.`
          )
        }
        await createProgram(form.id, toInput(form))
      }
      close()
      await load()
    } catch (e) {
      console.error('[iLINE] 프로그램 저장 실패:', e)
      setError(firestoreErrorMessage(e))
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
              ← 신청 관리
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
              className="touch-target inline-flex items-center justify-center rounded-xl bg-brand-600 px-5 font-bold text-white hover:bg-brand-700"
            >
              새 프로그램 등록
            </button>
          )}
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg bg-status-revision/10 px-3 py-2 text-sm leading-relaxed text-status-revision"
          >
            {error}
          </p>
        )}

        {/* ── 등록 · 수정 폼 ─────────────────────────────── */}
        {editingId !== null && (
          <form
            onSubmit={save}
            className="space-y-5 rounded-2xl border border-line bg-surface p-5"
          >
            <h2 className="font-bold">
              {editingId ? `프로그램 수정 · ${editingId}` : '새 프로그램 등록'}
            </h2>

            {/* 주소용 ID — 새로 만들 때만 */}
            {editingId === '' && (
              <Field
                label="주소용 ID"
                hint="인터넷 주소에 그대로 나옵니다. 영문 소문자·숫자·붙임표(-). 만든 뒤에는 바꿀 수 없습니다."
              >
                <input
                  value={form.id}
                  onChange={(e) => set('id', e.target.value)}
                  placeholder="2026-ai-workshop"
                  className={INPUT}
                />
              </Field>
            )}

            <Field label="프로그램 이름">
              <input
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder="2026 AI 수업 설계 워크숍"
                className={INPUT}
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="사업 연도">
                <input
                  inputMode="numeric"
                  value={form.year}
                  onChange={(e) => set('year', e.target.value)}
                  className={INPUT}
                />
              </Field>

              <Field
                label="참여 방식"
                hint="지금은 신청서가 같습니다. 상세 화면의 안내 문구만 달라집니다."
              >
                <select
                  value={form.participationType}
                  onChange={(e) =>
                    set(
                      'participationType',
                      e.target.value as FormState['participationType']
                    )
                  }
                  className={INPUT}
                >
                  <option value="individual">개인 신청</option>
                  <option value="group">단체 프로그램</option>
                </select>
              </Field>
            </div>

            {form.participationType === 'group' && (
              <Field label="팀 최대 인원 (대표자 포함)">
                <input
                  inputMode="numeric"
                  value={form.maxTeamSize}
                  onChange={(e) => set('maxTeamSize', e.target.value)}
                  placeholder="4"
                  className={INPUT}
                />
              </Field>
            )}

            <Field label="소개 (선택)">
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                placeholder="한두 문장으로 프로그램을 설명해 주세요."
                className={INPUT}
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="접수 시작" hint="비우면 곧바로 접수중이 됩니다.">
                <input
                  type="datetime-local"
                  value={form.opensAt}
                  onChange={(e) => set('opensAt', e.target.value)}
                  className={INPUT}
                />
              </Field>
              <Field
                label="접수 마감"
                hint="비우면 상시 접수입니다. 시각까지 정하세요 — 00:00 이면 그날 시작하자마자 마감입니다."
              >
                <input
                  type="datetime-local"
                  value={form.closesAt}
                  onChange={(e) => set('closesAt', e.target.value)}
                  className={INPUT}
                />
              </Field>
            </div>

            {/* ── 신청서 구성 (D-29) ─────────────────────── */}
            <div className="space-y-5 rounded-xl bg-subtle p-4">
              <div>
                <h3 className="font-bold">신청서에 추가할 칸</h3>
                <p className="mt-1 text-xs leading-relaxed text-ink-subtle">
                  비워두면 신청서는 <strong>내 정보 확인 후 제출</strong>만
                  있습니다. 프로그램마다 받을 것이 다른 문제를 글칸 하나 · 첨부
                  하나로 해결합니다.
                </p>
              </div>

              <Field
                label="자유 기재란 이름 (선택)"
                hint="적으면 그 이름의 글쓰는 칸이 생깁니다. 비우면 칸이 없습니다."
              >
                <input
                  value={form.noteLabel}
                  onChange={(e) => set('noteLabel', e.target.value)}
                  placeholder="지원 동기"
                  className={INPUT}
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
                label="첨부 안내 문구 (선택)"
                hint="적으면 파일 첨부칸이 생깁니다. 무엇을 어떻게 내는지 적어주세요."
              >
                <textarea
                  rows={2}
                  value={form.attachmentGuide}
                  onChange={(e) => set('attachmentGuide', e.target.value)}
                  placeholder="재학증명서를 촬영해 첨부해 주세요. 사진 또는 PDF, 20MB 이하."
                  className={INPUT}
                />
              </Field>
              {form.attachmentGuide.trim() && (
                <Check
                  checked={form.attachmentRequired}
                  onChange={(v) => set('attachmentRequired', v)}
                  label="첨부를 필수로"
                />
              )}
            </div>

            <Check
              checked={form.published}
              onChange={(v) => set('published', v)}
              label="공개 — 학생에게 보이기"
              hint="미리보기가 없습니다. 내용을 다 채우고 확인한 뒤에 켜세요."
            />

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="submit"
                disabled={busy}
                className="touch-target inline-flex items-center justify-center rounded-xl bg-brand-600 px-6 font-bold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {busy ? '저장 중…' : '저장'}
              </button>
              <button
                type="button"
                onClick={close}
                disabled={busy}
                className="touch-target inline-flex items-center justify-center rounded-xl border border-line-strong px-6 font-semibold disabled:opacity-50"
              >
                취소
              </button>
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
                  className="rounded-2xl border border-line bg-surface p-5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={phase}>{PHASE_LABEL[phase]}</Badge>
                    <Badge
                      tone={p.participationType === 'group' ? 'group' : 'individual'}
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

const INPUT =
  'mt-2 w-full rounded-xl border border-line-strong bg-surface p-3 text-base outline-none focus:border-brand-600'

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold">{label}</span>
      {children}
      {hint && (
        <span className="mt-1.5 block text-xs leading-relaxed text-ink-subtle">
          {hint}
        </span>
      )}
    </label>
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
