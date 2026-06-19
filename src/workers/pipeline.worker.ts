/**
 * pipeline.worker.ts
 *
 * Dedicated processing worker. Offloads pixel-crunching from the UI thread
 * so slider interaction stays buttery smooth.
 *
 * Messages:
 *   PROCESS  ← pixel buffer + params → processes → sends PROCESSED back
 *   INIT     ← SharedArrayBuffer (for future GPU pipeline)
 */

let sharedParams: Float32Array | null = null;

// ─── Chemistry pipeline (inlined — pure math, no deps) ─────────────────────

function applyChemistryPipeline(
  pixels: Uint8ClampedArray,
  _width: number,
  _height: number,
  params: Float64Array | Float32Array,
): void {
  const dMin = params[0];
  const dMax = params[1];
  const subtractiveDensity = params[2];
  const contrastProfile = params[3];
  const chemistryExpiration = params[4];
  const shadowFog = params[5];

  const count = pixels.length / 4;

  for (let i = 0; i < count; i++) {
    const idx = i * 4;
    let r = pixels[idx] / 255;
    let g = pixels[idx + 1] / 255;
    let b = pixels[idx + 2] / 255;

    // 1.1 D-Min
    const dmScale = 1.0 - dMin;
    r = dMin + dmScale * r;
    g = dMin + dmScale * g;
    b = dMin + dmScale * b;

    // 1.2 D-Max
    r = r > dMax ? dMax : r;
    g = g > dMax ? dMax : g;
    b = b > dMax ? dMax : b;

    // 1.3 Subtractive Density (CMY log/exp)
    if (subtractiveDensity !== 1.0) {
      const eps = 1e-6;
      const C = -Math.log(r + eps) * subtractiveDensity;
      const M = -Math.log(g + eps) * subtractiveDensity;
      const Y = -Math.log(b + eps) * subtractiveDensity;
      r = Math.exp(-C);
      g = Math.exp(-M);
      b = Math.exp(-Y);
    }

    // 1.4 Emulsion Contrast (sigmoid S-curve)
    if (contrastProfile !== 1.0) {
      const sig = (x: number) =>
        1 / (1 + Math.exp(-contrastProfile * (x - 0.5)));
      r = r + (sig(r) - r) * 0.5;
      g = g + (sig(g) - g) * 0.5;
      b = b + (sig(b) - b) * 0.5;
    }

    // 1.5 Chemistry Expiration — cyan/green shadow cast
    if (chemistryExpiration > 0) {
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const sf = (1.0 - lum) * (1.0 - lum) * chemistryExpiration;
      r += sf * 0.05;
      g += sf * 0.12;
    }

    // Shadow Fog
    r = r + shadowFog;
    g = g + shadowFog;
    b = b + shadowFog;

    pixels[idx] = r > 1 ? 255 : r < 0 ? 0 : (r * 255) | 0;
    pixels[idx + 1] = g > 1 ? 255 : g < 0 ? 0 : (g * 255) | 0;
    pixels[idx + 2] = b > 1 ? 255 : b < 0 ? 0 : (b * 255) | 0;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function err(msg: string) {
  self.postMessage({ type: "ERROR", message: `[Worker] ${msg}` });
}

// ─── Message handler ────────────────────────────────────────────────────────

self.onmessage = (event: MessageEvent) => {
  const { type } = event.data;

  try {
    switch (type) {
      case "INIT": {
        sharedParams = new Float32Array(event.data.sharedBuffer);
        break;
      }

      case "PROCESS": {
        const { buffer, width, height, params } = event.data as {
          buffer: ArrayBuffer;
          width: number;
          height: number;
          params: Float64Array;
        };

        const pixels = new Uint8ClampedArray(buffer);
        applyChemistryPipeline(pixels, width, height, params);

        // Send processed buffer back (copy is fine for preview-sized data)
        self.postMessage({ type: "PROCESSED", buffer, width, height });
        break;
      }

      default:
        break;
    }
  } catch (e) {
    err(`Handler error: ${e}`);
  }
};
