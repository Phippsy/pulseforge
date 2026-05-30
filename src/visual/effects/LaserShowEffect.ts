import * as THREE from 'three';
import type { ControlSignals } from '../../store';
import type { VisualEffect, EffectParams } from './types';

/**
 * Laser Light Show - Concert-quality laser beams with haze
 * Features: scanning beams, fan patterns, geometric shapes, volumetric haze,
 * multiple source points, beat-reactive movement
 */

const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;

const fragmentShader = `
precision highp float;
varying vec2 vUv;

uniform float uTime;
uniform float uBassEnergy;
uniform float uMidEnergy;
uniform float uHighEnergy;
uniform float uTransient;
uniform float uIntensity;
uniform float uSpeed;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec3 uColor4;

#define PI 3.14159265359
#define TAU 6.28318530718

float hash(float n) { return fract(sin(n) * 43758.5453); }

// Signed distance from point to line segment
float sdLine(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

// Single laser beam with glow and haze
vec3 laserBeam(vec2 uv, vec2 origin, float angle, float len, vec3 color, float width) {
  vec2 dir = vec2(cos(angle), sin(angle));
  vec2 endpoint = origin + dir * len;
  float d = sdLine(uv, origin, endpoint);
  
  // Sharp core — very tight
  float core = exp(-d * d / (width * width * 0.00003));
  // Medium glow
  float glow = exp(-d * d / (width * width * 0.0005));
  // Subtle haze (atmospheric scatter)
  float haze = exp(-d * d / (width * width * 0.006));
  
  // Dust particles in beam path
  float along = dot(uv - origin, dir);
  float dust = 0.0;
  if (along > 0.0 && along < len) {
    float dustFreq = 80.0;
    dust = sin(along * dustFreq + uTime * 5.0) * 0.5 + 0.5;
    dust *= exp(-d * d / (width * width * 0.001));
    dust *= 0.08;
  }
  
  return color * (core * 3.0 + glow * 0.5 + haze * 0.06 + dust);
}

// Fan of beams from a single point
vec3 laserFan(vec2 uv, vec2 origin, float centerAngle, float spread, float count, vec3 color, float width, float phase) {
  vec3 col = vec3(0.0);
  for (float i = 0.0; i < 16.0; i++) {
    if (i >= count) break;
    float t = (i / (count - 1.0)) - 0.5;
    float angle = centerAngle + t * spread;
    angle += sin(phase + i * 0.8) * 0.04;
    col += laserBeam(uv, origin, angle, 2.0, color, width);
  }
  return col;
}

// Rotating geometric shape (drawn by laser trace)
vec3 laserShape(vec2 uv, vec2 center, float radius, float sides, float rotation, vec3 color, float width) {
  vec3 col = vec3(0.0);
  for (float i = 0.0; i < 12.0; i++) {
    if (i >= sides) break;
    float a1 = rotation + i * TAU / sides;
    float a2 = rotation + (i + 1.0) * TAU / sides;
    vec2 p1 = center + vec2(cos(a1), sin(a1)) * radius;
    vec2 p2 = center + vec2(cos(a2), sin(a2)) * radius;
    float d = sdLine(uv, p1, p2);
    float core = exp(-d * d / (width * width * 0.00002));
    float glow = exp(-d * d / (width * width * 0.0003));
    col += color * (core * 2.5 + glow * 0.4);
  }
  return col;
}

// Lissajous curve laser trace
vec3 laserLissajous(vec2 uv, vec2 center, float scaleX, float scaleY, float freqX, float freqY, float phase, vec3 color, float width) {
  vec3 col = vec3(0.0);
  float steps = 60.0;
  vec2 prev = center + vec2(sin(freqX * 0.0 + phase) * scaleX, sin(freqY * 0.0) * scaleY);
  for (float i = 1.0; i <= 60.0; i++) {
    float t = i / steps * TAU;
    vec2 curr = center + vec2(sin(freqX * t + phase) * scaleX, sin(freqY * t) * scaleY);
    float d = sdLine(uv, prev, curr);
    float core = exp(-d * d / (width * width * 0.00002));
    float glow = exp(-d * d / (width * width * 0.0003));
    float brightness = 0.6 + 0.4 * sin(t * 3.0 + uTime * 8.0);
    col += color * (core * 2.2 + glow * 0.3) * brightness;
    prev = curr;
  }
  return col / 2.0;
}

void main() {
  vec2 uv = vUv;
  vec2 p = (uv - 0.5) * vec2(1.777, 1.0);
  float t = uTime * uSpeed;
  
  vec3 col = vec3(0.0);
  
  // Very dark background with slight gradient (smoky venue)
  col = mix(vec3(0.01, 0.005, 0.02), vec3(0.0), uv.y);
  
  // Haze layer (volumetric fog visible in beams)
  float hazeVal = 0.0;
  hazeVal += sin(uv.x * 3.0 + t * 0.3) * 0.5 + 0.5;
  hazeVal *= sin(uv.y * 2.0 - t * 0.2) * 0.5 + 0.5;
  hazeVal *= 0.02;
  col += vec3(0.02, 0.01, 0.03) * hazeVal;
  
  // === PATTERN SYSTEM: cycles through different laser configurations ===
  float patternTime = 8.0;
  float patternPhase = mod(t, patternTime * 5.0);
  float pattern = floor(patternPhase / patternTime);
  
  // Beam width modulated by mid energy
  float beamWidth = 0.8 + uMidEnergy * 0.4;
  
  // === PATTERN 0: Dual fan sweep ===
  if (pattern < 0.5) {
    float sweep = sin(t * 1.5) * 0.6;
    vec2 srcL = vec2(-0.85, 0.5);
    vec2 srcR = vec2(0.85, 0.5);
    
    float fanSpread = 0.5 + uBassEnergy * 0.4;
    col += laserFan(p, srcL, -PI * 0.4 + sweep, fanSpread, 8.0, uColor1, beamWidth, t * 2.0);
    col += laserFan(p, srcR, -PI * 0.6 - sweep, fanSpread, 8.0, uColor2, beamWidth, t * 2.0 + 1.0);
    
    // Center beam on bass hits
    if (uBassEnergy > 0.3) {
      col += laserBeam(p, vec2(0.0, 0.5), -PI * 0.5, 1.5, uColor3 * uBassEnergy * 2.0, beamWidth * 1.5);
    }
  }
  
  // === PATTERN 1: Rotating scanner beams ===
  else if (pattern < 1.5) {
    vec2 src = vec2(0.0, 0.5);
    float numBeams = 6.0 + uBassEnergy * 4.0;
    for (float i = 0.0; i < 10.0; i++) {
      if (i >= numBeams) break;
      float angle = t * (1.2 + i * 0.15) + i * TAU / numBeams;
      angle += sin(t * 0.5 + i) * 0.3 * uMidEnergy;
      
      vec3 beamColor;
      float ci = mod(i, 4.0);
      if (ci < 1.0) beamColor = uColor1;
      else if (ci < 2.0) beamColor = uColor2;
      else if (ci < 3.0) beamColor = uColor3;
      else beamColor = uColor4;
      
      col += laserBeam(p, src, angle, 1.8, beamColor, beamWidth);
    }
  }
  
  // === PATTERN 2: Geometric shapes ===
  else if (pattern < 2.5) {
    // Rotating triangle
    float triRot = t * 1.5;
    float triSize = 0.2 + uBassEnergy * 0.15;
    col += laserShape(p, vec2(0.0, 0.0), triSize, 3.0, triRot, uColor1, beamWidth);
    
    // Rotating square (different speed)
    float sqRot = -t * 1.2;
    float sqSize = 0.3 + uMidEnergy * 0.1;
    col += laserShape(p, vec2(0.0, 0.0), sqSize, 4.0, sqRot, uColor2, beamWidth * 0.8);
    
    // Outer hexagon
    float hexRot = t * 0.8;
    float hexSize = 0.45 + uHighEnergy * 0.1;
    col += laserShape(p, vec2(0.0, 0.0), hexSize, 6.0, hexRot, uColor3, beamWidth * 0.6);
    
    // Fan beams from bottom on beats
    if (uBassEnergy > 0.2) {
      col += laserFan(p, vec2(0.0, -0.55), PI * 0.5, 1.2, 12.0, uColor4 * uBassEnergy, beamWidth * 0.7, t * 3.0);
    }
  }
  
  // === PATTERN 3: Lissajous curves ===
  else if (pattern < 3.5) {
    float lPhase = t * 2.0;
    float sx = 0.35 + uBassEnergy * 0.1;
    float sy = 0.25 + uMidEnergy * 0.1;
    col += laserLissajous(p, vec2(0.0, 0.0), sx, sy, 3.0, 2.0, lPhase, uColor1, beamWidth);
    col += laserLissajous(p, vec2(0.0, 0.0), sx * 0.7, sy * 0.7, 5.0, 4.0, lPhase * 0.7, uColor2, beamWidth * 0.8);
    
    // Background scanner beams
    for (float i = 0.0; i < 4.0; i++) {
      float angle = t * 0.8 + i * TAU / 4.0;
      vec2 src = vec2(cos(angle + PI) * 0.9, 0.5);
      col += laserBeam(p, src, angle + PI * 0.5, 1.5, uColor3 * 0.3, beamWidth * 0.6);
    }
  }
  
  // === PATTERN 4: Full room chaos (all beams) ===
  else {
    // Multiple sources around the edges
    for (float i = 0.0; i < 6.0; i++) {
      float srcAngle = i * TAU / 6.0 + t * 0.2;
      vec2 src = vec2(cos(srcAngle), sin(srcAngle)) * 0.7;
      src.x *= 1.2;
      
      float beamAngle = atan(-src.y, -src.x) + sin(t * 2.0 + i * 1.5) * 0.5;
      
      vec3 beamColor;
      float ci = mod(i, 4.0);
      if (ci < 1.0) beamColor = uColor1;
      else if (ci < 2.0) beamColor = uColor2;
      else if (ci < 3.0) beamColor = uColor3;
      else beamColor = uColor4;
      
      col += laserBeam(p, src, beamAngle, 1.5, beamColor, beamWidth);
      col += laserBeam(p, src, beamAngle + 0.15, 1.5, beamColor * 0.6, beamWidth * 0.7);
    }
    
    // Center rotating shape
    float shapeRot = t * 3.0;
    float shapeSides = 3.0 + floor(mod(t * 0.5, 4.0));
    col += laserShape(p, vec2(0.0, 0.0), 0.2 + uBassEnergy * 0.1, shapeSides, shapeRot, vec3(1.0), beamWidth * 0.5);
  }
  
  // === Always-on elements ===
  
  // Transient flash
  if (uTransient > 0.7) {
    col += vec3(1.0) * (uTransient - 0.7) * 3.0 * col;
  }
  
  // Bass pulse
  col *= 1.0 + uBassEnergy * 0.5;
  
  // Subtle smoke/haze overlay
  float smokeX = sin(uv.x * 4.0 + t * 0.4) * cos(uv.y * 3.0 - t * 0.3);
  float smokeY = cos(uv.x * 3.0 - t * 0.5) * sin(uv.y * 5.0 + t * 0.2);
  float smoke = (smokeX + smokeY) * 0.5 + 0.5;
  smoke = smoke * smoke * 0.03;
  col += vec3(0.05, 0.03, 0.08) * smoke;
  
  // Vignette
  float vignette = 1.0 - dot((uv - 0.5) * 1.2, (uv - 0.5) * 1.2);
  vignette = max(vignette, 0.0);
  col *= vignette;
  
  col *= uIntensity;
  
  gl_FragColor = vec4(col, 1.0);
}
`;

