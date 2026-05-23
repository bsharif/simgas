import { describe, expect, it, vi } from 'vitest'
import { ensureCanvasSize } from './canvasSizing'

function createContext(clientWidth: number, clientHeight: number, width = 0, height = 0): CanvasRenderingContext2D {
  return {
    canvas: {
      clientWidth,
      clientHeight,
      width,
      height,
    },
    setTransform: vi.fn(),
  } as unknown as CanvasRenderingContext2D
}

describe('ensureCanvasSize', () => {
  it('sizes the backing canvas to rounded CSS dimensions multiplied by DPR', () => {
    const ctx = createContext(101.4, 50.6)

    const size = ensureCanvasSize(ctx, 2)

    expect(ctx.canvas.width).toBe(202)
    expect(ctx.canvas.height).toBe(102)
    expect(size).toEqual({ width: 101, height: 51, dpr: 2 })
  })

  it('resets the transform to CSS pixel coordinates even when size is unchanged', () => {
    const ctx = createContext(80, 40, 160, 80)

    const size = ensureCanvasSize(ctx, 2)

    expect(ctx.setTransform).toHaveBeenCalledOnce()
    expect(ctx.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0)
    expect(size).toEqual({ width: 80, height: 40, dpr: 2 })
  })
})
