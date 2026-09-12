'use client'

/**
 * 운영 설정 (화면 설계 §6) — 마감 요일·시각 · 전달 요일 · 범위(주) · 휴관일.
 *
 * 요일을 코드에 박지 않는 이유: 관리자가 학생이라 시간표에 따라 편한 요일이
 * 다르다(D-53). 저장하기 전까지는 코드의 기본값(🔴 가정값, D-56 ④)이 쓰인다.
 * 운영 시간(09~18)과 마지막 칸은 여기 없다 — `lib/config/venues.ts` 상수.
 */

import { useEffect, useState } from 'react'
import MemberGate from '@/components/auth/MemberGate'
import { getReservationSettings } from '@/lib/firebase/reservations'
import { saveReservationSettings, hasSavedSettings } from '@/lib/firebase/reservationsStaff'
import { actionErrorMessage, firestoreErrorMessage } from '@/lib/firebase/errors'
import { computeWindow, shortDate, closeAtLabel, weekdayKo } from '@/lib/reservations/window'
import { DEFAULT_RESERVATION_SETTINGS, type ReservationSettings } from '@/lib/types'

export default function SettingsPage() {
  return (
    <MemberGate requireStaff>
      <Content />
    </MemberGate>
  )
}

function Content() {
  const [s, setS] = useState<ReservationSettings>(DEFAULT_RESERVATION_SETTINGS)
  const [saved, setSaved] = useState<boolean | null>(null)
  const [closedText, setClosedText] = useState('')
  const [newDate, setNewDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    Promise.all([getReservationSettings(), hasSavedSettings()])
      .then(([cur, has]) => {
        setS(cur)
        setSaved(has)
        setClosedText(cur.closedDates.join('\n'))
      })
      .catch((e) => setError(firestoreErrorMessage(e)))
  }, [])

  const closedDates = closedText
    .split(/[\n,\s]+/)
    .map((x) => x.trim())
    .filter(Boolean)
  const preview = computeWindow({ ...s, closedDates })

  const addDate = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) return
    if (!closedDates.includes(newDate)) setClosedText([...closedDates, newDate].sort().join('\n'))
    setNewDate('')
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await saveReservationSettings({ ...s, closedDates })
      setSaved(true)
      setNotice('저장했습니다. 회원 화면의 날짜 범위가 바로 바뀝니다.')
    } catch (err) {
      setError(actionErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const num = (v: string) => Number(v)
  const field = 'touch-target mt-1 w-full rounded-xl border border-line-strong bg-surface px-3'

  return (
    <div className="container-page py-8">
      <form onSubmit={submit} noValidate className="mx-auto max-w-2xl space-y-6">
        {saved === false && (
          <p className="rounded-xl border border-status-revision/40 bg-status-revision/10 p-4 text-sm leading-relaxed">
            <strong>아직 저장된 설정이 없어 코드의 기본값을 쓰고 있습니다.</strong> 이 값들은 교수님 확인
            전에 임의로 정한 가정값입니다 — 확인되면 여기서 바꾸고 저장하세요.
          </p>
        )}
        {notice && <p role="status" className="rounded-xl border border-status-approved/40 bg-status-approved/10 p-4 text-sm">{notice}</p>}
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-200">{error}</p>}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-bold">마감 요일</span>
            <select value={s.closeWeekday} onChange={(e) => setS({ ...s, closeWeekday: num(e.target.value) })} className={field}>
              {[1, 2, 3, 4, 5, 6, 0].map((d) => <option key={d} value={d}>{weekdayKo(d)}요일</option>)}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-bold">마감 시각</span>
            <select value={s.closeHour} onChange={(e) => setS({ ...s, closeHour: num(e.target.value) })} className={field}>
              {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-bold">전달 요일</span>
            <select value={s.deliverWeekday} onChange={(e) => setS({ ...s, deliverWeekday: num(e.target.value) })} className={field}>
              {[1, 2, 3, 4, 5, 6, 0].map((d) => <option key={d} value={d}>{weekdayKo(d)}요일</option>)}
            </select>
            <span className="mt-1 block text-xs text-ink-subtle">마감 다음 날이 보통입니다. 명단은 아무 날이나 열 수 있고, 이 값은 회원 안내 문구에만 쓰입니다.</span>
          </label>
          <label className="block text-sm">
            <span className="font-bold">예약 범위 (주)</span>
            <select value={s.rangeWeeks} onChange={(e) => setS({ ...s, rangeWeeks: num(e.target.value) })} className={field}>
              {[1, 2, 3, 4, 5, 6, 8].map((n) => <option key={n} value={n}>{n}주</option>)}
            </select>
            <span className="mt-1 block text-xs text-ink-subtle">붐비거나 먼 날짜 취소가 잦으면 줄입니다.</span>
          </label>
        </div>

        <fieldset className="rounded-2xl border border-line bg-surface p-5">
          <legend className="px-1 text-sm font-bold">휴관일</legend>
          <p className="text-xs text-ink-muted">시험 기간처럼 통째로 닫는 날. 격자에 「－」로 나옵니다. 주말은 넣지 않아도 됩니다.</p>
          <div className="mt-3 flex gap-2">
            <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="touch-target rounded-xl border border-line-strong bg-surface px-3 text-sm" />
            <button type="button" onClick={addDate} className="touch-target rounded-xl border border-line-strong px-4 text-sm font-semibold">추가</button>
          </div>
          <textarea
            value={closedText}
            onChange={(e) => setClosedText(e.target.value)}
            rows={4}
            placeholder="2026-10-05&#10;2026-10-06"
            className="mt-3 w-full rounded-xl border border-line-strong bg-surface p-3 font-mono text-sm"
          />
          <p className="mt-1 text-xs text-ink-subtle">한 줄에 하나(YYYY-MM-DD). 직접 지워도 됩니다.</p>
        </fieldset>

        {/* 미리보기 — 지금 이 값이면 회원에게 어떻게 보이나 */}
        <div className="rounded-2xl bg-subtle p-5 text-sm leading-relaxed">
          <p className="font-bold">지금 이 값이면 회원 화면에는</p>
          <p className="mt-1 text-ink-muted">
            📅 {shortDate(preview.firstDate)} ~ {shortDate(preview.lastDate)} 사이에서 고를 수 있고,{' '}
            {closeAtLabel(preview.closeAt)}까지 예약하면 {shortDate(preview.deliverDate)}에 전달됩니다.
          </p>
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={busy} className="touch-target inline-flex items-center justify-center rounded-xl bg-brand-600 px-6 font-bold text-white hover:bg-brand-700 disabled:opacity-50">
            {busy ? '저장 중…' : '저장'}
          </button>
        </div>
      </form>
    </div>
  )
}
