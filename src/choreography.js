import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { cam } from './camera.js'
import { reducedMotion } from './quality.js'

gsap.registerPlugin(ScrollTrigger)

const clock = (r) => Math.sqrt(1 - 1 / r)

export function initChoreography() {
  const distEl = document.querySelector('[data-readout="dist"]')
  const clockEl = document.querySelector('[data-readout="clock"]')
  const writeReadouts = () => {
    distEl.textContent = cam.dist.toFixed(1)
    clockEl.textContent = clock(cam.dist).toFixed(3)
  }

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: '#journey',
      start: 'top top',
      end: 'bottom bottom',
      // Reduced motion: the camera follows the scrollbar exactly, with no easing lag.
      scrub: reducedMotion ? true : 1.2,
    },
    onUpdate: writeReadouts,
  })

  const shift = reducedMotion ? 0 : 24

  // Camera: a long, slow approach that tightens and rolls as gravity takes over.
  tl.to(cam, { dist: 21, polar: 81, azim: 16, roll: 2, fov: 1.04, shiftY: 0, exposure: 0.9, duration: 0.55, ease: 'power1.inOut' }, 0)
    .to(cam, { dist: 8.6, polar: 83.2, azim: 38, roll: 9, fov: 1.32, exposure: 0.66, duration: 0.45, ease: 'power2.in' }, 0.55)

  // Fallback still: a slow push-in instead of the camera move.
  tl.fromTo('#stage', { '--push': 0 }, { '--push': 1, duration: 1, ease: 'power1.in' }, 0)

  // Copy: three beats, each fully visible at its resting point.
  tl.to('[data-beat="title"]', { autoAlpha: 0, y: -shift, duration: 0.14 }, 0.08)
    .to('[data-cue]', { autoAlpha: 0, duration: 0.06 }, 0.02)
    .fromTo('.beats', { '--scrim': 0 }, { '--scrim': 1, duration: 0.1 }, 0.28)
    .fromTo('[data-beat="bend"]', { autoAlpha: 0, y: shift }, { autoAlpha: 1, y: 0, duration: 0.1 }, 0.3)
    .to('[data-beat="bend"]', { autoAlpha: 0, y: -shift, duration: 0.1 }, 0.56)
    .fromTo('[data-beat="edge"]', { autoAlpha: 0, y: shift }, { autoAlpha: 1, y: 0, duration: 0.1 }, 0.82)

  writeReadouts()
  return tl
}
