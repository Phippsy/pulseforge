import * as THREE from 'three';
import type { ControlSignals } from '../../store';
import type { VisualEffect, EffectParams } from './types';

/**
 * Spiral Vortex - Golden spiral / vortex patterns
 * Fibonacci-inspired spiraling patterns driven by audio
 * Multiple interlocking spirals that react to different frequency bands
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

void main() {
  vec2 uv = (vUv - 0.5) * 2.0;
  uv.x *= uAspect;
  float t = uTime * uSpeed;
  
  float r = length(uv);
  float theta = atan(uv.y, uv.x);
  
  vec3 col = vec3(0.0);
  
  // Spiral 1: Logarithmic spiral (bass-driven)
  {
    float spiral = theta + log(r + 0.01) * 4.0 - t * 1.5;
    spiral += uBassEnergy * 2.0;
    float arms = sin(spiral * 3.0) * 0.5 + 0.5;
    arms *= smoothstep(1.5, 0.1, r);
    arms = pow(arms, 2.0 - uBassEnergy);
    col += uColor1 * arms * (0.6 + uBassEnergy * 0.6);
  }
  
  // Spiral 2: Tighter, opposite direction (mid-driven)
  {
    float spiral = -theta + log(r + 0.01) * 6.0 + t * 2.0;
    spiral += uMidEnergy * 3.0;
    float arms = sin(spiral * 5.0) * 0.5 + 0.5;
    arms *= smoothstep(1.2, 0.05, r);
    arms = pow(arms, 2.5 - uMidEnergy);
    col += uColor2 * arms * 0.5 * (0.5 + uMidEnergy * 0.7);
  }
  
  // Spiral 3: Fibonacci-style golden spiral (high-driven)
  {
    float goldenAngle = 2.399963; // golden angle in radians
    float spiral = theta * 5.0 + r * 8.0 - t * 3.0;
    spiral += uHighEnergy * 4.0;
    float arms = sin(spiral) * 0.5 + 0.5;
    arms *= smoothstep(1.0, 0.0, r) * uHighEnergy;
    col += uColor3 * arms * 0.4;
  }
  
  // Central vortex core
  float core = smoothstep(0.3, 0.0, r);
  float coreSwirl = sin(theta * 8.0 - t * 5.0 + r * 10.0) * 0.5 + 0.5;
  col += uColor4 * core * coreSwirl * 0.5 * (1.0 + uBassEnergy);
  
  // Petal/flower overlay at certain radii
  float petalR = 0.4 + sin(t * 0.5) * 0.1 + uMidEnergy * 0.2;
  float petalDist = abs(r - petalR);
  float numPetals = 6.0 + floor(uHighEnergy * 4.0);
  float petal = sin(theta * numPetals + t) * 0.5 + 0.5;
  float petalMask = smoothstep(0.08, 0.0, petalDist) * petal;
  col += mix(uColor2, uColor4, petal) * petalMask * 0.6;
  
  // Radial lines on transient
  float radial = abs(sin(theta * 12.0));
  radial = smoothstep(0.9, 1.0, radial) * uTransient;
  col += uColor4 * radial * smoothstep(1.5, 0.0, r);
  
  // Outer ring pulse
  float ring = smoothstep(0.05, 0.0, abs(r - 0.8 - uBassEnergy * 0.3));
  col += uColor1 * ring * 0.5;
  
  // Background glow
  col += mix(uColor1, uColor2, r) * 0.03 * (1.0 - r * 0.5);
  
  col *= uIntensity;
  col = col / (1.0 + col * 0.2);
  
  gl_FragColor = vec4(col, 1.0);
}
`;

export class SpiralVortexEffect implements VisualEffect {
  name = 'spiralVortex';
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
        uColor1: { value: new THREE.Color('#FF4500') },
        uColor2: { value: new THREE.Color('#FFD700') },
        uColor3: { value: new THREE.Color('#00FF88') },
        uColor4: { value: new THREE.Color('#FFFFFF') },
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
