/**
 * LogoRemovie Studio - Image & Frame Inpainting Engine
 * Implements:
 * 1. Telea Fast Marching Inpainting Algorithm (Optimized with Min-Heap & ROI)
 * 2. Gaussian Blur Delogo Filter
 * 3. Mosaic Pixelation
 * 4. Dominant Edge Color Fill
 * 5. Smart Automatic Watermark/Logo Detection Heuristic
 */

class MinHeap {
  constructor(compareFn) {
    this.heap = [];
    this.compare = compareFn || ((a, b) => a - b);
  }

  get size() {
    return this.heap.length;
  }

  push(val) {
    this.heap.push(val);
    this._bubbleUp(this.heap.length - 1);
  }

  pop() {
    if (this.heap.length === 0) return null;
    if (this.heap.length === 1) return this.heap.pop();
    const top = this.heap[0];
    this.heap[0] = this.heap.pop();
    this._sinkDown(0);
    return top;
  }

  _bubbleUp(idx) {
    while (idx > 0) {
      const parentIdx = (idx - 1) >> 1;
      if (this.compare(this.heap[idx], this.heap[parentIdx]) < 0) {
        const tmp = this.heap[idx];
        this.heap[idx] = this.heap[parentIdx];
        this.heap[parentIdx] = tmp;
        idx = parentIdx;
      } else {
        break;
      }
    }
  }

  _sinkDown(idx) {
    const length = this.heap.length;
    while (true) {
      let left = (idx << 1) + 1;
      let right = left + 1;
      let smallest = idx;

      if (left < length && this.compare(this.heap[left], this.heap[smallest]) < 0) {
        smallest = left;
      }
      if (right < length && this.compare(this.heap[right], this.heap[smallest]) < 0) {
        smallest = right;
      }

      if (smallest !== idx) {
        const tmp = this.heap[idx];
        this.heap[idx] = this.heap[smallest];
        this.heap[smallest] = tmp;
        idx = smallest;
      } else {
        break;
      }
    }
  }
}

class InpaintEngine {
  /**
   * Compute bounding box (ROI) around non-zero mask pixels to restrict computation
   */
  static getMaskBoundingBox(maskData, margin = 10) {
    const width = maskData.width;
    const height = maskData.height;
    const mask = maskData.data;

    let minX = width, maxX = -1, minY = height, maxY = -1;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        if (mask[idx + 3] > 10 || mask[idx] > 128) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX === -1) return null; // Empty mask

