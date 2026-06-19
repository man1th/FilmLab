import { useRef, useEffect, useCallback, useState } from "react";
import { useImageStore } from "@/store/useImageStore";
import { useParameterStore } from "@/store/useParameterStore";
import { createGpuPipeline } from "@/pipeline/gpu-pipeline";

interface ViewportCanvasProps {
  onRegisterRenderer: (fn: (dataUrl: string) => void) => void;
  onFileDrop: (file: File) => void;
}

const MAX_PREVIEW_PX = 2000;

export function ViewportCanvas({
  onRegisterRenderer,
  onFileDrop,
}: ViewportCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [hasImage, setHasImage] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Pan & zoom
  const panRef = useRef({ x: 0, y: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const zoomRef = useRef(1);
  const isDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  // GPU pipeline
  const originalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const processedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewScaleRef = useRef(1);
  const pipelineRef = useRef<ReturnType<typeof createGpuPipeline> | null>(null);

  // ── GPU-based processing: update uniforms → render → read back ──────

  const gpuProcess = useCallback(() => {
    const pipeline = pipelineRef.current;
    if (!pipeline) return;

    const params = useParameterStore.getState().chemistry;
    const paramArray = new Float64Array([
      params.dMin,
      params.dMax,
      params.subtractiveDensity,
      params.contrastProfile,
      params.chemistryExpiration,
      params.shadowFog,
    ]);

    pipeline.setParams(paramArray);
    const pixels = pipeline.render(); // Uint8ClampedArray

    // Copy to new buffer for ImageData (type-safe ArrayBuffer)
    const clamped = new Uint8ClampedArray(pixels);

    // Store processed result in offscreen 2D canvas
    const w = pipeline.gl.canvas.width;
    const h = pipeline.gl.canvas.height;
    let procCanvas = processedCanvasRef.current;
    if (!procCanvas || procCanvas.width !== w || procCanvas.height !== h) {
      procCanvas = document.createElement("canvas");
      procCanvas.width = w;
      procCanvas.height = h;
      processedCanvasRef.current = procCanvas;
    }
    const pCtx = procCanvas.getContext("2d");
    if (!pCtx) return;
    const imageData = new ImageData(clamped, w, h);
    pCtx.putImageData(imageData, 0, 0);

    renderCanvas();
  }, []);

  // Subscribe to chemistry param changes → GPU process instantly
  useEffect(() => {
    const unsub = useParameterStore.subscribe(() => {
      if (!imageRef.current) return;
      gpuProcess();
    });
    return unsub;
  }, [gpuProcess]);

  // ── Canvas render ──────────────────────────────────────────────────

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const img = imageRef.current;
    if (!canvas || !container || !img) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cw = container.clientWidth;
    const ch = container.clientHeight;
    canvas.width = cw;
    canvas.height = ch;

    ctx.clearRect(0, 0, cw, ch);

    const state = useImageStore.getState();
    const { rotation, flipped, cropActive, cropRect } = state;

    let srcX = 0,
      srcY = 0,
      srcW = img.naturalWidth,
      srcH = img.naturalHeight;
    if (cropRect && !cropActive) {
      srcX = cropRect.x;
      srcY = cropRect.y;
      srcW = cropRect.width;
      srcH = cropRect.height;
    }

    const pan = panRef.current;
    const zoom = zoomRef.current;

    ctx.save();
    ctx.translate(cw / 2 + pan.x, ch / 2 + pan.y);
    ctx.scale(zoom * (flipped ? -1 : 1), zoom);
    ctx.rotate((rotation * Math.PI) / 180);

    const procCanvas = processedCanvasRef.current;
    if (procCanvas) {
      // Draw processed preview scaled to native image space
      const psx = srcX * previewScaleRef.current;
      const psy = srcY * previewScaleRef.current;
      const psw = srcW * previewScaleRef.current;
      const psh = srcH * previewScaleRef.current;
      ctx.drawImage(
        procCanvas,
        psx,
        psy,
        psw,
        psh,
        -srcW / 2,
        -srcH / 2,
        srcW,
        srcH,
      );
    } else {
      ctx.drawImage(
        img,
        srcX,
        srcY,
        srcW,
        srcH,
        -srcW / 2,
        -srcH / 2,
        srcW,
        srcH,
      );
    }

    ctx.restore();

    if (cropActive && cropRect) {
      drawCropOverlay(ctx, cw, ch, pan, zoom, cropRect);
    }
  }, []);

  // ── Initialize GPU pipeline (uses resolution mode from store) ───────

  const initGpuPipeline = useCallback(
    (origCanvas: HTMLCanvasElement) => {
      const origW = origCanvas.width;
      const origH = origCanvas.height;
      const mode = useImageStore.getState().resolutionMode;

      let pw: number, ph: number, scale: number;
      if (mode === "fr") {
        // Full resolution — native dimensions
        pw = origW;
        ph = origH;
        scale = 1;
      } else {
        // Partial resolution — cap at 2000px
        const maxDim = Math.max(origW, origH);
        scale = maxDim > MAX_PREVIEW_PX ? MAX_PREVIEW_PX / maxDim : 1;
        pw = Math.max(1, Math.round(origW * scale));
        ph = Math.max(1, Math.round(origH * scale));
      }
      previewScaleRef.current = scale;

      // Downscale (or use full) original to working size
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = pw;
      tempCanvas.height = ph;
      const tCtx = tempCanvas.getContext("2d");
      if (!tCtx) return;
      tCtx.drawImage(origCanvas, 0, 0, pw, ph);
      const imageData = tCtx.getImageData(0, 0, pw, ph);

      // Destroy previous pipeline if any
      if (pipelineRef.current) {
        pipelineRef.current.destroy();
        pipelineRef.current = null;
      }

      // Create GPU pipeline at working resolution
      const pipeline = createGpuPipeline(pw, ph);
      if (!pipeline) {
        console.warn("WebGL2 not available, falling back to CPU");
        return;
      }
      pipelineRef.current = pipeline;

      // Upload pixels and process
      pipeline.uploadPixels(imageData.data);
      gpuProcess();
    },
    [gpuProcess],
  );

  // Re-init when resolution mode toggles
  useEffect(() => {
    const unsub = useImageStore.subscribe((state) => {
      // Only react to resolutionMode changes
      if ("resolutionMode" in state) {
        const origCanvas = originalCanvasRef.current;
        if (origCanvas && imageRef.current) {
          initGpuPipeline(origCanvas);
        }
      }
    });
    return unsub;
  }, [initGpuPipeline]);

  // ── Load image ──────────────────────────────────────────────────────

  const loadImage = useCallback(
    (dataUrl: string) => {
      const img = new Image();
      img.onload = () => {
        imageRef.current = img;

        const origCanvas = document.createElement("canvas");
        origCanvas.width = img.naturalWidth;
        origCanvas.height = img.naturalHeight;
        const octx = origCanvas.getContext("2d");
        octx?.drawImage(img, 0, 0);
        originalCanvasRef.current = origCanvas;

        // Clear previous processed result
        processedCanvasRef.current = null;

        // Auto-zoom to fit
        const container = containerRef.current;
        if (container) {
          const cw = container.clientWidth;
          const ch = container.clientHeight;
          zoomRef.current =
            Math.min(cw / img.naturalWidth, ch / img.naturalHeight) * 0.9;
          panRef.current = { x: 0, y: 0 };
        }

        // Initialize GPU pipeline — processes with current params
        initGpuPipeline(origCanvas);
      };
      img.src = dataUrl;
    },
    [initGpuPipeline],
  );

  // Register renderer
  useEffect(() => {
    onRegisterRenderer(loadImage);
  }, [onRegisterRenderer, loadImage]);

  // Listen for image-loaded event
  useEffect(() => {
    const handler = () => setHasImage(true);
    window.addEventListener("filmlab:image-loaded", handler);
    return () => window.removeEventListener("filmlab:image-loaded", handler);
  }, []);

  // Re-render on image store changes (rotation, flip, crop)
  useEffect(() => {
    const unsub = useImageStore.subscribe(() => renderCanvas());
    return unsub;
  }, []);

  // Re-render on resize
  useEffect(() => {
    const handleResize = () => renderCanvas();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Cleanup pipeline on unmount
  useEffect(() => {
    return () => {
      pipelineRef.current?.destroy();
      pipelineRef.current = null;
    };
  }, []);

  // ── Mouse handlers ─────────────────────────────────────────────────

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0 || !imageRef.current) return;
    isDragging.current = true;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current || !imageRef.current) return;
    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
    panRef.current.x += dx;
    panRef.current.y += dy;
    renderCanvas();
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!imageRef.current) return;
    e.preventDefault();
    zoomRef.current = Math.max(
      0.1,
      Math.min(zoomRef.current * (e.deltaY > 0 ? 0.9 : 1.1), 50),
    );
    renderCanvas();
  }, []);

  // ── Drag and drop ──────────────────────────────────────────────────

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file && file.type.startsWith("image/")) {
        onFileDrop(file);
      }
    },
    [onFileDrop],
  );

  return (
    <div
      ref={containerRef}
      className={`flex-1 relative overflow-hidden ${
        hasImage ? "cursor-grab active:cursor-grabbing" : ""
      } ${isDragOver ? "ring-2 ring-amber-500/50 ring-inset" : ""}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ display: "block" }}
      />

      {hasImage && (
        <div className="absolute bottom-3 left-3 text-[11px] text-zinc-600 font-mono pointer-events-none select-none z-10">
          {Math.round(zoomRef.current * 100)}%
        </div>
      )}

      {!hasImage && (
        <div
          className="absolute inset-0 flex items-center justify-center z-10 cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="flex flex-col items-center gap-3 text-zinc-700 pointer-events-none select-none">
            <ImportIcon className="w-16 h-16" />
            <p className="text-sm font-medium">
              Drop an image here or click to browse
            </p>
            <p className="text-xs text-zinc-800">JPEG, PNG, TIFF, WebP</p>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/tiff,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFileDrop(file);
          e.target.value = "";
        }}
      />

      {isDragOver && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-zinc-900/60 pointer-events-none">
          <div className="flex flex-col items-center gap-2 text-amber-400">
            <ImportIcon className="w-12 h-12" />
            <p className="text-sm font-medium">Drop to import</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Crop overlay ───────────────────────────────────────────────────────────

function drawCropOverlay(
  ctx: CanvasRenderingContext2D,
  cw: number,
  ch: number,
  pan: { x: number; y: number },
  zoom: number,
  cropRect: { x: number; y: number; width: number; height: number },
) {
  const icx = cw / 2 + pan.x;
  const icy = ch / 2 + pan.y;
  const csx = icx + (cropRect.x - cropRect.width / 2) * zoom;
  const csy = icy + (cropRect.y - cropRect.height / 2) * zoom;
  const csw = cropRect.width * zoom;
  const csh = cropRect.height * zoom;

  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, 0, cw, ch);
  ctx.clearRect(csx, csy, csw, csh);

  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(csx, csy, csw, csh);

  const hs = 8;
  ctx.fillStyle = "#fff";
  for (const c of [
    { x: csx, y: csy },
    { x: csx + csw, y: csy },
    { x: csx, y: csy + csh },
    { x: csx + csw, y: csy + csh },
  ]) {
    ctx.fillRect(c.x - hs / 2, c.y - hs / 2, hs, hs);
  }

  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = 1;
  const cx = csx + csw / 2,
    cy = csy + csh / 2;
  ctx.beginPath();
  ctx.moveTo(cx, csy);
  ctx.lineTo(cx, csy + csh);
  ctx.moveTo(csx, cy);
  ctx.lineTo(csx + csw, cy);
  ctx.stroke();
}

function ImportIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}
