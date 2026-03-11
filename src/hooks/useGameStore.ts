import { create } from 'zustand'

export type VehicleType = 'car' | 'ball' | 'base'

interface GameState {
  coins: number
  trackResetCount: number
  vehicleType: VehicleType
  debug: boolean
  cameraLocked: boolean
  addCoin: () => void
  resetTrack: () => void
  setVehicleType: (v: VehicleType) => void
  toggleDebug: () => void
  toggleCameraLock: () => void
}

export const useGameStore = create<GameState>((set) => ({
  coins: 0,
  trackResetCount: 0,
  vehicleType: 'car',
  debug: false,
  cameraLocked: false,
  addCoin: () => set((s) => ({ coins: s.coins + 1 })),
  resetTrack: () => set((s) => ({ coins: 0, trackResetCount: s.trackResetCount + 1 })),
  setVehicleType: (vehicleType) => set({ vehicleType }),
  toggleDebug: () => set((s) => ({ debug: !s.debug })),
  toggleCameraLock: () => set((s) => ({ cameraLocked: !s.cameraLocked })),
}))
