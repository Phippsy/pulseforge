import * as THREE from 'three';
import type { ControlSignals } from '../../store';
import type { VisualEffect, EffectParams } from './types';

const vertexShader = `
attribute float aSize;
attribute float aLife;
attribute float aSpeed;
attribute vec3 aOffset;
attribute float aLayer;

uniform float uTime;
uniform float uBassPulse;
uniform float uMidEnergy;
uniform float uHighEnergy;
uniform float uTransient;
uniform float uParticleSize;
uniform float uTurbulence;
uniform float uIntensity;
uniform float uSpiralStrength;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec3 uColor4;

varying float vAlpha;
varying vec3 vColor;
varying float vGlow;
varying float vDist;

// Better hash
float hash31(vec3 p) {
  p = fract(p * vec3(443.897, 441.423, 437.195));
  p += dot(p, p.yzx + 19.19);
  return fract((p.x + p.y) * p.z);
}

vec3 hash33(vec3 p) {
  p = vec3(dot(p,vec3(127.1,311.7,74.7)),
            dot(p,vec3(269.5,183.3,246.1)),
            dot(p,vec3(113.5,271.9,124.6)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

// Gradient noise for smoother curl
float gnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f*f*(3.0-2.0*f);
  return mix(mix(mix(dot(hash33(i+vec3(0,0,0)),f-vec3(0,0,0)),
                     dot(hash33(i+vec3(1,0,0)),f-vec3(1,0,0)),u.x),
                 mix(dot(hash33(i+vec3(0,1,0)),f-vec3(0,1,0)),
                     dot(hash33(i+vec3(1,1,0)),f-vec3(1,1,0)),u.x),u.y),
             mix(mix(dot(hash33(i+vec3(0,0,1)),f-vec3(0,0,1)),
                     dot(hash33(i+vec3(1,0,1)),f-vec3(1,0,1)),u.x),
                 mix(dot(hash33(i+vec3(0,1,1)),f-vec3(0,1,1)),
                     dot(hash33(i+vec3(1,1,1)),f-vec3(1,1,1)),u.x),u.y),u.z);
}

vec3 curlNoise(vec3 p, float t) {
  float e = 0.05;
  vec3 dx = vec3(e, 0.0, 0.0);
  vec3 dy = vec3(0.0, e, 0.0);
  vec3 dz = vec3(0.0, 0.0, e);
  vec3 pp = p + t * 0.2;
  
  float x = gnoise(pp + dy) - gnoise(pp - dy);
  float y = gnoise(pp + dz) - gnoise(pp - dz);
  float z = gnoise(pp + dx) - gnoise(pp - dx);
  
  return vec3(x - z, z - y, y - x) / (2.0 * e);
}

void main() {
  float life = fract(aLife + uTime * aSpeed * 0.08);
  float fadeIn = smoothstep(0.0, 0.15, life);
  float fadeOut = 1.0 - smoothstep(0.85, 1.0, life);
  float alpha = fadeIn * fadeOut;
  
  vec3 pos = position;
  
  // Multi-scale curl noise displacement
  vec3 curl1 = curlNoise(pos * 0.15 + aOffset * 0.01, uTime * 0.5) * uTurbulence * 4.0;
  vec3 curl2 = curlNoise(pos * 0.4 + aOffset * 0.02, uTime * 0.8) * uTurbulence * 1.5;
  pos += curl1 * (0.6 + uMidEnergy * 2.5);
  pos += curl2 * uHighEnergy * 1.5;
  
  // Galaxy spiral motion
  float dist = length(pos.xz);
  float spiralAngle = atan(pos.z, pos.x);
  float spiralForce = uSpiralStrength * (1.0 + uMidEnergy * 0.8);
  float newAngle = spiralAngle + spiralForce * 0.05 / (dist * 0.1 + 0.5);
  pos.x = cos(newAngle) * dist;
  pos.z = sin(newAngle) * dist;
  
  // Layer-based motion: some particles orbit, some flow
  float orbitPhase = uTime * aSpeed * 0.3 + aLife * 6.28;
  if (aLayer < 0.33) {
    // Tight orbital ring
    float orbitR = 2.0 + sin(aLife * 20.0) * 1.5;
    pos.x += cos(orbitPhase) * orbitR * 0.2 * uMidEnergy;
    pos.z += sin(orbitPhase) * orbitR * 0.2 * uMidEnergy;
    pos.y += sin(orbitPhase * 0.7) * 0.5;
  } else if (aLayer < 0.66) {
    // Rising/falling streams
    pos.y += sin(uTime * 0.5 + aLife * 10.0) * uBassPulse * 3.0;
    pos.x += sin(uTime * 0.3 + aOffset.x) * 0.5;
  } else {
    // Outer swarm - chaotic
    pos += curlNoise(pos * 0.3, uTime * 1.2) * uHighEnergy * 2.0;
  }
  
  // Bass-reactive expansion with wave
  float bassWave = sin(dist * 0.5 - uTime * 3.0) * uBassPulse * 0.3;
  float expansion = 1.0 + uBassPulse * 0.3 + bassWave;
  pos *= expansion;
  
  // Transient burst - dramatic outward explosion
  float burst = uTransient * 3.0;
  vec3 burstDir = normalize(pos + 0.001);
  pos += burstDir * burst * aSize * (0.5 + aLayer);
  
  // Size varies with audio, layer, distance
  float size = aSize * uParticleSize;
  size *= (1.0 + uBassPulse * 2.0);
  size *= (0.6 + uHighEnergy * 1.0);
  size *= (0.7 + aLayer * 0.6); // outer layer = bigger
  
  // Rich colour palette cycling
  float colorPhase = fract(aLife * 4.0 + uTime * 0.04 + uBassPulse * 0.2 + aLayer * 0.5);
  float colorShift = sin(uTime * 0.3 + dist * 0.2) * 0.1;
  colorPhase = fract(colorPhase + colorShift);
  
  if (colorPhase < 0.25) {
    vColor = mix(uColor1, uColor2, colorPhase * 4.0);
  } else if (colorPhase < 0.5) {
    vColor = mix(uColor2, uColor3, (colorPhase - 0.25) * 4.0);
  } else if (colorPhase < 0.75) {
    vColor = mix(uColor3, uColor4, (colorPhase - 0.5) * 4.0);
  } else {
    vColor = mix(uColor4, uColor1, (colorPhase - 0.75) * 4.0);
  }
  
  // Brighten based on energy and proximity to center
  float centerBright = exp(-dist * 0.1) * 0.3;
  vColor += uHighEnergy * 0.25 + centerBright * uBassPulse;
  
  // Transient flash - all particles briefly white-hot
  vColor = mix(vColor, vec3(1.0, 0.9, 0.8), uTransient * 0.3);
  
  vAlpha = alpha * (0.4 + uIntensity * 0.6);
  vGlow = uBassPulse * 0.6 + uHighEnergy * 0.4 + uTransient * 0.3;
  vDist = dist;
  
  vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPos;
  gl_PointSize = size * (450.0 / -mvPos.z);
}
`;

