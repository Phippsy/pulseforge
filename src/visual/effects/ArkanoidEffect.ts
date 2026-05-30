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

// Hash for pseudo-random
float hash(float n) { return fract(sin(n) * 43758.5453); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

// Brick block
float brick(vec2 p, vec2 pos, vec2 size) {
  vec2 d = abs(p - pos) - size;
  return 1.0 - step(0.0, max(d.x, d.y));
}

// Rounded rectangle (paddle/ball)
float roundRect(vec2 p, vec2 pos, vec2 size, float radius) {
  vec2 d = abs(p - pos) - size + radius;
  return 1.0 - smoothstep(0.0, 0.004, length(max(d, 0.0)) - radius);
}

// Ball (circle)
float ball(vec2 p, vec2 pos, float radius) {
  return smoothstep(radius + 0.003, radius - 0.003, length(p - pos));
}

// Capsule (power-up)
float capsule(vec2 p, vec2 pos, vec2 size) {
  vec2 d = p - pos;
  float r = size.y;
  d.x = abs(d.x) - (size.x - r);
  return smoothstep(r + 0.003, r - 0.003, length(max(d, 0.0)));
}

// Particle burst
float particleBurst(vec2 p, vec2 center, float time, float seed) {
  float total = 0.0;
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float angle = fi * PI * 2.0 / 6.0 + seed;
    float speed = 0.1 + hash(fi + seed * 10.0) * 0.15;
    vec2 partPos = center + vec2(cos(angle), sin(angle)) * speed * time;
    float fade = max(0.0, 1.0 - time * 2.0);
    total += smoothstep(0.006, 0.002, length(p - partPos)) * fade;
  }
  return total;
}

