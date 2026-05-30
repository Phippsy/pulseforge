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

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  uv.x *= uAspect;

  float time = uTime * (0.3 + uSpeed * 0.7);

  // Camera sway
  uv += vec2(sin(time * 0.4) * 0.05, cos(time * 0.3) * 0.04) * (1.0 + uMidEnergy * 0.5);

  // Polar coordinates — the tunnel core
  float r = length(uv);
  float a = atan(uv.y, uv.x);

  // Twist rotation — angle rotates with depth
  float twist = uTwist * (1.0 + uMidEnergy * 1.5);
  a += time * 0.4 * twist + (1.0 / (r + 0.1)) * 0.3 * twist;

  // Depth (inverse radius = illusion of infinite tunnel)
  float depth = 1.0 / (r + 0.01);
  float zPos = depth + time * 3.0; // fly forward

  // Bass-reactive pulse on radius
  float bassPulse = uBassPulse * 0.2 * sin(zPos * 0.3);

  // === NEON GRID RINGS ===
  // Rings at regular depth intervals
  float ringSpacing = 1.8;
  float ringZ = mod(zPos, ringSpacing);
  float ringDist = min(ringZ, ringSpacing - ringZ);
  float ring = smoothstep(0.12, 0.0, ringDist) * smoothstep(0.001, 0.05, r);
  ring *= 1.0 + uBassEnergy * 2.0;

  // Longitudinal lines (tunnel ribs)
  float segments = uSegments;
  float ribAngle = mod(a * segments / TAU, 1.0);
  float rib = smoothstep(0.08, 0.0, abs(ribAngle - 0.5) - 0.42);
  rib *= smoothstep(0.001, 0.1, r); // fade at center

  // Grid intersection glow
  float gridNode = ring * rib * 3.0;

  // === COLOUR ===
  // Depth-based colour cycling
  float colorPhase = fract(zPos * 0.08 + time * 0.05);
  vec3 tunnelColor;
  if (colorPhase < 0.25) tunnelColor = mix(uColor1, uColor2, colorPhase * 4.0);
  else if (colorPhase < 0.5) tunnelColor = mix(uColor2, uColor3, (colorPhase - 0.25) * 4.0);
  else if (colorPhase < 0.75) tunnelColor = mix(uColor3, uColor4, (colorPhase - 0.5) * 4.0);
  else tunnelColor = mix(uColor4, uColor1, (colorPhase - 0.75) * 4.0);

  // Secondary colour for ribs
  vec3 ribColor = mix(uColor2, uColor4, sin(a * 2.0 + time) * 0.5 + 0.5);

  // Build the final colour
  vec3 col = vec3(0.0);

  // Background glow — radial gradient depth illusion
  float bgGlow = exp(-r * 2.0) * 0.15;
  col += tunnelColor * bgGlow * (1.0 + uBassEnergy);

  // Rings
  col += tunnelColor * ring * 0.8;

  // Ribs
  col += ribColor * rib * 0.4 * (0.5 + depth * 0.02);

  // Grid nodes (where rings meet ribs) — brightest
  col += vec3(1.0, 1.0, 1.0) * gridNode * 0.5;
  col += tunnelColor * gridNode * 0.8;

  // Depth fog — things fade to colour in the distance
  float fog = exp(-depth * 0.015);
  vec3 fogColor = mix(uColor1, uColor3, sin(time * 0.2) * 0.5 + 0.5) * 0.1;
  col = mix(fogColor, col, fog);

  // Pulsing energy waves (travel toward viewer)
  float wave1 = smoothstep(0.15, 0.0, abs(mod(zPos * 0.5, 3.0) - 1.5) - 0.5);
  col += tunnelColor * wave1 * 0.3 * (1.0 + uBassEnergy * 2.0) * smoothstep(0.0, 0.1, r);

  // High-energy sparking at random depth positions
  float sparkDepth = mod(zPos * 2.0 + hash(floor(a * segments / TAU)) * 10.0, 8.0);
  float spark = smoothstep(0.5, 0.0, sparkDepth) * uHighEnergy;
  col += uColor3 * spark * rib * 2.0;

  // Transient flash — bright ring pulse
  float flashRing = smoothstep(0.2, 0.0, abs(r - 0.3 - uTransient * 0.5));
  col += mix(uColor1, vec3(1.0), 0.5) * flashRing * uTransient * 1.5;

  // Centre vanishing point glow
  float centerGlow = exp(-r * r * 20.0) * 0.3;
  col += mix(uColor2, uColor4, sin(time) * 0.5 + 0.5) * centerGlow * (1.0 + uBassPulse);

  // Vignette
  float vig = 1.0 - dot(vUv - 0.5, vUv - 0.5) * 1.5;
  col *= max(0.0, vig);

  col *= 0.6 + uIntensity * 0.8;

  // Tone map
  col = col / (1.0 + col * 0.4);

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
