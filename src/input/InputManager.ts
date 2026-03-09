/** Action names that any vehicle/entity can respond to */
export type Action = 'forward' | 'backward' | 'left' | 'right' | 'drift'

/** Snapshot of all action states — read every frame */
export interface ActionState {
  forward: boolean
  backward: boolean
  left: boolean
  right: boolean
  drift: boolean
}

const DEFAULT_STATE: ActionState = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  drift: false,
}

/**
 * Unified input manager that merges multiple input sources (keyboard, touch, gamepad, etc.)
 * into a single ActionState read by game systems each frame.
 *
 * Each source writes into its own layer; the final state is the OR of all layers.
 */
export class InputManager {
  private layers = new Map<string, Partial<ActionState>>()

  /** Set an action value for a named source layer */
  set(source: string, action: Action, value: boolean) {
    let layer = this.layers.get(source)
    if (!layer) {
      layer = {}
      this.layers.set(source, layer)
    }
    layer[action] = value
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

  /** Clear all actions for a source */
  clearSource(source: string) {
    this.layers.delete(source)
  }
}
