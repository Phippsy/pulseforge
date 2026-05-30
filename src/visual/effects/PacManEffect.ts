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

/* ── Maze layout ──
   28x31 grid inspired by the classic Pac-Man maze.
   1 = wall, 0 = corridor. Uses symmetry.              */

float mazeWall(vec2 cell) {
  if (cell.x < 0.0 || cell.x > 27.0 || cell.y < 0.0 || cell.y > 30.0) return 1.0;
  int cx = int(cell.x);
  int cy = int(cell.y);
  int mx = cx;
  if (mx > 13) mx = 27 - mx;
  int my = cy;
  if (my > 15) my = 30 - my;
  if (my == 0 || my == 15) return 1.0;
  if (mx == 0) return 1.0;
  if (my == 1) return 0.0;
  if (my == 2 || my == 3) {
    if (mx >= 2 && mx <= 4) return 1.0;
    if (mx >= 6 && mx <= 7) return 1.0;
    if (mx >= 9 && mx <= 13) return 1.0;
    return 0.0;
  }
  if (my == 4) return 0.0;
  if (my == 5) {
    if (mx >= 2 && mx <= 4) return 1.0;
    if (mx == 6) return 1.0;
    if (mx >= 8 && mx <= 10) return 1.0;
    if (mx >= 12 && mx <= 13) return 1.0;
    return 0.0;
  }
  if (my == 6) {
    if (mx == 6) return 1.0;
    if (mx >= 9 && mx <= 10) return 1.0;
    if (mx >= 12 && mx <= 13) return 1.0;
    return 0.0;
  }
  if (my == 7) {
    if (mx >= 1 && mx <= 4) return 1.0;
    if (mx == 6) return 1.0;
    if (mx == 8) return 1.0;
    return 0.0;
  }
  if (my == 8 || my == 9) {
    if (my == 8 && mx >= 1 && mx <= 4) return 1.0;
    if (mx == 6 && my == 9) return 1.0;
    if (mx == 8 && my == 9) return 1.0;
    if (mx >= 9 && mx <= 13) return (mx >= 10 && mx <= 12) ? 0.0 : 1.0;
    return 0.0;
  }
  if (my == 10) {
    if (mx == 6) return 1.0;
    if (mx >= 9 && mx <= 13) return 1.0;
    return 0.0;
  }
  if (my == 11) {
    if (mx >= 2 && mx <= 4) return 1.0;
    if (mx == 6) return 1.0;
    if (mx >= 8 && mx <= 10) return 1.0;
    if (mx >= 12 && mx <= 13) return 1.0;
    return 0.0;
  }
  if (my == 12) return 0.0;
  if (my == 13) {
    if (mx >= 2 && mx <= 7) return 1.0;
    if (mx >= 9 && mx <= 13) return 1.0;
    return 0.0;
  }
  if (my == 14) return 0.0;
  return 0.0;
}

float pacman(vec2 p, float radius, float mouthAngle) {
  float d = length(p);
  float angle = atan(p.y, p.x);
  float mouth = smoothstep(mouthAngle - 0.05, mouthAngle + 0.05, abs(angle));
  return smoothstep(radius + 0.004, radius - 0.004, d) * mouth;
}

float ghost(vec2 p, float size) {
  // Dome top (hemisphere)
  vec2 top = p - vec2(0.0, size * 0.05);
  float body = smoothstep(size + 0.003, size - 0.003, length(top));
  // Flat sides below the equator
  if (p.y < size * 0.05) {
    body = smoothstep(0.003, -0.003, abs(p.x) - size);
  }
  // Scalloped skirt bottom — 3 bumps
  if (p.y < -size * 0.4) {
    float bumps = cos(p.x / size * PI * 3.0) * size * 0.2;
    body *= smoothstep(-size * 0.85 + bumps - 0.003, -size * 0.85 + bumps + 0.003, p.y);
  }
  // Cut off anything above the dome
  body *= smoothstep(size * 1.05, size * 0.95, length(vec2(p.x, max(p.y - size * 0.05, 0.0))));
  return body;
}

float ghostEyes(vec2 p, float size) {
  // Larger white ovals for eyes
  vec2 lEye = (p - vec2(-size * 0.32, size * 0.2)) / vec2(0.75, 1.0);
  vec2 rEye = (p - vec2(size * 0.32, size * 0.2)) / vec2(0.75, 1.0);
  return smoothstep(size * 0.26, size * 0.2, length(lEye))
       + smoothstep(size * 0.26, size * 0.2, length(rEye));
}

