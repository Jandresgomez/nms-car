import { CuboidCollider, RapierRigidBody, RigidBody, useRapier } from "@react-three/rapier"
import type { InputManager } from "../input"
import { useFrame } from "@react-three/fiber"
import { useRef, type ReactNode } from "react"
import { CylinderGeometry, Quaternion, Vector3 } from "three"
import type { Group } from "three"

// ── Wheel state exposed to visual skins ──────────────────────────
export interface WheelState {
    y: number           // local Y position (suspension compressed)
    steerAngle: number  // steering angle (front wheels only)
    grounded: boolean
}

// ── Physics overrides per car skin ───────────────────────────────
export interface CarPhysicsOverrides {
    driveForce?: number
    maxSteerAngle?: number
    frontLateralGrip?: number
    rearLateralGrip?: number
    rollingResistance?: number
    frontDriveRatio?: number
    turboMultiplier?: number
}

// ── Props ────────────────────────────────────────────────────────
interface BasicCarProps {
    input: InputManager
    physics?: CarPhysicsOverrides
    children?: (wheelStates: WheelState[], bodyRef: React.RefObject<RapierRigidBody | null>) => ReactNode
}

// ── Fixed physics chassis (never changes per car) ────────────────
const CHASSIS_SCALE = 1
const CHASSIS_PROPORTIONS = [3.5, 0.6, 6.5] as const
const CHASSIS = CHASSIS_PROPORTIONS.map(c => c * CHASSIS_SCALE) as [number, number, number]
const CHASSIS_HALF = CHASSIS.map(v => v / 2) as [number, number, number]
const CHASSIS_MASS = 200

const SUSPENSION_REST_LENGTH = 0.6
const SUSPENSION_STIFFNESS = 600
const SUSPENSION_DAMPING = 50
const WHEEL_RADIUS = 0.8

// Default movement values (overridable via physics prop)
const DEFAULTS = {
    driveForce: 900,
    maxSteerAngle: Math.PI / 8,
    frontLateralGrip: 0.8,
    rearLateralGrip: 0.5,
    rollingResistance: 4,
    frontDriveRatio: 0.75,
    turboMultiplier: 1.3,
    airSteerRate: 750,
}

const X_D = (CHASSIS[0] / 2) * 0.95
const Y_D = (CHASSIS[1] / 2) * 0.95
const Z_D = (CHASSIS[2] / 2) - WHEEL_RADIUS
const WHEEL_POSITIONS = [
    { x: -X_D, y: -Y_D, z: -Z_D },
    { x: X_D, y: -Y_D, z: -Z_D },
    { x: -X_D, y: -Y_D, z: Z_D },
    { x: X_D, y: -Y_D, z: Z_D },
]

export { WHEEL_POSITIONS, WHEEL_RADIUS, SUSPENSION_REST_LENGTH, CHASSIS, CHASSIS_HALF }

