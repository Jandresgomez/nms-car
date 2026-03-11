import { create } from 'zustand'

interface GameState {
  coins: number
  trackResetCount: number
  vehicleId: string
  debug: boolean
  cameraLocked: boolean
  addCoin: () => void
  resetTrack: () => void
  setVehicleId: (v: string) => void
  toggleDebug: () => void
  toggleCameraLock: () => void
}

export const useGameStore = create<GameState>((set) => ({
  coins: 0,
  trackResetCount: 0,
  vehicleId: 'car',
  debug: false,
  cameraLocked: false,
  addCoin: () => set((s) => ({ coins: s.coins + 1 })),
  resetTrack: () => set((s) => ({ coins: 0, trackResetCount: s.trackResetCount + 1 })),
  setVehicleId: (vehicleId) => set({ vehicleId }),
  toggleDebug: () => set((s) => ({ debug: !s.debug })),
  toggleCameraLock: () => set((s) => ({ cameraLocked: !s.cameraLocked })),
}))
