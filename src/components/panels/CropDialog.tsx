import { useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useImageStore, CROP_ASPECT_RATIOS } from "@/store/useImageStore";
import { Crop, Image, Frame, Film } from "lucide-react";

interface CropDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CropDialog({ open, onOpenChange }: CropDialogProps) {
  const cropAspectId = useImageStore((s) => s.cropAspectId);
  const selectCropAspect = useImageStore((s) => s.selectCropAspect);
  const applyCrop = useImageStore((s) => s.applyCrop);
  const cancelCrop = useImageStore((s) => s.cancelCrop);

  // When dialog closes without Apply, cancel the crop
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        cancelCrop();
      }
      onOpenChange(newOpen);
    },
    [cancelCrop, onOpenChange],
  );

  const handleSelect = useCallback(
    (id: string) => {
      selectCropAspect(id);
    },
    [selectCropAspect],
  );

  const handleApply = useCallback(() => {
    if (!cropAspectId) return;
    applyCrop();
    onOpenChange(false);
  }, [cropAspectId, applyCrop, onOpenChange]);

  const handleCancel = useCallback(() => {
    cancelCrop();
    onOpenChange(false);
  }, [cancelCrop, onOpenChange]);

  const stillRatios = CROP_ASPECT_RATIOS.filter((r) => r.category === "still");
  const cinematicRatios = CROP_ASPECT_RATIOS.filter(
    (r) => r.category === "cinematic",
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto bg-zinc-900 border-zinc-800">
        <DialogHeader>
          <DialogTitle className="text-zinc-100 flex items-center gap-2">
            <Crop className="w-4 h-4" />
            Crop Image
          </DialogTitle>
          <DialogDescription className="text-zinc-500 text-xs">
            Select an aspect ratio. Drag the image within the crop area to
            recompose.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Still Photography */}
          <div>
            <h3 className="flex items-center gap-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
              <Image className="w-3.5 h-3.5" />
              Still Photography
            </h3>
            <div className="grid grid-cols-1 gap-1.5">
              {stillRatios.map((ratio) => (
                <button
                  key={ratio.id}
                  onClick={() => handleSelect(ratio.id)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-xs text-left transition-colors ${
                    cropAspectId === ratio.id
                      ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 border border-transparent"
                  }`}
                >
                  <Frame className="w-3.5 h-3.5 shrink-0 opacity-60" />
                  <span>{ratio.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Motion Picture & Cinematic */}
          <div>
            <h3 className="flex items-center gap-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
              <Film className="w-3.5 h-3.5" />
              Motion Picture & Cinematic
            </h3>
            <div className="grid grid-cols-1 gap-1.5">
              {cinematicRatios.map((ratio) => (
                <button
                  key={ratio.id}
                  onClick={() => handleSelect(ratio.id)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-xs text-left transition-colors ${
                    cropAspectId === ratio.id
                      ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 border border-transparent"
                  }`}
                >
                  <Film className="w-3.5 h-3.5 shrink-0 opacity-60" />
                  <span>{ratio.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            className="text-zinc-400 text-xs"
          >
            Cancel
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleApply}
            disabled={!cropAspectId}
            className="text-xs bg-amber-600 hover:bg-amber-500 text-white"
          >
            Apply Crop
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
