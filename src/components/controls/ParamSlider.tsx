import { useCallback, useState } from "react";
import { Info, X } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
interface ParamSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  displayValue?: string;
  onChange: (value: number) => void;
  /** Optional info text shown in a popover when the info icon is clicked */
  info?: string;
}

export function ParamSlider({
  label,
  value,
  min,
  max,
  step = 0.01,
  displayValue,
  onChange,
  info,
}: ParamSliderProps) {
  const [infoOpen, setInfoOpen] = useState(false);
  const handleChange = useCallback((v: number[]) => onChange(v[0]), [onChange]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <label className="text-xs font-medium text-zinc-400">{label}</label>
          {info && (
            <Popover open={infoOpen} onOpenChange={setInfoOpen}>
              <PopoverTrigger asChild>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setInfoOpen(true);
                  }}
                  className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
                >
                  <Info className="w-3 h-3" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                side="right"
                align="start"
                className="w-72 bg-zinc-900 border-zinc-800 p-0"
              >
                <div className="flex items-start justify-between p-3 pb-0">
                  <h4 className="text-xs font-semibold text-zinc-100">
                    {label}
                  </h4>
                  <button
                    onClick={() => setInfoOpen(false)}
                    className="text-zinc-600 hover:text-zinc-300 transition-colors -mr-1 -mt-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="p-3 pt-2">
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {info}
                  </p>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
        <span className="text-xs tabular-nums text-zinc-500">
          {displayValue ?? value.toFixed(2)}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={handleChange}
      />
    </div>
  );
}
