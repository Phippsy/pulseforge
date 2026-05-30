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

float hash(float n) { return fract(sin(n) * 43758.5453); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

// Tetromino shapes encoded as 4x4 bitmaps
// I=0, O=1, T=2, S=3, Z=4, L=5, J=6
float tetrominoBit(int type, vec2 cell) {
  int x = int(cell.x);
  int y = int(cell.y);
  if (x < 0 || x > 3 || y < 0 || y > 3) return 0.0;

  // I-piece (horizontal)
  if (type == 0) return (y == 1 && x >= 0 && x <= 3) ? 1.0 : 0.0;
  // O-piece
  if (type == 1) return ((x == 1 || x == 2) && (y == 1 || y == 2)) ? 1.0 : 0.0;
  // T-piece
  if (type == 2) return ((y == 1 && x >= 0 && x <= 2) || (y == 2 && x == 1)) ? 1.0 : 0.0;
  // S-piece
  if (type == 3) return ((y == 1 && x >= 1 && x <= 2) || (y == 2 && x >= 0 && x <= 1)) ? 1.0 : 0.0;
  // Z-piece
  if (type == 4) return ((y == 2 && x >= 1 && x <= 2) || (y == 1 && x >= 0 && x <= 1)) ? 1.0 : 0.0;
  // L-piece
  if (type == 5) return ((y == 1 && x >= 0 && x <= 2) || (y == 2 && x == 0)) ? 1.0 : 0.0;
  // J-piece
  if (type == 6) return ((y == 1 && x >= 0 && x <= 2) || (y == 2 && x == 2)) ? 1.0 : 0.0;
  return 0.0;
}

// Tetromino colour
vec3 tetrominoColor(int type) {
  if (type == 0) return vec3(0.0, 0.95, 0.95); // I - cyan
  if (type == 1) return vec3(0.95, 0.95, 0.0); // O - yellow
  if (type == 2) return vec3(0.7, 0.0, 0.95);  // T - purple
  if (type == 3) return vec3(0.0, 0.95, 0.3);  // S - green
  if (type == 4) return vec3(0.95, 0.2, 0.2);  // Z - red
  if (type == 5) return vec3(0.95, 0.5, 0.0);  // L - orange
  return vec3(0.1, 0.3, 0.95);                 // J - blue
}

// Draw a single block with bevelled edges
float blockCell(vec2 uv) {
  vec2 f = fract(uv);
  float inner = step(0.08, f.x) * step(f.x, 0.92) *
                step(0.08, f.y) * step(f.y, 0.92);
  float border = step(0.02, f.x) * step(f.x, 0.98) *
                 step(0.02, f.y) * step(f.y, 0.98);
  return mix(0.4, 1.0, inner) * border;
}

// Particle effect (floating dots around playfield)
float particles(vec2 p, float time, float seed) {
  float total = 0.0;
  for (int i = 0; i < 20; i++) {
    float fi = float(i);
    float angle = hash(fi + seed) * PI * 2.0;
    float radius = 0.25 + hash(fi * 3.7 + seed) * 0.35;
    float speed = 0.3 + hash(fi * 7.1 + seed) * 0.5;
    vec2 pos = vec2(
      cos(angle + time * speed * 0.3) * radius,
      sin(angle * 1.5 + time * speed * 0.4) * radius + sin(time * 0.2 + fi) * 0.05
    );
    float size = 0.003 + hash(fi * 11.3 + seed) * 0.004;
    float brightness = 0.4 + 0.6 * sin(time * 2.0 + fi * 1.5);
    total += smoothstep(size, size * 0.3, length(p - pos)) * brightness;
  }
  return total;
}

// Aurora / nebula background (Tetris Effect style)
vec3 auroraBackground(vec2 p, float time, float energy) {
  vec3 col = vec3(0.0);

  // Layer 1: deep flowing gradient
  float wave1 = sin(p.x * 3.0 + time * 0.15) * cos(p.y * 2.0 + time * 0.1);
  float wave2 = sin(p.x * 5.0 - time * 0.2 + p.y * 3.0) * 0.5;
  float wave3 = cos(p.y * 4.0 + time * 0.12 + p.x * 2.0);

  // Colour shifts with energy
  vec3 deepBlue = vec3(0.02, 0.03, 0.12);
  vec3 purple = vec3(0.15, 0.05, 0.25) * (1.0 + energy * 0.5);
  vec3 teal = vec3(0.0, 0.15, 0.2) * (1.0 + energy * 0.3);
  vec3 pink = vec3(0.2, 0.05, 0.15) * energy;

  col = deepBlue;
  col += purple * (wave1 * 0.5 + 0.5) * 0.3;
  col += teal * (wave2 * 0.5 + 0.5) * 0.25;
  col += pink * (wave3 * 0.5 + 0.5) * 0.2;

  // Subtle horizontal aurora bands
  float band = sin(p.y * 8.0 + time * 0.3 + wave1 * 2.0) * 0.5 + 0.5;
  band = pow(band, 3.0);
  col += vec3(0.1, 0.3, 0.4) * band * 0.15 * (1.0 + energy);

  return col;
}

void main() {
  vec2 uv = vUv;
  vec2 p = (uv - 0.5) * vec2(uAspect, 1.0);
  float t = uTime;
  float energy = (uBassEnergy + uMidEnergy + uHighEnergy) / 3.0;

  // ── Aurora / nebula background ──
  vec3 col = auroraBackground(p, t, energy);

  // Background particle field (Tetris Effect-style floating motes)
  float bgParticles = particles(p, t, 0.0);
  vec3 particleCol = mix(
    vec3(0.3, 0.6, 1.0),
    vec3(0.8, 0.4, 1.0),
    sin(t * 0.3) * 0.5 + 0.5
  );
  col += particleCol * bgParticles * 0.25 * (1.0 + uMidEnergy * 0.5);

  // ── Playfield dimensions ──
  float fieldW = 10.0;
  float fieldH = 20.0;
  float cellSize = 0.023;
  float fieldPxW = fieldW * cellSize;
  float fieldPxH = fieldH * cellSize;
  vec2 fieldOrigin = vec2(-fieldPxW * 0.5, -fieldPxH * 0.5);

  // Field-local coordinates
  vec2 fp = p - fieldOrigin;
  vec2 cellPos = fp / cellSize;
  vec2 gridCell = floor(cellPos);
  bool inField = gridCell.x >= 0.0 && gridCell.x < fieldW &&
                 gridCell.y >= 0.0 && gridCell.y < fieldH;

  // ── Playfield border glow ──
  float borderDist = max(
    max(-fp.x, fp.x - fieldPxW),
    max(-fp.y, fp.y - fieldPxH)
  );
  float borderGlow = smoothstep(0.02, 0.0, borderDist) - smoothstep(0.0, -0.003, borderDist);
  vec3 borderCol = mix(
    vec3(0.2, 0.5, 1.0),
    vec3(0.5, 0.2, 1.0),
    sin(t * 0.5) * 0.5 + 0.5
  );
  col += borderCol * borderGlow * (0.5 + uBassEnergy * 0.5);

  // Outer halo
  float halo = smoothstep(0.06, 0.0, borderDist) * 0.08;
  col += borderCol * halo * (1.0 + uBassEnergy);

  // ── Playfield background (dark, slightly transparent) ──
  if (inField) {
    col *= 0.15; // Darken inside field

    // Subtle grid lines
    vec2 f = fract(cellPos);
    float gridLine = 1.0 - step(0.06, f.x) * step(0.06, f.y);
    col += vec3(0.1, 0.15, 0.3) * gridLine * 0.1;
  }

  // ── Stacked blocks (pre-placed pieces) ──
  if (inField) {
    int gx = int(gridCell.x);
    int gy = int(gridCell.y);

    // Generate a pseudo-random stack pattern
    // Rows fill from bottom; higher rows are less full
    float fillHeight = 8.0 + sin(t * 0.1) * 2.0 + uBassEnergy * 3.0;
    float rowFill = float(gy) / fillHeight;

    if (float(gy) < fillHeight) {
      // Each cell has a hash determining if filled and what colour
      float cellHash = hash2(vec2(float(gx) * 7.3, float(gy) * 13.1 + floor(t * 0.05)));
      // Probability of fill decreases with height
      float fillProb = 0.85 - rowFill * 0.4;
      // Leave gaps (create "holes" for realism)
      float gap = step(0.15, hash2(vec2(float(gx) + 0.5, float(gy) + floor(t * 0.03))));

      if (cellHash < fillProb && gap > 0.5) {
        int pieceType = int(mod(cellHash * 7.0, 7.0));
        vec3 blockCol = tetrominoColor(pieceType);
        float block = blockCell(cellPos);

        // Blocks pulse gently with the beat
        float pulse = 1.0 + uBassEnergy * 0.25;
        // Top row blocks glow more intensely
        float topGlow = smoothstep(fillHeight - 2.0, fillHeight, float(gy));

        col += blockCol * block * 0.7 * pulse;
        col += blockCol * topGlow * block * 0.2;
      }
    }
  }

  // ── Falling tetromino (active piece) ──
  {
    float dropSpeed = 4.0 + uMidEnergy * 2.0;
    int pieceType = int(mod(floor(t * 0.3), 7.0));
    float dropCol = mod(floor(t * 0.7 + 3.0), fieldW - 3.0);
    float dropRow = mod(t * dropSpeed, fieldH + 4.0);
    float dropY = fieldH - dropRow; // falls from top

    vec2 pieceOrigin = vec2(dropCol, dropY);

    for (int dy = 0; dy < 4; dy++) {
      for (int dx = 0; dx < 4; dx++) {
        float bit = tetrominoBit(pieceType, vec2(float(dx), float(dy)));
        if (bit > 0.5) {
          vec2 blockPos = pieceOrigin + vec2(float(dx), float(dy));
          // Check if this cell matches current grid cell
          if (inField) {
            vec2 diff = gridCell - blockPos;
            if (abs(diff.x) < 0.5 && abs(diff.y) < 0.5) {
              vec3 blockCol = tetrominoColor(pieceType);
              float block = blockCell(cellPos);
              float pulse = 1.0 + uBassEnergy * 0.3;
              col += blockCol * block * pulse;

              // Ghost glow around falling piece
              float glow = smoothstep(1.5, 0.0, length(cellPos - blockPos - vec2(0.5)));
              col += blockCol * glow * 0.08;
            }
          }
        }
      }
    }

    // Ghost piece (shadow at bottom) - faint
    if (inField && dropY > 0.0) {
      float ghostY = 0.0; // bottom
      for (int dy2 = 0; dy2 < 4; dy2++) {
        for (int dx2 = 0; dx2 < 4; dx2++) {
          float bit2 = tetrominoBit(pieceType, vec2(float(dx2), float(dy2)));
          if (bit2 > 0.5) {
            vec2 ghostPos = vec2(dropCol + float(dx2), ghostY + float(dy2));
            vec2 diff2 = gridCell - ghostPos;
            if (abs(diff2.x) < 0.5 && abs(diff2.y) < 0.5) {
              vec3 ghostCol = tetrominoColor(pieceType);
              float block2 = blockCell(cellPos);
              col += ghostCol * block2 * 0.12;
            }
          }
        }
      }
    }
  }

  // ── Line clear effect (on transient / bass hit) ──
  if (uTransient > 0.3) {
    // Flash rows near bottom
    if (inField) {
      for (int r = 0; r < 4; r++) {
        float clearRow = float(r) + floor(hash(floor(t * 0.5)) * 4.0);
        if (abs(gridCell.y - clearRow) < 0.5) {
          float flash = uTransient * 1.5;
          col += vec3(1.0, 1.0, 1.0) * flash * 0.5;

          // Particle burst from cleared line (outside field)
          for (int j = 0; j < 5; j++) {
            float fj = float(j);
            float angle = (fj / 5.0) * PI - PI * 0.5;
            float speed = 0.05 + hash(fj + clearRow) * 0.08;
            float life = fract(t * 2.0 + fj * 0.2);
            vec2 burstPos = vec2(
              fieldOrigin.x + fieldPxW * 0.5 + cos(angle) * speed * life * (1.0 + float(r)),
              fieldOrigin.y + clearRow * cellSize + sin(angle) * speed * life
            );
            float burstDot = smoothstep(0.005, 0.001, length(p - burstPos));
            vec3 burstCol = tetrominoColor(int(mod(fj + clearRow, 7.0)));
            col += burstCol * burstDot * (1.0 - life) * uTransient;
          }
        }
      }
    }
  }

  // ── Zone effect halo (heavy bass = Tetris Effect "Zone" mode) ──
  if (uBassEnergy > 0.6) {
    float zonePulse = (uBassEnergy - 0.6) * 2.5;
    // Radial glow from field center
    float zoneGlow = smoothstep(0.4, 0.0, length(p)) * zonePulse * 0.15;
    vec3 zoneCol = mix(vec3(0.2, 0.5, 1.0), vec3(1.0, 0.8, 0.3), sin(t * 3.0) * 0.5 + 0.5);
    col += zoneCol * zoneGlow;

    // Concentric ripples outward
    float ripple = sin(length(p) * 40.0 - t * 8.0) * 0.5 + 0.5;
    col += zoneCol * ripple * 0.03 * zonePulse;
  }

  // ── Floating tetromino silhouettes in background ──
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    int bgType = int(mod(fi * 3.0 + floor(t * 0.2), 7.0));
    float bgScale = 0.06 + hash(fi * 5.3) * 0.04;
    float bgX = sin(t * 0.1 * (1.0 + fi * 0.3) + fi * 2.0) * 0.5;
    float bgY = mod(t * 0.05 * (1.0 + fi * 0.2) + fi * 0.33, 1.2) - 0.6;
    float bgAlpha = 0.06 + 0.04 * sin(t + fi * 1.5);
    float bgRot = t * 0.2 * (1.0 + fi * 0.1);

    vec2 bp = p - vec2(bgX, bgY);
    // Rotate
    float cs = cos(bgRot), sn = sin(bgRot);
    bp = vec2(bp.x * cs - bp.y * sn, bp.x * sn + bp.y * cs);
    bp /= bgScale;
    bp += 2.0; // offset to center in 4x4

    vec2 bgCell = floor(bp);
    if (bgCell.x >= 0.0 && bgCell.x < 4.0 && bgCell.y >= 0.0 && bgCell.y < 4.0) {
      float bit = tetrominoBit(bgType, bgCell);
      if (bit > 0.5) {
        vec2 f = fract(bp);
        float inner = step(0.1, f.x) * step(f.x, 0.9) * step(0.1, f.y) * step(f.y, 0.9);
        vec3 bgBlockCol = tetrominoColor(bgType);
        col += bgBlockCol * inner * bgAlpha * (1.0 + uHighEnergy * 0.3);
      }
    }
  }

  // ── Next piece preview (top right of field) ──
  {
    int nextType = int(mod(floor(t * 0.3) + 1.0, 7.0));
    vec2 previewOrigin = fieldOrigin + vec2(fieldPxW + cellSize * 1.5, fieldPxH - cellSize * 5.0);
    vec2 previewCell = (p - previewOrigin) / (cellSize * 0.8);
    vec2 previewGrid = floor(previewCell);

    if (previewGrid.x >= 0.0 && previewGrid.x < 4.0 &&
        previewGrid.y >= 0.0 && previewGrid.y < 4.0) {
      float bit = tetrominoBit(nextType, previewGrid);
      if (bit > 0.5) {
        vec3 nextCol = tetrominoColor(nextType);
        float block = blockCell(previewCell);
        col += nextCol * block * 0.5;
      }
    }

    // "NEXT" label glow
    float nextGlow = smoothstep(0.04, 0.02, length(p - previewOrigin - vec2(cellSize * 1.5, cellSize * 4.5)));
    col += vec3(0.5, 0.5, 0.7) * nextGlow * 0.1;
  }

  // ── Score / level area glow ──
  {
    vec2 scorePos = fieldOrigin + vec2(-cellSize * 4.0, fieldPxH - cellSize * 3.0);
    float scoreGlow = smoothstep(0.05, 0.02, length(p - scorePos));
    col += vec3(0.3, 0.5, 0.8) * scoreGlow * 0.08;
  }

  // ── High energy sparkle (stars) ──
  if (uHighEnergy > 0.3) {
    for (int i = 0; i < 8; i++) {
      float fi = float(i);
      vec2 starPos = vec2(
        sin(fi * 4.7 + t * 0.8) * 0.45,
        cos(fi * 3.3 + t * 0.6) * 0.4
      );
      float starBright = hash(fi * 17.3 + floor(t * 3.0)) * uHighEnergy;
      float star = smoothstep(0.004, 0.001, length(p - starPos));
      col += vec3(1.0, 0.95, 0.8) * star * starBright;
    }
  }

  // ── CRT scanlines (subtle) ──
  col -= sin(uv.y * 800.0) * 0.02;

  // ── Vignette ──
  col *= smoothstep(0.0, 0.7, 1.0 - length((uv - 0.5) * 1.3));

  col *= uIntensity;
  gl_FragColor = vec4(col, 1.0);
}
`;

export class TetrisEffect implements VisualEffect {
  name = 'tetris';
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
