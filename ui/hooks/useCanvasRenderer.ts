import { useEffect, useRef, type RefObject } from 'react'

export function useCanvasRenderer(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  draw: (ctx: CanvasRenderingContext2D, timestamp: number) => void,
  active: boolean
) {
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (!active) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const loop = (timestamp: number) => {
      draw(ctx, timestamp)
      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [active, draw, canvasRef])
}
