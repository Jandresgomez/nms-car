import { useCallback, useRef } from 'react'

export interface TouchControlState {
  forward: boolean
  backward: boolean
  left: boolean
  right: boolean
  shoot: boolean
}

export function useTouchControls() {
  const controls = useRef<TouchControlState>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    shoot: false,
  })

  const set = useCallback((key: keyof TouchControlState, value: boolean) => {
    controls.current[key] = value
  }, [])

  return {
    controls: controls,
    handlers: { set },
  }
}
