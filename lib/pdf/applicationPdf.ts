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

/** 페이지를 넘길 때 아래쪽에 남겨 두는 여백 (mm) */
const BOTTOM_GAP = 6
/** 한 장에 최소한 이만큼은 내용이 들어가야 한다 (mm) — 무한 반복 방지 */
const MIN_FILL = 40

/**
 * "여기서 자르면 안 된다"고 표시된 덩어리들의 **아래쪽 경계**를 mm 로 모은다.
 *
 * 신청서 원본(`ApplicationSheet`)이 표의 각 줄·목록의 각 항목에
 * `data-pdf-keep` 을 달아 둔다. 그 경계에서만 페이지를 넘기면
 * **표 한 줄이 두 장에 걸쳐 잘리는 일이 없다.**
 */
function cutPointsOf(el: HTMLElement): number[] {
  const top = el.getBoundingClientRect().top
  // 화면 폭(px)을 A4 폭(mm)으로 환산하는 비율.
  // 캡처 배율(scale)과 무관하다 — 어차피 이미지는 A4_W 에 맞춰 늘어난다.
  const mmPerPx = A4_W / el.offsetWidth

  const points = Array.from(
    el.querySelectorAll<HTMLElement>('[data-pdf-keep]')
  ).map((n) => (n.getBoundingClientRect().bottom - top) * mmPerPx)

  return points.sort((a, b) => a - b)
}

/**
 * 주어진 DOM 요소를 A4 PDF로 만들어 Blob 으로 돌려준다.
 * 내용이 한 장을 넘으면 **표 줄을 자르지 않는 위치**에서 페이지를 나눈다.
 */
export async function elementToPdfBlob(el: HTMLElement): Promise<Blob> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ])

  // ⚠️ 자를 위치는 **캡처 전에** 재야 한다.
  //    html2canvas 가 복제본을 만드는 동안 원본이 그대로 있어야 좌표가 맞는다.
  const cuts = cutPointsOf(el)

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
    return pdf.output('blob')
  }

  // 여러 장 — 같은 이미지를 위로 밀어 올리며 잘라 넣는다.
  let top = 0
  while (top < imgH - 0.5) {
    let bottom = top + A4_H

    if (bottom < imgH) {
      // 이 장에 다 들어가는 덩어리 중 **가장 아래 것**에서 끊는다.
      const safe = cuts.filter(
        (c) => c > top + MIN_FILL && c <= bottom - BOTTOM_GAP
      )
      // 쓸 만한 경계가 없으면(표 한 줄이 한 장보다 긴 경우 등)
      // 예전처럼 그냥 잘라야 한다 — 안 자르면 영영 못 끝낸다.
      if (safe.length > 0) bottom = safe[safe.length - 1] + BOTTOM_GAP / 2
    } else {
      bottom = imgH
    }

    pdf.addImage(image, 'JPEG', 0, -top, A4_W, imgH)

    // ⚠️ 이미지는 페이지 끝까지 계속 그려진다. 끊기로 한 지점 **아래를
    //    흰색으로 덮지 않으면** 다음 장에 나올 내용이 여기에도 겹쳐 보인다.
    const used = bottom - top
    if (used < A4_H) {
      pdf.setFillColor(255, 255, 255)
      pdf.rect(0, used, A4_W, A4_H - used + 1, 'F')
    }

    top = bottom
    if (top < imgH - 0.5) pdf.addPage()
  }

  return pdf.output('blob')
}
