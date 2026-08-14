import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

describe('App shell', () => {
  it('renders the brand and lands on the Routines view', async () => {
    render(<App />);

    expect(screen.getByText('Workout Tracker')).toBeInTheDocument();
    expect(
      await screen.findByText('No routines yet — build your first one.'),
    ).toBeInTheDocument();
  });

  it('switches to the History view via the bottom nav', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'History' }));

    expect(
      screen.getByText(
        "No logged sessions yet. Finish a workout and it'll land here.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'History' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('switches to the Settings view via the bottom nav', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Settings' }));

    expect(
      screen.getByRole('heading', { name: 'Settings' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Settings' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});
