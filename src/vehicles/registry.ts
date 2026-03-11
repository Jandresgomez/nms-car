import type { ComponentType } from 'react'
import type { InputManager } from '../input/InputManager'
import { FamilyCar } from './FamilyCar'
import { HotRod } from './HotRod'
import { GreenCar } from './GreenCar'

export interface CarEntry {
    id: string
    name: string
    emoji: string
    component: ComponentType<{ input: InputManager }>
}

export const CAR_REGISTRY: CarEntry[] = [
    { id: 'car', name: 'Family Car', emoji: '🚗', component: FamilyCar },
    { id: 'hotrod', name: 'Hot Rod', emoji: '🏎️', component: HotRod },
    { id: 'green', name: 'Green Car', emoji: '🟢', component: GreenCar },
]
