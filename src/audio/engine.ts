import { FXSettings, SynthSettings, Track, SoundType } from '../types';
import { noteToFreq, transposeNote } from '../utils/music';

class AudioEngine {
  public ctx: AudioContext | null = null;
  public masterGain: GainNode | null = null;
  public analyser: AnalyserNode | null = null;
  public synthEnabled: boolean = true;
  
  private delayNode: DelayNode | null = null;
  private delayFeedbackGain: GainNode | null = null;
  private delayWetGain: GainNode | null = null;
  
  private reverbConvolver: ConvolverNode | null = null;
  private reverbWetGain: GainNode | null = null;

  private distortionNode: WaveShaperNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;

  private isInitialized = false;

  public init() {
    if (this.isInitialized && this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }

    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioContextClass();

    // Master Compressor / Limiter
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.setValueAtTime(-12, this.ctx.currentTime);
    this.compressor.knee.setValueAtTime(10, this.ctx.currentTime);
    this.compressor.ratio.setValueAtTime(4, this.ctx.currentTime);
    this.compressor.attack.setValueAtTime(0.005, this.ctx.currentTime);
    this.compressor.release.setValueAtTime(0.1, this.ctx.currentTime);

    // Analyser Node for Visualizers
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 512;

    // Master Gain
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.8;

    // Distortion Node
    this.distortionNode = this.ctx.createWaveShaper();
    this.distortionNode.curve = this.makeDistortionCurve(0);

    // Delay Node Setup
    this.delayNode = this.ctx.createDelay(2.0);
    this.delayNode.delayTime.value = 0.25; // default 1/8 note approx

    this.delayFeedbackGain = this.ctx.createGain();
    this.delayFeedbackGain.gain.value = 0.3;

    this.delayWetGain = this.ctx.createGain();
    this.delayWetGain.gain.value = 0.2;

    this.delayNode.connect(this.delayFeedbackGain);
    this.delayFeedbackGain.connect(this.delayNode);
    this.delayNode.connect(this.delayWetGain);

    // Reverb Convolver Setup
    this.reverbConvolver = this.ctx.createConvolver();
    this.reverbWetGain = this.ctx.createGain();
    this.reverbWetGain.gain.value = 0.25;
    this.reverbConvolver.buffer = this.createImpulseResponse(2.0, 2.0);
    this.reverbConvolver.connect(this.reverbWetGain);

    // Routing Graph:
    // Input -> Distortion -> Delay & Reverb & Direct -> Compressor -> Master Gain -> Analyser -> Destination
    this.delayWetGain.connect(this.compressor);
    this.reverbWetGain.connect(this.compressor);

    this.compressor.connect(this.masterGain);
    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

    this.isInitialized = true;
  }

  public ensureContext(): AudioContext {
    if (!this.ctx) {
      this.init();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx!;
  }

  // Update Effects parameters in real-time
  public updateFX(fx: FXSettings) {
    if (!this.ctx || !this.isInitialized) return;

    if (this.delayNode && this.delayFeedbackGain && this.delayWetGain) {
      this.delayNode.delayTime.setTargetAtTime(fx.delayTime, this.ctx.currentTime, 0.05);
      this.delayFeedbackGain.gain.setTargetAtTime(fx.delayFeedback, this.ctx.currentTime, 0.05);
      this.delayWetGain.gain.setTargetAtTime(fx.delayMix, this.ctx.currentTime, 0.05);
    }

    if (this.reverbWetGain && this.reverbConvolver) {
      this.reverbWetGain.gain.setTargetAtTime(fx.reverbMix, this.ctx.currentTime, 0.05);
      // Re-generate reverb buffer if decay changed significantly
      this.reverbConvolver.buffer = this.createImpulseResponse(fx.reverbDecay, 2.0);
    }

    if (this.distortionNode) {
      this.distortionNode.curve = this.makeDistortionCurve(fx.distortion);
    }
  }

  // Distort curve algorithm
  private makeDistortionCurve(amount: number): Float32Array {
    const k = Math.max(0, amount * 10);
    const nSamples = 44100;
    const curve = new Float32Array(nSamples);
    const deg = Math.PI / 180;

    for (let i = 0; i < nSamples; ++i) {
      const x = (i * 2) / nSamples - 1;
      if (k === 0) {
        curve[i] = x;
      } else {
        curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
      }
    }
    return curve;
  }

  // Synthetic Reverb Impulse Response generator
  private createImpulseResponse(duration: number, decay: number): AudioBuffer {
    const ctx = this.ensureContext();
    const rate = ctx.sampleRate;
    const length = rate * duration;
    const impulse = ctx.createBuffer(2, length, rate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const n = i;
      const dec = Math.pow(1 - n / length, decay);
      left[i] = (Math.random() * 2 - 1) * dec;
      right[i] = (Math.random() * 2 - 1) * dec;
    }
    return impulse;
  }

  // Helper to attach output to FX pipeline
  private connectToFX(sourceNode: AudioNode, panValue: number) {
    const ctx = this.ensureContext();
    
    // Stereo Panner Node
    let panner: StereoPannerNode | null = null;
    if (ctx.createStereoPanner) {
      panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, panValue));
    }

