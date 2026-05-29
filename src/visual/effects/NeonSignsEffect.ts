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
uniform float uIntensity;
uniform float uAspect;

// Segment display helpers
float segH(vec2 p, vec2 pos, float w, float h) {
  vec2 d = abs(p - pos) - vec2(w, h);
  return smoothstep(0.005, 0.0, max(d.x, d.y));
}

float segV(vec2 p, vec2 pos, float w, float h) {
  vec2 d = abs(p - pos) - vec2(w, h);
  return smoothstep(0.005, 0.0, max(d.x, d.y));
}

// 7-segment digit renderer
float digit(vec2 p, int n, float size) {
  float s = size;
  float hw = s * 0.35; // half width
  float hh = s * 0.08; // segment thickness
  float vh = s * 0.4;  // vertical segment height
  float vw = s * 0.08;
  
  float d = 0.0;
  
  // Segments: A(top), B(top-right), C(bot-right), D(bot), E(bot-left), F(top-left), G(mid)
  bool A = (n==0||n==2||n==3||n==5||n==6||n==7||n==8||n==9);
  bool B = (n==0||n==1||n==2||n==3||n==4||n==7||n==8||n==9);
  bool C = (n==0||n==1||n==3||n==4||n==5||n==6||n==7||n==8||n==9);
  bool D = (n==0||n==2||n==3||n==5||n==6||n==8||n==9);
  bool E = (n==0||n==2||n==6||n==8);
  bool F = (n==0||n==4||n==5||n==6||n==8||n==9);
  bool G = (n==2||n==3||n==4||n==5||n==6||n==8||n==9);
  
  if (A) d += segH(p, vec2(0.0, vh), hw, hh);
  if (B) d += segV(p, vec2(hw, vh * 0.5), vw, vh * 0.45);
  if (C) d += segV(p, vec2(hw, -vh * 0.5), vw, vh * 0.45);
  if (D) d += segH(p, vec2(0.0, -vh), hw, hh);
  if (E) d += segV(p, vec2(-hw, -vh * 0.5), vw, vh * 0.45);
  if (F) d += segV(p, vec2(-hw, vh * 0.5), vw, vh * 0.45);
  if (G) d += segH(p, vec2(0.0, 0.0), hw, hh);
  
  return clamp(d, 0.0, 1.0);
}

// Neon tube glow
float neonGlow(float shape, float intensity) {
  return shape * intensity + pow(shape, 0.5) * 0.3 * intensity;
}

