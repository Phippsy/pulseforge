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

// Girder (sloped platform)
float girder(vec2 p, vec2 start, vec2 end, float thickness) {
  vec2 d = end - start;
  float len = length(d);
  vec2 n = d / len;
  vec2 rel = p - start;
  float along = dot(rel, n);
  float perp = abs(dot(rel, vec2(-n.y, n.x)));
  return step(0.0, along) * step(along, len) * step(perp, thickness);
}

// Ladder
float ladder(vec2 p, vec2 base, float width, float height) {
  float r1 = step(abs(p.x - base.x + width * 0.5), 0.003) *
             step(base.y, p.y) * step(p.y, base.y + height);
  float r2 = step(abs(p.x - base.x - width * 0.5), 0.003) *
             step(base.y, p.y) * step(p.y, base.y + height);
  float rungs = step(abs(p.x - base.x), width * 0.5) *
                step(base.y, p.y) * step(p.y, base.y + height) *
                (1.0 - step(0.003, mod(p.y - base.y, 0.02)));
  return max(max(r1, r2), rungs * 0.7);
}

// Barrel shape (circle)
float barrel(vec2 p, vec2 pos, float radius) {
  return smoothstep(radius + 0.004, radius - 0.004, length(p - pos));
}

// Mario character (small pixel figure)
float mario(vec2 p, vec2 pos, float size) {
  vec2 lp = p - pos;
  // Body
  float body = smoothstep(size + 0.003, size - 0.003, length(lp / vec2(0.7, 1.0)));
  // Head
  float head = smoothstep(size * 0.4, size * 0.3, length(lp - vec2(0.0, size * 1.0)));
  // Cap
  float cap = step(abs(lp.x), size * 0.5) *
              step(size * 1.15, lp.y) * step(lp.y, size * 1.4);
  // Legs (animated)
  float legAnim = sin(uTime * 10.0) * size * 0.3;
  float leg1 = step(abs(lp.x - legAnim * 0.4), 0.004) *
               step(-size * 1.3, lp.y) * step(lp.y, -size * 0.4);
  float leg2 = step(abs(lp.x + legAnim * 0.4), 0.004) *
               step(-size * 1.3, lp.y) * step(lp.y, -size * 0.4);
  return max(max(body, head), max(cap, max(leg1, leg2) * 0.5));
}

// Donkey Kong (large gorilla at top)
float donkeyKong(vec2 p, vec2 pos, float size) {
  vec2 lp = p - pos;
  // Large body
  float body = smoothstep(size * 1.3 + 0.005, size * 1.3 - 0.005,
    length(lp / vec2(1.2, 1.0)));
  // Head
  float head = smoothstep(size * 0.7, size * 0.6,
    length(lp - vec2(0.0, size * 1.1)));
  // Arms spread
  float armL = step(abs(lp.y - size * 0.3), size * 0.2) *
               step(-size * 2.0, lp.x) * step(lp.x, -size * 0.8) * 0.8;
  float armR = step(abs(lp.y - size * 0.3), size * 0.2) *
               step(size * 0.8, lp.x) * step(lp.x, size * 2.0) * 0.8;
  // Chest pattern
  float chest = smoothstep(size * 0.6, size * 0.4,
    length((lp - vec2(0.0, -size * 0.1)) / vec2(0.7, 1.0)));
  return max(max(body, head), max(armL, armR));
}

// Oil drum / fire at bottom
float oilDrum(vec2 p, vec2 pos, float size) {
  vec2 d = abs(p - pos) - vec2(size * 0.6, size);
  return 1.0 - step(0.0, max(d.x, d.y));
}

// Fire flicker
float fire(vec2 p, vec2 pos, float size, float time) {
  float flicker = sin(time * 8.0 + p.x * 30.0) * 0.3 + 0.7;
  float f = smoothstep(size * 1.5, 0.0, length(p - pos - vec2(0.0, size * 0.5)));
  return f * flicker;
}

// Hammer power-up
float hammer(vec2 p, vec2 pos, float size) {
  // Handle
  float handle = step(abs(p.x - pos.x), size * 0.1) *
                 step(pos.y - size, p.y) * step(p.y, pos.y + size);
  // Head
  vec2 hd = abs(p - pos - vec2(0.0, size)) - vec2(size * 0.4, size * 0.25);
  float headBlock = 1.0 - step(0.0, max(hd.x, hd.y));
  return max(handle * 0.6, headBlock);
}

