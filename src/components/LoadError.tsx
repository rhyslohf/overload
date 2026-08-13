import Button from './Button';

interface LoadErrorProps {
  onRetry: () => void;
  message?: string;
}

/**
 * Friendly load failure state with a Retry action (Phase 7 — empty/error
 * states). Used wherever data is read from storage so a storage hiccup is an
 * actionable message, never a hanging spinner.
 */
function LoadError({ onRetry, message }: LoadErrorProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-lg border border-danger/40 bg-danger/10 p-4 text-center"
    >
      <p className="text-sm text-danger">
        {message ?? 'Something went wrong loading that.'}
      </p>
      <Button variant="danger" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

export default LoadError;
