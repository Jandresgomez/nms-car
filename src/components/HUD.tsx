import { useGameStore } from '../hooks/useGameStore'

export function HUD() {
  const coins = useGameStore((s) => s.coins)
  const cameraLocked = useGameStore((s) => s.cameraLocked)
  const toggleCameraLock = useGameStore((s) => s.toggleCameraLock)

  return (
    <div
      style={{
        position: 'fixed',
        top: 'calc(16px + env(safe-area-inset-top))',
        left: 'calc(16px + env(safe-area-inset-left))',
        color: 'white',
        fontFamily: 'monospace',
        fontSize: 14,
        textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
      }}
    >
      <div style={{ pointerEvents: 'none' }}>NO MAN'S LAND</div>
      <div style={{ marginTop: 4, pointerEvents: 'none' }}>🪙 {coins}</div>
      <button
        onPointerDown={(e) => { e.stopPropagation(); toggleCameraLock() }}
        style={{
          marginTop: 12,
          padding: '6px 12px',
          borderRadius: 6,
          border: '2px solid rgba(255,255,255,0.5)',
          background: cameraLocked ? 'rgba(255,180,50,0.4)' : 'rgba(255,255,255,0.15)',
          color: 'white',
          fontFamily: 'monospace',
          fontWeight: 'bold',
          fontSize: 12,
          cursor: 'pointer',
          touchAction: 'none',
        }}
      >
        📷 {cameraLocked ? 'FREE CAM' : 'FOLLOW'}
      </button>
    </div>
  )
}
