import * as THREE from 'three';
import type { ControlSignals } from '../../store';
import type { VisualEffect, EffectParams } from './types';

const vertexShader = `
uniform float uTime;
uniform float uBassEnergy;
uniform float uMidEnergy;
uniform float uHighEnergy;
uniform float uTransient;
uniform float uNoiseScale;
uniform float uNoiseSpeed;
uniform float uDeformAmount;
uniform float uIntensity;

varying vec3 vNormal;
varying float vDisplacement;
varying vec3 vPosition;
varying vec3 vWorldPos;
varying float vFresnel;

// 3D noise using permutation
vec4 mod289v4(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 perm(vec4 x){return mod289v4(((x*34.0)+1.0)*x);}

float noise3d(vec3 p){
  vec3 a = floor(p);
  vec3 d = p - a;
  d = d * d * (3.0 - 2.0 * d);
  vec4 b = a.xxyy + vec4(0.0,1.0,0.0,1.0);
  vec4 k1 = perm(b.xyxy);
  vec4 k2 = perm(k1.xyxy + b.zzww);
  vec4 c = k2 + a.zzzz;
  vec4 k3 = perm(c);
  vec4 k4 = perm(c + 1.0);
  vec4 o1 = fract(k3 * (1.0/41.0));
  vec4 o2 = fract(k4 * (1.0/41.0));
  vec4 o3 = o2 * d.z + o1 * (1.0-d.z);
  vec2 o4 = o3.yw * d.x + o3.xz * (1.0-d.x);
  return o4.y * d.y + o4.x * (1.0-d.y);
}

float fbm3(vec3 p) {
  float f = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 5; i++) {
    f += amp * noise3d(p);
    p *= 2.03;
    amp *= 0.5;
  }
  return f;
}

void main() {
  vNormal = normalize(normalMatrix * normal);
  vPosition = position;

  float t = uTime * uNoiseSpeed;
  
  // Multi-frequency deformation layers
  // Layer 1: Large slow organic movement (bass)
  float n1 = fbm3(position * uNoiseScale * 0.5 + t * 0.3) * uBassEnergy * 2.5;
  
  // Layer 2: Medium detail (mid)
  float n2 = fbm3(position * uNoiseScale * 1.5 + t * 0.7 + 10.0) * uMidEnergy * 1.5;
  
  // Layer 3: Fine surface shimmer (high)
  float n3 = noise3d(position * uNoiseScale * 4.0 + t * 2.0 + 20.0) * uHighEnergy * 0.8;
  
  // Layer 4: Transient spike - sharp deformation burst
  float spike = uTransient * noise3d(position * uNoiseScale * 3.0 + t * 5.0) * 2.0;
  
  // Layer 5: Slow breathing independent of audio (keeps it alive in silence)
  float breath = sin(t * 0.5 + position.y * 2.0) * 0.15 + sin(t * 0.3 + position.x * 1.5) * 0.1;
  
  float displacement = (n1 + n2 + n3 + spike + breath) * uDeformAmount;
  vDisplacement = displacement;

  vec3 newPos = position + normal * displacement;
  vWorldPos = (modelMatrix * vec4(newPos, 1.0)).xyz;
  
  // Fresnel calculation
  vec4 mvPos = modelViewMatrix * vec4(newPos, 1.0);
  vec3 viewDir = normalize(-mvPos.xyz);
  vFresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 3.0);
  
  gl_Position = projectionMatrix * mvPos;
}
`;

const fragmentShader = `
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec3 uColor4;
uniform float uGlowIntensity;
uniform float uBassEnergy;
uniform float uHighEnergy;
uniform float uTransient;
uniform float uTime;
uniform float uIntensity;

varying vec3 vNormal;
varying float vDisplacement;
varying vec3 vPosition;
varying vec3 vWorldPos;
varying float vFresnel;

// Iridescence based on view angle and normal
vec3 iridescence(float cosTheta, float time) {
  float hue = cosTheta * 2.0 + time * 0.1;
  vec3 a = vec3(0.5, 0.5, 0.5);
  vec3 b = vec3(0.5, 0.5, 0.5);
  vec3 c = vec3(1.0, 1.0, 1.0);
  vec3 d = vec3(0.00, 0.33, 0.67);
  return a + b * cos(6.28318 * (c * hue + d));
}

void main() {
  // Displacement-based colour mapping
  float d = vDisplacement;
  float dNorm = d * 1.5 + 0.5;
  
  // 4-colour gradient based on displacement
  vec3 col;
  if (dNorm < 0.33) {
    col = mix(uColor3, uColor2, dNorm * 3.0);
  } else if (dNorm < 0.66) {
    col = mix(uColor2, uColor1, (dNorm - 0.33) * 3.0);
  } else {
    col = mix(uColor1, uColor4, (dNorm - 0.66) * 3.0);
  }
  
  // Iridescent overlay based on viewing angle
  float cosTheta = dot(normalize(vNormal), normalize(vPosition));
  vec3 iri = iridescence(cosTheta, uTime);
  col = mix(col, iri, 0.2 + uHighEnergy * 0.3);
  
  // Sub-surface scattering fake
  float sss = exp(-abs(d) * 3.0) * 0.3;
  col += uColor2 * sss;
  
  // Fresnel rim glow with shifting colour
  vec3 rimColor = mix(uColor1, uColor4, sin(uTime * 0.5) * 0.5 + 0.5);
  rimColor = mix(rimColor, iri, 0.3);
  col += vFresnel * rimColor * uGlowIntensity * (1.0 + uHighEnergy * 1.5);
  
  // Hot spots where deformation peaks
  float peak = smoothstep(0.8, 1.2, abs(d));
  col += peak * uColor1 * 0.6 * (1.0 + uBassEnergy);
  
  // Transient flash at surface with white-hot center
  col += uTransient * 0.5 * mix(uColor1, vec3(1.0, 0.95, 0.9), 0.6);
  
  // Pulsating internal glow
  float pulse = sin(uTime * 2.0 + vPosition.y * 3.0) * 0.5 + 0.5;
  float pulse2 = sin(uTime * 1.3 + vPosition.x * 4.0 + vPosition.z * 2.0) * 0.5 + 0.5;
  col += pulse * uColor3 * 0.1 * uBassEnergy;
  col += pulse2 * uColor4 * 0.05 * uHighEnergy;
  
  // Displacement-based emission lines (like veins of energy)
  float veinPattern = abs(sin(d * 15.0 + uTime * 2.0));
  float veins = smoothstep(0.95, 1.0, veinPattern);
  col += veins * uColor1 * 0.4 * (uBassEnergy + uHighEnergy);
  
  // Overall intensity
  col *= 0.6 + uIntensity * 0.8;
  
  // Tone mapping
  col = col / (1.0 + col * 0.5);
  
  gl_FragColor = vec4(col, 1.0);
}
`;

