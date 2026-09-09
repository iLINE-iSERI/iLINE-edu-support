'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import MemberGate from '@/components/auth/MemberGate'
import { useAuth } from '@/components/auth/AuthProvider'
import {
  listMyApplications,
  fileUrl,
  canCancelMyself,
  cancelMyApplication,
} from '@/lib/firebase/applications'
import { listPublishedPrograms } from '@/lib/firebase/programs'
import { listMySettlements } from '@/lib/firebase/settlements'
import SettlementSection from '@/components/settlement/SettlementSection'
import { SHOW_REVIEW_NOTE_TO_APPLICANT } from '@/lib/config/site'
import { firestoreErrorMessage, firebaseErrorKind } from '@/lib/firebase/errors'
import {
  APPLICATION_STATUS_LABEL,
  profileRows,
  type Application,
  type Program,
  type Settlement,
} from '@/lib/types'

export default function MypagePage() {
  return (
    <MemberGate>
      <Suspense fallback={null}>
        <MypageContent />
      </Suspense>
    </MemberGate>
  )
}

function MypageContent() {
  const { member, user } = useAuth()
  const params = useSearchParams()
  const justSubmitted = params.get('submitted') === '1'
  const justSavedProfile = params.get('profile') === 'saved'

  const [apps, setApps] = useState<Application[] | null>(null)
  const [settlements, setSettlements] = useState<Settlement[]>([])
  /**
   * 프로그램 목록 — **취소 버튼을 보일지 판단하는 데만** 쓴다 (D-48).
   * 신청서 문서에는 접수 기간이 없고 프로그램 쪽에 있기 때문이다.
   * 조회가 실패해도 신청 현황은 보여야 하므로 실패를 삼킨다 — 그때는
   * 취소 버튼이 안 보일 뿐이고, 담당자 문의 안내가 대신 나간다.
   */
  const [programs, setPrograms] = useState<Program[]>([])
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!user) return
    try {
      const [list, mine, progs] = await Promise.all([
        listMyApplications(user.uid),
        // 정산 조회가 실패해도 신청 현황은 보여야 한다 — 정산은 부가 정보다
        listMySettlements(user.uid).catch((e) => {
          console.warn('[iLINE] 정산 조회 실패:', e)
          return []
        }),
        listPublishedPrograms().catch((e) => {
          console.warn('[iLINE] 프로그램 조회 실패:', e)
          return [] as Program[]
        }),
      ])
      setApps(list)
      setSettlements(mine)
      setPrograms(progs)
    } catch (e) {
      console.error('[iLINE] 신청 목록 조회 실패:', e)
      setError(firestoreErrorMessage(e))
      setApps([])
    }
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <>
      <PageHeader
        title="마이페이지"
        description={
          member
            ? `${member.name}님, 안녕하세요.`
            : '신청 현황과 제출 서류를 확인합니다.'
        }
      />

      <div className="container-page space-y-8 py-8">
        {justSubmitted && (
          <div
            role="status"
            className="rounded-xl border border-status-approved/40 bg-status-approved/10 p-4 text-sm leading-relaxed"
          >
            <p className="font-bold text-status-approved">
              신청서가 제출되었습니다
            </p>
            <p className="mt-1 text-ink-muted">
              검토 결과는 아래 신청 현황에서 확인하실 수 있습니다.
            </p>
          </div>
        )}

        {justSavedProfile && (
          <div
            role="status"
            className="rounded-xl border border-status-approved/40 bg-status-approved/10 p-4 text-sm leading-relaxed"
          >
            <p className="font-bold text-status-approved">
              회원정보를 저장했습니다
            </p>
            <p className="mt-1 text-ink-muted">
              이미 제출한 신청서에는 반영되지 않습니다 — 신청서는 제출 시점
              그대로 보관됩니다.
            </p>
          </div>
        )}

        {/* ── 내 신청 현황 (D-11) ──────────────────────────── */}
        <section>
          <h2 className="text-lg font-bold tracking-tight">내 신청 현황</h2>

          <div className="mt-4">
            {apps === null ? (
              <p className="text-sm text-ink-muted">불러오는 중…</p>
            ) : error ? (
              <EmptyState title="신청 내역을 불러오지 못했습니다" desc={error} />
            ) : apps.length === 0 ? (
              <EmptyState
                title="아직 신청하신 프로그램이 없습니다"
                desc="접수 중인 프로그램을 확인해 보세요."
                action={
                  <Link
                    href="/apply"
                    className="touch-target inline-flex items-center justify-center rounded-xl bg-brand-600 px-6 font-bold text-white hover:bg-brand-700"
                  >
                    프로그램 보기
                  </Link>
                }
              />
            ) : (
              <ul className="space-y-3">
                {apps.map((a) => (
                  <li
                    key={a.id}
                    className="rounded-2xl border border-line bg-surface p-5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-subtle px-2.5 py-1 text-xs font-bold">
                        {APPLICATION_STATUS_LABEL[a.status]}
                      </span>
                      {a.submittedAt && (
                        <span className="text-xs text-ink-subtle">
                          {a.submittedAt.toDate().toLocaleDateString('ko-KR')}{' '}
                          제출
                        </span>
                      )}
                    </div>

                    <p className="mt-2 font-bold">
                      {a.programTitle || a.programId}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {a.generatedPdfPath && (
                        <FileButton
                          path={a.generatedPdfPath}
                          label="제출한 신청서 (PDF)"
                          primary
                        />
                      )}
                      {a.files?.map((f) => (
                        <FileButton
                          key={f.storagePath}
                          path={f.storagePath}
                          label={f.fileName}
                        />
                      ))}
                    </div>

                    {/* 담당자 사유 (D-10) — **지금은 표시하지 않는다** (D-46).
                        선정 결과는 공지사항의 선정자 목록으로 알린다.
                        되돌리려면 lib/config/site.ts 의 상수만 true 로. */}
                    {SHOW_REVIEW_NOTE_TO_APPLICANT && a.reviewNote && (
                      <div className="mt-3 rounded-lg bg-subtle p-3 text-sm leading-relaxed">
                        <p className="font-semibold">담당자 안내</p>
                        <p className="mt-1 text-ink-muted">{a.reviewNote}</p>
                      </div>
                    )}

                    {/* 정산 — 선정된 건에만 (D-19 / D-39).
                        아직 지급 대상이 아닌 사람에게 계좌를 물으면
                        쓸 일 없는 계좌를 보유하게 된다 (D-38) */}
                    {a.status === 'approved' && user && (
                      <SettlementSection
                        application={a}
                        settlement={
                          settlements.find((s) => s.applicationId === a.id) ??
                          null
                        }
                        uid={user.uid}
                        onDone={load}
                      />
                    )}

                    {/* 본인 취소 (D-48) — 접수 기간 중 · 제출 완료/보완 요청만 */}
                    <CancelBlock
                      app={a}
                      program={
                        programs.find((p) => p.id === a.programId) ?? null
                      }
                      onDone={load}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* ── 내 정보 ──────────────────────────────────────── */}
        {member && (
          <section>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-bold tracking-tight">내 정보</h2>
              <Link
                href="/mypage/profile"
                className="text-sm text-brand-600 underline underline-offset-2"
              >
                수정하기
              </Link>
            </div>
            {/* 유형(D-43)에 따라 칸이 다르다 — 신청서·PDF와 같은 목록을 쓴다 */}
            <dl className="mt-4 grid gap-3 rounded-2xl border border-line bg-surface p-5 text-sm sm:grid-cols-2">
              {profileRows(member).map(([label, value]) => (
                <Row key={label} label={label} value={value} />
              ))}
            </dl>
            <p className="mt-2 text-xs leading-relaxed text-ink-subtle">
              여기서 고친 내용은 <strong>앞으로 하시는 신청</strong>부터
              반영됩니다. 이미 제출한 신청서는 제출 시점 그대로 보관됩니다.
            </p>
          </section>
        )}
      </div>

      {/* 예전에는 여기에 "Phase 4′ · 6 / 대기: 갤러리 공개 방침 / 산출물 제출
          (D-19)" 같은 **내부 계획 표시**가 떠 있었다. 신청자에게는 뜻을 알 수
          없는 글자이고, 자기 마이페이지에서 **아직 없는 기능 목록**을 보게 할
          이유도 없다. 통째로 뺐다 (09-08).

          여기 들어올 예정이던 것 — 산출물 제출(D-19), 회원정보 수정.
          만들 때가 되면 그때 화면을 추가한다. → docs/3-할일/01-남은-일.md */}
    </>
  )
}

/**
 * 신청 취소 (D-48).
 *
 * ── 왜 카드 맨 아래에, 그것도 작은 글씨로 두었나 ─────────────────
 * 취소는 **되돌리기 어려운 처리**다. 접수 기간이 끝난 뒤에는 본인이 다시
 * 신청할 수 없고, 담당자에게 부탁해야 한다. 그래서 [신청서 열기] 같은
 * 평범한 버튼과 **같은 무게로 보이면 안 된다.**
 *
 * 담당자 화면의 [신청 취소 처리]와 같은 이유로 상태 버튼들과 떼어 놓았다.
 *
 * 취소할 수 없는 상태에서는 **버튼 대신 이유를 적는다.** 아무것도 안 보이면
 * "취소가 원래 안 되는 사이트"로 오해하고 그냥 포기하게 된다.
 */
function CancelBlock({
  app,
  program,
  onDone,
}: {
  app: Application
  program: Program | null
  onDone: () => void
}) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // 이미 끝난 건에는 아무것도 띄우지 않는다 — 할 수 있는 일이 없다
  if (app.status === 'cancelled' || app.status === 'rejected') return null

  if (!canCancelMyself(app, program)) {
    // 선정된 건은 취소가 곧 '참여 포기'라 담당자가 반드시 알아야 한다.
    // 그 밖(검토 중·마감 후)은 담당자가 이미 손댔거나 재신청이 불가능한 상태다.
    return (
      <p className="mt-3 border-t border-line pt-3 text-xs leading-relaxed text-ink-subtle">
        신청을 취소하시려면 담당자에게 문의해 주세요.{' '}
        {app.status === 'approved'
          ? '선정된 프로그램은 참여 포기 처리가 필요합니다.'
          : // '검토 중' 상태를 없애면서(D-49) 남을 이유는 사실상 마감뿐이다.
            // 옛 문구는 "검토가 시작된"을 함께 말해서 이제 사실과 다르다.
            '접수가 마감된 뒤에는 화면에서 취소할 수 없습니다.'}
      </p>
    )
  }

  async function cancel() {
    setBusy(true)
    setError('')
    try {
      await cancelMyApplication(app, reason)
      onDone()
    } catch (e) {
      console.error('[iLINE] 신청 취소 실패:', e)
      // 규칙이 막는 경우는 사실상 하나 — 그 사이에 접수가 마감됐거나
      // 담당자가 상태를 바꾼 것이다. 화면을 새로 읽으면 상황이 보인다.
      setError(
        firebaseErrorKind(e) === 'permission-denied'
          ? '지금은 취소할 수 없습니다. 접수가 마감되었거나 담당자가 검토를 시작했을 수 있습니다. 화면을 새로고침해 확인해 주세요.'
          : firestoreErrorMessage(e)
      )
      setBusy(false)
    }
  }

  return (
    <div className="mt-3 border-t border-line pt-3">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-sm font-semibold text-ink-muted underline underline-offset-2"
        >
          신청 취소
        </button>
      ) : (
        <div className="rounded-xl bg-subtle p-3">
          <p className="text-sm font-bold">이 신청을 취소하시겠습니까?</p>
          <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-ink-muted">
            <li>· 신청 기록은 &lsquo;취소됨&rsquo;으로 남습니다</li>
            <li>· 접수 기간 안이라면 이 프로그램에 다시 신청하실 수 있습니다</li>
            <li>· 제출하신 신청서와 첨부 파일은 그대로 보관됩니다</li>
          </ul>

          <label
            htmlFor={`cancel-${app.id}`}
            className="mt-3 block text-xs font-semibold"
          >
            취소 사유 <span className="font-normal text-ink-subtle">(선택)</span>
          </label>
          <textarea
            id={`cancel-${app.id}`}
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="적어주시면 프로그램 운영에 참고하겠습니다."
            className="mt-1.5 w-full rounded-lg border border-line-strong bg-surface p-2.5 text-sm leading-relaxed outline-none focus:border-brand-600"
          />

          {error && (
            <p
              role="alert"
              className="mt-2 rounded-lg bg-status-revision/10 px-3 py-2 text-xs leading-relaxed text-status-revision"
            >
              {error}
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={cancel}
              disabled={busy}
              className="touch-target rounded-lg border border-status-revision px-4 text-sm font-bold text-status-revision hover:bg-status-revision/10 disabled:opacity-50"
            >
              {busy ? '처리 중…' : '취소하기'}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setError('')
              }}
              disabled={busy}
              className="touch-target rounded-lg px-4 text-sm font-semibold text-ink-muted disabled:opacity-50"
            >
              그대로 두기
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * 제출한 파일 열기 — 신청서 PDF(D-28)와 첨부 서류 공용.
 *
 * 링크를 미리 만들어 두지 않고 누를 때 발급받는다.
 * Storage 다운로드 URL 은 토큰이 붙은 주소라, 목록에 박아두면
 * 화면을 캡처하거나 공유하는 것만으로 새어 나갈 수 있다.
 */
function FileButton({
  path,
  label,
  primary,
}: {
  path: string
  label: string
  primary?: boolean
}) {
  const [busy, setBusy] = useState(false)

  async function open() {
    setBusy(true)
    try {
      window.open(await fileUrl(path), '_blank', 'noopener')
    } catch (e) {
      console.error('[iLINE] 파일 열기 실패:', e)
      alert('파일을 여는 데 실패했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={open}
      disabled={busy}
      title={label}
      className={
        'inline-flex max-w-full items-center rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50 ' +
        (primary
          ? 'border-line-strong hover:bg-subtle'
          : 'border-line text-ink-muted hover:bg-subtle')
      }
    >
      <span className="truncate">{busy ? '여는 중…' : label}</span>
    </button>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-ink-subtle">{label}</dt>
      <dd className="mt-0.5 break-all font-medium">{value}</dd>
    </div>
  )
}
