import React, { useRef, useEffect } from 'react';

interface VisualizerProps {
  analyser: AnalyserNode | null;
  isActive: boolean;
}

export const Visualizer: React.FC<VisualizerProps> = ({ analyser, isActive }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analyser) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const draw = () => {
      if (!isActive) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }
      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = (canvas.width / dataArray.length) * 2.0;
      let x = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        // fallback to a light color if var is missing
        const vc = getComputedStyle(document.documentElement).getPropertyValue('--viz-color').trim() || '255,255,255';
        ctx.fillStyle = `rgba(${vc}, ${0.8 + (barHeight / canvas.height) * 0.2})`;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth;
        if (x > canvas.width) break;
      }
    };
    if (isActive) {
      draw();
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [analyser, isActive]);

  return <canvas ref={canvasRef} width={800} height={240} className="w-full h-32 rounded-lg mt-4 opacity-90" />;
};
