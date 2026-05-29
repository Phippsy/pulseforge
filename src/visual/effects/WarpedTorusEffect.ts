import * as THREE from 'three';
import type { ControlSignals } from '../../store';
import type { VisualEffect, EffectParams } from './types';

/**
 * WarpedTorusEffect - A torus knot geometry that constantly deforms, twists,
 * and morphs. Bass inflates it, mids twist it, highs add surface ripples.
 * The whole shape travels through space along all axes.
 */

const vertexShader = `
uniform float uTime;
uniform float uBassEnergy;
uniform float uMidEnergy;
uniform float uHighEnergy;
uniform float uTransient;
uniform float uSpeed;
uniform float uIntensity;
uniform float uTwist;

varying vec3 vNormal;
varying vec3 vPosition;
varying vec2 vUv;
varying float vDisplacement;

vec4 mod289v4(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 perm(vec4 x){return mod289v4(((x*34.0)+1.0)*x);}

float noise3d(vec3 p){
  vec3 a=floor(p);vec3 d=p-a;d=d*d*(3.0-2.0*d);
  vec4 b=a.xxyy+vec4(0,1,0,1);
  vec4 k1=perm(b.xyxy);vec4 k2=perm(k1.xyxy+b.zzww);
  vec4 c=k2+a.zzzz;vec4 k3=perm(c);vec4 k4=perm(c+1.0);
  vec4 o1=fract(k3*(1.0/41.0));vec4 o2=fract(k4*(1.0/41.0));
  vec4 o3=o2*d.z+o1*(1.0-d.z);
  vec2 o4=o3.yw*d.x+o3.xz*(1.0-d.x);
  return o4.y*d.y+o4.x*(1.0-d.y);
}

void main() {
  float t = uTime * uSpeed;
  vUv = uv;
  
  // Twist deformation based on position along tube
  float angle = uTwist * position.y * 2.0;
  float c = cos(angle);
  float s = sin(angle);
  vec3 twisted = vec3(
    position.x * c - position.z * s,
    position.y,
    position.x * s + position.z * c
  );
  
  // Multi-octave noise displacement
  float n1 = noise3d(twisted * 1.5 + t * 0.4) * 2.0 - 1.0;
  float n2 = noise3d(twisted * 3.0 - t * 0.6 + 10.0) * 2.0 - 1.0;
  float n3 = noise3d(twisted * 6.0 + t * 0.9 + 20.0) * 2.0 - 1.0;
  
  // Bass: large inflating pulsations
  float bassWarp = n1 * 0.35 * (0.4 + uBassEnergy * 2.0);
  // Mids: twisting / medium distortion
  float midWarp = n2 * 0.2 * (0.3 + uMidEnergy * 1.5);
  // Highs: fine ripples on surface
  float highWarp = n3 * 0.08 * (0.2 + uHighEnergy * 1.0);
  
  float totalDisplace = bassWarp + midWarp + highWarp;
  totalDisplace += uTransient * 0.4 * sin(length(twisted) * 6.0 - t * 5.0);
  
  vDisplacement = totalDisplace;
  
  vec3 displaced = twisted + normal * totalDisplace;
  
  // Constant drift through space
  displaced.x += sin(t * 0.17) * 0.4 + cos(t * 0.31) * 0.2;
  displaced.y += cos(t * 0.13) * 0.3 + sin(t * 0.41) * 0.15;
  displaced.z += sin(t * 0.23) * 0.3;
  
  vNormal = normalize(normalMatrix * normal);
  vPosition = displaced;
  
  gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
}
`;

const fragmentShader = `
uniform float uTime;
uniform float uBassEnergy;
uniform float uMidEnergy;
uniform float uHighEnergy;
uniform float uTransient;
uniform float uIntensity;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec3 uColor4;

varying vec3 vNormal;
varying vec3 vPosition;
varying vec2 vUv;
varying float vDisplacement;

void main() {
  // Flowing color bands along UV + time
  float colorParam = fract(vUv.x * 3.0 + vUv.y * 2.0 + uTime * 0.15 + vDisplacement);
  
  vec3 col;
  if (colorParam < 0.25) {
    col = mix(uColor1, uColor2, colorParam * 4.0);
  } else if (colorParam < 0.5) {
    col = mix(uColor2, uColor3, (colorParam - 0.25) * 4.0);
  } else if (colorParam < 0.75) {
    col = mix(uColor3, uColor4, (colorParam - 0.5) * 4.0);
  } else {
    col = mix(uColor4, uColor1, (colorParam - 0.75) * 4.0);
  }
  
  // Iridescent shifting based on view angle
  float iridescence = sin(dot(vNormal, vec3(1, 0, 0)) * 6.28 + uTime * 0.8) * 0.5 + 0.5;
  col = mix(col, uColor3, iridescence * 0.3);
  
  // Bass energy glow
  col += uColor1 * uBassEnergy * 0.4;
  
  // Surface highlight from displacement
  float highlight = abs(vDisplacement) * 2.0;
  col += vec3(1.0) * highlight * 0.3;
  
  // Transient flash
  col += vec3(1.0, 0.9, 0.8) * uTransient * 0.5;
  
  // Intensity + brightness floor
  col *= uIntensity * 1.4;
  col = max(col, vec3(0.08));
  
  gl_FragColor = vec4(col, 1.0);
}
`;

export class WarpedTorusEffect implements VisualEffect {
  name = 'warpedTorus';
  private mesh!: THREE.Mesh;
  private material!: THREE.ShaderMaterial;
  private twistTarget = 0;
  private twistCurrent = 0;

  init(scene: THREE.Scene, _camera: THREE.Camera): void {
    // TorusKnot gives us a more interesting topology to warp
    const geometry = new THREE.TorusKnotGeometry(1.2, 0.4, 200, 32, 3, 5);
    
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uBassEnergy: { value: 0 },
        uMidEnergy: { value: 0 },
        uHighEnergy: { value: 0 },
        uTransient: { value: 0 },
        uSpeed: { value: 1.0 },
        uIntensity: { value: 1.0 },
        uTwist: { value: 0.0 },
        uColor1: { value: new THREE.Color('#FF00FF') },
        uColor2: { value: new THREE.Color('#00FFFF') },
        uColor3: { value: new THREE.Color('#FF8800') },
        uColor4: { value: new THREE.Color('#FFFFFF') },
      },
      vertexShader,
      fragmentShader,
      wireframe: false,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    scene.add(this.mesh);
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

    // Constantly changing twist amount - smooth interpolation
    this.twistTarget = Math.sin(time * 0.2) * 1.5 + signals.midEnergy * 2.0;
    this.twistCurrent += (this.twistTarget - this.twistCurrent) * dt * 2.0;
    u.uTwist.value = this.twistCurrent;

    // Constant rotation - multi-axis, speed reactive to audio
    const rotMult = 0.4 + signals.bassEnergy * 0.4;
    this.mesh.rotation.x += dt * 0.3 * rotMult * params.speed;
    this.mesh.rotation.y += dt * 0.5 * rotMult * params.speed;
    this.mesh.rotation.z += dt * 0.15 * rotMult * params.speed;

    // Breathing scale
    const scale = 1.0 + signals.bassEnergy * params.bassReactivity * 0.25 + Math.sin(time * 0.4) * 0.05;
    this.mesh.scale.setScalar(scale);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.mesh.parent?.remove(this.mesh);
  }
}
