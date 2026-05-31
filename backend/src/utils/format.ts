/**
 * Formats distance in meters to a human-readable string.
 * If < 1000m, returns "X m".
 * If >= 1000m, returns "X.Y km" (1 decimal).
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
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
