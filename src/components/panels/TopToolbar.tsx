import { useRef, useCallback } from "react";
import {
  Upload,
  Undo2,
  Redo2,
  Download,
  ImageIcon,
  RotateCw,
  FlipHorizontal,
  Crop,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useImageStore } from "@/store/useImageStore";

interface TopToolbarProps {
  onImportFile?: (file: File) => void;
  onExport?: () => void;
  hasImage?: boolean;
  onOpenCrop?: () => void;
}

export function TopToolbar({
  onImportFile,
  onExport,
  hasImage = false,
  onOpenCrop,
}: TopToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rotateClockwise = useImageStore((s) => s.rotateClockwise);
  const toggleFlip = useImageStore((s) => s.toggleFlip);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !onImportFile) return;
      onImportFile(file);
      e.target.value = "";
    },
    [onImportFile],
  );

  return (
    <header className="h-14 flex items-center justify-between bg-zinc-900 border-b border-zinc-800 px-4 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <ImageIcon className="w-5 h-5 text-amber-500" />
        <span className="font-semibold text-sm tracking-tight text-zinc-100">
          FilmLab
        </span>
      </div>

      {/* Center Actions */}
      <div className="flex items-center gap-1">
        {/* Import */}
        <Button
          variant="ghost"
          size="icon"
          className="w-8 h-8 text-zinc-400"
          onClick={handleImportClick}
          title="Import image"
        >
          <Upload className="w-4 h-4" />
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/tiff,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />

        <div className="w-px h-6 bg-zinc-700 mx-1" />

        {/* Undo / Redo */}
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

        <div className="w-px h-6 bg-zinc-700 mx-1" />

        {/* Rotate */}
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

        {/* Flip */}
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

        {/* Crop */}
        <Button
          variant="ghost"
          size="icon"
          className="w-8 h-8 text-zinc-400 hover:text-zinc-100"
          disabled={!hasImage}
          onClick={onOpenCrop}
          title="Crop image"
        >
          <Crop className="w-4 h-4" />
        </Button>

        <div className="w-px h-6 bg-zinc-700 mx-1" />

        {/* Export */}
        <Button
          variant="ghost"
          size="icon"
          className="w-8 h-8 text-zinc-500"
          disabled={!hasImage}
          onClick={onExport}
          title="Export image"
        >
          <Download className="w-4 h-4" />
        </Button>
      </div>

      {/* Right spacer */}
      <div className="w-[88px]" />
    </header>
  );
}
