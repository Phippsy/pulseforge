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

// Platform (solid block)
float platform(vec2 p, vec2 pos, vec2 size) {
  vec2 d = abs(p - pos) - size;
  return 1.0 - step(0.0, max(d.x, d.y));
}

// Ladder (two vertical rails with rungs)
float ladder(vec2 p, vec2 base, float width, float height) {
  float rail1 = step(abs(p.x - base.x + width * 0.5), 0.003) *
                step(base.y, p.y) * step(p.y, base.y + height);
  float rail2 = step(abs(p.x - base.x - width * 0.5), 0.003) *
                step(base.y, p.y) * step(p.y, base.y + height);
  float rungs = step(abs(p.x - base.x), width * 0.5) *
                step(base.y, p.y) * step(p.y, base.y + height) *
                (1.0 - step(0.003, mod(p.y - base.y, 0.025)));
  return max(max(rail1, rail2), rungs * 0.8);
}

// Egg shape (ellipse)
float egg(vec2 p, vec2 pos, float size) {
  vec2 d = (p - pos) / vec2(size * 0.7, size);
  return smoothstep(1.0 + 0.05, 1.0 - 0.05, length(d));
}

// Hen (simple bird shape)
float hen(vec2 p, vec2 pos, float size, float dir) {
  vec2 lp = (p - pos) * vec2(dir, 1.0);
  // Body (oval)
  float body = smoothstep(size + 0.003, size - 0.003,
    length(lp / vec2(1.3, 1.0)));
  // Head (smaller circle offset)
  float head = smoothstep(size * 0.5 + 0.003, size * 0.5 - 0.003,
    length(lp - vec2(size * 1.0, size * 0.4)));
  // Beak
  float beak = smoothstep(size * 0.25, size * 0.15,
    length(lp - vec2(size * 1.5, size * 0.35)));
  // Legs
  float legs = step(abs(lp.x - size * 0.3), 0.003) *
               step(-size * 1.2, lp.y) * step(lp.y, -size * 0.5) +
               step(abs(lp.x + size * 0.3), 0.003) *
               step(-size * 1.2, lp.y) * step(lp.y, -size * 0.5);
  return max(max(body, head), max(beak * 0.7, legs * 0.5));
}

// Hen-House Harry (player character)
float harry(vec2 p, vec2 pos, float size) {
  vec2 lp = p - pos;
  // Body
  float body = smoothstep(size + 0.003, size - 0.003, length(lp / vec2(0.8, 1.2)));
  // Head
  float head = smoothstep(size * 0.45, size * 0.35, length(lp - vec2(0.0, size * 1.1)));
  // Hat
  float hat = step(abs(lp.x), size * 0.55) *
              step(size * 1.3, lp.y) * step(lp.y, size * 1.6);
  // Legs (animated)
  float legPhase = sin(uTime * 12.0) * size * 0.3;
  float leg1 = step(abs(lp.x - legPhase * 0.5), 0.004) *
               step(-size * 1.5, lp.y) * step(lp.y, -size * 0.3);
  float leg2 = step(abs(lp.x + legPhase * 0.5), 0.004) *
               step(-size * 1.5, lp.y) * step(lp.y, -size * 0.3);
  return max(max(body, head), max(hat, max(leg1, leg2) * 0.6));
}

// Seed grain
float seed(vec2 p, vec2 pos, float size) {
  return smoothstep(size + 0.002, size - 0.002, length(p - pos));
}

// Big caged duck at top
float cageBars(vec2 p, vec2 center, float width, float height) {
  float inCage = step(abs(p.x - center.x), width * 0.5) *
                 step(abs(p.y - center.y), height * 0.5);
  float bars = step(mod(p.x - center.x + width * 0.5, width / 6.0), 0.004);
  float topBot = step(abs(abs(p.y - center.y) - height * 0.5), 0.004) *
                 step(abs(p.x - center.x), width * 0.5);
  return max(bars * inCage, topBot);
}

