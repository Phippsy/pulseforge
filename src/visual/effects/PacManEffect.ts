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

// Pac-Man shape: circle with mouth
float pacman(vec2 p, float radius, float mouthAngle) {
  float d = length(p);
  float angle = atan(p.y, p.x);
  float mouth = smoothstep(mouthAngle - 0.05, mouthAngle + 0.05, abs(angle));
  return smoothstep(radius + 0.005, radius - 0.005, d) * mouth;
}

// Ghost shape
float ghost(vec2 p, float size) {
  // Body (rounded top rectangle)
  float body = 0.0;
  vec2 top = p - vec2(0.0, size * 0.1);
  float dome = length(top);
  body = smoothstep(size + 0.003, size - 0.003, dome);
  
  // Skirt bottom (wavy)
  if (p.y < -size * 0.3) {
    float skirtX = p.x / size;
    float wave = sin(skirtX * PI * 3.0) * size * 0.15;
    float bottomEdge = -size * 0.9 + wave;
    body *= smoothstep(bottomEdge - 0.003, bottomEdge + 0.003, p.y);
  }
  
  // Eyes
  float eyeL = smoothstep(size * 0.22, size * 0.18, length(p - vec2(-size * 0.3, size * 0.15)));
  float eyeR = smoothstep(size * 0.22, size * 0.18, length(p - vec2(size * 0.3, size * 0.15)));
  float pupilL = smoothstep(size * 0.12, size * 0.08, length(p - vec2(-size * 0.25, size * 0.12)));
  float pupilR = smoothstep(size * 0.12, size * 0.08, length(p - vec2(size * 0.25, size * 0.12)));
  
  return body;
}

float ghostEyes(vec2 p, float size) {
  float eyeL = smoothstep(size * 0.22, size * 0.18, length(p - vec2(-size * 0.3, size * 0.15)));
  float eyeR = smoothstep(size * 0.22, size * 0.18, length(p - vec2(size * 0.3, size * 0.15)));
  return eyeL + eyeR;
}

float ghostPupils(vec2 p, float size) {
  float pupilL = smoothstep(size * 0.12, size * 0.08, length(p - vec2(-size * 0.25, size * 0.12)));
  float pupilR = smoothstep(size * 0.12, size * 0.08, length(p - vec2(size * 0.25, size * 0.12)));
  return pupilL + pupilR;
}

// Pellet dot
float pelletDot(vec2 p, float radius) {
  return smoothstep(radius + 0.003, radius - 0.003, length(p));
}

// Power pellet (larger, pulsing)
float powerPellet(vec2 p, float radius, float time) {
  float pulse = 0.8 + 0.2 * sin(time * 6.0);
  return smoothstep(radius * pulse + 0.003, radius * pulse - 0.003, length(p));
}

