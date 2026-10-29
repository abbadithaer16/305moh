// Shared camera state. GSAP writes it from scroll; the render loop reads it every frame.
// Distances are in Schwarzschild radii (rs); angles in degrees.
export const cam = {
  dist: 36,
  polar: 84.5, // angle from the disk's axis; 90 = exactly edge-on
  azim: 0,
  roll: -3,
  fov: 1,      // multiplier on the base field of view
  exposure: 1.05,
  shiftX: 0,   // lens shift, in short-side units: moves the hole across the frame
  shiftY: 0.2, // pushes the hole down the frame under the opening title
}

// Base half-FOV across the short side of the screen. Portrait screens get a wider
// horizontal view so the full disk still spans the frame in 9:16.
export function baseTanHalf(aspect) {
  const deg = aspect >= 1 ? 17 : 27
  return Math.tan((deg * Math.PI) / 180)
}
