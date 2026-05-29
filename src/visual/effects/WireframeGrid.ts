import * as THREE from 'three';
import type { ControlSignals } from '../../store';
import type { VisualEffect, EffectParams } from './types';

const vertexShader = `
uniform float uTime;
uniform float uBassEnergy;
uniform float uMidEnergy;
uniform float uHighEnergy;
uniform float uTransient;
uniform float uAmplitude;
uniform float uScrollSpeed;
uniform float uIntensity;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;

varying float vHeight;
varying vec2 vUv;
varying float vEdgeDist;
varying vec3 vColor;

vec3 mod289(vec3 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec2 mod289v2(vec2 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289v2(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m; m = m*m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0+h*h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

void main() {
  vUv = uv;
  vec3 pos = position;

  float scrollZ = pos.z + uTime * uScrollSpeed * 5.0;
  
  // Multi-octave terrain
  float n1 = snoise(vec2(pos.x * 0.2, scrollZ * 0.05 + uTime * 0.1)) * 2.0;
  float n2 = snoise(vec2(pos.x * 0.5, scrollZ * 0.1 + uTime * 0.2)) * 1.0;
  float n3 = snoise(vec2(pos.x * 1.0, scrollZ * 0.2 + uTime * 0.3)) * 0.5;
  
  // Bass drives major terrain features
  float bassWave = sin(pos.x * 0.3 + uTime * 1.5) * uBassEnergy * uAmplitude * 3.0;
  float bassSlam = sin(scrollZ * 0.1 + uTime * 2.0) * uBassEnergy * uAmplitude * 2.0;
  
  // Mid drives ripples
  float midRipple = snoise(vec2(pos.x * 2.0 + uTime * 3.0, scrollZ * 0.3)) * uMidEnergy * uAmplitude;
  
  // Transient shockwave from center
  float distFromCenter = length(vec2(pos.x, pos.z));
  float shockwave = sin(distFromCenter * 2.0 - uTime * 8.0) * exp(-distFromCenter * 0.1) * uTransient * uAmplitude * 4.0;
  
  float displacement = (n1 + n2 + n3) * uAmplitude * 0.5 + bassWave + bassSlam + midRipple + shockwave;
  
  pos.y += displacement;
  vHeight = displacement;
  
  // Edge distance for glow effect
  vEdgeDist = abs(pos.x) / 20.0;
  
  // Colour varies with height and position
  float colorMix = displacement * 0.3 + 0.5;
  vColor = mix(uColor1, uColor2, clamp(colorMix, 0.0, 1.0));
  vColor = mix(vColor, uColor3, clamp(colorMix - 0.5, 0.0, 1.0) * uHighEnergy * 2.0);
  vColor *= 0.5 + uIntensity * 0.8;
  
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

const fragmentShader = `
uniform float uHighEnergy;
uniform float uBassEnergy;
uniform float uTime;
uniform float uIntensity;
uniform vec3 uColor1;
uniform vec3 uColor3;

varying float vHeight;
varying vec2 vUv;
varying float vEdgeDist;
varying vec3 vColor;

void main() {
  // Grid glow at wireframe edges
  vec3 col = vColor;
  
  // Height-based brightness boost
  float heightGlow = abs(vHeight) * 0.3;
  col += heightGlow * uColor1 * uHighEnergy;
  
  // Hot points where height peaks
  float peak = smoothstep(1.5, 2.5, abs(vHeight));
  col += peak * uColor3 * 0.5;
  
  // Edge fade
  float edgeFade = 1.0 - smoothstep(0.7, 1.0, vEdgeDist);
  col *= edgeFade;
  
  // Pulse brightness on bass
  col *= 1.0 + uBassEnergy * 0.5;
  
  gl_FragColor = vec4(col, 1.0);
}
`;

export class WireframeGrid implements VisualEffect {
  name = 'grid';
  private mesh: THREE.Mesh | null = null;
  private material: THREE.ShaderMaterial | null = null;
  private backGrid: THREE.Mesh | null = null;

  init(scene: THREE.Scene, _camera: THREE.Camera): void {
    // Main floor grid
    const geo = new THREE.PlaneGeometry(50, 60, 80, 80);
    geo.rotateX(-Math.PI * 0.4);
    geo.translate(0, -4, -8);

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uBassEnergy: { value: 0 },
        uMidEnergy: { value: 0 },
        uHighEnergy: { value: 0 },
        uTransient: { value: 0 },
        uAmplitude: { value: 0.5 },
        uScrollSpeed: { value: 0.4 },
        uIntensity: { value: 0.7 },
        uColor1: { value: new THREE.Color('#F72585') },
        uColor2: { value: new THREE.Color('#4CC9F0') },
        uColor3: { value: new THREE.Color('#ffffff') },
      },
      wireframe: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
    });

    this.mesh = new THREE.Mesh(geo, this.material);
    scene.add(this.mesh);

    // Reflected ceiling grid (fainter)
    const ceilGeo = new THREE.PlaneGeometry(50, 60, 40, 40);
    ceilGeo.rotateX(Math.PI * 0.4);
    ceilGeo.translate(0, 8, -8);

    const ceilMat = this.material.clone();
    ceilMat.uniforms.uIntensity = { value: 0.2 };
    this.backGrid = new THREE.Mesh(ceilGeo, ceilMat);
    scene.add(this.backGrid);
  }

  update(signals: ControlSignals, params: EffectParams, _dt: number, time: number): void {
    if (!this.material) return;
    const u = this.material.uniforms;
    u.uTime.value = time;
    u.uBassEnergy.value = signals.bassEnergy * params.bassReactivity;
    u.uMidEnergy.value = signals.midEnergy * params.midReactivity;
    u.uHighEnergy.value = signals.highEnergy * params.highReactivity;
    u.uTransient.value = signals.transientPulse * params.onsetReactivity;
    u.uAmplitude.value = params.effectParams.amplitude ?? 0.5;
    u.uScrollSpeed.value = params.effectParams.scrollSpeed ?? 0.4;
    u.uIntensity.value = params.intensity;
    u.uColor1.value.set(params.colors[0]);
    u.uColor2.value.set(params.colors[1]);
    u.uColor3.value.set(params.colors[2]);

    // Update ceiling grid too
    if (this.backGrid) {
      const cu = (this.backGrid.material as THREE.ShaderMaterial).uniforms;
      cu.uTime.value = time;
      cu.uBassEnergy.value = signals.bassEnergy * params.bassReactivity * 0.5;
      cu.uMidEnergy.value = signals.midEnergy * params.midReactivity * 0.5;
      cu.uHighEnergy.value = signals.highEnergy * params.highReactivity * 0.5;
      cu.uTransient.value = signals.transientPulse * params.onsetReactivity * 0.3;
      cu.uAmplitude.value = (params.effectParams.amplitude ?? 0.5) * 0.5;
      cu.uScrollSpeed.value = -(params.effectParams.scrollSpeed ?? 0.4) * 0.3;
      cu.uColor1.value.set(params.colors[2]);
      cu.uColor2.value.set(params.colors[3]);
      cu.uColor3.value.set(params.colors[0]);
    }
  }

  dispose(): void {
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh.parent?.remove(this.mesh);
    }
    if (this.backGrid) {
      this.backGrid.geometry.dispose();
      (this.backGrid.material as THREE.Material).dispose();
      this.backGrid.parent?.remove(this.backGrid);
    }
    if (this.material) this.material.dispose();
    this.mesh = null;
    this.backGrid = null;
    this.material = null;
  }
}
