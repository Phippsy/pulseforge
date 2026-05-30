import * as THREE from 'three';
import type { ControlSignals } from '../../store';
import type { VisualEffect, EffectParams } from './types';

/**
 * Matrix Rain - Falling character columns with audio reactivity
 * Characters fall at different speeds, brighten on beats
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

float hash(float n) { return fract(sin(n) * 43758.5453); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

// Pseudo-character pattern (blocky glyphs)
float charPattern(vec2 uv, float seed) {
  vec2 grid = floor(uv * vec2(3.0, 5.0));
  float r = hash2(grid + seed);
  // Create glyph-like patterns
  float pattern = step(0.35, r);
  // Smooth edges
  vec2 f = fract(uv * vec2(3.0, 5.0));
  pattern *= smoothstep(0.0, 0.15, f.x) * smoothstep(1.0, 0.85, f.x);
  pattern *= smoothstep(0.0, 0.15, f.y) * smoothstep(1.0, 0.85, f.y);
  return pattern;
}

void main() {
  vec2 uv = vUv;
  float t = uTime * uSpeed;
  
  // Grid of columns
  float columns = 50.0;
  float rows = columns * 2.5; // taller chars
  
  vec2 gridUv = vec2(uv.x * columns, uv.y * rows);
  float col = floor(gridUv.x);
  float row = floor(gridUv.y);
  vec2 cellUv = fract(gridUv);
  
  // Each column has a random speed and phase
  float colSeed = hash(col * 7.3 + 0.5);
  float speed = 3.0 + colSeed * 5.0;
  
  float phase = hash(col * 13.7) * 200.0;
  
  // Scrolling - row offset over time (rain falls DOWN so we subtract)
  float scroll = t * speed + phase;
  
  // Current logical row (for character selection, wraps)
  float logicalRow = row - floor(scroll);
  float charSeed = hash(col * 31.0 + logicalRow * 17.0);
  
  // Character changes periodically for flicker effect
  float charChange = floor(t * (2.0 + hash(col * 5.0) * 3.0));
  float finalSeed = hash(charSeed + charChange * 0.1);
  
  // Draw character glyph
  float ch = charPattern(cellUv, finalSeed * 100.0);
  
  // Rain drop brightness - multiple drops per column
  float trailLen = 22.0;
  float brightness = 0.0;
  float isHead = 0.0;
  
  // 3 drops per column at different offsets
  for (int d = 0; d < 3; d++) {
    float dropPhase = hash(col * 3.7 + float(d) * 11.3) * rows;
    float dropSpeed = speed * (0.8 + hash(col * 2.1 + float(d) * 7.7) * 0.4);
    // Head position falls from top (rows-1) to bottom (0)
    float headPos = mod(t * dropSpeed + dropPhase, rows);
    // Distance: how far below the head is this row?
    // row is inverted so head descends visually
    float dist = mod(row - headPos, rows);
    // dist=0 means at the head, dist>0 means head has passed (trail above)
    float b = smoothstep(trailLen, 0.0, dist);
    float h = smoothstep(1.5, 0.0, dist);
    brightness = max(brightness, b);
    isHead = max(isHead, h);
  }
  
  // Ensure always visible - minimum brightness for active chars
  brightness = max(brightness, 0.08 * ch);
  
  // Colour: iconic green Matrix rain with beat-reactive glow
  vec3 baseGreen = vec3(0.0, 1.0, 0.3);
  // Bass shifts colour toward cyan/white pulse
  vec3 bassGlow = vec3(0.3, 0.9, 1.0); // cyan tint on beats
  vec3 pulseGreen = mix(baseGreen, bassGlow, uBassEnergy * 0.6);
  float bassBright = 1.0 + uBassEnergy * 0.5; // pulsate brightness
  vec3 trailColor = mix(pulseGreen, uColor1, 0.2) * 1.15 * bassBright;
  vec3 headColor = mix(vec3(0.9, 1.0, 0.95), vec3(1.0, 1.0, 1.0), uBassEnergy * 0.5);
  vec3 charColor = mix(trailColor, headColor, isHead);
  
  // Random highlight flicker
  float flicker = step(0.93, hash2(vec2(col, logicalRow + t * 0.3)));
  charColor += vec3(0.5, 1.0, 0.5) * flicker;
  
  // Mid energy: subtle warm tint on trail
  charColor += vec3(0.2, 0.4, 0.0) * uMidEnergy * brightness * 0.3;
  
  // Transient flash: heads flare bright white
  charColor += vec3(0.9, 1.0, 0.9) * uTransient * isHead * 1.2;
  
  vec3 finalCol = charColor * ch * brightness * 1.05;
  
  // Background column glow (always slightly visible)
  float bgGlow = brightness * 0.05;
  finalCol += baseGreen * bgGlow * 0.4;
  
  // High energy adds sparkle
  finalCol *= 1.0 + uHighEnergy * flicker * 0.8;
  
  finalCol *= uIntensity;
  
  gl_FragColor = vec4(finalCol, 1.0);
}
`;

export class MatrixRainEffect implements VisualEffect {
  name = 'matrixRain';
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
        uColor1: { value: new THREE.Color('#00FF41') },
        uColor2: { value: new THREE.Color('#AAFFAA') },
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
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.mesh.parent?.remove(this.mesh);
  }
}
