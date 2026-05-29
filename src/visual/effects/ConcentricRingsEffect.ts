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
uniform float uIntensity;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec3 uColor4;
uniform float uAspect;

void main() {
  vec2 uv = vUv - 0.5;
  uv.x *= uAspect;
  
  float t = uTime * uSpeed;
  float dist = length(uv);
  float angle = atan(uv.y, uv.x);
  
  // Expanding concentric rings - classic Winamp style
  float ringFreq = 12.0;
  float expansion = t * 2.0 + uBassEnergy * 3.0;
  
  // Multiple ring layers at different speeds
  float rings1 = sin((dist * ringFreq - expansion) * 3.14159) * 0.5 + 0.5;
  float rings2 = sin((dist * ringFreq * 0.7 - expansion * 1.3) * 3.14159) * 0.5 + 0.5;
  float rings3 = sin((dist * ringFreq * 1.4 - expansion * 0.7 + uMidEnergy * 2.0) * 3.14159) * 0.5 + 0.5;
  
  // Ring thickness - thinner rings look more dramatic
  rings1 = pow(rings1, 3.0 + uHighEnergy * 4.0);
  rings2 = pow(rings2, 4.0);
  rings3 = pow(rings3, 5.0);
  
  // Color each ring layer differently
  vec3 col1 = uColor1 * rings1 * (1.0 + uBassEnergy * 1.5);
  vec3 col2 = uColor2 * rings2 * (0.8 + uMidEnergy * 1.2);
  vec3 col3 = uColor3 * rings3 * (0.6 + uHighEnergy * 1.0);
  
  vec3 col = col1 + col2 + col3;
  
  // Angular shimmer - rotates with time
  float shimmer = sin(angle * 6.0 + t * 2.0) * 0.3 + 0.7;
  col *= shimmer;
  
  // Pulse burst on transient - rings flash brighter
  col += uColor4 * uTransient * exp(-dist * 3.0) * 2.0;
  
  // Vignette falloff
  float falloff = 1.0 - smoothstep(0.3, 0.7, dist);
  col *= falloff;
  
  // Overall intensity
  col *= uIntensity;
  
  gl_FragColor = vec4(col, 1.0);
}
`;

export class ConcentricRingsEffect implements VisualEffect {
  name = 'rings';
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
        uColor1: { value: new THREE.Color('#ff0066') },
        uColor2: { value: new THREE.Color('#00ffcc') },
        uColor3: { value: new THREE.Color('#6600ff') },
        uColor4: { value: new THREE.Color('#ffffff') },
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
