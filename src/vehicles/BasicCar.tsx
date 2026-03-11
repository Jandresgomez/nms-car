import { CuboidCollider, RapierRigidBody, RigidBody, useRapier } from "@react-three/rapier"
import type { InputManager } from "../input"
import { useFrame } from "@react-three/fiber"
import { useRef } from "react"
import { CylinderGeometry, Mesh, Quaternion, Vector3 } from "three"

interface BasicCarProps {
    input: InputManager
    debug?: boolean
}

// Rigid body config
const CHASSIS_SCALE = 1;
const CHASSIS_PROPORTIONS = [3.5, 0.6, 6.5] as const
const CHASSIS = CHASSIS_PROPORTIONS.map(c => c * CHASSIS_SCALE) as [number, number, number]
const CHASSIS_HALF = CHASSIS.map(v => v / 2) as [number, number, number]
const CHASSIS_MASS = 200;

// Suspension logic
const SUSPENSION_REST_LENGTH = 0.6;
const SUSPENSION_STIFFNESS = 600;
const SUSPENSION_DAMPING = 10;
const WHEEL_RADIUS = 0.8;

// Movement logic
const DRIVE_FORCE = 900;
const MAX_STEER_ANGLE = Math.PI / 8;
const FRONT_LATERAL_GRIP = 0.8;
const REAR_LATERAL_GRIP = 0.5;
const ROLLING_RESISTANCE = 4;
const FRONT_DRIVE_RATIO = 0.75;  // 0 = RWD, 0.5 = even AWD, 1 = FWD
const TURBO_MULTIPLIER = 1.3;
const AIR_STEER_RATE = 750;  // radians/sec of torque while airborne

// Balance size but make sure raycasts are wiwthin the bounding rect otherwise may hit edges randomly and cause random forces
const X_D = (CHASSIS[0] / 2) * 0.95;
const Y_D = (CHASSIS[1] / 2) * 0.95;
const Z_D = (CHASSIS[2] / 2) - WHEEL_RADIUS;
const WHEEL_POSITIONS = [
    { x: -X_D, y: -Y_D, z: -Z_D },
    { x: X_D, y: -Y_D, z: -Z_D },
    { x: -X_D, y: -Y_D, z: Z_D },
    { x: X_D, y: -Y_D, z: Z_D },
]

