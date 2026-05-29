import * as THREE from 'three';
import type { ControlSignals } from '../../store';
import type { VisualEffect, EffectParams } from './types';

const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;

// Massively enhanced fractal - continuous deep zoom, orbit traps, morphing types
const fragmentShader = `
precision highp float;
varying vec2 vUv;

uniform float uTime;
uniform float uBassEnergy;
uniform float uMidEnergy;
uniform float uHighEnergy;
uniform float uBassPulse;
uniform float uTransient;
uniform float uIntensity;
uniform float uSpeed;
uniform float uZoom;
uniform float uIterations;
uniform float uJuliaReal;
uniform float uJuliaImag;
uniform float uColorShift;
uniform float uAspect;
uniform float uMode;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec3 uColor4;

#define PI 3.14159265
#define TAU 6.28318530

// Smooth noise for parameter drift
float hash(float n) { return fract(sin(n) * 43758.5453); }
float noise1D(float x) {
  float i = floor(x);
  float f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(hash(i), hash(i + 1.0), f);
}

// Orbit trap distance functions for vivid coloring
float trapCircle(vec2 z, vec2 center, float radius) {
  return abs(length(z - center) - radius);
}
float trapLine(vec2 z, vec2 a, vec2 b) {
  vec2 pa = z - a, ba = b - a;
  float t = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * t);
}
float trapCross(vec2 z) {
  return min(abs(z.x), abs(z.y));
}

vec3 palette(float t) {
  // Rich multi-stop gradient using phase colors
  vec3 a = uColor1;
  vec3 b = uColor2;
  vec3 c = uColor3;
  vec3 d = uColor4;
  t = fract(t);
  if (t < 0.25) return mix(a, b, t * 4.0);
  if (t < 0.5) return mix(b, c, (t - 0.25) * 4.0);
  if (t < 0.75) return mix(c, d, (t - 0.5) * 4.0);
  return mix(d, a, (t - 0.75) * 4.0);
}

void main() {
  vec2 uv = (vUv - 0.5) * 2.0;
  uv.x *= uAspect;
  
  // CONTINUOUS DEEP ZOOM - very slow continuous zoom, never resets abruptly
  float zoomTime = uTime * uSpeed * 0.015; // Very slow cycle
  // Smooth sine-based oscillation — no edges, no resets
  float zoomPhase = sin(zoomTime * PI) * 0.5 + 0.5; // Smooth 0->1->0
  float zoomLevel = uZoom * (0.6 + zoomPhase * 0.4); // Only 60-100% range — subtle zoom
  
  // The zoom center wanders slowly - creates exploration feeling
  float wanderT = uTime * uSpeed * 0.015;
  vec2 zoomCenter = vec2(
    sin(wanderT * 0.7) * 0.1 + sin(wanderT * 1.3) * 0.03,
    cos(wanderT * 0.5) * 0.08 + cos(wanderT * 1.1) * 0.025
  );
  
  // Bass makes zoom pulsate
  zoomLevel *= 1.0 - uBassPulse * 0.1;
  
  uv = uv * zoomLevel + zoomCenter;
  
  // Continuous rotation
  float angle = uTime * uSpeed * 0.04 + uMidEnergy * 0.5;
  float cs = cos(angle), sn = sin(angle);
  uv = mat2(cs, -sn, sn, cs) * uv;
  
  // Julia constant drifts VERY SLOWLY through interesting regions
  float driftT = uTime * uSpeed * 0.012; // Ultra-slow drift — shapes evolve gently
  vec2 juliaC = vec2(
    uJuliaReal + sin(driftT * 0.3) * 0.06 + sin(driftT * 0.8) * 0.02,
    uJuliaImag + cos(driftT * 0.4) * 0.05 + cos(driftT * 0.9) * 0.015
  );
  // Audio perturbs the julia constant (very subtly)
  juliaC.x += uMidEnergy * 0.02 * sin(uTime * 1.5);
  juliaC.y += uHighEnergy * 0.015 * cos(uTime * 1.0);
  juliaC += vec2(uTransient * 0.03, -uTransient * 0.02);
  
  // Morph between fractal types slowly
  float morphTime = uTime * uSpeed * 0.008;
  float morphPhase = fract(morphTime);
  float morphType = floor(mod(morphTime, 3.0));
  
  float maxIter = uIterations * (0.7 + uIntensity * 0.6);
  vec2 z, c;
  
  // Setup based on mode with smooth morphing
  float useMode = uMode;
  if (useMode < 0.5) {
    z = uv;
    c = juliaC;
  } else if (useMode < 1.5) {
    z = vec2(0.0);
    c = uv + vec2(-0.5, 0.0);
  } else {
    z = vec2(0.0);
    c = uv + vec2(-0.5, -0.3);
  }
  
  // Iteration with orbit trap tracking
  float iter = 0.0;
  float minTrapCircle = 1e10;
  float minTrapCross = 1e10;
  float minTrapLine = 1e10;
  float totalDist = 0.0;
  vec2 prevZ = z;
  
  // Orbit trap shapes move with time
  vec2 trapCenter = vec2(sin(uTime * 0.3) * 0.5, cos(uTime * 0.4) * 0.5);
  float trapRadius = 0.5 + sin(uTime * 0.2) * 0.3;
  
  for (float i = 0.0; i < 200.0; i++) {
    if (i >= maxIter) break;
    
    if (useMode > 1.5) {
      z = vec2(abs(z.x), abs(z.y));
    }
    
    // z = z^2 + c with slight perturbation for variation
    float zr = z.x * z.x - z.y * z.y + c.x;
    float zi = 2.0 * z.x * z.y + c.y;
    
    // Add subtle higher-order term based on audio for organic deformation
    float higherOrder = uBassEnergy * 0.02;
    zr += higherOrder * (z.x * z.x * z.x - 3.0 * z.x * z.y * z.y);
    zi += higherOrder * (3.0 * z.x * z.x * z.y - z.y * z.y * z.y);
    
    z = vec2(zr, zi);
    
    // Track orbit traps for coloring
    minTrapCircle = min(minTrapCircle, trapCircle(z, trapCenter, trapRadius));
    minTrapCross = min(minTrapCross, trapCross(z - trapCenter * 0.5));
    minTrapLine = min(minTrapLine, trapLine(z, vec2(-1.0, 0.0), vec2(1.0, 0.0)));
    totalDist += length(z - prevZ);
    prevZ = z;
    
    float mag = dot(z, z);
    if (mag > 256.0) break;
    iter += 1.0;
  }
  
  // Smooth iteration count
  if (iter < maxIter) {
    float log_zn = log(dot(z, z)) / 2.0;
    float nu = log(log_zn / log(2.0)) / log(2.0);
    iter = iter + 1.0 - nu;
  }
  
  // COLOR - multiple layered coloring methods blended together
  vec3 col = vec3(0.0);
  
  if (iter >= maxIter) {
    // Interior - use orbit trap coloring instead of black
    float trapVal = minTrapCross * 2.0;
    col = palette(trapVal + uColorShift + uTime * 0.05) * 0.3;
    col += palette(minTrapCircle + uTime * 0.03) * 0.2;
  } else {
    float t = iter / maxIter;
    t = sqrt(t);
    
    // Layer 1: iteration-based palette — boosted for exterior richness
    vec3 iterCol = palette(t * 2.0 + uColorShift + uTime * 0.03 * uSpeed);
    
    // Layer 2: orbit trap circle coloring - creates rings/halos
    float trapCol1 = exp(-minTrapCircle * 3.0);
    vec3 trapRing = palette(minTrapCircle * 3.0 + uTime * 0.1) * trapCol1;
    
    // Layer 3: orbit trap cross - creates glowing axes
    float trapCol2 = exp(-minTrapCross * 8.0);
    vec3 trapAxis = uColor4 * trapCol2;
    
    // Layer 4: distance coloring - reveals structure
    float distCol = fract(totalDist * 0.1);
    vec3 distLayer = palette(distCol + uTime * 0.02) * 0.3;
    
    // Blend layers based on audio
    col = iterCol * (0.5 + uIntensity * 0.5);
    col += trapRing * (0.3 + uBassEnergy * 0.5);
    col += trapAxis * (0.2 + uHighEnergy * 0.4);
    col += distLayer * uMidEnergy;
    
    // Edge glow
    float edge = 1.0 - t;
    col += uColor1 * edge * edge * 0.3 * (1.0 + uHighEnergy);
  }
  
  // Transient flash
  col += uTransient * 0.5 * palette(uTime * 0.5);
  
  // Pulsating brightness with bass
  col *= 0.8 + uBassPulse * 0.4;
  
  // Ambient glow in dark regions — keeps the whole screen alive
  float darkness = 1.0 - clamp(length(col) * 2.0, 0.0, 1.0);
  vec3 ambient = palette(uTime * 0.05 + length(vUv - 0.5)) * 0.08 * darkness;
  ambient += uColor1 * 0.03 * darkness * (0.5 + uBassEnergy * 0.5);
  col += ambient;
  
  // Vignette (gentle)
  float vig = 1.0 - length(vUv - 0.5) * 0.4;
  col *= vig;
  
  // HDR tone mapping
  col = col / (1.0 + col * 0.3);
  
  gl_FragColor = vec4(col, 1.0);
}
`;

