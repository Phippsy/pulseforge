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

#define PI 3.14159265

void main() {
  vec2 uv = vUv;
  
  // Sky gradient: deep purple at top → hot pink/orange at horizon
  float skyGrad = uv.y;
  vec3 skyTop = vec3(0.02, 0.0, 0.08);
  vec3 skyMid = vec3(0.15, 0.0, 0.3);
  vec3 skyHorizon = vec3(0.8, 0.1, 0.4);
  vec3 skyOrange = vec3(1.0, 0.4, 0.1);
  
  vec3 sky = vec3(0.0);
  if (skyGrad > 0.7) {
    sky = mix(skyMid, skyTop, (skyGrad - 0.7) / 0.3);
  } else if (skyGrad > 0.5) {
    sky = mix(skyHorizon, skyMid, (skyGrad - 0.5) / 0.2);
  } else if (skyGrad > 0.4) {
    sky = mix(skyOrange, skyHorizon, (skyGrad - 0.4) / 0.1);
  }
  
  // Sun (large retro circle at horizon with horizontal line cuts)
  float horizon = 0.42;
  vec2 sunCenter = vec2(0.5, horizon + 0.12);
  float sunDist = length((uv - sunCenter) * vec2(uAspect, 1.0));
  float sunRadius = 0.15 + uBassEnergy * 0.02;
  float sun = smoothstep(sunRadius, sunRadius - 0.005, sunDist);
  
  // Sun horizontal stripes (classic 80s look)
  float stripes = 0.0;
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float stripeY = sunCenter.y - 0.02 - fi * 0.02;
    float stripeThick = 0.003 + fi * 0.002;
    float stripe = smoothstep(stripeY - stripeThick, stripeY, uv.y) *
                   smoothstep(stripeY + stripeThick, stripeY, uv.y);
    stripes += stripe;
  }
  sun *= (1.0 - stripes * 0.8);
  
  // Sun colour gradient (yellow top, magenta bottom)
  vec3 sunColor = mix(vec3(1.0, 0.0, 0.5), vec3(1.0, 0.9, 0.0), 
                       smoothstep(sunCenter.y - sunRadius, sunCenter.y + sunRadius, uv.y));
  
  vec3 col = sky + sunColor * sun;
  
  // Sun glow
  float sunGlow = exp(-sunDist * 4.0) * 0.4;
  col += vec3(1.0, 0.3, 0.6) * sunGlow;
  
  // === Ground grid (perspective) ===
  if (uv.y < horizon) {
    // Transform to perspective grid coordinates
    float groundY = (horizon - uv.y) / horizon; // 0 at horizon, 1 at bottom
    float perspective = 1.0 / (groundY + 0.001); // perspective depth
    
    float gridZ = perspective * 0.5; // depth
    float gridX = (uv.x - 0.5) * perspective * uAspect; // horizontal
    
    // Moving forward through the grid
    float speed = uTime * (1.5 + uBassEnergy * 2.0);
    gridZ += speed;
    
    // Grid lines
    float lineWidth = 0.03;
    
    // Horizontal lines (receding into distance)
    float hLine = smoothstep(lineWidth, 0.0, abs(fract(gridZ * 0.3) - 0.5) * 2.0 / (1.0 + groundY * 5.0));
    
    // Vertical lines
    float vLine = smoothstep(lineWidth, 0.0, abs(fract(gridX * 0.5) - 0.5) * 2.0 / (1.0 + groundY * 3.0));
    
    float grid = max(hLine, vLine);
    
    // Grid colour: neon cyan/magenta
    vec3 gridColor = mix(vec3(0.0, 1.0, 0.8), vec3(1.0, 0.0, 1.0), uv.x);
    gridColor *= 0.6 + uMidEnergy * 0.6;
    
    // Ground base (dark)
    vec3 ground = vec3(0.01, 0.0, 0.03);
    ground += gridColor * grid * (0.5 + 0.5 / (1.0 + groundY * 2.0)); // fade with distance
    
    // Horizon glow on ground
    float horizonGlow = exp(-groundY * 8.0) * 0.3;
    ground += vec3(0.8, 0.2, 0.6) * horizonGlow;
    
    col = ground;
  }
  
  // Stars (in sky only)
  if (uv.y > 0.55) {
    vec2 starUv = uv * vec2(uAspect * 20.0, 20.0);
    vec2 starId = floor(starUv);
    float starHash = fract(sin(dot(starId, vec2(127.1, 311.7))) * 43758.5453);
    float star = step(0.97, starHash) * (0.5 + 0.5 * sin(uTime * 3.0 + starHash * 6.28));
    col += vec3(star) * smoothstep(0.55, 0.8, uv.y);
  }
  
  // Neon mountain silhouettes at horizon
  float mountainX = uv.x * 8.0;
  float mountain1 = sin(mountainX * 0.7) * 0.03 + sin(mountainX * 1.5) * 0.015 + sin(mountainX * 3.0) * 0.008;
  float mountain2 = sin(mountainX * 0.5 + 2.0) * 0.04 + sin(mountainX * 1.2 + 1.0) * 0.02;
  
  float m1Edge = smoothstep(horizon + mountain1 + 0.005, horizon + mountain1, uv.y);
  float m2Edge = smoothstep(horizon + mountain2 - 0.02 + 0.005, horizon + mountain2 - 0.02, uv.y);
  
  // Mountain silhouette (dark) with neon edge
  col = mix(col, vec3(0.02, 0.0, 0.05), m1Edge * step(uv.y, horizon + 0.05));
  float m1Outline = smoothstep(0.008, 0.0, abs(uv.y - (horizon + mountain1))) * step(uv.y, horizon + 0.06);
  col += vec3(0.0, 0.8, 1.0) * m1Outline * 0.7;
  
  // Transient flash (lightning or laser beam)
  if (uTransient > 0.3) {
    float beam = smoothstep(0.01, 0.0, abs(uv.x - 0.5 + sin(uTime * 20.0) * 0.3));
    col += vec3(1.0, 0.0, 1.0) * beam * uTransient * step(horizon, uv.y);
  }
  
  // Scanlines (subtle CRT feel)
  float scanline = sin(uv.y * 400.0) * 0.04;
  col -= scanline;
  
  // Chromatic aberration at edges
  float edgeDist = length(uv - 0.5);
  col.r += edgeDist * 0.02;
  col.b -= edgeDist * 0.02;
  
  col *= uIntensity;
  gl_FragColor = vec4(col, 1.0);
}
`;

export class SynthwaveGridEffect implements VisualEffect {
  name = 'synthwave';
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
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.mesh.parent?.remove(this.mesh);
  }
}
