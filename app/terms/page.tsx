import PageHeader from '@/components/ui/PageHeader'
import DraftNotice from '@/components/ui/DraftNotice'

export const metadata = { title: '이용약관' }

/**
 * 이용약관 — 초안.
 * ⚠️ 공개 전 기관 행정 검토 필요. 기관 표준 양식이 있으면 그쪽을 따르십시오.
 */

const SECTIONS = [
  {
    title: '제1조 (목적)',
    body: '이 약관은 제주대학교 지능소프트웨어교육연구소가 운영하는 교원양성지원사업 플랫폼(이하 “서비스”)의 이용 조건과 절차, 이용자와 운영 기관의 권리·의무를 정하는 것을 목적으로 합니다.',
  },
  {
    title: '제2조 (이용 자격)',
    body: '서비스는 교원양성지원사업 참여를 희망하는 현직 교원 및 예비교원이 이용할 수 있습니다. 이용을 위해서는 회원 등록이 필요하며, 등록 시 사실에 부합하는 정보를 입력해야 합니다.',
  },
  {
    title: '제3조 (계정 관리)',
    body: '이용자는 자신의 계정을 직접 관리할 책임이 있으며, 타인에게 양도하거나 대여할 수 없습니다. 계정의 부정 사용을 인지한 경우 즉시 운영 기관에 알려야 합니다.',
  },
  {
    title: '제4조 (제출 자료의 정확성)',
    body: '이용자가 제출한 신청서 및 증빙 서류의 내용은 사실이어야 합니다. 허위 사실이 확인된 경우 선정이 취소되거나 지원금이 환수될 수 있습니다.',
  },
  {
    title: '제5조 (산출물의 이용)',
    body: '이용자가 제출한 지도안 등 산출물은 사업의 성과 공유 목적으로 서비스 내 갤러리에 게시될 수 있습니다. 게시 여부는 운영 기관의 확인을 거쳐 결정되며, 이용자가 원하지 않는 경우 게시하지 않습니다.',
  },
  {
    title: '제6조 (금지 행위)',
    body: '이용자는 타인의 저작물을 무단으로 사용하거나, 초상권 동의를 받지 않은 사진을 제출하는 등 타인의 권리를 침해하는 행위를 해서는 안 됩니다.',
  },
  {
    title: '제7조 (서비스의 변경 및 중단)',
    body: '운영 기관은 사업 일정과 운영 사정에 따라 서비스의 내용을 변경하거나 제공을 중단할 수 있으며, 이 경우 사전에 공지합니다.',
  },
  {
    title: '제8조 (약관의 변경)',
    body: '이 약관이 변경되는 경우 시행일과 변경 사유를 명시하여 사전에 공지합니다.',
  },
]

export default function TermsPage() {
  return (
    <>
      <PageHeader
        title="이용약관"
        description="교원양성지원사업 플랫폼 이용에 관한 약관입니다."
      />

      <div className="container-page space-y-8 py-10">
        <DraftNotice what="이용약관" />
        <p className="text-sm text-ink-subtle">시행일: (지정 예정)</p>

        {SECTIONS.map((s) => (
          <section key={s.title}>
            <h2 className="text-base font-bold tracking-tight">{s.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              {s.body}
            </p>
          </section>
        ))}
      </div>
    </>
  )
}
