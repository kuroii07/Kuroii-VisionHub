import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

export type StudioSelectOption = {
  value: string;
  label: string;
};

export function StudioSelect(props: {
  value: string;
  options: StudioSelectOption[];
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selected = useMemo(() => props.options.find((option) => option.value === props.value), [props.options, props.value]);
  const label = selected?.label ?? props.placeholder ?? props.value;

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className={`studioSelect ${open ? 'open' : ''} ${props.className ?? ''}`}>
      <button
        type="button"
        className="studioSelectButton"
        disabled={props.disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span>{label}</span>
        <ChevronDown size={15} />
      </button>
      {open ? (
        <div className="studioSelectMenu" role="listbox">
          {props.options.map((option) => {
            const active = option.value === props.value;
            return (
              <button
                key={option.value}
                type="button"
                className={active ? 'active' : ''}
                role="option"
                aria-selected={active}
                onClick={() => {
                  props.onChange(option.value);
                  setOpen(false);
                }}
              >
                <span>{option.label}</span>
                {active ? <Check size={14} /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
