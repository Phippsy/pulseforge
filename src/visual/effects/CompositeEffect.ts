import * as THREE from 'three';
import type { ControlSignals } from '../../store';
import type { VisualEffect, EffectParams } from './types';
import { effectRegistry, type EffectName } from './index';

/**
 * CompositeEffect - Layers 2-3 effects together with blend modes
 * Renders each sub-effect to a separate render target then composites
 * Blend modes: additive, screen, multiply, overlay
 */

type BlendMode = 'add' | 'screen' | 'multiply' | 'overlay';

const compositeVertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;

const compositeFragmentShader = `
precision highp float;
varying vec2 vUv;

uniform sampler2D tLayer0;
uniform sampler2D tLayer1;
uniform sampler2D tLayer2;
uniform int uLayerCount;
uniform int uBlendMode;
uniform float uOpacity1;
uniform float uOpacity2;

vec3 blendAdd(vec3 base, vec3 blend, float opacity) {
  return base + blend * opacity;
}

vec3 blendScreen(vec3 base, vec3 blend, float opacity) {
  vec3 result = 1.0 - (1.0 - base) * (1.0 - blend);
  return mix(base, result, opacity);
}

vec3 blendMultiply(vec3 base, vec3 blend, float opacity) {
  vec3 result = base * blend * 2.0; // *2 to keep brightness
  return mix(base, result, opacity);
}

vec3 blendOverlay(vec3 base, vec3 blend, float opacity) {
  vec3 result;
  for (int i = 0; i < 3; i++) {
    if (base[i] < 0.5) {
      result[i] = 2.0 * base[i] * blend[i];
    } else {
      result[i] = 1.0 - 2.0 * (1.0 - base[i]) * (1.0 - blend[i]);
    }
  }
  return mix(base, result, opacity);
}

void main() {
  vec3 layer0 = texture2D(tLayer0, vUv).rgb;
  vec3 layer1 = texture2D(tLayer1, vUv).rgb;
  
  vec3 result = layer0;
  
  // Blend layer 1
  if (uBlendMode == 0) result = blendAdd(result, layer1, uOpacity1);
  else if (uBlendMode == 1) result = blendScreen(result, layer1, uOpacity1);
  else if (uBlendMode == 2) result = blendMultiply(result, layer1, uOpacity1);
  else result = blendOverlay(result, layer1, uOpacity1);
  
  // Blend layer 2 if present
  if (uLayerCount > 2) {
    vec3 layer2 = texture2D(tLayer2, vUv).rgb;
    if (uBlendMode == 0) result = blendAdd(result, layer2, uOpacity2);
    else if (uBlendMode == 1) result = blendScreen(result, layer2, uOpacity2);
    else if (uBlendMode == 2) result = blendMultiply(result, layer2, uOpacity2);
    else result = blendOverlay(result, layer2, uOpacity2);
  }
  
  // Tonemap to prevent blowout
  result = result / (1.0 + result * 0.3);
  
  gl_FragColor = vec4(result, 1.0);
}
`;

export class CompositeEffect implements VisualEffect {
  name = 'composite';
  
  private effects: VisualEffect[] = [];
  private scenes: THREE.Scene[] = [];
  private renderTargets: THREE.WebGLRenderTarget[] = [];
  private compositeMaterial!: THREE.ShaderMaterial;
  private compositeMesh!: THREE.Mesh;
  private compositeScene!: THREE.Scene;
  private orthoCamera: THREE.OrthographicCamera;
  private renderer: THREE.WebGLRenderer | null = null;
  private blendMode: BlendMode;
  private effectNames: EffectName[];
  private layerOpacities: number[];
  
