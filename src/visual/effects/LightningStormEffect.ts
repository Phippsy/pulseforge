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
uniform float uIntensity;
uniform float uAspect;

// Hash functions
float hash(float n) { return fract(sin(n) * 43758.5453); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

// Value noise
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash2(i);
  float b = hash2(i + vec2(1.0, 0.0));
  float c = hash2(i + vec2(0.0, 1.0));
  float d = hash2(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// FBM for clouds
float fbm(vec2 p) {
  float f = 0.0;
  f += 0.5 * noise(p); p *= 2.01;
  f += 0.25 * noise(p); p *= 2.02;
  f += 0.125 * noise(p); p *= 2.03;
  f += 0.0625 * noise(p);
  return f;
}

// Lightning bolt
float lightning(vec2 p, vec2 start, vec2 end, float time, float seed) {
  float segments = 12.0;
  float bolt = 0.0;
  
  vec2 dir = end - start;
  float len = length(dir);
  vec2 norm = normalize(dir);
  vec2 perp = vec2(-norm.y, norm.x);
  
  vec2 prev = start;
  for (float i = 1.0; i <= 12.0; i++) {
    float t = i / segments;
    // Jagged path
    float offset = (hash(seed + i * 7.3 + floor(time * 8.0)) - 0.5) * 0.15 * (1.0 - abs(t - 0.5) * 2.0);
    vec2 curr = start + dir * t + perp * offset * len;
    
    // Line segment distance
    vec2 pa = p - prev;
    vec2 ba = curr - prev;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    float d = length(pa - ba * h);
    
    float thickness = 0.003 * (1.0 - t * 0.5);
    bolt += smoothstep(thickness * 3.0, 0.0, d) * 0.5;
    bolt += smoothstep(thickness, 0.0, d);
    
    prev = curr;
  }
  
  return bolt;
}

void main() {
  vec2 uv = vUv;
  vec2 p = (uv - 0.5) * vec2(uAspect, 1.0);
  
  // Dark stormy sky
  float cloudTime = uTime * 0.1;
  vec2 cloudUv = p * 2.0 + vec2(cloudTime, 0.0);
  
  float clouds = fbm(cloudUv * 2.0);
  float clouds2 = fbm(cloudUv * 3.0 + vec2(100.0, 50.0));
  
  // Sky gradient: very dark bottom, slightly lighter grey/blue clouds at top
  vec3 col = vec3(0.01, 0.01, 0.02);
  col += vec3(0.03, 0.03, 0.06) * smoothstep(0.0, 0.8, uv.y);
  
  // Cloud layers
  float cloudLayer1 = smoothstep(0.3, 0.7, clouds) * smoothstep(0.5, 0.0, uv.y - 0.5);
  float cloudLayer2 = smoothstep(0.35, 0.75, clouds2) * smoothstep(0.3, 0.0, uv.y - 0.4);
  
  col += vec3(0.08, 0.07, 0.12) * cloudLayer1;
  col += vec3(0.06, 0.05, 0.1) * cloudLayer2;
  
  // === Lightning bolts ===
  // Triggered by bass and transients
  float boltIntensity = 0.0;
  vec3 boltColor = vec3(0.7, 0.8, 1.0);
  
  // Multiple potential bolt positions
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float boltSeed = fi * 13.7;
    
    // Each bolt fires on a pseudo-random schedule, more often with more bass
    float boltTrigger = hash(floor(uTime * (2.0 + uBassEnergy * 4.0) + fi * 3.0) + boltSeed);
    
    if (boltTrigger > 0.7 || (uTransient > 0.5 && fi < 2.0)) {
      // Bolt start (cloud layer) and end (ground or mid-air)
      float startX = (hash(boltSeed + floor(uTime * 2.0)) - 0.5) * 0.8;
      float endX = startX + (hash(boltSeed + floor(uTime * 2.0) + 100.0) - 0.5) * 0.3;
      
      vec2 boltStart = vec2(startX, 0.3 + hash(boltSeed + 50.0) * 0.15);
      vec2 boltEnd = vec2(endX, -0.3 - hash(boltSeed + 70.0) * 0.15);
      
      float bolt = lightning(p, boltStart, boltEnd, uTime, boltSeed + uTime);
      boltIntensity += bolt;
      
      // Branch lightning
      float branchPoint = 0.3 + hash(boltSeed + 200.0) * 0.4;
      vec2 branchStart = mix(boltStart, boltEnd, branchPoint);
      vec2 branchEnd = branchStart + vec2((hash(boltSeed + 300.0) - 0.5) * 0.3, -0.15);
      float branch = lightning(p, branchStart, branchEnd, uTime, boltSeed + 500.0) * 0.6;
      boltIntensity += branch;
    }
  }
  
  // Lightning colour and glow
  col += boltColor * boltIntensity;
  
  // Sky illumination from lightning (whole sky lights up)
  float skyFlash = min(boltIntensity * 0.3, 0.5);
  col += vec3(0.2, 0.2, 0.35) * skyFlash;
  
  // Cloud underlighting from bolts
  col += vec3(0.15, 0.1, 0.25) * skyFlash * cloudLayer1;
  col += vec3(0.1, 0.1, 0.2) * skyFlash * cloudLayer2;
  
  // === Rain ===
  float rainAmount = 0.5 + uHighEnergy * 0.5;
  vec2 rainUv = uv * vec2(80.0, 20.0);
  rainUv.y += uTime * 15.0;
  
  float rainDrop = hash2(floor(rainUv));
  float rainFrac = fract(rainUv.y);
  float rain = step(1.0 - rainAmount * 0.03, rainDrop) * smoothstep(0.0, 0.3, rainFrac) * smoothstep(1.0, 0.7, rainFrac);
  col += vec3(0.2, 0.25, 0.4) * rain * 0.3;
  
  // === Ground ===
  if (uv.y < 0.15) {
    float groundLevel = 0.15;
    // Dark ground with puddle reflections
    col = vec3(0.01, 0.01, 0.015);
    
    // Puddle reflections of lightning
    float puddle = smoothstep(0.5, 0.6, noise(uv * vec2(10.0, 3.0) + uTime * 0.1));
    col += boltColor * boltIntensity * puddle * 0.3 * (1.0 - uv.y / groundLevel);
    
    // Wet ground shimmer
    col += vec3(0.02) * noise(uv * 50.0 + uTime * 0.5);
  }
  
  // === Distant city silhouette ===
  float buildingX = uv.x * 30.0;
  float buildingHash = hash(floor(buildingX));
  float buildingHeight = 0.15 + buildingHash * 0.12;
  float buildingShape = step(uv.y, buildingHeight) * step(0.15, uv.y);
  // Window lights
  vec2 winUv = vec2(fract(buildingX) * 4.0, (uv.y - 0.15) * 20.0);
  float window = step(0.3, fract(winUv.x)) * step(fract(winUv.x), 0.7) *
                 step(0.3, fract(winUv.y)) * step(fract(winUv.y), 0.7);
  float windowLit = step(0.5, hash2(floor(winUv) + floor(buildingX) * 10.0));
  
  col = mix(col, vec3(0.005), buildingShape);
  col += vec3(1.0, 0.8, 0.4) * window * windowLit * buildingShape * 0.3;
  
  // Building silhouette illuminated by lightning
  col += vec3(0.05, 0.05, 0.1) * buildingShape * skyFlash;
  
  // Transient = massive bolt + full sky flash
  col += vec3(0.3, 0.3, 0.5) * uTransient * 0.3;
  
  col *= uIntensity;
  gl_FragColor = vec4(col, 1.0);
}
`;

export class LightningStormEffect implements VisualEffect {
  name = 'lightning';
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
        uIntensity: { value: 1.0 },
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
    u.uIntensity.value = params.intensity;
    u.uAspect.value = window.innerWidth / window.innerHeight;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.mesh.parent?.remove(this.mesh);
  }
}
