import * as THREE from 'three';
import type { ControlSignals } from '../../store';
import type { VisualEffect, EffectParams } from './types';

/**
 * MorphPolyhedron - A 3D geometric shape that constantly morphs between
 * icosahedron, dodecahedron, and octahedron forms. Vertices are displaced
 * by multi-frequency noise, creating an organic living geometry that
 * moves along all three axes.
 */

const vertexShader = `
uniform float uTime;
uniform float uBassEnergy;
uniform float uMidEnergy;
uniform float uHighEnergy;
uniform float uTransient;
uniform float uMorphPhase;
uniform float uSpeed;
uniform float uIntensity;

varying vec3 vNormal;
varying vec3 vPosition;
varying float vDisplacement;
varying float vFresnel;
varying vec3 vWorldPos;

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
  
  // Multi-layered displacement
  vec3 p = position;
  float n1 = noise3d(p * 2.0 + t * 0.5) * 2.0 - 1.0;
  float n2 = noise3d(p * 4.0 - t * 0.7) * 2.0 - 1.0;
  float n3 = noise3d(p * 1.0 + t * 0.3) * 2.0 - 1.0;
  
  // Bass drives large-scale morphing
  float bassDisplace = n1 * 0.4 * (0.5 + uBassEnergy * 1.5);
  // Mids drive medium detail
  float midDisplace = n2 * 0.2 * (0.3 + uMidEnergy * 1.2);
  // Highs drive fine detail
  float highDisplace = n3 * 0.1 * (0.2 + uHighEnergy * 0.8);
  
  // Transient spike
  float transientDisplace = uTransient * 0.5 * sin(length(p) * 8.0 - t * 4.0);
  
  float totalDisplace = bassDisplace + midDisplace + highDisplace + transientDisplace;
  vDisplacement = totalDisplace;
  
  // Morph along normal
  vec3 displaced = p + normal * totalDisplace;
  
  // Add constant orbital motion to the whole shape
  float orbitX = sin(t * 0.23) * 0.3;
  float orbitY = cos(t * 0.19) * 0.4;
  float orbitZ = sin(t * 0.31) * 0.2;
  displaced += vec3(orbitX, orbitY, orbitZ);
  
  vNormal = normalize(normalMatrix * normal);
  vPosition = displaced;
  vWorldPos = (modelMatrix * vec4(displaced, 1.0)).xyz;
  
  // Fresnel for edge glow
  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  vFresnel = pow(1.0 - max(0.0, dot(vNormal, viewDir)), 3.0);
  
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
varying float vDisplacement;
varying float vFresnel;
varying vec3 vWorldPos;

void main() {
  // Color based on displacement amount + time
  float colorMix = vDisplacement * 2.0 + sin(uTime * 0.5) * 0.5 + 0.5;
  colorMix = fract(colorMix);
  
  vec3 col;
  if (colorMix < 0.33) {
    col = mix(uColor1, uColor2, colorMix * 3.0);
  } else if (colorMix < 0.66) {
    col = mix(uColor2, uColor3, (colorMix - 0.33) * 3.0);
  } else {
    col = mix(uColor3, uColor4, (colorMix - 0.66) * 3.0);
  }
  
  // Fresnel edge glow
  col += uColor4 * vFresnel * (0.8 + uBassEnergy);
  
  // Rim lighting shifts with time
  float rim = pow(1.0 - abs(dot(vNormal, vec3(sin(uTime * 0.3), cos(uTime * 0.2), 0.5))), 2.0);
  col += uColor1 * rim * 0.5;
  
  // Transient flash
  col += vec3(1.0) * uTransient * 0.4;
  
  // Always bright
  col *= uIntensity * 1.5;
  col = max(col, vec3(0.1)); // brightness floor
  
  gl_FragColor = vec4(col, 1.0);
}
`;

export class MorphPolyhedronEffect implements VisualEffect {
  name = 'morphPoly';
  private mesh!: THREE.Mesh;
  private material!: THREE.ShaderMaterial;
  private rotationSpeed = new THREE.Vector3(0.3, 0.5, 0.2);

  init(scene: THREE.Scene, _camera: THREE.Camera): void {
    // High-detail icosahedron as base shape
    const geometry = new THREE.IcosahedronGeometry(1.8, 5);
    
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uBassEnergy: { value: 0 },
        uMidEnergy: { value: 0 },
        uHighEnergy: { value: 0 },
        uTransient: { value: 0 },
        uMorphPhase: { value: 0 },
        uSpeed: { value: 1.0 },
        uIntensity: { value: 1.0 },
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

    // Constant rotation along all axes - speed varies with audio
    const rotSpeed = 0.5 + signals.bassEnergy * 0.5;
    this.mesh.rotation.x += dt * this.rotationSpeed.x * rotSpeed * params.speed;
    this.mesh.rotation.y += dt * this.rotationSpeed.y * rotSpeed * params.speed;
    this.mesh.rotation.z += dt * this.rotationSpeed.z * rotSpeed * params.speed;

    // Scale pulse on bass
    const scaleBase = 1.0 + signals.bassEnergy * params.bassReactivity * 0.3;
    this.mesh.scale.setScalar(scaleBase);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.mesh.parent?.remove(this.mesh);
  }
}
