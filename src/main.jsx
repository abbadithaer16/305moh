import { createRoot } from 'react-dom/client'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import BlackHole from './BlackHole.jsx'
import { initChoreography } from './choreography.js'
import { cam } from './camera.js'
import { baseDpr, hasWebGL2, tierName, still } from './quality.js'
import posterWide from './assets/poster-wide.jpg'
import posterTall from './assets/poster-tall.jpg'
import './styles.css'

const stage = document.getElementById('stage')
document.documentElement.dataset.tier = tierName
stage.style.setProperty('--poster-wide', `url(${posterWide})`)
stage.style.setProperty('--poster-tall', `url(${posterTall})`)

// Without WebGL2 (or if the GPU drops the context) the page shows a still from the
// real render and the scroll becomes a slow push-in on it.
const useFallback = () => stage.classList.add('stage--fallback')

if (hasWebGL2()) {
  createRoot(stage).render(
    <Canvas
      dpr={baseDpr(innerWidth, innerHeight)}
      gl={{ antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NoToneMapping
        gl.setClearColor('#030304')
        gl.domElement.addEventListener('webglcontextlost', useFallback)
      }}
    >
      <BlackHole />
    </Canvas>,
  )
} else {
  useFallback()
}

const choreo = initChoreography()
if (still !== null) {
  choreo.tl.scrollTrigger.disable(false)
  choreo.tl.progress(still)
}
// Handle for the automated scroll tests.
if (new URLSearchParams(location.search).has('debug')) window.__eh = { choreo, cam }
