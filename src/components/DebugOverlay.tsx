import { useState, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useDebugStore } from '../hooks/useDebugStore'
import { useGameStore } from '../hooks/useGameStore'
import { CAR_REGISTRY } from '../vehicles/registry'

// FPS counter component that runs inside the Canvas via useFrame
export function FpsTracker() {
  const frames = useRef(0)
  const lastTime = useRef(performance.now())
  const debugSet = useDebugStore((s) => s.set)

  useFrame(() => {
    frames.current++
    const now = performance.now()
    if (now - lastTime.current >= 500) {
      debugSet({ fps: Math.round(frames.current / ((now - lastTime.current) / 1000)) })
      frames.current = 0
      lastTime.current = now
    }
  })

  return null
}

interface DebugOverlayProps {
  debug: boolean
  onToggleDebug: () => void
}

const on = '✅'
const off = '—'

const f = (v: number, d = 2) => v.toFixed(d).padStart(d + 4)

export function DebugOverlay({ debug, onToggleDebug }: DebugOverlayProps) {
  const d = useDebugStore((s) => s)
  const { resetTrack, vehicleId, setVehicleId } = useGameStore()
  const [expanded, setExpanded] = useState(true)
  const { recording, toggleRecording, downloadLog, log } = useDebugStore()

  const btn: React.CSSProperties = {
    background: 'rgba(255,255,255,0.2)', color: 'white', border: 'none',
    borderRadius: 6, padding: '6px 14px', fontFamily: 'monospace', fontSize: 13,
    cursor: 'pointer', width: '100%',
  }

  return (
    <div style={{
      position: 'fixed', top: 'calc(12px + env(safe-area-inset-top))', right: 'calc(12px + env(safe-area-inset-right))', background: 'rgba(0,0,0,0.75)',
      color: '#0f0', fontFamily: 'monospace', fontSize: 13, padding: '10px 14px',
      borderRadius: 6, lineHeight: 1.6, zIndex: 999, display: 'flex',
      flexDirection: 'column', gap: 4, width: 260, minWidth: 260,
    }}>
      {/* Vehicle switcher */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <button onClick={() => {
          const idx = CAR_REGISTRY.findIndex((c) => c.id === vehicleId)
          setVehicleId(CAR_REGISTRY[(idx - 1 + CAR_REGISTRY.length) % CAR_REGISTRY.length].id)
          resetTrack()
        }} style={{ ...btn, flex: 0, padding: '6px 10px' }}>◀</button>
        <div style={{ flex: 1, textAlign: 'center', color: 'white', fontSize: 13 }}>
          {CAR_REGISTRY.find((c) => c.id === vehicleId)?.name}
        </div>
        <button onClick={() => {
          const idx = CAR_REGISTRY.findIndex((c) => c.id === vehicleId)
          setVehicleId(CAR_REGISTRY[(idx + 1) % CAR_REGISTRY.length].id)
          resetTrack()
        }} style={{ ...btn, flex: 0, padding: '6px 10px' }}>▶</button>
      </div>
      <button onClick={onToggleDebug} style={{ ...btn, background: debug ? 'rgba(255,100,100,0.8)' : btn.background }}>
        {debug ? 'Hide' : 'Show'} Colliders
      </button>
      <button onClick={resetTrack} style={btn}>Reset Track</button>
      <button onClick={() => setExpanded(e => !e)} style={btn}>{expanded ? '▲ Less' : '▼ More'}</button>
      <div style={{ display: 'flex', gap: 4 }}>
        <button onClick={toggleRecording} style={{ ...btn, flex: 1, background: recording ? 'rgba(255,50,50,0.8)' : btn.background }}>
          {recording ? `⏺ ${log.length}` : '⏺ Rec'}
        </button>
        <button onClick={downloadLog} style={{ ...btn, flex: 1, opacity: log.length ? 1 : 0.4 }}>
          ⬇ Save
        </button>
      </div>
      {expanded && <>
        <div style={{ marginTop: 4 }}>FPS: {String(d.fps).padStart(4)}</div>
        <div>spd: {f(d.speed, 1)}</div>
        <div>rot: {f(d.rotX, 1)}° {f(d.rotY, 1)}° {f(d.rotZ, 1)}°</div>
        <div>vel: {f(d.velX)} {f(d.velY)} {f(d.velZ)}</div>
        <div>|vel|: {f(d.velMag)}</div>
        <div>W:{d.forward ? on : off} A:{d.left ? on : off} S:{d.braking ? on : off} D:{d.right ? on : off}</div>
        <div>drift:{d.drift ? '🔥' : off} grnd:{d.grounded ? on : '❌'}</div>
        {vehicleId !== 'ball' && <>
          <div>str: {f(d.steerAngle)}</div>
          <div>FL:{d.fl ? on : '❌'} {d.flC} | FR:{d.fr ? on : '❌'} {d.frC}</div>
          <div>RL:{d.rl ? on : '❌'} {d.rlC} | RR:{d.rr ? on : '❌'} {d.rrC}</div>
        </>}
      </>}
    </div>
  )
}
