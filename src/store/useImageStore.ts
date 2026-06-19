import { create } from "zustand";

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CropAspectRatio {
  id: string;
  label: string;
  ratio: number; // width / height
  category: "still" | "cinematic";
}

export const CROP_ASPECT_RATIOS: CropAspectRatio[] = [
  // Still Photography
  {
    id: "1:1",
    label: "1:1 (1.00) – Medium Format Square",
    ratio: 1,
    category: "still",
  },
  {
    id: "4:3",
    label: "4:3 / 1.33:1 (1.33) – Medium Format 645",
    ratio: 4 / 3,
    category: "still",
  },
  {
    id: "3:2",
    label: "3:2 (1.50) – Standard 35mm",
    ratio: 3 / 2,
    category: "still",
  },
  {
    id: "7:6",
    label: "7:6 / 1.17:1 (1.17) – The 6x7 Perfect Detail",
    ratio: 7 / 6,
    category: "still",
  },
  {
    id: "5:4",
    label: "5:4 / 1.25:1 (1.25) – Large Format Sheet Film",
    ratio: 5 / 4,
    category: "still",
  },
  {
    id: "65:24",
    label: "65:24 / 2.71:1 (2.71) – Panoramic 35mm (XPan)",
    ratio: 65 / 24,
    category: "still",
  },

  // Motion Picture & Cinematic
  {
    id: "1.375:1",
    label: "1.375:1 (1.38) – Academy Ratio",
    ratio: 1.375,
    category: "cinematic",
  },
  {
    id: "1.66:1",
    label: "1.66:1 (1.66) – European Widescreen / Super 16mm",
    ratio: 1.66,
    category: "cinematic",
  },
  {
    id: "1.85:1",
    label: "1.85:1 (1.85) – US Theatrical Flat",
    ratio: 1.85,
    category: "cinematic",
  },
  {
    id: "2.39:1",
    label: "2.39:1 / 2.40:1 (2.39) – Anamorphic Scope",
    ratio: 2.39,
    category: "cinematic",
  },
];

export interface ImageStore {
  /** The original uploaded image as a data URL (never modified) */
  originalImageDataUrl: string | null;
  /** Natural dimensions of the original image */
  naturalWidth: number;
  naturalHeight: number;

  /** Rotation in degrees (0, 90, 180, 270) */
  rotation: number;
  /** Horizontal flip */
  flipped: boolean;

  /** Crop system */
  cropActive: boolean;
  cropAspectId: string | null;
  cropRect: CropRect | null;

  /** Pan & zoom state (stored for persistence across mode switches) */
  panX: number;
  panY: number;
  zoom: number;

  /** Resolution mode: 'pr' = partial (2000px preview), 'fr' = full (native) */
  resolutionMode: "pr" | "fr";

  // ── Actions ──

  setOriginalImage: (dataUrl: string, width: number, height: number) => void;
  rotateClockwise: () => void;
  toggleFlip: () => void;

  openCrop: () => void;
  closeCrop: () => void;
  selectCropAspect: (id: string) => void;
  setCropRect: (rect: CropRect) => void;
  applyCrop: () => void;
  cancelCrop: () => void;

  setPan: (x: number, y: number) => void;
  setZoom: (zoom: number) => void;
  toggleResolution: () => void;

  resetImage: () => void;
}

export const useImageStore = create<ImageStore>((set, get) => ({
  originalImageDataUrl: null,
  naturalWidth: 0,
  naturalHeight: 0,

  rotation: 0,
  flipped: false,

  cropActive: false,
  cropAspectId: null,
  cropRect: null,

  panX: 0,
  panY: 0,
  zoom: 1,
  resolutionMode: "pr",

  setOriginalImage: (dataUrl, width, height) =>
    set({
      originalImageDataUrl: dataUrl,
      naturalWidth: width,
      naturalHeight: height,
      rotation: 0,
      flipped: false,
      cropRect: null,
      cropActive: false,
      cropAspectId: null,
      panX: 0,
      panY: 0,
      zoom: 1,
      resolutionMode: "pr",
    }),

  rotateClockwise: () =>
    set((state) => ({
      rotation: (state.rotation + 90) % 360,
    })),

  toggleFlip: () =>
    set((state) => ({
      flipped: !state.flipped,
    })),

  openCrop: () => set({ cropActive: true }),
  closeCrop: () => set({ cropActive: false }),

  selectCropAspect: (id) => {
    const ratioDef = CROP_ASPECT_RATIOS.find((r) => r.id === id);
    if (!ratioDef) return;

    const state = get();
    const w = state.naturalWidth;
    const h = state.naturalHeight;

    // Center a crop rectangle with the selected aspect ratio
    let cropW: number, cropH: number;
    if (w / h > ratioDef.ratio) {
      // Image is wider than the ratio → crop width
      cropH = h;
      cropW = h * ratioDef.ratio;
    } else {
      // Image is taller than the ratio → crop height
      cropW = w;
      cropH = w / ratioDef.ratio;
    }

    set({
      cropAspectId: id,
      cropRect: {
        x: (w - cropW) / 2,
        y: (h - cropH) / 2,
        width: cropW,
        height: cropH,
      },
    });
  },

  setCropRect: (rect) => set({ cropRect: rect }),

  applyCrop: () => {
    // Crop is non-destructive: we store the crop rect but keep the original
    // The canvas uses this to render only the cropped portion
    set({ cropActive: false });
  },

  cancelCrop: () =>
    set({
      cropActive: false,
      cropAspectId: null,
      cropRect: null,
    }),

  setPan: (x, y) => set({ panX: x, panY: y }),
  setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(zoom, 50)) }),

  toggleResolution: () =>
    set((state) => ({
      resolutionMode: state.resolutionMode === "pr" ? "fr" : "pr",
    })),

  resetImage: () =>
    set({
      originalImageDataUrl: null,
      naturalWidth: 0,
      naturalHeight: 0,
      rotation: 0,
      flipped: false,
      cropActive: false,
      cropAspectId: null,
      cropRect: null,
      panX: 0,
      panY: 0,
      zoom: 1,
    }),
}));
