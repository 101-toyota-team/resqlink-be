/**
 * Formats distance in meters to a human-readable string (always in meters).
 */
export function formatDistance(meters: number): string {
  return `${Math.round(meters)} m`;
}

/**
 * Formats duration in seconds to a human-readable string.
 * If < 60 mins, returns "X mins".
 * If >= 60 mins, returns "H hour M mins".
 */
export function formatDuration(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60);
  if (totalMinutes < 60) {
    return `${totalMinutes} mins`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const hourStr = hours === 1 ? "hour" : "hours";
  return `${hours} ${hourStr} ${minutes} mins`;
}
