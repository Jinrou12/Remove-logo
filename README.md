# LogoRemovie Studio 🛡️✨

**LogoRemovie Studio** is an AI-powered, browser-based image and video logo & watermark removal web application. Built with vanilla HTML5, CSS3, and JavaScript, it performs fast client-side inpainting, blurring, mosaic pixelation, and background patch filling without uploading your media to external servers.

![LogoRemovie Studio](https://img.shields.io/badge/Status-Complete-success?style=for-the-badge) ![Tech](https://img.shields.io/badge/Vanilla_JS-HTML5_Canvas-indigo?style=for-the-badge)

---

## 🌟 Key Features

- 📤 **Universal Media Upload**: Supports PNG, JPG, WEBP photos, and MP4, WEBM, MOV videos.
- 🎯 **Smart Selection Tools**:
  - **Rectangle Box Mask**: Drag and drop bounding box over watermark regions.
  - **Freehand Brush Tool**: Paint over irregularly shaped logos with customizable brush radius.
  - **Auto-Detect Logo**: Automatically detects high-contrast corner logos and places bounding masks.
- ⚡ **Multiple Removal Algorithms**:
  - **AI Telea Inpainting (Fast Marching Method)**: Natural texture propagation into masked logo areas.
  - **Gaussian Blur**: Softly diffuses logos into surrounding background colors.
  - **Mosaic Pixelate**: Obscures logos using customizable pixel grid blocks.
  - **Background Edge Patch**: Fills target box with sampled surrounding edge colors.
- 🎛️ **Split Screen Comparison Slider**: Drag to compare original vs. cleaned output side-by-side.
- 🎬 **Video Export & Audio Preservation**: Real-time canvas frame processing that keeps the original video's audio track intact.
- 📥 **One-Click HD Download**: Export cleaned photos (PNG/JPG) and videos (MP4/WebM).

---

## 🚀 Quick Start

1. Clone this repository:
   ```bash
   git clone https://github.com/Jinrou12/Remove-logo.git
   cd Remove-logo
   ```

2. Serve locally with any static HTTP server:
   ```bash
   npx http-server . -p 8080
   ```

3. Open `http://localhost:8080` in your web browser.

---

## 🛠️ Tech Stack

- **Frontend**: HTML5, CSS3 (Custom Glassmorphism Design System)
- **Engine**: Pure JavaScript (ES6+), Canvas 2D API, Web Audio API, Web MediaRecorder API
- **Inpainting**: Telea Fast Marching Method (FMM) algorithm implementation

---

## 📄 License

MIT License © 2026 Jinrou12
