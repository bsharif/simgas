import { useRef, useCallback, type FC } from 'react'
import { useCanvasRenderer } from '../../hooks/useCanvasRenderer'
import type { SimulationEngine } from '../../../engine/physiology'
import type { WaveformBufferKey } from './ECGCanvas'

interface SimpleWaveformProps {
  engine: SimulationEngine
  bufferKey: WaveformBufferKey
  color: string
  label?: string
  value?: string
}

const SimpleWaveformCanvas: FC<SimpleWaveformProps> = ({ engine, bufferKey, color, label, value }) => {
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

    ctx.strokeStyle = color === '#ffd94a'
      ? 'rgba(255, 217, 74, 0.12)'
      : 'rgba(25, 200, 255, 0.24)'
    ctx.lineWidth = 0.5
    ctx.setLineDash([3, 6])
    for (let y = 0; y < h; y += h / 3) {
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

    const buffer = engine.state[bufferKey]
    const bufferWritePos = engine.state.bufferWritePos

    const visibleSamples = Math.min(buffer.length, Math.floor(w * 2))
    const midY = h / 2
    const amp = h * 0.38

    for (let i = 0; i < visibleSamples; i++) {
      const bufIdx = ((bufferWritePos - visibleSamples + i) % buffer.length + buffer.length) % buffer.length
      const x = (i / visibleSamples) * w
      const y = midY - buffer[bufIdx] * amp

      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }

    ctx.stroke()
    ctx.shadowBlur = 0

    if (label) {
      ctx.fillStyle = color
      ctx.font = '11px monospace'
      ctx.fillText(label, 6, 12)
    }
    if (value !== undefined) {
      ctx.fillStyle = color
      ctx.font = 'bold 20px monospace'
      ctx.fillText(value, 6, 34)
    }
  }, [engine, bufferKey, color, label, value])

  useCanvasRenderer(canvasRef, draw, true)

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block', background: 'transparent' }}
    />
  )
}

export default SimpleWaveformCanvas
