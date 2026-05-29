export interface AudioCaptureConfig {
  deviceId: string | undefined;
  fftSize: number;
  smoothingTimeConstant: number;
}

export class AudioCapture {
  private audioContext: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;

  get analyser(): AnalyserNode | null {
    return this.analyserNode;
  }

  get context(): AudioContext | null {
    return this.audioContext;
  }

  async start(config: AudioCaptureConfig): Promise<void> {
    const constraints: MediaStreamConstraints = {
      audio: config.deviceId
        ? { deviceId: { exact: config.deviceId } }
        : true,
    };

    this.stream = await navigator.mediaDevices.getUserMedia(constraints);
    this.audioContext = new AudioContext({ sampleRate: 44100 });
    this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);
    this.analyserNode = this.audioContext.createAnalyser();
    this.analyserNode.fftSize = config.fftSize;
    this.analyserNode.smoothingTimeConstant = config.smoothingTimeConstant;
    this.sourceNode.connect(this.analyserNode);
    // Do NOT connect to destination to avoid feedback
  }

  stop(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.analyserNode = null;
  }

  static async listDevices(): Promise<MediaDeviceInfo[]> {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === 'audioinput');
  }
}
