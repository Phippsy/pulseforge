import * as THREE from 'three';
import type { ControlSignals } from '../store';
import type { VisualEffect, EffectParams } from './effects/types';
import type { PostProcessParams } from './PostProcessing';
import { PostProcessing } from './PostProcessing';
import { effectRegistry, type EffectName } from './effects/index';
import { WaveformRing } from './effects/WaveformRing';
import { ImageShatter } from './effects/ImageShatter';
import { GraphicEqualiserEffect } from './effects/GraphicEqualiserEffect';
import { PsychedelicEQEffect } from './effects/PsychedelicEQEffect';

export class VisualEngine {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private orthoCamera: THREE.OrthographicCamera;
  private currentEffect: VisualEffect | null = null;
  private currentEffectName: EffectName | null = null;
  private postProcessing: PostProcessing;
  private fftData: Float32Array | null = null;
  private imageTexture: THREE.Texture | null = null;
  private cameraTime = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000);
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
    this.camera.position.z = 5;

    this.orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.postProcessing = new PostProcessing(this.renderer, this.scene, this.camera);

    window.addEventListener('resize', this.handleResize);
  }

  private handleResize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.postProcessing.setSize(w, h);
  };

  setEffect(name: EffectName): void {
    if (name === this.currentEffectName) return;

    if (this.currentEffect) {
      this.currentEffect.dispose();
    }

    // Clear scene
    while (this.scene.children.length > 0) {
      this.scene.remove(this.scene.children[0]);
    }

    const factory = effectRegistry[name];
    this.currentEffect = factory();
    this.currentEffectName = name;

    // Fullscreen quad effects use ortho camera
    const useOrtho = name === 'tunnel' || name === 'fractal' || name === 'metaballs' || name === 'plasma' || name === 'voronoi' || name === 'aurora' || name === 'geoKaleidoscope' || name === 'rings' || name === 'equaliser' || name === 'soundwaves';
    const cam = useOrtho ? this.orthoCamera : this.camera;
    this.currentEffect.init(this.scene, cam);

    // Pass image texture to ImageShatter if available
    if (this.currentEffect instanceof ImageShatter && this.imageTexture) {
      this.currentEffect.setTexture(this.imageTexture);
    }

    // Recreate post-processing with correct camera
    this.postProcessing.dispose();
    this.postProcessing = new PostProcessing(this.renderer, this.scene, cam);
    this.postProcessing.setSize(window.innerWidth, window.innerHeight);
  }

  setFFTData(data: Float32Array): void {
    this.fftData = data;
  }

  setImageTexture(dataUrl: string): void {
    if (this.imageTexture) this.imageTexture.dispose();
    const loader = new THREE.TextureLoader();
    this.imageTexture = loader.load(dataUrl);
    // If current effect is ImageShatter, pass texture immediately
    if (this.currentEffect instanceof ImageShatter) {
      this.currentEffect.setTexture(this.imageTexture);
    }
  }

  update(signals: ControlSignals, params: EffectParams, postParams: PostProcessParams, dt: number, time: number): void {
    if (!this.currentEffect) return;

    // Pass FFT data to waveform ring
    if (this.currentEffect instanceof WaveformRing && this.fftData) {
      this.currentEffect.setFFTData(this.fftData);
    }
    // Pass FFT data to graphic equaliser
    if (this.currentEffect instanceof GraphicEqualiserEffect && this.fftData) {
      this.currentEffect.setFFTData(this.fftData);
    }
    // Pass FFT data to psychedelic EQ
    if (this.currentEffect instanceof PsychedelicEQEffect && this.fftData) {
      this.currentEffect.setFFTData(this.fftData);
    }

    // Aggressive camera motion for 3D effects - constant movement along all axes
    this.cameraTime += dt;
    const useOrthoForEffect = this.currentEffectName === 'tunnel' || this.currentEffectName === 'fractal' || this.currentEffectName === 'metaballs' || this.currentEffectName === 'plasma' || this.currentEffectName === 'voronoi' || this.currentEffectName === 'aurora' || this.currentEffectName === 'geoKaleidoscope' || this.currentEffectName === 'rings' || this.currentEffectName === 'equaliser' || this.currentEffectName === 'soundwaves';
    
    if (!useOrthoForEffect) {
      const speed = params.speed;
      const t = this.cameraTime;
      
      // Dramatic multi-axis Lissajous orbit - much more movement
      const orbitRadius = 2.0 * speed;
      this.camera.position.x = Math.sin(t * 0.31) * orbitRadius + Math.sin(t * 0.53) * orbitRadius * 0.5 + Math.cos(t * 0.17) * 0.4;
      this.camera.position.y = Math.cos(t * 0.23) * orbitRadius * 0.8 + Math.sin(t * 0.67) * 0.5 + Math.cos(t * 0.41) * 0.3;
      
      // Z-axis: constant forward/backward sweep + EXPLOSIVE bass slam
      const baseZ = 4.0 + Math.sin(t * 0.13) * 1.2 + Math.cos(t * 0.07) * 0.8;
      const bassDolly = signals.bassPulse * params.bassReactivity * 2.5;
      const transientPunch = signals.transientPulse * params.onsetReactivity * 1.5;
      this.camera.position.z = baseZ - bassDolly - transientPunch;
      
      // Bass also shakes X/Y for explosive feel
      this.camera.position.x += signals.bassPulse * params.bassReactivity * 0.3 * Math.sin(t * 7.0);
      this.camera.position.y += signals.bassPulse * params.bassReactivity * 0.2 * Math.cos(t * 5.3);
      
      // Look-at orbits independently from position for parallax
      const lookX = Math.sin(t * 0.19) * 0.5 + Math.cos(t * 0.37) * 0.2;
      const lookY = Math.cos(t * 0.15) * 0.4 + Math.sin(t * 0.29) * 0.2;
      const lookZ = Math.sin(t * 0.11) * 0.3;
      this.camera.lookAt(lookX, lookY, lookZ);
      
      // Roll on transients + bass + slow constant roll
      this.camera.rotation.z = Math.sin(t * 0.09) * 0.06 + signals.transientPulse * 0.12 + signals.bassPulse * 0.04;
    }

    // Pass audio to post-processing for reactive warp
    this.postProcessing.setAudioSignals(
      signals.bassEnergy * params.bassReactivity,
      signals.midEnergy * params.midReactivity,
      signals.transientPulse * params.onsetReactivity
    );

    this.currentEffect.update(signals, params, dt, time);
    this.postProcessing.updateParams(postParams);
    this.postProcessing.render(this.renderer);
  }

  getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }

  dispose(): void {
    window.removeEventListener('resize', this.handleResize);
    if (this.currentEffect) this.currentEffect.dispose();
    this.postProcessing.dispose();
    this.renderer.dispose();
  }
}
