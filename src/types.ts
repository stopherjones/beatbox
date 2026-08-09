export type SoundType = 
  | 'kick'
  | 'snare'
  | 'hihat_closed'
  | 'hihat_open'
  | 'clap'
  | 'tom'
  | 'perc'
  | 'synth'
  | 'bass'
  | 'piano_single'
  | 'piano_chord';

export type SynthWaveform = 'sawtooth' | 'square' | 'sine' | 'triangle';

export type ScaleName = 
  | 'minor'
  | 'major'
  | 'pentatonic'
  | 'blues'
  | 'dorian'
  | 'synthwave'
  | 'chromatic';

export interface Step {
  active: boolean;
  note: string; // e.g. "C3", "D#3"
  velocity: number; // 0.1 to 1.0
  pitchOffset?: number; // semi-tones
}

export interface Track {
  id: string;
  name: string;
  type: 'drum' | 'synth';
  sound: SoundType;
  muted: boolean;
  soloed: boolean;
  volume: number; // 0 to 1
  pan: number; // -1 to 1
  steps: Step[];
  color: string;
}

export interface SynthSettings {
  osc1Wave: SynthWaveform;
  osc2Wave: SynthWaveform;
  osc2Detune: number; // cents (-1200 to +1200)
  subLevel: number; // 0 to 1
  cutoff: number; // 20 to 15000 Hz
  resonance: number; // 0 to 20
  envAmount: number; // 0 to 10000 Hz filter sweep
  attack: number; // 0.001 to 2.0 s
  decay: number; // 0.01 to 3.0 s
  sustain: number; // 0 to 1
  release: number; // 0.01 to 4.0 s
  lfoRate: number; // 0.1 to 20 Hz
  lfoDepth: number; // 0 to 1
  lfoTarget: 'cutoff' | 'pitch';
}

export interface FXSettings {
  delayTime: number; // 0.05 to 1.0 s
  delayFeedback: number; // 0 to 0.85
  delayMix: number; // 0 to 1
  reverbDecay: number; // 0.5 to 5.0 s
  reverbMix: number; // 0 to 1
  distortion: number; // 0 to 10
}

export interface Pattern {
  id: string;
  name: string;
  tracks: Track[];
  synthSettings: SynthSettings;
  fxSettings: FXSettings;
  bpm: number;
  swing: number; // 0 to 50 %
  stepCount: number; // 16 or 32
}

export interface SongBlock {
  id: string;
  patternId: string;
  repeats: number;
}

export interface Preset {
  id: string;
  name: string;
  genre: string;
  description: string;
  pattern: Pattern;
}

export interface ProjectFile {
  version: number;
  type: 'beatmaker_project';
  name: string;
  savedAt: string;
  bpm: number;
  swing: number;
  stepCount: number;
  activePatternId: string;
  patterns: Pattern[];
  songBlocks: SongBlock[];
  isSongMode: boolean;
  synthSettings: SynthSettings;
  fxSettings: FXSettings;
  selectedScale?: ScaleName;
}

