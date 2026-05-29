import * as THREE from 'three';
import type { ControlSignals } from '../../store';
import type { VisualEffect, EffectParams } from './types';

/**
 * Terrain Effect - 3D audio-reactive landscape/mountain
 * Classic demo scene effect where audio drives terrain height
 * Perspective fly-over of generated terrain
 */

const vertexShader = `
uniform float uTime;
uniform float uBassEnergy;
uniform float uMidEnergy;
uniform float uHighEnergy;
uniform float uSpeed;
uniform float uIntensity;

varying vec2 vUv;
varying float vHeight;
varying float vFog;

// Simple noise for terrain
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float f = 0.0;
  f += 0.5000 * noise(p); p *= 2.02;
  f += 0.2500 * noise(p); p *= 2.03;
  f += 0.1250 * noise(p); p *= 2.01;
  f += 0.0625 * noise(p);
  return f;
}

void main() {
  vUv = uv;
  
  float t = uTime * uSpeed * 0.3;
  
  // Scrolling terrain
  vec2 terrainPos = position.xz + vec2(0.0, t * 2.0);
  
  // Multi-octave terrain height
  float h = fbm(terrainPos * 0.5) * 2.0;
  h += fbm(terrainPos * 1.5 + 3.7) * 0.5;
  
  // Audio modulation
  h *= 0.5 + uBassEnergy * 1.0;
  h += sin(terrainPos.x * 3.0 + uTime * 2.0) * uMidEnergy * 0.3;
  h += noise(terrainPos * 5.0 + uTime) * uHighEnergy * 0.2;
  
  vHeight = h;
  
  vec3 pos = position;
  pos.y += h * uIntensity;
  
  // Distance fog factor
  vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
  vFog = smoothstep(2.0, 15.0, -mvPos.z);
  
  gl_Position = projectionMatrix * mvPos;
}
`;

const fragmentShader = `
precision highp float;

varying vec2 vUv;
varying float vHeight;
varying float vFog;

uniform float uTime;
uniform float uBassEnergy;
uniform float uTransient;
uniform float uIntensity;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec3 uColor4;

void main() {
  // Height-based colouring
  float h = vHeight;
  vec3 col;
  
  if (h < 0.5) {
    col = mix(uColor1, uColor2, h * 2.0);
  } else if (h < 1.5) {
    col = mix(uColor2, uColor3, (h - 0.5));
  } else {
    col = mix(uColor3, uColor4, min(1.0, (h - 1.5) * 0.5));
  }
  
  // Wireframe grid lines
  vec2 grid = abs(fract(vUv * 40.0) - 0.5);
  float line = smoothstep(0.02, 0.0, min(grid.x, grid.y));
  col += vec3(0.2) * line;
  
  // Glow at peaks
  col += uColor4 * max(0.0, h - 1.5) * 0.3;
  
  // Bass pulse
  col += uColor1 * uBassEnergy * 0.2;
  
  // Transient highlight
  col += vec3(1.0) * uTransient * 0.2;
  
  // Fog: blend to dark at distance
  vec3 fogColor = uColor1 * 0.1;
  col = mix(col, fogColor, vFog);
  
  col *= uIntensity;
  
  gl_FragColor = vec4(col, 1.0);
}
`;

export class TerrainEffect implements VisualEffect {
  name = 'terrain';
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
        uSpeed: { value: 1.0 },
        uColor1: { value: new THREE.Color('#0a0020') },
        uColor2: { value: new THREE.Color('#1a0050') },
        uColor3: { value: new THREE.Color('#ff00ff') },
        uColor4: { value: new THREE.Color('#00ffff') },
      },
      vertexShader,
      fragmentShader,
      side: THREE.DoubleSide,
      wireframe: false,
    });

    // Create terrain grid
    const geo = new THREE.PlaneGeometry(20, 30, 80, 80);
    geo.rotateX(-Math.PI * 0.45); // tilt toward viewer
    geo.translate(0, -1.5, -5); // position below and in front

    this.mesh = new THREE.Mesh(geo, this.material);
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