export const BasicCar = ({ input, physics, children }: BasicCarProps) => {
    const bodyRef = useRef<RapierRigidBody>(null)
    const { world, rapier } = useRapier()
    const prevCompression = useRef([0, 0, 0, 0])
    const wheelStates = useRef<WheelState[]>(
        WHEEL_POSITIONS.map(() => ({ y: -SUSPENSION_REST_LENGTH, steerAngle: 0, grounded: false }))
    )

    // Debug wheel refs (only used when no children/skin provided)
    const wheelRefs = useRef<(Group | null)[]>([null, null, null, null])

    // Merge defaults with overrides
    const cfg = { ...DEFAULTS, ...physics }

    useFrame((_, delta) => {
        const body = bodyRef.current
        if (!body) return

        const dt = Math.min(delta, 0.05)

        const bodyPos = body.translation()
        const bodyRot = body.rotation()
        const quat = new Quaternion(bodyRot.x, bodyRot.y, bodyRot.z, bodyRot.w)

        const downDir = new Vector3(0, -1, 0).applyQuaternion(quat)
        const forwardDir = new Vector3(0, 0, -1).applyQuaternion(quat)
        const upDir = new Vector3(0, 1, 0).applyQuaternion(quat)

        const { throttle, steer } = input.getAnalog()
        const { drift: turbo } = input.getState()
        const steerAngle = steer * cfg.maxSteerAngle

        let groundedWheels = 0

        WHEEL_POSITIONS.forEach((wp, i) => {
            const localPos = new Vector3(wp.x, wp.y, wp.z)
            localPos.applyQuaternion(quat)
            const origin = new Vector3(bodyPos.x + localPos.x, bodyPos.y + localPos.y, bodyPos.z + localPos.z)

            const ray = new rapier.Ray(origin, downDir)
            const EXCLUDE_SENSORS = 8
            const hit = world.castRay(ray, SUSPENSION_REST_LENGTH + WHEEL_RADIUS, true, EXCLUDE_SENSORS, undefined, undefined, body)

            if (hit) {
                const hitDist = hit.timeOfImpact
                const compression = SUSPENSION_REST_LENGTH + WHEEL_RADIUS - hitDist

                if (compression > 0) {
                    groundedWheels++

                    // Update wheel state
                    const wheelY = wp.y - (SUSPENSION_REST_LENGTH - compression)
                    wheelStates.current[i] = {
                        y: wheelY,
                        steerAngle: i < 2 ? steerAngle : 0,
                        grounded: true,
                    }

                    // Update debug visuals
                    if (wheelRefs.current[i]) {
                        wheelRefs.current[i]!.position.y = wheelY
                        if (i < 2) wheelRefs.current[i]!.rotation.y = steerAngle
                    }

                    // Drive force
                    const wheelForward = i < 2
                        ? forwardDir.clone().applyAxisAngle(upDir, steerAngle)
                        : forwardDir

                    if (throttle !== 0) {
                        const driveAmount = i < 2
                            ? cfg.driveForce * cfg.frontDriveRatio / 2
                            : cfg.driveForce * (1 - cfg.frontDriveRatio) / 2
                        const f = wheelForward.clone().multiplyScalar(throttle * driveAmount * (turbo ? cfg.turboMultiplier : 1) * dt)
                        body.applyImpulseAtPoint(
                            { x: f.x, y: f.y, z: f.z },
                            { x: origin.x, y: origin.y, z: origin.z },
                            true
                        )
                    }

                    // Friction forces
                    const velAtWheel = body.velocityAtPoint({ x: origin.x, y: origin.y, z: origin.z })
                    const vel = new Vector3(velAtWheel.x, velAtWheel.y, velAtWheel.z)

                    // Lateral grip
                    const wheelRight = wheelForward.clone().cross(upDir).normalize()
                    const lateralSpeed = wheelRight.dot(vel)
                    const grip = i < 2 ? cfg.frontLateralGrip : cfg.rearLateralGrip
                    const lateralImpulse = wheelRight.clone().multiplyScalar(-lateralSpeed * CHASSIS_MASS * grip * dt / 4)
                    body.applyImpulseAtPoint(
                        { x: lateralImpulse.x, y: lateralImpulse.y, z: lateralImpulse.z },
                        { x: origin.x, y: origin.y, z: origin.z },
                        true
                    )

                    // Rolling resistance
                    const forwardSpeed = wheelForward.dot(vel)
                    const rollingImpulse = wheelForward.clone().multiplyScalar(-forwardSpeed * cfg.rollingResistance * dt)
                    body.applyImpulseAtPoint(
                        { x: rollingImpulse.x, y: rollingImpulse.y, z: rollingImpulse.z },
                        { x: origin.x, y: origin.y, z: origin.z },
                        true
                    )

                    // Suspension
                    const compressionVel = (compression - prevCompression.current[i]) / dt
                    prevCompression.current[i] = compression
                    const forceMag = SUSPENSION_STIFFNESS * compression + SUSPENSION_DAMPING * compressionVel
                    const suspForce = downDir.clone().negate().multiplyScalar(Math.max(forceMag, 0))
                    body.applyImpulseAtPoint(
                        { x: suspForce.x * dt, y: suspForce.y * dt, z: suspForce.z * dt },
                        { x: origin.x, y: origin.y, z: origin.z },
                        true
                    )
                } else {
                    wheelStates.current[i] = { y: wp.y - SUSPENSION_REST_LENGTH, steerAngle: 0, grounded: false }
                    if (wheelRefs.current[i]) wheelRefs.current[i]!.position.y = wp.y - SUSPENSION_REST_LENGTH
                    prevCompression.current[i] = 0
                }
            } else {
                wheelStates.current[i] = { y: wp.y - SUSPENSION_REST_LENGTH, steerAngle: 0, grounded: false }
                if (wheelRefs.current[i]) wheelRefs.current[i]!.position.y = wp.y - SUSPENSION_REST_LENGTH
                prevCompression.current[i] = 0
            }
        })

        // Air steering
        if (groundedWheels === 0 && steer !== 0) {
            const yawTorque = upDir.clone().multiplyScalar(steer * cfg.airSteerRate * dt)
            body.applyTorqueImpulse({ x: yawTorque.x, y: yawTorque.y, z: yawTorque.z }, true)
        }
    })

    return (
        <RigidBody
            ref={bodyRef}
            colliders={false}
            mass={CHASSIS_MASS}
            linearDamping={0.3}
            angularDamping={5}
            position={[0, 5, 0]}
            ccd
            name="car"
        >
            <CuboidCollider args={CHASSIS_HALF} position={[0, -0.3, 0]} friction={0.8} />

            {/* If a skin is provided, render it. Otherwise show debug wireframe. */}
            {children ? children(wheelStates.current, bodyRef) : (
                <>
                    <mesh position={[0, -0.3, 0]}>
                        <boxGeometry args={CHASSIS} />
                        <meshStandardMaterial color="crimson" transparent opacity={0.5} />
                    </mesh>
                    {WHEEL_POSITIONS.map((wheelPos, i) => (
                        <group key={i}>
                            <mesh position={[wheelPos.x, wheelPos.y, wheelPos.z]}>
                                <sphereGeometry args={[0.1]} />
                                <meshStandardMaterial color="blue" />
                            </mesh>
                            <group
                                ref={(el) => { wheelRefs.current[i] = el as any }}
                                position={[wheelPos.x, wheelPos.y - SUSPENSION_REST_LENGTH, wheelPos.z]}
                            >
                                <lineSegments rotation={[0, 0, Math.PI / 2]}>
                                    <edgesGeometry args={[new CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.3, 16)]} />
                                    <lineBasicMaterial color="white" />
                                </lineSegments>
                                <mesh>
                                    <sphereGeometry args={[0.1]} />
                                    <meshStandardMaterial color="yellow" />
                                </mesh>
                            </group>
                        </group>
                    ))}
                </>
            )}
        </RigidBody>
    )
}
