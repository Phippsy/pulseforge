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

#define MAX_BLOBS 20

float hash(float n) { return fract(sin(n) * 43758.5453); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

vec2 blobPos(int i, float t) {
  float fi = float(i);
  float speed = 0.15 + hash(fi * 7.3) * 0.35;
  float radius = 0.3 + hash(fi * 13.1) * 0.7;
  float phase = hash(fi * 19.7) * 6.28;
  float phase2 = hash(fi * 31.1) * 6.28;
  float phase3 = hash(fi * 43.7) * 6.28;
  
  // Complex Lissajous paths for organic movement
  vec2 pos = vec2(
    sin(t * speed + phase) * radius + sin(t * speed * 1.7 + phase2) * radius * 0.4,
    cos(t * speed * 0.8 + phase * 1.3) * radius + cos(t * speed * 1.4 + phase3) * radius * 0.35
  );
  
  // Slow drift cycle: blobs cluster then spread (congealing)
  float cycle = sin(t * 0.1 + fi * 0.5) * 0.3;
  pos *= 0.8 + cycle;
  
  return pos;
}

float blobRadius(int i, float t, float bass, float mid, float high) {
  float fi = float(i);
  float base = 0.2 + hash(fi * 23.3) * 0.2;
  // Larger pulsing with bass
  base += bass * 0.15 * (1.0 + sin(t * 2.5 + fi * 1.5));
  // Breathe with mid
  base += sin(t * 1.5 + fi * 0.7) * 0.05 * (1.0 + mid);
  // High shimmer
  base += high * 0.03 * sin(t * 5.0 + fi * 3.0);
  // Size variation over time
  base *= 0.7 + sin(t * 0.3 + fi * 2.1) * 0.4;
  return max(base, 0.05);
}

void main() {
  vec2 uv = (vUv - 0.5) * 2.0;
  uv.x *= uAspect;
  
  float t = uTime * uSpeed;
  int count = int(uBlobCount);
  
  float field = 0.0;
  vec3 weightedColor = vec3(0.0);
  float totalWeight = 0.0;
  
  // Bass drives attraction toward center (congeal)
  float attract = uBassEnergy * 0.4;
  // Transient scatters blobs apart
  float scatter = uTransient * 0.6;
  
  for (int i = 0; i < MAX_BLOBS; i++) {
    if (i >= count) break;
    
    float fi = float(i);
    vec2 pos = blobPos(i, t);
    float r = blobRadius(i, t, uBassEnergy, uMidEnergy, uHighEnergy);
    
    // Congeal on bass, scatter on transient
    pos *= 1.0 - attract * 0.3 + scatter * hash(fi * 5.0);
    
    float dist = length(uv - pos);
    float contribution = r * r / (dist * dist + r * 0.01);
    field += contribution;
    
    // Weighted colour blend based on contribution
    float colorPhase = fract(fi * 0.17 + t * 0.03);
    vec3 blobCol;
    if (colorPhase < 0.25) blobCol = mix(uColor1, uColor2, colorPhase * 4.0);
    else if (colorPhase < 0.5) blobCol = mix(uColor2, uColor3, (colorPhase - 0.25) * 4.0);
    else if (colorPhase < 0.75) blobCol = mix(uColor3, uColor4, (colorPhase - 0.5) * 4.0);
    else blobCol = mix(uColor4, uColor1, (colorPhase - 0.75) * 4.0);
    
    weightedColor += blobCol * contribution;
    totalWeight += contribution;
  }
  
  if (totalWeight > 0.0) weightedColor /= totalWeight;
  
  float threshold = uThreshold;
  float surface = smoothstep(threshold * 0.6, threshold, field);
  float edge = smoothstep(threshold * 0.85, threshold, field) - smoothstep(threshold, threshold * 1.2, field);
  float inner = smoothstep(threshold * 1.5, threshold * 4.0, field);
  
  // Colour = weighted blend of all contributing blobs
  vec3 col = weightedColor;
  
  // Inner: brighter, slightly white hot-center
  col = mix(col, col + vec3(0.3, 0.25, 0.2), inner * 0.6);
  
  // Edge glow
  vec3 edgeColor = mix(uColor1, uColor3, sin(t * 0.5) * 0.5 + 0.5);
  col += edgeColor * edge * 1.5;
  
  // Apply surface mask
  vec3 finalCol = col * surface;
  
  // Background: subtle energy field
  float bgGlow = smoothstep(0.0, threshold * 0.5, field) * (1.0 - surface);
  vec3 bgCol = weightedColor * bgGlow * 0.12;
  finalCol += bgCol;
  
  // Bass pulse glow on surface
  finalCol += uBassPulse * 0.2 * uColor1 * surface;
  
  // Iridescent sheen on edges
  float iri = sin(field * 8.0 + t * 2.0) * 0.5 + 0.5;
  finalCol += edge * iri * 0.3 * mix(uColor2, uColor4, iri);
  
  // Sparkle in high regions
  float sparkle = hash2(uv * 80.0 + t * 0.2);
  finalCol += step(0.985, sparkle) * uHighEnergy * 0.6 * surface;
  
  // Transient flash
  finalCol += uTransient * 0.3 * vec3(1.0, 0.95, 0.9) * surface;
  
  finalCol *= 0.5 + uIntensity * 1.0;
  finalCol = finalCol / (1.0 + finalCol * 0.25);
  
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
        uBlobCount: { value: 16 },
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
    u.uBlobCount.value = params.effectParams.blobCount ?? 16;
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
