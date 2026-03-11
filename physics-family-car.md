# Family Car — Roll-Over Prevention Plan

## Problem

The Z-axis rotation is locked via `enabledRotations={[true, true, false]}` to prevent rollover. This makes the car feel robotic — no natural tilt on slopes, ramps, or bumps. Removing the lock causes immediate rollover in turns.

## Root Causes

### 1. No Anti-Roll Bars
Real cars have sway bars connecting left/right wheels. When the car leans in a turn, the outer suspension compresses more than the inner. A sway bar transfers force from the compressed side to the extended side, resisting body roll. The FamilyCar has no equivalent mechanism.

### 2. Center of Mass Too High
The collider `[1, 0.5, 2]` places the CoM at the geometric center. Wheel track width is only ±1 (2 units total), but CoM sits 0.5 units up. Real cars have their CoM well below geometric center (engine, transmission, battery are all low-mounted).

### 3. No Suspension Damping
`setWheelSuspensionCompression` and `setWheelSuspensionRelaxation` are never called. Without damping, the suspension is a pure spring that oscillates and can amplify roll motion instead of absorbing it.

### 4. Friction Slip Too High (10)
Rapier docs warn: "The larger the value, the more instantaneous braking will happen (with the risk of causing the vehicle to flip if it's too strong)." High side friction generates the lateral force that tips the car.

## Fix Plan (ordered by impact)

### A. Anti-Roll Bar — the big one

After `vc.updateVehicle()`, read `wheelSuspensionForce(i)` for each left/right pair. Apply a corrective torque around the car's forward axis proportional to the force difference. This is physically accurate — it's exactly what a mechanical sway bar does.

```
// Per axle (front pair 0,1 and rear pair 2,3):
antiRollForce = (leftSuspForce - rightSuspForce) * antiRollStiffness
// Apply as torque around the car's forward (Z) axis
```

This is NOT an external force — it redistributes existing suspension forces between paired wheels.

Rapier API: `vc.wheelSuspensionForce(i)` returns the force applied by each wheel's suspension after `updateVehicle()`.

Tuning range: `antiRollStiffness` between 5–50. Start at 20.

### B. Lower Center of Mass

Offset the `CuboidCollider` position downward relative to the visual model. Shift by ~0.3 units on Y. The collider represents mass distribution, not the visual shell — every game does this.

```tsx
<CuboidCollider args={[...CHASSIS_HALF]} position={[0, -0.3, 0]} friction={0.8} />
```

### C. Add Suspension Damping

During vehicle controller init, call:

```ts
vc.setWheelSuspensionCompression(i, 3.0)  // damping when compressing (2–5 range)
vc.setWheelSuspensionRelaxation(i, 4.0)   // damping when extending (3–6 range)
```

Prevents springs from bouncing the car into a roll.

### D. Reduce Friction Slip

Drop `FRICTION_SLIP` from 10 to 3–5. Less lateral grip = less roll torque. Fine-tune with `setWheelSideFrictionStiffness` for more nuanced control.

### E. Widen Wheel Track (optional)

Move wheels from ±1.0 to ±1.2 or ±1.3 on X. Wider stance = more geometric roll resistance.

## Implementation Order

1. Remove `enabledRotations` constraint
2. Apply B (lower CoM) + C (damping) — quick wins, minimal code
3. Apply A (anti-roll bar) — the main fix, needs post-update torque application
4. Tune D (friction slip) to taste
5. Tuning pass — adjust all values together

## Why Not Just...

| Alternative | Problem |
|---|---|
| Crank `angularDamping` | Affects ALL axes equally — makes steering sluggish |
| Keep Z-axis locked | No natural tilt on slopes/ramps, feels robotic |
| Copy HotRod's custom raycast approach | Works but loses Rapier's built-in vehicle controller features; bigger rewrite |
| Apply constant uprighting torque | Feels artificial, fights physics instead of working with it |
