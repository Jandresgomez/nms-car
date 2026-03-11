import { create } from 'zustand'

interface DebugData {
  speed: number
  forward: boolean
  braking: boolean
  left: boolean
  right: boolean
  drift: boolean
  grounded: boolean
  // Rotation (Euler degrees)
  rotX: number; rotY: number; rotZ: number
  // Velocity vector (direction + magnitude)
  velX: number; velY: number; velZ: number; velMag: number
  // FPS
  fps: number
  // Car-specific
  fl: boolean; fr: boolean; rl: boolean; rr: boolean
  steerAngle: number
  flC?: string; frC?: string; rlC?: string; rrC?: string
  // Per-wheel impulses from vehicle controller
  sideImp?: string; fwdImp?: string; suspF?: string
  // Ball-specific
  angVel?: number
  boosting?: boolean
}

interface DebugState extends DebugData {
  set: (data: Partial<DebugData>) => void
  recording: boolean
  log: string[]
  toggleRecording: () => void
  downloadLog: () => void
}

let _pending: Partial<DebugData> | null = null
let _rafId = 0

export const useDebugStore = create<DebugState>((set, get) => ({
  speed: 0,
  forward: false, braking: false, left: false, right: false, drift: false,
  grounded: false,
  rotX: 0, rotY: 0, rotZ: 0,
  velX: 0, velY: 0, velZ: 0, velMag: 0,
  fps: 0,
  fl: false, fr: false, rl: false, rr: false,
  steerAngle: 0,
  recording: false,
  log: [],
  set: (data) => {
    _pending = _pending ? { ..._pending, ...data } : { ...data }
    if (!_rafId) {
      _rafId = requestAnimationFrame(() => {
        if (_pending) {
          set((s) => {
            if (s.recording) {
              const merged = { ...s, ..._pending }
              const line = `${Date.now()}\t${merged.speed}\t${merged.rotX}\t${merged.rotY}\t${merged.rotZ}\t${merged.velX}\t${merged.velY}\t${merged.velZ}\t${merged.steerAngle}\t${merged.grounded}\t${merged.fl}\t${merged.fr}\t${merged.rl}\t${merged.rr}\t${merged.sideImp || ''}\t${merged.fwdImp || ''}\t${merged.suspF || ''}`
              return { ..._pending, log: [...s.log, line] }
            }
            return _pending!
          })
        }
        _pending = null
        _rafId = 0
      })
    }
  },
  toggleRecording: () => set((s) => ({ recording: !s.recording, log: s.recording ? s.log : [] })),
  downloadLog: () => {
    const { log } = get()
    if (!log.length) return
    const header = 'time\tspeed\trotX\trotY\trotZ\tvelX\tvelY\tvelZ\tsteer\tgrounded\tfl\tfr\trl\trr\tsideImp\tfwdImp\tsuspF'
    const blob = new Blob([header + '\n' + log.join('\n')], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `debug-${Date.now()}.tsv`
    a.click()
    URL.revokeObjectURL(a.href)
  },
}))
