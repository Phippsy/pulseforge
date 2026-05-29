import * as THREE from 'three';
import type { ControlSignals } from '../../store';
import type { VisualEffect, EffectParams } from './types';

const STAR_COUNT = 3000;
const NEBULA_COUNT = 200;

export class StarfieldEffect implements VisualEffect {
  name = 'starfield';
  private stars!: THREE.Points;
  private nebula!: THREE.Points;
  private velocities!: Float32Array;
  private starColors!: Float32Array;
  private group!: THREE.Group;
  private depth = 150;

  init(scene: THREE.Scene, _camera: THREE.Camera): void {
    this.group = new THREE.Group();
    scene.add(this.group);

    // Stars
    const starGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(STAR_COUNT * 3);
    this.velocities = new Float32Array(STAR_COUNT);
    this.starColors = new Float32Array(STAR_COUNT * 3);

    for (let i = 0; i < STAR_COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 80;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 80;
      positions[i * 3 + 2] = Math.random() * -this.depth;
      this.velocities[i] = 0.3 + Math.random() * 0.7;
      // Star color temperature variation
      const temp = Math.random();
      if (temp < 0.3) { // Blue-white
        this.starColors[i * 3] = 0.7 + Math.random() * 0.3;
        this.starColors[i * 3 + 1] = 0.8 + Math.random() * 0.2;
        this.starColors[i * 3 + 2] = 1.0;
      } else if (temp < 0.7) { // White-yellow
        this.starColors[i * 3] = 1.0;
        this.starColors[i * 3 + 1] = 0.9 + Math.random() * 0.1;
        this.starColors[i * 3 + 2] = 0.7 + Math.random() * 0.3;
      } else { // Orange-red
        this.starColors[i * 3] = 1.0;
        this.starColors[i * 3 + 1] = 0.4 + Math.random() * 0.4;
        this.starColors[i * 3 + 2] = 0.2 + Math.random() * 0.3;
      }
    }

    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(this.starColors, 3));

    const starMat = new THREE.ShaderMaterial({
      uniforms: {
        uSize: { value: 3.0 },
        uTime: { value: 0 },
      },
      vertexShader: `
        varying vec3 vColor;
        varying float vDepth;
        uniform float uSize;
        uniform float uTime;
        void main() {
          vColor = color;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vDepth = -mvPos.z / 150.0;
          // Size increases as stars approach (closer = bigger)
          float sizeFactor = 1.0 + (1.0 - vDepth) * 3.0;
          gl_PointSize = uSize * sizeFactor * (300.0 / -mvPos.z);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vDepth;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          if (d > 0.5) discard;
          // Bright core with soft glow
          float core = exp(-d * 10.0);
          float glow = exp(-d * 4.0) * 0.4;
          float alpha = core + glow;
          // Stars closer to camera are brighter/streakier
          float streak = 1.0 - vDepth;
          vec3 col = vColor * (core * 0.9 + glow * 0.4);
          gl_FragColor = vec4(col, alpha * (0.4 + streak * 0.6));
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
    });

    this.stars = new THREE.Points(starGeo, starMat);
    this.group.add(this.stars);

    // Nebula clouds - larger, colored, translucent particles
    const nebulaGeo = new THREE.BufferGeometry();
    const nebulaPos = new Float32Array(NEBULA_COUNT * 3);
    const nebulaColors = new Float32Array(NEBULA_COUNT * 3);

    for (let i = 0; i < NEBULA_COUNT; i++) {
      nebulaPos[i * 3] = (Math.random() - 0.5) * 100;
      nebulaPos[i * 3 + 1] = (Math.random() - 0.5) * 60;
      nebulaPos[i * 3 + 2] = -30 - Math.random() * 100;
      const hue = Math.random();
      const col = new THREE.Color().setHSL(hue, 0.8, 0.3);
      nebulaColors[i * 3] = col.r;
      nebulaColors[i * 3 + 1] = col.g;
      nebulaColors[i * 3 + 2] = col.b;
    }

    nebulaGeo.setAttribute('position', new THREE.BufferAttribute(nebulaPos, 3));
    nebulaGeo.setAttribute('color', new THREE.BufferAttribute(nebulaColors, 3));

    const nebulaMat = new THREE.ShaderMaterial({
      uniforms: { uSize: { value: 80.0 } },
      vertexShader: `
        varying vec3 vColor;
        uniform float uSize;
        void main() {
          vColor = color;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = uSize * (200.0 / -mvPos.z);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          float alpha = exp(-d * 4.0) * 0.12;
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
    });

    this.nebula = new THREE.Points(nebulaGeo, nebulaMat);
    this.group.add(this.nebula);
  }

