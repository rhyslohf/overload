import type { ButtonHTMLAttributes } from 'react';

interface SwitchProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  checked: boolean;
  label: string;
  ariaLabel?: string;
}

/**
 * Accessible on/off toggle (role="switch"). Sized for touch (§8): the whole
 * 44px-tall pill is tappable, with visual thumb + track feedback.
 */
function Switch({
  checked,
  label,
  ariaLabel,
  className,
  ...rest
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel ?? label}
      className={`flex min-h-11 items-center justify-between gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors duration-100 ${className ?? ''} ${
        checked
          ? 'border-accent/50 bg-accent/10 text-accent-hi'
          : 'border-line/70 bg-panel text-ink-2'
      }`}
      {...rest}
    >
      {label}
      <span
        aria-hidden="true"
        className={`h-5 w-9 rounded-full p-0.5 transition-colors duration-100 ${
          checked ? 'bg-accent' : 'bg-line'
        }`}
      >
        <span
          className={`block h-4 w-4 rounded-full bg-panel transition-transform duration-100 ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </span>
    </button>
  );
}

export default Switch;
