import { useEffect, useRef, useCallback, useState } from "react";
import { useParameterStore } from "@/store/useParameterStore";
import { useImageStore } from "@/store/useImageStore";

const PARAMETER_FLOAT_COUNT = 48;

export function useEngineBridge() {
  const workerRef = useRef<Worker | null>(null);
  const sharedParamsRef = useRef<Float32Array | null>(null);
  const [hasImage, setHasImage] = useState(false);

  // Store the latest image rendering callback so child components can register
  const imageRenderFnRef = useRef<((dataUrl: string) => void) | null>(null);

  // Register a render function (called by ViewportCanvas when its 2D canvas is ready)
  const registerImageRenderer = useCallback((fn: (dataUrl: string) => void) => {
    imageRenderFnRef.current = fn;
  }, []);

  // Initialize worker for future WASM compute
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
      } else if (type === "LOG") {
        console.log(event.data.message);
      }
    };

    workerRef.current = worker;
    worker.postMessage({ type: "INIT", sharedBuffer: buffer });

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  // Load a file: decode via Image element, send to renderer
  const loadFile = useCallback(async (file: File) => {
    try {
      // Read as data URL
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });

      // Create an Image element to decode the data URL
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to decode image"));
        img.src = dataUrl;
      });

      // Store the original image in the image store (non-destructive)
      useImageStore
        .getState()
        .setOriginalImage(dataUrl, img.naturalWidth, img.naturalHeight);

      // Send the decoded image data URL to the renderer
      imageRenderFnRef.current?.(dataUrl);
      setHasImage(true);
      window.dispatchEvent(new CustomEvent("filmlab:image-loaded"));

      // Also send to worker for future processing
      const arrayBuffer = await file.arrayBuffer();
      workerRef.current?.postMessage(
        {
          type: "IMAGE_LOAD",
          buffer: arrayBuffer,
          fileName: file.name,
          width: img.naturalWidth,
          height: img.naturalHeight,
        },
        [arrayBuffer],
      );
    } catch (err) {
      console.error("Failed to load image:", err);
    }
  }, []);

  // Sync parameters to shared buffer → request render
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

  // Subscribe to store changes
  useEffect(() => {
    const unsub = useParameterStore.subscribe(() => {
      requestRender();
    });
    return unsub;
  }, [requestRender]);

  return {
    worker: workerRef,
    hasImage,
    initCanvas: null as ((c: OffscreenCanvas) => void) | null,
    loadFile,
    registerImageRenderer,
    requestRender,
  };
}
