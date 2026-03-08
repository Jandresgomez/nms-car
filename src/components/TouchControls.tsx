import type { TouchControlState } from '../hooks/useTouchControls'

interface TouchControlsProps {
  handlers: {
    set: (key: keyof TouchControlState, value: boolean) => void
  }
}

const btnStyle: React.CSSProperties = {
  width: 70,
  height: 70,
  borderRadius: '50%',
  border: '2px solid rgba(255,255,255,0.5)',
  background: 'rgba(255,255,255,0.15)',
  color: 'white',
  fontSize: 18,
  fontWeight: 'bold',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  touchAction: 'none',
  userSelect: 'none',
  WebkitUserSelect: 'none',
}

function Btn({
  label,
  controlKey,
  handlers,
  style,
}: {
  label: string
  controlKey: keyof TouchControlState
  handlers: TouchControlsProps['handlers']
  style?: React.CSSProperties
}) {
  return (
    <div
      style={{ ...btnStyle, ...style }}
      onTouchStart={(e) => { e.preventDefault(); handlers.set(controlKey, true) }}
      onTouchEnd={(e) => { e.preventDefault(); handlers.set(controlKey, false) }}
      onTouchCancel={(e) => { e.preventDefault(); handlers.set(controlKey, false) }}
    >
      {label}
    </div>
  )
}

export function TouchControls({ handlers }: TouchControlsProps) {
  return (
    <>
      {/* Left side: Brake (bottom) + Accel (top) */}
      <div style={{
        position: 'fixed',
        bottom: 30,
        left: 30,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}>
        <Btn
          label="▲ GAS"
          controlKey="forward"
          handlers={handlers}
          style={{ background: 'rgba(50,200,50,0.25)', border: '2px solid rgba(100,255,100,0.5)' }}
        />
        <Btn
          label="■ BRK"
          controlKey="backward"
          handlers={handlers}
          style={{ background: 'rgba(255,50,50,0.25)', border: '2px solid rgba(255,100,100,0.5)' }}
        />
      </div>

      {/* Right side: Left + Right steering */}
      <div style={{
        position: 'fixed',
        bottom: 30,
        right: 30,
        display: 'flex',
        gap: 16,
        alignItems: 'flex-end',
      }}>
        <Btn label="◀" controlKey="left" handlers={handlers} />
        <Btn label="▶" controlKey="right" handlers={handlers} />
      </div>

      {/* Jump button — center right, above steering */}
      <Btn
        label="⬆ JMP"
        controlKey="shoot"
        handlers={handlers}
        style={{
          position: 'fixed',
          bottom: 120,
          right: 50,
          background: 'rgba(50,150,255,0.25)',
          border: '2px solid rgba(100,180,255,0.5)',
        }}
      />
    </>
  )
}
