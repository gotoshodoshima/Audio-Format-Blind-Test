import { useState, useEffect } from 'react';
import { Activity, Sun, Moon } from 'lucide-react';
import { SetupTab } from './components/SetupTab';
import { TestTab } from './components/TestTab';
import type { Song, Profile, HistoryEntry } from './types';

function App() {
  const [mode, setMode] = useState<'setup' | 'test' | 'results'>('setup');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('eq_blind_test_theme') as 'light' | 'dark') || 'dark';
  });
  const [showVisualizer, setShowVisualizer] = useState<'visible' | 'hidden'>(() => {
    return (localStorage.getItem('eq_blind_test_visualizer') as 'visible' | 'hidden') || 'visible';
  });
  
  // Global App State
  const [playlist, setPlaylist] = useState<Song[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>(() => {
    const saved = localStorage.getItem('eq_blind_test_profiles');
    if (saved) return JSON.parse(saved);
    return [
      {
        id: 'orig',
        name: 'Original',
        enabled: true,
        codec: 'original',
        rating: 1500,
        rd: 350,
        vol: 0.06,
        wins: 0,
        battles: 0,
        draws: 0,
        perSongRatings: {}
      },
      {
        id: 'compressed',
        name: 'Compressed',
        enabled: true,
        codec: 'aac',
        bitrate: '256k',
        sampleRate: 44100,
        rating: 1500,
        rd: 350,
        vol: 0.06,
        wins: 0,
        battles: 0,
        draws: 0,
        perSongRatings: {}
      }
    ];
  });
  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    const saved = localStorage.getItem('eq_blind_test_history');
    if (saved) return JSON.parse(saved);
    return [];
  });

  // Effects
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('eq_blind_test_theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('eq_blind_test_profiles', JSON.stringify(profiles));
  }, [profiles]);

  useEffect(() => {
    localStorage.setItem('eq_blind_test_visualizer', showVisualizer);
  }, [showVisualizer]);

  useEffect(() => {
    localStorage.setItem('eq_blind_test_history', JSON.stringify(history));
  }, [history]);

  const resetStats = () => {
    setHistory([]);
    setProfiles(prev => prev.map(p => ({
      ...p,
      rating: 1500,
      rd: 350,
      vol: 0.06,
      wins: 0,
      battles: 0,
      draws: 0,
      perSongRatings: {}
    })));
  };

  return (
    <div className="min-h-screen pb-20 bg-background text-foreground transition-colors duration-300">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border text-sm">
        <div className="w-full max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity size={20} className="text-primary" />
            <h1 className="font-bold">Audio Format Blind Test</h1>
          </div>
          <nav className="flex gap-4 font-medium items-center">
            <button 
              onClick={() => setMode('setup')} 
              className={`transition-colors ${mode === 'setup' ? 'text-foreground font-bold' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Setup
            </button>
            <button 
              onClick={() => {
                // Guard: check if all songs have been converted for all active profiles
                const activeProfiles = profiles.filter(p => p.enabled);
                if (playlist.length === 0) {
                  alert('Please load at least 1 song first.');
                  return;
                }
                if (activeProfiles.length < 2) {
                  alert('Please enable at least 2 profiles first.');
                  return;
                }
                const allConverted = playlist.every(song => {
                  const variants = (song as any).variants;
                  if (!variants) return false;
                  // Check for both the reference and target variants using their actual IDs
                  return !!variants[profiles[0].id] && !!variants[profiles[1].id];
                });
                if (!allConverted) {
                  alert('Please convert all songs first using "Convert & Prepare" in Setup.');
                  return;
                }
                setMode('test');
              }} 
              className={`transition-colors ${mode === 'test' ? 'text-foreground font-bold' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Test
            </button>
            <button 
              onClick={() => setShowVisualizer(v => v === 'visible' ? 'hidden' : 'visible')} 
              className={`p-1.5 rounded-lg transition-colors ml-4 ${showVisualizer === 'visible' ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground'}`}
              title="Toggle Visualizer"
            >
              <Activity size={16} className={showVisualizer !== 'visible' ? 'opacity-50' : ''} />
            </button>
            <button 
              onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} 
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors ml-2"
              title="Toggle Theme"
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </nav>
        </div>
      </header>

      <main className="w-full max-w-4xl mx-auto px-4 py-8 relative">
        {mode === 'setup' && (
          <SetupTab 
            playlist={playlist} 
            setPlaylist={setPlaylist} 
            profiles={profiles}
            setProfiles={setProfiles}
          />
        )}
        
        {mode === 'test' && (
          <TestTab 
            playlist={playlist} 
            profiles={profiles} 
            history={history}
            setHistory={setHistory}
            resetStats={resetStats}
            showVisualizer={showVisualizer === 'visible'}
          />
        )}
      </main>
    </div>
  );
}

export default App;