  constructor(
    effectNames: EffectName[],
    blendMode: BlendMode = 'screen',
    opacities?: number[]
  ) {
    this.effectNames = effectNames.slice(0, 3); // max 3 layers
    this.blendMode = blendMode;
    this.layerOpacities = opacities || [1.0, 0.7, 0.5];
    this.orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  init(scene: THREE.Scene, _camera: THREE.Camera): void {
    // Create sub-effects in their own scenes
    for (const name of this.effectNames) {
      const subScene = new THREE.Scene();
      const factory = effectRegistry[name];
      const effect = factory();
      effect.init(subScene, this.orthoCamera);
      this.effects.push(effect);
      this.scenes.push(subScene);
    }

    // Create render targets
    const w = window.innerWidth;
    const h = window.innerHeight;
    for (let i = 0; i < this.effectNames.length; i++) {
      this.renderTargets.push(new THREE.WebGLRenderTarget(w, h, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
      }));
    }

    // Composite material
    const blendModeInt = { add: 0, screen: 1, multiply: 2, overlay: 3 }[this.blendMode];
    this.compositeMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tLayer0: { value: this.renderTargets[0]?.texture ?? null },
        tLayer1: { value: this.renderTargets[1]?.texture ?? null },
        tLayer2: { value: this.renderTargets[2]?.texture ?? null },
        uLayerCount: { value: this.effectNames.length },
        uBlendMode: { value: blendModeInt },
        uOpacity1: { value: this.layerOpacities[1] ?? 0.7 },
        uOpacity2: { value: this.layerOpacities[2] ?? 0.5 },
      },
      vertexShader: compositeVertexShader,
      fragmentShader: compositeFragmentShader,
    });

    this.compositeScene = new THREE.Scene();
    this.compositeMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      this.compositeMaterial
    );
    this.compositeMesh.frustumCulled = false;
    this.compositeScene.add(this.compositeMesh);

    // Add composite mesh to main scene for final render
    scene.add(this.compositeMesh);
  }

  /** Must be called after init to provide renderer reference */
  setRenderer(renderer: THREE.WebGLRenderer): void {
    this.renderer = renderer;
  }

  update(signals: ControlSignals, params: EffectParams, dt: number, time: number): void {
    if (!this.renderer) return;

    // Update and render each sub-effect to its render target
    for (let i = 0; i < this.effects.length; i++) {
      this.effects[i].update(signals, params, dt, time);
      
      this.renderer.setRenderTarget(this.renderTargets[i]);
      this.renderer.render(this.scenes[i], this.orthoCamera);
    }
    this.renderer.setRenderTarget(null);

    // Update composite uniforms
    const u = this.compositeMaterial.uniforms;
    for (let i = 0; i < this.renderTargets.length; i++) {
      u[`tLayer${i}`].value = this.renderTargets[i].texture;
    }
  }

  dispose(): void {
    for (const effect of this.effects) effect.dispose();
    for (const rt of this.renderTargets) rt.dispose();
    for (const scene of this.scenes) {
      while (scene.children.length > 0) scene.remove(scene.children[0]);
    }
    this.compositeMaterial.dispose();
    this.compositeMesh.geometry.dispose();
    this.compositeMesh.parent?.remove(this.compositeMesh);
    this.effects = [];
    this.scenes = [];
    this.renderTargets = [];
  }
}

/**
 * Generate a random composite effect combination
 * Picks 2-3 compatible effects and a random blend mode
 */
export function createRandomComposite(): { effects: EffectName[]; blend: BlendMode; opacities: number[] } {
  // Effects that work well as fullscreen layers (ortho/shader effects)
  const layerableEffects: EffectName[] = [
    'tunnel', 'fractal', 'metaballs', 'plasma', 'voronoi', 'aurora',
    'geoKaleidoscope', 'rings', 'fire', 'superscope', 'milkdrop',
    'waterRipple', 'matrixRain', 'rorschach', 'spiralVortex', 'nebula',
    'electricArc', 'soundwaves',
  ];

  const blendModes: BlendMode[] = ['add', 'screen', 'multiply', 'overlay'];

  // Pick 2-3 random effects (no duplicates)
  const numLayers = Math.random() < 0.4 ? 3 : 2;
  const shuffled = layerableEffects.sort(() => Math.random() - 0.5);
  const picked = shuffled.slice(0, numLayers);

  const blend = blendModes[Math.floor(Math.random() * blendModes.length)];
  const opacities = [1.0, 0.5 + Math.random() * 0.4, 0.3 + Math.random() * 0.4];

  return { effects: picked, blend, opacities };
}
