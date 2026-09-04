import PageHeader from '@/components/ui/PageHeader'
import DraftNotice from '@/components/ui/DraftNotice'

export const metadata = { title: '개인정보처리방침' }

/**
 * 개인정보처리방침 — 초안.
 *
 * ⚠️ 법적 효력이 있는 문서입니다. 반드시 기관 행정·법무 검토를 받은 뒤
 *    공개하세요. 아래는 이 사이트가 실제로 수집·처리하는 항목에 맞춰
 *    작성한 뼈대이며, 기관 표준 양식이 있다면 그쪽을 따르십시오.
 *
 * 검토 시 확인할 것 (docs/TODO-later.md D항목 Q-7과 연결)
 *  · 개인정보 보호책임자 지정 및 연락처
 *  · 보유기간이 사업 규정·법령과 맞는지
 *  · 구글 스프레드시트·드라이브 이용에 따른 처리위탁/국외이전 기재 필요 여부
 */

const SECTIONS = [
  {
    title: '1. 수집하는 개인정보 항목',
    body: [
      '회원 등록 시: 성명, 소속, 직위, 연락처, 이메일',
      '과제 신청 시: 신분증 사본, 재직(재학)증명서 등 자격 증빙 서류',
      '정산 시: 계좌 정보, 영수증 등 지출 증빙 서류',
      '자동 수집: 서비스 이용 기록, 접속 로그',
    ],
  },
  {
    title: '2. 개인정보의 수집·이용 목적',
    body: [
      '사업 참여자 자격 확인 및 심사',
      '사업 운영에 필요한 안내 및 연락',
      '활동비 정산 및 지급',
      '사업 성과 관리 및 결과 보고',
    ],
  },
  {
    title: '3. 보유 및 이용 기간',
    body: [
      '원칙적으로 사업 종료 후 관계 법령이 정한 기간까지 보관한 뒤 파기합니다.',
      '국고 보조사업 관련 서류는 관련 법령에 따른 보존 의무가 있어, 회원 탈퇴 시에도 신청·정산 이력은 해당 기간 동안 보존됩니다.',
      '보존 기간이 지난 개인정보는 복구할 수 없는 방법으로 파기합니다.',
    ],
  },
  {
    title: '4. 개인정보의 제3자 제공',
    body: [
      '원칙적으로 이용자의 개인정보를 외부에 제공하지 않습니다.',
      '다만 사업 총괄 기관에 대한 성과 보고 등 법령에 근거가 있거나 이용자가 동의한 경우에 한하여 제공할 수 있습니다.',
    ],
  },
  {
    title: '5. 개인정보 처리의 위탁',
    body: [
      '서비스 운영을 위해 아래와 같이 처리를 위탁하고 있습니다.',
      'Google LLC — 인증, 데이터 보관, 파일 저장 (Firebase)',
      'Vercel Inc. — 웹 서비스 호스팅',
    ],
  },
  {
    title: '6. 정보주체의 권리와 행사 방법',
    body: [
      '이용자는 자신의 개인정보에 대한 열람·정정·삭제·처리정지를 요구할 수 있습니다.',
      '마이페이지에서 직접 정정하거나, 담당자에게 문의하여 요청하실 수 있습니다.',
      '다만 법령상 보존 의무가 있는 정보는 삭제 요구가 제한될 수 있습니다.',
    ],
  },
  {
    title: '7. 개인정보의 안전성 확보 조치',
    body: [
      '접근 권한 관리: 제출 서류는 본인과 사업 담당자만 열람할 수 있도록 제한합니다.',
      '전송 구간 암호화: 모든 통신은 HTTPS로 보호됩니다.',
      '최소 수집: 사업 운영에 필요한 최소한의 항목만 수집합니다.',
    ],
  },
  {
    title: '8. 개인정보 보호책임자',
    body: [
      '개인정보 처리에 관한 문의는 아래로 연락해 주시기 바랍니다.',
      '운영 기관: 제주대학교 지능소프트웨어교육연구소',
      '보호책임자: (지정 예정)',
      '연락처: (등록 예정)',
    ],
  },
]

export default function PrivacyPage() {
  return (
    <>
      <PageHeader
        title="개인정보처리방침"
        description="교원양성지원사업 플랫폼의 개인정보 처리에 관한 안내입니다."
      />

      <div className="container-page space-y-8 py-10">
        <DraftNotice what="개인정보처리방침" />
        <p className="text-sm text-ink-subtle">시행일: (지정 예정)</p>

        {SECTIONS.map((s) => (
          <section key={s.title}>
            <h2 className="text-base font-bold tracking-tight">{s.title}</h2>
            <ul className="mt-3 space-y-2">
              {s.body.map((line) => (
                <li
                  key={line}
                  className="flex gap-2.5 text-sm leading-relaxed text-ink-muted"
                >
                  <span
                    aria-hidden="true"
                    className="mt-2 size-1 shrink-0 rounded-full bg-line-strong"
                  />
                  {line}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  )
}
