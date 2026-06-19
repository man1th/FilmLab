import { useCallback } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ParamSelectProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

export function ParamSelect({
  label,
  value,
  options,
  onChange,
}: ParamSelectProps) {
  const handleChange = useCallback(
    (v: string) => onChange(v),
    [onChange],
  );

  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-medium text-zinc-400">{label}</label>
      <Select value={value} onValueChange={handleChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
