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

export type EffectName = 'tunnel' | 'particles' | 'grid' | 'blob' | 'flowlines' | 'waveformRing' | 'fractal' | 'imageShatter' | 'metaballs' | 'helix' | 'starfield' | 'plasma' | 'voronoi' | 'aurora' | 'geoKaleidoscope' | 'rings' | 'equaliser' | 'soundwaves' | 'morphPoly' | 'warpedTorus' | 'psychedelicEQ' | 'laserShow';

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
};

export { TunnelEffect, ParticleField, WireframeGrid, BlobOrb, FlowLines, WaveformRing, FractalEffect, ImageShatter, MetaballsEffect, HelixEffect, StarfieldEffect, PlasmaWaveEffect, VoronoiCrystalEffect, AuroraEffect, GeoKaleidoscopeEffect, ConcentricRingsEffect, GraphicEqualiserEffect, SoundWavesEffect, MorphPolyhedronEffect, WarpedTorusEffect, PsychedelicEQEffect, LaserShowEffect };
