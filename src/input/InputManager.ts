/** Action names that any vehicle/entity can respond to */
export type Action = 'forward' | 'backward' | 'left' | 'right' | 'drift'

/** Analog axes for continuous input */
export type Axis = 'throttle' | 'steer'

/** Snapshot of all action states — read every frame */
export interface ActionState {
  forward: boolean
  backward: boolean
  left: boolean
  right: boolean
  drift: boolean
}

/** Analog input: throttle -1 (reverse) to 1 (forward), steer -1 (right) to 1 (left) */
export interface AnalogState {
  throttle: number
  steer: number
}

const DEFAULT_STATE: ActionState = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  drift: false,
}

const DEFAULT_ANALOG: AnalogState = { throttle: 0, steer: 0 }

/**
 * Unified input manager that merges multiple input sources (keyboard, touch, gamepad, etc.)
 * into a single ActionState read by game systems each frame.
 *
 * Each source writes into its own layer; the final state is the OR of all layers.
 */
export class InputManager {
  private layers = new Map<string, Partial<ActionState>>()
  private analogLayers = new Map<string, Partial<AnalogState>>()

  /** Set an action value for a named source layer */
  set(source: string, action: Action, value: boolean) {
    let layer = this.layers.get(source)
    if (!layer) {
      layer = {}
      this.layers.set(source, layer)
    }
    layer[action] = value
  }

  /** Set an analog axis value for a named source layer */
  setAxis(source: string, axis: Axis, value: number) {
    let layer = this.analogLayers.get(source)
    if (!layer) {
      layer = {}
      this.analogLayers.set(source, layer)
    }
    layer[axis] = Math.max(-1, Math.min(1, value))
  }

  /** Read the merged state (OR across all layers) */
  getState(): ActionState {
    const out = { ...DEFAULT_STATE }
    for (const layer of this.layers.values()) {
      for (const key of Object.keys(out) as Action[]) {
        if (layer[key]) out[key] = true
      }
    }
    return out
  }

  /** Read the merged analog state (max absolute value wins per axis) */
  getAnalog(): AnalogState {
    const out = { ...DEFAULT_ANALOG }
    for (const layer of this.analogLayers.values()) {
      for (const key of Object.keys(out) as Axis[]) {
        const v = layer[key] ?? 0
        if (Math.abs(v) > Math.abs(out[key])) out[key] = v
      }
    }
    return out
  }

  /** Clear all actions for a source */
  clearSource(source: string) {
    this.layers.delete(source)
    this.analogLayers.delete(source)
  }
}
