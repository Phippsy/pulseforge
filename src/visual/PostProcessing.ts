import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

export interface PostProcessParams {
  bloomStrength: number;
  bloomThreshold: number;
  bloomRadius: number;
  chromaticAberration: number;
  kaleidoscopeSegments: number;
  feedbackAmount: number;
  vignetteAmount: number;
  // New warp params
  warpSpeed?: number;
  warpIntensity?: number;
  motionBlur?: number;
}

const ChromaticAberrationShader = {
  uniforms: {
    tDiffuse: { value: null },
    uAmount: { value: 0.005 },
    uTime: { value: 0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uAmount;
    uniform float uTime;
    varying vec2 vUv;
    void main() {
      vec2 dir = vUv - 0.5;
      float dist = length(dir);
      float angle = atan(dir.y, dir.x) + uTime * 0.1;
      vec2 offset = vec2(cos(angle), sin(angle)) * dist * dist * uAmount;
      vec2 offsetR = dir * dist * uAmount * 1.2;
      vec2 offsetB = dir * dist * uAmount * 0.8 + offset * 0.3;
      float r = texture2D(tDiffuse, vUv + offsetR).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv - offsetB).b;
      gl_FragColor = vec4(r, g, b, 1.0);
    }
  `,
};

const VignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    uAmount: { value: 0.5 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uAmount;
    varying vec2 vUv;
    void main() {
      vec4 col = texture2D(tDiffuse, vUv);
      float dist = length(vUv - 0.5) * 1.414;
      float vignette = 1.0 - dist * dist * uAmount;
      col.rgb *= vignette;
      gl_FragColor = col;
    }
  `,
};

// Highlight compressor + saturation enforcement — prevents HDR bloom from blowing out to white
// Unlike full ACES, this ONLY compresses the bright end (>0.7), leaving midtones/shadows untouched
const ToneMappingShader = {
  uniforms: {
    tDiffuse: { value: null },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    
    void main() {
      vec3 col = texture2D(tDiffuse, vUv).rgb;
      
      // Highlight compression — aggressively squish anything above the knee
      // This catches bloom output which spreads brightness across the image
      float knee = 0.4;
      float maxBright = max(col.r, max(col.g, col.b));
      if (maxBright > knee) {
        // Soft compression: maps knee..infinity to knee..0.85
        float compressed = knee + (0.85 - knee) * (1.0 - exp(-(maxBright - knee) * 4.0));
        col *= compressed / maxBright;
      }
      
      // Saturation boost — only for pixels that are actually visible (not dark residuals)
      float luma = dot(col, vec3(0.299, 0.587, 0.114));
      if (luma > 0.15) {
        float sat = length(col - vec3(luma));
        // Moderate boost to counteract bloom's desaturation — don't amplify residuals
        float boost = sat < 0.1 ? 1.5 : 1.25;
        vec3 saturated = mix(vec3(luma), col, boost);
        col = clamp(saturated, 0.0, 1.0);
      }
      
      // Kill desaturated bright pixels — these cause white/grey blobs
      // Only allow high luminance if the pixel has actual colour
      luma = dot(col, vec3(0.299, 0.587, 0.114));
      float satFinal = length(col - vec3(luma));
      float maxAllowed = 0.35 + satFinal * 3.0; // saturated pixels can be brighter
      maxAllowed = clamp(maxAllowed, 0.35, 0.7);
      if (luma > maxAllowed) {
        col *= maxAllowed / luma;
      }
      
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

// MilkDrop-style warp feedback - the KEY to constant motion
const WarpFeedbackShader = {
  uniforms: {
    tDiffuse: { value: null },
    tPrev: { value: null },
    uAmount: { value: 0.3 },
    uZoom: { value: 0.01 },
    uRotation: { value: 0.005 },
    uWarpSpeed: { value: 1.0 },
    uWarpIntensity: { value: 0.5 },
    uTime: { value: 0 },
    uBassEnergy: { value: 0 },
    uMidEnergy: { value: 0 },
    uTransient: { value: 0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform sampler2D tPrev;
    uniform float uAmount;
    uniform float uZoom;
    uniform float uRotation;
    uniform float uWarpSpeed;
    uniform float uWarpIntensity;
    uniform float uTime;
    uniform float uBassEnergy;
    uniform float uMidEnergy;
    uniform float uTransient;
    varying vec2 vUv;
    
    #define PI 3.14159265
    
    // Simplex-ish noise for per-pixel warping
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }
    
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
    
    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      for (int i = 0; i < 3; i++) {
        v += a * noise(p);
        p *= 2.0;
        a *= 0.5;
      }
      return v;
    }
    
    void main() {
      vec4 current = texture2D(tDiffuse, vUv);
      
      vec2 centered = vUv - 0.5;
      float dist = length(centered);
      float angle = atan(centered.y, centered.x);
      
      // Base zoom - pulsing with bass (capped to prevent whiteout)
      float bassZ = min(uBassEnergy, 0.8);
      float transZ = min(uTransient, 0.6);
      float zoom = uZoom * (1.0 + bassZ * 2.5 + transZ * 1.2);
      
      // Per-pixel warp using noise field (MilkDrop's killer feature)
      float t = uTime * uWarpSpeed * 0.3;
      vec2 warpOffset = vec2(
        fbm(centered * 3.0 + vec2(t * 0.7, t * 0.3)) - 0.5,
        fbm(centered * 3.0 + vec2(t * 0.5 + 100.0, t * 0.8 + 50.0)) - 0.5
      ) * uWarpIntensity * 0.03 * (1.0 + uMidEnergy);
      
      // Rotation varies across the image (center rotates more than edges, or vice versa)
      float rot = uRotation * (1.0 + uMidEnergy * 1.5);
      // Add radial variation to rotation for more organic motion
      rot *= (1.0 + sin(dist * 5.0 + uTime * 0.5) * 0.3);
      
      float s = sin(rot);
      float c = cos(rot);
      vec2 rotated = vec2(centered.x * c - centered.y * s, centered.x * s + centered.y * c);
      
      // Apply zoom with bass-reactive center attraction
      vec2 zoomed = rotated * (1.0 - zoom) + 0.5;
      
      // Apply per-pixel warp
      zoomed += warpOffset;
      
      // Spiral motion - creates hypnotic inward/outward spiral
      float spiralStrength = uWarpIntensity * 0.01 * (1.0 + uBassEnergy);
      float spiralAngle = dist * 3.0 + uTime * uWarpSpeed * 0.5;
      zoomed += vec2(cos(spiralAngle), sin(spiralAngle)) * spiralStrength * dist;
      
      // If UV is out of bounds, skip feedback (use current frame only) — prevents hard pixelated edge
      vec4 prev;
      if (zoomed.x < 0.0 || zoomed.x > 1.0 || zoomed.y < 0.0 || zoomed.y > 1.0) {
        prev = current;
      } else {
        prev = texture2D(tPrev, zoomed);
      }
      
      // Colour decay — very aggressive to prevent brightness accumulation
      // Decay scales with feedback amount — higher feedback needs more aggressive decay
      float decay = 0.88 - uAmount * 0.4 - uTransient * 0.05;
      prev.rgb *= decay;
      
      // Aggressively kill desaturated bright pixels in feedback — these cause grey blowout
      float luma = dot(prev.rgb, vec3(0.299, 0.587, 0.114));
      float sat = length(prev.rgb - vec3(luma));
      float desat = smoothstep(0.15, 0.03, sat) * smoothstep(0.12, 0.25, luma);
      prev.rgb *= 1.0 - desat * 0.85;
      
      // Cap feedback brightness — saturated colour allowed brighter
      float maxBright = 0.25 + sat * 2.5;
      maxBright = clamp(maxBright, 0.25, 0.6);
      prev.rgb = min(prev.rgb, vec3(maxBright));
      
      vec4 result = mix(current, prev, uAmount);
      
      // Final output: suppress desaturated brightness in the combined result too
      float finalLuma = dot(result.rgb, vec3(0.299, 0.587, 0.114));
      float finalSat = length(result.rgb - vec3(finalLuma));
      float finalDesat = smoothstep(0.2, 0.05, finalSat) * smoothstep(0.3, 0.5, finalLuma);
      result.rgb *= 1.0 - finalDesat * 0.5;
      
      gl_FragColor = result;
    }
  `,
};

const KaleidoscopeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uSegments: { value: 0.0 },
    uRotation: { value: 0.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uSegments;
    uniform float uRotation;
    varying vec2 vUv;
    #define PI 3.14159265
    void main() {
      if (uSegments < 2.0) {
        gl_FragColor = texture2D(tDiffuse, vUv);
        return;
      }
      vec2 centered = vUv - 0.5;
      float angle = atan(centered.y, centered.x) + uRotation;
      float radius = length(centered);
      float segAngle = 2.0 * PI / uSegments;
      angle = mod(angle, segAngle);
      if (angle > segAngle * 0.5) angle = segAngle - angle;
      vec2 newUv = vec2(cos(angle), sin(angle)) * radius + 0.5;
      gl_FragColor = texture2D(tDiffuse, newUv);
    }
  `,
};

const FilmGrainShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uIntensity: { value: 0.04 },
    uScanlines: { value: 0.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uIntensity;
    uniform float uScanlines;
    varying vec2 vUv;
    
    float random(vec2 co) {
      return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
    }
    
    void main() {
      vec4 col = texture2D(tDiffuse, vUv);
      float grain = random(vUv + fract(uTime * 0.1)) * 2.0 - 1.0;
      col.rgb += grain * uIntensity;
      if (uScanlines > 0.0) {
        float scanline = sin(vUv.y * 800.0) * 0.5 + 0.5;
        col.rgb -= scanline * uScanlines * 0.03;
      }
      gl_FragColor = col;
    }
  `,
};

export class PostProcessing {
  private composer: EffectComposer;
  private bloomPass: UnrealBloomPass;
  private chromaticPass: ShaderPass;
  private toneMappingPass: ShaderPass;
  private kaleidoscopePass: ShaderPass;
  private feedbackPass: ShaderPass;
  private vignettePass: ShaderPass;
  private filmGrainPass: ShaderPass;
  private feedbackTarget: THREE.WebGLRenderTarget;
  private feedbackTarget2: THREE.WebGLRenderTarget;
  private renderer: THREE.WebGLRenderer;
  private time = 0;
  private bassEnergy = 0;
  private midEnergy = 0;
  private transient = 0;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    this.renderer = renderer;
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));

    const size = renderer.getSize(new THREE.Vector2());

    this.bloomPass = new UnrealBloomPass(size, 1.0, 0.5, 0.5);
    this.composer.addPass(this.bloomPass);

    // Tone mapping IMMEDIATELY after bloom — compresses HDR back to 0-1
    this.toneMappingPass = new ShaderPass(ToneMappingShader);
    this.composer.addPass(this.toneMappingPass);

    this.chromaticPass = new ShaderPass(ChromaticAberrationShader);
    this.composer.addPass(this.chromaticPass);

    this.kaleidoscopePass = new ShaderPass(KaleidoscopeShader);
    this.composer.addPass(this.kaleidoscopePass);

    this.feedbackTarget = new THREE.WebGLRenderTarget(size.x, size.y);
    this.feedbackTarget2 = new THREE.WebGLRenderTarget(size.x, size.y);
    this.feedbackPass = new ShaderPass(WarpFeedbackShader);
    this.feedbackPass.uniforms.tPrev = { value: this.feedbackTarget.texture };
    this.composer.addPass(this.feedbackPass);

    this.filmGrainPass = new ShaderPass(FilmGrainShader);
    this.composer.addPass(this.filmGrainPass);

    this.vignettePass = new ShaderPass(VignetteShader);
    this.composer.addPass(this.vignettePass);
  }

  setAudioSignals(bass: number, mid: number, transient: number): void {
    this.bassEnergy = bass;
    this.midEnergy = mid;
    this.transient = transient;
  }

  updateParams(params: PostProcessParams): void {
    // Bloom — very subtle. High threshold means only the absolute brightest pixels bloom
    this.bloomPass.strength = Math.min(0.6, params.bloomStrength * 0.3 + this.bassEnergy * 0.1 + this.transient * 0.05);
    this.bloomPass.threshold = Math.max(0.85, params.bloomThreshold + 0.2);
    this.bloomPass.radius = Math.min(0.4, params.bloomRadius * 0.5);
    this.chromaticPass.uniforms.uAmount.value = Math.min(0.03, params.chromaticAberration + this.bassEnergy * 0.005 + this.transient * 0.008);
    this.chromaticPass.uniforms.uTime.value = this.time;
    this.kaleidoscopePass.uniforms.uSegments.value = params.kaleidoscopeSegments;
    this.kaleidoscopePass.uniforms.uRotation.value = this.time * 0.08;
    
    // Warp feedback - the engine of constant motion
    this.feedbackPass.uniforms.uAmount.value = params.feedbackAmount;
    this.feedbackPass.uniforms.uZoom.value = 0.008 + (params.warpIntensity ?? 0.5) * 0.012;
    this.feedbackPass.uniforms.uRotation.value = 0.003 + (params.warpSpeed ?? 1.0) * 0.004;
    this.feedbackPass.uniforms.uWarpSpeed.value = params.warpSpeed ?? 1.0;
    this.feedbackPass.uniforms.uWarpIntensity.value = params.warpIntensity ?? 0.5;
    this.feedbackPass.uniforms.uTime.value = this.time;
    this.feedbackPass.uniforms.uBassEnergy.value = this.bassEnergy;
    this.feedbackPass.uniforms.uMidEnergy.value = this.midEnergy;
    this.feedbackPass.uniforms.uTransient.value = this.transient;
    
    this.vignettePass.uniforms.uAmount.value = params.vignetteAmount;
    this.filmGrainPass.uniforms.uTime.value = this.time;
    this.filmGrainPass.uniforms.uIntensity.value = 0.02;
    this.filmGrainPass.uniforms.uScanlines.value = 0.0; // Disabled — creates visible grey lines over visuals
  }

  render(_renderer: THREE.WebGLRenderer): void {
    this.time += 0.016;
    this.composer.render();

    // Capture current frame for feedback (ping-pong targets)
    if (this.feedbackPass.uniforms.uAmount.value > 0.01) {
      const currentRT = this.composer.readBuffer;
      this.renderer.setRenderTarget(this.feedbackTarget2);
      const copyMat = new THREE.MeshBasicMaterial({ map: currentRT.texture });
      const copyMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), copyMat);
      const copyScene = new THREE.Scene();
      copyScene.add(copyMesh);
      const orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      this.renderer.render(copyScene, orthoCam);
      this.renderer.setRenderTarget(null);
      copyMat.dispose();
      copyMesh.geometry.dispose();

      const temp = this.feedbackTarget;
      this.feedbackTarget = this.feedbackTarget2;
      this.feedbackTarget2 = temp;
      this.feedbackPass.uniforms.tPrev.value = this.feedbackTarget.texture;
    }
  }

  setSize(width: number, height: number): void {
    this.composer.setSize(width, height);
    this.feedbackTarget.setSize(width, height);
    this.feedbackTarget2.setSize(width, height);
    // Clear feedback buffers on resize to prevent artifacts
    this.clearFeedback();
  }

  clearFeedback(): void {
    const currentRT = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(this.feedbackTarget);
    this.renderer.clear();
    this.renderer.setRenderTarget(this.feedbackTarget2);
    this.renderer.clear();
    this.renderer.setRenderTarget(currentRT);
  }

  dispose(): void {
    this.feedbackTarget.dispose();
    this.feedbackTarget2.dispose();
  }
}
