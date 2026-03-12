import { useRef, useCallback } from 'react'
import type { InputManager } from '../input/InputManager'

interface TouchControlsProps { input: InputManager }

const btnBase: React.CSSProperties = {
  borderRadius: 8, border: '2px solid rgba(255,255,255,0.5)',
  background: 'rgba(255,255,255,0.15)', color: 'white',
  fontFamily: 'monospace', fontWeight: 'bold',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none',
}

export function TouchControls({ input }: TouchControlsProps) {
  if (!('ontouchstart' in window)) return null

  const leftRef = useRef<HTMLDivElement>(null)

  const updateLeft = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    const el = leftRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    let gas = false, brake = false, drift = false
    for (let i = 0; i < e.touches.length; i++) {
      const t = e.touches[i]
      if (t.clientX < rect.left || t.clientX > rect.right || t.clientY < rect.top || t.clientY > rect.bottom) continue
      const xRatio = (t.clientX - rect.left) / rect.width
      const top = t.clientY < rect.top + rect.height / 2
      if (top) gas = true; else brake = true
      if (xRatio > 0.6) drift = true
    }
    input.set('touch', 'forward', gas)
    input.set('touch', 'backward', brake)
    input.set('touch', 'drift', drift)
  }, [input])

  const clearLeft = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    // Re-evaluate remaining touches
    updateLeft(e)
    // If no touches remain in the area, clear all
    if (e.touches.length === 0) {
      input.set('touch', 'forward', false)
      input.set('touch', 'backward', false)
      input.set('touch', 'drift', false)
    }
  }, [input, updateLeft])

  const steerRef = useRef<HTMLDivElement>(null)

  const updateSteer = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    const el = steerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    let l = false, r = false
    for (let i = 0; i < e.touches.length; i++) {
      const t = e.touches[i]
      if (t.clientX < rect.left || t.clientX > rect.right || t.clientY < rect.top || t.clientY > rect.bottom) continue
      if ((t.clientX - rect.left) / rect.width < 0.5) l = true; else r = true
    }
    input.set('touch', 'left', l)
    input.set('touch', 'right', r)
  }, [input])

  const clearSteer = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    updateSteer(e)
    if (e.touches.length === 0) {
      input.set('touch', 'left', false)
      input.set('touch', 'right', false)
    }
  }, [input, updateSteer])

  const zone: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
  }
  const divider: React.CSSProperties = {
    borderRight: '1px solid rgba(255,255,255,0.25)', height: '100%',
  }

  return (
    <>
      {/* Left: unified gas/brake/drift pad */}
      <div
        ref={leftRef}
        style={{
          position: 'fixed',
          bottom: 'calc(30px + env(safe-area-inset-bottom))',
          left: 'calc(20px + env(safe-area-inset-left))',
          width: '40vw', height: 152, ...btnBase, padding: 0, overflow: 'hidden',
          flexDirection: 'column',
        }}
        onTouchStart={updateLeft} onTouchMove={updateLeft}
        onTouchEnd={clearLeft} onTouchCancel={clearLeft}
      >
        {/* Top row: Gas */}
        <div style={{ display: 'flex', width: '100%', flex: 1, borderBottom: '1px solid rgba(255,255,255,0.25)', background: 'rgba(50,200,50,0.2)' }}>
          <div style={{ ...zone, ...divider, flex: 3 }}>▲ GAS</div>
          <div style={{ ...zone, flex: 2, background: 'rgba(255,200,50,0.15)', fontSize: 11 }}>GAS+DFT</div>
        </div>
        {/* Bottom row: Brake */}
        <div style={{ display: 'flex', width: '100%', flex: 1, background: 'rgba(255,50,50,0.2)' }}>
          <div style={{ ...zone, ...divider, flex: 3 }}>■ BRK</div>
          <div style={{ ...zone, flex: 2, background: 'rgba(255,200,50,0.15)', fontSize: 11 }}>BRK+DFT</div>
        </div>
      </div>

      {/* Right: steering */}
      <div
        ref={steerRef}
        style={{
          position: 'fixed',
          bottom: 'calc(30px + env(safe-area-inset-bottom))',
          right: 'calc(20px + env(safe-area-inset-right))',
          width: '50vw', height: 70, ...btnBase, padding: 0, overflow: 'hidden',
        }}
        onTouchStart={updateSteer} onTouchMove={updateSteer}
        onTouchEnd={clearSteer} onTouchCancel={clearSteer}
      >
        <span style={{ flex: 1, textAlign: 'center', ...divider, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>◀</span>
        <span style={{ flex: 1, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>▶</span>
      </div>
    </>
  )
}
