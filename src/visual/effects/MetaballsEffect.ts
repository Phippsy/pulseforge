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
uniform float uBassPulse;
uniform float uTransient;
uniform float uIntensity;
uniform float uSpeed;
uniform float uBlobCount;
uniform float uThreshold;
uniform float uAspect;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec3 uColor4;

#define MAX_BLOBS 12

// Smooth noise for blob movement
float hash(float n) { return fract(sin(n) * 43758.5453); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

vec2 blobPos(int i, float t) {
  float fi = float(i);
  float speed = 0.2 + hash(fi * 7.3) * 0.3;
  float radius = 0.4 + hash(fi * 13.1) * 0.6;
  float phase = hash(fi * 19.7) * 6.28;
  float phase2 = hash(fi * 31.1) * 6.28;
  
  return vec2(
    sin(t * speed + phase) * radius + sin(t * speed * 1.7 + phase2) * radius * 0.3,
    cos(t * speed * 0.9 + phase * 1.3) * radius + cos(t * speed * 1.3 + phase2 * 0.7) * radius * 0.25
  );
}

float blobRadius(int i, float t, float bass, float mid) {
  float fi = float(i);
  float base = 0.25 + hash(fi * 23.3) * 0.15;
  // Pulse with bass
  base += bass * 0.1 * (1.0 + sin(t * 2.0 + fi * 1.5));
  // Breathe with mid
  base += sin(t * 1.5 + fi * 0.7) * 0.03 * (1.0 + mid);
  return base;
}

void main() {
  vec2 uv = (vUv - 0.5) * 2.0;
  uv.x *= uAspect;
  
  float t = uTime * uSpeed;
  int count = int(uBlobCount);
  
  // Accumulate metaball field
  float field = 0.0;
  float closestBlob = -1.0;
  float closestDist = 100.0;
  
  for (int i = 0; i < MAX_BLOBS; i++) {
    if (i >= count) break;
    
    vec2 pos = blobPos(i, t);
    float r = blobRadius(i, t, uBassEnergy, uMidEnergy);
    
    // Transient kicks certain blobs
    if (uTransient > 0.3 && hash(float(i) * 5.0) > 0.5) {
      pos *= 1.0 + uTransient * 0.3;
      r *= 1.0 + uTransient * 0.5;
    }
    
    float dist = length(uv - pos);
    // Normalized metaball: max contribution = 1.0 per blob
    float contribution = r * r / (dist * dist + r * r);
    field += contribution;
    
    if (dist < closestDist) {
      closestDist = dist;
      closestBlob = float(i);
    }
  }
  
  // Threshold creates the blob surface
  float threshold = uThreshold;
  float surface = smoothstep(threshold - 0.2, threshold + 0.05, field);
  float edge = smoothstep(threshold - 0.05, threshold, field) - smoothstep(threshold, threshold + 0.15, field);
  float inner = smoothstep(threshold + 0.2, threshold + 1.5, field);
  
  // Color by which blob we're closest to + field strength
  float blobMix = fract(closestBlob * 0.25 + uTime * 0.05);
  vec3 col;
  if (blobMix < 0.25) col = mix(uColor1, uColor2, blobMix * 4.0);
  else if (blobMix < 0.5) col = mix(uColor2, uColor3, (blobMix - 0.25) * 4.0);
  else if (blobMix < 0.75) col = mix(uColor3, uColor4, (blobMix - 0.5) * 4.0);
  else col = mix(uColor4, uColor1, (blobMix - 0.75) * 4.0);
  
  // Inner glow - brighter at center
  vec3 innerColor = mix(col, vec3(1.0, 0.95, 0.9), inner * 0.5);
  
  // Edge highlight
  vec3 edgeColor = mix(uColor1, uColor4, sin(uTime * 0.7) * 0.5 + 0.5);
  
  vec3 finalCol = innerColor * surface + edgeColor * edge * 2.0;
  
  // Background: subtle field visualization
  float bgField = field * 0.2;
  vec3 bgCol = mix(uColor3, uColor4, bgField) * 0.05;
  finalCol += bgCol * (1.0 - surface);
  
  // Bass pulse glow
  finalCol += uBassPulse * 0.15 * uColor1 * surface;
  
  // High energy sparkle
  float sparkle = hash2(uv * 50.0 + uTime * 0.1);
  finalCol += step(0.99, sparkle) * uHighEnergy * 0.5 * surface;
  
  // Transient flash
  finalCol += uTransient * 0.2 * vec3(1.0) * surface;
  
  finalCol *= 0.5 + uIntensity * 1.0;
  finalCol = finalCol / (1.0 + finalCol * 0.3);
  
  gl_FragColor = vec4(finalCol, 1.0);
}
`;

export class MetaballsEffect implements VisualEffect {
  name = 'metaballs';
  private mesh: THREE.Mesh | null = null;
  private material: THREE.ShaderMaterial | null = null;

  init(scene: THREE.Scene, _camera: THREE.Camera): void {
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uBassEnergy: { value: 0 },
        uMidEnergy: { value: 0 },
        uHighEnergy: { value: 0 },
        uBassPulse: { value: 0 },
        uTransient: { value: 0 },
        uIntensity: { value: 0.7 },
        uSpeed: { value: 0.5 },
        uBlobCount: { value: 8 },
        uThreshold: { value: 2.0 },
        uAspect: { value: window.innerWidth / window.innerHeight },
        uColor1: { value: new THREE.Color('#FF6B6B') },
        uColor2: { value: new THREE.Color('#4ECDC4') },
        uColor3: { value: new THREE.Color('#45B7D1') },
        uColor4: { value: new THREE.Color('#96CEB4') },
      },
    });
    const geo = new THREE.PlaneGeometry(2, 2);
    this.mesh = new THREE.Mesh(geo, this.material);
    scene.add(this.mesh);
  }

  update(signals: ControlSignals, params: EffectParams, _dt: number, time: number): void {
    if (!this.material) return;
    const u = this.material.uniforms;
    u.uTime.value = time;
    u.uBassEnergy.value = signals.bassEnergy * params.bassReactivity;
    u.uMidEnergy.value = signals.midEnergy * params.midReactivity;
    u.uHighEnergy.value = signals.highEnergy * params.highReactivity;
    u.uBassPulse.value = signals.bassPulse * params.bassReactivity;
    u.uTransient.value = signals.transientPulse * params.onsetReactivity;
    u.uIntensity.value = params.intensity;
    u.uSpeed.value = params.speed;
    u.uBlobCount.value = params.effectParams.blobCount ?? 8;
    u.uThreshold.value = params.effectParams.threshold ?? 1.0;
    u.uAspect.value = window.innerWidth / window.innerHeight;
    u.uColor1.value.set(params.colors[0]);
    u.uColor2.value.set(params.colors[1]);
    u.uColor3.value.set(params.colors[2]);
    u.uColor4.value.set(params.colors[3]);
  }

  dispose(): void {
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh.parent?.remove(this.mesh);
    }
    if (this.material) this.material.dispose();
    this.mesh = null;
    this.material = null;
  }
}
