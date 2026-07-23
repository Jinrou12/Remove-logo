/**
 * LogoRemovie Studio - Main Application Controller
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const btnUploadTrigger = document.getElementById('btnUploadTrigger');
  const btnDemoImage = document.getElementById('btnDemoImage');
  const btnDemoVideo = document.getElementById('btnDemoVideo');
  
  const editorWorkspace = document.getElementById('editorWorkspace');
  const btnResetMedia = document.getElementById('btnResetMedia');
  const mediaTypeBadge = document.getElementById('mediaTypeBadge');
  const mediaName = document.getElementById('mediaName');
  const mediaDimensions = document.getElementById('mediaDimensions');

  // Canvas elements
  const mediaCanvas = document.getElementById('mediaCanvas');
  const mediaCtx = mediaCanvas.getContext('2d', { willReadFrequently: true });
  
  const maskCanvas = document.getElementById('maskCanvas');
  const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true });

  const cursorCanvas = document.getElementById('cursorCanvas');
  const cursorCtx = cursorCanvas.getContext('2d');

  const resultCanvas = document.getElementById('resultCanvas');
  const resultCtx = resultCanvas.getContext('2d', { willReadFrequently: true });

  // Compare Split View
  const btnToggleCompare = document.getElementById('btnToggleCompare');
  const compareContainer = document.getElementById('compareContainer');
  const compareDivider = document.getElementById('compareDivider');

  // Tools
  const toolBox = document.getElementById('toolBox');
  const toolBrush = document.getElementById('toolBrush');
  const toolAutoDetect = document.getElementById('toolAutoDetect');
  const brushControls = document.getElementById('brushControls');
  const brushSizeInput = document.getElementById('brushSize');
  const brushSizeVal = document.getElementById('brushSizeVal');
  const btnUndoMask = document.getElementById('btnUndoMask');
  const btnClearMask = document.getElementById('btnClearMask');

  // Video Controls
  const videoBar = document.getElementById('videoBar');
  const sourceVideo = document.getElementById('sourceVideo');
  const btnPlayPause = document.getElementById('btnPlayPause');
  const iconPlay = document.getElementById('iconPlay');
  const iconPause = document.getElementById('iconPause');
  const videoTime = document.getElementById('videoTime');
  const videoScrubber = document.getElementById('videoScrubber');
  const btnMuteVideo = document.getElementById('btnMuteVideo');
  const videoOptionsPanel = document.getElementById('videoOptionsPanel');

  // Algorithm Settings
  const algoRadios = document.querySelectorAll('input[name="algo"]');
  const inpaintRadiusInput = document.getElementById('inpaintRadius');
  const inpaintRadiusVal = document.getElementById('inpaintRadiusVal');
  const blurRadiusInput = document.getElementById('blurRadius');
  const blurRadiusVal = document.getElementById('blurRadiusVal');

  // Process & Download
  const btnProcessLogo = document.getElementById('btnProcessLogo');
  const btnDownload = document.getElementById('btnDownload');

  // Render Modal
  const renderModal = document.getElementById('renderModal');
  const renderStatusText = document.getElementById('renderStatusText');
  const renderProgressBar = document.getElementById('renderProgressBar');
  const renderProgressPercent = document.getElementById('renderProgressPercent');
  const renderFrameStats = document.getElementById('renderFrameStats');
  const renderMiniCanvas = document.getElementById('renderMiniCanvas');
  const renderMiniCtx = renderMiniCanvas.getContext('2d');
  const btnCancelRender = document.getElementById('btnCancelRender');

  // State Variables
  let currentFileType = null; // 'image' | 'video'
  let currentFile = null;
  let activeTool = 'box'; // 'box' | 'brush'
  let isDrawing = false;
  let startX = 0, startY = 0;
  let maskHistory = [];
  let currentProcessedBlob = null;
  let isComparing = false;
  let activeVideoProcessor = null;

  // Initialize UI & Event Listeners
  initEventListeners();

  function initEventListeners() {
    // File Upload Triggers
    btnUploadTrigger.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);
    
    // Drag & Drop
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.querySelector('.drop-card').classList.add('drag-over');
    });
    dropZone.addEventListener('dragleave', () => {
      dropZone.querySelector('.drop-card').classList.remove('drag-over');
    });
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.querySelector('.drop-card').classList.remove('drag-over');
      if (e.dataTransfer.files.length > 0) {
        processLoadedFile(e.dataTransfer.files[0]);
      }
    });

    // Preset Demos
    btnDemoImage.addEventListener('click', loadDemoImage);
    btnDemoVideo.addEventListener('click', loadDemoVideo);
    btnResetMedia.addEventListener('click', resetWorkspace);

    // Tools Switching
    toolBox.addEventListener('click', () => setTool('box'));
    toolBrush.addEventListener('click', () => setTool('brush'));
    toolAutoDetect.addEventListener('click', runAutoDetect);

    brushSizeInput.addEventListener('input', (e) => {
      brushSizeVal.textContent = `${e.target.value}px`;
    });

    btnUndoMask.addEventListener('click', undoMask);
    btnClearMask.addEventListener('click', clearMask);

    // Canvas Mouse / Touch Drawing
    maskCanvas.addEventListener('mousedown', startMaskDraw);
    maskCanvas.addEventListener('mousemove', drawMask);
    maskCanvas.addEventListener('mouseup', endMaskDraw);
    maskCanvas.addEventListener('mouseleave', () => {
      if (isDrawing && activeTool === 'box') endMaskDraw();
      isDrawing = false;
      cursorCtx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);
    });

    // Comparison Split View Slider
    btnToggleCompare.addEventListener('click', toggleCompareMode);
    setupCompareSlider();

    // Range Sliders Text update
    inpaintRadiusInput.addEventListener('input', (e) => {
      inpaintRadiusVal.textContent = `${e.target.value}px`;
    });
    blurRadiusInput.addEventListener('input', (e) => {
      blurRadiusVal.textContent = `${e.target.value}px`;
    });

    // Algo Radio Cards CSS state
    algoRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        document.querySelectorAll('.algo-card').forEach(card => card.classList.remove('active'));
        e.target.closest('.algo-card').classList.add('active');
      });
    });

    // Video Player Events
    btnPlayPause.addEventListener('click', toggleVideoPlay);
    sourceVideo.addEventListener('timeupdate', updateVideoProgress);
    videoScrubber.addEventListener('input', (e) => {
      const targetTime = (e.target.value / 100) * sourceVideo.duration;
      sourceVideo.currentTime = targetTime;
    });
    btnMuteVideo.addEventListener('click', () => {
      sourceVideo.muted = !sourceVideo.muted;
      btnMuteVideo.style.opacity = sourceVideo.muted ? '0.5' : '1';
    });

    // Processing & Export
    btnProcessLogo.addEventListener('click', processLogoRemoval);
    btnDownload.addEventListener('click', downloadProcessedFile);
    btnCancelRender.addEventListener('click', cancelVideoProcessing);
  }

  function setTool(tool) {
    activeTool = tool;
    toolBox.classList.toggle('active', tool === 'box');
    toolBrush.classList.toggle('active', tool === 'brush');
    brushControls.style.display = tool === 'brush' ? 'flex' : 'none';
  }

  function handleFileSelect(e) {
    if (e.target.files.length > 0) {
      processLoadedFile(e.target.files[0]);
    }
  }

  function processLoadedFile(file) {
    currentFile = file;
    const type = file.type.startsWith('video') ? 'video' : 'image';
    currentFileType = type;

    mediaName.textContent = file.name;
    mediaTypeBadge.textContent = type.toUpperCase();
    
    dropZone.classList.add('hidden');
    editorWorkspace.classList.remove('hidden');

    if (type === 'image') {
      videoBar.classList.add('hidden');
      videoOptionsPanel.classList.add('hidden');
      loadImageFile(file);
    } else {
      videoBar.classList.remove('hidden');
      videoOptionsPanel.classList.remove('hidden');
      loadVideoFile(file);
    }
  }

  function loadImageFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        setupCanvasDimensions(img.width, img.height);
        mediaCtx.drawImage(img, 0, 0);
        clearMask();
        saveMaskHistory();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function loadVideoFile(file) {
    const url = URL.createObjectURL(file);
    sourceVideo.src = url;
    sourceVideo.onloadedmetadata = () => {
      setupCanvasDimensions(sourceVideo.videoWidth, sourceVideo.videoHeight);
      sourceVideo.currentTime = 0;
      sourceVideo.play().then(() => {
        sourceVideo.pause();
        drawCurrentVideoFrame();
      });
      clearMask();
      saveMaskHistory();
    };
  }

  function drawCurrentVideoFrame() {
    mediaCtx.drawImage(sourceVideo, 0, 0, mediaCanvas.width, mediaCanvas.height);
  }

  function setupCanvasDimensions(w, h) {
    mediaCanvas.width = w;
    mediaCanvas.height = h;

    maskCanvas.width = w;
    maskCanvas.height = h;

    cursorCanvas.width = w;
    cursorCanvas.height = h;

    resultCanvas.width = w;
    resultCanvas.height = h;

    mediaDimensions.textContent = `${w}x${h}`;
  }

  // Preset Demos
  function loadDemoImage() {
    // Generate high quality canvas demo photo with watermark
    const w = 1280, h = 720;
    setupCanvasDimensions(w, h);
    
    // Draw pretty background landscape gradient
    const grad = mediaCtx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#1e1b4b');
    grad.addColorStop(0.5, '#312e81');
    grad.addColorStop(1, '#4338ca');
    mediaCtx.fillStyle = grad;
    mediaCtx.fillRect(0, 0, w, h);

    // Decorative shapes
    mediaCtx.fillStyle = 'rgba(236, 72, 153, 0.3)';
    mediaCtx.beginPath();
    mediaCtx.arc(w * 0.3, h * 0.4, 200, 0, Math.PI * 2);
    mediaCtx.fill();

    mediaCtx.fillStyle = 'rgba(56, 189, 248, 0.3)';
    mediaCtx.beginPath();
    mediaCtx.arc(w * 0.7, h * 0.6, 260, 0, Math.PI * 2);
    mediaCtx.fill();

    // Render Watermark Logo in Corner
    mediaCtx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    mediaCtx.font = 'bold 36px Inter';
    mediaCtx.fillText('SAMPLE WATERMARK © 2026', w - 520, h - 60);

    mediaCtx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    mediaCtx.lineWidth = 4;
    mediaCtx.strokeRect(w - 540, h - 110, 500, 80);

    currentFileType = 'image';
    mediaName.textContent = 'demo_landscape_watermark.png';
    mediaTypeBadge.textContent = 'DEMO IMAGE';
    
    dropZone.classList.add('hidden');
    editorWorkspace.classList.remove('hidden');
    videoBar.classList.add('hidden');
    videoOptionsPanel.classList.add('hidden');

    clearMask();
    saveMaskHistory();
  }

  function loadDemoVideo() {
    // Generate animated demo video canvas and convert to Blob
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 640;
    tempCanvas.height = 360;
    const tempCtx = tempCanvas.getContext('2d');

    const stream = tempCanvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const chunks = [];

    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      processLoadedFile(new File([blob], 'demo_video_watermark.webm', { type: 'video/webm' }));
    };

    recorder.start();

    let frame = 0;
    const totalDemoFrames = 90; // 3 seconds video

    function renderDemoFrame() {
      if (frame >= totalDemoFrames) {
        recorder.stop();
        return;
      }

      // Background motion
      const g = tempCtx.createLinearGradient(0, 0, 640, 360);
      g.addColorStop(0, '#0f172a');
      g.addColorStop(1, '#1e293b');
      tempCtx.fillStyle = g;
      tempCtx.fillRect(0, 0, 640, 360);

      // Bouncing circle
      const cx = 100 + (frame * 5) % 440;
      const cy = 180 + Math.sin(frame * 0.1) * 60;
      tempCtx.fillStyle = '#38bdf8';
      tempCtx.beginPath();
      tempCtx.arc(cx, cy, 40, 0, Math.PI * 2);
      tempCtx.fill();

      // Watermark Overlay on video
      tempCtx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      tempCtx.font = 'bold 22px Inter';
      tempCtx.fillText('DEMO VIDEO LOGO', 420, 320);
      tempCtx.strokeStyle = '#ef4444';
      tempCtx.lineWidth = 3;
      tempCtx.strokeRect(405, 295, 220, 45);

      frame++;
      setTimeout(renderDemoFrame, 1000 / 30);
    }

    renderDemoFrame();
  }

  // Mask Drawing Logic
  function getCanvasCoords(e) {
    const rect = maskCanvas.getBoundingClientRect();
    const scaleX = maskCanvas.width / rect.width;
    const scaleY = maskCanvas.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  function startMaskDraw(e) {
    isDrawing = true;
    const coords = getCanvasCoords(e);
    startX = coords.x;
    startY = coords.y;

    if (activeTool === 'brush') {
      maskCtx.fillStyle = 'rgba(239, 68, 68, 0.6)';
      maskCtx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
      maskCtx.lineWidth = brushSizeInput.value;
      maskCtx.lineCap = 'round';
      maskCtx.lineJoin = 'round';

      maskCtx.beginPath();
      maskCtx.arc(startX, startY, brushSizeInput.value / 2, 0, Math.PI * 2);
      maskCtx.fill();
    }
  }

  function drawMask(e) {
    const coords = getCanvasCoords(e);

    // Cursor preview for brush
    cursorCtx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);
    if (activeTool === 'brush') {
      cursorCtx.strokeStyle = '#ef4444';
      cursorCtx.lineWidth = 2;
      cursorCtx.beginPath();
      cursorCtx.arc(coords.x, coords.y, brushSizeInput.value / 2, 0, Math.PI * 2);
      cursorCtx.stroke();
    }

    if (!isDrawing) return;

    if (activeTool === 'brush') {
      maskCtx.beginPath();
      maskCtx.moveTo(startX, startY);
      maskCtx.lineTo(coords.x, coords.y);
      maskCtx.stroke();
      startX = coords.x;
      startY = coords.y;
    } else if (activeTool === 'box') {
      // Clear temp and redraw current box
      restoreLastMaskState();
      const width = coords.x - startX;
      const height = coords.y - startY;

      maskCtx.fillStyle = 'rgba(239, 68, 68, 0.5)';
      maskCtx.strokeStyle = '#ef4444';
      maskCtx.lineWidth = 3;

      maskCtx.fillRect(startX, startY, width, height);
      maskCtx.strokeRect(startX, startY, width, height);
    }
  }

  function endMaskDraw() {
    if (isDrawing) {
      isDrawing = false;
      saveMaskHistory();
    }
  }

  function saveMaskHistory() {
    const copy = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    maskHistory.push(copy);
    if (maskHistory.length > 20) maskHistory.shift(); // Max 20 undo steps
  }

  function restoreLastMaskState() {
    if (maskHistory.length > 0) {
      const lastState = maskHistory[maskHistory.length - 1];
      maskCtx.putImageData(lastState, 0, 0);
    } else {
      maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    }
  }

  function undoMask() {
    if (maskHistory.length > 1) {
      maskHistory.pop(); // Remove current
      const prevState = maskHistory[maskHistory.length - 1];
      maskCtx.putImageData(prevState, 0, 0);
    } else if (maskHistory.length === 1) {
      clearMask();
    }
  }

  function clearMask() {
    maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    maskHistory = [];
    saveMaskHistory();
  }

  function runAutoDetect() {
    const imgData = mediaCtx.getImageData(0, 0, mediaCanvas.width, mediaCanvas.height);
    const bounds = InpaintEngine.autoDetectLogoBounds(imgData);

    maskCtx.fillStyle = 'rgba(239, 68, 68, 0.5)';
    maskCtx.strokeStyle = '#ef4444';
    maskCtx.lineWidth = 3;

    maskCtx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    maskCtx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);

    saveMaskHistory();
  }

  // Video Controls
  function toggleVideoPlay() {
    if (sourceVideo.paused) {
      sourceVideo.play();
      iconPlay.classList.add('hidden');
      iconPause.classList.remove('hidden');
      renderVideoSyncLoop();
    } else {
      sourceVideo.pause();
      iconPlay.classList.remove('hidden');
      iconPause.classList.add('hidden');
    }
  }

  function renderVideoSyncLoop() {
    if (!sourceVideo.paused && !sourceVideo.ended) {
      drawCurrentVideoFrame();
      requestAnimationFrame(renderVideoSyncLoop);
    }
  }

  function updateVideoProgress() {
    const cur = sourceVideo.currentTime || 0;
    const dur = sourceVideo.duration || 1;
    videoScrubber.value = (cur / dur) * 100;

    const formatTime = (sec) => {
      const m = Math.floor(sec / 60).toString().padStart(2, '0');
      const s = Math.floor(sec % 60).toString().padStart(2, '0');
      return `${m}:${s}`;
    };

    videoTime.textContent = `${formatTime(cur)} / ${formatTime(dur)}`;
  }

  // Comparison Split Slider
  function toggleCompareMode() {
    isComparing = !isComparing;
    compareContainer.classList.toggle('hidden', !isComparing);
    btnToggleCompare.classList.toggle('btn-primary', isComparing);
  }

  function setupCompareSlider() {
    let isDraggingDivider = false;

    compareDivider.addEventListener('mousedown', () => isDraggingDivider = true);
    window.addEventListener('mouseup', () => isDraggingDivider = false);
    window.addEventListener('mousemove', (e) => {
      if (!isDraggingDivider) return;
      const rect = compareContainer.getBoundingClientRect();
      let x = e.clientX - rect.left;
      x = Math.max(0, Math.min(x, rect.width));
      
      const percent = (x / rect.width) * 100;
      compareDivider.style.left = `${percent}%`;
      resultCanvas.style.clipPath = `polygon(0 0, ${percent}% 0, ${percent}% 100%, 0 100%)`;
    });
  }

  // Logo Removal Execution
  async function processLogoRemoval() {
    const selectedAlgo = document.querySelector('input[name="algo"]:checked').value;
    const inpaintRadius = parseInt(inpaintRadiusInput.value, 10);
    const blurRadius = parseInt(blurRadiusInput.value, 10);

    const maskData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    let hasMask = false;
    for (let i = 3; i < maskData.data.length; i += 4) {
      if (maskData.data[i] > 10) {
        hasMask = true;
        break;
      }
    }

    if (!hasMask) {
      alert('Please select or paint over the logo area first!');
      return;
    }

    if (currentFileType === 'image') {
      // Process Image in real time
      const imgData = mediaCtx.getImageData(0, 0, mediaCanvas.width, mediaCanvas.height);

      if (selectedAlgo === 'inpaint') {
        InpaintEngine.teleaInpaint(imgData, maskData, inpaintRadius);
      } else if (selectedAlgo === 'blur') {
        InpaintEngine.blurDelogo(imgData, maskData, blurRadius);
      } else if (selectedAlgo === 'mosaic') {
        InpaintEngine.mosaicPixelate(imgData, maskData, 16);
      } else if (selectedAlgo === 'color') {
        InpaintEngine.colorFill(imgData, maskData);
      }

      resultCtx.putImageData(imgData, 0, 0);

      // Convert result canvas to blob for download
      resultCanvas.toBlob((blob) => {
        currentProcessedBlob = blob;
        btnDownload.disabled = false;
        if (!isComparing) toggleCompareMode();
      }, 'image/png');

    } else if (currentFileType === 'video') {
      // Process Video frame by frame with modal progress
      renderModal.classList.remove('hidden');
      renderProgressBar.style.width = '0%';
      renderProgressPercent.textContent = '0%';

      const fps = parseInt(document.getElementById('videoFps').value, 10);
      const qualityScale = parseFloat(document.getElementById('videoQuality').value);

      activeVideoProcessor = new VideoProcessor(sourceVideo, maskCanvas, {
        fps,
        qualityScale,
        algo: selectedAlgo,
        inpaintRadius,
        blurRadius,
        onProgress: ({ currentFrame, totalFrames, percent, canvas }) => {
          renderProgressBar.style.width = `${percent}%`;
          renderProgressPercent.textContent = `${percent}%`;
          renderFrameStats.textContent = `Frame ${currentFrame} / ${totalFrames}`;

          // Draw mini preview
          renderMiniCanvas.width = canvas.width;
          renderMiniCanvas.height = canvas.height;
          renderMiniCtx.drawImage(canvas, 0, 0);
        },
        onComplete: (blob) => {
          currentProcessedBlob = blob;
          btnDownload.disabled = false;
          renderModal.classList.add('hidden');
          
          // Render cleaned frame into result canvas for split comparison
          resultCtx.drawImage(renderMiniCanvas, 0, 0, resultCanvas.width, resultCanvas.height);
          if (!isComparing) toggleCompareMode();
        },
        onError: (err) => {
          alert(`Video processing error: ${err.message}`);
          renderModal.classList.add('hidden');
        }
      });

      try {
        await activeVideoProcessor.processAndEncode();
      } catch (err) {
        console.warn(err);
      }
    }
  }

  function cancelVideoProcessing() {
    if (activeVideoProcessor) {
      activeVideoProcessor.cancel();
      activeVideoProcessor = null;
    }
    renderModal.classList.add('hidden');
  }

  function downloadProcessedFile() {
    if (!currentProcessedBlob) return;

    const url = URL.createObjectURL(currentProcessedBlob);
    const a = document.createElement('a');
    a.href = url;
    
    const ext = currentFileType === 'video' ? 'webm' : 'png';
    const nameWithoutExt = currentFile ? currentFile.name.replace(/\.[^/.]+$/, "") : 'cleaned_media';
    a.download = `${nameWithoutExt}_nologo.${ext}`;
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function resetWorkspace() {
    dropZone.classList.remove('hidden');
    editorWorkspace.classList.add('hidden');
    fileInput.value = '';
    currentFile = null;
    currentFileType = null;
    currentProcessedBlob = null;
    btnDownload.disabled = true;
    if (isComparing) toggleCompareMode();
  }
});
