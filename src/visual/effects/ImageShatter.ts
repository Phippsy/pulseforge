import * as THREE from 'three';
import type { ControlSignals } from '../../store';
import type { VisualEffect, EffectParams } from './types';

const vertexShader = `
attribute vec2 aUvCoord;
attribute float aIndex;
attribute float aRandom;

uniform float uTime;
uniform float uBassEnergy;
uniform float uMidEnergy;
uniform float uTransient;
uniform float uExplosionForce;
uniform float uReformStrength;
uniform float uIntensity;
uniform sampler2D uTexture;
uniform float uHasTexture;

varying vec2 vUv;
varying float vAlpha;
varying float vIndex;
varying vec3 vColor;

// Noise for unique per-shard motion
float hash(float n) { return fract(sin(n) * 43758.5453); }

vec3 hashVec3(float n) {
  return vec3(
    hash(n),
    hash(n + 127.1),
    hash(n + 269.5)
  ) * 2.0 - 1.0;
}

void main() {
  vUv = aUvCoord;
  vIndex = aIndex;
  
  // Each shard has a unique explosion direction based on its index
  vec3 explosionDir = normalize(hashVec3(aIndex * 13.7));
  float shardPhase = hash(aIndex * 7.3);
  
  // Staggered explosion - different shards explode at different times
  float explodeTime = uTime * 2.0 - shardPhase * 2.0;
  float explodeFactor = smoothstep(0.0, 1.0, explodeTime) * uExplosionForce;
  
  // Bass energy pushes shards outward further
  explodeFactor *= 1.0 + uBassEnergy * 1.5;
  
  // Transient bursts scatter extra
  float transientBurst = uTransient * (0.5 + hash(aIndex * 3.1) * 0.5) * 3.0;
  
  vec3 pos = position;
  
  // Explosion displacement
  pos += explosionDir * explodeFactor * (1.0 + aRandom * 0.5);
  pos += explosionDir * transientBurst;
  
  // Rotation per shard
  float rotAngle = explodeFactor * (aRandom - 0.5) * 6.28 + uMidEnergy * shardPhase * 3.0;
  float cr = cos(rotAngle), sr = sin(rotAngle);
  vec3 localPos = pos - position;
  // Rotate around explosion direction (simplified - rotate in XY)
  pos.x = position.x + localPos.x * cr - localPos.y * sr + explosionDir.x * explodeFactor * (1.0 + aRandom * 0.5);
  pos.y = position.y + localPos.x * sr + localPos.y * cr + explosionDir.y * explodeFactor * (1.0 + aRandom * 0.5);
  pos.z = position.z + explosionDir.z * explodeFactor * (1.0 + aRandom * 0.5) + transientBurst * explosionDir.z;
  
  // Gravity and turbulence
  pos.y -= explodeFactor * explodeFactor * 0.1; // Gravity
  pos += sin(uTime * 2.0 + aIndex) * 0.02 * uMidEnergy; // Turbulence
  
  // Reform: pull back toward original position
  float reform = uReformStrength * (1.0 - explodeFactor * 0.3);
  pos = mix(pos, position, reform * (0.5 + uBassEnergy * 0.5));
  
  // Fade out far shards
  float dist = length(pos);
  vAlpha = (1.0 - smoothstep(5.0, 12.0, dist)) * uIntensity;
  vAlpha *= 0.5 + uBassEnergy * 0.5;
  
  // Sample texture colour for this shard or use procedural
  if (uHasTexture > 0.5) {
    vColor = vec3(1.0); // Will sample in fragment
  } else {
    // Procedural gradient based on position
    vColor = mix(vec3(1.0, 0.3, 0.5), vec3(0.3, 0.5, 1.0), aUvCoord.y);
  }
  
  vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPos;
  gl_PointSize = (8.0 + aRandom * 6.0) * uIntensity * (300.0 / -mvPos.z);
  gl_PointSize *= 1.0 + uBassEnergy * 0.5;
}
`;

const fragmentShader = `
uniform sampler2D uTexture;
uniform float uHasTexture;
uniform float uTime;
uniform float uIntensity;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;

varying vec2 vUv;
varying float vAlpha;
varying float vIndex;
varying vec3 vColor;

void main() {
  vec2 pc = gl_PointCoord;
  
  // Slight square-ish shape for "shard" feel
  float shape = max(abs(pc.x - 0.5), abs(pc.y - 0.5));
  float alpha = 1.0 - smoothstep(0.3, 0.5, shape);
  
  vec3 col;
  if (uHasTexture > 0.5) {
    col = texture2D(uTexture, vUv).rgb;
  } else {
    // Procedural colored shards
    float t = fract(vIndex * 0.1 + uTime * 0.05);
    if (t < 0.33) col = mix(uColor1, uColor2, t * 3.0);
    else if (t < 0.66) col = mix(uColor2, uColor3, (t - 0.33) * 3.0);
    else col = mix(uColor3, uColor1, (t - 0.66) * 3.0);
  }
  
  // Edge glow
  float edge = smoothstep(0.2, 0.4, shape) * (1.0 - smoothstep(0.4, 0.5, shape));
  col += edge * uColor1 * 0.3;
  
  alpha *= vAlpha;
  if (alpha < 0.01) discard;
  
  gl_FragColor = vec4(col, alpha);
}
`;

