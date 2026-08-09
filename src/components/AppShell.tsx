import { type ReactNode } from 'react';
import BottomNav, { type View } from './BottomNav';

interface AppShellProps {
  view: View;
  onViewChange: (view: View) => void;
  children: ReactNode;
}

function AppShell({ view, onViewChange, children }: AppShellProps) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-canvas text-ink">
      <header className="sticky top-0 z-10 border-b border-line bg-canvas/95 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-2">
          Workout Tracker
        </p>
      </header>

      <main className="flex-1 px-4 py-6">{children}</main>

      <BottomNav view={view} onViewChange={onViewChange} />
    </div>
  );
}

export default AppShell;
