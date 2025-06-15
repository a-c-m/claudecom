// Strip ANSI escape codes from text
export function stripAnsi(text: string): string {
  // Remove all ANSI escape sequences
  return text
    .replace(/\x1B\[[0-9;]*m/g, '') // Color codes
    .replace(/\x1B\[[0-9]*[A-Z]/g, '') // Cursor movement
    .replace(/\x1B\[[0-9]*;[0-9]*[A-Z]/g, '') // More cursor movement
    .replace(/\x1B\[2K/g, '') // Clear line
    .replace(/\x1B\[1A/g, '') // Move up
    .replace(/\x1B\[G/g, '') // Move to beginning
    .replace(/\x1B\[[0-9]+m/g, '') // Other escape codes
    .replace(/\x1B\[[0-9]+;[0-9]+;[0-9]+;[0-9]+;[0-9]+m/g, '') // RGB colors
    .replace(/\x1B\[[0-9]+;[0-9]+;[0-9]+m/g, '') // More colors
    .replace(/\[\d+[A-Z]/g, '') // Remaining cursor codes
    .replace(/\[2K/g, '') // Clear line without escape
    .replace(/\[1A/g, '') // Move up without escape
    .replace(/\[G/g, ''); // Move to beginning without escape
}