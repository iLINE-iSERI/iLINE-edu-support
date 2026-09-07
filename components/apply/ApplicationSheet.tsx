'use client'

/**
 * 신청서 인쇄본 (D-28) — PDF로 뜨는 원본.
 *
 * 화면에는 보이지 않는다. html2canvas 가 이 요소를 캡처해 PDF로 만든다.
 * `display: none` 이면 캡처되지 않으므로, 화면 밖으로 밀어내는 방식을 쓴다.
 *
 * ⚠️ 색상 변수(theme token)를 쓰지 않고 값을 직접 적는다.
 *    다크 모드에서 캡처하면 검은 배경의 PDF가 나오기 때문이다.
 *    인쇄물은 언제나 흰 종이에 검은 글씨여야 한다.
 */

import { forwardRef } from 'react'
import { SITE } from '@/lib/config/site'
import { profileRows, type Program, type SupportUser } from '@/lib/types'

const ApplicationSheet = forwardRef<
  HTMLDivElement,
  {
    program: Program
    member: SupportUser
    note: string
    fileNames: string[]
    /**
     * 초상권 동의 — **이 화면에서 방금 받은 답** (D-44).
     * 회원 문서를 읽지 않는다. 읽으면 가입 때의 옛 답이 인쇄되어,
     * 신청자가 화면에서 고른 것과 **제출된 원본이 달라진다.**
     * `null` 은 아직 고르지 않음 — 제출이 막히므로 PDF에는 오지 않는다.
     */
    portraitConsent: boolean | null
  }
>(function ApplicationSheet(
  { program, member, note, fileNames, portraitConsent },
  ref
) {
  const consent = (purpose: string) =>
    member.consents.some((c) => c.purpose === purpose && c.agreed) ? 'O' : 'X'

  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: '-10000px',
        top: 0,
        width: '794px', // A4 210mm @ 96dpi
        background: '#ffffff',
        color: '#111111',
        padding: '56px 48px',
        fontFamily:
          "'Pretendard', -apple-system, 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif",
        fontSize: '14px',
        lineHeight: 1.7,
      }}
      ref={ref}
    >
      <header style={{ textAlign: 'center', marginBottom: '32px' }}>
        <p style={{ fontSize: '13px', color: '#555' }}>
          {SITE.funder} · {SITE.programName}
        </p>
        <h1
          style={{
            fontSize: '26px',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            margin: '6px 0 0',
          }}
        >
          프로그램 참가 신청서
        </h1>
      </header>

      <Section title="신청 프로그램">
        <Table
          rows={[
            ['프로그램명', program.title],
            ['사업 연도', `${program.year}년`],
            ['신청일', today],
          ]}
        />
      </Section>

      <Section title="신청자 정보">
        {/* 유형(D-43)에 따라 칸이 다르다 — lib/types 의 profileRows 가 정한다 */}
        <Table rows={profileRows(member)} />
      </Section>

      <Section title="동의 여부">
        <Table
          rows={[
            ['개인정보 수집·이용 동의', consent('personal_info')],
            [
              '초상권 활용 동의',
              portraitConsent === null ? '' : portraitConsent ? 'O' : 'X',
            ],
          ]}
        />
        <p style={{ fontSize: '12px', color: '#666', marginTop: '6px' }}>
          개인정보 수집·이용 동의는 회원가입 시, 초상권 활용 동의는 본 신청서
          제출 시 전자적으로 수집되었으며, 각 동의 일시와 약관 버전이 시스템에
          기록되어 있습니다.
        </p>
      </Section>

      {note.trim() && (
        <Section title={program.noteLabel || '추가 기재 사항'}>
          <div
            style={{
              border: '1px solid #ddd',
              padding: '14px 16px',
              whiteSpace: 'pre-wrap',
              minHeight: '80px',
            }}
          >
            {note}
          </div>
        </Section>
      )}

      {fileNames.length > 0 && (
        <Section title="첨부 서류">
          <ol style={{ paddingLeft: '20px', margin: 0 }}>
            {fileNames.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ol>
        </Section>
      )}

      <p style={{ marginTop: '36px', textAlign: 'center' }}>
        위와 같이 <strong>{program.title}</strong> 참가를 신청합니다.
      </p>

      <p
        style={{
          marginTop: '20px',
          textAlign: 'right',
          fontSize: '15px',
        }}
      >
        {today} · 신청인 <strong>{member.name}</strong>
      </p>

      <footer
        style={{
          marginTop: '40px',
          paddingTop: '14px',
          borderTop: '1px solid #ddd',
          fontSize: '11px',
          color: '#777',
          textAlign: 'center',
        }}
      >
        {SITE.operator} · 본 문서는 온라인 제출 시점에 자동 생성된 원본입니다.
      </footer>
    </div>
  )
})

export default ApplicationSheet

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section style={{ marginBottom: '24px' }}>
      <h2
        style={{
          fontSize: '15px',
          fontWeight: 700,
          margin: '0 0 8px',
          paddingBottom: '4px',
          borderBottom: '2px solid #111',
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  )
}

function Table({ rows }: { rows: [string, string][] }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k}>
            <th
              style={{
                width: '170px',
                textAlign: 'left',
                background: '#f5f5f5',
                border: '1px solid #ddd',
                padding: '8px 12px',
                fontWeight: 600,
              }}
            >
              {k}
            </th>
            <td style={{ border: '1px solid #ddd', padding: '8px 12px' }}>
              {v || '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
