import * as THREE from 'three';
import type { ControlSignals } from '../../store';
import type { VisualEffect, EffectParams } from './types';

/**
 * DNA-like double helix structure with audio-reactive twisting and pulsing
 */

const vertexShader = `
attribute float aStrand; // 0 or 1 for the two strands
attribute float aT; // position along helix (0-1)
attribute float aRung; // 1.0 if this is a connecting rung, 0.0 otherwise

uniform float uTime;
uniform float uBassEnergy;
uniform float uMidEnergy;
uniform float uHighEnergy;
uniform float uTransient;
uniform float uIntensity;
uniform float uTwistSpeed;
uniform float uHelixRadius;
uniform float uHelixPitch;
uniform float uWaveAmplitude;

varying float vStrand;
varying float vT;
varying float vGlow;
varying vec3 vColor;

void main() {
  vStrand = aStrand;
  vT = aT;
  
  float t = aT * 6.28 * 4.0; // 4 full twists
  float time = uTime * uTwistSpeed;
  
  // Base helix position
  float angle = t + time + aStrand * 3.14159;
  float radius = uHelixRadius * (1.0 + uBassEnergy * 0.3);
  
  // Wave modulation along the helix
  float wave = sin(aT * 6.28 * 2.0 + uTime * 1.5) * uWaveAmplitude * uMidEnergy;
  radius += wave;
  
  vec3 pos;
  if (aRung > 0.5) {
    // Connecting rungs between strands
    float rungT = fract(aT * 20.0); // interpolation along rung
    float angle1 = t + time;
    float angle2 = t + time + 3.14159;
    float r = uHelixRadius * (1.0 + uBassEnergy * 0.3) + wave;
    
    vec3 p1 = vec3(cos(angle1) * r, (aT - 0.5) * uHelixPitch, sin(angle1) * r);
    vec3 p2 = vec3(cos(angle2) * r, (aT - 0.5) * uHelixPitch, sin(angle2) * r);
    pos = mix(p1, p2, rungT);
    
    // Rungs pulse with high energy
    vGlow = uHighEnergy * 0.5 + uTransient * 0.3;
  } else {
    pos = vec3(
      cos(angle) * radius,
      (aT - 0.5) * uHelixPitch,
      sin(angle) * radius
    );
    vGlow = uBassEnergy * 0.3;
  }
  
  // Transient: expand outward
  pos.xz *= 1.0 + uTransient * 0.5;
  
  // Overall vertical movement
  pos.y += sin(uTime * 0.5) * 0.5;
  
  vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPos;
  gl_PointSize = (3.0 + uIntensity * 3.0 + uBassEnergy * 2.0) * (200.0 / -mvPos.z);
  
  if (aRung > 0.5) {
    gl_PointSize *= 0.6;
  }
}
`;

const fragmentShader = `
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec3 uColor4;
uniform float uTime;
uniform float uIntensity;
uniform float uBassEnergy;

varying float vStrand;
varying float vT;
varying float vGlow;

void main() {
  vec2 pc = gl_PointCoord - 0.5;
  float d = length(pc) * 2.0;
  
  float core = exp(-d * d * 6.0);
  float halo = exp(-d * d * 2.0);
  
  // Color by strand and position
  vec3 col;
  if (vStrand < 0.5) {
    col = mix(uColor1, uColor2, vT);
  } else {
    col = mix(uColor3, uColor4, vT);
  }
  
  // Travelling color wave
  float wavePos = fract(vT - uTime * 0.2);
  float waveBright = smoothstep(0.0, 0.05, wavePos) * smoothstep(0.1, 0.05, wavePos);
  col += waveBright * vec3(1.0, 0.9, 0.8) * 0.5;
  
  col *= core * 2.0 + halo * 0.5;
  col += vGlow * uColor1 * halo;
  col += uBassEnergy * 0.2 * core * vec3(1.0);
  
  float alpha = (core + halo * 0.3) * (0.5 + uIntensity * 0.5);
  if (alpha < 0.01) discard;
  
  gl_FragColor = vec4(col, alpha);
}
`;

