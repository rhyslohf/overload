import { useId } from 'react';

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
  maxLength?: number;
  type?: 'text' | 'number';
  min?: number;
  step?: number;
}

/**
 * Shared labeled input, sized for one-handed use (§8): ≥44px tall, visible
 * focus ring comes from the global :focus-visible rule.
 */
function TextField({
  label,
  value,
  onChange,
  placeholder,
  required,
  autoComplete,
  maxLength,
  type = 'text',
  min,
  step,
}: TextFieldProps) {
  const id = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm text-ink-2">
        {label}
        {required === true && (
          <span aria-hidden="true" className="ml-1 text-danger">
            *
          </span>
        )}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        maxLength={maxLength}
        min={min}
        step={step}
        required={required}
        className="min-h-11 w-full rounded-lg border border-line bg-panel px-3 text-base text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      />
    </div>
  );
}

export default TextField;
