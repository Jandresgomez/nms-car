import { useFrame, useThree } from '@react-three/fiber'
import { useRef, useEffect } from 'react'
import { Vector3, Quaternion, Euler, Spherical } from 'three'
import type { MutableRefObject } from 'react'
import type { TouchControlState } from '../hooks/useTouchControls'

const BEHIND = new Vector3(0, 6, 12)
const LOOK_AHEAD = new Vector3(0, 1, -10)
const SNAP_SPEED = 3 // ~1 second to snap back (lerp factor per second)

interface GameCameraProps {
  touchControls: MutableRefObject<TouchControlState>
}

export function GameCamera({ touchControls }: GameCameraProps) {
  const { scene, gl } = useThree()
  const smoothPos = useRef(new Vector3())
  const smoothLook = useRef(new Vector3())

  // Camera orbit offset from touch
  const orbitYaw = useRef(0)
  const orbitPitch = useRef(0)
  const isDragging = useRef(false)
  const lastTouch = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const canvas = gl.domElement

    const onTouchStart = (e: TouchEvent) => {
      // Only use touches on the right half of screen for camera
      const touch = e.changedTouches[0]
      if (touch.clientX > window.innerWidth * 0.35) {
        isDragging.current = true
        lastTouch.current = { x: touch.clientX, y: touch.clientY }
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging.current) return
      const touch = e.changedTouches[0]
      const dx = touch.clientX - lastTouch.current.x
      const dy = touch.clientY - lastTouch.current.y
      orbitYaw.current -= dx * 0.005
      orbitPitch.current = Math.max(-0.5, Math.min(0.5, orbitPitch.current - dy * 0.003))
      lastTouch.current = { x: touch.clientX, y: touch.clientY }
    }

    const onTouchEnd = () => {
      isDragging.current = false
    }

    canvas.addEventListener('touchstart', onTouchStart, { passive: true })
    canvas.addEventListener('touchmove', onTouchMove, { passive: true })
    canvas.addEventListener('touchend', onTouchEnd, { passive: true })
    canvas.addEventListener('touchcancel', onTouchEnd, { passive: true })

    // Mouse support for desktop panning
    const onMouseDown = (e: MouseEvent) => {
      isDragging.current = true
      lastTouch.current = { x: e.clientX, y: e.clientY }
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      const dx = e.clientX - lastTouch.current.x
      const dy = e.clientY - lastTouch.current.y
      orbitYaw.current -= dx * 0.005
      orbitPitch.current = Math.max(-0.5, Math.min(0.5, orbitPitch.current - dy * 0.003))
      lastTouch.current = { x: e.clientX, y: e.clientY }
    }

    const onMouseUp = () => {
      isDragging.current = false
    }

    canvas.addEventListener('mousedown', onMouseDown)
    canvas.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('mouseup', onMouseUp)
    canvas.addEventListener('mouseleave', onMouseUp)

    return () => {
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchmove', onTouchMove)
      canvas.removeEventListener('touchend', onTouchEnd)
      canvas.removeEventListener('touchcancel', onTouchEnd)
      canvas.removeEventListener('mousedown', onMouseDown)
      canvas.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('mouseup', onMouseUp)
      canvas.removeEventListener('mouseleave', onMouseUp)
    }
  }, [gl])

  useFrame((state, delta) => {
    const car = scene.getObjectByName('car')
    if (!car) return

    const tc = touchControls.current
    const driving = tc.forward || tc.backward || tc.left || tc.right

    // Snap orbit back to zero when driving
    if (driving) {
      const snapFactor = 1 - Math.exp(-SNAP_SPEED * delta)
      orbitYaw.current *= (1 - snapFactor)
      orbitPitch.current *= (1 - snapFactor)
    }

    const carPos = new Vector3()
    car.getWorldPosition(carPos)

    const carQuat = new Quaternion()
    car.getWorldQuaternion(carQuat)

    // Apply orbit offset to the base camera quaternion
    const orbitQuat = new Quaternion().setFromEuler(
      new Euler(orbitPitch.current, orbitYaw.current, 0, 'YXZ')
    )
    const combinedQuat = carQuat.clone().multiply(orbitQuat)

    const desiredPos = BEHIND.clone().applyQuaternion(combinedQuat).add(carPos)
    const desiredLook = LOOK_AHEAD.clone().applyQuaternion(combinedQuat).add(carPos)

    smoothPos.current.lerp(desiredPos, 0.08)
    smoothLook.current.lerp(desiredLook, 0.12)

    state.camera.position.copy(smoothPos.current)
    state.camera.lookAt(smoothLook.current)
  })

  return null
}
