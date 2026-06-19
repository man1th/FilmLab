import { useState, useCallback } from "react";
import {
  Undo2,
  Redo2,
  Download,
  RotateCw,
  FlipHorizontal,
  Crop,
  Monitor,
  Maximize2,
} from "lucide-react";
import { useEngineBridge } from "@/hooks/useEngineBridge";
import { useImageStore } from "@/store/useImageStore";
import { AppSidebar } from "@/components/app-sidebar";
import { ViewportCanvas } from "@/components/panels/ViewportCanvas";
import { CropDialog } from "@/components/panels/CropDialog";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

export function AppLayout() {
  const { hasImage, loadFile, registerImageRenderer } = useEngineBridge();
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const rotateClockwise = useImageStore((s) => s.rotateClockwise);
  const toggleFlip = useImageStore((s) => s.toggleFlip);

  const handleImportFile = useCallback(
    (file: File) => loadFile(file),
    [loadFile],
  );

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-[50px] shrink-0 items-center gap-2 border-b border-zinc-800 bg-zinc-900 px-4">
          <div className="flex-1" />

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 text-zinc-500"
              disabled={!hasImage}
              title="Undo"
            >
              <Undo2 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 text-zinc-500"
              disabled={!hasImage}
              title="Redo"
            >
              <Redo2 className="w-4 h-4" />
            </Button>

            <Separator
              orientation="vertical"
              className="h-6 bg-zinc-700 mx-1"
            />

            {/* PR / FR toggle */}
            <ResolutionToggle />

            <Separator
              orientation="vertical"
              className="h-6 bg-zinc-700 mx-1"
            />

            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 text-zinc-400 hover:text-zinc-100"
              disabled={!hasImage}
              onClick={rotateClockwise}
              title="Rotate 90° CW"
            >
              <RotateCw className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 text-zinc-400 hover:text-zinc-100"
              disabled={!hasImage}
              onClick={toggleFlip}
              title="Flip horizontal"
            >
              <FlipHorizontal className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 text-zinc-400 hover:text-zinc-100"
              disabled={!hasImage}
              onClick={() => setCropDialogOpen(true)}
              title="Crop image"
            >
              <Crop className="w-4 h-4" />
            </Button>

            <Separator
              orientation="vertical"
              className="h-6 bg-zinc-700 mx-1"
            />

            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 text-zinc-500"
              disabled={!hasImage}
              title="Export"
            >
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          <ViewportCanvas
            onRegisterRenderer={registerImageRenderer}
            onFileDrop={handleImportFile}
          />
        </div>
      </SidebarInset>

      <CropDialog open={cropDialogOpen} onOpenChange={setCropDialogOpen} />
    </SidebarProvider>
  );
}

// ─── PR / FR Resolution Toggle ────────────────────────────────────────────────

function ResolutionToggle() {
  const resolutionMode = useImageStore((s) => s.resolutionMode);
  const toggleResolution = useImageStore((s) => s.toggleResolution);
  const hasImage = useImageStore((s) => !!s.originalImageDataUrl);

  return (
    <div className="flex items-center rounded-md border border-zinc-700 overflow-hidden">
      <button
        onClick={toggleResolution}
        disabled={!hasImage}
        className={`flex items-center gap-1 px-2 py-1 text-[11px] font-medium transition-colors ${
          resolutionMode === "pr"
            ? "bg-zinc-700 text-zinc-100"
            : "bg-transparent text-zinc-500 hover:text-zinc-300"
        }`}
        title="Partial Resolution — process at 2000px preview"
      >
        <Monitor className="w-3 h-3" />
        PR
      </button>
      <div className="w-px h-4 bg-zinc-700" />
      <button
        onClick={toggleResolution}
        disabled={!hasImage}
        className={`flex items-center gap-1 px-2 py-1 text-[11px] font-medium transition-colors ${
          resolutionMode === "fr"
            ? "bg-zinc-700 text-zinc-100"
            : "bg-transparent text-zinc-500 hover:text-zinc-300"
        }`}
        title="Full Resolution — process at native image size"
      >
        <Maximize2 className="w-3 h-3" />
        FR
      </button>
    </div>
  );
}