    return {
      minX: Math.max(0, minX - margin),
      maxX: Math.min(width - 1, maxX + margin),
      minY: Math.max(0, minY - margin),
      maxY: Math.min(height - 1, maxY + margin)
    };
  }

  /**
   * Fast Marching Method (Telea Algorithm) with Binary Min-Heap & Bounding Box ROI Optimization
   */
  static teleaInpaint(imgData, maskData, radius = 8) {
    const width = imgData.width;
    const height = imgData.height;
    const pixels = imgData.data;
    const mask = maskData.data;

    const roi = InpaintEngine.getMaskBoundingBox(maskData, radius + 2);
    if (!roi) return;

    const size = width * height;
    const INF = 1e6;

    // States: 0 = KNOWN (outside mask), 1 = BAND (boundary), 2 = INSIDE (to be inpainted)
    const state = new Uint8Array(size);
    const dist = new Float32Array(size);

    let hasMaskPixels = false;
    for (let y = roi.minY; y <= roi.maxY; y++) {
      for (let x = roi.minX; x <= roi.maxX; x++) {
        const i = y * width + x;
        const maskIdx = i * 4;
        if (mask[maskIdx + 3] > 10 || mask[maskIdx] > 128) {
          state[i] = 2; // INSIDE
          dist[i] = INF;
          hasMaskPixels = true;
        } else {
          state[i] = 0; // KNOWN
          dist[i] = 0;
        }
      }
    }

    if (!hasMaskPixels) return;

    // Min-Priority Queue for Fast Marching
    const heap = new MinHeap((a, b) => dist[a] - dist[b]);

    // Identify initial boundary (BAND) pixels
    for (let y = roi.minY; y <= roi.maxY; y++) {
      for (let x = roi.minX; x <= roi.maxX; x++) {
        const idx = y * width + x;
        if (state[idx] === 2) {
          let isBoundary = false;
          const neighbors = [
            x > 0 ? idx - 1 : -1,
            x < width - 1 ? idx + 1 : -1,
            y > 0 ? idx - width : -1,
            y < height - 1 ? idx + width : -1
          ];
          for (const n of neighbors) {
            if (n !== -1 && state[n] === 0) {
              isBoundary = true;
              break;
            }
          }
          if (isBoundary) {
            state[idx] = 1; // BAND
            dist[idx] = 0;
            heap.push(idx);
          }
        }
      }
    }

    // Fast Marching propagation loop
    while (heap.size > 0) {
      const current = heap.pop();
      if (state[current] === 0) continue; // Already processed
      state[current] = 0; // Mark as KNOWN

      const cx = current % width;
      const cy = Math.floor(current / width);

      InpaintEngine._computePixelColor(pixels, state, dist, cx, cy, width, height, radius);

      const neighbors = [
        cx > 0 ? current - 1 : -1,
        cx < width - 1 ? current + 1 : -1,
        cy > 0 ? current - width : -1,
        cy < height - 1 ? current + width : -1
      ];

      for (const n of neighbors) {
        if (n !== -1 && state[n] === 2) {
          state[n] = 1; // Mark as BAND
          dist[n] = InpaintEngine._solveEikonal(dist, state, n % width, Math.floor(n / width), width, height);
          heap.push(n);
        }
      }
    }
  }

  static _solveEikonal(dist, state, x, y, width, height) {
    const INF = 1e6;
    const idx = y * width + x;
    let s1 = INF, s2 = INF;

    if (x > 0 && state[idx - 1] === 0) s1 = Math.min(s1, dist[idx - 1]);
    if (x < width - 1 && state[idx + 1] === 0) s1 = Math.min(s1, dist[idx + 1]);

    if (y > 0 && state[idx - width] === 0) s2 = Math.min(s2, dist[idx - width]);
    if (y < height - 1 && state[idx + width] === 0) s2 = Math.min(s2, dist[idx + width]);

    if (s1 === INF && s2 === INF) return 1;
    if (s1 === INF) return s2 + 1;
    if (s2 === INF) return s1 + 1;

    if (Math.abs(s1 - s2) >= 1) {
      return Math.min(s1, s2) + 1;
    } else {
      return (s1 + s2 + Math.sqrt(2 - (s1 - s2) * (s1 - s2))) / 2;
    }
  }

  static _computePixelColor(pixels, state, dist, pX, pY, width, height, radius) {
    const pIdx = (pY * width + pX) * 4;
    let sumR = 0, sumG = 0, sumB = 0, sumW = 0;

    const rSq = radius * radius;

    const minX = Math.max(0, pX - radius);
    const maxX = Math.min(width - 1, pX + radius);
    const minY = Math.max(0, pY - radius);
    const maxY = Math.min(height - 1, pY + radius);

    for (let qY = minY; qY <= maxY; qY++) {
      for (let qX = minX; qX <= maxX; qX++) {
        const qIdxLinear = qY * width + qX;
        if (state[qIdxLinear] !== 0) continue; // Only use KNOWN pixels

        const dx = pX - qX;
        const dy = pY - qY;
        const dSq = dx * dx + dy * dy;
        if (dSq > rSq || dSq === 0) continue;

        const d = Math.sqrt(dSq);
        const dirWeight = Math.abs(dx * dx + dy * dy) / (d * d + 1e-4);
        const distWeight = 1 / (d * d * d + 1e-4);
        const weight = dirWeight * distWeight;

        const qIdx = qIdxLinear * 4;
        sumR += weight * pixels[qIdx];
        sumG += weight * pixels[qIdx + 1];
        sumB += weight * pixels[qIdx + 2];
        sumW += weight;
      }
    }

    if (sumW > 0) {
      pixels[pIdx] = sumR / sumW;
      pixels[pIdx + 1] = sumG / sumW;
      pixels[pIdx + 2] = sumB / sumW;
      pixels[pIdx + 3] = 255;
    }
  }

  /**
   * Gaussian Blur Delogo Filter over Mask region (ROI Optimized)
   */
  static blurDelogo(imgData, maskData, radius = 20) {
    const roi = InpaintEngine.getMaskBoundingBox(maskData, radius);
    if (!roi) return;

    const width = imgData.width;
    const height = imgData.height;
    const pixels = imgData.data;
    const mask = maskData.data;

    const copy = new Uint8ClampedArray(pixels);
    const r = Math.max(1, Math.floor(radius));

    for (let y = roi.minY; y <= roi.maxY; y++) {
      for (let x = roi.minX; x <= roi.maxX; x++) {
        const idx = (y * width + x) * 4;
        if (mask[idx + 3] < 10 && mask[idx] < 128) continue; // Skip non-mask

        let sumR = 0, sumG = 0, sumB = 0, count = 0;

        for (let dy = -r; dy <= r; dy++) {
          const qy = y + dy;
          if (qy < 0 || qy >= height) continue;
          for (let dx = -r; dx <= r; dx++) {
            const qx = x + dx;
            if (qx < 0 || qx >= width) continue;

            const qidx = (qy * width + qx) * 4;
            sumR += copy[qidx];
            sumG += copy[qidx + 1];
            sumB += copy[qidx + 2];
            count++;
          }
        }

        if (count > 0) {
          pixels[idx] = sumR / count;
          pixels[idx + 1] = sumG / count;
          pixels[idx + 2] = sumB / count;
        }
      }
    }
  }

  /**
   * Mosaic Pixelation Filter over Mask region (ROI Optimized)
   */
  static mosaicPixelate(imgData, maskData, blockSize = 16) {
    const roi = InpaintEngine.getMaskBoundingBox(maskData, blockSize);
    if (!roi) return;

    const width = imgData.width;
    const height = imgData.height;
    const pixels = imgData.data;
    const mask = maskData.data;

    for (let y = roi.minY; y <= roi.maxY; y += blockSize) {
      for (let x = roi.minX; x <= roi.maxX; x += blockSize) {
        let isMasked = false;
        let sumR = 0, sumG = 0, sumB = 0, count = 0;

        for (let by = 0; by < blockSize && (y + by) < height; by++) {
          for (let bx = 0; bx < blockSize && (x + bx) < width; bx++) {
            const idx = ((y + by) * width + (x + bx)) * 4;
            if (mask[idx + 3] > 10 || mask[idx] > 128) {
              isMasked = true;
            }
            sumR += pixels[idx];
            sumG += pixels[idx + 1];
            sumB += pixels[idx + 2];
            count++;
          }
        }

        if (isMasked && count > 0) {
          const avgR = sumR / count;
          const avgG = sumG / count;
          const avgB = sumB / count;

          for (let by = 0; by < blockSize && (y + by) < height; by++) {
            for (let bx = 0; bx < blockSize && (x + bx) < width; bx++) {
              const idx = ((y + by) * width + (x + bx)) * 4;
              pixels[idx] = avgR;
              pixels[idx + 1] = avgG;
              pixels[idx + 2] = avgB;
            }
          }
        }
      }
    }
  }

  /**
   * Sample surrounding edge background color and fill mask (ROI Optimized)
   */
  static colorFill(imgData, maskData) {
    const roi = InpaintEngine.getMaskBoundingBox(maskData, 2);
    if (!roi) return;

    const width = imgData.width;
    const height = imgData.height;
    const pixels = imgData.data;
    const mask = maskData.data;

    let borderR = 0, borderG = 0, borderB = 0, borderCount = 0;

    for (let y = roi.minY; y <= roi.maxY; y++) {
      for (let x = roi.minX; x <= roi.maxX; x++) {
        const idx = (y * width + x) * 4;
        if (mask[idx + 3] > 10 || mask[idx] > 128) {
          const neighbors = [
            x > 0 ? idx - 4 : -1,
            x < width - 1 ? idx + 4 : -1,
            y > 0 ? idx - width * 4 : -1,
            y < height - 1 ? idx + width * 4 : -1
          ];
          for (const n of neighbors) {
            if (n !== -1 && mask[n + 3] < 10) {
              borderR += pixels[n];
              borderG += pixels[n + 1];
              borderB += pixels[n + 2];
              borderCount++;
              break;
            }
          }
        }
      }
    }

    const fillR = borderCount > 0 ? borderR / borderCount : 0;
    const fillG = borderCount > 0 ? borderG / borderCount : 0;
    const fillB = borderCount > 0 ? borderB / borderCount : 0;

    for (let y = roi.minY; y <= roi.maxY; y++) {
      for (let x = roi.minX; x <= roi.maxX; x++) {
        const idx = (y * width + x) * 4;
        if (mask[idx + 3] > 10 || mask[idx] > 128) {
          pixels[idx] = fillR;
          pixels[idx + 1] = fillG;
          pixels[idx + 2] = fillB;
        }
      }
    }
  }

  /**
   * Auto Detect Watermark heuristic for standard corner logos
   */
  static autoDetectLogoBounds(imgData) {
    const width = imgData.width;
    const height = imgData.height;
    const pixels = imgData.data;

    const marginW = Math.floor(width * 0.35);
    const marginH = Math.floor(height * 0.25);

    const corners = [
      { name: 'bottom-right', x1: width - marginW, y1: height - marginH, x2: width - 10, y2: height - 10 },
      { name: 'top-right', x1: width - marginW, y1: 10, x2: width - 10, y2: marginH },
      { name: 'bottom-left', x1: 10, y1: height - marginH, x2: marginW, y2: height - 10 },
      { name: 'top-left', x1: 10, y1: 10, x2: marginW, y2: marginH }
    ];

    let bestCorner = null;
    let maxVariance = -1;

    for (const corner of corners) {
      let sumLuma = 0;
      let count = 0;
      const lumas = [];

      for (let y = corner.y1; y <= corner.y2; y += 2) {
        for (let x = corner.x1; x <= corner.x2; x += 2) {
          const idx = (y * width + x) * 4;
          const luma = 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];
          sumLuma += luma;
          lumas.push(luma);
          count++;
        }
      }

      if (count === 0) continue;
      const avgLuma = sumLuma / count;
      let variance = 0;
      for (const l of lumas) {
        variance += (l - avgLuma) * (l - avgLuma);
      }
      variance /= count;

      if (variance > maxVariance) {
        maxVariance = variance;
        bestCorner = corner;
      }
    }

    if (bestCorner) {
      const boxW = Math.floor(width * 0.22);
      const boxH = Math.floor(height * 0.12);

      let x = bestCorner.x1;
      let y = bestCorner.y1;

      if (bestCorner.name.includes('right')) x = width - boxW - 20;
      if (bestCorner.name.includes('bottom')) y = height - boxH - 20;

      return { x, y, width: boxW, height: boxH };
    }

    return { x: width - 180, y: height - 80, width: 160, height: 60 };
  }
}
