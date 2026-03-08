import { useDebugStore } from '../hooks/useDebugStore'

export function DebugOverlay() {
  const { speed, forward, braking, left, right, grounded, fl, fr, rl, rr, impulse } = useDebugStore()

  return (
    <div
      style={{
        position: 'fixed',
        top: 12,
        right: 12,
        background: 'rgba(0,0,0,0.75)',
        color: '#0f0',
        fontFamily: 'monospace',
        fontSize: 13,
        padding: '10px 14px',
        borderRadius: 6,
        lineHeight: 1.6,
        pointerEvents: 'none',
        zIndex: 999,
      }}
    >
      <div>speed: {speed}</div>
      <div>W(fwd): {forward ? '✅' : '—'}</div>
      <div>S(brk): {braking ? '✅' : '—'}</div>
      <div>A(lft): {left ? '✅' : '—'}</div>
      <div>D(rgt): {right ? '✅' : '—'}</div>
      <div>grnd: {grounded ? '✅' : '❌'}</div>
      <div>FL:{fl ? '✅' : '❌'} FR:{fr ? '✅' : '❌'}</div>
      <div>RL:{rl ? '✅' : '❌'} RR:{rr ? '✅' : '❌'}</div>
      <div>driveDir: [{impulse.join(', ')}]</div>
    </div>
  )
}
