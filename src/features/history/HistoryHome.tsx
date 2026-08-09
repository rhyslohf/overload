function HistoryHome() {
  return (
    <div className="flex flex-col items-center gap-3 pt-12 text-center">
      <h1 className="text-2xl font-semibold">History</h1>
      <p className="max-w-xs text-sm text-ink-2">
        No logged sessions yet. Finish a workout and it'll land here.
      </p>
    </div>
  );
}

export default HistoryHome;
