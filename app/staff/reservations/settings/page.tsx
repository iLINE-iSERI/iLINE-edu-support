'use client'

/**
 * 운영 설정 (화면 설계 §6) — 예약 마감(이용일 며칠 전) · 범위(주) · 휴관일.
 *
 * D-115(09-28 운영진): 「매주 ○요일 마감 → ○요일 전달」을 **「이용일 N일 전 23:59 까지」** 로 바꿨다.
 * 전달 명단은 원래 상태로 뽑아서(D-55) 담당자는 아무 날이나 전달하면 되므로 요일 칸이 없어졌다.
 * 저장하기 전까지는 코드의 기본값(3일 전 · 4주)이 쓰인다.
 * 운영 시간(09~18)과 마지막 칸은 여기 없다 — `lib/config/venues.ts` 상수.
 *
 * **[취소]와 「저장하지 않은 변경」 표시 (09-29 iSERI)** — 바꾸다가 그냥 나가면 저장되는 것 같아
 * 불안하다는 요청. 이 화면은 **[저장]을 눌러야만** 반영된다(자동 저장 없음). 그 사실을 바뀐 게 있을 때
 * 버튼 옆에 적고, [취소]로 마지막 저장값으로 되돌린다. 탭을 닫거나 새로고침하면 브라우저가 한 번 묻는다.
 */

import { useEffect, useState } from 'react'
import MemberGate from '@/components/auth/MemberGate'
import { getReservationSettings } from '@/lib/firebase/reservations'
import { saveReservationSettings, hasSavedSettings } from '@/lib/firebase/reservationsStaff'
import { actionErrorMessage, firestoreErrorMessage } from '@/lib/firebase/errors'
import { computeWindow, shortDate, closeAtLabel } from '@/lib/reservations/window'
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
  /** 마지막으로 불러오거나 저장한 값 — 「바뀐 게 있나」와 [취소]의 기준 */
  const [base, setBase] = useState<Pick<ReservationSettings, 'leadDays' | 'rangeWeeks' | 'closedDates'> | null>(null)

  useEffect(() => {
    Promise.all([getReservationSettings(), hasSavedSettings()])
      .then(([cur, has]) => {
        setS(cur)
        setSaved(has)
        setClosedText(cur.closedDates.join('\n'))
        setBase({ leadDays: cur.leadDays, rangeWeeks: cur.rangeWeeks, closedDates: cur.closedDates })
      })
      .catch((e) => setError(firestoreErrorMessage(e)))
  }, [])

  const closedDates = closedText
    .split(/[\n,\s]+/)
    .map((x) => x.trim())
    .filter(Boolean)
  const preview = computeWindow({ ...s, closedDates })

  const sig = (x: { leadDays: number; rangeWeeks: number; closedDates: string[] }) =>
    JSON.stringify([x.leadDays, x.rangeWeeks, Array.from(new Set(x.closedDates)).sort()])
  const dirty = base !== null && sig({ leadDays: s.leadDays, rangeWeeks: s.rangeWeeks, closedDates }) !== sig(base)

  // 바뀐 채로 탭을 닫거나 새로고침하면 브라우저가 한 번 묻는다(사이트 안 메뉴 이동은 못 막는다 — 위 표시로 대신)
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  /** [취소] — 마지막 저장값으로 되돌린다. 아무것도 저장하지 않는다 */
  const cancel = () => {
    if (!base) return
    setS({ ...s, leadDays: base.leadDays, rangeWeeks: base.rangeWeeks })
    setClosedText(base.closedDates.join('\n'))
    setNewDate('')
    setError('')
    setNotice('바꾸던 것을 되돌렸습니다. 저장된 값 그대로입니다.')
  }

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
      setBase({ leadDays: s.leadDays, rangeWeeks: s.rangeWeeks, closedDates })
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
            <strong>아직 저장된 설정이 없어 코드의 기본값을 쓰고 있습니다</strong>(이용일 3일 전 · 4주 —
            09-28 운영진 결정). 휴관일을 넣으려면 여기서 저장하세요.
          </p>
        )}
        {notice && <p role="status" className="rounded-xl border border-status-approved/40 bg-status-approved/10 p-4 text-sm">{notice}</p>}
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-200">{error}</p>}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-bold">예약 마감</span>
            <select value={s.leadDays} onChange={(e) => setS({ ...s, leadDays: num(e.target.value) })} className={field}>
              {[1, 2, 3, 4, 5, 7].map((n) => <option key={n} value={n}>이용일 {n}일 전 23:59까지</option>)}
            </select>
            <span className="mt-1 block text-xs text-ink-subtle">
              달력 기준(주말도 하루로 셉니다). 전달은 요일 없이 명단을 열 때마다 — 마감 다음 날 전달하면 됩니다.
            </span>
          </label>
          <label className="block text-sm">
            <span className="font-bold">예약 범위 (주)</span>
            <select value={s.rangeWeeks} onChange={(e) => setS({ ...s, rangeWeeks: num(e.target.value) })} className={field}>
              {[1, 2, 3, 4, 5, 6, 8].map((n) => <option key={n} value={n}>{n}주</option>)}
            </select>
            <span className="mt-1 block text-xs text-ink-subtle">붐비거나 먼 날짜 취소가 잦으면 줄입니다.</span>
          </label>
        </div>

        <fieldset className="rounded-2xl border border-line bg-surface shadow-card p-5">
          <legend className="px-1 text-sm font-bold">휴관일</legend>
          <p className="text-xs text-ink-muted">시험 기간처럼 통째로 닫는 날. 격자에 「－」로 나옵니다. 주말은 넣지 않아도 됩니다.</p>
          <div className="mt-3 flex gap-2">
            <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="touch-target rounded-lg border border-line-strong bg-surface px-3 text-sm" />
            <button type="button" onClick={addDate} className="touch-target rounded-lg border border-line-strong px-4 text-sm font-semibold">추가</button>
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
            📅 {shortDate(preview.firstOpenDate)} ~ {shortDate(preview.lastDate)} 사이에서 고를 수 있습니다. 가장
            가까운 {shortDate(preview.firstOpenDate)} 이용분의 마감은 {closeAtLabel(preview.closeAt)} 입니다.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3">
          {/* 자동 저장이 없다는 것을 바뀐 게 있을 때 분명히 적는다. 좁으면 문구가 버튼 위 한 줄로 간다 */}
          <p role="status" className={'mr-auto text-sm ' + (dirty ? 'font-semibold text-status-revision' : 'text-ink-subtle')}>
            {dirty
              ? '저장하지 않은 변경이 있습니다 — [저장]을 눌러야 실제 예약 화면에 반영됩니다.'
              : '바뀐 것이 없습니다.'}
          </p>
          {/* 두 버튼은 한 덩어리 — 폭이 좁아도 [취소] 왼쪽 · [저장] 오른쪽이 갈라지지 않게 (09-29 iSERI) */}
          <div className="flex shrink-0 gap-3">
            <button
              type="button"
              onClick={cancel}
              disabled={busy || !dirty}
              className="touch-target inline-flex items-center justify-center rounded-lg border border-line-strong px-6 font-semibold disabled:opacity-50"
            >
              취소
            </button>
            <button type="submit" disabled={busy} className="touch-target inline-flex items-center justify-center rounded-lg bg-brand-600 px-6 font-bold text-white hover:bg-brand-700 disabled:opacity-50">
              {busy ? '저장 중…' : '저장'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