const fragmentShader = `
varying float vAlpha;
varying vec3 vColor;
varying float vGlow;
varying float vDist;

void main() {
  vec2 center = gl_PointCoord - 0.5;
  float d = length(center) * 2.0;
  
  // Multi-layer glow with anamorphic streak
  float core = exp(-d * d * 12.0);
  float halo = exp(-d * d * 3.0);
  float outer = exp(-d * 1.2) * 0.4;
  
  // Anamorphic horizontal streak (cinematic)
  float streakH = exp(-abs(center.y) * 12.0) * exp(-abs(center.x) * 3.0) * 0.3;
  
  float alpha = (core + halo * 0.5 + outer * vGlow + streakH * vGlow) * vAlpha;
  vec3 col = vColor * (core * 2.5 + halo * 1.2 + outer * 0.5 + streakH);
  
  // White-hot center
  col += vec3(1.0, 0.95, 0.9) * core * 0.7 * (1.0 + vGlow);
  
  // Subtle color shift at edges
  col.r += outer * 0.1 * (1.0 + vGlow);
  col.b += halo * 0.05;
  
  if (alpha < 0.005) discard;
  gl_FragColor = vec4(col, alpha);
}
`;

export class ParticleField implements VisualEffect {
  name = 'particles';
  private points: THREE.Points | null = null;
  private material: THREE.ShaderMaterial | null = null;
  private geometry: THREE.BufferGeometry | null = null;
  private positions!: Float32Array;
  private velocities!: Float32Array;
  private sizes!: Float32Array;
  private lives!: Float32Array;
  private speeds!: Float32Array;
  private offsets!: Float32Array;
  private layers!: Float32Array;
  private count = 4000;
  private spread = 24;

