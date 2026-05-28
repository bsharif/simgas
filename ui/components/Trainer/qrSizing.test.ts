import { describe, expect, it } from 'vitest'
import { getQrCodeSize } from './qrSizing'

describe('getQrCodeSize', () => {
  it('clamps to minimum on narrow containers', () => {
    expect(getQrCodeSize(120, 180)).toBe(96)
  })

  it('caps at maximum on wide and tall containers', () => {
    expect(getQrCodeSize(430, 260)).toBe(180)
  })

  it('stays inside the available height', () => {
    expect(getQrCodeSize(430, 140)).toBe(116)
  })

  it('stays inside the available width', () => {
    expect(getQrCodeSize(180, 260)).toBe(156)
  })
})
