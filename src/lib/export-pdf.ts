// Export PDF: lay the page out with its print rules, snapshot it, and download the snapshot as A4 pages.

/** A4 landscape content box: 297 x 210 mm minus 10 mm margins, and its width in CSS pixels. */
const PAGE_MM = { w: 277, h: 190 }
const PAGE_PX = 1047
/** Browsers refuse canvases much taller than about 32k pixels. */
const MAX_CANVAS = 30000

/** Where to cut a tall snapshot into pages: just above a blank row near each page end, if one is close. */
export function pageCuts(height: number, pageH: number, isBlank: (y: number) => boolean): number[] {
  const cuts = [0]
  const step = Math.floor(pageH)
  while (height - cuts[cuts.length - 1] > step) {
    const target = cuts[cuts.length - 1] + step
    const lowest = target - Math.floor(step / 4)
    let y = target
    while (y > lowest && !isBlank(y)) y--
    cuts.push(isBlank(y) ? y : target)
  }
  cuts.push(height)
  return cuts
}

/** The inside of every @media print block, so the screen can use them while the snapshot is taken. */
function printRules(): string {
  let css = ''
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList
    try {
      rules = sheet.cssRules
    } catch {
      continue
    }
    for (const rule of Array.from(rules)) {
      if (!(rule instanceof CSSMediaRule) || !/\bprint\b/.test(rule.conditionText)) continue
      for (const inner of Array.from(rule.cssRules)) if (!(inner instanceof CSSPageRule)) css += `${inner.cssText}\n`
    }
  }
  return css
}

/** SVG paint the snapshot library drops unless it is written on the element itself. */
const SVG_PAINT = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-linecap', 'stroke-linejoin', 'opacity',
  'fill-opacity', 'stroke-opacity', 'paint-order', 'font-family', 'font-size', 'font-weight', 'text-anchor', 'dominant-baseline', 'visibility', 'display']

/** Write each SVG shape's computed paint inline; returns a function that puts the old styles back. */
function inlineSvgPaint(root: HTMLElement): () => void {
  const els = Array.from(root.querySelectorAll<SVGElement>('svg *'))
  const saved = els.map((e) => e.getAttribute('style'))
  const paint = els.map((e) => {
    const cs = getComputedStyle(e)
    return SVG_PAINT.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(';')
  })
  els.forEach((e, i) => e.setAttribute('style', `${saved[i] ?? ''};${paint[i]}`))
  return () => els.forEach((e, i) => (saved[i] === null ? e.removeAttribute('style') : e.setAttribute('style', saved[i]!)))
}

/** "Pipeline | CS2100 Tracer" -> "Pipeline - CS2100 Tracer.pdf" */
export function pdfName(title: string): string {
  return `${title.replace(/\s*\|\s*/g, ' - ').replace(/[\\/:*?"<>]/g, '').trim() || 'CS2100 Tracer'}.pdf`
}

export async function downloadPdf(): Promise<void> {
  const root = document.querySelector<HTMLElement>('.app')
  if (!root) throw new Error('No page to export')
  // A cover hides the page while it briefly switches to the print layout.
  const cover = document.createElement('div')
  cover.className = 'pdf-cover'
  cover.textContent = 'Making the PDF'
  const style = document.createElement('style')
  // Transitions off, or colours are caught halfway through the switch to the light theme.
  style.textContent = `${printRules()}\n.app { width: ${PAGE_PX}px !important; }\n*, *::before, *::after { transition: none !important; }`
  document.body.append(cover)
  let canvas: HTMLCanvasElement
  let restorePaint = () => {}
  try {
    // The app's own print hooks switch to the light theme and open folded notes.
    window.dispatchEvent(new Event('beforeprint'))
    document.head.append(style)
    const [{ toCanvas }] = await Promise.all([import('html-to-image'), document.fonts.ready])
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    restorePaint = inlineSvgPaint(root)
    const height = root.scrollHeight
    const scale = Math.min(2, MAX_CANVAS / height)
    if (scale < 1) throw new Error('Page too long to snapshot')
    canvas = await toCanvas(root, {
      pixelRatio: scale,
      width: PAGE_PX,
      height,
      backgroundColor: getComputedStyle(document.body).backgroundColor,
    })
  } finally {
    restorePaint()
    style.remove()
    window.dispatchEvent(new Event('afterprint'))
    cover.remove()
  }

  const { jsPDF } = await import('jspdf')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  const bg = ctx.getImageData(0, 0, 1, 1).data
  // A row is blank when almost every pixel is background (panel side borders are allowed).
  const blankRows = new Map<number, boolean>()
  const blankRow = (y: number) => {
    if (blankRows.has(y)) return blankRows.get(y)!
    const row = ctx.getImageData(0, y, canvas.width, 1).data
    let ink = 0
    for (let i = 0; i < row.length; i += 8) if (Math.abs(row[i] - bg[0]) + Math.abs(row[i + 1] - bg[1]) + Math.abs(row[i + 2] - bg[2]) > 24) ink++
    const blank = ink * 2 * 100 < canvas.width
    blankRows.set(y, blank)
    return blank
  }
  // Cut only in the middle of a gap a few pixels tall, so no line of text is split.
  const isBlank = (y: number) => {
    for (let d = -4; d <= 4; d++) if (!blankRow(Math.min(canvas.height - 1, Math.max(0, y + d)))) return false
    return true
  }
  const pxPerMm = canvas.width / PAGE_MM.w
  const cuts = pageCuts(canvas.height, PAGE_MM.h * pxPerMm, isBlank)
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const slice = document.createElement('canvas')
  slice.width = canvas.width
  for (let i = 0; i + 1 < cuts.length; i++) {
    const h = cuts[i + 1] - cuts[i]
    slice.height = h
    const sctx = slice.getContext('2d')!
    sctx.drawImage(canvas, 0, cuts[i], canvas.width, h, 0, 0, canvas.width, h)
    if (i) pdf.addPage()
    pdf.addImage(slice, 'PNG', 10, 10, PAGE_MM.w, h / pxPerMm, undefined, 'FAST')
  }
  pdf.save(pdfName(document.title))
}
