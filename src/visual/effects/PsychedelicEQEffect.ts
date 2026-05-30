import * as THREE from 'three';
import type { ControlSignals } from '../../store';
import type { VisualEffect, EffectParams } from './types';

/**
 * PsychedelicEQ - A 3D psychedelic graphic equaliser. 
 * Bars are arranged in a circular pattern, explode outward on bass,
 * constantly rotate and morph with trippy colors flowing through them.
 * Each bar is a 3D box that scales, rotates and pulses independently.
 */

const BAR_COUNT = 64;

export class PsychedelicEQEffect implements VisualEffect {
  name = 'psychedelicEQ';
  private bars: THREE.Mesh[] = [];
  private barMaterials: THREE.ShaderMaterial[] = [];
  private group!: THREE.Group;
  private fftData: number[] = new Array(BAR_COUNT).fill(0);
  private smoothedFft: number[] = new Array(BAR_COUNT).fill(0);
  private explosionForce = 0;
  private ringRotation = 0;
  private bassAccumulator = 0;

  // Custom vertex/fragment for each bar - psychedelic color cycling
  private static barVertexShader = `
    varying vec3 vPosition;
    varying vec2 vUv;
    varying float vBarHeight;
    uniform float uBarHeight;
    
    void main() {
      vPosition = position;
      vUv = uv;
      vBarHeight = uBarHeight;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  private static barFragmentShader = `
    precision highp float;
    varying vec3 vPosition;
    varying vec2 vUv;
    varying float vBarHeight;
    
    uniform float uTime;
    uniform float uBarIndex;
    uniform float uBarHeight;
    uniform float uBassEnergy;
    uniform float uIntensity;
    uniform vec3 uColor1;
    uniform vec3 uColor2;
    uniform vec3 uColor3;
    uniform vec3 uColor4;
    
