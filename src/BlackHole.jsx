import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { vertexShader, fragmentShader } from './shaders/blackhole.js'
import { cam, baseTanHalf } from './camera.js'
import { tier, adaptive, reducedMotion, baseDpr, still } from './quality.js'

const DEG = Math.PI / 180
const up = new THREE.Vector3(0, 1, 0)
const pos = new THREE.Vector3()
const fwd = new THREE.Vector3()
const right = new THREE.Vector3()
const camUp = new THREE.Vector3()
const size = new THREE.Vector2()

// A frozen moment of the disk for reduced motion, chosen for clear filament structure.
const STILL_TIME = 7.3

export default function BlackHole() {
  const material = useRef()
  const { setDpr } = useThree()
  const perf = useRef({ t: 0, frames: 0, warm: 0, level: 0 })

  const uniforms = useMemo(
    () => ({
      uRes: { value: new THREE.Vector2(1, 1) },
      uTime: { value: STILL_TIME },
      uCamPos: { value: new THREE.Vector3() },
      uRight: { value: new THREE.Vector3() },
      uUp: { value: new THREE.Vector3() },
      uFwd: { value: new THREE.Vector3() },
      uTanHalf: { value: 0.3 },
      uSteps: { value: tier.steps },
      uPixelAngle: { value: 0.001 },
      uExposure: { value: 1 },
      uGrainSeed: { value: 0 },
      uShift: { value: new THREE.Vector2() },
    }),
    [],
  )

  useFrame((state, delta) => {
    const u = uniforms
    const dt = Math.min(delta, 0.05)
    if (!reducedMotion) {
      u.uTime.value += dt
      u.uGrainSeed.value = (u.uGrainSeed.value + 1) % 997
    }

    // Spherical camera around the hole, looking at its centre, with roll.
    const th = cam.polar * DEG
    const ph = cam.azim * DEG
    pos.set(Math.sin(th) * Math.sin(ph), Math.cos(th), Math.sin(th) * Math.cos(ph)).multiplyScalar(cam.dist)
    fwd.copy(pos).negate().normalize()
    right.crossVectors(fwd, up).normalize()
    camUp.crossVectors(right, fwd)
    const rl = cam.roll * DEG
    const c = Math.cos(rl), s = Math.sin(rl)
    u.uRight.value.copy(right).multiplyScalar(c).addScaledVector(camUp, s)
    u.uUp.value.copy(camUp).multiplyScalar(c).addScaledVector(right, -s)
    u.uFwd.value.copy(fwd)
    u.uCamPos.value.copy(pos)

    state.gl.getDrawingBufferSize(size)
    u.uRes.value.copy(size)
    const tanHalf = baseTanHalf(size.x / size.y) * cam.fov
    u.uTanHalf.value = tanHalf
    u.uPixelAngle.value = (2 * tanHalf) / Math.min(size.x, size.y)
    u.uExposure.value = cam.exposure
    u.uShift.value.set(cam.shiftX, cam.shiftY)

    if (still !== null) {
      if (++perf.current.frames === 3) {
        state.setFrameloop('never')
        window.__frameReady = true
      }
      return
    }

    // Adaptive resolution: after warm-up, step down if frames run long. Never steps back up,
    // so the image doesn't pulse between sharp and soft.
    if (!adaptive) return
    const p = perf.current
    p.warm += delta
    if (p.warm < 2) return
    p.t += delta
    p.frames++
    if (p.t > 1.5) {
      const avg = p.t / p.frames
      if (avg > 1 / 42 && p.level < 3) {
        p.level++
        const scale = [1, 0.78, 0.62, 0.5][p.level]
        setDpr(baseDpr(state.size.width, state.size.height) * scale)
      }
      p.t = 0
      p.frames = 0
    }
  })

  return (
    <mesh frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={material}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        defines={{ OCTAVES: tier.octaves }}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  )
}
