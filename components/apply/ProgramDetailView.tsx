'use client'

import Link from 'next/link'
import { useCallback } from 'react'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import PageHeader from '@/components/ui/PageHeader'
import PosterViewer from '@/components/ui/PosterViewer'
import StickyAside from '@/components/apply/StickyAside'
import { seekApplication } from '@/lib/ui/formSeek'
import ApplicationForm from '@/components/apply/ApplicationForm'
import { canEditMyself } from '@/lib/firebase/applications'
import {
  getProgramPhase,
  PHASE_LABEL,
  daysUntilClose,
  formatPeriod,
  formatDate,
} from '@/lib/firebase/programs'
import { groupNoticeOf } from '@/lib/forms'
import { SITE } from '@/lib/config/site'
import { APPLICANT_STATUS_LABEL } from '@/lib/types'
import type { Program, Application, SupportUser } from '@/lib/types'
import type { User } from 'firebase/auth'
import type { AuthStatus } from '@/components/auth/AuthProvider'

/**
 * 프로그램 상세 화면 — 그리기만 (D-81 · 09-18). 조회는 app/apply/[programId]/page.tsx.
 * 따로 뗀 이유: 시안 확인용 임시 화면에서 가짜 데이터로 그려 보기 위해서.
 *
 * PC 는 본문 7 : 오른쪽 고정 카드 3 (Gemini 지시서 §5). 고정 카드에 상태·마감·기간·
 * 방식·문의처와 [신청서 작성하러 가기 ↓] — 누르면 **같은 화면의 신청 구획(#apply)으로 내려간다**
 * (모달 아님 — D-29 임시저장 없음·D-73 수정과 얽히지 않게). 휴대폰은 화면 아래 고정
 * 바(상태 + 버튼). 포스터가 있으면 본문 맨 위에 3:4 로, 누르면 확대.
 */
