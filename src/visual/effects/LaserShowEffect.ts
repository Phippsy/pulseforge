import * as THREE from 'three';
import type { ControlSignals } from '../../store';
import type { VisualEffect, EffectParams } from './types';

const BEAM_COUNT = 24;
const FAN_COUNT = 8;
const CONE_SEGMENTS = 64;

/**
 * Laser Light Show - inspired by concert laser shows
 * Features: scanning beams, fan patterns, cone sweeps, and sharp geometric patterns
 */
export class LaserShowEffect implements VisualEffect {
  name = 'laserShow';
  private group!: THREE.Group;
  private beams: THREE.Mesh[] = [];
  private fanBeams: THREE.Mesh[] = [];
  private cones: THREE.Mesh[] = [];
  private scannerAngle = 0;
  private fanAngle = 0;
  private conePhase = 0;
  private beamMaterial!: THREE.ShaderMaterial;
  private coneMaterial!: THREE.ShaderMaterial;

  init(scene: THREE.Scene, _camera: THREE.Camera): void {
    this.group = new THREE.Group();
    scene.add(this.group);

    // Shared beam material - thin bright lines with glow
    this.beamMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color('#00FF00') },
        uIntensity: { value: 1.0 },
        uTime: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        varying float vDist;
        void main() {
          vUv = uv;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vDist = length(mvPos.xyz);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uIntensity;
        uniform float uTime;
        varying vec2 vUv;
        varying float vDist;
        void main() {
          // Core beam - bright center falloff
          float core = exp(-abs(vUv.x - 0.5) * 20.0) * uIntensity;
          // Atmospheric scatter glow
          float glow = exp(-abs(vUv.x - 0.5) * 6.0) * 0.3 * uIntensity;
          // Dust particle simulation along beam
          float dust = sin(vUv.y * 40.0 + uTime * 3.0) * 0.1 + 0.9;
          // Distance attenuation (slight)
          float atten = 1.0 / (1.0 + vDist * 0.01);
          float alpha = (core + glow) * dust * atten;
          vec3 col = uColor * (core * 1.5 + glow * 0.8);
          gl_FragColor = vec4(col, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });

    // Cone material - volumetric light cone
    this.coneMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color('#FF00FF') },
        uIntensity: { value: 0.5 },
        uTime: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vPos;
        void main() {
          vUv = uv;
          vNormal = normalMatrix * normal;
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uIntensity;
        uniform float uTime;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vPos;
        void main() {
          // Edge glow - brighter at edges of cone
          float edge = 1.0 - abs(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0)));
          edge = pow(edge, 2.0);
          // Fade along length
          float lengthFade = 1.0 - vUv.y;
          // Scan lines for atmosphere
          float scan = sin(vPos.y * 8.0 + uTime * 2.0) * 0.15 + 0.85;
          float alpha = edge * lengthFade * uIntensity * scan * 0.4;
          vec3 col = uColor * (edge * 0.8 + 0.2);
          gl_FragColor = vec4(col, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });

    // Create scanning beams (thin planes)
    for (let i = 0; i < BEAM_COUNT; i++) {
      const geo = new THREE.PlaneGeometry(0.08, 30);
      const mat = this.beamMaterial.clone();
      const beam = new THREE.Mesh(geo, mat);
      beam.position.set(0, 5, 0); // Origin point (like a laser source above)
      this.beams.push(beam);
      this.group.add(beam);
    }

    // Fan beams - emanate from a single point in a fan pattern
    for (let i = 0; i < FAN_COUNT; i++) {
      const geo = new THREE.PlaneGeometry(0.05, 25);
      const mat = this.beamMaterial.clone();
      const beam = new THREE.Mesh(geo, mat);
      beam.position.set(0, -8, -5); // Source from below/behind
      this.fanBeams.push(beam);
      this.group.add(beam);
    }

    // Volumetric cones
    for (let i = 0; i < 4; i++) {
      const geo = new THREE.ConeGeometry(4 + i * 2, 20, CONE_SEGMENTS, 1, true);
      const mat = this.coneMaterial.clone();
      const cone = new THREE.Mesh(geo, mat);
      cone.position.set((i - 1.5) * 6, 8, -3);
      cone.rotation.x = Math.PI; // Point downward
      this.cones.push(cone);
      this.group.add(cone);
    }
  }

  update(signals: ControlSignals, params: EffectParams, dt: number, time: number): void {
    const speed = params.speed * 1.5;
    const bass = signals.bassEnergy;
    const mid = signals.midEnergy;
    const high = signals.highEnergy;
    const pulse = signals.bassPulse;

    // Parse colors
    const colors = params.colors.map(c => new THREE.Color(c));

    // Scanner angle - sweeps back and forth, speed reactive to BPM
    this.scannerAngle += dt * speed * (1.0 + bass * 2.0);
    this.fanAngle += dt * speed * 0.7 * (1.0 + mid * 1.5);
    this.conePhase += dt * speed * 0.3;

    // Update beam uniforms
    this.beamMaterial.uniforms.uTime.value = time;
    this.coneMaterial.uniforms.uTime.value = time;

    // Scanning beams - rotate in complex patterns
    for (let i = 0; i < this.beams.length; i++) {
      const beam = this.beams[i];
      const mat = beam.material as THREE.ShaderMaterial;
      const phase = (i / this.beams.length) * Math.PI * 2;
      const colorIdx = i % colors.length;

      // Multiple scan patterns layered
      const pattern = Math.floor(time * 0.1) % 4;
      let angleX = 0, angleZ = 0;

      switch (pattern) {
        case 0: // Circular scan
          angleX = Math.sin(this.scannerAngle + phase) * (0.8 + pulse * 0.4);
          angleZ = Math.cos(this.scannerAngle * 0.7 + phase) * 0.6;
          break;
        case 1: // Horizontal sweep
          angleX = Math.sin(this.scannerAngle * 2 + phase * 0.3) * 1.2;
          angleZ = Math.sin(phase) * 0.1;
          break;
        case 2: // Starburst
          angleX = Math.sin(phase + this.scannerAngle * 0.5) * (0.5 + bass);
          angleZ = Math.cos(phase + this.scannerAngle * 0.5) * (0.5 + bass);
          break;
        case 3: // Lissajous
          angleX = Math.sin(this.scannerAngle * 1.3 + phase) * 0.9;
          angleZ = Math.sin(this.scannerAngle * 1.7 + phase * 1.5) * 0.7;
          break;
      }

      beam.rotation.x = angleX;
      beam.rotation.z = angleZ;
      beam.rotation.y = phase + time * 0.1;

      // Intensity pulses with bass
      const intensity = params.intensity * (0.6 + pulse * 0.6 + high * 0.3);
      mat.uniforms.uColor.value.copy(colors[colorIdx]);
      mat.uniforms.uIntensity.value = intensity;
      mat.uniforms.uTime.value = time;

      // Some beams flicker on transients
      if (signals.transientPulse > 0.5 && Math.random() < 0.3) {
        mat.uniforms.uIntensity.value *= 2.0;
      }
    }

    // Fan beams - emanate in a controlled fan
    const fanSpread = 0.3 + bass * 0.5;
    for (let i = 0; i < this.fanBeams.length; i++) {
      const beam = this.fanBeams[i];
      const mat = beam.material as THREE.ShaderMaterial;
      const t = (i / (this.fanBeams.length - 1)) - 0.5; // -0.5 to 0.5

      beam.rotation.z = t * fanSpread * Math.PI + Math.sin(this.fanAngle + i * 0.3) * 0.2;
      beam.rotation.x = -0.3 + Math.sin(this.fanAngle * 0.5 + i) * 0.15;

      const colorIdx = (i + 2) % colors.length;
      mat.uniforms.uColor.value.copy(colors[colorIdx]);
      mat.uniforms.uIntensity.value = params.intensity * (0.5 + mid * 0.5);
      mat.uniforms.uTime.value = time;
    }

    // Volumetric cones - sway and pulse
    for (let i = 0; i < this.cones.length; i++) {
      const cone = this.cones[i];
      const mat = cone.material as THREE.ShaderMaterial;
      const offset = i * 1.5;

      cone.rotation.x = Math.PI + Math.sin(this.conePhase + offset) * 0.3;
      cone.rotation.z = Math.cos(this.conePhase * 0.7 + offset) * 0.2;

      // Scale cones with bass
      const s = 1.0 + pulse * 0.3;
      cone.scale.set(s, 1.0 + bass * 0.2, s);

      const colorIdx = (i + 1) % colors.length;
      mat.uniforms.uColor.value.copy(colors[colorIdx]);
      mat.uniforms.uIntensity.value = params.intensity * (0.3 + bass * 0.4);
      mat.uniforms.uTime.value = time;
    }

    // On strong transients, briefly flash all beams white
    if (signals.transientPulse > 0.8) {
      const white = new THREE.Color('#FFFFFF');
      this.beams.forEach(b => {
        (b.material as THREE.ShaderMaterial).uniforms.uColor.value.copy(white);
        (b.material as THREE.ShaderMaterial).uniforms.uIntensity.value = 2.0;
      });
    }
  }

  dispose(): void {
    this.beams.forEach(b => {
      b.geometry.dispose();
      (b.material as THREE.ShaderMaterial).dispose();
    });
    this.fanBeams.forEach(b => {
      b.geometry.dispose();
      (b.material as THREE.ShaderMaterial).dispose();
    });
    this.cones.forEach(c => {
      c.geometry.dispose();
      (c.material as THREE.ShaderMaterial).dispose();
    });
    this.beamMaterial.dispose();
    this.coneMaterial.dispose();
    this.group.parent?.remove(this.group);
  }
}
