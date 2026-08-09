import React, { useRef, useState } from 'react';
import { Sliders, Sparkles, Waves, Flame, Radio } from 'lucide-react';
import { FXSettings } from '../types';
import { Visualizer } from './Visualizer';

interface FXPanelProps {
  fx: FXSettings;
  onChange: (fx: FXSettings) => void;
  isPlaying: boolean;
}

export const FXPanel: React.FC<FXPanelProps> = ({ fx, onChange, isPlaying }) => {
  const updateField = <K extends keyof FXSettings>(key: K, value: FXSettings[K]) => {
    onChange({ ...fx, [key]: value });
  };

  const [fxBypassed, setFxBypassed] = useState(false);
  const savedFxRef = useRef<FXSettings | null>(null);

  const handleToggleFxBypass = () => {
    if (!fxBypassed) {
      // save current fx and set mixes to zero
      savedFxRef.current = fx;
      onChange({
        delayTime: fx.delayTime || 0.2,
        delayFeedback: 0,
        delayMix: 0,
        reverbDecay: fx.reverbDecay || 1.5,
        reverbMix: 0,
        distortion: 0,
      });
      setFxBypassed(true);
    } else {
      // restore saved fx if present
      if (savedFxRef.current) {
        onChange(savedFxRef.current);
      }
      setFxBypassed(false);
    }
  };

  const hasActiveFX = fx.delayMix > 0 || fx.reverbMix > 0 || fx.distortion > 0;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-2xl text-zinc-100 flex flex-col gap-4">
      {/* Panel Header */}
      <div className="flex flex-wrap items-center justify-between border-b border-zinc-800 pb-3 gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <h2 className="font-bold text-sm tracking-tight text-white">Audio FX & Master Chain</h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleFxBypass}
            className={`px-2.5 py-1 rounded-lg text-xs font-mono transition border ${
              fxBypassed || !hasActiveFX
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-bold'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700'
            }`}
            title="Toggle FX bypass (dry/wet)"
          >
            {fxBypassed || !hasActiveFX ? '✓ FX Off (Bypassed)' : 'Bypass All FX'}
          </button>
          <span className="text-xs font-mono text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-0.5 rounded-full hidden sm:inline-block">
            Delay + Reverb + Overdrive
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Stereo Delay Unit */}
        <div className="p-3 bg-zinc-950/70 border border-zinc-800/80 rounded-xl space-y-3">
          <h3 className="text-xs font-bold text-blue-300 uppercase font-mono tracking-wider flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5" /> Stereo Echo Delay
          </h3>

          {/* Delay Time */}
          <div>
            <div className="flex justify-between items-center text-[11px] font-mono mb-1">
              <span className="text-zinc-400">Delay Time</span>
              <span className="text-blue-400 font-bold">{Math.round(fx.delayTime * 1000)} ms</span>
            </div>
            <input
              type="range"
              min={0.05}
              max={0.9}
              step={0.02}
              value={fx.delayTime}
              onChange={(e) => updateField('delayTime', Number(e.target.value))}
              className="w-full accent-blue-400 cursor-pointer"
            />
          </div>

          {/* Feedback */}
          <div>
            <div className="flex justify-between items-center text-[11px] font-mono mb-1">
              <span className="text-zinc-400">Feedback Repeats</span>
              <span className="text-blue-400 font-bold">{Math.round(fx.delayFeedback * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={0.8}
              step={0.05}
              value={fx.delayFeedback}
              onChange={(e) => updateField('delayFeedback', Number(e.target.value))}
              className="w-full accent-blue-400 cursor-pointer"
            />
          </div>

          {/* Mix */}
          <div>
            <div className="flex justify-between items-center text-[11px] font-mono mb-1">
              <span className="text-zinc-400">Wet/Dry Mix</span>
              <span className="text-blue-400 font-bold">{Math.round(fx.delayMix * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={0.8}
              step={0.05}
              value={fx.delayMix}
              onChange={(e) => updateField('delayMix', Number(e.target.value))}
              className="w-full accent-blue-400 cursor-pointer"
            />
          </div>
        </div>

        {/* Reverb Space Unit */}
        <div className="p-3 bg-zinc-950/70 border border-zinc-800/80 rounded-xl space-y-3">
          <h3 className="text-xs font-bold text-pink-300 uppercase font-mono tracking-wider flex items-center gap-1.5">
            <Waves className="w-3.5 h-3.5" /> Studio Reverb
          </h3>

          {/* Reverb Decay */}
          <div>
            <div className="flex justify-between items-center text-[11px] font-mono mb-1">
              <span className="text-zinc-400">Decay Tail Time</span>
              <span className="text-pink-400 font-bold">{fx.reverbDecay.toFixed(1)} s</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={4.5}
              step={0.2}
              value={fx.reverbDecay}
              onChange={(e) => updateField('reverbDecay', Number(e.target.value))}
              className="w-full accent-pink-400 cursor-pointer"
            />
          </div>

          {/* Reverb Mix */}
          <div>
            <div className="flex justify-between items-center text-[11px] font-mono mb-1">
              <span className="text-zinc-400">Ambience Mix</span>
              <span className="text-pink-400 font-bold">{Math.round(fx.reverbMix * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={0.8}
              step={0.05}
              value={fx.reverbMix}
              onChange={(e) => updateField('reverbMix', Number(e.target.value))}
              className="w-full accent-pink-400 cursor-pointer"
            />
          </div>
        </div>

        {/* Distortion / Overdrive & Visualizer */}
        <div className="p-3 bg-zinc-950/70 border border-zinc-800/80 rounded-xl space-y-3 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold text-orange-300 uppercase font-mono tracking-wider flex items-center gap-1.5 mb-2">
              <Flame className="w-3.5 h-3.5" /> Overdrive & Saturation
            </h3>

            <div>
              <div className="flex justify-between items-center text-[11px] font-mono mb-1">
                <span className="text-zinc-400">Analog Distortion</span>
                <span className="text-orange-400 font-bold">{fx.distortion.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min={0}
                max={8}
                step={0.2}
                value={fx.distortion}
                onChange={(e) => updateField('distortion', Number(e.target.value))}
                className="w-full accent-orange-400 cursor-pointer"
              />
            </div>
          </div>

          {/* Integrated Visualizer */}
          <Visualizer isPlaying={isPlaying} />
        </div>
      </div>
    </div>
  );
};
