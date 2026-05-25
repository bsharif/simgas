import { useState, type FC } from 'react'
import { useRemoteSimulation } from '../../context/RemoteSimulationContext'
import { sendInjectedEvent } from './eventInjectorCommand'

const EventInjector: FC = () => {
  const { send, commandsAvailable } = useRemoteSimulation()
  const [text, setText] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const clean = text.slice(0, 300)

  return (
    <section className="trainer-card">
      <h2>Inject event</h2>
      <textarea value={text} maxLength={300} onChange={event => setText(event.currentTarget.value)} placeholder="Event visible to trainees" />
      <div className="trainer-actions">
        <button onClick={() => setPreview(clean)}>Preview</button>
        <button disabled={!commandsAvailable || !clean.trim()} onClick={() => {
          if (!sendInjectedEvent(send, clean)) return
          setText('')
          setPreview(null)
        }}>Broadcast</button>
      </div>
      {!commandsAvailable && <p className="command-unavailable">Trainer commands unavailable while reconnecting.</p>}
      {preview && <p className="event-preview">Preview: {preview}</p>}
    </section>
  )
}

export default EventInjector
