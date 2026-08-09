import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'danger';

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink hover:bg-accent-hi active:bg-accent-hi',
  secondary:
    'border border-line bg-panel text-ink hover:bg-raise active:bg-raise',
  danger: 'border border-danger/40 bg-danger/10 text-danger hover:bg-danger/20',
};

const BASE_CLASSES =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-base font-semibold transition-colors duration-100 disabled:pointer-events-none disabled:opacity-40';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

function Button({ variant = 'primary', className, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={`${BASE_CLASSES} ${VARIANT_CLASSES[variant]} ${className ?? ''}`}
      {...rest}
    />
  );
}

export default Button;
