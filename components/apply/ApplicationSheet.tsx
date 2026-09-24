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
import {
  profileRows,
  type ApplicantSnapshot,
  type Program,
  type SupportUser,
} from '@/lib/types'

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
    /** 프로그램 전용 항목의 답 (D-50). 없는 프로그램이 대부분이다 */
    formRows?: { label: string; value: string }[]
    /**
     * 동의한 내용 — **본문 전문까지** (D-99).
     * 「신청 내용」 표에는 「확인함」 한 줄만 가므로, 공고를 나중에 고치면
     * 무엇에 동의했는지 알 수 없게 된다. 그래서 PDF 에 본문을 박아 둔다.
     */
    sealed?: { label: string; body: string; answer: string }[]
    /**
     * 수정 모드 (D-73) — 제출 당시의 신청자 사본과 최초 제출일.
     * 회원 문서가 아니라 **신청서에 박힌 값**으로 찍어야 원본과 같다.
     * `editedAt` 이 있으면 "수정본 (n회)" 표시가 붙는다.
     */
    edit?: {
      applicant: ApplicantSnapshot
      submittedAt?: Date
      editNo: number
    }
  }
>(function ApplicationSheet(
  { program, member, note, fileNames, portraitConsent, formRows, sealed, edit },
  ref
) {
  const consent = (purpose: string) =>
    edit
      ? edit.applicant.personalInfoConsent
        ? 'O'
        : 'X'
      : member.consents.some((c) => c.purpose === purpose && c.agreed)
        ? 'O'
        : 'X'
  const person = edit ? edit.applicant : member

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
            [
              '신청일',
              edit?.submittedAt
                ? edit.submittedAt.toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })
                : today,
            ],
            ...(edit ? [[`수정본 (${edit.editNo}회)`, `${today} 수정`] as [string, string]] : []),
          ]}
        />
      </Section>

      <Section title="신청자 정보">
        {/* 유형(D-43)에 따라 칸이 다르다 — lib/types 의 profileRows 가 정한다 */}
        <Table rows={profileRows(person)} />
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

      {/* 프로그램 전용 항목 — 저장된 라벨을 그대로 쓴다.
          이 화면은 어떤 양식인지 모르고, 알 필요도 없다 (D-50). */}
      {formRows && formRows.length > 0 && (
        <Section title="신청 내용">
          <Table rows={formRows.map((r) => [r.label, r.value])} />
        </Section>
      )}

      {/* 동의한 내용 (D-99) — **본문 전문.** 표 한 칸이 아니라 note 와 같은 상자로
          그린다: 여러 장에 걸쳐도 글줄 사이에서만 잘려 읽는 데 지장이 없다
          (data-pdf-keep 을 일부러 안 단다 — 붙이면 한 장보다 길 때 통째로 잘린다) */}
      {sealed && sealed.length > 0 && (
        <Section title="동의·선택한 내용">
          {sealed.map((c, i) => (
            <div
              key={`${c.label}-${i}`}
              style={{
                border: '1px solid #ccc',
                padding: '10px 12px',
                marginBottom: '10px',
              }}
            >
              <p style={{ fontWeight: 700, marginBottom: '6px' }}>
                {c.label} — {c.answer}
              </p>
              {/* 고르기에 읽을 글이 없으면 본문이 빈다 — 빈 상자를 만들지 않는다 */}
              {c.body.trim() && (
                <p style={{ whiteSpace: 'pre-wrap', fontSize: '13px', color: '#333' }}>
                  {c.body}
                </p>
              )}
            </div>
          ))}
        </Section>
      )}

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
      {/* ↑ 자유 기재란은 길어질 수 있어 통째로 묶지 않는다.
          중간에서 잘려도 글줄 사이라 읽는 데 지장이 없다. */}

      {fileNames.length > 0 && (
        <Section title="첨부 서류">
          <ol style={{ paddingLeft: '20px', margin: 0 }}>
            {fileNames.map((n, i) => (
              <li key={i} data-pdf-keep>
                {n}
              </li>
            ))}
          </ol>
        </Section>
      )}

      {/* 맺음말·서명·꼬리말은 **한 덩어리**로 묶는다.
          "위와 같이 신청합니다"와 서명이 서로 다른 장에 떨어지면
          서명 없는 신청서처럼 보인다. */}
      <div data-pdf-keep>
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
          {today} · 신청인 <strong>{person.name}</strong>
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
          // data-pdf-keep — 페이지를 넘길 때 **이 줄 안에서는 자르지 않는다.**
          // 표 한 줄이 두 장에 걸치면 글자가 반으로 잘려 보인다 (lib/pdf 참고).
          <tr key={k} data-pdf-keep>
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
