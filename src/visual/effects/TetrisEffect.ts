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
#define FIELD_W 10.0
#define FIELD_H 20.0

float hash(float n) { return fract(sin(n) * 43758.5453); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float hash3(vec2 p) { return fract(sin(dot(p, vec2(269.5, 183.3))) * 61731.547); }

// ── Tetromino data ──
// I=0, O=1, T=2, S=3, Z=4, L=5, J=6
// Each piece has 4 rotation states
float tetrominoBit(int type, int rot, vec2 cell) {
  int x = int(cell.x);
  int y = int(cell.y);
  if (x < 0 || x > 3 || y < 0 || y > 3) return 0.0;

  // I-piece
  if (type == 0) {
    if (rot == 0 || rot == 2) return (y == 1 && x >= 0 && x <= 3) ? 1.0 : 0.0;
    return (x == 2 && y >= 0 && y <= 3) ? 1.0 : 0.0;
  }
  // O-piece (no rotation)
  if (type == 1) return ((x == 1 || x == 2) && (y == 1 || y == 2)) ? 1.0 : 0.0;
  // T-piece
  if (type == 2) {
    if (rot == 0) return ((y == 1 && x >= 0 && x <= 2) || (y == 2 && x == 1)) ? 1.0 : 0.0;
    if (rot == 1) return ((x == 1 && y >= 0 && y <= 2) || (y == 1 && x == 2)) ? 1.0 : 0.0;
    if (rot == 2) return ((y == 1 && x >= 0 && x <= 2) || (y == 0 && x == 1)) ? 1.0 : 0.0;
    return ((x == 1 && y >= 0 && y <= 2) || (y == 1 && x == 0)) ? 1.0 : 0.0;
  }
  // S-piece
  if (type == 3) {
    if (rot == 0 || rot == 2) return ((y == 1 && x >= 1 && x <= 2) || (y == 2 && x >= 0 && x <= 1)) ? 1.0 : 0.0;
    return ((x == 0 && y >= 1 && y <= 2) || (x == 1 && y >= 0 && y <= 1)) ? 1.0 : 0.0;
  }
  // Z-piece
  if (type == 4) {
    if (rot == 0 || rot == 2) return ((y == 2 && x >= 1 && x <= 2) || (y == 1 && x >= 0 && x <= 1)) ? 1.0 : 0.0;
    return ((x == 0 && y >= 0 && y <= 1) || (x == 1 && y >= 1 && y <= 2)) ? 1.0 : 0.0;
  }
  // L-piece
  if (type == 5) {
    if (rot == 0) return ((y == 1 && x >= 0 && x <= 2) || (y == 2 && x == 0)) ? 1.0 : 0.0;
    if (rot == 1) return ((x == 1 && y >= 0 && y <= 2) || (y == 0 && x == 0)) ? 1.0 : 0.0;
    if (rot == 2) return ((y == 1 && x >= 0 && x <= 2) || (y == 0 && x == 2)) ? 1.0 : 0.0;
    return ((x == 1 && y >= 0 && y <= 2) || (y == 2 && x == 2)) ? 1.0 : 0.0;
  }
  // J-piece
  if (rot == 0) return ((y == 1 && x >= 0 && x <= 2) || (y == 2 && x == 2)) ? 1.0 : 0.0;
  if (rot == 1) return ((x == 1 && y >= 0 && y <= 2) || (y == 2 && x == 0)) ? 1.0 : 0.0;
  if (rot == 2) return ((y == 1 && x >= 0 && x <= 2) || (y == 0 && x == 0)) ? 1.0 : 0.0;
  return ((x == 1 && y >= 0 && y <= 2) || (y == 0 && x == 2)) ? 1.0 : 0.0;
}

// Convenience wrapper with no rotation
float tetrominoBit(int type, vec2 cell) {
  return tetrominoBit(type, 0, cell);
}

// Tetromino colours — guideline standard
vec3 tetrominoColor(int type) {
  if (type == 0) return vec3(0.0, 0.92, 0.92);  // I - cyan
  if (type == 1) return vec3(0.92, 0.92, 0.0);  // O - yellow
  if (type == 2) return vec3(0.65, 0.0, 0.9);   // T - purple
  if (type == 3) return vec3(0.0, 0.9, 0.35);   // S - green
  if (type == 4) return vec3(0.9, 0.15, 0.15);  // Z - red
  if (type == 5) return vec3(0.9, 0.5, 0.0);    // L - orange
  return vec3(0.1, 0.3, 0.9);                    // J - blue
}

// Draw a single block with bevelled 3D-style shading
float blockCell(vec2 uv, out float highlight) {
  vec2 f = fract(uv);
  float outer = step(0.03, f.x) * step(f.x, 0.97) * step(0.03, f.y) * step(f.y, 0.97);
  float inner = step(0.12, f.x) * step(f.x, 0.88) * step(0.12, f.y) * step(f.y, 0.88);
  // Top-left highlight
  highlight = (1.0 - smoothstep(0.03, 0.18, f.x)) * step(0.03, f.y) * step(f.y, 0.97) * 0.3;
  highlight += (1.0 - smoothstep(0.03, 0.18, f.y)) * step(0.03, f.x) * step(f.x, 0.97) * 0.15;
  return mix(0.55, 1.0, inner) * outer;
}

// Particle field
float particles(vec2 p, float time, float seed, int count) {
  float total = 0.0;
  for (int i = 0; i < 30; i++) {
    if (i >= count) break;
    float fi = float(i);
    float angle = hash(fi + seed) * PI * 2.0;
    float radius = 0.2 + hash(fi * 3.7 + seed) * 0.6;
    float speed = 0.15 + hash(fi * 7.1 + seed) * 0.35;
    vec2 pos = vec2(
      cos(angle + time * speed * 0.3) * radius,
      sin(angle * 1.3 + time * speed * 0.25) * radius
    );
    float size = 0.002 + hash(fi * 11.3 + seed) * 0.003;
    float brightness = 0.3 + 0.7 * sin(time * 1.5 + fi * 1.7);
    total += smoothstep(size, size * 0.2, length(p - pos)) * brightness;
  }
  return total;
}

// Aurora / nebula background
vec3 auroraBackground(vec2 p, float time, float energy) {
  float wave1 = sin(p.x * 2.5 + time * 0.12) * cos(p.y * 1.8 + time * 0.08);
  float wave2 = sin(p.x * 4.0 - time * 0.15 + p.y * 2.5) * 0.5;
  float wave3 = cos(p.y * 3.5 + time * 0.1 + p.x * 1.5);

  vec3 col = vec3(0.015, 0.02, 0.08);
  col += vec3(0.12, 0.04, 0.22) * (1.0 + energy * 0.4) * (wave1 * 0.5 + 0.5) * 0.35;
  col += vec3(0.0, 0.12, 0.18) * (1.0 + energy * 0.3) * (wave2 * 0.5 + 0.5) * 0.3;
  col += vec3(0.18, 0.04, 0.12) * energy * (wave3 * 0.5 + 0.5) * 0.25;

  // Aurora bands
  float band = sin(p.y * 6.0 + time * 0.2 + wave1 * 2.5) * 0.5 + 0.5;
  col += vec3(0.08, 0.25, 0.35) * pow(band, 4.0) * 0.12 * (1.0 + energy);

  return col;
}

// ── Deterministic gameplay simulation ──
// Generates a believable Tetris stack that changes over time
// Uses "epochs" — each epoch is a complete piece placement cycle
float getStackCell(int gx, int gy, float epoch) {
  // Build up a deterministic but Tetris-like stack
  // Each row from bottom has a fill pattern that looks like placed pieces
  float rowSeed = hash(float(gy) * 31.7 + epoch * 0.1);
  float colSeed = hash2(vec2(float(gx) * 13.3, float(gy) * 7.1 + epoch * 0.1));

  // Row fill probability — bottom rows almost full, top rows sparse
  // Stack height oscillates (simulating line clears reducing height)
  float maxH = 10.0 + sin(epoch * 0.7) * 3.0 + sin(epoch * 0.23) * 2.0;

  if (float(gy) >= maxH) return 0.0;

  // Each row has a gap pattern — usually 1-2 gaps per row (like real Tetris)
  float normalised = float(gy) / maxH;
  float fillProb = 0.9 - normalised * 0.35;

  // Create gap columns that shift per row (looks like misplaced pieces)
  float gapCol1 = mod(rowSeed * 10.0, 10.0);
  float gapCol2 = mod(rowSeed * 10.0 + 4.7, 10.0);

  // Near the gap columns, cells are more likely empty
  float distToGap = min(abs(float(gx) - gapCol1), abs(float(gx) - gapCol2));
  float gapInfluence = smoothstep(1.5, 0.0, distToGap) * 0.6;
  fillProb -= gapInfluence;

  // Top rows are jagged
  if (normalised > 0.7) {
    fillProb -= (normalised - 0.7) * 1.5;
  }

  return colSeed < fillProb ? 1.0 : 0.0;
}

int getStackColor(int gx, int gy, float epoch) {
  // Assign colours in 2-3 wide horizontal bands to mimic placed pieces
  float h = hash2(vec2(floor(float(gx) / 2.5) * 3.1, float(gy) * 5.7 + epoch * 0.1));
  return int(mod(h * 7.0, 7.0));
}

void main() {
  vec2 uv = vUv;
  vec2 p = (uv - 0.5) * vec2(uAspect, 1.0);
  float t = uTime;
  float energy = (uBassEnergy + uMidEnergy + uHighEnergy) / 3.0;

  // ── Aurora background ──
  vec3 col = auroraBackground(p, t, energy);

  // ── Background particles (two layers) ──
  float bgP1 = particles(p, t, 0.0, 25);
  float bgP2 = particles(p * 0.8, t * 0.7, 100.0, 20);
  vec3 pCol1 = mix(vec3(0.3, 0.6, 1.0), vec3(0.8, 0.3, 1.0), sin(t * 0.25) * 0.5 + 0.5);
  vec3 pCol2 = mix(vec3(0.0, 0.8, 0.6), vec3(1.0, 0.6, 0.3), cos(t * 0.18) * 0.5 + 0.5);
  col += pCol1 * bgP1 * 0.2 * (1.0 + uMidEnergy * 0.4);
  col += pCol2 * bgP2 * 0.12 * (1.0 + uHighEnergy * 0.3);

  // ── Floating background tetrominoes (16 pieces, spread wide) ──
  for (int i = 0; i < 16; i++) {
    float fi = float(i);
    int bgType = int(mod(fi * 3.0 + floor(t * 0.15), 7.0));
    int bgRot = int(mod(floor(t * 0.25 + fi * 1.7), 4.0));
    float bgScale = 0.04 + hash(fi * 5.3) * 0.05;

    // Spread across the entire screen
    float spreadX = (hash(fi * 2.3) - 0.5) * uAspect * 1.8;
    float driftX = sin(t * 0.06 * (1.0 + fi * 0.15) + fi * 1.1) * 0.15;
    float bgX = spreadX + driftX;
    float bgY = mod(-t * (0.02 + hash(fi * 9.1) * 0.03) + fi * 0.25, 1.6) - 0.8;
    float bgAlpha = 0.04 + 0.03 * sin(t * 0.8 + fi * 2.1);
    float bgRotAngle = t * (0.1 + fi * 0.02) * (hash(fi * 4.0) > 0.5 ? 1.0 : -1.0);

    vec2 bp = p - vec2(bgX, bgY);
    float cs = cos(bgRotAngle), sn = sin(bgRotAngle);
    bp = vec2(bp.x * cs - bp.y * sn, bp.x * sn + bp.y * cs);
    bp /= bgScale;
    bp += 2.0;

    vec2 bgCell = floor(bp);
    if (bgCell.x >= 0.0 && bgCell.x < 4.0 && bgCell.y >= 0.0 && bgCell.y < 4.0) {
      float bit = tetrominoBit(bgType, bgRot, bgCell);
      if (bit > 0.5) {
        vec2 f = fract(bp);
        float inner = step(0.1, f.x) * step(f.x, 0.9) * step(0.1, f.y) * step(f.y, 0.9);
        vec3 bgBlockCol = tetrominoColor(bgType);
        // Depth-based glow — some pieces brighter
        float depthFade = 0.5 + 0.5 * hash(fi * 7.7);
        col += bgBlockCol * inner * bgAlpha * depthFade * (1.0 + uHighEnergy * 0.4);
        // Soft glow halo
        float glowSize = 0.3;
        float glow = smoothstep(glowSize, 0.0, length(fract(bp) - 0.5)) * 0.02;
        col += bgBlockCol * glow * bgAlpha;
      }
    }
  }

  // ── Playfield ──
  // Cell size scaled so the field takes up ~75% of screen height
  float cellSize = 0.042;
  float fieldPxW = FIELD_W * cellSize;
  float fieldPxH = FIELD_H * cellSize;
  vec2 fieldOrigin = vec2(-fieldPxW * 0.5, -fieldPxH * 0.5);

  vec2 fp = p - fieldOrigin;
  vec2 cellPos = fp / cellSize;
  vec2 gridCell = floor(cellPos);
  bool inField = gridCell.x >= 0.0 && gridCell.x < FIELD_W &&
                 gridCell.y >= 0.0 && gridCell.y < FIELD_H;

  // ── Playfield border ──
  float borderDist = max(
    max(-fp.x, fp.x - fieldPxW),
    max(-fp.y, fp.y - fieldPxH)
  );
  vec3 borderCol = mix(
    vec3(0.15, 0.4, 0.9),
    vec3(0.5, 0.15, 0.9),
    sin(t * 0.4) * 0.5 + 0.5
  );
  // Crisp border line
  float borderLine = smoothstep(0.003, 0.001, abs(borderDist));
  col += borderCol * borderLine * (0.6 + uBassEnergy * 0.4);
  // Outer glow
  float outerGlow = smoothstep(0.08, 0.0, borderDist) * 0.06;
  col += borderCol * outerGlow * (1.0 + uBassEnergy * 0.8);

  // ── Playfield interior ──
  if (inField) {
    col *= 0.1;

    // Grid lines
    vec2 f = fract(cellPos);
    float gridLine = 1.0 - step(0.05, f.x) * step(0.05, f.y);
    col += vec3(0.08, 0.1, 0.2) * gridLine * 0.12;
  }

  // Gameplay epoch (changes piece sequence over time)
  float epoch = floor(t * 0.3);

  // ── Stacked blocks (deterministic Tetris-like pattern) ──
  if (inField) {
    int gx = int(gridCell.x);
    int gy = int(gridCell.y);

    float filled = getStackCell(gx, gy, epoch);
    if (filled > 0.5) {
      int pType = getStackColor(gx, gy, epoch);
      vec3 blockCol = tetrominoColor(pType);
      float hl;
      float block = blockCell(cellPos, hl);

      float pulse = 1.0 + uBassEnergy * 0.2;

      // Depth shading: darker at bottom, brighter near surface
      float maxH = 10.0 + sin(epoch * 0.7) * 3.0 + sin(epoch * 0.23) * 2.0;
      float surfaceDist = maxH - float(gy);
      float depthDim = 0.5 + 0.5 * smoothstep(8.0, 0.0, surfaceDist);

      col += blockCol * block * 0.75 * pulse * depthDim;
      col += vec3(1.0) * hl * depthDim * 0.3;

      // Surface blocks glow
      float surfGlow = smoothstep(3.0, 0.0, surfaceDist) * 0.15;
      col += blockCol * surfGlow * block;
    }
  }

  // ── Falling piece (realistic drop with lateral movement + rotation) ──
  {
    // Each "drop" lasts ~3 seconds at base speed
    float dropDuration = 3.0 / (1.0 + uMidEnergy * 0.5);
    float dropPhase = mod(t, dropDuration) / dropDuration;

    // Piece type and rotation change each drop
    float dropIndex = floor(t / dropDuration);
    int pieceType = int(mod(hash(dropIndex * 7.3) * 7.0, 7.0));
    int pieceRot = int(mod(hash(dropIndex * 13.1) * 4.0, 4.0));

    // Column: start near center, offset each drop
    float colOffset = hash(dropIndex * 3.7);
    float dropCol = 1.0 + colOffset * (FIELD_W - 5.0);

    // Lateral wiggle (simulates the player adjusting)
    float wiggle = sin(dropPhase * PI * 3.0) * 0.4 * (1.0 - dropPhase);
    dropCol += wiggle;
    dropCol = floor(dropCol + 0.5); // snap to grid

    // Y position: starts at top, falls down
    // Accelerate near the bottom (soft drop simulation)
    float easedPhase = dropPhase * dropPhase * (3.0 - 2.0 * dropPhase);
    float dropY = FIELD_H - easedPhase * (FIELD_H + 4.0);

    // Rotate mid-fall
    int displayRot = int(mod(float(pieceRot) + floor(dropPhase * 2.0), 4.0));

    // Draw falling piece
    for (int dy = 0; dy < 4; dy++) {
      for (int dx = 0; dx < 4; dx++) {
        float bit = tetrominoBit(pieceType, displayRot, vec2(float(dx), float(dy)));
        if (bit > 0.5) {
          vec2 blockPos = vec2(dropCol + float(dx), dropY + float(dy));
          if (inField) {
            vec2 diff = gridCell - blockPos;
            if (abs(diff.x) < 0.5 && abs(diff.y) < 0.5) {
              vec3 blockCol = tetrominoColor(pieceType);
              float hl;
              float block = blockCell(cellPos, hl);
              float pulse = 1.0 + uBassEnergy * 0.3;
              col += blockCol * block * pulse;
              col += vec3(1.0) * hl * 0.4;
            }
          }
          // Glow trail above falling piece
          if (inField) {
            vec2 glowP = cellPos - vec2(dropCol + float(dx) + 0.5, dropY + float(dy) + 0.5);
            float trail = smoothstep(3.0, 0.0, -glowP.y) * smoothstep(0.0, 0.5, -glowP.y);
            trail *= smoothstep(0.8, 0.0, abs(glowP.x));
            col += tetrominoColor(pieceType) * trail * 0.04;
          }
        }
      }
    }

    // Ghost piece at bottom
    if (inField) {
      float ghostY = 0.0;
      // Find landing position (above the stack)
      float maxH = 10.0 + sin(epoch * 0.7) * 3.0 + sin(epoch * 0.23) * 2.0;
      ghostY = max(0.0, maxH - 1.0);

      for (int dy = 0; dy < 4; dy++) {
        for (int dx = 0; dx < 4; dx++) {
          float bit = tetrominoBit(pieceType, displayRot, vec2(float(dx), float(dy)));
          if (bit > 0.5) {
            vec2 ghostPos = vec2(dropCol + float(dx), ghostY + float(dy));
            vec2 diff = gridCell - ghostPos;
            if (abs(diff.x) < 0.5 && abs(diff.y) < 0.5) {
              vec3 gCol = tetrominoColor(pieceType);
              float hl;
              float block = blockCell(cellPos, hl);
              col += gCol * block * 0.1;
            }
          }
        }
      }
    }
  }

  // ── Line clear flash (on transient) ──
  if (uTransient > 0.3 && inField) {
    float maxH = 10.0 + sin(epoch * 0.7) * 3.0;
    // Flash 1-2 rows near the top of the stack
    for (int r = 0; r < 2; r++) {
      float clearRow = floor(maxH) - float(r) - 1.0;
      if (clearRow >= 0.0 && abs(gridCell.y - clearRow) < 0.5) {
        float flash = uTransient;
        col += vec3(1.0) * flash * 0.6;
      }
    }
    // Burst particles from cleared lines
    for (int j = 0; j < 10; j++) {
      float fj = float(j);
      float life = fract(t * 1.5 + fj * 0.1);
      float angle = (fj / 10.0) * PI * 2.0;
      float speed = 0.04 + hash(fj + 50.0) * 0.06;
      vec2 burstPos = vec2(
        fieldOrigin.x + fieldPxW * 0.5 + cos(angle) * speed * life * 3.0,
        fieldOrigin.y + (floor(10.0 + sin(epoch * 0.7) * 3.0) - 0.5) * cellSize + sin(angle) * speed * life * 2.0
      );
      float burstDot = smoothstep(0.004, 0.001, length(p - burstPos));
      vec3 burstCol = tetrominoColor(int(mod(fj, 7.0)));
      col += burstCol * burstDot * (1.0 - life) * uTransient * 1.5;
    }
  }

  // ── Zone mode halo (heavy bass) ──
  if (uBassEnergy > 0.5) {
    float zonePulse = (uBassEnergy - 0.5) * 2.0;
    float zoneGlow = smoothstep(0.6, 0.0, length(p)) * zonePulse * 0.12;
    vec3 zoneCol = mix(vec3(0.2, 0.5, 1.0), vec3(1.0, 0.7, 0.2), sin(t * 2.5) * 0.5 + 0.5);
    col += zoneCol * zoneGlow;
    float ripple = sin(length(p) * 30.0 - t * 6.0) * 0.5 + 0.5;
    col += zoneCol * ripple * 0.025 * zonePulse;
  }

  // ── Next piece preview ──
  {
    float dropDuration = 3.0 / (1.0 + uMidEnergy * 0.5);
    float dropIndex = floor(t / dropDuration);
    int nextType = int(mod(hash((dropIndex + 1.0) * 7.3) * 7.0, 7.0));

    vec2 previewOrigin = fieldOrigin + vec2(fieldPxW + cellSize * 2.0, fieldPxH - cellSize * 5.0);

    // Preview box outline
    vec2 boxP = p - previewOrigin;
    float boxW = cellSize * 4.5;
    float boxH = cellSize * 4.5;
    float boxDist = max(max(-boxP.x, boxP.x - boxW), max(-boxP.y + cellSize * 0.5, boxP.y - boxH));
    float boxLine = smoothstep(0.002, 0.001, abs(boxDist));
    col += borderCol * boxLine * 0.3;

    vec2 previewCell = (p - previewOrigin) / cellSize;
    vec2 previewGrid = floor(previewCell);
    if (previewGrid.x >= 0.0 && previewGrid.x < 4.0 &&
        previewGrid.y >= 0.0 && previewGrid.y < 4.0) {
      float bit = tetrominoBit(nextType, previewGrid);
      if (bit > 0.5) {
        vec3 nextCol = tetrominoColor(nextType);
        float hl;
        float block = blockCell(previewCell, hl);
        col += nextCol * block * 0.6;
        col += vec3(1.0) * hl * 0.2;
      }
    }
  }

  // ── High-energy sparkles ──
  if (uHighEnergy > 0.25) {
    for (int i = 0; i < 12; i++) {
      float fi = float(i);
      vec2 starPos = vec2(
        sin(fi * 4.7 + t * 0.9) * uAspect * 0.45,
        cos(fi * 3.3 + t * 0.7) * 0.45
      );
      float starBright = hash(fi * 17.3 + floor(t * 4.0)) * uHighEnergy;
      float star = smoothstep(0.003, 0.0008, length(p - starPos));
      col += vec3(1.0, 0.95, 0.85) * star * starBright;
    }
  }

  // ── Scanlines (very subtle) ──
  col *= 1.0 - sin(uv.y * 900.0) * 0.015;

  // ── Vignette ──
  col *= smoothstep(0.0, 0.65, 1.0 - length((uv - 0.5) * 1.2));

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
