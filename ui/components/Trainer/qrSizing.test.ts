import { describe, expect, it } from 'vitest'
import { getQrCodeSize } from './qrSizing'

describe('getQrCodeSize', () => {
  it('keeps QR canvas inside a narrow trainer control column', () => {
    expect(getQrCodeSize(150)).toBe(118)
  })

  it('caps QR canvas size on wide trainer control columns', () => {
    expect(getQrCodeSize(430)).toBe(156)
  })
})
