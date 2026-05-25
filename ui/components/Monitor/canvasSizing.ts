export interface CanvasSize {
  width: number
  height: number
  dpr: number
}

export function ensureCanvasSize(
  ctx: CanvasRenderingContext2D,
  dpr = window.devicePixelRatio || 1,
): CanvasSize {
  const width = Math.round(ctx.canvas.clientWidth)
  const height = Math.round(ctx.canvas.clientHeight)
  const backingWidth = Math.round(width * dpr)
  const backingHeight = Math.round(height * dpr)

  if (ctx.canvas.width !== backingWidth) ctx.canvas.width = backingWidth
  if (ctx.canvas.height !== backingHeight) ctx.canvas.height = backingHeight

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  return { width, height, dpr }
}