export class LaserShowEffect implements VisualEffect {
  name = 'laserShow';
  private mesh!: THREE.Mesh;
  private material!: THREE.ShaderMaterial;

  init(scene: THREE.Scene, _camera: THREE.Camera): void {
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uBassEnergy: { value: 0 },
        uMidEnergy: { value: 0 },
        uHighEnergy: { value: 0 },
        uTransient: { value: 0 },
        uIntensity: { value: 1.0 },
        uSpeed: { value: 1.0 },
        uColor1: { value: new THREE.Color('#00ff00') },
        uColor2: { value: new THREE.Color('#ff00ff') },
        uColor3: { value: new THREE.Color('#00ffff') },
        uColor4: { value: new THREE.Color('#ff0000') },
      },
      vertexShader,
      fragmentShader,
    });

    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      this.material
    );
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  update(signals: ControlSignals, params: EffectParams, _dt: number, time: number): void {
    const u = this.material.uniforms;
    u.uTime.value = time;
    u.uBassEnergy.value = signals.bassEnergy * params.bassReactivity;
    u.uMidEnergy.value = signals.midEnergy * params.midReactivity;
    u.uHighEnergy.value = signals.highEnergy * params.highReactivity;
    u.uTransient.value = signals.transientPulse * params.onsetReactivity;
    u.uIntensity.value = params.intensity;
    u.uSpeed.value = params.speed;
    u.uColor1.value.set(params.colors[0]);
    u.uColor2.value.set(params.colors[1]);
    u.uColor3.value.set(params.colors[2]);
    u.uColor4.value.set(params.colors[3]);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.mesh.parent?.remove(this.mesh);
  }
}
