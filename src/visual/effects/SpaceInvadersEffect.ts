import * as THREE from 'three';
import type { ControlSignals } from '../../store';
import type { VisualEffect, EffectParams } from './types';

/**
 * Space Invaders Rave - Retro pixel invaders that dance, pulse, and swarm
 * to the music. Bass makes them jump, mids make them sway, highs trigger
 * laser shots. Formations morph between patterns on beats.
 */

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
uniform float uSpeed;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec3 uColor4;

float hash(float n) { return fract(sin(n) * 43758.5453); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

// Classic space invader sprite patterns (8x8 pixel art)
// Returns 1.0 if pixel is part of the invader
float invader1(vec2 p) {
  // Crab-type invader
  int row = int(p.y * 8.0);
  int col = int(p.x * 8.0);
  if (col < 0 || col > 7 || row < 0 || row > 7) return 0.0;
  // Mirror horizontally for symmetry
  int mc = col > 3 ? 7 - col : col;
  // Classic crab pattern rows (bottom to top)
  if (row == 0 && (mc == 1 || mc == 2)) return 1.0;
  if (row == 1 && mc >= 0 && mc <= 3) return 1.0;
  if (row == 2 && mc >= 0 && mc <= 3) return 1.0;
  if (row == 3 && (mc == 1 || mc == 2 || mc == 3)) return 1.0;
  if (row == 4 && (mc == 0 || mc == 1)) return 1.0;
  if (row == 5 && (mc == 0 || mc == 1 || mc == 2)) return 1.0;
  if (row == 6 && (mc == 0 || mc == 3)) return 1.0;
  if (row == 7 && (mc == 1 || mc == 2)) return 1.0;
  return 0.0;
}

float invader2(vec2 p) {
  // Squid-type invader
  int row = int(p.y * 8.0);
  int col = int(p.x * 8.0);
  if (col < 0 || col > 7 || row < 0 || row > 7) return 0.0;
  int mc = col > 3 ? 7 - col : col;
  if (row == 0 && mc == 3) return 1.0;
  if (row == 1 && (mc == 2 || mc == 3)) return 1.0;
  if (row == 2 && mc >= 1 && mc <= 3) return 1.0;
  if (row == 3 && (mc == 0 || mc == 2 || mc == 3)) return 1.0;
  if (row == 4 && mc >= 0 && mc <= 3) return 1.0;
  if (row == 5 && (mc == 1 || mc == 3)) return 1.0;
  if (row == 6 && (mc == 0 || mc == 2)) return 1.0;
  if (row == 7 && (mc == 1 || mc == 3)) return 1.0;
  return 0.0;
}

float invader3(vec2 p) {
  // UFO/octopus-type invader
  int row = int(p.y * 8.0);
  int col = int(p.x * 8.0);
  if (col < 0 || col > 7 || row < 0 || row > 7) return 0.0;
  int mc = col > 3 ? 7 - col : col;
  if (row == 0 && (mc == 2 || mc == 3)) return 1.0;
  if (row == 1 && mc >= 1 && mc <= 3) return 1.0;
  if (row == 2 && mc >= 0 && mc <= 3) return 1.0;
  if (row == 3 && (mc == 0 || mc == 1 || mc == 3)) return 1.0;
  if (row == 4 && mc >= 0 && mc <= 3) return 1.0;
  if (row == 5 && (mc == 1 || mc == 2)) return 1.0;
  if (row == 6 && (mc == 0 || mc == 3)) return 1.0;
  if (row == 7 && (mc == 0 || mc == 3)) return 1.0;
  return 0.0;
}

// Get invader pixel based on type
float getInvader(vec2 p, float type) {
  if (type < 0.33) return invader1(p);
  if (type < 0.66) return invader2(p);
  return invader3(p);
}

void main() {
  vec2 uv = vUv;
  float t = uTime * uSpeed;
  
  vec3 col = vec3(0.0);
  
  // Grid of invaders
  float gridSize = 10.0; // number of invaders across
  float invaderSize = 1.0 / gridSize;
  
  // Formation movement - whole grid sways side to side
  float formationPhase = t * 0.3;
  float formationX = sin(formationPhase) * 0.15;
  // Bass makes formation bounce up
  float formationY = uBassEnergy * 0.08 * sin(t * 4.0);
  
  // Apply formation offset
  vec2 formUv = uv + vec2(formationX, formationY);
  
  // Which grid cell are we in?
  vec2 gridPos = floor(formUv * gridSize);
  vec2 cellUv = fract(formUv * gridSize);
  
  // Loop through nearby cells for glow overlap
  for (int dx = -1; dx <= 1; dx++) {
    for (int dy = -1; dy <= 1; dy++) {
      vec2 neighbor = gridPos + vec2(float(dx), float(dy));
      
      // Skip if out of reasonable bounds
      if (neighbor.x < -2.0 || neighbor.x > gridSize + 2.0) continue;
      if (neighbor.y < -2.0 || neighbor.y > gridSize + 2.0) continue;
      
      // Each invader has unique properties
      float id = hash2(neighbor * 7.3 + 0.5);
      float invaderType = hash(id * 100.0);
      
      // Individual dance movement!
      // Each invader bobs to a slightly different beat
      float bobPhase = id * 6.28 + t * (2.0 + id * 3.0);
      float bobX = sin(bobPhase) * 0.15 * uMidEnergy;
      float bobY = abs(sin(bobPhase * 0.7 + id * 3.0)) * 0.2 * uBassEnergy;
      
      // Rotation per invader (they spin on beats!)
      float rot = sin(t * 1.5 + id * 10.0) * 0.3 * uTransient;
      rot += uBassEnergy * sin(t * 3.0 + id * 5.0) * 0.5;
      
      // Scale pulse on bass
      float scale = 0.65 + uBassEnergy * 0.25 * sin(t * 4.0 + id * 2.0);
      
      // Position of invader center relative to current pixel
      vec2 invCenter = (neighbor + 0.5 + vec2(bobX, bobY)) / gridSize;
      vec2 pixelPos = formUv - invCenter;
      
      // Apply rotation
      float cs = cos(rot);
      float sn = sin(rot);
      pixelPos = vec2(pixelPos.x * cs - pixelPos.y * sn, pixelPos.x * sn + pixelPos.y * cs);
      
      // Scale
      pixelPos = pixelPos * gridSize / scale;
      
      // Remap to 0-1 for sprite lookup
      vec2 spriteUv = pixelPos + 0.5;
      
      if (spriteUv.x >= 0.0 && spriteUv.x <= 1.0 && spriteUv.y >= 0.0 && spriteUv.y <= 1.0) {
        float pixel = getInvader(spriteUv, invaderType);
        
        if (pixel > 0.5) {
          // Color based on row and beat
          float rowFrac = neighbor.y / gridSize;
          float colShift = sin(t * 2.0 + neighbor.x * 0.5) * 0.5 + 0.5;
          
          vec3 invColor;
          if (rowFrac < 0.33) {
            invColor = mix(uColor1, uColor2, colShift);
          } else if (rowFrac < 0.66) {
            invColor = mix(uColor2, uColor3, colShift);
          } else {
            invColor = mix(uColor3, uColor4, colShift);
          }
          
          // Strobe on transients
          invColor += vec3(0.5) * uTransient * step(0.7, hash(id * 33.0 + floor(t * 8.0)));
          
          // Glow effect
          float glowStr = 1.0 + uBassEnergy * 0.8;
          col += invColor * pixel * glowStr;
        }
        
        // Soft glow around each invader
        float dist = length(pixelPos) * 0.8;
        float glow = exp(-dist * dist * 3.0) * 0.15;
        vec3 glowCol = mix(uColor1, uColor3, id);
        col += glowCol * glow * (0.5 + uBassEnergy);
      }
    }
  }
  
  // Laser beams shooting down on high energy!
  float laserCount = 8.0;
  for (float i = 0.0; i < 8.0; i++) {
    float laserX = hash(i * 7.7 + floor(t * 2.0)) * 0.8 + 0.1;
    float laserActive = step(0.6, uHighEnergy) * step(0.5, hash(i + floor(t * 4.0) * 0.1));
    float laserDist = abs(uv.x - laserX);
    float laser = exp(-laserDist * laserDist * 8000.0) * laserActive;
    // Animated downward
    float laserY = fract(t * 3.0 + i * 0.3);
    float laserYDist = abs(uv.y - (1.0 - laserY));
    laser *= exp(-laserYDist * laserYDist * 50.0);
    col += uColor4 * laser * 2.0;
  }
  
  // Explosion particles on big transients
  if (uTransient > 0.3) {
    for (float i = 0.0; i < 6.0; i++) {
      float angle = hash(i * 5.5 + floor(t * 3.0)) * 6.28;
      float dist = fract(t * 2.0 + i * 0.2) * 0.3;
      vec2 expCenter = vec2(hash(i * 3.3 + floor(t)), hash(i * 9.1 + floor(t)));
      vec2 expPos = expCenter + vec2(cos(angle), sin(angle)) * dist;
      float expDist = length(uv - expPos);
      float explosion = exp(-expDist * expDist * 200.0) * uTransient * 2.0;
      col += mix(uColor2, vec3(1.0, 0.8, 0.2), 0.5) * explosion;
    }
  }
  
  // Starfield background
  vec2 starUv = uv * 30.0;
  vec2 starCell = floor(starUv);
  float star = step(0.97, hash2(starCell));
  float twinkle = sin(t * 3.0 + hash2(starCell) * 20.0) * 0.5 + 0.5;
  col += vec3(0.3) * star * twinkle * 0.3;
  
  // Scanline effect (retro CRT feel)
  float scanline = sin(uv.y * 400.0) * 0.03 + 1.0;
  col *= scanline;
  
  // Vignette
  float vignette = 1.0 - dot((uv - 0.5) * 1.2, (uv - 0.5) * 1.2);
  col *= vignette;
  
  col *= uIntensity;
  
  gl_FragColor = vec4(col, 1.0);
}
`;

export class SpaceInvadersEffect implements VisualEffect {
  name = 'spaceInvaders';
  private mesh!: THREE.Mesh;
  private material!: THREE.ShaderMaterial;

  init(scene: THREE.Scene): void {
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uBassEnergy: { value: 0 },
        uMidEnergy: { value: 0 },
        uHighEnergy: { value: 0 },
        uTransient: { value: 0 },
        uIntensity: { value: 1.0 },
        uSpeed: { value: 1.0 },
        uColor1: { value: new THREE.Color('#00ff00') },
        uColor2: { value: new THREE.Color('#ff00ff') },
        uColor3: { value: new THREE.Color('#00ffff') },
        uColor4: { value: new THREE.Color('#ffff00') },
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
    u.uSpeed.value = params.speed;
    u.uColor1.value.set(params.colors[0]);
    u.uColor2.value.set(params.colors[1]);
    u.uColor3.value.set(params.colors[2]);
    u.uColor4.value.set(params.colors[3]);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.mesh.parent?.remove(this.mesh);
  }
}
