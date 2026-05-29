import * as THREE from 'three';
import type { ControlSignals } from '../../store';
import type { VisualEffect, EffectParams } from './types';

/**
 * Graphic Equaliser - classic Winamp-style vertical bars
 * rendered as a fullscreen shader using FFT data passed via uniforms
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
uniform float uSpeed;
uniform float uIntensity;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec3 uColor4;
uniform float uAspect;
uniform float uBands[32];

void main() {
  vec2 uv = vUv;
  
  float t = uTime * uSpeed;
  
  // Which band are we in?
  float bandF = uv.x * 32.0;
  int band = int(floor(bandF));
  float bandFrac = fract(bandF);
  
  // Get the height for this band (with smoothing between neighbors)
  float h = 0.0;
  if (band >= 0 && band < 32) h = uBands[band];
  
  // Smooth edges of each bar
  float barWidth = 0.7;
  float barMask = smoothstep(0.0, 0.15, bandFrac) * smoothstep(1.0, 0.85, bandFrac);
  
  // Bar height from bottom
  float barHeight = h * 0.85;
  float inBar = step(uv.y, barHeight) * barMask;
  
  // Color gradient based on height - green at bottom, yellow middle, red top
  float heightRatio = uv.y / max(barHeight, 0.001);
  vec3 barColor;
  if (heightRatio < 0.5) {
    barColor = mix(uColor1, uColor2, heightRatio * 2.0);
  } else {
    barColor = mix(uColor2, uColor3, (heightRatio - 0.5) * 2.0);
  }
  
  // Peak indicator - small bright dot at the top of each bar
  float peakY = barHeight;
  float peakDist = abs(uv.y - peakY);
  float peak = smoothstep(0.015, 0.005, peakDist) * barMask * step(0.05, barHeight);
  
  // Glow beneath bars
  float glow = exp(-(uv.y - barHeight) * 8.0) * step(barHeight, uv.y) * barMask * barHeight;
  
  // Reflection below (mirror)
  float reflectY = -uv.y * 0.3;
  float inReflect = step(reflectY, barHeight * 0.3) * step(0.0, reflectY) * barMask;
  
  vec3 col = vec3(0.0);
  col += barColor * inBar * (0.8 + uBassEnergy * 0.4);
  col += uColor4 * peak * 2.0;
  col += barColor * glow * 0.4;
  
  // Mirror reflection at bottom
  float mirrorH = (1.0 - uv.y) * barHeight * 0.2;
  float mirrorMask = step(1.0 - uv.y, 0.15) * barMask;
  col += barColor * mirrorMask * 0.15 * h;
  
  // Transient flash
  col += uColor4 * uTransient * 0.3 * inBar;
  
  // Background grid lines
  float gridH = smoothstep(0.002, 0.0, abs(fract(uv.y * 10.0) - 0.5) - 0.48);
  float gridV = smoothstep(0.002, 0.0, abs(bandFrac - 0.5) - 0.48);
  col += vec3(0.02) * (gridH + gridV);
  
  col *= uIntensity;
  
  gl_FragColor = vec4(col, 1.0);
}
`;

export class GraphicEqualiserEffect implements VisualEffect {
  name = 'equaliser';
  private mesh!: THREE.Mesh;
  private material!: THREE.ShaderMaterial;
  private bandValues = new Float32Array(32);
  private smoothBands = new Float32Array(32);
  private fftData: Float32Array | null = null;

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
        uColor1: { value: new THREE.Color('#00ff66') },
        uColor2: { value: new THREE.Color('#ffcc00') },
        uColor3: { value: new THREE.Color('#ff3300') },
        uColor4: { value: new THREE.Color('#ffffff') },
        uAspect: { value: 1.0 },
        uBands: { value: new Float32Array(32) },
      },
      vertexShader,
      fragmentShader,
    });

    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  setFFTData(data: Float32Array): void {
    this.fftData = data;
  }

  update(signals: ControlSignals, params: EffectParams, dt: number, time: number): void {
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

    // Process FFT data into 32 bands
    if (this.fftData && this.fftData.length > 0) {
      const binCount = this.fftData.length;
      // Logarithmic frequency distribution
      for (let i = 0; i < 32; i++) {
        const startBin = Math.floor(Math.pow(i / 32, 2) * binCount);
        const endBin = Math.floor(Math.pow((i + 1) / 32, 2) * binCount);
        let sum = 0;
        const count = Math.max(1, endBin - startBin);
        for (let j = startBin; j < Math.min(endBin, binCount); j++) {
          sum += this.fftData[j];
        }
        this.bandValues[i] = sum / count;
      }
    } else {
      // Fake bands from control signals when no FFT data
      for (let i = 0; i < 32; i++) {
        const f = i / 32;
        if (f < 0.25) this.bandValues[i] = signals.bassEnergy * (0.7 + Math.sin(time * 2 + i) * 0.3);
        else if (f < 0.6) this.bandValues[i] = signals.midEnergy * (0.6 + Math.sin(time * 3 + i * 0.5) * 0.3);
        else this.bandValues[i] = signals.highEnergy * (0.5 + Math.sin(time * 4 + i * 0.3) * 0.3);
      }
    }

    // Smooth bands with fast attack, slow decay
    const attack = 1.0 - Math.exp(-dt * 20);
    const decay = 1.0 - Math.exp(-dt * 5);
    for (let i = 0; i < 32; i++) {
      const target = this.bandValues[i];
      if (target > this.smoothBands[i]) {
        this.smoothBands[i] += (target - this.smoothBands[i]) * attack;
      } else {
        this.smoothBands[i] += (target - this.smoothBands[i]) * decay;
      }
    }

    u.uBands.value = this.smoothBands;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.mesh.parent?.remove(this.mesh);
  }
}