export const BasicCar = ({ input, debug }: BasicCarProps) => {
    const bodyRef = useRef<RapierRigidBody>(null)
    const { world, rapier } = useRapier()

    // Store previous compression per wheel for damping velocity
    const prevCompression = useRef([0, 0, 0, 0])

    // Track wheel position based on car rotation
    const wheelRefs = useRef<(Mesh | null)[]>([null, null, null, null])

    useFrame((_, delta) => {
        const body = bodyRef.current
        if (!body) return

        // Clamp delta to avoid physics explosion on tab-switch
        const dt = Math.min(delta, 0.05)

        const bodyPos = body.translation()
        const bodyRot = body.rotation()
        const quat = new Quaternion(bodyRot.x, bodyRot.y, bodyRot.z, bodyRot.w)

        // These must come AFTER quat
        const downDir = new Vector3(0, -1, 0).applyQuaternion(quat)
        const forwardDir = new Vector3(0, 0, -1).applyQuaternion(quat)
        const upDir = new Vector3(0, 1, 0).applyQuaternion(quat)

        const { throttle, steer } = input.getAnalog()
        const { drift: turbo } = input.getState()
        const steerAngle = steer * MAX_STEER_ANGLE

        let groundedWheels = 0

        WHEEL_POSITIONS.forEach((wp, i) => {
            // if (i >= 2) return;
            // Wheel mount point in world space
            const localPos = new Vector3(wp.x, wp.y, wp.z)
            localPos.applyQuaternion(quat)
            const origin = new Vector3(bodyPos.x + localPos.x, bodyPos.y + localPos.y, bodyPos.z + localPos.z)

            // Raycast downward from wheel mount
            const ray = new rapier.Ray(origin, downDir)
            const EXCLUDE_SENSORS = 8
            const hit = world.castRay(ray, SUSPENSION_REST_LENGTH + WHEEL_RADIUS, true, EXCLUDE_SENSORS, undefined, undefined, body)

            if (hit) {
                const hitDist = hit.timeOfImpact
                const compression = SUSPENSION_REST_LENGTH + WHEEL_RADIUS - hitDist

                if (compression > 0) {
                    groundedWheels++
                    // Update wheel positions
                    const wheelY = wp.y - (SUSPENSION_REST_LENGTH - compression)
                    if (wheelRefs.current[i]) {
                        wheelRefs.current[i]!.position.y = wheelY
                        if (i < 2) wheelRefs.current[i]!.rotation.y = steerAngle
                    }

                    // Drive force
                    // Front wheels steer, rear wheels go straight
                    const wheelForward = i < 2
                        ? forwardDir.clone().applyAxisAngle(upDir, steerAngle)
                        : forwardDir

                    if (throttle !== 0) {
                        const driveAmount = i < 2
                            ? DRIVE_FORCE * FRONT_DRIVE_RATIO / 2
                            : DRIVE_FORCE * (1 - FRONT_DRIVE_RATIO) / 2
                        const f = wheelForward.clone().multiplyScalar(throttle * driveAmount * (turbo ? TURBO_MULTIPLIER : 1) * dt)
                        body.applyImpulseAtPoint(
                            { x: f.x, y: f.y, z: f.z },
                            { x: origin.x, y: origin.y, z: origin.z },
                            true
                        )
                    }

                    // Friction forces
                    const velAtWheel = body.velocityAtPoint({ x: origin.x, y: origin.y, z: origin.z })
                    const vel = new Vector3(velAtWheel.x, velAtWheel.y, velAtWheel.z)

                    // Lateral grip - resist sideways sliding per wheel direction
                    const wheelRight = wheelForward.clone().cross(upDir).normalize()
                    const lateralSpeed = wheelRight.dot(vel)
                    const grip = i < 2
                        ? (FRONT_LATERAL_GRIP)
                        : (REAR_LATERAL_GRIP)
                    const lateralImpulse = wheelRight.clone().multiplyScalar(-lateralSpeed * CHASSIS_MASS * grip * dt / 4)
                    body.applyImpulseAtPoint(
                        { x: lateralImpulse.x, y: lateralImpulse.y, z: lateralImpulse.z },
                        { x: origin.x, y: origin.y, z: origin.z },
                        true
                    )

                    // Rolling resistance - opposes motion along wheel direction
                    const forwardSpeed = wheelForward.dot(vel)
                    const rollingImpulse = wheelForward.clone().multiplyScalar(-forwardSpeed * ROLLING_RESISTANCE * dt)
                    body.applyImpulseAtPoint(
                        { x: rollingImpulse.x, y: rollingImpulse.y, z: rollingImpulse.z },
                        { x: origin.x, y: origin.y, z: origin.z },
                        true
                    )

                    // Damping: rate of compression change
                    const compressionVel = (compression - prevCompression.current[i]) / dt
                    prevCompression.current[i] = compression

                    const forceMag = SUSPENSION_STIFFNESS * compression + SUSPENSION_DAMPING * compressionVel

                    // Apply force upward (opposite of downDir) at the wheel point
                    const suspForce = downDir.clone().negate().multiplyScalar(Math.max(forceMag, 0))
                    body.applyImpulseAtPoint(
                        { x: suspForce.x * dt, y: suspForce.y * dt, z: suspForce.z * dt },
                        { x: origin.x, y: origin.y, z: origin.z },
                        true
                    )
                } else {
                    // Update wheel positions
                    if (wheelRefs.current[i]) {
                        wheelRefs.current[i]!.position.y = wp.y - SUSPENSION_REST_LENGTH
                    }

                    prevCompression.current[i] = 0
                }
            } else {
                // Update wheel positions
                if (wheelRefs.current[i]) {
                    wheelRefs.current[i]!.position.y = wp.y - SUSPENSION_REST_LENGTH
                }

                prevCompression.current[i] = 0
            }
        })

        // Air steering — rotate chassis when fully airborne
        if (groundedWheels === 0 && steer !== 0) {
            const yawTorque = upDir.clone().multiplyScalar(steer * AIR_STEER_RATE * dt)
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
            position={[0, 4, 0]}
            ccd
            name="car"
        >
            <CuboidCollider args={CHASSIS_HALF} position={[0, -0.3, 0]} friction={0.8} />
            <mesh position={[0, -0.3, 0]}>
                <boxGeometry args={CHASSIS} />
                <meshStandardMaterial color="crimson" transparent opacity={debug ? 0.5 : 1} />
            </mesh>
            {WHEEL_POSITIONS.map((wheelPos, i) => (
                <group key={i}>
                    {/* Suspension mount point - fixed to chassis */}
                    <mesh position={[wheelPos.x, wheelPos.y, wheelPos.z]}>
                        <sphereGeometry args={[0.1]} />
                        <meshStandardMaterial color="blue" />
                    </mesh>

                    {/* Wheel group - moves with suspension */}
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
        </RigidBody>
    )
}