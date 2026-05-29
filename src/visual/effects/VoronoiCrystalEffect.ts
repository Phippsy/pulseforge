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
uniform float uCellCount;

// Simple hash
float hash1(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

vec2 hash2(vec2 p) {
  float h1 = fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  float h2 = fract(sin(dot(p, vec2(269.5, 183.3))) * 43758.5453);
  return vec2(h1, h2);
}

void main() {
  vec2 uv = vUv;
  uv.x *= uAspect;
  
  float t = uTime * uSpeed;
  float cells = uCellCount + uMidEnergy * 3.0;
  vec2 p = uv * cells;
  vec2 ip = floor(p);
  vec2 fp = fract(p);
  
  // Voronoi - find 2 nearest with unrolled loop
  float d1 = 8.0;
  float d2 = 8.0;
  float id1 = 0.0;
  
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 nb = vec2(float(i), float(j));
      vec2 h = hash2(ip + nb);
      vec2 pt = nb + 0.5 + 0.35 * sin(t * 0.5 + h * 6.28);
      float d = dot(fp - pt, fp - pt);
      if (d < d1) {
        d2 = d1;
        d1 = d;
        id1 = h.x;
      } else if (d < d2) {
        d2 = d;
      }
    }
  }
  
  d1 = sqrt(d1);
  d2 = sqrt(d2);
  
  // Edge
  float edge = d2 - d1;
  float edgeW = 0.04 + uHighEnergy * 0.04;
  float edgeMask = smoothstep(0.0, edgeW, edge);
  
  // Cell color
  float ci = fract(id1 + t * 0.05);
  vec3 cellColor = ci < 0.5 
    ? mix(uColor1, uColor2, ci * 2.0)
    : mix(uColor3, uColor4, (ci - 0.5) * 2.0);
  
  // Interior shading
  vec3 col = cellColor * (0.7 + d1 * 0.6);
  
  // Sparkle at center
  float spark = exp(-d1 * 8.0) * (0.5 + uTransient * 2.0);
  col += spark * (uColor1 + uColor2);
  
  // Edge glow  
  vec3 edgeCol = mix(uColor3, uColor4, fract(id1 * 3.7));
  col = mix(edgeCol * (1.0 + uBassEnergy), col, edgeMask);
  
  // Overall
  col *= uIntensity * (0.8 + uBassEnergy * 0.4);
  col *= 1.0 + uTransient * 0.3;
  
  gl_FragColor = vec4(col, 1.0);
}
`;

export class VoronoiCrystalEffect implements VisualEffect {
  name = 'voronoi';
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
        uColor4: { value: new THREE.Color('#ffcc00') },
        uAspect: { value: 1.0 },
        uCellCount: { value: 8.0 },
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
    u.uCellCount.value = ((params.effectParams?.cellCount as number) ?? 8) + params.complexity * 4;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.mesh.parent?.remove(this.mesh);
  }
}
