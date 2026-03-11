import React, { useState, useRef } from 'react';
import { Upload, Settings, Loader2, Play, Trash2 } from 'lucide-react';
import type { Song, Profile } from '../types';
import { convertAudio } from '../services/FFmpegService';

interface SetupTabProps {
  playlist: Song[];
  setPlaylist: React.Dispatch<React.SetStateAction<Song[]>>;
  profiles: Profile[];
  setProfiles: React.Dispatch<React.SetStateAction<Profile[]>>;
}

export const SetupTab: React.FC<SetupTabProps> = ({ playlist, setPlaylist, profiles, setProfiles }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse original sample rate and bit depth from raw file bytes
  const parseAudioMetadata = (data: Uint8Array, ext: string): { sampleRate: number; bitDepth: number } => {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

    // WAV: RIFF header
    if (ext === 'wav' || ext === 'wave') {
      try {
        // Find 'fmt ' chunk
        let offset = 12; // skip RIFF header
        while (offset < data.length - 8) {
          const chunkId = String.fromCharCode(data[offset], data[offset + 1], data[offset + 2], data[offset + 3]);
          const chunkSize = view.getUint32(offset + 4, true);
          if (chunkId === 'fmt ') {
            const sampleRate = view.getUint32(offset + 12, true);
            const bitDepth = view.getUint16(offset + 22, true);
            return { sampleRate, bitDepth };
          }
          offset += 8 + chunkSize;
          if (chunkSize % 2 !== 0) offset++; // padding
        }
      } catch (e) { /* fallback below */ }
    }

    // FLAC: starts with 'fLaC', STREAMINFO block
    if (ext === 'flac') {
      try {
        if (data[0] === 0x66 && data[1] === 0x4C && data[2] === 0x61 && data[3] === 0x43) {
          // STREAMINFO is the first metadata block at offset 4
          // Block header: 1 byte (type + last-block flag), 3 bytes size
          const metaOffset = 8; // skip 4 byte magic + 4 byte block header
          // Bytes 10-11-12 (relative to STREAMINFO start): sample rate is 20 bits starting at byte 10
          const byte10 = data[metaOffset + 10];
          const byte11 = data[metaOffset + 11];
          const byte12 = data[metaOffset + 12];
          const sampleRate = (byte10 << 12) | (byte11 << 4) | (byte12 >> 4);
          const bitDepth = ((byte12 & 0x01) << 4 | (data[metaOffset + 13] >> 4)) + 1;
          return { sampleRate, bitDepth };
        }
      } catch (e) { /* fallback below */ }
    }

    // AIFF: 'FORM' header with 'AIFF' type
    if (ext === 'aiff' || ext === 'aif') {
      try {
        let offset = 12;
        while (offset < data.length - 8) {
          const chunkId = String.fromCharCode(data[offset], data[offset + 1], data[offset + 2], data[offset + 3]);
          const chunkSize = view.getUint32(offset + 4, false); // big-endian
          if (chunkId === 'COMM') {
            const bitDepth = view.getInt16(offset + 14, false);
            // Sample rate is IEEE 754 80-bit extended at offset+16, parse simplified
            const exp = view.getUint16(offset + 16, false);
            const mantissa = view.getUint32(offset + 18, false);
            const e = exp & 0x7FFF;
            const sampleRate = Math.round(mantissa * Math.pow(2, e - 16383 - 31));
            return { sampleRate, bitDepth };
          }
          offset += 8 + chunkSize;
          if (chunkSize % 2 !== 0) offset++;
        }
      } catch (e) { /* fallback below */ }
    }

    // Fallback: unknown format
    return { sampleRate: 0, bitDepth: 0 };
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const newSongs: Song[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const arrayBuffer = await file.arrayBuffer();
        
        // Deep copy the ArrayBuffer for FFmpeg so we don't transfer ownership away when decoding
        const rawData = new Uint8Array(arrayBuffer.slice(0));
        const originalExt = file.name.split('.').pop()?.toLowerCase() || 'wav';

        // Parse true sample rate and bit depth from raw file header
        const meta = parseAudioMetadata(rawData, originalExt);

        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        
        newSongs.push({
          id: Math.random().toString(36).substring(7),
          name: file.name,
          buffer: audioBuffer,
          rawData,
          originalExt,
          duration: audioBuffer.duration,
          rms: 0.1, // Placeholder
          originalSampleRate: meta.sampleRate || audioBuffer.sampleRate,
          originalBitDepth: meta.bitDepth || 16
        });
      }
      
      setPlaylist(prev => [...prev, ...newSongs]);
    } catch (err) {
      console.error("Error loading files", err);
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const updateProfile = (id: string, updates: Partial<Profile>) => {
    setProfiles(profiles.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const handleConvert = async () => {
    if (playlist.length === 0 || profiles.length < 2) return;
    
    setIsProcessing(true);
    
    // 'Original' is the first profile, 'Compressed' is the second
    const compProfile = profiles[1];
    
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const updatedPlaylist = [...playlist];

      // Assuming we need a way to store multiple variants per song, or we just rely on profiles 
      // dynamically matching at runtime in TestTab?
      // Wait, TestTab just takes the Profile and expects to find a converted buffer somewhere, or we decode on the fly.
      // Easiest is to attach a `variants: Record<string, AudioBuffer>` to each `Song`.
      for (let i = 0; i < updatedPlaylist.length; i++) {
        const song = { ...updatedPlaylist[i] };
        
        // Initialize variants if not present
        const variants = (song as any).variants ? { ...(song as any).variants } : {};
        (song as any).variants = variants;

        // Store the original/reference variants using its specific profile ID
        const refProfile = profiles[0];
        variants[refProfile.id] = song.buffer;

        console.log(`Converting ${song.name} to ${compProfile.name}...`);
        
        const convertedData = await convertAudio(song.rawData, song.originalExt, compProfile, (progress) => {
           console.log(`Progress: ${Math.round(progress * 100)}%`);
        });
        
        const convertedBuffer = await audioCtx.decodeAudioData((convertedData.buffer as ArrayBuffer).slice(0));
        variants[compProfile.id] = convertedBuffer;
        
        updatedPlaylist[i] = song;
      }
      
      setPlaylist(updatedPlaylist);
      alert('Conversion finished successfully!');
      
    } catch (e) {
      console.error(e);
      alert('Error during conversion');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in text-sm">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Settings size={20} /> Conversion Setup
        </h2>
        <div className="flex gap-2">
          <button 
            onClick={handleConvert}
            disabled={isProcessing || playlist.length === 0}
            className="bg-primary text-primary-foreground px-4 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            Convert & Prepare
          </button>
        </div>
      </div>

      <div className="bg-muted/50 rounded-xl p-6 border border-border">
        <div className="flex items-center gap-4">
          <label className="bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer px-4 py-2 rounded-lg flex items-center gap-2 font-medium">
            {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
            Upload Songs
            <input 
              type="file" 
              accept="audio/*" 
              multiple 
              className="hidden" 
              onChange={handleFileUpload}
              ref={fileInputRef}
              disabled={isProcessing}
            />
          </label>
          <div className="text-muted-foreground flex-1">
            {playlist.length} songs loaded
          </div>
        </div>
        
        {playlist.length > 0 && (
          <div className="mt-4 max-h-40 overflow-y-auto rounded bg-background border border-border">
            <ul className="divide-y divide-border text-xs">
              {playlist.map((song) => (
                <li key={song.id} className="p-2 flex justify-between items-center px-4 hover:bg-muted/30">
                  <span className="truncate">{song.name}</span>
                  <div className="flex gap-4 text-muted-foreground font-mono">
                    <span>{song.originalSampleRate} Hz</span>
                    <span>{song.originalBitDepth}-bit</span>
                    <button 
                      onClick={() => setPlaylist(playlist.filter(s => s.id !== song.id))}
                      className="text-red-400 hover:text-red-300 ml-2"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {profiles.map(p => (
          <div key={p.id} className={`border rounded-xl p-4 bg-background shadow-sm transition-opacity ${p.enabled ? 'border-border' : 'border-border/50 opacity-60'}`}>
            <div className="flex justify-between mb-4 gap-4">
              <div className="font-bold text-lg flex-1">
                {p.codec === 'original' ? 'Original Source' : 'Compressed Format'}
              </div>
            </div>
            
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span>Format</span>
                <select 
                  value={p.codec} 
                  onChange={e => updateProfile(p.id, { codec: e.target.value as any })}
                  disabled={p.codec === 'original'}
                  className="bg-muted border border-border rounded px-2 py-1 outline-none w-32 disabled:opacity-50"
                >
                  <option value="original">Uncompressed</option>
                  <option value="wav">WAV (Downsample)</option>
                  <option value="mp3">MP3</option>
                  <option value="aac">AAC</option>
                </select>
              </div>

              {p.codec !== 'original' && p.codec !== 'wav' && (
                <div className="flex items-center justify-between">
                  <span>Bitrate</span>
                  <select 
                    value={p.bitrate || '320k'} 
                    onChange={e => updateProfile(p.id, { bitrate: e.target.value })}
                    className="bg-muted border border-border rounded px-2 py-1 outline-none w-32"
                  >
                    <option value="320k">320 kbps</option>
                    <option value="256k">256 kbps</option>
                    <option value="192k">192 kbps</option>
                    <option value="128k">128 kbps</option>
                    <option value="96k">96 kbps</option>
                  </select>
                </div>
              )}

              {(p.codec === 'wav' || p.codec === 'original') && (
                <div className="flex items-center justify-between">
                  <span>Bit Depth</span>
                  <select 
                    value={p.bitDepth || 16} 
                    onChange={e => updateProfile(p.id, { bitDepth: parseInt(e.target.value) })}
                    className="bg-muted border border-border rounded px-2 py-1 outline-none w-32"
                  >
                    <option value={16}>16-bit</option>
                    <option value={24}>24-bit</option>
                  </select>
                </div>
              )}

              {p.codec !== 'original' && (
                <div className="flex items-center justify-between">
                  <span>Sample Rate</span>
                  <select 
                    value={p.sampleRate || 44100} 
                    onChange={e => updateProfile(p.id, { sampleRate: parseInt(e.target.value) })}
                    className="bg-muted border border-border rounded px-2 py-1 outline-none w-32"
                  >
                    <option value={44100}>44100 Hz</option>
                    <option value={48000}>48000 Hz</option>
                  </select>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