void main() {
  vec2 uv = vUv;
  vec2 p = (uv - 0.5) * vec2(uAspect, 1.0);

  // BBC Micro purple/green colour scheme
  vec3 bgColor = vec3(0.08, 0.0, 0.12);
  vec3 col = bgColor;

  // Platform layout (8 platforms at different heights)
  float platThick = 0.012;

  // Platforms: y-positions, x-start, x-end
  float yLevels[8];
  yLevels[0] = -0.42;
  yLevels[1] = -0.30;
  yLevels[2] = -0.18;
  yLevels[3] = -0.06;
  yLevels[4] = 0.06;
  yLevels[5] = 0.18;
  yLevels[6] = 0.30;
  yLevels[7] = 0.40;

  vec3 platColor = vec3(0.6, 0.15, 0.7); // Purple platforms
  float platPulse = 1.0 + uBassEnergy * 0.3;

  for (int i = 0; i < 8; i++) {
    float y = yLevels[i];
    float xOff = (i % 2 == 0) ? -0.05 : 0.05;
    float xWidth = 0.3 + float(i % 3) * 0.05;
    float plat = platform(p, vec2(xOff, y), vec2(xWidth, platThick));

    // Stagger platforms for visual interest
    if (i > 0 && i < 7) {
      float plat2 = platform(p, vec2(-xOff * 1.5, y), vec2(xWidth * 0.6, platThick));
      plat = max(plat, plat2);
    }

    col += platColor * platPulse * plat;
  }

  // Ladders connecting platforms
  vec3 ladderColor = vec3(0.2, 0.8, 0.3); // Green ladders
  for (int i = 0; i < 7; i++) {
    float lx = -0.15 + float(i % 3) * 0.15;
    float ly = yLevels[i];
    float lh = yLevels[i + 1] - ly;
    col += ladderColor * ladder(p, vec2(lx, ly + platThick), 0.02, lh - platThick);
  }

  // Lift platforms (moving upward)
  vec3 liftColor = vec3(0.9, 0.7, 0.1);
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float liftX = 0.32 + fi * 0.06;
    float liftY = mod(uTime * (0.15 + uMidEnergy * 0.1) + fi * 0.33, 1.0) * 0.84 - 0.42;
    float lift = platform(p, vec2(liftX, liftY), vec2(0.025, 0.005));
    col += liftColor * lift;
  }

  // Eggs (12 per level, scattered on platforms)
  vec3 eggColor = vec3(1.0, 0.95, 0.8);
  float eggPulse = 1.0 + uBassEnergy * 0.5;
  for (int i = 0; i < 8; i++) {
    float y = yLevels[i] + platThick + 0.015;
    // Place eggs along platform
    float xStart = -0.25 + float(i % 2) * 0.1;
    // Eggs collected over time (disappear based on time)
    float collectPhase = mod(uTime * 0.5 + float(i) * 0.7, 8.0);
    if (collectPhase > float(i)) {
      float e = egg(p, vec2(xStart, y), 0.012 * eggPulse);
      col += eggColor * e;
      // Second egg
      float e2 = egg(p, vec2(xStart + 0.15, y), 0.012 * eggPulse);
      col += eggColor * e2;
    }
  }

  // Seed grains scattered on platforms
  vec3 seedColor = vec3(0.9, 0.85, 0.2);
  for (int i = 0; i < 8; i++) {
    float y = yLevels[i] + platThick + 0.008;
    for (int j = 0; j < 4; j++) {
      float sx = -0.2 + float(j) * 0.12 + sin(float(i) * 2.3) * 0.05;
      float seedPhase = mod(uTime * 0.3 + float(i * 4 + j) * 0.5, 12.0);
      if (seedPhase > 3.0) {
        col += seedColor * seed(p, vec2(sx, y), 0.004) * 0.8;
      }
    }
  }

  // Hens patrolling platforms
  vec3 henBodyColor = vec3(1.0, 1.0, 1.0);
  vec3 henBeakColor = vec3(1.0, 0.5, 0.0);
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    int platIdx = i + 1; // Hens on platforms 1-5
    float y = yLevels[platIdx] + platThick + 0.025;
    float henSpeed = 0.15 + fi * 0.03 + uHighEnergy * 0.1;
    float phase = mod(uTime * henSpeed + fi * 3.0, 2.0);
    float xPos = -0.2 + phase * 0.2;
    float dir = phase < 1.0 ? 1.0 : -1.0;
    if (phase > 1.0) xPos = 0.2 - (phase - 1.0) * 0.2;

    float h = hen(p, vec2(xPos, y), 0.018, dir);
    col += henBodyColor * h * 0.9;

    // Beak in orange
    vec2 lp = (p - vec2(xPos, y)) * vec2(dir, 1.0);
    float bk = smoothstep(0.008, 0.004, length(lp - vec2(0.027, 0.006)));
    col += henBeakColor * bk;

    // Red comb
    float comb = smoothstep(0.005, 0.002, length(lp - vec2(0.015, 0.015)));
    col += vec3(1.0, 0.1, 0.1) * comb;
  }

  // Hen-House Harry (player) - moves based on music
  float harryX = sin(uTime * 0.8) * 0.15;
  float harryLevel = mod(floor(uTime * 0.3), 8.0);
  float harryY = yLevels[int(harryLevel)] + platThick + 0.03;
  float h = harry(p, vec2(harryX, harryY), 0.022);
  col += vec3(0.2, 0.4, 1.0) * h; // Blue outfit
  // Face
  float face = smoothstep(0.01, 0.006, length(p - vec2(harryX, harryY + 0.024)));
  col += vec3(0.95, 0.75, 0.6) * face; // Skin tone
  // Hat
  float hatShape = step(abs(p.x - harryX), 0.014) *
                   step(harryY + 0.033, p.y) * step(p.y, harryY + 0.042);
  col += vec3(0.8, 0.1, 0.1) * hatShape;

  // Giant caged duck at top
  vec2 cageCenter = vec2(0.0, 0.46);
  float cage = cageBars(p, cageCenter, 0.12, 0.06);
  col += vec3(0.6, 0.6, 0.6) * cage;

  // Duck inside cage
  vec2 duckP = p - cageCenter;
  float duckBody = smoothstep(0.022, 0.018, length(duckP / vec2(1.3, 1.0)));
  float duckHead = smoothstep(0.012, 0.008, length(duckP - vec2(0.02, 0.012)));
  float duckBeak = smoothstep(0.006, 0.003, length(duckP - vec2(0.035, 0.01)));
  // Duck sways with music
  float duckSway = sin(uTime * 2.0 + uBassEnergy * 3.0) * 0.005;
  duckBody = smoothstep(0.022, 0.018, length((p - cageCenter - vec2(duckSway, 0.0)) / vec2(1.3, 1.0)));
  col += vec3(1.0, 0.85, 0.0) * duckBody; // Yellow duck
  col += vec3(1.0, 0.9, 0.0) * duckHead;
  col += vec3(1.0, 0.5, 0.0) * duckBeak;
  // Duck eye
  float duckEye = smoothstep(0.004, 0.002, length(duckP - vec2(0.025, 0.016)));
  col -= vec3(0.8) * duckEye * duckBody;

  // Score display area at top
  float scoreBar = step(0.93, uv.y) * 0.15;
  col += vec3(0.8, 0.8, 0.0) * scoreBar;

  // Transient flash - egg collected burst
  if (uTransient > 0.3) {
    float burst = smoothstep(0.15, 0.0, length(p - vec2(harryX, harryY)));
    col += vec3(1.0, 1.0, 0.5) * burst * uTransient * 0.5;
  }

  // CRT scanlines (BBC Micro style)
  col -= sin(uv.y * 600.0) * 0.04;

  // Slight phosphor glow
  col += vec3(0.0, 0.02, 0.0) * (1.0 - length(uv - 0.5));

  // Vignette
  col *= smoothstep(0.0, 0.7, 1.0 - length((uv - 0.5) * 1.4));

  col *= uIntensity;
  gl_FragColor = vec4(col, 1.0);
}
`;

export class ChuckieEggEffect implements VisualEffect {
  name = 'chuckieEgg';
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