export default function ProgramDetailView({
  program,
  status,
  member,
  user,
  mine,
  wantsEdit,
}: {
  program: Program
  status: AuthStatus
  member: SupportUser | null
  user: User | null
  /** 이미 신청했는가 — undefined: 확인 전, null: 안 함 */
  mine: Application | null | undefined
  wantsEdit: boolean
}) {
  const phase = getProgramPhase(program)
  const dday = phase === 'open' ? daysUntilClose(program) : null
  const isGroup = program.participationType === 'group'

  /**
   * 단체 신청 안내 — **순서가 있다** (D-95 → D-99′).
   *   ① 전용 양식이 자기 문구를 갖고 있으면 **그게 이긴다.** 양식은 자기 방식을
   *      알고 있고, 담당자가 고른 값은 틀릴 수 있다
   *   ② 없으면(기본 신청서) 공고에서 담당자가 고른 「신청 방법」
   * 공고 화면이 방식을 **짐작하지 않는다** — 이 화면은 아무것도 안다고 가정하지 않는다.
   */
  const groupNotice = groupNoticeOf(program)

  /**
   * 고정 카드·하단 바의 버튼 하나 — 상태에 따라 글과 행선지가 다르다.
   * 접수중이면 같은 화면의 신청 구획(#apply)으로 내려간다.
   */
  const cta =
    phase === 'closed'
      ? null
      : phase === 'upcoming'
        ? { label: '접수 예정', href: '#apply', variant: 'secondary' as const }
        : status === 'guest'
          ? { label: '로그인하고 신청하기', href: `/login?next=${encodeURIComponent(`/apply/${program.id}`)}`, variant: 'primary' as const }
          : mine
            ? { label: '내 신청 보기', href: '#apply', variant: 'secondary' as const }
            : { label: '신청서 작성하러 가기 ↓', href: '#apply', variant: 'primary' as const }

  /**
   * [신청서 작성하러 가기 ↓] — 신청서 상태를 보고 간다 (lib/ui/formSeek.ts · 다섯 번째 지시서).
   * 안 썼으면 신청 상자 맨 위, 쓰다 말았으면 가장 위의 빈 필수 칸, 다 썼으면 제출 버튼.
   * 누를 때마다 다시 판단한다(캐시 없음). 폼이 없으면 상자로만.
   */
  const scrollToApply = useCallback(() => {
    const box = document.getElementById('apply')
    const form = box?.parentElement?.querySelector<HTMLFormElement>('form') ?? null
    seekApplication(box, form)
  }, [])

  const summary = (
    <div className="flex flex-wrap items-center gap-2">
      <Badge tone={phase}>{PHASE_LABEL[phase]}</Badge>
      <Badge tone={isGroup ? 'group' : 'individual'}>
        {isGroup ? '단체 프로그램' : '개인 신청'}
      </Badge>
      {dday !== null && (
        <span className="text-[13px] font-bold text-warn-ink">
          {dday === 0 ? '오늘 마감' : `D-${dday}`}
        </span>
      )}
    </div>
  )

  return (
    <>
      <PageHeader title={program.title} />

      {/* 휴대폰 하단 고정 바 자리를 비워 둔다(pb) — 바는 lg 미만에서만 */}
      <div className="container-page grid gap-8 py-10 pb-28 lg:grid-cols-[1fr_340px] lg:items-start lg:gap-10 lg:pb-10 xl:grid-cols-[1fr_380px]">
      <div className="flex min-w-0 flex-col gap-8">
        {/* 요약 (휴대폰·태블릿 — PC 는 오른쪽 카드에 있다) */}
        <div className="lg:hidden">{summary}</div>

        {/* 포스터 — 누르면 확대 */}
        {/* 가운데 정렬 + 은은한 전시 프레임 (09-18 지시서 2) — 왼쪽에 붙어 오른쪽이 비던 것 */}
        {program.poster?.url && (
          <div className="flex w-full items-center justify-center rounded-2xl border border-line/60 bg-subtle/80 p-6">
            <PosterViewer url={program.poster.url} title={program.title} className="w-full max-w-sm" />
          </div>
        )}

        {program.description && (
          <section>
            <h2 className="section-title">프로그램 소개</h2>
            <p className="mt-3 max-w-3xl whitespace-pre-line break-keep leading-relaxed text-ink-muted">
              {program.description}
            </p>
          </section>
        )}

        {/* 단체 프로그램 안내 — 개인정보 대리 수집 주의 */}
        {isGroup && (
          <div className="rounded-xl border border-status-revision/40 bg-status-revision/10 p-4 text-sm leading-relaxed">
            <p className="font-bold text-status-revision">
              단체 프로그램 신청 안내
            </p>
            <p className="mt-1.5 text-ink-muted">{groupNotice.body}</p>
          </div>
        )}

        {/* 신청 진입 — 고정 카드·하단 바의 버튼이 여기(#apply)로 내려온다 */}
        <div
          id="apply"
          tabIndex={-1}
          className="scroll-mt-28 rounded-2xl border border-dashed border-line-strong bg-subtle p-6 outline-none"
        >
          {phase === 'closed' ? (
            <p className="text-sm text-ink-muted">
              접수가 마감된 프로그램입니다.
            </p>
          ) : phase === 'upcoming' ? (
            <p className="text-sm text-ink-muted">
              아직 접수가 시작되지 않았습니다. 접수 시작일에 다시 방문해 주세요.
            </p>
          ) : status === 'guest' ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-ink-muted">
                신청하시려면 로그인이 필요합니다.
              </p>
              <Button
                href={`/login?next=${encodeURIComponent(`/apply/${program.id}`)}`}
              >
                로그인
              </Button>
            </div>
          ) : status === 'unregistered' ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-ink-muted">
                회원 등록을 마치시면 신청하실 수 있습니다.
              </p>
              <Button
                href={`/register?next=${encodeURIComponent(`/apply/${program.id}`)}`}
              >
                회원 등록
              </Button>
            </div>
          ) : mine && wantsEdit && canEditMyself(mine, program) ? (
            <p className="text-sm text-ink-muted">
              아래에서 신청 내용을 고친 뒤 <strong>[수정 내용 저장]</strong>을
              눌러 주세요.
            </p>
          ) : mine ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold">이미 신청하셨습니다</p>
                <p className="mt-1 text-sm text-ink-muted">
                  현재 상태 ·{' '}
                  <strong>{APPLICANT_STATUS_LABEL[mine.status]}</strong>
                  {(mine.editCount ?? 0) > 0 && (
                    <span className="text-ink-subtle">
                      {' '}
                      · {mine.editCount}회 수정
                    </span>
                  )}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {/* 마감 전 본인 수정 (D-73) — 조건은 취소와 같다 */}
                {canEditMyself(mine, program) && (
                  <Button href={`/apply/${program.id}?edit=1`}>
                    신청 내용 수정
                  </Button>
                )}
                <Button variant="secondary" href="/mypage">
                  내 신청 현황
                </Button>
              </div>
            </div>
          ) : mine === undefined ? (
            <p className="text-sm text-ink-muted">신청 가능 여부 확인 중…</p>
          ) : (
            <p className="text-sm text-ink-muted">
              아래 신청서를 확인하고 제출해 주세요.
            </p>
          )}
        </div>

        {/* 신청서 — 회원이고, 접수중이고, 아직 신청하지 않았을 때만 */}
        {phase === 'open' &&
          status === 'member' &&
          member &&
          user &&
          mine === null && (
            <ApplicationForm program={program} member={member} uid={user.uid} />
          )}

        {/* 신청서 수정 (D-73) — 같은 화면을 수정 모드로. 조건은 canEditMyself 가 정한다 */}
        {status === 'member' &&
          member &&
          user &&
          mine &&
          wantsEdit &&
          canEditMyself(mine, program) && (
            <ApplicationForm
              key={mine.id}
              program={program}
              member={member}
              uid={user.uid}
              editing={mine}
            />
          )}

        <Link
          href="/apply"
          className="inline-block text-sm text-ink-muted underline underline-offset-2"
        >
          ← 프로그램 목록
        </Link>
      </div>

      {/* 오른쪽 고정 카드 (PC) — 헤더 아래 화면의 세로 가운데에 떠서 따라온다 (.sticky-side) */}
      <StickyAside>
        <div className="card p-6">
          {summary}
          <dl className="mt-5 space-y-3 text-sm">
            {program.closesAt && (
              <div>
                <dt className="text-ink-subtle">신청 마감</dt>
                <dd className="mt-0.5 font-bold text-ink">
                  {formatDate(program.closesAt)}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-ink-subtle">접수 기간</dt>
              <dd className="mt-0.5 font-medium">{formatPeriod(program.opensAt, program.closesAt)}</dd>
            </div>
            {(program.activityStart || program.activityEnd) && (
              <div>
                <dt className="text-ink-subtle">활동 기간</dt>
                <dd className="mt-0.5 font-medium">
                  {formatPeriod(program.activityStart, program.activityEnd)}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-ink-subtle">신청 방식</dt>
              <dd className="mt-0.5 font-medium">
                {isGroup
                  ? `${groupNotice.howToApply}${program.maxTeamSize ? ` · 최대 ${program.maxTeamSize}명` : ''}`
                  : '개인별 신청 (팀 활동이어도 각자)'}
              </dd>
            </div>
            <div>
              <dt className="text-ink-subtle">문의</dt>
              <dd className="mt-0.5 font-medium">
                <a href={`mailto:${SITE.contact.email}`} className="hover:text-brand-600">
                  {SITE.contact.email}
                </a>
                <br />
                <a href={`tel:${SITE.contact.phone.replace(/-/g, '')}`} className="hover:text-brand-600">
                  {SITE.contact.phone}
                </a>
              </dd>
            </div>
          </dl>
          <div className="mt-6">
            {cta ? (
              cta.href === '#apply' ? (
                <Button variant={cta.variant} full onClick={scrollToApply}>
                  {cta.label}
                </Button>
              ) : (
                <Button href={cta.href} variant={cta.variant} full>
                  {cta.label}
                </Button>
              )
            ) : (
              <p className="rounded-lg bg-subtle px-4 py-3 text-center text-sm font-semibold text-ink-subtle">
                접수가 마감되었습니다
              </p>
            )}
          </div>
        </div>
      </StickyAside>
      </div>

      {/* 휴대폰·태블릿 하단 고정 바 — 상태 요약 + 버튼 (지시서 §5). 마감이면 안 띄운다 */}
      {cta && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
          <div className="container-page flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{program.title}</p>
              <p className="text-xs text-ink-muted">
                {PHASE_LABEL[phase]}
                {dday !== null && ` · ${dday === 0 ? '오늘 마감' : `D-${dday}`}`}
                {program.closesAt && ` · ${formatDate(program.closesAt)}까지`}
              </p>
            </div>
            {cta.href === '#apply' ? (
              <Button variant={cta.variant} className="shrink-0" onClick={scrollToApply}>
                {cta.label}
              </Button>
            ) : (
              <Button href={cta.href} variant={cta.variant} className="shrink-0">
                {cta.label}
              </Button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
