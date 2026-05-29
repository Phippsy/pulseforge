import * as THREE from 'three';
import type { ControlSignals } from '../../store';
import type { VisualEffect, EffectParams } from './types';

/**
 * Nebula Cloud - Volumetric cloud/nebula effect
 * Inspired by MilkDrop's softer, atmospheric presets
 * Billowing clouds of colour that react to audio
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

float fbm(vec2 p, float t) {
  float f = 0.0;
  f += 0.5 * snoise(p + t * 0.1); p *= 2.02;
  f += 0.25 * snoise(p - t * 0.05); p *= 2.03;
  f += 0.125 * snoise(p + t * 0.07); p *= 2.01;
  f += 0.0625 * snoise(p - t * 0.03); p *= 2.04;
  f += 0.03125 * snoise(p + t * 0.04);
  return f;
}

void main() {
  vec2 uv = (vUv - 0.5) * 2.0;
  uv.x *= uAspect;
  float t = uTime * uSpeed * 0.4;
  
  // Multiple cloud layers at different scales and speeds
  float cloud1 = fbm(uv * 1.5 + vec2(t * 0.2, t * 0.1), t);
  float cloud2 = fbm(uv * 2.5 + vec2(-t * 0.15, t * 0.2), t * 1.3);
  float cloud3 = fbm(uv * 4.0 + vec2(t * 0.1, -t * 0.15), t * 0.7);
  
  // Audio modulation
  cloud1 *= 0.8 + uBassEnergy * 0.5;
  cloud2 *= 0.6 + uMidEnergy * 0.7;
  cloud3 *= 0.4 + uHighEnergy * 1.0;
  
  // Density field
  float density = cloud1 * 0.5 + cloud2 * 0.3 + cloud3 * 0.2;
  density = density * 0.5 + 0.5; // remap to 0-1
  
  // Colour nebula by layers
  vec3 col = vec3(0.0);
  
  // Deep background
  float bg = smoothstep(-0.5, 0.5, density);
  col += uColor1 * bg * 0.3;
  
  // Mid layer
  float mid = smoothstep(0.3, 0.7, density);
  col += uColor2 * mid * 0.5;
  
  // Bright layer
  float bright = smoothstep(0.5, 0.9, density);
  col += uColor3 * bright * 0.7;
  
  // Hot spots
  float hot = smoothstep(0.75, 1.0, density);
  col += uColor4 * hot * 0.5;
  
  // Stars in dark regions
  float starField = snoise(uv * 50.0);
  float stars = smoothstep(0.97, 1.0, starField) * (1.0 - density);
  col += vec3(1.0) * stars * 0.8;
  
  // Nebula internal glow - bass makes it pulse
  float glow = pow(density, 3.0) * (0.5 + uBassEnergy * 0.8);
  col += mix(uColor2, uColor4, density) * glow * 0.4;
  
  // Edge lighting from a virtual light source
  float lightDir = snoise(uv * 2.0 + t * 0.3);
  float rimLight = smoothstep(0.4, 0.6, density) * smoothstep(0.7, 0.5, density);
  col += uColor4 * rimLight * abs(lightDir) * 0.3;
  
  // Transient creates flash in bright regions
  col += vec3(1.0, 0.9, 0.8) * uTransient * 0.3 * bright;
  
  // High energy adds twinkling in the nebula
  float twinkle = snoise(uv * 30.0 + t * 2.0);
  col += uColor3 * smoothstep(0.9, 1.0, twinkle) * uHighEnergy * bright * 0.5;
  
  col *= uIntensity;
  col = col / (1.0 + col * 0.15);
  
  gl_FragColor = vec4(col, 1.0);
}
`;

export class NebulaCloudEffect implements VisualEffect {
  name = 'nebula';
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
        uColor1: { value: new THREE.Color('#0a001a') },
        uColor2: { value: new THREE.Color('#2200AA') },
        uColor3: { value: new THREE.Color('#FF3388') },
        uColor4: { value: new THREE.Color('#FFDD88') },
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