  update(signals: ControlSignals, params: EffectParams, dt: number, time: number): void {
    const speed = (params.effectParams.warpSpeed ?? 1.0) * params.speed;
    const bassBoost = signals.bassPulse * params.bassReactivity;
    const transient = signals.transientPulse * params.onsetReactivity;

    // Warp factor increases with bass
    const warpFactor = speed * (1 + bassBoost * 3.0 + transient * 5.0);

    // Move stars toward camera
    const positions = this.stars.geometry.attributes.position as THREE.BufferAttribute;
    const arr = positions.array as Float32Array;

    for (let i = 0; i < STAR_COUNT; i++) {
      arr[i * 3 + 2] += this.velocities[i] * warpFactor * dt * 40;

      // Reset stars that pass the camera
      if (arr[i * 3 + 2] > 5) {
        arr[i * 3] = (Math.random() - 0.5) * 80;
        arr[i * 3 + 1] = (Math.random() - 0.5) * 80;
        arr[i * 3 + 2] = -this.depth;
        this.velocities[i] = 0.3 + Math.random() * 0.7;
      }
    }
    positions.needsUpdate = true;

    // Nebula drifts slowly
    const nebulaPos = this.nebula.geometry.attributes.position as THREE.BufferAttribute;
    const nArr = nebulaPos.array as Float32Array;
    for (let i = 0; i < NEBULA_COUNT; i++) {
      nArr[i * 3 + 2] += warpFactor * dt * 8;
      if (nArr[i * 3 + 2] > 10) {
        nArr[i * 3] = (Math.random() - 0.5) * 100;
        nArr[i * 3 + 1] = (Math.random() - 0.5) * 60;
        nArr[i * 3 + 2] = -30 - Math.random() * 100;
      }
    }
    nebulaPos.needsUpdate = true;

    // Star size pulses with beat
    const starMat = this.stars.material as THREE.ShaderMaterial;
    starMat.uniforms.uSize.value = 2.5 + bassBoost * 4.0 + transient * 3.0;
    starMat.uniforms.uTime.value = time;

    // Gentle rotation toward direction of travel
    this.group.rotation.z = Math.sin(time * 0.1) * 0.05 + signals.midEnergy * 0.1;
    this.group.rotation.x = Math.cos(time * 0.07) * 0.03;

    // Color shift nebula with audio
    const nebulaColors = this.nebula.geometry.attributes.color as THREE.BufferAttribute;
    const cArr = nebulaColors.array as Float32Array;
    const hueShift = time * 0.02 + signals.midEnergy * 0.3;
    for (let i = 0; i < Math.min(20, NEBULA_COUNT); i++) {
      const baseHue = (i / 20 + hueShift) % 1;
      const col = new THREE.Color().setHSL(baseHue, 0.7 + signals.bassEnergy * 0.3, 0.25 + signals.highEnergy * 0.2);
      cArr[i * 3] = col.r;
      cArr[i * 3 + 1] = col.g;
      cArr[i * 3 + 2] = col.b;
    }
    nebulaColors.needsUpdate = true;
  }

  dispose(): void {
    this.stars.geometry.dispose();
    (this.stars.material as THREE.Material).dispose();
    this.nebula.geometry.dispose();
    (this.nebula.material as THREE.Material).dispose();
    this.group.parent?.remove(this.group);
  }
}
