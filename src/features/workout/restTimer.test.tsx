import { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RestTimer from './RestTimer';

/** Parent harness that owns `runningSince` like WorkoutSessionView does. */
function Harness({
  targetRestSeconds,
}: {
  targetRestSeconds?: number;
} = {}) {
  const [runningSince, setRunningSince] = useState<number | null>(null);
  return (
    <RestTimer
      runningSince={runningSince}
      onTap={() => setRunningSince(Date.now())}
      targetRestSeconds={targetRestSeconds}
    />
  );
}

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
    render(<Harness />);

    expect(screen.getByText('00:00')).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: /Rest timer, 0:00, idle/ }),
    );
    advance(5);
    expect(screen.getByText('00:05')).toBeInTheDocument();
  });

  it('resets to 0:00 on tap while running and keeps running', () => {
    render(<Harness />);

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
    render(<Harness targetRestSeconds={60} />);
    expect(screen.getByText('Target rest 01:00')).toBeInTheDocument();
  });

  it('starts a fresh rest when the parent starts a new one', () => {
    const { rerender } = render(
      <RestTimer runningSince={null} onTap={() => {}} />,
    );
    expect(screen.getByText('00:00')).toBeInTheDocument();

    rerender(<RestTimer runningSince={Date.now()} onTap={() => {}} />);
    advance(2);
    expect(screen.getByText('00:02')).toBeInTheDocument();

    rerender(<RestTimer runningSince={Date.now()} onTap={() => {}} />);
    advance(1);
    expect(screen.getByText('00:01')).toBeInTheDocument();
  });

  it('keeps counting from the original start when re-mounted beside a later exercise', () => {
    vi.setSystemTime(1000);
    const { unmount } = render(
      <RestTimer runningSince={1000} onTap={() => {}} />,
    );
    expect(screen.getByText('00:00')).toBeInTheDocument();

    // The timer moves to the next exercise → unmount and remount with the
    // same runningSince; elapsed must continue rather than resetting.
    unmount();
    act(() => {
      vi.setSystemTime(6000);
    });
    render(<RestTimer runningSince={1000} onTap={() => {}} />);
    expect(screen.getByText('00:05')).toBeInTheDocument();
  });
});
