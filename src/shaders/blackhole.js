// Full-screen ray tracer for a Schwarzschild black hole (units: Schwarzschild radius rs = 1).
// Photon paths are integrated with the standard pseudo-Newtonian geodesic form
//   a = -1.5 * h^2 * p / r^5   (h = |p x v|, conserved)
// which reproduces the photon sphere (r = 1.5), the shadow and multiple disk images.

export const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

export const fragmentShader = /* glsl */ `
precision highp float;

uniform vec2  uRes;
uniform float uTime;
uniform vec3  uCamPos;
uniform vec3  uRight;
uniform vec3  uUp;
uniform vec3  uFwd;
uniform float uTanHalf;     // tan(fov/2) across the short side of the screen
uniform int   uSteps;
uniform float uPixelAngle;  // radians per pixel, keeps stars pixel-sharp at any resolution
uniform float uExposure;
uniform float uGrainSeed;
uniform vec2  uShift;      // lens shift in short-side units, for composition

#ifndef OCTAVES
#define OCTAVES 4
#endif
#define MAX_STEPS 260

const float RIN  = 2.6;   // inner disk edge, just inside the ISCO (3 rs)
const float ROUT = 15.0;

// ---------------------------------------------------------------- noise
float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}

float vnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash13(i), hash13(i + vec3(1, 0, 0)), f.x),
        mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), f.x),
        mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}

float fbm(vec3 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < OCTAVES; i++) {
    s += a * vnoise(p);
    p = p * 2.03 + vec3(1.7, 9.2, 3.1);
    a *= 0.5;
  }
  return s;
}

// ---------------------------------------------------------------- accretion disk
// Novikov-Thorne-like temperature profile, normalised so the peak is ~1.
float diskTemp(float r) {
  float x = RIN / max(r, RIN);
  return pow(x, 0.75) * pow(max(1.0 - 0.985 * sqrt(x), 0.0), 0.25) / 0.49;
}

// Emission colour by normalised temperature: ember -> amber -> pale gold -> white-hot.
vec3 diskRamp(float t) {
  vec3 c = mix(vec3(0.16, 0.025, 0.006), vec3(0.95, 0.27, 0.04), smoothstep(0.0, 0.45, t));
  c = mix(c, vec3(1.0, 0.58, 0.22), smoothstep(0.42, 0.82, t));
  c = mix(c, vec3(1.0, 0.86, 0.66), smoothstep(0.85, 1.15, t));
  return c;
}

float diskNoise(float r, float a, float seed) {
  vec2 cs = vec2(cos(a), sin(a));
  vec3 off = vec3(seed * 7.13, seed * 3.71, seed * 1.37);
  float lr = log(r);
  float streak = fbm(vec3(lr * 11.0, cs * 1.8) + off);            // long orbital filaments
  float clump  = fbm(vec3(cs * r * 0.55, lr * 2.0) + off.yzx + 4.0);
  return streak * 0.75 + clump * 0.45;
}

// Returns premultiplied-ready colour and coverage of the disk at a plane crossing.
vec4 disk(vec3 p, vec3 dir) {
  float r = length(p.xz);
  if (r < RIN - 0.3 || r > ROUT) return vec4(0.0);
  float ang = atan(p.z, p.x);

  // Keplerian shear with a two-phase crossfade so the texture never winds up.
  float om = 1.0 / (r * sqrt(r));
  float T = uTime * 0.9;
  const float P = 10.0;
  float c1 = T / P;
  float ph1 = fract(c1), ph2 = fract(c1 + 0.5);
  float w1 = 1.0 - abs(2.0 * ph1 - 1.0);
  float n1 = diskNoise(r, ang - om * ph1 * P * 2.5, floor(c1));
  float n2 = diskNoise(r, ang - om * ph2 * P * 2.5, floor(c1 + 0.5) + 0.5);
  float n = mix(n2, n1, w1);

  float edgeIn  = smoothstep(RIN - 0.3, RIN + 0.55, r);
  float edgeOut = 1.0 - smoothstep(ROUT * 0.42, ROUT, r);
  float dens = edgeIn * edgeOut * smoothstep(0.3, 0.9, n);

  // Grazing views see a longer path through the disk.
  float mu = max(abs(dir.y), 0.05);
  float alpha = 1.0 - pow(1.0 - clamp(dens * 0.9, 0.0, 0.96), 0.45 / mu);

  // Relativistic Doppler beaming + gravitational redshift, applied with restraint.
  float beta = min(sqrt(0.5 / (r - 1.0)), 0.6);
  vec3 vdir = vec3(-p.z, 0.0, p.x) / r;
  float gam = inversesqrt(1.0 - beta * beta);
  float D = 1.0 / (gam * (1.0 - beta * dot(vdir, -dir)));
  float g = mix(1.0, D * sqrt(1.0 - 1.0 / r), 0.65);

  float t = diskTemp(r);
  float tc = t * mix(1.0, g, 0.55);
  vec3 col = diskRamp(clamp(tc, 0.0, 1.2)) * (0.1 + 1.15 * pow(t, 1.8)) * pow(g, 2.2);
  col *= 0.5 + 0.95 * n;
  return vec4(col, clamp(alpha, 0.0, 0.985));
}

// ---------------------------------------------------------------- sky
// Stars are drawn as ~1px points in screen space: the lens Jacobian (dvx, dvy) maps the
// star's offset on the sky back to a pixel offset, so magnified regions don't smear them
// into streaks. Their brightness follows the lens magnification instead.
vec3 starLayer(vec3 d, vec3 dvx, vec3 dvy, float mag, float scale, float thresh, float seed, float gain) {
  vec3 p = d * scale;
  vec3 id = floor(p);
  float h = hash13(id + seed);
  if (h < thresh) return vec3(0.0);
  vec3 sp = vec3(hash13(id + seed + 1.1), hash13(id + seed + 2.3), hash13(id + seed + 3.7)) * 0.7 + 0.15;
  vec3 e = normalize(id + sp) - d;
  float a = dot(dvx, dvx), b = dot(dvx, dvy), c = dot(dvy, dvy);
  float det = a * c - b * b;
  if (det < 1e-14) return vec3(0.0);
  vec2 rhs = vec2(dot(dvx, e), dot(dvy, e));
  vec2 px = vec2(c * rhs.x - b * rhs.y, a * rhs.y - b * rhs.x) / det;
  float d2 = dot(px, px);
  float m = (h - thresh) / (1.0 - thresh);
  float lum = (pow(m, 7.0) * 6.0 + 0.06) * gain * mag;
  float core = exp(-d2 / (2.0 * 0.55 * 0.55));
  float halo = exp(-sqrt(d2) / 1.6) * 0.06 * lum * smoothstep(0.7, 1.0, m);
  float k = hash13(id + seed + 5.5);
  vec3 tint = k < 0.14 ? vec3(0.68, 0.78, 1.0)
            : k < 0.72 ? vec3(1.0, 0.97, 0.93)
            : k < 0.92 ? vec3(1.0, 0.86, 0.68)
            :            vec3(1.0, 0.68, 0.48);
  return tint * (core * lum + halo);
}

vec3 sky(vec3 d, vec3 dvx, vec3 dvy) {
  // Magnification = unlensed pixel footprint / lensed footprint on the sky.
  float area = length(cross(dvx, dvy));
  float mag = clamp(uPixelAngle * uPixelAngle / max(area, 1e-12), 0.0, 5.0);
  vec3 pole = normalize(vec3(0.42, 1.0, -0.3));
  float lat = dot(d, pole);
  float band = exp(-lat * lat / 0.03);
  vec3 col = vec3(0.0028, 0.0032, 0.0048);
  float dust = fbm(d * 4.5 + 3.0);
  col += vec3(0.030, 0.025, 0.024) * band * smoothstep(0.3, 0.8, dust);
  col *= 1.0 - 0.75 * band * smoothstep(0.5, 0.72, fbm(d * 10.0 + 11.0));
  col += starLayer(d, dvx, dvy, mag, 60.0, 0.80 - band * 0.12, 0.0, 1.0);
  col += starLayer(d, dvx, dvy, mag, 150.0, 0.86 - band * 0.10, 17.0, 0.45);
  return col;
}

vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

// ---------------------------------------------------------------- main
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / (0.5 * min(uRes.x, uRes.y)) + uShift;
  vec3 rd = normalize(uFwd + (uv.x * uRight + uv.y * uUp) * uTanHalf);

  vec3 p = uCamPos;
  vec3 v = rd;
  float h2 = dot(cross(p, v), cross(p, v));
  float escape2 = max(dot(p, p) * 1.3, 1600.0);

  vec3 col = vec3(0.0);
  vec3 glow = vec3(0.0);
  float alpha = 0.0;
  bool captured = false;

  for (int i = 0; i < MAX_STEPS; i++) {
    if (i >= uSteps) break;
    float r2 = dot(p, p);
    float r = sqrt(r2);
    float h = clamp(0.08 * r, 0.012, 3.0);
    // Finer steps where the disk lives, so its inner structure doesn't alias.
    if (abs(p.y) < 1.2 && r < ROUT + 2.0) h = min(h, 0.03 + 0.05 * r);

    vec3 prev = p;
    v += (-1.5 * h2 * p / (r2 * r2 * r)) * h;
    p += v * h;

    if (prev.y * p.y < 0.0) {
      float t = prev.y / (prev.y - p.y);
      vec4 d = disk(mix(prev, p, t), normalize(v));
      col += (1.0 - alpha) * d.rgb * d.a;
      alpha += (1.0 - alpha) * d.a;
      if (alpha > 0.99) break;
    }

    // Soft volumetric haze above and below the disk: the in-shader "bloom".
    float rxz = length(p.xz);
    if (rxz > RIN - 0.6 && rxz < ROUT) {
      float tt = diskTemp(rxz);
      float s2 = 0.03 + 0.007 * rxz * rxz;
      glow += diskRamp(tt * 0.92) * (tt * tt) * exp(-p.y * p.y / s2) * h * 0.026 * (1.0 - alpha);
    }

    if (dot(p, p) < 1.0) { captured = true; break; }
    if (dot(p, p) > escape2 && dot(p, v) > 0.0) break;
  }

  vec3 dir = normalize(v);
  vec3 dvx = dFdx(dir), dvy = dFdy(dir);
  // Stars fade fast behind the translucent disk so they don't sparkle through it.
  float clear = 1.0 - alpha;
  if (!captured) col += clear * clear * clear * sky(dir, dvx, dvy);
  col += glow;

  col = aces(col * uExposure);
  col = max(mix(vec3(dot(col, vec3(0.2126, 0.7152, 0.0722))), col, 1.14), 0.0);
  col = pow(col, vec3(1.0 / 2.2));

  vec2 q = gl_FragCoord.xy / uRes;
  float vig = pow(16.0 * q.x * q.y * (1.0 - q.x) * (1.0 - q.y), 0.16);
  col *= mix(0.7, 1.0, vig);
  col += (hash13(vec3(gl_FragCoord.xy, uGrainSeed)) - 0.5) * 0.018;

  gl_FragColor = vec4(col, 1.0);
}
`
