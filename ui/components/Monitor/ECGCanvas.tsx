import { useRef, useCallback, type FC } from 'react'
import { useCanvasRenderer } from '../../hooks/useCanvasRenderer'
import type { SimulationEngine } from '../../../engine/physiology'
import type { WaveformBufferKey } from '../../../engine/patient'

interface WaveformCanvasProps {
  engine: SimulationEngine
  bufferKey: WaveformBufferKey
  color: string
  label?: string
  value?: string
  scale?: number
}

const ECGCanvas: FC<WaveformCanvasProps> = ({ engine, bufferKey, color, label, value, scale = 1 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    if (canvasRef.current) {
      const dpr = window.devicePixelRatio || 1
      const w = canvasRef.current.clientWidth
      const h = canvasRef.current.clientHeight
      if (ctx.canvas.width !== w * dpr || ctx.canvas.height !== h * dpr) {
        ctx.canvas.width = w * dpr
        ctx.canvas.height = h * dpr
        ctx.scale(dpr, dpr)
      }
    }

    const w = ctx.canvas.width / (window.devicePixelRatio || 1)
    const h = ctx.canvas.height / (window.devicePixelRatio || 1)

    ctx.clearRect(0, 0, w, h)

    ctx.strokeStyle = 'rgba(120, 225, 130, 0.14)'
    ctx.lineWidth = 0.5
    ctx.setLineDash([3, 6])
    for (let x = 0; x < w; x += w / 5) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, h)
      ctx.stroke()
    }
    for (let y = 0; y < h; y += h / 4) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
    }
    ctx.setLineDash([])

    ctx.strokeStyle = color
    ctx.shadowColor = color
    ctx.shadowBlur = 5
    ctx.lineWidth = 2
    ctx.beginPath()

    // Read live engine state at draw time — bypasses the throttled React state.
    const buffer = engine.state[bufferKey]
    const bufferWritePos = engine.state.bufferWritePos

    const visibleSamples = Math.min(buffer.length, Math.floor(w * 2 * scale))

    const midY = h / 2
    const amp = h * 0.4

    for (let i = 0; i < visibleSamples; i++) {
      const bufIdx = ((bufferWritePos - visibleSamples + i) % buffer.length + buffer.length) % buffer.length
      const x = (i / visibleSamples) * w
      const rawVal = buffer[bufIdx]
      const y = midY - rawVal * amp

      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }

    ctx.stroke()
    ctx.shadowBlur = 0

    if (label) {
      ctx.fillStyle = color
      ctx.font = '11px monospace'
      ctx.fillText(label, 8, 14)
    }
    if (value !== undefined) {
      ctx.fillStyle = color
      ctx.font = 'bold 22px monospace'
      ctx.fillText(value, 8, 38)
    }
  }, [engine, bufferKey, color, label, value, scale])

  useCanvasRenderer(canvasRef, draw, true)

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block', background: 'transparent' }}
    />
  )
}

export default ECGCanvas