// Hash
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main() {
  vec2 uv = vUv;
  vec2 p = (uv - 0.5) * vec2(uAspect, 1.0);
  
  // Dark background (like a nightclub wall)
  vec3 col = vec3(0.01, 0.005, 0.02);
  
  // Brick texture (subtle)
  vec2 brickUv = uv * vec2(20.0, 10.0);
  vec2 brickId = floor(brickUv);
  float brickOffset = mod(brickId.y, 2.0) * 0.5;
  brickUv.x += brickOffset;
  vec2 brickFrac = fract(brickUv);
  float brick = smoothstep(0.02, 0.05, brickFrac.x) * smoothstep(0.02, 0.05, brickFrac.y) *
                smoothstep(0.98, 0.95, brickFrac.x) * smoothstep(0.98, 0.95, brickFrac.y);
  col += vec3(0.02, 0.01, 0.005) * brick;
  
  // === DANFEST text in neon ===
  // D-A-N-F-E-S-T spelled out with simple shapes
  
  float letterSpacing = 0.09;
  float startX = -0.28;
  float textY = 0.15;
  float textScale = 0.08;
  
  // Simplified neon letter shapes (lines/arcs)
  float neonText = 0.0;
  
  // Letter D
  vec2 lp = (p - vec2(startX, textY)) / textScale;
  float dShape = smoothstep(0.06, 0.0, abs(length(lp - vec2(0.2, 0.0)) - 0.5) - 0.0) * step(lp.x, 0.2);
  dShape += smoothstep(0.06, 0.0, abs(lp.x + 0.3)) * step(-0.5, lp.y) * step(lp.y, 0.5);
  neonText += dShape;
  
  // Letter A
  lp = (p - vec2(startX + letterSpacing, textY)) / textScale;
  float aShape = smoothstep(0.06, 0.0, abs(lp.x + lp.y * 0.5)) * step(-0.5, lp.y) * step(lp.y, 0.5);
  aShape += smoothstep(0.06, 0.0, abs(lp.x - lp.y * 0.5)) * step(-0.5, lp.y) * step(lp.y, 0.5);
  aShape += smoothstep(0.06, 0.0, abs(lp.y)) * step(-0.25, lp.x) * step(lp.x, 0.25);
  neonText += aShape;
  
  // Letter N
  lp = (p - vec2(startX + letterSpacing * 2.0, textY)) / textScale;
  float nShape = smoothstep(0.06, 0.0, abs(lp.x + 0.3)) * step(-0.5, lp.y) * step(lp.y, 0.5);
  nShape += smoothstep(0.06, 0.0, abs(lp.x - 0.3)) * step(-0.5, lp.y) * step(lp.y, 0.5);
  nShape += smoothstep(0.06, 0.0, abs(lp.x - lp.y * 0.6)) * step(-0.5, lp.y) * step(lp.y, 0.5);
  neonText += nShape;
  
  // Letter F
  lp = (p - vec2(startX + letterSpacing * 3.0, textY)) / textScale;
  float fShape = smoothstep(0.06, 0.0, abs(lp.x + 0.3)) * step(-0.5, lp.y) * step(lp.y, 0.5);
  fShape += smoothstep(0.06, 0.0, abs(lp.y - 0.5)) * step(-0.3, lp.x) * step(lp.x, 0.3);
  fShape += smoothstep(0.06, 0.0, abs(lp.y)) * step(-0.3, lp.x) * step(lp.x, 0.15);
  neonText += fShape;
  
  // Letter E
  lp = (p - vec2(startX + letterSpacing * 4.0, textY)) / textScale;
  float eShape = smoothstep(0.06, 0.0, abs(lp.x + 0.3)) * step(-0.5, lp.y) * step(lp.y, 0.5);
  eShape += smoothstep(0.06, 0.0, abs(lp.y - 0.5)) * step(-0.3, lp.x) * step(lp.x, 0.3);
  eShape += smoothstep(0.06, 0.0, abs(lp.y)) * step(-0.3, lp.x) * step(lp.x, 0.15);
  eShape += smoothstep(0.06, 0.0, abs(lp.y + 0.5)) * step(-0.3, lp.x) * step(lp.x, 0.3);
  neonText += eShape;
  
  // Letter S
  lp = (p - vec2(startX + letterSpacing * 5.0, textY)) / textScale;
  float sShape = smoothstep(0.06, 0.0, abs(lp.y - 0.5)) * step(-0.3, lp.x) * step(lp.x, 0.3);
  sShape += smoothstep(0.06, 0.0, abs(lp.y)) * step(-0.3, lp.x) * step(lp.x, 0.3);
  sShape += smoothstep(0.06, 0.0, abs(lp.y + 0.5)) * step(-0.3, lp.x) * step(lp.x, 0.3);
  sShape += smoothstep(0.06, 0.0, abs(lp.x + 0.3)) * step(0.0, lp.y) * step(lp.y, 0.5);
  sShape += smoothstep(0.06, 0.0, abs(lp.x - 0.3)) * step(-0.5, lp.y) * step(lp.y, 0.0);
  neonText += sShape;
  
  // Letter T
  lp = (p - vec2(startX + letterSpacing * 6.0, textY)) / textScale;
  float tShape = smoothstep(0.06, 0.0, abs(lp.y - 0.5)) * step(-0.3, lp.x) * step(lp.x, 0.3);
  tShape += smoothstep(0.06, 0.0, abs(lp.x)) * step(-0.5, lp.y) * step(lp.y, 0.5);
  neonText += tShape;
  
  // Neon colour cycling
  vec3 neonColor1 = vec3(1.0, 0.1, 0.5); // Hot pink
  vec3 neonColor2 = vec3(0.1, 0.5, 1.0); // Electric blue
  vec3 neonColor3 = vec3(0.0, 1.0, 0.5); // Green
  
  float colorCycle = sin(uTime * 0.8) * 0.5 + 0.5;
  vec3 neonCol = mix(neonColor1, neonColor2, colorCycle);
  neonCol = mix(neonCol, neonColor3, sin(uTime * 0.5 + 2.0) * 0.5 + 0.5);
  
  // Flicker
  float flicker = 0.85 + 0.15 * sin(uTime * 30.0 + hash(vec2(floor(uTime * 5.0), 0.0)) * 6.28);
  
  // Add neon text with glow
  float textGlow = neonGlow(clamp(neonText, 0.0, 1.0), 1.0);
  col += neonCol * textGlow * flicker * (0.7 + uMidEnergy * 0.5);
  
  // Wide glow around text
  float wideGlow = smoothstep(0.3, 0.0, length(p - vec2(0.0, textY))) * 0.15;
  col += neonCol * wideGlow * (0.5 + uBassEnergy * 0.5);
  
  // === "50" in big 7-segment display below ===
  float digitSize = 0.15;
  float digitSpacing = 0.15;
  
  vec2 d5Pos = p - vec2(-digitSpacing * 0.5, -0.1);
  vec2 d0Pos = p - vec2(digitSpacing * 0.5, -0.1);
  
  float dig5 = digit(d5Pos / digitSize, 5, 1.0);
  float dig0 = digit(d0Pos / digitSize, 0, 1.0);
  
  float digits = clamp(dig5 + dig0, 0.0, 1.0);
  
  // Different neon colour for numbers
  vec3 numColor = vec3(1.0, 0.8, 0.0); // Golden yellow
  float numFlicker = 0.9 + 0.1 * sin(uTime * 25.0 + 1.0);
  float numGlow = neonGlow(digits, 1.0);
  col += numColor * numGlow * numFlicker * (0.6 + uBassEnergy * 0.6);
  
  // Stars/sparkles around (decorative)
  for (int i = 0; i < 12; i++) {
    float fi = float(i);
    float angle = fi * 0.524 + uTime * 0.3;
    float radius = 0.35 + sin(uTime * 0.7 + fi) * 0.05;
    vec2 starPos = vec2(cos(angle), sin(angle)) * radius;
    
    float sparkle = smoothstep(0.015, 0.0, length(p - starPos));
    float twinkle = 0.5 + 0.5 * sin(uTime * 5.0 + fi * 3.0);
    vec3 sparkleCol = mix(neonColor1, neonColor3, fi / 12.0);
    col += sparkleCol * sparkle * twinkle * 0.8;
  }
  
  // Bass pulse - all neon brightens
  col += col * uBassEnergy * 0.3;
  
  // Transient: flash everything white briefly
  col += vec3(0.3) * uTransient * 0.5;
  
  col *= uIntensity;
  gl_FragColor = vec4(col, 1.0);
}
`;

export class NeonSignsEffect implements VisualEffect {
  name = 'neonSigns';
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
        uAspect: { value: 1.0 },
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
    u.uAspect.value = window.innerWidth / window.innerHeight;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.mesh.parent?.remove(this.mesh);
  }
}
