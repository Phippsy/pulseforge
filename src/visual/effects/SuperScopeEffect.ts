import * as THREE from 'three';
import type { ControlSignals } from '../../store';
import type { VisualEffect, EffectParams } from './types';

/**
 * SuperScope - Winamp AVS-style parametric oscilloscope
 * Lissajous figures, circular scopes, spiraling waveforms
 * Multiple drawing modes driven by audio
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
uniform float uAspect;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec3 uColor4;

#define PI 3.14159265359
#define TAU 6.28318530718

float line(vec2 p, vec2 a, vec2 b, float w) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  float d = length(pa - ba * h);
  return smoothstep(w, w * 0.3, d);
}

void main() {
  vec2 uv = (vUv - 0.5) * 2.0;
  uv.x *= uAspect;
  
  float t = uTime * uSpeed;
  vec3 col = vec3(0.0);
  
  // Multiple scope layers
  float totalEnergy = uBassEnergy + uMidEnergy + uHighEnergy;
  
  // Layer 1: Lissajous figure (bass-driven)
  {
    float freqX = 2.0 + floor(uBassEnergy * 3.0);
    float freqY = 3.0 + floor(uMidEnergy * 2.0);
    float phase = t * 0.5 + uTransient;
    
    float minDist = 100.0;
    vec2 prevP = vec2(0.0);
    for (int i = 0; i < 128; i++) {
      float fi = float(i) / 128.0;
      float angle = fi * TAU;
      vec2 p = vec2(
        sin(angle * freqX + phase) * (0.6 + uBassEnergy * 0.2),
        sin(angle * freqY + phase * 0.7) * (0.6 + uMidEnergy * 0.2)
      );
      
      if (i > 0) {
        float l = line(uv, prevP, p, 0.008 + uBassEnergy * 0.004);
        float hue = fi + t * 0.1;
        vec3 lCol = mix(uColor1, uColor2, fract(hue));
        col += lCol * l * 0.8;
      }
      prevP = p;
    }
  }
  
  // Layer 2: Circular oscilloscope (mid-driven)
  {
    float radius = 0.35 + uMidEnergy * 0.15;
    float minDist = 100.0;
    vec2 prevP = vec2(0.0);
    for (int i = 0; i < 128; i++) {
      float fi = float(i) / 128.0;
      float angle = fi * TAU;
      float wave = sin(angle * 8.0 + t * 3.0) * uMidEnergy * 0.2;
      wave += sin(angle * 16.0 + t * 5.0) * uHighEnergy * 0.1;
      float r = radius + wave;
      vec2 p = vec2(cos(angle), sin(angle)) * r;
      
      if (i > 0) {
        float l = line(uv, prevP, p, 0.006 + uMidEnergy * 0.003);
        vec3 lCol = mix(uColor2, uColor3, fi);
        col += lCol * l * 0.6;
      }
      prevP = p;
    }
  }
  
  // Layer 3: Spiral scope (high-driven)
  {
    vec2 prevP = vec2(0.0);
    float spiralTurns = 3.0 + uHighEnergy * 2.0;
    for (int i = 0; i < 96; i++) {
      float fi = float(i) / 96.0;
      float angle = fi * TAU * spiralTurns + t * 0.8;
      float r = fi * 0.8 * (0.5 + uHighEnergy * 0.3);
      float wave = sin(fi * 20.0 + t * 4.0) * 0.05 * uHighEnergy;
      r += wave;
      vec2 p = vec2(cos(angle), sin(angle)) * r;
      
      if (i > 0) {
        float l = line(uv, prevP, p, 0.005);
        vec3 lCol = mix(uColor3, uColor4, fi);
        col += lCol * l * 0.5 * uHighEnergy;
      }
      prevP = p;
    }
  }
  
  // Glow/bloom around bright areas
  col += col * col * 0.5;
  
  // Subtle radial background
  float bg = 1.0 - length(uv) * 0.3;
  col += vec3(0.01) * bg * totalEnergy;
  
  // Transient flash
  col += uTransient * 0.2 * uColor4;
  
  col *= uIntensity;
  col = col / (1.0 + col * 0.3);
  
  gl_FragColor = vec4(col, 1.0);
}
`;

export class SuperScopeEffect implements VisualEffect {
  name = 'superscope';
  private mesh!: THREE.Mesh;
  private material!: THREE.ShaderMaterial;

  init(scene: THREE.Scene): void {
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uBassEnergy: { value: 0 },
        uMidEnergy: { value: 0 },
        uHighEnergy: { value: 0 },
        uTransient: { value: 0 },
        uIntensity: { value: 1.0 },
        uSpeed: { value: 1.0 },
        uAspect: { value: 1.0 },
        uColor1: { value: new THREE.Color('#00FFAA') },
        uColor2: { value: new THREE.Color('#FF00FF') },
        uColor3: { value: new THREE.Color('#FFFF00') },
        uColor4: { value: new THREE.Color('#00CCFF') },
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
    u.uSpeed.value = params.speed;
    u.uAspect.value = window.innerWidth / window.innerHeight;
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