    const nodeToRoute = panner ? sourceNode.connect(panner) : sourceNode;

    // Send to direct, distortion, delay, and reverb
    if (this.distortionNode && this.compressor) {
      nodeToRoute.connect(this.distortionNode);
      this.distortionNode.connect(this.compressor);
    } else if (this.compressor) {
      nodeToRoute.connect(this.compressor);
    }

    if (this.delayNode) {
      nodeToRoute.connect(this.delayNode);
    }
    if (this.reverbConvolver) {
      nodeToRoute.connect(this.reverbConvolver);
    }
  }

  // Metronome tick
  public triggerMetronome(time: number, isAccent: boolean = false) {
    const ctx = this.ensureContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(isAccent ? 1200 : 800, time);

    gain.gain.setValueAtTime(isAccent ? 0.25 : 0.12, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(time);
    osc.stop(time + 0.04);
  }

  // --- SOUND SYNTHESIS ENGINE ---

  // 1. Kick Drum
  public triggerKick(time: number, volume: number = 1.0, pan: number = 0) {
    const ctx = this.ensureContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    
    // Pitch envelope: Start high (150Hz) and quickly sweep down to sub-bass (35Hz)
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(35, time + 0.12);

    // Gain envelope: Click attack and punchy decay
    gain.gain.setValueAtTime(volume * 1.2, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.45);

    osc.connect(gain);
    this.connectToFX(gain, pan);

    osc.start(time);
    osc.stop(time + 0.45);
  }

  // 2. Snare Drum
  public triggerSnare(time: number, volume: number = 1.0, pan: number = 0) {
    const ctx = this.ensureContext();

    // Noise component (Snare wire)
    const noiseBuffer = this.createNoiseBuffer(ctx, 0.2);
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.setValueAtTime(1000, time);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(volume * 0.8, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);

    // Tonal body (Snare drum shell pop)
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, time);
    osc.frequency.exponentialRampToValueAtTime(80, time + 0.1);

    oscGain.gain.setValueAtTime(volume * 0.7, time);
    oscGain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);

    osc.connect(oscGain);

    // Combine
    const snareMix = ctx.createGain();
    noiseGain.connect(snareMix);
    oscGain.connect(snareMix);

    this.connectToFX(snareMix, pan);

    noise.start(time);
    osc.start(time);
    noise.stop(time + 0.2);
    osc.stop(time + 0.2);
  }

  // 3. Hi-Hat (Closed / Open)
  public triggerHiHat(time: number, isOpen: boolean, volume: number = 1.0, pan: number = 0) {
    const ctx = this.ensureContext();
    const duration = isOpen ? 0.35 : 0.06;

    const noiseBuffer = this.createNoiseBuffer(ctx, duration);
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    // Highpass filter for crisp metallic hi-hat frequency
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(7000, time);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume * 0.6, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    noise.connect(filter);
    filter.connect(gain);

    this.connectToFX(gain, pan);

    noise.start(time);
    noise.stop(time + duration);
  }

  // 4. Clap
  public triggerClap(time: number, volume: number = 1.0, pan: number = 0) {
    const ctx = this.ensureContext();
    const duration = 0.25;

    const noiseBuffer = this.createNoiseBuffer(ctx, duration);
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, time);
    filter.Q.value = 1.0;

    const gain = ctx.createGain();
    // Multi-burst envelope simulating hands hitting
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.setValueAtTime(volume * 0.7, time + 0.01);
    gain.gain.setValueAtTime(volume * 0.2, time + 0.02);
    gain.gain.setValueAtTime(volume * 0.8, time + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    noise.connect(filter);
    filter.connect(gain);

    this.connectToFX(gain, pan);

    noise.start(time);
    noise.stop(time + duration);
  }

  // 5. Tom
  public triggerTom(time: number, pitchOffset: number = 0, volume: number = 1.0, pan: number = 0) {
    const ctx = this.ensureContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const baseFreq = 110 * Math.pow(2, pitchOffset / 12);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq * 1.5, time);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.5, time + 0.25);

    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);

    osc.connect(gain);
    this.connectToFX(gain, pan);

    osc.start(time);
    osc.stop(time + 0.3);
  }

  // 6. Percussion / Woodblock
  public triggerPerc(time: number, pitchOffset: number = 0, volume: number = 1.0, pan: number = 0) {
    const ctx = this.ensureContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const baseFreq = 800 * Math.pow(2, pitchOffset / 12);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(baseFreq, time);

    gain.gain.setValueAtTime(volume * 0.8, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

    osc.connect(gain);
    this.connectToFX(gain, pan);

    osc.start(time);
    osc.stop(time + 0.08);
  }

  // 7. Synthesizer Note (Dual Oscillator + ADSR + Filter + LFO)
  public triggerSynth(
    time: number,
    note: string,
    durationSeconds: number,
    synth: SynthSettings,
    volume: number = 1.0,
    pan: number = 0
  ) {
    const ctx = this.ensureContext();
    const freq = noteToFreq(note);

    // Osc 1
    const osc1 = ctx.createOscillator();
    osc1.type = synth.osc1Wave;
    osc1.frequency.setValueAtTime(freq, time);

    // Osc 2 (Detuned)
    const osc2 = ctx.createOscillator();
    osc2.type = synth.osc2Wave;
    osc2.frequency.setValueAtTime(freq, time);
    osc2.detune.setValueAtTime(synth.osc2Detune, time);

    // Sub Oscillator (-1 Octave)
    const subOsc = ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(freq / 2, time);

    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(synth.subLevel, time);
    subOsc.connect(subGain);

    // Combine Oscillators
    const oscMix = ctx.createGain();
    oscMix.gain.setValueAtTime(0.4 * volume, time);

    osc1.connect(oscMix);
    osc2.connect(oscMix);
    subGain.connect(oscMix);

    let filter: BiquadFilterNode | null = null;

    if (this.synthEnabled) {
      // Biquad Filter (Lowpass)
      filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.setValueAtTime(synth.resonance, time);

      // Filter Envelope Sweep
      const baseCutoff = Math.max(20, Math.min(18000, synth.cutoff));
      const peakCutoff = Math.max(20, Math.min(18000, baseCutoff + synth.envAmount));

      filter.frequency.setValueAtTime(baseCutoff, time);
      filter.frequency.exponentialRampToValueAtTime(peakCutoff, time + Math.max(0.01, synth.attack));
      filter.frequency.exponentialRampToValueAtTime(
        Math.max(20, baseCutoff + (peakCutoff - baseCutoff) * synth.sustain),
        time + synth.attack + synth.decay
      );

      // LFO Modulation
      if (synth.lfoDepth > 0) {
        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(synth.lfoRate, time);

        const lfoGain = ctx.createGain();
        if (synth.lfoTarget === 'cutoff') {
          lfoGain.gain.setValueAtTime(synth.lfoDepth * 1500, time);
          lfo.connect(lfoGain);
          lfoGain.connect(filter.frequency);
        } else {
          lfoGain.gain.setValueAtTime(synth.lfoDepth * 50, time); // Pitch vibrato
          lfo.connect(lfoGain);
          lfoGain.connect(osc1.detune);
          lfoGain.connect(osc2.detune);
        }
        lfo.start(time);
        lfo.stop(time + durationSeconds + synth.release);
      }
    }

    // Main ADSR Gain Envelope
    const adsrGain = ctx.createGain();
    const startTime = time;
    const attackEnd = startTime + Math.max(0.005, synth.attack);
    const decayEnd = attackEnd + Math.max(0.01, synth.decay);
    const releaseStart = startTime + durationSeconds;
    const releaseEnd = releaseStart + Math.max(0.01, synth.release);

    adsrGain.gain.setValueAtTime(0, startTime);
    adsrGain.gain.linearRampToValueAtTime(1.0, attackEnd);
    adsrGain.gain.exponentialRampToValueAtTime(Math.max(0.001, synth.sustain), decayEnd);
    adsrGain.gain.setValueAtTime(Math.max(0.001, synth.sustain), releaseStart);
    adsrGain.gain.exponentialRampToValueAtTime(0.0001, releaseEnd);

    // Routing: Oscs -> Filter -> ADSR -> FX
    if (filter) {
      oscMix.connect(filter);
      filter.connect(adsrGain);
    } else {
      oscMix.connect(adsrGain);
    }

    this.connectToFX(adsrGain, pan);

    osc1.start(time);
    osc2.start(time);
    subOsc.start(time);

    osc1.stop(releaseEnd);
    osc2.stop(releaseEnd);
    subOsc.stop(releaseEnd);
  }

  // Trigger track preview
  public triggerTrackSample(track: Track, synthSettings: SynthSettings, time: number = 0) {
    const ctx = this.ensureContext();
    const t = time || ctx.currentTime;
    
    if (track.type === 'synth') {
      if (track.sound === 'bass') {
        this.triggerSynth(t, 'C2', 0.25, synthSettings, track.volume, track.pan);
        return;
      }
      if (track.sound === 'piano_chord') {
        this.triggerSynth(t, 'C3', 0.25, synthSettings, track.volume, track.pan);
        this.triggerSynth(t, 'E3', 0.25, synthSettings, track.volume * 0.8, track.pan);
        this.triggerSynth(t, 'G3', 0.25, synthSettings, track.volume * 0.8, track.pan);
        return;
      }

      this.triggerSynth(t, 'C3', 0.25, synthSettings, track.volume, track.pan);
      return;
    }

    switch (track.sound) {
      case 'kick':
        this.triggerKick(t, track.volume, track.pan);
        break;
      case 'snare':
        this.triggerSnare(t, track.volume, track.pan);
        break;
      case 'hihat_closed':
        this.triggerHiHat(t, false, track.volume, track.pan);
        break;
      case 'hihat_open':
        this.triggerHiHat(t, true, track.volume, track.pan);
        break;
      case 'clap':
        this.triggerClap(t, track.volume, track.pan);
        break;
      case 'tom':
        this.triggerTom(t, 0, track.volume, track.pan);
        break;
      case 'perc':
        this.triggerPerc(t, 0, track.volume, track.pan);
        break;
      default:
        this.triggerKick(t, track.volume, track.pan);
    }
  }

  // Create White Noise buffer
  private createNoiseBuffer(ctx: AudioContext, duration: number): AudioBuffer {
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  // --- WAV RENDERER FOR AUDIO EXPORT ---
  public async renderWav(
    tracks: Track[],
    synthSettings: SynthSettings,
    fx: FXSettings,
    bpm: number,
    swing: number,
    repeats: number = 2
  ): Promise<Blob> {
    const stepCount = tracks[0]?.steps.length || 16;
    const secondsPerBeat = 60 / bpm;
    const secondsPerStep = secondsPerBeat / 4;
    const totalDuration = stepCount * secondsPerStep * repeats + 2.0; // 2s tail for delay/reverb decay

    const sampleRate = 44100;
    const offlineCtx = new OfflineAudioContext(2, sampleRate * totalDuration, sampleRate);

    // We replace ensureContext with offlineCtx inside render pass
    // Render loop over steps
    for (let rep = 0; rep < repeats; rep++) {
      for (let stepIdx = 0; stepIdx < stepCount; stepIdx++) {
        let stepTime = (rep * stepCount + stepIdx) * secondsPerStep;
        
        // Swing offset on odd 16th steps
        if (stepIdx % 2 === 1 && swing > 0) {
          stepTime += secondsPerStep * (swing / 100) * 0.6;
        }

        // Has soloed track?
        const hasSolo = tracks.some(t => t.soloed);

        tracks.forEach((track) => {
          if (track.muted) return;
          if (hasSolo && !track.soloed) return;

          const step = track.steps[stepIdx];
          if (!step || !step.active) return;

          const vol = track.volume * step.velocity;

          if (track.type === 'synth') {
            const note = step.note || 'C3';
            if (track.sound === 'bass') {
              this.renderOfflineSynth(offlineCtx, stepTime, transposeNote(note, -12), secondsPerStep * 0.9, synthSettings, vol);
            } else if (track.sound === 'piano_chord') {
              this.renderOfflineSynth(offlineCtx, stepTime, note, secondsPerStep * 0.9, synthSettings, vol);
              this.renderOfflineSynth(offlineCtx, stepTime, transposeNote(note, 4), secondsPerStep * 0.9, synthSettings, vol * 0.8);
              this.renderOfflineSynth(offlineCtx, stepTime, transposeNote(note, 7), secondsPerStep * 0.9, synthSettings, vol * 0.8);
            } else {
              this.renderOfflineSynth(offlineCtx, stepTime, note, secondsPerStep * 0.9, synthSettings, vol);
            }
          } else {
            this.renderOfflineDrum(offlineCtx, stepTime, track.sound, vol);
          }
        });
      }
    }

    const renderedBuffer = await offlineCtx.startRendering();
    return this.bufferToWavBlob(renderedBuffer);
  }

  private renderOfflineDrum(ctx: OfflineAudioContext, time: number, sound: SoundType, vol: number) {
    // Basic drum synthesis on Offline context
    if (sound === 'kick') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.setValueAtTime(150, time);
      osc.frequency.exponentialRampToValueAtTime(35, time + 0.12);
      gain.gain.setValueAtTime(vol * 1.2, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(time);
      osc.stop(time + 0.45);
    } else if (sound === 'snare') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, time);
      osc.frequency.exponentialRampToValueAtTime(80, time + 0.1);
      gain.gain.setValueAtTime(vol * 0.8, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(time);
      osc.stop(time + 0.15);
    } else {
      // HiHat / Clap
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(800, time);
      gain.gain.setValueAtTime(vol * 0.5, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(time);
      osc.stop(time + 0.1);
    }
  }

  private renderOfflineSynth(
    ctx: OfflineAudioContext,
    time: number,
    note: string,
    duration: number,
    synth: SynthSettings,
    vol: number
  ) {
    const freq = noteToFreq(note);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = synth.osc1Wave;
    osc.frequency.setValueAtTime(freq, time);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(vol, time + synth.attack);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, vol * synth.sustain), time + synth.attack + synth.decay);
    gain.gain.setValueAtTime(Math.max(0.001, vol * synth.sustain), time + duration);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration + synth.release);

    if (this.synthEnabled) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(synth.cutoff, time);
      osc.connect(filter);
      filter.connect(gain);
    } else {
      osc.connect(gain);
    }

    gain.connect(ctx.destination);

    osc.start(time);
    osc.stop(time + duration + synth.release);
  }

  // Convert AudioBuffer to WAV format binary Blob
  private bufferToWavBlob(buffer: AudioBuffer): Blob {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    
    let result: Float32Array;
    if (numChannels === 2) {
      const left = buffer.getChannelData(0);
      const right = buffer.getChannelData(1);
      result = new Float32Array(left.length + right.length);
      for (let i = 0; i < left.length; i++) {
        result[i * 2] = left[i];
        result[i * 2 + 1] = right[i];
      }
    } else {
      result = buffer.getChannelData(0);
    }

    const dataLength = result.length * (bitDepth / 8);
    const bufferArray = new ArrayBuffer(44 + dataLength);
    const view = new DataView(bufferArray);

    /* RIFF identifier */
    this.writeString(view, 0, 'RIFF');
    /* RIFF chunk length */
    view.setUint32(4, 36 + dataLength, true);
    /* RIFF type */
    this.writeString(view, 8, 'WAVE');
    /* format chunk identifier */
    this.writeString(view, 12, 'fmt ');
    /* format chunk length */
    view.setUint32(16, 16, true);
    /* sample format (raw) */
    view.setUint16(20, format, true);
    /* channel count */
    view.setUint16(22, numChannels, true);
    /* sample rate */
    view.setUint32(24, sampleRate, true);
    /* byte rate (sample rate * block align) */
    view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
    /* block align (channel count * bytes per sample) */
    view.setUint16(32, numChannels * (bitDepth / 8), true);
    /* bits per sample */
    view.setUint16(34, bitDepth, true);
    /* data chunk identifier */
    this.writeString(view, 36, 'data');
    /* data chunk length */
    view.setUint32(40, dataLength, true);

    // Float to PCM 16-bit
    let offset = 44;
    for (let i = 0; i < result.length; i++) {
      const s = Math.max(-1, Math.min(1, result[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }

    return new Blob([view], { type: 'audio/wav' });
  }

  private writeString(view: DataView, offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }
}

export const audioEngine = new AudioEngine();
