import * as THREE from 'three';
import type { ControlSignals } from '../../store';
import type { VisualEffect, EffectParams } from './types';

/**
 * Graphic Equaliser - Full spectrum analyser with 64 bands
 * Peak hold indicators, proper logarithmic frequency mapping,
 * Winamp-style segmented bars with glow effects
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
uniform float uBands[64];
uniform float uPeaks[64];

void main() {
  vec2 uv = vUv;
  
  // Slight padding at edges
  float margin = 0.02;
  vec2 area = vec2(1.0 - margin * 2.0, 1.0 - margin * 2.0);
  vec2 local = (uv - margin) / area;
  
  if (local.x < 0.0 || local.x > 1.0 || local.y < 0.0 || local.y > 1.0) {
    gl_FragColor = vec4(vec3(0.01), 1.0);
    return;
  }
  
  // 64 bands
  float bandF = local.x * 64.0;
  int band = int(floor(bandF));
  float bandFrac = fract(bandF);
  
  // Get band height
  float h = 0.0;
  float peakH = 0.0;
  if (band >= 0 && band < 64) {
    h = uBands[band];
    peakH = uPeaks[band];
  }
  
  // Segmented bar appearance (like real hardware EQ)
  float numSegments = 24.0;
  float segY = local.y * numSegments;
  float segFrac = fract(segY);
  float segGap = smoothstep(0.0, 0.08, segFrac) * smoothstep(1.0, 0.92, segFrac);
  
  // Bar width with gap between bars
  float barWidth = smoothstep(0.0, 0.1, bandFrac) * smoothstep(1.0, 0.9, bandFrac);
  
  // Is this pixel within the active bar height?
  float barHeight = h * 0.95;
  float inBar = step(local.y, barHeight) * barWidth * segGap;
  
  // Colour: frequency-based gradient
  // Low = deep blue/purple, mid = green/cyan, high = orange/red/white
  float freqRatio = local.x;
  vec3 barColor;
  if (freqRatio < 0.2) {
    barColor = mix(vec3(0.2, 0.0, 0.8), uColor1, freqRatio * 5.0);
  } else if (freqRatio < 0.5) {
    barColor = mix(uColor1, uColor2, (freqRatio - 0.2) / 0.3);
  } else if (freqRatio < 0.8) {
    barColor = mix(uColor2, uColor3, (freqRatio - 0.5) / 0.3);
  } else {
    barColor = mix(uColor3, uColor4, (freqRatio - 0.8) / 0.2);
  }
  
  // Brightness increases with height (hot at top)
  float heightBright = 0.6 + local.y * 0.6;
  barColor *= heightBright;
  
  // Peak indicator - floating dot that slowly falls
  float peakPos = peakH * 0.95;
  float peakDist = abs(local.y - peakPos);
  float peak = smoothstep(0.012, 0.004, peakDist) * barWidth * step(0.03, peakH);
  vec3 peakColor = vec3(1.0, 1.0, 1.0);
  
  // Build final colour
  vec3 col = vec3(0.0);
  
  // Active bar segments
  col += barColor * inBar;
  
  // Glow above bar (soft bloom look)
  float aboveBar = smoothstep(barHeight, barHeight + 0.08, local.y) * smoothstep(barHeight + 0.15, barHeight + 0.01, local.y);
  col += barColor * aboveBar * 0.3 * barWidth * h;
  
  // Peak dot
  col += peakColor * peak;
  
  // Subtle reflection below (bottom 15%)
  if (local.y < 0.15) {
    float mirrorY = 0.15 - local.y;
    float mirrorH = barHeight;
    float mirrorIn = step(mirrorY, mirrorH * 0.3) * barWidth * segGap;
    col += barColor * mirrorIn * 0.08 * (1.0 - local.y / 0.15);
  }
  
  // Background: very subtle grid
  float gridH = smoothstep(0.001, 0.0, abs(segFrac - 0.5) - 0.49) * 0.03;
  float gridV = smoothstep(0.001, 0.0, abs(bandFrac - 0.5) - 0.49) * 0.02;
  col += vec3(gridH + gridV) * 0.5;
  
  // Bass pulse background throb
  col += uColor1 * uBassEnergy * 0.02;
  
  // Transient flash
  col += vec3(0.15) * uTransient * 0.4 * inBar;
  
  col *= uIntensity;
  
  gl_FragColor = vec4(col, 1.0);
}
`;

export class GraphicEqualiserEffect implements VisualEffect {
  name = 'equaliser';
  private mesh!: THREE.Mesh;
  private material!: THREE.ShaderMaterial;
  private bandValues = new Float32Array(64);
  private smoothBands = new Float32Array(64);
  private peakValues = new Float32Array(64);
  private peakDecay = new Float32Array(64);
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
        uColor2: { value: new THREE.Color('#00ccff') },
        uColor3: { value: new THREE.Color('#ffcc00') },
        uColor4: { value: new THREE.Color('#ff3300') },
        uAspect: { value: 1.0 },
        uBands: { value: new Float32Array(64) },
        uPeaks: { value: new Float32Array(64) },
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

    // Process FFT data into 64 logarithmically-distributed bands
    // Covers full audible range: ~20Hz to ~20kHz
    if (this.fftData && this.fftData.length > 0) {
      const binCount = this.fftData.length;
      const numBands = 64;
      // Logarithmic mapping: low bands get fewer bins (bass is concentrated)
      // High bands span more bins (treble is spread across many)
      const minFreq = 20; // Hz
      const maxFreq = 20000; // Hz
      const logMin = Math.log10(minFreq);
      const logMax = Math.log10(maxFreq);
      
      for (let i = 0; i < numBands; i++) {
        const freqLow = Math.pow(10, logMin + (logMax - logMin) * (i / numBands));
        const freqHigh = Math.pow(10, logMin + (logMax - logMin) * ((i + 1) / numBands));
        
        // Convert frequency to FFT bin (assuming 44100/48000 sample rate, ~22050 Nyquist)
        const nyquist = 22050;
        const startBin = Math.floor((freqLow / nyquist) * binCount);
        const endBin = Math.ceil((freqHigh / nyquist) * binCount);
        
        let sum = 0;
        let count = 0;
        for (let j = Math.max(0, startBin); j < Math.min(endBin, binCount); j++) {
          // fftData is in dB (typically -100 to 0), normalise to 0-1
          const dB = this.fftData[j];
          const normalized = Math.max(0, (dB + 100) / 100);
          sum += normalized;
          count++;
        }
        // Average and apply slight boost to higher bands (perceptual weighting)
        const avg = count > 0 ? sum / count : 0;
        const freqBoost = 1.0 + (i / numBands) * 0.5; // +50% boost at highest band
        this.bandValues[i] = Math.min(1.0, avg * freqBoost);
      }
    } else {
      // Synthesise bands from control signals when no FFT data available
      for (let i = 0; i < 64; i++) {
        const f = i / 64;
        if (f < 0.2) {
          this.bandValues[i] = signals.bassEnergy * (0.7 + Math.sin(time * 2 + i * 0.5) * 0.3);
        } else if (f < 0.55) {
          this.bandValues[i] = signals.midEnergy * (0.6 + Math.sin(time * 3 + i * 0.3) * 0.3);
        } else {
          this.bandValues[i] = signals.highEnergy * (0.5 + Math.sin(time * 4 + i * 0.2) * 0.3);
        }
      }
    }

    // Smooth bands: fast attack, moderate decay
    const attack = 1.0 - Math.exp(-dt * 25);
    const decay = 1.0 - Math.exp(-dt * 8);
    
    for (let i = 0; i < 64; i++) {
      const target = this.bandValues[i];
      if (target > this.smoothBands[i]) {
        this.smoothBands[i] += (target - this.smoothBands[i]) * attack;
      } else {
        this.smoothBands[i] += (target - this.smoothBands[i]) * decay;
      }
      
      // Peak hold: rises instantly, holds briefly, then falls slowly
      if (this.smoothBands[i] > this.peakValues[i]) {
        this.peakValues[i] = this.smoothBands[i];
        this.peakDecay[i] = 0; // reset hold timer
      } else {
        this.peakDecay[i] += dt;
        // Hold for 0.5s, then fall
        if (this.peakDecay[i] > 0.5) {
          this.peakValues[i] -= dt * 0.8; // fall speed
          this.peakValues[i] = Math.max(this.peakValues[i], 0);
        }
      }
    }

    u.uBands.value = this.smoothBands;
    u.uPeaks.value = this.peakValues;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.mesh.parent?.remove(this.mesh);
  }
}
