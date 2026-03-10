import { useState, useMemo, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import { Sky } from '@react-three/drei'
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
import { useGameStore } from './hooks/useGameStore'

type GameMode = 'menu' | 'level' | 'freeplay'

function Game({ mode }: { mode: 'level' | 'freeplay' }) {
  const input = useMemo(() => new InputManager(), [])
  const [debug, setDebug] = useState(false)
  const toggleDebug = useCallback(() => setDebug((d) => !d), [])
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
        <Physics debug={debug} gravity={[0, -15, 0]}>
          {mode === 'level' ? <Level1 /> : <FreePlayTerrain />}
          <Car input={input} debug={debug} />
        </Physics>
        <GameCamera input={input} />
      </Canvas>
      <HUD />
      <DebugOverlay debug={debug} onToggleDebug={toggleDebug} />
      <TouchControls input={input} />
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
