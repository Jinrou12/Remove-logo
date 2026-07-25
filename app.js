/**
 * LogoRemovie Studio - Main Application Controller (Multi-File & Batch Operations)
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
  const btnClearAllMasks = document.getElementById('btnClearAllMasks');

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
  const renderBatchStatus = document.getElementById('renderBatchStatus');
  const renderStatusText = document.getElementById('renderStatusText');
  const renderProgressBar = document.getElementById('renderProgressBar');
  const renderProgressPercent = document.getElementById('renderProgressPercent');
  const renderFrameStats = document.getElementById('renderFrameStats');
  const renderMiniCanvas = document.getElementById('renderMiniCanvas');
  const renderMiniCtx = renderMiniCanvas.getContext('2d');
  const btnCancelRender = document.getElementById('btnCancelRender');

  // Batch Media Queue Elements
  const btnAddMoreFiles = document.getElementById('btnAddMoreFiles');
  const chkSelectAll = document.getElementById('chkSelectAll');
  const btnBulkDelete = document.getElementById('btnBulkDelete');
  const btnBulkDownload = document.getElementById('btnBulkDownload');
  const selectedDeleteCount = document.getElementById('selectedDeleteCount');
  const selectedDownloadCount = document.getElementById('selectedDownloadCount');
  const queueCountBadge = document.getElementById('queueCountBadge');
  const queueItemsContainer = document.getElementById('queueItemsContainer');

  // App State Variables
  let mediaQueue = []; // items: { id, file, type, name, objectUrl, thumbnailUrl, dimensions, maskHistory, maskData, processedBlob, selected, status }
  let activeMediaId = null;

  let currentFileType = null; // 'image' | 'video'
  let currentFile = null;
  let activeTool = 'box'; // 'box' | 'brush'
  let isDrawing = false;
  let startX = 0, startY = 0;
  let maskHistory = [];
  let currentProcessedBlob = null;
  let isComparing = false;
  let activeVideoProcessor = null;
  let isBatchCancelled = false;

  // Initialize Application
  initEventListeners();

  function initEventListeners() {
    // File Upload Triggers (Multi-file enabled)
    btnUploadTrigger.addEventListener('click', () => fileInput.click());
    btnAddMoreFiles.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);
    
    // Drag & Drop (Supports Multiple Files)
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
        addFilesToQueue(Array.from(e.dataTransfer.files));
      }
    });

    // Bulk Actions
    chkSelectAll.addEventListener('change', (e) => toggleSelectAll(e.target.checked));
    btnBulkDelete.addEventListener('click', deleteSelectedItems);
    btnBulkDownload.addEventListener('click', downloadSelectedItems);

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
    btnClearAllMasks.addEventListener('click', clearAllMasks);

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
      addFilesToQueue(Array.from(e.target.files));
      fileInput.value = ''; // Reset input to allow re-uploading same filenames if desired
    }
  }

  // Multi-File Queue Management
  async function addFilesToQueue(files) {
    const validFiles = files.filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
    if (validFiles.length === 0) return;

    for (const file of validFiles) {
      const type = file.type.startsWith('video') ? 'video' : 'image';
      const id = 'media_' + Date.now() + '_' + Math.random().toString(36).substr(2, 7);
      const objectUrl = URL.createObjectURL(file);

      let thumbnailUrl = objectUrl;
      if (type === 'video') {
        thumbnailUrl = await createVideoThumbnail(objectUrl);
      }

      const newItem = {
        id,
        file,
        type,
        name: file.name,
        objectUrl,
        thumbnailUrl,
        dimensions: { width: 1920, height: 1080 },
        maskHistory: [],
        maskData: null,
        processedBlob: null,
        selected: false,
        status: 'ready'
      };

      mediaQueue.push(newItem);
    }

    dropZone.classList.add('hidden');
    editorWorkspace.classList.remove('hidden');

    if (!activeMediaId && mediaQueue.length > 0) {
      setActiveMedia(mediaQueue[mediaQueue.length - validFiles.length].id);
    } else {
      renderQueueUI();
    }
  }

  function createVideoThumbnail(videoUrl) {
    return new Promise((resolve) => {
      const tempVid = document.createElement('video');
      tempVid.src = videoUrl;
      tempVid.crossOrigin = 'anonymous';
      tempVid.muted = true;
      tempVid.currentTime = 0.5;
      tempVid.onseeked = () => {
        const c = document.createElement('canvas');
        c.width = 160;
        c.height = 90;
        const ctx = c.getContext('2d');
        ctx.drawImage(tempVid, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.7));
      };
      tempVid.onerror = () => resolve(videoUrl);
    });
  }

  function saveCurrentActiveState() {
    if (!activeMediaId) return;
    const currentItem = mediaQueue.find(item => item.id === activeMediaId);
    if (!currentItem) return;

    // Save mask canvas state & history
    currentItem.maskHistory = [...maskHistory];
    currentItem.maskData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    currentItem.processedBlob = currentProcessedBlob;

    let hasMask = false;
    if (currentItem.maskData) {
      for (let i = 3; i < currentItem.maskData.data.length; i += 4) {
        if (currentItem.maskData.data[i] > 10) {
          hasMask = true;
          break;
        }
      }
    }

    if (currentItem.processedBlob) {
      currentItem.status = 'processed';
    } else if (hasMask) {
      currentItem.status = 'masked';
    } else {
      currentItem.status = 'ready';
    }
  }

  function setActiveMedia(id) {
    saveCurrentActiveState();

    const targetItem = mediaQueue.find(item => item.id === id);
    if (!targetItem) return;

    activeMediaId = id;
    currentFile = targetItem.file;
    currentFileType = targetItem.type;
    currentProcessedBlob = targetItem.processedBlob;

    mediaName.textContent = targetItem.name;
    mediaTypeBadge.textContent = targetItem.type.toUpperCase();
    btnDownload.disabled = !currentProcessedBlob;

    if (targetItem.type === 'image') {
      videoBar.classList.add('hidden');
      videoOptionsPanel.classList.add('hidden');
      loadImageFromUrl(targetItem.objectUrl, targetItem);
    } else {
      videoBar.classList.remove('hidden');
      videoOptionsPanel.classList.remove('hidden');
      loadVideoFromUrl(targetItem.objectUrl, targetItem);
    }

    renderQueueUI();
  }

  function loadImageFromUrl(url, item) {
    const img = new Image();
    img.onload = () => {
      setupCanvasDimensions(img.width, img.height);
      item.dimensions = { width: img.width, height: img.height };
      mediaCtx.drawImage(img, 0, 0);

      // Restore mask canvas
      if (item.maskData && item.maskData.width === img.width && item.maskData.height === img.height) {
        maskCtx.putImageData(item.maskData, 0, 0);
        maskHistory = [...item.maskHistory];
      } else {
        clearMask();
      }

      // Restore processed canvas if available
      if (item.processedBlob) {
        const procImg = new Image();
        procImg.onload = () => {
          resultCtx.drawImage(procImg, 0, 0);
          if (isComparing) compareContainer.classList.remove('hidden');
        };
        procImg.src = URL.createObjectURL(item.processedBlob);
      } else {
        resultCtx.clearRect(0, 0, resultCanvas.width, resultCanvas.height);
        if (isComparing) toggleCompareMode();
      }
    };
    img.src = url;
  }

  function loadVideoFromUrl(url, item) {
    sourceVideo.src = url;
    sourceVideo.onloadedmetadata = () => {
      const w = sourceVideo.videoWidth;
      const h = sourceVideo.videoHeight;
      setupCanvasDimensions(w, h);
      item.dimensions = { width: w, height: h };
      sourceVideo.currentTime = 0;
      drawCurrentVideoFrame();

      // Auto-detect or estimate source video FPS (standard 24, 25, 30, 60)
      detectAndSetVideoFps(sourceVideo);

      // Restore mask
      if (item.maskData && item.maskData.width === w && item.maskData.height === h) {
        maskCtx.putImageData(item.maskData, 0, 0);
        maskHistory = [...item.maskHistory];
      } else {
        clearMask();
      }

      if (!item.processedBlob) {
        resultCtx.clearRect(0, 0, resultCanvas.width, resultCanvas.height);
        if (isComparing) toggleCompareMode();
      }
    };
  }

  function detectAndSetVideoFps(video) {
    const videoFpsInput = document.getElementById('videoFps');
    if (!videoFpsInput) return;
    
    // Heuristic for standard web video framerates
    let fps = 30;
    if (video.duration) {
      // Default to 30 FPS for standard smoothness unless explicitly set
      fps = 30;
    }
    videoFpsInput.value = fps;
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

  // Queue UI Rendering & Selection
  function renderQueueUI() {
    queueCountBadge.textContent = `${mediaQueue.length} ${mediaQueue.length === 1 ? 'item' : 'items'}`;

    const selectedItems = mediaQueue.filter(item => item.selected);
    const selectedCount = selectedItems.length;

    chkSelectAll.checked = mediaQueue.length > 0 && selectedCount === mediaQueue.length;
    chkSelectAll.indeterminate = selectedCount > 0 && selectedCount < mediaQueue.length;

    selectedDeleteCount.textContent = selectedCount;
    selectedDownloadCount.textContent = selectedCount;

    btnBulkDelete.disabled = selectedCount === 0;
    btnBulkDownload.disabled = selectedCount === 0;

    queueItemsContainer.innerHTML = '';

    mediaQueue.forEach(item => {
      const card = document.createElement('div');
      card.className = `queue-card ${item.id === activeMediaId ? 'active' : ''} ${item.selected ? 'selected' : ''}`;

      const statusClass = `status-${item.status}`;
      const statusText = item.status.toUpperCase();

      card.innerHTML = `
        <img src="${item.thumbnailUrl}" class="queue-card-thumb" alt="${item.name}">
        <div class="queue-card-overlay">
          <input type="checkbox" class="queue-checkbox queue-card-check" ${item.selected ? 'checked' : ''} data-id="${item.id}">
          <button class="queue-card-delete" data-id="${item.id}" title="Remove file">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div class="queue-card-info">
          <span class="queue-card-name" title="${item.name}">${item.name}</span>
          <div class="queue-card-meta">
            <span class="queue-card-tag">${item.type.toUpperCase()}</span>
            <span class="queue-card-status ${statusClass}">${statusText}</span>
          </div>
        </div>
      `;

      card.addEventListener('click', (e) => {
        if (e.target.classList.contains('queue-card-check') || e.target.closest('.queue-card-delete')) {
          return;
        }
        if (activeMediaId !== item.id) {
          setActiveMedia(item.id);
        }
      });

      const chk = card.querySelector('.queue-card-check');
      chk.addEventListener('change', (e) => {
        item.selected = e.target.checked;
        renderQueueUI();
      });

      const delBtn = card.querySelector('.queue-card-delete');
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteSingleItem(item.id);
      });

      queueItemsContainer.appendChild(card);
    });
  }

  function toggleSelectAll(checked) {
    mediaQueue.forEach(item => item.selected = checked);
    renderQueueUI();
  }

  function deleteSingleItem(id) {
    const index = mediaQueue.findIndex(item => item.id === id);
    if (index === -1) return;

    const [deletedItem] = mediaQueue.splice(index, 1);
    if (deletedItem.objectUrl) URL.revokeObjectURL(deletedItem.objectUrl);

    if (activeMediaId === id) {
      if (mediaQueue.length > 0) {
        const nextIndex = Math.min(index, mediaQueue.length - 1);
        setActiveMedia(mediaQueue[nextIndex].id);
      } else {
        activeMediaId = null;
        resetWorkspace();
      }
    } else {
      renderQueueUI();
    }
  }

  function deleteSelectedItems() {
    const toDelete = mediaQueue.filter(item => item.selected);
    if (toDelete.length === 0) return;

    if (!confirm(`Delete ${toDelete.length} selected media item(s) from workspace?`)) {
      return;
    }

    toDelete.forEach(item => {
      if (item.objectUrl) URL.revokeObjectURL(item.objectUrl);
    });

    mediaQueue = mediaQueue.filter(item => !item.selected);

    if (mediaQueue.length === 0) {
      activeMediaId = null;
      resetWorkspace();
    } else {
      const currentStillExists = mediaQueue.some(item => item.id === activeMediaId);
      if (!currentStillExists) {
        setActiveMedia(mediaQueue[0].id);
      } else {
        renderQueueUI();
      }
    }
  }

  async function downloadSelectedItems() {
    const selectedItems = mediaQueue.filter(item => item.selected);
    if (selectedItems.length === 0) return;

    if (selectedItems.length === 1) {
      const item = selectedItems[0];
      const blob = item.processedBlob || item.file;
      const ext = item.type === 'video' ? 'webm' : (item.processedBlob ? 'png' : item.name.split('.').pop());
      const nameWithoutExt = item.name.replace(/\.[^/.]+$/, "");
      const fileName = `${nameWithoutExt}_cleaned.${ext}`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      if (typeof JSZip === 'undefined') {
        alert('ZIP packaging library is loading, please try again in a moment.');
        return;
      }

      const zip = new JSZip();
      const folder = zip.folder("LogoRemovie_Cleaned");

      selectedItems.forEach((item, idx) => {
        const blob = item.processedBlob || item.file;
        const ext = item.type === 'video' ? 'webm' : (item.processedBlob ? 'png' : item.name.split('.').pop());
        const nameWithoutExt = item.name.replace(/\.[^/.]+$/, "");
        const fileName = `${idx + 1}_${nameWithoutExt}_cleaned.${ext}`;
        folder.file(fileName, blob);
      });

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `LogoRemovie_Batch_Cleaned_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }

  // Preset Demos
  function loadDemoImage() {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 1280, 720);
    grad.addColorStop(0, '#1e1b4b');
    grad.addColorStop(0.5, '#312e81');
    grad.addColorStop(1, '#4338ca');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1280, 720);

    ctx.fillStyle = 'rgba(236, 72, 153, 0.3)';
    ctx.beginPath();
    ctx.arc(380, 280, 200, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(56, 189, 248, 0.3)';
    ctx.beginPath();
    ctx.arc(900, 430, 260, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.font = 'bold 36px Inter';
    ctx.fillText('SAMPLE WATERMARK © 2026', 760, 660);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 4;
    ctx.strokeRect(740, 610, 500, 80);

    canvas.toBlob((blob) => {
      const demoFile = new File([blob], 'demo_landscape_watermark.png', { type: 'image/png' });
      addFilesToQueue([demoFile]);
    }, 'image/png');
  }

  function loadDemoVideo() {
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
      const demoFile = new File([blob], 'demo_video_watermark.webm', { type: 'video/webm' });
      addFilesToQueue([demoFile]);
    };

    recorder.start();

    let frame = 0;
    const totalDemoFrames = 90;

    function renderDemoFrame() {
      if (frame >= totalDemoFrames) {
        recorder.stop();
        return;
      }

      const g = tempCtx.createLinearGradient(0, 0, 640, 360);
      g.addColorStop(0, '#0f172a');
      g.addColorStop(1, '#1e293b');
      tempCtx.fillStyle = g;
      tempCtx.fillRect(0, 0, 640, 360);

      const cx = 100 + (frame * 5) % 440;
      const cy = 180 + Math.sin(frame * 0.1) * 60;
      tempCtx.fillStyle = '#38bdf8';
      tempCtx.beginPath();
      tempCtx.arc(cx, cy, 40, 0, Math.PI * 2);
      tempCtx.fill();

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

  // Mask Drawing Controls
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
      saveCurrentActiveState();
      renderQueueUI();
    }
  }

  function saveMaskHistory() {
    const copy = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    maskHistory.push(copy);
    if (maskHistory.length > 20) maskHistory.shift();
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
      maskHistory.pop();
      const prevState = maskHistory[maskHistory.length - 1];
      maskCtx.putImageData(prevState, 0, 0);
    } else if (maskHistory.length === 1) {
      clearMask();
    }
    saveCurrentActiveState();
    renderQueueUI();
  }

  function clearMask() {
    maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    maskHistory = [];
    saveMaskHistory();
    saveCurrentActiveState();
    renderQueueUI();
  }

  function clearAllMasks() {
    if (mediaQueue.length === 0) return;
    const count = mediaQueue.filter(item => item.maskData || (item.maskHistory && item.maskHistory.length > 0)).length;
    if (count === 0) return;
    if (!confirm(`Clear masks from all ${mediaQueue.length} queued file(s)? This will also discard any processed results.`)) return;

    // Wipe stored mask & results for every queued item
    mediaQueue.forEach(item => {
      item.maskHistory = [];
      item.maskData = null;
      item.processedBlob = null;
      item.status = 'ready';
    });

    // Reset active canvas
    maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    maskHistory = [];
    saveMaskHistory();
    resultCtx.clearRect(0, 0, resultCanvas.width, resultCanvas.height);
    currentProcessedBlob = null;
    btnDownload.disabled = true;
    if (isComparing) toggleCompareMode();

    renderQueueUI();
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
    saveCurrentActiveState();
    renderQueueUI();
  }

  // Video Controller Sync
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

  // Comparison View
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

  // Logo Removal Algorithm Processing — batch-aware
  async function processLogoRemoval() {
    const selectedAlgo = document.querySelector('input[name="algo"]:checked').value;
    const inpaintRadius = parseInt(inpaintRadiusInput.value, 10);
    const blurRadius = parseInt(blurRadiusInput.value, 10);
    const fps = Math.max(1, Math.min(60, parseInt(document.getElementById('videoFps').value, 10) || 12));
    const qualityScale = parseFloat(document.getElementById('videoQuality').value) || 1;

    // Flush the currently-displayed mask into the active queue item before we scan
    saveCurrentActiveState();

    // Collect every queue item that has a non-empty mask
    const itemsToProcess = mediaQueue.filter(item => {
      if (!item.maskData) return false;
      const d = item.maskData.data;
      for (let i = 3; i < d.length; i += 4) {
        if (d[i] > 10) return true;
      }
      return false;
    });

    if (itemsToProcess.length === 0) {
      alert('Please select or paint over the logo area on at least one file first!');
      return;
    }

    isBatchCancelled = false;
    renderModal.classList.remove('hidden');
    renderProgressBar.style.width = '0%';
    renderProgressPercent.textContent = '0%';
    renderFrameStats.textContent = '';

    const total = itemsToProcess.length;

    for (let i = 0; i < total; i++) {
      if (isBatchCancelled) break;

      const item = itemsToProcess[i];
      renderBatchStatus.textContent = total > 1
        ? `File ${i + 1} of ${total}: ${item.name}`
        : '';
      renderProgressBar.style.width = '0%';
      renderProgressPercent.textContent = '0%';

      try {
        if (item.type === 'image') {
          await processImageItemBatch(item, selectedAlgo, inpaintRadius, blurRadius);
        } else {
          await processVideoItemBatch(item, selectedAlgo, fps, qualityScale, inpaintRadius, blurRadius);
        }
      } catch (err) {
        if (!isBatchCancelled) console.warn(`Error processing ${item.name}:`, err);
      }

      renderQueueUI();
    }

    renderModal.classList.add('hidden');
    renderBatchStatus.textContent = '';

    // Refresh the active item's display in the result canvas
    const activeItem = mediaQueue.find(it => it.id === activeMediaId);
    if (activeItem && activeItem.processedBlob) {
      currentProcessedBlob = activeItem.processedBlob;
      btnDownload.disabled = false;

      if (activeItem.type === 'image') {
        const img = new Image();
        img.onload = () => {
          resultCtx.drawImage(img, 0, 0, resultCanvas.width, resultCanvas.height);
          if (!isComparing) toggleCompareMode();
        };
        img.src = URL.createObjectURL(activeItem.processedBlob);
      } else {
        resultCtx.drawImage(renderMiniCanvas, 0, 0, resultCanvas.width, resultCanvas.height);
        if (!isComparing) toggleCompareMode();
      }
    }
  }

  // Off-screen image processing (no canvas UI needed)
  function processImageItemBatch(item, algo, inpaintRadius, blurRadius) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const offCanvas = document.createElement('canvas');
        offCanvas.width = img.width;
        offCanvas.height = img.height;
        const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });
        offCtx.drawImage(img, 0, 0);
        const imgData = offCtx.getImageData(0, 0, img.width, img.height);
        const maskData = item.maskData;

        if (algo === 'inpaint') InpaintEngine.teleaInpaint(imgData, maskData, inpaintRadius);
        else if (algo === 'blur') InpaintEngine.blurDelogo(imgData, maskData, blurRadius);
        else if (algo === 'mosaic') InpaintEngine.mosaicPixelate(imgData, maskData, 16);
        else if (algo === 'color') InpaintEngine.colorFill(imgData, maskData);

        offCtx.putImageData(imgData, 0, 0);
        offCanvas.toBlob(blob => {
          if (blob) {
            item.processedBlob = blob;
            item.status = 'processed';
          }
          resolve(blob);
        }, 'image/png');
      };
      img.onerror = reject;
      img.src = item.objectUrl;
    });
  }

  // Off-screen video processing using a temporary <video> element
  function processVideoItemBatch(item, algo, fps, qualityScale, inpaintRadius, blurRadius) {
    return new Promise((resolve, reject) => {
      const tempVid = document.createElement('video');
      tempVid.crossOrigin = 'anonymous';
      tempVid.muted = true;
      tempVid.src = item.objectUrl;

      tempVid.onloadedmetadata = () => {
        // Reconstruct a canvas from the stored maskData for this item
        const maskOffCanvas = document.createElement('canvas');
        maskOffCanvas.width = item.maskData.width;
        maskOffCanvas.height = item.maskData.height;
        maskOffCanvas.getContext('2d').putImageData(item.maskData, 0, 0);

        activeVideoProcessor = new VideoProcessor(tempVid, maskOffCanvas, {
          fps,
          qualityScale,
          algo,
          inpaintRadius,
          blurRadius,
          onProgress: ({ currentFrame, totalFrames, percent, canvas }) => {
            renderProgressBar.style.width = `${percent}%`;
            renderProgressPercent.textContent = `${percent}%`;
            renderFrameStats.textContent = `Frame ${currentFrame} / ${totalFrames}`;
            renderMiniCanvas.width = canvas.width;
            renderMiniCanvas.height = canvas.height;
            renderMiniCtx.drawImage(canvas, 0, 0);
          },
          onComplete: blob => {
            item.processedBlob = blob;
            item.status = 'processed';
            resolve(blob);
          },
          onError: err => reject(err)
        });

        activeVideoProcessor.processAndEncode().catch(err => {
          if (!isBatchCancelled) reject(err);
          else resolve(null);
        });
      };

      tempVid.onerror = reject;
    });
  }

  function cancelVideoProcessing() {
    isBatchCancelled = true;
    if (activeVideoProcessor) {
      activeVideoProcessor.cancel();
      activeVideoProcessor = null;
    }
    renderModal.classList.add('hidden');
    renderBatchStatus.textContent = '';
  }

  function downloadProcessedFile() {
    if (!currentProcessedBlob) return;

    const url = URL.createObjectURL(currentProcessedBlob);
    const a = document.createElement('a');
    a.href = url;
    
    let ext = 'png';
    if (currentFileType === 'video') {
      ext = (currentProcessedBlob && currentProcessedBlob.type && currentProcessedBlob.type.includes('mp4')) ? 'mp4' : 'webm';
    }
    const nameWithoutExt = currentFile ? currentFile.name.replace(/\.[^/.]+$/, "") : 'cleaned_media';
    a.download = `${nameWithoutExt}_cleaned.${ext}`;
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function resetWorkspace() {
    mediaQueue.forEach(item => {
      if (item.objectUrl) URL.revokeObjectURL(item.objectUrl);
    });
    mediaQueue = [];
    activeMediaId = null;

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
