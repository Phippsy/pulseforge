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

const fragmentShader = `
precision highp float;
varying vec2 vUv;

uniform float uTime;
uniform float uBassEnergy;
uniform float uMidEnergy;
uniform float uHighEnergy;
uniform float uTransient;
uniform float uIntensity;
uniform float uAspect;

// Hash functions
float hash(float n) { return fract(sin(n) * 43758.5453); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

// Noise
float noise(float x) {
  float i = floor(x);
  float f = fract(x);
  return mix(hash(i), hash(i + 1.0), f * f * (3.0 - 2.0 * f));
}

void main() {
  vec2 uv = vUv;
  
  // Base VHS colour (slightly warm tinted)
  vec3 col = vec3(0.0);
  
  // --- Tracking distortion ---
  // Horizontal offset that drifts, worse on bass
  float trackingStrength = 0.02 + uBassEnergy * 0.06 + uTransient * 0.1;
  float trackingBand = smoothstep(0.0, 0.1, sin(uv.y * 3.0 + uTime * 0.5)) *
                       smoothstep(1.0, 0.9, sin(uv.y * 3.0 + uTime * 0.5));
  
  // Rolling tracking bar (the classic VHS glitch band)
  float rollPos = mod(uTime * 0.3, 1.4) - 0.2;
  float rollBand = smoothstep(rollPos - 0.08, rollPos, uv.y) * 
                   smoothstep(rollPos + 0.08, rollPos, uv.y);
  
  float hOffset = sin(uv.y * 50.0 + uTime * 2.0) * trackingStrength * trackingBand;
  hOffset += rollBand * 0.15 * sin(uv.y * 200.0 + uTime * 10.0);
  
  // Apply horizontal shift
  vec2 distortedUv = uv;
  distortedUv.x += hOffset;
  
  // --- RGB colour separation (chromatic aberration) ---
  float chromaShift = 0.005 + uMidEnergy * 0.01 + rollBand * 0.02;
  float r = hash2(floor(distortedUv * vec2(160.0, 120.0) + vec2(chromaShift, 0.0)) + uTime * 0.01);
  float g = hash2(floor(distortedUv * vec2(160.0, 120.0)) + uTime * 0.01);
  float b = hash2(floor(distortedUv * vec2(160.0, 120.0) - vec2(chromaShift, 0.0)) + uTime * 0.01);
  
  // --- Static/snow noise ---
  float staticNoise = hash2(uv * vec2(640.0, 480.0) + uTime * 100.0);
  float staticAmount = 0.05 + uHighEnergy * 0.1 + rollBand * 0.6;
  
  // --- Colour bars test pattern (fades in/out) ---
  float barPhase = sin(uTime * 0.2) * 0.5 + 0.5;
  float barPattern = 0.0;
  vec3 barColor = vec3(0.0);
  
  if (barPhase > 0.7) {
    float barAmount = smoothstep(0.7, 0.9, barPhase);
    float barX = floor(distortedUv.x * 8.0) / 8.0;
    
    // SMPTE colour bars
    if (barX < 0.125) barColor = vec3(1.0, 1.0, 1.0);
    else if (barX < 0.25) barColor = vec3(1.0, 1.0, 0.0);
    else if (barX < 0.375) barColor = vec3(0.0, 1.0, 1.0);
    else if (barX < 0.5) barColor = vec3(0.0, 1.0, 0.0);
    else if (barX < 0.625) barColor = vec3(1.0, 0.0, 1.0);
    else if (barX < 0.75) barColor = vec3(1.0, 0.0, 0.0);
    else if (barX < 0.875) barColor = vec3(0.0, 0.0, 1.0);
    else barColor = vec3(0.0);
    
    barPattern = barAmount;
  }
  
  // --- Fake "video content" - geometric shapes representing recorded footage ---
  vec3 videoContent = vec3(0.0);
  
  // Simulated scene with moving shapes (like a degraded recording)
  float scene1 = smoothstep(0.3, 0.28, length(distortedUv - vec2(0.5 + sin(uTime * 0.8) * 0.2, 0.5)));
  videoContent += vec3(0.2, 0.6, 0.8) * scene1;
  
  // A rectangle (like a TV frame within)
  vec2 rectP = abs(distortedUv - 0.5);
  float rect = smoothstep(0.3, 0.29, max(rectP.x, rectP.y * 0.7)) *
               smoothstep(0.2, 0.21, max(rectP.x, rectP.y * 0.7));
  videoContent += vec3(0.8, 0.3, 0.1) * rect;
  
  // Horizontal lines (interlace-style content)
  float lines = sin(distortedUv.y * 240.0) * 0.5 + 0.5;
  videoContent *= 0.8 + lines * 0.2;
  
  // --- Combine layers ---
  col = videoContent;
  
  // Colour bars overlay
  col = mix(col, barColor, barPattern);
  
  // Static noise
  col = mix(col, vec3(staticNoise), staticAmount);
  
  // --- VHS artefacts ---
  
  // Horizontal head-switching noise at bottom
  float headSwitch = smoothstep(0.0, 0.04, uv.y) * 0.8;
  col = mix(col, vec3(hash2(vec2(uv.x * 100.0, uTime * 50.0))), headSwitch);
  
  // Colour bleed (smear horizontally)
  float bleed = sin(uv.y * 100.0 + uTime) * 0.02 * uMidEnergy;
  col.r += bleed;
  col.b -= bleed;
  
  // VHS date stamp flicker
  vec2 datePos = uv - vec2(0.65, 0.1);
  float dateBox = step(0.0, datePos.x) * step(datePos.x, 0.25) *
                  step(0.0, datePos.y) * step(datePos.y, 0.04);
  float dateFlicker = step(0.3, hash(floor(uTime * 4.0)));
  col += vec3(1.0) * dateBox * 0.5 * dateFlicker;
  
  // REC indicator (blinking red dot)
  float recDot = smoothstep(0.012, 0.008, length(uv - vec2(0.08, 0.9)));
  float recBlink = step(0.5, sin(uTime * 3.0));
  col += vec3(1.0, 0.0, 0.0) * recDot * recBlink;
  
  // --- CRT/TV effects ---
  
  // Scanlines
  float scanline = sin(uv.y * 480.0 * 3.14159) * 0.08;
  col -= scanline;
  
  // Slight S-curve colour distortion
  col = pow(col, vec3(0.9, 1.0, 1.1));
  
  // Warm VHS tint
  col *= vec3(1.05, 0.95, 0.85);
  
  // Rolling bar darkening
  col *= 1.0 - rollBand * 0.5;
  
  // Vignette
  float vig = 1.0 - length((uv - 0.5) * 1.6);
  col *= smoothstep(0.0, 0.5, vig);
  
  // Transient causes glitch burst
  if (uTransient > 0.4) {
    float glitchLine = step(0.95, hash(floor(uv.y * 30.0) + uTime * 100.0));
    col = mix(col, vec3(1.0) - col, glitchLine * uTransient);
  }
  
  col *= uIntensity;
  col = clamp(col, 0.0, 1.0);
  gl_FragColor = vec4(col, 1.0);
}
`;

export class VHSEffect implements VisualEffect {
  name = 'vhs';
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
        uAspect: { value: 1.0 },
      },
      vertexShader,
      fragmentShader,
    });

    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
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
    u.uAspect.value = window.innerWidth / window.innerHeight;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.mesh.parent?.remove(this.mesh);
  }
}
