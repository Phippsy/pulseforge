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
uniform float uSpeed;
uniform float uRadius;
uniform float uTwist;
uniform float uGlow;
uniform float uIntensity;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec3 uColor4;
uniform float uSegments;
uniform float uAspect;

#define PI 3.14159265
#define TAU 6.28318530

mat2 rot(float a) {
  float s = sin(a), c = cos(a);
  return mat2(c, -s, s, c);
}

float hash(float n) { return fract(sin(n) * 43758.5453); }

float noise(vec3 x) {
  vec3 p = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  float n = p.x + p.y * 57.0 + 113.0 * p.z;
  return mix(
    mix(mix(hash(n), hash(n + 1.0), f.x),
        mix(hash(n + 57.0), hash(n + 58.0), f.x), f.y),
    mix(mix(hash(n + 113.0), hash(n + 114.0), f.x),
        mix(hash(n + 170.0), hash(n + 171.0), f.x), f.y), f.z);
}

float fbm(vec3 p) {
  float f = 0.0;
  f += 0.5 * noise(p); p *= 2.01;
  f += 0.25 * noise(p); p *= 2.02;
  f += 0.125 * noise(p); p *= 2.03;
  f += 0.0625 * noise(p);
  return f / 0.9375;
}

vec3 tunnelPath(float z) {
  return vec3(
    sin(z * 0.1) * cos(z * 0.07) * 1.5,
    cos(z * 0.13) * sin(z * 0.09) * 1.0,
    z
  );
}

