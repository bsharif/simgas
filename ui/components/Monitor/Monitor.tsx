// ui/components/Monitor/Monitor.tsx
import { useState, useCallback, type FC } from 'react'
import { useMonitorLayout } from '../../context/MonitorLayoutContext'
import { useAlarmsContext } from '../../context/AlarmsContext'
import { useNibpCycle } from '../../hooks/useNibpCycle'
import { BAND_PAIRINGS } from '../../../engine/monitor/layout'
import type { NumericId } from '../../../engine/monitor/layout'
import MonitorBand from './MonitorBand'
import NumericTile from './NumericTile'
import NibpPanel from './NibpPanel'
import SoftKeyRow from './SoftKeyRow'
import { numericValue, lineIsActive } from './monitorUtils'
import { useMonitorSimulation } from './useMonitorSimulation'

function formatDateTime(date: Date): string {
  return date.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).replace(',', '')
}

const Monitor: FC = () => {
  const { state, scenario, waveformSource } = useMonitorSimulation()
  const { layout } = useMonitorLayout()
  const { byNumeric, isMuted, toggleMute, acknowledgeAlarm } = useAlarmsContext()
  const nibpCycle = useNibpCycle(state.nibp)

  // ART Zero: show a 2-second "Zeroing…" label on the ART band.
  const [artZeroing, setArtZeroing] = useState(false)

  const handleZeroArt = useCallback(() => {
    setArtZeroing(true)
    window.setTimeout(() => setArtZeroing(false), 2_000)
  }, [])

  // Derive bands: enabled traces, each paired with its numeric.
  const pairedNumericIds = new Set<NumericId>(
    layout.traces
      .filter(t => t.enabled)
      .map(t => BAND_PAIRINGS[t.id]),
  )

  const bands = layout.traces
    .filter(t => t.enabled)
    .map(t => ({
      trace: t,
      numeric: layout.numerics.find(n => n.id === BAND_PAIRINGS[t.id]),
    }))
    .filter((b): b is { trace: typeof b.trace; numeric: NonNullable<typeof b.numeric> } =>
      b.numeric !== undefined
    )

  // Tiles: enabled numerics whose id is not claimed by any active band.
  const tiles = layout.numerics.filter(n => n.enabled && !pairedNumericIds.has(n.id))

  const clockNow = new Date()

  return (
    <div className="intellivue-frame" aria-label="IntelliVue style simulation monitor">
      <div className="intellivue-screen">

        <div className="intellivue-status">
          <span className="intellivue-status__patient">
            {scenario?.label ?? 'Not Admitted'}
          </span>
          <span>{formatDateTime(clockNow)}</span>
          <span>Adult</span>
          <span>Dynamic Wave</span>
        </div>

        <div className="intellivue-main">
          {/* Left: waveform bands */}
          <div className="monitor-band-stack">
            {bands.map(({ trace, numeric }) => (
              <MonitorBand
                key={trace.id}
                trace={trace}
                numeric={numeric}
                waveformSource={waveformSource}
                state={state}
                alarmLevel={byNumeric.get(numeric.id)}
                artZeroing={trace.id === 'art' && artZeroing}
              />
            ))}
          </div>

          {/* Right: numeric tiles */}
          <div className="monitor-tile-column">
            {tiles.map(numeric => (
              <NumericTile
                key={numeric.id}
                numeric={numeric}
                value={numericValue(numeric.id, state)}
                alarmLevel={byNumeric.get(numeric.id)}
                lineActive={lineIsActive(numeric.id, state)}
              />
            ))}
          </div>
        </div>

        {layout.nibpEnabled && (
          <NibpPanel
            state={state}
            measuring={nibpCycle.measuring}
            interval={nibpCycle.interval}
            history={nibpCycle.history}
          />
        )}

        <SoftKeyRow
          onAcknowledge={acknowledgeAlarm}
          onPauseAlarms={toggleMute}
          onStartStopNbp={nibpCycle.measuring ? nibpCycle.cancelCycle : nibpCycle.triggerCycle}
          onRepeatTime={nibpCycle.cycleInterval}
          onZeroArt={handleZeroArt}
          artLineActive={state.art !== null}
          alarmsMuted={isMuted}
          nibpMeasuring={nibpCycle.measuring}
        />
      </div>
    </div>
  )
}

export default Monitor
