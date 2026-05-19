import { useEffect, useRef, type RefObject } from 'react'

type DrawFn = (ctx: CanvasRenderingContext2D, timestamp: number) => void

/**
 * Runs a single persistent requestAnimationFrame loop for as long as `active`
 * is true. The `draw` callback may change every render (closures over fresh
 * props are normal), but the rAF subscription itself is created once and never
 * torn down per-frame — the latest `draw` is read from a ref each tick.
 *
 * Previous implementation listed `draw` in its effect deps, which caused the
 * effect to tear down and recreate the rAF on every parent render (and every
 * engine tick that bumped `bufferWritePos`).
 */
export function useCanvasRenderer(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  draw: DrawFn,
  active: boolean
) {
  const drawRef = useRef<DrawFn>(draw)
  drawRef.current = draw

  useEffect(() => {
    if (!active) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let rafId = requestAnimationFrame(function loop(timestamp) {
      drawRef.current(ctx, timestamp)
      rafId = requestAnimationFrame(loop)
    })

    return () => cancelAnimationFrame(rafId)
  }, [active, canvasRef])
}
