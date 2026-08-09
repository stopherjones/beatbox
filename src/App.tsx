import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { SequencerGrid } from './components/SequencerGrid';
import { SynthPanel } from './components/SynthPanel';
import { FXPanel } from './components/FXPanel';
import { SongArranger } from './components/SongArranger';
import { LivePerformancePanel } from './components/LivePerformancePanel';
import { Pattern, Preset, ScaleName, SongBlock, SynthSettings, FXSettings, Track, ProjectFile } from './types';
import { DEFAULT_PRESETS } from './data/presets';
import { audioEngine } from './audio/engine';
import { transposeNote } from './utils/music';

const STORAGE_KEY = 'beatmaker_studio_session_v2';

export default function App() {
  // Load initial preset
  const defaultPreset = DEFAULT_PRESETS[0];
  const [patterns, setPatterns] = useState<Pattern[]>([defaultPreset.pattern]);
  const [activePatternId, setActivePatternId] = useState<string>(defaultPreset.pattern.id);
  const [currentPresetId, setCurrentPresetId] = useState<string>(defaultPreset.id);

  const activePattern = patterns.find((p) => p.id === activePatternId) || patterns[0];

  // Transport & Live Recording State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [metronomeEnabled, setMetronomeEnabled] = useState<boolean>(false);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);

  const [currentStep, setCurrentStep] = useState<number>(0);
  const [bpm, setBpm] = useState<number>(defaultPreset.pattern.bpm);
  const [swing, setSwing] = useState<number>(defaultPreset.pattern.swing);
  const [stepCount, setStepCount] = useState<number>(defaultPreset.pattern.stepCount || 16);
  const [masterVol, setMasterVol] = useState<number>(0.8);

  // Synth & FX State
  const [synthSettings, setSynthSettings] = useState<SynthSettings>(defaultPreset.pattern.synthSettings);
  const [fxSettings, setFxSettings] = useState<FXSettings>(defaultPreset.pattern.fxSettings);
  const [selectedScale, setSelectedScale] = useState<ScaleName>('minor');

  // Song Mode State
  const [isSongMode, setIsSongMode] = useState<boolean>(false);
  const [songBlocks, setSongBlocks] = useState<SongBlock[]>([
    { id: 'sb_1', patternId: defaultPreset.pattern.id, repeats: 2 },
  ]);
  const [currentSongBlockIndex, setCurrentSongBlockIndex] = useState<number>(0);
  const [blockRepeatCounter, setBlockRepeatCounter] = useState<number>(0);

  // Dynamic Public Projects Manifest State
  const [publicProjects, setPublicProjects] = useState<{ label: string; path: string }[]>([]);

  // Export
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const isInitialMountRef = useRef<boolean>(true);

  // Fetch project manifest on mount
  useEffect(() => {
    fetch('./project-manifest.json')
      .then((res) => {
        if (!res.ok) throw new Error('Manifest not found');
        return res.json();
      })
      .then((data) => setPublicProjects(data))
      .catch((err) => {
        console.warn('Could not load project manifest, falling back to empty list', err);
      });
  }, []);

  // Restore Session on Mount from LocalStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.patterns) && parsed.patterns.length > 0) {
          setPatterns(parsed.patterns);
          const validActiveId = parsed.patterns.some((p: Pattern) => p.id === parsed.activePatternId)
            ? parsed.activePatternId
            : parsed.patterns[0].id;
          setActivePatternId(validActiveId);
          if (parsed.bpm) setBpm(parsed.bpm);
          if (parsed.swing !== undefined) setSwing(parsed.swing);
          if (parsed.stepCount) setStepCount(parsed.stepCount);
          if (parsed.synthSettings) setSynthSettings(parsed.synthSettings);
          if (parsed.fxSettings) setFxSettings(parsed.fxSettings);
          if (Array.isArray(parsed.songBlocks)) setSongBlocks(parsed.songBlocks);
          if (parsed.isSongMode !== undefined) setIsSongMode(parsed.isSongMode);
          if (parsed.selectedScale) setSelectedScale(parsed.selectedScale);
        }
      }
    } catch (e) {
      console.error('Failed to load session from local storage:', e);
    } finally {
      isInitialMountRef.current = false;
    }
  }, []);

  // Save Session to LocalStorage on State Change
  useEffect(() => {
    if (isInitialMountRef.current) return;
    try {
      const sessionData = {
        patterns,
        activePatternId,
        bpm,
        swing,
        stepCount,
        synthSettings,
        fxSettings,
        songBlocks,
        isSongMode,
        selectedScale,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData));
    } catch (e) {
      console.error('Failed to save session to local storage:', e);
    }
  }, [patterns, activePatternId, bpm, swing, stepCount, synthSettings, fxSettings, songBlocks, isSongMode, selectedScale]);


  // Audio Scheduler Refs
  const nextStepTimeRef = useRef<number>(0);
  const currentStepRef = useRef<number>(0);
  const timerIdRef = useRef<number | null>(null);

  // Sync FX real-time changes
  useEffect(() => {
    audioEngine.updateFX(fxSettings);
  }, [fxSettings]);

  // Update active pattern fields
  const updateActivePattern = (updater: (prev: Pattern) => Pattern) => {
    setPatterns((prev) =>
      prev.map((p) => (p.id === activePatternId ? updater(p) : p))
    );
  };

  // Switch Presets
  const handleSelectPreset = (preset: Preset) => {
    setPatterns([preset.pattern]);
    setActivePatternId(preset.pattern.id);
    setCurrentPresetId(preset.id);
    setBpm(preset.pattern.bpm);
    setSwing(preset.pattern.swing);
    setStepCount(preset.pattern.stepCount || 16);
    setSynthSettings(preset.pattern.synthSettings);
    setFxSettings(preset.pattern.fxSettings);
    setSongBlocks([{ id: `sb_${Date.now()}`, patternId: preset.pattern.id, repeats: 2 }]);
  };

  // Step Scheduler Logic
  const scheduleStep = useCallback(
    (stepIdx: number, time: number, currentPatternToPlay: Pattern) => {
      const tracks = currentPatternToPlay.tracks;
      const hasSolo = tracks.some((t) => t.soloed);

      tracks.forEach((track) => {
        if (track.muted) return;
        if (hasSolo && !track.soloed) return;

        const step = track.steps[stepIdx];
        if (!step || !step.active) return;

        const vol = track.volume * step.velocity;

        if (track.type === 'synth') {
          const secondsPerStep = 60 / bpm / 4;
          const note = step.note || 'C3';
          if (track.sound === 'bass') {
            audioEngine.triggerSynth(time, transposeNote(note, -12), secondsPerStep * 0.9, synthSettings, vol, track.pan);
          } else if (track.sound === 'piano_chord') {
            audioEngine.triggerSynth(time, note, secondsPerStep * 0.9, synthSettings, vol, track.pan);
            audioEngine.triggerSynth(time, transposeNote(note, 4), secondsPerStep * 0.9, synthSettings, vol * 0.8, track.pan);
            audioEngine.triggerSynth(time, transposeNote(note, 7), secondsPerStep * 0.9, synthSettings, vol * 0.8, track.pan);
          } else {
            audioEngine.triggerSynth(time, note, secondsPerStep * 0.9, synthSettings, vol, track.pan);
          }
        } else {
          switch (track.sound) {
            case 'kick':
              audioEngine.triggerKick(time, vol, track.pan);
              break;
            case 'snare':
              audioEngine.triggerSnare(time, vol, track.pan);
              break;
            case 'hihat_closed':
              audioEngine.triggerHiHat(time, false, vol, track.pan);
              break;
            case 'hihat_open':
              audioEngine.triggerHiHat(time, true, vol, track.pan);
              break;
            case 'clap':
              audioEngine.triggerClap(time, vol, track.pan);
              break;
            case 'tom':
              audioEngine.triggerTom(time, 0, vol, track.pan);
              break;
            case 'perc':
              audioEngine.triggerPerc(time, 0, vol, track.pan);
              break;
            default:
              audioEngine.triggerKick(time, vol, track.pan);
          }
        }
      });
    },
    [bpm, synthSettings]
  );

  // Main Audio Loop Scheduler
  const scheduler = useCallback(() => {
    const ctx = audioEngine.ensureContext();
    const scheduleAheadTime = 0.1; // 100ms lookahead
    const secondsPerStep = 60 / bpm / 4;

    while (nextStepTimeRef.current < ctx.currentTime + scheduleAheadTime) {
      let targetPattern = activePattern;

      // Handle Song Mode Pattern Progression
      if (isSongMode && songBlocks.length > 0) {
        const currentBlock = songBlocks[currentSongBlockIndex];
        const blockPattern = patterns.find((p) => p.id === currentBlock?.patternId);
        if (blockPattern) {
          targetPattern = blockPattern;
        }
      }

      // Calculate Swing Offset for odd steps
      let stepTime = nextStepTimeRef.current;
      if (currentStepRef.current % 2 === 1 && swing > 0) {
        stepTime += secondsPerStep * (swing / 100) * 0.6;
      }

      // Metronome Click Track
      if (metronomeEnabled && currentStepRef.current % 4 === 0) {
        audioEngine.triggerMetronome(stepTime, currentStepRef.current === 0);
      }

      scheduleStep(currentStepRef.current, stepTime, targetPattern);

      // Advance time and step
      nextStepTimeRef.current += secondsPerStep;

      // Advance step pointer
      const maxSteps = targetPattern.stepCount || 16;
      const nextStepIdx = (currentStepRef.current + 1) % maxSteps;
      currentStepRef.current = nextStepIdx;
      setCurrentStep(nextStepIdx);

      // Song Mode block progression logic on loop end
      if (nextStepIdx === 0 && isSongMode && songBlocks.length > 0) {
        const currentBlock = songBlocks[currentSongBlockIndex];
        if (currentBlock) {
          const nextRep = blockRepeatCounter + 1;
          if (nextRep >= currentBlock.repeats) {
            setBlockRepeatCounter(0);
            const nextBlockIdx = (currentSongBlockIndex + 1) % songBlocks.length;
            setCurrentSongBlockIndex(nextBlockIdx);
          } else {
            setBlockRepeatCounter(nextRep);
          }
        }
      }
    }
  }, [
    activePattern,
    bpm,
    swing,
    scheduleStep,
    isSongMode,
    songBlocks,
    currentSongBlockIndex,
    blockRepeatCounter,
    patterns,
    metronomeEnabled,
  ]);

  // Transport Controls
  const handleTogglePlay = () => {
    const ctx = audioEngine.ensureContext();

    if (isPlaying) {
      if (timerIdRef.current) clearInterval(timerIdRef.current);
      setIsPlaying(false);
    } else {
      currentStepRef.current = 0;
      setCurrentStep(0);
      nextStepTimeRef.current = ctx.currentTime + 0.05;
      setIsPlaying(true);
      timerIdRef.current = window.setInterval(() => scheduler(), 25);
    }
  };

  const handleStop = () => {
    if (timerIdRef.current) clearInterval(timerIdRef.current);
    setIsPlaying(false);
    currentStepRef.current = 0;
    setCurrentStep(0);
    setCurrentSongBlockIndex(0);
    setBlockRepeatCounter(0);
  };

  // Keep interval scheduler in sync with state changes
  useEffect(() => {
    if (isPlaying) {
      if (timerIdRef.current) clearInterval(timerIdRef.current);
      timerIdRef.current = window.setInterval(() => scheduler(), 25);
    }
    return () => {
      if (timerIdRef.current) clearInterval(timerIdRef.current);
    };
  }, [isPlaying, scheduler]);

  // Spacebar, R (Record), M (Metronome) hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLSelectElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.code === 'Escape') {
        e.preventDefault();
        handleStop();
      } else if (e.key.toLowerCase() === 'r') {
        e.preventDefault();
        setIsRecording((prev) => !prev);
      } else if (e.key.toLowerCase() === 'm') {
        e.preventDefault();
        setMetronomeEnabled((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying]);

  // Export Audio WAV
  const handleExportWav = async () => {
    setIsExporting(true);
    try {
      const blob = await audioEngine.renderWav(
        activePattern.tracks,
        synthSettings,
        fxSettings,
        bpm,
        swing,
        2
      );
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${activePattern.name.toLowerCase().replace(/\s+/g, '-')}-beat.wav`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export WAV', err);
      alert('WAV export failed.');
    } finally {
      setIsExporting(false);
    }
  };

  // Create New Blank Pattern
  const handleCreateNewPattern = () => {
    const nextLetter = String.fromCharCode(65 + (patterns.length % 26));
    const patternSuffix = patterns.length >= 26 ? ` ${Math.floor(patterns.length / 26) + 1}` : '';
    const newId = `p_${Date.now()}`;
    const newPattern: Pattern = {
      id: newId,
      name: `Pattern ${nextLetter}${patternSuffix}`,
      bpm: activePattern.bpm,
      swing: activePattern.swing,
      stepCount: activePattern.stepCount,
      synthSettings: { ...activePattern.synthSettings },
      fxSettings: { ...activePattern.fxSettings },
      tracks: activePattern.tracks.map((t) => ({
        ...t,
        id: `t_${t.sound}_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        steps: Array.from({ length: activePattern.stepCount || 16 }, () => ({
          active: false,
          note: t.type === 'synth' ? 'C3' : 'C2',
          velocity: 0.8,
        })),
      })),
    };
    setPatterns([...patterns, newPattern]);
    setActivePatternId(newId);
  };

  // Pattern Duplicate
  const handleDuplicatePattern = (patternToDup: Pattern) => {
    const newId = `p_${Date.now()}`;
    const newPattern: Pattern = {
      ...patternToDup,
      id: newId,
      name: `${patternToDup.name} (Copy)`,
    };
    setPatterns([...patterns, newPattern]);
    setActivePatternId(newId);
  };

  // Pattern Delete
  const handleDeletePattern = (idToDelete: string) => {
    if (patterns.length <= 1) return;
    const remaining = patterns.filter((p) => p.id !== idToDelete);
    setPatterns(remaining);
    setActivePatternId(remaining[0].id);
  };

  // Export Full Project File (.json)
  const handleExportProject = () => {
    const projectData: ProjectFile = {
      version: 1,
      type: 'beatmaker_project',
      name: `Beatmaker Project (${new Date().toLocaleDateString()})`,
      savedAt: new Date().toISOString(),
      bpm,
      swing,
      stepCount,
      activePatternId,
      patterns,
      songBlocks,
      isSongMode,
      synthSettings,
      fxSettings,
      selectedScale,
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(projectData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `beatmaker-project-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportFile = (imported: any) => {
    if (!imported) return;

    if (imported.patterns && Array.isArray(imported.patterns) && imported.patterns.length > 0) {
      setPatterns(imported.patterns);
      const validActiveId = imported.patterns.some((p: Pattern) => p.id === imported.activePatternId)
        ? imported.activePatternId
        : imported.patterns[0].id;
      setActivePatternId(validActiveId);
      if (imported.bpm) setBpm(imported.bpm);
      if (imported.swing !== undefined) setSwing(imported.swing);
      if (imported.stepCount) setStepCount(imported.stepCount);
      if (imported.synthSettings) setSynthSettings(imported.synthSettings);
      if (imported.fxSettings) setFxSettings(imported.fxSettings);
      if (Array.isArray(imported.songBlocks)) setSongBlocks(imported.songBlocks);
      if (imported.isSongMode !== undefined) setIsSongMode(imported.isSongMode);
      if (imported.selectedScale) setSelectedScale(imported.selectedScale);
      alert(`Project "${imported.name || 'Beatmaker Project'}" loaded successfully!`);
      return;
    }

    if (imported.tracks && Array.isArray(imported.tracks)) {
      const newPattern: Pattern = {
        id: imported.id || `p_${Date.now()}`,
        name: imported.name || `Pattern ${String.fromCharCode(65 + (patterns.length % 26))}`,
        bpm: imported.bpm || bpm,
        swing: imported.swing !== undefined ? imported.swing : swing,
        stepCount: imported.stepCount || stepCount,
        synthSettings: imported.synthSettings || synthSettings,
        fxSettings: imported.fxSettings || fxSettings,
        tracks: imported.tracks,
      };
      setPatterns((prev) => [...prev, newPattern]);
      setActivePatternId(newPattern.id);
      if (imported.bpm) setBpm(imported.bpm);
      if (imported.synthSettings) setSynthSettings(imported.synthSettings);
      if (imported.fxSettings) setFxSettings(imported.fxSettings);
      alert(`Imported pattern "${newPattern.name}" into pattern bank!`);
      return;
    }

    alert('Unrecognized JSON format. File must be a valid Beatmaker Project or Pattern file.');
  };

  const handleResetSession = () => {
    if (window.confirm('Reset studio session to factory presets? Any unsaved changes will be lost.')) {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (e) {
        console.error(e);
      }
      handleSelectPreset(DEFAULT_PRESETS[0]);
    }
  };

  const handleOpenPublicProject = async (projectPath: string) => {
    try {
      const response = await fetch(projectPath);
      if (!response.ok) {
        throw new Error(`Unable to load project: ${response.statusText}`);
      }
      const imported = await response.json();
      handleImportFile(imported);
    } catch (error) {
      console.error(error);
      alert('Failed to open saved project from public assets.');
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-purple-500 selection:text-white">
      {/* Top Navigation & Transport Header */}
      <Header
        isPlaying={isPlaying}
        onTogglePlay={handleTogglePlay}
        onStop={handleStop}
        isRecording={isRecording}
        onToggleRecording={() => setIsRecording(!isRecording)}
        metronomeEnabled={metronomeEnabled}
        onToggleMetronome={() => setMetronomeEnabled(!metronomeEnabled)}
        bpm={bpm}
        onBpmChange={(newBpm) => {
          setBpm(newBpm);
          updateActivePattern((p) => ({ ...p, bpm: newBpm }));
        }}
        swing={swing}
        onSwingChange={(newSwing) => {
          setSwing(newSwing);
          updateActivePattern((p) => ({ ...p, swing: newSwing }));
        }}
        stepCount={stepCount}
        onStepCountChange={(count) => {
          setStepCount(count);
          updateActivePattern((p) => ({
            ...p,
            stepCount: count,
            tracks: p.tracks.map((t) => ({
              ...t,
              steps:
                t.steps.length >= count
                  ? t.steps.slice(0, count)
                  : [
                      ...t.steps,
                      ...Array.from({ length: count - t.steps.length }, () => ({
                        active: false,
                        note: 'C3',
                        velocity: 0.8,
                      })),
                    ],
            })),
          }));
        }}
        currentPresetId={currentPresetId}
        onSelectPreset={handleSelectPreset}
        onExportProject={handleExportProject}
        publicProjects={publicProjects}
        onOpenPublicProject={handleOpenPublicProject}
        onResetSession={handleResetSession}
        isExporting={isExporting}
        onExportWav={handleExportWav}
        masterVol={masterVol}
        onMasterVolChange={setMasterVol}
      />

      {/* Main Studio Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 space-y-6">
        {/* Song Arranger Timeline */}
        <SongArranger
          patterns={patterns}
          activePatternId={activePatternId}
          onSelectPattern={setActivePatternId}
          onCreateNewPattern={handleCreateNewPattern}
          onDuplicatePattern={handleDuplicatePattern}
          onDeletePattern={handleDeletePattern}
          songBlocks={songBlocks}
          onSongBlocksChange={setSongBlocks}
          isSongMode={isSongMode}
          onToggleSongMode={() => setIsSongMode(!isSongMode)}
          currentSongBlockIndex={currentSongBlockIndex}
        />

        {/* Real-Time Performance & Live Recording Deck */}
        <LivePerformancePanel
          tracks={activePattern.tracks}
          onTracksChange={(newTracks) => updateActivePattern((p) => ({ ...p, tracks: newTracks }))}
          isRecording={isRecording}
          onToggleRecording={() => setIsRecording(!isRecording)}
          metronomeEnabled={metronomeEnabled}
          onToggleMetronome={() => setMetronomeEnabled(!metronomeEnabled)}
          isPlaying={isPlaying}
          currentStep={currentStep}
          synthSettings={synthSettings}
          selectedScale={selectedScale}
          onScaleChange={setSelectedScale}
          selectedTrackId={selectedTrackId}
          onSelectTrack={setSelectedTrackId}
        />

        {/* Step Sequencer Grid */}
        <SequencerGrid
          tracks={activePattern.tracks}
          onTracksChange={(newTracks) => updateActivePattern((p) => ({ ...p, tracks: newTracks }))}
          currentStep={currentStep}
          isPlaying={isPlaying}
          synthSettings={synthSettings}
          selectedScale={selectedScale}
          onScaleChange={setSelectedScale}
        />

        {/* Synthesizer & Audio FX Panels Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SynthPanel
            synth={synthSettings}
            onChange={(newSynth) => {
              setSynthSettings(newSynth);
              updateActivePattern((p) => ({ ...p, synthSettings: newSynth }));
            }}
            selectedScale={selectedScale}
          />

          <FXPanel
            fx={fxSettings}
            onChange={(newFx) => {
              setFxSettings(newFx);
              updateActivePattern((p) => ({ ...p, fxSettings: newFx }));
            }}
            isPlaying={isPlaying}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950 py-4 px-6 text-center text-xs text-zinc-500 font-mono">
        <p>Beat & Synth Sequencer • Built with React & Web Audio API • 100% Free GitHub Pages Ready</p>
      </footer>

    </div>
  );
}