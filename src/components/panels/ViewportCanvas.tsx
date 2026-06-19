import { useRef, useEffect, useCallback, useState } from "react";
import { useImageStore } from "@/store/useImageStore";

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

  // Pan & zoom refs (not state — avoids re-renders during drag)
  const panRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const isDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  // ── Canvas render (reads directly from store — no stale closures) ─────

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

    // Read all state directly from store
    const state = useImageStore.getState();
    const { rotation, flipped, cropActive, cropRect } = state;

    // Determine source region (after crop, if applied)
    let srcX = 0,
      srcY = 0,
      srcW = img.naturalWidth,
      srcH = img.naturalHeight;
    if (cropRect && !cropActive) {
      // Crop has been applied — use stored crop rect
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

    // ── Crop overlay (when actively cropping) ──
    if (cropActive && cropRect) {
      drawCropOverlay(ctx, cw, ch, pan, zoom, cropRect);
    }
  }, []);

  // ── Load image from data URL ──────────────────────────────────────────

  const loadImage = useCallback(
    (dataUrl: string) => {
      const img = new Image();
      img.onload = () => {
        imageRef.current = img;

        // Auto-zoom to fit the image within the viewport
        const container = containerRef.current;
        if (container) {
          const cw = container.clientWidth;
          const ch = container.clientHeight;
          const zoomX = cw / img.naturalWidth;
          const zoomY = ch / img.naturalHeight;
          zoomRef.current = Math.min(zoomX, zoomY) * 0.9;
          panRef.current = { x: 0, y: 0 };
        }

        renderCanvas();
      };
      img.src = dataUrl;
    },
    [renderCanvas],
  );

  // Register renderer with bridge
  useEffect(() => {
    onRegisterRenderer(loadImage);
  }, [onRegisterRenderer, loadImage]);

  // Listen for image-loaded event → hide placeholder
  useEffect(() => {
    const handler = () => setHasImage(true);
    window.addEventListener("filmlab:image-loaded", handler);
    return () => window.removeEventListener("filmlab:image-loaded", handler);
  }, []);

  // Re-render on store changes (rotation, flip, crop)
  useEffect(() => {
    const unsub = useImageStore.subscribe(() => {
      renderCanvas();
    });
    return unsub;
  }, [renderCanvas]);

  // Re-render on container resize
  useEffect(() => {
    const handleResize = () => renderCanvas();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [renderCanvas]);

  // ── Pan (mouse drag) ──────────────────────────────────────────────────

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

  // ── Zoom (mouse wheel) ────────────────────────────────────────────────

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

  // ── Drag and drop ─────────────────────────────────────────────────────

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

      {/* Zoom indicator */}
      {hasImage && (
        <div className="absolute bottom-3 left-3 text-[11px] text-zinc-600 font-mono pointer-events-none select-none z-10">
          {Math.round(zoomRef.current * 100)}%
        </div>
      )}

      {/* Empty state */}
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

      {/* Drag overlay */}
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
  const imgCenterX = cw / 2 + pan.x;
  const imgCenterY = ch / 2 + pan.y;

  const cropScreenX = imgCenterX + (cropRect.x - cropRect.width / 2) * zoom;
  const cropScreenY = imgCenterY + (cropRect.y - cropRect.height / 2) * zoom;
  const cropScreenW = cropRect.width * zoom;
  const cropScreenH = cropRect.height * zoom;

  // Dark overlay
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(0, 0, cw, ch);

  // Cut out crop area
  ctx.clearRect(cropScreenX, cropScreenY, cropScreenW, cropScreenH);

  // Border
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(cropScreenX, cropScreenY, cropScreenW, cropScreenH);

  // Corner handles
  const hs = 8;
  ctx.fillStyle = "#ffffff";
  const corners = [
    { x: cropScreenX, y: cropScreenY },
    { x: cropScreenX + cropScreenW, y: cropScreenY },
    { x: cropScreenX, y: cropScreenY + cropScreenH },
    { x: cropScreenX + cropScreenW, y: cropScreenY + cropScreenH },
  ];
  for (const c of corners) {
    ctx.fillRect(c.x - hs / 2, c.y - hs / 2, hs, hs);
  }

  // Center cross
  ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
  ctx.lineWidth = 1;
  const cx = cropScreenX + cropScreenW / 2;
  const cy = cropScreenY + cropScreenH / 2;
  ctx.beginPath();
  ctx.moveTo(cx, cropScreenY);
  ctx.lineTo(cx, cropScreenY + cropScreenH);
  ctx.moveTo(cropScreenX, cy);
  ctx.lineTo(cropScreenX + cropScreenW, cy);
  ctx.stroke();
}

// ─── Icon ───────────────────────────────────────────────────────────────────

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
