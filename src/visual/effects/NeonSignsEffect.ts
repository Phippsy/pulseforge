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

// Hash functions
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float hash1(float n) { return fract(sin(n) * 43758.5453); }

// Noise
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Line segment SDF
#define LINE(p, a, b) (length((p) - (a) - clamp(dot((p)-(a), (b)-(a)) / dot((b)-(a),(b)-(a)), 0.0, 1.0) * ((b)-(a))))

// Multi-layered neon glow — inner bright core + medium spread + wide atmospheric
vec3 neonTube(float dist, vec3 color, float brightness) {
  vec3 col = vec3(0.0);
  // Inner white-hot core
  col += vec3(1.0, 1.0, 1.0) * smoothstep(0.02, 0.0, dist) * brightness * 1.5;
  // Near glow (saturated color)
  col += color * 1.8 * exp(-dist * 25.0) * brightness;
  // Medium glow spread
  col += color * 0.6 * exp(-dist * 8.0) * brightness;
  // Wide atmospheric bloom
  col += color * 0.15 * exp(-dist * 2.5) * brightness;
  return col;
}

// 7-segment digit — returns SDF distance
float digitSDF(vec2 p, int n) {
  float hw = 0.35;
  float vh = 0.4;
  float d = 999.0;
  
  // Segments: A(top), B(top-right), C(bot-right), D(bot), E(bot-left), F(top-left), G(mid)
  if (n==0||n==2||n==3||n==5||n==6||n==7||n==8||n==9) d = min(d, LINE(p, vec2(-hw, vh), vec2(hw, vh))); // A
  if (n==0||n==1||n==2||n==3||n==4||n==7||n==8||n==9) d = min(d, LINE(p, vec2(hw, vh), vec2(hw, 0.0))); // B
  if (n==0||n==1||n==3||n==4||n==5||n==6||n==7||n==8||n==9) d = min(d, LINE(p, vec2(hw, 0.0), vec2(hw, -vh))); // C
  if (n==0||n==2||n==3||n==5||n==6||n==8||n==9) d = min(d, LINE(p, vec2(-hw, -vh), vec2(hw, -vh))); // D
  if (n==0||n==2||n==6||n==8) d = min(d, LINE(p, vec2(-hw, -vh), vec2(-hw, 0.0))); // E
  if (n==0||n==4||n==5||n==6||n==8||n==9) d = min(d, LINE(p, vec2(-hw, vh), vec2(-hw, 0.0))); // F
  if (n==2||n==3||n==4||n==5||n==6||n==8||n==9) d = min(d, LINE(p, vec2(-hw, 0.0), vec2(hw, 0.0))); // G
  
  return d;
}

