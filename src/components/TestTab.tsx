import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';
import type { Profile, Song, HistoryEntry } from '../types';
import { Visualizer } from './Visualizer';

interface TestTabProps {
  playlist: Song[];
  profiles: Profile[];
  history: HistoryEntry[];
  setHistory: React.Dispatch<React.SetStateAction<HistoryEntry[]>>;
  resetStats: () => void;
}

export const TestTab: React.FC<TestTabProps> = ({ playlist, profiles, history, setHistory, resetStats }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeSource, setActiveSource] = useState<'A' | 'B' | null>(null);
  
  // Test pair state
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [hiddenA, setHiddenA] = useState<Profile | null>(null);
  const [hiddenB, setHiddenB] = useState<Profile | null>(null);

  // Playback state
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.8);
  
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceARef = useRef<AudioBufferSourceNode | null>(null);
  const sourceBRef = useRef<AudioBufferSourceNode | null>(null);
  const gainARef = useRef<GainNode | null>(null);
  const gainBRef = useRef<GainNode | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const startTimeRef = useRef<number>(0);
  const pauseTimeRef = useRef<number>(0);
  const animationRef = useRef<number | null>(null);
  const roundInitialized = useRef(false);

  // Auto-start round when component mounts (no Start New Round button)
  useEffect(() => {
    if (!roundInitialized.current) {
      roundInitialized.current = true;
      autoStartRound();
    }
    return () => {
      sourceARef.current?.stop();
      sourceBRef.current?.stop();
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatTimeDisplay = (s: number) => { 
    const m = Math.floor(s / 60); 
    const sc = Math.floor(s % 60); 
    return `${m}:${sc.toString().padStart(2, '0')}`; 
  };

  const trials = history.length;
  const calculateSuccesses = () => {
     let correct = 0;
     for (const h of history) {
        const targetA = profiles.find(p => p.id === h.idA);
        const targetB = profiles.find(p => p.id === h.idB);
        if (!targetA || !targetB) continue;

        const isAOrig = targetA.codec === 'original';
        const isBOrig = targetB.codec === 'original';

        if (isAOrig && h.vote === 'A') correct++;
        else if (isBOrig && h.vote === 'B') correct++;
     }
     return correct;
  };
  const successes = calculateSuccesses();

  const getBinomialPValue = (n: number, k: number, p: number = 0.5) => {
    if (n === 0) return 1;
    let sum = 0;
    for (let i = k; i <= n; i++) {
       let coeff = 1;
       for (let x = 1; x <= i; x++) coeff = coeff * (n - x + 1) / x;
       sum += coeff * Math.pow(p, i) * Math.pow(1 - p, n - i);
    }
    return sum;
  };

  const pValue = getBinomialPValue(trials, successes);
  const isSignificant = trials >= 5 && pValue < 0.05;

  const autoStartRound = () => {
    if (profiles.length < 2 || playlist.length === 0) return;
    
    const song = playlist[Math.floor(Math.random() * playlist.length)];
    const pA = profiles[0];
    const pB = profiles[1];
    
    setCurrentSong(song);
    
    if (Math.random() > 0.5) {
      setHiddenA(pA);
      setHiddenB(pB);
    } else {
      setHiddenA(pB);
      setHiddenB(pA);
    }
    
    setActiveSource(null);
    setCurrentTime(0);
    pauseTimeRef.current = 0;
  };

  const startTestRound = () => {
    if (profiles.length < 2 || playlist.length === 0) return;
    
    sourceARef.current?.stop();
    sourceBRef.current?.stop();
    setIsPlaying(false);
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    
    autoStartRound();
  };

  const startPlayback = async (startFromOffset: number, forcedSource?: 'A' | 'B') => {
    if (!currentSong || !hiddenA || !hiddenB) return;

    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') await ctx.resume();

    // Setup master gain & analyser once
    if (!masterGainRef.current) {
        masterGainRef.current = ctx.createGain();
        analyserRef.current = ctx.createAnalyser();
        analyserRef.current.fftSize = 4096;
        masterGainRef.current.connect(analyserRef.current);
        analyserRef.current.connect(ctx.destination);
    }
    masterGainRef.current.gain.value = volume;

    sourceARef.current?.stop();
    sourceBRef.current?.stop();
    gainARef.current?.disconnect();
    gainBRef.current?.disconnect();

    const gainA = ctx.createGain();
    const gainB = ctx.createGain();
    gainARef.current = gainA;
    gainBRef.current = gainB;

    // Both connect to master
    gainA.connect(masterGainRef.current);
    gainB.connect(masterGainRef.current);

    // Use forcedSource if provided (first click), otherwise use current activeSource
    const effectiveSource = forcedSource || activeSource;
    gainA.gain.value = effectiveSource === 'A' ? 1 : 0;
    gainB.gain.value = effectiveSource === 'B' ? 1 : 0;

    const sourceA = ctx.createBufferSource();
    const sourceB = ctx.createBufferSource();

    let bufferA = (currentSong as any).variants?.[hiddenA.id] || currentSong.buffer;
    let bufferB = (currentSong as any).variants?.[hiddenB.id] || currentSong.buffer;

    sourceA.buffer = bufferA;
    sourceB.buffer = bufferB;
    sourceA.loop = true;
    sourceB.loop = true;

    sourceA.connect(gainA);
    sourceB.connect(gainB);

    sourceARef.current = sourceA;
    sourceBRef.current = sourceB;

    startTimeRef.current = ctx.currentTime - startFromOffset;
    
    sourceA.start(0, startFromOffset);
    sourceB.start(0, startFromOffset);

    setIsPlaying(true);

    const updateProgress = () => {
      if (!sourceARef.current || !currentSong) return;
      const elapsed = (ctx.currentTime - startTimeRef.current) % currentSong.duration;
      setCurrentTime(elapsed);
      animationRef.current = requestAnimationFrame(updateProgress);
    };
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    updateProgress();
  };

  const handlePlayPause = () => {
    if (!currentSong) return;
    if (isPlaying) {
      pauseTimeRef.current = (audioCtxRef.current!.currentTime - startTimeRef.current) % currentSong.duration;
      sourceARef.current?.stop();
      sourceBRef.current?.stop();
      setIsPlaying(false);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    } else {
      const source = activeSource || 'A';
      if (!activeSource) setActiveSource('A');
      startPlayback(pauseTimeRef.current % currentSong.duration, source);
    }
  };

  const handleSeek = (time: number) => {
    pauseTimeRef.current = time;
    if (isPlaying) {
      startPlayback(time);
    } else {
      setCurrentTime(time);
    }
  };

  const handleVolume = (vol: number) => {
    setVolume(vol);
    if (masterGainRef.current) masterGainRef.current.gain.value = vol;
  };

  const switchSource = (source: 'A' | 'B') => {
    setActiveSource(source);
    if (gainARef.current && gainBRef.current) {
        gainARef.current.gain.value = source === 'A' ? 1 : 0;
        gainBRef.current.gain.value = source === 'B' ? 1 : 0;
    }
    if (!isPlaying) {
      // Auto-play on source click if paused, passing forcedSource
      startPlayback(pauseTimeRef.current % (currentSong?.duration || 1), source);
    }
  };

  const handleVote = (vote: 'A' | 'B') => {
    if (!hiddenA || !hiddenB || !currentSong) return;

    sourceARef.current?.stop();
    sourceBRef.current?.stop();
    setIsPlaying(false);
    if (animationRef.current) cancelAnimationFrame(animationRef.current);

    const winnerId = vote === 'A' ? hiddenA.id : hiddenB.id;
    
    const entry: HistoryEntry = {
      timestamp: Date.now(),
      vote,
      winnerId,
      song: currentSong.name,
      songId: currentSong.id,
      profileA: hiddenA.name,
      profileB: hiddenB.name,
      idA: hiddenA.id,
      idB: hiddenB.id,
      duration: 0,
      ratingA: hiddenA.rating,
      ratingB: hiddenB.rating
    };
    
    setHistory([entry, ...history]);
    startTestRound(); 
  };

  const progressPercent = currentSong ? (currentTime / currentSong.duration) * 100 : 0;
  const volumePercent = volume * 100;

  return (
    <div className="flex flex-col items-center gap-8 py-4 w-full text-sm">
      
      {/* Top Playback Control Bar */}
      <div className="bg-muted/50 rounded-xl p-6 w-full border border-border relative">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-4">
            <div className="flex items-center gap-3 overflow-hidden w-full md:w-auto">
                <div className="truncate flex-1 min-w-0">
                    <div className="text-sm font-bold truncate">{currentSong ? currentSong.name : "Waiting for audio..."}</div>
                    <div className="text-xs text-muted-foreground">{playlist.length} Songs Loaded</div>
                </div>
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
                <span className="text-[10px] font-mono opacity-60">VOL</span>
                <input
                    type="range"
                    min="0" max="1" step="0.01"
                    value={volume}
                    onChange={e => handleVolume(parseFloat(e.target.value))}
                    className="w-full md:w-24"
                    style={{ background: `linear-gradient(to right, var(--slider-track-fill) ${volumePercent}%, var(--slider-track-bg) ${volumePercent}%)` }}
                />
            </div>
        </div>

        <div className="flex items-center gap-4">
            <button 
              onClick={handlePlayPause} 
              disabled={!currentSong} 
              className="size-12 shrink-0 rounded-full bg-foreground text-background flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-50"
            >
              {isPlaying ? <Pause size={24} /> : <Play size={24} />}
            </button>
            <div className="w-full">
                <input
                    type="range"
                    min="0" max={currentSong?.duration || 100} step="0.1"
                    value={currentTime}
                    onChange={e => handleSeek(parseFloat(e.target.value))}
                    disabled={!currentSong}
                    className="w-full"
                    style={{ background: `linear-gradient(to right, var(--slider-track-fill) ${progressPercent}%, var(--slider-track-bg) ${progressPercent}%)` }}
                />
                <div className="flex justify-between text-[10px] font-mono text-muted-foreground mt-1">
                    <span>{formatTimeDisplay(currentTime)}</span>
                    <span>{formatTimeDisplay(currentSong?.duration || 0)}</span>
                </div>
            </div>
        </div>
      </div>

      <div className="text-center w-full">
        <div className="inline-block bg-primary text-primary-foreground px-4 py-1.5 rounded-full text-xs font-bold mb-4 border border-border">
            Round {history.length + 1}
        </div>
        <h2 className="text-xl font-bold mb-1">Blind A/B Test</h2>
        <p className="text-muted-foreground text-xs opacity-70 italic">
          {currentSong ? `Now Playing: ${currentSong.name}` : "..."}
        </p>
      </div>

      {/* Play A / Play B are always shown when a round is ready */}
      {hiddenA && hiddenB && (
        <div className="w-full max-w-2xl mx-auto space-y-8">
          <div className="grid grid-cols-2 gap-4 h-64">
            <button 
              onClick={() => switchSource('A')} 
              className={`relative rounded-2xl border-2 transition-all duration-300 overflow-hidden flex flex-col items-start p-6 text-left group ${activeSource === 'A' ? 'border-primary bg-muted shadow-xl opacity-100' : 'border-border bg-background opacity-40 hover:opacity-100'} `}
            >
              <span className={`text-3xl font-bold mb-2 ${activeSource === 'A' ? 'text-primary' : 'text-muted-foreground'} `}>
                Play A
              </span>
              {/* Only show visualizer for the active source */}
              {activeSource === 'A' && (
                <div className="flex-1 w-full flex items-end">
                    <Visualizer analyser={analyserRef.current} isActive={isPlaying} />
                </div>
              )}
            </button>
            <button 
              onClick={() => switchSource('B')} 
              className={`relative rounded-2xl border-2 transition-all duration-300 overflow-hidden flex flex-col items-start p-6 text-left group ${activeSource === 'B' ? 'border-primary bg-muted shadow-xl opacity-100' : 'border-border bg-background opacity-40 hover:opacity-100'} `}
            >
              <span className={`text-3xl font-bold mb-2 ${activeSource === 'B' ? 'text-primary' : 'text-muted-foreground'} `}>
                Play B
              </span>
              {/* Only show visualizer for the active source */}
              {activeSource === 'B' && (
                <div className="flex-1 w-full flex items-end">
                   <Visualizer analyser={analyserRef.current} isActive={isPlaying} />
                </div>
              )}
            </button>
          </div>

          {/* Prefer button: gray bg + white text normally, white bg + black text on hover */}
          <div className="w-full h-16">
            <button 
                onClick={() => handleVote(activeSource as 'A' | 'B')} 
                className={`w-full h-full font-bold rounded-xl transition-all duration-200 ${!activeSource ? 'bg-black text-zinc-500 opacity-50 cursor-not-allowed border border-zinc-800' : 'bg-black text-white border border-zinc-700 hover:bg-white hover:text-black hover:border-white shadow-lg'} `} 
                disabled={!activeSource}
            >
                Prefer {activeSource || '...'}
            </button>
          </div>
        </div>
      )}

      {/* Stats Display */}
      {trials > 0 && (
        <div className="flex flex-col items-center w-full max-w-md mt-4 gap-4">
          <div className="p-4 border border-border rounded-xl bg-muted/30 text-center w-full">
             <h3 className="font-bold mb-2">Confidence Interval Tracker</h3>
             <p className="text-xs text-muted-foreground mb-2">
               Trials: {trials} | Expected "Better" Guesses: {successes} 
             </p>
             <p className="text-xs text-muted-foreground mb-4">
               P-Value: {(pValue * 100).toFixed(2)}% (Target: &lt; 5.00%)
             </p>
             
             {isSignificant ? (
                <div className="text-green-500 font-bold border border-green-500/30 bg-green-500/10 p-2 rounded">
                  Distinguishable (&gt;= 95% Confidence)
                </div>
             ) : (
                <div className="text-yellow-500 font-bold border border-yellow-500/30 bg-yellow-500/10 p-2 rounded">
                  {trials < 5 ? 'Gathering Data... (Min 5 trials)' : 'Not statistically distinguishable yet.'}
                </div>
             )}
          </div>
          <button 
            onClick={() => {
              if (window.confirm("Are you sure you want to reset all test results? This cannot be undone.")) {
                resetStats();
              }
            }}
            className="border border-red-500/50 text-red-500 hover:bg-red-500/10 px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 text-xs font-bold w-full"
          >
            Reset Results
          </button>
        </div>
      )}
    </div>
  );
}