void main() {
  vec2 uv = vUv;
  vec2 p = (uv - 0.5) * vec2(uAspect, 1.0);
  
  vec3 col = vec3(0.0, 0.0, 0.02); // Dark blue-black background (classic arcade)
  
  // Maze walls (simplified grid pattern)
  vec2 mazeUv = uv * 14.0;
  vec2 mazeCell = floor(mazeUv);
  vec2 mazeFrac = fract(mazeUv) - 0.5;
  
  // Create maze-like corridors
  float mazeHash = fract(sin(dot(mazeCell, vec2(127.1, 311.7))) * 43758.5453);
  float wallThick = 0.35;
  float isWall = 0.0;
  
  // Horizontal walls
  if (mazeHash > 0.6 && abs(mazeFrac.y) > wallThick) {
    isWall = 1.0;
  }
  // Vertical walls
  if (mazeHash < 0.4 && abs(mazeFrac.x) > wallThick) {
    isWall = 1.0;
  }
  
  // Border walls
  if (uv.x < 0.03 || uv.x > 0.97 || uv.y < 0.03 || uv.y > 0.97) {
    isWall = 1.0;
  }
  
  // Maze wall color (deep blue with neon edge)
  float wallEdge = smoothstep(0.4, 0.35, abs(mazeFrac.x)) * smoothstep(0.4, 0.35, abs(mazeFrac.y));
  col += vec3(0.0, 0.0, 0.15) * isWall;
  col += vec3(0.1, 0.2, 0.8) * isWall * wallEdge * 0.5;
  
  // Pac-Man position (moves in a circle, speed based on mid energy)
  float pacSpeed = uTime * (1.5 + uMidEnergy * 2.0);
  float pacRadius = 0.3 + uBassEnergy * 0.1;
  vec2 pacPos = vec2(
    cos(pacSpeed * 0.7) * pacRadius,
    sin(pacSpeed * 1.1) * pacRadius * 0.6
  );
  
  // Pac-Man facing direction
  float pacAngle = atan(
    cos(pacSpeed * 1.1 + 0.01) * pacRadius * 0.6 - sin(pacSpeed * 1.1) * pacRadius * 0.6,
    -sin(pacSpeed * 0.7 + 0.01) * pacRadius - cos(pacSpeed * 0.7) * pacRadius
  );
  
  // Rotate point to pac-man's local space
  vec2 toPac = p - pacPos;
  float cosA = cos(-pacAngle);
  float sinA = sin(-pacAngle);
  vec2 pacLocal = vec2(toPac.x * cosA - toPac.y * sinA, toPac.x * sinA + toPac.y * cosA);
  
  // Mouth animation (chomps faster with more energy)
  float chompSpeed = 8.0 + uMidEnergy * 12.0;
  float mouthAngle = 0.15 + abs(sin(uTime * chompSpeed)) * 0.7;
  
  float pacShape = pacman(pacLocal, 0.06 + uBassEnergy * 0.01, mouthAngle);
  col += vec3(1.0, 0.9, 0.0) * pacShape; // Classic yellow
  
  // Pac-Man eye
  float eyeDist = length(pacLocal - vec2(0.01, 0.025));
  col += vec3(0.0) * smoothstep(0.012, 0.008, eyeDist) * pacShape;
  col -= vec3(1.0, 0.9, 0.0) * smoothstep(0.012, 0.008, eyeDist) * pacShape;
  
  // Ghosts (4 of them, different colours)
  float scared = smoothstep(0.5, 0.8, uBassEnergy); // Ghosts turn blue on heavy bass
  
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float ghostSpeed = uTime * (0.8 + fi * 0.2) + fi * PI * 0.5;
    float ghostR = 0.25 + fi * 0.05;
    vec2 ghostPos = vec2(
      sin(ghostSpeed * 0.6 + fi * 1.5) * ghostR,
      cos(ghostSpeed * 0.8 + fi * 2.0) * ghostR * 0.5
    );
    
    vec2 toGhost = p - ghostPos;
    float gSize = 0.05 + uHighEnergy * 0.005;
    float gBody = ghost(toGhost, gSize);
    
    // Ghost colour (blue when scared)
    vec3 baseGhostCol;
    if (i == 0) baseGhostCol = vec3(1.0, 0.0, 0.0);
    else if (i == 1) baseGhostCol = vec3(1.0, 0.7, 0.8);
    else if (i == 2) baseGhostCol = vec3(0.0, 1.0, 1.0);
    else baseGhostCol = vec3(1.0, 0.6, 0.0);
    
    vec3 gColor = mix(baseGhostCol, vec3(0.2, 0.2, 1.0), scared);
    col += gColor * gBody;
    
    // White eyes
    float eyes = ghostEyes(toGhost, gSize);
    col += vec3(1.0) * eyes * gBody;
    
    // Dark pupils
    float pupils = ghostPupils(toGhost, gSize);
    col -= gColor * pupils * gBody;
    col -= vec3(0.5) * pupils * gBody;
  }
  
  // Dots (scattered in a grid)
  for (int dx = -4; dx <= 4; dx++) {
    for (int dy = -3; dy <= 3; dy++) {
      vec2 dotPos = vec2(float(dx), float(dy)) * 0.09;
      float dotDist = length(p - dotPos);
      
      // Skip dots near pac-man (eaten!)
      float nearPac = length(dotPos - pacPos);
      float eaten = smoothstep(0.08, 0.12, nearPac);
      
      float d = pelletDot(p - dotPos, 0.006) * eaten;
      col += vec3(1.0, 0.85, 0.6) * d;
    }
  }
  
  // Power pellets in corners
  for (int i = 0; i < 4; i++) {
    vec2 pelletPos = vec2(
      (i < 2) ? -0.35 : 0.35,
      (i == 0 || i == 2) ? -0.25 : 0.25
    );
    float nearPac2 = length(pelletPos - pacPos);
    float eaten2 = smoothstep(0.08, 0.12, nearPac2);
    float pp = powerPellet(p - pelletPos, 0.012, uTime) * eaten2;
    col += vec3(1.0, 0.85, 0.6) * pp;
  }
  
  // Transient flash (fruit bonus!)
  if (uTransient > 0.5) {
    vec2 fruitPos = vec2(sin(uTime * 0.3) * 0.1, cos(uTime * 0.4) * 0.1);
    float cherry = smoothstep(0.02, 0.015, length(p - fruitPos));
    col += vec3(1.0, 0.0, 0.2) * cherry * uTransient;
    float cherry2 = smoothstep(0.02, 0.015, length(p - fruitPos - vec2(0.02, 0.01)));
    col += vec3(1.0, 0.0, 0.2) * cherry2 * uTransient;
  }
  
  // Score text area glow at top
  float scoreGlow = smoothstep(0.48, 0.5, uv.y) * smoothstep(0.52, 0.5, uv.y) * 0.1;
  col += vec3(1.0) * scoreGlow * uHighEnergy;
  
  // CRT scanlines
  float scanline = sin(uv.y * 800.0) * 0.03;
  col -= scanline;
  
  // Vignette
  float vig = 1.0 - length((uv - 0.5) * 1.3);
  col *= smoothstep(0.0, 0.7, vig);
  
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
