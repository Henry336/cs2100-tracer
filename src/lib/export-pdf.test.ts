import { describe, expect, it } from 'vitest'
import { pageCuts, pdfName } from './export-pdf'

describe('Export PDF', () => {
  it('one page when it fits', () => {
    expect(pageCuts(90, 100, () => false)).toEqual([0, 90])
  })
  it('cuts at the page end when no blank row is near', () => {
    expect(pageCuts(250, 100, () => false)).toEqual([0, 100, 200, 250])
  })
  it('moves a cut up to a blank row close to the page end', () => {
    expect(pageCuts(250, 100, (y) => y === 90 || y === 185)).toEqual([0, 90, 185, 250])
  })
  it('ignores a blank row too far above the page end', () => {
    expect(pageCuts(150, 100, (y) => y === 40)).toEqual([0, 100, 150])
  })
  it('names the file after the page', () => {
    expect(pdfName('Pipeline | CS2100 Tracer')).toBe('Pipeline - CS2100 Tracer.pdf')
    expect(pdfName('')).toBe('CS2100 Tracer.pdf')
  })
})
