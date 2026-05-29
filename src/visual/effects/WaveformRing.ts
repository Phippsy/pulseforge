import * as THREE from 'three';
import type { ControlSignals } from '../../store';
import type { VisualEffect, EffectParams } from './types';

const vertexShader = `
attribute float angle;
attribute float radius;
attribute float ringIndex;

uniform float uTime;
uniform float uBassEnergy;
uniform float uMidEnergy;
uniform float uHighEnergy;
uniform float uTransient;
uniform float uIntensity;
uniform float uPixelRatio;
uniform float uFFTData[64];

varying float vAngle;
varying float vRadius;
varying float vRingIndex;
varying float vDisplacement;

void main() {
  vAngle = angle;
  vRadius = radius;
  vRingIndex = ringIndex;

  float a = angle;
  float r = radius;
  
  // FFT-driven radial displacement
  int fftBin = int(mod(angle / 6.2831853 * 64.0, 64.0));
  float fftVal = uFFTData[fftBin];
  
  // Bass pumps inner rings, treble pumps outer
  float bassDisplace = uBassEnergy * (1.0 - ringIndex * 0.3) * 0.4;
  float midDisplace = uMidEnergy * sin(a * 3.0 + uTime * 2.0) * 0.3 * ringIndex;
  float highDisplace = uHighEnergy * sin(a * 8.0 + uTime * 5.0) * 0.15;
  
  // FFT displacement
  float fftDisplace = fftVal * (0.3 + ringIndex * 0.4);
  
  // Transient shockwave - expands outward
  float shockPhase = a * 2.0 - uTime * 10.0;
  float shock = uTransient * sin(shockPhase) * (1.0 - ringIndex) * 0.5;
  
  // Breathing / time-based for silent mode — visible even without audio
  float breath = sin(uTime * 0.5 + ringIndex * 1.5) * 0.15 + sin(uTime * 0.3) * 0.08;
  
  float totalDisplace = bassDisplace + midDisplace + highDisplace + fftDisplace + shock + breath;
  vDisplacement = totalDisplace;
  
  float finalR = r + totalDisplace;
  
  // Ring rotation varies per ring
  float rotation = uTime * (0.2 + ringIndex * 0.15) * (mod(ringIndex, 2.0) > 0.5 ? 1.0 : -1.0);
  rotation += uMidEnergy * 0.5;
  float finalAngle = a + rotation;
  
  vec3 pos = vec3(
    cos(finalAngle) * finalR,
    sin(finalAngle) * finalR,
    ringIndex * 0.2 - 0.5
  );
  
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = (8.0 + fftVal * 8.0 + uTransient * 5.0 + breath * 10.0) * uIntensity * uPixelRatio;
}
`;

const fragmentShader = `
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec3 uColor4;
uniform float uTime;
uniform float uBassEnergy;
uniform float uIntensity;

varying float vAngle;
varying float vRadius;
varying float vRingIndex;
varying float vDisplacement;

void main() {
  // Circular point shape
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  
  // Soft glow falloff
  float glow = exp(-d * 2.5);
  
  // Colour by ring + displacement
  vec3 col;
  float rMix = vRingIndex;
  if (rMix < 0.33) {
    col = mix(uColor1, uColor2, rMix * 3.0);
  } else if (rMix < 0.66) {
    col = mix(uColor2, uColor3, (rMix - 0.33) * 3.0);
  } else {
    col = mix(uColor3, uColor4, (rMix - 0.66) * 3.0);
  }
  
  // Displacement brightness + base glow floor
  col += abs(vDisplacement) * 0.5 * uColor1;
  col = max(col, vec3(0.15)); // Ensure minimum visibility even with no audio
  
  // Bass pulse brightens core
  col *= 1.0 + uBassEnergy * 0.5;
  
  col *= glow * uIntensity * 2.0;
  
  float alpha = glow * (0.7 + uIntensity * 0.3);
  
  gl_FragColor = vec4(col, alpha);
}
`;

export class WaveformRing implements VisualEffect {
  name = 'ring';
  private points: THREE.Points | null = null;
  private material: THREE.ShaderMaterial | null = null;
  private fftUniform: { value: number[] };
  private fftData: Float32Array | null = null;

