import * as THREE from 'three';
import type { ControlSignals } from '../../store';
import type { VisualEffect, EffectParams } from './types';

/**
 * Fireworks 50 - Birthday fireworks that explode into "50" shapes
 * Multiple firework rockets launch and burst into colour on beats
 * Some bursts form the number 50, others are classic starburst patterns
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
uniform float uIntensity;
uniform float uSpeed;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec3 uColor4;

float hash(float n) { return fract(sin(n) * 43758.5453); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

// Check if point is inside "5" shape
float inDigit5(vec2 p) {
  // Normalised 0-1 coords
  if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0) return 0.0;
  float x = p.x, y = p.y;
  // Top bar
  if (y > 0.85 && x >= 0.1 && x <= 0.9) return 1.0;
  // Left bar top
  if (y > 0.5 && y <= 0.85 && x >= 0.1 && x <= 0.3) return 1.0;
  // Middle bar
  if (y > 0.45 && y <= 0.55 && x >= 0.1 && x <= 0.9) return 1.0;
  // Right bar bottom
  if (y >= 0.15 && y <= 0.45 && x >= 0.7 && x <= 0.9) return 1.0;
  // Bottom bar
  if (y >= 0.1 && y < 0.2 && x >= 0.1 && x <= 0.9) return 1.0;
  return 0.0;
}

// Check if point is inside "0" shape
float inDigit0(vec2 p) {
  if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0) return 0.0;
  float x = p.x, y = p.y;
  // Outer boundary
  float outer = step(0.1, x) * step(x, 0.9) * step(0.1, y) * step(y, 0.9);
  // Inner hole
  float inner = step(0.3, x) * step(x, 0.7) * step(0.25, y) * step(y, 0.75);
  return outer * (1.0 - inner);
}

void main() {
  vec2 uv = vUv;
  float t = uTime * uSpeed;
  
  vec3 col = vec3(0.0);
  
  // Dark sky background with subtle gradient
  col = mix(vec3(0.0, 0.0, 0.02), vec3(0.02, 0.0, 0.05), uv.y);
  
  // Stars twinkling in background
  vec2 starUv = uv * 50.0;
  vec2 starCell = floor(starUv);
  float starBright = step(0.96, hash2(starCell));
  float twinkle = sin(t * 2.0 + hash2(starCell) * 20.0) * 0.5 + 0.5;
  col += vec3(0.5, 0.5, 0.7) * starBright * twinkle * 0.2;
  
  // Multiple fireworks (5 simultaneous)
  for (float i = 0.0; i < 5.0; i++) {
    // Each firework has its own lifecycle
    float fireId = i;
    float cycleTime = 3.0 + hash(fireId * 7.7) * 2.0; // 3-5 seconds per cycle
    float localT = mod(t + hash(fireId * 3.3) * cycleTime, cycleTime);
    
    // Stagger based on bass energy
    float triggerDelay = hash(fireId * 5.5 + floor(t / cycleTime)) * 0.5;
    localT -= triggerDelay * (1.0 - uBassEnergy);
    if (localT < 0.0) continue;
    
    // Launch position (random X, from bottom)
    float launchX = 0.15 + hash(fireId * 11.0 + floor(t / cycleTime)) * 0.7;
    float burstY = 0.5 + hash(fireId * 9.0 + floor(t / cycleTime)) * 0.35;
    vec2 burstPos = vec2(launchX, burstY);
    
    // Phase: 0-0.3 = rising, 0.3-1.0 = exploding
    float risePhase = smoothstep(0.0, 0.3, localT / cycleTime);
    float explodePhase = smoothstep(0.3, 0.4, localT / cycleTime);
    float fadePhase = smoothstep(0.4, 1.0, localT / cycleTime);
    
    // Rising trail
    if (risePhase < 1.0) {
      vec2 rocketPos = vec2(launchX, risePhase * burstY);
      float rocketDist = length(uv - rocketPos);
      float rocket = exp(-rocketDist * rocketDist * 8000.0);
      col += vec3(1.0, 0.8, 0.3) * rocket * (1.0 - explodePhase);
      
      // Trail sparks
      for (float s = 0.0; s < 5.0; s++) {
        float sparkT = risePhase - s * 0.05;
        if (sparkT < 0.0) continue;
        vec2 sparkPos = vec2(launchX + sin(s * 3.0 + t * 10.0) * 0.003, sparkT * burstY);
        float sparkDist = length(uv - sparkPos);
        float spark = exp(-sparkDist * sparkDist * 15000.0) * (1.0 - s / 5.0);
        col += vec3(1.0, 0.6, 0.1) * spark * 0.5;
      }
    }
    
    // Explosion!
    if (explodePhase > 0.0) {
      float explodeAge = (localT / cycleTime - 0.3) / 0.7;
      float fade = 1.0 - fadePhase;
      fade = fade * fade; // Quadratic fade for nice falloff
      
      // Firework colour
      float colorSeed = hash(fireId * 17.0 + floor(t / cycleTime));
      vec3 fireColor;
      if (colorSeed < 0.25) fireColor = uColor1;
      else if (colorSeed < 0.5) fireColor = uColor2;
      else if (colorSeed < 0.75) fireColor = uColor3;
      else fireColor = uColor4;
      
      // Is this a "50" firework? (every 3rd-4th one)
      float is50 = step(0.7, hash(fireId * 2.2 + floor(t / cycleTime)));
      
      if (is50 > 0.5) {
        // "50" shaped burst — render digits as solid glowing shapes
        float burstScale = 0.08 + explodeAge * 0.02;
        vec2 relPos = (uv - burstPos) / burstScale;
        
        // "5" occupies x: -1.05 to -0.05, "0" occupies x: 0.05 to 1.05
        // Both occupy y: -0.5 to 0.5
        vec2 d5pos = vec2(relPos.x + 1.05, relPos.y + 0.5);
        vec2 d0pos = vec2(relPos.x - 0.05, relPos.y + 0.5);
        
        float in5 = inDigit5(d5pos);
        float in0 = inDigit0(d0pos);
        float inDigits = max(in5, in0);
        
        // Solid bright fill
        col += fireColor * inDigits * fade * 3.0;
        
        // White hot core for readability
        col += vec3(1.0) * inDigits * fade * 1.2;
        
        // Soft outer glow around the whole "50"
        float glowDist = length(relPos);
        float glow = exp(-glowDist * glowDist * 1.5) * fade * 0.3;
        col += fireColor * glow;
      } else {
        // Classic starburst - particles flying outward
        float numParticles = 18.0 + uBassEnergy * 8.0;
        for (float p = 0.0; p < 26.0; p++) {
          if (p >= numParticles) break;
          float angle = p * 6.2831853 / numParticles + hash(p + fireId) * 0.3;
          float speed = 0.2 + hash(p * 3.0 + fireId) * 0.3;
          float gravity = explodeAge * explodeAge * 0.2;
          
          vec2 particlePos = burstPos + vec2(
            cos(angle) * speed * explodeAge,
            sin(angle) * speed * explodeAge - gravity
          );
          
          float dist = length(uv - particlePos);
          // Very tight gaussian — sharp dots
          float particle = exp(-dist * dist * 25000.0);
          
          // Colour variation per particle
          vec3 pCol = mix(fireColor, vec3(1.0), hash(p * 7.0) * 0.3);
          col += pCol * particle * fade * 1.5;
          
          // Trailing sparks
          vec2 trailPos = particlePos - vec2(cos(angle), sin(angle) - gravity * 0.5) * 0.01;
          float trailDist = length(uv - trailPos);
          col += pCol * 0.3 * exp(-trailDist * trailDist * 40000.0) * fade;
        }
      }
    }
  }
  
  // Ground reflection (bottom 15%)
  if (uv.y < 0.15) {
    vec2 mirrorUv = vec2(uv.x, 0.15 - uv.y + 0.15);
    // Simple reflection approximation - just brighten the bottom
    col += col * 0.1 * (1.0 - uv.y / 0.15);
  }
  
  // Transient boost - extra brightness flash on all active fireworks
  col += col * uTransient * 0.5;
  
  // Subtle vignette
  float vignette = 1.0 - dot((uv - 0.5) * 0.8, (uv - 0.5) * 0.8);
  col *= vignette;
  
  col *= uIntensity;
  
  gl_FragColor = vec4(col, 1.0);
}
`;

export class FireworksEffect implements VisualEffect {
  name = 'fireworks';
  private mesh!: THREE.Mesh;
  private material!: THREE.ShaderMaterial;

  init(scene: THREE.Scene): void {
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uBassEnergy: { value: 0 },
        uMidEnergy: { value: 0 },
        uHighEnergy: { value: 0 },
        uTransient: { value: 0 },
        uIntensity: { value: 1.0 },
        uSpeed: { value: 1.0 },
        uColor1: { value: new THREE.Color('#ff3366') },
        uColor2: { value: new THREE.Color('#ffcc00') },
        uColor3: { value: new THREE.Color('#00ffcc') },
        uColor4: { value: new THREE.Color('#ff66ff') },
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
    u.uSpeed.value = params.speed;
    u.uColor1.value.set(params.colors[0]);
    u.uColor2.value.set(params.colors[1]);
    u.uColor3.value.set(params.colors[2]);
    u.uColor4.value.set(params.colors[3]);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.mesh.parent?.remove(this.mesh);
  }
}
