import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RestTimer from './RestTimer';

describe('RestTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function advance(seconds: number) {
    act(() => {
      vi.advanceTimersByTime(seconds * 1000);
    });
  }

  it('starts at 0:00 and counts up once tapped', () => {
    render(<RestTimer />);

    expect(screen.getByText('00:00')).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: /Rest timer, 0:00, idle/ }),
    );
    advance(5);
    expect(screen.getByText('00:05')).toBeInTheDocument();
  });

  it('resets to 0:00 on tap while running and keeps running', () => {
    render(<RestTimer />);

    fireEvent.click(
      screen.getByRole('button', { name: /Rest timer, 0:00, idle/ }),
    );
    advance(20);
    expect(screen.getByText('00:20')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: /running — tap to restart/ }),
    );
    advance(3);
    expect(screen.getByText('00:03')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /running — tap to restart/ }),
    ).toBeInTheDocument();
  });

  it('shows the target rest reference but counts past it', () => {
    render(<RestTimer targetRestSeconds={60} />);
    expect(screen.getByText('Target rest 01:00')).toBeInTheDocument();
  });

  it('auto-starts a fresh rest when the signal increments', () => {
    const { rerender } = render(<RestTimer autoStartSignal={0} />);
    expect(screen.getByText('00:00')).toBeInTheDocument();

    rerender(<RestTimer autoStartSignal={1} />);
    advance(2);
    expect(screen.getByText('00:02')).toBeInTheDocument();

    rerender(<RestTimer autoStartSignal={2} />);
    advance(1);
    expect(screen.getByText('00:01')).toBeInTheDocument();
  });
});
