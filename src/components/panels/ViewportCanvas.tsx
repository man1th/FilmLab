import { useRef, useEffect, useCallback, useState } from "react";
import { useImageStore } from "@/store/useImageStore";
import { useParameterStore } from "@/store/useParameterStore";
import { applyChemistryPipeline } from "@/pipeline/chemistry";

interface ViewportCanvasProps {
  onRegisterRenderer: (fn: (dataUrl: string) => void) => void;
  onFileDrop: (file: File) => void;
}

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
  const zoomRef = useRef(1);
  const isDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  // Processing pipeline
  const originalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const processedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const needsReprocessRef = useRef(false);

  // ── Process image through chemistry pipeline ──────────────────────────

  const processImage = useCallback(() => {
    const origCanvas = originalCanvasRef.current;
    const img = imageRef.current;
    if (!origCanvas || !img) return;

    const ctx = origCanvas.getContext("2d");
    if (!ctx) return;

    const w = origCanvas.width;
    const h = origCanvas.height;
    const imageData = ctx.getImageData(0, 0, w, h);

    // Apply chemistry pipeline
    const params = useParameterStore.getState().chemistry;
    applyChemistryPipeline(imageData.data, w, h, params);

    // Draw processed result to offscreen canvas
    let procCanvas = processedCanvasRef.current;
    if (!procCanvas || procCanvas.width !== w || procCanvas.height !== h) {
      procCanvas = document.createElement("canvas");
      procCanvas.width = w;
      procCanvas.height = h;
      processedCanvasRef.current = procCanvas;
    }
    const pCtx = procCanvas.getContext("2d");
    if (!pCtx) return;
    pCtx.putImageData(imageData, 0, 0);

    needsReprocessRef.current = false;
    renderCanvas();
  }, []);

  // Subscribe to chemistry param changes → re-process
  useEffect(() => {
    const unsub = useParameterStore.subscribe(() => {
      // Only re-process if chemistry params changed
      if (!imageRef.current) return;
      needsReprocessRef.current = true;
      processImage();
    });
    return unsub;
  }, [processImage]);

  // ── Canvas render ────────────────────────────────────────────────────

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const img = processedCanvasRef.current ?? imageRef.current;
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
      srcW = img.width as number,
      srcH = img.height as number;
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
    ctx.restore();

    if (cropActive && cropRect) {
      drawCropOverlay(ctx, cw, ch, pan, zoom, cropRect);
    }
  }, []);

  // ── Load image from data URL ─────────────────────────────────────────

  const loadImage = useCallback(
    (dataUrl: string) => {
      const img = new Image();
      img.onload = () => {
        imageRef.current = img;

        // Store original pixels in offscreen canvas
        const origCanvas = document.createElement("canvas");
        origCanvas.width = img.naturalWidth;
        origCanvas.height = img.naturalHeight;
        const octx = origCanvas.getContext("2d");
        octx?.drawImage(img, 0, 0);
        originalCanvasRef.current = origCanvas;

        // Auto-zoom to fit
        const container = containerRef.current;
        if (container) {
          const cw = container.clientWidth;
          const ch = container.clientHeight;
          const zoomX = cw / img.naturalWidth;
          const zoomY = ch / img.naturalHeight;
          zoomRef.current = Math.min(zoomX, zoomY) * 0.9;
          panRef.current = { x: 0, y: 0 };
        }

        // Initial process (applies default params)
        processImage();
      };
      img.src = dataUrl;
    },
    [processImage],
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
    const unsub = useImageStore.subscribe(() => {
      renderCanvas();
    });
    return unsub;
  }, [renderCanvas]);

  // Re-render on resize
  useEffect(() => {
    const handleResize = () => renderCanvas();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [renderCanvas]);

  // ── Mouse handlers ───────────────────────────────────────────────────

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0 || !imageRef.current) return;
    isDragging.current = true;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging.current || !imageRef.current) return;
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      panRef.current.x += dx;
      panRef.current.y += dy;
      renderCanvas();
    },
    [renderCanvas],
  );

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!imageRef.current) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      zoomRef.current = Math.max(0.1, Math.min(zoomRef.current * delta, 50));
      renderCanvas();
    },
    [renderCanvas],
  );

  // ── Drag and drop ────────────────────────────────────────────────────

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
        style={{ display: "block", background: "#1a1a1a" }}
      />

      {hasImage && (
        <div className="absolute bottom-3 left-3 text-[11px] text-zinc-600 font-mono pointer-events-none select-none z-10">
          {Math.round(zoomRef.current * 100)}%
        </div>
      )}

      {!hasImage && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-10">
          <div className="flex flex-col items-center gap-3 text-zinc-700">
            <ImportIcon className="w-16 h-16" />
            <p className="text-sm font-medium">
              Drop an image here or click Import
            </p>
            <p className="text-xs text-zinc-800">JPEG, PNG, TIFF, WebP</p>
          </div>
        </div>
      )}

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
