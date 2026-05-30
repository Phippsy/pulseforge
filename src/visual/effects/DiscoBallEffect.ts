import * as THREE from 'three';
import type { ControlSignals } from '../../store';
import type { VisualEffect, EffectParams } from './types';

/**
 * Disco Ball - Classic mirror ball with sweeping light beams
 * Perfect 80s party vibes for DanFest. Bass pulses the rotation,
 * beats trigger light beam sweeps, colour-cycling reflections
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

// Disco ball facet pattern (spherical mapping with facets)
float discoBallFacets(vec2 uv, float time) {
  // Convert to spherical-ish coords
  vec2 centered = (uv - 0.5) * 2.0;
  float r = length(centered);
  if (r > 1.0) return 0.0;
  
  // Sphere surface
  float z = sqrt(1.0 - r * r);
  vec3 pos = vec3(centered, z);
  
  // Rotate the ball
  float rotSpeed = time * 0.5;
  float cs = cos(rotSpeed);
  float sn = sin(rotSpeed);
  pos.xz = vec2(pos.x * cs - pos.z * sn, pos.x * sn + pos.z * cs);
  
  // Facet grid (latitude/longitude)
  float lat = asin(pos.y) * 8.0;
  float lon = atan(pos.z, pos.x) * 8.0;
  
  // Grid cells
  vec2 cell = floor(vec2(lon, lat));
  vec2 cellUv = fract(vec2(lon, lat));
  
  // Facet brightness based on angle to "spotlight"
  float facetAngle = hash2(cell) * 6.28 + time * 2.0;
  float reflection = pow(max(0.0, cos(facetAngle)), 8.0);
  
  // Edge highlight between facets
  float edge = smoothstep(0.0, 0.05, cellUv.x) * smoothstep(1.0, 0.95, cellUv.x) *
               smoothstep(0.0, 0.05, cellUv.y) * smoothstep(1.0, 0.95, cellUv.y);
  
  return reflection * edge;
}

void main() {
  vec2 uv = vUv;
  float t = uTime * uSpeed;
  
  // Dark background with subtle colour
  vec3 col = vec3(0.02, 0.01, 0.04);
  
  // Rotation speed increases gently with bass
  float rotTime = t * (0.6 + uBassEnergy * 0.6);
  
  // === DISCO BALL (centered, upper portion) ===
  float ballSize = 0.25;
  vec2 ballCenter = vec2(0.5, 0.6);
  vec2 ballUv = (uv - ballCenter) / ballSize + 0.5;
  float ballDist = length(uv - ballCenter) / ballSize;
  
  if (ballDist < 1.0) {
    vec2 centered = (ballUv - 0.5) * 2.0;
    float r = length(centered);
    float z = sqrt(max(0.0, 1.0 - r * r));
    vec3 pos = vec3(centered, z);
    
    // Rotate
    float cs = cos(rotTime);
    float sn = sin(rotTime);
    pos.xz = vec2(pos.x * cs - pos.z * sn, pos.x * sn + pos.z * cs);
    
    // Second rotation axis
    float cs2 = cos(rotTime * 0.3);
    float sn2 = sin(rotTime * 0.3);
    pos.yz = vec2(pos.y * cs2 - pos.z * sn2, pos.y * sn2 + pos.z * cs2);
    
    // Facet grid
    float latCount = 12.0;
    float lonCount = 20.0;
    float lat = asin(pos.y) / 1.5708 * latCount;
    float lon = atan(pos.z, pos.x) / 6.2832 * lonCount;
    
    vec2 cell = floor(vec2(lon, lat));
    vec2 cellUv = fract(vec2(lon, lat));
    
    // Each facet has its own reflection timing
    float facetId = hash2(cell);
    float reflectionPhase = facetId * 6.28 + rotTime * 1.5;
    float reflection = pow(max(0.0, sin(reflectionPhase)), 12.0);
    
    // Gentle boost on transient
    reflection += uTransient * step(0.85, facetId) * 0.8;
    
    // Facet edges (silver border between mirrors)
    float edgeX = smoothstep(0.0, 0.08, cellUv.x) * smoothstep(1.0, 0.92, cellUv.x);
    float edgeY = smoothstep(0.0, 0.08, cellUv.y) * smoothstep(1.0, 0.92, cellUv.y);
    float edge = edgeX * edgeY;
    
    // Base mirror colour (silver)
    vec3 mirrorCol = vec3(0.4, 0.4, 0.45);
    // Reflected colour (cycling with music)
    float colorPhase = facetId * 4.0 + t;
    vec3 reflCol;
    float cp = mod(colorPhase, 4.0);
    if (cp < 1.0) reflCol = uColor1;
    else if (cp < 2.0) reflCol = uColor2;
    else if (cp < 3.0) reflCol = uColor3;
    else reflCol = uColor4;
    
    vec3 facetCol = mix(mirrorCol, reflCol, reflection) * edge;
    
    // Specular highlight
    float spec = pow(max(0.0, dot(normalize(pos), normalize(vec3(0.3, 0.5, 1.0)))), 32.0);
    facetCol += vec3(1.0) * spec * 0.3;
    
    // Sphere shading
    float shading = 0.6 + 0.4 * dot(normalize(pos), normalize(vec3(0.0, 0.3, 1.0)));
    facetCol *= shading;
    
    col = facetCol;
    
    // Edge glow of ball
    float rim = pow(1.0 - z, 3.0);
    col += vec3(0.3, 0.3, 0.5) * rim * 0.5;
  }
  
  // Ball outer glow
  float glowDist = length(uv - ballCenter);
  float outerGlow = exp(-glowDist * glowDist * 8.0) * 0.15;
  col += vec3(0.5, 0.5, 0.7) * outerGlow;
  
  // === LIGHT BEAMS sweeping from ball ===
  float numBeams = 12.0;
  for (float i = 0.0; i < 12.0; i++) {
    float beamAngle = i * 6.2832 / numBeams + rotTime * 0.8 + sin(t * 0.4 + i) * 0.3;
    beamAngle += uBassEnergy * sin(t * 1.5 + i * 2.0) * 0.15;
    
    vec2 beamDir = vec2(cos(beamAngle), sin(beamAngle));
    vec2 toPixel = uv - ballCenter;
    
    // Distance from pixel to beam line
    float along = dot(toPixel, beamDir);
    float perp = abs(toPixel.x * beamDir.y - toPixel.y * beamDir.x);
    
    // Only draw beam going outward from ball
    if (along > ballSize * 0.8) {
      // Beam width (spreads slightly with distance)
      float beamWidth = 0.003 + along * 0.02;
      float beam = exp(-perp * perp / (beamWidth * beamWidth));
      
      // Fade with distance
      float distFade = exp(-along * 1.5);
      
      // Colour per beam
      float beamColorId = mod(i + floor(t * 2.0), 4.0);
      vec3 beamCol;
      if (beamColorId < 1.0) beamCol = uColor1;
      else if (beamColorId < 2.0) beamCol = uColor2;
      else if (beamColorId < 3.0) beamCol = uColor3;
      else beamCol = uColor4;
      
      // Pulse beam brightness with mid energy
      float pulse = 0.5 + uMidEnergy * 0.5 + uHighEnergy * 0.3;
      
      col += beamCol * beam * distFade * pulse * 0.6;
    }
  }
  
  // === FLOOR REFLECTIONS (bottom portion) ===
  if (uv.y < 0.3) {
    float floorY = (0.3 - uv.y) / 0.3;
    
    // Scattered light spots on the floor
    for (float i = 0.0; i < 20.0; i++) {
      float spotAngle = i * 3.17 + rotTime * 1.0 + hash(i * 5.5) * 6.28;
      float spotRadius = 0.1 + hash(i * 3.0) * 0.3;
      vec2 spotPos = vec2(
        0.5 + cos(spotAngle) * spotRadius,
        0.15 + sin(spotAngle * 0.5) * 0.1
      );
      
      float spotDist = length(uv - spotPos);
      float spot = exp(-spotDist * spotDist * 200.0);
      
      float colorId = mod(i + floor(t * 1.5), 4.0);
      vec3 spotCol;
      if (colorId < 1.0) spotCol = uColor1;
      else if (colorId < 2.0) spotCol = uColor2;
      else if (colorId < 3.0) spotCol = uColor3;
      else spotCol = uColor4;
      
      col += spotCol * spot * (0.3 + uBassEnergy * 0.5);
    }
  }
  
  // Sparkle dust (calmer)
  vec2 sparkleUv = uv * 30.0;
  vec2 sparkleCell = floor(sparkleUv);
  float sparkle = step(0.97, hash2(sparkleCell + floor(t * 0.8) * 0.1));
  float sparkleBright = sin(t * 3.0 + hash2(sparkleCell) * 30.0) * 0.5 + 0.5;
  col += vec3(1.0) * sparkle * sparkleBright * 0.1;
  
  // Gentle transient glow (no strobe)
  col += vec3(0.05) * uTransient;
  
  col *= uIntensity;
  
  gl_FragColor = vec4(col, 1.0);
}
`;

export class DiscoBallEffect implements VisualEffect {
  name = 'discoBall';
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
        uColor1: { value: new THREE.Color('#ff0066') },
        uColor2: { value: new THREE.Color('#00ccff') },
        uColor3: { value: new THREE.Color('#ffcc00') },
        uColor4: { value: new THREE.Color('#cc00ff') },
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
