export interface Song {
  id: string;
  name: string;
  buffer: AudioBuffer;
  rawData: Uint8Array; // Added for FFmpeg conversion
  originalExt: string; // e.g. 'wav', 'flac'
  duration: number;
  rms: number;
  originalSampleRate: number;
  originalBitDepth: number;
}

export interface Profile {
  id: string;
  name: string;
  enabled: boolean;
  // Conversion specs
  codec: 'mp3' | 'aac' | 'wav' | 'original';
  bitrate?: string; // e.g. "320k", "256k"
  sampleRate?: number; // e.g. 44100, 48000
  bitDepth?: number; // e.g. 16, 24
  
  // Rating stats (Glicko-2)
  rating: number;
  rd: number;
  vol: number;
  wins: number;
  battles: number;
  draws: number;
  perSongRatings: Record<string, { rating: number; rd: number; vol: number }>;
}

export interface HistoryEntry {
  timestamp: number;
  winnerId: string | null;
  vote: 'A' | 'B' | 'Tie';
  song: string;
  songId: string | null;
  profileA: string;
  profileB: string;
  idA: string;
  idB: string;
  duration: number | null;
  ratingA: number;
  ratingB: number;
}
