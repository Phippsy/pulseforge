import * as THREE from 'three';
import type { ControlSignals } from '../../store';
import type { VisualEffect, EffectParams } from './types';

/**
 * Water Ripple - Concentric ripples emanating from audio events
 * Classic Winamp water/reflection effect
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

#define MAX_RIPPLES 8

uniform float uRippleTimes[8];
uniform vec2 uRipplePos[8];

float ripple(vec2 uv, vec2 center, float age, float energy) {
  float dist = length(uv - center);
  float speed = 1.5;
  float wavePos = age * speed;
  float width = 0.08 + age * 0.02;
  
  // Ring that expands outward
  float ring = exp(-pow((dist - wavePos) / width, 2.0));
  
  // Fade with age and distance
  float fade = exp(-age * 1.5) * exp(-dist * 0.5);
  
  // Higher frequency ripples
  float detail = sin(dist * 30.0 - age * 8.0) * 0.3;
  
  return (ring + ring * detail) * fade * energy;
}

void main() {
  vec2 uv = (vUv - 0.5) * 2.0;
  uv.x *= uAspect;
  float t = uTime * uSpeed;
  
  // Base water surface with subtle movement
  float surface = 0.0;
  
  // Ambient ripples from noise
  float n1 = sin(uv.x * 4.0 + t * 0.5) * cos(uv.y * 3.0 + t * 0.3) * 0.1;
  float n2 = sin(uv.x * 7.0 - t * 0.7) * cos(uv.y * 5.0 + t * 0.4) * 0.05;
  surface += (n1 + n2) * (0.3 + uMidEnergy * 0.5);
  
  // Audio-driven ripples from fixed positions
  for (int i = 0; i < MAX_RIPPLES; i++) {
    float age = t - uRippleTimes[i];
    if (age > 0.0 && age < 4.0) {
      surface += ripple(uv, uRipplePos[i], age, 1.0);
    }
  }
  
  // Bass creates center ripple
  float bassRipple = sin(length(uv) * 10.0 - t * 4.0) * uBassEnergy * 0.3;
  bassRipple *= exp(-length(uv) * 1.5);
  surface += bassRipple;
  
  // Transient creates sharp ripple from center
  float transRipple = sin(length(uv) * 20.0 - t * 8.0) * uTransient * 0.5;
  transRipple *= exp(-length(uv) * 2.0);
  surface += transRipple;
  
  // Water colour: blue-green gradient with surface displacement
  vec2 refract = vec2(
    dFdx(surface) * 2.0,
    dFdy(surface) * 2.0
  );
  
  vec2 refractedUv = vUv + refract;
  
  // Colour based on surface height and refraction
  float depth = 0.5 + surface * 0.5;
  vec3 col;
  col = mix(uColor1, uColor2, depth);
  col += uColor3 * max(0.0, surface) * 0.5;
  
  // Specular highlights on wave crests
  float spec = pow(max(0.0, surface), 3.0) * 2.0;
  col += vec3(1.0, 0.98, 0.95) * spec;
  
  // Caustic patterns on the "bottom"
  float caustic = sin((uv.x + refract.x) * 8.0 + t) * sin((uv.y + refract.y) * 8.0 + t * 0.7);
  caustic = pow(max(0.0, caustic), 2.0) * 0.3;
  col += uColor2 * caustic * (1.0 - abs(surface));
  
  // Edge darkening (depth)
  float edge = 1.0 - length(uv) * 0.3;
  col *= max(0.3, edge);
  
  col *= uIntensity;
  col = col / (1.0 + col * 0.2);
  
  gl_FragColor = vec4(col, 1.0);
}
`;

export class WaterRippleEffect implements VisualEffect {
  name = 'waterRipple';
  private mesh!: THREE.Mesh;
  private material!: THREE.ShaderMaterial;
  private rippleTimes = new Float32Array(8);
  private ripplePositions: Float32Array;
  private nextRipple = 0;
  private lastBeat = 0;

  constructor() {
    this.ripplePositions = new Float32Array(16); // 8 ripples * 2 (x,y)
    // Pre-fill with positions
    for (let i = 0; i < 8; i++) {
      this.rippleTimes[i] = -10; // far in past = inactive
      this.ripplePositions[i * 2] = (Math.random() - 0.5) * 1.5;
      this.ripplePositions[i * 2 + 1] = (Math.random() - 0.5) * 1.5;
    }
  }

  init(scene: THREE.Scene): void {
    const ripplePosVec = [];
    for (let i = 0; i < 8; i++) {
      ripplePosVec.push(new THREE.Vector2(this.ripplePositions[i * 2], this.ripplePositions[i * 2 + 1]));
    }

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
        uColor1: { value: new THREE.Color('#001133') },
        uColor2: { value: new THREE.Color('#0066CC') },
        uColor3: { value: new THREE.Color('#00CCFF') },
        uRippleTimes: { value: this.rippleTimes },
        uRipplePos: { value: ripplePosVec },
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

    // Spawn ripple on transient/beat
    if (signals.transientPulse > 0.5 && time - this.lastBeat > 0.3) {
      this.lastBeat = time;
      this.rippleTimes[this.nextRipple] = time;
      const pos = u.uRipplePos.value[this.nextRipple];
      pos.x = (Math.random() - 0.5) * 1.6;
      pos.y = (Math.random() - 0.5) * 1.6;
      this.nextRipple = (this.nextRipple + 1) % 8;
    }
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.mesh.parent?.remove(this.mesh);
  }
}
