import React, { useState } from 'react';
import { Volume2, VolumeX, Eye, Plus, Trash2, Music2, SlidersHorizontal, ChevronDown, Check } from 'lucide-react';
import { Track, Step, SoundType, ScaleName } from '../types';
import { SCALES } from '../utils/music';
import { audioEngine } from '../audio/engine';

interface SequencerGridProps {
  tracks: Track[];
  onTracksChange: (tracks: Track[]) => void;
  currentStep: number;
  isPlaying: boolean;
  synthSettings: any;
  selectedScale: ScaleName;
  onScaleChange: (scale: ScaleName) => void;
}

export const SequencerGrid: React.FC<SequencerGridProps> = ({
  tracks,
  onTracksChange,
  currentStep,
  isPlaying,
  synthSettings,
  selectedScale,
  onScaleChange,
}) => {
  const [editingStep, setEditingStep] = useState<{ trackId: string; stepIdx: number } | null>(null);
  const [showAddTrackModal, setShowAddTrackModal] = useState(false);
  const [addNotePicker, setAddNotePicker] = useState<{
    trackId: string;
    stepIdx: number;
    selectedNote: string;
  } | null>(null);

  // Toggle step on/off
  const handleStepClick = (trackId: string, stepIdx: number) => {
    audioEngine.ensureContext();
    const track = tracks.find((t) => t.id === trackId);
    if (!track) return;
    const targetStep = track.steps[stepIdx];
    const nextActive = !targetStep.active;

    // If activating a synth-like step, open note picker instead of toggling immediately
    if (nextActive && track.type === 'synth') {
      const defaultNote = targetStep.note || SCALES[selectedScale][stepIdx % SCALES[selectedScale].length];
      setAddNotePicker({ trackId, stepIdx, selectedNote: defaultNote });
      return;
    }

    const updated = tracks.map((t) => {
      if (t.id !== trackId) return t;
      const newSteps = [...t.steps];
      const target = newSteps[stepIdx];
      newSteps[stepIdx] = { ...target, active: nextActive };

      // Trigger preview sound if activated
      if (nextActive) {
        const previewTrack = { ...t, steps: newSteps };
        audioEngine.triggerTrackSample(previewTrack, synthSettings);
      }

      return { ...t, steps: newSteps };
    });
    onTracksChange(updated);
  };

  // Toggle Mute
  const handleToggleMute = (trackId: string) => {
    onTracksChange(
      tracks.map((t) => (t.id === trackId ? { ...t, muted: !t.muted } : t))
    );
  };

  // Toggle Solo
  const handleToggleSolo = (trackId: string) => {
    onTracksChange(
      tracks.map((t) => (t.id === trackId ? { ...t, soloed: !t.soloed } : t))
    );
  };

  // Track Volume Change
  const handleVolumeChange = (trackId: string, volume: number) => {
    onTracksChange(
      tracks.map((t) => (t.id === trackId ? { ...t, volume } : t))
    );
  };

  // Track Pan Change
  const handlePanChange = (trackId: string, pan: number) => {
    onTracksChange(
      tracks.map((t) => (t.id === trackId ? { ...t, pan } : t))
    );
  };

  // Delete Track
  const handleDeleteTrack = (trackId: string) => {
    if (tracks.length <= 1) return;
    onTracksChange(tracks.filter((t) => t.id !== trackId));
  };

  // Add Track
  const handleAddTrack = (sound: SoundType, name: string, color: string, type: 'drum' | 'synth', initialNote?: string) => {
    const stepCount = tracks[0]?.steps.length || 16;
    const newTrack: Track = {
      id: `t_${Date.now()}`,
      name,
      type,
      sound,
      muted: false,
      soloed: false,
      volume: 0.8,
      pan: 0,
      color,
      steps: Array.from({ length: stepCount }, (_, i) => ({
        active: false,
        note: (() => {
          if (type !== 'synth') return 'C2';
          if (initialNote) return initialNote;
          return SCALES[selectedScale][i % SCALES[selectedScale].length];
        })(),
        velocity: 0.8,
      })),
    };
    onTracksChange([...tracks, newTrack]);
    setShowAddTrackModal(false);
  };

  // Confirm adding a note when activating a synth step
  const confirmAddStep = (note: string) => {
    if (!addNotePicker) return;
    const { trackId, stepIdx } = addNotePicker;
    const updated = tracks.map((t) => {
      if (t.id !== trackId) return t;
      const newSteps = [...t.steps];
      const target = newSteps[stepIdx] || { active: false, note, velocity: 0.8 } as Step;
      newSteps[stepIdx] = { ...target, active: true, note };
      return { ...t, steps: newSteps };
    });
    onTracksChange(updated);
    const updatedTrack = updated.find((t) => t.id === trackId);
    if (updatedTrack) {
      audioEngine.triggerTrackSample(updatedTrack, synthSettings);
    }
    setAddNotePicker(null);
  };

  // Change step velocity or pitch note
  const handleUpdateStepNote = (trackId: string, stepIdx: number, note: string) => {
    onTracksChange(
      tracks.map((t) => {
        if (t.id !== trackId) return t;
        const newSteps = [...t.steps];
        newSteps[stepIdx] = { ...newSteps[stepIdx], note };
        return { ...t, steps: newSteps };
      })
    );
  };

  const handleUpdateStepVelocity = (trackId: string, stepIdx: number, velocity: number) => {
    onTracksChange(
      tracks.map((t) => {
        if (t.id !== trackId) return t;
        const newSteps = [...t.steps];
        newSteps[stepIdx] = { ...newSteps[stepIdx], velocity };
        return { ...t, steps: newSteps };
      })
    );
  };

  const stepCount = tracks[0]?.steps.length || 16;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-2xl text-zinc-100 flex flex-col gap-4">
      {/* Grid Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-purple-500 animate-pulse" />
          <h2 className="font-bold text-sm tracking-tight text-white flex items-center gap-2">
            Pattern Sequencer <span className="text-xs font-mono text-zinc-400">({stepCount} Steps)</span>
          </h2>
        </div>

        {/* Scale Picker for Synth Pitching */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-zinc-400">Synth Scale:</span>
          <select
            value={selectedScale}
            onChange={(e) => onScaleChange(e.target.value as ScaleName)}
            className="bg-zinc-950 border border-zinc-700 text-purple-300 font-mono text-xs rounded-lg px-2 py-1 focus:outline-none"
          >
            <option value="minor">Minor Scale</option>
            <option value="major">Major Scale</option>
            <option value="pentatonic">Pentatonic</option>
            <option value="blues">Blues Scale</option>
            <option value="synthwave">Synthwave Scale</option>
            <option value="chromatic">Chromatic (All Notes)</option>
          </select>

          <button
            onClick={() => setShowAddTrackModal(true)}
            className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition shadow-md shadow-purple-600/20"
          >
            <Plus className="w-3.5 h-3.5" /> Add Track
          </button>
        </div>
      </div>

      {/* Grid Tracks Layout */}
      <div className="overflow-x-auto pb-2">
        <div className="min-w-[700px] flex flex-col gap-2">
          {/* Step Numbers Header */}
          <div className="flex items-center">
            <div className="w-48 sm:w-60 shrink-0 text-xs font-mono text-zinc-500 uppercase px-2">
              Tracks / Controls
            </div>
            <div className="flex-1 grid grid-cols-16 gap-1">
              {Array.from({ length: stepCount }, (_, i) => {
                const isCurrent = isPlaying && currentStep === i;
                const isQuarterBeat = i % 4 === 0;
                return (
                  <div
                    key={i}
                    className={`text-center font-mono text-[10px] py-1 rounded transition ${
                      isCurrent
                        ? 'bg-purple-500 text-white font-bold shadow-lg shadow-purple-500/50'
                        : isQuarterBeat
                        ? 'text-zinc-300 font-bold bg-zinc-800/60'
                        : 'text-zinc-500'
                    }`}
                  >
                    {i + 1}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Track Rows */}
          {tracks.map((track) => {
            const hasSolo = tracks.some((t) => t.soloed);
            const isAudible = !track.muted && (!hasSolo || track.soloed);

            return (
              <div
                key={track.id}
                className={`flex items-center gap-2 p-2 rounded-xl bg-zinc-950/70 border transition ${
                  isAudible ? 'border-zinc-800/80' : 'border-zinc-900 opacity-50'
                }`}
              >
                {/* Track Left Controls */}
                <div className="w-48 sm:w-60 shrink-0 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      onClick={() => audioEngine.triggerTrackSample(track, synthSettings)}
                      className="w-3 h-8 rounded-full shrink-0 transition hover:scale-105"
                      style={{ backgroundColor: track.color }}
                      title="Click to preview sound"
                    />
                    <div className="truncate">
                      <div className="text-xs font-bold text-white truncate flex items-center gap-1">
                        {track.name}
                        {track.type === 'synth' && (
                          <span className="text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1 rounded font-mono">
                            SYNTH
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] font-mono text-zinc-500 uppercase">{track.sound}</div>
                    </div>
                  </div>

                  {/* Buttons: Mute, Solo, Vol Slider, Delete */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleMute(track.id)}
                      className={`w-6 h-6 rounded text-[10px] font-mono font-bold transition flex items-center justify-center ${
                        track.muted ? 'bg-red-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                      title="Mute Track"
                    >
                      M
                    </button>
                    <button
                      onClick={() => handleToggleSolo(track.id)}
                      className={`w-6 h-6 rounded text-[10px] font-mono font-bold transition flex items-center justify-center ${
                        track.soloed ? 'bg-amber-500 text-zinc-950' : 'bg-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                      title="Solo Track"
                    >
                      S
                    </button>

                    {/* Volume Slider */}
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={track.volume}
                      onChange={(e) => handleVolumeChange(track.id, Number(e.target.value))}
                      className="w-12 accent-purple-500 cursor-pointer hidden sm:block"
                      title={`Volume: ${Math.round(track.volume * 100)}%`}
                    />

                    <button
                      onClick={() => handleDeleteTrack(track.id)}
                      className="p-1 text-zinc-600 hover:text-red-400 transition rounded"
                      title="Delete Track"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Step Grid Buttons */}
                <div className={`flex-1 grid gap-1 ${stepCount === 32 ? 'grid-cols-32' : 'grid-cols-16'}`}>
                  {track.steps.slice(0, stepCount).map((step, stepIdx) => {
                    const isCurrent = isPlaying && currentStep === stepIdx;
                    const isQuarterBeat = stepIdx % 4 === 0;

                    return (
                      <div key={stepIdx} className="relative group">
                        <button
                          onClick={() => handleStepClick(track.id, stepIdx)}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setEditingStep({ trackId: track.id, stepIdx });
                          }}
                          className={`w-full h-10 rounded-lg transition-all transform flex flex-col items-center justify-center relative overflow-hidden border ${
                            step.active
                              ? isCurrent
                                ? 'scale-105 shadow-lg border-white z-10'
                                : 'border-purple-400/50 shadow-md'
                              : isCurrent
                              ? 'bg-zinc-700/80 border-purple-500'
                              : isQuarterBeat
                              ? 'bg-zinc-800/80 border-zinc-700/60 hover:bg-zinc-700'
                              : 'bg-zinc-900 border-zinc-800 hover:bg-zinc-800'
                          }`}
                          style={{
                            backgroundColor: step.active
                              ? isCurrent
                                ? '#ffffff'
                                : track.color
                              : undefined,
                            opacity: step.active ? Math.max(0.4, step.velocity) : 1,
                          }}
                        >
                          {/* Synth note display */}
                          {step.active && track.type === 'synth' && (
                            <span
                              className={`text-[9px] font-mono font-bold leading-none ${
                                isCurrent ? 'text-zinc-950' : 'text-white'
                              }`}
                            >
                              {step.note}
                            </span>
                          )}

                          {/* Velocity dot indicator */}
                          {step.active && (
                            <div
                              className="absolute bottom-1 w-1.5 h-1.5 rounded-full"
                              style={{
                                backgroundColor: isCurrent ? '#000000' : 'rgba(255, 255, 255, 0.9)',
                              }}
                            />
                          )}
                        </button>

                        {/* Step settings quick gear icon on hover */}
                        {step.active && (
                          <button
                            onClick={() => setEditingStep({ trackId: track.id, stepIdx })}
                            className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 bg-zinc-900 border border-zinc-700 text-zinc-300 text-[8px] rounded p-0.5 transition z-20"
                            title="Edit Pitch / Velocity"
                          >
                            <SlidersHorizontal className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Inspector Modal for Note Pitch & Velocity */}
      {editingStep && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 max-w-sm w-full text-zinc-100 shadow-2xl">
            <div className="flex items-center justify-between mb-4 border-b border-zinc-800 pb-3">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-purple-400" />
                Step {editingStep.stepIdx + 1} Inspector
              </h3>
              <button
                onClick={() => setEditingStep(null)}
                className="text-zinc-400 hover:text-white text-xs font-mono"
              >
                Done ✕
              </button>
            </div>

            {(() => {
              const targetTrack = tracks.find((t) => t.id === editingStep.trackId);
              const targetStep = targetTrack?.steps[editingStep.stepIdx];
              if (!targetTrack || !targetStep) return null;

              return (
                <div className="space-y-4">
                  {/* Note Pitch Picker for Synth */}
                  {targetTrack.type === 'synth' && (
                    <div>
                      <label className="text-xs font-mono text-zinc-400 block mb-1">
                        Note Pitch ({selectedScale} scale)
                      </label>
                      <select
                        value={targetStep.note}
                        onChange={(e) => handleUpdateStepNote(targetTrack.id, editingStep.stepIdx, e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-purple-300 font-mono font-bold focus:outline-none"
                      >
                        {SCALES[selectedScale].map((n) => (
                          <option key={n} value={n} className="bg-zinc-900 text-zinc-100">
                            {n}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                    
                  {/* Velocity Slider */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-mono text-zinc-400">Velocity (Accent)</label>
                      <span className="text-xs font-mono text-purple-400 font-bold">
                        {Math.round(targetStep.velocity * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.1}
                      max={1.0}
                      step={0.05}
                      value={targetStep.velocity}
                      onChange={(e) =>
                        handleUpdateStepVelocity(targetTrack.id, editingStep.stepIdx, Number(e.target.value))
                      }
                      className="w-full accent-purple-500 cursor-pointer"
                    />
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={() => setEditingStep(null)}
                      className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
      {/* Add-Step Note Picker Modal */}
      {addNotePicker && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 max-w-sm w-full text-zinc-100 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm">Choose note for step {addNotePicker.stepIdx + 1}</h3>
              <button onClick={() => setAddNotePicker(null)} className="text-zinc-400 hover:text-white text-xs">Cancel ✕</button>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-mono text-zinc-400 block">Choose note ({selectedScale})</label>
              <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto">
                {SCALES[selectedScale].map((n) => (
                  <button
                    key={n}
                    onClick={() => confirmAddStep(n)}
                    className="w-full py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-mono flex items-center justify-center shadow-sm"
                    title={`Set step to ${n}`}>
                    {n}
                  </button>
                ))}
              </div>

              <div className="flex justify-end gap-2">
                <button onClick={() => setAddNotePicker(null)} className="px-3 py-1 bg-zinc-800 rounded-lg text-xs">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Track Selection Modal */}
      {showAddTrackModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-md w-full text-zinc-100 shadow-2xl">
            <div className="flex items-center justify-between mb-4 border-b border-zinc-800 pb-3">
              <h3 className="font-bold text-base text-white">Add New Track</h3>
              <button
                onClick={() => setShowAddTrackModal(false)}
                className="text-zinc-400 hover:text-white text-xs font-mono"
              >
                Cancel ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleAddTrack('kick', 'Sub Kick', '#ef4444', 'drum')}
                className="p-3 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-left transition flex flex-col gap-1"
              >
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="font-bold text-xs text-white">Kick Drum</span>
                <span className="text-[10px] text-zinc-500">Low end punch sub kick</span>
              </button>

              <button
                onClick={() => handleAddTrack('snare', 'Punch Snare', '#f97316', 'drum')}
                className="p-3 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-left transition flex flex-col gap-1"
              >
                <div className="w-3 h-3 rounded-full bg-orange-500" />
                <span className="font-bold text-xs text-white">Snare Drum</span>
                <span className="text-[10px] text-zinc-500">Crisp noise & shell pop</span>
              </button>

              <button
                onClick={() => handleAddTrack('hihat_closed', 'Closed Hat', '#eab308', 'drum')}
                className="p-3 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-left transition flex flex-col gap-1"
              >
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <span className="font-bold text-xs text-white">Closed Hi-Hat</span>
                <span className="text-[10px] text-zinc-500">Tight metallic hi-hat</span>
              </button>

              <button
                onClick={() => handleAddTrack('hihat_open', 'Open Hat', '#eab308', 'drum')}
                className="p-3 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-left transition flex flex-col gap-1"
              >
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <span className="font-bold text-xs text-white">Open Hi-Hat</span>
                <span className="text-[10px] text-zinc-500">Sustained open cymbal</span>
              </button>

              <button
                onClick={() => handleAddTrack('clap', 'Hand Clap', '#ec4899', 'drum')}
                className="p-3 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-left transition flex flex-col gap-1"
              >
                <div className="w-3 h-3 rounded-full bg-pink-500" />
                <span className="font-bold text-xs text-white">Hand Clap</span>
                <span className="text-[10px] text-zinc-500">Multi-burst studio clap</span>
              </button>

              <button
                onClick={() => handleAddTrack('tom', 'Sub Tom', '#06b6d4', 'drum')}
                className="p-3 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-left transition flex flex-col gap-1"
              >
                <div className="w-3 h-3 rounded-full bg-cyan-500" />
                <span className="font-bold text-xs text-white">Tom Drum</span>
                <span className="text-[10px] text-zinc-500">Resonant pitch sweep tom</span>
              </button>

              <button
                onClick={() => handleAddTrack('perc', 'Wood Block', '#10b981', 'drum')}
                className="p-3 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-left transition flex flex-col gap-1"
              >
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="font-bold text-xs text-white">Percussion</span>
                <span className="text-[10px] text-zinc-500">Short FM wood block</span>
              </button>

              <button
                onClick={() => handleAddTrack('bass', 'Bass', '#38bdf8', 'synth')}
                className="p-3 bg-sky-950/40 hover:bg-sky-900/50 border border-sky-500/30 rounded-xl text-left transition flex flex-col gap-1"
              >
                <div className="w-3 h-3 rounded-full bg-sky-400" />
                <span className="font-bold text-xs text-sky-300">Bass</span>
                <span className="text-[10px] text-sky-400/80">Deep low-end synth bass</span>
              </button>

              <button
                onClick={() => handleAddTrack('piano_single', 'Piano (single note)', '#f59e0b', 'synth')}
                className="p-3 bg-amber-950/40 hover:bg-amber-900/50 border border-amber-500/30 rounded-xl text-left transition flex flex-col gap-1"
              >
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <span className="font-bold text-xs text-amber-200">Piano (single note)</span>
                <span className="text-[10px] text-amber-300/80">Simple piano-style lead</span>
              </button>

              <button
                onClick={() => handleAddTrack('piano_chord', 'Piano (chord)', '#fde68a', 'synth')}
                className="p-3 bg-amber-950/40 hover:bg-amber-900/50 border border-amber-500/30 rounded-xl text-left transition flex flex-col gap-1"
              >
                <div className="w-3 h-3 rounded-full bg-amber-300" />
                <span className="font-bold text-xs text-amber-100">Piano (chord)</span>
                <span className="text-[10px] text-amber-200/80">Chordal piano-style harmony</span>
              </button>

              <button
                onClick={() => handleAddTrack('synth', 'Synth Voice', '#a855f7', 'synth')}
                className="p-3 bg-purple-950/40 hover:bg-purple-900/50 border border-purple-500/30 rounded-xl text-left transition flex flex-col gap-1"
              >
                <div className="w-3 h-3 rounded-full bg-purple-500" />
                <span className="font-bold text-xs text-purple-300">Synth Melodic Track</span>
                <span className="text-[10px] text-purple-400/80">Melodic line with full ADSR</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