void main() {
  vec2 uv = vUv;
  vec2 p = (uv - 0.5) * vec2(uAspect, 1.0);

  // Dark arcade background
  vec3 col = vec3(0.0, 0.0, 0.02);

  // ── Girders (crooked/sloped platforms) ──
  vec3 girderColor = vec3(0.8, 0.2, 0.3); // Red/pink girders
  float girderPulse = 1.0 + uBassEnergy * 0.15;

  // 6 levels of sloped girders
  float slopes[6];
  slopes[0] = -0.38;
  slopes[1] = -0.22;
  slopes[2] = -0.06;
  slopes[3] = 0.10;
  slopes[4] = 0.26;
  slopes[5] = 0.38;

  for (int i = 0; i < 6; i++) {
    float y = slopes[i];
    float slope = (i % 2 == 0) ? 0.04 : -0.04; // Alternate slope direction
    float xExtent = 0.38;
    vec2 gStart = vec2(-xExtent, y - slope);
    vec2 gEnd = vec2(xExtent, y + slope);
    float g = girder(p, gStart, gEnd, 0.012);
    col += girderColor * girderPulse * g;

    // Rivet dots on girders
    for (int j = 0; j < 5; j++) {
      float rx = -xExtent + float(j) * xExtent * 0.5;
      float ry = y + slope * (rx / xExtent);
      float rivet = smoothstep(0.006, 0.003, length(p - vec2(rx, ry)));
      col += vec3(0.4, 0.4, 0.5) * rivet * g;
    }
  }

  // ── Ladders connecting girders ──
  vec3 ladderColor = vec3(0.3, 0.7, 1.0); // Blue ladders
  for (int i = 0; i < 5; i++) {
    float lx = -0.25 + float(i % 3) * 0.25;
    if (i >= 3) lx = -0.15 + float(i - 3) * 0.3;
    float ly = slopes[i] + 0.012;
    float lh = slopes[i + 1] - slopes[i] - 0.012;
    col += ladderColor * ladder(p, vec2(lx, ly), 0.018, lh) * 0.8;
  }

  // ── Barrels rolling down girders ──
  vec3 barrelColor = vec3(0.6, 0.35, 0.1); // Brown barrels
  vec3 barrelStripe = vec3(0.9, 0.6, 0.2);

  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    // Barrel spawns on bass hits, rolls down
    float barrelTime = uTime * (1.5 + uBassEnergy * 2.0) + fi * 2.5;

    // Which girder level
    int level = int(mod(floor(barrelTime * 0.3), 6.0));
    float rollFrac = fract(barrelTime * 0.3);

    float by = slopes[level];
    float slope = (level % 2 == 0) ? 0.04 : -0.04;
    float rollDir = (level % 2 == 0) ? 1.0 : -1.0;
    float bx = -0.35 * rollDir + rollFrac * 0.7 * rollDir;
    by += slope * (bx / 0.38);

    vec2 bPos = vec2(bx, by + 0.022);
    float b = barrel(p, bPos, 0.014);
    col += barrelColor * b;

    // Barrel stripe (rotating)
    float rot = barrelTime * 5.0;
    vec2 bp = p - bPos;
    float stripe = abs(sin(atan(bp.y, bp.x) * 2.0 + rot));
    col += barrelStripe * b * stripe * 0.4;

    // Barrel roll rotation indicator
    float ring = smoothstep(0.014, 0.012, length(bp)) - smoothstep(0.012, 0.010, length(bp));
    col += vec3(0.4, 0.2, 0.05) * ring;
  }

  // ── Mario climbing ──
  float marioSpeed = 0.2 + uMidEnergy * 0.15;
  float marioPath = mod(uTime * marioSpeed, 6.0);
  int marioLevel = int(marioPath);
  float marioFrac = fract(marioPath);

  float marioX, marioY;
  float mLevel = slopes[min(marioLevel, 5)];
  float mSlope = (marioLevel % 2 == 0) ? 0.04 : -0.04;
  float mDir = (marioLevel % 2 == 0) ? 1.0 : -1.0;

  // Climbing ladder phase vs running on girder phase
  if (marioFrac < 0.7) {
    // Running along girder
    float runFrac = marioFrac / 0.7;
    marioX = -0.3 * mDir + runFrac * 0.6 * mDir;
    marioY = mLevel + mSlope * (marioX / 0.38) + 0.025;
  } else {
    // Climbing ladder
    float climbFrac = (marioFrac - 0.7) / 0.3;
    marioX = 0.3 * mDir; // At end of girder
    int nextLevel = min(marioLevel + 1, 5);
    marioY = mLevel + climbFrac * (slopes[nextLevel] - mLevel) + 0.025;
  }

  // Jump on transient
  float jumpHeight = uTransient * 0.04;
  marioY += jumpHeight;

  float m = mario(p, vec2(marioX, marioY), 0.018);
  // Mario colors
  col += vec3(0.9, 0.1, 0.1) * m; // Red overalls/cap
  float mHead = smoothstep(0.008, 0.005, length(p - vec2(marioX, marioY + 0.018)));
  col += vec3(0.95, 0.75, 0.6) * mHead; // Skin

  // ── Donkey Kong at top ──
  vec2 dkPos = vec2(sin(uTime * 0.5) * 0.05, 0.44);
  float dk = donkeyKong(p, dkPos, 0.04);
  col += vec3(0.45, 0.25, 0.1) * dk; // Brown gorilla

  // DK face
  float dkFace = smoothstep(0.025, 0.018,
    length((p - dkPos - vec2(0.0, 0.044)) / vec2(0.8, 1.0)));
  col += vec3(0.7, 0.5, 0.3) * dkFace;

  // DK eyes
  float dkEyeL = smoothstep(0.006, 0.003, length(p - dkPos - vec2(-0.012, 0.05)));
  float dkEyeR = smoothstep(0.006, 0.003, length(p - dkPos - vec2(0.012, 0.05)));
  col += vec3(1.0) * (dkEyeL + dkEyeR) * dk;

  // DK mouth (sneer)
  float dkMouth = smoothstep(0.004, 0.002, abs(p.y - dkPos.y - 0.035)) *
                  step(abs(p.x - dkPos.x), 0.015) * dk;
  col += vec3(0.8, 0.2, 0.1) * dkMouth;

  // DK beating chest on bass
  if (uBassEnergy > 0.5) {
    float chestBeat = smoothstep(0.06, 0.0, length(p - dkPos)) * (uBassEnergy - 0.5) * 0.3;
    col += vec3(0.5, 0.3, 0.1) * chestBeat;
  }

  // ── Pauline (HELP!) at top ──
  vec2 paulinePos = vec2(0.15, 0.46);
  float pauline = smoothstep(0.015, 0.01, length((p - paulinePos) / vec2(0.6, 1.0)));
  col += vec3(1.0, 0.3, 0.5) * pauline; // Pink dress

  // HELP! text glow
  float helpGlow = smoothstep(0.06, 0.02, length(p - paulinePos - vec2(0.0, 0.03)));
  col += vec3(1.0, 0.8, 0.8) * helpGlow * 0.15 * (0.5 + 0.5 * sin(uTime * 4.0));

  // ── Oil drum with fire at bottom ──
  vec2 drumPos = vec2(-0.35, -0.44);
  float drum = oilDrum(p, drumPos, 0.015);
  col += vec3(0.3, 0.3, 0.4) * drum;
  // "OIL" label
  col += vec3(0.8, 0.8, 0.0) * drum * 0.3;

  // Fire
  float f = fire(p, drumPos, 0.02, uTime);
  col += vec3(1.0, 0.4, 0.0) * f * 0.6;
  col += vec3(1.0, 0.8, 0.1) * f * 0.3;

  // ── Hammer power-ups ──
  if (uTransient > 0.6) {
    vec2 hammerPos = vec2(0.25, slopes[2] + 0.03);
    float h = hammer(p, hammerPos, 0.012);
    col += vec3(0.4, 0.8, 1.0) * h * uTransient;
  }

  // ── Height markers (25m, 50m, 75m, 100m) ──
  // Small text-like indicators on the right side
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float markerY = -0.35 + fi * 0.22;
    float markerX = 0.42;
    float marker = smoothstep(0.015, 0.008, length(p - vec2(markerX, markerY)));
    col += vec3(0.0, 0.8, 1.0) * marker * 0.4;
  }

  // ── Score area at top ──
  float scoreGlow = step(0.94, uv.y) * 0.1;
  col += vec3(0.8, 0.2, 0.2) * scoreGlow;

  // CRT scanlines
  col -= sin(uv.y * 800.0) * 0.04;

  // Vignette
  col *= smoothstep(0.0, 0.7, 1.0 - length((uv - 0.5) * 1.3));

  col *= uIntensity;
  gl_FragColor = vec4(col, 1.0);
}
`;

export class DonkeyKongEffect implements VisualEffect {
  name = 'donkeyKong';
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
