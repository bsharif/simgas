import { useRef, useEffect, type FC } from 'react'
import { useSimulation } from '../../context/SimulationContext'

const EventLog: FC = () => {
  const { eventLog } = useSimulation()
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [eventLog])

  const formatEvent = (event: string): { text: string; color: string } => {
    if (event.startsWith('⚠')) return { text: event, color: '#ff8800' }
    if (event.startsWith('✓') || event.startsWith('→')) return { text: event, color: '#00cc66' }
    if (event.startsWith('✗') || event.startsWith('❌')) return { text: event, color: '#ff0033' }
    if (event.startsWith('▶')) return { text: event, color: '#888' }
    return { text: event, color: '#aaa' }
  }

  return (
    <div style={{
      width: 260,
      background: '#0d0d14',
      borderLeft: '1px solid #1a1a2a',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid #1a1a2a',
        color: '#666',
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: 1,
      }}>
        Event Log
      </div>

      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '4px 0',
        }}
      >
        {eventLog.length === 0 && (
          <div style={{ padding: '12px', color: '#444', fontSize: 11, fontStyle: 'italic' }}>
            No events yet. Start a scenario to begin.
          </div>
        )}

        {eventLog.map((event, i) => {
          const { text, color } = formatEvent(event)
          return (
            <div
              key={i}
              style={{
                padding: '3px 12px',
                fontSize: 11,
                color,
                fontFamily: '"Courier New", monospace',
                lineHeight: 1.4,
                borderBottom: '1px solid #111118',
              }}
            >
              {text}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default EventLog
