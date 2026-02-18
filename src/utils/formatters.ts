/** Format milliseconds as HH:MM:SS */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

/** Format heart rate with units */
export function formatHeartRate(bpm: number): string {
  return `${Math.round(bpm)} bpm`;
}

/** Format BPM target */
export function formatBPM(bpm: number): string {
  return `${Math.round(bpm)} BPM`;
}

/** Format Unix timestamp as HH:MM:SS */
export function formatTimestamp(unixMs: number): string {
  const date = new Date(unixMs);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}