  init(scene: THREE.Scene, _camera: THREE.Camera): void {
    this.geometry = new THREE.BufferGeometry();
    this.positions = new Float32Array(this.count * 3);
    this.velocities = new Float32Array(this.count * 3);
    this.sizes = new Float32Array(this.count);
    this.lives = new Float32Array(this.count);
    this.speeds = new Float32Array(this.count);
    this.offsets = new Float32Array(this.count * 3);
    this.layers = new Float32Array(this.count);

    for (let i = 0; i < this.count; i++) {
      // Distribute in a sphere with density falloff
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = Math.pow(Math.random(), 0.4) * this.spread * 0.5;
      this.positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      this.positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      this.positions[i * 3 + 2] = r * Math.cos(phi);
      this.velocities[i * 3] = (Math.random() - 0.5) * 0.012;
      this.velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.012;
      this.velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.012;
      this.sizes[i] = 0.2 + Math.random() * 0.8;
      this.lives[i] = Math.random();
      this.speeds[i] = 0.2 + Math.random() * 0.8;
      this.offsets[i * 3] = Math.random() * 100;
      this.offsets[i * 3 + 1] = Math.random() * 100;
      this.offsets[i * 3 + 2] = Math.random() * 100;
      this.layers[i] = Math.random(); // 0-0.33 orbital, 0.33-0.66 stream, 0.66-1 swarm
    }

    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1));
    this.geometry.setAttribute('aLife', new THREE.BufferAttribute(this.lives, 1));
    this.geometry.setAttribute('aSpeed', new THREE.BufferAttribute(this.speeds, 1));
    this.geometry.setAttribute('aOffset', new THREE.BufferAttribute(this.offsets, 3));
    this.geometry.setAttribute('aLayer', new THREE.BufferAttribute(this.layers, 1));

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uBassPulse: { value: 0 },
        uMidEnergy: { value: 0 },
        uHighEnergy: { value: 0 },
        uTransient: { value: 0 },
        uParticleSize: { value: 3 },
        uTurbulence: { value: 0.3 },
        uSpiralStrength: { value: 1.0 },
        uIntensity: { value: 0.7 },
        uColor1: { value: new THREE.Color('#ffffff') },
        uColor2: { value: new THREE.Color('#ff6600') },
        uColor3: { value: new THREE.Color('#0066ff') },
        uColor4: { value: new THREE.Color('#ff00ff') },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    scene.add(this.points);
  }

  update(signals: ControlSignals, params: EffectParams, dt: number, time: number): void {
    if (!this.material || !this.geometry) return;
    const u = this.material.uniforms;
    u.uTime.value = time;
    u.uBassPulse.value = signals.bassPulse * params.bassReactivity;
    u.uMidEnergy.value = signals.midEnergy * params.midReactivity;
    u.uHighEnergy.value = signals.highEnergy * params.highReactivity;
    u.uTransient.value = signals.transientPulse * params.onsetReactivity;
    u.uParticleSize.value = params.effectParams.particleSize ?? 3;
    u.uTurbulence.value = params.effectParams.turbulence ?? 0.3;
    u.uSpiralStrength.value = params.effectParams.spiralStrength ?? 1.0;
    u.uIntensity.value = params.intensity;
    u.uColor1.value.set(params.colors[0]);
    u.uColor2.value.set(params.colors[1]);
    u.uColor3.value.set(params.colors[2]);
    u.uColor4.value.set(params.colors[3]);

    // Update positions in JS for organic drift
    const speed = params.speed * (0.5 + signals.midEnergy * params.midReactivity);
    const posAttr = this.geometry.attributes.position as THREE.BufferAttribute;
    const halfSpread = this.spread * 0.6;

    for (let i = 0; i < this.count; i++) {
      const ix = i * 3, iy = i * 3 + 1, iz = i * 3 + 2;

      // Gentle drift
      this.positions[ix] += this.velocities[ix] * speed * 50 * dt;
      this.positions[iy] += this.velocities[iy] * speed * 50 * dt;
      this.positions[iz] += this.velocities[iz] * speed * 50 * dt;

      // Gentle attraction toward center (keeps field coherent)
      const dist = Math.sqrt(
        this.positions[ix] ** 2 + this.positions[iy] ** 2 + this.positions[iz] ** 2
      );
      if (dist > halfSpread) {
        const pull = (dist - halfSpread) * 0.001;
        this.positions[ix] -= (this.positions[ix] / dist) * pull;
        this.positions[iy] -= (this.positions[iy] / dist) * pull;
        this.positions[iz] -= (this.positions[iz] / dist) * pull;
      }

      // Onset burst: randomize velocity outward
      if (signals.transientPulse > 0.7 && Math.random() < 0.05) {
        const burstDir = dist > 0.1 ? 1 / dist : 1;
        this.velocities[ix] = this.positions[ix] * burstDir * 0.05;
        this.velocities[iy] = this.positions[iy] * burstDir * 0.05;
        this.velocities[iz] = this.positions[iz] * burstDir * 0.05;
      }
    }
    posAttr.needsUpdate = true;
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
