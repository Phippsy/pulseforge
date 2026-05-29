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
uniform float uSpeed;
uniform float uComplexity;
uniform float uIntensity;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec3 uColor4;
uniform float uAspect;

#define PI 3.14159265
#define TAU 6.28318530

// Plasma functions
float plasma1(vec2 p, float t) {
  return sin(p.x * 3.0 + t) + sin(p.y * 2.7 + t * 1.3) + 
         sin((p.x + p.y) * 2.5 + t * 0.7) + sin(length(p) * 4.0 - t * 2.0);
}

float plasma2(vec2 p, float t) {
  float cx = p.x + 0.5 * sin(t * 0.3);
  float cy = p.y + 0.5 * cos(t * 0.4);
  return sin(sqrt(cx*cx + cy*cy) * 6.0 - t * 3.0);
}

float plasma3(vec2 p, float t) {
  vec2 q = p * 3.0;
  return sin(q.x * cos(t * 0.2) + q.y * sin(t * 0.3)) + 
         sin(q.y * cos(t * 0.4) + q.x * sin(t * 0.25)) +
         sin(length(q - vec2(sin(t*0.5), cos(t*0.3))) * 3.0);
}

// Smooth noise for wave distortion
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

void main() {
  vec2 uv = vUv;
  uv.x *= uAspect;
  vec2 p = (uv - vec2(uAspect * 0.5, 0.5)) * 2.0;
  
  float t = uTime * uSpeed;
  float complexity = uComplexity * 3.0 + 2.0;
  
  // Wave distortion driven by bass
  float wave = sin(p.y * 5.0 + t * 2.0 + uBassEnergy * 10.0) * uBassEnergy * 0.3;
  p.x += wave;
  
  // Transient ripple
  float ripple = sin(length(p) * 10.0 - uTransient * 20.0) * uTransient * 0.2;
  p += normalize(p + 0.001) * ripple;
  
  // Layer plasma functions
  float v1 = plasma1(p * (0.5 + uMidEnergy), t);
  float v2 = plasma2(p * (0.7 + uHighEnergy * 0.5), t * 1.3);
  float v3 = plasma3(p * (0.3 + uBassEnergy * 0.3), t * 0.7);
  
  float combined = (v1 + v2 * complexity / 3.0 + v3) / (2.0 + complexity / 3.0);
  
  // Create wave bands
  float bands = sin(combined * PI * 2.0 + t) * 0.5 + 0.5;
  float bands2 = sin(combined * PI * 3.0 - t * 1.5) * 0.5 + 0.5;
  
  // Color mapping with 4 colors
  vec3 col;
  float idx = fract(combined * 0.25 + t * 0.05);
  if (idx < 0.25) {
    col = mix(uColor1, uColor2, idx * 4.0);
  } else if (idx < 0.5) {
    col = mix(uColor2, uColor3, (idx - 0.25) * 4.0);
  } else if (idx < 0.75) {
    col = mix(uColor3, uColor4, (idx - 0.5) * 4.0);
  } else {
    col = mix(uColor4, uColor1, (idx - 0.75) * 4.0);
  }
  
  // Add wave highlights
  col += vec3(bands * 0.2 * uHighEnergy);
  col *= 0.7 + bands2 * 0.3;
  
  // Intensity and energy boost
  col *= uIntensity * (0.8 + uBassEnergy * 0.4 + uTransient * 0.3);
  
  gl_FragColor = vec4(col, 1.0);
}
`;

export class PlasmaWaveEffect implements VisualEffect {
  name = 'plasma';
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
        uComplexity: { value: 0.5 },
        uIntensity: { value: 1.0 },
        uColor1: { value: new THREE.Color('#ff0066') },
        uColor2: { value: new THREE.Color('#00ffcc') },
        uColor3: { value: new THREE.Color('#6600ff') },
        uColor4: { value: new THREE.Color('#ffcc00') },
        uAspect: { value: 1.0 },
      },
      vertexShader,
      fragmentShader,
    });

    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
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
    u.uComplexity.value = params.complexity;
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