export class FractalEffect implements VisualEffect {
  name = 'fractal';
  private mesh: THREE.Mesh | null = null;
  private material: THREE.ShaderMaterial | null = null;

  init(scene: THREE.Scene, _camera: THREE.Camera): void {
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uBassEnergy: { value: 0 },
        uMidEnergy: { value: 0 },
        uHighEnergy: { value: 0 },
        uBassPulse: { value: 0 },
        uTransient: { value: 0 },
        uIntensity: { value: 0.7 },
        uSpeed: { value: 0.5 },
        uZoom: { value: 1.5 },
        uIterations: { value: 80 },
        uJuliaReal: { value: -0.7269 },
        uJuliaImag: { value: 0.1889 },
        uColorShift: { value: 0 },
        uMode: { value: 0 },
        uAspect: { value: window.innerWidth / window.innerHeight },
        uColor1: { value: new THREE.Color('#FF00FF') },
        uColor2: { value: new THREE.Color('#00FFFF') },
        uColor3: { value: new THREE.Color('#FF1493') },
        uColor4: { value: new THREE.Color('#7B2FBE') },
      },
    });
    const geo = new THREE.PlaneGeometry(2, 2);
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  update(signals: ControlSignals, params: EffectParams, _dt: number, time: number): void {
    if (!this.material) return;
    const u = this.material.uniforms;
    u.uTime.value = time;
    u.uBassEnergy.value = signals.bassEnergy * params.bassReactivity;
    u.uMidEnergy.value = signals.midEnergy * params.midReactivity;
    u.uHighEnergy.value = signals.highEnergy * params.highReactivity;
    u.uBassPulse.value = signals.bassPulse * params.bassReactivity;
    u.uTransient.value = signals.transientPulse * params.onsetReactivity;
    u.uIntensity.value = params.intensity;
    u.uSpeed.value = params.speed;
    u.uZoom.value = params.effectParams.zoom ?? 1.5;
    u.uIterations.value = params.effectParams.iterations ?? 80;
    u.uJuliaReal.value = params.effectParams.juliaReal ?? -0.7269;
    u.uJuliaImag.value = params.effectParams.juliaImag ?? 0.1889;
    u.uColorShift.value = params.effectParams.colorShift ?? 0;
    u.uMode.value = params.effectParams.mode ?? 0;
    u.uAspect.value = window.innerWidth / window.innerHeight;
    u.uColor1.value.set(params.colors[0]);
    u.uColor2.value.set(params.colors[1]);
    u.uColor3.value.set(params.colors[2]);
    u.uColor4.value.set(params.colors[3]);
  }

  dispose(): void {
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh.parent?.remove(this.mesh);
    }
    if (this.material) this.material.dispose();
    this.mesh = null;
    this.material = null;
  }
}
