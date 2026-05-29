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
uniform float uComplexity;
uniform float uIntensity;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec3 uColor4;
uniform float uAspect;
uniform float uSegments;
uniform float uLayers;
uniform float uZoom;

#define PI 3.14159265
#define TAU 6.28318530

mat2 rot(float a) {
  float s = sin(a), c = cos(a);
  return mat2(c, -s, s, c);
}

float hash(float n) { return fract(sin(n) * 43758.5453); }

// Geometric pattern functions
float hexDist(vec2 p) {
  p = abs(p);
  return max(p.x + p.y * 0.577, p.y * 1.154);
}

float triDist(vec2 p) {
  p = abs(p);
  return max(p.x * 0.866 + p.y * 0.5, p.y);
}

float starShape(vec2 p, float n, float r1, float r2) {
  float angle = atan(p.y, p.x);
  float segment = TAU / n;
  float a = mod(angle, segment) - segment * 0.5;
  float d1 = length(p) * cos(a);
  float d2 = length(p) * cos(a - segment * 0.5);
  return min(d1 / r1, d2 / r2);
}

void main() {
  vec2 uv = vUv;
  uv.x *= uAspect;
  vec2 center = vec2(uAspect * 0.5, 0.5);
  vec2 p = (uv - center) * 2.0;
  
  float t = uTime * uSpeed * 0.5;
  float segments = floor(uSegments);
  
  // Kaleidoscope fold
  float angle = atan(p.y, p.x);
  float radius = length(p);
  
  // Fold into segments
  float segAngle = TAU / segments;
  angle = mod(angle, segAngle);
  // Mirror alternating segments
  if (mod(floor(atan(p.y, p.x) / segAngle), 2.0) == 1.0) {
    angle = segAngle - angle;
  }
  
  // Zoom pulsing with bass
  float zoom = uZoom * (1.0 + uBassEnergy * 0.5);
  
  // Transform back to cartesian with zoom and rotation
  vec2 kp = vec2(cos(angle), sin(angle)) * radius * zoom;
  kp *= rot(t * 0.2);
  
  // Multiple layers of geometric patterns
  vec3 col = vec3(0.0);
  
  for (float i = 0.0; i < 4.0; i++) {
    if (i >= uLayers) break;
    
    float layerT = t * (0.5 + i * 0.2) + i * 1.5;
    vec2 lp = kp * (1.0 + i * 0.5);
    lp *= rot(layerT * 0.3 * (mod(i, 2.0) == 0.0 ? 1.0 : -1.0));
    lp += vec2(sin(layerT * 0.7), cos(layerT * 0.5)) * 0.5;
    
    // Tile space
    vec2 tileP = fract(lp) - 0.5;
    vec2 tileId = floor(lp);
    
    // Different shapes per layer
    float shape;
    float layerMod = mod(i + floor(t * 0.1), 3.0);
    if (layerMod < 1.0) {
      shape = hexDist(tileP);
    } else if (layerMod < 2.0) {
      shape = triDist(tileP * rot(t * 0.5));
    } else {
      shape = starShape(tileP, 5.0 + i * 2.0, 0.3, 0.5);
    }
    
    // Edge glow
    float edge = smoothstep(0.3, 0.28, shape) - smoothstep(0.28, 0.26, shape);
    float fill = smoothstep(0.25, 0.0, shape);
    
    // Color per layer
    vec3 layerCol;
    if (i < 1.0) layerCol = uColor1;
    else if (i < 2.0) layerCol = uColor2;
    else if (i < 3.0) layerCol = uColor3;
    else layerCol = uColor4;
    
    // Audio reactivity per layer
    float react = 0.0;
    if (i < 1.0) react = uBassEnergy;
    else if (i < 2.0) react = uMidEnergy;
    else react = uHighEnergy;
    
    float brightness = fill * (0.5 + react * 0.8) + edge * (1.5 + react * 2.0);
    col += layerCol * brightness * (0.7 / (1.0 + i * 0.2));
  }
  
  // Radial fade
  float vignette = 1.0 - radius * 0.4;
  col *= max(0.0, vignette);
  
  // Transient flash
  col += vec3(uTransient * 0.3) * (1.0 - radius);
  
  col *= uIntensity;
  
  gl_FragColor = vec4(col, 1.0);
}
`;

export class GeoKaleidoscopeEffect implements VisualEffect {
  name = 'geoKaleidoscope';
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
        uComplexity: { value: 0.5 },
        uIntensity: { value: 1.0 },
        uColor1: { value: new THREE.Color('#ff0066') },
        uColor2: { value: new THREE.Color('#00ffcc') },
        uColor3: { value: new THREE.Color('#6600ff') },
        uColor4: { value: new THREE.Color('#ffcc00') },
        uAspect: { value: 1.0 },
        uSegments: { value: 8.0 },
        uLayers: { value: 3.0 },
        uZoom: { value: 3.0 },
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
    u.uComplexity.value = params.complexity;
    u.uIntensity.value = params.intensity;
    u.uColor1.value.set(params.colors[0]);
    u.uColor2.value.set(params.colors[1]);
    u.uColor3.value.set(params.colors[2]);
    u.uColor4.value.set(params.colors[3]);
    u.uAspect.value = window.innerWidth / window.innerHeight;
    u.uSegments.value = params.effectParams.segments ?? 8;
    u.uLayers.value = params.effectParams.layers ?? 3;
    u.uZoom.value = (params.effectParams.zoom ?? 3.0) + params.complexity * 2.0;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.mesh.parent?.remove(this.mesh);
  }
}
