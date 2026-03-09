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

/** Binds keyboard events to the InputManager's "keyboard" layer */
export function useKeyboardInput(input: InputManager) {
  useEffect(() => {
    const handle = (e: KeyboardEvent, value: boolean) => {
      const action = KEY_MAP[e.code]
      if (action) {
        e.preventDefault()
        input.set('keyboard', action, value)
      }
    }
    const down = (e: KeyboardEvent) => handle(e, true)
    const up = (e: KeyboardEvent) => handle(e, false)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      input.clearSource('keyboard')
    }
  }, [input])
}
