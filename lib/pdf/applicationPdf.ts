/**
 * 신청서 PDF 생성 (D-28)
 *
 * 왜 화면을 그려서 이미지로 뜨는가:
 *   jsPDF 에 한글을 직접 그리려면 한글 폰트 파일을 번들에 심어야 하고,
 *   그러면 용량이 수 MB 늘고 폰트 라이선스도 따져야 한다.
 *   화면에 그린 것을 html2canvas 로 캡처하면 **브라우저 폰트를 그대로 쓰므로**
 *   한글이 깨지지 않는다. iLINE 수료증도 같은 방식이다.
 *
 * ⚠️ 이 모듈은 브라우저에서만 동작한다. 서버에서 부르면 안 된다.
 *    두 라이브러리가 무거워서 호출 시점에 동적으로 불러온다.
 */

/** A4 (mm) */
const A4_W = 210
const A4_H = 297

/**
 * 주어진 DOM 요소를 A4 PDF로 만들어 Blob 으로 돌려준다.
 * 내용이 한 장을 넘으면 페이지를 나눈다.
 */
export async function elementToPdfBlob(el: HTMLElement): Promise<Blob> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ])

  const canvas = await html2canvas(el, {
    scale: 2, // 인쇄해도 글자가 뭉개지지 않을 정도
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
  })

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const imgH = (canvas.height * A4_W) / canvas.width
  const image = canvas.toDataURL('image/jpeg', 0.92)

  if (imgH <= A4_H) {
    pdf.addImage(image, 'JPEG', 0, 0, A4_W, imgH)
  } else {
    // 여러 장 — 같은 이미지를 위로 밀어 올리며 잘라 넣는다
    let remaining = imgH
    let offset = 0
    while (remaining > 0) {
      pdf.addImage(image, 'JPEG', 0, -offset, A4_W, imgH)
      remaining -= A4_H
      offset += A4_H
      if (remaining > 0) pdf.addPage()
    }
  }

  return pdf.output('blob')
}
