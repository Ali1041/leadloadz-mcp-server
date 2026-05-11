/**
 * Safe logging utilities for the MCP server.
 *
 * stdout is reserved for JSON-RPC messages. All logs, errors,
 * banners, and onboarding text MUST go to stderr.
 */

function formatArgs(args: unknown[]): string {
  return args.map((arg) =>
    typeof arg === "string" ? arg : JSON.stringify(arg)
  ).join(" ")
}

/**
 * Write a message to stderr.
 * This is the only safe way to output text in server mode.
 */
export function stderrLog(...args: unknown[]): void {
  process.stderr.write(formatArgs(args) + "\n")
}

/**
 * Redirect all console methods to stderr.
 * Call once at process startup before any other code runs.
 */
export function redirectConsoleToStderr(): void {
  console.log = (...args: unknown[]) => stderrLog("[log]", ...args)
  console.info = (...args: unknown[]) => stderrLog("[info]", ...args)
  console.warn = (...args: unknown[]) => stderrLog("[warn]", ...args)
  // console.error stays on stderr
}

/**
 * Sanitize a fatal error to prevent leaking sensitive info.
 */
export function sanitizeFatalError(err: unknown): string {
  if (err instanceof Error) {
    return err.message
  }
  return String(err)
}