float tunnelDist(vec3 p, float baseRadius) {
  float rVar = sin(p.z * 0.3 + uTime * 0.5) * 0.15 +
               sin(p.z * 0.7 - uTime * 0.3) * 0.08;
  float breath = uBassPulse * 0.25 * sin(p.z * 0.1 + uTime);
  float r = baseRadius + rVar + breath;
  float angle = atan(p.y, p.x);
  float segDeform = sin(angle * uSegments + p.z * 0.5 + uTime) * 0.06 * uMidEnergy;
  r += segDeform;
  return length(p.xy) - r;
}

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  uv.x *= uAspect;

  float time = uTime * (0.2 + uSpeed * 0.8);
  float baseRadius = uRadius * 1.5 + 0.5;

  float camZ = time * 3.0;
  vec3 ro = tunnelPath(camZ);
  vec3 target = tunnelPath(camZ + 2.0);

  vec3 fwd = normalize(target - ro);
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), fwd));
  vec3 up = cross(fwd, right);

  float sway = uMidEnergy * 0.3;
  uv.x += sin(time * 0.7) * sway * 0.2;
  uv.y += cos(time * 0.5) * sway * 0.15;

  vec3 rd = normalize(uv.x * right + uv.y * up + 1.8 * fwd);

  float twistAmount = uTwist * (1.0 + uMidEnergy * 2.0);
  rd.xy *= rot(time * 0.3 * twistAmount);

  float t = 0.0;
  float totalGlow = 0.0;
  float edgeGlow = 0.0;
  float lightShaft = 0.0;
  vec3 hitPos = ro;
  bool hit = false;

  for (int i = 0; i < 90; i++) {
    vec3 p = ro + rd * t;
    vec3 localP = p - tunnelPath(p.z);
    float twistZ = p.z * 0.03 * twistAmount + sin(time * 0.2) * twistAmount;
    localP.xy *= rot(twistZ);

    float d = tunnelDist(localP, baseRadius);

    totalGlow += 0.015 / (abs(d) + 0.005) * uGlow;

    if (abs(d) < 0.3) {
      edgeGlow += 0.01 / (abs(d) + 0.01);
    }

    // Light shaft / god ray accumulation
    float shaftDist = length(localP.xy);
    float shaftPulse = sin(p.z * 0.8 - time * 4.0) * 0.5 + 0.5;
    lightShaft += exp(-shaftDist * 3.0) * 0.01 * shaftPulse * uBassPulse;
    
    // Pulsing ring highlight
    float ringPhase = fract(p.z * 0.15 - time * 0.5);
    float ringPulse = smoothstep(0.0, 0.02, ringPhase) * smoothstep(0.04, 0.02, ringPhase);
    if (ringPulse > 0.5 && abs(d) < 0.15) {
      edgeGlow += ringPulse * 0.05 * (1.0 + uBassEnergy * 3.0);
    }

    if (d < 0.005) {
      hit = true;
      hitPos = p;
      break;
    }

    t += max(d * 0.4, 0.015);
    if (t > 30.0) break;
  }

  vec3 col = vec3(0.0);
  vec3 localHit = hitPos - tunnelPath(hitPos.z);
  float hitAngle = atan(localHit.y, localHit.x);

  // Multi-layer stripe patterns
  float stripe1 = smoothstep(0.4, 0.6, sin(hitAngle * uSegments + hitPos.z * 0.5 + time * 2.0) * 0.5 + 0.5);
  float stripe2 = smoothstep(0.3, 0.7, sin(hitAngle * uSegments * 2.0 - hitPos.z * 0.3 + time) * 0.5 + 0.5);
  float stripe3 = smoothstep(0.35, 0.65, sin(hitAngle * uSegments * 0.5 + hitPos.z * 0.7 - time * 0.5) * 0.5 + 0.5);
  float wave = sin(hitPos.z * 0.2 + time * 0.5 + uBassEnergy * 3.0) * 0.5 + 0.5;
  
  // Hexagonal grid overlay on walls
  float hexScale = 4.0;
  vec2 hexUV = vec2(hitAngle * hexScale / TAU * uSegments, hitPos.z * 0.3);
  float hex = abs(sin(hexUV.x * 6.28) * sin(hexUV.y * 6.28));
  hex = smoothstep(0.85, 0.95, hex);

  vec3 baseColor = mix(uColor1, uColor2, stripe1);
  baseColor = mix(baseColor, uColor3, stripe2 * 0.5);
  baseColor = mix(baseColor, uColor4, wave * 0.3);
  baseColor += hex * uColor3 * 0.2 * uHighEnergy;

  if (hit) {
    float rim = 1.0 - abs(dot(normalize(localHit.xy), normalize(rd.xy)));
    col = baseColor * (0.3 + rim * 0.7);
    float highlight = pow(stripe1 * stripe2 * stripe3, 1.5) * uBassPulse * 3.0;
    col += uColor1 * highlight;
    
    // Stripe3 adds secondary pattern intensity
    col += uColor4 * stripe3 * 0.15 * uMidEnergy;
  }

  // Volumetric glow
  vec3 glowColor = mix(uColor1, uColor3, sin(time * 0.3) * 0.5 + 0.5);
  col += totalGlow * glowColor * 0.08 * (1.0 + uHighEnergy * 2.0);

  vec3 edgeColor = mix(uColor2, uColor4, sin(time * 0.7 + hitAngle) * 0.5 + 0.5);
  col += edgeGlow * edgeColor * 0.03 * uGlow * (1.0 + uHighEnergy);
  
  // Light shaft / god ray contribution
  vec3 shaftColor = mix(uColor1, uColor2, sin(time * 0.4) * 0.5 + 0.5);
  col += lightShaft * shaftColor * 3.0;

  // Volumetric fog with FBM
  float fogDensity = fbm(vec3(uv * 2.0, time * 0.1)) * 0.3;
  fogDensity += fbm(vec3(uv * 4.0, time * 0.05 + 10.0)) * 0.15;
  vec3 fogColor = mix(uColor4 * 0.3, uColor1 * 0.2, fogDensity);
  col = mix(col, fogColor, smoothstep(10.0, 30.0, t) * 0.5);

  // Distance fog
  col *= exp(-t * 0.04);

  // Transient flash
  float flash = uTransient * 0.6;
  col += flash * mix(uColor1, uColor2, sin(time * 5.0) * 0.5 + 0.5);

  // Bass pulse central glow
  float vignette = length(vUv - 0.5) * 1.414;
  col += uBassPulse * 0.2 * (1.0 - vignette * vignette) * uColor1;
  
  // High energy sparkle at edges
  col += uHighEnergy * edgeGlow * 0.02 * uColor3;

  col *= 0.7 + uIntensity * 0.8;
  col = col / (1.0 + col);

  gl_FragColor = vec4(col, 1.0);
}
`;

export class TunnelEffect implements VisualEffect {
  name = 'tunnel';
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
        uSpeed: { value: 0.5 },
        uRadius: { value: 0.5 },
        uTwist: { value: 0.5 },
        uGlow: { value: 0.7 },
        uIntensity: { value: 0.7 },
        uColor1: { value: new THREE.Color('#FF00FF') },
        uColor2: { value: new THREE.Color('#00FFFF') },
        uColor3: { value: new THREE.Color('#FF1493') },
        uColor4: { value: new THREE.Color('#7B2FBE') },
        uSegments: { value: 6 },
        uAspect: { value: window.innerWidth / window.innerHeight },
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
    u.uSpeed.value = params.effectParams.speed ?? params.speed;
    u.uRadius.value = params.effectParams.radius ?? 0.5;
    u.uTwist.value = params.effectParams.twist ?? 0.5;
    u.uGlow.value = params.effectParams.glow ?? 0.7;
    u.uIntensity.value = params.intensity;
    u.uSegments.value = params.effectParams.segments ?? 6;
    u.uColor1.value.set(params.colors[0]);
    u.uColor2.value.set(params.colors[1]);
    u.uColor3.value.set(params.colors[2]);
    u.uColor4.value.set(params.colors[3]);
    u.uAspect.value = window.innerWidth / window.innerHeight;
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
