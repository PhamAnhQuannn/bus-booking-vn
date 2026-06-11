/** Human-friendly trip display code derived from the CUID (display-only, no DB field). */
export function tripRef(id: string): string {
  return `CHUYEN-${id.slice(-6).toUpperCase()}`;
}
