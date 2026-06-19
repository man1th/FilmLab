/**
 * chemistry.ts
 *
 * Pixel-level film chemistry transforms matching the features.md spec.
 * Operates on Uint8ClampedArray RGBA pixel data in-place.
 *
 * All transforms use normalized [0, 1] float internally.
 */

import type { ChemistryParams } from '@/store/useParameterStore';

/**
 * Apply full Group 1 chemistry pipeline to pixel data in-place.
 */
export function applyChemistryPipeline(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  params: ChemistryParams,
): void {
  const { dMin, dMax, subtractiveDensity, contrastProfile, chemistryExpiration, shadowFog } = params;
  const count = width * height;

  for (let i = 0; i < count; i++) {
    const idx = i * 4;
    let r = pixels[idx] / 255;
    let g = pixels[idx + 1] / 255;
    let b = pixels[idx + 2] / 255;
    // alpha untouched

    // ── 1.1 D-Min: I_out = D_min + (1.0 - D_min) * I_in ──
    const dmScale = 1.0 - dMin;
    r = dMin + dmScale * r;
    g = dMin + dmScale * g;
    b = dMin + dmScale * b;

    // ── 1.2 D-Max: Hard ceiling clamp ──
    r = Math.min(r, dMax);
    g = Math.min(g, dMax);
    b = Math.min(b, dMax);

    // ── 1.3 Subtractive Color Density ──
    // C = -ln(R), M = -ln(G), Y = -ln(B)
    // R_out = exp(-C * S_d)
    if (subtractiveDensity !== 1.0) {
      const eps = 1e-6;
      const C = -Math.log(r + eps) * subtractiveDensity;
      const M = -Math.log(g + eps) * subtractiveDensity;
      const Y = -Math.log(b + eps) * subtractiveDensity;
      r = Math.exp(-C);
      g = Math.exp(-M);
      b = Math.exp(-Y);
      r = Math.min(r, dMax);
      g = Math.min(g, dMax);
      b = Math.min(b, dMax);
    }

    // ── 1.4 Emulsion Contrast (Sigmoidal S-Curve) ──
    // f(x) = 1 / (1 + exp(-gamma * (x - 0.5)))
    if (contrastProfile !== 1.0) {
      const sigR = 1.0 / (1.0 + Math.exp(-contrastProfile * (r - 0.5)));
      r = r + (sigR - r) * 0.5;
      const sigG = 1.0 / (1.0 + Math.exp(-contrastProfile * (g - 0.5)));
      g = g + (sigG - g) * 0.5;
      const sigB = 1.0 / (1.0 + Math.exp(-contrastProfile * (b - 0.5)));
      b = b + (sigB - b) * 0.5;
    }

    // ── 1.5 Chemistry Expiration ──
    // (1 - Y)^2 * factor * channel_weight — cyan/green cast in shadows
    if (chemistryExpiration > 0) {
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const sf = (1.0 - lum) * (1.0 - lum) * chemistryExpiration;
      r += sf * 0.05;
      g += sf * 0.12;
      // blue untouched → net cyan cast
    }

    // ── Shadow Fog ──
    r += shadowFog;
    g += shadowFog;
    b += shadowFog;

    // Final clamp to [0, 1]
    pixels[idx] = clampByte(r);
    pixels[idx + 1] = clampByte(g);
    pixels[idx + 2] = clampByte(b);
  }
}

function clampByte(v: number): number {
  const c = Math.round(v * 255);
  return c < 0 ? 0 : c > 255 ? 255 : c;
}
