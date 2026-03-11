import { useRef, useCallback } from 'react'
import type { InputManager } from '../input/InputManager'

interface AnalogTouchControlsProps { input: InputManager }

const zoneBase: React.CSSProperties = {
  position: 'fixed',
  bottom: 'calc(30px + env(safe-area-inset-bottom))',
  borderRadius: 12,
  border: '2px solid rgba(255,255,255,0.4)',
  background: 'rgba(255,255,255,0.08)',
  touchAction: 'none',
  userSelect: 'none',
  WebkitUserSelect: 'none',
}

const indicatorBase: React.CSSProperties = {
  position: 'absolute',
  borderRadius: '50%',
  background: 'rgba(255,255,255,0.5)',
  pointerEvents: 'none',
  transition: 'none',
}

export function AnalogTouchControls({ input }: AnalogTouchControlsProps) {
  if (!('ontouchstart' in window)) return null

  const gasRef = useRef<HTMLDivElement>(null)
  const gasIndicatorRef = useRef<HTMLDivElement>(null)
  const steerRef = useRef<HTMLDivElement>(null)
  const steerIndicatorRef = useRef<HTMLDivElement>(null)

  // Left side: vertical throttle slider
  const updateGas = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    const el = gasRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    let throttle = 0
    for (let i = 0; i < e.touches.length; i++) {
      const t = e.touches[i]
      if (t.clientX < rect.left || t.clientX > rect.right ||
          t.clientY < rect.top || t.clientY > rect.bottom) continue
      // Map Y position: top = 1, center = 0, bottom = -1
      const yRatio = (t.clientY - rect.top) / rect.height
      throttle = 1 - yRatio * 2
      break
    }
    input.setAxis('touch', 'throttle', throttle)
    if (gasIndicatorRef.current) {
      const pct = (1 - throttle) / 2 * 100
      gasIndicatorRef.current.style.top = `${pct}%`
      gasIndicatorRef.current.style.opacity = '1'
    }
  }, [input])

  const clearGas = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    const el = gasRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    let found = false
    for (let i = 0; i < e.touches.length; i++) {
      const t = e.touches[i]
      if (t.clientX >= rect.left && t.clientX <= rect.right &&
          t.clientY >= rect.top && t.clientY <= rect.bottom) {
        found = true
        break
      }
    }
    if (!found) {
      input.setAxis('touch', 'throttle', 0)
      if (gasIndicatorRef.current) {
        gasIndicatorRef.current.style.top = '50%'
        gasIndicatorRef.current.style.opacity = '0.3'
      }
    }
  }, [input])

  // Right side: horizontal steer slider
  const updateSteer = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    const el = steerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    let steer = 0
    for (let i = 0; i < e.touches.length; i++) {
      const t = e.touches[i]
      if (t.clientX < rect.left || t.clientX > rect.right ||
          t.clientY < rect.top || t.clientY > rect.bottom) continue
      // Map X position: left = 1, center = 0, right = -1
      const xRatio = (t.clientX - rect.left) / rect.width
      steer = 1 - xRatio * 2
      break
    }
    input.setAxis('touch', 'steer', steer)
    if (steerIndicatorRef.current) {
      const pct = (1 - steer) / 2 * 100
      steerIndicatorRef.current.style.left = `${pct}%`
      steerIndicatorRef.current.style.opacity = '1'
    }
  }, [input])

  const clearSteer = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    const el = steerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    let found = false
    for (let i = 0; i < e.touches.length; i++) {
      const t = e.touches[i]
      if (t.clientX >= rect.left && t.clientX <= rect.right &&
          t.clientY >= rect.top && t.clientY <= rect.bottom) {
        found = true
        break
      }
    }
    if (!found) {
      input.setAxis('touch', 'steer', 0)
      if (steerIndicatorRef.current) {
        steerIndicatorRef.current.style.left = '50%'
        steerIndicatorRef.current.style.opacity = '0.3'
      }
    }
  }, [input])

  return (
    <>
      {/* Left: vertical throttle slider */}
      <div
        ref={gasRef}
        style={{
          ...zoneBase,
          left: 'calc(20px + env(safe-area-inset-left))',
          width: 70,
          height: 200,
        }}
        onTouchStart={updateGas} onTouchMove={updateGas}
        onTouchEnd={clearGas} onTouchCancel={clearGas}
      >
        <div style={{
          position: 'absolute', left: 0, right: 0, top: '50%',
          borderTop: '1px solid rgba(255,255,255,0.3)',
        }} />
        <div style={{
          position: 'absolute', top: 8, width: '100%',
          textAlign: 'center', color: 'rgba(255,255,255,0.4)',
          fontSize: 10, fontFamily: 'monospace',
        }}>GAS</div>
        <div style={{
          position: 'absolute', bottom: 8, width: '100%',
          textAlign: 'center', color: 'rgba(255,255,255,0.4)',
          fontSize: 10, fontFamily: 'monospace',
        }}>BRK</div>
        <div ref={gasIndicatorRef} style={{
          ...indicatorBase,
          width: 40, height: 40,
          left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)',
          opacity: 0.3,
        }} />
      </div>

      {/* Right: horizontal steer slider */}
      <div
        ref={steerRef}
        style={{
          ...zoneBase,
          right: 'calc(20px + env(safe-area-inset-right))',
          width: 200,
          height: 70,
        }}
        onTouchStart={updateSteer} onTouchMove={updateSteer}
        onTouchEnd={clearSteer} onTouchCancel={clearSteer}
      >
        <div style={{
          position: 'absolute', top: 0, bottom: 0, left: '50%',
          borderLeft: '1px solid rgba(255,255,255,0.3)',
        }} />
        <div style={{
          position: 'absolute', left: 8, height: '100%',
          display: 'flex', alignItems: 'center',
          color: 'rgba(255,255,255,0.4)',
          fontSize: 14, fontFamily: 'monospace',
        }}>◀</div>
        <div style={{
          position: 'absolute', right: 8, height: '100%',
          display: 'flex', alignItems: 'center',
          color: 'rgba(255,255,255,0.4)',
          fontSize: 14, fontFamily: 'monospace',
        }}>▶</div>
        <div ref={steerIndicatorRef} style={{
          ...indicatorBase,
          width: 40, height: 40,
          left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)',
          opacity: 0.3,
        }} />
      </div>
    </>
  )
}
