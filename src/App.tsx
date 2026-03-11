import { useState, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { FreePlayTerrain } from './levels/FreePlayTerrain'
import { CAR_REGISTRY } from './vehicles/registry'
import { GameCamera } from './components/GameCamera'
import { HUD } from './components/HUD'
import { AnalogTouchControls } from './components/AnalogTouchControls'
import { DebugOverlay, FpsTracker } from './components/DebugOverlay'
import { MainMenu } from './components/MainMenu'
import { Level1 } from './levels/Level1'
import { InputManager, useKeyboardInput } from './input'
import { useGameStore } from './hooks/useGameStore'

type GameMode = 'menu' | 'level' | 'freeplay'

function Vehicle({ input }: { input: InputManager }) {
  const vehicleId = useGameStore((s) => s.vehicleId)
  const entry = CAR_REGISTRY.find((c) => c.id === vehicleId) ?? CAR_REGISTRY[0]
  const Comp = entry.component
  return <Comp input={input} />
}

function Game({ mode }: { mode: 'level' | 'freeplay' }) {
  const input = useMemo(() => new InputManager(), [])
  const debug = useGameStore((s) => s.debug)
  const toggleDebug = useGameStore((s) => s.toggleDebug)
  useKeyboardInput(input)

  return (
    <>
      <Canvas shadows>
        <color attach="background" args={['#7ec8e3']} />
        <ambientLight intensity={0.8} />
        <directionalLight
          position={[50, 50, 25]}
          intensity={2}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-far={200}
          shadow-camera-left={-50}
          shadow-camera-right={50}
          shadow-camera-top={50}
          shadow-camera-bottom={-50}
        />
        <hemisphereLight args={['#87CEEB', '#556B2F', 0.6]} />
        <fog attach="fog" args={['#b0d4f1', 200, 500]} />
        <Physics debug={debug} gravity={[0, -30, 0]}>
          {mode === 'level' ? <Level1 /> : <FreePlayTerrain />}
          <Vehicle input={input} />
        </Physics>
        <GameCamera input={input} />
        <FpsTracker />
      </Canvas>
      <HUD />
      <DebugOverlay debug={debug} onToggleDebug={toggleDebug} />
      <AnalogTouchControls input={input} />
    </>
  )
}

export default function App() {
  const [mode, setMode] = useState<GameMode>('menu')
  const trackResetCount = useGameStore((s) => s.trackResetCount)

  if (mode === 'menu') {
    return (
      <MainMenu
        onStart={() => setMode('level')}
        onFreePlay={() => setMode('freeplay')}
      />
    )
  }

  return <Game key={trackResetCount} mode={mode} />
}
