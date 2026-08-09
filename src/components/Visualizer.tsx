import React, { useEffect, useRef } from 'react';
import { audioEngine } from '../audio/engine';

interface VisualizerProps {
  isPlaying: boolean;
}

export const Visualizer: React.FC<VisualizerProps> = ({ isPlaying }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrameId: number;

    const render = () => {
      animFrameId = requestAnimationFrame(render);

      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      if (!audioEngine.analyser || !isPlaying) {
        // Draw flat line when idle
        ctx.strokeStyle = 'rgba(168, 85, 247, 0.3)'; // purple accent
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();
        return;
      }

      const bufferLength = audioEngine.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      audioEngine.analyser.getByteTimeDomainData(dataArray);

      // Draw Oscilloscope Waveform
      ctx.lineWidth = 2;
      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, '#ec4899'); // pink
      gradient.addColorStop(0.5, '#a855f7'); // purple
      gradient.addColorStop(1, '#3b82f6'); // blue
      ctx.strokeStyle = gradient;

      ctx.beginPath();
      const sliceWidth = (width * 1.0) / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(width, height / 2);
      ctx.stroke();
    };

    render();

    return () => {
      cancelAnimationFrame(animFrameId);
    };
  }, [isPlaying]);

  return (
    <div className="relative w-full h-12 bg-zinc-950/80 rounded-lg border border-zinc-800 overflow-hidden flex items-center justify-center">
      <canvas
        ref={canvasRef}
        width={320}
        height={48}
        className="w-full h-full object-cover"
      />
      <div className="absolute top-1 right-2 text-[10px] uppercase font-mono tracking-wider text-zinc-500 pointer-events-none">
        Oscilloscope
      </div>
    </div>
  );
};
