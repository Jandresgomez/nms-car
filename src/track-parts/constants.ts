/**
 * Track parts system for Blender-exported tiles.
 *
 * All pieces are exported from Blender and scaled uniformly by TRACK_SCALE
 * so they match the car's physics size.
 *
 * Coordinate convention (after scaling):
 *   - Pieces connect along the -Z axis (forward direction)
 *   - The "entry" edge of each piece is at its local origin (z ≈ 0)
 *   - Road surface sits at y ≈ 0
 *
 * Raw Blender dimensions (before scaling):
 *   Straight:  5.0w x 0.35h x 4.5l   — entry at z≈+2.24, exit at z≈-2.24
 *   LCurve:   12.7w x 0.35h x 12.7l  — turns left, entry at z≈+2.24
 *   RCurve:   12.7w x 0.35h x 12.7l  — turns right, entry at z≈+2.24
 *   RampUp:    5.0w x 2.4h  x 15.6l  — incline going forward
 *   RampDown:  5.0w x 2.4h  x 15.6l  — decline going forward
 */

export const TRACK_SCALE = 3

/** Scaled dimensions for positioning math */
export const TILE = {
  /** Straight piece length along Z */
  straightLength: 4.47 * TRACK_SCALE,
  /** Straight piece width along X */
  straightWidth: 4.94 * TRACK_SCALE,
  /** Curve bounding size (square) */
  curveSize: 12.71 * TRACK_SCALE,
  /** Ramp length along Z */
  rampLength: 15.57 * TRACK_SCALE,
  /** Ramp peak height */
  rampHeight: 2.39 * TRACK_SCALE,
} as const
