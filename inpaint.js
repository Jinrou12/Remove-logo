/**
 * LogoRemovie Studio - Image & Frame Inpainting Engine
 * Implements:
 * 1. Telea Fast Marching Inpainting Algorithm
 * 2. Gaussian Blur Delogo Filter
 * 3. Mosaic Pixelation
 * 4. Dominant Edge Color Fill
 * 5. Smart Automatic Watermark/Logo Detection Heuristic
 */

class InpaintEngine {
  /**
   * Fast Marching Method (Telea Algorithm) for Canvas ImageData
   * @param {ImageData} imgData - Input/Output RGBA ImageData
   * @param {ImageData} maskData - Mask RGBA ImageData (Non-zero alpha or red = mask region)
   * @param {number} radius - Inpaint neighborhood radius (default: 8)
   */
  static teleaInpaint(imgData, maskData, radius = 8) {
    const width = imgData.width;
    const height = imgData.height;
    const pixels = imgData.data;
    const mask = maskData.data;
    
    const size = width * height;
    const INF = 1e6;
    
    // States: 0 = KNOWN (outside mask), 1 = BAND (boundary), 2 = INSIDE (to be inpainted)
    const state = new Uint8Array(size);
    const dist = new Float32Array(size);
    
    // Initialize state & distance matrix
    for (let i = 0; i < size; i++) {
      const maskIdx = i * 4;
      // Mask pixel if alpha > 10 or red channel > 128
      if (mask[maskIdx + 3] > 10 || mask[maskIdx] > 128) {
        state[i] = 2; // INSIDE
        dist[i] = INF;
      } else {
        state[i] = 0; // KNOWN
        dist[i] = 0;
      }
    }

    // Min-Priority Queue for Fast Marching (simple array/binary heap)
    const bandQueue = [];

    // Identify initial boundary (BAND) pixels
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (state[idx] === 2) {
          // Check 4-neighbors
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
            bandQueue.push(idx);
          }
        }
      }
    }

    // Process priority queue until no band pixels left
    while (bandQueue.length > 0) {
      // Sort to get smallest distance (Fast Marching boundary advance)
      bandQueue.sort((a, b) => dist[a] - dist[b]);
      const current = bandQueue.shift();
      
      state[current] = 0; // Mark as KNOWN
      
      const cx = current % width;
      const cy = Math.floor(current / width);
      
      // Calculate color for this newly KNOWN pixel using Telea weighting formula
      InpaintEngine._computePixelColor(pixels, state, dist, cx, cy, width, height, radius);
      
      // Check neighbors and push to BAND queue
      const neighbors = [
        cx > 0 ? current - 1 : -1,
        cx < width - 1 ? current + 1 : -1,
        cy > 0 ? current - width : -1,
        cy < height - 1 ? current + width : -1
      ];

      for (const n of neighbors) {
        if (n !== -1 && state[n] === 2) {
          state[n] = 1; // Mark as BAND
          // Calculate distance Eikonal approximation
          dist[n] = InpaintEngine._solveEikonal(dist, state, n % width, Math.floor(n / width), width, height);
          bandQueue.push(n);
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
   * Gaussian Blur Delogo Filter over Mask region
   */
  static blurDelogo(imgData, maskData, radius = 20) {
    const width = imgData.width;
    const height = imgData.height;
    const pixels = imgData.data;
    const mask = maskData.data;
    
    const copy = new Uint8ClampedArray(pixels);
    const r = Math.max(1, Math.floor(radius));

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
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
   * Mosaic Pixelation Filter over Mask region
   */
  static mosaicPixelate(imgData, maskData, blockSize = 16) {
    const width = imgData.width;
    const height = imgData.height;
    const pixels = imgData.data;
    const mask = maskData.data;

    for (let y = 0; y < height; y += blockSize) {
      for (let x = 0; x < width; x += blockSize) {
        // Check if block intersects mask
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
   * Sample surrounding edge background color and fill mask
   */
  static colorFill(imgData, maskData) {
    const width = imgData.width;
    const height = imgData.height;
    const pixels = imgData.data;
    const mask = maskData.data;

    let borderR = 0, borderG = 0, borderB = 0, borderCount = 0;

    // Sample outer ring of mask
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        if (mask[idx + 3] > 10 || mask[idx] > 128) {
          // Check if boundary
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

    for (let i = 0; i < width * height; i++) {
      const idx = i * 4;
      if (mask[idx + 3] > 10 || mask[idx] > 128) {
        pixels[idx] = fillR;
        pixels[idx + 1] = fillG;
        pixels[idx + 2] = fillB;
      }
    }
  }

  /**
   * Auto Detect Watermark heuristic for standard corner logos
   * Scans 4 corners of the image for high contrast text or logos
   */
  static autoDetectLogoBounds(imgData) {
    const width = imgData.width;
    const height = imgData.height;
    const pixels = imgData.data;

    // Define 4 corner quadrant regions (top-left, top-right, bottom-left, bottom-right)
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
      // Create tight box inside best corner
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