export class HelixEffect implements VisualEffect {
  name = 'helix';
  private points: THREE.Points | null = null;
  private material: THREE.ShaderMaterial | null = null;
  private geometry: THREE.BufferGeometry | null = null;

  init(scene: THREE.Scene, _camera: THREE.Camera): void {
    const strandPoints = 400;
    const rungPoints = 200;
    const totalPoints = strandPoints * 2 + rungPoints;

    const positions = new Float32Array(totalPoints * 3);
    const strands = new Float32Array(totalPoints);
    const ts = new Float32Array(totalPoints);
    const rungs = new Float32Array(totalPoints);

    let idx = 0;

    // Strand 1
    for (let i = 0; i < strandPoints; i++) {
      const t = i / strandPoints;
      positions[idx * 3] = 0;
      positions[idx * 3 + 1] = 0;
      positions[idx * 3 + 2] = 0;
      strands[idx] = 0;
      ts[idx] = t;
      rungs[idx] = 0;
      idx++;
    }

    // Strand 2
    for (let i = 0; i < strandPoints; i++) {
      const t = i / strandPoints;
      positions[idx * 3] = 0;
      positions[idx * 3 + 1] = 0;
      positions[idx * 3 + 2] = 0;
      strands[idx] = 1;
      ts[idx] = t;
      rungs[idx] = 0;
      idx++;
    }

    // Connecting rungs
    for (let i = 0; i < rungPoints; i++) {
      const t = i / rungPoints;
      positions[idx * 3] = 0;
      positions[idx * 3 + 1] = 0;
      positions[idx * 3 + 2] = 0;
      strands[idx] = 0;
      ts[idx] = t;
      rungs[idx] = 1;
      idx++;
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute('aStrand', new THREE.BufferAttribute(strands, 1));
    this.geometry.setAttribute('aT', new THREE.BufferAttribute(ts, 1));
    this.geometry.setAttribute('aRung', new THREE.BufferAttribute(rungs, 1));

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uBassEnergy: { value: 0 },
        uMidEnergy: { value: 0 },
        uHighEnergy: { value: 0 },
        uTransient: { value: 0 },
        uIntensity: { value: 0.7 },
        uTwistSpeed: { value: 0.5 },
        uHelixRadius: { value: 1.5 },
        uHelixPitch: { value: 8.0 },
        uWaveAmplitude: { value: 0.3 },
        uColor1: { value: new THREE.Color('#FF6B6B') },
        uColor2: { value: new THREE.Color('#4ECDC4') },
        uColor3: { value: new THREE.Color('#45B7D1') },
        uColor4: { value: new THREE.Color('#96CEB4') },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    scene.add(this.points);
  }

  update(signals: ControlSignals, params: EffectParams, _dt: number, time: number): void {
    if (!this.material) return;
    const u = this.material.uniforms;
    u.uTime.value = time;
    u.uBassEnergy.value = signals.bassEnergy * params.bassReactivity;
    u.uMidEnergy.value = signals.midEnergy * params.midReactivity;
    u.uHighEnergy.value = signals.highEnergy * params.highReactivity;
    u.uTransient.value = signals.transientPulse * params.onsetReactivity;
    u.uIntensity.value = params.intensity;
    u.uTwistSpeed.value = params.effectParams.twistSpeed ?? 0.5;
    u.uHelixRadius.value = params.effectParams.helixRadius ?? 1.5;
    u.uHelixPitch.value = params.effectParams.helixPitch ?? 8.0;
    u.uWaveAmplitude.value = params.effectParams.waveAmplitude ?? 0.3;
    u.uColor1.value.set(params.colors[0]);
    u.uColor2.value.set(params.colors[1]);
    u.uColor3.value.set(params.colors[2]);
    u.uColor4.value.set(params.colors[3]);

    if (this.points) {
      this.points.rotation.y += 0.005 * params.speed * (1 + signals.midEnergy * 0.5);
    }
  }

  dispose(): void {
    if (this.points) this.points.parent?.remove(this.points);
    if (this.geometry) this.geometry.dispose();
    if (this.material) this.material.dispose();
    this.points = null;
    this.geometry = null;
    this.material = null;
  }
}
