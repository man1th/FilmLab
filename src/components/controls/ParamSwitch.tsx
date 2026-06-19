import { useCallback } from 'react';
import { Switch } from '@/components/ui/switch';

interface ParamSwitchProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function ParamSwitch({ label, checked, onChange }: ParamSwitchProps) {
  const handleChange = useCallback(
    (v: boolean) => onChange(v),
    [onChange],
  );

  return (
    <div className="flex items-center justify-between">
      <label className="text-[11px] font-medium text-zinc-400">{label}</label>
      <Switch checked={checked} onCheckedChange={handleChange} />
    </div>
  );
}
