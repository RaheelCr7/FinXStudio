/** Helpers shared by the Android and iOS build scripts. */

/** 887000 -> "14 min 47 s", 42000 -> "42 s" */
export function formatDuration(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  return m > 0 ? `${m} min ${total % 60} s` : `${total} s`;
}
