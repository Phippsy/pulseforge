import * as THREE from 'three';
import type { ControlSignals } from '../../store';
import type { VisualEffect, EffectParams } from './types';

/**
 * Rorschach/Ink Blot - Mirror-symmetry generative patterns
 * Creates evolving symmetric shapes like psychedelic ink blots
 * Inspired by MilkDrop's symmetric presets
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

float fbm(vec2 p) {
  float f = 0.0;
  f += 0.5 * snoise(p); p *= 2.02;
  f += 0.25 * snoise(p); p *= 2.03;
  f += 0.125 * snoise(p); p *= 2.01;
  f += 0.0625 * snoise(p);
  return f;
}

void main() {
  vec2 uv = (vUv - 0.5) * 2.0;
  uv.x *= uAspect;
  float t = uTime * uSpeed * 0.5;
  
  // Mirror on X axis (left-right symmetry)
  vec2 symUv = vec2(abs(uv.x), uv.y);
  
  // Optional: 4-fold symmetry on transient (gentler transition)
  float fourFold = smoothstep(0.3, 0.9, uTransient) * 0.7;
  vec2 sym4 = vec2(abs(uv.x), abs(uv.y));
  symUv = mix(symUv, sym4, fourFold);
  
  // Evolving noise pattern
  float n1 = fbm(symUv * 2.0 + t * 0.3);
  float n2 = fbm(symUv * 3.0 - vec2(t * 0.2, t * 0.1));
  float n3 = snoise(symUv * 5.0 + t * 0.4);
  
  // Shape the ink blot - denser in center, wide soft fade at edges
  float r = length(symUv);
  float shape = smoothstep(1.8, 0.2, r + n1 * 0.6);
  
  // Create layered blot patterns
  float blot1 = smoothstep(0.1, 0.15, n1 * shape);
  float blot2 = smoothstep(0.0, 0.1, n2 * shape * 0.8);
  float blot3 = smoothstep(-0.1, 0.0, n3 * shape * 0.5);
  
  // Audio modulates the patterns
  blot1 *= 0.7 + uBassEnergy * 0.5;
  blot2 *= 0.5 + uMidEnergy * 0.8;
  blot3 *= 0.3 + uHighEnergy * 1.0;
  
  // Bass makes the blot expand/contract (gentle breathing)
  float breathe = 1.0 + sin(t * 1.5) * 0.06 + uBassEnergy * 0.1;
  float expandedR = r / breathe;
  float outerShape = smoothstep(1.5, 0.3, expandedR + n1 * 0.5);
  
  // Combine layers with different colours
  vec3 col = vec3(0.0);
  col += uColor1 * blot1 * outerShape;
  col += uColor2 * blot2 * 0.8;
  col += uColor3 * blot3 * 0.6;
  
  // Inner glow where layers overlap
  float overlap = blot1 * blot2 * blot3;
  col += uColor4 * overlap * 3.0;
  
  // Edge glow
  float edge = smoothstep(0.5, 0.48, abs(n1 * shape - 0.3));
  col += uColor4 * edge * 0.3;
  
  // Subtle veins/tendrils
  float veins = abs(sin(n1 * 10.0 + n2 * 5.0 + t));
  veins = smoothstep(0.95, 1.0, veins) * shape;
  col += uColor3 * veins * 0.4;
  
  // Background: very subtle glow
  col += mix(uColor1, uColor2, r * 0.3) * 0.03 * (1.0 - shape * 0.5);
  
  // Transient flash at edges (reduced)
  col += vec3(1.0) * uTransient * 0.15 * edge;
  
  // Soft vignette to fade edges cleanly
  vec2 vUvCentered = vUv - 0.5;
  float vignette = 1.0 - dot(vUvCentered * 1.4, vUvCentered * 1.4);
  col *= smoothstep(0.0, 0.5, vignette);
  
  col *= uIntensity;
  col = col / (1.0 + col * 0.2);
  
  gl_FragColor = vec4(col, 1.0);
}
`;

export class RorschachEffect implements VisualEffect {
  name = 'rorschach';
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
        uColor1: { value: new THREE.Color('#1a0033') },
        uColor2: { value: new THREE.Color('#6600CC') },
        uColor3: { value: new THREE.Color('#FF00AA') },
        uColor4: { value: new THREE.Color('#FFFFFF') },
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
