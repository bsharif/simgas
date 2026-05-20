import { useState, type FC } from 'react'
import { useRemoteSimulation } from '../../context/RemoteSimulationContext'

const EventInjector: FC = () => {
  const { send } = useRemoteSimulation()
  const [text, setText] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const clean = text.slice(0, 300)

  return (
    <section className="trainer-card">
      <h2>Inject event</h2>
      <textarea value={text} maxLength={300} onChange={event => setText(event.currentTarget.value)} placeholder="Event visible to trainees" />
      <div className="trainer-actions">
        <button onClick={() => setPreview(clean)}>Preview</button>
        <button disabled={!clean.trim()} onClick={() => { send({ type: 'inject_event', text: clean.trim() }); setText(''); setPreview(null) }}>Broadcast</button>
      </div>
      {preview && <p className="event-preview">Preview: {preview}</p>}
    </section>
  )
}

export default EventInjector
