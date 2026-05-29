import type { VisualEffect } from './types';
import { TunnelEffect } from './TunnelEffect';
import { ParticleField } from './ParticleField';
import { WireframeGrid } from './WireframeGrid';
import { BlobOrb } from './BlobOrb';
import { FlowLines } from './FlowLines';
import { WaveformRing } from './WaveformRing';
import { FractalEffect } from './FractalEffect';
import { ImageShatter } from './ImageShatter';
import { MetaballsEffect } from './MetaballsEffect';
import { HelixEffect } from './HelixEffect';
import { StarfieldEffect } from './StarfieldEffect';
import { PlasmaWaveEffect } from './PlasmaWaveEffect';
import { VoronoiCrystalEffect } from './VoronoiCrystalEffect';
import { AuroraEffect } from './AuroraEffect';
import { GeoKaleidoscopeEffect } from './GeoKaleidoscopeEffect';
import { ConcentricRingsEffect } from './ConcentricRingsEffect';
import { GraphicEqualiserEffect } from './GraphicEqualiserEffect';
import { SoundWavesEffect } from './SoundWavesEffect';
import { MorphPolyhedronEffect } from './MorphPolyhedronEffect';
import { WarpedTorusEffect } from './WarpedTorusEffect';
import { PsychedelicEQEffect } from './PsychedelicEQEffect';
import { LaserShowEffect } from './LaserShowEffect';
import { FireEffect } from './FireEffect';
import { SuperScopeEffect } from './SuperScopeEffect';
import { MilkDropWarpEffect } from './MilkDropWarpEffect';
import { WaterRippleEffect } from './WaterRippleEffect';
import { TerrainEffect } from './TerrainEffect';
import { MatrixRainEffect } from './MatrixRainEffect';
import { RorschachEffect } from './RorschachEffect';
import { SpiralVortexEffect } from './SpiralVortexEffect';
import { NebulaCloudEffect } from './NebulaCloudEffect';
import { ElectricArcEffect } from './ElectricArcEffect';

export type EffectName = 'tunnel' | 'particles' | 'grid' | 'blob' | 'flowlines' | 'waveformRing' | 'fractal' | 'imageShatter' | 'metaballs' | 'helix' | 'starfield' | 'plasma' | 'voronoi' | 'aurora' | 'geoKaleidoscope' | 'rings' | 'equaliser' | 'soundwaves' | 'morphPoly' | 'warpedTorus' | 'psychedelicEQ' | 'laserShow' | 'fire' | 'superscope' | 'milkdrop' | 'waterRipple' | 'terrain' | 'matrixRain' | 'rorschach' | 'spiralVortex' | 'nebula' | 'electricArc';

export const effectRegistry: Record<EffectName, () => VisualEffect> = {
  tunnel: () => new TunnelEffect(),
  particles: () => new ParticleField(),
  grid: () => new WireframeGrid(),
  blob: () => new BlobOrb(),
  flowlines: () => new FlowLines(),
  waveformRing: () => new WaveformRing(),
  fractal: () => new FractalEffect(),
  imageShatter: () => new ImageShatter(),
  metaballs: () => new MetaballsEffect(),
  helix: () => new HelixEffect(),
  starfield: () => new StarfieldEffect(),
  plasma: () => new PlasmaWaveEffect(),
  voronoi: () => new VoronoiCrystalEffect(),
  aurora: () => new AuroraEffect(),
  geoKaleidoscope: () => new GeoKaleidoscopeEffect(),
  rings: () => new ConcentricRingsEffect(),
  equaliser: () => new GraphicEqualiserEffect(),
  soundwaves: () => new SoundWavesEffect(),
  morphPoly: () => new MorphPolyhedronEffect(),
  warpedTorus: () => new WarpedTorusEffect(),
  psychedelicEQ: () => new PsychedelicEQEffect(),
  laserShow: () => new LaserShowEffect(),
  fire: () => new FireEffect(),
  superscope: () => new SuperScopeEffect(),
  milkdrop: () => new MilkDropWarpEffect(),
  waterRipple: () => new WaterRippleEffect(),
  terrain: () => new TerrainEffect(),
  matrixRain: () => new MatrixRainEffect(),
  rorschach: () => new RorschachEffect(),
  spiralVortex: () => new SpiralVortexEffect(),
  nebula: () => new NebulaCloudEffect(),
  electricArc: () => new ElectricArcEffect(),
};

export { TunnelEffect, ParticleField, WireframeGrid, BlobOrb, FlowLines, WaveformRing, FractalEffect, ImageShatter, MetaballsEffect, HelixEffect, StarfieldEffect, PlasmaWaveEffect, VoronoiCrystalEffect, AuroraEffect, GeoKaleidoscopeEffect, ConcentricRingsEffect, GraphicEqualiserEffect, SoundWavesEffect, MorphPolyhedronEffect, WarpedTorusEffect, PsychedelicEQEffect, LaserShowEffect, FireEffect, SuperScopeEffect, MilkDropWarpEffect, WaterRippleEffect, TerrainEffect, MatrixRainEffect, RorschachEffect, SpiralVortexEffect, NebulaCloudEffect, ElectricArcEffect };
