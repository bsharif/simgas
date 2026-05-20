import { useSimulationBridge } from '../../context/SimulationBridge'

export function useMonitorSimulation() {
  const { state, scenario, waveformSource } = useSimulationBridge()
  return { state, scenario, waveformSource }
}