export class ImageShatter implements VisualEffect {
  name = 'imageShatter';
  private points: THREE.Points | null = null;
  private material: THREE.ShaderMaterial | null = null;
  private geometry: THREE.BufferGeometry | null = null;
  private texture: THREE.Texture | null = null;
  private defaultTexture: THREE.Texture | null = null;
  private shardCount = 3000;

  private generateDefaultTexture(): THREE.Texture {
    // Generate a vivid procedural texture so the effect always looks good
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    
    // Bold gradient background
    const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
    grad.addColorStop(0, '#FF00FF');
    grad.addColorStop(0.3, '#00FFFF');
    grad.addColorStop(0.6, '#FF6B6B');
    grad.addColorStop(1, '#4400AA');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    
    // Add geometric patterns
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = 20 + Math.random() * 80;
      const hue = Math.random() * 360;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${hue}, 100%, 60%, 0.5)`;
      ctx.fill();
    }
    
    // Add lines/structure
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 15; i++) {
      ctx.beginPath();
      ctx.moveTo(Math.random() * size, Math.random() * size);
      ctx.lineTo(Math.random() * size, Math.random() * size);
      ctx.stroke();
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  init(scene: THREE.Scene, _camera: THREE.Camera): void {
    // Create default texture immediately
    this.defaultTexture = this.generateDefaultTexture();
    
    this.geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.shardCount * 3);
    const uvCoords = new Float32Array(this.shardCount * 2);
    const indices = new Float32Array(this.shardCount);
    const randoms = new Float32Array(this.shardCount);

    const gridSize = Math.ceil(Math.sqrt(this.shardCount));
    for (let i = 0; i < this.shardCount; i++) {
      const gx = (i % gridSize) / gridSize;
      const gy = Math.floor(i / gridSize) / gridSize;

      positions[i * 3] = (gx - 0.5) * 4;
      positions[i * 3 + 1] = (gy - 0.5) * 3;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 0.1;

      uvCoords[i * 2] = gx;
      uvCoords[i * 2 + 1] = gy;

      indices[i] = i;
      randoms[i] = Math.random();
    }

    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute('aUvCoord', new THREE.BufferAttribute(uvCoords, 2));
    this.geometry.setAttribute('aIndex', new THREE.BufferAttribute(indices, 1));
    this.geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uBassEnergy: { value: 0 },
        uMidEnergy: { value: 0 },
        uTransient: { value: 0 },
        uExplosionForce: { value: 1.0 },
        uReformStrength: { value: 0.0 },
        uIntensity: { value: 0.7 },
        uTexture: { value: this.defaultTexture },
        uHasTexture: { value: 1 }, // Always show texture (default or user)
        uColor1: { value: new THREE.Color('#FF6B6B') },
        uColor2: { value: new THREE.Color('#4ECDC4') },
        uColor3: { value: new THREE.Color('#45B7D1') },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    scene.add(this.points);
  }

  setTexture(texture: THREE.Texture): void {
    this.texture = texture;
    if (this.material) {
      this.material.uniforms.uTexture.value = texture;
      this.material.uniforms.uHasTexture.value = 1;
    }
  }

  update(signals: ControlSignals, params: EffectParams, _dt: number, time: number): void {
    if (!this.material) return;
    const u = this.material.uniforms;
    u.uTime.value = time;
    u.uBassEnergy.value = signals.bassEnergy * params.bassReactivity;
    u.uMidEnergy.value = signals.midEnergy * params.midReactivity;
    u.uTransient.value = signals.transientPulse * params.onsetReactivity;
    u.uExplosionForce.value = params.effectParams.explosionForce ?? 1.0;
    u.uReformStrength.value = params.effectParams.reformStrength ?? 0.0;
    u.uIntensity.value = params.intensity;
    u.uColor1.value.set(params.colors[0]);
    u.uColor2.value.set(params.colors[1]);
    u.uColor3.value.set(params.colors[2]);

    // Cycle between explosion and reformation based on beat phase
    const cycle = Math.sin(time * 0.3 * params.speed) * 0.5 + 0.5;
    u.uExplosionForce.value = (params.effectParams.explosionForce ?? 1.0) * (0.3 + cycle * 0.7);
    u.uReformStrength.value = (1 - cycle) * (0.5 + signals.bassEnergy * 0.5);

    if (this.points) {
      this.points.rotation.y += 0.002 * params.speed;
      this.points.rotation.x = Math.sin(time * 0.1) * 0.1;
    }
  }

  dispose(): void {
    if (this.points) this.points.parent?.remove(this.points);
    if (this.geometry) this.geometry.dispose();
    if (this.material) this.material.dispose();
    if (this.texture) this.texture.dispose();
    if (this.defaultTexture) this.defaultTexture.dispose();
    this.points = null;
    this.geometry = null;
    this.material = null;
    this.texture = null;
    this.defaultTexture = null;
  }
}
