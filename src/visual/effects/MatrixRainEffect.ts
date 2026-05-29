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
  float columns = 40.0;
  float charHeight = columns * 2.0; // aspect ratio of characters
  
  vec2 gridUv = vec2(uv.x * columns, uv.y * charHeight);
  float col = floor(gridUv.x);
  float row = floor(gridUv.y);
  vec2 cellUv = fract(gridUv);
  
  // Each column has a random speed and phase
  float colSeed = hash(col * 7.3 + 0.5);
  float speed = 2.0 + colSeed * 4.0;
  speed *= 1.0 + uBassEnergy * 0.5; // bass speeds up rain
  
  float phase = hash(col * 13.7) * 100.0;
  
  // Scrolling position for this column
  float scroll = t * speed + phase;
  float currentRow = row + floor(scroll);
  float charSeed = hash(col * 31.0 + currentRow * 17.0);
  
  // Character changes periodically
  float charChange = floor(t * (1.0 + hash(col * 5.0) * 2.0));
  float finalSeed = hash(charSeed + charChange * 0.01);
  
  // Draw character
  float ch = charPattern(cellUv, finalSeed * 100.0);
  
  // Brightness: trail fading from top (head) to bottom (tail)
  float trailLength = 15.0 + uMidEnergy * 10.0;
  float headPos = fract(scroll) + trailLength;
  float distFromHead = mod(headPos - fract(gridUv.y / charHeight * trailLength), trailLength + 5.0);
  
  // Fade along trail
  float brightness = smoothstep(trailLength, 0.0, distFromHead);
  brightness = pow(brightness, 1.5);
  
  // Head is white/bright, tail is coloured
  float isHead = smoothstep(1.5, 0.0, distFromHead);
  
  // Colour
  vec3 trailColor = uColor1;
  vec3 headColor = mix(uColor2, vec3(1.0), 0.5);
  vec3 charColor = mix(trailColor, headColor, isHead);
  
  // Random highlight flicker
  float flicker = step(0.97, hash2(vec2(col, currentRow + t * 0.5)));
  charColor += vec3(0.3) * flicker;
  
  // Bass pulse brightens everything
  charColor += uColor1 * uBassEnergy * 0.2;
  
  // Transient flash
  charColor += vec3(0.5) * uTransient * isHead;
  
  vec3 finalCol = charColor * ch * brightness;
  
  // Subtle background glow in columns
  float bgGlow = brightness * 0.02 * (1.0 - ch);
  finalCol += uColor1 * bgGlow;
  
  // High energy adds extra brightness variance
  finalCol *= 1.0 + uHighEnergy * flicker * 0.5;
  
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
