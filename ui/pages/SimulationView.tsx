import type { FC } from 'react'
import { useSimulation } from '../context/SimulationContext'
import Monitor from '../components/Monitor/Monitor'
import { MonitorSettingsButton } from '../components/Monitor/MonitorSettings'
import RightPanel from '../components/RightPanel/RightPanel'
import HintsPanel from '../components/Sidebar/HintsPanel'
import ScenarioSelector from '../components/Scenario/ScenarioSelector'
import ModeToggle from '../components/Scenario/ModeToggle'

const SimulationView: FC = () => {
  const { paused, togglePause, phase, startScenario, scenario } = useSimulation()
  const ended = phase === 'resolved' || phase === 'failed'
  const failed = phase === 'failed'

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: '#1f2428',
    }}>
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '6px 16px',
        background: '#f3f1ea',
        borderBottom: '1px solid #c7c3b8',
        minHeight: 40,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{
            fontSize: 16,
            fontWeight: 700,
            color: '#1a5276',
            letterSpacing: 2,
            textTransform: 'uppercase',
          }}>
            SimGas
          </span>
          <ScenarioSelector />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ModeToggle />
          <MonitorSettingsButton />
          <button
            onClick={togglePause}
            title={paused ? 'Resume' : 'Pause'}
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: `2px solid ${paused ? '#cc8800' : '#ccc'}`,
              background: paused ? 'rgba(204,136,0,0.08)' : 'transparent',
              color: paused ? '#cc8800' : '#888',
              fontSize: 14,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s',
            }}
          >
            {paused ? '▶' : '⏸'}
          </button>
        </div>
      </header>

      <HintsPanel />

      <div style={{
        flex: 1,
        display: 'flex',
        overflow: 'hidden',
      }}>
        <div style={{
          width: '62%',
          display: 'flex',
          flexDirection: 'column',
          padding: 10,
        }}>
          <Monitor />
        </div>
        <RightPanel />
      </div>

      {ended && scenario && (
        <div
          role="status"
          style={{
            position: 'fixed',
            right: 16,
            bottom: 16,
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 14px',
            background: '#ffffff',
            border: `2px solid ${failed ? '#cc0000' : '#1a6e4c'}`,
            borderRadius: 10,
            boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
            maxWidth: 360,
          }}
        >
          <span style={{ fontSize: 22 }}>{failed ? '❌' : '✓'}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#2c2c2c', fontSize: 14, fontWeight: 600 }}>
              {failed ? 'Scenario Failed' : 'Scenario Complete'}
            </div>
            <div style={{ color: '#888', fontSize: 12, lineHeight: 1.3 }}>
              {failed
                ? 'Critical interventions were missed or incorrect.'
                : 'Patient stabilised successfully.'}
            </div>
          </div>
          <button
            onClick={() => startScenario(scenario.id)}
            style={{
              padding: '7px 14px',
              background: '#f5f5f0',
              border: '1px solid #e0ddd5',
              borderRadius: 6,
              color: '#2c2c2c',
              fontSize: 13,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Restart
          </button>
        </div>
      )}
    </div>
  )
}

export default SimulationView
