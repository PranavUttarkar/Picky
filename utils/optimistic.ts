// Generic optimistic mutation helper
// Usage: optimisticUpdate({ apply, rollback, mutate })
// apply: update local state immediately (returns rollback data)
// rollback: restore state if mutate fails
// mutate: async network call
export async function optimisticUpdate<TRollback>(opts: {
  apply: () => TRollback;
  rollback: (data: TRollback) => void;
  mutate: () => Promise<any>;
}): Promise<void> {
  const snapshot = opts.apply();
  try {
    await opts.mutate();
  } catch (e) {
    try {
      opts.rollback(snapshot);
    } catch {}
    throw e;
  }
}
