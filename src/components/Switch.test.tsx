import { render, screen } from '@testing-library/react';
import Switch from './Switch';

describe('Switch', () => {
  it('keeps its base styling when a className is passed', () => {
    render(<Switch checked={false} label="Warm-up" className="flex-1" />);

    const button = screen.getByRole('switch', { name: 'Warm-up' });
    expect(button).toHaveClass('min-h-11');
    expect(button).toHaveClass('rounded-lg');
    expect(button).toHaveClass('border');
    expect(button).toHaveClass('flex-1');
    expect(button).toHaveClass('bg-panel');
  });

  it('reflects the checked state in styling and aria', () => {
    render(<Switch checked label="To failure" />);

    const button = screen.getByRole('switch', { name: 'To failure' });
    expect(button).toHaveAttribute('aria-checked', 'true');
    expect(button).toHaveClass('bg-accent/10');
    expect(button).toHaveClass('border-accent/50');
  });
});
