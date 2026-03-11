import { create } from 'zustand'

export type VehicleType = 'car' | 'ball'

interface GameState {
  coins: number
  trackResetCount: number
  vehicleType: VehicleType
  debug: boolean
  addCoin: () => void
  resetTrack: () => void
  setVehicleType: (v: VehicleType) => void
  toggleDebug: () => void
}

export const useGameStore = create<GameState>((set) => ({
  coins: 0,
  trackResetCount: 0,
  vehicleType: 'car',
  debug: false,
  addCoin: () => set((s) => ({ coins: s.coins + 1 })),
  resetTrack: () => set((s) => ({ coins: 0, trackResetCount: s.trackResetCount + 1 })),
  setVehicleType: (vehicleType) => set({ vehicleType }),
  toggleDebug: () => set((s) => ({ debug: !s.debug })),
}))
