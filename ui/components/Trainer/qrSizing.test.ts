import { describe, expect, it } from 'vitest'
import { getQrCodeSize } from './qrSizing'

describe('getQrCodeSize', () => {
  it('clamps to minimum on narrow containers', () => {
    expect(getQrCodeSize(150)).toBe(160)
  })

  it('caps at maximum on wide containers', () => {
    expect(getQrCodeSize(430)).toBe(280)
  })

  it('scales at 85% of container width in the mid range', () => {
    expect(getQrCodeSize(300)).toBe(255)
  })
})
