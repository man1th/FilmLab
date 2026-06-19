import { useEffect, useRef, useCallback, useState } from "react";
import { useParameterStore } from "@/store/useParameterStore";
import { useImageStore } from "@/store/useImageStore";

const PARAMETER_FLOAT_COUNT = 48;

export function useEngineBridge() {
  const workerRef = useRef<Worker | null>(null);
  const sharedParamsRef = useRef<Float32Array | null>(null);
  const [hasImage, setHasImage] = useState(false);
  const imageRenderFnRef = useRef<((dataUrl: string) => void) | null>(null);
  const processCallbackRef = useRef<
    ((buffer: ArrayBuffer, width: number, height: number) => void) | null
  >(null);

  const registerImageRenderer = useCallback((fn: (dataUrl: string) => void) => {
    imageRenderFnRef.current = fn;
  }, []);

  // Initialize worker
  useEffect(() => {
    const buffer = new SharedArrayBuffer(PARAMETER_FLOAT_COUNT * 4);
    sharedParamsRef.current = new Float32Array(buffer);

    const worker = new Worker(
      new URL("@/workers/pipeline.worker.ts", import.meta.url),
      { type: "module" },
    );

    worker.onmessage = (event) => {
      const { type } = event.data;
      if (type === "ERROR") {
        console.error("[Worker]", event.data.message);
      } else if (type === "PROCESSED") {
        // Forward processed pixel data back to ViewportCanvas
        processCallbackRef.current?.(
          event.data.buffer,
          event.data.width,
          event.data.height,
        );
      }
    };

    workerRef.current = worker;
    worker.postMessage({ type: "INIT", sharedBuffer: buffer });

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  // Register a callback to receive processed pixel data from the worker
  const onProcessed = useCallback(
    (fn: (buffer: ArrayBuffer, width: number, height: number) => void) => {
      processCallbackRef.current = fn;
    },
    [],
  );

  // Send pixel data to the worker for processing
  // Returns immediately — result comes back via onProcessed callback
  const requestProcess = useCallback(
    (pixelData: Uint8ClampedArray, width: number, height: number) => {
      const params = useParameterStore.getState().chemistry;
      const paramArray = new Float64Array([
        params.dMin,
        params.dMax,
        params.subtractiveDensity,
        params.contrastProfile,
        params.chemistryExpiration,
        params.shadowFog,
      ]);

      // Send pixel data to worker (structured clone copies it for the worker)
      workerRef.current?.postMessage({
        type: "PROCESS",
        buffer: pixelData.buffer,
        width,
        height,
        params: paramArray,
      });
    },
    [],
  );

  // Load a file
  const loadFile = useCallback(async (file: File) => {
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });

      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to decode image"));
        img.src = dataUrl;
      });

      useImageStore
        .getState()
        .setOriginalImage(dataUrl, img.naturalWidth, img.naturalHeight);
      imageRenderFnRef.current?.(dataUrl);
      setHasImage(true);
      window.dispatchEvent(new CustomEvent("filmlab:image-loaded"));
    } catch (err) {
      console.error("Failed to load image:", err);
    }
  }, []);

  // Sync params
  const requestRender = useCallback(() => {
    const params = useParameterStore.getState();
    const buf = sharedParamsRef.current;
    if (!buf) return;

    buf[0] = params.chemistry.dMin;
    buf[1] = params.chemistry.dMax;
    buf[2] = params.chemistry.subtractiveDensity;
    buf[3] = params.chemistry.contrastProfile;
    buf[4] = params.chemistry.chemistryExpiration;
    buf[5] = params.chemistry.shadowFog;
    buf[6] = params.halation.spreadRadius;
    buf[7] = params.halation.fringeChromaticity;
    buf[8] = params.halation.edgeRetention;
    buf[9] = params.halation.redSpill;
    buf[10] = params.halation.greenSpill;
    buf[11] = params.halation.blueSpill;
    buf[12] = params.halation.remjetProtection ? 1.0 : 0.0;
    buf[13] = params.halation.glowTemperature;
    buf[14] = params.grain.crystalDensity;
    buf[15] = params.grain.dyeCloudSaturation;
    buf[16] = params.grain.clumpingRoughness;
    buf[17] = params.grain.directionalStretch;
    buf[18] = params.grain.anamorphicSqueeze;
    buf[19] = params.grain.shadowYield;
    buf[20] = params.grain.midtoneYield;
    buf[21] = params.grain.highlightYield;
    buf[22] = params.acutance.adjacencyEffect;
    buf[23] = params.acutance.scannerSharpening;
    buf[24] = params.acutance.microAcutance;
    buf[25] = params.acutance.fineEdgeBalance;
    buf[26] = params.acutance.fineKernelSize;
    buf[27] = params.acutance.macroAcutance;
    buf[28] = params.acutance.coarseEdgeBalance;
    buf[29] = params.acutance.coarseKernelSize;
    buf[30] = params.lens.bokehDesqueeze;
    buf[31] = params.lens.flareThreshold;
    buf[32] = params.lens.streakExtension;
    buf[33] = params.lens.barrelDistortion;
    buf[34] = params.lens.peripheralSoftness;
    buf[35] = params.lens.promistDiffusion;
    buf[36] = params.format.gateOverscan;
    buf[37] = params.format.debrisFrequency;
    buf[38] = params.format.vignetteStrength;
    buf[39] = params.format.sprocketsEnabled ? 1.0 : 0.0;
    buf[40] = params.format.debrisInversion ? 1.0 : 0.0;
    buf[41] = params.print.contrastDensity;
    buf[42] = params.print.grayscaleNeutrality;
    buf[43] = params.print.shadowDefog;

    workerRef.current?.postMessage({ type: "RENDER_FRAME" });
  }, []);

  useEffect(() => {
    const unsub = useParameterStore.subscribe(() => {
      requestRender();
    });
    return unsub;
  }, [requestRender]);

  return {
    worker: workerRef,
    hasImage,
    loadFile,
    registerImageRenderer,
    requestProcess,
    onProcessed,
    requestRender,
  };
}
