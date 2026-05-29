export interface AudioFeatures {
  sub: number;
  bass: number;
  lowMid: number;
  mid: number;
  highMid: number;
  treble: number;
  energy: number;
  spectralFlux: number;
  onset: boolean;
  onsetStrength: number;
  bpm: number;
  beatPhase: number;
}

export class AudioAnalyzer {
  private analyser: AnalyserNode;
  private sampleRate: number;
  private fftSize: number;
  private freqData: Float32Array;
  private prevMagnitudes: Float32Array;
  private fluxHistory: number[] = [];
  private onsetTimes: number[] = [];
  private lastOnsetTime = 0;
  private rollingMax = 1;

  constructor(analyser: AnalyserNode, sampleRate: number) {
    this.analyser = analyser;
    this.sampleRate = sampleRate;
    this.fftSize = analyser.fftSize;
    const binCount = analyser.frequencyBinCount;
    this.freqData = new Float32Array(new ArrayBuffer(binCount * 4));
    this.prevMagnitudes = new Float32Array(new ArrayBuffer(binCount * 4));
  }

  analyze(time: number): AudioFeatures {
    const binCount = this.analyser.frequencyBinCount;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.analyser.getFloatFrequencyData(this.freqData as any);

    const binWidth = this.sampleRate / this.fftSize;

    // Convert dB to linear and compute band energies
    const getBandEnergy = (lowHz: number, highHz: number): number => {
      const lowBin = Math.floor(lowHz / binWidth);
      const highBin = Math.min(Math.ceil(highHz / binWidth), binCount - 1);
      let sum = 0;
      for (let i = lowBin; i <= highBin; i++) {
        // freqData is in dB, convert to linear amplitude
        const linear = Math.pow(10, this.freqData[i] / 20);
        sum += linear;
      }
      return sum / (highBin - lowBin + 1);
    };

    const sub = getBandEnergy(20, 60);
    const bass = getBandEnergy(60, 150);
    const lowMid = getBandEnergy(150, 400);
    const mid = getBandEnergy(400, 2000);
    const highMid = getBandEnergy(2000, 6000);
    const treble = getBandEnergy(6000, 12000);

    // Overall RMS energy
    let rms = 0;
    for (let i = 0; i < binCount; i++) {
      const linear = Math.pow(10, this.freqData[i] / 20);
      rms += linear * linear;
    }
    rms = Math.sqrt(rms / binCount);

    // Normalise against rolling max
    const rawEnergy = sub + bass + lowMid + mid + highMid + treble;
    this.rollingMax = Math.max(this.rollingMax * 0.999, rawEnergy);
    const normFactor = this.rollingMax > 0 ? 1 / this.rollingMax : 1;

    // Spectral flux (onset detection)
    let flux = 0;
    for (let i = 0; i < binCount; i++) {
      const current = Math.pow(10, this.freqData[i] / 20);
      const diff = current - this.prevMagnitudes[i];
      if (diff > 0) flux += diff;
      this.prevMagnitudes[i] = current;
    }

    this.fluxHistory.push(flux);
    if (this.fluxHistory.length > 43) this.fluxHistory.shift();

    // Median of flux history
    const sorted = [...this.fluxHistory].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];

    // Onset detection
    const onsetThreshold = median * 1.5;
    const onset = flux > onsetThreshold && (time - this.lastOnsetTime) > 0.1;
    if (onset) {
      this.lastOnsetTime = time;
      this.onsetTimes.push(time);
      // Keep last 8 seconds
      while (this.onsetTimes.length > 0 && this.onsetTimes[0] < time - 8) {
        this.onsetTimes.shift();
      }
    }

    // BPM estimation
    let bpm = 120;
    if (this.onsetTimes.length > 2) {
      const intervals: number[] = [];
      for (let i = 1; i < this.onsetTimes.length; i++) {
        intervals.push(this.onsetTimes[i] - this.onsetTimes[i - 1]);
      }
      // Find dominant interval
      intervals.sort((a, b) => a - b);
      const medianInterval = intervals[Math.floor(intervals.length / 2)];
      if (medianInterval > 0) {
        bpm = Math.round(60 / medianInterval);
        bpm = Math.max(60, Math.min(180, bpm));
      }
    }

    // Beat phase
    const beatInterval = 60 / bpm;
    const beatPhase = ((time % beatInterval) / beatInterval);

    const norm = (v: number) => Math.min(1, v * normFactor * 6);

    return {
      sub: norm(sub),
      bass: norm(bass),
      lowMid: norm(lowMid),
      mid: norm(mid),
      highMid: norm(highMid),
      treble: norm(treble),
      energy: Math.min(1, rms * 10),
      spectralFlux: flux,
      onset,
      onsetStrength: flux / Math.max(onsetThreshold, 0.001),
      bpm,
      beatPhase,
    };
  }

  getFrequencyData(): Float32Array {
    return this.freqData;
  }
}
