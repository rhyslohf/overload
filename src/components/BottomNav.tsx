export type View = 'routines' | 'history' | 'settings';

const VIEWS: ReadonlyArray<{ id: View; label: string }> = [
  { id: 'routines', label: 'Routines' },
  { id: 'history', label: 'History' },
  { id: 'settings', label: 'Settings' },
];

function ClipboardList({ active }: { active: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={active ? 'text-accent' : 'text-ink-3'}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="6" y="4" width="12" height="17" rx="2" />
      <path d="M10 9h4M10 13h4M10 17h3" />
    </svg>
  );
}

function Clock({ active }: { active: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={active ? 'text-accent' : 'text-ink-3'}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function Gear({ active }: { active: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={active ? 'text-accent' : 'text-ink-3'}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

interface BottomNavProps {
  view: View;
  onViewChange: (view: View) => void;
}

function BottomNav({ view, onViewChange }: BottomNavProps) {
  return (
    <nav
      aria-label="Primary"
      className="sticky bottom-0 z-10 border-t border-line bg-panel px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2"
    >
      <div className="grid grid-cols-3 gap-2">
        {VIEWS.map((item) => {
          const active = item.id === view;
          const Icon =
            item.id === 'routines'
              ? ClipboardList
              : item.id === 'history'
                ? Clock
                : Gear;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => onViewChange(item.id)}
              className="flex min-h-11 w-full flex-col items-center justify-center gap-1 rounded-lg border border-transparent px-2 py-2 text-xs font-medium text-ink-2 transition-colors duration-100 hover:bg-raise focus-visible:border-accent aria-current:text-accent"
            >
              <Icon active={active} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default BottomNav;
