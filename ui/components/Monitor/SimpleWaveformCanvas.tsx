import { useRef, useCallback, type FC } from 'react'
import { useCanvasRenderer } from '../../hooks/useCanvasRenderer'
import type { WaveformBufferKey } from '../../../engine/patient'
import { ensureCanvasSize } from './canvasSizing'
import type { WaveformSource } from './waveformSource'

interface SimpleWaveformProps {
  waveformSource: WaveformSource
  bufferKey: WaveformBufferKey
  color: string
  label?: string
  value?: string
}

const SimpleWaveformCanvas: FC<SimpleWaveformProps> = ({ waveformSource, bufferKey, color, label, value }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    const { width: w, height: h } = ensureCanvasSize(ctx)

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

    const buffer = waveformSource.state[bufferKey]
    const bufferWritePos = waveformSource.state.bufferWritePos

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
  }, [waveformSource, bufferKey, color, label, value])

  useCanvasRenderer(canvasRef, draw, true)

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block', background: 'transparent' }}
    />
  )
}

export default SimpleWaveformCanvas