  constructor() {
    this.fftUniform = { value: new Array(64).fill(0) };
  }

  setFFTData(data: Float32Array): void {
    this.fftData = data;
  }

  init(scene: THREE.Scene, _camera: THREE.Camera): void {
    const ringCount = 7;
    const pointsPerRing = 256;
    const totalPoints = ringCount * pointsPerRing;

    const angles = new Float32Array(totalPoints);
    const radii = new Float32Array(totalPoints);
    const ringIndices = new Float32Array(totalPoints);
    const positions = new Float32Array(totalPoints * 3);

    for (let ring = 0; ring < ringCount; ring++) {
      const baseRadius = 1.0 + ring * 0.6;
      const ringNorm = ring / (ringCount - 1);

      for (let p = 0; p < pointsPerRing; p++) {
        const idx = ring * pointsPerRing + p;
        const angle = (p / pointsPerRing) * Math.PI * 2;

        angles[idx] = angle;
        radii[idx] = baseRadius;
        ringIndices[idx] = ringNorm;

        // Initial flat circle positions
        positions[idx * 3] = Math.cos(angle) * baseRadius;
        positions[idx * 3 + 1] = Math.sin(angle) * baseRadius;
        positions[idx * 3 + 2] = ringNorm * 0.2 - 0.5;
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('angle', new THREE.BufferAttribute(angles, 1));
    geo.setAttribute('radius', new THREE.BufferAttribute(radii, 1));
    geo.setAttribute('ringIndex', new THREE.BufferAttribute(ringIndices, 1));

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uBassEnergy: { value: 0 },
        uMidEnergy: { value: 0 },
        uHighEnergy: { value: 0 },
        uTransient: { value: 0 },
        uIntensity: { value: 0.7 },
        uPixelRatio: { value: window.devicePixelRatio || 1 },
        uFFTData: this.fftUniform,
        uColor1: { value: new THREE.Color('#F72585') },
        uColor2: { value: new THREE.Color('#7209B7') },
        uColor3: { value: new THREE.Color('#3A0CA3') },
        uColor4: { value: new THREE.Color('#4CC9F0') },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.points = new THREE.Points(geo, this.material);
    scene.add(this.points);
  }

  update(signals: ControlSignals, params: EffectParams, _dt: number, time: number): void {
    const fftData = this.fftData;
    if (!this.material) return;
    const u = this.material.uniforms;
    u.uTime.value = time;
    u.uBassEnergy.value = signals.bassEnergy * params.bassReactivity;
    u.uMidEnergy.value = signals.midEnergy * params.midReactivity;
    u.uHighEnergy.value = signals.highEnergy * params.highReactivity;
    u.uTransient.value = signals.transientPulse * params.onsetReactivity;
    u.uIntensity.value = params.intensity;
    u.uColor1.value.set(params.colors[0]);
    u.uColor2.value.set(params.colors[1]);
    u.uColor3.value.set(params.colors[2]);
    u.uColor4.value.set(params.colors[3]);

    // Pass FFT data if available
    if (fftData && fftData.length >= 64) {
      for (let i = 0; i < 64; i++) {
        // Normalize from dB range (-100 to 0) to 0-1
        this.fftUniform.value[i] = Math.max(0, (fftData[i] + 100) / 100);
      }
    } else {
      // Generate gentle animation from signals when no FFT
      for (let i = 0; i < 64; i++) {
        this.fftUniform.value[i] = (
          Math.sin(time * 1.5 + i * 0.3) * 0.2 +
          signals.bassEnergy * (i < 16 ? 0.5 : 0.1) +
          signals.midEnergy * (i >= 16 && i < 40 ? 0.4 : 0.1) +
          signals.highEnergy * (i >= 40 ? 0.4 : 0.1)
        ) * 0.5;
      }
    }
  }

  dispose(): void {
    if (this.points) {
      this.points.geometry.dispose();
      this.points.parent?.remove(this.points);
    }
    if (this.material) this.material.dispose();
    this.points = null;
    this.material = null;
  }
}
