import * as THREE from 'three';
import type { ControlSignals } from '../../store';
import type { VisualEffect, EffectParams } from './types';

/**
 * MilkDrop Warp - Per-pixel motion with zoom/rotation/warp
 * The quintessential MilkDrop effect: feedback with per-pixel motion equations
 * Creates ever-evolving psychedelic patterns
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
uniform float uAspect;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec3 uColor4;

#define PI 3.14159265359

vec3 mod289v3(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289v2(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289v3(((x*34.0)+1.0)*x); }

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
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

void main() {
  vec2 uv = (vUv - 0.5) * 2.0;
  uv.x *= uAspect;
  float t = uTime * uSpeed;
  
  // Per-pixel motion: zoom, rotation, and warp
  float r = length(uv);
  float theta = atan(uv.y, uv.x);
  
  // Zoom pulse with bass
  float zoom = 1.0 + sin(t * 0.5) * 0.1 + uBassEnergy * 0.15;
  
  // Rotation driven by mid energy
  float rot = t * 0.2 * (1.0 + uMidEnergy * 0.5);
  rot += sin(r * 3.0 - t) * 0.3 * uMidEnergy;
  
  // Warp: radial distortion
  float warp = sin(theta * 4.0 + t * 1.5) * 0.15 * (1.0 + uBassEnergy);
  warp += cos(r * 5.0 - t * 2.0) * 0.1 * uHighEnergy;
  
  // Apply motion
  float newR = r * zoom + warp;
  float newTheta = theta + rot;
  
  vec2 warped = vec2(cos(newTheta), sin(newTheta)) * newR;
  
  // Generate pattern from warped coordinates
  float n1 = snoise(warped * 2.0 + t * 0.3);
  float n2 = snoise(warped * 4.0 - t * 0.5);
  float n3 = snoise(warped * 1.0 + vec2(t * 0.2, -t * 0.15));
  
  // Combine into evolving pattern
  float pattern = n1 * 0.5 + n2 * 0.3 + n3 * 0.2;
  
  // Wave shapes (MilkDrop-style centered waves)
  float wave1 = sin(r * 8.0 - t * 3.0 + uBassEnergy * 4.0) * 0.5 + 0.5;
  float wave2 = sin(theta * 6.0 + t * 2.0 + pattern * 3.0) * 0.5 + 0.5;
  
  // Colour mapping
  float c1 = pattern * 0.5 + 0.5;
  float c2 = wave1 * wave2;
  
  vec3 col;
  col = mix(uColor1, uColor2, c1);
  col = mix(col, uColor3, c2 * 0.6);
  col += uColor4 * pow(wave1 * wave2, 3.0) * 0.5;
  
  // Darken center (MilkDrop classic)
  col *= smoothstep(0.0, 0.4, r);
  
  // Brighten based on energy
  col *= 0.7 + (uBassEnergy + uMidEnergy) * 0.3;
  
  // High-frequency detail sparkle
  float detail = snoise(warped * 20.0 + t);
  col += uColor4 * smoothstep(0.8, 1.0, detail) * uHighEnergy * 0.3;
  
  // Transient creates a flash ripple
  float transRipple = sin(r * 15.0 - uTransient * 10.0) * uTransient;
  col += vec3(1.0) * max(0.0, transRipple) * 0.3;
  
  col *= uIntensity;
  col = col / (1.0 + col * 0.2);
  
  gl_FragColor = vec4(col, 1.0);
}
`;

export class MilkDropWarpEffect implements VisualEffect {
  name = 'milkdrop';
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
        uAspect: { value: 1.0 },
        uColor1: { value: new THREE.Color('#FF1493') },
        uColor2: { value: new THREE.Color('#00CED1') },
        uColor3: { value: new THREE.Color('#7B68EE') },
        uColor4: { value: new THREE.Color('#FFD700') },
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
    u.uAspect.value = window.innerWidth / window.innerHeight;
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
