import { PACKAGE_VERSION } from "./version.js"

export { PACKAGE_VERSION }

export const DEFAULT_API_BASE = "https://leadloadz.com/api/mcp"

export function getUserAgent(): string {
  return `leadloadz-mcp-server/${PACKAGE_VERSION}`
}

/**
 * Normalize API base URL. Strips trailing slashes and rewrites www.leadloadz.com
 * to leadloadz.com because www redirects drop Authorization headers.
 */
export function normalizeApiBase(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "")

  try {
    const url = new URL(trimmed)
    if (url.hostname === "www.leadloadz.com") {
      url.hostname = "leadloadz.com"
      return url.toString().replace(/\/+$/, "")
    }
  } catch {
    return trimmed
  }

  return trimmed
}
