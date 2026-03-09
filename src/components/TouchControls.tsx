import type { InputManager, Action } from '../input/InputManager'

interface TouchControlsProps {
  input: InputManager
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
  action,
  input,
  style,
}: {
  label: string
  action: Action
  input: InputManager
  style?: React.CSSProperties
}) {
  return (
    <div
      style={{ ...btnStyle, ...style }}
      onTouchStart={(e) => { e.preventDefault(); input.set('touch', action, true) }}
      onTouchEnd={(e) => { e.preventDefault(); input.set('touch', action, false) }}
      onTouchCancel={(e) => { e.preventDefault(); input.set('touch', action, false) }}
    >
      {label}
    </div>
  )
}

export function TouchControls({ input }: TouchControlsProps) {
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
          action="forward"
          input={input}
          style={{ background: 'rgba(50,200,50,0.25)', border: '2px solid rgba(100,255,100,0.5)' }}
        />
        <Btn
          label="■ BRK"
          action="backward"
          input={input}
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
        <Btn label="◀" action="left" input={input} />
        <Btn label="▶" action="right" input={input} />
      </div>

      {/* Jump button — center right, above steering */}
      <Btn
        label="⬆ JMP"
        action="jump"
        input={input}
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
