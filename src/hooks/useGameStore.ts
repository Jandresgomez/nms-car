import { create } from 'zustand'

interface GameState {
  coins: number
  trackResetCount: number
  addCoin: () => void
  resetTrack: () => void
}

export const useGameStore = create<GameState>((set) => ({
  coins: 0,
  trackResetCount: 0,
  addCoin: () => set((s) => ({ coins: s.coins + 1 })),
  resetTrack: () => set((s) => ({ coins: 0, trackResetCount: s.trackResetCount + 1 })),
}))
