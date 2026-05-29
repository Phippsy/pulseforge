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

#define PI 3.14159265

// Smiley face SDF
float smileyBody(vec2 p, float radius) {
  return smoothstep(radius + 0.005, radius - 0.005, length(p));
}

float smileyEye(vec2 p, vec2 center, float radius) {
  return smoothstep(radius + 0.003, radius - 0.003, length(p - center));
}

float smileyMouth(vec2 p, float radius, float openness) {
  // Arc smile
  float d = length(p);
  float angle = atan(p.y, p.x);
  // Only draw bottom half arc
  float arc = smoothstep(radius + 0.008, radius - 0.008, d) *
              smoothstep(radius - 0.04, radius - 0.02, d);
  // Limit to bottom half with some curve
  float mouthMask = smoothstep(-0.1 * openness, -0.3 * openness, p.y);
  return arc * mouthMask;
}

// Hash
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main() {
  vec2 uv = vUv;
  vec2 p = (uv - 0.5) * vec2(uAspect, 1.0);
  
  // Background: rave-style dark with colour pulses
  float bgPulse = uBassEnergy * 0.3;
  vec3 col = vec3(0.02 + bgPulse * 0.1, 0.0, 0.05 + bgPulse * 0.1);
  
  // Radiating circles from center (like sound waves)
  float dist = length(p);
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float ringRadius = mod(uTime * 0.5 + fi * 0.15, 1.5);
    float ring = smoothstep(0.01, 0.0, abs(dist - ringRadius)) * (1.0 - ringRadius / 1.5);
    vec3 ringColor = mix(vec3(1.0, 0.0, 1.0), vec3(0.0, 1.0, 0.5), fi / 5.0);
    col += ringColor * ring * 0.3 * uMidEnergy;
  }
  
  // Main smiley face
  float faceSize = 0.25 + uBassEnergy * 0.05;
  
  // Face wobble/morph on beat
  vec2 faceP = p;
  faceP.x += sin(uTime * 3.0 + p.y * 5.0) * uBassEnergy * 0.02;
  faceP.y += cos(uTime * 2.5 + p.x * 5.0) * uBassEnergy * 0.02;
  
  // Rotation on high energy
  float rot = sin(uTime * 0.5) * uHighEnergy * 0.3;
  float cosR = cos(rot);
  float sinR = sin(rot);
  faceP = vec2(faceP.x * cosR - faceP.y * sinR, faceP.x * sinR + faceP.y * cosR);
  
  // Yellow smiley body
  float body = smileyBody(faceP, faceSize);
  vec3 faceColor = vec3(1.0, 0.85, 0.0); // Classic acid yellow
  
  // Slight gradient on face
  faceColor *= 0.85 + 0.15 * (1.0 - length(faceP) / faceSize);
  
  col = mix(col, faceColor, body);
  
  // Eyes (round, sometimes heart-shaped on transient)
  float eyeSize = faceSize * 0.12;
  float eyeSpacing = faceSize * 0.35;
  float eyeY = faceSize * 0.12;
  
  vec2 leftEyePos = vec2(-eyeSpacing, eyeY);
  vec2 rightEyePos = vec2(eyeSpacing, eyeY);
  
  float leftEye = smileyEye(faceP, leftEyePos, eyeSize);
  float rightEye = smileyEye(faceP, rightEyePos, eyeSize);
  
  // On transient, eyes become X shapes (dizzy raver!)
  float dizzy = smoothstep(0.5, 0.8, uTransient);
  if (dizzy < 0.5) {
    col = mix(col, vec3(0.0), (leftEye + rightEye) * body);
  } else {
    // X eyes
    vec2 leP = faceP - leftEyePos;
    vec2 reP = faceP - rightEyePos;
    float xSize = eyeSize * 1.5;
    float lx = smoothstep(0.004, 0.0, abs(abs(leP.x) - abs(leP.y)) * 2.0) * step(length(leP), xSize);
    float rx = smoothstep(0.004, 0.0, abs(abs(reP.x) - abs(reP.y)) * 2.0) * step(length(reP), xSize);
    col = mix(col, vec3(0.0), (lx + rx) * body);
  }
  
  // Smile (gets bigger/wider with energy)
  float mouthOpen = 0.8 + uMidEnergy * 0.5;
  float mouthSize = faceSize * 0.6;
  vec2 mouthP = faceP - vec2(0.0, -faceSize * 0.15);
  float mouth = smileyMouth(mouthP, mouthSize, mouthOpen);
  col = mix(col, vec3(0.0), mouth * body);
  
  // Neon outline glow
  float outline = smoothstep(faceSize + 0.02, faceSize + 0.005, length(faceP)) *
                  smoothstep(faceSize - 0.01, faceSize - 0.005, length(faceP));
  vec3 glowColor = mix(vec3(1.0, 0.0, 1.0), vec3(0.0, 1.0, 0.0), sin(uTime * 2.0) * 0.5 + 0.5);
  col += glowColor * outline * (0.5 + uBassEnergy);
  
  // Outer glow
  float outerGlow = exp(-length(faceP) * 3.0) * 0.4;
  col += glowColor * outerGlow * uBassEnergy;
  
  // Mini smileys floating around (rave particles)
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    float angle = fi * PI * 0.25 + uTime * (0.5 + fi * 0.1);
    float radius = 0.35 + sin(uTime * 0.8 + fi) * 0.08;
    vec2 miniPos = vec2(cos(angle), sin(angle)) * radius;
    
    float miniSize = 0.03 + sin(uTime + fi * 2.0) * 0.005;
    float miniBody = smoothstep(miniSize + 0.003, miniSize - 0.003, length(p - miniPos));
    
    vec3 miniColor = vec3(1.0, 0.85, 0.0) * (0.5 + 0.5 * sin(uTime * 3.0 + fi));
    col += miniColor * miniBody;
  }
  
  // Checker floor pattern (rave floor)
  if (uv.y < 0.2) {
    float floorY = (0.2 - uv.y) / 0.2;
    float persp = 1.0 / (floorY + 0.01);
    float fx = (uv.x - 0.5) * persp * 2.0;
    float fz = persp * 0.3 + uTime * 2.0;
    float checker = mod(floor(fx) + floor(fz), 2.0);
    vec3 floorCol = mix(vec3(0.0), vec3(0.1, 0.0, 0.2), checker);
    floorCol += vec3(1.0, 0.0, 1.0) * 0.1 * uBassEnergy;
    col = mix(col, floorCol, smoothstep(0.2, 0.15, uv.y));
  }
  
  // Overall intensity pulse
  col *= 0.8 + uBassEnergy * 0.4;
  col *= uIntensity;
  
  gl_FragColor = vec4(col, 1.0);
}
`;

export class AcidSmileyEffect implements VisualEffect {
  name = 'acidSmiley';
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
