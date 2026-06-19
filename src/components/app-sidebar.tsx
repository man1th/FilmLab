import { ImageIcon } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { ControlSidebar } from "@/components/panels/ControlSidebar";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar {...props}>
      <SidebarHeader className="p-0">
        <div className="flex h-[50px] items-center gap-2 px-3 border-b border-[#27272A]">
          <ImageIcon className="w-5 h-5 text-amber-500 shrink-0" />
          <span className="font-semibold text-sm tracking-tight text-zinc-100">
            FilmLab
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <ControlSidebar />
      </SidebarContent>
    </Sidebar>
  );
}