void main() {
  vec2 uv = vUv;
  vec2 p = (uv - 0.5) * vec2(uAspect, 1.0);
  
  // === DARK BRICK WALL BACKGROUND ===
  vec3 col = vec3(0.012, 0.008, 0.018);
  
  // Brick texture with variation
  vec2 brickUv = uv * vec2(24.0, 12.0);
  vec2 brickId = floor(brickUv);
  float brickOffset = mod(brickId.y, 2.0) * 0.5;
  brickUv.x += brickOffset;
  brickId = floor(brickUv);
  vec2 brickFrac = fract(brickUv);
  float mortar = smoothstep(0.03, 0.06, brickFrac.x) * smoothstep(0.03, 0.06, brickFrac.y) *
                 smoothstep(0.97, 0.94, brickFrac.x) * smoothstep(0.97, 0.94, brickFrac.y);
  float brickVar = hash(brickId) * 0.3 + 0.7;
  col += vec3(0.035, 0.018, 0.012) * mortar * brickVar;
  // Mortar lines faintly visible
  col += vec3(0.015) * (1.0 - mortar);
  
  // === NEON COLOUR SCHEME ===
  vec3 neonPink = vec3(1.0, 0.05, 0.4);
  vec3 neonBlue = vec3(0.1, 0.4, 1.0);
  vec3 neonCyan = vec3(0.0, 0.9, 0.9);
  vec3 neonGold = vec3(1.0, 0.75, 0.0);
  
  float colorPhase = uTime * 0.4;
  float c1 = sin(colorPhase) * 0.5 + 0.5;
  float c2 = sin(colorPhase * 0.7 + 2.0) * 0.5 + 0.5;
  vec3 mainNeon = mix(neonPink, neonBlue, c1);
  mainNeon = mix(mainNeon, neonCyan, c2 * 0.4);
  
  // === DANFEST — bigger, bolder ===
  float letterSpacing = 0.135;
  float startX = -0.405;
  float textY = 0.12;
  float textScale = 0.12;
  
  // Per-letter independent flicker (some letters occasionally dim like real neon)
  float letterDists[7];
  
  // Letter D
  vec2 lp = (p - vec2(startX, textY)) / textScale;
  float dLine = LINE(lp, vec2(-0.3, -0.5), vec2(-0.3, 0.5));
  dLine = min(dLine, LINE(lp, vec2(-0.3, 0.5), vec2(0.15, 0.5)));
  dLine = min(dLine, LINE(lp, vec2(-0.3, -0.5), vec2(0.15, -0.5)));
  dLine = min(dLine, LINE(lp, vec2(0.15, 0.5), vec2(0.38, 0.3)));
  dLine = min(dLine, LINE(lp, vec2(0.38, 0.3), vec2(0.38, -0.3)));
  dLine = min(dLine, LINE(lp, vec2(0.38, -0.3), vec2(0.15, -0.5)));
  letterDists[0] = dLine;
  
  // Letter A
  lp = (p - vec2(startX + letterSpacing, textY)) / textScale;
  float aLine = LINE(lp, vec2(0.0, 0.5), vec2(-0.32, -0.5));
  aLine = min(aLine, LINE(lp, vec2(0.0, 0.5), vec2(0.32, -0.5)));
  aLine = min(aLine, LINE(lp, vec2(-0.16, 0.0), vec2(0.16, 0.0)));
  letterDists[1] = aLine;
  
  // Letter N
  lp = (p - vec2(startX + letterSpacing * 2.0, textY)) / textScale;
  float nLine = LINE(lp, vec2(-0.3, -0.5), vec2(-0.3, 0.5));
  nLine = min(nLine, LINE(lp, vec2(0.3, -0.5), vec2(0.3, 0.5)));
  nLine = min(nLine, LINE(lp, vec2(-0.3, 0.5), vec2(0.3, -0.5)));
  letterDists[2] = nLine;
  
  // Letter F
  lp = (p - vec2(startX + letterSpacing * 3.0, textY)) / textScale;
  float fLine = LINE(lp, vec2(-0.3, -0.5), vec2(-0.3, 0.5));
  fLine = min(fLine, LINE(lp, vec2(-0.3, 0.5), vec2(0.3, 0.5)));
  fLine = min(fLine, LINE(lp, vec2(-0.3, 0.05), vec2(0.18, 0.05)));
  letterDists[3] = fLine;
  
  // Letter E
  lp = (p - vec2(startX + letterSpacing * 4.0, textY)) / textScale;
  float eLine = LINE(lp, vec2(-0.3, -0.5), vec2(-0.3, 0.5));
  eLine = min(eLine, LINE(lp, vec2(-0.3, 0.5), vec2(0.3, 0.5)));
  eLine = min(eLine, LINE(lp, vec2(-0.3, 0.05), vec2(0.18, 0.05)));
  eLine = min(eLine, LINE(lp, vec2(-0.3, -0.5), vec2(0.3, -0.5)));
  letterDists[4] = eLine;
  
  // Letter S
  lp = (p - vec2(startX + letterSpacing * 5.0, textY)) / textScale;
  float sLine = LINE(lp, vec2(0.3, 0.5), vec2(-0.2, 0.5));
  sLine = min(sLine, LINE(lp, vec2(-0.3, 0.45), vec2(-0.3, 0.05)));
  sLine = min(sLine, LINE(lp, vec2(-0.3, 0.05), vec2(0.3, 0.05)));
  sLine = min(sLine, LINE(lp, vec2(0.3, 0.0), vec2(0.3, -0.45)));
  sLine = min(sLine, LINE(lp, vec2(0.2, -0.5), vec2(-0.3, -0.5)));
  // Curved caps
  sLine = min(sLine, LINE(lp, vec2(-0.2, 0.5), vec2(-0.3, 0.45)));
  sLine = min(sLine, LINE(lp, vec2(0.3, 0.5), vec2(0.3, 0.45)));
  sLine = min(sLine, LINE(lp, vec2(-0.3, -0.5), vec2(-0.3, -0.45)));
  sLine = min(sLine, LINE(lp, vec2(0.2, -0.5), vec2(0.3, -0.45)));
  letterDists[5] = sLine;
  
  // Letter T
  lp = (p - vec2(startX + letterSpacing * 6.0, textY)) / textScale;
  float tLine = LINE(lp, vec2(-0.35, 0.5), vec2(0.35, 0.5));
  tLine = min(tLine, LINE(lp, vec2(0.0, 0.5), vec2(0.0, -0.5)));
  letterDists[6] = tLine;
  
  // Render each letter with individual flicker
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    // Per-letter flicker: occasional random dimming
    float flickerSeed = hash(vec2(fi, floor(uTime * 8.0)));
    float letterFlicker = 1.0;
    if (flickerSeed > 0.92) letterFlicker = 0.3 + 0.7 * sin(uTime * 60.0 + fi * 17.0) * 0.5 + 0.5;
    if (flickerSeed > 0.97) letterFlicker = 0.1; // rare full dim
    // Subtle constant hum vibration
    letterFlicker *= 0.92 + 0.08 * sin(uTime * 50.0 + fi * 11.3);
    
    float brightness = letterFlicker * (0.8 + uMidEnergy * 0.4);
    col += neonTube(letterDists[i], mainNeon, brightness);
  }
  
  // === MOUNTING BRACKETS (small dark rectangles at letter tops) ===
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    vec2 bracketPos = vec2(startX + letterSpacing * fi, textY + textScale * 0.55);
    float bracket = smoothstep(0.008, 0.004, abs(p.x - bracketPos.x)) *
                    smoothstep(0.012, 0.006, abs(p.y - bracketPos.y));
    col = mix(col, vec3(0.03), bracket * 0.6);
  }
  
  // === "50" — large neon digits below ===
  float digitScale = 0.2;
  float digitGap = 0.18;
  vec2 digitCenter = vec2(0.0, -0.15);
  
  float d5 = digitSDF((p - digitCenter + vec2(digitGap * 0.5, 0.0)) / digitScale, 5);
  float d0 = digitSDF((p - digitCenter - vec2(digitGap * 0.5, 0.0)) / digitScale, 0);
  
  // "50" flicker (slightly different timing)
  float numFlicker = 0.9 + 0.1 * sin(uTime * 45.0 + 3.0);
  float numFlicker2 = (hash(vec2(0.5, floor(uTime * 6.0))) > 0.95) ? 0.4 : 1.0;
  float numBrightness = numFlicker * numFlicker2 * (0.7 + uBassEnergy * 0.6);
  
  col += neonTube(d5, neonGold, numBrightness);
  col += neonTube(d0, neonGold, numBrightness);
  
  // === DECORATIVE UNDERLINE BAR ===
  float underline = LINE(p, vec2(-0.32, textY - textScale * 0.7), vec2(0.32, textY - textScale * 0.7));
  col += neonTube(underline, mainNeon * 0.6, 0.5);
  
  // === REFLECTIVE FLOOR ===
  // Below y = -0.35, mirror the neon glow with fade
  if (p.y < -0.35) {
    float reflY = -0.35 - (p.y + 0.35); // mirror distance
    float reflFade = exp(-reflY * 4.0) * 0.35;
    vec2 rp = vec2(p.x, -0.35 + reflY); // reflected position
    
    // Reflected DANFEST glow (approximate with distance to text center)
    float textDist = length(rp - vec2(0.0, textY));
    col += mainNeon * exp(-textDist * 3.0) * reflFade * 0.4;
    
    // Reflected 50 glow
    float numDist = length(rp - digitCenter);
    col += neonGold * exp(-numDist * 4.0) * reflFade * 0.3;
    
    // Wet floor noise distortion
    float wetNoise = noise(vec2(p.x * 30.0, uTime * 0.5)) * 0.015;
    col += mainNeon * reflFade * wetNoise;
  }
  
  // === LIGHT RAYS emanating from text ===
  float rays = 0.0;
  vec2 rayCenter = vec2(0.0, textY * 0.5);
  vec2 toP = p - rayCenter;
  float angle = atan(toP.y, toP.x);
  float rayPattern = abs(sin(angle * 8.0 + uTime * 0.3));
  rayPattern = pow(rayPattern, 8.0);
  float rayDist = length(toP);
  rays = rayPattern * exp(-rayDist * 2.5) * 0.08;
  col += mainNeon * rays * (0.5 + uBassEnergy * 0.5);
  
  // === SPARKLE PARTICLES ===
  for (int i = 0; i < 20; i++) {
    float fi = float(i);
    float seed1 = hash1(fi * 73.156);
    float seed2 = hash1(fi * 91.734);
    float speed = 0.15 + seed1 * 0.2;
    float phase = seed2 * 6.28;
    
    // Orbit around the text area
    float orbitA = fi * 0.314 + uTime * speed + phase;
    float rx = 0.4 + sin(uTime * 0.3 + fi) * 0.1;
    float ry = 0.25 + cos(uTime * 0.4 + fi * 2.0) * 0.08;
    vec2 starPos = vec2(cos(orbitA) * rx, sin(orbitA) * ry) + vec2(0.0, textY * 0.3);
    
    float dist = length(p - starPos);
    // Star-shaped sparkle
    vec2 toStar = p - starPos;
    float starAngle = atan(toStar.y, toStar.x);
    float starShape = 1.0 + 0.5 * abs(sin(starAngle * 4.0 + uTime * 3.0));
    float sparkle = exp(-dist * 200.0 * starShape) * 2.0;
    // Twinkle
    float twinkle = pow(0.5 + 0.5 * sin(uTime * (4.0 + seed1 * 4.0) + fi * 5.0), 3.0);
    vec3 sparkleCol = mix(neonPink, neonCyan, seed1);
    sparkleCol = mix(sparkleCol, neonGold, seed2 * 0.3);
    col += sparkleCol * sparkle * twinkle;
  }
  
  // === AMBIENT WALL GLOW (neon light spilling onto bricks) ===
  float wallGlowText = exp(-length(p - vec2(0.0, textY)) * 2.0) * 0.12;
  float wallGlowNum = exp(-length(p - digitCenter) * 2.5) * 0.08;
  col += mainNeon * wallGlowText * (0.6 + uBassEnergy * 0.4);
  col += neonGold * wallGlowNum * (0.5 + uBassEnergy * 0.5);
  
  // === BASS PULSE — whole scene throbs ===
  col *= 1.0 + uBassEnergy * 0.25;
  
  // === TRANSIENT FLASH ===
  col += (mainNeon * 0.3 + vec3(0.15)) * uTransient * 0.6;
  
  // === FILM GRAIN ===
  float grain = hash(p * 500.0 + uTime * 100.0) * 0.03;
  col += vec3(grain);
  
  col *= uIntensity;
  gl_FragColor = vec4(col, 1.0);
}
`;

export class NeonSignsEffect implements VisualEffect {
  name = 'neonSigns';
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
