/**
 * LogoRemovie Studio - Frame-by-Frame Video Processing & Encoding Engine
 * Features:
 * - Constant Frame Rate (CFR) deterministic frame processing
 * - Standard MediaRecorder container muxing (100% playable WebM/MP4 format)
 * - Offscreen canvas rendering & Audio stream routing
 * - High performance MinHeap inpainting integration
 */

class VideoProcessor {
  constructor(videoElement, maskCanvas, options = {}) {
    this.video = videoElement;
    this.maskCanvas = maskCanvas;
    this.fps = options.fps || 30;
    this.qualityScale = options.qualityScale || 1;
    this.algo = options.algo || 'inpaint';
    this.inpaintRadius = options.inpaintRadius || 8;
    this.blurRadius = options.blurRadius || 20;
    this.isCancelled = false;

    this.onProgress = options.onProgress || (() => {});
    this.onComplete = options.onComplete || (() => {});
    this.onError = options.onError || (() => {});
  }

  cancel() {
    this.isCancelled = true;
  }

  async processAndEncode() {
    this.isCancelled = false;

    const origW = this.video.videoWidth || 1280;
    const origH = this.video.videoHeight || 720;

    // Ensure even dimensions for video encoder compatibility
    let targetW = Math.floor(origW * this.qualityScale);
    let targetH = Math.floor(origH * this.qualityScale);
    if (targetW % 2 !== 0) targetW -= 1;
    if (targetH % 2 !== 0) targetH -= 1;

    // Work Canvas
    const workCanvas = document.createElement('canvas');
    workCanvas.width = targetW;
    workCanvas.height = targetH;
    const ctx = workCanvas.getContext('2d', { willReadFrequently: true, alpha: false });

    // Mask Canvas
    const scaledMaskCanvas = document.createElement('canvas');
    scaledMaskCanvas.width = targetW;
    scaledMaskCanvas.height = targetH;
    const maskCtx = scaledMaskCanvas.getContext('2d', { willReadFrequently: true });
    maskCtx.drawImage(this.maskCanvas, 0, 0, targetW, targetH);
    const maskData = maskCtx.getImageData(0, 0, targetW, targetH);

    // Stream Setup using captureStream with target FPS for smooth timing
    const stream = workCanvas.captureStream(this.fps);

    // Audio stream routing (if supported & same-origin)
    let audioContext = null;
    let audioDestination = null;
    try {
      if (this.video.src && !this.video.src.startsWith('blob:') && !this.video.src.startsWith('data:')) {
        // Cross-origin audio check
      }
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaElementSource(this.video);
      audioDestination = audioContext.createMediaStreamDestination();
      source.connect(audioDestination);
      source.connect(audioContext.destination);

      const audioTrack = audioDestination.stream.getAudioTracks()[0];
      if (audioTrack) {
        stream.addTrack(audioTrack);
      }
    } catch (e) {
      console.warn("Audio stream routing fallback:", e);
    }

    // Determine best supported mimeType for MediaRecorder
    let mimeType = 'video/mp4;codecs=avc1.42E01E';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/mp4';
    }
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm;codecs=vp9,opus';
    }
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm;codecs=vp8,opus';
    }
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm';
    }

    const recordedChunks = [];
    let recorder;

    try {
      recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8000000 });
    } catch (e) {
      recorder = new MediaRecorder(stream);
    }

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        recordedChunks.push(e.data);
      }
    };

    const completionPromise = new Promise((resolve, reject) => {
      recorder.onstop = () => {
        const resultType = recorder.mimeType || mimeType || 'video/webm';
        const blob = new Blob(recordedChunks, { type: resultType });
        if (audioContext) {
          try { audioContext.close(); } catch (_) {}
        }
        resolve(blob);
      };
      recorder.onerror = (err) => reject(err);
    });

    recorder.start(100); // Collect data chunks every 100ms

    const duration = this.video.duration || 5;
    const totalFrames = Math.max(1, Math.floor(duration * this.fps));
    const frameIntervalSec = 1 / this.fps;

    this.video.currentTime = 0;
    this.video.pause();

    const frameDelayMs = 1000 / this.fps;

    for (let currentFrame = 0; currentFrame < totalFrames; currentFrame++) {
      if (this.isCancelled) {
        recorder.stop();
        throw new Error("Render cancelled by user.");
      }

      const targetTime = currentFrame * frameIntervalSec;
      await this._seekVideoToTime(targetTime);

      // Draw original frame onto canvas
      ctx.drawImage(this.video, 0, 0, targetW, targetH);
      const frameData = ctx.getImageData(0, 0, targetW, targetH);

      // Apply Inpainting / Filter algorithm
      this._applyFilter(frameData, maskData);
      ctx.putImageData(frameData, 0, 0);

      // Notify progress callback
      const percent = Math.min(100, Math.round(((currentFrame + 1) / totalFrames) * 100));
      this.onProgress({
        currentFrame: currentFrame + 1,
        totalFrames,
        percent,
        canvas: workCanvas
      });

      // Pacing delay to allow MediaRecorder stream encoder to capture at standard framerate
      await new Promise(resolve => setTimeout(resolve, frameDelayMs));
    }

    // Wait a brief tick before stopping recorder to flush final frames
    await new Promise(resolve => setTimeout(resolve, 200));
    recorder.stop();

    const resultBlob = await completionPromise;
    this.onComplete(resultBlob);
    return resultBlob;
  }

  _applyFilter(frameData, maskData) {
    if (this.algo === 'inpaint') {
      InpaintEngine.teleaInpaint(frameData, maskData, this.inpaintRadius);
    } else if (this.algo === 'blur') {
      InpaintEngine.blurDelogo(frameData, maskData, this.blurRadius);
    } else if (this.algo === 'mosaic') {
      InpaintEngine.mosaicPixelate(frameData, maskData, 16);
    } else if (this.algo === 'color') {
      InpaintEngine.colorFill(frameData, maskData);
    }
  }

  _seekVideoToTime(time) {
    return new Promise((resolve) => {
      if (Math.abs(this.video.currentTime - time) < 0.001) {
        resolve();
        return;
      }

      const onSeeked = () => {
        this.video.removeEventListener('seeked', onSeeked);
        resolve();
      };

      this.video.addEventListener('seeked', onSeeked);
      this.video.currentTime = time;
    });
  }
}
