import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { cam } from './camera.js'

gsap.registerPlugin(ScrollTrigger)

const clock = (r) => Math.sqrt(1 - 1 / r)

// Final hero frame per orientation, nearly edge-on and just outside the disk's outer rim
// so the band below the hole stays dark. Portrait (9:16): the hole sits in the upper half
// with the closing line below it. Landscape: the hole holds the right third and the line
// takes the dark upper-left.
const HERO = {
  portrait:  { dist: 16, fov: 1.25, shiftX: 0, shiftY: -0.42 },
  landscape: { dist: 17, fov: 1.35, shiftX: -0.6, shiftY: 0 },
}

export function initChoreography() {
  const distEl = document.querySelector('[data-readout="dist"]')
  const clockEl = document.querySelector('[data-readout="clock"]')
  const writeReadouts = () => {
    distEl.textContent = cam.dist.toFixed(1)
    clockEl.textContent = clock(cam.dist).toFixed(3)
  }

  const api = { tl: null }
  const mm = gsap.matchMedia()

  mm.add(
    // `all` keeps the callback running when neither condition matches (landscape, motion on).
    { all: 'all', portrait: '(max-aspect-ratio: 1/1)', reduce: '(prefers-reduced-motion: reduce)' },
    ({ conditions }) => {
      const hero = conditions.portrait ? HERO.portrait : HERO.landscape
      const shift = conditions.reduce ? 0 : 24

      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: '#journey',
          start: 'top top',
          end: 'bottom bottom',
          // Reduced motion: the camera follows the scrollbar exactly, with no easing lag.
          scrub: conditions.reduce ? true : 1.2,
        },
        onUpdate: writeReadouts,
      })

      // Camera, in three moves rather than one zoom:
      // 1. orbit and rise above the disk plane while still far out, so the lensed arcs
      //    reshape and the star field slides past the hole;
      // 2. dive to almost edge-on and close in while the lens widens, countering the roll;
      // 3. hold on the hero frame with a slow drift under the closing line.
      tl.to(cam, { dist: 30, polar: 79, azim: 40, roll: 4, shiftY: 0.17, exposure: 0.98, duration: 0.34, ease: 'power1.inOut' }, 0)
        .to(cam, { dist: hero.dist, polar: 88.6, azim: 80, roll: -3, fov: hero.fov, shiftX: hero.shiftX, shiftY: hero.shiftY, exposure: 0.88, duration: 0.5, ease: 'power2.inOut' }, 0.34)
        .to(cam, { dist: hero.dist - 0.5, azim: 84, roll: -3.6, duration: 0.16 }, 0.84)

      // Fallback still: a slow push-in instead of the camera move.
      tl.fromTo('#stage', { '--push': 0 }, { '--push': 1, duration: 1, ease: 'power1.in' }, 0)

      // Copy: each line appears only while the frame leaves it clear space.
      tl.to('[data-cue]', { autoAlpha: 0, duration: 0.05 }, 0.02)
        .to('[data-beat="title"]', { autoAlpha: 0, y: -shift, duration: 0.1 }, 0.06)
        .fromTo('[data-beat="bend"]', { autoAlpha: 0, y: shift }, { autoAlpha: 1, y: 0, duration: 0.06 }, 0.15)
        .to('[data-beat="bend"]', { autoAlpha: 0, y: -shift, duration: 0.06 }, 0.3)
        .fromTo('[data-beat="edge"]', { autoAlpha: 0, y: shift }, { autoAlpha: 1, y: 0, duration: 0.07 }, 0.85)

      api.tl = tl
      writeReadouts()
    },
  )

  return api
}
