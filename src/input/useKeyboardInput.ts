import { useEffect } from 'react'
import { InputManager, type Action } from './InputManager'

const KEY_MAP: Record<string, Action> = {
  ArrowUp: 'forward',
  KeyW: 'forward',
  ArrowDown: 'backward',
  KeyS: 'backward',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  Space: 'drift',
}

/** Maps boolean actions to analog axes */
const ANALOG_MAP: Record<string, { axis: 'throttle' | 'steer'; value: number }> = {
  ArrowUp: { axis: 'throttle', value: 1 },
  KeyW: { axis: 'throttle', value: 1 },
  ArrowDown: { axis: 'throttle', value: -1 },
  KeyS: { axis: 'throttle', value: -1 },
  ArrowLeft: { axis: 'steer', value: 1 },
  KeyA: { axis: 'steer', value: 1 },
  ArrowRight: { axis: 'steer', value: -1 },
  KeyD: { axis: 'steer', value: -1 },
}

/** Binds keyboard events to the InputManager's "keyboard" layer */
export function useKeyboardInput(input: InputManager) {
  useEffect(() => {
    const pressed = new Set<string>()

    const updateAnalog = () => {
      let throttle = 0
      let steer = 0
      for (const code of pressed) {
        const m = ANALOG_MAP[code]
        if (m) {
          if (m.axis === 'throttle') throttle = m.value
          if (m.axis === 'steer') steer = m.value
        }
      }
      input.setAxis('keyboard', 'throttle', throttle)
      input.setAxis('keyboard', 'steer', steer)
    }

    const down = (e: KeyboardEvent) => {
      const action = KEY_MAP[e.code]
      if (action) {
        e.preventDefault()
        input.set('keyboard', action, true)
      }
      pressed.add(e.code)
      updateAnalog()
    }

    const up = (e: KeyboardEvent) => {
      const action = KEY_MAP[e.code]
      if (action) {
        input.set('keyboard', action, false)
      }
      pressed.delete(e.code)
      updateAnalog()
    }

    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      input.clearSource('keyboard')
    }
  }, [input])
}
