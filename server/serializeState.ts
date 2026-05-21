import type { SimulationEngine } from '../engine/physiology'
import type { RemotePatientSnapshot } from '../shared/protocol'

export function serializeState(engine: SimulationEngine): RemotePatientSnapshot {
  const { state } = engine
  const runtimeInfo = engine.scenario?.getRuntimeInfo?.()

  return {
    hr: state.hr,
    spo2: state.spo2,
    nibp: { ...state.nibp },
    art: state.art ? { ...state.art } : null,
    cvp: state.cvp,
    bis: state.bis,
    etco2: state.etco2,
    rr: state.rr,
    temp: state.temp,
    fio2: state.fio2,
    vt: state.vt,
    peep: state.peep,
    gasFlow: state.gasFlow,
    sevoflurane: state.sevoflurane,
    ventilationMode: state.ventilationMode,
    manualVentilationActive: state.manualVentilationActive,
    consciousness: state.consciousness,
    ecgRhythm: state.ecgRhythm,
    capnographyShape: state.capnographyShape,
    tubePosition: state.tubePosition,
    phase: engine.phase,
    elapsedSeconds: engine.elapsedSeconds,
    paused: engine.paused,
    currentPhaseId: runtimeInfo?.currentPhaseId ?? null,
    completedPhaseIds: runtimeInfo?.completedPhaseIds ?? [],
    forcedPhaseId: runtimeInfo?.forcedPhaseId ?? null,
  }
}
