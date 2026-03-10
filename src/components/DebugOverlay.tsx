import { useState } from 'react'
import { useDebugStore } from '../hooks/useDebugStore'
import { useGameStore } from '../hooks/useGameStore'

interface DebugOverlayProps {
  debug: boolean
  onToggleDebug: () => void
}

const on = '✅'
const off = '—'

export function DebugOverlay({ debug, onToggleDebug }: DebugOverlayProps) {
  const { speed, forward, braking, left, right, drift, grounded, fl, fr, rl, rr, steerAngle, flC, frC, rlC, rrC } = useDebugStore()
  const resetTrack = useGameStore((s) => s.resetTrack)
  const isMobile = 'ontouchstart' in window
  const [expanded, setExpanded] = useState(false)

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
      flexDirection: 'column', gap: 4,
    }}>
      <button onClick={onToggleDebug} style={{ ...btn, background: debug ? 'rgba(255,100,100,0.8)' : btn.background }}>
        {debug ? 'Hide' : 'Show'} Colliders
      </button>
      <button onClick={resetTrack} style={btn}>Reset Track</button>
      {isMobile && <button onClick={() => setExpanded(e => !e)} style={btn}>{expanded ? '▲ Less' : '▼ More'}</button>}
      {(!isMobile || expanded) && <>
        <div style={{ marginTop: 4 }}>spd: {speed}</div>
        <div>W:{forward ? on : off} A:{left ? on : off} S:{braking ? on : off} D:{right ? on : off}</div>
        <div>drift:{drift ? '🔥' : off} grnd:{grounded ? on : '❌'} str:{steerAngle}</div>
        <div>FL:{fl ? on : '❌'} {flC} | FR:{fr ? on : '❌'} {frC}</div>
        <div>RL:{rl ? on : '❌'} {rlC} | RR:{rr ? on : '❌'} {rrC}</div>
      </>}
    </div>
  )
}
