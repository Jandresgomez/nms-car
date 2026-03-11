# Car Physics Model — Arcade Raycast Vehicle

## Core Architecture: Raycast Vehicle

4 rays cast downward from wheel positions. No mesh-based wheel colliders.

- Full control over suspension response
- Easy slope handling without complex collision geometry
- No rollover risk (forces are applied directly)
- Cheap and predictable

## Physics Model

### 1. Ground Detection (per wheel)

Cast a ray downward from each wheel anchor point. Ray length = rest height + max compression. Hit distance determines compression → spring force.

### 2. Suspension (minimal spring)

Keep the car planted on uneven terrain with a simple spring:

```
force = (restLength - hitDistance) * stiffness
```

No damping needed for arcade feel. Handles slopes and bumps naturally.

### 3. Acceleration & Braking

Apply force along the car's forward vector at each grounded wheel position.

- Instant torque curve (no gear simulation)
- Speed-dependent force falloff for natural top speed
- Separate forward/reverse max speeds

### 4. Steering

Two approaches combined for sharp, responsive turns:

- **Rotate the velocity vector** toward the car's facing direction each frame — the secret sauce for sharp turns without drift delay.
- **Lateral grip as a tunable curve** — near-instant grip at low speed, some slide at high speed. Gives "snap in, slide out" feel.

```
// Core steering trick
lateralVelocity = dot(velocity, car.right)
forwardVelocity = dot(velocity, car.forward)

// Kill lateral velocity based on grip factor (0-1)
gripFactor = gripCurve.evaluate(speed)
correctedLateral = lateralVelocity * (1 - gripFactor)

velocity = car.forward * forwardVelocity + car.right * correctedLateral
```

### 5. Anti-Rollover

- Lerp car's up vector toward world up
- Apply strong corrective torque around forward axis
- Clamp roll angle to ±5 degrees

### 6. Slope Handling

Handled naturally by the raycast model:

- Car aligns to surface normal (blend surface normal and world up — 70/30 for arcade feel)
- Gravity projects along slope: car slows uphill, accelerates downhill without extra code

## Tuning Parameters

| Parameter | Purpose | Arcade Range |
|---|---|---|
| `maxSpeed` | Top speed | 40–80 m/s |
| `acceleration` | Forward force | 20–50 m/s² |
| `turnRate` | Steering angular velocity | 90–180 °/s |
| `gripCurve` | Lateral grip vs speed | 0.95 @ low, 0.7 @ high |
| `velocitySteerFactor` | How much velocity rotates with car | 0.8–0.95 |
| `rollCorrectionTorque` | Anti-roll strength | 500+ |
| `slopeAlignSpeed` | How fast car matches terrain | 5–10 (lerp speed) |

## What NOT To Do (Arcade)

- No tire friction model (Pacejka etc.) — too complex, kills responsiveness
- No weight transfer simulation — makes the car feel sluggish
- No realistic suspension travel — just enough spring to stay planted
- No engine/transmission model — direct force application

## Implementation Order

1. Raycast ground detection + basic spring
2. Forward acceleration with speed cap
3. Steering with velocity rotation trick
4. Slope alignment
5. Anti-roll correction
6. Tuning pass (takes 80% of the time)
