export function HUD() {
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
        pointerEvents: 'none',
      }}
    >
      NO MAN'S LAND
    </div>
  )
}
