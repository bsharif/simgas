import { useState, type FC } from 'react'
import { useRemoteSimulation } from '../../context/RemoteSimulationContext'

/**
 * Trainer notes during the case (review Phase 3): free-text notes and
 * one-tap teaching-moment markers. Both land on the trainer's action
 * timeline and the debrief; trainees never see them during the case.
 */
const NotesPanel: FC = () => {
  const { send, commandsAvailable } = useRemoteSimulation()
  const [text, setText] = useState('')

  const submit = (teaching: boolean) => {
    const trimmed = text.trim()
    if (!trimmed) return
    if (send({ type: 'add_note', text: trimmed, teaching })) setText('')
  }

  return (
    <section className="trainer-card">
      <h2>Notes</h2>
      <textarea
        value={text}
        onChange={event => setText(event.currentTarget.value)}
        placeholder="Private note for the debrief..."
        rows={2}
        maxLength={500}
        style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
      />
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        <button disabled={!commandsAvailable || !text.trim()} onClick={() => submit(false)}>
          Add note
        </button>
        <button disabled={!commandsAvailable || !text.trim()} onClick={() => submit(true)}>
          ★ Teaching moment
        </button>
        <button
          disabled={!commandsAvailable}
          onClick={() => { send({ type: 'add_note', text: 'Teaching moment', teaching: true }) }}
          title="Mark this moment without typing"
        >
          ★ Mark now
        </button>
      </div>
    </section>
  )
}

export default NotesPanel
