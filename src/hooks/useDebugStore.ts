import { create } from 'zustand'

interface DebugState {
  speed: number
  forward: boolean
  braking: boolean
  left: boolean
  right: boolean
  drift: boolean
  grounded: boolean
  fl: boolean
  fr: boolean
  rl: boolean
  rr: boolean
  steerAngle: number
  set: (data: Partial<Omit<DebugState, 'set'>>) => void
}

export const useDebugStore = create<DebugState>((set) => ({
  speed: 0,
  forward: false,
  braking: false,
  left: false,
  right: false,
  drift: false,
  grounded: false,
  fl: false,
  fr: false,
  rl: false,
  rr: false,
  steerAngle: 0,
  set: (data) => set(data),
}))
