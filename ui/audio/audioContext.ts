// ui/audio/audioContext.ts
// Shared AudioContext singleton with lifecycle management.
// Both useAlarms and useNibpCycle consume this module instead of owning
// their own AudioContext. Lifecycle events (visibility, page unload)
// are handled here so all consumers benefit.

let audioCtx: AudioContext | null = null

function createAudioContext(): AudioContext | null {
  try {
    const AudioCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext
    return AudioCtor ? new AudioCtor() : null
  } catch {
    return null
  }
}

export function getAudioContext(): AudioContext | null {
  return audioCtx
}

export function initAudioContext(): AudioContext | null {
  if (!audioCtx) audioCtx = createAudioContext()
  return audioCtx
}

// Lifecycle — suspend when page is hidden, resume when visible,
// close on unload so the browser doesn't accumulate stale contexts.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!audioCtx) return
    if (document.hidden) {
      audioCtx.suspend()
    } else {
      audioCtx.resume()
    }
  })
  window.addEventListener('beforeunload', () => {
    audioCtx?.close()
    audioCtx = null
  })
}

// Register one-shot gesture listener so AudioContext is created on first
// user interaction (browsers require a user gesture for AudioContext).
if (typeof window !== 'undefined') {
  const gestureHandler = () => { initAudioContext() }
  window.addEventListener('pointerdown', gestureHandler)
  window.addEventListener('keydown', gestureHandler)
}
