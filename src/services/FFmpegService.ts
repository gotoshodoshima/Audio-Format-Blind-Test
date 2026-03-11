import { FFmpeg } from '@ffmpeg/ffmpeg';
import type { Profile } from '../types';

let ffmpeg: FFmpeg | null = null;

export const getFFmpeg = async (): Promise<FFmpeg> => {
  if (ffmpeg) return ffmpeg;
  ffmpeg = new FFmpeg();
  
  ffmpeg.on('log', ({ message }) => {
    console.log('[FFmpeg]', message);
  });

  await ffmpeg.load({
    coreURL: await toBlobURL(`https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm`, 'application/wasm'),
  });

  return ffmpeg;
};

const toBlobURL = async (url: string, mimeType: string) => {
  const resp = await fetch(url);
  const body = await resp.blob();
  return URL.createObjectURL(new Blob([body], { type: mimeType }));
};

export const convertAudio = async (
  fileData: Uint8Array,
  originalExt: string,
  profile: Profile,
  onProgress?: (ratio: number) => void
): Promise<Uint8Array> => {
  const ff = await getFFmpeg();
  
  if (onProgress) {
    ff.on('progress', ({ progress }) => {
      onProgress(progress);
    });
  }

  const inputName = `input.${originalExt}`;
  
  let ext = 'wav';
  let ffmpegArgs: string[] = ['-i', inputName];

  if (profile.codec === 'mp3') {
    ext = 'mp3';
    ffmpegArgs.push('-c:a', 'libmp3lame');
    if (profile.bitrate) ffmpegArgs.push('-b:a', profile.bitrate);
  } else if (profile.codec === 'aac') {
    ext = 'aac';
    ffmpegArgs.push('-c:a', 'aac', '-ac', '2');
    if (profile.bitrate) ffmpegArgs.push('-b:a', profile.bitrate);
  } else if (profile.codec === 'wav') {
    ext = 'wav';
    ffmpegArgs.push('-c:a', 'pcm_s16le');
    if (profile.bitDepth === 24) {
      ffmpegArgs.pop();
      ffmpegArgs.push('pcm_s24le');
    }
  }

  if (profile.sampleRate) {
    ffmpegArgs.push('-ar', profile.sampleRate.toString());
  }

  const outputName = `output.${ext}`;
  ffmpegArgs.push(outputName);

  // CRITICAL: Clone ArrayBuffer to avoid detached buffer error on re-conversion
  const dataCopy = new Uint8Array(fileData.buffer.slice(0));
  await ff.writeFile(inputName, dataCopy);
  
  await ff.exec(ffmpegArgs);
  const data = await ff.readFile(outputName);
  
  await ff.deleteFile(inputName);
  await ff.deleteFile(outputName);
  if (onProgress) ff.off('progress', () => {});

  return new Uint8Array(data as Uint8Array);
};
