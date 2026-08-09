import React, { useState } from 'react';
import { Sliders, Activity, Disc, Zap, Volume2 } from 'lucide-react';
import { SynthSettings, SynthWaveform, ScaleName } from '../types';
import { SCALES, noteToFreq } from '../utils/music';
import { audioEngine } from '../audio/engine';

interface SynthPanelProps {
  synth: SynthSettings;
  onChange: (synth: SynthSettings) => void;
  selectedScale: ScaleName;
}

export const SynthPanel: React.FC<SynthPanelProps> = ({ synth, onChange, selectedScale }) => {
  const [synthBypassed, setSynthBypassed] = useState<boolean>(() => !audioEngine.synthEnabled);
  const waveforms: SynthWaveform[] = ['sawtooth', 'square', 'sine', 'triangle'];

  const updateField = <K extends keyof SynthSettings>(key: K, value: SynthSettings[K]) => {
    onChange({ ...synth, [key]: value });
  };

  // Play live note test from piano roll
  const handlePlayTestNote = (note: string) => {
    audioEngine.ensureContext();
    audioEngine.triggerSynth(audioEngine.ctx!.currentTime, note, 0.4, synth, 0.9, 0);
  };

  // Compute SVG Points for ADSR Curve
  const svgWidth = 240;
  const svgHeight = 60;

  // Scale times for visual graph
  const totalT = Math.max(0.1, synth.attack + synth.decay + 0.3 + synth.release);
  const xA = (synth.attack / totalT) * (svgWidth * 0.7);
  const xD = xA + (synth.decay / totalT) * (svgWidth * 0.7);
  const xS = xD + 40; // fixed sustain width for visual
  const xR = Math.min(svgWidth - 5, xS + (synth.release / totalT) * (svgWidth * 0.7));

  const yPeak = 5;
  const ySustain = svgHeight - 5 - synth.sustain * (svgHeight - 10);
  const yBase = svgHeight - 5;

  const adsrPath = `M 5 ${yBase} L ${xA + 5} ${yPeak} L ${xD + 5} ${ySustain} L ${xS + 5} ${ySustain} L ${xR + 5} ${yBase}`;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-2xl text-zinc-100 flex flex-col gap-4">
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-purple-500/10 border border-purple-500/20 rounded-lg text-purple-400">
            <Activity className="w-4 h-4" />
          </div>
          <h2 className="font-bold text-sm tracking-tight text-white">Synthesizer Engine</h2>
        </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const next = !synthBypassed;
                setSynthBypassed(next);
                audioEngine.synthEnabled = !next; // synthEnabled true when not bypassed
              }}
              className={`px-2 py-1 rounded-lg text-xs font-mono transition border ${
                synthBypassed ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-bold' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700'
              }`}
              title="Toggle synth effects on/off"
            >
              {synthBypassed ? '✓ Synth FX Off' : 'Synth FX On'}
            </button>
            <span className="text-xs font-mono text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2.5 py-0.5 rounded-full">
              Dual Osc + ADSR + Filter
            </span>
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Section 1: Oscillators */}
        <div className="p-3 bg-zinc-950/70 border border-zinc-800/80 rounded-xl space-y-3">
          <h3 className="text-xs font-bold text-purple-300 uppercase font-mono tracking-wider flex items-center gap-1.5">
            <Disc className="w-3.5 h-3.5" /> Oscillators
          </h3>

          {/* Osc 1 Wave */}
          <div>
            <label className="text-[11px] font-mono text-zinc-400 block mb-1">Oscillator 1 Wave</label>
            <div className="grid grid-cols-4 gap-1">
              {waveforms.map((wave) => (
                <button
                  key={wave}
                  onClick={() => updateField('osc1Wave', wave)}
                  className={`py-1 text-[10px] font-mono capitalize rounded border transition ${
                    synth.osc1Wave === wave
                      ? 'bg-purple-600 text-white border-purple-400 font-bold'
                      : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
                  }`}
                >
                  {wave.slice(0, 4)}
                </button>
              ))}
            </div>
          </div>

          {/* Osc 2 Wave */}
          <div>
            <label className="text-[11px] font-mono text-zinc-400 block mb-1">Oscillator 2 Wave</label>
            <div className="grid grid-cols-4 gap-1">
              {waveforms.map((wave) => (
                <button
                  key={wave}
                  onClick={() => updateField('osc2Wave', wave)}
                  className={`py-1 text-[10px] font-mono capitalize rounded border transition ${
                    synth.osc2Wave === wave
                      ? 'bg-purple-600 text-white border-purple-400 font-bold'
                      : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
                  }`}
                >
                  {wave.slice(0, 4)}
                </button>
              ))}
            </div>
          </div>

          {/* Osc 2 Detune */}
          <div>
            <div className="flex justify-between items-center text-[11px] font-mono mb-1">
              <span className="text-zinc-400">Osc 2 Detune</span>
              <span className="text-purple-400 font-bold">{synth.osc2Detune} cents</span>
            </div>
            <input
              type="range"
              min={-100}
              max={100}
              value={synth.osc2Detune}
              onChange={(e) => updateField('osc2Detune', Number(e.target.value))}
              className="w-full accent-purple-500 cursor-pointer"
            />
          </div>

          {/* Sub Osc Volume */}
          <div>
            <div className="flex justify-between items-center text-[11px] font-mono mb-1">
              <span className="text-zinc-400">Sub (-1 Octave)</span>
              <span className="text-purple-400 font-bold">{Math.round(synth.subLevel * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={synth.subLevel}
              onChange={(e) => updateField('subLevel', Number(e.target.value))}
              className="w-full accent-purple-500 cursor-pointer"
            />
          </div>
        </div>

        {/* Section 2: Lowpass Filter & Resonance */}
        <div className="p-3 bg-zinc-950/70 border border-zinc-800/80 rounded-xl space-y-3">
          <h3 className="text-xs font-bold text-teal-300 uppercase font-mono tracking-wider flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5" /> Filter Cutoff & Sweep
          </h3>

          {/* Cutoff */}
          <div>
            <div className="flex justify-between items-center text-[11px] font-mono mb-1">
              <span className="text-zinc-400">Cutoff Frequency</span>
              <span className="text-teal-400 font-bold">{Math.round(synth.cutoff)} Hz</span>
            </div>
            <input
              type="range"
              min={20}
              max={12000}
              step={10}
              value={synth.cutoff}
              onChange={(e) => updateField('cutoff', Number(e.target.value))}
              className="w-full accent-teal-400 cursor-pointer"
            />
          </div>

          {/* Resonance */}
          <div>
            <div className="flex justify-between items-center text-[11px] font-mono mb-1">
              <span className="text-zinc-400">Resonance (Q)</span>
              <span className="text-teal-400 font-bold">{synth.resonance.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={18}
              step={0.5}
              value={synth.resonance}
              onChange={(e) => updateField('resonance', Number(e.target.value))}
              className="w-full accent-teal-400 cursor-pointer"
            />
          </div>

          {/* Env Sweep Amount */}
          <div>
            <div className="flex justify-between items-center text-[11px] font-mono mb-1">
              <span className="text-zinc-400">Filter Envelope Depth</span>
              <span className="text-teal-400 font-bold">+{Math.round(synth.envAmount)} Hz</span>
            </div>
            <input
              type="range"
              min={0}
              max={8000}
              step={100}
              value={synth.envAmount}
              onChange={(e) => updateField('envAmount', Number(e.target.value))}
              className="w-full accent-teal-400 cursor-pointer"
            />
          </div>

          {/* LFO Modulation */}
          <div className="pt-2 border-t border-zinc-800/60">
            <div className="flex justify-between items-center text-[11px] font-mono mb-1">
              <span className="text-zinc-400">LFO Rate & Target</span>
              <button
                onClick={() => updateField('lfoTarget', synth.lfoTarget === 'cutoff' ? 'pitch' : 'cutoff')}
                className="text-[10px] bg-zinc-900 border border-zinc-700 px-2 py-0.5 rounded text-teal-300 font-bold uppercase"
              >
                {synth.lfoTarget}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="range"
                min={0.1}
                max={15}
                step={0.1}
                value={synth.lfoRate}
                onChange={(e) => updateField('lfoRate', Number(e.target.value))}
                className="w-full accent-teal-400 cursor-pointer"
                title={`Rate: ${synth.lfoRate} Hz`}
              />
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={synth.lfoDepth}
                onChange={(e) => updateField('lfoDepth', Number(e.target.value))}
                className="w-full accent-teal-400 cursor-pointer"
                title={`Depth: ${Math.round(synth.lfoDepth * 100)}%`}
              />
            </div>
          </div>
        </div>

        {/* Section 3: ADSR Envelope */}
        <div className="p-3 bg-zinc-950/70 border border-zinc-800/80 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-amber-300 uppercase font-mono tracking-wider flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" /> ADSR Envelope
            </h3>
            <span className="text-[10px] font-mono text-zinc-500">Attack / Decay / Sustain / Release</span>
          </div>

          {/* SVG Envelope Visualizer */}
          <div className="w-full h-16 bg-zinc-900 border border-zinc-800 rounded-lg p-1 flex items-center justify-center">
            <svg width={svgWidth} height={svgHeight} className="w-full h-full">
              <path d={adsrPath} fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>

          {/* ADSR Sliders */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[10px] font-mono">
            <div>
              <div className="flex justify-between text-zinc-400">
                <span>Attack</span>
                <span className="text-amber-400 font-bold">{synth.attack.toFixed(2)}s</span>
              </div>
              <input
                type="range"
                min={0.001}
                max={1.5}
                step={0.01}
                value={synth.attack}
                onChange={(e) => updateField('attack', Number(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-zinc-400">
                <span>Decay</span>
                <span className="text-amber-400 font-bold">{synth.decay.toFixed(2)}s</span>
              </div>
              <input
                type="range"
                min={0.01}
                max={2.0}
                step={0.05}
                value={synth.decay}
                onChange={(e) => updateField('decay', Number(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-zinc-400">
                <span>Sustain</span>
                <span className="text-amber-400 font-bold">{Math.round(synth.sustain * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1.0}
                step={0.05}
                value={synth.sustain}
                onChange={(e) => updateField('sustain', Number(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-zinc-400">
                <span>Release</span>
                <span className="text-amber-400 font-bold">{synth.release.toFixed(2)}s</span>
              </div>
              <input
                type="range"
                min={0.01}
                max={3.0}
                step={0.05}
                value={synth.release}
                onChange={(e) => updateField('release', Number(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Piano Roll / Live Audition Keyboard */}
      <div className="p-3 bg-zinc-950/80 border border-zinc-800 rounded-xl space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider">
            Live Audition Piano Roll ({selectedScale} scale)
          </span>
          <span className="text-[10px] text-zinc-500 font-mono">Click keys to preview synth sound</span>
        </div>

        <div className="flex gap-1 overflow-x-auto pb-1">
          {SCALES[selectedScale].map((note) => {
            const isSharp = note.includes('#');
            return (
              <button
                key={note}
                onClick={() => handlePlayTestNote(note)}
                className={`h-12 min-w-10 rounded-b-lg font-mono text-[10px] font-bold transition flex flex-col justify-end p-1 border ${
                  isSharp
                    ? 'bg-zinc-800 hover:bg-zinc-700 text-purple-300 border-zinc-700 shadow-inner'
                    : 'bg-zinc-100 hover:bg-white text-zinc-900 border-zinc-300 shadow'
                }`}
              >
                <span>{note}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
