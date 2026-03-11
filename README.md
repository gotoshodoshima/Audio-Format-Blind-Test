# Audio Format Blind Test

A professional-grade web application for performing blind A/B tests between original, uncompressed audio sources and various compressed formats. Designed for audiophiles, engineers, and researchers to objectively evaluate the transparency of audio codecs.

## 🚀 Key Features

- **Fixed A/B Comparison**: Strictly compares "Original Source" vs "Compressed Format" to ensure a focused and scientifically valid testing environment.
- **WASM-Powered Conversion**: Uses `ffmpeg.wasm` for high-quality client-side audio encoding (MP3, AAC, WAV).
- **High Resolution Support**: Handles up to 96kHz / 24-bit audio sources with accurate metadata detection.
- **Blind Shuffle Logic**: Randomly assigns the original and compressed versions to "A" and "B" slots for each round.
- **Statistical Analysis**: Calculates P-values and success rates to determine the statistical significance of the test results.
- **Modern UI**: Sleek dark mode interface with real-time audio visualization and peak meters.

## 🛠 Supported Formats

- **Reference**: Uncompressed Linear PCM (WAV, AIFF, etc.)
- **MP3**: Industry-standard lossy compression via LAME.
- **AAC**: High-efficiency compression (ADTS container for broad browser compatibility).
- **WAV (Downsample)**: Bit-depth (16/24-bit) and sample rate conversion for testing quantization/aliasing.

## 💻 Technical Stack

- **Frontend**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS 4
- **Audio Engine**: Web Audio API
- **Transcoding**: `@ffmpeg/ffmpeg` (FFmpeg.WASM)
- **Desktop Shell**: Electron (for offline/standalone distribution)

## 📥 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Development
1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```

### Building for Production
To create the web assets:
```bash
npm run build
```

To package as a Windows executable (.exe):
1. Build the web app (`npm run build`).
2. Copy `dist` assets into the `eq-app_antigravity` folder.
3. Run `npm run dist` inside the Electron folder.

## ⚖️ License
MIT

