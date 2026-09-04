import PageHeader from '@/components/ui/PageHeader'
import NoticeNav from '@/components/layout/NoticeNav'
import DraftNotice from '@/components/ui/DraftNotice'

export const metadata = { title: 'FAQ · 문의' }

/**
 * 자주 묻는 질문 + 문의 안내.
 *
 * 확정된 사업 규정(D-16~D-19)에 근거한 항목만 담았습니다.
 * 금액·일정처럼 공고문에 달린 항목은 넣지 않았습니다.
 */

const FAQ = [
  {
    q: '그뤠잇(AI 교육 플랫폼) 계정으로 로그인했는데 신청이 안 됩니다.',
    a: '그뤠잇과 로그인 계정은 공유하지만, 교원양성지원사업은 별도 회원 등록이 필요합니다. 로그인 후 상단의 “회원 등록”을 눌러 소속·연락처를 입력해 주세요. 한 번만 하시면 됩니다.',
  },
  {
    q: '팀으로 활동하는데 대표자 한 명만 신청하면 되나요?',
    a: '아닙니다. 팀으로 활동하시더라도 구성원이 각각 신청해야 합니다. 여비 정산도 각자 본인 명의로 진행합니다. 다만 산출물은 팀 단위로 한 번만 제출하시면 되고, 제출할 때 팀명과 구성원 이름을 함께 적으시면 됩니다.',
  },
  {
    q: '신청서를 한 번에 다 작성하기 어렵습니다.',
    a: '작성 중인 내용은 임시저장되므로 나중에 이어서 쓰실 수 있습니다. 최종 제출 전까지는 언제든 수정할 수 있습니다.',
  },
  {
    q: '휴대폰으로도 신청과 정산이 가능한가요?',
    a: '가능합니다. 영수증이나 신분증은 휴대폰 카메라로 바로 촬영해 첨부하실 수 있습니다.',
  },
  {
    q: '신분증을 제출할 때 주의할 점이 있나요?',
    a: '주민등록번호 뒷자리는 가린 상태로 촬영해 제출해 주세요. 제출하신 서류는 사업 담당자만 열람할 수 있으며, 보유 기간이 지나면 파기됩니다.',
  },
  {
    q: '심사 결과는 어떻게 확인하나요?',
    a: '마이페이지의 “내 신청 현황”에서 확인하실 수 있습니다. 보완이 필요한 경우 사유가 함께 표시됩니다.',
  },
  {
    q: '제출한 산출물이 갤러리에 바로 공개되나요?',
    a: '담당자 확인 후 공개됩니다. 학생 얼굴이 담긴 사진이나 타인의 저작물이 포함되지 않았는지 확인하는 절차입니다.',
  },
  {
    q: '탈퇴하면 제출한 서류도 삭제되나요?',
    a: '아닙니다. 국고 지원사업 서류는 법령이 정한 기간 동안 보존해야 하므로, 탈퇴 시에도 신청·정산 이력은 남습니다. 로그인은 더 이상 되지 않습니다.',
  },
]

export default function FaqPage() {
  return (
    <>
      <PageHeader
        title="알림마당"
        description="공지사항과 제출 서식, 자주 묻는 질문을 확인하세요."
      />
      <NoticeNav />

      <div className="container-page space-y-8 py-10">
        <section>
          <h2 className="text-lg font-bold tracking-tight">자주 묻는 질문</h2>
          <div className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {FAQ.map((item) => (
              <details key={item.q} className="group">
                <summary className="flex cursor-pointer touch-target list-none items-center justify-between gap-4 px-5 py-4 text-left font-semibold marker:content-none">
                  <span>{item.q}</span>
                  <svg
                    className="size-5 shrink-0 text-ink-subtle transition-transform group-open:rotate-180"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </summary>
                <p className="px-5 pb-5 text-sm leading-relaxed text-ink-muted">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-bold tracking-tight">문의하기</h2>
          <div className="mt-4 space-y-3">
            <DraftNotice what="담당자 연락처" />
            <dl className="grid gap-3 rounded-2xl border border-line bg-surface p-5 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-ink-subtle">운영 기관</dt>
                <dd className="mt-0.5 font-medium">
                  제주대학교 지능소프트웨어교육연구소
                </dd>
              </div>
              <div>
                <dt className="text-ink-subtle">문의 이메일</dt>
                <dd className="mt-0.5 font-medium">(등록 예정)</dd>
              </div>
              <div>
                <dt className="text-ink-subtle">전화</dt>
                <dd className="mt-0.5 font-medium">(등록 예정)</dd>
              </div>
              <div>
                <dt className="text-ink-subtle">운영 시간</dt>
                <dd className="mt-0.5 font-medium">평일 09:00 ~ 18:00</dd>
              </div>
            </dl>
          </div>
        </section>
      </div>
    </>
  )
}
