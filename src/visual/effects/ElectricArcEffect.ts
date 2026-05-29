import * as THREE from 'three';
import type { ControlSignals } from '../../store';
import type { VisualEffect, EffectParams } from './types';

/**
 * Electric Arc - Lightning/electric discharge effect
 * Multiple forking lightning bolts that react to audio
 * Classic demo scene / Winamp style
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

float hash(float n) { return fract(sin(n) * 43758.5453); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

// Lightning bolt as distance from a jagged line
float lightning(vec2 uv, float seed, float t, float jitter) {
  float y = uv.y;
  float x = uv.x;
  
  // Build jagged path
  float path = 0.0;
  float amp = 0.3 * jitter;
  float freq = 3.0;
  
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    path += sin(y * freq + t * (2.0 + fi) + seed * 10.0 + fi * 3.14) * amp;
    amp *= 0.6;
    freq *= 2.1;
  }
  
  float dist = abs(x - path);
  
  // Core: very bright thin line
  float core = exp(-dist * 80.0);
  // Glow: wider soft glow
  float glow = exp(-dist * 15.0);
  // Outer: very wide faint glow
  float outer = exp(-dist * 4.0);
  
  return core * 2.0 + glow * 0.8 + outer * 0.15;
}

void main() {
  vec2 uv = (vUv - 0.5) * 2.0;
  uv.x *= uAspect;
  float t = uTime * uSpeed;
  
  vec3 col = vec3(0.0);
  
  // Main bolts: number increases with energy
  int numBolts = 3 + int(uBassEnergy * 3.0 + uTransient * 4.0);
  
  for (int i = 0; i < 8; i++) {
    if (i >= numBolts) break;
    float fi = float(i);
    
    // Each bolt has different origin and angle
    float angle = (fi / 8.0 - 0.5) * 3.14 + sin(t * 0.3 + fi) * 0.5;
    float ca = cos(angle);
    float sa = sin(angle);
    vec2 rotUv = vec2(uv.x * ca - uv.y * sa, uv.x * sa + uv.y * ca);
    
    // Jitter increases with bass
    float jitter = 0.5 + uBassEnergy * 0.5 + uTransient * 0.3;
    
    float bolt = lightning(rotUv, fi * 7.3 + floor(t * 3.0) * 0.1, t, jitter);
    
    // Colour varies per bolt
    float colMix = hash(fi * 13.0 + floor(t * 2.0));
    vec3 boltCol = mix(uColor1, uColor2, colMix);
    boltCol = mix(boltCol, uColor3, hash(fi * 23.0) * 0.3);
    
    // Intensity flickers
    float flicker = 0.5 + 0.5 * sin(t * 10.0 + fi * 5.0);
    flicker = mix(flicker, 1.0, uTransient);
    
    col += boltCol * bolt * flicker * (0.5 + uBassEnergy * 0.3);
  }
  
  // Branching forks (smaller bolts)
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    vec2 offset = vec2(
      sin(t * 0.5 + fi * 2.0) * 0.5,
      cos(t * 0.7 + fi * 1.5) * 0.5
    );
    vec2 forkUv = (uv - offset) * 1.5;
    float fork = lightning(forkUv, fi * 11.0 + floor(t * 5.0), t * 1.5, 0.8);
    col += uColor2 * fork * 0.2 * uMidEnergy;
  }
  
  // Central energy ball
  float r = length(uv);
  float energyBall = exp(-r * 3.0) * (0.3 + uBassEnergy * 0.5 + uTransient * 0.5);
  col += mix(uColor1, vec3(1.0), 0.5) * energyBall;
  
  // Flash on transient
  col += vec3(0.1, 0.05, 0.15) * uTransient;
  
  // Background: very subtle ambient
  col += uColor1 * 0.02 * (1.0 - r * 0.3);
  
  col *= uIntensity;
  col = col / (1.0 + col * 0.15);
  
  gl_FragColor = vec4(col, 1.0);
}
`;

export class ElectricArcEffect implements VisualEffect {
  name = 'electricArc';
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
        uColor1: { value: new THREE.Color('#4400FF') },
        uColor2: { value: new THREE.Color('#00CCFF') },
        uColor3: { value: new THREE.Color('#FFFFFF') },
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
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.mesh.parent?.remove(this.mesh);
  }
}