    void main() {
      // Psychedelic color: shifts based on height, bar index, and time
      float hueShift = uTime * 0.5 + uBarIndex * 0.1 + vUv.y * 2.0;
      
      // Four-color gradient cycling through bars
      float t = fract(hueShift * 0.3);
      vec3 col;
      if (t < 0.25) {
        col = mix(uColor1, uColor2, t * 4.0);
      } else if (t < 0.5) {
        col = mix(uColor2, uColor3, (t - 0.25) * 4.0);
      } else if (t < 0.75) {
        col = mix(uColor3, uColor4, (t - 0.5) * 4.0);
      } else {
        col = mix(uColor4, uColor1, (t - 0.75) * 4.0);
      }
      
      // Vertical gradient - brighter at top
      col *= 0.6 + vUv.y * 0.8;
      
      // Pulse with height
      col *= 0.5 + uBarHeight * 1.5;
      
      // Bass flash
      col += vec3(1.0) * uBassEnergy * 0.4;
      
      // Edge glow
      float edge = 1.0 - smoothstep(0.0, 0.15, min(vUv.x, 1.0 - vUv.x));
      col += uColor1 * edge * 0.5 * (0.5 + uBassEnergy);
      
      // Intensity
      col *= uIntensity * 1.5;
      col = max(col, vec3(0.05));
      
      gl_FragColor = vec4(col, 1.0);
    }
  `;

  init(scene: THREE.Scene, _camera: THREE.Camera): void {
    this.group = new THREE.Group();
    scene.add(this.group);

    // Create bars arranged in a circle
    for (let i = 0; i < BAR_COUNT; i++) {
      const geometry = new THREE.BoxGeometry(0.12, 1.0, 0.12);
      // Shift geometry origin to bottom
      geometry.translate(0, 0.5, 0);

      const material = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uBarIndex: { value: i / BAR_COUNT },
          uBarHeight: { value: 0 },
          uBassEnergy: { value: 0 },
          uIntensity: { value: 1.0 },
          uColor1: { value: new THREE.Color('#FF00FF') },
          uColor2: { value: new THREE.Color('#00FFFF') },
          uColor3: { value: new THREE.Color('#FFFF00') },
          uColor4: { value: new THREE.Color('#FF4400') },
        },
        vertexShader: PsychedelicEQEffect.barVertexShader,
        fragmentShader: PsychedelicEQEffect.barFragmentShader,
        side: THREE.DoubleSide,
      });

      const mesh = new THREE.Mesh(geometry, material);

      // Position in a circle
      const angle = (i / BAR_COUNT) * Math.PI * 2;
      const radius = 2.5;
      mesh.position.x = Math.cos(angle) * radius;
      mesh.position.z = Math.sin(angle) * radius;
      // Rotate to face outward
      mesh.rotation.y = -angle + Math.PI / 2;

      this.group.add(mesh);
      this.bars.push(mesh);
      this.barMaterials.push(material);
    }
  }

  update(signals: ControlSignals, params: EffectParams, dt: number, time: number): void {
    const bassReact = params.bassReactivity;
    
    // Simulate FFT from signals (when real FFT available it would be passed)
    // Generate pseudo-FFT from the audio signals
    for (let i = 0; i < BAR_COUNT; i++) {
      const freq = i / BAR_COUNT;
      let target: number;
      if (freq < 0.2) {
        // Bass range
        target = signals.bassEnergy * (1.5 + Math.sin(time * 3 + i * 0.5) * 0.3);
      } else if (freq < 0.5) {
        // Mid range
        target = signals.midEnergy * (1.2 + Math.sin(time * 4 + i * 0.3) * 0.25);
      } else {
        // High range
        target = signals.highEnergy * (1.0 + Math.sin(time * 5 + i * 0.7) * 0.2);
      }
      // Add some variation per bar
      target += Math.sin(time * 2 + i * 0.8) * 0.05;
      target = Math.max(0, target);
      
      // Fast attack, medium decay
      if (target > this.smoothedFft[i]) {
        this.smoothedFft[i] += (target - this.smoothedFft[i]) * 0.7;
      } else {
        this.smoothedFft[i] += (target - this.smoothedFft[i]) * 0.15;
      }
    }

    // Bass accumulator for spinning speed
    this.bassAccumulator += signals.bassPulse * bassReact * dt * 2.0;

    // Explosion force: spikes on bass, decays fast
    const targetExplosion = signals.bassPulse * bassReact * 2.0;
    if (targetExplosion > this.explosionForce) {
      this.explosionForce = targetExplosion;
    } else {
      this.explosionForce *= 0.92; // fast decay
    }

    // Constant ring rotation + bass-driven spin bursts
    this.ringRotation += dt * (0.15 + signals.bassPulse * bassReact * 0.3) * params.speed;
    this.group.rotation.y = this.ringRotation;
    
    // Tilt the ring based on bass (gentle lean — keep shape visible)
    this.group.rotation.x = Math.sin(time * 0.15) * 0.08 + signals.bassPulse * bassReact * 0.1;
    this.group.rotation.z = Math.cos(time * 0.11) * 0.06 + signals.bassPulse * bassReact * 0.06;

    // Update each bar
    for (let i = 0; i < BAR_COUNT; i++) {
      const bar = this.bars[i];
      const mat = this.barMaterials[i];
      const height = this.smoothedFft[i];

      // Scale Y based on FFT value (min height so bars are always visible)
      const scaleY = 0.2 + height * 4.0;
      bar.scale.y = scaleY;

      // Bars explode outward on bass (radius increase)
      const baseAngle = (i / BAR_COUNT) * Math.PI * 2;
      const explosionRadius = 2.5 + this.explosionForce * 0.8;
      bar.position.x = Math.cos(baseAngle) * explosionRadius;
      bar.position.z = Math.sin(baseAngle) * explosionRadius;

      // Bars jump up on their individual value
      bar.position.y = -1.5 + height * 0.5;

      // Each bar tilts outward more when it's loud
      bar.rotation.x = height * 0.3;
      
      // Update uniforms
      mat.uniforms.uTime.value = time;
      mat.uniforms.uBarHeight.value = height;
      mat.uniforms.uBassEnergy.value = signals.bassPulse * bassReact;
      mat.uniforms.uIntensity.value = params.intensity;
      mat.uniforms.uColor1.value.set(params.colors[0]);
      mat.uniforms.uColor2.value.set(params.colors[1]);
      mat.uniforms.uColor3.value.set(params.colors[2]);
      mat.uniforms.uColor4.value.set(params.colors[3]);
    }

    // Scale the whole group with bass for that "pumping" feel
    const groupScale = 1.0 + signals.bassPulse * bassReact * 0.15;
    this.group.scale.setScalar(groupScale);
  }

  /** Allow engine to pass real FFT data */
  setFFTData(data: Float32Array): void {
    const step = Math.floor(data.length / BAR_COUNT);
    for (let i = 0; i < BAR_COUNT; i++) {
      // Average nearby bins and normalize from dB (-100..0) to 0..1
      let sum = 0;
      for (let j = 0; j < step; j++) {
        const dB = data[i * step + j];
        sum += Math.max(0, (dB + 100) / 100);
      }
      this.fftData[i] = sum / step;
    }
    // If real FFT data is available, use it
    for (let i = 0; i < BAR_COUNT; i++) {
      if (this.fftData[i] > 0.01) {
        // Blend real FFT in
        const target = this.fftData[i];
        if (target > this.smoothedFft[i]) {
          this.smoothedFft[i] += (target - this.smoothedFft[i]) * 0.7;
        } else {
          this.smoothedFft[i] += (target - this.smoothedFft[i]) * 0.15;
        }
      }
    }
  }

  dispose(): void {
    for (const bar of this.bars) {
      bar.geometry.dispose();
      (bar.material as THREE.ShaderMaterial).dispose();
    }
    this.bars = [];
    this.barMaterials = [];
    this.group.parent?.remove(this.group);
  }
}
