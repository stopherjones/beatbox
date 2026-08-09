import React, { useState, useEffect, useCallback } from 'react';
import { Circle, Bell, Volume2, Sparkles, Trash2, Music2, Keyboard, Drum, ArrowLeftRight, ChevronUp, ChevronDown, Cpu } from 'lucide-react';
import { Track, SoundType, ScaleName, SynthSettings, Step } from '../types';
import { SCALES, transposeNote, midiNumberToNote } from '../utils/music';
import { audioEngine } from '../audio/engine';

interface LivePerformancePanelProps {
  tracks: Track[];
  onTracksChange: (tracksOrUpdater: Track[] | ((prev: Track[]) => Track[])) => void;
  isRecording: boolean;
  onToggleRecording: () => void;
  metronomeEnabled: boolean;
  onToggleMetronome: () => void;
  isPlaying: boolean;
  currentStep: number;
  synthSettings: SynthSettings;
  selectedScale: ScaleName;
  onScaleChange: (scale: ScaleName) => void;
  selectedTrackId: string | null;
  onSelectTrack: (trackId: string | null) => void;
}

interface PadDef {
  sound: SoundType;
  name: string;
  color: string;
  key: string; // QWERTY key shortcut
  type: 'drum' | 'synth';
  defaultNote?: string;
}

const DRUM_PADS: PadDef[] = [
  { sound: 'kick', name: 'Kick', color: '#ef4444', key: '1', type: 'drum' },
  { sound: 'snare', name: 'Snare', color: '#f97316', key: '2', type: 'drum' },
  { sound: 'hihat_closed', name: 'Closed Hat', color: '#eab308', key: '3', type: 'drum' },
  { sound: 'hihat_open', name: 'Open Hat', color: '#facc15', key: '4', type: 'drum' },
  { sound: 'clap', name: 'Clap', color: '#ec4899', key: '5', type: 'drum' },
  { sound: 'tom', name: 'Tom', color: '#06b6d4', key: '6', type: 'drum' },
  { sound: 'perc', name: 'Perc / Wood', color: '#10b981', key: '7', type: 'drum' },
  { sound: 'bass', name: 'Sub Bass', color: '#38bdf8', key: '8', type: 'synth', defaultNote: 'C2' },
];

// Computer keyboard mappings for synth keys (10 notes mapping to scale)
const KEYBOARD_KEYS = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';'];

