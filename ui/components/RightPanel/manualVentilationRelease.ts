export interface ManualVentilationReleaseState {
  pressActive: boolean
  releasePending: boolean
}

export type ManualVentilationCommand = boolean | null

export const initialManualVentilationReleaseState: ManualVentilationReleaseState = {
  pressActive: false,
  releasePending: false,
}

export function manualVentilationPointerDown(
  state: ManualVentilationReleaseState,
  commandsAvailable: boolean,
): { state: ManualVentilationReleaseState; command: ManualVentilationCommand } {
  if (!commandsAvailable) return { state, command: null }
  return { state: { pressActive: true, releasePending: false }, command: true }
}

export function manualVentilationPointerRelease(
  state: ManualVentilationReleaseState,
  commandsAvailable: boolean,
): { state: ManualVentilationReleaseState; command: ManualVentilationCommand } {
  if (!state.pressActive) return { state, command: null }
  if (!commandsAvailable) return { state: { pressActive: false, releasePending: true }, command: null }
  return { state: { pressActive: false, releasePending: false }, command: false }
}

export function manualVentilationCommandsAvailable(
  state: ManualVentilationReleaseState,
): { state: ManualVentilationReleaseState; command: ManualVentilationCommand } {
  if (!state.releasePending) return { state, command: null }
  return { state: { pressActive: false, releasePending: false }, command: false }
}

export function manualVentilationCommandsUnavailable(
  state: ManualVentilationReleaseState,
): { state: ManualVentilationReleaseState; command: ManualVentilationCommand } {
  if (!state.pressActive) return { state, command: null }
  return { state: { pressActive: false, releasePending: true }, command: null }
}
