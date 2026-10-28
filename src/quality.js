// Picks a render tier once at startup. The shader cost scales with pixels x steps,
// so each tier caps the drawing-buffer pixel count rather than a fixed DPR.
const params = new URLSearchParams(location.search)

const TIERS = {
  high:   { steps: 220, octaves: 5, pixels: 2_200_000 },
  medium: { steps: 150, octaves: 3, pixels: 900_000 },
  low:    { steps: 100, octaves: 3, pixels: 420_000 },
}

const coarse = matchMedia('(pointer: coarse)').matches
const forced = params.get('quality')

export const tierName = TIERS[forced] ? forced : coarse ? 'medium' : 'high'
export const tier = TIERS[tierName]
// ?fixed disables adaptive resolution (used for deterministic screenshots).
export const adaptive = !params.has('fixed')
// ?still=0.5 renders a few frames at that scroll progress, then stops (software-GPU capture).
export const still = params.has('still') ? Number(params.get('still')) || 0 : null
export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches

export function baseDpr(width, height) {
  const budget = Math.sqrt(tier.pixels / Math.max(1, width * height))
  return Math.max(0.5, Math.min(window.devicePixelRatio || 1, budget))
}

export function hasWebGL2() {
  try {
    return !!document.createElement('canvas').getContext('webgl2')
  } catch {
    return false
  }
}
