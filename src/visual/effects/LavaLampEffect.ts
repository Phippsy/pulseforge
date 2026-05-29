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
uniform float uIntensity;
uniform float uAspect;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;

// Smooth metaball blobs
float blob(vec2 p, vec2 center, float radius) {
  return radius / length(p - center);
}

// Hash function for pseudo-random
float hash(float n) {
  return fract(sin(n) * 43758.5453);
}

void main() {
  vec2 uv = vUv;
  vec2 p = (uv - 0.5) * vec2(uAspect, 1.0);
  
  // Lava lamp glass container shape (tall oval)
  float containerWidth = 0.25;
  float containerHeight = 0.45;
  vec2 containerP = p;
  
  // Slight bulge in the middle (classic lava lamp shape)
  float bulge = 1.0 + 0.08 * sin(containerP.y * 3.14159);
  containerP.x /= bulge;
  
  float container = smoothstep(containerWidth, containerWidth - 0.01, abs(containerP.x)) *
                    smoothstep(containerHeight, containerHeight - 0.02, abs(containerP.y));
  
  // Background fluid colour (warm amber)
  vec3 fluidColor = mix(vec3(0.15, 0.02, 0.0), vec3(0.25, 0.05, 0.0), uv.y);
  
  // Multiple lava blobs rising and falling
  float blobField = 0.0;
  float blobField2 = 0.0;
  
  float speed = 0.3 + uBassEnergy * 0.5;
  
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    float phase = hash(fi * 7.3) * 6.28;
    float riseSpeed = 0.2 + hash(fi * 3.1) * 0.3;
    
    // Vertical position: rises with time, wraps, influenced by bass
    float yBase = mod(uTime * riseSpeed * speed + phase, 2.0) - 1.0;
    // Slow down near top and bottom (accumulation)
    float ySlowdown = 1.0 - 0.5 * smoothstep(0.3, 0.45, abs(yBase));
    float y = yBase * ySlowdown * 0.4;
    
    // Horizontal drift
    float x = sin(uTime * 0.5 + fi * 2.0 + uMidEnergy * 3.0) * 0.12 * (1.0 - abs(yBase) * 0.5);
    
    // Size varies - larger when near top/bottom (pooling)
    float size = 0.04 + 0.02 * sin(uTime * 0.8 + fi) + 0.02 * smoothstep(0.25, 0.4, abs(y));
    size += uBassEnergy * 0.015;
    
    vec2 blobCenter = vec2(x, y);
    blobField += blob(p, blobCenter, size);
    
    // Second layer (different colour)
    float y2 = mod(uTime * riseSpeed * speed * 0.7 + phase + 3.14, 2.0) - 1.0;
    float x2 = cos(uTime * 0.4 + fi * 1.7) * 0.1;
    float size2 = 0.03 + 0.015 * sin(uTime + fi * 2.5);
    blobField2 += blob(p, vec2(x2, y2 * 0.35), size2);
  }
  
  // Threshold blobs into lava shapes
  float lava1 = smoothstep(1.8, 2.2, blobField);
  float lava2 = smoothstep(1.6, 2.0, blobField2);
  
  // Lava colours - warm orange/red primary, purple/magenta secondary
  vec3 lavaColor1 = mix(uColor1, uColor2, smoothstep(1.8, 3.0, blobField));
  vec3 lavaColor2 = mix(uColor2, uColor3, smoothstep(1.6, 2.8, blobField2));
  
  // Internal glow
  float glow1 = smoothstep(1.2, 1.8, blobField) * 0.3;
  float glow2 = smoothstep(1.0, 1.6, blobField2) * 0.2;
  
  // Build colour inside container
  vec3 col = fluidColor;
  col += lavaColor1 * lava1;
  col += lavaColor2 * lava2 * 0.7;
  col += uColor1 * glow1;
  col += uColor3 * glow2;
  
  // Heat shimmer at bottom
  float heatShimmer = smoothstep(-0.4, -0.3, p.y) * smoothstep(-0.25, -0.35, p.y);
  col += vec3(0.3, 0.05, 0.0) * heatShimmer * (0.5 + 0.5 * sin(uTime * 3.0 + p.x * 20.0));
  
  // Apply container mask
  col *= container;
  
  // Glass reflection highlights
  float glassHighlight = smoothstep(0.18, 0.16, abs(containerP.x - 0.08)) *
                         smoothstep(0.0, 0.3, containerP.y + 0.3) * 0.15;
  col += vec3(1.0) * glassHighlight * container;
  
  // Glass edge glow
  float edgeDist = abs(abs(containerP.x) - containerWidth + 0.01);
  float glassEdge = smoothstep(0.02, 0.0, edgeDist) * container * 0.3;
  col += vec3(0.4, 0.3, 0.2) * glassEdge;
  
  // Lamp base and cap (metallic)
  float baseDist = abs(p.y + containerHeight);
  float baseShape = smoothstep(0.03, 0.0, baseDist) * smoothstep(containerWidth + 0.05, 0.0, abs(p.x));
  col += vec3(0.3, 0.25, 0.2) * baseShape;
  
  float capDist = abs(p.y - containerHeight);
  float capShape = smoothstep(0.02, 0.0, capDist) * smoothstep(containerWidth * 0.5, 0.0, abs(p.x));
  col += vec3(0.3, 0.25, 0.2) * capShape;
  
  // Ambient room glow from the lamp
  float roomGlow = container * 0.1 * (lava1 + lava2);
  float dist = length(p);
  col += (lavaColor1 + lavaColor2) * 0.03 / (dist + 0.5);
  
  // Transient pulse makes blobs split
  col += vec3(0.2, 0.05, 0.0) * uTransient * container * 0.5;
  
  col *= uIntensity;
  gl_FragColor = vec4(col, 1.0);
}
`;

export class LavaLampEffect implements VisualEffect {
  name = 'lavaLamp';
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
        uIntensity: { value: 1.0 },
        uAspect: { value: 1.0 },
        uColor1: { value: new THREE.Color('#ff4400') },
        uColor2: { value: new THREE.Color('#ff0066') },
        uColor3: { value: new THREE.Color('#9900ff') },
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
    u.uAspect.value = window.innerWidth / window.innerHeight;
    u.uColor1.value.set(params.colors[0]);
    u.uColor2.value.set(params.colors[1]);
    u.uColor3.value.set(params.colors[2]);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.mesh.parent?.remove(this.mesh);
  }
}
