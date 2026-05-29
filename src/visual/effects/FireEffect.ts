import * as THREE from 'three';
import type { ControlSignals } from '../../store';
import type { VisualEffect, EffectParams } from './types';

/**
 * Fire/Flame effect - Classic Winamp fire simulation
 * Uses layered simplex noise scrolling upward with audio reactivity
 */

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
uniform float uSpeed;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;

// Simplex-like noise
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m; m = m*m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float fbm(vec2 p) {
  float f = 0.0;
  f += 0.5000 * snoise(p); p *= 2.02;
  f += 0.2500 * snoise(p); p *= 2.03;
  f += 0.1250 * snoise(p); p *= 2.01;
  f += 0.0625 * snoise(p);
  return f;
}

void main() {
  vec2 uv = vUv;
  float t = uTime * uSpeed;
  
  // Fire rises from bottom
  vec2 fireUv = uv;
  fireUv.y = 1.0 - fireUv.y; // flip so fire rises
  
  // Turbulence that scrolls upward
  float scroll = t * 1.5;
  float n1 = fbm(vec2(fireUv.x * 3.0, fireUv.y * 2.0 - scroll));
  float n2 = fbm(vec2(fireUv.x * 5.0 + 1.7, fireUv.y * 3.0 - scroll * 1.3));
  float n3 = fbm(vec2(fireUv.x * 8.0 - 2.3, fireUv.y * 4.0 - scroll * 1.7));
  
  // Combine noise layers
  float noise = n1 * 0.5 + n2 * 0.3 + n3 * 0.2;
  
  // Fire shape: fades toward top, strongest at bottom
  float shape = pow(fireUv.y, 0.8 + uBassEnergy * 0.4);
  // Narrower at top
  float center = abs(fireUv.x - 0.5) * 2.0;
  shape *= smoothstep(1.0, 0.3 - uMidEnergy * 0.2, center * fireUv.y);
  
  // Bass makes fire taller and more intense
  float fireIntensity = (noise * 0.5 + 0.5) * shape;
  fireIntensity *= 1.0 + uBassEnergy * 0.8;
  
  // Transient creates fire bursts
  fireIntensity += uTransient * 0.5 * shape * (1.0 - fireUv.y);
  
  // Colour ramp: dark red -> orange -> yellow -> white
  vec3 col;
  if (fireIntensity < 0.3) {
    col = mix(vec3(0.0), uColor1, fireIntensity / 0.3);
  } else if (fireIntensity < 0.6) {
    col = mix(uColor1, uColor2, (fireIntensity - 0.3) / 0.3);
  } else if (fireIntensity < 0.85) {
    col = mix(uColor2, uColor3, (fireIntensity - 0.6) / 0.25);
  } else {
    col = mix(uColor3, vec3(1.0), (fireIntensity - 0.85) / 0.15);
  }
  
  // Sparks / embers
  float spark = snoise(vec2(uv.x * 20.0, uv.y * 30.0 - t * 3.0));
  spark = smoothstep(0.92, 1.0, spark) * shape * uHighEnergy;
  col += vec3(1.0, 0.8, 0.3) * spark * 2.0;
  
  col *= uIntensity;
  
  gl_FragColor = vec4(col, 1.0);
}
`;

export class FireEffect implements VisualEffect {
  name = 'fire';
  private mesh!: THREE.Mesh;
  private material!: THREE.ShaderMaterial;

  init(scene: THREE.Scene): void {
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uBassEnergy: { value: 0 },
        uMidEnergy: { value: 0 },
        uHighEnergy: { value: 0 },
        uTransient: { value: 0 },
        uIntensity: { value: 1.0 },
        uSpeed: { value: 1.0 },
        uColor1: { value: new THREE.Color('#8B0000') },
        uColor2: { value: new THREE.Color('#FF4500') },
        uColor3: { value: new THREE.Color('#FFD700') },
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
    u.uSpeed.value = params.speed;
    u.uColor1.value.set(params.colors[0]);
    u.uColor2.value.set(params.colors[1]);
    u.uColor3.value.set(params.colors[2]);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.mesh.parent?.remove(this.mesh);
  }
}
