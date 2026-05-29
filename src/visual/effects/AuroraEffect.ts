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
uniform float uSpeed;
uniform float uIntensity;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec3 uColor4;
uniform float uAspect;
uniform float uCurtainCount;
uniform float uWaveHeight;

#define PI 3.14159265

float hash(float n) { return fract(sin(n) * 43758.5453); }

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n = i.x + i.y * 57.0;
  return mix(
    mix(hash(n), hash(n + 1.0), f.x),
    mix(hash(n + 57.0), hash(n + 58.0), f.x), f.y);
}

float fbm(vec2 p) {
  float f = 0.0;
  f += 0.5 * noise(p); p *= 2.01;
  f += 0.25 * noise(p); p *= 2.03;
  f += 0.125 * noise(p); p *= 2.01;
  f += 0.0625 * noise(p);
  return f;
}

void main() {
  vec2 uv = vUv;
  uv.x *= uAspect;
  
  float t = uTime * uSpeed * 0.3;
  
  // Aurora lives in upper portion of screen
  float y = uv.y;
  
  // Multiple curtain layers
  vec3 col = vec3(0.0);
  float totalAlpha = 0.0;
  
  for (float i = 0.0; i < 5.0; i++) {
    float layer = i / 5.0;
    float offset = layer * 1.7 + i * 0.3;
    
    // Curtain wave motion
    float wave = sin(uv.x * (3.0 + i) + t * (0.5 + layer * 0.3) + offset) * 0.15;
    wave += sin(uv.x * (5.0 + i * 2.0) - t * (0.3 + layer * 0.2)) * 0.08;
    wave += noise(vec2(uv.x * 2.0 + t * 0.2, i * 10.0)) * 0.1;
    
    // Bass makes curtains wave more
    wave += sin(uv.x * 8.0 + t * 3.0) * uBassEnergy * 0.1;
    
    // Vertical position of this curtain band
    float curtainY = 0.5 + wave + (i - 2.5) * 0.1;
    curtainY += uWaveHeight * sin(t * 0.5 + i);
    
    // Band shape - gaussian falloff from center
    float dist = abs(y - curtainY);
    float band = exp(-dist * dist * (15.0 + uMidEnergy * 10.0));
    
    // Flowing noise texture within the band
    vec2 noiseCoord = vec2(uv.x * 3.0 + t * 0.5, y * 2.0 + t * 0.3 + i * 5.0);
    float n = fbm(noiseCoord);
    float n2 = fbm(noiseCoord * 2.0 + vec2(t * 0.2, 0.0));
    
    band *= (0.5 + n * 0.7);
    band *= (0.7 + n2 * 0.5);
    
    // Color varies along x and between layers
    float colorPhase = fract(uv.x * 0.3 + t * 0.05 + layer * 0.25);
    vec3 curtainCol;
    if (colorPhase < 0.33) {
      curtainCol = mix(uColor1, uColor2, colorPhase * 3.0);
    } else if (colorPhase < 0.66) {
      curtainCol = mix(uColor2, uColor3, (colorPhase - 0.33) * 3.0);
    } else {
      curtainCol = mix(uColor3, uColor4, (colorPhase - 0.66) * 3.0);
    }
    
    // Add shimmer on transients
    curtainCol += vec3(0.3, 0.5, 0.2) * uTransient * n;
    
    col += curtainCol * band * (0.4 + layer * 0.15);
    totalAlpha += band;
  }
  
  // Stars in background
  vec2 starUV = uv * vec2(uAspect, 1.0) * 30.0;
  float star = step(0.98, hash(floor(starUV.x) * 100.0 + floor(starUV.y)));
  star *= (0.3 + 0.7 * hash(floor(starUV.x) * 7.0 + floor(starUV.y) * 13.0));
  float twinkle = sin(t * 3.0 + hash(floor(starUV.x) + floor(starUV.y) * 100.0) * 100.0) * 0.5 + 0.5;
  col += vec3(star * twinkle * 0.3 * (1.0 - totalAlpha * 0.5));
  
  // Intensity and energy
  col *= uIntensity * (0.8 + uBassEnergy * 0.3 + uHighEnergy * 0.2);
  
  gl_FragColor = vec4(col, 1.0);
}
`;

export class AuroraEffect implements VisualEffect {
  name = 'aurora';
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
        uSpeed: { value: 1.0 },
        uIntensity: { value: 1.0 },
        uColor1: { value: new THREE.Color('#00ff88') },
        uColor2: { value: new THREE.Color('#0088ff') },
        uColor3: { value: new THREE.Color('#ff00ff') },
        uColor4: { value: new THREE.Color('#00ffcc') },
        uAspect: { value: 1.0 },
        uCurtainCount: { value: 5.0 },
        uWaveHeight: { value: 0.15 },
      },
      vertexShader,
      fragmentShader,
    });

    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    scene.add(this.mesh);
  }

  update(signals: ControlSignals, params: EffectParams, _dt: number, time: number): void {
    const u = this.material.uniforms;
    u.uTime.value = time;
    u.uBassEnergy.value = signals.bassEnergy * params.bassReactivity;
    u.uMidEnergy.value = signals.midEnergy * params.midReactivity;
    u.uHighEnergy.value = signals.highEnergy * params.highReactivity;
    u.uTransient.value = signals.transientPulse * params.onsetReactivity;
    u.uSpeed.value = params.speed;
    u.uIntensity.value = params.intensity;
    u.uColor1.value.set(params.colors[0]);
    u.uColor2.value.set(params.colors[1]);
    u.uColor3.value.set(params.colors[2]);
    u.uColor4.value.set(params.colors[3]);
    u.uAspect.value = window.innerWidth / window.innerHeight;
    u.uCurtainCount.value = params.effectParams.curtainCount ?? 5;
    u.uWaveHeight.value = (params.effectParams.waveHeight ?? 0.15) + signals.bassPulse * params.bassReactivity * 0.1;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.mesh.parent?.remove(this.mesh);
  }
}