export const LivePerformancePanel: React.FC<LivePerformancePanelProps> = ({
  tracks,
  onTracksChange,
  isRecording,
  onToggleRecording,
  metronomeEnabled,
  onToggleMetronome,
  isPlaying,
  currentStep,
  synthSettings,
  selectedScale,
  onScaleChange,
  selectedTrackId,
  onSelectTrack,
}) => {
  const [activePad, setActivePad] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [octaveOffset, setOctaveOffset] = useState<number>(0); // -1, 0, +1
  const [liveVelocity, setLiveVelocity] = useState<number>(0.8);
  const [activeTab, setActiveTab] = useState<'both' | 'pads' | 'keys'>('both');
  const [midiDeviceName, setMidiDeviceName] = useState<string | null>(null);

  // Trigger live note or pad hit
  const triggerPadOrKey = useCallback(
    (sound: SoundType, type: 'drum' | 'synth', note?: string) => {
      audioEngine.ensureContext();

      // 1. Live audio trigger
      if (type === 'synth' && note) {
        const transposed = transposeNote(note, octaveOffset * 12);
        if (sound === 'bass') {
          audioEngine.triggerSynth(
            audioEngine.ctx!.currentTime,
            transposeNote(transposed, -12),
            0.3,
            synthSettings,
            liveVelocity
          );
        } else if (sound === 'piano_chord') {
          audioEngine.triggerSynth(audioEngine.ctx!.currentTime, transposed, 0.3, synthSettings, liveVelocity);
          audioEngine.triggerSynth(
            audioEngine.ctx!.currentTime,
            transposeNote(transposed, 4),
            0.3,
            synthSettings,
            liveVelocity * 0.8
          );
          audioEngine.triggerSynth(
            audioEngine.ctx!.currentTime,
            transposeNote(transposed, 7),
            0.3,
            synthSettings,
            liveVelocity * 0.8
          );
        } else {
          audioEngine.triggerSynth(audioEngine.ctx!.currentTime, transposed, 0.3, synthSettings, liveVelocity);
        }
      } else {
        // Drum samples
        switch (sound) {
          case 'kick':
            audioEngine.triggerKick(audioEngine.ctx!.currentTime, liveVelocity);
            break;
          case 'snare':
            audioEngine.triggerSnare(audioEngine.ctx!.currentTime, liveVelocity);
            break;
          case 'hihat_closed':
            audioEngine.triggerHiHat(audioEngine.ctx!.currentTime, false, liveVelocity);
            break;
          case 'hihat_open':
            audioEngine.triggerHiHat(audioEngine.ctx!.currentTime, true, liveVelocity);
            break;
          case 'clap':
            audioEngine.triggerClap(audioEngine.ctx!.currentTime, liveVelocity);
            break;
          case 'tom':
            audioEngine.triggerTom(audioEngine.ctx!.currentTime, 0, liveVelocity);
            break;
          case 'perc':
            audioEngine.triggerPerc(audioEngine.ctx!.currentTime, 0, liveVelocity);
            break;
          default:
            audioEngine.triggerKick(audioEngine.ctx!.currentTime, liveVelocity);
        }
      }

      // 2. If RECORDING is active, write step to pattern!
      if (isRecording) {
        const targetStepIdx = currentStep;

        onTracksChange((prevTracks) => {
          const stepCount = prevTracks[0]?.steps.length || 16;
          let updatedTracks = [...prevTracks];
          let targetTrackIndex = -1;

          if (type === 'drum') {
            // Find existing track for this sound
            targetTrackIndex = updatedTracks.findIndex((t) => t.sound === sound);

            // If no track exists, create one!
            if (targetTrackIndex === -1) {
              const padDef = DRUM_PADS.find((p) => p.sound === sound);
              const newTrack: Track = {
                id: `t_${sound}_${Date.now()}`,
                name: padDef?.name || sound.toUpperCase(),
                type: 'drum',
                sound,
                muted: false,
                soloed: false,
                volume: 0.8,
                pan: 0,
                color: padDef?.color || '#a855f7',
                steps: Array.from({ length: stepCount }, () => ({
                  active: false,
                  note: 'C2',
                  velocity: liveVelocity,
                })),
              };
              updatedTracks.push(newTrack);
              targetTrackIndex = updatedTracks.length - 1;
            }
          } else {
            // Synth track
            if (selectedTrackId) {
              targetTrackIndex = updatedTracks.findIndex((t) => t.id === selectedTrackId);
            }
            if (targetTrackIndex === -1 || updatedTracks[targetTrackIndex].type !== 'synth') {
              targetTrackIndex = updatedTracks.findIndex((t) => t.type === 'synth');
            }

            // If still no synth track exists, create one!
            if (targetTrackIndex === -1) {
              const newTrack: Track = {
                id: `t_synth_${Date.now()}`,
                name: sound === 'bass' ? 'Bass Synth' : 'Synth Keyboard',
                type: 'synth',
                sound: sound || 'synth',
                muted: false,
                soloed: false,
                volume: 0.8,
                pan: 0,
                color: '#a855f7',
                steps: Array.from({ length: stepCount }, () => ({
                  active: false,
                  note: 'C3',
                  velocity: liveVelocity,
                })),
              };
              updatedTracks.push(newTrack);
              targetTrackIndex = updatedTracks.length - 1;
            }
          }

          // Record step into target track
          if (targetTrackIndex !== -1) {
            const trackToMod = updatedTracks[targetTrackIndex];
            const newSteps = [...trackToMod.steps];
            const finalNote = note ? transposeNote(note, octaveOffset * 12) : trackToMod.steps[targetStepIdx]?.note || 'C3';

            newSteps[targetStepIdx] = {
              active: true,
              note: finalNote,
              velocity: liveVelocity,
            };

            updatedTracks[targetTrackIndex] = {
              ...trackToMod,
              steps: newSteps,
            };
          }

          return updatedTracks;
        });
      }
    },
    [isRecording, currentStep, tracks, octaveOffset, synthSettings, liveVelocity, selectedTrackId, onTracksChange]
  );

  // QWERTY keyboard listener for live performance recording
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Check drum pad shortcuts (1-8)
      const pad = DRUM_PADS.find((p) => p.key === e.key);
      if (pad) {
        e.preventDefault();
        setActivePad(pad.sound);
        triggerPadOrKey(pad.sound, pad.type, pad.defaultNote);
        setTimeout(() => setActivePad(null), 150);
        return;
      }

      // Check synth keyboard shortcuts (A S D F G H J K L ...)
      const scaleNotes = SCALES[selectedScale];
      const keyIndex = KEYBOARD_KEYS.indexOf(e.key.toLowerCase());
      if (keyIndex !== -1 && keyIndex < scaleNotes.length) {
        e.preventDefault();
        const note = scaleNotes[keyIndex];
        setActiveKey(note);
        triggerPadOrKey('synth', 'synth', note);
        setTimeout(() => setActiveKey(null), 150);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [triggerPadOrKey, selectedScale]);

  // Web MIDI API Listener for Physical USB/Bluetooth MIDI Keyboards
  useEffect(() => {
    if (!('requestMIDIAccess' in navigator)) return;

    let midiAccess: MIDIAccess | null = null;

    const onMIDIMessage = (event: MIDIMessageEvent) => {
      const data = event.data;
      if (!data || data.length < 3) return;

      const [status, noteNumber, velocity] = data;
      const command = status >> 4; // 9 = Note On, 8 = Note Off

      if (command === 9 && velocity > 0) {
        // Note On with velocity
        const noteStr = midiNumberToNote(noteNumber);
        const normVelocity = velocity / 127;

        // General MIDI Drum note range (35 to 51)
        if (noteNumber >= 35 && noteNumber <= 51) {
          let drumSound: SoundType = 'kick';
          if (noteNumber === 38 || noteNumber === 40) drumSound = 'snare';
          else if (noteNumber === 42 || noteNumber === 44) drumSound = 'hihat_closed';
          else if (noteNumber === 46) drumSound = 'hihat_open';
          else if (noteNumber === 39) drumSound = 'clap';
          else if (noteNumber === 45 || noteNumber === 47 || noteNumber === 48 || noteNumber === 50) drumSound = 'tom';
          else if (noteNumber === 37 || noteNumber === 56) drumSound = 'perc';

          setActivePad(drumSound);
          triggerPadOrKey(drumSound, 'drum');
          setTimeout(() => setActivePad(null), 150);
        } else {
          // Play synth note from physical MIDI keyboard!
          setActiveKey(noteStr);
          triggerPadOrKey('synth', 'synth', noteStr);
          setTimeout(() => setActiveKey(null), 150);
        }
      }
    };

    navigator.requestMIDIAccess().then(
      (access) => {
        midiAccess = access;
        const inputs = Array.from(access.inputs.values());
        if (inputs.length > 0) {
          setMidiDeviceName(inputs[0].name || 'USB MIDI Device');
        }

        inputs.forEach((input) => {
          input.onmidimessage = onMIDIMessage;
        });

        access.onstatechange = (e) => {
          const updatedInputs = Array.from(access.inputs.values());
          if (updatedInputs.length > 0) {
            setMidiDeviceName(updatedInputs[0].name || 'USB MIDI Device');
            updatedInputs.forEach((input) => {
              input.onmidimessage = onMIDIMessage;
            });
          } else {
            setMidiDeviceName(null);
          }
        };
      },
      () => {
        console.warn('Web MIDI access request failed or permission denied.');
      }
    );

    return () => {
      if (midiAccess) {
        Array.from(midiAccess.inputs.values()).forEach((input) => {
          input.onmidimessage = null;
        });
      }
    };
  }, [triggerPadOrKey]);

  // Clear steps on selected track or all tracks
  const handleClearSelectedTrack = () => {
    if (!selectedTrackId) return;
    onTracksChange(
      tracks.map((t) => {
        if (t.id !== selectedTrackId) return t;
        return {
          ...t,
          steps: t.steps.map((s) => ({ ...s, active: false })),
        };
      })
    );
  };

  const scaleNotes = SCALES[selectedScale];

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-2xl text-zinc-100 flex flex-col gap-4">
      {/* Top Header / Control Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400">
            <Drum className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-bold text-sm text-white flex items-center gap-2">
              Real-Time Performance & Recording Deck
              {midiDeviceName ? (
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[10px] font-mono flex items-center gap-1">
                  <Cpu className="w-3 h-3" /> MIDI: {midiDeviceName}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[10px] font-mono flex items-center gap-1">
                  <Cpu className="w-3 h-3" /> Web MIDI & QWERTY Ready
                </span>
              )}
            </h2>
            <p className="text-[11px] text-zinc-400 font-mono">
              Tap pads or press keyboard keys <span className="text-purple-400 font-bold">(1–8 / A–L)</span> to play & record on the fly
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Record Arm Toggle */}
          <button
            onClick={onToggleRecording}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-lg ${
              isRecording
                ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse shadow-rose-600/40 border border-rose-400'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700'
            }`}
            title="Toggle Live Recording Mode"
          >
            <Circle className={`w-3.5 h-3.5 ${isRecording ? 'fill-white' : 'fill-rose-500'}`} />
            <span>{isRecording ? '● REC ARMED' : 'ARM RECORD'}</span>
          </button>

          {/* Metronome Toggle */}
          <button
            onClick={onToggleMetronome}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition border ${
              metronomeEnabled
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-400'
            }`}
            title="Toggle Metronome Click"
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Click</span>
          </button>

          {/* View Mode Switcher */}
          <div className="flex items-center bg-zinc-950 p-1 rounded-xl border border-zinc-800 text-[11px] font-mono">
            <button
              onClick={() => setActiveTab('both')}
              className={`px-2 py-0.5 rounded-lg transition ${
                activeTab === 'both' ? 'bg-purple-600 text-white font-bold' : 'text-zinc-400 hover:text-white'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setActiveTab('pads')}
              className={`px-2 py-0.5 rounded-lg transition ${
                activeTab === 'pads' ? 'bg-purple-600 text-white font-bold' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Pads
            </button>
            <button
              onClick={() => setActiveTab('keys')}
              className={`px-2 py-0.5 rounded-lg transition ${
                activeTab === 'keys' ? 'bg-purple-600 text-white font-bold' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Piano
            </button>
          </div>

          {/* Clear Selected Track Steps */}
          {selectedTrackId && (
            <button
              onClick={handleClearSelectedTrack}
              className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-rose-400 rounded-xl transition border border-zinc-700 text-xs font-mono flex items-center gap-1"
              title="Clear all steps on selected track"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Target Track & Velocity Slider bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-950/70 p-2.5 rounded-xl border border-zinc-800/80 text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="text-zinc-400">Target Track:</span>
          <select
            value={selectedTrackId || ''}
            onChange={(e) => onSelectTrack(e.target.value || null)}
            className="bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-purple-300 font-bold focus:outline-none"
          >
            <option value="">Auto-route (creates track if missing)</option>
            {tracks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.type.toUpperCase()})
              </option>
            ))}
          </select>
        </div>

        {/* Velocity Slider */}
        <div className="flex items-center gap-2">
          <span className="text-zinc-400">Tap Velocity:</span>
          <input
            type="range"
            min={0.2}
            max={1.0}
            step={0.05}
            value={liveVelocity}
            onChange={(e) => setLiveVelocity(Number(e.target.value))}
            className="w-20 accent-purple-500 cursor-pointer"
          />
          <span className="text-purple-400 font-bold w-8">{Math.round(liveVelocity * 100)}%</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* DRUM PADS GRID */}
        {(activeTab === 'both' || activeTab === 'pads') && (
          <div className="p-3 bg-zinc-950/80 border border-zinc-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Drum className="w-3.5 h-3.5 text-orange-400" /> Percussion Drum Pads
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">Use keys 1–8</span>
            </div>

            <div className="grid grid-cols-4 gap-2.5">
              {DRUM_PADS.map((pad) => {
                const isActive = activePad === pad.sound;
                return (
                  <button
                    key={pad.sound}
                    onClick={() => triggerPadOrKey(pad.sound, pad.type, pad.defaultNote)}
                    className={`h-20 rounded-xl p-2 font-mono flex flex-col justify-between items-start transition-all transform active:scale-95 border relative overflow-hidden select-none ${
                      isActive
                        ? 'brightness-150 scale-105 shadow-xl shadow-purple-500/40 border-white'
                        : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 shadow'
                    }`}
                  >
                    {/* Top colored indicator dot */}
                    <div className="flex items-center justify-between w-full">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: pad.color }} />
                      <span className="text-[10px] font-bold text-zinc-400 bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded">
                        [{pad.key}]
                      </span>
                    </div>

                    <div className="text-left mt-1">
                      <div className="text-xs font-bold text-white leading-tight">{pad.name}</div>
                      <div className="text-[9px] text-zinc-500 uppercase">{pad.sound}</div>
                    </div>

                    {/* Active pulse glow effect */}
                    {isActive && (
                      <div
                        className="absolute inset-0 opacity-20 pointer-events-none"
                        style={{ backgroundColor: pad.color }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* PIANO SYNTH KEYBOARD */}
        {(activeTab === 'both' || activeTab === 'keys') && (
          <div className="p-3 bg-zinc-950/80 border border-zinc-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Keyboard className="w-3.5 h-3.5 text-purple-400" /> Synth Live Piano Keyboard
                </span>
              </div>

              {/* Octave Controls */}
              <div className="flex items-center gap-1 font-mono text-[10px]">
                <span className="text-zinc-500">Octave:</span>
                <button
                  onClick={() => setOctaveOffset((o) => Math.max(-2, o - 1))}
                  className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-700 rounded hover:bg-zinc-800 text-zinc-200"
                  title="Octave Down"
                >
                  -
                </button>
                <span className="text-purple-400 font-bold px-1">{octaveOffset > 0 ? `+${octaveOffset}` : octaveOffset}</span>
                <button
                  onClick={() => setOctaveOffset((o) => Math.min(2, o + 1))}
                  className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-700 rounded hover:bg-zinc-800 text-zinc-200"
                  title="Octave Up"
                >
                  +
                </button>
              </div>
            </div>

            {/* Interactive Piano Keys */}
            <div className="flex gap-1 overflow-x-auto pb-1 pt-1">
              {scaleNotes.map((note, idx) => {
                const isSharp = note.includes('#');
                const keyShortcut = KEYBOARD_KEYS[idx] || '';
                const isActive = activeKey === note;

                return (
                  <button
                    key={note}
                    onClick={() => triggerPadOrKey('synth', 'synth', note)}
                    className={`h-24 min-w-11 rounded-b-xl font-mono transition flex flex-col justify-between p-1.5 border relative select-none shrink-0 ${
                      isActive
                        ? 'bg-purple-500 text-white border-purple-300 scale-105 z-10 shadow-lg shadow-purple-500/50'
                        : isSharp
                        ? 'bg-zinc-800 hover:bg-zinc-700 text-purple-300 border-zinc-700 shadow-inner'
                        : 'bg-zinc-100 hover:bg-white text-zinc-900 border-zinc-300 shadow'
                    }`}
                  >
                    <div className="flex justify-between w-full text-[9px] font-bold">
                      <span className={isActive ? 'text-white' : isSharp ? 'text-purple-400' : 'text-zinc-500'}>
                        {keyShortcut ? `[${keyShortcut.toUpperCase()}]` : ''}
                      </span>
                    </div>

                    <div className="text-center font-bold text-xs">{note}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