export class BlobOrb implements VisualEffect {
  name = 'blob';
  private mesh: THREE.Mesh | null = null;
  private material: THREE.ShaderMaterial | null = null;
  private innerMesh: THREE.Mesh | null = null;

  init(scene: THREE.Scene, _camera: THREE.Camera): void {
    // Main orb
    const geo = new THREE.IcosahedronGeometry(2, 6);

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uBassEnergy: { value: 0 },
        uMidEnergy: { value: 0 },
        uHighEnergy: { value: 0 },
        uTransient: { value: 0 },
        uNoiseScale: { value: 1.5 },
        uNoiseSpeed: { value: 0.3 },
        uDeformAmount: { value: 0.6 },
        uGlowIntensity: { value: 0.8 },
        uIntensity: { value: 0.7 },
        uColor1: { value: new THREE.Color('#E94560') },
        uColor2: { value: new THREE.Color('#0F3460') },
        uColor3: { value: new THREE.Color('#16213E') },
        uColor4: { value: new THREE.Color('#1A1A2E') },
      },
    });

    this.mesh = new THREE.Mesh(geo, this.material);
    scene.add(this.mesh);

    // Inner glowing core
    const innerGeo = new THREE.IcosahedronGeometry(1.2, 4);
    const innerMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#E94560'),
      transparent: true,
      opacity: 0.15,
      blending: THREE.AdditiveBlending,
    });
    this.innerMesh = new THREE.Mesh(innerGeo, innerMat);
    scene.add(this.innerMesh);
  }

  update(signals: ControlSignals, params: EffectParams, _dt: number, time: number): void {
    if (!this.material) return;
    const u = this.material.uniforms;
    u.uTime.value = time;
    u.uBassEnergy.value = signals.bassEnergy * params.bassReactivity;
    u.uMidEnergy.value = signals.midEnergy * params.midReactivity;
    u.uHighEnergy.value = signals.highEnergy * params.highReactivity;
    u.uTransient.value = signals.transientPulse * params.onsetReactivity;
    u.uNoiseScale.value = params.effectParams.noiseScale ?? 1.5;
    u.uNoiseSpeed.value = params.effectParams.noiseSpeed ?? 0.3;
    u.uDeformAmount.value = params.effectParams.deformAmount ?? 0.6;
    u.uGlowIntensity.value = params.effectParams.glowIntensity ?? 0.8;
    u.uIntensity.value = params.intensity;
    u.uColor1.value.set(params.colors[0]);
    u.uColor2.value.set(params.colors[1]);
    u.uColor3.value.set(params.colors[2]);
    u.uColor4.value.set(params.colors[3]);

    if (this.mesh) {
      this.mesh.rotation.y += 0.003 * params.speed * (1 + signals.midEnergy * 0.5);
      this.mesh.rotation.x += 0.001 * params.speed;
      // Gentle scale pulse on bass
      const scale = 1.0 + signals.bassPulse * params.bassReactivity * 0.1;
      this.mesh.scale.setScalar(scale);
    }

    if (this.innerMesh) {
      this.innerMesh.rotation.y -= 0.005 * params.speed;
      this.innerMesh.rotation.z += 0.003 * params.speed;
      const innerScale = 1.0 + signals.bassPulse * 0.3;
      this.innerMesh.scale.setScalar(innerScale);
      const mat = this.innerMesh.material as THREE.MeshBasicMaterial;
      mat.color.set(params.colors[0]);
      mat.opacity = 0.1 + signals.bassEnergy * 0.2;
    }
  }

  dispose(): void {
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh.parent?.remove(this.mesh);
    }
    if (this.innerMesh) {
      this.innerMesh.geometry.dispose();
      (this.innerMesh.material as THREE.Material).dispose();
      this.innerMesh.parent?.remove(this.innerMesh);
    }
    if (this.material) this.material.dispose();
    this.mesh = null;
    this.innerMesh = null;
    this.material = null;
  }
}
