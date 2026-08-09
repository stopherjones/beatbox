import React, { useState, useRef } from 'react';
import { Play, Pause, Square, Download, Volume2, Sparkles, FolderDown, RotateCcw, Circle, Bell } from 'lucide-react';
import { Preset } from '../types';
import { DEFAULT_PRESETS } from '../data/presets';
import { audioEngine } from '../audio/engine';

interface HeaderProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onStop: () => void;
  isRecording: boolean;
  onToggleRecording: () => void;
  metronomeEnabled: boolean;
  onToggleMetronome: () => void;
  bpm: number;
  onBpmChange: (bpm: number) => void;
  swing: number;
  onSwingChange: (swing: number) => void;
  stepCount: number;
  onStepCountChange: (count: number) => void;
  currentPresetId: string;
  onSelectPreset: (preset: Preset) => void;
  onExportProject: () => void;
  publicProjects: { label: string; path: string }[];
  onOpenPublicProject: (projectPath: string) => void;
  onResetSession: () => void;
  isExporting: boolean;
  onExportWav: () => void;
  masterVol: number;
  onMasterVolChange: (vol: number) => void;
}

export const Header: React.FC<HeaderProps> = ({
  isPlaying,
  onTogglePlay,
  onStop,
  isRecording,
  onToggleRecording,
  metronomeEnabled,
  onToggleMetronome,
  bpm,
  onBpmChange,
  swing,
  onSwingChange,
  stepCount,
  onStepCountChange,
  currentPresetId,
  onSelectPreset,
  onExportProject,
  publicProjects,
  onOpenPublicProject,
  onResetSession,
  isExporting,
  onExportWav,
  masterVol,
  onMasterVolChange,
}) => {
  const [selectedPublicProject, setSelectedPublicProject] = useState<string>('');

  // Tap Tempo calculation
  const tapTimesRef = useRef<number[]>([]);
  const [tapNotice, setTapNotice] = useState(false);

  const handleTapTempo = () => {
    const now = performance.now();
    const times = tapTimesRef.current;
    
    // Reset if last tap was over 2 seconds ago
    if (times.length > 0 && now - times[times.length - 1] > 2000) {
      tapTimesRef.current = [now];
      return;
    }

    times.push(now);
    if (times.length > 4) {
      times.shift();
    }

    if (times.length >= 2) {
      const intervals = [];
      for (let i = 1; i < times.length; i++) {
        intervals.push(times[i] - times[i - 1]);
      }
      const avgIntervalMs = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const calculatedBpm = Math.round(60000 / avgIntervalMs);
      const clampedBpm = Math.min(220, Math.max(50, calculatedBpm));
      onBpmChange(clampedBpm);
      setTapNotice(true);
      setTimeout(() => setTapNotice(false), 800);
    }
  };

  return (
    <header className="bg-zinc-900 border-b border-zinc-800 text-zinc-100 p-3 sm:p-4 sticky top-0 z-40 shadow-xl">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-4">
        

        {/* Presets and Export Controls */}
        <div className="flex flex-wrap items-center justify-center gap-2 w-full lg:w-auto pb-1 lg:pb-0">
          
          {/* Preset Selector Dropdown */}
          <div className="min-w-[180px] flex items-center gap-1.5 bg-zinc-950/80 px-2 py-1.5 rounded-xl border border-zinc-800">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <select
              value={currentPresetId}
              onChange={(e) => {
                const found = DEFAULT_PRESETS.find((p) => p.id === e.target.value);
                if (found) onSelectPreset(found);
              }}
              className="bg-transparent text-xs text-zinc-200 font-medium focus:outline-none cursor-pointer"
            >
              <option value="" disabled className="bg-zinc-900 text-zinc-400">Load Preset...</option>
              {DEFAULT_PRESETS.map((p) => (
                <option key={p.id} value={p.id} className="bg-zinc-900 text-zinc-100">
                  {p.name} ({p.genre})
                </option>
              ))}
            </select>
          </div>

          {/* Export WAV Button */}
          <button
            onClick={onExportWav}
            disabled={isExporting}
            className="min-w-[140px] px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 transition disabled:opacity-50"
            title="Export full audio to WAV file"
          >
            <Download className="w-3.5 h-3.5" />
            {isExporting ? 'Exporting...' : 'Export WAV'}
          </button>

          {/* Open Project Dropdown */}
          <div className="min-w-[180px] flex items-center gap-2 bg-zinc-950/80 px-2 py-1.5 rounded-xl border border-zinc-800 text-zinc-200 text-xs">
            <span className="text-zinc-400 whitespace-nowrap">Open Saved</span>
            <select
              value={selectedPublicProject}
              onChange={(e) => {
                const selectedPath = e.target.value;
                setSelectedPublicProject(selectedPath);
                if (selectedPath) {
                  onOpenPublicProject(selectedPath);
                }
              }}
              className="bg-transparent text-xs text-zinc-100 focus:outline-none cursor-pointer"
            >
              <option value="" disabled>
                Choose project...
              </option>
              {publicProjects.map((project) => (
                <option key={project.path} value={project.path} className="bg-zinc-900 text-zinc-100">
                  {project.label}
                </option>
              ))}
            </select>
          </div>

          {/* Export Full Project File */}
          <button
            onClick={onExportProject}
            className="min-w-[150px] px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-purple-300 border border-purple-500/30 rounded-xl text-xs font-medium flex items-center gap-1.5 transition"
            title="Export entire project file (.json) to save to GitHub or disk"
          >
            <FolderDown className="w-3.5 h-3.5 text-purple-400" />
            <span>Export Project</span>
          </button>

          {/* Reset Session Button */}
          <button
            onClick={onResetSession}
            className="min-w-[50px] p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-rose-400 rounded-xl transition border border-zinc-800"
            title="Reset session to default factory state"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

        </div>

        {/* Transport Controls (Play, Stop, BPM, Swing) */}
        <div className="flex flex-wrap items-center justify-center gap-3 bg-zinc-950/80 p-2 rounded-2xl border border-zinc-800/80 w-full lg:w-auto">
          {/* Play/Pause Button */}
          <button
            onClick={onTogglePlay}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-lg ${
              isPlaying
                ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-amber-500/20'
                : 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/25'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4 fill-current" /> Pause
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current ml-0.5" /> Play Beat
              </>
            )}
          </button>

          {/* Record Toggle Button */}
          <button
            onClick={onToggleRecording}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-lg border ${
              isRecording
                ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse border-rose-400 shadow-rose-600/40'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700'
            }`}
            title="Arm Real-Time Recording"
          >
            <Circle className={`w-3.5 h-3.5 ${isRecording ? 'fill-white' : 'fill-rose-500'}`} />
            <span>{isRecording ? 'REC' : 'REC'}</span>
          </button>

          {/* Metronome Click Button */}
          <button
            onClick={onToggleMetronome}
            className={`p-2 rounded-xl text-xs font-bold flex items-center justify-center transition border ${
              metronomeEnabled
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400 border-zinc-700'
            }`}
            title="Metronome Click"
          >
            <Bell className="w-4 h-4" />
          </button>

          {/* Stop Button */}
          <button
            onClick={onStop}
            className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition"
            title="Stop Beat"
          >
            <Square className="w-4 h-4 fill-current" />
          </button>

          <div className="h-6 w-px bg-zinc-800 mx-1 hidden sm:block" />

          {/* BPM Control */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">BPM</span>
            <input
              type="number"
              min={50}
              max={220}
              value={bpm}
              onChange={(e) => onBpmChange(Number(e.target.value))}
              className="w-14 bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-center font-mono text-xs text-purple-300 font-bold focus:outline-none focus:border-purple-500"
            />
            <button
              onClick={handleTapTempo}
              className={`px-2 py-1 text-[11px] font-mono font-medium rounded-lg border transition ${
                tapNotice
                  ? 'bg-purple-500 text-white border-purple-400'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700'
              }`}
              title="Tap to set BPM"
            >
              TAP
            </button>
          </div>

          {/* Swing Control */}
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">Swing</span>
            <input
              type="range"
              min={0}
              max={50}
              value={swing}
              onChange={(e) => onSwingChange(Number(e.target.value))}
              className="w-16 accent-purple-500 cursor-pointer"
            />
            <span className="text-[11px] font-mono text-zinc-400 w-6">{swing}%</span>
          </div>

          <div className="h-6 w-px bg-zinc-800 mx-1 hidden md:block" />

          {/* Step Count 16 vs 32 */}
          <div className="hidden md:flex items-center bg-zinc-900 p-1 rounded-lg border border-zinc-800">
            <button
              onClick={() => onStepCountChange(16)}
              className={`px-2.5 py-0.5 rounded text-[11px] font-mono font-bold transition ${
                stepCount === 16 ? 'bg-purple-600 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              16 Steps
            </button>
            <button
              onClick={() => onStepCountChange(32)}
              className={`px-2.5 py-0.5 rounded text-[11px] font-mono font-bold transition ${
                stepCount === 32 ? 'bg-purple-600 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              32 Steps
            </button>
          </div>

          {/* Master Volume */}
          <div className="flex items-center gap-1.5 pl-1">
            <Volume2 className="w-3.5 h-3.5 text-zinc-400" />
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={masterVol}
              onChange={(e) => {
                const vol = Number(e.target.value);
                onMasterVolChange(vol);
                if (audioEngine.masterGain) {
                  audioEngine.masterGain.gain.value = vol;
                }
              }}
              className="w-16 accent-purple-500 cursor-pointer"
              title="Master Volume"
            />
          </div>
        </div>

      </div>
    </header>
  );
};

