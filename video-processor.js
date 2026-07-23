/**
 * LogoRemovie Studio - Frame-by-Frame Video Processing & Encoding Engine
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
    
    const targetW = Math.floor(origW * this.qualityScale);
    const targetH = Math.floor(origH * this.qualityScale);

    // Offscreen Canvas for processing
    const workCanvas = document.createElement('canvas');
    workCanvas.width = targetW;
    workCanvas.height = targetH;
    const ctx = workCanvas.getContext('2d', { willReadFrequently: true });

    // Scaled mask canvas
    const scaledMaskCanvas = document.createElement('canvas');
    scaledMaskCanvas.width = targetW;
    scaledMaskCanvas.height = targetH;
    const maskCtx = scaledMaskCanvas.getContext('2d', { willReadFrequently: true });
    maskCtx.drawImage(this.maskCanvas, 0, 0, targetW, targetH);
    const maskData = maskCtx.getImageData(0, 0, targetW, targetH);

    // Stream & MediaRecorder Setup
    const stream = workCanvas.captureStream(this.fps);
    
    // Web Audio API to route original video audio into export stream
    let audioContext = null;
    let audioDestination = null;
    try {
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
      console.warn("Audio extraction fallback (video might be muted or cross-origin):", e);
    }

    // Determine supported mimeType
    let mimeType = 'video/webm;codecs=vp9,opus';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm';
    }
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/mp4';
    }

    const recordedChunks = [];
    let recorder;

    try {
      recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6000000 });
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
        const blob = new Blob(recordedChunks, { type: recorder.mimeType || 'video/webm' });
        if (audioContext) audioContext.close();
        resolve(blob);
      };
      recorder.onerror = (err) => reject(err);
    });

    recorder.start();

    const duration = this.video.duration || 5;
    const totalFrames = Math.floor(duration * this.fps);
    const frameInterval = 1 / this.fps;

    let currentFrame = 0;
    this.video.currentTime = 0;
    this.video.pause();

    // Process frame loop
    for (currentFrame = 0; currentFrame < totalFrames; currentFrame++) {
      if (this.isCancelled) {
        recorder.stop();
        throw new Error("Render cancelled by user.");
      }

      const targetTime = currentFrame * frameInterval;
      await this._seekVideoToTime(targetTime);

      // Draw current video frame onto work canvas
      ctx.drawImage(this.video, 0, 0, targetW, targetH);
      const frameData = ctx.getImageData(0, 0, targetW, targetH);

      // Apply selected logo removal algorithm to frame
      if (this.algo === 'inpaint') {
        InpaintEngine.teleaInpaint(frameData, maskData, this.inpaintRadius);
      } else if (this.algo === 'blur') {
        InpaintEngine.blurDelogo(frameData, maskData, this.blurRadius);
      } else if (this.algo === 'mosaic') {
        InpaintEngine.mosaicPixelate(frameData, maskData, 16);
      } else if (this.algo === 'color') {
        InpaintEngine.colorFill(frameData, maskData);
      }

      ctx.putImageData(frameData, 0, 0);

      // Notify progress
      const percent = Math.min(100, Math.round(((currentFrame + 1) / totalFrames) * 100));
      this.onProgress({
        currentFrame: currentFrame + 1,
        totalFrames,
        percent,
        canvas: workCanvas
      });

      // Small yield to allow MediaRecorder stream capture & UI repaint
      await new Promise(res => setTimeout(res, 1000 / this.fps));
    }

    recorder.stop();
    const resultBlob = await completionPromise;
    this.onComplete(resultBlob);
    return resultBlob;
  }

  _seekVideoToTime(time) {
    return new Promise((resolve) => {
      const onSeeked = () => {
        this.video.removeEventListener('seeked', onSeeked);
        resolve();
      };
      this.video.addEventListener('seeked', onSeeked);
      this.video.currentTime = time;
    });
  }
}
