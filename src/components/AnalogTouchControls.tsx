import { useRef, useEffect, useCallback } from 'react'
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

  // Track which touch ID owns each control
  const gasTouchId = useRef<number | null>(null)
  const steerTouchId = useRef<number | null>(null)
  // Cache rects at touch start so we have stable reference
  const gasRect = useRef<DOMRect | null>(null)
  const steerRect = useRef<DOMRect | null>(null)

  const applyGas = useCallback((clientY: number) => {
    const rect = gasRect.current
    if (!rect) return
    const yRatio = (clientY - rect.top) / rect.height
    const throttle = Math.max(-1, Math.min(1, 1 - yRatio * 2))
    input.setAxis('touch', 'throttle', throttle)
    if (gasIndicatorRef.current) {
      const pct = Math.max(0, Math.min(100, (1 - throttle) / 2 * 100))
      gasIndicatorRef.current.style.top = `${pct}%`
      gasIndicatorRef.current.style.opacity = '1'
    }
  }, [input])

  const resetGas = useCallback(() => {
    gasTouchId.current = null
    gasRect.current = null
    input.setAxis('touch', 'throttle', 0)
    if (gasIndicatorRef.current) {
      gasIndicatorRef.current.style.top = '50%'
      gasIndicatorRef.current.style.opacity = '0.3'
    }
  }, [input])

  const applySteer = useCallback((clientX: number) => {
    const rect = steerRect.current
    if (!rect) return
    const xRatio = (clientX - rect.left) / rect.width
    const steer = Math.max(-1, Math.min(1, 1 - xRatio * 2))
    input.setAxis('touch', 'steer', steer)
    if (steerIndicatorRef.current) {
      const pct = Math.max(0, Math.min(100, (1 - steer) / 2 * 100))
      steerIndicatorRef.current.style.left = `${pct}%`
      steerIndicatorRef.current.style.opacity = '1'
    }
  }, [input])

  const resetSteer = useCallback(() => {
    steerTouchId.current = null
    steerRect.current = null
    input.setAxis('touch', 'steer', 0)
    if (steerIndicatorRef.current) {
      steerIndicatorRef.current.style.left = '50%'
      steerIndicatorRef.current.style.opacity = '0.3'
    }
  }, [input])

  // Global move/end listeners so we track fingers even outside the element
  useEffect(() => {
    const onMove = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i]
        if (t.identifier === gasTouchId.current) applyGas(t.clientY)
        if (t.identifier === steerTouchId.current) applySteer(t.clientX)
      }
    }
    const onEnd = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i]
        if (t.identifier === gasTouchId.current) resetGas()
        if (t.identifier === steerTouchId.current) resetSteer()
      }
    }
    document.addEventListener('touchmove', onMove, { passive: true })
    document.addEventListener('touchend', onEnd)
    document.addEventListener('touchcancel', onEnd)
    return () => {
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onEnd)
      document.removeEventListener('touchcancel', onEnd)
    }
  }, [applyGas, applySteer, resetGas, resetSteer])

  const onGasStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    const el = gasRef.current
    if (!el) return
    gasRect.current = el.getBoundingClientRect()
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i]
      gasTouchId.current = t.identifier
      applyGas(t.clientY)
      break
    }
  }, [applyGas])

  const onSteerStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    const el = steerRef.current
    if (!el) return
    steerRect.current = el.getBoundingClientRect()
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i]
      steerTouchId.current = t.identifier
      applySteer(t.clientX)
      break
    }
  }, [applySteer])

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
        onTouchStart={onGasStart}
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
        onTouchStart={onSteerStart}
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
