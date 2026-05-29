import * as THREE from 'three';
import type { ControlSignals } from '../../store';
import type { VisualEffect, EffectParams } from './types';

/**
 * Sound Waves - oscilloscope/waveform display inspired by Winamp's scope view
 * Multiple layered waveforms with audio reactivity
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
uniform float uSpeed;
uniform float uIntensity;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec3 uColor4;
uniform float uAspect;

// Generate a sine-based waveform with audio modulation
float wave(vec2 uv, float freq, float amp, float phase, float thickness) {
  float y = sin(uv.x * freq + phase) * amp;
  // Add harmonics
  y += sin(uv.x * freq * 2.0 + phase * 1.3) * amp * 0.3;
  y += sin(uv.x * freq * 0.5 + phase * 0.7) * amp * 0.5;
  float d = abs(uv.y - y);
  return smoothstep(thickness, thickness * 0.2, d);
}

void main() {
  vec2 uv = vUv;
  uv.x *= uAspect;
  uv.y = uv.y * 2.0 - 1.0; // center vertically
  
  float t = uTime * uSpeed;
  
  // Main waveform - bass driven
  float bassWave = wave(
    uv,
    8.0 + uBassEnergy * 4.0,
    0.3 * (0.3 + uBassEnergy * 0.7),
    t * 3.0,
    0.008 + uBassEnergy * 0.005
  );
  
  // Mid frequency waveform - faster oscillation
  float midWave = wave(
    uv,
    15.0 + uMidEnergy * 8.0,
    0.2 * (0.2 + uMidEnergy * 0.6),
    t * 5.0 + 1.0,
    0.006 + uMidEnergy * 0.004
  );
  
  // High frequency waveform - rapid shimmer
  float highWave = wave(
    uv,
    25.0 + uHighEnergy * 12.0,
    0.15 * (0.15 + uHighEnergy * 0.5),
    t * 8.0 + 2.0,
    0.004 + uHighEnergy * 0.003
  );
  
  // Horizontal scan line (oscilloscope trigger line)
  float scanLine = smoothstep(0.003, 0.001, abs(uv.y));
  
  // Combine waves with colors
  vec3 col = vec3(0.0);
  col += uColor1 * bassWave * (1.0 + uBassEnergy);
  col += uColor2 * midWave * (0.8 + uMidEnergy);
  col += uColor3 * highWave * (0.6 + uHighEnergy);
  
  // Trigger line
  col += uColor4 * scanLine * 0.15;
  
  // Glow effect around waves
  float glowBass = wave(uv, 8.0 + uBassEnergy * 4.0, 0.3 * (0.3 + uBassEnergy * 0.7), t * 3.0, 0.04);
  col += uColor1 * glowBass * 0.2;
  
  // Transient burst - all waves pulse
  col *= 1.0 + uTransient * 1.5;
  
  // Phosphor trail fade (ghosting effect)
  float ghostWave = wave(uv, 8.0 + uBassEnergy * 4.0, 0.3 * (0.3 + uBassEnergy * 0.7), t * 3.0 - 0.3, 0.02);
  col += uColor1 * ghostWave * 0.1;
  
  // Scanline CRT effect
  float scanlines = sin(vUv.y * 400.0) * 0.03 + 0.97;
  col *= scanlines;
  
  col *= uIntensity;
  
  gl_FragColor = vec4(col, 1.0);
}
`;

export class SoundWavesEffect implements VisualEffect {
  name = 'soundwaves';
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
        uSpeed: { value: 1.0 },
        uIntensity: { value: 1.0 },
        uColor1: { value: new THREE.Color('#00ff88') },
        uColor2: { value: new THREE.Color('#0088ff') },
        uColor3: { value: new THREE.Color('#ff00ff') },
        uColor4: { value: new THREE.Color('#333333') },
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
    u.uSpeed.value = params.speed;
    u.uIntensity.value = params.intensity;
    u.uColor1.value.set(params.colors[0]);
    u.uColor2.value.set(params.colors[1]);
    u.uColor3.value.set(params.colors[2]);
    u.uColor4.value.set(params.colors[3]);
    u.uAspect.value = window.innerWidth / window.innerHeight;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.mesh.parent?.remove(this.mesh);
  }
}