void main() {
  vec2 uv = vUv;
  vec2 p = (uv - 0.5) * vec2(uAspect, 1.0);

  // Tron-inspired dark background with subtle grid
  vec3 col = vec3(0.01, 0.01, 0.04);

  // Subtle background grid (neon)
  float gridX = smoothstep(0.002, 0.0, abs(mod(p.x * 20.0, 1.0) - 0.5) - 0.48);
  float gridY = smoothstep(0.002, 0.0, abs(mod(p.y * 20.0, 1.0) - 0.5) - 0.48);
  col += vec3(0.0, 0.05, 0.15) * (gridX + gridY) * 0.3;

  // ── Brick grid at top ──
  int brickCols = 13;
  int brickRows = 8;
  float brickW = 0.052;
  float brickH = 0.018;
  float brickGap = 0.004;
  float brickStartY = 0.2;

  // Brick colors by row (rainbow Arkanoid style)
  vec3 rowColors[8];
  rowColors[0] = vec3(0.8, 0.8, 0.8); // Silver (2 hits)
  rowColors[1] = vec3(1.0, 0.2, 0.2); // Red
  rowColors[2] = vec3(1.0, 0.6, 0.1); // Orange
  rowColors[3] = vec3(1.0, 0.9, 0.1); // Yellow
  rowColors[4] = vec3(0.2, 1.0, 0.3); // Green
  rowColors[5] = vec3(0.2, 0.6, 1.0); // Blue
  rowColors[6] = vec3(0.7, 0.3, 1.0); // Purple
  rowColors[7] = vec3(1.0, 0.4, 0.7); // Pink

  // Ball position (bouncing)
  float ballSpeed = 2.0 + uMidEnergy * 1.5;
  float bx = sin(uTime * ballSpeed * 0.7) * 0.3;
  float by = sin(uTime * ballSpeed * 1.1) * 0.25;
  // Constrain to play area
  by = -0.15 + abs(by) * 0.55; // Ball stays in upper portion

  vec2 ballPos = vec2(bx, by);

  // Draw bricks
  float totalBrickGlow = 0.0;
  for (int row = 0; row < 8; row++) {
    for (int col2 = 0; col2 < 13; col2++) {
      float fx = float(col2);
      float fy = float(row);

      float bxPos = (fx - 6.0) * (brickW + brickGap);
      float byPos = brickStartY + fy * (brickH + brickGap);
      vec2 bPos = vec2(bxPos, byPos);

      // Bricks get "broken" when ball is near (based on time)
      float brickHash = hash2(vec2(fx, fy));
      float breakTime = brickHash * 20.0 + 5.0;
      float broken = step(breakTime, uTime);

      // Also break on high energy moments
      float energyBreak = step(0.7, uBassEnergy) * step(brickHash, uBassEnergy * 0.5);

      if (broken < 0.5 && energyBreak < 0.5) {
        float b = brick(p, bPos, vec2(brickW * 0.48, brickH * 0.45));
        vec3 bCol = rowColors[row];

        // Brick shimmer
        float shimmer = 0.8 + 0.2 * sin(uTime * 3.0 + fx * 1.5 + fy * 2.0);
        col += bCol * b * shimmer;

        // Neon edge glow
        float edge = brick(p, bPos, vec2(brickW * 0.5, brickH * 0.48)) -
                     brick(p, bPos, vec2(brickW * 0.46, brickH * 0.42));
        col += bCol * max(0.0, edge) * 0.5;

        // Check if ball is near this brick
        float nearBall = smoothstep(0.06, 0.02, length(ballPos - bPos));
        totalBrickGlow += nearBall * b;
      }
    }
  }

  // ── Ball ──
  float b = ball(p, ballPos, 0.01);
  col += vec3(1.0, 1.0, 1.0) * b;

  // Ball glow
  float bGlow = smoothstep(0.04, 0.0, length(p - ballPos));
  col += vec3(0.3, 0.5, 1.0) * bGlow * 0.3;

  // Ball trail
  for (int i = 1; i <= 5; i++) {
    float fi = float(i);
    float trailT = uTime - fi * 0.03;
    float tbx = sin(trailT * ballSpeed * 0.7) * 0.3;
    float tby = -0.15 + abs(sin(trailT * ballSpeed * 1.1)) * 0.55;
    float trail = ball(p, vec2(tbx, tby), 0.008 - fi * 0.001);
    col += vec3(0.3, 0.5, 1.0) * trail * (1.0 - fi * 0.18);
  }

  // ── Paddle (Vaus) at bottom ──
  float paddleX = sin(uTime * 1.2) * 0.25;
  float paddleW = 0.06 + uMidEnergy * 0.02; // Wider on mid energy
  float paddleY = -0.42;
  float paddle = roundRect(p, vec2(paddleX, paddleY), vec2(paddleW, 0.008), 0.005);
  col += vec3(0.6, 0.6, 0.9) * paddle;

  // Paddle neon edge
  float paddleEdge = roundRect(p, vec2(paddleX, paddleY), vec2(paddleW + 0.003, 0.011), 0.006) -
                     roundRect(p, vec2(paddleX, paddleY), vec2(paddleW - 0.002, 0.006), 0.004);
  col += vec3(0.3, 0.5, 1.0) * max(0.0, paddleEdge) * 0.6;

  // ── Power-up capsules falling ──
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float capTime = mod(uTime * 0.5 + fi * 4.0, 8.0);
    float capX = -0.2 + fi * 0.2;
    float capY = 0.3 - capTime * 0.12;
    if (capY > -0.5 && capY < 0.4) {
      float cap = capsule(p, vec2(capX, capY), vec2(0.018, 0.007));
      // Color based on type
      vec3 capCol;
      if (i == 0) capCol = vec3(1.0, 0.3, 0.3); // Laser (red)
      else if (i == 1) capCol = vec3(0.3, 0.3, 1.0); // Enlarge (blue)
      else capCol = vec3(0.3, 1.0, 0.3); // Slow (green)
      col += capCol * cap;

      // Letter on capsule
      float letter = step(abs(p.x - capX), 0.004) *
                     step(abs(p.y - capY), 0.004);
      col += vec3(1.0) * letter * cap * 0.5;
    }
  }

  // ── Break particles on transient ──
  if (uTransient > 0.3) {
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      vec2 burstPos = vec2(
        sin(fi * 2.3 + uTime * 0.1) * 0.25,
        0.15 + fi * 0.06
      );
      float burst = particleBurst(p, burstPos, fract(uTime * 0.5 + fi * 0.25), fi * 3.14);
      vec3 burstCol = rowColors[int(mod(fi * 2.0, 8.0))];
      col += burstCol * burst * uTransient;
    }
  }

  // ── Side borders (metallic) ──
  float borderL = step(p.x, -0.4 * uAspect / uAspect);
  float borderR = step(0.4, p.x);
  // Top border
  float borderT = step(0.46, p.y);
  col += vec3(0.15, 0.15, 0.2) * (borderL + borderR + borderT) * 0.5;

  // ── Score/level display area ──
  float scoreArea = step(0.47, p.y);
  col += vec3(0.0, 0.1, 0.2) * scoreArea;

  // ── Ball-brick collision glow ──
  col += vec3(1.0, 0.8, 0.3) * totalBrickGlow * 0.15;

  // ── Laser beams (on high energy) ──
  if (uHighEnergy > 0.5) {
    float laser1 = step(abs(p.x - paddleX - paddleW * 0.3), 0.002) *
                   step(paddleY, p.y) * step(p.y, 0.4);
    float laser2 = step(abs(p.x - paddleX + paddleW * 0.3), 0.002) *
                   step(paddleY, p.y) * step(p.y, 0.4);
    col += vec3(1.0, 0.2, 0.2) * (laser1 + laser2) * (uHighEnergy - 0.5) * 2.0;
  }

  // CRT scanlines
  col -= sin(uv.y * 800.0) * 0.03;

  // Vignette
  col *= smoothstep(0.0, 0.7, 1.0 - length((uv - 0.5) * 1.3));

  col *= uIntensity;
  gl_FragColor = vec4(col, 1.0);
}
`;

export class ArkanoidEffect implements VisualEffect {
  name = 'arkanoid';
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
