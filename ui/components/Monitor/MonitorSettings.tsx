import { useState, type FC } from 'react'
import { useMonitorLayout } from '../../context/MonitorLayoutContext'
import { PRESETS } from '../../../engine/monitor/layout'

/**
 * Monitor settings panel (Phase 3.3). Lets the user toggle individual traces
 * and numerics on/off, switch between presets, or reset to default. Selections
 * persist via localStorage in MonitorLayoutContext.
 *
 * Triggered by the gear button in SimulationView's header.
 */
const MonitorSettings: FC<{ onClose: () => void }> = ({ onClose }) => {
  const { layout, updateTrace, updateNumeric, applyPreset, resetToDefault, setNibpEnabled } = useMonitorLayout()

  return (
    <div
      role="dialog"
      aria-label="Monitor settings"
      style={{
        position: 'fixed',
        top: 48,
        right: 16,
        zIndex: 250,
        width: 360,
        maxHeight: 'calc(100vh - 80px)',
        overflowY: 'auto',
        background: '#ffffff',
        border: '1px solid #d8d4ca',
        borderRadius: 10,
        boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
        padding: 16,
        fontSize: 13,
        color: '#2c2c2c',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <strong style={{ fontSize: 14 }}>Monitor display</strong>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#888', fontSize: 18, padding: '0 4px',
          }}
          aria-label="Close settings"
        >×</button>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
          Presets
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(Object.keys(PRESETS) as Array<keyof typeof PRESETS>).map(name => (
            <button
              key={name}
              onClick={() => applyPreset(name)}
              style={{
                padding: '6px 12px',
                border: '1px solid #d8d4ca',
                borderRadius: 4,
                background: '#fafafa',
                cursor: 'pointer',
                fontSize: 12,
                textTransform: 'capitalize',
              }}
            >
              {name}
            </button>
          ))}
          <button
            onClick={resetToDefault}
            style={{
              padding: '6px 12px',
              border: '1px solid #d8d4ca',
              borderRadius: 4,
              background: 'transparent',
              cursor: 'pointer',
              fontSize: 12,
              color: '#888',
            }}
          >
            Reset
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
          Waveforms
        </div>
        {layout.traces.map(trace => (
          <label
            key={trace.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '5px 0', cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={trace.enabled}
              onChange={e => updateTrace(trace.id, { enabled: e.currentTarget.checked })}
            />
            <span style={{
              width: 10, height: 10, borderRadius: '50%',
              background: trace.color, display: 'inline-block',
            }} />
            <span style={{ flex: 1 }}>{trace.label}</span>
            <span style={{ fontSize: 10, color: '#aaa' }}>
              {trace.rendererStyle === 'ecg' ? 'ECG-style' : 'simple'}
            </span>
          </label>
        ))}
      </div>

      <div>
        <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
          Numerics
        </div>
        {layout.numerics.map(numeric => (
          <label
            key={numeric.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '5px 0', cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={numeric.enabled}
              onChange={e => updateNumeric(numeric.id, { enabled: e.currentTarget.checked })}
            />
            <span style={{ flex: 1 }}>{numeric.label}</span>
            {numeric.alarmLo !== null && numeric.alarmHi !== null && (
              <span style={{ fontSize: 10, color: '#aaa' }}>
                {numeric.alarmLo}–{numeric.alarmHi}
              </span>
            )}
            <button
              onClick={e => {
                e.preventDefault()
                updateNumeric(numeric.id, { muted: !numeric.muted })
              }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 14, padding: 0, color: numeric.muted ? '#cc6600' : '#ccc',
              }}
              aria-label={numeric.muted ? 'Unmute alarm' : 'Mute alarm'}
              title={numeric.muted ? 'Alarm muted' : 'Alarm armed'}
            >
              {numeric.muted ? '🔕' : '🔔'}
            </button>
          </label>
        ))}
      </div>

      <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #eeebe4' }}>
        <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
          Panels
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={layout.nibpEnabled}
            onChange={e => setNibpEnabled(e.currentTarget.checked)}
          />
          <span style={{ flex: 1 }}>NIBP panel</span>
        </label>
      </div>
    </div>
  )
}

export const MonitorSettingsButton: FC = () => {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        title="Monitor display settings"
        aria-label="Open monitor settings"
        style={{
          width: 32, height: 32, borderRadius: '50%',
          border: '1px solid #c7c3b8',
          background: open ? '#fff' : 'transparent',
          color: '#1a5276',
          cursor: 'pointer',
          fontSize: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        ⚙
      </button>
      {open && <MonitorSettings onClose={() => setOpen(false)} />}
    </>
  )
}

export default MonitorSettings
