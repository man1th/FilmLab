import { useCallback } from 'react';
import { Slider } from '@/components/ui/slider';

interface ParamSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  displayValue?: string;
  onChange: (value: number) => void;
}

export function ParamSlider({
  label,
  value,
  min,
  max,
  step = 0.01,
  displayValue,
  onChange,
}: ParamSliderProps) {
  const handleChange = useCallback(
    (v: number[]) => onChange(v[0]),
    [onChange],
  );

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-medium text-zinc-400">{label}</label>
        <span className="text-[11px] tabular-nums text-zinc-500">
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
