import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

describe('App shell', () => {
  it('renders the brand and lands on the Routines view', () => {
    render(<App />);

    expect(screen.getByText('Workout Tracker')).toBeInTheDocument();
    expect(
      screen.getByText('No routines yet — build your first one.'),
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
});