float ghostPupils(vec2 p, float size, vec2 look) {
  vec2 off = look * size * 0.1;
  return smoothstep(size * 0.14, size * 0.09, length(p - vec2(-size * 0.3, size * 0.18) - off))
       + smoothstep(size * 0.14, size * 0.09, length(p - vec2(size * 0.3, size * 0.18) - off));
}

float pelletDot(vec2 p, float radius) {
  return smoothstep(radius + 0.003, radius - 0.003, length(p));
}

float powerPellet(vec2 p, float radius, float time) {
  float pulse = 0.7 + 0.3 * sin(time * 5.0);
  return smoothstep(radius * pulse + 0.003, radius * pulse - 0.003, length(p));
}

void main() {
  vec2 uv = vUv;
  vec2 p = (uv - 0.5) * vec2(uAspect, 1.0);
  vec3 col = vec3(0.0, 0.0, 0.02);

  // Map to maze grid (28x31) — centred and scaled to fill screen height
  float mazeScale = 1.15;
  float cellSize = mazeScale / 31.0;
  float mazeWidth = 28.0 * cellSize;
  float mazeHeight = 31.0 * cellSize;
  vec2 mazeOrigin = vec2(-mazeWidth * 0.5, -mazeHeight * 0.5);
  vec2 mazeP = (p - mazeOrigin) / cellSize;
  vec2 mazeCell = floor(mazeP);
  vec2 mazeFrac = fract(mazeP) - 0.5;

  float isWall = mazeWall(mazeCell);
  float wallR = mazeWall(mazeCell + vec2(1.0, 0.0));
  float wallL = mazeWall(mazeCell + vec2(-1.0, 0.0));
  float wallU = mazeWall(mazeCell + vec2(0.0, 1.0));
  float wallD = mazeWall(mazeCell + vec2(0.0, -1.0));

  col += vec3(0.0, 0.0, 0.08) * isWall;
  float edgeBrt = 0.7 + 0.3 * uBassEnergy;
  vec3 wCol = vec3(0.15, 0.3, 1.0) * edgeBrt;
  if (isWall > 0.5) {
    float et = 0.42;
    if (wallR < 0.5) col += wCol * smoothstep(et, et + 0.08, mazeFrac.x);
    if (wallL < 0.5) col += wCol * smoothstep(et, et + 0.08, -mazeFrac.x);
    if (wallU < 0.5) col += wCol * smoothstep(et, et + 0.08, mazeFrac.y);
    if (wallD < 0.5) col += wCol * smoothstep(et, et + 0.08, -mazeFrac.y);
  }

  // Pac-Man grid-based movement
  float moveSpeed = 4.0 + uMidEnergy * 3.0;
  float t = uTime * moveSpeed;
  float segLen = 5.0;
  float totalPath = segLen * 8.0;
  float pathT = mod(t, totalPath);
  int seg = int(pathT / segLen);
  float sf = mod(pathT, segLen);

  vec2 pacGrid; vec2 pacDir;
  if (seg == 0) { pacGrid = vec2(1.0 + sf * 2.0, 1.0); pacDir = vec2(1.0, 0.0); }
  else if (seg == 1) { pacGrid = vec2(11.0, 1.0 + sf * 2.0); pacDir = vec2(0.0, 1.0); }
  else if (seg == 2) { pacGrid = vec2(11.0 + sf * 2.0, 11.0); pacDir = vec2(1.0, 0.0); }
  else if (seg == 3) { pacGrid = vec2(21.0, 11.0 + sf * 2.0); pacDir = vec2(0.0, 1.0); }
  else if (seg == 4) { pacGrid = vec2(21.0 - sf * 2.0, 21.0); pacDir = vec2(-1.0, 0.0); }
  else if (seg == 5) { pacGrid = vec2(11.0, 21.0 + sf * 1.6); pacDir = vec2(0.0, 1.0); }
  else if (seg == 6) { pacGrid = vec2(11.0 - sf * 2.0, 29.0); pacDir = vec2(-1.0, 0.0); }
  else { pacGrid = vec2(1.0, 29.0 - sf * 4.0); pacDir = vec2(0.0, -1.0); }
  pacGrid = clamp(pacGrid, vec2(1.0), vec2(26.0, 29.0));

  vec2 pacPos = mazeOrigin + pacGrid * cellSize + cellSize * 0.5;
  vec2 toPac = p - pacPos;
  float pacAngle = atan(pacDir.y, pacDir.x);
  float cosA = cos(-pacAngle); float sinA = sin(-pacAngle);
  vec2 pacLocal = vec2(toPac.x * cosA - toPac.y * sinA, toPac.x * sinA + toPac.y * cosA);

  float chompRate = 10.0 + uMidEnergy * 8.0;
  float mouthAngle = 0.1 + abs(sin(uTime * chompRate)) * 0.65;
  float pacSize = cellSize * 0.42;
  float pacShape = pacman(pacLocal, pacSize, mouthAngle);
  col += vec3(1.0, 0.92, 0.0) * pacShape;
  vec2 eyeP = vec2(0.003, pacSize * 0.45);
  col -= vec3(1.0, 0.92, 0.0) * smoothstep(pacSize * 0.2, pacSize * 0.12, length(pacLocal - eyeP)) * pacShape;

  // Ghosts (grid-based with patrol routes)
  float scared = smoothstep(0.5, 0.9, uBassEnergy);
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float gSpeed = uTime * (2.5 + fi * 0.3 + uHighEnergy * 1.5);
    float gPathLen = 6.0 + fi * 0.8;
    float gTotal = gPathLen * 4.0;
    float gT = mod(gSpeed + fi * 7.0, gTotal);
    int gSeg = int(gT / gPathLen);
    float gF = mod(gT, gPathLen);
    float bx = 5.0 + fi * 5.0;
    float by = 4.0 + fi * 3.0;
    vec2 gGrid; vec2 gDir;
    if (gSeg == 0) { gGrid = vec2(bx + gF * 2.0, by); gDir = vec2(1.0, 0.0); }
    else if (gSeg == 1) { gGrid = vec2(bx + gPathLen * 2.0, by + gF * 2.5); gDir = vec2(0.0, 1.0); }
    else if (gSeg == 2) { gGrid = vec2(bx + gPathLen * 2.0 - gF * 2.0, by + gPathLen * 2.5); gDir = vec2(-1.0, 0.0); }
    else { gGrid = vec2(bx, by + gPathLen * 2.5 - gF * 2.5); gDir = vec2(0.0, -1.0); }
    gGrid = clamp(gGrid, vec2(1.0), vec2(26.0, 29.0));
    vec2 gPos = mazeOrigin + gGrid * cellSize + cellSize * 0.5;
    vec2 toG = p - gPos;
    float gSize = cellSize * 0.4;
    float gBody = ghost(toG, gSize);
    vec3 gc;
    if (i == 0) gc = vec3(1.0, 0.0, 0.0);
    else if (i == 1) gc = vec3(1.0, 0.7, 0.85);
    else if (i == 2) gc = vec3(0.0, 1.0, 1.0);
    else gc = vec3(1.0, 0.6, 0.1);
    gc = mix(gc, vec3(0.2, 0.2, 1.0), scared);
    if (scared > 0.3) {
      float sm = smoothstep(gSize * 0.06, gSize * 0.02, abs(toG.y + gSize * 0.15)) *
                 step(abs(toG.x), gSize * 0.5) * (0.5 + 0.5 * sin(toG.x * 80.0));
      gc = mix(gc, vec3(0.8, 0.8, 1.0), sm * gBody * scared);
    }
    col += gc * gBody;
    col += vec3(1.0) * ghostEyes(toG, gSize) * gBody;
    vec2 lk = normalize(pacPos - gPos);
    col -= gc * ghostPupils(toG, gSize, lk) * gBody;
    col -= vec3(0.5) * ghostPupils(toG, gSize, lk) * gBody;
  }

  // Dots in corridors
  for (int dx = 1; dx <= 26; dx++) {
    for (int dy = 1; dy <= 29; dy++) {
      vec2 dc = vec2(float(dx), float(dy));
      if (mazeWall(dc) > 0.5) continue;
      if ((dx + dy) % 2 != 0) continue;
      vec2 dw = mazeOrigin + dc * cellSize + cellSize * 0.5;
      float eaten = smoothstep(cellSize * 1.5, cellSize * 2.5, length(dw - pacPos));
      col += vec3(1.0, 0.85, 0.6) * pelletDot(p - dw, cellSize * 0.08) * eaten;
    }
  }

  // Power pellets in 4 corners
  for (int i = 0; i < 4; i++) {
    vec2 cp = mazeOrigin + vec2(i < 2 ? 1.0 : 26.0, (i == 0 || i == 2) ? 1.0 : 29.0) * cellSize + cellSize * 0.5;
    float ep = smoothstep(cellSize * 1.5, cellSize * 2.5, length(cp - pacPos));
    col += vec3(1.0, 0.85, 0.6) * powerPellet(p - cp, cellSize * 0.18, uTime) * ep;
  }

  // Cherries — always visible near centre of maze
  {
    vec2 cherryGrid = vec2(14.0, 17.0);
    vec2 cherryPos = mazeOrigin + cherryGrid * cellSize + cellSize * 0.5;
    float cEaten = smoothstep(cellSize * 1.2, cellSize * 2.0, length(cherryPos - pacPos));
    float cSize = cellSize * 0.3;
    // Two cherry spheres
    vec2 c1 = cherryPos + vec2(-cSize * 0.55, -cSize * 0.2);
    vec2 c2 = cherryPos + vec2(cSize * 0.55, -cSize * 0.1);
    float cherry1 = smoothstep(cSize + 0.002, cSize - 0.002, length(p - c1));
    float cherry2 = smoothstep(cSize + 0.002, cSize - 0.002, length(p - c2));
    // Highlight on each cherry
    float hi1 = smoothstep(cSize * 0.45, cSize * 0.3, length(p - c1 + vec2(cSize * 0.2, -cSize * 0.2)));
    float hi2 = smoothstep(cSize * 0.45, cSize * 0.3, length(p - c2 + vec2(cSize * 0.2, -cSize * 0.2)));
    col += vec3(0.9, 0.05, 0.1) * (cherry1 + cherry2) * cEaten;
    col += vec3(0.3, 0.1, 0.1) * (hi1 * cherry1 + hi2 * cherry2) * cEaten;
    // Stems — thin lines going up from each cherry meeting at a point
    vec2 stemTop = cherryPos + vec2(0.0, cSize * 1.4);
    // Stem from cherry 1
    vec2 s1dir = normalize(stemTop - c1);
    float s1t = clamp(dot(p - c1, s1dir), 0.0, length(stemTop - c1));
    float s1d = length(p - c1 - s1dir * s1t);
    col += vec3(0.2, 0.6, 0.1) * smoothstep(cellSize * 0.04, cellSize * 0.01, s1d) * cEaten;
    // Stem from cherry 2
    vec2 s2dir = normalize(stemTop - c2);
    float s2t = clamp(dot(p - c2, s2dir), 0.0, length(stemTop - c2));
    float s2d = length(p - c2 - s2dir * s2t);
    col += vec3(0.2, 0.6, 0.1) * smoothstep(cellSize * 0.04, cellSize * 0.01, s2d) * cEaten;
    // Small leaf at the top
    vec2 leafP = p - stemTop;
    float leafAngle = atan(leafP.y, leafP.x) - 0.5;
    float leafR = length(leafP);
    float leaf = smoothstep(cSize * 0.6, cSize * 0.4, leafR / (0.5 + 0.5 * cos(leafAngle * 2.0)));
    col += vec3(0.1, 0.7, 0.15) * leaf * step(leafP.x, cSize * 0.3) * step(-cSize * 0.1, leafP.y) * cEaten;
  }

  // Bonus fruit flash on transient
  if (uTransient > 0.4) {
    vec2 fp = mazeOrigin + vec2(14.0, 15.0) * cellSize;
    col += vec3(1.0, 0.6, 0.0) * smoothstep(cellSize * 0.5, cellSize * 0.2, length(p - fp)) * uTransient;
  }

  // CRT scanlines
  col -= sin(uv.y * 800.0) * 0.04;
  // Vignette
  col *= smoothstep(0.0, 0.7, 1.0 - length((uv - 0.5) * 1.3));
  col *= uIntensity;
  gl_FragColor = vec4(col, 1.0);
}
`;

export class PacManEffect implements VisualEffect {
  name = 'pacman';
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
