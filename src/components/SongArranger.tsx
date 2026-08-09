import React from 'react';
import { Layers, Plus, Copy, Trash2, Play, Repeat, ArrowRight } from 'lucide-react';
import { Pattern, SongBlock } from '../types';

interface SongArrangerProps {
  patterns: Pattern[];
  activePatternId: string;
  onSelectPattern: (id: string) => void;
  onCreateNewPattern: () => void;
  onDuplicatePattern: (pattern: Pattern) => void;
  onDeletePattern: (id: string) => void;
  songBlocks: SongBlock[];
  onSongBlocksChange: (blocks: SongBlock[]) => void;
  isSongMode: boolean;
  onToggleSongMode: () => void;
  currentSongBlockIndex: number;
}

export const SongArranger: React.FC<SongArrangerProps> = ({
  patterns,
  activePatternId,
  onSelectPattern,
  onCreateNewPattern,
  onDuplicatePattern,
  onDeletePattern,
  songBlocks,
  onSongBlocksChange,
  isSongMode,
  onToggleSongMode,
  currentSongBlockIndex,
}) => {
  const activePattern = patterns.find((p) => p.id === activePatternId) || patterns[0];

  const handleAddSongBlock = (patternId: string) => {
    const newBlock: SongBlock = {
      id: `sb_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      patternId,
      repeats: 1,
    };
    onSongBlocksChange([...songBlocks, newBlock]);
  };

  const handleUpdateBlockRepeats = (blockId: string, repeats: number) => {
    onSongBlocksChange(
      songBlocks.map((b) => (b.id === blockId ? { ...b, repeats: Math.max(1, repeats) } : b))
    );
  };

  const handleRemoveBlock = (blockId: string) => {
    onSongBlocksChange(songBlocks.filter((b) => b.id !== blockId));
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-2xl text-zinc-100 flex flex-col gap-4">
      {/* Panel Header */}
      <div className="flex flex-wrap items-center justify-between border-b border-zinc-800 pb-3 gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-bold text-sm tracking-tight text-white">Pattern & Song Arranger</h2>
            <p className="text-[11px] text-zinc-400">Line up and repeat patterns to build full song tracks</p>
          </div>
        </div>

        {/* Mode Switcher: Loop Pattern vs Play Song */}
        <div className="flex items-center gap-2 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
          <button
            onClick={() => {
              if (isSongMode) onToggleSongMode();
            }}
            className={`px-3 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition ${
              !isSongMode
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Repeat className="w-3.5 h-3.5" /> Pattern Loop
          </button>
          <button
            onClick={() => {
              if (!isSongMode) onToggleSongMode();
            }}
            className={`px-3 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition ${
              isSongMode
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Play className="w-3.5 h-3.5" /> Song Timeline
          </button>
        </div>
      </div>

      {/* Pattern Bank Slots */}
      <div>
        <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
          <span className="text-xs font-mono text-zinc-400 uppercase font-bold tracking-wider">
            Pattern Bank ({patterns.length})
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onCreateNewPattern}
              className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 rounded-lg text-xs font-mono flex items-center gap-1.5 border border-emerald-500/30 transition shadow-sm"
              title="Create a new blank pattern"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-400" /> + New Blank Pattern
            </button>
            {activePattern && (
              <button
                onClick={() => onDuplicatePattern(activePattern)}
                className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-mono flex items-center gap-1.5 border border-zinc-700 transition"
                title="Duplicate current pattern to edit variation"
              >
                <Copy className="w-3.5 h-3.5 text-purple-400" /> Duplicate Pattern
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 items-center">
          {patterns.map((p) => {
            const isActive = p.id === activePatternId;
            return (
              <div
                key={p.id}
                className={`p-2.5 rounded-xl border transition flex items-center gap-3 shrink-0 ${
                  isActive
                    ? 'bg-purple-950/50 border-purple-500/80 shadow-lg shadow-purple-500/10'
                    : 'bg-zinc-950 border-zinc-800 hover:bg-zinc-800/60'
                }`}
              >
                <button
                  onClick={() => onSelectPattern(p.id)}
                  className="text-left font-mono"
                >
                  <div className={`font-bold text-xs ${isActive ? 'text-purple-300' : 'text-zinc-200'}`}>
                    {p.name}
                  </div>
                  <div className="text-[10px] text-zinc-500">
                    {p.tracks.length} tracks • {p.bpm} BPM
                  </div>
                </button>

                <div className="flex items-center gap-1 border-l border-zinc-800/80 pl-2">
                  <button
                    onClick={() => handleAddSongBlock(p.id)}
                    className="p-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[10px] font-mono flex items-center gap-1"
                    title="Add pattern to song timeline"
                  >
                    <Plus className="w-3 h-3 text-emerald-400" />
                  </button>
                  {patterns.length > 1 && (
                    <button
                      onClick={() => onDeletePattern(p.id)}
                      className="p-1 text-zinc-600 hover:text-red-400 transition"
                      title="Delete pattern"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          <button
            onClick={onCreateNewPattern}
            className="p-2.5 rounded-xl border border-dashed border-zinc-700 hover:border-emerald-500/80 bg-zinc-950/50 hover:bg-emerald-950/20 transition flex items-center justify-center gap-1.5 shrink-0 font-mono text-xs text-zinc-400 hover:text-emerald-300 cursor-pointer px-4"
            title="Add new blank pattern"
          >
            <Plus className="w-4 h-4 text-emerald-400" /> New Pattern
          </button>
        </div>
      </div>

      {/* Song Timeline Blocks */}
      <div className="p-3 bg-zinc-950/80 border border-zinc-800 rounded-xl space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-xs font-mono font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
            Song Timeline Sequence ({songBlocks.length} Blocks)
          </span>
          <span className="text-[10px] text-zinc-500 font-mono">
            {isSongMode ? '▶ Playing Song Timeline' : 'Click "Song Timeline" above to play sequence'}
          </span>
        </div>

        {songBlocks.length === 0 ? (
          <div className="p-4 border border-dashed border-zinc-800 rounded-xl text-center text-xs text-zinc-500">
            Click <strong className="text-zinc-300">+</strong> on any pattern above to add it to the song timeline!
          </div>
        ) : (
          <div className="flex items-center gap-2 overflow-x-auto py-2">
            {songBlocks.map((block, idx) => {
              const targetPat = patterns.find((p) => p.id === block.patternId);
              const isPlayingBlock = isSongMode && currentSongBlockIndex === idx;

              return (
                <React.Fragment key={block.id}>
                  <div
                    className={`p-2.5 rounded-xl border transition flex flex-col gap-1.5 shrink-0 w-36 relative ${
                      isPlayingBlock
                        ? 'bg-indigo-600 text-white border-white shadow-xl shadow-indigo-600/40 animate-pulse'
                        : 'bg-zinc-900 border-zinc-800'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-mono font-bold text-zinc-400">Block #{idx + 1}</span>
                      <button
                        onClick={() => handleRemoveBlock(block.id)}
                        className="text-zinc-500 hover:text-red-400 text-xs font-mono"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="font-bold text-xs truncate">
                      {targetPat ? targetPat.name : 'Unknown Pattern'}
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono bg-zinc-950/60 p-1 rounded border border-zinc-800/80">
                      <span className="text-zinc-400">Repeat:</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleUpdateBlockRepeats(block.id, block.repeats - 1)}
                          className="px-1 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-200 font-bold"
                        >
                          -
                        </button>
                        <span className="font-bold text-indigo-300">{block.repeats}x</span>
                        <button
                          onClick={() => handleUpdateBlockRepeats(block.id, block.repeats + 1)}
                          className="px-1 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-200 font-bold"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  {idx < songBlocks.length - 1 && (
                    <ArrowRight className="w-4 h-4 text-zinc-600 shrink-0" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
