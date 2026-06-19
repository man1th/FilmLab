import { useState, useCallback } from "react";
import { useEngineBridge } from "@/hooks/useEngineBridge";
import { TopToolbar } from "./panels/TopToolbar";
import { ViewportCanvas } from "./panels/ViewportCanvas";
import { ControlSidebar } from "./panels/ControlSidebar";
import { CropDialog } from "./panels/CropDialog";

export function AppLayout() {
  const { hasImage, loadFile, registerImageRenderer } = useEngineBridge();
  const [cropDialogOpen, setCropDialogOpen] = useState(false);

  const handleImportFile = useCallback(
    (file: File) => {
      loadFile(file);
    },
    [loadFile],
  );

  const handleOpenCrop = useCallback(() => {
    setCropDialogOpen(true);
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-zinc-950 text-foreground overflow-hidden">
      <TopToolbar
        onImportFile={handleImportFile}
        hasImage={hasImage}
        onOpenCrop={handleOpenCrop}
      />

      <div className="flex flex-1 overflow-hidden">
        <ViewportCanvas
          onRegisterRenderer={registerImageRenderer}
          onFileDrop={handleImportFile}
        />
        <ControlSidebar />
      </div>

      {/* Crop Dialog */}
      <CropDialog open={cropDialogOpen} onOpenChange={setCropDialogOpen} />
    </div>
  );
}
