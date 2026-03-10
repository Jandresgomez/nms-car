import { useFrame, useThree } from '@react-three/fiber'
import { useRef, useEffect } from 'react'
import { Vector3, Quaternion, Euler } from 'three'
import type { InputManager } from '../input/InputManager'

const BEHIND = new Vector3(0, 6, 12)
const LOOK_AHEAD = new Vector3(0, 1, -10)
const SNAP_SPEED = 3
const MIN_ZOOM = 0.4
const MAX_ZOOM = 2.5
const DEFAULT_ZOOM = 1

interface GameCameraProps {
  input: InputManager
}

export function GameCamera({ input }: GameCameraProps) {
  const { scene, gl } = useThree()
  const smoothPos = useRef(new Vector3())
  const smoothLook = useRef(new Vector3())

  const orbitYaw = useRef(0)
  const orbitPitch = useRef(0)
  const zoom = useRef(DEFAULT_ZOOM)
  const isDragging = useRef(false)
  const lastTouch = useRef({ x: 0, y: 0 })
  const pinchDist = useRef(0)

  useEffect(() => {
    const canvas = gl.domElement

    const getTouchDist = (e: TouchEvent) => {
      const [a, b] = [e.touches[0], e.touches[1]]
      return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
    }

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        pinchDist.current = getTouchDist(e)
        isDragging.current = false
        return
      }
      const touch = e.changedTouches[0]
      if (touch.clientX > window.innerWidth * 0.35) {
        isDragging.current = true
        lastTouch.current = { x: touch.clientX, y: touch.clientY }
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dist = getTouchDist(e)
        const scale = pinchDist.current / dist
        zoom.current = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom.current * scale))
        pinchDist.current = dist
        return
      }
      if (!isDragging.current) return
      const touch = e.changedTouches[0]
      const dx = touch.clientX - lastTouch.current.x
      const dy = touch.clientY - lastTouch.current.y
      orbitYaw.current -= dx * 0.005
      orbitPitch.current = Math.max(-0.5, Math.min(0.5, orbitPitch.current - dy * 0.003))
      lastTouch.current = { x: touch.clientX, y: touch.clientY }
    }

    const onTouchEnd = () => { isDragging.current = false }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      zoom.current = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom.current + e.deltaY * 0.002))
    }

    canvas.addEventListener('touchstart', onTouchStart, { passive: true })
    canvas.addEventListener('touchmove', onTouchMove, { passive: true })
    canvas.addEventListener('touchend', onTouchEnd, { passive: true })
    canvas.addEventListener('touchcancel', onTouchEnd, { passive: true })
    canvas.addEventListener('wheel', onWheel, { passive: false })

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
    const onMouseUp = () => { isDragging.current = false }

    canvas.addEventListener('mousedown', onMouseDown)
    canvas.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('mouseup', onMouseUp)
    canvas.addEventListener('mouseleave', onMouseUp)

    return () => {
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchmove', onTouchMove)
      canvas.removeEventListener('touchend', onTouchEnd)
      canvas.removeEventListener('touchcancel', onTouchEnd)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('mousedown', onMouseDown)
      canvas.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('mouseup', onMouseUp)
      canvas.removeEventListener('mouseleave', onMouseUp)
    }
  }, [gl])

  useFrame((state, delta) => {
    const car = scene.getObjectByName('car')
    if (!car) return

    const actions = input.getState()
    const driving = actions.forward || actions.backward || actions.left || actions.right

    if (driving) {
      const snapFactor = 1 - Math.exp(-SNAP_SPEED * delta)
      orbitYaw.current *= (1 - snapFactor)
      orbitPitch.current *= (1 - snapFactor)
      zoom.current += (DEFAULT_ZOOM - zoom.current) * snapFactor
    }

    const carPos = new Vector3()
    car.getWorldPosition(carPos)

    const carQuat = new Quaternion()
    car.getWorldQuaternion(carQuat)

    // Extract yaw only — ignore pitch/roll so camera doesn't flip with the car
    const euler = new Euler().setFromQuaternion(carQuat, 'YXZ')
    const yawOnlyQuat = new Quaternion().setFromEuler(new Euler(0, euler.y, 0, 'YXZ'))

    const orbitQuat = new Quaternion().setFromEuler(
      new Euler(orbitPitch.current, orbitYaw.current, 0, 'YXZ')
    )
    const combinedQuat = yawOnlyQuat.multiply(orbitQuat)

    const desiredPos = BEHIND.clone().multiplyScalar(zoom.current).applyQuaternion(combinedQuat).add(carPos)
    const desiredLook = LOOK_AHEAD.clone().applyQuaternion(combinedQuat).add(carPos)

    smoothPos.current.lerp(desiredPos, 0.08)
    smoothLook.current.lerp(desiredLook, 0.12)

    state.camera.position.copy(smoothPos.current)
    state.camera.lookAt(smoothLook.current)
  })

  return null
}
