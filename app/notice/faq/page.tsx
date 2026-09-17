import PageHeader from '@/components/ui/PageHeader'
import NoticeNav from '@/components/layout/NoticeNav'
import { SITE } from '@/lib/config/site'

export const metadata = { title: 'FAQ · 문의' }

/**
 * 자주 묻는 질문 + 문의 안내.
 *
 * 확정된 사업 규정(D-16~D-19)에 근거한 항목만 담습니다.
 * 금액·일정처럼 공고문에 달린 항목은 넣지 않습니다.
 *
 * ⚠️ **결정이 바뀌면 이 파일도 함께 고친다.** (09-10에 값을 치르고 배운 것)
 *    처리방침에서 "신분증을 받는다"는 문구를 고쳤을 때 여기를 안 봐서,
 *    **없는 기능 셋을 안내하고 있었다** — 임시저장(D-29로 없음),
 *    신분증 제출(D-40으로 없음), 보완 사유 표시(D-46으로 안 보임).
 *    FAQ 는 **이용자가 그대로 믿는 화면**이라 틀리면 그대로 문의가 된다.
 */

const FAQ = [
  {
    q: 'iLINE(AI 교육 플랫폼) 계정으로 로그인이 안 됩니다.',
    a: '교원양성지원사업은 iLINE과 별도의 계정을 사용합니다. 개인정보를 사업 단위로 분리해 보관하기 위한 것입니다. 상단의 “회원가입”에서 새로 가입해 주세요. iLINE에서 쓰시던 Google 계정을 그대로 선택하셔도 됩니다.',
  },
  {
    // D-76 (09-17): 산출물은 팀원 누구나 올리고 팀명으로 묶인다. 예전 답("팀 단위로 한 번,
    // 팀명·구성원 이름을 적는다")은 D-17 시절 설계라 지웠다 — 이제 팀명은 신청서에서 온다.
    q: '팀으로 활동하는데 대표자 한 명만 신청하면 되나요?',
    a: '아닙니다. 팀으로 활동하시더라도 구성원이 각각 신청하고, 신청서의 팀명을 똑같이 적어야 한 팀으로 묶입니다. 여비 정산도 각자 본인 명의로 진행합니다. 산출물은 팀원 누구나 「산출물 제출」에서 올릴 수 있고, 같은 팀이 올린 것은 한데 모여 보이므로 같은 것을 여러 사람이 올릴 필요는 없습니다.',
  },
  {
    // D-29: 임시저장을 만들지 않았다. "저장했겠지" 하고 창을 닫으면 사라진다.
    q: '신청서를 쓰다가 중간에 저장할 수 있나요?',
    a: '임시저장 기능은 없습니다. 한 번에 작성해 제출해 주세요. 미리 준비하실 것은 많지 않습니다 — 회원 정보는 자동으로 채워지고, 프로그램에 따라 몇 가지를 더 고르거나 적으시면 됩니다. 접수 기간 중에는 마이페이지에서 신청 내용(프로그램별 항목·기재란)을 직접 고칠 수 있고, 신청을 취소하고 다시 신청하실 수도 있습니다.',
  },
  {
    // D-40: 신분증·통장 사본은 아예 받지 않는다.
    //       "안 받는다"를 문항으로 만들면 오히려 "그런 게 있나" 싶게 하므로,
    //       **실제로 받는 것만** 설명한다 (iSERI, 09-10).
    q: '휴대폰으로도 신청과 정산이 가능한가요?',
    a: '가능합니다. 영수증처럼 첨부가 필요한 서류는 휴대폰 카메라로 바로 촬영해 올리실 수 있습니다. 여비 지급에 필요한 계좌 정보는 정산 단계에서 직접 입력하시며, 담당자만 볼 수 있고 외부로 나가지 않습니다.',
  },
  {
    // D-46: 결과는 공지사항의 선정자 목록으로 알리고, 개별 사유는 보이지 않는다.
    q: '심사 결과는 어떻게 확인하나요?',
    a: '선정 결과는 알림마당의 공지사항에 선정자 목록으로 올라갑니다. 마이페이지의 “내 신청 현황”에서도 상태를 확인하실 수 있습니다. 개별 심사 사유는 안내해 드리지 않으며, 서류 보완이 필요한 경우에는 담당자가 따로 연락드립니다.',
  },
  {
    // 갤러리는 1차 오픈에서 메뉴를 내렸다(D-47). 대신 실제로 받는 동의를 설명한다.
    q: '활동 사진이 공개되나요?',
    a: '프로그램을 신청하실 때 촬영·초상권 활용에 동의하실지 직접 고르실 수 있습니다. 동의하지 않으셔도 신청과 참여에는 아무 제한이 없습니다. 동의는 신청하신 프로그램별로 따로 받습니다.',
  },
  {
    // 산출물 제출 (D-76 · 09-17) — 상단 메뉴. 승인 없음, 활동 기간 중 언제든, 여러 번.
    q: '산출물은 어디에 내나요?',
    a: '프로그램에 선정되면 상단 메뉴 「산출물 제출」에 그 프로그램의 제출창이 열립니다. 제목과 내용을 적고 파일을 붙여 제출하면 그 자리에서 접수되며, 따로 승인 절차는 없습니다. 활동 기간 중에는 언제든 낼 수 있고, 지도안과 활동 사진처럼 여러 건을 따로 내셔도 됩니다. 무엇을 올릴지는 제출창 위에 있는 담당자 안내를 확인해 주세요.',
  },
  {
    q: '올린 산출물을 고칠 수 있나요? 담당자 요청은 어디서 보나요?',
    a: '네. 활동 기간 중에는 「산출물 제출」에서 [다시 제출하기]를 눌러 제목·내용·파일을 고칠 수 있습니다. 담당자가 추가로 요청한 것이 있으면 그 산출물에 「추가 요청」 표시와 함께 요청 내용이 보이고, 고쳐서 다시 내면 표시가 사라집니다. 활동 기간이 끝난 뒤에 꼭 고쳐야 할 것이 있으면 담당자에게 문의해 주세요.',
  },
  {
    q: '제가 올린 산출물을 다른 참여자도 보나요?',
    a: '프로그램마다 다릅니다. 담당자가 「참여자 공유」로 둔 프로그램은 로그인한 회원끼리 「참여자 자료실」에서 서로의 산출물을 볼 수 있으며, 이때 올린 사람의 이름은 보이지 않고 팀명(개인 프로그램은 소속·전공)만 보입니다. 「비공개」 프로그램은 본인과 담당자만 봅니다. 어느 쪽인지는 제출창 위의 표시로 확인하실 수 있습니다.',
  },
  {
    // 사진 속 제3자 (D-75 ⑦ · 처리방침 제13조 ⑤)
    q: '활동 사진에 다른 사람이 함께 나옵니다. 올려도 되나요?',
    a: '함께 나온 분의 동의를 받고 올려 주세요. 반대로 본인이 원치 않는 사진이 참여자 자료실에 올라와 있으면 담당자에게 알려 주세요 — 담당자가 그 산출물을 공유 화면에서 내립니다. 내린 산출물은 지워지지 않고 올린 본인과 담당자에게만 남습니다.',
  },
  {
    // 시설 예약 (D-52~58). "예약되었습니다"가 아니라 접수→확정 2단계라는 것을 설명한다.
    q: '공부실 예약이 「접수됨」인데 써도 되나요?',
    a: '아직은 아닙니다. 시설이 사범대학 소속이라, 매주 한 번 담당자가 예약을 모아 행정실에 사용 요청을 보내고 그때 「확정됨」으로 바뀝니다. 예약 화면 맨 위에 언제까지 예약하면 언제 확정되는지가 나오고, 확정되면 「내 예약」에서 확인하실 수 있습니다. 확정 뒤에 못 가시게 되면 「내 예약」에서 취소해 주세요 — 취소 사실도 행정실에 함께 알립니다.',
  },
  {
    q: '오늘 당장 쓰거나, 주말·저녁에 쓰고 싶습니다.',
    a: '사이트에서는 다음 주 이후의 평일 09~18시만 예약할 수 있습니다. 당일 이용, 이용 당일에 시간을 더 쓰는 것, 주말과 18시 이후 이용, 단체 행사·워크숍(단체대관 전용 공간인 2334 하이브리드러닝연구실)은 사이트에서 신청받지 않지만 이용이 불가능한 것은 아닙니다 — 아래 문의처로 연락하시면 가능한 경우가 있습니다.',
  },
  {
    q: '탈퇴하면 제출한 서류도 삭제되나요?',
    a: '아닙니다. 국고 지원사업 서류는 법령이 정한 기간 동안 보존해야 하므로, 탈퇴 시에도 신청·정산·산출물 이력은 남습니다. 등록하신 회원 정보는 마이페이지의 “내 정보 → 수정하기”에서 언제든 고치실 수 있습니다. 보존 기간은 개인정보처리방침 제3조를 참고해 주세요.',
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
          <h2 className="section-title">자주 묻는 질문</h2>
          <div className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
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
          <h2 className="section-title">문의하기</h2>
          <dl className="mt-4 grid gap-4 rounded-2xl border border-line bg-surface shadow-card p-5 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-ink-subtle">운영 기관</dt>
              <dd className="mt-0.5 font-medium">{SITE.operator}</dd>
            </div>
            <div>
              <dt className="text-ink-subtle">운영 시간</dt>
              <dd className="mt-0.5 font-medium">{SITE.contact.hours}</dd>
            </div>
            <div>
              <dt className="text-ink-subtle">문의 이메일</dt>
              <dd className="mt-0.5">
                {/* 누르면 바로 메일이 열린다 — 휴대폰에서 주소를 옮겨 적지 않게 */}
                <a
                  href={`mailto:${SITE.contact.email}`}
                  className="font-medium underline underline-offset-2"
                >
                  {SITE.contact.email}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-ink-subtle">전화</dt>
              <dd className="mt-0.5">
                <a
                  href={`tel:${SITE.contact.phone.replace(/-/g, '')}`}
                  className="font-medium underline underline-offset-2"
                >
                  {SITE.contact.phone}
                </a>
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-ink-subtle">카카오톡 채널</dt>
              <dd className="mt-0.5">
                <a
                  href={SITE.contact.kakaoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="touch-target mt-1 inline-flex items-center rounded-xl bg-[#FEE500] px-5 font-bold text-[#191600] hover:brightness-95"
                >
                  카카오톡으로 문의하기
                </a>
              </dd>
            </div>
          </dl>
        </section>

      </div>
    </>
  )
}
