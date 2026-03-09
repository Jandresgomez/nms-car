import { useState, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { FreePlayTerrain } from './components/FreePlayTerrain'
import { Car } from './vehicles/Car'
import { GameCamera } from './components/GameCamera'
import { HUD } from './components/HUD'
import { TouchControls } from './components/TouchControls'
import { DebugOverlay } from './components/DebugOverlay'
import { MainMenu } from './components/MainMenu'
import { Level1 } from './levels/Level1'
import { InputManager, useKeyboardInput } from './input'

type GameMode = 'menu' | 'level' | 'freeplay'

function Game({ mode }: { mode: 'level' | 'freeplay' }) {
  const input = useMemo(() => new InputManager(), [])
  useKeyboardInput(input)

  return (
    <>
      <Canvas shadows>
        <color attach="background" args={['#87CEEB']} />
        <ambientLight intensity={0.5} />
        <directionalLight
          position={[50, 50, 25]}
          intensity={1.5}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-far={200}
          shadow-camera-left={-50}
          shadow-camera-right={50}
          shadow-camera-top={50}
          shadow-camera-bottom={-50}
        />
        <fog attach="fog" args={['#87CEEB', 80, 150]} />
        <Physics gravity={[0, -60, 0]}>
          {mode === 'level' ? <Level1 /> : <FreePlayTerrain />}
          <Car input={input} />
        </Physics>
        <GameCamera input={input} />
      </Canvas>
      <HUD />
      <DebugOverlay />
      <TouchControls input={input} />
    </>
  )
}

export default function App() {
  const [mode, setMode] = useState<GameMode>('menu')

  if (mode === 'menu') {
    return (
      <MainMenu
        onStart={() => setMode('level')}
        onFreePlay={() => setMode('freeplay')}
      />
    )
  }

  return <Game mode={mode} />
}
