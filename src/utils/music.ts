import { ScaleName } from '../types';

export const NOTES_CHROMATIC = [
  'C2', 'C#2', 'D2', 'D#2', 'E2', 'F2', 'F#2', 'G2', 'G#2', 'A2', 'A#2', 'B2',
  'C3', 'C#3', 'D3', 'D#3', 'E3', 'F3', 'F#3', 'G3', 'G#3', 'A3', 'A#3', 'B3',
  'C4', 'C#4', 'D4', 'D#4', 'E4', 'F4', 'F#4', 'G4', 'G#4', 'A4', 'A#4', 'B4',
  'C5'
];

export const SCALES: Record<ScaleName, string[]> = {
  minor: ['C3', 'D3', 'D#3', 'F3', 'G3', 'G#3', 'A#3', 'C4', 'D4', 'D#4', 'F4', 'G4'],
  major: ['C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4'],
  pentatonic: ['C3', 'D#3', 'F3', 'G3', 'A#3', 'C4', 'D#4', 'F4', 'G4', 'A#4', 'C5'],
  blues: ['C3', 'D#3', 'F3', 'F#3', 'G3', 'A#3', 'C4', 'D#4', 'F4', 'F#4', 'G4', 'A#4'],
  dorian: ['C3', 'D3', 'D#3', 'F3', 'G3', 'A3', 'A#3', 'C4', 'D4', 'D#4', 'F4', 'G4'],
  synthwave: ['A2', 'C3', 'D3', 'E3', 'G3', 'A3', 'C4', 'D4', 'E4', 'G4', 'A4'],
  chromatic: NOTES_CHROMATIC
};

// Convert note string (e.g. "A4" or "C#3") to frequency in Hz
export function noteToFreq(note: string): number {
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const regex = /^([A-G]#?)(-?\d+)$/;
  const match = note.match(regex);
  if (!match) return 440;

  const pitch = match[1];
  const octave = parseInt(match[2], 10);
  const semitoneIndex = notes.indexOf(pitch);
  if (semitoneIndex === -1) return 440;

  // A4 = 440Hz, which is octave 4, semitone 9 (index 9 in C-based array)
  const midiNote = (octave + 1) * 12 + semitoneIndex;
  return 440 * Math.pow(2, (midiNote - 69) / 12);
}

export function transposeNote(note: string, semitones: number): string {
  const idx = NOTES_CHROMATIC.indexOf(note);
  if (idx === -1) return note;
  const newIndex = Math.max(0, Math.min(NOTES_CHROMATIC.length - 1, idx + semitones));
  return NOTES_CHROMATIC[newIndex];
}

export function midiNumberToNote(midi: number): string {
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midi / 12) - 1;
  const noteName = notes[midi % 12];
  return `${noteName}${octave}`;
}

// Format seconds into MM:SS
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}
