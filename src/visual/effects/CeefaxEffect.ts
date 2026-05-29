import * as THREE from 'three';
import type { ControlSignals } from '../../store';
import type { VisualEffect, EffectParams } from './types';

/**
 * Ceefax/Teletext Effect - Blocky retro teletext graphics that pulse to music
 * Inspired by the BBC Ceefax service (1974-2012) and the DanFest website
 * Blocky pixel art, colour cycling, page reveals, classic teletext aesthetics
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

// Teletext colours (the 8 standard teletext colours)
vec3 teletextColor(float id) {
  float c = mod(id * 7.0, 7.0);
  if (c < 1.0) return vec3(1.0, 0.0, 0.0);       // Red
  if (c < 2.0) return vec3(0.0, 1.0, 0.0);       // Green
  if (c < 3.0) return vec3(1.0, 1.0, 0.0);       // Yellow
  if (c < 4.0) return vec3(0.0, 0.0, 1.0);       // Blue
  if (c < 5.0) return vec3(1.0, 0.0, 1.0);       // Magenta
  if (c < 6.0) return vec3(0.0, 1.0, 1.0);       // Cyan
  return vec3(1.0, 1.0, 1.0);                     // White
}

// Block graphic character (teletext uses 2x3 sixel blocks per character)
float blockGraphic(vec2 uv, float seed) {
  // 2 columns, 3 rows within one character cell
  vec2 blockPos = vec2(floor(uv.x * 2.0), floor(uv.y * 3.0));
  float blockId = blockPos.x + blockPos.y * 2.0;
  // Use seed to determine which blocks are filled
  float pattern = hash(seed + blockId * 7.7);
  return step(0.4, pattern);
}

// "5" and "0" digit patterns for DANFEST 50
float digit5(vec2 p) {
  int r = int(p.y * 7.0);
  int c = int(p.x * 5.0);
  if (c < 0 || c > 4 || r < 0 || r > 6) return 0.0;
  if (r == 6) return (c >= 0 && c <= 4) ? 1.0 : 0.0;
  if (r == 5) return (c == 0) ? 1.0 : 0.0;
  if (r == 4) return (c == 0) ? 1.0 : 0.0;
  if (r == 3) return (c >= 0 && c <= 4) ? 1.0 : 0.0;
  if (r == 2) return (c == 4) ? 1.0 : 0.0;
  if (r == 1) return (c == 4) ? 1.0 : 0.0;
  if (r == 0) return (c >= 0 && c <= 4) ? 1.0 : 0.0;
  return 0.0;
}

float digit0(vec2 p) {
  int r = int(p.y * 7.0);
  int c = int(p.x * 5.0);
  if (c < 0 || c > 4 || r < 0 || r > 6) return 0.0;
  if (r == 6 || r == 0) return (c >= 1 && c <= 3) ? 1.0 : 0.0;
  return (c == 0 || c == 4) ? 1.0 : 0.0;
}

void main() {
  vec2 uv = vUv;
  float t = uTime * uSpeed;
  
  vec3 col = vec3(0.0);
  
  // Teletext grid: 40 columns x 25 rows (standard teletext resolution)
  float cols = 40.0;
  float rows = 25.0;
  vec2 cellSize = vec2(1.0 / cols, 1.0 / rows);
  vec2 cellPos = floor(uv / cellSize);
  vec2 cellUv = fract(uv / cellSize);
  
  float cellId = hash2(cellPos + floor(t * 0.5) * 0.01);
  
  // Header bar (top 2 rows) - flashing DANFEST title
  if (cellPos.y > rows - 3.0) {
    float headerFlash = step(0.3, fract(t * 2.0 + uBassEnergy));
    vec3 headerBg = vec3(0.0, 0.0, 0.8); // Blue background
    vec3 headerFg = mix(vec3(1.0, 1.0, 0.0), vec3(1.0, 1.0, 1.0), headerFlash);
    
    // Blocky text pattern
    float textPattern = blockGraphic(cellUv, cellPos.x * 3.3 + 100.0);
    float isText = step(5.0, cellPos.x) * step(cellPos.x, 35.0);
    col = mix(headerBg, headerFg, textPattern * isText);
    
    // Bass makes header flash
    col += vec3(0.3, 0.3, 0.0) * uBassEnergy * headerFlash;
  }
  // "50" display in center
  else if (cellPos.y > 8.0 && cellPos.y < 18.0 && cellPos.x > 12.0 && cellPos.x < 28.0) {
    // Large "50" in teletext block graphics
    vec2 digitArea = vec2((cellPos.x - 12.0) / 16.0, (cellPos.y - 8.0) / 10.0);
    
    float d = 0.0;
    if (digitArea.x < 0.45) {
      d = digit5(vec2(digitArea.x / 0.45, digitArea.y));
    } else if (digitArea.x > 0.55) {
      d = digit0(vec2((digitArea.x - 0.55) / 0.45, digitArea.y));
    }
    
    if (d > 0.5) {
      // Colour cycling on beat
      float colorPhase = t * 2.0 + cellPos.x * 0.1 + cellPos.y * 0.1;
      colorPhase += uBassEnergy * 3.0;
      vec3 digitCol = teletextColor(colorPhase);
      
      // Block fill within digit
      float block = blockGraphic(cellUv, cellPos.x + cellPos.y * 40.0 + floor(t * 3.0));
      col = digitCol * (0.7 + block * 0.3);
      
      // Pulse on transient
      col += vec3(0.5) * uTransient;
    } else {
      // Background blocks - subtle pattern
      float bgBlock = blockGraphic(cellUv, cellPos.x * 7.0 + cellPos.y * 3.0 + floor(t * 0.3));
      float bgActive = step(0.85, hash2(cellPos + floor(t * 0.2)));
      col = teletextColor(hash2(cellPos) * 7.0 + t * 0.5) * bgBlock * bgActive * 0.15;
    }
  }
  // Rest of screen: animated teletext block graphics
  else {
    float pageReveal = fract(t * 0.15);
    float rowReveal = step(cellPos.y / rows, pageReveal + 0.3);
    
    // Different regions get different patterns
    float region = floor(cellPos.y / 5.0);
    float regionSeed = hash(region * 13.0 + floor(t * 0.3));
    
    // Block graphic patterns that change with music
    float blockSeed = cellPos.x + cellPos.y * cols + floor(t * (1.0 + uMidEnergy * 2.0)) * 0.1;
    float block = blockGraphic(cellUv, blockSeed);
    
    // Colour per row section (teletext style - each row has a colour)
    float rowColor = hash(cellPos.y * 3.0 + floor(t * 0.5));
    vec3 blockColor = teletextColor(rowColor * 7.0 + region);
    
    // Some cells are "double height" text
    float doubleHeight = step(0.7, hash(cellPos.y * 11.0 + floor(t * 0.2)));
    
    // Activity level based on audio
    float activity = 0.3 + uBassEnergy * 0.3 + uMidEnergy * 0.2 + uHighEnergy * 0.2;
    float cellActive = step(1.0 - activity, hash2(cellPos * 3.0 + floor(t * 0.5)));
    
    col = blockColor * block * cellActive * rowReveal;
    
    // Flash certain cells on transient
    float flashCell = step(0.9, hash2(cellPos + 0.5));
    col += teletextColor(t + cellPos.x) * flashCell * uTransient * 0.8;
  }
  
  // Footer/fascia bar (bottom row)
  if (cellPos.y < 1.0) {
    float pageNum = step(0.5, fract(t * 0.1));
    col = vec3(0.0, 0.0, 0.0);
    // Page number area
    if (cellPos.x < 5.0) {
      float numBlock = blockGraphic(cellUv, cellPos.x * 5.0 + 500.0);
      col = vec3(1.0, 1.0, 1.0) * numBlock;
    }
    // Coloured status blocks
    else if (cellPos.x > 35.0) {
      col = teletextColor(cellPos.x - 35.0) * 0.8;
    }
  }
  
  // Scanline effect (CRT)
  float scanline = 0.95 + 0.05 * sin(uv.y * rows * 3.14159 * 2.0);
  col *= scanline;
  
  // Occasional "signal interference" on high bass
  float interference = sin(uv.y * 100.0 + t * 50.0) * uBassEnergy * 0.1;
  col += vec3(interference) * step(0.8, uBassEnergy);
  
  // Slight colour bleed (like old CRT)
  col.r += col.g * 0.05;
  col.b += col.g * 0.03;
  
  col *= uIntensity;
  
  gl_FragColor = vec4(col, 1.0);
}
`;

export class CeefaxEffect implements VisualEffect {
  name = 'ceefax';
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
        uColor1: { value: new THREE.Color('#ffff00') },
        uColor2: { value: new THREE.Color('#00ff00') },
        uColor3: { value: new THREE.Color('#00ffff') },
        uColor4: { value: new THREE.Color('#ff00ff') },
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
