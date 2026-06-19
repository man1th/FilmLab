import { create } from "zustand";

// ─── Parameter Type Definitions ─────────────────────────────────────────────

export interface ChemistryParams {
  dMin: number; // 0.0 to 0.3
  dMax: number; // 0.7 to 1.0
  subtractiveDensity: number; // 0.0 to 2.0
  contrastProfile: number; // 0.5 to 2.0
  chemistryExpiration: number; // 0.0 to 1.0
  shadowFog: number; // 0.0 to 0.2
}

export interface HalationParams {
  spreadRadius: number; // 1 to 50
  fringeChromaticity: number; // 0.0 to 2.0
  edgeRetention: number; // 0.0 to 1.0
  redSpill: number;
  greenSpill: number;
  blueSpill: number;
  remjetProtection: boolean;
  glowTemperature: number; // 2000 to 10000
}

export interface GrainParams {
  crystalDensity: number; // 0.0 to 1.0
  dyeCloudSaturation: number; // 0.0 to 2.0
  clumpingRoughness: number; // 1.0 to 5.0
  directionalStretch: number; // -1.0 to 1.0
  anamorphicSqueeze: number; // 1.0 to 2.0
  shadowYield: number; // 0.0 to 1.0
  midtoneYield: number; // 0.0 to 1.0
  highlightYield: number; // 0.0 to 1.0
}

export interface AcutanceParams {
  adjacencyEffect: number; // 0.0 to 1.0
  scannerSharpening: number; // 0.0 to 1.0
  microAcutance: number; // 0.0 to 3.0
  fineEdgeBalance: number; // -1.0 to 1.0
  fineKernelSize: number; // 0.5 to 3.0
  macroAcutance: number; // 0.0 to 3.0
  coarseEdgeBalance: number; // -1.0 to 1.0
  coarseKernelSize: number; // 5.0 to 30.0
}

export interface LensParams {
  bokehDesqueeze: number; // 1.0 to 2.0
  flareThreshold: number; // 0.7 to 1.0
  streakExtension: number; // 10.0 to 600.0
  barrelDistortion: number; // -0.3 to +0.3
  peripheralSoftness: number; // 0.0 to 1.0
  promistDiffusion: number; // 0.0 to 1.0
  flareTint: string; // select value
}

export interface FormatParams {
  targetGauge: string; // 8mm | 16mm | 35mm | 65mm
  gateOverscan: number; // 0.0 to 0.25
  debrisFrequency: number; // 0.0 to 1.0
  debrisProfile: string; // Specks | Threads | Crystals
  sprocketsEnabled: boolean;
  vignetteStrength: number; // 0.0 to 1.0
  debrisInversion: boolean;
}

export interface PrintParams {
  printStock: string; // Bypass | Kodak 2383 | Fuji 3510
  contrastDensity: number; // 0.0 to 2.0
  grayscaleNeutrality: number; // 0.0 to 1.0
  shadowDefog: number; // 0.0 to 1.0
}

export interface ParameterStore {
  chemistry: ChemistryParams;
  halation: HalationParams;
  grain: GrainParams;
  acutance: AcutanceParams;
  lens: LensParams;
  format: FormatParams;
  print: PrintParams;

  updateChemistry: (params: Partial<ChemistryParams>) => void;
  updateHalation: (params: Partial<HalationParams>) => void;
  updateGrain: (params: Partial<GrainParams>) => void;
  updateAcutance: (params: Partial<AcutanceParams>) => void;
  updateLens: (params: Partial<LensParams>) => void;
  updateFormat: (params: Partial<FormatParams>) => void;
  updatePrint: (params: Partial<PrintParams>) => void;

  resetAll: () => void;
}

// ─── Default Values ─────────────────────────────────────────────────────────

const defaultChemistry: ChemistryParams = {
  dMin: 0.05,
  dMax: 0.85,
  subtractiveDensity: 1.0,
  contrastProfile: 1.0,
  chemistryExpiration: 0.0,
  shadowFog: 0.02,
};

const defaultHalation: HalationParams = {
  spreadRadius: 15,
  fringeChromaticity: 1.0,
  edgeRetention: 0.5,
  redSpill: 1.0,
  greenSpill: 1.0,
  blueSpill: 1.0,
  remjetProtection: false,
  glowTemperature: 5500,
};

const defaultGrain: GrainParams = {
  crystalDensity: 0.3,
  dyeCloudSaturation: 1.0,
  clumpingRoughness: 2.0,
  directionalStretch: 0.0,
  anamorphicSqueeze: 1.33,
  shadowYield: 0.33,
  midtoneYield: 0.33,
  highlightYield: 0.33,
};

const defaultAcutance: AcutanceParams = {
  adjacencyEffect: 0.3,
  scannerSharpening: 0.1,
  microAcutance: 1.0,
  fineEdgeBalance: 0.0,
  fineKernelSize: 1.5,
  macroAcutance: 0.5,
  coarseEdgeBalance: 0.0,
  coarseKernelSize: 15.0,
};

const defaultLens: LensParams = {
  bokehDesqueeze: 1.33,
  flareThreshold: 0.85,
  streakExtension: 100.0,
  barrelDistortion: 0.0,
  peripheralSoftness: 0.0,
  promistDiffusion: 0.0,
  flareTint: "Neutral",
};

const defaultFormat: FormatParams = {
  targetGauge: "35mm",
  gateOverscan: 0.05,
  debrisFrequency: 0.3,
  debrisProfile: "Specks",
  sprocketsEnabled: false,
  vignetteStrength: 0.3,
  debrisInversion: false,
};

const defaultPrint: PrintParams = {
  printStock: "Bypass",
  contrastDensity: 1.0,
  grayscaleNeutrality: 0.5,
  shadowDefog: 0.3,
};

// ─── Store ──────────────────────────────────────────────────────────────────

export const useParameterStore = create<ParameterStore>((set) => ({
  chemistry: { ...defaultChemistry },
  halation: { ...defaultHalation },
  grain: { ...defaultGrain },
  acutance: { ...defaultAcutance },
  lens: { ...defaultLens },
  format: { ...defaultFormat },
  print: { ...defaultPrint },

  updateChemistry: (params) =>
    set((state) => ({ chemistry: { ...state.chemistry, ...params } })),
  updateHalation: (params) =>
    set((state) => ({ halation: { ...state.halation, ...params } })),
  updateGrain: (params) =>
    set((state) => ({ grain: { ...state.grain, ...params } })),
  updateAcutance: (params) =>
    set((state) => ({ acutance: { ...state.acutance, ...params } })),
  updateLens: (params) =>
    set((state) => ({ lens: { ...state.lens, ...params } })),
  updateFormat: (params) =>
    set((state) => ({ format: { ...state.format, ...params } })),
  updatePrint: (params) =>
    set((state) => ({ print: { ...state.print, ...params } })),

  resetAll: () =>
    set({
      chemistry: { ...defaultChemistry },
      halation: { ...defaultHalation },
      grain: { ...defaultGrain },
      acutance: { ...defaultAcutance },
      lens: { ...defaultLens },
      format: { ...defaultFormat },
      print: { ...defaultPrint },
    }),
}));
