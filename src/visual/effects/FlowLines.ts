import * as THREE from 'three';
import type { ControlSignals } from '../../store';
import type { VisualEffect, EffectParams } from './types';

interface LineTrail {
  positions: Float32Array;
  headPos: THREE.Vector3;
  velocity: THREE.Vector3;
  hue: number;
  life: number;
}

export class FlowLines implements VisualEffect {
  name = 'flowlines';
  private lines: THREE.Line[] = [];
  private trails: LineTrail[] = [];
  private group: THREE.Group | null = null;
  private glowPoints: THREE.Points | null = null;
  private glowPositions: Float32Array | null = null;
  private lineCount = 80;
  private lineLength = 180;
  private attractors: THREE.Vector3[] = [];

  init(scene: THREE.Scene, _camera: THREE.Camera): void {
    this.group = new THREE.Group();
    scene.add(this.group);

    // Create attractors that lines orbit around
    for (let a = 0; a < 3; a++) {
      this.attractors.push(new THREE.Vector3(
        (Math.random() - 0.5) * 6,
        (Math.random() - 0.5) * 6,
        (Math.random() - 0.5) * 6
      ));
    }

    // Glow point sprites at trail heads
    this.glowPositions = new Float32Array(this.lineCount * 3);
    const glowGeo = new THREE.BufferGeometry();
    glowGeo.setAttribute('position', new THREE.BufferAttribute(this.glowPositions, 3));
    const glowMat = new THREE.ShaderMaterial({
      uniforms: {
        uSize: { value: 12.0 },
      },
      vertexShader: `
        uniform float uSize;
        void main() {
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPos;
          gl_PointSize = uSize * (300.0 / -mvPos.z);
        }
      `,
      fragmentShader: `
        void main() {
          float dist = length(gl_PointCoord - 0.5) * 2.0;
          if (dist > 1.0) discard;
          float alpha = 1.0 - dist * dist;
          gl_FragColor = vec4(1.0, 1.0, 1.0, alpha * 0.7);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.glowPoints = new THREE.Points(glowGeo, glowMat);
    this.group.add(this.glowPoints);

    for (let i = 0; i < this.lineCount; i++) {
      const positions = new Float32Array(this.lineLength * 3);
      const startX = (Math.random() - 0.5) * 12;
      const startY = (Math.random() - 0.5) * 12;
      const startZ = (Math.random() - 0.5) * 12;

      for (let j = 0; j < this.lineLength; j++) {
        positions[j * 3] = startX;
        positions[j * 3 + 1] = startY;
        positions[j * 3 + 2] = startZ;
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

      const mat = new THREE.LineBasicMaterial({
        color: new THREE.Color().setHSL(i / this.lineCount, 0.9, 0.6),
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        linewidth: 1,
      });

      const line = new THREE.Line(geo, mat);
      this.group.add(line);
      this.lines.push(line);

      this.trails.push({
        positions,
        headPos: new THREE.Vector3(startX, startY, startZ),
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.1,
          (Math.random() - 0.5) * 0.1,
          (Math.random() - 0.5) * 0.1
        ),
        hue: i / this.lineCount,
        life: Math.random(),
      });
    }
  }

  private curlNoise3D(x: number, y: number, z: number, t: number, scale: number): THREE.Vector3 {
    const e = 0.01;

    // Curl = cross product of gradient of noise field
    const dndx_y = Math.cos(z * scale * 0.9 + t * 0.5) * scale * Math.cos(x * scale + t * 0.4);
    const dndx_z = Math.cos(x * scale * 1.1 + t * 0.6) * scale * 1.1 * Math.cos(y * scale * 0.7 + t * 0.8);
    const dndy_x = Math.cos(y * scale + t * 0.7) * scale * Math.cos(z * scale * 0.8 + t * 0.3);
    const dndy_z = -Math.sin(x * scale * 1.1 + t * 0.6) * Math.sin(y * scale * 0.7 + t * 0.8) * scale * 0.7;
    const dndz_x = -Math.sin(y * scale + t * 0.7) * Math.sin(z * scale * 0.8 + t * 0.3) * scale * 0.8;
    const dndz_y = Math.cos(z * scale * 0.9 + t * 0.5) * scale * 0.9 * Math.cos(x * scale + t * 0.4);

    return new THREE.Vector3(
      dndz_y - dndy_z,
      dndx_z - dndz_x,
      dndy_x - dndx_y
    ).normalize().multiplyScalar(e * 30);
  }

  update(signals: ControlSignals, params: EffectParams, dt: number, time: number): void {
    const speed = (params.effectParams.speed ?? 0.4) * (0.5 + signals.midEnergy * params.midReactivity * 2.0);
    const curvature = params.effectParams.curvature ?? 0.6;
    const bassBoost = signals.bassPulse * params.bassReactivity;
    const transient = signals.transientPulse * params.onsetReactivity;

    // Move attractors with audio
    for (let a = 0; a < this.attractors.length; a++) {
      const att = this.attractors[a];
      att.x = Math.sin(time * 0.3 + a * 2.1) * (3 + signals.bassEnergy * 2);
      att.y = Math.cos(time * 0.25 + a * 1.7) * (3 + signals.midEnergy * 2);
      att.z = Math.sin(time * 0.2 + a * 3.3) * (3 + signals.highEnergy * 2);
    }

    for (let i = 0; i < this.trails.length; i++) {
      const trail = this.trails[i];
      const pos = trail.positions;

      // Get curl noise at head position
      const curl = this.curlNoise3D(
        trail.headPos.x * 0.15,
        trail.headPos.y * 0.15,
        trail.headPos.z * 0.15,
        time * 0.5,
        curvature
      );

      // Apply curl force to velocity
      trail.velocity.add(curl.multiplyScalar(speed * 2));

      // Attractor influence - each line is pulled toward nearest attractor
      const nearestAtt = this.attractors[i % this.attractors.length];
      const toAtt = nearestAtt.clone().sub(trail.headPos);
      const attDist = toAtt.length();
      if (attDist > 0.5) {
        toAtt.normalize().multiplyScalar(0.002 * (1 + signals.midEnergy * 3) / (attDist * 0.3 + 1));
        trail.velocity.add(toAtt);
      }

      // Damping
      trail.velocity.multiplyScalar(0.96);

      // Bass kick: radial pulse
      if (bassBoost > 0.3) {
        const radial = trail.headPos.clone().normalize().multiplyScalar(bassBoost * 0.02);
        trail.velocity.add(radial);
      }

      // Transient: scatter burst
      if (transient > 0.6 && Math.random() < 0.3) {
        trail.velocity.add(new THREE.Vector3(
          (Math.random() - 0.5) * transient * 0.1,
          (Math.random() - 0.5) * transient * 0.1,
          (Math.random() - 0.5) * transient * 0.1
        ));
      }

      // Move head
      trail.headPos.add(trail.velocity.clone().multiplyScalar(dt * 60));

      // Boundary: soft pull toward center
      const dist = trail.headPos.length();
      if (dist > 10) {
        trail.headPos.multiplyScalar(0.99);
        trail.velocity.multiplyScalar(0.9);
      }

      // Reset if too far
      if (dist > 20) {
        trail.headPos.set(
          (Math.random() - 0.5) * 6,
          (Math.random() - 0.5) * 6,
          (Math.random() - 0.5) * 6
        );
        trail.velocity.set(0, 0, 0);
      }

      // Shift trail: move all points back, new head at front
      for (let j = this.lineLength - 1; j > 0; j--) {
        pos[j * 3] = pos[(j - 1) * 3];
        pos[j * 3 + 1] = pos[(j - 1) * 3 + 1];
        pos[j * 3 + 2] = pos[(j - 1) * 3 + 2];
      }
      pos[0] = trail.headPos.x;
      pos[1] = trail.headPos.y;
      pos[2] = trail.headPos.z;

      // Update geometry
      const geo = this.lines[i].geometry;
      (geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;

      // Update colour - shift hue with time and position
      const mat = this.lines[i].material as THREE.LineBasicMaterial;
      const colorIdx = (i + Math.floor(time * 0.5)) % 4;
      mat.color.set(params.colors[colorIdx]);

      // Opacity based on trail speed and audio
      const vel = trail.velocity.length();
      mat.opacity = Math.min(0.9, 0.25 + vel * 6 + bassBoost * 0.3 + signals.highEnergy * params.highReactivity * 0.3);

      // Update glow head position
      if (this.glowPositions) {
        this.glowPositions[i * 3] = trail.headPos.x;
        this.glowPositions[i * 3 + 1] = trail.headPos.y;
        this.glowPositions[i * 3 + 2] = trail.headPos.z;
      }
    }

    // Update glow points
    if (this.glowPoints) {
      (this.glowPoints.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      const gMat = this.glowPoints.material as THREE.ShaderMaterial;
      if (gMat.uniforms?.uSize) {
        gMat.uniforms.uSize.value = 8.0 + bassBoost * 15.0 + transient * 20.0;
      }
    }

    // Slow rotation of the whole group
    if (this.group) {
      this.group.rotation.y += 0.002 * params.speed * (1 + signals.midEnergy * 0.5);
      this.group.rotation.x = Math.sin(time * 0.1) * 0.15;
      this.group.rotation.z = Math.cos(time * 0.07) * 0.05;
    }
  }

  dispose(): void {
    for (const line of this.lines) {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    }
    if (this.glowPoints) {
      this.glowPoints.geometry.dispose();
      (this.glowPoints.material as THREE.Material).dispose();
    }
    if (this.group) this.group.parent?.remove(this.group);
    this.lines = [];
    this.trails = [];
    this.attractors = [];
    this.group = null;
    this.glowPoints = null;
    this.glowPositions = null;
  }
}
